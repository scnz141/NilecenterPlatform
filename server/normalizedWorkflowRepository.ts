import crypto from "node:crypto";

import type { ServerSession } from "./auth.js";
import { supabaseAdminRestFetch } from "./supabase.js";
import type {
  PlatformWorkflowAction,
  PlatformWorkflowActionResult,
} from "../client/src/lib/domain/actions.js";
import type {
  PlatformState,
  StaffAvailabilityStatus,
  StaffPermissionScope,
  StudentStatus,
  UserNotificationPreferences,
} from "../client/src/lib/domain/types.js";
import {
  roleOrder,
  rolePermissions,
  type Role,
} from "../client/src/lib/platformData.js";
import { isMoodleOwnedLearningAction } from "./moodleLearningAuthority.js";

type AdminFetch = typeof supabaseAdminRestFetch;

export class NormalizedWorkflowUnavailableError extends Error {
  constructor(message = "Normalized workflow persistence is unavailable.") {
    super(message);
    this.name = "NormalizedWorkflowUnavailableError";
  }
}

export class NormalizedWorkflowDeniedError extends Error {
  constructor(message = "This workflow is outside the current account scope.") {
    super(message);
    this.name = "NormalizedWorkflowDeniedError";
  }
}

export class NormalizedWorkflowConflictError extends Error {
  constructor(message = "This record changed before the command completed.") {
    super(message);
    this.name = "NormalizedWorkflowConflictError";
  }
}

export class NormalizedWorkflowValidationError extends Error {
  constructor(message = "The workflow request is invalid.") {
    super(message);
    this.name = "NormalizedWorkflowValidationError";
  }
}

type NormalizedWorkspacePayload = {
  user: {
    id: string;
    fullName: string;
    email: string;
    phone?: string;
    status: string;
    profileVersion: number;
    preferredLanguage: string;
    timezone: string;
    notificationPreferences: UserNotificationPreferences;
  };
  branches: Array<{
    id: string;
    name: string;
    code: string;
    timezone: string;
    address?: string;
    status: string;
  }>;
  departments: Array<{
    id: string;
    name: string;
    status: string;
  }>;
  student?: {
    id: string;
    status: string;
    country: string;
    ageGroup?: string;
    guardianName?: string;
    guardianPhone?: string;
  };
  staff?: {
    id: string;
    title?: string;
    availabilityStatus: StaffAvailabilityStatus;
    status: string;
    subjects: string[];
    teachingLevels: string[];
  };
  supportTickets: Array<{
    id: string;
    subject: string;
    details?: string;
    category?: string;
    priority: "low" | "normal" | "high" | "urgent";
    status: string;
    sourceKey?: string;
    version: number;
    updatedAt: string;
  }>;
  auditLogs: Array<{
    id: string;
    action: string;
    entityType: string;
    entityId: string;
    summary?: string;
    occurredAt: string;
  }>;
};

type NormalizedAdmissionsPayload = {
  studentUsers: Array<{
    id: string;
    fullName: string;
    email: string;
    phone?: string;
    branchId: string;
    preferredLanguage?: string;
    timezone?: string;
    status: string;
    version: number;
  }>;
  teacherUsers: Array<{
    id: string;
    fullName: string;
    email: string;
    phone?: string;
    branchId: string;
    departmentId?: string;
    status: string;
    version: number;
  }>;
  students: Array<{
    id: string;
    userId: string;
    status: string;
    source?: "direct" | "lead" | "application" | "placement";
    guardianName?: string;
    guardianPhone?: string;
    currentLevel?: string;
    ageGroup?: string;
    courseInterest?: string;
    notes?: string;
    country?: string;
    branchId: string;
    preferredLanguage?: string;
    timezone?: string;
  }>;
  enrollments: Array<{
    id: string;
    studentId: string;
    courseRunId: string;
    levelId?: string;
    classGroupId?: string;
    teacherId?: string;
    source?: "direct" | "lead" | "application" | "placement";
    status: string;
    createdAt?: string;
  }>;
  leads: Array<{
    id: string;
    branchId: string;
    fullName: string;
    email: string;
    phone: string;
    country?: string;
    subject: string;
    source: "website" | "trial_form" | "placement_form" | "whatsapp" | "manual";
    status: string;
    notes?: string;
    sourceKey?: string;
    version: number;
    createdAt: string;
  }>;
  applications: Array<{
    id: string;
    leadId: string;
    branchId: string;
    courseInterest: string;
    schedulePreference: string;
    sourceKey?: string;
    status: string;
    version: number;
  }>;
  placementTests: Array<{
    id: string;
    leadId: string;
    fullName: string;
    email: string;
    phone: string;
    branchId: string;
    subject: string;
    preferredDate: string;
    currentLevel: string;
    sourceKey?: string;
    status: string;
    recommendedLevel?: string;
    version: number;
  }>;
  placementResults: Array<{
    id: string;
    bookingId: string;
    examinerId: string;
    score: number;
    recommendedLevel: string;
    notes: string;
    createdAt: string;
    version: number;
  }>;
  programs: Array<{
    id: string;
    title: string;
    category: string;
    departmentId: string;
    language: string;
    status: string;
  }>;
  levels: Array<{
    id: string;
    programId: string;
    title: string;
    order: number;
  }>;
  courses: Array<{
    id: string;
    programId: string;
    levelId: string;
    slug: string;
    title: string;
    description?: string;
    status: string;
  }>;
  courseRuns: Array<{
    id: string;
    courseId: string;
    branchId: string;
    teacherId?: string;
    term: string;
    startsOn: string;
    endsOn: string;
    status: string;
  }>;
  classGroups: Array<{
    id: string;
    courseRunId: string;
    name: string;
    capacity: number;
    schedule?: string;
    studentIds: string[];
    status: string;
  }>;
};

type NormalizedStudentLearningPayload = {
  student: {
    id: string;
    userId: string;
    status: string;
    source?: "direct" | "lead" | "application" | "placement";
    guardianName?: string;
    guardianPhone?: string;
    currentLevel?: string;
    ageGroup?: string;
    courseInterest?: string;
    notes?: string;
    country?: string;
  };
  teachers: Array<{
    id: string;
    fullName: string;
    email: string;
  }>;
  programs: NormalizedAdmissionsPayload["programs"];
  levels: NormalizedAdmissionsPayload["levels"];
  courses: NormalizedAdmissionsPayload["courses"];
  courseRuns: NormalizedAdmissionsPayload["courseRuns"];
  classGroups: NormalizedAdmissionsPayload["classGroups"];
  enrollments: NormalizedAdmissionsPayload["enrollments"];
};

type NormalizedTeacherClassPayload = Pick<
  NormalizedAdmissionsPayload,
  | "studentUsers"
  | "students"
  | "programs"
  | "levels"
  | "courses"
  | "courseRuns"
  | "classGroups"
  | "enrollments"
>;

type NormalizedAttendancePayload = {
  sessions: Array<{
    id: string;
    classGroupId: string;
    eventType: "class_session" | "live_session";
    title: string;
    startsAt: string;
    endsAt: string;
    status: string;
    attendanceSaved: boolean;
    attendanceVersion: number;
    attendanceSavedAt?: string;
    createdBy: string;
    branchId: string;
  }>;
  attendance: Array<{
    id: string;
    classGroupId: string;
    studentId: string;
    sessionId: string;
    status: "present" | "late" | "absent" | "excused";
    notes?: string;
    version: number;
    markedBy: string;
    markedAt: string;
  }>;
};

