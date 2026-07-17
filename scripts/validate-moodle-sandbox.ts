import crypto from "node:crypto";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import {
  createMoodleClientFromEnvironment,
  getMoodleServerStatus,
  MOODLE_READ_FUNCTIONS,
  MoodleApiError,
  type MoodleClient,
  type MoodleErrorCode,
  type MoodleReadFunction,
} from "../server/moodleClient";
import {
  normalizeMoodleScormProgressElement,
  parseMoodleReadResponse,
  type MoodleProjectionFunction,
} from "../server/moodleReadModels";

type MoodleCallParameters = NonNullable<Parameters<MoodleClient["call"]>[1]>;
type PayloadShape = "array" | "object";
type FixtureEnvironment =
  | "MOODLE_FIXTURE_CATEGORY_ID"
  | "MOODLE_FIXTURE_COURSE_ID"
  | "MOODLE_FIXTURE_COURSE_MODULE_ID"
  | "MOODLE_FIXTURE_USER_ID"
  | "MOODLE_FIXTURE_INTERACTION_USER_ID"
  | "MOODLE_FIXTURE_GROUPING_ID"
  | "MOODLE_FIXTURE_ASSIGNMENT_ID"
  | "MOODLE_FIXTURE_QUIZ_ID"
  | "MOODLE_FIXTURE_QUIZ_ATTEMPT_ID"
  | "MOODLE_FIXTURE_H5P_ACTIVITY_ID"
  | "MOODLE_FIXTURE_H5P_ATTEMPT_ID"
  | "MOODLE_FIXTURE_SCORM_SCO_ID"
  | "MOODLE_FIXTURE_SCORM_ATTEMPT_NUMBER"
  | "MOODLE_FIXTURE_LESSON_ID";

type FixtureValues = Record<FixtureEnvironment, number>;
type FixtureIssue = "missing" | "invalid";
type SummaryErrorCode =
  | MoodleErrorCode
  | "fixture_absent"
  | "not_run_after_probe"
  | `configuration:${string}`
  | `fixture_${FixtureIssue}:${string}`;

type FunctionSummary = {
  function: MoodleReadFunction;
  ok: boolean;
  errorCode: SummaryErrorCode | null;
  count: number | null;
  shape: PayloadShape | null;
};

type FunctionSpec = {
  fixtures: readonly FixtureEnvironment[];
  expectedShape: PayloadShape;
  parameters: (fixtures: FixtureValues) => MoodleCallParameters;
  count: (payload: unknown) => number | null;
  fixtureMatch?: (
    projection: unknown,
    fixtures: FixtureValues
  ) => "match" | "fixture_absent" | "invalid_response";
};

type ReadClient = Pick<MoodleClient, "call" | "probe">;
type ReadResponseParser = (
  functionName: MoodleProjectionFunction,
  payload: unknown
) => unknown;
type ValidationDependencies = {
  createClient?: (env: NodeJS.ProcessEnv) => ReadClient;
  parseResponse?: ReadResponseParser;
};

export type MoodleSandboxReadValidationResult = Readonly<{
  exitCode: 0 | 1 | 2;
  results: readonly FunctionSummary[];
  fingerprints: Readonly<{
    functions: Readonly<Record<MoodleReadFunction, string | null>>;
    families: Readonly<Record<string, string | null>>;
    combined: string | null;
  }>;
}>;

const MAX_MOODLE_ID = 2_147_483_647;
const MAX_SCORM_ATTEMPT_NUMBER = 10_000;
const ENROLLED_USER_LIMIT = 100;
const FINGERPRINT_VERSION = "nile:m2c-r:v1";
const H5P_FIXTURE_TITLE = "Nile Learn M2C-R TrueFalse Fixture";
const SCORM_FIXTURE_TITLE = "Nile Learn M2C-R SCORM 1.2 Fixture";
export const MOODLE_PROJECTION_FUNCTIONS = MOODLE_READ_FUNCTIONS.slice(
  1
) as readonly MoodleProjectionFunction[];

const forbiddenProjectionKeys = new Set([
  "answer",
  "address",
  "city",
  "content",
  "correctanswer",
  "customfields",
  "description",
  "email",
  "externalurl",
  "filename",
  "fileurl",
  "filepath",
  "html",
  "intro",
  "overviewfiles",
  "packageurl",
  "parameters",
  "password",
  "phone1",
  "phone2",
  "plugins",
  "profileimageurl",
  "profileimageurlsmall",
  "responsefileareas",
  "subnet",
  "summary",
  "url",
  "useranswer",
]);

