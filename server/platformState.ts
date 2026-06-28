import fs from "node:fs";
import path from "node:path";
import { applyLearningAction, type PlatformLearningAction } from "../client/src/lib/domain/actions";
import { seedPlatformState } from "../client/src/lib/domain/seed";
import type { PlatformState } from "../client/src/lib/domain/types";
import type { ServerSession } from "./auth";
import { supabaseAdminRestFetch } from "./supabase";

const DATA_DIR = path.resolve(process.cwd(), ".local-data");
const STATE_FILE = path.join(DATA_DIR, "platform-state.json");
const DEFAULT_STATE_ID = "nile-learn-demo";

type PersistenceMode = "supabase" | "local";

export type PlatformStatePayload = {
  state: PlatformState;
  persistence: PersistenceMode;
  syncedAt: string;
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

function cloneSeed(): PlatformState {
  return JSON.parse(JSON.stringify(seedPlatformState)) as PlatformState;
}

function normalizeState(value: unknown): PlatformState {
  if (!value || typeof value !== "object") return cloneSeed();
  return { ...cloneSeed(), ...(value as Partial<PlatformState>) };
}

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true, mode: 0o700 });
}

function readLocalState() {
  try {
    if (!fs.existsSync(STATE_FILE)) return null;
    const payload = JSON.parse(fs.readFileSync(STATE_FILE, "utf-8")) as { state?: unknown };
    return normalizeState(payload.state);
  } catch {
    return null;
  }
}

function writeLocalState(state: PlatformState) {
  ensureDataDir();
  fs.writeFileSync(STATE_FILE, JSON.stringify({ state, updatedAt: now() }, null, 2), { mode: 0o600 });
}

async function readSupabaseState() {
  const table = snapshotTable();
  const response = await supabaseAdminRestFetch(
    `${table}?id=eq.${encodeURIComponent(snapshotId())}&select=id,state,updated_at&limit=1`,
    { method: "GET" },
  );
  if (!response.ok) throw new Error(`Supabase platform state read failed with ${response.status}`);
  const rows = (await response.json()) as { state?: unknown }[];
  return rows[0]?.state ? normalizeState(rows[0].state) : null;
}

async function writeSupabaseState(state: PlatformState) {
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

async function writeSupabaseEvent(input: {
  action: string;
  actorId: string;
  entityType: string;
  entityId: string;
  summary: string;
  payload: Record<string, unknown>;
}) {
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

async function persistState(state: PlatformState) {
  try {
    await writeSupabaseState(state);
    writeLocalState(state);
    return "supabase" as const;
  } catch {
    writeLocalState(state);
    return "local" as const;
  }
}

export async function getPlatformStateSnapshot(): Promise<PlatformStatePayload> {
  try {
    const supabaseState = await readSupabaseState();
    if (supabaseState) {
      writeLocalState(supabaseState);
      return { state: supabaseState, persistence: "supabase", syncedAt: now() };
    }

    const seededState = readLocalState() ?? cloneSeed();
    const persistence = await persistState(seededState);
    return { state: seededState, persistence, syncedAt: now() };
  } catch {
    const localState = readLocalState() ?? cloneSeed();
    writeLocalState(localState);
    return { state: localState, persistence: "local", syncedAt: now() };
  }
}

function applyServerActor(action: PlatformLearningAction, session: ServerSession): PlatformLearningAction {
  if (action.type === "lesson.start" || action.type === "lesson.complete") {
    return { ...action, studentId: action.studentId ?? "stu_demo", actorId: session.userId };
  }
  if (action.type === "assignment.submit") {
    return { ...action, studentId: action.studentId ?? "stu_demo", actorId: session.userId };
  }
  return { ...action, studentId: action.studentId ?? "stu_demo", actorId: session.userId };
}

export function parsePlatformLearningAction(value: unknown): PlatformLearningAction | null {
  if (!value || typeof value !== "object") return null;
  const input = value as Record<string, unknown>;
  const type = input.type;

  if ((type === "lesson.start" || type === "lesson.complete") && typeof input.lessonId === "string") {
    return {
      type,
      lessonId: input.lessonId,
      studentId: typeof input.studentId === "string" ? input.studentId : undefined,
      actorId: typeof input.actorId === "string" ? input.actorId : undefined,
    };
  }

  if (type === "assignment.submit" && typeof input.assignmentId === "string" && typeof input.response === "string") {
    return {
      type,
      assignmentId: input.assignmentId,
      response: input.response,
      studentId: typeof input.studentId === "string" ? input.studentId : undefined,
      actorId: typeof input.actorId === "string" ? input.actorId : undefined,
    };
  }

  if (type === "quiz.submit" && typeof input.quizId === "string" && input.answers && typeof input.answers === "object") {
    const answers = Object.fromEntries(
      Object.entries(input.answers as Record<string, unknown>).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
    );
    return {
      type,
      quizId: input.quizId,
      answers,
      studentId: typeof input.studentId === "string" ? input.studentId : undefined,
      actorId: typeof input.actorId === "string" ? input.actorId : undefined,
    };
  }

  return null;
}

export async function applyPlatformLearningAction(action: PlatformLearningAction, session: ServerSession) {
  const snapshot = await getPlatformStateSnapshot();
  const nextState = normalizeState(snapshot.state);
  const serverAction = applyServerActor(action, session);
  const result = applyLearningAction(nextState, serverAction, { createId, now });
  const persistence = await persistState(nextState);

  try {
    await writeSupabaseEvent({
      action: result.action,
      actorId: session.userId,
      entityType: result.entityType,
      entityId: result.entityId,
      summary: result.summary,
      payload: {
        request: serverAction,
        result: result.result,
        sourcePersistence: snapshot.persistence,
      },
    });
  } catch {
    // Snapshot persistence is the source of truth; event logging must not block the workflow.
  }

  return {
    state: nextState,
    persistence,
    syncedAt: now(),
    result,
  };
}
