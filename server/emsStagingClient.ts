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
};

export type EmsStagingDepartment = {
  id: string;
  name: string;
  code: string | null;
  status: "active" | "disabled";
};

export type EmsStagingStudent = {
  id: string;
  firstName: string;
  lastName: string;
  name: string;
  email: string;
  phone: string | null;
  dateOfBirth: string | null;
  branchId: string;
  branchName: string;
  status: "active" | "disabled";
  moodleLinked: boolean;
  guardian: {
    name: string | null;
    phone: string | null;
    email: string | null;
    relationship: string | null;
  } | null;
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
  preferredCourseId: string | null;
  preferredCourseName: string | null;
  source: string | null;
  notes: string | null;
  status: "new" | "contacted" | "qualified" | "converted" | "lost";
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
  moodleGroupId: number | null;
  schedule: {
    daysOfWeek: number[] | null;
    startTime: string | null;
    endTime: string | null;
  };
  defaultRoomId: string | null;
  defaultRoomName: string | null;
  status: "active" | "disabled";
  activeEnrolmentCount: number;
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
      (scopeId !== null && scopeId !== undefined && typeof scopeId !== "string") ||
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
    (profile?.last_name !== undefined && typeof profile.last_name !== "string") ||
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

function isNullableString(value: unknown) {
  return value === null || value === undefined || typeof value === "string";
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

export function normalizeEmsStudent(
  payload: unknown
): EmsStagingStudent | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  const guardianValues = [
    record.guardian_name,
    record.guardian_phone,
    record.guardian_email,
    record.guardian_relationship,
  ];
  if (
    typeof record.id !== "string" ||
    !record.id ||
    typeof record.first_name !== "string" ||
    typeof record.last_name !== "string" ||
    typeof record.email !== "string" ||
    !record.email ||
    !isNullableString(record.phone) ||
    !isNullableString(record.date_of_birth) ||
    typeof record.branch_id !== "string" ||
    !record.branch_id ||
    typeof record.branch_name !== "string" ||
    !record.branch_name ||
    (record.status !== "active" && record.status !== "disabled") ||
    !isPositiveIntegerOrNull(record.moodle_user_id) ||
    !guardianValues.every(isNullableString) ||
    typeof record.created_at !== "string" ||
    !record.created_at ||
    typeof record.updated_at !== "string" ||
    !record.updated_at
  ) {
    return null;
  }
  const firstName = record.first_name.trim();
  const lastName = record.last_name.trim();
  const guardian = guardianValues.some(
    value => typeof value === "string" && value.length > 0
  )
    ? {
        name: nullableString(record.guardian_name),
        phone: nullableString(record.guardian_phone),
        email: nullableString(record.guardian_email),
        relationship: nullableString(record.guardian_relationship),
      }
    : null;
  return {
    id: record.id,
    firstName,
    lastName,
    name: [firstName, lastName].filter(Boolean).join(" ") || record.email,
    email: record.email,
    phone: nullableString(record.phone),
    dateOfBirth: nullableString(record.date_of_birth),
    branchId: record.branch_id,
    branchName: record.branch_name,
    status: record.status,
    moodleLinked:
      record.moodle_user_id !== null && record.moodle_user_id !== undefined,
    guardian,
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

export function normalizeEmsLead(payload: unknown): EmsStagingLead | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  const optionalValues = [
    record.phone,
    record.preferred_course_id,
    record.preferred_course_name,
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
    (record.status !== "new" &&
      record.status !== "contacted" &&
      record.status !== "qualified" &&
      record.status !== "converted" &&
      record.status !== "lost") ||
    typeof record.created_at !== "string" ||
    !record.created_at ||
    typeof record.updated_at !== "string" ||
    !record.updated_at
  ) {
    return null;
  }
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
    preferredCourseId: nullableString(record.preferred_course_id),
    preferredCourseName: nullableString(record.preferred_course_name),
    source: nullableString(record.source),
    notes: nullableString(record.notes),
    status: record.status,
    studentId: nullableString(record.student_id),
    createdAt: record.created_at,
    updatedAt: record.updated_at,
  };
}

export function normalizeEmsLeads(
  payload: unknown
): EmsStagingLead[] | null {
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
  if (
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
      (!Array.isArray(days) || !days.every(Number.isSafeInteger))) ||
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
    activeEnrolmentCount: record.active_enrolment_count as number,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
  };
}

export function normalizeEmsClasses(
  payload: unknown
): EmsStagingClass[] | null {
  return normalizeRows(payload, normalizeEmsClass);
}

function normalizeEmsRoom(payload: unknown): EmsStagingRoom | null {
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
    (record.status !== "active" && record.status !== "disabled")
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
  };
}

export function normalizeEmsRooms(
  payload: unknown
): EmsStagingRoom[] | null {
  return normalizeRows(payload, normalizeEmsRoom);
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
    user(token: string, userId: string) {
      return request<unknown>(`/users/${encodeURIComponent(userId)}`, { token });
    },
    departments(token: string) {
      return request<unknown>("/departments", { token });
    },
    students(token: string) {
      return request<unknown>("/students", { token });
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
    lead(token: string, leadId: string) {
      return request<unknown>(`/leads/${encodeURIComponent(leadId)}`, { token });
    },
    placementTests(token: string) {
      return request<unknown>("/placement-tests", { token });
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
    teacherWorkspace(token: string) {
      return request<unknown>("/teacher/workspace", { token });
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
