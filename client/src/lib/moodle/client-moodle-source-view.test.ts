import { describe, expect, it } from "vitest";

import {
  filterMoodleCourseRows,
  moodleCourseContentRoute,
  resolveMoodleCatalogDisplayState,
} from "@/pages/platform/MoodleSourcePage";
import {
  formatMoodleActivityType,
  resolveMoodleContentDisplayState,
  type MoodleCourseContentViewModel,
} from "@/pages/platform/MoodleCourseContentPage";
import type { MoodleCourseCatalogProjectionDto } from "@/lib/backend/api";

const catalog: MoodleCourseCatalogProjectionDto = {
  mode: "read_only",
  authority: "server_course_relationships",
  authorityObservedAt: "2026-07-17T10:00:00.000Z",
  availability: "available",
  freshness: "fresh",
  observations: [],
  rows: [
    {
      internalCourseId: "course_ar_l3",
      mappingState: "synced",
      course: {
        sourceId: "42",
        title: "Standard Arabic Level 3",
        shortTitle: "AR-L3",
      },
    },
    {
      internalCourseId: "course_quran_1",
      mappingState: "missing",
      reconciliationReason: "missing_mapping",
    },
  ],
};

describe("Moodle source display state", () => {
  it("filters sanitized projection rows without using platform state", () => {
    expect(filterMoodleCourseRows(catalog.rows, "arabic")).toEqual([
      catalog.rows[0],
    ]);
    expect(filterMoodleCourseRows(catalog.rows, "missing mapping")).toEqual([
      catalog.rows[1],
    ]);
  });

  it.each([
    {
      name: "loading",
      input: { catalog: null, loading: true, error: "", search: "" },
      state: "loading",
    },
    {
      name: "error",
      input: {
        catalog: null,
        loading: false,
        error: "Unavailable",
        search: "",
      },
      state: "error",
    },
    {
      name: "ready",
      input: { catalog, loading: false, error: "", search: "" },
      state: "ready",
    },
    {
      name: "filtered empty",
      input: { catalog, loading: false, error: "", search: "not-found" },
      state: "empty",
    },
  ])("resolves the $name state", ({ input, state }) => {
    expect(resolveMoodleCatalogDisplayState(input).state).toBe(state);
  });

  it("preserves stale and partial server evidence", () => {
    const display = resolveMoodleCatalogDisplayState({
      catalog: {
        ...catalog,
        freshness: "stale",
        availability: "unavailable",
      },
      loading: false,
      error: "",
      search: "",
    });

    expect(display).toMatchObject({
      state: "ready",
      freshness: "stale",
      availability: "unavailable",
    });
  });

  it("treats a fully unavailable zero-row projection as an outage", () => {
    expect(
      resolveMoodleCatalogDisplayState({
        catalog: {
          ...catalog,
          availability: "unavailable",
          freshness: "unavailable",
          rows: [],
        },
        loading: false,
        error: "",
        search: "",
      })
    ).toMatchObject({
      state: "unavailable",
      availability: "unavailable",
      freshness: "unavailable",
    });
  });

  it.each([
    ["student", "/app/student/moodle-source/course_ar_l3"],
    ["teacher", "/app/teacher/moodle-source/course_ar_l3"],
    ["headofdepartment", "/app/hod/moodle-source/course_ar_l3"],
    ["superadmin", "/app/admin/moodle-source/course_ar_l3"],
  ] as const)("builds the exact %s course-content route", (role, route) => {
    expect(moodleCourseContentRoute(role, "course_ar_l3")).toBe(route);
  });
});

const content: MoodleCourseContentViewModel = {
  mode: "read_only",
  authorityObservedAt: "2026-07-17T10:00:00.000Z",
  availability: "available",
  freshness: "fresh",
  latestOutcome: "available",
  observation: {
    runId: "run_1",
    observedAt: "2026-07-17T09:55:00.000Z",
    freshUntil: "2026-07-17T10:55:00.000Z",
    retainUntil: "2026-07-18T09:55:00.000Z",
    payloadHash: "fake-payload-hash",
  },
  projection: {
    internalCourseId: "course_ar_l3",
    externalCourseId: "42",
    mappingState: "synced",
    sections: [
      {
        sourceId: "section_1",
        position: 1,
        title: "Welcome",
        activities: [
          {
            sourceId: "activity_1",
            instanceSourceId: "instance_1",
            type: "interactive_video",
            title: "Course orientation",
            completionTracking: "automatic",
          },
        ],
      },
      {
        sourceId: "section_2",
        position: 2,
        title: "Practice",
        activities: [],
      },
    ],
  },
};

describe("Moodle course-content display state", () => {
  it.each([
    {
      name: "loading",
      input: { content: null, loading: true, error: "" },
      state: "loading",
    },
    {
      name: "error with retry",
      input: { content: null, loading: false, error: "Unavailable" },
      state: "error",
    },
    {
      name: "ready",
      input: { content, loading: false, error: "" },
      state: "ready",
    },
    {
      name: "empty",
      input: {
        content: {
          ...content,
          availability: "empty" as const,
          projection: { ...content.projection, sections: [] },
        },
        loading: false,
        error: "",
      },
      state: "empty",
    },
    {
      name: "unavailable",
      input: {
        content: {
          ...content,
          availability: "unavailable" as const,
          freshness: "unavailable" as const,
          projection: { ...content.projection, sections: [] },
        },
        loading: false,
        error: "",
      },
      state: "unavailable",
    },
  ])("resolves the $name content state", ({ input, state }) => {
    expect(resolveMoodleContentDisplayState(input).state).toBe(state);
  });

  it("counts activities without flattening semantic sections", () => {
    expect(
      resolveMoodleContentDisplayState({
        content,
        loading: false,
        error: "",
      })
    ).toMatchObject({
      activityCount: 1,
      sections: content.projection.sections,
      state: "ready",
    });
  });

  it("preserves stale and partial retained content", () => {
    expect(
      resolveMoodleContentDisplayState({
        content: {
          ...content,
          availability: "unavailable",
          freshness: "stale",
        },
        loading: false,
        error: "",
      })
    ).toMatchObject({
      freshness: "stale",
      isPartial: true,
      state: "ready",
    });
  });

  it("formats provider activity types as safe display labels", () => {
    expect(formatMoodleActivityType("interactive_video")).toBe(
      "Interactive Video"
    );
    expect(formatMoodleActivityType(" ")).toBe("Activity");
  });
});