type NormalizedAssignmentPayload = {
  assignments: Array<{
    id: string;
    courseRunId: string;
    classGroupId: string;
    title: string;
    dueAt: string;
    submissionType: "text" | "file" | "audio" | "video";
    rubric: string[];
    status: string;
    version: number;
    publishedAt?: string;
  }>;
  submissions: Array<{
    id: string;
    assignmentId: string;
    studentId: string;
    submittedAt: string;
    status: string;
    response: string;
    pendingMedia?: PlatformState["assignmentSubmissions"][number]["pendingMedia"];
    version: number;
    gradedAt?: string;
    gradedBy?: string;
  }>;
  grades: Array<{
    id: string;
    studentId: string;
    courseRunId: string;
    itemId: string;
    itemTitle: string;
    score: number;
    maxScore: number;
    feedback: string;
    version: number;
    releaseStatus: "withheld" | "released";
    releasedAt?: string;
    releasedBy?: string;
  }>;
};

type ProfileMutationRow = {
  command_id: string;
  user_id: string;
  profile_version: number;
  changed_fields: unknown;
  replayed: boolean;
};

type SupportMutationRow = {
  command_id: string;
  ticket_id: string;
  ticket_version: number;
  replayed: boolean;
};

type LeadMutationRow = {
  command_id: string;
  lead_id: string;
  branch_id: string;
  lead_version: number;
  replayed: boolean;
};

type ApplicationMutationRow = {
  command_id: string;
  application_id: string;
  lead_id: string;
  branch_id: string;
  application_version: number;
  lead_version: number;
  replayed: boolean;
};

type PlacementMutationRow = {
  command_id: string;
  booking_id: string;
  lead_id: string;
  branch_id: string;
  booking_version: number;
  lead_version: number;
  result_id: string | null;
  result_version: number | null;
  replayed: boolean;
};

type ClassSessionMutationRow = {
  command_id: string;
  class_session_id: string;
  session_version: number;
  outbox_event_id: string;
  replayed: boolean;
};

type AttendanceMutationRow = ClassSessionMutationRow & {
  attendance_count: number;
};

type AssignmentMutationRow = {
  command_id: string;
  assignment_id: string;
  assignment_version: number;
  outbox_event_id: string;
  replayed: boolean;
};

type SubmissionMutationRow = {
  command_id: string;
  submission_id: string;
  submission_version: number;
  outbox_event_id: string;
  replayed: boolean;
};

type GradeMutationRow = SubmissionMutationRow & {
  grade_id: string;
  grade_version: number;
  revision_number: number;
};

export type NormalizedWorkflowResponse = {
  state: PlatformState;
  persistence: "supabase";
  syncedAt: string;
  result: PlatformWorkflowActionResult;
};

export type NormalizedWorkflowRepository = {
  readWorkspace(session: ServerSession): Promise<PlatformState>;
  apply(
    action: PlatformWorkflowAction,
    session: ServerSession
  ): Promise<NormalizedWorkflowResponse>;
};

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function sha256(value: string) {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, stable(item)])
    );
  }
  return value;
}

function requestHash(value: unknown) {
  return sha256(JSON.stringify(stable(value)));
}

function permissionScope(role: Role): StaffPermissionScope {
  if (role === "superadmin") return "global";
  if (role === "branchadmin") return "operations";
  if (role === "registrar") return "admissions";
  return "department";
}

function normalizedStudentStatus(status: string): StudentStatus {
  if (status === "paused") return "paused";
  if (status === "archived") return "cancelled";
  return "active";
}

function emptyState(role: Role): PlatformState {
  return {
    settings: {
      organization: "Nile Learn",
      defaultLanguage: "English",
      academicTerm: "",
      retentionDays: 0,
    },
    portalSettings: [],
    users: [],
    branches: [],
    departments: [],
    programs: [],
    levels: [],
    courses: [],
    modules: [],
    lessons: [],
    resources: [],
    courseRuns: [],
    classGroups: [],
    students: [],
    teachers: [],
    staffProfiles: [],
    enrollments: [],
    lessonProgress: [],
    assignments: [],
    assignmentSubmissions: [],
    quizzes: [],
    questionBankItems: [],
    quizQuestionPreviews: [],
    quizAttempts: [],
    grades: [],
    events: [],
    classSessions: [],
    teacherAvailability: [],
    rooms: [],
    meetingLinks: [],
    attendance: [],
    attendanceExceptions: [],
    leads: [],
    applications: [],
    placementTests: [],
    placementResults: [],
    enrollmentWorkflows: [],
    invoices: [],
    payments: [],
    packages: [],
    discounts: [],
    certificates: [],
    quranPlans: [],
    quranProgress: [],
    recitationSubmissions: [],
    messages: [],
    communicationLogs: [],
    messageTemplates: [],
    documents: [],
    notifications: [],
    supportTickets: [],
    reportPresets: [],
    auditLogs: [],
    integrations: [],
    permissions: Object.fromEntries(
      roleOrder.map(item => [item, item === role ? rolePermissions[item] : []])
    ) as PlatformState["permissions"],
  };
}

function requireNormalizedSession(session: ServerSession) {
  if (
    session.authorizationModel !== "normalized" ||
    session.provider !== "supabase" ||
    !session.activeRoleGrantId
  ) {
    throw new NormalizedWorkflowDeniedError(
      "A durable normalized session is required."
    );
  }
}

function parseWorkspace(payload: unknown): NormalizedWorkspacePayload {
  const row = Array.isArray(payload) ? payload[0] : payload;
  const workspace =
    row && typeof row === "object"
      ? (row as Record<string, unknown>).workspace
      : null;
  if (!workspace || typeof workspace !== "object") {
    throw new NormalizedWorkflowUnavailableError(
      "Normalized workspace returned invalid data."
    );
  }
  return workspace as NormalizedWorkspacePayload;
}

function parseRows<T>(payload: unknown): T[] {
  if (!Array.isArray(payload) || payload.length !== 1) {
    throw new NormalizedWorkflowUnavailableError(
      "Normalized workflow returned invalid evidence."
    );
  }
  return payload as T[];
}

function parseAdmissions(payload: unknown): NormalizedAdmissionsPayload {
  const row = Array.isArray(payload) ? payload[0] : payload;
  const workspace =
    row && typeof row === "object"
      ? (row as Record<string, unknown>).workspace
      : null;
  if (!workspace || typeof workspace !== "object") {
    throw new NormalizedWorkflowUnavailableError(
      "Normalized admissions workspace returned invalid data."
    );
  }
  return workspace as NormalizedAdmissionsPayload;
}

function parseStudentLearning(
  payload: unknown
): NormalizedStudentLearningPayload {
  const row = Array.isArray(payload) ? payload[0] : payload;
  const workspace =
    row && typeof row === "object"
      ? (row as Record<string, unknown>).workspace
      : null;
  if (!workspace || typeof workspace !== "object") {
    throw new NormalizedWorkflowUnavailableError(
      "Normalized student learning workspace returned invalid data."
    );
  }
  return workspace as NormalizedStudentLearningPayload;
}

function parseTeacherClasses(payload: unknown): NormalizedTeacherClassPayload {
  const row = Array.isArray(payload) ? payload[0] : payload;
  const workspace =
    row && typeof row === "object"
      ? (row as Record<string, unknown>).workspace
      : null;
  if (!workspace || typeof workspace !== "object") {
    throw new NormalizedWorkflowUnavailableError(
      "Normalized teacher class workspace returned invalid data."
    );
  }
  return workspace as NormalizedTeacherClassPayload;
}

