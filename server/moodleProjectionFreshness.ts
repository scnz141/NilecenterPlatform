import { createHash } from "node:crypto";

import {
  MOODLE_READ_MODEL_LIMITS,
  sanitizeMoodleProjectionText,
  type ExternalActivityReadModel,
  type ExternalCourseReadModel,
  type ExternalCourseSectionReadModel,
} from "./moodleReadModels.js";

export type MoodleProjectionFamily = "course_catalog" | "course_content";
export type MoodleProjectionAvailability =
  | "available"
  | "empty"
  | "unavailable";
export type MoodleProjectionFreshness = "fresh" | "stale" | "unavailable";
export type MoodleProjectionOutcome =
  | "available"
  | "empty"
  | "missing_mapping"
  | "missing_provider_record"
  | "ambiguous_mapping"
  | "reconciliation"
  | "unavailable"
  | "invalid_payload";

export type MoodleProjectionSuccessfulObservation = Readonly<{
  runId: string;
  payload: unknown;
  payloadHash: string;
  itemCount: number;
  observedAt: string;
  freshUntil: string;
  retainUntil: string;
}>;

export type MoodleProjectionObservation = Readonly<{
  projectionFamily: MoodleProjectionFamily;
  internalCourseId?: string;
  externalCourseId?: string;
  latestOutcome: MoodleProjectionOutcome;
  lastAttemptedAt: string;
  lastSuccess?: MoodleProjectionSuccessfulObservation;
}>;

export type ResolvedMoodleProjection<T> = Readonly<{
  availability: MoodleProjectionAvailability;
  freshness: MoodleProjectionFreshness;
  latestOutcome: MoodleProjectionOutcome;
  lastAttemptedAt?: string;
  observation?: Readonly<{
    runId: string;
    observedAt: string;
    freshUntil: string;
    retainUntil: string;
    payloadHash: string;
  }>;
  payload?: T;
}>;

export type MoodleEnrollmentGroupAudience = "person_level" | "aggregate";

export type MoodleEnrollmentGroupLearnerProjection = Readonly<{
  internalUserId: string;
  internalEnrollmentId: string;
  internalMembershipId: string;
  providerState: "enrolled";
  mappingStatus: "exact" | "missing";
}>;

export type MoodleEnrollmentGroupPersonProjection = Readonly<{
  internalCourseId: string;
  internalClassGroupId: string;
  providerState: "available" | "empty";
  mappingStatus: "exact" | "reconciliation";
  learners: readonly MoodleEnrollmentGroupLearnerProjection[];
}>;

export type MoodleEnrollmentGroupAggregateProjection = Readonly<{
  internalCourseId: string;
  internalClassGroupId: string;
  providerState: "available" | "empty";
  mappingStatus: "exact" | "reconciliation";
  learnerCount: number;
  mappedLearnerCount: number;
  unmappedLearnerCount: number;
}>;

export type MoodleEnrollmentGroupProjection =
  | MoodleEnrollmentGroupPersonProjection
  | MoodleEnrollmentGroupAggregateProjection;

export type MoodleAssessmentStatusItem = Readonly<{
  projectionId: string;
  kind: "assignment" | "quiz";
  title: string;
  visibility: "visible" | "hidden";
  scheduleState: "scheduled" | "open" | "closed" | "unavailable";
  opensAt?: string;
  dueAt?: string;
  cutoffAt?: string;
  closesAt?: string;
  acceptsSubmissions?: boolean;
}>;

export type MoodleAssessmentStatusProjection = Readonly<{
  internalCourseId: string;
  internalClassGroupId: string;
  providerState: "available" | "empty";
  mappingStatus: "exact" | "reconciliation";
  items: readonly MoodleAssessmentStatusItem[];
}>;

export type MoodleAssignmentResultAudience =
  | "learner"
  | "person_level"
  | "aggregate";

export type MoodleAssignmentResultLearnerProjection = Readonly<{
  internalUserId: string;
  internalEnrollmentId: string;
  internalMembershipId: string;
  submissionState: "not_submitted" | "draft" | "submitted" | "reopened";
  attemptNumber: number;
  gradingState: "not_graded" | "graded" | "released";
  latest: boolean;
  submittedAt?: string;
  modifiedAt?: string;
  score?: number;
  maximumScore?: number;
  gradedAt?: string;
}>;

export type MoodleAssignmentResultPersonProjection = Readonly<{
  internalCourseId: string;
  internalClassGroupId: string;
  assignmentProjectionId: string;
  providerState: "available" | "empty";
  mappingStatus: "exact";
  learners: readonly MoodleAssignmentResultLearnerProjection[];
}>;

export type MoodleAssignmentResultAggregateProjection = Readonly<{
  internalCourseId: string;
  internalClassGroupId: string;
  assignmentProjectionId: string;
  providerState: "available" | "empty";
  mappingStatus: "exact";
  learnerCount: number;
  submittedCount: number;
  gradedCount: number;
}>;

export type MoodleAssignmentResultProjection =
  | MoodleAssignmentResultPersonProjection
  | MoodleAssignmentResultAggregateProjection;

export type MoodleQuizAttemptAudience =
  | "learner"
  | "person_level"
  | "aggregate";

export type MoodleQuizAttemptLearnerProjection = Readonly<{
  internalUserId: string;
  internalEnrollmentId: string;
  internalMembershipId: string;
  attemptProjectionId?: string;
  attemptState: "not_started" | "in_progress" | "finished" | "abandoned";
  attemptNumber: number;
  gradingState: "not_graded" | "graded" | "released";
  latest: boolean;
  preview: false;
  startedAt?: string;
  finishedAt?: string;
  modifiedAt?: string;
  score?: number;
  maximumScore?: number;
}>;

export type MoodleQuizAttemptPersonProjection = Readonly<{
  internalCourseId: string;
  internalClassGroupId: string;
  quizProjectionId: string;
  providerState: "available" | "empty";
  mappingStatus: "exact";
  learners: readonly MoodleQuizAttemptLearnerProjection[];
}>;

export type MoodleQuizAttemptAggregateProjection = Readonly<{
  internalCourseId: string;
  internalClassGroupId: string;
  quizProjectionId: string;
  providerState: "available" | "empty";
  mappingStatus: "exact";
  learnerCount: number;
  attemptedCount: number;
  finishedCount: number;
  gradedCount: number;
}>;

export type MoodleQuizAttemptProjection =
  | MoodleQuizAttemptPersonProjection
  | MoodleQuizAttemptAggregateProjection;

export type MoodleGradeOutcomeAudience =
  | "learner"
  | "person_level"
  | "aggregate";

