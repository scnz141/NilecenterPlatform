#!/usr/bin/env node

import assert from "node:assert/strict";
import crypto from "node:crypto";
import {
  spawn,
  spawnSync,
  type ChildProcessWithoutNullStreams,
} from "node:child_process";
import {
  accessSync,
  chmodSync,
  constants as fsConstants,
  existsSync,
  mkdirSync,
  realpathSync,
  writeFileSync,
} from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createSupabaseSessionRepository } from "../server/sessionRepository.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = new Set(
  process.argv.slice(2).filter(argument => !argument.startsWith("--output="))
);
const allowedModes = ["--static-preflight", "--dry-run", "--live"] as const;
const selectedModes = allowedModes.filter(mode => args.has(mode));
const unknownArgs = [...args].filter(
  argument => !allowedModes.includes(argument as (typeof allowedModes)[number])
);
if (unknownArgs.length > 0)
  throw new Error(`Unknown argument(s): ${unknownArgs.join(", ")}`);
if (selectedModes.length !== 1) {
  throw new Error(
    "Choose exactly one mode: --static-preflight, --dry-run, or --live."
  );
}

const mode = selectedModes[0].slice(2) as
  | "static-preflight"
  | "dry-run"
  | "live";
const outputArg = process.argv.find(argument =>
  argument.startsWith("--output=")
);
const timestamp = new Date().toISOString().replaceAll(":", "-");
const outputPath = path.resolve(
  root,
  outputArg?.slice("--output=".length) ??
    `output/phase5/phase5-session-runtime-${timestamp}.json`
);

const LIVE_ACKNOWLEDGEMENT =
  "I_ACKNOWLEDGE_NILE_PHASE5_SESSION_RUNTIME_STAGING";
const NORMALIZED_STAGING_ACKNOWLEDGEMENT =
  "I_ACKNOWLEDGE_NILE_NORMALIZED_STAGING_ISOLATION";
const EXPECTED_STAGING_REF_HASH =
  "aa412ac2a6b666be6ad96683495e92778e2c70aae68891799d1f5754a050140c";
const EXPECTED_PRODUCTION_REF_HASH =
  "7728e57c3295ac6c1d964e067911e56d922fb6ed5319d1a9b3f00a13572db70f";

const seededTeacher = {
  appUserId: "40000000-0000-4000-8000-000000000002",
  originalAuthUserId: "10000000-0000-4000-8000-000000000002",
  roleGrantId: "50000000-0000-4000-8000-000000000002",
  primaryBranchId: "20000000-0000-4000-8000-000000000001",
  secondaryBranchId: "20000000-0000-4000-8000-000000000002",
  departmentId: "30000000-0000-4000-8000-000000000001",
  email: "phase5.runtime.teacher@nilelearn.local",
} as const;

const temporaryBranchScopeId = crypto.randomUUID();

type JsonRecord = Record<string, unknown>;
type RuntimeProcess = {
  label: string;
  child: ChildProcessWithoutNullStreams;
  logs: string[];
};

const secrets = new Set<string>();
const processes: RuntimeProcess[] = [];
const sessionTokens = new Set<string>();
let publishableKey = "";
let secretKey = "";
let fixturePassword = "";
let databasePassword = "";
let psqlPath = "";
let temporaryScopeCreated = false;
let branchPaused = false;
let seededAuthCredentialActivated = false;
let normalRepository: ReturnType<
  typeof createSupabaseSessionRepository
> | null = null;

const evidence: JsonRecord = {
  schemaVersion: 1,
  kind: "nile-phase5-real-http-durable-session-acceptance",
  mode,
  startedAt: new Date().toISOString(),
  completedAt: null,
  status: "running",
  target: null,
  authFixture: {
    authUserIdHash:
      "sha256:" + sha256(seededTeacher.originalAuthUserId).slice(0, 16),
    strategy: "activate-existing-deterministic-seeded-teacher-auth-row",
    reason:
      "Preserves the established app_users.auth_user_id mapping and lets the approved database rollback/reapply restore the deterministic Auth fixture.",
    fakeOnly: true,
  },
  steps: [],
  cleanup: {
    status: "pending",
    databaseLifecycleResetRequired: mode === "live",
    note:
      mode === "live"
        ? "Session, command, and audit evidence is immutable and is removed by the approved Phase 5 database rollback lifecycle."
        : "No remote fixture or durable-session evidence is created outside live mode.",
  },
  error: null,
};

