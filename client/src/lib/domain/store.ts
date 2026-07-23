import { seedPlatformState } from "./seed";
import {
  applyCompleteLesson,
  applyPlatformWorkflowAction,
  applyStartLesson,
  applySubmitAssignment,
  applySubmitQuizAttempt,
  type AssignTeacherActionInput,
  type PlatformWorkflowAction,
} from "./actions";
import {
  fetchPlatformStateRequest,
  runPlatformWorkflowActionRequest,
} from "../backend/api";
import { getStoredAuthSession } from "../auth/session";
import type {
  AttendanceStatus,
  AuditLog,
  CalendarEvent,
  CalendarEventType,
  Certificate,
  CommunicationLog,
  EntityStatus,
  Lead,
  Message,
  MessageAttachment,
  Notification,
  Payment,
  PendingMediaAttachment,
  PlacementTestBooking,
  PlacementTestResult,
  PlatformState,
  QuranProgressRecord,
  RecitationSubmission,
  ReportPreset,
  ReportType,
} from "./types";

const PLATFORM_STATE_UPDATED_EVENT = "nilelearn:platform-state-updated";
export const PLATFORM_SYNC_ERROR_EVENT = "nilelearn:platform-sync-error";

type CreateLeadInput = Pick<
  Lead,
  "fullName" | "email" | "phone" | "subject" | "notes"
> & {
  country?: string;
  source?: Lead["source"];
};

type CreateApplicationInput = {
  fullName: string;
  email: string;
  phone: string;
  branchId: string;
  courseInterest: string;
  schedulePreference: string;
  country?: string;
  notes?: string;
  source?: Lead["source"];
};

type CreatePlacementInput = Pick<
  PlacementTestBooking,
  "fullName" | "email" | "phone" | "subject" | "preferredDate" | "currentLevel"
> & {
  branchId?: string;
  leadId?: string;
};

type CreateCalendarEventInput = {
  title: string;
  type: CalendarEventType;
  startsAt: string;
  endsAt: string;
  ownerId?: string;
  branchId?: string;
  roomId?: string;
  classGroupId?: string;
};

type CreateAssignmentInput = {
  courseRunId: string;
  title: string;
  dueAt: string;
  submissionType: "text" | "file" | "audio" | "video";
  rubric: string[];
};

type CreateQuizInput = {
  courseRunId: string;
  title: string;
  dueAt: string;
  durationMinutes: number;
  questionTypes: string[];
  questionIds?: string[];
  attemptsAllowed: number;
};

type CreateQuestionInput = {
  courseRunId: string;
  prompt: string;
  questionType: PlatformState["questionBankItems"][number]["type"];
  difficulty: PlatformState["questionBankItems"][number]["difficulty"];
  tags: string[];
  choices?: string[];
  answerKey?: string;
  rubric?: string[];
};

type SendMessageInput = {
  fromUserId: string;
  toUserId: string;
  recipientUserIds?: string[];
  subject: string;
  body: string;
  channel?: CommunicationLog["channel"];
  attachments?: MessageAttachment[];
};

type SubmitRecitationInput = Pick<
  RecitationSubmission,
  "studentId" | "teacherId" | "title"
> & {
  pendingMedia?: PendingMediaAttachment[];
};

function now() {
  return new Date().toISOString();
}

function createId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
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

function cloneSeed(): PlatformState {
  return JSON.parse(JSON.stringify(seedPlatformState)) as PlatformState;
}

function createEmptyState(): PlatformState {
  const state = cloneSeed() as PlatformState & Record<string, unknown>;
  for (const [key, value] of Object.entries(state)) {
    if (Array.isArray(value)) state[key] = [];
  }
  return state;
}

function normalizeStoredState(value: unknown): PlatformState {
  if (!value || typeof value !== "object") return createEmptyState();
  const empty = createEmptyState();
  const stored = value as Partial<PlatformState>;
  return {
    ...empty,
    ...stored,
    classGroups: (stored.classGroups ?? empty.classGroups).map(group => ({
      ...group,
      status: group.status ?? "active",
    })),
  };
}

class PlatformStore {
  private state: PlatformState | null = null;
  private syncQueue: Promise<void> = Promise.resolve();

  private appendAudit(
    state: PlatformState,
    action: string,
    entityType: string,
    entityId: string,
    summary: string,
    actorId = "usr_admin_demo"
  ) {
    const audit: AuditLog = {
      id: createId("audit"),
      actorId,
      action,
      entityType,
      entityId,
      summary,
      createdAt: now(),
    };
    state.auditLogs = [audit, ...state.auditLogs].slice(0, 160);
    return audit;
  }

