import {
  applyPlatformWorkflowAction as applyWorkflowMutation,
  type PlatformWorkflowAction,
} from "../client/src/lib/domain/actions.js";
import type {
  AttendanceStatus,
  CalendarEventType,
  CommunicationLog,
  IntegrationConfig,
  IntegrationStatus,
  Lead,
  PlatformState,
  StaffAvailabilityStatus,
  StaffPermissionScope,
  StaffRole,
  StudentEntrySource,
  StudentStatus,
} from "../client/src/lib/domain/types.js";
import { roleOrder, rolePermissions, type Permission, type Role } from "../client/src/lib/platformData.js";
import type { ServerSession } from "./auth.js";
import { getPlatformStateRepository, normalizePlatformState, type PlatformStatePayload } from "./platformRepository.js";

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
  return state.students.find((student) => student.userId === session.userId)?.id ?? "stu_demo";
}

function userForSession(state: PlatformState, session: ServerSession) {
  return state.users.find((item) => item.id === session.userId);
}

function branchIdsForUserScope(state: PlatformState, user?: PlatformState["users"][number]) {
  const branchIds = new Set<string>();
  if (user?.branchId) branchIds.add(user.branchId);
  const department = state.departments.find((item) => item.id === user?.departmentId);
  department?.branchIds.forEach((branchId) => branchIds.add(branchId));
  return branchIds;
}

function courseRunForAssignment(state: PlatformState, assignmentId: string) {
  const assignment = state.assignments.find((item) => item.id === assignmentId);
  return assignment ? state.courseRuns.find((item) => item.id === assignment.courseRunId) : undefined;
}

function courseRunForQuiz(state: PlatformState, quizId: string) {
  const quiz = state.quizzes.find((item) => item.id === quizId);
  return quiz ? state.courseRuns.find((item) => item.id === quiz.courseRunId) : undefined;
}

function branchForInvoice(state: PlatformState, invoiceId: string) {
  const invoice = state.invoices.find((item) => item.id === invoiceId);
  const enrollment = state.enrollments.find((item) => item.studentId === invoice?.studentId);
  const run = state.courseRuns.find((item) => item.id === enrollment?.courseRunId);
  return run?.branchId;
}

function teacherOwnsStudent(state: PlatformState, teacherUserId: string, studentId: string) {
  const classGroupIds = teacherClassGroupIds(state, teacherUserId);
  return state.classGroups.some((item) => classGroupIds.has(item.id) && item.studentIds.includes(studentId)) ||
    state.enrollments.some((item) => item.studentId === studentId && item.classGroupId && classGroupIds.has(item.classGroupId));
}

function teacherOwnsResource(state: PlatformState, teacherUserId: string, resourceId: string) {
  const resource = state.resources.find((item) => item.id === resourceId);
  const lesson = state.lessons.find((item) => item.id === resource?.lessonId);
  const module = state.modules.find((item) => item.id === lesson?.moduleId);
  return Boolean(module && state.courseRuns.some((item) => item.courseId === module.courseId && item.teacherId === teacherUserId));
}

function studentIdsForTeacher(state: PlatformState, teacherUserId: string) {
  const classGroupIds = teacherClassGroupIds(state, teacherUserId);
  const rosterIds = state.classGroups
    .filter((item) => classGroupIds.has(item.id))
    .flatMap((item) => item.studentIds);
  const enrollmentIds = state.enrollments
    .filter((item) => item.classGroupId && classGroupIds.has(item.classGroupId))
    .map((item) => item.studentId);
  return new Set([...rosterIds, ...enrollmentIds]);
}

function teacherClassGroupIds(state: PlatformState, teacherUserId: string) {
  const runIds = new Set(state.courseRuns.filter((item) => item.teacherId === teacherUserId).map((item) => item.id));
  return new Set(state.classGroups.filter((item) => runIds.has(item.courseRunId)).map((item) => item.id));
}

function studentIdsForBranch(state: PlatformState, branchId?: string) {
  const runIds = new Set(state.courseRuns.filter((item) => item.branchId === branchId).map((item) => item.id));
  return new Set(state.enrollments.filter((item) => runIds.has(item.courseRunId)).map((item) => item.studentId));
}

function hodOwnsCourse(state: PlatformState, session: ServerSession, courseId: string) {
  const user = userForSession(state, session);
  const course = state.courses.find((item) => item.id === courseId);
  const program = state.programs.find((item) => item.id === course?.programId);
  const department = state.departments.find((item) => item.id === program?.departmentId);
  return Boolean(department && (department.ownerUserId === session.userId || department.id === user?.departmentId));
}

function hodOwnsStudent(state: PlatformState, session: ServerSession, studentId: string) {
  const courseIds = new Set(
    state.enrollments
      .filter((item) => item.studentId === studentId)
      .map((item) => state.courseRuns.find((run) => run.id === item.courseRunId)?.courseId)
      .filter((courseId): courseId is string => Boolean(courseId)),
  );
  return Array.from(courseIds).some((courseId) => hodOwnsCourse(state, session, courseId));
}

function hodOwnsCertificate(state: PlatformState, session: ServerSession, certificateId: string) {
  const certificate = state.certificates.find((item) => item.id === certificateId);
  if (!certificate || !hodOwnsCourse(state, session, certificate.courseId) || !hodOwnsStudent(state, session, certificate.studentId)) {
    return false;
  }
  return state.enrollments.some((enrollment) => {
    if (enrollment.studentId !== certificate.studentId) return false;
    const run = state.courseRuns.find((item) => item.id === enrollment.courseRunId);
    return run?.courseId === certificate.courseId;
  });
}

