import fs from "node:fs";
import path from "node:path";
import { seedPlatformState } from "../client/src/lib/domain/seed.js";
import type { PlatformState } from "../client/src/lib/domain/types.js";
import { supabaseAdminRestFetch } from "./supabase.js";

const DATA_DIR = process.env.NILE_LOCAL_DATA_DIR?.trim()
  ? path.resolve(process.env.NILE_LOCAL_DATA_DIR.trim())
  : process.env.VERCEL
    ? "/tmp"
    : path.resolve(process.cwd(), ".local-data");
const STATE_FILE = path.join(DATA_DIR, "platform-state.json");
const DEFAULT_STATE_ID = "nile-learn-demo";
const NILE_FORMS_PERMISSION_CATALOG_VERSION = 1;

export type PersistenceMode = "supabase" | "local";

export type PlatformStatePayload = {
  state: PlatformState;
  persistence: PersistenceMode;
  syncedAt: string;
};

export type PlatformRepositoryEvent = {
  action: string;
  actorId: string;
  entityType: string;
  entityId: string;
  summary: string;
  payload: Record<string, unknown>;
};

export type PlatformRepository = {
  readSnapshot(): Promise<PlatformStatePayload>;
  writeSnapshot(state: PlatformState): Promise<PersistenceMode>;
  recordEvent(input: PlatformRepositoryEvent): Promise<void>;
};

function now() {
  return new Date().toISOString();
}

function createId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function sanitizeTableName(value: string, fallback: string) {
  const table = (value || fallback).trim();
  if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(table)) return fallback;
  return table;
}

function snapshotId() {
  return process.env.SUPABASE_PLATFORM_STATE_ID?.trim() || DEFAULT_STATE_ID;
}

function snapshotTable() {
  return sanitizeTableName(
    process.env.SUPABASE_PLATFORM_STATE_TABLE || "",
    "platform_state_snapshots"
  );
}

function eventsTable() {
  return sanitizeTableName(
    process.env.SUPABASE_PLATFORM_EVENTS_TABLE || "",
    "platform_events"
  );
}

function useLocalPlatformStateOnly() {
  return (
    process.env.NILE_PLATFORM_STATE_LOCAL_ONLY === "1" ||
    process.env.QA_PLATFORM_STATE_LOCAL_ONLY === "1"
  );
}

function requireSupabasePlatformState() {
  return process.env.NILE_PLATFORM_STATE_REQUIRE_SUPABASE === "1";
}

function cloneSeed(): PlatformState {
  return JSON.parse(JSON.stringify(seedPlatformState)) as PlatformState;
}

function mergeById<T extends { id: string }>(
  seedItems: T[],
  storedItems?: T[]
) {
  const merged = new Map((storedItems ?? []).map(item => [item.id, item]));
  seedItems.forEach(item => {
    if (!merged.has(item.id)) merged.set(item.id, item);
  });
  return Array.from(merged.values());
}

function mergePortalSettings(
  seedItems: PlatformState["portalSettings"],
  storedItems?: PlatformState["portalSettings"]
) {
  const keyFor = (item: PlatformState["portalSettings"][number]) =>
    `${item.role}:${item.scopeId}`;
  const merged = new Map((storedItems ?? []).map(item => [keyFor(item), item]));
  seedItems.forEach(item => {
    if (!merged.has(keyFor(item))) merged.set(keyFor(item), item);
  });
  return Array.from(merged.values());
}

function isNileFormsPermission(permission: string) {
  return (
    permission.startsWith("forms:") ||
    permission.startsWith("form_submissions:")
  );
}

function migrateNileFormsPermissionDefaults(
  current: PlatformState["permissions"],
  defaults: PlatformState["permissions"]
): PlatformState["permissions"] {
  return (
    Object.keys(defaults) as Array<keyof PlatformState["permissions"]>
  ).reduce<PlatformState["permissions"]>(
    (next, role) => {
      next[role] = Array.from(
        new Set([
          ...(current[role] ?? []),
          ...defaults[role].filter(isNileFormsPermission),
        ])
      );
      return next;
    },
    {} as PlatformState["permissions"]
  );
}

