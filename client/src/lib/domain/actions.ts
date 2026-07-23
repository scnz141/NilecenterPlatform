import type {
  Assignment,
  AssignmentSubmission,
  AttendanceStatus,
  AuditLog,
  CalendarEvent,
  CalendarEventType,
  ClassGroup,
  ClassSession,
  Certificate,
  CommunicationLog,
  Document,
  EntityStatus,
  Grade,
  IntegrationConfig,
  IntegrationStatus,
  Application,
  Lead,
  Lesson,
  LessonResource,
  Module,
  Message,
  MessageAttachment,
  Notification,
  Payment,
  PendingMediaAttachment,
  PlacementTestBooking,
  PlacementTestResult,
  PlatformState,
  ReportPreset,
  ReportType,
  ScopedPortalSettings,
  StaffAvailabilityStatus,
  StaffPermissionScope,
  StaffProfile,
  StaffRole,
  SupportTicket,
  StudentEntrySource,
  StudentIntakeDocumentType,
  StudentStatus,
  UserNotificationPreferences,
  QuestionBankItem,
  QuizAttempt,
  QuranProgressRecord,
  RecitationSubmission,
  Room,
  TeacherAvailability,
} from "./types.js";
import {
  roleOrder,
  rolePermissions,
  type Permission,
  type Role,
} from "../platformData.js";
import {
  messageConversationId,
  replyMessageSubject,
} from "./messageThreads.js";
import {
  assertStudentIntakeLineage,
  enrollmentForInvoice,
  teacherHasStudentRosterAuthority,
} from "./relationships.js";

export type PlatformLearningAction =
  | {
      type: "lesson.start";
      lessonId: string;
      enrollmentId?: string;
      studentId?: string;
      actorId?: string;
    }
  | {
      type: "lesson.complete";
      lessonId: string;
      enrollmentId?: string;
      studentId?: string;
      actorId?: string;
    }
  | {
      type: "assignment.submit";
      assignmentId: string;
      response: string;
      pendingMedia?: PendingMediaAttachment[];
      studentId?: string;
      actorId?: string;
      idempotencyKey?: string;
      expectedVersion?: number;
    }
  | {
      type: "quiz.submit";
      quizId: string;
      answers: Record<string, string>;
      pendingMedia?: PendingMediaAttachment[];
      studentId?: string;
      actorId?: string;
    };

export type CreateLeadActionInput = Pick<
  Lead,
  "fullName" | "email" | "phone" | "subject" | "notes"
> & {
  branchId?: string;
  country?: string;
  source?: Lead["source"];
  sourceKey?: string;
  idempotencyKey?: string;
};

export type CreateApplicationActionInput = Pick<
  Application,
  "branchId" | "courseInterest" | "schedulePreference"
> & {
  fullName: string;
  email: string;
  phone: string;
  country?: string;
  notes?: string;
  source?: Lead["source"];
  sourceKey?: string;
  idempotencyKey?: string;
};

export type CreatePlacementActionInput = Pick<
  PlacementTestBooking,
  "fullName" | "email" | "phone" | "subject" | "preferredDate" | "currentLevel"
> & {
  branchId?: string;
  leadId?: string;
  sourceKey?: string;
  idempotencyKey?: string;
};

export type CreateSupportTicketCommand = {
  requesterId?: string;
  subject: string;
  details: string;
  category: string;
  priority: SupportTicket["priority"];
  actorId?: string;
  sourceKey?: string;
  idempotencyKey?: string;
};

export type CreateCurriculumModuleActionInput = Pick<
  Module,
  "courseId" | "title" | "outcomes"
>;

export type UpdateCourseStatusActionInput = {
  courseId: string;
  status: Extract<EntityStatus, "draft" | "active" | "paused" | "completed">;
};

export type UpdateMaterialPublishActionInput = Pick<
  LessonResource,
  "id" | "published"
>;

export type CreateCalendarEventActionInput = {
  title: string;
  eventType: CalendarEventType;
  startsAt: string;
  endsAt: string;
  ownerId?: string;
  branchId?: string;
  roomId?: string;
  classGroupId?: string;
  idempotencyKey?: string;
};

export type RescheduleClassSessionActionInput = {
  sessionId: string;
  startsAt: string;
  endsAt: string;
  roomId?: string;
  reason: string;
};

export type CancelClassSessionActionInput = {
  sessionId: string;
  reason: string;
};

export type SubmitAttendanceExceptionActionInput = {
  attendanceRecordId: string;
  reason: string;
  studentId?: string;
  sourceKey?: string;
};

export type ReviewAttendanceExceptionActionInput = {
  requestId: string;
  decision: "approved" | "rejected";
  reviewNote: string;
};

export type CreateAssignmentActionInput = {
  courseRunId: string;
  classGroupId?: string;
  title: string;
  dueAt: string;
  submissionType: "text" | "file" | "audio" | "video";
  rubric: string[];
  idempotencyKey?: string;
};

export type UpdateAssignmentActionInput = {
  assignmentId: string;
  title: string;
  dueAt: string;
  submissionType: Assignment["submissionType"];
  rubric: string[];
};

export type UpdateAssignmentStatusActionInput = {
  assignmentId: string;
  status: Extract<EntityStatus, "active" | "completed" | "cancelled">;
  reason?: string;
  idempotencyKey?: string;
  expectedVersion?: number;
};

export type CreateQuizActionInput = {
  courseRunId: string;
  title: string;
  dueAt: string;
  durationMinutes: number;
  questionTypes: string[];
  questionIds?: string[];
  attemptsAllowed: number;
};

export type UpdateQuizActionInput = {
  quizId: string;
  title: string;
  dueAt: string;
  durationMinutes: number;
  attemptsAllowed: number;
};

export type UpdateQuizStatusActionInput = {
  quizId: string;
  status: Extract<EntityStatus, "active" | "completed" | "cancelled">;
  reason?: string;
};

export type CreateQuestionActionInput = {
  courseRunId: string;
  prompt: string;
  questionType: QuestionBankItem["type"];
  difficulty: QuestionBankItem["difficulty"];
  tags: string[];
  choices?: string[];
  answerKey?: string;
  rubric?: string[];
};

export type SendMessageActionInput = {
  fromUserId?: string;
  toUserId: string;
  recipientUserIds?: string[];
  replyToMessageId?: string;
  subject: string;
  body: string;
  channel?: CommunicationLog["channel"];
  attachments?: MessageAttachment[];
};

export type SubmitRecitationActionInput = Pick<
  RecitationSubmission,
  "studentId" | "teacherId" | "title"
> & {
  pendingMedia?: PendingMediaAttachment[];
};

export type AssignTeacherActionInput = {
  userId: string;
  courseRunId: string;
  status?: EntityStatus;
  departmentId?: string;
  specialties?: string[];
  teachingLevels?: string[];
  availability?: string[];
  actorId?: string;
};

export type UpdateUserActionInput = {
  userId: string;
  activeRole?: Role;
  roles?: Role[];
  branchId?: string;
  departmentId?: string;
  status?: EntityStatus;
  actorId?: string;
};

export type UpdatePermissionActionInput = {
  role: Role;
  permission: Permission;
  granted: boolean;
  actorId?: string;
};

export type UpdateBranchActionInput = {
  branchId: string;
  status: EntityStatus;
  actorId?: string;
};

export type UpdateRoomStatusActionInput = {
  roomId: Room["id"];
  status: Extract<EntityStatus, "active" | "pending" | "paused">;
  actorId?: string;
};

export type CreateRoomActionInput = {
  branchId: string;
  name: string;
  capacity: number;
  equipment?: string[];
  actorId?: string;
};

export type CreateClassGroupActionInput = {
  courseRunId: string;
  name: string;
  capacity: number;
  schedule: string;
  roomId: string;
  actorId?: string;
};

export type CreateCourseRunActionInput = {
  courseId: string;
  branchId: string;
  teacherId: string;
  term: string;
  startsOn: string;
  endsOn: string;
  status?: Extract<EntityStatus, "pending" | "active">;
  actorId?: string;
};

export type UpdateClassGroupActionInput = {
  classGroupId: string;
  name: string;
  capacity: number;
  schedule: string;
  roomId: string;
  actorId?: string;
};

export type UpdateClassGroupStatusActionInput = {
  classGroupId: string;
  status: ClassGroup["status"];
  actorId?: string;
};

export type TransferEnrollmentActionInput = {
  enrollmentId: string;
  classGroupId: string;
  reason: string;
  actorId?: string;
};

export type UpdateEnrollmentStatusActionInput = {
  enrollmentId: string;
  status: Extract<
    StudentStatus,
    "active" | "paused" | "completed" | "cancelled"
  >;
  reason?: string;
  actorId?: string;
};

export type UpdateIntegrationStatusActionInput = {
  integrationId: IntegrationConfig["id"];
  status: IntegrationStatus;
  actorId?: string;
};

export type CheckIntegrationActionInput = {
  integrationId: IntegrationConfig["id"];
  actorId?: string;
};

export type CheckSystemHealthActionInput = {
  score: number;
  actorId?: string;
};

export type SavePlatformSettingsActionInput = {
  organization: string;
  defaultLanguage: string;
  academicTerm: string;
  retentionDays: number;
  actorId?: string;
};

export type SavePortalSettingsActionInput = Pick<
  ScopedPortalSettings,
  | "role"
  | "scopeId"
  | "label"
  | "language"
  | "timezone"
  | "notifications"
  | "reviewCadenceDays"
  | "paymentReminderDays"
  | "attendanceCutoffMinutes"
> & {
  actorId?: string;
};

function validateAccountStatus(
  status: EntityStatus | undefined,
  fallback: EntityStatus = "active"
) {
  const nextStatus = status ?? fallback;
  if (!accountStatuses.includes(nextStatus)) {
    throw new Error("Choose a valid account status.");
  }
  return nextStatus;
}

const assignableCourseRunStatuses: EntityStatus[] = ["active", "pending"];
const pendingMediaKinds = new Set<PendingMediaAttachment["kind"]>([
  "document",
  "image",
  "audio",
  "video",
]);
const maxPendingMediaSize = 25 * 1024 * 1024;

function cleanPendingMedia(input?: PendingMediaAttachment[]) {
  return (input ?? []).slice(0, 3).map(item => {
    const name = item.name.trim().slice(0, 120);
    const type = item.type.trim().slice(0, 120) || "application/octet-stream";
    const previewLabel = item.previewLabel.trim().slice(0, 160) || name;
    const size = Math.round(Number(item.size));
    if (!name) throw new Error("Attachment name is required.");
    if (!Number.isFinite(size) || size <= 0 || size > maxPendingMediaSize) {
      throw new Error("Attachment must be 25 MB or smaller.");
    }
    if (!pendingMediaKinds.has(item.kind))
      throw new Error("Choose a valid attachment type.");
    return {
      id: item.id.trim().slice(0, 80) || `pending_${Date.now().toString(36)}`,
      name,
      type,
      size,
      kind: item.kind,
      previewLabel,
      storageStatus: "pending_storage" as const,
      createdAt: item.createdAt || new Date().toISOString(),
    };
  });
}

export type CreateUserActionInput = {
  name: string;
  email: string;
  phone: string;
  role: Role;
  branchId?: string;
  departmentId?: string;
  status?: EntityStatus;
  preferredLanguage?: string;
  courseRunId?: string;
  classGroupId?: string;
  currentLevel?: string;
  ageGroup?: string;
  guardianName?: string;
  guardianPhone?: string;
  subjects?: string[];
  specialization?: string[];
  availability?: string[];
  notes?: string;
  actorId?: string;
};

export type CreateStaffUserActionInput = {
  name: string;
  email: string;
  phone?: string;
  role: StaffRole;
  branchId?: string;
  departmentId?: string;
  status?: EntityStatus;
  permissionScope?: StaffPermissionScope;
  subjects?: string[];
  teachingLevels?: string[];
  availabilityStatus?: StaffAvailabilityStatus;
  operationalScope?: string[];
  notes?: string;
  actorId?: string;
};

export type CreateStudentActionInput = {
  fullName: string;
  email: string;
  phone: string;
  branchId: string;
  preferredLanguage: string;
  courseInterest: string;
  ageGroup: string;
  guardianName?: string;
  guardianPhone?: string;
  currentLevel?: string;
  placementResult?: string;
  status?: Extract<
    StudentStatus,
    "ready_to_enroll" | "enrolled" | "active" | "paused"
  >;
  notes?: string;
  courseRunId: string;
  classGroupId: string;
  source?: StudentEntrySource;
  leadId?: string;
  applicationId?: string;
  placementTestId?: string;
  actorId?: string;
};

export type UpdateStudentStatusActionInput = {
  studentId: string;
  status: StudentStatus;
  notes?: string;
  actorId?: string;
};

export type AddStudentDocumentActionInput = {
  studentId: string;
  documentType: StudentIntakeDocumentType;
  attachment: PendingMediaAttachment;
  actorId?: string;
};

export type UpdateProfileActionInput = {
  userId?: string;
  name?: string;
  phone?: string;
  preferredLanguage?: string;
  timezone?: string;
  notificationPreferences?: Partial<UserNotificationPreferences>;
  country?: string;
  guardianName?: string;
  guardianPhone?: string;
  title?: string;
  availabilityStatus?: StaffAvailabilityStatus;
  actorId?: string;
  idempotencyKey?: string;
  expectedVersion?: number;
};

export type PlatformWorkflowAction =
  | PlatformLearningAction
  | ({ type: "lead.create"; actorId?: string } & CreateLeadActionInput)
  | ({
      type: "application.create";
      actorId?: string;
    } & CreateApplicationActionInput)
  | ({ type: "user.create" } & CreateUserActionInput)
  | ({ type: "staff.user.create" } & CreateStaffUserActionInput)
  | ({ type: "student.create" } & CreateStudentActionInput)
  | ({ type: "student.status.update" } & UpdateStudentStatusActionInput)
  | ({ type: "student.document.add" } & AddStudentDocumentActionInput)
  | ({ type: "support.ticket.create" } & CreateSupportTicketCommand)
  | {
      type: "audit.export";
      rowCount: number;
      format: "csv";
      actorId?: string;
    }
  | ({ type: "profile.update" } & UpdateProfileActionInput)
  | ({ type: "user.update" } & UpdateUserActionInput)
  | ({ type: "permission.update" } & UpdatePermissionActionInput)
  | ({ type: "branch.update" } & UpdateBranchActionInput)
  | ({ type: "room.status.update" } & UpdateRoomStatusActionInput)
  | ({ type: "room.create" } & CreateRoomActionInput)
  | ({ type: "class.create" } & CreateClassGroupActionInput)
  | ({ type: "course-run.create" } & CreateCourseRunActionInput)
  | ({ type: "class.update" } & UpdateClassGroupActionInput)
  | ({ type: "class.status.update" } & UpdateClassGroupStatusActionInput)
  | ({ type: "enrollment.transfer" } & TransferEnrollmentActionInput)
  | ({ type: "enrollment.status.update" } & UpdateEnrollmentStatusActionInput)
  | ({ type: "integration.status.update" } & UpdateIntegrationStatusActionInput)
  | ({ type: "integration.local_check" } & CheckIntegrationActionInput)
  | ({ type: "system.health_check" } & CheckSystemHealthActionInput)
  | ({ type: "settings.save" } & SavePlatformSettingsActionInput)
  | ({ type: "portal.settings.save" } & SavePortalSettingsActionInput)
  | ({
      type: "placement.create";
      actorId?: string;
    } & CreatePlacementActionInput)
  | ({
      type: "curriculum.module.create";
      actorId?: string;
    } & CreateCurriculumModuleActionInput)
  | ({
      type: "course.status.update";
      actorId?: string;
    } & UpdateCourseStatusActionInput)
  | ({
      type: "material.publish.update";
      actorId?: string;
    } & UpdateMaterialPublishActionInput)
  | ({
      type: "assignment.create";
      actorId?: string;
    } & CreateAssignmentActionInput)
  | ({ type: "quiz.create"; actorId?: string } & CreateQuizActionInput)
  | ({ type: "quiz.update"; actorId?: string } & UpdateQuizActionInput)
  | ({
      type: "quiz.status.update";
      actorId?: string;
    } & UpdateQuizStatusActionInput)
  | ({ type: "question.create"; actorId?: string } & CreateQuestionActionInput)
  | {
      type: "quiz.questions.set";
      quizId: string;
      questionIds: string[];
      actorId?: string;
    }
  | {
      type: "assignment.grade";
      submissionId: string;
      score: number;
      feedback: string;
      actorId?: string;
      idempotencyKey?: string;
      expectedVersion?: number;
    }
  | {
      type: "quiz.review";
      attemptId: string;
      score: number;
      feedback: string;
      actorId?: string;
    }
  | {
      type: "attendance.save";
      classGroupId: string;
      sessionId: string;
      statuses: Record<string, AttendanceStatus>;
      notes?: Record<string, string>;
      expectedVersion?: number;
      idempotencyKey?: string;
      actorId?: string;
    }
  | ({
      type: "calendar.create";
      actorId?: string;
    } & CreateCalendarEventActionInput)
  | ({
      type: "class.session.reschedule";
      actorId?: string;
    } & RescheduleClassSessionActionInput)
  | ({
      type: "class.session.cancel";
      actorId?: string;
    } & CancelClassSessionActionInput)
  | ({
      type: "attendance.exception.submit";
      actorId?: string;
    } & SubmitAttendanceExceptionActionInput)
  | ({
      type: "attendance.exception.review";
      actorId?: string;
    } & ReviewAttendanceExceptionActionInput)
  | ({
      type: "assignment.update";
      actorId?: string;
    } & UpdateAssignmentActionInput)
  | ({
      type: "assignment.status.update";
      actorId?: string;
    } & UpdateAssignmentStatusActionInput)
  | ({ type: "message.send"; actorId?: string } & SendMessageActionInput)
  | { type: "certificate.approve"; certificateId: string; actorId?: string }
  | { type: "certificate.issue"; certificateId: string; actorId?: string }
  | {
      type: "certificate.reject";
      certificateId: string;
      reason: string;
      actorId?: string;
    }
  | {
      type: "payment.record";
      invoiceId: string;
      amount?: number;
      method?: Payment["method"];
      reference?: string;
      actorId?: string;
    }
  | {
      type: "report.preset.save";
      role: Role;
      label: string;
      reportType: ReportType;
      search?: string;
      status?: string;
      rowCount?: number;
      actorId?: string;
    }
  | {
      type: "placement.result.record";
      bookingId: string;
      recommendedLevel: string;
      score: number;
      notes: string;
      actorId?: string;
      idempotencyKey?: string;
      expectedVersion?: number;
    }
  | {
      type: "lead.convert";
      leadId: string;
      branchId?: string;
      actorId?: string;
      idempotencyKey?: string;
      expectedVersion?: number;
    }
  | { type: "application.convert"; applicationId: string; actorId?: string }
  | {
      type: "enrollment.activate";
      workflowId: string;
      courseRunId?: string;
      classGroupId?: string;
      actorId?: string;
    }
  | ({ type: "teacher.assign" } & AssignTeacherActionInput)
  | {
      type: "quran.progress.update";
      recordId: string;
      memorizedPercent: number;
      tajweedScore: number;
      notes: string;
      actorId?: string;
    }
  | {
      type: "recitation.review";
      submissionId: string;
      feedback: string;
      actorId?: string;
    }
  | ({
      type: "recitation.submit";
      actorId?: string;
    } & SubmitRecitationActionInput)
  | { type: "message.read"; messageId: string; actorId?: string }
  | { type: "notification.read"; notificationId: string; actorId?: string };

export type PlatformLearningActionResult =
  | {
      action: "lesson.start" | "lesson.complete";
      entityType: "Lesson";
      entityId: string;
      summary: string;
      result: Lesson;
    }
  | {
      action: "assignment.submit";
      entityType: "AssignmentSubmission";
      entityId: string;
      summary: string;
      result: AssignmentSubmission;
    }
  | {
      action: "quiz.submit";
      entityType: "QuizAttempt";
      entityId: string;
      summary: string;
      result: QuizAttempt;
    };

export type PlatformWorkflowActionResult =
  | PlatformLearningActionResult
  | {
      action: string;
      entityType: string;
      entityId: string;
      summary: string;
      result: unknown;
    };

type MutationContext = {
  createId: (prefix: string) => string;
  now: () => string;
};

