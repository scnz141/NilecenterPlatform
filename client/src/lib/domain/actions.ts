import type {
  AssignmentSubmission,
  AttendanceStatus,
  AuditLog,
  CalendarEvent,
  CalendarEventType,
  Certificate,
  CommunicationLog,
  EntityStatus,
  Grade,
  Lead,
  Lesson,
  Message,
  Notification,
  Payment,
  PlacementTestBooking,
  PlacementTestResult,
  PlatformState,
  QuizAttempt,
  QuranProgressRecord,
  RecitationSubmission,
} from "./types";

export type PlatformLearningAction =
  | { type: "lesson.start"; lessonId: string; studentId?: string; actorId?: string }
  | { type: "lesson.complete"; lessonId: string; studentId?: string; actorId?: string }
  | { type: "assignment.submit"; assignmentId: string; response: string; studentId?: string; actorId?: string }
  | { type: "quiz.submit"; quizId: string; answers: Record<string, string>; studentId?: string; actorId?: string };

export type CreateLeadActionInput = Pick<Lead, "fullName" | "email" | "phone" | "subject" | "notes"> & {
  country?: string;
  source?: Lead["source"];
};

export type CreatePlacementActionInput = Pick<
  PlacementTestBooking,
  "fullName" | "email" | "phone" | "subject" | "preferredDate" | "currentLevel"
> & {
  branchId?: string;
};

export type CreateCalendarEventActionInput = {
  title: string;
  eventType: CalendarEventType;
  startsAt: string;
  endsAt: string;
  ownerId: string;
  branchId?: string;
  roomId?: string;
  classGroupId?: string;
};

export type CreateAssignmentActionInput = {
  courseRunId: string;
  title: string;
  dueAt: string;
  submissionType: "text" | "file" | "audio" | "video";
  rubric: string[];
};

export type CreateQuizActionInput = {
  courseRunId: string;
  title: string;
  durationMinutes: number;
  questionTypes: string[];
  attemptsAllowed: number;
};

export type SendMessageActionInput = {
  fromUserId?: string;
  toUserId: string;
  subject: string;
  body: string;
  channel?: CommunicationLog["channel"];
};

export type SubmitRecitationActionInput = Pick<RecitationSubmission, "studentId" | "teacherId" | "title">;

export type PlatformWorkflowAction =
  | PlatformLearningAction
  | ({ type: "lead.create"; actorId?: string } & CreateLeadActionInput)
  | ({ type: "placement.create"; actorId?: string } & CreatePlacementActionInput)
  | { type: "record.save"; module: string; payload: Record<string, string>; actorId?: string }
  | ({ type: "assignment.create"; actorId?: string } & CreateAssignmentActionInput)
  | ({ type: "quiz.create"; actorId?: string } & CreateQuizActionInput)
  | { type: "assignment.grade"; submissionId: string; score: number; feedback: string; actorId?: string }
  | { type: "attendance.save"; classGroupId: string; sessionId: string; statuses: Record<string, AttendanceStatus>; actorId?: string }
  | ({ type: "calendar.create"; actorId?: string } & CreateCalendarEventActionInput)
  | ({ type: "message.send"; actorId?: string } & SendMessageActionInput)
  | { type: "certificate.approve"; certificateId: string; actorId?: string }
  | { type: "certificate.issue"; certificateId: string; actorId?: string }
  | { type: "payment.record"; invoiceId: string; actorId?: string }
  | { type: "placement.result.record"; bookingId: string; recommendedLevel: string; score: number; notes: string; actorId?: string }
  | { type: "lead.convert"; leadId: string; actorId?: string }
  | { type: "quran.progress.update"; recordId: string; memorizedPercent: number; tajweedScore: number; notes: string; actorId?: string }
  | { type: "recitation.review"; submissionId: string; feedback: string; actorId?: string }
  | ({ type: "recitation.submit"; actorId?: string } & SubmitRecitationActionInput)
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
  createId: (prefix) => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
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
) {
  const audit: AuditLog = {
    id: ctx.createId("audit"),
    actorId,
    action,
    entityType,
    entityId,
    summary,
    createdAt: ctx.now(),
  };
  state.auditLogs = [audit, ...state.auditLogs].slice(0, 160);
  return audit;
}