export type MoodleGradeOutcomeLearnerProjection = Readonly<{
  internalUserId: string;
  internalEnrollmentId: string;
  internalMembershipId: string;
  gradingState: "not_graded" | "graded" | "released";
  score?: number;
  maximumScore?: number;
  gradedAt?: string;
  releasedAt?: string;
  feedback?: string;
}>;

export type MoodleGradeOutcomePersonProjection = Readonly<{
  internalCourseId: string;
  internalClassGroupId: string;
  gradeItemProjectionId: string;
  providerState: "available" | "empty";
  mappingStatus: "exact";
  learners: readonly MoodleGradeOutcomeLearnerProjection[];
}>;

export type MoodleGradeOutcomeAggregateProjection = Readonly<{
  internalCourseId: string;
  internalClassGroupId: string;
  gradeItemProjectionId: string;
  providerState: "available" | "empty";
  mappingStatus: "exact";
  learnerCount: number;
  gradedCount: number;
  releasedCount: number;
  feedbackReleasedCount: number;
}>;

export type MoodleGradeOutcomeProjection =
  | MoodleGradeOutcomePersonProjection
  | MoodleGradeOutcomeAggregateProjection;

export type MoodleActivityOutcomeAudience =
  | "learner"
  | "person_level"
  | "aggregate";

export type MoodleActivityOutcomeKind = "lesson" | "h5p" | "scorm";

export type MoodleActivityOutcomeLearnerProjection = Readonly<{
  internalUserId: string;
  internalEnrollmentId: string;
  internalMembershipId: string;
  completionState:
    | "not_started"
    | "in_progress"
    | "completed"
    | "passed"
    | "failed";
  scoreState: "not_scored" | "released";
  completedAt?: string;
  score?: number;
  maximumScore?: number;
  releasedAt?: string;
}>;

export type MoodleActivityOutcomePersonProjection = Readonly<{
  internalCourseId: string;
  internalClassGroupId: string;
  activityProjectionId: string;
  activityKind: MoodleActivityOutcomeKind;
  providerState: "available" | "empty";
  mappingStatus: "exact";
  learners: readonly MoodleActivityOutcomeLearnerProjection[];
}>;

export type MoodleActivityOutcomeAggregateProjection = Readonly<{
  internalCourseId: string;
  internalClassGroupId: string;
  activityProjectionId: string;
  activityKind: MoodleActivityOutcomeKind;
  providerState: "available" | "empty";
  mappingStatus: "exact";
  learnerCount: number;
  startedCount: number;
  completedCount: number;
  passedCount: number;
  failedCount: number;
  scoredCount: number;
}>;

export type MoodleActivityOutcomeProjection =
  | MoodleActivityOutcomePersonProjection
  | MoodleActivityOutcomeAggregateProjection;

export class MoodleProjectionSnapshotError extends Error {
  constructor(message = "Stored Moodle projection is invalid.") {
    super(message);
    this.name = "MoodleProjectionSnapshotError";
  }
}

const allowedCourseKeys = new Set([
  "sourceId",
  "categorySourceId",
  "title",
  "shortTitle",
  "visible",
  "startsAt",
  "endsAt",
  "completionTrackingEnabled",
]);
const allowedSectionKeys = new Set([
  "sourceId",
  "position",
  "title",
  "visible",
  "activities",
]);
const allowedActivityKeys = new Set([
  "sourceId",
  "instanceSourceId",
  "type",
  "title",
  "visible",
  "completionTracking",
]);
const allowedEnrollmentGroupPersonKeys = new Set([
  "internalCourseId",
  "internalClassGroupId",
  "providerState",
  "mappingStatus",
  "learners",
]);
const allowedEnrollmentGroupAggregateKeys = new Set([
  "internalCourseId",
  "internalClassGroupId",
  "providerState",
  "mappingStatus",
  "learnerCount",
  "mappedLearnerCount",
  "unmappedLearnerCount",
]);
const allowedEnrollmentGroupLearnerKeys = new Set([
  "internalUserId",
  "internalEnrollmentId",
  "internalMembershipId",
  "providerState",
  "mappingStatus",
]);
const allowedAssessmentStatusKeys = new Set([
  "internalCourseId",
  "internalClassGroupId",
  "providerState",
  "mappingStatus",
  "items",
]);
const allowedAssessmentStatusItemKeys = new Set([
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
]);
const allowedAssignmentResultPersonKeys = new Set([
  "internalCourseId",
  "internalClassGroupId",
  "assignmentProjectionId",
  "providerState",
  "mappingStatus",
  "learners",
]);
const allowedAssignmentResultAggregateKeys = new Set([
  "internalCourseId",
  "internalClassGroupId",
  "assignmentProjectionId",
  "providerState",
  "mappingStatus",
  "learnerCount",
  "submittedCount",
  "gradedCount",
]);
const allowedAssignmentResultLearnerKeys = new Set([
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
]);
const allowedQuizAttemptPersonKeys = new Set([
  "internalCourseId",
  "internalClassGroupId",
  "quizProjectionId",
  "providerState",
  "mappingStatus",
  "learners",
]);
const allowedQuizAttemptAggregateKeys = new Set([
  "internalCourseId",
  "internalClassGroupId",
  "quizProjectionId",
  "providerState",
  "mappingStatus",
  "learnerCount",
  "attemptedCount",
  "finishedCount",
  "gradedCount",
]);
const allowedQuizAttemptLearnerKeys = new Set([
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
]);
const allowedGradeOutcomePersonKeys = new Set([
  "internalCourseId",
  "internalClassGroupId",
  "gradeItemProjectionId",
  "providerState",
  "mappingStatus",
  "learners",
]);
const allowedGradeOutcomeAggregateKeys = new Set([
  "internalCourseId",
  "internalClassGroupId",
  "gradeItemProjectionId",
  "providerState",
  "mappingStatus",
  "learnerCount",
  "gradedCount",
  "releasedCount",
  "feedbackReleasedCount",
]);
const allowedGradeOutcomeLearnerKeys = new Set([
  "internalUserId",
  "internalEnrollmentId",
  "internalMembershipId",
  "gradingState",
  "score",
  "maximumScore",
  "gradedAt",
  "releasedAt",
  "feedback",
]);
const allowedActivityOutcomePersonKeys = new Set([
  "internalCourseId",
  "internalClassGroupId",
  "activityProjectionId",
  "activityKind",
  "providerState",
  "mappingStatus",
  "learners",
]);
const allowedActivityOutcomeAggregateKeys = new Set([
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
]);
const allowedActivityOutcomeLearnerKeys = new Set([
  "internalUserId",
  "internalEnrollmentId",
  "internalMembershipId",
  "completionState",
  "scoreState",
  "completedAt",
  "score",
  "maximumScore",
  "releasedAt",
]);

