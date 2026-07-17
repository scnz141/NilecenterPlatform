export const MOODLE_READ_MODEL_LIMITS = Object.freeze({
  collectionItems: 2_000,
  nestedItems: 2_000,
  titleCharacters: 300,
  textCharacters: 2_000,
});

export type MoodleProjectionFunction =
  | "core_course_get_categories"
  | "core_course_get_courses_by_field"
  | "core_course_get_contents"
  | "core_course_get_course_module"
  | "core_enrol_get_enrolled_users"
  | "core_enrol_get_users_courses"
  | "core_user_get_users_by_field"
  | "core_group_get_course_groups"
  | "core_group_get_course_groupings"
  | "core_group_get_course_user_groups"
  | "core_completion_get_activities_completion_status"
  | "core_completion_get_course_completion_status"
  | "gradereport_user_get_grade_items"
  | "mod_assign_get_assignments"
  | "mod_assign_get_submissions"
  | "mod_assign_get_grades"
  | "mod_quiz_get_quizzes_by_courses"
  | "mod_quiz_get_user_attempts"
  | "mod_quiz_get_attempt_review"
  | "mod_h5pactivity_get_h5pactivities_by_courses"
  | "mod_h5pactivity_get_attempts"
  | "mod_h5pactivity_get_results"
  | "mod_scorm_get_scorms_by_courses"
  | "mod_scorm_get_scorm_sco_tracks"
  | "mod_lesson_get_lessons_by_courses"
  | "mod_lesson_get_user_grade"
  | "mod_book_get_books_by_courses"
  | "mod_page_get_pages_by_courses"
  | "mod_resource_get_resources_by_courses"
  | "mod_url_get_urls_by_courses";

export type ExternalIdentityReadModel = Readonly<{
  sourceId: string;
  displayName: string;
  active?: boolean;
  firstSeenAt?: string;
  lastSeenAt?: string;
}>;

export type ExternalCourseCategoryReadModel = Readonly<{
  sourceId: string;
  parentSourceId?: string;
  title: string;
  visible?: boolean;
  depth?: number;
}>;

export type ExternalCourseReadModel = Readonly<{
  sourceId: string;
  categorySourceId?: string;
  title: string;
  shortTitle: string;
  visible?: boolean;
  startsAt?: string;
  endsAt?: string;
  completionTrackingEnabled?: boolean;
}>;

export type ExternalActivityReadModel = Readonly<{
  sourceId: string;
  instanceSourceId: string;
  type: string;
  title: string;
  visible?: boolean;
  completionTracking?: "none" | "manual" | "automatic";
}>;

export type ExternalCourseSectionReadModel = Readonly<{
  sourceId: string;
  position: number;
  title?: string;
  visible?: boolean;
  activities: readonly ExternalActivityReadModel[];
}>;

export type ExternalCourseModuleReadModel = ExternalActivityReadModel &
  Readonly<{
    courseSourceId: string;
    sectionSourceId?: string;
    sectionPosition?: number;
  }>;

export type ExternalRoleReadModel = Readonly<{
  sourceId: string;
  title: string;
}>;

export type ExternalGroupReadModel = Readonly<{
  sourceId: string;
  courseSourceId?: string;
  title: string;
  createdAt?: string;
  modifiedAt?: string;
}>;

export type ExternalGroupingReadModel = Readonly<{
  sourceId: string;
  courseSourceId: string;
  title: string;
  createdAt?: string;
  modifiedAt?: string;
}>;

export type ExternalEnrolledUserReadModel = Readonly<{
  sourceUserId: string;
  displayName: string;
  active?: boolean;
  firstSeenAt?: string;
  lastSeenAt?: string;
  roles: readonly ExternalRoleReadModel[];
  groups: readonly ExternalGroupReadModel[];
}>;

export type ExternalUserCourseReadModel = Readonly<{
  sourceCourseId: string;
  title: string;
  shortTitle: string;
  visible?: boolean;
  progressPercent?: number;
  completed?: boolean;
  startsAt?: string;
  endsAt?: string;
  lastAccessAt?: string;
}>;

export type ExternalActivityCompletionReadModel = Readonly<{
  activitySourceId: string;
  activityType: string;
  activityInstanceSourceId: string;
  state: "not_started" | "complete" | "complete_pass" | "complete_fail";
  completedAt?: string;
}>;

export type ExternalCourseCompletionCriterionReadModel = Readonly<{
  title?: string;
  status?: string;
  completed: boolean;
  completedAt?: string;
}>;

export type ExternalCourseCompletionReadModel = Readonly<{
  completed: boolean;
  criteria: readonly ExternalCourseCompletionCriterionReadModel[];
}>;

export type ExternalGradeItemReadModel = Readonly<{
  sourceId: string;
  title?: string;
  kind?: string;
  activityType?: string;
  activitySourceId?: string;
  activityInstanceSourceId?: string;
  score?: number;
  minimumScore?: number;
  maximumScore?: number;
  locked?: boolean;
  feedbackText?: string;
}>;

export type ExternalUserGradeReadModel = Readonly<{
  sourceCourseId: string;
  sourceUserId: string;
  items: readonly ExternalGradeItemReadModel[];
}>;

export type ExternalAssignmentReadModel = Readonly<{
  sourceId: string;
  activitySourceId?: string;
  courseSourceId: string;
  title: string;
  acceptsSubmissions?: boolean;
  draftMode?: boolean;
  teamSubmission?: boolean;
  completionRequiresSubmission?: boolean;
  maximumScore?: number;
  opensAt?: string;
  dueAt?: string;
  cutoffAt?: string;
  gradingDueAt?: string;
  modifiedAt?: string;
}>;

export type ExternalAssignmentCourseReadModel = Readonly<{
  sourceCourseId: string;
  title?: string;
  shortTitle?: string;
  assignments: readonly ExternalAssignmentReadModel[];
}>;

export type ExternalAssignmentSubmissionReadModel = Readonly<{
  sourceId: string;
  sourceUserId: string;
  attempt: number;
  status: string;
  groupSourceId?: string;
  createdAt?: string;
  modifiedAt?: string;
  latest?: boolean;
  gradingStatus?: string;
}>;

export type ExternalAssignmentSubmissionsReadModel = Readonly<{
  assignmentSourceId: string;
  submissions: readonly ExternalAssignmentSubmissionReadModel[];
}>;

export type ExternalAssignmentGradeReadModel = Readonly<{
  sourceId: string;
  sourceUserId: string;
  attempt: number;
  score?: number;
  createdAt?: string;
  modifiedAt?: string;
}>;

export type ExternalAssignmentGradesReadModel = Readonly<{
  assignmentSourceId: string;
  grades: readonly ExternalAssignmentGradeReadModel[];
}>;

export type ExternalQuizReadModel = Readonly<{
  sourceId: string;
  activitySourceId?: string;
  courseSourceId: string;
  title: string;
  opensAt?: string;
  closesAt?: string;
  timeLimitSeconds?: number;
  attemptLimit?: number;
  maximumScore?: number;
  totalMarks?: number;
  hasQuestions?: boolean;
  completionRequiresPassing?: boolean;
  completionRequiresAttemptsExhausted?: boolean;
  modifiedAt?: string;
}>;

