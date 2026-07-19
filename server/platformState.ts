import {
  applyPlatformWorkflowAction as applyWorkflowMutation,
  type PlatformWorkflowAction,
  type PlatformWorkflowActionResult,
} from "../client/src/lib/domain/actions.js";
import type {
  AttendanceStatus,
  CalendarEventType,
  CommunicationLog,
  IntegrationConfig,
  IntegrationStatus,
  Lead,
  MessageAttachment,
  PendingMediaAttachment,
  PlatformState,
  StaffAvailabilityStatus,
  StaffPermissionScope,
  StaffRole,
  StudentEntrySource,
  StudentIntakeDocumentType,
  StudentStatus,
  UserNotificationPreferences,
} from "../client/src/lib/domain/types.js";
import { canSendMessageToUser } from "../client/src/lib/domain/messageScope.js";
import {
  assertStudentIntakeLineage,
  branchIdForInvoice,
  teacherHasStudentRosterAuthority,
} from "../client/src/lib/domain/relationships.js";
import {
  roleOrder,
  rolePermissions,
  type Permission,
  type Role,
} from "../client/src/lib/platformData.js";
import type { ServerSession } from "./auth.js";
import {
  requiredPermissionForPlatformAction,
  roleCanRunPlatformAction,
  SELF_SCOPED_ACTION,
} from "./platformCapabilities.js";
import {
  getPlatformStateRepository,
  type PlatformStatePayload,
} from "./platformRepository.js";

function now() {
  return new Date().toISOString();
}

function createId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export async function getPlatformStateSnapshot(): Promise<PlatformStatePayload> {
  return getPlatformStateRepository().readSnapshot();
}

function studentIdForSession(state: PlatformState, session: ServerSession) {
  return state.students.find(
    student => student.userId === session.userId && student.status === "active"
  )?.id;
}

function requireStudentIdForSession(
  state: PlatformState,
  session: ServerSession
) {
  const studentId = studentIdForSession(state, session);
  if (!studentId) {
    throw new Error("Student profile is not mapped to this session identity.");
  }
  return studentId;
}

function userForSession(state: PlatformState, session: ServerSession) {
  return state.users.find(item => item.id === session.userId);
}

function activeStaffProfileForSession(
  state: PlatformState,
  session: ServerSession
) {
  if (session.activeRole === "student") return undefined;
  return state.staffProfiles.find(
    profile =>
      profile.userId === session.userId &&
      profile.role === session.activeRole &&
      profile.status === "active"
  );
}

function branchIdsForSessionScope(
  state: PlatformState,
  session: ServerSession
) {
  return new Set(activeStaffProfileForSession(state, session)?.branchIds ?? []);
}

function departmentIdsForSessionScope(
  state: PlatformState,
  session: ServerSession
) {
  return new Set(
    activeStaffProfileForSession(state, session)?.departmentIds ?? []
  );
}

function assertSnapshotSessionAuthority(
  state: PlatformState,
  session: ServerSession
) {
  const user = userForSession(state, session);
  if (!user) {
    if (session.activeRole === "student") {
      throw new Error(
        "Student profile is not mapped to this session identity."
      );
    }
    throw new Error("Session identity is not mapped to an active state user.");
  }
  if (user.status !== "active") {
    throw new Error("Session identity is not active in platform state.");
  }
  if (!session.roles.includes(session.activeRole)) {
    throw new Error("Session active role does not match its granted roles.");
  }
  if (!user.roles.includes(session.activeRole)) {
    throw new Error(
      "Session active role is no longer granted in platform state."
    );
  }
  if (session.activeRole === "student") {
    const studentProfile = state.students.find(
      profile =>
        profile.userId === session.userId && profile.status === "active"
    );
    if (!studentProfile) {
      throw new Error(
        "Snapshot student actions require an active student profile."
      );
    }
    return;
  }
  if (!activeStaffProfileForSession(state, session)) {
    throw new Error(
      `Snapshot staff actions require an active ${session.activeRole} staff profile.`
    );
  }
  if (session.activeRole === "teacher") {
    const teacherProfile = state.teachers.find(
      profile =>
        profile.userId === session.userId && profile.status === "active"
    );
    if (!teacherProfile) {
      throw new Error(
        "Snapshot teacher actions require an active teacher profile."
      );
    }
  }
}

function courseRunForAssignment(state: PlatformState, assignmentId: string) {
  const assignment = state.assignments.find(item => item.id === assignmentId);
  return assignment
    ? state.courseRuns.find(item => item.id === assignment.courseRunId)
    : undefined;
}

function courseRunForQuiz(state: PlatformState, quizId: string) {
  const quiz = state.quizzes.find(item => item.id === quizId);
  return quiz
    ? state.courseRuns.find(item => item.id === quiz.courseRunId)
    : undefined;
}

function branchForInvoice(state: PlatformState, invoiceId: string) {
  const invoice = state.invoices.find(item => item.id === invoiceId);
  return invoice ? branchIdForInvoice(state, invoice) : undefined;
}

function teacherOwnsStudent(
  state: PlatformState,
  teacherUserId: string,
  studentId: string
) {
  return state.courseRuns.some(
    run =>
      run.teacherId === teacherUserId &&
      teacherHasStudentRosterAuthority(state, teacherUserId, run.id, studentId)
  );
}

function teacherOwnsResource(
  state: PlatformState,
  teacherUserId: string,
  resourceId: string
) {
  const resource = state.resources.find(item => item.id === resourceId);
  const lesson = state.lessons.find(item => item.id === resource?.lessonId);
  const module = state.modules.find(item => item.id === lesson?.moduleId);
  return Boolean(
    module &&
      state.courseRuns.some(
        item =>
          item.courseId === module.courseId &&
          item.teacherId === teacherUserId &&
          item.status === "active"
      )
  );
}

function studentIdsForTeacher(state: PlatformState, teacherUserId: string) {
  const classGroupIds = teacherClassGroupIds(state, teacherUserId);
  return new Set(
    state.enrollments
      .filter(
        item =>
          item.status === "active" &&
          Boolean(item.classGroupId && classGroupIds.has(item.classGroupId)) &&
          teacherOwnsStudent(state, teacherUserId, item.studentId)
      )
      .map(item => item.studentId)
  );
}

function teacherClassGroupIds(state: PlatformState, teacherUserId: string) {
  const runIds = new Set(
    state.courseRuns
      .filter(
        item => item.teacherId === teacherUserId && item.status === "active"
      )
      .map(item => item.id)
  );
  return new Set(
    state.classGroups
      .filter(item => runIds.has(item.courseRunId))
      .map(item => item.id)
  );
}

function studentIdsForBranch(state: PlatformState, branchId?: string) {
  const runIds = new Set(
    state.courseRuns
      .filter(item => item.branchId === branchId && item.status === "active")
      .map(item => item.id)
  );
  return new Set(
    state.enrollments
      .filter(item => item.status === "active" && runIds.has(item.courseRunId))
      .map(item => item.studentId)
  );
}

function hodOwnsCourse(
  state: PlatformState,
  session: ServerSession,
  courseId: string
) {
  const course = state.courses.find(item => item.id === courseId);
  const program = state.programs.find(item => item.id === course?.programId);
  const department = state.departments.find(
    item => item.id === program?.departmentId
  );
  return Boolean(
    department &&
      departmentIdsForSessionScope(state, session).has(department.id)
  );
}

function hodOwnsCourseRun(
  state: PlatformState,
  session: ServerSession,
  courseRun: PlatformState["courseRuns"][number] | undefined
) {
  if (!courseRun || !hodOwnsCourse(state, session, courseRun.courseId)) {
    return false;
  }
  const branchIds = branchIdsForSessionScope(state, session);
  return branchIds.has("br_global") || branchIds.has(courseRun.branchId);
}

function hodOwnsStudent(
  state: PlatformState,
  session: ServerSession,
  studentId: string
) {
  const courseIds = new Set(
    state.enrollments
      .filter(item => item.studentId === studentId)
      .map(
        item =>
          state.courseRuns.find(
            run =>
              run.id === item.courseRunId &&
              hodOwnsCourseRun(state, session, run)
          )?.courseId
      )
      .filter((courseId): courseId is string => Boolean(courseId))
  );
  return Array.from(courseIds).some(courseId =>
    hodOwnsCourse(state, session, courseId)
  );
}

function hodOwnsCertificate(
  state: PlatformState,
  session: ServerSession,
  certificateId: string
) {
  const certificate = state.certificates.find(
    item => item.id === certificateId
  );
  if (
    !certificate ||
    !hodOwnsCourse(state, session, certificate.courseId) ||
    !hodOwnsStudent(state, session, certificate.studentId)
  ) {
    return false;
  }
  return state.enrollments.some(enrollment => {
    if (enrollment.studentId !== certificate.studentId) return false;
    const run = state.courseRuns.find(
      item => item.id === enrollment.courseRunId
    );
    return (
      run?.courseId === certificate.courseId &&
      hodOwnsCourseRun(state, session, run)
    );
  });
}

function canMessageRecipient(
  state: PlatformState,
  session: ServerSession,
  toUserId: string
) {
  return canSendMessageToUser(
    state,
    session.activeRole,
    session.userId,
    toUserId
  );
}