function object(value: unknown, label: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new MoodleProjectionSnapshotError(`Invalid ${label}.`);
  }
  return value as Record<string, unknown>;
}

function exactKeys(
  value: Record<string, unknown>,
  allowed: ReadonlySet<string>,
  label: string
) {
  if (Object.keys(value).some(key => !allowed.has(key))) {
    throw new MoodleProjectionSnapshotError(`Unexpected ${label} field.`);
  }
}

function text(
  value: unknown,
  label: string,
  maximum: number = MOODLE_READ_MODEL_LIMITS.titleCharacters
) {
  if (
    typeof value !== "string" ||
    value.trim().length === 0 ||
    value.length > maximum
  ) {
    throw new MoodleProjectionSnapshotError(`Invalid ${label}.`);
  }
  try {
    const sanitized = sanitizeMoodleProjectionText(value, label, maximum);
    if (sanitized !== value) {
      throw new MoodleProjectionSnapshotError(`Unsafe ${label}.`);
    }
    return sanitized;
  } catch (error) {
    if (error instanceof MoodleProjectionSnapshotError) throw error;
    throw new MoodleProjectionSnapshotError(`Invalid ${label}.`);
  }
}

function optionalText(value: unknown, label: string, maximum?: number) {
  return value === undefined ? undefined : text(value, label, maximum);
}

function optionalBoolean(value: unknown, label: string) {
  if (value === undefined) return undefined;
  if (typeof value !== "boolean") {
    throw new MoodleProjectionSnapshotError(`Invalid ${label}.`);
  }
  return value;
}

function sourceId(value: unknown, label: string) {
  const id = text(value, label, 64);
  if (!/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(id))) {
    throw new MoodleProjectionSnapshotError(`Invalid ${label}.`);
  }
  return id;
}

function uuid(value: unknown, label: string) {
  const id = typeof value === "string" ? value.trim() : "";
  if (
    id !== value ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      id
    )
  ) {
    throw new MoodleProjectionSnapshotError(`Invalid ${label}.`);
  }
  return id;
}

function count(value: unknown, label: string) {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    throw new MoodleProjectionSnapshotError(`Invalid ${label}.`);
  }
  return value as number;
}

function finiteNonnegativeNumber(value: unknown, label: string) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new MoodleProjectionSnapshotError(`Invalid ${label}.`);
  }
  return value;
}

function optionalIso(value: unknown, label: string) {
  if (value === undefined) return undefined;
  return iso(value, label);
}

function iso(value: unknown, label: string) {
  const timestamp = text(value, label, 64);
  if (!Number.isFinite(Date.parse(timestamp))) {
    throw new MoodleProjectionSnapshotError(`Invalid ${label}.`);
  }
  return timestamp;
}

function parseCourse(value: unknown): ExternalCourseReadModel {
  const row = object(value, "course projection");
  exactKeys(row, allowedCourseKeys, "course projection");
  return {
    sourceId: sourceId(row.sourceId, "course source ID"),
    ...(row.categorySourceId === undefined
      ? {}
      : {
          categorySourceId: sourceId(
            row.categorySourceId,
            "course category source ID"
          ),
        }),
    title: text(row.title, "course title"),
    shortTitle: text(row.shortTitle, "course short title"),
    ...(optionalBoolean(row.visible, "course visibility") === undefined
      ? {}
      : { visible: row.visible as boolean }),
    ...(optionalIso(row.startsAt, "course start")
      ? { startsAt: row.startsAt as string }
      : {}),
    ...(optionalIso(row.endsAt, "course end")
      ? { endsAt: row.endsAt as string }
      : {}),
    ...(optionalBoolean(
      row.completionTrackingEnabled,
      "course completion tracking"
    ) === undefined
      ? {}
      : {
          completionTrackingEnabled: row.completionTrackingEnabled as boolean,
        }),
  };
}

function parseActivity(value: unknown): ExternalActivityReadModel {
  const row = object(value, "activity projection");
  exactKeys(row, allowedActivityKeys, "activity projection");
  const completionTracking = optionalText(
    row.completionTracking,
    "activity completion tracking",
    16
  );
  if (
    completionTracking !== undefined &&
    !["none", "manual", "automatic"].includes(completionTracking)
  ) {
    throw new MoodleProjectionSnapshotError(
      "Invalid activity completion tracking."
    );
  }
  return {
    sourceId: sourceId(row.sourceId, "activity source ID"),
    instanceSourceId: sourceId(
      row.instanceSourceId,
      "activity instance source ID"
    ),
    type: text(row.type, "activity type", 64),
    title: text(row.title, "activity title"),
    ...(optionalBoolean(row.visible, "activity visibility") === undefined
      ? {}
      : { visible: row.visible as boolean }),
    ...(completionTracking
      ? {
          completionTracking: completionTracking as
            | "none"
            | "manual"
            | "automatic",
        }
      : {}),
  };
}

function parseSection(value: unknown): ExternalCourseSectionReadModel {
  const row = object(value, "section projection");
  exactKeys(row, allowedSectionKeys, "section projection");
  if (
    !Number.isSafeInteger(row.position) ||
    (row.position as number) < 0 ||
    !Array.isArray(row.activities) ||
    row.activities.length > MOODLE_READ_MODEL_LIMITS.nestedItems
  ) {
    throw new MoodleProjectionSnapshotError("Invalid section projection.");
  }
  return {
    sourceId: sourceId(row.sourceId, "section source ID"),
    position: row.position as number,
    ...(optionalText(row.title, "section title")
      ? { title: row.title as string }
      : {}),
    ...(optionalBoolean(row.visible, "section visibility") === undefined
      ? {}
      : { visible: row.visible as boolean }),
    activities: row.activities.map(parseActivity),
  };
}

function enrollmentGroupProviderState(value: unknown): "available" | "empty" {
  const state = text(value, "provider state", 16);
  if (state !== "available" && state !== "empty") {
    throw new MoodleProjectionSnapshotError("Invalid provider state.");
  }
  return state;
}

function enrollmentGroupMappingStatus(
  value: unknown
): "exact" | "reconciliation" {
  const status = text(value, "mapping status", 24);
  if (status !== "exact" && status !== "reconciliation") {
    throw new MoodleProjectionSnapshotError("Invalid mapping status.");
  }
  return status;
}

