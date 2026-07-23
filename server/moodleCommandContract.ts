import crypto from "node:crypto";

export const MOODLE_COMMAND_PROTOCOL_VERSION = "1.0" as const;

export const MOODLE_COMMAND_OPERATIONS = [
  "delivery_course.clone",
  "delivery_course.archive",
  "delivery_course.restore",
  "section.upsert",
  "section.reorder",
  "section.visibility",
  "page.upsert",
  "book.upsert",
  "url.upsert",
  "resource.upsert",
  "resource.archive",
  "assignment.upsert",
  "assignment.archive",
  "quiz_shell.upsert",
  "quiz.archive",
  "question.upsert",
  "question.move",
  "grade.update",
  "completion.update",
] as const;

export type MoodleCommandOperation = (typeof MOODLE_COMMAND_OPERATIONS)[number];

export const MOODLE_NATIVE_LAUNCH_KINDS = [
  "lesson_authoring",
  "h5p_authoring",
  "scorm_authoring",
  "video_time_authoring",
  "quiz_attempt",
  "assignment_submission",
] as const;

export type MoodleNativeLaunchKind =
  (typeof MOODLE_NATIVE_LAUNCH_KINDS)[number];

export type MoodlePluginOperation = Readonly<{
  name: MoodleCommandOperation;
  requiredCapability: string;
}>;

export type MoodlePluginCapabilityManifest = Readonly<{
  component: "local_nilelearn";
  pluginVersion: string;
  protocolVersion: typeof MOODLE_COMMAND_PROTOCOL_VERSION;
  operations: readonly MoodlePluginOperation[];
  nativeLaunchKinds: readonly MoodleNativeLaunchKind[];
}>;

export type MoodleCommandEnvelope = Readonly<{
  protocolVersion: typeof MOODLE_COMMAND_PROTOCOL_VERSION;
  operation: MoodleCommandOperation;
  idempotencyKey: string;
  payloadHash: string;
  expectedProviderVersion: string;
  connectionId: string;
  actorMappingId: string;
  targetMappingId?: string;
  targetContextId: string;
  originatingCommandId: string;
  payload: Readonly<Record<string, unknown>>;
}>;

const operationSet = new Set<string>(MOODLE_COMMAND_OPERATIONS);
const launchKindSet = new Set<string>(MOODLE_NATIVE_LAUNCH_KINDS);
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const versionPattern = /^[a-z0-9][a-z0-9._:+-]{0,79}$/i;
const capabilityPattern = /^[a-z][a-z0-9_]+\/[a-z][a-z0-9_:.-]+$/;
const idempotencyPattern = /^[a-z0-9][a-z0-9._:-]{7,127}$/;
const hashPattern = /^[a-f0-9]{64}$/;
const forbiddenKeyPattern =
  /^(password|secret|api[_-]?key|token|authorization|cookie|set-cookie|wstoken)$/i;

export class MoodleCommandContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MoodleCommandContractError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function exactKeys(
  value: Record<string, unknown>,
  required: readonly string[],
  optional: readonly string[] = []
) {
  const allowed = new Set([...required, ...optional]);
  const keys = Object.keys(value);
  return (
    required.every(key => keys.includes(key)) &&
    keys.every(key => allowed.has(key))
  );
}

function containsForbiddenKey(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(containsForbiddenKey);
  if (!isRecord(value)) return false;
  return Object.entries(value).some(
    ([key, nested]) =>
      forbiddenKeyPattern.test(key) || containsForbiddenKey(nested)
  );
}

function requireString(
  value: unknown,
  label: string,
  pattern: RegExp,
  maximumLength = 160
) {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > maximumLength ||
    !pattern.test(value)
  ) {
    throw new MoodleCommandContractError(`${label} is invalid.`);
  }
  return value;
}

