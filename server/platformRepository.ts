import fs from "node:fs";
import path from "node:path";
import { seedPlatformState } from "../client/src/lib/domain/seed.js";
import type { PlatformState } from "../client/src/lib/domain/types.js";
import { supabaseAdminRestFetch } from "./supabase.js";

const DATA_DIR = process.env.VERCEL ? "/tmp" : path.resolve(process.cwd(), ".local-data");
const STATE_FILE = path.join(DATA_DIR, "platform-state.json");
const DEFAULT_STATE_ID = "nile-learn-demo";

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
  return sanitizeTableName(process.env.SUPABASE_PLATFORM_STATE_TABLE || "", "platform_state_snapshots");
}

function eventsTable() {
  return sanitizeTableName(process.env.SUPABASE_PLATFORM_EVENTS_TABLE || "", "platform_events");
}

function useLocalPlatformStateOnly() {
  return process.env.NILE_PLATFORM_STATE_LOCAL_ONLY === "1" || process.env.QA_PLATFORM_STATE_LOCAL_ONLY === "1";
}

function cloneSeed(): PlatformState {
  return JSON.parse(JSON.stringify(seedPlatformState)) as PlatformState;
}

function mergeById<T extends { id: string }>(seedItems: T[], storedItems?: T[]) {
  const merged = new Map((storedItems ?? []).map((item) => [item.id, item]));
  seedItems.forEach((item) => {
    if (!merged.has(item.id)) merged.set(item.id, item);
  });
  return Array.from(merged.values());
}

export function normalizePlatformState(value: unknown): PlatformState {
  if (!value || typeof value !== "object") return cloneSeed();
  const seed = cloneSeed();
  const stored = value as Partial<PlatformState>;
  return {
    ...seed,
    ...stored,
    users: mergeById(seed.users, stored.users),
    staffProfiles: mergeById(seed.staffProfiles, stored.staffProfiles),
    courseRuns: mergeById(seed.courseRuns, stored.courseRuns),
    classGroups: mergeById(seed.classGroups, stored.classGroups),
    events: mergeById(seed.events, stored.events),
    reportPresets: mergeById(seed.reportPresets, stored.reportPresets),
  };
}

class SnapshotPlatformRepository implements PlatformRepository {
  async readSnapshot(): Promise<PlatformStatePayload> {
    if (useLocalPlatformStateOnly()) {
      const localState = this.readLocalState() ?? cloneSeed();
      this.writeLocalState(localState);
      return { state: localState, persistence: "local", syncedAt: now() };
    }
    try {
      const supabaseState = await this.readSupabaseState();
      if (supabaseState) {
        this.writeLocalState(supabaseState);
        return { state: supabaseState, persistence: "supabase", syncedAt: now() };
      }

      const seededState = this.readLocalState() ?? cloneSeed();
      const persistence = await this.writeSnapshot(seededState);
      return { state: seededState, persistence, syncedAt: now() };
    } catch {
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
    try {
      await this.writeSupabaseState(state);
      this.writeLocalState(state);
      return "supabase";
    } catch {
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
    if (!response.ok) throw new Error(`Supabase platform event write failed with ${response.status}`);
  }

  private ensureDataDir() {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true, mode: 0o700 });
  }

  private readLocalState() {
    try {
      if (!fs.existsSync(STATE_FILE)) return null;
      const payload = JSON.parse(fs.readFileSync(STATE_FILE, "utf-8")) as { state?: unknown };
      return normalizePlatformState(payload.state);
    } catch {
      return null;
    }
  }

  private writeLocalState(state: PlatformState) {
    this.ensureDataDir();
    fs.writeFileSync(STATE_FILE, JSON.stringify({ state, updatedAt: now() }, null, 2), { mode: 0o600 });
  }

  private async readSupabaseState() {
    const table = snapshotTable();
    const response = await supabaseAdminRestFetch(
      `${table}?id=eq.${encodeURIComponent(snapshotId())}&select=id,state,updated_at&limit=1`,
      { method: "GET" },
    );
    if (!response.ok) throw new Error(`Supabase platform state read failed with ${response.status}`);
    const rows = (await response.json()) as { state?: unknown }[];
    return rows[0]?.state ? normalizePlatformState(rows[0].state) : null;
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
    if (!response.ok) throw new Error(`Supabase platform state write failed with ${response.status}`);
  }
}

const defaultPlatformRepository = new SnapshotPlatformRepository();
let platformRepository: PlatformRepository = defaultPlatformRepository;

export function getPlatformStateRepository() {
  return platformRepository;
}

export function setPlatformStateRepository(repository: PlatformRepository) {
  platformRepository = repository;
  return () => {
    platformRepository = defaultPlatformRepository;
  };
}
