import {
  normalizeEmsAttendanceDetail,
  normalizeEmsAttendanceSessions,
  normalizeEmsClassSync,
  normalizeEmsCourseStatistics,
  normalizeEmsHourCellPatch,
  normalizeEmsHourCellRange,
  type EmsStagingHourCellOp,
  normalizeEmsClass,
  normalizeEmsClasses,
  normalizeEmsClassEnrolments,
  normalizeEmsEnrolment,
  normalizeEmsClassGrades,
  normalizeEmsCourses,
  normalizeEmsLead,
  normalizeEmsLeads,
  normalizeEmsLeadGroup,
  normalizeEmsLeadGroups,
  normalizeEmsTrialLesson,
  normalizeEmsStudentLearning,
  normalizeEmsStudentReport,
  normalizeEmsAssignee,
  normalizeEmsPage,
  type EmsStagingListQuery,
  normalizeEmsCourse,
  normalizeEmsMoodleCoursePicker,
  normalizeEmsMoodleGroups,
  normalizeEmsMoodleSite,
  normalizeEmsMoodleSiteTest,
  normalizeEmsMoodleUsers,
  normalizeEmsRoom,
  normalizeEmsPlacementTest,
  normalizeEmsPlacementTests,
  normalizeEmsRooms,
  normalizeEmsSession,
  normalizeEmsSessionBatch,
  normalizeEmsSessionSlots,
  normalizeEmsSessions,
  normalizeEmsStudent,
  normalizeEmsStudentEnrolments,
  normalizeEmsStudents,
  normalizeEmsAuditEvents,
  normalizeEmsDashboardSummary,
  normalizeEmsNotification,
  normalizeEmsNotifications,
  normalizeEmsNotificationUnreadCount,
  normalizeEmsNotificationsDeleted,
  normalizeEmsNotificationsMarkedRead,
  isEmsStagingRole,
  type EmsStagingRole,
  normalizeEmsSystemHealth,
  normalizeEmsTeacherWorkspace,
  type EmsStagingAttendanceDetail,
  type EmsStagingClass,
  type EmsStagingClassEnrolment,
  type EmsStagingClassGrades,
  type EmsStagingCourse,
  type EmsStagingLead,
  type EmsStagingMoodleSite,
  type EmsStagingMoodleSiteTest,
  type EmsStagingMoodleUser,
  type EmsStagingMoodleCoursePicker,
  type EmsStagingMoodleGroup,
  type EmsStagingPlacementTest,
  type EmsStagingRoom,
  type EmsStagingSession,
  type EmsStagingStudent,
  type EmsStagingStudentEnrolment,
  EMS_AUDIT_STREAMS,
  type EmsStagingAuditEvent,
  type EmsStagingAuditStream,
  type EmsStagingDashboardSummary,
  type EmsStagingNotification,
  type EmsStagingSystemHealth,
  type EmsStagingTeacherWorkspace,
} from "./emsStagingClient.js";
import { sessionDto } from "./auth.js";
import {
  getNccRequestSession,
  getNccSessionScopeOptions,
  hasNccAuthCookie,
  isSwitchableEmsRole,
  listNccAuthSessions,
  logoutAllNccSessions,
  nccMoodleAccountWritesEnabled,
  nccStaffAuthEnabled,
  revokeNccAuthSession,
  runNccRead,
  runNccWrite,
  sendNccAuthError,
  setNccSessionScopes,
  switchNccEmsRole,
  type NccAuthDependencies,
  type RemoteResult,
} from "./nccAuthSession.js";

type OperationalRequest = {
  headers: { cookie?: string };
  params?: Record<string, string>;
  query?: Record<string, unknown>;
  body?: Record<string, unknown>;
};

type OperationalResponse = {
  setHeader(name: string, value: string): void;
  status(code: number): OperationalResponse;
  json(body: unknown): void;
};

type OperationalHandler = (
  request: OperationalRequest,
  response: OperationalResponse
) => void | Promise<void>;

type OperationalApp = {
  get(path: string, handler: OperationalHandler): void;
  post?(path: string, handler: OperationalHandler): void;
  patch?(path: string, handler: OperationalHandler): void;
  put?(path: string, handler: OperationalHandler): void;
  delete?(path: string, handler: OperationalHandler): void;
};

type OperationalFamily =
  | "admissions"
  | "delivery"
  | "system"
  | "dashboard"
  | "audit"
  | "notifications";

export function nccAdmissionsReadsEnabled(
  env: NodeJS.ProcessEnv = process.env
) {
  return ["1", "true"].includes(
    (env.NILE_NCC_ADMISSIONS_READS_ENABLED ?? "").trim().toLowerCase()
  );
}

export function nccDeliveryReadsEnabled(env: NodeJS.ProcessEnv = process.env) {
  return ["1", "true"].includes(
    (env.NILE_NCC_DELIVERY_READS_ENABLED ?? "").trim().toLowerCase()
  );
}

export function nccSystemReadsEnabled(env: NodeJS.ProcessEnv = process.env) {
  return ["1", "true"].includes(
    (env.NILE_NCC_SYSTEM_READS_ENABLED ?? "").trim().toLowerCase()
  );
}

export function nccDashboardReadsEnabled(
  env: NodeJS.ProcessEnv = process.env
) {
  return ["1", "true"].includes(
    (env.NILE_NCC_DASHBOARD_READS_ENABLED ?? "").trim().toLowerCase()
  );
}

export function nccAuditReadsEnabled(env: NodeJS.ProcessEnv = process.env) {
  return ["1", "true"].includes(
    (env.NILE_NCC_AUDIT_READS_ENABLED ?? "").trim().toLowerCase()
  );
}

export function nccNotificationsEnabled(
  env: NodeJS.ProcessEnv = process.env
) {
  return ["1", "true"].includes(
    (env.NILE_NCC_NOTIFICATIONS_ENABLED ?? "").trim().toLowerCase()
  );
}

export function nccDeliveryWritesEnabled(
  env: NodeJS.ProcessEnv = process.env
) {
  return ["1", "true"].includes(
    (env.NILE_NCC_DELIVERY_WRITES_ENABLED ?? "").trim().toLowerCase()
  );
}

export function nccAdmissionsWritesEnabled(
  env: NodeJS.ProcessEnv = process.env
) {
  return ["1", "true"].includes(
    (env.NILE_NCC_ADMISSIONS_WRITES_ENABLED ?? "").trim().toLowerCase()
  );
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasOnlyKeys(record: Record<string, unknown>, allowed: string[]) {
  return Object.keys(record).find(key => !allowed.includes(key));
}

const LEAD_PATCH_STATUSES = [
  "in_process",
  "follow_up",
  "future_registration",
  "placement_test",
  "trial_lesson",
  "registered",
  "lost",
];
const LEAD_ENTRY_PATHS = ["direct", "placement", "trial", "unset"];
const STUDENT_GENDERS = ["male", "female"];

function readGuardians(
  value: unknown
):
  | Array<{
      sortOrder: 1 | 2;
      name: string;
      phone: string;
      email: string;
      relationship: string;
    }>
  | null {
  if (!Array.isArray(value) || value.length > 2) return null;
  const orders = new Set<number>();
  const rows: Array<{
    sortOrder: 1 | 2;
    name: string;
    phone: string;
    email: string;
    relationship: string;
  }> = [];
  for (const row of value) {
    if (
      !isPlainObject(row) ||
      hasOnlyKeys(row, [
        "sortOrder",
        "name",
        "phone",
        "email",
        "relationship",
      ]) !== undefined ||
      (row.sortOrder !== 1 && row.sortOrder !== 2) ||
      orders.has(row.sortOrder) ||
      typeof row.name !== "string" ||
      !row.name.trim() ||
      typeof row.phone !== "string" ||
      !row.phone.trim() ||
      typeof row.email !== "string" ||
      !row.email.trim() ||
      typeof row.relationship !== "string" ||
      !row.relationship.trim()
    ) {
      return null;
    }
    orders.add(row.sortOrder);
    rows.push({
      sortOrder: row.sortOrder,
      name: row.name,
      phone: row.phone,
      email: row.email,
      relationship: row.relationship,
    });
  }
  return rows;
}

function guardiansUpstream(
  rows: Array<{
    sortOrder: 1 | 2;
    name: string;
    phone: string;
    email: string;
    relationship: string;
  }>
) {
  return rows.map(row => ({
    sort_order: row.sortOrder,
    name: row.name,
    phone: row.phone,
    email: row.email,
    relationship: row.relationship,
  }));
}

function identityError(
  body: Record<string, unknown>,
  requireAll: boolean
): string | null {
  const required = ["nationality", "address", "gender", "dateOfBirth"] as const;
  if (requireAll) {
    for (const key of required) {
      if (body[key] === undefined || body[key] === null) {
        return `${key} is required.`;
      }
    }
  }
  if (
    body.nationality !== undefined &&
    body.nationality !== null &&
    (typeof body.nationality !== "string" || !/^\w{3}$/.test(body.nationality))
  ) {
    return "nationality is invalid.";
  }
  if (
    body.address !== undefined &&
    body.address !== null &&
    (typeof body.address !== "string" || !body.address.trim())
  ) {
    return "address is invalid.";
  }
  if (
    body.gender !== undefined &&
    body.gender !== null &&
    !STUDENT_GENDERS.includes(String(body.gender))
  ) {
    return "gender is invalid.";
  }
  if (
    body.dateOfBirth !== undefined &&
    body.dateOfBirth !== null &&
    (typeof body.dateOfBirth !== "string" || !body.dateOfBirth)
  ) {
    return "dateOfBirth is invalid.";
  }
  if (
    body.phone !== undefined &&
    body.phone !== null &&
    typeof body.phone !== "string"
  ) {
    return "phone is invalid.";
  }
  if (
    body.passportNumber !== undefined &&
    body.passportNumber !== null &&
    (typeof body.passportNumber !== "string" ||
      body.passportNumber.length < 1 ||
      body.passportNumber.length > 32)
  ) {
    return "passportNumber is invalid.";
  }
  if (
    body.nationalId !== undefined &&
    body.nationalId !== null &&
    (typeof body.nationalId !== "string" || !/^\d{14}$/.test(body.nationalId))
  ) {
    return "nationalId is invalid.";
  }
  return null;
}

function identityUpstream(body: Record<string, unknown>) {
  return {
    ...(body.nationality !== undefined
      ? { nationality: body.nationality }
      : {}),
    ...(body.address !== undefined ? { address: body.address } : {}),
    ...(body.gender !== undefined ? { gender: body.gender } : {}),
    ...(body.dateOfBirth !== undefined
      ? { date_of_birth: body.dateOfBirth }
      : {}),
    ...(body.phone !== undefined ? { phone: body.phone } : {}),
    ...(body.passportNumber !== undefined
      ? { passport_number: body.passportNumber }
      : {}),
    ...(body.nationalId !== undefined
      ? { national_id: body.nationalId }
      : {}),
    ...(body.guardians !== undefined
      ? { guardians: guardiansUpstream(readGuardians(body.guardians) ?? []) }
      : {}),
  };
}

const LEAD_TYPES = ["new", "old", "old_student", "current_student"];
const BOOKING_STATUSES = ["scheduled", "completed", "cancelled", "no_show"];
const ENROLMENT_LIST_STATUSES = [
  "fill",
  "waiting",
  "pending",
  "pending_payment",
  "pending_class",
  "pending_group",
  "enrolled",
  "cancelled",
  "completed",
  "left",
  "all",
];
const LEAD_REFERENCE_KEYS = [
  "leadType",
  "lostReasonId",
  "lostActionReasonId",
  "areaOfStudyId",
  "assignedSsaId",
] as const;

function leadReferenceError(body: Record<string, unknown>): string | null {
  if (
    body.leadType !== undefined &&
    !LEAD_TYPES.includes(String(body.leadType))
  ) {
    return "leadType is invalid.";
  }
  for (const key of [
    "lostReasonId",
    "lostActionReasonId",
    "areaOfStudyId",
    "assignedSsaId",
  ] as const) {
    const value = body[key];
    if (
      value !== undefined &&
      value !== null &&
      (typeof value !== "string" || !value.trim())
    ) {
      return `${key} is invalid.`;
    }
  }
  return null;
}

function leadReferenceUpstream(body: Record<string, unknown>) {
  const upstream: Record<string, unknown> = {};
  for (const [source, target] of [
    ["leadType", "lead_type"],
    ["lostReasonId", "lost_reason_id"],
    ["lostActionReasonId", "lost_action_reason_id"],
    ["areaOfStudyId", "area_of_study_id"],
    ["assignedSsaId", "assigned_ssa_id"],
  ] as const) {
    if (body[source] !== undefined) upstream[target] = body[source];
  }
  return upstream;
}

/** Money fields: finite, non-negative, at most two decimals. */
function isMoney(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= 1_000_000_000 &&
    Math.round(value * 100) === value * 100
  );
}

/** `{ toBePaid, paid? }` registration or sale amounts. */
function readAmounts(
  value: unknown,
  { requireToBePaid }: { requireToBePaid: boolean }
): { to_be_paid?: number; paid?: number } | string {
  if (!isPlainObject(value)) return "Amounts are required.";
  const unknown = hasOnlyKeys(value, ["toBePaid", "paid"]);
  if (unknown) return `${unknown} is not allowed.`;
  if (value.toBePaid === undefined) {
    if (requireToBePaid) return "toBePaid is required.";
  } else if (!isMoney(value.toBePaid)) {
    return "toBePaid is invalid.";
  }
  if (value.paid !== undefined && value.paid !== null && !isMoney(value.paid)) {
    return "paid is invalid.";
  }
  if (
    isMoney(value.toBePaid) &&
    isMoney(value.paid) &&
    value.paid > value.toBePaid
  ) {
    return "paid cannot exceed toBePaid.";
  }
  return {
    ...(value.toBePaid !== undefined ? { to_be_paid: value.toBePaid } : {}),
    ...(isMoney(value.paid) ? { paid: value.paid } : {}),
  };
}

function isHttpsUrl(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 2000) return false;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

type ListParam = {
  /** Browser query name (camelCase). */
  name: string;
  /** EMS query name. */
  ems: string;
  kind: "string" | "array" | "boolean" | "enum";
  values?: readonly string[];
};

const PAGING_KEYS = ["q", "page", "pageSize", "sort", "order"];

/**
 * Validates browser list filters against an allowlist and maps them to EMS
 * query names. Unknown filters are rejected instead of silently dropped.
 */
function readListQuery(
  request: OperationalRequest,
  response: OperationalResponse,
  params: ListParam[]
): EmsStagingListQuery | null {
  const query = request.query ?? {};
  const out: EmsStagingListQuery = {};
  const fail = (key: string) => {
    response.status(400).json({ error: `${key} is invalid.` });
    return null;
  };
  for (const key of Object.keys(query)) {
    if (!PAGING_KEYS.includes(key) && !params.some(param => param.name === key)) {
      response.status(400).json({ error: `${key} is not a supported filter.` });
      return null;
    }
  }
  const single = (key: string) => {
    const value = query[key];
    return Array.isArray(value) ? undefined : value;
  };
  if (query.q !== undefined) {
    const q = single("q");
    if (typeof q !== "string" || q.length > 200) return fail("q");
    if (q.trim()) out.q = q.trim();
  }
  for (const [key, ems, max] of [
    ["page", "page", 100_000],
    ["pageSize", "page_size", 100],
  ] as const) {
    if (query[key] === undefined) continue;
    const value = Number(single(key));
    if (!Number.isSafeInteger(value) || value < 1 || value > max) {
      return fail(key);
    }
    out[ems] = value;
  }
  if (query.sort !== undefined) {
    const sort = single("sort");
    if (typeof sort !== "string" || !/^[a-z_]{1,40}$/.test(sort)) {
      return fail("sort");
    }
    out.sort = sort;
  }
  if (query.order !== undefined) {
    const order = single("order");
    if (order !== "asc" && order !== "desc") return fail("order");
    out.order = order;
  }
  for (const param of params) {
    const raw = query[param.name];
    if (raw === undefined) continue;
    if (param.kind === "array") {
      const values = (Array.isArray(raw) ? raw : String(raw).split(","))
        .map(item => String(item).trim())
        .filter(Boolean);
      if (values.length === 0 || values.length > 50) return fail(param.name);
      if (param.values && values.some(item => !param.values!.includes(item))) {
        return fail(param.name);
      }
      out[param.ems] = values;
      continue;
    }
    const value = single(param.name);
    if (typeof value !== "string" || !value.trim()) return fail(param.name);
    if (param.kind === "boolean") {
      if (value !== "true" && value !== "false") return fail(param.name);
      out[param.ems] = value === "true";
    } else if (param.kind === "enum") {
      if (!param.values?.includes(value)) return fail(param.name);
      out[param.ems] = value;
    } else {
      out[param.ems] = value.trim();
    }
  }
  return out;
}

