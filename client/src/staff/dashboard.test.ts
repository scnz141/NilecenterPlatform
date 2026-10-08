import { describe, expect, it } from "vitest";
import { fillPercent, greetingPart, splitToday } from "./dashboard";

describe("dashboard helpers", () => {
  it("greets by local hour", () => {
    expect(greetingPart(8)).toBe("morning");
    expect(greetingPart(12)).toBe("afternoon");
    expect(greetingPart(19)).toBe("evening");
  });

  it("rounds and caps class fill", () => {
    expect(fillPercent(0, 0)).toBe(0);
    expect(fillPercent(7, 20)).toBe(35);
    expect(fillPercent(25, 20)).toBe(100);
  });

  it("splits today's agenda in branch time and collects missing results", () => {
    const now = Date.parse("2026-10-07T12:00:00Z");
    const zone = () => "Africa/Cairo";
    const row = (id: string, scheduledAt: string, status = "scheduled") => ({
      id,
      scheduledAt,
      status,
      branchId: "b",
    });
    const { today, overdue } = splitToday(
      [
        row("later-today", "2026-10-07T14:00:00Z"),
        row("earlier-today", "2026-10-07T07:00:00Z"),
        row("cairo-midnight", "2026-10-07T21:30:00Z"),
        row("yesterday", "2026-10-06T09:00:00Z"),
        row("done", "2026-10-07T08:00:00Z", "completed"),
      ],
      zone,
      now
    );
    expect(today.map(item => item.id)).toEqual(["earlier-today", "later-today"]);
    expect(overdue.map(item => item.id).sort()).toEqual(["earlier-today", "yesterday"]);
  });
});

describe("dashboard insights", () => {
  it("builds the current and previous windows for a period", async () => {
    const { periodWindows } = await import("./dashboard");
    const windows = periodWindows("7d", new Date("2026-10-08T12:00:00Z"));
    expect(windows.current).toEqual({ createdFrom: "2026-10-02", createdTo: "2026-10-08" });
    expect(windows.previous).toEqual({ createdFrom: "2026-09-25", createdTo: "2026-10-01" });
    expect(periodWindows("all").current).toBeNull();
  });

  it("lists Monday-start weeks, oldest first", async () => {
    const { weekWindows } = await import("./dashboard");
    const weeks = weekWindows(3, new Date("2026-10-08T12:00:00Z"));
    expect(weeks.map(week => week.createdFrom)).toEqual(["2026-09-21", "2026-09-28", "2026-10-05"]);
    expect(weeks[2].createdTo).toBe("2026-10-11");
  });

  it("derives conversion and show-up rates", async () => {
    const { leadOutcomes, bookingOutcomes, delta } = await import("./dashboard");
    expect(
      leadOutcomes([
        { key: "in_process", count: 1 },
        { key: "follow_up", count: 2 },
        { key: "registered", count: 9 },
        { key: "lost", count: 18 },
      ])
    ).toEqual({ total: 30, open: 3, registered: 9, lost: 18, conversion: 33 });
    expect(leadOutcomes([]).conversion).toBeNull();
    const bookings = bookingOutcomes([
      { key: "trial_completed", count: 9 },
      { key: "trial_no_show", count: 1 },
      { key: "placement_cancelled", count: 1 },
    ]);
    expect(bookings.trial.showRate).toBe(90);
    expect(bookings.placement.showRate).toBeNull();
    expect(delta(5, 3)).toBe(2);
    expect(delta(5, null)).toBeNull();
  });
});