function notify(state: PlatformState, ctx: MutationContext, input: Omit<Notification, "id" | "read" | "createdAt">) {
  const notification: Notification = {
    id: ctx.createId("not"),
    read: false,
    createdAt: ctx.now(),
    ...input,
  };
  state.notifications = [notification, ...state.notifications].slice(0, 80);
  return notification;
}

function requireLesson(state: PlatformState, lessonId: string) {
  const lesson = state.lessons.find((item) => item.id === lessonId);
  if (!lesson) throw new Error(`Lesson ${lessonId} was not found.`);
  return lesson;
}

function requireAssignment(state: PlatformState, assignmentId: string) {
  const assignment = state.assignments.find((item) => item.id === assignmentId);
  if (!assignment) throw new Error(`Assignment ${assignmentId} was not found.`);
  return assignment;
}

function requireQuiz(state: PlatformState, quizId: string) {
  const quiz = state.quizzes.find((item) => item.id === quizId);
  if (!quiz) throw new Error(`Quiz ${quizId} was not found.`);
  return quiz;
}

export function applyStartLesson(
  state: PlatformState,
  input: { lessonId: string; studentId?: string; actorId?: string },
  ctxInput?: Partial<MutationContext>,
) {
  const ctx = context(ctxInput);
  const studentId = input.studentId ?? "stu_demo";
  const actorId = input.actorId ?? "usr_student_demo";
  const lesson = requireLesson(state, input.lessonId);
  const existing = state.lessonProgress.find((item) => item.lessonId === lesson.id && item.studentId === studentId);

  if (existing) {
    if (existing.status !== "completed") existing.status = "in_progress";
  } else {
    state.lessonProgress = [
      {
        id: ctx.createId("lp"),
        studentId,
        lessonId: lesson.id,
        status: "in_progress",
      },
      ...state.lessonProgress,
    ];
  }

  appendAudit(state, ctx, "lesson.started", "Lesson", lesson.id, `Opened lesson ${lesson.title}.`, actorId);
  return lesson;
}

export function applyCompleteLesson(
  state: PlatformState,
  input: { lessonId: string; studentId?: string; actorId?: string },
  ctxInput?: Partial<MutationContext>,
) {
  const ctx = context(ctxInput);
  const studentId = input.studentId ?? "stu_demo";
  const actorId = input.actorId ?? "usr_student_demo";
  const lesson = requireLesson(state, input.lessonId);
  const existing = state.lessonProgress.find((item) => item.lessonId === lesson.id && item.studentId === studentId);
  const alreadyCompleted = existing?.status === "completed";

  if (existing) {
    existing.status = "completed";
    existing.completedAt = existing.completedAt ?? ctx.now();
  } else {
    state.lessonProgress = [
      {
        id: ctx.createId("lp"),
        studentId,
        lessonId: lesson.id,
        status: "completed",
        completedAt: ctx.now(),
      },
      ...state.lessonProgress,
    ];
  }

  const module = state.modules.find((item) => item.id === lesson.moduleId);
  const courseRun = module ? state.courseRuns.find((run) => run.courseId === module.courseId) : undefined;
  if (courseRun && !alreadyCompleted) {
    state.enrollments = state.enrollments.map((enrollment) =>
      enrollment.studentId === studentId && enrollment.courseRunId === courseRun.id
        ? { ...enrollment, progress: Math.min(100, enrollment.progress + 6) }
        : enrollment,
    );
  }

  appendAudit(state, ctx, "lesson.completed", "Lesson", lesson.id, `Completed lesson ${lesson.title}.`, actorId);
  return lesson;
}

