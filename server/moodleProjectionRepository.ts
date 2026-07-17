import type { ServerRole, ServerSession } from "./auth.js";
import type {
  MoodleCourseMapping,
  MoodleMappingState,
} from "./moodleProjectionService.js";
import type {
  MoodleEnrollmentGroupAudience,
  MoodleEnrollmentGroupProjection,
  MoodleAssessmentStatusProjection,
  MoodleAssignmentResultAudience,
  MoodleAssignmentResultProjection,
  MoodleQuizAttemptAudience,
  MoodleQuizAttemptProjection,
  MoodleGradeOutcomeAudience,
  MoodleGradeOutcomeProjection,
  MoodleActivityOutcomeAudience,
  MoodleActivityOutcomeKind,
  MoodleActivityOutcomeProjection,
  MoodleProjectionFamily,
  MoodleProjectionObservation,
  MoodleProjectionOutcome,
} from "./moodleProjectionFreshness.js";
import {
  hashMoodleProjectionPayload,
  parseStoredMoodleAssessmentStatusProjection,
  parseStoredMoodleAssignmentResultProjection,
  parseStoredMoodleQuizAttemptProjection,
  parseStoredMoodleGradeOutcomeProjection,
  parseStoredMoodleActivityOutcomeProjection,
  parseStoredMoodleEnrollmentGroupProjection,
} from "./moodleProjectionFreshness.js";
import { getSupabaseServerStatus, supabaseAdminRestFetch } from "./supabase.js";

type SupabaseAdminFetch = typeof supabaseAdminRestFetch;

export type MoodleCourseAuthority = Readonly<{
  connectionId: string;
  activeRole: Extract<
    ServerRole,
    "student" | "teacher" | "headofdepartment" | "superadmin"
  >;
  authorizedCourseIds: readonly string[];
  observedAt: string;
}>;

export type MoodleUserAuthority = Readonly<{
  activeRole: Extract<
    ServerRole,
    "student" | "teacher" | "headofdepartment" | "superadmin"
  >;
  authorizedUserIds: readonly string[];
  observedAt: string;
}>;

export type MoodleUserMapping = Readonly<{
  externalRecordId: string;
  internalUserId: string;
  externalUserId: string;
  state: MoodleMappingState;
  lastSeenAt?: string;
}>;

export type MoodleEnrollmentGroupContext = Readonly<{
  connectionId: string;
  activeRole: Extract<
    ServerRole,
    "teacher" | "headofdepartment" | "superadmin"
  >;
  audience: MoodleEnrollmentGroupAudience;
  internalCourseId: string;
  internalCourseRunId: string;
  internalClassGroupId: string;
  authorizedUserIds: readonly string[];
  courseMappingStatus: "exact" | "missing";
  groupMappingStatus: "exact" | "missing";
  userMappingStatus: "exact" | "missing";
  observedAt: string;
}>;

export type MoodleEnrollmentGroupFreshness = Readonly<{
  context: MoodleEnrollmentGroupContext;
  freshnessState:
    | "fresh"
    | "stale_retained"
    | "expired"
    | "reconciliation"
    | "unavailable";
  latestOutcome?: "available" | "empty" | "unavailable" | "reconciliation";
  reconciliationReason?:
    | "missing_course_mapping"
    | "missing_group_mapping"
    | "missing_user_mapping"
    | "provider_membership_drift"
    | "ambiguous_mapping";
  projection?: MoodleEnrollmentGroupProjection;
  projectionHash?: string;
  successfulSyncRunId?: string;
  successfulObservedAt?: string;
  freshUntil?: string;
  retainUntil?: string;
  latestObservedAt?: string;
}>;

export type MoodleAssessmentStatusAudience = "learner" | "class_staff";

export type MoodleAssessmentStatusContext = Readonly<{
  connectionId: string;
  activeRole: Extract<
    ServerRole,
    "student" | "teacher" | "headofdepartment" | "superadmin"
  >;
  audience: MoodleAssessmentStatusAudience;
  internalCourseId: string;
  internalCourseRunId: string;
  internalClassGroupId: string;
  subjectUserId?: string;
  courseMappingStatus: "exact" | "missing";
  groupMappingStatus: "exact" | "missing";
  userMappingStatus: "exact" | "missing" | "not_required";
  assessmentMappingStatus: "exact" | "missing" | "reconciliation";
  observedAt: string;
}>;

export type MoodleAssessmentStatusFreshness = Readonly<{
  context: MoodleAssessmentStatusContext;
  freshnessState:
    | "fresh"
    | "stale_retained"
    | "expired"
    | "reconciliation"
    | "unavailable";
  latestOutcome?: "available" | "empty" | "unavailable" | "reconciliation";
  reconciliationReason?:
    | "missing_course_mapping"
    | "missing_group_mapping"
    | "missing_user_mapping"
    | "missing_assessment_mapping"
    | "provider_schedule_drift"
    | "ambiguous_mapping";
  projection?: MoodleAssessmentStatusProjection;
  projectionHash?: string;
  successfulSyncRunId?: string;
  successfulObservedAt?: string;
  freshUntil?: string;
  retainUntil?: string;
  latestObservedAt?: string;
}>;

export type MoodleAssignmentResultContext = Readonly<{
  connectionId: string;
  activeRole: Extract<
    ServerRole,
    "student" | "teacher" | "headofdepartment" | "superadmin"
  >;
  audience: MoodleAssignmentResultAudience;
  internalCourseId: string;
  internalCourseRunId: string;
  internalClassGroupId: string;
  assignmentProjectionId: string;
  authorizedUserIds: readonly string[];
  courseMappingStatus: "exact" | "missing";
  groupMappingStatus: "exact" | "missing";
  userMappingStatus: "exact" | "missing";
  assignmentMappingStatus: "exact" | "missing";
  observedAt: string;
}>;

export type MoodleAssignmentResultFreshness = Readonly<{
  context: MoodleAssignmentResultContext;
  freshnessState:
    | "fresh"
    | "stale_retained"
    | "expired"
    | "reconciliation"
    | "unavailable";
  latestOutcome?: "available" | "empty" | "unavailable" | "reconciliation";
  reconciliationReason?:
    | "missing_course_mapping"
    | "missing_group_mapping"
    | "missing_user_mapping"
    | "missing_assignment_mapping"
    | "provider_result_drift"
    | "ambiguous_mapping";
  projection?: MoodleAssignmentResultProjection;
  projectionHash?: string;
  successfulSyncRunId?: string;
  successfulObservedAt?: string;
  freshUntil?: string;
  retainUntil?: string;
  latestObservedAt?: string;
}>;

export type MoodleQuizAttemptContext = Readonly<{
  connectionId: string;
  activeRole: Extract<
    ServerRole,
    "student" | "teacher" | "headofdepartment" | "superadmin"
  >;
  audience: MoodleQuizAttemptAudience;
  internalCourseId: string;
  internalCourseRunId: string;
  internalClassGroupId: string;
  quizProjectionId: string;
  authorizedUserIds: readonly string[];
  courseMappingStatus: "exact" | "missing";
  groupMappingStatus: "exact" | "missing";
  userMappingStatus: "exact" | "missing";
  quizMappingStatus: "exact" | "missing";
  observedAt: string;
}>;

export type MoodleQuizAttemptFreshness = Readonly<{
  context: MoodleQuizAttemptContext;
  freshnessState:
    | "fresh"
    | "stale_retained"
    | "expired"
    | "reconciliation"
    | "unavailable";
  latestOutcome?: "available" | "empty" | "unavailable" | "reconciliation";
  reconciliationReason?:
    | "missing_course_mapping"
    | "missing_group_mapping"
    | "missing_user_mapping"
    | "missing_quiz_mapping"
    | "provider_result_drift"
    | "ambiguous_mapping";
  projection?: MoodleQuizAttemptProjection;
  projectionHash?: string;
  successfulSyncRunId?: string;
  successfulObservedAt?: string;
  freshUntil?: string;
  retainUntil?: string;
  latestObservedAt?: string;
}>;

export type MoodleGradeOutcomeContext = Readonly<{
  connectionId: string;
  activeRole: Extract<
    ServerRole,
    "student" | "teacher" | "headofdepartment" | "superadmin"
  >;
  audience: MoodleGradeOutcomeAudience;
  internalCourseId: string;
  internalCourseRunId: string;
  internalClassGroupId: string;
  gradeItemProjectionId: string;
  authorizedUserIds: readonly string[];
  courseMappingStatus: "exact" | "missing";
  groupMappingStatus: "exact" | "missing";
  userMappingStatus: "exact" | "missing";
  gradeItemMappingStatus: "exact" | "missing";
  observedAt: string;
}>;

export type MoodleGradeOutcomeFreshness = Readonly<{
  context: MoodleGradeOutcomeContext;
  freshnessState:
    | "fresh"
    | "stale_retained"
    | "expired"
    | "reconciliation"
    | "unavailable";
  latestOutcome?: "available" | "empty" | "unavailable" | "reconciliation";
  reconciliationReason?:
    | "missing_course_mapping"
    | "missing_group_mapping"
    | "missing_user_mapping"
    | "missing_grade_item_mapping"
    | "provider_result_drift"
    | "ambiguous_mapping";
  projection?: MoodleGradeOutcomeProjection;
  projectionHash?: string;
  successfulSyncRunId?: string;
  successfulObservedAt?: string;
  freshUntil?: string;
  retainUntil?: string;
  latestObservedAt?: string;
}>;

export type MoodleActivityOutcomeContext = Readonly<{
  connectionId: string;
  activeRole: Extract<
    ServerRole,
    "student" | "teacher" | "headofdepartment" | "superadmin"
  >;
  audience: MoodleActivityOutcomeAudience;
  internalCourseId: string;
  internalCourseRunId: string;
  internalClassGroupId: string;
  activityProjectionId: string;
  activityKind: MoodleActivityOutcomeKind;
  authorizedUserIds: readonly string[];
  courseMappingStatus: "exact" | "missing";
  groupMappingStatus: "exact" | "missing";
  userMappingStatus: "exact" | "missing";
  activityMappingStatus: "exact" | "missing";
  observedAt: string;
}>;

export type MoodleActivityOutcomeFreshness = Readonly<{
  context: MoodleActivityOutcomeContext;
  freshnessState:
    | "fresh"
    | "stale_retained"
    | "expired"
    | "reconciliation"
    | "unavailable";
  latestOutcome?: "available" | "empty" | "unavailable" | "reconciliation";
  reconciliationReason?:
    | "missing_course_mapping"
    | "missing_group_mapping"
    | "missing_user_mapping"
    | "missing_activity_mapping"
    | "provider_result_drift"
    | "ambiguous_mapping";
  projection?: MoodleActivityOutcomeProjection;
  projectionHash?: string;
  successfulSyncRunId?: string;
  successfulObservedAt?: string;
  freshUntil?: string;
  retainUntil?: string;
  latestObservedAt?: string;
}>;

export type MoodleProjectionRepository = Readonly<{
  kind: "supabase";
  resolveCourseAuthority(
    session: ServerSession
  ): Promise<MoodleCourseAuthority>;
  listCourseMappings(
    connectionId: string,
    internalCourseIds: readonly string[]
  ): Promise<readonly MoodleCourseMapping[]>;
  resolveUserAuthority(session: ServerSession): Promise<MoodleUserAuthority>;
  listUserMappings(
    connectionId: string,
    internalUserIds: readonly string[]
  ): Promise<readonly MoodleUserMapping[]>;
  listProjectionObservations(input: {
    session: ServerSession;
    authority: MoodleCourseAuthority;
    projectionFamily: MoodleProjectionFamily;
    asOf: string;
    internalCourseIds?: readonly string[];
  }): Promise<readonly MoodleCourseProjectionObservation[]>;
  resolveEnrollmentGroupContext(
    session: ServerSession,
    internalClassGroupId: string
  ): Promise<MoodleEnrollmentGroupContext>;
  getEnrollmentGroupFreshness(input: {
    session: ServerSession;
    context: MoodleEnrollmentGroupContext;
    asOf: string;
  }): Promise<MoodleEnrollmentGroupFreshness>;
  resolveAssessmentStatusContext(
    session: ServerSession,
    internalClassGroupId: string
  ): Promise<MoodleAssessmentStatusContext>;
  getAssessmentStatusFreshness(input: {
    session: ServerSession;
    context: MoodleAssessmentStatusContext;
    asOf: string;
  }): Promise<MoodleAssessmentStatusFreshness>;
  resolveAssignmentResultContext(
    session: ServerSession,
    internalClassGroupId: string,
    assignmentProjectionId: string
  ): Promise<MoodleAssignmentResultContext>;
  getAssignmentResultFreshness(input: {
    session: ServerSession;
    context: MoodleAssignmentResultContext;
    asOf: string;
  }): Promise<MoodleAssignmentResultFreshness>;
  resolveQuizAttemptContext(
    session: ServerSession,
    internalClassGroupId: string,
    quizProjectionId: string
  ): Promise<MoodleQuizAttemptContext>;
  getQuizAttemptFreshness(input: {
    session: ServerSession;
    context: MoodleQuizAttemptContext;
    asOf: string;
  }): Promise<MoodleQuizAttemptFreshness>;
  resolveGradeOutcomeContext(
    session: ServerSession,
    internalClassGroupId: string,
    gradeItemProjectionId: string
  ): Promise<MoodleGradeOutcomeContext>;
  getGradeOutcomeFreshness(input: {
    session: ServerSession;
    context: MoodleGradeOutcomeContext;
    asOf: string;
  }): Promise<MoodleGradeOutcomeFreshness>;
  resolveActivityOutcomeContext(
    session: ServerSession,
    internalClassGroupId: string,
    activityProjectionId: string
  ): Promise<MoodleActivityOutcomeContext>;
  getActivityOutcomeFreshness(input: {
    session: ServerSession;
    context: MoodleActivityOutcomeContext;
    asOf: string;
  }): Promise<MoodleActivityOutcomeFreshness>;
}>;