const fixtureEnvironments = [
  "MOODLE_FIXTURE_CATEGORY_ID",
  "MOODLE_FIXTURE_COURSE_ID",
  "MOODLE_FIXTURE_COURSE_MODULE_ID",
  "MOODLE_FIXTURE_USER_ID",
  "MOODLE_FIXTURE_INTERACTION_USER_ID",
  "MOODLE_FIXTURE_GROUPING_ID",
  "MOODLE_FIXTURE_ASSIGNMENT_ID",
  "MOODLE_FIXTURE_QUIZ_ID",
  "MOODLE_FIXTURE_QUIZ_ATTEMPT_ID",
  "MOODLE_FIXTURE_H5P_ACTIVITY_ID",
  "MOODLE_FIXTURE_H5P_ATTEMPT_ID",
  "MOODLE_FIXTURE_SCORM_SCO_ID",
  "MOODLE_FIXTURE_SCORM_ATTEMPT_NUMBER",
  "MOODLE_FIXTURE_LESSON_ID",
] as const satisfies readonly FixtureEnvironment[];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function topLevelArrayCount(payload: unknown) {
  return Array.isArray(payload) ? payload.length : null;
}

function collectionCount(payload: unknown, key: string) {
  if (!isRecord(payload) || !Array.isArray(payload[key])) return null;
  return payload[key].length;
}

function nestedCollectionCount(
  payload: unknown,
  outerKey: string,
  innerKey: string
) {
  if (!isRecord(payload) || !Array.isArray(payload[outerKey])) return null;
  let count = 0;
  for (const item of payload[outerKey]) {
    if (!isRecord(item) || !Array.isArray(item[innerKey])) return null;
    count += item[innerKey].length;
  }
  return count;
}

function objectFieldCount(payload: unknown, key: string) {
  if (!isRecord(payload)) return null;
  return isRecord(payload[key]) ? 1 : 0;
}

function ownFieldCount(payload: unknown, key: string) {
  if (!isRecord(payload)) return null;
  return Object.hasOwn(payload, key) ? 1 : 0;
}

function h5pAttemptCount(payload: unknown) {
  if (!isRecord(payload)) return null;
  if (Array.isArray(payload.attempts)) return payload.attempts.length;
  if (!Array.isArray(payload.usersattempts)) return null;

  let count = 0;
  for (const userAttempts of payload.usersattempts) {
    if (!isRecord(userAttempts) || !Array.isArray(userAttempts.attempts)) {
      return null;
    }
    count += userAttempts.attempts.length;
  }
  return count;
}

function h5pResultCount(payload: unknown) {
  if (!isRecord(payload)) return null;
  if (!Array.isArray(payload.attempts)) return null;
  let count = 0;
  for (const attempt of payload.attempts) {
    if (!isRecord(attempt)) return null;
    if (!Object.hasOwn(attempt, "results")) continue;
    if (!Array.isArray(attempt.results)) return null;
    count += attempt.results.length;
  }
  return count;
}

function scormTrackCount(payload: unknown) {
  if (!isRecord(payload) || !isRecord(payload.data)) return null;
  if (!Array.isArray(payload.data.tracks)) return null;
  return payload.data.tracks.filter(
    track =>
      isRecord(track) &&
      typeof track.element === "string" &&
      normalizeMoodleScormProgressElement(track.element) !== null
  ).length;
}

function stringField(value: unknown, key: string) {
  return isRecord(value) && typeof value[key] === "string" ? value[key] : null;
}

function arrayField(value: unknown, key: string) {
  return isRecord(value) && Array.isArray(value[key]) ? value[key] : null;
}

function matchH5PActivity(projection: unknown, fixtures: FixtureValues) {
  if (!Array.isArray(projection)) return "invalid_response" as const;
  const activity = projection.find(
    item =>
      stringField(item, "sourceId") ===
      String(fixtures.MOODLE_FIXTURE_H5P_ACTIVITY_ID)
  );
  if (!activity) return "fixture_absent" as const;
  return stringField(activity, "courseSourceId") ===
    String(fixtures.MOODLE_FIXTURE_COURSE_ID) &&
    stringField(activity, "title") === H5P_FIXTURE_TITLE
    ? ("match" as const)
    : ("invalid_response" as const);
}

function matchH5PAttempt(projection: unknown, fixtures: FixtureValues) {
  if (
    !isRecord(projection) ||
    stringField(projection, "activitySourceId") !==
      String(fixtures.MOODLE_FIXTURE_H5P_ACTIVITY_ID)
  ) {
    return "invalid_response" as const;
  }
  const users = arrayField(projection, "users");
  if (!users) return "invalid_response" as const;
  const user = users.find(
    item =>
      stringField(item, "sourceUserId") ===
      String(fixtures.MOODLE_FIXTURE_INTERACTION_USER_ID)
  );
  if (!user) return "fixture_absent" as const;
  const attempts = arrayField(user, "attempts");
  if (!attempts) return "invalid_response" as const;
  const attempt = attempts.find(
    item =>
      stringField(item, "sourceId") ===
      String(fixtures.MOODLE_FIXTURE_H5P_ATTEMPT_ID)
  );
  if (!attempt) return "fixture_absent" as const;
  return stringField(attempt, "sourceUserId") ===
    String(fixtures.MOODLE_FIXTURE_INTERACTION_USER_ID) &&
    stringField(attempt, "activityInstanceSourceId") ===
      String(fixtures.MOODLE_FIXTURE_H5P_ACTIVITY_ID)
    ? ("match" as const)
    : ("invalid_response" as const);
}

