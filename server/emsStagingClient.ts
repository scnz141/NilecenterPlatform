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
  | "vice_manager"
  | "hod"
  | "registrar"
  | "ssa"
  | "teacher";

/** EMS privilege order; only the first four roles may act as a lower role. */
export const EMS_ROLE_ORDER: EmsStagingRole[] = [
  "super_admin",
  "branch_admin",
  "vice_manager",
  "hod",
  "registrar",
  "ssa",
  "teacher",
];

export type EmsStagingLocalRole =
  | "superadmin"
  | "branchadmin"
  | "headofdepartment"
  | "registrar"
  | "teacher";

const EMS_TO_LOCAL_ROLE: Record<EmsStagingRole, EmsStagingLocalRole> = {
  super_admin: "superadmin",
  branch_admin: "branchadmin",
  vice_manager: "branchadmin",
  hod: "headofdepartment",
  registrar: "registrar",
  ssa: "registrar",
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
  return EMS_TO_LOCAL_ROLE[role as EmsStagingRole] ?? null;
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

export type EmsStagingEffectiveScopes = {
  branchId: string | null;
  branchIds: string[];
  departmentIds: string[];
  classIds: string[];
  courseIds: string[];
};

export type EmsStagingMe = {
  sessionId: string;
  userId: string;
  email: string;
  name: string;
  assignedRole: EmsStagingRole;
  activeRole: EmsStagingRole;
  workspaceBranchId: string | null;
  workspaceAccess: "manage" | "view" | null;
  effectiveScopes: EmsStagingEffectiveScopes | null;
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
  isOnline: boolean;
  timezone: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  customFields: Record<string, string | number | boolean | null>;
  access: "manage" | "view" | null;
};

export type EmsStagingBranchStatistics = {
  activeStudents: number;
  openLeads: number;
  activeClasses: number;
  enrolmentFill: number;
  enrolmentCapacity: number;
  pendingEnrolments: number;
  scheduledPlacements: number;
  scheduledTrials: number;
  staffCount: number | null;
};

export type EmsStagingLostReason = {
  id: string;
  name: string;
  status: "active" | "disabled";
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export const EMS_ACTION_REASON_KINDS = [
  "lost",
  "left_enrolment",
  "cancel_enrolment",
  "cancel_placement_test",
  "cancel_trial_lesson",
  "disable_student",
  "disable_course",
  "disable_class",
  "disable_branch",
  "disable_department",
  "disable_room",
  "disable_staff",
  "disable_area_of_study",
  "disable_custom_field",
] as const;

export type EmsStagingActionReasonKind =
  (typeof EMS_ACTION_REASON_KINDS)[number];

export type EmsStagingActionReason = {
  id: string;
  kind: EmsStagingActionReasonKind;
  name: string;
  status: "active" | "disabled";
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type EmsStagingActionReasonImportResult = {
  created: number | null;
  updated: number | null;
};

export type EmsStagingAreaOfStudy = {
  id: string;
  name: string;
  status: "active" | "disabled";
  sortOrder: number;
  placementCourses: {
    moodleCourseId: number;
    shortname: string;
    fullname: string;
  }[];
  createdAt: string;
  updatedAt: string;
};

export type EmsStagingStaffUser = {
  id: string;
  email: string;
  name: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  address: string | null;
  nationality: string | null;
  dateOfBirth: string | null;
  notes: string | null;
  /** Raw EMS role string, e.g. `vice_manager`. */
  emsRole: EmsStagingRole;
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
  moodleUserId: number | null;
  canTakePlacementTest: boolean;
  courseIds: string[];
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
  customFields: Record<string, string | number | boolean | null>;
};

export type EmsStagingCustomFieldDefinition = {
  id: string;
  entityType: string;
  fieldKey: string;
  label: string;
  fieldType: "text" | "textarea" | "number" | "date" | "boolean" | "select";
  isRequired: boolean;
  isActive: boolean;
  helpText: string | null;
  options: string[] | null;
  sortOrder: number;
};

export type EmsStagingDepartment = {
  id: string;
  name: string;
  code: string | null;
  status: "active" | "disabled";
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  customFields: Record<string, string | number | boolean | null>;
};

export type EmsStagingStudentGuardian = {
  sortOrder: number;
  name: string;
  phone: string;
  email: string;
  relationship: string;
};

/** Registration fee product carried by a lead or student. */
export type EmsStagingRegistration = {
  id: string;
  branchId: string;
  toBePaid: number;
  paid: number | null;
  remaining: number | null;
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
  homeBranchId: string;
  branchName: string;
  status: "active" | "disabled";
  moodleLinked: boolean;
  assignedSsaId: string | null;
  assignedSsaName: string | null;
  note: string | null;
  registration: EmsStagingRegistration | null;
  /** Non-fatal provider warnings, e.g. a Moodle account that was not created. */
  warnings: string[];
  createdAt: string;
  updatedAt: string;
};

export const EMS_ENROLMENT_STATUSES = [
  "pending_payment",
  "pending_class",
  "pending_group",
  "enrolled",
  "cancelled",
  "completed",
  "left",
] as const;
export type EmsStagingEnrolmentStatus =
  (typeof EMS_ENROLMENT_STATUSES)[number];

export type EmsStagingEnrolment = {
  id: string;
  studentId: string;
  studentName: string;
  courseId: string;
  courseName: string;
  kind: "individual" | "group";
  nextLevel: boolean;
  branchId: string;
  branchName: string;
  classId: string | null;
  className: string | null;
  status: EmsStagingEnrolmentStatus;
  enrolledAt: string | null;
  cancelledAt: string | null;
  toBePaid: number | null;
  paid: number | null;
  remaining: number | null;
  student: {
    firstName: string;
    lastName: string;
    email: string;
    homeBranchId: string;
    moodleLinked: boolean;
  };
  classSummary: {
    className: string;
    branchId: string;
    branchName: string;
    courseId: string;
    courseName: string;
    startAt: string;
    endAt: string;
    classStatus: "active" | "disabled";
  } | null;
};

export type EmsStagingStudentEnrolment = EmsStagingEnrolment;

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
  leadType: EmsStagingLeadType;
  status: EmsStagingLeadStatus;
  assignedSsaId: string | null;
  assignedSsaName: string | null;
  groupId: string | null;
  groupLabel: string | null;
  isGroupPrimary: boolean;
  studentId: string | null;
  moodleLinked: boolean;
  lostReasonId: string | null;
  lostReasonName: string | null;
  areaOfStudyId: string | null;
  areaOfStudyName: string | null;
  registration: EmsStagingRegistration | null;
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
  meetingUrl: string | null;
  areaOfStudyId: string | null;
  areaOfStudyName: string | null;
  placementMoodleCourseId: number | null;
  status: "scheduled" | "completed" | "cancelled" | "no_show";
  recommendedCourseId: string | null;
  recommendedCourseName: string | null;
  resultScore: string | null;
  resultNotes: string | null;
  mentoringTeacherId: string | null;
  mentoringTeacherName: string | null;
  resultRecordedByName: string | null;
  resultRecordedAuto: boolean;
  completedAt: string | null;
  cancelledAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type EmsStagingBookingStatus =
  | "scheduled"
  | "completed"
  | "cancelled"
  | "no_show";

export type EmsStagingTrialLesson = {
  id: string;
  branchId: string;
  branchName: string;
  subject: { type: "lead" | "student"; id: string; name: string; email: string };
  scheduledAt: string;
  roomId: string | null;
  roomName: string | null;
  meetingUrl: string | null;
  areaOfStudyId: string | null;
  areaOfStudyName: string | null;
  courseId: string | null;
  courseName: string | null;
  status: EmsStagingBookingStatus;
  recommendedCourseId: string | null;
  recommendedCourseName: string | null;
  resultScore: string | null;
  resultNotes: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type EmsStagingLeadGroup = {
  id: string;
  branchId: string;
  branchName: string;
  label: string | null;
  assignedSsaId: string | null;
  assignedSsaName: string | null;
  members: Array<{
    leadId: string;
    name: string;
    email: string;
    status: EmsStagingLeadStatus;
    isPrimary: boolean;
  }>;
  createdAt: string;
  updatedAt: string;
};

export type EmsStagingStudentLearning = {
  studentId: string;
  courses: Array<{
    classId: string;
    className: string | null;
    courseId: string;
    moodleCourseId: number;
    courseName: string | null;
    courseGrade: string | null;
    courseCompleted: boolean | null;
    completionStatus: string | null;
  }>;
  moodleWarning: string | null;
};

export type EmsStagingStudentReport = {
  identity: {
    id: string;
    name: string;
    email: string;
    homeBranchId: string;
    branchName: string;
    dateOfBirth: string | null;
    nationality: string | null;
    gender: "male" | "female" | null;
    passportNumber: string | null;
    nationalId: string | null;
    note: string | null;
    guardians: Array<{ sortOrder: number; name: string; relationship: string }>;
  };
  enrolments: EmsStagingEnrolment[];
  learning: EmsStagingStudentLearning | null;
  learningError: string | null;
};

export type EmsStagingAssignee = {
  id: string;
  name: string;
  email: string;
  role: EmsStagingRole;
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
  kind: "individual" | "group" | null;
  meetingUrl: string | null;
  assignedSsaId: string | null;
  assignedSsaName: string | null;
  lastSyncedAt: string | null;
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
  totalHours: number | null;
  areaOfStudyId: string | null;
  areaOfStudyName: string | null;
  previousCourseId: string | null;
  previousCourseName: string | null;
  createdAt: string;
  updatedAt: string;
};

export type EmsStagingCourseStatistics = {
  activeClasses: number;
  enrolmentFill: number;
  enrolmentCapacity: number;
  pendingEnrolments: number;
  openLeads: number;
};

export type EmsStagingClassSyncStep = {
  step: "group" | "teachers" | "students" | "sessions" | "grades";
  status: "ok" | "error";
  detail: string | null;
  warnings: string[];
};

export type EmsStagingAttendanceSessionSummary = {
  moodleSessionId: number;
  sessionDate: string;
  durationSeconds: number;
  moodleGroupId: number;
  lastTaken: string | null;
  description: string | null;
  emsSessionId: string | null;
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

export type EmsStagingClassEnrolment = EmsStagingEnrolment;

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
  pendingEnrolments: number;
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

function normalizeEmsIdArray(value: unknown): string[] | null {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) return null;
  if (!value.every(item => typeof item === "string" && item)) return null;
  return value as string[];
}

function normalizeEmsEffectiveScopes(
  payload: unknown
): EmsStagingEffectiveScopes | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  const branchIds = normalizeEmsIdArray(record.branch_ids);
  const departmentIds = normalizeEmsIdArray(record.department_ids);
  const classIds = normalizeEmsIdArray(record.class_ids);
  const courseIds = normalizeEmsIdArray(record.course_ids);
  if (
    (record.branch_id !== undefined &&
      record.branch_id !== null &&
      typeof record.branch_id !== "string") ||
    !branchIds ||
    !departmentIds ||
    !classIds ||
    !courseIds
  ) {
    return null;
  }
  return {
    branchId:
      typeof record.branch_id === "string" && record.branch_id
        ? record.branch_id
        : null,
    branchIds,
    departmentIds,
    classIds,
    courseIds,
  };
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
  const workspaceAccess = record.workspace_access;
  if (
    workspaceAccess !== undefined &&
    workspaceAccess !== null &&
    workspaceAccess !== "manage" &&
    workspaceAccess !== "view"
  ) {
    return null;
  }
  const effectiveScopesValue = record.effective_scopes;
  const effectiveScopes =
    effectiveScopesValue === undefined || effectiveScopesValue === null
      ? null
      : normalizeEmsEffectiveScopes(effectiveScopesValue);
  if (effectiveScopesValue != null && !effectiveScopes) return null;
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
    workspaceAccess:
      workspaceAccess === "manage" || workspaceAccess === "view"
        ? workspaceAccess
        : null,
    effectiveScopes,
    departmentIds: departmentIds as string[],
    scopes: scopes as EmsStagingMe["scopes"],
  };
}

export function normalizeEmsBranch(payload: unknown): EmsStagingBranch | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  const customFields =
    record.custom_fields === undefined
      ? {}
      : normalizeCustomFieldValues(record.custom_fields);
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
    !record.timezone ||
    typeof record.is_online !== "boolean" ||
    !Number.isSafeInteger(record.sort_order) ||
    typeof record.created_at !== "string" ||
    !record.created_at ||
    typeof record.updated_at !== "string" ||
    !record.updated_at ||
    customFields === null ||
    (record.access !== null &&
      record.access !== undefined &&
      record.access !== "manage" &&
      record.access !== "view")
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
    isOnline: record.is_online,
    timezone: record.timezone,
    sortOrder: record.sort_order as number,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
    customFields,
    access:
      record.access === "manage" || record.access === "view"
        ? record.access
        : null,
  };
}