export type MoodleCourseProjectionObservation = Readonly<{
  internalCourseId: string;
  externalCourseId?: string;
  mappingState?: MoodleMappingState;
  reconciliationReason?:
    | "missing_mapping"
    | "missing_provider_record"
    | "ambiguous_mapping";
  observation: MoodleProjectionObservation | null;
}>;

export class MoodleProjectionRepositoryUnavailableError extends Error {
  constructor(message = "Moodle projection persistence is unavailable.") {
    super(message);
    this.name = "MoodleProjectionRepositoryUnavailableError";
  }
}

export class MoodleProjectionRepositoryAuthorityError extends Error {
  constructor(message = "Moodle projection authority was denied.") {
    super(message);
    this.name = "MoodleProjectionRepositoryAuthorityError";
  }
}

type MoodleProjectionRepositoryOptions = Readonly<{
  env?: NodeJS.ProcessEnv;
  adminFetch?: SupabaseAdminFetch;
}>;

type AuthorityRow = {
  connection_id: unknown;
  active_role: unknown;
  authorized_course_ids: unknown;
  observed_at: unknown;
};

type MappingRow = {
  internal_course_id: unknown;
  external_record_id: unknown;
  external_course_id: unknown;
  sync_state: unknown;
  last_seen_at?: unknown;
  last_synced_at?: unknown;
};

type UserAuthorityRow = {
  active_role: unknown;
  authorized_user_ids: unknown;
  observed_at: unknown;
};

type UserMappingRow = {
  external_record_id: unknown;
  internal_user_id: unknown;
  external_user_id: unknown;
  sync_state: unknown;
  last_seen_at?: unknown;
};

type ProjectionObservationRow = {
  connection_id: unknown;
  active_role: unknown;
  internal_course_id: unknown;
  external_course_id?: unknown;
  mapping_state?: unknown;
  projection_family: unknown;
  freshness_state?: unknown;
  latest_outcome?: unknown;
  reconciliation_reason?: unknown;
  sanitized_payload?: unknown;
  projection_hash?: unknown;
  successful_sync_run_id?: unknown;
  successful_observed_at?: unknown;
  fresh_until?: unknown;
  retain_until?: unknown;
  latest_observed_at?: unknown;
};

type EnrollmentGroupContextRow = {
  connection_id: unknown;
  active_role: unknown;
  projection_audience: unknown;
  internal_course_id: unknown;
  internal_course_run_id: unknown;
  internal_class_group_id: unknown;
  authorized_user_ids: unknown;
  course_mapping_status: unknown;
  group_mapping_status: unknown;
  user_mapping_status: unknown;
  observed_at: unknown;
};

type EnrollmentGroupFreshnessRow = {
  connection_id: unknown;
  active_role: unknown;
  projection_audience: unknown;
  internal_course_id: unknown;
  internal_class_group_id: unknown;
  course_mapping_status: unknown;
  group_mapping_status: unknown;
  user_mapping_status: unknown;
  freshness_state: unknown;
  latest_outcome?: unknown;
  reconciliation_reason?: unknown;
  sanitized_payload?: unknown;
  projection_hash?: unknown;
  successful_sync_run_id?: unknown;
  successful_observed_at?: unknown;
  fresh_until?: unknown;
  retain_until?: unknown;
  latest_observed_at?: unknown;
  authority_observed_at: unknown;
};

type AssessmentStatusContextRow = {
  connection_id: unknown;
  active_role: unknown;
  projection_audience: unknown;
  internal_course_id: unknown;
  internal_course_run_id: unknown;
  internal_class_group_id: unknown;
  subject_user_id?: unknown;
  course_mapping_status: unknown;
  group_mapping_status: unknown;
  user_mapping_status: unknown;
  assessment_mapping_status: unknown;
  observed_at: unknown;
};

type AssessmentStatusFreshnessRow = AssessmentStatusContextRow & {
  freshness_state: unknown;
  latest_outcome?: unknown;
  reconciliation_reason?: unknown;
  sanitized_payload?: unknown;
  projection_hash?: unknown;
  successful_sync_run_id?: unknown;
  successful_observed_at?: unknown;
  fresh_until?: unknown;
  retain_until?: unknown;
  latest_observed_at?: unknown;
  authority_observed_at: unknown;
};

type AssignmentResultContextRow = {
  connection_id: unknown;
  active_role: unknown;
  projection_audience: unknown;
  internal_course_id: unknown;
  internal_course_run_id: unknown;
  internal_class_group_id: unknown;
  assignment_projection_id: unknown;
  authorized_user_ids: unknown;
  course_mapping_status: unknown;
  group_mapping_status: unknown;
  user_mapping_status: unknown;
  assignment_mapping_status: unknown;
  observed_at: unknown;
};

type AssignmentResultFreshnessRow = AssignmentResultContextRow & {
  freshness_state: unknown;
  latest_outcome?: unknown;
  reconciliation_reason?: unknown;
  sanitized_payload?: unknown;
  projection_hash?: unknown;
  successful_sync_run_id?: unknown;
  successful_observed_at?: unknown;
  fresh_until?: unknown;
  retain_until?: unknown;
  latest_observed_at?: unknown;
  authority_observed_at: unknown;
};

type QuizAttemptContextRow = {
  connection_id: unknown;
  active_role: unknown;
  projection_audience: unknown;
  internal_course_id: unknown;
  internal_course_run_id: unknown;
  internal_class_group_id: unknown;
  quiz_projection_id: unknown;
  authorized_user_ids: unknown;
  course_mapping_status: unknown;
  group_mapping_status: unknown;
  user_mapping_status: unknown;
  quiz_mapping_status: unknown;
  observed_at: unknown;
};

type QuizAttemptFreshnessRow = QuizAttemptContextRow & {
  freshness_state: unknown;
  latest_outcome?: unknown;
  reconciliation_reason?: unknown;
  sanitized_payload?: unknown;
  projection_hash?: unknown;
  successful_sync_run_id?: unknown;
  successful_observed_at?: unknown;
  fresh_until?: unknown;
  retain_until?: unknown;
  latest_observed_at?: unknown;
  authority_observed_at: unknown;
};

type GradeOutcomeContextRow = {
  connection_id: unknown;
  active_role: unknown;
  projection_audience: unknown;
  internal_course_id: unknown;
  internal_course_run_id: unknown;
  internal_class_group_id: unknown;
  grade_item_projection_id: unknown;
  authorized_user_ids: unknown;
  course_mapping_status: unknown;
  group_mapping_status: unknown;
  user_mapping_status: unknown;
  grade_item_mapping_status: unknown;
  observed_at: unknown;
};

type GradeOutcomeFreshnessRow = GradeOutcomeContextRow & {
  freshness_state: unknown;
  latest_outcome?: unknown;
  reconciliation_reason?: unknown;
  sanitized_payload?: unknown;
  projection_hash?: unknown;
  successful_sync_run_id?: unknown;
  successful_observed_at?: unknown;
  fresh_until?: unknown;
  retain_until?: unknown;
  latest_observed_at?: unknown;
  authority_observed_at: unknown;
};

type ActivityOutcomeContextRow = {
  connection_id: unknown;
  active_role: unknown;
  projection_audience: unknown;
  internal_course_id: unknown;
  internal_course_run_id: unknown;
  internal_class_group_id: unknown;
  activity_projection_id: unknown;
  activity_kind: unknown;
  authorized_user_ids: unknown;
  course_mapping_status: unknown;
  group_mapping_status: unknown;
  user_mapping_status: unknown;
  activity_mapping_status: unknown;
  observed_at: unknown;
};

type ActivityOutcomeFreshnessRow = ActivityOutcomeContextRow & {
  freshness_state: unknown;
  latest_outcome?: unknown;
  reconciliation_reason?: unknown;
  sanitized_payload?: unknown;
  projection_hash?: unknown;
  successful_sync_run_id?: unknown;
  successful_observed_at?: unknown;
  fresh_until?: unknown;
  retain_until?: unknown;
  latest_observed_at?: unknown;
  authority_observed_at: unknown;
};

const catalogRoles = new Set<MoodleCourseAuthority["activeRole"]>([
  "student",
  "teacher",
  "headofdepartment",
  "superadmin",
]);
const userProjectionRoles = new Set<MoodleUserAuthority["activeRole"]>([
  "student",
  "teacher",
  "headofdepartment",
  "superadmin",
]);
const enrollmentGroupRoles = new Set<
  MoodleEnrollmentGroupContext["activeRole"]
>(["teacher", "headofdepartment", "superadmin"]);
const assessmentStatusRoles = new Set<
  MoodleAssessmentStatusContext["activeRole"]
>(["student", "teacher", "headofdepartment", "superadmin"]);
const assignmentResultRoles = new Set<
  MoodleAssignmentResultContext["activeRole"]
>(["student", "teacher", "headofdepartment", "superadmin"]);
const assignmentResultFreshnessStates = new Set<
  MoodleAssignmentResultFreshness["freshnessState"]
>(["fresh", "stale_retained", "expired", "reconciliation", "unavailable"]);
const assignmentResultOutcomes = new Set<
  NonNullable<MoodleAssignmentResultFreshness["latestOutcome"]>
>(["available", "empty", "unavailable", "reconciliation"]);
const assignmentResultReconciliationReasons = new Set<
  NonNullable<MoodleAssignmentResultFreshness["reconciliationReason"]>
>([
  "missing_course_mapping",
  "missing_group_mapping",
  "missing_user_mapping",
  "missing_assignment_mapping",
  "provider_result_drift",
  "ambiguous_mapping",
]);
const quizAttemptRoles = new Set<MoodleQuizAttemptContext["activeRole"]>([
  "student",
  "teacher",
  "headofdepartment",
  "superadmin",
]);
const quizAttemptFreshnessStates = new Set<
  MoodleQuizAttemptFreshness["freshnessState"]
>(["fresh", "stale_retained", "expired", "reconciliation", "unavailable"]);
const quizAttemptOutcomes = new Set<
  NonNullable<MoodleQuizAttemptFreshness["latestOutcome"]>
>(["available", "empty", "unavailable", "reconciliation"]);
const quizAttemptReconciliationReasons = new Set<
  NonNullable<MoodleQuizAttemptFreshness["reconciliationReason"]>
>([
  "missing_course_mapping",
  "missing_group_mapping",
  "missing_user_mapping",
  "missing_quiz_mapping",
  "provider_result_drift",
  "ambiguous_mapping",
]);
const gradeOutcomeRoles = new Set<MoodleGradeOutcomeContext["activeRole"]>([
  "student",
  "teacher",
  "headofdepartment",
  "superadmin",
]);
const gradeOutcomeFreshnessStates = new Set<
  MoodleGradeOutcomeFreshness["freshnessState"]
>(["fresh", "stale_retained", "expired", "reconciliation", "unavailable"]);
const gradeOutcomeOutcomes = new Set<
  NonNullable<MoodleGradeOutcomeFreshness["latestOutcome"]>
>(["available", "empty", "unavailable", "reconciliation"]);
const gradeOutcomeReconciliationReasons = new Set<
  NonNullable<MoodleGradeOutcomeFreshness["reconciliationReason"]>
>([
  "missing_course_mapping",
  "missing_group_mapping",
  "missing_user_mapping",
  "missing_grade_item_mapping",
  "provider_result_drift",
  "ambiguous_mapping",
]);
const activityOutcomeRoles = new Set<
  MoodleActivityOutcomeContext["activeRole"]
>(["student", "teacher", "headofdepartment", "superadmin"]);
const activityOutcomeKinds = new Set<MoodleActivityOutcomeKind>([
  "lesson",
  "h5p",
  "scorm",
]);
const activityOutcomeFreshnessStates = new Set<
  MoodleActivityOutcomeFreshness["freshnessState"]
>(["fresh", "stale_retained", "expired", "reconciliation", "unavailable"]);
const activityOutcomeOutcomes = new Set<
  NonNullable<MoodleActivityOutcomeFreshness["latestOutcome"]>
>(["available", "empty", "unavailable", "reconciliation"]);
const activityOutcomeReconciliationReasons = new Set<
  NonNullable<MoodleActivityOutcomeFreshness["reconciliationReason"]>
>([
  "missing_course_mapping",
  "missing_group_mapping",
  "missing_user_mapping",
  "missing_activity_mapping",
  "provider_result_drift",
  "ambiguous_mapping",
]);
const assessmentStatusFreshnessStates = new Set<
  MoodleAssessmentStatusFreshness["freshnessState"]
>(["fresh", "stale_retained", "expired", "reconciliation", "unavailable"]);
const assessmentStatusOutcomes = new Set<
  NonNullable<MoodleAssessmentStatusFreshness["latestOutcome"]>
>(["available", "empty", "unavailable", "reconciliation"]);
const assessmentStatusReconciliationReasons = new Set<
  NonNullable<MoodleAssessmentStatusFreshness["reconciliationReason"]>
>([
  "missing_course_mapping",
  "missing_group_mapping",
  "missing_user_mapping",
  "missing_assessment_mapping",
  "provider_schedule_drift",
  "ambiguous_mapping",
]);
const enrollmentGroupFreshnessStates = new Set<
  MoodleEnrollmentGroupFreshness["freshnessState"]
>(["fresh", "stale_retained", "expired", "reconciliation", "unavailable"]);
const enrollmentGroupOutcomes = new Set<
  NonNullable<MoodleEnrollmentGroupFreshness["latestOutcome"]>
>(["available", "empty", "unavailable", "reconciliation"]);
const enrollmentGroupReconciliationReasons = new Set<
  NonNullable<MoodleEnrollmentGroupFreshness["reconciliationReason"]>
>([
  "missing_course_mapping",
  "missing_group_mapping",
  "missing_user_mapping",
  "provider_membership_drift",
  "ambiguous_mapping",
]);

const mappingStates = new Set<MoodleMappingState>([
  "discovered",
  "matched",
  "synced",
  "stale",
  "error",
]);
const projectionOutcomes = new Set<MoodleProjectionOutcome>([
  "available",
  "empty",
  "reconciliation",
  "unavailable",
]);
const reconciliationReasons = new Set([
  "missing_mapping",
  "missing_provider_record",
  "ambiguous_mapping",
]);

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function repositoryMode(env: NodeJS.ProcessEnv) {
  return (
    clean(env.NILE_MOODLE_PROJECTION_REPOSITORY).toLowerCase() || "disabled"
  );
}

