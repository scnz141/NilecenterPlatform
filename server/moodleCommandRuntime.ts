import crypto from "node:crypto";
import {
  MOODLE_COMMAND_OPERATIONS,
  MOODLE_NATIVE_LAUNCH_KINDS,
  type MoodleCommandOperation,
  type MoodleNativeLaunchKind,
} from "./moodleCommandContract.js";

export const MOODLE_COMMAND_STATES = [
  "queued",
  "processing",
  "applied",
  "failed",
  "reconciliation_required",
  "cancelled",
] as const;

export type MoodleCommandState = (typeof MOODLE_COMMAND_STATES)[number];

export type MoodleCommandCreateDto = Readonly<{
  operation: MoodleCommandOperation;
  targetInternalId?: string;
  targetEntityType?: string;
  expectedProviderVersion: string;
  payload: Readonly<Record<string, unknown>>;
  idempotencyKey: string;
}>;

export type MoodleCommandStatusDto = Readonly<{
  commandId: string;
  operation: MoodleCommandOperation;
  status: MoodleCommandState;
  providerVersion?: string;
  reconciliationCaseId?: string;
  attemptCount: number;
  errorCode?: string;
  createdAt: string;
  updatedAt: string;
  allowedActions: readonly ("refresh" | "reconcile")[];
}>;

export type MoodleLaunchCreateDto = Readonly<{
  kind: MoodleNativeLaunchKind;
  targetInternalId: string;
  targetEntityType: string;
  returnPath: string;
}>;

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const versionPattern = /^[a-z0-9][a-z0-9._:+-]{0,79}$/i;
const idempotencyPattern = /^[a-z0-9][a-z0-9._:-]{7,127}$/;
const entityTypePattern = /^[a-z][a-z0-9_]{1,63}$/;
const returnPathPattern = /^\/app\/[a-z0-9/_-]{1,220}$/;
const forbiddenKeyPattern =
  /^(password|secret|api[_-]?key|token|authorization|cookie|set-cookie|wstoken)$/i;
const operationSet = new Set<string>(MOODLE_COMMAND_OPERATIONS);
const launchSet = new Set<string>(MOODLE_NATIVE_LAUNCH_KINDS);
const httpsUrlPattern = /^https:\/\/[^\s]{1,2000}$/i;
const mimeTypePattern =
  /^[a-z0-9][a-z0-9.+-]{0,63}\/[a-z0-9][a-z0-9.+-]{0,127}$/i;
const sha256Pattern = /^[a-f0-9]{64}$/;

export class MoodleCommandValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MoodleCommandValidationError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function containsForbiddenKey(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(containsForbiddenKey);
  if (!isRecord(value)) return false;
  return Object.entries(value).some(
    ([key, item]) => forbiddenKeyPattern.test(key) || containsForbiddenKey(item)
  );
}

function exactKeys(
  value: Record<string, unknown>,
  required: readonly string[],
  optional: readonly string[] = []
) {
  const keys = Object.keys(value);
  const allowed = new Set([...required, ...optional]);
  return (
    required.every(key => keys.includes(key)) &&
    keys.every(key => allowed.has(key))
  );
}

function requirePayloadShape(
  payload: Record<string, unknown>,
  required: readonly string[],
  optional: readonly string[] = []
) {
  if (!exactKeys(payload, required, optional)) {
    throw new MoodleCommandValidationError(
      "Moodle command payload is invalid."
    );
  }
}

function requirePayloadText(
  payload: Record<string, unknown>,
  field: string,
  maximumLength: number,
  allowEmpty = false
) {
  const value = payload[field];
  if (
    typeof value !== "string" ||
    (!allowEmpty && value.trim().length === 0) ||
    value.length > maximumLength
  ) {
    throw new MoodleCommandValidationError(
      "Moodle command payload is invalid."
    );
  }
}

