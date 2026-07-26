import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  getMoodleRoleCapabilities,
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
  it("hashes payloads canonically regardless of object key order", () => {
    expect(
      hashMoodleCommandPayload({
        visible: true,
        title: "Synthetic page",
        nested: { second: 2, first: 1 },
      })
    ).toBe(
      hashMoodleCommandPayload({
        nested: { first: 1, second: 2 },
        title: "Synthetic page",
        visible: true,
      })
    );
  });

  it("accepts the exact complete versioned plugin capability manifest", () => {
    const parsed = parseMoodlePluginCapabilityManifest(manifest);

    expect(parsed.operations.map(item => item.name)).toEqual(
      MOODLE_COMMAND_OPERATIONS
    );
    expect(parsed.nativeLaunchKinds).toEqual(MOODLE_NATIVE_LAUNCH_KINDS);
  });

  it("keeps the closed role capability matrix explicit", () => {
    expect(getMoodleRoleCapabilities("student")).toEqual({
      operations: [],
      nativeLaunchKinds: ["quiz_attempt", "assignment_submission"],
    });
    expect(getMoodleRoleCapabilities("teacher").operations).toHaveLength(16);
    expect(getMoodleRoleCapabilities("teacher").operations).not.toContain(
      "delivery_course.clone"
    );
    expect(getMoodleRoleCapabilities("headofdepartment").operations).toEqual(
      MOODLE_COMMAND_OPERATIONS
    );
    expect(getMoodleRoleCapabilities("superadmin")).toEqual({
      operations: [
        "delivery_course.clone",
        "delivery_course.archive",
        "delivery_course.restore",
      ],
      nativeLaunchKinds: [],
    });
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