function requireIsoTimestamp(value: unknown, label: string) {
  const timestamp = clean(value);
  if (!timestamp || !Number.isFinite(Date.parse(timestamp))) {
    throw new MoodleProjectionRepositoryUnavailableError(
      `Moodle projection repository returned an invalid ${label}.`
    );
  }
  return timestamp;
}

function requireUuid(value: unknown, label: string) {
  const id = clean(value);
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      id
    )
  ) {
    throw new MoodleProjectionRepositoryUnavailableError(
      `Moodle projection repository returned an invalid ${label}.`
    );
  }
  return id;
}

function optionalUuid(value: unknown, label: string) {
  return value === null || value === undefined
    ? undefined
    : requireUuid(value, label);
}

function optionalIsoTimestamp(value: unknown, label: string) {
  return value === null || value === undefined
    ? undefined
    : requireIsoTimestamp(value, label);
}

function optionalByteaHash(value: unknown) {
  if (value === null || value === undefined) return undefined;
  const hash = clean(value).replace(/^\\x/i, "").toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(hash)) {
    throw new MoodleProjectionRepositoryUnavailableError(
      "Moodle projection repository returned an invalid projection hash."
    );
  }
  return hash;
}

function singleRow<T>(payload: unknown, label: string): T {
  if (!Array.isArray(payload) || payload.length !== 1) {
    throw new MoodleProjectionRepositoryUnavailableError(
      `Moodle projection repository returned ambiguous ${label}.`
    );
  }
  return payload[0] as T;
}

function enrollmentMappingStatus(
  value: unknown,
  label: string
): "exact" | "missing" {
  const status = clean(value);
  if (status !== "exact" && status !== "missing") {
    throw new MoodleProjectionRepositoryUnavailableError(
      `Moodle projection repository returned an invalid ${label}.`
    );
  }
  return status;
}

function parseEnrollmentGroupContextRow(
  row: EnrollmentGroupContextRow,
  session: ServerSession,
  requestedClassGroupId: string
): MoodleEnrollmentGroupContext {
  const activeRole = clean(row.active_role);
  const audience = clean(row.projection_audience);
  if (
    activeRole !== session.activeRole ||
    !enrollmentGroupRoles.has(
      activeRole as MoodleEnrollmentGroupContext["activeRole"]
    ) ||
    (activeRole === "teacher" && audience !== "person_level") ||
    (activeRole !== "teacher" && audience !== "aggregate")
  ) {
    throw new MoodleProjectionRepositoryAuthorityError();
  }
  const internalClassGroupId = requireUuid(
    row.internal_class_group_id,
    "class group ID"
  );
  if (internalClassGroupId !== requestedClassGroupId) {
    throw new MoodleProjectionRepositoryAuthorityError();
  }
  if (
    !Array.isArray(row.authorized_user_ids) ||
    row.authorized_user_ids.some(id => typeof id !== "string")
  ) {
    throw new MoodleProjectionRepositoryUnavailableError(
      "Moodle projection repository returned invalid class user authority."
    );
  }
  const authorizedUserIds = row.authorized_user_ids.map(id =>
    requireUuid(id, "authorized user ID")
  );
  if (
    new Set(authorizedUserIds).size !== authorizedUserIds.length ||
    (audience === "aggregate" && authorizedUserIds.length > 0)
  ) {
    throw new MoodleProjectionRepositoryUnavailableError(
      "Moodle projection repository returned invalid class user authority."
    );
  }
  return {
    connectionId: requireUuid(row.connection_id, "connection ID"),
    activeRole: activeRole as MoodleEnrollmentGroupContext["activeRole"],
    audience: audience as MoodleEnrollmentGroupAudience,
    internalCourseId: requireUuid(row.internal_course_id, "course ID"),
    internalCourseRunId: requireUuid(
      row.internal_course_run_id,
      "course run ID"
    ),
    internalClassGroupId,
    authorizedUserIds,
    courseMappingStatus: enrollmentMappingStatus(
      row.course_mapping_status,
      "course mapping status"
    ),
    groupMappingStatus: enrollmentMappingStatus(
      row.group_mapping_status,
      "group mapping status"
    ),
    userMappingStatus: enrollmentMappingStatus(
      row.user_mapping_status,
      "user mapping status"
    ),
    observedAt: requireIsoTimestamp(row.observed_at, "authority timestamp"),
  };
}

function assessmentUserMappingStatus(
  value: unknown
): "exact" | "missing" | "not_required" {
  const status = clean(value);
  if (status !== "exact" && status !== "missing" && status !== "not_required") {
    throw new MoodleProjectionRepositoryUnavailableError(
      "Moodle projection repository returned an invalid assessment user mapping status."
    );
  }
  return status;
}

function assessmentMappingStatus(
  value: unknown
): "exact" | "missing" | "reconciliation" {
  const status = clean(value);
  if (
    status !== "exact" &&
    status !== "missing" &&
    status !== "reconciliation"
  ) {
    throw new MoodleProjectionRepositoryUnavailableError(
      "Moodle projection repository returned an invalid assessment mapping status."
    );
  }
  return status;
}

function parseAssessmentStatusContextRow(
  row: AssessmentStatusContextRow,
  session: ServerSession,
  requestedClassGroupId: string
): MoodleAssessmentStatusContext {
  const activeRole = clean(row.active_role);
  const audience = clean(row.projection_audience);
  if (
    activeRole !== session.activeRole ||
    !assessmentStatusRoles.has(
      activeRole as MoodleAssessmentStatusContext["activeRole"]
    ) ||
    (activeRole === "student" && audience !== "learner") ||
    (activeRole !== "student" && audience !== "class_staff")
  ) {
    throw new MoodleProjectionRepositoryAuthorityError();
  }
  const internalClassGroupId = requireUuid(
    row.internal_class_group_id,
    "assessment class group ID"
  );
  if (internalClassGroupId !== requestedClassGroupId) {
    throw new MoodleProjectionRepositoryAuthorityError();
  }
  const subjectUserId = optionalUuid(
    row.subject_user_id,
    "assessment subject user ID"
  );
  const userMappingStatus = assessmentUserMappingStatus(
    row.user_mapping_status
  );
  if (
    (audience === "learner" &&
      (subjectUserId !== session.userId ||
        userMappingStatus === "not_required")) ||
    (audience === "class_staff" &&
      (subjectUserId !== undefined || userMappingStatus !== "not_required"))
  ) {
    throw new MoodleProjectionRepositoryAuthorityError();
  }
  return {
    connectionId: requireUuid(row.connection_id, "assessment connection ID"),
    activeRole: activeRole as MoodleAssessmentStatusContext["activeRole"],
    audience: audience as MoodleAssessmentStatusAudience,
    internalCourseId: requireUuid(
      row.internal_course_id,
      "assessment course ID"
    ),
    internalCourseRunId: requireUuid(
      row.internal_course_run_id,
      "assessment course run ID"
    ),
    internalClassGroupId,
    ...(subjectUserId ? { subjectUserId } : {}),
    courseMappingStatus: enrollmentMappingStatus(
      row.course_mapping_status,
      "assessment course mapping status"
    ),
    groupMappingStatus: enrollmentMappingStatus(
      row.group_mapping_status,
      "assessment group mapping status"
    ),
    userMappingStatus,
    assessmentMappingStatus: assessmentMappingStatus(
      row.assessment_mapping_status
    ),
    observedAt: requireIsoTimestamp(
      row.observed_at,
      "assessment authority timestamp"
    ),
  };
}

function parseAssignmentResultContextRow(
  row: AssignmentResultContextRow,
  session: ServerSession,
  requestedClassGroupId: string,
  requestedAssignmentProjectionId: string
): MoodleAssignmentResultContext {
  const activeRole = clean(row.active_role);
  const audience = clean(row.projection_audience);
  const expectedAudience =
    activeRole === "student"
      ? "learner"
      : activeRole === "teacher"
        ? "person_level"
        : "aggregate";
  if (
    activeRole !== session.activeRole ||
    !assignmentResultRoles.has(
      activeRole as MoodleAssignmentResultContext["activeRole"]
    ) ||
    audience !== expectedAudience
  ) {
    throw new MoodleProjectionRepositoryAuthorityError();
  }
  const internalClassGroupId = requireUuid(
    row.internal_class_group_id,
    "assignment result class group ID"
  );
  const assignmentProjectionId = requireUuid(
    row.assignment_projection_id,
    "assignment projection ID"
  );
  if (
    internalClassGroupId !== requestedClassGroupId ||
    assignmentProjectionId !== requestedAssignmentProjectionId
  ) {
    throw new MoodleProjectionRepositoryAuthorityError();
  }
  if (
    !Array.isArray(row.authorized_user_ids) ||
    row.authorized_user_ids.some(id => typeof id !== "string")
  ) {
    throw new MoodleProjectionRepositoryUnavailableError(
      "Moodle projection repository returned invalid assignment user authority."
    );
  }
  const authorizedUserIds = row.authorized_user_ids.map(id =>
    requireUuid(id, "authorized assignment user ID")
  );
  if (
    new Set(authorizedUserIds).size !== authorizedUserIds.length ||
    (audience === "learner" &&
      (authorizedUserIds.length !== 1 ||
        authorizedUserIds[0] !== session.userId)) ||
    (audience === "aggregate" && authorizedUserIds.length !== 0)
  ) {
    throw new MoodleProjectionRepositoryAuthorityError();
  }
  return {
    connectionId: requireUuid(
      row.connection_id,
      "assignment result connection ID"
    ),
    activeRole: activeRole as MoodleAssignmentResultContext["activeRole"],
    audience: audience as MoodleAssignmentResultAudience,
    internalCourseId: requireUuid(
      row.internal_course_id,
      "assignment result course ID"
    ),
    internalCourseRunId: requireUuid(
      row.internal_course_run_id,
      "assignment result course run ID"
    ),
    internalClassGroupId,
    assignmentProjectionId,
    authorizedUserIds,
    courseMappingStatus: enrollmentMappingStatus(
      row.course_mapping_status,
      "assignment course mapping status"
    ),
    groupMappingStatus: enrollmentMappingStatus(
      row.group_mapping_status,
      "assignment group mapping status"
    ),
    userMappingStatus: enrollmentMappingStatus(
      row.user_mapping_status,
      "assignment user mapping status"
    ),
    assignmentMappingStatus: enrollmentMappingStatus(
      row.assignment_mapping_status,
      "assignment mapping status"
    ),
    observedAt: requireIsoTimestamp(
      row.observed_at,
      "assignment result authority timestamp"
    ),
  };
}

function parseQuizAttemptContextRow(
  row: QuizAttemptContextRow,
  session: ServerSession,
  requestedClassGroupId: string,
  requestedQuizProjectionId: string
): MoodleQuizAttemptContext {
  const activeRole = clean(row.active_role);
  const audience = clean(row.projection_audience);
  const expectedAudience =
    activeRole === "student"
      ? "learner"
      : activeRole === "teacher"
        ? "person_level"
        : "aggregate";
  if (
    activeRole !== session.activeRole ||
    !quizAttemptRoles.has(
      activeRole as MoodleQuizAttemptContext["activeRole"]
    ) ||
    audience !== expectedAudience
  ) {
    throw new MoodleProjectionRepositoryAuthorityError();
  }
  const internalClassGroupId = requireUuid(
    row.internal_class_group_id,
    "quiz attempt class group ID"
  );
  const quizProjectionId = requireUuid(
    row.quiz_projection_id,
    "quiz projection ID"
  );
  if (
    internalClassGroupId !== requestedClassGroupId ||
    quizProjectionId !== requestedQuizProjectionId ||
    !Array.isArray(row.authorized_user_ids) ||
    row.authorized_user_ids.some(id => typeof id !== "string")
  ) {
    throw new MoodleProjectionRepositoryAuthorityError();
  }
  const authorizedUserIds = row.authorized_user_ids.map(id =>
    requireUuid(id, "authorized quiz learner ID")
  );
  if (
    new Set(authorizedUserIds).size !== authorizedUserIds.length ||
    (audience === "learner" &&
      (authorizedUserIds.length !== 1 ||
        authorizedUserIds[0] !== session.userId)) ||
    (audience === "aggregate" && authorizedUserIds.length !== 0)
  ) {
    throw new MoodleProjectionRepositoryAuthorityError();
  }
  return {
    connectionId: requireUuid(row.connection_id, "quiz attempt connection ID"),
    activeRole: activeRole as MoodleQuizAttemptContext["activeRole"],
    audience: audience as MoodleQuizAttemptAudience,
    internalCourseId: requireUuid(row.internal_course_id, "quiz course ID"),
    internalCourseRunId: requireUuid(
      row.internal_course_run_id,
      "quiz course run ID"
    ),
    internalClassGroupId,
    quizProjectionId,
    authorizedUserIds,
    courseMappingStatus: enrollmentMappingStatus(
      row.course_mapping_status,
      "quiz course mapping status"
    ),
    groupMappingStatus: enrollmentMappingStatus(
      row.group_mapping_status,
      "quiz group mapping status"
    ),
    userMappingStatus: enrollmentMappingStatus(
      row.user_mapping_status,
      "quiz user mapping status"
    ),
    quizMappingStatus: enrollmentMappingStatus(
      row.quiz_mapping_status,
      "quiz mapping status"
    ),
    observedAt: requireIsoTimestamp(
      row.observed_at,
      "quiz attempt authority timestamp"
    ),
  };
}

