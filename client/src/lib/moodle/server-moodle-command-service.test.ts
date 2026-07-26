import { describe, expect, it, vi } from "vitest";

import {
  MoodleCommandProviderError,
  type MoodleProviderCommandResult,
  type MoodleProviderCommandRequest,
} from "../../../../server/moodleCommandProvider";
import type { ClaimedMoodleCommand } from "../../../../server/moodleCommandRepository";
import { MoodleCommandService } from "../../../../server/moodleCommandService";
import { MOODLE_COMMAND_OPERATIONS } from "../../../../server/moodleCommandContract";

const claimed: ClaimedMoodleCommand = {
  commandRequestId: "d6100000-0000-4000-8000-000000000001",
  operation: "page.upsert",
  connectionId: "70000000-0000-4000-8000-000000000001",
  actorExternalId: "21",
  targetExternalId: "42",
  targetContextExternalId: "57",
  expectedProviderVersion: "m405-7-1784800000",
  payload: {
    mode: "create",
    name: "Synthetic page",
    content: "<p>Synthetic content</p>",
  },
  payloadHash: "a".repeat(64),
  idempotencyKey: "phase6l.page.synthetic.001:provider",
  originatingCommandId: "d6200000-0000-4000-8000-000000000001",
  attemptNumber: 1,
};

function repository(command: ClaimedMoodleCommand | null = claimed) {
  return {
    claim: vi.fn(async () => command),
    complete: vi.fn(async () => undefined),
  };
}

describe("Moodle command service", () => {
  it("processes every closed operation through the provider boundary", async () => {
    const commands = MOODLE_COMMAND_OPERATIONS.map((operation, index) => ({
      ...claimed,
      commandRequestId: `d6100000-0000-4000-8000-${String(index + 10).padStart(12, "0")}`,
      originatingCommandId: `d6200000-0000-4000-8000-${String(index + 10).padStart(12, "0")}`,
      idempotencyKey: `phase6l.${operation}.synthetic.${String(index).padStart(3, "0")}`,
      operation,
    }));
    const queue = [...commands];
    const repo = {
      claim: vi.fn(async () => queue.shift() ?? null),
      complete: vi.fn(async () => undefined),
    };
    const applied = new Map<string, MoodleProviderCommandResult>();
    const provider = {
      execute: vi.fn(async (request: MoodleProviderCommandRequest) => {
        const existing = applied.get(request.idempotencyKey);
        if (existing) return { ...existing, replayed: true };
        const result: MoodleProviderCommandResult = {
          commandUuid: request.originatingCommandId,
          operation: request.operation,
          status: "applied",
          providerVersion: `fixture-${request.operation}-${applied.size + 1}`,
          resultJson: JSON.stringify({ operation: request.operation }),
          replayed: false,
        };
        applied.set(request.idempotencyKey, result);
        return result;
      }),
    };
    const service = new MoodleCommandService(repo as never, provider as never);

    for (const command of commands) {
      await expect(service.processOne("worker-all")).resolves.toEqual({
        outcome: "applied",
        commandId: command.commandRequestId,
      });
    }
    await expect(service.processOne("worker-all")).resolves.toEqual({
      outcome: "empty",
    });
    expect(provider.execute).toHaveBeenCalledTimes(
      MOODLE_COMMAND_OPERATIONS.length
    );
    expect(repo.complete).toHaveBeenCalledTimes(
      MOODLE_COMMAND_OPERATIONS.length
    );
  });

  it("records an applied provider result after read-back", async () => {
    const repo = repository();
    const result: MoodleProviderCommandResult = {
      commandUuid: claimed.originatingCommandId,
      operation: claimed.operation,
      status: "applied",
      providerVersion: "m405-page-91-1784800200",
      resultJson: '{"externalId":"91"}',
      replayed: false,
    };
    const provider = { execute: vi.fn(async () => result) };
    const service = new MoodleCommandService(repo as never, provider as never);

    await expect(service.processOne("worker-1")).resolves.toEqual({
      outcome: "applied",
      commandId: claimed.commandRequestId,
    });
    expect(repo.complete).toHaveBeenCalledWith(
      claimed,
      "worker-1",
      expect.objectContaining({
        outcome: "applied",
        providerVersion: result.providerVersion,
        responseHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      })
    );
  });

  it("records unknown outcomes for reconciliation instead of retrying blindly", async () => {
    const repo = repository();
    const provider = {
      execute: vi.fn(async () => {
        throw new MoodleCommandProviderError(
          "Moodle command timed out.",
          "unknown",
          "timeout",
          "provider-request-1"
        );
      }),
    };
    const service = new MoodleCommandService(repo as never, provider as never);

    await expect(service.processOne("worker-2")).resolves.toEqual({
      outcome: "unknown",
      commandId: claimed.commandRequestId,
    });
    expect(repo.complete).toHaveBeenCalledWith(claimed, "worker-2", {
      outcome: "unknown",
      providerRequestId: "provider-request-1",
      errorCode: "timeout",
    });
    expect(provider.execute).toHaveBeenCalledOnce();
  });

  it("leaves repository completion failures visible for lease recovery", async () => {
    const repo = repository();
    repo.complete.mockRejectedValueOnce(new Error("completion unavailable"));
    const provider = {
      execute: vi.fn(async () => ({
        commandUuid: claimed.originatingCommandId,
        operation: claimed.operation,
        status: "applied",
        providerVersion: "m405-page-91-1784800200",
        resultJson: '{"externalId":"91"}',
        replayed: false,
      })),
    };
    const service = new MoodleCommandService(repo as never, provider as never);

    await expect(service.processOne("worker-3")).rejects.toThrow(
      "completion unavailable"
    );
  });
});