function assertStudentScopedAction(
  state: PlatformState,
  action: PlatformWorkflowAction,
  session: ServerSession
) {
  if (session.activeRole !== "student") return;
  const studentId = requireStudentIdForSession(state, session);
  if (action.type === "assignment.submit") {
    const run = courseRunForAssignment(state, action.assignmentId);
    if (
      !state.enrollments.some(
        item => item.studentId === studentId && item.courseRunId === run?.id
      )
    ) {
      throw new Error(
        "Student can only submit assignments for enrolled course runs."
      );
    }
  }
  if (action.type === "quiz.submit") {
    const run = courseRunForQuiz(state, action.quizId);
    if (
      !state.enrollments.some(
        item => item.studentId === studentId && item.courseRunId === run?.id
      )
    ) {
      throw new Error(
        "Student can only submit quizzes for enrolled course runs."
      );
    }
  }
  if (action.type === "lesson.start" || action.type === "lesson.complete") {
    const lesson = state.lessons.find(item => item.id === action.lessonId);
    const module = state.modules.find(item => item.id === lesson?.moduleId);
    const courseRunIds = new Set(
      state.courseRuns
        .filter(
          item => item.courseId === module?.courseId && item.status === "active"
        )
        .map(item => item.id)
    );
    const requestedEnrollmentId = action.enrollmentId;
    if (
      requestedEnrollmentId !== undefined &&
      (typeof requestedEnrollmentId !== "string" ||
        !requestedEnrollmentId.trim())
    ) {
      throw new Error(
        "Student can only open lessons for enrolled course runs."
      );
    }
    if (
      !state.enrollments.some(
        item =>
          item.studentId === studentId &&
          item.status === "active" &&
          courseRunIds.has(item.courseRunId) &&
          (requestedEnrollmentId === undefined ||
            item.id === requestedEnrollmentId)
      )
    ) {
      throw new Error(
        "Student can only open lessons for enrolled course runs."
      );
    }
  }
  if (action.type === "recitation.submit") {
    const plan = state.quranPlans.find(item => item.studentId === studentId);
    if (
      !plan ||
      plan.teacherId !== action.teacherId ||
      !teacherOwnsStudent(state, action.teacherId, studentId)
    ) {
      throw new Error(
        "Student can only submit recitations to their assigned Quran teacher."
      );
    }
  }
  if (action.type === "attendance.exception.submit") {
    const attendance = state.attendance.find(
      item => item.id === action.attendanceRecordId
    );
    if (!attendance || attendance.studentId !== studentId) {
      throw new Error(
        "Student can only request exceptions for their own attendance."
      );
    }
  }
  if (action.type === "notification.read") {
    const notification = state.notifications.find(
      item => item.id === action.notificationId
    );
    if (notification?.userId !== session.userId)
      throw new Error("Student can only mark own notifications as read.");
  }
}

function allowedReportTypesForRole(role: ServerSession["activeRole"]) {
  const byRole: Record<ServerSession["activeRole"], Set<string>> = {
    student: new Set(["enrollments", "attendance"]),
    teacher: new Set(["enrollments", "attendance", "audit"]),
    registrar: new Set(["enrollments", "finance"]),
    headofdepartment: new Set(["enrollments", "attendance", "audit"]),
    branchadmin: new Set(["enrollments", "attendance", "finance"]),
    superadmin: new Set(["enrollments", "attendance", "finance", "audit"]),
  };
  return byRole[role];
}

function assertActionPermission(
  state: PlatformState,
  action: PlatformWorkflowAction,
  session: ServerSession
) {
  const permission = requiredPermissionForPlatformAction(
    session.activeRole,
    action
  );
  if (permission === SELF_SCOPED_ACTION) return;
  if (!permission) {
    const module = action.type === "record.save" ? action.module : action.type;
    throw new Error(
      `Role ${session.activeRole} cannot save operational records for ${module}.`
    );
  }
  if (!state.permissions[session.activeRole]?.includes(permission)) {
    throw new Error(
      `Role ${session.activeRole} lacks ${permission} for ${action.type}.`
    );
  }
}