export function normalizePlatformState(value: unknown): PlatformState {
  if (!value || typeof value !== "object") return cloneSeed();
  const seed = cloneSeed();
  const stored = value as Partial<PlatformState>;
  const storedPermissionCatalogVersion = Number.isInteger(
    stored.permissionCatalogVersion
  )
    ? Math.max(0, stored.permissionCatalogVersion ?? 0)
    : 0;
  const permissions =
    storedPermissionCatalogVersion < NILE_FORMS_PERMISSION_CATALOG_VERSION
      ? migrateNileFormsPermissionDefaults(
          stored.permissions ?? seed.permissions,
          seed.permissions
        )
      : (stored.permissions ?? seed.permissions);
  const courseRuns = mergeById(seed.courseRuns, stored.courseRuns);
  const enrollments = (stored.enrollments ?? seed.enrollments).map(
    enrollment => ({
      ...enrollment,
      teacherId:
        courseRuns.find(item => item.id === enrollment.courseRunId)
          ?.teacherId ?? enrollment.teacherId,
    })
  );
  return {
    ...seed,
    ...stored,
    permissionCatalogVersion: Math.max(
      storedPermissionCatalogVersion,
      NILE_FORMS_PERMISSION_CATALOG_VERSION
    ),
    permissions,
    users: mergeById(seed.users, stored.users),
    staffProfiles: mergeById(seed.staffProfiles, stored.staffProfiles),
    courseRuns,
    classGroups: mergeById(seed.classGroups, stored.classGroups).map(group => ({
      ...group,
      status: group.status ?? "active",
    })),
    events: mergeById(seed.events, stored.events),
    enrollments,
    portalSettings: mergePortalSettings(
      seed.portalSettings,
      stored.portalSettings
    ),
    reportPresets: mergeById(seed.reportPresets, stored.reportPresets),
  };
}

export function normalizePersistedPlatformState(value: unknown): PlatformState {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("The persisted platform snapshot is not an object.");
  }

  const stored = value as Record<string, unknown>;
  const requiredEntries = Object.entries(seedPlatformState);
  const missingKeys = requiredEntries
    .filter(([key]) => !(key in stored))
    .map(([key]) => key);
  if (missingKeys.length > 0) {
    throw new Error(
      `The persisted platform snapshot is incomplete. Missing: ${missingKeys.join(", ")}.`
    );
  }

  const invalidKeys = requiredEntries
    .filter(([key, expected]) => {
      const actual = stored[key];
      if (Array.isArray(expected)) return !Array.isArray(actual);
      if (expected && typeof expected === "object") {
        return !actual || typeof actual !== "object" || Array.isArray(actual);
      }
      return typeof actual !== typeof expected;
    })
    .map(([key]) => key);
  if (invalidKeys.length > 0) {
    throw new Error(
      `The persisted platform snapshot has invalid fields: ${invalidKeys.join(", ")}.`
    );
  }

  const state = JSON.parse(JSON.stringify(value)) as PlatformState;
  if (
    !Number.isInteger(state.permissionCatalogVersion) ||
    (state.permissionCatalogVersion ?? 0) <
      NILE_FORMS_PERMISSION_CATALOG_VERSION
  ) {
    throw new Error(
      `The persisted platform snapshot permission catalog must be version ${NILE_FORMS_PERMISSION_CATALOG_VERSION} or newer.`
    );
  }

  return {
    ...state,
    classGroups: state.classGroups.map(group => ({
      ...group,
      status: group.status ?? "active",
    })),
    enrollments: state.enrollments.map(enrollment => ({
      ...enrollment,
      teacherId:
        state.courseRuns.find(item => item.id === enrollment.courseRunId)
          ?.teacherId ?? enrollment.teacherId,
    })),
  };
}

export class PlatformRepositoryUnavailableError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "PlatformRepositoryUnavailableError";
  }
}

export function validatePlatformRepositoryConfiguration() {
  const usesCompatibilitySessions =
    process.env.NILE_SESSION_REPOSITORY?.trim().toLowerCase() ===
    "supabase_compatibility";
  if (
    process.env.NODE_ENV === "production" &&
    usesCompatibilitySessions &&
    !requireSupabasePlatformState()
  ) {
    throw new Error(
      "Production compatibility workflows require NILE_PLATFORM_STATE_REQUIRE_SUPABASE=1 so the database remains authoritative."
    );
  }
}