function matchH5PResult(projection: unknown, fixtures: FixtureValues) {
  if (
    !isRecord(projection) ||
    stringField(projection, "activitySourceId") !==
      String(fixtures.MOODLE_FIXTURE_H5P_ACTIVITY_ID)
  ) {
    return "invalid_response" as const;
  }
  const attempts = arrayField(projection, "attempts");
  if (!attempts) return "invalid_response" as const;
  const attempt = attempts.find(
    item =>
      stringField(item, "sourceId") ===
      String(fixtures.MOODLE_FIXTURE_H5P_ATTEMPT_ID)
  );
  if (!attempt) return "fixture_absent" as const;
  if (
    stringField(attempt, "sourceUserId") !==
      String(fixtures.MOODLE_FIXTURE_INTERACTION_USER_ID) ||
    stringField(attempt, "activityInstanceSourceId") !==
      String(fixtures.MOODLE_FIXTURE_H5P_ACTIVITY_ID)
  ) {
    return "invalid_response" as const;
  }
  const results = arrayField(attempt, "results");
  if (!results) return "invalid_response" as const;
  return results.length > 0 ? ("match" as const) : ("fixture_absent" as const);
}

function matchScormActivity(projection: unknown, fixtures: FixtureValues) {
  if (!Array.isArray(projection)) return "invalid_response" as const;
  const activity = projection.find(
    item => stringField(item, "title") === SCORM_FIXTURE_TITLE
  );
  if (!activity) return "fixture_absent" as const;
  return stringField(activity, "courseSourceId") ===
    String(fixtures.MOODLE_FIXTURE_COURSE_ID)
    ? ("match" as const)
    : ("invalid_response" as const);
}

function matchScormTrack(projection: unknown, fixtures: FixtureValues) {
  if (!isRecord(projection)) return "invalid_response" as const;
  if (projection.attempt !== fixtures.MOODLE_FIXTURE_SCORM_ATTEMPT_NUMBER) {
    return "invalid_response" as const;
  }
  return [
    "status",
    "completionStatus",
    "successStatus",
    "score",
    "minimumScore",
    "maximumScore",
    "totalTime",
  ].some(key => projection[key] !== undefined)
    ? ("match" as const)
    : ("fixture_absent" as const);
}

function warningCount(payload: unknown) {
  if (!isRecord(payload) || !Array.isArray(payload.warnings)) return 0;
  return payload.warnings.length;
}

function assertSanitizedProjection(value: unknown): void {
  if (Array.isArray(value)) {
    value.forEach(assertSanitizedProjection);
    return;
  }
  if (!isRecord(value)) return;

  for (const [key, child] of Object.entries(value)) {
    if (forbiddenProjectionKeys.has(key.toLowerCase())) {
      throw new Error("Unsafe Moodle projection.");
    }
    assertSanitizedProjection(child);
  }
}