function assertScopedAction(
  state: PlatformState,
  action: PlatformWorkflowAction,
  session: ServerSession
) {
  if (!roleCanRunPlatformAction(session.activeRole, action.type)) {
    throw new Error(`Role ${session.activeRole} cannot run ${action.type}.`);
  }
  assertActionPermission(state, action, session);

  if (action.type === "report.preset.save") {
    if (action.role !== session.activeRole)
      throw new Error("Report preset role must match the active session role.");
    if (!allowedReportTypesForRole(session.activeRole).has(action.reportType)) {
      throw new Error(
        `Role ${session.activeRole} cannot save ${action.reportType} report views.`
      );
    }
  }

  if (action.type === "portal.settings.save") {
    if (action.role !== session.activeRole)
      throw new Error("Settings role must match the active session role.");
    if (
      session.activeRole === "registrar" ||
      session.activeRole === "branchadmin"
    ) {
      if (!branchIdsForSessionScope(state, session).has(action.scopeId)) {
        throw new Error("Portal settings are limited to your branch.");
      }
    }
    if (session.activeRole === "headofdepartment") {
      if (!departmentIdsForSessionScope(state, session).has(action.scopeId)) {
        throw new Error("Portal settings are limited to your department.");
      }
    }
  }

  if (
    action.type === "profile.update" &&
    (action.userId ?? session.userId) !== session.userId
  ) {
    throw new Error("Users can only update their own profile.");
  }

  assertStudentScopedAction(state, action, session);

  if (session.activeRole === "teacher") {
    if (
      action.type === "assignment.create" ||
      action.type === "quiz.create" ||
      action.type === "question.create"
    ) {
      const run = state.courseRuns.find(item => item.id === action.courseRunId);
      if (run?.teacherId !== session.userId)
        throw new Error(
          "Teacher can only create assessments for assigned course runs."
        );
    }
    if (
      action.type === "assignment.update" ||
      action.type === "assignment.status.update"
    ) {
      const run = courseRunForAssignment(state, action.assignmentId);
      if (run?.teacherId !== session.userId) {
        throw new Error(
          "Teacher can only manage assignments for assigned course runs."
        );
      }
    }
    if (action.type === "quiz.update" || action.type === "quiz.status.update") {
      const run = courseRunForQuiz(state, action.quizId);
      if (run?.teacherId !== session.userId) {
        throw new Error(
          "Teacher can only manage quizzes for assigned course runs."
        );
      }
    }
    if (action.type === "quiz.questions.set") {
      const run = courseRunForQuiz(state, action.quizId);
      if (run?.teacherId !== session.userId)
        throw new Error(
          "Teacher can only attach questions to assigned course quizzes."
        );
    }
    if (action.type === "assignment.grade") {
      const submission = state.assignmentSubmissions.find(
        item => item.id === action.submissionId
      );
      const assignment = state.assignments.find(
        item => item.id === submission?.assignmentId
      );
      const run = state.courseRuns.find(
        item => item.id === assignment?.courseRunId
      );
      if (
        run?.teacherId !== session.userId ||
        !submission ||
        !teacherOwnsStudent(state, session.userId, submission.studentId)
      ) {
        throw new Error("Teacher can only grade assigned class submissions.");
      }
    }
    if (action.type === "quiz.review") {
      const attempt = state.quizAttempts.find(
        item => item.id === action.attemptId
      );
      const quiz = state.quizzes.find(item => item.id === attempt?.quizId);
      const run = state.courseRuns.find(item => item.id === quiz?.courseRunId);
      if (
        run?.teacherId !== session.userId ||
        !attempt ||
        !teacherOwnsStudent(state, session.userId, attempt.studentId)
      ) {
        throw new Error(
          "Teacher can only review assigned class quiz attempts."
        );
      }
    }
    if (action.type === "attendance.save") {
      const group = state.classGroups.find(
        item => item.id === action.classGroupId
      );
      const run = state.courseRuns.find(item => item.id === group?.courseRunId);
      if (!group || !run || run.teacherId !== session.userId)
        throw new Error(
          "Teacher can only save attendance for assigned classes."
        );
    }
    if (action.type === "material.publish.update") {
      if (!teacherOwnsResource(state, session.userId, action.id)) {
        throw new Error(
          "Teacher can only publish materials for assigned courses."
        );
      }
    }
    if (action.type === "calendar.create") {
      const allowedTypes = new Set<CalendarEventType>([
        "class_session",
        "live_session",
        "assignment_due",
        "quiz_due",
        "reminder",
      ]);
      const group = action.classGroupId
        ? state.classGroups.find(item => item.id === action.classGroupId)
        : undefined;
      const run = group
        ? state.courseRuns.find(item => item.id === group.courseRunId)
        : undefined;
      const room = action.roomId
        ? state.rooms.find(item => item.id === action.roomId)
        : undefined;
      const branchIds = branchIdsForSessionScope(state, session);
      if (!allowedTypes.has(action.eventType))
        throw new Error("Teacher can only schedule teaching calendar items.");
      if (
        action.classGroupId &&
        (!group || !run || run.teacherId !== session.userId)
      )
        throw new Error("Teacher can only schedule assigned classes.");
      if (action.branchId && !branchIds.has(action.branchId))
        throw new Error("Teacher can only schedule inside assigned branches.");
      if (action.roomId && (!room || !branchIds.has(room.branchId)))
        throw new Error("Teacher can only book rooms in assigned branches.");
      if (action.ownerId && action.ownerId !== session.userId)
        throw new Error("Teacher can only create own calendar events.");
    }
    if (
      action.type === "class.session.reschedule" ||
      action.type === "class.session.cancel"
    ) {
      const classSession = state.classSessions.find(
        item =>
          item.id === action.sessionId || item.eventId === action.sessionId
      );
      const group = state.classGroups.find(
        item => item.id === classSession?.classGroupId
      );
      const run = state.courseRuns.find(item => item.id === group?.courseRunId);
      if (!classSession || !group || !run || run.teacherId !== session.userId) {
        throw new Error(
          "Teacher can only manage sessions for assigned classes."
        );
      }
      if (action.type === "class.session.reschedule" && action.roomId) {
        const room = state.rooms.find(item => item.id === action.roomId);
        const branchIds = branchIdsForSessionScope(state, session);
        if (!room || !branchIds.has(room.branchId)) {
          throw new Error("Teacher can only use rooms in assigned branches.");
        }
      }
    }
    if (action.type === "quran.progress.update") {
      const record = state.quranProgress.find(
        item => item.id === action.recordId
      );
      if (
        !record ||
        !teacherOwnsStudent(state, session.userId, record.studentId)
      ) {
        throw new Error(
          "Teacher can only update Quran progress for assigned learners."
        );
      }
    }
    if (action.type === "recitation.review") {
      const submission = state.recitationSubmissions.find(
        item => item.id === action.submissionId
      );
      if (submission?.teacherId !== session.userId)
        throw new Error("Teacher can only review assigned recitations.");
    }
    if (action.type === "notification.read") {
      const notification = state.notifications.find(
        item => item.id === action.notificationId
      );
      if (notification?.userId !== session.userId)
        throw new Error("Teacher can only mark own notifications as read.");
    }
  }

  if (session.activeRole === "branchadmin") {
    const branchIds = branchIdsForSessionScope(state, session);
    if (action.type === "attendance.exception.review") {
      const request = state.attendanceExceptions.find(
        item => item.id === action.requestId
      );
      const classGroup = state.classGroups.find(
        item => item.id === request?.classGroupId
      );
      const courseRun = state.courseRuns.find(
        item => item.id === classGroup?.courseRunId
      );
      if (
        !request ||
        !classGroup ||
        !courseRun ||
        !branchIds.has(courseRun.branchId)
      ) {
        throw new Error(
          "Branch admin can only review attendance exceptions in their branch."
        );
      }
    }
    if (action.type === "calendar.create") {
      const allowedTypes = new Set<CalendarEventType>([
        "class_session",
        "live_session",
        "room_booking",
        "reminder",
      ]);
      if (!action.branchId || !branchIds.has(action.branchId)) {
        throw new Error("Branch admin can only schedule inside their branch.");
      }
      if (!allowedTypes.has(action.eventType))
        throw new Error(
          "Branch admin can only schedule branch operations calendar items."
        );
      const room = action.roomId
        ? state.rooms.find(item => item.id === action.roomId)
        : undefined;
      const group = action.classGroupId
        ? state.classGroups.find(item => item.id === action.classGroupId)
        : undefined;
      const run = group
        ? state.courseRuns.find(item => item.id === group.courseRunId)
        : undefined;
      if (action.roomId && (!room || !branchIds.has(room.branchId)))
        throw new Error("Branch admin can only book rooms in their branch.");
      if (
        action.classGroupId &&
        (!group || !run || !branchIds.has(run.branchId))
      )
        throw new Error(
          "Branch admin can only schedule classes in their branch."
        );
    }
    if (action.type === "attendance.save") {
      const group = state.classGroups.find(
        item => item.id === action.classGroupId
      );
      const run = state.courseRuns.find(item => item.id === group?.courseRunId);
      if (!group || !run || !branchIds.has(run.branchId))
        throw new Error(
          "Branch admin can only save attendance in their branch."
        );
    }
    if (
      action.type === "payment.record" &&
      !branchIds.has(branchForInvoice(state, action.invoiceId) ?? "")
    ) {
      throw new Error(
        "Branch admin can only record payments for their branch."
      );
    }
    if (action.type === "room.status.update") {
      const room = state.rooms.find(item => item.id === action.roomId);
      if (!room || !branchIds.has(room.branchId)) {
        throw new Error("Branch admin can only update rooms in their branch.");
      }
    }
    if (
      action.type === "class.session.reschedule" ||
      action.type === "class.session.cancel"
    ) {
      const classSession = state.classSessions.find(
        item =>
          item.id === action.sessionId || item.eventId === action.sessionId
      );
      const group = state.classGroups.find(
        item => item.id === classSession?.classGroupId
      );
      const run = state.courseRuns.find(item => item.id === group?.courseRunId);
      if (!classSession || !group || !run || !branchIds.has(run.branchId)) {
        throw new Error(
          "Branch admin can only manage sessions in their branch."
        );
      }
      if (action.type === "class.session.reschedule" && action.roomId) {
        const room = state.rooms.find(item => item.id === action.roomId);
        if (!room || !branchIds.has(room.branchId)) {
          throw new Error("Branch admin can only use rooms in their branch.");
        }
      }
    }
    if (action.type === "room.create" && !branchIds.has(action.branchId)) {
      throw new Error("Branch admin can only create rooms in their branch.");
    }
    if (action.type === "class.create") {
      const run = state.courseRuns.find(item => item.id === action.courseRunId);
      if (!run || !branchIds.has(run.branchId)) {
        throw new Error(
          "Branch admin can only create classes in their branch."
        );
      }
    }
    if (
      action.type === "class.update" ||
      action.type === "class.status.update"
    ) {
      const group = state.classGroups.find(
        item => item.id === action.classGroupId
      );
      const run = state.courseRuns.find(item => item.id === group?.courseRunId);
      if (!group || !run || !branchIds.has(run.branchId)) {
        throw new Error(
          "Branch admin can only update classes in their branch."
        );
      }
    }
    if (action.type === "notification.read") {
      const notification = state.notifications.find(
        item => item.id === action.notificationId
      );
      if (notification?.userId !== session.userId)
        throw new Error(
          "Branch admin can only mark own notifications as read."
        );
    }
  }

  if (session.activeRole === "headofdepartment") {
    if (action.type === "curriculum.module.create") {
      if (!hodOwnsCourse(state, session, action.courseId)) {
        throw new Error(
          "HOD can only create curriculum modules in their department."
        );
      }
    }
    if (action.type === "course.status.update") {
      if (!hodOwnsCourse(state, session, action.courseId)) {
        throw new Error(
          "HOD can only update course status in their department."
        );
      }
    }
    if (action.type === "class.create") {
      const run = state.courseRuns.find(item => item.id === action.courseRunId);
      if (!hodOwnsCourseRun(state, session, run)) {
        throw new Error("HOD can only create classes in their department.");
      }
    }
    if (action.type === "course-run.create") {
      if (!hodOwnsCourse(state, session, action.courseId)) {
        throw new Error("HOD can only create course runs in their department.");
      }
      const profile = activeStaffProfileForSession(state, session);
      if (
        !profile ||
        (!profile.branchIds.includes("br_global") &&
          !profile.branchIds.includes(action.branchId))
      ) {
        throw new Error(
          "HOD can only create course runs in their branch scope."
        );
      }
    }
    if (
      action.type === "class.update" ||
      action.type === "class.status.update"
    ) {
      const group = state.classGroups.find(
        item => item.id === action.classGroupId
      );
      const run = state.courseRuns.find(item => item.id === group?.courseRunId);
      if (!group || !hodOwnsCourseRun(state, session, run)) {
        throw new Error("HOD can only update classes in their department.");
      }
    }
    if (
      action.type === "certificate.approve" ||
      action.type === "certificate.issue" ||
      action.type === "certificate.reject"
    ) {
      if (!hodOwnsCertificate(state, session, action.certificateId)) {
        throw new Error(
          "HOD can only manage certificates in their department."
        );
      }
    }
    if (
      action.type === "assignment.create" ||
      action.type === "quiz.create" ||
      action.type === "question.create"
    ) {
      const run = state.courseRuns.find(item => item.id === action.courseRunId);
      if (!hodOwnsCourseRun(state, session, run))
        throw new Error("HOD can only create assessments in their department.");
    }
    if (
      action.type === "assignment.update" ||
      action.type === "assignment.status.update"
    ) {
      const run = courseRunForAssignment(state, action.assignmentId);
      if (!hodOwnsCourseRun(state, session, run)) {
        throw new Error("HOD can only manage assignments in their department.");
      }
    }
    if (action.type === "quiz.update" || action.type === "quiz.status.update") {
      const run = courseRunForQuiz(state, action.quizId);
      if (!hodOwnsCourseRun(state, session, run)) {
        throw new Error("HOD can only manage quizzes in their department.");
      }
    }
    if (action.type === "quiz.questions.set") {
      const run = courseRunForQuiz(state, action.quizId);
      if (!hodOwnsCourseRun(state, session, run))
        throw new Error("HOD can only attach questions to department quizzes.");
    }
    if (action.type === "assignment.grade") {
      const submission = state.assignmentSubmissions.find(
        item => item.id === action.submissionId
      );
      const assignment = state.assignments.find(
        item => item.id === submission?.assignmentId
      );
      const run = state.courseRuns.find(
        item => item.id === assignment?.courseRunId
      );
      if (!hodOwnsCourseRun(state, session, run))
        throw new Error(
          "HOD can only grade department assignment submissions."
        );
    }
    if (action.type === "quiz.review") {
      const attempt = state.quizAttempts.find(
        item => item.id === action.attemptId
      );
      const run = courseRunForQuiz(state, attempt?.quizId ?? "");
      if (!hodOwnsCourseRun(state, session, run))
        throw new Error("HOD can only review department quiz attempts.");
    }
    if (action.type === "quran.progress.update") {
      const record = state.quranProgress.find(
        item => item.id === action.recordId
      );
      if (!record || !hodOwnsStudent(state, session, record.studentId))
        throw new Error(
          "HOD can only update Quran progress in their department."
        );
    }
    if (action.type === "recitation.review") {
      const submission = state.recitationSubmissions.find(
        item => item.id === action.submissionId
      );
      if (!submission || !hodOwnsStudent(state, session, submission.studentId))
        throw new Error("HOD can only review department recitations.");
    }
    if (action.type === "notification.read") {
      const notification = state.notifications.find(
        item => item.id === action.notificationId
      );
      if (notification?.userId !== session.userId)
        throw new Error("HOD can only mark own notifications as read.");
    }
  }

  if (session.activeRole === "registrar") {
    const branchIds = branchIdsForSessionScope(state, session);
    if (
      action.type === "application.create" &&
      !branchIds.has(action.branchId)
    ) {
      throw new Error(
        "Registrar can only create applications inside admissions branches."
      );
    }
    if (
      action.type === "placement.create" &&
      action.branchId &&
      !branchIds.has(action.branchId)
    ) {
      throw new Error(
        "Registrar can only book placement tests inside admissions branches."
      );
    }
    if (action.type === "placement.result.record") {
      const booking = state.placementTests.find(
        item => item.id === action.bookingId
      );
      if (!booking || (booking.branchId && !branchIds.has(booking.branchId))) {
        throw new Error(
          "Registrar can only record placement results inside admissions branches."
        );
      }
      if (action.score < 0 || action.score > 100) {
        throw new Error("Placement score must be between 0 and 100.");
      }
    }
    if (action.type === "lead.convert") {
      const lead = state.leads.find(item => item.id === action.leadId);
      if (!lead) throw new Error(`Lead ${action.leadId} was not found.`);
      if (action.branchId && !branchIds.has(action.branchId)) {
        throw new Error(
          "Registrar can only convert leads inside admissions branches."
        );
      }
    }
    if (action.type === "application.convert") {
      const application = state.applications.find(
        item => item.id === action.applicationId
      );
      if (
        !application ||
        (application.branchId && !branchIds.has(application.branchId))
      ) {
        throw new Error(
          "Registrar can only convert applications inside admissions branches."
        );
      }
    }
    if (action.type === "student.create") {
      const courseRun = state.courseRuns.find(
        item => item.id === action.courseRunId
      );
      const classGroup = state.classGroups.find(
        item => item.id === action.classGroupId
      );
      const application = action.applicationId
        ? state.applications.find(item => item.id === action.applicationId)
        : undefined;
      const placement = action.placementTestId
        ? state.placementTests.find(item => item.id === action.placementTestId)
        : undefined;
      if (
        !branchIds.has(action.branchId) ||
        !courseRun ||
        !branchIds.has(courseRun.branchId)
      ) {
        throw new Error(
          "Registrar can only create students inside admissions branches."
        );
      }
      if (!classGroup || classGroup.courseRunId !== courseRun.id) {
        throw new Error("Registrar can only assign a matching class group.");
      }
      if (
        action.applicationId &&
        (!application || !branchIds.has(application.branchId))
      ) {
        throw new Error(
          "Registrar can only use applications inside admissions branches."
        );
      }
      if (
        action.placementTestId &&
        (!placement || !branchIds.has(placement.branchId))
      ) {
        throw new Error(
          "Registrar can only use placement tests inside admissions branches."
        );
      }
      assertStudentIntakeLineage(state, action);
    }
    if (action.type === "student.status.update") {
      const student = state.students.find(item => item.id === action.studentId);
      const studentUser = state.users.find(item => item.id === student?.userId);
      if (!student || !branchIds.has(studentUser?.branchId ?? "")) {
        throw new Error(
          "Registrar can only update students inside admissions branches."
        );
      }
      const enrollmentBranchIds = state.enrollments
        .filter(item => item.studentId === student.id)
        .map(
          item =>
            state.courseRuns.find(run => run.id === item.courseRunId)?.branchId
        );
      if (
        enrollmentBranchIds.some(
          branchId => !branchId || !branchIds.has(branchId)
        )
      ) {
        throw new Error(
          "Registrar cannot update a student whose enrollments extend outside admissions branch scope."
        );
      }
    }
    if (action.type === "student.document.add") {
      const student = state.students.find(item => item.id === action.studentId);
      const studentUser = state.users.find(item => item.id === student?.userId);
      if (!student || !branchIds.has(studentUser?.branchId ?? "")) {
        throw new Error(
          "Registrar can only add student documents inside admissions branches."
        );
      }
    }
    if (
      action.type === "payment.record" &&
      !branchIds.has(branchForInvoice(state, action.invoiceId) ?? "")
    ) {
      throw new Error(
        "Registrar can only record payments inside admissions branches."
      );
    }
    if (action.type === "enrollment.activate") {
      const workflow = state.enrollmentWorkflows.find(
        item => item.id === action.workflowId
      );
      const isInitialActivation = Boolean(workflow && !workflow.studentId);
      if (
        isInitialActivation &&
        (!action.courseRunId || !action.classGroupId)
      ) {
        throw new Error(
          "Enrollment activation requires an exact course run and class group."
        );
      }
      const exactCourseRunId = isInitialActivation
        ? action.courseRunId
        : (action.courseRunId ?? workflow?.courseRunId);
      const exactClassGroupId = isInitialActivation
        ? action.classGroupId
        : (action.classGroupId ?? workflow?.classGroupId);
      const courseRun = exactCourseRunId
        ? state.courseRuns.find(
            item =>
              item.id === exactCourseRunId &&
              item.courseId === workflow?.targetCourseId
          )
        : undefined;
      const classGroup = exactClassGroupId
        ? state.classGroups.find(item => item.id === exactClassGroupId)
        : undefined;
      if (!workflow || !courseRun || !branchIds.has(courseRun.branchId)) {
        throw new Error(
          "Registrar can only activate enrollments inside admissions branches."
        );
      }
      if (
        exactClassGroupId &&
        (!classGroup || classGroup.courseRunId !== courseRun.id)
      ) {
        throw new Error("Registrar can only assign a matching class group.");
      }
    }
    if (
      action.type === "enrollment.transfer" ||
      action.type === "enrollment.status.update"
    ) {
      const enrollment = state.enrollments.find(
        item => item.id === action.enrollmentId
      );
      const sourceRun = state.courseRuns.find(
        item => item.id === enrollment?.courseRunId
      );
      if (!enrollment || !sourceRun || !branchIds.has(sourceRun.branchId)) {
        throw new Error(
          "Registrar can only manage enrollments inside admissions branches."
        );
      }
      if (action.type === "enrollment.transfer") {
        const targetGroup = state.classGroups.find(
          item => item.id === action.classGroupId
        );
        const targetRun = state.courseRuns.find(
          item => item.id === targetGroup?.courseRunId
        );
        if (!targetGroup || !targetRun || !branchIds.has(targetRun.branchId)) {
          throw new Error(
            "Registrar can only transfer enrollments inside admissions branches."
          );
        }
      }
      if (action.type === "enrollment.status.update") {
        const studentEnrollmentBranchIds = state.enrollments
          .filter(item => item.studentId === enrollment.studentId)
          .map(
            item =>
              state.courseRuns.find(run => run.id === item.courseRunId)
                ?.branchId
          );
        if (
          studentEnrollmentBranchIds.some(
            branchId => !branchId || !branchIds.has(branchId)
          )
        ) {
          throw new Error(
            "Registrar cannot update an enrollment when the student has enrollments outside admissions branch scope."
          );
        }
      }
    }
    if (action.type === "calendar.create") {
      const allowedTypes = new Set<CalendarEventType>([
        "placement_test",
        "trial_lesson",
        "room_booking",
        "reminder",
      ]);
      const room = action.roomId
        ? state.rooms.find(item => item.id === action.roomId)
        : undefined;
      if (!branchIds.size)
        throw new Error("Registrar calendar scope is not configured.");
      if (!allowedTypes.has(action.eventType))
        throw new Error(
          "Registrar can only schedule admissions calendar items."
        );
      if (action.classGroupId)
        throw new Error(
          "Registrar cannot schedule class groups from this workspace."
        );
      if (!action.branchId)
        throw new Error("Registrar calendar events require a branch.");
      if (action.branchId && !branchIds.has(action.branchId))
        throw new Error(
          "Registrar can only schedule inside admissions branches."
        );
      if (action.roomId && (!room || !branchIds.has(room.branchId)))
        throw new Error(
          "Registrar can only book rooms inside admissions branches."
        );
    }
    if (action.type === "notification.read") {
      const notification = state.notifications.find(
        item => item.id === action.notificationId
      );
      if (notification?.userId !== session.userId)
        throw new Error("Registrar can only mark own notifications as read.");
    }
  }

  if (action.type === "message.send") {
    const recipientUserIds = Array.from(
      new Set([action.toUserId, ...(action.recipientUserIds ?? [])])
    ).filter(Boolean);
    if (
      recipientUserIds.some(
        userId => !canMessageRecipient(state, session, userId)
      )
    ) {
      throw new Error("Message recipient is outside this role scope.");
    }

    if (action.replyToMessageId) {
      const replyTarget = state.messages.find(
        item => item.id === action.replyToMessageId
      );
      if (!replyTarget) {
        throw new Error("The selected message is no longer available.");
      }
      const counterpartUserId =
        replyTarget.fromUserId === session.userId
          ? replyTarget.toUserId
          : replyTarget.fromUserId;
      const continuesSelectedConversation =
        (replyTarget.fromUserId === session.userId ||
          replyTarget.toUserId === session.userId) &&
        recipientUserIds.length === 1 &&
        recipientUserIds[0] === counterpartUserId;
      if (!continuesSelectedConversation) {
        throw new Error("The reply must stay in the selected conversation.");
      }
    }
  }

  if (action.type === "message.read") {
    const message = state.messages.find(item => item.id === action.messageId);
    if (message?.toUserId !== session.userId) {
      throw new Error("You can only mark received messages as read.");
    }
  }
}

