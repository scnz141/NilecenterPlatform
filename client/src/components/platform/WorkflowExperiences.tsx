import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Activity,
  ArrowRight,
  Award,
  BookMarked,
  BookOpen,
  CalendarDays,
  Captions,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  CreditCard,
  Download,
  FileText,
  GraduationCap,
  Headphones,
  ListChecks,
  Maximize2,
  MessageSquare,
  Minimize2,
  NotebookPen,
  Pause,
  Play,
  Radio,
  Send,
  Settings,
  ShieldCheck,
  SkipBack,
  SkipForward,
  SlidersHorizontal,
  UserPlus,
  Video,
  Volume2,
  VolumeX,
} from "lucide-react";
import { toast } from "sonner";
import {
  fetchPlatformStateRequest,
  runPlatformWorkflowActionRequest,
} from "@/lib/backend/api";
import { platformStore } from "@/lib/domain/store";
import type {
  AttendanceStatus,
  CalendarEvent,
  CalendarEventType,
  Certificate,
  Lesson,
  LessonResource,
  Payment,
  QuranProgressRecord,
  QuizQuestionPreview,
  RecitationSubmission,
  ReportPreset,
  ReportType,
} from "@/lib/domain/types";
import { checkSupabaseBrowserConnection } from "@/lib/supabase/client";
import { withRuntimeIntegrationStatus } from "@/lib/integrations/registry";
import {
  getDemoUser,
  roleMeta,
  type PageConfig,
  type Role,
} from "@/lib/platformData";
import {
  PlatformPageHeader,
  PlatformWorkspaceHeader,
  StatCard,
  StatusBadge,
  DataTableCard,
} from "./PlatformPrimitives";

const assessmentPages = new Set([
  "assignments",
  "assignment-detail",
  "quizzes",
  "quiz-detail",
  "grading",
  "question-bank",
  "assessments",
]);
const admissionsPages = new Set([
  "leads",
  "lead-detail",
  "applications",
  "placement-tests",
  "placement-detail",
  "enrollments",
]);
const learningPages = new Set([
  "courses",
  "course-detail",
  "lesson",
  "live",
  "grades",
]);
const reportLabels = {
  enrollments: "Enrollment",
  attendance: "Attendance",
  finance: "Finance",
  audit: "Activity",
} as const;
const reportTypesByRole: Record<Role, ReportType[]> = {
  student: ["enrollments", "attendance"],
  teacher: ["enrollments", "attendance", "audit"],
  registrar: ["enrollments", "finance"],
  headofdepartment: ["enrollments", "attendance", "audit"],
  branchadmin: ["enrollments", "attendance", "finance"],
  superadmin: ["enrollments", "attendance", "finance", "audit"],
};
type ReportRow = ReturnType<typeof platformStore.exportReportRows>[number];
type DisplayReportRow = {
  eyebrow: string;
  title: string;
  subtitle: string;
  status: string;
  metric: string;
  meta: string;
  sort: {
    primary: string;
    status: string;
    metric: string | number;
    updated: string;
  };
};
type ReportSortKey = "primary" | "status" | "metric" | "updated";
type ReportSortDirection = "asc" | "desc";

function formatConnectionStatus(status: string) {
  return status === "mock_mode" ? "Test mode" : status.replace("_", " ");
}

const PLATFORM_STATE_UPDATED_EVENT = "nilelearn:platform-state-updated";
const PROTECTED_STATEFUL_PAGE_IDS = new Set([
  ...Array.from(learningPages),
  ...Array.from(assessmentPages),
  ...Array.from(admissionsPages),
  "payments",
  "integrations",
  "system-health",
  "audit-logs",
]);
const attendanceStatusOptions: AttendanceStatus[] = [
  "present",
  "late",
  "absent",
  "excused",
];
const attendanceStatusLabels: Record<AttendanceStatus, string> = {
  present: "Present",
  late: "Late",
  absent: "Absent",
  excused: "Excused",
};
const attendanceStatusShortLabels: Record<AttendanceStatus, string> = {
  present: "P",
  late: "L",
  absent: "A",
  excused: "E",
};
type AttendanceSessionFilter = "all" | "saved" | "pending";
type AttendanceRosterFilter =
  | "all"
  | AttendanceStatus
  | "unsaved"
  | "exceptions";
const certificateStatusLabels: Record<Certificate["status"], string> = {
  draft: "Draft",
  pending_approval: "Pending approval",
  approved: "Approved",
  issued: "Issued",
  rejected: "Rejected",
  revoked: "Revoked",
};
const certificateStatusOptions: Certificate["status"][] = [
  "pending_approval",
  "approved",
  "issued",
  "rejected",
  "draft",
  "revoked",
];
const schedulerTypeLabels: Record<CalendarEventType, string> = {
  class_session: "Class session",
  live_session: "Live session",
  trial_lesson: "Trial lesson",
  placement_test: "Placement test",
  assignment_due: "Assignment due",
  quiz_due: "Quiz due",
  exam: "Exam",
  teacher_availability: "Teacher availability",
  room_booking: "Room booking",
  reminder: "Reminder",
};

type ScheduleBoardEvent = {
  id: string;
  title: string;
  startsAt: string;
  endsAt?: string;
  type: CalendarEventType | "assignment_due" | "quiz_due";
  status?: string;
  roomId?: string;
  branchId?: string;
  classGroupId?: string;
};

function getSchedulerTypeOptions(
  role: Role
): Array<{ value: CalendarEventType; label: string }> {
  if (role === "registrar") {
    return [
      { value: "placement_test", label: "Placement test" },
      { value: "trial_lesson", label: "Trial lesson" },
      { value: "room_booking", label: "Room booking" },
      { value: "reminder", label: "Reminder" },
    ];
  }
  if (role === "teacher") {
    return [
      { value: "live_session", label: "Live session" },
      { value: "class_session", label: "Class session" },
      { value: "assignment_due", label: "Assignment due" },
      { value: "quiz_due", label: "Quiz due" },
      { value: "reminder", label: "Reminder" },
    ];
  }
  if (role === "branchadmin") {
    return [
      { value: "live_session", label: "Live session" },
      { value: "class_session", label: "Class session" },
      { value: "room_booking", label: "Room booking" },
      { value: "reminder", label: "Reminder" },
    ];
  }
  return [
    { value: "live_session", label: "Live session" },
    { value: "class_session", label: "Class session" },
    { value: "placement_test", label: "Placement test" },
    { value: "room_booking", label: "Room booking" },
    { value: "exam", label: "Exam" },
  ];
}

function getDefaultSchedulerType(role: Role): CalendarEventType {
  return role === "registrar" ? "placement_test" : "live_session";
}

function getCertificateEligibility(certificate: Certificate) {
  return [
    {
      label: "Grade",
      detail: `${certificate.grade}% / 80%`,
      passed: certificate.grade >= 80,
    },
    {
      label: "Attendance",
      detail: `${certificate.attendanceRate}% / 80%`,
      passed: certificate.attendanceRate >= 80,
    },
    {
      label: "Approval",
      detail: certificateStatusLabels[certificate.status],
      passed:
        certificate.status === "approved" || certificate.status === "issued",
    },
    {
      label: "Issue state",
      detail:
        certificate.status === "issued"
          ? certificate.verificationCode
          : "Not issued",
      passed: certificate.status === "issued",
    },
  ];
}

function getCertificateSummary(
  state: PlatformStateSnapshot,
  certificateIds?: Set<string>
) {
  const certificates = certificateIds
    ? state.certificates.filter(certificate =>
        certificateIds.has(certificate.id)
      )
    : state.certificates;
  const statusCounts = Object.fromEntries(
    certificateStatusOptions.map(status => [
      status,
      certificates.filter(certificate => certificate.status === status).length,
    ])
  ) as Record<Certificate["status"], number>;
  const eligible = certificates.filter(
    certificate => certificate.grade >= 80 && certificate.attendanceRate >= 80
  );
  const issuedCertificates = certificates.filter(
    certificate => certificate.status === "issued"
  );
  const issuedDocuments = state.documents.filter(
    document =>
      document.type === "certificate" &&
      issuedCertificates.some(
        certificate => document.url === `#certificate-${certificate.id}`
      )
  );
  const recentAudits = state.auditLogs
    .filter(
      audit =>
        (audit.action === "certificate.approved" ||
          audit.action === "certificate.issued" ||
          audit.action === "certificate.rejected") &&
        (!certificateIds || certificateIds.has(audit.entityId))
    )
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
    .slice(0, 4);

  return {
    certificates,
    statusCounts,
    eligible,
    issuedDocuments,
    recentAudits,
  };
}

function certificateMeetsAcademicRules(certificate: Certificate) {
  return certificate.grade >= 80 && certificate.attendanceRate >= 80;
}

function getCertificatePublicCode(certificate: Certificate, reveal: boolean) {
  return reveal && certificate.status === "issued"
    ? certificate.verificationCode
    : "Reserved until issue";
}

function CertificateEligibilityEvidence({
  certificate,
  studentName,
  courseTitle,
  documentStatus,
  approverName,
  issuerName,
  auditSummary,
}: {
  certificate: Certificate;
  studentName: string;
  courseTitle: string;
  documentStatus?: string;
  approverName?: string;
  issuerName?: string;
  auditSummary?: string;
}) {
  const issued = certificate.status === "issued";
  const eligible = certificateMeetsAcademicRules(certificate);
  return (
    <section
      className="platform-certificate-evidence"
      aria-label="Certificate eligibility evidence"
    >
      <article>
        <span>Learner</span>
        <strong>{studentName}</strong>
        <small>{courseTitle}</small>
      </article>
      <article>
        <span>Eligibility</span>
        <strong>
          {certificate.grade}% grade · {certificate.attendanceRate}% attendance
        </strong>
        <small>
          {eligible
            ? "Meets current issue rules"
            : "Needs grade and attendance evidence"}
        </small>
      </article>
      <article>
        <span>Document</span>
        <strong>{issued ? (documentStatus ?? "ready") : "not issued"}</strong>
        <small>
          {issued
            ? "Public verification enabled"
            : "Hidden from public verification"}
        </small>
      </article>
      <article>
        <span>Governance</span>
        <strong>
          {issued
            ? `Issued by ${issuerName ?? "system"}`
            : certificate.status === "approved"
              ? `Approved by ${approverName ?? "system"}`
              : certificateStatusLabels[certificate.status]}
        </strong>
        <small>{auditSummary ?? "No approval audit yet"}</small>
      </article>
    </section>
  );
}

function CertificatePreview({
  certificate,
  studentName,
  courseTitle,
  documentStatus,
  revealCode,
  context,
}: {
  certificate: Certificate;
  studentName: string;
  courseTitle: string;
  documentStatus?: string;
  revealCode: boolean;
  context: "student" | "governance";
}) {
  const issued = certificate.status === "issued";
  const eligibility = getCertificateEligibility(certificate);
  return (
    <section
      className={`platform-certificate-preview ${issued ? "issued" : "pending"}`}
      aria-label="Certificate preview"
    >
      <div>
        <span>Nile Learn Certificate</span>
        <strong>{studentName}</strong>
        <p>
          {courseTitle} · Grade {certificate.grade}% · Attendance{" "}
          {certificate.attendanceRate}%
        </p>
        <em>{getCertificatePublicCode(certificate, revealCode)}</em>
        <div className="platform-certificate-rule-grid">
          {eligibility.map(item => (
            <span key={item.label} className={item.passed ? "passed" : ""}>
              {item.label}: {item.detail}
            </span>
          ))}
        </div>
        <small>
          {issued
            ? `Document ${documentStatus ?? "ready"} · public verification enabled${
                certificate.issuedAt
                  ? ` · issued ${formatDateTime(certificate.issuedAt)}`
                  : ""
              }`
            : context === "student"
              ? "Approval or issue is still pending. Verification and print stay disabled."
              : "Issue the certificate before verification and print are enabled."}
        </small>
      </div>
      <div className="platform-certificate-preview-actions">
        <button type="button" disabled={!issued} onClick={() => window.print()}>
          <Download size={15} />
          {issued ? "Print certificate" : "Issued only"}
        </button>
        <button type="button" disabled>
          PDF renderer pending
        </button>
      </div>
    </section>
  );
}

function CertificateVerifyPanel({
  title,
  label,
  value,
  onChange,
  disabled,
  verification,
}: {
  title: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  verification: ReturnType<typeof platformStore.verifyCertificate>;
}) {
  return (
    <section className="platform-workflow-card">
      <div className="platform-workflow-title">
        <span>
          <ShieldCheck size={16} /> Verify code
        </span>
        <strong>{title}</strong>
      </div>
      <div className="platform-inline-form">
        <label>
          {label}
          <input
            value={value}
            onChange={event => onChange(event.target.value)}
            disabled={disabled}
            placeholder={disabled ? "Issued certificates only" : "NCL-..."}
          />
        </label>
      </div>
      <div
        className={`platform-verification-result ${verification ? "valid" : "missing"}`}
      >
        <strong>
          {verification ? "Issued certificate found" : "No issued match"}
        </strong>
        <small>
          {verification
            ? `${verification.studentName} · ${verification.courseTitle}`
            : disabled
              ? "This certificate is not issued yet."
              : "Check the code or issue the certificate first. Pending approvals are not exposed."}
        </small>
      </div>
    </section>
  );
}

export function isStatefulWorkflowPage(
  role: Role,
  pageId: string,
  kind: PageConfig["kind"]
) {
  if (role === "student" && learningPages.has(pageId)) return true;
  if (assessmentPages.has(pageId) || kind === "assessment") return true;
  if (kind === "attendance") return true;
  if (kind === "calendar") return true;
  if (kind === "certificate") return true;
  if (kind === "quran") return true;
  if (kind === "messages") return true;
  if (pageId === "payments") return true;
  if (admissionsPages.has(pageId)) return true;
  if (pageId === "integrations") return true;
  if (
    kind === "report" ||
    pageId === "system-health" ||
    pageId === "audit-logs"
  )
    return true;
  return false;
}