function parseAttendance(payload: unknown): NormalizedAttendancePayload {
  const row = Array.isArray(payload) ? payload[0] : payload;
  const workspace =
    row && typeof row === "object"
      ? (row as Record<string, unknown>).workspace
      : null;
  if (!workspace || typeof workspace !== "object") {
    throw new NormalizedWorkflowUnavailableError(
      "Normalized attendance workspace returned invalid data."
    );
  }
  return workspace as NormalizedAttendancePayload;
}

function parseAssignments(payload: unknown): NormalizedAssignmentPayload {
  const row = Array.isArray(payload) ? payload[0] : payload;
  const workspace =
    row && typeof row === "object"
      ? (row as Record<string, unknown>).workspace
      : null;
  if (!workspace || typeof workspace !== "object") {
    throw new NormalizedWorkflowUnavailableError(
      "Normalized assignment workspace returned invalid data."
    );
  }
  const candidate = workspace as Partial<NormalizedAssignmentPayload>;
  if (
    !Array.isArray(candidate.assignments) ||
    !Array.isArray(candidate.submissions) ||
    !Array.isArray(candidate.grades)
  ) {
    throw new NormalizedWorkflowUnavailableError(
      "Normalized assignment workspace returned incomplete data."
    );
  }
  return candidate as NormalizedAssignmentPayload;
}

async function responsePayload(response: Response) {
  try {
    return (await response.json()) as unknown;
  } catch {
    throw new NormalizedWorkflowUnavailableError();
  }
}

async function assertResponse(response: Response) {
  if (response.ok) return;
  const payload = (await responsePayload(response)) as {
    code?: unknown;
    message?: unknown;
  };
  const code = clean(payload?.code);
  if (response.status === 401 || response.status === 403 || code === "42501") {
    throw new NormalizedWorkflowDeniedError();
  }
  if (response.status === 409 || code === "23505" || code === "40001") {
    throw new NormalizedWorkflowConflictError();
  }
  if (
    response.status === 400 ||
    response.status === 422 ||
    code.startsWith("22") ||
    code === "23503"
  ) {
    throw new NormalizedWorkflowValidationError();
  }
  throw new NormalizedWorkflowUnavailableError();
}

function workspaceState(
  workspace: NormalizedWorkspacePayload,
  session: ServerSession
): PlatformState {
  const state = emptyState(session.activeRole);
  const role = session.activeRole;
  const user = workspace.user;
  const branchId = session.branchIds?.[0];
  const departmentId = session.departmentIds?.[0];
  state.users = [
    {
      id: session.userId,
      name: user.fullName,
      email: user.email,
      phone: user.phone,
      preferredLanguage: user.preferredLanguage,
      timezone: user.timezone,
      notificationPreferences: user.notificationPreferences,
      roles: [role],
      activeRole: role,
      branchId,
      departmentId,
      status: user.status === "active" ? "active" : "paused",
      version: user.profileVersion,
    },
  ];
  state.branches = workspace.branches.map(item => ({
    id: item.id,
    name: item.name,
    code: item.code,
    timezone: item.timezone,
    address: item.address ?? "",
    status: item.status === "active" ? "active" : "paused",
  }));
  state.departments = workspace.departments.map(item => ({
    id: item.id,
    name: item.name,
    ownerUserId: "",
    branchIds: session.branchIds ?? [],
    status: item.status === "active" ? "active" : "paused",
  }));
  if (workspace.student) {
    state.students = [
      {
        id: workspace.student.id,
        userId: session.userId,
        status: normalizedStudentStatus(workspace.student.status),
        country: workspace.student.country,
        preferredLanguage: user.preferredLanguage,
        timezone: user.timezone,
        ageGroup: workspace.student.ageGroup,
        guardianName: workspace.student.guardianName,
        guardianPhone: workspace.student.guardianPhone,
      },
    ];
  }
  if (workspace.staff && role !== "student") {
    const staff = workspace.staff;
    const profile = {
      id: staff.id,
      userId: session.userId,
      role,
      branchIds: session.branchIds ?? [],
      departmentIds: session.departmentIds ?? [],
      permissionScope: permissionScope(role),
      title: staff.title ?? role,
      subjects: staff.subjects,
      teachingLevels: staff.teachingLevels,
      availabilityStatus: staff.availabilityStatus,
      operationalScope: rolePermissions[role],
      status:
        staff.status === "active" ? ("active" as const) : ("paused" as const),
      createdAt: "",
      updatedAt: "",
    };
    state.staffProfiles = [profile];
    if (role === "teacher" && branchId && departmentId) {
      state.teachers = [
        {
          id: staff.id,
          userId: session.userId,
          branchId,
          departmentId,
          subjects: staff.subjects,
          teachingLevels: staff.teachingLevels,
          specialties: staff.subjects,
          availability: [],
          availabilityStatus: staff.availabilityStatus,
          assignedClassIds: [],
          status: profile.status,
        },
      ];
    }
  }
  state.supportTickets = workspace.supportTickets.map(ticket => ({
    id: ticket.id,
    requesterId: session.userId,
    subject: ticket.subject,
    details: ticket.details,
    category: ticket.category,
    priority: ticket.priority,
    status:
      ticket.status === "resolved"
        ? "completed"
        : ticket.status === "closed"
          ? "cancelled"
          : "pending",
    sourceKey: ticket.sourceKey,
    lastUpdatedAt: ticket.updatedAt,
    version: ticket.version,
  }));
  state.auditLogs = workspace.auditLogs.map(item => ({
    id: item.id,
    actorId: session.userId,
    action: item.action,
    entityType: item.entityType,
    entityId: item.entityId,
    summary: item.summary ?? item.action,
    createdAt: item.occurredAt,
  }));
  return state;
}

function applyAttendanceWorkspace(
  state: PlatformState,
  attendance: NormalizedAttendancePayload
) {
  const sessionStatus = (status: string) =>
    status === "planned"
      ? ("pending" as const)
      : status === "completed"
        ? ("completed" as const)
        : status === "cancelled"
          ? ("cancelled" as const)
          : ("active" as const);
  state.classSessions = attendance.sessions.map(item => ({
    id: item.id,
    classGroupId: item.classGroupId,
    eventId: item.id,
    title: item.title,
    startsAt: item.startsAt,
    endsAt: item.endsAt,
    status: sessionStatus(item.status),
    attendanceSaved: item.attendanceSaved,
    attendanceVersion: item.attendanceVersion,
    attendanceSavedAt: item.attendanceSavedAt,
  }));
  state.events = attendance.sessions.map(item => ({
    id: item.id,
    type: item.eventType,
    title: item.title,
    startsAt: item.startsAt,
    endsAt: item.endsAt,
    ownerId: item.createdBy,
    branchId: item.branchId,
    classGroupId: item.classGroupId,
    status: sessionStatus(item.status),
  }));
  state.attendance = attendance.attendance.map(item => ({
    id: item.id,
    classGroupId: item.classGroupId,
    studentId: item.studentId,
    sessionId: item.sessionId,
    status: item.status,
    notes: item.notes,
    version: item.version,
    markedBy: item.markedBy,
    markedAt: item.markedAt,
  }));
}

