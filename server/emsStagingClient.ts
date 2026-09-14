/**
 * Server-only adapter for the external NCC EMS staging API.
 *
 * Boundary (AGENTS.md): the external backend team owns the staging API. This
 * module is a read-favoring proxy, not a competing backend. Tokens stay in
 * server memory keyed by our own session id and are never sent to the browser
 * beyond the normalized `me` snapshot. Nothing here logs credentials.
 */

export const EMS_STAGING_DEFAULT_TIMEOUT_MS = 15000;

// Browser-like UA: the sibling Moodle host sits behind Cloudflare bot rules
// that reject default server UAs (error 1010). The EMS host is plain nginx,
// but the same UA keeps the whole staging chain consistent.
export const EMS_STAGING_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 NileLearnEmsStaging/1.0";

export type EmsStagingRole =
  | "super_admin"
  | "branch_admin"
  | "hod"
  | "registrar"
  | "teacher";

export type EmsStagingLocalRole =
  | "superadmin"
  | "branchadmin"
  | "headofdepartment"
  | "registrar"
  | "teacher";

const EMS_TO_LOCAL_ROLE: Record<EmsStagingRole, EmsStagingLocalRole> = {
  super_admin: "superadmin",
  branch_admin: "branchadmin",
  hod: "headofdepartment",
  registrar: "registrar",
  teacher: "teacher",
};

const LOCAL_TO_EMS_ROLE: Record<EmsStagingLocalRole, EmsStagingRole> = {
  superadmin: "super_admin",
  branchadmin: "branch_admin",
  headofdepartment: "hod",
  registrar: "registrar",
  teacher: "teacher",
};

export function mapEmsRoleToLocal(role: string): EmsStagingLocalRole | null {
  if (role === "super_admin") return "superadmin";
  if (role === "branch_admin") return "branchadmin";
  if (role === "hod") return "headofdepartment";
  if (role === "registrar") return "registrar";
  if (role === "teacher") return "teacher";
  return null;
}

export function mapLocalRoleToEms(role: string): EmsStagingRole | null {
  const mapped = LOCAL_TO_EMS_ROLE[role as EmsStagingLocalRole] ?? null;
  return mapped;
}

export function isEmsStagingRole(role: string): role is EmsStagingRole {
  return role in EMS_TO_LOCAL_ROLE;
}

export type EmsStagingConfig = {
  baseUrl: string;
  timeoutMs: number;
};

export function resolveEmsStagingConfig(
  env: {
    EMS_STAGING_BASE_URL?: unknown;
    EMS_STAGING_ALLOWED_HOSTS?: unknown;
    EMS_STAGING_TIMEOUT_MS?: unknown;
  } & Record<string, unknown>
): EmsStagingConfig | null {
  const rawBaseUrl =
    typeof env.EMS_STAGING_BASE_URL === "string"
      ? env.EMS_STAGING_BASE_URL
      : "";
  const rawAllowedHosts =
    typeof env.EMS_STAGING_ALLOWED_HOSTS === "string"
      ? env.EMS_STAGING_ALLOWED_HOSTS
      : "";
  const allowedHosts = new Set(
    rawAllowedHosts
      .split(",")
      .map(host => host.trim().toLowerCase())
      .filter(Boolean)
  );
  let parsedBaseUrl: URL;
  try {
    parsedBaseUrl = new URL(rawBaseUrl.trim().replace(/\/+$/, ""));
  } catch {
    return null;
  }
  if (
    parsedBaseUrl.protocol !== "https:" ||
    parsedBaseUrl.username ||
    parsedBaseUrl.password ||
    !allowedHosts.has(parsedBaseUrl.hostname.toLowerCase())
  ) {
    return null;
  }
  const parsedTimeout = Number(env.EMS_STAGING_TIMEOUT_MS);
  const timeoutMs =
    Number.isFinite(parsedTimeout) && parsedTimeout > 0
      ? Math.min(Math.floor(parsedTimeout), 60000)
      : EMS_STAGING_DEFAULT_TIMEOUT_MS;
  return {
    baseUrl: parsedBaseUrl.toString().replace(/\/$/, ""),
    timeoutMs,
  };
}

export type EmsStagingTokens = {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: string;
  refreshTokenExpiresAt: string;
  sessionId: string;
};

type EmsAuthPayload = {
  access_token?: unknown;
  refresh_token?: unknown;
  access_token_expires_at?: unknown;
  refresh_token_expires_at?: unknown;
  session_id?: unknown;
  user?: unknown;
};

export type EmsStagingError = {
  error: string;
  status: number;
  details?: unknown;
};

/**
 * Translate EMS error payloads into our `{ error, details }` shape.
 * EMS uses `{ detail: string }`, except 422 which is `{ detail: [...] }`.
 */
export function translateEmsError(
  status: number,
  payload: unknown
): Omit<EmsStagingError, "status"> {
  if (payload && typeof payload === "object" && "detail" in payload) {
    const detail = (payload as { detail?: unknown }).detail;
    if (typeof detail === "string" && detail.trim()) {
      return { error: detail };
    }
    if (Array.isArray(detail)) {
      const first = detail.find(
        (entry): entry is { loc?: unknown; msg?: unknown } =>
          Boolean(entry) && typeof entry === "object"
      );
      const field =
        first && Array.isArray(first.loc) && first.loc.length > 0
          ? String(first.loc[first.loc.length - 1])
          : null;
      const message =
        first && typeof first.msg === "string" && first.msg.trim()
          ? first.msg.trim()
          : "Validation failed.";
      return {
        error: field ? `Validation failed: ${field} ${message}` : message,
        details: detail,
      };
    }
  }
  return { error: `Request failed with ${status}` };
}

type FetchImpl = (input: string, init?: RequestInit) => Promise<Response>;

export type EmsStagingClientOptions = {
  baseUrl: string;
  timeoutMs?: number;
  userAgent?: string;
  fetchImpl?: FetchImpl;
};

export type EmsStagingMe = {
  sessionId: string;
  userId: string;
  email: string;
  name: string;
  assignedRole: EmsStagingRole;
  activeRole: EmsStagingRole;
  workspaceBranchId: string | null;
  departmentIds: string[];
  scopes: Array<{
    scopeType: "global" | "branch";
    scopeId: string | null;
    isLive: boolean;
  }>;
};

export type EmsStagingSelfProfile = {
  firstName: string;
  lastName: string;
  phone: string | null;
  address: string | null;
  nationality: string | null;
  dateOfBirth: string | null;
  notes: string | null;
};

export type EmsStagingBranch = {
  id: string;
  name: string;
  code?: string | null;
  status: "active" | "disabled";
  timezone: string;
};

export type EmsStagingStaffUser = {
  id: string;
  email: string;
  name: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  role: EmsStagingLocalRole;
  status: "invited" | "active" | "disabled" | "canceled";
  isActive: boolean;
  scopeType: "global" | "branch";
  branchIds: string[];
  departments: Array<{
    id: string;
    name: string;
    status: "active" | "disabled";
  }>;
  moodleLinked: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
  customFields: Record<string, string | number | boolean | null>;
};

export type EmsStagingCustomFieldDefinition = {
  id: string;
  fieldKey: string;
  label: string;
  fieldType: "text" | "textarea" | "number" | "date" | "boolean" | "select";
  isRequired: boolean;
  helpText: string | null;
  options: string[] | null;
  sortOrder: number;
};

export type EmsStagingDepartment = {
  id: string;
  name: string;
  code: string | null;
  status: "active" | "disabled";
};

export type EmsStagingStudentGuardian = {
  sortOrder: 1 | 2;
  name: string;
  phone: string;
  email: string;
  relationship: string;
};

export type EmsStagingStudent = {
  id: string;
  firstName: string;
  lastName: string;
  name: string;
  email: string;
  phone: string | null;
  dateOfBirth: string | null;
  nationality: string | null;
  address: string | null;
  gender: "male" | "female" | null;
  passportNumber: string | null;
  nationalId: string | null;
  guardians: EmsStagingStudentGuardian[];
  branchId: string;
  branchName: string;
  status: "active" | "disabled";
  moodleLinked: boolean;
  createdAt: string;
  updatedAt: string;
};

export type EmsStagingStudentEnrolment = {
  classId: string;
  className: string;
  courseName: string | null;
  status: string;
  enrolledAt: string | null;
  withdrawnAt: string | null;
};

