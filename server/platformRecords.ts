import fs from "node:fs";
import path from "node:path";
import { supabaseAdminRestFetch } from "./supabase";

const DATA_DIR = process.env.VERCEL ? "/tmp" : path.resolve(process.cwd(), ".local-data");
const DATA_FILE = path.join(DATA_DIR, "platform-records.json");

type PlatformBackendRecord = {
  id: string;
  type: "lead" | "placement" | "operational";
  payload: Record<string, unknown>;
  actorId?: string;
  createdAt: string;
  persistence?: "supabase" | "local";
};

type PlatformBackendState = {
  records: PlatformBackendRecord[];
};

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true, mode: 0o700 });
}

function createId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function readState(): PlatformBackendState {
  try {
    if (!fs.existsSync(DATA_FILE)) return { records: [] };
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf-8")) as PlatformBackendState;
  } catch {
    return { records: [] };
  }
}

function writeState(state: PlatformBackendState) {
  ensureDataDir();
  fs.writeFileSync(DATA_FILE, JSON.stringify(state, null, 2), { mode: 0o600 });
}

export function getPlatformBackendState() {
  return readState();
}

async function saveSupabaseRecord(record: PlatformBackendRecord) {
  const table = process.env.SUPABASE_PLATFORM_RECORDS_TABLE || "platform_records";
  const response = await supabaseAdminRestFetch(table, {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      id: record.id,
      type: record.type,
      payload: record.payload,
      actor_id: record.actorId ?? null,
      created_at: record.createdAt,
    }),
  });
  if (!response.ok) throw new Error(`Supabase record insert failed with ${response.status}`);
  return { ...record, persistence: "supabase" as const };
}

function saveLocalRecord(record: PlatformBackendRecord) {
  const state = readState();
  const localRecord = { ...record, persistence: "local" as const };
  state.records = [localRecord, ...state.records].slice(0, 1000);
  writeState(state);
  return localRecord;
}

export async function savePlatformBackendRecord(type: PlatformBackendRecord["type"], payload: Record<string, unknown>, actorId?: string) {
  const record: PlatformBackendRecord = {
    id: createId(type),
    type,
    payload,
    actorId,
    createdAt: new Date().toISOString(),
  };

  try {
    return await saveSupabaseRecord(record);
  } catch {
    return saveLocalRecord(record);
  }
}