function parseEnrollmentGroupLearner(
  value: unknown
): MoodleEnrollmentGroupLearnerProjection {
  const row = object(value, "enrollment group learner projection");
  exactKeys(
    row,
    allowedEnrollmentGroupLearnerKeys,
    "enrollment group learner projection"
  );
  const mappingStatus = text(row.mappingStatus, "learner mapping status", 16);
  if (
    row.providerState !== "enrolled" ||
    (mappingStatus !== "exact" && mappingStatus !== "missing")
  ) {
    throw new MoodleProjectionSnapshotError(
      "Invalid enrollment group learner state."
    );
  }
  return {
    internalUserId: uuid(row.internalUserId, "internal user ID"),
    internalEnrollmentId: uuid(
      row.internalEnrollmentId,
      "internal enrollment ID"
    ),
    internalMembershipId: uuid(
      row.internalMembershipId,
      "internal membership ID"
    ),
    providerState: "enrolled",
    mappingStatus,
  };
}

export function parseStoredMoodleEnrollmentGroupProjection(
  audience: MoodleEnrollmentGroupAudience,
  payload: unknown
): MoodleEnrollmentGroupProjection {
  const row = object(payload, "enrollment group projection");
  const base = {
    internalCourseId: uuid(row.internalCourseId, "internal course ID"),
    internalClassGroupId: uuid(
      row.internalClassGroupId,
      "internal class group ID"
    ),
    providerState: enrollmentGroupProviderState(row.providerState),
    mappingStatus: enrollmentGroupMappingStatus(row.mappingStatus),
  };
  if (audience === "person_level") {
    exactKeys(
      row,
      allowedEnrollmentGroupPersonKeys,
      "person-level enrollment group projection"
    );
    if (!Array.isArray(row.learners) || row.learners.length > 500) {
      throw new MoodleProjectionSnapshotError("Invalid enrollment learners.");
    }
    const learners = row.learners.map(parseEnrollmentGroupLearner);
    if (
      new Set(learners.map(learner => learner.internalUserId)).size !==
      learners.length
    ) {
      throw new MoodleProjectionSnapshotError(
        "Duplicate enrollment group learner."
      );
    }
    return { ...base, learners };
  }

  exactKeys(
    row,
    allowedEnrollmentGroupAggregateKeys,
    "aggregate enrollment group projection"
  );
  const learnerCount = count(row.learnerCount, "learner count");
  const mappedLearnerCount = count(
    row.mappedLearnerCount,
    "mapped learner count"
  );
  const unmappedLearnerCount = count(
    row.unmappedLearnerCount,
    "unmapped learner count"
  );
  if (mappedLearnerCount + unmappedLearnerCount !== learnerCount) {
    throw new MoodleProjectionSnapshotError(
      "Inconsistent enrollment group counts."
    );
  }
  return {
    ...base,
    learnerCount,
    mappedLearnerCount,
    unmappedLearnerCount,
  };
}

function parseAssessmentStatusItem(value: unknown): MoodleAssessmentStatusItem {
  const row = object(value, "assessment status item");
  exactKeys(row, allowedAssessmentStatusItemKeys, "assessment status item");
  const kind = text(row.kind, "assessment kind", 16);
  const visibility = text(row.visibility, "assessment visibility", 16);
  const scheduleState = text(
    row.scheduleState,
    "assessment schedule state",
    16
  );
  if (
    (kind !== "assignment" && kind !== "quiz") ||
    (visibility !== "visible" && visibility !== "hidden") ||
    !["scheduled", "open", "closed", "unavailable"].includes(scheduleState)
  ) {
    throw new MoodleProjectionSnapshotError("Invalid assessment status item.");
  }
  if (
    (kind === "assignment" && row.closesAt !== undefined) ||
    (kind === "quiz" &&
      (row.dueAt !== undefined ||
        row.cutoffAt !== undefined ||
        row.acceptsSubmissions !== undefined))
  ) {
    throw new MoodleProjectionSnapshotError(
      "Invalid assessment status fields for kind."
    );
  }
  const opensAt = optionalIso(row.opensAt, "assessment opening timestamp");
  const dueAt = optionalIso(row.dueAt, "assignment due timestamp");
  const cutoffAt = optionalIso(row.cutoffAt, "assignment cutoff timestamp");
  const closesAt = optionalIso(row.closesAt, "quiz closing timestamp");
  const acceptsSubmissions = optionalBoolean(
    row.acceptsSubmissions,
    "assignment submission setting"
  );
  return {
    projectionId: uuid(row.projectionId, "assessment projection ID"),
    kind,
    title: text(row.title, "assessment title"),
    visibility,
    scheduleState: scheduleState as MoodleAssessmentStatusItem["scheduleState"],
    ...(opensAt ? { opensAt } : {}),
    ...(dueAt ? { dueAt } : {}),
    ...(cutoffAt ? { cutoffAt } : {}),
    ...(closesAt ? { closesAt } : {}),
    ...(acceptsSubmissions === undefined ? {} : { acceptsSubmissions }),
  };
}

export function parseStoredMoodleAssessmentStatusProjection(
  payload: unknown
): MoodleAssessmentStatusProjection {
  const row = object(payload, "assessment status projection");
  exactKeys(row, allowedAssessmentStatusKeys, "assessment status projection");
  if (!Array.isArray(row.items) || row.items.length > 500) {
    throw new MoodleProjectionSnapshotError("Invalid assessment status items.");
  }
  const items = row.items.map(parseAssessmentStatusItem);
  if (
    new Set(items.map(item => item.projectionId)).size !== items.length ||
    (row.providerState !== "available" && row.providerState !== "empty") ||
    (row.mappingStatus !== "exact" && row.mappingStatus !== "reconciliation") ||
    (row.providerState === "available" && items.length === 0) ||
    (row.providerState === "empty" && items.length !== 0)
  ) {
    throw new MoodleProjectionSnapshotError(
      "Inconsistent assessment status projection."
    );
  }
  return {
    internalCourseId: uuid(row.internalCourseId, "internal course ID"),
    internalClassGroupId: uuid(
      row.internalClassGroupId,
      "internal class group ID"
    ),
    providerState: row.providerState,
    mappingStatus: row.mappingStatus,
    items,
  };
}