export function applySubmitAssignment(
  state: PlatformState,
  input: { assignmentId: string; response: string; studentId?: string; actorId?: string },
  ctxInput?: Partial<MutationContext>,
) {
  const ctx = context(ctxInput);
  const studentId = input.studentId ?? "stu_demo";
  const actorId = input.actorId ?? "usr_student_demo";
  const assignment = requireAssignment(state, input.assignmentId);
  const existing = state.assignmentSubmissions.find(
    (item) => item.assignmentId === assignment.id && item.studentId === studentId && item.status !== "completed",
  );
  const submission: AssignmentSubmission = {
    id: existing?.id ?? ctx.createId("sub"),
    assignmentId: assignment.id,
    studentId,
    submittedAt: ctx.now(),
    status: "pending" as EntityStatus,
    response: input.response,
  };

  state.assignmentSubmissions = existing
    ? state.assignmentSubmissions.map((item) => (item.id === existing.id ? submission : item))
    : [submission, ...state.assignmentSubmissions];
  notify(state, ctx, {
    userId: "usr_teacher_demo",
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
    `Submitted ${assignment.title}.`,
    actorId,
  );
  return submission;
}

export function applySubmitQuizAttempt(
  state: PlatformState,
  input: { quizId: string; answers: Record<string, string>; studentId?: string; actorId?: string },
  ctxInput?: Partial<MutationContext>,
) {
  const ctx = context(ctxInput);
  const studentId = input.studentId ?? "stu_demo";
  const actorId = input.actorId ?? "usr_student_demo";
  const quiz = requireQuiz(state, input.quizId);
  const previousAttempts = state.quizAttempts.filter((attempt) => attempt.quizId === quiz.id && attempt.studentId === studentId);
  if (quiz.attemptsAllowed <= 0) throw new Error("This quiz is not accepting attempts.");
  if (previousAttempts.length >= quiz.attemptsAllowed) {
    return previousAttempts[0]!;
  }

  const score = Math.max(70, 100 - Object.values(input.answers).filter((answer) => answer.trim().length < 2).length * 10);
  const attempt: QuizAttempt = {
    id: ctx.createId("attempt"),
    quizId: quiz.id,
    studentId,
    startedAt: ctx.now(),
    submittedAt: ctx.now(),
    status: "completed" as EntityStatus,
    score,
    maxScore: 100,
    answers: input.answers,
  };
  const grade: Grade = {
    id: ctx.createId("grade"),
    studentId,
    courseRunId: quiz.courseRunId,
    itemId: quiz.id,
    itemTitle: quiz.title,
    score,
    maxScore: 100,
    feedback: score >= 80 ? "Auto-graded pass. Teacher can add manual feedback." : "Auto-graded with manual review recommended.",
  };

  state.quizAttempts = [attempt, ...state.quizAttempts];
  state.grades = [grade, ...state.grades];
  appendAudit(state, ctx, "quiz.submitted", "QuizAttempt", attempt.id, `Submitted ${quiz.title} with ${score}/100.`, actorId);
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

function applyCreateLead(
  state: PlatformState,
  input: CreateLeadActionInput & { actorId?: string },
  ctx: MutationContext,
) {
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
  );
  return lead;
}

function applyCreatePlacementBooking(
  state: PlatformState,
  input: CreatePlacementActionInput & { actorId?: string },
  ctx: MutationContext,
) {
  const booking: PlacementTestBooking = {
    id: ctx.createId("pt"),
    fullName: input.fullName,
    email: input.email,
    phone: input.phone,
    branchId: input.branchId ?? "br_online",
    subject: input.subject,
    preferredDate: input.preferredDate,
    currentLevel: input.currentLevel,
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
  );
  return booking;
}

function applySaveOperationalRecord(
  state: PlatformState,
  input: { module: string; payload: Record<string, string>; actorId?: string },
  ctx: MutationContext,
) {
  const entityId = ctx.createId("record");
  const audit = appendAudit(
    state,
    ctx,
    "record.saved",
    input.module,
    entityId,
    `Saved ${input.module} record: ${input.payload.title ?? input.payload.name ?? entityId}.`,
    input.actorId ?? "usr_admin_demo",
  );
  return { entityId, audit };
}

function applyCreateAssignment(
  state: PlatformState,
  input: CreateAssignmentActionInput & { actorId?: string },
  ctx: MutationContext,
) {
  const assignment = {
    id: ctx.createId("asg"),
    courseRunId: input.courseRunId,
    title: input.title,
    dueAt: input.dueAt,
    submissionType: input.submissionType,
    rubric: input.rubric,
    status: "active" as const,
  };
  state.assignments = [assignment, ...state.assignments];
  appendAudit(
    state,
    ctx,
    "assignment.created",
    "Assignment",
    assignment.id,
    `${assignment.title} created.`,
    input.actorId ?? "usr_teacher_demo",
  );
  return assignment;
}

function applyCreateQuiz(
  state: PlatformState,
  input: CreateQuizActionInput & { actorId?: string },
  ctx: MutationContext,
) {
  const quiz = {
    id: ctx.createId("quiz"),
    courseRunId: input.courseRunId,
    title: input.title,
    durationMinutes: input.durationMinutes,
    questionTypes: input.questionTypes,
    attemptsAllowed: input.attemptsAllowed,
    status: "active" as const,
  };
  state.quizzes = [quiz, ...state.quizzes];
  appendAudit(
    state,
    ctx,
    "quiz.created",
    "Quiz",
    quiz.id,
    `${quiz.title} created.`,
    input.actorId ?? "usr_teacher_demo",
  );
  return quiz;
}

function applyGradeAssignmentSubmission(
  state: PlatformState,
  input: { submissionId: string; score: number; feedback: string; actorId?: string },
  ctx: MutationContext,
) {
  let updatedSubmission: AssignmentSubmission | undefined;
  state.assignmentSubmissions = state.assignmentSubmissions.map((submission) => {
    if (submission.id !== input.submissionId) return submission;
    updatedSubmission = {
      ...submission,
      status: "completed",
      score: input.score,
      feedback: input.feedback,
    };
    return updatedSubmission;
  });
  if (!updatedSubmission) return undefined;

  const assignment = state.assignments.find((item) => item.id === updatedSubmission?.assignmentId);
  const existingGrade = state.grades.find(
    (grade) =>
      grade.studentId === updatedSubmission?.studentId &&
      grade.courseRunId === assignment?.courseRunId &&
      (grade.itemId ? grade.itemId === assignment?.id : grade.itemTitle === assignment?.title),
  );
  const maxScore = 100;
  if (existingGrade) {
    existingGrade.score = input.score;
    existingGrade.maxScore = maxScore;
    existingGrade.feedback = input.feedback;
  } else if (assignment) {
    state.grades = [
      {
        id: ctx.createId("gr"),
        studentId: updatedSubmission.studentId,
        courseRunId: assignment.courseRunId,
        itemId: assignment.id,
        itemTitle: assignment.title,
        score: input.score,
        maxScore,
        feedback: input.feedback,
      },
      ...state.grades,
    ];
  }
  const student = state.students.find((item) => item.id === updatedSubmission?.studentId);
  notify(state, ctx, {
    userId: student?.userId ?? "usr_student_demo",
    title: "Assignment graded",
    body: `${assignment?.title ?? "Assignment"} received ${input.score}/${maxScore}.`,
    href: "/app/student/grades",
  });
  appendAudit(
    state,
    ctx,
    "assignment.graded",
    "AssignmentSubmission",
    updatedSubmission.id,
    `${assignment?.title ?? "Assignment"} graded ${input.score}/${maxScore}.`,
    input.actorId ?? "usr_teacher_demo",
  );
  return updatedSubmission;
}

function applySaveAttendanceBulk(
  state: PlatformState,
  input: {
    classGroupId: string;
    sessionId: string;
    statuses: Record<string, AttendanceStatus>;
    actorId?: string;
  },
  ctx: MutationContext,
) {
  const session = state.classSessions.find((item) => item.id === input.sessionId || item.eventId === input.sessionId);
  const classGroup = state.classGroups.find((item) => item.id === input.classGroupId);
  if (!classGroup) throw new Error(`Class group ${input.classGroupId} was not found.`);
  if (session && session.classGroupId !== classGroup.id) throw new Error("Attendance session does not belong to this class group.");
  const roster = new Set(classGroup.studentIds);
  const suppliedStudentIds = Object.keys(input.statuses);
  const invalidStudentId = suppliedStudentIds.find((studentId) => !roster.has(studentId));
  if (invalidStudentId) throw new Error(`Student ${invalidStudentId} is not in this class roster.`);
  const missingStudentId = classGroup.studentIds.find((studentId) => !(studentId in input.statuses));
  if (missingStudentId) throw new Error(`Attendance is missing roster student ${missingStudentId}.`);
  const sessionKeys = new Set([input.sessionId, session?.id, session?.eventId].filter(Boolean));
  Object.entries(input.statuses).forEach(([studentId, status]) => {
    const existing = state.attendance.find(
      (record) =>
        record.classGroupId === input.classGroupId &&
        sessionKeys.has(record.sessionId) &&
        record.studentId === studentId,
    );
    if (existing) {
      existing.status = status;
      existing.sessionId = session?.id ?? input.sessionId;
    } else {
      state.attendance = [
        {
          id: ctx.createId("att"),
          classGroupId: input.classGroupId,
          studentId,
          sessionId: session?.id ?? input.sessionId,
          status,
        },
        ...state.attendance,
      ];
    }
  });
  state.classSessions = state.classSessions.map((item) =>
    item.id === input.sessionId || item.eventId === input.sessionId ? { ...item, attendanceSaved: true } : item,
  );
  appendAudit(
    state,
    ctx,
    "attendance.saved",
    "AttendanceRecord",
    input.classGroupId,
    `Saved attendance for ${Object.keys(input.statuses).length} learner(s).`,
    input.actorId ?? "usr_teacher_demo",
  );
  return state.attendance.filter(
    (record) => record.classGroupId === input.classGroupId && sessionKeys.has(record.sessionId),
  );
}

function applyCreateCalendarEvent(
  state: PlatformState,
  input: CreateCalendarEventActionInput & { actorId?: string },
  ctx: MutationContext,
) {
  const requestedClassGroup = input.classGroupId ? state.classGroups.find((item) => item.id === input.classGroupId) : undefined;
  const requestedRun = requestedClassGroup ? state.courseRuns.find((item) => item.id === requestedClassGroup.courseRunId) : undefined;
  const classGroupId = requestedClassGroup && (!input.branchId || requestedRun?.branchId === input.branchId) ? requestedClassGroup.id : undefined;
  const starts = new Date(input.startsAt).getTime();
  const ends = new Date(input.endsAt).getTime();
  const conflicts = state.events.filter((event) => {
    const eventStarts = new Date(event.startsAt).getTime();
    const eventEnds = new Date(event.endsAt).getTime();
    const overlaps = starts < eventEnds && ends > eventStarts;
    if (!overlaps) return false;
    return Boolean(
      (input.roomId && event.roomId === input.roomId) ||
        (input.ownerId && event.ownerId === input.ownerId) ||
        (classGroupId && event.classGroupId === classGroupId),
    );
  });
  const event: CalendarEvent = {
    id: ctx.createId("evt"),
    type: input.eventType,
    title: input.title,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    ownerId: input.ownerId,
    branchId: input.branchId,
    roomId: input.roomId,
    classGroupId,
    status: conflicts.length ? "pending" : "active",
  };
  state.events = [event, ...state.events];
  if (event.classGroupId && (event.type === "class_session" || event.type === "live_session")) {
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
    conflicts.length ? "calendar.created_with_conflict" : "calendar.created",
    "CalendarEvent",
    event.id,
    `${event.title} created${conflicts.length ? ` with ${conflicts.length} conflict(s)` : ""}.`,
    input.actorId ?? "usr_branch_demo",
  );
  return { event, conflicts };
}

function applySendMessage(
  state: PlatformState,
  input: SendMessageActionInput & { actorId?: string },
  ctx: MutationContext,
) {
  const fromUserId = input.fromUserId ?? input.actorId ?? "usr_student_demo";
  const message: Message = {
    id: ctx.createId("msg"),
    fromUserId,
    toUserId: input.toUserId,
    subject: input.subject,
    body: input.body,
    read: false,
    createdAt: ctx.now(),
  };
  state.messages = [message, ...state.messages];
  const log: CommunicationLog = {
    id: ctx.createId("comm"),
    actorId: fromUserId,
    channel: input.channel ?? "in_app",
    subject: input.subject,
    body: input.body,
    relatedUserId: input.toUserId,
    status: "completed",
    createdAt: ctx.now(),
  };
  state.communicationLogs = [log, ...state.communicationLogs];
  const recipient = state.users.find((user) => user.id === input.toUserId);
  notify(state, ctx, {
    userId: input.toUserId,
    title: input.subject,
    body: input.body,
    href: messageRouteForUser(recipient),
  });
  appendAudit(state, ctx, "message.sent", "Message", message.id, `Sent message: ${message.subject}.`, fromUserId);
  return message;
}

function applyApproveCertificate(
  state: PlatformState,
  input: { certificateId: string; actorId?: string },
  ctx: MutationContext,
) {
  let updated: Certificate | undefined;
  let changed = false;
  state.certificates = state.certificates.map((certificate) => {
    if (certificate.id !== input.certificateId) return certificate;
    if (certificate.status === "approved" || certificate.status === "issued") {
      updated = certificate;
      return certificate;
    }
    changed = true;
    updated = { ...certificate, status: "approved", approvedBy: input.actorId ?? "usr_hod_demo" };
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
      input.actorId ?? "usr_hod_demo",
    );
  }
  return updated;
}

function applyIssueCertificate(
  state: PlatformState,
  input: { certificateId: string; actorId?: string },
  ctx: MutationContext,
) {
  let updated: Certificate | undefined;
  let changed = false;
  state.certificates = state.certificates.map((certificate) => {
    if (certificate.id !== input.certificateId) return certificate;
    if (certificate.status === "issued") {
      updated = certificate;
      return certificate;
    }
    if (certificate.status !== "approved") return certificate;
    changed = true;
    updated = { ...certificate, status: "issued" };
    return updated;
  });
  if (updated && changed) {
    const student = state.students.find((item) => item.id === updated?.studentId);
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
      input.actorId ?? "usr_hod_demo",
    );
  }
  return updated;
}