function requirePayloadUuid(payload: Record<string, unknown>, field: string) {
  if (
    typeof payload[field] !== "string" ||
    !uuidPattern.test(payload[field] as string)
  ) {
    throw new MoodleCommandValidationError(
      "Moodle command payload is invalid."
    );
  }
}

function optionalBoolean(payload: Record<string, unknown>, field: string) {
  if (payload[field] !== undefined && typeof payload[field] !== "boolean") {
    throw new MoodleCommandValidationError(
      "Moodle command payload is invalid."
    );
  }
}

function optionalInteger(
  payload: Record<string, unknown>,
  field: string,
  minimum = 0,
  maximum = Number.MAX_SAFE_INTEGER
) {
  const value = payload[field];
  if (
    value !== undefined &&
    (!Number.isSafeInteger(value) ||
      (value as number) < minimum ||
      (value as number) > maximum)
  ) {
    throw new MoodleCommandValidationError(
      "Moodle command payload is invalid."
    );
  }
}

function validateModulePayload(
  payload: Record<string, unknown>,
  required: readonly string[],
  optional: readonly string[]
) {
  requirePayloadShape(
    payload,
    ["mode", "name", ...required],
    ["sectionNumber", "intro", "visible", ...optional]
  );
  if (!["create", "update"].includes(String(payload.mode))) {
    throw new MoodleCommandValidationError(
      "Moodle command payload is invalid."
    );
  }
  requirePayloadText(payload, "name", 255);
  if (payload.intro !== undefined)
    requirePayloadText(payload, "intro", 20_000, true);
  optionalInteger(payload, "sectionNumber", 0, 10_000);
  optionalBoolean(payload, "visible");
}