const functionSpecs = {
  core_webservice_get_site_info: {
    fixtures: [],
    expectedShape: "object",
    parameters: () => ({}),
    count: payload => collectionCount(payload, "functions"),
  },
  core_course_get_categories: {
    fixtures: ["MOODLE_FIXTURE_CATEGORY_ID"],
    expectedShape: "array",
    parameters: fixtures => ({
      criteria: [
        {
          key: "id",
          value: fixtures.MOODLE_FIXTURE_CATEGORY_ID,
        },
      ],
    }),
    count: topLevelArrayCount,
  },
  core_course_get_courses_by_field: {
    fixtures: ["MOODLE_FIXTURE_COURSE_ID"],
    expectedShape: "object",
    parameters: fixtures => ({
      field: "id",
      value: String(fixtures.MOODLE_FIXTURE_COURSE_ID),
    }),
    count: payload => collectionCount(payload, "courses"),
  },
  core_course_get_contents: {
    fixtures: ["MOODLE_FIXTURE_COURSE_ID"],
    expectedShape: "array",
    parameters: fixtures => ({
      courseid: fixtures.MOODLE_FIXTURE_COURSE_ID,
      options: [{ name: "excludecontents", value: "1" }],
    }),
    count: topLevelArrayCount,
  },
  core_course_get_course_module: {
    fixtures: ["MOODLE_FIXTURE_COURSE_MODULE_ID"],
    expectedShape: "object",
    parameters: fixtures => ({
      cmid: fixtures.MOODLE_FIXTURE_COURSE_MODULE_ID,
    }),
    count: payload => objectFieldCount(payload, "cm"),
  },
  core_enrol_get_enrolled_users: {
    fixtures: ["MOODLE_FIXTURE_COURSE_ID"],
    expectedShape: "array",
    parameters: fixtures => ({
      courseid: fixtures.MOODLE_FIXTURE_COURSE_ID,
      options: [
        { name: "onlyactive", value: "1" },
        { name: "userfields", value: "id" },
        { name: "limitfrom", value: "0" },
        { name: "limitnumber", value: String(ENROLLED_USER_LIMIT) },
      ],
    }),
    count: topLevelArrayCount,
  },
  core_enrol_get_users_courses: {
    fixtures: ["MOODLE_FIXTURE_USER_ID"],
    expectedShape: "array",
    parameters: fixtures => ({ userid: fixtures.MOODLE_FIXTURE_USER_ID }),
    count: topLevelArrayCount,
  },
  core_user_get_users_by_field: {
    fixtures: ["MOODLE_FIXTURE_USER_ID"],
    expectedShape: "array",
    parameters: fixtures => ({
      field: "id",
      values: [fixtures.MOODLE_FIXTURE_USER_ID],
    }),
    count: topLevelArrayCount,
  },
  core_group_get_course_groups: {
    fixtures: ["MOODLE_FIXTURE_COURSE_ID"],
    expectedShape: "array",
    parameters: fixtures => ({ courseid: fixtures.MOODLE_FIXTURE_COURSE_ID }),
    count: topLevelArrayCount,
  },
  core_group_get_course_groupings: {
    fixtures: ["MOODLE_FIXTURE_COURSE_ID"],
    expectedShape: "array",
    parameters: fixtures => ({ courseid: fixtures.MOODLE_FIXTURE_COURSE_ID }),
    count: topLevelArrayCount,
  },
  core_group_get_course_user_groups: {
    fixtures: [
      "MOODLE_FIXTURE_COURSE_ID",
      "MOODLE_FIXTURE_USER_ID",
      "MOODLE_FIXTURE_GROUPING_ID",
    ],
    expectedShape: "object",
    parameters: fixtures => ({
      courseid: fixtures.MOODLE_FIXTURE_COURSE_ID,
      userid: fixtures.MOODLE_FIXTURE_USER_ID,
      groupingid: fixtures.MOODLE_FIXTURE_GROUPING_ID,
    }),
    count: payload => collectionCount(payload, "groups"),
  },
  core_completion_get_activities_completion_status: {
    fixtures: ["MOODLE_FIXTURE_COURSE_ID", "MOODLE_FIXTURE_USER_ID"],
    expectedShape: "object",
    parameters: fixtures => ({
      courseid: fixtures.MOODLE_FIXTURE_COURSE_ID,
      userid: fixtures.MOODLE_FIXTURE_USER_ID,
    }),
    count: payload => collectionCount(payload, "statuses"),
  },
  core_completion_get_course_completion_status: {
    fixtures: ["MOODLE_FIXTURE_COURSE_ID", "MOODLE_FIXTURE_USER_ID"],
    expectedShape: "object",
    parameters: fixtures => ({
      courseid: fixtures.MOODLE_FIXTURE_COURSE_ID,
      userid: fixtures.MOODLE_FIXTURE_USER_ID,
    }),
    count: payload => objectFieldCount(payload, "completionstatus"),
  },
  gradereport_user_get_grade_items: {
    fixtures: ["MOODLE_FIXTURE_COURSE_ID", "MOODLE_FIXTURE_USER_ID"],
    expectedShape: "object",
    parameters: fixtures => ({
      courseid: fixtures.MOODLE_FIXTURE_COURSE_ID,
      userid: fixtures.MOODLE_FIXTURE_USER_ID,
    }),
    count: payload => collectionCount(payload, "usergrades"),
  },
  mod_assign_get_assignments: {
    fixtures: ["MOODLE_FIXTURE_COURSE_ID"],
    expectedShape: "object",
    parameters: fixtures => ({
      courseids: [fixtures.MOODLE_FIXTURE_COURSE_ID],
      includenotenrolledcourses: true,
    }),
    count: payload => nestedCollectionCount(payload, "courses", "assignments"),
  },
  mod_assign_get_submissions: {
    fixtures: ["MOODLE_FIXTURE_ASSIGNMENT_ID"],
    expectedShape: "object",
    parameters: fixtures => ({
      assignmentids: [fixtures.MOODLE_FIXTURE_ASSIGNMENT_ID],
      status: "",
      since: 0,
      before: 0,
    }),
    count: payload =>
      nestedCollectionCount(payload, "assignments", "submissions"),
  },
  mod_assign_get_grades: {
    fixtures: ["MOODLE_FIXTURE_ASSIGNMENT_ID"],
    expectedShape: "object",
    parameters: fixtures => ({
      assignmentids: [fixtures.MOODLE_FIXTURE_ASSIGNMENT_ID],
      since: 0,
    }),
    count: payload => nestedCollectionCount(payload, "assignments", "grades"),
  },
  mod_quiz_get_quizzes_by_courses: {
    fixtures: ["MOODLE_FIXTURE_COURSE_ID"],
    expectedShape: "object",
    parameters: fixtures => ({
      courseids: [fixtures.MOODLE_FIXTURE_COURSE_ID],
    }),
    count: payload => collectionCount(payload, "quizzes"),
  },
  mod_quiz_get_user_attempts: {
    fixtures: ["MOODLE_FIXTURE_QUIZ_ID", "MOODLE_FIXTURE_USER_ID"],
    expectedShape: "object",
    parameters: fixtures => ({
      quizid: fixtures.MOODLE_FIXTURE_QUIZ_ID,
      userid: fixtures.MOODLE_FIXTURE_USER_ID,
      status: "all",
      includepreviews: false,
    }),
    count: payload => collectionCount(payload, "attempts"),
  },
  mod_quiz_get_attempt_review: {
    fixtures: ["MOODLE_FIXTURE_QUIZ_ATTEMPT_ID"],
    expectedShape: "object",
    parameters: fixtures => ({
      attemptid: fixtures.MOODLE_FIXTURE_QUIZ_ATTEMPT_ID,
      page: 0,
    }),
    count: payload => collectionCount(payload, "questions"),
  },
  mod_h5pactivity_get_h5pactivities_by_courses: {
    fixtures: ["MOODLE_FIXTURE_COURSE_ID", "MOODLE_FIXTURE_H5P_ACTIVITY_ID"],
    expectedShape: "object",
    parameters: fixtures => ({
      courseids: [fixtures.MOODLE_FIXTURE_COURSE_ID],
    }),
    count: payload => collectionCount(payload, "h5pactivities"),
    fixtureMatch: matchH5PActivity,
  },
  mod_h5pactivity_get_attempts: {
    fixtures: [
      "MOODLE_FIXTURE_H5P_ACTIVITY_ID",
      "MOODLE_FIXTURE_H5P_ATTEMPT_ID",
      "MOODLE_FIXTURE_INTERACTION_USER_ID",
    ],
    expectedShape: "object",
    parameters: fixtures => ({
      h5pactivityid: fixtures.MOODLE_FIXTURE_H5P_ACTIVITY_ID,
      userids: [fixtures.MOODLE_FIXTURE_INTERACTION_USER_ID],
    }),
    count: h5pAttemptCount,
    fixtureMatch: matchH5PAttempt,
  },
  mod_h5pactivity_get_results: {
    fixtures: [
      "MOODLE_FIXTURE_H5P_ACTIVITY_ID",
      "MOODLE_FIXTURE_H5P_ATTEMPT_ID",
      "MOODLE_FIXTURE_INTERACTION_USER_ID",
    ],
    expectedShape: "object",
    parameters: fixtures => ({
      h5pactivityid: fixtures.MOODLE_FIXTURE_H5P_ACTIVITY_ID,
      attemptids: [fixtures.MOODLE_FIXTURE_H5P_ATTEMPT_ID],
    }),
    count: h5pResultCount,
    fixtureMatch: matchH5PResult,
  },
  mod_scorm_get_scorms_by_courses: {
    fixtures: ["MOODLE_FIXTURE_COURSE_ID"],
    expectedShape: "object",
    parameters: fixtures => ({
      courseids: [fixtures.MOODLE_FIXTURE_COURSE_ID],
    }),
    count: payload => collectionCount(payload, "scorms"),
    fixtureMatch: matchScormActivity,
  },
  mod_scorm_get_scorm_sco_tracks: {
    fixtures: [
      "MOODLE_FIXTURE_SCORM_SCO_ID",
      "MOODLE_FIXTURE_INTERACTION_USER_ID",
      "MOODLE_FIXTURE_SCORM_ATTEMPT_NUMBER",
    ],
    expectedShape: "object",
    parameters: fixtures => ({
      scoid: fixtures.MOODLE_FIXTURE_SCORM_SCO_ID,
      userid: fixtures.MOODLE_FIXTURE_INTERACTION_USER_ID,
      attempt: fixtures.MOODLE_FIXTURE_SCORM_ATTEMPT_NUMBER,
    }),
    count: scormTrackCount,
    fixtureMatch: matchScormTrack,
  },
  mod_lesson_get_lessons_by_courses: {
    fixtures: ["MOODLE_FIXTURE_COURSE_ID"],
    expectedShape: "object",
    parameters: fixtures => ({
      courseids: [fixtures.MOODLE_FIXTURE_COURSE_ID],
    }),
    count: payload => collectionCount(payload, "lessons"),
  },
  mod_lesson_get_user_grade: {
    fixtures: ["MOODLE_FIXTURE_LESSON_ID", "MOODLE_FIXTURE_USER_ID"],
    expectedShape: "object",
    parameters: fixtures => ({
      lessonid: fixtures.MOODLE_FIXTURE_LESSON_ID,
      userid: fixtures.MOODLE_FIXTURE_USER_ID,
    }),
    count: payload => ownFieldCount(payload, "grade"),
  },
  mod_book_get_books_by_courses: {
    fixtures: ["MOODLE_FIXTURE_COURSE_ID"],
    expectedShape: "object",
    parameters: fixtures => ({
      courseids: [fixtures.MOODLE_FIXTURE_COURSE_ID],
    }),
    count: payload => collectionCount(payload, "books"),
  },
  mod_page_get_pages_by_courses: {
    fixtures: ["MOODLE_FIXTURE_COURSE_ID"],
    expectedShape: "object",
    parameters: fixtures => ({
      courseids: [fixtures.MOODLE_FIXTURE_COURSE_ID],
    }),
    count: payload => collectionCount(payload, "pages"),
  },
  mod_resource_get_resources_by_courses: {
    fixtures: ["MOODLE_FIXTURE_COURSE_ID"],
    expectedShape: "object",
    parameters: fixtures => ({
      courseids: [fixtures.MOODLE_FIXTURE_COURSE_ID],
    }),
    count: payload => collectionCount(payload, "resources"),
  },
  mod_url_get_urls_by_courses: {
    fixtures: ["MOODLE_FIXTURE_COURSE_ID"],
    expectedShape: "object",
    parameters: fixtures => ({
      courseids: [fixtures.MOODLE_FIXTURE_COURSE_ID],
    }),
    count: payload => collectionCount(payload, "urls"),
  },
} satisfies Record<MoodleReadFunction, FunctionSpec>;

