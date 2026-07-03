import { seedPlatformState } from "../client/src/lib/domain/seed";
import { loadServerEnv } from "../server/env";
import { getSupabaseServerConfig } from "../server/supabase";

type DemoRole = "student" | "teacher" | "registrar" | "headofdepartment" | "branchadmin" | "superadmin";

type AuthUserPayload = {
  id: string;
  email: string;
  name: string;
  roles: DemoRole[];
  activeRole: DemoRole;
  branchId?: string;
  departmentId?: string;
};

type SupabaseAuthUser = {
  id: string;
  email?: string;
  app_metadata?: Record<string, unknown>;
};

type SeedSummary = {
  projectRef?: string;
  authUsers: {
    created: string[];
    updated: string[];
    verified: string[];
    failed: { email: string; reason: string }[];
  };
  database: {
    demoEntities: { attempted: number; upserted: number; ok: boolean; reason?: string };
    platformRecords: { attempted: number; upserted: number; ok: boolean; reason?: string };
    platformState: { attempted: number; upserted: number; ok: boolean; reason?: string };
    platformEvents: { attempted: number; upserted: number; ok: boolean; reason?: string };
  };
};

const DEMO_PASSWORD = process.env.NILE_DEMO_PASSWORD || "12345";
const DEMO_ENTITIES_TABLE = sanitizeTableName(process.env.SUPABASE_PLATFORM_DEMO_ENTITIES_TABLE || "platform_demo_entities");
const PLATFORM_RECORDS_TABLE = sanitizeTableName(process.env.SUPABASE_PLATFORM_RECORDS_TABLE || "platform_records");
const PLATFORM_STATE_TABLE = sanitizeTableName(process.env.SUPABASE_PLATFORM_STATE_TABLE || "platform_state_snapshots");
const PLATFORM_EVENTS_TABLE = sanitizeTableName(process.env.SUPABASE_PLATFORM_EVENTS_TABLE || "platform_events");
const PLATFORM_STATE_ID = process.env.SUPABASE_PLATFORM_STATE_ID || "nile-learn-demo";
const SHORT_AUTH_EMAILS: Record<DemoRole, string> = {
  student: "s@nl.test",
  teacher: "t@nl.test",
  registrar: "r@nl.test",
  headofdepartment: "h@nl.test",
  branchadmin: "b@nl.test",
  superadmin: "a@nl.test",
};

function sanitizeTableName(value: string) {
  const table = value.trim();
  if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(table)) {
    throw new Error(`Unsafe Supabase table name: ${value}`);
  }
  return table;
}

function errorMessage(value: unknown) {
  if (value instanceof Error) return value.message;
  if (typeof value === "string") return value;
  return "Unknown error";
}

function safeReason(input: unknown) {
  const raw = errorMessage(input).replace(/Bearer\s+[A-Za-z0-9._-]+/g, "Bearer [redacted]");
  return raw.length > 220 ? `${raw.slice(0, 217)}...` : raw;
}

function authUsersFromSeed(): AuthUserPayload[] {
  const users = seedPlatformState.users.map((user) => ({
    id: user.id,
    email: user.email,
    name: user.name,
    roles: user.roles as DemoRole[],
    activeRole: user.activeRole as DemoRole,
    branchId: user.branchId,
    departmentId: user.departmentId,
  }));
  const aliasedRoles = new Set<DemoRole>();
  const aliases = users.flatMap((user) => {
    if (aliasedRoles.has(user.activeRole)) return [];
    aliasedRoles.add(user.activeRole);
    return [{ ...user, email: SHORT_AUTH_EMAILS[user.activeRole] }];
  });
  return [...users, ...aliases];
}

function flattenSeedState(seededAt: string) {
  const rows: { entity_type: string; entity_id: string; payload: unknown; seeded_at: string }[] = [];

  Object.entries(seedPlatformState as Record<string, unknown>).forEach(([entityType, value]) => {
    if (Array.isArray(value)) {
      value.forEach((entry, index) => {
        const entityId =
          entry && typeof entry === "object" && "id" in entry && typeof entry.id === "string"
            ? entry.id
            : `${entityType}_${index + 1}`;
        rows.push({ entity_type: entityType, entity_id: entityId, payload: entry, seeded_at: seededAt });
      });
      return;
    }

    if (value && typeof value === "object") {
      Object.entries(value as Record<string, unknown>).forEach(([entityId, payload]) => {
        rows.push({ entity_type: entityType, entity_id: entityId, payload, seeded_at: seededAt });
      });
      return;
    }

    rows.push({ entity_type: entityType, entity_id: "value", payload: value, seeded_at: seededAt });
  });

  return rows;
}

function platformRecordsSeededAt() {
  return new Date().toISOString();
}