export type ExternalQuizAttemptReadModel = Readonly<{
  sourceId: string;
  quizSourceId: string;
  sourceUserId: string;
  attempt: number;
  state: string;
  preview?: boolean;
  score?: number;
  startedAt?: string;
  finishedAt?: string;
  modifiedAt?: string;
}>;

export type ExternalQuizReviewQuestionReadModel = Readonly<{
  slot: number;
  type: string;
  page: number;
  state?: string;
  status?: string;
  mark?: number;
  maximumMark?: number;
  blocked?: boolean;
}>;

export type ExternalQuizReviewReadModel = Readonly<{
  attempt?: ExternalQuizAttemptReadModel;
  gradeSummary?: string;
  questions: readonly ExternalQuizReviewQuestionReadModel[];
}>;

export type ExternalH5PActivityReadModel = Readonly<{
  sourceId: string;
  activitySourceId: string;
  courseSourceId: string;
  title: string;
  maximumScore?: number;
  trackingEnabled?: boolean;
  createdAt?: string;
  modifiedAt?: string;
}>;

export type ExternalH5PAttemptReadModel = Readonly<{
  sourceId: string;
  activityInstanceSourceId: string;
  sourceUserId: string;
  attempt: number;
  score: number;
  maximumScore: number;
  scaledScore: number;
  durationSeconds: number;
  completed?: boolean;
  successful?: boolean;
  createdAt?: string;
  modifiedAt?: string;
}>;

export type ExternalH5PUserAttemptsReadModel = Readonly<{
  sourceUserId: string;
  attempts: readonly ExternalH5PAttemptReadModel[];
}>;

export type ExternalH5PAttemptsReadModel = Readonly<{
  activitySourceId: string;
  users: readonly ExternalH5PUserAttemptsReadModel[];
}>;

export type ExternalH5PResultReadModel = Readonly<{
  sourceId: string;
  attemptSourceId: string;
  interactionType: string;
  score: number;
  maximumScore: number;
  durationSeconds?: number;
  completed?: boolean;
  successful?: boolean;
  createdAt?: string;
}>;

export type ExternalH5PAttemptResultsReadModel = ExternalH5PAttemptReadModel &
  Readonly<{
    results: readonly ExternalH5PResultReadModel[];
  }>;

export type ExternalH5PResultsReadModel = Readonly<{
  activitySourceId: string;
  attempts: readonly ExternalH5PAttemptResultsReadModel[];
}>;

export type ExternalScormActivityReadModel = Readonly<{
  sourceId: string;
  activitySourceId: string;
  courseSourceId: string;
  title: string;
  visible?: boolean;
  version?: string;
  maximumScore?: number;
  maximumAttempts?: number;
  opensAt?: string;
  closesAt?: string;
  revision?: number;
  modifiedAt?: string;
}>;

export type ExternalScormTracksReadModel = Readonly<{
  attempt: number;
  status?: string;
  completionStatus?: string;
  successStatus?: string;
  score?: number;
  minimumScore?: number;
  maximumScore?: number;
  totalTime?: string;
}>;

export const MOODLE_SCORM_PROGRESS_ELEMENTS = [
  "cmi.core.lesson_status",
  "cmi.completion_status",
  "cmi.success_status",
  "cmi.core.score.raw",
  "cmi.score.raw",
  "cmi.core.score.min",
  "cmi.score.min",
  "cmi.core.score.max",
  "cmi.score.max",
  "cmi.core.total_time",
  "cmi.total_time",
] as const;

export type MoodleScormProgressElement =
  (typeof MOODLE_SCORM_PROGRESS_ELEMENTS)[number];

const moodleScormProgressElementSet = new Set<string>(
  MOODLE_SCORM_PROGRESS_ELEMENTS
);

export function normalizeMoodleScormProgressElement(
  value: string
): MoodleScormProgressElement | null {
  const normalized = value.trim().toLowerCase();
  return moodleScormProgressElementSet.has(normalized)
    ? (normalized as MoodleScormProgressElement)
    : null;
}

export type ExternalLessonReadModel = Readonly<{
  sourceId: string;
  activitySourceId?: string;
  courseSourceId: string;
  title: string;
  practice?: boolean;
  retakesAllowed?: boolean;
  maximumScore?: number;
  opensAt?: string;
  closesAt?: string;
  timeLimitSeconds?: number;
  completionRequiresEnd?: boolean;
  completionTimeSeconds?: number;
  modifiedAt?: string;
}>;

export type ExternalLessonGradeReadModel = Readonly<{
  lessonSourceId?: string;
  sourceUserId?: string;
  score?: number;
}>;

export type ExternalContentActivityReadModel = Readonly<{
  kind: "book" | "page" | "resource" | "url";
  sourceId: string;
  activitySourceId?: string;
  courseSourceId: string;
  title: string;
  visible?: boolean;
  revision?: number;
  createdAt?: string;
  modifiedAt?: string;
}>;

export type MoodleReadModelResponseMap = {
  core_course_get_categories: readonly ExternalCourseCategoryReadModel[];
  core_course_get_courses_by_field: readonly ExternalCourseReadModel[];
  core_course_get_contents: readonly ExternalCourseSectionReadModel[];
  core_course_get_course_module: ExternalCourseModuleReadModel;
  core_enrol_get_enrolled_users: readonly ExternalEnrolledUserReadModel[];
  core_enrol_get_users_courses: readonly ExternalUserCourseReadModel[];
  core_user_get_users_by_field: readonly ExternalIdentityReadModel[];
  core_group_get_course_groups: readonly ExternalGroupReadModel[];
  core_group_get_course_groupings: readonly ExternalGroupingReadModel[];
  core_group_get_course_user_groups: readonly ExternalGroupReadModel[];
  core_completion_get_activities_completion_status: readonly ExternalActivityCompletionReadModel[];
  core_completion_get_course_completion_status: ExternalCourseCompletionReadModel;
  gradereport_user_get_grade_items: readonly ExternalUserGradeReadModel[];
  mod_assign_get_assignments: readonly ExternalAssignmentCourseReadModel[];
  mod_assign_get_submissions: readonly ExternalAssignmentSubmissionsReadModel[];
  mod_assign_get_grades: readonly ExternalAssignmentGradesReadModel[];
  mod_quiz_get_quizzes_by_courses: readonly ExternalQuizReadModel[];
  mod_quiz_get_user_attempts: readonly ExternalQuizAttemptReadModel[];
  mod_quiz_get_attempt_review: ExternalQuizReviewReadModel;
  mod_h5pactivity_get_h5pactivities_by_courses: readonly ExternalH5PActivityReadModel[];
  mod_h5pactivity_get_attempts: ExternalH5PAttemptsReadModel;
  mod_h5pactivity_get_results: ExternalH5PResultsReadModel;
  mod_scorm_get_scorms_by_courses: readonly ExternalScormActivityReadModel[];
  mod_scorm_get_scorm_sco_tracks: ExternalScormTracksReadModel;
  mod_lesson_get_lessons_by_courses: readonly ExternalLessonReadModel[];
  mod_lesson_get_user_grade: ExternalLessonGradeReadModel;
  mod_book_get_books_by_courses: readonly ExternalContentActivityReadModel[];
  mod_page_get_pages_by_courses: readonly ExternalContentActivityReadModel[];
  mod_resource_get_resources_by_courses: readonly ExternalContentActivityReadModel[];
  mod_url_get_urls_by_courses: readonly ExternalContentActivityReadModel[];
};