function canMessageRecipient(state: PlatformState, session: ServerSession, toUserId: string) {
  if (session.activeRole === "superadmin") return true;
  if (toUserId === session.userId) return true;
  const recipient = state.users.find((item) => item.id === toUserId);
  if (!recipient) return false;
  const sender = userForSession(state, session);

  if (session.activeRole === "student") {
    const student = state.students.find((item) => item.userId === session.userId);
    const runIds = new Set(state.enrollments.filter((item) => item.studentId === student?.id).map((item) => item.courseRunId));
    const teacherUserIds = new Set(state.courseRuns.filter((item) => runIds.has(item.id)).map((item) => item.teacherId));
    return teacherUserIds.has(toUserId) || recipient.roles.some((role) => role === "registrar" || role === "branchadmin");
  }

  if (session.activeRole === "teacher") {
    const studentIds = studentIdsForTeacher(state, session.userId);
    const recipientStudent = state.students.find((item) => item.userId === toUserId);
    return Boolean(recipientStudent && studentIds.has(recipientStudent.id));
  }

  if (session.activeRole === "branchadmin") {
    const studentIds = studentIdsForBranch(state, sender?.branchId);
    const recipientStudent = state.students.find((item) => item.userId === toUserId);
    return recipient.branchId === sender?.branchId || Boolean(recipientStudent && studentIds.has(recipientStudent.id));
  }

  if (session.activeRole === "headofdepartment") {
    const departmentIds = new Set(state.departments.filter((item) => item.ownerUserId === session.userId || item.id === sender?.departmentId).map((item) => item.id));
    const programIds = new Set(state.programs.filter((item) => departmentIds.has(item.departmentId)).map((item) => item.id));
    const courseIds = new Set(state.courses.filter((item) => programIds.has(item.programId)).map((item) => item.id));
    const runIds = new Set(state.courseRuns.filter((item) => courseIds.has(item.courseId)).map((item) => item.id));
    const studentIds = new Set(state.enrollments.filter((item) => runIds.has(item.courseRunId)).map((item) => item.studentId));
    const recipientStudent = state.students.find((item) => item.userId === toUserId);
    return Boolean((recipient.departmentId && departmentIds.has(recipient.departmentId)) || (recipientStudent && studentIds.has(recipientStudent.id)));
  }

  return session.activeRole === "registrar" && recipient.roles.some((role) => role === "student" || role === "teacher" || role === "branchadmin");
}

function assertStudentScopedAction(state: PlatformState, action: PlatformWorkflowAction, session: ServerSession) {
  if (session.activeRole !== "student") return;
  const studentId = studentIdForSession(state, session);
  if (action.type === "assignment.submit") {
    const run = courseRunForAssignment(state, action.assignmentId);
    if (!state.enrollments.some((item) => item.studentId === studentId && item.courseRunId === run?.id)) {
      throw new Error("Student can only submit assignments for enrolled course runs.");
    }
  }
  if (action.type === "quiz.submit") {
    const run = courseRunForQuiz(state, action.quizId);
    if (!state.enrollments.some((item) => item.studentId === studentId && item.courseRunId === run?.id)) {
      throw new Error("Student can only submit quizzes for enrolled course runs.");
    }
  }
  if (action.type === "lesson.start" || action.type === "lesson.complete") {
    const lesson = state.lessons.find((item) => item.id === action.lessonId);
    const module = state.modules.find((item) => item.id === lesson?.moduleId);
    const run = state.courseRuns.find((item) => item.courseId === module?.courseId);
    if (!state.enrollments.some((item) => item.studentId === studentId && item.courseRunId === run?.id)) {
      throw new Error("Student can only open lessons for enrolled course runs.");
    }
  }
  if (action.type === "recitation.submit") {
    const plan = state.quranPlans.find((item) => item.studentId === studentId);
    if (!plan || plan.teacherId !== action.teacherId || !teacherOwnsStudent(state, action.teacherId, studentId)) {
      throw new Error("Student can only submit recitations to their assigned Quran teacher.");
    }
  }
  if (action.type === "notification.read") {
    const notification = state.notifications.find((item) => item.id === action.notificationId);
    if (notification?.userId !== session.userId) throw new Error("Student can only mark own notifications as read.");
  }
}