const defaultContext: MutationContext = {
  createId: prefix =>
    `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
  now: () => new Date().toISOString(),
};

function context(input?: Partial<MutationContext>): MutationContext {
  return { ...defaultContext, ...input };
}

function appendAudit(
  state: PlatformState,
  ctx: MutationContext,
  action: string,
  entityType: string,
  entityId: string,
  summary: string,
  actorId = "usr_student_demo",
  sourceKey?: string
) {
  const audit: AuditLog = {
    id: ctx.createId("audit"),
    actorId,
    action,
    entityType,
    entityId,
    summary,
    sourceKey,
    createdAt: ctx.now(),
  };
  state.auditLogs = [audit, ...state.auditLogs].slice(0, 160);
  return audit;
}

function notify(
  state: PlatformState,
  ctx: MutationContext,
  input: Omit<Notification, "id" | "read" | "createdAt">
) {
  const notification: Notification = {
    id: ctx.createId("not"),
    read: false,
    createdAt: ctx.now(),
    ...input,
  };
  state.notifications = [notification, ...state.notifications].slice(0, 80);
  return notification;
}

function notifyActiveLearnersForAssignment(
  state: PlatformState,
  ctx: MutationContext,
  assignment: Assignment,
  input: Omit<Notification, "id" | "read" | "createdAt" | "userId">
) {
  const learnerUserIds = new Set(
    activeLearnersForAssignment(state, assignment).map(item => item.userId)
  );

  learnerUserIds.forEach(userId => notify(state, ctx, { ...input, userId }));
}

function activeLearnersForAssignment(
  state: PlatformState,
  assignment: Assignment
) {
  return state.enrollments
    .filter(
      enrollment =>
        enrollment.courseRunId === assignment.courseRunId &&
        enrollment.status === "active"
    )
    .map(enrollment => {
      const student = state.students.find(
        item => item.id === enrollment.studentId
      );
      const user = state.users.find(item => item.id === student?.userId);
      return student?.status === "active" && user?.status === "active"
        ? { studentId: student.id, userId: user.id }
        : undefined;
    })
    .filter(
      (
        item
      ): item is {
        studentId: string;
        userId: string;
      } => Boolean(item)
    );
}

function activeLearnersForQuiz(
  state: PlatformState,
  quiz: PlatformState["quizzes"][number]
) {
  return state.enrollments
    .filter(
      enrollment =>
        enrollment.courseRunId === quiz.courseRunId &&
        enrollment.status === "active"
    )
    .map(enrollment => {
      const student = state.students.find(
        item => item.id === enrollment.studentId
      );
      const user = state.users.find(item => item.id === student?.userId);
      return student?.status === "active" && user?.status === "active"
        ? { studentId: student.id, userId: user.id }
        : undefined;
    })
    .filter(
      (
        item
      ): item is {
        studentId: string;
        userId: string;
      } => Boolean(item)
    );
}

function notifyActiveLearnersForQuiz(
  state: PlatformState,
  ctx: MutationContext,
  quiz: PlatformState["quizzes"][number],
  input: Omit<Notification, "id" | "read" | "createdAt" | "userId">
) {
  const learnerUserIds = new Set(
    activeLearnersForQuiz(state, quiz).map(item => item.userId)
  );

  learnerUserIds.forEach(userId => notify(state, ctx, { ...input, userId }));
}

function requireLesson(state: PlatformState, lessonId: string) {
  const lesson = state.lessons.find(item => item.id === lessonId);
  if (!lesson) throw new Error(`Lesson ${lessonId} was not found.`);
  return lesson;
}

function requireAssignment(state: PlatformState, assignmentId: string) {
  const assignment = state.assignments.find(item => item.id === assignmentId);
  if (!assignment) throw new Error(`Assignment ${assignmentId} was not found.`);
  return assignment;
}

function requireQuiz(state: PlatformState, quizId: string) {
  const quiz = state.quizzes.find(item => item.id === quizId);
  if (!quiz) throw new Error(`Quiz ${quizId} was not found.`);
  return quiz;
}

function requireActiveStudent(state: PlatformState, studentId: string) {
  const student = state.students.find(item => item.id === studentId);
  const user = student
    ? state.users.find(item => item.id === student.userId)
    : undefined;
  if (
    !student ||
    student.status !== "active" ||
    !user ||
    user.status !== "active"
  ) {
    throw new Error(`Student ${studentId} must be active.`);
  }
  return student;
}

function requireActiveStudentEnrollment(
  state: PlatformState,
  studentId: string,
  courseRunId: string
) {
  requireActiveStudent(state, studentId);
  const courseRun = state.courseRuns.find(item => item.id === courseRunId);
  if (!courseRun) throw new Error(`Course run ${courseRunId} was not found.`);
  if (courseRun.status !== "active")
    throw new Error(`Course run ${courseRunId} must be active.`);
  const course = state.courses.find(item => item.id === courseRun.courseId);
  if (!course || course.status !== "active")
    throw new Error(`Course ${courseRun.courseId} must be active.`);
  const enrollment = state.enrollments.find(
    item =>
      item.studentId === studentId &&
      item.courseRunId === courseRun.id &&
      item.status === "active"
  );
  if (!enrollment) {
    throw new Error(
      `Student ${studentId} must have an active enrollment in course run ${courseRun.id}.`
    );
  }
  return { course, courseRun, enrollment };
}

function requireActiveLessonEnrollment(
  state: PlatformState,
  studentId: string,
  lesson: Lesson,
  enrollmentId?: string
) {
  requireActiveStudent(state, studentId);
  const module = state.modules.find(item => item.id === lesson.moduleId);
  if (!module)
    throw new Error(`Lesson ${lesson.id} is not linked to a course.`);
  const course = state.courses.find(item => item.id === module.courseId);
  if (!course || course.status !== "active")
    throw new Error(`Course ${module.courseId} must be active.`);

  const enrollments = state.enrollments.filter(enrollment => {
    if (enrollment.studentId !== studentId || enrollment.status !== "active")
      return false;
    const courseRun = state.courseRuns.find(
      run => run.id === enrollment.courseRunId
    );
    return (
      courseRun?.courseId === module.courseId && courseRun.status === "active"
    );
  });
  if (enrollments.length === 0) {
    throw new Error(
      `Student ${studentId} must have an active enrollment in an active course run for this lesson.`
    );
  }
  const enrollment = enrollmentId
    ? enrollments.find(item => item.id === enrollmentId)
    : enrollments.length === 1
      ? enrollments[0]
      : undefined;
  if (!enrollment) {
    if (enrollmentId) {
      throw new Error(
        `Enrollment ${enrollmentId} is not an active enrollment for this lesson.`
      );
    }
    throw new Error(
      "Enrollment selection is required when a student has multiple active runs for this course."
    );
  }
  return { courseId: module.courseId, enrollment };
}

function recomputeLessonCourseProgress(
  state: PlatformState,
  studentId: string,
  courseId: string,
  enrollmentId: string
) {
  const moduleIds = new Set(
    state.modules
      .filter(item => item.courseId === courseId)
      .map(item => item.id)
  );
  const lessonIds = new Set(
    state.lessons
      .filter(item => moduleIds.has(item.moduleId))
      .map(item => item.id)
  );
  const completedLessonIds = new Set(
    state.lessonProgress
      .filter(
        item =>
          item.studentId === studentId &&
          item.enrollmentId === enrollmentId &&
          item.status === "completed" &&
          lessonIds.has(item.lessonId)
      )
      .map(item => item.lessonId)
  );
  const progress =
    lessonIds.size === 0
      ? 0
      : Math.round((completedLessonIds.size / lessonIds.size) * 100);
  state.enrollments = state.enrollments.map(enrollment =>
    enrollment.id === enrollmentId ? { ...enrollment, progress } : enrollment
  );
}

function recomputeEnrollmentCurrentGrade(
  state: PlatformState,
  studentId: string,
  courseRunId: string
) {
  const gradePercentages = state.grades
    .filter(
      grade =>
        grade.studentId === studentId &&
        grade.courseRunId === courseRunId &&
        Number.isFinite(grade.score) &&
        Number.isFinite(grade.maxScore) &&
        grade.maxScore > 0
    )
    .map(grade =>
      Math.min(100, Math.max(0, (grade.score / grade.maxScore) * 100))
    );
  const currentGrade = gradePercentages.length
    ? Math.round(
        gradePercentages.reduce((total, grade) => total + grade, 0) /
          gradePercentages.length
      )
    : 0;
  state.enrollments = state.enrollments.map(enrollment =>
    enrollment.studentId === studentId && enrollment.courseRunId === courseRunId
      ? { ...enrollment, currentGrade }
      : enrollment
  );
}

export function applyStartLesson(
  state: PlatformState,
  input: {
    lessonId: string;
    enrollmentId?: string;
    studentId?: string;
    actorId?: string;
  },
  ctxInput?: Partial<MutationContext>
) {
  const ctx = context(ctxInput);
  const studentId = input.studentId ?? "stu_demo";
  const actorId = input.actorId ?? "usr_student_demo";
  const lesson = requireLesson(state, input.lessonId);
  const { enrollment } = requireActiveLessonEnrollment(
    state,
    studentId,
    lesson,
    input.enrollmentId
  );
  const existing = state.lessonProgress.find(
    item =>
      item.lessonId === lesson.id &&
      item.studentId === studentId &&
      item.enrollmentId === enrollment.id
  );

  if (existing) {
    if (existing.status !== "completed") existing.status = "in_progress";
  } else {
    state.lessonProgress = [
      {
        id: ctx.createId("lp"),
        studentId,
        enrollmentId: enrollment.id,
        lessonId: lesson.id,
        status: "in_progress",
      },
      ...state.lessonProgress,
    ];
  }

  appendAudit(
    state,
    ctx,
    "lesson.started",
    "Lesson",
    lesson.id,
    `Opened lesson ${lesson.title}.`,
    actorId
  );
  return lesson;
}

export function applyCompleteLesson(
  state: PlatformState,
  input: {
    lessonId: string;
    enrollmentId?: string;
    studentId?: string;
    actorId?: string;
  },
  ctxInput?: Partial<MutationContext>
) {
  const ctx = context(ctxInput);
  const studentId = input.studentId ?? "stu_demo";
  const actorId = input.actorId ?? "usr_student_demo";
  const lesson = requireLesson(state, input.lessonId);
  const { courseId, enrollment } = requireActiveLessonEnrollment(
    state,
    studentId,
    lesson,
    input.enrollmentId
  );
  const existing = state.lessonProgress.find(
    item =>
      item.lessonId === lesson.id &&
      item.studentId === studentId &&
      item.enrollmentId === enrollment.id
  );

  if (existing) {
    existing.status = "completed";
    existing.completedAt = existing.completedAt ?? ctx.now();
  } else {
    state.lessonProgress = [
      {
        id: ctx.createId("lp"),
        studentId,
        enrollmentId: enrollment.id,
        lessonId: lesson.id,
        status: "completed",
        completedAt: ctx.now(),
      },
      ...state.lessonProgress,
    ];
  }

  recomputeLessonCourseProgress(state, studentId, courseId, enrollment.id);

  appendAudit(
    state,
    ctx,
    "lesson.completed",
    "Lesson",
    lesson.id,
    `Completed lesson ${lesson.title}.`,
    actorId
  );
  return lesson;
}

export function applySubmitAssignment(
  state: PlatformState,
  input: {
    assignmentId: string;
    response: string;
    pendingMedia?: PendingMediaAttachment[];
    studentId?: string;
    actorId?: string;
  },
  ctxInput?: Partial<MutationContext>
) {
  const ctx = context(ctxInput);
  const studentId = input.studentId ?? "stu_demo";
  const actorId = input.actorId ?? "usr_student_demo";
  const assignment = requireAssignment(state, input.assignmentId);
  if (assignment.status !== "active")
    throw new Error(`Assignment ${assignment.id} must be active.`);
  const { courseRun } = requireActiveStudentEnrollment(
    state,
    studentId,
    assignment.courseRunId
  );
  const pendingMedia = cleanPendingMedia(input.pendingMedia);
  if (!input.response.trim() && pendingMedia.length === 0)
    throw new Error("Assignment response or attachment is required.");
  const existing = state.assignmentSubmissions.find(
    item =>
      item.assignmentId === assignment.id &&
      item.studentId === studentId &&
      item.status !== "completed"
  );
  const submission: AssignmentSubmission = {
    id: existing?.id ?? ctx.createId("sub"),
    assignmentId: assignment.id,
    studentId,
    submittedAt: ctx.now(),
    status: "pending" as EntityStatus,
    response: input.response,
    pendingMedia,
  };

  state.assignmentSubmissions = existing
    ? state.assignmentSubmissions.map(item =>
        item.id === existing.id ? submission : item
      )
    : [submission, ...state.assignmentSubmissions];
  notify(state, ctx, {
    userId: courseRun.teacherId,
    title: "Assignment submitted",
    body: `${assignment.title} is ready for review.`,
    href: "/app/teacher/grading",
  });
  appendAudit(
    state,
    ctx,
    existing ? "assignment.resubmitted" : "assignment.submitted",
    "AssignmentSubmission",
    submission.id,
    `Submitted ${assignment.title}${pendingMedia.length ? ` with ${pendingMedia.length} pending attachment(s)` : ""}.`,
    actorId
  );
  return submission;
}

export function applySubmitQuizAttempt(
  state: PlatformState,
  input: {
    quizId: string;
    answers: Record<string, string>;
    pendingMedia?: PendingMediaAttachment[];
    studentId?: string;
    actorId?: string;
  },
  ctxInput?: Partial<MutationContext>
) {
  const ctx = context(ctxInput);
  const studentId = input.studentId ?? "stu_demo";
  const actorId = input.actorId ?? "usr_student_demo";
  const quiz = requireQuiz(state, input.quizId);
  if (quiz.status !== "active")
    throw new Error(`Quiz ${quiz.id} must be active.`);
  const { courseRun } = requireActiveStudentEnrollment(
    state,
    studentId,
    quiz.courseRunId
  );
  const previousAttempts = state.quizAttempts.filter(
    attempt => attempt.quizId === quiz.id && attempt.studentId === studentId
  );
  if (quiz.attemptsAllowed <= 0)
    throw new Error("This quiz is not accepting attempts.");
  if (previousAttempts.length >= quiz.attemptsAllowed) {
    throw new Error("No quiz attempts remaining.");
  }

  const submittedAnswerEntries = Object.entries(input.answers)
    .map(
      ([questionId, answer]) => [questionId, answer.trim()] as [string, string]
    )
    .filter(([, answer]) => answer.length > 0);
  const submittedAnswers: Record<string, string> = Object.fromEntries(
    submittedAnswerEntries
  );
  const pendingMedia = cleanPendingMedia(input.pendingMedia);
  const attachedQuestions = quiz.questionIds.flatMap(questionId => {
    const question = state.questionBankItems.find(
      item => item.id === questionId
    );
    return question &&
      question.courseRunId === quiz.courseRunId &&
      question.status === "active"
      ? [question]
      : [];
  });

  if (attachedQuestions.length > 0) {
    const attachedIds = new Set(attachedQuestions.map(question => question.id));
    const unknownAnswerId = Object.keys(submittedAnswers).find(
      questionId => !attachedIds.has(questionId)
    );
    if (unknownAnswerId)
      throw new Error("Quiz answers must match attached questions.");
    const mediaQuestionPresent = attachedQuestions.some(
      question =>
        question.type === "oral_record" || question.type === "file_upload"
    );
    if (
      Object.keys(submittedAnswers).length === 0 &&
      (!mediaQuestionPresent || pendingMedia.length === 0)
    )
      throw new Error("Quiz answer is required.");
  } else if (
    Object.keys(submittedAnswers).length === 0 &&
    pendingMedia.length === 0
  ) {
    throw new Error("Quiz answer is required.");
  }

  const objectiveQuestionTypes = new Set<QuestionBankItem["type"]>([
    "multiple_choice",
    "true_false",
  ]);
  const requiresManualReview =
    attachedQuestions.length === 0 ||
    attachedQuestions.some(
      question =>
        !objectiveQuestionTypes.has(question.type) || !question.answerKey
    );
  const score = requiresManualReview
    ? 0
    : Math.round(
        attachedQuestions.reduce((total, question) => {
          const answer = submittedAnswers[question.id] ?? "";
          if (!answer) return total;
          return (
            total +
            (answer.trim().toLowerCase() ===
            question.answerKey?.trim().toLowerCase()
              ? 100
              : 0)
          );
        }, 0) / attachedQuestions.length
      );
  const attempt: QuizAttempt = {
    id: ctx.createId("attempt"),
    quizId: quiz.id,
    studentId,
    startedAt: ctx.now(),
    submittedAt: ctx.now(),
    status: (requiresManualReview ? "pending" : "completed") as EntityStatus,
    score,
    maxScore: 100,
    answers: submittedAnswers,
    pendingMedia,
  };

  state.quizAttempts = [attempt, ...state.quizAttempts];
  if (requiresManualReview) {
    notify(state, ctx, {
      userId: courseRun.teacherId,
      title: "Quiz submitted",
      body: `${quiz.title} is ready for review.`,
      href: "/app/teacher/quizzes/review",
    });
  } else {
    const feedback =
      score >= 80
        ? "Auto-graded result."
        : "Auto-graded result. Review the next lesson before trying again.";
    const existingGrade = state.grades.find(
      grade =>
        grade.studentId === studentId &&
        grade.courseRunId === quiz.courseRunId &&
        (grade.itemId
          ? grade.itemId === quiz.id
          : grade.itemTitle === quiz.title)
    );
    if (existingGrade) {
      existingGrade.itemId = quiz.id;
      existingGrade.itemTitle = quiz.title;
      existingGrade.score = score;
      existingGrade.maxScore = 100;
      existingGrade.feedback = feedback;
    } else {
      const grade: Grade = {
        id: ctx.createId("grade"),
        studentId,
        courseRunId: quiz.courseRunId,
        itemId: quiz.id,
        itemTitle: quiz.title,
        score,
        maxScore: 100,
        feedback,
      };
      state.grades = [grade, ...state.grades];
    }
    recomputeEnrollmentCurrentGrade(state, studentId, quiz.courseRunId);
  }
  appendAudit(
    state,
    ctx,
    "quiz.submitted",
    "QuizAttempt",
    attempt.id,
    requiresManualReview
      ? `Submitted ${quiz.title} for teacher review${pendingMedia.length ? ` with ${pendingMedia.length} pending attachment(s)` : ""}.`
      : `Submitted ${quiz.title} with ${score}/100.`,
    actorId
  );
  return attempt;
}

function messageRouteForUser(user?: PlatformState["users"][number]) {
  switch (user?.activeRole) {
    case "student":
      return "/app/student/messages";
    case "teacher":
      return "/app/teacher/messages";
    case "registrar":
      return "/app/registrar/messages";
    case "headofdepartment":
      return "/app/hod/messages";
    case "branchadmin":
      return "/app/branch/messages";
    case "superadmin":
      return "/app/admin/dashboard";
    default:
      return "/app";
  }
}

function defaultAdmissionsBranchId(state: PlatformState, actorId?: string) {
  const actor = state.users.find(user => user.id === actorId);
  if (
    actor?.branchId &&
    state.branches.some(branch => branch.id === actor.branchId)
  )
    return actor.branchId;
  const staffProfile = state.staffProfiles.find(
    profile => profile.userId === actorId && profile.role === "registrar"
  );
  const scopedBranch = staffProfile?.branchIds.find(branchId =>
    state.branches.some(branch => branch.id === branchId)
  );
  return (
    scopedBranch ??
    state.branches.find(branch => branch.id === "br_online")?.id ??
    state.branches[0]?.id ??
    "br_online"
  );
}

function appendInternalCommunicationLog(
  state: PlatformState,
  ctx: MutationContext,
  input: {
    actorId: string;
    subject: string;
    body: string;
    relatedUserId?: string;
    sourceKey?: string;
  }
) {
  const log: CommunicationLog = {
    id: ctx.createId("comm"),
    actorId: input.actorId,
    channel: "manual",
    subject: input.subject,
    body: input.body,
    relatedUserId: input.relatedUserId,
    sourceKey: input.sourceKey,
    status: "completed",
    createdAt: ctx.now(),
  };
  state.communicationLogs = [log, ...state.communicationLogs].slice(0, 120);
  return log;
}

function applyCreateLead(
  state: PlatformState,
  input: CreateLeadActionInput & { actorId?: string },
  ctx: MutationContext
) {
  const replayLead = input.sourceKey
    ? state.leads.find(lead => lead.sourceKey === input.sourceKey)
    : undefined;
  if (replayLead) return replayLead;

  const lead: Lead = {
    id: ctx.createId("lead"),
    fullName: input.fullName,
    email: input.email,
    phone: input.phone,
    country: input.country,
    subject: input.subject,
    source: input.source ?? "trial_form",
    status: "lead",
    notes: input.notes,
    sourceKey: input.sourceKey,
    createdAt: ctx.now(),
  };
  state.leads = [lead, ...state.leads];
  appendAudit(
    state,
    ctx,
    "lead.created",
    "Lead",
    lead.id,
    `Created lead for ${lead.fullName} from ${lead.source}.`,
    input.actorId ?? "usr_registrar_demo",
    input.sourceKey
  );
  return lead;
}

function applyCreateApplication(
  state: PlatformState,
  input: CreateApplicationActionInput & { actorId?: string },
  ctx: MutationContext
) {
  const replayApplication = input.sourceKey
    ? state.applications.find(item => item.sourceKey === input.sourceKey)
    : undefined;
  const replayLead = replayApplication
    ? state.leads.find(item => item.id === replayApplication.leadId)
    : undefined;
  const replayCommunication = replayApplication
    ? state.communicationLogs.find(item => item.sourceKey === input.sourceKey)
    : undefined;
  if (replayApplication) {
    if (!replayLead || !replayCommunication) {
      throw new Error("Application replay evidence is incomplete.");
    }
    return {
      lead: replayLead,
      application: replayApplication,
      communicationLog: replayCommunication,
    };
  }

  const fullName = input.fullName.trim();
  const email = input.email.trim().toLowerCase();
  const phone = input.phone.trim();
  const branchId = input.branchId.trim();
  const courseInterest = input.courseInterest.trim();
  const schedulePreference = input.schedulePreference.trim();
  if (
    !fullName ||
    !email ||
    !phone ||
    !branchId ||
    !courseInterest ||
    !schedulePreference
  ) {
    throw new Error(
      "Application name, email, phone, branch, course, and schedule are required."
    );
  }
  if (!email.includes("@"))
    throw new Error("Enter a valid application email address.");
  const branch = state.branches.find(item => item.id === branchId);
  if (!branch) throw new Error("Choose a valid branch for this application.");
  const existingLead = state.leads.find(
    lead => lead.email.toLowerCase() === email
  );
  const existingApplication = existingLead
    ? state.applications.find(
        application => application.leadId === existingLead.id
      )
    : undefined;
  if (existingApplication) {
    throw new Error("An application already exists for this email.");
  }
  if (state.users.some(user => user.email.toLowerCase() === email)) {
    throw new Error("This email is already in the identity directory.");
  }

  const actorId = input.actorId ?? "usr_registrar_demo";
  const lead: Lead = {
    id: ctx.createId("lead"),
    fullName,
    email,
    phone,
    country: input.country?.trim() || "Egypt",
    subject: courseInterest,
    source: input.source ?? "manual",
    status: "ready_to_enroll",
    notes: input.notes?.trim() || undefined,
    sourceKey: input.sourceKey,
    createdAt: ctx.now(),
  };
  const application: Application = {
    id: ctx.createId("app"),
    leadId: lead.id,
    branchId: branch.id,
    courseInterest,
    schedulePreference,
    sourceKey: input.sourceKey,
    status: "pending",
  };
  const communicationLog = appendInternalCommunicationLog(state, ctx, {
    actorId,
    subject: "Application intake",
    body: `Internal follow-up logged for ${fullName}; no external message was sent.`,
    sourceKey: input.sourceKey,
  });

  state.leads = [lead, ...state.leads];
  state.applications = [application, ...state.applications];
  appendAudit(
    state,
    ctx,
    "application.created",
    "Application",
    application.id,
    `Created application for ${fullName} in ${branch.name}.`,
    actorId,
    input.sourceKey
  );
  return { lead, application, communicationLog };
}

function applyCreatePlacementBooking(
  state: PlatformState,
  input: CreatePlacementActionInput & { actorId?: string },
  ctx: MutationContext
) {
  const replayBooking = input.sourceKey
    ? state.placementTests.find(item => item.sourceKey === input.sourceKey)
    : undefined;
  if (replayBooking) return replayBooking;

  const linkedLead = input.leadId
    ? state.leads.find(item => item.id === input.leadId)
    : undefined;
  if (input.leadId && !linkedLead) {
    throw new Error(`Lead ${input.leadId} was not found.`);
  }
  const linkedApplication = linkedLead
    ? state.applications.find(item => item.leadId === linkedLead.id)
    : undefined;
  const branchId = input.branchId ?? linkedApplication?.branchId ?? "br_online";
  if (linkedApplication && linkedApplication.branchId !== branchId) {
    throw new Error(
      "Placement branch must match the linked application branch."
    );
  }
  const branch = state.branches.find(
    item => item.id === branchId && item.status === "active"
  );
  if (!branch) throw new Error("Choose an active branch for this placement.");
  const booking: PlacementTestBooking = {
    id: ctx.createId("pt"),
    leadId: linkedLead?.id,
    fullName: linkedLead?.fullName ?? input.fullName,
    email: linkedLead?.email ?? input.email,
    phone: linkedLead?.phone ?? input.phone,
    branchId,
    subject:
      linkedApplication?.courseInterest ?? linkedLead?.subject ?? input.subject,
    preferredDate: input.preferredDate,
    currentLevel: input.currentLevel,
    sourceKey: input.sourceKey,
    status: "pending",
  };
  state.placementTests = [booking, ...state.placementTests];
  appendAudit(
    state,
    ctx,
    "placement.created",
    "PlacementTestBooking",
    booking.id,
    `Booked placement test for ${booking.fullName}.`,
    input.actorId ?? "usr_registrar_demo",
    input.sourceKey
  );
  return booking;
}

export function applyCreateSupportTicket(
  state: PlatformState,
  input: CreateSupportTicketCommand,
  ctxInput?: Partial<MutationContext>
) {
  const ctx = context(ctxInput);
  const replayTicket = input.sourceKey
    ? state.supportTickets.find(item => item.sourceKey === input.sourceKey)
    : undefined;
  if (replayTicket) return replayTicket;

  const requesterId = input.requesterId?.trim();
  const requester = state.users.find(
    user => user.id === requesterId && user.status === "active"
  );
  const subject = input.subject.trim();
  const details = input.details.trim();
  const category = input.category.trim();
  if (!requester) throw new Error("Support requester is not an active user.");
  if (subject.length < 4 || subject.length > 160) {
    throw new Error("Support subject must contain 4 to 160 characters.");
  }
  if (details.length < 20 || details.length > 3000) {
    throw new Error("Support details must contain 20 to 3000 characters.");
  }
  const ticket: SupportTicket = {
    id: ctx.createId("ticket"),
    requesterId: requester.id,
    subject,
    details,
    category,
    priority: input.priority,
    status: "pending",
    sourceKey: input.sourceKey,
    lastUpdatedAt: ctx.now(),
  };
  state.supportTickets = [ticket, ...state.supportTickets];
  appendAudit(
    state,
    ctx,
    "support.ticket_created",
    "SupportTicket",
    ticket.id,
    `Created support ticket: ${ticket.subject}.`,
    input.actorId,
    input.sourceKey
  );
  return ticket;
}

function applyCreateCurriculumModule(
  state: PlatformState,
  input: CreateCurriculumModuleActionInput & { actorId?: string },
  ctx: MutationContext
) {
  const course = state.courses.find(item => item.id === input.courseId);
  if (!course) throw new Error(`Course ${input.courseId} was not found.`);
  if (!input.title.trim()) throw new Error("Module title is required.");
  const courseModules = state.modules.filter(
    module => module.courseId === course.id
  );
  const module: Module = {
    id: ctx.createId("mod"),
    courseId: course.id,
    title: input.title.trim(),
    order: courseModules.length + 1,
    outcomes: input.outcomes.map(item => item.trim()).filter(Boolean),
  };
  state.modules = [...state.modules, module];
  appendAudit(
    state,
    ctx,
    "curriculum.module_created",
    "Module",
    module.id,
    `Added module ${module.title} to ${course.title}.`,
    input.actorId ?? "usr_hod_demo"
  );
  return module;
}

function applyUpdateCourseStatus(
  state: PlatformState,
  input: UpdateCourseStatusActionInput & { actorId?: string },
  ctx: MutationContext
) {
  const course = state.courses.find(item => item.id === input.courseId);
  if (!course) throw new Error(`Course ${input.courseId} was not found.`);
  const allowedStatuses = new Set<UpdateCourseStatusActionInput["status"]>([
    "draft",
    "active",
    "paused",
    "completed",
  ]);
  if (!allowedStatuses.has(input.status))
    throw new Error("Choose a valid course status.");
  const updated = { ...course, status: input.status };
  state.courses = state.courses.map(item =>
    item.id === course.id ? updated : item
  );
  appendAudit(
    state,
    ctx,
    "course.status_updated",
    "Course",
    course.id,
    `Set ${course.title} to ${input.status}.`,
    input.actorId ?? "usr_hod_demo"
  );
  return updated;
}

function applyUpdateMaterialPublish(
  state: PlatformState,
  input: UpdateMaterialPublishActionInput & { actorId?: string },
  ctx: MutationContext
) {
  const resource = state.resources.find(item => item.id === input.id);
  if (!resource) throw new Error(`Resource ${input.id} was not found.`);
  const updated = { ...resource, published: input.published };
  state.resources = state.resources.map(item =>
    item.id === resource.id ? updated : item
  );
  appendAudit(
    state,
    ctx,
    input.published ? "material.published" : "material.unpublished",
    "LessonResource",
    resource.id,
    `${resource.title} marked ${input.published ? "published" : "unpublished"}.`,
    input.actorId ?? "usr_teacher_demo"
  );
  return updated;
}

function teacherActor(state: PlatformState, actorId?: string) {
  const actor = actorId
    ? state.users.find(item => item.id === actorId)
    : undefined;
  return actor?.activeRole === "teacher" ? actor : undefined;
}

function teacherOwnsCourseRun(
  state: PlatformState,
  teacherUserId: string,
  courseRunId: string
) {
  return state.courseRuns.some(
    item => item.id === courseRunId && item.teacherId === teacherUserId
  );
}

function assertCourseRunReadyForDelivery(
  state: PlatformState,
  courseRun: PlatformState["courseRuns"][number],
  context: string
) {
  if (courseRun.status !== "active") {
    throw new Error(
      `Course run ${courseRun.id} must be active for ${context.toLowerCase()}.`
    );
  }

  const course = state.courses.find(item => item.id === courseRun.courseId);
  if (!course || course.status !== "active") {
    throw new Error(
      `Course ${courseRun.courseId} must be active for ${context.toLowerCase()}.`
    );
  }

  const branch = state.branches.find(item => item.id === courseRun.branchId);
  if (!branch || branch.status !== "active") {
    throw new Error(
      `Branch ${courseRun.branchId} must be active for ${context.toLowerCase()}.`
    );
  }

  const teacher = state.users.find(item => item.id === courseRun.teacherId);
  const teacherProfile = state.teachers.find(
    item => item.userId === courseRun.teacherId
  );
  const staffProfile = state.staffProfiles.find(
    item => item.userId === courseRun.teacherId && item.role === "teacher"
  );
  const teacherHasBranchScope = Boolean(
    staffProfile?.branchIds.includes(courseRun.branchId) ||
      staffProfile?.branchIds.includes("br_global")
  );
  if (
    !teacher ||
    teacher.status !== "active" ||
    !teacher.roles.includes("teacher") ||
    !teacherProfile ||
    teacherProfile.status !== "active" ||
    !staffProfile ||
    staffProfile.status !== "active" ||
    !teacherHasBranchScope
  ) {
    throw new Error(
      `Course run ${courseRun.id} requires an active, branch-scoped teacher for ${context.toLowerCase()}.`
    );
  }

  return { course, branch, teacher, teacherProfile, staffProfile };
}

function teacherOwnsStudentInCourseRun(
  state: PlatformState,
  teacherUserId: string,
  courseRunId: string,
  studentId: string
) {
  return teacherHasStudentRosterAuthority(
    state,
    teacherUserId,
    courseRunId,
    studentId
  );
}

function assertTeacherCanUseCourseRun(
  state: PlatformState,
  actorId: string | undefined,
  courseRunId: string,
  message: string
) {
  const actor = teacherActor(state, actorId);
  if (!actor) return;
  if (!teacherOwnsCourseRun(state, actor.id, courseRunId))
    throw new Error(message);
}

function assertTeacherCanManageStudentInRun(
  state: PlatformState,
  actorId: string | undefined,
  courseRunId: string,
  studentId: string,
  message: string
) {
  const actor = teacherActor(state, actorId);
  if (!actor) return;
  if (!teacherOwnsStudentInCourseRun(state, actor.id, courseRunId, studentId))
    throw new Error(message);
}

function applyCreateAssignment(
  state: PlatformState,
  input: CreateAssignmentActionInput & { actorId?: string },
  ctx: MutationContext
) {
  const run = state.courseRuns.find(item => item.id === input.courseRunId);
  if (!run) throw new Error(`Course run ${input.courseRunId} was not found.`);
  assertCourseRunReadyForDelivery(state, run, "Assessment creation");
  assertTeacherCanUseCourseRun(
    state,
    input.actorId,
    input.courseRunId,
    "Teacher can only create assessments for assigned course runs."
  );
  if (!input.title.trim()) throw new Error("Assignment title is required.");
  if (!Number.isFinite(new Date(input.dueAt).getTime())) {
    throw new Error("Assignment requires a valid due date.");
  }
  if (
    input.dueAt.slice(0, 10) < run.startsOn ||
    input.dueAt.slice(0, 10) > run.endsOn
  ) {
    throw new Error("Assignment due date must stay inside the course run.");
  }
  const rubric = input.rubric.map(item => item.trim()).filter(Boolean);
  const assignment = {
    id: ctx.createId("asg"),
    courseRunId: input.courseRunId,
    title: input.title.trim(),
    dueAt: input.dueAt,
    submissionType: input.submissionType,
    rubric: rubric.length ? rubric : ["Completion", "Accuracy"],
    status: "draft" as const,
  };
  state.assignments = [assignment, ...state.assignments];
  appendAudit(
    state,
    ctx,
    "assignment.created",
    "Assignment",
    assignment.id,
    `${assignment.title} created as draft.`,
    input.actorId ?? "usr_teacher_demo"
  );
  return assignment;
}

function assignmentLifecycleContext(
  state: PlatformState,
  assignmentId: string,
  actorId?: string
) {
  const assignment = state.assignments.find(item => item.id === assignmentId);
  if (!assignment) throw new Error(`Assignment ${assignmentId} was not found.`);
  const run = state.courseRuns.find(item => item.id === assignment.courseRunId);
  if (!run)
    throw new Error(`Course run ${assignment.courseRunId} was not found.`);
  assertTeacherCanUseCourseRun(
    state,
    actorId,
    run.id,
    "Teacher can only manage assignments for assigned course runs."
  );
  return { assignment, run };
}

function applyUpdateAssignment(
  state: PlatformState,
  input: UpdateAssignmentActionInput & { actorId?: string },
  ctx: MutationContext
) {
  const { assignment, run } = assignmentLifecycleContext(
    state,
    input.assignmentId,
    input.actorId
  );
  if (assignment.status !== "draft") {
    throw new Error("Only a draft assignment can be edited.");
  }
  if (
    state.assignmentSubmissions.some(
      item => item.assignmentId === assignment.id
    )
  ) {
    throw new Error("An assignment with submissions cannot be edited.");
  }
  const title = input.title.trim();
  const dueTime = new Date(input.dueAt).getTime();
  if (!title) throw new Error("Assignment title is required.");
  if (!Number.isFinite(dueTime))
    throw new Error("Assignment requires a valid due date.");
  if (
    input.dueAt.slice(0, 10) < run.startsOn ||
    input.dueAt.slice(0, 10) > run.endsOn
  ) {
    throw new Error("Assignment due date must stay inside the course run.");
  }
  const rubric = input.rubric.map(item => item.trim()).filter(Boolean);
  assignment.title = title;
  assignment.dueAt = input.dueAt;
  assignment.submissionType = input.submissionType;
  assignment.rubric = rubric.length ? rubric : ["Completion", "Accuracy"];
  appendAudit(
    state,
    ctx,
    "assignment.updated",
    "Assignment",
    assignment.id,
    `${assignment.title} draft updated.`,
    input.actorId ?? "usr_teacher_demo"
  );
  return assignment;
}

function applyUpdateAssignmentStatus(
  state: PlatformState,
  input: UpdateAssignmentStatusActionInput & { actorId?: string },
  ctx: MutationContext
) {
  const { assignment, run } = assignmentLifecycleContext(
    state,
    input.assignmentId,
    input.actorId
  );
  const reason = input.reason?.trim() ?? "";
  if (assignment.status === "completed" || assignment.status === "cancelled") {
    throw new Error("A terminal assignment cannot change status.");
  }
  const submissions = state.assignmentSubmissions.filter(
    item => item.assignmentId === assignment.id
  );

  if (input.status === "active") {
    if (assignment.status !== "draft") {
      throw new Error("Only a draft assignment can be published.");
    }
    assertCourseRunReadyForDelivery(state, run, "Assignment publication");
    if (new Date(assignment.dueAt).getTime() <= new Date(ctx.now()).getTime()) {
      throw new Error(
        "Assignment due date must be in the future when published."
      );
    }
    const activeGroups = state.classGroups.filter(
      item => item.courseRunId === run.id && item.status === "active"
    );
    if (!activeGroups.length) {
      throw new Error(
        "Publish the assignment only after an active class exists."
      );
    }
    assignment.status = "active";
    notifyActiveLearnersForAssignment(state, ctx, assignment, {
      title: "New assignment",
      body: `${assignment.title} is due ${assignment.dueAt}.`,
      href: `/app/student/assignments/${assignment.id}`,
    });
  } else if (input.status === "cancelled") {
    const wasPublished = assignment.status === "active";
    if (reason.length < 5) {
      throw new Error(
        "Assignment cancellation reason must be at least 5 characters."
      );
    }
    if (submissions.length) {
      throw new Error("An assignment with submissions cannot be cancelled.");
    }
    assignment.status = "cancelled";
    if (wasPublished) {
      notifyActiveLearnersForAssignment(state, ctx, assignment, {
        title: "Assignment cancelled",
        body: `${assignment.title} is no longer available. ${reason}`,
        href: "/app/student/assignments",
      });
    }
  } else {
    if (assignment.status !== "active") {
      throw new Error("Only a published assignment can be closed.");
    }
    const duePassed =
      new Date(assignment.dueAt).getTime() <= new Date(ctx.now()).getTime();
    const activeLearnerIds = new Set(
      activeLearnersForAssignment(state, assignment).map(item => item.studentId)
    );
    const completedLearnerIds = new Set(
      submissions
        .filter(item => item.status === "completed")
        .map(item => item.studentId)
    );
    const allGraded =
      activeLearnerIds.size > 0 &&
      Array.from(activeLearnerIds).every(studentId =>
        completedLearnerIds.has(studentId)
      );
    if (!duePassed && !allGraded) {
      throw new Error(
        "Assignment can close only after its due date or after every submission is graded."
      );
    }
    assignment.status = "completed";
    notifyActiveLearnersForAssignment(state, ctx, assignment, {
      title: "Assignment closed",
      body: `${assignment.title} is closed. Your submitted work remains available to review.`,
      href: `/app/student/assignments/${assignment.id}`,
    });
  }

  const action =
    input.status === "active"
      ? "assignment.published"
      : input.status === "completed"
        ? "assignment.closed"
        : "assignment.cancelled";
  appendAudit(
    state,
    ctx,
    action,
    "Assignment",
    assignment.id,
    `${assignment.title} ${input.status}${reason ? `. Reason: ${reason}` : ""}.`,
    input.actorId ?? "usr_teacher_demo"
  );
  return assignment;
}

function validateQuizDueAt(
  run: PlatformState["courseRuns"][number],
  dueAt: string
) {
  const dueAtTime = new Date(dueAt).getTime();
  if (!Number.isFinite(dueAtTime)) {
    throw new Error("Quiz requires a valid due date.");
  }
  if (dueAt.slice(0, 10) < run.startsOn || dueAt.slice(0, 10) > run.endsOn) {
    throw new Error("Quiz due date must stay inside the course run.");
  }
  return dueAtTime;
}

function normalizeQuizLimits(durationMinutes: number, attemptsAllowed: number) {
  if (!Number.isFinite(durationMinutes) || !Number.isFinite(attemptsAllowed)) {
    throw new Error("Quiz requires a valid duration and attempt limit.");
  }
  return {
    durationMinutes: Math.min(180, Math.max(5, Math.round(durationMinutes))),
    attemptsAllowed: Math.min(5, Math.max(1, Math.round(attemptsAllowed))),
  };
}

function quizQuestionTypes(state: PlatformState, questionIds: string[]) {
  return Array.from(
    new Set(
      questionIds
        .map(
          questionId =>
            state.questionBankItems.find(question => question.id === questionId)
              ?.type
        )
        .filter(Boolean) as string[]
    )
  );
}

function applyCreateQuiz(
  state: PlatformState,
  input: CreateQuizActionInput & { actorId?: string },
  ctx: MutationContext
) {
  const run = state.courseRuns.find(item => item.id === input.courseRunId);
  if (!run) throw new Error(`Course run ${input.courseRunId} was not found.`);
  assertCourseRunReadyForDelivery(state, run, "Assessment creation");
  assertTeacherCanUseCourseRun(
    state,
    input.actorId,
    input.courseRunId,
    "Teacher can only create assessments for assigned course runs."
  );
  if (!input.title.trim()) throw new Error("Quiz title is required.");
  validateQuizDueAt(run, input.dueAt);
  const limits = normalizeQuizLimits(
    input.durationMinutes,
    input.attemptsAllowed
  );
  const suppliedQuestionTypes = input.questionTypes
    .map(item => item.trim())
    .filter(Boolean);
  const questionIds = normalizeQuizQuestionIds(
    state,
    input.courseRunId,
    input.questionIds ?? []
  );
  const quiz = {
    id: ctx.createId("quiz"),
    courseRunId: input.courseRunId,
    title: input.title.trim(),
    dueAt: input.dueAt,
    ...limits,
    questionTypes: questionIds.length
      ? quizQuestionTypes(state, questionIds)
      : suppliedQuestionTypes.length
        ? suppliedQuestionTypes
        : ["short_answer"],
    questionIds,
    status: "draft" as const,
  };
  state.quizzes = [quiz, ...state.quizzes];
  appendAudit(
    state,
    ctx,
    "quiz.created",
    "Quiz",
    quiz.id,
    `${quiz.title} created as draft.`,
    input.actorId ?? "usr_teacher_demo"
  );
  return quiz;
}

function normalizeQuizQuestionIds(
  state: PlatformState,
  courseRunId: string,
  questionIds: string[]
) {
  const uniqueIds = Array.from(
    new Set(questionIds.map(item => item.trim()).filter(Boolean))
  );
  return uniqueIds.map(questionId => {
    const question = state.questionBankItems.find(
      item => item.id === questionId
    );
    if (!question) throw new Error(`Question ${questionId} was not found.`);
    if (question.courseRunId !== courseRunId)
      throw new Error("Quiz questions must belong to the same course run.");
    if (question.status !== "active")
      throw new Error("Only active questions can be attached to a quiz.");
    return question.id;
  });
}

function validateQuizQuestionsForPublication(
  state: PlatformState,
  courseRunId: string,
  questionIds: string[]
) {
  const normalizedIds = normalizeQuizQuestionIds(
    state,
    courseRunId,
    questionIds
  );
  if (!normalizedIds.length) {
    throw new Error(
      "Attach at least one active question before publishing a quiz."
    );
  }
  normalizedIds.forEach(questionId => {
    const question = state.questionBankItems.find(
      item => item.id === questionId
    )!;
    if (question.type === "multiple_choice") {
      if (
        question.choices.length < 2 ||
        !question.answerKey?.trim() ||
        !question.choices.some(
          choice =>
            choice.trim().toLowerCase() ===
            question.answerKey?.trim().toLowerCase()
        )
      ) {
        throw new Error(
          `Multiple-choice question ${question.id} requires at least two choices and a matching answer key.`
        );
      }
      return;
    }
    if (question.type === "true_false") {
      const answer = question.answerKey?.trim().toLowerCase();
      if (answer !== "true" && answer !== "false") {
        throw new Error(
          `True/false question ${question.id} requires a true or false answer key.`
        );
      }
      return;
    }
    if (!question.rubric.some(item => item.trim())) {
      throw new Error(
        `Manually reviewed question ${question.id} requires a rubric.`
      );
    }
  });
  return normalizedIds;
}

function quizLifecycleContext(
  state: PlatformState,
  quizId: string,
  actorId?: string
) {
  const quiz = requireQuiz(state, quizId);
  const run = state.courseRuns.find(item => item.id === quiz.courseRunId);
  if (!run) throw new Error(`Course run ${quiz.courseRunId} was not found.`);
  assertTeacherCanUseCourseRun(
    state,
    actorId,
    run.id,
    "Teacher can only manage quizzes for assigned course runs."
  );
  return { quiz, run };
}

function applyUpdateQuiz(
  state: PlatformState,
  input: UpdateQuizActionInput & { actorId?: string },
  ctx: MutationContext
) {
  const { quiz, run } = quizLifecycleContext(
    state,
    input.quizId,
    input.actorId
  );
  if (quiz.status !== "draft") {
    throw new Error("Only a draft quiz can be edited.");
  }
  if (state.quizAttempts.some(item => item.quizId === quiz.id)) {
    throw new Error("A quiz with attempts cannot be edited.");
  }
  const title = input.title.trim();
  if (!title) throw new Error("Quiz title is required.");
  validateQuizDueAt(run, input.dueAt);
  const limits = normalizeQuizLimits(
    input.durationMinutes,
    input.attemptsAllowed
  );
  quiz.title = title;
  quiz.dueAt = input.dueAt;
  quiz.durationMinutes = limits.durationMinutes;
  quiz.attemptsAllowed = limits.attemptsAllowed;
  appendAudit(
    state,
    ctx,
    "quiz.updated",
    "Quiz",
    quiz.id,
    `${quiz.title} draft updated.`,
    input.actorId ?? "usr_teacher_demo"
  );
  return quiz;
}

function applyUpdateQuizStatus(
  state: PlatformState,
  input: UpdateQuizStatusActionInput & { actorId?: string },
  ctx: MutationContext
) {
  const { quiz, run } = quizLifecycleContext(
    state,
    input.quizId,
    input.actorId
  );
  const reason = input.reason?.trim() ?? "";
  if (quiz.status === "completed" || quiz.status === "cancelled") {
    throw new Error("A terminal quiz cannot change status.");
  }
  const attempts = state.quizAttempts.filter(item => item.quizId === quiz.id);

  if (input.status === "active") {
    if (quiz.status !== "draft") {
      throw new Error("Only a draft quiz can be published.");
    }
    assertCourseRunReadyForDelivery(state, run, "Quiz publication");
    const dueAtTime = validateQuizDueAt(run, quiz.dueAt);
    if (dueAtTime <= new Date(ctx.now()).getTime()) {
      throw new Error("Quiz due date must be in the future when published.");
    }
    const questionIds = validateQuizQuestionsForPublication(
      state,
      quiz.courseRunId,
      quiz.questionIds
    );
    const activeGroups = state.classGroups.filter(
      item => item.courseRunId === run.id && item.status === "active"
    );
    if (!activeGroups.length) {
      throw new Error("Publish the quiz only after an active class exists.");
    }
    quiz.questionIds = questionIds;
    quiz.questionTypes = quizQuestionTypes(state, questionIds);
    quiz.status = "active";
    notifyActiveLearnersForQuiz(state, ctx, quiz, {
      title: "New quiz",
      body: `${quiz.title} is due ${quiz.dueAt}.`,
      href: `/app/student/quizzes/${quiz.id}`,
    });
  } else if (input.status === "cancelled") {
    const wasPublished = quiz.status === "active";
    if (reason.length < 5) {
      throw new Error(
        "Quiz cancellation reason must be at least 5 characters."
      );
    }
    if (attempts.length) {
      throw new Error("A quiz with attempts cannot be cancelled.");
    }
    quiz.status = "cancelled";
    if (wasPublished) {
      notifyActiveLearnersForQuiz(state, ctx, quiz, {
        title: "Quiz cancelled",
        body: `${quiz.title} is no longer available. ${reason}`,
        href: "/app/student/quizzes",
      });
    }
  } else {
    if (quiz.status !== "active") {
      throw new Error("Only a published quiz can be closed.");
    }
    const duePassed =
      new Date(quiz.dueAt).getTime() <= new Date(ctx.now()).getTime();
    const activeLearnerIds = new Set(
      activeLearnersForQuiz(state, quiz).map(item => item.studentId)
    );
    const completedLearnerIds = new Set(
      attempts
        .filter(attempt => attempt.status === "completed")
        .map(attempt => attempt.studentId)
    );
    const reviewComplete =
      activeLearnerIds.size > 0 &&
      attempts.every(attempt => attempt.status === "completed") &&
      Array.from(activeLearnerIds).every(studentId =>
        completedLearnerIds.has(studentId)
      );
    if (!duePassed && !reviewComplete) {
      throw new Error(
        "Quiz can close only after its due date or after every active learner has a reviewed attempt."
      );
    }
    quiz.status = "completed";
    notifyActiveLearnersForQuiz(state, ctx, quiz, {
      title: "Quiz closed",
      body: `${quiz.title} is closed. Your attempt and result remain available to review.`,
      href: `/app/student/quizzes/${quiz.id}`,
    });
  }

  const action =
    input.status === "active"
      ? "quiz.published"
      : input.status === "completed"
        ? "quiz.closed"
        : "quiz.cancelled";
  appendAudit(
    state,
    ctx,
    action,
    "Quiz",
    quiz.id,
    `${quiz.title} ${input.status}${reason ? `. Reason: ${reason}` : ""}.`,
    input.actorId ?? "usr_teacher_demo"
  );
  return quiz;
}

function applySetQuizQuestions(
  state: PlatformState,
  input: { quizId: string; questionIds: string[]; actorId?: string },
  ctx: MutationContext
) {
  const quiz = requireQuiz(state, input.quizId);
  assertTeacherCanUseCourseRun(
    state,
    input.actorId,
    quiz.courseRunId,
    "Teacher can only attach questions to assigned course quizzes."
  );
  if (quiz.status !== "draft") {
    throw new Error("Only a draft quiz can change questions.");
  }
  if (state.quizAttempts.some(item => item.quizId === quiz.id)) {
    throw new Error("A quiz with attempts cannot change questions.");
  }
  const questionIds = normalizeQuizQuestionIds(
    state,
    quiz.courseRunId,
    input.questionIds
  );
  let updatedQuiz = quiz;
  state.quizzes = state.quizzes.map(item => {
    if (item.id !== quiz.id) return item;
    updatedQuiz = {
      ...item,
      questionIds,
      questionTypes: quizQuestionTypes(state, questionIds),
    };
    return updatedQuiz;
  });
  appendAudit(
    state,
    ctx,
    "quiz.questions.updated",
    "Quiz",
    quiz.id,
    `${questionIds.length} question(s) attached to ${quiz.title}.`,
    input.actorId ?? "usr_teacher_demo"
  );
  return updatedQuiz;
}

function normalizeQuestionType(value: string): QuestionBankItem["type"] {
  const allowed: QuestionBankItem["type"][] = [
    "multiple_choice",
    "true_false",
    "short_answer",
    "essay",
    "oral_record",
    "file_upload",
  ];
  return allowed.includes(value as QuestionBankItem["type"])
    ? (value as QuestionBankItem["type"])
    : "short_answer";
}

function normalizeQuestionDifficulty(
  value: string
): QuestionBankItem["difficulty"] {
  const allowed: QuestionBankItem["difficulty"][] = [
    "foundation",
    "core",
    "challenge",
  ];
  return allowed.includes(value as QuestionBankItem["difficulty"])
    ? (value as QuestionBankItem["difficulty"])
    : "core";
}

function applyCreateQuestionBankItem(
  state: PlatformState,
  input: CreateQuestionActionInput & { actorId?: string },
  ctx: MutationContext
) {
  const run = state.courseRuns.find(item => item.id === input.courseRunId);
  if (!run) throw new Error(`Course run ${input.courseRunId} was not found.`);
  assertCourseRunReadyForDelivery(state, run, "Assessment creation");
  assertTeacherCanUseCourseRun(
    state,
    input.actorId,
    input.courseRunId,
    "Teacher can only create assessments for assigned course runs."
  );
  if (!input.prompt.trim()) throw new Error("Question prompt is required.");
  const tags = input.tags.map(item => item.trim()).filter(Boolean);
  const choices = (input.choices ?? [])
    .map(item => item.trim())
    .filter(Boolean);
  const rubric = (input.rubric ?? []).map(item => item.trim()).filter(Boolean);
  const question: QuestionBankItem = {
    id: ctx.createId("qbi"),
    courseRunId: input.courseRunId,
    prompt: input.prompt.trim(),
    type: normalizeQuestionType(input.questionType),
    difficulty: normalizeQuestionDifficulty(input.difficulty),
    tags: tags.length ? tags : ["review"],
    choices,
    answerKey: input.answerKey?.trim() || undefined,
    rubric: rubric.length ? rubric : ["Accurate answer", "Clear reasoning"],
    createdBy: input.actorId ?? "usr_teacher_demo",
    updatedAt: ctx.now(),
    status: "active",
  };
  state.questionBankItems = [question, ...(state.questionBankItems ?? [])];
  appendAudit(
    state,
    ctx,
    "question.created",
    "QuestionBankItem",
    question.id,
    `Question added for ${run.term}.`,
    question.createdBy
  );
  return question;
}

function applyGradeAssignmentSubmission(
  state: PlatformState,
  input: {
    submissionId: string;
    score: number;
    feedback: string;
    actorId?: string;
  },
  ctx: MutationContext
) {
  const submission = state.assignmentSubmissions.find(
    item => item.id === input.submissionId
  );
  if (!submission) {
    throw new Error(
      `Assignment submission ${input.submissionId} was not found.`
    );
  }
  const assignment = state.assignments.find(
    item => item.id === submission.assignmentId
  );
  if (!assignment)
    throw new Error(`Assignment ${submission.assignmentId} was not found.`);
  assertTeacherCanManageStudentInRun(
    state,
    input.actorId,
    assignment.courseRunId,
    submission.studentId,
    "Teacher can only grade assigned class submissions."
  );
  if (submission.status !== "pending") {
    throw new Error("Only a pending assignment submission can be graded.");
  }
  if (!Number.isFinite(input.score)) {
    throw new Error("Assignment review score must be a finite number.");
  }
  const score = Math.min(100, Math.max(0, Math.round(input.score)));
  const feedback = input.feedback.trim() || "Reviewed by teacher.";
  const updatedSubmission = {
    ...submission,
    status: "completed" as const,
    score,
    feedback,
  };
  state.assignmentSubmissions = state.assignmentSubmissions.map(submission => {
    if (submission.id !== input.submissionId) return submission;
    return updatedSubmission;
  });

  const existingGrade = state.grades.find(
    grade =>
      grade.studentId === updatedSubmission.studentId &&
      grade.courseRunId === assignment.courseRunId &&
      (grade.itemId
        ? grade.itemId === assignment.id
        : grade.itemTitle === assignment.title)
  );
  const maxScore = 100;
  if (existingGrade) {
    existingGrade.score = score;
    existingGrade.maxScore = maxScore;
    existingGrade.feedback = feedback;
  } else {
    state.grades = [
      {
        id: ctx.createId("gr"),
        studentId: updatedSubmission.studentId,
        courseRunId: assignment.courseRunId,
        itemId: assignment.id,
        itemTitle: assignment.title,
        score,
        maxScore,
        feedback,
      },
      ...state.grades,
    ];
  }
  recomputeEnrollmentCurrentGrade(
    state,
    updatedSubmission.studentId,
    assignment.courseRunId
  );
  const student = state.students.find(
    item => item.id === updatedSubmission.studentId
  );
  notify(state, ctx, {
    userId: student?.userId ?? "usr_student_demo",
    title: "Assignment graded",
    body: `${assignment.title} received ${score}/${maxScore}.`,
    href: "/app/student/grades",
  });
  appendAudit(
    state,
    ctx,
    "assignment.graded",
    "AssignmentSubmission",
    updatedSubmission.id,
    `${assignment.title} graded ${score}/${maxScore}.`,
    input.actorId ?? "usr_teacher_demo"
  );
  return updatedSubmission;
}

function applyReviewQuizAttempt(
  state: PlatformState,
  input: {
    attemptId: string;
    score: number;
    feedback: string;
    actorId?: string;
  },
  ctx: MutationContext
) {
  const attempt = state.quizAttempts.find(item => item.id === input.attemptId);
  if (!attempt) {
    throw new Error(`Quiz attempt ${input.attemptId} was not found.`);
  }
  const quiz = state.quizzes.find(item => item.id === attempt.quizId);
  if (!quiz) throw new Error(`Quiz ${attempt.quizId} was not found.`);
  assertTeacherCanManageStudentInRun(
    state,
    input.actorId,
    quiz.courseRunId,
    attempt.studentId,
    "Teacher can only review assigned class quiz attempts."
  );
  if (attempt.status !== "pending") {
    throw new Error("Only a pending quiz attempt can be reviewed.");
  }
  if (!Number.isFinite(input.score)) {
    throw new Error("Quiz review score must be a finite number.");
  }
  const score = Math.min(100, Math.max(0, Math.round(input.score)));
  const feedback = input.feedback.trim() || "Reviewed by teacher.";
  const updatedAttempt = {
    ...attempt,
    status: "completed" as const,
    score,
  };
  state.quizAttempts = state.quizAttempts.map(attempt => {
    if (attempt.id !== input.attemptId) return attempt;
    return updatedAttempt;
  });

  const existingGrade = state.grades.find(
    grade =>
      grade.studentId === updatedAttempt.studentId &&
      grade.courseRunId === quiz.courseRunId &&
      (grade.itemId ? grade.itemId === quiz.id : grade.itemTitle === quiz.title)
  );
  const maxScore = 100;
  if (existingGrade) {
    existingGrade.itemId = quiz.id;
    existingGrade.itemTitle = quiz.title;
    existingGrade.score = score;
    existingGrade.maxScore = maxScore;
    existingGrade.feedback = feedback;
  } else {
    state.grades = [
      {
        id: ctx.createId("gr"),
        studentId: updatedAttempt.studentId,
        courseRunId: quiz.courseRunId,
        itemId: quiz.id,
        itemTitle: quiz.title,
        score,
        maxScore,
        feedback,
      },
      ...state.grades,
    ];
  }
  recomputeEnrollmentCurrentGrade(
    state,
    updatedAttempt.studentId,
    quiz.courseRunId
  );
  const student = state.students.find(
    item => item.id === updatedAttempt.studentId
  );
  notify(state, ctx, {
    userId: student?.userId ?? "usr_student_demo",
    title: "Quiz reviewed",
    body: `${quiz.title} received ${score}/${maxScore}.`,
    href: "/app/student/grades",
  });
  appendAudit(
    state,
    ctx,
    "quiz.reviewed",
    "QuizAttempt",
    updatedAttempt.id,
    `${quiz.title} reviewed ${score}/${maxScore}.`,
    input.actorId ?? "usr_teacher_demo"
  );
  return updatedAttempt;
}

function applySaveAttendanceBulk(
  state: PlatformState,
  input: {
    classGroupId: string;
    sessionId: string;
    statuses: Record<string, AttendanceStatus>;
    notes?: Record<string, string>;
    actorId?: string;
  },
  ctx: MutationContext
) {
  const session = state.classSessions.find(
    item => item.id === input.sessionId || item.eventId === input.sessionId
  );
  const classGroup = state.classGroups.find(
    item => item.id === input.classGroupId
  );
  if (!classGroup)
    throw new Error(`Class group ${input.classGroupId} was not found.`);
  if (classGroup.status !== "active") {
    throw new Error("Attendance can only be saved for an active class.");
  }
  if (!session)
    throw new Error(`Attendance session ${input.sessionId} was not found.`);
  if (session && session.classGroupId !== classGroup.id)
    throw new Error("Attendance session does not belong to this class group.");
  if (!new Set<EntityStatus>(["active", "completed"]).has(session.status)) {
    throw new Error(
      "Attendance can only be saved for active or completed sessions."
    );
  }
  const event = state.events.find(item => item.id === session.eventId);
  if (!event) {
    throw new Error(
      `Attendance session ${session.id} is missing its calendar event.`
    );
  }
  if (
    event.classGroupId !== classGroup.id ||
    !new Set<CalendarEventType>(["class_session", "live_session"]).has(
      event.type
    )
  ) {
    throw new Error(
      "Attendance requires a class-session calendar event for the same class group."
    );
  }
  if (!new Set<EntityStatus>(["active", "completed"]).has(event.status)) {
    throw new Error(
      "Attendance can only be saved when the paired calendar event is active or completed."
    );
  }
  if (
    event.status !== session.status ||
    event.startsAt !== session.startsAt ||
    event.endsAt !== session.endsAt
  ) {
    throw new Error(
      "Attendance session and calendar event must have matching lifecycle and schedule data."
    );
  }
  const courseRun = state.courseRuns.find(
    item => item.id === classGroup.courseRunId
  );
  if (!courseRun)
    throw new Error(`Course run ${classGroup.courseRunId} was not found.`);
  assertCourseRunReadyForDelivery(state, courseRun, "Attendance");
  const sessionStarts = new Date(session.startsAt).getTime();
  const sessionEnds = new Date(session.endsAt).getTime();
  if (
    !Number.isFinite(sessionStarts) ||
    !Number.isFinite(sessionEnds) ||
    sessionStarts >= sessionEnds ||
    session.startsAt.slice(0, 10) < courseRun.startsOn ||
    session.endsAt.slice(0, 10) > courseRun.endsOn
  ) {
    throw new Error(
      "Attendance session must stay inside the course run date range."
    );
  }
  if (event.branchId !== courseRun.branchId) {
    throw new Error(
      "Attendance calendar event must belong to the course run branch."
    );
  }
  if (event.roomId) {
    const room = state.rooms.find(item => item.id === event.roomId);
    if (!room) throw new Error(`Room ${event.roomId} was not found.`);
    if (room.status !== "active") {
      throw new Error("Attendance requires an active room.");
    }
    if (room.branchId !== courseRun.branchId) {
      throw new Error("Attendance room must belong to the course run branch.");
    }
    if (room.capacity < classGroup.capacity) {
      throw new Error(
        "Attendance room capacity is smaller than the class capacity."
      );
    }
  }
  assertTeacherCanUseCourseRun(
    state,
    input.actorId,
    classGroup.courseRunId,
    "Teacher can only save attendance for assigned classes."
  );
  const roster = new Set(classGroup.studentIds);
  const suppliedStudentIds = Object.keys(input.statuses);
  const invalidStudentId = suppliedStudentIds.find(
    studentId => !roster.has(studentId)
  );
  if (invalidStudentId)
    throw new Error(`Student ${invalidStudentId} is not in this class roster.`);
  const missingStudentId = classGroup.studentIds.find(
    studentId => !(studentId in input.statuses)
  );
  if (missingStudentId)
    throw new Error(
      `Attendance is missing roster student ${missingStudentId}.`
    );
  const sessionKeys = new Set(
    [input.sessionId, session?.id, session?.eventId].filter(Boolean)
  );
  const canonicalSessionId = session.id;
  const hasAttendanceChange =
    !session.attendanceSaved ||
    classGroup.studentIds.some(studentId => {
      const existing = state.attendance.find(
        record =>
          record.classGroupId === input.classGroupId &&
          sessionKeys.has(record.sessionId) &&
          record.studentId === studentId
      );
      const note = input.notes?.[studentId]?.trim() || undefined;
      return (
        !existing ||
        existing.status !== input.statuses[studentId] ||
        existing.sessionId !== canonicalSessionId ||
        existing.notes !== note
      );
    });
  if (!hasAttendanceChange) {
    return state.attendance.filter(
      record =>
        record.classGroupId === input.classGroupId &&
        sessionKeys.has(record.sessionId)
    );
  }
  Object.entries(input.statuses).forEach(([studentId, status]) => {
    const existing = state.attendance.find(
      record =>
        record.classGroupId === input.classGroupId &&
        sessionKeys.has(record.sessionId) &&
        record.studentId === studentId
    );
    const note = input.notes?.[studentId]?.trim() || undefined;
    if (existing) {
      existing.status = status;
      existing.sessionId = canonicalSessionId;
      existing.notes = note;
    } else {
      state.attendance = [
        {
          id: ctx.createId("att"),
          classGroupId: input.classGroupId,
          studentId,
          sessionId: canonicalSessionId,
          status,
          notes: note,
        },
        ...state.attendance,
      ];
    }
  });
  state.enrollments = state.enrollments.map(enrollment => {
    if (
      enrollment.courseRunId !== classGroup.courseRunId ||
      !roster.has(enrollment.studentId)
    )
      return enrollment;
    const canonicalSessionIds = new Set(
      state.classSessions
        .filter(item => item.classGroupId === input.classGroupId)
        .map(item => item.id)
    );
    const studentRecords = state.attendance.filter(
      record =>
        record.classGroupId === input.classGroupId &&
        canonicalSessionIds.has(record.sessionId) &&
        record.studentId === enrollment.studentId
    );
    if (!studentRecords.length) return enrollment;
    const attendedCount = studentRecords.filter(
      record => record.status !== "absent"
    ).length;
    return {
      ...enrollment,
      attendanceRate: Math.round((attendedCount / studentRecords.length) * 100),
    };
  });
  state.classSessions = state.classSessions.map(item =>
    item.id === input.sessionId || item.eventId === input.sessionId
      ? { ...item, attendanceSaved: true }
      : item
  );
  appendAudit(
    state,
    ctx,
    "attendance.saved",
    "AttendanceRecord",
    input.classGroupId,
    `Saved attendance for ${Object.keys(input.statuses).length} learner(s).`,
    input.actorId ?? "usr_teacher_demo"
  );
  return state.attendance.filter(
    record =>
      record.classGroupId === input.classGroupId &&
      sessionKeys.has(record.sessionId)
  );
}

function recomputeStudentAttendanceForClass(
  state: PlatformState,
  classGroup: ClassGroup,
  studentId: string
) {
  const sessionIds = new Set(
    state.classSessions
      .filter(item => item.classGroupId === classGroup.id)
      .flatMap(item => [item.id, item.eventId])
  );
  const records = state.attendance.filter(
    item =>
      item.classGroupId === classGroup.id &&
      item.studentId === studentId &&
      sessionIds.has(item.sessionId)
  );
  if (!records.length) return;
  const attendanceRate = Math.round(
    (records.filter(item => item.status !== "absent").length / records.length) *
      100
  );
  state.enrollments = state.enrollments.map(enrollment =>
    enrollment.studentId === studentId &&
    enrollment.classGroupId === classGroup.id
      ? { ...enrollment, attendanceRate }
      : enrollment
  );
}

export function applySubmitAttendanceException(
  state: PlatformState,
  input: SubmitAttendanceExceptionActionInput & { actorId?: string },
  ctx: MutationContext
) {
  const replayRequest = input.sourceKey
    ? state.attendanceExceptions.find(
        item => item.sourceKey === input.sourceKey
      )
    : undefined;
  if (replayRequest) return replayRequest;

  const reason = input.reason.trim();
  if (reason.length < 10) {
    throw new Error(
      "Attendance exception reason must be at least 10 characters."
    );
  }
  const attendance = state.attendance.find(
    item => item.id === input.attendanceRecordId
  );
  if (!attendance) {
    throw new Error(
      `Attendance record ${input.attendanceRecordId} was not found.`
    );
  }
  if (input.studentId && input.studentId !== attendance.studentId) {
    throw new Error(
      "Students can only request exceptions for their own attendance."
    );
  }
  if (!new Set<AttendanceStatus>(["absent", "late"]).has(attendance.status)) {
    throw new Error(
      "Only an absent or late record can receive an exception request."
    );
  }
  const classGroup = state.classGroups.find(
    item => item.id === attendance.classGroupId
  );
  const classSession = state.classSessions.find(
    item =>
      item.id === attendance.sessionId || item.eventId === attendance.sessionId
  );
  if (
    !classGroup ||
    !classSession ||
    classSession.classGroupId !== classGroup.id
  ) {
    throw new Error("Attendance exception requires an exact class session.");
  }
  if (!classGroup.studentIds.includes(attendance.studentId)) {
    throw new Error("Attendance exception student is not in the class roster.");
  }
  if (
    state.attendanceExceptions.some(
      item =>
        item.attendanceRecordId === attendance.id && item.status === "pending"
    )
  ) {
    throw new Error(
      "An attendance exception is already pending for this record."
    );
  }
  const request = {
    id: ctx.createId("aex"),
    attendanceRecordId: attendance.id,
    studentId: attendance.studentId,
    classGroupId: classGroup.id,
    sessionId: classSession.id,
    reason,
    status: "pending" as const,
    submittedAt: ctx.now(),
    sourceKey: input.sourceKey,
  };
  state.attendanceExceptions = [request, ...state.attendanceExceptions];
  const run = state.courseRuns.find(item => item.id === classGroup.courseRunId);
  if (run) {
    notify(state, ctx, {
      userId: run.teacherId,
      title: "Attendance exception submitted",
      body: `${classSession.title} has a learner exception awaiting branch review.`,
      href: "/app/branch/attendance",
    });
  }
  appendAudit(
    state,
    ctx,
    "attendance_exception.submitted",
    "AttendanceExceptionRequest",
    request.id,
    `Attendance exception submitted for ${classSession.title}.`,
    input.actorId ?? "usr_student_demo",
    input.sourceKey
  );
  return request;
}

function applyReviewAttendanceException(
  state: PlatformState,
  input: ReviewAttendanceExceptionActionInput & { actorId?: string },
  ctx: MutationContext
) {
  const reviewNote = input.reviewNote.trim();
  if (reviewNote.length < 5) {
    throw new Error(
      "Attendance exception review note must be at least 5 characters."
    );
  }
  const request = state.attendanceExceptions.find(
    item => item.id === input.requestId
  );
  if (!request)
    throw new Error(`Attendance exception ${input.requestId} was not found.`);
  if (request.status !== "pending") {
    throw new Error("Only a pending attendance exception can be reviewed.");
  }
  const attendance = state.attendance.find(
    item => item.id === request.attendanceRecordId
  );
  const classGroup = state.classGroups.find(
    item => item.id === request.classGroupId
  );
  const classSession = state.classSessions.find(
    item => item.id === request.sessionId
  );
  if (
    !attendance ||
    !classGroup ||
    !classSession ||
    attendance.studentId !== request.studentId ||
    attendance.classGroupId !== classGroup.id ||
    classSession.classGroupId !== classGroup.id
  ) {
    throw new Error("Attendance exception relationships are inconsistent.");
  }
  if (!new Set<AttendanceStatus>(["absent", "late"]).has(attendance.status)) {
    throw new Error(
      "The attendance record is no longer eligible for exception review."
    );
  }

  request.status = input.decision;
  request.reviewedAt = ctx.now();
  request.reviewedBy = input.actorId;
  request.reviewNote = reviewNote;
  if (input.decision === "approved") {
    attendance.status = "excused";
    attendance.notes = [attendance.notes, `Excuse approved: ${reviewNote}`]
      .filter(Boolean)
      .join(" · ");
    recomputeStudentAttendanceForClass(state, classGroup, request.studentId);
  }
  const student = state.students.find(item => item.id === request.studentId);
  if (student) {
    notify(state, ctx, {
      userId: student.userId,
      title: `Attendance exception ${input.decision}`,
      body:
        input.decision === "approved"
          ? `${classSession.title} is now marked excused.`
          : `${classSession.title} remains ${attendance.status}. ${reviewNote}`,
      href: "/app/student/attendance",
    });
  }
  appendAudit(
    state,
    ctx,
    `attendance_exception.${input.decision}`,
    "AttendanceExceptionRequest",
    request.id,
    `${classSession.title} exception ${input.decision}. Review: ${reviewNote}`,
    input.actorId ?? "usr_branch_demo"
  );
  return { request, attendance };
}

function calendarWeekday(value: string) {
  return new Date(value).toLocaleDateString("en-US", { weekday: "long" });
}

function calendarTime(value: string) {
  return value.slice(11, 16);
}

function availabilityCoversSlot(
  item: TeacherAvailability,
  input: {
    teacherId: string;
    branchId: string;
    weekday: string;
    startsAt: string;
    endsAt: string;
  }
) {
  return (
    item.teacherId === input.teacherId &&
    item.branchId === input.branchId &&
    item.weekday === input.weekday &&
    item.startsAt <= input.startsAt &&
    item.endsAt >= input.endsAt
  );
}

function applyCreateCalendarEvent(
  state: PlatformState,
  input: CreateCalendarEventActionInput & { actorId?: string },
  ctx: MutationContext
) {
  const ownerId = input.ownerId ?? input.actorId;
  const requestedClassGroup = input.classGroupId
    ? state.classGroups.find(item => item.id === input.classGroupId)
    : undefined;
  const requestedRun = requestedClassGroup
    ? state.courseRuns.find(item => item.id === requestedClassGroup.courseRunId)
    : undefined;
  const requestedRoom = input.roomId
    ? state.rooms.find(item => item.id === input.roomId)
    : undefined;
  const branchId =
    input.branchId ?? requestedRun?.branchId ?? requestedRoom?.branchId;
  const needsClassGroup =
    input.eventType === "class_session" || input.eventType === "live_session";
  const needsRoom = input.eventType === "room_booking";
  const starts = new Date(input.startsAt).getTime();
  const ends = new Date(input.endsAt).getTime();
  if (!ownerId) throw new Error("Calendar event requires an owner.");
  if (!branchId) throw new Error("Calendar event requires a branch.");
  if (!state.branches.some(item => item.id === branchId))
    throw new Error(`Branch ${branchId} was not found.`);
  if (!Number.isFinite(starts) || !Number.isFinite(ends) || starts >= ends) {
    throw new Error("Calendar event requires a valid time range.");
  }
  if (needsClassGroup && !input.classGroupId) {
    throw new Error("Calendar class session requires a class group.");
  }
  if (input.classGroupId && !requestedClassGroup)
    throw new Error(`Class group ${input.classGroupId} was not found.`);
  if (requestedClassGroup && requestedClassGroup.status !== "active") {
    throw new Error(
      "Class sessions can only be scheduled for an active class."
    );
  }
  if (input.classGroupId && !requestedRun)
    throw new Error("Calendar class group is missing a course run.");
  if (requestedRun) {
    assertCourseRunReadyForDelivery(state, requestedRun, "Class scheduling");
    const eventStartDate = input.startsAt.slice(0, 10);
    const eventEndDate = input.endsAt.slice(0, 10);
    if (
      eventStartDate < requestedRun.startsOn ||
      eventEndDate > requestedRun.endsOn
    ) {
      throw new Error(
        "Class sessions must stay inside the course run date range."
      );
    }
  }
  if (branchId && requestedRun && requestedRun.branchId !== branchId) {
    throw new Error("Calendar class group must belong to the event branch.");
  }
  if (needsRoom && !input.roomId) {
    throw new Error("Room booking requires a room.");
  }
  if (input.roomId && !requestedRoom)
    throw new Error(`Room ${input.roomId} was not found.`);
  if (requestedRoom && requestedRoom.status !== "active") {
    throw new Error("Calendar events require an active room.");
  }
  if (branchId && requestedRoom && requestedRoom.branchId !== branchId) {
    throw new Error("Calendar room must belong to the event branch.");
  }
  if (
    requestedRoom &&
    requestedClassGroup &&
    requestedRoom.capacity < requestedClassGroup.capacity
  ) {
    throw new Error(
      "Calendar room capacity is smaller than the class capacity."
    );
  }
  const classGroupId = requestedClassGroup?.id;
  const scheduleTeacherId = requestedRun?.teacherId;
  const needsTeacherAvailability = Boolean(
    scheduleTeacherId &&
      classGroupId &&
      (input.eventType === "class_session" ||
        input.eventType === "live_session")
  );
  const availabilityMatches = needsTeacherAvailability
    ? state.teacherAvailability.filter(item =>
        availabilityCoversSlot(item, {
          teacherId: scheduleTeacherId!,
          branchId,
          weekday: calendarWeekday(input.startsAt),
          startsAt: calendarTime(input.startsAt),
          endsAt: calendarTime(input.endsAt),
        })
      )
    : [];
  const availabilityGaps =
    needsTeacherAvailability && !availabilityMatches.length
      ? [scheduleTeacherId!]
      : [];
  const conflicts = state.events.filter(event => {
    const eventStarts = new Date(event.startsAt).getTime();
    const eventEnds = new Date(event.endsAt).getTime();
    const overlaps = starts < eventEnds && ends > eventStarts;
    if (!overlaps) return false;
    const eventGroup = event.classGroupId
      ? state.classGroups.find(item => item.id === event.classGroupId)
      : undefined;
    const eventRun = eventGroup
      ? state.courseRuns.find(item => item.id === eventGroup.courseRunId)
      : undefined;
    const eventTeacherId = eventRun?.teacherId ?? event.ownerId;
    return Boolean(
      (input.roomId && event.roomId === input.roomId) ||
        (ownerId && event.ownerId === ownerId) ||
        (classGroupId && event.classGroupId === classGroupId) ||
        (scheduleTeacherId && eventTeacherId === scheduleTeacherId)
    );
  });
  const event: CalendarEvent = {
    id: ctx.createId("evt"),
    type: input.eventType,
    title: input.title,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    ownerId,
    branchId,
    roomId: input.roomId,
    classGroupId,
    status: conflicts.length || availabilityGaps.length ? "pending" : "active",
  };
  state.events = [event, ...state.events];
  if (
    event.classGroupId &&
    (event.type === "class_session" || event.type === "live_session")
  ) {
    state.classSessions = [
      {
        id: ctx.createId("session"),
        classGroupId: event.classGroupId,
        eventId: event.id,
        title: event.title,
        startsAt: event.startsAt,
        endsAt: event.endsAt,
        status: event.status,
        attendanceSaved: false,
      },
      ...state.classSessions,
    ];
  }
  appendAudit(
    state,
    ctx,
    conflicts.length || availabilityGaps.length
      ? "calendar.created_with_conflict"
      : "calendar.created",
    "CalendarEvent",
    event.id,
    `${event.title} created${conflicts.length ? ` with ${conflicts.length} conflict(s)` : ""}${availabilityGaps.length ? `${conflicts.length ? " and" : " with"} teacher availability review` : ""}.`,
    input.actorId ?? "usr_branch_demo"
  );
  return { event, conflicts, availabilityGaps };
}

function classSessionPair(state: PlatformState, sessionId: string) {
  const session = state.classSessions.find(
    item => item.id === sessionId || item.eventId === sessionId
  );
  if (!session) throw new Error(`Class session ${sessionId} was not found.`);
  const event = state.events.find(item => item.id === session.eventId);
  if (!event)
    throw new Error(
      `Class session ${session.id} is missing its calendar event.`
    );
  const classGroup = state.classGroups.find(
    item => item.id === session.classGroupId
  );
  if (!classGroup)
    throw new Error(`Class group ${session.classGroupId} was not found.`);
  const courseRun = state.courseRuns.find(
    item => item.id === classGroup.courseRunId
  );
  if (!courseRun)
    throw new Error(`Course run ${classGroup.courseRunId} was not found.`);
  return { session, event, classGroup, courseRun };
}

function assertSessionHasNoAttendance(
  state: PlatformState,
  session: ClassSession
) {
  const sessionKeys = new Set([session.id, session.eventId]);
  if (
    session.attendanceSaved ||
    state.attendance.some(record => sessionKeys.has(record.sessionId))
  ) {
    throw new Error(
      "A session with attendance cannot be rescheduled or cancelled. Preserve it and create a replacement session."
    );
  }
}

function notifyClassRoster(
  state: PlatformState,
  ctx: MutationContext,
  classGroup: ClassGroup,
  title: string,
  body: string
) {
  classGroup.studentIds.forEach(studentId => {
    const student = state.students.find(item => item.id === studentId);
    if (!student) return;
    notify(state, ctx, {
      userId: student.userId,
      title,
      body,
      href: "/app/student/calendar",
    });
  });
}

function applyRescheduleClassSession(
  state: PlatformState,
  input: RescheduleClassSessionActionInput & { actorId?: string },
  ctx: MutationContext
) {
  const reason = input.reason.trim();
  if (reason.length < 5)
    throw new Error("Reschedule reason must be at least 5 characters.");
  const { session, event, classGroup, courseRun } = classSessionPair(
    state,
    input.sessionId
  );
  if (!new Set<EntityStatus>(["active", "pending"]).has(session.status)) {
    throw new Error(
      "Only active or pending class sessions can be rescheduled."
    );
  }
  if (classGroup.status !== "active") {
    throw new Error(
      "Class sessions can only be rescheduled for an active class."
    );
  }
  assertSessionHasNoAttendance(state, session);
  assertCourseRunReadyForDelivery(state, courseRun, "Class rescheduling");

  const starts = new Date(input.startsAt).getTime();
  const ends = new Date(input.endsAt).getTime();
  if (!Number.isFinite(starts) || !Number.isFinite(ends) || starts >= ends) {
    throw new Error("Class rescheduling requires a valid time range.");
  }
  if (
    input.startsAt.slice(0, 10) < courseRun.startsOn ||
    input.endsAt.slice(0, 10) > courseRun.endsOn
  ) {
    throw new Error(
      "Class sessions must stay inside the course run date range."
    );
  }

  const roomId = input.roomId ?? event.roomId;
  const room = roomId
    ? state.rooms.find(item => item.id === roomId)
    : undefined;
  if (roomId && !room) throw new Error(`Room ${roomId} was not found.`);
  if (room && room.status !== "active")
    throw new Error("Class sessions require an active room.");
  if (room && room.branchId !== courseRun.branchId) {
    throw new Error("Class session room must belong to the course run branch.");
  }
  if (room && room.capacity < classGroup.capacity) {
    throw new Error(
      "Class session room capacity is smaller than the class capacity."
    );
  }

  const availabilityMatch = state.teacherAvailability.some(item =>
    availabilityCoversSlot(item, {
      teacherId: courseRun.teacherId,
      branchId: courseRun.branchId,
      weekday: calendarWeekday(input.startsAt),
      startsAt: calendarTime(input.startsAt),
      endsAt: calendarTime(input.endsAt),
    })
  );
  if (!availabilityMatch) {
    throw new Error(
      "Teacher is not available for the requested class-session time."
    );
  }

  const conflict = state.events.find(candidate => {
    if (candidate.id === event.id || candidate.status === "cancelled")
      return false;
    const candidateStarts = new Date(candidate.startsAt).getTime();
    const candidateEnds = new Date(candidate.endsAt).getTime();
    if (!(starts < candidateEnds && ends > candidateStarts)) return false;
    const candidateGroup = candidate.classGroupId
      ? state.classGroups.find(item => item.id === candidate.classGroupId)
      : undefined;
    const candidateRun = candidateGroup
      ? state.courseRuns.find(item => item.id === candidateGroup.courseRunId)
      : undefined;
    const candidateTeacherId = candidateRun?.teacherId ?? candidate.ownerId;
    return Boolean(
      (roomId && candidate.roomId === roomId) ||
        candidate.classGroupId === classGroup.id ||
        candidateTeacherId === courseRun.teacherId
    );
  });
  if (conflict) {
    throw new Error(`Class-session time conflicts with ${conflict.title}.`);
  }

  const previousStartsAt = session.startsAt;
  event.startsAt = input.startsAt;
  event.endsAt = input.endsAt;
  event.roomId = roomId;
  event.status = "active";
  session.startsAt = input.startsAt;
  session.endsAt = input.endsAt;
  session.status = "active";
  notifyClassRoster(
    state,
    ctx,
    classGroup,
    "Class rescheduled",
    `${session.title} moved from ${previousStartsAt} to ${input.startsAt}.`
  );
  appendAudit(
    state,
    ctx,
    "class_session.rescheduled",
    "ClassSession",
    session.id,
    `${session.title} rescheduled from ${previousStartsAt} to ${input.startsAt}. Reason: ${reason}`,
    input.actorId ?? event.ownerId
  );
  return { session, event };
}

function applyCancelClassSession(
  state: PlatformState,
  input: CancelClassSessionActionInput & { actorId?: string },
  ctx: MutationContext
) {
  const reason = input.reason.trim();
  if (reason.length < 5)
    throw new Error("Cancellation reason must be at least 5 characters.");
  const { session, event, classGroup } = classSessionPair(
    state,
    input.sessionId
  );
  if (!new Set<EntityStatus>(["active", "pending"]).has(session.status)) {
    throw new Error("Only active or pending class sessions can be cancelled.");
  }
  assertSessionHasNoAttendance(state, session);
  session.status = "cancelled";
  event.status = "cancelled";
  notifyClassRoster(
    state,
    ctx,
    classGroup,
    "Class cancelled",
    `${session.title} was cancelled. ${reason}`
  );
  appendAudit(
    state,
    ctx,
    "class_session.cancelled",
    "ClassSession",
    session.id,
    `${session.title} cancelled. Reason: ${reason}`,
    input.actorId ?? event.ownerId
  );
  return { session, event };
}

function applySendMessage(
  state: PlatformState,
  input: SendMessageActionInput & { actorId?: string },
  ctx: MutationContext
) {
  const fromUserId = input.fromUserId ?? input.actorId ?? "usr_student_demo";
  const recipientUserIds = Array.from(
    new Set([input.toUserId, ...(input.recipientUserIds ?? [])])
  ).filter(Boolean);
  const replyToMessage = input.replyToMessageId
    ? state.messages.find(message => message.id === input.replyToMessageId)
    : undefined;

  if (input.replyToMessageId && !replyToMessage) {
    throw new Error("The selected message is no longer available.");
  }

  if (replyToMessage) {
    const counterpartUserId =
      replyToMessage.fromUserId === fromUserId
        ? replyToMessage.toUserId
        : replyToMessage.fromUserId;
    const continuesSelectedConversation =
      (replyToMessage.fromUserId === fromUserId ||
        replyToMessage.toUserId === fromUserId) &&
      recipientUserIds.length === 1 &&
      recipientUserIds[0] === counterpartUserId;

    if (!continuesSelectedConversation) {
      throw new Error("The reply must stay in the selected conversation.");
    }
  }

  const messageSubject = replyToMessage
    ? replyMessageSubject(replyToMessage.subject)
    : input.subject;

  const messages = recipientUserIds.map(toUserId => {
    const message: Message = {
      id: ctx.createId("msg"),
      fromUserId,
      toUserId,
      threadId: replyToMessage
        ? messageConversationId(replyToMessage)
        : ctx.createId("thread"),
      replyToMessageId: replyToMessage?.id,
      subject: messageSubject,
      body: input.body,
      attachments: input.attachments?.length ? input.attachments : undefined,
      read: false,
      createdAt: ctx.now(),
    };
    const log: CommunicationLog = {
      id: ctx.createId("comm"),
      actorId: fromUserId,
      channel: input.channel ?? "in_app",
      subject: messageSubject,
      body: input.body,
      attachments: input.attachments?.length ? input.attachments : undefined,
      relatedUserId: toUserId,
      status: "completed",
      createdAt: ctx.now(),
    };
    const recipient = state.users.find(user => user.id === toUserId);
    state.communicationLogs = [log, ...state.communicationLogs];
    if (recipient?.notificationPreferences?.messages !== false) {
      notify(state, ctx, {
        userId: toUserId,
        title: messageSubject,
        body: input.body,
        href: messageRouteForUser(recipient),
        relatedMessageId: message.id,
      });
    }
    appendAudit(
      state,
      ctx,
      "message.sent",
      "Message",
      message.id,
      `Sent message: ${message.subject}.`,
      fromUserId
    );
    return message;
  });
  state.messages = [...messages, ...state.messages];
  return messages[0];
}

function applyApproveCertificate(
  state: PlatformState,
  input: { certificateId: string; actorId?: string },
  ctx: MutationContext
) {
  let updated: Certificate | undefined;
  let changed = false;
  state.certificates = state.certificates.map(certificate => {
    if (certificate.id !== input.certificateId) return certificate;
    if (certificate.status === "approved" || certificate.status === "issued") {
      updated = certificate;
      return certificate;
    }
    if (certificate.status !== "pending_approval") return certificate;
    if (certificate.grade < 80 || certificate.attendanceRate < 80)
      return certificate;
    changed = true;
    updated = {
      ...certificate,
      status: "approved",
      approvedBy: input.actorId ?? "usr_hod_demo",
      approvedAt: ctx.now(),
    };
    return updated;
  });
  if (updated && changed) {
    appendAudit(
      state,
      ctx,
      "certificate.approved",
      "Certificate",
      updated.id,
      `Approved certificate ${updated.verificationCode}.`,
      input.actorId ?? "usr_hod_demo"
    );
  }
  return updated;
}

function applyIssueCertificate(
  state: PlatformState,
  input: { certificateId: string; actorId?: string },
  ctx: MutationContext
) {
  let updated: Certificate | undefined;
  let changed = false;
  state.certificates = state.certificates.map(certificate => {
    if (certificate.id !== input.certificateId) return certificate;
    if (certificate.status === "issued") {
      updated = certificate;
      return certificate;
    }
    if (certificate.status !== "approved") return certificate;
    changed = true;
    updated = {
      ...certificate,
      status: "issued",
      issuedBy: input.actorId ?? "usr_hod_demo",
      issuedAt: ctx.now(),
    };
    return updated;
  });
  if (updated && changed) {
    const student = state.students.find(item => item.id === updated?.studentId);
    const studentId = updated.studentId;
    const verificationCode = updated.verificationCode;
    const documentUrl = `#certificate-${updated.id}`;
    const existingDocument = state.documents.find(
      item =>
        item.ownerId === studentId &&
        item.type === "certificate" &&
        (item.url === documentUrl || item.url === "#certificate-preview")
    );
    if (existingDocument) {
      state.documents = state.documents.map(item =>
        item.id === existingDocument.id
          ? {
              ...item,
              title: `${verificationCode} certificate`,
              url: documentUrl,
              status: "active" as EntityStatus,
            }
          : item
      );
    } else {
      state.documents = [
        {
          id: ctx.createId("doc"),
          ownerId: studentId,
          title: `${verificationCode} certificate`,
          type: "certificate",
          url: documentUrl,
          status: "active",
        },
        ...state.documents,
      ];
    }
    notify(state, ctx, {
      userId: student?.userId ?? updated.studentId,
      title: "Certificate issued",
      body: `${updated.verificationCode} is ready to download.`,
      href: "/app/student/certificates",
    });
    appendAudit(
      state,
      ctx,
      "certificate.issued",
      "Certificate",
      updated.id,
      `Issued certificate ${updated.verificationCode}.`,
      input.actorId ?? "usr_hod_demo"
    );
  }
  return updated;
}