function validateMoodleOperationPayload(
  operation: MoodleCommandOperation,
  payload: Record<string, unknown>
) {
  if (operation === "delivery_course.clone") {
    requirePayloadShape(
      payload,
      ["sourceTemplateInternalId", "fullname", "shortname"],
      ["visible"]
    );
    requirePayloadUuid(payload, "sourceTemplateInternalId");
    requirePayloadText(payload, "fullname", 255);
    requirePayloadText(payload, "shortname", 100);
    optionalBoolean(payload, "visible");
    return;
  }
  if (
    [
      "delivery_course.archive",
      "resource.archive",
      "assignment.archive",
    ].includes(operation)
  ) {
    requirePayloadShape(payload, [], ["reason"]);
    if (payload.reason !== undefined)
      requirePayloadText(payload, "reason", 20_000, true);
    return;
  }
  if (["delivery_course.restore", "quiz.archive"].includes(operation)) {
    requirePayloadShape(
      payload,
      [],
      operation === "quiz.archive" ? ["reason"] : []
    );
    if (payload.reason !== undefined)
      requirePayloadText(payload, "reason", 20_000, true);
    return;
  }
  if (operation === "section.upsert") {
    requirePayloadShape(
      payload,
      ["mode", "name"],
      ["summary", "visible", "position"]
    );
    if (!["create", "update"].includes(String(payload.mode))) {
      throw new MoodleCommandValidationError(
        "Moodle command payload is invalid."
      );
    }
    requirePayloadText(payload, "name", 255);
    if (payload.summary !== undefined)
      requirePayloadText(payload, "summary", 20_000, true);
    optionalBoolean(payload, "visible");
    optionalInteger(payload, "position", 0, 10_000);
    return;
  }
  if (operation === "section.reorder") {
    requirePayloadShape(payload, ["position"]);
    optionalInteger(payload, "position", 0, 10_000);
    return;
  }
  if (operation === "section.visibility") {
    requirePayloadShape(payload, ["visible"]);
    optionalBoolean(payload, "visible");
    return;
  }
  if (operation === "page.upsert") {
    validateModulePayload(payload, ["content"], []);
    requirePayloadText(payload, "content", 20_000, true);
    return;
  }
  if (operation === "book.upsert") {
    validateModulePayload(payload, [], []);
    return;
  }
  if (operation === "url.upsert") {
    validateModulePayload(payload, ["externalUrl"], []);
    if (
      typeof payload.externalUrl !== "string" ||
      !httpsUrlPattern.test(payload.externalUrl)
    ) {
      throw new MoodleCommandValidationError(
        "Moodle command payload is invalid."
      );
    }
    return;
  }
  if (operation === "resource.upsert") {
    validateModulePayload(
      payload,
      ["uploadInternalId", "filename", "mimeType", "size", "sha256"],
      []
    );
    requirePayloadUuid(payload, "uploadInternalId");
    requirePayloadText(payload, "filename", 255);
    if (
      typeof payload.mimeType !== "string" ||
      !mimeTypePattern.test(payload.mimeType) ||
      typeof payload.sha256 !== "string" ||
      !sha256Pattern.test(payload.sha256)
    ) {
      throw new MoodleCommandValidationError(
        "Moodle command payload is invalid."
      );
    }
    optionalInteger(payload, "size", 1, 104_857_600);
    return;
  }
  if (operation === "assignment.upsert") {
    validateModulePayload(
      payload,
      [],
      ["availableFrom", "dueAt", "cutoffAt", "maximumGrade"]
    );
    for (const field of ["availableFrom", "dueAt", "cutoffAt"]) {
      optionalInteger(payload, field);
    }
    optionalInteger(payload, "maximumGrade", 1, 1000);
    return;
  }
  if (operation === "quiz_shell.upsert") {
    validateModulePayload(
      payload,
      [],
      ["opensAt", "closesAt", "timeLimitSeconds", "maximumGrade"]
    );
    for (const field of ["opensAt", "closesAt", "timeLimitSeconds"]) {
      optionalInteger(payload, field);
    }
    optionalInteger(payload, "maximumGrade", 1, 1000);
    return;
  }
  if (operation === "question.upsert") {
    requirePayloadShape(
      payload,
      ["mode", "questionType", "name", "questionText", "defaultMark"],
      [
        "questionCategoryInternalId",
        "answers",
        "correctAnswer",
        "generalFeedback",
      ]
    );
    if (
      !["create", "update"].includes(String(payload.mode)) ||
      !["shortanswer", "truefalse", "multichoice"].includes(
        String(payload.questionType)
      ) ||
      typeof payload.defaultMark !== "number" ||
      !Number.isFinite(payload.defaultMark) ||
      payload.defaultMark <= 0
    ) {
      throw new MoodleCommandValidationError(
        "Moodle command payload is invalid."
      );
    }
    requirePayloadText(payload, "name", 255);
    requirePayloadText(payload, "questionText", 20_000);
    if (payload.generalFeedback !== undefined) {
      requirePayloadText(payload, "generalFeedback", 20_000, true);
    }
    if (payload.questionCategoryInternalId !== undefined) {
      requirePayloadUuid(payload, "questionCategoryInternalId");
    }
    if (
      payload.mode === "create" &&
      payload.questionCategoryInternalId === undefined
    ) {
      throw new MoodleCommandValidationError(
        "Moodle command payload is invalid."
      );
    }
    if (
      payload.answers !== undefined &&
      (!Array.isArray(payload.answers) || payload.answers.length > 20)
    ) {
      throw new MoodleCommandValidationError(
        "Moodle command payload is invalid."
      );
    }
    if (
      payload.correctAnswer !== undefined &&
      typeof payload.correctAnswer !== "boolean"
    ) {
      throw new MoodleCommandValidationError(
        "Moodle command payload is invalid."
      );
    }
    return;
  }
  if (operation === "question.move") {
    requirePayloadShape(payload, ["destinationQuestionCategoryInternalId"]);
    requirePayloadUuid(payload, "destinationQuestionCategoryInternalId");
    return;
  }
  if (operation === "grade.update") {
    requirePayloadShape(payload, ["userInternalId", "grade"], ["feedback"]);
    requirePayloadUuid(payload, "userInternalId");
    if (typeof payload.grade !== "number" || !Number.isFinite(payload.grade)) {
      throw new MoodleCommandValidationError(
        "Moodle command payload is invalid."
      );
    }
    if (payload.feedback !== undefined)
      requirePayloadText(payload, "feedback", 20_000, true);
    return;
  }
  requirePayloadShape(payload, ["userInternalId", "state"]);
  requirePayloadUuid(payload, "userInternalId");
  if (![0, 1, 2, 3].includes(payload.state as number)) {
    throw new MoodleCommandValidationError(
      "Moodle command payload is invalid."
    );
  }
}

