import { seedPlatformState } from "./seed";
import {
  applyCompleteLesson,
  applyStartLesson,
  applySubmitAssignment,
  applySubmitQuizAttempt,
} from "./actions";
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
  Notification,
  Payment,
  PlacementTestBooking,
  PlacementTestResult,
  PlatformState,
  QuranProgressRecord,
  RecitationSubmission,
} from "./types";

const STORAGE_KEY = "nilelearn.platform.state.v1";

type CreateLeadInput = Pick<
  Lead,
  "fullName" | "email" | "phone" | "subject" | "notes"
> & {
  country?: string;
  source?: Lead["source"];
};

type CreatePlacementInput = Pick<
  PlacementTestBooking,
  "fullName" | "email" | "phone" | "subject" | "preferredDate" | "currentLevel"
> & {
  branchId?: string;
};

type CreateCalendarEventInput = {
  title: string;
  type: CalendarEventType;
  startsAt: string;
  endsAt: string;
  ownerId: string;
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
  durationMinutes: number;
  questionTypes: string[];
  attemptsAllowed: number;
};

type SendMessageInput = {
  fromUserId: string;
  toUserId: string;
  subject: string;
  body: string;
  channel?: CommunicationLog["channel"];
};

type SubmitRecitationInput = Pick<
  RecitationSubmission,
  "studentId" | "teacherId" | "title"
>;

function now() {
  return new Date().toISOString();
}

function createId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function cloneSeed(): PlatformState {
  return JSON.parse(JSON.stringify(seedPlatformState)) as PlatformState;
}

