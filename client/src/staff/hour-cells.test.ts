import { describe, expect, it } from "vitest";
import type {
  NccHourCellDto,
  NccHourCellSessionDto,
} from "@/lib/backend/api";
import {
  addDaysIso,
  applyOps,
  cellKey,
  cellsToMap,
  diffOps,
  sessionOverlays,
  toIsoDate,
  weekDates,
  weekStartIso,
  zonedDateHour,
} from "./hour-cells";

function cell(
  date: string,
  hour: number,
  status: "available" | "unavailable"
): NccHourCellDto {
  return { date, hour, status };
}

function session(overrides: Partial<NccHourCellSessionDto> = {}): NccHourCellSessionDto {
  return {
    id: "s1",
    classId: "c1",
    className: "Math A",
    roomName: null,
    teacherName: null,
    startsAt: "2026-11-02T09:00:00Z",
    endsAt: "2026-11-02T11:00:00Z",
    durationHours: 2,
    status: "scheduled",
    ...overrides,
  };
}

describe("week math", () => {
  it("toIsoDate formats local dates", () => {
    expect(toIsoDate(new Date(2026, 10, 6))).toBe("2026-11-06");
  });

  it("addDaysIso crosses month and year bounds", () => {
    expect(addDaysIso("2026-11-30", 2)).toBe("2026-12-02");
    expect(addDaysIso("2026-01-01", -1)).toBe("2025-12-31");
  });

  it("weekStartIso returns the containing Monday, including for Sundays", () => {
    expect(weekStartIso("2026-11-02")).toBe("2026-11-02"); // Monday
    expect(weekStartIso("2026-11-06")).toBe("2026-11-02"); // Friday
    expect(weekStartIso("2026-11-08")).toBe("2026-11-02"); // Sunday stays in week
    expect(weekStartIso("2026-11-09")).toBe("2026-11-09"); // next Monday
  });

  it("weekDates returns seven consecutive days starting Monday", () => {
    expect(weekDates("2026-11-05")).toEqual([
      "2026-11-02",
      "2026-11-03",
      "2026-11-04",
      "2026-11-05",
      "2026-11-06",
      "2026-11-07",
      "2026-11-08",
    ]);
  });
});

describe("cell maps and paint diffs", () => {
  it("cellsToMap keys sparse cells by date|hour", () => {
    const map = cellsToMap([
      cell("2026-11-02", 9, "available"),
      cell("2026-11-03", 18, "unavailable"),
    ]);
    expect(map.get(cellKey("2026-11-02", 9))).toBe("available");
    expect(map.get(cellKey("2026-11-03", 18))).toBe("unavailable");
    expect(map.size).toBe(2);
  });

  it("applyOps sets statuses and null deletes", () => {
    const base = cellsToMap([cell("2026-11-02", 9, "available")]);
    const next = applyOps(base, [
      { date: "2026-11-02", hour: 9, status: "unavailable" },
      { date: "2026-11-02", hour: 10, status: "available" },
    ]);
    expect(next.get(cellKey("2026-11-02", 9))).toBe("unavailable");
    expect(next.get(cellKey("2026-11-02", 10))).toBe("available");
    const cleared = applyOps(next, [
      { date: "2026-11-02", hour: 9, status: null },
    ]);
    expect(cleared.has(cellKey("2026-11-02", 9))).toBe(false);
  });

  it("diffOps is empty when nothing changed", () => {
    const base = cellsToMap([cell("2026-11-02", 9, "available")]);
    expect(diffOps(base, new Map(base))).toEqual([]);
  });

  it("diffOps emits only the minimal set/null operations, sorted", () => {
    const base = cellsToMap([
      cell("2026-11-02", 9, "available"),
      cell("2026-11-02", 10, "available"),
      cell("2026-11-04", 8, "unavailable"),
    ]);
    const edited = applyOps(base, [
      { date: "2026-11-02", hour: 9, status: "available" }, // no-op
      { date: "2026-11-02", hour: 10, status: "unavailable" }, // change
      { date: "2026-11-02", hour: 11, status: "available" }, // new
      { date: "2026-11-04", hour: 8, status: null }, // clear
    ]);
    expect(diffOps(base, edited)).toEqual([
      { date: "2026-11-02", hour: 10, status: "unavailable" },
      { date: "2026-11-02", hour: 11, status: "available" },
      { date: "2026-11-04", hour: 8, status: null },
    ]);
  });

  it("a discard (re-apply of baseline) produces zero ops", () => {
    const base = cellsToMap([cell("2026-11-02", 9, "available")]);
    const edited = applyOps(base, [
      { date: "2026-11-02", hour: 10, status: "available" },
    ]);
    const discarded = new Map(base);
    expect(diffOps(base, discarded)).toEqual([]);
    expect(diffOps(base, edited)).toHaveLength(1);
  });
});