function applyRecordPayment(
  state: PlatformState,
  input: { invoiceId: string; actorId?: string },
  ctx: MutationContext,
) {
  const invoice = state.invoices.find((item) => item.id === input.invoiceId);
  if (!invoice) return undefined;
  const paidSoFar = state.payments
    .filter((payment) => payment.invoiceId === invoice.id && payment.status === "paid")
    .reduce((sum, payment) => sum + payment.amount, 0);
  const amount = Math.max(0, invoice.amount - paidSoFar);
  if (amount <= 0 || invoice.status === "paid") {
    return state.payments.find((payment) => payment.invoiceId === invoice.id && payment.status === "paid");
  }
  const payment: Payment = {
    id: ctx.createId("pay"),
    invoiceId: invoice.id,
    amount,
    method: "manual",
    paidAt: ctx.now(),
    status: "paid",
  };
  state.payments = [payment, ...state.payments];
  state.invoices = state.invoices.map((item) => (item.id === invoice.id ? { ...item, status: "paid" } : item));
  appendAudit(
    state,
    ctx,
    "payment.recorded",
    "Payment",
    payment.id,
    `Recorded ${invoice.currency} ${amount} for ${invoice.id}.`,
    input.actorId ?? "usr_registrar_demo",
  );
  return payment;
}