function applyServerActor(
  action: PlatformWorkflowAction,
  session: ServerSession,
  state: PlatformState
): PlatformWorkflowAction {
  const actorId = session.userId;
  const user = userForSession(state, session);
  switch (action.type) {
    case "lesson.start":
    case "lesson.complete":
    case "assignment.submit":
    case "quiz.submit":
      return {
        ...action,
        studentId: requireStudentIdForSession(state, session),
        actorId,
      };
    case "recitation.submit":
      return {
        ...action,
        studentId: requireStudentIdForSession(state, session),
        actorId,
      };
    case "attendance.exception.submit":
      return {
        ...action,
        studentId: requireStudentIdForSession(state, session),
        actorId,
      };
    case "message.send":
      return { ...action, fromUserId: actorId, actorId };
    case "profile.update":
      return { ...action, userId: action.userId ?? actorId, actorId };
    case "calendar.create": {
      const branchIds = branchIdsForSessionScope(state, session);
      const defaultBranchId =
        user?.branchId && branchIds.has(user.branchId)
          ? user.branchId
          : branchIds.size === 1
            ? Array.from(branchIds)[0]
            : undefined;
      return {
        ...action,
        ownerId: actorId,
        branchId: action.branchId ?? defaultBranchId,
        actorId,
      };
    }
    default:
      return { ...action, actorId };
  }
}

const eventTypes = new Set<CalendarEventType>([
  "class_session",
  "live_session",
  "trial_lesson",
  "placement_test",
  "assignment_due",
  "quiz_due",
  "exam",
  "teacher_availability",
  "room_booking",
  "reminder",
]);

const attendanceStatuses = new Set<AttendanceStatus>([
  "present",
  "late",
  "absent",
  "excused",
]);
const studentIntakeDocumentTypes = new Set<StudentIntakeDocumentType>([
  "profile_photo",
  "passport",
  "national_id",
  "birth_certificate",
  "guardian_id",
  "consent",
]);
const leadSources = new Set<Lead["source"]>([
  "website",
  "trial_form",
  "placement_form",
  "whatsapp",
  "manual",
]);
const communicationChannels = new Set<CommunicationLog["channel"]>([
  "in_app",
  "email",
  "whatsapp",
  "phone",
  "manual",
]);
const reportTypes = new Set(["enrollments", "attendance", "finance", "audit"]);
const accountStatuses = new Set(["active", "pending", "paused"]);
const studentStatuses = new Set<StudentStatus>([
  "lead",
  "trial_booked",
  "placement_booked",
  "placement_completed",
  "ready_to_enroll",
  "enrolled",
  "active",
  "paused",
  "completed",
  "cancelled",
]);
const studentCreateStatuses = new Set<StudentStatus>([
  "ready_to_enroll",
  "enrolled",
  "active",
  "paused",
]);
const studentEntrySources = new Set<StudentEntrySource>([
  "direct",
  "lead",
  "application",
  "placement",
]);
const staffRoles = new Set<StaffRole>([
  "teacher",
  "registrar",
  "headofdepartment",
  "branchadmin",
  "superadmin",
]);
const staffPermissionScopes = new Set<StaffPermissionScope>([
  "department",
  "branch",
  "admissions",
  "operations",
  "global",
]);
const staffAvailabilityStatuses = new Set<StaffAvailabilityStatus>([
  "available",
  "limited",
  "unavailable",
  "not_applicable",
]);
const knownPermissions = new Set<Permission>(
  Object.values(rolePermissions).flatMap(permissions => permissions)
);
const integrationStatuses = new Set<IntegrationStatus>([
  "not_configured",
  "mock_mode",
  "connected",
  "error",
]);
const integrationIds = new Set<IntegrationConfig["id"]>([
  "supabase",
  "moodle",
  "ems",
  "email",
  "whatsapp",
  "meeting",
  "payment",
  "jotform",
]);