  private notify(
    state: PlatformState,
    input: Omit<Notification, "id" | "read" | "createdAt">
  ) {
    const notification: Notification = {
      id: createId("not"),
      read: false,
      createdAt: now(),
      ...input,
    };
    state.notifications = [notification, ...state.notifications].slice(0, 80);
    return notification;
  }

  getState(): PlatformState {
    this.state ??= createEmptyState();
    return JSON.parse(JSON.stringify(this.state)) as PlatformState;
  }

  reset() {
    this.setState(cloneSeed());
  }

  clear() {
    this.setState(createEmptyState());
  }

  setState(state: PlatformState) {
    this.state = normalizeStoredState(
      JSON.parse(JSON.stringify(state)) as PlatformState
    );
    if (typeof window === "undefined") return;
    if (
      typeof window.dispatchEvent === "function" &&
      typeof CustomEvent !== "undefined"
    ) {
      window.dispatchEvent(new CustomEvent(PLATFORM_STATE_UPDATED_EVENT));
    }
  }

  private syncAction(
    action: PlatformWorkflowAction,
    previousState: PlatformState
  ) {
    if (
      typeof window === "undefined" ||
      typeof window.dispatchEvent !== "function"
    )
      return;
    this.syncQueue = this.syncQueue.then(async () => {
      const result = await runPlatformWorkflowActionRequest(action);
      if (result.ok && result.data) {
        this.setState(result.data.state);
        return;
      }

      const authoritative = await fetchPlatformStateRequest();
      if (authoritative.ok && authoritative.data) {
        this.setState(authoritative.data.state);
      } else {
        this.setState(previousState);
      }
      if (typeof CustomEvent !== "undefined") {
        window.dispatchEvent(
          new CustomEvent(PLATFORM_SYNC_ERROR_EVENT, {
            detail: {
              action: action.type,
              error:
                result.error ??
                authoritative.error ??
                "The change was not saved by the server.",
            },
          })
        );
      }
    });
  }

  applyAction(action: PlatformWorkflowAction) {
    if (typeof window !== "undefined" && typeof document !== "undefined") {
      throw new Error(
        "Browser workflow mutations must use the server action API."
      );
    }
    const session = getStoredAuthSession();
    if (session?.authorizationModel === "normalized") {
      throw new Error(
        "This action is unavailable until its normalized workflow repository is active."
      );
    }
    const state = this.getState();
    const previousState = JSON.parse(JSON.stringify(state)) as PlatformState;
    const result = applyPlatformWorkflowAction(state, action, {
      createId,
      now,
    });
    this.setState(state);
    this.syncAction(action, previousState);
    return result;
  }

  audit(
    action: string,
    entityType: string,
    entityId: string,
    summary: string,
    actorId = "usr_admin_demo"
  ) {
    if (typeof window !== "undefined" && typeof document !== "undefined") {
      throw new Error("Browser audit writes must use the server action API.");
    }
    const state = this.getState();
    const audit = this.appendAudit(
      state,
      action,
      entityType,
      entityId,
      summary,
      actorId
    );
    this.setState(state);
    return audit;
  }

  createLead(input: CreateLeadInput) {
    return this.applyAction({ type: "lead.create", ...input }).result as Lead;
  }

  createApplication(
    input: CreateApplicationInput,
    actorId = "usr_registrar_demo"
  ) {
    return this.applyAction({ type: "application.create", ...input, actorId })
      .result as {
      lead: Lead;
      application: PlatformState["applications"][number];
      communicationLog: CommunicationLog;
    };
  }

  createPlacementBooking(input: CreatePlacementInput) {
    return this.applyAction({ type: "placement.create", ...input })
      .result as PlacementTestBooking;
  }

  startLesson(
    lessonId: string,
    studentId = "stu_demo",
    actorId = "usr_student_demo",
    enrollmentId?: string
  ) {
    return this.applyAction({
      type: "lesson.start",
      lessonId,
      enrollmentId,
      studentId,
      actorId,
    }).result as ReturnType<typeof applyStartLesson>;
  }

  completeLesson(
    lessonId: string,
    studentId = "stu_demo",
    actorId = "usr_student_demo",
    enrollmentId?: string
  ) {
    return this.applyAction({
      type: "lesson.complete",
      lessonId,
      enrollmentId,
      studentId,
      actorId,
    }).result as ReturnType<typeof applyCompleteLesson>;
  }