function payloadShape(payload: unknown): PayloadShape | null {
  if (Array.isArray(payload)) return "array";
  return isRecord(payload) ? "object" : null;
}

function parseFixtureEnvironment(env: NodeJS.ProcessEnv) {
  const values: Partial<FixtureValues> = {};
  const issues = new Map<FixtureEnvironment, FixtureIssue>();

  for (const name of fixtureEnvironments) {
    const raw = env[name]?.trim() ?? "";
    if (!raw) {
      issues.set(name, "missing");
      continue;
    }
    if (!/^[1-9]\d*$/.test(raw)) {
      issues.set(name, "invalid");
      continue;
    }

    const value = Number(raw);
    const maximum =
      name === "MOODLE_FIXTURE_SCORM_ATTEMPT_NUMBER"
        ? MAX_SCORM_ATTEMPT_NUMBER
        : MAX_MOODLE_ID;
    if (!Number.isSafeInteger(value) || value > maximum) {
      issues.set(name, "invalid");
      continue;
    }
    values[name] = value;
  }

  return { values, issues };
}

function fixtureErrorCode(
  fixtures: readonly FixtureEnvironment[],
  issues: ReadonlyMap<FixtureEnvironment, FixtureIssue>
): SummaryErrorCode | null {
  const affected = fixtures
    .map(name => ({ name, issue: issues.get(name) }))
    .filter(
      (entry): entry is { name: FixtureEnvironment; issue: FixtureIssue } =>
        Boolean(entry.issue)
    );
  if (!affected.length) return null;

  const issue = affected.some(entry => entry.issue === "invalid")
    ? "invalid"
    : "missing";
  return `fixture_${issue}:${affected.map(entry => entry.name).join(",")}`;
}