function parseGradeOutcomeContextRow(
  row: GradeOutcomeContextRow,
  session: ServerSession,
  requestedClassGroupId: string,
  requestedGradeItemProjectionId: string
): MoodleGradeOutcomeContext {
  const activeRole = clean(row.active_role);
  const audience = clean(row.projection_audience);
  const expectedAudience =
    activeRole === "student"
      ? "learner"
      : activeRole === "teacher"
        ? "person_level"
        : "aggregate";
  if (
    activeRole !== session.activeRole ||
    !gradeOutcomeRoles.has(
      activeRole as MoodleGradeOutcomeContext["activeRole"]
    ) ||
    audience !== expectedAudience
  ) {
    throw new MoodleProjectionRepositoryAuthorityError();
  }
  const internalClassGroupId = requireUuid(
    row.internal_class_group_id,
    "grade outcome class group ID"
  );
  const gradeItemProjectionId = requireUuid(
    row.grade_item_projection_id,
    "grade item projection ID"
  );
  if (
    internalClassGroupId !== requestedClassGroupId ||
    gradeItemProjectionId !== requestedGradeItemProjectionId ||
    !Array.isArray(row.authorized_user_ids) ||
    row.authorized_user_ids.some(id => typeof id !== "string")
  ) {
    throw new MoodleProjectionRepositoryAuthorityError();
  }
  const authorizedUserIds = row.authorized_user_ids.map(id =>
    requireUuid(id, "authorized grade learner ID")
  );
  if (
    new Set(authorizedUserIds).size !== authorizedUserIds.length ||
    (audience === "learner" &&
      (authorizedUserIds.length !== 1 ||
        authorizedUserIds[0] !== session.userId)) ||
    (audience === "aggregate" && authorizedUserIds.length !== 0)
  ) {
    throw new MoodleProjectionRepositoryAuthorityError();
  }
  return {
    connectionId: requireUuid(row.connection_id, "grade outcome connection ID"),
    activeRole: activeRole as MoodleGradeOutcomeContext["activeRole"],
    audience: audience as MoodleGradeOutcomeAudience,
    internalCourseId: requireUuid(row.internal_course_id, "grade course ID"),
    internalCourseRunId: requireUuid(
      row.internal_course_run_id,
      "grade course run ID"
    ),
    internalClassGroupId,
    gradeItemProjectionId,
    authorizedUserIds,
    courseMappingStatus: enrollmentMappingStatus(
      row.course_mapping_status,
      "grade course mapping status"
    ),
    groupMappingStatus: enrollmentMappingStatus(
      row.group_mapping_status,
      "grade group mapping status"
    ),
    userMappingStatus: enrollmentMappingStatus(
      row.user_mapping_status,
      "grade user mapping status"
    ),
    gradeItemMappingStatus: enrollmentMappingStatus(
      row.grade_item_mapping_status,
      "grade item mapping status"
    ),
    observedAt: requireIsoTimestamp(
      row.observed_at,
      "grade outcome authority timestamp"
    ),
  };
}

function parseActivityOutcomeContextRow(
  row: ActivityOutcomeContextRow,
  session: ServerSession,
  requestedClassGroupId: string,
  requestedActivityProjectionId: string
): MoodleActivityOutcomeContext {
  const activeRole = clean(row.active_role);
  const audience = clean(row.projection_audience);
  const expectedAudience =
    activeRole === "student"
      ? "learner"
      : activeRole === "teacher"
        ? "person_level"
        : "aggregate";
  if (
    activeRole !== session.activeRole ||
    !activityOutcomeRoles.has(
      activeRole as MoodleActivityOutcomeContext["activeRole"]
    ) ||
    audience !== expectedAudience
  ) {
    throw new MoodleProjectionRepositoryAuthorityError();
  }
  const internalClassGroupId = requireUuid(
    row.internal_class_group_id,
    "activity outcome class group ID"
  );
  const activityProjectionId = requireUuid(
    row.activity_projection_id,
    "activity projection ID"
  );
  const activityKind = clean(row.activity_kind) as MoodleActivityOutcomeKind;
  if (
    internalClassGroupId !== requestedClassGroupId ||
    activityProjectionId !== requestedActivityProjectionId ||
    !activityOutcomeKinds.has(activityKind) ||
    !Array.isArray(row.authorized_user_ids) ||
    row.authorized_user_ids.some(id => typeof id !== "string")
  ) {
    throw new MoodleProjectionRepositoryAuthorityError();
  }
  const authorizedUserIds = row.authorized_user_ids.map(id =>
    requireUuid(id, "authorized activity learner ID")
  );
  if (
    new Set(authorizedUserIds).size !== authorizedUserIds.length ||
    (audience === "learner" &&
      (authorizedUserIds.length !== 1 ||
        authorizedUserIds[0] !== session.userId)) ||
    (audience === "aggregate" && authorizedUserIds.length !== 0)
  ) {
    throw new MoodleProjectionRepositoryAuthorityError();
  }
  return {
    connectionId: requireUuid(
      row.connection_id,
      "activity outcome connection ID"
    ),
    activeRole: activeRole as MoodleActivityOutcomeContext["activeRole"],
    audience: audience as MoodleActivityOutcomeAudience,
    internalCourseId: requireUuid(row.internal_course_id, "activity course ID"),
    internalCourseRunId: requireUuid(
      row.internal_course_run_id,
      "activity course run ID"
    ),
    internalClassGroupId,
    activityProjectionId,
    activityKind,
    authorizedUserIds,
    courseMappingStatus: enrollmentMappingStatus(
      row.course_mapping_status,
      "activity course mapping status"
    ),
    groupMappingStatus: enrollmentMappingStatus(
      row.group_mapping_status,
      "activity group mapping status"
    ),
    userMappingStatus: enrollmentMappingStatus(
      row.user_mapping_status,
      "activity user mapping status"
    ),
    activityMappingStatus: enrollmentMappingStatus(
      row.activity_mapping_status,
      "activity mapping status"
    ),
    observedAt: requireIsoTimestamp(
      row.observed_at,
      "activity outcome authority timestamp"
    ),
  };
}