function applyRecordPlacementResult(
  state: PlatformState,
  input: { bookingId: string; recommendedLevel: string; score: number; notes: string; actorId?: string },
  ctx: MutationContext,
) {
  const booking = state.placementTests.find((item) => item.id === input.bookingId) ?? state.placementTests[0];
  if (!booking) return undefined;
  const existing = state.placementResults.find((item) => item.bookingId === booking.id);
  const result: PlacementTestResult = {
    id: existing?.id ?? ctx.createId("ptr"),
    bookingId: booking.id,
    examinerId: "usr_teacher_demo",
    score: input.score,
    recommendedLevel: input.recommendedLevel,
    notes: input.notes,
    createdAt: ctx.now(),
  };
  state.placementResults = existing
    ? state.placementResults.map((item) => (item.id === existing.id ? result : item))
    : [result, ...state.placementResults];
  state.placementTests = state.placementTests.map((item) =>
    item.id === booking.id ? { ...item, status: "completed", recommendedLevel: input.recommendedLevel } : item,
  );
  const existingWorkflow = state.enrollmentWorkflows.find((workflow) => workflow.placementTestId === booking.id);
  const workflow = {
    id: existingWorkflow?.id ?? ctx.createId("ew"),
    leadId: booking.leadId,
    placementTestId: booking.id,
    targetCourseId: "course_ar_l3",
    status: "ready_to_enroll" as const,
    nextStep: "Confirm package, create invoice, and assign class",
    updatedAt: ctx.now(),
  };
  state.enrollmentWorkflows = existingWorkflow
    ? state.enrollmentWorkflows.map((item) => (item.id === existingWorkflow.id ? workflow : item))
    : [workflow, ...state.enrollmentWorkflows];
  appendAudit(
    state,
    ctx,
    existing ? "placement.result_updated" : "placement.result_recorded",
    "PlacementTestResult",
    result.id,
    `Recorded placement result for ${booking.fullName}.`,
    input.actorId ?? "usr_registrar_demo",
  );
  return result;
}

