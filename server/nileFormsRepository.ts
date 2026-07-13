import crypto from "node:crypto";

export const NILE_FORMS_RPC_CATALOG_VERSION = "phase13f1-v1";
export const NILE_FORMS_SCHEMA_EVIDENCE_SHA256 =
  "aae2c27e6dc6ecaa48162ac03937e82e37d3cfd5c533e7a11e84d0d7725a8e63";
export const NILE_FORMS_EXECUTOR_ROLE = "nile_forms_executor";
export const NILE_FORMS_LOCAL_ACCEPTANCE_ACK = "phase13f1-local-only";

export const nileFormsQueryOperations = [
  "forms.definitions.list",
  "forms.definitions.get",
  "forms.management.options",
  "forms.assigned.list",
  "forms.assigned.get",
  "forms.submissions.own.get",
  "forms.drafts.load",
  "forms.submissions.list",
  "forms.submissions.get",
  "forms.submissions.export",
  "forms.offline.bundle.get",
  "forms.migration.status",
  "forms.migration.runs.list",
] as const;

export const nileFormsPublicQueryOperations = [
  "forms.publications.public.get",
] as const;

export const nileFormsCommandOperations = [
  "forms.definitions.create",
  "forms.versions.draft.create",
  "forms.versions.draft.update",
  "forms.versions.publish",
  "forms.publications.retire",
  "forms.assignments.create",
  "forms.assignments.revoke",
  "forms.drafts.save",
  "forms.submissions.submit",
  "forms.submissions.withdraw",
  "forms.submissions.review",
  "forms.offline.devices.enroll",
  "forms.offline.devices.revoke",
  "forms.offline.bundle.issue",
  "forms.offline.sync.item",
  "forms.permissions.sensitive.grant",
  "forms.permissions.sensitive.revoke",
  "forms.migration.preview.record",
  "forms.migration.import.record",
  "forms.migration.reconcile",
] as const;

export const nileFormsPublicCommandOperations = [
  "forms.public.draft.save",
  "forms.public.submit",
] as const;

export type NileFormsQueryOperation = (typeof nileFormsQueryOperations)[number];
export type NileFormsCommandOperation =
  (typeof nileFormsCommandOperations)[number];
export type NileFormsPublicQueryOperation =
  (typeof nileFormsPublicQueryOperations)[number];
export type NileFormsPublicCommandOperation =
  (typeof nileFormsPublicCommandOperations)[number];

export type NileFormsProtectedRepositoryContext = {
  sessionTokenHash: string;
};

export type NileFormsPublicRepositoryContext = {
  ipHmac: string;
  ipKeyVersion: number;
  previousIpHmac?: string;
  previousIpKeyVersion?: number;
  userAgentHash: string;
  evidenceKeyVersion: number;
};

export type NileFormsQueryRequest = {
  operation: NileFormsQueryOperation;
  targetId?: string;
  input?: Record<string, unknown>;
};

export type NileFormsPublicQueryRequest = {
  operation: NileFormsPublicQueryOperation;
  targetId: string;
};

export type NileFormsCommandRequest = {
  operation: NileFormsCommandOperation;
  targetId?: string;
  input: Record<string, unknown>;
  idempotencyKey: string;
  requestHash: string;
};

export type NileFormsPublicCommandRequest = {
  operation: NileFormsPublicCommandOperation;
  publicationId: string;
  versionId: string;
  input: Record<string, unknown>;
  clientSubmissionId: string;
  idempotencyKey: string;
  requestHmac: string;
};

export type NileFormsRepositoryResult<T = unknown> = {
  data: T;
  replayed: boolean;
  commandId?: string;
};

export type NileFormsRepositoryContractStatus = {
  catalogVersion: string;
  schemaEvidenceSha256: string;
  executorRole: string;
  draftKeyVersion: number;
  publicHmacKeyVersion: number;
  publicHmacPreviousKeyVersion: number | null;
  offlineMacKeyVersion: number;
};