export type EmsStagingLead = {
  id: string;
  firstName: string;
  lastName: string;
  name: string;
  email: string;
  phone: string | null;
  branchId: string;
  branchName: string;
  preferredCourses: Array<{ id: string; name: string }>;
  wantsOnline: boolean;
  wantsOnsite: boolean;
  entryPath: "direct" | "placement" | "trial" | "unset" | null;
  source: string | null;
  notes: string | null;
  status:
    | "new"
    | "placement_test"
    | "trial_lesson"
    | "pending"
    | "ready"
    | "converted"
    | "cancelled";
  studentId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type EmsStagingPlacementTest = {
  id: string;
  branchId: string;
  branchName: string;
  subject: {
    type: "lead" | "student";
    id: string;
    name: string;
    email: string;
  };
  scheduledAt: string | null;
  roomId: string | null;
  roomName: string | null;
  status: "scheduled" | "completed" | "cancelled" | "no_show";
  recommendedCourseId: string | null;
  recommendedCourseName: string | null;
  resultScore: string | null;
  resultNotes: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type EmsStagingClass = {
  id: string;
  name: string;
  courseId: string;
  courseName: string;
  departmentId: string;
  departmentName: string;
  branchId: string;
  branchName: string;
  capacity: number;
  startAt: string;
  endAt: string;
  teachers: Array<{ id: string; name: string; email: string }>;
  teacherIds: string[];
  moodleGroupId: number | null;
  schedule: {
    daysOfWeek: number[] | null;
    startTime: string | null;
    endTime: string | null;
  };
  defaultRoomId: string | null;
  defaultRoomName: string | null;
  status: "active" | "disabled";
  sortOrder: number;
  activeEnrolmentCount: number;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type EmsStagingRoom = {
  id: string;
  branchId: string;
  branchName: string;
  name: string;
  capacity: number | null;
  status: "active" | "disabled";
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type EmsStagingCourse = {
  id: string;
  fullname: string;
  shortname: string;
  departmentId: string;
  departmentName: string;
  departmentStatus: "active" | "disabled";
  moodleCourseId: number;
  idNumber: string | null;
  displayName: string | null;
  categoryId: number | null;
  categoryName: string | null;
  moodleVisible: boolean | null;
  moodleAttendanceId: number | null;
  moodleRefreshedAt: string;
  moodleRefreshError: string | null;
  warnings: string[];
  status: "active" | "disabled";
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type EmsStagingMoodleCourse = {
  id: number;
  shortname: string;
  idNumber: string | null;
  fullname: string;
  displayName: string | null;
  categoryId: number | null;
  categoryName: string | null;
  visible: boolean | null;
};

export type EmsStagingMoodleCoursePicker = {
  refreshedAt: string | null;
  warnings: string[];
  error: string | null;
  courses: EmsStagingMoodleCourse[];
};

export type EmsStagingMoodleGroup = {
  id: number;
  name: string;
  idNumber: string | null;
  moodleCourseId: number;
};

export type EmsStagingClassEnrolment = {
  studentId: string;
  classId: string;
  className: string;
  courseId: string;
  courseName: string;
  status: "pending" | "enrolled" | "cancelled" | "completed";
  enrolledAt: string | null;
  withdrawnAt: string | null;
  student: {
    branchId: string;
    email: string;
    firstName: string;
    lastName: string;
    moodleLinked: boolean;
  };
};

export type EmsStagingSession = {
  id: string;
  classId: string;
  className: string;
  branchId: string;
  roomId: string | null;
  roomName: string | null;
  teacherId: string | null;
  teacherName: string | null;
  startsAt: string;
  endsAt: string;
  durationHours: number;
  status: "scheduled" | "cancelled";
  createdAt: string;
  updatedAt: string;
};

export type EmsStagingSessionSlot = {
  startsAt: string;
  durationHours: number;
  teacherId: string;
  roomId: string | null;
};

export type EmsStagingAttendanceStatus = {
  id: number;
  acronym: string | null;
  description: string | null;
};

export type EmsStagingAttendanceStudent = {
  studentId: string;
  firstName: string;
  lastName: string;
  email: string;
  moodleUserId: number | null;
  statusId: string | null;
  statusAcronym: string | null;
  statusDescription: string | null;
  remarks: string | null;
};

export type EmsStagingAttendanceDetail = {
  moodleSessionId: number;
  attendanceId: number;
  emsSessionId: string | null;
  sessionDate: string | null;
  durationSeconds: number;
  moodleGroupId: number;
  statuses: EmsStagingAttendanceStatus[];
  students: EmsStagingAttendanceStudent[];
};

export type EmsStagingGradeItem = {
  id: number;
  itemName: string | null;
  itemType: string | null;
  itemModule: string | null;
  gradeFormatted: string | null;
  percentageFormatted: string | null;
  gradeMin: number | null;
  gradeMax: number | null;
};

export type EmsStagingClassGrades = {
  classId: string;
  moodleCourseId: number;
  courseName: string | null;
  students: Array<{
    studentId: string;
    firstName: string;
    lastName: string;
    email: string;
    moodleUserId: number | null;
    courseGrade: string | null;
    gradeItems: EmsStagingGradeItem[];
  }>;
};

export type EmsStagingHealthStatus =
  | "ok"
  | "warning"
  | "error"
  | "not_configured";

export type EmsStagingSystemHealth = {
  status: "healthy" | "degraded" | "unhealthy";
  checkedAt: string;
  components: {
    api: { status: EmsStagingHealthStatus; detail: string | null };
    database: { status: EmsStagingHealthStatus; detail: string | null };
    schemaCheck: {
      status: EmsStagingHealthStatus;
      detail: string | null;
      missingTables: string[] | null;
    };
    migration: {
      status: EmsStagingHealthStatus;
      detail: string | null;
      version: string | null;
    };
    moodle: {
      status: EmsStagingHealthStatus;
      detail: string | null;
      configured: boolean | null;
      reachable: boolean | null;
      siteName: string | null;
      release: string | null;
      versionExpected: boolean | null;
      warnings: string[] | null;
    };
  };
};

export type EmsStagingDashboardCards = {
  activeStudents: number;
  openLeads: number;
  activeClasses: number;
  enrolmentFill: number;
  enrolmentCapacity: number;
  scheduledPlacements: number;
  scheduledTrials: number;
  staffCount: number | null;
};

export type EmsStagingDashboardBranch = EmsStagingDashboardCards & {
  branchId: string;
  branchName: string;
};

export type EmsStagingDashboardNamedCount = {
  key: string;
  label: string;
  count: number;
};

export type EmsStagingDashboardClassFill = {
  branchId: string;
  branchName: string;
  enrolmentFill: number;
  enrolmentCapacity: number;
  fillPct: number | null;
};

export type EmsStagingDashboardSummary = {
  cards: EmsStagingDashboardCards;
  byBranch: EmsStagingDashboardBranch[];
  charts: {
    studentsByBranch: EmsStagingDashboardNamedCount[];
    leadsByStatus: EmsStagingDashboardNamedCount[];
    placementTrialByStatus: EmsStagingDashboardNamedCount[];
    classFillByBranch: EmsStagingDashboardClassFill[];
  };
};

export type EmsStagingAuditStream =
  | "auth"
  | "branch"
  | "department"
  | "course"
  | "custom_field"
  | "moodle_site"
  | "student"
  | "lead"
  | "placement_test"
  | "class"
  | "enrolment"
  | "room"
  | "session";

export type EmsStagingAuditEvent = {
  id: string;
  stream: EmsStagingAuditStream;
  eventType: string;
  createdAt: string;
  actorDisplayName: string | null;
  actorUserId: string | null;
  branchId: string | null;
  entityId: string | null;
  entityLabel: string | null;
  secondaryEntityId: string | null;
  targetUserId: string | null;
};

export type EmsStagingNotification = {
  id: string;
  category: string;
  kind: string;
  title: string;
  body: string | null;
  createdAt: string;
  readAt: string | null;
};

export type EmsStagingTeacherWorkspace = {
  moodleSiteUrl: string | null;
  classes: Array<{
    id: string;
    name: string;
    courseName: string | null;
    status: string;
    activeEnrolmentCount: number;
    moodleCourseUrl: string | null;
  }>;
  upcomingSessions: Array<{
    id: string;
    classId: string | null;
    className: string | null;
    startsAt: string;
    endsAt: string;
    roomName: string | null;
    status: string;
  }>;
};

function normalizeEmsScopes(payload: unknown): EmsStagingMe["scopes"] | null {
  if (!Array.isArray(payload)) return null;
  const scopes = payload.map(scope => {
    if (!scope || typeof scope !== "object") return null;
    const entry = scope as Record<string, unknown>;
    const scopeType = entry.scope_type;
    const scopeId = entry.scope_id;
    const isLive = entry.is_live;
    if (
      (scopeType !== "global" && scopeType !== "branch") ||
      (scopeId !== null &&
        scopeId !== undefined &&
        typeof scopeId !== "string") ||
      (isLive !== undefined && typeof isLive !== "boolean")
    ) {
      return null;
    }
    return {
      scopeType,
      scopeId: typeof scopeId === "string" ? scopeId : null,
      isLive: isLive ?? true,
    };
  });
  return scopes.some(scope => scope === null)
    ? null
    : (scopes as EmsStagingMe["scopes"]);
}

function normalizeMe(payload: unknown): EmsStagingMe | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  const user =
    record.user && typeof record.user === "object"
      ? (record.user as Record<string, unknown>)
      : null;
  const profile =
    user?.profile && typeof user.profile === "object"
      ? (user.profile as Record<string, unknown>)
      : null;
  const assignedRole =
    typeof record.assigned_role === "string" ? record.assigned_role : "";
  const activeRole =
    typeof record.active_role === "string" ? record.active_role : "";
  const sessionId =
    typeof record.session_id === "string" ? record.session_id : "";
  const userId = typeof user?.id === "string" ? user.id : "";
  const email = typeof user?.email === "string" ? user.email : "";
  if (
    !isEmsStagingRole(assignedRole) ||
    !isEmsStagingRole(activeRole) ||
    !sessionId ||
    !userId ||
    !email ||
    !Array.isArray(record.scopes)
  ) {
    return null;
  }
  const scopes = normalizeEmsScopes(record.scopes);
  if (!scopes) return null;
  const departments = Array.isArray(user?.departments) ? user.departments : [];
  const departmentIds = departments.map(department => {
    if (!department || typeof department !== "object") return null;
    const id = (department as Record<string, unknown>).department_id;
    return typeof id === "string" && id ? id : null;
  });
  if (departmentIds.some(id => id === null)) return null;
  const firstName =
    typeof profile?.first_name === "string" ? profile.first_name.trim() : "";
  const lastName =
    typeof profile?.last_name === "string" ? profile.last_name.trim() : "";
  return {
    sessionId,
    userId,
    email,
    name: [firstName, lastName].filter(Boolean).join(" ") || email,
    assignedRole,
    activeRole,
    workspaceBranchId:
      typeof record.workspace_branch_id === "string"
        ? record.workspace_branch_id
        : null,
    departmentIds: departmentIds as string[],
    scopes: scopes as EmsStagingMe["scopes"],
  };
}

export function normalizeEmsBranches(
  payload: unknown
): EmsStagingBranch[] | null {
  if (!Array.isArray(payload)) return null;
  const branches = payload.map(value => {
    if (!value || typeof value !== "object") return null;
    const record = value as Record<string, unknown>;
    if (
      typeof record.id !== "string" ||
      !record.id ||
      typeof record.name !== "string" ||
      !record.name ||
      (record.code !== null &&
        record.code !== undefined &&
        typeof record.code !== "string") ||
      (record.status !== "active" && record.status !== "disabled") ||
      typeof record.timezone !== "string" ||
      !record.timezone
    ) {
      return null;
    }
    return {
      id: record.id,
      name: record.name,
      ...(record.code !== undefined
        ? { code: record.code as string | null }
        : {}),
      status: record.status,
      timezone: record.timezone,
    };
  });
  return branches.some(branch => branch === null)
    ? null
    : (branches as EmsStagingBranch[]);
}

function normalizeCustomFieldValues(
  payload: unknown
): EmsStagingStaffUser["customFields"] | null {
  if (
    !payload ||
    typeof payload !== "object" ||
    Array.isArray(payload) ||
    (Object.getPrototypeOf(payload) !== Object.prototype &&
      Object.getPrototypeOf(payload) !== null)
  ) {
    return null;
  }
  const entries = Object.entries(payload as Record<string, unknown>);
  if (
    entries.some(
      ([, value]) =>
        value !== null &&
        typeof value !== "string" &&
        typeof value !== "number" &&
        typeof value !== "boolean"
    )
  ) {
    return null;
  }
  return Object.fromEntries(entries) as EmsStagingStaffUser["customFields"];
}

function normalizeStaffDepartments(
  payload: unknown
): EmsStagingStaffUser["departments"] | null {
  if (payload === null || payload === undefined) return [];
  if (!Array.isArray(payload)) return null;
  const departments = payload.map(value => {
    if (!value || typeof value !== "object") return null;
    const record = value as Record<string, unknown>;
    if (
      typeof record.department_id !== "string" ||
      !record.department_id ||
      typeof record.name !== "string" ||
      !record.name ||
      (record.status !== "active" && record.status !== "disabled")
    ) {
      return null;
    }
    return {
      id: record.department_id,
      name: record.name,
      status: record.status,
    };
  });
  return departments.some(department => department === null)
    ? null
    : (departments as EmsStagingStaffUser["departments"]);
}

export function normalizeEmsStaffUser(
  payload: unknown
): EmsStagingStaffUser | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  const profileValue = record.profile;
  if (
    profileValue !== null &&
    profileValue !== undefined &&
    typeof profileValue !== "object"
  ) {
    return null;
  }
  const profile =
    profileValue && typeof profileValue === "object"
      ? (profileValue as Record<string, unknown>)
      : null;
  if (
    (profile?.first_name !== undefined &&
      typeof profile.first_name !== "string") ||
    (profile?.last_name !== undefined &&
      typeof profile.last_name !== "string") ||
    (profile?.phone !== undefined &&
      profile.phone !== null &&
      typeof profile.phone !== "string")
  ) {
    return null;
  }
  const role =
    typeof record.assigned_role === "string"
      ? mapEmsRoleToLocal(record.assigned_role)
      : null;
  const scopes = normalizeEmsScopes(record.scopes);
  const departments = normalizeStaffDepartments(record.departments);
  const customFields =
    record.custom_fields === undefined
      ? {}
      : normalizeCustomFieldValues(record.custom_fields);
  const lastLoginAt = record.last_login_at;
  if (
    typeof record.id !== "string" ||
    !record.id ||
    typeof record.email !== "string" ||
    !record.email ||
    !role ||
    (record.status !== "invited" &&
      record.status !== "active" &&
      record.status !== "disabled" &&
      record.status !== "canceled") ||
    typeof record.is_active !== "boolean" ||
    !scopes ||
    !departments ||
    !customFields ||
    (record.moodle_user_id !== null &&
      record.moodle_user_id !== undefined &&
      (!Number.isSafeInteger(record.moodle_user_id) ||
        (record.moodle_user_id as number) < 1)) ||
    (lastLoginAt !== null &&
      lastLoginAt !== undefined &&
      (typeof lastLoginAt !== "string" ||
        !Number.isFinite(Date.parse(lastLoginAt)))) ||
    typeof record.created_at !== "string" ||
    !Number.isFinite(Date.parse(record.created_at)) ||
    typeof record.updated_at !== "string" ||
    !Number.isFinite(Date.parse(record.updated_at))
  ) {
    return null;
  }
  const firstName =
    typeof profile?.first_name === "string" ? profile.first_name.trim() : "";
  const lastName =
    typeof profile?.last_name === "string" ? profile.last_name.trim() : "";
  const phone =
    typeof profile?.phone === "string" && profile.phone.trim()
      ? profile.phone.trim()
      : null;
  return {
    id: record.id,
    email: record.email,
    name: [firstName, lastName].filter(Boolean).join(" ") || record.email,
    firstName,
    lastName,
    phone,
    role,
    status: record.status,
    isActive: record.is_active,
    scopeType: scopes.some(scope => scope.scopeType === "global")
      ? "global"
      : "branch",
    branchIds: Array.from(
      new Set(
        scopes
          .filter(
            scope =>
              scope.scopeType === "branch" && scope.isLive && scope.scopeId
          )
          .map(scope => scope.scopeId as string)
      )
    ),
    departments,
    moodleLinked:
      record.moodle_user_id !== null && record.moodle_user_id !== undefined,
    lastLoginAt: typeof lastLoginAt === "string" ? lastLoginAt : null,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
    customFields,
  };
}

export function normalizeEmsStaffUsers(
  payload: unknown
): EmsStagingStaffUser[] | null {
  if (!Array.isArray(payload)) return null;
  const users = payload.map(normalizeEmsStaffUser);
  return users.some(user => user === null)
    ? null
    : (users as EmsStagingStaffUser[]);
}

export function normalizeEmsDepartments(
  payload: unknown
): EmsStagingDepartment[] | null {
  if (!Array.isArray(payload)) return null;
  const departments = payload.map(value => {
    if (!value || typeof value !== "object") return null;
    const record = value as Record<string, unknown>;
    if (
      typeof record.id !== "string" ||
      !record.id ||
      typeof record.name !== "string" ||
      !record.name ||
      (record.code !== null && typeof record.code !== "string") ||
      (record.status !== "active" && record.status !== "disabled")
    ) {
      return null;
    }
    return {
      id: record.id,
      name: record.name,
      code: record.code,
      status: record.status,
    };
  });
  return departments.some(department => department === null)
    ? null
    : (departments as EmsStagingDepartment[]);
}

export function normalizeEmsCustomFieldDefinitions(
  payload: unknown
): EmsStagingCustomFieldDefinition[] | null {
  if (!Array.isArray(payload)) return null;
  const definitions = payload.map(value => {
    if (!value || typeof value !== "object") return null;
    const record = value as Record<string, unknown>;
    const options = record.options_json;
    if (
      typeof record.id !== "string" ||
      !record.id ||
      record.entity_type !== "user_profile" ||
      typeof record.field_key !== "string" ||
      !record.field_key ||
      typeof record.label !== "string" ||
      !record.label ||
      (record.field_type !== "text" &&
        record.field_type !== "textarea" &&
        record.field_type !== "number" &&
        record.field_type !== "date" &&
        record.field_type !== "boolean" &&
        record.field_type !== "select") ||
      typeof record.is_required !== "boolean" ||
      typeof record.is_active !== "boolean" ||
      !record.is_active ||
      !Number.isSafeInteger(record.sort_order) ||
      (record.help_text !== null &&
        record.help_text !== undefined &&
        typeof record.help_text !== "string") ||
      (options !== null &&
        options !== undefined &&
        (!Array.isArray(options) ||
          !options.every(option => typeof option === "string")))
    ) {
      return null;
    }
    return {
      id: record.id,
      fieldKey: record.field_key,
      label: record.label,
      fieldType: record.field_type,
      isRequired: record.is_required,
      helpText: typeof record.help_text === "string" ? record.help_text : null,
      options: Array.isArray(options) ? options : null,
      sortOrder: record.sort_order as number,
    };
  });
  return definitions.some(definition => definition === null)
    ? null
    : (definitions as EmsStagingCustomFieldDefinition[]);
}

function isNullableString(value: unknown) {
  return value === null || value === undefined || typeof value === "string";
}

function isNullableTimestamp(value: unknown) {
  return (
    value === null ||
    value === undefined ||
    (typeof value === "string" && Number.isFinite(Date.parse(value)))
  );
}

function nullableString(value: unknown) {
  return typeof value === "string" ? value : null;
}

function isPositiveIntegerOrNull(value: unknown) {
  return (
    value === null ||
    value === undefined ||
    (Number.isSafeInteger(value) && (value as number) > 0)
  );
}

function isNonNegativeInteger(value: unknown) {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

function httpsUrl(value: unknown) {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function normalizeRows<T>(
  payload: unknown,
  normalize: (value: unknown) => T | null
): T[] | null {
  if (!Array.isArray(payload)) return null;
  const rows = payload.map(normalize);
  return rows.some(row => row === null) ? null : (rows as T[]);
}

function normalizeEmsStudentGuardian(
  payload: unknown
): EmsStagingStudentGuardian | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  if (
    (record.sort_order !== 1 && record.sort_order !== 2) ||
    typeof record.name !== "string" ||
    !record.name ||
    typeof record.phone !== "string" ||
    !record.phone ||
    typeof record.email !== "string" ||
    !record.email ||
    typeof record.relationship !== "string" ||
    !record.relationship
  ) {
    return null;
  }
  return {
    sortOrder: record.sort_order,
    name: record.name,
    phone: record.phone,
    email: record.email,
    relationship: record.relationship,
  };
}

export function normalizeEmsStudent(
  payload: unknown
): EmsStagingStudent | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  if (
    typeof record.id !== "string" ||
    !record.id ||
    typeof record.first_name !== "string" ||
    typeof record.last_name !== "string" ||
    typeof record.email !== "string" ||
    !record.email ||
    !isNullableString(record.phone) ||
    !isNullableString(record.date_of_birth) ||
    !isNullableString(record.nationality) ||
    !isNullableString(record.address) ||
    (record.gender !== undefined &&
      record.gender !== null &&
      record.gender !== "male" &&
      record.gender !== "female") ||
    !isNullableString(record.passport_number) ||
    !isNullableString(record.national_id) ||
    typeof record.branch_id !== "string" ||
    !record.branch_id ||
    typeof record.branch_name !== "string" ||
    !record.branch_name ||
    (record.status !== "active" && record.status !== "disabled") ||
    !isPositiveIntegerOrNull(record.moodle_user_id) ||
    (record.guardians !== undefined && !Array.isArray(record.guardians)) ||
    typeof record.created_at !== "string" ||
    !record.created_at ||
    typeof record.updated_at !== "string" ||
    !record.updated_at
  ) {
    return null;
  }
  const guardianRows = record.guardians ?? [];
  const guardians = normalizeRows(guardianRows, normalizeEmsStudentGuardian);
  if (
    !guardians ||
    guardians.length > 2 ||
    new Set(guardians.map(guardian => guardian.sortOrder)).size !==
      guardians.length
  ) {
    return null;
  }
  guardians.sort((a, b) => a.sortOrder - b.sortOrder);
  const firstName = record.first_name.trim();
  const lastName = record.last_name.trim();
  return {
    id: record.id,
    firstName,
    lastName,
    name: [firstName, lastName].filter(Boolean).join(" ") || record.email,
    email: record.email,
    phone: nullableString(record.phone),
    dateOfBirth: nullableString(record.date_of_birth),
    nationality: nullableString(record.nationality),
    address: nullableString(record.address),
    gender: (record.gender as "male" | "female" | null | undefined) ?? null,
    passportNumber: nullableString(record.passport_number),
    nationalId: nullableString(record.national_id),
    guardians,
    branchId: record.branch_id,
    branchName: record.branch_name,
    status: record.status,
    moodleLinked:
      record.moodle_user_id !== null && record.moodle_user_id !== undefined,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
  };
}

export function normalizeEmsStudents(
  payload: unknown
): EmsStagingStudent[] | null {
  return normalizeRows(payload, normalizeEmsStudent);
}

function normalizeEmsStudentEnrolment(
  payload: unknown
): EmsStagingStudentEnrolment | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  const summary =
    record.class_summary && typeof record.class_summary === "object"
      ? (record.class_summary as Record<string, unknown>)
      : null;
  if (
    typeof record.class_id !== "string" ||
    !record.class_id ||
    typeof record.status !== "string" ||
    !record.status ||
    !isNullableString(record.enrolled_at) ||
    !isNullableString(record.withdrawn_at) ||
    !summary ||
    typeof summary.class_name !== "string" ||
    !summary.class_name ||
    !isNullableString(summary.course_name)
  ) {
    return null;
  }
  return {
    classId: record.class_id,
    className: summary.class_name,
    courseName: nullableString(summary.course_name),
    status: record.status,
    enrolledAt: nullableString(record.enrolled_at),
    withdrawnAt: nullableString(record.withdrawn_at),
  };
}

export function normalizeEmsStudentEnrolments(
  payload: unknown
): EmsStagingStudentEnrolment[] | null {
  return normalizeRows(payload, normalizeEmsStudentEnrolment);
}

const LEAD_STATUSES = [
  "new",
  "placement_test",
  "trial_lesson",
  "pending",
  "ready",
  "converted",
  "cancelled",
] as const;
const LEAD_ENTRY_PATHS = ["direct", "placement", "trial", "unset"] as const;

function normalizeEmsPreferredCourse(
  payload: unknown
): { id: string; name: string } | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  if (
    typeof record.course_id !== "string" ||
    !record.course_id ||
    typeof record.course_name !== "string" ||
    !record.course_name
  ) {
    return null;
  }
  return { id: record.course_id, name: record.course_name };
}

export function normalizeEmsLead(payload: unknown): EmsStagingLead | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  const optionalValues = [
    record.phone,
    record.source,
    record.notes,
    record.student_id,
  ];
  if (
    typeof record.id !== "string" ||
    !record.id ||
    typeof record.first_name !== "string" ||
    typeof record.last_name !== "string" ||
    typeof record.email !== "string" ||
    !record.email ||
    typeof record.branch_id !== "string" ||
    !record.branch_id ||
    typeof record.branch_name !== "string" ||
    !record.branch_name ||
    !optionalValues.every(isNullableString) ||
    (record.preferred_courses !== undefined &&
      !Array.isArray(record.preferred_courses)) ||
    (record.wants_online !== undefined &&
      typeof record.wants_online !== "boolean") ||
    (record.wants_onsite !== undefined &&
      typeof record.wants_onsite !== "boolean") ||
    (record.entry_path !== undefined &&
      record.entry_path !== null &&
      !LEAD_ENTRY_PATHS.includes(
        record.entry_path as (typeof LEAD_ENTRY_PATHS)[number]
      )) ||
    !LEAD_STATUSES.includes(
      record.status as (typeof LEAD_STATUSES)[number]
    ) ||
    typeof record.created_at !== "string" ||
    !record.created_at ||
    typeof record.updated_at !== "string" ||
    !record.updated_at
  ) {
    return null;
  }
  const preferredCourses = normalizeRows(
    record.preferred_courses ?? [],
    normalizeEmsPreferredCourse
  );
  if (!preferredCourses) return null;
  const firstName = record.first_name.trim();
  const lastName = record.last_name.trim();
  return {
    id: record.id,
    firstName,
    lastName,
    name: [firstName, lastName].filter(Boolean).join(" ") || record.email,
    email: record.email,
    phone: nullableString(record.phone),
    branchId: record.branch_id,
    branchName: record.branch_name,
    preferredCourses,
    wantsOnline: record.wants_online === true,
    wantsOnsite: record.wants_onsite === true,
    entryPath:
      (record.entry_path as EmsStagingLead["entryPath"] | undefined) ?? null,
    source: nullableString(record.source),
    notes: nullableString(record.notes),
    status: record.status as EmsStagingLead["status"],
    studentId: nullableString(record.student_id),
    createdAt: record.created_at,
    updatedAt: record.updated_at,
  };
}