function applyConvertLeadToApplication(
  state: PlatformState,
  input: { leadId: string; actorId?: string },
  ctx: MutationContext,
) {
  const lead = state.leads.find((item) => item.id === input.leadId) ?? state.leads[0];
  if (!lead) return undefined;
  const existing = state.applications.find((item) => item.leadId === lead.id);
  if (existing) return existing;
  state.leads = state.leads.map((item) => (item.id === lead.id ? { ...item, status: "ready_to_enroll" } : item));
  const application = {
    id: ctx.createId("app"),
    leadId: lead.id,
    branchId: "br_online",
    courseInterest: lead.subject,
    schedulePreference: "To confirm",
    status: "pending" as EntityStatus,
  };
  state.applications = [application, ...state.applications];
  appendAudit(
    state,
    ctx,
    "lead.converted",
    "Application",
    application.id,
    `Converted ${lead.fullName} to application.`,
    input.actorId ?? "usr_registrar_demo",
  );
  return application;
}

function applyUpdateQuranProgress(
  state: PlatformState,
  input: { recordId: string; memorizedPercent: number; tajweedScore: number; notes: string; actorId?: string },
  ctx: MutationContext,
) {
  let updated: QuranProgressRecord | undefined;
  state.quranProgress = state.quranProgress.map((record) => {
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
      input.actorId ?? "usr_teacher_demo",
    );
  }
  return updated;
}

