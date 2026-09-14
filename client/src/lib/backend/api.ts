import type { Role } from "@/lib/platformData";
import type {
  PlatformLearningAction,
  PlatformLearningActionResult,
  PlatformWorkflowAction,
  PlatformWorkflowActionResult,
} from "@/lib/domain/actions";
import type {
  CertificateVerificationResult,
  PlatformState,
} from "@/lib/domain/types";

export type AuthSessionDto = {
  userId: string;
  email: string;
  name: string;
  roles: Role[];
  activeRole: Role;
  assignedRole?: Role;
  workspaceBranchId?: string | null;
  provider: "supabase" | "demo" | "ncc";
  authorizationModel: "snapshot" | "normalized" | "external";
  branchIds: string[];
  departmentIds: string[];
  expiresAt: string;
};

type ApiResult<T> = {
  ok: boolean;
  data?: T;
  error?: string;
  status?: number;
};

async function apiJson<T>(
  path: string,
  init: RequestInit = {}
): Promise<ApiResult<T>> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type"))
    headers.set("Content-Type", "application/json");
  if (init.method && init.method.toUpperCase() !== "GET")
    headers.set("X-Nile-Learn-Request", "browser");

  try {
    const response = await fetch(path, {
      ...init,
      credentials: "include",
      headers,
    });
    const data = (await response.json().catch(() => null)) as
      | T
      | { error?: string }
      | null;
    const errorMessage =
      data &&
      typeof data === "object" &&
      "error" in data &&
      typeof data.error === "string"
        ? data.error
        : `Request failed with ${response.status}`;
    if (!response.ok) {
      return { ok: false, error: errorMessage, status: response.status };
    }
    return { ok: true, data: data as T };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Network request failed",
    };
  }
}

export type AuthModeDto = {
  staffProvider: "ncc" | "compatibility";
};

export function fetchAuthModeRequest() {
  return apiJson<AuthModeDto>("/api/auth/mode");
}

