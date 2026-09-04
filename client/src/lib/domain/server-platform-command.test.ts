import { describe, expect, it } from "vitest";

import {
  parsePlatformCommand,
  toPlatformCommandResult,
} from "../../../../server/platformCommand";

describe("normalized platform command contract", () => {
  it("accepts a strict versioned command envelope", () => {
    expect(
      parsePlatformCommand({
        type: "profile.update",
        aggregateId: "user-1",
        expectedVersion: 3,
        idempotencyKey: "profile:update:0001",
        payload: { name: "Updated User" },
      })
    ).toEqual({
      type: "profile.update",
      aggregateId: "user-1",
      expectedVersion: 3,
      idempotencyKey: "profile:update:0001",
      payload: { name: "Updated User" },
    });
  });

  it("rejects unsupported commands, malformed versions, and actor claims", () => {
    expect(
      parsePlatformCommand({
        type: "record.save",
        idempotencyKey: "record:save:0001",
        payload: {},
      })
    ).toBeNull();
    expect(
      parsePlatformCommand({
        type: "profile.update",
        expectedVersion: 0,
        idempotencyKey: "profile:update:0002",
        payload: {},
      })
    ).toBeNull();
    expect(
      parsePlatformCommand({
        type: "attendance.save",
        idempotencyKey: "attendance:save:0001",
        payload: { actorId: "forged-user" },
      })
    ).toBeNull();
  });

  it("returns closed command evidence without a platform snapshot", () => {
    expect(
      toPlatformCommandResult({
        action: "attendance.saved",
        entityType: "ClassSession",
        entityId: "session-1",
        summary: "Attendance saved.",
        result: {
          commandId: "command-1",
          sessionVersion: 4,
          outboxEventId: "outbox-1",
          replayed: false,
        },
      })
    ).toEqual({
      commandId: "command-1",
      entityId: "session-1",
      version: 4,
      status: "applied",
      auditId: "command-1",
      outboxEventIds: ["outbox-1"],
      allowedActions: [],
    });
  });

  it("fails closed when command evidence is incomplete", () => {
    expect(
      toPlatformCommandResult({
        action: "lead.created",
        entityType: "Lead",
        entityId: "lead-1",
        summary: "Lead created.",
        result: { version: 1 },
      })
    ).toBeNull();
  });
});
