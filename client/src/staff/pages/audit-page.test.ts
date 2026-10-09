import { describe, expect, it } from "vitest";
import type { NccAuditEventDto } from "@/lib/backend/api";
import { describeEvent } from "./audit-page";

const event = (overrides: Partial<NccAuditEventDto>): NccAuditEventDto => ({
  id: "e1",
  stream: "auth",
  eventType: "login_success",
  createdAt: "2026-10-09T14:32:17Z",
  actorDisplayName: "Nile QA Registrar",
  actorUserId: "u1",
  branchId: null,
  entityId: "u1",
  entityLabel: "Nile QA Registrar",
  secondaryEntityId: null,
  targetUserId: "u1",
  ...overrides,
});

describe("describeEvent", () => {
  it("names a sign-in once, not twice", () => {
    expect(describeEvent(event({}))).toEqual({
      actor: "Nile QA Registrar",
      action: "signed in",
      entity: null,
      tone: "positive",
    });
  });

  it("builds a generic sentence from the verb and the stream noun", () => {
    const text = describeEvent(
      event({ stream: "course", eventType: "refreshed", entityLabel: "Arabic Foundations" })
    );
    expect(`${text.actor} ${text.action} ${text.entity}`).toBe(
      "Nile QA Registrar refreshed course Arabic Foundations"
    );
    expect(text.tone).toBe("neutral");
  });

  it("marks destructive actions and unknown actors", () => {
    expect(describeEvent(event({ stream: "branch", eventType: "disabled", entityLabel: "Cairo" })).tone).toBe(
      "critical"
    );
    expect(
      describeEvent(event({ eventType: "login_failed", actorDisplayName: null, entityLabel: null })).actor
    ).toBe("Someone");
  });

  it("falls back to a readable phrase for new event types", () => {
    const text = describeEvent(event({ stream: "room", eventType: "archived", entityLabel: "Room 2" }));
    expect(text.action).toBe("archived on room");
  });
});