function applyRejectCertificate(
  state: PlatformState,
  input: { certificateId: string; reason: string; actorId?: string },
  ctx: MutationContext
) {
  const reason = input.reason.trim();
  if (!reason) return undefined;
  let updated: Certificate | undefined;
  let changed = false;
  state.certificates = state.certificates.map(certificate => {
    if (certificate.id !== input.certificateId) return certificate;
    if (certificate.status === "issued" || certificate.status === "revoked")
      return certificate;
    if (certificate.status === "rejected") {
      updated = certificate;
      return certificate;
    }
    if (
      certificate.status !== "pending_approval" &&
      certificate.status !== "approved"
    )
      return certificate;
    changed = true;
    updated = {
      ...certificate,
      status: "rejected",
      approvedBy: undefined,
      approvedAt: undefined,
      issuedBy: undefined,
      issuedAt: undefined,
      rejectedBy: input.actorId ?? "usr_hod_demo",
      rejectedAt: ctx.now(),
      rejectionReason: reason,
    };
    return updated;
  });
  if (updated && changed) {
    appendAudit(
      state,
      ctx,
      "certificate.rejected",
      "Certificate",
      updated.id,
      `Rejected certificate ${updated.verificationCode}: ${reason}.`,
      input.actorId ?? "usr_hod_demo"
    );
  }
  return updated;
}

