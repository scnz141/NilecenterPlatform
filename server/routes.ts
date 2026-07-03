import express, { type Express, type Request } from "express";
import { attachSession, endRequestSession, getRequestSession, isServerRole, signIn } from "./auth.js";
import { loadServerEnv } from "./env.js";
import { getPlatformBackendState, savePlatformBackendRecord } from "./platformRecords.js";
import { applyPlatformLearningAction, getPlatformStateSnapshot, parsePlatformLearningAction } from "./platformState.js";
import { getSupabaseServerStatus } from "./supabase.js";

const certificateVerifyAttempts = new Map<string, { count: number; resetAt: number }>();
const certificateVerifyWindowMs = 10 * 60 * 1000;
const certificateVerifyLimit = 40;
const certificateCodePattern = /^[a-z0-9][a-z0-9-]{5,63}$/i;

function certificateVerifyClientKey(req: Request) {
  const forwarded = req.get("x-forwarded-for") ?? req.ip ?? "local";
  return forwarded.split(",")[0]?.trim() || "local";
}

function consumeCertificateVerifyAttempt(req: Request) {
  const now = Date.now();
  const key = certificateVerifyClientKey(req);
  const bucket = certificateVerifyAttempts.get(key);
  if (!bucket || bucket.resetAt <= now) {
    certificateVerifyAttempts.set(key, { count: 1, resetAt: now + certificateVerifyWindowMs });
    return true;
  }
  if (bucket.count >= certificateVerifyLimit) return false;
  bucket.count += 1;
  return true;
}

export function registerApiRoutes(app: Express) {
  loadServerEnv();
  app.use(express.json());
  app.use("/api", (req, res, next) => {
    if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
      next();
      return;
    }
    if (req.get("X-Nile-Learn-Request") === "browser") {
      next();
      return;
    }
    res.status(403).json({ error: "Missing first-party request header." });
  });

  app.get("/api/integrations/supabase/status", (req, res) => {
    const session = getRequestSession(req);
    const status = getSupabaseServerStatus();
    if (!session || session.activeRole !== "superadmin") {
      res.json({
        urlConfigured: status.urlConfigured,
        publishableKeyConfigured: status.publishableKeyConfigured,
      });
      return;
    }
    res.json(status);
  });

  app.post("/api/auth/login", async (req, res) => {
    const { email, password, role } = req.body ?? {};
    if (typeof email !== "string" || typeof password !== "string" || !isServerRole(role)) {
      res.status(400).json({ error: "Email, password, and role are required." });
      return;
    }

    try {
      const session = await signIn(email, password, role);
      res.json(attachSession(res, session));
    } catch (error) {
      res.status(401).json({ error: error instanceof Error ? error.message : "Sign in failed." });
    }
  });

  app.get("/api/auth/session", (req, res) => {
    const session = getRequestSession(req);
    if (!session) {
      res.json(null);
      return;
    }
    res.json({
      userId: session.userId,
      email: session.email,
      name: session.name,
      roles: session.roles,
      activeRole: session.activeRole,
      provider: session.provider,
      expiresAt: session.expiresAt,
    });
  });

  app.post("/api/auth/logout", (req, res) => {
    endRequestSession(req, res);
    res.json({ ok: true });
  });

  app.get("/api/platform/records", (req, res) => {
    const session = getRequestSession(req);
    if (!session || !["registrar", "branchadmin", "superadmin"].includes(session.activeRole)) {
      res.status(403).json({ error: "Records access is restricted." });
      return;
    }
    res.json(getPlatformBackendState());
  });

  app.get("/api/platform/state", async (req, res) => {
    const session = getRequestSession(req);
    if (!session) {
      res.status(401).json({ error: "Sign in required." });
      return;
    }

    const snapshot = await getPlatformStateSnapshot();
    res.json({
      ...snapshot,
      state: scopePlatformStateForSession(snapshot.state, session),
    });
  });

  app.get("/api/certificates/verify", async (req, res) => {
    const code = typeof req.query.code === "string" ? req.query.code.trim().toLowerCase() : "";
    if (!code) {
      res.status(400).json({ valid: false, error: "Certificate code is required." });
      return;
    }
    if (!consumeCertificateVerifyAttempt(req)) {
      res.status(429).json({ valid: false, error: "Too many certificate checks. Try again later." });
      return;
    }
    if (!certificateCodePattern.test(code)) {
      res.status(400).json({ valid: false, error: "Use the certificate code printed on the issued certificate." });
      return;
    }

    const snapshot = await getPlatformStateSnapshot();
    const certificate = snapshot.state.certificates.find(
      (item) => item.status === "issued" && item.verificationCode.toLowerCase() === code,
    );
    if (!certificate) {
      res.json({ valid: false });
      return;
    }

    const student = snapshot.state.students.find((item) => item.id === certificate.studentId);
    const user = snapshot.state.users.find((item) => item.id === student?.userId);
    const course = snapshot.state.courses.find((item) => item.id === certificate.courseId);
    res.json({
      valid: true,
      certificate: {
        verificationCode: certificate.verificationCode,
        studentName: user?.name ?? "Nile Learn student",
        courseTitle: course?.title ?? "Nile Learn course",
        status: "issued",
        issuedAt: certificate.issuedAt,
      },
    });
  });

  app.post("/api/platform/state/actions", async (req, res) => {
    const session = getRequestSession(req);
    if (!session) {
      res.status(401).json({ error: "Sign in required." });
      return;
    }

    const action = parsePlatformLearningAction(req.body);
    if (!action) {
      res.status(400).json({ error: "Valid platform learning action is required." });
      return;
    }

    try {
      const actionResult = await applyPlatformLearningAction(action, session);
      res.json({
        ...actionResult,
        state: scopePlatformStateForSession(actionResult.state, session),
      });
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : "Platform action failed." });
    }
  });

  app.post("/api/platform/records", async (req, res) => {
    const { type, payload } = req.body ?? {};
    if (!["lead", "placement", "operational"].includes(type) || !payload || typeof payload !== "object") {
      res.status(400).json({ error: "Valid record type and payload are required." });
      return;
    }
    const session = getRequestSession(req);
    if (type === "operational") {
      if (!session) {
        res.status(401).json({ error: "Sign in required for operational records." });
        return;
      }
      if (!["registrar", "headofdepartment", "branchadmin", "superadmin"].includes(session.activeRole)) {
        res.status(403).json({ error: "Operational records are restricted." });
        return;
      }
    }
    const record = await savePlatformBackendRecord(type, payload, session?.userId);
    res.status(201).json(record);
  });
}