function stringValue(input: Record<string, unknown>, key: string) {
  return typeof input[key] === "string" ? input[key] : "";
}

function optionalStringValue(input: Record<string, unknown>, key: string) {
  return typeof input[key] === "string" && input[key] ? input[key] : undefined;
}

function numberValue(input: Record<string, unknown>, key: string) {
  return typeof input[key] === "number" && Number.isFinite(input[key])
    ? input[key]
    : Number(input[key]);
}

function stringArrayValue(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function stringRecordValue(value: unknown) {
  if (!value || typeof value !== "object") return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string"
    )
  );
}

function notificationPreferencesValue(
  value: unknown
): Partial<UserNotificationPreferences> | undefined {
  if (!value || typeof value !== "object") return undefined;
  const preferences = Object.fromEntries(
    Object.entries(value as Record<string, unknown>).filter(
      (entry): entry is [keyof UserNotificationPreferences, boolean] =>
        ["messages", "schedule", "academic", "billing", "system"].includes(
          entry[0]
        ) && typeof entry[1] === "boolean"
    )
  );
  return Object.keys(preferences).length ? preferences : undefined;
}

function messageAttachmentsValue(
  value: unknown
): MessageAttachment[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const attachments = value
    .slice(0, 6)
    .map(item => {
      if (!item || typeof item !== "object") return null;
      const record = item as Record<string, unknown>;
      const name = typeof record.name === "string" ? record.name.trim() : "";
      const type = typeof record.type === "string" ? record.type.trim() : "";
      const size =
        typeof record.size === "number" && Number.isFinite(record.size)
          ? record.size
          : Number(record.size);
      const kind: MessageAttachment["kind"] | "" =
        record.kind === "image"
          ? "image"
          : record.kind === "document"
            ? "document"
            : "";
      const previewLabel =
        typeof record.previewLabel === "string"
          ? record.previewLabel.trim()
          : name;
      if (!name || !type || !kind || !Number.isFinite(size) || size < 0)
        return null;
      return {
        name: name.slice(0, 120),
        type: type.slice(0, 80),
        size,
        kind,
        previewLabel: previewLabel.slice(0, 140),
      };
    })
    .filter((item): item is MessageAttachment => Boolean(item));
  return attachments.length ? attachments : undefined;
}

function pendingMediaValue(
  value: unknown
): PendingMediaAttachment[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const attachments = value
    .slice(0, 3)
    .map(item => {
      if (!item || typeof item !== "object") return null;
      const record = item as Record<string, unknown>;
      const id = typeof record.id === "string" ? record.id.trim() : "";
      const name = typeof record.name === "string" ? record.name.trim() : "";
      const type = typeof record.type === "string" ? record.type.trim() : "";
      const size =
        typeof record.size === "number" && Number.isFinite(record.size)
          ? record.size
          : Number(record.size);
      const kind =
        record.kind === "document" ||
        record.kind === "image" ||
        record.kind === "audio" ||
        record.kind === "video"
          ? record.kind
          : "";
      const previewLabel =
        typeof record.previewLabel === "string"
          ? record.previewLabel.trim()
          : name;
      const createdAt =
        typeof record.createdAt === "string" ? record.createdAt : now();
      if (
        !id ||
        !name ||
        !type ||
        !kind ||
        !previewLabel ||
        !Number.isFinite(size) ||
        size <= 0 ||
        size > 25 * 1024 * 1024
      ) {
        return null;
      }
      return {
        id: id.slice(0, 80),
        name: name.slice(0, 120),
        type: type.slice(0, 120),
        size,
        kind,
        previewLabel: previewLabel.slice(0, 160),
        storageStatus: "pending_storage" as const,
        createdAt,
      };
    })
    .filter((item): item is PendingMediaAttachment => Boolean(item));
  return attachments.length ? attachments : undefined;
}

function recipientUserIdsValue(value: unknown) {
  if (!Array.isArray(value)) return undefined;
  const userIds = Array.from(
    new Set(
      value
        .map(item => (typeof item === "string" ? item.trim() : ""))
        .filter(Boolean)
    )
  ).slice(0, 500);
  return userIds.length ? userIds : undefined;
}

function attendanceRecordValue(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const entries = Object.entries(value as Record<string, unknown>);
  if (!entries.length) return null;
  if (
    !entries.every(
      (entry): entry is [string, AttendanceStatus] =>
        typeof entry[1] === "string" &&
        attendanceStatuses.has(entry[1] as AttendanceStatus)
    )
  ) {
    return null;
  }
  return Object.fromEntries(entries);
}