function parseAssignmentResultLearner(
  value: unknown
): MoodleAssignmentResultLearnerProjection {
  const row = object(value, "assignment result learner projection");
  exactKeys(
    row,
    allowedAssignmentResultLearnerKeys,
    "assignment result learner projection"
  );
  const submissionState = text(row.submissionState, "submission state", 16);
  const gradingState = text(row.gradingState, "grading state", 16);
  if (
    !["not_submitted", "draft", "submitted", "reopened"].includes(
      submissionState
    ) ||
    !["not_graded", "graded", "released"].includes(gradingState) ||
    typeof row.latest !== "boolean"
  ) {
    throw new MoodleProjectionSnapshotError(
      "Invalid assignment result learner state."
    );
  }
  const hasScore = row.score !== undefined;
  const hasMaximumScore = row.maximumScore !== undefined;
  if (hasScore !== hasMaximumScore) {
    throw new MoodleProjectionSnapshotError(
      "Incomplete assignment result score."
    );
  }
  const score = hasScore
    ? finiteNonnegativeNumber(row.score, "assignment score")
    : undefined;
  const maximumScore = hasMaximumScore
    ? finiteNonnegativeNumber(row.maximumScore, "assignment maximum score")
    : undefined;
  if (
    score !== undefined &&
    maximumScore !== undefined &&
    (maximumScore <= 0 || score > maximumScore || gradingState === "not_graded")
  ) {
    throw new MoodleProjectionSnapshotError("Invalid assignment score.");
  }
  const submittedAt = optionalIso(
    row.submittedAt,
    "assignment submission timestamp"
  );
  const modifiedAt = optionalIso(
    row.modifiedAt,
    "assignment modification timestamp"
  );
  const gradedAt = optionalIso(row.gradedAt, "assignment grading timestamp");
  const attemptNumber = count(row.attemptNumber, "assignment attempt number");
  if (
    attemptNumber > 20 ||
    (submissionState === "not_submitted" &&
      (attemptNumber !== 0 ||
        gradingState !== "not_graded" ||
        submittedAt !== undefined ||
        score !== undefined ||
        gradedAt !== undefined)) ||
    (submissionState !== "not_submitted" && attemptNumber < 1) ||
    (gradedAt !== undefined && gradingState === "not_graded")
  ) {
    throw new MoodleProjectionSnapshotError(
      "Invalid assignment result learner state."
    );
  }
  return {
    internalUserId: uuid(row.internalUserId, "internal user ID"),
    internalEnrollmentId: uuid(
      row.internalEnrollmentId,
      "internal enrollment ID"
    ),
    internalMembershipId: uuid(
      row.internalMembershipId,
      "internal membership ID"
    ),
    submissionState:
      submissionState as MoodleAssignmentResultLearnerProjection["submissionState"],
    attemptNumber,
    gradingState:
      gradingState as MoodleAssignmentResultLearnerProjection["gradingState"],
    latest: row.latest,
    ...(submittedAt ? { submittedAt } : {}),
    ...(modifiedAt ? { modifiedAt } : {}),
    ...(score === undefined ? {} : { score, maximumScore }),
    ...(gradedAt ? { gradedAt } : {}),
  };
}

export function parseStoredMoodleAssignmentResultProjection(
  audience: MoodleAssignmentResultAudience,
  payload: unknown
): MoodleAssignmentResultProjection {
  const row = object(payload, "assignment result projection");
  const mappingStatus = enrollmentGroupMappingStatus(row.mappingStatus);
  if (mappingStatus !== "exact") {
    throw new MoodleProjectionSnapshotError(
      "Invalid assignment result mapping status."
    );
  }
  const base = {
    internalCourseId: uuid(row.internalCourseId, "internal course ID"),
    internalClassGroupId: uuid(
      row.internalClassGroupId,
      "internal class group ID"
    ),
    assignmentProjectionId: uuid(
      row.assignmentProjectionId,
      "assignment projection ID"
    ),
    providerState: enrollmentGroupProviderState(row.providerState),
    mappingStatus,
  };

  if (audience !== "aggregate") {
    exactKeys(
      row,
      allowedAssignmentResultPersonKeys,
      "person-level assignment result projection"
    );
    if (!Array.isArray(row.learners) || row.learners.length > 500) {
      throw new MoodleProjectionSnapshotError(
        "Invalid assignment result learners."
      );
    }
    const learners = row.learners.map(parseAssignmentResultLearner);
    if (audience === "learner" && learners.length !== 1) {
      throw new MoodleProjectionSnapshotError(
        "Invalid learner assignment result."
      );
    }
    if (
      new Set(learners.map(learner => learner.internalUserId)).size !==
        learners.length ||
      new Set(learners.map(learner => learner.internalEnrollmentId)).size !==
        learners.length ||
      new Set(learners.map(learner => learner.internalMembershipId)).size !==
        learners.length
    ) {
      throw new MoodleProjectionSnapshotError(
        "Duplicate assignment result learner."
      );
    }
    return { ...base, learners };
  }

  exactKeys(
    row,
    allowedAssignmentResultAggregateKeys,
    "aggregate assignment result projection"
  );
  const learnerCount = count(row.learnerCount, "assignment learner count");
  const submittedCount = count(
    row.submittedCount,
    "assignment submitted count"
  );
  const gradedCount = count(row.gradedCount, "assignment graded count");
  if (submittedCount > learnerCount || gradedCount > submittedCount) {
    throw new MoodleProjectionSnapshotError(
      "Inconsistent assignment result counts."
    );
  }
  return { ...base, learnerCount, submittedCount, gradedCount };
}