function sanitizedErrorCode(error: unknown): MoodleErrorCode {
  return error instanceof MoodleApiError ? error.code : "invalid_response";
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!isRecord(value)) return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort((left, right) => left.localeCompare(right))
      .map(key => [key, canonicalize(value[key])])
  );
}

function fingerprintSortKey(value: unknown) {
  if (isRecord(value) && typeof value.sourceId === "string") {
    return `source:${value.sourceId}`;
  }
  return `value:${JSON.stringify(canonicalize(value))}`;
}

function sortTrueSet(value: unknown) {
  if (!Array.isArray(value)) return value;
  return [...value]
    .map(canonicalize)
    .sort((left, right) =>
      fingerprintSortKey(left).localeCompare(fingerprintSortKey(right))
    );
}

const topLevelTrueSetFunctions = new Set<MoodleReadFunction>([
  "core_course_get_categories",
  "core_course_get_courses_by_field",
  "core_enrol_get_enrolled_users",
  "core_enrol_get_users_courses",
  "core_user_get_users_by_field",
  "core_group_get_course_groups",
  "core_group_get_course_groupings",
  "mod_quiz_get_quizzes_by_courses",
  "mod_h5pactivity_get_h5pactivities_by_courses",
  "mod_scorm_get_scorms_by_courses",
  "mod_lesson_get_lessons_by_courses",
  "mod_book_get_books_by_courses",
  "mod_page_get_pages_by_courses",
  "mod_resource_get_resources_by_courses",
  "mod_url_get_urls_by_courses",
]);

function normalizeProjectionForFingerprint(
  functionName: MoodleReadFunction,
  projection: unknown
) {
  if (topLevelTrueSetFunctions.has(functionName)) {
    return sortTrueSet(projection);
  }
  if (
    functionName === "core_group_get_course_user_groups" &&
    isRecord(projection)
  ) {
    return { ...projection, groups: sortTrueSet(projection.groups) };
  }
  if (functionName === "mod_h5pactivity_get_attempts" && isRecord(projection)) {
    return { ...projection, users: sortTrueSet(projection.users) };
  }
  return projection;
}

function sanitizedFingerprint(domain: string, value: unknown) {
  return crypto
    .createHash("sha256")
    .update(`${domain}\0${JSON.stringify(canonicalize(value))}`)
    .digest("hex");
}