type PlatformStatePayload = Awaited<ReturnType<typeof getPlatformStateSnapshot>>["state"];

function quizQuestionPreviewsForRuns(state: PlatformStatePayload, courseRunIds: Set<string>) {
  return state.quizzes
    .filter((quiz) => courseRunIds.has(quiz.courseRunId))
    .flatMap((quiz) =>
      quiz.questionIds.flatMap((questionId) => {
        const question = state.questionBankItems.find(
          (item) => item.id === questionId && item.courseRunId === quiz.courseRunId && item.status === "active",
        );
        if (!question) return [];
        return [{
          id: question.id,
          quizId: quiz.id,
          courseRunId: question.courseRunId,
          prompt: question.prompt,
          type: question.type,
          difficulty: question.difficulty,
          tags: question.tags,
          choices: question.choices,
          status: question.status,
        }];
      }),
    );
}

function scopedAuditRows(
  state: PlatformStatePayload,
  classGroupIds: Set<string>,
  eventIds: Set<string>,
  certificateIds = new Set<string>(),
  actorId?: string,
) {
  const courseRunIds = new Set(
    state.classGroups
      .filter((group) => classGroupIds.has(group.id))
      .map((group) => group.courseRunId),
  );
  const assignmentIds = new Set(
    state.assignments
      .filter((assignment) => courseRunIds.has(assignment.courseRunId))
      .map((assignment) => assignment.id),
  );
  const quizIds = new Set(
    state.quizzes
      .filter((quiz) => courseRunIds.has(quiz.courseRunId))
      .map((quiz) => quiz.id),
  );
  const questionIds = new Set(
    state.questionBankItems
      .filter((question) => courseRunIds.has(question.courseRunId))
      .map((question) => question.id),
  );
  const submissionIds = new Set(
    state.assignmentSubmissions
      .filter((submission) => assignmentIds.has(submission.assignmentId))
      .map((submission) => submission.id),
  );
  const attemptIds = new Set(
    state.quizAttempts
      .filter((attempt) => quizIds.has(attempt.quizId))
      .map((attempt) => attempt.id),
  );
  return state.auditLogs.filter((item) => {
    if (item.action === "attendance.saved" && item.entityType === "AttendanceRecord") {
      return classGroupIds.has(item.entityId);
    }
    if (item.entityType === "Assignment") {
      return assignmentIds.has(item.entityId);
    }
    if (item.entityType === "AssignmentSubmission") {
      return submissionIds.has(item.entityId);
    }
    if (item.entityType === "Quiz") {
      return quizIds.has(item.entityId);
    }
    if (item.entityType === "QuizAttempt") {
      return attemptIds.has(item.entityId);
    }
    if (item.entityType === "QuestionBankItem") {
      return questionIds.has(item.entityId);
    }
    if (
      (item.action === "calendar.created" || item.action === "calendar.created_with_conflict") &&
      item.entityType === "CalendarEvent"
    ) {
      return eventIds.has(item.entityId);
    }
    if (
      (item.action === "certificate.approved" || item.action === "certificate.issued") &&
      item.entityType === "Certificate"
    ) {
      return certificateIds.has(item.entityId);
    }
    if (item.entityType === "ReportPreset" && actorId) {
      return item.actorId === actorId;
    }
    return false;
  });
}

