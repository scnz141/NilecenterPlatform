import express from "express";
import {
  AuthenticationAuthorityError,
  AuthenticationProviderUnavailableError,
  attachSession,
  changeDemoPasswordForSession,
  confirmDemoPasswordReset,
  endRequestSession,
  getRequestSession,
  isServerRole,
  requestDemoPasswordReset,
  signIn,
  validateAuthConfiguration,
} from "./auth.js";
import { loadServerEnv } from "./env.js";
import {
  getPlatformBackendState,
  savePlatformBackendRecord,
} from "./platformRecords.js";
import {
  applyPlatformLearningAction,
  getPlatformStateSnapshot,
  parsePlatformLearningAction,
} from "./platformState.js";
import {
  getPlatformStateRepository,
  PlatformRepositoryUnavailableError,
  validatePlatformRepositoryConfiguration,
} from "./platformRepository.js";
import { getSupabaseServerStatus } from "./supabase.js";
import {
  initializeSessionRepository,
  SessionAuthorityDeniedError,
  SessionCommandConflictError,
  SessionRepositoryUnavailableError,
} from "./sessionRepository.js";
import { getMessageRecipientScope } from "../client/src/lib/domain/messageScope.js";
import {
  branchIdForInvoice,
  enrollmentHasRosterMembership,
  enrollmentsWithoutInvalidRosterLinks,
  enrollmentsWithAuthoritativeTeachers,
} from "../client/src/lib/domain/relationships.js";
import { seedPlatformState } from "../client/src/lib/domain/seed.js";
import { registerNileFormsRoutes } from "./nileFormsRoutes.js";
import { registerNileRequestsRoutes } from "./nileRequestsRoutes.js";
import { registerMoodleRoutes } from "./moodleRoutes.js";
import { registerEmailRoutes } from "./emailRoutes.js";
import { getEmailIntegrationStatus } from "./emailDeliveryService.js";
import { registerUserInvitationRoutes } from "./userInvitationRoutes.js";

const certificateVerifyAttempts = new Map<
  string,
  { count: number; resetAt: number }
>();
const certificateVerifyWindowMs = 10 * 60 * 1000;
const certificateVerifyLimit = 40;
const certificateCodePattern = /^[a-z0-9][a-z0-9-]{5,63}$/i;
const platformRecordTypes = ["lead", "placement", "operational"] as const;
type PlatformRecordType = (typeof platformRecordTypes)[number];

function canResetPlatformStateForQa(req: ApiRequest) {
  const localOnly =
    process.env.NILE_PLATFORM_STATE_LOCAL_ONLY === "1" ||
    process.env.QA_PLATFORM_STATE_LOCAL_ONLY === "1";
  return (
    localOnly &&
    req.get("X-Nile-Learn-Request") === "browser" &&
    req.get("X-Nile-Learn-QA-Reset") === "1"
  );
}

type ApiRequest = {
  method: string;
  body?: Record<string, unknown>;
  rawBody?: Buffer;
  query: Record<string, unknown>;
  headers: {
    cookie?: string;
  };
  ip?: string;
  get(name: string): string | undefined;
};

type ApiResponse = {
  setHeader(name: string, value: string): void;
  status(code: number): ApiResponse;
  json(body: unknown): void;
};

function rejectDurableSnapshotWorkflow(
  session: Awaited<ReturnType<typeof getRequestSession>>,
  res: ApiResponse
) {
  if (session?.authorizationModel !== "normalized") return false;
  res.status(503).json({
    error: "Normalized workflow persistence is not active.",
  });
  return true;
}

type ApiNext = () => void;
type ApiMiddleware = (req: ApiRequest, res: ApiResponse, next: ApiNext) => void;
type ApiRouteHandler = (
  req: ApiRequest,
  res: ApiResponse
) => void | Promise<void>;
type ApiApp = {
  use(handler: unknown): void;
  use(path: string, handler: ApiMiddleware): void;
  get(path: string, handler: ApiRouteHandler): void;
  post(path: string, handler: ApiRouteHandler): void;
};
type HeaderRequest = Pick<ApiRequest, "get" | "ip">;
const sessionRepositoryUnavailable = Symbol("session-repository-unavailable");

async function getApiRequestSession(req: ApiRequest, res: ApiResponse) {
  try {
    return await getRequestSession(req);
  } catch (error) {
    if (error instanceof SessionRepositoryUnavailableError) {
      res
        .status(503)
        .json({ error: "Session service is temporarily unavailable." });
      return sessionRepositoryUnavailable;
    }
    throw error;
  }
}

function isPlatformRecordType(value: unknown): value is PlatformRecordType {
  return (
    typeof value === "string" &&
    platformRecordTypes.includes(value as PlatformRecordType)
  );
}

function certificateVerifyClientKey(req: HeaderRequest) {
  const forwarded = req.get("x-forwarded-for") ?? req.ip ?? "local";
  return forwarded.split(",")[0]?.trim() || "local";
}

function consumeCertificateVerifyAttempt(req: HeaderRequest) {
  const now = Date.now();
  const key = certificateVerifyClientKey(req);
  const bucket = certificateVerifyAttempts.get(key);
  if (!bucket || bucket.resetAt <= now) {
    certificateVerifyAttempts.set(key, {
      count: 1,
      resetAt: now + certificateVerifyWindowMs,
    });
    return true;
  }
  if (bucket.count >= certificateVerifyLimit) return false;
  bucket.count += 1;
  return true;
}

function createServerId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

async function recordAuthAudit(
  session: Awaited<ReturnType<typeof getRequestSession>>,
  action: string,
  summary: string
) {
  if (!session) return null;
  const repository = getPlatformStateRepository();
  const snapshot = await repository.readSnapshot();
  const state = snapshot.state;
  const audit = {
    id: createServerId("audit"),
    actorId: session.userId,
    action,
    entityType: "User",
    entityId: session.userId,
    summary,
    createdAt: new Date().toISOString(),
  };
  state.auditLogs = [audit, ...state.auditLogs].slice(0, 160);
  const persistence = await repository.writeSnapshot(state);
  try {
    await repository.recordEvent({
      action,
      actorId: session.userId,
      entityType: "User",
      entityId: session.userId,
      summary,
      payload: {
        provider: session.provider,
        sourcePersistence: snapshot.persistence,
      },
    });
  } catch {
    // Snapshot audit is enough for the profile activity panel.
  }
  return { state, persistence, syncedAt: new Date().toISOString() };
}