export function parsePlatformWorkflowAction(
  value: unknown
): PlatformWorkflowAction | null {
  if (!value || typeof value !== "object") return null;
  const input = value as Record<string, unknown>;
  const type = input.type;

  if (
    (type === "lesson.start" || type === "lesson.complete") &&
    typeof input.lessonId === "string"
  ) {
    const enrollmentId =
      typeof input.enrollmentId === "string"
        ? input.enrollmentId.trim()
        : undefined;
    if (input.enrollmentId !== undefined && !enrollmentId) return null;
    return {
      type,
      lessonId: input.lessonId,
      enrollmentId,
      studentId:
        typeof input.studentId === "string" ? input.studentId : undefined,
      actorId: typeof input.actorId === "string" ? input.actorId : undefined,
    };
  }

  if (
    type === "assignment.submit" &&
    typeof input.assignmentId === "string" &&
    typeof input.response === "string"
  ) {
    return {
      type,
      assignmentId: input.assignmentId,
      response: input.response,
      pendingMedia: pendingMediaValue(input.pendingMedia),
      studentId:
        typeof input.studentId === "string" ? input.studentId : undefined,
      actorId: typeof input.actorId === "string" ? input.actorId : undefined,
    };
  }

  if (
    type === "quiz.submit" &&
    typeof input.quizId === "string" &&
    input.answers &&
    typeof input.answers === "object"
  ) {
    const answers = stringRecordValue(input.answers);
    return {
      type,
      quizId: input.quizId,
      answers,
      pendingMedia: pendingMediaValue(input.pendingMedia),
      studentId:
        typeof input.studentId === "string" ? input.studentId : undefined,
      actorId: typeof input.actorId === "string" ? input.actorId : undefined,
    };
  }

  if (type === "quiz.review") {
    const attemptId = stringValue(input, "attemptId");
    const score = numberValue(input, "score");
    const feedback = stringValue(input, "feedback");
    if (!attemptId || !Number.isFinite(score) || !feedback) return null;
    return { type, attemptId, score, feedback };
  }

  if (type === "lead.create") {
    const fullName = stringValue(input, "fullName");
    const email = stringValue(input, "email");
    const phone = stringValue(input, "phone");
    const subject = stringValue(input, "subject");
    if (!fullName || !email || !phone || !subject) return null;
    return {
      type,
      fullName,
      email,
      phone,
      subject,
      notes: optionalStringValue(input, "notes"),
      country: optionalStringValue(input, "country"),
      source: leadSources.has(input.source as Lead["source"])
        ? (input.source as Lead["source"])
        : undefined,
    };
  }

  if (type === "application.create") {
    const fullName = stringValue(input, "fullName");
    const email = stringValue(input, "email");
    const phone = stringValue(input, "phone");
    const branchId = stringValue(input, "branchId");
    const courseInterest = stringValue(input, "courseInterest");
    const schedulePreference = stringValue(input, "schedulePreference");
    if (
      !fullName ||
      !email ||
      !phone ||
      !branchId ||
      !courseInterest ||
      !schedulePreference
    )
      return null;
    return {
      type,
      fullName,
      email,
      phone,
      branchId,
      courseInterest,
      schedulePreference,
      notes: optionalStringValue(input, "notes"),
      country: optionalStringValue(input, "country"),
      source: leadSources.has(input.source as Lead["source"])
        ? (input.source as Lead["source"])
        : undefined,
    };
  }

  if (type === "placement.create") {
    const fullName = stringValue(input, "fullName");
    const email = stringValue(input, "email");
    const phone = stringValue(input, "phone");
    const subject = stringValue(input, "subject");
    const preferredDate = stringValue(input, "preferredDate");
    const currentLevel = stringValue(input, "currentLevel");
    if (
      !fullName ||
      !email ||
      !phone ||
      !subject ||
      !preferredDate ||
      !currentLevel
    )
      return null;
    return {
      type,
      fullName,
      email,
      phone,
      subject,
      preferredDate,
      currentLevel,
      branchId: optionalStringValue(input, "branchId"),
      leadId: optionalStringValue(input, "leadId"),
    };
  }

  if (type === "curriculum.module.create") {
    const courseId = stringValue(input, "courseId");
    const title = stringValue(input, "title");
    const outcomes = stringArrayValue(input.outcomes);
    if (!courseId || !title) return null;
    return { type, courseId, title, outcomes };
  }

  if (type === "course.status.update") {
    const courseId = stringValue(input, "courseId");
    const status = stringValue(input, "status");
    const courseStatuses = new Set(["draft", "active", "paused", "completed"]);
    if (!courseId || !courseStatuses.has(status)) return null;
    return {
      type,
      courseId,
      status: status as Extract<
        PlatformWorkflowAction,
        { type: "course.status.update" }
      >["status"],
    };
  }

  if (type === "material.publish.update") {
    const id = stringValue(input, "id");
    if (!id || typeof input.published !== "boolean") return null;
    return { type, id, published: input.published };
  }

  if (type === "record.save") {
    const module = stringValue(input, "module").trim();
    const payload = stringRecordValue(input.payload);
    if (!module) return null;
    return { type, module, payload };
  }

  if (type === "user.create") {
    const name = stringValue(input, "name");
    const email = stringValue(input, "email");
    const phone = stringValue(input, "phone");
    const role = stringValue(input, "role");
    const status = optionalStringValue(input, "status");
    const validAccountStatuses = new Set(["active", "pending", "paused"]);
    if (!name || !email || !phone || !role || !roleOrder.includes(role as Role))
      return null;
    if (status && !validAccountStatuses.has(status)) return null;
    return {
      type,
      name,
      email,
      phone,
      role: role as Role,
      branchId: optionalStringValue(input, "branchId"),
      departmentId: optionalStringValue(input, "departmentId"),
      status: status as Extract<
        PlatformWorkflowAction,
        { type: "user.create" }
      >["status"],
      preferredLanguage: optionalStringValue(input, "preferredLanguage"),
      courseRunId: optionalStringValue(input, "courseRunId"),
      classGroupId: optionalStringValue(input, "classGroupId"),
      currentLevel: optionalStringValue(input, "currentLevel"),
      ageGroup: optionalStringValue(input, "ageGroup"),
      guardianName: optionalStringValue(input, "guardianName"),
      guardianPhone: optionalStringValue(input, "guardianPhone"),
      subjects: stringArrayValue(input.subjects),
      specialization: stringArrayValue(input.specialization),
      availability: stringArrayValue(input.availability),
      notes: optionalStringValue(input, "notes"),
    };
  }

  if (type === "staff.user.create") {
    const name = stringValue(input, "name");
    const email = stringValue(input, "email");
    const role = stringValue(input, "role");
    const status = optionalStringValue(input, "status");
    const permissionScope = optionalStringValue(input, "permissionScope");
    const availabilityStatus = optionalStringValue(input, "availabilityStatus");
    if (!name || !email || !staffRoles.has(role as StaffRole)) return null;
    if (status && !accountStatuses.has(status)) return null;
    if (
      permissionScope &&
      !staffPermissionScopes.has(permissionScope as StaffPermissionScope)
    )
      return null;
    if (
      availabilityStatus &&
      !staffAvailabilityStatuses.has(
        availabilityStatus as StaffAvailabilityStatus
      )
    )
      return null;
    return {
      type,
      name,
      email,
      phone: optionalStringValue(input, "phone"),
      role: role as StaffRole,
      branchId: optionalStringValue(input, "branchId"),
      departmentId: optionalStringValue(input, "departmentId"),
      status: status as Extract<
        PlatformWorkflowAction,
        { type: "staff.user.create" }
      >["status"],
      permissionScope: permissionScope as Extract<
        PlatformWorkflowAction,
        { type: "staff.user.create" }
      >["permissionScope"],
      subjects: stringArrayValue(input.subjects),
      teachingLevels: stringArrayValue(input.teachingLevels),
      availabilityStatus: availabilityStatus as Extract<
        PlatformWorkflowAction,
        { type: "staff.user.create" }
      >["availabilityStatus"],
      operationalScope: stringArrayValue(input.operationalScope),
      notes: optionalStringValue(input, "notes"),
    };
  }

  if (type === "student.create") {
    const fullName = stringValue(input, "fullName");
    const email = stringValue(input, "email");
    const phone = stringValue(input, "phone");
    const branchId = stringValue(input, "branchId");
    const preferredLanguage = stringValue(input, "preferredLanguage");
    const courseInterest = stringValue(input, "courseInterest");
    const ageGroup = stringValue(input, "ageGroup");
    const courseRunId = stringValue(input, "courseRunId");
    const classGroupId = stringValue(input, "classGroupId");
    const status = optionalStringValue(input, "status");
    const source = optionalStringValue(input, "source");
    if (
      !fullName ||
      !email ||
      !phone ||
      !branchId ||
      !preferredLanguage ||
      !courseInterest ||
      !ageGroup ||
      !courseRunId ||
      !classGroupId
    ) {
      return null;
    }
    if (status && !studentCreateStatuses.has(status as StudentStatus))
      return null;
    if (source && !studentEntrySources.has(source as StudentEntrySource))
      return null;
    return {
      type,
      fullName,
      email,
      phone,
      branchId,
      preferredLanguage,
      courseInterest,
      ageGroup,
      guardianName: optionalStringValue(input, "guardianName"),
      guardianPhone: optionalStringValue(input, "guardianPhone"),
      currentLevel: optionalStringValue(input, "currentLevel"),
      placementResult: optionalStringValue(input, "placementResult"),
      status: status as Extract<
        PlatformWorkflowAction,
        { type: "student.create" }
      >["status"],
      notes: optionalStringValue(input, "notes"),
      courseRunId,
      classGroupId,
      source: source as Extract<
        PlatformWorkflowAction,
        { type: "student.create" }
      >["source"],
      leadId: optionalStringValue(input, "leadId"),
      applicationId: optionalStringValue(input, "applicationId"),
      placementTestId: optionalStringValue(input, "placementTestId"),
    };
  }

  if (type === "student.document.add") {
    const studentId = stringValue(input, "studentId");
    const documentType = stringValue(input, "documentType");
    const attachment = pendingMediaValue([input.attachment])?.[0];
    if (
      !studentId ||
      !studentIntakeDocumentTypes.has(
        documentType as StudentIntakeDocumentType
      ) ||
      !attachment
    ) {
      return null;
    }
    return {
      type,
      studentId,
      documentType: documentType as StudentIntakeDocumentType,
      attachment,
    };
  }

  if (type === "student.status.update") {
    const studentId = stringValue(input, "studentId");
    const status = stringValue(input, "status");
    if (!studentId || !studentStatuses.has(status as StudentStatus))
      return null;
    return {
      type,
      studentId,
      status: status as Extract<
        PlatformWorkflowAction,
        { type: "student.status.update" }
      >["status"],
      notes: optionalStringValue(input, "notes"),
    };
  }

  if (type === "profile.update") {
    const availabilityStatus = optionalStringValue(input, "availabilityStatus");
    if (
      availabilityStatus &&
      !staffAvailabilityStatuses.has(
        availabilityStatus as StaffAvailabilityStatus
      )
    )
      return null;
    return {
      type,
      userId: optionalStringValue(input, "userId"),
      name: typeof input.name === "string" ? input.name : undefined,
      phone: typeof input.phone === "string" ? input.phone : undefined,
      preferredLanguage:
        typeof input.preferredLanguage === "string"
          ? input.preferredLanguage
          : undefined,
      timezone: typeof input.timezone === "string" ? input.timezone : undefined,
      notificationPreferences: notificationPreferencesValue(
        input.notificationPreferences
      ),
      country: typeof input.country === "string" ? input.country : undefined,
      guardianName:
        typeof input.guardianName === "string" ? input.guardianName : undefined,
      guardianPhone:
        typeof input.guardianPhone === "string"
          ? input.guardianPhone
          : undefined,
      title: typeof input.title === "string" ? input.title : undefined,
      availabilityStatus: availabilityStatus as Extract<
        PlatformWorkflowAction,
        { type: "profile.update" }
      >["availabilityStatus"],
    };
  }

  if (type === "user.update") {
    const userId = stringValue(input, "userId");
    const activeRole = optionalStringValue(input, "activeRole");
    const status = optionalStringValue(input, "status");
    const roles = stringArrayValue(input.roles).filter((role): role is Role =>
      roleOrder.includes(role as Role)
    );
    const validAccountStatuses = new Set(["active", "pending", "paused"]);
    if (!userId) return null;
    if (activeRole && !roleOrder.includes(activeRole as Role)) return null;
    if (status && !validAccountStatuses.has(status)) return null;
    return {
      type,
      userId,
      activeRole: activeRole as Extract<
        PlatformWorkflowAction,
        { type: "user.update" }
      >["activeRole"],
      roles: roles.length ? roles : undefined,
      branchId: optionalStringValue(input, "branchId"),
      departmentId: optionalStringValue(input, "departmentId"),
      status: status as Extract<
        PlatformWorkflowAction,
        { type: "user.update" }
      >["status"],
    };
  }

  if (type === "permission.update") {
    const role = stringValue(input, "role");
    const permission = stringValue(input, "permission");
    const granted = input.granted;
    if (
      !roleOrder.includes(role as Role) ||
      !knownPermissions.has(permission as Permission) ||
      typeof granted !== "boolean"
    )
      return null;
    return {
      type,
      role: role as Role,
      permission: permission as Permission,
      granted,
    };
  }

  if (type === "branch.update") {
    const branchId = stringValue(input, "branchId");
    const status = stringValue(input, "status");
    if (!branchId || !accountStatuses.has(status)) return null;
    return {
      type,
      branchId,
      status: status as Extract<
        PlatformWorkflowAction,
        { type: "branch.update" }
      >["status"],
    };
  }

  if (type === "room.status.update") {
    const roomId = stringValue(input, "roomId");
    const status = stringValue(input, "status");
    if (!roomId || !accountStatuses.has(status)) return null;
    return {
      type,
      roomId,
      status: status as Extract<
        PlatformWorkflowAction,
        { type: "room.status.update" }
      >["status"],
    };
  }

  if (type === "room.create") {
    const branchId = stringValue(input, "branchId");
    const name = stringValue(input, "name");
    const capacity = numberValue(input, "capacity");
    if (!branchId || !name || !Number.isFinite(capacity)) return null;
    return {
      type,
      branchId,
      name,
      capacity,
      equipment: stringArrayValue(input.equipment),
    };
  }

  if (type === "class.create") {
    const courseRunId = stringValue(input, "courseRunId");
    const name = stringValue(input, "name");
    const capacity = numberValue(input, "capacity");
    const schedule = stringValue(input, "schedule");
    const roomId = stringValue(input, "roomId");
    if (
      !courseRunId ||
      !name ||
      !Number.isFinite(capacity) ||
      !schedule ||
      !roomId
    ) {
      return null;
    }
    return { type, courseRunId, name, capacity, schedule, roomId };
  }

  if (type === "course-run.create") {
    const courseId = stringValue(input, "courseId");
    const branchId = stringValue(input, "branchId");
    const teacherId = stringValue(input, "teacherId");
    const term = stringValue(input, "term");
    const startsOn = stringValue(input, "startsOn");
    const endsOn = stringValue(input, "endsOn");
    const status = optionalStringValue(input, "status");
    if (!courseId || !branchId || !teacherId || !term || !startsOn || !endsOn)
      return null;
    if (status && !new Set(["pending", "active"]).has(status)) return null;
    return {
      type,
      courseId,
      branchId,
      teacherId,
      term,
      startsOn,
      endsOn,
      status: status as Extract<
        PlatformWorkflowAction,
        { type: "course-run.create" }
      >["status"],
    };
  }

  if (type === "class.update") {
    const classGroupId = stringValue(input, "classGroupId");
    const name = stringValue(input, "name");
    const capacity = numberValue(input, "capacity");
    const schedule = stringValue(input, "schedule");
    const roomId = stringValue(input, "roomId");
    if (
      !classGroupId ||
      !name ||
      !Number.isFinite(capacity) ||
      !schedule ||
      !roomId
    )
      return null;
    return { type, classGroupId, name, capacity, schedule, roomId };
  }

  if (type === "class.status.update") {
    const classGroupId = stringValue(input, "classGroupId");
    const status = stringValue(input, "status");
    if (
      !classGroupId ||
      !new Set(["active", "paused", "completed", "cancelled"]).has(status)
    )
      return null;
    return {
      type,
      classGroupId,
      status: status as Extract<
        PlatformWorkflowAction,
        { type: "class.status.update" }
      >["status"],
    };
  }

  if (type === "integration.status.update") {
    const integrationId = stringValue(input, "integrationId");
    const status = stringValue(input, "status");
    if (
      !integrationIds.has(integrationId as IntegrationConfig["id"]) ||
      !integrationStatuses.has(status as IntegrationStatus)
    )
      return null;
    return {
      type,
      integrationId: integrationId as IntegrationConfig["id"],
      status: status as IntegrationStatus,
    };
  }

  if (type === "integration.local_check") {
    const integrationId = stringValue(input, "integrationId");
    if (!integrationIds.has(integrationId as IntegrationConfig["id"]))
      return null;
    return {
      type,
      integrationId: integrationId as IntegrationConfig["id"],
    };
  }

  if (type === "system.health_check") {
    const score = numberValue(input, "score");
    if (!Number.isFinite(score)) return null;
    return {
      type,
      score,
    };
  }

  if (type === "settings.save") {
    const organization = stringValue(input, "organization").trim();
    const defaultLanguage = stringValue(input, "defaultLanguage").trim();
    const academicTerm = stringValue(input, "academicTerm").trim();
    const retentionDays = numberValue(input, "retentionDays");
    if (
      !organization ||
      !defaultLanguage ||
      !academicTerm ||
      !Number.isFinite(retentionDays)
    )
      return null;
    return {
      type,
      organization,
      defaultLanguage,
      academicTerm,
      retentionDays,
    };
  }

  if (type === "portal.settings.save") {
    const role = stringValue(input, "role");
    const scopeId = stringValue(input, "scopeId").trim();
    const label = stringValue(input, "label").trim();
    const language = stringValue(input, "language").trim();
    const timezone = stringValue(input, "timezone").trim();
    const reviewCadenceDays =
      input.reviewCadenceDays === undefined
        ? undefined
        : numberValue(input, "reviewCadenceDays");
    const paymentReminderDays =
      input.paymentReminderDays === undefined
        ? undefined
        : numberValue(input, "paymentReminderDays");
    const attendanceCutoffMinutes =
      input.attendanceCutoffMinutes === undefined
        ? undefined
        : numberValue(input, "attendanceCutoffMinutes");
    if (
      !["registrar", "headofdepartment", "branchadmin"].includes(role) ||
      !scopeId ||
      !label ||
      !language ||
      !timezone
    )
      return null;
    return {
      type,
      role: role as Extract<
        PlatformWorkflowAction,
        { type: "portal.settings.save" }
      >["role"],
      scopeId,
      label,
      language,
      timezone,
      notifications: Boolean(input.notifications),
      reviewCadenceDays,
      paymentReminderDays,
      attendanceCutoffMinutes,
    };
  }

  if (type === "assignment.create") {
    const courseRunId = stringValue(input, "courseRunId");
    const title = stringValue(input, "title");
    const dueAt = stringValue(input, "dueAt");
    const submissionType = stringValue(input, "submissionType");
    if (
      !courseRunId ||
      !title ||
      !dueAt ||
      !["text", "file", "audio", "video"].includes(submissionType)
    )
      return null;
    return {
      type,
      courseRunId,
      title,
      dueAt,
      submissionType: submissionType as "text" | "file" | "audio" | "video",
      rubric: stringArrayValue(input.rubric),
    };
  }

  if (type === "assignment.update") {
    const assignmentId = stringValue(input, "assignmentId");
    const title = stringValue(input, "title");
    const dueAt = stringValue(input, "dueAt");
    const submissionType = stringValue(input, "submissionType");
    if (
      !assignmentId ||
      !title ||
      !dueAt ||
      !["text", "file", "audio", "video"].includes(submissionType)
    ) {
      return null;
    }
    return {
      type,
      assignmentId,
      title,
      dueAt,
      submissionType: submissionType as "text" | "file" | "audio" | "video",
      rubric: stringArrayValue(input.rubric),
    };
  }

  if (type === "assignment.status.update") {
    const assignmentId = stringValue(input, "assignmentId");
    const status = stringValue(input, "status");
    if (
      !assignmentId ||
      !["active", "completed", "cancelled"].includes(status)
    ) {
      return null;
    }
    return {
      type,
      assignmentId,
      status: status as "active" | "completed" | "cancelled",
      reason: optionalStringValue(input, "reason"),
    };
  }

  if (type === "quiz.create") {
    const courseRunId = stringValue(input, "courseRunId");
    const title = stringValue(input, "title");
    const dueAt = stringValue(input, "dueAt");
    const durationMinutes = numberValue(input, "durationMinutes");
    const attemptsAllowed = numberValue(input, "attemptsAllowed");
    if (
      !courseRunId ||
      !title ||
      !dueAt ||
      !Number.isFinite(durationMinutes) ||
      !Number.isFinite(attemptsAllowed)
    )
      return null;
    return {
      type,
      courseRunId,
      title,
      dueAt,
      durationMinutes,
      questionTypes: stringArrayValue(input.questionTypes),
      questionIds: stringArrayValue(input.questionIds),
      attemptsAllowed,
    };
  }

  if (type === "quiz.update") {
    const quizId = stringValue(input, "quizId");
    const title = stringValue(input, "title");
    const dueAt = stringValue(input, "dueAt");
    const durationMinutes = numberValue(input, "durationMinutes");
    const attemptsAllowed = numberValue(input, "attemptsAllowed");
    if (
      !quizId ||
      !title ||
      !dueAt ||
      !Number.isFinite(durationMinutes) ||
      !Number.isFinite(attemptsAllowed)
    ) {
      return null;
    }
    return {
      type,
      quizId,
      title,
      dueAt,
      durationMinutes,
      attemptsAllowed,
    };
  }

  if (type === "quiz.status.update") {
    const quizId = stringValue(input, "quizId");
    const status = stringValue(input, "status");
    if (!quizId || !["active", "completed", "cancelled"].includes(status)) {
      return null;
    }
    return {
      type,
      quizId,
      status: status as "active" | "completed" | "cancelled",
      reason: optionalStringValue(input, "reason"),
    };
  }

  if (type === "quiz.questions.set") {
    const quizId = stringValue(input, "quizId");
    const questionIds = stringArrayValue(input.questionIds);
    if (!quizId) return null;
    return { type, quizId, questionIds };
  }

  if (type === "question.create") {
    const courseRunId = stringValue(input, "courseRunId");
    const prompt = stringValue(input, "prompt");
    const questionType = stringValue(input, "questionType");
    const difficulty = stringValue(input, "difficulty");
    if (!courseRunId || !prompt || !questionType || !difficulty) return null;
    return {
      type,
      courseRunId,
      prompt,
      questionType: questionType as Extract<
        PlatformWorkflowAction,
        { type: "question.create" }
      >["questionType"],
      difficulty: difficulty as Extract<
        PlatformWorkflowAction,
        { type: "question.create" }
      >["difficulty"],
      tags: stringArrayValue(input.tags),
      choices: stringArrayValue(input.choices),
      answerKey: optionalStringValue(input, "answerKey"),
      rubric: stringArrayValue(input.rubric),
    };
  }

  if (type === "assignment.grade") {
    const submissionId = stringValue(input, "submissionId");
    const score = numberValue(input, "score");
    const feedback = stringValue(input, "feedback");
    if (!submissionId || !Number.isFinite(score) || !feedback) return null;
    return { type, submissionId, score, feedback };
  }

  if (type === "attendance.save") {
    const classGroupId = stringValue(input, "classGroupId");
    const sessionId = stringValue(input, "sessionId");
    const statuses = attendanceRecordValue(input.statuses);
    if (!classGroupId || !sessionId || !statuses) return null;
    return {
      type,
      classGroupId,
      sessionId,
      statuses,
      notes: stringRecordValue(input.notes),
    };
  }

  if (type === "attendance.exception.submit") {
    const attendanceRecordId = stringValue(input, "attendanceRecordId");
    const reason = stringValue(input, "reason").trim();
    if (!attendanceRecordId || reason.length < 10) return null;
    return { type, attendanceRecordId, reason };
  }

  if (type === "attendance.exception.review") {
    const requestId = stringValue(input, "requestId");
    const decision = stringValue(input, "decision");
    const reviewNote = stringValue(input, "reviewNote").trim();
    if (
      !requestId ||
      (decision !== "approved" && decision !== "rejected") ||
      reviewNote.length < 5
    )
      return null;
    return {
      type,
      requestId,
      decision,
      reviewNote,
    };
  }

  if (type === "calendar.create") {
    const eventType = stringValue(input, "eventType");
    const title = stringValue(input, "title");
    const startsAt = stringValue(input, "startsAt");
    const endsAt = stringValue(input, "endsAt");
    const ownerId = optionalStringValue(input, "ownerId");
    if (
      !eventTypes.has(eventType as CalendarEventType) ||
      !title ||
      !startsAt ||
      !endsAt
    )
      return null;
    return {
      type,
      eventType: eventType as CalendarEventType,
      title,
      startsAt,
      endsAt,
      ownerId,
      branchId: optionalStringValue(input, "branchId"),
      roomId: optionalStringValue(input, "roomId"),
      classGroupId: optionalStringValue(input, "classGroupId"),
    };
  }

  if (type === "class.session.reschedule") {
    const sessionId = stringValue(input, "sessionId");
    const startsAt = stringValue(input, "startsAt");
    const endsAt = stringValue(input, "endsAt");
    const reason = stringValue(input, "reason").trim();
    if (!sessionId || !startsAt || !endsAt || reason.length < 5) return null;
    return {
      type,
      sessionId,
      startsAt,
      endsAt,
      roomId: optionalStringValue(input, "roomId"),
      reason,
    };
  }

  if (type === "class.session.cancel") {
    const sessionId = stringValue(input, "sessionId");
    const reason = stringValue(input, "reason").trim();
    if (!sessionId || reason.length < 5) return null;
    return { type, sessionId, reason };
  }

  if (type === "message.send") {
    const toUserId = stringValue(input, "toUserId");
    const subject = stringValue(input, "subject").trim();
    const body = stringValue(input, "body").trim();
    if (
      !toUserId ||
      !subject ||
      !body ||
      subject.length > 160 ||
      body.length > 10000
    )
      return null;
    return {
      type,
      toUserId,
      recipientUserIds: recipientUserIdsValue(input.recipientUserIds),
      replyToMessageId: optionalStringValue(input, "replyToMessageId"),
      subject,
      body,
      attachments: messageAttachmentsValue(input.attachments),
      channel: communicationChannels.has(
        input.channel as CommunicationLog["channel"]
      )
        ? (input.channel as CommunicationLog["channel"])
        : undefined,
    };
  }

  if (type === "certificate.approve" || type === "certificate.issue") {
    const certificateId = stringValue(input, "certificateId");
    return certificateId ? { type, certificateId } : null;
  }

  if (type === "certificate.reject") {
    const certificateId = stringValue(input, "certificateId");
    const reason = stringValue(input, "reason");
    return certificateId && reason ? { type, certificateId, reason } : null;
  }

  if (type === "payment.record") {
    const invoiceId = stringValue(input, "invoiceId");
    if (!invoiceId) return null;
    const amount = numberValue(input, "amount");
    const method = stringValue(input, "method");
    const reference = optionalStringValue(input, "reference");
    const allowedMethods = new Set(["cash", "bank_transfer", "card", "manual"]);
    return {
      type,
      invoiceId,
      amount: Number.isFinite(amount) ? amount : undefined,
      method: allowedMethods.has(method)
        ? (method as Extract<
            PlatformWorkflowAction,
            { type: "payment.record" }
          >["method"])
        : undefined,
      reference,
    };
  }

  if (type === "placement.result.record") {
    const bookingId = stringValue(input, "bookingId");
    const recommendedLevel = stringValue(input, "recommendedLevel");
    const score = numberValue(input, "score");
    const notes = stringValue(input, "notes");
    if (
      !bookingId ||
      !recommendedLevel ||
      !Number.isFinite(score) ||
      score < 0 ||
      score > 100 ||
      !notes
    )
      return null;
    return { type, bookingId, recommendedLevel, score, notes };
  }

  if (type === "lead.convert") {
    const leadId = stringValue(input, "leadId");
    return leadId
      ? { type, leadId, branchId: optionalStringValue(input, "branchId") }
      : null;
  }

  if (type === "application.convert") {
    const applicationId = stringValue(input, "applicationId");
    return applicationId ? { type, applicationId } : null;
  }

  if (type === "enrollment.activate") {
    const workflowId = stringValue(input, "workflowId");
    if (!workflowId) return null;
    return {
      type,
      workflowId,
      courseRunId: optionalStringValue(input, "courseRunId"),
      classGroupId: optionalStringValue(input, "classGroupId"),
      actorId: typeof input.actorId === "string" ? input.actorId : undefined,
    };
  }

  if (type === "enrollment.transfer") {
    const enrollmentId = stringValue(input, "enrollmentId");
    const classGroupId = stringValue(input, "classGroupId");
    const reason = stringValue(input, "reason");
    return enrollmentId && classGroupId && reason
      ? { type, enrollmentId, classGroupId, reason }
      : null;
  }

  if (type === "enrollment.status.update") {
    const enrollmentId = stringValue(input, "enrollmentId");
    const status = stringValue(input, "status");
    const reason = optionalStringValue(input, "reason");
    const statuses = new Set(["active", "paused", "completed", "cancelled"]);
    if (!enrollmentId || !statuses.has(status)) return null;
    if ((status === "paused" || status === "cancelled") && !reason) return null;
    return {
      type,
      enrollmentId,
      status: status as Extract<
        PlatformWorkflowAction,
        { type: "enrollment.status.update" }
      >["status"],
      reason,
    };
  }

  if (type === "teacher.assign") {
    const userId = stringValue(input, "userId");
    const courseRunId = stringValue(input, "courseRunId");
    const status = optionalStringValue(input, "status");
    const validAccountStatuses = new Set(["active", "pending", "paused"]);
    if (!userId || !courseRunId) return null;
    if (status && !validAccountStatuses.has(status)) return null;
    return {
      type,
      userId,
      courseRunId,
      status: status as Extract<
        PlatformWorkflowAction,
        { type: "teacher.assign" }
      >["status"],
      departmentId: optionalStringValue(input, "departmentId"),
      specialties: stringArrayValue(input.specialties),
      teachingLevels: stringArrayValue(input.teachingLevels),
      availability: stringArrayValue(input.availability),
    };
  }

  if (type === "quran.progress.update") {
    const recordId = stringValue(input, "recordId");
    const memorizedPercent = numberValue(input, "memorizedPercent");
    const tajweedScore = numberValue(input, "tajweedScore");
    const notes = stringValue(input, "notes");
    if (
      !recordId ||
      !Number.isFinite(memorizedPercent) ||
      !Number.isFinite(tajweedScore)
    )
      return null;
    return { type, recordId, memorizedPercent, tajweedScore, notes };
  }

  if (type === "recitation.review") {
    const submissionId = stringValue(input, "submissionId");
    const feedback = stringValue(input, "feedback");
    return submissionId && feedback ? { type, submissionId, feedback } : null;
  }

  if (type === "recitation.submit") {
    const studentId = stringValue(input, "studentId");
    const teacherId = stringValue(input, "teacherId");
    const title = stringValue(input, "title");
    return studentId && teacherId && title
      ? {
          type,
          studentId,
          teacherId,
          title,
          pendingMedia: pendingMediaValue(input.pendingMedia),
        }
      : null;
  }

  if (type === "notification.read") {
    const notificationId = stringValue(input, "notificationId");
    return notificationId ? { type, notificationId } : null;
  }

  if (type === "message.read") {
    const messageId = stringValue(input, "messageId");
    return messageId ? { type, messageId } : null;
  }

  if (type === "report.preset.save") {
    const role = stringValue(input, "role");
    const label = stringValue(input, "label");
    const reportType = stringValue(input, "reportType");
    const rowCount = numberValue(input, "rowCount");
    if (
      !roleOrder.includes(role as Role) ||
      !label ||
      !reportTypes.has(reportType)
    )
      return null;
    return {
      type,
      role: role as Extract<
        PlatformWorkflowAction,
        { type: "report.preset.save" }
      >["role"],
      label,
      reportType: reportType as Extract<
        PlatformWorkflowAction,
        { type: "report.preset.save" }
      >["reportType"],
      search: optionalStringValue(input, "search"),
      status: optionalStringValue(input, "status"),
      rowCount: Number.isFinite(rowCount) ? rowCount : undefined,
      actorId: typeof input.actorId === "string" ? input.actorId : undefined,
    };
  }

  return null;
}