function parseQuizAttemptLearner(
  value: unknown
): MoodleQuizAttemptLearnerProjection {
  const row = object(value, "quiz attempt learner projection");
  exactKeys(
    row,
    allowedQuizAttemptLearnerKeys,
    "quiz attempt learner projection"
  );
  const attemptState = text(row.attemptState, "quiz attempt state", 16);
  const gradingState = text(row.gradingState, "quiz grading state", 16);
  if (
    !["not_started", "in_progress", "finished", "abandoned"].includes(
      attemptState
    ) ||
    !["not_graded", "graded", "released"].includes(gradingState) ||
    typeof row.latest !== "boolean" ||
    row.preview !== false
  ) {
    throw new MoodleProjectionSnapshotError(
      "Invalid quiz attempt learner state."
    );
  }
  const attemptNumber = count(row.attemptNumber, "quiz attempt number");
  const attemptProjectionId =
    row.attemptProjectionId === undefined
      ? undefined
      : uuid(row.attemptProjectionId, "quiz attempt projection ID");
  const startedAt = optionalIso(row.startedAt, "quiz attempt start timestamp");
  const finishedAt = optionalIso(
    row.finishedAt,
    "quiz attempt finish timestamp"
  );
  const modifiedAt = optionalIso(
    row.modifiedAt,
    "quiz attempt modification timestamp"
  );
  const hasScore = row.score !== undefined;
  const hasMaximumScore = row.maximumScore !== undefined;
  if (hasScore !== hasMaximumScore) {
    throw new MoodleProjectionSnapshotError("Incomplete quiz attempt score.");
  }
  const score = hasScore
    ? finiteNonnegativeNumber(row.score, "quiz attempt score")
    : undefined;
  const maximumScore = hasMaximumScore
    ? finiteNonnegativeNumber(row.maximumScore, "quiz maximum score")
    : undefined;
  if (
    attemptNumber > 20 ||
    (attemptState === "not_started" &&
      (attemptNumber !== 0 ||
        gradingState !== "not_graded" ||
        attemptProjectionId !== undefined ||
        startedAt !== undefined ||
        finishedAt !== undefined ||
        modifiedAt !== undefined ||
        score !== undefined)) ||
    (attemptState !== "not_started" &&
      (attemptNumber < 1 ||
        attemptProjectionId === undefined ||
        startedAt === undefined)) ||
    (attemptState === "finished" && finishedAt === undefined) ||
    (attemptState === "in_progress" &&
      (finishedAt !== undefined ||
        gradingState !== "not_graded" ||
        score !== undefined)) ||
    (score !== undefined &&
      maximumScore !== undefined &&
      (maximumScore <= 0 ||
        score > maximumScore ||
        gradingState === "not_graded" ||
        attemptState !== "finished")) ||
    (gradingState !== "not_graded" && score === undefined)
  ) {
    throw new MoodleProjectionSnapshotError(
      "Invalid quiz attempt learner state."
    );
  }
  return {
    internalUserId: uuid(row.internalUserId, "internal user ID"),
    internalEnrollmentId: uuid(
      row.internalEnrollmentId,
      "internal enrollment ID"
    ),
    internalMembershipId: uuid(
      row.internalMembershipId,
      "internal membership ID"
    ),
    ...(attemptProjectionId ? { attemptProjectionId } : {}),
    attemptState:
      attemptState as MoodleQuizAttemptLearnerProjection["attemptState"],
    attemptNumber,
    gradingState:
      gradingState as MoodleQuizAttemptLearnerProjection["gradingState"],
    latest: row.latest,
    preview: false,
    ...(startedAt ? { startedAt } : {}),
    ...(finishedAt ? { finishedAt } : {}),
    ...(modifiedAt ? { modifiedAt } : {}),
    ...(score === undefined ? {} : { score, maximumScore }),
  };
}

export function parseStoredMoodleQuizAttemptProjection(
  audience: MoodleQuizAttemptAudience,
  payload: unknown
): MoodleQuizAttemptProjection {
  const row = object(payload, "quiz attempt projection");
  const mappingStatus = enrollmentGroupMappingStatus(row.mappingStatus);
  if (mappingStatus !== "exact") {
    throw new MoodleProjectionSnapshotError(
      "Invalid quiz attempt mapping status."
    );
  }
  const base = {
    internalCourseId: uuid(row.internalCourseId, "internal course ID"),
    internalClassGroupId: uuid(
      row.internalClassGroupId,
      "internal class group ID"
    ),
    quizProjectionId: uuid(row.quizProjectionId, "quiz projection ID"),
    providerState: enrollmentGroupProviderState(row.providerState),
    mappingStatus,
  };
  if (audience !== "aggregate") {
    exactKeys(
      row,
      allowedQuizAttemptPersonKeys,
      "person-level quiz attempt projection"
    );
    if (!Array.isArray(row.learners) || row.learners.length > 500) {
      throw new MoodleProjectionSnapshotError("Invalid quiz attempt learners.");
    }
    const learners = row.learners.map(parseQuizAttemptLearner);
    if (audience === "learner" && learners.length !== 1) {
      throw new MoodleProjectionSnapshotError("Invalid learner quiz attempt.");
    }
    if (
      new Set(learners.map(item => item.internalUserId)).size !==
        learners.length ||
      new Set(learners.map(item => item.internalEnrollmentId)).size !==
        learners.length ||
      new Set(learners.map(item => item.internalMembershipId)).size !==
        learners.length ||
      new Set(
        learners
          .map(item => item.attemptProjectionId)
          .filter((id): id is string => Boolean(id))
      ).size !== learners.filter(item => item.attemptProjectionId).length
    ) {
      throw new MoodleProjectionSnapshotError(
        "Duplicate quiz attempt learner."
      );
    }
    return { ...base, learners };
  }
  exactKeys(
    row,
    allowedQuizAttemptAggregateKeys,
    "aggregate quiz attempt projection"
  );
  const learnerCount = count(row.learnerCount, "quiz learner count");
  const attemptedCount = count(row.attemptedCount, "quiz attempted count");
  const finishedCount = count(row.finishedCount, "quiz finished count");
  const gradedCount = count(row.gradedCount, "quiz graded count");
  if (
    attemptedCount > learnerCount ||
    finishedCount > attemptedCount ||
    gradedCount > finishedCount
  ) {
    throw new MoodleProjectionSnapshotError(
      "Inconsistent quiz attempt counts."
    );
  }
  return {
    ...base,
    learnerCount,
    attemptedCount,
    finishedCount,
    gradedCount,
  };
}

function parseGradeOutcomeLearner(
  value: unknown,
  audience: Exclude<MoodleGradeOutcomeAudience, "aggregate">
): MoodleGradeOutcomeLearnerProjection {
  const row = object(value, "grade outcome learner projection");
  exactKeys(
    row,
    allowedGradeOutcomeLearnerKeys,
    "grade outcome learner projection"
  );
  const gradingState = text(row.gradingState, "grade outcome state", 16);
  if (!["not_graded", "graded", "released"].includes(gradingState)) {
    throw new MoodleProjectionSnapshotError("Invalid grade outcome state.");
  }
  const hasScore = row.score !== undefined;
  const hasMaximumScore = row.maximumScore !== undefined;
  if (hasScore !== hasMaximumScore) {
    throw new MoodleProjectionSnapshotError("Incomplete grade outcome score.");
  }
  const score = hasScore
    ? finiteNonnegativeNumber(row.score, "grade outcome score")
    : undefined;
  const maximumScore = hasMaximumScore
    ? finiteNonnegativeNumber(row.maximumScore, "grade outcome maximum score")
    : undefined;
  const gradedAt = optionalIso(row.gradedAt, "grade outcome timestamp");
  const releasedAt = optionalIso(row.releasedAt, "grade release timestamp");
  const feedback = optionalText(row.feedback, "released grade feedback", 2000);
  if (
    (gradingState === "not_graded" &&
      (score !== undefined ||
        gradedAt !== undefined ||
        releasedAt !== undefined ||
        feedback !== undefined)) ||
    (gradingState !== "not_graded" &&
      (score === undefined ||
        maximumScore === undefined ||
        maximumScore <= 0 ||
        score > maximumScore ||
        gradedAt === undefined)) ||
    (gradingState === "graded" &&
      (releasedAt !== undefined || feedback !== undefined)) ||
    (gradingState === "released" && releasedAt === undefined) ||
    (audience === "learner" && gradingState === "graded")
  ) {
    throw new MoodleProjectionSnapshotError("Invalid grade outcome state.");
  }
  return {
    internalUserId: uuid(row.internalUserId, "internal user ID"),
    internalEnrollmentId: uuid(
      row.internalEnrollmentId,
      "internal enrollment ID"
    ),
    internalMembershipId: uuid(
      row.internalMembershipId,
      "internal membership ID"
    ),
    gradingState:
      gradingState as MoodleGradeOutcomeLearnerProjection["gradingState"],
    ...(score === undefined ? {} : { score, maximumScore }),
    ...(gradedAt ? { gradedAt } : {}),
    ...(releasedAt ? { releasedAt } : {}),
    ...(feedback ? { feedback } : {}),
  };
}