  submitAssignment(
    assignmentId: string,
    response: string,
    studentId = "stu_demo",
    actorId = "usr_student_demo",
    pendingMedia: PendingMediaAttachment[] = []
  ) {
    return this.applyAction({
      type: "assignment.submit",
      assignmentId,
      response,
      pendingMedia,
      studentId,
      actorId,
    }).result as ReturnType<typeof applySubmitAssignment>;
  }

  submitQuizAttempt(
    quizId: string,
    answers: Record<string, string>,
    studentId = "stu_demo",
    actorId = "usr_student_demo",
    pendingMedia: PendingMediaAttachment[] = []
  ) {
    return this.applyAction({
      type: "quiz.submit",
      quizId,
      answers,
      pendingMedia,
      studentId,
      actorId,
    }).result as ReturnType<typeof applySubmitQuizAttempt>;
  }

  createAssignment(input: CreateAssignmentInput, actorId = "usr_teacher_demo") {
    return this.applyAction({ type: "assignment.create", ...input, actorId })
      .result as PlatformState["assignments"][number];
  }

  createQuiz(input: CreateQuizInput, actorId = "usr_teacher_demo") {
    return this.applyAction({ type: "quiz.create", ...input, actorId })
      .result as PlatformState["quizzes"][number];
  }

  createQuestionBankItem(
    input: CreateQuestionInput,
    actorId = "usr_teacher_demo"
  ) {
    return this.applyAction({ type: "question.create", ...input, actorId })
      .result as PlatformState["questionBankItems"][number];
  }

  setQuizQuestions(
    quizId: string,
    questionIds: string[],
    actorId = "usr_teacher_demo"
  ) {
    return this.applyAction({
      type: "quiz.questions.set",
      quizId,
      questionIds,
      actorId,
    }).result as PlatformState["quizzes"][number];
  }

  gradeAssignmentSubmission(
    submissionId: string,
    score: number,
    feedback: string,
    actorId = "usr_teacher_demo"
  ) {
    return this.applyAction({
      type: "assignment.grade",
      submissionId,
      score,
      feedback,
      actorId,
    }).result as PlatformState["assignmentSubmissions"][number] | undefined;
  }

  reviewQuizAttempt(
    attemptId: string,
    score: number,
    feedback: string,
    actorId = "usr_teacher_demo"
  ) {
    return this.applyAction({
      type: "quiz.review",
      attemptId,
      score,
      feedback,
      actorId,
    }).result as PlatformState["quizAttempts"][number] | undefined;
  }

  saveAttendanceBulk(
    classGroupId: string,
    sessionId: string,
    statuses: Record<string, AttendanceStatus>,
    notesOrActorId: Record<string, string> | string = {},
    actorId = "usr_teacher_demo"
  ) {
    const notes = typeof notesOrActorId === "string" ? {} : notesOrActorId;
    const nextActorId =
      typeof notesOrActorId === "string" ? notesOrActorId : actorId;
    return this.applyAction({
      type: "attendance.save",
      classGroupId,
      sessionId,
      statuses,
      notes,
      actorId: nextActorId,
    }).result as PlatformState["attendance"];
  }

  createCalendarEvent(
    input: CreateCalendarEventInput,
    actorId = "usr_branch_demo"
  ) {
    const { type: eventType, ...eventInput } = input;
    return this.applyAction({
      type: "calendar.create",
      ...eventInput,
      eventType,
      actorId,
    }).result as {
      event: CalendarEvent;
      conflicts: CalendarEvent[];
      availabilityGaps: string[];
    };
  }

  sendMessage(input: SendMessageInput) {
    return this.applyAction({
      type: "message.send",
      ...input,
      actorId: input.fromUserId,
    }).result as Message;
  }

  approveCertificate(certificateId: string, actorId: string) {
    return this.applyAction({
      type: "certificate.approve",
      certificateId,
      actorId,
    }).result as Certificate | undefined;
  }

  issueCertificate(certificateId: string, actorId: string) {
    return this.applyAction({
      type: "certificate.issue",
      certificateId,
      actorId,
    }).result as Certificate | undefined;
  }

  rejectCertificate(certificateId: string, actorId: string, reason: string) {
    return this.applyAction({
      type: "certificate.reject",
      certificateId,
      reason,
      actorId,
    }).result as Certificate | undefined;
  }

  recordPayment(
    invoiceId: string,
    actorId = "usr_registrar_demo",
    input: {
      amount?: number;
      method?: Payment["method"];
      reference?: string;
    } = {}
  ) {
    return this.applyAction({
      type: "payment.record",
      invoiceId,
      actorId,
      ...input,
    }).result as Payment | undefined;
  }