export function normalizeEmsBranches(
  payload: unknown
): EmsStagingBranch[] | null {
  if (!Array.isArray(payload)) return null;
  const branches = payload.map(normalizeEmsBranch);
  return branches.some(branch => branch === null)
    ? null
    : (branches as EmsStagingBranch[]);
}

export function normalizeEmsBranchStatistics(
  payload: unknown
): EmsStagingBranchStatistics | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  const ints = [
    "active_students",
    "open_leads",
    "active_classes",
    "enrolment_fill",
    "enrolment_capacity",
    "pending_enrolments",
    "scheduled_placements",
    "scheduled_trials",
  ];
  if (
    ints.some(key => !Number.isSafeInteger(record[key])) ||
    (record.staff_count !== null &&
      record.staff_count !== undefined &&
      !Number.isSafeInteger(record.staff_count))
  ) {
    return null;
  }
  return {
    activeStudents: record.active_students as number,
    openLeads: record.open_leads as number,
    activeClasses: record.active_classes as number,
    enrolmentFill: record.enrolment_fill as number,
    enrolmentCapacity: record.enrolment_capacity as number,
    pendingEnrolments: record.pending_enrolments as number,
    scheduledPlacements: record.scheduled_placements as number,
    scheduledTrials: record.scheduled_trials as number,
    staffCount: Number.isSafeInteger(record.staff_count)
      ? (record.staff_count as number)
      : null,
  };
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
  const optionalProfileStrings = [
    "phone",
    "address",
    "nationality",
    "date_of_birth",
    "notes",
  ];
  if (
    (profile?.first_name !== undefined &&
      typeof profile.first_name !== "string") ||
    (profile?.last_name !== undefined &&
      typeof profile.last_name !== "string") ||
    optionalProfileStrings.some(
      key =>
        profile?.[key] !== undefined &&
        profile[key] !== null &&
        typeof profile[key] !== "string"
    )
  ) {
    return null;
  }
  const emsRole =
    typeof record.assigned_role === "string" &&
    isEmsStagingRole(record.assigned_role)
      ? record.assigned_role
      : null;
  const role = emsRole ? mapEmsRoleToLocal(emsRole) : null;
  const scopes = normalizeEmsScopes(record.scopes);
  const departments = normalizeStaffDepartments(record.departments);
  const customFields =
    record.custom_fields === undefined
      ? {}
      : normalizeCustomFieldValues(record.custom_fields);
  const courseIds =
    record.course_ids === undefined || record.course_ids === null
      ? []
      : Array.isArray(record.course_ids) &&
          record.course_ids.every(
            item => typeof item === "string" && item.length > 0
          )
        ? Array.from(new Set(record.course_ids as string[]))
        : null;
  const canTakePlacementTest =
    record.can_take_placement_test === undefined
      ? false
      : record.can_take_placement_test;
  const lastLoginAt = record.last_login_at;
  if (
    typeof record.id !== "string" ||
    !record.id ||
    typeof record.email !== "string" ||
    !record.email ||
    !emsRole ||
    !role ||
    !courseIds ||
    typeof canTakePlacementTest !== "boolean" ||
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
  const profileString = (key: string): string | null => {
    const value = profile?.[key];
    return typeof value === "string" && value.trim() ? value : null;
  };
  const moodleUserId =
    typeof record.moodle_user_id === "number" ? record.moodle_user_id : null;
  return {
    id: record.id,
    email: record.email,
    name: [firstName, lastName].filter(Boolean).join(" ") || record.email,
    firstName,
    lastName,
    phone,
    address: profileString("address"),
    nationality: profileString("nationality"),
    dateOfBirth: profileString("date_of_birth"),
    notes: profileString("notes"),
    emsRole,
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
    moodleLinked: moodleUserId !== null,
    moodleUserId,
    canTakePlacementTest,
    courseIds,
    lastLoginAt: typeof lastLoginAt === "string" ? lastLoginAt : null,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
    customFields,
  };
}

export function normalizeEmsStaffUsers(
  payload: unknown
): EmsStagingStaffUser[] | null {
  return normalizePaginatedRows(payload, normalizeEmsStaffUser);
}

export type EmsStagingUserStatistics = {
  userId: string;
  emsRole: EmsStagingRole;
  leadsCreated: number;
  leadsAssigned: number;
  leadsOpen: number;
  leadsRegistered: number;
  leadsLost: number;
  studentsAssigned: number;
  classesTeaching: number;
  sessionsScheduled: number;
  studentsTaught: number;
};

export function normalizeEmsUserStatistics(
  payload: unknown
): EmsStagingUserStatistics | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }
  const record = payload as Record<string, unknown>;
  const counts = [
    "leads_created",
    "leads_assigned",
    "leads_open",
    "leads_registered",
    "leads_lost",
    "students_assigned",
    "classes_teaching",
    "sessions_scheduled",
    "students_taught",
  ] as const;
  if (
    typeof record.user_id !== "string" ||
    !record.user_id ||
    typeof record.assigned_role !== "string" ||
    !isEmsStagingRole(record.assigned_role) ||
    counts.some(
      key =>
        typeof record[key] !== "number" ||
        !Number.isSafeInteger(record[key]) ||
        (record[key] as number) < 0
    )
  ) {
    return null;
  }
  const int = (key: (typeof counts)[number]) => record[key] as number;
  return {
    userId: record.user_id,
    emsRole: record.assigned_role,
    leadsCreated: int("leads_created"),
    leadsAssigned: int("leads_assigned"),
    leadsOpen: int("leads_open"),
    leadsRegistered: int("leads_registered"),
    leadsLost: int("leads_lost"),
    studentsAssigned: int("students_assigned"),
    classesTeaching: int("classes_teaching"),
    sessionsScheduled: int("sessions_scheduled"),
    studentsTaught: int("students_taught"),
  };
}

export function normalizeEmsUserCourseIds(payload: unknown): string[] | null {
  if (
    !Array.isArray(payload) ||
    !payload.every(item => typeof item === "string" && item.length > 0)
  ) {
    return null;
  }
  return Array.from(new Set(payload as string[]));
}

export type EmsStagingHourCellStatus = "available" | "unavailable";

export type EmsStagingHourCell = {
  date: string;
  hour: number;
  status: EmsStagingHourCellStatus;
};

export type EmsStagingHourCellOp = {
  date: string;
  hour: number;
  /** Null clears the stored cell. */
  status: EmsStagingHourCellStatus | null;
};

/** Session fields the timetable overlay needs; IDs are validated, rest nullable. */
export type EmsStagingHourCellSession = {
  id: string;
  classId: string;
  className: string;
  roomName: string | null;
  teacherName: string | null;
  startsAt: string;
  endsAt: string;
  durationHours: number;
  status: string;
};

export type EmsStagingHourCellRange = {
  timezone: string;
  from: string;
  to: string;
  cells: EmsStagingHourCell[];
  sessions: EmsStagingHourCellSession[];
};

const EMS_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isEmsDate(value: unknown): value is string {
  return (
    typeof value === "string" &&
    EMS_DATE_PATTERN.test(value) &&
    Number.isFinite(Date.parse(`${value}T00:00:00Z`))
  );
}

function normalizeEmsHourCellSession(
  value: unknown
): EmsStagingHourCellSession | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const optionalStrings = ["room_name", "teacher_name"] as const;
  if (
    typeof record.id !== "string" ||
    !record.id ||
    typeof record.class_id !== "string" ||
    !record.class_id ||
    typeof record.class_name !== "string" ||
    typeof record.status !== "string" ||
    typeof record.starts_at !== "string" ||
    !Number.isFinite(Date.parse(record.starts_at)) ||
    typeof record.ends_at !== "string" ||
    !Number.isFinite(Date.parse(record.ends_at)) ||
    typeof record.duration_hours !== "number" ||
    !Number.isSafeInteger(record.duration_hours) ||
    (record.duration_hours as number) < 1 ||
    optionalStrings.some(
      key => record[key] !== null && typeof record[key] !== "string"
    )
  ) {
    return null;
  }
  return {
    id: record.id,
    classId: record.class_id,
    className: record.class_name,
    roomName: record.room_name as string | null,
    teacherName: record.teacher_name as string | null,
    startsAt: record.starts_at,
    endsAt: record.ends_at,
    durationHours: record.duration_hours,
    status: record.status,
  };
}

