import express, { type Express } from "express";
import { attachSession, endRequestSession, getRequestSession, isServerRole, signIn } from "./auth";
import { loadServerEnv } from "./env";
import { getPlatformBackendState, savePlatformBackendRecord } from "./platformRecords";
import { applyPlatformLearningAction, getPlatformStateSnapshot, parsePlatformLearningAction } from "./platformState";
import { getSupabaseServerStatus } from "./supabase";

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

function scopePlatformStateForSession(state: PlatformStatePayload, session: NonNullable<ReturnType<typeof getRequestSession>>) {
  if (session.activeRole === "superadmin") return state;

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
      grades: state.grades.filter((item) => item.studentId === student.id),
      attendance: state.attendance.filter((item) => item.studentId === student.id),
      certificates: state.certificates.filter((item) => item.studentId === student.id),
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
      events: state.events.filter((item) => !item.classGroupId || classGroupIds.has(item.classGroupId) || item.ownerId === session.userId),
      lessons: state.lessons.filter((item) => lessonIds.has(item.id)),
    };
  }

  if (session.activeRole === "teacher" && teacher) {
    const courseRunIds = new Set(state.courseRuns.filter((item) => item.teacherId === session.userId).map((item) => item.id));
    const classGroupIds = new Set(state.classGroups.filter((item) => courseRunIds.has(item.courseRunId)).map((item) => item.id));
    const studentIds = new Set(state.enrollments.filter((item) => courseRunIds.has(item.courseRunId)).map((item) => item.studentId));
    const userIds = new Set([session.userId, ...state.students.filter((item) => studentIds.has(item.id)).map((item) => item.userId)]);
    return {
      ...state,
      users: state.users.filter((item) => userIds.has(item.id)),
      students: state.students.filter((item) => studentIds.has(item.id)),
      teachers: [teacher],
      courseRuns: state.courseRuns.filter((item) => courseRunIds.has(item.id)),
      classGroups: state.classGroups.filter((item) => classGroupIds.has(item.id)),
      classSessions: state.classSessions.filter((item) => classGroupIds.has(item.classGroupId)),
      enrollments: state.enrollments.filter((item) => courseRunIds.has(item.courseRunId)),
      assignments: state.assignments.filter((item) => courseRunIds.has(item.courseRunId)),
      assignmentSubmissions: state.assignmentSubmissions.filter((item) => state.assignments.some((assignment) => assignment.id === item.assignmentId && courseRunIds.has(assignment.courseRunId))),
      quizzes: state.quizzes.filter((item) => courseRunIds.has(item.courseRunId)),
      quizAttempts: state.quizAttempts.filter((item) => state.quizzes.some((quiz) => quiz.id === item.quizId && courseRunIds.has(quiz.courseRunId))),
      grades: state.grades.filter((item) => studentIds.has(item.studentId)),
      attendance: state.attendance.filter((item) => studentIds.has(item.studentId)),
      events: state.events.filter((item) => item.ownerId === session.userId || (item.classGroupId ? classGroupIds.has(item.classGroupId) : false)),
      messages: state.messages.filter((item) => item.fromUserId === session.userId || item.toUserId === session.userId),
      notifications: state.notifications.filter((item) => item.userId === session.userId),
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
      auditLogs: [],
    };
  }

  if (session.activeRole === "branchadmin" && branchId) {
    const courseRunIds = new Set(state.courseRuns.filter((item) => item.branchId === branchId).map((item) => item.id));
    const classGroupIds = new Set(state.classGroups.filter((item) => courseRunIds.has(item.courseRunId)).map((item) => item.id));
    const studentIds = new Set(state.enrollments.filter((item) => courseRunIds.has(item.courseRunId)).map((item) => item.studentId));
    const invoiceIds = new Set(state.invoices.filter((item) => studentIds.has(item.studentId)).map((item) => item.id));
    return {
      ...state,
      users: state.users.filter((item) => item.branchId === branchId || item.id === session.userId),
      students: state.students.filter((item) => studentIds.has(item.id)),
      teachers: state.teachers.filter((item) => state.users.some((userItem) => userItem.id === item.userId && userItem.branchId === branchId)),
      branches: state.branches.filter((item) => item.id === branchId),
      rooms: state.rooms.filter((item) => item.branchId === branchId),
      courseRuns: state.courseRuns.filter((item) => item.branchId === branchId),
      classGroups: state.classGroups.filter((item) => classGroupIds.has(item.id)),
      classSessions: state.classSessions.filter((item) => classGroupIds.has(item.classGroupId)),
      enrollments: state.enrollments.filter((item) => courseRunIds.has(item.courseRunId)),
      attendance: state.attendance.filter((item) => studentIds.has(item.studentId)),
      events: state.events.filter((item) => item.branchId === branchId || (item.classGroupId ? classGroupIds.has(item.classGroupId) : false)),
      assignments: state.assignments.filter((item) => courseRunIds.has(item.courseRunId)),
      assignmentSubmissions: state.assignmentSubmissions.filter((item) => studentIds.has(item.studentId)),
      quizzes: state.quizzes.filter((item) => courseRunIds.has(item.courseRunId)),
      quizAttempts: state.quizAttempts.filter((item) => studentIds.has(item.studentId)),
      grades: state.grades.filter((item) => studentIds.has(item.studentId)),
      certificates: state.certificates.filter((item) => studentIds.has(item.studentId)),
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
      auditLogs: [],
    };
  }

  if (session.activeRole === "registrar") {
    return {
      ...state,
      auditLogs: [],
      messages: state.messages.filter((item) => item.fromUserId === session.userId || item.toUserId === session.userId),
      notifications: state.notifications.filter((item) => item.userId === session.userId),
    };
  }

  if (session.activeRole === "headofdepartment") {
    const departmentIds = new Set(state.departments.filter((item) => item.ownerUserId === session.userId || item.id === user?.departmentId).map((item) => item.id));
    const programIds = new Set(state.programs.filter((item) => departmentIds.has(item.departmentId)).map((item) => item.id));
    const courseIds = new Set(state.courses.filter((item) => programIds.has(item.programId)).map((item) => item.id));
    const courseRunIds = new Set(state.courseRuns.filter((item) => courseIds.has(item.courseId)).map((item) => item.id));
    const classGroupIds = new Set(state.classGroups.filter((item) => courseRunIds.has(item.courseRunId)).map((item) => item.id));
    const studentIds = new Set(state.enrollments.filter((item) => courseRunIds.has(item.courseRunId)).map((item) => item.studentId));
    const invoiceIds = new Set(state.invoices.filter((item) => studentIds.has(item.studentId)).map((item) => item.id));
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
      enrollments: state.enrollments.filter((item) => courseRunIds.has(item.courseRunId)),
      assignments: state.assignments.filter((item) => courseRunIds.has(item.courseRunId)),
      assignmentSubmissions: state.assignmentSubmissions.filter((item) => studentIds.has(item.studentId)),
      quizzes: state.quizzes.filter((item) => courseRunIds.has(item.courseRunId)),
      quizAttempts: state.quizAttempts.filter((item) => studentIds.has(item.studentId)),
      grades: state.grades.filter((item) => studentIds.has(item.studentId)),
      attendance: state.attendance.filter((item) => studentIds.has(item.studentId)),
      events: state.events.filter((item) => item.classGroupId ? classGroupIds.has(item.classGroupId) : item.ownerId === session.userId),
      certificates: state.certificates.filter((item) => courseIds.has(item.courseId)),
      quranPlans: state.quranPlans.filter((item) => studentIds.has(item.studentId)),
      quranProgress: state.quranProgress.filter((item) => studentIds.has(item.studentId)),
      recitationSubmissions: state.recitationSubmissions.filter((item) => studentIds.has(item.studentId)),
      invoices: state.invoices.filter((item) => studentIds.has(item.studentId)),
      payments: state.payments.filter((item) => invoiceIds.has(item.invoiceId)),
      auditLogs: [],
      messages: state.messages.filter((item) => item.fromUserId === session.userId || item.toUserId === session.userId),
      communicationLogs: state.communicationLogs.filter((item) => item.actorId === session.userId || item.relatedUserId === session.userId),
      notifications: state.notifications.filter((item) => item.userId === session.userId),
      supportTickets: state.supportTickets.filter((item) => item.requesterId === session.userId),
      leads: [],
      applications: [],
      placementTests: [],
      placementResults: [],
      enrollmentWorkflows: state.enrollmentWorkflows.filter((item) => item.studentId ? studentIds.has(item.studentId) : false),
      documents: state.documents.filter((item) => item.ownerId === session.userId),
    };
  }

  return {
    ...state,
    users: state.users.filter((item) => item.id === session.userId),
    leads: [],
    applications: [],
    placementTests: [],
    placementResults: [],
    invoices: [],
    payments: [],
    messages: state.messages.filter((item) => item.fromUserId === session.userId || item.toUserId === session.userId),
    notifications: state.notifications.filter((item) => item.userId === session.userId),
    auditLogs: [],
  };
}
