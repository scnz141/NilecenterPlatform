import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const localHosts = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}

function fail(message) {
  console.error(`Phase 13F1 local Data API acceptance refused: ${message}`);
  process.exit(1);
}

function usage() {
  console.log(`Usage:
  NILE_FORMS_PHASE13F1_LOCAL_ONLY=1 \\
  SUPABASE_URL=http://127.0.0.1:<port> \\
  SUPABASE_SECRET_KEY=<local-service-key> \\
  NILE_LOCAL_SUPABASE_ANON_KEY=<local-anon-key> \\
  NILE_LOCAL_SUPABASE_JWT_SECRET=<local-jwt-secret> \\
  npm run check:forms-phase13f1:postgrest

The target must already contain the exact fake Phase 13F1 fixture and reviewed
manual SQL. This runner never applies SQL, starts Docker, enables the runtime
adapter, or accepts a linked, shared, or remote project.`);
}

if (process.argv.includes("--help")) {
  usage();
  process.exit(0);
}

if (clean(process.env.NILE_FORMS_PHASE13F1_LOCAL_ONLY) !== "1") {
  fail(
    "set NILE_FORMS_PHASE13F1_LOCAL_ONLY=1 for a fake-data-only local target."
  );
}

for (const linkedReference of [
  path.resolve("supabase/.temp/project-ref"),
  path.resolve(".supabase/project-ref"),
]) {
  if (
    existsSync(linkedReference) &&
    clean(readFileSync(linkedReference, "utf8"))
  ) {
    fail(
      `remove the linked project reference before local acceptance: ${linkedReference}`
    );
  }
}

const configuredUrl = clean(process.env.SUPABASE_URL);
if (!configuredUrl) fail("SUPABASE_URL is required.");

let localUrl;
try {
  localUrl = new URL(configuredUrl);
} catch {
  fail("SUPABASE_URL must be a valid local HTTP URL.");
}

if (
  localUrl.protocol !== "http:" ||
  !localHosts.has(localUrl.hostname) ||
  !localUrl.port ||
  (localUrl.pathname !== "/" && localUrl.pathname !== "") ||
  localUrl.search ||
  localUrl.hash ||
  localUrl.username ||
  localUrl.password
) {
  fail(
    "SUPABASE_URL must be an explicit local endpoint such as http://127.0.0.1:54321."
  );
}

const secretKey = clean(
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
);
const anonKey = clean(process.env.NILE_LOCAL_SUPABASE_ANON_KEY);
const jwtSecret = clean(process.env.NILE_LOCAL_SUPABASE_JWT_SECRET);
if (!secretKey || !anonKey || !jwtSecret) {
  fail("local service, anonymous, and JWT acceptance keys are required.");
}

const childEnv = {
  ...process.env,
  SUPABASE_URL: localUrl.toString().replace(/\/$/, ""),
  SUPABASE_SECRET_KEY: secretKey,
  SUPABASE_SERVICE_ROLE_KEY: "",
  NILE_LOCAL_SUPABASE_ANON_KEY: anonKey,
  NILE_LOCAL_SUPABASE_JWT_SECRET: jwtSecret,
  NILE_FORMS_PHASE13F1_DISPOSABLE_LOCAL: "1",
};

async function verifyEndpoint() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2_000);
  timeout.unref?.();
  try {
    const response = await fetch(`${childEnv.SUPABASE_URL}/rest/v1/`, {
      headers: {
        apikey: secretKey,
        Authorization: `Bearer ${secretKey}`,
      },
      signal: controller.signal,
    });
    if (!response.ok) {
      fail(
        `the local Data API rejected its service acceptance key (${response.status}).`
      );
    }
  } catch {
    fail(
      "the local Data API is unreachable. Provision the isolated fixture before retrying."
    );
  } finally {
    clearTimeout(timeout);
  }
}

function run(label, args) {
  console.log(`\n==> ${label}`);
  const result = spawnSync(process.execPath, args, {
    cwd: process.cwd(),
    env: childEnv,
    stdio: "inherit",
  });
  if (result.error) fail(`${label} could not start.`);
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run("Phase 13F1 static contract", [
  "scripts/validate-nile-forms-phase13f1.mjs",
]);
await verifyEndpoint();
run("Phase 13F1 local Data API lifecycle", [
  "--import",
  "tsx",
  "scripts/validate-nile-forms-phase13f1-data-api.ts",
  "--mode=core",
]);
