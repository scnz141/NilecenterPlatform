import { afterEach, describe, expect, it, vi } from "vitest";

import {
  fetchMoodleCourseCatalogProjectionRequest,
  fetchMoodleCourseContentProjectionRequest,
  parseMoodleCourseContentProjectionDto,
} from "@/lib/backend/api";

describe("Moodle catalog projection client", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reads the same-origin server projection with credentials", async () => {
    const body = {
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
      ],
    };
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify(body), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchMoodleCourseCatalogProjectionRequest()).resolves.toEqual({
      ok: true,
      data: body,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/integrations/moodle/projections/courses",
      expect.objectContaining({ credentials: "include" })
    );
  });

  it("preserves the server error instead of falling back to local data", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              error: "Moodle projection repository is temporarily unavailable.",
            }),
            { status: 503, headers: { "Content-Type": "application/json" } }
          )
      )
    );

    await expect(fetchMoodleCourseCatalogProjectionRequest()).resolves.toEqual({
      ok: false,
      error: "Moodle projection repository is temporarily unavailable.",
    });
  });

  it.each([
    ["wrong authority", { mode: "read_only", authority: "client_state" }],
    [
      "missing freshness evidence",
      {
        mode: "read_only",
        authority: "server_course_relationships",
        authorityObservedAt: "2026-07-17T10:00:00.000Z",
        availability: "empty",
        observations: [],
        rows: [],
      },
    ],
    [
      "malformed row",
      {
        mode: "read_only",
        authority: "server_course_relationships",
        authorityObservedAt: "2026-07-17T10:00:00.000Z",
        availability: "available",
        freshness: "fresh",
        observations: [],
        rows: [{ mappingState: "synced", course: { title: "Missing IDs" } }],
      },
    ],
  ])("fails closed for a %s response", async (_label, body) => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify(body), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          })
      )
    );

    await expect(fetchMoodleCourseCatalogProjectionRequest()).resolves.toEqual({
      ok: false,
      error: "Moodle projection response was invalid.",
    });
  });
});

const contentBody = () => ({
  mode: "read_only",
  authority: "server_course_relationships",
  authorityObservedAt: "2026-07-17T10:00:00.000Z",
  availability: "available",
  freshness: "fresh",
  latestOutcome: "available",
  observation: {
    runId: "run-course-content-1",
    observedAt: "2026-07-17T10:00:00.000Z",
    freshUntil: "2026-07-17T10:15:00.000Z",
    retainUntil: "2026-07-24T10:00:00.000Z",
    payloadHash: "a".repeat(64),
  },
  projection: {
    internalCourseId: "course/ar l3",
    externalCourseId: "42",
    mappingState: "synced",
    sections: [
      {
        sourceId: "7",
        position: 1,
        title: "Week 1",
        visible: true,
        activities: [
          {
            sourceId: "81",
            instanceSourceId: "91",
            type: "page",
            title: "Welcome",
            visible: true,
            completionTracking: "manual",
            launchAvailable: true,
            dates: [{ label: "Due", at: "2026-07-18T10:00:00.000Z" }],
            resources: [
              {
                resourceId: "81:1",
                name: "course-guide.pdf",
                mimeType: "application/pdf",
                sizeBytes: 4096,
                kind: "pdf",
                modifiedAt: "2026-07-17T09:00:00.000Z",
              },
            ],
          },
        ],
      },
    ],
  },
});