export function normalizeEmsLeads(payload: unknown): EmsStagingLead[] | null {
  return normalizeRows(payload, normalizeEmsLead);
}

export function normalizeEmsPlacementTest(
  payload: unknown
): EmsStagingPlacementTest | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  const subject =
    record.subject && typeof record.subject === "object"
      ? (record.subject as Record<string, unknown>)
      : null;
  const optionalValues = [
    record.scheduled_at,
    record.room_id,
    record.room_name,
    record.recommended_course_id,
    record.recommended_course_name,
    record.result_score,
    record.result_notes,
    record.completed_at,
    record.cancelled_at,
    record.created_at,
    record.updated_at,
  ];
  if (
    typeof record.id !== "string" ||
    !record.id ||
    typeof record.branch_id !== "string" ||
    !record.branch_id ||
    typeof record.branch_name !== "string" ||
    !record.branch_name ||
    !subject ||
    (subject.subject_type !== "lead" && subject.subject_type !== "student") ||
    typeof subject.subject_id !== "string" ||
    !subject.subject_id ||
    typeof subject.first_name !== "string" ||
    typeof subject.last_name !== "string" ||
    typeof subject.email !== "string" ||
    !subject.email ||
    !optionalValues.every(isNullableString) ||
    (record.status !== "scheduled" &&
      record.status !== "completed" &&
      record.status !== "cancelled" &&
      record.status !== "no_show")
  ) {
    return null;
  }
  const subjectName = [subject.first_name.trim(), subject.last_name.trim()]
    .filter(Boolean)
    .join(" ");
  return {
    id: record.id,
    branchId: record.branch_id,
    branchName: record.branch_name,
    subject: {
      type: subject.subject_type,
      id: subject.subject_id,
      name: subjectName || subject.email,
      email: subject.email,
    },
    scheduledAt: nullableString(record.scheduled_at),
    roomId: nullableString(record.room_id),
    roomName: nullableString(record.room_name),
    status: record.status,
    recommendedCourseId: nullableString(record.recommended_course_id),
    recommendedCourseName: nullableString(record.recommended_course_name),
    resultScore: nullableString(record.result_score),
    resultNotes: nullableString(record.result_notes),
    completedAt: nullableString(record.completed_at),
    cancelledAt: nullableString(record.cancelled_at),
    createdAt: nullableString(record.created_at),
    updatedAt: nullableString(record.updated_at),
  };
}