export type NileFormsRepository = {
  readonly kind: "memory" | "supabase" | "unavailable";
  query<T = unknown>(
    context: NileFormsProtectedRepositoryContext,
    request: NileFormsQueryRequest
  ): Promise<T>;
  publicQuery<T = unknown>(request: NileFormsPublicQueryRequest): Promise<T>;
  command<T = unknown>(
    context: NileFormsProtectedRepositoryContext,
    request: NileFormsCommandRequest
  ): Promise<NileFormsRepositoryResult<T>>;
  publicCommand<T = unknown>(
    context: NileFormsPublicRepositoryContext,
    request: NileFormsPublicCommandRequest
  ): Promise<NileFormsRepositoryResult<T>>;
  promote(): Promise<never>;
  contractStatus(): Promise<NileFormsRepositoryContractStatus>;
  reset?(): Promise<void>;
};

export class NileFormsRepositoryUnavailableError extends Error {
  readonly code = "forms_repository_unavailable";

  constructor(message = "Normalized Nile Forms persistence is unavailable.") {
    super(message);
    this.name = "NileFormsRepositoryUnavailableError";
  }
}

export class NileFormsRepositoryAuthorityError extends Error {
  readonly code = "forms_repository_authority_denied";

  constructor(
    message = "Current Nile Forms authority does not permit this operation."
  ) {
    super(message);
    this.name = "NileFormsRepositoryAuthorityError";
  }
}

export class NileFormsRepositoryConflictError extends Error {
  readonly code = "forms_repository_conflict";

  constructor(
    message = "Nile Forms command evidence conflicts with this request."
  ) {
    super(message);
    this.name = "NileFormsRepositoryConflictError";
  }
}

export class NileFormsRepositoryRateLimitError extends Error {
  readonly code = "forms_public_rate_limited";

  constructor(message = "Too many public Nile Forms requests.") {
    super(message);
    this.name = "NileFormsRepositoryRateLimitError";
  }
}

export class NileFormsRepositoryInputError extends Error {
  readonly code = "forms_repository_input_invalid";

  constructor(message = "Nile Forms public input is invalid.") {
    super(message);
    this.name = "NileFormsRepositoryInputError";
  }
}

export class NileFormsPromotionPersistenceInactiveError extends Error {
  readonly code = "forms_promotion_persistence_inactive";

  constructor() {
    super(
      "Normalized promotion is disabled until its canonical target joins the same transaction."
    );
    this.name = "NileFormsPromotionPersistenceInactiveError";
  }
}

type MemoryRepositoryOptions = {
  projections?: Partial<
    Record<NileFormsQueryOperation | NileFormsPublicQueryOperation, unknown>
  >;
  contractStatus?: Partial<NileFormsRepositoryContractStatus>;
};

type StoredCommand = {
  fingerprint: string;
  result: NileFormsRepositoryResult;
};

type ExecutorFetch = (
  path: string,
  init: RequestInit,
  env: NodeJS.ProcessEnv
) => Promise<Response>;

type SupabaseRepositoryOptions = {
  env?: NodeJS.ProcessEnv;
  executorFetch?: ExecutorFetch;
};

type RpcResultRow = {
  data: unknown;
  replayed?: boolean;
  command_id?: string;
  error_code?: string;
};