export function parseMoodlePluginCapabilityManifest(
  value: unknown
): MoodlePluginCapabilityManifest {
  if (
    !isRecord(value) ||
    !exactKeys(value, [
      "component",
      "pluginVersion",
      "protocolVersion",
      "operations",
      "nativeLaunchKinds",
    ]) ||
    value.component !== "local_nilelearn" ||
    value.protocolVersion !== MOODLE_COMMAND_PROTOCOL_VERSION ||
    !Array.isArray(value.operations) ||
    !Array.isArray(value.nativeLaunchKinds)
  ) {
    throw new MoodleCommandContractError("Moodle plugin manifest is invalid.");
  }

  const pluginVersion = requireString(
    value.pluginVersion,
    "Plugin version",
    versionPattern,
    80
  );
  const operations = value.operations.map(item => {
    if (
      !isRecord(item) ||
      !exactKeys(item, ["name", "requiredCapability"]) ||
      typeof item.name !== "string" ||
      !operationSet.has(item.name)
    ) {
      throw new MoodleCommandContractError(
        "Moodle plugin operation is invalid."
      );
    }
    return {
      name: item.name as MoodleCommandOperation,
      requiredCapability: requireString(
        item.requiredCapability,
        "Moodle capability",
        capabilityPattern,
        120
      ),
    };
  });
  if (
    new Set(operations.map(item => item.name)).size !== operations.length ||
    operations.length !== MOODLE_COMMAND_OPERATIONS.length ||
    MOODLE_COMMAND_OPERATIONS.some(
      operation => !operations.some(item => item.name === operation)
    )
  ) {
    throw new MoodleCommandContractError(
      "Moodle plugin operation allowlist is incomplete or duplicated."
    );
  }

  const nativeLaunchKinds = value.nativeLaunchKinds.map(item => {
    if (typeof item !== "string" || !launchKindSet.has(item)) {
      throw new MoodleCommandContractError(
        "Moodle native launch kind is invalid."
      );
    }
    return item as MoodleNativeLaunchKind;
  });
  if (
    new Set(nativeLaunchKinds).size !== nativeLaunchKinds.length ||
    nativeLaunchKinds.length !== MOODLE_NATIVE_LAUNCH_KINDS.length
  ) {
    throw new MoodleCommandContractError(
      "Moodle native launch allowlist is incomplete or duplicated."
    );
  }

  return {
    component: "local_nilelearn",
    pluginVersion,
    protocolVersion: MOODLE_COMMAND_PROTOCOL_VERSION,
    operations,
    nativeLaunchKinds,
  };
}

export function hashMoodleCommandPayload(
  payload: Readonly<Record<string, unknown>>
) {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(payload), "utf8")
    .digest("hex");
}

export function parseMoodleCommandEnvelope(
  value: unknown
): MoodleCommandEnvelope {
  if (
    !isRecord(value) ||
    !exactKeys(
      value,
      [
        "protocolVersion",
        "operation",
        "idempotencyKey",
        "payloadHash",
        "expectedProviderVersion",
        "connectionId",
        "actorMappingId",
        "targetContextId",
        "originatingCommandId",
        "payload",
      ],
      ["targetMappingId"]
    ) ||
    value.protocolVersion !== MOODLE_COMMAND_PROTOCOL_VERSION ||
    typeof value.operation !== "string" ||
    !operationSet.has(value.operation) ||
    !isRecord(value.payload)
  ) {
    throw new MoodleCommandContractError("Moodle command envelope is invalid.");
  }

  const serializedPayload = JSON.stringify(value.payload);
  if (
    Buffer.byteLength(serializedPayload, "utf8") > 65_536 ||
    containsForbiddenKey(value.payload)
  ) {
    throw new MoodleCommandContractError("Moodle command payload is unsafe.");
  }
  const payloadHash = requireString(
    value.payloadHash,
    "Payload hash",
    hashPattern,
    64
  );
  if (hashMoodleCommandPayload(value.payload) !== payloadHash) {
    throw new MoodleCommandContractError(
      "Moodle command payload hash differs."
    );
  }

  return {
    protocolVersion: MOODLE_COMMAND_PROTOCOL_VERSION,
    operation: value.operation as MoodleCommandOperation,
    idempotencyKey: requireString(
      value.idempotencyKey,
      "Idempotency key",
      idempotencyPattern,
      128
    ),
    payloadHash,
    expectedProviderVersion: requireString(
      value.expectedProviderVersion,
      "Expected provider version",
      versionPattern,
      80
    ),
    connectionId: requireString(
      value.connectionId,
      "Connection ID",
      uuidPattern
    ),
    actorMappingId: requireString(
      value.actorMappingId,
      "Actor mapping ID",
      uuidPattern
    ),
    targetMappingId:
      value.targetMappingId === undefined
        ? undefined
        : requireString(
            value.targetMappingId,
            "Target mapping ID",
            uuidPattern
          ),
    targetContextId: requireString(
      value.targetContextId,
      "Target context ID",
      uuidPattern
    ),
    originatingCommandId: requireString(
      value.originatingCommandId,
      "Originating command ID",
      uuidPattern
    ),
    payload: value.payload,
  };
}
