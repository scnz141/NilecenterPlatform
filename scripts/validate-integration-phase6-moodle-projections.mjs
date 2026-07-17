import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(
  root,
  "docs/integration-phase6-moodle-projections.json"
);
const attestationPath = path.join(
  root,
  "docs/qa-attestations/integration-phase6-projection-contract-20260716.json"
);
const projectionPrefix = "/api/integrations/moodle/projections";
const roles = ["student", "teacher", "headofdepartment", "superadmin"];
const classProjectionRoles = ["teacher", "headofdepartment", "superadmin"];
const routeSignatures = [
  "GET /api/integrations/moodle/projections/courses",
  "GET /api/integrations/moodle/projections/courses/:courseId/content",
  "GET /api/integrations/moodle/projections/classes/:classGroupId/enrollment-groups",
  "GET /api/integrations/moodle/projections/classes/:classGroupId/assessment-status",
  "GET /api/integrations/moodle/projections/classes/:classGroupId/assignments/:assignmentProjectionId/outcomes",
  "GET /api/integrations/moodle/projections/classes/:classGroupId/quizzes/:quizProjectionId/attempts",
  "GET /api/integrations/moodle/projections/classes/:classGroupId/grade-items/:gradeItemProjectionId/outcomes",
  "GET /api/integrations/moodle/projections/classes/:classGroupId/activities/:activityProjectionId/outcomes",
];
const exactObjects = {
  sourceFiles: {
    routes: "server/moodleRoutes.ts",
    repository: "server/moodleProjectionRepository.ts",
    freshness: "server/moodleProjectionFreshness.ts",
    projectionService: "server/moodleProjectionService.ts",
    readModels: "server/moodleReadModels.ts",
    clientApi: "client/src/lib/backend/api.ts",
    clientPage: "client/src/pages/platform/MoodleSourcePage.tsx",
    clientContentPage: "client/src/pages/platform/MoodleCourseContentPage.tsx",
  },
  authority: {
    moodle: "canonical_writable_for_provider_managed_fields",
    nileLearn: "read_only_projection",
    projectionDirection: "moodle_to_nile_learn",
    authorization: "authenticated_server_session_and_canonical_relationships",
    requestAuthorityAllowed: false,
    staleProjectionAuthorizesAccess: false,
  },
  externalIds: {
    routeIdentity: "internal_canonical_course_or_class_group_id",
    providerLookup: "exact_external_course_group_and_user_mappings",
    externalCourseIdFormat: "positive_decimal_string",
    oneToOneMappings: true,
    titleOrNameFallbackAllowed: false,
    missingMappingProjectsProviderData: false,
    ambiguousMappingProjectsProviderData: false,
    unmatchedProviderRecordVisibility: "superadmin_reconciliation_only",
  },
  roleScopes: {
    student: "canonical_active_or_completed_enrollment",
    teacher: "canonical_active_assigned_course_run",
    headofdepartment: "canonical_department_scope",
    superadmin: "canonical_global_scope",
  },
  failureBehavior: {
    unauthenticated: "401_before_provider_call",
    unauthorized: "403_before_provider_call",
    canonicalAuthorityUnavailable: "503_no_client_or_demo_fallback",
    providerOutage: "unavailable_no_authority_fallback",
    missingMapping: "reconciliation_metadata_only_no_provider_projection",
    ambiguousMapping: "reject_ambiguous_mapping_no_provider_projection",
    staleProjection: "may_display_with_timestamp_but_never_authorizes",
  },
  portalReadBoundary: {
    routeOwners: ["MoodleSourcePage", "MoodleCourseContentPage"],
    routes: [
      "/app/{student|teacher|hod|admin}/moodle-source",
      "/app/{student|teacher|hod|admin}/moodle-source/:courseId",
    ],
    dataSource: "same_origin_server_projection",
    localStateFallbackAllowed: false,
    browserProviderCallAllowed: false,
    loadingStateRequired: true,
    emptyStateRequired: true,
    unavailableStateRequired: true,
    staleStateRequired: true,
    partialStateRequired: true,
  },
};
const expectedSets = {
  parsers: [
    "parseMoodleCoursesResponse",
    "parseMoodleCourseContentsResponse",
    "parseStoredMoodleEnrollmentGroupProjection",
    "parseStoredMoodleAssessmentStatusProjection",
    "parseStoredMoodleAssignmentResultProjection",
    "parseStoredMoodleQuizAttemptProjection",
    "parseStoredMoodleGradeOutcomeProjection",
    "parseStoredMoodleActivityOutcomeProjection",
  ],
  sanitization: [
    "bounded_arrays",
    "bounded_text",
    "contact_data_removed",
    "unsafe_html_removed",
    "invalid_payload_rejected",
  ],
  courseFields: [
    "sourceId",
    "categorySourceId",
    "title",
    "shortTitle",
    "visible",
    "startsAt",
    "endsAt",
    "completionTrackingEnabled",
  ],
  sectionFields: ["sourceId", "position", "title", "visible", "activities"],
  activityFields: [
    "sourceId",
    "instanceSourceId",
    "type",
    "title",
    "visible",
    "completionTracking",
  ],
  enrollmentPersonFields: [
    "internalCourseId",
    "internalClassGroupId",
    "providerState",
    "mappingStatus",
    "learners",
  ],
  enrollmentLearnerFields: [
    "internalUserId",
    "internalEnrollmentId",
    "internalMembershipId",
    "providerState",
    "mappingStatus",
  ],
  enrollmentAggregateFields: [
    "internalCourseId",
    "internalClassGroupId",
    "providerState",
    "mappingStatus",
    "learnerCount",
    "mappedLearnerCount",
    "unmappedLearnerCount",
  ],
  assessmentStatusFields: [
    "internalCourseId",
    "internalClassGroupId",
    "providerState",
    "mappingStatus",
    "items",
  ],
  assessmentStatusItemFields: [
    "projectionId",
    "kind",
    "title",
    "visibility",
    "scheduleState",
    "opensAt",
    "dueAt",
    "cutoffAt",
    "closesAt",
    "acceptsSubmissions",
  ],
  assignmentResultPersonFields: [
    "internalCourseId",
    "internalClassGroupId",
    "assignmentProjectionId",
    "providerState",
    "mappingStatus",
    "learners",
  ],
  assignmentResultLearnerFields: [
    "internalUserId",
    "internalEnrollmentId",
    "internalMembershipId",
    "submissionState",
    "attemptNumber",
    "gradingState",
    "latest",
    "submittedAt",
    "modifiedAt",
    "score",
    "maximumScore",
    "gradedAt",
  ],
  assignmentResultAggregateFields: [
    "internalCourseId",
    "internalClassGroupId",
    "assignmentProjectionId",
    "providerState",
    "mappingStatus",
    "learnerCount",
    "submittedCount",
    "gradedCount",
  ],
  quizAttemptPersonFields: [
    "internalCourseId",
    "internalClassGroupId",
    "quizProjectionId",
    "providerState",
    "mappingStatus",
    "learners",
  ],
  quizAttemptLearnerFields: [
    "internalUserId",
    "internalEnrollmentId",
    "internalMembershipId",
    "attemptProjectionId",
    "attemptState",
    "attemptNumber",
    "gradingState",
    "latest",
    "preview",
    "startedAt",
    "finishedAt",
    "modifiedAt",
    "score",
    "maximumScore",
  ],
  quizAttemptAggregateFields: [
    "internalCourseId",
    "internalClassGroupId",
    "quizProjectionId",
    "providerState",
    "mappingStatus",
    "learnerCount",
    "attemptedCount",
    "finishedCount",
    "gradedCount",
  ],
  gradeOutcomePersonFields: [
    "internalCourseId",
    "internalClassGroupId",
    "gradeItemProjectionId",
    "providerState",
    "mappingStatus",
    "learners",
  ],
  gradeOutcomeLearnerFields: [
    "internalUserId",
    "internalEnrollmentId",
    "internalMembershipId",
    "gradingState",
    "score",
    "maximumScore",
    "gradedAt",
    "releasedAt",
    "feedback",
  ],
  gradeOutcomeAggregateFields: [
    "internalCourseId",
    "internalClassGroupId",
    "gradeItemProjectionId",
    "providerState",
    "mappingStatus",
    "learnerCount",
    "gradedCount",
    "releasedCount",
    "feedbackReleasedCount",
  ],
  activityOutcomePersonFields: [
    "internalCourseId",
    "internalClassGroupId",
    "activityProjectionId",
    "activityKind",
    "providerState",
    "mappingStatus",
    "learners",
  ],
  activityOutcomeLearnerFields: [
    "internalUserId",
    "internalEnrollmentId",
    "internalMembershipId",
    "completionState",
    "scoreState",
    "completedAt",
    "score",
    "maximumScore",
    "releasedAt",
  ],
  activityOutcomeAggregateFields: [
    "internalCourseId",
    "internalClassGroupId",
    "activityProjectionId",
    "activityKind",
    "providerState",
    "mappingStatus",
    "learnerCount",
    "startedCount",
    "completedCount",
    "passedCount",
    "failedCount",
    "scoredCount",
  ],
  freshness: ["fresh", "stale", "unavailable"],
  availability: ["available", "empty", "unavailable"],
  mapping: [
    "discovered",
    "matched",
    "synced",
    "stale",
    "error",
    "missing",
    "unmatched",
  ],
  reconciliationReasons: [
    "missing_mapping",
    "missing_provider_record",
    "ambiguous_mapping",
  ],
};

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sha256(filePath) {
  return crypto
    .createHash("sha256")
    .update(fs.readFileSync(filePath))
    .digest("hex");
}