function functionFamily(functionName: MoodleReadFunction) {
  if (
    functionName.startsWith("mod_h5pactivity_") ||
    functionName.startsWith("mod_scorm_")
  ) {
    return "interactive_content";
  }
  if (
    functionName.startsWith("mod_assign_") ||
    functionName.startsWith("mod_quiz_") ||
    functionName.startsWith("mod_lesson_") ||
    functionName.startsWith("gradereport_") ||
    functionName.startsWith("core_completion_")
  ) {
    return "progress_outcomes";
  }
  if (
    functionName.startsWith("core_course_") ||
    functionName.startsWith("mod_book_") ||
    functionName.startsWith("mod_page_") ||
    functionName.startsWith("mod_resource_") ||
    functionName.startsWith("mod_url_")
  ) {
    return "course_content";
  }
  return "identity_access";
}

function finalizeValidation(
  exitCode: 0 | 1 | 2,
  results: FunctionSummary[],
  successfulFingerprints: ReadonlyMap<MoodleReadFunction, string>
): MoodleSandboxReadValidationResult {
  const functions = Object.fromEntries(
    MOODLE_READ_FUNCTIONS.map(functionName => [
      functionName,
      successfulFingerprints.get(functionName) ?? null,
    ])
  ) as Record<MoodleReadFunction, string | null>;
  const families = Object.fromEntries(
    [...new Set(MOODLE_READ_FUNCTIONS.map(functionFamily))]
      .sort((left, right) => left.localeCompare(right))
      .map(family => {
        const familyResults = results.filter(
          result => functionFamily(result.function) === family
        );
        if (
          !familyResults.length ||
          familyResults.some(
            result => !result.ok || functions[result.function] === null
          )
        ) {
          return [family, null];
        }
        const entries = familyResults
          .map(result => ({
            function: result.function,
            fingerprint: functions[result.function],
          }))
          .sort((left, right) => left.function.localeCompare(right.function));
        return [
          family,
          sanitizedFingerprint(
            `${FINGERPRINT_VERSION}:family:${family}`,
            entries
          ),
        ];
      })
  ) as Record<string, string | null>;
  const complete =
    exitCode === 0 &&
    results.length === MOODLE_READ_FUNCTIONS.length &&
    results.every(result => result.ok) &&
    Object.values(families).every(Boolean);
  return {
    exitCode,
    results,
    fingerprints: {
      functions,
      families,
      combined: complete
        ? sanitizedFingerprint(`${FINGERPRINT_VERSION}:combined`, families)
        : null,
    },
  };
}

function notRunSummaries(errorCode: SummaryErrorCode): FunctionSummary[] {
  return MOODLE_READ_FUNCTIONS.map(functionName => ({
    function: functionName,
    ok: false,
    errorCode,
    count: null,
    shape: null,
  }));
}

function emit(result: MoodleSandboxReadValidationResult) {
  const passed = result.results.filter(item => item.ok).length;
  process.stdout.write(
    `${JSON.stringify(
      {
        ok: result.exitCode === 0,
        mode: "read_only",
        functionCount: MOODLE_READ_FUNCTIONS.length,
        passed,
        failed: result.results.length - passed,
        results: result.results,
        fingerprints: result.fingerprints,
      },
      null,
      2
    )}\n`
  );
  process.exitCode = result.exitCode;
}

function configurationErrorCode(env: NodeJS.ProcessEnv): SummaryErrorCode {
  const missing = [
    ["MOODLE_READ_ONLY_ENABLED", env.MOODLE_READ_ONLY_ENABLED === "1"],
    ["MOODLE_BASE_URL", Boolean(env.MOODLE_BASE_URL?.trim())],
    ["MOODLE_SERVICE", Boolean(env.MOODLE_SERVICE?.trim())],
    ["MOODLE_TOKEN", Boolean(env.MOODLE_TOKEN?.trim())],
    ["MOODLE_ALLOWED_HOSTS", Boolean(env.MOODLE_ALLOWED_HOSTS?.trim())],
  ]
    .filter(([, configured]) => !configured)
    .map(([name]) => name);
  return missing.length
    ? (`configuration:${missing.join(",")}` as SummaryErrorCode)
    : "configuration";
}