export function normalizeEmsPlacementTests(
  payload: unknown
): EmsStagingPlacementTest[] | null {
  return normalizeRows(payload, normalizeEmsPlacementTest);
}

function normalizeClassTeacher(
  payload: unknown
): EmsStagingClass["teachers"][number] | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  if (
    typeof record.id !== "string" ||
    !record.id ||
    typeof record.first_name !== "string" ||
    typeof record.last_name !== "string" ||
    typeof record.email !== "string" ||
    !record.email
  ) {
    return null;
  }
  const name = [record.first_name.trim(), record.last_name.trim()]
    .filter(Boolean)
    .join(" ");
  return { id: record.id, name: name || record.email, email: record.email };
}

export function normalizeEmsClass(payload: unknown): EmsStagingClass | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  const teachers = normalizeRows(record.teachers, normalizeClassTeacher);
  const days = record.schedule_days_of_week;
  const teacherIds = record.teacher_ids;
  const warnings = record.warnings;
  if (
    !Array.isArray(teacherIds) ||
    !teacherIds.every(
      item => typeof item === "string" && item.length > 0
    ) ||
    (warnings !== undefined &&
      (!Array.isArray(warnings) ||
        !warnings.every(item => typeof item === "string"))) ||
    !Number.isSafeInteger(record.sort_order) ||
    !isNullableString(record.created_by) ||

    typeof record.id !== "string" ||
    !record.id ||
    typeof record.name !== "string" ||
    !record.name ||
    typeof record.course_id !== "string" ||
    !record.course_id ||
    typeof record.course_name !== "string" ||
    !record.course_name ||
    typeof record.department_id !== "string" ||
    !record.department_id ||
    typeof record.department_name !== "string" ||
    !record.department_name ||
    typeof record.branch_id !== "string" ||
    !record.branch_id ||
    typeof record.branch_name !== "string" ||
    !record.branch_name ||
    !isNonNegativeInteger(record.capacity) ||
    typeof record.start_at !== "string" ||
    !record.start_at ||
    typeof record.end_at !== "string" ||
    !record.end_at ||
    !teachers ||
    !isPositiveIntegerOrNull(record.moodle_group_id) ||
    (days !== null &&
      days !== undefined &&
      (!Array.isArray(days) ||
        !days.every(
          day => Number.isSafeInteger(day) && day >= 0 && day <= 6
        ))) ||
    !isNullableString(record.schedule_start_time) ||
    !isNullableString(record.schedule_end_time) ||
    !isNullableString(record.default_room_id) ||
    !isNullableString(record.default_room_name) ||
    (record.status !== "active" && record.status !== "disabled") ||
    !isNonNegativeInteger(record.active_enrolment_count) ||
    typeof record.created_at !== "string" ||
    !record.created_at ||
    typeof record.updated_at !== "string" ||
    !record.updated_at
  ) {
    return null;
  }
  return {
    id: record.id,
    name: record.name,
    courseId: record.course_id,
    courseName: record.course_name,
    departmentId: record.department_id,
    departmentName: record.department_name,
    branchId: record.branch_id,
    branchName: record.branch_name,
    capacity: record.capacity as number,
    startAt: record.start_at,
    endAt: record.end_at,
    teachers,
    teacherIds: teacherIds as string[],
    moodleGroupId:
      typeof record.moodle_group_id === "number"
        ? record.moodle_group_id
        : null,
    schedule: {
      daysOfWeek: Array.isArray(days) ? days : null,
      startTime: nullableString(record.schedule_start_time),
      endTime: nullableString(record.schedule_end_time),
    },
    defaultRoomId: nullableString(record.default_room_id),
    defaultRoomName: nullableString(record.default_room_name),
    status: record.status,
    sortOrder: record.sort_order as number,
    activeEnrolmentCount: record.active_enrolment_count as number,
    createdBy: nullableString(record.created_by),
    createdAt: record.created_at,
    updatedAt: record.updated_at,
  };
}

export function normalizeEmsClasses(
  payload: unknown
): EmsStagingClass[] | null {
  return normalizeRows(payload, normalizeEmsClass);
}

export function normalizeEmsRoom(payload: unknown): EmsStagingRoom | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  if (
    typeof record.id !== "string" ||
    !record.id ||
    typeof record.branch_id !== "string" ||
    !record.branch_id ||
    typeof record.branch_name !== "string" ||
    !record.branch_name ||
    typeof record.name !== "string" ||
    !record.name ||
    (record.capacity !== null &&
      record.capacity !== undefined &&
      !isNonNegativeInteger(record.capacity)) ||
    (record.status !== "active" && record.status !== "disabled") ||
    !Number.isSafeInteger(record.sort_order) ||
    typeof record.created_at !== "string" ||
    !record.created_at ||
    typeof record.updated_at !== "string" ||
    !record.updated_at
  ) {
    return null;
  }
  return {
    id: record.id,
    branchId: record.branch_id,
    branchName: record.branch_name,
    name: record.name,
    capacity: typeof record.capacity === "number" ? record.capacity : null,
    status: record.status,
    sortOrder: record.sort_order as number,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
  };
}

export function normalizeEmsRooms(payload: unknown): EmsStagingRoom[] | null {
  return normalizeRows(payload, normalizeEmsRoom);
}

export function normalizeEmsCourse(
  payload: unknown
): EmsStagingCourse | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  if (
    typeof record.id !== "string" ||
    !record.id ||
    typeof record.fullname !== "string" ||
    !record.fullname ||
    typeof record.shortname !== "string" ||
    !record.shortname ||
    typeof record.department_id !== "string" ||
    !record.department_id ||
    typeof record.department_name !== "string" ||
    !record.department_name ||
    (record.department_status !== "active" &&
      record.department_status !== "disabled") ||
    !Number.isSafeInteger(record.moodle_course_id) ||
    (record.moodle_course_id as number) < 1 ||
    !isNullableString(record.idnumber) ||
    !isNullableString(record.displayname) ||
    (record.category_id !== null &&
      record.category_id !== undefined &&
      !Number.isSafeInteger(record.category_id)) ||
    !isNullableString(record.category_name) ||
    (record.moodle_visible !== null &&
      record.moodle_visible !== undefined &&
      typeof record.moodle_visible !== "boolean") ||
    !isPositiveIntegerOrNull(record.moodle_attendance_id) ||
    typeof record.moodle_refreshed_at !== "string" ||
    !record.moodle_refreshed_at ||
    !isNullableString(record.moodle_refresh_error) ||
    !Array.isArray(record.warnings) ||
    !record.warnings.every(item => typeof item === "string") ||
    (record.status !== "active" && record.status !== "disabled") ||
    !Number.isSafeInteger(record.sort_order) ||
    typeof record.created_at !== "string" ||
    !record.created_at ||
    typeof record.updated_at !== "string" ||
    !record.updated_at
  ) {
    return null;
  }
  return {
    id: record.id,
    fullname: record.fullname,
    shortname: record.shortname,
    departmentId: record.department_id,
    departmentName: record.department_name,
    departmentStatus: record.department_status,
    moodleCourseId: record.moodle_course_id as number,
    idNumber: nullableString(record.idnumber),
    displayName: nullableString(record.displayname),
    categoryId:
      typeof record.category_id === "number" ? record.category_id : null,
    categoryName: nullableString(record.category_name),
    moodleVisible:
      typeof record.moodle_visible === "boolean"
        ? record.moodle_visible
        : null,
    moodleAttendanceId:
      typeof record.moodle_attendance_id === "number"
        ? record.moodle_attendance_id
        : null,
    moodleRefreshedAt: record.moodle_refreshed_at,
    moodleRefreshError: nullableString(record.moodle_refresh_error),
    warnings: record.warnings as string[],
    status: record.status,
    sortOrder: record.sort_order as number,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
  };
}

export function normalizeEmsCourses(
  payload: unknown
): EmsStagingCourse[] | null {
  return normalizeRows(payload, normalizeEmsCourse);
}

function normalizeEmsMoodleCourse(
  payload: unknown
): EmsStagingMoodleCourse | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  if (
    !Number.isSafeInteger(record.id) ||
    (record.id as number) < 1 ||
    typeof record.shortname !== "string" ||
    !record.shortname ||
    typeof record.fullname !== "string" ||
    !record.fullname ||
    !isNullableString(record.idnumber) ||
    !isNullableString(record.displayname) ||
    (record.category_id !== null &&
      record.category_id !== undefined &&
      !Number.isSafeInteger(record.category_id)) ||
    !isNullableString(record.category_name) ||
    (record.visible !== null &&
      record.visible !== undefined &&
      typeof record.visible !== "boolean")
  ) {
    return null;
  }
  return {
    id: record.id as number,
    shortname: record.shortname,
    idNumber: nullableString(record.idnumber),
    fullname: record.fullname,
    displayName: nullableString(record.displayname),
    categoryId:
      typeof record.category_id === "number" ? record.category_id : null,
    categoryName: nullableString(record.category_name),
    visible: typeof record.visible === "boolean" ? record.visible : null,
  };
}