function applyRecordPayment(
  state: PlatformState,
  input: {
    invoiceId: string;
    amount?: number;
    method?: Payment["method"];
    reference?: string;
    actorId?: string;
  },
  ctx: MutationContext
) {
  const invoice = state.invoices.find(item => item.id === input.invoiceId);
  if (!invoice) return undefined;
  const student = state.students.find(item => item.id === invoice.studentId);
  const user = state.users.find(item => item.id === student?.userId);
  const enrollment = enrollmentForInvoice(state, invoice);
  const classGroup = state.classGroups.find(
    item => item.id === enrollment?.classGroupId
  );
  const paidSoFar = state.payments
    .filter(
      payment => payment.invoiceId === invoice.id && payment.status === "paid"
    )
    .reduce((sum, payment) => sum + payment.amount, 0);
  const outstanding = Math.max(0, invoice.amount - paidSoFar);
  const requestedAmount = Number.isFinite(input.amount)
    ? Number(input.amount)
    : outstanding;
  const amount = Math.min(
    outstanding,
    Math.max(0, Math.round(requestedAmount))
  );
  if (amount <= 0 || outstanding <= 0 || invoice.status === "paid") {
    return state.payments.find(
      payment => payment.invoiceId === invoice.id && payment.status === "paid"
    );
  }
  const nextPaid = paidSoFar + amount;
  const nextStatus: Payment["status"] =
    nextPaid >= invoice.amount ? "paid" : "pending";
  const payment: Payment = {
    id: ctx.createId("pay"),
    invoiceId: invoice.id,
    amount,
    method: input.method ?? "manual",
    reference: input.reference?.trim() || undefined,
    paidAt: ctx.now(),
    status: "paid",
  };
  state.payments = [payment, ...state.payments];
  state.invoices = state.invoices.map(item =>
    item.id === invoice.id ? { ...item, status: nextStatus } : item
  );
  appendAudit(
    state,
    ctx,
    "payment.recorded",
    "Payment",
    payment.id,
    `Recorded ${invoice.currency} ${amount} for ${user?.name ?? invoice.studentId} on ${invoice.id}${enrollment ? ` / ${enrollment.id}` : ""}${classGroup ? ` / ${classGroup.name}` : ""}; balance ${Math.max(0, invoice.amount - nextPaid)}.`,
    input.actorId ?? "usr_registrar_demo"
  );
  return payment;
}

function applyRecordPlacementResult(
  state: PlatformState,
  input: {
    bookingId: string;
    recommendedLevel: string;
    score: number;
    notes: string;
    actorId?: string;
  },
  ctx: MutationContext
) {
  const booking = state.placementTests.find(
    item => item.id === input.bookingId
  );
  if (!booking)
    throw new Error(`Placement booking ${input.bookingId} was not found.`);
  if (!Number.isFinite(input.score) || input.score < 0 || input.score > 100) {
    throw new Error("Placement score must be between 0 and 100.");
  }
  const recommendedLevel = input.recommendedLevel.trim();
  const notes = input.notes.trim();
  if (!recommendedLevel || !notes) {
    throw new Error("Placement level and review notes are required.");
  }
  const target = resolveCourseTarget(state, {
    courseInterest: booking.subject,
    recommendedLevel,
    currentLevel: booking.currentLevel,
  });
  const linkedApplication = booking.leadId
    ? state.applications.find(item => item.leadId === booking.leadId)
    : undefined;
  const relatedWorkflow = state.enrollmentWorkflows.find(
    workflow =>
      workflow.placementTestId === booking.id ||
      (linkedApplication && workflow.applicationId === linkedApplication.id)
  );
  if (relatedWorkflow?.status === "active") {
    throw new Error(
      "Active enrollment workflows cannot be replaced by placement results."
    );
  }
  const existing = state.placementResults.find(
    item => item.bookingId === booking.id
  );
  const result: PlacementTestResult = {
    id: existing?.id ?? ctx.createId("ptr"),
    bookingId: booking.id,
    examinerId: "usr_teacher_demo",
    score: input.score,
    recommendedLevel,
    notes,
    createdAt: ctx.now(),
  };
  state.placementResults = existing
    ? state.placementResults.map(item =>
        item.id === existing.id ? result : item
      )
    : [result, ...state.placementResults];
  state.placementTests = state.placementTests.map(item =>
    item.id === booking.id
      ? { ...item, status: "completed", recommendedLevel }
      : item
  );
  const workflow = {
    id: relatedWorkflow?.id ?? ctx.createId("ew"),
    leadId: booking.leadId,
    applicationId: linkedApplication?.id,
    placementTestId: booking.id,
    targetCourseId: target.course.id,
    targetLevelId: target.course.levelId,
    recommendedLevel,
    source: "placement" as const,
    status: "ready_to_enroll" as const,
    nextStep: "Confirm level, assign class, and activate portal",
    updatedAt: ctx.now(),
  };
  state.enrollmentWorkflows = relatedWorkflow
    ? state.enrollmentWorkflows.map(item =>
        item.id === relatedWorkflow.id ? workflow : item
      )
    : [workflow, ...state.enrollmentWorkflows];
  if (!relatedWorkflow?.placementTestId) {
    appendInternalCommunicationLog(state, ctx, {
      actorId: input.actorId ?? "usr_registrar_demo",
      subject: "Enrollment handoff",
      body: `Internal enrollment handoff prepared for ${booking.fullName} after placement; no external message was sent.`,
    });
  }
  appendAudit(
    state,
    ctx,
    existing ? "placement.result_updated" : "placement.result_recorded",
    "PlacementTestResult",
    result.id,
    `Recorded placement result for ${booking.fullName}: ${recommendedLevel} for ${target.course.title}.`,
    input.actorId ?? "usr_registrar_demo"
  );
  return result;
}

function applyConvertLeadToApplication(
  state: PlatformState,
  input: { leadId: string; branchId?: string; actorId?: string },
  ctx: MutationContext
) {
  const lead = state.leads.find(item => item.id === input.leadId);
  if (!lead) throw new Error(`Lead ${input.leadId} was not found.`);
  const existing = state.applications.find(item => item.leadId === lead.id);
  if (existing) return existing;
  const branchId =
    input.branchId ?? defaultAdmissionsBranchId(state, input.actorId);
  if (
    !state.branches.some(
      branch => branch.id === branchId && branch.status === "active"
    )
  ) {
    throw new Error("Choose an active branch for this application.");
  }
  state.leads = state.leads.map(item =>
    item.id === lead.id ? { ...item, status: "ready_to_enroll" } : item
  );
  const application = {
    id: ctx.createId("app"),
    leadId: lead.id,
    branchId,
    courseInterest: lead.subject,
    schedulePreference: "To confirm",
    status: "pending" as EntityStatus,
  };
  state.applications = [application, ...state.applications];
  appendInternalCommunicationLog(state, ctx, {
    actorId: input.actorId ?? "usr_registrar_demo",
    subject: "Lead conversion",
    body: `Internal application file prepared for ${lead.fullName}; no external message was sent.`,
  });
  appendAudit(
    state,
    ctx,
    "lead.converted",
    "Application",
    application.id,
    `Converted ${lead.fullName} to application.`,
    input.actorId ?? "usr_registrar_demo"
  );
  return application;
}

