import { describe, expect, it, vi } from "vitest";

import type { ServerSession } from "../../../../server/auth";
import type { MoodleClient } from "../../../../server/moodleClient";
import { MoodleApiError } from "../../../../server/moodleClient";
import { hashMoodleProjectionPayload } from "../../../../server/moodleProjectionFreshness";
import { registerMoodleRoutes } from "../../../../server/moodleRoutes";
import { setMoodleProjectionRepository } from "../../../../server/moodleProjectionRepository";
import { seedPlatformState } from "../domain/seed";

type RouteHandler = (
  request: {
    headers: { cookie?: string };
    params?: Record<string, string>;
    get(name: string): string | undefined;
  },
  response: unknown
) => Promise<void> | void;

const baseSession: ServerSession = {
  id: "session-student",
  userId: "usr_student_demo",
  authUserId: "20000000-0000-4000-8000-000000000002",
  activeRoleGrantId: "30000000-0000-4000-8000-000000000002",
  email: "student@nilelearn.local",
  name: "Student Demo",
  roles: ["student"],
  activeRole: "student",
  provider: "supabase",
  authorizationModel: "normalized",
  createdAt: "2026-07-16T00:00:00.000Z",
  expiresAt: "2026-07-17T00:00:00.000Z",
};

const compatibilitySession: ServerSession = {
  ...baseSession,
  provider: "demo",
  authorizationModel: "snapshot",
};

const configuredStatus = {
  enabled: true,
  baseUrlConfigured: true,
  serviceConfigured: true,
  tokenConfigured: true,
  allowedHostsConfigured: true,
  configured: true,
  mode: "read_only" as const,
};

function captureRoutes(
  dependencies: Parameters<typeof registerMoodleRoutes>[1]
) {
  const routes = new Map<string, RouteHandler>();
  registerMoodleRoutes(
    {
      get(path, handler) {
        routes.set(path, handler as RouteHandler);
      },
    },
    dependencies
  );
  return routes;
}

function responseRecorder() {
  const result: { status: number; body?: unknown } = { status: 200 };
  const headers = new Map<string, string>();
  const response = {
    status(code: number) {
      result.status = code;
      return response;
    },
    setHeader(name: string, value: string) {
      headers.set(name.toLowerCase(), value);
    },
    json(body: unknown) {
      result.body = body;
    },
  };
  return { response, result, headers };
}

function request(params?: Record<string, string>) {
  return { headers: {}, params, get: () => undefined };
}

function fakeClient() {
  return {
    mode: "read_only",
    probe: vi.fn(async () => ({ minimumPrivilegeVerified: true })),
    call: vi.fn(),
    getCourses: vi.fn(async () => ({
      courses: [
        {
          id: 42,
          categoryid: 4,
          fullname: "Arabic Foundations",
          shortname: "AR-FND",
          visible: 1,
          summary: "must not be projected",
        },
        {
          id: 99,
          categoryid: 4,
          fullname: "Unmapped Course",
          shortname: "UNMAPPED",
          visible: 1,
        },
      ],
      warnings: [],
    })),
    getCourseContents: vi.fn(async () => [
      {
        id: 7,
        section: 1,
        name: "Week 1",
        visible: 1,
        summary: "private section text",
        modules: [
          {
            id: 81,
            instance: 91,
            modname: "page",
            name: "Welcome",
            visible: 1,
            url: "https://private.example.test/file",
          },
        ],
      },
    ]),
  } as unknown as MoodleClient;
}

const mappings = [
  {
    internalCourseId: "course_ar_l3",
    externalCourseId: "42",
    state: "synced" as const,
  },
];

const connectionId = "70000000-0000-4000-8000-000000000001";
const normalizedCourseId = "50000000-0000-4000-8000-000000000001";
const normalizedCourseRunId = "51000000-0000-4000-8000-000000000001";
const normalizedClassGroupId = "52000000-0000-4000-8000-000000000001";
const normalizedLearnerId = "53000000-0000-4000-8000-000000000001";
const normalizedEnrollmentId = "54000000-0000-4000-8000-000000000001";
const normalizedMembershipId = "55000000-0000-4000-8000-000000000001";
const normalizedAssignmentProjectionId = "56000000-0000-4000-8000-000000000001";
const normalizedQuizProjectionId = "56000000-0000-4000-8000-000000000002";
const normalizedGradeItemProjectionId = "56000000-0000-4000-8000-000000000003";
const normalizedActivityProjectionId = "56000000-0000-4000-8000-000000000004";
const catalogPayload = [
  {
    sourceId: "42",
    categorySourceId: "4",
    title: "Arabic Foundations",
    shortTitle: "AR-FND",
    visible: true,
  },
];
const contentPayload = [
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
        completionTracking: "none" as const,
      },
    ],
  },
];

function retainedObservation(
  projectionFamily: "course_catalog" | "course_content",
  payload: unknown,
  options: {
    latestOutcome?: "available" | "empty" | "unavailable";
    lastAttemptedAt?: string;
    freshUntil?: string;
    retainUntil?: string;
    externalCourseId?: string;
    reconciliationReason?: "missing_provider_record";
  } = {}
) {
  return {
    internalCourseId: "course_ar_l3",
    externalCourseId: options.externalCourseId ?? "42",
    mappingState: "synced" as const,
    ...(options.reconciliationReason
      ? { reconciliationReason: options.reconciliationReason }
      : {}),
    observation: {
      projectionFamily,
      internalCourseId: "course_ar_l3",
      externalCourseId: options.externalCourseId ?? "42",
      latestOutcome: options.latestOutcome ?? "available",
      lastAttemptedAt: options.lastAttemptedAt ?? "2026-07-17T02:00:00.000Z",
      lastSuccess: {
        runId: "90000000-0000-4000-8000-000000000001",
        payload,
        payloadHash: hashMoodleProjectionPayload(payload),
        itemCount: Array.isArray(payload) ? payload.length : 0,
        observedAt: "2026-07-17T01:00:00.000Z",
        freshUntil: options.freshUntil ?? "2026-07-17T03:00:00.000Z",
        retainUntil: options.retainUntil ?? "2026-07-18T01:00:00.000Z",
      },
    },
  };
}