export function normalizeEmsMoodleCoursePicker(
  payload: unknown
): EmsStagingMoodleCoursePicker | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  const courses = normalizeRows(record.courses, normalizeEmsMoodleCourse);
  if (
    !isNullableString(record.catalog_refreshed_at) ||
    !Array.isArray(record.warnings) ||
    !record.warnings.every(item => typeof item === "string") ||
    !isNullableString(record.error) ||
    !courses
  ) {
    return null;
  }
  return {
    refreshedAt: nullableString(record.catalog_refreshed_at),
    warnings: record.warnings as string[],
    error: nullableString(record.error),
    courses,
  };
}

const ENROLMENT_STATUSES = [
  "pending",
  "enrolled",
  "cancelled",
  "completed",
] as const;

const SESSION_STATUSES = ["scheduled", "cancelled"] as const;

export function normalizeEmsClassEnrolment(
  payload: unknown
): EmsStagingClassEnrolment | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  const student =
    record.student && typeof record.student === "object"
      ? (record.student as Record<string, unknown>)
      : null;
  if (
    typeof record.student_id !== "string" ||
    !record.student_id ||
    typeof record.class_id !== "string" ||
    !record.class_id ||
    typeof record.class_name !== "string" ||
    !record.class_name ||
    typeof record.course_id !== "string" ||
    !record.course_id ||
    typeof record.course_name !== "string" ||
    !record.course_name ||
    !ENROLMENT_STATUSES.includes(
      record.status as (typeof ENROLMENT_STATUSES)[number]
    ) ||
    !isNullableTimestamp(record.enrolled_at) ||
    !isNullableTimestamp(record.withdrawn_at) ||
    !student ||
    typeof student.branch_id !== "string" ||
    !student.branch_id ||
    typeof student.email !== "string" ||
    !student.email ||
    typeof student.first_name !== "string" ||
    typeof student.last_name !== "string" ||
    !isPositiveIntegerOrNull(student.moodle_user_id)
  ) {
    return null;
  }
  return {
    studentId: record.student_id,
    classId: record.class_id,
    className: record.class_name,
    courseId: record.course_id,
    courseName: record.course_name,
    status: record.status as EmsStagingClassEnrolment["status"],
    enrolledAt: nullableString(record.enrolled_at),
    withdrawnAt: nullableString(record.withdrawn_at),
    student: {
      branchId: student.branch_id,
      email: student.email,
      firstName: student.first_name,
      lastName: student.last_name,
      moodleLinked:
        student.moodle_user_id !== null &&
        student.moodle_user_id !== undefined,
    },
  };
}

export function normalizeEmsClassEnrolments(
  payload: unknown
): EmsStagingClassEnrolment[] | null {
  return normalizeRows(payload, normalizeEmsClassEnrolment);
}

export function normalizeEmsSession(
  payload: unknown
): EmsStagingSession | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  if (
    typeof record.id !== "string" ||
    !record.id ||
    typeof record.class_id !== "string" ||
    !record.class_id ||
    typeof record.class_name !== "string" ||
    !record.class_name ||
    typeof record.branch_id !== "string" ||
    !record.branch_id ||
    !isNullableString(record.room_id) ||
    !isNullableString(record.room_name) ||
    !isNullableString(record.teacher_id) ||
    !isNullableString(record.teacher_name) ||
    typeof record.starts_at !== "string" ||
    !Number.isFinite(Date.parse(record.starts_at)) ||
    typeof record.ends_at !== "string" ||
    !Number.isFinite(Date.parse(record.ends_at)) ||
    !Number.isSafeInteger(record.duration_hours) ||
    (record.duration_hours as number) < 1 ||
    !SESSION_STATUSES.includes(
      record.status as (typeof SESSION_STATUSES)[number]
    ) ||
    typeof record.created_at !== "string" ||
    !Number.isFinite(Date.parse(record.created_at)) ||
    typeof record.updated_at !== "string" ||
    !Number.isFinite(Date.parse(record.updated_at))
  ) {
    return null;
  }
  return {
    id: record.id,
    classId: record.class_id,
    className: record.class_name,
    branchId: record.branch_id,
    roomId: nullableString(record.room_id),
    roomName: nullableString(record.room_name),
    teacherId: nullableString(record.teacher_id),
    teacherName: nullableString(record.teacher_name),
    startsAt: record.starts_at,
    endsAt: record.ends_at,
    durationHours: record.duration_hours as number,
    status: record.status as EmsStagingSession["status"],
    createdAt: record.created_at,
    updatedAt: record.updated_at,
  };
}

export function normalizeEmsSessions(
  payload: unknown
): EmsStagingSession[] | null {
  return normalizeRows(payload, normalizeEmsSession);
}

function normalizeEmsSessionSlot(
  payload: unknown
): EmsStagingSessionSlot | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  if (
    typeof record.starts_at !== "string" ||
    !Number.isFinite(Date.parse(record.starts_at)) ||
    !Number.isSafeInteger(record.duration_hours) ||
    (record.duration_hours as number) < 1 ||
    typeof record.teacher_id !== "string" ||
    !record.teacher_id ||
    !isNullableString(record.room_id)
  ) {
    return null;
  }
  return {
    startsAt: record.starts_at,
    durationHours: record.duration_hours as number,
    teacherId: record.teacher_id,
    roomId: nullableString(record.room_id),
  };
}

export function normalizeEmsSessionSlots(
  payload: unknown
): EmsStagingSessionSlot[] | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  return normalizeRows(record.slots, normalizeEmsSessionSlot);
}

export function normalizeEmsSessionBatch(
  payload: unknown
): { items: EmsStagingSession[]; createdCount: number } | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  const sessions = normalizeRows(record.sessions, normalizeEmsSession);
  if (
    !Number.isSafeInteger(record.created_count) ||
    (record.created_count as number) < 0 ||
    !sessions
  ) {
    return null;
  }
  return { items: sessions, createdCount: record.created_count as number };
}

function normalizeEmsAttendanceStatus(
  payload: unknown
): EmsStagingAttendanceStatus | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  if (
    !Number.isSafeInteger(record.id) ||
    (record.id as number) < 1 ||
    !isNullableString(record.acronym) ||
    !isNullableString(record.description)
  ) {
    return null;
  }
  return {
    id: record.id as number,
    acronym: nullableString(record.acronym),
    description: nullableString(record.description),
  };
}

function normalizeEmsAttendanceStudent(
  payload: unknown
): EmsStagingAttendanceStudent | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  if (
    typeof record.student_id !== "string" ||
    !record.student_id ||
    typeof record.first_name !== "string" ||
    typeof record.last_name !== "string" ||
    typeof record.email !== "string" ||
    !record.email ||
    !isPositiveIntegerOrNull(record.moodle_user_id) ||
    !isNullableString(record.status_id) ||
    !isNullableString(record.status_acronym) ||
    !isNullableString(record.status_description) ||
    !isNullableString(record.remarks)
  ) {
    return null;
  }
  return {
    studentId: record.student_id,
    firstName: record.first_name,
    lastName: record.last_name,
    email: record.email,
    moodleUserId:
      typeof record.moodle_user_id === "number" ? record.moodle_user_id : null,
    statusId: nullableString(record.status_id),
    statusAcronym: nullableString(record.status_acronym),
    statusDescription: nullableString(record.status_description),
    remarks: nullableString(record.remarks),
  };
}

export function normalizeEmsAttendanceDetail(
  payload: unknown
): EmsStagingAttendanceDetail | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  const statuses = normalizeRows(
    record.statuses,
    normalizeEmsAttendanceStatus
  );
  const students = normalizeRows(
    record.students,
    normalizeEmsAttendanceStudent
  );
  if (
    !Number.isSafeInteger(record.moodle_session_id) ||
    (record.moodle_session_id as number) < 1 ||
    !Number.isSafeInteger(record.attendanceid) ||
    (record.attendanceid as number) < 1 ||
    !isNullableString(record.ems_session_id) ||
    !isNullableTimestamp(record.sessdate) ||
    !Number.isSafeInteger(record.duration) ||
    (record.duration as number) < 1 ||
    !Number.isSafeInteger(record.groupid) ||
    (record.groupid as number) < 1 ||
    !statuses ||
    !students
  ) {
    return null;
  }
  return {
    moodleSessionId: record.moodle_session_id as number,
    attendanceId: record.attendanceid as number,
    emsSessionId: nullableString(record.ems_session_id),
    sessionDate: nullableString(record.sessdate),
    durationSeconds: record.duration as number,
    moodleGroupId: record.groupid as number,
    statuses,
    students,
  };
}

function normalizeEmsGradeItem(
  payload: unknown
): EmsStagingGradeItem | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  const gradeNumber = (value: unknown) =>
    value === null ||
    value === undefined ||
    (typeof value === "number" && Number.isFinite(value));
  if (
    !Number.isSafeInteger(record.id) ||
    (record.id as number) < 1 ||
    !isNullableString(record.itemname) ||
    !isNullableString(record.itemtype) ||
    !isNullableString(record.itemmodule) ||
    !isNullableString(record.gradeformatted) ||
    !isNullableString(record.percentageformatted) ||
    !gradeNumber(record.grademin) ||
    !gradeNumber(record.grademax)
  ) {
    return null;
  }
  return {
    id: record.id as number,
    itemName: nullableString(record.itemname),
    itemType: nullableString(record.itemtype),
    itemModule: nullableString(record.itemmodule),
    gradeFormatted: nullableString(record.gradeformatted),
    percentageFormatted: nullableString(record.percentageformatted),
    gradeMin: typeof record.grademin === "number" ? record.grademin : null,
    gradeMax: typeof record.grademax === "number" ? record.grademax : null,
  };
}

export function normalizeEmsClassGrades(
  payload: unknown
): EmsStagingClassGrades | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  const students = normalizeRows(record.students, item => {
    if (!item || typeof item !== "object") return null;
    const row = item as Record<string, unknown>;
    const gradeItems = normalizeRows(row.grade_items, normalizeEmsGradeItem);
    if (
      typeof row.student_id !== "string" ||
      !row.student_id ||
      typeof row.first_name !== "string" ||
      typeof row.last_name !== "string" ||
      typeof row.email !== "string" ||
      !row.email ||
      !isPositiveIntegerOrNull(row.moodle_user_id) ||
      !isNullableString(row.course_grade) ||
      !gradeItems
    ) {
      return null;
    }
    return {
      studentId: row.student_id,
      firstName: row.first_name,
      lastName: row.last_name,
      email: row.email,
      moodleUserId:
        typeof row.moodle_user_id === "number" ? row.moodle_user_id : null,
      courseGrade: nullableString(row.course_grade),
      gradeItems,
    };
  });
  if (
    typeof record.class_id !== "string" ||
    !record.class_id ||
    !Number.isSafeInteger(record.moodle_course_id) ||
    (record.moodle_course_id as number) < 1 ||
    !isNullableString(record.course_name) ||
    !students
  ) {
    return null;
  }
  return {
    classId: record.class_id,
    moodleCourseId: record.moodle_course_id as number,
    courseName: nullableString(record.course_name),
    students,
  };
}