export function normalizeEmsHourCellRange(
  payload: unknown
): EmsStagingHourCellRange | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }
  const record = payload as Record<string, unknown>;
  if (
    typeof record.timezone !== "string" ||
    !record.timezone ||
    !isEmsDate(record.from) ||
    !isEmsDate(record.to) ||
    !Array.isArray(record.cells) ||
    !Array.isArray(record.sessions)
  ) {
    return null;
  }
  const cells: EmsStagingHourCell[] = [];
  for (const item of record.cells) {
    if (!item || typeof item !== "object" || Array.isArray(item)) return null;
    const cell = item as Record<string, unknown>;
    if (
      !isEmsDate(cell.date) ||
      typeof cell.hour !== "number" ||
      !Number.isSafeInteger(cell.hour) ||
      cell.hour < 0 ||
      cell.hour > 23 ||
      (cell.status !== "available" && cell.status !== "unavailable")
    ) {
      return null;
    }
    cells.push({
      date: cell.date,
      hour: cell.hour,
      status: cell.status,
    });
  }
  const sessions: EmsStagingHourCellSession[] = [];
  for (const item of record.sessions) {
    const session = normalizeEmsHourCellSession(item);
    if (!session) return null;
    sessions.push(session);
  }
  return {
    timezone: record.timezone,
    from: record.from,
    to: record.to,
    cells,
    sessions,
  };
}

export function normalizeEmsHourCellPatch(
  payload: unknown
): { applied: number; skippedBooked: number } | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }
  const record = payload as Record<string, unknown>;
  if (
    typeof record.applied !== "number" ||
    !Number.isSafeInteger(record.applied) ||
    record.applied < 0 ||
    typeof record.skipped_booked !== "number" ||
    !Number.isSafeInteger(record.skipped_booked) ||
    record.skipped_booked < 0
  ) {
    return null;
  }
  return { applied: record.applied, skippedBooked: record.skipped_booked };
}

export type EmsStagingMoodleSite = {
  configured: boolean;
  hasToken: boolean;
  siteUrl: string | null;
  sitename: string | null;
  release: string | null;
  versionExpected: boolean | null;
  lastCheckedAt: string | null;
  reachable: boolean | null;
  lastError: string | null;
  autoCreateStudentMoodle: boolean;
  placementTestMoodleCourseId: number | null;
  warnings: string[];
};

export function normalizeEmsMoodleSite(
  payload: unknown
): EmsStagingMoodleSite | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }
  const record = payload as Record<string, unknown>;
  const optionalStrings = [
    "site_url",
    "sitename",
    "release",
    "last_checked_at",
    "last_error",
  ] as const;
  const optionalBooleans = ["version_expected", "reachable"] as const;
  if (
    typeof record.configured !== "boolean" ||
    typeof record.has_token !== "boolean" ||
    typeof record.auto_create_student_moodle !== "boolean" ||
    optionalStrings.some(
      key => record[key] !== null && typeof record[key] !== "string"
    ) ||
    optionalBooleans.some(
      key => record[key] !== null && typeof record[key] !== "boolean"
    ) ||
    (record.placement_test_moodle_course_id !== null &&
      (!Number.isSafeInteger(record.placement_test_moodle_course_id) ||
        (record.placement_test_moodle_course_id as number) < 1)) ||
    !Array.isArray(record.warnings) ||
    !record.warnings.every(item => typeof item === "string")
  ) {
    return null;
  }
  return {
    configured: record.configured,
    hasToken: record.has_token,
    siteUrl: record.site_url as string | null,
    sitename: record.sitename as string | null,
    release: record.release as string | null,
    versionExpected: record.version_expected as boolean | null,
    lastCheckedAt: record.last_checked_at as string | null,
    reachable: record.reachable as boolean | null,
    lastError: record.last_error as string | null,
    autoCreateStudentMoodle: record.auto_create_student_moodle,
    placementTestMoodleCourseId:
      record.placement_test_moodle_course_id as number | null,
    warnings: [...(record.warnings as string[])],
  };
}

export type EmsStagingMoodleSiteTest = {
  reachable: boolean;
  sitename: string | null;
  release: string | null;
  versionExpected: boolean | null;
  warnings: string[];
  error: string | null;
};

export function normalizeEmsMoodleSiteTest(
  payload: unknown
): EmsStagingMoodleSiteTest | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }
  const record = payload as Record<string, unknown>;
  if (
    typeof record.reachable !== "boolean" ||
    (record.sitename !== null && typeof record.sitename !== "string") ||
    (record.release !== null && typeof record.release !== "string") ||
    (record.version_expected !== null &&
      typeof record.version_expected !== "boolean") ||
    (record.error !== null && typeof record.error !== "string") ||
    !Array.isArray(record.warnings) ||
    !record.warnings.every(item => typeof item === "string")
  ) {
    return null;
  }
  return {
    reachable: record.reachable,
    sitename: record.sitename as string | null,
    release: record.release as string | null,
    versionExpected: record.version_expected as boolean | null,
    warnings: [...(record.warnings as string[])],
    error: record.error as string | null,
  };
}

export function normalizeEmsDepartment(
  payload: unknown
): EmsStagingDepartment | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  const customFields =
    record.custom_fields === undefined
      ? {}
      : normalizeCustomFieldValues(record.custom_fields);
  if (
    typeof record.id !== "string" ||
    !record.id ||
    typeof record.name !== "string" ||
    !record.name ||
    (record.code !== null && typeof record.code !== "string") ||
    (record.status !== "active" && record.status !== "disabled") ||
    !Number.isSafeInteger(record.sort_order) ||
    typeof record.created_at !== "string" ||
    !record.created_at ||
    typeof record.updated_at !== "string" ||
    !record.updated_at ||
    customFields === null
  ) {
    return null;
  }
  return {
    id: record.id,
    name: record.name,
    code: record.code,
    status: record.status,
    sortOrder: record.sort_order as number,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
    customFields,
  };
}

export function normalizeEmsDepartments(
  payload: unknown
): EmsStagingDepartment[] | null {
  if (!Array.isArray(payload)) return null;
  const departments = payload.map(normalizeEmsDepartment);
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
      entityType: record.entity_type as string,
      fieldKey: record.field_key,
      label: record.label,
      fieldType: record.field_type,
      isRequired: record.is_required,
      isActive: record.is_active,
      helpText: typeof record.help_text === "string" ? record.help_text : null,
      options: Array.isArray(options) ? options : null,
      sortOrder: record.sort_order as number,
    };
  });
  return definitions.some(definition => definition === null)
    ? null
    : (definitions as EmsStagingCustomFieldDefinition[]);
}

/**
 * Catalog view of one custom field definition: any entity type and either
 * active state. The user-form picker keeps using
 * normalizeEmsCustomFieldDefinitions, which stays restricted to active
 * user_profile definitions.
 */
export function normalizeEmsCustomFieldRow(
  payload: unknown
): EmsStagingCustomFieldDefinition | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  const options = record.options_json;
  if (
    typeof record.id !== "string" ||
    !record.id ||
    typeof record.entity_type !== "string" ||
    !record.entity_type ||
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
    entityType: record.entity_type,
    fieldKey: record.field_key,
    label: record.label,
    fieldType: record.field_type,
    isRequired: record.is_required,
    isActive: record.is_active,
    helpText: typeof record.help_text === "string" ? record.help_text : null,
    options: Array.isArray(options) ? options : null,
    sortOrder: record.sort_order as number,
  };
}

export function normalizeEmsCustomFieldRows(
  payload: unknown
): EmsStagingCustomFieldDefinition[] | null {
  if (!Array.isArray(payload)) return null;
  const definitions = payload.map(normalizeEmsCustomFieldRow);
  return definitions.some(definition => definition === null)
    ? null
    : (definitions as EmsStagingCustomFieldDefinition[]);
}

export function normalizeEmsLostReason(
  payload: unknown
): EmsStagingLostReason | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  if (
    typeof record.id !== "string" ||
    !record.id ||
    typeof record.name !== "string" ||
    !record.name ||
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
    name: record.name,
    status: record.status,
    sortOrder: record.sort_order as number,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
  };
}

export function normalizeEmsLostReasons(
  payload: unknown
): EmsStagingLostReason[] | null {
  if (!Array.isArray(payload)) return null;
  const items = payload.map(normalizeEmsLostReason);
  return items.some(item => item === null)
    ? null
    : (items as EmsStagingLostReason[]);
}

export function normalizeEmsActionReason(
  payload: unknown
): EmsStagingActionReason | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  if (
    typeof record.id !== "string" ||
    !record.id ||
    !EMS_ACTION_REASON_KINDS.includes(
      record.kind as EmsStagingActionReasonKind
    ) ||
    typeof record.name !== "string" ||
    !record.name ||
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
    kind: record.kind as EmsStagingActionReasonKind,
    name: record.name,
    status: record.status,
    sortOrder: record.sort_order as number,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
  };
}

export function normalizeEmsActionReasons(
  payload: unknown
): EmsStagingActionReason[] | null {
  if (!Array.isArray(payload)) return null;
  const items = payload.map(normalizeEmsActionReason);
  return items.some(item => item === null)
    ? null
    : (items as EmsStagingActionReason[]);
}

export function normalizeEmsActionReasonImportResult(
  payload: unknown
): EmsStagingActionReasonImportResult | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }
  const record = payload as Record<string, unknown>;
  return {
    created: Number.isSafeInteger(record.created)
      ? (record.created as number)
      : null,
    updated: Number.isSafeInteger(record.updated)
      ? (record.updated as number)
      : null,
  };
}