export function createSupabaseMoodleProjectionRepository(
  options: MoodleProjectionRepositoryOptions = {}
): MoodleProjectionRepository {
  const env = options.env ?? process.env;
  const adminFetch = options.adminFetch ?? supabaseAdminRestFetch;
  if (!getSupabaseServerStatus(env).adminAvailable) {
    throw new MoodleProjectionRepositoryUnavailableError(
      "The Moodle projection repository requires server-only Supabase configuration."
    );
  }

  async function rpc(functionName: string, body: Record<string, unknown>) {
    let response: Response;
    try {
      response = await adminFetch(
        `rpc/${functionName}`,
        { method: "POST", body: JSON.stringify(body) },
        env
      );
    } catch {
      throw new MoodleProjectionRepositoryUnavailableError();
    }
    if (response.status === 401 || response.status === 403) {
      throw new MoodleProjectionRepositoryAuthorityError();
    }
    if (!response.ok) {
      throw new MoodleProjectionRepositoryUnavailableError(
        `Moodle projection repository failed with status ${response.status}.`
      );
    }
    try {
      return (await response.json()) as unknown;
    } catch {
      throw new MoodleProjectionRepositoryUnavailableError(
        "Moodle projection repository returned invalid JSON."
      );
    }
  }

  return {
    kind: "supabase",
    async resolveCourseAuthority(session) {
      if (
        session.provider !== "supabase" ||
        session.authorizationModel !== "normalized" ||
        !session.activeRoleGrantId ||
        !catalogRoles.has(
          session.activeRole as MoodleCourseAuthority["activeRole"]
        )
      ) {
        throw new MoodleProjectionRepositoryAuthorityError();
      }
      const row = singleRow<AuthorityRow>(
        await rpc("resolve_moodle_projection_context", {
          p_user_id: session.userId,
          p_active_role_grant_id: session.activeRoleGrantId,
        }),
        "course authority"
      );
      const activeRole = clean(row.active_role);
      if (
        activeRole !== session.activeRole ||
        !catalogRoles.has(activeRole as MoodleCourseAuthority["activeRole"])
      ) {
        throw new MoodleProjectionRepositoryAuthorityError();
      }
      if (
        !Array.isArray(row.authorized_course_ids) ||
        row.authorized_course_ids.some(id => typeof id !== "string")
      ) {
        throw new MoodleProjectionRepositoryUnavailableError(
          "Moodle projection repository returned invalid course authority."
        );
      }
      const authorizedCourseIds = row.authorized_course_ids.map(id =>
        requireUuid(id, "course ID")
      );
      if (new Set(authorizedCourseIds).size !== authorizedCourseIds.length) {
        throw new MoodleProjectionRepositoryUnavailableError(
          "Moodle projection repository returned duplicate course authority."
        );
      }
      return {
        connectionId: requireUuid(row.connection_id, "connection ID"),
        activeRole: activeRole as MoodleCourseAuthority["activeRole"],
        authorizedCourseIds,
        observedAt: requireIsoTimestamp(row.observed_at, "authority timestamp"),
      };
    },
    async listCourseMappings(connectionId, internalCourseIds) {
      const scopedConnectionId = requireUuid(
        connectionId,
        "mapping connection ID"
      );
      const uniqueIds = Array.from(new Set(internalCourseIds)).map(id =>
        requireUuid(id, "mapping course ID")
      );
      if (uniqueIds.length === 0) return [];
      const payload = await rpc("list_moodle_course_mappings_for_connection", {
        p_connection_id: scopedConnectionId,
        p_internal_course_ids: uniqueIds,
      });
      if (!Array.isArray(payload)) {
        throw new MoodleProjectionRepositoryUnavailableError(
          "Moodle projection repository returned invalid mappings."
        );
      }
      const mappings = payload.map((candidate: MappingRow) => {
        const state = clean(candidate.sync_state) as MoodleMappingState;
        if (!mappingStates.has(state)) {
          throw new MoodleProjectionRepositoryUnavailableError(
            "Moodle projection repository returned an invalid mapping state."
          );
        }
        const externalCourseId = clean(candidate.external_course_id);
        if (
          !/^[1-9]\d*$/.test(externalCourseId) ||
          !Number.isSafeInteger(Number(externalCourseId))
        ) {
          throw new MoodleProjectionRepositoryUnavailableError(
            "Moodle projection repository returned an invalid external course ID."
          );
        }
        const lastSeenAt = candidate.last_seen_at
          ? requireIsoTimestamp(candidate.last_seen_at, "mapping timestamp")
          : undefined;
        return {
          externalRecordId: requireUuid(
            candidate.external_record_id,
            "external record ID"
          ),
          internalCourseId: requireUuid(
            candidate.internal_course_id,
            "mapped course ID"
          ),
          externalCourseId,
          state,
          ...(lastSeenAt ? { lastSeenAt } : {}),
        };
      });
      const requestedIds = new Set(uniqueIds);
      const seenInternalIds = new Set<string>();
      const seenExternalIds = new Set<string>();
      for (const mapping of mappings) {
        if (!requestedIds.has(mapping.internalCourseId)) {
          throw new MoodleProjectionRepositoryAuthorityError();
        }
        if (
          seenInternalIds.has(mapping.internalCourseId) ||
          seenExternalIds.has(mapping.externalCourseId)
        ) {
          throw new MoodleProjectionRepositoryUnavailableError(
            "Moodle projection repository returned duplicate mappings."
          );
        }
        seenInternalIds.add(mapping.internalCourseId);
        seenExternalIds.add(mapping.externalCourseId);
      }
      return mappings;
    },
    async resolveUserAuthority(session) {
      if (
        session.provider !== "supabase" ||
        session.authorizationModel !== "normalized" ||
        !session.activeRoleGrantId ||
        !userProjectionRoles.has(
          session.activeRole as MoodleUserAuthority["activeRole"]
        )
      ) {
        throw new MoodleProjectionRepositoryAuthorityError();
      }
      const row = singleRow<UserAuthorityRow>(
        await rpc("resolve_moodle_user_projection_authority", {
          p_user_id: session.userId,
          p_active_role_grant_id: session.activeRoleGrantId,
        }),
        "user authority"
      );
      const activeRole = clean(row.active_role);
      if (
        activeRole !== session.activeRole ||
        !userProjectionRoles.has(
          activeRole as MoodleUserAuthority["activeRole"]
        )
      ) {
        throw new MoodleProjectionRepositoryAuthorityError();
      }
      if (
        !Array.isArray(row.authorized_user_ids) ||
        row.authorized_user_ids.some(id => typeof id !== "string")
      ) {
        throw new MoodleProjectionRepositoryUnavailableError(
          "Moodle projection repository returned invalid user authority."
        );
      }
      const authorizedUserIds = row.authorized_user_ids.map(id =>
        requireUuid(id, "user ID")
      );
      if (new Set(authorizedUserIds).size !== authorizedUserIds.length) {
        throw new MoodleProjectionRepositoryUnavailableError(
          "Moodle projection repository returned duplicate user authority."
        );
      }
      return {
        activeRole: activeRole as MoodleUserAuthority["activeRole"],
        authorizedUserIds,
        observedAt: requireIsoTimestamp(row.observed_at, "authority timestamp"),
      };
    },
    async listUserMappings(connectionId, internalUserIds) {
      const scopedConnectionId = requireUuid(
        connectionId,
        "mapping connection ID"
      );
      const uniqueIds = Array.from(new Set(internalUserIds)).map(id =>
        requireUuid(id, "mapping user ID")
      );
      if (uniqueIds.length === 0) return [];
      const payload = await rpc("list_moodle_user_mappings_for_connection", {
        p_connection_id: scopedConnectionId,
        p_internal_user_ids: uniqueIds,
      });
      if (!Array.isArray(payload)) {
        throw new MoodleProjectionRepositoryUnavailableError(
          "Moodle projection repository returned invalid user mappings."
        );
      }
      const mappings = payload.map((candidate: UserMappingRow) => {
        const state = clean(candidate.sync_state) as MoodleMappingState;
        if (!mappingStates.has(state)) {
          throw new MoodleProjectionRepositoryUnavailableError(
            "Moodle projection repository returned an invalid user mapping state."
          );
        }
        const externalUserId = clean(candidate.external_user_id);
        if (
          !/^[1-9]\d*$/.test(externalUserId) ||
          !Number.isSafeInteger(Number(externalUserId))
        ) {
          throw new MoodleProjectionRepositoryUnavailableError(
            "Moodle projection repository returned an invalid external user ID."
          );
        }
        const lastSeenAt = candidate.last_seen_at
          ? requireIsoTimestamp(
              candidate.last_seen_at,
              "user mapping timestamp"
            )
          : undefined;
        return {
          externalRecordId: requireUuid(
            candidate.external_record_id,
            "external record ID"
          ),
          internalUserId: requireUuid(
            candidate.internal_user_id,
            "mapped user ID"
          ),
          externalUserId,
          state,
          ...(lastSeenAt ? { lastSeenAt } : {}),
        };
      });
      const requestedIds = new Set(uniqueIds);
      const seenInternalIds = new Set<string>();
      const seenExternalIds = new Set<string>();
      for (const mapping of mappings) {
        if (!requestedIds.has(mapping.internalUserId)) {
          throw new MoodleProjectionRepositoryAuthorityError();
        }
        if (
          seenInternalIds.has(mapping.internalUserId) ||
          seenExternalIds.has(mapping.externalUserId)
        ) {
          throw new MoodleProjectionRepositoryUnavailableError(
            "Moodle projection repository returned duplicate user mappings."
          );
        }
        seenInternalIds.add(mapping.internalUserId);
        seenExternalIds.add(mapping.externalUserId);
      }
      return mappings;
    },
    async resolveEnrollmentGroupContext(session, internalClassGroupId) {
      if (
        session.provider !== "supabase" ||
        session.authorizationModel !== "normalized" ||
        !session.activeRoleGrantId ||
        !enrollmentGroupRoles.has(
          session.activeRole as MoodleEnrollmentGroupContext["activeRole"]
        )
      ) {
        throw new MoodleProjectionRepositoryAuthorityError();
      }
      const scopedClassGroupId = requireUuid(
        internalClassGroupId,
        "requested class group ID"
      );
      const row = singleRow<EnrollmentGroupContextRow>(
        await rpc("resolve_moodle_enrollment_group_context", {
          p_user_id: session.userId,
          p_active_role_grant_id: session.activeRoleGrantId,
          p_internal_class_group_id: scopedClassGroupId,
        }),
        "enrollment group authority"
      );
      return parseEnrollmentGroupContextRow(row, session, scopedClassGroupId);
    },
    async getEnrollmentGroupFreshness(input) {
      if (
        input.session.provider !== "supabase" ||
        input.session.authorizationModel !== "normalized" ||
        !input.session.activeRoleGrantId ||
        input.session.activeRole !== input.context.activeRole
      ) {
        throw new MoodleProjectionRepositoryAuthorityError();
      }
      const asOf = requireIsoTimestamp(input.asOf, "projection clock");
      const payload = await rpc(
        "list_authorized_moodle_enrollment_group_freshness",
        {
          p_user_id: input.session.userId,
          p_active_role_grant_id: input.session.activeRoleGrantId,
          p_connection_id: input.context.connectionId,
          p_internal_class_group_id: input.context.internalClassGroupId,
          p_as_of: asOf,
        }
      );
      const row = singleRow<EnrollmentGroupFreshnessRow>(
        payload,
        "enrollment group freshness"
      );
      if (
        requireUuid(row.connection_id, "freshness connection ID") !==
          input.context.connectionId ||
        requireUuid(row.internal_course_id, "freshness course ID") !==
          input.context.internalCourseId ||
        requireUuid(row.internal_class_group_id, "freshness class group ID") !==
          input.context.internalClassGroupId ||
        clean(row.active_role) !== input.context.activeRole ||
        clean(row.projection_audience) !== input.context.audience
      ) {
        throw new MoodleProjectionRepositoryAuthorityError();
      }
      const courseMappingStatus = enrollmentMappingStatus(
        row.course_mapping_status,
        "course mapping status"
      );
      const groupMappingStatus = enrollmentMappingStatus(
        row.group_mapping_status,
        "group mapping status"
      );
      const userMappingStatus = enrollmentMappingStatus(
        row.user_mapping_status,
        "user mapping status"
      );
      const returnedContext: MoodleEnrollmentGroupContext = {
        ...input.context,
        courseMappingStatus,
        groupMappingStatus,
        userMappingStatus,
        observedAt: requireIsoTimestamp(
          row.authority_observed_at,
          "authority timestamp"
        ),
      };
      const freshnessState = clean(
        row.freshness_state
      ) as MoodleEnrollmentGroupFreshness["freshnessState"];
      if (!enrollmentGroupFreshnessStates.has(freshnessState)) {
        throw new MoodleProjectionRepositoryUnavailableError(
          "Moodle projection repository returned invalid enrollment freshness."
        );
      }
      const latestOutcome = clean(row.latest_outcome) as NonNullable<
        MoodleEnrollmentGroupFreshness["latestOutcome"]
      >;
      if (latestOutcome && !enrollmentGroupOutcomes.has(latestOutcome)) {
        throw new MoodleProjectionRepositoryUnavailableError(
          "Moodle projection repository returned invalid enrollment outcome."
        );
      }
      const reconciliationReason = clean(
        row.reconciliation_reason
      ) as NonNullable<MoodleEnrollmentGroupFreshness["reconciliationReason"]>;
      if (
        reconciliationReason &&
        !enrollmentGroupReconciliationReasons.has(reconciliationReason)
      ) {
        throw new MoodleProjectionRepositoryUnavailableError(
          "Moodle projection repository returned invalid reconciliation reason."
        );
      }
      const hasProjection =
        row.sanitized_payload !== null && row.sanitized_payload !== undefined;
      const projectionHash = optionalByteaHash(row.projection_hash);
      const successfulSyncRunId = optionalUuid(
        row.successful_sync_run_id,
        "successful sync run ID"
      );
      const successfulObservedAt = optionalIsoTimestamp(
        row.successful_observed_at,
        "successful observation timestamp"
      );
      const freshUntil = optionalIsoTimestamp(
        row.fresh_until,
        "projection freshness timestamp"
      );
      const retainUntil = optionalIsoTimestamp(
        row.retain_until,
        "projection retention timestamp"
      );
      if (
        hasProjection !==
        Boolean(
          projectionHash &&
            successfulSyncRunId &&
            successfulObservedAt &&
            freshUntil &&
            retainUntil
        )
      ) {
        throw new MoodleProjectionRepositoryUnavailableError(
          "Moodle projection repository returned incomplete enrollment projection."
        );
      }
      if (
        hasProjection !==
          (freshnessState === "fresh" || freshnessState === "stale_retained") ||
        (hasProjection &&
          (courseMappingStatus !== "exact" ||
            groupMappingStatus !== "exact" ||
            userMappingStatus !== "exact"))
      ) {
        throw new MoodleProjectionRepositoryUnavailableError(
          "Moodle projection repository returned inconsistent enrollment freshness."
        );
      }
      if (
        hasProjection &&
        !(
          Date.parse(successfulObservedAt!) < Date.parse(freshUntil!) &&
          Date.parse(freshUntil!) < Date.parse(retainUntil!)
        )
      ) {
        throw new MoodleProjectionRepositoryUnavailableError(
          "Moodle projection repository returned invalid enrollment retention."
        );
      }
      const projection = hasProjection
        ? parseStoredMoodleEnrollmentGroupProjection(
            input.context.audience,
            row.sanitized_payload
          )
        : undefined;
      if (
        projection &&
        hashMoodleProjectionPayload(row.sanitized_payload) !== projectionHash
      ) {
        throw new MoodleProjectionRepositoryUnavailableError(
          "Moodle projection repository returned a mismatched enrollment projection hash."
        );
      }
      if (
        projection &&
        (projection.internalCourseId !== input.context.internalCourseId ||
          projection.internalClassGroupId !==
            input.context.internalClassGroupId)
      ) {
        throw new MoodleProjectionRepositoryAuthorityError();
      }
      if (projection && "learners" in projection) {
        const authorizedUserIds = new Set(input.context.authorizedUserIds);
        if (
          input.context.audience !== "person_level" ||
          projection.learners.length !== authorizedUserIds.size ||
          projection.learners.some(
            learner => !authorizedUserIds.has(learner.internalUserId)
          )
        ) {
          throw new MoodleProjectionRepositoryAuthorityError();
        }
      } else if (projection && input.context.audience !== "aggregate") {
        throw new MoodleProjectionRepositoryAuthorityError();
      }
      const latestObservedAt = optionalIsoTimestamp(
        row.latest_observed_at,
        "latest observation timestamp"
      );
      return {
        context: returnedContext,
        freshnessState,
        ...(latestOutcome ? { latestOutcome } : {}),
        ...(reconciliationReason ? { reconciliationReason } : {}),
        ...(projection ? { projection } : {}),
        ...(projectionHash ? { projectionHash } : {}),
        ...(successfulSyncRunId ? { successfulSyncRunId } : {}),
        ...(successfulObservedAt ? { successfulObservedAt } : {}),
        ...(freshUntil ? { freshUntil } : {}),
        ...(retainUntil ? { retainUntil } : {}),
        ...(latestObservedAt ? { latestObservedAt } : {}),
      };
    },
    async resolveAssessmentStatusContext(session, internalClassGroupId) {
      if (
        session.provider !== "supabase" ||
        session.authorizationModel !== "normalized" ||
        !session.activeRoleGrantId ||
        !assessmentStatusRoles.has(
          session.activeRole as MoodleAssessmentStatusContext["activeRole"]
        )
      ) {
        throw new MoodleProjectionRepositoryAuthorityError();
      }
      const scopedClassGroupId = requireUuid(
        internalClassGroupId,
        "requested assessment class group ID"
      );
      const row = singleRow<AssessmentStatusContextRow>(
        await rpc("resolve_moodle_assessment_status_context", {
          p_user_id: session.userId,
          p_active_role_grant_id: session.activeRoleGrantId,
          p_internal_class_group_id: scopedClassGroupId,
        }),
        "assessment status authority"
      );
      return parseAssessmentStatusContextRow(row, session, scopedClassGroupId);
    },
    async getAssessmentStatusFreshness(input) {
      if (
        input.session.provider !== "supabase" ||
        input.session.authorizationModel !== "normalized" ||
        !input.session.activeRoleGrantId ||
        input.session.activeRole !== input.context.activeRole
      ) {
        throw new MoodleProjectionRepositoryAuthorityError();
      }
      const asOf = requireIsoTimestamp(
        input.asOf,
        "assessment projection clock"
      );
      const payload = await rpc(
        "list_authorized_moodle_assessment_status_freshness",
        {
          p_user_id: input.session.userId,
          p_active_role_grant_id: input.session.activeRoleGrantId,
          p_connection_id: input.context.connectionId,
          p_internal_class_group_id: input.context.internalClassGroupId,
          p_as_of: asOf,
        }
      );
      const row = singleRow<AssessmentStatusFreshnessRow>(
        payload,
        "assessment status freshness"
      );
      const returnedContext = parseAssessmentStatusContextRow(
        { ...row, observed_at: row.authority_observed_at },
        input.session,
        input.context.internalClassGroupId
      );
      if (
        returnedContext.connectionId !== input.context.connectionId ||
        returnedContext.internalCourseId !== input.context.internalCourseId ||
        returnedContext.internalCourseRunId !==
          input.context.internalCourseRunId ||
        returnedContext.audience !== input.context.audience ||
        returnedContext.subjectUserId !== input.context.subjectUserId
      ) {
        throw new MoodleProjectionRepositoryAuthorityError();
      }
      const freshnessState = clean(
        row.freshness_state
      ) as MoodleAssessmentStatusFreshness["freshnessState"];
      if (!assessmentStatusFreshnessStates.has(freshnessState)) {
        throw new MoodleProjectionRepositoryUnavailableError(
          "Moodle projection repository returned invalid assessment freshness."
        );
      }
      const latestOutcome = clean(row.latest_outcome) as NonNullable<
        MoodleAssessmentStatusFreshness["latestOutcome"]
      >;
      if (latestOutcome && !assessmentStatusOutcomes.has(latestOutcome)) {
        throw new MoodleProjectionRepositoryUnavailableError(
          "Moodle projection repository returned invalid assessment outcome."
        );
      }
      const reconciliationReason = clean(
        row.reconciliation_reason
      ) as NonNullable<MoodleAssessmentStatusFreshness["reconciliationReason"]>;
      if (
        reconciliationReason &&
        !assessmentStatusReconciliationReasons.has(reconciliationReason)
      ) {
        throw new MoodleProjectionRepositoryUnavailableError(
          "Moodle projection repository returned invalid assessment reconciliation."
        );
      }
      const hasProjection =
        row.sanitized_payload !== null && row.sanitized_payload !== undefined;
      const projectionHash = optionalByteaHash(row.projection_hash);
      const successfulSyncRunId = optionalUuid(
        row.successful_sync_run_id,
        "assessment sync run ID"
      );
      const successfulObservedAt = optionalIsoTimestamp(
        row.successful_observed_at,
        "assessment observation timestamp"
      );
      const freshUntil = optionalIsoTimestamp(
        row.fresh_until,
        "assessment freshness timestamp"
      );
      const retainUntil = optionalIsoTimestamp(
        row.retain_until,
        "assessment retention timestamp"
      );
      if (
        hasProjection !==
        Boolean(
          projectionHash &&
            successfulSyncRunId &&
            successfulObservedAt &&
            freshUntil &&
            retainUntil
        )
      ) {
        throw new MoodleProjectionRepositoryUnavailableError(
          "Moodle projection repository returned incomplete assessment status."
        );
      }
      const exactMappings =
        returnedContext.courseMappingStatus === "exact" &&
        returnedContext.groupMappingStatus === "exact" &&
        returnedContext.assessmentMappingStatus === "exact" &&
        (returnedContext.audience === "learner"
          ? returnedContext.userMappingStatus === "exact"
          : returnedContext.userMappingStatus === "not_required");
      if (
        hasProjection !==
          (freshnessState === "fresh" || freshnessState === "stale_retained") ||
        (hasProjection && !exactMappings)
      ) {
        throw new MoodleProjectionRepositoryUnavailableError(
          "Moodle projection repository returned inconsistent assessment status."
        );
      }
      if (
        hasProjection &&
        !(
          Date.parse(successfulObservedAt!) < Date.parse(freshUntil!) &&
          Date.parse(freshUntil!) < Date.parse(retainUntil!)
        )
      ) {
        throw new MoodleProjectionRepositoryUnavailableError(
          "Moodle projection repository returned invalid assessment retention."
        );
      }
      const projection = hasProjection
        ? parseStoredMoodleAssessmentStatusProjection(row.sanitized_payload)
        : undefined;
      if (
        projection &&
        hashMoodleProjectionPayload(row.sanitized_payload) !== projectionHash
      ) {
        throw new MoodleProjectionRepositoryUnavailableError(
          "Moodle projection repository returned a mismatched assessment hash."
        );
      }
      if (
        projection &&
        (projection.internalCourseId !== returnedContext.internalCourseId ||
          projection.internalClassGroupId !==
            returnedContext.internalClassGroupId ||
          projection.mappingStatus !== "exact")
      ) {
        throw new MoodleProjectionRepositoryAuthorityError();
      }
      const latestObservedAt = optionalIsoTimestamp(
        row.latest_observed_at,
        "latest assessment observation timestamp"
      );
      return {
        context: returnedContext,
        freshnessState,
        ...(latestOutcome ? { latestOutcome } : {}),
        ...(reconciliationReason ? { reconciliationReason } : {}),
        ...(projection ? { projection } : {}),
        ...(projectionHash ? { projectionHash } : {}),
        ...(successfulSyncRunId ? { successfulSyncRunId } : {}),
        ...(successfulObservedAt ? { successfulObservedAt } : {}),
        ...(freshUntil ? { freshUntil } : {}),
        ...(retainUntil ? { retainUntil } : {}),
        ...(latestObservedAt ? { latestObservedAt } : {}),
      };
    },
    async resolveAssignmentResultContext(
      session,
      internalClassGroupId,
      assignmentProjectionId
    ) {
      if (
        session.provider !== "supabase" ||
        session.authorizationModel !== "normalized" ||
        !session.activeRoleGrantId ||
        !assignmentResultRoles.has(
          session.activeRole as MoodleAssignmentResultContext["activeRole"]
        )
      ) {
        throw new MoodleProjectionRepositoryAuthorityError();
      }
      const scopedClassGroupId = requireUuid(
        internalClassGroupId,
        "requested assignment class group ID"
      );
      const scopedAssignmentProjectionId = requireUuid(
        assignmentProjectionId,
        "requested assignment projection ID"
      );
      const row = singleRow<AssignmentResultContextRow>(
        await rpc("resolve_moodle_assignment_result_context", {
          p_user_id: session.userId,
          p_active_role_grant_id: session.activeRoleGrantId,
          p_internal_class_group_id: scopedClassGroupId,
          p_assignment_projection_id: scopedAssignmentProjectionId,
        }),
        "assignment result authority"
      );
      return parseAssignmentResultContextRow(
        row,
        session,
        scopedClassGroupId,
        scopedAssignmentProjectionId
      );
    },
    async getAssignmentResultFreshness(input) {
      if (
        input.session.provider !== "supabase" ||
        input.session.authorizationModel !== "normalized" ||
        !input.session.activeRoleGrantId ||
        input.session.activeRole !== input.context.activeRole
      ) {
        throw new MoodleProjectionRepositoryAuthorityError();
      }
      const asOf = requireIsoTimestamp(
        input.asOf,
        "assignment result projection clock"
      );
      const payload = await rpc(
        "list_authorized_moodle_assignment_result_freshness",
        {
          p_user_id: input.session.userId,
          p_active_role_grant_id: input.session.activeRoleGrantId,
          p_connection_id: input.context.connectionId,
          p_internal_class_group_id: input.context.internalClassGroupId,
          p_assignment_projection_id: input.context.assignmentProjectionId,
          p_as_of: asOf,
        }
      );
      const row = singleRow<AssignmentResultFreshnessRow>(
        payload,
        "assignment result freshness"
      );
      const returnedContext = parseAssignmentResultContextRow(
        { ...row, observed_at: row.authority_observed_at },
        input.session,
        input.context.internalClassGroupId,
        input.context.assignmentProjectionId
      );
      const expectedUsers = new Set(input.context.authorizedUserIds);
      if (
        returnedContext.connectionId !== input.context.connectionId ||
        returnedContext.internalCourseId !== input.context.internalCourseId ||
        returnedContext.internalCourseRunId !==
          input.context.internalCourseRunId ||
        returnedContext.audience !== input.context.audience ||
        returnedContext.authorizedUserIds.length !== expectedUsers.size ||
        returnedContext.authorizedUserIds.some(id => !expectedUsers.has(id))
      ) {
        throw new MoodleProjectionRepositoryAuthorityError();
      }
      const freshnessState = clean(
        row.freshness_state
      ) as MoodleAssignmentResultFreshness["freshnessState"];
      if (!assignmentResultFreshnessStates.has(freshnessState)) {
        throw new MoodleProjectionRepositoryUnavailableError(
          "Moodle projection repository returned invalid assignment result freshness."
        );
      }
      const latestOutcome = clean(row.latest_outcome) as NonNullable<
        MoodleAssignmentResultFreshness["latestOutcome"]
      >;
      if (latestOutcome && !assignmentResultOutcomes.has(latestOutcome)) {
        throw new MoodleProjectionRepositoryUnavailableError(
          "Moodle projection repository returned invalid assignment result outcome."
        );
      }
      const reconciliationReason = clean(
        row.reconciliation_reason
      ) as NonNullable<MoodleAssignmentResultFreshness["reconciliationReason"]>;
      if (
        reconciliationReason &&
        !assignmentResultReconciliationReasons.has(reconciliationReason)
      ) {
        throw new MoodleProjectionRepositoryUnavailableError(
          "Moodle projection repository returned invalid assignment result reconciliation."
        );
      }
      const hasProjection =
        row.sanitized_payload !== null && row.sanitized_payload !== undefined;
      const projectionHash = optionalByteaHash(row.projection_hash);
      const successfulSyncRunId = optionalUuid(
        row.successful_sync_run_id,
        "assignment result sync run ID"
      );
      const successfulObservedAt = optionalIsoTimestamp(
        row.successful_observed_at,
        "assignment result observation timestamp"
      );
      const freshUntil = optionalIsoTimestamp(
        row.fresh_until,
        "assignment result freshness timestamp"
      );
      const retainUntil = optionalIsoTimestamp(
        row.retain_until,
        "assignment result retention timestamp"
      );
      if (
        hasProjection !==
        Boolean(
          projectionHash &&
            successfulSyncRunId &&
            successfulObservedAt &&
            freshUntil &&
            retainUntil
        )
      ) {
        throw new MoodleProjectionRepositoryUnavailableError(
          "Moodle projection repository returned incomplete assignment result evidence."
        );
      }
      const exactMappings =
        returnedContext.courseMappingStatus === "exact" &&
        returnedContext.groupMappingStatus === "exact" &&
        returnedContext.userMappingStatus === "exact" &&
        returnedContext.assignmentMappingStatus === "exact";
      if (
        hasProjection !== (freshnessState === "fresh") ||
        (hasProjection && !exactMappings)
      ) {
        throw new MoodleProjectionRepositoryUnavailableError(
          "Moodle projection repository returned inconsistent assignment result evidence."
        );
      }
      if (
        hasProjection &&
        !(
          Date.parse(successfulObservedAt!) < Date.parse(freshUntil!) &&
          Date.parse(freshUntil!) < Date.parse(retainUntil!) &&
          Date.parse(freshUntil!) - Date.parse(successfulObservedAt!) ===
            15 * 60 * 1000 &&
          Date.parse(retainUntil!) - Date.parse(successfulObservedAt!) <=
            30 * 24 * 60 * 60 * 1000 &&
          Date.parse(asOf) <= Date.parse(freshUntil!)
        )
      ) {
        throw new MoodleProjectionRepositoryUnavailableError(
          "Moodle projection repository returned invalid assignment result retention."
        );
      }
      const projection = hasProjection
        ? parseStoredMoodleAssignmentResultProjection(
            returnedContext.audience,
            row.sanitized_payload
          )
        : undefined;
      if (
        projection &&
        hashMoodleProjectionPayload(row.sanitized_payload) !== projectionHash
      ) {
        throw new MoodleProjectionRepositoryUnavailableError(
          "Moodle projection repository returned a mismatched assignment result hash."
        );
      }
      if (
        projection &&
        (projection.internalCourseId !== returnedContext.internalCourseId ||
          projection.internalClassGroupId !==
            returnedContext.internalClassGroupId ||
          projection.assignmentProjectionId !==
            returnedContext.assignmentProjectionId)
      ) {
        throw new MoodleProjectionRepositoryAuthorityError();
      }
      if (projection && "learners" in projection) {
        const authorizedUsers = new Set(returnedContext.authorizedUserIds);
        if (
          projection.learners.some(
            learner => !authorizedUsers.has(learner.internalUserId)
          ) ||
          (projection.providerState === "available" &&
            projection.learners.length !== authorizedUsers.size)
        ) {
          throw new MoodleProjectionRepositoryAuthorityError();
        }
      } else if (projection && returnedContext.audience !== "aggregate") {
        throw new MoodleProjectionRepositoryAuthorityError();
      }
      const latestObservedAt = optionalIsoTimestamp(
        row.latest_observed_at,
        "latest assignment result observation timestamp"
      );
      return {
        context: returnedContext,
        freshnessState,
        ...(latestOutcome ? { latestOutcome } : {}),
        ...(reconciliationReason ? { reconciliationReason } : {}),
        ...(projection ? { projection } : {}),
        ...(projectionHash ? { projectionHash } : {}),
        ...(successfulSyncRunId ? { successfulSyncRunId } : {}),
        ...(successfulObservedAt ? { successfulObservedAt } : {}),
        ...(freshUntil ? { freshUntil } : {}),
        ...(retainUntil ? { retainUntil } : {}),
        ...(latestObservedAt ? { latestObservedAt } : {}),
      };
    },
    async resolveQuizAttemptContext(
      session,
      internalClassGroupId,
      quizProjectionId
    ) {
      if (
        session.provider !== "supabase" ||
        session.authorizationModel !== "normalized" ||
        !session.activeRoleGrantId ||
        !quizAttemptRoles.has(
          session.activeRole as MoodleQuizAttemptContext["activeRole"]
        )
      ) {
        throw new MoodleProjectionRepositoryAuthorityError();
      }
      const scopedClassGroupId = requireUuid(
        internalClassGroupId,
        "requested quiz class group ID"
      );
      const scopedQuizProjectionId = requireUuid(
        quizProjectionId,
        "requested quiz projection ID"
      );
      const row = singleRow<QuizAttemptContextRow>(
        await rpc("resolve_moodle_quiz_attempt_context", {
          p_user_id: session.userId,
          p_active_role_grant_id: session.activeRoleGrantId,
          p_internal_class_group_id: scopedClassGroupId,
          p_quiz_projection_id: scopedQuizProjectionId,
        }),
        "quiz attempt authority"
      );
      return parseQuizAttemptContextRow(
        row,
        session,
        scopedClassGroupId,
        scopedQuizProjectionId
      );
    },
    async getQuizAttemptFreshness(input) {
      if (
        input.session.provider !== "supabase" ||
        input.session.authorizationModel !== "normalized" ||
        !input.session.activeRoleGrantId ||
        input.session.activeRole !== input.context.activeRole
      ) {
        throw new MoodleProjectionRepositoryAuthorityError();
      }
      const asOf = requireIsoTimestamp(
        input.asOf,
        "quiz attempt projection clock"
      );
      const row = singleRow<QuizAttemptFreshnessRow>(
        await rpc("list_authorized_moodle_quiz_attempt_freshness", {
          p_user_id: input.session.userId,
          p_active_role_grant_id: input.session.activeRoleGrantId,
          p_connection_id: input.context.connectionId,
          p_internal_class_group_id: input.context.internalClassGroupId,
          p_quiz_projection_id: input.context.quizProjectionId,
          p_as_of: asOf,
        }),
        "quiz attempt freshness"
      );
      const returnedContext = parseQuizAttemptContextRow(
        { ...row, observed_at: row.authority_observed_at },
        input.session,
        input.context.internalClassGroupId,
        input.context.quizProjectionId
      );
      const expectedUsers = new Set(input.context.authorizedUserIds);
      if (
        returnedContext.connectionId !== input.context.connectionId ||
        returnedContext.internalCourseId !== input.context.internalCourseId ||
        returnedContext.internalCourseRunId !==
          input.context.internalCourseRunId ||
        returnedContext.audience !== input.context.audience ||
        returnedContext.authorizedUserIds.length !== expectedUsers.size ||
        returnedContext.authorizedUserIds.some(id => !expectedUsers.has(id))
      ) {
        throw new MoodleProjectionRepositoryAuthorityError();
      }
      const freshnessState = clean(
        row.freshness_state
      ) as MoodleQuizAttemptFreshness["freshnessState"];
      if (!quizAttemptFreshnessStates.has(freshnessState)) {
        throw new MoodleProjectionRepositoryUnavailableError(
          "Moodle projection repository returned invalid quiz attempt freshness."
        );
      }
      const latestOutcome = clean(row.latest_outcome) as NonNullable<
        MoodleQuizAttemptFreshness["latestOutcome"]
      >;
      if (latestOutcome && !quizAttemptOutcomes.has(latestOutcome)) {
        throw new MoodleProjectionRepositoryUnavailableError(
          "Moodle projection repository returned invalid quiz attempt outcome."
        );
      }
      const reconciliationReason = clean(
        row.reconciliation_reason
      ) as NonNullable<MoodleQuizAttemptFreshness["reconciliationReason"]>;
      if (
        reconciliationReason &&
        !quizAttemptReconciliationReasons.has(reconciliationReason)
      ) {
        throw new MoodleProjectionRepositoryUnavailableError(
          "Moodle projection repository returned invalid quiz reconciliation."
        );
      }
      const hasProjection =
        row.sanitized_payload !== null && row.sanitized_payload !== undefined;
      const projectionHash = optionalByteaHash(row.projection_hash);
      const successfulSyncRunId = optionalUuid(
        row.successful_sync_run_id,
        "quiz attempt sync run ID"
      );
      const successfulObservedAt = optionalIsoTimestamp(
        row.successful_observed_at,
        "quiz attempt observation timestamp"
      );
      const freshUntil = optionalIsoTimestamp(
        row.fresh_until,
        "quiz attempt freshness timestamp"
      );
      const retainUntil = optionalIsoTimestamp(
        row.retain_until,
        "quiz attempt retention timestamp"
      );
      if (
        hasProjection !==
        Boolean(
          projectionHash &&
            successfulSyncRunId &&
            successfulObservedAt &&
            freshUntil &&
            retainUntil
        )
      ) {
        throw new MoodleProjectionRepositoryUnavailableError(
          "Moodle projection repository returned incomplete quiz attempt evidence."
        );
      }
      const exactMappings =
        returnedContext.courseMappingStatus === "exact" &&
        returnedContext.groupMappingStatus === "exact" &&
        returnedContext.userMappingStatus === "exact" &&
        returnedContext.quizMappingStatus === "exact";
      if (
        hasProjection !== (freshnessState === "fresh") ||
        (hasProjection && !exactMappings)
      ) {
        throw new MoodleProjectionRepositoryUnavailableError(
          "Moodle projection repository returned inconsistent quiz attempt evidence."
        );
      }
      if (
        hasProjection &&
        !(
          Date.parse(successfulObservedAt!) < Date.parse(freshUntil!) &&
          Date.parse(freshUntil!) < Date.parse(retainUntil!) &&
          Date.parse(freshUntil!) - Date.parse(successfulObservedAt!) ===
            15 * 60 * 1000 &&
          Date.parse(retainUntil!) - Date.parse(successfulObservedAt!) <=
            30 * 24 * 60 * 60 * 1000 &&
          Date.parse(asOf) <= Date.parse(freshUntil!)
        )
      ) {
        throw new MoodleProjectionRepositoryUnavailableError(
          "Moodle projection repository returned invalid quiz attempt retention."
        );
      }
      const projection = hasProjection
        ? parseStoredMoodleQuizAttemptProjection(
            returnedContext.audience,
            row.sanitized_payload
          )
        : undefined;
      if (
        projection &&
        hashMoodleProjectionPayload(row.sanitized_payload) !== projectionHash
      ) {
        throw new MoodleProjectionRepositoryUnavailableError(
          "Moodle projection repository returned a mismatched quiz attempt hash."
        );
      }
      if (
        projection &&
        (projection.internalCourseId !== returnedContext.internalCourseId ||
          projection.internalClassGroupId !==
            returnedContext.internalClassGroupId ||
          projection.quizProjectionId !== returnedContext.quizProjectionId)
      ) {
        throw new MoodleProjectionRepositoryAuthorityError();
      }
      if (projection && "learners" in projection) {
        const authorizedUsers = new Set(returnedContext.authorizedUserIds);
        if (
          projection.learners.some(
            learner => !authorizedUsers.has(learner.internalUserId)
          ) ||
          (projection.providerState === "available" &&
            projection.learners.length !== authorizedUsers.size)
        ) {
          throw new MoodleProjectionRepositoryAuthorityError();
        }
      } else if (projection && returnedContext.audience !== "aggregate") {
        throw new MoodleProjectionRepositoryAuthorityError();
      }
      const latestObservedAt = optionalIsoTimestamp(
        row.latest_observed_at,
        "latest quiz attempt observation timestamp"
      );
      return {
        context: returnedContext,
        freshnessState,
        ...(latestOutcome ? { latestOutcome } : {}),
        ...(reconciliationReason ? { reconciliationReason } : {}),
        ...(projection ? { projection } : {}),
        ...(projectionHash ? { projectionHash } : {}),
        ...(successfulSyncRunId ? { successfulSyncRunId } : {}),
        ...(successfulObservedAt ? { successfulObservedAt } : {}),
        ...(freshUntil ? { freshUntil } : {}),
        ...(retainUntil ? { retainUntil } : {}),
        ...(latestObservedAt ? { latestObservedAt } : {}),
      };
    },
    async resolveGradeOutcomeContext(
      session,
      internalClassGroupId,
      gradeItemProjectionId
    ) {
      if (
        session.provider !== "supabase" ||
        session.authorizationModel !== "normalized" ||
        !session.activeRoleGrantId ||
        !gradeOutcomeRoles.has(
          session.activeRole as MoodleGradeOutcomeContext["activeRole"]
        )
      ) {
        throw new MoodleProjectionRepositoryAuthorityError();
      }
      const scopedClassGroupId = requireUuid(
        internalClassGroupId,
        "requested grade class group ID"
      );
      const scopedGradeItemProjectionId = requireUuid(
        gradeItemProjectionId,
        "requested grade item projection ID"
      );
      const row = singleRow<GradeOutcomeContextRow>(
        await rpc("resolve_moodle_grade_outcome_context", {
          p_user_id: session.userId,
          p_active_role_grant_id: session.activeRoleGrantId,
          p_internal_class_group_id: scopedClassGroupId,
          p_grade_item_projection_id: scopedGradeItemProjectionId,
        }),
        "grade outcome authority"
      );
      return parseGradeOutcomeContextRow(
        row,
        session,
        scopedClassGroupId,
        scopedGradeItemProjectionId
      );
    },
    async getGradeOutcomeFreshness(input) {
      if (
        input.session.provider !== "supabase" ||
        input.session.authorizationModel !== "normalized" ||
        !input.session.activeRoleGrantId ||
        input.session.activeRole !== input.context.activeRole
      ) {
        throw new MoodleProjectionRepositoryAuthorityError();
      }
      const asOf = requireIsoTimestamp(
        input.asOf,
        "grade outcome projection clock"
      );
      const row = singleRow<GradeOutcomeFreshnessRow>(
        await rpc("list_authorized_moodle_grade_outcome_freshness", {
          p_user_id: input.session.userId,
          p_active_role_grant_id: input.session.activeRoleGrantId,
          p_connection_id: input.context.connectionId,
          p_internal_class_group_id: input.context.internalClassGroupId,
          p_grade_item_projection_id: input.context.gradeItemProjectionId,
          p_as_of: asOf,
        }),
        "grade outcome freshness"
      );
      const returnedContext = parseGradeOutcomeContextRow(
        { ...row, observed_at: row.authority_observed_at },
        input.session,
        input.context.internalClassGroupId,
        input.context.gradeItemProjectionId
      );
      const expectedUsers = new Set(input.context.authorizedUserIds);
      if (
        returnedContext.connectionId !== input.context.connectionId ||
        returnedContext.internalCourseId !== input.context.internalCourseId ||
        returnedContext.internalCourseRunId !==
          input.context.internalCourseRunId ||
        returnedContext.audience !== input.context.audience ||
        returnedContext.authorizedUserIds.length !== expectedUsers.size ||
        returnedContext.authorizedUserIds.some(id => !expectedUsers.has(id))
      ) {
        throw new MoodleProjectionRepositoryAuthorityError();
      }
      const freshnessState = clean(
        row.freshness_state
      ) as MoodleGradeOutcomeFreshness["freshnessState"];
      if (!gradeOutcomeFreshnessStates.has(freshnessState)) {
        throw new MoodleProjectionRepositoryUnavailableError(
          "Moodle projection repository returned invalid grade outcome freshness."
        );
      }
      const latestOutcome = clean(row.latest_outcome) as NonNullable<
        MoodleGradeOutcomeFreshness["latestOutcome"]
      >;
      if (latestOutcome && !gradeOutcomeOutcomes.has(latestOutcome)) {
        throw new MoodleProjectionRepositoryUnavailableError(
          "Moodle projection repository returned invalid grade outcome."
        );
      }
      const reconciliationReason = clean(
        row.reconciliation_reason
      ) as NonNullable<MoodleGradeOutcomeFreshness["reconciliationReason"]>;
      if (
        reconciliationReason &&
        !gradeOutcomeReconciliationReasons.has(reconciliationReason)
      ) {
        throw new MoodleProjectionRepositoryUnavailableError(
          "Moodle projection repository returned invalid grade reconciliation."
        );
      }
      const hasProjection =
        row.sanitized_payload !== null && row.sanitized_payload !== undefined;
      const projectionHash = optionalByteaHash(row.projection_hash);
      const successfulSyncRunId = optionalUuid(
        row.successful_sync_run_id,
        "grade outcome sync run ID"
      );
      const successfulObservedAt = optionalIsoTimestamp(
        row.successful_observed_at,
        "grade outcome observation timestamp"
      );
      const freshUntil = optionalIsoTimestamp(
        row.fresh_until,
        "grade outcome freshness timestamp"
      );
      const retainUntil = optionalIsoTimestamp(
        row.retain_until,
        "grade outcome retention timestamp"
      );
      if (
        hasProjection !==
        Boolean(
          projectionHash &&
            successfulSyncRunId &&
            successfulObservedAt &&
            freshUntil &&
            retainUntil
        )
      ) {
        throw new MoodleProjectionRepositoryUnavailableError(
          "Moodle projection repository returned incomplete grade outcome evidence."
        );
      }
      const exactMappings =
        returnedContext.courseMappingStatus === "exact" &&
        returnedContext.groupMappingStatus === "exact" &&
        returnedContext.userMappingStatus === "exact" &&
        returnedContext.gradeItemMappingStatus === "exact";
      if (
        hasProjection !== (freshnessState === "fresh") ||
        (hasProjection && !exactMappings)
      ) {
        throw new MoodleProjectionRepositoryUnavailableError(
          "Moodle projection repository returned inconsistent grade outcome evidence."
        );
      }
      if (
        hasProjection &&
        !(
          Date.parse(successfulObservedAt!) < Date.parse(freshUntil!) &&
          Date.parse(freshUntil!) < Date.parse(retainUntil!) &&
          Date.parse(freshUntil!) - Date.parse(successfulObservedAt!) ===
            15 * 60 * 1000 &&
          Date.parse(retainUntil!) - Date.parse(successfulObservedAt!) <=
            30 * 24 * 60 * 60 * 1000 &&
          Date.parse(asOf) <= Date.parse(freshUntil!)
        )
      ) {
        throw new MoodleProjectionRepositoryUnavailableError(
          "Moodle projection repository returned invalid grade outcome retention."
        );
      }
      const projection = hasProjection
        ? parseStoredMoodleGradeOutcomeProjection(
            returnedContext.audience,
            row.sanitized_payload
          )
        : undefined;
      if (
        projection &&
        hashMoodleProjectionPayload(row.sanitized_payload) !== projectionHash
      ) {
        throw new MoodleProjectionRepositoryUnavailableError(
          "Moodle projection repository returned a mismatched grade outcome hash."
        );
      }
      if (
        projection &&
        (projection.internalCourseId !== returnedContext.internalCourseId ||
          projection.internalClassGroupId !==
            returnedContext.internalClassGroupId ||
          projection.gradeItemProjectionId !==
            returnedContext.gradeItemProjectionId)
      ) {
        throw new MoodleProjectionRepositoryAuthorityError();
      }
      if (projection && "learners" in projection) {
        const authorizedUsers = new Set(returnedContext.authorizedUserIds);
        if (
          projection.learners.some(
            learner => !authorizedUsers.has(learner.internalUserId)
          ) ||
          (projection.providerState === "available" &&
            projection.learners.length !== authorizedUsers.size)
        ) {
          throw new MoodleProjectionRepositoryAuthorityError();
        }
      } else if (projection && returnedContext.audience !== "aggregate") {
        throw new MoodleProjectionRepositoryAuthorityError();
      }
      const latestObservedAt = optionalIsoTimestamp(
        row.latest_observed_at,
        "latest grade outcome observation timestamp"
      );
      return {
        context: returnedContext,
        freshnessState,
        ...(latestOutcome ? { latestOutcome } : {}),
        ...(reconciliationReason ? { reconciliationReason } : {}),
        ...(projection ? { projection } : {}),
        ...(projectionHash ? { projectionHash } : {}),
        ...(successfulSyncRunId ? { successfulSyncRunId } : {}),
        ...(successfulObservedAt ? { successfulObservedAt } : {}),
        ...(freshUntil ? { freshUntil } : {}),
        ...(retainUntil ? { retainUntil } : {}),
        ...(latestObservedAt ? { latestObservedAt } : {}),
      };
    },
    async resolveActivityOutcomeContext(
      session,
      internalClassGroupId,
      activityProjectionId
    ) {
      if (
        session.provider !== "supabase" ||
        session.authorizationModel !== "normalized" ||
        !session.activeRoleGrantId ||
        !activityOutcomeRoles.has(
          session.activeRole as MoodleActivityOutcomeContext["activeRole"]
        )
      ) {
        throw new MoodleProjectionRepositoryAuthorityError();
      }
      const scopedClassGroupId = requireUuid(
        internalClassGroupId,
        "requested activity class group ID"
      );
      const scopedActivityProjectionId = requireUuid(
        activityProjectionId,
        "requested activity projection ID"
      );
      const row = singleRow<ActivityOutcomeContextRow>(
        await rpc("resolve_moodle_activity_outcome_context", {
          p_user_id: session.userId,
          p_active_role_grant_id: session.activeRoleGrantId,
          p_internal_class_group_id: scopedClassGroupId,
          p_activity_projection_id: scopedActivityProjectionId,
        }),
        "activity outcome authority"
      );
      return parseActivityOutcomeContextRow(
        row,
        session,
        scopedClassGroupId,
        scopedActivityProjectionId
      );
    },
    async getActivityOutcomeFreshness(input) {
      if (
        input.session.provider !== "supabase" ||
        input.session.authorizationModel !== "normalized" ||
        !input.session.activeRoleGrantId ||
        input.session.activeRole !== input.context.activeRole
      ) {
        throw new MoodleProjectionRepositoryAuthorityError();
      }
      const asOf = requireIsoTimestamp(
        input.asOf,
        "activity outcome projection clock"
      );
      const row = singleRow<ActivityOutcomeFreshnessRow>(
        await rpc("list_authorized_moodle_activity_outcome_freshness", {
          p_user_id: input.session.userId,
          p_active_role_grant_id: input.session.activeRoleGrantId,
          p_connection_id: input.context.connectionId,
          p_internal_class_group_id: input.context.internalClassGroupId,
          p_activity_projection_id: input.context.activityProjectionId,
          p_as_of: asOf,
        }),
        "activity outcome freshness"
      );
      const returnedContext = parseActivityOutcomeContextRow(
        { ...row, observed_at: row.authority_observed_at },
        input.session,
        input.context.internalClassGroupId,
        input.context.activityProjectionId
      );
      const expectedUsers = new Set(input.context.authorizedUserIds);
      if (
        returnedContext.connectionId !== input.context.connectionId ||
        returnedContext.internalCourseId !== input.context.internalCourseId ||
        returnedContext.internalCourseRunId !==
          input.context.internalCourseRunId ||
        returnedContext.audience !== input.context.audience ||
        returnedContext.activityKind !== input.context.activityKind ||
        returnedContext.authorizedUserIds.length !== expectedUsers.size ||
        returnedContext.authorizedUserIds.some(id => !expectedUsers.has(id))
      ) {
        throw new MoodleProjectionRepositoryAuthorityError();
      }
      const freshnessState = clean(
        row.freshness_state
      ) as MoodleActivityOutcomeFreshness["freshnessState"];
      if (!activityOutcomeFreshnessStates.has(freshnessState)) {
        throw new MoodleProjectionRepositoryUnavailableError(
          "Moodle projection repository returned invalid activity outcome freshness."
        );
      }
      const latestOutcome = clean(row.latest_outcome) as NonNullable<
        MoodleActivityOutcomeFreshness["latestOutcome"]
      >;
      if (latestOutcome && !activityOutcomeOutcomes.has(latestOutcome)) {
        throw new MoodleProjectionRepositoryUnavailableError(
          "Moodle projection repository returned invalid activity outcome."
        );
      }
      const reconciliationReason = clean(
        row.reconciliation_reason
      ) as NonNullable<MoodleActivityOutcomeFreshness["reconciliationReason"]>;
      if (
        reconciliationReason &&
        !activityOutcomeReconciliationReasons.has(reconciliationReason)
      ) {
        throw new MoodleProjectionRepositoryUnavailableError(
          "Moodle projection repository returned invalid activity reconciliation."
        );
      }
      const hasProjection =
        row.sanitized_payload !== null && row.sanitized_payload !== undefined;
      const projectionHash = optionalByteaHash(row.projection_hash);
      const successfulSyncRunId = optionalUuid(
        row.successful_sync_run_id,
        "activity outcome sync run ID"
      );
      const successfulObservedAt = optionalIsoTimestamp(
        row.successful_observed_at,
        "activity outcome observation timestamp"
      );
      const freshUntil = optionalIsoTimestamp(
        row.fresh_until,
        "activity outcome freshness timestamp"
      );
      const retainUntil = optionalIsoTimestamp(
        row.retain_until,
        "activity outcome retention timestamp"
      );
      if (
        hasProjection !==
        Boolean(
          projectionHash &&
            successfulSyncRunId &&
            successfulObservedAt &&
            freshUntil &&
            retainUntil
        )
      ) {
        throw new MoodleProjectionRepositoryUnavailableError(
          "Moodle projection repository returned incomplete activity outcome evidence."
        );
      }
      const exactMappings =
        returnedContext.courseMappingStatus === "exact" &&
        returnedContext.groupMappingStatus === "exact" &&
        returnedContext.userMappingStatus === "exact" &&
        returnedContext.activityMappingStatus === "exact";
      if (
        hasProjection !== (freshnessState === "fresh") ||
        (hasProjection && !exactMappings)
      ) {
        throw new MoodleProjectionRepositoryUnavailableError(
          "Moodle projection repository returned inconsistent activity outcome evidence."
        );
      }
      if (
        hasProjection &&
        !(
          Date.parse(successfulObservedAt!) < Date.parse(freshUntil!) &&
          Date.parse(freshUntil!) < Date.parse(retainUntil!) &&
          Date.parse(freshUntil!) - Date.parse(successfulObservedAt!) ===
            15 * 60 * 1000 &&
          Date.parse(retainUntil!) - Date.parse(successfulObservedAt!) <=
            30 * 24 * 60 * 60 * 1000 &&
          Date.parse(asOf) <= Date.parse(freshUntil!)
        )
      ) {
        throw new MoodleProjectionRepositoryUnavailableError(
          "Moodle projection repository returned invalid activity outcome retention."
        );
      }
      const projection = hasProjection
        ? parseStoredMoodleActivityOutcomeProjection(
            returnedContext.audience,
            row.sanitized_payload
          )
        : undefined;
      if (
        projection &&
        hashMoodleProjectionPayload(row.sanitized_payload) !== projectionHash
      ) {
        throw new MoodleProjectionRepositoryUnavailableError(
          "Moodle projection repository returned a mismatched activity outcome hash."
        );
      }
      if (
        projection &&
        (projection.internalCourseId !== returnedContext.internalCourseId ||
          projection.internalClassGroupId !==
            returnedContext.internalClassGroupId ||
          projection.activityProjectionId !==
            returnedContext.activityProjectionId ||
          projection.activityKind !== returnedContext.activityKind)
      ) {
        throw new MoodleProjectionRepositoryAuthorityError();
      }
      if (projection && "learners" in projection) {
        const authorizedUsers = new Set(returnedContext.authorizedUserIds);
        if (
          projection.learners.some(
            learner => !authorizedUsers.has(learner.internalUserId)
          ) ||
          (projection.providerState === "available" &&
            projection.learners.length !== authorizedUsers.size)
        ) {
          throw new MoodleProjectionRepositoryAuthorityError();
        }
      } else if (projection && returnedContext.audience !== "aggregate") {
        throw new MoodleProjectionRepositoryAuthorityError();
      }
      const latestObservedAt = optionalIsoTimestamp(
        row.latest_observed_at,
        "latest activity outcome observation timestamp"
      );
      return {
        context: returnedContext,
        freshnessState,
        ...(latestOutcome ? { latestOutcome } : {}),
        ...(reconciliationReason ? { reconciliationReason } : {}),
        ...(projection ? { projection } : {}),
        ...(projectionHash ? { projectionHash } : {}),
        ...(successfulSyncRunId ? { successfulSyncRunId } : {}),
        ...(successfulObservedAt ? { successfulObservedAt } : {}),
        ...(freshUntil ? { freshUntil } : {}),
        ...(retainUntil ? { retainUntil } : {}),
        ...(latestObservedAt ? { latestObservedAt } : {}),
      };
    },
    async listProjectionObservations(input) {
      if (
        input.session.provider !== "supabase" ||
        input.session.authorizationModel !== "normalized" ||
        !input.session.activeRoleGrantId ||
        input.session.activeRole !== input.authority.activeRole
      ) {
        throw new MoodleProjectionRepositoryAuthorityError();
      }
      const connectionId = requireUuid(
        input.authority.connectionId,
        "projection connection ID"
      );
      const asOf = requireIsoTimestamp(input.asOf, "projection clock");
      const authorizedIds = new Set(input.authority.authorizedCourseIds);
      const internalCourseIds = input.internalCourseIds
        ? Array.from(new Set(input.internalCourseIds)).map(id =>
            requireUuid(id, "projection course ID")
          )
        : null;
      if (
        internalCourseIds?.some(
          internalCourseId => !authorizedIds.has(internalCourseId)
        )
      ) {
        throw new MoodleProjectionRepositoryAuthorityError();
      }
      const payload = await rpc("list_authorized_moodle_projection_freshness", {
        p_user_id: input.session.userId,
        p_active_role_grant_id: input.session.activeRoleGrantId,
        p_connection_id: connectionId,
        p_projection_family: input.projectionFamily,
        p_as_of: asOf,
        p_internal_course_ids: internalCourseIds,
      });
      if (!Array.isArray(payload)) {
        throw new MoodleProjectionRepositoryUnavailableError(
          "Moodle projection repository returned invalid observations."
        );
      }
      const responseScope = new Set(
        internalCourseIds ?? input.authority.authorizedCourseIds
      );
      const seen = new Set<string>();
      return payload.map((candidate: ProjectionObservationRow) => {
        if (
          requireUuid(candidate.connection_id, "observation connection ID") !==
            connectionId ||
          clean(candidate.active_role) !== input.authority.activeRole ||
          clean(candidate.projection_family) !== input.projectionFamily
        ) {
          throw new MoodleProjectionRepositoryAuthorityError();
        }
        const internalCourseId = requireUuid(
          candidate.internal_course_id,
          "observed course ID"
        );
        if (
          !authorizedIds.has(internalCourseId) ||
          !responseScope.has(internalCourseId)
        ) {
          throw new MoodleProjectionRepositoryAuthorityError();
        }
        if (seen.has(internalCourseId)) {
          throw new MoodleProjectionRepositoryUnavailableError(
            "Moodle projection repository returned duplicate observations."
          );
        }
        seen.add(internalCourseId);
        const externalCourseId = clean(candidate.external_course_id);
        if (
          externalCourseId &&
          (!/^[1-9]\d*$/.test(externalCourseId) ||
            !Number.isSafeInteger(Number(externalCourseId)))
        ) {
          throw new MoodleProjectionRepositoryUnavailableError(
            "Moodle projection repository returned an invalid observed external course ID."
          );
        }
        const mappingState = clean(
          candidate.mapping_state
        ) as MoodleMappingState;
        if (mappingState && !mappingStates.has(mappingState)) {
          throw new MoodleProjectionRepositoryUnavailableError(
            "Moodle projection repository returned an invalid observed mapping state."
          );
        }
        const reconciliationReason = clean(candidate.reconciliation_reason);
        if (
          reconciliationReason &&
          !reconciliationReasons.has(reconciliationReason)
        ) {
          throw new MoodleProjectionRepositoryUnavailableError(
            "Moodle projection repository returned an invalid reconciliation reason."
          );
        }
        const latestOutcome = clean(
          candidate.latest_outcome
        ) as MoodleProjectionOutcome;
        if (!latestOutcome) {
          return {
            internalCourseId,
            ...(externalCourseId ? { externalCourseId } : {}),
            ...(mappingState ? { mappingState } : {}),
            observation: null,
          };
        }
        if (!projectionOutcomes.has(latestOutcome)) {
          throw new MoodleProjectionRepositoryUnavailableError(
            "Moodle projection repository returned an invalid observation outcome."
          );
        }
        const lastAttemptedAt = requireIsoTimestamp(
          candidate.latest_observed_at,
          "latest observation timestamp"
        );
        const payloadHash = optionalByteaHash(candidate.projection_hash);
        const successfulSyncRunId = optionalUuid(
          candidate.successful_sync_run_id,
          "successful sync run ID"
        );
        const successfulObservedAt = optionalIsoTimestamp(
          candidate.successful_observed_at,
          "successful observation timestamp"
        );
        const freshUntil = optionalIsoTimestamp(
          candidate.fresh_until,
          "projection freshness timestamp"
        );
        const retainUntil = optionalIsoTimestamp(
          candidate.retain_until,
          "projection retention timestamp"
        );
        const hasSuccess =
          candidate.sanitized_payload !== null &&
          candidate.sanitized_payload !== undefined;
        if (
          hasSuccess !==
          Boolean(
            payloadHash &&
              successfulSyncRunId &&
              successfulObservedAt &&
              freshUntil &&
              retainUntil
          )
        ) {
          throw new MoodleProjectionRepositoryUnavailableError(
            "Moodle projection repository returned an incomplete retained projection."
          );
        }
        const sanitizedPayload = candidate.sanitized_payload;
        const itemCount = Array.isArray(sanitizedPayload)
          ? sanitizedPayload.length
          : 0;
        return {
          internalCourseId,
          ...(externalCourseId ? { externalCourseId } : {}),
          ...(mappingState ? { mappingState } : {}),
          ...(reconciliationReason
            ? {
                reconciliationReason: reconciliationReason as
                  | "missing_mapping"
                  | "missing_provider_record"
                  | "ambiguous_mapping",
              }
            : {}),
          observation: {
            projectionFamily: input.projectionFamily,
            internalCourseId,
            ...(externalCourseId ? { externalCourseId } : {}),
            latestOutcome,
            lastAttemptedAt,
            ...(hasSuccess
              ? {
                  lastSuccess: {
                    runId: successfulSyncRunId!,
                    payload: sanitizedPayload,
                    payloadHash: payloadHash!,
                    itemCount,
                    observedAt: successfulObservedAt!,
                    freshUntil: freshUntil!,
                    retainUntil: retainUntil!,
                  },
                }
              : {}),
          },
        };
      });
    },
  };
}

let repositoryOverride: MoodleProjectionRepository | null = null;
let defaultSupabaseRepository: MoodleProjectionRepository | null = null;

export function getMoodleProjectionRepository(
  env: NodeJS.ProcessEnv = process.env
) {
  if (repositoryOverride) return repositoryOverride;
  const mode = repositoryMode(env);
  if (mode !== "supabase") {
    throw new MoodleProjectionRepositoryUnavailableError(
      "Set NILE_MOODLE_PROJECTION_REPOSITORY=supabase to enable normalized read-only projections."
    );
  }
  defaultSupabaseRepository ??= createSupabaseMoodleProjectionRepository({
    env,
  });
  return defaultSupabaseRepository;
}

export function setMoodleProjectionRepository(
  repository: MoodleProjectionRepository
) {
  const previous = repositoryOverride;
  repositoryOverride = repository;
  return () => {
    repositoryOverride = previous;
  };
}

export function resetDefaultMoodleProjectionRepository() {
  repositoryOverride = null;
  defaultSupabaseRepository = null;
}