export function normalizeEmsMoodleGroups(
  payload: unknown
): EmsStagingMoodleGroup[] | null {
  return normalizeRows(payload, item => {
    if (!item || typeof item !== "object") return null;
    const record = item as Record<string, unknown>;
    if (
      !Number.isSafeInteger(record.moodle_group_id) ||
      (record.moodle_group_id as number) < 1 ||
      typeof record.name !== "string" ||
      !record.name ||
      !isNullableString(record.idnumber) ||
      !Number.isSafeInteger(record.courseid)
    ) {
      return null;
    }
    return {
      id: record.moodle_group_id as number,
      name: record.name,
      idNumber: nullableString(record.idnumber),
      moodleCourseId: record.courseid as number,
    };
  });
}

export function normalizeEmsTeacherWorkspace(
  payload: unknown
): EmsStagingTeacherWorkspace | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  const classes = normalizeRows(record.classes, value => {
    if (!value || typeof value !== "object") return null;
    const item = value as Record<string, unknown>;
    if (
      typeof item.id !== "string" ||
      !item.id ||
      typeof item.name !== "string" ||
      !item.name ||
      !isNullableString(item.course_name) ||
      typeof item.status !== "string" ||
      !item.status ||
      !isNonNegativeInteger(item.active_enrolment_count)
    ) {
      return null;
    }
    return {
      id: item.id,
      name: item.name,
      courseName: nullableString(item.course_name),
      status: item.status,
      activeEnrolmentCount: item.active_enrolment_count as number,
      moodleCourseUrl: httpsUrl(item.moodle_course_url),
    };
  });
  const upcomingSessions = normalizeRows(record.upcoming_sessions, value => {
    if (!value || typeof value !== "object") return null;
    const item = value as Record<string, unknown>;
    if (
      typeof item.id !== "string" ||
      !item.id ||
      !isNullableString(item.class_id) ||
      !isNullableString(item.class_name) ||
      typeof item.starts_at !== "string" ||
      !item.starts_at ||
      typeof item.ends_at !== "string" ||
      !item.ends_at ||
      !isNullableString(item.room_name) ||
      typeof item.status !== "string" ||
      !item.status
    ) {
      return null;
    }
    return {
      id: item.id,
      classId: nullableString(item.class_id),
      className: nullableString(item.class_name),
      startsAt: item.starts_at,
      endsAt: item.ends_at,
      roomName: nullableString(item.room_name),
      status: item.status,
    };
  });
  if (!classes || !upcomingSessions) return null;
  return {
    moodleSiteUrl: httpsUrl(record.moodle_site_url),
    classes,
    upcomingSessions,
  };
}

const EMS_HEALTH_STATUSES: EmsStagingHealthStatus[] = [
  "ok",
  "warning",
  "error",
  "not_configured",
];

function isEmsHealthStatus(value: unknown): value is EmsStagingHealthStatus {
  return EMS_HEALTH_STATUSES.includes(value as EmsStagingHealthStatus);
}

function isNullableBoolean(value: unknown) {
  return (
    value === null || value === undefined || typeof value === "boolean"
  );
}

function normalizeStringArrayOrNull(value: unknown) {
  if (value === null || value === undefined) return null;
  if (!Array.isArray(value)) return undefined;
  return value.every(item => typeof item === "string") ? value : undefined;
}

function normalizeEmsHealthComponent(
  value: unknown
): { status: EmsStagingHealthStatus; detail: string | null } | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  if (!isEmsHealthStatus(item.status) || !isNullableString(item.detail)) {
    return null;
  }
  return { status: item.status, detail: nullableString(item.detail) };
}

export function normalizeEmsSystemHealth(
  payload: unknown
): EmsStagingSystemHealth | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  if (
    !["healthy", "degraded", "unhealthy"].includes(record.status as string) ||
    typeof record.checked_at !== "string" ||
    !record.checked_at ||
    !Number.isFinite(Date.parse(record.checked_at)) ||
    !record.components ||
    typeof record.components !== "object"
  ) {
    return null;
  }
  const components = record.components as Record<string, unknown>;
  const api = normalizeEmsHealthComponent(components.api);
  const database = normalizeEmsHealthComponent(components.database);
  if (!api || !database) return null;

  const schemaCheckRecord = components.schema_check;
  if (!schemaCheckRecord || typeof schemaCheckRecord !== "object") return null;
  const schemaCheckBase = normalizeEmsHealthComponent(schemaCheckRecord);
  const missingTables = normalizeStringArrayOrNull(
    (schemaCheckRecord as Record<string, unknown>).missing_tables
  );
  if (!schemaCheckBase || missingTables === undefined) return null;

  const migrationRecord = components.migration;
  if (!migrationRecord || typeof migrationRecord !== "object") return null;
  const migrationBase = normalizeEmsHealthComponent(migrationRecord);
  const migrationVersion = (migrationRecord as Record<string, unknown>).version;
  if (!migrationBase || !isNullableString(migrationVersion)) return null;

  const moodleRecord = components.moodle;
  if (!moodleRecord || typeof moodleRecord !== "object") return null;
  const moodleItem = moodleRecord as Record<string, unknown>;
  const moodleBase = normalizeEmsHealthComponent(moodleItem);
  const warnings = normalizeStringArrayOrNull(moodleItem.warnings);
  if (
    !moodleBase ||
    !isNullableBoolean(moodleItem.configured) ||
    !isNullableBoolean(moodleItem.reachable) ||
    !isNullableBoolean(moodleItem.version_expected) ||
    !isNullableString(moodleItem.sitename) ||
    !isNullableString(moodleItem.release) ||
    warnings === undefined
  ) {
    return null;
  }

  return {
    status: record.status as EmsStagingSystemHealth["status"],
    checkedAt: record.checked_at,
    components: {
      api,
      database,
      schemaCheck: { ...schemaCheckBase, missingTables },
      migration: {
        ...migrationBase,
        version: nullableString(migrationVersion),
      },
      moodle: {
        ...moodleBase,
        configured:
          typeof moodleItem.configured === "boolean"
            ? moodleItem.configured
            : null,
        reachable:
          typeof moodleItem.reachable === "boolean"
            ? moodleItem.reachable
            : null,
        siteName: nullableString(moodleItem.sitename),
        release: nullableString(moodleItem.release),
        versionExpected:
          typeof moodleItem.version_expected === "boolean"
            ? moodleItem.version_expected
            : null,
        warnings,
      },
    },
  };
}

function normalizeEmsDashboardCards(
  value: unknown
): EmsStagingDashboardCards | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (
    !isNonNegativeInteger(record.active_students) ||
    !isNonNegativeInteger(record.open_leads) ||
    !isNonNegativeInteger(record.active_classes) ||
    !isNonNegativeInteger(record.enrolment_fill) ||
    !isNonNegativeInteger(record.enrolment_capacity) ||
    !isNonNegativeInteger(record.scheduled_placements) ||
    !isNonNegativeInteger(record.scheduled_trials)
  ) {
    return null;
  }
  const staffCount = record.staff_count;
  if (
    staffCount !== null &&
    staffCount !== undefined &&
    !isNonNegativeInteger(staffCount)
  ) {
    return null;
  }
  return {
    activeStudents: record.active_students as number,
    openLeads: record.open_leads as number,
    activeClasses: record.active_classes as number,
    enrolmentFill: record.enrolment_fill as number,
    enrolmentCapacity: record.enrolment_capacity as number,
    scheduledPlacements: record.scheduled_placements as number,
    scheduledTrials: record.scheduled_trials as number,
    staffCount:
      typeof staffCount === "number" ? staffCount : null,
  };
}

function normalizeEmsDashboardNamedCount(
  value: unknown
): EmsStagingDashboardNamedCount | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (
    typeof record.key !== "string" ||
    !record.key ||
    typeof record.label !== "string" ||
    !record.label ||
    !isNonNegativeInteger(record.count)
  ) {
    return null;
  }
  return { key: record.key, label: record.label, count: record.count as number };
}

export function normalizeEmsDashboardSummary(
  payload: unknown
): EmsStagingDashboardSummary | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  const cards = normalizeEmsDashboardCards(record.cards);
  if (
    !cards ||
    !Array.isArray(record.by_branch) ||
    !record.charts ||
    typeof record.charts !== "object"
  ) {
    return null;
  }
  const byBranch: EmsStagingDashboardBranch[] = [];
  for (const row of record.by_branch) {
    if (!row || typeof row !== "object") return null;
    const item = row as Record<string, unknown>;
    const branchCards = normalizeEmsDashboardCards(item);
    if (
      !branchCards ||
      typeof item.branch_id !== "string" ||
      !item.branch_id ||
      typeof item.branch_name !== "string" ||
      !item.branch_name
    ) {
      return null;
    }
    byBranch.push({
      ...branchCards,
      branchId: item.branch_id,
      branchName: item.branch_name,
    });
  }
  const charts = record.charts as Record<string, unknown>;
  const namedChart = (value: unknown) => {
    if (!Array.isArray(value)) return null;
    const rows: EmsStagingDashboardNamedCount[] = [];
    for (const item of value) {
      const normalized = normalizeEmsDashboardNamedCount(item);
      if (!normalized) return null;
      rows.push(normalized);
    }
    return rows;
  };
  const studentsByBranch = namedChart(charts.students_by_branch);
  const leadsByStatus = namedChart(charts.leads_by_status);
  const placementTrialByStatus = namedChart(charts.placement_trial_by_status);
  if (!studentsByBranch || !leadsByStatus || !placementTrialByStatus) {
    return null;
  }
  if (!Array.isArray(charts.class_fill_by_branch)) return null;
  const classFillByBranch: EmsStagingDashboardClassFill[] = [];
  for (const row of charts.class_fill_by_branch) {
    if (!row || typeof row !== "object") return null;
    const item = row as Record<string, unknown>;
    const fillPct = item.fill_pct;
    if (
      typeof item.branch_id !== "string" ||
      !item.branch_id ||
      typeof item.branch_name !== "string" ||
      !item.branch_name ||
      !isNonNegativeInteger(item.enrolment_fill) ||
      !isNonNegativeInteger(item.enrolment_capacity) ||
      (fillPct !== null &&
        fillPct !== undefined &&
        !(typeof fillPct === "number" && Number.isFinite(fillPct)))
    ) {
      return null;
    }
    classFillByBranch.push({
      branchId: item.branch_id,
      branchName: item.branch_name,
      enrolmentFill: item.enrolment_fill as number,
      enrolmentCapacity: item.enrolment_capacity as number,
      fillPct: typeof fillPct === "number" ? fillPct : null,
    });
  }
  return {
    cards,
    byBranch,
    charts: {
      studentsByBranch,
      leadsByStatus,
      placementTrialByStatus,
      classFillByBranch,
    },
  };
}

export const EMS_AUDIT_STREAMS: EmsStagingAuditStream[] = [
  "auth",
  "branch",
  "department",
  "course",
  "custom_field",
  "moodle_site",
  "student",
  "lead",
  "placement_test",
  "class",
  "enrolment",
  "room",
  "session",
];

function isEmsAuditNullableId(value: unknown) {
  return (
    value === null ||
    value === undefined ||
    (typeof value === "string" && value.length > 0)
  );
}