export function normalizeEmsAreaOfStudy(
  payload: unknown
): EmsStagingAreaOfStudy | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  const courses = record.placement_test_courses;
  if (
    typeof record.id !== "string" ||
    !record.id ||
    typeof record.name !== "string" ||
    !record.name ||
    (record.status !== "active" && record.status !== "disabled") ||
    !Number.isSafeInteger(record.sort_order) ||
    (courses !== undefined && !Array.isArray(courses)) ||
    (Array.isArray(courses) &&
      courses.some(
        course =>
          !course ||
          typeof course !== "object" ||
          !Number.isSafeInteger(
            (course as Record<string, unknown>).moodle_course_id
          ) ||
          typeof (course as Record<string, unknown>).shortname !== "string" ||
          typeof (course as Record<string, unknown>).fullname !== "string"
      )) ||
    typeof record.created_at !== "string" ||
    !record.created_at ||
    typeof record.updated_at !== "string" ||
    !record.updated_at
  ) {
    return null;
  }
  const list = Array.isArray(courses) ? courses : [];
  return {
    id: record.id,
    name: record.name,
    status: record.status,
    sortOrder: record.sort_order as number,
    placementCourses: list.map(course => {
      const item = course as Record<string, unknown>;
      return {
        moodleCourseId: item.moodle_course_id as number,
        shortname: item.shortname as string,
        fullname: item.fullname as string,
      };
    }),
    createdAt: record.created_at,
    updatedAt: record.updated_at,
  };
}

export function normalizeEmsAreasOfStudy(
  payload: unknown
): EmsStagingAreaOfStudy[] | null {
  if (!Array.isArray(payload)) return null;
  const items = payload.map(normalizeEmsAreaOfStudy);
  return items.some(item => item === null)
    ? null
    : (items as EmsStagingAreaOfStudy[]);
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

/** EMS query values: arrays repeat the key (`status=a&status=b`). */
export type EmsStagingListQuery = Record<
  string,
  string | number | boolean | string[] | null | undefined
>;

export function emsQueryString(query: EmsStagingListQuery): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") continue;
    if (Array.isArray(value)) {
      for (const item of value) if (item) params.append(key, item);
    } else {
      params.set(key, String(value));
    }
  }
  const raw = params.toString();
  return raw ? `?${raw}` : "";
}

/** List reads default to the largest page EMS allows (100). */
function listQuery(query: EmsStagingListQuery) {
  return emsQueryString({ page_size: 100, ...query });
}

export type EmsStagingPage<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
};

/** Strict page envelope that keeps the totals the UI needs for paging. */
export function normalizeEmsPage<T>(
  payload: unknown,
  normalize: (value: unknown) => T | null
): EmsStagingPage<T> | null {
  const items = normalizePaginatedRows(payload, normalize);
  if (!items) return null;
  const record = payload as Record<string, unknown>;
  return {
    items,
    total: record.total as number,
    page: record.page as number,
    pageSize: record.page_size as number,
  };
}

/**
 * EMS list endpoints return `{ items, total, page, page_size }`. Unwrap the
 * items array strictly; malformed envelopes fail the read as invalid data.
 */
function normalizePaginatedRows<T>(
  payload: unknown,
  normalize: (value: unknown) => T | null
): T[] | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }
  const record = payload as Record<string, unknown>;
  if (
    !Array.isArray(record.items) ||
    !isNonNegativeInteger(record.total) ||
    !Number.isSafeInteger(record.page) ||
    (record.page as number) < 1 ||
    !Number.isSafeInteger(record.page_size) ||
    (record.page_size as number) < 1
  ) {
    return null;
  }
  return normalizeRows(record.items, normalize);
}

function normalizeEmsStudentGuardian(
  payload: unknown
): EmsStagingStudentGuardian | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  if (
    !Number.isSafeInteger(record.sort_order) ||
    (record.sort_order as number) < 1 ||
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
    sortOrder: record.sort_order as number,
    name: record.name,
    phone: record.phone,
    email: record.email,
    relationship: record.relationship,
  };
}

/** `undefined` marks a malformed registration; `null` means none. */
function normalizeEmsRegistration(
  payload: unknown
): EmsStagingRegistration | null | undefined {
  if (payload === null || payload === undefined) return null;
  if (typeof payload !== "object") return undefined;
  const record = payload as Record<string, unknown>;
  if (
    typeof record.id !== "string" ||
    !record.id ||
    typeof record.branch_id !== "string" ||
    !record.branch_id ||
    typeof record.to_be_paid !== "number" ||
    !Number.isFinite(record.to_be_paid) ||
    !isNullableFiniteNumber(record.paid) ||
    !isNullableFiniteNumber(record.remaining)
  ) {
    return undefined;
  }
  return {
    id: record.id,
    branchId: record.branch_id,
    toBePaid: record.to_be_paid,
    paid: nullableFiniteNumber(record.paid),
    remaining: nullableFiniteNumber(record.remaining),
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
    !isNullableString(record.assigned_ssa_id) ||
    !isNullableString(record.assigned_ssa_name) ||
    !isNullableString(record.note) ||
    typeof record.home_branch_id !== "string" ||
    !record.home_branch_id ||
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
  const registration = normalizeEmsRegistration(record.registration);
  if (registration === undefined) return null;
  const warnings = Array.isArray(record.warnings)
    ? record.warnings.filter(
        (item): item is string => typeof item === "string" && Boolean(item)
      )
    : [];
  const firstName = record.first_name.trim();
  const lastName = record.last_name.trim();
  return {
    id: record.id,
    firstName,
    lastName,
    name: [firstName, lastName].filter(Boolean).join(" ") || record.email,
    email: record.email,
    phone: nullableString(record.phone),
    warnings,
    dateOfBirth: nullableString(record.date_of_birth),
    nationality: nullableString(record.nationality),
    address: nullableString(record.address),
    gender: (record.gender as "male" | "female" | null | undefined) ?? null,
    passportNumber: nullableString(record.passport_number),
    nationalId: nullableString(record.national_id),
    guardians,
    homeBranchId: record.home_branch_id,
    branchName: record.branch_name,
    status: record.status,
    moodleLinked:
      record.moodle_user_id !== null && record.moodle_user_id !== undefined,
    assignedSsaId: nullableString(record.assigned_ssa_id),
    assignedSsaName: nullableString(record.assigned_ssa_name),
    note: nullableString(record.note),
    registration,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
  };
}

export function normalizeEmsStudents(
  payload: unknown
): EmsStagingStudent[] | null {
  return normalizePaginatedRows(payload, normalizeEmsStudent);
}

function isNullableFiniteNumber(value: unknown) {
  return (
    value === null ||
    value === undefined ||
    (typeof value === "number" && Number.isFinite(value))
  );
}

function nullableFiniteNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normalizeEmsEnrolmentClassSummary(
  payload: unknown
): EmsStagingEnrolment["classSummary"] | null | undefined {
  if (payload === null || payload === undefined) return null;
  if (typeof payload !== "object") return undefined;
  const record = payload as Record<string, unknown>;
  if (
    typeof record.class_name !== "string" ||
    !record.class_name ||
    typeof record.branch_id !== "string" ||
    !record.branch_id ||
    typeof record.branch_name !== "string" ||
    !record.branch_name ||
    typeof record.course_id !== "string" ||
    !record.course_id ||
    typeof record.course_name !== "string" ||
    !record.course_name ||
    typeof record.start_at !== "string" ||
    typeof record.end_at !== "string" ||
    (record.class_status !== "active" && record.class_status !== "disabled")
  ) {
    return undefined;
  }
  return {
    className: record.class_name,
    branchId: record.branch_id,
    branchName: record.branch_name,
    courseId: record.course_id,
    courseName: record.course_name,
    startAt: record.start_at,
    endAt: record.end_at,
    classStatus: record.class_status,
  };
}

export function normalizeEmsEnrolment(
  payload: unknown
): EmsStagingEnrolment | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  const student =
    record.student && typeof record.student === "object"
      ? (record.student as Record<string, unknown>)
      : null;
  const classSummary = normalizeEmsEnrolmentClassSummary(
    record.class_summary
  );
  if (
    typeof record.id !== "string" ||
    !record.id ||
    typeof record.student_id !== "string" ||
    !record.student_id ||
    typeof record.course_id !== "string" ||
    !record.course_id ||
    typeof record.course_name !== "string" ||
    !record.course_name ||
    (record.kind !== "individual" && record.kind !== "group") ||
    (record.next_level !== undefined &&
      typeof record.next_level !== "boolean") ||
    typeof record.branch_id !== "string" ||
    !record.branch_id ||
    typeof record.branch_name !== "string" ||
    !record.branch_name ||
    (record.class_id !== null &&
      record.class_id !== undefined &&
      (typeof record.class_id !== "string" || !record.class_id)) ||
    !isNullableString(record.class_name) ||
    !EMS_ENROLMENT_STATUSES.includes(
      record.status as EmsStagingEnrolmentStatus
    ) ||
    !isNullableTimestamp(record.enrolled_at) ||
    !isNullableTimestamp(record.cancelled_at) ||
    !isNullableFiniteNumber(record.to_be_paid) ||
    !isNullableFiniteNumber(record.paid) ||
    !isNullableFiniteNumber(record.remaining) ||
    !isNullableString(record.student_name) ||
    !student ||
    typeof student.first_name !== "string" ||
    typeof student.last_name !== "string" ||
    typeof student.email !== "string" ||
    !student.email ||
    typeof student.home_branch_id !== "string" ||
    !student.home_branch_id ||
    !isPositiveIntegerOrNull(student.moodle_user_id) ||
    classSummary === undefined
  ) {
    return null;
  }
  const firstName = student.first_name.trim();
  const lastName = student.last_name.trim();
  return {
    id: record.id,
    studentId: record.student_id,
    studentName:
      nullableString(record.student_name) ||
      [firstName, lastName].filter(Boolean).join(" ") ||
      student.email,
    courseId: record.course_id,
    courseName: record.course_name,
    kind: record.kind,
    nextLevel: record.next_level === true,
    branchId: record.branch_id,
    branchName: record.branch_name,
    classId:
      typeof record.class_id === "string" && record.class_id
        ? record.class_id
        : null,
    className: nullableString(record.class_name),
    status: record.status as EmsStagingEnrolmentStatus,
    enrolledAt: nullableString(record.enrolled_at),
    cancelledAt: nullableString(record.cancelled_at),
    toBePaid: nullableFiniteNumber(record.to_be_paid),
    paid: nullableFiniteNumber(record.paid),
    remaining: nullableFiniteNumber(record.remaining),
    student: {
      firstName,
      lastName,
      email: student.email,
      homeBranchId: student.home_branch_id,
      moodleLinked:
        student.moodle_user_id !== null &&
        student.moodle_user_id !== undefined,
    },
    classSummary,
  };
}

export function normalizeEmsStudentEnrolments(
  payload: unknown
): EmsStagingStudentEnrolment[] | null {
  return normalizeRows(payload, normalizeEmsEnrolment);
}

