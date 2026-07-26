import crypto from "node:crypto";
import {
  MoodleCommandProvider,
  MoodleCommandProviderError,
} from "./moodleCommandProvider.js";
import {
  hashMoodleProviderResult,
  SupabaseMoodleCommandRepository,
  type ClaimedMoodleCommand,
} from "./moodleCommandRepository.js";
import { stableMoodleJson } from "./moodleCommandRuntime.js";

export class MoodleCommandService {
  constructor(
    private readonly repository = new SupabaseMoodleCommandRepository(),
    private readonly provider = new MoodleCommandProvider()
  ) {}

  async processOne(workerId = `moodle-worker-${crypto.randomUUID()}`) {
    const command = await this.repository.claim(workerId);
    if (!command) return { outcome: "empty" as const };
    return this.executeClaimed(command, workerId);
  }

  private async executeClaimed(
    command: ClaimedMoodleCommand,
    workerId: string
  ) {
    let result;
    try {
      result = await this.provider.execute({
        protocolVersion: "1.0",
        operation: command.operation,
        idempotencyKey: command.idempotencyKey,
        payloadHash: command.payloadHash,
        expectedProviderVersion: command.expectedProviderVersion,
        actorExternalId: command.actorExternalId,
        targetExternalId: command.targetExternalId,
        targetContextExternalId: command.targetContextExternalId,
        originatingCommandId: command.originatingCommandId,
        payloadJson: stableMoodleJson(command.payload),
      });
    } catch (error) {
      const providerError =
        error instanceof MoodleCommandProviderError
          ? error
          : new MoodleCommandProviderError(
              "Moodle command outcome is unknown.",
              "unknown",
              "worker_error"
            );
      await this.repository.complete(command, workerId, {
        outcome: providerError.outcome,
        providerRequestId: providerError.providerRequestId,
        errorCode: providerError.code,
      });
      return {
        outcome: providerError.outcome,
        commandId: command.commandRequestId,
      };
    }
    await this.repository.complete(command, workerId, {
      outcome: "applied",
      responseHash: hashMoodleProviderResult(result),
      providerVersion: result.providerVersion,
    });
    return {
      outcome: "applied" as const,
      commandId: command.commandRequestId,
    };
  }
}