  recordPlacementResult(
    bookingId: string,
    recommendedLevel: string,
    score: number,
    notes: string,
    actorId = "usr_registrar_demo"
  ) {
    return this.applyAction({
      type: "placement.result.record",
      bookingId,
      recommendedLevel,
      score,
      notes,
      actorId,
    }).result as PlacementTestResult | undefined;
  }

  convertLeadToApplication(leadId: string, actorId = "usr_registrar_demo") {
    return this.applyAction({ type: "lead.convert", leadId, actorId })
      .result as PlatformState["applications"][number] | undefined;
  }

  convertApplicationToEnrollment(
    applicationId: string,
    actorId = "usr_registrar_demo"
  ) {
    return this.applyAction({
      type: "application.convert",
      applicationId,
      actorId,
    }).result as PlatformState["enrollmentWorkflows"][number] | undefined;
  }

  createStudent(
    input: Extract<
      import("./actions").PlatformWorkflowAction,
      { type: "student.create" }
    >
  ) {
    return this.applyAction(input).result;
  }

  updateStudentStatus(
    studentId: string,
    status: PlatformState["students"][number]["status"],
    actorId = "usr_registrar_demo"
  ) {
    return this.applyAction({
      type: "student.status.update",
      studentId,
      status,
      actorId,
    }).result as PlatformState["students"][number] | undefined;
  }

  activateEnrollmentWorkflow(
    workflowId: string,
    options: {
      courseRunId?: string;
      classGroupId?: string;
      actorId?: string;
    } = {}
  ) {
    return this.applyAction({
      type: "enrollment.activate",
      workflowId,
      courseRunId: options.courseRunId,
      classGroupId: options.classGroupId,
      actorId: options.actorId ?? "usr_registrar_demo",
    }).result as PlatformState["students"][number] | undefined;
  }

  assignTeacherToCourseRun(
    userId: string,
    courseRunId: string,
    options: Omit<
      AssignTeacherActionInput,
      "userId" | "courseRunId" | "type"
    > = {}
  ) {
    return this.applyAction({
      type: "teacher.assign",
      userId,
      courseRunId,
      status: options.status,
      departmentId: options.departmentId,
      specialties: options.specialties,
      teachingLevels: options.teachingLevels,
      availability: options.availability,
      actorId: options.actorId ?? "usr_admin_demo",
    }).result as {
      teacher: PlatformState["users"][number];
      previousTeacher?: PlatformState["users"][number];
      previousTeacherId?: string;
      profile?: PlatformState["teachers"][number];
      courseRun: PlatformState["courseRuns"][number];
      classGroups: PlatformState["classGroups"];
      availability: PlatformState["teacherAvailability"];
    };
  }

  verifyCertificate(code: string) {
    const state = this.getState();
    const normalized = code.trim().toLowerCase();
    if (!normalized) return null;
    const certificate = state.certificates.find(
      item =>
        item.status === "issued" &&
        item.verificationCode.toLowerCase() === normalized
    );
    if (!certificate) return null;
    const student = state.students.find(
      item => item.id === certificate.studentId
    );
    const user = state.users.find(item => item.id === student?.userId);
    const course = state.courses.find(item => item.id === certificate.courseId);
    return {
      verificationCode: certificate.verificationCode,
      studentName: user?.name ?? "Nile Learn student",
      courseTitle: course?.title ?? "Nile Learn course",
      status: "issued" as const,
      issuedAt: certificate.issuedAt,
    };
  }

  exportReportRows(reportType: ReportType) {
    const state = this.getState();
    if (reportType === "attendance") {
      return state.attendance.map(record => ({
        id: record.id,
        classGroupId: record.classGroupId,
        studentId: record.studentId,
        sessionId: record.sessionId,
        status: record.status,
        notes: record.notes ?? "",
      }));
    }
    if (reportType === "finance") {
      return state.invoices.map(invoice => {
        const paid = state.payments
          .filter(
            payment =>
              payment.invoiceId === invoice.id && payment.status === "paid"
          )
          .reduce((sum, payment) => sum + payment.amount, 0);
        return {
          id: invoice.id,
          studentId: invoice.studentId,
          amount: invoice.amount,
          paid,
          balance: Math.max(0, invoice.amount - paid),
          currency: invoice.currency,
          dueAt: invoice.dueAt,
          status: invoice.status,
        };
      });
    }
    if (reportType === "audit") {
      return state.auditLogs.map(audit => ({
        id: audit.id,
        actorId: audit.actorId,
        action: audit.action,
        entityType: audit.entityType,
        entityId: audit.entityId,
        summary: audit.summary,
        createdAt: audit.createdAt,
      }));
    }
    return state.enrollments.map(enrollment => ({
      id: enrollment.id,
      studentId: enrollment.studentId,
      courseRunId: enrollment.courseRunId,
      status: enrollment.status,
      progress: enrollment.progress,
      attendanceRate: enrollment.attendanceRate,
      currentGrade: enrollment.currentGrade,
    }));
  }