function sha256(value: string) {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function redact(value: unknown) {
  let output = String(value ?? "");
  for (const secret of secrets) {
    if (secret) output = output.replaceAll(secret, "[REDACTED]");
  }
  return output
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [REDACTED]")
    .replace(/nilelearn_session=[^;\s]+/gi, "nilelearn_session=[REDACTED]")
    .slice(0, 4000);
}

function writeEvidence() {
  mkdirSync(path.dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(evidence, null, 2)}\n`, {
    mode: 0o600,
  });
  chmodSync(outputPath, 0o600);
}

function recordStep(label: string, details: JsonRecord = {}) {
  const step = {
    label,
    status: "passed",
    at: new Date().toISOString(),
    ...details,
  };
  (evidence.steps as JsonRecord[]).push(step);
  writeEvidence();
  process.stdout.write(`==> ${label}\n`);
}

function requireEnv(name: string, aliases: string[] = []) {
  const value = [name, ...aliases]
    .map(key => clean(process.env[key]))
    .find(Boolean);
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function keychainSecret(service: string, account: string) {
  if (process.platform !== "darwin") return "";
  const result = spawnSync(
    "/usr/bin/security",
    ["find-generic-password", "-s", service, "-a", account, "-w"],
    { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }
  );
  return result.status === 0 ? result.stdout.trim() : "";
}

function loadSecret(
  envNames: string[],
  keychainService: string,
  account: string
) {
  const fromEnv = envNames.map(name => clean(process.env[name])).find(Boolean);
  const value = fromEnv || keychainSecret(keychainService, account);
  if (!value) {
    throw new Error(
      `Missing server-only credential. Configure ${envNames[0]} or macOS Keychain service ${keychainService}.`
    );
  }
  secrets.add(value);
  return value;
}

function targetConfig() {
  const stagingRef = requireEnv("NILE_PHASE5_STAGING_PROJECT_REF", [
    "NILE_STAGING_PROJECT_REF",
  ]);
  const productionRef = requireEnv("NILE_PHASE5_PRODUCTION_PROJECT_REF", [
    "NILE_PRODUCTION_PROJECT_REF",
  ]);
  const url = new URL(
    requireEnv("NILE_PHASE5_STAGING_SUPABASE_URL", ["SUPABASE_URL"])
  );
  assert.match(stagingRef, /^[a-z0-9]{20}$/, "Staging project ref is invalid.");
  assert.match(
    productionRef,
    /^[a-z0-9]{20}$/,
    "Production project ref is invalid."
  );
  assert.notEqual(
    stagingRef,
    productionRef,
    "Staging and production refs must differ."
  );
  assert.equal(
    sha256(stagingRef),
    EXPECTED_STAGING_REF_HASH,
    "Staging target is not the reviewed Phase 5 target."
  );
  assert.equal(
    sha256(productionRef),
    EXPECTED_PRODUCTION_REF_HASH,
    "Production target does not match the protected reference."
  );
  assert.equal(url.protocol, "https:", "Staging Supabase URL must use HTTPS.");
  assert.equal(
    url.hostname,
    `${stagingRef}.supabase.co`,
    "Staging URL does not match the staging project ref."
  );
  const databaseHost = clean(process.env.NILE_PHASE5_STAGING_DB_HOST);
  const databasePort = clean(process.env.NILE_PHASE5_STAGING_DB_PORT) || "5432";
  const databaseUser =
    clean(process.env.NILE_PHASE5_STAGING_DB_USER) || `postgres.${stagingRef}`;
  assert.match(
    databaseHost,
    /^[a-z0-9.-]+\.pooler\.supabase\.com$/,
    "A staging Supabase pooler host is required."
  );
  assert.equal(
    databasePort,
    "5432",
    "The transaction pooler port must be 5432."
  );
  assert.equal(
    databaseUser,
    `postgres.${stagingRef}`,
    "Database user does not bind to the staging project."
  );
  return {
    stagingRef,
    productionRef,
    url: url.toString().replace(/\/$/, ""),
    databaseHost,
    databasePort,
    databaseUser,
  };
}

function resolveTrustedPsql() {
  for (const candidate of [
    "/opt/homebrew/bin/psql",
    "/usr/local/bin/psql",
    "/usr/bin/psql",
  ]) {
    try {
      accessSync(candidate, fsConstants.X_OK);
      const resolved = realpathSync(candidate);
      if (
        resolved.startsWith("/opt/homebrew/") ||
        resolved.startsWith("/usr/")
      ) {
        return resolved;
      }
    } catch {
      // Try the next fixed system location.
    }
  }
  throw new Error(
    "A trusted absolute psql binary is required for live fixture setup."
  );
}

function hydrateSeededAuthUser(config: ReturnType<typeof targetConfig>) {
  const sql = `
update auth.users
set instance_id = '00000000-0000-0000-0000-000000000000'::uuid,
    aud = 'authenticated',
    role = 'authenticated',
    email = '${seededTeacher.email}',
    encrypted_password = coalesce(encrypted_password, ''),
    email_confirmed_at = coalesce(email_confirmed_at, now()),
    confirmation_token = coalesce(confirmation_token, ''),
    recovery_token = coalesce(recovery_token, ''),
    email_change_token_new = coalesce(email_change_token_new, ''),
    email_change = coalesce(email_change, ''),
    phone_change = coalesce(phone_change, ''),
    phone_change_token = coalesce(phone_change_token, ''),
    email_change_token_current = coalesce(email_change_token_current, ''),
    reauthentication_token = coalesce(reauthentication_token, ''),
    raw_app_meta_data = coalesce(raw_app_meta_data, '{"provider":"email","providers":["email"]}'::jsonb),
    raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb),
    created_at = coalesce(created_at, now()),
    updated_at = now(),
    is_sso_user = false,
    is_anonymous = false
where id = '${seededTeacher.originalAuthUserId}'::uuid;
`;
  const result = spawnSync(
    psqlPath,
    [
      "-X",
      "--no-psqlrc",
      "--no-password",
      "--host",
      config.databaseHost,
      "--port",
      config.databasePort,
      "--username",
      config.databaseUser,
      "--dbname",
      "postgres",
      "--set",
      "ON_ERROR_STOP=1",
      "--quiet",
    ],
    {
      input: sql,
      encoding: "utf8",
      env: {
        PGPASSWORD: databasePassword,
        PGSSLMODE: "require",
        PGAPPNAME: "nile-phase5-session-runtime",
        PSQL_HISTORY: "/dev/null",
        LANG: "C",
        LC_ALL: "C",
      },
    }
  );
  if (result.status !== 0) {
    throw new Error(
      `Seeded Auth fixture hydration failed: ${redact(result.stderr || result.stdout)}`
    );
  }
}

function assertStaticPrerequisites() {
  for (const file of [
    "dist-server/index.js",
    "dist/index.html",
    "server/sessionRepository.ts",
    "server/runtimeProfile.ts",
  ]) {
    if (!existsSync(path.join(root, file)))
      throw new Error(`Required built/runtime file is missing: ${file}`);
  }
  assert.equal(typeof fetch, "function", "Node.js fetch support is required.");
  assert.ok(
    Number(process.versions.node.split(".")[0]) >= 20,
    "Node.js 20 or newer is required."
  );
}

async function responseJson(response: Response, label: string) {
  const text = await response.text();
  try {
    return text ? (JSON.parse(text) as unknown) : null;
  } catch {
    throw new Error(`${label} returned invalid JSON (${response.status}).`);
  }
}

async function adminRequest(pathname: string, init: RequestInit = {}) {
  const config = targetConfig();
  const headers = new Headers(init.headers);
  headers.set("apikey", secretKey);
  headers.set("Authorization", `Bearer ${secretKey}`);
  headers.set(
    "Content-Type",
    headers.get("Content-Type") ?? "application/json"
  );
  const response = await fetch(
    `${config.url}/${pathname.replace(/^\/+/, "")}`,
    { ...init, headers }
  );
  return response;
}

async function adminRest(pathname: string, init: RequestInit = {}) {
  const response = await adminRequest(`rest/v1/${pathname}`, init);
  if (!response.ok) {
    const payload = await responseJson(response, "Admin Data API request");
    throw new Error(
      `Admin Data API request failed (${response.status}): ${redact(JSON.stringify(payload))}`
    );
  }
  return response;
}

async function restRows(pathname: string) {
  const response = await adminRest(pathname);
  const payload = await responseJson(response, "Admin Data API read");
  assert.ok(
    Array.isArray(payload),
    "Admin Data API read returned a non-array payload."
  );
  return payload as JsonRecord[];
}

async function authAdmin(pathname: string, init: RequestInit = {}) {
  const response = await adminRequest(`auth/v1/admin/${pathname}`, init);
  if (!response.ok) {
    const payload = await responseJson(response, "Auth Admin request");
    throw new Error(
      `Auth Admin request failed (${response.status}): ${redact(JSON.stringify(payload))}`
    );
  }
  return response;
}

async function provisionAuthFixture() {
  fixturePassword = crypto.randomBytes(24).toString("base64url");
  secrets.add(fixturePassword);
  const response = await authAdmin(
    `users/${seededTeacher.originalAuthUserId}`,
    {
      method: "PUT",
      body: JSON.stringify({
        email: seededTeacher.email,
        password: fixturePassword,
        email_confirm: true,
        ban_duration: "none",
        app_metadata: {
          role: "teacher",
          roles: ["teacher"],
          fixture: "nile-phase5-runtime-v1",
        },
        user_metadata: { name: "Phase 5 Runtime Teacher" },
      }),
    }
  );
  seededAuthCredentialActivated = true;
  const user = (await responseJson(
    response,
    "Auth Admin seeded fixture activation"
  )) as JsonRecord;
  const authUserId = clean(
    user.id || (user.user as JsonRecord | undefined)?.id
  );
  assert.equal(
    authUserId,
    seededTeacher.originalAuthUserId,
    "Auth Admin changed the deterministic seeded Auth identity."
  );
}

async function assertExactSeedAuthority() {
  const users = await restRows(
    `app_users?id=eq.${seededTeacher.appUserId}&select=id,auth_user_id,email,status`
  );
  assert.equal(
    users.length,
    1,
    "Seeded teacher app user is missing or ambiguous."
  );
  assert.equal(
    users[0].auth_user_id,
    seededTeacher.originalAuthUserId,
    "Seeded teacher Auth mapping is not pristine."
  );
  assert.equal(
    users[0].email,
    "teacher@nilelearn.local",
    "Seeded teacher email changed."
  );
  assert.equal(users[0].status, "active", "Seeded teacher is not active.");

  const grants = await restRows(
    `role_grants?id=eq.${seededTeacher.roleGrantId}&select=id,user_id,role,status,ends_at`
  );
  assert.deepEqual(grants, [
    {
      id: seededTeacher.roleGrantId,
      user_id: seededTeacher.appUserId,
      role: "teacher",
      status: "active",
      ends_at: null,
    },
  ]);

  const sessions = await restRows(
    `auth_sessions?user_id=eq.${seededTeacher.appUserId}&revoked_at=is.null&select=id`
  );
  assert.equal(
    sessions.length,
    0,
    "Seeded teacher has an existing unrevoked runtime session."
  );
}

async function patchRows(tableAndFilter: string, body: JsonRecord) {
  await adminRest(tableAndFilter, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify(body),
  });
}

async function availablePort(preferred: number) {
  return await new Promise<number>((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(preferred, "127.0.0.1", () => {
      const address = server.address();
      const port =
        typeof address === "object" && address ? address.port : preferred;
      server.close(error => (error ? reject(error) : resolve(port)));
    });
  });
}

function childEnvironment(
  config: ReturnType<typeof targetConfig>,
  port: number,
  outage: boolean
) {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    NODE_ENV: "production",
    HOST: "127.0.0.1",
    PORT: String(port),
    NILE_RUNTIME_PROFILE: "normalized-staging",
    NILE_STAGING_ACTIVATION_ACK: NORMALIZED_STAGING_ACKNOWLEDGEMENT,
    NILE_STAGING_PROJECT_REF: config.stagingRef,
    NILE_PRODUCTION_PROJECT_REF: config.productionRef,
    NILE_SESSION_REPOSITORY: "supabase",
    DEMO_AUTH_ENABLED: "false",
    VITE_DEMO_AUTH_ENABLED: "false",
    SUPABASE_URL: config.url,
    SUPABASE_PUBLISHABLE_KEY: publishableKey,
    SUPABASE_SECRET_KEY: secretKey,
    SUPABASE_REST_TIMEOUT_MS: outage ? "1" : "10000",
    NILE_PLATFORM_STATE_LOCAL_ONLY: "0",
    QA_PLATFORM_STATE_LOCAL_ONLY: "0",
    QA_RESET_LOCAL_STATE: "0",
    NILE_PHASE2_SESSION_LOCAL_ONLY: "0",
    NILE_FORMS_PHASE13F1_LOCAL_ONLY: "0",
    NILE_FORMS_NORMALIZED_PERSISTENCE_ENABLED: "0",
  };
  for (const key of Object.keys(env)) {
    if (key.startsWith("VITE_") && /(SECRET|SERVICE_ROLE)/.test(key))
      delete env[key];
  }
  return env;
}

function startRuntime(
  label: string,
  port: number,
  config: ReturnType<typeof targetConfig>,
  outage = false
) {
  const child = spawn(
    process.execPath,
    [path.join(root, "dist-server/index.js")],
    {
      cwd: root,
      env: childEnvironment(config, port, outage),
      stdio: ["ignore", "pipe", "pipe"],
    }
  );
  const runtime: RuntimeProcess = { label, child, logs: [] };
  const capture = (chunk: Buffer) => {
    const line = redact(chunk.toString("utf8"));
    runtime.logs.push(line);
    if (runtime.logs.join("").length > 12000) runtime.logs.shift();
  };
  child.stdout.on("data", capture);
  child.stderr.on("data", capture);
  processes.push(runtime);
  return runtime;
}

async function waitForRuntime(runtime: RuntimeProcess, port: number) {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    if (runtime.child.exitCode !== null) {
      throw new Error(
        `${runtime.label} exited during startup: ${redact(runtime.logs.join(""))}`
      );
    }
    try {
      const response = await fetch(`http://127.0.0.1:${port}/auth/login`);
      if (response.ok) return;
    } catch {
      // Startup polling is bounded by the deadline.
    }
    await delay(150);
  }
  throw new Error(`${runtime.label} did not become ready within 15 seconds.`);
}