function pageBody<T>(page: {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}) {
  return {
    items: page.items,
    total: page.total,
    page: page.page,
    pageSize: page.pageSize,
  };
}

/**
 * Runs one NCC write, normalizes the payload, and replies `{ [key]: value }`
 * (plus any one-time secrets). Shared by the admissions write routes.
 */
async function sendNccWrite<T>(
  request: OperationalRequest,
  response: OperationalResponse,
  dependencies: NccAuthDependencies,
  operation: Parameters<typeof runNccWrite>[2],
  normalize: (payload: unknown) => T | null,
  key: string,
  oneTime?: (payload: Record<string, unknown>) => Record<string, unknown> | null
) {
  try {
    const payload = await runNccWrite(request, response, operation, dependencies);
    const value = normalize(payload);
    if (!value) {
      response
        .status(502)
        .json({ error: "NCC EMS returned invalid admissions data." });
      return;
    }
    const secrets =
      oneTime && isPlainObject(payload) ? oneTime(payload) : null;
    response.json({ [key]: value, ...(secrets ? { oneTime: secrets } : {}) });
  } catch (error) {
    if (!sendNccAuthError(error, response)) throw error;
  }
}

/** Placement and trial bookings share a subject + schedule shape. */
function bookingBody(
  body: Record<string, unknown>,
  allowed: string[],
  { create }: { create: boolean }
): Record<string, unknown> | string {
  const unknown = hasOnlyKeys(body, allowed);
  if (unknown) return `${unknown} is not allowed.`;
  const upstream: Record<string, unknown> = {};
  if (create) {
    if (
      !isPlainObject(body.subject) ||
      hasOnlyKeys(body.subject, ["type", "id"]) !== undefined ||
      (body.subject.type !== "lead" && body.subject.type !== "student") ||
      !isNonBlankString(body.subject.id)
    ) {
      return "subject is required.";
    }
    upstream[body.subject.type === "lead" ? "lead_id" : "student_id"] =
      body.subject.id;
  }
  if (create || body.scheduledAt !== undefined) {
    if (!isValidDateTime(body.scheduledAt)) return "scheduledAt is required.";
    upstream.scheduled_at = body.scheduledAt;
  }
  for (const [source, target] of [
    ["roomId", "room_id"],
    ["areaOfStudyId", "area_of_study_id"],
    ["courseId", "course_id"],
  ] as const) {
    const value = body[source];
    if (value === undefined) continue;
    if (value !== null && !isNonBlankString(value)) return `${source} is invalid.`;
    upstream[target] = value;
  }
  if (body.meetingUrl !== undefined) {
    if (body.meetingUrl !== null && !isHttpsUrl(body.meetingUrl)) {
      return "meetingUrl must be an https URL.";
    }
    upstream.meeting_url = body.meetingUrl;
  }
  if (body.placementMoodleCourseId !== undefined) {
    if (
      body.placementMoodleCourseId !== null &&
      !isPositiveInteger(body.placementMoodleCourseId)
    ) {
      return "placementMoodleCourseId is invalid.";
    }
    upstream.placement_moodle_course_id = body.placementMoodleCourseId;
  }
  if (body.status !== undefined) {
    if (body.status !== "no_show") return "status is invalid.";
    upstream.status = "no_show";
  }
  return upstream;
}

function prepareAdmissionsWrite(
  request: OperationalRequest,
  response: OperationalResponse,
  dependencies: NccAuthDependencies
) {
  response.setHeader("Cache-Control", "private, no-store");
  const env = dependencies.env ?? process.env;
  if (!nccAdmissionsWritesEnabled(env)) {
    response
      .status(503)
      .json({ error: "NCC admissions writes are not active." });
    return false;
  }
  if (!nccStaffAuthEnabled(env) || !hasNccAuthCookie(request)) {
    response
      .status(404)
      .json({ error: "EMS data is unavailable for this session." });
    return false;
  }
  return true;
}

function prepareMoodleAccount(
  request: OperationalRequest,
  response: OperationalResponse,
  dependencies: NccAuthDependencies
) {
  response.setHeader("Cache-Control", "private, no-store");
  const env = dependencies.env ?? process.env;
  if (!nccMoodleAccountWritesEnabled(env)) {
    response
      .status(503)
      .json({ error: "NCC Moodle account operations are not active." });
    return false;
  }
  if (!nccStaffAuthEnabled(env) || !hasNccAuthCookie(request)) {
    response
      .status(404)
      .json({ error: "EMS data is unavailable for this session." });
    return false;
  }
  return true;
}

function moodleBindBody(body: unknown) {
  if (
    !isPlainObject(body) ||
    hasOnlyKeys(body, ["mode", "moodleUserId"]) ||
    (body.mode !== "create" && body.mode !== "link")
  ) {
    return null;
  }
  if (body.mode === "create") {
    return body.moodleUserId === undefined ? { mode: "create" as const } : null;
  }
  if (
    !Number.isSafeInteger(body.moodleUserId) ||
    (body.moodleUserId as number) < 1
  ) {
    return null;
  }
  return {
    mode: "link" as const,
    moodleUserId: body.moodleUserId as number,
  };
}

function moodleGeneratedPassword(
  payload: Record<string, unknown>,
  required: boolean
) {
  const generated = payload.generated_moodle_password;
  if (generated === undefined || generated === null) {
    return required ? null : { password: null };
  }
  if (typeof generated !== "string" || !generated) {
    return null;
  }
  return { password: generated };
}

/** Placement bookings may create a Moodle login for the test taker. */
function placementSecrets(payload: Record<string, unknown>) {
  const generated = payload.generated_moodle_password;
  return typeof generated === "string" && generated
    ? { generatedMoodlePassword: generated }
    : null;
}

function prepareDeliveryWrite(
  request: OperationalRequest,
  response: OperationalResponse,
  dependencies: NccAuthDependencies
) {
  response.setHeader("Cache-Control", "private, no-store");
  const env = dependencies.env ?? process.env;
  if (!nccDeliveryWritesEnabled(env)) {
    response
      .status(503)
      .json({ error: "NCC delivery writes are not active." });
    return false;
  }
  if (!nccStaffAuthEnabled(env) || !hasNccAuthCookie(request)) {
    response
      .status(404)
      .json({ error: "EMS data is unavailable for this session." });
    return false;
  }
  return true;
}

function prepareNotificationsWrite(
  request: OperationalRequest,
  response: OperationalResponse,
  dependencies: NccAuthDependencies
) {
  response.setHeader("Cache-Control", "private, no-store");
  const env = dependencies.env ?? process.env;
  if (!nccNotificationsEnabled(env)) {
    response
      .status(503)
      .json({ error: "NCC notifications are not active." });
    return false;
  }
  if (!nccStaffAuthEnabled(env) || !hasNccAuthCookie(request)) {
    response
      .status(404)
      .json({ error: "EMS data is unavailable for this session." });
    return false;
  }
  return true;
}

/**
 * Guard for staff-session BFF routes (role switching, session scopes,
 * auth-session management). Gated only by the staff-auth flag plus cookie.
 */
function prepareStaffAuth(
  request: OperationalRequest,
  response: OperationalResponse,
  dependencies: NccAuthDependencies
) {
  response.setHeader("Cache-Control", "private, no-store");
  response.setHeader("Vary", "Cookie");
  const env = dependencies.env ?? process.env;
  if (!nccStaffAuthEnabled(env) || !hasNccAuthCookie(request)) {
    response
      .status(404)
      .json({ error: "EMS data is unavailable for this session." });
    return false;
  }
  return true;
}

function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.every(item => typeof item === "string" && item.trim())
  );
}

function isNonBlankString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/** Disable/cancel actions require an action reason id in the body. */
function requireReasonId(
  request: OperationalRequest,
  response: OperationalResponse
): string | null {
  const body = request.body;
  if (
    !isPlainObject(body) ||
    hasOnlyKeys(body, ["reasonId"]) !== undefined ||
    !isNonBlankString(body.reasonId)
  ) {
    response.status(400).json({ error: "reasonId is required." });
    return null;
  }
  return body.reasonId.trim();
}

function isPositiveInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) > 0;
}