export function parseStoredMoodleGradeOutcomeProjection(
  audience: MoodleGradeOutcomeAudience,
  payload: unknown
): MoodleGradeOutcomeProjection {
  const row = object(payload, "grade outcome projection");
  const mappingStatus = enrollmentGroupMappingStatus(row.mappingStatus);
  if (mappingStatus !== "exact") {
    throw new MoodleProjectionSnapshotError(
      "Invalid grade outcome mapping status."
    );
  }
  const base = {
    internalCourseId: uuid(row.internalCourseId, "internal course ID"),
    internalClassGroupId: uuid(
      row.internalClassGroupId,
      "internal class group ID"
    ),
    gradeItemProjectionId: uuid(
      row.gradeItemProjectionId,
      "grade item projection ID"
    ),
    providerState: enrollmentGroupProviderState(row.providerState),
    mappingStatus,
  };
  if (audience !== "aggregate") {
    exactKeys(
      row,
      allowedGradeOutcomePersonKeys,
      "person-level grade outcome projection"
    );
    if (!Array.isArray(row.learners) || row.learners.length > 500) {
      throw new MoodleProjectionSnapshotError(
        "Invalid grade outcome learners."
      );
    }
    const learners = row.learners.map(item =>
      parseGradeOutcomeLearner(item, audience)
    );
    if (audience === "learner" && learners.length !== 1) {
      throw new MoodleProjectionSnapshotError("Invalid learner grade outcome.");
    }
    if (
      new Set(learners.map(item => item.internalUserId)).size !==
        learners.length ||
      new Set(learners.map(item => item.internalEnrollmentId)).size !==
        learners.length ||
      new Set(learners.map(item => item.internalMembershipId)).size !==
        learners.length
    ) {
      throw new MoodleProjectionSnapshotError(
        "Duplicate grade outcome learner."
      );
    }
    return { ...base, learners };
  }
  exactKeys(
    row,
    allowedGradeOutcomeAggregateKeys,
    "aggregate grade outcome projection"
  );
  const learnerCount = count(row.learnerCount, "grade learner count");
  const gradedCount = count(row.gradedCount, "graded learner count");
  const releasedCount = count(row.releasedCount, "released grade count");
  const feedbackReleasedCount = count(
    row.feedbackReleasedCount,
    "released feedback count"
  );
  if (
    gradedCount > learnerCount ||
    releasedCount > gradedCount ||
    feedbackReleasedCount > releasedCount
  ) {
    throw new MoodleProjectionSnapshotError(
      "Inconsistent grade outcome counts."
    );
  }
  return {
    ...base,
    learnerCount,
    gradedCount,
    releasedCount,
    feedbackReleasedCount,
  };
}

function parseActivityOutcomeLearner(
  value: unknown
): MoodleActivityOutcomeLearnerProjection {
  const row = object(value, "activity outcome learner projection");
  exactKeys(
    row,
    allowedActivityOutcomeLearnerKeys,
    "activity outcome learner projection"
  );
  const completionState = text(
    row.completionState,
    "activity completion state",
    16
  );
  const scoreState = text(row.scoreState, "activity score state", 16);
  if (
    !["not_started", "in_progress", "completed", "passed", "failed"].includes(
      completionState
    ) ||
    !["not_scored", "released"].includes(scoreState)
  ) {
    throw new MoodleProjectionSnapshotError("Invalid activity outcome state.");
  }
  const completedAt = optionalIso(
    row.completedAt,
    "activity completion timestamp"
  );
  const releasedAt = optionalIso(row.releasedAt, "activity score release");
  const hasScore = row.score !== undefined;
  const hasMaximumScore = row.maximumScore !== undefined;
  if (hasScore !== hasMaximumScore) {
    throw new MoodleProjectionSnapshotError(
      "Incomplete activity outcome score."
    );
  }
  const score = hasScore
    ? finiteNonnegativeNumber(row.score, "activity outcome score")
    : undefined;
  const maximumScore = hasMaximumScore
    ? finiteNonnegativeNumber(
        row.maximumScore,
        "activity outcome maximum score"
      )
    : undefined;
  if (
    (completionState === "not_started" && completedAt !== undefined) ||
    (completionState === "in_progress" && completedAt !== undefined) ||
    (scoreState === "not_scored" &&
      (score !== undefined || releasedAt !== undefined)) ||
    (scoreState === "released" &&
      (score === undefined ||
        maximumScore === undefined ||
        maximumScore <= 0 ||
        score > maximumScore ||
        releasedAt === undefined))
  ) {
    throw new MoodleProjectionSnapshotError("Invalid activity outcome state.");
  }
  return {
    internalUserId: uuid(row.internalUserId, "internal user ID"),
    internalEnrollmentId: uuid(
      row.internalEnrollmentId,
      "internal enrollment ID"
    ),
    internalMembershipId: uuid(
      row.internalMembershipId,
      "internal membership ID"
    ),
    completionState:
      completionState as MoodleActivityOutcomeLearnerProjection["completionState"],
    scoreState:
      scoreState as MoodleActivityOutcomeLearnerProjection["scoreState"],
    ...(completedAt ? { completedAt } : {}),
    ...(score === undefined ? {} : { score, maximumScore }),
    ...(releasedAt ? { releasedAt } : {}),
  };
}