function applyReviewRecitation(
  state: PlatformState,
  input: { submissionId: string; feedback: string; actorId?: string },
  ctx: MutationContext,
) {
  let updated: RecitationSubmission | undefined;
  state.recitationSubmissions = state.recitationSubmissions.map((submission) => {
    if (submission.id !== input.submissionId) return submission;
    updated = { ...submission, status: "approved", feedback: input.feedback };
    return updated;
  });
  if (updated) {
    const student = state.students.find((item) => item.id === updated?.studentId);
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
      input.actorId ?? "usr_teacher_demo",
    );
  }
  return updated;
}

function applySubmitRecitation(
  state: PlatformState,
  input: SubmitRecitationActionInput & { actorId?: string },
  ctx: MutationContext,
) {
  const submission: RecitationSubmission = {
    id: ctx.createId("rec"),
    studentId: input.studentId,
    teacherId: input.teacherId,
    title: input.title,
    submittedAt: ctx.now(),
    status: "pending",
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
    `Submitted ${submission.title}.`,
    input.actorId ?? "usr_student_demo",
  );
  return submission;
}

function applyMarkNotificationRead(state: PlatformState, input: { notificationId: string }) {
  state.notifications = state.notifications.map((notification) =>
    notification.id === input.notificationId ? { ...notification, read: true } : notification,
  );
  return state.notifications.find((notification) => notification.id === input.notificationId);
}