function isValidDateTime(value: unknown): value is string {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

const SCHEDULE_TIME = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;

function scheduleSeconds(value: string) {
  const [hours = 0, minutes = 0, seconds = 0] = value.split(":").map(Number);
  return hours * 3600 + minutes * 60 + seconds;
}

function parseScheduleInput(value: unknown) {
  if (value === undefined) return { state: "omitted" as const };
  if (value === null) return { state: "null" as const };
  if (
    !isPlainObject(value) ||
    hasOnlyKeys(value, ["daysOfWeek", "startTime", "endTime"]) ||
    !Array.isArray(value.daysOfWeek) ||
    !value.daysOfWeek.every(
      day => Number.isSafeInteger(day) && day >= 0 && day <= 6
    ) ||
    new Set(value.daysOfWeek).size !== value.daysOfWeek.length ||
    typeof value.startTime !== "string" ||
    !SCHEDULE_TIME.test(value.startTime) ||
    typeof value.endTime !== "string" ||
    !SCHEDULE_TIME.test(value.endTime) ||
    scheduleSeconds(value.endTime) <= scheduleSeconds(value.startTime)
  ) {
    return { state: "invalid" as const };
  }
  return {
    state: "value" as const,
    value: {
      daysOfWeek: value.daysOfWeek as number[],
      startTime: value.startTime,
      endTime: value.endTime,
    },
  };
}

function scheduleUpstream(
  parsed: ReturnType<typeof parseScheduleInput>
): Record<string, unknown> {
  if (parsed.state === "null") {
    return {
      schedule_days_of_week: null,
      schedule_start_time: null,
      schedule_end_time: null,
    };
  }
  if (parsed.state === "value") {
    return {
      schedule_days_of_week: parsed.value.daysOfWeek,
      schedule_start_time: parsed.value.startTime,
      schedule_end_time: parsed.value.endTime,
    };
  }
  return {};
}

function classMoodleBindBody(body: unknown) {
  if (
    !isPlainObject(body) ||
    hasOnlyKeys(body, ["mode", "moodleGroupId"]) ||
    (body.mode !== "create" && body.mode !== "link")
  ) {
    return null;
  }
  if (body.mode === "create") {
    return body.moodleGroupId === undefined
      ? { mode: "create" as const }
      : null;
  }
  if (!isPositiveInteger(body.moodleGroupId)) return null;
  return { mode: "link" as const, moodleGroupId: body.moodleGroupId };
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** `{ marks: [{ studentId, statusId }] }`, one mark per student. */
function attendanceMarksBody(
  body: unknown
): Array<{ student_id: string; status_id: number }> | null {
  if (
    !isPlainObject(body) ||
    hasOnlyKeys(body, ["marks"]) !== undefined ||
    !Array.isArray(body.marks)
  ) {
    return null;
  }
  const students = new Set<string>();
  const marks: Array<{ student_id: string; status_id: number }> = [];
  for (const mark of body.marks) {
    if (
      !isPlainObject(mark) ||
      hasOnlyKeys(mark, ["studentId", "statusId"]) !== undefined ||
      !isNonBlankString(mark.studentId) ||
      !isPositiveInteger(mark.statusId)
    ) {
      return null;
    }
    const studentId = mark.studentId.trim();
    if (students.has(studentId)) return null;
    students.add(studentId);
    marks.push({ student_id: studentId, status_id: mark.statusId as number });
  }
  return marks;
}

function isDateOnly(value: unknown): value is string {
  if (typeof value !== "string" || !DATE_ONLY.test(value)) return false;
  try {
    return (
      new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value
    );
  } catch {
    return false;
  }
}

function isEmptyBody(value: unknown) {
  return (
    value === undefined ||
    (isPlainObject(value) && Object.keys(value).length === 0)
  );
}

function sessionSlotsUpstream(value: unknown) {
  if (!Array.isArray(value) || value.length === 0) return null;
  const starts = new Set<string>();
  const rows: Array<Record<string, unknown>> = [];
  for (const slot of value) {
    if (
      !isPlainObject(slot) ||
      hasOnlyKeys(slot, [
        "startsAt",
        "durationHours",
        "teacherId",
        "roomId",
      ]) !== undefined ||
      !isValidDateTime(slot.startsAt) ||
      !isPositiveInteger(slot.durationHours) ||
      !isNonBlankString(slot.teacherId) ||
      (slot.roomId !== undefined &&
        slot.roomId !== null &&
        !isNonBlankString(slot.roomId)) ||
      starts.has(slot.startsAt as string)
    ) {
      return null;
    }
    starts.add(slot.startsAt as string);
    rows.push({
      starts_at: slot.startsAt,
      duration_hours: slot.durationHours,
      teacher_id: slot.teacherId.trim(),
      room_id:
        slot.roomId === undefined
          ? null
          : slot.roomId === null
            ? null
            : (slot.roomId as string).trim(),
    });
  }
  return rows;
}

function selectedBranchId(
  request: OperationalRequest,
  response: OperationalResponse,
  dependencies: NccAuthDependencies,
  bodyBranchId: unknown
) {
  const env = dependencies.env ?? process.env;
  const session = getNccRequestSession(request, env);
  if (
    session?.activeRole === "branchadmin" ||
    session?.activeRole === "registrar"
  ) {
    if (!session.workspaceBranchId) {
      response
        .status(400)
        .json({ error: "Choose a branch before creating records." });
      return null;
    }
    if (
      bodyBranchId !== undefined &&
      bodyBranchId !== session.workspaceBranchId
    ) {
      response
        .status(400)
        .json({ error: "branchId must match the selected branch." });
      return null;
    }
    return session.workspaceBranchId;
  }
  if (session?.activeRole === "superadmin") {
    if (typeof bodyBranchId !== "string" || !bodyBranchId) {
      response.status(400).json({ error: "branchId is required." });
      return null;
    }
    return bodyBranchId;
  }
  return typeof bodyBranchId === "string" ? bodyBranchId : undefined;
}

async function handleOperationalRead<T>(
  request: OperationalRequest,
  response: OperationalResponse,
  dependencies: NccAuthDependencies,
  family: OperationalFamily,
  operation: Parameters<typeof runNccRead>[2],
  normalize: (payload: unknown) => T | null,
  body: (value: T) => unknown
) {
  response.setHeader("Cache-Control", "private, no-store");
  response.setHeader("Vary", "Cookie");
  const env = dependencies.env ?? process.env;
  const enabled =
    family === "admissions"
      ? nccAdmissionsReadsEnabled(env)
      : family === "system"
        ? nccSystemReadsEnabled(env)
        : family === "dashboard"
          ? nccDashboardReadsEnabled(env)
          : family === "audit"
            ? nccAuditReadsEnabled(env)
            : family === "notifications"
              ? nccNotificationsEnabled(env)
              : nccDeliveryReadsEnabled(env);
  if (!enabled) {
    response.status(503).json({ error: `NCC ${family} reads are not active.` });
    return;
  }
  if (!nccStaffAuthEnabled(env) || !hasNccAuthCookie(request)) {
    response
      .status(404)
      .json({ error: "EMS data is unavailable for this session." });
    return;
  }
  try {
    const result = normalize(
      await runNccRead(request, response, operation, dependencies)
    );
    if (!result) {
      response
        .status(502)
        .json({ error: `NCC EMS returned invalid ${family} data.` });
      return;
    }
    response.json(body(result));
  } catch (error) {
    if (!sendNccAuthError(error, response)) throw error;
  }
}

export function registerNccOperationalRoutes(
  app: OperationalApp,
  dependencies: NccAuthDependencies = {}
) {
  app.get("/api/ncc/admissions/students", (request, response) => {
    const query = readListQuery(request, response, [
      { name: "homeBranchId", ems: "home_branch_id", kind: "array" },
      {
        name: "status",
        ems: "status",
        kind: "array",
        values: ["active", "disabled"],
      },
    ]);
    if (!query) return;
    return handleOperationalRead(
      request,
      response,
      dependencies,
      "admissions",
      (api, token) => api.students(token, query),
      payload => normalizeEmsPage(payload, normalizeEmsStudent),
      pageBody
    );
  });
  app.get("/api/ncc/admissions/students/:studentId", (request, response) =>
    handleOperationalRead<EmsStagingStudent>(
      request,
      response,
      dependencies,
      "admissions",
      (api, token) => api.student(token, request.params?.studentId ?? ""),
      normalizeEmsStudent,
      student => ({ student })
    )
  );
  app.get(
    "/api/ncc/admissions/students/:studentId/enrolments",
    (request, response) =>
      handleOperationalRead<EmsStagingStudentEnrolment[]>(
        request,
        response,
        dependencies,
        "admissions",
        (api, token) =>
          api.studentEnrolments(token, request.params?.studentId ?? ""),
        normalizeEmsStudentEnrolments,
        items => ({ items })
      )
  );
  app.get("/api/ncc/admissions/leads", (request, response) => {
    const query = readListQuery(request, response, [
      { name: "branchId", ems: "branch_id", kind: "array" },
      {
        name: "status",
        ems: "status",
        kind: "array",
        values: LEAD_PATCH_STATUSES,
      },
      { name: "type", ems: "type", kind: "array", values: LEAD_TYPES },
      { name: "wantsOnline", ems: "wants_online", kind: "boolean" },
      { name: "wantsOnsite", ems: "wants_onsite", kind: "boolean" },
      { name: "groupId", ems: "group_id", kind: "string" },
      { name: "ungrouped", ems: "ungrouped", kind: "boolean" },
      { name: "assignedSsaId", ems: "assigned_ssa_id", kind: "array" },
      { name: "unassigned", ems: "unassigned", kind: "boolean" },
      { name: "areaOfStudyId", ems: "area_of_study_id", kind: "array" },
    ]);
    if (!query) return;
    return handleOperationalRead(
      request,
      response,
      dependencies,
      "admissions",
      (api, token) => api.leads(token, query),
      payload => normalizeEmsPage(payload, normalizeEmsLead),
      pageBody
    );
  });
  app.get("/api/ncc/admissions/leads/:leadId", (request, response) =>
    handleOperationalRead<EmsStagingLead>(
      request,
      response,
      dependencies,
      "admissions",
      (api, token) => api.lead(token, request.params?.leadId ?? ""),
      normalizeEmsLead,
      lead => ({ lead })
    )
  );
  app.get("/api/ncc/admissions/placement-tests", (request, response) => {
    const query = readListQuery(request, response, [
      { name: "branchId", ems: "branch_id", kind: "string" },
      { name: "status", ems: "status", kind: "enum", values: BOOKING_STATUSES },
      { name: "leadId", ems: "lead_id", kind: "string" },
      { name: "studentId", ems: "student_id", kind: "string" },
    ]);
    if (!query) return;
    return handleOperationalRead(
      request,
      response,
      dependencies,
      "admissions",
      (api, token) => api.placementTests(token, query),
      payload => normalizeEmsPage(payload, normalizeEmsPlacementTest),
      pageBody
    );
  });
  app.get(
    "/api/ncc/admissions/placement-tests/:placementTestId",
    (request, response) =>
      handleOperationalRead<EmsStagingPlacementTest>(
        request,
        response,
        dependencies,
        "admissions",
        (api, token) =>
          api.placementTest(token, request.params?.placementTestId ?? ""),
        normalizeEmsPlacementTest,
        placementTest => ({ placementTest })
      )
  );
  app.get("/api/ncc/delivery/classes", (request, response) => {
    const query = readListQuery(request, response, [
      { name: "courseId", ems: "course_id", kind: "string" },
      { name: "branchId", ems: "branch_id", kind: "string" },
      { name: "departmentId", ems: "department_id", kind: "string" },
      {
        name: "status",
        ems: "status",
        kind: "enum",
        values: ["active", "disabled"],
      },
    ]);
    if (!query) return;
    return handleOperationalRead(
      request,
      response,
      dependencies,
      "delivery",
      (api, token) => api.classes(token, query),
      payload => normalizeEmsPage(payload, normalizeEmsClass),
      pageBody
    );
  });
  app.get("/api/ncc/delivery/classes/:classId", (request, response) =>
    handleOperationalRead<EmsStagingClass>(
      request,
      response,
      dependencies,
      "delivery",
      (api, token) => api.class(token, request.params?.classId ?? ""),
      normalizeEmsClass,
      value => ({ class: value })
    )
  );
  app.get("/api/ncc/delivery/rooms", (request, response) =>
    handleOperationalRead<EmsStagingRoom[]>(
      request,
      response,
      dependencies,
      "delivery",
      (api, token) => api.rooms(token),
      normalizeEmsRooms,
      items => ({ items })
    )
  );
  app.get("/api/ncc/delivery/teacher-workspace", (request, response) =>
    handleOperationalRead<EmsStagingTeacherWorkspace>(
      request,
      response,
      dependencies,
      "delivery",
      (api, token) => api.teacherWorkspace(token),
      normalizeEmsTeacherWorkspace,
      workspace => ({ workspace })
    )
  );
  const COURSE_LIST_FILTERS: ListParam[] = [
    { name: "departmentId", ems: "department_id", kind: "string" },
    {
      name: "status",
      ems: "status",
      kind: "array",
      values: ["active", "disabled"],
    },
  ];
  app.get("/api/ncc/delivery/courses", (request, response) => {
    const query = readListQuery(request, response, COURSE_LIST_FILTERS);
    if (!query) return;
    return handleOperationalRead(
      request,
      response,
      dependencies,
      "delivery",
      (api, token) => api.courses(token, query),
      payload => normalizeEmsPage(payload, normalizeEmsCourse),
      pageBody
    );
  });
  app.get(
    "/api/ncc/delivery/courses/:courseId/statistics",
    (request, response) =>
      handleOperationalRead(
        request,
        response,
        dependencies,
        "delivery",
        (api, token): Promise<RemoteResult> =>
          api.courseStatistics(token, request.params?.courseId ?? ""),
        normalizeEmsCourseStatistics,
        statistics => ({ statistics })
      )
  );
  app.get("/api/ncc/system/health", (request, response) =>
    handleOperationalRead<EmsStagingSystemHealth>(
      request,
      response,
      dependencies,
      "system",
      (api, token) => api.systemHealth(token),
      normalizeEmsSystemHealth,
      health => ({ health })
    )
  );
  app.get("/api/ncc/dashboard/summary", (request, response) => {
    // Optional branch and created-date window (YYYY-MM-DD, inclusive).
    const query = (request.query ?? {}) as Record<string, unknown>;
    const allowed = ["branchId", "createdFrom", "createdTo"];
    const { branchId, createdFrom, createdTo } = query;
    if (
      Object.keys(query).some(key => !allowed.includes(key)) ||
      (branchId !== undefined && !isNonBlankString(branchId)) ||
      (createdFrom !== undefined && !isDateOnly(createdFrom)) ||
      (createdTo !== undefined && !isDateOnly(createdTo)) ||
      (isDateOnly(createdFrom) && isDateOnly(createdTo) && createdFrom > createdTo)
    ) {
      response.status(400).json({ error: "Request query is invalid." });
      return;
    }
    return handleOperationalRead<EmsStagingDashboardSummary>(
      request,
      response,
      dependencies,
      "dashboard",
      (api, token) =>
        api.dashboardSummary(token, {
          branchId: branchId as string | undefined,
          createdFrom: createdFrom as string | undefined,
          createdTo: createdTo as string | undefined,
        }),
      normalizeEmsDashboardSummary,
      summary => ({ summary })
    );
  });
  app.get("/api/ncc/audit/events", (request, response) => {
    const query = request.query ?? {};
    const queryKeys = Object.keys(query);
    if (queryKeys.some(key => !["stream", "eventType", "limit"].includes(key))) {
      response.status(400).json({ error: "Request query is invalid." });
      return;
    }
    const stream = query.stream;
    const eventType = query.eventType;
    const limit = query.limit;
    if (
      (stream !== undefined &&
        (typeof stream !== "string" ||
          !EMS_AUDIT_STREAMS.includes(
            stream as EmsStagingAuditStream
          ))) ||
      (eventType !== undefined &&
        (typeof eventType !== "string" ||
          !eventType.trim() ||
          eventType.trim().length > 120)) ||
      (limit !== undefined &&
        (typeof limit !== "string" ||
          !/^\d+$/.test(limit) ||
          Number(limit) < 1 ||
          Number(limit) > 100))
    ) {
      response.status(400).json({ error: "Request query is invalid." });
      return;
    }
    return handleOperationalRead<EmsStagingAuditEvent[]>(
      request,
      response,
      dependencies,
      "audit",
      (api, token) =>
        api.auditEvents(token, {
          stream: stream as EmsStagingAuditStream | undefined,
          eventType:
            typeof eventType === "string" ? eventType.trim() : undefined,
          limit: typeof limit === "string" ? Number(limit) : 100,
        }),
      normalizeEmsAuditEvents,
      items => ({ items })
    );
  });
  app.get("/api/ncc/notifications", (request, response) => {
    const query = request.query ?? {};
    if (
      Object.keys(query).some(key => !["unread", "limit"].includes(key))
    ) {
      response.status(400).json({ error: "Request query is invalid." });
      return;
    }
    const unread = query.unread;
    const limit = query.limit;
    if (
      (unread !== undefined && unread !== "true" && unread !== "false") ||
      (limit !== undefined &&
        (typeof limit !== "string" ||
          !/^\d+$/.test(limit) ||
          Number(limit) < 1 ||
          Number(limit) > 100))
    ) {
      response.status(400).json({ error: "Request query is invalid." });
      return;
    }
    return handleOperationalRead<EmsStagingNotification[]>(
      request,
      response,
      dependencies,
      "notifications",
      (api, token) =>
        api.notifications(token, {
          unread: unread === "true" ? true : unread === "false" ? false : undefined,
          limit: typeof limit === "string" ? Number(limit) : 6,
        }),
      normalizeEmsNotifications,
      items => ({ items })
    );
  });
  app.get("/api/ncc/notifications/unread-count", (request, response) =>
    handleOperationalRead<{ unreadCount: number }>(
      request,
      response,
      dependencies,
      "notifications",
      (api, token) => api.notificationUnreadCount(token),
      normalizeEmsNotificationUnreadCount,
      count => ({ unreadCount: count.unreadCount })
    )
  );
  app.post?.("/api/ncc/notifications/read-all", async (request, response) => {
    if (!prepareNotificationsWrite(request, response, dependencies)) return;
    if (request.body && Object.keys(request.body).length) {
      response.status(400).json({ error: "Request body must be empty." });
      return;
    }
    try {
      const marked = normalizeEmsNotificationsMarkedRead(
        await runNccWrite(
          request,
          response,
          (api, token): Promise<RemoteResult> =>
            api.markAllNotificationsRead(token),
          dependencies
        )
      );
      if (!marked) {
        response
          .status(502)
          .json({ error: "NCC EMS returned invalid notifications data." });
        return;
      }
      response.json({ markedRead: marked.markedRead });
    } catch (error) {
      if (!sendNccAuthError(error, response)) throw error;
    }
  });
  app.post?.(
    "/api/ncc/notifications/:notificationId/read",
    async (request, response) => {
      if (!prepareNotificationsWrite(request, response, dependencies)) return;
      if (request.body && Object.keys(request.body).length) {
        response.status(400).json({ error: "Request body must be empty." });
        return;
      }
      const notificationId = request.params?.notificationId;
      if (!isNonBlankString(notificationId)) {
        response.status(400).json({ error: "Notification id is required." });
        return;
      }
      try {
        const notification = normalizeEmsNotification(
          await runNccWrite(
            request,
            response,
            (api, token): Promise<RemoteResult> =>
              api.markNotificationRead(token, notificationId),
            dependencies
          )
        );
        if (!notification) {
          response
            .status(502)
            .json({ error: "NCC EMS returned invalid notifications data." });
          return;
        }
        response.json({ notification });
      } catch (error) {
        if (!sendNccAuthError(error, response)) throw error;
      }
    }
  );
  app.post?.(
    "/api/ncc/notifications/delete-all",
    async (request, response) => {
      if (!prepareNotificationsWrite(request, response, dependencies)) return;
      if (!isEmptyBody(request.body)) {
        response.status(400).json({ error: "Request body must be empty." });
        return;
      }
      try {
        const deleted = normalizeEmsNotificationsDeleted(
          await runNccWrite(
            request,
            response,
            (api, token): Promise<RemoteResult> =>
              api.deleteAllNotifications(token),
            dependencies
          )
        );
        if (!deleted) {
          response
            .status(502)
            .json({ error: "NCC EMS returned invalid notifications data." });
          return;
        }
        response.json({ deleted: deleted.deleted });
      } catch (error) {
        if (!sendNccAuthError(error, response)) throw error;
      }
    }
  );
  app.delete?.(
    "/api/ncc/notifications/:notificationId",
    async (request, response) => {
      if (!prepareNotificationsWrite(request, response, dependencies)) return;
      if (!isEmptyBody(request.body)) {
        response.status(400).json({ error: "Request body must be empty." });
        return;
      }
      const notificationId = request.params?.notificationId;
      if (!isNonBlankString(notificationId)) {
        response.status(400).json({ error: "Notification id is required." });
        return;
      }
      try {
        await runNccWrite(
          request,
          response,
          (api, token): Promise<RemoteResult> =>
            api.deleteNotification(token, notificationId),
          dependencies
        );
        response.json({ ok: true });
      } catch (error) {
        if (!sendNccAuthError(error, response)) throw error;
      }
    }
  );

  app.post?.("/api/ncc/auth/switch-role", async (request, response) => {
    if (!prepareStaffAuth(request, response, dependencies)) return;
    const body = request.body;
    if (!isPlainObject(body) || hasOnlyKeys(body, ["targetRole"])) {
      response.status(400).json({ error: "Request body is invalid." });
      return;
    }
    const targetRole = body.targetRole;
    if (!isEmsStagingRole(String(targetRole ?? ""))) {
      response.status(400).json({ error: "targetRole is invalid." });
      return;
    }
    const env = dependencies.env ?? process.env;
    const session = getNccRequestSession(request, env);
    if (!session?.ncc) {
      response.status(401).json({ error: "Sign in required." });
      return;
    }
    if (
      !isSwitchableEmsRole(
        session.ncc.assignedRole,
        targetRole as EmsStagingRole
      )
    ) {
      response
        .status(403)
        .json({ error: "You cannot switch to that role." });
      return;
    }
    try {
      const next = await switchNccEmsRole(
        request,
        response,
        targetRole as EmsStagingRole,
        dependencies
      );
      response.json({ session: sessionDto(next) });
    } catch (error) {
      if (!sendNccAuthError(error, response)) throw error;
    }
  });

  app.post?.("/api/ncc/auth/session-scopes", async (request, response) => {
    if (!prepareStaffAuth(request, response, dependencies)) return;
    const body = request.body;
    if (!isPlainObject(body) || !Object.keys(body).length) {
      response.status(400).json({ error: "Request body is required." });
      return;
    }
    const unknown = hasOnlyKeys(body, [
      "branchId",
      "branchIds",
      "departmentIds",
      "classIds",
      "courseIds",
    ]);
    if (unknown) {
      response.status(400).json({ error: `${unknown} is not allowed.` });
      return;
    }
    if (
      (body.branchId !== undefined &&
        body.branchId !== null &&
        (typeof body.branchId !== "string" || !body.branchId.trim())) ||
      (body.branchIds !== undefined && !isStringArray(body.branchIds)) ||
      (body.departmentIds !== undefined &&
        !isStringArray(body.departmentIds)) ||
      (body.classIds !== undefined && !isStringArray(body.classIds)) ||
      (body.courseIds !== undefined && !isStringArray(body.courseIds))
    ) {
      response.status(400).json({ error: "Session scopes are invalid." });
      return;
    }
    try {
      const next = await setNccSessionScopes(
        request,
        response,
        {
          ...(body.branchId !== undefined
            ? {
                branchId:
                  body.branchId === null
                    ? null
                    : (body.branchId as string).trim(),
              }
            : {}),
          ...(body.branchIds !== undefined
            ? { branchIds: body.branchIds }
            : {}),
          ...(body.departmentIds !== undefined
            ? { departmentIds: body.departmentIds }
            : {}),
          ...(body.classIds !== undefined
            ? { classIds: body.classIds }
            : {}),
          ...(body.courseIds !== undefined
            ? { courseIds: body.courseIds }
            : {}),
        },
        dependencies
      );
      response.json({ session: sessionDto(next) });
    } catch (error) {
      if (!sendNccAuthError(error, response)) throw error;
    }
  });

  app.get(
    "/api/ncc/auth/session-scope-options",
    async (request, response) => {
      if (!prepareStaffAuth(request, response, dependencies)) return;
      try {
        const options = await getNccSessionScopeOptions(
          request,
          response,
          dependencies
        );
        response.json(options);
      } catch (error) {
        if (!sendNccAuthError(error, response)) throw error;
      }
    }
  );

  app.get("/api/ncc/auth/sessions", async (request, response) => {
    if (!prepareStaffAuth(request, response, dependencies)) return;
    try {
      const items = await listNccAuthSessions(
        request,
        response,
        dependencies
      );
      response.json({ items });
    } catch (error) {
      if (!sendNccAuthError(error, response)) throw error;
    }
  });

  app.delete?.(
    "/api/ncc/auth/sessions/:sessionId",
    async (request, response) => {
      if (!prepareStaffAuth(request, response, dependencies)) return;
      if (!isEmptyBody(request.body)) {
        response.status(400).json({ error: "Request body must be empty." });
        return;
      }
      const sessionId = request.params?.sessionId;
      if (!isNonBlankString(sessionId)) {
        response.status(400).json({ error: "Session id is required." });
        return;
      }
      try {
        await revokeNccAuthSession(request, response, sessionId, dependencies);
        response.json({ ok: true });
      } catch (error) {
        if (!sendNccAuthError(error, response)) throw error;
      }
    }
  );

  app.post?.("/api/ncc/auth/logout-all", async (request, response) => {
    if (!prepareStaffAuth(request, response, dependencies)) return;
    if (!isEmptyBody(request.body)) {
      response.status(400).json({ error: "Request body must be empty." });
      return;
    }
    try {
      await logoutAllNccSessions(request, response, dependencies);
      response.json({ ok: true });
    } catch (error) {
      if (!sendNccAuthError(error, response)) throw error;
    }
  });

  app.post?.("/api/ncc/admissions/leads", async (request, response) => {
    if (!prepareAdmissionsWrite(request, response, dependencies)) return;
    const body = request.body;
    if (!isPlainObject(body)) {
      response.status(400).json({ error: "Request body is required." });
      return;
    }
    const unknown = hasOnlyKeys(body, [
      "firstName",
      "lastName",
      "email",
      "phone",
      "source",
      "notes",
      "preferredCourseIds",
      "wantsOnline",
      "wantsOnsite",
      "entryPath",
      "branchId",
      ...LEAD_REFERENCE_KEYS,
    ]);
    if (unknown) {
      response.status(400).json({ error: `${unknown} is not allowed.` });
      return;
    }
    const leadRefError = leadReferenceError(body);
    if (leadRefError) {
      response.status(400).json({ error: leadRefError });
      return;
    }
    for (const [key, label] of [
      ["firstName", "firstName"],
      ["lastName", "lastName"],
      ["email", "email"],
    ] as const) {
      if (typeof body[key] !== "string" || !body[key]) {
        response.status(400).json({ error: `${label} is required.` });
        return;
      }
    }
    if (
      body.preferredCourseIds !== undefined &&
      (!Array.isArray(body.preferredCourseIds) ||
        body.preferredCourseIds.some(id => typeof id !== "string" || !id))
    ) {
      response.status(400).json({ error: "preferredCourseIds is invalid." });
      return;
    }
    for (const key of ["wantsOnline", "wantsOnsite"] as const) {
      if (body[key] !== undefined && typeof body[key] !== "boolean") {
        response.status(400).json({ error: `${key} is invalid.` });
        return;
      }
    }
    if (
      body.entryPath !== undefined &&
      body.entryPath !== null &&
      !LEAD_ENTRY_PATHS.includes(String(body.entryPath))
    ) {
      response.status(400).json({ error: "entryPath is invalid." });
      return;
    }
    const branchId = selectedBranchId(
      request,
      response,
      dependencies,
      body.branchId
    );
    if (branchId === null) return;
    const upstream: Record<string, unknown> = {
      first_name: body.firstName,
      last_name: body.lastName,
      email: body.email,
      ...(branchId ? { branch_id: branchId } : {}),
    };
    for (const [source, target] of [
      ["phone", "phone"],
      ["source", "source"],
      ["notes", "notes"],
      ["preferredCourseIds", "preferred_course_ids"],
      ["wantsOnline", "wants_online"],
      ["wantsOnsite", "wants_onsite"],
      ["entryPath", "entry_path"],
    ] as const) {
      if (body[source] !== undefined) upstream[target] = body[source];
    }
    Object.assign(upstream, leadReferenceUpstream(body));
    try {
      const lead = normalizeEmsLead(
        await runNccWrite(
          request,
          response,
          (api, token) => api.createLead(token, upstream),
          dependencies
        )
      );
      if (!lead) {
        response
          .status(502)
          .json({ error: "NCC EMS returned invalid admissions data." });
        return;
      }
      response.json({ lead });
    } catch (error) {
      if (!sendNccAuthError(error, response)) throw error;
    }
  });

  app.patch?.(
    "/api/ncc/admissions/leads/:leadId",
    async (request, response) => {
      if (!prepareAdmissionsWrite(request, response, dependencies)) return;
      const body = request.body;
      if (!isPlainObject(body)) {
        response.status(400).json({ error: "Request body is required." });
        return;
      }
      const mapping = {
        firstName: "first_name",
        lastName: "last_name",
        email: "email",
        phone: "phone",
        source: "source",
        notes: "notes",
        preferredCourseIds: "preferred_course_ids",
        wantsOnline: "wants_online",
        wantsOnsite: "wants_onsite",
        entryPath: "entry_path",
        status: "status",
      } as const;
      const unknown = hasOnlyKeys(body, [
        ...Object.keys(mapping),
        ...LEAD_REFERENCE_KEYS,
      ]);
      if (unknown) {
        response.status(400).json({ error: `${unknown} is not allowed.` });
        return;
      }
      if (Object.keys(body).length === 0) {
        response.status(400).json({ error: "At least one field is required." });
        return;
      }
      const leadRefError = leadReferenceError(body);
      if (leadRefError) {
        response.status(400).json({ error: leadRefError });
        return;
      }
      if (
        body.status !== undefined &&
        !LEAD_PATCH_STATUSES.includes(String(body.status))
      ) {
        response.status(400).json({ error: "status is invalid." });
        return;
      }
      if (
        body.preferredCourseIds !== undefined &&
        (!Array.isArray(body.preferredCourseIds) ||
          body.preferredCourseIds.some(id => typeof id !== "string" || !id))
      ) {
        response
          .status(400)
          .json({ error: "preferredCourseIds is invalid." });
        return;
      }
      for (const key of ["wantsOnline", "wantsOnsite"] as const) {
        if (body[key] !== undefined && typeof body[key] !== "boolean") {
          response.status(400).json({ error: `${key} is invalid.` });
          return;
        }
      }
      if (
        body.entryPath !== undefined &&
        body.entryPath !== null &&
        !LEAD_ENTRY_PATHS.includes(String(body.entryPath))
      ) {
        response.status(400).json({ error: "entryPath is invalid." });
        return;
      }
      const upstream = {
        ...Object.fromEntries(
          Object.entries(mapping)
            .filter(([key]) => body[key] !== undefined)
            .map(([key, target]) => [target, body[key]])
        ),
        ...leadReferenceUpstream(body),
      };
      try {
        const lead = normalizeEmsLead(
          await runNccWrite(
            request,
            response,
            (api, token) =>
              api.patchLead(token, request.params?.leadId ?? "", upstream),
            dependencies
          )
        );
        if (!lead) {
          response
            .status(502)
            .json({ error: "NCC EMS returned invalid admissions data." });
          return;
        }
        response.json({ lead });
      } catch (error) {
        if (!sendNccAuthError(error, response)) throw error;
      }
    }
  );

  app.post?.(
    "/api/ncc/admissions/leads/:leadId/convert",
    async (request, response) => {
      if (!prepareAdmissionsWrite(request, response, dependencies)) return;
      const body = request.body;
      if (!isPlainObject(body)) {
        response.status(400).json({ error: "Request body is required." });
        return;
      }
      const unknown = hasOnlyKeys(body, [
        "nationality",
        "address",
        "gender",
        "dateOfBirth",
        "phone",
        "passportNumber",
        "nationalId",
        "guardians",
      ]);
      if (unknown) {
        response.status(400).json({ error: `${unknown} is not allowed.` });
        return;
      }
      const invalid = identityError(body, true);
      if (invalid) {
        response.status(400).json({ error: invalid });
        return;
      }
      if (
        body.guardians !== undefined &&
        readGuardians(body.guardians) === null
      ) {
        response.status(400).json({ error: "guardians is invalid." });
        return;
      }
      const identity = identityUpstream(body);
      try {
        const payload = await runNccWrite(
          request,
          response,
          (api, token) =>
            api.convertLead(token, request.params?.leadId ?? "", identity),
          dependencies
        );
        if (!isPlainObject(payload)) {
          response
            .status(502)
            .json({ error: "NCC EMS returned invalid admissions data." });
          return;
        }
        const lead = normalizeEmsLead(payload.lead);
        const student = normalizeEmsStudent(payload.student);
        if (!lead || !student) {
          response
            .status(502)
            .json({ error: "NCC EMS returned invalid admissions data." });
          return;
        }
        response.json({ lead, student });
      } catch (error) {
        if (!sendNccAuthError(error, response)) throw error;
      }
    }
  );

  app.post?.("/api/ncc/admissions/students", async (request, response) => {
    if (!prepareAdmissionsWrite(request, response, dependencies)) return;
    const body = request.body;
    if (!isPlainObject(body)) {
      response.status(400).json({ error: "Request body is required." });
      return;
    }
    const unknown = hasOnlyKeys(body, [
      "firstName",
      "lastName",
      "email",
      "phone",
      "dateOfBirth",
      "nationality",
      "address",
      "gender",
      "passportNumber",
      "nationalId",
      "guardians",
      "branchId",
      "registration",
      "note",
      "assignedSsaId",
    ]);
    if (unknown) {
      response.status(400).json({ error: `${unknown} is not allowed.` });
      return;
    }
    for (const key of ["firstName", "lastName", "email"] as const) {
      if (typeof body[key] !== "string" || !body[key]) {
        response.status(400).json({ error: `${key} is required.` });
        return;
      }
    }
    const registration = readAmounts(body.registration, {
      requireToBePaid: true,
    });
    if (typeof registration === "string") {
      response.status(400).json({ error: `registration: ${registration}` });
      return;
    }
    if (
      (body.note !== undefined &&
        body.note !== null &&
        typeof body.note !== "string") ||
      (body.assignedSsaId !== undefined &&
        body.assignedSsaId !== null &&
        !isNonBlankString(body.assignedSsaId))
    ) {
      response.status(400).json({ error: "note or assignedSsaId is invalid." });
      return;
    }
    const invalid = identityError(body, true);
    if (invalid) {
      response.status(400).json({ error: invalid });
      return;
    }
    if (
      body.guardians !== undefined &&
      readGuardians(body.guardians) === null
    ) {
      response.status(400).json({ error: "guardians is invalid." });
      return;
    }
    const branchId = selectedBranchId(
      request,
      response,
      dependencies,
      body.branchId
    );
    if (branchId === null) return;
    const upstream: Record<string, unknown> = {
      first_name: body.firstName,
      last_name: body.lastName,
      email: body.email,
      ...(branchId ? { home_branch_id: branchId } : {}),
      registration,
      ...(typeof body.note === "string" && body.note.trim()
        ? { note: body.note.trim() }
        : {}),
      ...(isNonBlankString(body.assignedSsaId)
        ? { assigned_ssa_id: body.assignedSsaId }
        : {}),
      ...identityUpstream(body),
    };
    await sendNccWrite(
      request,
      response,
      dependencies,
      (api, token) => api.createStudent(token, upstream),
      normalizeEmsStudent,
      "student",
      placementSecrets
    );
  });

  app.patch?.(
    "/api/ncc/admissions/students/:studentId",
    async (request, response) => {
      if (!prepareAdmissionsWrite(request, response, dependencies)) return;
      const body = request.body;
      if (!isPlainObject(body)) {
        response.status(400).json({ error: "Request body is required." });
        return;
      }
      const mapping = {
        firstName: "first_name",
        lastName: "last_name",
        email: "email",
        homeBranchId: "home_branch_id",
        assignedSsaId: "assigned_ssa_id",
        note: "note",
      } as const;
      const unknown = hasOnlyKeys(body, [
        ...Object.keys(mapping),
        "phone",
        "dateOfBirth",
        "nationality",
        "address",
        "gender",
        "passportNumber",
        "nationalId",
        "guardians",
      ]);
      if (unknown) {
        response.status(400).json({ error: `${unknown} is not allowed.` });
        return;
      }
      if (
        (body.homeBranchId !== undefined &&
          !isNonBlankString(body.homeBranchId)) ||
        (body.assignedSsaId !== undefined &&
          body.assignedSsaId !== null &&
          !isNonBlankString(body.assignedSsaId)) ||
        (body.note !== undefined &&
          body.note !== null &&
          typeof body.note !== "string")
      ) {
        response
          .status(400)
          .json({ error: "homeBranchId, assignedSsaId, or note is invalid." });
        return;
      }
      const invalid = identityError(body, false);
      if (invalid) {
        response.status(400).json({ error: invalid });
        return;
      }
      if (
        body.guardians !== undefined &&
        readGuardians(body.guardians) === null
      ) {
        response.status(400).json({ error: "guardians is invalid." });
        return;
      }
      const upstream: Record<string, unknown> = {
        ...Object.fromEntries(
          Object.entries(mapping)
            .filter(([key]) => body[key] !== undefined)
            .map(([key, target]) => [target, body[key]])
        ),
        ...identityUpstream(body),
      };
      try {
        const student = normalizeEmsStudent(
          await runNccWrite(
            request,
            response,
            (api, token) =>
              api.patchStudent(
                token,
                request.params?.studentId ?? "",
                upstream
              ),
            dependencies
          )
        );
        if (!student) {
          response
            .status(502)
            .json({ error: "NCC EMS returned invalid admissions data." });
          return;
        }
        response.json({ student });
      } catch (error) {
        if (!sendNccAuthError(error, response)) throw error;
      }
    }
  );

  const studentLifecycle =
    (action: "disable" | "enable") =>
    async (request: OperationalRequest, response: OperationalResponse) => {
      if (!prepareAdmissionsWrite(request, response, dependencies)) return;
      const reasonId =
        action === "disable" ? requireReasonId(request, response) : "";
      if (reasonId === null) return;
      try {
        const student = normalizeEmsStudent(
          await runNccWrite(
            request,
            response,
            (api, token) =>
              action === "disable"
                ? api.disableStudent(
                    token,
                    request.params?.studentId ?? "",
                    reasonId
                  )
                : api.enableStudent(token, request.params?.studentId ?? ""),
            dependencies
          )
        );
        if (!student) {
          response
            .status(502)
            .json({ error: "NCC EMS returned invalid admissions data." });
          return;
        }
        response.json({ student });
      } catch (error) {
        if (!sendNccAuthError(error, response)) throw error;
      }
    };
  app.post?.(
    "/api/ncc/admissions/students/:studentId/disable",
    studentLifecycle("disable")
  );
  app.post?.(
    "/api/ncc/admissions/students/:studentId/enable",
    studentLifecycle("enable")
  );

  app.post?.(
    "/api/ncc/admissions/placement-tests",
    async (request, response) => {
      if (!prepareAdmissionsWrite(request, response, dependencies)) return;
      const body = request.body;
      if (!isPlainObject(body)) {
        response.status(400).json({ error: "Request body is required." });
        return;
      }
      const upstream = bookingBody(
        body,
        [
          "subject",
          "scheduledAt",
          "roomId",
          "branchId",
          "meetingUrl",
          "areaOfStudyId",
          "placementMoodleCourseId",
        ],
        { create: true }
      );
      if (typeof upstream === "string") {
        response.status(400).json({ error: upstream });
        return;
      }
      const branchId = selectedBranchId(
        request,
        response,
        dependencies,
        body.branchId
      );
      if (branchId === null) return;
      if (branchId) upstream.branch_id = branchId;
      await sendNccWrite(
        request,
        response,
        dependencies,
        (api, token) => api.createPlacementTest(token, upstream),
        normalizeEmsPlacementTest,
        "placementTest",
        placementSecrets
      );
    }
  );

  app.patch?.(
    "/api/ncc/admissions/placement-tests/:placementTestId",
    async (request, response) => {
      if (!prepareAdmissionsWrite(request, response, dependencies)) return;
      const body = request.body;
      if (!isPlainObject(body) || Object.keys(body).length === 0) {
        response.status(400).json({ error: "At least one field is required." });
        return;
      }
      const upstream = bookingBody(
        body,
        ["scheduledAt", "roomId", "status", "meetingUrl", "areaOfStudyId"],
        { create: false }
      );
      if (typeof upstream === "string") {
        response.status(400).json({ error: upstream });
        return;
      }
      await sendNccWrite(
        request,
        response,
        dependencies,
        (api, token) =>
          api.patchPlacementTest(
            token,
            request.params?.placementTestId ?? "",
            upstream
          ),
        normalizeEmsPlacementTest,
        "placementTest"
      );
    }
  );

  const placementAction =
    (action: "cancel" | "record-result") =>
    async (request: OperationalRequest, response: OperationalResponse) => {
      if (!prepareAdmissionsWrite(request, response, dependencies)) return;
      const body = request.body ?? {};
      if (!isPlainObject(body)) {
        response.status(400).json({ error: "Request body is invalid." });
        return;
      }
      let upstream: Record<string, unknown> = {};
      let reasonId = "";
      if (action === "cancel") {
        const value = requireReasonId(request, response);
        if (value === null) return;
        reasonId = value;
      }
      if (action === "record-result") {
        const unknown = hasOnlyKeys(body, [
          "resultScore",
          "mentoringTeacherId",
          "recommendedCourseId",
          "resultNotes",
        ]);
        if (unknown) {
          response.status(400).json({ error: `${unknown} is not allowed.` });
          return;
        }
        if (!isNonBlankString(body.resultScore)) {
          response.status(400).json({ error: "resultScore is required." });
          return;
        }
        if (!isNonBlankString(body.mentoringTeacherId)) {
          response
            .status(400)
            .json({ error: "mentoringTeacherId is required." });
          return;
        }
        if (
          body.recommendedCourseId !== undefined &&
          body.recommendedCourseId !== null &&
          !isNonBlankString(body.recommendedCourseId)
        ) {
          response
            .status(400)
            .json({ error: "recommendedCourseId is invalid." });
          return;
        }
        if (
          body.resultNotes !== undefined &&
          body.resultNotes !== null &&
          typeof body.resultNotes !== "string"
        ) {
          response.status(400).json({ error: "resultNotes is invalid." });
          return;
        }
        upstream = {
          result_score: body.resultScore.trim(),
          mentoring_teacher_id: body.mentoringTeacherId.trim(),
          ...(isNonBlankString(body.recommendedCourseId)
            ? { recommended_course_id: body.recommendedCourseId }
            : {}),
          ...(typeof body.resultNotes === "string" && body.resultNotes.trim()
            ? { result_notes: body.resultNotes.trim() }
            : {}),
        };
      }
      try {
        const placementTest = normalizeEmsPlacementTest(
          await runNccWrite(
            request,
            response,
            (api, token) =>
              action === "cancel"
                ? api.cancelPlacementTest(
                    token,
                    request.params?.placementTestId ?? "",
                    reasonId
                  )
                : api.recordPlacementResult(
                    token,
                    request.params?.placementTestId ?? "",
                    upstream
                  ),
            dependencies
          )
        );
        if (!placementTest) {
          response
            .status(502)
            .json({ error: "NCC EMS returned invalid admissions data." });
          return;
        }
        response.json({ placementTest });
      } catch (error) {
        if (!sendNccAuthError(error, response)) throw error;
      }
    };
  app.post?.(
    "/api/ncc/admissions/placement-tests/:placementTestId/cancel",
    placementAction("cancel")
  );
  app.post?.(
    "/api/ncc/admissions/placement-tests/:placementTestId/record-result",
    placementAction("record-result")
  );

  /* ---------------- Admissions: sync, registrations, learning ---------- */

  app.post?.(
    "/api/ncc/admissions/placement-tests/:placementTestId/sync-moodle-result",
    async (request, response) => {
      if (!prepareAdmissionsWrite(request, response, dependencies)) return;
      if (!isEmptyBody(request.body)) {
        response.status(400).json({ error: "Request body must be empty." });
        return;
      }
      await sendNccWrite(
        request,
        response,
        dependencies,
        (api, token) =>
          api.syncPlacementMoodleResult(
            token,
            request.params?.placementTestId ?? ""
          ),
        normalizeEmsPlacementTest,
        "placementTest"
      );
    }
  );

  app.put?.(
    "/api/ncc/admissions/leads/:leadId/registration",
    async (request, response) => {
      if (!prepareAdmissionsWrite(request, response, dependencies)) return;
      const amounts = readAmounts(request.body, { requireToBePaid: true });
      if (typeof amounts === "string") {
        response.status(400).json({ error: amounts });
        return;
      }
      await sendNccWrite(
        request,
        response,
        dependencies,
        (api, token) =>
          api.putLeadRegistration(token, request.params?.leadId ?? "", amounts),
        normalizeEmsLead,
        "lead"
      );
    }
  );

  app.patch?.(
    "/api/ncc/admissions/students/:studentId/registration",
    async (request, response) => {
      if (!prepareAdmissionsWrite(request, response, dependencies)) return;
      const amounts = readAmounts(request.body, { requireToBePaid: true });
      if (typeof amounts === "string") {
        response.status(400).json({ error: amounts });
        return;
      }
      await sendNccWrite(
        request,
        response,
        dependencies,
        (api, token) =>
          api.patchStudentRegistration(
            token,
            request.params?.studentId ?? "",
            amounts
          ),
        normalizeEmsStudent,
        "student"
      );
    }
  );

  app.get(
    "/api/ncc/admissions/students/:studentId/learning",
    (request, response) =>
      handleOperationalRead(
        request,
        response,
        dependencies,
        "admissions",
        (api, token) =>
          api.studentLearning(token, request.params?.studentId ?? ""),
        normalizeEmsStudentLearning,
        learning => ({ learning })
      )
  );

  app.get("/api/ncc/admissions/students/:studentId/report", (request, response) => {
    const query = readListQuery(request, response, [
      { name: "classId", ems: "class_id", kind: "string" },
    ]);
    if (!query) return;
    return handleOperationalRead(
      request,
      response,
      dependencies,
      "admissions",
      (api, token) =>
        api.studentReport(
          token,
          request.params?.studentId ?? "",
          typeof query.class_id === "string" ? query.class_id : undefined
        ),
      normalizeEmsStudentReport,
      report => ({ report })
    );
  });

  app.get("/api/ncc/admissions/assignees", (request, response) => {
    const query = readListQuery(request, response, [
      { name: "branchId", ems: "branch_id", kind: "string" },
    ]);
    if (!query) return;
    const session = getNccRequestSession(request, dependencies.env ?? process.env);
    const branchId =
      typeof query.branch_id === "string"
        ? query.branch_id
        : (session?.workspaceBranchId ?? null);
    if (!branchId) {
      response.setHeader("Cache-Control", "private, no-store");
      response.status(400).json({ error: "branchId is required." });
      return;
    }
    return handleOperationalRead(
      request,
      response,
      dependencies,
      "admissions",
      (api, token) =>
        api.assignees(
          token,
          branchId,
          typeof query.q === "string" ? query.q : undefined
        ),
      payload => normalizeEmsPage(payload, normalizeEmsAssignee),
      page => ({ items: page.items })
    );
  });

  /* ---------------- Enrolments (course sales) ------------------------- */

  app.get("/api/ncc/admissions/enrolments", (request, response) => {
    const query = readListQuery(request, response, [
      {
        name: "status",
        ems: "status",
        kind: "enum",
        values: ENROLMENT_LIST_STATUSES,
      },
      { name: "branchId", ems: "branch_id", kind: "string" },
      { name: "courseId", ems: "course_id", kind: "string" },
      {
        name: "kind",
        ems: "kind",
        kind: "enum",
        values: ["individual", "group"],
      },
    ]);
    if (!query) return;
    return handleOperationalRead(
      request,
      response,
      dependencies,
      "admissions",
      (api, token) => api.enrolments(token, query),
      payload => normalizeEmsPage(payload, normalizeEmsEnrolment),
      pageBody
    );
  });

  app.post?.("/api/ncc/admissions/enrolments", async (request, response) => {
    if (!prepareAdmissionsWrite(request, response, dependencies)) return;
    const body = request.body;
    if (!isPlainObject(body)) {
      response.status(400).json({ error: "Request body is required." });
      return;
    }
    const unknown = hasOnlyKeys(body, [
      "studentId",
      "courseId",
      "kind",
      "branchId",
      "toBePaid",
      "paid",
    ]);
    if (unknown) {
      response.status(400).json({ error: `${unknown} is not allowed.` });
      return;
    }
    if (!isNonBlankString(body.studentId) || !isNonBlankString(body.courseId)) {
      response
        .status(400)
        .json({ error: "studentId and courseId are required." });
      return;
    }
    if (body.kind !== "individual" && body.kind !== "group") {
      response.status(400).json({ error: "kind is invalid." });
      return;
    }
    const amounts = readAmounts(
      { toBePaid: body.toBePaid, ...(body.paid !== undefined ? { paid: body.paid } : {}) },
      { requireToBePaid: true }
    );
    if (typeof amounts === "string") {
      response.status(400).json({ error: amounts });
      return;
    }
    const branchId = selectedBranchId(
      request,
      response,
      dependencies,
      body.branchId
    );
    if (branchId === null) return;
    if (!branchId) {
      response.status(400).json({ error: "branchId is required." });
      return;
    }
    await sendNccWrite(
      request,
      response,
      dependencies,
      (api, token) =>
        api.createEnrolment(token, {
          student_id: body.studentId,
          course_id: body.courseId,
          kind: body.kind,
          branch_id: branchId,
          ...amounts,
        }),
      normalizeEmsEnrolment,
      "enrolment"
    );
  });

  app.patch?.(
    "/api/ncc/admissions/enrolments/:enrolmentId",
    async (request, response) => {
      if (!prepareAdmissionsWrite(request, response, dependencies)) return;
      const body = request.body;
      if (!isPlainObject(body) || Object.keys(body).length === 0) {
        response.status(400).json({ error: "At least one field is required." });
        return;
      }
      const unknown = hasOnlyKeys(body, ["toBePaid", "paid", "branchId", "kind"]);
      if (unknown) {
        response.status(400).json({ error: `${unknown} is not allowed.` });
        return;
      }
      const amounts = readAmounts(
        Object.fromEntries(
          Object.entries(body).filter(([key]) => key === "toBePaid" || key === "paid")
        ),
        { requireToBePaid: false }
      );
      if (typeof amounts === "string") {
        response.status(400).json({ error: amounts });
        return;
      }
      if (body.branchId !== undefined && !isNonBlankString(body.branchId)) {
        response.status(400).json({ error: "branchId is invalid." });
        return;
      }
      if (
        body.kind !== undefined &&
        body.kind !== "individual" &&
        body.kind !== "group"
      ) {
        response.status(400).json({ error: "kind is invalid." });
        return;
      }
      await sendNccWrite(
        request,
        response,
        dependencies,
        (api, token) =>
          api.patchEnrolment(token, request.params?.enrolmentId ?? "", {
            ...amounts,
            ...(body.branchId !== undefined ? { branch_id: body.branchId } : {}),
            ...(body.kind !== undefined ? { kind: body.kind } : {}),
          }),
        normalizeEmsEnrolment,
        "enrolment"
      );
    }
  );

  for (const action of ["leave", "cancel", "complete"] as const) {
    app.post?.(
      `/api/ncc/admissions/enrolments/:enrolmentId/${action}`,
      async (request, response) => {
        if (!prepareAdmissionsWrite(request, response, dependencies)) return;
        let reasonId = "";
        if (action === "complete") {
          if (!isEmptyBody(request.body)) {
            response.status(400).json({ error: "Request body must be empty." });
            return;
          }
        } else {
          const value = requireReasonId(request, response);
          if (value === null) return;
          reasonId = value;
        }
        const id = request.params?.enrolmentId ?? "";
        await sendNccWrite(
          request,
          response,
          dependencies,
          (api, token) =>
            action === "leave"
              ? api.leaveEnrolment(token, id, reasonId)
              : action === "cancel"
                ? api.cancelEnrolment(token, id, reasonId)
                : api.completeEnrolment(token, id),
          normalizeEmsEnrolment,
          "enrolment"
        );
      }
    );
  }

  /* ---------------- Trial lessons ------------------------------------- */

  app.get("/api/ncc/admissions/trial-lessons", (request, response) => {
    const query = readListQuery(request, response, [
      { name: "branchId", ems: "branch_id", kind: "string" },
      { name: "status", ems: "status", kind: "enum", values: BOOKING_STATUSES },
      { name: "leadId", ems: "lead_id", kind: "string" },
      { name: "studentId", ems: "student_id", kind: "string" },
    ]);
    if (!query) return;
    return handleOperationalRead(
      request,
      response,
      dependencies,
      "admissions",
      (api, token) => api.trialLessons(token, query),
      payload => normalizeEmsPage(payload, normalizeEmsTrialLesson),
      pageBody
    );
  });

  app.get(
    "/api/ncc/admissions/trial-lessons/:trialLessonId",
    (request, response) =>
      handleOperationalRead(
        request,
        response,
        dependencies,
        "admissions",
        (api, token) =>
          api.trialLesson(token, request.params?.trialLessonId ?? ""),
        normalizeEmsTrialLesson,
        trialLesson => ({ trialLesson })
      )
  );

  app.post?.("/api/ncc/admissions/trial-lessons", async (request, response) => {
    if (!prepareAdmissionsWrite(request, response, dependencies)) return;
    const body = request.body;
    if (!isPlainObject(body)) {
      response.status(400).json({ error: "Request body is required." });
      return;
    }
    const upstream = bookingBody(
      body,
      [
        "subject",
        "scheduledAt",
        "roomId",
        "branchId",
        "meetingUrl",
        "areaOfStudyId",
        "courseId",
      ],
      { create: true }
    );
    if (typeof upstream === "string") {
      response.status(400).json({ error: upstream });
      return;
    }
    if (
      Boolean(upstream.area_of_study_id) === Boolean(upstream.course_id)
    ) {
      response
        .status(400)
        .json({ error: "Choose either an area of study or a course." });
      return;
    }
    const branchId = selectedBranchId(
      request,
      response,
      dependencies,
      body.branchId
    );
    if (branchId === null) return;
    if (branchId) upstream.branch_id = branchId;
    await sendNccWrite(
      request,
      response,
      dependencies,
      (api, token) => api.createTrialLesson(token, upstream),
      normalizeEmsTrialLesson,
      "trialLesson"
    );
  });

  app.patch?.(
    "/api/ncc/admissions/trial-lessons/:trialLessonId",
    async (request, response) => {
      if (!prepareAdmissionsWrite(request, response, dependencies)) return;
      const body = request.body;
      if (!isPlainObject(body) || Object.keys(body).length === 0) {
        response.status(400).json({ error: "At least one field is required." });
        return;
      }
      const upstream = bookingBody(
        body,
        [
          "scheduledAt",
          "roomId",
          "meetingUrl",
          "areaOfStudyId",
          "courseId",
          "status",
        ],
        { create: false }
      );
      if (typeof upstream === "string") {
        response.status(400).json({ error: upstream });
        return;
      }
      await sendNccWrite(
        request,
        response,
        dependencies,
        (api, token) =>
          api.patchTrialLesson(
            token,
            request.params?.trialLessonId ?? "",
            upstream
          ),
        normalizeEmsTrialLesson,
        "trialLesson"
      );
    }
  );

  app.post?.(
    "/api/ncc/admissions/trial-lessons/:trialLessonId/record-result",
    async (request, response) => {
      if (!prepareAdmissionsWrite(request, response, dependencies)) return;
      const body = request.body ?? {};
      if (
        !isPlainObject(body) ||
        hasOnlyKeys(body, ["recommendedCourseId", "resultScore", "resultNotes"])
      ) {
        response.status(400).json({ error: "Request body is invalid." });
        return;
      }
      const upstream: Record<string, unknown> = {};
      for (const [source, target] of [
        ["recommendedCourseId", "recommended_course_id"],
        ["resultScore", "result_score"],
        ["resultNotes", "result_notes"],
      ] as const) {
        const value = body[source];
        if (value === undefined || value === null) continue;
        if (typeof value !== "string") {
          response.status(400).json({ error: `${source} is invalid.` });
          return;
        }
        if (value.trim()) upstream[target] = value.trim();
      }
      await sendNccWrite(
        request,
        response,
        dependencies,
        (api, token) =>
          api.recordTrialLessonResult(
            token,
            request.params?.trialLessonId ?? "",
            upstream
          ),
        normalizeEmsTrialLesson,
        "trialLesson"
      );
    }
  );

  app.post?.(
    "/api/ncc/admissions/trial-lessons/:trialLessonId/cancel",
    async (request, response) => {
      if (!prepareAdmissionsWrite(request, response, dependencies)) return;
      const reasonId = requireReasonId(request, response);
      if (reasonId === null) return;
      await sendNccWrite(
        request,
        response,
        dependencies,
        (api, token) =>
          api.cancelTrialLesson(
            token,
            request.params?.trialLessonId ?? "",
            reasonId
          ),
        normalizeEmsTrialLesson,
        "trialLesson"
      );
    }
  );

  /* ---------------- Lead groups (siblings, friends) -------------------- */

  app.get("/api/ncc/admissions/lead-groups", (request, response) => {
    const query = readListQuery(request, response, [
      { name: "branchId", ems: "branch_id", kind: "string" },
    ]);
    if (!query) return;
    return handleOperationalRead(
      request,
      response,
      dependencies,
      "admissions",
      (api, token) =>
        api.leadGroups(
          token,
          typeof query.branch_id === "string" ? query.branch_id : undefined
        ),
      normalizeEmsLeadGroups,
      items => ({ items })
    );
  });

  app.get("/api/ncc/admissions/lead-groups/:groupId", (request, response) =>
    handleOperationalRead(
      request,
      response,
      dependencies,
      "admissions",
      (api, token) => api.leadGroup(token, request.params?.groupId ?? ""),
      normalizeEmsLeadGroup,
      group => ({ group })
    )
  );

  const leadGroupBody = (
    body: Record<string, unknown>,
    create: boolean
  ): Record<string, unknown> | string => {
    const unknown = hasOnlyKeys(body, [
      "branchId",
      "label",
      "assignedSsaId",
      "memberLeadIds",
      "primaryLeadId",
    ]);
    if (unknown) return `${unknown} is not allowed.`;
    if (!create && body.branchId !== undefined) return "branchId is not allowed.";
    const upstream: Record<string, unknown> = {};
    if (create || body.memberLeadIds !== undefined) {
      if (
        !isStringArray(body.memberLeadIds) ||
        body.memberLeadIds.length < 2 ||
        new Set(body.memberLeadIds).size !== body.memberLeadIds.length
      ) {
        return "memberLeadIds needs at least two different leads.";
      }
      upstream.member_lead_ids = body.memberLeadIds;
    }
    if (body.primaryLeadId !== undefined && body.primaryLeadId !== null) {
      if (!isNonBlankString(body.primaryLeadId)) return "primaryLeadId is invalid.";
      const members = (upstream.member_lead_ids as string[] | undefined) ?? null;
      if (members && !members.includes(body.primaryLeadId)) {
        return "primaryLeadId must be a member.";
      }
      upstream.primary_lead_id = body.primaryLeadId;
    }
    for (const [source, target] of [
      ["label", "label"],
      ["assignedSsaId", "assigned_ssa_id"],
    ] as const) {
      const value = body[source];
      if (value === undefined) continue;
      if (value !== null && (typeof value !== "string" || value.length > 200)) {
        return `${source} is invalid.`;
      }
      upstream[target] = typeof value === "string" ? value.trim() || null : null;
    }
    return upstream;
  };

  app.post?.("/api/ncc/admissions/lead-groups", async (request, response) => {
    if (!prepareAdmissionsWrite(request, response, dependencies)) return;
    const body = request.body;
    if (!isPlainObject(body)) {
      response.status(400).json({ error: "Request body is required." });
      return;
    }
    const upstream = leadGroupBody(body, true);
    if (typeof upstream === "string") {
      response.status(400).json({ error: upstream });
      return;
    }
    const branchId = selectedBranchId(
      request,
      response,
      dependencies,
      body.branchId
    );
    if (branchId === null) return;
    if (!branchId) {
      response.status(400).json({ error: "branchId is required." });
      return;
    }
    upstream.branch_id = branchId;
    await sendNccWrite(
      request,
      response,
      dependencies,
      (api, token) => api.createLeadGroup(token, upstream),
      normalizeEmsLeadGroup,
      "group"
    );
  });

  app.patch?.(
    "/api/ncc/admissions/lead-groups/:groupId",
    async (request, response) => {
      if (!prepareAdmissionsWrite(request, response, dependencies)) return;
      const body = request.body;
      if (!isPlainObject(body) || Object.keys(body).length === 0) {
        response.status(400).json({ error: "At least one field is required." });
        return;
      }
      const upstream = leadGroupBody(body, false);
      if (typeof upstream === "string") {
        response.status(400).json({ error: upstream });
        return;
      }
      await sendNccWrite(
        request,
        response,
        dependencies,
        (api, token) =>
          api.patchLeadGroup(token, request.params?.groupId ?? "", upstream),
        normalizeEmsLeadGroup,
        "group"
      );
    }
  );

  app.delete?.(
    "/api/ncc/admissions/lead-groups/:groupId",
    async (request, response) => {
      if (!prepareAdmissionsWrite(request, response, dependencies)) return;
      try {
        await runNccWrite(
          request,
          response,
          (api, token) =>
            api.deleteLeadGroup(token, request.params?.groupId ?? ""),
          dependencies
        );
        response.json({ deleted: true });
      } catch (error) {
        if (!sendNccAuthError(error, response)) throw error;
      }
    }
  );

  app.get("/api/ncc/moodle/site", (request, response) =>
    handleOperationalRead<EmsStagingMoodleSite>(
      request,
      response,
      dependencies,
      "system",
      (api, token): Promise<RemoteResult> => api.moodleSite(token),
      normalizeEmsMoodleSite,
      site => ({ site })
    )
  );

  app.post?.("/api/ncc/moodle/site/test", (request, response) =>
    handleOperationalRead<EmsStagingMoodleSiteTest>(
      request,
      response,
      dependencies,
      "system",
      (api, token): Promise<RemoteResult> => api.testMoodleSite(token),
      normalizeEmsMoodleSiteTest,
      result => ({ result })
    )
  );

  const moodleSiteBody = (
    body: unknown,
    { requireCredentials }: { requireCredentials: boolean }
  ): Record<string, unknown> | null => {
    if (
      !isPlainObject(body) ||
      hasOnlyKeys(body, [
        "siteUrl",
        "wsToken",
        "autoCreateStudentMoodle",
        "placementTestMoodleCourseId",
      ])
    ) {
      return null;
    }
    const upstream: Record<string, unknown> = {};
    if (body.siteUrl !== undefined) {
      if (
        typeof body.siteUrl !== "string" ||
        !body.siteUrl.trim() ||
        body.siteUrl.trim().length > 500
      ) {
        return null;
      }
      upstream.site_url = body.siteUrl.trim();
    }
    if (body.wsToken !== undefined) {
      if (
        typeof body.wsToken !== "string" ||
        !body.wsToken.trim() ||
        body.wsToken.trim().length > 255
      ) {
        return null;
      }
      upstream.ws_token = body.wsToken.trim();
    }
    if (body.autoCreateStudentMoodle !== undefined) {
      if (typeof body.autoCreateStudentMoodle !== "boolean") return null;
      upstream.auto_create_student_moodle = body.autoCreateStudentMoodle;
    }
    if (body.placementTestMoodleCourseId !== undefined) {
      if (
        body.placementTestMoodleCourseId !== null &&
        (!Number.isSafeInteger(body.placementTestMoodleCourseId) ||
          (body.placementTestMoodleCourseId as number) < 1)
      ) {
        return null;
      }
      upstream.placement_test_moodle_course_id =
        body.placementTestMoodleCourseId;
    }
    if (requireCredentials && (!upstream.site_url || !upstream.ws_token)) {
      return null;
    }
    if (!requireCredentials && Object.keys(upstream).length === 0) {
      return null;
    }
    return upstream;
  };

  const moodleSiteWrite =
    (method: "put" | "patch") =>
    async (request: OperationalRequest, response: OperationalResponse) => {
      if (!prepareMoodleAccount(request, response, dependencies)) return;
      const upstream = moodleSiteBody(request.body, {
        requireCredentials: method === "put",
      });
      if (!upstream) {
        response.status(400).json({ error: "Request body is invalid." });
        return;
      }
      try {
        const payload = await runNccWrite(
          request,
          response,
          (api, token) =>
            method === "put"
              ? api.putMoodleSite(token, upstream)
              : api.patchMoodleSite(token, upstream),
          dependencies
        );
        const site = normalizeEmsMoodleSite(payload);
        if (!site) {
          response
            .status(502)
            .json({ error: "NCC EMS returned invalid Moodle site data." });
          return;
        }
        response.json({ site });
      } catch (error) {
        if (!sendNccAuthError(error, response)) throw error;
      }
    };

  app.put?.("/api/ncc/moodle/site", moodleSiteWrite("put"));
  app.patch?.("/api/ncc/moodle/site", moodleSiteWrite("patch"));

  app.post?.("/api/ncc/moodle/site/disconnect", async (request, response) => {
    if (!prepareMoodleAccount(request, response, dependencies)) return;
    try {
      const payload = await runNccWrite(
        request,
        response,
        (api, token) => api.disconnectMoodleSite(token),
        dependencies
      );
      const site = normalizeEmsMoodleSite(payload);
      if (!site) {
        response
          .status(502)
          .json({ error: "NCC EMS returned invalid Moodle site data." });
        return;
      }
      response.json({ site });
    } catch (error) {
      if (!sendNccAuthError(error, response)) throw error;
    }
  });

  app.get("/api/ncc/moodle/users", async (request, response) => {
    response.setHeader("Vary", "Cookie");
    if (!prepareMoodleAccount(request, response, dependencies)) return;
    const q = request.query?.q;
    if (typeof q !== "string" || q.trim().length < 2) {
      response
        .status(400)
        .json({ error: "Search requires at least 2 characters." });
      return;
    }
    try {
      const items = normalizeEmsMoodleUsers(
        await runNccRead(
          request,
          response,
          (api, token): Promise<RemoteResult> =>
            api.moodleUsers(token, q.trim()),
          dependencies
        )
      );
      if (!items) {
        response
          .status(502)
          .json({ error: "NCC EMS returned invalid Moodle account data." });
        return;
      }
      response.json({ items });
    } catch (error) {
      if (!sendNccAuthError(error, response)) throw error;
    }
  });

  app.post?.(
    "/api/ncc/admissions/students/:studentId/moodle",
    async (request, response) => {
      if (!prepareMoodleAccount(request, response, dependencies)) return;
      const bind = moodleBindBody(request.body);
      if (!bind) {
        response.status(400).json({ error: "Request body is invalid." });
        return;
      }
      try {
        const payload = await runNccWrite(
          request,
          response,
          (api, token) =>
            api.bindStudentMoodle(
              token,
              request.params?.studentId ?? "",
              bind.mode === "link"
                ? { mode: "link", moodle_user_id: bind.moodleUserId }
                : { mode: "create" }
            ),
          dependencies
        );
        if (!isPlainObject(payload)) {
          response
            .status(502)
            .json({ error: "NCC EMS returned invalid admissions data." });
          return;
        }
        const student = normalizeEmsStudent(payload);
        const generated = moodleGeneratedPassword(
          payload,
          bind.mode === "create"
        );
        if (!student || !generated) {
          response
            .status(502)
            .json({ error: "NCC EMS returned invalid admissions data." });
          return;
        }
        response.json({
          student,
          oneTime: {
            generatedMoodlePassword:
              bind.mode === "create" ? generated.password : null,
          },
        });
      } catch (error) {
        if (!sendNccAuthError(error, response)) throw error;
      }
    }
  );

  app.post?.(
    "/api/ncc/admissions/students/:studentId/moodle/password",
    async (request, response) => {
      if (!prepareMoodleAccount(request, response, dependencies)) return;
      try {
        const payload = await runNccWrite(
          request,
          response,
          (api, token) =>
            api.resetStudentMoodlePassword(
              token,
              request.params?.studentId ?? ""
            ),
          dependencies
        );
        const generated =
          isPlainObject(payload) && moodleGeneratedPassword(payload, true);
        if (!generated || !generated.password) {
          response
            .status(502)
            .json({ error: "NCC EMS returned invalid admissions data." });
          return;
        }
        response.json({
          oneTime: { generatedMoodlePassword: generated.password },
        });
      } catch (error) {
        if (!sendNccAuthError(error, response)) throw error;
      }
    }
  );

  app.get("/api/ncc/delivery/moodle-courses", async (request, response) => {
    response.setHeader("Vary", "Cookie");
    if (!prepareDeliveryWrite(request, response, dependencies)) return;
    const q = request.query?.q;
    const refresh = request.query?.refresh;
    const unmapped = request.query?.unmapped;
    if (
      (q !== undefined && typeof q !== "string") ||
      (refresh !== undefined && refresh !== "true" && refresh !== "false") ||
      (unmapped !== undefined &&
        unmapped !== "true" &&
        unmapped !== "false")
    ) {
      response.status(400).json({ error: "Request query is invalid." });
      return;
    }
    try {
      const picker = normalizeEmsMoodleCoursePicker(
        await runNccRead(
          request,
          response,
          (api, token): Promise<RemoteResult> =>
            api.moodleCourses(
              token,
              typeof q === "string" ? q : undefined,
              refresh === "true",
              unmapped === undefined ? undefined : unmapped === "true"
            ),
          dependencies
        )
      );
      if (!picker) {
        response
          .status(502)
          .json({ error: "NCC EMS returned invalid delivery data." });
        return;
      }
      response.json(picker);
    } catch (error) {
      if (!sendNccAuthError(error, response)) throw error;
    }
  });

  app.get("/api/ncc/delivery/moodle-groups", async (request, response) => {
    response.setHeader("Vary", "Cookie");
    if (!prepareDeliveryWrite(request, response, dependencies)) return;
    const courseId = request.query?.courseId;
    const q = request.query?.q;
    if (
      !isNonBlankString(courseId) ||
      typeof q !== "string" ||
      q.trim().length < 2
    ) {
      response.status(400).json({ error: "Request query is invalid." });
      return;
    }
    try {
      const items = normalizeEmsMoodleGroups(
        await runNccRead(
          request,
          response,
          (api, token): Promise<RemoteResult> =>
            api.moodleGroups(token, courseId.trim(), q.trim()),
          dependencies
        )
      );
      if (!items) {
        response
          .status(502)
          .json({ error: "NCC EMS returned invalid delivery data." });
        return;
      }
      response.json({ items });
    } catch (error) {
      if (!sendNccAuthError(error, response)) throw error;
    }
  });

  app.get("/api/ncc/delivery/courses/:courseId", (request, response) =>
    handleOperationalRead<EmsStagingCourse>(
      request,
      response,
      dependencies,
      "delivery",
      (api, token): Promise<RemoteResult> =>
        api.course(token, request.params?.courseId ?? ""),
      normalizeEmsCourse,
      course => ({ course })
    )
  );

  app.get("/api/ncc/delivery/rooms/:roomId", (request, response) =>
    handleOperationalRead<EmsStagingRoom>(
      request,
      response,
      dependencies,
      "delivery",
      (api, token): Promise<RemoteResult> =>
        api.room(token, request.params?.roomId ?? ""),
      normalizeEmsRoom,
      room => ({ room })
    )
  );

  const courseLifecycle =
    (action: "disable" | "enable" | "refresh") =>
    async (request: OperationalRequest, response: OperationalResponse) => {
      if (!prepareDeliveryWrite(request, response, dependencies)) return;
      const reasonId =
        action === "disable" ? requireReasonId(request, response) : "";
      if (reasonId === null) return;
      try {
        const course = normalizeEmsCourse(
          await runNccWrite(
            request,
            response,
            (api, token) =>
              action === "disable"
                ? api.disableCourse(
                    token,
                    request.params?.courseId ?? "",
                    reasonId
                  )
                : action === "enable"
                  ? api.enableCourse(token, request.params?.courseId ?? "")
                  : api.refreshCourse(token, request.params?.courseId ?? ""),
            dependencies
          )
        );
        if (!course) {
          response
            .status(502)
            .json({ error: "NCC EMS returned invalid delivery data." });
          return;
        }
        response.json({ course });
      } catch (error) {
        if (!sendNccAuthError(error, response)) throw error;
      }
    };

  /** Optional course links; `null` clears a link on PATCH. */
  const readCourseLinks = (
    body: Record<string, unknown>,
    response: OperationalResponse
  ): Record<string, unknown> | null => {
    const out: Record<string, unknown> = {};
    for (const [key, ems] of [
      ["areaOfStudyId", "area_of_study_id"],
      ["previousCourseId", "previous_course_id"],
    ] as const) {
      if (body[key] === undefined) continue;
      if (body[key] !== null && !isNonBlankString(body[key])) {
        response.status(400).json({ error: `${key} is invalid.` });
        return null;
      }
      out[ems] = body[key] === null ? null : (body[key] as string).trim();
    }
    return out;
  };

  app.post?.(
    "/api/ncc/delivery/courses/refresh",
    async (request, response) => {
      if (!prepareDeliveryWrite(request, response, dependencies)) return;
      const query = readListQuery(request, response, COURSE_LIST_FILTERS);
      if (!query) return;
      try {
        const page = normalizeEmsPage(
          await runNccWrite(
            request,
            response,
            (api, token) => api.refreshCourses(token, query),
            dependencies
          ),
          normalizeEmsCourse
        );
        if (!page) {
          response
            .status(502)
            .json({ error: "NCC EMS returned invalid delivery data." });
          return;
        }
        response.json(pageBody(page));
      } catch (error) {
        if (!sendNccAuthError(error, response)) throw error;
      }
    }
  );

  app.post?.("/api/ncc/delivery/courses", async (request, response) => {
    if (!prepareDeliveryWrite(request, response, dependencies)) return;
    const body = request.body;
    if (
      !isPlainObject(body) ||
      hasOnlyKeys(body, [
        "departmentId",
        "moodleCourseId",
        "sortOrder",
        "totalHours",
        "areaOfStudyId",
        "previousCourseId",
      ])
    ) {
      response.status(400).json({ error: "Request body is invalid." });
      return;
    }
    if (!isNonBlankString(body.departmentId)) {
      response.status(400).json({ error: "departmentId is required." });
      return;
    }
    if (!isPositiveInteger(body.moodleCourseId)) {
      response.status(400).json({ error: "moodleCourseId is required." });
      return;
    }
    if (body.sortOrder !== undefined && !Number.isSafeInteger(body.sortOrder)) {
      response.status(400).json({ error: "sortOrder is invalid." });
      return;
    }
    // EMS requires total teaching hours for a new course.
    if (!isPositiveInteger(body.totalHours)) {
      response.status(400).json({ error: "totalHours is required." });
      return;
    }
    const courseLinks = readCourseLinks(body, response);
    if (!courseLinks) return;
    try {
      const course = normalizeEmsCourse(
        await runNccWrite(
          request,
          response,
          (api, token) =>
            api.createCourse(token, {
              department_id: (body.departmentId as string).trim(),
              moodle_course_id: body.moodleCourseId,
              total_hours: body.totalHours,
              ...courseLinks,
              ...(body.sortOrder !== undefined
                ? { sort_order: body.sortOrder }
                : {}),
            }),
          dependencies
        )
      );
      if (!course) {
        response
          .status(502)
          .json({ error: "NCC EMS returned invalid delivery data." });
        return;
      }
      response.json({ course });
    } catch (error) {
      if (!sendNccAuthError(error, response)) throw error;
    }
  });

  app.patch?.(
    "/api/ncc/delivery/courses/:courseId",
    async (request, response) => {
      if (!prepareDeliveryWrite(request, response, dependencies)) return;
      const body = request.body;
      if (
        !isPlainObject(body) ||
        hasOnlyKeys(body, [
          "departmentId",
          "sortOrder",
          "moodleAttendanceId",
          "totalHours",
          "areaOfStudyId",
          "previousCourseId",
        ])
      ) {
        response.status(400).json({ error: "Request body is invalid." });
        return;
      }
      const links = readCourseLinks(body, response);
      if (!links) return;
      const upstream: Record<string, unknown> = { ...links };
      if (body.totalHours !== undefined) {
        if (!isPositiveInteger(body.totalHours)) {
          response.status(400).json({ error: "totalHours is invalid." });
          return;
        }
        upstream.total_hours = body.totalHours;
      }
      if (body.departmentId !== undefined) {
        if (!isNonBlankString(body.departmentId)) {
          response.status(400).json({ error: "departmentId is invalid." });
          return;
        }
        upstream.department_id = body.departmentId.trim();
      }
      if (body.sortOrder !== undefined) {
        if (!Number.isSafeInteger(body.sortOrder)) {
          response.status(400).json({ error: "sortOrder is invalid." });
          return;
        }
        upstream.sort_order = body.sortOrder;
      }
      if (body.moodleAttendanceId !== undefined) {
        if (
          body.moodleAttendanceId !== null &&
          !isPositiveInteger(body.moodleAttendanceId)
        ) {
          response
            .status(400)
            .json({ error: "moodleAttendanceId is invalid." });
          return;
        }
        upstream.moodle_attendance_id = body.moodleAttendanceId;
      }
      try {
        const course = normalizeEmsCourse(
          await runNccWrite(
            request,
            response,
            (api, token) =>
              api.patchCourse(token, request.params?.courseId ?? "", upstream),
            dependencies
          )
        );
        if (!course) {
          response
            .status(502)
            .json({ error: "NCC EMS returned invalid delivery data." });
          return;
        }
        response.json({ course });
      } catch (error) {
        if (!sendNccAuthError(error, response)) throw error;
      }
    }
  );

  app.post?.(
    "/api/ncc/delivery/courses/:courseId/disable",
    courseLifecycle("disable")
  );
  app.post?.(
    "/api/ncc/delivery/courses/:courseId/enable",
    courseLifecycle("enable")
  );
  app.post?.(
    "/api/ncc/delivery/courses/:courseId/refresh",
    courseLifecycle("refresh")
  );

  const roomLifecycle =
    (action: "disable" | "enable") =>
    async (request: OperationalRequest, response: OperationalResponse) => {
      if (!prepareDeliveryWrite(request, response, dependencies)) return;
      const reasonId =
        action === "disable" ? requireReasonId(request, response) : "";
      if (reasonId === null) return;
      try {
        const room = normalizeEmsRoom(
          await runNccWrite(
            request,
            response,
            (api, token) =>
              action === "disable"
                ? api.disableRoom(token, request.params?.roomId ?? "", reasonId)
                : api.enableRoom(token, request.params?.roomId ?? ""),
            dependencies
          )
        );
        if (!room) {
          response
            .status(502)
            .json({ error: "NCC EMS returned invalid delivery data." });
          return;
        }
        response.json({ room });
      } catch (error) {
        if (!sendNccAuthError(error, response)) throw error;
      }
    };

  app.post?.("/api/ncc/delivery/rooms", async (request, response) => {
    if (!prepareDeliveryWrite(request, response, dependencies)) return;
    const body = request.body;
    if (
      !isPlainObject(body) ||
      hasOnlyKeys(body, ["name", "capacity", "sortOrder", "branchId"])
    ) {
      response.status(400).json({ error: "Request body is invalid." });
      return;
    }
    if (!isNonBlankString(body.name)) {
      response.status(400).json({ error: "name is required." });
      return;
    }
    if (
      body.capacity !== undefined &&
      body.capacity !== null &&
      !isPositiveInteger(body.capacity)
    ) {
      response.status(400).json({ error: "capacity is invalid." });
      return;
    }
    if (body.sortOrder !== undefined && !Number.isSafeInteger(body.sortOrder)) {
      response.status(400).json({ error: "sortOrder is invalid." });
      return;
    }
    const branchId = selectedBranchId(request, response, dependencies, body.branchId);
    if (branchId === null) return;
    if (!branchId) {
      response.status(400).json({ error: "branchId is required." });
      return;
    }
    try {
      const room = normalizeEmsRoom(
        await runNccWrite(
          request,
          response,
          (api, token) =>
            api.createRoom(token, {
              branch_id: branchId,
              name: (body.name as string).trim(),
              ...(body.capacity !== undefined
                ? { capacity: body.capacity }
                : {}),
              ...(body.sortOrder !== undefined
                ? { sort_order: body.sortOrder }
                : {}),
            }),
          dependencies
        )
      );
      if (!room) {
        response
          .status(502)
          .json({ error: "NCC EMS returned invalid delivery data." });
        return;
      }
      response.json({ room });
    } catch (error) {
      if (!sendNccAuthError(error, response)) throw error;
    }
  });

  app.patch?.(
    "/api/ncc/delivery/rooms/:roomId",
    async (request, response) => {
      if (!prepareDeliveryWrite(request, response, dependencies)) return;
      const body = request.body;
      if (
        !isPlainObject(body) ||
        hasOnlyKeys(body, ["name", "capacity", "sortOrder"])
      ) {
        response.status(400).json({ error: "Request body is invalid." });
        return;
      }
      const upstream: Record<string, unknown> = {};
      if (body.name !== undefined) {
        if (!isNonBlankString(body.name)) {
          response.status(400).json({ error: "name is invalid." });
          return;
        }
        upstream.name = body.name.trim();
      }
      if (body.capacity !== undefined) {
        if (body.capacity !== null && !isPositiveInteger(body.capacity)) {
          response.status(400).json({ error: "capacity is invalid." });
          return;
        }
        upstream.capacity = body.capacity;
      }
      if (body.sortOrder !== undefined) {
        if (!Number.isSafeInteger(body.sortOrder)) {
          response.status(400).json({ error: "sortOrder is invalid." });
          return;
        }
        upstream.sort_order = body.sortOrder;
      }
      try {
        const room = normalizeEmsRoom(
          await runNccWrite(
            request,
            response,
            (api, token) =>
              api.patchRoom(token, request.params?.roomId ?? "", upstream),
            dependencies
          )
        );
        if (!room) {
          response
            .status(502)
            .json({ error: "NCC EMS returned invalid delivery data." });
          return;
        }
        response.json({ room });
      } catch (error) {
        if (!sendNccAuthError(error, response)) throw error;
      }
    }
  );

  app.post?.(
    "/api/ncc/delivery/rooms/:roomId/disable",
    roomLifecycle("disable")
  );
  app.post?.(
    "/api/ncc/delivery/rooms/:roomId/enable",
    roomLifecycle("enable")
  );

  /** `from`/`to` (YYYY-MM-DD, at most 62 days) for an hour-cell range read. */
  const readHourRange = (
    request: OperationalRequest,
    response: OperationalResponse
  ): { from: string; to: string } | null => {
    const query = request.query ?? {};
    const { from, to } = query as Record<string, unknown>;
    if (
      Object.keys(query).some(key => key !== "from" && key !== "to") ||
      !isDateOnly(from) ||
      !isDateOnly(to) ||
      from > to ||
      (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) /
        86_400_000 >
        62
    ) {
      response.status(400).json({ error: "Request query is invalid." });
      return null;
    }
    return { from, to };
  };

  app.get(
    "/api/ncc/delivery/rooms/:roomId/hour-cells",
    (request, response) => {
      const range = readHourRange(request, response);
      if (!range) return;
      return handleOperationalRead(
        request,
        response,
        dependencies,
        "delivery",
        (api, token): Promise<RemoteResult> =>
          api.roomHourCells(
            token,
            request.params?.roomId ?? "",
            range.from,
            range.to
          ),
        normalizeEmsHourCellRange,
        value => ({ range: value })
      );
    }
  );

  app.patch?.(
    "/api/ncc/delivery/rooms/:roomId/hour-cells",
    async (request, response) => {
      if (!prepareDeliveryWrite(request, response, dependencies)) return;
      const body = request.body;
      const ops: EmsStagingHourCellOp[] = [];
      const valid =
        isPlainObject(body) &&
        hasOnlyKeys(body, ["ops"]) === undefined &&
        Array.isArray(body.ops) &&
        body.ops.length <= 24 * 62 &&
        body.ops.every(item => {
          if (
            !isPlainObject(item) ||
            hasOnlyKeys(item, ["date", "hour", "status"]) !== undefined ||
            !isDateOnly(item.date) ||
            !Number.isSafeInteger(item.hour) ||
            (item.hour as number) < 0 ||
            (item.hour as number) > 23 ||
            (item.status !== null &&
              item.status !== "available" &&
              item.status !== "unavailable")
          ) {
            return false;
          }
          ops.push({
            date: item.date,
            hour: item.hour as number,
            status: item.status as EmsStagingHourCellOp["status"],
          });
          return true;
        });
      if (!valid) {
        response.status(400).json({ error: "Request body is invalid." });
        return;
      }
      try {
        const result = normalizeEmsHourCellPatch(
          await runNccWrite(
            request,
            response,
            (api, token) =>
              api.patchRoomHourCells(token, request.params?.roomId ?? "", ops),
            dependencies
          )
        );
        if (!result) {
          response
            .status(502)
            .json({ error: "NCC EMS returned invalid delivery data." });
          return;
        }
        response.json(result);
      } catch (error) {
        if (!sendNccAuthError(error, response)) throw error;
      }
    }
  );

  const classLifecycle =
    (action: "disable" | "enable") =>
    async (request: OperationalRequest, response: OperationalResponse) => {
      if (!prepareDeliveryWrite(request, response, dependencies)) return;
      const reasonId =
        action === "disable" ? requireReasonId(request, response) : "";
      if (reasonId === null) return;
      try {
        const value = normalizeEmsClass(
          await runNccWrite(
            request,
            response,
            (api, token) =>
              action === "disable"
                ? api.disableClass(
                    token,
                    request.params?.classId ?? "",
                    reasonId
                  )
                : api.enableClass(token, request.params?.classId ?? ""),
            dependencies
          )
        );
        if (!value) {
          response
            .status(502)
            .json({ error: "NCC EMS returned invalid delivery data." });
          return;
        }
        response.json({ class: value });
      } catch (error) {
        if (!sendNccAuthError(error, response)) throw error;
      }
    };

  const readClassFields = (
    body: Record<string, unknown>,
    response: OperationalResponse
  ) => {
    const upstream: Record<string, unknown> = {};
    if (body.name !== undefined) {
      if (!isNonBlankString(body.name) || body.name.length > 150) {
        response.status(400).json({ error: "name is invalid." });
        return null;
      }
      upstream.name = body.name.trim();
    }
    if (body.capacity !== undefined) {
      if (!isPositiveInteger(body.capacity)) {
        response.status(400).json({ error: "capacity is invalid." });
        return null;
      }
      upstream.capacity = body.capacity;
    }
    for (const key of ["startAt", "endAt"] as const) {
      if (body[key] !== undefined) {
        if (!isValidDateTime(body[key])) {
          response.status(400).json({ error: `${key} is invalid.` });
          return null;
        }
        upstream[key === "startAt" ? "start_at" : "end_at"] = body[key];
      }
    }
    if (
      isValidDateTime(body.startAt) &&
      isValidDateTime(body.endAt) &&
      Date.parse(body.endAt) <= Date.parse(body.startAt)
    ) {
      response.status(400).json({ error: "endAt must be after startAt." });
      return null;
    }
    if (body.teacherIds !== undefined) {
      if (
        !Array.isArray(body.teacherIds) ||
        !body.teacherIds.every(item => isNonBlankString(item)) ||
        new Set(body.teacherIds).size !== body.teacherIds.length
      ) {
        response.status(400).json({ error: "teacherIds is invalid." });
        return null;
      }
      upstream.teacher_ids = body.teacherIds;
    }
    if (body.sortOrder !== undefined) {
      if (!Number.isSafeInteger(body.sortOrder)) {
        response.status(400).json({ error: "sortOrder is invalid." });
        return null;
      }
      upstream.sort_order = body.sortOrder;
    }
    if (body.schedule !== undefined) {
      const parsed = parseScheduleInput(body.schedule);
      if (parsed.state === "invalid") {
        response.status(400).json({ error: "schedule is invalid." });
        return null;
      }
      Object.assign(upstream, scheduleUpstream(parsed));
    }
    if (body.defaultRoomId !== undefined) {
      if (
        body.defaultRoomId !== null &&
        !isNonBlankString(body.defaultRoomId)
      ) {
        response.status(400).json({ error: "defaultRoomId is invalid." });
        return null;
      }
      upstream.default_room_id = body.defaultRoomId;
    }
    if (body.kind !== undefined) {
      if (body.kind !== "group" && body.kind !== "individual") {
        response.status(400).json({ error: "kind is invalid." });
        return null;
      }
      upstream.kind = body.kind;
    }
    if (body.meetingUrl !== undefined) {
      if (body.meetingUrl !== null && !isHttpsUrl(body.meetingUrl)) {
        response.status(400).json({ error: "meetingUrl is invalid." });
        return null;
      }
      upstream.meeting_url = body.meetingUrl;
    }
    if (body.assignedSsaId !== undefined) {
      if (body.assignedSsaId !== null && !isNonBlankString(body.assignedSsaId)) {
        response.status(400).json({ error: "assignedSsaId is invalid." });
        return null;
      }
      upstream.assigned_ssa_id = body.assignedSsaId;
    }
    return upstream;
  };

  app.post?.("/api/ncc/delivery/classes", async (request, response) => {
    if (!prepareDeliveryWrite(request, response, dependencies)) return;
    const body = request.body;
    if (
      !isPlainObject(body) ||
      hasOnlyKeys(body, [
        "name",
        "courseId",
        "capacity",
        "startAt",
        "endAt",
        "teacherIds",
        "sortOrder",
        "schedule",
        "defaultRoomId",
        "branchId",
        "kind",
        "meetingUrl",
        "assignedSsaId",
      ])
    ) {
      response.status(400).json({ error: "Request body is invalid." });
      return;
    }
    for (const key of ["name", "courseId", "startAt", "endAt"] as const) {
      if (body[key] === undefined) {
        response.status(400).json({ error: `${key} is required.` });
        return;
      }
    }
    if (body.capacity === undefined) {
      response.status(400).json({ error: "capacity is required." });
      return;
    }
    const upstream = readClassFields(body, response);
    if (!upstream) return;
    if (!isNonBlankString(body.courseId)) {
      response.status(400).json({ error: "courseId is required." });
      return;
    }
    const branchId = selectedBranchId(
      request,
      response,
      dependencies,
      body.branchId
    );
    if (branchId === null) return;
    if (!branchId) {
      response.status(400).json({ error: "branchId is required." });
      return;
    }
    upstream.course_id = body.courseId.trim();
    upstream.branch_id = branchId;
    try {
      const value = normalizeEmsClass(
        await runNccWrite(
          request,
          response,
          (api, token) => api.createClass(token, upstream),
          dependencies
        )
      );
      if (!value) {
        response
          .status(502)
          .json({ error: "NCC EMS returned invalid delivery data." });
        return;
      }
      response.json({ class: value });
    } catch (error) {
      if (!sendNccAuthError(error, response)) throw error;
    }
  });

  app.patch?.(
    "/api/ncc/delivery/classes/:classId",
    async (request, response) => {
      if (!prepareDeliveryWrite(request, response, dependencies)) return;
      const body = request.body;
      if (
        !isPlainObject(body) ||
        hasOnlyKeys(body, [
          "name",
          "capacity",
          "startAt",
          "endAt",
          "teacherIds",
          "sortOrder",
          "schedule",
          "defaultRoomId",
          "kind",
          "meetingUrl",
          "assignedSsaId",
          "branchId",
        ])
      ) {
        response.status(400).json({ error: "Request body is invalid." });
        return;
      }
      const upstream = readClassFields(body, response);
      if (!upstream) return;
      if (body.branchId !== undefined) {
        // Moving a class between branches is a Super Admin decision.
        const branchId = selectedBranchId(
          request,
          response,
          dependencies,
          body.branchId
        );
        if (branchId === null) return;
        if (branchId) upstream.branch_id = branchId;
      }
      try {
        const value = normalizeEmsClass(
          await runNccWrite(
            request,
            response,
            (api, token) =>
              api.patchClass(token, request.params?.classId ?? "", upstream),
            dependencies
          )
        );
        if (!value) {
          response
            .status(502)
            .json({ error: "NCC EMS returned invalid delivery data." });
          return;
        }
        response.json({ class: value });
      } catch (error) {
        if (!sendNccAuthError(error, response)) throw error;
      }
    }
  );

  app.post?.(
    "/api/ncc/delivery/classes/:classId/disable",
    classLifecycle("disable")
  );
  app.post?.(
    "/api/ncc/delivery/classes/:classId/enable",
    classLifecycle("enable")
  );

  app.post?.(
    "/api/ncc/delivery/classes/:classId/moodle",
    async (request, response) => {
      if (!prepareDeliveryWrite(request, response, dependencies)) return;
      const bind = classMoodleBindBody(request.body);
      if (!bind) {
        response.status(400).json({ error: "Request body is invalid." });
        return;
      }
      try {
        const value = normalizeEmsClass(
          await runNccWrite(
            request,
            response,
            (api, token) =>
              api.bindClassMoodle(
                token,
                request.params?.classId ?? "",
                bind.mode === "link"
                  ? { mode: "link", moodle_group_id: bind.moodleGroupId }
                  : { mode: "create" }
              ),
            dependencies
          )
        );
        if (!value) {
          response
            .status(502)
            .json({ error: "NCC EMS returned invalid delivery data." });
          return;
        }
        response.json({ class: value });
      } catch (error) {
        if (!sendNccAuthError(error, response)) throw error;
      }
    }
  );

  app.post?.(
    "/api/ncc/delivery/classes/:classId/moodle/sync",
    async (request, response) => {
      if (!prepareDeliveryWrite(request, response, dependencies)) return;
      try {
        const value = normalizeEmsClassSync(
          await runNccWrite(
            request,
            response,
            (api, token) =>
              api.syncClassMoodle(token, request.params?.classId ?? ""),
            dependencies
          )
        );
        if (!value) {
          response
            .status(502)
            .json({ error: "NCC EMS returned invalid delivery data." });
          return;
        }
        response.json(value);
      } catch (error) {
        if (!sendNccAuthError(error, response)) throw error;
      }
    }
  );

  app.get(
    "/api/ncc/delivery/classes/:classId/enrolments",
    (request, response) =>
      handleOperationalRead<EmsStagingClassEnrolment[]>(
        request,
        response,
        dependencies,
        "delivery",
        (api, token): Promise<RemoteResult> =>
          api.classEnrolments(token, request.params?.classId ?? ""),
        normalizeEmsClassEnrolments,
        items => ({ items })
      )
  );

  app.post?.(
    "/api/ncc/delivery/classes/:classId/enrolments",
    async (request, response) => {
      if (!prepareDeliveryWrite(request, response, dependencies)) return;
      const body = request.body;
      if (
        !isPlainObject(body) ||
        hasOnlyKeys(body, ["enrolmentId"])
      ) {
        response.status(400).json({ error: "Request body is invalid." });
        return;
      }
      if (!isNonBlankString(body.enrolmentId)) {
        response.status(400).json({ error: "enrolmentId is required." });
        return;
      }
      const enrolmentId = (body.enrolmentId as string).trim();
      try {
        const enrolment = normalizeEmsEnrolment(
          await runNccWrite(
            request,
            response,
            (api, token) =>
              api.attachClassEnrolment(
                token,
                request.params?.classId ?? "",
                { enrolment_id: enrolmentId }
              ),
            dependencies
          )
        );
        if (!enrolment) {
          response
            .status(502)
            .json({ error: "NCC EMS returned invalid delivery data." });
          return;
        }
        response.json({ enrolment });
      } catch (error) {
        if (!sendNccAuthError(error, response)) throw error;
      }
    }
  );

  app.get(
    "/api/ncc/delivery/classes/:classId/sessions",
    (request, response) =>
      handleOperationalRead<EmsStagingSession[]>(
        request,
        response,
        dependencies,
        "delivery",
        (api, token): Promise<RemoteResult> =>
          api.classSessions(token, request.params?.classId ?? ""),
        normalizeEmsSessions,
        items => ({ items })
      )
  );

  app.post?.(
    "/api/ncc/delivery/classes/:classId/sessions/propose",
    async (request, response) => {
      if (!prepareDeliveryWrite(request, response, dependencies)) return;
      const body = request.body;
      if (
        !isPlainObject(body) ||
        hasOnlyKeys(body, ["weekdayHours", "fromDate", "toDate"])
      ) {
        response.status(400).json({ error: "Request body is invalid." });
        return;
      }
      // EMS weekdays: 0 = Monday … 6 = Sunday; 1–24 hours per weekday.
      const weekdays = new Set<number>();
      if (
        !Array.isArray(body.weekdayHours) ||
        body.weekdayHours.length === 0 ||
        !body.weekdayHours.every(item => {
          if (
            !isPlainObject(item) ||
            hasOnlyKeys(item, ["weekday", "hours"]) !== undefined ||
            !Number.isSafeInteger(item.weekday) ||
            (item.weekday as number) < 0 ||
            (item.weekday as number) > 6 ||
            !Number.isSafeInteger(item.hours) ||
            (item.hours as number) < 1 ||
            (item.hours as number) > 24 ||
            weekdays.has(item.weekday as number)
          ) {
            return false;
          }
          weekdays.add(item.weekday as number);
          return true;
        })
      ) {
        response.status(400).json({ error: "weekdayHours is invalid." });
        return;
      }
      if (!isDateOnly(body.fromDate) || !isDateOnly(body.toDate)) {
        response.status(400).json({ error: "fromDate/toDate is invalid." });
        return;
      }
      if (
        Date.parse(`${body.fromDate}T00:00:00Z`) >
        Date.parse(`${body.toDate}T00:00:00Z`)
      ) {
        response
          .status(400)
          .json({ error: "fromDate must be on or before toDate." });
        return;
      }
      const upstream = {
        weekday_hours: (body.weekdayHours as Array<{ weekday: number; hours: number }>).map(
          item => ({ weekday: item.weekday, hours: item.hours })
        ),
        from_date: body.fromDate,
        to_date: body.toDate,
      };
      try {
        const slots = normalizeEmsSessionSlots(
          await runNccWrite(
            request,
            response,
            (api, token) =>
              api.proposeClassSessions(
                token,
                request.params?.classId ?? "",
                upstream
              ),
            dependencies
          )
        );
        if (!slots) {
          response
            .status(502)
            .json({ error: "NCC EMS returned invalid delivery data." });
          return;
        }
        response.json({ slots });
      } catch (error) {
        if (!sendNccAuthError(error, response)) throw error;
      }
    }
  );

  const sessionSlotsWrite =
    (action: "confirm" | "batch") =>
    async (request: OperationalRequest, response: OperationalResponse) => {
      if (!prepareDeliveryWrite(request, response, dependencies)) return;
      const body = request.body;
      if (!isPlainObject(body) || hasOnlyKeys(body, ["slots"])) {
        response.status(400).json({ error: "Request body is invalid." });
        return;
      }
      const slots = sessionSlotsUpstream(body.slots);
      if (!slots) {
        response.status(400).json({ error: "slots is invalid." });
        return;
      }
      try {
        const result = normalizeEmsSessionBatch(
          await runNccWrite(
            request,
            response,
            (api, token) =>
              action === "confirm"
                ? api.confirmClassSessions(
                    token,
                    request.params?.classId ?? "",
                    { slots }
                  )
                : api.batchClassSessions(
                    token,
                    request.params?.classId ?? "",
                    { slots }
                  ),
            dependencies
          )
        );
        if (!result) {
          response
            .status(502)
            .json({ error: "NCC EMS returned invalid delivery data." });
          return;
        }
        response.json(result);
      } catch (error) {
        if (!sendNccAuthError(error, response)) throw error;
      }
    };
  app.post?.(
    "/api/ncc/delivery/classes/:classId/sessions/confirm",
    sessionSlotsWrite("confirm")
  );
  app.post?.(
    "/api/ncc/delivery/classes/:classId/sessions/batch",
    sessionSlotsWrite("batch")
  );

  /** Moodle attendance session id from the route, or null after a 400. */
  const moodleSessionParam = (
    request: OperationalRequest,
    response: OperationalResponse
  ) => {
    const value = Number(request.params?.moodleSessionId);
    if (!Number.isSafeInteger(value) || value < 1) {
      response.status(400).json({ error: "moodleSessionId is invalid." });
      return null;
    }
    return value;
  };

  app.get(
    "/api/ncc/delivery/classes/:classId/attendance/sessions",
    (request, response) =>
      handleOperationalRead(
        request,
        response,
        dependencies,
        "delivery",
        (api, token): Promise<RemoteResult> =>
          api.classAttendanceSessions(token, request.params?.classId ?? ""),
        normalizeEmsAttendanceSessions,
        items => ({ items })
      )
  );

  app.get(
    "/api/ncc/delivery/classes/:classId/attendance/sessions/:moodleSessionId",
    (request, response) => {
      const moodleSessionId = moodleSessionParam(request, response);
      if (moodleSessionId === null) return;
      return handleOperationalRead(
        request,
        response,
        dependencies,
        "delivery",
        (api, token): Promise<RemoteResult> =>
          api.classAttendanceSession(
            token,
            request.params?.classId ?? "",
            moodleSessionId
          ),
        normalizeEmsAttendanceDetail,
        attendance => ({ attendance })
      );
    }
  );

  app.post?.(
    "/api/ncc/delivery/classes/:classId/attendance/sessions/:moodleSessionId",
    async (request, response) => {
      if (!prepareDeliveryWrite(request, response, dependencies)) return;
      const moodleSessionId = moodleSessionParam(request, response);
      if (moodleSessionId === null) return;
      const marks = attendanceMarksBody(request.body);
      if (!marks) {
        response.status(400).json({ error: "marks is invalid." });
        return;
      }
      try {
        const attendance = normalizeEmsAttendanceDetail(
          await runNccWrite(
            request,
            response,
            (api, token) =>
              api.markClassAttendance(
                token,
                request.params?.classId ?? "",
                moodleSessionId,
                { marks }
              ),
            dependencies
          )
        );
        if (!attendance) {
          response
            .status(502)
            .json({ error: "NCC EMS returned invalid delivery data." });
          return;
        }
        response.json({ attendance });
      } catch (error) {
        if (!sendNccAuthError(error, response)) throw error;
      }
    }
  );

  app.get(
    "/api/ncc/delivery/classes/:classId/grades",
    (request, response) =>
      handleOperationalRead<EmsStagingClassGrades>(
        request,
        response,
        dependencies,
        "delivery",
        (api, token): Promise<RemoteResult> =>
          api.classGrades(token, request.params?.classId ?? ""),
        normalizeEmsClassGrades,
        grades => ({ grades })
      )
  );

  app.get("/api/ncc/delivery/sessions/:sessionId", (request, response) =>
    handleOperationalRead<EmsStagingSession>(
      request,
      response,
      dependencies,
      "delivery",
      (api, token): Promise<RemoteResult> =>
        api.session(token, request.params?.sessionId ?? ""),
      normalizeEmsSession,
      session => ({ session })
    )
  );

  app.patch?.(
    "/api/ncc/delivery/sessions/:sessionId",
    async (request, response) => {
      if (!prepareDeliveryWrite(request, response, dependencies)) return;
      const body = request.body;
      if (
        !isPlainObject(body) ||
        hasOnlyKeys(body, [
          "startsAt",
          "endsAt",
          "durationHours",
          "teacherId",
          "roomId",
        ]) ||
        Object.keys(body).length === 0
      ) {
        response.status(400).json({ error: "Request body is invalid." });
        return;
      }
      const upstream: Record<string, unknown> = {};
      for (const key of ["startsAt", "endsAt"] as const) {
        if (body[key] !== undefined) {
          if (!isValidDateTime(body[key])) {
            response.status(400).json({ error: `${key} is invalid.` });
            return;
          }
          upstream[key === "startsAt" ? "starts_at" : "ends_at"] = body[key];
        }
      }
      if (
        isValidDateTime(body.startsAt) &&
        isValidDateTime(body.endsAt) &&
        Date.parse(body.endsAt) <= Date.parse(body.startsAt)
      ) {
        response.status(400).json({ error: "endsAt must be after startsAt." });
        return;
      }
      if (body.durationHours !== undefined) {
        if (!isPositiveInteger(body.durationHours)) {
          response.status(400).json({ error: "durationHours is invalid." });
          return;
        }
        upstream.duration_hours = body.durationHours;
      }
      if (body.teacherId !== undefined) {
        if (!isNonBlankString(body.teacherId)) {
          response.status(400).json({ error: "teacherId is invalid." });
          return;
        }
        upstream.teacher_id = body.teacherId;
      }
      if (body.roomId !== undefined) {
        if (body.roomId !== null && !isNonBlankString(body.roomId)) {
          response.status(400).json({ error: "roomId is invalid." });
          return;
        }
        upstream.room_id = body.roomId;
      }
      try {
        const session = normalizeEmsSession(
          await runNccWrite(
            request,
            response,
            (api, token) =>
              api.patchSession(
                token,
                request.params?.sessionId ?? "",
                upstream
              ),
            dependencies
          )
        );
        if (!session) {
          response
            .status(502)
            .json({ error: "NCC EMS returned invalid delivery data." });
          return;
        }
        response.json({ session });
      } catch (error) {
        if (!sendNccAuthError(error, response)) throw error;
      }
    }
  );

  app.post?.(
    "/api/ncc/delivery/sessions/:sessionId/cancel",
    async (request, response) => {
      if (!prepareDeliveryWrite(request, response, dependencies)) return;
      if (!isEmptyBody(request.body)) {
        response.status(400).json({ error: "Request body is invalid." });
        return;
      }
      try {
        const session = normalizeEmsSession(
          await runNccWrite(
            request,
            response,
            (api, token) =>
              api.cancelSession(token, request.params?.sessionId ?? ""),
            dependencies
          )
        );
        if (!session) {
          response
            .status(502)
            .json({ error: "NCC EMS returned invalid delivery data." });
          return;
        }
        response.json({ session });
      } catch (error) {
        if (!sendNccAuthError(error, response)) throw error;
      }
    }
  );

  app.get(
    "/api/ncc/delivery/sessions/:sessionId/attendance",
    (request, response) =>
      handleOperationalRead<EmsStagingAttendanceDetail>(
        request,
        response,
        dependencies,
        "delivery",
        (api, token): Promise<RemoteResult> =>
          api.sessionAttendance(token, request.params?.sessionId ?? ""),
        normalizeEmsAttendanceDetail,
        attendance => ({ attendance })
      )
  );

  app.post?.(
    "/api/ncc/delivery/sessions/:sessionId/attendance",
    async (request, response) => {
      if (!prepareDeliveryWrite(request, response, dependencies)) return;
      const body = request.body;
      if (!isPlainObject(body) || hasOnlyKeys(body, ["marks"])) {
        response.status(400).json({ error: "Request body is invalid." });
        return;
      }
      const marks = attendanceMarksBody(body);
      if (!marks) {
        response.status(400).json({ error: "marks is invalid." });
        return;
      }
      try {
        const attendance = normalizeEmsAttendanceDetail(
          await runNccWrite(
            request,
            response,
            (api, token) =>
              api.markSessionAttendance(
                token,
                request.params?.sessionId ?? "",
                { marks }
              ),
            dependencies
          )
        );
        if (!attendance) {
          response
            .status(502)
            .json({ error: "NCC EMS returned invalid delivery data." });
          return;
        }
        response.json({ attendance });
      } catch (error) {
        if (!sendNccAuthError(error, response)) throw error;
      }
    }
  );
}
