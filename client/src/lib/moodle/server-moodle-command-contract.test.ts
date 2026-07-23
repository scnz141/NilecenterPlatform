import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  hashMoodleCommandPayload,
  MOODLE_COMMAND_OPERATIONS,
  MOODLE_NATIVE_LAUNCH_KINDS,
  MoodleCommandContractError,
  parseMoodleCommandEnvelope,
  parseMoodlePluginCapabilityManifest,
} from "../../../../server/moodleCommandContract.js";

const manifest = JSON.parse(
  readFileSync(
    path.resolve(
      process.cwd(),
      "docs/integrations/local_nilelearn-capability-manifest.v1.json"
    ),
    "utf8"
  )
);

function command(overrides: Record<string, unknown> = {}) {
  const payload = { title: "Synthetic page", visible: true };
  return {
    protocolVersion: "1.0",
    operation: "page.upsert",
    idempotencyKey: "moodle.page.synthetic-001",
    payloadHash: hashMoodleCommandPayload(payload),
    expectedProviderVersion: "version-4",
    connectionId: "10000000-0000-4000-8000-000000000001",
    actorMappingId: "20000000-0000-4000-8000-000000000001",
    targetMappingId: "30000000-0000-4000-8000-000000000001",
    targetContextId: "40000000-0000-4000-8000-000000000001",
    originatingCommandId: "50000000-0000-4000-8000-000000000001",
    payload,
    ...overrides,
  };
}

describe("Moodle command and local_nilelearn contracts", () => {
  it("accepts the exact complete versioned plugin capability manifest", () => {
    const parsed = parseMoodlePluginCapabilityManifest(manifest);

    expect(parsed.operations.map(item => item.name)).toEqual(
      MOODLE_COMMAND_OPERATIONS
    );
    expect(parsed.nativeLaunchKinds).toEqual(MOODLE_NATIVE_LAUNCH_KINDS);
  });

  it("rejects missing, duplicate, unknown, or malformed plugin capabilities", () => {
    const missing = structuredClone(manifest);
    missing.operations.pop();
    expect(() => parseMoodlePluginCapabilityManifest(missing)).toThrow(
      MoodleCommandContractError
    );

    const duplicate = structuredClone(manifest);
    duplicate.operations.push(duplicate.operations[0]);
    expect(() => parseMoodlePluginCapabilityManifest(duplicate)).toThrow(
      MoodleCommandContractError
    );

    expect(() =>
      parseMoodlePluginCapabilityManifest({ ...manifest, unexpected: true })
    ).toThrow(MoodleCommandContractError);
  });

  it("accepts an exact safe idempotent command envelope", () => {
    expect(parseMoodleCommandEnvelope(command())).toMatchObject({
      operation: "page.upsert",
      expectedProviderVersion: "version-4",
      protocolVersion: "1.0",
    });
  });

  it("rejects payload tampering, secrets, unknown fields, and native launch operations", () => {
    expect(() =>
      parseMoodleCommandEnvelope(
        command({ payload: { title: "Changed after hashing" } })
      )
    ).toThrow("payload hash differs");

    const unsafePayload = { title: "Page", wstoken: "not-allowed" };
    expect(() =>
      parseMoodleCommandEnvelope(
        command({
          payload: unsafePayload,
          payloadHash: hashMoodleCommandPayload(unsafePayload),
        })
      )
    ).toThrow("payload is unsafe");

    expect(() =>
      parseMoodleCommandEnvelope({ ...command(), actorRole: "superadmin" })
    ).toThrow(MoodleCommandContractError);
    expect(() =>
      parseMoodleCommandEnvelope(command({ operation: "lesson_authoring" }))
    ).toThrow(MoodleCommandContractError);
  });
});