export function parseStoredMoodleActivityOutcomeProjection(
  audience: MoodleActivityOutcomeAudience,
  payload: unknown
): MoodleActivityOutcomeProjection {
  const row = object(payload, "activity outcome projection");
  const mappingStatus = enrollmentGroupMappingStatus(row.mappingStatus);
  if (mappingStatus !== "exact") {
    throw new MoodleProjectionSnapshotError(
      "Invalid activity outcome mapping status."
    );
  }
  const activityKind = text(row.activityKind, "activity outcome kind", 16);
  if (!["lesson", "h5p", "scorm"].includes(activityKind)) {
    throw new MoodleProjectionSnapshotError("Invalid activity outcome kind.");
  }
  const base = {
    internalCourseId: uuid(row.internalCourseId, "internal course ID"),
    internalClassGroupId: uuid(
      row.internalClassGroupId,
      "internal class group ID"
    ),
    activityProjectionId: uuid(
      row.activityProjectionId,
      "activity projection ID"
    ),
    activityKind: activityKind as MoodleActivityOutcomeKind,
    providerState: enrollmentGroupProviderState(row.providerState),
    mappingStatus,
  };
  if (audience !== "aggregate") {
    exactKeys(
      row,
      allowedActivityOutcomePersonKeys,
      "person-level activity outcome projection"
    );
    if (!Array.isArray(row.learners) || row.learners.length > 500) {
      throw new MoodleProjectionSnapshotError(
        "Invalid activity outcome learners."
      );
    }
    const learners = row.learners.map(parseActivityOutcomeLearner);
    if (audience === "learner" && learners.length !== 1) {
      throw new MoodleProjectionSnapshotError(
        "Invalid learner activity outcome."
      );
    }
    if (
      new Set(learners.map(item => item.internalUserId)).size !==
        learners.length ||
      new Set(learners.map(item => item.internalEnrollmentId)).size !==
        learners.length ||
      new Set(learners.map(item => item.internalMembershipId)).size !==
        learners.length
    ) {
      throw new MoodleProjectionSnapshotError(
        "Duplicate activity outcome learner."
      );
    }
    return { ...base, learners };
  }
  exactKeys(
    row,
    allowedActivityOutcomeAggregateKeys,
    "aggregate activity outcome projection"
  );
  const learnerCount = count(row.learnerCount, "activity learner count");
  const startedCount = count(row.startedCount, "activity started count");
  const completedCount = count(row.completedCount, "activity completed count");
  const passedCount = count(row.passedCount, "activity passed count");
  const failedCount = count(row.failedCount, "activity failed count");
  const scoredCount = count(row.scoredCount, "activity scored count");
  if (
    startedCount > learnerCount ||
    completedCount > startedCount ||
    passedCount + failedCount > completedCount ||
    scoredCount > learnerCount
  ) {
    throw new MoodleProjectionSnapshotError(
      "Inconsistent activity outcome counts."
    );
  }
  return {
    ...base,
    learnerCount,
    startedCount,
    completedCount,
    passedCount,
    failedCount,
    scoredCount,
  };
}

function postgresJsonbText(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(postgresJsonbText).join(", ")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) =>
        left.length === right.length
          ? left < right
            ? -1
            : left > right
              ? 1
              : 0
          : left.length - right.length
      )
      .map(
        ([key, item]) => `${JSON.stringify(key)}: ${postgresJsonbText(item)}`
      )
      .join(", ")}}`;
  }
  return JSON.stringify(value);
}

export function hashMoodleProjectionPayload(value: unknown) {
  return createHash("sha256").update(postgresJsonbText(value)).digest("hex");
}

export function parseStoredMoodleProjection<T>(
  family: MoodleProjectionFamily,
  payload: unknown
) {
  if (
    !Array.isArray(payload) ||
    payload.length > MOODLE_READ_MODEL_LIMITS.collectionItems
  ) {
    throw new MoodleProjectionSnapshotError("Invalid projection payload.");
  }
  const parsers: Record<MoodleProjectionFamily, (value: unknown) => unknown> = {
    course_catalog: parseCourse,
    course_content: parseSection,
  };
  return payload.map(parsers[family]) as T;
}

export function resolveMoodleProjectionObservation<T>(input: {
  observation: MoodleProjectionObservation | null;
  now?: Date;
}): ResolvedMoodleProjection<T> {
  const { observation } = input;
  if (!observation) {
    return {
      availability: "unavailable",
      freshness: "unavailable",
      latestOutcome: "unavailable",
    };
  }
  const lastAttemptedAt = iso(
    observation.lastAttemptedAt,
    "projection attempt timestamp"
  );
  const success = observation.lastSuccess;
  if (!success) {
    return {
      availability: "unavailable",
      freshness: "unavailable",
      latestOutcome: observation.latestOutcome,
      lastAttemptedAt,
    };
  }

  const observedAt = iso(
    success.observedAt,
    "projection observation timestamp"
  );
  const freshUntil = iso(success.freshUntil, "projection freshness timestamp");
  const retainUntil = iso(
    success.retainUntil,
    "projection retention timestamp"
  );
  const observed = Date.parse(observedAt);
  const fresh = Date.parse(freshUntil);
  const retained = Date.parse(retainUntil);
  const attempted = Date.parse(lastAttemptedAt);
  if (
    observed > fresh ||
    fresh > retained ||
    attempted < observed ||
    !Number.isSafeInteger(success.itemCount) ||
    success.itemCount < 0 ||
    !/^[0-9a-f]{64}$/i.test(success.payloadHash)
  ) {
    throw new MoodleProjectionSnapshotError();
  }

  const payload = parseStoredMoodleProjection<T>(
    observation.projectionFamily,
    success.payload
  );
  if (
    !Array.isArray(payload) ||
    payload.length !== success.itemCount ||
    (observation.latestOutcome === "available" && success.itemCount === 0) ||
    (observation.latestOutcome === "empty" && success.itemCount !== 0) ||
    hashMoodleProjectionPayload(payload) !== success.payloadHash.toLowerCase()
  ) {
    throw new MoodleProjectionSnapshotError();
  }

  const now = (input.now ?? new Date()).getTime();
  if (!Number.isFinite(now) || now > retained) {
    return {
      availability: "unavailable",
      freshness: "unavailable",
      latestOutcome: observation.latestOutcome,
      lastAttemptedAt,
    };
  }
  const latestSucceeded = ["available", "empty"].includes(
    observation.latestOutcome
  );
  const availability = latestSucceeded
    ? success.itemCount > 0
      ? "available"
      : "empty"
    : "unavailable";
  const freshness = latestSucceeded && now <= fresh ? "fresh" : "stale";
  return {
    availability,
    freshness,
    latestOutcome: observation.latestOutcome,
    lastAttemptedAt,
    observation: {
      runId: success.runId,
      observedAt,
      freshUntil,
      retainUntil,
      payloadHash: success.payloadHash.toLowerCase(),
    },
    payload,
  };
}