export const EMS_LEAD_STATUSES = [
  "in_process",
  "follow_up",
  "future_registration",
  "placement_test",
  "trial_lesson",
  "registered",
  "lost",
] as const;
export type EmsStagingLeadStatus = (typeof EMS_LEAD_STATUSES)[number];
export const EMS_LEAD_TYPES = [
  "new",
  "old",
  "old_student",
  "current_student",
] as const;
export type EmsStagingLeadType = (typeof EMS_LEAD_TYPES)[number];
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
    record.lost_reason_id,
    record.lost_reason_name,
    record.area_of_study_id,
    record.area_of_study_name,
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
    !EMS_LEAD_TYPES.includes(
      record.lead_type as EmsStagingLeadType
    ) ||
    !EMS_LEAD_STATUSES.includes(
      record.status as EmsStagingLeadStatus
    ) ||
    !isNullableString(record.assigned_ssa_id) ||
    !isNullableString(record.assigned_ssa_name) ||
    !isNullableString(record.group_id) ||
    !isNullableString(record.group_label) ||
    (record.is_group_primary !== undefined &&
      record.is_group_primary !== null &&
      typeof record.is_group_primary !== "boolean") ||
    !isPositiveIntegerOrNull(record.moodle_user_id) ||
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
  const registration = normalizeEmsRegistration(record.registration);
  if (registration === undefined) return null;
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
    leadType: record.lead_type as EmsStagingLeadType,
    status: record.status as EmsStagingLeadStatus,
    assignedSsaId: nullableString(record.assigned_ssa_id),
    assignedSsaName: nullableString(record.assigned_ssa_name),
    groupId: nullableString(record.group_id),
    groupLabel: nullableString(record.group_label),
    isGroupPrimary: record.is_group_primary === true,
    studentId: nullableString(record.student_id),
    moodleLinked:
      record.moodle_user_id !== null && record.moodle_user_id !== undefined,
    lostReasonId: nullableString(record.lost_reason_id),
    lostReasonName: nullableString(record.lost_reason_name),
    areaOfStudyId: nullableString(record.area_of_study_id),
    areaOfStudyName: nullableString(record.area_of_study_name),
    registration,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
  };
}

export function normalizeEmsLeads(payload: unknown): EmsStagingLead[] | null {
  return normalizePaginatedRows(payload, normalizeEmsLead);
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
    record.meeting_url,
    record.area_of_study_id,
    record.area_of_study_name,
    record.mentoring_teacher_id,
    record.mentoring_teacher_name,
    record.result_recorded_by_name,
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
    !isPositiveIntegerOrNull(record.placement_moodle_course_id) ||
    (record.result_recorded_auto !== undefined &&
      record.result_recorded_auto !== null &&
      typeof record.result_recorded_auto !== "boolean") ||
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
    meetingUrl: nullableString(record.meeting_url),
    areaOfStudyId: nullableString(record.area_of_study_id),
    areaOfStudyName: nullableString(record.area_of_study_name),
    placementMoodleCourseId:
      typeof record.placement_moodle_course_id === "number"
        ? record.placement_moodle_course_id
        : null,
    status: record.status,
    recommendedCourseId: nullableString(record.recommended_course_id),
    recommendedCourseName: nullableString(record.recommended_course_name),
    resultScore: nullableString(record.result_score),
    resultNotes: nullableString(record.result_notes),
    mentoringTeacherId: nullableString(record.mentoring_teacher_id),
    mentoringTeacherName: nullableString(record.mentoring_teacher_name),
    resultRecordedByName: nullableString(record.result_recorded_by_name),
    resultRecordedAuto: record.result_recorded_auto === true,
    completedAt: nullableString(record.completed_at),
    cancelledAt: nullableString(record.cancelled_at),
    createdAt: nullableString(record.created_at),
    updatedAt: nullableString(record.updated_at),
  };
}

export function normalizeEmsPlacementTests(
  payload: unknown
): EmsStagingPlacementTest[] | null {
  return normalizePaginatedRows(payload, normalizeEmsPlacementTest);
}

const EMS_BOOKING_STATUSES = [
  "scheduled",
  "completed",
  "cancelled",
  "no_show",
] as const;

export function normalizeEmsTrialLesson(
  payload: unknown
): EmsStagingTrialLesson | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  const subject =
    record.subject && typeof record.subject === "object"
      ? (record.subject as Record<string, unknown>)
      : null;
  const optionalValues = [
    record.room_id,
    record.room_name,
    record.meeting_url,
    record.area_of_study_id,
    record.area_of_study_name,
    record.course_id,
    record.course_name,
    record.recommended_course_id,
    record.recommended_course_name,
    record.result_score,
    record.result_notes,
  ];
  if (
    typeof record.id !== "string" ||
    !record.id ||
    typeof record.branch_id !== "string" ||
    !record.branch_id ||
    typeof record.branch_name !== "string" ||
    !subject ||
    (subject.subject_type !== "lead" && subject.subject_type !== "student") ||
    typeof subject.subject_id !== "string" ||
    !subject.subject_id ||
    typeof subject.first_name !== "string" ||
    typeof subject.last_name !== "string" ||
    typeof subject.email !== "string" ||
    typeof record.scheduled_at !== "string" ||
    !Number.isFinite(Date.parse(record.scheduled_at)) ||
    !optionalValues.every(isNullableString) ||
    !isNullableTimestamp(record.completed_at) ||
    !isNullableTimestamp(record.cancelled_at) ||
    !EMS_BOOKING_STATUSES.includes(record.status as EmsStagingBookingStatus) ||
    typeof record.created_at !== "string" ||
    typeof record.updated_at !== "string"
  ) {
    return null;
  }
  const name = [subject.first_name.trim(), subject.last_name.trim()]
    .filter(Boolean)
    .join(" ");
  return {
    id: record.id,
    branchId: record.branch_id,
    branchName: record.branch_name,
    subject: {
      type: subject.subject_type,
      id: subject.subject_id,
      name: name || subject.email,
      email: subject.email,
    },
    scheduledAt: record.scheduled_at,
    roomId: nullableString(record.room_id),
    roomName: nullableString(record.room_name),
    meetingUrl: nullableString(record.meeting_url),
    areaOfStudyId: nullableString(record.area_of_study_id),
    areaOfStudyName: nullableString(record.area_of_study_name),
    courseId: nullableString(record.course_id),
    courseName: nullableString(record.course_name),
    status: record.status as EmsStagingBookingStatus,
    recommendedCourseId: nullableString(record.recommended_course_id),
    recommendedCourseName: nullableString(record.recommended_course_name),
    resultScore: nullableString(record.result_score),
    resultNotes: nullableString(record.result_notes),
    completedAt: nullableString(record.completed_at),
    cancelledAt: nullableString(record.cancelled_at),
    createdAt: record.created_at,
    updatedAt: record.updated_at,
  };
}

export function normalizeEmsLeadGroup(
  payload: unknown
): EmsStagingLeadGroup | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  if (
    typeof record.id !== "string" ||
    !record.id ||
    typeof record.branch_id !== "string" ||
    !record.branch_id ||
    typeof record.branch_name !== "string" ||
    !isNullableString(record.label) ||
    !isNullableString(record.assigned_ssa_id) ||
    !isNullableString(record.assigned_ssa_name) ||
    (record.members !== undefined && !Array.isArray(record.members)) ||
    typeof record.created_at !== "string" ||
    typeof record.updated_at !== "string"
  ) {
    return null;
  }
  const members = normalizeRows(record.members ?? [], (value: unknown) => {
    if (!value || typeof value !== "object") return null;
    const member = value as Record<string, unknown>;
    if (
      typeof member.lead_id !== "string" ||
      !member.lead_id ||
      typeof member.first_name !== "string" ||
      typeof member.last_name !== "string" ||
      typeof member.email !== "string" ||
      !EMS_LEAD_STATUSES.includes(member.status as EmsStagingLeadStatus)
    ) {
      return null;
    }
    const name = [member.first_name.trim(), member.last_name.trim()]
      .filter(Boolean)
      .join(" ");
    return {
      leadId: member.lead_id,
      name: name || member.email,
      email: member.email,
      status: member.status as EmsStagingLeadStatus,
      isPrimary: member.is_primary === true,
    };
  });
  if (!members) return null;
  return {
    id: record.id,
    branchId: record.branch_id,
    branchName: record.branch_name,
    label: nullableString(record.label),
    assignedSsaId: nullableString(record.assigned_ssa_id),
    assignedSsaName: nullableString(record.assigned_ssa_name),
    members,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
  };
}

export function normalizeEmsLeadGroups(
  payload: unknown
): EmsStagingLeadGroup[] | null {
  return normalizeRows(payload, normalizeEmsLeadGroup);
}

export function normalizeEmsStudentLearning(
  payload: unknown
): EmsStagingStudentLearning | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  if (
    typeof record.student_id !== "string" ||
    !Array.isArray(record.courses) ||
    !isNullableString(record.moodle_warning)
  ) {
    return null;
  }
  const courses = normalizeRows(record.courses, (value: unknown) => {
    if (!value || typeof value !== "object") return null;
    const course = value as Record<string, unknown>;
    if (
      typeof course.class_id !== "string" ||
      typeof course.course_id !== "string" ||
      !Number.isSafeInteger(course.moodle_course_id) ||
      !isNullableString(course.class_name) ||
      !isNullableString(course.course_name) ||
      !isNullableString(course.course_grade) ||
      !isNullableString(course.completion_status) ||
      (course.course_completed !== undefined &&
        course.course_completed !== null &&
        typeof course.course_completed !== "boolean")
    ) {
      return null;
    }
    return {
      classId: course.class_id,
      className: nullableString(course.class_name),
      courseId: course.course_id,
      moodleCourseId: course.moodle_course_id as number,
      courseName: nullableString(course.course_name),
      courseGrade: nullableString(course.course_grade),
      courseCompleted:
        typeof course.course_completed === "boolean"
          ? course.course_completed
          : null,
      completionStatus: nullableString(course.completion_status),
    };
  });
  if (!courses) return null;
  return {
    studentId: record.student_id,
    courses,
    moodleWarning: nullableString(record.moodle_warning),
  };
}