export function applyPlatformWorkflowAction(
  state: PlatformState,
  action: PlatformWorkflowAction,
  ctxInput?: Partial<MutationContext>,
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
      return { action: "lead.created", entityType: "Lead", entityId: result.id, summary: `Created lead for ${result.fullName}.`, result };
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
    case "record.save": {
      const result = applySaveOperationalRecord(state, action, ctx);
      return {
        action: "record.saved",
        entityType: action.module,
        entityId: result.entityId,
        summary: result.audit.summary,
        result,
      };
    }
    case "assignment.create": {
      const result = applyCreateAssignment(state, action, ctx);
      return { action: "assignment.created", entityType: "Assignment", entityId: result.id, summary: `${result.title} created.`, result };
    }
    case "quiz.create": {
      const result = applyCreateQuiz(state, action, ctx);
      return { action: "quiz.created", entityType: "Quiz", entityId: result.id, summary: `${result.title} created.`, result };
    }
    case "assignment.grade": {
      const result = applyGradeAssignmentSubmission(state, action, ctx);
      return {
        action: "assignment.graded",
        entityType: "AssignmentSubmission",
        entityId: result?.id ?? action.submissionId,
        summary: result ? `Graded assignment submission ${result.id}.` : "No assignment submission changed.",
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
    case "calendar.create": {
      const result = applyCreateCalendarEvent(state, action, ctx);
      return {
        action: result.conflicts.length ? "calendar.created_with_conflict" : "calendar.created",
        entityType: "CalendarEvent",
        entityId: result.event.id,
        summary: `${result.event.title} created.`,
        result,
      };
    }
    case "message.send": {
      const result = applySendMessage(state, action, ctx);
      return { action: "message.sent", entityType: "Message", entityId: result.id, summary: `Sent message: ${result.subject}.`, result };
    }
    case "certificate.approve": {
      const result = applyApproveCertificate(state, action, ctx);
      return {
        action: "certificate.approved",
        entityType: "Certificate",
        entityId: result?.id ?? action.certificateId,
        summary: result ? `Approved certificate ${result.verificationCode}.` : "No certificate changed.",
        result,
      };
    }
    case "certificate.issue": {
      const result = applyIssueCertificate(state, action, ctx);
      return {
        action: "certificate.issued",
        entityType: "Certificate",
        entityId: result?.id ?? action.certificateId,
        summary: result ? `Issued certificate ${result.verificationCode}.` : "No certificate changed.",
        result,
      };
    }
    case "payment.record": {
      const result = applyRecordPayment(state, action, ctx);
      return {
        action: "payment.recorded",
        entityType: "Payment",
        entityId: result?.id ?? action.invoiceId,
        summary: result ? `Recorded payment ${result.id}.` : "No payment changed.",
        result,
      };
    }
    case "placement.result.record": {
      const result = applyRecordPlacementResult(state, action, ctx);
      return {
        action: "placement.result_recorded",
        entityType: "PlacementTestResult",
        entityId: result?.id ?? action.bookingId,
        summary: result ? `Recorded placement result ${result.id}.` : "No placement result changed.",
        result,
      };
    }
    case "lead.convert": {
      const result = applyConvertLeadToApplication(state, action, ctx);
      return {
        action: "lead.converted",
        entityType: "Application",
        entityId: result?.id ?? action.leadId,
        summary: result ? `Converted lead ${action.leadId}.` : "No lead converted.",
        result,
      };
    }
    case "quran.progress.update": {
      const result = applyUpdateQuranProgress(state, action, ctx);
      return {
        action: "quran.progress_updated",
        entityType: "QuranProgressRecord",
        entityId: result?.id ?? action.recordId,
        summary: result ? `Updated ${result.surah} progress.` : "No Quran progress changed.",
        result,
      };
    }
    case "recitation.review": {
      const result = applyReviewRecitation(state, action, ctx);
      return {
        action: "recitation.reviewed",
        entityType: "RecitationSubmission",
        entityId: result?.id ?? action.submissionId,
        summary: result ? `Reviewed ${result.title}.` : "No recitation changed.",
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
    default: {
      const neverAction: never = action;
      throw new Error(`Unsupported platform action ${(neverAction as { type?: string }).type ?? "unknown"}.`);
    }
  }
}

export function applyLearningAction(
  state: PlatformState,
  action: PlatformLearningAction,
  ctxInput?: Partial<MutationContext>,
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
