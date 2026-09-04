import type { PlatformWorkflowActionResult } from "../client/src/lib/domain/actions.js";

export const normalizedCommandTypes = [
  "profile.update",
  "support.ticket.create",
  "lead.create",
  "application.create",
  "lead.convert",
  "placement.create",
  "placement.result.record",
  "calendar.create",
  "attendance.save",
] as const;

export type NormalizedCommandType = (typeof normalizedCommandTypes)[number];

export type PlatformCommand<
  TType extends string = NormalizedCommandType,
  TPayload extends Record<string, unknown> = Record<string, unknown>,
> = {
  type: TType;
  aggregateId?: string;
  expectedVersion?: number;
  idempotencyKey: string;
  payload: TPayload;
};

export type PlatformCommandResult = {
  commandId: string;
  entityId: string;
  version: number;
  status: "applied" | "replayed" | "queued";
  auditId: string;
  outboxEventIds: string[];
  allowedActions: string[];
};

const typeSet = new Set<string>(normalizedCommandTypes);
const idempotencyPattern = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{7,199}$/;
const forbiddenPayloadKeys = new Set([
  "actorId",
  "actorRole",
  "activeRole",
  "activeRoleGrantId",
  "authUserId",
  "authorizationModel",
  "branchIds",
  "departmentIds",
  "provider",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

export function parsePlatformCommand(value: unknown): PlatformCommand | null {
  if (!isRecord(value)) return null;
  const keys = Object.keys(value);
  if (
    keys.some(
      key =>
        ![
          "type",
          "aggregateId",
          "expectedVersion",
          "idempotencyKey",
          "payload",
        ].includes(key)
    ) ||
    typeof value.type !== "string" ||
    !typeSet.has(value.type) ||
    typeof value.idempotencyKey !== "string" ||
    !idempotencyPattern.test(value.idempotencyKey) ||
    !isRecord(value.payload) ||
    Object.keys(value.payload).some(key => forbiddenPayloadKeys.has(key))
  ) {
    return null;
  }
  if (
    value.aggregateId !== undefined &&
    (typeof value.aggregateId !== "string" ||
      !value.aggregateId.trim() ||
      value.aggregateId.length > 160)
  ) {
    return null;
  }
  if (
    value.expectedVersion !== undefined &&
    (typeof value.expectedVersion !== "number" ||
      !Number.isInteger(value.expectedVersion) ||
      value.expectedVersion < 1)
  ) {
    return null;
  }
  return {
    type: value.type as NormalizedCommandType,
    aggregateId:
      typeof value.aggregateId === "string"
        ? value.aggregateId.trim()
        : undefined,
    expectedVersion:
      typeof value.expectedVersion === "number"
        ? value.expectedVersion
        : undefined,
    idempotencyKey: value.idempotencyKey,
    payload: value.payload,
  };
}

function resultRecord(result: PlatformWorkflowActionResult) {
  return isRecord(result.result) ? result.result : {};
}

function collectOutboxEventIds(value: Record<string, unknown>) {
  const ids = new Set<string>();
  for (const [key, item] of Object.entries(value)) {
    if (
      /outboxEventIds?$/i.test(key) &&
      typeof item === "string" &&
      item.trim()
    ) {
      ids.add(item);
    } else if (/outboxEventIds?$/i.test(key) && Array.isArray(item)) {
      item
        .filter(entry => typeof entry === "string" && entry.trim())
        .forEach(entry => ids.add(entry as string));
    }
  }
  return Array.from(ids);
}

export function toPlatformCommandResult(
  result: PlatformWorkflowActionResult
): PlatformCommandResult | null {
  const details = resultRecord(result);
  const commandId =
    typeof details.commandId === "string" ? details.commandId : "";
  const version =
    typeof details.version === "number"
      ? details.version
      : typeof details.sessionVersion === "number"
        ? details.sessionVersion
        : 0;
  if (
    !commandId ||
    !result.entityId ||
    !Number.isInteger(version) ||
    version < 1
  )
    return null;
  return {
    commandId,
    entityId: result.entityId,
    version,
    status: details.replayed === true ? "replayed" : "applied",
    auditId: typeof details.auditId === "string" ? details.auditId : commandId,
    outboxEventIds: collectOutboxEventIds(details),
    allowedActions: [],
  };
}