function registrarAuditRows(state: PlatformStatePayload, branchIds: Set<string>, eventIds: Set<string>, actorId?: string) {
  const leadIds = new Set(state.leads.map((item) => item.id));
  const applicationIds = new Set(
    state.applications
      .filter((item) => leadIds.has(item.leadId) && (item.branchId ? branchIds.has(item.branchId) : true))
      .map((item) => item.id),
  );
  const placementIds = new Set(
    state.placementTests
      .filter((item) => (item.branchId ? branchIds.has(item.branchId) : true))
      .map((item) => item.id),
  );
  const placementResultIds = new Set(
    state.placementResults
      .filter((item) => placementIds.has(item.bookingId))
      .map((item) => item.id),
  );
  const workflowIds = new Set(
    state.enrollmentWorkflows
      .filter((item) => {
        const run = state.courseRuns.find((courseRun) => courseRun.courseId === item.targetCourseId && courseRun.status === "active") ??
          state.courseRuns.find((courseRun) => courseRun.courseId === item.targetCourseId);
        return run ? branchIds.has(run.branchId) : true;
      })
      .map((item) => item.id),
  );
  const invoiceIds = new Set(
    state.invoices
      .filter((invoice) =>
        branchIds.has(
          state.users.find((userItem) => userItem.id === state.students.find((studentItem) => studentItem.id === invoice.studentId)?.userId)
            ?.branchId ?? "",
        ),
      )
      .map((item) => item.id),
  );
  const paymentIds = new Set(
    state.payments
      .filter((payment) => invoiceIds.has(payment.invoiceId))
      .map((item) => item.id),
  );
  const admissionsRows = state.auditLogs.filter((item) => {
    if (item.entityType === "Lead") return leadIds.has(item.entityId);
    if (item.entityType === "Application") return applicationIds.has(item.entityId);
    if (item.entityType === "PlacementTestBooking") return placementIds.has(item.entityId);
    if (item.entityType === "PlacementTestResult") return placementResultIds.has(item.entityId) || placementIds.has(item.entityId);
    if (item.entityType === "EnrollmentWorkflow") return workflowIds.has(item.entityId);
    if (item.entityType === "Invoice") return invoiceIds.has(item.entityId);
    if (item.entityType === "Payment") return paymentIds.has(item.entityId) || invoiceIds.has(item.entityId);
    if (item.entityType === "ReportPreset" && actorId) return item.actorId === actorId;
    return false;
  });
  const scopedRows = scopedAuditRows(state, new Set(), eventIds);
  return [...admissionsRows, ...scopedRows]
    .filter((item, index, rows) => rows.findIndex((row) => row.id === item.id) === index)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function branchIdsForUserScope(state: PlatformStatePayload, user?: PlatformStatePayload["users"][number]) {
  const branchIds = new Set<string>();
  if (user?.branchId) branchIds.add(user.branchId);
  const department = state.departments.find((item) => item.id === user?.departmentId);
  department?.branchIds.forEach((branchId) => branchIds.add(branchId));
  return branchIds;
}

function reportPresetsForSession(state: PlatformStatePayload, session: NonNullable<ReturnType<typeof getRequestSession>>) {
  return (state.reportPresets ?? []).filter((item) => item.ownerUserId === session.userId && item.role === session.activeRole);
}

function safeUnmappedRoleState(state: PlatformStatePayload, session: NonNullable<ReturnType<typeof getRequestSession>>) {
  return {
    ...state,
    users: state.users.filter((item) => item.id === session.userId),
    students: [],
    teachers: [],
    courseRuns: [],
    classGroups: [],
    classSessions: [],
    enrollments: [],
    lessonProgress: [],
    assignments: [],
    assignmentSubmissions: [],
    quizzes: [],
    questionBankItems: [],
    quizQuestionPreviews: [],
    quizAttempts: [],
    grades: [],
    attendance: [],
    events: state.events.filter((item) => item.ownerId === session.userId),
    teacherAvailability: [],
    rooms: [],
    branches: [],
    certificates: [],
    quranPlans: [],
    quranProgress: [],
    recitationSubmissions: [],
    leads: [],
    applications: [],
    placementTests: [],
    placementResults: [],
    enrollmentWorkflows: [],
    invoices: [],
    payments: [],
    messages: state.messages.filter((item) => item.fromUserId === session.userId || item.toUserId === session.userId),
    communicationLogs: state.communicationLogs.filter((item) => item.actorId === session.userId || item.relatedUserId === session.userId),
    documents: state.documents.filter((item) => item.ownerId === session.userId),
    notifications: state.notifications.filter((item) => item.userId === session.userId),
    supportTickets: state.supportTickets.filter((item) => item.requesterId === session.userId),
    reportPresets: reportPresetsForSession(state, session),
    auditLogs: [],
  };
}

function scopePlatformStateForSession(state: PlatformStatePayload, session: NonNullable<ReturnType<typeof getRequestSession>>) {
  if (session.activeRole === "superadmin") return { ...state, reportPresets: reportPresetsForSession(state, session) };

  const user = state.users.find((item) => item.id === session.userId);
  const branchId = user?.branchId;
  const student = state.students.find((item) => item.userId === session.userId);
  const teacher = state.teachers.find((item) => item.userId === session.userId);

  if (session.activeRole === "student" && student) {
    const courseRunIds = new Set(state.enrollments.filter((item) => item.studentId === student.id).map((item) => item.courseRunId));
    const courseIds = new Set(state.courseRuns.filter((item) => courseRunIds.has(item.id)).map((item) => item.courseId));
    const classGroupIds = new Set(state.classGroups.filter((item) => courseRunIds.has(item.courseRunId)).map((item) => item.id));
    const lessonIds = new Set(
      state.lessons.filter((lesson) => state.modules.some((module) => module.id === lesson.moduleId && courseIds.has(module.courseId))).map((item) => item.id),
    );
    return {
      ...state,
      users: state.users.filter((item) => item.id === session.userId || item.roles.includes("teacher")),
      students: [student],
      teachers: state.teachers.filter((item) => state.courseRuns.some((run) => run.teacherId === item.userId && courseRunIds.has(run.id))),
      enrollments: state.enrollments.filter((item) => item.studentId === student.id),
      lessonProgress: state.lessonProgress.filter((item) => item.studentId === student.id),
      assignmentSubmissions: state.assignmentSubmissions.filter((item) => item.studentId === student.id),
      quizAttempts: state.quizAttempts.filter((item) => item.studentId === student.id),
      questionBankItems: [],
      quizQuestionPreviews: quizQuestionPreviewsForRuns(state, courseRunIds),
      grades: state.grades.filter((item) => item.studentId === student.id),
      attendance: state.attendance.filter((item) => item.studentId === student.id),
      certificates: state.certificates.filter((item) => item.studentId === student.id),
      quranPlans: state.quranPlans.filter((item) => item.studentId === student.id),
      quranProgress: state.quranProgress.filter((item) => item.studentId === student.id),
      recitationSubmissions: state.recitationSubmissions.filter((item) => item.studentId === student.id),
      invoices: state.invoices.filter((item) => item.studentId === student.id),
      payments: state.payments.filter((item) => state.invoices.some((invoice) => invoice.id === item.invoiceId && invoice.studentId === student.id)),
      messages: state.messages.filter((item) => item.fromUserId === session.userId || item.toUserId === session.userId),
      notifications: state.notifications.filter((item) => item.userId === session.userId),
      supportTickets: state.supportTickets.filter((item) => item.requesterId === session.userId),
      leads: [],
      applications: [],
      placementTests: [],
      placementResults: [],
      enrollmentWorkflows: state.enrollmentWorkflows.filter((item) => item.studentId === student.id),
      auditLogs: [],
      courseRuns: state.courseRuns.filter((item) => courseRunIds.has(item.id)),
      classGroups: state.classGroups.filter((item) => classGroupIds.has(item.id)),
      classSessions: state.classSessions.filter((item) => classGroupIds.has(item.classGroupId)),
      events: state.events.filter((item) => (item.classGroupId ? classGroupIds.has(item.classGroupId) : item.ownerId === session.userId)),
      rooms: [],
      branches: state.branches.filter((item) => state.courseRuns.some((run) => courseRunIds.has(run.id) && run.branchId === item.id)),
      teacherAvailability: [],
      lessons: state.lessons.filter((item) => lessonIds.has(item.id)),
      documents: state.documents.filter((item) => item.ownerId === student.id || item.ownerId === session.userId),
      reportPresets: reportPresetsForSession(state, session),
    };
  }

  if (session.activeRole === "teacher" && teacher) {
    const courseRunIds = new Set(state.courseRuns.filter((item) => item.teacherId === session.userId).map((item) => item.id));
    const classGroupIds = new Set(state.classGroups.filter((item) => courseRunIds.has(item.courseRunId)).map((item) => item.id));
    const studentIds = new Set(state.enrollments.filter((item) => courseRunIds.has(item.courseRunId)).map((item) => item.studentId));
    const userIds = new Set([session.userId, ...state.students.filter((item) => studentIds.has(item.id)).map((item) => item.userId)]);
    const eventIds = new Set(state.events.filter((item) => item.ownerId === session.userId || (item.classGroupId ? classGroupIds.has(item.classGroupId) : false)).map((item) => item.id));
    return {
      ...state,
      users: state.users.filter((item) => userIds.has(item.id)),
      students: state.students.filter((item) => studentIds.has(item.id)),
      teachers: [teacher],
      courseRuns: state.courseRuns.filter((item) => courseRunIds.has(item.id)),
      classGroups: state.classGroups.filter((item) => classGroupIds.has(item.id)),
      classSessions: state.classSessions.filter((item) => classGroupIds.has(item.classGroupId)),
      branches: state.branches.filter((item) => state.courseRuns.some((run) => courseRunIds.has(run.id) && run.branchId === item.id)),
      rooms: state.rooms.filter((item) => state.courseRuns.some((run) => courseRunIds.has(run.id) && run.branchId === item.branchId)),
      teacherAvailability: state.teacherAvailability.filter((item) => item.teacherId === session.userId && state.courseRuns.some((run) => courseRunIds.has(run.id) && run.branchId === item.branchId)),
      enrollments: state.enrollments.filter((item) => courseRunIds.has(item.courseRunId)),
      assignments: state.assignments.filter((item) => courseRunIds.has(item.courseRunId)),
      assignmentSubmissions: state.assignmentSubmissions.filter((item) => state.assignments.some((assignment) => assignment.id === item.assignmentId && courseRunIds.has(assignment.courseRunId))),
      quizzes: state.quizzes.filter((item) => courseRunIds.has(item.courseRunId)),
      questionBankItems: state.questionBankItems.filter((item) => courseRunIds.has(item.courseRunId)),
      quizQuestionPreviews: [],
      quizAttempts: state.quizAttempts.filter((item) => state.quizzes.some((quiz) => quiz.id === item.quizId && courseRunIds.has(quiz.courseRunId))),
      grades: state.grades.filter((item) => studentIds.has(item.studentId)),
      attendance: state.attendance.filter((item) => classGroupIds.has(item.classGroupId) && studentIds.has(item.studentId)),
      events: state.events.filter((item) => item.ownerId === session.userId || (item.classGroupId ? classGroupIds.has(item.classGroupId) : false)),
      messages: state.messages.filter((item) => item.fromUserId === session.userId || item.toUserId === session.userId),
      notifications: state.notifications.filter((item) => item.userId === session.userId),
      quranPlans: state.quranPlans.filter((item) => studentIds.has(item.studentId)),
      quranProgress: state.quranProgress.filter((item) => studentIds.has(item.studentId)),
      recitationSubmissions: state.recitationSubmissions.filter((item) => item.teacherId === session.userId || studentIds.has(item.studentId)),
      leads: [],
      applications: [],
      placementTests: [],
      placementResults: [],
      enrollmentWorkflows: [],
      invoices: [],
      payments: [],
      supportTickets: [],
      documents: state.documents.filter((item) => item.ownerId === session.userId),
      certificates: [],
      reportPresets: reportPresetsForSession(state, session),
      auditLogs: scopedAuditRows(state, classGroupIds, eventIds, new Set(), session.userId),
    };
  }

  if (session.activeRole === "branchadmin" && branchId) {
    const courseRunIds = new Set(state.courseRuns.filter((item) => item.branchId === branchId).map((item) => item.id));
    const classGroupIds = new Set(state.classGroups.filter((item) => courseRunIds.has(item.courseRunId)).map((item) => item.id));
    const studentIds = new Set(state.enrollments.filter((item) => courseRunIds.has(item.courseRunId)).map((item) => item.studentId));
    const invoiceIds = new Set(state.invoices.filter((item) => studentIds.has(item.studentId)).map((item) => item.id));
    const eventIds = new Set(state.events.filter((item) => item.branchId === branchId || (item.classGroupId ? classGroupIds.has(item.classGroupId) : false)).map((item) => item.id));
    return {
      ...state,
      users: state.users.filter((item) => item.branchId === branchId || item.id === session.userId),
      students: state.students.filter((item) => studentIds.has(item.id)),
      teachers: state.teachers.filter((item) => state.users.some((userItem) => userItem.id === item.userId && userItem.branchId === branchId)),
      branches: state.branches.filter((item) => item.id === branchId),
      rooms: state.rooms.filter((item) => item.branchId === branchId),
      teacherAvailability: state.teacherAvailability.filter((item) => item.branchId === branchId),
      courseRuns: state.courseRuns.filter((item) => item.branchId === branchId),
      classGroups: state.classGroups.filter((item) => classGroupIds.has(item.id)),
      classSessions: state.classSessions.filter((item) => classGroupIds.has(item.classGroupId)),
      enrollments: state.enrollments.filter((item) => courseRunIds.has(item.courseRunId)),
      attendance: state.attendance.filter((item) => classGroupIds.has(item.classGroupId) && studentIds.has(item.studentId)),
      events: state.events.filter((item) => item.branchId === branchId || (item.classGroupId ? classGroupIds.has(item.classGroupId) : false)),
      assignments: state.assignments.filter((item) => courseRunIds.has(item.courseRunId)),
      assignmentSubmissions: state.assignmentSubmissions.filter((item) => studentIds.has(item.studentId)),
      quizzes: state.quizzes.filter((item) => courseRunIds.has(item.courseRunId)),
      questionBankItems: state.questionBankItems.filter((item) => courseRunIds.has(item.courseRunId)),
      quizQuestionPreviews: [],
      quizAttempts: state.quizAttempts.filter((item) => studentIds.has(item.studentId)),
      grades: state.grades.filter((item) => studentIds.has(item.studentId)),
      certificates: [],
      quranPlans: state.quranPlans.filter((item) => studentIds.has(item.studentId)),
      quranProgress: state.quranProgress.filter((item) => studentIds.has(item.studentId)),
      recitationSubmissions: state.recitationSubmissions.filter((item) => studentIds.has(item.studentId)),
      invoices: state.invoices.filter((item) => studentIds.has(item.studentId)),
      payments: state.payments.filter((item) => invoiceIds.has(item.invoiceId)),
      messages: state.messages.filter((item) => item.fromUserId === session.userId || item.toUserId === session.userId),
      communicationLogs: state.communicationLogs.filter((item) => item.actorId === session.userId || item.relatedUserId === session.userId),
      notifications: state.notifications.filter((item) => item.userId === session.userId),
      leads: [],
      applications: [],
      placementTests: [],
      placementResults: [],
      enrollmentWorkflows: state.enrollmentWorkflows.filter((item) => item.studentId ? studentIds.has(item.studentId) : false),
      supportTickets: state.supportTickets.filter((item) => item.requesterId === session.userId),
      documents: state.documents.filter((item) => item.ownerId === session.userId),
      reportPresets: reportPresetsForSession(state, session),
      auditLogs: scopedAuditRows(state, classGroupIds, eventIds, new Set(), session.userId),
    };
  }

  if (session.activeRole === "registrar") {
    const branchIds = branchIdsForUserScope(state, user);
    if (!branchIds.size) return safeUnmappedRoleState(state, session);
    const courseRunIds = new Set(state.courseRuns.filter((item) => branchIds.has(item.branchId)).map((item) => item.id));
    const studentIds = new Set(state.students.filter((item) => branchIds.has(state.users.find((userItem) => userItem.id === item.userId)?.branchId ?? "")).map((item) => item.id));
    const invoiceIds = new Set(state.invoices.filter((item) => studentIds.has(item.studentId)).map((item) => item.id));
    const registrarEventTypes = new Set(["placement_test", "trial_lesson", "room_booking", "reminder"]);
    const eventIds = new Set(
      state.events
        .filter(
          (item) =>
            registrarEventTypes.has(item.type) &&
            (item.ownerId === session.userId || (item.branchId ? branchIds.has(item.branchId) : false)),
        )
        .map((item) => item.id),
    );
    const placementIds = new Set(state.placementTests.filter((item) => item.branchId ? branchIds.has(item.branchId) : true).map((item) => item.id));
    const leadIds = new Set(state.leads.map((item) => item.id));
    return {
      ...state,
      users: state.users.filter((item) => item.id === session.userId || (item.branchId ? branchIds.has(item.branchId) : false)),
      students: state.students.filter((item) => studentIds.has(item.id)),
      teachers: state.teachers.filter((item) => branchIds.has(state.users.find((userItem) => userItem.id === item.userId)?.branchId ?? "")),
      branches: state.branches.filter((item) => branchIds.has(item.id)),
      rooms: state.rooms.filter((item) => branchIds.has(item.branchId)),
      teacherAvailability: [],
      courseRuns: state.courseRuns.filter((item) => courseRunIds.has(item.id)),
      classGroups: [],
      classSessions: [],
      enrollments: state.enrollments.filter((item) => courseRunIds.has(item.courseRunId) && studentIds.has(item.studentId)),
      attendance: [],
      events: state.events.filter((item) => eventIds.has(item.id)),
      assignments: [],
      assignmentSubmissions: [],
      quizzes: [],
      questionBankItems: [],
      quizQuestionPreviews: [],
      quizAttempts: [],
      grades: [],
      certificates: [],
      quranPlans: [],
      quranProgress: [],
      recitationSubmissions: [],
      invoices: state.invoices.filter((item) => invoiceIds.has(item.id)),
      payments: state.payments.filter((item) => invoiceIds.has(item.invoiceId)),
      auditLogs: registrarAuditRows(state, branchIds, eventIds, session.userId),
      messages: state.messages.filter((item) => item.fromUserId === session.userId || item.toUserId === session.userId),
      communicationLogs: state.communicationLogs.filter((item) => item.actorId === session.userId || item.relatedUserId === session.userId),
      notifications: state.notifications.filter((item) => item.userId === session.userId),
      leads: state.leads,
      applications: state.applications.filter((item) => leadIds.has(item.leadId) && (item.branchId ? branchIds.has(item.branchId) : true)),
      placementTests: state.placementTests.filter((item) => placementIds.has(item.id)),
      placementResults: state.placementResults.filter((item) => placementIds.has(item.bookingId)),
      enrollmentWorkflows: state.enrollmentWorkflows.filter((item) => item.studentId ? studentIds.has(item.studentId) : true),
      supportTickets: [],
      documents: state.documents.filter((item) => item.ownerId === session.userId),
      reportPresets: reportPresetsForSession(state, session),
    };
  }

  if (session.activeRole === "headofdepartment") {
    const departmentIds = new Set(state.departments.filter((item) => item.ownerUserId === session.userId || item.id === user?.departmentId).map((item) => item.id));
    const programIds = new Set(state.programs.filter((item) => departmentIds.has(item.departmentId)).map((item) => item.id));
    const courseIds = new Set(state.courses.filter((item) => programIds.has(item.programId)).map((item) => item.id));
    const courseRunIds = new Set(state.courseRuns.filter((item) => courseIds.has(item.courseId)).map((item) => item.id));
    const classGroupIds = new Set(state.classGroups.filter((item) => courseRunIds.has(item.courseRunId)).map((item) => item.id));
    const studentIds = new Set(state.enrollments.filter((item) => courseRunIds.has(item.courseRunId)).map((item) => item.studentId));
    const eventIds = new Set(state.events.filter((item) => item.classGroupId ? classGroupIds.has(item.classGroupId) : item.ownerId === session.userId).map((item) => item.id));
    const certificateIds = new Set(state.certificates.filter((item) => courseIds.has(item.courseId)).map((item) => item.id));
    return {
      ...state,
      users: state.users.filter(
        (item) => item.id === session.userId || (item.departmentId ? departmentIds.has(item.departmentId) : false) || studentIds.has(state.students.find((studentItem) => studentItem.userId === item.id)?.id ?? ""),
      ),
      departments: state.departments.filter((item) => departmentIds.has(item.id)),
      programs: state.programs.filter((item) => programIds.has(item.id)),
      levels: state.levels.filter((item) => programIds.has(item.programId)),
      courses: state.courses.filter((item) => courseIds.has(item.id)),
      modules: state.modules.filter((item) => courseIds.has(item.courseId)),
      lessons: state.lessons.filter((item) => state.modules.some((module) => module.id === item.moduleId && courseIds.has(module.courseId))),
      resources: state.resources.filter((item) => state.lessons.some((lesson) => lesson.id === item.lessonId && state.modules.some((module) => module.id === lesson.moduleId && courseIds.has(module.courseId)))),
      teachers: state.teachers.filter((item) => item.departmentId && departmentIds.has(item.departmentId)),
      students: state.students.filter((item) => studentIds.has(item.id)),
      courseRuns: state.courseRuns.filter((item) => courseRunIds.has(item.id)),
      classGroups: state.classGroups.filter((item) => classGroupIds.has(item.id)),
      classSessions: state.classSessions.filter((item) => classGroupIds.has(item.classGroupId)),
      branches: state.branches.filter((item) => state.courseRuns.some((run) => courseRunIds.has(run.id) && run.branchId === item.id)),
      rooms: state.rooms.filter((item) => state.courseRuns.some((run) => courseRunIds.has(run.id) && run.branchId === item.branchId)),
      teacherAvailability: state.teacherAvailability.filter((item) => state.courseRuns.some((run) => courseRunIds.has(run.id) && run.teacherId === item.teacherId && run.branchId === item.branchId)),
      enrollments: state.enrollments.filter((item) => courseRunIds.has(item.courseRunId)),
      assignments: state.assignments.filter((item) => courseRunIds.has(item.courseRunId)),
      assignmentSubmissions: state.assignmentSubmissions.filter((item) => studentIds.has(item.studentId)),
      quizzes: state.quizzes.filter((item) => courseRunIds.has(item.courseRunId)),
      questionBankItems: state.questionBankItems.filter((item) => courseRunIds.has(item.courseRunId)),
      quizQuestionPreviews: [],
      quizAttempts: state.quizAttempts.filter((item) => studentIds.has(item.studentId)),
      grades: state.grades.filter((item) => studentIds.has(item.studentId)),
      attendance: state.attendance.filter((item) => classGroupIds.has(item.classGroupId) && studentIds.has(item.studentId)),
      events: state.events.filter((item) => item.classGroupId ? classGroupIds.has(item.classGroupId) : item.ownerId === session.userId),
      certificates: state.certificates.filter((item) => courseIds.has(item.courseId)),
      quranPlans: state.quranPlans.filter((item) => studentIds.has(item.studentId)),
      quranProgress: state.quranProgress.filter((item) => studentIds.has(item.studentId)),
      recitationSubmissions: state.recitationSubmissions.filter((item) => studentIds.has(item.studentId)),
      invoices: [],
      payments: [],
      auditLogs: scopedAuditRows(state, classGroupIds, eventIds, certificateIds, session.userId),
      messages: state.messages.filter((item) => item.fromUserId === session.userId || item.toUserId === session.userId),
      communicationLogs: state.communicationLogs.filter((item) => item.actorId === session.userId || item.relatedUserId === session.userId),
      notifications: state.notifications.filter((item) => item.userId === session.userId),
      supportTickets: state.supportTickets.filter((item) => item.requesterId === session.userId),
      leads: [],
      applications: [],
      placementTests: [],
      placementResults: [],
      enrollmentWorkflows: state.enrollmentWorkflows.filter((item) => item.studentId ? studentIds.has(item.studentId) : false),
      documents: state.documents.filter((item) => item.ownerId === session.userId || studentIds.has(item.ownerId)),
      reportPresets: reportPresetsForSession(state, session),
    };
  }

  return safeUnmappedRoleState(state, session);
}