function platformRecordRows(createdAt: string) {
  return [
    {
      id: "seed_lead_demo_1",
      type: "lead",
      payload: {
        source: "supabase-demo-seed",
        fullName: "Lead Demo",
        email: "lead.demo@nilelearn.local",
        subject: "Arabic Language",
        status: "lead",
      },
      actor_id: "usr_registrar_demo",
      created_at: createdAt,
    },
    {
      id: "seed_placement_demo_1",
      type: "placement",
      payload: {
        source: "supabase-demo-seed",
        fullName: "Lead Demo",
        email: "lead.demo@nilelearn.local",
        subject: "Arabic Language",
        preferredDate: "2026-06-27",
        status: "pending",
      },
      actor_id: "usr_registrar_demo",
      created_at: createdAt,
    },
    {
      id: "seed_operational_demo_1",
      type: "operational",
      payload: {
        source: "supabase-demo-seed",
        module: "system_admin",
        action: "demo_seed_loaded",
        summary: "Full Nile Learn demo seed is available in platform_demo_entities.",
      },
      actor_id: "usr_admin_demo",
      created_at: createdAt,
    },
  ];
}

function platformStateRows(updatedAt: string) {
  return [
    {
      id: PLATFORM_STATE_ID,
      state: seedPlatformState,
      updated_at: updatedAt,
    },
  ];
}

function platformEventRows(createdAt: string) {
  return [
    {
      id: "seed_platform_state_initialized",
      actor_id: "usr_admin_demo",
      action: "platform.seeded",
      entity_type: "PlatformState",
      entity_id: PLATFORM_STATE_ID,
      summary: "Seeded Nile Learn platform state snapshot.",
      payload: {
        source: "supabase-demo-seed",
        users: seedPlatformState.users.length,
        courses: seedPlatformState.courses.length,
        lessons: seedPlatformState.lessons.length,
      },
      created_at: createdAt,
    },
  ];
}

function chunk<T>(rows: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < rows.length; index += size) chunks.push(rows.slice(index, index + size));
  return chunks;
}

async function readBody(response: Response) {
  const text = await response.text();
  if (!text) return "";
  try {
    const parsed = JSON.parse(text) as { message?: unknown; error?: unknown; msg?: unknown };
    return String(parsed.message ?? parsed.error ?? parsed.msg ?? text);
  } catch {
    return text;
  }
}

function supabaseRequestFactory(url: string, secretKey: string) {
  return async function supabaseRequest(path: string, init: RequestInit = {}) {
    const headers = new Headers(init.headers);
    headers.set("apikey", secretKey);
    headers.set("Authorization", `Bearer ${secretKey}`);
    headers.set("Content-Type", headers.get("Content-Type") ?? "application/json");
    return fetch(`${url}${path}`, { ...init, headers });
  };
}

async function listAuthUsers(request: ReturnType<typeof supabaseRequestFactory>) {
  const response = await request("/auth/v1/admin/users?per_page=200&page=1", { method: "GET" });
  if (!response.ok) throw new Error(`Auth admin list failed (${response.status}): ${await readBody(response)}`);
  const payload = (await response.json()) as { users?: SupabaseAuthUser[] };
  return new Map((payload.users ?? []).filter((user) => user.email).map((user) => [user.email!.toLowerCase(), user]));
}

function authPayload(user: AuthUserPayload) {
  const primaryRole = user.activeRole;
  return {
    email: user.email,
    password: DEMO_PASSWORD,
    email_confirm: true,
    app_metadata: {
      role: primaryRole,
      roles: user.roles,
      full_name: user.name,
      demo_user_id: user.id,
      branch_id: user.branchId,
      department_id: user.departmentId,
      seeded_by: "nile-center-platform",
    },
    user_metadata: {
      full_name: user.name,
      demo_role: primaryRole,
      demo_user_id: user.id,
    },
  };
}

async function createOrUpdateAuthUsers(
  request: ReturnType<typeof supabaseRequestFactory>,
  users: AuthUserPayload[],
  summary: SeedSummary,
) {
  let existing = new Map<string, SupabaseAuthUser>();
  try {
    existing = await listAuthUsers(request);
  } catch (error) {
    summary.authUsers.failed.push({ email: "auth-admin-list", reason: safeReason(error) });
  }

  for (const user of users) {
    try {
      const payload = authPayload(user);
      const existingUser = existing.get(user.email.toLowerCase());
      const response = existingUser
        ? await request(`/auth/v1/admin/users/${existingUser.id}`, {
            method: "PUT",
            body: JSON.stringify(payload),
          })
        : await request("/auth/v1/admin/users", {
            method: "POST",
            body: JSON.stringify(payload),
          });

      if (!response.ok) throw new Error(`Auth admin save failed (${response.status}): ${await readBody(response)}`);
      summary.authUsers[existingUser ? "updated" : "created"].push(user.email);
    } catch (error) {
      summary.authUsers.failed.push({ email: user.email, reason: safeReason(error) });
    }
  }
}