type UnknownRecord = Record<string, unknown>;

export class MoodleReadModelError extends Error {
  readonly code = "invalid_response" as const;

  constructor(label: string) {
    super(`Moodle returned an invalid ${label} read response.`);
    this.name = "MoodleReadModelError";
  }
}

function invalid(label: string): never {
  throw new MoodleReadModelError(label);
}

function record(value: unknown, label: string): UnknownRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return invalid(label);
  }
  return value as UnknownRecord;
}

function boundedArray(
  value: unknown,
  label: string,
  limit = MOODLE_READ_MODEL_LIMITS.collectionItems
) {
  if (!Array.isArray(value) || value.length > limit) return invalid(label);
  return value;
}

function arrayField(
  value: UnknownRecord,
  key: string,
  label: string,
  limit = MOODLE_READ_MODEL_LIMITS.collectionItems
) {
  if (!Object.hasOwn(value, key)) return invalid(label);
  return boundedArray(value[key], label, limit);
}

function optionalArrayField(
  value: UnknownRecord,
  key: string,
  label: string,
  limit = MOODLE_READ_MODEL_LIMITS.nestedItems
) {
  if (!Object.hasOwn(value, key)) return [];
  return boundedArray(value[key], label, limit);
}

const htmlEntityPattern = /&(?:#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi;
const unsafeHtmlBlockPattern =
  /<(script|style|iframe|object|embed|svg|math)\b[^>]*>[\s\S]*?<\/\1\s*>/gi;
const htmlTagPattern = /<[^>]*>/g;
const emailPattern = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const urlPattern = /\b(?:(?:https?|ftp):\/\/|www\.|mailto:)[^\s<>()]+/gi;
const phonePattern = /(^|[^\w])(?:\+?\d[\d\s().-]{7,}\d)(?=$|[^\w])/g;

function decodeHtmlEntity(value: string) {
  const lower = value.toLowerCase();
  const named: Record<string, string> = {
    "&amp;": "&",
    "&lt;": "<",
    "&gt;": ">",
    "&quot;": '"',
    "&apos;": "'",
    "&nbsp;": " ",
  };
  if (named[lower]) return named[lower];
  const numeric = lower.startsWith("&#x")
    ? Number.parseInt(lower.slice(3, -1), 16)
    : Number.parseInt(lower.slice(2, -1), 10);
  return Number.isSafeInteger(numeric) && numeric > 0 && numeric <= 0x10ffff
    ? String.fromCodePoint(numeric)
    : "";
}

export function sanitizeMoodleProjectionText(
  value: string,
  label: string,
  maxCharacters: number
) {
  const maxRawCharacters = maxCharacters * 8;
  if (value.length > maxRawCharacters) return invalid(label);
  const sanitized = value
    .replace(htmlEntityPattern, decodeHtmlEntity)
    .replace(unsafeHtmlBlockPattern, " ")
    .replace(htmlTagPattern, " ")
    .replace(urlPattern, " ")
    .replace(emailPattern, " ")
    .replace(phonePattern, "$1")
    .replace(/[<>]/g, " ")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (sanitized.length > maxCharacters) return invalid(label);
  return sanitized;
}

function requiredText(
  value: UnknownRecord,
  key: string,
  label: string,
  maxCharacters: number = MOODLE_READ_MODEL_LIMITS.titleCharacters
) {
  if (typeof value[key] !== "string") return invalid(label);
  const result = sanitizeMoodleProjectionText(value[key], label, maxCharacters);
  return result || invalid(label);
}

function optionalText(
  value: UnknownRecord,
  key: string,
  label: string,
  maxCharacters: number = MOODLE_READ_MODEL_LIMITS.titleCharacters
) {
  const candidate = value[key];
  if (candidate === undefined || candidate === null || candidate === "") {
    return undefined;
  }
  if (typeof candidate !== "string") return invalid(label);
  return (
    sanitizeMoodleProjectionText(candidate, label, maxCharacters) || undefined
  );
}

function optionalTextOrNumber(
  value: UnknownRecord,
  key: string,
  label: string,
  maxCharacters: number = MOODLE_READ_MODEL_LIMITS.titleCharacters
) {
  const candidate = value[key];
  if (candidate === undefined || candidate === null || candidate === "") {
    return undefined;
  }
  if (typeof candidate === "number") {
    if (!Number.isFinite(candidate)) return invalid(label);
    return String(candidate);
  }
  return optionalText(value, key, label, maxCharacters);
}

function displayName(value: UnknownRecord, label: string) {
  const fullName = optionalText(value, "fullname", label);
  if (fullName) return fullName;
  const firstName = optionalText(value, "firstname", label);
  const lastName = optionalText(value, "lastname", label);
  const combined = [firstName, lastName].filter(Boolean).join(" ").trim();
  return combined || invalid(label);
}

function integer(
  value: UnknownRecord,
  key: string,
  label: string,
  minimum = 0
) {
  const candidate = value[key];
  if (!Number.isSafeInteger(candidate) || Number(candidate) < minimum) {
    return invalid(label);
  }
  return Number(candidate);
}

function optionalInteger(
  value: UnknownRecord,
  key: string,
  label: string,
  minimum = 0
) {
  const candidate = value[key];
  if (candidate === undefined || candidate === null) return undefined;
  if (!Number.isSafeInteger(candidate) || Number(candidate) < minimum) {
    return invalid(label);
  }
  return Number(candidate);
}

function sourceId(value: UnknownRecord, key: string, label: string) {
  return String(integer(value, key, label, 1));
}

function optionalSourceId(value: UnknownRecord, key: string, label: string) {
  const candidate = value[key];
  if (candidate === undefined || candidate === null || candidate === 0) {
    return undefined;
  }
  return String(integer(value, key, label, 1));
}

function optionalBoolean(value: UnknownRecord, key: string, label: string) {
  const candidate = value[key];
  if (candidate === undefined || candidate === null) return undefined;
  if (typeof candidate === "boolean") return candidate;
  if (candidate === 0 || candidate === 1) return candidate === 1;
  return invalid(label);
}

function requiredBoolean(value: UnknownRecord, key: string, label: string) {
  const result = optionalBoolean(value, key, label);
  return result === undefined ? invalid(label) : result;
}

const numericTextPattern = /^-?\d+(?:\.\d+)?$/;

function optionalNumber(value: UnknownRecord, key: string, label: string) {
  const candidate = value[key];
  if (candidate === undefined || candidate === null || candidate === "") {
    return undefined;
  }
  const parsed =
    typeof candidate === "number"
      ? candidate
      : typeof candidate === "string" && numericTextPattern.test(candidate)
        ? Number(candidate)
        : Number.NaN;
  return Number.isFinite(parsed) ? parsed : invalid(label);
}

function requiredNumber(value: UnknownRecord, key: string, label: string) {
  const result = optionalNumber(value, key, label);
  return result === undefined ? invalid(label) : result;
}

function optionalTimestamp(value: UnknownRecord, key: string, label: string) {
  const seconds = optionalInteger(value, key, label, 0);
  if (seconds === undefined || seconds === 0) return undefined;
  const milliseconds = seconds * 1_000;
  const date = new Date(milliseconds);
  return Number.isFinite(milliseconds) && !Number.isNaN(date.valueOf())
    ? date.toISOString()
    : invalid(label);
}

function optionalCompletionTracking(
  value: UnknownRecord,
  key: string,
  label: string
) {
  const tracking = optionalInteger(value, key, label, 0);
  if (tracking === undefined) return undefined;
  if (tracking === 0) return "none" as const;
  if (tracking === 1) return "manual" as const;
  if (tracking === 2) return "automatic" as const;
  return invalid(label);
}

function completionState(value: UnknownRecord, key: string, label: string) {
  const state = integer(value, key, label, 0);
  if (state === 0) return "not_started" as const;
  if (state === 1) return "complete" as const;
  if (state === 2) return "complete_pass" as const;
  if (state === 3) return "complete_fail" as const;
  return invalid(label);
}

function parseIdentity(
  value: unknown,
  label: string
): ExternalIdentityReadModel {
  const item = record(value, label);
  const suspended = optionalBoolean(item, "suspended", label);
  return {
    sourceId: sourceId(item, "id", label),
    displayName: displayName(item, label),
    active: suspended === undefined ? undefined : !suspended,
    firstSeenAt: optionalTimestamp(item, "firstaccess", label),
    lastSeenAt: optionalTimestamp(item, "lastaccess", label),
  };
}

export function parseMoodleIdentityResponse(payload: unknown) {
  return boundedArray(payload, "identity list").map((item, index) =>
    parseIdentity(item, `identity item ${index}`)
  );
}

export function parseMoodleCourseCategoriesResponse(payload: unknown) {
  return boundedArray(payload, "course category list").map((value, index) => {
    const label = `course category item ${index}`;
    const item = record(value, label);
    return {
      sourceId: sourceId(item, "id", label),
      parentSourceId: optionalSourceId(item, "parent", label),
      title: requiredText(item, "name", label),
      visible: optionalBoolean(item, "visible", label),
      depth: optionalInteger(item, "depth", label, 0),
    } satisfies ExternalCourseCategoryReadModel;
  });
}

function parseCourse(value: unknown, label: string): ExternalCourseReadModel {
  const item = record(value, label);
  return {
    sourceId: sourceId(item, "id", label),
    categorySourceId: optionalSourceId(item, "categoryid", label),
    title: requiredText(item, "fullname", label),
    shortTitle: requiredText(item, "shortname", label),
    visible: optionalBoolean(item, "visible", label),
    startsAt: optionalTimestamp(item, "startdate", label),
    endsAt: optionalTimestamp(item, "enddate", label),
    completionTrackingEnabled: optionalBoolean(item, "enablecompletion", label),
  };
}

export function parseMoodleCoursesResponse(payload: unknown) {
  const envelope = record(payload, "course list");
  return arrayField(envelope, "courses", "course list").map((item, index) =>
    parseCourse(item, `course item ${index}`)
  );
}

function parseActivity(
  value: unknown,
  label: string
): ExternalActivityReadModel {
  const item = record(value, label);
  const userVisible = optionalBoolean(item, "uservisible", label);
  return {
    sourceId: sourceId(item, "id", label),
    instanceSourceId: sourceId(item, "instance", label),
    type: requiredText(item, "modname", label, 64),
    title: requiredText(item, "name", label),
    visible:
      userVisible === undefined
        ? optionalBoolean(item, "visible", label)
        : userVisible,
    completionTracking: optionalCompletionTracking(item, "completion", label),
  };
}

export function parseMoodleCourseContentsResponse(payload: unknown) {
  return boundedArray(payload, "course content list").map((value, index) => {
    const label = `course section item ${index}`;
    const item = record(value, label);
    return {
      sourceId: sourceId(item, "id", label),
      position: integer(item, "section", label, 0),
      title: optionalText(item, "name", label),
      visible: optionalBoolean(item, "visible", label),
      activities: optionalArrayField(item, "modules", label).map(
        (module, moduleIndex) =>
          parseActivity(module, `${label} activity ${moduleIndex}`)
      ),
    } satisfies ExternalCourseSectionReadModel;
  });
}

export function parseMoodleCourseModuleResponse(payload: unknown) {
  const envelope = record(payload, "course module");
  const item = record(envelope.cm, "course module");
  const activity = parseActivity(item, "course module");
  return {
    ...activity,
    courseSourceId: sourceId(item, "course", "course module"),
    sectionSourceId: optionalSourceId(item, "section", "course module"),
    sectionPosition: optionalInteger(item, "sectionnum", "course module", 0),
  } satisfies ExternalCourseModuleReadModel;
}

function parseRole(value: unknown, label: string): ExternalRoleReadModel {
  const item = record(value, label);
  return {
    sourceId: sourceId(item, "roleid", label),
    title:
      optionalText(item, "name", label) ??
      requiredText(item, "shortname", label),
  };
}

function parseGroup(value: unknown, label: string): ExternalGroupReadModel {
  const item = record(value, label);
  return {
    sourceId: sourceId(item, "id", label),
    courseSourceId: optionalSourceId(item, "courseid", label),
    title: requiredText(item, "name", label),
    createdAt: optionalTimestamp(item, "timecreated", label),
    modifiedAt: optionalTimestamp(item, "timemodified", label),
  };
}

export function parseMoodleEnrolledUsersResponse(payload: unknown) {
  return boundedArray(payload, "enrolled user list").map((value, index) => {
    const label = `enrolled user item ${index}`;
    const item = record(value, label);
    const suspended = optionalBoolean(item, "suspended", label);
    return {
      sourceUserId: sourceId(item, "id", label),
      displayName: displayName(item, label),
      active: suspended === undefined ? undefined : !suspended,
      firstSeenAt: optionalTimestamp(item, "firstaccess", label),
      lastSeenAt: optionalTimestamp(item, "lastaccess", label),
      roles: optionalArrayField(item, "roles", label).map((role, roleIndex) =>
        parseRole(role, `${label} role ${roleIndex}`)
      ),
      groups: optionalArrayField(item, "groups", label).map(
        (group, groupIndex) => parseGroup(group, `${label} group ${groupIndex}`)
      ),
    } satisfies ExternalEnrolledUserReadModel;
  });
}

export function parseMoodleUserCoursesResponse(payload: unknown) {
  return boundedArray(payload, "user course list").map((value, index) => {
    const label = `user course item ${index}`;
    const item = record(value, label);
    const hidden = optionalBoolean(item, "hidden", label);
    return {
      sourceCourseId: sourceId(item, "id", label),
      title: requiredText(item, "fullname", label),
      shortTitle: requiredText(item, "shortname", label),
      visible:
        hidden === undefined
          ? optionalBoolean(item, "visible", label)
          : !hidden,
      progressPercent: optionalNumber(item, "progress", label),
      completed: optionalBoolean(item, "completed", label),
      startsAt: optionalTimestamp(item, "startdate", label),
      endsAt: optionalTimestamp(item, "enddate", label),
      lastAccessAt: optionalTimestamp(item, "lastaccess", label),
    } satisfies ExternalUserCourseReadModel;
  });
}

export function parseMoodleCourseGroupsResponse(payload: unknown) {
  return boundedArray(payload, "course group list").map((item, index) =>
    parseGroup(item, `course group item ${index}`)
  );
}

export function parseMoodleCourseGroupingsResponse(payload: unknown) {
  return boundedArray(payload, "course grouping list").map((value, index) => {
    const label = `course grouping item ${index}`;
    const item = record(value, label);
    return {
      sourceId: sourceId(item, "id", label),
      courseSourceId: sourceId(item, "courseid", label),
      title: requiredText(item, "name", label),
      createdAt: optionalTimestamp(item, "timecreated", label),
      modifiedAt: optionalTimestamp(item, "timemodified", label),
    } satisfies ExternalGroupingReadModel;
  });
}

export function parseMoodleCourseUserGroupsResponse(payload: unknown) {
  const envelope = record(payload, "course user group list");
  return arrayField(envelope, "groups", "course user group list").map(
    (item, index) => parseGroup(item, `course user group item ${index}`)
  );
}

export function parseMoodleActivityCompletionResponse(payload: unknown) {
  const envelope = record(payload, "activity completion list");
  return arrayField(envelope, "statuses", "activity completion list").map(
    (value, index) => {
      const label = `activity completion item ${index}`;
      const item = record(value, label);
      return {
        activitySourceId: sourceId(item, "cmid", label),
        activityType: requiredText(item, "modname", label, 64),
        activityInstanceSourceId: sourceId(item, "instance", label),
        state: completionState(item, "state", label),
        completedAt: optionalTimestamp(item, "timecompleted", label),
      } satisfies ExternalActivityCompletionReadModel;
    }
  );
}

export function parseMoodleCourseCompletionResponse(payload: unknown) {
  const envelope = record(payload, "course completion");
  const status = record(envelope.completionstatus, "course completion");
  return {
    completed: requiredBoolean(status, "completed", "course completion"),
    criteria: arrayField(
      status,
      "completions",
      "course completion criteria",
      MOODLE_READ_MODEL_LIMITS.nestedItems
    ).map((value, index) => {
      const label = `course completion criterion ${index}`;
      const item = record(value, label);
      return {
        title: optionalText(item, "title", label),
        status: optionalText(item, "status", label, 64),
        completed: requiredBoolean(item, "complete", label),
        completedAt: optionalTimestamp(item, "timecompleted", label),
      } satisfies ExternalCourseCompletionCriterionReadModel;
    }),
  } satisfies ExternalCourseCompletionReadModel;
}

function parseGradeItem(
  value: unknown,
  label: string
): ExternalGradeItemReadModel {
  const item = record(value, label);
  return {
    sourceId: sourceId(item, "id", label),
    title: optionalText(item, "itemname", label),
    kind: optionalText(item, "itemtype", label, 64),
    activityType: optionalText(item, "itemmodule", label, 64),
    activitySourceId: optionalSourceId(item, "cmid", label),
    activityInstanceSourceId: optionalSourceId(item, "iteminstance", label),
    score: optionalNumber(item, "graderaw", label),
    minimumScore: optionalNumber(item, "grademinraw", label),
    maximumScore: optionalNumber(item, "grademaxraw", label),
    locked: optionalBoolean(item, "locked", label),
    feedbackText: optionalText(
      item,
      "feedback",
      label,
      MOODLE_READ_MODEL_LIMITS.textCharacters
    ),
  };
}

export function parseMoodleGradeItemsResponse(payload: unknown) {
  const envelope = record(payload, "grade report");
  return arrayField(envelope, "usergrades", "grade report").map(
    (value, index) => {
      const label = `user grade item ${index}`;
      const item = record(value, label);
      return {
        sourceCourseId: sourceId(item, "courseid", label),
        sourceUserId: sourceId(item, "userid", label),
        items: arrayField(
          item,
          "gradeitems",
          `${label} grade items`,
          MOODLE_READ_MODEL_LIMITS.nestedItems
        ).map((grade, gradeIndex) =>
          parseGradeItem(grade, `${label} grade ${gradeIndex}`)
        ),
      } satisfies ExternalUserGradeReadModel;
    }
  );
}

function assertMatchingSourceId(
  value: UnknownRecord,
  key: string,
  expected: string,
  label: string
) {
  const actual = optionalSourceId(value, key, label);
  if (actual !== undefined && actual !== expected) return invalid(label);
}

function parseAssignment(
  value: unknown,
  courseSourceId: string,
  label: string
): ExternalAssignmentReadModel {
  const item = record(value, label);
  assertMatchingSourceId(item, "course", courseSourceId, label);
  const noSubmissions = optionalBoolean(item, "nosubmissions", label);
  return {
    sourceId: sourceId(item, "id", label),
    activitySourceId: optionalSourceId(item, "cmid", label),
    courseSourceId,
    title: requiredText(item, "name", label),
    acceptsSubmissions:
      noSubmissions === undefined ? undefined : !noSubmissions,
    draftMode: optionalBoolean(item, "submissiondrafts", label),
    teamSubmission: optionalBoolean(item, "teamsubmission", label),
    completionRequiresSubmission: optionalBoolean(
      item,
      "completionsubmit",
      label
    ),
    maximumScore: optionalNumber(item, "grade", label),
    opensAt: optionalTimestamp(item, "allowsubmissionsfromdate", label),
    dueAt: optionalTimestamp(item, "duedate", label),
    cutoffAt: optionalTimestamp(item, "cutoffdate", label),
    gradingDueAt: optionalTimestamp(item, "gradingduedate", label),
    modifiedAt: optionalTimestamp(item, "timemodified", label),
  };
}

export function parseMoodleAssignmentsResponse(payload: unknown) {
  const envelope = record(payload, "assignment course list");
  return arrayField(envelope, "courses", "assignment course list").map(
    (value, index) => {
      const label = `assignment course item ${index}`;
      const item = record(value, label);
      const courseSourceId = sourceId(item, "id", label);
      return {
        sourceCourseId: courseSourceId,
        title: optionalText(item, "fullname", label),
        shortTitle: optionalText(item, "shortname", label),
        assignments: arrayField(
          item,
          "assignments",
          `${label} assignments`,
          MOODLE_READ_MODEL_LIMITS.nestedItems
        ).map((assignment, assignmentIndex) =>
          parseAssignment(
            assignment,
            courseSourceId,
            `${label} assignment ${assignmentIndex}`
          )
        ),
      } satisfies ExternalAssignmentCourseReadModel;
    }
  );
}

function parseAssignmentSubmission(
  value: unknown,
  assignmentSourceId: string,
  label: string
): ExternalAssignmentSubmissionReadModel {
  const item = record(value, label);
  assertMatchingSourceId(item, "assignment", assignmentSourceId, label);
  return {
    sourceId: sourceId(item, "id", label),
    sourceUserId: sourceId(item, "userid", label),
    attempt: integer(item, "attemptnumber", label, 0),
    status: requiredText(item, "status", label, 64),
    groupSourceId: optionalSourceId(item, "groupid", label),
    createdAt: optionalTimestamp(item, "timecreated", label),
    modifiedAt: optionalTimestamp(item, "timemodified", label),
    latest: optionalBoolean(item, "latest", label),
    gradingStatus: optionalText(item, "gradingstatus", label, 64),
  };
}

export function parseMoodleAssignmentSubmissionsResponse(payload: unknown) {
  const envelope = record(payload, "assignment submission list");
  return arrayField(envelope, "assignments", "assignment submission list").map(
    (value, index) => {
      const label = `assignment submissions item ${index}`;
      const item = record(value, label);
      const assignmentSourceId = sourceId(item, "assignmentid", label);
      return {
        assignmentSourceId,
        submissions: arrayField(
          item,
          "submissions",
          `${label} submissions`,
          MOODLE_READ_MODEL_LIMITS.nestedItems
        ).map((submission, submissionIndex) =>
          parseAssignmentSubmission(
            submission,
            assignmentSourceId,
            `${label} submission ${submissionIndex}`
          )
        ),
      } satisfies ExternalAssignmentSubmissionsReadModel;
    }
  );
}

function parseAssignmentGrade(
  value: unknown,
  assignmentSourceId: string,
  label: string
): ExternalAssignmentGradeReadModel {
  const item = record(value, label);
  assertMatchingSourceId(item, "assignment", assignmentSourceId, label);
  return {
    sourceId: sourceId(item, "id", label),
    sourceUserId: sourceId(item, "userid", label),
    attempt: integer(item, "attemptnumber", label, 0),
    score: optionalNumber(item, "grade", label),
    createdAt: optionalTimestamp(item, "timecreated", label),
    modifiedAt: optionalTimestamp(item, "timemodified", label),
  };
}

export function parseMoodleAssignmentGradesResponse(payload: unknown) {
  const envelope = record(payload, "assignment grade list");
  return arrayField(envelope, "assignments", "assignment grade list").map(
    (value, index) => {
      const label = `assignment grades item ${index}`;
      const item = record(value, label);
      const assignmentSourceId = sourceId(item, "assignmentid", label);
      return {
        assignmentSourceId,
        grades: arrayField(
          item,
          "grades",
          `${label} grades`,
          MOODLE_READ_MODEL_LIMITS.nestedItems
        ).map((grade, gradeIndex) =>
          parseAssignmentGrade(
            grade,
            assignmentSourceId,
            `${label} grade ${gradeIndex}`
          )
        ),
      } satisfies ExternalAssignmentGradesReadModel;
    }
  );
}

function parseQuiz(value: unknown, label: string): ExternalQuizReadModel {
  const item = record(value, label);
  const attempts = optionalInteger(item, "attempts", label, 0);
  return {
    sourceId: sourceId(item, "id", label),
    activitySourceId: optionalSourceId(item, "coursemodule", label),
    courseSourceId: sourceId(item, "course", label),
    title: requiredText(item, "name", label),
    opensAt: optionalTimestamp(item, "timeopen", label),
    closesAt: optionalTimestamp(item, "timeclose", label),
    timeLimitSeconds: optionalInteger(item, "timelimit", label, 0),
    attemptLimit: attempts === 0 ? undefined : attempts,
    maximumScore: optionalNumber(item, "grade", label),
    totalMarks: optionalNumber(item, "sumgrades", label),
    hasQuestions: optionalBoolean(item, "hasquestions", label),
    completionRequiresPassing: optionalBoolean(item, "completionpass", label),
    completionRequiresAttemptsExhausted: optionalBoolean(
      item,
      "completionattemptsexhausted",
      label
    ),
    modifiedAt: optionalTimestamp(item, "timemodified", label),
  };
}

export function parseMoodleQuizzesResponse(payload: unknown) {
  const envelope = record(payload, "quiz list");
  return arrayField(envelope, "quizzes", "quiz list").map((item, index) =>
    parseQuiz(item, `quiz item ${index}`)
  );
}

function parseQuizAttempt(
  value: unknown,
  label: string
): ExternalQuizAttemptReadModel {
  const item = record(value, label);
  return {
    sourceId: sourceId(item, "id", label),
    quizSourceId: sourceId(item, "quiz", label),
    sourceUserId: sourceId(item, "userid", label),
    attempt: integer(item, "attempt", label, 1),
    state: requiredText(item, "state", label, 64),
    preview: optionalBoolean(item, "preview", label),
    score: optionalNumber(item, "sumgrades", label),
    startedAt: optionalTimestamp(item, "timestart", label),
    finishedAt: optionalTimestamp(item, "timefinish", label),
    modifiedAt: optionalTimestamp(item, "timemodified", label),
  };
}

export function parseMoodleQuizAttemptsResponse(payload: unknown) {
  const envelope = record(payload, "quiz attempt list");
  return arrayField(envelope, "attempts", "quiz attempt list").map(
    (item, index) => parseQuizAttempt(item, `quiz attempt item ${index}`)
  );
}

export function parseMoodleQuizReviewResponse(payload: unknown) {
  const envelope = record(payload, "quiz attempt review");
  const attempt = Object.hasOwn(envelope, "attempt")
    ? parseQuizAttempt(envelope.attempt, "quiz attempt review")
    : undefined;
  return {
    attempt,
    gradeSummary: optionalTextOrNumber(
      envelope,
      "grade",
      "quiz attempt review",
      160
    ),
    questions: arrayField(
      envelope,
      "questions",
      "quiz attempt review questions",
      MOODLE_READ_MODEL_LIMITS.nestedItems
    ).map((value, index) => {
      const label = `quiz review question ${index}`;
      const item = record(value, label);
      return {
        slot: integer(item, "slot", label, 1),
        type: requiredText(item, "type", label, 64),
        page: integer(item, "page", label, 0),
        state: optionalText(item, "state", label, 64),
        status: optionalText(item, "status", label, 64),
        mark: optionalNumber(item, "mark", label),
        maximumMark: optionalNumber(item, "maxmark", label),
        blocked: Object.hasOwn(item, "blockedbyprevious")
          ? optionalBoolean(item, "blockedbyprevious", label)
          : optionalBoolean(item, "blocked", label),
      } satisfies ExternalQuizReviewQuestionReadModel;
    }),
  } satisfies ExternalQuizReviewReadModel;
}

function parseH5PAttempt(
  value: unknown,
  label: string,
  expectedUserSourceId?: string
): ExternalH5PAttemptReadModel {
  const item = record(value, label);
  const sourceUserId = sourceId(item, "userid", label);
  if (
    expectedUserSourceId !== undefined &&
    sourceUserId !== expectedUserSourceId
  ) {
    return invalid(label);
  }
  return {
    sourceId: sourceId(item, "id", label),
    activityInstanceSourceId: sourceId(item, "h5pactivityid", label),
    sourceUserId,
    attempt: integer(item, "attempt", label, 1),
    score: requiredNumber(item, "rawscore", label),
    maximumScore: requiredNumber(item, "maxscore", label),
    scaledScore: requiredNumber(item, "scaled", label),
    durationSeconds: integer(item, "duration", label, 0),
    completed: optionalBoolean(item, "completion", label),
    successful: optionalBoolean(item, "success", label),
    createdAt: optionalTimestamp(item, "timecreated", label),
    modifiedAt: optionalTimestamp(item, "timemodified", label),
  };
}

function assertConsistentH5PActivity(
  expected: string | undefined,
  actual: string,
  label: string
) {
  if (expected !== undefined && actual !== expected) return invalid(label);
  return actual;
}

export function parseMoodleH5PActivitiesResponse(payload: unknown) {
  const envelope = record(payload, "H5P activity list");
  return arrayField(envelope, "h5pactivities", "H5P activity list").map(
    (value, index) => {
      const label = `H5P activity item ${index}`;
      const item = record(value, label);
      return {
        sourceId: sourceId(item, "id", label),
        activitySourceId: sourceId(item, "coursemodule", label),
        courseSourceId: sourceId(item, "course", label),
        title: requiredText(item, "name", label),
        maximumScore: optionalNumber(item, "grade", label),
        trackingEnabled: optionalBoolean(item, "enabletracking", label),
        createdAt: optionalTimestamp(item, "timecreated", label),
        modifiedAt: optionalTimestamp(item, "timemodified", label),
      } satisfies ExternalH5PActivityReadModel;
    }
  );
}

export function parseMoodleH5PAttemptsResponse(payload: unknown) {
  const envelope = record(payload, "H5P attempt list");
  let activityInstanceSourceId: string | undefined;
  const users = arrayField(
    envelope,
    "usersattempts",
    "H5P user attempt list"
  ).map((value, index) => {
    const label = `H5P user attempts item ${index}`;
    const item = record(value, label);
    const sourceUserId = sourceId(item, "userid", label);
    const attempts = arrayField(
      item,
      "attempts",
      `${label} attempts`,
      MOODLE_READ_MODEL_LIMITS.nestedItems
    ).map((attempt, attemptIndex) => {
      const attemptLabel = `${label} attempt ${attemptIndex}`;
      const parsed = parseH5PAttempt(attempt, attemptLabel, sourceUserId);
      activityInstanceSourceId = assertConsistentH5PActivity(
        activityInstanceSourceId,
        parsed.activityInstanceSourceId,
        attemptLabel
      );
      return parsed;
    });
    return {
      sourceUserId,
      attempts,
    } satisfies ExternalH5PUserAttemptsReadModel;
  });
  return {
    activitySourceId: sourceId(envelope, "activityid", "H5P attempt list"),
    users,
  } satisfies ExternalH5PAttemptsReadModel;
}

function parseH5PResult(
  value: unknown,
  attemptSourceId: string,
  label: string
): ExternalH5PResultReadModel {
  const item = record(value, label);
  if (sourceId(item, "attemptid", label) !== attemptSourceId) {
    return invalid(label);
  }
  return {
    sourceId: sourceId(item, "id", label),
    attemptSourceId,
    interactionType: requiredText(item, "interactiontype", label, 64),
    score: requiredNumber(item, "rawscore", label),
    maximumScore: requiredNumber(item, "maxscore", label),
    durationSeconds: optionalInteger(item, "duration", label, 0),
    completed: optionalBoolean(item, "completion", label),
    successful: optionalBoolean(item, "success", label),
    createdAt: optionalTimestamp(item, "timecreated", label),
  };
}

export function parseMoodleH5PResultsResponse(payload: unknown) {
  const envelope = record(payload, "H5P result list");
  let activityInstanceSourceId: string | undefined;
  const attempts = arrayField(envelope, "attempts", "H5P result list").map(
    (value, index) => {
      const label = `H5P result attempt ${index}`;
      const attempt = parseH5PAttempt(value, label);
      activityInstanceSourceId = assertConsistentH5PActivity(
        activityInstanceSourceId,
        attempt.activityInstanceSourceId,
        label
      );
      const item = record(value, label);
      return {
        ...attempt,
        results: optionalArrayField(item, "results", `${label} results`).map(
          (result, resultIndex) =>
            parseH5PResult(
              result,
              attempt.sourceId,
              `${label} result ${resultIndex}`
            )
        ),
      } satisfies ExternalH5PAttemptResultsReadModel;
    }
  );
  return {
    activitySourceId: sourceId(envelope, "activityid", "H5P result list"),
    attempts,
  } satisfies ExternalH5PResultsReadModel;
}

export function parseMoodleScormsResponse(payload: unknown) {
  const envelope = record(payload, "SCORM activity list");
  return arrayField(envelope, "scorms", "SCORM activity list").map(
    (value, index) => {
      const label = `SCORM activity item ${index}`;
      const item = record(value, label);
      return {
        sourceId: sourceId(item, "id", label),
        activitySourceId: sourceId(item, "coursemodule", label),
        courseSourceId: sourceId(item, "course", label),
        title: requiredText(item, "name", label),
        visible: optionalBoolean(item, "visible", label),
        version: optionalText(item, "version", label, 64),
        maximumScore: optionalNumber(item, "maxgrade", label),
        maximumAttempts: optionalInteger(item, "maxattempt", label, 0),
        opensAt: optionalTimestamp(item, "timeopen", label),
        closesAt: optionalTimestamp(item, "timeclose", label),
        revision: optionalInteger(item, "revision", label, 0),
        modifiedAt: optionalTimestamp(item, "timemodified", label),
      } satisfies ExternalScormActivityReadModel;
    }
  );
}

function consistentMetric<T>(
  current: T | undefined,
  candidate: T,
  label: string
) {
  if (current !== undefined && current !== candidate) return invalid(label);
  return candidate;
}

export function parseMoodleScormTracksResponse(payload: unknown) {
  const envelope = record(payload, "SCORM track list");
  const data = record(envelope.data, "SCORM track list");
  let status: string | undefined;
  let completionStatus: string | undefined;
  let successStatus: string | undefined;
  let score: number | undefined;
  let minimumScore: number | undefined;
  let maximumScore: number | undefined;
  let totalTime: string | undefined;

  arrayField(data, "tracks", "SCORM tracks").forEach((value, index) => {
    const label = `SCORM track item ${index}`;
    const item = record(value, label);
    const element = normalizeMoodleScormProgressElement(
      requiredText(item, "element", label, 128)
    );
    const rawTrackValue = item.value;
    if (
      (typeof rawTrackValue !== "string" &&
        (typeof rawTrackValue !== "number" ||
          !Number.isFinite(rawTrackValue))) ||
      (typeof rawTrackValue === "string" &&
        rawTrackValue.length > MOODLE_READ_MODEL_LIMITS.textCharacters * 8)
    ) {
      return invalid(label);
    }
    if (!element) return;

    const safeTrackValue = () =>
      typeof rawTrackValue === "string"
        ? sanitizeMoodleProjectionText(rawTrackValue, label, 160) ||
          invalid(label)
        : invalid(label);
    switch (element) {
      case "cmi.core.lesson_status":
        status = consistentMetric(status, safeTrackValue(), label);
        break;
      case "cmi.completion_status":
        completionStatus = consistentMetric(
          completionStatus,
          safeTrackValue(),
          label
        );
        break;
      case "cmi.success_status":
        successStatus = consistentMetric(
          successStatus,
          safeTrackValue(),
          label
        );
        break;
      case "cmi.core.score.raw":
      case "cmi.score.raw":
        score = consistentMetric(
          score,
          requiredNumber(item, "value", label),
          label
        );
        break;
      case "cmi.core.score.min":
      case "cmi.score.min":
        minimumScore = consistentMetric(
          minimumScore,
          requiredNumber(item, "value", label),
          label
        );
        break;
      case "cmi.core.score.max":
      case "cmi.score.max":
        maximumScore = consistentMetric(
          maximumScore,
          requiredNumber(item, "value", label),
          label
        );
        break;
      case "cmi.core.total_time":
      case "cmi.total_time":
        totalTime = consistentMetric(totalTime, safeTrackValue(), label);
        break;
    }
  });

  return {
    attempt: integer(data, "attempt", "SCORM track list", 1),
    status,
    completionStatus,
    successStatus,
    score,
    minimumScore,
    maximumScore,
    totalTime,
  } satisfies ExternalScormTracksReadModel;
}

function parseLesson(value: unknown, label: string): ExternalLessonReadModel {
  const item = record(value, label);
  return {
    sourceId: sourceId(item, "id", label),
    activitySourceId: optionalSourceId(item, "coursemodule", label),
    courseSourceId: sourceId(item, "course", label),
    title: requiredText(item, "name", label),
    practice: optionalBoolean(item, "practice", label),
    retakesAllowed: optionalBoolean(item, "retake", label),
    maximumScore: optionalNumber(item, "grade", label),
    opensAt: optionalTimestamp(item, "available", label),
    closesAt: optionalTimestamp(item, "deadline", label),
    timeLimitSeconds: optionalInteger(item, "timelimit", label, 0),
    completionRequiresEnd: optionalBoolean(item, "completionendreached", label),
    completionTimeSeconds: optionalInteger(
      item,
      "completiontimespent",
      label,
      0
    ),
    modifiedAt: optionalTimestamp(item, "timemodified", label),
  };
}

export function parseMoodleLessonsResponse(payload: unknown) {
  const envelope = record(payload, "lesson list");
  return arrayField(envelope, "lessons", "lesson list").map((item, index) =>
    parseLesson(item, `lesson item ${index}`)
  );
}

export function parseMoodleLessonGradeResponse(payload: unknown) {
  const envelope = record(payload, "lesson grade");
  if (!Object.hasOwn(envelope, "grade")) return invalid("lesson grade");
  if (
    typeof envelope.grade === "number" ||
    (typeof envelope.grade === "string" &&
      numericTextPattern.test(envelope.grade))
  ) {
    return {
      score: optionalNumber(envelope, "grade", "lesson grade"),
    } satisfies ExternalLessonGradeReadModel;
  }
  const grade = record(envelope.grade, "lesson grade");
  return {
    lessonSourceId: optionalSourceId(grade, "lessonid", "lesson grade"),
    sourceUserId: optionalSourceId(grade, "userid", "lesson grade"),
    score: optionalNumber(grade, "grade", "lesson grade"),
  } satisfies ExternalLessonGradeReadModel;
}

function parseContentActivities(
  payload: unknown,
  collectionKey: "books" | "pages" | "resources" | "urls",
  kind: ExternalContentActivityReadModel["kind"]
) {
  const label = `${kind} list`;
  const envelope = record(payload, label);
  return arrayField(envelope, collectionKey, label).map((value, index) => {
    const itemLabel = `${kind} item ${index}`;
    const item = record(value, itemLabel);
    const userVisible = optionalBoolean(item, "uservisible", itemLabel);
    return {
      kind,
      sourceId: sourceId(item, "id", itemLabel),
      activitySourceId: optionalSourceId(item, "coursemodule", itemLabel),
      courseSourceId: sourceId(item, "course", itemLabel),
      title: requiredText(item, "name", itemLabel),
      visible:
        userVisible === undefined
          ? optionalBoolean(item, "visible", itemLabel)
          : userVisible,
      revision: optionalInteger(item, "revision", itemLabel, 0),
      createdAt: optionalTimestamp(item, "timecreated", itemLabel),
      modifiedAt: optionalTimestamp(item, "timemodified", itemLabel),
    } satisfies ExternalContentActivityReadModel;
  });
}

export function parseMoodleBooksResponse(payload: unknown) {
  return parseContentActivities(payload, "books", "book");
}

export function parseMoodlePagesResponse(payload: unknown) {
  return parseContentActivities(payload, "pages", "page");
}

export function parseMoodleResourcesResponse(payload: unknown) {
  return parseContentActivities(payload, "resources", "resource");
}

export function parseMoodleUrlsResponse(payload: unknown) {
  return parseContentActivities(payload, "urls", "url");
}

const responseParsers = {
  core_course_get_categories: parseMoodleCourseCategoriesResponse,
  core_course_get_courses_by_field: parseMoodleCoursesResponse,
  core_course_get_contents: parseMoodleCourseContentsResponse,
  core_course_get_course_module: parseMoodleCourseModuleResponse,
  core_enrol_get_enrolled_users: parseMoodleEnrolledUsersResponse,
  core_enrol_get_users_courses: parseMoodleUserCoursesResponse,
  core_user_get_users_by_field: parseMoodleIdentityResponse,
  core_group_get_course_groups: parseMoodleCourseGroupsResponse,
  core_group_get_course_groupings: parseMoodleCourseGroupingsResponse,
  core_group_get_course_user_groups: parseMoodleCourseUserGroupsResponse,
  core_completion_get_activities_completion_status:
    parseMoodleActivityCompletionResponse,
  core_completion_get_course_completion_status:
    parseMoodleCourseCompletionResponse,
  gradereport_user_get_grade_items: parseMoodleGradeItemsResponse,
  mod_assign_get_assignments: parseMoodleAssignmentsResponse,
  mod_assign_get_submissions: parseMoodleAssignmentSubmissionsResponse,
  mod_assign_get_grades: parseMoodleAssignmentGradesResponse,
  mod_quiz_get_quizzes_by_courses: parseMoodleQuizzesResponse,
  mod_quiz_get_user_attempts: parseMoodleQuizAttemptsResponse,
  mod_quiz_get_attempt_review: parseMoodleQuizReviewResponse,
  mod_h5pactivity_get_h5pactivities_by_courses:
    parseMoodleH5PActivitiesResponse,
  mod_h5pactivity_get_attempts: parseMoodleH5PAttemptsResponse,
  mod_h5pactivity_get_results: parseMoodleH5PResultsResponse,
  mod_scorm_get_scorms_by_courses: parseMoodleScormsResponse,
  mod_scorm_get_scorm_sco_tracks: parseMoodleScormTracksResponse,
  mod_lesson_get_lessons_by_courses: parseMoodleLessonsResponse,
  mod_lesson_get_user_grade: parseMoodleLessonGradeResponse,
  mod_book_get_books_by_courses: parseMoodleBooksResponse,
  mod_page_get_pages_by_courses: parseMoodlePagesResponse,
  mod_resource_get_resources_by_courses: parseMoodleResourcesResponse,
  mod_url_get_urls_by_courses: parseMoodleUrlsResponse,
} satisfies Record<MoodleProjectionFunction, (payload: unknown) => unknown>;

export function parseMoodleReadResponse<
  FunctionName extends MoodleProjectionFunction,
>(
  functionName: FunctionName,
  payload: unknown
): MoodleReadModelResponseMap[FunctionName] {
  return responseParsers[functionName](
    payload
  ) as MoodleReadModelResponseMap[FunctionName];
}