export function stableMoodleJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(item => stableMoodleJson(item)).join(",")}]`;
  }
  if (isRecord(value)) {
    return `{${Object.keys(value)
      .sort()
      .map(key => `${JSON.stringify(key)}:${stableMoodleJson(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function hashMoodlePayload(payload: Readonly<Record<string, unknown>>) {
  return crypto
    .createHash("sha256")
    .update(stableMoodleJson(payload), "utf8")
    .digest("hex");
}

export function parseMoodleCommandCreateDto(
  value: unknown
): MoodleCommandCreateDto {
  if (
    !isRecord(value) ||
    !exactKeys(
      value,
      ["operation", "expectedProviderVersion", "payload", "idempotencyKey"],
      ["targetInternalId", "targetEntityType"]
    ) ||
    typeof value.operation !== "string" ||
    !operationSet.has(value.operation) ||
    typeof value.expectedProviderVersion !== "string" ||
    !versionPattern.test(value.expectedProviderVersion) ||
    typeof value.idempotencyKey !== "string" ||
    !idempotencyPattern.test(value.idempotencyKey) ||
    !isRecord(value.payload) ||
    containsForbiddenKey(value.payload) ||
    Buffer.byteLength(stableMoodleJson(value.payload), "utf8") > 65_536
  ) {
    throw new MoodleCommandValidationError("Moodle command is invalid.");
  }
  validateMoodleOperationPayload(
    value.operation as MoodleCommandOperation,
    value.payload
  );
  const clone = value.operation === "delivery_course.clone";
  if (
    (!clone &&
      (typeof value.targetInternalId !== "string" ||
        !uuidPattern.test(value.targetInternalId) ||
        typeof value.targetEntityType !== "string" ||
        !entityTypePattern.test(value.targetEntityType))) ||
    (clone &&
      (value.targetInternalId !== undefined ||
        value.targetEntityType !== undefined))
  ) {
    throw new MoodleCommandValidationError("Moodle command target is invalid.");
  }
  return {
    operation: value.operation as MoodleCommandOperation,
    targetInternalId: value.targetInternalId as string | undefined,
    targetEntityType: value.targetEntityType as string | undefined,
    expectedProviderVersion: value.expectedProviderVersion,
    payload: value.payload,
    idempotencyKey: value.idempotencyKey,
  };
}

export function parseMoodleLaunchCreateDto(
  value: unknown
): MoodleLaunchCreateDto {
  if (
    !isRecord(value) ||
    !exactKeys(value, [
      "kind",
      "targetInternalId",
      "targetEntityType",
      "returnPath",
    ]) ||
    typeof value.kind !== "string" ||
    !launchSet.has(value.kind) ||
    typeof value.targetInternalId !== "string" ||
    !uuidPattern.test(value.targetInternalId) ||
    typeof value.targetEntityType !== "string" ||
    !entityTypePattern.test(value.targetEntityType) ||
    typeof value.returnPath !== "string" ||
    !returnPathPattern.test(value.returnPath) ||
    value.returnPath.includes("..")
  ) {
    throw new MoodleCommandValidationError("Moodle launch is invalid.");
  }
  return {
    kind: value.kind as MoodleNativeLaunchKind,
    targetInternalId: value.targetInternalId,
    targetEntityType: value.targetEntityType,
    returnPath: value.returnPath,
  };
}