describe("Moodle course-content projection client", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reads one encoded same-origin course-content projection with GET credentials", async () => {
    const body = contentBody();
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify(body), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      fetchMoodleCourseContentProjectionRequest(" course/ar l3 ")
    ).resolves.toEqual({ ok: true, data: body });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/integrations/moodle/projections/courses/course%2Far%20l3/content",
      expect.objectContaining({ method: "GET", credentials: "include" })
    );
  });

  it.each(["", "   "])(
    'rejects an empty course ID "%s" before fetch',
    async courseId => {
      const fetchMock = vi.fn();
      vi.stubGlobal("fetch", fetchMock);

      await expect(
        fetchMoodleCourseContentProjectionRequest(courseId)
      ).resolves.toEqual({ ok: false, error: "Course ID is required." });
      expect(fetchMock).not.toHaveBeenCalled();
    }
  );

  it("rejects a projection for a different requested course", async () => {
    const body = contentBody();
    body.projection.internalCourseId = "course_other";
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify(body), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          })
      )
    );

    await expect(
      fetchMoodleCourseContentProjectionRequest("course/ar l3")
    ).resolves.toEqual({
      ok: false,
      error: "Moodle projection response was invalid.",
    });
  });

  it.each([
    [403, "Moodle course access denied."],
    [409, "Moodle course mapping needs review."],
    [503, "Stored Moodle projection is temporarily unavailable."],
  ])(
    "preserves a %i server error without a fallback request",
    async (status, error) => {
      const fetchMock = vi.fn(
        async () =>
          new Response(JSON.stringify({ error }), {
            status,
            headers: { "Content-Type": "application/json" },
          })
      );
      vi.stubGlobal("fetch", fetchMock);

      await expect(
        fetchMoodleCourseContentProjectionRequest("course_ar_l3")
      ).resolves.toEqual({ ok: false, error });
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock.mock.calls[0]?.[0]).toBe(
        "/api/integrations/moodle/projections/courses/course_ar_l3/content"
      );
    }
  );

  it.each([
    ["mode", (body: ReturnType<typeof contentBody>) => (body.mode = "write")],
    [
      "authority",
      (body: ReturnType<typeof contentBody>) =>
        (body.authority = "client_state"),
    ],
    [
      "authority timestamp",
      (body: ReturnType<typeof contentBody>) =>
        (body.authorityObservedAt = "not-a-timestamp"),
    ],
    [
      "availability",
      (body: ReturnType<typeof contentBody>) => (body.availability = "partial"),
    ],
    [
      "freshness",
      (body: ReturnType<typeof contentBody>) => (body.freshness = "cached"),
    ],
    [
      "latest outcome",
      (body: ReturnType<typeof contentBody>) =>
        (body.latestOutcome = "provider_raw"),
    ],
    [
      "projection state combination",
      (body: ReturnType<typeof contentBody>) =>
        (body.availability = "unavailable"),
    ],
    [
      "observation ordering",
      (body: ReturnType<typeof contentBody>) =>
        (body.observation.freshUntil = "2026-07-16T10:00:00.000Z"),
    ],
    [
      "observation hash",
      (body: ReturnType<typeof contentBody>) =>
        (body.observation.payloadHash = "not-a-hash"),
    ],
    [
      "mapping state",
      (body: ReturnType<typeof contentBody>) =>
        (body.projection.mappingState = "ignored"),
    ],
    [
      "external course ID",
      (body: ReturnType<typeof contentBody>) =>
        (body.projection.externalCourseId = "042"),
    ],
    [
      "section position",
      (body: ReturnType<typeof contentBody>) =>
        (body.projection.sections[0]!.position = -1),
    ],
    [
      "activity completion",
      (body: ReturnType<typeof contentBody>) =>
        (body.projection.sections[0]!.activities[0]!.completionTracking =
          "provider"),
    ],
    [
      "raw activity title",
      (body: ReturnType<typeof contentBody>) =>
        (body.projection.sections[0]!.activities[0]!.title =
          "Open https://private.example.test"),
    ],
  ])("rejects an invalid %s", (_label, mutate) => {
    const body = contentBody();
    mutate(body);
    expect(
      parseMoodleCourseContentProjectionDto(body, "course/ar l3")
    ).toBeNull();
  });

  it.each([
    [
      "root",
      (body: ReturnType<typeof contentBody>) =>
        Object.assign(body, { raw: {} }),
    ],
    [
      "observation",
      (body: ReturnType<typeof contentBody>) =>
        Object.assign(body.observation, { providerPayload: {} }),
    ],
    [
      "projection",
      (body: ReturnType<typeof contentBody>) =>
        Object.assign(body.projection, { moodleUrl: "https://example.test" }),
    ],
    [
      "section",
      (body: ReturnType<typeof contentBody>) =>
        Object.assign(body.projection.sections[0]!, { summary: "raw" }),
    ],
    [
      "activity",
      (body: ReturnType<typeof contentBody>) =>
        Object.assign(body.projection.sections[0]!.activities[0]!, {
          contents: [{ fileUrl: "https://private.example.test" }],
        }),
    ],
  ])("rejects an unknown or raw %s field", (_label, mutate) => {
    const body = contentBody();
    mutate(body);
    expect(
      parseMoodleCourseContentProjectionDto(body, "course/ar l3")
    ).toBeNull();
  });

  it("rejects oversized section and activity collections", () => {
    const sections = contentBody();
    sections.projection.sections = Array.from(
      { length: 2_001 },
      () => contentBody().projection.sections[0]!
    );
    expect(
      parseMoodleCourseContentProjectionDto(sections, "course/ar l3")
    ).toBeNull();

    const activities = contentBody();
    activities.projection.sections[0]!.activities = Array.from(
      { length: 2_001 },
      () => contentBody().projection.sections[0]!.activities[0]!
    );
    expect(
      parseMoodleCourseContentProjectionDto(activities, "course/ar l3")
    ).toBeNull();
  });

  it("accepts strict empty and retained stale content states", () => {
    const empty = contentBody();
    empty.availability = "empty";
    empty.latestOutcome = "empty";
    empty.projection.sections = [];
    expect(
      parseMoodleCourseContentProjectionDto(empty, "course/ar l3")
    ).toEqual(empty);

    const stale = contentBody();
    stale.availability = "unavailable";
    stale.freshness = "stale";
    stale.latestOutcome = "unavailable";
    expect(
      parseMoodleCourseContentProjectionDto(stale, "course/ar l3")
    ).toEqual(stale);
  });
});