export function normalizeEmsStudentReport(
  payload: unknown
): EmsStagingStudentReport | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  const identity =
    record.identity && typeof record.identity === "object"
      ? (record.identity as Record<string, unknown>)
      : null;
  if (
    !identity ||
    typeof identity.id !== "string" ||
    typeof identity.first_name !== "string" ||
    typeof identity.last_name !== "string" ||
    typeof identity.email !== "string" ||
    typeof identity.home_branch_id !== "string" ||
    typeof identity.branch_name !== "string" ||
    ![
      identity.date_of_birth,
      identity.nationality,
      identity.passport_number,
      identity.national_id,
      identity.note,
    ].every(isNullableString) ||
    (identity.gender !== undefined &&
      identity.gender !== null &&
      identity.gender !== "male" &&
      identity.gender !== "female") ||
    (record.enrolments !== undefined && !Array.isArray(record.enrolments)) ||
    !isNullableString(record.learning_error)
  ) {
    return null;
  }
  const enrolments = normalizeRows(record.enrolments ?? [], normalizeEmsEnrolment);
  const guardians = normalizeRows(
    Array.isArray(identity.guardians) ? identity.guardians : [],
    (value: unknown) => {
      if (!value || typeof value !== "object") return null;
      const guardian = value as Record<string, unknown>;
      if (
        !Number.isSafeInteger(guardian.sort_order) ||
        typeof guardian.name !== "string" ||
        typeof guardian.relationship !== "string"
      ) {
        return null;
      }
      return {
        sortOrder: guardian.sort_order as number,
        name: guardian.name,
        relationship: guardian.relationship,
      };
    }
  );
  const learning =
    record.learning === null || record.learning === undefined
      ? null
      : normalizeEmsStudentLearning(record.learning);
  if (
    !enrolments ||
    !guardians ||
    (record.learning !== null && record.learning !== undefined && !learning)
  ) {
    return null;
  }
  const name = [identity.first_name.trim(), identity.last_name.trim()]
    .filter(Boolean)
    .join(" ");
  return {
    identity: {
      id: identity.id,
      name: name || identity.email,
      email: identity.email,
      homeBranchId: identity.home_branch_id,
      branchName: identity.branch_name,
      dateOfBirth: nullableString(identity.date_of_birth),
      nationality: nullableString(identity.nationality),
      gender: (identity.gender as "male" | "female" | null | undefined) ?? null,
      passportNumber: nullableString(identity.passport_number),
      nationalId: nullableString(identity.national_id),
      note: nullableString(identity.note),
      guardians,
    },
    enrolments,
    learning,
    learningError: nullableString(record.learning_error),
  };
}

export function normalizeEmsAssignee(
  payload: unknown
): EmsStagingAssignee | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  if (
    typeof record.id !== "string" ||
    !record.id ||
    typeof record.email !== "string" ||
    typeof record.assigned_role !== "string" ||
    !isEmsStagingRole(record.assigned_role) ||
    typeof record.first_name !== "string" ||
    typeof record.last_name !== "string"
  ) {
    return null;
  }
  const name = [record.first_name.trim(), record.last_name.trim()]
    .filter(Boolean)
    .join(" ");
  return {
    id: record.id,
    name: name || record.email,
    email: record.email,
    role: record.assigned_role,
  };
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
    (record.kind !== undefined &&
      record.kind !== null &&
      record.kind !== "individual" &&
      record.kind !== "group") ||
    !isNullableString(record.meeting_url) ||
    !isNullableString(record.assigned_ssa_id) ||
    !isNullableString(record.assigned_ssa_name) ||
    !isNullableTimestamp(record.last_synced_at) ||
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
    kind:
      record.kind === "individual" || record.kind === "group"
        ? record.kind
        : null,
    meetingUrl: nullableString(record.meeting_url),
    assignedSsaId: nullableString(record.assigned_ssa_id),
    assignedSsaName: nullableString(record.assigned_ssa_name),
    lastSyncedAt: nullableString(record.last_synced_at),
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
  return normalizePaginatedRows(payload, normalizeEmsClass);
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
  return normalizePaginatedRows(payload, normalizeEmsRoom);
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
    (record.total_hours !== undefined &&
      record.total_hours !== null &&
      !isNonNegativeInteger(record.total_hours)) ||
    !isNullableString(record.area_of_study_id) ||
    !isNullableString(record.area_of_study_name) ||
    !isNullableString(record.previous_course_id) ||
    !isNullableString(record.previous_course_name) ||
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
    totalHours:
      typeof record.total_hours === "number" ? record.total_hours : null,
    areaOfStudyId: nullableString(record.area_of_study_id),
    areaOfStudyName: nullableString(record.area_of_study_name),
    previousCourseId: nullableString(record.previous_course_id),
    previousCourseName: nullableString(record.previous_course_name),
    createdAt: record.created_at,
    updatedAt: record.updated_at,
  };
}

export function normalizeEmsCourseStatistics(
  payload: unknown
): EmsStagingCourseStatistics | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  const keys = [
    "active_classes",
    "enrolment_fill",
    "enrolment_capacity",
    "pending_enrolments",
    "open_leads",
  ] as const;
  if (!keys.every(key => isNonNegativeInteger(record[key]))) return null;
  return {
    activeClasses: record.active_classes as number,
    enrolmentFill: record.enrolment_fill as number,
    enrolmentCapacity: record.enrolment_capacity as number,
    pendingEnrolments: record.pending_enrolments as number,
    openLeads: record.open_leads as number,
  };
}

const SYNC_STEPS = ["group", "teachers", "students", "sessions", "grades"];

/** `POST /classes/{id}/moodle/sync`: the class plus per-step outcomes. */
export function normalizeEmsClassSync(payload: unknown): {
  class: EmsStagingClass;
  steps: EmsStagingClassSyncStep[];
  warnings: string[];
} | null {
  const value = normalizeEmsClass(payload);
  if (!value) return null;
  const record = payload as Record<string, unknown>;
  const steps: EmsStagingClassSyncStep[] = [];
  if (record.steps !== undefined && record.steps !== null) {
    if (!Array.isArray(record.steps)) return null;
    for (const item of record.steps) {
      if (!item || typeof item !== "object") return null;
      const step = item as Record<string, unknown>;
      if (
        typeof step.step !== "string" ||
        !SYNC_STEPS.includes(step.step) ||
        (step.status !== "ok" && step.status !== "error") ||
        !isNullableString(step.detail)
      ) {
        return null;
      }
      steps.push({
        step: step.step as EmsStagingClassSyncStep["step"],
        status: step.status,
        detail: nullableString(step.detail),
        warnings: Array.isArray(step.warnings)
          ? step.warnings.filter((w): w is string => typeof w === "string")
          : [],
      });
    }
  }
  const warnings = Array.isArray(record.warnings)
    ? record.warnings.filter((w): w is string => typeof w === "string")
    : [];
  return { class: value, steps, warnings };
}

export function normalizeEmsAttendanceSessions(
  payload: unknown
): EmsStagingAttendanceSessionSummary[] | null {
  if (!Array.isArray(payload)) return null;
  const items: EmsStagingAttendanceSessionSummary[] = [];
  for (const item of payload) {
    if (!item || typeof item !== "object") return null;
    const record = item as Record<string, unknown>;
    if (
      !Number.isSafeInteger(record.moodle_session_id) ||
      typeof record.sessdate !== "string" ||
      !isNonNegativeInteger(record.duration) ||
      !Number.isSafeInteger(record.groupid) ||
      !isNullableString(record.lasttaken) ||
      !isNullableString(record.description) ||
      !isNullableString(record.ems_session_id)
    ) {
      return null;
    }
    items.push({
      moodleSessionId: record.moodle_session_id as number,
      sessionDate: record.sessdate,
      durationSeconds: record.duration as number,
      moodleGroupId: record.groupid as number,
      lastTaken: nullableString(record.lasttaken),
      description: nullableString(record.description),
      emsSessionId: nullableString(record.ems_session_id),
    });
  }
  return items;
}