function applyConvertApplicationToEnrollmentWorkflow(
  state: PlatformState,
  input: { applicationId: string; actorId?: string },
  ctx: MutationContext
) {
  const application = state.applications.find(
    item => item.id === input.applicationId
  );
  if (!application) return undefined;
  const lead = state.leads.find(item => item.id === application.leadId);
  if (!lead)
    throw new Error(
      "Application must stay linked to an intake lead before enrollment."
    );
  const target = resolveCourseTarget(state, {
    courseInterest: application.courseInterest,
    currentLevel: lead?.notes,
  });
  const existingWorkflow = state.enrollmentWorkflows.find(
    workflow =>
      workflow.applicationId === application.id ||
      workflow.leadId === application.leadId
  );
  if (existingWorkflow?.status === "active") return existingWorkflow;
  const workflow = {
    id: existingWorkflow?.id ?? ctx.createId("ew"),
    leadId: application.leadId,
    applicationId: application.id,
    placementTestId: existingWorkflow?.placementTestId,
    targetCourseId: existingWorkflow?.targetCourseId ?? target.course.id,
    targetLevelId: existingWorkflow?.targetLevelId ?? target.course.levelId,
    recommendedLevel:
      existingWorkflow?.recommendedLevel ??
      target.level?.title ??
      application.courseInterest,
    source: existingWorkflow?.placementTestId
      ? ("placement" as const)
      : ("application" as const),
    status: "ready_to_enroll" as const,
    nextStep: "Assign course run, class group, and activate portal",
    updatedAt: ctx.now(),
  };
  state.enrollmentWorkflows = existingWorkflow
    ? state.enrollmentWorkflows.map(item =>
        item.id === existingWorkflow.id ? workflow : item
      )
    : [workflow, ...state.enrollmentWorkflows];
  state.applications = state.applications.map(item =>
    item.id === application.id ? { ...item, status: "approved" } : item
  );
  if (lead) {
    state.leads = state.leads.map(item =>
      item.id === lead.id ? { ...item, status: "ready_to_enroll" } : item
    );
  }
  if (!existingWorkflow) {
    appendInternalCommunicationLog(state, ctx, {
      actorId: input.actorId ?? "usr_registrar_demo",
      subject: "Enrollment handoff",
      body: `Internal enrollment handoff prepared for ${lead.fullName}; no external message was sent.`,
    });
  }
  appendAudit(
    state,
    ctx,
    "application.converted",
    "EnrollmentWorkflow",
    workflow.id,
    `Prepared enrollment workflow for ${lead?.fullName ?? application.id}.`,
    input.actorId ?? "usr_registrar_demo"
  );
  return workflow;
}

function applyCreateStudentLifecycleAccount(
  state: PlatformState,
  input: CreateStudentActionInput,
  ctx: MutationContext
) {
  const result = createStudentEnrollmentRecords(state, input, ctx);
  if (input.leadId) {
    state.leads = state.leads.map(item =>
      item.id === input.leadId
        ? { ...item, status: result.student.status }
        : item
    );
  }
  if (input.applicationId) {
    state.applications = state.applications.map(item =>
      item.id === input.applicationId ? { ...item, status: "approved" } : item
    );
  }
  if (input.placementTestId) {
    state.placementTests = state.placementTests.map(item =>
      item.id === input.placementTestId
        ? {
            ...item,
            status: "completed",
            recommendedLevel: result.student.currentLevel,
          }
        : item
    );
  }
  appendAudit(
    state,
    ctx,
    "student.created",
    "StudentProfile",
    result.student.id,
    `Created ${result.user.name} from ${result.student.source ?? "direct"} intake.`,
    input.actorId ?? "usr_registrar_demo"
  );
  appendAudit(
    state,
    ctx,
    "enrollment.created",
    "Enrollment",
    result.enrollment.id,
    `Assigned ${result.user.name} to ${result.course.title}, ${result.classGroup.name}.`,
    input.actorId ?? "usr_registrar_demo"
  );
  return result;
}

const studentIntakeDocumentTypes = new Set<StudentIntakeDocumentType>([
  "profile_photo",
  "passport",
  "national_id",
  "birth_certificate",
  "guardian_id",
  "consent",
]);
const studentIdentityMimeTypes = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);
const maxStudentIdentityDocumentSize = 10 * 1024 * 1024;

function applyAddStudentDocument(
  state: PlatformState,
  input: AddStudentDocumentActionInput,
  ctx: MutationContext
) {
  const student = state.students.find(item => item.id === input.studentId);
  if (!student) throw new Error("Student record was not found.");
  if (!studentIntakeDocumentTypes.has(input.documentType)) {
    throw new Error("Choose a valid student identity document type.");
  }

  const attachment = cleanPendingMedia([input.attachment])[0];
  if (!attachment) throw new Error("Choose one student identity document.");
  if (!studentIdentityMimeTypes.has(attachment.type.toLowerCase())) {
    throw new Error(
      "Student identity documents must be PDF, JPEG, PNG, or WebP."
    );
  }
  if (attachment.size > maxStudentIdentityDocumentSize) {
    throw new Error("Student identity documents must be 10 MB or smaller.");
  }
  if (input.documentType === "profile_photo" && attachment.kind !== "image") {
    throw new Error("Student profile photos must be image files.");
  }
  if (
    input.documentType !== "profile_photo" &&
    attachment.kind !== "document" &&
    attachment.kind !== "image"
  ) {
    throw new Error(
      "Student identity records accept document or image files only."
    );
  }
  if (
    state.documents.some(
      item =>
        item.ownerId === student.id &&
        item.ownerType === "student" &&
        item.type === input.documentType &&
        item.status !== "cancelled" &&
        item.status !== "rejected"
    )
  ) {
    throw new Error(
      "This student already has a pending or active document of that type."
    );
  }

  const document: Document = {
    id: ctx.createId("doc_student"),
    ownerId: student.id,
    ownerType: "student",
    title: input.documentType.replaceAll("_", " "),
    type: input.documentType,
    url: "",
    status: "pending",
    sensitivity: "restricted_identity",
    fileName: attachment.name,
    mimeType: attachment.type,
    size: attachment.size,
    storageStatus: "pending_storage",
    createdAt: ctx.now(),
    createdBy: input.actorId,
  };
  state.documents = [document, ...state.documents];
  appendAudit(
    state,
    ctx,
    "student.document_metadata_added",
    "Document",
    document.id,
    `Added pending ${input.documentType.replaceAll("_", " ")} metadata for student ${student.id}; no file was stored.`,
    input.actorId ?? "usr_registrar_demo"
  );
  return document;
}

function applyUpdateStudentStatus(
  state: PlatformState,
  input: UpdateStudentStatusActionInput,
  ctx: MutationContext
) {
  const student = state.students.find(item => item.id === input.studentId);
  if (!student) throw new Error("Student record was not found.");
  const status = normalizeStudentStatus(input.status);
  const user = state.users.find(item => item.id === student.userId);
  const notes = input.notes?.trim();
  state.students = state.students.map(item =>
    item.id === student.id
      ? {
          ...item,
          status,
          notes: notes
            ? `${item.notes ? `${item.notes} · ` : ""}${notes}`
            : item.notes,
        }
      : item
  );
  state.users = state.users.map(item =>
    item.id === student.userId
      ? { ...item, status: accountStatusFromStudentStatus(status) }
      : item
  );
  state.enrollments = state.enrollments.map(item =>
    item.studentId === student.id ? { ...item, status } : item
  );
  appendAudit(
    state,
    ctx,
    "student.status_updated",
    "StudentProfile",
    student.id,
    `Set ${user?.name ?? student.id} to ${status}.`,
    input.actorId ?? "usr_registrar_demo"
  );
  return state.students.find(item => item.id === student.id);
}

function applyActivateEnrollmentWorkflow(
  state: PlatformState,
  input: {
    workflowId: string;
    courseRunId?: string;
    classGroupId?: string;
    actorId?: string;
  },
  ctx: MutationContext
) {
  const workflow = state.enrollmentWorkflows.find(
    item => item.id === input.workflowId
  );
  if (!workflow)
    throw new Error(`Enrollment workflow ${input.workflowId} was not found.`);

  const targetCourseId = workflow.targetCourseId;
  const targetCourse = state.courses.find(
    course => course.id === targetCourseId
  );
  if (!targetCourse || targetCourse.status !== "active") {
    throw new Error(
      `Course ${targetCourseId} must be active before enrollment activation.`
    );
  }
  const isInitialActivation = !workflow.studentId;
  if (isInitialActivation && (!input.courseRunId || !input.classGroupId)) {
    throw new Error(
      "Enrollment activation requires an exact course run and class group."
    );
  }
  const exactCourseRunId = isInitialActivation
    ? input.courseRunId
    : (input.courseRunId ?? workflow.courseRunId);
  const exactClassGroupId = isInitialActivation
    ? input.classGroupId
    : (input.classGroupId ?? workflow.classGroupId);
  const requestedCourseRun = exactCourseRunId
    ? state.courseRuns.find(run => run.id === exactCourseRunId)
    : undefined;
  if (exactCourseRunId && !requestedCourseRun) {
    throw new Error(`Course run ${exactCourseRunId} was not found.`);
  }
  if (requestedCourseRun && requestedCourseRun.courseId !== targetCourseId) {
    throw new Error(
      `Course run ${requestedCourseRun.id} does not match this enrollment workflow.`
    );
  }

  const requestedClassGroup = exactClassGroupId
    ? state.classGroups.find(group => group.id === exactClassGroupId)
    : undefined;
  if (exactClassGroupId && !requestedClassGroup) {
    throw new Error(`Class group ${exactClassGroupId} was not found.`);
  }
  const requestedClassCourseRun = requestedClassGroup
    ? state.courseRuns.find(run => run.id === requestedClassGroup.courseRunId)
    : undefined;
  if (requestedClassGroup && !requestedClassCourseRun) {
    throw new Error(
      `Class group ${requestedClassGroup.id} is missing its course run.`
    );
  }
  if (
    requestedClassCourseRun &&
    requestedClassCourseRun.courseId !== targetCourseId
  ) {
    throw new Error(
      `Class group ${requestedClassGroup?.id ?? input.classGroupId} does not match this enrollment workflow.`
    );
  }
  if (
    requestedCourseRun &&
    requestedClassGroup &&
    requestedClassGroup.courseRunId !== requestedCourseRun.id
  ) {
    throw new Error(
      `Class group ${requestedClassGroup.id} does not belong to course run ${requestedCourseRun.id}.`
    );
  }

  const existingStudent = workflow.studentId
    ? state.students.find(student => student.id === workflow.studentId)
    : undefined;
  if (existingStudent) {
    const existingUser = state.users.find(
      user => user.id === existingStudent.userId
    );
    const existingEnrollment = state.enrollments.find(enrollment => {
      if (enrollment.studentId !== existingStudent.id) return false;
      const run = state.courseRuns.find(
        item => item.id === enrollment.courseRunId
      );
      return (
        run?.courseId === targetCourseId &&
        (!workflow.courseRunId ||
          enrollment.courseRunId === workflow.courseRunId) &&
        (!workflow.classGroupId ||
          enrollment.classGroupId === workflow.classGroupId)
      );
    });
    if (!existingEnrollment) {
      throw new Error(
        `Enrollment workflow ${workflow.id} is incomplete: enrollment is missing.`
      );
    }
    const existingRun = state.courseRuns.find(
      run => run.id === existingEnrollment.courseRunId
    );
    const existingClassGroup = existingEnrollment.classGroupId
      ? state.classGroups.find(
          group => group.id === existingEnrollment.classGroupId
        )
      : undefined;
    const existingInvoice = state.invoices.find(
      invoice =>
        invoice.studentId === existingStudent.id &&
        invoice.enrollmentId === existingEnrollment.id
    );
    if (
      workflow.status !== "active" ||
      existingStudent.status !== "active" ||
      existingUser?.status !== "active" ||
      existingEnrollment.status !== "active" ||
      existingRun?.status !== "active" ||
      !existingClassGroup ||
      existingClassGroup.status !== "active" ||
      existingClassGroup.courseRunId !== existingEnrollment.courseRunId ||
      !existingClassGroup.studentIds.includes(existingStudent.id) ||
      !existingInvoice
    ) {
      throw new Error(
        `Enrollment workflow ${workflow.id} is incomplete and cannot be replayed.`
      );
    }
    const existingCourseRunId = existingEnrollment.courseRunId;
    const existingClassGroupId = existingClassGroup.id;
    if (
      input.courseRunId &&
      existingCourseRunId &&
      input.courseRunId !== existingCourseRunId
    ) {
      throw new Error(
        "Activated enrollment workflows cannot be reassigned to a different course run."
      );
    }
    if (
      input.classGroupId &&
      existingClassGroupId &&
      input.classGroupId !== existingClassGroupId
    ) {
      throw new Error(
        "Activated enrollment workflows cannot be reassigned to a different class group."
      );
    }
    return existingStudent;
  }

  const lead = workflow.leadId
    ? state.leads.find(item => item.id === workflow.leadId)
    : undefined;
  const application = workflow.applicationId
    ? state.applications.find(item => item.id === workflow.applicationId)
    : undefined;
  const placement = workflow.placementTestId
    ? state.placementTests.find(item => item.id === workflow.placementTestId)
    : undefined;
  const placementResult = workflow.placementTestId
    ? state.placementResults.find(
        item => item.bookingId === workflow.placementTestId
      )
    : undefined;

  const courseRun = requestedCourseRun;
  if (!courseRun) {
    throw new Error(
      `Enrollment workflow ${workflow.id} requires an exact course run.`
    );
  }
  assertCourseRunReadyForDelivery(state, courseRun, "Enrollment activation");

  const classGroup = requestedClassGroup;
  if (!classGroup) {
    throw new Error(
      `Course run ${courseRun.id} requires an exact class group before enrollment activation.`
    );
  }
  if (classGroup.status !== "active") {
    throw new Error("Enrollment activation requires an active class group.");
  }
  if (classGroup.studentIds.length >= classGroup.capacity) {
    throw new Error(`Class group ${classGroup.id} is full.`);
  }

  const branch = state.branches.find(item => item.id === courseRun.branchId);
  const course = targetCourse;
  const program = state.programs.find(item => item.id === course?.programId);
  const packageRow = state.packages.find(
    item => item.courseId === courseRun.courseId && item.status === "active"
  );
  const resolvedLevelLabel =
    placementResult?.recommendedLevel ??
    placement?.recommendedLevel ??
    workflow.recommendedLevel ??
    placement?.currentLevel ??
    state.levels.find(
      level =>
        level.id === workflow.targetLevelId || level.id === course?.levelId
    )?.title ??
    "Placement pending";
  const name = (lead?.fullName ?? placement?.fullName ?? "").trim();
  const email = (lead?.email ?? placement?.email ?? "").trim().toLowerCase();
  const phone = (lead?.phone ?? placement?.phone ?? "").trim();
  if (!name || !email || !phone) {
    throw new Error(
      "Enrollment activation requires lead or placement identity with name, email, and phone."
    );
  }
  if (!email.includes("@")) {
    throw new Error("Enrollment activation requires a valid intake email.");
  }
  if (state.users.some(item => item.email.toLowerCase() === email)) {
    throw new Error("This email is already in the identity directory.");
  }
  const studentStatus: StudentStatus = "active";
  const userId = ctx.createId("usr_student");
  const studentId = ctx.createId("stu");
  const enrollmentId = ctx.createId("enr");
  const invoiceId = ctx.createId("inv");

  state.users = [
    {
      id: userId,
      name,
      email,
      phone,
      notes: lead?.notes,
      roles: ["student"],
      activeRole: "student",
      branchId: courseRun.branchId,
      departmentId: program?.departmentId ?? "dep_arabic",
      status: "active",
    },
    ...state.users,
  ];
  state.students = [
    {
      id: studentId,
      userId,
      status: studentStatus,
      source:
        workflow.source ??
        (workflow.placementTestId
          ? "placement"
          : workflow.applicationId
            ? "application"
            : "lead"),
      currentLevel: resolvedLevelLabel,
      courseInterest:
        application?.courseInterest ?? placement?.subject ?? lead?.subject,
      notes: lead?.notes,
      country: lead?.country ?? "Egypt",
      preferredLanguage: program?.language ?? "English",
      timezone: branch?.timezone ?? "Africa/Cairo",
    },
    ...state.students,
  ];
  state.enrollments = [
    {
      id: enrollmentId,
      studentId,
      courseRunId: courseRun.id,
      levelId: course?.levelId,
      classGroupId: classGroup.id,
      teacherId: courseRun.teacherId,
      source:
        workflow.source ??
        (workflow.placementTestId
          ? "placement"
          : workflow.applicationId
            ? "application"
            : "lead"),
      status: studentStatus,
      progress: 0,
      attendanceRate: 0,
      currentGrade: 0,
      createdAt: ctx.now(),
    },
    ...state.enrollments,
  ];
  state.classGroups = state.classGroups.map(group =>
    group.id === classGroup.id
      ? { ...group, studentIds: [...group.studentIds, studentId] }
      : group
  );
  const lessonIds = state.modules
    .filter(module => module.courseId === courseRun.courseId)
    .flatMap(module =>
      state.lessons
        .filter(lesson => lesson.moduleId === module.id)
        .map(lesson => lesson.id)
    );
  state.lessonProgress = [
    ...lessonIds.map(lessonId => ({
      id: ctx.createId("lp"),
      studentId,
      enrollmentId,
      lessonId,
      status: "not_started" as const,
    })),
    ...state.lessonProgress,
  ];
  state.invoices = [
    {
      id: invoiceId,
      studentId,
      enrollmentId,
      amount: packageRow?.amount ?? 0,
      currency: packageRow?.currency ?? "EGP",
      dueAt: ctx.now().slice(0, 10),
      status: "pending",
    },
    ...state.invoices,
  ];
  state.enrollmentWorkflows = state.enrollmentWorkflows.map(item =>
    item.id === workflow.id
      ? {
          ...item,
          studentId,
          courseRunId: courseRun.id,
          classGroupId: classGroup.id,
          status: studentStatus,
          nextStep: "Portal active, class assigned, invoice pending payment",
          updatedAt: ctx.now(),
        }
      : item
  );
  if (lead) {
    state.leads = state.leads.map(item =>
      item.id === lead.id ? { ...item, status: "active" } : item
    );
  }
  if (application) {
    state.applications = state.applications.map(item =>
      item.id === application.id ? { ...item, status: "approved" } : item
    );
  }
  appendAudit(
    state,
    ctx,
    "student.created",
    "StudentProfile",
    studentId,
    `Created ${name} from ${workflow.source ?? "enrollment"} workflow.`,
    input.actorId ?? "usr_registrar_demo"
  );
  appendAudit(
    state,
    ctx,
    "enrollment.activated",
    "EnrollmentWorkflow",
    workflow.id,
    `Activated ${name} for ${course?.title ?? courseRun.courseId} in ${classGroup.name}; enrollment ${enrollmentId}, invoice ${invoiceId}.`,
    input.actorId ?? "usr_registrar_demo"
  );
  return state.students.find(student => student.id === studentId);
}

function aggregateStudentEnrollmentStatus(
  enrollments: PlatformState["enrollments"]
): StudentStatus {
  if (
    enrollments.some(
      item => item.status === "active" || item.status === "enrolled"
    )
  ) {
    return "active";
  }
  if (enrollments.some(item => item.status === "paused")) return "paused";
  if (
    enrollments.length &&
    enrollments.every(item => item.status === "completed")
  ) {
    return "completed";
  }
  if (
    enrollments.length &&
    enrollments.every(item => item.status === "cancelled")
  ) {
    return "cancelled";
  }
  return "enrolled";
}

function syncStudentStatusFromEnrollments(
  state: PlatformState,
  studentId: string
) {
  const status = aggregateStudentEnrollmentStatus(
    state.enrollments.filter(item => item.studentId === studentId)
  );
  const student = state.students.find(item => item.id === studentId);
  state.students = state.students.map(item =>
    item.id === studentId ? { ...item, status } : item
  );
  if (student) {
    state.users = state.users.map(item =>
      item.id === student.userId
        ? { ...item, status: accountStatusFromStudentStatus(status) }
        : item
    );
  }
  return status;
}

function applyTransferEnrollment(
  state: PlatformState,
  input: TransferEnrollmentActionInput,
  ctx: MutationContext
) {
  const enrollment = state.enrollments.find(
    item => item.id === input.enrollmentId
  );
  if (!enrollment)
    throw new Error(`Enrollment ${input.enrollmentId} was not found.`);
  if (!new Set<StudentStatus>(["active", "paused"]).has(enrollment.status)) {
    throw new Error("Only active or paused enrollments can be transferred.");
  }
  const reason = input.reason.trim();
  if (!reason) throw new Error("Enrollment transfer requires a reason.");
  const sourceGroup = enrollment.classGroupId
    ? state.classGroups.find(item => item.id === enrollment.classGroupId)
    : undefined;
  if (!sourceGroup || !sourceGroup.studentIds.includes(enrollment.studentId)) {
    throw new Error("Enrollment source roster is incomplete.");
  }
  const targetGroup = state.classGroups.find(
    item => item.id === input.classGroupId
  );
  if (!targetGroup)
    throw new Error(`Class group ${input.classGroupId} was not found.`);
  if (targetGroup.id === sourceGroup.id)
    throw new Error("Choose a different class group.");
  if (targetGroup.courseRunId !== enrollment.courseRunId) {
    throw new Error(
      "Enrollment transfers must remain inside the same course run."
    );
  }
  if (targetGroup.status !== "active") {
    throw new Error("Enrollment transfer requires an active target class.");
  }
  if (targetGroup.studentIds.includes(enrollment.studentId)) {
    throw new Error("The target class already contains this student.");
  }
  if (targetGroup.studentIds.length >= targetGroup.capacity) {
    throw new Error(`Class group ${targetGroup.id} is full.`);
  }
  const run = state.courseRuns.find(item => item.id === enrollment.courseRunId);
  if (!run)
    throw new Error(`Course run ${enrollment.courseRunId} was not found.`);
  assertCourseRunReadyForDelivery(state, run, "Enrollment transfer");

  state.classGroups = state.classGroups.map(group => {
    if (group.id === sourceGroup.id) {
      return {
        ...group,
        studentIds: group.studentIds.filter(
          studentId => studentId !== enrollment.studentId
        ),
      };
    }
    if (group.id === targetGroup.id) {
      return {
        ...group,
        studentIds: [...group.studentIds, enrollment.studentId],
      };
    }
    return group;
  });
  const updatedEnrollment = {
    ...enrollment,
    classGroupId: targetGroup.id,
    teacherId: run.teacherId,
  };
  state.enrollments = state.enrollments.map(item =>
    item.id === enrollment.id ? updatedEnrollment : item
  );
  state.enrollmentWorkflows = state.enrollmentWorkflows.map(item =>
    item.studentId === enrollment.studentId &&
    item.courseRunId === enrollment.courseRunId &&
    item.classGroupId === sourceGroup.id
      ? {
          ...item,
          classGroupId: targetGroup.id,
          nextStep: `Enrollment active in ${targetGroup.name}`,
          updatedAt: ctx.now(),
        }
      : item
  );
  const student = state.students.find(item => item.id === enrollment.studentId);
  notify(state, ctx, {
    userId: student?.userId ?? "usr_student_demo",
    title: "Class assignment updated",
    body: `Your class changed from ${sourceGroup.name} to ${targetGroup.name}.`,
    href: "/app/student/courses",
  });
  appendAudit(
    state,
    ctx,
    "enrollment.transferred",
    "Enrollment",
    enrollment.id,
    `Transferred ${enrollment.studentId} from ${sourceGroup.name} to ${targetGroup.name}. Reason: ${reason}`,
    input.actorId ?? "usr_registrar_demo"
  );
  return { enrollment: updatedEnrollment, sourceGroup, targetGroup, reason };
}

function applyUpdateEnrollmentStatus(
  state: PlatformState,
  input: UpdateEnrollmentStatusActionInput,
  ctx: MutationContext
) {
  const enrollment = state.enrollments.find(
    item => item.id === input.enrollmentId
  );
  if (!enrollment)
    throw new Error(`Enrollment ${input.enrollmentId} was not found.`);
  const allowed = new Set<UpdateEnrollmentStatusActionInput["status"]>([
    "active",
    "paused",
    "completed",
    "cancelled",
  ]);
  if (!allowed.has(input.status))
    throw new Error("Choose a valid enrollment status.");
  if (enrollment.status === "completed" || enrollment.status === "cancelled") {
    throw new Error("Completed or cancelled enrollments are terminal.");
  }
  if (input.status === enrollment.status) {
    throw new Error(`Enrollment is already ${input.status}.`);
  }
  if (input.status === "active" && enrollment.status !== "paused") {
    throw new Error("Only a paused enrollment can be resumed.");
  }
  const reason = input.reason?.trim() ?? "";
  if ((input.status === "paused" || input.status === "cancelled") && !reason) {
    throw new Error(
      `${input.status === "paused" ? "Pausing" : "Cancelling"} an enrollment requires a reason.`
    );
  }
  if (input.status === "completed" && enrollment.progress < 100) {
    throw new Error("Enrollment progress must reach 100% before completion.");
  }
  const group = enrollment.classGroupId
    ? state.classGroups.find(item => item.id === enrollment.classGroupId)
    : undefined;
  const run = state.courseRuns.find(item => item.id === enrollment.courseRunId);
  if (input.status === "active") {
    if (!group || group.status !== "active") {
      throw new Error("Enrollment resume requires an active class group.");
    }
    if (!run)
      throw new Error(`Course run ${enrollment.courseRunId} was not found.`);
    assertCourseRunReadyForDelivery(state, run, "Enrollment resume");
    if (
      !group.studentIds.includes(enrollment.studentId) &&
      group.studentIds.length >= group.capacity
    ) {
      throw new Error(`Class group ${group.id} is full.`);
    }
  }

  const updatedEnrollment = { ...enrollment, status: input.status };
  state.enrollments = state.enrollments.map(item =>
    item.id === enrollment.id ? updatedEnrollment : item
  );
  if (input.status === "cancelled" && group) {
    state.classGroups = state.classGroups.map(item =>
      item.id === group.id
        ? {
            ...item,
            studentIds: item.studentIds.filter(
              studentId => studentId !== enrollment.studentId
            ),
          }
        : item
    );
  } else if (
    input.status === "active" &&
    group &&
    !group.studentIds.includes(enrollment.studentId)
  ) {
    state.classGroups = state.classGroups.map(item =>
      item.id === group.id
        ? { ...item, studentIds: [...item.studentIds, enrollment.studentId] }
        : item
    );
  }
  const studentStatus = syncStudentStatusFromEnrollments(
    state,
    enrollment.studentId
  );
  state.enrollmentWorkflows = state.enrollmentWorkflows.map(item =>
    item.studentId === enrollment.studentId &&
    item.courseRunId === enrollment.courseRunId &&
    (!item.classGroupId || item.classGroupId === enrollment.classGroupId)
      ? {
          ...item,
          status: input.status,
          nextStep:
            input.status === "active"
              ? "Portal active and class assigned"
              : `Enrollment ${input.status}`,
          updatedAt: ctx.now(),
        }
      : item
  );
  const student = state.students.find(item => item.id === enrollment.studentId);
  notify(state, ctx, {
    userId: student?.userId ?? "usr_student_demo",
    title: `Enrollment ${input.status}`,
    body: reason || `Your enrollment status is now ${input.status}.`,
    href: "/app/student/courses",
  });
  appendAudit(
    state,
    ctx,
    "enrollment.status_updated",
    "Enrollment",
    enrollment.id,
    `Set enrollment from ${enrollment.status} to ${input.status}.${reason ? ` Reason: ${reason}` : ""}`,
    input.actorId ?? "usr_registrar_demo"
  );
  return {
    enrollment: updatedEnrollment,
    previousStatus: enrollment.status,
    studentStatus,
    reason,
  };
}

const weekdayAliases: Record<string, string> = {
  sun: "Sunday",
  sunday: "Sunday",
  mon: "Monday",
  monday: "Monday",
  tue: "Tuesday",
  tues: "Tuesday",
  tuesday: "Tuesday",
  wed: "Wednesday",
  wednesday: "Wednesday",
  thu: "Thursday",
  thur: "Thursday",
  thurs: "Thursday",
  thursday: "Thursday",
  fri: "Friday",
  friday: "Friday",
  sat: "Saturday",
  saturday: "Saturday",
};