export function registerApiRoutes(app: ApiApp) {
  loadServerEnv();
  validateAuthConfiguration();
  validatePlatformRepositoryConfiguration();
  initializeSessionRepository();
  app.use(
    express.json({
      limit: "1mb",
      verify(req, _res, buffer) {
        const request = req as express.Request & { rawBody?: Buffer };
        if (request.originalUrl === "/api/integrations/resend/webhook") {
          request.rawBody = Buffer.from(buffer);
        }
      },
    })
  );
  registerEmailRoutes(app);
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

  registerNileFormsRoutes(app);
  registerNileRequestsRoutes(app);
  registerMoodleRoutes(app);
  registerUserInvitationRoutes(app);

  app.get("/api/integrations/supabase/status", async (req, res) => {
    const session = await getApiRequestSession(req, res);
    if (session === sessionRepositoryUnavailable) return;
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

  app.get("/api/integrations/resend/status", async (req, res) => {
    const session = await getApiRequestSession(req, res);
    if (session === sessionRepositoryUnavailable) return;
    if (!session || session.activeRole !== "superadmin") {
      res.status(403).json({ error: "Super Admin access is required." });
      return;
    }
    res.json(getEmailIntegrationStatus());
  });

  app.post("/api/auth/login", async (req, res) => {
    const { email, password, role } = req.body ?? {};
    if (
      typeof email !== "string" ||
      typeof password !== "string" ||
      !isServerRole(role)
    ) {
      res
        .status(400)
        .json({ error: "Email, password, and role are required." });
      return;
    }

    try {
      const session = await signIn(email, password, role);
      res.json(attachSession(res, session));
    } catch (error) {
      if (
        error instanceof SessionRepositoryUnavailableError ||
        error instanceof AuthenticationProviderUnavailableError
      ) {
        res.status(503).json({ error: "Sign in is temporarily unavailable." });
        return;
      }
      if (
        error instanceof AuthenticationAuthorityError ||
        error instanceof SessionAuthorityDeniedError
      ) {
        res
          .status(403)
          .json({ error: "This account is not authorized for that role." });
        return;
      }
      if (error instanceof SessionCommandConflictError) {
        res
          .status(409)
          .json({ error: "Sign in could not be completed safely." });
        return;
      }
      res.status(401).json({
        error: error instanceof Error ? error.message : "Sign in failed.",
      });
    }
  });

  app.post("/api/auth/password-reset/request", (req, res) => {
    const { email, role } = req.body ?? {};
    if (typeof email !== "string") {
      res.status(400).json({ error: "Email is required." });
      return;
    }
    res.json(
      requestDemoPasswordReset(email, isServerRole(role) ? role : undefined)
    );
  });

  app.post("/api/auth/password-reset/confirm", (req, res) => {
    const { token, email, password } = req.body ?? {};
    if (
      typeof token !== "string" ||
      typeof email !== "string" ||
      typeof password !== "string"
    ) {
      res
        .status(400)
        .json({ error: "Reset token, email, and password are required." });
      return;
    }
    try {
      res.json(confirmDemoPasswordReset({ token, email, password }));
    } catch (error) {
      res.status(400).json({
        error:
          error instanceof Error ? error.message : "Password reset failed.",
      });
    }
  });

  app.post("/api/auth/password-change", async (req, res) => {
    const session = await getApiRequestSession(req, res);
    if (session === sessionRepositoryUnavailable) return;
    if (!session) {
      res.status(401).json({ error: "Sign in required." });
      return;
    }
    const { currentPassword, newPassword } = req.body ?? {};
    if (
      typeof currentPassword !== "string" ||
      typeof newPassword !== "string"
    ) {
      res
        .status(400)
        .json({ error: "Current password and new password are required." });
      return;
    }
    try {
      const result = changeDemoPasswordForSession(session, {
        currentPassword,
        newPassword,
      });
      const audit = await recordAuthAudit(
        session,
        "password.changed",
        "Changed demo account password."
      );
      res.json({ ...result, ...audit });
    } catch (error) {
      res.status(400).json({
        error:
          error instanceof Error ? error.message : "Password change failed.",
      });
    }
  });

  app.get("/api/auth/session", async (req, res) => {
    const session = await getApiRequestSession(req, res);
    if (session === sessionRepositoryUnavailable) return;
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

  app.post("/api/auth/logout", async (req, res) => {
    try {
      await endRequestSession(req, res);
      res.json({ ok: true });
    } catch (error) {
      if (error instanceof SessionRepositoryUnavailableError) {
        res
          .status(503)
          .json({ error: "Session service is temporarily unavailable." });
        return;
      }
      if (error instanceof SessionCommandConflictError) {
        res
          .status(409)
          .json({ error: "Sign out could not be completed safely." });
        return;
      }
      throw error;
    }
  });

  app.get("/api/platform/records", async (req, res) => {
    const session = await getApiRequestSession(req, res);
    if (session === sessionRepositoryUnavailable) return;
    if (
      !session ||
      !["registrar", "branchadmin", "superadmin"].includes(session.activeRole)
    ) {
      res.status(403).json({ error: "Records access is restricted." });
      return;
    }
    if (rejectDurableSnapshotWorkflow(session, res)) return;
    res.json(getPlatformBackendState());
  });

  app.get("/api/platform/state", async (req, res) => {
    const session = await getApiRequestSession(req, res);
    if (session === sessionRepositoryUnavailable) return;
    if (!session) {
      res.status(401).json({ error: "Sign in required." });
      return;
    }
    if (rejectDurableSnapshotWorkflow(session, res)) return;

    try {
      const snapshot = await getPlatformStateSnapshot();
      res.json({
        ...snapshot,
        state: scopePlatformStateForSession(snapshot.state, session),
      });
    } catch (error) {
      if (error instanceof PlatformRepositoryUnavailableError) {
        res
          .status(503)
          .json({ error: "Workspace data is temporarily unavailable." });
        return;
      }
      throw error;
    }
  });

  app.post("/api/platform/state/reset", async (req, res) => {
    const session = await getApiRequestSession(req, res);
    if (session === sessionRepositoryUnavailable) return;
    if (!session) {
      res.status(401).json({ error: "Sign in required." });
      return;
    }
    if (rejectDurableSnapshotWorkflow(session, res)) return;
    if (!canResetPlatformStateForQa(req)) {
      res.status(404).json({ error: "Not found." });
      return;
    }

    const state = JSON.parse(
      JSON.stringify(seedPlatformState)
    ) as PlatformStatePayload;
    const persistence = await getPlatformStateRepository().writeSnapshot(state);
    res.json({
      state: scopePlatformStateForSession(state, session),
      persistence,
      syncedAt: new Date().toISOString(),
    });
  });

  app.get("/api/certificates/verify", async (req, res) => {
    const code =
      typeof req.query.code === "string"
        ? req.query.code.trim().toLowerCase()
        : "";
    if (!code) {
      res
        .status(400)
        .json({ valid: false, error: "Certificate code is required." });
      return;
    }
    if (!consumeCertificateVerifyAttempt(req)) {
      res.status(429).json({
        valid: false,
        error: "Too many certificate checks. Try again later.",
      });
      return;
    }
    if (!certificateCodePattern.test(code)) {
      res.status(400).json({
        valid: false,
        error: "Use the certificate code printed on the issued certificate.",
      });
      return;
    }

    const snapshot = await getPlatformStateSnapshot();
    const certificate = snapshot.state.certificates.find(
      item =>
        item.status === "issued" && item.verificationCode.toLowerCase() === code
    );
    if (!certificate) {
      res.json({ valid: false });
      return;
    }

    const student = snapshot.state.students.find(
      item => item.id === certificate.studentId
    );
    const user = snapshot.state.users.find(item => item.id === student?.userId);
    const course = snapshot.state.courses.find(
      item => item.id === certificate.courseId
    );
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
    const session = await getApiRequestSession(req, res);
    if (session === sessionRepositoryUnavailable) return;
    if (!session) {
      res.status(401).json({ error: "Sign in required." });
      return;
    }
    if (rejectDurableSnapshotWorkflow(session, res)) return;

    const action = parsePlatformLearningAction(req.body);
    if (!action) {
      res
        .status(400)
        .json({ error: "Valid platform learning action is required." });
      return;
    }

    try {
      const actionResult = await applyPlatformLearningAction(action, session);
      res.json({
        ...actionResult,
        state: scopePlatformStateForSession(actionResult.state, session),
      });
    } catch (error) {
      res
        .status(error instanceof PlatformRepositoryUnavailableError ? 503 : 400)
        .json({
          error:
            error instanceof PlatformRepositoryUnavailableError
              ? "Workspace data is temporarily unavailable."
              : error instanceof Error
                ? error.message
                : "Platform action failed.",
        });
    }
  });

  app.post("/api/platform/records", async (req, res) => {
    const { type, payload } = req.body ?? {};
    if (
      !isPlatformRecordType(type) ||
      !payload ||
      typeof payload !== "object"
    ) {
      res
        .status(400)
        .json({ error: "Valid record type and payload are required." });
      return;
    }
    const session = await getApiRequestSession(req, res);
    if (session === sessionRepositoryUnavailable) return;
    if (type === "operational") {
      if (!session) {
        res
          .status(401)
          .json({ error: "Sign in required for operational records." });
        return;
      }
      if (
        ![
          "registrar",
          "headofdepartment",
          "branchadmin",
          "superadmin",
        ].includes(session.activeRole)
      ) {
        res.status(403).json({ error: "Operational records are restricted." });
        return;
      }
      if (rejectDurableSnapshotWorkflow(session, res)) return;
    }
    const record = await savePlatformBackendRecord(
      type,
      payload as Record<string, unknown>,
      session?.userId
    );
    res.status(201).json(record);
  });
}

type PlatformStatePayload = Awaited<
  ReturnType<typeof getPlatformStateSnapshot>
>["state"];
type RequestSession = NonNullable<
  Awaited<ReturnType<typeof getRequestSession>>
>;

function quizQuestionPreviewsForRuns(
  state: PlatformStatePayload,
  courseRunIds: Set<string>
) {
  return state.quizzes
    .filter(
      quiz =>
        courseRunIds.has(quiz.courseRunId) &&
        (quiz.status === "active" || quiz.status === "completed")
    )
    .flatMap(quiz =>
      quiz.questionIds.flatMap(questionId => {
        const question = state.questionBankItems.find(
          item =>
            item.id === questionId &&
            item.courseRunId === quiz.courseRunId &&
            item.status === "active"
        );
        if (!question) return [];
        return [
          {
            id: question.id,
            quizId: quiz.id,
            courseRunId: question.courseRunId,
            prompt: question.prompt,
            type: question.type,
            difficulty: question.difficulty,
            tags: question.tags,
            choices: question.choices,
            status: question.status,
          },
        ];
      })
    );
}

function scopedAuditRows(
  state: PlatformStatePayload,
  classGroupIds: Set<string>,
  eventIds: Set<string>,
  certificateIds = new Set<string>(),
  actorId?: string,
  courseIds = new Set<string>(),
  roomIds = new Set<string>(),
  invoiceIds = new Set<string>(),
  paymentIds = new Set<string>()
) {
  const courseRunIds = new Set(
    state.classGroups
      .filter(group => classGroupIds.has(group.id))
      .map(group => group.courseRunId)
  );
  const moduleIds = new Set(
    state.modules
      .filter(module => courseIds.has(module.courseId))
      .map(module => module.id)
  );
  const scopedCourseIds = new Set([
    ...Array.from(courseIds),
    ...state.courseRuns
      .filter(run => courseRunIds.has(run.id))
      .map(run => run.courseId),
  ]);
  const lessonIds = new Set(
    state.lessons
      .filter(lesson => {
        const module = state.modules.find(item => item.id === lesson.moduleId);
        return Boolean(module && scopedCourseIds.has(module.courseId));
      })
      .map(lesson => lesson.id)
  );
  const resourceIds = new Set(
    state.resources
      .filter(resource => lessonIds.has(resource.lessonId))
      .map(resource => resource.id)
  );
  const assignmentIds = new Set(
    state.assignments
      .filter(assignment => courseRunIds.has(assignment.courseRunId))
      .map(assignment => assignment.id)
  );
  const quizIds = new Set(
    state.quizzes
      .filter(quiz => courseRunIds.has(quiz.courseRunId))
      .map(quiz => quiz.id)
  );
  const questionIds = new Set(
    state.questionBankItems
      .filter(question => courseRunIds.has(question.courseRunId))
      .map(question => question.id)
  );
  const submissionIds = new Set(
    state.assignmentSubmissions
      .filter(submission => assignmentIds.has(submission.assignmentId))
      .map(submission => submission.id)
  );
  const attemptIds = new Set(
    state.quizAttempts
      .filter(attempt => quizIds.has(attempt.quizId))
      .map(attempt => attempt.id)
  );
  const messageIds = new Set(
    actorId
      ? state.messages
          .filter(
            message =>
              message.fromUserId === actorId || message.toUserId === actorId
          )
          .map(message => message.id)
      : []
  );
  return state.auditLogs.filter(item => {
    if (
      item.action === "attendance.saved" &&
      item.entityType === "AttendanceRecord"
    ) {
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
    if (item.entityType === "Module") {
      return moduleIds.has(item.entityId);
    }
    if (item.entityType === "LessonResource") {
      return resourceIds.has(item.entityId);
    }
    if (item.entityType === "Course") {
      return courseIds.has(item.entityId);
    }
    if (item.entityType === "CourseRun") {
      const run = state.courseRuns.find(
        candidate => candidate.id === item.entityId
      );
      return Boolean(run && courseIds.has(run.courseId));
    }
    if (item.entityType === "ClassGroup") {
      return classGroupIds.has(item.entityId);
    }
    if (item.entityType === "ClassSession") {
      const classSession = state.classSessions.find(
        candidate => candidate.id === item.entityId
      );
      return Boolean(
        classSession && classGroupIds.has(classSession.classGroupId)
      );
    }
    if (item.entityType === "AttendanceExceptionRequest") {
      const request = state.attendanceExceptions.find(
        candidate => candidate.id === item.entityId
      );
      return Boolean(request && classGroupIds.has(request.classGroupId));
    }
    if (item.entityType === "Message") {
      return messageIds.has(item.entityId);
    }
    if (item.entityType === "Room") {
      return roomIds.has(item.entityId);
    }
    if (item.entityType === "Invoice") {
      return invoiceIds.has(item.entityId);
    }
    if (item.entityType === "Payment") {
      return paymentIds.has(item.entityId) || invoiceIds.has(item.entityId);
    }
    if (
      (item.action === "calendar.created" ||
        item.action === "calendar.created_with_conflict") &&
      item.entityType === "CalendarEvent"
    ) {
      return eventIds.has(item.entityId);
    }
    if (
      (item.action === "certificate.approved" ||
        item.action === "certificate.issued" ||
        item.action === "certificate.rejected") &&
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

type StaffProfileRow = PlatformStatePayload["staffProfiles"][number];
type ScopedEnrollment = PlatformStatePayload["enrollments"][number];

type RegistrarReadScope = {
  leads: PlatformStatePayload["leads"];
  applications: PlatformStatePayload["applications"];
  placementTests: PlatformStatePayload["placementTests"];
  placementResults: PlatformStatePayload["placementResults"];
  enrollmentWorkflows: PlatformStatePayload["enrollmentWorkflows"];
  leadIds: Set<string>;
  applicationIds: Set<string>;
  placementIds: Set<string>;
  placementResultIds: Set<string>;
  workflowIds: Set<string>;
};

function emptyPermissions(): PlatformStatePayload["permissions"] {
  return {
    student: [],
    teacher: [],
    registrar: [],
    headofdepartment: [],
    branchadmin: [],
    superadmin: [],
  };
}

function scopedStateBase(
  state: PlatformStatePayload,
  mapped: boolean
): PlatformStatePayload {
  return {
    settings: mapped
      ? {
          organization: state.settings.organization,
          defaultLanguage: state.settings.defaultLanguage,
          academicTerm: state.settings.academicTerm,
          retentionDays: 0,
        }
      : {
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
    permissions: emptyPermissions(),
  };
}

function safeUnmappedRoleState(
  state: PlatformStatePayload,
  _session: RequestSession
) {
  return scopedStateBase(state, false);
}

function activeStaffProfileForSession(
  state: PlatformStatePayload,
  session: RequestSession
) {
  const matches = state.staffProfiles.filter(
    item =>
      item.userId === session.userId &&
      item.role === session.activeRole &&
      item.status === "active"
  );
  return matches.length === 1 ? matches[0] : undefined;
}

function branchIdsForProfile(
  state: PlatformStatePayload,
  profile: StaffProfileRow
) {
  const knownBranchIds = new Set(state.branches.map(item => item.id));
  return new Set(
    profile.branchIds.filter(branchId => knownBranchIds.has(branchId))
  );
}

function departmentIdsForProfile(
  state: PlatformStatePayload,
  profile: StaffProfileRow
) {
  const knownDepartmentIds = new Set(state.departments.map(item => item.id));
  return new Set(
    profile.departmentIds.filter(departmentId =>
      knownDepartmentIds.has(departmentId)
    )
  );
}

function hasBranchAccess(
  branchIds: Set<string>,
  branchId: string | undefined,
  globalWildcard = false
) {
  return Boolean(
    branchId &&
      (branchIds.has(branchId) ||
        (globalWildcard && branchIds.has("br_global")))
  );
}

function reportPresetsForSession(
  state: PlatformStatePayload,
  session: RequestSession
) {
  return state.reportPresets.filter(
    item =>
      item.ownerUserId === session.userId && item.role === session.activeRole
  );
}

function portalSettingsForSession(
  state: PlatformStatePayload,
  session: RequestSession,
  profile: StaffProfileRow
) {
  if (
    session.activeRole === "registrar" ||
    session.activeRole === "branchadmin"
  ) {
    const branchIds = branchIdsForProfile(state, profile);
    return state.portalSettings.filter(
      item => item.role === session.activeRole && branchIds.has(item.scopeId)
    );
  }
  if (session.activeRole === "headofdepartment") {
    const departmentIds = departmentIdsForProfile(state, profile);
    return state.portalSettings.filter(
      item =>
        item.role === "headofdepartment" && departmentIds.has(item.scopeId)
    );
  }
  return [];
}

function courseDepartmentId(state: PlatformStatePayload, courseId: string) {
  const course = state.courses.find(item => item.id === courseId);
  return state.programs.find(item => item.id === course?.programId)
    ?.departmentId;
}

function catalogForCourseIds(
  state: PlatformStatePayload,
  courseIds: Set<string>,
  publishedResourcesOnly = false
) {
  const courses = state.courses.filter(item => courseIds.has(item.id));
  const programIds = new Set(courses.map(item => item.programId));
  const levelIds = new Set(courses.map(item => item.levelId));
  const programs = state.programs.filter(item => programIds.has(item.id));
  const departmentIds = new Set(programs.map(item => item.departmentId));
  const modules = state.modules.filter(item => courseIds.has(item.courseId));
  const moduleIds = new Set(modules.map(item => item.id));
  const lessons = state.lessons.filter(item => moduleIds.has(item.moduleId));
  const lessonIds = new Set(lessons.map(item => item.id));
  return {
    departments: state.departments.filter(item => departmentIds.has(item.id)),
    programs,
    levels: state.levels.filter(item => levelIds.has(item.id)),
    courses,
    modules,
    lessons,
    resources: state.resources.filter(
      item =>
        lessonIds.has(item.lessonId) &&
        (!publishedResourcesOnly || item.published)
    ),
  };
}

function departmentsForBranches(
  departments: PlatformStatePayload["departments"],
  branchIds: Set<string>
) {
  return departments.map(item => ({
    ...item,
    branchIds: item.branchIds.filter(branchId => branchIds.has(branchId)),
  }));
}

function classGroupsForScope(
  state: PlatformStatePayload,
  classGroupIds: Set<string>,
  studentIds: Set<string>
) {
  return state.classGroups
    .filter(item => classGroupIds.has(item.id))
    .map(item => ({
      ...item,
      studentIds: item.studentIds.filter(studentId =>
        studentIds.has(studentId)
      ),
    }));
}

function teacherProfilesForRuns(
  state: PlatformStatePayload,
  teacherUserIds: Set<string>,
  courseRunIds: Set<string>,
  classGroupIds: Set<string>
) {
  const runs = state.courseRuns.filter(item => courseRunIds.has(item.id));
  return state.teachers
    .filter(item => teacherUserIds.has(item.userId))
    .map(item => {
      const teacherRuns = runs.filter(run => run.teacherId === item.userId);
      const primaryRun = teacherRuns[0];
      const teacherRunIds = new Set(teacherRuns.map(run => run.id));
      const assignedClassIds = new Set(
        state.classGroups
          .filter(
            group =>
              classGroupIds.has(group.id) &&
              teacherRunIds.has(group.courseRunId)
          )
          .map(group => group.id)
      );
      return {
        ...item,
        branchId: primaryRun?.branchId ?? item.branchId,
        departmentId:
          (primaryRun
            ? courseDepartmentId(state, primaryRun.courseId)
            : undefined) ?? item.departmentId,
        assignedClassIds: Array.from(assignedClassIds),
      };
    });
}

function staffProfilesForScope(
  profiles: StaffProfileRow[],
  branchIds: Set<string>,
  departmentIds: Set<string>
) {
  return profiles.map(item => ({
    ...item,
    branchIds: item.branchIds.filter(branchId => branchIds.has(branchId)),
    departmentIds: item.departmentIds.filter(departmentId =>
      departmentIds.has(departmentId)
    ),
  }));
}

function messagesForSession(
  state: PlatformStatePayload,
  sessionUserId: string
) {
  return state.messages.filter(
    item => item.fromUserId === sessionUserId || item.toUserId === sessionUserId
  );
}

function directoryUsersForSession(
  state: PlatformStatePayload,
  session: RequestSession,
  scopedUserIds: Set<string>,
  referenceUserIds = new Set<string>()
) {
  const recipientScope = getMessageRecipientScope(
    state,
    session.activeRole,
    session.userId
  );
  const visibleUserIds = new Set([
    session.userId,
    ...Array.from(scopedUserIds),
    ...Array.from(referenceUserIds),
    ...Array.from(recipientScope.visibleUserIds),
  ]);
  return state.users
    .filter(item => visibleUserIds.has(item.id))
    .map(item => {
      if (item.id === session.userId || scopedUserIds.has(item.id)) {
        return item;
      }
      const safeUser = { ...item };
      delete safeUser.phone;
      delete safeUser.notes;
      delete safeUser.preferredLanguage;
      delete safeUser.timezone;
      delete safeUser.notificationPreferences;
      delete safeUser.branchId;
      delete safeUser.departmentId;
      return safeUser;
    });
}

function academicStudentProfiles(
  students: PlatformStatePayload["students"]
): PlatformStatePayload["students"] {
  return students.map(student => {
    const {
      legalName: _legalName,
      dateOfBirth: _dateOfBirth,
      guardianId: _guardianId,
      guardianName: _guardianName,
      guardianPhone: _guardianPhone,
      notes: _notes,
      ...academicProfile
    } = student;
    return academicProfile;
  });
}

function communicationLogsForScope(
  state: PlatformStatePayload,
  sessionUserId: string,
  scopedUserIds: Set<string>
) {
  return state.communicationLogs.filter(log => {
    if (log.actorId === sessionUserId) {
      return !log.relatedUserId || scopedUserIds.has(log.relatedUserId);
    }
    return (
      log.relatedUserId === sessionUserId && scopedUserIds.has(log.actorId)
    );
  });
}

function ownedEntityIds(
  state: PlatformStatePayload,
  actorId: string,
  entityType: string
) {
  return new Set(
    state.auditLogs
      .filter(
        item => item.actorId === actorId && item.entityType === entityType
      )
      .map(item => item.entityId)
  );
}

function buildRegistrarReadScope(
  state: PlatformStatePayload,
  actorId: string,
  branchIds: Set<string>,
  studentIds: Set<string>,
  courseRunIds: Set<string>,
  classGroupIds: Set<string>
): RegistrarReadScope {
  const allowedCourseIds = new Set(
    state.courseRuns
      .filter(item => courseRunIds.has(item.id))
      .map(item => item.courseId)
  );
  const branchApplications = state.applications.filter(
    item => Boolean(item.branchId) && branchIds.has(item.branchId)
  );
  const branchPlacementTests = state.placementTests.filter(
    item => Boolean(item.branchId) && branchIds.has(item.branchId)
  );
  const ownedLeadIds = ownedEntityIds(state, actorId, "Lead");
  const leadIds = new Set(
    state.leads
      .filter(lead => {
        const applicationsForLead = state.applications.filter(
          item => item.leadId === lead.id
        );
        const placementsForLead = state.placementTests.filter(
          item => item.leadId === lead.id
        );
        const branchEvidence = [
          ...applicationsForLead.map(item => item.branchId),
          ...placementsForLead.map(item => item.branchId),
        ];
        const hasAmbiguousEvidence = branchEvidence.some(
          branchId => !branchId || !branchIds.has(branchId)
        );
        return (
          !hasAmbiguousEvidence &&
          (branchEvidence.length > 0 || ownedLeadIds.has(lead.id))
        );
      })
      .map(item => item.id)
  );
  const leads = state.leads.filter(item => leadIds.has(item.id));
  const applications = branchApplications.filter(item =>
    leadIds.has(item.leadId)
  );
  const applicationIds = new Set(applications.map(item => item.id));
  const placementTests = branchPlacementTests.filter(
    item => !item.leadId || leadIds.has(item.leadId)
  );
  const placementIds = new Set(placementTests.map(item => item.id));
  const placementResults = state.placementResults.filter(item =>
    placementIds.has(item.bookingId)
  );
  const placementResultIds = new Set(placementResults.map(item => item.id));
  const enrollmentWorkflows = state.enrollmentWorkflows.filter(item => {
    if (!allowedCourseIds.has(item.targetCourseId)) return false;
    let hasAuthorityEvidence = false;
    const linkedApplication = item.applicationId
      ? state.applications.find(
          candidate => candidate.id === item.applicationId
        )
      : undefined;
    const linkedPlacement = item.placementTestId
      ? state.placementTests.find(
          candidate => candidate.id === item.placementTestId
        )
      : undefined;
    const linkedRun = item.courseRunId
      ? state.courseRuns.find(candidate => candidate.id === item.courseRunId)
      : undefined;
    const linkedClassGroup = item.classGroupId
      ? state.classGroups.find(candidate => candidate.id === item.classGroupId)
      : undefined;

    if (item.leadId) {
      if (!leadIds.has(item.leadId)) return false;
      hasAuthorityEvidence = true;
    }
    if (item.applicationId) {
      if (!linkedApplication || !applicationIds.has(linkedApplication.id)) {
        return false;
      }
      if (item.leadId && linkedApplication.leadId !== item.leadId) return false;
      hasAuthorityEvidence = true;
    }
    if (item.placementTestId) {
      if (!linkedPlacement || !placementIds.has(linkedPlacement.id))
        return false;
      if (
        item.leadId &&
        linkedPlacement.leadId &&
        linkedPlacement.leadId !== item.leadId
      ) {
        return false;
      }
      hasAuthorityEvidence = true;
    }
    if (item.studentId) {
      if (!studentIds.has(item.studentId)) return false;
      hasAuthorityEvidence = true;
    }
    if (item.courseRunId) {
      if (!linkedRun || !courseRunIds.has(linkedRun.id)) return false;
      if (linkedRun.courseId !== item.targetCourseId) return false;
      hasAuthorityEvidence = true;
    }
    if (item.classGroupId) {
      if (!linkedClassGroup || !classGroupIds.has(linkedClassGroup.id)) {
        return false;
      }
      if (linkedRun && linkedClassGroup.courseRunId !== linkedRun.id) {
        return false;
      }
      const classRun = state.courseRuns.find(
        candidate => candidate.id === linkedClassGroup.courseRunId
      );
      if (!classRun || classRun.courseId !== item.targetCourseId) return false;
      hasAuthorityEvidence = true;
    }
    return hasAuthorityEvidence;
  });
  const workflowIds = new Set(enrollmentWorkflows.map(item => item.id));
  return {
    leads,
    applications,
    placementTests,
    placementResults,
    enrollmentWorkflows,
    leadIds,
    applicationIds,
    placementIds,
    placementResultIds,
    workflowIds,
  };
}

function registrarAuditRows(
  state: PlatformStatePayload,
  scope: RegistrarReadScope,
  studentIds: Set<string>,
  enrollmentIds: Set<string>,
  invoiceIds: Set<string>,
  paymentIds: Set<string>,
  eventIds: Set<string>,
  actorId: string
) {
  const userIds = new Set(
    state.students
      .filter(item => studentIds.has(item.id))
      .map(item => item.userId)
  );
  const admissionsRows = state.auditLogs.filter(item => {
    if (item.entityType === "Lead") return scope.leadIds.has(item.entityId);
    if (item.entityType === "Application")
      return scope.applicationIds.has(item.entityId);
    if (item.entityType === "PlacementTestBooking")
      return scope.placementIds.has(item.entityId);
    if (item.entityType === "PlacementTestResult")
      return (
        scope.placementResultIds.has(item.entityId) ||
        scope.placementIds.has(item.entityId)
      );
    if (item.entityType === "EnrollmentWorkflow")
      return scope.workflowIds.has(item.entityId);
    if (item.entityType === "StudentProfile")
      return studentIds.has(item.entityId);
    if (item.entityType === "Enrollment")
      return enrollmentIds.has(item.entityId);
    if (item.entityType === "User") return userIds.has(item.entityId);
    if (item.entityType === "Invoice") return invoiceIds.has(item.entityId);
    if (item.entityType === "Payment")
      return paymentIds.has(item.entityId) || invoiceIds.has(item.entityId);
    if (item.entityType === "ReportPreset") return item.actorId === actorId;
    return false;
  });
  const scopedRows = scopedAuditRows(state, new Set(), eventIds);
  return [...admissionsRows, ...scopedRows]
    .filter(
      (item, index, rows) => rows.findIndex(row => row.id === item.id) === index
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

type AcademicReadScope = {
  lessonIds: Set<string>;
  assignmentIds: Set<string>;
  quizIds: Set<string>;
  meetingLinkIds: Set<string>;
  enrollmentIds: Set<string>;
  studentRunKeys: Set<string>;
  studentTeacherKeys: Set<string>;
};

function scopeKey(left: string, right: string) {
  return `${left}\u0000${right}`;
}

function buildAcademicReadScope(
  state: PlatformStatePayload,
  courseRunIds: Set<string>,
  classGroupIds: Set<string>,
  enrollments: ScopedEnrollment[]
): AcademicReadScope {
  const scopedRuns = state.courseRuns.filter(run => courseRunIds.has(run.id));
  const runsById = new Map(scopedRuns.map(run => [run.id, run]));
  const scopedEnrollments = enrollments.filter(enrollment =>
    runsById.has(enrollment.courseRunId)
  );
  const enrollmentIds = new Set(scopedEnrollments.map(item => item.id));
  const studentRunKeys = new Set(
    scopedEnrollments.map(enrollment =>
      scopeKey(enrollment.studentId, enrollment.courseRunId)
    )
  );
  const courseIds = new Set(scopedRuns.map(run => run.courseId));
  const studentTeacherKeys = new Set<string>();
  scopedEnrollments.forEach(enrollment => {
    const run = runsById.get(enrollment.courseRunId);
    if (!run) return;
    studentTeacherKeys.add(scopeKey(enrollment.studentId, run.teacherId));
  });
  const moduleIds = new Set(
    state.modules
      .filter(module => courseIds.has(module.courseId))
      .map(module => module.id)
  );
  const lessonIds = new Set(
    state.lessons
      .filter(lesson => moduleIds.has(lesson.moduleId))
      .map(lesson => lesson.id)
  );
  const assignmentIds = new Set(
    state.assignments
      .filter(assignment => courseRunIds.has(assignment.courseRunId))
      .map(assignment => assignment.id)
  );
  const quizIds = new Set(
    state.quizzes
      .filter(quiz => courseRunIds.has(quiz.courseRunId))
      .map(quiz => quiz.id)
  );
  const meetingLinkIds = new Set(
    state.classGroups
      .filter(
        group =>
          classGroupIds.has(group.id) &&
          courseRunIds.has(group.courseRunId) &&
          Boolean(group.meetingLinkId)
      )
      .map(group => group.meetingLinkId!)
  );
  return {
    lessonIds,
    assignmentIds,
    quizIds,
    meetingLinkIds,
    enrollmentIds,
    studentRunKeys,
    studentTeacherKeys,
  };
}

function lessonProgressForScope(
  state: PlatformStatePayload,
  scope: AcademicReadScope
) {
  return state.lessonProgress.filter(progress => {
    if (!scope.enrollmentIds.has(progress.enrollmentId)) return false;
    const enrollment = state.enrollments.find(
      item => item.id === progress.enrollmentId
    );
    const run = state.courseRuns.find(
      item => item.id === enrollment?.courseRunId
    );
    const lesson = state.lessons.find(item => item.id === progress.lessonId);
    const module = state.modules.find(item => item.id === lesson?.moduleId);
    return Boolean(
      enrollment &&
        run &&
        module &&
        enrollment.studentId === progress.studentId &&
        module.courseId === run.courseId &&
        scope.lessonIds.has(progress.lessonId)
    );
  });
}

function assignmentSubmissionsForScope(
  state: PlatformStatePayload,
  scope: AcademicReadScope
) {
  return state.assignmentSubmissions.filter(submission => {
    const assignment = state.assignments.find(
      item => item.id === submission.assignmentId
    );
    return Boolean(
      assignment &&
        scope.assignmentIds.has(assignment.id) &&
        scope.studentRunKeys.has(
          scopeKey(submission.studentId, assignment.courseRunId)
        )
    );
  });
}

function quizAttemptsForScope(
  state: PlatformStatePayload,
  scope: AcademicReadScope
) {
  return state.quizAttempts.filter(attempt => {
    const quiz = state.quizzes.find(item => item.id === attempt.quizId);
    return Boolean(
      quiz &&
        scope.quizIds.has(quiz.id) &&
        scope.studentRunKeys.has(scopeKey(attempt.studentId, quiz.courseRunId))
    );
  });
}

function gradesForScope(state: PlatformStatePayload, scope: AcademicReadScope) {
  return state.grades.filter(grade =>
    scope.studentRunKeys.has(scopeKey(grade.studentId, grade.courseRunId))
  );
}

function attendanceForScope(
  state: PlatformStatePayload,
  scope: AcademicReadScope,
  classGroupIds: Set<string>
) {
  return state.attendance.filter(record => {
    const group = state.classGroups.find(
      item => item.id === record.classGroupId
    );
    return Boolean(
      group &&
        classGroupIds.has(group.id) &&
        scope.studentRunKeys.has(scopeKey(record.studentId, group.courseRunId))
    );
  });
}

function quranRowsForScope(
  state: PlatformStatePayload,
  scope: AcademicReadScope
) {
  const quranPlans = state.quranPlans.filter(plan =>
    scope.studentTeacherKeys.has(scopeKey(plan.studentId, plan.teacherId))
  );
  const recitationSubmissions = state.recitationSubmissions.filter(submission =>
    scope.studentTeacherKeys.has(
      scopeKey(submission.studentId, submission.teacherId)
    )
  );
  const progressStudentIds = new Set([
    ...quranPlans.map(plan => plan.studentId),
    ...recitationSubmissions.map(submission => submission.studentId),
  ]);
  return {
    quranPlans,
    quranProgress: state.quranProgress.filter(progress =>
      progressStudentIds.has(progress.studentId)
    ),
    recitationSubmissions,
  };
}

export function scopePlatformStateForSession(
  state: PlatformStatePayload,
  session: RequestSession
) {
  const user = state.users.find(item => item.id === session.userId);
  const hasActiveRoleGrant =
    session.roles.includes(session.activeRole) &&
    user?.roles.includes(session.activeRole);
  if (
    session.authorizationModel === "normalized" ||
    !user ||
    user.status !== "active" ||
    !hasActiveRoleGrant
  ) {
    return safeUnmappedRoleState(state, session);
  }

  const staffProfile =
    session.activeRole === "student"
      ? undefined
      : activeStaffProfileForSession(state, session);
  if (session.activeRole !== "student" && !staffProfile) {
    return safeUnmappedRoleState(state, session);
  }
  if (session.activeRole === "superadmin") {
    const enrollments = enrollmentsWithAuthoritativeTeachers(
      state,
      state.enrollments
    );
    return enrollments === state.enrollments
      ? state
      : { ...state, enrollments };
  }

  const base = scopedStateBase(state, true);
  const student = state.students.find(item => item.userId === session.userId);
  const teacher = state.teachers.find(item => item.userId === session.userId);

  if (session.activeRole === "student" && student) {
    const studentEnrollments = state.enrollments.filter(item => {
      if (item.studentId !== student.id) return false;
      const run = state.courseRuns.find(
        candidate => candidate.id === item.courseRunId
      );
      if (!run) return false;
      return (
        item.status === "completed" ||
        (item.status === "active" && run.status === "active")
      );
    });
    const courseRunIds = new Set(
      studentEnrollments.map(item => item.courseRunId)
    );
    const assignedRuns = state.courseRuns.filter(item =>
      courseRunIds.has(item.id)
    );
    const classGroupIds = new Set(
      state.classGroups
        .filter(
          group =>
            courseRunIds.has(group.courseRunId) &&
            studentEnrollments.some(
              enrollment =>
                enrollment.classGroupId === group.id &&
                enrollment.courseRunId === group.courseRunId &&
                group.studentIds.includes(enrollment.studentId)
            )
        )
        .map(item => item.id)
    );
    const certificates = state.certificates.filter(
      item =>
        item.studentId === student.id &&
        state.courses.some(course => course.id === item.courseId)
    );
    const courseIds = new Set([
      ...assignedRuns.map(item => item.courseId),
      ...certificates.map(item => item.courseId),
    ]);
    const branchIds = new Set(assignedRuns.map(item => item.branchId));
    const catalog = catalogForCourseIds(state, courseIds, true);
    const academicScope = buildAcademicReadScope(
      state,
      courseRunIds,
      classGroupIds,
      studentEnrollments
    );
    const studentVisibleQuizzes = state.quizzes.filter(
      item =>
        courseRunIds.has(item.courseRunId) &&
        (item.status === "active" || item.status === "completed")
    );
    const studentVisibleQuizIds = new Set(
      studentVisibleQuizzes.map(item => item.id)
    );
    const quranRows = quranRowsForScope(state, academicScope);
    const assignedTeacherUserIds = new Set(
      assignedRuns.map(item => item.teacherId)
    );
    const messages = messagesForSession(state, session.userId);
    const referenceUserIds = new Set([
      ...messages.flatMap(item => [item.fromUserId, item.toUserId]),
    ]);
    const invoices = state.invoices.filter(
      item => item.studentId === student.id
    );
    const invoiceIds = new Set(invoices.map(item => item.id));
    return {
      ...base,
      users: directoryUsersForSession(
        state,
        session,
        assignedTeacherUserIds,
        referenceUserIds
      ),
      branches: state.branches.filter(item => branchIds.has(item.id)),
      departments: departmentsForBranches(catalog.departments, branchIds),
      programs: catalog.programs,
      levels: catalog.levels,
      courses: catalog.courses,
      modules: catalog.modules,
      lessons: catalog.lessons,
      resources: catalog.resources,
      courseRuns: assignedRuns,
      classGroups: classGroupsForScope(
        state,
        classGroupIds,
        new Set([student.id])
      ),
      students: [student],
      teachers: teacherProfilesForRuns(
        state,
        assignedTeacherUserIds,
        courseRunIds,
        classGroupIds
      ),
      enrollments: enrollmentsWithoutInvalidRosterLinks(
        state,
        enrollmentsWithAuthoritativeTeachers(state, studentEnrollments)
      ),
      lessonProgress: lessonProgressForScope(state, academicScope),
      assignments: state.assignments.filter(
        item =>
          courseRunIds.has(item.courseRunId) &&
          (item.status === "active" || item.status === "completed")
      ),
      assignmentSubmissions: assignmentSubmissionsForScope(
        state,
        academicScope
      ),
      quizzes: studentVisibleQuizzes,
      quizQuestionPreviews: quizQuestionPreviewsForRuns(state, courseRunIds),
      quizAttempts: quizAttemptsForScope(state, academicScope).filter(attempt =>
        studentVisibleQuizIds.has(attempt.quizId)
      ),
      grades: gradesForScope(state, academicScope),
      events: state.events.filter(item =>
        item.classGroupId
          ? classGroupIds.has(item.classGroupId)
          : item.ownerId === session.userId
      ),
      classSessions: state.classSessions.filter(item =>
        classGroupIds.has(item.classGroupId)
      ),
      meetingLinks: state.meetingLinks.filter(item =>
        academicScope.meetingLinkIds.has(item.id)
      ),
      attendance: attendanceForScope(state, academicScope, classGroupIds),
      attendanceExceptions: state.attendanceExceptions.filter(
        item => item.studentId === student.id
      ),
      invoices,
      payments: state.payments.filter(item => invoiceIds.has(item.invoiceId)),
      packages: state.packages.filter(item => courseIds.has(item.courseId)),
      certificates,
      quranPlans: quranRows.quranPlans,
      quranProgress: quranRows.quranProgress,
      recitationSubmissions: quranRows.recitationSubmissions,
      messages,
      documents: state.documents.filter(
        item => item.ownerId === student.id || item.ownerId === session.userId
      ),
      notifications: state.notifications.filter(
        item => item.userId === session.userId
      ),
      auditLogs: state.auditLogs.filter(
        item =>
          item.entityType === "AttendanceExceptionRequest" &&
          state.attendanceExceptions.some(
            request =>
              request.id === item.entityId && request.studentId === student.id
          )
      ),
      supportTickets: state.supportTickets.filter(
        item => item.requesterId === session.userId
      ),
      reportPresets: reportPresetsForSession(state, session),
    };
  }

  if (
    session.activeRole === "teacher" &&
    teacher?.status === "active" &&
    staffProfile
  ) {
    const branchIds = branchIdsForProfile(state, staffProfile);
    const departmentIds = departmentIdsForProfile(state, staffProfile);
    if (!branchIds.size || !departmentIds.size) {
      return safeUnmappedRoleState(state, session);
    }
    const assignedRuns = state.courseRuns.filter(item => {
      const departmentId = courseDepartmentId(state, item.courseId);
      return (
        item.teacherId === session.userId &&
        branchIds.has(item.branchId) &&
        Boolean(departmentId && departmentIds.has(departmentId))
      );
    });
    const courseRunIds = new Set(assignedRuns.map(item => item.id));
    const courseIds = new Set(assignedRuns.map(item => item.courseId));
    const visibleBranchIds = new Set(assignedRuns.map(item => item.branchId));
    const classGroupIds = new Set(
      state.classGroups
        .filter(item => courseRunIds.has(item.courseRunId))
        .map(item => item.id)
    );
    const teacherEnrollments = state.enrollments.filter(item => {
      if (!item.classGroupId || !classGroupIds.has(item.classGroupId))
        return false;
      const group = state.classGroups.find(
        candidate => candidate.id === item.classGroupId
      );
      return Boolean(
        group &&
          group.courseRunId === item.courseRunId &&
          courseRunIds.has(item.courseRunId) &&
          enrollmentHasRosterMembership(state, item)
      );
    });
    const studentIds = new Set(teacherEnrollments.map(item => item.studentId));
    const catalog = catalogForCourseIds(state, courseIds);
    const academicScope = buildAcademicReadScope(
      state,
      courseRunIds,
      classGroupIds,
      teacherEnrollments
    );
    const quranRows = quranRowsForScope(state, academicScope);
    const messages = messagesForSession(state, session.userId);
    const studentUserIds = state.students
      .filter(item => studentIds.has(item.id))
      .map(item => item.userId);
    const communicationUserIds = new Set([session.userId, ...studentUserIds]);
    const communicationLogs = communicationLogsForScope(
      state,
      session.userId,
      communicationUserIds
    );
    const eventIds = new Set(
      state.events
        .filter(
          item =>
            (item.classGroupId
              ? classGroupIds.has(item.classGroupId)
              : false) ||
            (item.ownerId === session.userId &&
              (!item.branchId || branchIds.has(item.branchId)))
        )
        .map(item => item.id)
    );
    const roomIds = new Set(
      state.classGroups
        .filter(item => classGroupIds.has(item.id) && item.roomId)
        .map(item => item.roomId!)
    );
    const auditLogs = scopedAuditRows(
      state,
      classGroupIds,
      eventIds,
      new Set(),
      session.userId,
      courseIds,
      roomIds
    );
    const referenceUserIds = new Set([
      ...messages.flatMap(item => [item.fromUserId, item.toUserId]),
      ...communicationLogs.flatMap(item =>
        item.relatedUserId ? [item.actorId, item.relatedUserId] : [item.actorId]
      ),
      ...auditLogs.map(item => item.actorId),
    ]);
    return {
      ...base,
      users: directoryUsersForSession(
        state,
        session,
        new Set(studentUserIds),
        referenceUserIds
      ),
      branches: state.branches.filter(item => visibleBranchIds.has(item.id)),
      departments: departmentsForBranches(
        catalog.departments,
        visibleBranchIds
      ),
      programs: catalog.programs,
      levels: catalog.levels,
      courses: catalog.courses,
      modules: catalog.modules,
      lessons: catalog.lessons,
      resources: catalog.resources,
      courseRuns: assignedRuns,
      classGroups: classGroupsForScope(state, classGroupIds, studentIds),
      students: academicStudentProfiles(
        state.students.filter(item => studentIds.has(item.id))
      ),
      teachers: teacherProfilesForRuns(
        state,
        new Set([session.userId]),
        courseRunIds,
        classGroupIds
      ),
      staffProfiles: [staffProfile],
      enrollments: enrollmentsWithAuthoritativeTeachers(
        state,
        teacherEnrollments
      ),
      lessonProgress: lessonProgressForScope(state, academicScope),
      assignments: state.assignments.filter(item =>
        courseRunIds.has(item.courseRunId)
      ),
      assignmentSubmissions: assignmentSubmissionsForScope(
        state,
        academicScope
      ),
      quizzes: state.quizzes.filter(item => courseRunIds.has(item.courseRunId)),
      questionBankItems: state.questionBankItems.filter(item =>
        courseRunIds.has(item.courseRunId)
      ),
      quizAttempts: quizAttemptsForScope(state, academicScope),
      grades: gradesForScope(state, academicScope),
      events: state.events.filter(item => eventIds.has(item.id)),
      classSessions: state.classSessions.filter(item =>
        classGroupIds.has(item.classGroupId)
      ),
      teacherAvailability: state.teacherAvailability.filter(
        item =>
          item.teacherId === session.userId && branchIds.has(item.branchId)
      ),
      rooms: state.rooms.filter(item => roomIds.has(item.id)),
      meetingLinks: state.meetingLinks.filter(item =>
        academicScope.meetingLinkIds.has(item.id)
      ),
      attendance: attendanceForScope(state, academicScope, classGroupIds),
      attendanceExceptions: state.attendanceExceptions.filter(item =>
        classGroupIds.has(item.classGroupId)
      ),
      quranPlans: quranRows.quranPlans,
      quranProgress: quranRows.quranProgress,
      recitationSubmissions: quranRows.recitationSubmissions,
      messages,
      communicationLogs,
      documents: state.documents.filter(
        item => item.ownerId === session.userId
      ),
      notifications: state.notifications.filter(
        item => item.userId === session.userId
      ),
      reportPresets: reportPresetsForSession(state, session),
      auditLogs,
    };
  }

  if (session.activeRole === "branchadmin" && staffProfile) {
    const branchIds = branchIdsForProfile(state, staffProfile);
    branchIds.delete("br_global");
    if (!branchIds.size) return safeUnmappedRoleState(state, session);
    const assignedRuns = state.courseRuns.filter(item =>
      branchIds.has(item.branchId)
    );
    const courseRunIds = new Set(assignedRuns.map(item => item.id));
    const courseIds = new Set(assignedRuns.map(item => item.courseId));
    const classGroupIds = new Set(
      state.classGroups
        .filter(item => courseRunIds.has(item.courseRunId))
        .map(item => item.id)
    );
    const branchEnrollments = state.enrollments.filter(item =>
      courseRunIds.has(item.courseRunId)
    );
    const academicStudentIds = new Set(
      branchEnrollments.map(item => item.studentId)
    );
    const sameBranchStudentIds = new Set(
      state.students
        .filter(item => {
          const studentUser = state.users.find(
            userItem => userItem.id === item.userId
          );
          return hasBranchAccess(branchIds, studentUser?.branchId);
        })
        .map(item => item.id)
    );
    const studentIds = new Set([
      ...Array.from(academicStudentIds),
      ...Array.from(sameBranchStudentIds),
    ]);
    const teacherUserIds = new Set(assignedRuns.map(item => item.teacherId));
    const teacherStaffProfiles = state.staffProfiles.filter(
      item =>
        item.role === "teacher" &&
        item.status === "active" &&
        teacherUserIds.has(item.userId) &&
        item.branchIds.some(branchId => branchIds.has(branchId))
    );
    const catalog = catalogForCourseIds(state, courseIds);
    const catalogDepartmentIds = new Set(
      catalog.departments.map(item => item.id)
    );
    const profileDepartments = state.departments.filter(item =>
      staffProfile.departmentIds.includes(item.id)
    );
    const departmentById = new Map(
      [...catalog.departments, ...profileDepartments].map(item => [
        item.id,
        item,
      ])
    );
    const academicScope = buildAcademicReadScope(
      state,
      courseRunIds,
      classGroupIds,
      branchEnrollments
    );
    const quranRows = quranRowsForScope(state, academicScope);
    const invoiceIds = new Set(
      state.invoices
        .filter(item => {
          const branchId = branchIdForInvoice(state, item);
          return Boolean(branchId && branchIds.has(branchId));
        })
        .map(item => item.id)
    );
    const paymentIds = new Set(
      state.payments
        .filter(item => invoiceIds.has(item.invoiceId))
        .map(item => item.id)
    );
    const eventIds = new Set(
      state.events
        .filter(
          item =>
            hasBranchAccess(branchIds, item.branchId) ||
            (item.classGroupId ? classGroupIds.has(item.classGroupId) : false)
        )
        .map(item => item.id)
    );
    const roomIds = new Set(
      state.rooms
        .filter(item => branchIds.has(item.branchId))
        .map(item => item.id)
    );
    const messages = messagesForSession(state, session.userId);
    const studentUserIds = state.students
      .filter(item => studentIds.has(item.id))
      .map(item => item.userId);
    const communicationUserIds = new Set([
      session.userId,
      ...studentUserIds,
      ...Array.from(teacherUserIds),
    ]);
    const communicationLogs = communicationLogsForScope(
      state,
      session.userId,
      communicationUserIds
    );
    const auditLogs = scopedAuditRows(
      state,
      classGroupIds,
      eventIds,
      new Set(),
      session.userId,
      courseIds,
      roomIds,
      invoiceIds,
      paymentIds
    );
    const referenceUserIds = new Set([
      ...messages.flatMap(item => [item.fromUserId, item.toUserId]),
      ...communicationLogs.flatMap(item =>
        item.relatedUserId ? [item.actorId, item.relatedUserId] : [item.actorId]
      ),
      ...auditLogs.map(item => item.actorId),
    ]);
    return {
      ...base,
      users: directoryUsersForSession(
        state,
        session,
        new Set([...studentUserIds, ...Array.from(teacherUserIds)]),
        referenceUserIds
      ),
      branches: state.branches.filter(item => branchIds.has(item.id)),
      departments: departmentsForBranches(
        Array.from(departmentById.values()),
        branchIds
      ),
      programs: catalog.programs,
      levels: catalog.levels,
      courses: catalog.courses,
      modules: catalog.modules,
      lessons: catalog.lessons,
      resources: catalog.resources,
      courseRuns: assignedRuns,
      classGroups: classGroupsForScope(
        state,
        classGroupIds,
        academicStudentIds
      ),
      students: academicStudentProfiles(
        state.students.filter(item => studentIds.has(item.id))
      ),
      teachers: teacherProfilesForRuns(
        state,
        teacherUserIds,
        courseRunIds,
        classGroupIds
      ),
      staffProfiles: [
        staffProfile,
        ...staffProfilesForScope(
          teacherStaffProfiles,
          branchIds,
          catalogDepartmentIds
        ),
      ],
      enrollments: enrollmentsWithAuthoritativeTeachers(
        state,
        branchEnrollments
      ),
      lessonProgress: lessonProgressForScope(state, academicScope),
      assignments: state.assignments.filter(item =>
        courseRunIds.has(item.courseRunId)
      ),
      assignmentSubmissions: assignmentSubmissionsForScope(
        state,
        academicScope
      ),
      quizzes: state.quizzes.filter(item => courseRunIds.has(item.courseRunId)),
      questionBankItems: state.questionBankItems.filter(item =>
        courseRunIds.has(item.courseRunId)
      ),
      quizAttempts: quizAttemptsForScope(state, academicScope),
      grades: gradesForScope(state, academicScope),
      events: state.events.filter(item => eventIds.has(item.id)),
      classSessions: state.classSessions.filter(item =>
        classGroupIds.has(item.classGroupId)
      ),
      teacherAvailability: state.teacherAvailability.filter(
        item =>
          branchIds.has(item.branchId) && teacherUserIds.has(item.teacherId)
      ),
      rooms: state.rooms.filter(item => roomIds.has(item.id)),
      meetingLinks: state.meetingLinks.filter(item =>
        academicScope.meetingLinkIds.has(item.id)
      ),
      attendance: attendanceForScope(state, academicScope, classGroupIds),
      attendanceExceptions: state.attendanceExceptions.filter(item =>
        classGroupIds.has(item.classGroupId)
      ),
      invoices: state.invoices.filter(item => invoiceIds.has(item.id)),
      payments: state.payments.filter(item => paymentIds.has(item.id)),
      packages: state.packages.filter(item => courseIds.has(item.courseId)),
      quranPlans: quranRows.quranPlans,
      quranProgress: quranRows.quranProgress,
      recitationSubmissions: quranRows.recitationSubmissions,
      messages,
      communicationLogs,
      messageTemplates: state.messageTemplates.filter(
        item => item.category === "finance"
      ),
      notifications: state.notifications.filter(
        item => item.userId === session.userId
      ),
      supportTickets: state.supportTickets.filter(
        item => item.requesterId === session.userId
      ),
      portalSettings: portalSettingsForSession(state, session, staffProfile),
      reportPresets: reportPresetsForSession(state, session),
      auditLogs,
    };
  }

  if (session.activeRole === "registrar" && staffProfile) {
    const branchIds = branchIdsForProfile(state, staffProfile);
    branchIds.delete("br_global");
    if (!branchIds.size) return safeUnmappedRoleState(state, session);
    const assignedRuns = state.courseRuns.filter(item =>
      branchIds.has(item.branchId)
    );
    const courseRunIds = new Set(assignedRuns.map(item => item.id));
    const courseIds = new Set(assignedRuns.map(item => item.courseId));
    const classGroupIds = new Set(
      state.classGroups
        .filter(item => courseRunIds.has(item.courseRunId))
        .map(item => item.id)
    );
    const branchEnrollmentStudentIds = new Set(
      state.enrollments
        .filter(item => courseRunIds.has(item.courseRunId))
        .map(item => item.studentId)
    );
    const sameBranchStudentIds = new Set(
      state.students
        .filter(item => {
          const studentUser = state.users.find(
            userItem => userItem.id === item.userId
          );
          return hasBranchAccess(branchIds, studentUser?.branchId);
        })
        .map(item => item.id)
    );
    const studentIds = new Set([
      ...Array.from(branchEnrollmentStudentIds),
      ...Array.from(sameBranchStudentIds),
    ]);
    const enrollments = state.enrollments.filter(
      item =>
        courseRunIds.has(item.courseRunId) && studentIds.has(item.studentId)
    );
    const enrollmentIds = new Set(enrollments.map(item => item.id));
    const teacherUserIds = new Set(assignedRuns.map(item => item.teacherId));
    const teacherStaffProfiles = state.staffProfiles.filter(
      item =>
        item.role === "teacher" &&
        item.status === "active" &&
        teacherUserIds.has(item.userId) &&
        item.branchIds.some(branchId => branchIds.has(branchId))
    );
    const catalog = catalogForCourseIds(state, courseIds);
    const catalogDepartmentIds = new Set(
      catalog.departments.map(item => item.id)
    );
    const profileDepartments = state.departments.filter(item =>
      staffProfile.departmentIds.includes(item.id)
    );
    const departmentById = new Map(
      [...catalog.departments, ...profileDepartments].map(item => [
        item.id,
        item,
      ])
    );
    const registrarScope = buildRegistrarReadScope(
      state,
      session.userId,
      branchIds,
      studentIds,
      courseRunIds,
      classGroupIds
    );
    const invoiceIds = new Set(
      state.invoices
        .filter(item => {
          const branchId = branchIdForInvoice(state, item);
          return Boolean(branchId && branchIds.has(branchId));
        })
        .map(item => item.id)
    );
    const paymentIds = new Set(
      state.payments
        .filter(item => invoiceIds.has(item.invoiceId))
        .map(item => item.id)
    );
    const registrarEventTypes = new Set([
      "placement_test",
      "trial_lesson",
      "room_booking",
      "reminder",
    ]);
    const eventIds = new Set(
      state.events
        .filter(
          item =>
            (item.classGroupId
              ? classGroupIds.has(item.classGroupId)
              : false) ||
            (registrarEventTypes.has(item.type) &&
              (item.ownerId === session.userId ||
                hasBranchAccess(branchIds, item.branchId)))
        )
        .map(item => item.id)
    );
    const messages = messagesForSession(state, session.userId);
    const studentUserIds = state.students
      .filter(item => studentIds.has(item.id))
      .map(item => item.userId);
    const communicationUserIds = new Set([
      session.userId,
      ...studentUserIds,
      ...Array.from(teacherUserIds),
    ]);
    const communicationLogs = communicationLogsForScope(
      state,
      session.userId,
      communicationUserIds
    );
    const auditLogs = registrarAuditRows(
      state,
      registrarScope,
      studentIds,
      enrollmentIds,
      invoiceIds,
      paymentIds,
      eventIds,
      session.userId
    );
    const referenceUserIds = new Set([
      ...messages.flatMap(item => [item.fromUserId, item.toUserId]),
      ...communicationLogs.flatMap(item =>
        item.relatedUserId ? [item.actorId, item.relatedUserId] : [item.actorId]
      ),
      ...auditLogs.map(item => item.actorId),
    ]);
    return {
      ...base,
      users: directoryUsersForSession(
        state,
        session,
        new Set([...studentUserIds, ...Array.from(teacherUserIds)]),
        referenceUserIds
      ),
      branches: state.branches.filter(item => branchIds.has(item.id)),
      departments: departmentsForBranches(
        Array.from(departmentById.values()),
        branchIds
      ),
      programs: catalog.programs,
      levels: catalog.levels,
      courses: catalog.courses,
      courseRuns: assignedRuns,
      classGroups: classGroupsForScope(state, classGroupIds, studentIds),
      students: state.students.filter(item => studentIds.has(item.id)),
      teachers: teacherProfilesForRuns(
        state,
        teacherUserIds,
        courseRunIds,
        classGroupIds
      ),
      staffProfiles: [
        staffProfile,
        ...staffProfilesForScope(
          teacherStaffProfiles,
          branchIds,
          catalogDepartmentIds
        ),
      ],
      enrollments: enrollmentsWithAuthoritativeTeachers(state, enrollments),
      events: state.events.filter(item => eventIds.has(item.id)),
      classSessions: state.classSessions.filter(item =>
        classGroupIds.has(item.classGroupId)
      ),
      rooms: state.rooms.filter(item => branchIds.has(item.branchId)),
      leads: registrarScope.leads,
      applications: registrarScope.applications,
      placementTests: registrarScope.placementTests,
      placementResults: registrarScope.placementResults,
      enrollmentWorkflows: registrarScope.enrollmentWorkflows,
      invoices: state.invoices.filter(item => invoiceIds.has(item.id)),
      payments: state.payments.filter(item => paymentIds.has(item.id)),
      packages: state.packages.filter(item => courseIds.has(item.courseId)),
      messages,
      communicationLogs,
      messageTemplates: state.messageTemplates.filter(item =>
        ["admissions", "finance"].includes(item.category)
      ),
      documents: state.documents.filter(
        item => item.ownerId === session.userId || studentIds.has(item.ownerId)
      ),
      notifications: state.notifications.filter(
        item => item.userId === session.userId
      ),
      portalSettings: portalSettingsForSession(state, session, staffProfile),
      reportPresets: reportPresetsForSession(state, session),
      auditLogs,
    };
  }

  if (session.activeRole === "headofdepartment" && staffProfile) {
    const departmentIds = departmentIdsForProfile(state, staffProfile);
    const branchIds = branchIdsForProfile(state, staffProfile);
    if (!departmentIds.size || !branchIds.size) {
      return safeUnmappedRoleState(state, session);
    }
    const globalBranchScope = branchIds.has("br_global");
    const programs = state.programs.filter(item =>
      departmentIds.has(item.departmentId)
    );
    const programIds = new Set(programs.map(item => item.id));
    const courses = state.courses.filter(item =>
      programIds.has(item.programId)
    );
    const courseIds = new Set(courses.map(item => item.id));
    const assignedRuns = state.courseRuns.filter(
      item =>
        courseIds.has(item.courseId) &&
        hasBranchAccess(branchIds, item.branchId, true)
    );
    const courseRunIds = new Set(assignedRuns.map(item => item.id));
    const visibleBranchIds = globalBranchScope
      ? new Set([
          ...state.departments
            .filter(item => departmentIds.has(item.id))
            .flatMap(item => item.branchIds),
          ...assignedRuns.map(item => item.branchId),
        ])
      : new Set(Array.from(branchIds).filter(item => item !== "br_global"));
    const classGroupIds = new Set(
      state.classGroups
        .filter(item => courseRunIds.has(item.courseRunId))
        .map(item => item.id)
    );
    const departmentEnrollments = state.enrollments.filter(item =>
      courseRunIds.has(item.courseRunId)
    );
    const studentIds = new Set(
      departmentEnrollments.map(item => item.studentId)
    );
    const teacherStaffProfiles = state.staffProfiles.filter(
      item =>
        item.role === "teacher" &&
        item.status === "active" &&
        item.departmentIds.some(departmentId =>
          departmentIds.has(departmentId)
        ) &&
        (globalBranchScope ||
          item.branchIds.some(branchId => branchIds.has(branchId)))
    );
    const teacherUserIds = new Set([
      ...teacherStaffProfiles.map(item => item.userId),
      ...assignedRuns.map(item => item.teacherId),
    ]);
    const modules = state.modules.filter(item => courseIds.has(item.courseId));
    const moduleIds = new Set(modules.map(item => item.id));
    const lessons = state.lessons.filter(item => moduleIds.has(item.moduleId));
    const lessonIds = new Set(lessons.map(item => item.id));
    const academicScope = buildAcademicReadScope(
      state,
      courseRunIds,
      classGroupIds,
      departmentEnrollments
    );
    const quranRows = quranRowsForScope(state, academicScope);
    const certificates = state.certificates.filter(
      item => courseIds.has(item.courseId) && studentIds.has(item.studentId)
    );
    const certificateIds = new Set(certificates.map(item => item.id));
    const certificateStudentIds = new Set(
      certificates.map(item => item.studentId)
    );
    const eventIds = new Set(
      state.events
        .filter(
          item =>
            (item.classGroupId
              ? classGroupIds.has(item.classGroupId)
              : false) ||
            (item.ownerId === session.userId &&
              (!item.branchId ||
                hasBranchAccess(branchIds, item.branchId, true)))
        )
        .map(item => item.id)
    );
    const roomIds = new Set(
      state.classGroups
        .filter(item => classGroupIds.has(item.id) && item.roomId)
        .map(item => item.roomId!)
    );
    const messages = messagesForSession(state, session.userId);
    const studentUserIds = state.students
      .filter(item => studentIds.has(item.id))
      .map(item => item.userId);
    const communicationUserIds = new Set([
      session.userId,
      ...studentUserIds,
      ...Array.from(teacherUserIds),
    ]);
    const communicationLogs = communicationLogsForScope(
      state,
      session.userId,
      communicationUserIds
    );
    const auditLogs = scopedAuditRows(
      state,
      classGroupIds,
      eventIds,
      certificateIds,
      session.userId,
      courseIds,
      roomIds
    );
    const referenceUserIds = new Set([
      ...messages.flatMap(item => [item.fromUserId, item.toUserId]),
      ...communicationLogs.flatMap(item =>
        item.relatedUserId ? [item.actorId, item.relatedUserId] : [item.actorId]
      ),
      ...auditLogs.map(item => item.actorId),
    ]);
    return {
      ...base,
      users: directoryUsersForSession(
        state,
        session,
        new Set([...studentUserIds, ...Array.from(teacherUserIds)]),
        referenceUserIds
      ),
      branches: state.branches.filter(item => visibleBranchIds.has(item.id)),
      departments: departmentsForBranches(
        state.departments.filter(item => departmentIds.has(item.id)),
        visibleBranchIds
      ),
      programs,
      levels: state.levels.filter(item => programIds.has(item.programId)),
      courses,
      modules,
      lessons,
      resources: state.resources.filter(item => lessonIds.has(item.lessonId)),
      courseRuns: assignedRuns,
      classGroups: classGroupsForScope(state, classGroupIds, studentIds),
      students: academicStudentProfiles(
        state.students.filter(item => studentIds.has(item.id))
      ),
      teachers: teacherProfilesForRuns(
        state,
        teacherUserIds,
        courseRunIds,
        classGroupIds
      ),
      staffProfiles: [
        staffProfile,
        ...staffProfilesForScope(
          teacherStaffProfiles,
          visibleBranchIds,
          departmentIds
        ),
      ],
      enrollments: enrollmentsWithAuthoritativeTeachers(
        state,
        departmentEnrollments
      ),
      lessonProgress: lessonProgressForScope(state, academicScope),
      assignments: state.assignments.filter(item =>
        courseRunIds.has(item.courseRunId)
      ),
      assignmentSubmissions: assignmentSubmissionsForScope(
        state,
        academicScope
      ),
      quizzes: state.quizzes.filter(item => courseRunIds.has(item.courseRunId)),
      questionBankItems: state.questionBankItems.filter(item =>
        courseRunIds.has(item.courseRunId)
      ),
      quizAttempts: quizAttemptsForScope(state, academicScope),
      grades: gradesForScope(state, academicScope),
      events: state.events.filter(item => eventIds.has(item.id)),
      classSessions: state.classSessions.filter(item =>
        classGroupIds.has(item.classGroupId)
      ),
      teacherAvailability: state.teacherAvailability.filter(
        item =>
          teacherUserIds.has(item.teacherId) &&
          hasBranchAccess(branchIds, item.branchId, true)
      ),
      rooms: state.rooms.filter(item => roomIds.has(item.id)),
      meetingLinks: state.meetingLinks.filter(item =>
        academicScope.meetingLinkIds.has(item.id)
      ),
      attendance: attendanceForScope(state, academicScope, classGroupIds),
      attendanceExceptions: state.attendanceExceptions.filter(item =>
        classGroupIds.has(item.classGroupId)
      ),
      certificates,
      quranPlans: quranRows.quranPlans,
      quranProgress: quranRows.quranProgress,
      recitationSubmissions: quranRows.recitationSubmissions,
      messages,
      communicationLogs,
      documents: state.documents.filter(
        item =>
          item.ownerId === session.userId ||
          (item.type === "certificate" &&
            certificateStudentIds.has(item.ownerId))
      ),
      notifications: state.notifications.filter(
        item => item.userId === session.userId
      ),
      supportTickets: state.supportTickets.filter(
        item => item.requesterId === session.userId
      ),
      portalSettings: portalSettingsForSession(state, session, staffProfile),
      reportPresets: reportPresetsForSession(state, session),
      auditLogs,
    };
  }

  return safeUnmappedRoleState(state, session);
}