export function normalizeEmsAuditEvents(
  payload: unknown
): EmsStagingAuditEvent[] | null {
  if (!Array.isArray(payload)) return null;
  const items: EmsStagingAuditEvent[] = [];
  for (const row of payload) {
    if (!row || typeof row !== "object") return null;
    const record = row as Record<string, unknown>;
    if (
      typeof record.id !== "string" ||
      !record.id ||
      !EMS_AUDIT_STREAMS.includes(record.stream as EmsStagingAuditStream) ||
      typeof record.event_type !== "string" ||
      !record.event_type ||
      typeof record.created_at !== "string" ||
      !record.created_at ||
      !Number.isFinite(Date.parse(record.created_at)) ||
      !isEmsAuditNullableId(record.actor_user_id) ||
      !isEmsAuditNullableId(record.branch_id) ||
      !isEmsAuditNullableId(record.entity_id) ||
      !isEmsAuditNullableId(record.secondary_entity_id) ||
      !isEmsAuditNullableId(record.target_user_id) ||
      !isNullableString(record.actor_display_name) ||
      (typeof record.actor_display_name === "string" &&
        !record.actor_display_name) ||
      !isNullableString(record.entity_label)
    ) {
      return null;
    }
    items.push({
      id: record.id,
      stream: record.stream as EmsStagingAuditStream,
      eventType: record.event_type,
      createdAt: record.created_at,
      actorDisplayName: nullableString(record.actor_display_name),
      actorUserId: nullableString(record.actor_user_id),
      branchId: nullableString(record.branch_id),
      entityId: nullableString(record.entity_id),
      entityLabel: nullableString(record.entity_label),
      secondaryEntityId: nullableString(record.secondary_entity_id),
      targetUserId: nullableString(record.target_user_id),
    });
  }
  return items;
}

export function normalizeEmsNotification(
  payload: unknown
): EmsStagingNotification | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  if (
    typeof record.id !== "string" ||
    !record.id ||
    typeof record.category !== "string" ||
    !record.category ||
    typeof record.kind !== "string" ||
    !record.kind ||
    typeof record.title !== "string" ||
    !record.title ||
    typeof record.created_at !== "string" ||
    !record.created_at ||
    !Number.isFinite(Date.parse(record.created_at)) ||
    !isNullableString(record.body) ||
    !isNullableTimestamp(record.read_at)
  ) {
    return null;
  }
  return {
    id: record.id,
    category: record.category,
    kind: record.kind,
    title: record.title,
    body: nullableString(record.body),
    createdAt: record.created_at,
    readAt: typeof record.read_at === "string" ? record.read_at : null,
  };
}

export function normalizeEmsNotifications(
  payload: unknown
): EmsStagingNotification[] | null {
  if (!Array.isArray(payload)) return null;
  const items: EmsStagingNotification[] = [];
  for (const row of payload) {
    const item = normalizeEmsNotification(row);
    if (!item) return null;
    items.push(item);
  }
  return items;
}

export function normalizeEmsNotificationUnreadCount(
  payload: unknown
): { unreadCount: number } | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  if (!isNonNegativeInteger(record.unread_count)) return null;
  return { unreadCount: record.unread_count as number };
}

export function normalizeEmsNotificationsMarkedRead(
  payload: unknown
): { markedRead: number } | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  if (!isNonNegativeInteger(record.marked_read)) return null;
  return { markedRead: record.marked_read as number };
}

