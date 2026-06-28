import type {
  AssignmentSubmission,
  AuditLog,
  EntityStatus,
  Grade,
  Lesson,
  Notification,
  PlatformState,
  QuizAttempt,
} from "./types";

export type PlatformLearningAction =
  | { type: "lesson.start"; lessonId: string; studentId?: string; actorId?: string }
  | { type: "lesson.complete"; lessonId: string; studentId?: string; actorId?: string }
  | { type: "assignment.submit"; assignmentId: string; response: string; studentId?: string; actorId?: string }
  | { type: "quiz.submit"; quizId: string; answers: Record<string, string>; studentId?: string; actorId?: string };

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
  const lesson = state.lessons.find((item) => item.id === lessonId) ?? state.lessons[0];
  if (!lesson) throw new Error("No lesson is available in the platform state.");
  return lesson;
}

function requireAssignment(state: PlatformState, assignmentId: string) {
  const assignment = state.assignments.find((item) => item.id === assignmentId) ?? state.assignments[0];
  if (!assignment) throw new Error("No assignment is available in the platform state.");
  return assignment;
}

function requireQuiz(state: PlatformState, quizId: string) {
  const quiz = state.quizzes.find((item) => item.id === quizId) ?? state.quizzes[0];
  if (!quiz) throw new Error("No quiz is available in the platform state.");
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