function delay(milliseconds: number) {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

function sessionCookie(setCookie: string | null) {
  assert.ok(setCookie, "Login response did not set a session cookie.");
  assert.match(setCookie, /\bHttpOnly\b/i);
  assert.match(setCookie, /\bSameSite=Lax\b/i);
  assert.match(setCookie, /\bSecure\b/i);
  const pair = setCookie.split(";", 1)[0];
  const [name, encodedToken] = pair.split("=");
  assert.equal(name, "nilelearn_session");
  const token = decodeURIComponent(encodedToken);
  assert.ok(token.length >= 40, "Session cookie token is unexpectedly short.");
  secrets.add(token);
  sessionTokens.add(token);
  return { cookie: `${name}=${encodeURIComponent(token)}`, token, setCookie };
}

async function appLogin(port: number) {
  const response = await fetch(`http://127.0.0.1:${port}/api/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Nile-Learn-Request": "browser",
    },
    body: JSON.stringify({
      email: seededTeacher.email,
      password: fixturePassword,
      role: "teacher",
    }),
  });
  const payload = (await responseJson(
    response,
    "Application login"
  )) as JsonRecord;
  assert.equal(
    response.status,
    200,
    `Application login failed: ${redact(JSON.stringify(payload))}`
  );
  assert.equal(payload.provider, "supabase");
  assert.equal(payload.activeRole, "teacher");
  return { ...sessionCookie(response.headers.get("set-cookie")), payload };
}

async function appSession(port: number, cookie: string) {
  const response = await fetch(`http://127.0.0.1:${port}/api/auth/session`, {
    headers: { Cookie: cookie },
  });
  return {
    response,
    payload: await responseJson(response, "Application session"),
  };
}

