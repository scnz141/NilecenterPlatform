import type { ServerSession } from "./auth.js";
import { getRequestSession } from "./auth.js";
import {
  createMoodleClientFromEnvironment,
  getMoodleServerStatus,
  MoodleApiError,
  type MoodleClient,
} from "./moodleClient.js";
import {
  assertMoodleCatalogProjectionRole,
  MoodleProjectionAuthorityError,
  MoodleProjectionMappingError,
  projectMoodleCourseContentFromAuthority,
  projectMoodleCoursesFromAuthority,
  projectMoodleCourseContent,
  projectMoodleCourses,
  resolveMoodleCourseAuthority,
  resolveMappedExternalCourseId,
  validateMoodleCourseMappings,
  type MoodleCourseMapping,
} from "./moodleProjectionService.js";
import {
  getMoodleProjectionRepository,
  MoodleProjectionRepositoryAuthorityError,
  MoodleProjectionRepositoryUnavailableError,
  type MoodleCourseAuthority,
  type MoodleProjectionRepository,
} from "./moodleProjectionRepository.js";
import {
  parseMoodleCourseContentsResponse,
  parseMoodleCoursesResponse,
  type ExternalCourseReadModel,
  type ExternalCourseSectionReadModel,
} from "./moodleReadModels.js";
import {
  MoodleProjectionSnapshotError,
  resolveMoodleProjectionObservation,
  type ResolvedMoodleProjection,
} from "./moodleProjectionFreshness.js";
import type { getPlatformStateSnapshot } from "./platformState.js";
import { SessionRepositoryUnavailableError } from "./sessionRepository.js";

type MoodleRouteRequest = {
  headers: { cookie?: string };
  params?: Record<string, string | undefined>;
  get(name: string): string | undefined;
};

type MoodleRouteResponse = {
  status(code: number): MoodleRouteResponse;
  setHeader(name: string, value: string): void;
  json(body: unknown): void;
};

type MoodleRouteHandler = (
  request: MoodleRouteRequest,
  response: MoodleRouteResponse
) => void | Promise<void>;

type MoodleRouteApp = {
  get(path: string, handler: MoodleRouteHandler): void;
};

type MoodleRouteDependencies = {
  getSession?: (request: MoodleRouteRequest) => Promise<ServerSession | null>;
  getClient?: () => MoodleClient;
  getStatus?: () => ReturnType<typeof getMoodleServerStatus>;
  getProjectionRepository?: () => MoodleProjectionRepository;
  now?: () => Date;
  // Explicit compatibility hooks remain test-only. Runtime registration does
  // not provide them and can never fall back to snapshot/demo authority.
  getState?: () => ReturnType<typeof getPlatformStateSnapshot>;
  getCourseMappings?: () => Promise<readonly MoodleCourseMapping[]>;
};

class MoodleProjectionAuthenticationError extends Error {}

function setProjectionResponsePrivacy(response: MoodleRouteResponse) {
  response.setHeader("Cache-Control", "private, no-store");
  response.setHeader("Vary", "Cookie");
}

function sendMoodleError(error: unknown, response: MoodleRouteResponse) {
  if (error instanceof MoodleProjectionAuthenticationError) {
    response.status(401).json({ error: "Sign in required." });
    return;
  }
  if (error instanceof SessionRepositoryUnavailableError) {
    response
      .status(503)
      .json({ error: "Session service is temporarily unavailable." });
    return;
  }
  if (error instanceof MoodleProjectionRepositoryUnavailableError) {
    response.status(503).json({
      error: "Moodle projection repository is temporarily unavailable.",
    });
    return;
  }
  if (error instanceof MoodleProjectionRepositoryAuthorityError) {
    response.status(403).json({ error: "Moodle course access denied." });
    return;
  }
  if (error instanceof MoodleProjectionSnapshotError) {
    response.status(503).json({
      error: "Stored Moodle projection is temporarily unavailable.",
    });
    return;
  }
  if (error instanceof MoodleApiError) {
    const publicMessages: Record<typeof error.code, string> = {
      configuration: "Moodle read-only integration is not configured safely.",
      function_not_allowed:
        "Moodle function is not approved for read-only use.",
      authentication: "Moodle credentials were rejected.",
      permission: "Moodle service account lacks required read access.",
      remote: "Moodle verification failed.",
      timeout: "Moodle verification timed out.",
      invalid_response: "Moodle returned an invalid response.",
    };
    response.status(error.statusCode).json({
      error: publicMessages[error.code],
      code: error.code,
    });
    return;
  }
  if (error instanceof MoodleProjectionAuthorityError) {
    response.status(403).json({ error: "Moodle course access denied." });
    return;
  }
  if (error instanceof MoodleProjectionMappingError) {
    response.status(409).json({ error: "Moodle course mapping needs review." });
    return;
  }
  response.status(502).json({ error: "Moodle verification failed." });
}

