import {
  normalizeEmsAttendanceDetail,
  normalizeEmsClass,
  normalizeEmsClasses,
  normalizeEmsClassEnrolment,
  normalizeEmsClassEnrolments,
  normalizeEmsClassGrades,
  normalizeEmsCourses,
  normalizeEmsLead,
  normalizeEmsLeads,
  normalizeEmsCourse,
  normalizeEmsMoodleCoursePicker,
  normalizeEmsMoodleGroups,
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
  normalizeEmsNotificationsMarkedRead,
  normalizeEmsSystemHealth,
  normalizeEmsTeacherWorkspace,
  type EmsStagingAttendanceDetail,
  type EmsStagingClass,
  type EmsStagingClassEnrolment,
  type EmsStagingClassGrades,
  type EmsStagingCourse,
  type EmsStagingLead,
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
import {
  getNccRequestSession,
  hasNccAuthCookie,
  nccMoodleAccountWritesEnabled,
  nccStaffAuthEnabled,
  runNccRead,
  runNccWrite,
  sendNccAuthError,
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
  "new",
  "placement_test",
  "trial_lesson",
  "pending",
  "cancelled",
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

function isNonBlankString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
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
  app.get("/api/ncc/admissions/students", (request, response) =>
    handleOperationalRead<EmsStagingStudent[]>(
      request,
      response,
      dependencies,
      "admissions",
      (api, token) => api.students(token),
      normalizeEmsStudents,
      items => ({ items })
    )
  );
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
  app.get("/api/ncc/admissions/leads", (request, response) =>
    handleOperationalRead<EmsStagingLead[]>(
      request,
      response,
      dependencies,
      "admissions",
      (api, token) => api.leads(token),
      normalizeEmsLeads,
      items => ({ items })
    )
  );
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
  app.get("/api/ncc/admissions/placement-tests", (request, response) =>
    handleOperationalRead<EmsStagingPlacementTest[]>(
      request,
      response,
      dependencies,
      "admissions",
      (api, token) => api.placementTests(token),
      normalizeEmsPlacementTests,
      items => ({ items })
    )
  );
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
  app.get("/api/ncc/delivery/classes", (request, response) =>
    handleOperationalRead<EmsStagingClass[]>(
      request,
      response,
      dependencies,
      "delivery",
      (api, token) => api.classes(token),
      normalizeEmsClasses,
      items => ({ items })
    )
  );
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
  app.get("/api/ncc/delivery/courses", (request, response) =>
    handleOperationalRead<EmsStagingCourse[]>(
      request,
      response,
      dependencies,
      "delivery",
      (api, token) => api.courses(token),
      normalizeEmsCourses,
      items => ({ items })
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
  app.get("/api/ncc/dashboard/summary", (request, response) =>
    handleOperationalRead<EmsStagingDashboardSummary>(
      request,
      response,
      dependencies,
      "dashboard",
      (api, token) => api.dashboardSummary(token),
      normalizeEmsDashboardSummary,
      summary => ({ summary })
    )
  );
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
    ]);
    if (unknown) {
      response.status(400).json({ error: `${unknown} is not allowed.` });
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
      const unknown = hasOnlyKeys(body, Object.keys(mapping));
      if (unknown) {
        response.status(400).json({ error: `${unknown} is not allowed.` });
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
      const upstream = Object.fromEntries(
        Object.entries(mapping)
          .filter(([key]) => body[key] !== undefined)
          .map(([key, target]) => [target, body[key]])
      );
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
    "/api/ncc/admissions/leads/:leadId/ready",
    async (request, response) => {
      if (!prepareAdmissionsWrite(request, response, dependencies)) return;
      try {
        const lead = normalizeEmsLead(
          await runNccWrite(
            request,
            response,
            (api, token) =>
              api.markLeadReady(token, request.params?.leadId ?? ""),
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
      ...(branchId ? { branch_id: branchId } : {}),
      ...identityUpstream(body),
    };
    try {
      const student = normalizeEmsStudent(
        await runNccWrite(
          request,
          response,
          (api, token) => api.createStudent(token, upstream),
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
      try {
        const student = normalizeEmsStudent(
          await runNccWrite(
            request,
            response,
            (api, token) =>
              action === "disable"
                ? api.disableStudent(token, request.params?.studentId ?? "")
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
      const unknown = hasOnlyKeys(body, [
        "subject",
        "scheduledAt",
        "roomId",
        "branchId",
      ]);
      if (unknown) {
        response.status(400).json({ error: `${unknown} is not allowed.` });
        return;
      }
      if (
        !isPlainObject(body.subject) ||
        hasOnlyKeys(body.subject, ["type", "id"]) !== undefined ||
        (body.subject.type !== "lead" && body.subject.type !== "student") ||
        typeof body.subject.id !== "string" ||
        !body.subject.id
      ) {
        response.status(400).json({ error: "subject is required." });
        return;
      }
      if (
        typeof body.scheduledAt !== "string" ||
        !Number.isFinite(Date.parse(body.scheduledAt))
      ) {
        response.status(400).json({ error: "scheduledAt is required." });
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
        ...(branchId ? { branch_id: branchId } : {}),
        ...(body.subject.type === "lead"
          ? { lead_id: body.subject.id }
          : { student_id: body.subject.id }),
        scheduled_at: body.scheduledAt,
        ...(body.roomId !== undefined ? { room_id: body.roomId } : {}),
      };
      try {
        const placementTest = normalizeEmsPlacementTest(
          await runNccWrite(
            request,
            response,
            (api, token) => api.createPlacementTest(token, upstream),
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
      const mapping = {
        scheduledAt: "scheduled_at",
        roomId: "room_id",
        status: "status",
      } as const;
      const unknown = hasOnlyKeys(body, Object.keys(mapping));
      if (unknown) {
        response.status(400).json({ error: `${unknown} is not allowed.` });
        return;
      }
      if (body.status !== undefined && body.status !== "no_show") {
        response.status(400).json({ error: "status is invalid." });
        return;
      }
      const upstream = Object.fromEntries(
        Object.entries(mapping)
          .filter(([key]) => body[key] !== undefined)
          .map(([key, target]) => [target, body[key]])
      );
      try {
        const placementTest = normalizeEmsPlacementTest(
          await runNccWrite(
            request,
            response,
            (api, token) =>
              api.patchPlacementTest(
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
      if (action === "record-result") {
        const unknown = hasOnlyKeys(body, [
          "recommendedCourseId",
          "resultScore",
          "resultNotes",
        ]);
        if (unknown) {
          response.status(400).json({ error: `${unknown} is not allowed.` });
          return;
        }
        if (
          typeof body.recommendedCourseId !== "string" ||
          !body.recommendedCourseId
        ) {
          response
            .status(400)
            .json({ error: "recommendedCourseId is required." });
          return;
        }
        upstream = {
          recommended_course_id: body.recommendedCourseId,
          ...(body.resultScore !== undefined
            ? { result_score: body.resultScore }
            : {}),
          ...(body.resultNotes !== undefined
            ? { result_notes: body.resultNotes }
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
                    request.params?.placementTestId ?? ""
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
    if (
      (q !== undefined && typeof q !== "string") ||
      (refresh !== undefined && refresh !== "true" && refresh !== "false")
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
              refresh === "true"
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
      try {
        const course = normalizeEmsCourse(
          await runNccWrite(
            request,
            response,
            (api, token) =>
              action === "disable"
                ? api.disableCourse(token, request.params?.courseId ?? "")
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

  app.post?.("/api/ncc/delivery/courses", async (request, response) => {
    if (!prepareDeliveryWrite(request, response, dependencies)) return;
    const body = request.body;
    if (
      !isPlainObject(body) ||
      hasOnlyKeys(body, ["departmentId", "moodleCourseId", "sortOrder"])
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
    try {
      const course = normalizeEmsCourse(
        await runNccWrite(
          request,
          response,
          (api, token) =>
            api.createCourse(token, {
              department_id: (body.departmentId as string).trim(),
              moodle_course_id: body.moodleCourseId,
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
        hasOnlyKeys(body, ["departmentId", "sortOrder", "moodleAttendanceId"])
      ) {
        response.status(400).json({ error: "Request body is invalid." });
        return;
      }
      const upstream: Record<string, unknown> = {};
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
      try {
        const room = normalizeEmsRoom(
          await runNccWrite(
            request,
            response,
            (api, token) =>
              action === "disable"
                ? api.disableRoom(token, request.params?.roomId ?? "")
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

  const classLifecycle =
    (action: "disable" | "enable") =>
    async (request: OperationalRequest, response: OperationalResponse) => {
      if (!prepareDeliveryWrite(request, response, dependencies)) return;
      try {
        const value = normalizeEmsClass(
          await runNccWrite(
            request,
            response,
            (api, token) =>
              action === "disable"
                ? api.disableClass(token, request.params?.classId ?? "")
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
        ])
      ) {
        response.status(400).json({ error: "Request body is invalid." });
        return;
      }
      const upstream = readClassFields(body, response);
      if (!upstream) return;
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
        const value = normalizeEmsClass(
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
        response.json({ class: value });
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
        hasOnlyKeys(body, ["studentId", "status"])
      ) {
        response.status(400).json({ error: "Request body is invalid." });
        return;
      }
      if (!isNonBlankString(body.studentId)) {
        response.status(400).json({ error: "studentId is required." });
        return;
      }
      if (
        body.status !== undefined &&
        body.status !== "pending" &&
        body.status !== "enrolled"
      ) {
        response.status(400).json({ error: "status is invalid." });
        return;
      }
      const studentId = (body.studentId as string).trim();
      try {
        const enrolment = normalizeEmsClassEnrolment(
          await runNccWrite(
            request,
            response,
            (api, token) =>
              api.createClassEnrolment(
                token,
                request.params?.classId ?? "",
                {
                  student_id: studentId,
                  ...(body.status !== undefined
                    ? { status: body.status }
                    : {}),
                }
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

  const enrolmentLifecycle =
    (action: "withdraw" | "complete") =>
    async (request: OperationalRequest, response: OperationalResponse) => {
      if (!prepareDeliveryWrite(request, response, dependencies)) return;
      if (!isEmptyBody(request.body)) {
        response.status(400).json({ error: "Request body is invalid." });
        return;
      }
      const studentId = (request.params?.studentId ?? "").trim();
      if (!isNonBlankString(studentId)) {
        response.status(400).json({ error: "studentId is required." });
        return;
      }
      try {
        const enrolment = normalizeEmsClassEnrolment(
          await runNccWrite(
            request,
            response,
            (api, token) =>
              action === "withdraw"
                ? api.withdrawClassEnrolment(
                    token,
                    request.params?.classId ?? "",
                    studentId
                  )
                : api.completeClassEnrolment(
                    token,
                    request.params?.classId ?? "",
                    studentId
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
    };
  app.post?.(
    "/api/ncc/delivery/classes/:classId/enrolments/:studentId/withdraw",
    enrolmentLifecycle("withdraw")
  );
  app.post?.(
    "/api/ncc/delivery/classes/:classId/enrolments/:studentId/complete",
    enrolmentLifecycle("complete")
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
        hasOnlyKeys(body, [
          "weekdays",
          "hoursPerDay",
          "fromDate",
          "toDate",
          "startHour",
        ])
      ) {
        response.status(400).json({ error: "Request body is invalid." });
        return;
      }
      if (
        !Array.isArray(body.weekdays) ||
        body.weekdays.length === 0 ||
        !body.weekdays.every(
          day => Number.isSafeInteger(day) && day >= 0 && day <= 6
        ) ||
        new Set(body.weekdays).size !== body.weekdays.length
      ) {
        response.status(400).json({ error: "weekdays is invalid." });
        return;
      }
      if (!isPositiveInteger(body.hoursPerDay)) {
        response.status(400).json({ error: "hoursPerDay is invalid." });
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
      if (
        body.startHour !== undefined &&
        (!Number.isSafeInteger(body.startHour) ||
          (body.startHour as number) < 0 ||
          (body.startHour as number) > 23)
      ) {
        response.status(400).json({ error: "startHour is invalid." });
        return;
      }
      const upstream = {
        weekdays: body.weekdays,
        hours_per_day: body.hoursPerDay,
        from_date: body.fromDate,
        to_date: body.toDate,
        ...(body.startHour !== undefined
          ? { start_hour: body.startHour }
          : {}),
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
      if (!Array.isArray(body.marks)) {
        response.status(400).json({ error: "marks is invalid." });
        return;
      }
      const students = new Set<string>();
      const marks: Array<Record<string, unknown>> = [];
      for (const mark of body.marks) {
        if (
          !isPlainObject(mark) ||
          hasOnlyKeys(mark, ["studentId", "statusId"]) !== undefined ||
          !isNonBlankString(mark.studentId) ||
          !isPositiveInteger(mark.statusId)
        ) {
          response.status(400).json({ error: "marks is invalid." });
          return;
        }
        const markStudentId = mark.studentId.trim();
        if (students.has(markStudentId)) {
          response.status(400).json({ error: "marks is invalid." });
          return;
        }
        students.add(markStudentId);
        marks.push({
          student_id: markStudentId,
          status_id: mark.statusId,
        });
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