export const parsePlatformLearningAction = parsePlatformWorkflowAction;

const sensitiveRepositoryEventActions = new Set<PlatformWorkflowAction["type"]>(
  [
    "lead.create",
    "application.create",
    "placement.create",
    "student.create",
    "student.document.add",
    "staff.user.create",
    "user.create",
    "profile.update",
    "message.send",
    "assignment.submit",
    "quiz.submit",
    "recitation.submit",
  ]
);

function repositoryEventPayload(
  serverAction: PlatformWorkflowAction,
  result: PlatformWorkflowActionResult,
  sourcePersistence: PlatformStatePayload["persistence"]
) {
  if (sensitiveRepositoryEventActions.has(serverAction.type)) {
    return {
      request: {
        type: serverAction.type,
        actorId: serverAction.actorId,
      },
      result: {
        action: result.action,
        entityType: result.entityType,
        entityId: result.entityId,
      },
      sourcePersistence,
      redacted: true,
    };
  }
  return {
    request: serverAction,
    result: result.result,
    sourcePersistence,
  };
}

export async function applyPlatformWorkflowAction(
  action: PlatformWorkflowAction,
  session: ServerSession
) {
  if (session.authorizationModel === "normalized") {
    throw new Error(
      "Normalized workflow persistence is not active for durable sessions."
    );
  }
  const snapshot = await getPlatformStateSnapshot();
  const nextState = snapshot.state;
  assertSnapshotSessionAuthority(nextState, session);
  const serverAction = applyServerActor(action, session, nextState);
  assertScopedAction(nextState, serverAction, session);
  const result = applyWorkflowMutation(nextState, serverAction, {
    createId,
    now,
  });
  const persistence =
    await getPlatformStateRepository().writeSnapshot(nextState);

  try {
    await getPlatformStateRepository().recordEvent({
      action: result.action,
      actorId: session.userId,
      entityType: result.entityType,
      entityId: result.entityId,
      summary: result.summary,
      payload: repositoryEventPayload(
        serverAction,
        result,
        snapshot.persistence
      ),
    });
  } catch {
    // Snapshot persistence is the source of truth; event logging must not block the workflow.
  }

  return {
    state: nextState,
    persistence,
    syncedAt: now(),
    result,
  };
}

export const applyPlatformLearningAction = applyPlatformWorkflowAction;