function roleCanRunAction(session: ServerSession, action: PlatformWorkflowAction) {
  const byRole: Record<ServerSession["activeRole"], PlatformWorkflowAction["type"][]> = {
    student: [
      "lesson.start",
      "lesson.complete",
      "assignment.submit",
      "quiz.submit",
      "recitation.submit",
      "message.send",
      "notification.read",
      "report.preset.save",
    ],
    teacher: [
      "assignment.create",
      "quiz.create",
      "question.create",
      "quiz.questions.set",
      "assignment.grade",
      "quiz.review",
      "attendance.save",
      "calendar.create",
      "material.publish.update",
      "message.send",
      "quran.progress.update",
      "recitation.review",
      "notification.read",
      "report.preset.save",
    ],
    registrar: [
      "lead.create",
      "application.create",
      "placement.create",
      "placement.result.record",
      "lead.convert",
      "application.convert",
      "student.create",
      "student.status.update",
      "enrollment.activate",
      "payment.record",
      "calendar.create",
      "message.send",
      "record.save",
      "notification.read",
      "report.preset.save",
    ],
    headofdepartment: [
      "assignment.create",
      "assignment.grade",
      "quiz.create",
      "question.create",
      "quiz.questions.set",
      "quiz.review",
      "certificate.approve",
      "certificate.issue",
      "certificate.reject",
      "curriculum.module.create",
      "course.status.update",
      "message.send",
      "quran.progress.update",
      "recitation.review",
      "record.save",
      "notification.read",
      "report.preset.save",
    ],
    branchadmin: [
      "attendance.save",
      "calendar.create",
      "message.send",
      "payment.record",
      "record.save",
      "room.create",
      "room.status.update",
      "notification.read",
      "report.preset.save",
    ],
    superadmin: [
      "staff.user.create",
      "lead.create",
      "application.create",
      "placement.create",
      "placement.result.record",
      "lead.convert",
      "student.create",
      "student.status.update",
      "application.convert",
      "enrollment.activate",
      "payment.record",
      "user.create",
      "user.update",
      "permission.update",
      "branch.update",
      "integration.status.update",
      "integration.local_check",
      "system.health_check",
      "settings.save",
      "teacher.assign",
      "course.status.update",
      "room.create",
      "room.status.update",
      "message.send",
      "record.save",
      "notification.read",
      "report.preset.save",
    ],
  };
  return byRole[session.activeRole].includes(action.type);
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

function assertScopedAction(state: PlatformState, action: PlatformWorkflowAction, session: ServerSession) {
  if (!roleCanRunAction(session, action)) {
    throw new Error(`Role ${session.activeRole} cannot run ${action.type}.`);
  }

  if (action.type === "report.preset.save") {
    if (action.role !== session.activeRole) throw new Error("Report preset role must match the active session role.");
    if (!allowedReportTypesForRole(session.activeRole).has(action.reportType)) {
      throw new Error(`Role ${session.activeRole} cannot save ${action.reportType} report views.`);
    }
  }

  assertStudentScopedAction(state, action, session);

  if (session.activeRole === "teacher") {
    if (action.type === "assignment.create" || action.type === "quiz.create" || action.type === "question.create") {
      const run = state.courseRuns.find((item) => item.id === action.courseRunId);
      if (run?.teacherId !== session.userId) throw new Error("Teacher can only create assessments for assigned course runs.");
    }
    if (action.type === "quiz.questions.set") {
      const run = courseRunForQuiz(state, action.quizId);
      if (run?.teacherId !== session.userId) throw new Error("Teacher can only attach questions to assigned course quizzes.");
    }
    if (action.type === "assignment.grade") {
      const submission = state.assignmentSubmissions.find((item) => item.id === action.submissionId);
      const assignment = state.assignments.find((item) => item.id === submission?.assignmentId);
      const run = state.courseRuns.find((item) => item.id === assignment?.courseRunId);
      if (run?.teacherId !== session.userId || !submission || !teacherOwnsStudent(state, session.userId, submission.studentId)) {
        throw new Error("Teacher can only grade assigned class submissions.");
      }
    }
    if (action.type === "quiz.review") {
      const attempt = state.quizAttempts.find((item) => item.id === action.attemptId);
      const quiz = state.quizzes.find((item) => item.id === attempt?.quizId);
      const run = state.courseRuns.find((item) => item.id === quiz?.courseRunId);
      if (run?.teacherId !== session.userId || !attempt || !teacherOwnsStudent(state, session.userId, attempt.studentId)) {
        throw new Error("Teacher can only review assigned class quiz attempts.");
      }
    }
    if (action.type === "attendance.save") {
      const group = state.classGroups.find((item) => item.id === action.classGroupId);
      const run = state.courseRuns.find((item) => item.id === group?.courseRunId);
      if (!group || !run || run.teacherId !== session.userId) throw new Error("Teacher can only save attendance for assigned classes.");
    }
    if (action.type === "material.publish.update") {
      if (!teacherOwnsResource(state, session.userId, action.id)) {
        throw new Error("Teacher can only publish materials for assigned courses.");
      }
    }
    if (action.type === "calendar.create") {
      const allowedTypes = new Set<CalendarEventType>(["class_session", "live_session", "assignment_due", "quiz_due", "reminder"]);
      const group = action.classGroupId ? state.classGroups.find((item) => item.id === action.classGroupId) : undefined;
      const run = group ? state.courseRuns.find((item) => item.id === group.courseRunId) : undefined;
      const room = action.roomId ? state.rooms.find((item) => item.id === action.roomId) : undefined;
      const branchIds = new Set(state.courseRuns.filter((item) => item.teacherId === session.userId).map((item) => item.branchId));
      if (!allowedTypes.has(action.eventType)) throw new Error("Teacher can only schedule teaching calendar items.");
      if (action.classGroupId && (!group || !run || run.teacherId !== session.userId)) throw new Error("Teacher can only schedule assigned classes.");
      if (action.branchId && !branchIds.has(action.branchId)) throw new Error("Teacher can only schedule inside assigned branches.");
      if (action.roomId && (!room || !branchIds.has(room.branchId))) throw new Error("Teacher can only book rooms in assigned branches.");
      if (action.ownerId && action.ownerId !== session.userId) throw new Error("Teacher can only create own calendar events.");
    }
    if (action.type === "quran.progress.update") {
      const record = state.quranProgress.find((item) => item.id === action.recordId);
      if (!record || !teacherOwnsStudent(state, session.userId, record.studentId)) {
        throw new Error("Teacher can only update Quran progress for assigned learners.");
      }
    }
    if (action.type === "recitation.review") {
      const submission = state.recitationSubmissions.find((item) => item.id === action.submissionId);
      if (submission?.teacherId !== session.userId) throw new Error("Teacher can only review assigned recitations.");
    }
    if (action.type === "notification.read") {
      const notification = state.notifications.find((item) => item.id === action.notificationId);
      if (notification?.userId !== session.userId) throw new Error("Teacher can only mark own notifications as read.");
    }
  }

  if (session.activeRole === "branchadmin") {
    const user = userForSession(state, session);
    if (action.type === "calendar.create") {
      const allowedTypes = new Set<CalendarEventType>(["class_session", "live_session", "room_booking", "reminder"]);
      if (!user?.branchId || action.branchId !== user.branchId) {
        throw new Error("Branch admin can only schedule inside their branch.");
      }
      if (!allowedTypes.has(action.eventType)) throw new Error("Branch admin can only schedule branch operations calendar items.");
      const room = action.roomId ? state.rooms.find((item) => item.id === action.roomId) : undefined;
      const group = action.classGroupId ? state.classGroups.find((item) => item.id === action.classGroupId) : undefined;
      const run = group ? state.courseRuns.find((item) => item.id === group.courseRunId) : undefined;
      if (action.roomId && (!room || room.branchId !== user.branchId)) throw new Error("Branch admin can only book rooms in their branch.");
      if (action.classGroupId && (!group || !run || run.branchId !== user.branchId)) throw new Error("Branch admin can only schedule classes in their branch.");
    }
    if (action.type === "attendance.save") {
      const group = state.classGroups.find((item) => item.id === action.classGroupId);
      const run = state.courseRuns.find((item) => item.id === group?.courseRunId);
      if (!user?.branchId || !group || !run || run.branchId !== user.branchId) throw new Error("Branch admin can only save attendance in their branch.");
    }
    if (action.type === "payment.record" && branchForInvoice(state, action.invoiceId) !== user?.branchId) {
      throw new Error("Branch admin can only record payments for their branch.");
    }
    if (action.type === "room.status.update") {
      const room = state.rooms.find((item) => item.id === action.roomId);
      if (!user?.branchId || !room || room.branchId !== user.branchId) {
        throw new Error("Branch admin can only update rooms in their branch.");
      }
    }
    if (action.type === "room.create" && (!user?.branchId || action.branchId !== user.branchId)) {
      throw new Error("Branch admin can only create rooms in their branch.");
    }
    if (action.type === "notification.read") {
      const notification = state.notifications.find((item) => item.id === action.notificationId);
      if (notification?.userId !== session.userId) throw new Error("Branch admin can only mark own notifications as read.");
    }
  }

  if (session.activeRole === "headofdepartment") {
    if (action.type === "curriculum.module.create") {
      if (!hodOwnsCourse(state, session, action.courseId)) {
        throw new Error("HOD can only create curriculum modules in their department.");
      }
    }
    if (action.type === "course.status.update") {
      if (!hodOwnsCourse(state, session, action.courseId)) {
        throw new Error("HOD can only update course status in their department.");
      }
    }
    if (action.type === "certificate.approve" || action.type === "certificate.issue" || action.type === "certificate.reject") {
      if (!hodOwnsCertificate(state, session, action.certificateId)) {
        throw new Error("HOD can only manage certificates in their department.");
      }
    }
    if (action.type === "assignment.create" || action.type === "quiz.create" || action.type === "question.create") {
      const run = state.courseRuns.find((item) => item.id === action.courseRunId);
      if (!run || !hodOwnsCourse(state, session, run.courseId)) throw new Error("HOD can only create assessments in their department.");
    }
    if (action.type === "quiz.questions.set") {
      const run = courseRunForQuiz(state, action.quizId);
      if (!run || !hodOwnsCourse(state, session, run.courseId)) throw new Error("HOD can only attach questions to department quizzes.");
    }
    if (action.type === "assignment.grade") {
      const submission = state.assignmentSubmissions.find((item) => item.id === action.submissionId);
      const assignment = state.assignments.find((item) => item.id === submission?.assignmentId);
      const run = state.courseRuns.find((item) => item.id === assignment?.courseRunId);
      if (!run || !hodOwnsCourse(state, session, run.courseId)) throw new Error("HOD can only grade department assignment submissions.");
    }
    if (action.type === "quiz.review") {
      const attempt = state.quizAttempts.find((item) => item.id === action.attemptId);
      const run = courseRunForQuiz(state, attempt?.quizId ?? "");
      if (!run || !hodOwnsCourse(state, session, run.courseId)) throw new Error("HOD can only review department quiz attempts.");
    }
    if (action.type === "quran.progress.update") {
      const record = state.quranProgress.find((item) => item.id === action.recordId);
      if (!record || !hodOwnsStudent(state, session, record.studentId)) throw new Error("HOD can only update Quran progress in their department.");
    }
    if (action.type === "recitation.review") {
      const submission = state.recitationSubmissions.find((item) => item.id === action.submissionId);
      if (!submission || !hodOwnsStudent(state, session, submission.studentId)) throw new Error("HOD can only review department recitations.");
    }
    if (action.type === "notification.read") {
      const notification = state.notifications.find((item) => item.id === action.notificationId);
      if (notification?.userId !== session.userId) throw new Error("HOD can only mark own notifications as read.");
    }
  }

  if (session.activeRole === "registrar") {
    const user = userForSession(state, session);
    const branchIds = branchIdsForUserScope(state, user);
    if (action.type === "application.create" && !branchIds.has(action.branchId)) {
      throw new Error("Registrar can only create applications inside admissions branches.");
    }
    if (action.type === "placement.create" && action.branchId && !branchIds.has(action.branchId)) {
      throw new Error("Registrar can only book placement tests inside admissions branches.");
    }
    if (action.type === "placement.result.record") {
      const booking = state.placementTests.find((item) => item.id === action.bookingId);
      if (!booking || (booking.branchId && !branchIds.has(booking.branchId))) {
        throw new Error("Registrar can only record placement results inside admissions branches.");
      }
    }
    if (action.type === "lead.convert" && action.branchId && !branchIds.has(action.branchId)) {
      throw new Error("Registrar can only convert leads inside admissions branches.");
    }
    if (action.type === "application.convert") {
      const application = state.applications.find((item) => item.id === action.applicationId);
      if (!application || (application.branchId && !branchIds.has(application.branchId))) {
        throw new Error("Registrar can only convert applications inside admissions branches.");
      }
    }
    if (action.type === "student.create") {
      const courseRun = state.courseRuns.find((item) => item.id === action.courseRunId);
      const classGroup = state.classGroups.find((item) => item.id === action.classGroupId);
      const application = action.applicationId ? state.applications.find((item) => item.id === action.applicationId) : undefined;
      const placement = action.placementTestId ? state.placementTests.find((item) => item.id === action.placementTestId) : undefined;
      if (!branchIds.has(action.branchId) || !courseRun || !branchIds.has(courseRun.branchId)) {
        throw new Error("Registrar can only create students inside admissions branches.");
      }
      if (!classGroup || classGroup.courseRunId !== courseRun.id) {
        throw new Error("Registrar can only assign a matching class group.");
      }
      if (application?.branchId && !branchIds.has(application.branchId)) {
        throw new Error("Registrar can only use applications inside admissions branches.");
      }
      if (placement?.branchId && !branchIds.has(placement.branchId)) {
        throw new Error("Registrar can only use placement tests inside admissions branches.");
      }
    }
    if (action.type === "student.status.update") {
      const student = state.students.find((item) => item.id === action.studentId);
      const studentUser = state.users.find((item) => item.id === student?.userId);
      if (!student || !branchIds.has(studentUser?.branchId ?? "")) {
        throw new Error("Registrar can only update students inside admissions branches.");
      }
    }
    if (action.type === "payment.record" && !branchIds.has(branchForInvoice(state, action.invoiceId) ?? "")) {
      throw new Error("Registrar can only record payments inside admissions branches.");
    }
    if (action.type === "enrollment.activate") {
      const workflow = state.enrollmentWorkflows.find((item) => item.id === action.workflowId);
      const courseRun =
        state.courseRuns.find((item) => item.id === action.courseRunId && item.courseId === workflow?.targetCourseId) ??
        state.courseRuns.find((item) => item.courseId === workflow?.targetCourseId && item.status === "active") ??
        state.courseRuns.find((item) => item.courseId === workflow?.targetCourseId);
      const classGroup = action.classGroupId ? state.classGroups.find((item) => item.id === action.classGroupId) : undefined;
      if (!workflow || !courseRun || !branchIds.has(courseRun.branchId)) {
        throw new Error("Registrar can only activate enrollments inside admissions branches.");
      }
      if (action.classGroupId && (!classGroup || classGroup.courseRunId !== courseRun.id)) {
        throw new Error("Registrar can only assign a matching class group.");
      }
    }
    if (action.type === "calendar.create") {
      const allowedTypes = new Set<CalendarEventType>(["placement_test", "trial_lesson", "room_booking", "reminder"]);
      const room = action.roomId ? state.rooms.find((item) => item.id === action.roomId) : undefined;
      if (!branchIds.size) throw new Error("Registrar calendar scope is not configured.");
      if (!allowedTypes.has(action.eventType)) throw new Error("Registrar can only schedule admissions calendar items.");
      if (action.classGroupId) throw new Error("Registrar cannot schedule class groups from this workspace.");
      if (!action.branchId) throw new Error("Registrar calendar events require a branch.");
      if (action.branchId && !branchIds.has(action.branchId)) throw new Error("Registrar can only schedule inside admissions branches.");
      if (action.roomId && (!room || !branchIds.has(room.branchId))) throw new Error("Registrar can only book rooms inside admissions branches.");
    }
    if (action.type === "notification.read") {
      const notification = state.notifications.find((item) => item.id === action.notificationId);
      if (notification?.userId !== session.userId) throw new Error("Registrar can only mark own notifications as read.");
    }
  }

  if (action.type === "message.send" && !canMessageRecipient(state, session, action.toUserId)) {
    throw new Error("Message recipient is outside this role scope.");
  }
}

function applyServerActor(action: PlatformWorkflowAction, session: ServerSession, state: PlatformState): PlatformWorkflowAction {
  const actorId = session.userId;
  const studentId = studentIdForSession(state, session);
  const user = userForSession(state, session);
  switch (action.type) {
    case "lesson.start":
    case "lesson.complete":
    case "assignment.submit":
    case "quiz.submit":
      return { ...action, studentId, actorId };
    case "recitation.submit":
      return { ...action, studentId, actorId };
    case "message.send":
      return { ...action, fromUserId: actorId, actorId };
    case "calendar.create":
      return {
        ...action,
        ownerId: actorId,
        branchId: action.branchId ?? user?.branchId,
        actorId,
      };
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

const attendanceStatuses = new Set<AttendanceStatus>(["present", "late", "absent", "excused"]);
const leadSources = new Set<Lead["source"]>(["website", "trial_form", "placement_form", "whatsapp", "manual"]);
const communicationChannels = new Set<CommunicationLog["channel"]>(["in_app", "email", "whatsapp", "phone", "manual"]);
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
const studentCreateStatuses = new Set<StudentStatus>(["ready_to_enroll", "enrolled", "active", "paused"]);
const studentEntrySources = new Set<StudentEntrySource>(["direct", "lead", "application", "placement"]);
const staffRoles = new Set<StaffRole>(["teacher", "registrar", "headofdepartment", "branchadmin", "superadmin"]);
const staffPermissionScopes = new Set<StaffPermissionScope>(["department", "branch", "admissions", "operations", "global"]);
const staffAvailabilityStatuses = new Set<StaffAvailabilityStatus>(["available", "limited", "unavailable", "not_applicable"]);
const knownPermissions = new Set<Permission>(Object.values(rolePermissions).flatMap((permissions) => permissions));
const integrationStatuses = new Set<IntegrationStatus>(["not_configured", "mock_mode", "connected", "error"]);
const integrationIds = new Set<IntegrationConfig["id"]>(["supabase", "moodle", "ems", "email", "whatsapp", "meeting", "payment", "jotform"]);

function stringValue(input: Record<string, unknown>, key: string) {
  return typeof input[key] === "string" ? input[key] : "";
}

function optionalStringValue(input: Record<string, unknown>, key: string) {
  return typeof input[key] === "string" && input[key] ? input[key] : undefined;
}

function numberValue(input: Record<string, unknown>, key: string) {
  return typeof input[key] === "number" && Number.isFinite(input[key]) ? input[key] : Number(input[key]);
}

function stringArrayValue(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function stringRecordValue(value: unknown) {
  if (!value || typeof value !== "object") return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
  );
}

function attendanceRecordValue(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const entries = Object.entries(value as Record<string, unknown>);
  if (!entries.length) return null;
  if (!entries.every((entry): entry is [string, AttendanceStatus] => typeof entry[1] === "string" && attendanceStatuses.has(entry[1] as AttendanceStatus))) {
    return null;
  }
  return Object.fromEntries(entries);
}

export function parsePlatformWorkflowAction(value: unknown): PlatformWorkflowAction | null {
  if (!value || typeof value !== "object") return null;
  const input = value as Record<string, unknown>;
  const type = input.type;

  if ((type === "lesson.start" || type === "lesson.complete") && typeof input.lessonId === "string") {
    return {
      type,
      lessonId: input.lessonId,
      studentId: typeof input.studentId === "string" ? input.studentId : undefined,
      actorId: typeof input.actorId === "string" ? input.actorId : undefined,
    };
  }

  if (type === "assignment.submit" && typeof input.assignmentId === "string" && typeof input.response === "string") {
    return {
      type,
      assignmentId: input.assignmentId,
      response: input.response,
      studentId: typeof input.studentId === "string" ? input.studentId : undefined,
      actorId: typeof input.actorId === "string" ? input.actorId : undefined,
    };
  }

  if (type === "quiz.submit" && typeof input.quizId === "string" && input.answers && typeof input.answers === "object") {
    const answers = stringRecordValue(input.answers);
    return {
      type,
      quizId: input.quizId,
      answers,
      studentId: typeof input.studentId === "string" ? input.studentId : undefined,
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
      source: leadSources.has(input.source as Lead["source"]) ? (input.source as Lead["source"]) : undefined,
    };
  }

  if (type === "application.create") {
    const fullName = stringValue(input, "fullName");
    const email = stringValue(input, "email");
    const phone = stringValue(input, "phone");
    const branchId = stringValue(input, "branchId");
    const courseInterest = stringValue(input, "courseInterest");
    const schedulePreference = stringValue(input, "schedulePreference");
    if (!fullName || !email || !phone || !branchId || !courseInterest || !schedulePreference) return null;
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
      source: leadSources.has(input.source as Lead["source"]) ? (input.source as Lead["source"]) : undefined,
    };
  }

  if (type === "placement.create") {
    const fullName = stringValue(input, "fullName");
    const email = stringValue(input, "email");
    const phone = stringValue(input, "phone");
    const subject = stringValue(input, "subject");
    const preferredDate = stringValue(input, "preferredDate");
    const currentLevel = stringValue(input, "currentLevel");
    if (!fullName || !email || !phone || !subject || !preferredDate || !currentLevel) return null;
    return {
      type,
      fullName,
      email,
      phone,
      subject,
      preferredDate,
      currentLevel,
      branchId: optionalStringValue(input, "branchId"),
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
      status: status as Extract<PlatformWorkflowAction, { type: "course.status.update" }>["status"],
    };
  }

  if (type === "material.publish.update") {
    const id = stringValue(input, "id");
    if (!id || typeof input.published !== "boolean") return null;
    return { type, id, published: input.published };
  }

  if (type === "record.save") {
    const module = stringValue(input, "module");
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
    if (!name || !email || !phone || !role || !roleOrder.includes(role as Role)) return null;
    if (status && !validAccountStatuses.has(status)) return null;
    return {
      type,
      name,
      email,
      phone,
      role: role as Role,
      branchId: optionalStringValue(input, "branchId"),
      departmentId: optionalStringValue(input, "departmentId"),
      status: status as Extract<PlatformWorkflowAction, { type: "user.create" }>["status"],
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
    if (permissionScope && !staffPermissionScopes.has(permissionScope as StaffPermissionScope)) return null;
    if (availabilityStatus && !staffAvailabilityStatuses.has(availabilityStatus as StaffAvailabilityStatus)) return null;
    return {
      type,
      name,
      email,
      phone: optionalStringValue(input, "phone"),
      role: role as StaffRole,
      branchId: optionalStringValue(input, "branchId"),
      departmentId: optionalStringValue(input, "departmentId"),
      status: status as Extract<PlatformWorkflowAction, { type: "staff.user.create" }>["status"],
      permissionScope: permissionScope as Extract<PlatformWorkflowAction, { type: "staff.user.create" }>["permissionScope"],
      subjects: stringArrayValue(input.subjects),
      teachingLevels: stringArrayValue(input.teachingLevels),
      availabilityStatus: availabilityStatus as Extract<PlatformWorkflowAction, { type: "staff.user.create" }>["availabilityStatus"],
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
    if (!fullName || !email || !phone || !branchId || !preferredLanguage || !courseInterest || !ageGroup || !courseRunId || !classGroupId) {
      return null;
    }
    if (status && !studentCreateStatuses.has(status as StudentStatus)) return null;
    if (source && !studentEntrySources.has(source as StudentEntrySource)) return null;
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
      status: status as Extract<PlatformWorkflowAction, { type: "student.create" }>["status"],
      notes: optionalStringValue(input, "notes"),
      courseRunId,
      classGroupId,
      source: source as Extract<PlatformWorkflowAction, { type: "student.create" }>["source"],
      leadId: optionalStringValue(input, "leadId"),
      applicationId: optionalStringValue(input, "applicationId"),
      placementTestId: optionalStringValue(input, "placementTestId"),
    };
  }

  if (type === "student.status.update") {
    const studentId = stringValue(input, "studentId");
    const status = stringValue(input, "status");
    if (!studentId || !studentStatuses.has(status as StudentStatus)) return null;
    return {
      type,
      studentId,
      status: status as Extract<PlatformWorkflowAction, { type: "student.status.update" }>["status"],
      notes: optionalStringValue(input, "notes"),
    };
  }

  if (type === "user.update") {
    const userId = stringValue(input, "userId");
    const activeRole = optionalStringValue(input, "activeRole");
    const status = optionalStringValue(input, "status");
    const roles = stringArrayValue(input.roles).filter((role): role is Role => roleOrder.includes(role as Role));
    const validAccountStatuses = new Set(["active", "pending", "paused"]);
    if (!userId) return null;
    if (activeRole && !roleOrder.includes(activeRole as Role)) return null;
    if (status && !validAccountStatuses.has(status)) return null;
    return {
      type,
      userId,
      activeRole: activeRole as Extract<PlatformWorkflowAction, { type: "user.update" }>["activeRole"],
      roles: roles.length ? roles : undefined,
      branchId: optionalStringValue(input, "branchId"),
      departmentId: optionalStringValue(input, "departmentId"),
      status: status as Extract<PlatformWorkflowAction, { type: "user.update" }>["status"],
    };
  }

  if (type === "permission.update") {
    const role = stringValue(input, "role");
    const permission = stringValue(input, "permission");
    const granted = input.granted;
    if (!roleOrder.includes(role as Role) || !knownPermissions.has(permission as Permission) || typeof granted !== "boolean") return null;
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
      status: status as Extract<PlatformWorkflowAction, { type: "branch.update" }>["status"],
    };
  }

  if (type === "room.status.update") {
    const roomId = stringValue(input, "roomId");
    const status = stringValue(input, "status");
    if (!roomId || !accountStatuses.has(status)) return null;
    return {
      type,
      roomId,
      status: status as Extract<PlatformWorkflowAction, { type: "room.status.update" }>["status"],
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

  if (type === "integration.status.update") {
    const integrationId = stringValue(input, "integrationId");
    const status = stringValue(input, "status");
    if (!integrationIds.has(integrationId as IntegrationConfig["id"]) || !integrationStatuses.has(status as IntegrationStatus)) return null;
    return {
      type,
      integrationId: integrationId as IntegrationConfig["id"],
      status: status as IntegrationStatus,
    };
  }

  if (type === "integration.local_check") {
    const integrationId = stringValue(input, "integrationId");
    if (!integrationIds.has(integrationId as IntegrationConfig["id"])) return null;
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
    if (!organization || !defaultLanguage || !academicTerm || !Number.isFinite(retentionDays)) return null;
    return {
      type,
      organization,
      defaultLanguage,
      academicTerm,
      retentionDays,
    };
  }

  if (type === "assignment.create") {
    const courseRunId = stringValue(input, "courseRunId");
    const title = stringValue(input, "title");
    const dueAt = stringValue(input, "dueAt");
    const submissionType = stringValue(input, "submissionType");
    if (!courseRunId || !title || !dueAt || !["text", "file", "audio", "video"].includes(submissionType)) return null;
    return {
      type,
      courseRunId,
      title,
      dueAt,
      submissionType: submissionType as "text" | "file" | "audio" | "video",
      rubric: stringArrayValue(input.rubric),
    };
  }

  if (type === "quiz.create") {
    const courseRunId = stringValue(input, "courseRunId");
    const title = stringValue(input, "title");
    const dueAt = stringValue(input, "dueAt");
    const durationMinutes = numberValue(input, "durationMinutes");
    const attemptsAllowed = numberValue(input, "attemptsAllowed");
    if (!courseRunId || !title || !dueAt || !Number.isFinite(durationMinutes) || !Number.isFinite(attemptsAllowed)) return null;
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
      questionType: questionType as Extract<PlatformWorkflowAction, { type: "question.create" }>["questionType"],
      difficulty: difficulty as Extract<PlatformWorkflowAction, { type: "question.create" }>["difficulty"],
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
    return { type, classGroupId, sessionId, statuses, notes: stringRecordValue(input.notes) };
  }

  if (type === "calendar.create") {
    const eventType = stringValue(input, "eventType");
    const title = stringValue(input, "title");
    const startsAt = stringValue(input, "startsAt");
    const endsAt = stringValue(input, "endsAt");
    const ownerId = optionalStringValue(input, "ownerId");
    if (!eventTypes.has(eventType as CalendarEventType) || !title || !startsAt || !endsAt) return null;
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

  if (type === "message.send") {
    const toUserId = stringValue(input, "toUserId");
    const subject = stringValue(input, "subject");
    const body = stringValue(input, "body");
    if (!toUserId || !subject || !body) return null;
    return {
      type,
      toUserId,
      subject,
      body,
      channel: communicationChannels.has(input.channel as CommunicationLog["channel"])
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
      method: allowedMethods.has(method) ? method as Extract<PlatformWorkflowAction, { type: "payment.record" }>["method"] : undefined,
      reference,
    };
  }

  if (type === "placement.result.record") {
    const bookingId = stringValue(input, "bookingId");
    const recommendedLevel = stringValue(input, "recommendedLevel");
    const score = numberValue(input, "score");
    const notes = stringValue(input, "notes");
    if (!bookingId || !recommendedLevel || !Number.isFinite(score) || !notes) return null;
    return { type, bookingId, recommendedLevel, score, notes };
  }

  if (type === "lead.convert") {
    const leadId = stringValue(input, "leadId");
    return leadId ? { type, leadId, branchId: optionalStringValue(input, "branchId") } : null;
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
      status: status as Extract<PlatformWorkflowAction, { type: "teacher.assign" }>["status"],
      departmentId: optionalStringValue(input, "departmentId"),
      specialties: stringArrayValue(input.specialties),
      availability: stringArrayValue(input.availability),
    };
  }

  if (type === "quran.progress.update") {
    const recordId = stringValue(input, "recordId");
    const memorizedPercent = numberValue(input, "memorizedPercent");
    const tajweedScore = numberValue(input, "tajweedScore");
    const notes = stringValue(input, "notes");
    if (!recordId || !Number.isFinite(memorizedPercent) || !Number.isFinite(tajweedScore)) return null;
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
    return studentId && teacherId && title ? { type, studentId, teacherId, title } : null;
  }

  if (type === "notification.read") {
    const notificationId = stringValue(input, "notificationId");
    return notificationId ? { type, notificationId } : null;
  }

  if (type === "report.preset.save") {
    const role = stringValue(input, "role");
    const label = stringValue(input, "label");
    const reportType = stringValue(input, "reportType");
    const rowCount = numberValue(input, "rowCount");
    if (!roleOrder.includes(role as Role) || !label || !reportTypes.has(reportType)) return null;
    return {
      type,
      role: role as Extract<PlatformWorkflowAction, { type: "report.preset.save" }>["role"],
      label,
      reportType: reportType as Extract<PlatformWorkflowAction, { type: "report.preset.save" }>["reportType"],
      search: optionalStringValue(input, "search"),
      status: optionalStringValue(input, "status"),
      rowCount: Number.isFinite(rowCount) ? rowCount : undefined,
      actorId: typeof input.actorId === "string" ? input.actorId : undefined,
    };
  }

  return null;
}

export const parsePlatformLearningAction = parsePlatformWorkflowAction;

export async function applyPlatformWorkflowAction(action: PlatformWorkflowAction, session: ServerSession) {
  const snapshot = await getPlatformStateSnapshot();
  const nextState = normalizePlatformState(snapshot.state);
  const serverAction = applyServerActor(action, session, nextState);
  assertScopedAction(nextState, serverAction, session);
  const result = applyWorkflowMutation(nextState, serverAction, { createId, now });
  const persistence = await getPlatformStateRepository().writeSnapshot(nextState);

  try {
    await getPlatformStateRepository().recordEvent({
      action: result.action,
      actorId: session.userId,
      entityType: result.entityType,
      entityId: result.entityId,
      summary: result.summary,
      payload: {
        request: serverAction,
        result: result.result,
        sourcePersistence: snapshot.persistence,
      },
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