  saveReportPreset(input: {
    role: ReportPreset["role"];
    label: string;
    reportType: ReportType;
    search?: string;
    status?: string;
    rowCount?: number;
    actorId?: string;
  }) {
    return this.applyAction({
      type: "report.preset.save",
      ...input,
    }).result as ReportPreset;
  }

  buildCsv(
    rows: Record<string, string | number | boolean | null | undefined>[]
  ) {
    const firstRow = rows[0];
    if (!firstRow) return "";
    const headers = Object.keys(firstRow);
    const escape = (value: string | number | boolean | null | undefined) => {
      const text = String(value ?? "");
      return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    };
    return [
      headers.join(","),
      ...rows.map(row => headers.map(header => escape(row[header])).join(",")),
    ].join("\n");
  }

  updateQuranProgress(
    recordId: string,
    memorizedPercent: number,
    tajweedScore: number,
    notes: string,
    actorId = "usr_teacher_demo"
  ) {
    return this.applyAction({
      type: "quran.progress.update",
      recordId,
      memorizedPercent,
      tajweedScore,
      notes,
      actorId,
    }).result as QuranProgressRecord | undefined;
  }

  reviewRecitation(
    submissionId: string,
    feedback: string,
    actorId = "usr_teacher_demo"
  ) {
    return this.applyAction({
      type: "recitation.review",
      submissionId,
      feedback,
      actorId,
    }).result as RecitationSubmission | undefined;
  }

  submitRecitation(input: SubmitRecitationInput, actorId = "usr_student_demo") {
    return this.applyAction({ type: "recitation.submit", ...input, actorId })
      .result as RecitationSubmission;
  }

  markNotificationRead(notificationId: string) {
    this.applyAction({ type: "notification.read", notificationId });
  }

  markMessageRead(messageId: string) {
    this.applyAction({ type: "message.read", messageId });
  }

  search(query: string) {
    const state = this.getState();
    const normalized = query.trim().toLowerCase();
    if (!normalized) return [];
    const rows = [
      ...state.users.map(item => ({
        type: "User",
        label: item.name,
        href: `/app/admin/users/${item.id}`,
      })),
      ...state.teachers
        .map(teacher => state.users.find(user => user.id === teacher.userId))
        .filter(Boolean)
        .map(item => ({
          type: "Teacher",
          label: item!.name,
          href: "/app/hod/teachers",
        })),
      ...state.courses.map(item => ({
        type: "Course",
        label: item.title,
        href: `/courses/${item.slug}`,
      })),
      ...state.lessons.map(item => ({
        type: "Lesson",
        label: item.title,
        href: `/app/student/courses/course_ar_l3/learn/${item.id}`,
      })),
      ...state.classGroups.map(item => ({
        type: "Class",
        label: item.name,
        href: `/app/teacher/classes/${item.id}`,
      })),
      ...state.assignments.map(item => ({
        type: "Assignment",
        label: item.title,
        href: `/app/student/assignments/${item.id}`,
      })),
      ...state.quizzes.map(item => ({
        type: "Quiz",
        label: item.title,
        href: `/app/student/quizzes/${item.id}`,
      })),
      ...state.leads.map(item => ({
        type: "Lead",
        label: item.fullName,
        href: `/app/registrar/leads/${item.id}`,
      })),
      ...state.placementTests.map(item => ({
        type: "Placement",
        label: item.fullName,
        href: `/app/registrar/placement-tests/${item.id}`,
      })),
      ...state.events.map(item => ({
        type: "Event",
        label: item.title,
        href: "/app/branch/schedule",
      })),
      ...state.invoices.map(item => ({
        type: "Invoice",
        label: item.id,
        href: "/app/registrar/payments",
      })),
      ...state.certificates.map(item => ({
        type: "Certificate",
        label: item.verificationCode,
        href: "/app/hod/certificates",
      })),
    ];
    return rows
      .filter(row =>
        `${row.type} ${row.label}`.toLowerCase().includes(normalized)
      )
      .slice(0, 8);
  }
}

export const platformStore = new PlatformStore();