function normalizedRepository(options: {
  authorizedCourseIds?: string[];
  observations?: ReturnType<typeof retainedObservation>[];
  enrollmentContext?: {
    connectionId: string;
    activeRole: "teacher" | "headofdepartment" | "superadmin";
    audience: "person_level" | "aggregate";
    internalCourseId: string;
    internalCourseRunId: string;
    internalClassGroupId: string;
    authorizedUserIds: string[];
    courseMappingStatus: "exact" | "missing";
    groupMappingStatus: "exact" | "missing";
    userMappingStatus: "exact" | "missing";
    observedAt: string;
  };
  enrollmentFreshness?: unknown;
  assessmentContext?: {
    connectionId: string;
    activeRole: "student" | "teacher" | "headofdepartment" | "superadmin";
    audience: "learner" | "class_staff";
    internalCourseId: string;
    internalCourseRunId: string;
    internalClassGroupId: string;
    subjectUserId?: string;
    courseMappingStatus: "exact" | "missing";
    groupMappingStatus: "exact" | "missing";
    userMappingStatus: "exact" | "missing" | "not_required";
    assessmentMappingStatus: "exact" | "missing";
    observedAt: string;
  };
  assessmentFreshness?: unknown;
  assignmentResultContext?: {
    connectionId: string;
    activeRole: "student" | "teacher" | "headofdepartment" | "superadmin";
    audience: "learner" | "person_level" | "aggregate";
    internalCourseId: string;
    internalCourseRunId: string;
    internalClassGroupId: string;
    assignmentProjectionId: string;
    authorizedUserIds: string[];
    courseMappingStatus: "exact" | "missing";
    groupMappingStatus: "exact" | "missing";
    userMappingStatus: "exact" | "missing";
    assignmentMappingStatus: "exact" | "missing";
    observedAt: string;
  };
  assignmentResultFreshness?: unknown;
  quizAttemptContext?: {
    connectionId: string;
    activeRole: "student" | "teacher" | "headofdepartment" | "superadmin";
    audience: "learner" | "person_level" | "aggregate";
    internalCourseId: string;
    internalCourseRunId: string;
    internalClassGroupId: string;
    quizProjectionId: string;
    authorizedUserIds: string[];
    courseMappingStatus: "exact" | "missing";
    groupMappingStatus: "exact" | "missing";
    userMappingStatus: "exact" | "missing";
    quizMappingStatus: "exact" | "missing";
    observedAt: string;
  };
  quizAttemptFreshness?: unknown;
  gradeOutcomeContext?: {
    connectionId: string;
    activeRole: "student" | "teacher" | "headofdepartment" | "superadmin";
    audience: "learner" | "person_level" | "aggregate";
    internalCourseId: string;
    internalCourseRunId: string;
    internalClassGroupId: string;
    gradeItemProjectionId: string;
    authorizedUserIds: string[];
    courseMappingStatus: "exact" | "missing";
    groupMappingStatus: "exact" | "missing";
    userMappingStatus: "exact" | "missing";
    gradeItemMappingStatus: "exact" | "missing";
    observedAt: string;
  };
  gradeOutcomeFreshness?: unknown;
  activityOutcomeContext?: {
    connectionId: string;
    activeRole: "student" | "teacher" | "headofdepartment" | "superadmin";
    audience: "learner" | "person_level" | "aggregate";
    internalCourseId: string;
    internalCourseRunId: string;
    internalClassGroupId: string;
    activityProjectionId: string;
    activityKind: "lesson" | "h5p" | "scorm";
    authorizedUserIds: string[];
    courseMappingStatus: "exact" | "missing";
    groupMappingStatus: "exact" | "missing";
    userMappingStatus: "exact" | "missing";
    activityMappingStatus: "exact" | "missing";
    observedAt: string;
  };
  activityOutcomeFreshness?: unknown;
}) {
  return {
    kind: "supabase" as const,
    resolveCourseAuthority: vi.fn(async () => ({
      connectionId,
      activeRole: "student" as const,
      authorizedCourseIds: options.authorizedCourseIds ?? ["course_ar_l3"],
      observedAt: "2026-07-17T01:00:00.000Z",
    })),
    listCourseMappings: vi.fn(async () => mappings),
    resolveUserAuthority: vi.fn(async () => ({
      activeRole: "student" as const,
      authorizedUserIds: ["10000000-0000-4000-8000-000000000001"],
      observedAt: "2026-07-17T01:00:00.000Z",
    })),
    listUserMappings: vi.fn(async () => []),
    listProjectionObservations: vi.fn(async () => options.observations ?? []),
    resolveEnrollmentGroupContext: vi.fn(async () => {
      if (!options.enrollmentContext) throw new Error("Unexpected class read");
      return options.enrollmentContext;
    }),
    getEnrollmentGroupFreshness: vi.fn(async () => {
      if (!options.enrollmentFreshness)
        throw new Error("Unexpected class read");
      return options.enrollmentFreshness;
    }),
    resolveAssessmentStatusContext: vi.fn(async () => {
      if (!options.assessmentContext)
        throw new Error("Unexpected assessment read");
      return options.assessmentContext;
    }),
    getAssessmentStatusFreshness: vi.fn(async () => {
      if (!options.assessmentFreshness)
        throw new Error("Unexpected assessment read");
      return options.assessmentFreshness;
    }),
    resolveAssignmentResultContext: vi.fn(async () => {
      if (!options.assignmentResultContext)
        throw new Error("Unexpected assignment result read");
      return options.assignmentResultContext;
    }),
    getAssignmentResultFreshness: vi.fn(async () => {
      if (!options.assignmentResultFreshness)
        throw new Error("Unexpected assignment result read");
      return options.assignmentResultFreshness;
    }),
    resolveQuizAttemptContext: vi.fn(async () => {
      if (!options.quizAttemptContext)
        throw new Error("Unexpected quiz attempt read");
      return options.quizAttemptContext;
    }),
    getQuizAttemptFreshness: vi.fn(async () => {
      if (!options.quizAttemptFreshness)
        throw new Error("Unexpected quiz attempt read");
      return options.quizAttemptFreshness;
    }),
    resolveGradeOutcomeContext: vi.fn(async () => {
      if (!options.gradeOutcomeContext)
        throw new Error("Unexpected grade outcome read");
      return options.gradeOutcomeContext;
    }),
    getGradeOutcomeFreshness: vi.fn(async () => {
      if (!options.gradeOutcomeFreshness)
        throw new Error("Unexpected grade outcome read");
      return options.gradeOutcomeFreshness;
    }),
    resolveActivityOutcomeContext: vi.fn(async () => {
      if (!options.activityOutcomeContext)
        throw new Error("Unexpected activity outcome read");
      return options.activityOutcomeContext;
    }),
    getActivityOutcomeFreshness: vi.fn(async () => {
      if (!options.activityOutcomeFreshness)
        throw new Error("Unexpected activity outcome read");
      return options.activityOutcomeFreshness;
    }),
  };
}

function dependencies(
  session: ServerSession | null,
  client: MoodleClient = fakeClient()
) {
  return {
    getSession: async () => session,
    getClient: () => client,
    getStatus: () => configuredStatus,
    getState: async () => ({
      state: seedPlatformState,
      persistence: "local" as const,
      syncedAt: "2026-07-16T12:00:00.000Z",
    }),
    getCourseMappings: async () => mappings,
  };
}