function stable(values) {
  return [...values].sort((left, right) => left.localeCompare(right));
}

function exactSet(actual, expected, label) {
  assert(Array.isArray(actual), `${label} must be an array.`);
  assert(
    JSON.stringify(stable(actual)) === JSON.stringify(stable(expected)),
    `${label} differs from the Phase 6 contract.`
  );
}

function exactObject(actual, expected, label) {
  assert(
    actual && typeof actual === "object" && !Array.isArray(actual),
    `${label} must be an object.`
  );
  exactSet(Object.keys(actual), Object.keys(expected), `${label} keys`);
  for (const [key, value] of Object.entries(expected)) {
    if (Array.isArray(value)) {
      exactSet(actual[key], value, `${label}.${key}`);
    } else {
      assert(
        actual[key] === value,
        `${label}.${key} differs from the contract.`
      );
    }
  }
}

function requirePhrases(source, phrases, label) {
  for (const phrase of phrases) {
    assert(source.includes(phrase), `${label} is missing ${phrase}.`);
  }
}

function readSource(candidate, key) {
  const relativePath = candidate.sourceFiles[key];
  const filePath = path.resolve(root, relativePath);
  assert(
    filePath.startsWith(`${root}${path.sep}`),
    `Source path escapes the repository: ${relativePath}`
  );
  assert(fs.existsSync(filePath), `Source file is missing: ${relativePath}`);
  return fs.readFileSync(filePath, "utf8");
}

function serverTypeScriptFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return serverTypeScriptFiles(entryPath);
    return entry.isFile() && entry.name.endsWith(".ts") ? [entryPath] : [];
  });
}

function unwrapExpression(node) {
  if (
    ts.isParenthesizedExpression(node) ||
    ts.isAsExpression(node) ||
    ts.isTypeAssertionExpression(node) ||
    ts.isSatisfiesExpression(node) ||
    ts.isNonNullExpression(node)
  ) {
    return unwrapExpression(node.expression);
  }
  return node;
}

function projectionRouteRegistrations() {
  const methods = new Set(["get", "post", "put", "patch", "delete"]);
  const registrations = [];
  for (const filePath of serverTypeScriptFiles(path.join(root, "server"))) {
    const source = ts.createSourceFile(
      filePath,
      fs.readFileSync(filePath, "utf8"),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS
    );
    function visit(node) {
      if (
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression) &&
        ts.isIdentifier(node.expression.expression) &&
        node.expression.expression.text === "app" &&
        methods.has(node.expression.name.text) &&
        node.arguments[0]
      ) {
        const routeNode = unwrapExpression(node.arguments[0]);
        if (
          ts.isStringLiteralLike(routeNode) &&
          routeNode.text.startsWith(projectionPrefix)
        ) {
          registrations.push(
            `${node.expression.name.text.toUpperCase()} ${routeNode.text}`
          );
        }
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
  }
  return registrations;
}

function validateSource(candidate) {
  const routes = readSource(candidate, "routes");
  const repository = readSource(candidate, "repository");
  const freshness = readSource(candidate, "freshness");
  const projection = readSource(candidate, "projectionService");
  const readModels = readSource(candidate, "readModels");
  const clientApi = readSource(candidate, "clientApi");
  const clientPage = readSource(candidate, "clientPage");
  const contentPage = readSource(candidate, "clientContentPage");
  const assignmentRouteSignature =
    '"/api/integrations/moodle/projections/classes/:classGroupId/assignments/:assignmentProjectionId/outcomes"';
  const assignmentRouteStart = routes.indexOf(assignmentRouteSignature);
  const assignmentRouteEnd = routes.indexOf("\n  );", assignmentRouteStart);

  assert(
    assignmentRouteStart >= 0 && assignmentRouteEnd > assignmentRouteStart,
    "Assignment result route block could not be isolated."
  );
  const assignmentRoute = routes.slice(
    assignmentRouteStart,
    assignmentRouteEnd
  );
  const quizRouteSignature =
    '"/api/integrations/moodle/projections/classes/:classGroupId/quizzes/:quizProjectionId/attempts"';
  const quizRouteStart = routes.indexOf(quizRouteSignature);
  const quizRouteEnd = routes.indexOf("\n  );", quizRouteStart);
  assert(
    quizRouteStart >= 0 && quizRouteEnd > quizRouteStart,
    "Quiz attempt route block could not be isolated."
  );
  const quizRoute = routes.slice(quizRouteStart, quizRouteEnd);
  const gradeRouteSignature =
    '"/api/integrations/moodle/projections/classes/:classGroupId/grade-items/:gradeItemProjectionId/outcomes"';
  const gradeRouteStart = routes.indexOf(gradeRouteSignature);
  const gradeRouteEnd = routes.indexOf("\n  );", gradeRouteStart);
  assert(
    gradeRouteStart >= 0 && gradeRouteEnd > gradeRouteStart,
    "Grade outcome route block could not be isolated."
  );
  const gradeRoute = routes.slice(gradeRouteStart, gradeRouteEnd);
  const activityRouteSignature =
    '"/api/integrations/moodle/projections/classes/:classGroupId/activities/:activityProjectionId/outcomes"';
  const activityRouteStart = routes.indexOf(activityRouteSignature);
  const activityRouteEnd = routes.indexOf("\n  );", activityRouteStart);
  assert(
    activityRouteStart >= 0 && activityRouteEnd > activityRouteStart,
    "Activity outcome route block could not be isolated."
  );
  const activityRoute = routes.slice(activityRouteStart, activityRouteEnd);
  for (const forbidden of [
    "getMoodleClient",
    "callMoodle",
    "webservice/rest/server.php",
    "MOODLE_TOKEN",
  ]) {
    assert(
      !assignmentRoute.includes(forbidden),
      `Assignment result route must not call the provider: ${forbidden}.`
    );
  }
  for (const forbidden of [
    "getMoodleClient",
    "callMoodle",
    "webservice/rest/server.php",
    "MOODLE_TOKEN",
  ]) {
    assert(
      !quizRoute.includes(forbidden),
      `Quiz attempt route must not call the provider: ${forbidden}.`
    );
  }
  for (const forbidden of [
    "getMoodleClient",
    "callMoodle",
    "webservice/rest/server.php",
    "MOODLE_TOKEN",
  ]) {
    assert(
      !gradeRoute.includes(forbidden),
      `Grade outcome route must not call the provider: ${forbidden}.`
    );
  }
  for (const forbidden of [
    "getMoodleClient",
    "callMoodle",
    "webservice/rest/server.php",
    "MOODLE_TOKEN",
  ]) {
    assert(
      !activityRoute.includes(forbidden),
      `Activity outcome route must not call the provider: ${forbidden}.`
    );
  }

  exactSet(
    projectionRouteRegistrations(),
    routeSignatures,
    "Registered projection routes"
  );
  requirePhrases(
    routes,
    [
      "requireProjectionSession",
      "requireConfiguredProjection",
      "requireMinimumPrivilege",
      "getMoodleProjectionRepository",
      "MoodleProjectionRepositoryUnavailableError",
      "assertMoodleCatalogProjectionRole",
      "resolveMoodleCourseAuthority",
      "validateMoodleCourseMappings",
      "resolveMoodleProjectionObservation",
      "listProjectionObservations",
      "MoodleProjectionSnapshotError",
      'projectionFamily: "course_catalog"',
      'projectionFamily: "course_content"',
      '"/api/integrations/moodle/projections/classes/:classGroupId/enrollment-groups"',
      '"/api/integrations/moodle/projections/classes/:classGroupId/assessment-status"',
      '"/api/integrations/moodle/projections/classes/:classGroupId/assignments/:assignmentProjectionId/outcomes"',
      '"/api/integrations/moodle/projections/classes/:classGroupId/quizzes/:quizProjectionId/attempts"',
      '"/api/integrations/moodle/projections/classes/:classGroupId/grade-items/:gradeItemProjectionId/outcomes"',
      '"/api/integrations/moodle/projections/classes/:classGroupId/activities/:activityProjectionId/outcomes"',
      "resolveEnrollmentGroupContext",
      "getEnrollmentGroupFreshness",
      "resolveAssessmentStatusContext",
      "getAssessmentStatusFreshness",
      "resolveAssignmentResultContext",
      "getAssignmentResultFreshness",
      "resolveQuizAttemptContext",
      "getQuizAttemptFreshness",
      "resolveGradeOutcomeContext",
      "getGradeOutcomeFreshness",
      "resolveActivityOutcomeContext",
      "getActivityOutcomeFreshness",
      'session.authorizationModel !== "normalized"',
      "parseMoodleCoursesResponse",
      "parseMoodleCourseContentsResponse",
      'mode: "read_only"',
      "SessionRepositoryUnavailableError",
      "MoodleProjectionMappingError",
      "authorityObservedAt",
    ],
    "Moodle projection routes"
  );
  requirePhrases(
    repository,
    [
      "NILE_MOODLE_PROJECTION_REPOSITORY",
      "resolve_moodle_projection_context",
      "list_moodle_course_mappings_for_connection",
      "list_authorized_moodle_projection_freshness",
      "listProjectionObservations",
      "resolve_moodle_enrollment_group_context",
      "list_authorized_moodle_enrollment_group_freshness",
      "resolveEnrollmentGroupContext",
      "getEnrollmentGroupFreshness",
      "resolve_moodle_assessment_status_context",
      "list_authorized_moodle_assessment_status_freshness",
      "resolveAssessmentStatusContext",
      "getAssessmentStatusFreshness",
      "resolve_moodle_assignment_result_context",
      "list_authorized_moodle_assignment_result_freshness",
      "resolveAssignmentResultContext",
      "getAssignmentResultFreshness",
      "resolve_moodle_quiz_attempt_context",
      "list_authorized_moodle_quiz_attempt_freshness",
      "resolveQuizAttemptContext",
      "getQuizAttemptFreshness",
      "resolve_moodle_grade_outcome_context",
      "list_authorized_moodle_grade_outcome_freshness",
      "resolveGradeOutcomeContext",
      "getGradeOutcomeFreshness",
      "resolve_moodle_activity_outcome_context",
      "list_authorized_moodle_activity_outcome_freshness",
      "resolveActivityOutcomeContext",
      "getActivityOutcomeFreshness",
      'authorizationModel !== "normalized"',
      'session.provider !== "supabase"',
      "MoodleProjectionRepositoryAuthorityError",
      "MoodleProjectionRepositoryUnavailableError",
    ],
    "Moodle projection repository"
  );
  requirePhrases(
    freshness,
    [
      "hashMoodleProjectionPayload",
      "parseStoredMoodleProjection",
      "parseStoredMoodleEnrollmentGroupProjection",
      "parseStoredMoodleAssessmentStatusProjection",
      "parseStoredMoodleAssignmentResultProjection",
      "parseStoredMoodleQuizAttemptProjection",
      "parseStoredMoodleGradeOutcomeProjection",
      "parseStoredMoodleActivityOutcomeProjection",
      "resolveMoodleProjectionObservation",
      'availability: "unavailable"',
      'freshness: "unavailable"',
      'const freshness = latestSucceeded && now <= fresh ? "fresh" : "stale"',
      "now > retained",
      "payload.length !== success.itemCount",
      "hashMoodleProjectionPayload(payload) !== success.payloadHash.toLowerCase()",
      "MoodleProjectionSnapshotError",
      "sanitizeMoodleProjectionText",
    ],
    "Moodle projection freshness resolver"
  );
  requirePhrases(
    projection,
    [
      "resolveMoodleCourseAuthority",
      "assertMoodleProjectionIdentity",
      "MOODLE_CATALOG_PROJECTION_ROLES",
      "externalCourseId",
      "!/^[1-9]\\d*$/.test",
      "Number.isSafeInteger",
      "mappingStates.has",
      "byInternal.has",
      "byExternal.has",
      'session.activeRole === "student"',
      'session.activeRole === "teacher"',
      'session.activeRole === "headofdepartment"',
      'session.activeRole === "superadmin"',
      "course?.visible === false",
      "section.visible === true",
      "activity.visible === true",
      'reconciliationReason: "missing_mapping"',
      'reconciliationReason: "missing_provider_record"',
    ],
    "Moodle projection service"
  );
  assert(
    !routes.includes("dependencies.getState ?? getPlatformStateSnapshot") &&
      !routes.includes("getCourseMappings ?? (async () => [])"),
    "Projection routes must not use compatibility-state or empty-mapping fallbacks."
  );
  requirePhrases(
    readModels,
    [
      "sanitizeMoodleProjectionText",
      "unsafeHtmlBlockPattern",
      "emailPattern",
      "urlPattern",
      "phonePattern",
      "boundedArray",
      "parseMoodleCoursesResponse",
      "parseMoodleCourseContentsResponse",
    ],
    "Moodle read models"
  );
  requirePhrases(
    clientApi,
    [
      "fetchMoodleCourseCatalogProjectionRequest",
      "fetchMoodleCourseContentProjectionRequest",
      '"/api/integrations/moodle/projections/courses"',
      'mode: "read_only"',
      'authority: "server_course_relationships"',
    ],
    "Moodle projection client API"
  );
  requirePhrases(
    clientPage,
    [
      "fetchMoodleCourseCatalogProjectionRequest",
      'data-testid="moodle-source-loading"',
      'data-testid="moodle-source-error"',
      'data-testid="moodle-source-stale"',
      'data-testid="moodle-source-partial"',
      'data-testid="moodle-source-course"',
      "No Moodle courses are assigned",
      "Read-only Moodle course source",
    ],
    "Moodle source portal"
  );
  requirePhrases(
    contentPage,
    [
      "fetchMoodleCourseContentProjectionRequest",
      'data-testid="moodle-content-loading"',
      'data-testid="moodle-content-error"',
      'data-testid="moodle-content-stale"',
      'data-testid="moodle-content-partial"',
      'data-testid="moodle-content-empty"',
      'data-testid="moodle-content-ready"',
      "Read-only sections and activities",
    ],
    "Moodle course-content portal"
  );
  assert(
    !clientPage.includes("platformStore") &&
      !clientPage.includes("localStorage") &&
      !clientPage.includes("getState("),
    "Moodle source portal must not use client state as projection authority."
  );
  assert(
    !contentPage.includes("platformStore") &&
      !contentPage.includes("localStorage") &&
      !contentPage.includes("getState("),
    "Moodle course-content portal must not use client state as projection authority."
  );
  assert(
    !clientApi.includes('/api/integrations/moodle/projections/courses", {') &&
      !clientPage.includes("MOODLE_TOKEN") &&
      !clientPage.includes("webservice/rest/server.php"),
    "Moodle source portal must use a same-origin GET and never call the provider."
  );
}

function validate(candidate, { verifySource = true } = {}) {
  exactSet(
    Object.keys(candidate),
    [
      "version",
      "contractId",
      "phase",
      "mode",
      "sourceFiles",
      "authority",
      "externalIds",
      "roleScopes",
      "readModels",
      "states",
      "projectionRoutes",
      "failureBehavior",
      "portalReadBoundary",
      "writeBoundary",
      "observationPolicies",
    ],
    "Manifest keys"
  );
  assert(candidate.version === 1, "Manifest version must be 1.");
  assert(
    candidate.contractId === "integration-phase6-moodle-projections",
    "Contract ID mismatch."
  );
  assert(candidate.phase === 6, "Contract phase must be 6.");
  assert(
    candidate.mode === "server_scoped_read_only",
    "Projection mode must remain server-scoped and read-only."
  );
  for (const [key, expected] of Object.entries(exactObjects)) {
    exactObject(candidate[key], expected, key);
  }

  exactSet(
    Object.keys(candidate.readModels),
    ["rawProviderPayloadAllowed", "parsers", "sanitization", "allowedFields"],
    "Read model keys"
  );
  assert(
    candidate.readModels.rawProviderPayloadAllowed === false,
    "Raw provider payloads cannot cross the projection boundary."
  );
  exactSet(candidate.readModels.parsers, expectedSets.parsers, "Read parsers");
  exactSet(
    candidate.readModels.sanitization,
    expectedSets.sanitization,
    "Sanitization rules"
  );
  exactSet(
    Object.keys(candidate.readModels.allowedFields),
    [
      "course",
      "section",
      "activity",
      "enrollmentPerson",
      "enrollmentLearner",
      "enrollmentAggregate",
      "assessmentStatus",
      "assessmentStatusItem",
      "assignmentResultPerson",
      "assignmentResultLearner",
      "assignmentResultAggregate",
      "quizAttemptPerson",
      "quizAttemptLearner",
      "quizAttemptAggregate",
      "gradeOutcomePerson",
      "gradeOutcomeLearner",
      "gradeOutcomeAggregate",
      "activityOutcomePerson",
      "activityOutcomeLearner",
      "activityOutcomeAggregate",
    ],
    "Read model field groups"
  );
  exactSet(
    candidate.readModels.allowedFields.course,
    expectedSets.courseFields,
    "Course fields"
  );
  exactSet(
    candidate.readModels.allowedFields.section,
    expectedSets.sectionFields,
    "Section fields"
  );
  exactSet(
    candidate.readModels.allowedFields.activity,
    expectedSets.activityFields,
    "Activity fields"
  );
  exactSet(
    candidate.readModels.allowedFields.enrollmentPerson,
    expectedSets.enrollmentPersonFields,
    "Enrollment person fields"
  );
  exactSet(
    candidate.readModels.allowedFields.enrollmentLearner,
    expectedSets.enrollmentLearnerFields,
    "Enrollment learner fields"
  );
  exactSet(
    candidate.readModels.allowedFields.enrollmentAggregate,
    expectedSets.enrollmentAggregateFields,
    "Enrollment aggregate fields"
  );
  exactSet(
    candidate.readModels.allowedFields.assessmentStatus,
    expectedSets.assessmentStatusFields,
    "Assessment status fields"
  );
  exactSet(
    candidate.readModels.allowedFields.assessmentStatusItem,
    expectedSets.assessmentStatusItemFields,
    "Assessment status item fields"
  );
  exactSet(
    candidate.readModels.allowedFields.assignmentResultPerson,
    expectedSets.assignmentResultPersonFields,
    "Assignment result person fields"
  );
  exactSet(
    candidate.readModels.allowedFields.assignmentResultLearner,
    expectedSets.assignmentResultLearnerFields,
    "Assignment result learner fields"
  );
  exactSet(
    candidate.readModels.allowedFields.assignmentResultAggregate,
    expectedSets.assignmentResultAggregateFields,
    "Assignment result aggregate fields"
  );
  exactSet(
    candidate.readModels.allowedFields.quizAttemptPerson,
    expectedSets.quizAttemptPersonFields,
    "Quiz attempt person fields"
  );
  exactSet(
    candidate.readModels.allowedFields.quizAttemptLearner,
    expectedSets.quizAttemptLearnerFields,
    "Quiz attempt learner fields"
  );
  exactSet(
    candidate.readModels.allowedFields.quizAttemptAggregate,
    expectedSets.quizAttemptAggregateFields,
    "Quiz attempt aggregate fields"
  );
  exactSet(
    candidate.readModels.allowedFields.gradeOutcomePerson,
    expectedSets.gradeOutcomePersonFields,
    "Grade outcome person fields"
  );
  exactSet(
    candidate.readModels.allowedFields.gradeOutcomeLearner,
    expectedSets.gradeOutcomeLearnerFields,
    "Grade outcome learner fields"
  );
  exactSet(
    candidate.readModels.allowedFields.gradeOutcomeAggregate,
    expectedSets.gradeOutcomeAggregateFields,
    "Grade outcome aggregate fields"
  );
  exactSet(
    candidate.readModels.allowedFields.activityOutcomePerson,
    expectedSets.activityOutcomePersonFields,
    "Activity outcome person fields"
  );
  exactSet(
    candidate.readModels.allowedFields.activityOutcomeLearner,
    expectedSets.activityOutcomeLearnerFields,
    "Activity outcome learner fields"
  );
  exactSet(
    candidate.readModels.allowedFields.activityOutcomeAggregate,
    expectedSets.activityOutcomeAggregateFields,
    "Activity outcome aggregate fields"
  );
  const assignmentResultFields = JSON.stringify({
    person: candidate.readModels.allowedFields.assignmentResultPerson,
    learner: candidate.readModels.allowedFields.assignmentResultLearner,
    aggregate: candidate.readModels.allowedFields.assignmentResultAggregate,
  }).toLowerCase();
  for (const forbidden of [
    "sourceid",
    "externalid",
    "file",
    "answer",
    "comment",
    "feedback",
    "grader",
  ]) {
    assert(
      !assignmentResultFields.includes(forbidden),
      `Assignment result read model exposes forbidden field: ${forbidden}.`
    );
  }
  const activityOutcomeFields = JSON.stringify({
    person: candidate.readModels.allowedFields.activityOutcomePerson,
    learner: candidate.readModels.allowedFields.activityOutcomeLearner,
    aggregate: candidate.readModels.allowedFields.activityOutcomeAggregate,
  }).toLowerCase();
  for (const forbidden of [
    "sourceid",
    "externalid",
    "track",
    "interaction",
    "question",
    "answer",
    "comment",
    "file",
    "grader",
  ]) {
    assert(
      !activityOutcomeFields.includes(forbidden),
      `Activity outcome read model exposes forbidden field: ${forbidden}.`
    );
  }
  const quizAttemptFields = JSON.stringify({
    person: candidate.readModels.allowedFields.quizAttemptPerson,
    learner: candidate.readModels.allowedFields.quizAttemptLearner,
    aggregate: candidate.readModels.allowedFields.quizAttemptAggregate,
  }).toLowerCase();
  for (const forbidden of [
    "sourceid",
    "externalid",
    "question",
    "answer",
    "comment",
    "feedback",
    "file",
  ]) {
    assert(
      !quizAttemptFields.includes(forbidden),
      `Quiz attempt read model exposes forbidden field: ${forbidden}.`
    );
  }
  const gradeOutcomeFields = JSON.stringify({
    person: candidate.readModels.allowedFields.gradeOutcomePerson,
    learner: candidate.readModels.allowedFields.gradeOutcomeLearner,
    aggregate: candidate.readModels.allowedFields.gradeOutcomeAggregate,
  }).toLowerCase();
  for (const forbidden of [
    "sourceid",
    "externalid",
    "question",
    "answer",
    "comment",
    "file",
    "grader",
  ]) {
    assert(
      !gradeOutcomeFields.includes(forbidden),
      `Grade outcome read model exposes forbidden field: ${forbidden}.`
    );
  }

  exactSet(
    Object.keys(candidate.observationPolicies),
    ["assignmentResults", "quizAttempts", "gradeOutcomes", "activityOutcomes"],
    "Observation policy families"
  );
  exactObject(
    candidate.observationPolicies.assignmentResults,
    {
      projectionFamily: "assignment_results",
      freshnessMinutes: 15,
      retentionDaysMaximum: 30,
      providerCallOnRead: false,
      providerWriteAllowed: false,
    },
    "Assignment result observation policy"
  );
  exactObject(
    candidate.observationPolicies.quizAttempts,
    {
      projectionFamily: "quiz_attempts",
      freshnessMinutes: 15,
      retentionDaysMaximum: 30,
      providerCallOnRead: false,
      providerWriteAllowed: false,
    },
    "Quiz attempt observation policy"
  );
  exactObject(
    candidate.observationPolicies.gradeOutcomes,
    {
      projectionFamily: "grade_outcomes",
      freshnessMinutes: 15,
      retentionDaysMaximum: 30,
      providerCallOnRead: false,
      providerWriteAllowed: false,
      learnerFeedbackRequiresRelease: true,
    },
    "Grade outcome observation policy"
  );
  exactObject(
    candidate.observationPolicies.activityOutcomes,
    {
      projectionFamily: "activity_outcomes",
      activityKinds: ["lesson", "h5p", "scorm"],
      freshnessMinutes: 15,
      retentionDaysMaximum: 30,
      providerCallOnRead: false,
      providerWriteAllowed: false,
      releasedScoresOnly: true,
      rawTracksAllowed: false,
    },
    "Activity outcome observation policy"
  );

  exactSet(
    Object.keys(candidate.states),
    ["freshness", "availability", "mapping", "reconciliationReasons"],
    "State keys"
  );
  for (const key of [
    "freshness",
    "availability",
    "mapping",
    "reconciliationReasons",
  ]) {
    exactSet(candidate.states[key], expectedSets[key], `${key} states`);
  }

  assert(
    Array.isArray(candidate.projectionRoutes) &&
      candidate.projectionRoutes.length === 8,
    "Exactly eight Phase 6 projection routes are allowed."
  );
  exactSet(
    candidate.projectionRoutes.map(route => `${route.method} ${route.path}`),
    routeSignatures,
    "Projection routes"
  );
  for (const route of candidate.projectionRoutes) {
    exactSet(
      Object.keys(route),
      ["method", "path", "family", "roles", "providerLookup"],
      `${route.path} keys`
    );
    assert(route.method === "GET", `${route.path} must remain GET-only.`);
    const expectedFamily = new Map([
      ["/api/integrations/moodle/projections/courses", "course_catalog"],
      [
        "/api/integrations/moodle/projections/courses/:courseId/content",
        "course_content",
      ],
      [
        "/api/integrations/moodle/projections/classes/:classGroupId/enrollment-groups",
        "enrollment_groups",
      ],
      [
        "/api/integrations/moodle/projections/classes/:classGroupId/assessment-status",
        "assessment_status",
      ],
      [
        "/api/integrations/moodle/projections/classes/:classGroupId/assignments/:assignmentProjectionId/outcomes",
        "assignment_results",
      ],
      [
        "/api/integrations/moodle/projections/classes/:classGroupId/quizzes/:quizProjectionId/attempts",
        "quiz_attempts",
      ],
      [
        "/api/integrations/moodle/projections/classes/:classGroupId/grade-items/:gradeItemProjectionId/outcomes",
        "grade_outcomes",
      ],
      [
        "/api/integrations/moodle/projections/classes/:classGroupId/activities/:activityProjectionId/outcomes",
        "activity_outcomes",
      ],
    ]).get(route.path);
    assert(route.family === expectedFamily, `${route.path} family mismatch.`);
    exactSet(
      route.roles,
      route.path.includes("enrollment-groups") ? classProjectionRoles : roles,
      `${route.path} roles`
    );
    assert(
      route.providerLookup === "server_resolved_exact_mapping",
      `${route.path} must resolve provider identity server-side.`
    );
  }

  exactSet(
    Object.keys(candidate.writeBoundary),
    [
      "allowedMethods",
      "portalWriteRoutesAllowed",
      "productionMoodleWritesEnabled",
      "writeFunctionsAllowed",
    ],
    "Write boundary keys"
  );
  exactSet(candidate.writeBoundary.allowedMethods, ["GET"], "Allowed methods");
  assert(
    candidate.writeBoundary.portalWriteRoutesAllowed === false &&
      candidate.writeBoundary.productionMoodleWritesEnabled === false &&
      Array.isArray(candidate.writeBoundary.writeFunctionsAllowed) &&
      candidate.writeBoundary.writeFunctionsAllowed.length === 0,
    "No portal or production Moodle write surface is allowed."
  );
  if (verifySource) validateSource(candidate);
}

function assertRejected(candidate, label) {
  try {
    validate(candidate, { verifySource: false });
  } catch {
    return;
  }
  throw new Error(`Negative control was accepted: ${label}`);
}

function runNegativeControls(candidate) {
  const controls = [
    [
      "title fallback",
      draft => (draft.externalIds.titleOrNameFallbackAllowed = true),
    ],
    [
      "provider data without mapping",
      draft => (draft.externalIds.missingMappingProjectsProviderData = true),
    ],
    [
      "request authority",
      draft => (draft.authority.requestAuthorityAllowed = true),
    ],
    [
      "client role scope",
      draft => (draft.roleScopes.student = "request_student_id"),
    ],
    [
      "raw payload",
      draft => (draft.readModels.rawProviderPayloadAllowed = true),
    ],
    ["missing freshness state", draft => draft.states.freshness.pop()],
    [
      "missing reconciliation state",
      draft => draft.states.reconciliationReasons.pop(),
    ],
    [
      "outage authority fallback",
      draft => (draft.failureBehavior.providerOutage = "use_stale_authority"),
    ],
    ["write route", draft => (draft.projectionRoutes[0].method = "POST")],
    [
      "production write enabled",
      draft => (draft.writeBoundary.productionMoodleWritesEnabled = true),
    ],
    [
      "portal local fallback",
      draft => (draft.portalReadBoundary.localStateFallbackAllowed = true),
    ],
    [
      "browser provider call",
      draft => (draft.portalReadBoundary.browserProviderCallAllowed = true),
    ],
    [
      "assignment result provider call",
      draft =>
        (draft.observationPolicies.assignmentResults.providerCallOnRead = true),
    ],
    [
      "assignment result retention expansion",
      draft =>
        (draft.observationPolicies.assignmentResults.retentionDaysMaximum = 31),
    ],
    [
      "quiz attempt provider call",
      draft =>
        (draft.observationPolicies.quizAttempts.providerCallOnRead = true),
    ],
    [
      "quiz attempt retention expansion",
      draft =>
        (draft.observationPolicies.quizAttempts.retentionDaysMaximum = 31),
    ],
    [
      "grade outcome provider call",
      draft =>
        (draft.observationPolicies.gradeOutcomes.providerCallOnRead = true),
    ],
    [
      "grade outcome retention expansion",
      draft =>
        (draft.observationPolicies.gradeOutcomes.retentionDaysMaximum = 31),
    ],
    [
      "unreleased learner feedback",
      draft =>
        (draft.observationPolicies.gradeOutcomes.learnerFeedbackRequiresRelease = false),
    ],
    [
      "activity outcome provider call",
      draft =>
        (draft.observationPolicies.activityOutcomes.providerCallOnRead = true),
    ],
    [
      "activity outcome retention expansion",
      draft =>
        (draft.observationPolicies.activityOutcomes.retentionDaysMaximum = 31),
    ],
    [
      "activity raw tracks",
      draft =>
        (draft.observationPolicies.activityOutcomes.rawTracksAllowed = true),
    ],
  ];
  for (const [label, mutate] of controls) {
    const draft = structuredClone(candidate);
    mutate(draft);
    assertRejected(draft, label);
  }
  return controls.length;
}

function validateAttestation() {
  assert(fs.existsSync(attestationPath), "Phase 6 attestation is missing.");
  const attestation = JSON.parse(fs.readFileSync(attestationPath, "utf8"));
  assert(
    attestation.status === "contract-accepted-provider-activation-pending",
    "Phase 6 attestation must preserve its incomplete activation status."
  );
  const qualityGate = attestation.qualityGate;
  assert(
    qualityGate?.totalChecks === 1598 && qualityGate.failedChecks === 0,
    "Phase 6 attestation must preserve the 1,598/0 portal baseline."
  );
  assert(
    qualityGate.verifyPassed === true &&
      qualityGate.typescriptPassed === true &&
      qualityGate.buildPassed === true,
    "Phase 6 quality gates are incomplete."
  );
  const artifactPath = path.join(root, qualityGate.artifact);
  if (fs.existsSync(artifactPath)) {
    assert(
      sha256(artifactPath) === qualityGate.artifactSha256,
      "Phase 6 QA artifact hash does not match its attestation."
    );
  }
  assert(
    attestation.liveMoodleProviderContacted === false &&
      attestation.productionRuntimeActivated === false &&
      attestation.productionDatabaseModified === false,
    "Phase 6 attestation overstates production or live-provider activation."
  );
  assert(
    Array.isArray(attestation.remainingGates) &&
      attestation.remainingGates.length === 6,
    "Phase 6 remaining gates must stay explicit."
  );
}

try {
  const candidate = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  validate(candidate);
  validateAttestation();
  console.log(
    JSON.stringify(
      {
        ok: true,
        contractId: candidate.contractId,
        phase: candidate.phase,
        projectionRoutes: candidate.projectionRoutes.length,
        roleScopes: Object.keys(candidate.roleScopes).length,
        freshnessStates: candidate.states.freshness.length,
        reconciliationReasons: candidate.states.reconciliationReasons.length,
        writeRoutes: 0,
        negativeControls: runNegativeControls(candidate),
        qualityGateChecks: 1598,
        networkAccessed: false,
      },
      null,
      2
    )
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