function applyAssignmentWorkspace(
  state: PlatformState,
  workspace: NormalizedAssignmentPayload
) {
  state.assignments = workspace.assignments.map(item => ({
    ...item,
    rubric: Array.isArray(item.rubric) ? item.rubric : [],
    status:
      item.status === "active" ||
      item.status === "completed" ||
      item.status === "cancelled"
        ? item.status
        : "draft",
  }));
  state.assignmentSubmissions = workspace.submissions.map(item => ({
    ...item,
    status: item.status === "graded" ? "completed" : "pending",
    pendingMedia: Array.isArray(item.pendingMedia) ? item.pendingMedia : [],
  }));
  state.grades = workspace.grades.map(item => ({ ...item }));
}

export function createSupabaseNormalizedWorkflowRepository(
  adminFetch: AdminFetch = supabaseAdminRestFetch
): NormalizedWorkflowRepository {
  async function rpc(path: string, body: Record<string, unknown>) {
    let response: Response;
    try {
      response = await adminFetch(`rpc/${path}`, {
        method: "POST",
        body: JSON.stringify(body),
      });
    } catch {
      throw new NormalizedWorkflowUnavailableError();
    }
    if (!response) throw new NormalizedWorkflowUnavailableError();
    await assertResponse(response);
    return responsePayload(response);
  }

  async function readWorkspace(session: ServerSession) {
    requireNormalizedSession(session);
    const payload = await rpc("nile_read_self_workspace", {
      p_session_token_hash: sha256(session.id),
    });
    const state = workspaceState(parseWorkspace(payload), session);
    if (
      session.activeRole === "registrar" ||
      session.activeRole === "superadmin"
    ) {
      const admissions = parseAdmissions(
        await rpc("nile_read_admissions_student_workspace", {
          p_session_token_hash: sha256(session.id),
        })
      );
      const directoryUsers = [
        ...admissions.studentUsers.map(item => ({
          id: item.id,
          name: item.fullName,
          email: item.email,
          phone: item.phone,
          preferredLanguage: item.preferredLanguage,
          timezone: item.timezone,
          roles: ["student" as const],
          activeRole: "student" as const,
          branchId: item.branchId,
          status:
            item.status === "active"
              ? ("active" as const)
              : item.status === "invited"
                ? ("pending" as const)
                : ("paused" as const),
          version: item.version,
        })),
        ...admissions.teacherUsers.map(item => ({
          id: item.id,
          name: item.fullName,
          email: item.email,
          phone: item.phone,
          roles: ["teacher" as const],
          activeRole: "teacher" as const,
          branchId: item.branchId,
          departmentId: item.departmentId,
          status:
            item.status === "active"
              ? ("active" as const)
              : ("paused" as const),
          version: item.version,
        })),
      ];
      state.users = [
        ...state.users,
        ...directoryUsers.filter(
          item => !state.users.some(existing => existing.id === item.id)
        ),
      ];
      state.students = admissions.students.map(item => ({
        id: item.id,
        userId: item.userId,
        status:
          item.status === "ready_to_enroll"
            ? "ready_to_enroll"
            : normalizedStudentStatus(item.status),
        source: item.source,
        guardianName: item.guardianName,
        guardianPhone: item.guardianPhone,
        currentLevel: item.currentLevel,
        ageGroup: item.ageGroup,
        courseInterest: item.courseInterest,
        notes: item.notes,
        country: item.country ?? "",
        preferredLanguage: item.preferredLanguage ?? "English",
        timezone: item.timezone ?? "Africa/Cairo",
      }));
      state.enrollments = admissions.enrollments.map(item => ({
        id: item.id,
        studentId: item.studentId,
        courseRunId: item.courseRunId,
        levelId: item.levelId,
        classGroupId: item.classGroupId,
        teacherId: item.teacherId,
        source: item.source,
        status:
          item.status === "active" || item.status === "paused"
            ? item.status
            : item.status === "completed"
              ? "completed"
              : "enrolled",
        progress: 0,
        attendanceRate: 0,
        currentGrade: 0,
        createdAt: item.createdAt,
      }));
      state.leads = admissions.leads.map(lead => ({
        id: lead.id,
        fullName: lead.fullName,
        email: lead.email,
        phone: lead.phone,
        country: lead.country,
        subject: lead.subject,
        source: lead.source,
        status: lead.status === "lead" ? "lead" : "cancelled",
        notes: lead.notes,
        sourceKey: lead.sourceKey,
        createdAt: lead.createdAt,
        version: lead.version,
      }));
      state.applications = admissions.applications.map(application => ({
        id: application.id,
        leadId: application.leadId,
        branchId: application.branchId,
        courseInterest: application.courseInterest,
        schedulePreference: application.schedulePreference,
        sourceKey: application.sourceKey,
        status:
          application.status === "approved"
            ? "active"
            : application.status === "cancelled"
              ? "cancelled"
              : "pending",
        version: application.version,
      }));
      state.placementTests = admissions.placementTests.map(booking => ({
        id: booking.id,
        leadId: booking.leadId,
        fullName: booking.fullName,
        email: booking.email,
        phone: booking.phone,
        branchId: booking.branchId,
        subject: booking.subject,
        preferredDate: booking.preferredDate,
        currentLevel: booking.currentLevel,
        sourceKey: booking.sourceKey,
        status:
          booking.status === "completed"
            ? "completed"
            : booking.status === "cancelled"
              ? "cancelled"
              : "pending",
        recommendedLevel: booking.recommendedLevel,
        version: booking.version,
      }));
      state.placementResults = admissions.placementResults.map(item => ({
        id: item.id,
        bookingId: item.bookingId,
        examinerId: item.examinerId,
        score: item.score,
        recommendedLevel: item.recommendedLevel,
        notes: item.notes,
        createdAt: item.createdAt,
        version: item.version,
      }));
      state.programs = admissions.programs.map(item => ({
        id: item.id,
        title: item.title,
        category: item.category,
        departmentId: item.departmentId,
        language: item.language,
        status: item.status === "active" ? "active" : "paused",
      }));
      state.levels = admissions.levels.map(item => ({
        id: item.id,
        programId: item.programId,
        title: item.title,
        order: item.order,
        prerequisites: [],
        completionRules: [],
      }));
      state.courses = admissions.courses.map(item => ({
        id: item.id,
        programId: item.programId,
        levelId: item.levelId,
        slug: item.slug,
        title: item.title,
        description: item.description ?? "",
        outcomes: [],
        status: item.status === "active" ? "active" : "paused",
      }));
      state.courseRuns = admissions.courseRuns.map(item => ({
        id: item.id,
        courseId: item.courseId,
        branchId: item.branchId,
        teacherId: item.teacherId ?? "",
        term: item.term,
        startsOn: item.startsOn,
        endsOn: item.endsOn,
        status:
          item.status === "active"
            ? "active"
            : item.status === "planned"
              ? "pending"
              : item.status === "completed"
                ? "completed"
                : "cancelled",
      }));
      state.classGroups = admissions.classGroups.map(item => ({
        id: item.id,
        courseRunId: item.courseRunId,
        name: item.name,
        capacity: item.capacity,
        schedule: item.schedule ?? "Schedule not configured",
        studentIds: item.studentIds,
        status:
          item.status === "active"
            ? "active"
            : item.status === "paused"
              ? "paused"
              : item.status === "completed"
                ? "completed"
                : "cancelled",
      }));
    }
    if (session.activeRole === "student") {
      const learning = parseStudentLearning(
        await rpc("nile_read_student_learning_workspace", {
          p_session_token_hash: sha256(session.id),
        })
      );
      const currentStudent = state.students[0];
      state.students = [
        {
          id: learning.student.id,
          userId: learning.student.userId,
          status: normalizedStudentStatus(learning.student.status),
          source: learning.student.source,
          guardianName: learning.student.guardianName,
          guardianPhone: learning.student.guardianPhone,
          currentLevel: learning.student.currentLevel,
          ageGroup: learning.student.ageGroup,
          courseInterest: learning.student.courseInterest,
          notes: learning.student.notes,
          country: learning.student.country ?? currentStudent?.country ?? "",
          preferredLanguage:
            currentStudent?.preferredLanguage ??
            state.users[0]?.preferredLanguage ??
            "English",
          timezone:
            currentStudent?.timezone ??
            state.users[0]?.timezone ??
            "Africa/Cairo",
        },
      ];
      state.users = [
        ...state.users,
        ...learning.teachers
          .filter(
            teacher => !state.users.some(existing => existing.id === teacher.id)
          )
          .map(teacher => ({
            id: teacher.id,
            name: teacher.fullName,
            email: teacher.email,
            roles: ["teacher" as const],
            activeRole: "teacher" as const,
            status: "active" as const,
          })),
      ];
      state.programs = learning.programs.map(item => ({
        id: item.id,
        title: item.title,
        category: item.category,
        departmentId: item.departmentId,
        language: item.language,
        status: item.status === "active" ? "active" : "paused",
      }));
      state.levels = learning.levels.map(item => ({
        id: item.id,
        programId: item.programId,
        title: item.title,
        order: item.order,
        prerequisites: [],
        completionRules: [],
      }));
      state.courses = learning.courses.map(item => ({
        id: item.id,
        programId: item.programId,
        levelId: item.levelId,
        slug: item.slug,
        title: item.title,
        description: item.description ?? "",
        outcomes: [],
        status: item.status === "active" ? "active" : "paused",
      }));
      state.courseRuns = learning.courseRuns.map(item => ({
        id: item.id,
        courseId: item.courseId,
        branchId: item.branchId,
        teacherId: item.teacherId ?? "",
        term: item.term,
        startsOn: item.startsOn,
        endsOn: item.endsOn,
        status:
          item.status === "active"
            ? "active"
            : item.status === "planned"
              ? "pending"
              : item.status === "completed"
                ? "completed"
                : "cancelled",
      }));
      state.classGroups = learning.classGroups.map(item => ({
        id: item.id,
        courseRunId: item.courseRunId,
        name: item.name,
        capacity: item.capacity,
        schedule: item.schedule ?? "Schedule not configured",
        studentIds: item.studentIds,
        status:
          item.status === "active"
            ? "active"
            : item.status === "paused"
              ? "paused"
              : item.status === "completed"
                ? "completed"
                : "cancelled",
      }));
      state.enrollments = learning.enrollments.map(item => ({
        id: item.id,
        studentId: item.studentId,
        courseRunId: item.courseRunId,
        levelId: item.levelId,
        classGroupId: item.classGroupId,
        teacherId: item.teacherId,
        source: item.source,
        status:
          item.status === "active" || item.status === "paused"
            ? item.status
            : item.status === "completed"
              ? "completed"
              : "enrolled",
        progress: 0,
        attendanceRate: 0,
        currentGrade: 0,
        createdAt: item.createdAt,
      }));
    }
    if (session.activeRole === "teacher") {
      const classes = parseTeacherClasses(
        await rpc("nile_read_teacher_class_workspace", {
          p_session_token_hash: sha256(session.id),
        })
      );
      state.users = [
        ...state.users,
        ...classes.studentUsers
          .filter(
            student => !state.users.some(existing => existing.id === student.id)
          )
          .map(student => ({
            id: student.id,
            name: student.fullName,
            email: student.email,
            phone: student.phone,
            preferredLanguage: student.preferredLanguage,
            timezone: student.timezone,
            roles: ["student" as const],
            activeRole: "student" as const,
            branchId: student.branchId,
            status: "active" as const,
            version: student.version,
          })),
      ];
      state.students = classes.students.map(item => ({
        id: item.id,
        userId: item.userId,
        status: normalizedStudentStatus(item.status),
        source: item.source,
        guardianName: item.guardianName,
        guardianPhone: item.guardianPhone,
        currentLevel: item.currentLevel,
        ageGroup: item.ageGroup,
        courseInterest: item.courseInterest,
        notes: item.notes,
        country: item.country ?? "",
        preferredLanguage: item.preferredLanguage ?? "English",
        timezone: item.timezone ?? "Africa/Cairo",
      }));
      state.programs = classes.programs.map(item => ({
        id: item.id,
        title: item.title,
        category: item.category,
        departmentId: item.departmentId,
        language: item.language,
        status: item.status === "active" ? "active" : "paused",
      }));
      state.levels = classes.levels.map(item => ({
        id: item.id,
        programId: item.programId,
        title: item.title,
        order: item.order,
        prerequisites: [],
        completionRules: [],
      }));
      state.courses = classes.courses.map(item => ({
        id: item.id,
        programId: item.programId,
        levelId: item.levelId,
        slug: item.slug,
        title: item.title,
        description: item.description ?? "",
        outcomes: [],
        status: item.status === "active" ? "active" : "paused",
      }));
      state.courseRuns = classes.courseRuns.map(item => ({
        id: item.id,
        courseId: item.courseId,
        branchId: item.branchId,
        teacherId: session.userId,
        term: item.term,
        startsOn: item.startsOn,
        endsOn: item.endsOn,
        status:
          item.status === "active"
            ? "active"
            : item.status === "planned"
              ? "pending"
              : item.status === "completed"
                ? "completed"
                : "cancelled",
      }));
      state.classGroups = classes.classGroups.map(item => ({
        id: item.id,
        courseRunId: item.courseRunId,
        name: item.name,
        capacity: item.capacity,
        schedule: item.schedule ?? "Schedule not configured",
        studentIds: item.studentIds,
        status:
          item.status === "active"
            ? "active"
            : item.status === "paused"
              ? "paused"
              : item.status === "completed"
                ? "completed"
                : "cancelled",
      }));
      state.enrollments = classes.enrollments.map(item => ({
        id: item.id,
        studentId: item.studentId,
        courseRunId: item.courseRunId,
        levelId: item.levelId,
        classGroupId: item.classGroupId,
        teacherId: session.userId,
        source: item.source,
        status:
          item.status === "active" || item.status === "paused"
            ? item.status
            : item.status === "completed"
              ? "completed"
              : "enrolled",
        progress: 0,
        attendanceRate: 0,
        currentGrade: 0,
        createdAt: item.createdAt,
      }));
      state.teachers = state.teachers.map(teacher => ({
        ...teacher,
        assignedClassIds: state.classGroups.map(item => item.id),
      }));
    }
    if (session.activeRole === "teacher" || session.activeRole === "student") {
      try {
        applyAttendanceWorkspace(
          state,
          parseAttendance(
            await rpc(
              session.activeRole === "teacher"
                ? "nile_read_teacher_attendance_workspace"
                : "nile_read_student_attendance_workspace",
              { p_session_token_hash: sha256(session.id) }
            )
          )
        );
      } catch (error) {
        if (!(error instanceof NormalizedWorkflowUnavailableError)) throw error;
      }
    }
    return state;
  }

  return {
    readWorkspace,
    async apply(action, session) {
      requireNormalizedSession(session);
      if (isMoodleOwnedLearningAction(action)) {
        throw new NormalizedWorkflowValidationError(
          "This learning record is managed in Moodle. Use a verified Moodle command or launch workflow."
        );
      }
      let result: PlatformWorkflowActionResult;
      if (action.type === "profile.update") {
        const idempotencyKey = clean(action.idempotencyKey);
        if (!idempotencyKey || !Number.isInteger(action.expectedVersion)) {
          throw new NormalizedWorkflowValidationError(
            "Profile updates require idempotency and the current version."
          );
        }
        const request = {
          type: action.type,
          fullName: action.name ?? null,
          phone: action.phone ?? null,
          preferredLanguage: action.preferredLanguage ?? null,
          timezone: action.timezone ?? null,
          notificationPreferences: action.notificationPreferences ?? null,
          country: action.country ?? null,
          guardianName: action.guardianName ?? null,
          guardianPhone: action.guardianPhone ?? null,
          title: action.title ?? null,
          availabilityStatus: action.availabilityStatus ?? null,
          expectedVersion: action.expectedVersion,
        };
        const rows = parseRows<ProfileMutationRow>(
          await rpc("nile_update_self_profile_with_evidence", {
            p_session_token_hash: sha256(session.id),
            p_full_name: action.name ?? null,
            p_phone: action.phone ?? null,
            p_preferred_language: action.preferredLanguage ?? null,
            p_timezone: action.timezone ?? null,
            p_notification_preferences: action.notificationPreferences ?? null,
            p_country: action.country ?? null,
            p_guardian_name: action.guardianName ?? null,
            p_guardian_phone: action.guardianPhone ?? null,
            p_title: action.title ?? null,
            p_availability_status: action.availabilityStatus ?? null,
            p_expected_version: action.expectedVersion,
            p_idempotency_key: idempotencyKey,
            p_request_hash: requestHash(request),
          })
        );
        const row = rows[0];
        result = {
          action: "profile.updated",
          entityType: "User",
          entityId: row.user_id,
          summary: row.replayed
            ? "Profile update was already applied."
            : "Profile updated.",
          result: {
            userId: row.user_id,
            version: row.profile_version,
            changed: Array.isArray(row.changed_fields)
              ? row.changed_fields
              : [],
            commandId: row.command_id,
            replayed: row.replayed,
          },
        };
      } else if (action.type === "support.ticket.create") {
        const idempotencyKey = clean(action.idempotencyKey || action.sourceKey);
        if (!idempotencyKey) {
          throw new NormalizedWorkflowValidationError(
            "Support requests require an idempotency key."
          );
        }
        const request = {
          type: action.type,
          subject: action.subject,
          details: action.details,
          category: action.category,
          priority: action.priority,
          sourceKey: action.sourceKey ?? null,
        };
        const rows = parseRows<SupportMutationRow>(
          await rpc("nile_create_support_ticket_with_evidence", {
            p_session_token_hash: sha256(session.id),
            p_subject: action.subject,
            p_details: action.details,
            p_category: action.category,
            p_priority: action.priority,
            p_source_key: action.sourceKey ?? null,
            p_idempotency_key: idempotencyKey,
            p_request_hash: requestHash(request),
          })
        );
        const row = rows[0];
        result = {
          action: "support.ticket_created",
          entityType: "SupportTicket",
          entityId: row.ticket_id,
          summary: row.replayed
            ? "Support ticket was already created."
            : "Support ticket created.",
          result: {
            id: row.ticket_id,
            version: row.ticket_version,
            commandId: row.command_id,
            replayed: row.replayed,
          },
        };
      } else if (action.type === "lead.create") {
        const idempotencyKey = clean(action.idempotencyKey || action.sourceKey);
        if (!idempotencyKey) {
          throw new NormalizedWorkflowValidationError(
            "Lead creation requires an idempotency key."
          );
        }
        const request = {
          type: action.type,
          branchId: action.branchId ?? null,
          fullName: action.fullName,
          email: action.email,
          phone: action.phone,
          country: action.country ?? null,
          subject: action.subject,
          source: action.source ?? "manual",
          notes: action.notes ?? null,
          sourceKey: action.sourceKey ?? null,
        };
        const rows = parseRows<LeadMutationRow>(
          await rpc("nile_create_admission_lead_with_evidence", {
            p_session_token_hash: sha256(session.id),
            p_branch_ref: action.branchId ?? null,
            p_full_name: action.fullName,
            p_email: action.email,
            p_phone: action.phone,
            p_country: action.country ?? null,
            p_subject: action.subject,
            p_source: action.source ?? "manual",
            p_notes: action.notes ?? null,
            p_source_key: action.sourceKey ?? null,
            p_idempotency_key: idempotencyKey,
            p_request_hash: requestHash(request),
          })
        );
        const row = rows[0];
        result = {
          action: "lead.created",
          entityType: "Lead",
          entityId: row.lead_id,
          summary: row.replayed
            ? "Lead creation was already applied."
            : `Created lead for ${action.fullName.trim()}.`,
          result: {
            id: row.lead_id,
            branchId: row.branch_id,
            version: row.lead_version,
            commandId: row.command_id,
            replayed: row.replayed,
          },
        };
      } else if (action.type === "application.create") {
        const idempotencyKey = clean(action.idempotencyKey || action.sourceKey);
        if (!idempotencyKey) {
          throw new NormalizedWorkflowValidationError(
            "Application creation requires an idempotency key."
          );
        }
        const request = {
          type: action.type,
          branchId: action.branchId,
          fullName: action.fullName,
          email: action.email,
          phone: action.phone,
          country: action.country ?? null,
          courseInterest: action.courseInterest,
          schedulePreference: action.schedulePreference,
          source: action.source ?? "manual",
          notes: action.notes ?? null,
          sourceKey: action.sourceKey ?? null,
        };
        const rows = parseRows<ApplicationMutationRow>(
          await rpc("nile_create_admission_application_with_evidence", {
            p_session_token_hash: sha256(session.id),
            p_branch_ref: action.branchId,
            p_full_name: action.fullName,
            p_email: action.email,
            p_phone: action.phone,
            p_country: action.country ?? null,
            p_course_interest: action.courseInterest,
            p_schedule_preference: action.schedulePreference,
            p_source: action.source ?? "manual",
            p_notes: action.notes ?? null,
            p_source_key: action.sourceKey ?? null,
            p_idempotency_key: idempotencyKey,
            p_request_hash: requestHash(request),
          })
        );
        const row = rows[0];
        result = {
          action: "application.created",
          entityType: "Application",
          entityId: row.application_id,
          summary: row.replayed
            ? "Application creation was already applied."
            : `Created application for ${action.fullName.trim()}.`,
          result: {
            id: row.application_id,
            leadId: row.lead_id,
            branchId: row.branch_id,
            version: row.application_version,
            leadVersion: row.lead_version,
            commandId: row.command_id,
            replayed: row.replayed,
          },
        };
      } else if (action.type === "lead.convert") {
        const idempotencyKey = clean(action.idempotencyKey);
        if (!idempotencyKey || !Number.isInteger(action.expectedVersion)) {
          throw new NormalizedWorkflowValidationError(
            "Lead conversion requires idempotency and the current version."
          );
        }
        const request = {
          type: action.type,
          leadId: action.leadId,
          branchId: action.branchId ?? null,
          expectedVersion: action.expectedVersion,
        };
        const rows = parseRows<ApplicationMutationRow>(
          await rpc("nile_convert_admission_lead_with_evidence", {
            p_session_token_hash: sha256(session.id),
            p_lead_id: action.leadId,
            p_branch_ref: action.branchId ?? null,
            p_expected_version: action.expectedVersion,
            p_idempotency_key: idempotencyKey,
            p_request_hash: requestHash(request),
          })
        );
        const row = rows[0];
        result = {
          action: "lead.converted",
          entityType: "Application",
          entityId: row.application_id,
          summary: row.replayed
            ? "Lead conversion was already applied."
            : "Lead converted to an application.",
          result: {
            id: row.application_id,
            leadId: row.lead_id,
            branchId: row.branch_id,
            version: row.application_version,
            leadVersion: row.lead_version,
            commandId: row.command_id,
            replayed: row.replayed,
          },
        };
      } else if (action.type === "placement.create") {
        const idempotencyKey = clean(action.idempotencyKey || action.sourceKey);
        if (!idempotencyKey) {
          throw new NormalizedWorkflowValidationError(
            "Placement booking requires an idempotency key."
          );
        }
        const request = {
          type: action.type,
          leadId: action.leadId ?? null,
          branchId: action.branchId ?? null,
          fullName: action.fullName,
          email: action.email,
          phone: action.phone,
          subject: action.subject,
          preferredDate: action.preferredDate,
          currentLevel: action.currentLevel,
          sourceKey: action.sourceKey ?? null,
        };
        const rows = parseRows<PlacementMutationRow>(
          await rpc("nile_create_placement_booking_with_evidence", {
            p_session_token_hash: sha256(session.id),
            p_lead_id: action.leadId ?? null,
            p_branch_ref: action.branchId ?? null,
            p_full_name: action.fullName,
            p_email: action.email,
            p_phone: action.phone,
            p_subject: action.subject,
            p_preferred_date: action.preferredDate,
            p_current_level: action.currentLevel,
            p_source_key: action.sourceKey ?? null,
            p_idempotency_key: idempotencyKey,
            p_request_hash: requestHash(request),
          })
        );
        const row = rows[0];
        result = {
          action: "placement.created",
          entityType: "PlacementTestBooking",
          entityId: row.booking_id,
          summary: row.replayed
            ? "Placement booking was already created."
            : `Booked placement for ${action.fullName.trim()}.`,
          result: {
            id: row.booking_id,
            leadId: row.lead_id,
            branchId: row.branch_id,
            version: row.booking_version,
            leadVersion: row.lead_version,
            commandId: row.command_id,
            replayed: row.replayed,
          },
        };
      } else if (action.type === "placement.result.record") {
        const idempotencyKey = clean(action.idempotencyKey);
        if (!idempotencyKey || !Number.isInteger(action.expectedVersion)) {
          throw new NormalizedWorkflowValidationError(
            "Placement results require idempotency and the current booking version."
          );
        }
        const request = {
          type: action.type,
          bookingId: action.bookingId,
          recommendedLevel: action.recommendedLevel,
          score: action.score,
          notes: action.notes,
          expectedVersion: action.expectedVersion,
        };
        const rows = parseRows<PlacementMutationRow>(
          await rpc("nile_record_placement_result_with_evidence", {
            p_session_token_hash: sha256(session.id),
            p_booking_id: action.bookingId,
            p_recommended_level: action.recommendedLevel,
            p_score: action.score,
            p_notes: action.notes,
            p_expected_version: action.expectedVersion,
            p_idempotency_key: idempotencyKey,
            p_request_hash: requestHash(request),
          })
        );
        const row = rows[0];
        result = {
          action: "placement.result_recorded",
          entityType: "PlacementTestResult",
          entityId: row.result_id ?? row.booking_id,
          summary: row.replayed
            ? "Placement result was already recorded."
            : `Recorded ${action.recommendedLevel.trim()} placement.`,
          result: {
            id: row.result_id,
            bookingId: row.booking_id,
            version: row.result_version,
            bookingVersion: row.booking_version,
            leadVersion: row.lead_version,
            commandId: row.command_id,
            replayed: row.replayed,
          },
        };
      } else if (action.type === "assignment.create") {
        const idempotencyKey = clean(action.idempotencyKey);
        const classGroupId = clean(action.classGroupId);
        const title = clean(action.title);
        const dueAt = new Date(action.dueAt);
        if (
          !idempotencyKey ||
          !classGroupId ||
          !clean(action.courseRunId) ||
          !title ||
          Number.isNaN(dueAt.getTime()) ||
          dueAt <= new Date()
        ) {
          throw new NormalizedWorkflowValidationError(
            "Assignment drafts require an exact class, future due date, and idempotency key."
          );
        }
        const request = {
          type: action.type,
          courseRunId: action.courseRunId,
          classGroupId,
          title,
          dueAt: dueAt.toISOString(),
          submissionType: action.submissionType,
          rubric: action.rubric,
        };
        const row = parseRows<AssignmentMutationRow>(
          await rpc("nile_create_teacher_assignment_draft_with_evidence", {
            p_session_token_hash: sha256(session.id),
            p_course_run_id: action.courseRunId,
            p_class_group_id: classGroupId,
            p_title: title,
            p_due_at: dueAt.toISOString(),
            p_submission_type: action.submissionType,
            p_rubric: action.rubric,
            p_idempotency_key: idempotencyKey,
            p_request_hash: requestHash(request),
          })
        )[0];
        result = {
          action: "assignment.created",
          entityType: "Assignment",
          entityId: row.assignment_id,
          summary: row.replayed
            ? "Assignment draft creation was already applied."
            : "Assignment draft created.",
          result: {
            id: row.assignment_id,
            version: row.assignment_version,
            commandId: row.command_id,
            outboxEventId: row.outbox_event_id,
            replayed: row.replayed,
          },
        };
      } else if (
        action.type === "assignment.status.update" &&
        action.status === "active"
      ) {
        const idempotencyKey = clean(action.idempotencyKey);
        const expectedVersion = action.expectedVersion;
        if (
          !idempotencyKey ||
          !Number.isInteger(expectedVersion) ||
          (expectedVersion ?? 0) < 1
        ) {
          throw new NormalizedWorkflowValidationError(
            "Assignment publication requires idempotency and the current version."
          );
        }
        const request = {
          type: "assignment.publish",
          assignmentId: action.assignmentId,
          expectedVersion,
        };
        const row = parseRows<AssignmentMutationRow>(
          await rpc("nile_publish_teacher_assignment_with_evidence", {
            p_session_token_hash: sha256(session.id),
            p_assignment_id: action.assignmentId,
            p_expected_version: expectedVersion,
            p_idempotency_key: idempotencyKey,
            p_request_hash: requestHash(request),
          })
        )[0];
        result = {
          action: "assignment.published",
          entityType: "Assignment",
          entityId: row.assignment_id,
          summary: row.replayed
            ? "Assignment publication was already applied."
            : "Assignment published.",
          result: {
            id: row.assignment_id,
            version: row.assignment_version,
            commandId: row.command_id,
            outboxEventId: row.outbox_event_id,
            replayed: row.replayed,
          },
        };
      } else if (action.type === "assignment.submit") {
        const idempotencyKey = clean(action.idempotencyKey);
        const expectedVersion = action.expectedVersion;
        if (
          !idempotencyKey ||
          !Number.isInteger(expectedVersion) ||
          (expectedVersion ?? 0) < 1 ||
          (!clean(action.response) && !(action.pendingMedia?.length ?? 0))
        ) {
          throw new NormalizedWorkflowValidationError(
            "Assignment submission requires content, idempotency, and the current assignment version."
          );
        }
        const request = {
          type: action.type,
          assignmentId: action.assignmentId,
          response: action.response,
          pendingMedia: action.pendingMedia ?? [],
          expectedVersion,
        };
        const row = parseRows<SubmissionMutationRow>(
          await rpc("nile_submit_student_assignment_with_evidence", {
            p_session_token_hash: sha256(session.id),
            p_assignment_id: action.assignmentId,
            p_response: action.response,
            p_pending_media: action.pendingMedia ?? [],
            p_expected_version: expectedVersion,
            p_idempotency_key: idempotencyKey,
            p_request_hash: requestHash(request),
          })
        )[0];
        result = {
          action: "assignment.submitted",
          entityType: "AssignmentSubmission",
          entityId: row.submission_id,
          summary: row.replayed
            ? "Assignment submission was already applied."
            : "Assignment submitted.",
          result: {
            id: row.submission_id,
            version: row.submission_version,
            commandId: row.command_id,
            outboxEventId: row.outbox_event_id,
            replayed: row.replayed,
          },
        };
      } else if (action.type === "assignment.grade") {
        const idempotencyKey = clean(action.idempotencyKey);
        const expectedVersion = action.expectedVersion;
        if (
          !idempotencyKey ||
          !Number.isInteger(expectedVersion) ||
          (expectedVersion ?? 0) < 1 ||
          !Number.isFinite(action.score) ||
          !clean(action.feedback)
        ) {
          throw new NormalizedWorkflowValidationError(
            "Assignment grading requires feedback, idempotency, and the current submission version."
          );
        }
        const request = {
          type: action.type,
          submissionId: action.submissionId,
          score: action.score,
          feedback: action.feedback,
          expectedVersion,
        };
        const row = parseRows<GradeMutationRow>(
          await rpc("nile_grade_teacher_assignment_submission_with_evidence", {
            p_session_token_hash: sha256(session.id),
            p_submission_id: action.submissionId,
            p_score: action.score,
            p_feedback: action.feedback,
            p_expected_version: expectedVersion,
            p_idempotency_key: idempotencyKey,
            p_request_hash: requestHash(request),
          })
        )[0];
        result = {
          action: "assignment.graded",
          entityType: "Grade",
          entityId: row.grade_id,
          summary: row.replayed
            ? "Assignment grade was already applied."
            : "Assignment graded and released.",
          result: {
            id: row.grade_id,
            submissionId: row.submission_id,
            version: row.grade_version,
            submissionVersion: row.submission_version,
            revisionNumber: row.revision_number,
            commandId: row.command_id,
            outboxEventId: row.outbox_event_id,
            replayed: row.replayed,
          },
        };
      } else if (action.type === "calendar.create") {
        const idempotencyKey = clean(action.idempotencyKey);
        const title = clean(action.title);
        const classGroupId = clean(action.classGroupId);
        const startsAt = new Date(action.startsAt);
        const endsAt = new Date(action.endsAt);
        if (
          !idempotencyKey ||
          !classGroupId ||
          !title ||
          !["class_session", "live_session"].includes(action.eventType) ||
          Number.isNaN(startsAt.getTime()) ||
          Number.isNaN(endsAt.getTime()) ||
          endsAt <= startsAt
        ) {
          throw new NormalizedWorkflowValidationError(
            "Class sessions require a class, valid times, and an idempotency key."
          );
        }
        const request = {
          type: action.type,
          classGroupId,
          eventType: action.eventType,
          title,
          startsAt: startsAt.toISOString(),
          endsAt: endsAt.toISOString(),
        };
        const rows = parseRows<ClassSessionMutationRow>(
          await rpc("nile_create_teacher_class_session_with_evidence", {
            p_session_token_hash: sha256(session.id),
            p_class_group_id: classGroupId,
            p_event_type: action.eventType,
            p_title: title,
            p_starts_at: startsAt.toISOString(),
            p_ends_at: endsAt.toISOString(),
            p_idempotency_key: idempotencyKey,
            p_request_hash: requestHash(request),
          })
        );
        const row = rows[0];
        result = {
          action: "calendar.created",
          entityType: "CalendarEvent",
          entityId: row.class_session_id,
          summary: row.replayed
            ? "Class session creation was already applied."
            : "Class session created.",
          result: {
            id: row.class_session_id,
            version: row.session_version,
            commandId: row.command_id,
            outboxEventId: row.outbox_event_id,
            replayed: row.replayed,
          },
        };
      } else if (action.type === "attendance.save") {
        const idempotencyKey = clean(action.idempotencyKey);
        const expectedVersion = action.expectedVersion;
        if (
          !idempotencyKey ||
          !Number.isInteger(expectedVersion) ||
          (expectedVersion ?? 0) < 1 ||
          !clean(action.classGroupId) ||
          !clean(action.sessionId) ||
          Object.keys(action.statuses).length === 0
        ) {
          throw new NormalizedWorkflowValidationError(
            "Attendance requires a complete roster, idempotency, and the current session version."
          );
        }
        const request = {
          type: action.type,
          classGroupId: action.classGroupId,
          sessionId: action.sessionId,
          statuses: action.statuses,
          notes: action.notes ?? {},
          expectedVersion,
        };
        const rows = parseRows<AttendanceMutationRow>(
          await rpc("nile_save_teacher_attendance_with_evidence", {
            p_session_token_hash: sha256(session.id),
            p_class_group_id: action.classGroupId,
            p_class_session_id: action.sessionId,
            p_statuses: action.statuses,
            p_notes: action.notes ?? {},
            p_expected_version: expectedVersion,
            p_idempotency_key: idempotencyKey,
            p_request_hash: requestHash(request),
          })
        );
        const row = rows[0];
        result = {
          action: "attendance.saved",
          entityType: "AttendanceRecord",
          entityId: action.classGroupId,
          summary: row.replayed
            ? "Attendance save was already applied."
            : `Saved attendance for ${row.attendance_count} learner(s).`,
          result: {
            classGroupId: action.classGroupId,
            sessionId: row.class_session_id,
            attendanceCount: row.attendance_count,
            version: row.session_version,
            commandId: row.command_id,
            outboxEventId: row.outbox_event_id,
            replayed: row.replayed,
          },
        };
      } else {
        throw new NormalizedWorkflowUnavailableError(
          `Normalized ${action.type} persistence is not active.`
        );
      }
      return {
        state: await readWorkspace(session),
        persistence: "supabase",
        syncedAt: new Date().toISOString(),
        result,
      };
    },
  };
}

let repositoryOverride: NormalizedWorkflowRepository | null = null;
let defaultRepository: NormalizedWorkflowRepository | null = null;

export function getNormalizedWorkflowRepository() {
  if (repositoryOverride) return repositoryOverride;
  defaultRepository ??= createSupabaseNormalizedWorkflowRepository();
  return defaultRepository;
}

export function setNormalizedWorkflowRepository(
  repository: NormalizedWorkflowRepository
) {
  const previous = repositoryOverride;
  repositoryOverride = repository;
  return () => {
    repositoryOverride = previous;
  };
}

export function resetNormalizedWorkflowRepository() {
  repositoryOverride = null;
  defaultRepository = null;
}