async function verifyAuthUsers(url: string, publishableKey: string, users: AuthUserPayload[], summary: SeedSummary) {
  for (const user of users) {
    try {
      const response = await fetch(`${url}/auth/v1/token?grant_type=password`, {
        method: "POST",
        headers: {
          apikey: publishableKey,
          Authorization: `Bearer ${publishableKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: user.email, password: DEMO_PASSWORD }),
      });
      if (!response.ok) throw new Error(`Password sign-in failed (${response.status}): ${await readBody(response)}`);
      const payload = (await response.json()) as { user?: SupabaseAuthUser };
      const roles = Array.isArray(payload.user?.app_metadata?.roles) ? payload.user?.app_metadata?.roles : [];
      if (!roles.includes(user.activeRole)) throw new Error("Verified user is missing required app_metadata role.");
      summary.authUsers.verified.push(user.email);
    } catch (error) {
      summary.authUsers.failed.push({ email: user.email, reason: safeReason(error) });
    }
  }
}

async function upsertRows(
  request: ReturnType<typeof supabaseRequestFactory>,
  table: string,
  rows: Record<string, unknown>[],
  onConflict: string,
) {
  let upserted = 0;
  for (const rowsChunk of chunk(rows, 100)) {
    const response = await request(`/rest/v1/${table}?on_conflict=${encodeURIComponent(onConflict)}`, {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify(rowsChunk),
    });
    if (!response.ok) throw new Error(`Upsert into ${table} failed (${response.status}): ${await readBody(response)}`);
    upserted += rowsChunk.length;
  }
  return upserted;
}

async function seedDatabase(request: ReturnType<typeof supabaseRequestFactory>, summary: SeedSummary) {
  const seededAt = platformRecordsSeededAt();
  const demoEntities = flattenSeedState(seededAt);
  const platformRecords = platformRecordRows(seededAt);
  const platformState = platformStateRows(seededAt);
  const platformEvents = platformEventRows(seededAt);

  summary.database.demoEntities.attempted = demoEntities.length;
  summary.database.platformRecords.attempted = platformRecords.length;
  summary.database.platformState.attempted = platformState.length;
  summary.database.platformEvents.attempted = platformEvents.length;

  try {
    summary.database.demoEntities.upserted = await upsertRows(request, DEMO_ENTITIES_TABLE, demoEntities, "entity_type,entity_id");
    summary.database.demoEntities.ok = true;
  } catch (error) {
    summary.database.demoEntities.reason = safeReason(error);
  }

  try {
    summary.database.platformRecords.upserted = await upsertRows(request, PLATFORM_RECORDS_TABLE, platformRecords, "id");
    summary.database.platformRecords.ok = true;
  } catch (error) {
    summary.database.platformRecords.reason = safeReason(error);
  }

  try {
    summary.database.platformState.upserted = await upsertRows(request, PLATFORM_STATE_TABLE, platformState, "id");
    summary.database.platformState.ok = true;
  } catch (error) {
    summary.database.platformState.reason = safeReason(error);
  }

  try {
    summary.database.platformEvents.upserted = await upsertRows(request, PLATFORM_EVENTS_TABLE, platformEvents, "id");
    summary.database.platformEvents.ok = true;
  } catch (error) {
    summary.database.platformEvents.reason = safeReason(error);
  }
}

async function main() {
  loadServerEnv();
  const config = getSupabaseServerConfig();
  if (!config.url || !config.secretKey || !config.publishableKey) {
    throw new Error("Missing SUPABASE_URL, SUPABASE_SECRET_KEY, or SUPABASE_PUBLISHABLE_KEY in .env.local.");
  }

  const request = supabaseRequestFactory(config.url, config.secretKey);
  const users = authUsersFromSeed();
  const summary: SeedSummary = {
    projectRef: config.projectRef,
    authUsers: { created: [], updated: [], verified: [], failed: [] },
    database: {
      demoEntities: { attempted: 0, upserted: 0, ok: false },
      platformRecords: { attempted: 0, upserted: 0, ok: false },
      platformState: { attempted: 0, upserted: 0, ok: false },
      platformEvents: { attempted: 0, upserted: 0, ok: false },
    },
  };

  await createOrUpdateAuthUsers(request, users, summary);
  await verifyAuthUsers(config.url, config.publishableKey, users, summary);
  await seedDatabase(request, summary);

  console.log(JSON.stringify(summary, null, 2));

  const authOk = summary.authUsers.verified.length === users.length;
  const databaseOk =
    summary.database.demoEntities.ok &&
    summary.database.platformRecords.ok &&
    summary.database.platformState.ok &&
    summary.database.platformEvents.ok;
  if (!authOk || !databaseOk) process.exitCode = 1;
}

main().catch((error) => {
  console.error(safeReason(error));
  process.exit(1);
});
