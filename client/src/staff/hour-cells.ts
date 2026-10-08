import type {
  NccHourCellDto,
  NccHourCellOpDto,
  NccHourCellSessionDto,
  NccHourCellStatusDto,
} from "@/lib/backend/api";

/**
 * Availability week-grid logic. Cells are sparse: a missing cell means the
 * hour is not working time. Painting writes `available` or `unavailable`;
 * the clear pen removes the stored cell (`status: null` in the patch op).
 */

export type PaintStatus = NccHourCellStatusDto | null;

export function cellKey(date: string, hour: number): string {
  return `${date}|${hour}`;
}

export function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function addDaysIso(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + days);
  return toIsoDate(date);
}

/** Monday-start week containing `iso`. */
export function weekStartIso(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const dow = date.getDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  date.setDate(date.getDate() + diff);
  return toIsoDate(date);
}

export function weekDates(anchor: string): string[] {
  const monday = weekStartIso(anchor);
  return Array.from({ length: 7 }, (_, index) => addDaysIso(monday, index));
}

export const DEFAULT_HOURS = Array.from({ length: 16 }, (_, i) => i + 7);
export const FULL_HOURS = Array.from({ length: 24 }, (_, i) => i);

/** Fetched cells keyed by `date|hour`. */
export function cellsToMap(
  cells: NccHourCellDto[]
): Map<string, NccHourCellStatusDto> {
  const map = new Map<string, NccHourCellStatusDto>();
  for (const cell of cells) map.set(cellKey(cell.date, cell.hour), cell.status);
  return map;
}

/** Applies paint ops onto a cell map; `null` status deletes the cell. */
export function applyOps(
  cells: Map<string, NccHourCellStatusDto>,
  ops: NccHourCellOpDto[]
): Map<string, NccHourCellStatusDto> {
  const next = new Map(cells);
  for (const op of ops) {
    const key = cellKey(op.date, op.hour);
    if (op.status === null) next.delete(key);
    else next.set(key, op.status);
  }
  return next;
}

/** Minimal batch diff between the fetched map and the edited map. */
export function diffOps(
  original: Map<string, NccHourCellStatusDto>,
  edited: Map<string, NccHourCellStatusDto>
): NccHourCellOpDto[] {
  const ops: NccHourCellOpDto[] = [];
  edited.forEach((status, key) => {
    if (original.get(key) !== status) {
      const [date, hour] = key.split("|");
      ops.push({ date, hour: Number(hour), status });
    }
  });
  original.forEach((_status, key) => {
    if (!edited.has(key)) {
      const [date, hour] = key.split("|");
      ops.push({ date, hour: Number(hour), status: null });
    }
  });
  return ops.sort((a, b) =>
    a.date === b.date ? a.hour - b.hour : a.date.localeCompare(b.date)
  );
}

/** Local `date` + `hour` of an ISO instant in `timeZone`. */
export function zonedDateHour(
  instant: string,
  timeZone: string
): { date: string; hour: number } | null {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date(instant));
    const get = (type: string) =>
      parts.find(part => part.type === type)?.value ?? "";
    const hour = Number(get("hour"));
    if (!get("year") || !get("month") || !get("day") || !Number.isInteger(hour)) {
      return null;
    }
    return {
      date: `${get("year")}-${get("month")}-${get("day")}`,
      hour,
    };
  } catch {
    return null;
  }
}

/** Offset of `timeZone` from UTC at `utcMs`, in milliseconds. */
function zoneOffsetMs(utcMs: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(utcMs));
  const get = (type: string) => Number(parts.find(part => part.type === type)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - utcMs;
}

/**
 * ISO instant for a local `date` (YYYY-MM-DD) and whole `hour` in
 * `timeZone`. EMS requires bookings and sessions to start on the hour in the
 * branch time zone, whatever zone the browser is in.
 */
export function zonedInstant(date: string, hour: number, timeZone: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match || !Number.isInteger(hour) || hour < 0 || hour > 23) return null;
  try {
    const wall = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), hour);
    let instant = wall - zoneOffsetMs(wall, timeZone);
    // Second pass settles DST transitions near the guess.
    instant = wall - zoneOffsetMs(instant, timeZone);
    return new Date(instant).toISOString();
  } catch {
    return null;
  }
}

export interface SessionOverlay {
  session: NccHourCellSessionDto;
  /** True on the cell where the session starts. */
  isStart: boolean;
}

/**
 * Sessions projected onto local grid cells in `timeZone`. A session covers
 * `durationHours` consecutive hourly cells starting at its local start hour,
 * crossing midnight when needed. Cancelled sessions are skipped.
 */
export function sessionOverlays(
  sessions: NccHourCellSessionDto[],
  timeZone: string
): Map<string, SessionOverlay> {
  const map = new Map<string, SessionOverlay>();
  for (const session of sessions) {
    if (session.status === "cancelled" || session.status === "canceled") {
      continue;
    }
    const start = zonedDateHour(session.startsAt, timeZone);
    if (!start) continue;
    for (let offset = 0; offset < session.durationHours; offset += 1) {
      const totalMinutes = start.hour * 60 + offset * 60;
      const dayShift = Math.floor(totalMinutes / (24 * 60));
      const hour = (totalMinutes % (24 * 60)) / 60;
      const date = addDaysIso(start.date, dayShift);
      map.set(cellKey(date, hour), { session, isStart: offset === 0 });
    }
  }
  return map;
}