async function tokenAuthority(token: string) {
  const response = await adminRest("rpc/resolve_auth_session_authority", {
    method: "POST",
    body: JSON.stringify({ p_token_hash: sha256(token) }),
  });
  const payload = await responseJson(response, "Session authority RPC");
  assert.ok(
    Array.isArray(payload),
    "Session authority RPC returned a non-array payload."
  );
  return payload as JsonRecord[];
}

async function createExpiringSession() {
  const token = crypto.randomBytes(32).toString("base64url");
  const tokenHash = sha256(token);
  const response = await adminRest("rpc/create_auth_session_with_evidence", {
    method: "POST",
    body: JSON.stringify({
      p_token_hash: tokenHash,
      p_user_id: seededTeacher.appUserId,
      p_auth_user_id: seededTeacher.originalAuthUserId,
      p_active_role_grant_id: seededTeacher.roleGrantId,
      p_ttl_seconds: 60,
      p_idempotency_key: `session.create:${tokenHash}`,
      p_request_hash: sha256(`phase5-expiry:${tokenHash}`),
    }),
  });
  const rows = await responseJson(response, "Expiring session create RPC");
  assert.ok(Array.isArray(rows) && rows.length === 1);
  const expiresAt = clean((rows[0] as JsonRecord).session_expires_at);
  assert.ok(Date.parse(expiresAt) > Date.now());
  secrets.add(token);
  sessionTokens.add(token);
  return {
    token,
    cookie: `nilelearn_session=${encodeURIComponent(token)}`,
    expiresAt,
  };
}