export function signInRequest(input: {
  email: string;
  password: string;
  role?: Role;
}) {
  return apiJson<AuthSessionDto>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function requestPasswordReset(input: { email: string; role?: Role }) {
  return apiJson<{ ok: true; demoResetPath?: string; expiresAt?: string }>(
    "/api/auth/password-reset/request",
    {
      method: "POST",
      body: JSON.stringify(input),
    }
  );
}

export function confirmPasswordReset(input: {
  token?: string;
  email?: string;
  accessToken?: string;
  password: string;
}) {
  return apiJson<{ ok: true; role?: Role }>(
    "/api/auth/password-reset/confirm",
    {
      method: "POST",
      body: JSON.stringify(input),
    }
  );
}

export function changePasswordRequest(input: {
  currentPassword: string;
  newPassword: string;
}) {
  return apiJson<{
    ok: true;
    role?: Role;
    state?: PlatformState;
    persistence?: "supabase" | "local";
    syncedAt?: string;
  }>("/api/auth/password-change", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function fetchSessionRequest() {
  return apiJson<AuthSessionDto | null>("/api/auth/session");
}

export type NccSelfProfileDto = {
  firstName: string;
  lastName: string;
  phone: string | null;
  address: string | null;
  nationality: string | null;
  dateOfBirth: string | null;
  notes: string | null;
};

export type NccSelfProfileInput = {
  firstName: string;
  lastName: string;
  phone?: string | null;
  address?: string | null;
  nationality?: string | null;
  dateOfBirth?: string | null;
  notes?: string | null;
};

export function fetchNccSelfProfileRequest() {
  return apiJson<{ profile: NccSelfProfileDto }>("/api/ncc/account/profile");
}

export function patchNccSelfProfileRequest(input: NccSelfProfileInput) {
  return apiJson<{ profile: NccSelfProfileDto }>("/api/ncc/account/profile", {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function switchRoleRequest(role: Role) {
  return apiJson<AuthSessionDto>("/api/auth/switch-role", {
    method: "POST",
    body: JSON.stringify({ role }),
  });
}

export type AuthWorkspaceDto = {
  id: string;
  name: string;
  timezone: string;
};

export function fetchAuthWorkspacesRequest() {
  return apiJson<{ items: AuthWorkspaceDto[] }>("/api/auth/workspaces");
}

export function switchWorkspaceRequest(branchId: string) {
  return apiJson<AuthSessionDto>("/api/auth/switch-workspace", {
    method: "POST",
    body: JSON.stringify({ branchId }),
  });
}

export type NccStaffUserDto = {
  id: string;
  email: string;
  name: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  role: Exclude<Role, "student">;
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

export type NccCustomFieldDefinitionDto = {
  id: string;
  fieldKey: string;
  label: string;
  fieldType: "text" | "textarea" | "number" | "date" | "boolean" | "select";
  isRequired: boolean;
  helpText: string | null;
  options: string[] | null;
  sortOrder: number;
};

export type NccBranchDto = {
  id: string;
  name: string;
  code?: string | null;
  status: "active" | "disabled";
  timezone: string;
};

export type NccDepartmentDto = {
  id: string;
  name: string;
  code: string | null;
  status: "active" | "disabled";
};

export function fetchNccDirectoryUsersRequest() {
  return apiJson<{ items: NccStaffUserDto[] }>("/api/ncc/directory/users");
}

export function fetchNccDirectoryUserRequest(userId: string) {
  return apiJson<{ user: NccStaffUserDto }>(
    `/api/ncc/directory/users/${encodeURIComponent(userId)}`
  );
}

export function fetchNccDirectoryBranchesRequest() {
  return apiJson<{ items: NccBranchDto[] }>("/api/ncc/directory/branches");
}

export function fetchNccDirectoryDepartmentsRequest() {
  return apiJson<{ items: NccDepartmentDto[] }>(
    "/api/ncc/directory/departments"
  );
}

export function fetchNccDirectoryCustomFieldsRequest() {
  return apiJson<{ items: NccCustomFieldDefinitionDto[] }>(
    "/api/ncc/directory/custom-fields"
  );
}

export type NccStaffProfileInput = {
  firstName: string;
  lastName: string;
  phone?: string | null;
};

export type NccStaffUserCreateInput = {
  email: string;
  role: NccStaffUserDto["role"];
  provisioning: "invitation" | "manual";
  profile: NccStaffProfileInput;
  branchIds?: string[];
  departmentIds?: string[];
  customFields?: Record<string, string | number | boolean | null>;
  callerPassword?: string;
};

export type NccStaffUserPatchInput = {
  email?: string;
  role?: NccStaffUserDto["role"];
  profile?: NccStaffProfileInput;
  branchIds?: string[];
  departmentIds?: string[];
  customFields?: Record<string, string | number | boolean | null>;
  callerPassword?: string;
};

export type NccInvitationOneTimeDto = {
  generatedPassword?: string | null;
  invitationPath?: string | null;
  invitationUrlUnparseable?: boolean;
};

export function createNccStaffUserRequest(input: NccStaffUserCreateInput) {
  return apiJson<{
    user: NccStaffUserDto;
    oneTime: Required<NccInvitationOneTimeDto>;
  }>("/api/ncc/directory/users", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function patchNccStaffUserRequest(
  userId: string,
  input: NccStaffUserPatchInput
) {
  return apiJson<{ user: NccStaffUserDto }>(
    `/api/ncc/directory/users/${encodeURIComponent(userId)}`,
    { method: "PATCH", body: JSON.stringify(input) }
  );
}

function nccUserActionRequest<T>(
  userId: string,
  action: string,
  body?: unknown
) {
  return apiJson<T>(
    `/api/ncc/directory/users/${encodeURIComponent(userId)}/${action}`,
    {
      method: "POST",
      body: body === undefined ? undefined : JSON.stringify(body),
    }
  );
}

export function disableNccStaffUserRequest(userId: string) {
  return nccUserActionRequest<{ user: NccStaffUserDto }>(userId, "disable");
}

export function enableNccStaffUserRequest(userId: string) {
  return nccUserActionRequest<{ user: NccStaffUserDto }>(userId, "enable");
}

export function resetNccStaffPasswordRequest(
  userId: string,
  callerPassword?: string
) {
  return nccUserActionRequest<{
    oneTime: { generatedPassword: string };
  }>(userId, "password", callerPassword ? { callerPassword } : {});
}

export function inviteNccStaffUserRequest(userId: string) {
  return nccUserActionRequest<{
    oneTime: {
      invitationPath: string | null;
      invitationUrlUnparseable: boolean;
    };
  }>(userId, "invite");
}

export function cancelNccStaffInvitationRequest(userId: string) {
  return nccUserActionRequest<{ user: NccStaffUserDto }>(
    userId,
    "cancel-invitation"
  );
}

export type NccMoodleUserDto = {
  id: number;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  fullName: string | null;
  email: string | null;
};

export type NccMoodleBindInput =
  | { mode: "create" }
  | { mode: "link"; moodleUserId: number };

export type NccMoodleOneTimeDto = { generatedMoodlePassword: string | null };

export function fetchNccMoodleUsersRequest(q: string) {
  return apiJson<{ items: NccMoodleUserDto[] }>(
    `/api/ncc/moodle/users?q=${encodeURIComponent(q)}`
  );
}

export function bindNccStaffMoodleRequest(
  userId: string,
  input: NccMoodleBindInput
) {
  return apiJson<{ user: NccStaffUserDto; oneTime: NccMoodleOneTimeDto }>(
    `/api/ncc/directory/users/${encodeURIComponent(userId)}/moodle`,
    { method: "POST", body: JSON.stringify(input) }
  );
}

export function resetNccStaffMoodlePasswordRequest(userId: string) {
  return apiJson<{ oneTime: { generatedMoodlePassword: string } }>(
    `/api/ncc/directory/users/${encodeURIComponent(userId)}/moodle/password`,
    { method: "POST" }
  );
}

export function bindNccStudentMoodleRequest(
  studentId: string,
  input: NccMoodleBindInput
) {
  return apiJson<{ student: NccStudentDto; oneTime: NccMoodleOneTimeDto }>(
    `/api/ncc/admissions/students/${encodeURIComponent(studentId)}/moodle`,
    { method: "POST", body: JSON.stringify(input) }
  );
}

export function resetNccStudentMoodlePasswordRequest(studentId: string) {
  return apiJson<{ oneTime: { generatedMoodlePassword: string } }>(
    `/api/ncc/admissions/students/${encodeURIComponent(studentId)}/moodle/password`,
    { method: "POST" }
  );
}

export function validateNccInvitationRequest(token: string) {
  return apiJson<{ email: string; expiresAt: string }>(
    "/api/ncc/invitations/validate",
    { method: "POST", body: JSON.stringify({ token }) }
  );
}

export function acceptNccInvitationRequest(token: string, password: string) {
  return apiJson<AuthSessionDto>("/api/ncc/invitations/accept", {
    method: "POST",
    body: JSON.stringify({ token, password }),
  });
}

export type NccStudentGuardianDto = {
  sortOrder: 1 | 2;
  name: string;
  phone: string;
  email: string;
  relationship: string;
};

export type NccStudentIdentityInput = {
  nationality: string;
  address: string;
  gender: "male" | "female";
  dateOfBirth: string;
  phone?: string | null;
  passportNumber?: string | null;
  nationalId?: string | null;
  guardians?: NccStudentGuardianDto[];
};

export type NccStudentDto = {
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
  guardians: NccStudentGuardianDto[];
  branchId: string;
  branchName: string;
  status: "active" | "disabled";
  moodleLinked: boolean;
  createdAt: string;
  updatedAt: string;
};

export type NccStudentEnrolmentDto = {
  classId: string;
  className: string;
  courseName: string | null;
  status: string;
  enrolledAt: string | null;
  withdrawnAt: string | null;
};

export type NccLeadDto = {
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

export type NccPlacementTestDto = {
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

export type NccClassDto = {
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

export type NccRoomDto = {
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

export type NccCourseDto = {
  id: string;
  fullname: string;
  shortname: string;
  departmentId: string;
  departmentName: string;
  status: "active" | "disabled";
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
  departmentStatus: "active" | "disabled";
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type NccMoodleCourseDto = {
  id: number;
  shortname: string;
  idNumber: string | null;
  fullname: string;
  displayName: string | null;
  categoryId: number | null;
  categoryName: string | null;
  visible: boolean | null;
};

export type NccMoodleCoursePickerDto = {
  refreshedAt: string | null;
  warnings: string[];
  error: string | null;
  courses: NccMoodleCourseDto[];
};

export type NccMoodleGroupDto = {
  id: number;
  name: string;
  idNumber: string | null;
  moodleCourseId: number;
};

export type NccTeacherWorkspaceDto = {
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

export function fetchNccStudentsRequest() {
  return apiJson<{ items: NccStudentDto[] }>("/api/ncc/admissions/students");
}

export function fetchNccStudentRequest(studentId: string) {
  return apiJson<{ student: NccStudentDto }>(
    `/api/ncc/admissions/students/${encodeURIComponent(studentId)}`
  );
}

export function fetchNccStudentEnrolmentsRequest(studentId: string) {
  return apiJson<{ items: NccStudentEnrolmentDto[] }>(
    `/api/ncc/admissions/students/${encodeURIComponent(studentId)}/enrolments`
  );
}

export function fetchNccLeadsRequest() {
  return apiJson<{ items: NccLeadDto[] }>("/api/ncc/admissions/leads");
}

export function fetchNccLeadRequest(leadId: string) {
  return apiJson<{ lead: NccLeadDto }>(
    `/api/ncc/admissions/leads/${encodeURIComponent(leadId)}`
  );
}

export function fetchNccPlacementTestsRequest() {
  return apiJson<{ items: NccPlacementTestDto[] }>(
    "/api/ncc/admissions/placement-tests"
  );
}

export function fetchNccPlacementTestRequest(placementTestId: string) {
  return apiJson<{ placementTest: NccPlacementTestDto }>(
    `/api/ncc/admissions/placement-tests/${encodeURIComponent(placementTestId)}`
  );
}

export function fetchNccClassesRequest() {
  return apiJson<{ items: NccClassDto[] }>("/api/ncc/delivery/classes");
}

export function fetchNccClassRequest(classId: string) {
  return apiJson<{ class: NccClassDto }>(
    `/api/ncc/delivery/classes/${encodeURIComponent(classId)}`
  );
}

export function fetchNccRoomsRequest() {
  return apiJson<{ items: NccRoomDto[] }>("/api/ncc/delivery/rooms");
}

export function fetchNccTeacherWorkspaceRequest() {
  return apiJson<{ workspace: NccTeacherWorkspaceDto }>(
    "/api/ncc/delivery/teacher-workspace"
  );
}

export function fetchNccMoodleCoursesRequest(q?: string, refresh?: boolean) {
  const params = new URLSearchParams();
  if (q?.trim()) params.set("q", q.trim());
  if (refresh) params.set("refresh", "true");
  const suffix = params.size ? `?${params.toString()}` : "";
  return apiJson<NccMoodleCoursePickerDto>(
    `/api/ncc/delivery/moodle-courses${suffix}`
  );
}

export function fetchNccCourseRequest(courseId: string) {
  return apiJson<{ course: NccCourseDto }>(
    `/api/ncc/delivery/courses/${encodeURIComponent(courseId)}`
  );
}

export function createNccCourseRequest(input: {
  departmentId: string;
  moodleCourseId: number;
  sortOrder?: number;
}) {
  return apiJson<{ course: NccCourseDto }>("/api/ncc/delivery/courses", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function patchNccCourseRequest(
  courseId: string,
  input: {
    departmentId?: string;
    sortOrder?: number;
    moodleAttendanceId?: number | null;
  }
) {
  return apiJson<{ course: NccCourseDto }>(
    `/api/ncc/delivery/courses/${encodeURIComponent(courseId)}`,
    { method: "PATCH", body: JSON.stringify(input) }
  );
}

export function disableNccCourseRequest(courseId: string) {
  return apiJson<{ course: NccCourseDto }>(
    `/api/ncc/delivery/courses/${encodeURIComponent(courseId)}/disable`,
    { method: "POST" }
  );
}

export function enableNccCourseRequest(courseId: string) {
  return apiJson<{ course: NccCourseDto }>(
    `/api/ncc/delivery/courses/${encodeURIComponent(courseId)}/enable`,
    { method: "POST" }
  );
}

export function refreshNccCourseRequest(courseId: string) {
  return apiJson<{ course: NccCourseDto }>(
    `/api/ncc/delivery/courses/${encodeURIComponent(courseId)}/refresh`,
    { method: "POST" }
  );
}

export function fetchNccRoomRequest(roomId: string) {
  return apiJson<{ room: NccRoomDto }>(
    `/api/ncc/delivery/rooms/${encodeURIComponent(roomId)}`
  );
}

export function createNccRoomRequest(input: {
  name: string;
  capacity?: number | null;
  sortOrder?: number;
  branchId?: string;
}) {
  return apiJson<{ room: NccRoomDto }>("/api/ncc/delivery/rooms", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function patchNccRoomRequest(
  roomId: string,
  input: { name?: string; capacity?: number | null; sortOrder?: number }
) {
  return apiJson<{ room: NccRoomDto }>(
    `/api/ncc/delivery/rooms/${encodeURIComponent(roomId)}`,
    { method: "PATCH", body: JSON.stringify(input) }
  );
}

export function disableNccRoomRequest(roomId: string) {
  return apiJson<{ room: NccRoomDto }>(
    `/api/ncc/delivery/rooms/${encodeURIComponent(roomId)}/disable`,
    { method: "POST" }
  );
}

export function enableNccRoomRequest(roomId: string) {
  return apiJson<{ room: NccRoomDto }>(
    `/api/ncc/delivery/rooms/${encodeURIComponent(roomId)}/enable`,
    { method: "POST" }
  );
}

export type NccClassScheduleInput = {
  daysOfWeek: number[];
  startTime: string;
  endTime: string;
} | null;

export type NccClassCreateInput = {
  name: string;
  courseId: string;
  capacity: number;
  startAt: string;
  endAt: string;
  teacherIds?: string[];
  sortOrder?: number;
  schedule?: NccClassScheduleInput;
  defaultRoomId?: string | null;
  branchId?: string;
};

export type NccClassPatchInput = {
  name?: string;
  capacity?: number;
  startAt?: string;
  endAt?: string;
  teacherIds?: string[];
  sortOrder?: number;
  schedule?: NccClassScheduleInput;
  defaultRoomId?: string | null;
};

export function createNccClassRequest(input: NccClassCreateInput) {
  return apiJson<{ class: NccClassDto }>("/api/ncc/delivery/classes", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function patchNccClassRequest(
  classId: string,
  input: NccClassPatchInput
) {
  return apiJson<{ class: NccClassDto }>(
    `/api/ncc/delivery/classes/${encodeURIComponent(classId)}`,
    { method: "PATCH", body: JSON.stringify(input) }
  );
}

export function disableNccClassRequest(classId: string) {
  return apiJson<{ class: NccClassDto }>(
    `/api/ncc/delivery/classes/${encodeURIComponent(classId)}/disable`,
    { method: "POST" }
  );
}

export function enableNccClassRequest(classId: string) {
  return apiJson<{ class: NccClassDto }>(
    `/api/ncc/delivery/classes/${encodeURIComponent(classId)}/enable`,
    { method: "POST" }
  );
}

export function fetchNccMoodleGroupsRequest(courseId: string, q: string) {
  const params = new URLSearchParams({ courseId, q });
  return apiJson<{ items: NccMoodleGroupDto[] }>(
    `/api/ncc/delivery/moodle-groups?${params.toString()}`
  );
}

export function bindNccClassMoodleRequest(
  classId: string,
  input: { mode: "create" } | { mode: "link"; moodleGroupId: number }
) {
  return apiJson<{ class: NccClassDto }>(
    `/api/ncc/delivery/classes/${encodeURIComponent(classId)}/moodle`,
    { method: "POST", body: JSON.stringify(input) }
  );
}

export function syncNccClassMoodleRequest(classId: string) {
  return apiJson<{ class: NccClassDto }>(
    `/api/ncc/delivery/classes/${encodeURIComponent(classId)}/moodle/sync`,
    { method: "POST" }
  );
}

export type NccClassEnrolmentDto = {
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

export type NccSessionDto = {
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

export type NccSessionSlotDto = {
  startsAt: string;
  durationHours: number;
  teacherId: string;
  roomId: string | null;
};

export type NccSessionSlotInput = {
  startsAt: string;
  durationHours: number;
  teacherId: string;
  roomId?: string | null;
};

export type NccAttendanceStatusDto = {
  id: number;
  acronym: string | null;
  description: string | null;
};

export type NccAttendanceStudentDto = {
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

export type NccAttendanceDetailDto = {
  moodleSessionId: number;
  attendanceId: number;
  emsSessionId: string | null;
  sessionDate: string | null;
  durationSeconds: number;
  moodleGroupId: number;
  statuses: NccAttendanceStatusDto[];
  students: NccAttendanceStudentDto[];
};

export type NccGradeItemDto = {
  id: number;
  itemName: string | null;
  itemType: string | null;
  itemModule: string | null;
  gradeFormatted: string | null;
  percentageFormatted: string | null;
  gradeMin: number | null;
  gradeMax: number | null;
};

export type NccClassGradesDto = {
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
    gradeItems: NccGradeItemDto[];
  }>;
};

export function fetchNccClassEnrolmentsRequest(classId: string) {
  return apiJson<{ items: NccClassEnrolmentDto[] }>(
    `/api/ncc/delivery/classes/${encodeURIComponent(classId)}/enrolments`
  );
}

export function createNccClassEnrolmentRequest(
  classId: string,
  input: { studentId: string; status?: "pending" | "enrolled" }
) {
  return apiJson<{ enrolment: NccClassEnrolmentDto }>(
    `/api/ncc/delivery/classes/${encodeURIComponent(classId)}/enrolments`,
    { method: "POST", body: JSON.stringify(input) }
  );
}

export function withdrawNccClassEnrolmentRequest(
  classId: string,
  studentId: string
) {
  return apiJson<{ enrolment: NccClassEnrolmentDto }>(
    `/api/ncc/delivery/classes/${encodeURIComponent(classId)}/enrolments/${encodeURIComponent(studentId)}/withdraw`,
    { method: "POST" }
  );
}

export function completeNccClassEnrolmentRequest(
  classId: string,
  studentId: string
) {
  return apiJson<{ enrolment: NccClassEnrolmentDto }>(
    `/api/ncc/delivery/classes/${encodeURIComponent(classId)}/enrolments/${encodeURIComponent(studentId)}/complete`,
    { method: "POST" }
  );
}

export function fetchNccClassSessionsRequest(classId: string) {
  return apiJson<{ items: NccSessionDto[] }>(
    `/api/ncc/delivery/classes/${encodeURIComponent(classId)}/sessions`
  );
}

export function proposeNccClassSessionsRequest(
  classId: string,
  input: {
    weekdays: number[];
    hoursPerDay: number;
    fromDate: string;
    toDate: string;
    startHour?: number;
  }
) {
  return apiJson<{ slots: NccSessionSlotDto[] }>(
    `/api/ncc/delivery/classes/${encodeURIComponent(classId)}/sessions/propose`,
    { method: "POST", body: JSON.stringify(input) }
  );
}

export function confirmNccClassSessionsRequest(
  classId: string,
  input: { slots: NccSessionSlotInput[] }
) {
  return apiJson<{ items: NccSessionDto[]; createdCount: number }>(
    `/api/ncc/delivery/classes/${encodeURIComponent(classId)}/sessions/confirm`,
    { method: "POST", body: JSON.stringify(input) }
  );
}

export function batchNccClassSessionsRequest(
  classId: string,
  input: { slots: NccSessionSlotInput[] }
) {
  return apiJson<{ items: NccSessionDto[]; createdCount: number }>(
    `/api/ncc/delivery/classes/${encodeURIComponent(classId)}/sessions/batch`,
    { method: "POST", body: JSON.stringify(input) }
  );
}

export function fetchNccSessionRequest(sessionId: string) {
  return apiJson<{ session: NccSessionDto }>(
    `/api/ncc/delivery/sessions/${encodeURIComponent(sessionId)}`
  );
}

export function patchNccSessionRequest(
  sessionId: string,
  input: {
    startsAt?: string;
    endsAt?: string;
    durationHours?: number;
    teacherId?: string;
    roomId?: string | null;
  }
) {
  return apiJson<{ session: NccSessionDto }>(
    `/api/ncc/delivery/sessions/${encodeURIComponent(sessionId)}`,
    { method: "PATCH", body: JSON.stringify(input) }
  );
}

export function cancelNccSessionRequest(sessionId: string) {
  return apiJson<{ session: NccSessionDto }>(
    `/api/ncc/delivery/sessions/${encodeURIComponent(sessionId)}/cancel`,
    { method: "POST" }
  );
}

export function fetchNccSessionAttendanceRequest(sessionId: string) {
  return apiJson<{ attendance: NccAttendanceDetailDto }>(
    `/api/ncc/delivery/sessions/${encodeURIComponent(sessionId)}/attendance`
  );
}

export function markNccSessionAttendanceRequest(
  sessionId: string,
  input: { marks: Array<{ studentId: string; statusId: number }> }
) {
  return apiJson<{ attendance: NccAttendanceDetailDto }>(
    `/api/ncc/delivery/sessions/${encodeURIComponent(sessionId)}/attendance`,
    { method: "POST", body: JSON.stringify(input) }
  );
}

export function fetchNccClassGradesRequest(classId: string) {
  return apiJson<{ grades: NccClassGradesDto }>(
    `/api/ncc/delivery/classes/${encodeURIComponent(classId)}/grades`
  );
}

export type NccHealthStatusDto =
  | "ok"
  | "warning"
  | "error"
  | "not_configured";

export type NccSystemHealthDto = {
  status: "healthy" | "degraded" | "unhealthy";
  checkedAt: string;
  components: {
    api: { status: NccHealthStatusDto; detail: string | null };
    database: { status: NccHealthStatusDto; detail: string | null };
    schemaCheck: {
      status: NccHealthStatusDto;
      detail: string | null;
      missingTables: string[] | null;
    };
    migration: {
      status: NccHealthStatusDto;
      detail: string | null;
      version: string | null;
    };
    moodle: {
      status: NccHealthStatusDto;
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

export function fetchNccSystemHealthRequest() {
  return apiJson<{ health: NccSystemHealthDto }>("/api/ncc/system/health");
}

export type NccDashboardCardsDto = {
  activeStudents: number;
  openLeads: number;
  activeClasses: number;
  enrolmentFill: number;
  enrolmentCapacity: number;
  scheduledPlacements: number;
  scheduledTrials: number;
  staffCount: number | null;
};

export type NccDashboardBranchDto = NccDashboardCardsDto & {
  branchId: string;
  branchName: string;
};

export type NccDashboardNamedCountDto = {
  key: string;
  label: string;
  count: number;
};

export type NccDashboardClassFillDto = {
  branchId: string;
  branchName: string;
  enrolmentFill: number;
  enrolmentCapacity: number;
  fillPct: number | null;
};

export type NccDashboardSummaryDto = {
  cards: NccDashboardCardsDto;
  byBranch: NccDashboardBranchDto[];
  charts: {
    studentsByBranch: NccDashboardNamedCountDto[];
    leadsByStatus: NccDashboardNamedCountDto[];
    placementTrialByStatus: NccDashboardNamedCountDto[];
    classFillByBranch: NccDashboardClassFillDto[];
  };
};

export function fetchNccDashboardSummaryRequest() {
  return apiJson<{ summary: NccDashboardSummaryDto }>(
    "/api/ncc/dashboard/summary"
  );
}

export type NccAuditStreamDto =
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

export type NccAuditEventDto = {
  id: string;
  stream: NccAuditStreamDto;
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

export function fetchNccAuditEventsRequest(
  query: {
    stream?: NccAuditStreamDto;
    eventType?: string;
    limit?: number;
  } = {}
) {
  const params = new URLSearchParams();
  if (query.stream) params.set("stream", query.stream);
  if (query.eventType) params.set("eventType", query.eventType);
  params.set("limit", String(query.limit ?? 100));
  return apiJson<{ items: NccAuditEventDto[] }>(
    `/api/ncc/audit/events?${params.toString()}`
  );
}

export type NccNotificationDto = {
  id: string;
  category: string;
  kind: string;
  title: string;
  body: string | null;
  createdAt: string;
  readAt: string | null;
};

export function fetchNccNotificationsRequest(
  query: { unread?: boolean; limit?: number } = {}
) {
  const params = new URLSearchParams();
  if (query.unread !== undefined) params.set("unread", String(query.unread));
  params.set("limit", String(query.limit ?? 6));
  return apiJson<{ items: NccNotificationDto[] }>(
    `/api/ncc/notifications?${params.toString()}`
  );
}

export function fetchNccNotificationUnreadCountRequest() {
  return apiJson<{ unreadCount: number }>(
    "/api/ncc/notifications/unread-count"
  );
}

export function markNccNotificationReadRequest(notificationId: string) {
  return apiJson<{ notification: NccNotificationDto }>(
    `/api/ncc/notifications/${encodeURIComponent(notificationId)}/read`,
    { method: "POST" }
  );
}

export function markAllNccNotificationsReadRequest() {
  return apiJson<{ markedRead: number }>("/api/ncc/notifications/read-all", {
    method: "POST",
  });
}

export type NccLeadWriteInput = {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string | null;
  source?: string | null;
  notes?: string | null;
  preferredCourseIds?: string[];
  wantsOnline?: boolean;
  wantsOnsite?: boolean;
  entryPath?: NccLeadDto["entryPath"];
  branchId?: string;
  status?: "new" | "placement_test" | "trial_lesson" | "pending" | "cancelled";
};

export type NccStudentWriteInput = {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string | null;
  dateOfBirth?: string | null;
  nationality?: string | null;
  address?: string | null;
  gender?: "male" | "female" | null;
  passportNumber?: string | null;
  nationalId?: string | null;
  guardians?: NccStudentGuardianDto[];
  branchId?: string;
};

export function createNccLeadRequest(
  input: Required<Pick<NccLeadWriteInput, "firstName" | "lastName" | "email">> &
    NccLeadWriteInput
) {
  return apiJson<{ lead: NccLeadDto }>("/api/ncc/admissions/leads", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function patchNccLeadRequest(leadId: string, input: NccLeadWriteInput) {
  return apiJson<{ lead: NccLeadDto }>(
    `/api/ncc/admissions/leads/${encodeURIComponent(leadId)}`,
    { method: "PATCH", body: JSON.stringify(input) }
  );
}

export function convertNccLeadRequest(
  leadId: string,
  input: NccStudentIdentityInput
) {
  return apiJson<{ lead: NccLeadDto; student: NccStudentDto }>(
    `/api/ncc/admissions/leads/${encodeURIComponent(leadId)}/convert`,
    { method: "POST", body: JSON.stringify(input) }
  );
}

export function markNccLeadReadyRequest(leadId: string) {
  return apiJson<{ lead: NccLeadDto }>(
    `/api/ncc/admissions/leads/${encodeURIComponent(leadId)}/ready`,
    { method: "POST" }
  );
}

export function createNccStudentRequest(
  input: NccStudentIdentityInput & {
    firstName: string;
    lastName: string;
    email: string;
    branchId?: string;
  }
) {
  return apiJson<{ student: NccStudentDto }>("/api/ncc/admissions/students", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function patchNccStudentRequest(
  studentId: string,
  input: NccStudentWriteInput
) {
  return apiJson<{ student: NccStudentDto }>(
    `/api/ncc/admissions/students/${encodeURIComponent(studentId)}`,
    { method: "PATCH", body: JSON.stringify(input) }
  );
}

export function disableNccStudentRequest(studentId: string) {
  return apiJson<{ student: NccStudentDto }>(
    `/api/ncc/admissions/students/${encodeURIComponent(studentId)}/disable`,
    { method: "POST" }
  );
}

export function enableNccStudentRequest(studentId: string) {
  return apiJson<{ student: NccStudentDto }>(
    `/api/ncc/admissions/students/${encodeURIComponent(studentId)}/enable`,
    { method: "POST" }
  );
}

export function createNccPlacementTestRequest(input: {
  subject: { type: "lead" | "student"; id: string };
  scheduledAt: string;
  roomId?: string | null;
  branchId?: string;
}) {
  return apiJson<{ placementTest: NccPlacementTestDto }>(
    "/api/ncc/admissions/placement-tests",
    { method: "POST", body: JSON.stringify(input) }
  );
}

export function patchNccPlacementTestRequest(
  placementTestId: string,
  input: { scheduledAt?: string; roomId?: string | null; status?: "no_show" }
) {
  return apiJson<{ placementTest: NccPlacementTestDto }>(
    `/api/ncc/admissions/placement-tests/${encodeURIComponent(placementTestId)}`,
    { method: "PATCH", body: JSON.stringify(input) }
  );
}

export function cancelNccPlacementTestRequest(placementTestId: string) {
  return apiJson<{ placementTest: NccPlacementTestDto }>(
    `/api/ncc/admissions/placement-tests/${encodeURIComponent(placementTestId)}/cancel`,
    { method: "POST" }
  );
}

export function recordNccPlacementResultRequest(
  placementTestId: string,
  input: {
    recommendedCourseId: string;
    resultScore?: string | null;
    resultNotes?: string | null;
  }
) {
  return apiJson<{ placementTest: NccPlacementTestDto }>(
    `/api/ncc/admissions/placement-tests/${encodeURIComponent(placementTestId)}/record-result`,
    { method: "POST", body: JSON.stringify(input) }
  );
}

export function fetchNccCoursesRequest() {
  return apiJson<{ items: NccCourseDto[] }>("/api/ncc/delivery/courses");
}

export type MoodleCommandCapabilitiesDto = {
  state: "available" | "disabled" | "normalized_session_required";
  operations: string[];
  nativeLaunchKinds: string[];
  scopeValidatedOnCommand: true;
};

export function fetchMoodleCommandCapabilitiesRequest() {
  return apiJson<MoodleCommandCapabilitiesDto>(
    "/api/integrations/moodle/capabilities"
  );
}

export type MoodleAdminCommandDto = {
  commandId: string;
  operation: string;
  status:
    | "queued"
    | "processing"
    | "applied"
    | "failed"
    | "reconciliation_required"
    | "cancelled";
  attemptCount: number;
  errorCode?: string;
  reconciliationCaseId?: string;
  providerVersion?: string;
  createdAt: string;
  updatedAt: string;
};

export function fetchMoodleAdminCommandsRequest() {
  return apiJson<{
    commands: MoodleAdminCommandDto[];
    runtimeState: "available" | "disabled" | "normalized_session_required";
  }>("/api/integrations/moodle/commands");
}

export function reconcileMoodleAdminCommandRequest(
  commandId: string,
  resolution: "confirmed_not_applied" | "cancelled"
) {
  return apiJson<{
    reconciliation: { status: string; audit_id?: number; auditId?: number };
  }>(
    `/api/integrations/moodle/commands/${encodeURIComponent(commandId)}/reconcile`,
    {
      method: "POST",
      body: JSON.stringify({ resolution }),
    }
  );
}

export type IntegrationHealthDto = {
  checkedAt: string;
  authority: "server";
  providers: Array<{
    id: string;
    label: string;
    state:
      | "verified"
      | "configured"
      | "unavailable"
      | "disabled"
      | "incomplete"
      | "deferred";
    summary: string;
    checks: Array<{
      label: string;
      status: "passed" | "failed" | "not_run" | "not_applicable";
    }>;
    verification: {
      status: "verified" | "failed" | "not_run" | "not_applicable";
      checkedAt?: string;
    };
  }>;
};

export function fetchIntegrationHealthRequest() {
  return apiJson<IntegrationHealthDto>("/api/integrations/health");
}

export function logoutRequest() {
  return apiJson<{ ok: true }>("/api/auth/logout", { method: "POST" });
}

export type UserInvitationRole = Role;

export function createUserInvitationRequest(input: {
  fullName: string;
  email: string;
  phone?: string;
  role: UserInvitationRole;
  branchRef?: string;
  departmentRef?: string;
  title?: string;
  availabilityStatus?: string;
  subjects: string[];
  teachingLevels: string[];
  locale: string;
  idempotencyKey: string;
}) {
  return apiJson<{
    ok: true;
    delivery: "queued" | "dispatched";
    invitation: {
      invitationId: string;
      userId: string;
      roleGrantId: string;
      outboxEventId: string;
      replayed: boolean;
    };
  }>("/api/admin/user-invitations", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function createStudentEnrollmentInvitationRequest(input: {
  fullName: string;
  email: string;
  phone: string;
  branchRef: string;
  preferredLanguage: string;
  courseInterest: string;
  ageGroup: string;
  guardianName?: string;
  guardianPhone?: string;
  currentLevel: string;
  notes?: string;
  courseRunId: string;
  classGroupId: string;
  source: "direct" | "lead" | "application" | "placement";
  leadId?: string;
  applicationId?: string;
  placementBookingId?: string;
  locale: string;
  idempotencyKey: string;
}) {
  return apiJson<{
    ok: true;
    delivery: "queued" | "dispatched";
    invitation: {
      invitationId: string;
      userId: string;
      roleGrantId: string;
      studentProfileId: string;
      enrollmentId: string;
      classGroupId: string;
      outboxEventId: string;
      replayed: boolean;
    };
  }>("/api/registrar/student-invitations", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function acceptUserInvitationRequest(input: {
  invitationId: string;
  email?: string;
  otp?: string;
  accessToken?: string;
  password: string;
}) {
  return apiJson<{
    ok: true;
    account: {
      userId: string;
      role: Role;
      email: string;
      acceptedAt: string;
    };
  }>("/api/auth/invitations/accept", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function saveBackendRecord(
  type: "lead" | "placement" | "operational",
  payload: Record<string, unknown>,
  actorId?: string
) {
  return apiJson<{ id: string; type: string; createdAt: string }>(
    "/api/platform/records",
    {
      method: "POST",
      body: JSON.stringify({ type, payload, actorId }),
    }
  );
}

export type PlatformStateDto = {
  state: PlatformState;
  persistence: "supabase" | "local";
  syncedAt: string;
};

export type PlatformActionDto = PlatformStateDto & {
  result: PlatformLearningActionResult;
};

export type PlatformWorkflowActionDto = PlatformStateDto & {
  result: PlatformWorkflowActionResult;
};

export type PublicCertificateVerificationDto =
  | {
      valid: true;
      certificate: CertificateVerificationResult;
    }
  | {
      valid: false;
      error?: string;
    };

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

export type MoodleCourseProjectionDto = {
  internalCourseId?: string;
  mappingState:
    | "discovered"
    | "matched"
    | "synced"
    | "stale"
    | "error"
    | "unmatched"
    | "missing";
  reconciliationReason?:
    | "missing_mapping"
    | "missing_provider_record"
    | "ambiguous_mapping";
  course?: {
    sourceId: string;
    categorySourceId?: string;
    title: string;
    shortTitle: string;
    visible?: boolean;
    startsAt?: string;
    endsAt?: string;
    completionTrackingEnabled?: boolean;
  };
};

export type MoodleCourseCatalogProjectionDto = {
  mode: "read_only";
  authority: "server_course_relationships";
  authorityObservedAt: string;
  availability: MoodleProjectionAvailability;
  freshness: MoodleProjectionFreshness;
  observations: Array<{
    internalCourseId: string;
    availability: MoodleProjectionAvailability;
    freshness: MoodleProjectionFreshness;
    latestOutcome: string;
    lastAttemptedAt?: string;
    reconciliationReason?: string;
    observation?: {
      observedAt: string;
      freshUntil: string;
      retainUntil: string;
    };
  }>;
  rows: MoodleCourseProjectionDto[];
};

export type MoodleCourseContentProjectionDto = {
  mode: "read_only";
  authority: "server_course_relationships";
  authorityObservedAt: string;
  availability: MoodleProjectionAvailability;
  freshness: MoodleProjectionFreshness;
  latestOutcome: MoodleProjectionOutcome;
  lastAttemptedAt?: string;
  reconciliationReason?: string;
  observation: {
    runId: string;
    observedAt: string;
    freshUntil: string;
    retainUntil: string;
    payloadHash: string;
  };
  projection: {
    internalCourseId: string;
    externalCourseId: string;
    mappingState: MoodleCourseProjectionDto["mappingState"];
    sections: Array<{
      sourceId: string;
      position: number;
      title?: string;
      visible?: boolean;
      activities: Array<{
        sourceId: string;
        instanceSourceId: string;
        type: string;
        title: string;
        visible?: boolean;
        completionTracking?: "none" | "manual" | "automatic";
        launchAvailable?: boolean;
        dates?: Array<{
          label: string;
          at: string;
        }>;
        resources?: Array<{
          resourceId: string;
          name: string;
          mimeType?: string;
          sizeBytes?: number;
          kind:
            | "pdf"
            | "audio"
            | "video"
            | "image"
            | "document"
            | "archive"
            | "other";
          modifiedAt?: string;
          external?: boolean;
          downloadPath?: string;
        }>;
      }>;
    }>;
  };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isIsoTimestamp(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function isOptionalString(value: unknown) {
  return value === undefined || typeof value === "string";
}

const moodleAvailability = new Set<MoodleProjectionAvailability>([
  "available",
  "empty",
  "unavailable",
]);
const moodleFreshness = new Set<MoodleProjectionFreshness>([
  "fresh",
  "stale",
  "unavailable",
]);
const moodleMappingStates = new Set<MoodleCourseProjectionDto["mappingState"]>([
  "discovered",
  "matched",
  "synced",
  "stale",
  "error",
  "unmatched",
  "missing",
]);
const moodleReconciliationReasons = new Set<
  NonNullable<MoodleCourseProjectionDto["reconciliationReason"]>
>(["missing_mapping", "missing_provider_record", "ambiguous_mapping"]);
const moodleProjectionOutcomes = new Set<MoodleProjectionOutcome>([
  "available",
  "empty",
  "missing_mapping",
  "missing_provider_record",
  "ambiguous_mapping",
  "reconciliation",
  "unavailable",
  "invalid_payload",
]);
const moodleCompletionTracking = new Set(["none", "manual", "automatic"]);
const moodleResourceKinds = new Set([
  "pdf",
  "audio",
  "video",
  "image",
  "document",
  "archive",
  "other",
]);
const safeMimeTypePattern =
  /^[a-z0-9][a-z0-9!#$&^_.+-]{0,126}\/[a-z0-9][a-z0-9!#$&^_.+-]{0,126}$/i;
const moodleContentCollectionLimit = 2_000;
const moodleActivityMetadataLimit = 100;

function hasExactKeys(
  value: Record<string, unknown>,
  required: readonly string[],
  optional: readonly string[] = []
) {
  const keys = Object.keys(value);
  const allowed = new Set([...required, ...optional]);
  return (
    required.every(key => Object.hasOwn(value, key)) &&
    keys.every(key => allowed.has(key))
  );
}

function isProjectionText(value: unknown, maximum = 300) {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    value.length <= maximum &&
    !/[<>\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value) &&
    !/\b(?:(?:https?|ftp):\/\/|www\.|mailto:)/i.test(value)
  );
}

function isMoodleSourceId(value: unknown) {
  return (
    typeof value === "string" &&
    /^[1-9]\d*$/.test(value) &&
    Number.isSafeInteger(Number(value))
  );
}

function isMoodleContentActivity(value: unknown) {
  if (!isRecord(value)) return false;
  if (
    !hasExactKeys(
      value,
      ["sourceId", "instanceSourceId", "type", "title"],
      ["visible", "completionTracking", "launchAvailable", "dates", "resources"]
    )
  ) {
    return false;
  }
  return (
    isMoodleSourceId(value.sourceId) &&
    isMoodleSourceId(value.instanceSourceId) &&
    isProjectionText(value.type, 64) &&
    isProjectionText(value.title) &&
    (value.visible === undefined || typeof value.visible === "boolean") &&
    (value.launchAvailable === undefined ||
      typeof value.launchAvailable === "boolean") &&
    (value.completionTracking === undefined ||
      (typeof value.completionTracking === "string" &&
        moodleCompletionTracking.has(value.completionTracking))) &&
    (value.dates === undefined ||
      (Array.isArray(value.dates) &&
        value.dates.length <= moodleActivityMetadataLimit &&
        value.dates.every(isMoodleActivityDate))) &&
    (value.resources === undefined ||
      (Array.isArray(value.resources) &&
        value.resources.length <= moodleActivityMetadataLimit &&
        value.resources.every(isMoodleActivityResource)))
  );
}

function isMoodleActivityDate(value: unknown) {
  return (
    isRecord(value) &&
    hasExactKeys(value, ["label", "at"]) &&
    isProjectionText(value.label, 100) &&
    isIsoTimestamp(value.at)
  );
}

function isMoodleActivityResource(value: unknown) {
  if (!isRecord(value)) return false;
  if (
    !hasExactKeys(
      value,
      ["resourceId", "name", "kind"],
      ["mimeType", "sizeBytes", "modifiedAt", "external", "downloadPath"]
    )
  ) {
    return false;
  }
  return (
    typeof value.resourceId === "string" &&
    /^[1-9]\d*:[1-9]\d*$/.test(value.resourceId) &&
    isProjectionText(value.name) &&
    typeof value.kind === "string" &&
    moodleResourceKinds.has(value.kind) &&
    (value.mimeType === undefined ||
      (typeof value.mimeType === "string" &&
        safeMimeTypePattern.test(value.mimeType))) &&
    (value.sizeBytes === undefined ||
      (Number.isSafeInteger(value.sizeBytes) &&
        (value.sizeBytes as number) >= 0)) &&
    (value.modifiedAt === undefined || isIsoTimestamp(value.modifiedAt)) &&
    (value.external === undefined || typeof value.external === "boolean") &&
    (value.downloadPath === undefined ||
      (typeof value.downloadPath === "string" &&
        /^\/api\/integrations\/moodle\/files\/[A-Za-z0-9_-]{40,1200}$/.test(
          value.downloadPath
        )))
  );
}

function isMoodleContentSection(value: unknown) {
  if (!isRecord(value)) return false;
  if (
    !hasExactKeys(
      value,
      ["sourceId", "position", "activities"],
      ["title", "visible"]
    )
  ) {
    return false;
  }
  return (
    isMoodleSourceId(value.sourceId) &&
    Number.isSafeInteger(value.position) &&
    (value.position as number) >= 0 &&
    (value.title === undefined || isProjectionText(value.title)) &&
    (value.visible === undefined || typeof value.visible === "boolean") &&
    Array.isArray(value.activities) &&
    value.activities.length <= moodleContentCollectionLimit &&
    value.activities.every(isMoodleContentActivity)
  );
}

function isMoodleContentObservation(value: unknown) {
  if (!isRecord(value)) return false;
  if (
    !hasExactKeys(value, [
      "runId",
      "observedAt",
      "freshUntil",
      "retainUntil",
      "payloadHash",
    ])
  ) {
    return false;
  }
  return (
    isProjectionText(value.runId, 128) &&
    isIsoTimestamp(value.observedAt) &&
    isIsoTimestamp(value.freshUntil) &&
    isIsoTimestamp(value.retainUntil) &&
    Date.parse(value.observedAt as string) <=
      Date.parse(value.freshUntil as string) &&
    Date.parse(value.freshUntil as string) <=
      Date.parse(value.retainUntil as string) &&
    typeof value.payloadHash === "string" &&
    /^[0-9a-f]{64}$/i.test(value.payloadHash)
  );
}

function isMoodleCourse(value: unknown) {
  if (!isRecord(value)) return false;
  return (
    typeof value.sourceId === "string" &&
    typeof value.title === "string" &&
    typeof value.shortTitle === "string" &&
    isOptionalString(value.categorySourceId) &&
    (value.visible === undefined || typeof value.visible === "boolean") &&
    (value.startsAt === undefined || isIsoTimestamp(value.startsAt)) &&
    (value.endsAt === undefined || isIsoTimestamp(value.endsAt)) &&
    (value.completionTrackingEnabled === undefined ||
      typeof value.completionTrackingEnabled === "boolean")
  );
}

function isMoodleCourseProjection(value: unknown) {
  if (!isRecord(value)) return false;
  const mappingState = value.mappingState;
  const reconciliationReason = value.reconciliationReason;
  return (
    typeof mappingState === "string" &&
    moodleMappingStates.has(
      mappingState as MoodleCourseProjectionDto["mappingState"]
    ) &&
    isOptionalString(value.internalCourseId) &&
    (reconciliationReason === undefined ||
      (typeof reconciliationReason === "string" &&
        moodleReconciliationReasons.has(
          reconciliationReason as NonNullable<
            MoodleCourseProjectionDto["reconciliationReason"]
          >
        ))) &&
    (value.course === undefined || isMoodleCourse(value.course))
  );
}

function isMoodleObservation(value: unknown) {
  if (!isRecord(value)) return false;
  const observation = value.observation;
  return (
    typeof value.internalCourseId === "string" &&
    typeof value.availability === "string" &&
    moodleAvailability.has(
      value.availability as MoodleProjectionAvailability
    ) &&
    typeof value.freshness === "string" &&
    moodleFreshness.has(value.freshness as MoodleProjectionFreshness) &&
    typeof value.latestOutcome === "string" &&
    isOptionalString(value.lastAttemptedAt) &&
    isOptionalString(value.reconciliationReason) &&
    (observation === undefined ||
      (isRecord(observation) &&
        isIsoTimestamp(observation.observedAt) &&
        isIsoTimestamp(observation.freshUntil) &&
        isIsoTimestamp(observation.retainUntil)))
  );
}

export function parseMoodleCourseCatalogProjectionDto(
  value: unknown
): MoodleCourseCatalogProjectionDto | null {
  if (!isRecord(value)) return null;
  const rows = value.rows;
  const observations = value.observations;
  if (
    value.mode !== "read_only" ||
    value.authority !== "server_course_relationships" ||
    !isIsoTimestamp(value.authorityObservedAt) ||
    typeof value.availability !== "string" ||
    !moodleAvailability.has(
      value.availability as MoodleProjectionAvailability
    ) ||
    typeof value.freshness !== "string" ||
    !moodleFreshness.has(value.freshness as MoodleProjectionFreshness) ||
    !Array.isArray(rows) ||
    rows.length > 2_000 ||
    !rows.every(isMoodleCourseProjection) ||
    !Array.isArray(observations) ||
    observations.length > 2_000 ||
    !observations.every(isMoodleObservation)
  ) {
    return null;
  }
  if (
    (value.availability === "empty" && rows.length !== 0) ||
    (value.availability === "available" && rows.length === 0) ||
    (value.freshness === "stale" && rows.length === 0)
  ) {
    return null;
  }
  return value as MoodleCourseCatalogProjectionDto;
}

export function parseMoodleCourseContentProjectionDto(
  value: unknown,
  requestedCourseId: string
): MoodleCourseContentProjectionDto | null {
  if (!isRecord(value) || !requestedCourseId) return null;
  if (
    !hasExactKeys(
      value,
      [
        "mode",
        "authority",
        "authorityObservedAt",
        "availability",
        "freshness",
        "latestOutcome",
        "observation",
        "projection",
      ],
      ["lastAttemptedAt", "reconciliationReason"]
    ) ||
    value.mode !== "read_only" ||
    value.authority !== "server_course_relationships" ||
    !isIsoTimestamp(value.authorityObservedAt) ||
    typeof value.availability !== "string" ||
    !moodleAvailability.has(
      value.availability as MoodleProjectionAvailability
    ) ||
    typeof value.freshness !== "string" ||
    !moodleFreshness.has(value.freshness as MoodleProjectionFreshness) ||
    typeof value.latestOutcome !== "string" ||
    !moodleProjectionOutcomes.has(
      value.latestOutcome as MoodleProjectionOutcome
    ) ||
    (value.lastAttemptedAt !== undefined &&
      !isIsoTimestamp(value.lastAttemptedAt)) ||
    (value.reconciliationReason !== undefined &&
      (typeof value.reconciliationReason !== "string" ||
        !moodleReconciliationReasons.has(
          value.reconciliationReason as NonNullable<
            MoodleCourseProjectionDto["reconciliationReason"]
          >
        ))) ||
    !isMoodleContentObservation(value.observation) ||
    !isRecord(value.projection)
  ) {
    return null;
  }

  const projection = value.projection;
  if (
    !hasExactKeys(projection, [
      "internalCourseId",
      "externalCourseId",
      "mappingState",
      "sections",
    ]) ||
    projection.internalCourseId !== requestedCourseId ||
    !isMoodleSourceId(projection.externalCourseId) ||
    typeof projection.mappingState !== "string" ||
    !moodleMappingStates.has(
      projection.mappingState as MoodleCourseProjectionDto["mappingState"]
    ) ||
    !Array.isArray(projection.sections) ||
    projection.sections.length > moodleContentCollectionLimit ||
    !projection.sections.every(isMoodleContentSection)
  ) {
    return null;
  }

  const sectionCount = projection.sections.length;
  const latestSucceeded = ["available", "empty"].includes(value.latestOutcome);
  if (
    value.freshness === "unavailable" ||
    (value.latestOutcome === "available" &&
      (value.availability !== "available" || sectionCount === 0)) ||
    (value.latestOutcome === "empty" &&
      (value.availability !== "empty" || sectionCount !== 0)) ||
    (!latestSucceeded &&
      (value.availability !== "unavailable" || value.freshness !== "stale"))
  ) {
    return null;
  }

  return value as MoodleCourseContentProjectionDto;
}

export function fetchPlatformStateRequest() {
  return apiJson<PlatformStateDto>("/api/platform/state");
}

export async function fetchMoodleCourseCatalogProjectionRequest() {
  const result = await apiJson<unknown>(
    "/api/integrations/moodle/projections/courses"
  );
  if (!result.ok) return result as ApiResult<MoodleCourseCatalogProjectionDto>;
  const data = parseMoodleCourseCatalogProjectionDto(result.data);
  return data
    ? { ok: true, data }
    : { ok: false, error: "Moodle projection response was invalid." };
}

export async function fetchMoodleCourseContentProjectionRequest(
  courseId: string
) {
  const requestedCourseId = courseId.trim();
  if (!requestedCourseId) {
    return { ok: false, error: "Course ID is required." };
  }
  const result = await apiJson<unknown>(
    `/api/integrations/moodle/projections/courses/${encodeURIComponent(requestedCourseId)}/content`,
    { method: "GET" }
  );
  if (!result.ok) return result as ApiResult<MoodleCourseContentProjectionDto>;
  const data = parseMoodleCourseContentProjectionDto(
    result.data,
    requestedCourseId
  );
  return data
    ? { ok: true, data }
    : { ok: false, error: "Moodle projection response was invalid." };
}

export function runPlatformLearningActionRequest(
  action: PlatformLearningAction
) {
  return apiJson<PlatformActionDto>("/api/platform/state/actions", {
    method: "POST",
    body: JSON.stringify(action),
  });
}

export function runPlatformWorkflowActionRequest(
  action: PlatformWorkflowAction
) {
  return apiJson<PlatformWorkflowActionDto>("/api/platform/state/actions", {
    method: "POST",
    body: JSON.stringify(action),
  });
}

export function verifyPublicCertificateRequest(code: string) {
  return apiJson<PublicCertificateVerificationDto>(
    `/api/certificates/verify?code=${encodeURIComponent(code)}`
  );
}