export function createEmsStagingClient(options: EmsStagingClientOptions) {
  const baseUrl = options.baseUrl.replace(/\/+$/, "");
  const timeoutMs = options.timeoutMs ?? EMS_STAGING_DEFAULT_TIMEOUT_MS;
  const userAgent = options.userAgent ?? EMS_STAGING_USER_AGENT;
  const fetchImpl: FetchImpl =
    options.fetchImpl ?? ((input, init) => fetch(input, init));

  async function request<T>(
    path: string,
    init: {
      method?: string;
      token?: string;
      body?: Record<string, unknown>;
    } = {}
  ): Promise<{ ok: true; data: T } | { ok: false; error: EmsStagingError }> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const headers: Record<string, string> = {
        "User-Agent": userAgent,
        Accept: "application/json",
      };
      if (init.token) headers.Authorization = `Bearer ${init.token}`;
      if (init.body !== undefined) headers["Content-Type"] = "application/json";
      const response = await fetchImpl(`${baseUrl}${path}`, {
        method: init.method ?? "GET",
        headers,
        body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
        redirect: "error",
        signal: controller.signal,
      });
      const payload = (await response.json().catch(() => null)) as unknown;
      if (!response.ok) {
        return {
          ok: false,
          error: {
            ...translateEmsError(response.status, payload),
            status: response.status,
          },
        };
      }
      return { ok: true, data: payload as T };
    } catch {
      return {
        ok: false,
        error: { error: "The staging service is unavailable.", status: 503 },
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  return {
    ping() {
      return request<{ pong?: boolean }>("/ping");
    },
    login(email: string, password: string) {
      return request<EmsAuthPayload>("/auth/login", {
        method: "POST",
        body: { email, password },
      });
    },
    refresh(refreshToken: string) {
      return request<EmsAuthPayload>("/auth/refresh", {
        method: "POST",
        body: { refresh_token: refreshToken },
      });
    },
    logout(token: string) {
      return request<null>("/auth/logout", { method: "POST", token });
    },
    me(token: string) {
      return request<unknown>("/auth/me", { token });
    },
    patchMe(token: string, body: Record<string, unknown>) {
      return request<unknown>("/auth/me", { method: "PATCH", token, body });
    },
    changePassword(
      token: string,
      currentPassword: string,
      newPassword: string
    ) {
      return request<unknown>("/auth/change-password", {
        method: "POST",
        token,
        body: {
          current_password: currentPassword,
          new_password: newPassword,
        },
      });
    },
    switchRole(token: string, targetRole: EmsStagingRole) {
      return request<EmsAuthPayload>("/auth/switch-role", {
        method: "POST",
        token,
        body: { target_role: targetRole },
      });
    },
    switchWorkspace(token: string, branchId: string | null) {
      return request<unknown>("/auth/switch-workspace", {
        method: "POST",
        token,
        body: { branch_id: branchId },
      });
    },
    branches(token: string) {
      return request<unknown>("/branches", { token });
    },
    users(token: string) {
      return request<unknown>("/users", { token });
    },
    createUser(token: string, body: Record<string, unknown>) {
      return request<unknown>("/users", { method: "POST", token, body });
    },
    patchUser(token: string, userId: string, body: Record<string, unknown>) {
      return request<unknown>(`/users/${encodeURIComponent(userId)}`, {
        method: "PATCH",
        token,
        body,
      });
    },
    disableUser(token: string, userId: string) {
      return request<unknown>(`/users/${encodeURIComponent(userId)}/disable`, {
        method: "POST",
        token,
      });
    },
    enableUser(token: string, userId: string) {
      return request<unknown>(`/users/${encodeURIComponent(userId)}/enable`, {
        method: "POST",
        token,
      });
    },
    resetUserPassword(
      token: string,
      userId: string,
      body: Record<string, unknown>
    ) {
      return request<unknown>(`/users/${encodeURIComponent(userId)}/password`, {
        method: "POST",
        token,
        body,
      });
    },
    moodleUsers(token: string, query: string) {
      return request<unknown>(`/moodle/users?q=${encodeURIComponent(query)}`, {
        token,
      });
    },
    bindUserMoodle(
      token: string,
      userId: string,
      body: Record<string, unknown>
    ) {
      return request<unknown>(
        `/users/${encodeURIComponent(userId)}/moodle`,
        { method: "POST", token, body }
      );
    },
    resetUserMoodlePassword(token: string, userId: string) {
      return request<unknown>(
        `/users/${encodeURIComponent(userId)}/moodle/password`,
        { method: "POST", token }
      );
    },
    bindStudentMoodle(
      token: string,
      studentId: string,
      body: Record<string, unknown>
    ) {
      return request<unknown>(
        `/students/${encodeURIComponent(studentId)}/moodle`,
        { method: "POST", token, body }
      );
    },
    resetStudentMoodlePassword(token: string, studentId: string) {
      return request<unknown>(
        `/students/${encodeURIComponent(studentId)}/moodle/password`,
        { method: "POST", token }
      );
    },
    inviteUser(token: string, userId: string) {
      return request<unknown>(`/users/${encodeURIComponent(userId)}/invite`, {
        method: "POST",
        token,
      });
    },
    cancelUserInvitation(token: string, userId: string) {
      return request<unknown>(
        `/users/${encodeURIComponent(userId)}/cancel-invitation`,
        { method: "POST", token }
      );
    },
    validateInvitation(token: string) {
      return request<unknown>("/auth/invitations/validate", {
        method: "POST",
        body: { token },
      });
    },
    acceptInvitation(token: string, password: string) {
      return request<unknown>("/auth/invitations/accept", {
        method: "POST",
        body: { token, password },
      });
    },
    customFields(token: string) {
      return request<unknown>(
        "/custom-fields?entity_type=user_profile&is_active=true",
        { token }
      );
    },
    user(token: string, userId: string) {
      return request<unknown>(`/users/${encodeURIComponent(userId)}`, {
        token,
      });
    },
    departments(token: string) {
      return request<unknown>("/departments", { token });
    },
    students(token: string) {
      return request<unknown>("/students", { token });
    },
    createStudent(token: string, body: Record<string, unknown>) {
      return request<unknown>("/students", { method: "POST", token, body });
    },
    patchStudent(
      token: string,
      studentId: string,
      body: Record<string, unknown>
    ) {
      return request<unknown>(`/students/${encodeURIComponent(studentId)}`, {
        method: "PATCH",
        token,
        body,
      });
    },
    disableStudent(token: string, studentId: string) {
      return request<unknown>(
        `/students/${encodeURIComponent(studentId)}/disable`,
        { method: "POST", token }
      );
    },
    enableStudent(token: string, studentId: string) {
      return request<unknown>(
        `/students/${encodeURIComponent(studentId)}/enable`,
        { method: "POST", token }
      );
    },
    student(token: string, studentId: string) {
      return request<unknown>(`/students/${encodeURIComponent(studentId)}`, {
        token,
      });
    },
    studentEnrolments(token: string, studentId: string) {
      return request<unknown>(
        `/students/${encodeURIComponent(studentId)}/enrolments`,
        { token }
      );
    },
    leads(token: string) {
      return request<unknown>("/leads", { token });
    },
    createLead(token: string, body: Record<string, unknown>) {
      return request<unknown>("/leads", { method: "POST", token, body });
    },
    patchLead(token: string, leadId: string, body: Record<string, unknown>) {
      return request<unknown>(`/leads/${encodeURIComponent(leadId)}`, {
        method: "PATCH",
        token,
        body,
      });
    },
    convertLead(
      token: string,
      leadId: string,
      body: Record<string, unknown>
    ) {
      return request<unknown>(`/leads/${encodeURIComponent(leadId)}/convert`, {
        method: "POST",
        token,
        body,
      });
    },
    markLeadReady(token: string, leadId: string) {
      return request<unknown>(`/leads/${encodeURIComponent(leadId)}/ready`, {
        method: "POST",
        token,
      });
    },
    lead(token: string, leadId: string) {
      return request<unknown>(`/leads/${encodeURIComponent(leadId)}`, {
        token,
      });
    },
    placementTests(token: string) {
      return request<unknown>("/placement-tests", { token });
    },
    createPlacementTest(token: string, body: Record<string, unknown>) {
      return request<unknown>("/placement-tests", {
        method: "POST",
        token,
        body,
      });
    },
    patchPlacementTest(
      token: string,
      placementTestId: string,
      body: Record<string, unknown>
    ) {
      return request<unknown>(
        `/placement-tests/${encodeURIComponent(placementTestId)}`,
        { method: "PATCH", token, body }
      );
    },
    cancelPlacementTest(token: string, placementTestId: string) {
      return request<unknown>(
        `/placement-tests/${encodeURIComponent(placementTestId)}/cancel`,
        { method: "POST", token }
      );
    },
    recordPlacementResult(
      token: string,
      placementTestId: string,
      body: Record<string, unknown>
    ) {
      return request<unknown>(
        `/placement-tests/${encodeURIComponent(placementTestId)}/record-result`,
        { method: "POST", token, body }
      );
    },
    placementTest(token: string, placementTestId: string) {
      return request<unknown>(
        `/placement-tests/${encodeURIComponent(placementTestId)}`,
        { token }
      );
    },
    classes(token: string) {
      return request<unknown>("/classes", { token });
    },
    class(token: string, classId: string) {
      return request<unknown>(`/classes/${encodeURIComponent(classId)}`, {
        token,
      });
    },
    rooms(token: string) {
      return request<unknown>("/rooms", { token });
    },
    courses(token: string) {
      return request<unknown>("/courses", { token });
    },
    moodleCourses(token: string, query?: string, refresh?: boolean) {
      const params = new URLSearchParams();
      if (query?.trim()) params.set("q", query.trim());
      if (refresh) params.set("refresh", "true");
      const suffix = params.size ? `?${params.toString()}` : "";
      return request<unknown>(`/moodle/courses${suffix}`, { token });
    },
    moodleGroups(token: string, courseId: string, query: string) {
      const params = new URLSearchParams({
        course_id: courseId,
        q: query,
      });
      return request<unknown>(`/moodle/groups?${params.toString()}`, {
        token,
      });
    },
    course(token: string, courseId: string) {
      return request<unknown>(`/courses/${encodeURIComponent(courseId)}`, {
        token,
      });
    },
    createCourse(token: string, body: Record<string, unknown>) {
      return request<unknown>("/courses", { method: "POST", token, body });
    },
    patchCourse(token: string, courseId: string, body: Record<string, unknown>) {
      return request<unknown>(`/courses/${encodeURIComponent(courseId)}`, {
        method: "PATCH",
        token,
        body,
      });
    },
    disableCourse(token: string, courseId: string) {
      return request<unknown>(
        `/courses/${encodeURIComponent(courseId)}/disable`,
        { method: "POST", token }
      );
    },
    enableCourse(token: string, courseId: string) {
      return request<unknown>(
        `/courses/${encodeURIComponent(courseId)}/enable`,
        { method: "POST", token }
      );
    },
    refreshCourse(token: string, courseId: string) {
      return request<unknown>(
        `/courses/${encodeURIComponent(courseId)}/refresh`,
        { method: "POST", token }
      );
    },
    room(token: string, roomId: string) {
      return request<unknown>(`/rooms/${encodeURIComponent(roomId)}`, {
        token,
      });
    },
    createRoom(token: string, body: Record<string, unknown>) {
      return request<unknown>("/rooms", { method: "POST", token, body });
    },
    patchRoom(token: string, roomId: string, body: Record<string, unknown>) {
      return request<unknown>(`/rooms/${encodeURIComponent(roomId)}`, {
        method: "PATCH",
        token,
        body,
      });
    },
    disableRoom(token: string, roomId: string) {
      return request<unknown>(`/rooms/${encodeURIComponent(roomId)}/disable`, {
        method: "POST",
        token,
      });
    },
    enableRoom(token: string, roomId: string) {
      return request<unknown>(`/rooms/${encodeURIComponent(roomId)}/enable`, {
        method: "POST",
        token,
      });
    },
    createClass(token: string, body: Record<string, unknown>) {
      return request<unknown>("/classes", { method: "POST", token, body });
    },
    patchClass(token: string, classId: string, body: Record<string, unknown>) {
      return request<unknown>(`/classes/${encodeURIComponent(classId)}`, {
        method: "PATCH",
        token,
        body,
      });
    },
    disableClass(token: string, classId: string) {
      return request<unknown>(
        `/classes/${encodeURIComponent(classId)}/disable`,
        { method: "POST", token }
      );
    },
    enableClass(token: string, classId: string) {
      return request<unknown>(`/classes/${encodeURIComponent(classId)}/enable`, {
        method: "POST",
        token,
      });
    },
    bindClassMoodle(
      token: string,
      classId: string,
      body: Record<string, unknown>
    ) {
      return request<unknown>(
        `/classes/${encodeURIComponent(classId)}/moodle`,
        { method: "POST", token, body }
      );
    },
    syncClassMoodle(token: string, classId: string) {
      return request<unknown>(
        `/classes/${encodeURIComponent(classId)}/moodle/sync`,
        { method: "POST", token }
      );
    },
    classEnrolments(token: string, classId: string) {
      return request<unknown>(
        `/classes/${encodeURIComponent(classId)}/enrolments`,
        { token }
      );
    },
    createClassEnrolment(
      token: string,
      classId: string,
      body: Record<string, unknown>
    ) {
      return request<unknown>(
        `/classes/${encodeURIComponent(classId)}/enrolments`,
        { method: "POST", token, body }
      );
    },
    withdrawClassEnrolment(
      token: string,
      classId: string,
      studentId: string
    ) {
      return request<unknown>(
        `/classes/${encodeURIComponent(classId)}/enrolments/${encodeURIComponent(studentId)}/withdraw`,
        { method: "POST", token }
      );
    },
    completeClassEnrolment(
      token: string,
      classId: string,
      studentId: string
    ) {
      return request<unknown>(
        `/classes/${encodeURIComponent(classId)}/enrolments/${encodeURIComponent(studentId)}/complete`,
        { method: "POST", token }
      );
    },
    classSessions(token: string, classId: string) {
      return request<unknown>(
        `/classes/${encodeURIComponent(classId)}/sessions`,
        { token }
      );
    },
    proposeClassSessions(
      token: string,
      classId: string,
      body: Record<string, unknown>
    ) {
      return request<unknown>(
        `/classes/${encodeURIComponent(classId)}/sessions/propose`,
        { method: "POST", token, body }
      );
    },
    confirmClassSessions(
      token: string,
      classId: string,
      body: Record<string, unknown>
    ) {
      return request<unknown>(
        `/classes/${encodeURIComponent(classId)}/sessions/confirm`,
        { method: "POST", token, body }
      );
    },
    batchClassSessions(
      token: string,
      classId: string,
      body: Record<string, unknown>
    ) {
      return request<unknown>(
        `/classes/${encodeURIComponent(classId)}/sessions/batch`,
        { method: "POST", token, body }
      );
    },
    session(token: string, sessionId: string) {
      return request<unknown>(`/sessions/${encodeURIComponent(sessionId)}`, {
        token,
      });
    },
    patchSession(
      token: string,
      sessionId: string,
      body: Record<string, unknown>
    ) {
      return request<unknown>(
        `/sessions/${encodeURIComponent(sessionId)}`,
        { method: "PATCH", token, body }
      );
    },
    cancelSession(token: string, sessionId: string) {
      return request<unknown>(
        `/sessions/${encodeURIComponent(sessionId)}/cancel`,
        { method: "POST", token }
      );
    },
    sessionAttendance(token: string, sessionId: string) {
      return request<unknown>(
        `/sessions/${encodeURIComponent(sessionId)}/attendance`,
        { token }
      );
    },
    markSessionAttendance(
      token: string,
      sessionId: string,
      body: Record<string, unknown>
    ) {
      return request<unknown>(
        `/sessions/${encodeURIComponent(sessionId)}/attendance`,
        { method: "POST", token, body }
      );
    },
    classGrades(token: string, classId: string) {
      return request<unknown>(
        `/classes/${encodeURIComponent(classId)}/grades`,
        { token }
      );
    },
    teacherWorkspace(token: string) {
      return request<unknown>("/teacher/workspace", { token });
    },
    systemHealth(token: string) {
      return request<unknown>("/system/health", { token });
    },
    dashboardSummary(token: string) {
      return request<unknown>("/dashboard/summary", { token });
    },
    auditEvents(
      token: string,
      query: {
        stream?: EmsStagingAuditStream;
        eventType?: string;
        limit: number;
      }
    ) {
      const params = new URLSearchParams();
      if (query.stream) params.set("stream", query.stream);
      if (query.eventType) params.set("event_type", query.eventType);
      params.set("limit", String(query.limit));
      return request<unknown>(`/audit/events?${params.toString()}`, {
        token,
      });
    },
    notifications(
      token: string,
      query: { unread?: boolean; limit: number }
    ) {
      const params = new URLSearchParams();
      if (query.unread !== undefined) {
        params.set("unread", String(query.unread));
      }
      params.set("limit", String(query.limit));
      return request<unknown>(`/notifications?${params.toString()}`, {
        token,
      });
    },
    notificationUnreadCount(token: string) {
      return request<unknown>("/notifications/unread-count", { token });
    },
    markNotificationRead(token: string, notificationId: string) {
      return request<unknown>(
        `/notifications/${encodeURIComponent(notificationId)}/read`,
        { method: "POST", token }
      );
    },
    markAllNotificationsRead(token: string) {
      return request<unknown>("/notifications/read-all", {
        method: "POST",
        token,
      });
    },
  };
}

export type EmsStagingClient = ReturnType<typeof createEmsStagingClient>;

export function extractTokens(payload: unknown): EmsStagingTokens | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  if (
    typeof record.access_token !== "string" ||
    typeof record.refresh_token !== "string" ||
    typeof record.access_token_expires_at !== "string" ||
    typeof record.refresh_token_expires_at !== "string" ||
    typeof record.session_id !== "string" ||
    !record.access_token ||
    !record.refresh_token ||
    !record.session_id ||
    !Number.isFinite(Date.parse(record.access_token_expires_at)) ||
    !Number.isFinite(Date.parse(record.refresh_token_expires_at))
  ) {
    return null;
  }
  return {
    accessToken: record.access_token,
    refreshToken: record.refresh_token,
    accessTokenExpiresAt: record.access_token_expires_at,
    refreshTokenExpiresAt: record.refresh_token_expires_at,
    sessionId: record.session_id,
  };
}

export function normalizeEmsMe(payload: unknown): EmsStagingMe | null {
  return normalizeMe(payload);
}

export type EmsStagingMoodleUser = {
  id: number;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  fullName: string | null;
  email: string | null;
};

export function normalizeEmsMoodleUsers(
  payload: unknown
): EmsStagingMoodleUser[] | null {
  return normalizeRows(payload, item => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return null;
    const record = item as Record<string, unknown>;
    if (
      !Number.isSafeInteger(record.moodle_user_id) ||
      (record.moodle_user_id as number) < 1 ||
      !isNullableString(record.username) ||
      !isNullableString(record.firstname) ||
      !isNullableString(record.lastname) ||
      !isNullableString(record.fullname) ||
      !isNullableString(record.email)
    ) {
      return null;
    }
    return {
      id: record.moodle_user_id as number,
      username: nullableString(record.username),
      firstName: nullableString(record.firstname),
      lastName: nullableString(record.lastname),
      fullName: nullableString(record.fullname),
      email: nullableString(record.email),
    };
  });
}

export function normalizeEmsSelfProfile(
  payload: unknown
): EmsStagingSelfProfile | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  const user =
    record.user && typeof record.user === "object"
      ? (record.user as Record<string, unknown>)
      : null;
  const profile =
    user?.profile && typeof user.profile === "object"
      ? (user.profile as Record<string, unknown>)
      : null;
  if (!profile) return null;
  const optionals = [
    "phone",
    "address",
    "nationality",
    "date_of_birth",
    "notes",
  ] as const;
  if (
    typeof profile.first_name !== "string" ||
    !profile.first_name.trim() ||
    typeof profile.last_name !== "string" ||
    !profile.last_name.trim() ||
    !optionals.every(key => isNullableString(profile[key]))
  ) {
    return null;
  }
  return {
    firstName: profile.first_name.trim(),
    lastName: profile.last_name.trim(),
    phone: nullableString(profile.phone),
    address: nullableString(profile.address),
    nationality: nullableString(profile.nationality),
    dateOfBirth: nullableString(profile.date_of_birth),
    notes: nullableString(profile.notes),
  };
}