describe("timezone-aware overlay projection", () => {
  it("zonedDateHour converts instants into the branch timezone", () => {
    // 2026-11-02T09:00Z is 11:00 in Africa/Cairo (UTC+2, no DST).
    expect(zonedDateHour("2026-11-02T09:00:00Z", "Africa/Cairo")).toEqual({
      date: "2026-11-02",
      hour: 11,
    });
    // Same instant falls on the previous day in America/New_York.
    expect(zonedDateHour("2026-11-02T01:00:00Z", "America/New_York")).toEqual({
      date: "2026-11-01",
      hour: 20,
    });
    expect(zonedDateHour("not-a-date", "Africa/Cairo")).toBeNull();
    expect(zonedDateHour("2026-11-02T09:00:00Z", "Bogus/Zone")).toBeNull();
  });

  it("sessionOverlays covers durationHours and marks the start cell", () => {
    const overlays = sessionOverlays(
      [session({ startsAt: "2026-11-02T09:00:00Z", durationHours: 3 })],
      "UTC"
    );
    expect(overlays.get(cellKey("2026-11-02", 9))?.isStart).toBe(true);
    expect(overlays.has(cellKey("2026-11-02", 10))).toBe(true);
    expect(overlays.has(cellKey("2026-11-02", 11))).toBe(true);
    expect(overlays.get(cellKey("2026-11-02", 11))?.isStart).toBe(false);
    expect(overlays.has(cellKey("2026-11-02", 12))).toBe(false);
  });

  it("sessions crossing local midnight spill into the next day", () => {
    const overlays = sessionOverlays(
      [session({ startsAt: "2026-11-02T22:00:00Z", durationHours: 3 })],
      "UTC"
    );
    expect(overlays.has(cellKey("2026-11-02", 22))).toBe(true);
    expect(overlays.has(cellKey("2026-11-02", 23))).toBe(true);
    expect(overlays.get(cellKey("2026-11-03", 0))?.session.id).toBe("s1");
  });

  it("cancelled sessions are skipped", () => {
    const overlays = sessionOverlays(
      [session({ status: "cancelled" })],
      "UTC"
    );
    expect(overlays.size).toBe(0);
  });
});

describe("zonedInstant", async () => {
  const { zonedInstant, zonedDateHour } = await import("./hour-cells");
  it("turns a branch wall-clock hour into the right instant", () => {
    expect(zonedInstant("2026-10-10", 10, "Africa/Cairo")).toBe("2026-10-10T07:00:00.000Z");
    expect(zonedInstant("2026-01-10", 10, "Africa/Cairo")).toBe("2026-01-10T08:00:00.000Z");
    expect(zonedInstant("2026-10-10", 10, "UTC")).toBe("2026-10-10T10:00:00.000Z");
    expect(zonedInstant("2026-10-10", 24, "UTC")).toBeNull();
  });

  it("round-trips with zonedDateHour across zones", () => {
    for (const zone of ["Africa/Cairo", "Europe/London", "America/New_York", "Asia/Riyadh"]) {
      const instant = zonedInstant("2026-03-29", 9, zone) as string;
      expect(zonedDateHour(instant, zone)).toEqual({ date: "2026-03-29", hour: 9 });
    }
  });
});