function clone<T>(value: T): T {
  return structuredClone(value);
}

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object)
      .sort()
      .map(key => `${JSON.stringify(key)}:${canonicalJson(object[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256(value: unknown) {
  return crypto
    .createHash("sha256")
    .update(canonicalJson(value), "utf8")
    .digest("hex");
}

function requireHex(value: string, label: string) {
  if (!/^[0-9a-f]{64}$/i.test(value)) {
    throw new NileFormsRepositoryUnavailableError(`${label} is invalid.`);
  }
  return value.toLowerCase();
}

function requireIdempotencyKey(value: string) {
  const normalized = value.trim();
  if (normalized.length < 8 || normalized.length > 200) {
    throw new NileFormsRepositoryConflictError(
      "Nile Forms idempotency key is invalid."
    );
  }
  return normalized;
}

function publicPreviousEvidence(context: NileFormsPublicRepositoryContext) {
  const activeIpKeyVersion = requireVersion(
    context.ipKeyVersion,
    "Public HMAC key version"
  );
  const evidenceKeyVersion = requireVersion(
    context.evidenceKeyVersion,
    "Public evidence key version"
  );
  if (evidenceKeyVersion !== activeIpKeyVersion) {
    throw new NileFormsRepositoryUnavailableError(
      "Public evidence must use the active HMAC key version."
    );
  }
  const values = [context.previousIpHmac, context.previousIpKeyVersion];
  const configured = values.filter(value => value !== undefined).length;
  if (configured === 0) return undefined;
  if (configured !== values.length) {
    throw new NileFormsRepositoryUnavailableError(
      "Previous public HMAC evidence must be configured as one complete key version."
    );
  }
  const previousIpKeyVersion = Number(context.previousIpKeyVersion);
  if (
    !Number.isInteger(previousIpKeyVersion) ||
    previousIpKeyVersion < 1 ||
    previousIpKeyVersion === activeIpKeyVersion
  ) {
    throw new NileFormsRepositoryUnavailableError(
      "Previous public HMAC key version is invalid."
    );
  }
  return {
    ipHmac: requireHex(
      String(context.previousIpHmac),
      "Previous public client HMAC"
    ),
    ipKeyVersion: previousIpKeyVersion,
  };
}

function referenceCommandResult(
  operation: string,
  targetId: string | undefined,
  input: Record<string, unknown>,
  fingerprint: string
): NileFormsRepositoryResult {
  return {
    data: clone({ operation, targetId, input }),
    replayed: false,
    commandId: `memory_${fingerprint.slice(0, 32)}`,
  };
}

export function createMemoryNileFormsRepository(
  options: MemoryRepositoryOptions = {}
): NileFormsRepository {
  const protectedCommands = new Map<string, StoredCommand>();
  const publicCommands = new Map<string, StoredCommand>();
  const projections = clone(options.projections ?? {});
  const status: NileFormsRepositoryContractStatus = {
    catalogVersion: NILE_FORMS_RPC_CATALOG_VERSION,
    schemaEvidenceSha256: NILE_FORMS_SCHEMA_EVIDENCE_SHA256,
    executorRole: NILE_FORMS_EXECUTOR_ROLE,
    draftKeyVersion: 1,
    publicHmacKeyVersion: 1,
    publicHmacPreviousKeyVersion: null,
    offlineMacKeyVersion: 1,
    ...options.contractStatus,
  };

  function executeReferenceCommand(
    ledger: Map<string, StoredCommand>,
    key: string,
    fingerprint: string,
    createResult: () => NileFormsRepositoryResult
  ) {
    const existing = ledger.get(key);
    if (existing) {
      if (existing.fingerprint !== fingerprint) {
        throw new NileFormsRepositoryConflictError();
      }
      return { ...clone(existing.result), replayed: true };
    }
    const result = createResult();
    ledger.set(key, { fingerprint, result: clone(result) });
    return clone(result);
  }

  return {
    kind: "memory",
    async query(context, request) {
      requireHex(context.sessionTokenHash, "Session token hash");
      return clone(projections[request.operation] ?? null) as never;
    },
    async publicQuery(request) {
      return clone(projections[request.operation] ?? null) as never;
    },
    async command(context, request) {
      requireHex(context.sessionTokenHash, "Session token hash");
      const idempotencyKey = requireIdempotencyKey(request.idempotencyKey);
      const requestHash = requireHex(
        request.requestHash,
        "Command request hash"
      );
      const fingerprint = sha256({
        operation: request.operation,
        targetId: request.targetId,
        input: request.input,
        requestHash,
      });
      return executeReferenceCommand(
        protectedCommands,
        idempotencyKey,
        fingerprint,
        () =>
          referenceCommandResult(
            request.operation,
            request.targetId,
            request.input,
            fingerprint
          )
      ) as never;
    },
    async publicCommand(context, request) {
      requireHex(context.ipHmac, "Public client HMAC");
      requireHex(context.userAgentHash, "User-agent hash");
      requireHex(request.requestHmac, "Public command HMAC");
      publicPreviousEvidence(context);
      const idempotencyKey = requireIdempotencyKey(request.idempotencyKey);
      const fingerprint = sha256({
        operation: request.operation,
        publicationId: request.publicationId,
        versionId: request.versionId,
        clientSubmissionId: request.clientSubmissionId,
        input: request.input,
      });
      return executeReferenceCommand(
        publicCommands,
        idempotencyKey,
        fingerprint,
        () =>
          referenceCommandResult(
            request.operation,
            request.publicationId,
            request.input,
            fingerprint
          )
      ) as never;
    },
    async promote() {
      throw new NileFormsPromotionPersistenceInactiveError();
    },
    async contractStatus() {
      return clone(status);
    },
    async reset() {
      protectedCommands.clear();
      publicCommands.clear();
    },
  };
}

function getSupabaseUrl(env: NodeJS.ProcessEnv) {
  return clean(env.SUPABASE_URL).replace(/\/+$/, "");
}

async function defaultExecutorFetch(
  path: string,
  init: RequestInit,
  env: NodeJS.ProcessEnv
) {
  const url = getSupabaseUrl(env);
  const apiKey = clean(env.SUPABASE_PUBLISHABLE_KEY);
  const executorKey = clean(env.NILE_FORMS_EXECUTOR_KEY);
  if (!url || !apiKey || !executorKey) {
    throw new NileFormsRepositoryUnavailableError(
      "The Forms executor requires SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, and NILE_FORMS_EXECUTOR_KEY."
    );
  }
  const headers = new Headers(init.headers);
  headers.set("apikey", apiKey);
  headers.set("Authorization", `Bearer ${executorKey}`);
  headers.set("Content-Type", "application/json");
  const timeoutMs = Number(env.NILE_FORMS_RPC_TIMEOUT_MS) || 5_000;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  timeout.unref?.();
  try {
    return await fetch(`${url}/rest/v1/${path.replace(/^\/+/, "")}`, {
      ...init,
      headers,
      signal: init.signal ?? controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

function repositoryError(status: number, operation: string) {
  if (status === 401 || status === 403) {
    return new NileFormsRepositoryAuthorityError(
      `Normalized Nile Forms ${operation} was denied by current authority.`
    );
  }
  if (status === 409) {
    return new NileFormsRepositoryConflictError(
      `Normalized Nile Forms ${operation} conflicts with existing evidence.`
    );
  }
  if (status === 429) return new NileFormsRepositoryRateLimitError();
  return new NileFormsRepositoryUnavailableError(
    `Normalized Nile Forms ${operation} failed with status ${status}.`
  );
}

export function createSupabaseNileFormsRepository(
  options: SupabaseRepositoryOptions = {}
): NileFormsRepository {
  const env = options.env ?? process.env;
  const executorFetch = options.executorFetch ?? defaultExecutorFetch;

  async function rpcRows<T>(
    functionName: string,
    body: Record<string, unknown>,
    operation: string
  ) {
    let response: Response;
    try {
      response = await executorFetch(
        `rpc/${functionName}`,
        { method: "POST", body: JSON.stringify(body) },
        env
      );
    } catch (error) {
      if (
        error instanceof NileFormsRepositoryUnavailableError ||
        error instanceof NileFormsRepositoryAuthorityError ||
        error instanceof NileFormsRepositoryConflictError ||
        error instanceof NileFormsRepositoryRateLimitError
      ) {
        throw error;
      }
      throw new NileFormsRepositoryUnavailableError(
        `Normalized Nile Forms ${operation} could not reach its repository.`
      );
    }
    if (!response.ok) throw repositoryError(response.status, operation);
    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new NileFormsRepositoryUnavailableError(
        `Normalized Nile Forms ${operation} returned invalid JSON.`
      );
    }
    if (!Array.isArray(payload)) {
      throw new NileFormsRepositoryUnavailableError(
        `Normalized Nile Forms ${operation} returned an invalid response.`
      );
    }
    return payload as T[];
  }

  async function singleRow<T>(
    functionName: string,
    body: Record<string, unknown>,
    operation: string
  ) {
    const rows = await rpcRows<T>(functionName, body, operation);
    if (rows.length !== 1) {
      throw new NileFormsRepositoryUnavailableError(
        `Normalized Nile Forms ${operation} returned ${rows.length} rows.`
      );
    }
    return rows[0];
  }

  return {
    kind: "supabase",
    async query(context, request) {
      requireHex(context.sessionTokenHash, "Session token hash");
      const row = await singleRow<{ data: unknown }>(
        "nile_forms_query",
        {
          p_token_hash: context.sessionTokenHash,
          p_operation: request.operation,
          p_target_id: request.targetId ?? null,
          p_input: request.input ?? {},
        },
        request.operation
      );
      return row.data as never;
    },
    async publicQuery(request) {
      const row = await singleRow<{ data: unknown }>(
        "nile_forms_public_query",
        {
          p_operation: request.operation,
          p_target_id: request.targetId,
        },
        request.operation
      );
      return row.data as never;
    },
    async command(context, request) {
      requireHex(context.sessionTokenHash, "Session token hash");
      const row = await singleRow<RpcResultRow>(
        "nile_forms_command",
        {
          p_token_hash: context.sessionTokenHash,
          p_operation: request.operation,
          p_target_id: request.targetId ?? null,
          p_input: request.input,
          p_idempotency_key: requireIdempotencyKey(request.idempotencyKey),
          p_request_hash: requireHex(
            request.requestHash,
            "Command request hash"
          ),
        },
        request.operation
      );
      return {
        data: row.data,
        replayed: row.replayed === true,
        commandId: clean(row.command_id) || undefined,
      } as never;
    },
    async publicCommand(context, request) {
      const previous = publicPreviousEvidence(context);
      const requestFingerprint = sha256({
        operation: request.operation,
        publicationId: request.publicationId,
        versionId: request.versionId,
        clientSubmissionId: request.clientSubmissionId,
        input: request.input,
      });
      const row = await singleRow<RpcResultRow>(
        "nile_forms_public_command",
        {
          p_operation: request.operation,
          p_publication_id: request.publicationId,
          p_version_id: request.versionId,
          p_input: request.input,
          p_client_submission_id: request.clientSubmissionId,
          p_idempotency_key: requireIdempotencyKey(request.idempotencyKey),
          p_request_hmac: requireHex(
            request.requestHmac,
            "Public command HMAC"
          ),
          p_request_fingerprint: requestFingerprint,
          p_ip_hmac: requireHex(context.ipHmac, "Public client HMAC"),
          p_ip_key_version: context.ipKeyVersion,
          p_previous_ip_hmac: previous?.ipHmac ?? null,
          p_previous_ip_key_version: previous?.ipKeyVersion ?? null,
          p_user_agent_hash: requireHex(
            context.userAgentHash,
            "User-agent hash"
          ),
          p_evidence_key_version: context.evidenceKeyVersion,
        },
        request.operation
      );
      if (row.error_code === "forms_public_rate_limited") {
        throw new NileFormsRepositoryRateLimitError();
      }
      if (row.error_code === "forms_public_conflict") {
        throw new NileFormsRepositoryConflictError();
      }
      if (row.error_code === "forms_public_invalid") {
        throw new NileFormsRepositoryInputError();
      }
      if (row.error_code === "forms_public_unavailable") {
        throw new NileFormsRepositoryAuthorityError(
          "This public Nile Forms publication is unavailable."
        );
      }
      if (clean(row.error_code)) {
        throw new NileFormsRepositoryUnavailableError(
          `Normalized Nile Forms ${request.operation} returned ${row.error_code}.`
        );
      }
      return {
        data: row.data,
        replayed: row.replayed === true,
        commandId: clean(row.command_id) || undefined,
      } as never;
    },
    async promote() {
      throw new NileFormsPromotionPersistenceInactiveError();
    },
    async contractStatus() {
      return singleRow<NileFormsRepositoryContractStatus>(
        "nile_forms_contract_status",
        {},
        "contract status"
      );
    },
  };
}

function decodeKey(value: string) {
  if (/^[0-9a-f]{64,}$/i.test(value) && value.length % 2 === 0) {
    return Buffer.from(value, "hex");
  }
  try {
    return Buffer.from(value, "base64");
  } catch {
    return Buffer.alloc(0);
  }
}

function requireVersion(value: unknown, label: string) {
  const version = Number(value);
  if (!Number.isInteger(version) || version < 1) {
    throw new NileFormsRepositoryUnavailableError(`${label} is invalid.`);
  }
  return version;
}

function requireLocalSupabaseUrl(env: NodeJS.ProcessEnv) {
  const raw = getSupabaseUrl(env);
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new NileFormsRepositoryUnavailableError(
      "Phase 13F1 acceptance requires a valid local SUPABASE_URL."
    );
  }
  const localHosts = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);
  if (!localHosts.has(url.hostname)) {
    throw new NileFormsRepositoryUnavailableError(
      "Phase 13F1 normalized persistence may target only an isolated local endpoint."
    );
  }
}

function requireRuntimeConfiguration(env: NodeJS.ProcessEnv) {
  if (env.NODE_ENV === "production") {
    throw new NileFormsRepositoryUnavailableError(
      "Phase 13F1 production runtime activation is not approved."
    );
  }
  requireLocalSupabaseUrl(env);
  if (clean(env.NILE_FORMS_REPOSITORY) !== "supabase") {
    throw new NileFormsRepositoryUnavailableError(
      "Normalized persistence requires NILE_FORMS_REPOSITORY=supabase."
    );
  }
  if (
    clean(env.NILE_FORMS_LOCAL_ACCEPTANCE_ACK) !==
    NILE_FORMS_LOCAL_ACCEPTANCE_ACK
  ) {
    throw new NileFormsRepositoryUnavailableError(
      "Phase 13F1 local acceptance acknowledgement is missing."
    );
  }
  if (
    clean(env.NILE_FORMS_RPC_CATALOG_VERSION) !== NILE_FORMS_RPC_CATALOG_VERSION
  ) {
    throw new NileFormsRepositoryUnavailableError(
      "The configured Forms RPC catalog version does not match the application."
    );
  }
  if (
    clean(env.NILE_FORMS_SCHEMA_EVIDENCE_SHA256).toLowerCase() !==
    NILE_FORMS_SCHEMA_EVIDENCE_SHA256
  ) {
    throw new NileFormsRepositoryUnavailableError(
      "The configured Forms schema evidence does not match the application."
    );
  }
  if (!clean(env.NILE_FORMS_EXECUTOR_KEY)) {
    throw new NileFormsRepositoryUnavailableError(
      "NILE_FORMS_EXECUTOR_KEY is required for the dedicated executor."
    );
  }
  if (!clean(env.SUPABASE_PUBLISHABLE_KEY)) {
    throw new NileFormsRepositoryUnavailableError(
      "SUPABASE_PUBLISHABLE_KEY is required for the Forms Data API gateway."
    );
  }
  for (const [name, value] of [
    ["NILE_FORMS_PUBLIC_HMAC_KEY", env.NILE_FORMS_PUBLIC_HMAC_KEY],
    ["NILE_FORMS_OFFLINE_MAC_KEY", env.NILE_FORMS_OFFLINE_MAC_KEY],
  ] as const) {
    if (decodeKey(clean(value)).length < 32) {
      throw new NileFormsRepositoryUnavailableError(
        `${name} must contain at least 32 bytes.`
      );
    }
  }
  const publicHmacKeyVersion = requireVersion(
    env.NILE_FORMS_PUBLIC_HMAC_KEY_VERSION,
    "Public HMAC key version"
  );
  const previousPublicHmacKey = clean(env.NILE_FORMS_PUBLIC_HMAC_PREVIOUS_KEY);
  const previousPublicHmacVersion = clean(
    env.NILE_FORMS_PUBLIC_HMAC_PREVIOUS_KEY_VERSION
  );
  if (Boolean(previousPublicHmacKey) !== Boolean(previousPublicHmacVersion)) {
    throw new NileFormsRepositoryUnavailableError(
      "Previous public HMAC key and version must be configured together."
    );
  }
  const publicHmacPreviousKeyVersion = previousPublicHmacKey
    ? requireVersion(
        previousPublicHmacVersion,
        "Previous public HMAC key version"
      )
    : null;
  if (
    previousPublicHmacKey &&
    (decodeKey(previousPublicHmacKey).length < 32 ||
      publicHmacPreviousKeyVersion === publicHmacKeyVersion)
  ) {
    throw new NileFormsRepositoryUnavailableError(
      "Previous public HMAC configuration is invalid."
    );
  }
  return {
    draftKeyVersion: requireVersion(
      env.NILE_FORMS_DRAFT_KEY_VERSION,
      "Draft key version"
    ),
    publicHmacKeyVersion,
    publicHmacPreviousKeyVersion,
    offlineMacKeyVersion: requireVersion(
      env.NILE_FORMS_OFFLINE_MAC_KEY_VERSION,
      "Offline MAC key version"
    ),
  };
}

const defaultMemoryRepository = createMemoryNileFormsRepository();
const unavailableRepository: NileFormsRepository = {
  kind: "unavailable",
  async query() {
    throw new NileFormsRepositoryUnavailableError();
  },
  async publicQuery() {
    throw new NileFormsRepositoryUnavailableError();
  },
  async command() {
    throw new NileFormsRepositoryUnavailableError();
  },
  async publicCommand() {
    throw new NileFormsRepositoryUnavailableError();
  },
  async promote() {
    throw new NileFormsPromotionPersistenceInactiveError();
  },
  async contractStatus() {
    throw new NileFormsRepositoryUnavailableError();
  },
};
let defaultRepository: NileFormsRepository = defaultMemoryRepository;
let repositoryOverride: NileFormsRepository | null = null;

export function getNileFormsRepository() {
  return repositoryOverride ?? defaultRepository;
}

export async function initializeNileFormsRepository(
  env: NodeJS.ProcessEnv = process.env,
  options: Pick<SupabaseRepositoryOptions, "executorFetch"> = {}
) {
  if (clean(env.NILE_FORMS_NORMALIZED_PERSISTENCE_ENABLED) !== "1") {
    defaultRepository = defaultMemoryRepository;
    return defaultRepository;
  }
  defaultRepository = unavailableRepository;
  const expectedKeyVersions = requireRuntimeConfiguration(env);
  const repository = createSupabaseNileFormsRepository({
    env,
    executorFetch: options.executorFetch,
  });
  const status = await repository.contractStatus();
  if (
    status.catalogVersion !== NILE_FORMS_RPC_CATALOG_VERSION ||
    status.schemaEvidenceSha256 !== NILE_FORMS_SCHEMA_EVIDENCE_SHA256 ||
    status.executorRole !== NILE_FORMS_EXECUTOR_ROLE ||
    status.draftKeyVersion !== expectedKeyVersions.draftKeyVersion ||
    status.publicHmacKeyVersion !== expectedKeyVersions.publicHmacKeyVersion ||
    status.publicHmacPreviousKeyVersion !==
      expectedKeyVersions.publicHmacPreviousKeyVersion ||
    status.offlineMacKeyVersion !== expectedKeyVersions.offlineMacKeyVersion
  ) {
    throw new NileFormsRepositoryUnavailableError(
      "The normalized Forms repository contract does not match startup configuration."
    );
  }
  defaultRepository = repository;
  return repository;
}

export function setNileFormsRepository(repository: NileFormsRepository) {
  const previous = repositoryOverride;
  repositoryOverride = repository;
  return () => {
    repositoryOverride = previous;
  };
}

export async function resetDefaultNileFormsRepository() {
  await defaultMemoryRepository.reset?.();
  defaultRepository = defaultMemoryRepository;
  repositoryOverride = null;
}