function normalizeTime(value: string) {
  const match = value.match(/(\d{1,2}):(\d{2})/);
  if (!match) return undefined;
  const hour = Math.min(23, Math.max(0, Number(match[1])));
  const minute = Math.min(59, Math.max(0, Number(match[2])));
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function addMinutesToTime(value: string, minutes: number) {
  const [hour, minute] = value.split(":").map(Number);
  const total = Math.min(
    23 * 60 + 59,
    Math.max(0, hour * 60 + minute + minutes)
  );
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function parseTeacherAvailabilitySlot(
  input: string,
  branchId: string,
  teacherId: string,
  ctx: MutationContext
) {
  const normalized = input.trim();
  const weekdayMatch = normalized.match(/[A-Za-z]+/);
  const weekday = weekdayMatch
    ? weekdayAliases[weekdayMatch[0].toLowerCase()]
    : undefined;
  const times = normalized.match(/\d{1,2}:\d{2}/g) ?? [];
  const startsAt = normalizeTime(times[0] ?? "");
  const endsAt =
    normalizeTime(times[1] ?? "") ??
    (startsAt ? addMinutesToTime(startsAt, 90) : undefined);
  if (!weekday || !startsAt || !endsAt || startsAt >= endsAt) return undefined;
  return {
    id: ctx.createId("avail"),
    teacherId,
    weekday,
    startsAt,
    endsAt,
    branchId,
  } satisfies TeacherAvailability;
}

function studentStatusFromAccountStatus(status: EntityStatus): StudentStatus {
  if (status === "paused") return "paused";
  if (status === "pending") return "ready_to_enroll";
  return "active";
}

function accountStatusFromStudentStatus(status: StudentStatus): EntityStatus {
  if (status === "paused") return "paused";
  if (status === "completed") return "completed";
  if (status === "cancelled") return "cancelled";
  if (
    status === "lead" ||
    status === "trial_booked" ||
    status === "placement_booked" ||
    status === "placement_completed" ||
    status === "ready_to_enroll"
  ) {
    return "pending";
  }
  return "active";
}

const accountStatuses: EntityStatus[] = ["active", "pending", "paused"];
const studentLifecycleStatuses: StudentStatus[] = [
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
];
const staffRoles: StaffRole[] = [
  "teacher",
  "registrar",
  "headofdepartment",
  "branchadmin",
  "superadmin",
];
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
const defaultStaffScopeByRole: Record<StaffRole, StaffPermissionScope> = {
  teacher: "department",
  registrar: "admissions",
  headofdepartment: "department",
  branchadmin: "operations",
  superadmin: "global",
};
const defaultOperationalScopeByRole: Record<StaffRole, string[]> = {
  teacher: ["classes", "attendance", "grading"],
  registrar: ["leads", "placement", "enrollments", "payments"],
  headofdepartment: ["curriculum", "teachers", "certificates", "reports"],
  branchadmin: ["rooms", "schedule", "attendance", "payments"],
  superadmin: ["users", "roles", "permissions", "audit"],
};
const staffTitleByRole: Record<StaffRole, string> = {
  teacher: "Teacher",
  registrar: "Registrar",
  headofdepartment: "Head of Department",
  branchadmin: "Branch Admin",
  superadmin: "Super Admin",
};

function validateAccountScope(
  state: PlatformState,
  input: CreateUserActionInput
) {
  if (!roleOrder.includes(input.role)) {
    throw new Error("Choose a valid account role.");
  }
  const status = validateAccountStatus(input.status);
  const branch = state.branches.find(item => item.id === input.branchId);
  if (!branch) {
    throw new Error("Choose a valid branch for this account.");
  }
  const department = state.departments.find(
    item => item.id === input.departmentId
  );
  if (!department) {
    throw new Error("Choose a valid department for this account.");
  }
  if (!department.branchIds.includes(branch.id) && branch.id !== "br_global") {
    throw new Error(
      "Selected department is not available in the chosen branch."
    );
  }
  return { status, branch, department };
}

function normalizeStaffScopeInput(input: CreateStaffUserActionInput) {
  if ((input.role as Role) === "student") {
    throw new Error(
      "Student accounts must be created through registrar admissions."
    );
  }
  if (!staffRoles.includes(input.role)) throw new Error("Choose a staff role.");
  const branchId =
    input.role === "superadmin"
      ? (input.branchId ?? "br_global")
      : input.branchId;
  const departmentId =
    input.role === "superadmin"
      ? (input.departmentId ?? "dep_platform")
      : input.departmentId;
  const permissionScope =
    input.permissionScope ?? defaultStaffScopeByRole[input.role];
  const availabilityStatus =
    input.availabilityStatus ??
    (input.role === "teacher" ? "available" : "not_applicable");
  return { branchId, departmentId, permissionScope, availabilityStatus };
}

function validateStaffAccountScope(
  state: PlatformState,
  input: CreateStaffUserActionInput
) {
  const status = validateAccountStatus(input.status);
  const { branchId, departmentId, permissionScope, availabilityStatus } =
    normalizeStaffScopeInput(input);
  if (!staffPermissionScopes.has(permissionScope))
    throw new Error("Choose a valid permission scope.");
  if (!staffAvailabilityStatuses.has(availabilityStatus))
    throw new Error("Choose a valid availability status.");
  const branch = state.branches.find(item => item.id === branchId);
  if (!branch) throw new Error("Choose a valid branch for this staff account.");
  const department = state.departments.find(item => item.id === departmentId);
  if (!department)
    throw new Error("Choose a valid department for this staff account.");
  if (!department.branchIds.includes(branch.id) && branch.id !== "br_global") {
    throw new Error(
      "Selected department is not available in the chosen branch."
    );
  }
  if (input.role === "teacher") {
    if (!input.subjects?.map(item => item.trim()).filter(Boolean).length) {
      throw new Error("Teacher accounts require at least one subject.");
    }
    if (
      !input.teachingLevels?.map(item => item.trim()).filter(Boolean).length
    ) {
      throw new Error("Teacher accounts require at least one teaching level.");
    }
    if (availabilityStatus === "not_applicable") {
      throw new Error("Teacher accounts require an availability status.");
    }
  }
  if (input.role === "registrar" && permissionScope !== "admissions") {
    throw new Error("Registrar accounts require admissions permission scope.");
  }
  if (input.role === "headofdepartment" && permissionScope !== "department") {
    throw new Error("HOD accounts require department permission scope.");
  }
  if (input.role === "branchadmin") {
    if (permissionScope !== "operations")
      throw new Error(
        "Branch admin accounts require operations permission scope."
      );
    if (
      !input.operationalScope?.map(item => item.trim()).filter(Boolean).length
    ) {
      throw new Error(
        "Branch admin accounts require at least one operational scope."
      );
    }
  }
  if (input.role === "superadmin" && permissionScope !== "global") {
    throw new Error("Super admin accounts require global permission scope.");
  }
  return {
    status,
    branch,
    department,
    branchId: branch.id,
    departmentId: department.id,
    permissionScope,
    availabilityStatus,
  };
}

function isMinorAgeGroup(ageGroup: string) {
  const normalized = ageGroup.trim().toLowerCase();
  return Boolean(
    normalized && !/adult|18\+|university|parent not required/.test(normalized)
  );
}

const defaultNotificationPreferences: UserNotificationPreferences = {
  messages: true,
  schedule: true,
  academic: true,
  billing: false,
  system: false,
};

function cleanProfileText(value: string | undefined, maxLength = 120) {
  return value === undefined ? undefined : value.trim().slice(0, maxLength);
}

function normalizeNotificationPreferences(
  input: Partial<UserNotificationPreferences> | undefined,
  current?: UserNotificationPreferences
) {
  if (!input) return current;
  return {
    ...defaultNotificationPreferences,
    ...current,
    ...Object.fromEntries(
      Object.entries(input).filter(
        (entry): entry is [keyof UserNotificationPreferences, boolean] =>
          typeof entry[1] === "boolean"
      )
    ),
  };
}

function normalizeStudentStatus(status?: StudentStatus) {
  const nextStatus = status ?? "active";
  if (!studentLifecycleStatuses.includes(nextStatus))
    throw new Error("Choose a valid student status.");
  return nextStatus;
}

function resolveCourseTarget(
  state: PlatformState,
  input: {
    courseInterest?: string;
    recommendedLevel?: string;
    currentLevel?: string;
    targetCourseId?: string;
  }
) {
  const text =
    `${input.courseInterest ?? ""} ${input.recommendedLevel ?? ""} ${input.currentLevel ?? ""}`.toLowerCase();
  const targetCourseId =
    input.targetCourseId ??
    (/(quran|tajweed|recitation|memorization|memorisation)/i.test(text)
      ? "course_qt_1"
      : "course_ar_l3");
  const course =
    state.courses.find(item => item.id === targetCourseId) ??
    state.courses.find(
      item => text && item.title.toLowerCase().includes(text)
    ) ??
    state.courses.find(item => item.id === "course_ar_l3") ??
    state.courses[0];
  if (!course) throw new Error("Choose a valid course for this student.");
  const level = state.levels.find(item => item.id === course.levelId);
  return { course, level };
}

function resolveEnrollmentAssignment(
  state: PlatformState,
  input: {
    branchId: string;
    courseRunId: string;
    classGroupId: string;
    targetCourseId?: string;
  }
) {
  const branch = state.branches.find(item => item.id === input.branchId);
  if (!branch) throw new Error("Choose a valid branch for this student.");
  const courseRun = state.courseRuns.find(
    item => item.id === input.courseRunId
  );
  if (!courseRun)
    throw new Error("Choose a valid course run for this student.");
  if (input.targetCourseId && courseRun.courseId !== input.targetCourseId) {
    throw new Error(
      "Selected course run must match the student course interest."
    );
  }
  if (courseRun.branchId !== branch.id) {
    throw new Error(
      "Student branch must match the selected course and class branch."
    );
  }
  assertCourseRunReadyForDelivery(state, courseRun, "Student enrollment");
  const classGroup = state.classGroups.find(
    item => item.id === input.classGroupId
  );
  if (!classGroup || classGroup.courseRunId !== courseRun.id) {
    throw new Error(
      "Selected class group must belong to the selected course run."
    );
  }
  if (classGroup.studentIds.length >= classGroup.capacity) {
    throw new Error("Selected class is already at capacity.");
  }
  return { branch, courseRun, classGroup };
}

function createStudentEnrollmentRecords(
  state: PlatformState,
  input: CreateStudentActionInput,
  ctx: MutationContext
) {
  const name = input.fullName.trim();
  const email = input.email.trim().toLowerCase();
  const phone = input.phone.trim();
  const preferredLanguage = input.preferredLanguage.trim() || "English";
  const courseInterest = input.courseInterest.trim();
  const ageGroup = input.ageGroup.trim();
  const currentLevel = (
    input.placementResult ??
    input.currentLevel ??
    ""
  ).trim();
  const studentStatus = normalizeStudentStatus(input.status);

  if (!name || !email || !phone)
    throw new Error("Full name, email, and phone are required.");
  if (!email.includes("@")) throw new Error("Enter a valid email address.");
  assertStudentIntakeLineage(state, {
    source: input.source,
    email,
    branchId: input.branchId,
    leadId: input.leadId,
    applicationId: input.applicationId,
    placementTestId: input.placementTestId,
  });
  if (state.users.some(user => user.email.toLowerCase() === email)) {
    throw new Error("This email is already in the identity directory.");
  }
  if (!courseInterest)
    throw new Error("Subject or course interest is required.");
  if (!ageGroup) throw new Error("Age group is required.");
  if (
    isMinorAgeGroup(ageGroup) &&
    (!input.guardianName?.trim() || !input.guardianPhone?.trim())
  ) {
    throw new Error("Guardian name and phone are required for minor students.");
  }
  if (!currentLevel)
    throw new Error("Current level or placement result is required.");

  const target = resolveCourseTarget(state, {
    courseInterest,
    recommendedLevel: input.placementResult,
    currentLevel,
  });
  const { branch, courseRun, classGroup } = resolveEnrollmentAssignment(state, {
    branchId: input.branchId,
    courseRunId: input.courseRunId,
    classGroupId: input.classGroupId,
    targetCourseId: target.course.id,
  });
  const program = state.programs.find(
    item => item.id === target.course.programId
  );
  const packageRow = state.packages.find(
    item => item.courseId === courseRun.courseId && item.status === "active"
  );
  const userId = ctx.createId("usr_student");
  const studentId = ctx.createId("stu");
  const enrollmentId = ctx.createId("enr");
  const source = input.source ?? "direct";
  const user = {
    id: userId,
    name,
    email,
    phone,
    notes: input.notes?.trim() || undefined,
    roles: ["student"],
    activeRole: "student",
    branchId: branch.id,
    departmentId: program?.departmentId ?? "dep_arabic",
    status: accountStatusFromStudentStatus(studentStatus),
  } satisfies PlatformState["users"][number];
  const student = {
    id: studentId,
    userId,
    status: studentStatus,
    source,
    guardianName: input.guardianName?.trim() || undefined,
    guardianPhone: input.guardianPhone?.trim() || undefined,
    currentLevel,
    ageGroup,
    courseInterest,
    notes: input.notes?.trim() || undefined,
    country: "Egypt",
    preferredLanguage,
    timezone: branch.timezone,
  } satisfies PlatformState["students"][number];
  const enrollment = {
    id: enrollmentId,
    studentId,
    courseRunId: courseRun.id,
    levelId: target.course.levelId,
    classGroupId: classGroup.id,
    teacherId: courseRun.teacherId,
    source,
    status: studentStatus,
    progress: 0,
    attendanceRate: 0,
    currentGrade: 0,
    createdAt: ctx.now(),
  } satisfies PlatformState["enrollments"][number];
  const lessonIds = state.modules
    .filter(module => module.courseId === courseRun.courseId)
    .flatMap(module =>
      state.lessons
        .filter(lesson => lesson.moduleId === module.id)
        .map(lesson => lesson.id)
    );
  const invoice = packageRow
    ? {
        id: ctx.createId("inv"),
        studentId,
        enrollmentId,
        amount: packageRow.amount,
        currency: packageRow.currency,
        dueAt: ctx.now().slice(0, 10),
        status: "pending" as const,
      }
    : undefined;

  state.users = [user, ...state.users];
  state.students = [student, ...state.students];
  state.enrollments = [enrollment, ...state.enrollments];
  state.classGroups = state.classGroups.map(group =>
    group.id === classGroup.id
      ? { ...group, studentIds: [...group.studentIds, studentId] }
      : group
  );
  state.lessonProgress = [
    ...lessonIds.map(lessonId => ({
      id: ctx.createId("lp"),
      studentId,
      enrollmentId,
      lessonId,
      status: "not_started" as const,
    })),
    ...state.lessonProgress,
  ];
  if (invoice) state.invoices = [invoice, ...state.invoices];

  return {
    user,
    student,
    enrollment,
    classGroup,
    courseRun,
    course: target.course,
    level: target.level,
    invoice,
  };
}

function validateUserScopeUpdate(
  state: PlatformState,
  input: UpdateUserActionInput,
  currentUser: PlatformState["users"][number]
) {
  const nextBranchId = input.branchId ?? currentUser.branchId;
  const nextDepartmentId = input.departmentId ?? currentUser.departmentId;
  const branch = state.branches.find(item => item.id === nextBranchId);
  if (!branch) {
    throw new Error("Choose a valid branch for this account.");
  }
  const department = state.departments.find(
    item => item.id === nextDepartmentId
  );
  if (!department) {
    throw new Error("Choose a valid department for this account.");
  }
  if (!department.branchIds.includes(branch.id) && branch.id !== "br_global") {
    throw new Error(
      "Selected department is not available in the chosen branch."
    );
  }
  return { branch, department };
}

function applyUpdateProfile(
  state: PlatformState,
  input: UpdateProfileActionInput,
  ctx: MutationContext
) {
  const userId = input.userId ?? input.actorId;
  const user = state.users.find(item => item.id === userId);
  if (!user) throw new Error("Profile account was not found.");

  const profileChanges: string[] = [];
  const preferenceChanges: string[] = [];
  let nextUser = { ...user };

  if (input.name !== undefined) {
    const name = cleanProfileText(input.name);
    if (!name || name.length < 2) throw new Error("Full name is required.");
    if (name !== user.name) {
      nextUser = { ...nextUser, name };
      profileChanges.push("name");
    }
  }
  if (input.phone !== undefined) {
    const phone = cleanProfileText(input.phone, 40);
    if (phone !== (user.phone ?? "")) {
      nextUser = { ...nextUser, phone: phone || undefined };
      profileChanges.push("phone");
    }
  }
  if (input.preferredLanguage !== undefined) {
    const preferredLanguage = cleanProfileText(input.preferredLanguage, 40);
    if (!preferredLanguage) throw new Error("Preferred language is required.");
    if (preferredLanguage !== user.preferredLanguage) {
      nextUser = { ...nextUser, preferredLanguage };
      preferenceChanges.push("language");
    }
  }
  if (input.timezone !== undefined) {
    const timezone = cleanProfileText(input.timezone, 80);
    if (!timezone) throw new Error("Timezone is required.");
    if (timezone !== user.timezone) {
      nextUser = { ...nextUser, timezone };
      preferenceChanges.push("timezone");
    }
  }
  const notificationPreferences = normalizeNotificationPreferences(
    input.notificationPreferences,
    user.notificationPreferences
  );
  if (
    notificationPreferences &&
    JSON.stringify(notificationPreferences) !==
      JSON.stringify(user.notificationPreferences)
  ) {
    nextUser = { ...nextUser, notificationPreferences };
    preferenceChanges.push("notifications");
  }

  const student = state.students.find(item => item.userId === user.id);
  let updatedStudent = student;
  if (student) {
    let nextStudent = { ...student };
    if (input.country !== undefined) {
      const country = cleanProfileText(input.country, 80);
      if (!country) throw new Error("Country is required.");
      if (country !== student.country) {
        nextStudent = { ...nextStudent, country };
        profileChanges.push("country");
      }
    }
    if (input.preferredLanguage !== undefined) {
      nextStudent = {
        ...nextStudent,
        preferredLanguage:
          nextUser.preferredLanguage ?? student.preferredLanguage,
      };
    }
    if (input.timezone !== undefined) {
      nextStudent = {
        ...nextStudent,
        timezone: nextUser.timezone ?? student.timezone,
      };
    }
    if (input.guardianName !== undefined) {
      const guardianName = cleanProfileText(input.guardianName, 120);
      if (guardianName !== (student.guardianName ?? "")) {
        nextStudent = {
          ...nextStudent,
          guardianName: guardianName || undefined,
        };
        profileChanges.push("guardian name");
      }
    }
    if (input.guardianPhone !== undefined) {
      const guardianPhone = cleanProfileText(input.guardianPhone, 40);
      if (guardianPhone !== (student.guardianPhone ?? "")) {
        nextStudent = {
          ...nextStudent,
          guardianPhone: guardianPhone || undefined,
        };
        profileChanges.push("guardian phone");
      }
    }
    if (
      isMinorAgeGroup(nextStudent.ageGroup ?? "") &&
      (!nextStudent.guardianName || !nextStudent.guardianPhone)
    ) {
      throw new Error(
        "Guardian name and phone are required for minor students."
      );
    }
    updatedStudent = nextStudent;
  }

  const staffProfile =
    state.staffProfiles.find(
      item => item.userId === user.id && item.role === user.activeRole
    ) ?? state.staffProfiles.find(item => item.userId === user.id);
  let updatedStaffProfile = staffProfile;
  if (staffProfile) {
    let nextStaffProfile = { ...staffProfile };
    if (input.title !== undefined) {
      const title = cleanProfileText(input.title, 80);
      if (!title) throw new Error("Profile title is required.");
      if (title !== staffProfile.title) {
        nextStaffProfile = { ...nextStaffProfile, title, updatedAt: ctx.now() };
        profileChanges.push("title");
      }
    }
    if (input.availabilityStatus !== undefined) {
      if (staffProfile.role !== "teacher")
        throw new Error(
          "Availability can only be changed for teacher profiles."
        );
      if (!staffAvailabilityStatuses.has(input.availabilityStatus))
        throw new Error("Choose a valid availability status.");
      if (input.availabilityStatus !== staffProfile.availabilityStatus) {
        nextStaffProfile = {
          ...nextStaffProfile,
          availabilityStatus: input.availabilityStatus,
          updatedAt: ctx.now(),
        };
        profileChanges.push("availability");
      }
    }
    updatedStaffProfile = nextStaffProfile;
  }

  const teacherProfile = state.teachers.find(item => item.userId === user.id);
  let updatedTeacherProfile = teacherProfile;
  if (teacherProfile && input.availabilityStatus !== undefined) {
    if (!staffAvailabilityStatuses.has(input.availabilityStatus))
      throw new Error("Choose a valid availability status.");
    updatedTeacherProfile = {
      ...teacherProfile,
      availabilityStatus: input.availabilityStatus,
    };
  }

  const actorId = input.actorId ?? user.id;
  state.users = state.users.map(item =>
    item.id === user.id ? nextUser : item
  );
  if (student && updatedStudent) {
    state.students = state.students.map(item =>
      item.id === student.id ? updatedStudent : item
    );
  }
  if (staffProfile && updatedStaffProfile) {
    state.staffProfiles = state.staffProfiles.map(item =>
      item.id === staffProfile.id ? updatedStaffProfile : item
    );
  }
  if (teacherProfile && updatedTeacherProfile) {
    state.teachers = state.teachers.map(item =>
      item.id === teacherProfile.id ? updatedTeacherProfile : item
    );
  }

  if (profileChanges.length) {
    appendAudit(
      state,
      ctx,
      "profile.updated",
      student ? "StudentProfile" : staffProfile ? "StaffProfile" : "User",
      student?.id ?? staffProfile?.id ?? user.id,
      `Updated profile fields: ${Array.from(new Set(profileChanges)).join(", ")}.`,
      actorId
    );
  }
  if (preferenceChanges.length) {
    appendAudit(
      state,
      ctx,
      "preferences.updated",
      "User",
      user.id,
      `Updated preferences: ${Array.from(new Set(preferenceChanges)).join(", ")}.`,
      actorId
    );
  }

  return {
    user: nextUser,
    student: updatedStudent,
    staffProfile: updatedStaffProfile,
    teacherProfile: updatedTeacherProfile,
    changed: Array.from(new Set([...profileChanges, ...preferenceChanges])),
  };
}

function applyUpdateUserAccount(
  state: PlatformState,
  input: UpdateUserActionInput,
  ctx: MutationContext
) {
  const user = state.users.find(item => item.id === input.userId);
  if (!user) throw new Error(`User ${input.userId} was not found.`);

  const { branch, department } = validateUserScopeUpdate(state, input, user);
  const status = validateAccountStatus(input.status, user.status);
  const requestedRoles = input.roles ?? user.roles;
  const roles = Array.from(
    new Set(
      requestedRoles.filter((role): role is Role => roleOrder.includes(role))
    )
  );
  if (!roles.length) throw new Error("Account must keep at least one role.");
  const activeRole = input.activeRole ?? user.activeRole;
  if (!roleOrder.includes(activeRole) || !roles.includes(activeRole)) {
    throw new Error("Active role must be one of the assigned roles.");
  }

  const changes: string[] = [];
  if (status !== user.status)
    changes.push(`status ${user.status} to ${status}`);
  if (activeRole !== user.activeRole)
    changes.push(`active role ${user.activeRole} to ${activeRole}`);
  if (branch.id !== user.branchId)
    changes.push(`branch ${user.branchId ?? "none"} to ${branch.id}`);
  if (department.id !== user.departmentId)
    changes.push(
      `department ${user.departmentId ?? "none"} to ${department.id}`
    );
  if (roles.join("|") !== user.roles.join("|"))
    changes.push(`roles to ${roles.join(", ")}`);

  const updatedUser = {
    ...user,
    activeRole,
    roles,
    branchId: branch.id,
    departmentId: department.id,
    status,
  };
  state.users = state.users.map(item =>
    item.id === user.id ? updatedUser : item
  );

  const student = state.students.find(item => item.userId === user.id);
  if (student && input.status) {
    const studentStatus = studentStatusFromAccountStatus(status);
    state.students = state.students.map(item =>
      item.id === student.id ? { ...item, status: studentStatus } : item
    );
    state.enrollments = state.enrollments.map(enrollment =>
      enrollment.studentId === student.id
        ? { ...enrollment, status: studentStatus }
        : enrollment
    );
  }

  const teacherProfile = state.teachers.find(item => item.userId === user.id);
  if (teacherProfile && input.departmentId) {
    state.teachers = state.teachers.map(item =>
      item.userId === user.id ? { ...item, departmentId: department.id } : item
    );
  }
  if (input.status || input.branchId || input.departmentId) {
    state.staffProfiles = (state.staffProfiles ?? []).map(item =>
      item.userId === user.id
        ? {
            ...item,
            branchIds: input.branchId ? [branch.id] : item.branchIds,
            departmentIds: input.departmentId
              ? [department.id]
              : item.departmentIds,
            status,
            updatedAt: ctx.now(),
          }
        : item
    );
  }

  const summary = changes.length
    ? `Updated ${user.name}: ${changes.join("; ")}.`
    : `Reviewed ${user.name}; no access changes were needed.`;
  appendAudit(
    state,
    ctx,
    "user.updated",
    "User",
    user.id,
    summary,
    input.actorId ?? "usr_admin_demo"
  );

  return {
    user: updatedUser,
    branch,
    department,
    roles,
    changed: changes,
  };
}

const allKnownPermissions = new Set<Permission>(
  Object.values(rolePermissions).flatMap(permissions => permissions)
);
const integrationStatuses = new Set<IntegrationStatus>([
  "not_configured",
  "mock_mode",
  "connected",
  "error",
]);

function validateGovernanceRole(role: Role) {
  if (!roleOrder.includes(role))
    throw new Error("Choose a valid account role.");
}

function validatePermission(permission: Permission) {
  if (!allKnownPermissions.has(permission))
    throw new Error("Choose a valid permission.");
}

function applyUpdatePermission(
  state: PlatformState,
  input: UpdatePermissionActionInput,
  ctx: MutationContext
) {
  validateGovernanceRole(input.role);
  validatePermission(input.permission);
  if (
    input.role === "superadmin" &&
    input.permission === "settings:write" &&
    !input.granted
  ) {
    throw new Error(
      "Super Admin settings authority cannot be removed from the global role."
    );
  }
  const current = state.permissions[input.role] ?? [];
  const hasPermission = current.includes(input.permission);
  const nextPermissions = input.granted
    ? hasPermission
      ? current
      : [...current, input.permission]
    : current.filter(permission => permission !== input.permission);
  state.permissions = {
    ...state.permissions,
    [input.role]: nextPermissions,
  };
  const summary = `${input.role}: ${input.permission} ${input.granted ? "granted" : "removed"}.`;
  appendAudit(
    state,
    ctx,
    "permission.updated",
    "Role",
    input.role,
    summary,
    input.actorId ?? "usr_admin_demo"
  );
  return {
    role: input.role,
    permission: input.permission,
    granted: nextPermissions.includes(input.permission),
    permissions: nextPermissions,
  };
}

function applyUpdateBranch(
  state: PlatformState,
  input: UpdateBranchActionInput,
  ctx: MutationContext
) {
  const branch = state.branches.find(item => item.id === input.branchId);
  if (!branch) throw new Error(`Branch ${input.branchId} was not found.`);
  const status = validateAccountStatus(input.status, branch.status);
  state.branches = state.branches.map(item =>
    item.id === branch.id ? { ...item, status } : item
  );
  appendAudit(
    state,
    ctx,
    "branch.updated",
    "Branch",
    branch.id,
    `Set ${branch.name} status from ${branch.status} to ${status}.`,
    input.actorId ?? "usr_admin_demo"
  );
  return {
    branch: state.branches.find(item => item.id === branch.id)!,
    previousStatus: branch.status,
  };
}

function applyUpdateRoomStatus(
  state: PlatformState,
  input: UpdateRoomStatusActionInput,
  ctx: MutationContext
) {
  const room = state.rooms.find(item => item.id === input.roomId);
  if (!room) throw new Error(`Room ${input.roomId} was not found.`);
  const status = validateAccountStatus(input.status, room.status);
  state.rooms = state.rooms.map(item =>
    item.id === room.id ? { ...item, status } : item
  );
  appendAudit(
    state,
    ctx,
    "room.status_updated",
    "Room",
    room.id,
    `Set ${room.name} status from ${room.status} to ${status}.`,
    input.actorId ?? "usr_branch_demo"
  );
  return {
    room: state.rooms.find(item => item.id === room.id)!,
    previousStatus: room.status,
  };
}

function applyCreateRoom(
  state: PlatformState,
  input: CreateRoomActionInput,
  ctx: MutationContext
) {
  const branch = state.branches.find(item => item.id === input.branchId);
  const name = input.name.trim();
  const equipment = (input.equipment ?? [])
    .map(item => item.trim())
    .filter(Boolean);
  const capacity = Math.floor(input.capacity);
  if (!branch) throw new Error(`Branch ${input.branchId} was not found.`);
  if (!name) throw new Error("Room name is required.");
  if (!Number.isFinite(capacity) || capacity < 1 || capacity > 200) {
    throw new Error("Room capacity must be between 1 and 200.");
  }
  if (
    state.rooms.some(
      item =>
        item.branchId === branch.id &&
        item.name.trim().toLowerCase() === name.toLowerCase()
    )
  ) {
    throw new Error(`${name} already exists in ${branch.name}.`);
  }
  const room: Room = {
    id: ctx.createId("room"),
    branchId: branch.id,
    name,
    capacity,
    equipment,
    status: "active",
  };
  state.rooms = [room, ...state.rooms];
  appendAudit(
    state,
    ctx,
    "room.created",
    "Room",
    room.id,
    `Added ${room.name} to ${branch.name} with ${room.capacity} seats.`,
    input.actorId ?? "usr_branch_demo"
  );
  return { room, branch };
}

function applyCreateClassGroup(
  state: PlatformState,
  input: CreateClassGroupActionInput,
  ctx: MutationContext
) {
  const courseRun = state.courseRuns.find(
    item => item.id === input.courseRunId
  );
  if (!courseRun)
    throw new Error(`Course run ${input.courseRunId} was not found.`);
  assertCourseRunReadyForDelivery(state, courseRun, "Class creation");
  const name = input.name.trim();
  const schedule = input.schedule.trim();
  const capacity = Math.floor(input.capacity);
  if (!name) throw new Error("Class name is required.");
  if (!schedule) throw new Error("Class schedule is required.");
  if (!Number.isFinite(capacity) || capacity < 1 || capacity > 200) {
    throw new Error("Class capacity must be between 1 and 200.");
  }
  const room = state.rooms.find(item => item.id === input.roomId);
  if (!room || room.status !== "active") {
    throw new Error("Choose an active room for this class.");
  }
  if (room.branchId !== courseRun.branchId) {
    throw new Error("Class room must belong to the course run branch.");
  }
  if (capacity > room.capacity) {
    throw new Error("Class capacity cannot exceed room capacity.");
  }
  if (
    state.classGroups.some(
      item =>
        item.courseRunId === courseRun.id &&
        item.name.trim().toLowerCase() === name.toLowerCase()
    )
  ) {
    throw new Error(`${name} already exists in this course run.`);
  }
  const conflictingClass = state.classGroups.find(item => {
    if (
      item.roomId !== room.id ||
      item.schedule.trim().toLowerCase() !== schedule.toLowerCase()
    ) {
      return false;
    }
    const existingRun = state.courseRuns.find(
      run => run.id === item.courseRunId
    );
    return (
      existingRun?.status === "active" &&
      existingRun.startsOn <= courseRun.endsOn &&
      existingRun.endsOn >= courseRun.startsOn
    );
  });
  if (conflictingClass) {
    throw new Error(`${room.name} is already assigned at ${schedule}.`);
  }

  const classGroup: ClassGroup = {
    id: ctx.createId("class"),
    courseRunId: courseRun.id,
    name,
    capacity,
    schedule,
    roomId: room.id,
    studentIds: [],
    status: "active",
  };
  state.classGroups = [classGroup, ...state.classGroups];
  state.teachers = state.teachers.map(profile =>
    profile.userId === courseRun.teacherId
      ? {
          ...profile,
          assignedClassIds: Array.from(
            new Set([...profile.assignedClassIds, classGroup.id])
          ),
        }
      : profile
  );
  appendAudit(
    state,
    ctx,
    "class.created",
    "ClassGroup",
    classGroup.id,
    `Created ${classGroup.name} in ${room.name} for ${courseRun.term}.`,
    input.actorId ?? "usr_registrar_demo"
  );
  return { classGroup, courseRun, room };
}

function applyCreateCourseRun(
  state: PlatformState,
  input: CreateCourseRunActionInput,
  ctx: MutationContext
) {
  const course = state.courses.find(item => item.id === input.courseId);
  const branch = state.branches.find(item => item.id === input.branchId);
  const teacher = state.users.find(item => item.id === input.teacherId);
  const teacherProfile = state.teachers.find(
    item => item.userId === input.teacherId
  );
  const staffProfile = state.staffProfiles.find(
    item => item.userId === input.teacherId && item.role === "teacher"
  );
  const term = input.term.trim();
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  if (!course || course.status !== "active")
    throw new Error("Choose an active course.");
  if (!branch || branch.status !== "active")
    throw new Error("Choose an active branch.");
  if (!term) throw new Error("Course run term is required.");
  if (
    !datePattern.test(input.startsOn) ||
    !datePattern.test(input.endsOn) ||
    input.startsOn > input.endsOn
  ) {
    throw new Error(
      "Course run dates must be valid and the end date must follow the start date."
    );
  }
  if (
    !teacher ||
    teacher.status !== "active" ||
    !teacher.roles.includes("teacher") ||
    !teacherProfile ||
    teacherProfile.status !== "active" ||
    !staffProfile ||
    staffProfile.status !== "active" ||
    (!staffProfile.branchIds.includes(branch.id) &&
      !staffProfile.branchIds.includes("br_global"))
  ) {
    throw new Error(
      "Choose an active teacher scoped to the course run branch."
    );
  }
  if (
    state.courseRuns.some(
      run =>
        run.courseId === course.id &&
        run.branchId === branch.id &&
        run.term.trim().toLowerCase() === term.toLowerCase()
    )
  ) {
    throw new Error(`${term} already exists for this course and branch.`);
  }
  const courseRun: PlatformState["courseRuns"][number] = {
    id: ctx.createId("run"),
    courseId: course.id,
    branchId: branch.id,
    teacherId: teacher.id,
    term,
    startsOn: input.startsOn,
    endsOn: input.endsOn,
    status: input.status ?? "pending",
  };
  state.courseRuns = [courseRun, ...state.courseRuns];
  appendAudit(
    state,
    ctx,
    "course_run.created",
    "CourseRun",
    courseRun.id,
    `Created ${term} for ${course.title} at ${branch.name}.`,
    input.actorId ?? "usr_hod_demo"
  );
  return { courseRun, course, branch, teacher };
}

function applyUpdateClassGroup(
  state: PlatformState,
  input: UpdateClassGroupActionInput,
  ctx: MutationContext
) {
  const current = state.classGroups.find(
    item => item.id === input.classGroupId
  );
  if (!current)
    throw new Error(`Class group ${input.classGroupId} was not found.`);
  if (current.status === "completed" || current.status === "cancelled") {
    throw new Error("Completed or cancelled classes cannot be edited.");
  }
  const run = state.courseRuns.find(item => item.id === current.courseRunId);
  if (!run) throw new Error(`Course run ${current.courseRunId} was not found.`);
  assertCourseRunReadyForDelivery(state, run, "Class update");
  const name = input.name.trim();
  const schedule = input.schedule.trim();
  const capacity = Math.floor(input.capacity);
  const room = state.rooms.find(item => item.id === input.roomId);
  if (!name) throw new Error("Class name is required.");
  if (!schedule) throw new Error("Class schedule is required.");
  if (
    !Number.isFinite(capacity) ||
    capacity < current.studentIds.length ||
    capacity > 200
  ) {
    throw new Error(
      `Class capacity must be between ${current.studentIds.length} and 200.`
    );
  }
  if (!room || room.status !== "active")
    throw new Error("Choose an active room for this class.");
  if (room.branchId !== run.branchId)
    throw new Error("Class room must belong to the course run branch.");
  if (capacity > room.capacity)
    throw new Error("Class capacity cannot exceed room capacity.");
  if (
    state.classGroups.some(
      item =>
        item.id !== current.id &&
        item.courseRunId === run.id &&
        item.name.trim().toLowerCase() === name.toLowerCase()
    )
  ) {
    throw new Error(`${name} already exists in this course run.`);
  }
  const conflict = state.classGroups.find(item => {
    if (
      item.id === current.id ||
      item.status === "cancelled" ||
      item.roomId !== room.id ||
      item.schedule.trim().toLowerCase() !== schedule.toLowerCase()
    )
      return false;
    const otherRun = state.courseRuns.find(
      candidate => candidate.id === item.courseRunId
    );
    return Boolean(
      otherRun?.status === "active" &&
        otherRun.startsOn <= run.endsOn &&
        otherRun.endsOn >= run.startsOn
    );
  });
  if (conflict)
    throw new Error(`${room.name} is already assigned at ${schedule}.`);
  const updated = { ...current, name, capacity, schedule, roomId: room.id };
  state.classGroups = state.classGroups.map(item =>
    item.id === current.id ? updated : item
  );
  appendAudit(
    state,
    ctx,
    "class.updated",
    "ClassGroup",
    current.id,
    `Updated ${updated.name}, ${updated.schedule}, ${updated.capacity} seats.`,
    input.actorId ?? "usr_branch_demo"
  );
  return { classGroup: updated, previous: current, courseRun: run, room };
}

function applyUpdateClassGroupStatus(
  state: PlatformState,
  input: UpdateClassGroupStatusActionInput,
  ctx: MutationContext
) {
  const current = state.classGroups.find(
    item => item.id === input.classGroupId
  );
  if (!current)
    throw new Error(`Class group ${input.classGroupId} was not found.`);
  const allowed = new Set<ClassGroup["status"]>([
    "active",
    "paused",
    "completed",
    "cancelled",
  ]);
  if (!allowed.has(input.status))
    throw new Error("Choose a valid class status.");
  const run = state.courseRuns.find(item => item.id === current.courseRunId);
  if (!run) throw new Error(`Course run ${current.courseRunId} was not found.`);
  if (input.status === "active")
    assertCourseRunReadyForDelivery(state, run, "Class activation");
  if (
    input.status === "cancelled" &&
    state.enrollments.some(
      item => item.classGroupId === current.id && item.status === "active"
    )
  ) {
    throw new Error("A class with active enrollments cannot be cancelled.");
  }
  if (
    input.status === "completed" &&
    state.classSessions.some(
      item => item.classGroupId === current.id && item.status !== "completed"
    )
  ) {
    throw new Error("Complete all class sessions before completing the class.");
  }
  const updated = { ...current, status: input.status };
  state.classGroups = state.classGroups.map(item =>
    item.id === current.id ? updated : item
  );
  appendAudit(
    state,
    ctx,
    "class.status_updated",
    "ClassGroup",
    current.id,
    `Set ${current.name} from ${current.status} to ${input.status}.`,
    input.actorId ?? "usr_branch_demo"
  );
  return {
    classGroup: updated,
    previousStatus: current.status,
    courseRun: run,
  };
}

function getIntegration(
  state: PlatformState,
  integrationId: IntegrationConfig["id"]
) {
  const integration = state.integrations.find(
    item => item.id === integrationId
  );
  if (!integration)
    throw new Error(`Integration ${integrationId} was not found.`);
  return integration;
}

function validateIntegrationStatus(status: IntegrationStatus) {
  if (!integrationStatuses.has(status))
    throw new Error("Choose a valid integration status.");
}

function applyUpdateIntegrationStatus(
  state: PlatformState,
  input: UpdateIntegrationStatusActionInput,
  ctx: MutationContext
) {
  const integration = getIntegration(state, input.integrationId);
  validateIntegrationStatus(input.status);
  const lastSyncAt =
    input.status === "connected" || input.status === "mock_mode"
      ? ctx.now()
      : integration.lastSyncAt;
  state.integrations = state.integrations.map(item =>
    item.id === integration.id
      ? { ...item, status: input.status, lastSyncAt }
      : item
  );
  appendAudit(
    state,
    ctx,
    "integration.status_updated",
    "IntegrationConfig",
    integration.id,
    `${integration.label} set from ${integration.status.replace("_", " ")} to ${input.status.replace("_", " ")}.`,
    input.actorId ?? "usr_admin_demo"
  );
  return {
    integration: state.integrations.find(item => item.id === integration.id)!,
    previousStatus: integration.status,
  };
}

function applyCheckIntegration(
  state: PlatformState,
  input: CheckIntegrationActionInput,
  ctx: MutationContext
) {
  const integration = getIntegration(state, input.integrationId);
  appendAudit(
    state,
    ctx,
    "integration.local_checked",
    "IntegrationConfig",
    integration.id,
    `${integration.label} checked locally.`,
    input.actorId ?? "usr_admin_demo"
  );
  return {
    integration,
    checkedAt: ctx.now(),
  };
}

function applyCheckSystemHealth(
  state: PlatformState,
  input: CheckSystemHealthActionInput,
  ctx: MutationContext
) {
  const score = Math.max(0, Math.min(100, Math.round(input.score)));
  appendAudit(
    state,
    ctx,
    "system.health_checked",
    "PlatformSystem",
    "health",
    `System health check scored ${score}%.`,
    input.actorId ?? "usr_admin_demo"
  );
  return {
    score,
    checkedAt: ctx.now(),
  };
}

function applySavePlatformSettings(
  state: PlatformState,
  input: SavePlatformSettingsActionInput,
  ctx: MutationContext
) {
  const organization = input.organization.trim();
  const defaultLanguage = input.defaultLanguage.trim();
  const academicTerm = input.academicTerm.trim();
  const retentionDays = Math.round(Number(input.retentionDays));

  if (!organization) throw new Error("Organization is required.");
  if (!defaultLanguage) throw new Error("Default language is required.");
  if (!academicTerm) throw new Error("Academic term is required.");
  if (
    !Number.isFinite(retentionDays) ||
    retentionDays < 30 ||
    retentionDays > 3650
  ) {
    throw new Error("Audit retention days must be between 30 and 3650.");
  }

  const savedAt = ctx.now();
  const settings = {
    organization,
    defaultLanguage,
    academicTerm,
    retentionDays,
    updatedAt: savedAt,
    updatedBy: input.actorId ?? "usr_admin_demo",
  };
  state.settings = settings;

  appendAudit(
    state,
    ctx,
    "settings.saved",
    "PlatformSettings",
    "global",
    `${organization} · ${defaultLanguage} · ${academicTerm} · ${retentionDays} day retention.`,
    input.actorId ?? "usr_admin_demo"
  );

  return {
    settings,
    savedAt,
  };
}

function applySavePortalSettings(
  state: PlatformState,
  input: SavePortalSettingsActionInput,
  ctx: MutationContext
) {
  if (!["registrar", "headofdepartment", "branchadmin"].includes(input.role)) {
    throw new Error("Choose a valid portal settings role.");
  }
  const scopeId = input.scopeId.trim();
  const label = input.label.trim();
  const language = input.language.trim();
  const timezone = input.timezone.trim();
  const reviewCadenceDays =
    input.reviewCadenceDays === undefined
      ? undefined
      : Math.round(Number(input.reviewCadenceDays));
  const paymentReminderDays =
    input.paymentReminderDays === undefined
      ? undefined
      : Math.round(Number(input.paymentReminderDays));
  const attendanceCutoffMinutes =
    input.attendanceCutoffMinutes === undefined
      ? undefined
      : Math.round(Number(input.attendanceCutoffMinutes));

  if (!scopeId) throw new Error("Scope is required.");
  if (!label) throw new Error("Workspace label is required.");
  if (!language) throw new Error("Language is required.");
  if (!timezone) throw new Error("Timezone is required.");
  if (
    reviewCadenceDays !== undefined &&
    (!Number.isFinite(reviewCadenceDays) ||
      reviewCadenceDays < 1 ||
      reviewCadenceDays > 90)
  ) {
    throw new Error("Review cadence must be between 1 and 90 days.");
  }
  if (
    paymentReminderDays !== undefined &&
    (!Number.isFinite(paymentReminderDays) ||
      paymentReminderDays < 1 ||
      paymentReminderDays > 30)
  ) {
    throw new Error("Payment reminders must be between 1 and 30 days.");
  }
  if (
    attendanceCutoffMinutes !== undefined &&
    (!Number.isFinite(attendanceCutoffMinutes) ||
      attendanceCutoffMinutes < 0 ||
      attendanceCutoffMinutes > 120)
  ) {
    throw new Error("Attendance cutoff must be between 0 and 120 minutes.");
  }

  const savedAt = ctx.now();
  const settings: ScopedPortalSettings = {
    role: input.role,
    scopeId,
    label,
    language,
    timezone,
    notifications: Boolean(input.notifications),
    reviewCadenceDays,
    paymentReminderDays,
    attendanceCutoffMinutes,
    updatedAt: savedAt,
    updatedBy: input.actorId ?? "usr_admin_demo",
  };
  state.portalSettings = [
    settings,
    ...state.portalSettings.filter(
      item => item.role !== settings.role || item.scopeId !== settings.scopeId
    ),
  ];

  appendAudit(
    state,
    ctx,
    "portal_settings.saved",
    "PortalSettings",
    `${settings.role}:${settings.scopeId}`,
    `Saved ${settings.label} settings.`,
    input.actorId ?? "usr_admin_demo"
  );

  return {
    settings,
    savedAt,
  };
}

function applyCreateUserAccount(
  state: PlatformState,
  input: CreateUserActionInput,
  ctx: MutationContext
) {
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  const phone = input.phone.trim();
  if (!name || !email || !phone)
    throw new Error("Name, email, and phone are required.");
  if (state.users.some(user => user.email.toLowerCase() === email)) {
    throw new Error("This email is already in the identity directory.");
  }

  const { status, branch, department } = validateAccountScope(state, input);
  if (input.role === "student") {
    if (!input.courseRunId || !input.classGroupId) {
      throw new Error("Student accounts require a course run and class group.");
    }
    const courseRun = state.courseRuns.find(
      run => run.id === input.courseRunId
    );
    const classGroup = state.classGroups.find(
      group => group.id === input.classGroupId
    );
    if (!courseRun || !classGroup || classGroup.courseRunId !== courseRun.id) {
      throw new Error(
        "Selected class group must belong to the selected course run."
      );
    }
    if (courseRun.branchId !== branch.id) {
      throw new Error(
        "Student branch must match the selected course and class branch."
      );
    }
    assertCourseRunReadyForDelivery(state, courseRun, "Student enrollment");
    if (classGroup.studentIds.length >= classGroup.capacity) {
      throw new Error("Selected class is already at capacity.");
    }
  }
  if (input.role === "teacher") {
    const specialties = Array.from(
      new Set(
        [...(input.subjects ?? []), ...(input.specialization ?? [])]
          .map(item => item.trim())
          .filter(Boolean)
      )
    );
    if (!specialties.length)
      throw new Error(
        "Teacher accounts require at least one subject or specialization."
      );
    const courseRun = state.courseRuns.find(
      run => run.id === input.courseRunId
    );
    if (!input.courseRunId || !courseRun) {
      throw new Error("Teacher accounts require a course run assignment.");
    }
    if (courseRun.branchId !== branch.id) {
      throw new Error(
        "Teacher branch must match the selected course run branch."
      );
    }
    if (courseRun.teacherId) {
      throw new Error(
        "Selected course run already has a teacher. Use teacher reassignment instead."
      );
    }
    const course = state.courses.find(item => item.id === courseRun.courseId);
    const program = state.programs.find(item => item.id === course?.programId);
    if (program && program.departmentId !== department.id) {
      throw new Error("Teacher department must own the selected course run.");
    }
  }

  const userId = ctx.createId(`usr_${input.role}`);
  const user = {
    id: userId,
    name,
    email,
    phone,
    notes: input.notes?.trim() || undefined,
    roles: [input.role],
    activeRole: input.role,
    branchId: input.branchId,
    departmentId: input.departmentId,
    status,
  } satisfies PlatformState["users"][number];
  state.users = [user, ...state.users];

  let relationshipSummary = `${input.role} account created with ${branch?.name ?? "selected branch"} scope.`;
  let student: PlatformState["students"][number] | undefined;
  let enrollment: PlatformState["enrollments"][number] | undefined;
  let teacherProfile: PlatformState["teachers"][number] | undefined;
  let teacherAssignment:
    | ReturnType<typeof applyAssignTeacherToCourseRun>
    | undefined;

  if (input.role === "student") {
    const courseRun = state.courseRuns.find(
      run => run.id === input.courseRunId
    )!;
    const classGroup = state.classGroups.find(
      group => group.id === input.classGroupId
    )!;
    const course = state.courses.find(item => item.id === courseRun.courseId);
    const lessonIds = state.modules
      .filter(module => module.courseId === courseRun.courseId)
      .flatMap(module =>
        state.lessons
          .filter(lesson => lesson.moduleId === module.id)
          .map(lesson => lesson.id)
      );
    const studentId = ctx.createId("stu");
    const studentEnrollmentId = ctx.createId("enr");
    const studentStatus = studentStatusFromAccountStatus(status);
    student = {
      id: studentId,
      userId,
      status: studentStatus,
      guardianName: input.guardianName?.trim() || undefined,
      guardianPhone: input.guardianPhone?.trim() || undefined,
      currentLevel: input.currentLevel?.trim() || undefined,
      ageGroup: input.ageGroup?.trim() || undefined,
      notes: input.notes?.trim() || undefined,
      country: "Egypt",
      preferredLanguage: input.preferredLanguage ?? "English",
      timezone: branch?.timezone ?? "Africa/Cairo",
    };
    enrollment = {
      id: studentEnrollmentId,
      studentId,
      courseRunId: courseRun.id,
      levelId: course?.levelId,
      classGroupId: classGroup.id,
      teacherId: courseRun.teacherId,
      source: "direct",
      status: studentStatus,
      progress: 0,
      attendanceRate: 0,
      currentGrade: 0,
      createdAt: ctx.now(),
    };
    state.students = [student, ...state.students];
    state.enrollments = [enrollment, ...state.enrollments];
    state.classGroups = state.classGroups.map(group =>
      group.id === classGroup.id
        ? { ...group, studentIds: [...group.studentIds, studentId] }
        : group
    );
    state.lessonProgress = [
      ...lessonIds.map(lessonId => ({
        id: ctx.createId("lp"),
        studentId,
        enrollmentId: studentEnrollmentId,
        lessonId,
        status: "not_started" as const,
      })),
      ...state.lessonProgress,
    ];
    relationshipSummary = `Student linked to ${course?.title ?? courseRun.courseId}, ${classGroup.name}, attendance, grades, lessons, and calendar.`;
  }

  if (input.role === "teacher") {
    const specialties = Array.from(
      new Set(
        [...(input.subjects ?? []), ...(input.specialization ?? [])]
          .map(item => item.trim())
          .filter(Boolean)
      )
    );
    const teachingLevels = Array.from(
      new Set(
        (input.specialization ?? []).map(item => item.trim()).filter(Boolean)
      )
    );
    teacherAssignment = applyAssignTeacherToCourseRun(
      state,
      {
        userId,
        courseRunId: input.courseRunId!,
        status,
        departmentId: input.departmentId,
        specialties,
        teachingLevels,
        availability: input.availability ?? [],
        actorId: input.actorId,
      },
      ctx
    );
    teacherProfile = teacherAssignment.profile;
    relationshipSummary = `Teacher linked to ${department?.name ?? "selected department"}, ${teacherAssignment.classGroups.length} class group(s), ${teacherAssignment.availability.length} availability slot(s), attendance, grading, schedule, and feedback tools.`;
  }

  appendAudit(
    state,
    ctx,
    "user.created",
    "User",
    userId,
    `Created ${input.role} account for ${name}. ${relationshipSummary}`,
    input.actorId ?? "usr_admin_demo"
  );

  return {
    user: state.users.find(item => item.id === userId)!,
    student,
    enrollment,
    teacherProfile,
    teacherAssignment,
    relationshipSummary,
  };
}

function applyCreateStaffUserAccount(
  state: PlatformState,
  input: CreateStaffUserActionInput,
  ctx: MutationContext
) {
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  const phone = input.phone?.trim() || undefined;
  if (!name || !email) throw new Error("Full name and email are required.");
  if (!email.includes("@")) throw new Error("Enter a valid email address.");
  if (state.users.some(user => user.email.toLowerCase() === email)) {
    throw new Error("This email is already in the identity directory.");
  }

  const {
    status,
    branch,
    department,
    branchId,
    departmentId,
    permissionScope,
    availabilityStatus,
  } = validateStaffAccountScope(state, input);
  const userId = ctx.createId(`usr_${input.role}`);
  const subjects = Array.from(
    new Set((input.subjects ?? []).map(item => item.trim()).filter(Boolean))
  );
  const teachingLevels = Array.from(
    new Set(
      (input.teachingLevels ?? []).map(item => item.trim()).filter(Boolean)
    )
  );
  const operationalScope = Array.from(
    new Set(
      (
        (input.operationalScope?.length
          ? input.operationalScope
          : defaultOperationalScopeByRole[input.role]) ?? []
      )
        .map(item => item.trim())
        .filter(Boolean)
    )
  );
  const user = {
    id: userId,
    name,
    email,
    phone,
    notes: input.notes?.trim() || undefined,
    roles: [input.role],
    activeRole: input.role,
    branchId,
    departmentId,
    status,
  } satisfies PlatformState["users"][number];
  const staffProfile: StaffProfile = {
    id: ctx.createId("staff"),
    userId,
    role: input.role,
    branchIds: [branch.id],
    departmentIds: [department.id],
    permissionScope,
    title: staffTitleByRole[input.role],
    subjects,
    teachingLevels,
    availabilityStatus,
    operationalScope,
    status,
    createdAt: ctx.now(),
    updatedAt: ctx.now(),
  };
  let teacherProfile: PlatformState["teachers"][number] | undefined;

  state.users = [user, ...state.users];
  state.staffProfiles = [staffProfile, ...(state.staffProfiles ?? [])];
  if (input.role === "teacher") {
    teacherProfile = {
      id: ctx.createId("tch"),
      userId,
      departmentId,
      branchId,
      subjects,
      teachingLevels,
      specialties: Array.from(new Set([...subjects, ...teachingLevels])),
      availability: [availabilityStatus],
      availabilityStatus,
      assignedClassIds: [],
      status,
    };
    state.teachers = [teacherProfile, ...state.teachers];
  }

  const relationshipSummary =
    input.role === "teacher"
      ? `Teacher profile created for ${department.name} with ${subjects.length} subject(s), ${teachingLevels.length} teaching level(s), and ${availabilityStatus} availability.`
      : `${staffTitleByRole[input.role]} profile created with ${permissionScope} scope for ${branch.name} / ${department.name}.`;
  appendAudit(
    state,
    ctx,
    "staff.user.created",
    "User",
    userId,
    `Created ${staffTitleByRole[input.role]} account for ${name}. ${relationshipSummary}`,
    input.actorId ?? "usr_admin_demo"
  );

  return {
    user,
    staffProfile,
    teacherProfile,
    permissions: rolePermissions[input.role] ?? [],
    relationshipSummary,
  };
}

function applyAssignTeacherToCourseRun(
  state: PlatformState,
  input: AssignTeacherActionInput,
  ctx: MutationContext
) {
  const user = state.users.find(item => item.id === input.userId);
  if (!user) throw new Error(`Teacher user ${input.userId} was not found.`);
  if (!user.roles.includes("teacher") && user.activeRole !== "teacher") {
    throw new Error(`${user.name} does not have teacher access.`);
  }
  const courseRun = state.courseRuns.find(run => run.id === input.courseRunId);
  if (!courseRun)
    throw new Error(`Course run ${input.courseRunId} was not found.`);
  if (!assignableCourseRunStatuses.includes(courseRun.status)) {
    throw new Error(
      "Teacher assignment requires an active or pending course run."
    );
  }
  if (
    user.branchId &&
    user.branchId !== courseRun.branchId &&
    user.branchId !== "br_global"
  ) {
    throw new Error("Teacher branch must match the selected course run.");
  }

  const course = state.courses.find(item => item.id === courseRun.courseId);
  const program = state.programs.find(item => item.id === course?.programId);
  const classGroups = state.classGroups.filter(
    group => group.courseRunId === courseRun.id
  );
  const classGroupIds = new Set(classGroups.map(group => group.id));
  const specialties = Array.from(
    new Set((input.specialties ?? []).map(item => item.trim()).filter(Boolean))
  );
  const courseLevelLabels = [course?.title, course?.levelId].filter(
    Boolean
  ) as string[];
  const teachingLevels = Array.from(
    new Set([
      ...(input.teachingLevels ?? []).map(item => item.trim()).filter(Boolean),
      ...courseLevelLabels,
    ])
  );
  const availability = Array.from(
    new Set((input.availability ?? []).map(item => item.trim()).filter(Boolean))
  );
  const departmentId = input.departmentId ?? user.departmentId ?? "dep_arabic";
  const department = state.departments.find(item => item.id === departmentId);
  if (!department)
    throw new Error("Choose a valid department for this teacher.");
  if (
    !department.branchIds.includes(courseRun.branchId) &&
    courseRun.branchId !== "br_global"
  ) {
    throw new Error(
      "Teacher department is not available in the selected course branch."
    );
  }
  if (program && program.departmentId !== department.id) {
    throw new Error("Teacher department must own the selected course run.");
  }
  const status = validateAccountStatus(input.status, user.status);
  const previousTeacherUserId =
    courseRun.teacherId && courseRun.teacherId !== user.id
      ? courseRun.teacherId
      : undefined;
  const previousTeacher = previousTeacherUserId
    ? state.users.find(item => item.id === previousTeacherUserId)
    : undefined;
  const previousTeacherLabel =
    previousTeacher?.name ?? previousTeacherUserId ?? "";
  const parsedSlots = availability.map(slot =>
    parseTeacherAvailabilitySlot(slot, courseRun.branchId, user.id, ctx)
  );
  if (availability.length && parsedSlots.some(slot => !slot)) {
    throw new Error("Use availability like Mon 09:00 or Wed 09:00-10:30.");
  }
  if (availability.length && !parsedSlots.length) {
    throw new Error("Add at least one valid availability slot.");
  }

  if (previousTeacherUserId) {
    state.teachers = state.teachers.map(teacher =>
      teacher.userId === previousTeacherUserId
        ? {
            ...teacher,
            assignedClassIds: (teacher.assignedClassIds ?? []).filter(
              classGroupId => !classGroupIds.has(classGroupId)
            ),
          }
        : teacher
    );
  }

  const existingProfile = state.teachers.find(
    teacher => teacher.userId === user.id
  );
  const existingStaffProfile = (state.staffProfiles ?? []).find(
    profile => profile.userId === user.id && profile.role === "teacher"
  );
  const staffSubjects = Array.from(
    new Set(
      [
        ...(existingProfile?.subjects ?? []),
        ...specialties,
        course?.title ?? courseRun.courseId,
      ].filter((item): item is string => Boolean(item))
    )
  );
  if (existingProfile) {
    state.teachers = state.teachers.map(teacher =>
      teacher.id === existingProfile.id
        ? {
            ...teacher,
            departmentId,
            branchId: courseRun.branchId,
            subjects: Array.from(
              new Set([...(teacher.subjects ?? []), ...specialties])
            ),
            teachingLevels: Array.from(
              new Set([...(teacher.teachingLevels ?? []), ...teachingLevels])
            ),
            specialties: Array.from(
              new Set([...teacher.specialties, ...specialties])
            ),
            availability: Array.from(
              new Set([...teacher.availability, ...availability])
            ),
            availabilityStatus: availability.length
              ? "available"
              : teacher.availabilityStatus,
            assignedClassIds: Array.from(
              new Set([
                ...(teacher.assignedClassIds ?? []),
                ...classGroups.map(group => group.id),
              ])
            ),
            status,
          }
        : teacher
    );
  } else {
    state.teachers = [
      {
        id: ctx.createId("tch"),
        userId: user.id,
        departmentId,
        branchId: courseRun.branchId,
        subjects: specialties,
        teachingLevels,
        specialties,
        availability,
        availabilityStatus: availability.length ? "available" : "limited",
        assignedClassIds: classGroups.map(group => group.id),
        status,
      },
      ...state.teachers,
    ];
  }

  state.users = state.users.map(item =>
    item.id === user.id
      ? {
          ...item,
          roles: item.roles.includes("teacher")
            ? item.roles
            : [...item.roles, "teacher"],
          activeRole: "teacher",
          branchId: courseRun.branchId,
          departmentId,
          status,
        }
      : item
  );
  const updatedStaffProfiles = (state.staffProfiles ?? []).map(profile =>
    profile.userId === user.id && profile.role === "teacher"
      ? {
          ...profile,
          branchIds: Array.from(
            new Set([...profile.branchIds, courseRun.branchId])
          ),
          departmentIds: Array.from(
            new Set([...profile.departmentIds, departmentId])
          ),
          subjects: Array.from(
            new Set([...profile.subjects, ...staffSubjects])
          ),
          teachingLevels: Array.from(
            new Set([...profile.teachingLevels, ...teachingLevels])
          ),
          availabilityStatus: availability.length
            ? "available"
            : profile.availabilityStatus,
          operationalScope: Array.from(
            new Set([
              ...profile.operationalScope,
              "classes",
              "attendance",
              "grading",
              "progress",
            ])
          ),
          status,
          updatedAt: ctx.now(),
        }
      : profile
  );
  state.staffProfiles = existingStaffProfile
    ? updatedStaffProfiles
    : [
        {
          id: ctx.createId("staff"),
          userId: user.id,
          role: "teacher",
          branchIds: [courseRun.branchId],
          departmentIds: [departmentId],
          permissionScope: "department",
          title: staffTitleByRole.teacher,
          subjects: staffSubjects,
          teachingLevels,
          availabilityStatus: availability.length ? "available" : "limited",
          operationalScope: Array.from(
            new Set([...defaultOperationalScopeByRole.teacher, "progress"])
          ),
          status,
          createdAt: ctx.now(),
          updatedAt: ctx.now(),
        },
        ...updatedStaffProfiles,
      ];
  state.courseRuns = state.courseRuns.map(run =>
    run.id === courseRun.id ? { ...run, teacherId: user.id } : run
  );
  state.enrollments = state.enrollments.map(enrollment =>
    enrollment.courseRunId === courseRun.id
      ? { ...enrollment, teacherId: user.id }
      : enrollment
  );
  state.events = state.events.map(event =>
    event.classGroupId && classGroupIds.has(event.classGroupId)
      ? { ...event, ownerId: user.id }
      : event
  );

  const seenSlotKeys = new Set(
    state.teacherAvailability
      .filter(
        slot =>
          slot.teacherId !== user.id || slot.branchId !== courseRun.branchId
      )
      .map(
        slot =>
          `${slot.teacherId}|${slot.branchId}|${slot.weekday}|${slot.startsAt}|${slot.endsAt}`
      )
  );
  const nextSlots = (
    parsedSlots.filter(Boolean) as TeacherAvailability[]
  ).filter(slot => {
    const key = `${slot.teacherId}|${slot.branchId}|${slot.weekday}|${slot.startsAt}|${slot.endsAt}`;
    if (seenSlotKeys.has(key)) return false;
    seenSlotKeys.add(key);
    return true;
  });
  state.teacherAvailability = [
    ...state.teacherAvailability.filter(
      slot => slot.teacherId !== user.id || slot.branchId !== courseRun.branchId
    ),
    ...nextSlots,
  ];

  const result = {
    teacher: state.users.find(item => item.id === user.id)!,
    previousTeacher,
    previousTeacherId:
      previousTeacherUserId && !previousTeacher
        ? previousTeacherUserId
        : undefined,
    profile: state.teachers.find(teacher => teacher.userId === user.id),
    courseRun: state.courseRuns.find(run => run.id === courseRun.id)!,
    classGroups,
    availability: nextSlots,
  };
  appendAudit(
    state,
    ctx,
    "teacher.assigned",
    "CourseRun",
    courseRun.id,
    `${user.name} ${previousTeacherLabel ? `reassigned from ${previousTeacherLabel}` : "assigned"} to ${course?.title ?? courseRun.courseId} with ${classGroups.length} class group(s), ${nextSlots.length} availability slot(s), attendance, grading, and feedback tools.`,
    input.actorId ?? "usr_admin_demo"
  );
  return result;
}

function applyUpdateQuranProgress(
  state: PlatformState,
  input: {
    recordId: string;
    memorizedPercent: number;
    tajweedScore: number;
    notes: string;
    actorId?: string;
  },
  ctx: MutationContext
) {
  let updated: QuranProgressRecord | undefined;
  state.quranProgress = state.quranProgress.map(record => {
    if (record.id !== input.recordId) return record;
    updated = {
      ...record,
      memorizedPercent: Math.min(100, Math.max(0, input.memorizedPercent)),
      tajweedScore: Math.min(100, Math.max(0, input.tajweedScore)),
      notes: input.notes,
    };
    return updated;
  });
  if (updated) {
    appendAudit(
      state,
      ctx,
      "quran.progress_updated",
      "QuranProgressRecord",
      updated.id,
      `Updated ${updated.surah} progress.`,
      input.actorId ?? "usr_teacher_demo"
    );
  }
  return updated;
}

function applyReviewRecitation(
  state: PlatformState,
  input: { submissionId: string; feedback: string; actorId?: string },
  ctx: MutationContext
) {
  let updated: RecitationSubmission | undefined;
  state.recitationSubmissions = state.recitationSubmissions.map(submission => {
    if (submission.id !== input.submissionId) return submission;
    updated = { ...submission, status: "approved", feedback: input.feedback };
    return updated;
  });
  if (updated) {
    const student = state.students.find(item => item.id === updated?.studentId);
    notify(state, ctx, {
      userId: student?.userId ?? "usr_student_demo",
      title: "Recitation reviewed",
      body: input.feedback,
      href: "/app/student/quran-progress",
    });
    appendAudit(
      state,
      ctx,
      "recitation.reviewed",
      "RecitationSubmission",
      updated.id,
      `Reviewed ${updated.title}.`,
      input.actorId ?? "usr_teacher_demo"
    );
  }
  return updated;
}

function applySubmitRecitation(
  state: PlatformState,
  input: SubmitRecitationActionInput & { actorId?: string },
  ctx: MutationContext
) {
  const pendingMedia = cleanPendingMedia(input.pendingMedia);
  if (!input.title.trim()) throw new Error("Recitation title is required.");
  const submission: RecitationSubmission = {
    id: ctx.createId("rec"),
    studentId: input.studentId,
    teacherId: input.teacherId,
    title: input.title.trim(),
    submittedAt: ctx.now(),
    status: "pending",
    pendingMedia,
  };
  state.recitationSubmissions = [submission, ...state.recitationSubmissions];
  notify(state, ctx, {
    userId: input.teacherId,
    title: "Recitation submitted",
    body: `${submission.title} is ready for review.`,
    href: "/app/teacher/quran-review",
  });
  appendAudit(
    state,
    ctx,
    "recitation.submitted",
    "RecitationSubmission",
    submission.id,
    pendingMedia.length
      ? `Submitted ${submission.title} with ${pendingMedia.length} pending audio file(s).`
      : `Submitted ${submission.title} for teacher review.`,
    input.actorId ?? "usr_student_demo"
  );
  return submission;
}

function applyMarkNotificationRead(
  state: PlatformState,
  input: { notificationId: string }
) {
  state.notifications = state.notifications.map(notification =>
    notification.id === input.notificationId
      ? { ...notification, read: true }
      : notification
  );
  return state.notifications.find(
    notification => notification.id === input.notificationId
  );
}

function applyMarkMessageRead(
  state: PlatformState,
  input: { messageId: string }
) {
  const message = state.messages.find(item => item.id === input.messageId);
  if (!message) return undefined;
  state.messages = state.messages.map(message =>
    message.id === input.messageId ? { ...message, read: true } : message
  );
  state.notifications = state.notifications.map(notification =>
    notification.userId === message.toUserId &&
    notification.relatedMessageId === message.id
      ? { ...notification, read: true }
      : notification
  );
  return state.messages.find(item => item.id === input.messageId);
}

function applySaveReportPreset(
  state: PlatformState,
  input: Extract<PlatformWorkflowAction, { type: "report.preset.save" }>,
  ctx: MutationContext
) {
  const label = input.label.trim().slice(0, 80) || "Saved report view";
  const preset: ReportPreset = {
    id: ctx.createId("rptpreset"),
    ownerUserId: input.actorId ?? "usr_admin_demo",
    role: input.role,
    label,
    reportType: input.reportType,
    search: input.search?.trim().slice(0, 120) ?? "",
    status: input.status?.trim().slice(0, 40) || "all",
    rowCount: Math.max(0, Math.round(input.rowCount ?? 0)),
    createdAt: ctx.now(),
  };
  state.reportPresets = [
    preset,
    ...(state.reportPresets ?? []).filter(
      item =>
        !(
          item.ownerUserId === preset.ownerUserId &&
          item.role === preset.role &&
          item.label === preset.label
        )
    ),
  ].slice(0, 40);
  appendAudit(
    state,
    ctx,
    "report.preset.saved",
    "ReportPreset",
    preset.id,
    `Saved ${preset.reportType} report view for ${preset.role}.`,
    preset.ownerUserId
  );
  return preset;
}

export function applyPlatformWorkflowAction(
  state: PlatformState,
  action: PlatformWorkflowAction,
  ctxInput?: Partial<MutationContext>
): PlatformWorkflowActionResult {
  const ctx = context(ctxInput);

  switch (action.type) {
    case "lesson.start": {
      const result = applyStartLesson(state, action, ctx);
      return {
        action: "lesson.start",
        entityType: "Lesson",
        entityId: result.id,
        summary: `Opened lesson ${result.title}.`,
        result,
      };
    }
    case "lesson.complete": {
      const result = applyCompleteLesson(state, action, ctx);
      return {
        action: "lesson.complete",
        entityType: "Lesson",
        entityId: result.id,
        summary: `Completed lesson ${result.title}.`,
        result,
      };
    }
    case "assignment.submit": {
      const result = applySubmitAssignment(state, action, ctx);
      return {
        action: "assignment.submit",
        entityType: "AssignmentSubmission",
        entityId: result.id,
        summary: `Submitted assignment ${result.assignmentId}.`,
        result,
      };
    }
    case "quiz.submit": {
      const result = applySubmitQuizAttempt(state, action, ctx);
      return {
        action: "quiz.submit",
        entityType: "QuizAttempt",
        entityId: result.id,
        summary: `Submitted quiz ${result.quizId}.`,
        result,
      };
    }
    case "lead.create": {
      const result = applyCreateLead(state, action, ctx);
      return {
        action: "lead.created",
        entityType: "Lead",
        entityId: result.id,
        summary: `Created lead for ${result.fullName}.`,
        result,
      };
    }
    case "application.create": {
      const result = applyCreateApplication(state, action, ctx);
      return {
        action: "application.created",
        entityType: "Application",
        entityId: result.application.id,
        summary: `Created application for ${result.lead.fullName}.`,
        result,
      };
    }
    case "user.create": {
      const result = applyCreateUserAccount(state, action, ctx);
      return {
        action: "user.created",
        entityType: "User",
        entityId: result.user.id,
        summary: `Created ${result.user.activeRole} account for ${result.user.name}.`,
        result,
      };
    }
    case "staff.user.create": {
      const result = applyCreateStaffUserAccount(state, action, ctx);
      return {
        action: "staff.user.created",
        entityType: "User",
        entityId: result.user.id,
        summary: `Created ${result.staffProfile.title} account for ${result.user.name}.`,
        result,
      };
    }
    case "student.create": {
      const result = applyCreateStudentLifecycleAccount(state, action, ctx);
      return {
        action: "student.created",
        entityType: "StudentProfile",
        entityId: result.student.id,
        summary: `Created student ${result.user.name} and assigned ${result.classGroup.name}.`,
        result,
      };
    }
    case "student.document.add": {
      const result = applyAddStudentDocument(state, action, ctx);
      return {
        action: "student.document_metadata_added",
        entityType: "Document",
        entityId: result.id,
        summary: `Added pending ${result.type.replaceAll("_", " ")} metadata; no file was stored.`,
        result,
      };
    }
    case "student.status.update": {
      const result = applyUpdateStudentStatus(state, action, ctx);
      return {
        action: "student.status_updated",
        entityType: "StudentProfile",
        entityId: result?.id ?? action.studentId,
        summary: result
          ? `Updated student ${result.id} to ${result.status}.`
          : "No student updated.",
        result,
      };
    }
    case "support.ticket.create": {
      const result = applyCreateSupportTicket(state, action, ctx);
      return {
        action: "support.ticket_created",
        entityType: "SupportTicket",
        entityId: result.id,
        summary: `Created support ticket ${result.subject}.`,
        result,
      };
    }
    case "audit.export": {
      const audit = appendAudit(
        state,
        ctx,
        "audit.exported",
        "AuditLog",
        "filtered",
        `Exported ${action.rowCount} audit row(s) as ${action.format.toUpperCase()}.`,
        action.actorId
      );
      return {
        action: "audit.exported",
        entityType: "AuditLog",
        entityId: audit.id,
        summary: audit.summary,
        result: audit,
      };
    }
    case "profile.update": {
      const result = applyUpdateProfile(state, action, ctx);
      return {
        action: "profile.updated",
        entityType: "User",
        entityId: result.user.id,
        summary: result.changed.length
          ? `Updated profile for ${result.user.name}.`
          : `Reviewed profile for ${result.user.name}; no changes were needed.`,
        result,
      };
    }
    case "user.update": {
      const result = applyUpdateUserAccount(state, action, ctx);
      return {
        action: "user.updated",
        entityType: "User",
        entityId: result.user.id,
        summary: `Updated access for ${result.user.name}.`,
        result,
      };
    }
    case "permission.update": {
      const result = applyUpdatePermission(state, action, ctx);
      return {
        action: "permission.updated",
        entityType: "Role",
        entityId: result.role,
        summary: `${result.permission} ${result.granted ? "granted" : "removed"} for ${result.role}.`,
        result,
      };
    }
    case "branch.update": {
      const result = applyUpdateBranch(state, action, ctx);
      return {
        action: "branch.updated",
        entityType: "Branch",
        entityId: result.branch.id,
        summary: `${result.branch.name} set to ${result.branch.status}.`,
        result,
      };
    }
    case "room.status.update": {
      const result = applyUpdateRoomStatus(state, action, ctx);
      return {
        action: "room.status_updated",
        entityType: "Room",
        entityId: result.room.id,
        summary: `${result.room.name} set to ${result.room.status}.`,
        result,
      };
    }
    case "room.create": {
      const result = applyCreateRoom(state, action, ctx);
      return {
        action: "room.created",
        entityType: "Room",
        entityId: result.room.id,
        summary: `${result.room.name} added to ${result.branch.name}.`,
        result,
      };
    }
    case "class.create": {
      const result = applyCreateClassGroup(state, action, ctx);
      return {
        action: "class.created",
        entityType: "ClassGroup",
        entityId: result.classGroup.id,
        summary: `Created ${result.classGroup.name} for ${result.courseRun.term}.`,
        result,
      };
    }
    case "course-run.create": {
      const result = applyCreateCourseRun(state, action, ctx);
      return {
        action: "course_run.created",
        entityType: "CourseRun",
        entityId: result.courseRun.id,
        summary: `Created ${result.courseRun.term} for ${result.course.title}.`,
        result,
      };
    }
    case "class.update": {
      const result = applyUpdateClassGroup(state, action, ctx);
      return {
        action: "class.updated",
        entityType: "ClassGroup",
        entityId: result.classGroup.id,
        summary: `Updated ${result.classGroup.name}.`,
        result,
      };
    }
    case "class.status.update": {
      const result = applyUpdateClassGroupStatus(state, action, ctx);
      return {
        action: "class.status_updated",
        entityType: "ClassGroup",
        entityId: result.classGroup.id,
        summary: `${result.classGroup.name} set to ${result.classGroup.status}.`,
        result,
      };
    }
    case "integration.status.update": {
      const result = applyUpdateIntegrationStatus(state, action, ctx);
      return {
        action: "integration.status_updated",
        entityType: "IntegrationConfig",
        entityId: result.integration.id,
        summary: `${result.integration.label} set to ${result.integration.status}.`,
        result,
      };
    }
    case "integration.local_check": {
      const result = applyCheckIntegration(state, action, ctx);
      return {
        action: "integration.local_checked",
        entityType: "IntegrationConfig",
        entityId: result.integration.id,
        summary: `${result.integration.label} checked locally.`,
        result,
      };
    }
    case "system.health_check": {
      const result = applyCheckSystemHealth(state, action, ctx);
      return {
        action: "system.health_checked",
        entityType: "PlatformSystem",
        entityId: "health",
        summary: `System health check scored ${result.score}%.`,
        result,
      };
    }
    case "settings.save": {
      const result = applySavePlatformSettings(state, action, ctx);
      return {
        action: "settings.saved",
        entityType: "PlatformSettings",
        entityId: "global",
        summary: `Saved platform settings for ${result.settings.organization}.`,
        result,
      };
    }
    case "portal.settings.save": {
      const result = applySavePortalSettings(state, action, ctx);
      return {
        action: "portal_settings.saved",
        entityType: "PortalSettings",
        entityId: `${result.settings.role}:${result.settings.scopeId}`,
        summary: `Saved ${result.settings.label} settings.`,
        result,
      };
    }
    case "placement.create": {
      const result = applyCreatePlacementBooking(state, action, ctx);
      return {
        action: "placement.created",
        entityType: "PlacementTestBooking",
        entityId: result.id,
        summary: `Booked placement test for ${result.fullName}.`,
        result,
      };
    }
    case "curriculum.module.create": {
      const result = applyCreateCurriculumModule(state, action, ctx);
      return {
        action: "curriculum.module_created",
        entityType: "Module",
        entityId: result.id,
        summary: `Added module ${result.title}.`,
        result,
      };
    }
    case "course.status.update": {
      const result = applyUpdateCourseStatus(state, action, ctx);
      return {
        action: "course.status_updated",
        entityType: "Course",
        entityId: result.id,
        summary: `Set ${result.title} to ${result.status}.`,
        result,
      };
    }
    case "material.publish.update": {
      const result = applyUpdateMaterialPublish(state, action, ctx);
      return {
        action: result.published
          ? "material.published"
          : "material.unpublished",
        entityType: "LessonResource",
        entityId: result.id,
        summary: `${result.title} marked ${result.published ? "published" : "unpublished"}.`,
        result,
      };
    }
    case "assignment.create": {
      const result = applyCreateAssignment(state, action, ctx);
      return {
        action: "assignment.created",
        entityType: "Assignment",
        entityId: result.id,
        summary: `${result.title} created.`,
        result,
      };
    }
    case "assignment.update": {
      const result = applyUpdateAssignment(state, action, ctx);
      return {
        action: "assignment.updated",
        entityType: "Assignment",
        entityId: result.id,
        summary: `${result.title} draft updated.`,
        result,
      };
    }
    case "assignment.status.update": {
      const result = applyUpdateAssignmentStatus(state, action, ctx);
      const actionName =
        action.status === "active"
          ? "assignment.published"
          : action.status === "completed"
            ? "assignment.closed"
            : "assignment.cancelled";
      return {
        action: actionName,
        entityType: "Assignment",
        entityId: result.id,
        summary: `${result.title} ${action.status}.`,
        result,
      };
    }
    case "quiz.create": {
      const result = applyCreateQuiz(state, action, ctx);
      return {
        action: "quiz.created",
        entityType: "Quiz",
        entityId: result.id,
        summary: `${result.title} created.`,
        result,
      };
    }
    case "quiz.update": {
      const result = applyUpdateQuiz(state, action, ctx);
      return {
        action: "quiz.updated",
        entityType: "Quiz",
        entityId: result.id,
        summary: `${result.title} draft updated.`,
        result,
      };
    }
    case "quiz.status.update": {
      const result = applyUpdateQuizStatus(state, action, ctx);
      const actionName =
        action.status === "active"
          ? "quiz.published"
          : action.status === "completed"
            ? "quiz.closed"
            : "quiz.cancelled";
      return {
        action: actionName,
        entityType: "Quiz",
        entityId: result.id,
        summary: `${result.title} ${action.status}.`,
        result,
      };
    }
    case "quiz.questions.set": {
      const result = applySetQuizQuestions(state, action, ctx);
      return {
        action: "quiz.questions.updated",
        entityType: "Quiz",
        entityId: result.id,
        summary: `${result.questionIds.length} question(s) attached to ${result.title}.`,
        result,
      };
    }
    case "question.create": {
      const result = applyCreateQuestionBankItem(state, action, ctx);
      return {
        action: "question.created",
        entityType: "QuestionBankItem",
        entityId: result.id,
        summary: "Question added to the bank.",
        result,
      };
    }
    case "assignment.grade": {
      const result = applyGradeAssignmentSubmission(state, action, ctx);
      return {
        action: "assignment.graded",
        entityType: "AssignmentSubmission",
        entityId: result?.id ?? action.submissionId,
        summary: result
          ? `Graded assignment submission ${result.id}.`
          : "No assignment submission changed.",
        result,
      };
    }
    case "quiz.review": {
      const result = applyReviewQuizAttempt(state, action, ctx);
      return {
        action: "quiz.reviewed",
        entityType: "QuizAttempt",
        entityId: result?.id ?? action.attemptId,
        summary: result
          ? `Reviewed quiz attempt ${result.id}.`
          : "No quiz attempt changed.",
        result,
      };
    }
    case "attendance.save": {
      const result = applySaveAttendanceBulk(state, action, ctx);
      return {
        action: "attendance.saved",
        entityType: "AttendanceRecord",
        entityId: action.classGroupId,
        summary: `Saved attendance for ${Object.keys(action.statuses).length} learner(s).`,
        result,
      };
    }
    case "attendance.exception.submit": {
      const result = applySubmitAttendanceException(state, action, ctx);
      return {
        action: "attendance_exception.submitted",
        entityType: "AttendanceExceptionRequest",
        entityId: result.id,
        summary: "Submitted attendance exception request.",
        result,
      };
    }
    case "attendance.exception.review": {
      const result = applyReviewAttendanceException(state, action, ctx);
      return {
        action: `attendance_exception.${action.decision}`,
        entityType: "AttendanceExceptionRequest",
        entityId: result.request.id,
        summary: `Attendance exception ${action.decision}.`,
        result,
      };
    }
    case "calendar.create": {
      const result = applyCreateCalendarEvent(state, action, ctx);
      const reviewCount =
        result.conflicts.length + result.availabilityGaps.length;
      return {
        action: reviewCount
          ? "calendar.created_with_conflict"
          : "calendar.created",
        entityType: "CalendarEvent",
        entityId: result.event.id,
        summary: reviewCount
          ? `${result.event.title} created with ${result.conflicts.length} conflict(s) and ${result.availabilityGaps.length} availability review(s).`
          : `${result.event.title} created.`,
        result,
      };
    }
    case "class.session.reschedule": {
      const result = applyRescheduleClassSession(state, action, ctx);
      return {
        action: "class_session.rescheduled",
        entityType: "ClassSession",
        entityId: result.session.id,
        summary: `${result.session.title} rescheduled.`,
        result,
      };
    }
    case "class.session.cancel": {
      const result = applyCancelClassSession(state, action, ctx);
      return {
        action: "class_session.cancelled",
        entityType: "ClassSession",
        entityId: result.session.id,
        summary: `${result.session.title} cancelled.`,
        result,
      };
    }
    case "message.send": {
      const result = applySendMessage(state, action, ctx);
      return {
        action: "message.sent",
        entityType: "Message",
        entityId: result.id,
        summary: `Sent message: ${result.subject}.`,
        result,
      };
    }
    case "certificate.approve": {
      const result = applyApproveCertificate(state, action, ctx);
      return {
        action: "certificate.approved",
        entityType: "Certificate",
        entityId: result?.id ?? action.certificateId,
        summary: result
          ? `Approved certificate ${result.verificationCode}.`
          : "No certificate changed.",
        result,
      };
    }
    case "certificate.issue": {
      const result = applyIssueCertificate(state, action, ctx);
      return {
        action: "certificate.issued",
        entityType: "Certificate",
        entityId: result?.id ?? action.certificateId,
        summary: result
          ? `Issued certificate ${result.verificationCode}.`
          : "No certificate changed.",
        result,
      };
    }
    case "certificate.reject": {
      const result = applyRejectCertificate(state, action, ctx);
      return {
        action: "certificate.rejected",
        entityType: "Certificate",
        entityId: result?.id ?? action.certificateId,
        summary: result
          ? `Rejected certificate ${result.verificationCode}.`
          : "No certificate changed.",
        result,
      };
    }
    case "payment.record": {
      const result = applyRecordPayment(state, action, ctx);
      return {
        action: "payment.recorded",
        entityType: "Payment",
        entityId: result?.id ?? action.invoiceId,
        summary: result
          ? `Recorded payment ${result.id}.`
          : "No payment changed.",
        result,
      };
    }
    case "placement.result.record": {
      const result = applyRecordPlacementResult(state, action, ctx);
      return {
        action: "placement.result_recorded",
        entityType: "PlacementTestResult",
        entityId: result?.id ?? action.bookingId,
        summary: result
          ? `Recorded placement result ${result.id}.`
          : "No placement result changed.",
        result,
      };
    }
    case "lead.convert": {
      const result = applyConvertLeadToApplication(state, action, ctx);
      return {
        action: "lead.converted",
        entityType: "Application",
        entityId: result?.id ?? action.leadId,
        summary: result
          ? `Converted lead ${action.leadId}.`
          : "No lead converted.",
        result,
      };
    }
    case "application.convert": {
      const result = applyConvertApplicationToEnrollmentWorkflow(
        state,
        action,
        ctx
      );
      return {
        action: "application.converted",
        entityType: "EnrollmentWorkflow",
        entityId: result?.id ?? action.applicationId,
        summary: result
          ? `Prepared enrollment workflow ${result.id}.`
          : "No application converted.",
        result,
      };
    }
    case "enrollment.activate": {
      const result = applyActivateEnrollmentWorkflow(state, action, ctx);
      return {
        action: "enrollment.activated",
        entityType: "EnrollmentWorkflow",
        entityId: action.workflowId,
        summary: result
          ? `Activated student ${result.id}.`
          : "No enrollment activated.",
        result,
      };
    }
    case "enrollment.transfer": {
      const result = applyTransferEnrollment(state, action, ctx);
      return {
        action: "enrollment.transferred",
        entityType: "Enrollment",
        entityId: result.enrollment.id,
        summary: `Transferred enrollment to ${result.targetGroup.name}.`,
        result,
      };
    }
    case "enrollment.status.update": {
      const result = applyUpdateEnrollmentStatus(state, action, ctx);
      return {
        action: "enrollment.status_updated",
        entityType: "Enrollment",
        entityId: result.enrollment.id,
        summary: `Enrollment set to ${result.enrollment.status}.`,
        result,
      };
    }
    case "teacher.assign": {
      const result = applyAssignTeacherToCourseRun(state, action, ctx);
      return {
        action: "teacher.assigned",
        entityType: "CourseRun",
        entityId: result.courseRun.id,
        summary: `${result.teacher.name} assigned to ${result.classGroups.length} class group(s).`,
        result,
      };
    }
    case "quran.progress.update": {
      const result = applyUpdateQuranProgress(state, action, ctx);
      return {
        action: "quran.progress_updated",
        entityType: "QuranProgressRecord",
        entityId: result?.id ?? action.recordId,
        summary: result
          ? `Updated ${result.surah} progress.`
          : "No Quran progress changed.",
        result,
      };
    }
    case "recitation.review": {
      const result = applyReviewRecitation(state, action, ctx);
      return {
        action: "recitation.reviewed",
        entityType: "RecitationSubmission",
        entityId: result?.id ?? action.submissionId,
        summary: result
          ? `Reviewed ${result.title}.`
          : "No recitation changed.",
        result,
      };
    }
    case "recitation.submit": {
      const result = applySubmitRecitation(state, action, ctx);
      return {
        action: "recitation.submitted",
        entityType: "RecitationSubmission",
        entityId: result.id,
        summary: `Submitted ${result.title}.`,
        result,
      };
    }
    case "notification.read": {
      const result = applyMarkNotificationRead(state, action);
      return {
        action: "notification.read",
        entityType: "Notification",
        entityId: action.notificationId,
        summary: "Marked notification as read.",
        result,
      };
    }
    case "message.read": {
      const result = applyMarkMessageRead(state, action);
      return {
        action: "message.read",
        entityType: "Message",
        entityId: action.messageId,
        summary: "Marked message as read.",
        result,
      };
    }
    case "report.preset.save": {
      const result = applySaveReportPreset(state, action, ctx);
      return {
        action: "report.preset.saved",
        entityType: "ReportPreset",
        entityId: result.id,
        summary: `Saved ${result.reportType} report view for ${result.role}.`,
        result,
      };
    }
    default: {
      const neverAction: never = action;
      throw new Error(
        `Unsupported platform action ${(neverAction as { type?: string }).type ?? "unknown"}.`
      );
    }
  }
}

export function applyLearningAction(
  state: PlatformState,
  action: PlatformLearningAction,
  ctxInput?: Partial<MutationContext>
): PlatformLearningActionResult {
  if (action.type === "lesson.start") {
    const lesson = applyStartLesson(state, action, ctxInput);
    return {
      action: action.type,
      entityType: "Lesson",
      entityId: lesson.id,
      summary: `Opened lesson ${lesson.title}.`,
      result: lesson,
    };
  }

  if (action.type === "lesson.complete") {
    const lesson = applyCompleteLesson(state, action, ctxInput);
    return {
      action: action.type,
      entityType: "Lesson",
      entityId: lesson.id,
      summary: `Completed lesson ${lesson.title}.`,
      result: lesson,
    };
  }

  if (action.type === "assignment.submit") {
    const submission = applySubmitAssignment(state, action, ctxInput);
    return {
      action: action.type,
      entityType: "AssignmentSubmission",
      entityId: submission.id,
      summary: `Submitted assignment ${submission.assignmentId}.`,
      result: submission,
    };
  }

  const attempt = applySubmitQuizAttempt(state, action, ctxInput);
  return {
    action: action.type,
    entityType: "QuizAttempt",
    entityId: attempt.id,
    summary: `Submitted quiz ${attempt.quizId}.`,
    result: attempt,
  };
}
