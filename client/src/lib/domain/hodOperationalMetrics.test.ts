import { describe, expect, it } from "vitest";
import { seedPlatformState } from "./seed";
import { buildHodOperationalMetrics } from "./hodOperationalMetrics";

function createSeedState() {
  return structuredClone(seedPlatformState);
}

describe("HOD operational metric definitions", () => {
  it("derives only department-scoped Nile operational metrics", () => {
    const state = createSeedState();
    const result = buildHodOperationalMetrics(
      state,
      "usr_hod_demo",
      new Date("2026-07-24T12:00:00.000Z")
    );

    expect(result.departmentIds).toContain("dep_arabic");
    expect(result.metrics.map(metric => metric.id)).toEqual([
      "active_classes",
      "teacher_workload",
      "attendance_completion",
      "capacity_utilization",
      "open_interventions",
    ]);
    expect(
      result.metrics.find(metric => metric.id === "attendance_completion")
    ).toMatchObject({
      source: "Nile Learn",
      definition:
        "Due or completed class sessions whose attendance register has been saved.",
    });
  });

  it("does not present compatibility progress or grades as Moodle outcomes", () => {
    const state = createSeedState();
    state.enrollments.forEach(enrollment => {
      enrollment.progress = 100;
      enrollment.currentGrade = 100;
    });

    const result = buildHodOperationalMetrics(
      state,
      "usr_hod_demo",
      new Date("2026-07-24T12:00:00.000Z")
    );

    expect(result.moodleOutcomes).toHaveLength(3);
    expect(
      result.moodleOutcomes.every(item => item.status === "unavailable")
    ).toBe(true);
    expect(
      result.moodleOutcomes.every(item => item.reason.includes("Moodle"))
    ).toBe(true);
  });

  it("excludes classes outside the HOD department", () => {
    const state = createSeedState();
    const result = buildHodOperationalMetrics(
      state,
      "usr_hod_demo",
      new Date("2026-07-24T12:00:00.000Z")
    );

    const scopedClassIds = new Set(result.classGroupIds);
    const unrelatedRunIds = new Set(
      state.courseRuns
        .filter(run => !result.courseRunIds.includes(run.id))
        .map(run => run.id)
    );
    const unrelatedClasses = state.classGroups.filter(group =>
      unrelatedRunIds.has(group.courseRunId)
    );

    unrelatedClasses.forEach(group =>
      expect(scopedClassIds.has(group.id)).toBe(false)
    );
  });
});