class PlatformStore {
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
    if (typeof window === "undefined") return cloneSeed();
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const state = cloneSeed();
      this.setState(state);
      return state;
    }
    try {
      return { ...cloneSeed(), ...(JSON.parse(raw) as PlatformState) };
    } catch {
      const state = cloneSeed();
      this.setState(state);
      return state;
    }
  }

  reset() {
    this.setState(cloneSeed());
  }

  setState(state: PlatformState) {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  audit(
    action: string,
    entityType: string,
    entityId: string,
    summary: string,
    actorId = "usr_admin_demo"
  ) {
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
    const state = this.getState();
    const lead: Lead = {
      id: createId("lead"),
      fullName: input.fullName,
      email: input.email,
      phone: input.phone,
      country: input.country,
      subject: input.subject,
      source: input.source ?? "trial_form",
      status: "lead",
      notes: input.notes,
      createdAt: now(),
    };
    state.leads = [lead, ...state.leads];
    this.appendAudit(
      state,
      "lead.created",
      "Lead",
      lead.id,
      `Created lead for ${lead.fullName} from ${lead.source}.`,
      "usr_registrar_demo"
    );
    this.setState(state);
    return lead;
  }

  createPlacementBooking(input: CreatePlacementInput) {
    const state = this.getState();
    const booking: PlacementTestBooking = {
      id: createId("pt"),
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
    this.appendAudit(
      state,
      "placement.created",
      "PlacementTestBooking",
      booking.id,
      `Booked placement test for ${booking.fullName}.`,
      "usr_registrar_demo"
    );
    this.setState(state);
    return booking;
  }

  saveOperationalRecord(
    module: string,
    payload: Record<string, string>,
    actorId = "usr_admin_demo"
  ) {
    const state = this.getState();
    const entityId = createId("record");
    this.appendAudit(
      state,
      "record.saved",
      module,
      entityId,
      `Saved ${module} record: ${payload.title ?? payload.name ?? entityId}.`,
      actorId
    );
    this.setState(state);
    return entityId;
  }

  startLesson(
    lessonId: string,
    studentId = "stu_demo",
    actorId = "usr_student_demo"
  ) {
    const state = this.getState();
    const lesson = applyStartLesson(
      state,
      { lessonId, studentId, actorId },
      { createId, now }
    );
    this.setState(state);
    return lesson;
  }

  completeLesson(
    lessonId: string,
    studentId = "stu_demo",
    actorId = "usr_student_demo"
  ) {
    const state = this.getState();
    const lesson = applyCompleteLesson(
      state,
      { lessonId, studentId, actorId },
      { createId, now }
    );
    this.setState(state);
    return lesson;
  }

  submitAssignment(
    assignmentId: string,
    response: string,
    studentId = "stu_demo",
    actorId = "usr_student_demo"
  ) {
    const state = this.getState();
    const submission = applySubmitAssignment(
      state,
      { assignmentId, response, studentId, actorId },
      { createId, now }
    );
    this.setState(state);
    return submission;
  }

  submitQuizAttempt(
    quizId: string,
    answers: Record<string, string>,
    studentId = "stu_demo",
    actorId = "usr_student_demo"
  ) {
    const state = this.getState();
    const attempt = applySubmitQuizAttempt(
      state,
      { quizId, answers, studentId, actorId },
      { createId, now }
    );
    this.setState(state);
    return attempt;
  }

  createAssignment(input: CreateAssignmentInput, actorId = "usr_teacher_demo") {
    const state = this.getState();
    const assignment = {
      id: createId("asg"),
      courseRunId: input.courseRunId,
      title: input.title,
      dueAt: input.dueAt,
      submissionType: input.submissionType,
      rubric: input.rubric,
      status: "active" as const,
    };
    state.assignments = [assignment, ...state.assignments];
    this.appendAudit(
      state,
      "assignment.created",
      "Assignment",
      assignment.id,
      `${assignment.title} created.`,
      actorId
    );
    this.setState(state);
    return assignment;
  }

  createQuiz(input: CreateQuizInput, actorId = "usr_teacher_demo") {
    const state = this.getState();
    const quiz = {
      id: createId("quiz"),
      courseRunId: input.courseRunId,
      title: input.title,
      durationMinutes: input.durationMinutes,
      questionTypes: input.questionTypes,
      attemptsAllowed: input.attemptsAllowed,
      status: "active" as const,
    };
    state.quizzes = [quiz, ...state.quizzes];
    this.appendAudit(
      state,
      "quiz.created",
      "Quiz",
      quiz.id,
      `${quiz.title} created.`,
      actorId
    );
    this.setState(state);
    return quiz;
  }

  gradeAssignmentSubmission(
    submissionId: string,
    score: number,
    feedback: string,
    actorId = "usr_teacher_demo"
  ) {
    const state = this.getState();
    let updatedSubmission: (typeof state.assignmentSubmissions)[number] | undefined;
    state.assignmentSubmissions = state.assignmentSubmissions.map(submission => {
      if (submission.id !== submissionId) return submission;
      updatedSubmission = {
        ...submission,
        status: "completed",
        score,
        feedback,
      };
      return updatedSubmission;
    });
    if (!updatedSubmission) {
      this.setState(state);
      return undefined;
    }
    const assignment = state.assignments.find(
      item => item.id === updatedSubmission?.assignmentId
    );
    const existingGrade = state.grades.find(
      grade =>
        grade.studentId === updatedSubmission?.studentId &&
        grade.itemTitle === assignment?.title
    );
    const maxScore = 100;
    if (existingGrade) {
      existingGrade.score = score;
      existingGrade.maxScore = maxScore;
      existingGrade.feedback = feedback;
    } else if (assignment) {
      state.grades = [
        {
          id: createId("gr"),
          studentId: updatedSubmission.studentId,
          courseRunId: assignment.courseRunId,
          itemTitle: assignment.title,
          score,
          maxScore,
          feedback,
        },
        ...state.grades,
      ];
    }
    const student = state.students.find(
      item => item.id === updatedSubmission?.studentId
    );
    this.notify(state, {
      userId: student?.userId ?? "usr_student_demo",
      title: "Assignment graded",
      body: `${assignment?.title ?? "Assignment"} received ${score}/${maxScore}.`,
      href: "/app/student/grades",
    });
    this.appendAudit(
      state,
      "assignment.graded",
      "AssignmentSubmission",
      updatedSubmission.id,
      `${assignment?.title ?? "Assignment"} graded ${score}/${maxScore}.`,
      actorId
    );
    this.setState(state);
    return updatedSubmission;
  }

  saveAttendanceBulk(
    classGroupId: string,
    sessionId: string,
    statuses: Record<string, AttendanceStatus>,
    actorId = "usr_teacher_demo"
  ) {
    const state = this.getState();
    const session = state.classSessions.find(
      item => item.id === sessionId || item.eventId === sessionId
    );
    const sessionKeys = new Set(
      [sessionId, session?.id, session?.eventId].filter(Boolean)
    );
    Object.entries(statuses).forEach(([studentId, status]) => {
      const existing = state.attendance.find(
        record =>
          record.classGroupId === classGroupId &&
          sessionKeys.has(record.sessionId) &&
          record.studentId === studentId
      );
      if (existing) {
        existing.status = status;
        existing.sessionId = session?.id ?? sessionId;
      } else {
        state.attendance = [
          {
            id: createId("att"),
            classGroupId,
            studentId,
            sessionId: session?.id ?? sessionId,
            status,
          },
          ...state.attendance,
        ];
      }
    });
    state.classSessions = state.classSessions.map(session =>
      session.id === sessionId || session.eventId === sessionId
        ? { ...session, attendanceSaved: true }
        : session
    );
    this.appendAudit(
      state,
      "attendance.saved",
      "AttendanceRecord",
      classGroupId,
      `Saved attendance for ${Object.keys(statuses).length} learner(s).`,
      actorId
    );
    this.setState(state);
    return state.attendance.filter(
      record =>
        record.classGroupId === classGroupId &&
        sessionKeys.has(record.sessionId)
    );
  }

  createCalendarEvent(
    input: CreateCalendarEventInput,
    actorId = "usr_branch_demo"
  ) {
    const state = this.getState();
    const starts = new Date(input.startsAt).getTime();
    const ends = new Date(input.endsAt).getTime();
    const conflicts = state.events.filter(event => {
      const eventStarts = new Date(event.startsAt).getTime();
      const eventEnds = new Date(event.endsAt).getTime();
      const overlaps = starts < eventEnds && ends > eventStarts;
      if (!overlaps) return false;
      return Boolean(
        (input.roomId && event.roomId === input.roomId) ||
          (input.ownerId && event.ownerId === input.ownerId) ||
          (input.classGroupId && event.classGroupId === input.classGroupId)
      );
    });
    const event: CalendarEvent = {
      id: createId("evt"),
      type: input.type,
      title: input.title,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      ownerId: input.ownerId,
      branchId: input.branchId,
      roomId: input.roomId,
      classGroupId: input.classGroupId,
      status: conflicts.length ? "pending" : "active",
    };
    state.events = [event, ...state.events];
    if (event.type === "class_session" || event.type === "live_session") {
      state.classSessions = [
        {
          id: createId("session"),
          classGroupId:
            event.classGroupId ?? state.classGroups[0]?.id ?? "class_ar_l3_a",
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
    this.appendAudit(
      state,
      conflicts.length ? "calendar.created_with_conflict" : "calendar.created",
      "CalendarEvent",
      event.id,
      `${event.title} created${conflicts.length ? ` with ${conflicts.length} conflict(s)` : ""}.`,
      actorId
    );
    this.setState(state);
    return { event, conflicts };
  }

  sendMessage(input: SendMessageInput) {
    const state = this.getState();
    const message: Message = {
      id: createId("msg"),
      fromUserId: input.fromUserId,
      toUserId: input.toUserId,
      subject: input.subject,
      body: input.body,
      read: false,
      createdAt: now(),
    };
    state.messages = [message, ...state.messages];
    const log: CommunicationLog = {
      id: createId("comm"),
      actorId: input.fromUserId,
      channel: input.channel ?? "in_app",
      subject: input.subject,
      body: input.body,
      relatedUserId: input.toUserId,
      status: "completed",
      createdAt: now(),
    };
    state.communicationLogs = [log, ...state.communicationLogs];
    this.notify(state, {
      userId: input.toUserId,
      title: input.subject,
      body: input.body,
      href: "/app/student/messages",
    });
    this.appendAudit(
      state,
      "message.sent",
      "Message",
      message.id,
      `Sent message: ${message.subject}.`,
      input.fromUserId
    );
    this.setState(state);
    return message;
  }

  approveCertificate(certificateId: string, actorId = "usr_hod_demo") {
    const state = this.getState();
    let updated: Certificate | undefined;
    let changed = false;
    state.certificates = state.certificates.map(certificate => {
      if (certificate.id !== certificateId) return certificate;
      if (
        certificate.status === "approved" ||
        certificate.status === "issued"
      ) {
        updated = certificate;
        return certificate;
      }
      changed = true;
      updated = { ...certificate, status: "approved", approvedBy: actorId };
      return updated;
    });
    if (updated && changed) {
      this.appendAudit(
        state,
        "certificate.approved",
        "Certificate",
        updated.id,
        `Approved certificate ${updated.verificationCode}.`,
        actorId
      );
    }
    this.setState(state);
    return updated;
  }

  issueCertificate(certificateId: string, actorId = "usr_hod_demo") {
    const state = this.getState();
    let updated: Certificate | undefined;
    let changed = false;
    state.certificates = state.certificates.map(certificate => {
      if (certificate.id !== certificateId) return certificate;
      if (certificate.status === "issued") {
        updated = certificate;
        return certificate;
      }
      changed = true;
      updated = {
        ...certificate,
        status: "issued",
        approvedBy: certificate.approvedBy ?? actorId,
      };
      return updated;
    });
    if (updated && changed) {
      this.notify(state, {
        userId: "usr_student_demo",
        title: "Certificate issued",
        body: `${updated.verificationCode} is ready to download.`,
        href: "/app/student/certificates",
      });
      this.appendAudit(
        state,
        "certificate.issued",
        "Certificate",
        updated.id,
        `Issued certificate ${updated.verificationCode}.`,
        actorId
      );
    }
    this.setState(state);
    return updated;
  }

  recordPayment(invoiceId: string, actorId = "usr_registrar_demo") {
    const state = this.getState();
    const invoice =
      state.invoices.find(item => item.id === invoiceId) ?? state.invoices[0];
    const paidSoFar = state.payments
      .filter(
        payment => payment.invoiceId === invoice.id && payment.status === "paid"
      )
      .reduce((sum, payment) => sum + payment.amount, 0);
    const amount = Math.max(0, invoice.amount - paidSoFar);
    if (amount <= 0 || invoice.status === "paid") {
      return state.payments.find(
        payment => payment.invoiceId === invoice.id && payment.status === "paid"
      );
    }
    const payment: Payment = {
      id: createId("pay"),
      invoiceId: invoice.id,
      amount,
      method: "manual",
      paidAt: now(),
      status: "paid",
    };
    state.payments = [payment, ...state.payments];
    state.invoices = state.invoices.map(item =>
      item.id === invoice.id ? { ...item, status: "paid" } : item
    );
    this.appendAudit(
      state,
      "payment.recorded",
      "Payment",
      payment.id,
      `Recorded ${invoice.currency} ${amount} for ${invoice.id}.`,
      actorId
    );
    this.setState(state);
    return payment;
  }

  recordPlacementResult(
    bookingId: string,
    recommendedLevel: string,
    score: number,
    notes: string,
    actorId = "usr_registrar_demo"
  ) {
    const state = this.getState();
    const booking =
      state.placementTests.find(item => item.id === bookingId) ??
      state.placementTests[0];
    const existing = state.placementResults.find(
      item => item.bookingId === booking.id
    );
    const result: PlacementTestResult = {
      id: existing?.id ?? createId("ptr"),
      bookingId: booking.id,
      examinerId: "usr_teacher_demo",
      score,
      recommendedLevel,
      notes,
      createdAt: now(),
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
    const existingWorkflow = state.enrollmentWorkflows.find(
      workflow => workflow.placementTestId === booking.id
    );
    const workflow = {
      id: existingWorkflow?.id ?? createId("ew"),
      leadId: booking.leadId,
      placementTestId: booking.id,
      targetCourseId: "course_ar_l3",
      status: "ready_to_enroll" as const,
      nextStep: "Confirm package, create invoice, and assign class",
      updatedAt: now(),
    };
    state.enrollmentWorkflows = existingWorkflow
      ? state.enrollmentWorkflows.map(item =>
          item.id === existingWorkflow.id ? workflow : item
        )
      : [workflow, ...state.enrollmentWorkflows];
    this.appendAudit(
      state,
      existing ? "placement.result_updated" : "placement.result_recorded",
      "PlacementTestResult",
      result.id,
      `Recorded placement result for ${booking.fullName}.`,
      actorId
    );
    this.setState(state);
    return result;
  }

  convertLeadToApplication(leadId: string, actorId = "usr_registrar_demo") {
    const state = this.getState();
    const lead = state.leads.find(item => item.id === leadId) ?? state.leads[0];
    const existing = state.applications.find(item => item.leadId === lead.id);
    if (existing) return existing;
    state.leads = state.leads.map(item =>
      item.id === lead.id ? { ...item, status: "ready_to_enroll" } : item
    );
    const application = {
      id: createId("app"),
      leadId: lead.id,
      branchId: "br_online",
      courseInterest: lead.subject,
      schedulePreference: "To confirm",
      status: "pending" as EntityStatus,
    };
    state.applications = [application, ...state.applications];
    this.appendAudit(
      state,
      "lead.converted",
      "Application",
      application.id,
      `Converted ${lead.fullName} to application.`,
      actorId
    );
    this.setState(state);
    return application;
  }

  verifyCertificate(code: string) {
    const state = this.getState();
    const normalized = code.trim().toLowerCase();
    if (!normalized) return null;
    const certificate = state.certificates.find(
      item => item.verificationCode.toLowerCase() === normalized
    );
    if (!certificate) return null;
    const student = state.students.find(
      item => item.id === certificate.studentId
    );
    const user = state.users.find(item => item.id === student?.userId);
    const course = state.courses.find(item => item.id === certificate.courseId);
    return { certificate, student, user, course };
  }

  exportReportRows(
    reportType: "enrollments" | "attendance" | "finance" | "audit"
  ) {
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
    const state = this.getState();
    let updated: QuranProgressRecord | undefined;
    state.quranProgress = state.quranProgress.map(record => {
      if (record.id !== recordId) return record;
      updated = { ...record, memorizedPercent, tajweedScore, notes };
      return updated;
    });
    if (updated) {
      this.appendAudit(
        state,
        "quran.progress_updated",
        "QuranProgressRecord",
        updated.id,
        `Updated ${updated.surah} progress.`,
        actorId
      );
    }
    this.setState(state);
    return updated;
  }

  reviewRecitation(
    submissionId: string,
    feedback: string,
    actorId = "usr_teacher_demo"
  ) {
    const state = this.getState();
    let updated: RecitationSubmission | undefined;
    state.recitationSubmissions = state.recitationSubmissions.map(
      submission => {
        if (submission.id !== submissionId) return submission;
        updated = { ...submission, status: "approved", feedback };
        return updated;
      }
    );
    if (updated) {
      this.notify(state, {
        userId: "usr_student_demo",
        title: "Recitation reviewed",
        body: feedback,
        href: "/app/student/quran-progress",
      });
      this.appendAudit(
        state,
        "recitation.reviewed",
        "RecitationSubmission",
        updated.id,
        `Reviewed ${updated.title}.`,
        actorId
      );
    }
    this.setState(state);
    return updated;
  }

  submitRecitation(input: SubmitRecitationInput, actorId = "usr_student_demo") {
    const state = this.getState();
    const submission: RecitationSubmission = {
      id: createId("rec"),
      studentId: input.studentId,
      teacherId: input.teacherId,
      title: input.title,
      submittedAt: now(),
      status: "pending",
    };
    state.recitationSubmissions = [submission, ...state.recitationSubmissions];
    this.notify(state, {
      userId: input.teacherId,
      title: "Recitation submitted",
      body: `${submission.title} is ready for review.`,
      href: "/app/teacher/quran-review",
    });
    this.appendAudit(
      state,
      "recitation.submitted",
      "RecitationSubmission",
      submission.id,
      `Submitted ${submission.title}.`,
      actorId
    );
    this.setState(state);
    return submission;
  }

  markNotificationRead(notificationId: string) {
    const state = this.getState();
    state.notifications = state.notifications.map(notification =>
      notification.id === notificationId
        ? { ...notification, read: true }
        : notification
    );
    this.setState(state);
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