export function registerMoodleRoutes(
  app: MoodleRouteApp,
  dependencies: MoodleRouteDependencies = {}
) {
  const resolveSession = dependencies.getSession ?? getRequestSession;
  const getClient = dependencies.getClient ?? createMoodleClientFromEnvironment;
  const getStatus = dependencies.getStatus ?? getMoodleServerStatus;
  const getProjectionRepository =
    dependencies.getProjectionRepository ?? getMoodleProjectionRepository;
  const now = dependencies.now ?? (() => new Date());
  const getState = dependencies.getState;
  const getCourseMappings = dependencies.getCourseMappings;
  const useCompatibilityRepository = Boolean(getState || getCourseMappings);
  if (useCompatibilityRepository && (!getState || !getCourseMappings)) {
    throw new Error(
      "Moodle projection compatibility tests require both state and mapping readers."
    );
  }
  let minimumPrivilegeExpiresAt = 0;

  const requireProjectionSession = async (request: MoodleRouteRequest) => {
    const session = await resolveSession(request);
    if (!session) throw new MoodleProjectionAuthenticationError();
    return session;
  };

  const requireConfiguredProjection = () => {
    if (!getStatus().configured) {
      throw new MoodleApiError(
        "Moodle read-only integration is not configured safely.",
        503,
        "configuration"
      );
    }
  };

  const requireMinimumPrivilege = async () => {
    if (minimumPrivilegeExpiresAt > Date.now()) return;
    const probe = await getClient().probe();
    if (!probe.minimumPrivilegeVerified) {
      throw new MoodleApiError(
        "Moodle service account is not minimum privilege.",
        503,
        "permission"
      );
    }
    minimumPrivilegeExpiresAt = Date.now() + 5 * 60 * 1000;
  };

  app.get("/api/integrations/moodle/status", async (request, response) => {
    try {
      const session = await resolveSession(request);
      if (!session) {
        response.status(401).json({ error: "Sign in required." });
        return;
      }
      if (session.activeRole !== "superadmin") {
        response.status(403).json({ error: "Super Admin access required." });
        return;
      }

      const status = getStatus();
      if (!status.configured) {
        response.json({
          ...status,
          state: status.enabled ? "unconfigured" : "disabled",
        });
        return;
      }

      const probe = await getClient().probe();
      response.json({
        ...status,
        state: probe.minimumPrivilegeVerified ? "ready" : "degraded",
        probe,
      });
    } catch (error) {
      sendMoodleError(error, response);
    }
  });

  app.get(
    "/api/integrations/moodle/projections/courses",
    async (request, response) => {
      setProjectionResponsePrivacy(response);
      try {
        const session = await requireProjectionSession(request);
        assertMoodleCatalogProjectionRole(session);
        const compatibility =
          useCompatibilityRepository &&
          session.authorizationModel !== "normalized"
            ? await getState!()
            : undefined;
        if (compatibility) requireConfiguredProjection();
        const projectionRepository = compatibility
          ? undefined
          : getProjectionRepository();
        const authority = compatibility
          ? {
              activeRole: session.activeRole,
              authorizedCourseIds: Array.from(
                resolveMoodleCourseAuthority(session, compatibility.state)
              ),
              observedAt: compatibility.syncedAt,
            }
          : await projectionRepository!.resolveCourseAuthority(session);
        const connectionId =
          "connectionId" in authority ? authority.connectionId : undefined;
        const authorizedCourseIds = new Set(authority.authorizedCourseIds);
        if (authorizedCourseIds.size === 0) {
          response.json({
            mode: "read_only",
            authority: "server_course_relationships",
            authorityObservedAt: authority.observedAt,
            availability: "empty",
            freshness: "unavailable",
            observations: [],
            rows: [],
          });
          return;
        }
        const mappings = compatibility
          ? await getCourseMappings!()
          : await projectionRepository!.listCourseMappings(
              connectionId!,
              authority.authorizedCourseIds
            );
        if (compatibility) {
          validateMoodleCourseMappings(mappings, compatibility.state);
        }
        if (compatibility) {
          await requireMinimumPrivilege();
          const provider = await getClient().getCourses();
          const courses = parseMoodleCoursesResponse(provider);
          response.json({
            mode: "read_only",
            authority: "server_course_relationships",
            authorityObservedAt: authority.observedAt,
            rows: projectMoodleCourses({
              session,
              state: compatibility.state,
              mappings,
              providerCourses: courses,
            }),
          });
          return;
        }

        const normalizedAuthority = authority as MoodleCourseAuthority;
        const observedAt = now();
        const observationRows =
          await projectionRepository!.listProjectionObservations({
            session,
            authority: normalizedAuthority,
            projectionFamily: "course_catalog",
            asOf: observedAt.toISOString(),
          });
        const observationsByCourse = new Map(
          observationRows.map(row => [row.internalCourseId, row])
        );
        const resolvedRows: Array<
          ResolvedMoodleProjection<readonly ExternalCourseReadModel[]>
        > = [];
        const courses: ExternalCourseReadModel[] = [];
        const observationMetadata = normalizedAuthority.authorizedCourseIds.map(
          internalCourseId => {
            const stored = observationsByCourse.get(internalCourseId);
            const resolved = resolveMoodleProjectionObservation<
              readonly ExternalCourseReadModel[]
            >({
              observation: stored?.observation ?? null,
              now: observedAt,
            });
            resolvedRows.push(resolved);
            const metadata = {
              internalCourseId,
              availability: resolved.availability,
              freshness: resolved.freshness,
              latestOutcome: resolved.latestOutcome,
              lastAttemptedAt: resolved.lastAttemptedAt,
              reconciliationReason: stored?.reconciliationReason,
              observation: resolved.observation,
            };
            if (!resolved.payload) return metadata;
            const mapping = mappings.find(
              item => item.internalCourseId === internalCourseId
            );
            if (
              mapping &&
              ((stored?.externalCourseId &&
                stored.externalCourseId !== mapping.externalCourseId) ||
                resolved.payload.some(
                  course => course.sourceId !== mapping.externalCourseId
                ))
            ) {
              throw new MoodleProjectionSnapshotError();
            }
            if (!mapping && resolved.payload.length > 0) {
              throw new MoodleProjectionSnapshotError();
            }
            courses.push(...resolved.payload);
            return metadata;
          }
        );
        if (!resolvedRows.some(row => row.payload !== undefined)) {
          throw new MoodleProjectionSnapshotError();
        }
        const availability = resolvedRows.some(
          row => row.availability === "unavailable"
        )
          ? "unavailable"
          : resolvedRows.every(row => row.availability === "empty")
            ? "empty"
            : "available";
        const freshness = resolvedRows.some(row => row.freshness === "stale")
          ? "stale"
          : "fresh";
        response.json({
          mode: "read_only",
          authority: "server_course_relationships",
          authorityObservedAt: authority.observedAt,
          availability,
          freshness,
          observations: observationMetadata,
          rows: projectMoodleCoursesFromAuthority({
            activeRole: normalizedAuthority.activeRole,
            authorizedCourseIds: normalizedAuthority.authorizedCourseIds,
            mappings,
            providerCourses: courses,
          }),
        });
      } catch (error) {
        sendMoodleError(error, response);
      }
    }
  );

  app.get(
    "/api/integrations/moodle/projections/courses/:courseId/content",
    async (request, response) => {
      setProjectionResponsePrivacy(response);
      try {
        const session = await requireProjectionSession(request);
        assertMoodleCatalogProjectionRole(session);
        const internalCourseId = request.params?.courseId?.trim() ?? "";
        if (!internalCourseId) {
          response.status(400).json({ error: "Course ID is required." });
          return;
        }
        const compatibility =
          useCompatibilityRepository &&
          session.authorizationModel !== "normalized"
            ? await getState!()
            : undefined;
        if (compatibility) requireConfiguredProjection();
        const projectionRepository = compatibility
          ? undefined
          : getProjectionRepository();
        const authority = compatibility
          ? {
              activeRole: session.activeRole,
              authorizedCourseIds: Array.from(
                resolveMoodleCourseAuthority(session, compatibility.state)
              ),
              observedAt: compatibility.syncedAt,
            }
          : await projectionRepository!.resolveCourseAuthority(session);
        const connectionId =
          "connectionId" in authority ? authority.connectionId : undefined;
        const authorizedCourseIds = new Set(authority.authorizedCourseIds);
        if (!authorizedCourseIds.has(internalCourseId)) {
          throw new MoodleProjectionAuthorityError();
        }
        const mappings = compatibility
          ? await getCourseMappings!()
          : await projectionRepository!.listCourseMappings(connectionId!, [
              internalCourseId,
            ]);
        if (compatibility) {
          validateMoodleCourseMappings(mappings, compatibility.state);
        }
        const mapping = resolveMappedExternalCourseId(
          internalCourseId,
          mappings
        );
        if (compatibility) {
          await requireMinimumPrivilege();
          const rawSections = await getClient().getCourseContents(
            Number(mapping.externalCourseId)
          );
          const sections = parseMoodleCourseContentsResponse(rawSections);
          response.json({
            mode: "read_only",
            authority: "server_course_relationships",
            authorityObservedAt: authority.observedAt,
            projection: projectMoodleCourseContent({
              session,
              state: compatibility.state,
              mappings,
              internalCourseId,
              sections,
            }),
          });
          return;
        }

        const normalizedAuthority = authority as MoodleCourseAuthority;
        const observedAt = now();
        const observationRows =
          await projectionRepository!.listProjectionObservations({
            session,
            authority: normalizedAuthority,
            projectionFamily: "course_content",
            asOf: observedAt.toISOString(),
            internalCourseIds: [internalCourseId],
          });
        const stored = observationRows.find(
          row => row.internalCourseId === internalCourseId
        );
        if (
          stored?.externalCourseId &&
          stored.externalCourseId !== mapping.externalCourseId
        ) {
          throw new MoodleProjectionSnapshotError();
        }
        const resolved = resolveMoodleProjectionObservation<
          readonly ExternalCourseSectionReadModel[]
        >({ observation: stored?.observation ?? null, now: observedAt });
        if (!resolved.payload) throw new MoodleProjectionSnapshotError();
        response.json({
          mode: "read_only",
          authority: "server_course_relationships",
          authorityObservedAt: authority.observedAt,
          availability: resolved.availability,
          freshness: resolved.freshness,
          latestOutcome: resolved.latestOutcome,
          ...(resolved.lastAttemptedAt
            ? { lastAttemptedAt: resolved.lastAttemptedAt }
            : {}),
          ...(stored?.reconciliationReason
            ? { reconciliationReason: stored.reconciliationReason }
            : {}),
          observation: resolved.observation,
          projection: projectMoodleCourseContentFromAuthority({
            activeRole: normalizedAuthority.activeRole,
            authorizedCourseIds: normalizedAuthority.authorizedCourseIds,
            mappings,
            internalCourseId,
            sections: resolved.payload,
          }),
        });
      } catch (error) {
        sendMoodleError(error, response);
      }
    }
  );

  app.get(
    "/api/integrations/moodle/projections/classes/:classGroupId/enrollment-groups",
    async (request, response) => {
      setProjectionResponsePrivacy(response);
      try {
        const session = await requireProjectionSession(request);
        if (
          !["teacher", "headofdepartment", "superadmin"].includes(
            session.activeRole
          )
        ) {
          throw new MoodleProjectionRepositoryAuthorityError();
        }
        const internalClassGroupId = request.params?.classGroupId?.trim() ?? "";
        if (
          !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
            internalClassGroupId
          )
        ) {
          response
            .status(400)
            .json({ error: "Valid class group ID is required." });
          return;
        }
        const repository = getProjectionRepository();
        const context = await repository.resolveEnrollmentGroupContext(
          session,
          internalClassGroupId
        );
        const result = await repository.getEnrollmentGroupFreshness({
          session,
          context,
          asOf: now().toISOString(),
        });
        const availability = result.projection
          ? result.latestOutcome === "unavailable" ||
            result.latestOutcome === "reconciliation"
            ? "unavailable"
            : result.projection.providerState
          : "unavailable";
        const freshness =
          result.freshnessState === "fresh"
            ? "fresh"
            : result.freshnessState === "stale_retained"
              ? "stale"
              : "unavailable";
        response.json({
          mode: "read_only",
          authority: "server_class_relationships",
          authorityObservedAt: result.context.observedAt,
          activeRole: result.context.activeRole,
          audience: result.context.audience,
          availability,
          freshness,
          freshnessState: result.freshnessState,
          latestOutcome: result.latestOutcome ?? "unavailable",
          mappingStatus: {
            course: result.context.courseMappingStatus,
            group: result.context.groupMappingStatus,
            users: result.context.userMappingStatus,
          },
          internalCourseId: result.context.internalCourseId,
          internalClassGroupId: result.context.internalClassGroupId,
          ...(result.reconciliationReason
            ? { reconciliationReason: result.reconciliationReason }
            : {}),
          ...(result.successfulObservedAt
            ? {
                observation: {
                  observedAt: result.successfulObservedAt,
                  freshUntil: result.freshUntil,
                  retainUntil: result.retainUntil,
                },
              }
            : {}),
          ...(result.projection ? { projection: result.projection } : {}),
        });
      } catch (error) {
        sendMoodleError(error, response);
      }
    }
  );

  app.get(
    "/api/integrations/moodle/projections/classes/:classGroupId/assessment-status",
    async (request, response) => {
      setProjectionResponsePrivacy(response);
      try {
        const session = await requireProjectionSession(request);
        if (
          !["student", "teacher", "headofdepartment", "superadmin"].includes(
            session.activeRole
          )
        ) {
          throw new MoodleProjectionRepositoryAuthorityError();
        }
        const internalClassGroupId = request.params?.classGroupId?.trim() ?? "";
        if (
          !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
            internalClassGroupId
          )
        ) {
          response
            .status(400)
            .json({ error: "Valid class group ID is required." });
          return;
        }
        const repository = getProjectionRepository();
        const context = await repository.resolveAssessmentStatusContext(
          session,
          internalClassGroupId
        );
        const result = await repository.getAssessmentStatusFreshness({
          session,
          context,
          asOf: now().toISOString(),
        });
        const availability = result.projection
          ? result.latestOutcome === "unavailable" ||
            result.latestOutcome === "reconciliation"
            ? "unavailable"
            : result.projection.providerState
          : "unavailable";
        const freshness =
          result.freshnessState === "fresh"
            ? "fresh"
            : result.freshnessState === "stale_retained"
              ? "stale"
              : "unavailable";
        response.json({
          mode: "read_only",
          authority: "server_class_relationships",
          authorityObservedAt: result.context.observedAt,
          activeRole: result.context.activeRole,
          audience: result.context.audience,
          availability,
          freshness,
          freshnessState: result.freshnessState,
          latestOutcome: result.latestOutcome ?? "unavailable",
          mappingStatus: {
            course: result.context.courseMappingStatus,
            group: result.context.groupMappingStatus,
            user: result.context.userMappingStatus,
            assessments: result.context.assessmentMappingStatus,
          },
          internalCourseId: result.context.internalCourseId,
          internalCourseRunId: result.context.internalCourseRunId,
          internalClassGroupId: result.context.internalClassGroupId,
          ...(result.reconciliationReason
            ? { reconciliationReason: result.reconciliationReason }
            : {}),
          ...(result.successfulObservedAt
            ? {
                observation: {
                  observedAt: result.successfulObservedAt,
                  freshUntil: result.freshUntil,
                  retainUntil: result.retainUntil,
                },
              }
            : {}),
          ...(result.projection ? { projection: result.projection } : {}),
        });
      } catch (error) {
        sendMoodleError(error, response);
      }
    }
  );

  app.get(
    "/api/integrations/moodle/projections/classes/:classGroupId/assignments/:assignmentProjectionId/outcomes",
    async (request, response) => {
      setProjectionResponsePrivacy(response);
      try {
        const session = await requireProjectionSession(request);
        if (
          session.provider !== "supabase" ||
          session.authorizationModel !== "normalized" ||
          !session.activeRoleGrantId ||
          !["student", "teacher", "headofdepartment", "superadmin"].includes(
            session.activeRole
          )
        ) {
          throw new MoodleProjectionRepositoryAuthorityError();
        }
        const internalClassGroupId = request.params?.classGroupId?.trim() ?? "";
        const assignmentProjectionId =
          request.params?.assignmentProjectionId?.trim() ?? "";
        const validUuid =
          /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        if (
          !validUuid.test(internalClassGroupId) ||
          !validUuid.test(assignmentProjectionId)
        ) {
          response.status(400).json({
            error:
              "Valid class group and assignment projection IDs are required.",
          });
          return;
        }
        const repository = getProjectionRepository();
        const context = await repository.resolveAssignmentResultContext(
          session,
          internalClassGroupId,
          assignmentProjectionId
        );
        const result = await repository.getAssignmentResultFreshness({
          session,
          context,
          asOf: now().toISOString(),
        });
        const availability = result.projection
          ? result.latestOutcome === "unavailable" ||
            result.latestOutcome === "reconciliation"
            ? "unavailable"
            : result.projection.providerState
          : "unavailable";
        const freshness =
          result.freshnessState === "fresh"
            ? "fresh"
            : result.freshnessState === "stale_retained"
              ? "stale"
              : "unavailable";
        response.json({
          mode: "read_only",
          authority: "server_class_relationships",
          authorityObservedAt: result.context.observedAt,
          activeRole: result.context.activeRole,
          audience: result.context.audience,
          availability,
          freshness,
          freshnessState: result.freshnessState,
          latestOutcome: result.latestOutcome ?? "unavailable",
          mappingStatus: {
            course: result.context.courseMappingStatus,
            group: result.context.groupMappingStatus,
            users: result.context.userMappingStatus,
            assignment: result.context.assignmentMappingStatus,
          },
          internalCourseId: result.context.internalCourseId,
          internalCourseRunId: result.context.internalCourseRunId,
          internalClassGroupId: result.context.internalClassGroupId,
          assignmentProjectionId: result.context.assignmentProjectionId,
          ...(result.reconciliationReason
            ? { reconciliationReason: result.reconciliationReason }
            : {}),
          ...(result.successfulObservedAt
            ? {
                observation: {
                  observedAt: result.successfulObservedAt,
                  freshUntil: result.freshUntil,
                  retainUntil: result.retainUntil,
                },
              }
            : {}),
          ...(result.projection ? { projection: result.projection } : {}),
        });
      } catch (error) {
        sendMoodleError(error, response);
      }
    }
  );

  app.get(
    "/api/integrations/moodle/projections/classes/:classGroupId/quizzes/:quizProjectionId/attempts",
    async (request, response) => {
      setProjectionResponsePrivacy(response);
      try {
        const session = await requireProjectionSession(request);
        if (
          session.provider !== "supabase" ||
          session.authorizationModel !== "normalized" ||
          !session.activeRoleGrantId ||
          !["student", "teacher", "headofdepartment", "superadmin"].includes(
            session.activeRole
          )
        ) {
          throw new MoodleProjectionRepositoryAuthorityError();
        }
        const internalClassGroupId = request.params?.classGroupId?.trim() ?? "";
        const quizProjectionId = request.params?.quizProjectionId?.trim() ?? "";
        const validUuid =
          /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        if (
          !validUuid.test(internalClassGroupId) ||
          !validUuid.test(quizProjectionId)
        ) {
          response.status(400).json({
            error: "Valid class group and quiz projection IDs are required.",
          });
          return;
        }
        const repository = getProjectionRepository();
        const context = await repository.resolveQuizAttemptContext(
          session,
          internalClassGroupId,
          quizProjectionId
        );
        const result = await repository.getQuizAttemptFreshness({
          session,
          context,
          asOf: now().toISOString(),
        });
        const availability = result.projection
          ? result.latestOutcome === "unavailable" ||
            result.latestOutcome === "reconciliation"
            ? "unavailable"
            : result.projection.providerState
          : "unavailable";
        const freshness =
          result.freshnessState === "fresh"
            ? "fresh"
            : result.freshnessState === "stale_retained"
              ? "stale"
              : "unavailable";
        response.json({
          mode: "read_only",
          authority: "server_class_relationships",
          authorityObservedAt: result.context.observedAt,
          activeRole: result.context.activeRole,
          audience: result.context.audience,
          availability,
          freshness,
          freshnessState: result.freshnessState,
          latestOutcome: result.latestOutcome ?? "unavailable",
          mappingStatus: {
            course: result.context.courseMappingStatus,
            group: result.context.groupMappingStatus,
            users: result.context.userMappingStatus,
            quiz: result.context.quizMappingStatus,
          },
          internalCourseId: result.context.internalCourseId,
          internalCourseRunId: result.context.internalCourseRunId,
          internalClassGroupId: result.context.internalClassGroupId,
          quizProjectionId: result.context.quizProjectionId,
          ...(result.reconciliationReason
            ? { reconciliationReason: result.reconciliationReason }
            : {}),
          ...(result.successfulObservedAt
            ? {
                observation: {
                  observedAt: result.successfulObservedAt,
                  freshUntil: result.freshUntil,
                  retainUntil: result.retainUntil,
                },
              }
            : {}),
          ...(result.projection ? { projection: result.projection } : {}),
        });
      } catch (error) {
        sendMoodleError(error, response);
      }
    }
  );

  app.get(
    "/api/integrations/moodle/projections/classes/:classGroupId/grade-items/:gradeItemProjectionId/outcomes",
    async (request, response) => {
      setProjectionResponsePrivacy(response);
      try {
        const session = await requireProjectionSession(request);
        if (
          session.provider !== "supabase" ||
          session.authorizationModel !== "normalized" ||
          !session.activeRoleGrantId ||
          !["student", "teacher", "headofdepartment", "superadmin"].includes(
            session.activeRole
          )
        ) {
          throw new MoodleProjectionRepositoryAuthorityError();
        }
        const internalClassGroupId = request.params?.classGroupId?.trim() ?? "";
        const gradeItemProjectionId =
          request.params?.gradeItemProjectionId?.trim() ?? "";
        const validUuid =
          /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        if (
          !validUuid.test(internalClassGroupId) ||
          !validUuid.test(gradeItemProjectionId)
        ) {
          response.status(400).json({
            error:
              "Valid class group and grade item projection IDs are required.",
          });
          return;
        }
        const repository = getProjectionRepository();
        const context = await repository.resolveGradeOutcomeContext(
          session,
          internalClassGroupId,
          gradeItemProjectionId
        );
        const result = await repository.getGradeOutcomeFreshness({
          session,
          context,
          asOf: now().toISOString(),
        });
        const availability = result.projection
          ? result.latestOutcome === "unavailable" ||
            result.latestOutcome === "reconciliation"
            ? "unavailable"
            : result.projection.providerState
          : "unavailable";
        const freshness =
          result.freshnessState === "fresh"
            ? "fresh"
            : result.freshnessState === "stale_retained"
              ? "stale"
              : "unavailable";
        response.json({
          mode: "read_only",
          authority: "server_class_relationships",
          authorityObservedAt: result.context.observedAt,
          activeRole: result.context.activeRole,
          audience: result.context.audience,
          availability,
          freshness,
          freshnessState: result.freshnessState,
          latestOutcome: result.latestOutcome ?? "unavailable",
          mappingStatus: {
            course: result.context.courseMappingStatus,
            group: result.context.groupMappingStatus,
            users: result.context.userMappingStatus,
            gradeItem: result.context.gradeItemMappingStatus,
          },
          internalCourseId: result.context.internalCourseId,
          internalCourseRunId: result.context.internalCourseRunId,
          internalClassGroupId: result.context.internalClassGroupId,
          gradeItemProjectionId: result.context.gradeItemProjectionId,
          ...(result.reconciliationReason
            ? { reconciliationReason: result.reconciliationReason }
            : {}),
          ...(result.successfulObservedAt
            ? {
                observation: {
                  observedAt: result.successfulObservedAt,
                  freshUntil: result.freshUntil,
                  retainUntil: result.retainUntil,
                },
              }
            : {}),
          ...(result.projection ? { projection: result.projection } : {}),
        });
      } catch (error) {
        sendMoodleError(error, response);
      }
    }
  );

  app.get(
    "/api/integrations/moodle/projections/classes/:classGroupId/activities/:activityProjectionId/outcomes",
    async (request, response) => {
      setProjectionResponsePrivacy(response);
      try {
        const session = await requireProjectionSession(request);
        if (
          session.provider !== "supabase" ||
          session.authorizationModel !== "normalized" ||
          !session.activeRoleGrantId ||
          !["student", "teacher", "headofdepartment", "superadmin"].includes(
            session.activeRole
          )
        ) {
          throw new MoodleProjectionRepositoryAuthorityError();
        }
        const internalClassGroupId = request.params?.classGroupId?.trim() ?? "";
        const activityProjectionId =
          request.params?.activityProjectionId?.trim() ?? "";
        const validUuid =
          /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        if (
          !validUuid.test(internalClassGroupId) ||
          !validUuid.test(activityProjectionId)
        ) {
          response.status(400).json({
            error:
              "Valid class group and activity projection IDs are required.",
          });
          return;
        }
        const repository = getProjectionRepository();
        const context = await repository.resolveActivityOutcomeContext(
          session,
          internalClassGroupId,
          activityProjectionId
        );
        const result = await repository.getActivityOutcomeFreshness({
          session,
          context,
          asOf: now().toISOString(),
        });
        const availability = result.projection
          ? result.latestOutcome === "unavailable" ||
            result.latestOutcome === "reconciliation"
            ? "unavailable"
            : result.projection.providerState
          : "unavailable";
        const freshness =
          result.freshnessState === "fresh"
            ? "fresh"
            : result.freshnessState === "stale_retained"
              ? "stale"
              : "unavailable";
        response.json({
          mode: "read_only",
          authority: "server_class_relationships",
          authorityObservedAt: result.context.observedAt,
          activeRole: result.context.activeRole,
          audience: result.context.audience,
          availability,
          freshness,
          freshnessState: result.freshnessState,
          latestOutcome: result.latestOutcome ?? "unavailable",
          mappingStatus: {
            course: result.context.courseMappingStatus,
            group: result.context.groupMappingStatus,
            users: result.context.userMappingStatus,
            activity: result.context.activityMappingStatus,
          },
          internalCourseId: result.context.internalCourseId,
          internalCourseRunId: result.context.internalCourseRunId,
          internalClassGroupId: result.context.internalClassGroupId,
          activityProjectionId: result.context.activityProjectionId,
          activityKind: result.context.activityKind,
          ...(result.reconciliationReason
            ? { reconciliationReason: result.reconciliationReason }
            : {}),
          ...(result.successfulObservedAt
            ? {
                observation: {
                  observedAt: result.successfulObservedAt,
                  freshUntil: result.freshUntil,
                  retainUntil: result.retainUntil,
                },
              }
            : {}),
          ...(result.projection ? { projection: result.projection } : {}),
        });
      } catch (error) {
        sendMoodleError(error, response);
      }
    }
  );
}
