import { describe, expect, it } from "vitest";
import {
  addDays,
  addMonths,
  clampDate,
  daysInMonth,
  formatFieldDate,
  isIsoDate,
  monthGrid,
  startOfWeek,
  todayIso,
  weekStartsOn,
  weekday,
  weekdayNames,
} from "./calendar";

describe("calendar maths", () => {
  it("validates real ISO dates only", () => {
    expect(isIsoDate("2026-10-09")).toBe(true);
    expect(isIsoDate("2026-02-30")).toBe(false);
    expect(isIsoDate("26-10-09")).toBe(false);
    expect(isIsoDate("")).toBe(false);
  });

  it("adds days across months, years and leap days", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("keeps the day when adding months, or uses the last day", () => {
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2028-01-31", 1)).toBe("2028-02-29");
    expect(addMonths("2026-05-15", -6)).toBe("2025-11-15");
    expect(addMonths("2026-12-10", 1)).toBe("2027-01-10");
  });

  it("knows month lengths", () => {
    expect(daysInMonth("2026-02-10")).toBe(28);
    expect(daysInMonth("2028-02-10")).toBe(29);
    expect(daysInMonth("2026-04-01")).toBe(30);
  });

  it("does not shift with the device time zone", () => {
    expect(weekday("2026-10-09")).toBe(5); // Friday
    expect(todayIso(new Date(2026, 9, 9, 23, 59))).toBe("2026-10-09");
  });

  it("builds six weeks starting on the chosen weekday", () => {
    const sat = monthGrid("2026-10-15", 6);
    expect(sat).toHaveLength(42);
    expect(weekday(sat[0])).toBe(6);
    expect(sat[0] <= "2026-10-01" && sat.includes("2026-10-31")).toBe(true);
    const mon = monthGrid("2026-10-15", 1);
    expect(mon[0]).toBe("2026-09-28");
    expect(startOfWeek("2026-10-09", 6)).toBe("2026-10-03");
  });

  it("clamps into bounds", () => {
    expect(clampDate("2026-01-01", "2026-02-01")).toBe("2026-02-01");
    expect(clampDate("2026-05-01", undefined, "2026-04-30")).toBe("2026-04-30");
    expect(clampDate("2026-03-01", "2026-02-01", "2026-04-30")).toBe("2026-03-01");
  });

  it("starts the week on Saturday in Arabic and Monday in Turkish", () => {
    expect(weekStartsOn("ar-EG")).toBe(6);
    expect(weekStartsOn("tr-TR")).toBe(1);
  });

  it("labels in the requested language", () => {
    expect(formatFieldDate("2026-10-10", "en-GB")).toBe("Sat, 10 Oct 2026");
    expect(weekdayNames(1, "en-GB")[0]).toEqual({ short: "Mon", long: "Monday" });
    // Arabic short names are full words, so the column uses the narrow form.
    expect(weekdayNames(6, "ar-EG")[0].short.length).toBe(1);
    expect(weekdayNames(6, "ar-EG")[0].long).toBe("السبت");
  });
});