export async function runMoodleSandboxReadValidation(
  env: NodeJS.ProcessEnv = process.env,
  dependencies: ValidationDependencies = {}
): Promise<MoodleSandboxReadValidationResult> {
  const successfulFingerprints = new Map<MoodleReadFunction, string>();
  if (!getMoodleServerStatus(env).configured) {
    return finalizeValidation(
      1,
      notRunSummaries(configurationErrorCode(env)),
      successfulFingerprints
    );
  }

  let client: ReadClient;
  try {
    client = (dependencies.createClient ?? createMoodleClientFromEnvironment)(
      env
    );
  } catch (error) {
    return finalizeValidation(
      1,
      notRunSummaries(sanitizedErrorCode(error)),
      successfulFingerprints
    );
  }

  const results: FunctionSummary[] = [];
  try {
    const probe = await client.probe();
    results.push({
      function: "core_webservice_get_site_info",
      ok: probe.minimumPrivilegeVerified,
      errorCode: probe.minimumPrivilegeVerified ? null : "permission",
      count: probe.availableFunctionCount,
      shape: "object",
    });

    if (probe.minimumPrivilegeVerified) {
      successfulFingerprints.set(
        "core_webservice_get_site_info",
        sanitizedFingerprint(
          `${FINGERPRINT_VERSION}:function:core_webservice_get_site_info`,
          {
            availableFunctionCount: probe.availableFunctionCount,
            approvedFunctionCount: probe.approvedFunctionCount,
            missingApprovedFunctions: [
              ...probe.missingApprovedFunctions,
            ].sort(),
            unexpectedFunctions: [...probe.unexpectedFunctions].sort(),
            minimumPrivilegeVerified: probe.minimumPrivilegeVerified,
          }
        )
      );
    }

    if (!probe.minimumPrivilegeVerified) {
      const missing = new Set(probe.missingApprovedFunctions);
      for (const functionName of MOODLE_READ_FUNCTIONS.slice(1)) {
        results.push({
          function: functionName,
          ok: false,
          errorCode: missing.has(functionName)
            ? "permission"
            : "not_run_after_probe",
          count: null,
          shape: null,
        });
      }
      return finalizeValidation(1, results, successfulFingerprints);
    }
  } catch (error) {
    const errorCode = sanitizedErrorCode(error);
    results.push({
      function: "core_webservice_get_site_info",
      ok: false,
      errorCode,
      count: null,
      shape: null,
    });
    for (const functionName of MOODLE_READ_FUNCTIONS.slice(1)) {
      results.push({
        function: functionName,
        ok: false,
        errorCode: "not_run_after_probe",
        count: null,
        shape: null,
      });
    }
    return finalizeValidation(1, results, successfulFingerprints);
  }

  const fixtures = parseFixtureEnvironment(env);
  let hasUnexpectedFailure = false;
  let hasFixtureFailure = false;

  const parseResponse = dependencies.parseResponse ?? parseMoodleReadResponse;
  for (const functionName of MOODLE_PROJECTION_FUNCTIONS) {
    const spec = functionSpecs[functionName];
    const fixtureError = fixtureErrorCode(spec.fixtures, fixtures.issues);
    if (fixtureError) {
      hasFixtureFailure = true;
      results.push({
        function: functionName,
        ok: false,
        errorCode: fixtureError,
        count: null,
        shape: null,
      });
      continue;
    }

    try {
      const payload = await client.call(
        functionName,
        spec.parameters(fixtures.values as FixtureValues)
      );
      const projection = parseResponse(functionName, payload);
      assertSanitizedProjection(projection);
      const shape = payloadShape(payload);
      const count = spec.count(payload);
      if (shape !== spec.expectedShape || count === null) {
        hasUnexpectedFailure = true;
        results.push({
          function: functionName,
          ok: false,
          errorCode: "invalid_response",
          count,
          shape,
        });
        continue;
      }
      const fixtureMatch = spec.fixtureMatch?.(
        projection,
        fixtures.values as FixtureValues
      );
      if (fixtureMatch === "invalid_response") {
        hasUnexpectedFailure = true;
        results.push({
          function: functionName,
          ok: false,
          errorCode: "invalid_response",
          count,
          shape,
        });
        continue;
      }
      if (fixtureMatch === "fixture_absent") {
        hasFixtureFailure = true;
        results.push({
          function: functionName,
          ok: false,
          errorCode: "fixture_absent",
          count,
          shape,
        });
        continue;
      }
      if (count === 0 || warningCount(payload) > 0) {
        hasFixtureFailure = true;
        results.push({
          function: functionName,
          ok: false,
          errorCode: "fixture_absent",
          count,
          shape,
        });
        continue;
      }
      successfulFingerprints.set(
        functionName,
        sanitizedFingerprint(
          `${FINGERPRINT_VERSION}:function:${functionName}`,
          normalizeProjectionForFingerprint(functionName, projection)
        )
      );
      results.push({
        function: functionName,
        ok: true,
        errorCode: null,
        count,
        shape,
      });
    } catch (error) {
      hasUnexpectedFailure = true;
      results.push({
        function: functionName,
        ok: false,
        errorCode: sanitizedErrorCode(error),
        count: null,
        shape: null,
      });
    }
  }

  return finalizeValidation(
    hasUnexpectedFailure ? 1 : hasFixtureFailure ? 2 : 0,
    results,
    successfulFingerprints
  );
}

async function main() {
  try {
    const result = await runMoodleSandboxReadValidation();
    emit(result);
  } catch {
    emit(
      finalizeValidation(
        1,
        notRunSummaries("invalid_response"),
        new Map<MoodleReadFunction, string>()
      )
    );
  }
}

const entry = process.argv[1];
if (entry && pathToFileURL(resolve(entry)).href === import.meta.url) {
  void main();
}