class SnapshotPlatformRepository implements PlatformRepository {
  async readSnapshot(): Promise<PlatformStatePayload> {
    if (useLocalPlatformStateOnly()) {
      const localState = this.readLocalState() ?? cloneSeed();
      this.writeLocalState(localState);
      return { state: localState, persistence: "local", syncedAt: now() };
    }
    const strictSupabase = requireSupabasePlatformState();
    try {
      const supabaseState = await this.readSupabaseState();
      if (supabaseState) {
        this.writeLocalState(supabaseState);
        return {
          state: supabaseState,
          persistence: "supabase",
          syncedAt: now(),
        };
      }

      if (strictSupabase) {
        throw new Error(
          `No platform snapshot exists for ${snapshotId()}. Seed the approved fake dataset before starting the application.`
        );
      }

      const seededState = this.readLocalState() ?? cloneSeed();
      const persistence = await this.writeSnapshot(seededState);
      return { state: seededState, persistence, syncedAt: now() };
    } catch (error) {
      if (strictSupabase) {
        throw new PlatformRepositoryUnavailableError(
          error instanceof Error
            ? error.message
            : "The authoritative platform snapshot is unavailable.",
          { cause: error }
        );
      }
      const localState = this.readLocalState() ?? cloneSeed();
      this.writeLocalState(localState);
      return { state: localState, persistence: "local", syncedAt: now() };
    }
  }

  async writeSnapshot(state: PlatformState): Promise<PersistenceMode> {
    if (useLocalPlatformStateOnly()) {
      this.writeLocalState(state);
      return "local";
    }
    const strictSupabase = requireSupabasePlatformState();
    try {
      await this.writeSupabaseState(state);
      this.writeLocalState(state);
      return "supabase";
    } catch (error) {
      if (strictSupabase) {
        throw new PlatformRepositoryUnavailableError(
          error instanceof Error
            ? error.message
            : "The authoritative platform snapshot could not be saved.",
          { cause: error }
        );
      }
      this.writeLocalState(state);
      return "local";
    }
  }

  async recordEvent(input: PlatformRepositoryEvent): Promise<void> {
    if (useLocalPlatformStateOnly()) return;
    const table = eventsTable();
    const response = await supabaseAdminRestFetch(table, {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        id: createId("evtlog"),
        actor_id: input.actorId,
        action: input.action,
        entity_type: input.entityType,
        entity_id: input.entityId,
        summary: input.summary,
        payload: input.payload,
        created_at: now(),
      }),
    });
    if (!response.ok)
      throw new Error(
        `Supabase platform event write failed with ${response.status}`
      );
  }

  private ensureDataDir() {
    if (!fs.existsSync(DATA_DIR))
      fs.mkdirSync(DATA_DIR, { recursive: true, mode: 0o700 });
  }

  private readLocalState() {
    try {
      if (!fs.existsSync(STATE_FILE)) return null;
      const payload = JSON.parse(fs.readFileSync(STATE_FILE, "utf-8")) as {
        state?: unknown;
      };
      return normalizePlatformState(payload.state);
    } catch {
      return null;
    }
  }

  private writeLocalState(state: PlatformState) {
    this.ensureDataDir();
    fs.writeFileSync(
      STATE_FILE,
      JSON.stringify({ state, updatedAt: now() }, null, 2),
      { mode: 0o600 }
    );
  }

  private async readSupabaseState() {
    const table = snapshotTable();
    const response = await supabaseAdminRestFetch(
      `${table}?id=eq.${encodeURIComponent(snapshotId())}&select=id,state,updated_at&limit=1`,
      { method: "GET" }
    );
    if (!response.ok)
      throw new Error(
        `Supabase platform state read failed with ${response.status}`
      );
    const rows = (await response.json()) as { state?: unknown }[];
    if (!rows[0]?.state) return null;
    return requireSupabasePlatformState()
      ? normalizePersistedPlatformState(rows[0].state)
      : normalizePlatformState(rows[0].state);
  }

  private async writeSupabaseState(state: PlatformState) {
    const table = snapshotTable();
    const updatedAt = now();
    const response = await supabaseAdminRestFetch(`${table}?on_conflict=id`, {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify([
        {
          id: snapshotId(),
          state,
          updated_at: updatedAt,
        },
      ]),
    });
    if (!response.ok)
      throw new Error(
        `Supabase platform state write failed with ${response.status}`
      );
  }
}

const defaultPlatformRepository = new SnapshotPlatformRepository();
let platformRepository: PlatformRepository = defaultPlatformRepository;

export function getPlatformStateRepository() {
  return platformRepository;
}

export function createSnapshotPlatformRepository(): PlatformRepository {
  return new SnapshotPlatformRepository();
}

export function setPlatformStateRepository(repository: PlatformRepository) {
  platformRepository = repository;
  return () => {
    platformRepository = defaultPlatformRepository;
  };
}