describe("Moodle read-only projection routes", () => {
  it("requires a server session before reading mappings or Moodle", async () => {
    const client = fakeClient();
    const deps = dependencies(null, client);
    const getMappings = vi.fn(deps.getCourseMappings);
    const routes = captureRoutes({ ...deps, getCourseMappings: getMappings });
    const { response, result, headers } = responseRecorder();

    await routes.get("/api/integrations/moodle/projections/courses")!(
      request(),
      response
    );

    expect(result).toEqual({
      status: 401,
      body: { error: "Sign in required." },
    });
    expect(headers.get("cache-control")).toBe("private, no-store");
    expect(headers.get("vary")).toBe("Cookie");
    expect(getMappings).not.toHaveBeenCalled();
    expect(client.getCourses).not.toHaveBeenCalled();
  });

  it("denies an unmapped snapshot identity before calling Moodle", async () => {
    const client = fakeClient();
    const routes = captureRoutes(
      dependencies(
        { ...compatibilitySession, userId: "snapshot-user-uuid" },
        client
      )
    );
    const { response, result } = responseRecorder();

    await routes.get("/api/integrations/moodle/projections/courses")!(
      request(),
      response
    );

    expect(result).toEqual({
      status: 403,
      body: { error: "Moodle course access denied." },
    });
    expect(client.getCourses).not.toHaveBeenCalled();
  });

  it.each(["registrar", "branchadmin"] as const)(
    "denies %s catalog access before reading repositories",
    async role => {
      const client = fakeClient();
      const deps = dependencies(
        {
          ...compatibilitySession,
          userId:
            role === "registrar" ? "usr_registrar_demo" : "usr_branch_demo",
          activeRole: role,
          roles: [role],
        },
        client
      );
      const getState = vi.fn(deps.getState);
      const getCourseMappings = vi.fn(deps.getCourseMappings);
      const routes = captureRoutes({ ...deps, getState, getCourseMappings });
      const { response, result } = responseRecorder();

      await routes.get("/api/integrations/moodle/projections/courses")!(
        request(),
        response
      );

      expect(result.status).toBe(403);
      expect(getState).not.toHaveBeenCalled();
      expect(getCourseMappings).not.toHaveBeenCalled();
      expect(client.getCourses).not.toHaveBeenCalled();
    }
  );

  it("returns only the signed-in learner's released grade and feedback", async () => {
    const studentSession: ServerSession = {
      ...baseSession,
      userId: normalizedLearnerId,
    };
    const context = {
      connectionId,
      activeRole: "student" as const,
      audience: "learner" as const,
      internalCourseId: normalizedCourseId,
      internalCourseRunId: normalizedCourseRunId,
      internalClassGroupId: normalizedClassGroupId,
      gradeItemProjectionId: normalizedGradeItemProjectionId,
      authorizedUserIds: [studentSession.userId],
      courseMappingStatus: "exact" as const,
      groupMappingStatus: "exact" as const,
      userMappingStatus: "exact" as const,
      gradeItemMappingStatus: "exact" as const,
      observedAt: "2026-07-17T01:00:00.000Z",
    };
    const projection = {
      internalCourseId: normalizedCourseId,
      internalClassGroupId: normalizedClassGroupId,
      gradeItemProjectionId: normalizedGradeItemProjectionId,
      providerState: "available" as const,
      mappingStatus: "exact" as const,
      learners: [
        {
          internalUserId: studentSession.userId,
          internalEnrollmentId: normalizedEnrollmentId,
          internalMembershipId: normalizedMembershipId,
          gradingState: "released" as const,
          score: 18,
          maximumScore: 20,
          gradedAt: "2026-07-17T01:00:00.000Z",
          releasedAt: "2026-07-17T01:05:00.000Z",
          feedback: "Accurate work with clear reasoning.",
        },
      ],
    };
    const repository = normalizedRepository({
      gradeOutcomeContext: context,
      gradeOutcomeFreshness: {
        context,
        freshnessState: "fresh",
        latestOutcome: "available",
        projection,
        successfulObservedAt: "2026-07-17T01:05:00.000Z",
        freshUntil: "2026-07-17T01:20:00.000Z",
        retainUntil: "2026-07-24T01:05:00.000Z",
      },
    });
    const client = fakeClient();
    const routes = captureRoutes({
      getSession: async () => studentSession,
      getClient: () => client,
      getProjectionRepository: () => repository,
      now: () => new Date("2026-07-17T01:10:00.000Z"),
    });
    const { response, result, headers } = responseRecorder();
    await routes.get(
      "/api/integrations/moodle/projections/classes/:classGroupId/grade-items/:gradeItemProjectionId/outcomes"
    )!(
      request({
        classGroupId: normalizedClassGroupId,
        gradeItemProjectionId: normalizedGradeItemProjectionId,
      }),
      response
    );
    expect(result).toMatchObject({
      status: 200,
      body: {
        mode: "read_only",
        activeRole: "student",
        audience: "learner",
        gradeItemProjectionId: normalizedGradeItemProjectionId,
        projection: {
          learners: [
            {
              internalUserId: studentSession.userId,
              gradingState: "released",
              feedback: "Accurate work with clear reasoning.",
            },
          ],
        },
      },
    });
    expect(JSON.stringify(result.body)).not.toMatch(
      /question|answer|moodleId|externalId/i
    );
    expect(headers.get("cache-control")).toBe("private, no-store");
    expect(client.probe).not.toHaveBeenCalled();
    expect(client.call).not.toHaveBeenCalled();
  });

  it("returns only the signed-in learner's bounded activity outcome", async () => {
    const studentSession: ServerSession = {
      ...baseSession,
      userId: normalizedLearnerId,
    };
    const context = {
      connectionId,
      activeRole: "student" as const,
      audience: "learner" as const,
      internalCourseId: normalizedCourseId,
      internalCourseRunId: normalizedCourseRunId,
      internalClassGroupId: normalizedClassGroupId,
      activityProjectionId: normalizedActivityProjectionId,
      activityKind: "h5p" as const,
      authorizedUserIds: [studentSession.userId],
      courseMappingStatus: "exact" as const,
      groupMappingStatus: "exact" as const,
      userMappingStatus: "exact" as const,
      activityMappingStatus: "exact" as const,
      observedAt: "2026-07-17T01:00:00.000Z",
    };
    const projection = {
      internalCourseId: normalizedCourseId,
      internalClassGroupId: normalizedClassGroupId,
      activityProjectionId: normalizedActivityProjectionId,
      activityKind: "h5p" as const,
      providerState: "available" as const,
      mappingStatus: "exact" as const,
      learners: [
        {
          internalUserId: studentSession.userId,
          internalEnrollmentId: normalizedEnrollmentId,
          internalMembershipId: normalizedMembershipId,
          completionState: "passed" as const,
          scoreState: "released" as const,
          completedAt: "2026-07-17T01:00:00.000Z",
          score: 9,
          maximumScore: 10,
          releasedAt: "2026-07-17T01:05:00.000Z",
        },
      ],
    };
    const repository = normalizedRepository({
      activityOutcomeContext: context,
      activityOutcomeFreshness: {
        context,
        freshnessState: "fresh",
        latestOutcome: "available",
        projection,
        successfulObservedAt: "2026-07-17T01:05:00.000Z",
        freshUntil: "2026-07-17T01:20:00.000Z",
        retainUntil: "2026-07-24T01:05:00.000Z",
      },
    });
    const client = fakeClient();
    const routes = captureRoutes({
      getSession: async () => studentSession,
      getClient: () => client,
      getProjectionRepository: () => repository,
      now: () => new Date("2026-07-17T01:10:00.000Z"),
    });
    const { response, result, headers } = responseRecorder();
    await routes.get(
      "/api/integrations/moodle/projections/classes/:classGroupId/activities/:activityProjectionId/outcomes"
    )!(
      request({
        classGroupId: normalizedClassGroupId,
        activityProjectionId: normalizedActivityProjectionId,
      }),
      response
    );
    expect(result).toMatchObject({
      status: 200,
      body: {
        mode: "read_only",
        activeRole: "student",
        audience: "learner",
        activityProjectionId: normalizedActivityProjectionId,
        activityKind: "h5p",
        projection: {
          learners: [
            {
              internalUserId: studentSession.userId,
              completionState: "passed",
              scoreState: "released",
              score: 9,
            },
          ],
        },
      },
    });
    expect(JSON.stringify(result.body)).not.toMatch(
      /track|interaction|question|answer|moodleId|externalId/i
    );
    expect(headers.get("cache-control")).toBe("private, no-store");
    expect(client.probe).not.toHaveBeenCalled();
    expect(client.call).not.toHaveBeenCalled();
  });

  it("ignores compatibility readers for a normalized session", async () => {
    const client = fakeClient();
    const compatibilityDeps = dependencies(compatibilitySession, client);
    const getState = vi.fn(compatibilityDeps.getState);
    const getCourseMappings = vi.fn(compatibilityDeps.getCourseMappings);
    const repository = normalizedRepository({
      observations: [retainedObservation("course_catalog", catalogPayload)],
    });
    const routes = captureRoutes({
      ...compatibilityDeps,
      getSession: async () => baseSession,
      getState,
      getCourseMappings,
      getProjectionRepository: () => repository,
      now: () => new Date("2026-07-17T02:30:00.000Z"),
    });
    const { response, result } = responseRecorder();

    await routes.get("/api/integrations/moodle/projections/courses")!(
      request(),
      response
    );

    expect(result.status).toBe(200);
    expect(getState).not.toHaveBeenCalled();
    expect(getCourseMappings).not.toHaveBeenCalled();
    expect(repository.listProjectionObservations).toHaveBeenCalledOnce();
    expect(client.probe).not.toHaveBeenCalled();
    expect(client.getCourses).not.toHaveBeenCalled();
  });

  it("projects only canonically enrolled courses for the student", async () => {
    const routes = captureRoutes(dependencies(compatibilitySession));
    const { response, result } = responseRecorder();

    await routes.get("/api/integrations/moodle/projections/courses")!(
      request(),
      response
    );

    expect(result.status).toBe(200);
    const body = result.body as {
      rows: Array<{
        internalCourseId?: string;
        mappingState: string;
        course?: { sourceId: string; title: string };
      }>;
    };
    expect(body).toMatchObject({
      mode: "read_only",
      authority: "server_course_relationships",
    });
    expect(body.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          internalCourseId: "course_ar_l3",
          mappingState: "synced",
          course: expect.objectContaining({
            sourceId: "42",
            title: "Arabic Foundations",
          }),
        }),
      ])
    );
    expect(body.rows.every(row => row.internalCourseId !== undefined)).toBe(
      true
    );
    expect(JSON.stringify(body)).not.toContain("must not be projected");
    expect(JSON.stringify(body)).not.toContain("99");
  });

  it("shows unmatched provider courses only in the Super Admin projection", async () => {
    const routes = captureRoutes(
      dependencies({
        ...compatibilitySession,
        id: "session-admin",
        userId: "usr_admin_demo",
        activeRole: "superadmin",
        roles: ["superadmin"],
      })
    );
    const { response, result } = responseRecorder();

    await routes.get("/api/integrations/moodle/projections/courses")!(
      request(),
      response
    );

    expect(result.status).toBe(200);
    const body = result.body as {
      rows: Array<{
        mappingState: string;
        reconciliationReason?: string;
        course?: { sourceId: string };
      }>;
    };
    expect(body.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          mappingState: "unmatched",
          reconciliationReason: "missing_mapping",
          course: expect.objectContaining({ sourceId: "99" }),
        }),
      ])
    );
  });

  it("denies unrelated course content before calling Moodle", async () => {
    const client = fakeClient();
    const routes = captureRoutes(dependencies(compatibilitySession, client));
    const { response, result } = responseRecorder();

    await routes.get(
      "/api/integrations/moodle/projections/courses/:courseId/content"
    )!(request({ courseId: "course_quran_tajweed" }), response);

    expect(result).toEqual({
      status: 403,
      body: { error: "Moodle course access denied." },
    });
    expect(client.getCourseContents).not.toHaveBeenCalled();
  });

  it("returns sanitized content through an exact mapping", async () => {
    const client = fakeClient();
    const routes = captureRoutes(dependencies(compatibilitySession, client));
    const { response, result } = responseRecorder();

    await routes.get(
      "/api/integrations/moodle/projections/courses/:courseId/content"
    )!(request({ courseId: "course_ar_l3" }), response);

    expect(result.status).toBe(200);
    expect(client.getCourseContents).toHaveBeenCalledWith(42);
    expect(result.body).toMatchObject({
      mode: "read_only",
      projection: {
        internalCourseId: "course_ar_l3",
        externalCourseId: "42",
        sections: [
          {
            sourceId: "7",
            activities: [{ sourceId: "81", title: "Welcome" }],
          },
        ],
      },
    });
    expect(JSON.stringify(result.body)).not.toContain("private section text");
    expect(JSON.stringify(result.body)).not.toContain("private.example.test");
  });

  it("fails closed when an authorized course is not mapped", async () => {
    const deps = dependencies(compatibilitySession);
    const routes = captureRoutes({
      ...deps,
      getCourseMappings: async () => [],
    });
    const { response, result } = responseRecorder();

    await routes.get(
      "/api/integrations/moodle/projections/courses/:courseId/content"
    )!(request({ courseId: "course_ar_l3" }), response);

    expect(result).toEqual({
      status: 409,
      body: { error: "Moodle course mapping needs review." },
    });
  });

  it("rejects a malformed mapping before requesting course content", async () => {
    const client = fakeClient();
    const deps = dependencies(compatibilitySession, client);
    const routes = captureRoutes({
      ...deps,
      getCourseMappings: async () => [
        {
          internalCourseId: "course_ar_l3",
          externalCourseId: "not-a-moodle-id",
          state: "matched" as const,
        },
      ],
    });
    const { response, result } = responseRecorder();

    await routes.get(
      "/api/integrations/moodle/projections/courses/:courseId/content"
    )!(request({ courseId: "course_ar_l3" }), response);

    expect(result).toEqual({
      status: 409,
      body: { error: "Moodle course mapping needs review." },
    });
    expect(client.getCourseContents).not.toHaveBeenCalled();
  });

  it("rejects malformed list mappings before requesting the catalog", async () => {
    const client = fakeClient();
    const deps = dependencies(compatibilitySession, client);
    const routes = captureRoutes({
      ...deps,
      getCourseMappings: async () => [
        {
          internalCourseId: "course_ar_l3",
          externalCourseId: "9007199254740992",
          state: "matched" as const,
        },
      ],
    });
    const { response, result } = responseRecorder();

    await routes.get("/api/integrations/moodle/projections/courses")!(
      request(),
      response
    );

    expect(result.status).toBe(409);
    expect(client.probe).not.toHaveBeenCalled();
    expect(client.getCourses).not.toHaveBeenCalled();
  });

  it("fails closed when minimum-privilege evidence is degraded", async () => {
    const client = fakeClient();
    client.probe = vi.fn(async () => ({ minimumPrivilegeVerified: false }));
    const routes = captureRoutes(dependencies(compatibilitySession, client));
    const { response, result } = responseRecorder();

    await routes.get("/api/integrations/moodle/projections/courses")!(
      request(),
      response
    );

    expect(result).toMatchObject({
      status: 503,
      body: { code: "permission" },
    });
    expect(client.getCourses).not.toHaveBeenCalled();
  });

  it("uses a fresh normalized catalog observation without contacting Moodle", async () => {
    const client = fakeClient();
    const repository = normalizedRepository({
      observations: [retainedObservation("course_catalog", catalogPayload)],
    });
    const routes = captureRoutes({
      getSession: async () => baseSession,
      getClient: () => client,
      getStatus: () => ({ ...configuredStatus, configured: false }),
      getProjectionRepository: () => repository,
      now: () => new Date("2026-07-17T02:30:00.000Z"),
    });
    const { response, result } = responseRecorder();

    await routes.get("/api/integrations/moodle/projections/courses")!(
      request(),
      response
    );

    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({
      authority: "server_course_relationships",
      authorityObservedAt: "2026-07-17T01:00:00.000Z",
      availability: "available",
      freshness: "fresh",
      rows: [
        expect.objectContaining({
          internalCourseId: "course_ar_l3",
          mappingState: "synced",
          course: expect.objectContaining({ sourceId: "42" }),
        }),
      ],
    });
    expect(repository.resolveCourseAuthority).toHaveBeenCalledWith(baseSession);
    expect(repository.listCourseMappings).toHaveBeenCalledWith(connectionId, [
      "course_ar_l3",
    ]);
    expect(repository.listProjectionObservations).toHaveBeenCalledWith({
      session: baseSession,
      authority: expect.objectContaining({ connectionId }),
      projectionFamily: "course_catalog",
      asOf: "2026-07-17T02:30:00.000Z",
    });
    expect(client.probe).not.toHaveBeenCalled();
    expect(client.getCourses).not.toHaveBeenCalled();
    expect(repository.listProjectionObservations).toHaveBeenCalledWith(
      expect.not.objectContaining({ internalCourseIds: expect.anything() })
    );
  });

  it("uses the configured runtime repository when routes provide no repository callbacks", async () => {
    const client = fakeClient();
    const repository = normalizedRepository({
      observations: [retainedObservation("course_catalog", catalogPayload)],
    });
    const restore = setMoodleProjectionRepository(repository);
    try {
      const routes = captureRoutes({
        getSession: async () => baseSession,
        getClient: () => client,
        getStatus: () => ({ ...configuredStatus, configured: false }),
        now: () => new Date("2026-07-17T02:30:00.000Z"),
      });
      const { response, result } = responseRecorder();

      await routes.get("/api/integrations/moodle/projections/courses")!(
        request(),
        response
      );

      expect(result).toMatchObject({
        status: 200,
        body: {
          authorityObservedAt: "2026-07-17T01:00:00.000Z",
        },
      });
      expect(client.getCourses).not.toHaveBeenCalled();
    } finally {
      restore();
    }
  });

  it("returns retained catalog data as stale after the latest provider outage", async () => {
    const client = fakeClient();
    const repository = normalizedRepository({
      observations: [
        retainedObservation("course_catalog", catalogPayload, {
          latestOutcome: "unavailable",
          lastAttemptedAt: "2026-07-17T04:00:00.000Z",
        }),
      ],
    });
    const routes = captureRoutes({
      getSession: async () => baseSession,
      getClient: () => client,
      getProjectionRepository: () => repository,
      now: () => new Date("2026-07-17T04:30:00.000Z"),
    });
    const { response, result } = responseRecorder();

    await routes.get("/api/integrations/moodle/projections/courses")!(
      request(),
      response
    );

    expect(result).toMatchObject({
      status: 200,
      body: {
        availability: "unavailable",
        freshness: "stale",
        rows: [
          expect.objectContaining({
            internalCourseId: "course_ar_l3",
            course: expect.objectContaining({ sourceId: "42" }),
          }),
        ],
      },
    });
    expect(client.getCourses).not.toHaveBeenCalled();
  });

  it("keeps available catalog rows when another authorized observation is missing", async () => {
    const client = fakeClient();
    const repository = normalizedRepository({
      authorizedCourseIds: ["course_ar_l3", "course_quran_tajweed"],
      observations: [retainedObservation("course_catalog", catalogPayload)],
    });
    repository.listCourseMappings = vi.fn(async () => [
      ...mappings,
      {
        internalCourseId: "course_quran_tajweed",
        externalCourseId: "77",
        state: "synced" as const,
      },
    ]);
    const routes = captureRoutes({
      getSession: async () => baseSession,
      getClient: () => client,
      getProjectionRepository: () => repository,
      now: () => new Date("2026-07-17T02:30:00.000Z"),
    });
    const { response, result } = responseRecorder();

    await routes.get("/api/integrations/moodle/projections/courses")!(
      request(),
      response
    );

    expect(result).toMatchObject({
      status: 200,
      body: {
        availability: "unavailable",
        observations: [
          expect.objectContaining({
            internalCourseId: "course_ar_l3",
            availability: "available",
          }),
          expect.objectContaining({
            internalCourseId: "course_quran_tajweed",
            availability: "unavailable",
          }),
        ],
        rows: [
          expect.objectContaining({ internalCourseId: "course_ar_l3" }),
          expect.objectContaining({
            internalCourseId: "course_quran_tajweed",
            mappingState: "missing",
            reconciliationReason: "missing_provider_record",
          }),
        ],
      },
    });
    expect(client.getCourses).not.toHaveBeenCalled();
  });

  it("fails closed when the normalized catalog snapshot is absent or expired", async () => {
    for (const observations of [
      [],
      [
        retainedObservation("course_catalog", catalogPayload, {
          retainUntil: "2026-07-17T02:00:00.000Z",
        }),
      ],
    ]) {
      const client = fakeClient();
      const routes = captureRoutes({
        getSession: async () => baseSession,
        getClient: () => client,
        getProjectionRepository: () => normalizedRepository({ observations }),
        now: () => new Date("2026-07-17T04:30:00.000Z"),
      });
      const { response, result } = responseRecorder();
      await routes.get("/api/integrations/moodle/projections/courses")!(
        request(),
        response
      );
      expect(result).toEqual({
        status: 503,
        body: {
          error: "Stored Moodle projection is temporarily unavailable.",
        },
      });
      expect(client.getCourses).not.toHaveBeenCalled();
    }
  });

  it("projects normalized course content from the retained observation only", async () => {
    const client = fakeClient();
    const repository = normalizedRepository({
      observations: [retainedObservation("course_content", contentPayload)],
    });
    const routes = captureRoutes({
      getSession: async () => baseSession,
      getClient: () => client,
      getProjectionRepository: () => repository,
      now: () => new Date("2026-07-17T02:30:00.000Z"),
    });
    const { response, result, headers } = responseRecorder();

    await routes.get(
      "/api/integrations/moodle/projections/courses/:courseId/content"
    )!(request({ courseId: "course_ar_l3" }), response);

    expect(result).toMatchObject({
      status: 200,
      body: {
        availability: "available",
        freshness: "fresh",
        latestOutcome: "available",
        lastAttemptedAt: "2026-07-17T02:00:00.000Z",
        projection: {
          internalCourseId: "course_ar_l3",
          externalCourseId: "42",
          sections: [
            expect.objectContaining({
              sourceId: "7",
              activities: [expect.objectContaining({ sourceId: "81" })],
            }),
          ],
        },
      },
    });
    expect(repository.listProjectionObservations).toHaveBeenCalledWith(
      expect.objectContaining({
        projectionFamily: "course_content",
        internalCourseIds: ["course_ar_l3"],
      })
    );
    expect(headers.get("cache-control")).toBe("private, no-store");
    expect(headers.get("vary")).toBe("Cookie");
    expect(client.probe).not.toHaveBeenCalled();
    expect(client.getCourseContents).not.toHaveBeenCalled();
  });

  it("returns retained content with latest attempt and reconciliation metadata", async () => {
    const repository = normalizedRepository({
      observations: [
        retainedObservation("course_content", contentPayload, {
          latestOutcome: "unavailable",
          lastAttemptedAt: "2026-07-17T04:00:00.000Z",
          reconciliationReason: "missing_provider_record",
        }),
      ],
    });
    const routes = captureRoutes({
      getSession: async () => baseSession,
      getProjectionRepository: () => repository,
      now: () => new Date("2026-07-17T04:30:00.000Z"),
    });
    const { response, result } = responseRecorder();

    await routes.get(
      "/api/integrations/moodle/projections/courses/:courseId/content"
    )!(request({ courseId: "course_ar_l3" }), response);

    expect(result).toMatchObject({
      status: 200,
      body: {
        availability: "unavailable",
        freshness: "stale",
        latestOutcome: "unavailable",
        lastAttemptedAt: "2026-07-17T04:00:00.000Z",
        reconciliationReason: "missing_provider_record",
        projection: { internalCourseId: "course_ar_l3" },
      },
    });
  });

  it("rejects observation mapping drift and revoked course authority before projection", async () => {
    const driftClient = fakeClient();
    const driftRoutes = captureRoutes({
      getSession: async () => baseSession,
      getClient: () => driftClient,
      getProjectionRepository: () =>
        normalizedRepository({
          observations: [
            retainedObservation("course_content", contentPayload, {
              externalCourseId: "99",
            }),
          ],
        }),
      now: () => new Date("2026-07-17T02:30:00.000Z"),
    });
    const driftResult = responseRecorder();
    await driftRoutes.get(
      "/api/integrations/moodle/projections/courses/:courseId/content"
    )!(request({ courseId: "course_ar_l3" }), driftResult.response);
    expect(driftResult.result.status).toBe(503);
    expect(driftClient.getCourseContents).not.toHaveBeenCalled();

    const revokedClient = fakeClient();
    const revokedRepository = normalizedRepository({
      authorizedCourseIds: [],
      observations: [retainedObservation("course_content", contentPayload)],
    });
    const revokedRoutes = captureRoutes({
      getSession: async () => baseSession,
      getClient: () => revokedClient,
      getProjectionRepository: () => revokedRepository,
    });
    const revokedResult = responseRecorder();
    await revokedRoutes.get(
      "/api/integrations/moodle/projections/courses/:courseId/content"
    )!(request({ courseId: "course_ar_l3" }), revokedResult.response);
    expect(revokedResult.result.status).toBe(403);
    expect(revokedRepository.listProjectionObservations).not.toHaveBeenCalled();
    expect(revokedClient.getCourseContents).not.toHaveBeenCalled();
  });

  it("fails closed when normalized projection repositories are unavailable", async () => {
    const client = fakeClient();
    const routes = captureRoutes({
      getSession: async () => baseSession,
      getClient: () => client,
      getStatus: () => configuredStatus,
    });
    const { response, result } = responseRecorder();

    await routes.get("/api/integrations/moodle/projections/courses")!(
      request(),
      response
    );

    expect(result).toEqual({
      status: 503,
      body: {
        error: "Moodle projection repository is temporarily unavailable.",
      },
    });
    expect(client.probe).not.toHaveBeenCalled();
    expect(client.getCourses).not.toHaveBeenCalled();
  });

  it("returns an exact-class teacher enrollment projection without calling Moodle", async () => {
    const teacherSession: ServerSession = {
      ...baseSession,
      userId: "56000000-0000-4000-8000-000000000001",
      activeRoleGrantId: "57000000-0000-4000-8000-000000000001",
      roles: ["teacher"],
      activeRole: "teacher",
    };
    const context = {
      connectionId,
      activeRole: "teacher" as const,
      audience: "person_level" as const,
      internalCourseId: normalizedCourseId,
      internalCourseRunId: normalizedCourseRunId,
      internalClassGroupId: normalizedClassGroupId,
      authorizedUserIds: [normalizedLearnerId],
      courseMappingStatus: "exact" as const,
      groupMappingStatus: "exact" as const,
      userMappingStatus: "exact" as const,
      observedAt: "2026-07-17T01:00:00.000Z",
    };
    const projection = {
      internalCourseId: normalizedCourseId,
      internalClassGroupId: normalizedClassGroupId,
      providerState: "available" as const,
      mappingStatus: "exact" as const,
      learners: [
        {
          internalUserId: normalizedLearnerId,
          internalEnrollmentId: normalizedEnrollmentId,
          internalMembershipId: normalizedMembershipId,
          providerState: "enrolled" as const,
          mappingStatus: "exact" as const,
        },
      ],
    };
    const repository = normalizedRepository({
      enrollmentContext: context,
      enrollmentFreshness: {
        context,
        freshnessState: "fresh",
        latestOutcome: "available",
        projection,
        successfulObservedAt: "2026-07-17T01:05:00.000Z",
        freshUntil: "2026-07-17T01:20:00.000Z",
        retainUntil: "2026-07-24T01:05:00.000Z",
      },
    });
    const client = fakeClient();
    const routes = captureRoutes({
      getSession: async () => teacherSession,
      getClient: () => client,
      getProjectionRepository: () => repository,
      now: () => new Date("2026-07-17T01:10:00.000Z"),
    });
    const { response, result, headers } = responseRecorder();

    await routes.get(
      "/api/integrations/moodle/projections/classes/:classGroupId/enrollment-groups"
    )!(request({ classGroupId: normalizedClassGroupId }), response);

    expect(result).toMatchObject({
      status: 200,
      body: {
        mode: "read_only",
        authority: "server_class_relationships",
        activeRole: "teacher",
        audience: "person_level",
        availability: "available",
        freshness: "fresh",
        projection: {
          internalClassGroupId: normalizedClassGroupId,
          learners: [{ internalUserId: normalizedLearnerId }],
        },
      },
    });
    expect(repository.resolveEnrollmentGroupContext).toHaveBeenCalledWith(
      teacherSession,
      normalizedClassGroupId
    );
    expect(headers.get("cache-control")).toBe("private, no-store");
    expect(headers.get("vary")).toBe("Cookie");
    expect(client.probe).not.toHaveBeenCalled();
    expect(client.call).not.toHaveBeenCalled();
  });

  it("rejects enrollment projection requests before repository access", async () => {
    const repository = normalizedRepository({});
    const unauthenticatedRoutes = captureRoutes({
      getSession: async () => null,
      getProjectionRepository: () => repository,
    });
    const unauthenticated = responseRecorder();
    await unauthenticatedRoutes.get(
      "/api/integrations/moodle/projections/classes/:classGroupId/enrollment-groups"
    )!(
      request({ classGroupId: normalizedClassGroupId }),
      unauthenticated.response
    );
    expect(unauthenticated.result.status).toBe(401);

    const teacherSession: ServerSession = {
      ...baseSession,
      roles: ["teacher"],
      activeRole: "teacher",
    };
    const malformedRoutes = captureRoutes({
      getSession: async () => teacherSession,
      getProjectionRepository: () => repository,
    });
    const malformed = responseRecorder();
    await malformedRoutes.get(
      "/api/integrations/moodle/projections/classes/:classGroupId/enrollment-groups"
    )!(request({ classGroupId: "not-a-uuid" }), malformed.response);
    expect(malformed.result).toEqual({
      status: 400,
      body: { error: "Valid class group ID is required." },
    });
    expect(repository.resolveEnrollmentGroupContext).not.toHaveBeenCalled();
  });

  it("returns aggregate-only HOD enrollment projection and denies students", async () => {
    const hodSession: ServerSession = {
      ...baseSession,
      roles: ["headofdepartment"],
      activeRole: "headofdepartment",
    };
    const context = {
      connectionId,
      activeRole: "headofdepartment" as const,
      audience: "aggregate" as const,
      internalCourseId: normalizedCourseId,
      internalCourseRunId: normalizedCourseRunId,
      internalClassGroupId: normalizedClassGroupId,
      authorizedUserIds: [],
      courseMappingStatus: "exact" as const,
      groupMappingStatus: "exact" as const,
      userMappingStatus: "exact" as const,
      observedAt: "2026-07-17T01:00:00.000Z",
    };
    const repository = normalizedRepository({
      enrollmentContext: context,
      enrollmentFreshness: {
        context,
        freshnessState: "fresh",
        latestOutcome: "available",
        projection: {
          internalCourseId: normalizedCourseId,
          internalClassGroupId: normalizedClassGroupId,
          providerState: "available",
          mappingStatus: "exact",
          learnerCount: 4,
          mappedLearnerCount: 3,
          unmappedLearnerCount: 1,
        },
      },
    });
    const routes = captureRoutes({
      getSession: async () => hodSession,
      getProjectionRepository: () => repository,
    });
    const hodResult = responseRecorder();
    await routes.get(
      "/api/integrations/moodle/projections/classes/:classGroupId/enrollment-groups"
    )!(request({ classGroupId: normalizedClassGroupId }), hodResult.response);
    expect(hodResult.result).toMatchObject({
      status: 200,
      body: {
        audience: "aggregate",
        projection: { learnerCount: 4, mappedLearnerCount: 3 },
      },
    });
    expect(JSON.stringify(hodResult.result.body)).not.toContain("learners");

    const deniedRepository = normalizedRepository({});
    const deniedRoutes = captureRoutes({
      getSession: async () => baseSession,
      getProjectionRepository: () => deniedRepository,
    });
    const deniedResult = responseRecorder();
    await deniedRoutes.get(
      "/api/integrations/moodle/projections/classes/:classGroupId/enrollment-groups"
    )!(
      request({ classGroupId: normalizedClassGroupId }),
      deniedResult.response
    );
    expect(deniedResult.result.status).toBe(403);
    expect(
      deniedRepository.resolveEnrollmentGroupContext
    ).not.toHaveBeenCalled();
  });

  it("returns a student assessment-status snapshot without contacting Moodle", async () => {
    const context = {
      connectionId,
      activeRole: "student" as const,
      audience: "learner" as const,
      internalCourseId: normalizedCourseId,
      internalCourseRunId: normalizedCourseRunId,
      internalClassGroupId: normalizedClassGroupId,
      subjectUserId: baseSession.userId,
      courseMappingStatus: "exact" as const,
      groupMappingStatus: "exact" as const,
      userMappingStatus: "exact" as const,
      assessmentMappingStatus: "exact" as const,
      observedAt: "2026-07-17T01:00:00.000Z",
    };
    const projection = {
      internalCourseId: normalizedCourseId,
      internalClassGroupId: normalizedClassGroupId,
      providerState: "available" as const,
      mappingStatus: "exact" as const,
      items: [
        {
          projectionId: "90000000-0000-4000-8000-000000000001",
          kind: "assignment" as const,
          title: "Writing practice",
          visibility: "visible" as const,
          scheduleState: "open" as const,
          dueAt: "2026-07-20T01:00:00.000Z",
        },
      ],
    };
    const repository = normalizedRepository({
      assessmentContext: context,
      assessmentFreshness: {
        context,
        freshnessState: "fresh",
        latestOutcome: "available",
        projection,
        successfulObservedAt: "2026-07-17T01:05:00.000Z",
        freshUntil: "2026-07-17T01:20:00.000Z",
        retainUntil: "2026-07-24T01:05:00.000Z",
      },
    });
    const client = fakeClient();
    const routes = captureRoutes({
      getSession: async () => baseSession,
      getClient: () => client,
      getProjectionRepository: () => repository,
      now: () => new Date("2026-07-17T01:10:00.000Z"),
    });
    const { response, result, headers } = responseRecorder();

    await routes.get(
      "/api/integrations/moodle/projections/classes/:classGroupId/assessment-status"
    )!(request({ classGroupId: normalizedClassGroupId }), response);

    expect(result).toMatchObject({
      status: 200,
      body: {
        mode: "read_only",
        authority: "server_class_relationships",
        activeRole: "student",
        audience: "learner",
        availability: "available",
        freshness: "fresh",
        internalClassGroupId: normalizedClassGroupId,
        projection: { items: [{ kind: "assignment", scheduleState: "open" }] },
      },
    });
    expect(repository.resolveAssessmentStatusContext).toHaveBeenCalledWith(
      baseSession,
      normalizedClassGroupId
    );
    expect(headers.get("cache-control")).toBe("private, no-store");
    expect(headers.get("vary")).toBe("Cookie");
    expect(client.probe).not.toHaveBeenCalled();
    expect(client.call).not.toHaveBeenCalled();
  });

  it("denies unrelated roles and malformed assessment-status requests before repository access", async () => {
    const repository = normalizedRepository({});
    const registrarSession: ServerSession = {
      ...baseSession,
      roles: ["registrar"],
      activeRole: "registrar",
    };
    const deniedRoutes = captureRoutes({
      getSession: async () => registrarSession,
      getProjectionRepository: () => repository,
    });
    const denied = responseRecorder();
    await deniedRoutes.get(
      "/api/integrations/moodle/projections/classes/:classGroupId/assessment-status"
    )!(request({ classGroupId: normalizedClassGroupId }), denied.response);
    expect(denied.result.status).toBe(403);

    const malformedRoutes = captureRoutes({
      getSession: async () => baseSession,
      getProjectionRepository: () => repository,
    });
    const malformed = responseRecorder();
    await malformedRoutes.get(
      "/api/integrations/moodle/projections/classes/:classGroupId/assessment-status"
    )!(request({ classGroupId: "not-a-uuid" }), malformed.response);
    expect(malformed.result).toEqual({
      status: 400,
      body: { error: "Valid class group ID is required." },
    });
    expect(repository.resolveAssessmentStatusContext).not.toHaveBeenCalled();
  });

  it("returns only the signed-in student's assignment result without contacting Moodle", async () => {
    const studentSession: ServerSession = {
      ...baseSession,
      userId: normalizedLearnerId,
    };
    const context = {
      connectionId,
      activeRole: "student" as const,
      audience: "learner" as const,
      internalCourseId: normalizedCourseId,
      internalCourseRunId: normalizedCourseRunId,
      internalClassGroupId: normalizedClassGroupId,
      assignmentProjectionId: normalizedAssignmentProjectionId,
      authorizedUserIds: [studentSession.userId],
      courseMappingStatus: "exact" as const,
      groupMappingStatus: "exact" as const,
      userMappingStatus: "exact" as const,
      assignmentMappingStatus: "exact" as const,
      observedAt: "2026-07-17T01:00:00.000Z",
    };
    const projection = {
      internalCourseId: normalizedCourseId,
      internalClassGroupId: normalizedClassGroupId,
      assignmentProjectionId: normalizedAssignmentProjectionId,
      providerState: "available" as const,
      mappingStatus: "exact" as const,
      learners: [
        {
          internalUserId: studentSession.userId,
          internalEnrollmentId: normalizedEnrollmentId,
          internalMembershipId: normalizedMembershipId,
          submissionState: "submitted" as const,
          attemptNumber: 1,
          gradingState: "graded" as const,
          latest: true,
          score: 86,
          maximumScore: 100,
        },
      ],
    };
    const repository = normalizedRepository({
      assignmentResultContext: context,
      assignmentResultFreshness: {
        context,
        freshnessState: "fresh",
        latestOutcome: "available",
        projection,
        successfulObservedAt: "2026-07-17T01:05:00.000Z",
        freshUntil: "2026-07-17T01:20:00.000Z",
        retainUntil: "2026-07-24T01:05:00.000Z",
      },
    });
    const client = fakeClient();
    const routes = captureRoutes({
      getSession: async () => studentSession,
      getClient: () => client,
      getProjectionRepository: () => repository,
      now: () => new Date("2026-07-17T01:10:00.000Z"),
    });
    const { response, result, headers } = responseRecorder();

    await routes.get(
      "/api/integrations/moodle/projections/classes/:classGroupId/assignments/:assignmentProjectionId/outcomes"
    )!(
      request({
        classGroupId: normalizedClassGroupId,
        assignmentProjectionId: normalizedAssignmentProjectionId,
      }),
      response
    );

    expect(result).toMatchObject({
      status: 200,
      body: {
        mode: "read_only",
        authority: "server_class_relationships",
        activeRole: "student",
        audience: "learner",
        availability: "available",
        freshness: "fresh",
        internalClassGroupId: normalizedClassGroupId,
        assignmentProjectionId: normalizedAssignmentProjectionId,
        projection: {
          learners: [
            {
              internalUserId: studentSession.userId,
              submissionState: "submitted",
              gradingState: "graded",
            },
          ],
        },
      },
    });
    expect(repository.resolveAssignmentResultContext).toHaveBeenCalledWith(
      studentSession,
      normalizedClassGroupId,
      normalizedAssignmentProjectionId
    );
    expect(headers.get("cache-control")).toBe("private, no-store");
    expect(headers.get("vary")).toBe("Cookie");
    expect(client.probe).not.toHaveBeenCalled();
    expect(client.call).not.toHaveBeenCalled();
  });

  it("returns person-level results only for a teacher's exact assigned class", async () => {
    const teacherSession: ServerSession = {
      ...baseSession,
      userId: "57000000-0000-4000-8000-000000000001",
      activeRoleGrantId: "58000000-0000-4000-8000-000000000001",
      roles: ["teacher"],
      activeRole: "teacher",
    };
    const context = {
      connectionId,
      activeRole: "teacher" as const,
      audience: "person_level" as const,
      internalCourseId: normalizedCourseId,
      internalCourseRunId: normalizedCourseRunId,
      internalClassGroupId: normalizedClassGroupId,
      assignmentProjectionId: normalizedAssignmentProjectionId,
      authorizedUserIds: [normalizedLearnerId],
      courseMappingStatus: "exact" as const,
      groupMappingStatus: "exact" as const,
      userMappingStatus: "exact" as const,
      assignmentMappingStatus: "exact" as const,
      observedAt: "2026-07-17T01:00:00.000Z",
    };
    const repository = normalizedRepository({
      assignmentResultContext: context,
      assignmentResultFreshness: {
        context,
        freshnessState: "fresh",
        latestOutcome: "available",
        projection: {
          internalCourseId: normalizedCourseId,
          internalClassGroupId: normalizedClassGroupId,
          assignmentProjectionId: normalizedAssignmentProjectionId,
          providerState: "available",
          mappingStatus: "exact",
          learners: [
            {
              internalUserId: normalizedLearnerId,
              internalEnrollmentId: normalizedEnrollmentId,
              internalMembershipId: normalizedMembershipId,
              submissionState: "draft",
              attemptNumber: 1,
              gradingState: "not_graded",
              latest: true,
            },
          ],
        },
      },
    });
    const client = fakeClient();
    const routes = captureRoutes({
      getSession: async () => teacherSession,
      getClient: () => client,
      getProjectionRepository: () => repository,
    });
    const result = responseRecorder();

    await routes.get(
      "/api/integrations/moodle/projections/classes/:classGroupId/assignments/:assignmentProjectionId/outcomes"
    )!(
      request({
        classGroupId: normalizedClassGroupId,
        assignmentProjectionId: normalizedAssignmentProjectionId,
      }),
      result.response
    );

    expect(result.result).toMatchObject({
      status: 200,
      body: {
        activeRole: "teacher",
        audience: "person_level",
        projection: { learners: [{ internalUserId: normalizedLearnerId }] },
      },
    });
    expect(client.probe).not.toHaveBeenCalled();
    expect(client.call).not.toHaveBeenCalled();
  });

  it.each(["headofdepartment", "superadmin"] as const)(
    "returns aggregate-only assignment results for %s",
    async activeRole => {
      const staffSession: ServerSession = {
        ...baseSession,
        roles: [activeRole],
        activeRole,
      };
      const context = {
        connectionId,
        activeRole,
        audience: "aggregate" as const,
        internalCourseId: normalizedCourseId,
        internalCourseRunId: normalizedCourseRunId,
        internalClassGroupId: normalizedClassGroupId,
        assignmentProjectionId: normalizedAssignmentProjectionId,
        authorizedUserIds: [],
        courseMappingStatus: "exact" as const,
        groupMappingStatus: "exact" as const,
        userMappingStatus: "exact" as const,
        assignmentMappingStatus: "exact" as const,
        observedAt: "2026-07-17T01:00:00.000Z",
      };
      const repository = normalizedRepository({
        assignmentResultContext: context,
        assignmentResultFreshness: {
          context,
          freshnessState: "fresh",
          latestOutcome: "available",
          projection: {
            internalCourseId: normalizedCourseId,
            internalClassGroupId: normalizedClassGroupId,
            assignmentProjectionId: normalizedAssignmentProjectionId,
            providerState: "available",
            mappingStatus: "exact",
            learnerCount: 5,
            submittedCount: 4,
            gradedCount: 3,
          },
        },
      });
      const routes = captureRoutes({
        getSession: async () => staffSession,
        getProjectionRepository: () => repository,
      });
      const result = responseRecorder();

      await routes.get(
        "/api/integrations/moodle/projections/classes/:classGroupId/assignments/:assignmentProjectionId/outcomes"
      )!(
        request({
          classGroupId: normalizedClassGroupId,
          assignmentProjectionId: normalizedAssignmentProjectionId,
        }),
        result.response
      );

      expect(result.result).toMatchObject({
        status: 200,
        body: {
          activeRole,
          audience: "aggregate",
          projection: {
            learnerCount: 5,
            submittedCount: 4,
            gradedCount: 3,
          },
        },
      });
      expect(JSON.stringify(result.result.body)).not.toContain("learners");
      expect(JSON.stringify(result.result.body)).not.toContain(
        "internalUserId"
      );
    }
  );

  it.each([
    [
      "registrar",
      { ...baseSession, roles: ["registrar"], activeRole: "registrar" },
    ],
    [
      "branch admin",
      { ...baseSession, roles: ["branchadmin"], activeRole: "branchadmin" },
    ],
    ["demo", compatibilitySession],
  ])(
    "denies %s assignment outcomes before repository access",
    async (_label, deniedSession) => {
      const repository = normalizedRepository({});
      const routes = captureRoutes({
        getSession: async () => deniedSession as ServerSession,
        getProjectionRepository: () => repository,
      });
      const result = responseRecorder();

      await routes.get(
        "/api/integrations/moodle/projections/classes/:classGroupId/assignments/:assignmentProjectionId/outcomes"
      )!(
        request({
          classGroupId: normalizedClassGroupId,
          assignmentProjectionId: normalizedAssignmentProjectionId,
        }),
        result.response
      );

      expect(result.result.status).toBe(403);
      expect(repository.resolveAssignmentResultContext).not.toHaveBeenCalled();
      expect(repository.getAssignmentResultFreshness).not.toHaveBeenCalled();
    }
  );

  it.each([
    ["class group", "not-a-uuid", normalizedAssignmentProjectionId],
    ["assignment", normalizedClassGroupId, "not-a-uuid"],
  ])(
    "rejects a malformed %s parameter before repository access",
    async (_label, classGroupId, assignmentProjectionId) => {
      const repository = normalizedRepository({});
      const routes = captureRoutes({
        getSession: async () => baseSession,
        getProjectionRepository: () => repository,
      });
      const result = responseRecorder();

      await routes.get(
        "/api/integrations/moodle/projections/classes/:classGroupId/assignments/:assignmentProjectionId/outcomes"
      )!(request({ classGroupId, assignmentProjectionId }), result.response);

      expect(result.result.status).toBe(400);
      expect(repository.resolveAssignmentResultContext).not.toHaveBeenCalled();
      expect(repository.getAssignmentResultFreshness).not.toHaveBeenCalled();
    }
  );

  it("returns the signed-in learner's sanitized quiz attempt without Moodle access", async () => {
    const studentSession: ServerSession = {
      ...baseSession,
      userId: normalizedLearnerId,
    };
    const context = {
      connectionId,
      activeRole: "student" as const,
      audience: "learner" as const,
      internalCourseId: normalizedCourseId,
      internalCourseRunId: normalizedCourseRunId,
      internalClassGroupId: normalizedClassGroupId,
      quizProjectionId: normalizedQuizProjectionId,
      authorizedUserIds: [studentSession.userId],
      courseMappingStatus: "exact" as const,
      groupMappingStatus: "exact" as const,
      userMappingStatus: "exact" as const,
      quizMappingStatus: "exact" as const,
      observedAt: "2026-07-17T01:00:00.000Z",
    };
    const projection = {
      internalCourseId: normalizedCourseId,
      internalClassGroupId: normalizedClassGroupId,
      quizProjectionId: normalizedQuizProjectionId,
      providerState: "available" as const,
      mappingStatus: "exact" as const,
      learners: [
        {
          internalUserId: studentSession.userId,
          internalEnrollmentId: normalizedEnrollmentId,
          internalMembershipId: normalizedMembershipId,
          attemptProjectionId: "57000000-0000-4000-8000-000000000001",
          attemptState: "finished" as const,
          attemptNumber: 1,
          gradingState: "graded" as const,
          latest: true,
          preview: false as const,
          startedAt: "2026-07-17T01:00:00.000Z",
          finishedAt: "2026-07-17T01:10:00.000Z",
          score: 9,
          maximumScore: 10,
        },
      ],
    };
    const repository = normalizedRepository({
      quizAttemptContext: context,
      quizAttemptFreshness: {
        context,
        freshnessState: "fresh",
        latestOutcome: "available",
        projection,
        successfulObservedAt: "2026-07-17T01:05:00.000Z",
        freshUntil: "2026-07-17T01:20:00.000Z",
        retainUntil: "2026-07-24T01:05:00.000Z",
      },
    });
    const client = fakeClient();
    const routes = captureRoutes({
      getSession: async () => studentSession,
      getClient: () => client,
      getProjectionRepository: () => repository,
      now: () => new Date("2026-07-17T01:10:00.000Z"),
    });
    const { response, result, headers } = responseRecorder();

    await routes.get(
      "/api/integrations/moodle/projections/classes/:classGroupId/quizzes/:quizProjectionId/attempts"
    )!(
      request({
        classGroupId: normalizedClassGroupId,
        quizProjectionId: normalizedQuizProjectionId,
      }),
      response
    );

    expect(result).toMatchObject({
      status: 200,
      body: {
        mode: "read_only",
        activeRole: "student",
        audience: "learner",
        quizProjectionId: normalizedQuizProjectionId,
        projection: {
          learners: [
            {
              internalUserId: studentSession.userId,
              attemptState: "finished",
              preview: false,
            },
          ],
        },
      },
    });
    expect(JSON.stringify(result.body)).not.toMatch(
      /question|answer|feedback|moodleId/i
    );
    expect(headers.get("cache-control")).toBe("private, no-store");
    expect(client.probe).not.toHaveBeenCalled();
    expect(client.call).not.toHaveBeenCalled();
  });

  it.each(["registrar", "branchadmin"] as const)(
    "denies %s quiz attempts before repository access",
    async activeRole => {
      const repository = normalizedRepository({});
      const routes = captureRoutes({
        getSession: async () => ({
          ...baseSession,
          activeRole,
          roles: [activeRole],
        }),
        getProjectionRepository: () => repository,
      });
      const result = responseRecorder();
      await routes.get(
        "/api/integrations/moodle/projections/classes/:classGroupId/quizzes/:quizProjectionId/attempts"
      )!(
        request({
          classGroupId: normalizedClassGroupId,
          quizProjectionId: normalizedQuizProjectionId,
        }),
        result.response
      );
      expect(result.result.status).toBe(403);
      expect(repository.resolveQuizAttemptContext).not.toHaveBeenCalled();
    }
  );

  it("does not return stale rows when Moodle is unavailable", async () => {
    const client = fakeClient();
    client.getCourses = vi.fn(async () => {
      throw new MoodleApiError("timeout", 504, "timeout");
    });
    const routes = captureRoutes(dependencies(compatibilitySession, client));
    const { response, result } = responseRecorder();

    await routes.get("/api/integrations/moodle/projections/courses")!(
      request(),
      response
    );

    expect(result).toEqual({
      status: 504,
      body: { error: "Moodle verification timed out.", code: "timeout" },
    });
  });

  it("caches minimum-privilege evidence across repeated reads", async () => {
    const client = fakeClient();
    const routes = captureRoutes(dependencies(compatibilitySession, client));

    for (let index = 0; index < 2; index += 1) {
      const { response, result } = responseRecorder();
      await routes.get("/api/integrations/moodle/projections/courses")!(
        request(),
        response
      );
      expect(result.status).toBe(200);
    }

    expect(client.probe).toHaveBeenCalledTimes(1);
    expect(client.getCourses).toHaveBeenCalledTimes(2);
  });

  it("skips Moodle entirely when canonical scope has no courses", async () => {
    const client = fakeClient();
    const emptyState = structuredClone(seedPlatformState);
    emptyState.courseRuns = emptyState.courseRuns.filter(
      run => run.teacherId !== "usr_teacher_demo"
    );
    const deps = dependencies(
      {
        ...compatibilitySession,
        id: "session-teacher",
        userId: "usr_teacher_demo",
        activeRole: "teacher",
        roles: ["teacher"],
      },
      client
    );
    const routes = captureRoutes({
      ...deps,
      getState: async () => ({
        state: emptyState,
        persistence: "local" as const,
        syncedAt: "2026-07-16T12:00:00.000Z",
      }),
    });
    const { response, result } = responseRecorder();

    await routes.get("/api/integrations/moodle/projections/courses")!(
      request(),
      response
    );

    expect(result).toMatchObject({ status: 200, body: { rows: [] } });
    expect(client.probe).not.toHaveBeenCalled();
    expect(client.getCourses).not.toHaveBeenCalled();
  });
});