export function normalizeEmsCourses(
  payload: unknown
): EmsStagingCourse[] | null {
  return normalizePaginatedRows(payload, normalizeEmsCourse);
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

const SESSION_STATUSES = ["scheduled", "cancelled"] as const;


export function normalizeEmsClassEnrolments(
  payload: unknown
): EmsStagingClassEnrolment[] | null {
  return normalizeRows(payload, normalizeEmsEnrolment);
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
    !isNonNegativeInteger(record.pending_enrolments) ||
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
    pendingEnrolments: record.pending_enrolments as number,
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

export function normalizeEmsNotificationsDeleted(
  payload: unknown
): { deleted: number } | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  if (!isNonNegativeInteger(record.deleted)) return null;
  return { deleted: record.deleted as number };
}

export type EmsStagingAuthSession = {
  id: string;
  issuedAt: string;
  lastSeenAt: string;
  isCurrent: boolean;
  ipAddress: string | null;
  userAgent: string | null;
};

export function normalizeEmsAuthSessions(
  payload: unknown
): EmsStagingAuthSession[] | null {
  return normalizeRows(payload, value => {
    if (!value || typeof value !== "object") return null;
    const record = value as Record<string, unknown>;
    if (
      typeof record.id !== "string" ||
      !record.id ||
      typeof record.issued_at !== "string" ||
      !Number.isFinite(Date.parse(record.issued_at)) ||
      typeof record.last_seen_at !== "string" ||
      !Number.isFinite(Date.parse(record.last_seen_at)) ||
      typeof record.is_current !== "boolean" ||
      !isNullableString(record.ip_address) ||
      !isNullableString(record.user_agent)
    ) {
      return null;
    }
    return {
      id: record.id,
      issuedAt: record.issued_at,
      lastSeenAt: record.last_seen_at,
      isCurrent: record.is_current,
      ipAddress: nullableString(record.ip_address),
      userAgent: nullableString(record.user_agent),
    };
  });
}

export type EmsStagingSessionScopeOptions = {
  branches: Array<{ id: string; label: string }>;
  departments: Array<{ id: string; label: string }>;
  classes: Array<{ id: string; label: string }>;
};

function normalizeEmsScopeOptionItems(
  payload: unknown
): Array<{ id: string; label: string }> | null {
  return normalizeRows(payload, value => {
    if (!value || typeof value !== "object") return null;
    const record = value as Record<string, unknown>;
    if (
      typeof record.id !== "string" ||
      !record.id ||
      typeof record.label !== "string"
    ) {
      return null;
    }
    return { id: record.id, label: record.label };
  });
}

export function normalizeEmsSessionScopeOptions(
  payload: unknown
): EmsStagingSessionScopeOptions | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  const branches = normalizeEmsScopeOptionItems(record.branches);
  const departments = normalizeEmsScopeOptionItems(record.departments);
  const classes = normalizeEmsScopeOptionItems(record.classes);
  if (!branches || !departments || !classes) return null;
  return { branches, departments, classes };
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
    /** Every staff user: EMS caps a page at 100, so read until the total. */
    async users(token: string) {
      type Page = { items?: unknown; total?: unknown };
      const isPage = (value: unknown): value is Page & { items: unknown[] } =>
        typeof value === "object" && value !== null && Array.isArray((value as Page).items);
      const first = await request<unknown>("/users?page_size=100&page=1", { token });
      if (!first.ok || !isPage(first.data)) return first;
      const items = [...first.data.items];
      const total = typeof first.data.total === "number" ? first.data.total : items.length;
      for (let page = 2; items.length < total && page <= 50; page += 1) {
        const next = await request<unknown>(`/users?page_size=100&page=${page}`, { token });
        if (!next.ok) return next;
        if (!isPage(next.data) || next.data.items.length === 0) break;
        items.push(...next.data.items);
      }
      return { ok: true as const, data: { ...first.data, items, page: 1, page_size: items.length } };
    },
    userStatistics(token: string, userId: string) {
      return request<unknown>(
        `/users/${encodeURIComponent(userId)}/statistics`,
        { token }
      );
    },
    userCourses(token: string, userId: string) {
      return request<unknown>(
        `/users/${encodeURIComponent(userId)}/courses`,
        { token }
      );
    },
    putUserCourses(token: string, userId: string, courseIds: string[]) {
      return request<unknown>(
        `/users/${encodeURIComponent(userId)}/courses`,
        { method: "PUT", token, body: { course_ids: courseIds } }
      );
    },
    userHourCells(token: string, userId: string, from: string, to: string) {
      const params = new URLSearchParams({ from, to });
      return request<unknown>(
        `/users/${encodeURIComponent(userId)}/hour-cells?${params.toString()}`,
        { token }
      );
    },
    patchUserHourCells(
      token: string,
      userId: string,
      ops: EmsStagingHourCellOp[]
    ) {
      return request<unknown>(
        `/users/${encodeURIComponent(userId)}/hour-cells`,
        {
          method: "PATCH",
          token,
          body: {
            ops: ops.map(op => ({
              date: op.date,
              hour: op.hour,
              status: op.status,
            })),
          },
        }
      );
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
    disableUser(token: string, userId: string, reasonId?: string) {
      return request<unknown>(`/users/${encodeURIComponent(userId)}/disable`, {
        method: "POST",
        token,
        body: reasonId ? { reason_id: reasonId } : {},
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
    branch(token: string, branchId: string) {
      return request<unknown>(`/branches/${encodeURIComponent(branchId)}`, {
        token,
      });
    },
    branchStatistics(token: string, branchId: string) {
      return request<unknown>(
        `/branches/${encodeURIComponent(branchId)}/statistics`,
        { token }
      );
    },
    createBranch(token: string, body: Record<string, unknown>) {
      return request<unknown>("/branches", { method: "POST", token, body });
    },
    patchBranch(token: string, branchId: string, body: Record<string, unknown>) {
      return request<unknown>(`/branches/${encodeURIComponent(branchId)}`, {
        method: "PATCH",
        token,
        body,
      });
    },
    disableBranch(token: string, branchId: string, reasonId: string) {
      return request<unknown>(
        `/branches/${encodeURIComponent(branchId)}/disable`,
        { method: "POST", token, body: { reason_id: reasonId } }
      );
    },
    enableBranch(token: string, branchId: string) {
      return request<unknown>(
        `/branches/${encodeURIComponent(branchId)}/enable`,
        { method: "POST", token }
      );
    },
    createDepartment(token: string, body: Record<string, unknown>) {
      return request<unknown>("/departments", { method: "POST", token, body });
    },
    patchDepartment(
      token: string,
      departmentId: string,
      body: Record<string, unknown>
    ) {
      return request<unknown>(
        `/departments/${encodeURIComponent(departmentId)}`,
        { method: "PATCH", token, body }
      );
    },
    disableDepartment(token: string, departmentId: string, reasonId: string) {
      return request<unknown>(
        `/departments/${encodeURIComponent(departmentId)}/disable`,
        { method: "POST", token, body: { reason_id: reasonId } }
      );
    },
    enableDepartment(token: string, departmentId: string) {
      return request<unknown>(
        `/departments/${encodeURIComponent(departmentId)}/enable`,
        { method: "POST", token }
      );
    },
    lostReasons(token: string, activeOnly?: boolean) {
      const suffix = activeOnly ? "?active_only=true" : "";
      return request<unknown>(`/lost-reasons${suffix}`, { token });
    },
    createLostReason(token: string, body: Record<string, unknown>) {
      return request<unknown>("/lost-reasons", {
        method: "POST",
        token,
        body,
      });
    },
    patchLostReason(token: string, reasonId: string, body: Record<string, unknown>) {
      return request<unknown>(
        `/lost-reasons/${encodeURIComponent(reasonId)}`,
        { method: "PATCH", token, body }
      );
    },
    disableLostReason(token: string, reasonId: string) {
      return request<unknown>(
        `/lost-reasons/${encodeURIComponent(reasonId)}/disable`,
        { method: "POST", token }
      );
    },
    enableLostReason(token: string, reasonId: string) {
      return request<unknown>(
        `/lost-reasons/${encodeURIComponent(reasonId)}/enable`,
        { method: "POST", token }
      );
    },
    actionReasons(token: string, kind?: string, activeOnly?: boolean) {
      const params = new URLSearchParams();
      if (kind) params.set("kind", kind);
      if (activeOnly) params.set("active_only", "true");
      const suffix = params.size ? `?${params.toString()}` : "";
      return request<unknown>(`/action-reasons${suffix}`, { token });
    },
    createActionReason(token: string, body: Record<string, unknown>) {
      return request<unknown>("/action-reasons", {
        method: "POST",
        token,
        body,
      });
    },
    patchActionReason(
      token: string,
      reasonId: string,
      body: Record<string, unknown>
    ) {
      return request<unknown>(
        `/action-reasons/${encodeURIComponent(reasonId)}`,
        { method: "PATCH", token, body }
      );
    },
    disableActionReason(token: string, reasonId: string) {
      return request<unknown>(
        `/action-reasons/${encodeURIComponent(reasonId)}/disable`,
        { method: "POST", token }
      );
    },
    enableActionReason(token: string, reasonId: string) {
      return request<unknown>(
        `/action-reasons/${encodeURIComponent(reasonId)}/enable`,
        { method: "POST", token }
      );
    },
    importActionReasons(token: string, body: Record<string, unknown>) {
      return request<unknown>("/action-reasons/import", {
        method: "POST",
        token,
        body,
      });
    },
    areasOfStudy(token: string, activeOnly?: boolean) {
      const suffix = activeOnly ? "?active_only=true" : "";
      return request<unknown>(`/areas-of-study${suffix}`, { token });
    },
    createAreaOfStudy(token: string, body: Record<string, unknown>) {
      return request<unknown>("/areas-of-study", {
        method: "POST",
        token,
        body,
      });
    },
    patchAreaOfStudy(token: string, areaId: string, body: Record<string, unknown>) {
      return request<unknown>(
        `/areas-of-study/${encodeURIComponent(areaId)}`,
        { method: "PATCH", token, body }
      );
    },
    disableAreaOfStudy(token: string, areaId: string, reasonId: string) {
      return request<unknown>(
        `/areas-of-study/${encodeURIComponent(areaId)}/disable`,
        { method: "POST", token, body: { reason_id: reasonId } }
      );
    },
    enableAreaOfStudy(token: string, areaId: string) {
      return request<unknown>(
        `/areas-of-study/${encodeURIComponent(areaId)}/enable`,
        { method: "POST", token }
      );
    },
    customFieldDefinitions(
      token: string,
      entityType?: string,
      isActive?: boolean
    ) {
      const params = new URLSearchParams();
      if (entityType) params.set("entity_type", entityType);
      if (isActive !== undefined) params.set("is_active", String(isActive));
      const suffix = params.size ? `?${params.toString()}` : "";
      return request<unknown>(`/custom-fields${suffix}`, { token });
    },
    createCustomField(token: string, body: Record<string, unknown>) {
      return request<unknown>("/custom-fields", {
        method: "POST",
        token,
        body,
      });
    },
    patchCustomField(token: string, fieldId: string, body: Record<string, unknown>) {
      return request<unknown>(
        `/custom-fields/${encodeURIComponent(fieldId)}`,
        { method: "PATCH", token, body }
      );
    },
    disableCustomField(token: string, fieldId: string, reasonId: string) {
      return request<unknown>(
        `/custom-fields/${encodeURIComponent(fieldId)}/disable`,
        { method: "POST", token, body: { reason_id: reasonId } }
      );
    },
    enableCustomField(token: string, fieldId: string) {
      return request<unknown>(
        `/custom-fields/${encodeURIComponent(fieldId)}/enable`,
        { method: "POST", token }
      );
    },
    students(token: string, query: EmsStagingListQuery = {}) {
      return request<unknown>(`/students${listQuery(query)}`, { token });
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
    disableStudent(token: string, studentId: string, reasonId: string) {
      return request<unknown>(
        `/students/${encodeURIComponent(studentId)}/disable`,
        { method: "POST", token, body: { reason_id: reasonId } }
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
    leads(token: string, query: EmsStagingListQuery = {}) {
      return request<unknown>(`/leads${listQuery(query)}`, { token });
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
    lead(token: string, leadId: string) {
      return request<unknown>(`/leads/${encodeURIComponent(leadId)}`, {
        token,
      });
    },
    placementTests(token: string, query: EmsStagingListQuery = {}) {
      return request<unknown>(`/placement-tests${listQuery(query)}`, { token });
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
    cancelPlacementTest(
      token: string,
      placementTestId: string,
      reasonId: string
    ) {
      return request<unknown>(
        `/placement-tests/${encodeURIComponent(placementTestId)}/cancel`,
        { method: "POST", token, body: { reason_id: reasonId } }
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
    enrolments(token: string, query: EmsStagingListQuery = {}) {
      return request<unknown>(`/enrolments${listQuery(query)}`, { token });
    },
    trialLessons(token: string, query: EmsStagingListQuery = {}) {
      return request<unknown>(`/trial-lessons${listQuery(query)}`, { token });
    },
    syncPlacementMoodleResult(token: string, placementTestId: string) {
      return request<unknown>(
        `/placement-tests/${encodeURIComponent(placementTestId)}/sync-moodle-result`,
        { method: "POST", token }
      );
    },
    trialLesson(token: string, trialLessonId: string) {
      return request<unknown>(
        `/trial-lessons/${encodeURIComponent(trialLessonId)}`,
        { token }
      );
    },
    createTrialLesson(token: string, body: Record<string, unknown>) {
      return request<unknown>("/trial-lessons", { method: "POST", token, body });
    },
    patchTrialLesson(
      token: string,
      trialLessonId: string,
      body: Record<string, unknown>
    ) {
      return request<unknown>(
        `/trial-lessons/${encodeURIComponent(trialLessonId)}`,
        { method: "PATCH", token, body }
      );
    },
    recordTrialLessonResult(
      token: string,
      trialLessonId: string,
      body: Record<string, unknown>
    ) {
      return request<unknown>(
        `/trial-lessons/${encodeURIComponent(trialLessonId)}/record-result`,
        { method: "POST", token, body }
      );
    },
    cancelTrialLesson(token: string, trialLessonId: string, reasonId: string) {
      return request<unknown>(
        `/trial-lessons/${encodeURIComponent(trialLessonId)}/cancel`,
        { method: "POST", token, body: { reason_id: reasonId } }
      );
    },
    createEnrolment(token: string, body: Record<string, unknown>) {
      return request<unknown>("/enrolments", { method: "POST", token, body });
    },
    patchEnrolment(
      token: string,
      enrolmentId: string,
      body: Record<string, unknown>
    ) {
      return request<unknown>(
        `/enrolments/${encodeURIComponent(enrolmentId)}`,
        { method: "PATCH", token, body }
      );
    },
    leaveEnrolment(token: string, enrolmentId: string, reasonId: string) {
      return request<unknown>(
        `/enrolments/${encodeURIComponent(enrolmentId)}/leave`,
        { method: "POST", token, body: { reason_id: reasonId } }
      );
    },
    cancelEnrolment(token: string, enrolmentId: string, reasonId: string) {
      return request<unknown>(
        `/enrolments/${encodeURIComponent(enrolmentId)}/cancel`,
        { method: "POST", token, body: { reason_id: reasonId } }
      );
    },
    completeEnrolment(token: string, enrolmentId: string) {
      return request<unknown>(
        `/enrolments/${encodeURIComponent(enrolmentId)}/complete`,
        { method: "POST", token }
      );
    },
    putLeadRegistration(
      token: string,
      leadId: string,
      body: Record<string, unknown>
    ) {
      return request<unknown>(
        `/leads/${encodeURIComponent(leadId)}/registration`,
        { method: "PUT", token, body }
      );
    },
    patchStudentRegistration(
      token: string,
      studentId: string,
      body: Record<string, unknown>
    ) {
      return request<unknown>(
        `/students/${encodeURIComponent(studentId)}/registration`,
        { method: "PATCH", token, body }
      );
    },
    studentLearning(token: string, studentId: string) {
      return request<unknown>(
        `/students/${encodeURIComponent(studentId)}/learning`,
        { token }
      );
    },
    studentReport(token: string, studentId: string, classId?: string) {
      return request<unknown>(
        `/students/${encodeURIComponent(studentId)}/report${emsQueryString({
          class_id: classId,
        })}`,
        { token }
      );
    },
    leadGroups(token: string, branchId?: string) {
      return request<unknown>(
        `/lead-groups${emsQueryString({ branch_id: branchId })}`,
        { token }
      );
    },
    leadGroup(token: string, groupId: string) {
      return request<unknown>(`/lead-groups/${encodeURIComponent(groupId)}`, {
        token,
      });
    },
    createLeadGroup(token: string, body: Record<string, unknown>) {
      return request<unknown>("/lead-groups", { method: "POST", token, body });
    },
    patchLeadGroup(
      token: string,
      groupId: string,
      body: Record<string, unknown>
    ) {
      return request<unknown>(`/lead-groups/${encodeURIComponent(groupId)}`, {
        method: "PATCH",
        token,
        body,
      });
    },
    deleteLeadGroup(token: string, groupId: string) {
      return request<unknown>(`/lead-groups/${encodeURIComponent(groupId)}`, {
        method: "DELETE",
        token,
      });
    },
    assignees(token: string, branchId: string, search?: string) {
      return request<unknown>(
        `/users/assignees${emsQueryString({
          branch_id: branchId,
          search,
          page_size: 100,
        })}`,
        { token }
      );
    },
    classes(token: string, query: EmsStagingListQuery = {}) {
      return request<unknown>(`/classes${listQuery(query)}`, { token });
    },
    class(token: string, classId: string) {
      return request<unknown>(`/classes/${encodeURIComponent(classId)}`, {
        token,
      });
    },
    rooms(token: string) {
      return request<unknown>("/rooms?page_size=100", { token });
    },
    courses(token: string, query: EmsStagingListQuery = {}) {
      return request<unknown>(`/courses${listQuery(query)}`, { token });
    },
    refreshCourses(token: string, query: EmsStagingListQuery = {}) {
      return request<unknown>(`/courses/refresh${listQuery(query)}`, {
        method: "POST",
        token,
      });
    },
    courseStatistics(token: string, courseId: string) {
      return request<unknown>(
        `/courses/${encodeURIComponent(courseId)}/statistics`,
        { token }
      );
    },
    roomHourCells(token: string, roomId: string, from: string, to: string) {
      const params = new URLSearchParams({ from, to });
      return request<unknown>(
        `/rooms/${encodeURIComponent(roomId)}/hour-cells?${params.toString()}`,
        { token }
      );
    },
    patchRoomHourCells(
      token: string,
      roomId: string,
      ops: EmsStagingHourCellOp[]
    ) {
      return request<unknown>(
        `/rooms/${encodeURIComponent(roomId)}/hour-cells`,
        {
          method: "PATCH",
          token,
          body: {
            ops: ops.map(op => ({
              date: op.date,
              hour: op.hour,
              status: op.status,
            })),
          },
        }
      );
    },
    classAttendanceSessions(token: string, classId: string) {
      return request<unknown>(
        `/classes/${encodeURIComponent(classId)}/attendance/sessions`,
        { token }
      );
    },
    classAttendanceSession(
      token: string,
      classId: string,
      moodleSessionId: number
    ) {
      return request<unknown>(
        `/classes/${encodeURIComponent(classId)}/attendance/sessions/${moodleSessionId}`,
        { token }
      );
    },
    markClassAttendance(
      token: string,
      classId: string,
      moodleSessionId: number,
      body: Record<string, unknown>
    ) {
      return request<unknown>(
        `/classes/${encodeURIComponent(classId)}/attendance/sessions/${moodleSessionId}`,
        { method: "POST", token, body }
      );
    },
    moodleCourses(
      token: string,
      query?: string,
      refresh?: boolean,
      unmapped?: boolean
    ) {
      const params = new URLSearchParams();
      if (query?.trim()) params.set("q", query.trim());
      if (refresh) params.set("refresh", "true");
      if (unmapped !== undefined) params.set("unmapped", String(unmapped));
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
    disableCourse(token: string, courseId: string, reasonId: string) {
      return request<unknown>(
        `/courses/${encodeURIComponent(courseId)}/disable`,
        { method: "POST", token, body: { reason_id: reasonId } }
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
    disableRoom(token: string, roomId: string, reasonId: string) {
      return request<unknown>(`/rooms/${encodeURIComponent(roomId)}/disable`, {
        method: "POST",
        token,
        body: { reason_id: reasonId },
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
    disableClass(token: string, classId: string, reasonId: string) {
      return request<unknown>(
        `/classes/${encodeURIComponent(classId)}/disable`,
        { method: "POST", token, body: { reason_id: reasonId } }
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
    attachClassEnrolment(
      token: string,
      classId: string,
      body: Record<string, unknown>
    ) {
      return request<unknown>(
        `/classes/${encodeURIComponent(classId)}/enrolments`,
        { method: "POST", token, body }
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
    moodleSite(token: string) {
      return request<unknown>("/moodle/site", { token });
    },
    putMoodleSite(token: string, body: Record<string, unknown>) {
      return request<unknown>("/moodle/site", {
        method: "PUT",
        token,
        body,
      });
    },
    patchMoodleSite(token: string, body: Record<string, unknown>) {
      return request<unknown>("/moodle/site", {
        method: "PATCH",
        token,
        body,
      });
    },
    disconnectMoodleSite(token: string) {
      return request<unknown>("/moodle/site/disconnect", {
        method: "POST",
        token,
      });
    },
    testMoodleSite(token: string) {
      return request<unknown>("/moodle/site/test", {
        method: "POST",
        token,
      });
    },
    dashboardSummary(
      token: string,
      filters: { branchId?: string; createdFrom?: string; createdTo?: string } = {}
    ) {
      const params = new URLSearchParams();
      if (filters.branchId) params.set("branch_id", filters.branchId);
      if (filters.createdFrom) params.set("created_from", filters.createdFrom);
      if (filters.createdTo) params.set("created_to", filters.createdTo);
      const suffix = params.size ? `?${params.toString()}` : "";
      return request<unknown>(`/dashboard/summary${suffix}`, { token });
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
    deleteNotification(token: string, notificationId: string) {
      return request<unknown>(
        `/notifications/${encodeURIComponent(notificationId)}`,
        { method: "DELETE", token }
      );
    },
    deleteAllNotifications(token: string) {
      return request<unknown>("/notifications/delete-all", {
        method: "POST",
        token,
      });
    },
    switchSessionScopes(token: string, scopes: Record<string, unknown>) {
      return request<unknown>("/auth/session-scopes", {
        method: "POST",
        token,
        body: scopes,
      });
    },
    sessionScopeOptions(token: string) {
      return request<unknown>("/auth/session-scope-options", { token });
    },
    authSessions(token: string) {
      return request<unknown>("/auth/sessions", { token });
    },
    revokeAuthSession(token: string, sessionId: string) {
      return request<unknown>(
        `/auth/sessions/${encodeURIComponent(sessionId)}`,
        { method: "DELETE", token }
      );
    },
    logoutAllSessions(token: string) {
      return request<null>("/auth/logout-all", { method: "POST", token });
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