async function assertSessionEvidence(
  token: string,
  action: "session.created" | "session.revoked"
) {
  const sessions = await restRows(
    `auth_sessions?token_hash=eq.%5Cx${sha256(token)}&select=id,token_hash,created_at,expires_at,revoked_at`
  );
  assert.equal(
    sessions.length,
    1,
    `Expected one persisted session row for ${action}.`
  );
  assert.equal(
    clean(sessions[0].token_hash).toLowerCase(),
    `\\x${sha256(token)}`
  );
  const audits = await restRows(
    `audit_logs?action=eq.${action}&entity_id=eq.${sessions[0].id}&select=id,action,entity_id`
  );
  assert.equal(audits.length, 1, `Expected one immutable ${action} audit row.`);
  return sessions[0];
}

async function addTemporaryBranchScope() {
  await adminRest("role_grant_branch_scopes", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      id: temporaryBranchScopeId,
      role_grant_id: seededTeacher.roleGrantId,
      branch_id: seededTeacher.secondaryBranchId,
      granted_by: "40000000-0000-4000-8000-000000000006",
    }),
  });
  temporaryScopeCreated = true;
}

async function closeTemporaryBranchScope() {
  const response = await adminRest(
    `role_grant_branch_scopes?id=eq.${temporaryBranchScopeId}`,
    {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ ends_at: new Date().toISOString() }),
    }
  );
  if (!response.ok) throw new Error("Temporary branch scope closure failed.");
  temporaryScopeCreated = false;
}