export default function StatefulWorkflowExperience({
  config,
  role,
  pageId,
  params,
}: {
  config: PageConfig;
  role: Role;
  pageId: string;
  params?: Record<string, string | undefined>;
}) {
  const [version, setVersion] = useState(0);
  const [backendSyncStatus, setBackendSyncStatus] = useState<
    "loading" | "supabase" | "local" | "offline"
  >("loading");
  const state = useMemo(() => platformStore.getState(), [version]);
  const refresh = () => setVersion(value => value + 1);

  useEffect(() => {
    let cancelled = false;
    setBackendSyncStatus("loading");
    fetchPlatformStateRequest().then(result => {
      if (cancelled) return;
      if (result.ok && result.data) {
        platformStore.setState(result.data.state);
        setBackendSyncStatus(result.data.persistence);
        refresh();
        return;
      }
      setBackendSyncStatus("offline");
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const syncLocalPlatformState = () => {
      setVersion(value => value + 1);
    };
    window.addEventListener(
      PLATFORM_STATE_UPDATED_EVENT,
      syncLocalPlatformState
    );
    return () => {
      window.removeEventListener(
        PLATFORM_STATE_UPDATED_EVENT,
        syncLocalPlatformState
      );
    };
  }, []);

  const requiresServerScopedState =
    PROTECTED_STATEFUL_PAGE_IDS.has(pageId) ||
    config.kind === "attendance" ||
    config.kind === "calendar" ||
    config.kind === "certificate" ||
    config.kind === "quran" ||
    config.kind === "messages" ||
    config.kind === "report";

  if (requiresServerScopedState && backendSyncStatus === "loading") {
    return (
      <section className="platform-workflow-card platform-route-loading">
        <span aria-hidden="true" className="platform-route-loading-spinner" />
        <small>Syncing role scope</small>
        <strong>{config.title}</strong>
        <p>
          Loading the server-scoped workspace before showing protected records.
        </p>
      </section>
    );
  }

  if (requiresServerScopedState && backendSyncStatus === "offline") {
    return (
      <section className="platform-workflow-card platform-route-loading platform-route-offline">
        <span aria-hidden="true" className="platform-route-offline-icon">
          !
        </span>
        <small>Server scope unavailable</small>
        <strong>{config.title}</strong>
        <p>
          Protected records are not shown from browser cache. Restore the API
          connection and retry this role-scoped workspace.
        </p>
        <button type="button" onClick={() => window.location.reload()}>
          Retry workspace
        </button>
      </section>
    );
  }

  if (role === "student" && config.kind === "report")
    return <StudentReportsWorkflow role={role} state={state} pageId={pageId} />;
  if (role === "student" && learningPages.has(pageId)) {
    return (
      <LearningWorkflow
        role={role}
        state={state}
        refresh={refresh}
        params={params}
        backendSyncStatus={backendSyncStatus}
      />
    );
  }
  if (
    role === "student" &&
    (assessmentPages.has(pageId) || config.kind === "assessment")
  )
    return (
      <AssessmentWorkflow
        role={role}
        state={state}
        refresh={refresh}
        params={params}
      />
    );
  if (role === "student" && config.kind === "attendance")
    return (
      <AttendancePageFrame
        config={config}
        role={role}
        state={state}
        backendSyncStatus={backendSyncStatus}
      >
        <StudentAttendanceWorkflow
          role={role}
          state={state}
          refresh={refresh}
          backendSyncStatus={backendSyncStatus}
        />
      </AttendancePageFrame>
    );
  if (role === "student" && config.kind === "calendar")
    return (
      <StudentCalendarWorkflow
        role={role}
        state={state}
        refresh={refresh}
        backendSyncStatus={backendSyncStatus}
      />
    );
  if (role === "student" && config.kind === "certificate")
    return (
      <StudentCertificateWorkflow
        role={role}
        state={state}
        refresh={refresh}
        backendSyncStatus={backendSyncStatus}
      />
    );
  if (role === "student" && config.kind === "quran")
    return <StudentQuranWorkflow role={role} state={state} refresh={refresh} />;
  if (role === "student" && config.kind === "messages")
    return (
      <StudentMessageWorkflow role={role} state={state} refresh={refresh} />
    );
  if (assessmentPages.has(pageId) || config.kind === "assessment")
    return (
      <AssessmentWorkflow
        role={role}
        state={state}
        refresh={refresh}
        params={params}
      />
    );
  if (config.kind === "attendance")
    return (
      <AttendancePageFrame
        config={config}
        role={role}
        state={state}
        backendSyncStatus={backendSyncStatus}
      >
        <AttendanceWorkflow
          role={role}
          state={state}
          refresh={refresh}
          params={params}
          backendSyncStatus={backendSyncStatus}
        />
      </AttendancePageFrame>
    );
  if (admissionsPages.has(pageId))
    return <AdmissionsWorkflow role={role} state={state} refresh={refresh} />;
  if (
    config.kind === "calendar" &&
    (role === "headofdepartment" || role === "superadmin")
  )
    return (
      <ScheduleGovernanceWorkflow
        role={role}
        state={state}
        refresh={refresh}
        backendSyncStatus={backendSyncStatus}
      />
    );
  if (config.kind === "calendar")
    return (
      <SchedulingWorkflow
        role={role}
        state={state}
        refresh={refresh}
        backendSyncStatus={backendSyncStatus}
      />
    );
  if (config.kind === "certificate")
    return (
      <CertificateWorkflow
        role={role}
        state={state}
        refresh={refresh}
        backendSyncStatus={backendSyncStatus}
      />
    );
  if (config.kind === "quran")
    return <QuranWorkflow role={role} state={state} refresh={refresh} />;
  if (config.kind === "messages")
    return <MessageWorkflow role={role} state={state} refresh={refresh} />;
  if (pageId === "payments")
    return <FinanceWorkflow role={role} state={state} refresh={refresh} />;
  if (pageId === "integrations")
    return <IntegrationsWorkflow role={role} state={state} refresh={refresh} />;
  return (
    <ReportsWorkflow
      role={role}
      state={state}
      refresh={refresh}
      pageId={pageId}
    />
  );
}

type WorkflowProps = {
  role: Role;
  state: ReturnType<typeof platformStore.getState>;
  refresh: () => void;
  params?: Record<string, string | undefined>;
  backendSyncStatus?: "loading" | "supabase" | "local" | "offline";
};

type PlatformStateSnapshot = ReturnType<typeof platformStore.getState>;

const STUDENT_PROFILE_ID = "stu_demo";
const STUDENT_USER_ID = "usr_student_demo";

function AttendancePageFrame({
  config,
  role,
  state,
  backendSyncStatus,
  children,
}: {
  config: PageConfig;
  role: Role;
  state: PlatformStateSnapshot;
  backendSyncStatus: "loading" | "supabase" | "local" | "offline";
  children: ReactNode;
}) {
  const classIds = getAttendanceScopeClassIds(state, role);
  const summary = getAttendanceSummary(state, classIds);
  const scopeLabel =
    role === "student"
      ? "My classes"
      : role === "teacher"
        ? "Assigned classes"
        : role === "branchadmin"
          ? `${getRoleActorUser(state, role).branchId ? "Branch" : "Local"} scope`
          : role === "headofdepartment"
            ? "Academic scope"
            : "Platform scope";

  return (
    <div className="platform-attendance-page">
      <section className="platform-attendance-page-header">
        <div>
          <span>
            <ClipboardCheck size={15} /> {roleMeta[role].label}
          </span>
          <h1>{config.title}</h1>
          <p>{config.description}</p>
        </div>
        <div className="platform-attendance-page-metrics">
          <span>{scopeLabel}</span>
          <span>
            {summary.savedSessions}/{summary.sessions.length} saved
          </span>
          <span>{summary.pendingSessions} pending</span>
          <span>
            {backendSyncStatus === "loading"
              ? "Syncing"
              : `${backendSyncStatus} state`}
          </span>
        </div>
      </section>
      {children}
    </div>
  );
}

function getAttendanceScopeClassIds(state: PlatformStateSnapshot, role: Role) {
  const actor = getRoleActorUser(state, role);
  if (role === "student") return getStudentScope(state).classIds;
  if (role === "teacher") {
    const runIds = new Set(
      state.courseRuns
        .filter(run => run.teacherId === actor.id)
        .map(run => run.id)
    );
    return new Set(
      state.classGroups
        .filter(group => runIds.has(group.courseRunId))
        .map(group => group.id)
    );
  }
  if (role === "branchadmin") {
    const runIds = new Set(
      state.courseRuns
        .filter(run => run.branchId === actor.branchId)
        .map(run => run.id)
    );
    return new Set(
      state.classGroups
        .filter(group => runIds.has(group.courseRunId))
        .map(group => group.id)
    );
  }
  if (role === "headofdepartment") return getHodClassIds(state, actor.id);
  return undefined;
}

function getAttendanceSummary(
  state: PlatformStateSnapshot,
  classIds?: Set<string>
) {
  const classGroups = classIds
    ? state.classGroups.filter(group => classIds.has(group.id))
    : state.classGroups;
  const scopedClassIds = new Set(classGroups.map(group => group.id));
  const sessions = state.classSessions.filter(session =>
    scopedClassIds.has(session.classGroupId)
  );
  const records = state.attendance.filter(record =>
    scopedClassIds.has(record.classGroupId)
  );
  const expectedRecords = sessions.reduce((sum, session) => {
    const group = classGroups.find(item => item.id === session.classGroupId);
    return sum + (group?.studentIds.length ?? 0);
  }, 0);
  const statusCounts = Object.fromEntries(
    attendanceStatusOptions.map(status => [
      status,
      records.filter(record => record.status === status).length,
    ])
  ) as Record<AttendanceStatus, number>;

  return {
    classGroups,
    sessions,
    records,
    expectedRecords,
    statusCounts,
    savedSessions: sessions.filter(session =>
      isAttendanceSessionSaved(state, session)
    ).length,
    pendingSessions: sessions.filter(
      session => !isAttendanceSessionSaved(state, session)
    ).length,
    completionRate: expectedRecords
      ? Math.round((records.length / expectedRecords) * 100)
      : 0,
  };
}

function isAttendanceSessionSaved(
  state: PlatformStateSnapshot,
  session: PlatformStateSnapshot["classSessions"][number]
) {
  if (session.attendanceSaved) return true;
  const group = state.classGroups.find(
    item => item.id === session.classGroupId
  );
  if (!group?.studentIds.length) return false;
  return group.studentIds.every(studentId =>
    state.attendance.some(
      record =>
        record.classGroupId === group.id &&
        record.studentId === studentId &&
        (record.sessionId === session.id ||
          record.sessionId === session.eventId)
    )
  );
}

function getHodClassIds(state: PlatformStateSnapshot, actorId: string) {
  const courseIds = getHodCourseIds(state, actorId);
  const courseRunIds = new Set(
    state.courseRuns
      .filter(run => courseIds.has(run.courseId))
      .map(run => run.id)
  );

  return new Set(
    state.classGroups
      .filter(group => courseRunIds.has(group.courseRunId))
      .map(group => group.id)
  );
}

function getHodCourseIds(state: PlatformStateSnapshot, actorId: string) {
  const actor = state.users.find(user => user.id === actorId);
  const departmentIds = new Set(
    state.departments
      .filter(
        department =>
          department.ownerUserId === actorId ||
          (actor?.departmentId && department.id === actor.departmentId)
      )
      .map(department => department.id)
  );
  const programIds = new Set(
    state.programs
      .filter(program => departmentIds.has(program.departmentId))
      .map(program => program.id)
  );
  const courseIds = new Set(
    state.courses
      .filter(course => programIds.has(course.programId))
      .map(course => course.id)
  );

  return courseIds;
}

function getHodStudentIds(state: PlatformStateSnapshot, actorId: string) {
  const courseIds = getHodCourseIds(state, actorId);
  const runIds = new Set(
    state.courseRuns
      .filter(run => courseIds.has(run.courseId))
      .map(run => run.id)
  );
  const classStudentIds = state.classGroups
    .filter(group => runIds.has(group.courseRunId))
    .flatMap(group => group.studentIds);
  const enrollmentStudentIds = state.enrollments
    .filter(enrollment => runIds.has(enrollment.courseRunId))
    .map(enrollment => enrollment.studentId);
  return new Set([...classStudentIds, ...enrollmentStudentIds]);
}

function getHodCertificateIds(state: PlatformStateSnapshot, actorId: string) {
  const courseIds = getHodCourseIds(state, actorId);
  const studentIds = getHodStudentIds(state, actorId);
  return new Set(
    state.certificates
      .filter(
        certificate =>
          courseIds.has(certificate.courseId) &&
          studentIds.has(certificate.studentId)
      )
      .map(certificate => certificate.id)
  );
}

function getRoleActorUser(state: PlatformStateSnapshot, role: Role) {
  const demoUser = getDemoUser(role);
  const user =
    state.users.find(user => user.id === demoUser.id) ??
    state.users.find(user => user.activeRole === role) ??
    state.users.find(user => user.roles.includes(role));
  const demoBranch = state.branches.find(
    branch => branch.name === demoUser.branch
  );
  const demoDepartment = state.departments.find(
    department => department.name === demoUser.department
  );

  return {
    id: user?.id ?? demoUser.id,
    name: user?.name ?? demoUser.name,
    branchId: user?.branchId ?? demoBranch?.id,
    departmentId: user?.departmentId ?? demoDepartment?.id,
  };
}

function getStudentScope(state: PlatformStateSnapshot) {
  const student =
    state.students.find(item => item.id === STUDENT_PROFILE_ID) ??
    state.students[0];
  const studentId = student?.id ?? STUDENT_PROFILE_ID;
  const user =
    state.users.find(item => item.id === student?.userId) ??
    state.users.find(item => item.id === STUDENT_USER_ID);
  const userId = user?.id ?? STUDENT_USER_ID;
  const enrollments = state.enrollments.filter(
    enrollment => enrollment.studentId === studentId
  );
  const runIds = new Set(enrollments.map(enrollment => enrollment.courseRunId));
  const classGroups = state.classGroups.filter(group =>
    runIds.has(group.courseRunId)
  );
  const classIds = new Set(classGroups.map(group => group.id));
  const courses = enrollments
    .map(enrollment => {
      const run = state.courseRuns.find(
        item => item.id === enrollment.courseRunId
      );
      const course = state.courses.find(item => item.id === run?.courseId);
      return run && course ? { enrollment, run, course } : null;
    })
    .filter(Boolean) as Array<{
    enrollment: PlatformStateSnapshot["enrollments"][number];
    run: PlatformStateSnapshot["courseRuns"][number];
    course: PlatformStateSnapshot["courses"][number];
  }>;

  return {
    student,
    studentId,
    user,
    userId,
    enrollments,
    runIds,
    classGroups,
    classIds,
    courses,
  };
}

function formatDateTime(value?: string) {
  if (!value) return "Not scheduled";
  return new Date(value).toLocaleString();
}

function formatReportDate(value?: string) {
  if (!value) return "No date";
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function statusLabel(value?: string | number) {
  return String(value ?? "ready").replace(/_/g, " ");
}

function userNameForStudent(state: PlatformStateSnapshot, studentId?: string) {
  const student = state.students.find(item => item.id === studentId);
  return (
    state.users.find(item => item.id === student?.userId)?.name ??
    studentId ??
    "Unassigned student"
  );
}

function courseTitleForRun(state: PlatformStateSnapshot, courseRunId?: string) {
  const run = state.courseRuns.find(item => item.id === courseRunId);
  const course = state.courses.find(item => item.id === run?.courseId);
  return course?.title ?? courseRunId ?? "Unassigned course";
}

function classNameForId(state: PlatformStateSnapshot, classGroupId?: string) {
  return (
    state.classGroups.find(item => item.id === classGroupId)?.name ??
    classGroupId ??
    "Unassigned class"
  );
}

function formatReportRow(
  row: ReportRow,
  reportType: ReportType,
  state: PlatformStateSnapshot
): DisplayReportRow {
  if (reportType === "attendance") {
    const studentName = userNameForStudent(
      state,
      "studentId" in row ? String(row.studentId) : undefined
    );
    const className = classNameForId(
      state,
      "classGroupId" in row ? String(row.classGroupId) : undefined
    );
    const status = statusLabel("status" in row ? row.status : "saved");
    const sessionId = "sessionId" in row ? String(row.sessionId) : "Session";
    return {
      eyebrow: "Attendance",
      title: studentName,
      subtitle: className,
      status,
      metric: sessionId,
      meta: "notes" in row && row.notes ? String(row.notes) : "Roster evidence",
      sort: {
        primary: studentName,
        status,
        metric: sessionId,
        updated: sessionId,
      },
    };
  }

  if (reportType === "finance") {
    const amount = "amount" in row ? Number(row.amount) : 0;
    const paid = "paid" in row ? Number(row.paid) : 0;
    const balance =
      "balance" in row ? Number(row.balance) : Math.max(0, amount - paid);
    const currency = "currency" in row ? String(row.currency) : "EGP";
    const studentName = userNameForStudent(
      state,
      "studentId" in row ? String(row.studentId) : undefined
    );
    const dueAt = "dueAt" in row ? String(row.dueAt) : "";
    const status = statusLabel("status" in row ? row.status : "pending");
    return {
      eyebrow: "Finance",
      title: studentName,
      subtitle: `Invoice ${"id" in row ? row.id : "record"} · due ${formatReportDate(dueAt)}`,
      status,
      metric: `${balance} ${currency} balance`,
      meta: `${paid} of ${amount} ${currency} paid`,
      sort: {
        primary: studentName,
        status,
        metric: balance,
        updated: dueAt,
      },
    };
  }

  if (reportType === "audit") {
    const actor =
      state.users.find(
        item => item.id === ("actorId" in row ? row.actorId : "")
      )?.name ?? ("actorId" in row ? String(row.actorId) : "System");
    const action = "action" in row ? String(row.action) : "Audit row";
    const createdAt = "createdAt" in row ? String(row.createdAt) : "";
    return {
      eyebrow: "Audit",
      title: action,
      subtitle: "summary" in row ? String(row.summary) : "Operational evidence",
      status: "logged",
      metric: actor,
      meta: `${"entityType" in row ? row.entityType : "Entity"} · ${formatReportDate(createdAt)}`,
      sort: {
        primary: action,
        status: "logged",
        metric: actor,
        updated: createdAt,
      },
    };
  }

  const studentName = userNameForStudent(
    state,
    "studentId" in row ? String(row.studentId) : undefined
  );
  const progress = "progress" in row ? Number(row.progress) : 0;
  const status = statusLabel("status" in row ? row.status : "active");
  return {
    eyebrow: "Enrollment",
    title: studentName,
    subtitle: courseTitleForRun(
      state,
      "courseRunId" in row ? String(row.courseRunId) : undefined
    ),
    status,
    metric:
      "progress" in row ? `${row.progress}% progress` : "Progress pending",
    meta:
      "attendanceRate" in row
        ? `${row.attendanceRate}% attendance · grade ${"currentGrade" in row ? row.currentGrade : "n/a"}`
        : "Academic record",
    sort: {
      primary: studentName,
      status,
      metric: progress,
      updated: "courseRunId" in row ? String(row.courseRunId) : "",
    },
  };
}

function getFutureDateInput(offsetDays = 1) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

function LearningWorkflow({
  role,
  state,
  refresh,
  params,
  backendSyncStatus = "offline",
}: WorkflowProps) {
  const [assignmentResponse, setAssignmentResponse] = useState(
    "I completed the checkpoint and need feedback on examples."
  );
  const [quizAnswer, setQuizAnswer] = useState("Correct");
  const [manualRunId, setManualRunId] = useState<string | null>(null);
  const [manualLessonId, setManualLessonId] = useState<string | null>(null);
  const studentId = state.students[0]?.id ?? "stu_demo";
  const routeCourseId = params?.courseId;
  const routeLessonId = params?.lessonId;
  const enrollments = state.enrollments.filter(
    item => item.studentId === studentId
  );
  const courseOptions = enrollments
    .map(enrollment => {
      const run = state.courseRuns.find(
        item => item.id === enrollment.courseRunId
      );
      const course = state.courses.find(item => item.id === run?.courseId);
      const classGroup =
        state.classGroups.find(item => item.id === enrollment.classGroupId) ??
        state.classGroups.find(
          item =>
            item.courseRunId === run?.id &&
            item.studentIds.includes(enrollment.studentId)
        ) ??
        state.classGroups.find(item => item.courseRunId === run?.id);
      return run && course ? { enrollment, run, course, classGroup } : null;
    })
    .filter(Boolean) as Array<{
    enrollment: (typeof state.enrollments)[number];
    run: (typeof state.courseRuns)[number];
    course: (typeof state.courses)[number];
    classGroup?: (typeof state.classGroups)[number];
  }>;
  const routedOption = courseOptions.find(
    ({ course, run }) =>
      routeCourseId === course.id ||
      routeCourseId === course.slug ||
      routeCourseId === run.id
  );
  const selectedOption =
    courseOptions.find(({ run }) => run.id === manualRunId) ??
    routedOption ??
    courseOptions[0];
  const enrollment = selectedOption?.enrollment;
  const run = selectedOption?.run;
  const course = selectedOption?.course;
  const classGroup =
    selectedOption?.classGroup ??
    state.classGroups.find(item => item.courseRunId === run?.id);
  const teacher = state.teachers.find(item => item.userId === run?.teacherId);
  const teacherUser = state.users.find(
    item => item.id === teacher?.userId || item.id === run?.teacherId
  );
  const meeting = state.meetingLinks.find(
    item => item.id === classGroup?.meetingLinkId
  );
  const modules = state.modules
    .filter(item => item.courseId === course?.id)
    .sort((a, b) => a.order - b.order);
  const lessonRows = modules.flatMap(module =>
    state.lessons
      .filter(lesson => lesson.moduleId === module.id)
      .map(lesson => {
        const progress = state.lessonProgress.find(
          item => item.lessonId === lesson.id && item.studentId === studentId
        );
        const resources = state.resources.filter(
          resource =>
            lesson.resourceIds.includes(resource.id) && resource.published
        );
        return { module, lesson, progress, resources };
      })
  );
  const nextLessonRow =
    lessonRows.find(row => row.progress?.status !== "completed") ??
    lessonRows[0];
  const selectedLessonRow =
    lessonRows.find(row => row.lesson.id === manualLessonId) ??
    lessonRows.find(row => row.lesson.id === routeLessonId) ??
    nextLessonRow;
  const selectedLesson = selectedLessonRow?.lesson;
  const selectedResources = selectedLessonRow?.resources ?? [];
  const completedLessons = lessonRows.filter(
    row => row.progress?.status === "completed"
  ).length;
  const lessonCompletion = lessonRows.length
    ? Math.round((completedLessons / lessonRows.length) * 100)
    : 0;
  const allLessonsComplete =
    lessonRows.length > 0 && completedLessons === lessonRows.length;
  const assignment = state.assignments.find(
    item => item.courseRunId === run?.id
  );
  const submission = assignment
    ? state.assignmentSubmissions.find(
        item =>
          item.assignmentId === assignment.id && item.studentId === studentId
      )
    : undefined;
  const quiz = state.quizzes.find(item => item.courseRunId === run?.id);
  const quizAttempts = quiz
    ? state.quizAttempts.filter(
        item => item.quizId === quiz.id && item.studentId === studentId
      )
    : [];
  const attemptsRemaining = Math.max(
    0,
    (quiz?.attemptsAllowed ?? 0) - quizAttempts.length
  );
  const latestAttempt = quizAttempts[0];
  const syncStatus = backendSyncStatus;
  const syncLabel =
    syncStatus === "supabase"
      ? "Supabase synced"
      : syncStatus === "local"
        ? "Local fallback"
        : syncStatus === "loading"
          ? "Syncing"
          : "Offline cache";

  const selectCourse = (runId: string) => {
    setManualRunId(runId);
    setManualLessonId(null);
  };

  const startSelectedLesson = () => {
    if (!selectedLesson) return;
    setManualLessonId(selectedLesson.id);
    const lesson = platformStore.startLesson(
      selectedLesson.id,
      studentId,
      getDemoUser(role).id
    );
    refresh();
    toast.success("Lesson opened", { description: lesson.title });
  };

  const completeSelectedLesson = () => {
    if (!selectedLesson) return;
    setManualLessonId(selectedLesson.id);
    const lesson = platformStore.completeLesson(
      selectedLesson.id,
      studentId,
      getDemoUser(role).id
    );
    refresh();
    toast.success("Lesson marked complete", { description: lesson.title });
  };

  const submitCheckpoint = () => {
    if (!assignment || !assignmentResponse.trim()) return;
    const saved = platformStore.submitAssignment(
      assignment.id,
      assignmentResponse,
      studentId,
      getDemoUser(role).id
    );
    refresh();
    toast.success("Checkpoint submitted", { description: saved.id });
  };

  const submitQuickQuiz = () => {
    if (!quiz || !quizAnswer.trim() || attemptsRemaining <= 0) return;
    const attempt = platformStore.submitQuizAttempt(
      quiz.id,
      { q1: quizAnswer },
      studentId,
      getDemoUser(role).id
    );
    refresh();
    toast.success("Quiz attempt saved", {
      description: `${attempt.score}/${attempt.maxScore}`,
    });
  };

  if (!selectedOption || !course || !run) {
    return (
      <section className="platform-workflow-card">
        <div className="platform-workflow-title">
          <span>
            <BookOpen size={16} /> Learning workspace
          </span>
          <strong>No active enrollment</strong>
        </div>
        <p>
          The student does not have an active course enrollment in system data.
        </p>
      </section>
    );
  }

  return (
    <div className="learning-workspace">
      <section className="learning-course-rail">
        <div className="platform-workflow-title">
          <span>
            <GraduationCap size={16} /> Enrolled courses
          </span>
          <strong>{courseOptions.length}</strong>
        </div>
        <div className="learning-course-switcher">
          {courseOptions.map(option => (
            <button
              key={option.run.id}
              className={option.run.id === run.id ? "active" : ""}
              onClick={() => selectCourse(option.run.id)}
            >
              <span>{option.course.title}</span>
              <small>{option.classGroup?.schedule ?? option.run.term}</small>
              <ChevronRight size={15} />
            </button>
          ))}
        </div>
      </section>

      <PlatformWorkspaceHeader
        className="learning-hero-panel"
        title={course.title}
        description={course.description}
        context={<span>Course workspace</span>}
        meta={
          <div className="learning-hero-meta">
            <span>
              <CalendarDays size={14} /> {classGroup?.schedule ?? run.term}
            </span>
            <span>
              <BookMarked size={14} /> {modules.length} modules
            </span>
            <span>
              <Clock3 size={14} />{" "}
              {lessonRows.reduce(
                (sum, row) => sum + row.lesson.durationMinutes,
                0
              )}{" "}
              min
            </span>
            <span className={`learning-sync-pill ${syncStatus}`}>
              <Activity size={14} /> {syncLabel}
            </span>
          </div>
        }
        aside={
          <div className="learning-progress-panel">
            <span>Lesson completion</span>
            <strong>{lessonCompletion}%</strong>
            <div>
              <i
                style={{
                  width: `${lessonCompletion}%`,
                  background: roleMeta[role].color,
                }}
              />
            </div>
            <small>
              {completedLessons} of {lessonRows.length} lessons complete ·
              enrollment {enrollment?.progress ?? 0}%
            </small>
          </div>
        }
      />

      <div className="learning-main-grid">
        <section className="learning-player-panel">
          <div className="learning-player-top">
            <span className="learning-lesson-type">
              {selectedLesson?.type ?? "lesson"}
            </span>
            <span>
              {selectedLessonRow?.progress?.status.replace("_", " ") ??
                "not started"}
            </span>
          </div>
          <NileLessonPlayer
            lesson={selectedLesson}
            moduleTitle={selectedLessonRow?.module.title}
            outcomes={selectedLessonRow?.module.outcomes ?? []}
            resources={selectedResources}
            progressStatus={selectedLessonRow?.progress?.status}
            syncStatus={syncStatus}
          />
          <div className="learning-player-actions">
            <button disabled={!selectedLesson} onClick={startSelectedLesson}>
              <Play size={15} />
              Start lesson
            </button>
            <button
              disabled={
                !selectedLesson ||
                selectedLessonRow?.progress?.status === "completed"
              }
              onClick={completeSelectedLesson}
            >
              <CheckCircle2 size={15} />
              {selectedLessonRow?.progress?.status === "completed"
                ? "Completed"
                : "Mark complete"}
            </button>
            <button
              onClick={() =>
                toast.success("Live class ready", {
                  description:
                    meeting?.url ?? "Meeting provider is not connected yet.",
                })
              }
            >
              <Radio size={15} />
              Join live
            </button>
          </div>
        </section>

        <section className="learning-path-panel">
          <div className="platform-workflow-title">
            <span>
              <ListChecks size={16} /> Lesson pathway
            </span>
            <strong>{run.term}</strong>
          </div>
          <div className="learning-module-list">
            {modules.map(module => {
              const moduleLessons = lessonRows.filter(
                row => row.module.id === module.id
              );
              return (
                <div key={module.id} className="learning-module-group">
                  <div>
                    <strong>{module.title}</strong>
                    <small>{module.outcomes.join(" · ")}</small>
                  </div>
                  {moduleLessons.map(row => {
                    const Icon = getLessonIcon(row.lesson.type);
                    const active = selectedLesson?.id === row.lesson.id;
                    return (
                      <button
                        key={row.lesson.id}
                        className={`learning-lesson-row ${active ? "active" : ""}`}
                        onClick={() => setManualLessonId(row.lesson.id)}
                      >
                        <span>
                          <Icon size={15} />
                        </span>
                        <div>
                          <strong>{row.lesson.title}</strong>
                          <small>
                            {row.lesson.type} · {row.lesson.durationMinutes} min
                            · {row.resources.length} resources
                          </small>
                        </div>
                        <em>
                          {row.progress?.status.replace("_", " ") ??
                            "not started"}
                        </em>
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </section>

        <aside className="learning-context-panel">
          <div className="learning-metric-strip">
            <MiniMetric
              label="Attendance"
              value={`${enrollment?.attendanceRate ?? 0}%`}
            />
            <MiniMetric
              label="Grade"
              value={`${enrollment?.currentGrade ?? 0}%`}
            />
            <MiniMetric
              label="Teacher"
              value={teacherUser?.name ?? "Assigned"}
            />
          </div>

          <section className="learning-side-card">
            <div className="platform-workflow-title">
              <span>
                <Download size={16} /> Lesson resources
              </span>
              <strong>{selectedResources.length}</strong>
            </div>
            <div className="learning-resource-list">
              {selectedResources.map(resource => {
                const Icon =
                  resource.type === "audio"
                    ? Headphones
                    : resource.type === "video"
                      ? Video
                      : FileText;
                return (
                  <a key={resource.id} href={resource.url}>
                    <Icon size={15} />
                    <span>{resource.title}</span>
                    <ArrowRight size={14} />
                  </a>
                );
              })}
              {!selectedResources.length ? (
                <small>No resources attached to this lesson.</small>
              ) : null}
            </div>
          </section>

          <section className="learning-side-card">
            <div className="platform-workflow-title">
              <span>
                <NotebookPen size={16} /> Assignment checkpoint
              </span>
              <strong>{submission?.status ?? "not submitted"}</strong>
            </div>
            <p>
              {assignment?.title ??
                "No assignment is attached to this course run."}
            </p>
            {assignment ? (
              <>
                <textarea
                  value={assignmentResponse}
                  onChange={event => setAssignmentResponse(event.target.value)}
                />
                <button
                  onClick={submitCheckpoint}
                  disabled={!assignmentResponse.trim()}
                >
                  <Send size={15} />
                  Submit checkpoint
                </button>
              </>
            ) : null}
          </section>

          <section className="learning-side-card">
            <div className="platform-workflow-title">
              <span>
                <ClipboardCheck size={16} /> Quiz readiness
              </span>
              <strong>{attemptsRemaining} left</strong>
            </div>
            <p>
              {quiz
                ? `${quiz.title} · ${quiz.durationMinutes} minutes · latest ${latestAttempt ? `${latestAttempt.score}/${latestAttempt.maxScore}` : "not attempted"}.`
                : "No quiz is attached to this course run."}
            </p>
            {quiz ? (
              <div className="learning-quiz-inline">
                <input
                  value={quizAnswer}
                  onChange={event => setQuizAnswer(event.target.value)}
                  aria-label="Quick quiz answer"
                />
                <button
                  onClick={submitQuickQuiz}
                  disabled={!quizAnswer.trim() || attemptsRemaining <= 0}
                >
                  Submit
                </button>
              </div>
            ) : null}
          </section>

          <section className="learning-side-card">
            <div className="platform-workflow-title">
              <span>
                <Award size={16} /> Certificate path
              </span>
              <strong>
                {state.certificates.find(
                  item =>
                    item.courseId === course.id && item.studentId === studentId
                )?.verificationCode ?? "Pending"}
              </strong>
            </div>
            <p>
              Eligibility uses lesson completion, grade, attendance, and teacher
              approval from system data.
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}

function NileLessonPlayer({
  lesson,
  moduleTitle,
  outcomes,
  resources,
  progressStatus,
  syncStatus,
}: {
  lesson?: Lesson;
  moduleTitle?: string;
  outcomes: string[];
  resources: LessonResource[];
  progressStatus?: string;
  syncStatus: "loading" | "supabase" | "local" | "offline";
}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(
    progressStatus === "completed"
      ? 100
      : progressStatus === "in_progress"
        ? 36
        : 0
  );
  const [volume, setVolume] = useState(84);
  const [speed, setSpeed] = useState("1x");
  const [captionsOn, setCaptionsOn] = useState(true);
  const [boardMode, setBoardMode] = useState(false);
  const primaryMedia = resources.find(
    resource => resource.type === "video" || resource.type === "audio"
  );
  const playerMode =
    lesson?.type === "live"
      ? "live"
      : primaryMedia?.type === "audio"
        ? "audio"
        : lesson?.type === "video" || primaryMedia?.type === "video"
          ? "video"
          : lesson?.type === "assessment"
            ? "assessment"
            : "studio";
  const durationSeconds = Math.max(60, (lesson?.durationMinutes ?? 1) * 60);
  const currentSeconds = Math.round((progress / 100) * durationSeconds);
  const MediaIcon =
    playerMode === "audio"
      ? Headphones
      : playerMode === "live"
        ? Radio
        : playerMode === "assessment"
          ? ClipboardCheck
          : Video;
  const syncCopy =
    syncStatus === "supabase"
      ? "Synced"
      : syncStatus === "loading"
        ? "Syncing"
        : syncStatus === "offline"
          ? "Offline"
          : "Local";
  const captionText = lesson
    ? playerMode === "live"
      ? "Live room opens with attendance, recitation, and class notes attached."
      : `${moduleTitle ?? "Lesson"} · ${lesson.durationMinutes} min · ${outcomes.slice(0, 2).join(" and ")}.`
    : "Select a lesson to load the player.";

  useEffect(() => {
    setIsPlaying(false);
    setProgress(
      progressStatus === "completed"
        ? 100
        : progressStatus === "in_progress"
          ? 36
          : 0
    );
  }, [lesson?.id, progressStatus]);

  useEffect(() => {
    if (!isPlaying) return;
    const interval = window.setInterval(() => {
      setProgress(value => {
        if (value >= 100) {
          window.clearInterval(interval);
          setIsPlaying(false);
          return 100;
        }
        return Math.min(100, value + 1.25);
      });
    }, 900);
    return () => window.clearInterval(interval);
  }, [isPlaying]);

  const shiftProgress = (amount: number) => {
    setProgress(value => Math.min(100, Math.max(0, value + amount)));
  };

  return (
    <div
      className={`nile-player ${boardMode ? "board-mode" : ""} ${playerMode}`}
    >
      <div className="nile-player-header">
        <div>
          <span>Nile Player</span>
          <strong>{lesson?.title ?? "No lesson selected"}</strong>
        </div>
        <div className="nile-player-status">
          <em>{playerMode}</em>
          <em>{syncCopy}</em>
        </div>
      </div>

      <div className="nile-player-stage">
        <div className="nile-player-pattern" aria-hidden="true" />
        <div className="nile-player-mark">
          <MediaIcon size={boardMode ? 54 : 42} />
        </div>
        <div className="nile-player-content">
          <span>{moduleTitle ?? "Course media"}</span>
          <h3>{lesson?.title ?? "Choose a lesson"}</h3>
          <p>{captionText}</p>
        </div>
        {playerMode === "audio" || playerMode === "live" ? (
          <div className="nile-waveform" aria-hidden="true">
            {Array.from({ length: 34 }).map((_, index) => (
              <i
                key={index}
                style={{ height: `${20 + ((index * 17) % 56)}%` }}
              />
            ))}
          </div>
        ) : (
          <div className="nile-video-grid" aria-hidden="true">
            <span />
            <span />
            <span />
            <span />
          </div>
        )}
        {captionsOn ? (
          <div className="nile-caption-line">{captionText}</div>
        ) : null}
      </div>

      <div className="nile-player-controls">
        <button
          type="button"
          aria-label="Back 10 seconds"
          onClick={() => shiftProgress(-8)}
          disabled={!lesson}
        >
          <SkipBack size={16} />
        </button>
        <button
          type="button"
          className="nile-play-button"
          aria-label={isPlaying ? "Pause lesson" : "Play lesson"}
          onClick={() => setIsPlaying(value => !value)}
          disabled={!lesson}
        >
          {isPlaying ? <Pause size={18} /> : <Play size={18} />}
        </button>
        <button
          type="button"
          aria-label="Forward 10 seconds"
          onClick={() => shiftProgress(8)}
          disabled={!lesson}
        >
          <SkipForward size={16} />
        </button>

        <div className="nile-timeline">
          <span>{formatPlayerTime(currentSeconds)}</span>
          <input
            type="range"
            aria-label="Lesson timeline"
            min="0"
            max="100"
            value={Math.round(progress)}
            onChange={event => setProgress(Number(event.target.value))}
            disabled={!lesson}
          />
          <span>{formatPlayerTime(durationSeconds)}</span>
        </div>

        <div className="nile-volume">
          {volume > 0 ? <Volume2 size={16} /> : <VolumeX size={16} />}
          <input
            type="range"
            aria-label="Lesson volume"
            min="0"
            max="100"
            value={volume}
            onChange={event => setVolume(Number(event.target.value))}
          />
        </div>

        <select
          aria-label="Playback speed"
          value={speed}
          onChange={event => setSpeed(event.target.value)}
        >
          <option value="0.75x">0.75x</option>
          <option value="1x">1x</option>
          <option value="1.25x">1.25x</option>
          <option value="1.5x">1.5x</option>
        </select>

        <button
          type="button"
          aria-label="Toggle captions"
          className={captionsOn ? "active" : ""}
          onClick={() => setCaptionsOn(value => !value)}
        >
          <Captions size={16} />
        </button>
        <button
          type="button"
          aria-label="Toggle classroom mode"
          className={boardMode ? "active" : ""}
          onClick={() => setBoardMode(value => !value)}
        >
          {boardMode ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
        </button>
        <button type="button" aria-label="Player settings">
          <Settings size={16} />
        </button>
      </div>
    </div>
  );
}

function formatPlayerTime(seconds: number) {
  const safeSeconds = Math.max(0, seconds);
  const minutes = Math.floor(safeSeconds / 60);
  const remaining = safeSeconds % 60;
  return `${minutes}:${String(remaining).padStart(2, "0")}`;
}

function getLessonIcon(
  type: "video" | "live" | "reading" | "practice" | "assessment"
) {
  if (type === "video") return Video;
  if (type === "live") return Radio;
  if (type === "practice") return NotebookPen;
  if (type === "assessment") return ClipboardCheck;
  return BookOpen;
}

function AssessmentWorkflow({ role, state, refresh, params }: WorkflowProps) {
  const [submissionText, setSubmissionText] = useState(
    "Completed response with examples."
  );
  const [quizAnswers, setQuizAnswers] = useState<Record<string, string>>({});
  const [assignmentDraft, setAssignmentDraft] = useState({
    title: "Weekly applied writing task",
    dueAt: getFutureDateInput(5),
    submissionType: "text" as "text" | "file" | "audio" | "video",
    rubric: "Accuracy, Evidence, Teacher notes",
  });
  const [quizDraft, setQuizDraft] = useState({
    title: "Checkpoint quiz",
    dueAt: getFutureDateInput(4),
    durationMinutes: 20,
    attemptsAllowed: 2,
    questionTypes: "multiple_choice, short_answer",
  });
  const [selectedStaffRunId, setSelectedStaffRunId] = useState("");
  const [selectedPendingSubmissionId, setSelectedPendingSubmissionId] =
    useState("");
  const [selectedQuizAttemptId, setSelectedQuizAttemptId] = useState("");
  const [questionDraft, setQuestionDraft] = useState({
    prompt: "Choose the correct answer and explain the grammar rule.",
    questionType: "short_answer" as
      | "multiple_choice"
      | "true_false"
      | "short_answer"
      | "essay"
      | "oral_record"
      | "file_upload",
    difficulty: "core" as "foundation" | "core" | "challenge",
    tags: "grammar, review",
    choices: "",
    answerKey: "Teacher-reviewed answer",
    rubric: "Accuracy, Reasoning",
  });
  const [selectedAttachQuizId, setSelectedAttachQuizId] = useState("");
  const [gradeDraft, setGradeDraft] = useState({
    score: 86,
    feedback:
      "Clear response. Add one more example before final portfolio review.",
  });
  const [quizReviewDraft, setQuizReviewDraft] = useState({
    score: 88,
    feedback: "Reviewed. Keep strengthening evidence and accuracy.",
  });
  const [savingAction, setSavingAction] = useState("");
  const [actionError, setActionError] = useState("");
  const studentScope = getStudentScope(state);
  const studentRunIds = studentScope.runIds;
  const actorUser = getRoleActorUser(state, role);
  const editableAssessments = role === "teacher" || role === "headofdepartment";
  const teacherRunIds = new Set(
    state.courseRuns
      .filter(run => role !== "teacher" || run.teacherId === actorUser.id)
      .map(run => run.id)
  );
  const hodCourseIds = new Set(
    role === "headofdepartment"
      ? (() => {
          const departmentIds = new Set(
            state.departments
              .filter(
                department =>
                  department.ownerUserId === actorUser.id ||
                  department.id === actorUser.departmentId
              )
              .map(department => department.id)
          );
          const programIds = new Set(
            state.programs
              .filter(program => departmentIds.has(program.departmentId))
              .map(program => program.id)
          );
          return state.courses
            .filter(course => programIds.has(course.programId))
            .map(course => course.id);
        })()
      : []
  );
  const staffRunOptions = state.courseRuns.filter(run => {
    if (role === "teacher") return teacherRunIds.has(run.id);
    if (role === "headofdepartment") return hodCourseIds.has(run.courseId);
    return false;
  });
  useEffect(() => {
    if (!selectedStaffRunId && staffRunOptions[0]?.id) {
      setSelectedStaffRunId(staffRunOptions[0].id);
    }
  }, [selectedStaffRunId, staffRunOptions]);
  const selectedStaffRun =
    staffRunOptions.find(run => run.id === selectedStaffRunId) ??
    staffRunOptions[0];
  const scopedRunIds =
    role === "student"
      ? studentRunIds
      : new Set(staffRunOptions.map(run => run.id));
  const assignmentOptions =
    role === "student"
      ? state.assignments.filter(assignment =>
          studentRunIds.has(assignment.courseRunId)
        )
      : state.assignments.filter(assignment =>
          scopedRunIds.has(assignment.courseRunId)
        );
  const quizOptions =
    role === "student"
      ? state.quizzes.filter(quiz => studentRunIds.has(quiz.courseRunId))
      : state.quizzes.filter(quiz => scopedRunIds.has(quiz.courseRunId));
  const questionBankItems =
    role === "student"
      ? []
      : state.questionBankItems
          .filter(question => scopedRunIds.has(question.courseRunId))
          .sort(
            (a, b) =>
              new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
          );
  const selectedRunQuestions = selectedStaffRun
    ? questionBankItems.filter(
        question => question.courseRunId === selectedStaffRun.id
      )
    : questionBankItems;
  const selectedRunQuizzes = selectedStaffRun
    ? quizOptions.filter(item => item.courseRunId === selectedStaffRun.id)
    : quizOptions;
  useEffect(() => {
    if (!selectedAttachQuizId && selectedRunQuizzes[0]?.id) {
      setSelectedAttachQuizId(selectedRunQuizzes[0].id);
    }
    if (
      selectedAttachQuizId &&
      !selectedRunQuizzes.some(item => item.id === selectedAttachQuizId)
    ) {
      setSelectedAttachQuizId(selectedRunQuizzes[0]?.id ?? "");
    }
  }, [selectedAttachQuizId, selectedRunQuizzes]);
  const selectedAttachQuiz =
    selectedRunQuizzes.find(item => item.id === selectedAttachQuizId) ??
    selectedRunQuizzes[0];
  const attachedQuestionIds = new Set(selectedAttachQuiz?.questionIds ?? []);
  const routedAssignment = assignmentOptions.find(
    item => item.id === params?.assignmentId
  );
  const routedQuiz = quizOptions.find(item => item.id === params?.quizId);
  const assignment =
    routedAssignment ??
    (routedQuiz
      ? assignmentOptions.find(
          item => item.courseRunId === routedQuiz.courseRunId
        )
      : undefined) ??
    assignmentOptions[0];
  const quiz =
    routedQuiz ??
    (routedAssignment
      ? quizOptions.find(
          item => item.courseRunId === routedAssignment.courseRunId
        )
      : undefined) ??
    quizOptions[0];
  const latestSubmission = state.assignmentSubmissions.find(
    item =>
      item.assignmentId === assignment?.id &&
      (role !== "student" || item.studentId === studentScope.studentId)
  );
  const selectedAssignmentGrade = state.grades.find(
    item =>
      item.itemId === assignment?.id &&
      (role !== "student" || item.studentId === studentScope.studentId)
  );
  const latestAttempt = state.quizAttempts.find(
    item =>
      item.quizId === quiz?.id &&
      (role !== "student" || item.studentId === studentScope.studentId)
  );
  const selectedQuizGrade = state.grades.find(
    item =>
      item.itemId === quiz?.id &&
      (role !== "student" || item.studentId === studentScope.studentId)
  );
  const attemptsUsed = state.quizAttempts.filter(
    item =>
      item.quizId === quiz?.id && item.studentId === studentScope.studentId
  ).length;
  const attemptsRemaining = Math.max(
    0,
    (quiz?.attemptsAllowed ?? 0) - attemptsUsed
  );
  const selectedAssignmentRun = state.courseRuns.find(
    run => run.id === assignment?.courseRunId
  );
  const selectedAssignmentCourse = state.courses.find(
    course => course.id === selectedAssignmentRun?.courseId
  );
  const selectedQuizRun = state.courseRuns.find(
    run => run.id === quiz?.courseRunId
  );
  const selectedQuizCourse = state.courses.find(
    course => course.id === selectedQuizRun?.courseId
  );
  const quizQuestionPreviews =
    quiz && role === "student"
      ? state.quizQuestionPreviews.filter(
          question =>
            question.quizId === quiz.id && question.status === "active"
        )
      : [];
  const quizHasAttachedQuestions = Boolean(quiz?.questionIds.length);
  const quizHasSafeQuestionPreview = quizQuestionPreviews.length > 0;
  const quizFallbackAnswer = quizAnswers.__fallback ?? "";
  const quizHasAnswer = quizHasSafeQuestionPreview
    ? quizQuestionPreviews.some(
        question => (quizAnswers[question.id] ?? "").trim().length > 0
      )
    : quizFallbackAnswer.trim().length > 0;
  const pendingSubmissions = state.assignmentSubmissions.filter(submission => {
    const submissionAssignment = state.assignments.find(
      item => item.id === submission.assignmentId
    );
    return (
      submission.status === "pending" &&
      Boolean(
        submissionAssignment &&
          scopedRunIds.has(submissionAssignment.courseRunId)
      )
    );
  });
  const pendingSubmissionKey = pendingSubmissions
    .map(submission => submission.id)
    .join("|");
  const selectedPendingSubmission =
    pendingSubmissions.find(
      submission => submission.id === selectedPendingSubmissionId
    ) ?? pendingSubmissions[0];
  const selectedPendingAssignment = state.assignments.find(
    item => item.id === selectedPendingSubmission?.assignmentId
  );
  const selectedPendingStudent = state.students.find(
    item => item.id === selectedPendingSubmission?.studentId
  );
  const selectedPendingUser = state.users.find(
    item => item.id === selectedPendingStudent?.userId
  );
  const isReviewNeededQuizAttempt = (status: unknown) => {
    const normalized = String(status);
    return normalized === "pending" || normalized === "submitted";
  };
  const scopedQuizAttempts = editableAssessments
    ? state.quizAttempts
        .filter(attempt => {
          const attemptQuiz = state.quizzes.find(
            item => item.id === attempt.quizId
          );
          return Boolean(
            attemptQuiz && scopedRunIds.has(attemptQuiz.courseRunId)
          );
        })
        .sort((a, b) => {
          const statusPriority = (value: typeof a.status) =>
            isReviewNeededQuizAttempt(value) ? 0 : 1;
          const priorityDelta =
            statusPriority(a.status) - statusPriority(b.status);
          if (priorityDelta !== 0) return priorityDelta;
          return (
            new Date(b.submittedAt ?? b.startedAt).getTime() -
            new Date(a.submittedAt ?? a.startedAt).getTime()
          );
        })
    : [];
  const reviewableQuizAttempts = scopedQuizAttempts.filter(attempt =>
    isReviewNeededQuizAttempt(attempt.status)
  );
  const reviewedQuizAttempts = scopedQuizAttempts
    .filter(attempt => !isReviewNeededQuizAttempt(attempt.status))
    .slice(0, 4);
  const reviewableQuizAttemptKey = reviewableQuizAttempts
    .map(attempt => attempt.id)
    .join("|");
  const selectedQuizAttempt =
    reviewableQuizAttempts.find(
      attempt => attempt.id === selectedQuizAttemptId
    ) ?? reviewableQuizAttempts[0];
  const selectedReviewQuiz = state.quizzes.find(
    item => item.id === selectedQuizAttempt?.quizId
  );
  const selectedReviewStudent = state.students.find(
    item => item.id === selectedQuizAttempt?.studentId
  );
  const selectedReviewUser = state.users.find(
    item => item.id === selectedReviewStudent?.userId
  );
  const selectedReviewQuestions = selectedReviewQuiz
    ? selectedReviewQuiz.questionIds
        .map(questionId =>
          questionBankItems.find(question => question.id === questionId)
        )
        .filter(Boolean)
    : [];
  const recentAssessmentAudits = state.auditLogs
    .filter(audit =>
      /assignment|quiz|grade|question/i.test(
        `${audit.action} ${audit.entityType}`
      )
    )
    .slice(0, 4);

  useEffect(() => {
    setQuizAnswers({});
  }, [quiz?.id]);

  useEffect(() => {
    setSelectedPendingSubmissionId(current =>
      current &&
      pendingSubmissions.some(submission => submission.id === current)
        ? current
        : (pendingSubmissions[0]?.id ?? "")
    );
  }, [pendingSubmissionKey]);

  useEffect(() => {
    setSelectedQuizAttemptId(current =>
      current && reviewableQuizAttempts.some(attempt => attempt.id === current)
        ? current
        : (reviewableQuizAttempts[0]?.id ?? "")
    );
  }, [reviewableQuizAttemptKey]);

  const runWorkflowAction = async (
    actionLabel: string,
    payload: Parameters<typeof runPlatformWorkflowActionRequest>[0]
  ) => {
    setSavingAction(actionLabel);
    setActionError("");
    const result = await runPlatformWorkflowActionRequest(payload);
    setSavingAction("");
    if (!result.ok || !result.data) {
      const message = result.error ?? `${actionLabel} failed.`;
      setActionError(message);
      toast.error(`${actionLabel} failed`, { description: message });
      return null;
    }
    platformStore.setState(result.data.state);
    refresh();
    return result.data.result;
  };

  const submitAssignment = async () => {
    if (!assignment || !submissionText.trim()) return;
    const result = await runWorkflowAction("Assignment submission", {
      type: "assignment.submit",
      assignmentId: assignment.id,
      response: submissionText.trim(),
    });
    if (result)
      toast.success("Assignment submitted", { description: result.entityId });
  };

  const submitQuiz = async () => {
    if (!quiz || !quizHasAnswer || attemptsRemaining <= 0) return;
    const answers = quizHasSafeQuestionPreview
      ? Object.fromEntries(
          quizQuestionPreviews
            .map(question => [
              question.id,
              (quizAnswers[question.id] ?? "").trim(),
            ])
            .filter(([, answer]) => answer.length > 0)
        )
      : { q1: quizFallbackAnswer.trim() };
    const result = await runWorkflowAction("Quiz attempt", {
      type: "quiz.submit",
      quizId: quiz.id,
      answers,
    });
    const attempt = result?.result as typeof latestAttempt | undefined;
    if (result) {
      toast.success("Quiz submitted", {
        description: attempt
          ? `${attempt.score}/${attempt.maxScore}`
          : result.entityId,
      });
    }
  };

  const setQuizQuestionAnswer = (questionId: string, value: string) => {
    setQuizAnswers(current => ({ ...current, [questionId]: value }));
  };

  const renderQuizQuestionInput = (question: QuizQuestionPreview) => {
    const value = quizAnswers[question.id] ?? "";
    if (question.type === "multiple_choice" || question.type === "true_false") {
      const choices =
        question.type === "true_false" && question.choices.length === 0
          ? ["True", "False"]
          : question.choices;
      return (
        <div
          className="platform-quiz-choice-grid"
          role="radiogroup"
          aria-label={question.prompt}
        >
          {choices.map(choice => (
            <button
              key={choice}
              type="button"
              className={value === choice ? "selected" : ""}
              onClick={() => setQuizQuestionAnswer(question.id, choice)}
            >
              <CheckCircle2 size={14} />
              {choice}
            </button>
          ))}
        </div>
      );
    }
    if (question.type === "oral_record" || question.type === "file_upload") {
      return (
        <div className="platform-quiz-storage-state">
          <strong>
            {question.type === "oral_record"
              ? "Audio response"
              : "File response"}
          </strong>
          <span>
            Storage upload is not connected in this slice. Attach a pending
            response so the attempt can move into teacher review.
          </span>
          <button
            type="button"
            className={value ? "selected" : ""}
            onClick={() =>
              setQuizQuestionAnswer(
                question.id,
                question.type === "oral_record"
                  ? "Pending audio response attached"
                  : "Pending file response attached"
              )
            }
          >
            <CheckCircle2 size={14} />
            {value ? "Pending response attached" : "Use pending media response"}
          </button>
        </div>
      );
    }
    return (
      <textarea
        aria-label={question.prompt}
        value={value}
        onChange={event =>
          setQuizQuestionAnswer(question.id, event.target.value)
        }
        placeholder="Write your response"
      />
    );
  };

  const createAssignment = async () => {
    if (!selectedStaffRun || !assignmentDraft.title.trim()) return;
    const result = await runWorkflowAction("Assignment create", {
      type: "assignment.create",
      courseRunId: selectedStaffRun.id,
      title: assignmentDraft.title.trim(),
      dueAt: new Date(assignmentDraft.dueAt).toISOString(),
      submissionType: assignmentDraft.submissionType,
      rubric: assignmentDraft.rubric
        .split(",")
        .map(item => item.trim())
        .filter(Boolean),
    });
    if (result)
      toast.success("Assignment created", { description: result.entityId });
  };

  const createQuiz = async () => {
    if (!selectedStaffRun || !quizDraft.title.trim()) return;
    const result = await runWorkflowAction("Quiz create", {
      type: "quiz.create",
      courseRunId: selectedStaffRun.id,
      title: quizDraft.title.trim(),
      dueAt: new Date(quizDraft.dueAt).toISOString(),
      durationMinutes: Math.max(5, Number(quizDraft.durationMinutes) || 20),
      attemptsAllowed: Math.max(1, Number(quizDraft.attemptsAllowed) || 1),
      questionTypes: quizDraft.questionTypes
        .split(",")
        .map(item => item.trim())
        .filter(Boolean),
    });
    if (result) toast.success("Quiz created", { description: result.entityId });
  };

  const createQuestion = async () => {
    if (!selectedStaffRun || !questionDraft.prompt.trim()) return;
    const result = await runWorkflowAction("Question create", {
      type: "question.create",
      courseRunId: selectedStaffRun.id,
      prompt: questionDraft.prompt.trim(),
      questionType: questionDraft.questionType,
      difficulty: questionDraft.difficulty,
      tags: questionDraft.tags
        .split(",")
        .map(item => item.trim())
        .filter(Boolean),
      choices: questionDraft.choices
        .split(",")
        .map(item => item.trim())
        .filter(Boolean),
      answerKey: questionDraft.answerKey.trim(),
      rubric: questionDraft.rubric
        .split(",")
        .map(item => item.trim())
        .filter(Boolean),
    });
    if (result)
      toast.success("Question saved", { description: result.entityId });
  };

  const setQuizQuestions = async (questionIds: string[]) => {
    if (!selectedAttachQuiz) return;
    const result = await runWorkflowAction("Quiz question attach", {
      type: "quiz.questions.set",
      quizId: selectedAttachQuiz.id,
      questionIds,
    });
    if (result)
      toast.success("Quiz questions updated", { description: result.entityId });
  };

  const attachQuestionToQuiz = (questionId: string) => {
    if (!selectedAttachQuiz) return;
    setQuizQuestions([...Array.from(attachedQuestionIds), questionId]);
  };

  const attachAllRunQuestions = () => {
    if (!selectedAttachQuiz) return;
    setQuizQuestions(selectedRunQuestions.map(question => question.id));
  };

  const gradeSubmission = async () => {
    if (!selectedPendingSubmission || !editableAssessments) return;
    const result = await runWorkflowAction("Grade submission", {
      type: "assignment.grade",
      submissionId: selectedPendingSubmission.id,
      score: Math.min(100, Math.max(0, Number(gradeDraft.score) || 0)),
      feedback: gradeDraft.feedback.trim() || "Reviewed by teacher.",
    });
    if (result)
      toast.success("Submission graded", { description: result.entityId });
  };

  const reviewQuizAttempt = async () => {
    if (!selectedQuizAttempt || !editableAssessments) return;
    const result = await runWorkflowAction("Quiz review", {
      type: "quiz.review",
      attemptId: selectedQuizAttempt.id,
      score: Math.min(100, Math.max(0, Number(quizReviewDraft.score) || 0)),
      feedback: quizReviewDraft.feedback.trim() || "Reviewed by teacher.",
    });
    if (result)
      toast.success("Quiz reviewed", { description: result.entityId });
  };

  return (
    <div className="platform-workflow-layout">
      <div className="platform-workflow-main">
        {actionError ? (
          <div className="platform-empty-state error">
            <strong>Assessment action failed</strong>
            <span>{actionError}</span>
          </div>
        ) : null}
        <section className="platform-workflow-card">
          <div className="platform-workflow-title">
            <span>
              <ClipboardCheck size={16} /> Assignment workflow
            </span>
            <strong>
              {role === "student" ? assignment?.title : "Assignment queue"}
            </strong>
          </div>
          {assignment ? (
            <>
              <p>
                {selectedAssignmentCourse?.title ?? "Course"} · Submission type:{" "}
                {assignment.submissionType}. Rubric:{" "}
                {assignment.rubric.join(", ")}.
              </p>
              <div className="platform-row-list compact">
                {assignmentOptions.slice(0, 4).map(item => (
                  <article
                    key={item.id}
                    className={item.id === assignment.id ? "selected" : ""}
                  >
                    <div>
                      <strong>{item.title}</strong>
                      <small>
                        Due {new Date(item.dueAt).toLocaleDateString()} ·{" "}
                        {item.status}
                      </small>
                    </div>
                  </article>
                ))}
              </div>
              {role === "student" ? (
                <div
                  className={`platform-assessment-feedback ${selectedAssignmentGrade ? "reviewed" : latestSubmission ? "pending" : "empty"}`}
                >
                  <div>
                    <span>
                      {selectedAssignmentGrade
                        ? "Reviewed assignment"
                        : latestSubmission
                          ? "Submitted for review"
                          : "No submission yet"}
                    </span>
                    <strong>
                      {selectedAssignmentGrade
                        ? `${selectedAssignmentGrade.score}/${selectedAssignmentGrade.maxScore}`
                        : (latestSubmission?.status ?? "Ready")}
                    </strong>
                    <p>
                      {selectedAssignmentGrade?.feedback ??
                        latestSubmission?.feedback ??
                        (latestSubmission
                          ? "Your teacher will grade this submission and return feedback here."
                          : "Submit your answer when you are ready for teacher review.")}
                    </p>
                  </div>
                  <dl>
                    <div>
                      <dt>Course</dt>
                      <dd>{selectedAssignmentCourse?.title ?? "Course"}</dd>
                    </div>
                    <div>
                      <dt>Status</dt>
                      <dd>
                        {selectedAssignmentGrade
                          ? "recorded"
                          : (latestSubmission?.status ?? "not started")}
                      </dd>
                    </div>
                    <div>
                      <dt>Submitted</dt>
                      <dd>
                        {latestSubmission
                          ? formatDateTime(latestSubmission.submittedAt)
                          : "none"}
                      </dd>
                    </div>
                  </dl>
                </div>
              ) : null}
              {role === "student" ? (
                <>
                  <textarea
                    aria-label="Assignment response"
                    value={submissionText}
                    onChange={event => setSubmissionText(event.target.value)}
                  />
                  <button
                    className="platform-primary-button"
                    style={{ background: roleMeta[role].color }}
                    disabled={
                      !submissionText.trim() ||
                      savingAction === "Assignment submission"
                    }
                    onClick={submitAssignment}
                  >
                    <Send size={15} />
                    {savingAction === "Assignment submission"
                      ? "Submitting"
                      : "Submit assignment"}
                  </button>
                </>
              ) : (
                <div className="platform-empty-state">
                  <strong>
                    {pendingSubmissions.length} pending submission(s)
                  </strong>
                  <span>
                    {selectedPendingSubmission
                      ? `${selectedPendingUser?.name ?? "Learner"} submitted ${selectedPendingAssignment?.title ?? selectedPendingSubmission.assignmentId}.`
                      : "Submitted work will appear here for teacher review."}
                  </span>
                </div>
              )}
            </>
          ) : (
            <div className="platform-empty-state">
              <strong>No assignment available</strong>
              <span>
                This learner has no assignment in the selected course run.
              </span>
            </div>
          )}
        </section>

        <section className="platform-workflow-card">
          <div className="platform-workflow-title">
            <span>
              <ListChecks size={16} /> Quiz attempt
            </span>
            <strong>{quiz?.title}</strong>
          </div>
          {quiz ? (
            <>
              <p>
                {selectedQuizCourse?.title ?? "Course"} · {quiz.durationMinutes}{" "}
                minute timer · {attemptsRemaining} attempt(s) remaining ·{" "}
                {quiz.questionTypes.join(", ")}.
              </p>
              <div className="platform-row-list compact">
                {quizOptions.slice(0, 4).map(item => (
                  <article
                    key={item.id}
                    className={item.id === quiz.id ? "selected" : ""}
                  >
                    <div>
                      <strong>{item.title}</strong>
                      <small>
                        {item.durationMinutes} minutes · {item.attemptsAllowed}{" "}
                        attempts
                      </small>
                    </div>
                  </article>
                ))}
              </div>
              {role === "student" ? (
                <div
                  className={`platform-assessment-feedback ${selectedQuizGrade ? "reviewed" : latestAttempt ? "pending" : "empty"}`}
                >
                  <div>
                    <span>
                      {selectedQuizGrade
                        ? "Reviewed quiz"
                        : latestAttempt
                          ? "Attempt submitted"
                          : "No attempt yet"}
                    </span>
                    <strong>
                      {selectedQuizGrade
                        ? `${selectedQuizGrade.score}/${selectedQuizGrade.maxScore}`
                        : latestAttempt
                          ? `${latestAttempt.score}/${latestAttempt.maxScore}`
                          : `${attemptsRemaining} attempt(s) remaining`}
                    </strong>
                    <p>
                      {selectedQuizGrade?.feedback ??
                        (latestAttempt
                          ? "Your attempt is saved. Teacher review feedback will appear here when returned."
                          : "Answer the questions and submit an attempt for review.")}
                    </p>
                  </div>
                  <dl>
                    <div>
                      <dt>Course</dt>
                      <dd>{selectedQuizCourse?.title ?? "Course"}</dd>
                    </div>
                    <div>
                      <dt>Status</dt>
                      <dd>
                        {selectedQuizGrade
                          ? "recorded"
                          : (latestAttempt?.status ?? "not started")}
                      </dd>
                    </div>
                    <div>
                      <dt>Submitted</dt>
                      <dd>
                        {latestAttempt?.submittedAt
                          ? formatDateTime(latestAttempt.submittedAt)
                          : "none"}
                      </dd>
                    </div>
                  </dl>
                </div>
              ) : null}
              {role === "student" && quizHasSafeQuestionPreview ? (
                <div className="platform-quiz-question-list">
                  {quizQuestionPreviews.map((question, index) => (
                    <article
                      key={question.id}
                      className="platform-quiz-question-card"
                    >
                      <div className="platform-quiz-question-head">
                        <span>Question {index + 1}</span>
                        <div>
                          <small>{question.type.replace(/_/g, " ")}</small>
                          <small>{question.difficulty}</small>
                        </div>
                      </div>
                      <strong>{question.prompt}</strong>
                      {question.tags.length ? (
                        <div className="platform-chip-row">
                          {question.tags.map(tag => (
                            <span key={tag}>{tag}</span>
                          ))}
                        </div>
                      ) : null}
                      {renderQuizQuestionInput(question)}
                    </article>
                  ))}
                </div>
              ) : role === "student" && quizHasAttachedQuestions ? (
                <div className="platform-empty-state">
                  <strong>No deliverable questions</strong>
                  <span>
                    This quiz has attached questions, but none are available for
                    your enrolled course right now.
                  </span>
                </div>
              ) : (
                <div className="platform-inline-form">
                  <label>
                    Short answer
                    <input
                      value={quizFallbackAnswer}
                      onChange={event =>
                        setQuizAnswers({ __fallback: event.target.value })
                      }
                    />
                  </label>
                </div>
              )}
              <button
                disabled={
                  role !== "student" ||
                  !quizHasAnswer ||
                  attemptsRemaining <= 0 ||
                  savingAction === "Quiz attempt"
                }
                onClick={role === "student" ? submitQuiz : undefined}
              >
                {role !== "student"
                  ? "Read only"
                  : attemptsRemaining <= 0
                    ? "Attempts used"
                    : savingAction === "Quiz attempt"
                      ? "Submitting"
                      : "Submit attempt"}
              </button>
            </>
          ) : (
            <div className="platform-empty-state">
              <strong>No quiz available</strong>
              <span>This learner has no quiz in the selected course run.</span>
            </div>
          )}
        </section>

        {editableAssessments ? (
          <section className="platform-workflow-card">
            <div className="platform-workflow-title">
              <span>
                <NotebookPen size={16} /> Assessment command
              </span>
              <strong>{selectedStaffRun?.term ?? "No course run"}</strong>
            </div>
            <div className="platform-inline-form">
              <label>
                Course run
                <select
                  value={selectedStaffRun?.id ?? ""}
                  onChange={event => setSelectedStaffRunId(event.target.value)}
                >
                  {staffRunOptions.map(run => {
                    const course = state.courses.find(
                      item => item.id === run.courseId
                    );
                    return (
                      <option key={run.id} value={run.id}>
                        {course?.title ?? run.courseId} · {run.term}
                      </option>
                    );
                  })}
                </select>
              </label>
            </div>
            <div className="platform-inline-form grid">
              <label>
                Assignment title
                <input
                  value={assignmentDraft.title}
                  onChange={event =>
                    setAssignmentDraft(value => ({
                      ...value,
                      title: event.target.value,
                    }))
                  }
                />
              </label>
              <label>
                Due date
                <input
                  type="date"
                  value={assignmentDraft.dueAt}
                  onChange={event =>
                    setAssignmentDraft(value => ({
                      ...value,
                      dueAt: event.target.value,
                    }))
                  }
                />
              </label>
              <label>
                Submission
                <select
                  value={assignmentDraft.submissionType}
                  onChange={event =>
                    setAssignmentDraft(value => ({
                      ...value,
                      submissionType: event.target.value as
                        | "text"
                        | "file"
                        | "audio"
                        | "video",
                    }))
                  }
                >
                  <option value="text">Text</option>
                  <option value="file">File</option>
                  <option value="audio">Audio</option>
                  <option value="video">Video</option>
                </select>
              </label>
              <label>
                Rubric
                <input
                  value={assignmentDraft.rubric}
                  onChange={event =>
                    setAssignmentDraft(value => ({
                      ...value,
                      rubric: event.target.value,
                    }))
                  }
                />
              </label>
              <button
                type="button"
                disabled={
                  !selectedStaffRun ||
                  !assignmentDraft.title.trim() ||
                  savingAction === "Assignment create"
                }
                onClick={createAssignment}
              >
                Create assignment
              </button>
            </div>
            <div className="platform-inline-form grid">
              <label>
                Quiz title
                <input
                  value={quizDraft.title}
                  onChange={event =>
                    setQuizDraft(value => ({
                      ...value,
                      title: event.target.value,
                    }))
                  }
                />
              </label>
              <label>
                Due date
                <input
                  type="date"
                  value={quizDraft.dueAt}
                  onChange={event =>
                    setQuizDraft(value => ({
                      ...value,
                      dueAt: event.target.value,
                    }))
                  }
                />
              </label>
              <label>
                Minutes
                <input
                  type="number"
                  min="5"
                  value={quizDraft.durationMinutes}
                  onChange={event =>
                    setQuizDraft(value => ({
                      ...value,
                      durationMinutes: Number(event.target.value),
                    }))
                  }
                />
              </label>
              <label>
                Attempts
                <input
                  type="number"
                  min="1"
                  value={quizDraft.attemptsAllowed}
                  onChange={event =>
                    setQuizDraft(value => ({
                      ...value,
                      attemptsAllowed: Number(event.target.value),
                    }))
                  }
                />
              </label>
              <label>
                Question types
                <input
                  value={quizDraft.questionTypes}
                  onChange={event =>
                    setQuizDraft(value => ({
                      ...value,
                      questionTypes: event.target.value,
                    }))
                  }
                />
              </label>
              <button
                type="button"
                disabled={
                  !selectedStaffRun ||
                  !quizDraft.title.trim() ||
                  savingAction === "Quiz create"
                }
                onClick={createQuiz}
              >
                Create quiz
              </button>
            </div>
          </section>
        ) : null}

        {editableAssessments ? (
          <section className="platform-workflow-card">
            <div className="platform-workflow-title">
              <span>
                <BookMarked size={16} /> Question bank
              </span>
              <strong>{selectedRunQuestions.length} item(s)</strong>
            </div>
            <p>
              Build reusable questions for assigned course runs. Students never
              receive answer keys or bank records.
            </p>
            <div className="platform-quiz-builder">
              <div className="platform-inline-form">
                <label>
                  Target quiz
                  <select
                    value={selectedAttachQuiz?.id ?? ""}
                    onChange={event =>
                      setSelectedAttachQuizId(event.target.value)
                    }
                  >
                    {selectedRunQuizzes.map(item => (
                      <option key={item.id} value={item.id}>
                        {item.title}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="platform-quiz-builder-summary">
                <span>Attached</span>
                <strong>{selectedAttachQuiz?.questionIds?.length ?? 0}</strong>
                <small>
                  {selectedAttachQuiz
                    ? `${selectedAttachQuiz.title} · ${selectedAttachQuiz.questionTypes.join(", ")}`
                    : "Create a quiz before attaching questions."}
                </small>
                <button
                  type="button"
                  disabled={
                    !selectedAttachQuiz ||
                    !selectedRunQuestions.length ||
                    savingAction === "Quiz question attach"
                  }
                  onClick={attachAllRunQuestions}
                >
                  Attach all
                </button>
              </div>
            </div>
            <div className="platform-inline-form grid">
              <label>
                Prompt
                <textarea
                  value={questionDraft.prompt}
                  onChange={event =>
                    setQuestionDraft(value => ({
                      ...value,
                      prompt: event.target.value,
                    }))
                  }
                />
              </label>
              <label>
                Type
                <select
                  value={questionDraft.questionType}
                  onChange={event =>
                    setQuestionDraft(value => ({
                      ...value,
                      questionType: event.target
                        .value as typeof questionDraft.questionType,
                    }))
                  }
                >
                  <option value="multiple_choice">Multiple choice</option>
                  <option value="true_false">True / false</option>
                  <option value="short_answer">Short answer</option>
                  <option value="essay">Essay</option>
                  <option value="oral_record">Oral record</option>
                  <option value="file_upload">File upload</option>
                </select>
              </label>
              <label>
                Difficulty
                <select
                  value={questionDraft.difficulty}
                  onChange={event =>
                    setQuestionDraft(value => ({
                      ...value,
                      difficulty: event.target
                        .value as typeof questionDraft.difficulty,
                    }))
                  }
                >
                  <option value="foundation">Foundation</option>
                  <option value="core">Core</option>
                  <option value="challenge">Challenge</option>
                </select>
              </label>
              <label>
                Tags
                <input
                  value={questionDraft.tags}
                  onChange={event =>
                    setQuestionDraft(value => ({
                      ...value,
                      tags: event.target.value,
                    }))
                  }
                />
              </label>
              <label>
                Choices
                <input
                  value={questionDraft.choices}
                  onChange={event =>
                    setQuestionDraft(value => ({
                      ...value,
                      choices: event.target.value,
                    }))
                  }
                  placeholder="Comma separated for MCQ"
                />
              </label>
              <label>
                Answer key
                <input
                  value={questionDraft.answerKey}
                  onChange={event =>
                    setQuestionDraft(value => ({
                      ...value,
                      answerKey: event.target.value,
                    }))
                  }
                />
              </label>
              <label>
                Rubric
                <input
                  value={questionDraft.rubric}
                  onChange={event =>
                    setQuestionDraft(value => ({
                      ...value,
                      rubric: event.target.value,
                    }))
                  }
                />
              </label>
              <button
                type="button"
                disabled={
                  !selectedStaffRun ||
                  !questionDraft.prompt.trim() ||
                  savingAction === "Question create"
                }
                onClick={createQuestion}
              >
                {savingAction === "Question create"
                  ? "Saving"
                  : "Save question"}
              </button>
            </div>
            <div className="platform-row-list compact">
              {selectedRunQuestions.length ? (
                selectedRunQuestions.slice(0, 8).map(question => (
                  <article
                    key={question.id}
                    className={`platform-question-row ${attachedQuestionIds.has(question.id) ? "selected" : ""}`}
                  >
                    <div>
                      <strong>{question.prompt}</strong>
                      <small>
                        {question.type.replaceAll("_", " ")} ·{" "}
                        {question.difficulty} · {question.tags.join(", ")}
                      </small>
                    </div>
                    {attachedQuestionIds.has(question.id) ? (
                      <span>attached</span>
                    ) : (
                      <button
                        type="button"
                        disabled={
                          !selectedAttachQuiz ||
                          savingAction === "Quiz question attach"
                        }
                        onClick={() => attachQuestionToQuiz(question.id)}
                      >
                        Attach
                      </button>
                    )}
                  </article>
                ))
              ) : (
                <article>
                  <div>
                    <strong>No questions in this run yet</strong>
                    <small>
                      Add the first reusable question for this course run.
                    </small>
                  </div>
                </article>
              )}
            </div>
          </section>
        ) : null}

        {editableAssessments ? (
          <section className="platform-workflow-card">
            <div className="platform-workflow-title">
              <span>
                <GraduationCap size={16} /> Manual review
              </span>
              <strong>
                {selectedPendingSubmission
                  ? "Ready to grade"
                  : "No pending work"}
              </strong>
            </div>
            {pendingSubmissions.length > 1 ? (
              <div className="platform-row-list compact">
                {pendingSubmissions.map(submission => {
                  const assignment = state.assignments.find(
                    item => item.id === submission.assignmentId
                  );
                  const student = state.students.find(
                    item => item.id === submission.studentId
                  );
                  const user = state.users.find(
                    item => item.id === student?.userId
                  );
                  return (
                    <article
                      key={submission.id}
                      className={
                        selectedPendingSubmission?.id === submission.id
                          ? "selected"
                          : ""
                      }
                    >
                      <div>
                        <strong>
                          {assignment?.title ?? submission.assignmentId}
                        </strong>
                        <small>
                          {user?.name ?? submission.studentId} ·{" "}
                          {submission.status}
                        </small>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedPendingSubmissionId(submission.id)
                        }
                      >
                        Review
                      </button>
                    </article>
                  );
                })}
              </div>
            ) : null}
            {selectedPendingSubmission ? (
              <>
                <p>
                  {selectedPendingUser?.name ?? "Learner"} ·{" "}
                  {selectedPendingAssignment?.title ??
                    selectedPendingSubmission.assignmentId}
                </p>
                <blockquote>{selectedPendingSubmission.response}</blockquote>
                <div className="platform-inline-form">
                  <label>
                    Score
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={gradeDraft.score}
                      onChange={event =>
                        setGradeDraft(value => ({
                          ...value,
                          score: Number(event.target.value),
                        }))
                      }
                    />
                  </label>
                  <label>
                    Feedback
                    <input
                      value={gradeDraft.feedback}
                      onChange={event =>
                        setGradeDraft(value => ({
                          ...value,
                          feedback: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <button
                    type="button"
                    disabled={savingAction === "Grade submission"}
                    onClick={gradeSubmission}
                  >
                    Grade submission
                  </button>
                </div>
              </>
            ) : (
              <div className="platform-empty-state">
                <strong>No pending submissions</strong>
                <span>
                  New learner submissions will appear here for manual feedback.
                </span>
              </div>
            )}
          </section>
        ) : null}

        {editableAssessments ? (
          <section className="platform-workflow-card">
            <div className="platform-workflow-title">
              <span>
                <ListChecks size={16} /> Quiz review
              </span>
              <strong>
                {selectedQuizAttempt ? "Needs review" : "No pending review"}
              </strong>
            </div>
            {selectedQuizAttempt ? (
              <>
                {reviewableQuizAttempts.length > 1 ? (
                  <div className="platform-row-list compact">
                    {reviewableQuizAttempts.map(attempt => {
                      const attemptQuiz = state.quizzes.find(
                        item => item.id === attempt.quizId
                      );
                      const student = state.students.find(
                        item => item.id === attempt.studentId
                      );
                      const user = state.users.find(
                        item => item.id === student?.userId
                      );
                      return (
                        <article
                          key={attempt.id}
                          className={
                            selectedQuizAttempt?.id === attempt.id
                              ? "selected"
                              : ""
                          }
                        >
                          <div>
                            <strong>
                              {attemptQuiz?.title ?? attempt.quizId}
                            </strong>
                            <small>
                              {user?.name ?? attempt.studentId} · needs review ·{" "}
                              {attempt.score}/{attempt.maxScore}
                            </small>
                          </div>
                          <button
                            type="button"
                            onClick={() => setSelectedQuizAttemptId(attempt.id)}
                          >
                            Review
                          </button>
                        </article>
                      );
                    })}
                  </div>
                ) : null}
                <p>
                  {selectedReviewUser?.name ?? "Learner"} ·{" "}
                  {selectedReviewQuiz?.title ?? selectedQuizAttempt.quizId} ·{" "}
                  Current score {selectedQuizAttempt.score}/
                  {selectedQuizAttempt.maxScore}
                </p>
                <div className="platform-quiz-review-list">
                  {Object.entries(selectedQuizAttempt.answers).map(
                    ([questionId, answer]) => {
                      const question = selectedReviewQuestions.find(
                        item => item?.id === questionId
                      );
                      return (
                        <article key={questionId}>
                          <span>
                            {question?.type?.replace(/_/g, " ") ?? "response"}
                          </span>
                          <strong>{question?.prompt ?? questionId}</strong>
                          <p>{answer}</p>
                        </article>
                      );
                    }
                  )}
                </div>
                <div className="platform-inline-form">
                  <label>
                    Score
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={quizReviewDraft.score}
                      onChange={event =>
                        setQuizReviewDraft(value => ({
                          ...value,
                          score: Number(event.target.value),
                        }))
                      }
                    />
                  </label>
                  <label>
                    Feedback
                    <input
                      value={quizReviewDraft.feedback}
                      onChange={event =>
                        setQuizReviewDraft(value => ({
                          ...value,
                          feedback: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <button
                    type="button"
                    disabled={savingAction === "Quiz review"}
                    onClick={reviewQuizAttempt}
                  >
                    {savingAction === "Quiz review"
                      ? "Saving review"
                      : "Save quiz review"}
                  </button>
                </div>
              </>
            ) : (
              <div className="platform-empty-state">
                <strong>No pending quiz review</strong>
                <span>
                  Manual quiz attempts from scoped learners will appear here for
                  feedback.
                </span>
              </div>
            )}
            {reviewedQuizAttempts.length ? (
              <div className="platform-row-list compact">
                {reviewedQuizAttempts.map(attempt => {
                  const attemptQuiz = state.quizzes.find(
                    item => item.id === attempt.quizId
                  );
                  const student = state.students.find(
                    item => item.id === attempt.studentId
                  );
                  const user = state.users.find(
                    item => item.id === student?.userId
                  );
                  return (
                    <article key={attempt.id}>
                      <div>
                        <strong>{attemptQuiz?.title ?? attempt.quizId}</strong>
                        <small>
                          {user?.name ?? attempt.studentId} · reviewed ·{" "}
                          {attempt.score}/{attempt.maxScore}
                        </small>
                      </div>
                      <span className="platform-status completed">
                        Reviewed
                      </span>
                    </article>
                  );
                })}
              </div>
            ) : null}
          </section>
        ) : null}
      </div>
      <aside className="platform-workflow-side">
        <MiniMetric
          label="Latest submission"
          value={latestSubmission?.status ?? "none"}
        />
        <MiniMetric
          label="Latest quiz score"
          value={
            latestAttempt
              ? `${latestAttempt.score}/${latestAttempt.maxScore}`
              : "none"
          }
        />
        <MiniMetric
          label="Pending review"
          value={String(
            pendingSubmissions.length + reviewableQuizAttempts.length
          )}
        />
        <MiniMetric
          label="Bank questions"
          value={String(questionBankItems.length)}
        />
        <MiniMetric label="Grade items" value={String(state.grades.length)} />
        <div className="platform-row-list compact">
          {recentAssessmentAudits.length ? (
            recentAssessmentAudits.map(audit => (
              <article key={audit.id}>
                <div>
                  <strong>{audit.action}</strong>
                  <small>{audit.summary}</small>
                </div>
              </article>
            ))
          ) : (
            <article>
              <div>
                <strong>No assessment audit yet</strong>
                <small>
                  Submissions, attempts, and grading will appear here.
                </small>
              </div>
            </article>
          )}
        </div>
        <WorkflowAudit state={state} />
      </aside>
    </div>
  );
}

function StudentAttendanceWorkflow({
  state,
  refresh,
  backendSyncStatus = "offline",
}: WorkflowProps) {
  const scope = getStudentScope(state);
  const [reviewingRecordId, setReviewingRecordId] = useState("");
  const [reviewError, setReviewError] = useState("");
  const now = Date.now();
  const records = state.attendance
    .filter(
      record =>
        record.studentId === scope.studentId &&
        scope.classIds.has(record.classGroupId)
    )
    .sort((a, b) => {
      const sessionA = state.classSessions.find(
        item => item.id === a.sessionId || item.eventId === a.sessionId
      );
      const sessionB = state.classSessions.find(
        item => item.id === b.sessionId || item.eventId === b.sessionId
      );
      return (
        new Date(sessionB?.startsAt ?? 0).getTime() -
        new Date(sessionA?.startsAt ?? 0).getTime()
      );
    });
  const upcomingSessions = state.classSessions
    .filter(
      session =>
        scope.classIds.has(session.classGroupId) &&
        new Date(session.startsAt).getTime() >= now
    )
    .sort(
      (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()
    )
    .slice(0, 6);
  const latestSessions = state.classSessions
    .filter(session => scope.classIds.has(session.classGroupId))
    .sort(
      (a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime()
    )
    .slice(0, 6);
  const sessionRows = upcomingSessions.length
    ? upcomingSessions
    : latestSessions;
  const computedAttendance = records.length
    ? Math.round(
        (records.filter(record => record.status !== "absent").length /
          records.length) *
          100
      )
    : null;
  const averageAttendance =
    computedAttendance ??
    (scope.enrollments.length
      ? Math.round(
          scope.enrollments.reduce(
            (sum, enrollment) => sum + enrollment.attendanceRate,
            0
          ) / scope.enrollments.length
        )
      : 0);
  const exceptionCount = records.filter(
    record => record.status !== "present"
  ).length;
  const reviewRecipientForRecord = (
    record?: PlatformStateSnapshot["attendance"][number]
  ) => {
    const group = record
      ? state.classGroups.find(item => item.id === record.classGroupId)
      : scope.classGroups[0];
    const run = state.courseRuns.find(item => item.id === group?.courseRunId);
    return run?.teacherId ?? scope.courses[0]?.run.teacherId;
  };
  const requestAttendanceReview = async (
    record?: PlatformStateSnapshot["attendance"][number]
  ) => {
    const teacherUserId = reviewRecipientForRecord(record);
    if (!teacherUserId || backendSyncStatus === "loading") {
      const message =
        backendSyncStatus === "loading"
          ? "Attendance is still syncing. Try again after the page finishes loading."
          : "No teacher is linked to this attendance record.";
      setReviewError(message);
      toast.error("Attendance review unavailable", { description: message });
      return;
    }

    const session = record
      ? state.classSessions.find(
          item =>
            item.id === record.sessionId || item.eventId === record.sessionId
        )
      : undefined;
    const group = record
      ? state.classGroups.find(item => item.id === record.classGroupId)
      : scope.classGroups[0];
    const requestId = record?.id ?? "general";
    setReviewingRecordId(requestId);
    setReviewError("");
    const result = await runPlatformWorkflowActionRequest({
      type: "message.send",
      toUserId: teacherUserId,
      subject: "Attendance review request",
      body: `Please review ${session?.title ?? group?.name ?? "my attendance record"} for ${scope.user?.name ?? "this learner"}. Current status: ${record ? attendanceStatusLabels[record.status] : "not recorded"}.`,
      channel: "in_app",
    });
    setReviewingRecordId("");

    if (!result.ok || !result.data) {
      const message = result.error ?? "Attendance review request failed.";
      setReviewError(message);
      toast.error("Attendance review failed", { description: message });
      return;
    }

    platformStore.setState(result.data.state);
    refresh();
    toast.success("Attendance review requested", {
      description: "A message was sent to the class teacher.",
    });
  };

  return (
    <div className="platform-workflow-layout">
      <div className="platform-workflow-main">
        <section className="platform-workflow-card platform-attendance-workspace">
          <div className="platform-workflow-title">
            <span>
              <SlidersHorizontal size={16} /> Attendance record
            </span>
            <strong>{averageAttendance}% attendance</strong>
          </div>
          <div className="platform-attendance-context">
            <span>{scope.user?.name ?? "Student"}</span>
            <span>{scope.classGroups.length} class(es)</span>
            <span>{records.length} saved record(s)</span>
            <span>
              {backendSyncStatus === "loading" ? "Syncing" : "Read only"}
            </span>
          </div>
          <div className="platform-row-list">
            {records.length ? (
              records.map(record => {
                const session = state.classSessions.find(
                  item =>
                    item.id === record.sessionId ||
                    item.eventId === record.sessionId
                );
                const group = state.classGroups.find(
                  item => item.id === record.classGroupId
                );
                return (
                  <article key={record.id}>
                    <div>
                      <strong>
                        {session?.title ?? group?.name ?? "Class session"}
                      </strong>
                      <small>
                        {group?.name ?? "Class"} ·{" "}
                        {formatDateTime(session?.startsAt)}
                      </small>
                    </div>
                    <div className="platform-row-actions">
                      <span
                        className={`platform-attendance-chip ${record.status}`}
                      >
                        {attendanceStatusLabels[record.status]}
                      </span>
                      <button
                        type="button"
                        disabled={
                          backendSyncStatus === "loading" ||
                          reviewingRecordId === record.id
                        }
                        onClick={() => requestAttendanceReview(record)}
                      >
                        <MessageSquare size={14} />
                        {reviewingRecordId === record.id
                          ? "Sending"
                          : "Request review"}
                      </button>
                    </div>
                  </article>
                );
              })
            ) : (
              <div className="platform-empty-state">
                <strong>No attendance saved yet</strong>
                <span>
                  Your classes are active, but no teacher attendance rows are
                  saved.
                </span>
                <button
                  type="button"
                  disabled={
                    backendSyncStatus === "loading" ||
                    reviewingRecordId === "general"
                  }
                  onClick={() => requestAttendanceReview()}
                >
                  <MessageSquare size={14} />
                  {reviewingRecordId === "general"
                    ? "Sending"
                    : "Request review"}
                </button>
              </div>
            )}
          </div>
          {reviewError ? (
            <p className="platform-attendance-error">{reviewError}</p>
          ) : null}
        </section>
        <section className="platform-workflow-card">
          <div className="platform-workflow-title">
            <span>
              <Clock3 size={16} /> Sessions
            </span>
            <strong>
              {upcomingSessions.length
                ? `${upcomingSessions.length} upcoming`
                : `${latestSessions.length} latest`}
            </strong>
          </div>
          <div className="platform-row-list compact">
            {sessionRows.length ? (
              sessionRows.map(session => {
                const group = state.classGroups.find(
                  item => item.id === session.classGroupId
                );
                const sessionSaved = isAttendanceSessionSaved(state, session);
                return (
                  <article key={session.id}>
                    <div>
                      <strong>{session.title}</strong>
                      <small>
                        {group?.name ?? "Class"} ·{" "}
                        {formatDateTime(session.startsAt)}
                      </small>
                    </div>
                    <span
                      className={`platform-attendance-chip ${sessionSaved ? "saved" : "pending"}`}
                    >
                      {sessionSaved ? "Saved" : "Pending"}
                    </span>
                  </article>
                );
              })
            ) : (
              <article>
                <div>
                  <strong>No class sessions</strong>
                  <small>
                    New class sessions will appear here after scheduling.
                  </small>
                </div>
              </article>
            )}
          </div>
        </section>
      </div>
      <aside className="platform-workflow-side">
        <MiniMetric label="Attendance" value={`${averageAttendance}%`} />
        <MiniMetric label="Recorded sessions" value={String(records.length)} />
        <MiniMetric label="Exceptions" value={String(exceptionCount)} />
        <MiniMetric label="Classes" value={String(scope.classGroups.length)} />
      </aside>
    </div>
  );
}

function StudentCalendarWorkflow({
  role,
  state,
  backendSyncStatus = "offline",
}: WorkflowProps) {
  const [viewMode, setViewMode] = useState<"day" | "week" | "month">("week");
  const scope = getStudentScope(state);
  const now = Date.now();
  const classEvents: ScheduleBoardEvent[] = state.events.filter(
    event => event.classGroupId && scope.classIds.has(event.classGroupId)
  );
  const assignmentEvents = state.assignments
    .filter(assignment => scope.runIds.has(assignment.courseRunId))
    .map(assignment => ({
      id: assignment.id,
      title: assignment.title,
      startsAt: assignment.dueAt,
      type: "assignment_due" as const,
      status: assignment.status,
    }));
  const quizEvents = state.quizzes
    .filter(quiz => scope.runIds.has(quiz.courseRunId))
    .map(quiz => ({
      id: quiz.id,
      title: quiz.title,
      startsAt: quiz.dueAt || "",
      type: "quiz_due" as const,
      status: quiz.status,
    }));
  const timelineItems: ScheduleBoardEvent[] = [
    ...classEvents,
    ...assignmentEvents,
    ...quizEvents,
  ].sort(
    (a, b) =>
      new Date(a.startsAt || "2999-01-01").getTime() -
      new Date(b.startsAt || "2999-01-01").getTime()
  );
  const upcomingTimeline = timelineItems.filter(
    item => item.startsAt && new Date(item.startsAt).getTime() >= now
  );
  const recentTimeline = timelineItems
    .filter(item => !item.startsAt || new Date(item.startsAt).getTime() < now)
    .sort(
      (a, b) =>
        new Date(b.startsAt || "1900-01-01").getTime() -
        new Date(a.startsAt || "1900-01-01").getTime()
    )
    .slice(0, 5);
  const timeline = upcomingTimeline
    .sort(
      (a, b) =>
        new Date(a.startsAt || "2999-01-01").getTime() -
        new Date(b.startsAt || "2999-01-01").getTime()
    )
    .slice(0, viewMode === "day" ? 4 : viewMode === "week" ? 8 : 12);

  return (
    <div className="platform-workflow-layout">
      <div className="platform-workflow-main">
        <section className="platform-workflow-card">
          <div className="platform-workflow-title">
            <span>
              <CalendarDays size={16} /> Learner calendar
            </span>
            <strong>Classes, due dates, reminders</strong>
          </div>
          <div className="platform-workflow-title compact">
            <span>Upcoming events</span>
            <strong>{timeline.length}</strong>
          </div>
          {backendSyncStatus === "loading" ? (
            <div className="platform-empty-state">
              <strong>Syncing learner calendar</strong>
              <span>Loading scoped classes, due dates, and reminders.</span>
            </div>
          ) : null}
          <ScheduleBoard
            state={state}
            events={timeline}
            limit={viewMode === "day" ? 4 : viewMode === "week" ? 8 : 12}
            emptyText="No future classes or due dates are scheduled for this learner."
          />
          <div
            className="platform-segmented"
            aria-label="Student calendar view"
          >
            {(["day", "week", "month"] as const).map(mode => (
              <button
                key={mode}
                className={viewMode === mode ? "active" : ""}
                onClick={() => setViewMode(mode)}
              >
                {mode}
              </button>
            ))}
          </div>
          <div className="platform-row-list">
            {timeline.length ? (
              timeline.map(event => (
                <article key={`${event.type}_${event.id}`}>
                  <div>
                    <strong>{event.title}</strong>
                    <small>
                      {event.type.replace("_", " ")} ·{" "}
                      {formatDateTime(event.startsAt)}
                    </small>
                  </div>
                  <div className="platform-row-actions">
                    <span>{event.status}</span>
                    <button
                      type="button"
                      onClick={() =>
                        toast.info(
                          event.type === "live_session"
                            ? "Open the live class page to join."
                            : "Reminder saved in this learner view."
                        )
                      }
                    >
                      {event.type === "live_session"
                        ? "Open live"
                        : "Remind me"}
                    </button>
                  </div>
                </article>
              ))
            ) : (
              <div className="platform-empty-state">
                <strong>No upcoming items</strong>
                <span>
                  Recent and unscheduled course items remain visible below.
                </span>
              </div>
            )}
          </div>
          <div className="platform-workflow-title compact">
            <span>Recent or unscheduled</span>
            <strong>{recentTimeline.length}</strong>
          </div>
          <div className="platform-row-list compact">
            {recentTimeline.length ? (
              recentTimeline.map(event => (
                <article key={`recent_${event.type}_${event.id}`}>
                  <div>
                    <strong>{event.title}</strong>
                    <small>
                      {schedulerTypeLabels[event.type as CalendarEventType] ??
                        event.type}{" "}
                      · {formatDateTime(event.startsAt)}
                    </small>
                  </div>
                  <span>{event.status ?? "scheduled"}</span>
                </article>
              ))
            ) : (
              <article>
                <div>
                  <strong>No recent items</strong>
                  <small>
                    Past classes and unscheduled assessments will appear here.
                  </small>
                </div>
                <span>empty</span>
              </article>
            )}
          </div>
        </section>
      </div>
      <aside className="platform-workflow-side">
        <MiniMetric label="Class events" value={String(classEvents.length)} />
        <MiniMetric
          label="Assignments"
          value={String(assignmentEvents.length)}
        />
        <MiniMetric label="Quizzes" value={String(quizEvents.length)} />
        <MiniMetric label="View" value={viewMode} />
      </aside>
    </div>
  );
}

function StudentCertificateWorkflow({
  role,
  state,
  backendSyncStatus,
}: WorkflowProps) {
  if (backendSyncStatus === "loading") {
    return <WorkflowLoadingCard label="Certificate wallet" />;
  }

  const scope = getStudentScope(state);
  const certificates = state.certificates.filter(
    certificate => certificate.studentId === scope.studentId
  );
  const [selectedId, setSelectedId] = useState(certificates[0]?.id ?? "");
  const selected =
    certificates.find(certificate => certificate.id === selectedId) ??
    certificates[0];
  const selectedCourse = state.courses.find(
    course => course.id === selected?.courseId
  );
  const selectedDocument = state.documents.find(
    document =>
      selected &&
      document.ownerId === selected.studentId &&
      document.type === "certificate" &&
      (document.url === `#certificate-${selected.id}` ||
        document.title.includes(selected.verificationCode))
  );
  const selectedIssued = selected?.status === "issued";
  const [verificationCode, setVerificationCode] = useState(
    selected?.status === "issued" ? selected.verificationCode : ""
  );
  const verification = platformStore.verifyCertificate(verificationCode);

  return (
    <div className="platform-workflow-layout">
      <div className="platform-workflow-main">
        <section className="platform-workflow-card">
          <div className="platform-workflow-title">
            <span>
              <Award size={16} /> Certificate wallet
            </span>
            <strong>{certificates.length} certificate(s)</strong>
          </div>
          <div className="platform-row-list">
            {certificates.length ? (
              certificates.map(certificate => {
                const course = state.courses.find(
                  item => item.id === certificate.courseId
                );
                return (
                  <article
                    key={certificate.id}
                    className={
                      selected?.id === certificate.id ? "selected" : ""
                    }
                  >
                    <div>
                      <strong>{course?.title ?? "Course certificate"}</strong>
                      <small>
                        Grade {certificate.grade}% · Attendance{" "}
                        {certificate.attendanceRate}% ·{" "}
                        {certificateStatusLabels[certificate.status]}
                      </small>
                    </div>
                    <div className="platform-row-actions">
                      <span
                        className={`platform-certificate-status ${certificate.status}`}
                      >
                        {certificateStatusLabels[certificate.status]}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedId(certificate.id);
                          setVerificationCode(
                            certificate.status === "issued"
                              ? certificate.verificationCode
                              : ""
                          );
                        }}
                      >
                        Preview
                      </button>
                    </div>
                  </article>
                );
              })
            ) : (
              <div className="platform-empty-state">
                <strong>No certificates yet</strong>
                <span>
                  Complete grade and attendance requirements to unlock
                  certificates.
                </span>
              </div>
            )}
          </div>
        </section>
        {selected ? (
          <CertificatePreview
            certificate={selected}
            studentName={scope.user?.name ?? "Student"}
            courseTitle={selectedCourse?.title ?? "Course"}
            documentStatus={selectedDocument?.status}
            revealCode={selectedIssued}
            context="student"
          />
        ) : null}
      </div>
      <aside className="platform-workflow-side">
        <MiniMetric
          label="Issued"
          value={String(
            certificates.filter(item => item.status === "issued").length
          )}
        />
        <MiniMetric
          label="Eligible"
          value={String(
            certificates.filter(
              item => item.grade >= 80 && item.attendanceRate >= 80
            ).length
          )}
        />
        <MiniMetric
          label="Documents"
          value={String(
            state.documents.filter(
              item =>
                item.type === "certificate" &&
                certificates.some(
                  certificate => certificate.studentId === item.ownerId
                )
            ).length
          )}
        />
        <CertificateVerifyPanel
          title="Student lookup"
          label="Verification code"
          value={verificationCode}
          onChange={setVerificationCode}
          disabled={!selectedIssued}
          verification={verification}
        />
      </aside>
    </div>
  );
}

function QuranProgressSummary({
  role,
  progress,
  plan,
  recitationCount,
}: {
  role: Role;
  progress?: QuranProgressRecord;
  plan?: { target: string; currentJuz: string; revisionCycle: string };
  recitationCount: number;
}) {
  const bars = [
    { label: "Memory", value: progress?.memorizedPercent ?? 0 },
    { label: "Tajweed", value: progress?.tajweedScore ?? 0 },
    { label: "Reviews", value: Math.min(100, recitationCount * 18) },
  ];

  return (
    <div className="platform-quran-summary">
      <div>
        <span>Plan</span>
        <strong>{plan?.target ?? progress?.surah ?? "No plan"}</strong>
        <small>
          {plan?.currentJuz ?? progress?.juz ?? "-"} ·{" "}
          {plan?.revisionCycle ?? "revision pending"}
        </small>
      </div>
      <div className="platform-chart-bars">
        {bars.map((bar, index) => (
          <div key={bar.label}>
            <span
              style={{
                height: `${Math.min(96, Math.max(18, bar.value))}%`,
                background:
                  index % 2 ? roleMeta[role].accent : roleMeta[role].color,
              }}
            />
            <small>{bar.label}</small>
          </div>
        ))}
      </div>
    </div>
  );
}

function RecitationWaveformPlaceholder({
  role,
  label,
  status,
}: {
  role: Role;
  label: string;
  status?: string;
}) {
  const waveform = [34, 62, 45, 78, 52, 88, 41, 64, 36, 70, 58, 46];
  return (
    <div className="platform-recitation-audio">
      <div className="platform-waveform" aria-label={label}>
        {waveform.map((height, index) => (
          <span
            key={index}
            style={{
              height: `${height}%`,
              background: roleMeta[role].color,
            }}
          />
        ))}
      </div>
      <small>
        {status
          ? `Audio storage pending · ${status}`
          : "Audio upload and playback will connect when storage is configured."}
      </small>
    </div>
  );
}

function StudentQuranWorkflow({ role, state, refresh }: WorkflowProps) {
  const scope = getStudentScope(state);
  const plan = state.quranPlans.find(
    item => item.studentId === scope.studentId
  );
  const progress = state.quranProgress.find(
    item => item.studentId === scope.studentId
  );
  const submissions = state.recitationSubmissions.filter(
    item => item.studentId === scope.studentId
  );
  const [title, setTitle] = useState(
    progress
      ? `${progress.surah} ${progress.juz} recitation`
      : "Daily recitation"
  );
  const [saving, setSaving] = useState(false);
  const [workflowError, setWorkflowError] = useState("");
  const [workflowMessage, setWorkflowMessage] = useState("");
  const canSubmit = Boolean(plan && title.trim() && !saving);

  const submitRecitation = async () => {
    if (!plan || !title.trim()) return;
    setSaving(true);
    setWorkflowError("");
    setWorkflowMessage("");
    const result = await runPlatformWorkflowActionRequest({
      type: "recitation.submit",
      studentId: scope.studentId,
      teacherId: plan.teacherId,
      title: title.trim(),
    });
    setSaving(false);
    if (!result.ok || !result.data) {
      const message = result.error ?? "Recitation could not be submitted.";
      setWorkflowError(message);
      toast.error("Recitation not submitted", { description: message });
      return;
    }
    platformStore.setState(result.data.state);
    refresh();
    setWorkflowMessage(
      `Submitted to your Quran teacher · ${result.data.persistence}`
    );
    toast.success("Recitation submitted", {
      description: result.data.persistence,
    });
  };

  return (
    <div className="platform-workflow-layout">
      <div className="platform-workflow-main">
        <section className="platform-workflow-card">
          <div className="platform-workflow-title">
            <span>
              <Headphones size={16} /> Quran learner progress
            </span>
            <strong>
              {progress?.surah ?? plan?.target ?? "Memorization plan"}
            </strong>
          </div>
          <p>
            {plan?.target ?? "Teacher plan"} · Current Juz{" "}
            {plan?.currentJuz ?? progress?.juz ?? "-"} · revision{" "}
            {plan?.revisionCycle ?? "daily"}
          </p>
          {plan || progress ? (
            <>
              <QuranProgressSummary
                role={role}
                progress={progress}
                plan={plan}
                recitationCount={submissions.length}
              />
              <RecitationWaveformPlaceholder
                role={role}
                label="Recitation practice visual"
              />
            </>
          ) : (
            <div className="platform-empty-state">
              <strong>No Quran plan assigned</strong>
              <span>
                Your teacher will assign a memorization and revision plan before
                recitation submission opens.
              </span>
            </div>
          )}
          <div className="platform-inline-form">
            <label>
              Recitation title
              <input
                value={title}
                onChange={event => setTitle(event.target.value)}
              />
            </label>
            <button
              className="platform-primary-button"
              style={{ background: roleMeta[role].color }}
              disabled={!canSubmit}
              onClick={submitRecitation}
            >
              <Send size={15} />
              {saving ? "Submitting" : "Submit recitation"}
            </button>
          </div>
          {workflowMessage ? (
            <p className="platform-scheduler-feedback success">
              {workflowMessage}
            </p>
          ) : null}
          {workflowError ? (
            <p className="platform-attendance-error">{workflowError}</p>
          ) : null}
        </section>
        <section className="platform-workflow-card">
          <div className="platform-workflow-title">
            <span>
              <BookMarked size={16} /> Submission history
            </span>
            <strong>{submissions.length} submissions</strong>
          </div>
          <div className="platform-row-list compact">
            {submissions.length ? (
              submissions.map(submission => (
                <article key={submission.id}>
                  <div>
                    <strong>{submission.title}</strong>
                    <small>
                      {formatDateTime(submission.submittedAt)}
                      {submission.feedback ? ` · ${submission.feedback}` : ""}
                    </small>
                  </div>
                  <span className={`platform-status ${submission.status}`}>
                    {submission.status}
                  </span>
                </article>
              ))
            ) : (
              <article>
                <div>
                  <strong>No recitations submitted</strong>
                  <small>
                    Submit your next assigned recitation when your plan is
                    ready.
                  </small>
                </div>
              </article>
            )}
          </div>
        </section>
      </div>
      <aside className="platform-workflow-side">
        <MiniMetric
          label="Memorized"
          value={`${progress?.memorizedPercent ?? 0}%`}
        />
        <MiniMetric label="Tajweed" value={`${progress?.tajweedScore ?? 0}%`} />
        <MiniMetric label="Current Juz" value={plan?.currentJuz ?? "-"} />
      </aside>
    </div>
  );
}

function StudentMessageWorkflow({ role, state, refresh }: WorkflowProps) {
  const scope = getStudentScope(state);
  const teacherIds = Array.from(
    new Set(scope.courses.map(({ run }) => run.teacherId).filter(Boolean))
  );
  const recipients = state.users.filter(
    user =>
      teacherIds.includes(user.id) ||
      user.activeRole === "registrar" ||
      user.activeRole === "branchadmin"
  );
  const [toUserId, setToUserId] = useState(
    recipients[0]?.id ?? getDemoUser("teacher").id
  );
  const [subject, setSubject] = useState("Question about my lesson");
  const [body, setBody] = useState(
    "Please review my question before the next class."
  );
  const messages = state.messages.filter(
    message =>
      message.fromUserId === scope.userId || message.toUserId === scope.userId
  );

  return (
    <div className="platform-workflow-layout">
      <div className="platform-workflow-main">
        <section className="platform-workflow-card">
          <div className="platform-workflow-title">
            <span>
              <MessageSquare size={16} /> Student messages
            </span>
            <strong>Teacher and support inbox</strong>
          </div>
          <div className="platform-inline-form grid">
            <label>
              Recipient
              <select
                value={toUserId}
                onChange={event => setToUserId(event.target.value)}
              >
                {recipients.map(user => (
                  <option key={user.id} value={user.id}>
                    {user.name} · {roleMeta[user.activeRole].label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Subject
              <input
                value={subject}
                onChange={event => setSubject(event.target.value)}
              />
            </label>
          </div>
          <textarea
            value={body}
            onChange={event => setBody(event.target.value)}
          />
          <button
            className="platform-primary-button"
            style={{ background: roleMeta[role].color }}
            disabled={!subject.trim() || !body.trim() || !toUserId}
            onClick={() => {
              platformStore.sendMessage({
                fromUserId: scope.userId,
                toUserId,
                subject,
                body,
              });
              refresh();
              toast.success("Message sent");
            }}
          >
            <Send size={15} />
            Send message
          </button>
        </section>
        <section className="platform-workflow-card">
          <div className="platform-workflow-title">
            <span>
              <MessageSquare size={16} /> Conversation history
            </span>
            <strong>{messages.length} messages</strong>
          </div>
          <div className="platform-row-list">
            {messages.length ? (
              messages.map(message => {
                const from = state.users.find(
                  user => user.id === message.fromUserId
                );
                const to = state.users.find(
                  user => user.id === message.toUserId
                );
                return (
                  <article key={message.id}>
                    <div>
                      <strong>{message.subject}</strong>
                      <small>
                        {from?.name ?? "Student"} to {to?.name ?? "Team"} ·{" "}
                        {formatDateTime(message.createdAt)}
                      </small>
                    </div>
                    <span>{message.read ? "read" : "unread"}</span>
                  </article>
                );
              })
            ) : (
              <div className="platform-empty-state">
                <strong>No messages yet</strong>
                <span>
                  Send your teacher or support team a message when you need
                  help.
                </span>
              </div>
            )}
          </div>
        </section>
      </div>
      <aside className="platform-workflow-side">
        <MiniMetric label="Inbox" value={String(messages.length)} />
        <MiniMetric label="Teachers" value={String(teacherIds.length)} />
        <MiniMetric
          label="Unread"
          value={String(messages.filter(message => !message.read).length)}
        />
      </aside>
    </div>
  );
}

function StudentReportsWorkflow({
  role,
  state,
  pageId,
}: Omit<WorkflowProps, "refresh"> & { pageId: string }) {
  const scope = getStudentScope(state);
  const grades = state.grades.filter(
    grade => grade.studentId === scope.studentId
  );
  const submissions = state.assignmentSubmissions.filter(
    item => item.studentId === scope.studentId
  );
  const attempts = state.quizAttempts.filter(
    item => item.studentId === scope.studentId
  );
  const feedbackItems = grades
    .map(grade => {
      const quiz = state.quizzes.find(item => item.id === grade.itemId);
      const assignment = state.assignments.find(
        item => item.id === grade.itemId
      );
      const attempt = quiz
        ? attempts.find(item => item.quizId === quiz.id)
        : undefined;
      const submission = assignment
        ? submissions.find(item => item.assignmentId === assignment.id)
        : undefined;
      const course = state.courseRuns.find(run => run.id === grade.courseRunId);
      const courseTitle = state.courses.find(
        item => item.id === course?.courseId
      )?.title;
      return {
        grade,
        quiz,
        assignment,
        attempt,
        submission,
        courseTitle,
        percent: grade.maxScore
          ? Math.round((grade.score / grade.maxScore) * 100)
          : grade.score,
        reviewedAt: attempt?.submittedAt ?? submission?.submittedAt ?? "",
      };
    })
    .sort((a, b) => {
      const aTime = Date.parse(a.reviewedAt);
      const bTime = Date.parse(b.reviewedAt);
      return (
        (Number.isFinite(bTime) ? bTime : 0) -
        (Number.isFinite(aTime) ? aTime : 0)
      );
    });
  const latestFeedback = feedbackItems[0];
  const rows = [
    ...scope.courses.map(({ enrollment, course }) => ({
      type: "course",
      title: course.title,
      progress: `${enrollment.progress}%`,
      score: `${enrollment.currentGrade}%`,
      status: enrollment.status,
    })),
    ...grades.map(grade => ({
      type: "grade",
      title: grade.itemTitle,
      progress: grade.feedback,
      score: `${grade.score}/${grade.maxScore}`,
      status: "recorded",
    })),
    ...submissions.map(submission => ({
      type: "assignment",
      title:
        state.assignments.find(
          assignment => assignment.id === submission.assignmentId
        )?.title ?? submission.assignmentId,
      progress: formatDateTime(submission.submittedAt),
      score: submission.score ? `${submission.score}%` : "pending",
      status: submission.status,
    })),
    ...attempts.map(attempt => ({
      type: "quiz",
      title:
        state.quizzes.find(quiz => quiz.id === attempt.quizId)?.title ??
        attempt.quizId,
      progress: formatDateTime(attempt.submittedAt),
      score: `${attempt.score}/${attempt.maxScore}`,
      status: attempt.status,
    })),
  ];
  const exportCsv = () => {
    const csv = platformStore.buildCsv(rows);
    if (!csv) {
      toast.info("No student rows to export");
      return;
    }
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `nile-student-${pageId}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    toast.success("Student CSV exported", {
      description: `${rows.length} row(s)`,
    });
  };

  return (
    <div className="platform-workflow-layout">
      <div className="platform-workflow-main">
        <section className="platform-workflow-card">
          <div className="platform-workflow-title">
            <span>
              <Activity size={16} /> Student report
            </span>
            <strong>
              {pageId === "grades" ? "Gradebook" : "Progress report"}
            </strong>
          </div>
          <div className="platform-report-controls">
            <button onClick={exportCsv}>
              <Download size={15} />
              Export my CSV
            </button>
          </div>
          {latestFeedback ? (
            <div className="platform-student-feedback-panel">
              <div>
                <span>Latest teacher feedback</span>
                <strong>{latestFeedback.grade.itemTitle}</strong>
                <p>{latestFeedback.grade.feedback}</p>
              </div>
              <dl>
                <div>
                  <dt>Score</dt>
                  <dd>
                    {latestFeedback.grade.score}/{latestFeedback.grade.maxScore}
                  </dd>
                </div>
                <div>
                  <dt>Result</dt>
                  <dd>
                    {latestFeedback.percent >= 80
                      ? "Strong"
                      : latestFeedback.percent >= 70
                        ? "Passing"
                        : "Review"}
                  </dd>
                </div>
                <div>
                  <dt>Course</dt>
                  <dd>{latestFeedback.courseTitle ?? "Course"}</dd>
                </div>
              </dl>
              {latestFeedback.attempt ? (
                <div className="platform-student-feedback-evidence">
                  {Object.entries(latestFeedback.attempt.answers)
                    .slice(0, 2)
                    .map(([key, value]) => {
                      const question = state.quizQuestionPreviews.find(
                        item => item.id === key
                      );
                      return (
                        <article key={key}>
                          <span>{question?.prompt ?? key}</span>
                          <strong>{value}</strong>
                        </article>
                      );
                    })}
                </div>
              ) : latestFeedback.submission ? (
                <div className="platform-student-feedback-evidence">
                  <article>
                    <span>Submitted response</span>
                    <strong>{latestFeedback.submission.response}</strong>
                  </article>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="platform-empty-state">
              <strong>No feedback yet</strong>
              <span>
                Your teacher feedback will appear here after an assignment or
                quiz is reviewed.
              </span>
            </div>
          )}
          {feedbackItems.length ? (
            <div className="platform-student-feedback-list">
              {feedbackItems.slice(0, 6).map(item => (
                <article key={item.grade.id}>
                  <div>
                    <span>
                      {item.quiz ? "Quiz feedback" : "Assignment feedback"}
                    </span>
                    <strong>{item.grade.itemTitle}</strong>
                    <p>{item.grade.feedback}</p>
                  </div>
                  <dl>
                    <div>
                      <dt>Score</dt>
                      <dd>
                        {item.grade.score}/{item.grade.maxScore}
                      </dd>
                    </div>
                    <div>
                      <dt>Result</dt>
                      <dd>
                        {item.percent >= 80
                          ? "Strong"
                          : item.percent >= 70
                            ? "Passing"
                            : "Review"}
                      </dd>
                    </div>
                    <div>
                      <dt>Evidence</dt>
                      <dd>
                        {item.reviewedAt
                          ? formatDateTime(item.reviewedAt)
                          : "recorded"}
                      </dd>
                    </div>
                  </dl>
                </article>
              ))}
            </div>
          ) : null}
          <div className="platform-report-table">
            {rows.map((row, index) => (
              <article key={`${row.type}_${index}`}>
                {Object.entries(row).map(([key, value]) => (
                  <span key={key}>
                    <strong>{key}</strong>
                    {String(value)}
                  </span>
                ))}
              </article>
            ))}
          </div>
        </section>
      </div>
      <aside className="platform-workflow-side">
        <MiniMetric label="Courses" value={String(scope.courses.length)} />
        <MiniMetric label="Grades" value={String(grades.length)} />
        <MiniMetric label="Assignments" value={String(submissions.length)} />
        <MiniMetric label="Quizzes" value={String(attempts.length)} />
      </aside>
    </div>
  );
}

function AttendanceWorkflow({
  role,
  state,
  refresh,
  params,
  backendSyncStatus = "offline",
}: WorkflowProps) {
  const routeClassId = params?.classId;
  const actorUser = getRoleActorUser(state, role);
  const actorId = actorUser.id;
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const studentScope = getStudentScope(state);
  const ownedTeacherRunIds = new Set(
    state.courseRuns.filter(run => run.teacherId === actorId).map(run => run.id)
  );
  const teacherRunIds = ownedTeacherRunIds;
  const studentRunIds = new Set(
    state.enrollments
      .filter(enrollment => enrollment.studentId === studentScope.studentId)
      .map(enrollment => enrollment.courseRunId)
  );
  const ownedBranchRunIds = new Set(
    state.courseRuns
      .filter(run => run.branchId === actorUser?.branchId)
      .map(run => run.id)
  );
  const branchRunIds = ownedBranchRunIds;
  const classOptions = state.classGroups.filter(group => {
    if (role === "teacher") return teacherRunIds.has(group.courseRunId);
    if (role === "student") return studentRunIds.has(group.courseRunId);
    if (role === "branchadmin") return branchRunIds.has(group.courseRunId);
    return true;
  });
  const classOptionKey = classOptions.map(group => group.id).join("|");
  const routeClass = classOptions.find(group => group.id === routeClassId);
  const routeClassOutOfScope = Boolean(routeClassId && !routeClass);
  const initialClassId =
    routeClass?.id ??
    (!routeClassOutOfScope ? classOptions[0]?.id : undefined) ??
    "";
  const [selectedClassId, setSelectedClassId] = useState(initialClassId);
  const selectedClass = routeClassOutOfScope
    ? undefined
    : (classOptions.find(group => group.id === selectedClassId) ??
      routeClass ??
      classOptions[0]);
  const sessions = state.classSessions
    .filter(session => session.classGroupId === selectedClass?.id)
    .sort(
      (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()
    );
  const [sessionFilter, setSessionFilter] =
    useState<AttendanceSessionFilter>("all");
  const [rosterFilter, setRosterFilter] =
    useState<AttendanceRosterFilter>("all");
  const filteredSessions = sessions.filter(item => {
    if (sessionFilter === "all") return true;
    const sessionSaved = isAttendanceSessionSaved(state, item);
    return sessionFilter === "saved" ? sessionSaved : !sessionSaved;
  });
  const sessionOptionKey = filteredSessions
    .map(session => session.id)
    .join("|");
  const defaultSession =
    filteredSessions.find(item => !isAttendanceSessionSaved(state, item)) ??
    filteredSessions[0];
  const defaultSessionId = defaultSession?.id ?? "";
  const [selectedSessionId, setSelectedSessionId] = useState(defaultSessionId);
  const session =
    filteredSessions.find(item => item.id === selectedSessionId) ??
    defaultSession;
  const [statuses, setStatuses] = useState<Record<string, AttendanceStatus>>(
    {}
  );
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [initialStatuses, setInitialStatuses] = useState<
    Record<string, AttendanceStatus>
  >({});
  const [initialNotes, setInitialNotes] = useState<Record<string, string>>({});
  const selectedRun = state.courseRuns.find(
    run => run.id === selectedClass?.courseRunId
  );
  const selectedCourse = state.courses.find(
    course => course.id === selectedRun?.courseId
  );
  const selectedBranch = state.branches.find(
    branch => branch.id === selectedRun?.branchId
  );
  const selectedTeacher = state.users.find(
    user => user.id === selectedRun?.teacherId
  );
  const selectedRoom = state.rooms.find(
    room => room.id === selectedClass?.roomId
  );
  const presentCount = Object.values(statuses).filter(
    value => value === "present"
  ).length;
  const exceptionCount = Object.values(statuses).filter(
    value => value !== "present"
  ).length;
  const statusCounts = Object.fromEntries(
    attendanceStatusOptions.map(status => [
      status,
      Object.values(statuses).filter(value => value === status).length,
    ])
  ) as Record<AttendanceStatus, number>;
  const savedRecords = session
    ? state.attendance.filter(
        record =>
          record.classGroupId === selectedClass?.id &&
          (record.sessionId === session.id ||
            record.sessionId === session.eventId)
      )
    : [];
  const selectedSessionSaved = session
    ? isAttendanceSessionSaved(state, session)
    : false;
  const savedSessionCount = sessions.filter(item =>
    isAttendanceSessionSaved(state, item)
  ).length;
  const missingSessionCount = sessions.length - savedSessionCount;
  const savedRecordStudentIds = new Set(
    savedRecords.map(record => record.studentId)
  );
  const dirtyStudentIds = selectedClass
    ? selectedClass.studentIds.filter(
        studentId =>
          statuses[studentId] !== initialStatuses[studentId] ||
          (notes[studentId] ?? "").trim() !==
            (initialNotes[studentId] ?? "").trim()
      )
    : [];
  const dirtyStudentIdSet = new Set(dirtyStudentIds);
  const hasAttendanceChanges =
    dirtyStudentIds.length > 0 ||
    savedRecordStudentIds.size < (selectedClass?.studentIds.length ?? 0);
  const visibleStudentIds = selectedClass
    ? selectedClass.studentIds.filter(studentId => {
        if (rosterFilter === "all") return true;
        if (rosterFilter === "unsaved")
          return !savedRecordStudentIds.has(studentId);
        if (rosterFilter === "exceptions")
          return statuses[studentId] !== "present";
        return statuses[studentId] === rosterFilter;
      })
    : [];
  const isSyncLoading = backendSyncStatus === "loading";
  const attendanceReady =
    !isSyncLoading &&
    Boolean(session) &&
    Boolean(selectedClass?.studentIds.length) &&
    Object.keys(statuses).length === selectedClass?.studentIds.length;
  const editableAttendance = role === "teacher" || role === "branchadmin";
  const canSaveAttendance =
    attendanceReady && editableAttendance && hasAttendanceChanges && !saving;
  const recentAttendanceAudits = state.auditLogs
    .filter(
      audit =>
        audit.action === "attendance.saved" &&
        audit.entityId === selectedClass?.id
    )
    .slice(0, 3);
  const formatSessionLabel = (item: typeof session) => {
    if (!item) return "No session selected";
    return `${item.title} · ${new Date(item.startsAt).toLocaleString()}`;
  };
  const saveAttendance = async () => {
    if (!selectedClass || !session || !attendanceReady) return;
    setSaving(true);
    setSaveError("");
    const result = await runPlatformWorkflowActionRequest({
      type: "attendance.save",
      classGroupId: selectedClass.id,
      sessionId: session.id,
      statuses,
      notes,
    });
    setSaving(false);
    if (!result.ok || !result.data) {
      const message = result.error ?? "Attendance could not be saved.";
      setSaveError(message);
      toast.error("Attendance save failed", { description: message });
      return;
    }
    const actionData = result.data;
    const savedStatuses = Object.fromEntries(
      selectedClass.studentIds.map(studentId => {
        const savedRecord = actionData.state.attendance.find(
          record =>
            record.classGroupId === selectedClass.id &&
            record.studentId === studentId &&
            (record.sessionId === session.id ||
              record.sessionId === session.eventId)
        );
        return [
          studentId,
          savedRecord?.status ?? statuses[studentId] ?? "present",
        ];
      })
    ) as Record<string, AttendanceStatus>;
    const savedNotes = Object.fromEntries(
      selectedClass.studentIds.map(studentId => {
        const savedRecord = actionData.state.attendance.find(
          record =>
            record.classGroupId === selectedClass.id &&
            record.studentId === studentId &&
            (record.sessionId === session.id ||
              record.sessionId === session.eventId)
        );
        return [studentId, savedRecord?.notes ?? notes[studentId] ?? ""];
      })
    ) as Record<string, string>;
    setStatuses(savedStatuses);
    setInitialStatuses(savedStatuses);
    setNotes(savedNotes);
    setInitialNotes(savedNotes);
    platformStore.setState(actionData.state);
    refresh();
    toast.success("Attendance saved", {
      description: `${selectedClass.name} · ${session.title} · ${actionData.persistence}`,
    });
  };
  const markAll = (status: AttendanceStatus) => {
    if (!selectedClass || saving || isSyncLoading || !editableAttendance)
      return;
    setStatuses(
      Object.fromEntries(
        selectedClass.studentIds.map(studentId => [studentId, status])
      ) as Record<string, AttendanceStatus>
    );
  };

  useEffect(() => {
    if (routeClassOutOfScope) {
      setSelectedClassId("");
      return;
    }
    if (routeClass) {
      setSelectedClassId(routeClass.id);
      return;
    }
    setSelectedClassId(current =>
      current && classOptions.some(group => group.id === current)
        ? current
        : (classOptions[0]?.id ?? "")
    );
  }, [classOptionKey, routeClass?.id, routeClassOutOfScope]);

  useEffect(() => {
    setSelectedSessionId(current =>
      current && filteredSessions.some(item => item.id === current)
        ? current
        : defaultSessionId
    );
  }, [defaultSessionId, sessionOptionKey, sessionFilter]);

  useEffect(() => {
    if (!selectedClass || !session) {
      setStatuses({});
      setNotes({});
      return;
    }
    const nextStatuses = Object.fromEntries(
      selectedClass.studentIds.map(studentId => {
        const current = state.attendance.find(
          record =>
            record.classGroupId === selectedClass.id &&
            record.studentId === studentId &&
            (record.sessionId === session.id ||
              record.sessionId === session.eventId)
        );
        return [studentId, current?.status ?? "present"];
      })
    ) as Record<string, AttendanceStatus>;
    const nextNotes = Object.fromEntries(
      selectedClass.studentIds.map(studentId => {
        const current = state.attendance.find(
          record =>
            record.classGroupId === selectedClass.id &&
            record.studentId === studentId &&
            (record.sessionId === session.id ||
              record.sessionId === session.eventId)
        );
        return [studentId, current?.notes ?? ""];
      })
    ) as Record<string, string>;
    setStatuses(nextStatuses);
    setInitialStatuses(nextStatuses);
    setNotes(nextNotes);
    setInitialNotes(nextNotes);
  }, [selectedClass?.id, session?.id, session?.eventId, state.attendance]);

  const scopeLabel =
    role === "branchadmin"
      ? `Branch access: ${selectedBranch?.name ?? "Assigned branch"}`
      : `Teacher: ${selectedTeacher?.name ?? actorUser.name}`;

  if (!selectedClass) {
    const emptyTitle = routeClassOutOfScope
      ? "Class outside your scope"
      : "No class available";
    const emptyMessage = routeClassOutOfScope
      ? "This class is not assigned to the current role access, so attendance controls stay locked."
      : "No class group is available in system data.";
    return (
      <section className="platform-workflow-card">
        <div className="platform-workflow-title">
          <span>
            <SlidersHorizontal size={16} /> Class roster attendance
          </span>
          <strong>{emptyTitle}</strong>
        </div>
        <p>{emptyMessage}</p>
      </section>
    );
  }

  return (
    <div className="platform-workflow-layout">
      <div className="platform-workflow-main">
        <section className="platform-workflow-card platform-attendance-workspace">
          <div className="platform-workflow-title">
            <span>
              <SlidersHorizontal size={16} /> Class roster attendance
            </span>
            <strong>
              {role === "branchadmin" ? "Branch control" : "Teacher marking"}
            </strong>
          </div>
          <div className="platform-attendance-context">
            <span>{selectedClass.name}</span>
            <span>{selectedCourse?.title ?? "Course"}</span>
            <span>{scopeLabel}</span>
            <span>
              {selectedRoom?.name ?? selectedTeacher?.name ?? "Assigned class"}
            </span>
            <span>
              {session
                ? `${selectedSessionSaved ? "Saved" : "Pending"} session`
                : "No session"}
            </span>
            <span>
              {backendSyncStatus === "loading"
                ? "Syncing state"
                : `${backendSyncStatus} state`}
            </span>
          </div>
          <div
            id="attendance-control-status"
            className="platform-attendance-notice"
          >
            {isSyncLoading
              ? "Attendance state is syncing. Marking controls unlock when the current state is loaded."
              : editableAttendance
                ? dirtyStudentIds.length
                  ? `${dirtyStudentIds.length} roster change(s) are ready to save.`
                  : hasAttendanceChanges
                    ? `${selectedClass.studentIds.length - savedRecordStudentIds.size} roster row(s) still need a saved attendance record.`
                    : "Saved roster is current for this session."
                : `This attendance workspace is read-only for ${roleMeta[role].label}.`}
          </div>
          <div className="platform-attendance-control-grid">
            <label>
              Class
              <select
                value={selectedClass.id}
                onChange={event => setSelectedClassId(event.target.value)}
                disabled={classOptions.length <= 1 || saving}
              >
                {classOptions.map(group => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Session status
              <select
                value={sessionFilter}
                onChange={event =>
                  setSessionFilter(
                    event.target.value as AttendanceSessionFilter
                  )
                }
                disabled={saving || !sessions.length}
              >
                <option value="all">All sessions</option>
                <option value="pending">Pending only</option>
                <option value="saved">Saved only</option>
              </select>
            </label>
            <label>
              Session
              <select
                value={session?.id ?? ""}
                onChange={event => setSelectedSessionId(event.target.value)}
                disabled={!filteredSessions.length || saving}
              >
                {filteredSessions.length ? (
                  filteredSessions.map(item => (
                    <option key={item.id} value={item.id}>
                      {formatSessionLabel(item)}
                    </option>
                  ))
                ) : (
                  <option value="">No sessions match this filter</option>
                )}
              </select>
            </label>
            <label>
              Roster filter
              <select
                value={rosterFilter}
                onChange={event =>
                  setRosterFilter(event.target.value as AttendanceRosterFilter)
                }
                disabled={saving || !selectedClass.studentIds.length}
              >
                <option value="all">All learners</option>
                <option value="unsaved">Unsaved rows</option>
                <option value="exceptions">Exceptions</option>
                {attendanceStatusOptions.map(status => (
                  <option key={status} value={status}>
                    {attendanceStatusLabels[status]}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div
            className="platform-attendance-toolbar"
            aria-label="Bulk attendance actions"
          >
            {attendanceStatusOptions.map(status => (
              <button
                key={status}
                type="button"
                aria-label={`Mark all learners ${attendanceStatusLabels[status].toLowerCase()}`}
                aria-describedby="attendance-control-status"
                disabled={
                  !selectedClass.studentIds.length ||
                  saving ||
                  isSyncLoading ||
                  !editableAttendance
                }
                onClick={() => markAll(status)}
                title={`Mark all ${attendanceStatusLabels[status].toLowerCase()}`}
              >
                <span>{attendanceStatusShortLabels[status]}</span>
                {attendanceStatusLabels[status]}
              </button>
            ))}
          </div>
          <div
            className="platform-attendance-count-strip"
            aria-label="Attendance status totals"
          >
            {attendanceStatusOptions.map(status => (
              <span key={status}>
                {attendanceStatusLabels[status]}{" "}
                <strong>{statusCounts[status]}</strong>
              </span>
            ))}
            <span>
              Visible <strong>{visibleStudentIds.length}</strong>
            </span>
          </div>
          {!session ? (
            <div className="platform-empty-state">
              <strong>No session to mark</strong>
              <span>
                {sessions.length
                  ? "Change the session filter to inspect saved or pending attendance."
                  : `Create or schedule a class session before saving attendance for ${selectedClass.name}.`}
              </span>
              <button
                type="button"
                onClick={() =>
                  toast.info(
                    "Open the sessions tab to create a class session first."
                  )
                }
              >
                Open sessions
              </button>
            </div>
          ) : !selectedClass.studentIds.length ? (
            <div className="platform-empty-state">
              <strong>No students enrolled</strong>
              <span>This class has no roster in system data.</span>
              <button
                type="button"
                onClick={() =>
                  toast.info(
                    "Open the students tab to review the class roster."
                  )
                }
              >
                Review roster
              </button>
            </div>
          ) : !visibleStudentIds.length ? (
            <div className="platform-empty-state">
              <strong>No roster rows match this filter</strong>
              <span>
                Clear the roster filter or switch session status to inspect the
                full class.
              </span>
              <button type="button" onClick={() => setRosterFilter("all")}>
                Show all learners
              </button>
            </div>
          ) : (
            <div className="platform-attendance-grid stateful">
              {visibleStudentIds.map(studentId => {
                const student = state.students.find(
                  item => item.id === studentId
                );
                const user = state.users.find(
                  item => item.id === student?.userId
                );
                const enrollment = selectedRun
                  ? state.enrollments.find(
                      item =>
                        item.studentId === studentId &&
                        item.courseRunId === selectedRun.id
                    )
                  : undefined;
                const rowSaved = savedRecordStudentIds.has(studentId);
                const rowDirty = dirtyStudentIdSet.has(studentId);
                return (
                  <article key={studentId}>
                    <div>
                      <strong>{user?.name ?? studentId}</strong>
                      <span>
                        {session.title} ·{" "}
                        {new Date(session.startsAt).toLocaleString()}
                      </span>
                      <small className="platform-attendance-roster-meta">
                        Attendance {enrollment?.attendanceRate ?? 0}% · Grade{" "}
                        {enrollment?.currentGrade ?? 0}% ·{" "}
                        {rowDirty
                          ? "unsaved change"
                          : rowSaved
                            ? "saved"
                            : "pending"}
                      </small>
                    </div>
                    <div>
                      {attendanceStatusOptions.map(status => (
                        <button
                          key={status}
                          type="button"
                          aria-pressed={statuses[studentId] === status}
                          disabled={
                            saving || isSyncLoading || !editableAttendance
                          }
                          aria-describedby="attendance-control-status"
                          className={
                            statuses[studentId] === status ? "active" : ""
                          }
                          title={attendanceStatusLabels[status]}
                          aria-label={`${user?.name ?? studentId}: ${attendanceStatusLabels[status]}`}
                          onClick={() =>
                            setStatuses(prev => ({
                              ...prev,
                              [studentId]: status,
                            }))
                          }
                        >
                          <span aria-hidden="true">
                            {attendanceStatusShortLabels[status]}
                          </span>
                          <strong>{attendanceStatusLabels[status]}</strong>
                        </button>
                      ))}
                      <span
                        className={`platform-attendance-chip ${rowDirty ? "changed" : rowSaved ? "saved" : "pending"}`}
                      >
                        {rowDirty ? "Unsaved" : rowSaved ? "Saved" : "Pending"}
                      </span>
                      <input
                        className="platform-attendance-note-input"
                        value={notes[studentId] ?? ""}
                        placeholder="Short attendance note"
                        disabled={
                          saving || isSyncLoading || !editableAttendance
                        }
                        aria-label={`${user?.name ?? studentId} attendance note`}
                        onChange={event =>
                          setNotes(prev => ({
                            ...prev,
                            [studentId]: event.target.value,
                          }))
                        }
                      />
                    </div>
                  </article>
                );
              })}
            </div>
          )}
          <button
            type="button"
            className="platform-primary-button"
            style={{ background: roleMeta[role].color }}
            aria-describedby="attendance-control-status"
            disabled={!canSaveAttendance}
            onClick={saveAttendance}
          >
            <CheckCircle2 size={15} />
            {saving ? "Saving attendance" : "Save attendance"}
          </button>
          <div className="platform-attendance-status-line">
            <span>
              {savedRecordStudentIds.size}/{selectedClass.studentIds.length}{" "}
              roster rows saved for this session.
            </span>
            <span>
              {savedSessionCount} saved · {missingSessionCount} missing
              session(s)
            </span>
            <span>{dirtyStudentIds.length} unsaved change(s)</span>
          </div>
          {saveError ? (
            <p className="platform-attendance-error">{saveError}</p>
          ) : null}
          {!editableAttendance ? (
            <p className="platform-attendance-error">
              This attendance view is read-only for {roleMeta[role].label}.
            </p>
          ) : null}
        </section>
        {session ? (
          <section className="platform-workflow-card">
            <div className="platform-workflow-title">
              <span>
                <ClipboardCheck size={16} /> Saved roster
              </span>
              <strong>{savedRecords.length} saved</strong>
            </div>
            <div className="platform-row-list compact">
              {savedRecords.length ? (
                savedRecords.map(record => {
                  const student = state.students.find(
                    item => item.id === record.studentId
                  );
                  const user = state.users.find(
                    item => item.id === student?.userId
                  );
                  return (
                    <article key={record.id}>
                      <div>
                        <strong>{user?.name ?? record.studentId}</strong>
                        <span
                          className={`platform-attendance-chip ${record.status}`}
                        >
                          {attendanceStatusLabels[record.status]}
                        </span>
                        {record.notes ? <small>{record.notes}</small> : null}
                      </div>
                    </article>
                  );
                })
              ) : (
                <article>
                  <div>
                    <strong>No saved records</strong>
                    <small>
                      Statuses are pending until you save this session.
                    </small>
                  </div>
                </article>
              )}
            </div>
          </section>
        ) : null}
      </div>
      <aside className="platform-workflow-side">
        <MiniMetric
          label="Session status"
          value={selectedSessionSaved ? "saved" : session ? "pending" : "none"}
        />
        <MiniMetric
          label="Students"
          value={String(selectedClass.studentIds.length)}
        />
        <MiniMetric label="Present" value={String(presentCount)} />
        <MiniMetric label="Exceptions" value={String(exceptionCount)} />
        <section className="platform-workflow-card">
          <div className="platform-workflow-title">
            <span>
              <ShieldCheck size={16} /> Attendance audit
            </span>
            <strong>Latest saves</strong>
          </div>
          <div className="platform-row-list compact">
            {recentAttendanceAudits.length ? (
              recentAttendanceAudits.map(audit => {
                const actor = state.users.find(
                  user => user.id === audit.actorId
                );
                return (
                  <article key={audit.id}>
                    <div>
                      <strong>
                        {actor?.name ?? "System"} saved attendance
                      </strong>
                      <small>
                        {audit.summary} · {formatDateTime(audit.createdAt)}
                      </small>
                    </div>
                  </article>
                );
              })
            ) : (
              <article>
                <div>
                  <strong>No saved attendance yet</strong>
                  <small>Save this session to create an audit row.</small>
                </div>
              </article>
            )}
          </div>
        </section>
      </aside>
    </div>
  );
}

function ScheduleGovernanceWorkflow({
  role,
  state,
  backendSyncStatus = "offline",
}: WorkflowProps) {
  const actorUser = getRoleActorUser(state, role);
  const classIds =
    role === "headofdepartment"
      ? getHodClassIds(state, actorUser.id)
      : new Set(state.classGroups.map(group => group.id));
  const scopedEvents = state.events
    .filter(event => {
      if (role === "superadmin") return true;
      return event.classGroupId
        ? classIds.has(event.classGroupId)
        : event.ownerId === actorUser.id;
    })
    .sort(
      (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()
    );
  const pendingEvents = scopedEvents.filter(
    event => event.status === "pending"
  );
  const activeEvents = scopedEvents.filter(event => event.status === "active");
  const classSessionEvents = scopedEvents.filter(
    event => event.type === "class_session" || event.type === "live_session"
  );
  const auditIds = new Set(scopedEvents.map(event => event.id));
  const recentAudits = state.auditLogs
    .filter(
      audit =>
        (audit.action === "calendar.created" ||
          audit.action === "calendar.created_with_conflict") &&
        auditIds.has(audit.entityId)
    )
    .slice(0, 5);

  return (
    <div className="platform-workflow-layout">
      <div className="platform-workflow-main">
        <section className="platform-workflow-card">
          <div className="platform-workflow-title">
            <span>
              <CalendarDays size={16} /> Schedule governance
            </span>
            <strong>
              {role === "superadmin"
                ? "Platform calendar"
                : "Academic calendar"}
            </strong>
          </div>
          <div className="platform-calendar-brief">
            <div>
              <strong>
                {role === "superadmin"
                  ? "All branches"
                  : `${classIds.size} class scope`}
              </strong>
              <span>
                {activeEvents.length} active · {pendingEvents.length} pending ·{" "}
                {classSessionEvents.length} class sessions
              </span>
            </div>
            <span>
              {backendSyncStatus === "loading"
                ? "Syncing"
                : `${backendSyncStatus} state`}
            </span>
          </div>
          <div className="platform-calendar-scope compact">
            <span>{roleMeta[role].label}</span>
            <span>{scopedEvents.length} events</span>
            <span>
              {pendingEvents.length
                ? `${pendingEvents.length} need review`
                : "No pending conflicts"}
            </span>
          </div>
        </section>
        <ScheduleBoard
          state={state}
          events={scopedEvents}
          limit={10}
          emptyText="No schedule events are currently in this governance scope."
        />
        <EventList
          state={state}
          events={scopedEvents}
          limit={10}
          emptyText="No schedule events match this governance scope."
        />
      </div>
      <aside className="platform-workflow-side">
        <MiniMetric label="Events" value={String(scopedEvents.length)} />
        <MiniMetric label="Pending" value={String(pendingEvents.length)} />
        <MiniMetric label="Classes" value={String(classSessionEvents.length)} />
        <MiniMetric label="Audits" value={String(recentAudits.length)} />
        <section className="platform-workflow-card">
          <div className="platform-workflow-title">
            <span>
              <ShieldCheck size={16} /> Schedule audit
            </span>
            <strong>{recentAudits.length} rows</strong>
          </div>
          <div className="platform-row-list compact">
            {recentAudits.length ? (
              recentAudits.map(audit => {
                const actor = state.users.find(
                  user => user.id === audit.actorId
                );
                return (
                  <article key={audit.id}>
                    <div>
                      <strong>
                        {audit.action === "calendar.created_with_conflict"
                          ? "Pending review"
                          : "Scheduled"}
                      </strong>
                      <small>
                        {actor?.name ?? "System"} · {audit.summary} ·{" "}
                        {formatDateTime(audit.createdAt)}
                      </small>
                    </div>
                  </article>
                );
              })
            ) : (
              <article>
                <div>
                  <strong>No schedule audit rows</strong>
                  <small>New schedule changes will appear here.</small>
                </div>
              </article>
            )}
          </div>
        </section>
      </aside>
    </div>
  );
}

function SchedulingWorkflow({
  role,
  state,
  refresh,
  backendSyncStatus = "offline",
}: WorkflowProps) {
  const [viewMode, setViewMode] = useState<"day" | "week" | "month">("week");
  const [typeFilter, setTypeFilter] = useState<"all" | CalendarEventType>(
    "all"
  );
  const [statusFilter, setStatusFilter] = useState<
    "all" | "active" | "pending"
  >("all");
  const [title, setTitle] = useState("Arabic L3 review session");
  const [date, setDate] = useState(() => getFutureDateInput());
  const [starts, setStarts] = useState("09:00");
  const [ends, setEnds] = useState("10:30");
  const [type, setType] = useState<CalendarEventType>(() =>
    getDefaultSchedulerType(role)
  );
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [lastResult, setLastResult] = useState<{
    status: string;
    title: string;
    conflicts: number;
    availabilityGaps: number;
  } | null>(null);
  const actorUser = getRoleActorUser(state, role);
  const actorId = actorUser.id;
  const typeOptions = useMemo(() => getSchedulerTypeOptions(role), [role]);
  const roleRuns = state.courseRuns.filter(run => {
    if (role === "teacher") return run.teacherId === actorId;
    if (role === "branchadmin") return run.branchId === actorUser?.branchId;
    return true;
  });
  const roleRunIds = new Set(roleRuns.map(run => run.id));
  const branchIds = new Set(roleRuns.map(run => run.branchId));
  const branchOptions = state.branches.filter(branch => {
    if (role === "branchadmin") return branch.id === actorUser?.branchId;
    if (role === "teacher") return branchIds.has(branch.id);
    return true;
  });
  const [branchId, setBranchId] = useState(
    actorUser?.branchId ?? branchOptions[0]?.id ?? ""
  );
  const classOptions = state.classGroups.filter(group => {
    if (!roleRunIds.has(group.courseRunId)) return false;
    if (!branchId) return true;
    const run = state.courseRuns.find(item => item.id === group.courseRunId);
    return run?.branchId === branchId;
  });
  const roomOptions = state.rooms.filter(room => {
    if (!branchId)
      return role === "teacher" ? branchIds.has(room.branchId) : true;
    return room.branchId === branchId;
  });
  const [roomId, setRoomId] = useState(roomOptions[0]?.id ?? "");
  const [classGroupId, setClassGroupId] = useState(classOptions[0]?.id ?? "");
  const branchOptionKey = branchOptions.map(branch => branch.id).join("|");
  const classOptionKey = classOptions.map(group => group.id).join("|");
  const roomOptionKey = roomOptions.map(room => room.id).join("|");
  const selectedBranch = state.branches.find(branch => branch.id === branchId);
  const selectedRoom = state.rooms.find(room => room.id === roomId);
  const selectedClass = state.classGroups.find(
    group => group.id === classGroupId
  );
  const selectedRun = state.courseRuns.find(
    run => run.id === selectedClass?.courseRunId
  );
  const selectedTeacher = state.users.find(
    user => user.id === selectedRun?.teacherId
  );
  const selectedTeacherId = selectedRun?.teacherId;
  const getEventAssignedTeacherId = (event: CalendarEvent) => {
    const eventGroup = event.classGroupId
      ? state.classGroups.find(group => group.id === event.classGroupId)
      : undefined;
    const eventRun = eventGroup
      ? state.courseRuns.find(run => run.id === eventGroup.courseRunId)
      : undefined;
    return eventRun?.teacherId ?? event.ownerId;
  };
  const needsClass = type === "class_session" || type === "live_session";
  const usesRoom =
    type !== "assignment_due" && type !== "quiz_due" && type !== "reminder";
  const requiresRoom = type === "room_booking";
  const submitRoomId = usesRoom ? roomId || undefined : undefined;
  const submitClassGroupId = needsClass ? classGroupId || undefined : undefined;
  const submitBranchId =
    (submitClassGroupId ? selectedRun?.branchId : undefined) ??
    (submitRoomId ? selectedRoom?.branchId : undefined) ??
    selectedBranch?.id;
  const candidateStartsAt = date && starts ? `${date}T${starts}:00+03:00` : "";
  const candidateEndsAt = date && ends ? `${date}T${ends}:00+03:00` : "";
  const startsMs = Date.parse(candidateStartsAt);
  const endsMs = Date.parse(candidateEndsAt);
  const hasValidRange = Boolean(
    date &&
      starts &&
      ends &&
      starts < ends &&
      Number.isFinite(startsMs) &&
      Number.isFinite(endsMs)
  );
  const isSyncLoading = backendSyncStatus === "loading";
  const invalidEvent =
    !title.trim() ||
    !hasValidRange ||
    (needsClass && !classGroupId) ||
    (requiresRoom && !roomId) ||
    isSyncLoading ||
    saving;
  const disabledReason = isSyncLoading
    ? "Waiting for server-scoped calendar state."
    : !title.trim()
      ? "Add a short event title."
      : !hasValidRange
        ? "Choose a valid date and time range."
        : needsClass && !classGroupId
          ? "Choose a class group for this session."
          : requiresRoom && !roomId
            ? "Choose a room for this booking."
            : "";
  const scopedEvents = state.events
    .filter(event => {
      if (role === "teacher") {
        return (
          event.ownerId === actorId ||
          (event.classGroupId
            ? classOptions.some(group => group.id === event.classGroupId)
            : false)
        );
      }
      if (role === "branchadmin") {
        return (
          event.branchId === actorUser?.branchId ||
          (event.classGroupId
            ? classOptions.some(group => group.id === event.classGroupId)
            : false)
        );
      }
      if (role === "registrar") {
        return (
          event.type === "placement_test" ||
          event.type === "trial_lesson" ||
          event.type === "room_booking" ||
          event.type === "reminder" ||
          event.ownerId === actorId
        );
      }
      return true;
    })
    .sort(
      (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()
    );
  const filteredEvents = scopedEvents.filter(event => {
    if (typeFilter !== "all" && event.type !== typeFilter) return false;
    if (statusFilter !== "all" && event.status !== statusFilter) return false;
    return true;
  });
  const previewConflicts = hasValidRange
    ? state.events.filter(event => {
        const eventStarts = new Date(event.startsAt).getTime();
        const eventEnds = new Date(event.endsAt).getTime();
        const overlaps = startsMs < eventEnds && endsMs > eventStarts;
        if (!overlaps) return false;
        return Boolean(
          (submitRoomId && event.roomId === submitRoomId) ||
            event.ownerId === actorId ||
            (submitClassGroupId && event.classGroupId === submitClassGroupId) ||
            (selectedTeacherId &&
              getEventAssignedTeacherId(event) === selectedTeacherId)
        );
      })
    : [];
  const conflictDetails = previewConflicts.map(event => {
    const reasons = [
      submitRoomId && event.roomId === submitRoomId ? "room" : "",
      event.ownerId === actorId ? "owner" : "",
      submitClassGroupId && event.classGroupId === submitClassGroupId
        ? "class"
        : "",
      selectedTeacherId &&
      getEventAssignedTeacherId(event) === selectedTeacherId
        ? "teacher"
        : "",
    ].filter(Boolean);
    return {
      event,
      reason: reasons.length ? reasons.join(" + ") : "time overlap",
    };
  });
  const availabilityMatches =
    hasValidRange && selectedRun && needsClass
      ? state.teacherAvailability.filter(item => {
          const weekday = new Date(candidateStartsAt).toLocaleDateString(
            "en-US",
            {
              weekday: "long",
            }
          );
          return (
            item.teacherId === selectedRun.teacherId &&
            item.branchId === submitBranchId &&
            item.weekday === weekday &&
            item.startsAt <= starts &&
            item.endsAt >= ends
          );
        })
      : [];
  const hasAvailabilityGap =
    hasValidRange &&
    Boolean(selectedRun && needsClass && !availabilityMatches.length);
  const eventStatusCounts = {
    active: scopedEvents.filter(event => event.status === "active").length,
    pending: scopedEvents.filter(event => event.status === "pending").length,
    total: scopedEvents.length,
    visible: filteredEvents.length,
  };
  const scopedEventIds = new Set(scopedEvents.map(event => event.id));
  const recentCalendarAudits = state.auditLogs
    .filter(
      audit =>
        (audit.action === "calendar.created" ||
          audit.action === "calendar.created_with_conflict") &&
        scopedEventIds.has(audit.entityId)
    )
    .slice(0, 4);

  useEffect(() => {
    if (!branchId || !branchOptions.some(branch => branch.id === branchId)) {
      setBranchId(actorUser?.branchId ?? branchOptions[0]?.id ?? "");
    }
  }, [actorUser?.branchId, branchId, branchOptionKey]);

  useEffect(() => {
    if (!typeOptions.some(option => option.value === type)) {
      setType(typeOptions[0]?.value ?? "live_session");
    }
    if (!roomId || !roomOptions.some(room => room.id === roomId)) {
      setRoomId(roomOptions[0]?.id ?? "");
    }
    if (
      !classGroupId ||
      !classOptions.some(group => group.id === classGroupId)
    ) {
      setClassGroupId(classOptions[0]?.id ?? "");
    }
  }, [classGroupId, classOptionKey, roomId, roomOptionKey, type, typeOptions]);

  const useConflictSlot = () => {
    const event =
      scopedEvents.find(item => item.roomId || item.classGroupId) ??
      scopedEvents[0];
    if (!event) return;
    setTitle(`${event.title} overlap check`);
    setDate(event.startsAt.slice(0, 10));
    setStarts(event.startsAt.slice(11, 16));
    setEnds(event.endsAt.slice(11, 16));
    if (typeOptions.some(option => option.value === event.type)) {
      setType(event.type);
    } else {
      setType(typeOptions[0]?.value ?? getDefaultSchedulerType(role));
    }
    if (event.roomId) setRoomId(event.roomId);
    if (event.classGroupId) setClassGroupId(event.classGroupId);
    if (event.branchId) setBranchId(event.branchId);
  };

  const createEvent = async () => {
    if (invalidEvent) return;
    setSaving(true);
    setSaveError("");
    setLastResult(null);
    const result = await runPlatformWorkflowActionRequest({
      type: "calendar.create",
      eventType: type,
      title: title.trim(),
      startsAt: candidateStartsAt,
      endsAt: candidateEndsAt,
      branchId: submitBranchId,
      roomId: submitRoomId,
      classGroupId: submitClassGroupId,
    });
    setSaving(false);
    if (!result.ok || !result.data) {
      const message = result.error ?? "Calendar event could not be saved.";
      setSaveError(message);
      toast.error("Event save failed", { description: message });
      return;
    }
    const payload = result.data.result.result as
      | {
          event?: CalendarEvent;
          conflicts?: CalendarEvent[];
          availabilityGaps?: string[];
        }
      | undefined;
    platformStore.setState(result.data.state);
    refresh();
    setLastResult({
      status: payload?.event?.status ?? "saved",
      title: payload?.event?.title ?? title.trim(),
      conflicts: payload?.conflicts?.length ?? 0,
      availabilityGaps: payload?.availabilityGaps?.length ?? 0,
    });
    toast.success(
      payload?.conflicts?.length
        ? "Event saved with conflict"
        : "Event scheduled",
      { description: `${title.trim()} · ${result.data.persistence}` }
    );
  };

  return (
    <div className="platform-workflow-layout">
      <div className="platform-workflow-main">
        <section className="platform-workflow-card">
          <div className="platform-workflow-title">
            <span>
              <CalendarDays size={16} /> Scheduling engine
            </span>
            <strong>{roleMeta[role].label} calendar</strong>
          </div>
          <div className="platform-calendar-brief">
            <div>
              <strong>{selectedBranch?.name ?? "Global scope"}</strong>
              <span>
                {eventStatusCounts.visible}/{eventStatusCounts.total} visible ·{" "}
                {eventStatusCounts.pending} pending
              </span>
            </div>
            <span>
              {backendSyncStatus === "loading"
                ? "Syncing"
                : `${backendSyncStatus} state`}
            </span>
          </div>
          <div className="platform-calendar-scope compact">
            <span>{selectedBranch?.name ?? "Global scope"}</span>
            <span>
              {usesRoom
                ? (selectedRoom?.name ?? "No room selected")
                : "No room required"}
            </span>
            <span>
              {needsClass
                ? (selectedClass?.name ?? "Class required")
                : "No class required"}
            </span>
            <span>
              {needsClass
                ? (selectedTeacher?.name ?? "Teacher required")
                : "No teacher required"}
            </span>
            <span>
              {typeFilter === "all"
                ? "All event types"
                : schedulerTypeLabels[typeFilter]}
            </span>
            <span>
              {statusFilter === "all" ? "All statuses" : statusFilter}
            </span>
            <span>
              {previewConflicts.length || hasAvailabilityGap
                ? `${previewConflicts.length + (hasAvailabilityGap ? 1 : 0)} schedule review`
                : "Clear preview"}
            </span>
          </div>
          <div className="platform-segmented" aria-label="Calendar view">
            {(["day", "week", "month"] as const).map(mode => (
              <button
                key={mode}
                className={viewMode === mode ? "active" : ""}
                onClick={() => setViewMode(mode)}
              >
                {mode}
              </button>
            ))}
          </div>
          <div className="platform-calendar-filter-grid">
            <label>
              Event filter
              <select
                value={typeFilter}
                onChange={event =>
                  setTypeFilter(event.target.value as "all" | CalendarEventType)
                }
              >
                <option value="all">All event types</option>
                {typeOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Status filter
              <select
                value={statusFilter}
                onChange={event =>
                  setStatusFilter(
                    event.target.value as "all" | "active" | "pending"
                  )
                }
              >
                <option value="all">All statuses</option>
                <option value="active">Active</option>
                <option value="pending">Pending conflict</option>
              </select>
            </label>
          </div>
          <div className="platform-inline-form grid">
            <label>
              Title
              <input
                value={title}
                onChange={event => setTitle(event.target.value)}
              />
            </label>
            <label>
              Type
              <select
                value={type}
                onChange={event =>
                  setType(event.target.value as CalendarEventType)
                }
              >
                {typeOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Branch
              <select
                value={branchId}
                onChange={event => setBranchId(event.target.value)}
                disabled={role === "branchadmin" || !branchOptions.length}
              >
                {branchOptions.length ? (
                  branchOptions.map(branch => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))
                ) : (
                  <option value="">No branch</option>
                )}
              </select>
            </label>
            <label>
              Date
              <input
                type="date"
                value={date}
                onChange={event => setDate(event.target.value)}
              />
            </label>
            <label>
              Starts
              <input
                type="time"
                value={starts}
                onChange={event => setStarts(event.target.value)}
              />
            </label>
            <label>
              Ends
              <input
                type="time"
                value={ends}
                onChange={event => setEnds(event.target.value)}
              />
            </label>
            <label>
              Room
              <select
                value={usesRoom ? roomId : ""}
                onChange={event => setRoomId(event.target.value)}
                disabled={!roomOptions.length || !usesRoom}
              >
                {!usesRoom ? (
                  <option value="">No room required</option>
                ) : roomOptions.length ? (
                  roomOptions.map(room => (
                    <option key={room.id} value={room.id}>
                      {room.name}
                    </option>
                  ))
                ) : (
                  <option value="">No room</option>
                )}
              </select>
            </label>
            <label>
              Class
              <select
                value={needsClass ? classGroupId : ""}
                onChange={event => setClassGroupId(event.target.value)}
                disabled={!classOptions.length || !needsClass}
              >
                {!needsClass ? (
                  <option value="">No class required</option>
                ) : classOptions.length ? (
                  classOptions.map(group => (
                    <option key={group.id} value={group.id}>
                      {group.name}
                    </option>
                  ))
                ) : (
                  <option value="">General event</option>
                )}
              </select>
            </label>
          </div>
          <div
            className={`platform-conflict-panel ${previewConflicts.length || hasAvailabilityGap ? "warning" : "clear"}`}
          >
            <strong>Conflict preview</strong>
            <span>
              {hasValidRange
                ? `${new Date(candidateStartsAt).toLocaleString()} to ${new Date(candidateEndsAt).toLocaleTimeString()}`
                : "Choose a valid date and time range"}
            </span>
            {previewConflicts.length ? (
              conflictDetails
                .slice(0, viewMode === "day" ? 2 : viewMode === "week" ? 4 : 6)
                .map(({ event, reason }) => (
                  <small key={event.id}>
                    {event.title} · {reason} · {event.status}
                  </small>
                ))
            ) : (
              <small>
                No room, teacher, or class overlap detected for this slot.
              </small>
            )}
            {hasAvailabilityGap ? (
              <small>
                {selectedTeacher?.name ?? "Teacher"} has no availability block
                for{" "}
                {new Date(candidateStartsAt).toLocaleDateString("en-US", {
                  weekday: "long",
                })}{" "}
                {starts}-{ends}.
              </small>
            ) : null}
          </div>
          {lastResult ? (
            <div
              className={`platform-scheduler-feedback ${lastResult.conflicts || lastResult.availabilityGaps ? "warning" : "success"}`}
            >
              <strong>{lastResult.title}</strong>
              <span>
                {lastResult.status} ·{" "}
                {lastResult.conflicts || lastResult.availabilityGaps
                  ? `${lastResult.conflicts} conflict(s), ${lastResult.availabilityGaps} availability review(s)`
                  : "no conflicts"}
              </span>
            </div>
          ) : null}
          {saveError ? (
            <p className="platform-attendance-error">{saveError}</p>
          ) : null}
          <div className="platform-calendar-actions">
            <button
              type="button"
              onClick={useConflictSlot}
              disabled={!scopedEvents.length}
            >
              Use conflict slot
            </button>
            <button
              type="button"
              className="platform-primary-button"
              style={{ background: roleMeta[role].color }}
              disabled={invalidEvent}
              onClick={createEvent}
            >
              <CalendarDays size={15} />
              {saving ? "Saving event" : "Create event"}
            </button>
          </div>
          <p className="platform-calendar-hint">
            {disabledReason ||
              (previewConflicts.length
                ? "This will save as pending so operations can resolve the conflict."
                : hasAvailabilityGap
                  ? "This will save as pending because teacher availability needs review."
                  : "This event is ready to save through the server action endpoint.")}
          </p>
        </section>
        <ScheduleBoard
          state={state}
          events={filteredEvents}
          limit={viewMode === "day" ? 3 : viewMode === "week" ? 6 : 10}
          emptyText="No events match this role scope yet."
        />
        <EventList
          state={state}
          events={filteredEvents}
          limit={viewMode === "day" ? 3 : viewMode === "week" ? 5 : 8}
          emptyText="Create an event or adjust the role filters."
        />
      </div>
      <aside className="platform-workflow-side">
        <div className="platform-calendar-status-grid">
          <MiniMetric
            label="Scoped events"
            value={String(eventStatusCounts.total)}
          />
          <MiniMetric
            label="Visible"
            value={String(eventStatusCounts.visible)}
          />
          <MiniMetric label="Active" value={String(eventStatusCounts.active)} />
          <MiniMetric
            label="Pending"
            value={String(eventStatusCounts.pending)}
          />
        </div>
        <MiniMetric label="Rooms" value={String(roomOptions.length)} />
        <MiniMetric
          label="Availability blocks"
          value={String(state.teacherAvailability.length)}
        />
        <section className="platform-workflow-card">
          <div className="platform-workflow-title">
            <span>
              <ShieldCheck size={16} /> Schedule audit
            </span>
            <strong>{recentCalendarAudits.length} rows</strong>
          </div>
          <div className="platform-row-list compact">
            {recentCalendarAudits.length ? (
              recentCalendarAudits.map(audit => {
                const actor = state.users.find(
                  user => user.id === audit.actorId
                );
                return (
                  <article key={audit.id}>
                    <div>
                      <strong>
                        {audit.action === "calendar.created_with_conflict"
                          ? "Saved with conflict"
                          : "Event scheduled"}
                      </strong>
                      <small>
                        {actor?.name ?? "System"} · {audit.summary} ·{" "}
                        {formatDateTime(audit.createdAt)}
                      </small>
                    </div>
                  </article>
                );
              })
            ) : (
              <article>
                <div>
                  <strong>No schedule audit rows</strong>
                  <small>Create an event to record scheduler evidence.</small>
                </div>
              </article>
            )}
          </div>
        </section>
        <section className="platform-workflow-card">
          <div className="platform-workflow-title">
            <span>
              <CalendarDays size={16} /> Scheduler boundaries
            </span>
            <strong>Server guarded</strong>
          </div>
          <p>
            Calendar saves use the platform action endpoint. Recurring rules and
            external calendar sync stay disabled until a server scheduler is
            connected.
          </p>
          <button disabled>Enable recurrence</button>
        </section>
      </aside>
    </div>
  );
}

function WorkflowLoadingCard({ label }: { label: string }) {
  return (
    <div className="platform-workflow-layout">
      <div className="platform-workflow-main">
        <section className="platform-workflow-card">
          <div className="platform-workflow-title">
            <span>
              <ShieldCheck size={16} /> Loading scoped data
            </span>
            <strong>{label}</strong>
          </div>
          <p className="platform-muted-copy">
            Fetching the server-scoped workspace before certificate details are
            shown.
          </p>
        </section>
      </div>
    </div>
  );
}

function CertificateWorkflow({
  role,
  state,
  refresh,
  backendSyncStatus,
}: WorkflowProps) {
  if (backendSyncStatus === "loading") {
    return <WorkflowLoadingCard label="Certificate governance" />;
  }

  const canManageCertificates = role === "headofdepartment";
  const actor = getRoleActorUser(state, role);
  const hodCertificateIds =
    role === "headofdepartment"
      ? getHodCertificateIds(state, actor.id)
      : undefined;
  const [statusFilter, setStatusFilter] = useState<
    Certificate["status"] | "all"
  >("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [rejectReasons, setRejectReasons] = useState<Record<string, string>>(
    {}
  );
  const certificateOptions = state.certificates.filter(certificate => {
    if (hodCertificateIds && !hodCertificateIds.has(certificate.id))
      return false;
    if (statusFilter !== "all" && certificate.status !== statusFilter)
      return false;
    const student = state.students.find(
      item => item.id === certificate.studentId
    );
    const user = state.users.find(item => item.id === student?.userId);
    const course = state.courses.find(item => item.id === certificate.courseId);
    const searchable =
      `${certificate.verificationCode} ${user?.name ?? ""} ${course?.title ?? ""}`.toLowerCase();
    return searchable.includes(searchTerm.trim().toLowerCase());
  });
  const [selectedId, setSelectedId] = useState(state.certificates[0]?.id ?? "");
  const [savingKey, setSavingKey] = useState("");
  const [workflowMessage, setWorkflowMessage] = useState("");
  const [workflowError, setWorkflowError] = useState("");
  const selected =
    certificateOptions.find(certificate => certificate.id === selectedId) ??
    certificateOptions[0];
  const selectedStudent = state.students.find(
    student => student.id === selected?.studentId
  );
  const selectedUser = state.users.find(
    user => user.id === selectedStudent?.userId
  );
  const selectedCourse = state.courses.find(
    course => course.id === selected?.courseId
  );
  const selectedDocument = state.documents.find(
    document =>
      selected &&
      document.ownerId === selected.studentId &&
      document.type === "certificate" &&
      (document.url === `#certificate-${selected.id}` ||
        document.title.includes(selected.verificationCode))
  );
  const selectedIssued = selected?.status === "issued";
  const selectedApprover = state.users.find(
    user => user.id === selected?.approvedBy
  );
  const selectedIssuer = state.users.find(
    user => user.id === selected?.issuedBy
  );
  const selectedAudits = state.auditLogs
    .filter(
      audit =>
        selected &&
        audit.entityType === "Certificate" &&
        audit.entityId === selected.id &&
        (audit.action === "certificate.approved" ||
          audit.action === "certificate.issued" ||
          audit.action === "certificate.rejected")
    )
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  const certificateSummary = getCertificateSummary(
    state,
    hodCertificateIds ??
      new Set(state.certificates.map(certificate => certificate.id))
  );
  const [verificationCode, setVerificationCode] = useState(
    selected?.status === "issued" ? selected.verificationCode : ""
  );
  const verification = platformStore.verifyCertificate(verificationCode);

  useEffect(() => {
    if (!selected && certificateOptions[0]) {
      setSelectedId(certificateOptions[0].id);
      setVerificationCode(
        certificateOptions[0].status === "issued"
          ? certificateOptions[0].verificationCode
          : ""
      );
    }
  }, [certificateOptions, selected]);

  const runCertificateAction = async (
    actionType:
      | "certificate.approve"
      | "certificate.issue"
      | "certificate.reject",
    certificate: Certificate
  ) => {
    const nextKey = `${actionType}:${certificate.id}`;
    setSavingKey(nextKey);
    setWorkflowMessage("");
    setWorkflowError("");
    const rejectionReason =
      actionType === "certificate.reject"
        ? (rejectReasons[certificate.id]?.trim() ?? "")
        : "";
    const result = await runPlatformWorkflowActionRequest(
      actionType === "certificate.reject"
        ? {
            type: actionType,
            certificateId: certificate.id,
            reason: rejectionReason,
          }
        : {
            type: actionType,
            certificateId: certificate.id,
          }
    );
    setSavingKey("");
    if (!result.ok || !result.data) {
      const message = result.error ?? "Certificate workflow failed.";
      setWorkflowError(message);
      toast.error("Certificate action failed", { description: message });
      return;
    }
    const changed = result.data.result.result as Certificate | undefined;
    platformStore.setState(result.data.state);
    refresh();
    setSelectedId(certificate.id);
    setVerificationCode(
      changed?.status === "issued" ? changed.verificationCode : ""
    );
    if (!changed) {
      const message =
        actionType === "certificate.issue"
          ? "Certificate was not issued because it is not approved yet."
          : actionType === "certificate.reject"
            ? "Certificate state did not change."
            : "Certificate state did not change.";
      setWorkflowMessage(message);
      toast.info(message);
      return;
    }
    const message =
      actionType === "certificate.approve"
        ? `Approved ${changed.verificationCode}.`
        : actionType === "certificate.issue"
          ? `Issued ${changed.verificationCode}.`
          : `Rejected ${changed.verificationCode}.`;
    setWorkflowMessage(`${message} Saved to ${result.data.persistence}.`);
    toast.success(
      actionType === "certificate.approve"
        ? "Certificate approved"
        : actionType === "certificate.issue"
          ? "Certificate issued"
          : "Certificate rejected",
      {
        description: result.data.persistence,
      }
    );
  };

  return (
    <div className="platform-workflow-layout">
      <div className="platform-workflow-main">
        <section className="platform-workflow-card">
          <div className="platform-workflow-title">
            <span>
              <Award size={16} /> Certificate workflow
            </span>
            <strong>{certificateOptions.length} in scope</strong>
          </div>
          <div className="platform-certificate-toolbar">
            <div
              className="platform-status-tabs"
              aria-label="Certificate status filter"
            >
              {(
                ["all", ...certificateStatusOptions] as Array<
                  Certificate["status"] | "all"
                >
              ).map(status => (
                <button
                  key={status}
                  type="button"
                  className={statusFilter === status ? "active" : ""}
                  onClick={() => setStatusFilter(status)}
                >
                  {status === "all" ? "All" : certificateStatusLabels[status]}
                </button>
              ))}
            </div>
            <label className="platform-compact-search">
              Search certificates
              <input
                value={searchTerm}
                onChange={event => setSearchTerm(event.target.value)}
                placeholder="Learner, course, or code"
              />
            </label>
          </div>
          {!canManageCertificates ? (
            <p className="platform-muted-copy">
              Super admin reviews platform certificate health and audit evidence
              here. Approval and issue actions remain HOD-scoped on the server.
            </p>
          ) : null}
          <div className="platform-row-list">
            {certificateOptions.length ? (
              certificateOptions.map(certificate =>
                (() => {
                  const approved =
                    certificate.status === "approved" ||
                    certificate.status === "issued";
                  const issued = certificate.status === "issued";
                  const eligible =
                    certificate.grade >= 80 && certificate.attendanceRate >= 80;
                  const canApprove =
                    certificate.status === "pending_approval" && eligible;
                  const canReject =
                    certificate.status === "pending_approval" ||
                    certificate.status === "approved";
                  const rejectReason =
                    rejectReasons[certificate.id]?.trim() ?? "";
                  const approveKey = `certificate.approve:${certificate.id}`;
                  const issueKey = `certificate.issue:${certificate.id}`;
                  const rejectKey = `certificate.reject:${certificate.id}`;
                  return (
                    <article
                      key={certificate.id}
                      className={
                        selected?.id === certificate.id ? "selected" : ""
                      }
                    >
                      <div>
                        <strong>{certificate.verificationCode}</strong>
                        <small>
                          Grade {certificate.grade}% · Attendance{" "}
                          {certificate.attendanceRate}% ·{" "}
                          {certificateStatusLabels[certificate.status]}
                        </small>
                      </div>
                      <div className="platform-row-actions">
                        <span
                          className={`platform-certificate-status ${certificate.status}`}
                        >
                          {certificateStatusLabels[certificate.status]}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedId(certificate.id);
                            setVerificationCode(
                              certificate.status === "issued"
                                ? certificate.verificationCode
                                : ""
                            );
                          }}
                        >
                          Preview
                        </button>
                        {canManageCertificates ? (
                          <>
                            {canReject ? (
                              <label className="platform-certificate-reject-reason">
                                Reject reason
                                <input
                                  value={rejectReasons[certificate.id] ?? ""}
                                  onChange={event =>
                                    setRejectReasons(current => ({
                                      ...current,
                                      [certificate.id]: event.target.value,
                                    }))
                                  }
                                  placeholder="Eligibility note"
                                />
                              </label>
                            ) : null}
                            <button
                              type="button"
                              disabled={!canApprove || Boolean(savingKey)}
                              onClick={() =>
                                runCertificateAction(
                                  "certificate.approve",
                                  certificate
                                )
                              }
                            >
                              {savingKey === approveKey
                                ? "Approving"
                                : approved
                                  ? "Approved"
                                  : eligible
                                    ? "Approve"
                                    : "Not eligible"}
                            </button>
                            <button
                              type="button"
                              disabled={
                                !approved || issued || Boolean(savingKey)
                              }
                              onClick={() =>
                                runCertificateAction(
                                  "certificate.issue",
                                  certificate
                                )
                              }
                            >
                              {savingKey === issueKey
                                ? "Issuing"
                                : issued
                                  ? "Issued"
                                  : approved
                                    ? "Issue"
                                    : "Approve first"}
                            </button>
                            <button
                              type="button"
                              disabled={
                                !canReject ||
                                !rejectReason ||
                                Boolean(savingKey)
                              }
                              onClick={() =>
                                runCertificateAction(
                                  "certificate.reject",
                                  certificate
                                )
                              }
                            >
                              {savingKey === rejectKey
                                ? "Rejecting"
                                : canReject
                                  ? "Reject"
                                  : "Closed"}
                            </button>
                          </>
                        ) : null}
                      </div>
                    </article>
                  );
                })()
              )
            ) : (
              <div className="platform-empty-state">
                <strong>No certificates in scope</strong>
                <span>
                  Eligible learner certificates will appear after grades and
                  attendance are ready.
                </span>
              </div>
            )}
          </div>
          {workflowMessage ? (
            <p className="platform-scheduler-feedback success">
              {workflowMessage}
            </p>
          ) : null}
          {workflowError ? (
            <p className="platform-attendance-error">{workflowError}</p>
          ) : null}
        </section>
        {selected ? (
          <CertificateEligibilityEvidence
            certificate={selected}
            studentName={selectedUser?.name ?? "Student"}
            courseTitle={selectedCourse?.title ?? "Course"}
            documentStatus={selectedDocument?.status}
            approverName={selectedApprover?.name}
            issuerName={selectedIssuer?.name}
            auditSummary={
              selectedAudits[0]
                ? `${selectedAudits[0].summary} · ${formatDateTime(selectedAudits[0].createdAt)}`
                : undefined
            }
          />
        ) : null}
        {selected ? (
          <CertificatePreview
            certificate={selected}
            studentName={selectedUser?.name ?? "Student"}
            courseTitle={selectedCourse?.title ?? "Course"}
            documentStatus={selectedDocument?.status}
            revealCode
            context="governance"
          />
        ) : null}
      </div>
      <aside className="platform-workflow-side">
        <MiniMetric
          label="Pending"
          value={String(
            certificateOptions.filter(
              item => item.status === "pending_approval"
            ).length
          )}
        />
        <MiniMetric
          label="Approved"
          value={String(
            certificateOptions.filter(item => item.status === "approved").length
          )}
        />
        <MiniMetric
          label="Issued"
          value={String(
            certificateOptions.filter(item => item.status === "issued").length
          )}
        />
        <MiniMetric
          label="Documents"
          value={String(certificateSummary.issuedDocuments.length)}
        />
        <CertificateVerifyPanel
          title="Local lookup"
          label="Verification code"
          value={verificationCode}
          onChange={setVerificationCode}
          disabled={!selectedIssued}
          verification={verification}
        />
        <section className="platform-workflow-card">
          <div className="platform-workflow-title">
            <span>
              <FileText size={16} /> Certificate audit
            </span>
            <strong>{certificateSummary.recentAudits.length} rows</strong>
          </div>
          <div className="platform-row-list compact">
            {certificateSummary.recentAudits.length ? (
              certificateSummary.recentAudits.map(audit => (
                <article key={audit.id}>
                  <div>
                    <strong>
                      {audit.action === "certificate.issued"
                        ? "Issued"
                        : audit.action === "certificate.rejected"
                          ? "Rejected"
                          : "Approved"}
                    </strong>
                    <small>
                      {audit.summary} · {formatDateTime(audit.createdAt)}
                    </small>
                  </div>
                </article>
              ))
            ) : (
              <article>
                <div>
                  <strong>No audit rows yet</strong>
                  <small>Approval and issue actions will appear here.</small>
                </div>
              </article>
            )}
          </div>
        </section>
      </aside>
    </div>
  );
}

function QuranWorkflow({ role, state, refresh }: WorkflowProps) {
  const [selectedSubmissionId, setSelectedSubmissionId] = useState(
    state.recitationSubmissions[0]?.id ?? ""
  );
  const selectedSubmission =
    state.recitationSubmissions.find(
      item => item.id === selectedSubmissionId
    ) ?? state.recitationSubmissions[0];
  const selectedStudent = state.students.find(
    item => item.id === selectedSubmission?.studentId
  );
  const selectedUser = state.users.find(
    item => item.id === selectedStudent?.userId
  );
  const selectedPlan = state.quranPlans.find(
    item => item.studentId === selectedSubmission?.studentId
  );
  const selectedProgress =
    state.quranProgress.find(
      item => item.studentId === selectedSubmission?.studentId
    ) ?? state.quranProgress[0];
  const [memorized, setMemorized] = useState(
    selectedProgress?.memorizedPercent ?? 0
  );
  const [tajweed, setTajweed] = useState(selectedProgress?.tajweedScore ?? 0);
  const [feedback, setFeedback] = useState(
    selectedSubmission?.feedback ?? selectedProgress?.notes ?? ""
  );
  const [mistakes, setMistakes] = useState<string[]>([]);
  const [savingKey, setSavingKey] = useState("");
  const [workflowMessage, setWorkflowMessage] = useState("");
  const [workflowError, setWorkflowError] = useState("");
  const mistakeOptions = [
    "Madd timing",
    "Makharij",
    "Ghunnah",
    "Stopping",
    "Revision gap",
  ];

  useEffect(() => {
    setMemorized(selectedProgress?.memorizedPercent ?? 0);
    setTajweed(selectedProgress?.tajweedScore ?? 0);
    setFeedback(selectedSubmission?.feedback ?? selectedProgress?.notes ?? "");
    setMistakes([]);
  }, [selectedProgress?.id, selectedSubmission?.id]);

  const submitReview = async () => {
    if (!selectedSubmission || !feedback.trim()) return;
    const nextKey = `review:${selectedSubmission.id}`;
    setSavingKey(nextKey);
    setWorkflowMessage("");
    setWorkflowError("");
    const result = await runPlatformWorkflowActionRequest({
      type: "recitation.review",
      submissionId: selectedSubmission.id,
      feedback: [
        feedback.trim(),
        mistakes.length ? `Focus tags: ${mistakes.join(", ")}` : "",
      ]
        .filter(Boolean)
        .join(" "),
    });
    setSavingKey("");
    if (!result.ok || !result.data) {
      const message = result.error ?? "Recitation review could not be saved.";
      setWorkflowError(message);
      toast.error("Review not saved", { description: message });
      return;
    }
    platformStore.setState(result.data.state);
    refresh();
    setWorkflowMessage(`Review saved · ${result.data.persistence}`);
    toast.success("Recitation reviewed", {
      description: result.data.persistence,
    });
  };

  const updateProgress = async () => {
    if (!selectedProgress) return;
    const nextKey = `progress:${selectedProgress.id}`;
    setSavingKey(nextKey);
    setWorkflowMessage("");
    setWorkflowError("");
    const result = await runPlatformWorkflowActionRequest({
      type: "quran.progress.update",
      recordId: selectedProgress.id,
      memorizedPercent: memorized,
      tajweedScore: tajweed,
      notes: feedback.trim(),
    });
    setSavingKey("");
    if (!result.ok || !result.data) {
      const message = result.error ?? "Quran progress could not be saved.";
      setWorkflowError(message);
      toast.error("Progress not saved", { description: message });
      return;
    }
    platformStore.setState(result.data.state);
    refresh();
    setWorkflowMessage(`Progress updated · ${result.data.persistence}`);
    toast.success("Quran progress updated", {
      description: result.data.persistence,
    });
  };

  return (
    <div className="platform-workflow-layout">
      <div className="platform-workflow-main">
        <section className="platform-workflow-card">
          <div className="platform-workflow-title">
            <span>
              <Headphones size={16} /> Quran review workspace
            </span>
            <strong>{selectedUser?.name ?? "No learner selected"}</strong>
          </div>
          <div className="platform-row-list compact">
            {state.recitationSubmissions.length ? (
              state.recitationSubmissions.map(item => {
                const student = state.students.find(
                  studentItem => studentItem.id === item.studentId
                );
                const user = state.users.find(
                  userItem => userItem.id === student?.userId
                );
                return (
                  <article
                    key={item.id}
                    className={
                      selectedSubmission?.id === item.id ? "selected" : ""
                    }
                  >
                    <div>
                      <strong>{item.title}</strong>
                      <small>
                        {user?.name ?? "Learner"} ·{" "}
                        {formatDateTime(item.submittedAt)}
                      </small>
                    </div>
                    <div className="platform-row-actions">
                      <span className={`platform-status ${item.status}`}>
                        {item.status}
                      </span>
                      <button
                        type="button"
                        onClick={() => setSelectedSubmissionId(item.id)}
                      >
                        Open
                      </button>
                    </div>
                  </article>
                );
              })
            ) : (
              <article>
                <div>
                  <strong>No recitations in scope</strong>
                  <small>
                    Submitted recitations from assigned Quran learners will
                    appear here.
                  </small>
                </div>
              </article>
            )}
          </div>
        </section>

        <section className="platform-workflow-card">
          <div className="platform-workflow-title">
            <span>
              <BookMarked size={16} /> Memorization and tajweed
            </span>
            <strong>
              {selectedProgress?.surah ??
                selectedPlan?.target ??
                "No progress record"}
            </strong>
          </div>
          <QuranProgressSummary
            role={role}
            progress={selectedProgress}
            plan={selectedPlan}
            recitationCount={state.recitationSubmissions.length}
          />
          <div className="platform-inline-form grid">
            <label>
              Memorized %
              <input
                type="number"
                min="0"
                max="100"
                value={memorized}
                onChange={event => setMemorized(Number(event.target.value))}
              />
            </label>
            <label>
              Tajweed score
              <input
                type="number"
                min="0"
                max="100"
                value={tajweed}
                onChange={event => setTajweed(Number(event.target.value))}
              />
            </label>
          </div>
          <textarea
            value={feedback}
            onChange={event => setFeedback(event.target.value)}
          />
          <RecitationWaveformPlaceholder
            role={role}
            label="Recitation waveform placeholder"
            status={selectedSubmission?.status}
          />
          <div className="platform-tag-grid" aria-label="Tajweed mistake tags">
            {mistakeOptions.map(mistake => (
              <button
                key={mistake}
                className={mistakes.includes(mistake) ? "active" : ""}
                onClick={() => {
                  setMistakes(current =>
                    current.includes(mistake)
                      ? current.filter(item => item !== mistake)
                      : [...current, mistake]
                  );
                }}
              >
                {mistake}
              </button>
            ))}
          </div>
          <div className="platform-action-grid">
            <button
              disabled={!selectedProgress || Boolean(savingKey)}
              onClick={updateProgress}
            >
              {savingKey === `progress:${selectedProgress?.id}`
                ? "Updating"
                : "Update progress"}
            </button>
            <button
              disabled={
                !selectedSubmission ||
                selectedSubmission.status === "approved" ||
                !feedback.trim() ||
                Boolean(savingKey)
              }
              onClick={submitReview}
            >
              {savingKey === `review:${selectedSubmission?.id}`
                ? "Saving"
                : selectedSubmission?.status === "approved"
                  ? "Reviewed"
                  : "Review recitation"}
            </button>
          </div>
          {workflowMessage ? (
            <p className="platform-scheduler-feedback success">
              {workflowMessage}
            </p>
          ) : null}
          {workflowError ? (
            <p className="platform-attendance-error">{workflowError}</p>
          ) : null}
        </section>
      </div>
      <aside className="platform-workflow-side">
        <MiniMetric label="Plan" value={selectedPlan?.target ?? "No plan"} />
        <MiniMetric
          label="Current Juz"
          value={selectedPlan?.currentJuz ?? "-"}
        />
        <MiniMetric
          label="Recitations"
          value={String(state.recitationSubmissions.length)}
        />
        <section className="platform-workflow-card">
          <div className="platform-workflow-title">
            <span>
              <Headphones size={16} /> Audio storage
            </span>
            <strong>Provider pending</strong>
          </div>
          <p>
            Review evidence is saved now. Audio upload and playback will use the
            future protected storage provider.
          </p>
        </section>
      </aside>
    </div>
  );
}

function MessageWorkflow({ role, state, refresh }: WorkflowProps) {
  const actorUser = getRoleActorUser(state, role);
  const actorId = actorUser.id;
  const teacherRunIds = new Set(
    state.courseRuns.filter(run => run.teacherId === actorId).map(run => run.id)
  );
  const teacherStudentIds = new Set(
    state.classGroups
      .filter(group => teacherRunIds.has(group.courseRunId))
      .flatMap(group => group.studentIds)
  );
  const branchUser = state.users.find(user => user.id === actorId);
  const branchRecipients = state.users.filter(
    user => user.branchId === branchUser?.branchId && user.id !== actorId
  );
  const recipientOptions =
    role === "teacher"
      ? state.users.filter(user =>
          state.students.some(
            student =>
              student.userId === user.id && teacherStudentIds.has(student.id)
          )
        )
      : role === "registrar"
        ? state.users.filter(user =>
            [
              "student",
              "branchadmin",
              "headofdepartment",
              "superadmin",
            ].includes(user.activeRole)
          )
        : role === "branchadmin"
          ? branchRecipients
          : role === "headofdepartment"
            ? state.users.filter(user =>
                ["teacher", "student", "superadmin"].includes(user.activeRole)
              )
            : state.users.filter(user => user.id !== actorId);
  const [toUserId, setToUserId] = useState(
    recipientOptions[0]?.id ?? "usr_student_demo"
  );
  const [subject, setSubject] = useState("Class update");
  const [body, setBody] = useState("Your next Nile Learn update is ready.");
  const recipientIds = new Set([
    actorId,
    ...recipientOptions.map(user => user.id),
  ]);
  const scopedMessages =
    role === "superadmin"
      ? state.messages
      : state.messages.filter(
          message =>
            recipientIds.has(message.fromUserId) ||
            recipientIds.has(message.toUserId)
        );

  useEffect(() => {
    if (
      recipientOptions.length &&
      !recipientOptions.some(user => user.id === toUserId)
    ) {
      setToUserId(recipientOptions[0].id);
    }
  }, [recipientOptions, toUserId]);

  return (
    <div className="platform-workflow-layout">
      <div className="platform-workflow-main">
        <section className="platform-workflow-card">
          <div className="platform-workflow-title">
            <span>
              <MessageSquare size={16} /> Messages
            </span>
            <strong>Compose message</strong>
          </div>
          <div className="platform-inline-form grid">
            <label>
              Recipient
              <select
                value={toUserId}
                onChange={event => setToUserId(event.target.value)}
              >
                {recipientOptions.map(user => (
                  <option key={user.id} value={user.id}>
                    {user.name} · {roleMeta[user.activeRole].label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Subject
              <input
                value={subject}
                onChange={event => setSubject(event.target.value)}
              />
            </label>
          </div>
          <textarea
            value={body}
            onChange={event => setBody(event.target.value)}
          />
          <button
            className="platform-primary-button"
            style={{ background: roleMeta[role].color }}
            disabled={!subject.trim() || !body.trim() || !toUserId}
            onClick={() => {
              platformStore.sendMessage({
                fromUserId: actorId,
                toUserId,
                subject,
                body,
              });
              refresh();
              toast.success("Message sent");
            }}
          >
            <Send size={15} />
            Send message
          </button>
        </section>
        <MessageList state={state} messages={scopedMessages} />
      </div>
      <aside className="platform-workflow-side">
        <MiniMetric label="Conversations" value={String(scopedMessages.length)} />
        <MiniMetric
          label="Templates"
          value={String(state.messageTemplates.length)}
        />
      </aside>
    </div>
  );
}

function FinanceWorkflow({ role, state, refresh }: WorkflowProps) {
  const actor = getRoleActorUser(state, role);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | Payment["status"]>(
    "all"
  );
  const [amountDrafts, setAmountDrafts] = useState<Record<string, string>>({});
  const [methodDrafts, setMethodDrafts] = useState<
    Record<string, Payment["method"]>
  >({});
  const [referenceDrafts, setReferenceDrafts] = useState<
    Record<string, string>
  >({});
  const [savingInvoiceId, setSavingInvoiceId] = useState("");
  const [actionError, setActionError] = useState("");
  const paymentMethods: Payment["method"][] = [
    "manual",
    "cash",
    "bank_transfer",
    "card",
  ];
  const invoiceBranchId = (invoiceId: string) => {
    const invoice = state.invoices.find(item => item.id === invoiceId);
    const enrollment = state.enrollments.find(
      item => item.studentId === invoice?.studentId
    );
    const run = state.courseRuns.find(
      item => item.id === enrollment?.courseRunId
    );
    return run?.branchId;
  };
  const invoiceRows = state.invoices
    .filter(
      invoice =>
        role !== "branchadmin" || invoiceBranchId(invoice.id) === actor.branchId
    )
    .map(invoice => {
      const payments = state.payments.filter(
        payment => payment.invoiceId === invoice.id && payment.status === "paid"
      );
      const paid = payments.reduce((sum, payment) => sum + payment.amount, 0);
      const balance = Math.max(0, invoice.amount - paid);
      const student = state.students.find(
        item => item.id === invoice.studentId
      );
      const user = state.users.find(item => item.id === student?.userId);
      return { invoice, payments, paid, balance, student, user };
    })
    .filter(row => {
      const haystack =
        `${row.invoice.id} ${row.user?.name ?? ""} ${row.user?.email ?? ""}`.toLowerCase();
      const matchesSearch =
        !search.trim() || haystack.includes(search.trim().toLowerCase());
      const matchesStatus =
        statusFilter === "all" || row.invoice.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  const totalDue = invoiceRows.reduce(
    (sum, row) => sum + row.invoice.amount,
    0
  );
  const totalPaid = invoiceRows.reduce((sum, row) => sum + row.paid, 0);
  const totalBalance = invoiceRows.reduce((sum, row) => sum + row.balance, 0);
  const recordPayment = async (invoiceId: string, balance: number) => {
    if (balance <= 0) return;
    setSavingInvoiceId(invoiceId);
    setActionError("");
    const requestedAmount = Number(amountDrafts[invoiceId] ?? balance);
    const result = await runPlatformWorkflowActionRequest({
      type: "payment.record",
      invoiceId,
      amount: Number.isFinite(requestedAmount) ? requestedAmount : balance,
      method: methodDrafts[invoiceId] ?? "manual",
      reference: referenceDrafts[invoiceId]?.trim() || undefined,
    });
    setSavingInvoiceId("");
    if (!result.ok || !result.data) {
      const message = result.error ?? "Payment could not be recorded.";
      setActionError(message);
      toast.error("Payment failed", { description: message });
      return;
    }
    platformStore.setState(result.data.state);
    setAmountDrafts(current => {
      const next = { ...current };
      delete next[invoiceId];
      return next;
    });
    setReferenceDrafts(current => {
      const next = { ...current };
      delete next[invoiceId];
      return next;
    });
    refresh();
    toast.success("Payment recorded", {
      description: result.data.result.summary,
    });
  };

  return (
    <div className="platform-workflow-layout registrar-payment-desk">
      <div className="platform-workflow-main registrar-payment-command">
        <section className="platform-workflow-card registrar-payment-table-card">
          <div className="platform-workflow-title">
            <span>
              <CreditCard size={16} /> Finance workflow
            </span>
            <strong>Invoices and payments</strong>
          </div>
          <div className="registrar-payment-summary">
            <article>
              <span>Invoice scope</span>
              <strong>{invoiceRows.length}</strong>
              <small>
                {role === "branchadmin"
                  ? (actor.branchId ?? "Branch")
                  : "Admissions desk"}
              </small>
            </article>
            <article>
              <span>Collected</span>
              <strong>{totalPaid}</strong>
              <small>of {totalDue} due</small>
            </article>
            <article>
              <span>Balance</span>
              <strong>{totalBalance}</strong>
              <small>pending reconciliation</small>
            </article>
          </div>
          <div className="registrar-payment-toolbar">
            <label>
              Search
              <input
                value={search}
                onChange={event => setSearch(event.target.value)}
                placeholder="Invoice, student, phone"
              />
            </label>
            <label>
              Status
              <select
                value={statusFilter}
                onChange={event =>
                  setStatusFilter(event.target.value as typeof statusFilter)
                }
              >
                <option value="all">All</option>
                <option value="pending">Pending</option>
                <option value="paid">Paid</option>
                <option value="overdue">Overdue</option>
              </select>
            </label>
          </div>
          {actionError ? (
            <div className="platform-empty-state error">
              <strong>Payment save failed</strong>
              <span>{actionError}</span>
            </div>
          ) : null}
          <div className="registrar-payment-table">
            <div className="registrar-payment-table-head" aria-hidden="true">
              <span>Invoice</span>
              <span>Student</span>
              <span>Amount</span>
              <span>Paid</span>
              <span>Balance</span>
              <span>Status</span>
              <span>Record</span>
              <span>Action</span>
            </div>
            {invoiceRows.length ? (
              invoiceRows.map(({ invoice, paid, balance, user, payments }) => (
                <article key={invoice.id} className="registrar-payment-row">
                  <div>
                    <strong>{invoice.id}</strong>
                    <small>
                      Due {invoice.dueAt}
                      {payments[0]?.reference
                        ? ` · ${payments[0].reference}`
                        : ""}
                    </small>
                  </div>
                  <div>
                    <strong>{user?.name ?? invoice.studentId}</strong>
                    <small>{invoice.currency} account</small>
                  </div>
                  <span>
                    {invoice.currency} {invoice.amount}
                  </span>
                  <span className={paid ? "settled" : "attention"}>{paid}</span>
                  <span className={balance ? "attention" : "settled"}>
                    {balance}
                  </span>
                  <span
                    className={`registrar-payment-status ${invoice.status}`}
                  >
                    {invoice.status}
                  </span>
                  <div className="registrar-payment-record-fields">
                    <input
                      className="registrar-payment-amount-input"
                      type="number"
                      min="0"
                      max={balance}
                      value={amountDrafts[invoice.id] ?? String(balance)}
                      onChange={event =>
                        setAmountDrafts(current => ({
                          ...current,
                          [invoice.id]: event.target.value,
                        }))
                      }
                      aria-label={`Payment amount for ${invoice.id}`}
                      disabled={balance <= 0 || Boolean(savingInvoiceId)}
                    />
                    <select
                      value={methodDrafts[invoice.id] ?? "manual"}
                      onChange={event =>
                        setMethodDrafts(current => ({
                          ...current,
                          [invoice.id]: event.target.value as Payment["method"],
                        }))
                      }
                      aria-label={`Payment method for ${invoice.id}`}
                      disabled={balance <= 0 || Boolean(savingInvoiceId)}
                    >
                      {paymentMethods.map(method => (
                        <option key={method} value={method}>
                          {method.replace("_", " ")}
                        </option>
                      ))}
                    </select>
                    <input
                      value={referenceDrafts[invoice.id] ?? ""}
                      onChange={event =>
                        setReferenceDrafts(current => ({
                          ...current,
                          [invoice.id]: event.target.value,
                        }))
                      }
                      placeholder="Reference"
                      aria-label={`Payment reference for ${invoice.id}`}
                      disabled={balance <= 0 || Boolean(savingInvoiceId)}
                    />
                  </div>
                  <button
                    type="button"
                    disabled={balance <= 0 || savingInvoiceId === invoice.id}
                    onClick={() => recordPayment(invoice.id, balance)}
                  >
                    {balance <= 0
                      ? "Paid"
                      : savingInvoiceId === invoice.id
                        ? "Saving"
                        : "Record payment"}
                  </button>
                </article>
              ))
            ) : (
              <div className="registrar-payment-empty">
                <strong>No invoices match this view</strong>
                <small>
                  Clear filters or switch branch access to review more balances.
                </small>
              </div>
            )}
          </div>
        </section>
      </div>
      <aside className="platform-workflow-side">
        <MiniMetric label="Packages" value={String(state.packages.length)} />
        <MiniMetric label="Discounts" value={String(state.discounts.length)} />
        <MiniMetric
          label="Paid records"
          value={String(
            state.payments.filter(payment => payment.status === "paid").length
          )}
        />
        <MiniMetric label="Open balance" value={String(totalBalance)} />
      </aside>
    </div>
  );
}

function AdmissionsWorkflow({ role, state, refresh }: WorkflowProps) {
  const [recommendedLevel, setRecommendedLevel] = useState("Arabic Level 2");
  const [score, setScore] = useState(78);

  return (
    <div className="platform-workflow-layout">
      <div className="platform-workflow-main">
        <section className="platform-workflow-card">
          <div className="platform-workflow-title">
            <span>
              <UserPlus size={16} /> Admissions pipeline
            </span>
            <strong>Lead to enrollment</strong>
          </div>
          <div className="platform-row-list">
            {state.leads.slice(0, 5).map(lead =>
              (() => {
                const converted = state.applications.some(
                  application => application.leadId === lead.id
                );
                return (
                  <article key={lead.id}>
                    <div>
                      <strong>{lead.fullName}</strong>
                      <small>
                        {lead.subject} · {lead.source} · {lead.status}
                      </small>
                    </div>
                    <button
                      disabled={converted}
                      onClick={() => {
                        platformStore.convertLeadToApplication(
                          lead.id,
                          getDemoUser(role).id
                        );
                        refresh();
                        toast.success("Lead converted to application");
                      }}
                    >
                      {converted ? "Converted" : "Convert"}
                    </button>
                  </article>
                );
              })()
            )}
          </div>
        </section>
        <section className="platform-workflow-card">
          <div className="platform-workflow-title">
            <span>
              <FileText size={16} /> Placement result
            </span>
            <strong>{state.placementTests[0]?.fullName}</strong>
          </div>
          <div className="platform-inline-form grid">
            <label>
              Recommended level
              <input
                value={recommendedLevel}
                onChange={event => setRecommendedLevel(event.target.value)}
              />
            </label>
            <label>
              Score
              <input
                type="number"
                value={score}
                onChange={event => setScore(Number(event.target.value))}
              />
            </label>
          </div>
          <button
            disabled={
              !state.placementTests[0] ||
              state.placementTests[0].status === "completed"
            }
            onClick={() => {
              platformStore.recordPlacementResult(
                state.placementTests[0].id,
                recommendedLevel,
                score,
                "Recorded from registrar workflow.",
                getDemoUser(role).id
              );
              refresh();
              toast.success("Placement result recorded");
            }}
          >
            {state.placementTests[0]?.status === "completed"
              ? "Result recorded"
              : "Record placement result"}
          </button>
        </section>
      </div>
      <aside className="platform-workflow-side">
        <MiniMetric label="Leads" value={String(state.leads.length)} />
        <MiniMetric
          label="Applications"
          value={String(state.applications.length)}
        />
        <MiniMetric
          label="Ready workflows"
          value={String(
            state.enrollmentWorkflows.filter(
              item => item.status === "ready_to_enroll"
            ).length
          )}
        />
      </aside>
    </div>
  );
}

function ReportsWorkflow({
  role,
  state,
  refresh,
  pageId,
}: WorkflowProps & { pageId: string }) {
  const allowedReportTypes = reportTypesByRole[role] ?? ["enrollments"];
  const initialReportType =
    (pageId === "audit-logs" || pageId === "system-health") &&
    allowedReportTypes.includes("audit")
      ? "audit"
      : allowedReportTypes[0];
  const [reportType, setReportType] = useState<ReportType>(initialReportType);
  const [reportSearch, setReportSearch] = useState("");
  const [reportStatusFilter, setReportStatusFilter] = useState("all");
  const [reportSortKey, setReportSortKey] = useState<ReportSortKey>("primary");
  const [reportSortDirection, setReportSortDirection] =
    useState<ReportSortDirection>("asc");
  const [isSavingPreset, setIsSavingPreset] = useState(false);
  const actorUser = getRoleActorUser(state, role);
  const actorId = actorUser.id;
  const savedPresets = (state.reportPresets ?? [])
    .filter(
      preset =>
        preset.ownerUserId === actorId &&
        preset.role === role &&
        allowedReportTypes.includes(preset.reportType)
    )
    .slice(0, 5);
  const teacherRunIds = new Set(
    state.courseRuns.filter(run => run.teacherId === actorId).map(run => run.id)
  );
  const teacherClassIds = new Set(
    state.classGroups
      .filter(group => teacherRunIds.has(group.courseRunId))
      .map(group => group.id)
  );
  const branchRunIds = new Set(
    state.courseRuns
      .filter(run => run.branchId === actorUser.branchId)
      .map(run => run.id)
  );
  const branchClassIds = new Set(
    state.classGroups
      .filter(group => branchRunIds.has(group.courseRunId))
      .map(group => group.id)
  );
  const branchStudentIds = new Set(
    state.enrollments
      .filter(enrollment => branchRunIds.has(enrollment.courseRunId))
      .map(enrollment => enrollment.studentId)
  );
  const hodClassIds =
    role === "headofdepartment" ? getHodClassIds(state, actorId) : undefined;
  const hodRunIds = new Set(
    role === "headofdepartment"
      ? state.classGroups
          .filter(group => hodClassIds?.has(group.id))
          .map(group => group.courseRunId)
      : []
  );
  const hodStudentIds = new Set(
    role === "headofdepartment"
      ? state.classGroups
          .filter(group => hodClassIds?.has(group.id))
          .flatMap(group => group.studentIds)
      : []
  );
  const reportAttendanceClassIds =
    role === "superadmin"
      ? undefined
      : role === "teacher"
        ? teacherClassIds
        : role === "branchadmin"
          ? branchClassIds
          : role === "student"
            ? getStudentScope(state).classIds
            : role === "headofdepartment"
              ? hodClassIds
              : undefined;
  const effectiveReportType = allowedReportTypes.includes(reportType)
    ? reportType
    : allowedReportTypes[0];
  const baseRows = platformStore.exportReportRows(effectiveReportType);
  const rows = baseRows.filter(row => {
    const isScopedAttendanceAudit =
      "action" in row &&
      row.action === "attendance.saved" &&
      "entityId" in row &&
      Boolean(reportAttendanceClassIds?.has(String(row.entityId)));
    if (role === "superadmin") return true;
    if (role === "teacher") {
      if ("courseRunId" in row)
        return teacherRunIds.has(String(row.courseRunId));
      if ("classGroupId" in row)
        return teacherClassIds.has(String(row.classGroupId));
      if (isScopedAttendanceAudit) return true;
      if ("actorId" in row) return row.actorId === actorId;
      return false;
    }
    if (role === "headofdepartment") {
      if ("courseRunId" in row) return hodRunIds.has(String(row.courseRunId));
      if ("classGroupId" in row) {
        return Boolean(reportAttendanceClassIds?.has(String(row.classGroupId)));
      }
      if ("studentId" in row) return hodStudentIds.has(String(row.studentId));
      if (isScopedAttendanceAudit) return true;
      if ("actorId" in row) return row.actorId === actorId;
      return false;
    }
    if (role === "registrar") {
      if ("studentId" in row) return true;
      if ("actorId" in row)
        return /lead|application|placement|payment|enrollment|message/.test(
          String(row.action ?? "")
        );
      return true;
    }
    if (role === "branchadmin") {
      if ("studentId" in row)
        return branchStudentIds.has(String(row.studentId));
      if (isScopedAttendanceAudit) return true;
      if ("actorId" in row) return row.actorId === actorId;
      return false;
    }
    if ("actorId" in row) return row.actorId === actorId;
    return true;
  });
  const filteredRows = rows.filter(row => {
    const query = reportSearch.trim().toLowerCase();
    const matchesQuery =
      !query ||
      Object.values(row).some(value =>
        String(value ?? "")
          .toLowerCase()
          .includes(query)
      );
    const matchesStatus =
      reportStatusFilter === "all" ||
      ("status" in row &&
        String(row.status).toLowerCase() === reportStatusFilter);
    return matchesQuery && matchesStatus;
  });
  const formattedRows = filteredRows.map(row => ({
    raw: row,
    display: formatReportRow(row, effectiveReportType, state),
  }));
  const sortedReportRows = [...formattedRows].sort((left, right) => {
    const leftValue = left.display.sort[reportSortKey];
    const rightValue = right.display.sort[reportSortKey];
    const direction = reportSortDirection === "asc" ? 1 : -1;
    if (typeof leftValue === "number" || typeof rightValue === "number") {
      return (Number(leftValue) - Number(rightValue)) * direction;
    }
    return (
      String(leftValue).localeCompare(String(rightValue), undefined, {
        numeric: true,
        sensitivity: "base",
      }) * direction
    );
  });
  const sortedRawRows = sortedReportRows.map(row => row.raw);
  const displayRows = sortedReportRows.slice(0, 8).map(row => row.display);
  const reportCertificateIds =
    role === "superadmin"
      ? new Set(state.certificates.map(certificate => certificate.id))
      : role === "headofdepartment"
        ? getHodCertificateIds(state, actorId)
        : undefined;
  const exceptionRows = filteredRows.filter(
    row =>
      ("status" in row &&
        ["absent", "late", "overdue", "pending"].includes(
          String(row.status).toLowerCase()
        )) ||
      ("balance" in row && Number(row.balance) > 0)
  ).length;
  const auditRows = filteredRows.filter(row => "actorId" in row).length;
  const reportScopeLabel =
    role === "superadmin"
      ? "Global platform"
      : role === "branchadmin"
        ? (actorUser.branchId ?? "Branch")
        : role === "headofdepartment"
          ? (actorUser.departmentId ?? "Department")
          : roleMeta[role].label;
  const reportPageTitle =
    pageId === "audit-logs"
      ? "Activity log"
      : role === "branchadmin"
        ? "Branch reports"
        : role === "registrar"
          ? "Registrar reports"
          : role === "headofdepartment"
            ? "Academic reports"
            : role === "teacher"
              ? "Teacher reports"
              : "Reports";
  const exportCsv = () => {
    const csv = platformStore.buildCsv(sortedRawRows);
    if (!csv) {
      toast.info("No rows to export");
      return;
    }
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `nile-${effectiveReportType}-report.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exported locally", {
      description: `${filteredRows.length} filtered row(s)`,
    });
  };
  const savePreset = async () => {
    const label = `${reportLabels[effectiveReportType]} snapshot ${savedPresets.length + 1}`;
    setIsSavingPreset(true);
    const result = await runPlatformWorkflowActionRequest({
      type: "report.preset.save",
      role,
      label,
      reportType: effectiveReportType,
      search: reportSearch,
      status: reportStatusFilter,
      rowCount: filteredRows.length,
    });
    setIsSavingPreset(false);
    if (!result.ok || !result.data) {
      toast.error("Preset was not saved", {
        description: result.error ?? "The server rejected this report view.",
      });
      return;
    }
    platformStore.setState(result.data.state);
    refresh();
    toast.success("Report view saved", { description: label });
  };
  const applyPreset = (preset: ReportPreset) => {
    setReportType(preset.reportType);
    setReportSearch(preset.search);
    setReportStatusFilter(preset.status);
    toast.info("Preset applied", { description: preset.label });
  };
  const sortReport = (key: ReportSortKey) => {
    if (reportSortKey === key) {
      setReportSortDirection(current => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setReportSortKey(key);
    setReportSortDirection(key === "metric" ? "desc" : "asc");
  };

  return (
    <div className="platform-report-workspace">
      <PlatformPageHeader
        compact
        context={<span>{roleMeta[role].label}</span>}
        title={reportPageTitle}
        description="Role-scoped attendance, certificate, enrollment, finance, and audit evidence for operational review."
        actions={
          <button
            type="button"
            className="platform-secondary-button"
            onClick={exportCsv}
          >
            <Download size={15} />
            Export CSV
          </button>
        }
      />
      <div className="platform-workflow-layout">
        <div className="platform-workflow-main">
          <AttendanceGovernancePanel
            state={state}
            classIds={reportAttendanceClassIds}
            title={
              role === "superadmin"
                ? "Platform attendance"
                : "Attendance governance"
            }
          />
          {role === "superadmin" || role === "headofdepartment" ? (
            <CertificateGovernancePanel
              state={state}
              certificateIds={reportCertificateIds}
              title={
                role === "superadmin"
                  ? "Platform certificates"
                  : "Certificate governance"
              }
            />
          ) : null}
          <section className="platform-workflow-card">
            <div className="platform-workflow-title">
              <span>
                <Activity size={16} /> Reports
              </span>
              <strong>{reportLabels[effectiveReportType]} report</strong>
            </div>
            <div className="platform-report-controls">
              <label>
                Report type
                <select
                  value={effectiveReportType}
                  onChange={event =>
                    setReportType(event.target.value as ReportType)
                  }
                >
                  {allowedReportTypes.map(value => (
                    <option key={value} value={value}>
                      {reportLabels[value]}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Search rows
                <input
                  value={reportSearch}
                  onChange={event => setReportSearch(event.target.value)}
                  placeholder="Search IDs, status, actor, student"
                />
              </label>
              <label>
                Status
                <select
                  value={reportStatusFilter}
                  onChange={event => setReportStatusFilter(event.target.value)}
                >
                  <option value="all">All statuses</option>
                  <option value="active">Active</option>
                  <option value="pending">Pending</option>
                  <option value="paid">Paid</option>
                  <option value="overdue">Overdue</option>
                  <option value="present">Present</option>
                  <option value="late">Late</option>
                  <option value="absent">Absent</option>
                  <option value="excused">Excused</option>
                </select>
              </label>
              <button
                type="button"
                onClick={savePreset}
                disabled={isSavingPreset}
              >
                {isSavingPreset ? "Saving..." : "Save view"}
              </button>
              <button type="button" onClick={exportCsv}>
                <Download size={15} />
                Export CSV
              </button>
            </div>
            <div className="platform-report-summary-band">
              <article>
                <small>Filtered rows</small>
                <strong>{filteredRows.length}</strong>
              </article>
              <article>
                <small>Exceptions</small>
                <strong>{exceptionRows}</strong>
              </article>
              <article>
                <small>Audit rows</small>
                <strong>{auditRows}</strong>
              </article>
              <article>
                <small>Export scope</small>
                <strong>{reportScopeLabel}</strong>
              </article>
            </div>
          </section>
          <section className="platform-workflow-card">
            <div className="platform-workflow-title">
              <span>
                <FileText size={16} /> Result rows
              </span>
              <strong>
                {filteredRows.length} of {rows.length}{" "}
                {reportLabels[effectiveReportType].toLowerCase()} rows
              </strong>
            </div>
            <div className="platform-report-table typed">
              <div className="platform-report-row header" role="row">
                <button
                  type="button"
                  onClick={() => sortReport("primary")}
                  aria-pressed={reportSortKey === "primary"}
                >
                  Record{" "}
                  {reportSortKey === "primary"
                    ? reportSortDirection === "asc"
                      ? "↑"
                      : "↓"
                    : ""}
                </button>
                <button
                  type="button"
                  onClick={() => sortReport("status")}
                  aria-pressed={reportSortKey === "status"}
                >
                  Status{" "}
                  {reportSortKey === "status"
                    ? reportSortDirection === "asc"
                      ? "↑"
                      : "↓"
                    : ""}
                </button>
                <button
                  type="button"
                  onClick={() => sortReport("metric")}
                  aria-pressed={reportSortKey === "metric"}
                >
                  Metric{" "}
                  {reportSortKey === "metric"
                    ? reportSortDirection === "asc"
                      ? "↑"
                      : "↓"
                    : ""}
                </button>
              </div>
              {filteredRows.length ? (
                displayRows.map((row, index) => (
                  <article
                    key={`${effectiveReportType}_${index}`}
                    className="platform-report-row"
                  >
                    <div className="platform-report-row-main">
                      <small>{row.eyebrow}</small>
                      <strong>{row.title}</strong>
                      <span>{row.subtitle}</span>
                    </div>
                    <span
                      className={`platform-report-status status-${row.status.replace(/\s+/g, "-")}`}
                    >
                      {row.status}
                    </span>
                    <div className="platform-report-row-metric">
                      <strong>{row.metric}</strong>
                      <span>{row.meta}</span>
                    </div>
                  </article>
                ))
              ) : (
                <article className="platform-report-row empty">
                  <span>
                    <strong>No rows</strong>
                    No report rows match this scope and filter.
                  </span>
                </article>
              )}
            </div>
          </section>
          <WorkflowAudit state={state} />
        </div>
        <aside className="platform-workflow-side">
          <MiniMetric
            label="Rows"
            value={`${filteredRows.length}/${rows.length}`}
          />
          <MiniMetric
            label="Courses"
            value={String(
              role === "teacher" ? teacherRunIds.size : state.courses.length
            )}
          />
          <MiniMetric
            label="Activity rows"
            value={String(filteredRows.filter(row => "actorId" in row).length)}
          />
          <MiniMetric
            label="Connections"
            value={String(state.integrations.length)}
          />
          <section className="platform-workflow-card">
            <div className="platform-workflow-title">
              <span>
                <ShieldCheck size={16} /> Saved views
              </span>
              <strong>{savedPresets.length} presets</strong>
            </div>
            <div className="platform-row-list compact">
              {savedPresets.map(preset => (
                <article key={preset.id}>
                  <div>
                    <strong>{preset.label}</strong>
                    <small>
                      {reportLabels[preset.reportType]} ·{" "}
                      {preset.status === "all" ? "all statuses" : preset.status}{" "}
                      · {preset.rowCount} row(s)
                    </small>
                  </div>
                  <button type="button" onClick={() => applyPreset(preset)}>
                    Apply
                  </button>
                </article>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

function AttendanceGovernancePanel({
  state,
  classIds,
  title,
}: {
  state: PlatformStateSnapshot;
  classIds?: Set<string>;
  title: string;
}) {
  const summary = getAttendanceSummary(state, classIds);
  const recentAudits = state.auditLogs
    .filter(
      audit =>
        audit.action === "attendance.saved" &&
        (!classIds || classIds.has(audit.entityId))
    )
    .slice(0, 4);
  const recentSessions = summary.sessions
    .slice()
    .sort(
      (a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime()
    )
    .slice(0, 6);
  const missingSessions = summary.sessions
    .filter(session => !isAttendanceSessionSaved(state, session))
    .sort(
      (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()
    )
    .slice(0, 4);

  return (
    <section className="platform-workflow-card platform-attendance-governance">
      <div className="platform-workflow-title">
        <span>
          <ClipboardCheck size={16} /> Attendance health
        </span>
        <strong>{title}</strong>
      </div>
      <div className="platform-attendance-health-grid">
        <MiniMetric
          label="Saved sessions"
          value={`${summary.savedSessions}/${summary.sessions.length}`}
        />
        <MiniMetric
          label="Pending sessions"
          value={String(summary.pendingSessions)}
        />
        <MiniMetric
          label="Roster records"
          value={`${summary.records.length}/${summary.expectedRecords}`}
        />
        <MiniMetric label="Completion" value={`${summary.completionRate}%`} />
      </div>
      <div className="platform-attendance-status-grid">
        {attendanceStatusOptions.map(status => (
          <article key={status}>
            <span className={`platform-attendance-chip ${status}`}>
              {attendanceStatusLabels[status]}
            </span>
            <strong>{summary.statusCounts[status]}</strong>
          </article>
        ))}
      </div>
      <div className="platform-attendance-governance-grid">
        <div className="platform-row-list compact platform-attendance-evidence-list">
          <div className="platform-attendance-list-heading">
            <strong>Session evidence</strong>
            <span>
              {missingSessions.length
                ? `${missingSessions.length} missing`
                : "all reviewed"}
            </span>
          </div>
          {recentSessions.length ? (
            recentSessions.map(session => {
              const group = state.classGroups.find(
                item => item.id === session.classGroupId
              );
              const run = state.courseRuns.find(
                item => item.id === group?.courseRunId
              );
              const teacher = state.users.find(
                item => item.id === run?.teacherId
              );
              const records = summary.records.filter(
                record =>
                  record.classGroupId === session.classGroupId &&
                  (record.sessionId === session.id ||
                    record.sessionId === session.eventId)
              );
              const sessionSaved = isAttendanceSessionSaved(state, session);
              return (
                <article key={session.id}>
                  <div>
                    <strong>{session.title}</strong>
                    <small>
                      {group?.name ?? "Class"} · {teacher?.name ?? "Teacher"} ·{" "}
                      {formatDateTime(session.startsAt)}
                    </small>
                  </div>
                  <span
                    className={`platform-attendance-chip ${sessionSaved ? "saved" : "pending"}`}
                  >
                    {sessionSaved ? `${records.length} saved` : "Missing"}
                  </span>
                </article>
              );
            })
          ) : (
            <article>
              <div>
                <strong>No sessions in scope</strong>
                <small>
                  Create sessions before attendance can be governed.
                </small>
              </div>
            </article>
          )}
        </div>
        <div className="platform-row-list compact platform-attendance-evidence-list">
          <div className="platform-attendance-list-heading">
            <strong>Audit evidence</strong>
            <span>{recentAudits.length} rows</span>
          </div>
          {recentAudits.length ? (
            recentAudits.map(audit => {
              const actor = state.users.find(user => user.id === audit.actorId);
              return (
                <article key={audit.id}>
                  <div>
                    <strong>{actor?.name ?? "System"} saved attendance</strong>
                    <small>
                      {audit.summary} · {formatDateTime(audit.createdAt)}
                    </small>
                  </div>
                  <span className="platform-attendance-chip saved">
                    Audited
                  </span>
                </article>
              );
            })
          ) : (
            <article>
              <div>
                <strong>No attendance audit rows</strong>
                <small>Saved attendance will appear here.</small>
              </div>
            </article>
          )}
        </div>
      </div>
    </section>
  );
}

function CertificateGovernancePanel({
  state,
  certificateIds,
  title,
}: {
  state: PlatformStateSnapshot;
  certificateIds?: Set<string>;
  title: string;
}) {
  const summary = getCertificateSummary(state, certificateIds);
  const recentCertificates = summary.certificates
    .slice()
    .sort((a, b) => {
      const rank = (certificate: Certificate) =>
        certificate.status === "pending_approval"
          ? 0
          : certificate.status === "approved"
            ? 1
            : certificate.status === "issued"
              ? 2
              : 3;
      return rank(a) - rank(b);
    })
    .slice(0, 4);

  return (
    <section className="platform-workflow-card platform-certificate-governance">
      <div className="platform-workflow-title">
        <span>
          <Award size={16} /> Certificate health
        </span>
        <strong>{title}</strong>
      </div>
      <div className="platform-attendance-health-grid">
        <MiniMetric
          label="Open"
          value={String(summary.statusCounts.pending_approval)}
        />
        <MiniMetric
          label="Approved"
          value={String(summary.statusCounts.approved)}
        />
        <MiniMetric
          label="Issued"
          value={String(summary.statusCounts.issued)}
        />
        <MiniMetric
          label="Rejected"
          value={String(summary.statusCounts.rejected)}
        />
      </div>
      <div className="platform-attendance-status-grid">
        {certificateStatusOptions.slice(0, 4).map(status => (
          <article key={status}>
            <span className={`platform-certificate-status ${status}`}>
              {certificateStatusLabels[status]}
            </span>
            <strong>{summary.statusCounts[status]}</strong>
          </article>
        ))}
      </div>
      <div className="platform-attendance-governance-grid">
        <div className="platform-row-list compact">
          {recentCertificates.length ? (
            recentCertificates.map(certificate => {
              const student = state.students.find(
                item => item.id === certificate.studentId
              );
              const user = state.users.find(
                item => item.id === student?.userId
              );
              const course = state.courses.find(
                item => item.id === certificate.courseId
              );
              return (
                <article key={certificate.id}>
                  <div>
                    <strong>{certificate.verificationCode}</strong>
                    <small>
                      {user?.name ?? "Student"} · {course?.title ?? "Course"} ·{" "}
                      grade {certificate.grade}%
                    </small>
                  </div>
                  <span
                    className={`platform-certificate-status ${certificate.status}`}
                  >
                    {certificateStatusLabels[certificate.status]}
                  </span>
                </article>
              );
            })
          ) : (
            <article>
              <div>
                <strong>No certificates in scope</strong>
                <small>
                  Eligible certificates will appear after grades and attendance
                  are ready.
                </small>
              </div>
            </article>
          )}
        </div>
        <div className="platform-row-list compact">
          {summary.recentAudits.length ? (
            summary.recentAudits.map(audit => (
              <article key={audit.id}>
                <div>
                  <strong>
                    {audit.action === "certificate.issued"
                      ? "Certificate issued"
                      : "Certificate approved"}
                  </strong>
                  <small>{audit.summary}</small>
                </div>
              </article>
            ))
          ) : (
            <article>
              <div>
                <strong>No certificate audit rows</strong>
                <small>Approval and issue actions will appear here.</small>
              </div>
            </article>
          )}
        </div>
      </div>
    </section>
  );
}

function IntegrationsWorkflow({ role, state }: WorkflowProps) {
  const integrations = useMemo(
    () => withRuntimeIntegrationStatus(state.integrations),
    [state.integrations]
  );
  const [activeId, setActiveId] = useState(integrations[0]?.id ?? "");
  const [lastCheck, setLastCheck] = useState<Record<string, string>>({});
  const active =
    integrations.find(integration => integration.id === activeId) ??
    integrations[0];

  const runLocalCheck = async () => {
    if (!active) return;

    const stamp = new Date().toLocaleTimeString();
    setLastCheck(current => ({ ...current, [active.id]: stamp }));

    if (active.id !== "supabase") {
      toast.success("Local integration check recorded", {
        description: `${active.label} remains in ${formatConnectionStatus(active.status)}.`,
      });
      return;
    }

    try {
      const result = await checkSupabaseBrowserConnection();
      const description = `REST status ${result.status}${result.projectRef ? ` · ${result.projectRef}` : ""} · ${result.keyMode} key`;
      if (result.ok) {
        toast.success("Supabase browser check passed", { description });
      } else {
        toast.error("Supabase responded but did not pass", { description });
      }
    } catch (error) {
      toast.error("Supabase browser check unavailable", {
        description:
          error instanceof Error
            ? error.message
            : "Check VITE_SUPABASE_URL and browser-safe key env vars.",
      });
    }
  };

  return (
    <div className="platform-workflow-layout">
      <div className="platform-workflow-main">
        <section className="platform-workflow-card">
          <div className="platform-workflow-title">
            <span>
              <Activity size={16} /> Provider registry
            </span>
            <strong>Connector readiness</strong>
          </div>
          <div className="platform-integration-grid">
            {integrations.map(integration => (
              <button
                key={integration.id}
                className={activeId === integration.id ? "active" : ""}
                onClick={() => setActiveId(integration.id)}
              >
                <strong>{integration.label}</strong>
                <span
                  className={`platform-integration-status ${integration.status === "connected" ? "green" : integration.status === "mock_mode" ? "amber" : integration.status === "error" ? "red" : "slate"}`}
                >
                  {formatConnectionStatus(integration.status)}
                </span>
                <small>
                  {integration.serverOnly
                    ? "Protected secrets"
                    : "Client visible"}
                </small>
              </button>
            ))}
          </div>
        </section>
        {active ? (
          <section className="platform-workflow-card">
            <div className="platform-workflow-title">
              <span>
                <ShieldCheck size={16} /> Setup details
              </span>
              <strong>{active.label}</strong>
            </div>
            <p>{active.notes}</p>
            <div className="platform-env-list">
              {active.envVars.map(envVar => (
                <code key={envVar}>{envVar}</code>
              ))}
            </div>
            <div className="platform-action-grid">
              <button onClick={runLocalCheck}>Run local check</button>
              <button disabled={active.status !== "connected"}>
                Start sync
              </button>
            </div>
          </section>
        ) : null}
      </div>
      <aside className="platform-workflow-side">
        <MiniMetric label="Providers" value={String(integrations.length)} />
        <MiniMetric
          label="Test mode"
          value={String(
            integrations.filter(item => item.status === "mock_mode").length
          )}
        />
        <MiniMetric
          label="Connected"
          value={String(
            integrations.filter(item => item.status === "connected").length
          )}
        />
        <section className="platform-workflow-card">
          <div className="platform-workflow-title">
            <span>
              <FileText size={16} /> Check log
            </span>
            <strong>Local only</strong>
          </div>
          <div className="platform-row-list compact">
            {Object.entries(lastCheck).length ? (
              Object.entries(lastCheck).map(([id, stamp]) => (
                <article key={id}>
                  <div>
                    <strong>
                      {integrations.find(item => item.id === id)?.label ?? id}
                    </strong>
                    <small>Checked at {stamp}</small>
                  </div>
                </article>
              ))
            ) : (
              <article>
                <div>
                  <strong>No checks yet</strong>
                  <small>Run a local check from any provider.</small>
                </div>
              </article>
            )}
          </div>
          <p style={{ borderTop: "1px solid var(--border)", paddingTop: 10 }}>
            Real sync jobs stay disabled until protected credentials and queues
            are connected.
          </p>
        </section>
      </aside>
    </div>
  );
}

function ScheduleBoard({
  state,
  events,
  limit = 6,
  emptyText,
}: {
  state: WorkflowProps["state"];
  events: ScheduleBoardEvent[];
  limit?: number;
  emptyText: string;
}) {
  const visibleEvents = events
    .filter(event => event.startsAt)
    .slice()
    .sort(
      (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()
    )
    .slice(0, limit);
  const buckets = visibleEvents.reduce<
    Array<{ key: string; label: string; events: ScheduleBoardEvent[] }>
  >((items, event) => {
    const date = new Date(event.startsAt);
    const key = date.toISOString().slice(0, 10);
    const existing = items.find(item => item.key === key);
    const label = date.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
    if (existing) {
      existing.events.push(event);
      return items;
    }
    return [...items, { key, label, events: [event] }];
  }, []);

  return (
    <section className="platform-workflow-card">
      <div className="platform-workflow-title">
        <span>
          <CalendarDays size={16} /> Schedule board
        </span>
        <strong>{visibleEvents.length} visible</strong>
      </div>
      <div className="platform-calendar-grid stateful">
        {buckets.length ? (
          buckets.map(bucket => (
            <div key={bucket.key}>
              <strong>{bucket.label}</strong>
              {bucket.events.map(event => {
                const room = state.rooms.find(item => item.id === event.roomId);
                const classGroup = state.classGroups.find(
                  item => item.id === event.classGroupId
                );
                return (
                  <article
                    key={event.id}
                    className={event.status === "pending" ? "warning" : ""}
                  >
                    <span>
                      {new Date(event.startsAt).toLocaleTimeString(undefined, {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    <p>{event.title}</p>
                    <small>
                      {schedulerTypeLabels[event.type as CalendarEventType] ??
                        event.type}
                      {room ? ` · ${room.name}` : ""}
                      {classGroup ? ` · ${classGroup.name}` : ""}
                    </small>
                  </article>
                );
              })}
            </div>
          ))
        ) : (
          <div className="platform-empty-state">
            <CalendarDays size={18} />
            <strong>No scheduled dates</strong>
            <span>{emptyText}</span>
          </div>
        )}
      </div>
    </section>
  );
}

function EventList({
  state,
  events = state.events,
  limit = 5,
  emptyText = "Create an event or adjust the role filters.",
}: {
  state: WorkflowProps["state"];
  events?: WorkflowProps["state"]["events"];
  limit?: number;
  emptyText?: string;
}) {
  return (
    <section className="platform-workflow-card">
      <div className="platform-workflow-title">
        <span>
          <CalendarDays size={16} /> Calendar
        </span>
        <strong>Upcoming events</strong>
      </div>
      <div className="platform-row-list">
        {events.length ? (
          events
            .slice()
            .sort(
              (a, b) =>
                new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()
            )
            .slice(0, limit)
            .map(event => (
              <article key={event.id}>
                <div>
                  <strong>{event.title}</strong>
                  <small>
                    {event.type} · {new Date(event.startsAt).toLocaleString()}
                  </small>
                </div>
                <span>{event.status}</span>
              </article>
            ))
        ) : (
          <article>
            <div>
              <strong>No events in scope</strong>
              <small>{emptyText}</small>
            </div>
            <span>empty</span>
          </article>
        )}
      </div>
    </section>
  );
}

function MessageList({
  state,
  messages = state.messages,
}: {
  state: WorkflowProps["state"];
  messages?: WorkflowProps["state"]["messages"];
}) {
  return (
    <section className="platform-workflow-card">
      <div className="platform-workflow-title">
        <span>
          <MessageSquare size={16} /> Threads
        </span>
        <strong>Recent messages</strong>
      </div>
      <div className="platform-row-list">
        {messages.slice(0, 5).map(message => (
          <article key={message.id}>
            <div>
              <strong>{message.subject}</strong>
              <small>{message.body}</small>
            </div>
            <span>{message.read ? "read" : "unread"}</span>
          </article>
        ))}
      </div>
    </section>
  );
}

function WorkflowAudit({ state }: { state: WorkflowProps["state"] }) {
  return (
    <section className="platform-workflow-card">
      <div className="platform-workflow-title">
        <span>
          <ShieldCheck size={16} /> Activity
        </span>
        <strong>Latest activity</strong>
      </div>
      <div className="platform-row-list compact">
        {state.auditLogs.slice(0, 4).map(audit => (
          <article key={audit.id}>
            <div>
              <strong>{audit.action}</strong>
              <small>{audit.summary}</small>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <article className="platform-mini-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}