async function directAuthToken() {
  const config = targetConfig();
  const response = await fetch(
    `${config.url}/auth/v1/token?grant_type=password`,
    {
      method: "POST",
      headers: {
        apikey: publishableKey,
        Authorization: `Bearer ${publishableKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: seededTeacher.email,
        password: fixturePassword,
      }),
    }
  );
  const payload = (await responseJson(
    response,
    "Direct Supabase login"
  )) as JsonRecord;
  assert.equal(
    response.status,
    200,
    `Direct Supabase login failed: ${redact(JSON.stringify(payload))}`
  );
  const token = clean(payload.access_token);
  assert.ok(token, "Direct Supabase login did not return an access token.");
  secrets.add(token);
  return token;
}

async function expectBrowserDenial(
  label: string,
  accessToken: string | null,
  pathname: string,
  init: RequestInit = {}
) {
  const config = targetConfig();
  const headers = new Headers(init.headers);
  headers.set("apikey", publishableKey);
  headers.set(
    "Content-Type",
    headers.get("Content-Type") ?? "application/json"
  );
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
  const response = await fetch(`${config.url}/rest/v1/${pathname}`, {
    ...init,
    headers,
  });
  const payload = (await responseJson(response, label)) as JsonRecord;
  assert.ok(
    [401, 403].includes(response.status),
    `${label} was not denied (${response.status}).`
  );
  assert.equal(
    payload.code,
    "42501",
    `${label} did not reach the PostgreSQL privilege boundary.`
  );
}

async function browserRoleDenials(accessToken: string) {
  const checks: Array<[string, string, RequestInit?]> = [
    ["app_users table", "app_users?select=id"],
    ["auth_sessions table", "auth_sessions?select=id"],
    [
      "login authority RPC",
      "rpc/resolve_login_authority",
      {
        method: "POST",
        body: JSON.stringify({
          p_auth_user_id: seededTeacher.originalAuthUserId,
          p_requested_role: "teacher",
        }),
      },
    ],
    [
      "session authority RPC",
      "rpc/resolve_auth_session_authority",
      {
        method: "POST",
        body: JSON.stringify({ p_token_hash: "0".repeat(64) }),
      },
    ],
    [
      "session create RPC",
      "rpc/create_auth_session_with_evidence",
      {
        method: "POST",
        body: JSON.stringify({
          p_token_hash: "0".repeat(64),
          p_user_id: seededTeacher.appUserId,
          p_auth_user_id: seededTeacher.originalAuthUserId,
          p_active_role_grant_id: seededTeacher.roleGrantId,
          p_ttl_seconds: 60,
          p_idempotency_key: "browser-denied",
          p_request_hash: "0".repeat(64),
        }),
      },
    ],
    [
      "session revoke RPC",
      "rpc/revoke_auth_session_with_evidence",
      {
        method: "POST",
        body: JSON.stringify({
          p_token_hash: "0".repeat(64),
          p_idempotency_key: "browser-denied",
          p_request_hash: "0".repeat(64),
        }),
      },
    ],
  ];
  for (const [label, pathname, init] of checks) {
    await expectBrowserDenial(`anon ${label}`, null, pathname, init);
    await expectBrowserDenial(
      `authenticated ${label}`,
      accessToken,
      pathname,
      init
    );
  }
}

async function countsForTeacher() {
  const [commands, audits] = await Promise.all([
    restRows(
      `command_executions?actor_user_id=eq.${seededTeacher.appUserId}&select=id`
    ),
    restRows(
      `audit_logs?actor_user_id=eq.${seededTeacher.appUserId}&select=id`
    ),
  ]);
  return { commands: commands.length, audits: audits.length };
}

async function cleanup() {
  const failures: string[] = [];
  const attempt = async (label: string, callback: () => Promise<void>) => {
    try {
      await callback();
    } catch (error) {
      failures.push(
        `${label}: ${redact(error instanceof Error ? error.message : error)}`
      );
    }
  };

  for (const runtime of processes) {
    if (runtime.child.exitCode === null) runtime.child.kill("SIGTERM");
  }
  await Promise.all(
    processes.map(
      runtime =>
        new Promise<void>(resolve => {
          if (runtime.child.exitCode !== null) return resolve();
          const timer = setTimeout(() => {
            runtime.child.kill("SIGKILL");
            resolve();
          }, 3000);
          runtime.child.once("exit", () => {
            clearTimeout(timer);
            resolve();
          });
        })
    )
  );

  if (secretKey) {
    if (branchPaused) {
      await attempt("restore primary branch", async () => {
        await patchRows(`branches?id=eq.${seededTeacher.primaryBranchId}`, {
          status: "active",
        });
        branchPaused = false;
      });
    }
    if (temporaryScopeCreated)
      await attempt("close temporary branch scope", closeTemporaryBranchScope);
    if (normalRepository) {
      for (const token of sessionTokens) {
        await attempt("revoke remaining session", async () => {
          await normalRepository?.delete(token);
        });
      }
    }
    if (seededAuthCredentialActivated) {
      await attempt("invalidate temporary seeded Auth credential", async () => {
        const unavailablePassword = crypto
          .randomBytes(32)
          .toString("base64url");
        secrets.add(unavailablePassword);
        await authAdmin(`users/${seededTeacher.originalAuthUserId}`, {
          method: "PUT",
          body: JSON.stringify({
            password: unavailablePassword,
            ban_duration: "876000h",
            app_metadata: {
              role: "teacher",
              roles: ["teacher"],
              fixture: "nile-phase5-runtime-disabled",
            },
          }),
        });
        seededAuthCredentialActivated = false;
      });
    }
  }

  (evidence.cleanup as JsonRecord).status =
    failures.length === 0 ? "passed" : "failed";
  (evidence.cleanup as JsonRecord).failures = failures;
  writeEvidence();
  if (failures.length > 0)
    throw new Error(`Cleanup failed: ${failures.join(" | ")}`);
}

async function liveAcceptance() {
  assert.equal(
    process.env.NILE_PHASE5_SESSION_RUNTIME_ACK,
    LIVE_ACKNOWLEDGEMENT,
    `Live runtime acceptance requires NILE_PHASE5_SESSION_RUNTIME_ACK=${LIVE_ACKNOWLEDGEMENT}.`
  );
  const config = targetConfig();
  publishableKey = loadSecret(
    ["NILE_PHASE5_STAGING_PUBLISHABLE_KEY", "SUPABASE_PUBLISHABLE_KEY"],
    "nile-learn-phase5-staging-publishable",
    config.stagingRef
  );
  secretKey = loadSecret(
    [
      "NILE_PHASE5_STAGING_SECRET_KEY",
      "SUPABASE_SECRET_KEY",
      "SUPABASE_SERVICE_ROLE_KEY",
    ],
    "nile-learn-phase5-staging-service-role",
    config.stagingRef
  );
  databasePassword = loadSecret(
    ["NILE_PHASE5_STAGING_DB_PASSWORD"],
    "nile-learn-phase5-staging-db",
    "nile-learn-phase5-staging"
  );
  psqlPath = resolveTrustedPsql();
  assert.notEqual(
    publishableKey,
    secretKey,
    "Publishable and server-only credentials must differ."
  );
  evidence.target = {
    stagingRefHash: `sha256:${sha256(config.stagingRef)}`,
    productionRefHash: `sha256:${sha256(config.productionRef)}`,
    hostHash: `sha256:${sha256(new URL(config.url).hostname).slice(0, 16)}`,
  };
  writeEvidence();

  await assertExactSeedAuthority();
  recordStep("prove exact seeded teacher authority and no active session");
  hydrateSeededAuthUser(config);
  recordStep("hydrate deterministic fake Auth fixture metadata");
  await provisionAuthFixture();
  recordStep("activate password-capable deterministic seeded Auth teacher", {
    authUserIdHash: `sha256:${sha256(seededTeacher.originalAuthUserId).slice(0, 16)}`,
  });

  normalRepository = createSupabaseSessionRepository({
    env: {
      SUPABASE_URL: config.url,
      SUPABASE_SECRET_KEY: secretKey,
      NILE_SESSION_REPOSITORY: "supabase",
    },
  });

  const ports = [
    await availablePort(Number(process.env.NILE_PHASE5_RUNTIME_PORT_A) || 3111),
    await availablePort(Number(process.env.NILE_PHASE5_RUNTIME_PORT_B) || 3112),
    await availablePort(
      Number(process.env.NILE_PHASE5_RUNTIME_PORT_OUTAGE) || 3113
    ),
  ];
  assert.equal(
    new Set(ports).size,
    3,
    "Runtime acceptance ports must be distinct."
  );
  const runtimeA = startRuntime("runtime A", ports[0], config);
  const runtimeB = startRuntime("runtime B", ports[1], config);
  const outageRuntime = startRuntime("outage runtime", ports[2], config, true);
  await Promise.all([
    waitForRuntime(runtimeA, ports[0]),
    waitForRuntime(runtimeB, ports[1]),
    waitForRuntime(outageRuntime, ports[2]),
  ]);
  recordStep(
    "start two independent normalized runtimes and one fail-closed outage runtime"
  );

  const expiring = await createExpiringSession();
  assert.equal(
    (await appSession(ports[0], expiring.cookie)).response.status,
    200
  );
  recordStep("start minimum-TTL durable expiry proof in parallel");

  const directToken = await directAuthToken();
  await browserRoleDenials(directToken);
  recordStep("prove anon and authenticated Data API table and RPC denials", {
    checks: 12,
  });

  const primary = await appLogin(ports[0]);
  const createdRow = await assertSessionEvidence(
    primary.token,
    "session.created"
  );
  assert.ok(Date.parse(clean(createdRow.expires_at)) > Date.now());
  recordStep(
    "prove real Supabase login, secure cookie, hashed durable session, and create audit"
  );

  const [sessionA, sessionB] = await Promise.all([
    appSession(ports[0], primary.cookie),
    appSession(ports[1], primary.cookie),
  ]);
  assert.equal(sessionA.response.status, 200);
  assert.deepEqual(sessionA.payload, sessionB.payload);
  assert.equal((sessionA.payload as JsonRecord).activeRole, "teacher");
  const concurrent = await Promise.all(
    Array.from({ length: 16 }, (_, index) =>
      appSession(ports[index % 2], primary.cookie)
    )
  );
  assert.ok(concurrent.every(result => result.response.status === 200));
  assert.ok(
    concurrent.every(
      result => (result.payload as JsonRecord).activeRole === "teacher"
    )
  );
  recordStep("prove cross-instance and concurrent durable resolution", {
    concurrentRequests: 16,
  });

  await addTemporaryBranchScope();
  let authority = await tokenAuthority(primary.token);
  assert.deepEqual(authority[0].branch_ids, [
    seededTeacher.primaryBranchId,
    seededTeacher.secondaryBranchId,
  ]);
  assert.deepEqual(authority[0].department_ids, [seededTeacher.departmentId]);
  await closeTemporaryBranchScope();
  authority = await tokenAuthority(primary.token);
  assert.deepEqual(authority[0].branch_ids, [seededTeacher.primaryBranchId]);
  recordStep("prove live scope refresh without login snapshot authority");

  await patchRows(`branches?id=eq.${seededTeacher.primaryBranchId}`, {
    status: "paused",
  });
  branchPaused = true;
  const denied = await appSession(ports[1], primary.cookie);
  assert.equal(denied.response.status, 200);
  assert.equal(denied.payload, null);
  await patchRows(`branches?id=eq.${seededTeacher.primaryBranchId}`, {
    status: "active",
  });
  branchPaused = false;
  const restored = await appSession(ports[0], primary.cookie);
  assert.equal((restored.payload as JsonRecord).activeRole, "teacher");
  recordStep(
    "prove live authority denial and restoration for the same unrevoked session"
  );

  await normalRepository.delete(primary.token);
  await assertSessionEvidence(primary.token, "session.revoked");
  assert.equal((await appSession(ports[0], primary.cookie)).payload, null);
  assert.equal((await appSession(ports[1], primary.cookie)).payload, null);
  recordStep("prove direct revocation is visible across instances");

  const logoutSession = await appLogin(ports[0]);
  const logoutResponse = await fetch(
    `http://127.0.0.1:${ports[0]}/api/auth/logout`,
    {
      method: "POST",
      headers: {
        Cookie: logoutSession.cookie,
        "X-Nile-Learn-Request": "browser",
      },
    }
  );
  assert.equal(logoutResponse.status, 200);
  assert.deepEqual(await responseJson(logoutResponse, "Application logout"), {
    ok: true,
  });
  assert.match(logoutResponse.headers.get("set-cookie") ?? "", /Max-Age=0/i);
  assert.equal(
    (await appSession(ports[1], logoutSession.cookie)).payload,
    null
  );
  await assertSessionEvidence(logoutSession.token, "session.revoked");
  recordStep("prove HTTP logout clears cookie and revokes the durable session");

  const outage = await appLogin(ports[0]);
  const beforeOutage = await countsForTeacher();
  const outageGet = await appSession(ports[2], outage.cookie);
  assert.equal(
    outageGet.response.status,
    503,
    "Outage session lookup did not fail closed."
  );
  const outageMutation = await fetch(
    `http://127.0.0.1:${ports[2]}/api/platform/state/actions`,
    {
      method: "POST",
      headers: {
        Cookie: outage.cookie,
        "Content-Type": "application/json",
        "X-Nile-Learn-Request": "browser",
      },
      body: JSON.stringify({
        action: { type: "profile.update", name: "Must not mutate" },
      }),
    }
  );
  assert.equal(
    outageMutation.status,
    503,
    "Protected mutation did not fail closed during outage."
  );
  const afterOutage = await countsForTeacher();
  assert.deepEqual(
    afterOutage,
    beforeOutage,
    "Outage path created command or audit evidence."
  );
  recordStep(
    "prove outage fail-closed behavior, no memory fallback, and no mutation"
  );

  await delay(Math.max(0, Date.parse(expiring.expiresAt) - Date.now()) + 1500);
  assert.equal((await appSession(ports[0], expiring.cookie)).payload, null);
  assert.equal((await appSession(ports[1], expiring.cookie)).payload, null);
  recordStep("prove durable session expiry across instances", {
    configuredExpirySeconds: 60,
  });
}

async function main() {
  assertStaticPrerequisites();
  recordStep("verify built runtime and Node prerequisites");
  if (mode === "static-preflight") return;

  const config = targetConfig();
  evidence.target = {
    stagingRefHash: `sha256:${sha256(config.stagingRef)}`,
    productionRefHash: `sha256:${sha256(config.productionRef)}`,
    hostHash: `sha256:${sha256(new URL(config.url).hostname).slice(0, 16)}`,
  };
  recordStep("validate immutable isolated staging target");
  if (mode === "dry-run") return;

  await liveAcceptance();
}

let rejectInterruption: ((error: Error) => void) | null = null;
const interrupted = new Promise<never>((_resolve, reject) => {
  rejectInterruption = reject;
});
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    rejectInterruption?.(
      new Error(
        `Runtime acceptance interrupted by ${signal}; cleanup was requested.`
      )
    );
  });
}

let mainError: unknown = null;
try {
  await Promise.race([main(), interrupted]);
} catch (error) {
  mainError = error;
} finally {
  try {
    await cleanup();
  } catch (cleanupError) {
    mainError ??= cleanupError;
  }
}

evidence.completedAt = new Date().toISOString();
evidence.status = mainError ? "failed" : "passed";
evidence.error = mainError
  ? redact(mainError instanceof Error ? mainError.message : mainError)
  : null;
writeEvidence();

if (mainError) {
  process.stderr.write(
    `Phase 5 session runtime acceptance failed: ${evidence.error}\n`
  );
  process.stderr.write(`Evidence: ${path.relative(root, outputPath)}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(
    `Phase 5 session runtime ${mode} passed. Evidence: ${path.relative(root, outputPath)}\n`
  );
}
