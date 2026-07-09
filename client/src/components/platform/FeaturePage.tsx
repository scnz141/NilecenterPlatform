import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { motion } from "framer-motion";
import { z } from "zod";
import { Link } from "wouter";
import {
  Activity,
  ArrowRight,
  AlertCircle,
  AlertTriangle,
  Bell,
  BookOpen,
  Building2,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  CreditCard,
  Database,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  FileText,
  FileQuestion,
  Filter,
  Headphones,
  KeyRound,
  Layers,
  LifeBuoy,
  Link2,
  Megaphone,
  MessageSquare,
  MonitorPlay,
  Play,
  Plus,
  Puzzle,
  RefreshCcw,
  Search,
  Send,
  Server,
  ShieldCheck,
  SlidersHorizontal,
  UserCircle,
  UserPlus,
  Users,
  Video,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  runPlatformWorkflowActionRequest,
  saveBackendRecord,
} from "@/lib/backend/api";
import {
  getDemoUser,
  getPageConfig,
  roleMeta,
  roleOrder,
  rolePermissions,
  type PageConfig,
  type Permission,
  type RecordItem,
  type Role,
  type Stat,
} from "@/lib/platformData";
import { platformStore } from "@/lib/domain/store";
import type { PlatformWorkflowAction } from "@/lib/domain/actions";
import { getMoodleSourceCourseSnapshot } from "@/lib/moodle/client";
import type {
  AttendanceStatus,
  CalendarEventType,
  Certificate,
  EntityStatus,
  IntegrationConfig,
  IntegrationStatus,
  Lead,
  Payment,
  StaffAvailabilityStatus,
  StaffPermissionScope,
  StaffRole,
  StudentStatus,
} from "@/lib/domain/types";
import type {
  MoodleActivity,
  MoodleActivityType,
  MoodleSection,
} from "@/lib/moodle/types";
import PlatformShell from "./PlatformShell";
import {
  PlatformWorkspaceHeader,
  StatusBadge,
  DataTableCard,
} from "./PlatformPrimitives";
import { ListPage, getPageTypeForKind } from "./PageTypes";
import StatefulWorkflowExperience, {
  isStatefulWorkflowPage,
} from "./WorkflowExperiences";

const toneColor: Record<Stat["tone"], string> = {
  teal: "#1A4A3A",
  amber: "#C4A35A",
  green: "#2D5016",
  red: "#C75B39",
  purple: "#3D1A5C",
  slate: "#1A1A1A",
};

function formatConnectionStatus(status: string) {
  return status === "mock_mode" ? "Test mode" : status.replace("_", " ");
}

type FeaturePageProps = {
  role: Role;
  pageId: string;
  params?: Record<string, string | undefined>;
};

export default function FeaturePage({
  role,
  pageId,
  params,
}: FeaturePageProps) {
  const config = getPageConfig(role, pageId);

  if (role === "student" && studentAccountPages.has(pageId)) {
    return (
      <PlatformShell role={role} title={config.title}>
        <StudentAccountExperience pageId={pageId} />
      </PlatformShell>
    );
  }

  if (role === "superadmin" && adminAccessPages.has(pageId)) {
    return (
      <PlatformShell role={role} title={config.title}>
        <AdminAccessExperience pageId={pageId} params={params} />
      </PlatformShell>
    );
  }

  if (role === "superadmin" && adminSystemPages.has(pageId)) {
    return (
      <PlatformShell role={role} title={config.title}>
        <AdminSystemExperience pageId={pageId} />
      </PlatformShell>
    );
  }

  if (role === "superadmin" && adminAcademicPages.has(pageId)) {
    return (
      <PlatformShell role={role} title={config.title}>
        <SuperAdminAcademicExperience pageId={pageId} />
      </PlatformShell>
    );
  }

  if (
    role === "registrar" &&
    pageId !== "schedule" &&
    registrarAdmissionsPages.has(pageId)
  ) {
    return (
      <PlatformShell role={role} title={config.title}>
        <RegistrarAdmissionsExperience pageId={pageId} params={params} />
      </PlatformShell>
    );
  }

  if (role === "headofdepartment" && pageId === "certificates") {
    return (
      <PlatformShell role={role} title={config.title}>
        <StatefulWorkflowExperience
          config={config}
          role={role}
          pageId={pageId}
          params={params}
        />
      </PlatformShell>
    );
  }

  if (config.kind === "certificate") {
    return (
      <PlatformShell role={role} title={config.title}>
        <StatefulWorkflowExperience
          config={config}
          role={role}
          pageId={pageId}
          params={params}
        />
      </PlatformShell>
    );
  }

  if (config.kind === "attendance") {
    return (
      <PlatformShell role={role} title={config.title}>
        <StatefulWorkflowExperience
          config={config}
          role={role}
          pageId={pageId}
          params={params}
        />
      </PlatformShell>
    );
  }

  if (config.kind === "assessment") {
    return (
      <PlatformShell role={role} title={config.title}>
        <StatefulWorkflowExperience
          config={config}
          role={role}
          pageId={pageId}
          params={params}
        />
      </PlatformShell>
    );
  }

  if (role === "teacher" && config.kind === "quran") {
    return (
      <PlatformShell role={role} title={config.title}>
        <StatefulWorkflowExperience
          config={config}
          role={role}
          pageId={pageId}
          params={params}
        />
      </PlatformShell>
    );
  }

  if (
    role === "headofdepartment" &&
    (pageId === "reports" || pageId === "assessments")
  ) {
    return (
      <PlatformShell role={role} title={config.title}>
        <StatefulWorkflowExperience
          config={config}
          role={role}
          pageId={pageId}
          params={params}
        />
      </PlatformShell>
    );
  }

  if (role === "headofdepartment" && academicGovernancePages.has(pageId)) {
    return (
      <PlatformShell role={role} title={config.title}>
        <AcademicGovernanceExperience pageId={pageId} scope="hod" />
      </PlatformShell>
    );
  }

  if (config.kind === "calendar") {
    return (
      <PlatformShell role={role} title={config.title}>
        <StatefulWorkflowExperience
          config={config}
          role={role}
          pageId={pageId}
          params={params}
        />
      </PlatformShell>
    );
  }

  if (role === "branchadmin" && pageId === "schedule") {
    return (
      <PlatformShell role={role} title={config.title}>
        <StatefulWorkflowExperience
          config={config}
          role={role}
          pageId={pageId}
          params={params}
        />
      </PlatformShell>
    );
  }

  if (role === "branchadmin" && pageId === "reports") {
    return (
      <PlatformShell role={role} title={config.title}>
        <StatefulWorkflowExperience
          config={config}
          role={role}
          pageId={pageId}
          params={params}
        />
      </PlatformShell>
    );
  }

  if (role === "branchadmin" && branchOperationsPages.has(pageId)) {
    return (
      <PlatformShell role={role} title={config.title}>
        <BranchOperationsExperience pageId={pageId} />
      </PlatformShell>
    );
  }

  if (role === "registrar" && pageId === "schedule") {
    return (
      <PlatformShell role={role} title={config.title}>
        <StatefulWorkflowExperience
          config={config}
          role={role}
          pageId={pageId}
          params={params}
        />
      </PlatformShell>
    );
  }

  if (role === "registrar" && registrarAdmissionsPages.has(pageId)) {
    return (
      <PlatformShell role={role} title={config.title}>
        <RegistrarAdmissionsExperience pageId={pageId} params={params} />
      </PlatformShell>
    );
  }

  if (role === "teacher" && teacherDeliveryPages.has(pageId)) {
    return (
      <PlatformShell role={role} title={config.title}>
        <TeacherDeliveryExperience pageId={pageId} params={params} />
      </PlatformShell>
    );
  }

  if (config.kind === "messages") {
    return (
      <PlatformShell role={role} title={config.title}>
        <ListPage
          config={config}
          title={config.title}
          description="Send and manage role-based conversations."
          showMetrics={false}
        >
          <StatefulWorkflowExperience
            config={config}
            role={role}
            pageId={pageId}
            params={params}
          />
        </ListPage>
      </PlatformShell>
    );
  }

  const PageType = getPageTypeForKind(config.kind);

  return (
    <PlatformShell role={role} title={config.title}>
      <PageType
        config={config}
        title={params ? decorateTitle(config.title, params) : config.title}
        description={config.description}
        actions={
          <>
            <button
              className="platform-secondary-button"
              onClick={() => toast.info(config.secondaryAction ?? "Opened")}
            >
              <Download size={15} />
              {config.secondaryAction}
            </button>
            <button
              className="platform-primary-button"
              style={{ background: roleMeta[role].color }}
              onClick={() => toast.success(`${config.primaryAction} started`)}
            >
              <Plus size={15} />
              {config.primaryAction}
            </button>
          </>
        }
      >
        <KindExperience
          config={config}
          role={role}
          pageId={pageId}
          params={params}
        />
      </PageType>
    </PlatformShell>
  );
}

function KindExperience({
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
  if (role === "student" && studentAccountPages.has(pageId))
    return <StudentAccountExperience pageId={pageId} />;
  if (role === "superadmin" && adminAccessPages.has(pageId))
    return <AdminAccessExperience pageId={pageId} params={params} />;
  if (role === "superadmin" && adminSystemPages.has(pageId))
    return <AdminSystemExperience pageId={pageId} />;
  if (role === "superadmin" && adminAcademicPages.has(pageId))
    return <SuperAdminAcademicExperience pageId={pageId} />;
  if (role === "headofdepartment" && pageId === "assessments") {
    return (
      <StatefulWorkflowExperience
        config={config}
        role={role}
        pageId={pageId}
        params={params}
      />
    );
  }
  if (role === "headofdepartment" && academicGovernancePages.has(pageId))
    return <AcademicGovernanceExperience pageId={pageId} scope="hod" />;
  if (role === "branchadmin" && branchOperationsPages.has(pageId))
    return <BranchOperationsExperience pageId={pageId} />;
  if (role === "registrar" && registrarAdmissionsPages.has(pageId))
    return <RegistrarAdmissionsExperience pageId={pageId} params={params} />;
  if (role === "teacher" && teacherDeliveryPages.has(pageId))
    return <TeacherDeliveryExperience pageId={pageId} params={params} />;
  if (isStatefulWorkflowPage(role, pageId, config.kind)) {
    return (
      <StatefulWorkflowExperience
        config={config}
        role={role}
        pageId={pageId}
        params={params}
      />
    );
  }
  if (config.kind === "moodle")
    return <MoodleSourceExperience config={config} role={role} />;
  if (config.kind === "quran")
    return <QuranExperience config={config} role={role} />;
  if (config.kind === "calendar")
    return <CalendarExperience config={config} role={role} />;
  if (config.kind === "assessment")
    return <AssessmentExperience config={config} role={role} />;
  if (config.kind === "attendance")
    return <AttendanceExperience config={config} role={role} />;
  if (config.kind === "certificate")
    return <CertificateExperience config={config} role={role} />;
  if (config.kind === "report")
    return <ReportExperience config={config} role={role} />;
  if (config.kind === "messages")
    return <MessagesExperience config={config} role={role} />;
  if (
    config.kind === "profile" ||
    config.kind === "settings" ||
    config.kind === "support" ||
    config.kind === "form"
  ) {
    return <FormAndPanels config={config} role={role} />;
  }
  return <ListExperience config={config} role={role} />;
}

const studentAccountPages = new Set(["profile", "support"]);
const adminAccessPages = new Set([
  "users",
  "user-detail",
  "roles",
  "permissions",
  "branches",
]);
const adminSystemPages = new Set([
  "settings",
  "integrations",
  "audit-logs",
  "system-health",
]);
const adminAcademicPages = new Set(["departments", "programs", "courses"]);
const academicGovernancePages = new Set([
  "departments",
  "programs",
  "courses",
  "levels",
  "curriculum",
  "teachers",
  "classes",
  "assessments",
  "certificates",
  "reports",
  "messages",
]);
const branchOperationsPages = new Set([
  "students",
  "teachers",
  "classes",
  "rooms",
  "schedule",
  "attendance",
  "payments",
  "reports",
  "messages",
  "settings",
]);
const registrarAdmissionsPages = new Set([
  "leads",
  "lead-detail",
  "applications",
  "application-detail",
  "students",
  "student-detail",
  "placement-tests",
  "placement-detail",
  "enrollments",
  "classes",
  "schedule",
  "payments",
  "settings",
]);
const teacherDeliveryPages = new Set([
  "classes",
  "class-detail",
  "sessions",
  "students",
  "materials",
  "assignments",
  "assignment-detail",
  "grading",
  "quizzes",
  "question-bank",
]);
const allPermissions = Array.from(
  new Set(Object.values(rolePermissions).flat())
) as Permission[];

function formatPermission(permission: Permission) {
  return permission
    .split(":")
    .map(part => part.replace(/_/g, " "))
    .join(" / ");
}

function getDefaultDueAt(daysFromNow = 1) {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  date.setHours(18, 0, 0, 0);
  return date.toISOString();
}

function clonePlatformState() {
  return JSON.parse(JSON.stringify(platformStore.getState())) as ReturnType<
    typeof platformStore.getState
  >;
}

function splitListInput(value: string) {
  return value
    .split(/[,\n]/)
    .map(item => item.trim())
    .filter(Boolean);
}

function isMinorAgeGroup(ageGroup: string) {
  const normalized = ageGroup.trim().toLowerCase();
  return Boolean(
    normalized && !/adult|18\+|university|parent not required/.test(normalized)
  );
}

function StudentAccountExperience({ pageId }: { pageId: string }) {
  const [version, setVersion] = useState(0);
  const state = useMemo(() => platformStore.getState(), [version]);
  const refresh = () => setVersion(value => value + 1);
  const student =
    state.students.find(item => item.id === "stu_demo") ?? state.students[0];
  const user =
    state.users.find(item => item.id === student?.userId) ??
    getDemoUser("student");
  const [profileDraft, setProfileDraft] = useState({
    name: user.name,
    email: user.email,
    country: student?.country ?? "Egypt",
    preferredLanguage: student?.preferredLanguage ?? "English",
    timezone: student?.timezone ?? "Africa/Cairo",
  });
  const [ticketDraft, setTicketDraft] = useState({
    subject: "Need help with class recording",
    priority: "normal" as "low" | "normal" | "high" | "urgent",
  });
  const enrollments = state.enrollments.filter(
    item => item.studentId === student?.id
  );
  const tickets = state.supportTickets.filter(
    ticket => ticket.requesterId === user.id
  );
  const notifications = state.notifications.filter(
    notification => notification.userId === user.id
  );
  const documents = state.documents.filter(
    document => document.ownerId === student?.id
  );
  const invoices = state.invoices.filter(
    invoice => invoice.studentId === student?.id
  );
  const unreadCount = notifications.filter(
    notification => !notification.read
  ).length;
  const openTickets = tickets.filter(
    ticket => ticket.status !== "completed" && ticket.status !== "cancelled"
  ).length;
  const focusCopy =
    pageId === "support" ? "Student support" : "Student profile";

  const saveProfile = (event: React.FormEvent) => {
    event.preventDefault();
    const next = clonePlatformState();
    next.users = next.users.map(item =>
      item.id === user.id
        ? {
            ...item,
            name: profileDraft.name.trim() || item.name,
            email: profileDraft.email.trim() || item.email,
          }
        : item
    );
    next.students = next.students.map(item =>
      item.id === student.id
        ? {
            ...item,
            country: profileDraft.country.trim() || item.country,
            preferredLanguage: profileDraft.preferredLanguage,
            timezone: profileDraft.timezone.trim() || item.timezone,
          }
        : item
    );
    platformStore.setState(next);
    platformStore.audit(
      "profile.updated",
      "StudentProfile",
      student.id,
      `Updated profile for ${profileDraft.name.trim() || user.name}.`,
      user.id
    );
    refresh();
    toast.success("Profile saved locally");
  };

  const createTicket = (event: React.FormEvent) => {
    event.preventDefault();
    if (!ticketDraft.subject.trim()) {
      toast.error("Ticket subject is required");
      return;
    }
    const next = clonePlatformState();
    const id = `ticket_${Date.now().toString(36)}`;
    next.supportTickets = [
      {
        id,
        requesterId: user.id,
        subject: ticketDraft.subject.trim(),
        status: "pending",
        priority: ticketDraft.priority,
        lastUpdatedAt: new Date().toISOString(),
      },
      ...next.supportTickets,
    ];
    platformStore.setState(next);
    platformStore.audit(
      "support.ticket_created",
      "SupportTicket",
      id,
      `Created support ticket: ${ticketDraft.subject.trim()}.`,
      user.id
    );
    setTicketDraft({ subject: "", priority: "normal" });
    refresh();
    toast.success("Support ticket created", { description: id });
  };

  const markNotificationRead = (notificationId: string) => {
    platformStore.markNotificationRead(notificationId);
    refresh();
  };

  return (
    <div className="student-account-workspace">
      <PlatformWorkspaceHeader
        className="student-account-hero"
        title="Student account"
        description="Keep learning details, support requests, notices, and documents connected to one student account."
        context={<span>{focusCopy}</span>}
        actionsClassName="student-account-nav"
        actions={
          <>
            <Link
              href="/app/student/profile"
              className={pageId === "profile" ? "active" : ""}
              aria-current={pageId === "profile" ? "page" : undefined}
            >
              <UserCircle size={15} />
              Profile
            </Link>
            <Link
              href="/app/student/support"
              className={pageId === "support" ? "active" : ""}
              aria-current={pageId === "support" ? "page" : undefined}
            >
              <LifeBuoy size={15} />
              Support
            </Link>
          </>
        }
      />

      <div className="student-account-kpis">
        <AdminAccessMetric label="Courses" value={String(enrollments.length)} />
        <AdminAccessMetric label="Open tickets" value={String(openTickets)} />
        <AdminAccessMetric label="Unread" value={String(unreadCount)} />
        <AdminAccessMetric label="Documents" value={String(documents.length)} />
      </div>

      <div className="student-account-layout">
        <section className="student-account-panel wide">
          {pageId === "profile" ? (
            <>
              <div className="student-account-panel-head">
                <div>
                  <span>Account profile</span>
                  <strong>{user.name}</strong>
                </div>
                <UserCircle size={18} />
              </div>
              <form className="student-profile-form" onSubmit={saveProfile}>
                <label>
                  Full name
                  <input
                    value={profileDraft.name}
                    onChange={event =>
                      setProfileDraft(value => ({
                        ...value,
                        name: event.target.value,
                      }))
                    }
                  />
                </label>
                <label>
                  Email
                  <input
                    type="email"
                    value={profileDraft.email}
                    onChange={event =>
                      setProfileDraft(value => ({
                        ...value,
                        email: event.target.value,
                      }))
                    }
                  />
                </label>
                <label>
                  Country
                  <input
                    value={profileDraft.country}
                    onChange={event =>
                      setProfileDraft(value => ({
                        ...value,
                        country: event.target.value,
                      }))
                    }
                  />
                </label>
                <label>
                  Preferred language
                  <select
                    value={profileDraft.preferredLanguage}
                    onChange={event =>
                      setProfileDraft(value => ({
                        ...value,
                        preferredLanguage: event.target.value,
                      }))
                    }
                  >
                    <option>English</option>
                    <option>Arabic</option>
                    <option>Turkish</option>
                    <option>Russian</option>
                  </select>
                </label>
                <label>
                  Timezone
                  <input
                    value={profileDraft.timezone}
                    onChange={event =>
                      setProfileDraft(value => ({
                        ...value,
                        timezone: event.target.value,
                      }))
                    }
                  />
                </label>
                <button type="submit">
                  <ShieldCheck size={15} />
                  Save profile
                </button>
              </form>
              <div className="student-account-row-list">
                {enrollments.map(enrollment => {
                  const run = state.courseRuns.find(
                    item => item.id === enrollment.courseRunId
                  );
                  const course = state.courses.find(
                    item => item.id === run?.courseId
                  );
                  return (
                    <article key={enrollment.id}>
                      <div>
                        <strong>
                          {course?.title ?? enrollment.courseRunId}
                        </strong>
                        <small>
                          {enrollment.status} · progress {enrollment.progress}%
                          · grade {enrollment.currentGrade}%
                        </small>
                      </div>
                      <Link
                        href={`/app/student/courses/${course?.id ?? run?.id ?? enrollment.courseRunId}`}
                      >
                        Open
                      </Link>
                    </article>
                  );
                })}
              </div>
            </>
          ) : (
            <>
              <div className="student-account-panel-head">
                <div>
                  <span>Support center</span>
                  <strong>{tickets.length} ticket(s)</strong>
                </div>
                <LifeBuoy size={18} />
              </div>
              <form className="student-support-form" onSubmit={createTicket}>
                <label>
                  Request subject
                  <input
                    value={ticketDraft.subject}
                    onChange={event =>
                      setTicketDraft(value => ({
                        ...value,
                        subject: event.target.value,
                      }))
                    }
                    placeholder="What do you need help with?"
                  />
                </label>
                <label>
                  Priority
                  <select
                    value={ticketDraft.priority}
                    onChange={event =>
                      setTicketDraft(value => ({
                        ...value,
                        priority: event.target
                          .value as typeof ticketDraft.priority,
                      }))
                    }
                  >
                    <option value="low">Low</option>
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </label>
                <button type="submit">
                  <Send size={15} />
                  Create ticket
                </button>
              </form>
              <div className="student-account-row-list">
                {tickets.map(ticket => (
                  <article key={ticket.id}>
                    <div>
                      <strong>{ticket.subject}</strong>
                      <small>
                        {ticket.priority} priority · {ticket.status} ·{" "}
                        {new Date(ticket.lastUpdatedAt).toLocaleString()}
                      </small>
                    </div>
                    <span>{ticket.status}</span>
                  </article>
                ))}
              </div>
            </>
          )}
        </section>

        <aside className="student-account-side">
          <section className="student-account-panel">
            <div className="student-account-panel-head">
              <div>
                <span>Notifications</span>
                <strong>{unreadCount} unread</strong>
              </div>
              <Bell size={18} />
            </div>
            <div className="student-account-notices">
              {notifications.map(notification => (
                <button
                  key={notification.id}
                  className={notification.read ? "read" : ""}
                  onClick={() => markNotificationRead(notification.id)}
                >
                  <strong>{notification.title}</strong>
                  <small>{notification.body}</small>
                </button>
              ))}
            </div>
          </section>

          <section className="student-account-panel">
            <div className="student-account-panel-head">
              <div>
                <span>Documents and billing</span>
                <strong>{documents.length + invoices.length} item(s)</strong>
              </div>
              <FileText size={18} />
            </div>
            <div className="student-account-row-list compact">
              {documents.map(document => (
                <article key={document.id}>
                  <div>
                    <strong>{document.title}</strong>
                    <small>
                      {document.type} · {document.status}
                    </small>
                  </div>
                  <span>{document.status}</span>
                </article>
              ))}
              {invoices.map(invoice => (
                <article key={invoice.id}>
                  <div>
                    <strong>{invoice.id}</strong>
                    <small>
                      {invoice.currency} {invoice.amount} · due {invoice.dueAt}
                    </small>
                  </div>
                  <span>{invoice.status}</span>
                </article>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

const staffRoleOptions = roleOrder.filter(
  (role): role is StaffRole => role !== "student"
);

const staffRoleDefaults: Record<
  StaffRole,
  {
    branchId: string;
    departmentId: string;
    permissionScope: StaffPermissionScope;
    subjects: string;
    teachingLevels: string;
    availabilityStatus: StaffAvailabilityStatus;
    operationalScope: string;
  }
> = {
  teacher: {
    branchId: "br_online",
    departmentId: "dep_arabic",
    permissionScope: "department",
    subjects: "Arabic grammar, Tajweed",
    teachingLevels: "Arabic Level 3",
    availabilityStatus: "available",
    operationalScope: "classes, attendance, grading",
  },
  registrar: {
    branchId: "br_cairo",
    departmentId: "dep_admissions",
    permissionScope: "admissions",
    subjects: "",
    teachingLevels: "",
    availabilityStatus: "not_applicable",
    operationalScope: "leads, placement, enrollments, payments",
  },
  headofdepartment: {
    branchId: "br_global",
    departmentId: "dep_arabic",
    permissionScope: "department",
    subjects: "",
    teachingLevels: "Arabic Language, Quran and Tajweed",
    availabilityStatus: "not_applicable",
    operationalScope: "curriculum, teachers, certificates, reports",
  },
  branchadmin: {
    branchId: "br_cairo",
    departmentId: "dep_operations",
    permissionScope: "operations",
    subjects: "",
    teachingLevels: "",
    availabilityStatus: "not_applicable",
    operationalScope: "rooms, schedule, attendance, payments",
  },
  superadmin: {
    branchId: "br_global",
    departmentId: "dep_platform",
    permissionScope: "global",
    subjects: "",
    teachingLevels: "",
    availabilityStatus: "not_applicable",
    operationalScope: "users, roles, permissions, audit",
  },
};

function AdminAccessExperience({
  pageId,
  params,
}: {
  pageId: string;
  params?: Record<string, string | undefined>;
}) {
  const [version, setVersion] = useState(0);
  const [query, setQuery] = useState("");
  const [selectedRole, setSelectedRole] = useState<Role>("teacher");
  const [selectedUserId, setSelectedUserId] = useState(
    params?.userId ?? "usr_teacher_demo"
  );
  const [creatingAccount, setCreatingAccount] = useState(false);
  const [createAccountError, setCreateAccountError] = useState("");
  const [assigningTeacher, setAssigningTeacher] = useState(false);
  const [teacherAssignError, setTeacherAssignError] = useState("");
  const [teacherAssignStatus, setTeacherAssignStatus] = useState("");
  const [savingAccess, setSavingAccess] = useState(false);
  const [accessUpdateError, setAccessUpdateError] = useState("");
  const [savingGovernance, setSavingGovernance] = useState(false);
  const [governanceUpdateError, setGovernanceUpdateError] = useState("");
  const [teacherAssignmentDraft, setTeacherAssignmentDraft] = useState({
    courseRunId: "",
    departmentId: "",
    specialties: "",
    availability: "",
  });
  const [newUser, setNewUser] = useState({
    name: "",
    email: "",
    phone: "",
    role: "teacher" as StaffRole,
    branchId: staffRoleDefaults.teacher.branchId,
    departmentId: staffRoleDefaults.teacher.departmentId,
    status: "active" as EntityStatus,
    permissionScope: staffRoleDefaults.teacher.permissionScope,
    subjects: staffRoleDefaults.teacher.subjects,
    teachingLevels: staffRoleDefaults.teacher.teachingLevels,
    availabilityStatus: staffRoleDefaults.teacher.availabilityStatus,
    operationalScope: staffRoleDefaults.teacher.operationalScope,
    notes: "",
  });
  const state = useMemo(() => platformStore.getState(), [version]);
  const refresh = () => setVersion(value => value + 1);
  const actorId = getDemoUser("superadmin").id;
  const isRole = (value: unknown): value is Role =>
    typeof value === "string" && value in roleMeta;
  const safeRole = (value: unknown, fallback: Role = "teacher"): Role =>
    isRole(value) ? value : fallback;
  const safeStaffRole = (
    value: unknown,
    fallback: StaffRole = "teacher"
  ): StaffRole => {
    const role = safeRole(value, fallback);
    return role === "student" ? fallback : role;
  };
  const metaForRole = (role?: Role) => roleMeta[safeRole(role)];
  const selectedRoleMeta = metaForRole(selectedRole);
  const draftRoleMeta = metaForRole(newUser.role);
  const selectedUser =
    state.users.find(user => user.id === selectedUserId) ?? state.users[0];
  const selectedUserMeta = metaForRole(selectedUser?.activeRole);
  const activeBranch = state.branches.find(
    branch => branch.id === selectedUser?.branchId
  );
  const activeDepartment = state.departments.find(
    department => department.id === selectedUser?.departmentId
  );
  const visibleUsers = state.users.filter(user => {
    const branch = state.branches.find(item => item.id === user.branchId);
    const department = state.departments.find(
      item => item.id === user.departmentId
    );
    const text =
      `${user.name} ${user.email} ${user.activeRole} ${branch?.name ?? ""} ${department?.name ?? ""}`.toLowerCase();
    return text.includes(query.toLowerCase());
  });
  const permissionCoverage = Math.round(
    ((state.permissions[selectedRole] ?? []).length / allPermissions.length) *
      100
  );
  const activeUsers = state.users.filter(
    user => user.status === "active"
  ).length;
  const selectedRoleUsers = state.users.filter(user =>
    user.roles.includes(selectedRole)
  ).length;
  const draftBranch = state.branches.find(
    branch => branch.id === newUser.branchId
  );
  const draftDepartment = state.departments.find(
    department => department.id === newUser.departmentId
  );
  const selectedStaffProfile = selectedUser
    ? (state.staffProfiles.find(
        profile =>
          profile.userId === selectedUser.id &&
          profile.role === selectedUser.activeRole
      ) ??
      state.staffProfiles.find(profile => profile.userId === selectedUser.id))
    : undefined;
  const selectedStaffBranches = selectedStaffProfile?.branchIds
    .map(
      branchId => state.branches.find(branch => branch.id === branchId)?.name
    )
    .filter(Boolean)
    .join(", ");
  const selectedStaffDepartments = selectedStaffProfile?.departmentIds
    .map(
      departmentId =>
        state.departments.find(department => department.id === departmentId)
          ?.name
    )
    .filter(Boolean)
    .join(", ");
  const selectedPermissionSummary = selectedUser
    ? (state.permissions[selectedUser.activeRole] ?? [])
    : [];
  const selectedUserAuditRows = selectedUser
    ? state.auditLogs
        .filter(
          audit =>
            audit.entityId === selectedUser.id ||
            audit.actorId === selectedUser.id ||
            audit.summary.includes(selectedUser.name)
        )
        .slice(0, 4)
    : [];
  const selectedTeacherProfile = selectedUser
    ? state.teachers.find(teacher => teacher.userId === selectedUser.id)
    : undefined;
  const selectedTeacherRuns = selectedUser
    ? state.courseRuns.filter(run => run.teacherId === selectedUser.id)
    : [];
  const selectedTeacherRunIds = new Set(selectedTeacherRuns.map(run => run.id));
  const selectedTeacherClasses = state.classGroups.filter(group =>
    selectedTeacherRunIds.has(group.courseRunId)
  );
  const selectedTeacherClassIds = new Set(
    selectedTeacherClasses.map(group => group.id)
  );
  const selectedTeacherEvents = state.events.filter(
    event =>
      event.ownerId === selectedUser?.id ||
      (event.classGroupId
        ? selectedTeacherClassIds.has(event.classGroupId)
        : false)
  );
  const selectedTeacherAssignments = state.assignments.filter(assignment =>
    selectedTeacherRunIds.has(assignment.courseRunId)
  );
  const selectedTeacherQuizzes = state.quizzes.filter(quiz =>
    selectedTeacherRunIds.has(quiz.courseRunId)
  );
  const selectedTeacherResources = state.resources.filter(resource => {
    const lesson = state.lessons.find(item => item.id === resource.lessonId);
    const moduleItem = state.modules.find(item => item.id === lesson?.moduleId);
    return selectedTeacherRuns.some(
      run => run.courseId === moduleItem?.courseId
    );
  });
  const selectedTeacherAvailability = selectedUser
    ? state.teacherAvailability.filter(
        slot => slot.teacherId === selectedUser.id
      )
    : [];
  const selectedAssignmentRun = state.courseRuns.find(
    run => run.id === teacherAssignmentDraft.courseRunId
  );
  const selectedAssignmentCourse = state.courses.find(
    course => course.id === selectedAssignmentRun?.courseId
  );
  const selectedAssignmentProgram = state.programs.find(
    program => program.id === selectedAssignmentCourse?.programId
  );
  const selectedAssignmentBranch = state.branches.find(
    branch => branch.id === selectedAssignmentRun?.branchId
  );
  const selectedAssignmentValidDepartments = state.departments.filter(
    department => {
      if (!selectedAssignmentRun)
        return department.id === selectedUser?.departmentId;
      const branchMatches =
        department.branchIds.includes(selectedAssignmentRun.branchId) ||
        selectedAssignmentRun.branchId === "br_global";
      const programMatches =
        !selectedAssignmentProgram ||
        selectedAssignmentProgram.departmentId === department.id;
      return branchMatches && programMatches;
    }
  );
  const selectedAssignmentDepartment = state.departments.find(
    department => department.id === teacherAssignmentDraft.departmentId
  );
  const selectedAssignmentClasses = state.classGroups.filter(
    group => group.courseRunId === selectedAssignmentRun?.id
  );
  const selectedAssignmentPreviousTeacher = state.users.find(
    user => user.id === selectedAssignmentRun?.teacherId
  );
  const teacherWorkspaceLinks = selectedTeacherClasses[0]
    ? [
        {
          label: "Class",
          href: `/app/teacher/classes/${selectedTeacherClasses[0].id}`,
          value: selectedTeacherClasses[0].name,
        },
        {
          label: "Sessions",
          href: `/app/teacher/classes/${selectedTeacherClasses[0].id}/sessions`,
          value: `${selectedTeacherEvents.length} scheduled`,
        },
        {
          label: "Attendance",
          href: `/app/teacher/classes/${selectedTeacherClasses[0].id}/attendance`,
          value: `${selectedTeacherClasses[0].studentIds.length} learners`,
        },
        {
          label: "Materials",
          href: "/app/teacher/materials",
          value: `${selectedTeacherResources.length} resources`,
        },
        {
          label: "Assignments",
          href: "/app/teacher/assignments",
          value: `${selectedTeacherAssignments.length} active`,
        },
        {
          label: "Grading",
          href: "/app/teacher/grading",
          value: "Course scoped",
        },
        {
          label: "Quizzes",
          href: "/app/teacher/quizzes",
          value: `${selectedTeacherQuizzes.length} quizzes`,
        },
      ]
    : [];
  const auditRows = state.auditLogs
    .filter(audit =>
      /user|role|permission|branch|record|rbac|teacher/i.test(
        `${audit.action} ${audit.entityType} ${audit.summary}`
      )
    )
    .slice(0, 5);
  const accessMode =
    pageId === "permissions"
      ? "permissions"
      : pageId === "branches"
        ? "branches"
        : pageId === "roles"
          ? "roles"
          : "users";
  const accessCopy: Record<
    typeof accessMode,
    { title: string; description: string; context: string }
  > = {
    users: {
      title: "User directory",
      description: "Find people, review status, and open the right account.",
      context: "People",
    },
    roles: {
      title: "Roles and access",
      description: "Choose a user, set their role, branch, and department.",
      context: "Role assignment",
    },
    permissions: {
      title: "Access rules",
      description: "Review one role and update the actions it can perform.",
      context: "Permissions",
    },
    branches: {
      title: "Branch access",
      description: "Review branch status and the users connected to each site.",
      context: "Branches",
    },
  };
  const showDirectory = accessMode === "roles" || accessMode === "users";
  const showSelectedAccount = accessMode === "roles" || accessMode === "users";
  const showCreateAccount = accessMode === "users";
  const showPermissionPanel =
    accessMode === "roles" || accessMode === "permissions";
  const showBranchPanel = accessMode === "roles" || accessMode === "branches";
  const showAuditPanel = accessMode !== "users";
  const focusLabel =
    pageId === "branches"
      ? "Branch access"
      : pageId === "permissions"
        ? "Access rules"
        : pageId === "roles"
          ? "Role assignment"
          : "Identity directory";

  useEffect(() => {
    setTeacherAssignError("");
    setTeacherAssignStatus("");
    const currentRun =
      selectedTeacherRuns.find(
        run => run.status === "active" || run.status === "pending"
      ) ?? selectedTeacherRuns[0];
    const fallbackDepartmentId =
      selectedTeacherProfile?.departmentId ?? selectedUser?.departmentId ?? "";
    setTeacherAssignmentDraft({
      courseRunId: currentRun?.id ?? "",
      departmentId: fallbackDepartmentId,
      specialties: selectedTeacherProfile?.specialties.join(", ") ?? "",
      availability: selectedTeacherAvailability
        .map(slot => `${slot.weekday} ${slot.startsAt}-${slot.endsAt}`)
        .join(", "),
    });
  }, [selectedUserId]);

  useEffect(() => {
    if (params?.userId && params.userId !== selectedUserId) {
      setSelectedUserId(params.userId);
    }
  }, [params?.userId, selectedUserId]);

  const updateUserAccess = async (
    action: Extract<PlatformWorkflowAction, { type: "user.update" }>,
    successMessage: string
  ) => {
    if (savingAccess) return;
    setSavingAccess(true);
    setAccessUpdateError("");
    const response = await runPlatformWorkflowActionRequest(action);
    setSavingAccess(false);
    if (!response.ok || !response.data) {
      const message = response.error ?? "User access could not be updated.";
      setAccessUpdateError(message);
      toast.error("User access update failed", { description: message });
      return;
    }
    platformStore.setState(response.data.state);
    refresh();
    toast.success(successMessage);
  };

  const setUserRole = (userId: string, roleValue: unknown) => {
    const role = safeRole(roleValue);
    const user = state.users.find(item => item.id === userId);
    const roles = user?.roles.includes(role)
      ? user.roles
      : [...(user?.roles ?? []), role];
    void updateUserAccess(
      {
        type: "user.update",
        userId,
        activeRole: role,
        roles,
        branchId: user?.branchId,
        departmentId: user?.departmentId,
        status: user?.status,
      },
      `${metaForRole(role).label} set as active role`
    );
    setSelectedRole(role);
  };

  const toggleUserRole = (userId: string, roleValue: unknown) => {
    const role = safeRole(roleValue);
    const user = state.users.find(item => item.id === userId);
    if (!user) return;
    const hasRole = user.roles.includes(role);
    const roles = hasRole
      ? user.roles.filter(item => item !== role)
      : [...user.roles, role];
    const safeRoles = roles.length ? roles : [user.activeRole];
    const activeRole = safeRole(
      safeRoles.includes(user.activeRole) ? user.activeRole : safeRoles[0]
    );
    void updateUserAccess(
      {
        type: "user.update",
        userId,
        activeRole,
        roles: safeRoles,
        branchId: user.branchId,
        departmentId: user.departmentId,
        status: user.status,
      },
      `${metaForRole(role).label} access updated`
    );
  };

  const updateUserScope = (
    field: "branchId" | "departmentId",
    value: string
  ) => {
    if (!selectedUser) return;
    void updateUserAccess(
      {
        type: "user.update",
        userId: selectedUser.id,
        activeRole: selectedUser.activeRole,
        roles: selectedUser.roles,
        branchId: field === "branchId" ? value : selectedUser.branchId,
        departmentId:
          field === "departmentId" ? value : selectedUser.departmentId,
        status: selectedUser.status,
      },
      `${field === "branchId" ? "Branch" : "Department"} scope updated`
    );
  };

  const toggleUserStatus = () => {
    if (!selectedUser) return;
    const nextStatus: EntityStatus =
      selectedUser.status === "active" ? "paused" : "active";
    void updateUserAccess(
      {
        type: "user.update",
        userId: selectedUser.id,
        activeRole: selectedUser.activeRole,
        roles: selectedUser.roles,
        branchId: selectedUser.branchId,
        departmentId: selectedUser.departmentId,
        status: nextStatus,
      },
      `User ${nextStatus === "active" ? "activated" : "paused"}`
    );
  };

  const updateGovernance = async (
    action: Extract<
      PlatformWorkflowAction,
      { type: "permission.update" | "branch.update" }
    >,
    successMessage: string
  ) => {
    if (savingGovernance) return;
    setSavingGovernance(true);
    setGovernanceUpdateError("");
    const response = await runPlatformWorkflowActionRequest(action);
    setSavingGovernance(false);
    if (!response.ok || !response.data) {
      const message = response.error ?? "Governance update could not be saved.";
      setGovernanceUpdateError(message);
      toast.error("Governance update failed", { description: message });
      return;
    }
    platformStore.setState(response.data.state);
    refresh();
    toast.success(successMessage);
  };

  const togglePermission = (roleValue: unknown, permission: Permission) => {
    const role = safeRole(roleValue);
    const current = state.permissions[role] ?? [];
    const granted = !current.includes(permission);
    void updateGovernance(
      {
        type: "permission.update",
        role,
        permission,
        granted,
      },
      `${metaForRole(role).label} permission ${granted ? "granted" : "removed"}`
    );
  };

  const updateBranchStatus = (branchId: string, status: EntityStatus) => {
    void updateGovernance(
      {
        type: "branch.update",
        branchId,
        status,
      },
      "Branch status updated"
    );
  };

  const addUser = async (event: React.FormEvent) => {
    event.preventDefault();
    if (creatingAccount) return;
    const name = newUser.name.trim();
    const email = newUser.email.trim().toLowerCase();
    const phone = newUser.phone.trim();
    setCreateAccountError("");
    if (!name || !email) {
      const message = "Full name and email are required";
      setCreateAccountError(message);
      toast.error(message);
      return;
    }
    if (!email.includes("@")) {
      const message = "Enter a valid email address";
      setCreateAccountError(message);
      toast.error(message);
      return;
    }
    if (state.users.some(user => user.email.toLowerCase() === email)) {
      const message = "This email is already in the identity directory";
      setCreateAccountError(message);
      toast.error(message);
      return;
    }
    const selectedBranch = state.branches.find(
      branch => branch.id === newUser.branchId
    );
    const selectedDepartment = state.departments.find(
      department => department.id === newUser.departmentId
    );
    if (!selectedBranch || !selectedDepartment) {
      const message = "Choose a valid branch and department";
      setCreateAccountError(message);
      toast.error(message);
      return;
    }
    if (
      !selectedDepartment.branchIds.includes(selectedBranch.id) &&
      selectedBranch.id !== "br_global"
    ) {
      const message =
        "Selected department is not available in the chosen branch";
      setCreateAccountError(message);
      toast.error(message);
      return;
    }
    if (
      newUser.role === "teacher" &&
      !splitListInput(newUser.subjects).length
    ) {
      const message = "Add at least one subject taught by the teacher";
      setCreateAccountError(message);
      toast.error(message);
      return;
    }
    if (
      newUser.role === "teacher" &&
      !splitListInput(newUser.teachingLevels).length
    ) {
      const message = "Add at least one teaching level for the teacher";
      setCreateAccountError(message);
      toast.error(message);
      return;
    }
    if (
      newUser.role === "branchadmin" &&
      !splitListInput(newUser.operationalScope).length
    ) {
      const message = "Add at least one branch operation scope";
      setCreateAccountError(message);
      toast.error(message);
      return;
    }
    if (
      newUser.role === "registrar" &&
      newUser.permissionScope !== "admissions"
    ) {
      const message = "Registrar accounts require admissions access level";
      setCreateAccountError(message);
      toast.error(message);
      return;
    }
    if (
      newUser.role === "headofdepartment" &&
      newUser.permissionScope !== "department"
    ) {
      const message = "HOD accounts require department access level";
      setCreateAccountError(message);
      toast.error(message);
      return;
    }
    if (newUser.role === "superadmin" && newUser.permissionScope !== "global") {
      const message = "Super admin accounts require global access level";
      setCreateAccountError(message);
      toast.error(message);
      return;
    }
    setCreatingAccount(true);
    const response = await runPlatformWorkflowActionRequest({
      type: "staff.user.create",
      name,
      email,
      phone: phone || undefined,
      role: newUser.role,
      branchId: newUser.branchId,
      departmentId: newUser.departmentId,
      status: newUser.status,
      permissionScope: newUser.permissionScope,
      subjects: splitListInput(newUser.subjects),
      teachingLevels: splitListInput(newUser.teachingLevels),
      availabilityStatus: newUser.availabilityStatus,
      operationalScope: splitListInput(newUser.operationalScope),
      notes: newUser.notes.trim() || undefined,
    });
    setCreatingAccount(false);
    if (!response.ok || !response.data) {
      const message = response.error ?? "Account could not be created.";
      setCreateAccountError(message);
      toast.error("Account creation failed", { description: message });
      return;
    }
    platformStore.setState(response.data.state);
    const created = response.data.result.result as
      | {
          user?: {
            id: string;
            name: string;
            activeRole: StaffRole;
          };
          staffProfile?: { role: StaffRole };
          relationshipSummary?: string;
        }
      | undefined;
    const id = created?.user?.id ?? response.data.result.entityId;
    setSelectedUserId(id);
    setSelectedRole(created?.user?.activeRole ?? newUser.role);
    const defaults = staffRoleDefaults.teacher;
    setNewUser({
      name: "",
      email: "",
      phone: "",
      role: "teacher",
      branchId: defaults.branchId,
      departmentId: defaults.departmentId,
      status: "active",
      permissionScope: defaults.permissionScope,
      subjects: defaults.subjects,
      teachingLevels: defaults.teachingLevels,
      availabilityStatus: defaults.availabilityStatus,
      operationalScope: defaults.operationalScope,
      notes: "",
    });
    refresh();
    toast.success("Account created and connected", {
      description:
        created?.relationshipSummary ??
        `${draftRoleMeta.label} account created through server action.`,
    });
  };

  const assignSelectedTeacher = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedUser || safeRole(selectedUser.activeRole) !== "teacher") {
      setTeacherAssignError(
        "Select a teacher account before assigning a course run."
      );
      return;
    }
    if (
      !teacherAssignmentDraft.courseRunId ||
      !teacherAssignmentDraft.departmentId
    ) {
      setTeacherAssignError("Choose a course run and department.");
      return;
    }
    if (
      !selectedAssignmentValidDepartments.some(
        department => department.id === teacherAssignmentDraft.departmentId
      )
    ) {
      setTeacherAssignError(
        "Choose a department that owns this course and is available in the run branch."
      );
      return;
    }
    setAssigningTeacher(true);
    setTeacherAssignError("");
    setTeacherAssignStatus("");
    const response = await runPlatformWorkflowActionRequest({
      type: "teacher.assign",
      userId: selectedUser.id,
      courseRunId: teacherAssignmentDraft.courseRunId,
      departmentId: teacherAssignmentDraft.departmentId,
      specialties: splitListInput(teacherAssignmentDraft.specialties),
      availability: splitListInput(teacherAssignmentDraft.availability),
    });
    setAssigningTeacher(false);
    if (!response.ok || !response.data) {
      const message =
        response.error ?? "Teacher assignment could not be saved.";
      setTeacherAssignError(message);
      toast.error("Teacher assignment failed", { description: message });
      return;
    }
    platformStore.setState(response.data.state);
    refresh();
    const result = response.data.result.result as
      | {
          teacher?: { name: string };
          previousTeacher?: { name: string };
          classGroups?: Array<{ id: string }>;
          availability?: Array<{ id: string }>;
        }
      | undefined;
    toast.success(
      result?.previousTeacher ? "Teacher reassigned" : "Teacher assigned",
      {
        description: `${result?.teacher?.name ?? selectedUser.name} now owns ${result?.classGroups?.length ?? selectedAssignmentClasses.length} class group(s).`,
      }
    );
    setTeacherAssignStatus(
      `${result?.teacher?.name ?? selectedUser.name} saved for ${result?.classGroups?.length ?? selectedAssignmentClasses.length} class group(s).`
    );
  };

  return (
    <div className="admin-access-workspace">
      <PlatformWorkspaceHeader
        className="admin-access-hero"
        title={accessCopy[accessMode].title}
        description={accessCopy[accessMode].description}
        context={<span>{accessCopy[accessMode].context}</span>}
        actionsClassName="admin-access-hero-actions"
        actions={
          <>
            <button
              className={
                pageId === "users" || pageId === "user-detail" ? "active" : ""
              }
              onClick={() =>
                setSelectedRole(safeRole(selectedUser?.activeRole))
              }
            >
              <Users size={15} />
              Users
            </button>
            <button
              className={pageId === "roles" ? "active" : ""}
              onClick={() => setSelectedRole("teacher")}
            >
              <ShieldCheck size={15} />
              Roles & access
            </button>
            <button
              className={pageId === "permissions" ? "active" : ""}
              onClick={() => setSelectedRole("superadmin")}
            >
              <KeyRound size={15} />
              Access rules
            </button>
            <button className={pageId === "branches" ? "active" : ""}>
              <Building2 size={15} />
              Branches
            </button>
          </>
        }
      />

      <div className="admin-access-kpis">
        <AdminAccessMetric
          label="Active users"
          value={`${activeUsers}/${state.users.length}`}
        />
        <AdminAccessMetric
          label="Selected role"
          value={selectedRoleMeta.label}
        />
        <AdminAccessMetric
          label="Role users"
          value={String(selectedRoleUsers)}
        />
        <AdminAccessMetric
          label="Role coverage"
          value={`${permissionCoverage}%`}
        />
      </div>

      {showDirectory || showSelectedAccount || showCreateAccount ? (
        <div
          className={`admin-access-layout ${showCreateAccount ? "with-create" : "without-create"}`}
        >
          {showDirectory ? (
            <section className="admin-access-panel directory">
              <div className="admin-access-panel-head">
                <div>
                  <span>Identity directory</span>
                  <strong>{visibleUsers.length} users</strong>
                </div>
                <UserPlus size={18} />
              </div>
              <div className="platform-toolbar-search admin-access-search">
                <Search size={15} />
                <input
                  aria-label="Search users, roles, branches"
                  value={query}
                  onChange={event => setQuery(event.target.value)}
                  placeholder="Search users, roles, branches"
                />
              </div>
              <div className="admin-access-user-list">
                {visibleUsers.map(user => {
                  const branch = state.branches.find(
                    item => item.id === user.branchId
                  );
                  const department = state.departments.find(
                    item => item.id === user.departmentId
                  );
                  const userMeta = metaForRole(user.activeRole);
                  return (
                    <button
                      key={user.id}
                      className={selectedUser?.id === user.id ? "active" : ""}
                      onClick={() => {
                        setSelectedUserId(user.id);
                        setSelectedRole(safeRole(user.activeRole));
                      }}
                    >
                      <span
                        style={{
                          background: userMeta.tint,
                          color: userMeta.color,
                        }}
                      >
                        {userMeta.shortLabel}
                      </span>
                      <div>
                        <strong>{user.name}</strong>
                        <small>
                          {branch?.name ?? "No branch"} ·{" "}
                          {department?.name ?? "No department"}
                        </small>
                      </div>
                      <em>{user.status}</em>
                    </button>
                  );
                })}
              </div>
            </section>
          ) : null}

          {showSelectedAccount ? (
            <section
              className="admin-access-panel selected-user"
              aria-busy={savingAccess}
            >
              <div className="admin-access-panel-head">
                <div>
                  <span>Selected account</span>
                  <strong>{selectedUser?.name ?? "No user"}</strong>
                </div>
                <button onClick={toggleUserStatus} disabled={savingAccess}>
                  {savingAccess
                    ? "Saving"
                    : selectedUser?.status === "active"
                      ? "Pause"
                      : "Activate"}
                </button>
              </div>
              {selectedUser ? (
                <>
                  <div className="admin-access-user-profile">
                    <span style={{ background: selectedUserMeta.color }}>
                      {selectedUserMeta.shortLabel}
                    </span>
                    <div>
                      <strong>{selectedUser.email}</strong>
                      <small>
                        {activeBranch?.name ?? "No branch"} ·{" "}
                        {activeDepartment?.name ?? "No department"}
                      </small>
                    </div>
                  </div>

                  <div className="admin-access-field-grid">
                    <label>
                      Active role
                      <select
                        value={safeRole(selectedUser.activeRole)}
                        disabled={savingAccess}
                        onChange={event =>
                          setUserRole(selectedUser.id, event.target.value)
                        }
                      >
                        {roleOrder.map(role => (
                          <option key={role} value={role}>
                            {roleMeta[role].label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Branch
                      <select
                        value={selectedUser.branchId ?? ""}
                        disabled={savingAccess}
                        onChange={event =>
                          updateUserScope("branchId", event.target.value)
                        }
                      >
                        {state.branches.map(branch => (
                          <option key={branch.id} value={branch.id}>
                            {branch.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Department
                      <select
                        value={selectedUser.departmentId ?? ""}
                        disabled={savingAccess}
                        onChange={event =>
                          updateUserScope("departmentId", event.target.value)
                        }
                      >
                        {state.departments.map(department => (
                          <option key={department.id} value={department.id}>
                            {department.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div
                    className="admin-access-role-grid"
                    aria-label={`${selectedUser.name} roles`}
                  >
                    {roleOrder.map(role => (
                      <button
                        key={role}
                        className={
                          selectedUser.roles.includes(role) ? "active" : ""
                        }
                        disabled={savingAccess}
                        onClick={() => toggleUserRole(selectedUser.id, role)}
                      >
                        <span
                          style={{
                            background: roleMeta[role].tint,
                            color: roleMeta[role].color,
                          }}
                        >
                          {roleMeta[role].shortLabel}
                        </span>
                        <strong>{roleMeta[role].label}</strong>
                        {selectedUser.activeRole === role ? (
                          <em>active</em>
                        ) : null}
                      </button>
                    ))}
                  </div>

                  <div className="admin-access-review-card">
                    <strong>
                      {selectedStaffProfile?.title ?? "Related profile"}
                    </strong>
                    <small>
                      {selectedStaffProfile
                        ? `${selectedStaffProfile.permissionScope} access · ${selectedStaffBranches || "No branch"} · ${selectedStaffDepartments || "No department"}`
                        : "No staff profile is linked to this account yet."}
                    </small>
                    <span>
                      {selectedStaffProfile
                        ? `${selectedPermissionSummary.length} permission(s) available. ${selectedStaffProfile.operationalScope.join(", ") || "No operational scope recorded."}`
                        : "Student profiles are managed through registrar admissions; staff profiles are created here."}
                    </span>
                  </div>

                  <div className="admin-audit-list">
                    {selectedUserAuditRows.length ? (
                      selectedUserAuditRows.map(auditRow => (
                        <article key={auditRow.id}>
                          <strong>{auditRow.action}</strong>
                          <small>{auditRow.summary}</small>
                          <span>
                            {new Date(auditRow.createdAt).toLocaleString()}
                          </span>
                        </article>
                      ))
                    ) : (
                      <article>
                        <strong>No recent activity</strong>
                        <small>
                          Role, scope, and creation changes will appear here.
                        </small>
                      </article>
                    )}
                  </div>

                  {accessUpdateError ? (
                    <div className="platform-empty-state error">
                      <strong>Access update was not saved</strong>
                      <span>{accessUpdateError}</span>
                    </div>
                  ) : null}

                  {selectedUser.activeRole === "teacher" ? (
                    <div className="admin-access-teacher-links">
                      <div>
                        <span>Teacher workspace ready</span>
                        <strong>
                          {selectedTeacherClasses.length} class group(s)
                        </strong>
                        <small>
                          {selectedTeacherProfile?.specialties.join(", ") ||
                            "No subjects added"}{" "}
                          · {selectedTeacherAvailability.length} availability
                          slot(s)
                        </small>
                      </div>
                      <div className="admin-access-teacher-link-grid">
                        {teacherWorkspaceLinks.length ? (
                          teacherWorkspaceLinks.map(item => (
                            <Link key={item.label} href={item.href}>
                              <span>{item.label}</span>
                              <strong>{item.value}</strong>
                            </Link>
                          ))
                        ) : (
                          <span className="admin-access-empty-note">
                            Assign this teacher to a course run to enable class,
                            attendance, grading, materials, and feedback tools.
                          </span>
                        )}
                      </div>
                      <form
                        className="admin-access-form admin-access-teacher-assignment-form"
                        onSubmit={assignSelectedTeacher}
                        aria-busy={assigningTeacher}
                      >
                        <div className="admin-access-form-section">
                          <span>Course run assignment</span>
                          <label>
                            Course run
                            <select
                              value={teacherAssignmentDraft.courseRunId}
                              disabled={assigningTeacher}
                              onChange={event =>
                                setTeacherAssignmentDraft(value => ({
                                  ...value,
                                  courseRunId: event.target.value,
                                }))
                              }
                            >
                              <option value="">Choose a live course run</option>
                              {state.courseRuns
                                .filter(
                                  run =>
                                    run.status === "active" ||
                                    run.status === "pending"
                                )
                                .map(run => {
                                  const course = state.courses.find(
                                    item => item.id === run.courseId
                                  );
                                  const branch = state.branches.find(
                                    item => item.id === run.branchId
                                  );
                                  const teacher = state.users.find(
                                    item => item.id === run.teacherId
                                  );
                                  return (
                                    <option key={run.id} value={run.id}>
                                      {course?.title ?? run.id} ·{" "}
                                      {branch?.name ?? "Branch"} ·{" "}
                                      {teacher?.name ?? "Unassigned"}
                                    </option>
                                  );
                                })}
                            </select>
                          </label>
                          <label>
                            Department
                            <select
                              value={teacherAssignmentDraft.departmentId}
                              disabled={
                                assigningTeacher ||
                                !teacherAssignmentDraft.courseRunId
                              }
                              onChange={event =>
                                setTeacherAssignmentDraft(value => ({
                                  ...value,
                                  departmentId: event.target.value,
                                }))
                              }
                            >
                              <option value="">Choose department</option>
                              {selectedAssignmentValidDepartments.map(
                                department => (
                                  <option
                                    key={department.id}
                                    value={department.id}
                                  >
                                    {department.name}
                                  </option>
                                )
                              )}
                            </select>
                          </label>
                          <label>
                            Subjects / specialties
                            <input
                              value={teacherAssignmentDraft.specialties}
                              disabled={assigningTeacher}
                              onChange={event =>
                                setTeacherAssignmentDraft(value => ({
                                  ...value,
                                  specialties: event.target.value,
                                }))
                              }
                            />
                          </label>
                          <label>
                            Availability
                            <input
                              value={teacherAssignmentDraft.availability}
                              disabled={assigningTeacher}
                              onChange={event =>
                                setTeacherAssignmentDraft(value => ({
                                  ...value,
                                  availability: event.target.value,
                                }))
                              }
                            />
                          </label>
                        </div>
                        <div className="admin-access-review-card">
                          <strong>
                            {selectedAssignmentCourse?.title ??
                              "Selected course run"}
                          </strong>
                          <small>
                            {selectedAssignmentBranch?.name ?? "No branch"} ·{" "}
                            {selectedAssignmentDepartment?.name ??
                              "No department"}{" "}
                            · {selectedAssignmentClasses.length} class group(s)
                          </small>
                          <span>
                            {selectedAssignmentPreviousTeacher &&
                            selectedAssignmentPreviousTeacher.id !==
                              selectedUser.id
                              ? `Reassigns from ${selectedAssignmentPreviousTeacher.name}; class events, attendance, grading, materials, quizzes, and feedback move to ${selectedUser.name}.`
                              : `Keeps ${selectedUser.name} connected to class events, attendance, grading, materials, quizzes, and feedback.`}
                          </span>
                        </div>
                        {teacherAssignError ? (
                          <div className="platform-empty-state error">
                            <strong>Assignment was not saved</strong>
                            <span>{teacherAssignError}</span>
                          </div>
                        ) : null}
                        {teacherAssignStatus ? (
                          <div className="platform-empty-state success">
                            <strong>Assignment saved</strong>
                            <span>{teacherAssignStatus}</span>
                          </div>
                        ) : null}
                        <button
                          type="submit"
                          disabled={
                            assigningTeacher ||
                            !teacherAssignmentDraft.courseRunId ||
                            !teacherAssignmentDraft.departmentId
                          }
                        >
                          <ClipboardCheck size={15} />
                          {assigningTeacher
                            ? "Saving assignment"
                            : selectedAssignmentPreviousTeacher &&
                                selectedAssignmentPreviousTeacher.id !==
                                  selectedUser.id
                              ? "Reassign teacher"
                              : "Assign teacher"}
                        </button>
                      </form>
                    </div>
                  ) : null}
                </>
              ) : null}
            </section>
          ) : null}

          {showCreateAccount ? (
            <section className="admin-access-panel create-user">
              <div className="admin-access-panel-head">
                <div>
                  <span>Create account</span>
                  <strong>{draftRoleMeta.label} setup</strong>
                </div>
                <CheckCircle2 size={18} />
              </div>
              <form
                className="admin-access-form admin-access-guided-form"
                onSubmit={addUser}
              >
                <div
                  className="admin-access-step-strip"
                  aria-label="Account creation steps"
                >
                  <span>Identity</span>
                  <span>Role scope</span>
                  <span>Portal links</span>
                </div>

                <div className="admin-access-form-section">
                  <span>Identity</span>
                  <label>
                    Full name
                    <input
                      value={newUser.name}
                      onChange={event =>
                        setNewUser(value => ({
                          ...value,
                          name: event.target.value,
                        }))
                      }
                      placeholder="New account name"
                    />
                  </label>
                  <label>
                    Email
                    <input
                      type="email"
                      value={newUser.email}
                      onChange={event =>
                        setNewUser(value => ({
                          ...value,
                          email: event.target.value,
                        }))
                      }
                      placeholder="name@nilelearn.local"
                    />
                  </label>
                  <label>
                    Phone / WhatsApp optional
                    <input
                      value={newUser.phone}
                      onChange={event =>
                        setNewUser(value => ({
                          ...value,
                          phone: event.target.value,
                        }))
                      }
                      placeholder="+20 100 000 0000"
                    />
                  </label>
                </div>

                <div className="admin-access-form-section">
                  <span>Role scope</span>
                  <label>
                    Role
                    <select
                      value={newUser.role}
                      onChange={event => {
                        const role = safeStaffRole(event.target.value);
                        const defaults = staffRoleDefaults[role];
                        setNewUser(value => ({ ...value, role, ...defaults }));
                      }}
                    >
                      {staffRoleOptions.map(role => (
                        <option key={role} value={role}>
                          {roleMeta[role].label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Branch
                    <select
                      value={newUser.branchId}
                      onChange={event =>
                        setNewUser(value => ({
                          ...value,
                          branchId: event.target.value,
                        }))
                      }
                    >
                      {state.branches.map(branch => (
                        <option key={branch.id} value={branch.id}>
                          {branch.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Department
                    <select
                      value={newUser.departmentId}
                      onChange={event =>
                        setNewUser(value => ({
                          ...value,
                          departmentId: event.target.value,
                        }))
                      }
                    >
                      {state.departments.map(department => (
                        <option key={department.id} value={department.id}>
                          {department.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Status
                    <select
                      value={newUser.status}
                      onChange={event =>
                        setNewUser(value => ({
                          ...value,
                          status: event.target.value as EntityStatus,
                        }))
                      }
                    >
                      <option value="active">Active</option>
                      <option value="pending">Pending</option>
                      <option value="paused">Paused</option>
                    </select>
                  </label>
                  <label>
                    Access level
                    <select
                      value={newUser.permissionScope}
                      onChange={event =>
                        setNewUser(value => ({
                          ...value,
                          permissionScope: event.target
                            .value as StaffPermissionScope,
                        }))
                      }
                    >
                      <option value="department">Department</option>
                      <option value="branch">Branch</option>
                      <option value="admissions">Admissions</option>
                      <option value="operations">Operations</option>
                      <option value="global">Global</option>
                    </select>
                  </label>
                </div>

                {newUser.role === "teacher" ? (
                  <div className="admin-access-form-section">
                    <span>Teacher profile</span>
                    <label>
                      Subjects taught
                      <input
                        value={newUser.subjects}
                        onChange={event =>
                          setNewUser(value => ({
                            ...value,
                            subjects: event.target.value,
                          }))
                        }
                        placeholder="Arabic, Quran, Tajweed"
                      />
                    </label>
                    <label>
                      Teaching levels
                      <input
                        value={newUser.teachingLevels}
                        onChange={event =>
                          setNewUser(value => ({
                            ...value,
                            teachingLevels: event.target.value,
                          }))
                        }
                        placeholder="Arabic Level 3, Tajweed 1"
                      />
                    </label>
                    <label>
                      Availability status
                      <select
                        value={newUser.availabilityStatus}
                        onChange={event =>
                          setNewUser(value => ({
                            ...value,
                            availabilityStatus: event.target
                              .value as StaffAvailabilityStatus,
                          }))
                        }
                      >
                        <option value="available">Available</option>
                        <option value="limited">Limited</option>
                        <option value="unavailable">Unavailable</option>
                      </select>
                    </label>
                  </div>
                ) : null}

                {newUser.role !== "teacher" ? (
                  <div className="admin-access-form-section">
                    <span>Operational profile</span>
                    <label>
                      Operational scope
                      <input
                        value={newUser.operationalScope}
                        onChange={event =>
                          setNewUser(value => ({
                            ...value,
                            operationalScope: event.target.value,
                          }))
                        }
                        placeholder="rooms, schedule, reports"
                      />
                    </label>
                    {newUser.role === "headofdepartment" ? (
                      <label>
                        Academic coverage
                        <input
                          value={newUser.teachingLevels}
                          onChange={event =>
                            setNewUser(value => ({
                              ...value,
                              teachingLevels: event.target.value,
                            }))
                          }
                          placeholder="Arabic Language, Quran and Tajweed"
                        />
                      </label>
                    ) : null}
                  </div>
                ) : null}

                <div className="admin-access-form-section">
                  <span>Notes</span>
                  <label>
                    Operational notes
                    <input
                      value={newUser.notes}
                      onChange={event =>
                        setNewUser(value => ({
                          ...value,
                          notes: event.target.value,
                        }))
                      }
                      placeholder="Optional context for admissions or operations"
                    />
                  </label>
                </div>

                <div className="admin-access-review-card">
                  <strong>{newUser.name.trim() || "New account"}</strong>
                  <small>
                    {draftRoleMeta.label} · {draftBranch?.name ?? "No branch"} ·{" "}
                    {draftDepartment?.name ?? "No department"}
                  </small>
                  {newUser.role === "teacher" ? (
                    <span>
                      Creates a teacher profile with{" "}
                      {splitListInput(newUser.subjects).length} subject(s),{" "}
                      {splitListInput(newUser.teachingLevels).length} teaching
                      level(s), and {newUser.availabilityStatus} availability.
                      Course assignment stays in the selected account panel.
                    </span>
                  ) : (
                    <span>
                      Creates a {newUser.permissionScope} staff profile with{" "}
                      {splitListInput(newUser.operationalScope).length}{" "}
                      operational scope item(s) and existing access rules for{" "}
                      {draftRoleMeta.label}.
                    </span>
                  )}
                </div>

                {createAccountError ? (
                  <div className="platform-empty-state error">
                    <strong>Account was not created</strong>
                    <span>{createAccountError}</span>
                  </div>
                ) : null}

                <button type="submit" disabled={creatingAccount}>
                  <UserPlus size={15} />
                  {creatingAccount
                    ? "Creating account"
                    : "Create connected account"}
                </button>
              </form>
            </section>
          ) : null}
        </div>
      ) : null}

      <div className={`admin-access-lower-grid admin-access-${accessMode}`}>
        {showPermissionPanel ? (
          <section
            className="admin-access-panel permission-matrix"
            aria-busy={savingGovernance}
          >
            <div className="admin-access-panel-head">
              <div>
                <span>Access rules</span>
                <strong>{selectedRoleMeta.label}</strong>
              </div>
              <select
                value={safeRole(selectedRole)}
                disabled={savingGovernance}
                onChange={event =>
                  setSelectedRole(safeRole(event.target.value))
                }
                aria-label="Permission role"
              >
                {roleOrder.map(role => (
                  <option key={role} value={role}>
                    {roleMeta[role].label}
                  </option>
                ))}
              </select>
            </div>
            <div className="admin-permission-grid">
              {allPermissions.map(permission => {
                const granted = (
                  state.permissions[selectedRole] ?? []
                ).includes(permission);
                return (
                  <button
                    key={permission}
                    className={granted ? "granted" : ""}
                    disabled={savingGovernance}
                    onClick={() => togglePermission(selectedRole, permission)}
                  >
                    <span>
                      {granted ? <CheckCircle2 size={14} /> : <X size={14} />}
                    </span>
                    <strong>{formatPermission(permission)}</strong>
                  </button>
                );
              })}
            </div>
            {governanceUpdateError ? (
              <div className="platform-empty-state error">
                <strong>Governance update was not saved</strong>
                <span>{governanceUpdateError}</span>
              </div>
            ) : null}
          </section>
        ) : null}

        {showBranchPanel ? (
          <section
            className="admin-access-panel branch-scope"
            aria-busy={savingGovernance}
          >
            <div className="admin-access-panel-head">
              <div>
                <span>Branch access</span>
                <strong>{state.branches.length} branches</strong>
              </div>
              <Building2 size={18} />
            </div>
            <div className="admin-branch-list">
              {state.branches.map(branch => {
                const users = state.users.filter(
                  user => user.branchId === branch.id
                ).length;
                const departments = state.departments.filter(department =>
                  department.branchIds.includes(branch.id)
                ).length;
                return (
                  <article key={branch.id}>
                    <div>
                      <strong>{branch.name}</strong>
                      <small>
                        {branch.code} · {branch.timezone} · {users} users ·{" "}
                        {departments} departments
                      </small>
                    </div>
                    <select
                      value={branch.status}
                      disabled={savingGovernance}
                      data-testid={`branch-status-${branch.id}`}
                      onChange={event =>
                        updateBranchStatus(
                          branch.id,
                          event.target.value as EntityStatus
                        )
                      }
                      aria-label={`${branch.name} status`}
                    >
                      <option value="active">Active</option>
                      <option value="paused">Paused</option>
                      <option value="pending">Pending</option>
                    </select>
                  </article>
                );
              })}
            </div>
          </section>
        ) : null}

        {showAuditPanel ? (
          <section className="admin-access-panel audit-feed">
            <div className="admin-access-panel-head">
              <div>
                <span>Activity</span>
                <strong>Recent access changes</strong>
              </div>
              <ShieldCheck size={18} />
            </div>
            <div className="admin-audit-list">
              {auditRows.map(auditRow => (
                <article key={auditRow.id}>
                  <strong>{auditRow.action}</strong>
                  <small>{auditRow.summary}</small>
                  <span>{new Date(auditRow.createdAt).toLocaleString()}</span>
                </article>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}

function AdminAccessMetric({ label, value }: { label: string; value: string }) {
  return (
    <article className="platform-mini-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function AdminSystemExperience({ pageId }: { pageId: string }) {
  const [version, setVersion] = useState(0);
  const [selectedIntegrationId, setSelectedIntegrationId] =
    useState<IntegrationConfig["id"]>("moodle");
  const [auditQuery, setAuditQuery] = useState("");
  const [auditFilter, setAuditFilter] = useState("All");
  const [settingsDraft, setSettingsDraft] = useState(() => {
    const settings = platformStore.getState().settings;
    return {
      organization: settings.organization,
      defaultLanguage: settings.defaultLanguage,
      academicTerm: settings.academicTerm,
      retentionDays: String(settings.retentionDays),
    };
  });
  const [integrationCheck, setIntegrationCheck] = useState("");
  const [savingSystemAction, setSavingSystemAction] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [systemActionError, setSystemActionError] = useState("");
  const [settingsSaveError, setSettingsSaveError] = useState("");
  const state = useMemo(() => platformStore.getState(), [version]);
  const refresh = () => setVersion(value => value + 1);
  const actorId = getDemoUser("superadmin").id;
  const integrations = state.integrations;
  const selectedIntegration =
    integrations.find(
      integration => integration.id === selectedIntegrationId
    ) ?? integrations[0];
  const connectedCount = integrations.filter(
    integration => integration.status === "connected"
  ).length;
  const mockCount = integrations.filter(
    integration => integration.status === "mock_mode"
  ).length;
  const serverOnlyCount = integrations.filter(
    integration => integration.serverOnly
  ).length;
  const auditActions = Array.from(
    new Set(state.auditLogs.map(audit => audit.action.split(".")[0]))
  ).slice(0, 6);
  const filteredAuditLogs = state.auditLogs.filter(audit => {
    const text =
      `${audit.actorId} ${audit.action} ${audit.entityType} ${audit.entityId} ${audit.summary}`.toLowerCase();
    const matchesQuery =
      !auditQuery.trim() || text.includes(auditQuery.toLowerCase());
    const matchesFilter =
      auditFilter === "All" || audit.action.startsWith(auditFilter);
    return matchesQuery && matchesFilter;
  });
  const platformEntityTotal =
    state.users.length +
    state.courses.length +
    state.classGroups.length +
    state.enrollments.length +
    state.events.length +
    state.auditLogs.length;
  const healthChecks: Array<{
    id: string;
    label: string;
    detail: string;
    status: IntegrationStatus;
    metric: string;
  }> = [
    {
      id: "app",
      label: "Application shell",
      detail:
        "Role routing, responsive platform shell, and local store are available.",
      status: "connected" as IntegrationStatus,
      metric: "Ready",
    },
    {
      id: "data",
      label: "System data",
      detail: `${platformEntityTotal} records across users, courses, classes, enrollments, events, and activity logs.`,
      status: "connected" as IntegrationStatus,
      metric: `${platformEntityTotal} records`,
    },
    {
      id: "supabase",
      label: "Supabase boundary",
      detail:
        "Browser uses publishable credentials only; privileged keys stay protected.",
      status:
        integrations.find(integration => integration.id === "supabase")
          ?.status ?? "not_configured",
      metric: "Auth kept",
    },
    {
      id: "moodle",
      label: "Moodle",
      detail:
        "Course mapping and activity inspection are available in test/import mode.",
      status:
        integrations.find(integration => integration.id === "moodle")?.status ??
        "not_configured",
      metric: `${state.courses.length} courses`,
    },
    {
      id: "communications",
      label: "Communications",
      detail:
        "Email and WhatsApp remain log-first until delivery providers are connected with protected credentials.",
      status: integrations.some(
        integration =>
          ["email", "whatsapp"].includes(integration.id) &&
          integration.status === "connected"
      )
        ? "connected"
        : "mock_mode",
      metric: `${state.communicationLogs.length} logs`,
    },
  ];
  const healthScore = Math.round(
    (healthChecks.filter(
      check => check.status === "connected" || check.status === "mock_mode"
    ).length /
      healthChecks.length) *
      100
  );
  const focusCopy =
    pageId === "audit-logs"
      ? "Activity"
      : pageId === "system-health"
        ? "Health"
        : pageId === "settings"
          ? "Platform settings"
          : "Integration control";

  const runSystemAction = async (
    action: Extract<
      PlatformWorkflowAction,
      {
        type:
          | "integration.status.update"
          | "integration.local_check"
          | "system.health_check";
      }
    >,
    successMessage: string
  ) => {
    if (savingSystemAction) return undefined;
    setSavingSystemAction(true);
    setSystemActionError("");
    const response = await runPlatformWorkflowActionRequest(action);
    setSavingSystemAction(false);
    if (!response.ok || !response.data) {
      const message = response.error ?? "System action could not be saved.";
      setSystemActionError(message);
      toast.error("System action failed", { description: message });
      return undefined;
    }
    platformStore.setState(response.data.state);
    refresh();
    toast.success(successMessage);
    return response.data.result.result;
  };

  const setIntegrationStatus = (
    integrationId: IntegrationConfig["id"],
    status: IntegrationStatus
  ) => {
    void runSystemAction(
      {
        type: "integration.status.update",
        integrationId,
        status,
      },
      "Integration status updated"
    );
  };

  const runHealthChecks = () => {
    void runSystemAction(
      {
        type: "system.health_check",
        score: healthScore,
      },
      "Health checked"
    );
  };
  const runIntegrationLocalCheck = () => {
    void runSystemAction(
      {
        type: "integration.local_check",
        integrationId: selectedIntegration.id,
      },
      "Local integration check logged"
    ).then(result => {
      const checkedAt = (result as { checkedAt?: string } | undefined)
        ?.checkedAt;
      setIntegrationCheck(
        `Checked at ${checkedAt ? new Date(checkedAt).toLocaleString() : new Date().toLocaleString()}`
      );
    });
  };

  const exportAuditCsv = () => {
    const rows = filteredAuditLogs.map(audit => ({
      id: audit.id,
      actorId: audit.actorId,
      action: audit.action,
      entityType: audit.entityType,
      entityId: audit.entityId,
      summary: audit.summary,
      createdAt: audit.createdAt,
    }));
    const csv = platformStore.buildCsv(rows);
    if (!csv) {
      toast.error("No activity rows to export");
      return;
    }
    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8" })
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `nile-audit-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    platformStore.audit(
      "audit.exported",
      "AuditLog",
      "filtered",
      `Exported ${rows.length} audit row(s).`,
      actorId
    );
    refresh();
    toast.success("Activity CSV prepared", {
      description: `${rows.length} row(s) exported from the local activity log.`,
    });
  };

  const saveSettings = async (event: React.FormEvent) => {
    event.preventDefault();
    if (savingSettings) return;
    setSavingSettings(true);
    setSettingsSaveError("");
    const response = await runPlatformWorkflowActionRequest({
      type: "settings.save",
      organization: settingsDraft.organization,
      defaultLanguage: settingsDraft.defaultLanguage,
      academicTerm: settingsDraft.academicTerm,
      retentionDays: Number(settingsDraft.retentionDays),
    });
    setSavingSettings(false);
    if (!response.ok || !response.data) {
      const message = response.error ?? "Platform settings could not be saved.";
      setSettingsSaveError(message);
      toast.error("Settings save failed", { description: message });
      return;
    }
    platformStore.setState(response.data.state);
    refresh();
    toast.success("Platform settings saved", {
      description: response.data.persistence,
    });
  };
  const updateAuditQuery = (
    event:
      | React.ChangeEvent<HTMLInputElement>
      | React.FormEvent<HTMLInputElement>
  ) => {
    setAuditQuery(event.currentTarget.value);
  };

  return (
    <div className="admin-system-workspace">
      <PlatformWorkspaceHeader
        className="admin-system-hero"
        title="Platform operations"
        description="Manage connections, health, activity, and settings with protected credential boundaries."
        context={<span>{focusCopy}</span>}
        actionsClassName="admin-system-nav"
        actions={
          <>
            {[
              { label: "Connections", routeId: "integrations", Icon: Puzzle },
              { label: "Activity", routeId: "audit-logs", Icon: FileText },
              { label: "Health", routeId: "system-health", Icon: Server },
              {
                label: "Settings",
                routeId: "settings",
                Icon: SlidersHorizontal,
              },
            ].map(({ label, routeId, Icon }) => (
              <Link
                key={String(routeId)}
                href={`/app/admin/${routeId}`}
                className={pageId === routeId ? "active" : ""}
                aria-current={pageId === routeId ? "page" : undefined}
              >
                <Icon size={15} />
                {label}
              </Link>
            ))}
          </>
        }
      />

      <div className="admin-system-kpis">
        <AdminAccessMetric
          label="Connectors"
          value={`${connectedCount}/${integrations.length}`}
        />
        <AdminAccessMetric label="Test mode" value={String(mockCount)} />
        <AdminAccessMetric label="Protected" value={String(serverOnlyCount)} />
        <AdminAccessMetric label="Health score" value={`${healthScore}%`} />
        <AdminAccessMetric
          label="Activity rows"
          value={String(state.auditLogs.length)}
        />
      </div>

      <div className="admin-system-layout">
        <section className="admin-system-panel wide">
          {pageId === "integrations" ? (
            <>
              <div className="admin-system-panel-head">
                <div>
                  <span>Connector registry</span>
                  <strong>{integrations.length} connection records</strong>
                </div>
                <button
                  onClick={() =>
                    setIntegrationStatus(selectedIntegration.id, "mock_mode")
                  }
                  disabled={savingSystemAction}
                >
                  <RefreshCcw size={15} />
                  {savingSystemAction ? "Saving" : "Review selected"}
                </button>
              </div>
              <div className="admin-system-integration-grid">
                {integrations.map(integration => (
                  <button
                    key={integration.id}
                    className={
                      integration.id === selectedIntegration.id ? "active" : ""
                    }
                    onClick={() => setSelectedIntegrationId(integration.id)}
                  >
                    <span
                      className={`platform-integration-status ${integrationTone(integration.status)}`}
                    >
                      {formatConnectionStatus(integration.status)}
                    </span>
                    <strong>{integration.label}</strong>
                    <small>
                      {integration.serverOnly
                        ? "Protected connector"
                        : "Browser-safe boundary"}{" "}
                      · {integration.envVars.length || "No"} env vars
                    </small>
                  </button>
                ))}
              </div>
              <div className="admin-system-detail">
                <div>
                  <span className="platform-section-kicker">
                    Selected connector
                  </span>
                  <h3>{selectedIntegration.label}</h3>
                  <p>{selectedIntegration.notes}</p>
                </div>
                <label>
                  Status
                  <select
                    value={selectedIntegration.status}
                    disabled={savingSystemAction}
                    onChange={event =>
                      setIntegrationStatus(
                        selectedIntegration.id,
                        event.target.value as IntegrationStatus
                      )
                    }
                  >
                    <option value="not_configured">Not configured</option>
                    <option value="mock_mode">Test mode</option>
                    <option value="connected">Connected</option>
                    <option value="error">Error</option>
                  </select>
                </label>
                <div className="platform-env-list">
                  {selectedIntegration.envVars.length ? (
                    selectedIntegration.envVars.map(envVar => (
                      <code key={envVar}>{envVar}</code>
                    ))
                  ) : (
                    <code>No env vars required</code>
                  )}
                </div>
                <div className="platform-action-grid">
                  <button
                    onClick={runIntegrationLocalCheck}
                    disabled={savingSystemAction}
                  >
                    Run local check
                  </button>
                  <button disabled={selectedIntegration.status !== "connected"}>
                    Start sync
                  </button>
                </div>
                {systemActionError ? (
                  <div className="platform-empty-state error">
                    <strong>System action was not saved</strong>
                    <span>{systemActionError}</span>
                  </div>
                ) : null}
                {integrationCheck ? <small>{integrationCheck}</small> : null}
                <small>
                  Last sync:{" "}
                  {selectedIntegration.lastSyncAt
                    ? new Date(selectedIntegration.lastSyncAt).toLocaleString()
                    : "Not run"}
                </small>
              </div>
            </>
          ) : null}

          {pageId === "audit-logs" ? (
            <>
              <div className="admin-system-panel-head">
                <div>
                  <span>Activity</span>
                  <strong>{filteredAuditLogs.length} matching events</strong>
                </div>
                <button onClick={exportAuditCsv}>
                  <Download size={15} />
                  Export CSV
                </button>
              </div>
              <div className="admin-system-filters">
                <label>
                  Search activity
                  <input
                    value={auditQuery}
                    onInput={updateAuditQuery}
                    onChange={updateAuditQuery}
                    placeholder="Actor, action, entity, summary"
                  />
                </label>
                <label>
                  Action group
                  <select
                    value={auditFilter}
                    onChange={event => setAuditFilter(event.target.value)}
                  >
                    <option value="All">All</option>
                    {auditActions.map(action => (
                      <option key={action} value={action}>
                        {action}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="admin-system-audit-list">
                {filteredAuditLogs.slice(0, 12).map(audit => (
                  <article key={audit.id}>
                    <span>{audit.action}</span>
                    <div>
                      <strong>{audit.summary}</strong>
                      <small>
                        {audit.entityType} · {audit.entityId}
                      </small>
                    </div>
                    <em>{new Date(audit.createdAt).toLocaleString()}</em>
                  </article>
                ))}
                {!filteredAuditLogs.length ? (
                  <div className="platform-empty-state">
                    <Search size={18} />
                    <strong>No activity matches</strong>
                    <small>Clear the query or action group.</small>
                  </div>
                ) : null}
              </div>
            </>
          ) : null}

          {pageId === "system-health" ? (
            <>
              <div className="admin-system-panel-head">
                <div>
                  <span>Operational checks</span>
                  <strong>{healthScore}% readiness</strong>
                </div>
                <button onClick={runHealthChecks} disabled={savingSystemAction}>
                  <RefreshCcw size={15} />
                  {savingSystemAction ? "Checking" : "Run checks"}
                </button>
              </div>
              {systemActionError ? (
                <div className="platform-empty-state error">
                  <strong>Health check was not saved</strong>
                  <span>{systemActionError}</span>
                </div>
              ) : null}
              <div className="admin-system-health-grid">
                {healthChecks.map(check => (
                  <article key={check.id}>
                    <span
                      className={`platform-integration-status ${integrationTone(check.status)}`}
                    >
                      {formatConnectionStatus(check.status)}
                    </span>
                    <strong>{check.label}</strong>
                    <p>{check.detail}</p>
                    <small>{check.metric}</small>
                  </article>
                ))}
              </div>
            </>
          ) : null}

          {pageId === "settings" ? (
            <>
              <div className="admin-system-panel-head">
                <div>
                  <span>Global platform settings</span>
                  <strong>Governed local configuration</strong>
                </div>
                <ShieldCheck size={18} />
              </div>
              <form
                className="admin-system-settings-form"
                onSubmit={saveSettings}
              >
                <label>
                  Organization
                  <input
                    value={settingsDraft.organization}
                    onChange={event =>
                      setSettingsDraft(value => ({
                        ...value,
                        organization: event.target.value,
                      }))
                    }
                  />
                </label>
                <label>
                  Default language
                  <select
                    value={settingsDraft.defaultLanguage}
                    onChange={event =>
                      setSettingsDraft(value => ({
                        ...value,
                        defaultLanguage: event.target.value,
                      }))
                    }
                  >
                    <option>English</option>
                    <option>Arabic</option>
                    <option>Turkish</option>
                    <option>Russian</option>
                  </select>
                </label>
                <label>
                  Academic term
                  <input
                    value={settingsDraft.academicTerm}
                    onChange={event =>
                      setSettingsDraft(value => ({
                        ...value,
                        academicTerm: event.target.value,
                      }))
                    }
                  />
                </label>
                <label>
                  Activity retention days
                  <input
                    type="number"
                    min="30"
                    value={settingsDraft.retentionDays}
                    onChange={event =>
                      setSettingsDraft(value => ({
                        ...value,
                        retentionDays: event.target.value,
                      }))
                    }
                  />
                </label>
                <div className="admin-system-policy-list">
                  {[
                    "Use protected credentials for Moodle, EMS, payment, email, and WhatsApp.",
                    "Keep browser keys publishable and protected by policies.",
                    "Log operational changes before provider delivery is connected.",
                    "Review activity before changing role or branch access.",
                  ].map(policy => (
                    <span key={policy}>
                      <CheckCircle2 size={15} /> {policy}
                    </span>
                  ))}
                </div>
                {settingsSaveError ? (
                  <div className="platform-empty-state error">
                    <strong>Settings were not saved</strong>
                    <span>{settingsSaveError}</span>
                  </div>
                ) : null}
                <button type="submit" disabled={savingSettings}>
                  <ShieldCheck size={15} />
                  {savingSettings ? "Saving settings" : "Save settings"}
                </button>
              </form>
            </>
          ) : null}
        </section>

        <aside className="admin-system-side">
          <section className="admin-system-panel">
            <div className="admin-system-panel-head">
              <div>
                <span>Connections</span>
                <strong>
                  {connectedCount + mockCount}/{integrations.length} usable
                </strong>
              </div>
              <Server size={18} />
            </div>
            <div className="admin-system-readiness">
              {integrations.map(integration => (
                <button
                  key={integration.id}
                  onClick={() => {
                    setSelectedIntegrationId(integration.id);
                    if (pageId !== "integrations")
                      toast.info(
                        `${integration.label}: ${formatConnectionStatus(integration.status)}`
                      );
                  }}
                >
                  <span
                    className={`platform-integration-status ${integrationTone(integration.status)}`}
                  >
                    {formatConnectionStatus(integration.status)}
                  </span>
                  <strong>{integration.label}</strong>
                </button>
              ))}
            </div>
          </section>

          <section className="admin-system-panel">
            <div className="admin-system-panel-head">
              <div>
                <span>Recent activity</span>
                <strong>Latest 5</strong>
              </div>
              <FileText size={18} />
            </div>
            <div className="admin-system-recent-audit">
              {state.auditLogs.slice(0, 5).map(audit => (
                <article key={audit.id}>
                  <strong>{audit.action}</strong>
                  <small>{audit.summary}</small>
                </article>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

function integrationTone(status: IntegrationStatus) {
  if (status === "connected") return "green";
  if (status === "mock_mode") return "amber";
  if (status === "error") return "red";
  return "slate";
}

function AcademicGovernanceExperience({
  pageId,
  scope,
}: {
  pageId: string;
  scope: "hod" | "admin";
}) {
  const [version, setVersion] = useState(0);
  const [query, setQuery] = useState("");
  const [selectedProgramId, setSelectedProgramId] = useState("");
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [assessmentDraft, setAssessmentDraft] = useState({
    title: "Department oral assessment",
    type: "quiz" as "assignment" | "quiz",
  });
  const [messageDraft, setMessageDraft] = useState({
    recipientId: "",
    subject: "Academic department update",
    body: "Please review the latest curriculum and assessment readiness notes.",
  });
  const [moduleDraft, setModuleDraft] = useState({
    title: "",
    outcomes: "",
  });
  const [moduleSaving, setModuleSaving] = useState(false);
  const [assessmentSaving, setAssessmentSaving] = useState(false);
  const [courseStatusSavingKey, setCourseStatusSavingKey] = useState("");
  const [messageSaving, setMessageSaving] = useState(false);
  const [certificateSavingKey, setCertificateSavingKey] = useState("");
  const [certificateRejectReasons, setCertificateRejectReasons] = useState<
    Record<string, string>
  >({});
  const state = useMemo(() => platformStore.getState(), [version]);
  const refresh = () => setVersion(value => value + 1);
  const actorRole = scope === "admin" ? "superadmin" : "headofdepartment";
  const actorId = getDemoUser(actorRole).id;
  const actorUser = state.users.find(user => user.id === actorId);
  const academicDepartments =
    scope === "admin"
      ? state.departments
      : state.departments.filter(
          department =>
            department.ownerUserId === actorId ||
            department.id === actorUser?.departmentId
        );
  const departmentIds = academicDepartments.map(department => department.id);
  const programs = state.programs.filter(program =>
    departmentIds.includes(program.departmentId)
  );
  const scopedCourses = state.courses.filter(course =>
    programs.some(program => program.id === course.programId)
  );
  const scopedCourseIds = new Set(scopedCourses.map(course => course.id));
  const scopedRuns = state.courseRuns.filter(run =>
    scopedCourseIds.has(run.courseId)
  );
  const scopedRunIds = new Set(scopedRuns.map(run => run.id));
  const scopedClasses = state.classGroups.filter(group =>
    scopedRunIds.has(group.courseRunId)
  );
  const scopedAssignments = state.assignments.filter(assignment =>
    scopedRunIds.has(assignment.courseRunId)
  );
  const scopedQuizzes = state.quizzes.filter(quiz =>
    scopedRunIds.has(quiz.courseRunId)
  );
  const scopedCertificates = state.certificates.filter(certificate =>
    scopedCourseIds.has(certificate.courseId)
  );
  const scopedTeacherUserIds = new Set(
    state.teachers
      .filter(teacher => departmentIds.includes(teacher.departmentId))
      .map(teacher => teacher.userId)
  );
  const scopedStudentIds = new Set(
    state.enrollments
      .filter(enrollment => scopedRunIds.has(enrollment.courseRunId))
      .map(enrollment => enrollment.studentId)
  );
  const scopedStudentUserIds = new Set(
    state.students
      .filter(student => scopedStudentIds.has(student.id))
      .map(student => student.userId)
  );
  const academicRecipientIds = new Set([
    actorId,
    ...Array.from(scopedTeacherUserIds),
    ...Array.from(scopedStudentUserIds),
  ]);
  const academicRecipients = state.users.filter(
    user => user.id !== actorId && academicRecipientIds.has(user.id)
  );
  const academicMessages = state.messages.filter(
    message =>
      academicRecipientIds.has(message.fromUserId) ||
      academicRecipientIds.has(message.toUserId)
  );
  const selectedProgram =
    programs.find(program => program.id === selectedProgramId) ?? programs[0];
  const programCourses = scopedCourses.filter(
    course => course.programId === selectedProgram?.id
  );
  const selectedCourse =
    programCourses.find(course => course.id === selectedCourseId) ??
    programCourses[0];
  const selectedDepartment =
    academicDepartments.find(
      department => department.id === selectedProgram?.departmentId
    ) ?? academicDepartments[0];
  const selectedLevel = state.levels.find(
    level => level.id === selectedCourse?.levelId
  );
  const selectedModules = state.modules
    .filter(module => module.courseId === selectedCourse?.id)
    .sort((a, b) => a.order - b.order);
  const selectedLessons = selectedModules.flatMap(module =>
    state.lessons.filter(lesson => lesson.moduleId === module.id)
  );
  const scopedModules = state.modules.filter(module =>
    scopedCourseIds.has(module.courseId)
  );
  const scopedModuleIds = new Set(scopedModules.map(module => module.id));
  const scopedLessons = state.lessons.filter(lesson =>
    scopedModuleIds.has(lesson.moduleId)
  );
  const activeCourses = scopedCourses.filter(
    course => course.status === "active"
  ).length;
  const classCapacity = scopedClasses.reduce(
    (total, classGroup) => total + classGroup.capacity,
    0
  );
  const enrolledSeats = scopedClasses.reduce(
    (total, classGroup) => total + classGroup.studentIds.length,
    0
  );
  const teacherCount = state.teachers.filter(teacher =>
    departmentIds.includes(teacher.departmentId)
  ).length;
  const academicFocusLabels: Record<string, string> = {
    assessments: "Assessment governance",
    certificates: "Certificate approval",
    reports: "Academic reports",
    messages: "Department messages",
    curriculum: "Curriculum map",
    classes: "Class delivery",
    teachers: "Teaching team",
    levels: "Level structure",
    courses: "Course catalog",
    programs: "Program portfolio",
    departments: "Department ownership",
  };
  const focusLabel =
    scope === "admin"
      ? "Global academic governance"
      : (academicFocusLabels[pageId] ?? "Academic governance");
  const visiblePrograms = programs.filter(program => {
    const department = state.departments.find(
      item => item.id === program.departmentId
    );
    const text =
      `${program.title} ${program.category} ${program.language} ${department?.name ?? ""}`.toLowerCase();
    return text.includes(query.toLowerCase());
  });
  const runAcademicCertificateAction = async (
    actionType:
      | "certificate.approve"
      | "certificate.issue"
      | "certificate.reject",
    certificate: Certificate
  ) => {
    const nextKey = `${actionType}:${certificate.id}`;
    setCertificateSavingKey(nextKey);
    const rejectionReason =
      actionType === "certificate.reject"
        ? (certificateRejectReasons[certificate.id]?.trim() ?? "")
        : "";
    const response = await runPlatformWorkflowActionRequest(
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
    setCertificateSavingKey("");
    if (!response.ok || !response.data) {
      toast.error("Certificate action failed", {
        description:
          response.error ??
          "The server could not save this certificate action.",
      });
      return;
    }

    platformStore.setState(response.data.state);
    refresh();
    const changed = response.data.result.result as Certificate | undefined;
    if (!changed) {
      toast.info(
        actionType === "certificate.issue"
          ? "Approve the certificate before issuing it"
          : actionType === "certificate.reject"
            ? "Certificate state did not change"
            : "Certificate state did not change"
      );
      return;
    }
    toast.success(
      actionType === "certificate.approve"
        ? "Certificate approved"
        : actionType === "certificate.issue"
          ? "Certificate issued"
          : "Certificate rejected",
      {
        description: `${changed.verificationCode} · ${response.data.persistence}`,
      }
    );
  };
  useEffect(() => {
    if (!programs.length) return;
    if (
      !selectedProgramId ||
      !programs.some(program => program.id === selectedProgramId)
    ) {
      setSelectedProgramId(programs[0].id);
    }
  }, [programs, selectedProgramId]);
  useEffect(() => {
    if (!programCourses.length) return;
    if (
      !selectedCourseId ||
      !programCourses.some(course => course.id === selectedCourseId)
    ) {
      setSelectedCourseId(programCourses[0].id);
    }
  }, [programCourses, selectedCourseId]);
  useEffect(() => {
    if (!academicRecipients.length) return;
    if (
      !messageDraft.recipientId ||
      !academicRecipients.some(user => user.id === messageDraft.recipientId)
    ) {
      setMessageDraft(value => ({
        ...value,
        recipientId: academicRecipients[0].id,
      }));
    }
  }, [academicRecipients, messageDraft.recipientId]);
  const auditRows = state.auditLogs
    .filter(audit =>
      /academic|course|program|module|level|curriculum|class|certificate/i.test(
        `${audit.action} ${audit.entityType} ${audit.summary}`
      )
    )
    .slice(0, 5);
  const scopedReportRows = [
    ...programs.map(program => ({
      type: "Program",
      name: program.title,
      status: program.status,
      owner:
        academicDepartments.find(
          department => department.id === program.departmentId
        )?.name ?? "Department",
    })),
    ...state.courses
      .filter(course => scopedCourseIds.has(course.id))
      .map(course => ({
        type: "Course",
        name: course.title,
        status: course.status,
        owner:
          state.levels.find(level => level.id === course.levelId)?.title ??
          "Level",
      })),
    ...scopedClasses.map(classGroup => ({
      type: "Class",
      name: classGroup.name,
      status: `${classGroup.studentIds.length}/${classGroup.capacity}`,
      owner: classGroup.schedule,
    })),
    ...scopedCertificates.map(certificate => ({
      type: "Certificate",
      name: certificate.verificationCode,
      status: certificate.status,
      owner: `${certificate.grade}% grade`,
    })),
  ];
  const scopedClassIds = new Set(
    scopedClasses.map(classGroup => classGroup.id)
  );
  const scopedSessions = state.classSessions.filter(session =>
    scopedClassIds.has(session.classGroupId)
  );
  const scopedAttendance = state.attendance.filter(record =>
    scopedClassIds.has(record.classGroupId)
  );
  const expectedAttendanceRows = scopedSessions.reduce((total, session) => {
    const classGroup = scopedClasses.find(
      item => item.id === session.classGroupId
    );
    return total + (classGroup?.studentIds.length ?? 0);
  }, 0);
  const attendanceStatusCounts = (
    ["present", "late", "absent", "excused"] as AttendanceStatus[]
  ).map(status => ({
    status,
    label: status.charAt(0).toUpperCase() + status.slice(1),
    count: scopedAttendance.filter(record => record.status === status).length,
  }));
  const attendanceCompletion = expectedAttendanceRows
    ? Math.round((scopedAttendance.length / expectedAttendanceRows) * 100)
    : 0;
  const attendanceAuditRows = state.auditLogs
    .filter(
      audit =>
        audit.action === "attendance.saved" &&
        scopedClassIds.has(audit.entityId)
    )
    .slice(0, 4);
  const scopedAssignmentIds = new Set(
    scopedAssignments.map(assignment => assignment.id)
  );
  const scopedQuizIds = new Set(scopedQuizzes.map(quiz => quiz.id));
  const scopedSubmissions = state.assignmentSubmissions.filter(submission =>
    scopedAssignmentIds.has(submission.assignmentId)
  );
  const scopedAttempts = state.quizAttempts.filter(attempt =>
    scopedQuizIds.has(attempt.quizId)
  );
  const expectedAssessmentRows =
    scopedStudentIds.size * (scopedAssignments.length + scopedQuizzes.length);
  const completedAssessmentRows =
    scopedSubmissions.filter(submission => submission.status === "completed")
      .length +
    scopedAttempts.filter(attempt => attempt.status === "completed").length;
  const assessmentCompletion = expectedAssessmentRows
    ? Math.round((completedAssessmentRows / expectedAssessmentRows) * 100)
    : 0;
  const teacherLoadRows = state.teachers
    .filter(teacher => departmentIds.includes(teacher.departmentId))
    .map(teacher => {
      const user = state.users.find(item => item.id === teacher.userId);
      const teacherRuns = scopedRuns.filter(
        run => run.teacherId === teacher.userId
      );
      const teacherClasses = scopedClasses.filter(classGroup =>
        teacherRuns.some(run => run.id === classGroup.courseRunId)
      );
      const teacherStudents = new Set(
        teacherClasses.flatMap(classGroup => classGroup.studentIds)
      );
      return {
        id: teacher.id,
        name: user?.name ?? "Teacher",
        status: teacher.availabilityStatus,
        classes: teacherClasses.length,
        students: teacherStudents.size,
      };
    });
  const courseHealthRows = scopedCourses.map(course => {
    const modules = state.modules.filter(
      module => module.courseId === course.id
    );
    const moduleIds = new Set(modules.map(module => module.id));
    const lessons = state.lessons.filter(lesson =>
      moduleIds.has(lesson.moduleId)
    );
    const runs = scopedRuns.filter(run => run.courseId === course.id);
    const runIds = new Set(runs.map(run => run.id));
    const classes = scopedClasses.filter(classGroup =>
      runIds.has(classGroup.courseRunId)
    );
    const enrollments = state.enrollments.filter(enrollment =>
      runIds.has(enrollment.courseRunId)
    );
    const averageProgress = enrollments.length
      ? Math.round(
          enrollments.reduce(
            (total, enrollment) => total + enrollment.progress,
            0
          ) / enrollments.length
        )
      : 0;
    const coverage = modules.length
      ? Math.min(100, Math.round((lessons.length / (modules.length * 3)) * 100))
      : 0;
    return {
      course,
      modules: modules.length,
      lessons: lessons.length,
      classes: classes.length,
      enrollments: enrollments.length,
      averageProgress,
      coverage,
    };
  });
  const atRiskStudents = state.enrollments
    .filter(enrollment => scopedRunIds.has(enrollment.courseRunId))
    .filter(
      enrollment =>
        enrollment.attendanceRate < 85 ||
        enrollment.currentGrade < 80 ||
        enrollment.progress < 55
    )
    .map(enrollment => {
      const student = state.students.find(
        item => item.id === enrollment.studentId
      );
      const user = state.users.find(item => item.id === student?.userId);
      const run = state.courseRuns.find(
        item => item.id === enrollment.courseRunId
      );
      const course = state.courses.find(item => item.id === run?.courseId);
      return {
        enrollment,
        studentName: user?.name ?? "Student",
        courseTitle: course?.title ?? "Course",
      };
    })
    .slice(0, 5);
  const certificateQueue = scopedCertificates.filter(certificate =>
    ["pending_approval", "approved", "rejected"].includes(certificate.status)
  );

  const updateCourseStatus = async (
    courseId: string,
    status: Extract<EntityStatus, "draft" | "active" | "paused" | "completed">
  ) => {
    setCourseStatusSavingKey(courseId);
    const response = await runPlatformWorkflowActionRequest({
      type: "course.status.update",
      courseId,
      status,
      actorId,
    });
    setCourseStatusSavingKey("");
    if (!response.ok || !response.data) {
      toast.error("Course status could not be saved", {
        description:
          response.error ?? "The server could not save this course status.",
      });
      return;
    }
    platformStore.setState(response.data.state);
    refresh();
    toast.success("Course status updated", {
      description: response.data.persistence,
    });
  };

  const addModule = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedCourse || !moduleDraft.title.trim()) {
      toast.error("Module title is required");
      return;
    }
    setModuleSaving(true);
    const response = await runPlatformWorkflowActionRequest({
      type: "curriculum.module.create",
      courseId: selectedCourse.id,
      title: moduleDraft.title.trim(),
      outcomes: moduleDraft.outcomes
        .split(",")
        .map(item => item.trim())
        .filter(Boolean),
      actorId,
    });
    setModuleSaving(false);
    if (!response.ok || !response.data) {
      toast.error("Module could not be saved", {
        description:
          response.error ?? "The server could not save this curriculum module.",
      });
      return;
    }
    platformStore.setState(response.data.state);
    setModuleDraft({ title: "", outcomes: "" });
    refresh();
    toast.success("Module added", {
      description: `${selectedCourse.title} · ${response.data.persistence}`,
    });
  };

  const selectProgram = (programId: string) => {
    setSelectedProgramId(programId);
    const course = scopedCourses.find(item => item.programId === programId);
    if (course) setSelectedCourseId(course.id);
  };

  const createAssessment = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedCourse || !assessmentDraft.title.trim()) {
      toast.error("Assessment title is required");
      return;
    }
    const run =
      scopedRuns.find(item => item.courseId === selectedCourse.id) ??
      scopedRuns[0];
    if (!run) {
      toast.error("Create a course run before creating assessments");
      return;
    }
    setAssessmentSaving(true);
    const response =
      assessmentDraft.type === "quiz"
        ? await runPlatformWorkflowActionRequest({
            type: "quiz.create",
            courseRunId: run.id,
            title: assessmentDraft.title.trim(),
            dueAt: getDefaultDueAt(2),
            durationMinutes: 30,
            attemptsAllowed: 1,
            questionTypes: ["multiple_choice", "short_answer", "oral_record"],
            actorId,
          })
        : await runPlatformWorkflowActionRequest({
            type: "assignment.create",
            courseRunId: run.id,
            title: assessmentDraft.title.trim(),
            dueAt: getDefaultDueAt(7),
            submissionType: "text",
            rubric: ["Accuracy", "Fluency", "Teacher feedback"],
            actorId,
          });
    setAssessmentSaving(false);
    if (!response.ok || !response.data) {
      toast.error("Assessment could not be created", {
        description:
          response.error ??
          "The server could not save this academic assessment.",
      });
      return;
    }
    platformStore.setState(response.data.state);
    setAssessmentDraft({ title: "", type: "quiz" });
    refresh();
    toast.success("Assessment added to academic plan", {
      description: response.data.persistence,
    });
  };

  const sendAcademicMessage = async (event: React.FormEvent) => {
    event.preventDefault();
    if (
      !messageDraft.recipientId ||
      !messageDraft.subject.trim() ||
      !messageDraft.body.trim()
    ) {
      toast.error("Recipient, subject, and body are required");
      return;
    }
    setMessageSaving(true);
    const response = await runPlatformWorkflowActionRequest({
      type: "message.send",
      toUserId: messageDraft.recipientId,
      subject: messageDraft.subject.trim(),
      body: messageDraft.body.trim(),
      channel: "in_app",
      actorId,
    });
    setMessageSaving(false);
    if (!response.ok || !response.data) {
      toast.error("Academic message could not be sent", {
        description: response.error ?? "The server rejected this message.",
      });
      return;
    }
    platformStore.setState(response.data.state);
    setMessageDraft(value => ({ ...value, subject: "", body: "" }));
    refresh();
    toast.success("Academic message sent", {
      description: response.data.persistence,
    });
  };

  const exportAcademicCsv = () => {
    const csv = platformStore.buildCsv(scopedReportRows);
    if (!csv) {
      toast.info("No academic rows to export");
      return;
    }
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${scope === "admin" ? "admin" : "hod"}-academic-report.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    toast.success("Academic CSV exported", {
      description: `${scopedReportRows.length} row(s)`,
    });
  };
  const academicNavItems = (
    scope === "admin"
      ? [
          ["Departments", "departments", Building2],
          ["Programs", "programs", BookOpen],
          ["Courses", "courses", Layers],
          ["Moodle", "moodle-source", Database],
        ]
      : [
          ["Departments", "departments", Building2],
          ["Programs", "programs", BookOpen],
          ["Courses", "courses", Layers],
          ["Levels", "levels", SlidersHorizontal],
          ["Moodle", "moodle-source", Database],
          ["Curriculum", "curriculum", FileText],
          ["Teachers", "teachers", Users],
          ["Classes", "classes", CalendarDays],
          ["Assessments", "assessments", ClipboardList],
          ["Certificates", "certificates", ShieldCheck],
          ["Reports", "reports", Database],
          ["Messages", "messages", MessageSquare],
        ]
  ) as Array<[string, string, typeof BookOpen]>;
  const adminAcademicCopy: Record<
    string,
    { title: string; description: string; context: string }
  > = {
    departments: {
      title: "Departments",
      description:
        "Manage academic ownership, programs, and teaching coverage.",
      context: "Department ownership",
    },
    programs: {
      title: "Programs",
      description: "Review program structure, levels, and course coverage.",
      context: "Program structure",
    },
    courses: {
      title: "Courses",
      description: "Update course status and maintain curriculum modules.",
      context: "Course catalog",
    },
  };

  if (scope === "admin") {
    const pageCopy = adminAcademicCopy[pageId] ?? adminAcademicCopy.departments;

    return (
      <div
        className={`academic-governance-workspace admin-academic-focused admin-academic-${pageId}`}
      >
        <PlatformWorkspaceHeader
          className="academic-governance-hero"
          title={pageCopy.title}
          description={pageCopy.description}
          context={<span>{pageCopy.context}</span>}
          actionsClassName="academic-governance-actions"
          actions={
            <>
              {academicNavItems.map(([label, routeId, Icon]) => (
                <Link
                  key={String(routeId)}
                  href={`/app/admin/${routeId}`}
                  className={pageId === routeId ? "active" : ""}
                  aria-current={pageId === routeId ? "page" : undefined}
                >
                  <Icon size={15} />
                  {label as string}
                </Link>
              ))}
            </>
          }
        />

        <div className="academic-governance-kpis">
          <AdminAccessMetric
            label="Departments"
            value={String(academicDepartments.length)}
          />
          <AdminAccessMetric label="Programs" value={String(programs.length)} />
          <AdminAccessMetric
            label="Active courses"
            value={`${activeCourses}/${scopedCourses.length}`}
          />
          <AdminAccessMetric label="Teachers" value={String(teacherCount)} />
        </div>

        {pageId === "departments" ? (
          <div className="admin-academic-focus-grid departments">
            <section className="academic-panel academic-program-rail">
              <div className="academic-panel-head">
                <div>
                  <span>Department directory</span>
                  <strong>{academicDepartments.length} departments</strong>
                </div>
                <Building2 size={18} />
              </div>
              <div className="academic-program-list">
                {academicDepartments.map(department => {
                  const departmentPrograms = programs.filter(
                    program => program.departmentId === department.id
                  );
                  const departmentTeachers = state.teachers.filter(
                    teacher => teacher.departmentId === department.id
                  );
                  return (
                    <button
                      key={department.id}
                      className={
                        selectedDepartment?.id === department.id ? "active" : ""
                      }
                      onClick={() => {
                        const program = programs.find(
                          item => item.departmentId === department.id
                        );
                        if (program) selectProgram(program.id);
                      }}
                    >
                      <span>{department.name.slice(0, 2).toUpperCase()}</span>
                      <div>
                        <strong>{department.name}</strong>
                        <small>
                          {departmentPrograms.length} programs ·{" "}
                          {departmentTeachers.length} teachers
                        </small>
                      </div>
                      <em>{department.status}</em>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="academic-panel admin-academic-summary-panel">
              <div className="academic-panel-head">
                <div>
                  <span>Department profile</span>
                  <strong>{selectedDepartment?.name ?? "No department"}</strong>
                </div>
                <Users size={18} />
              </div>
              <div className="academic-course-stats">
                <article>
                  <span>Programs</span>
                  <strong>
                    {
                      programs.filter(
                        program =>
                          program.departmentId === selectedDepartment?.id
                      ).length
                    }
                  </strong>
                </article>
                <article>
                  <span>Teachers</span>
                  <strong>
                    {
                      state.teachers.filter(
                        teacher =>
                          teacher.departmentId === selectedDepartment?.id
                      ).length
                    }
                  </strong>
                </article>
                <article>
                  <span>Branches</span>
                  <strong>{selectedDepartment?.branchIds.length ?? 0}</strong>
                </article>
              </div>
              <div className="academic-class-list compact">
                {programs
                  .filter(
                    program => program.departmentId === selectedDepartment?.id
                  )
                  .map(program => (
                    <article key={program.id}>
                      <div>
                        <strong>{program.title}</strong>
                        <small>
                          {program.language} · {program.category}
                        </small>
                      </div>
                      <span>{program.status}</span>
                    </article>
                  ))}
              </div>
            </section>
          </div>
        ) : null}

        {pageId === "programs" ? (
          <div className="admin-academic-focus-grid programs">
            <section className="academic-panel academic-program-rail">
              <div className="academic-panel-head">
                <div>
                  <span>Program portfolio</span>
                  <strong>{visiblePrograms.length} programs</strong>
                </div>
                <BookOpen size={18} />
              </div>
              <div className="platform-toolbar-search academic-search">
                <Search size={15} />
                <input
                  aria-label="Search academic programs and departments"
                  value={query}
                  onChange={event => setQuery(event.target.value)}
                  placeholder="Search programs"
                />
              </div>
              <div className="academic-program-list">
                {visiblePrograms.map(program => {
                  const department = state.departments.find(
                    item => item.id === program.departmentId
                  );
                  const courses = state.courses.filter(
                    course => course.programId === program.id
                  );
                  const levels = state.levels.filter(
                    level => level.programId === program.id
                  );
                  return (
                    <button
                      key={program.id}
                      className={
                        selectedProgram?.id === program.id ? "active" : ""
                      }
                      onClick={() => selectProgram(program.id)}
                    >
                      <span>{program.category.slice(0, 2).toUpperCase()}</span>
                      <div>
                        <strong>{program.title}</strong>
                        <small>
                          {department?.name ?? "No department"} ·{" "}
                          {courses.length} courses · {levels.length} levels
                        </small>
                      </div>
                      <em>{program.status}</em>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="academic-panel academic-level-panel">
              <div className="academic-panel-head">
                <div>
                  <span>Level structure</span>
                  <strong>{selectedProgram?.title ?? "Program"}</strong>
                </div>
                <Layers size={18} />
              </div>
              <div className="academic-level-list">
                {state.levels
                  .filter(level => level.programId === selectedProgram?.id)
                  .sort((a, b) => a.order - b.order)
                  .map(level => (
                    <article
                      key={level.id}
                      className={selectedLevel?.id === level.id ? "active" : ""}
                    >
                      <div>
                        <strong>{level.title}</strong>
                        <small>{level.prerequisites.join(" · ")}</small>
                      </div>
                      <div>
                        {level.completionRules.map(rule => (
                          <span key={rule}>{rule}</span>
                        ))}
                      </div>
                    </article>
                  ))}
              </div>
            </section>
          </div>
        ) : null}

        {pageId === "courses" ? (
          <div className="admin-academic-focus-grid courses">
            <section className="academic-panel academic-catalog-panel">
              <div className="academic-panel-head">
                <div>
                  <span>Course catalog</span>
                  <strong>
                    {selectedProgram?.title ?? "No program selected"}
                  </strong>
                </div>
                <select
                  value={selectedCourse?.id ?? ""}
                  onChange={event => setSelectedCourseId(event.target.value)}
                  aria-label="Selected course"
                >
                  {programCourses.map(course => (
                    <option key={course.id} value={course.id}>
                      {course.title}
                    </option>
                  ))}
                </select>
              </div>

              {selectedCourse ? (
                <div className="academic-course-profile">
                  <div>
                    <span>{selectedLevel?.title ?? "No level"}</span>
                    <h3>{selectedCourse.title}</h3>
                    <p>{selectedCourse.description}</p>
                  </div>
                  <label>
                    Course status
                    <select
                      value={selectedCourse.status}
                      disabled={courseStatusSavingKey === selectedCourse.id}
                      onChange={event =>
                        void updateCourseStatus(
                          selectedCourse.id,
                          event.target.value as Extract<
                            EntityStatus,
                            "draft" | "active" | "paused" | "completed"
                          >
                        )
                      }
                    >
                      <option value="draft">Draft</option>
                      <option value="active">Active</option>
                      <option value="paused">Paused</option>
                      <option value="completed">Completed</option>
                    </select>
                  </label>
                </div>
              ) : null}

              <div className="academic-outcome-list">
                {(selectedCourse?.outcomes ?? []).map(outcome => (
                  <span key={outcome}>
                    <CheckCircle2 size={14} />
                    {outcome}
                  </span>
                ))}
              </div>
              <div className="academic-course-stats">
                <article>
                  <span>Modules</span>
                  <strong>{selectedModules.length}</strong>
                </article>
                <article>
                  <span>Lessons</span>
                  <strong>{selectedLessons.length}</strong>
                </article>
                <article>
                  <span>Resources</span>
                  <strong>
                    {
                      state.resources.filter(resource =>
                        selectedLessons.some(lesson =>
                          lesson.resourceIds.includes(resource.id)
                        )
                      ).length
                    }
                  </strong>
                </article>
              </div>
            </section>

            <section className="academic-panel academic-curriculum-panel">
              <div className="academic-panel-head">
                <div>
                  <span>Curriculum builder</span>
                  <strong>{selectedCourse?.title ?? "Course"}</strong>
                </div>
                <FileText size={18} />
              </div>
              <div className="academic-module-list">
                {selectedModules.map(module => {
                  const lessons = state.lessons.filter(
                    lesson => lesson.moduleId === module.id
                  );
                  return (
                    <article key={module.id}>
                      <div>
                        <strong>
                          {module.order}. {module.title}
                        </strong>
                        <small>
                          {lessons.length} lessons ·{" "}
                          {module.outcomes.join(", ")}
                        </small>
                      </div>
                      <em>
                        {lessons.reduce(
                          (sum, lesson) => sum + lesson.durationMinutes,
                          0
                        )}{" "}
                        min
                      </em>
                    </article>
                  );
                })}
              </div>
              <form className="academic-module-form" onSubmit={addModule}>
                <label>
                  Module title
                  <input
                    value={moduleDraft.title}
                    onChange={event =>
                      setModuleDraft(value => ({
                        ...value,
                        title: event.target.value,
                      }))
                    }
                    placeholder="New curriculum module"
                  />
                </label>
                <label>
                  Outcomes
                  <input
                    value={moduleDraft.outcomes}
                    onChange={event =>
                      setModuleDraft(value => ({
                        ...value,
                        outcomes: event.target.value,
                      }))
                    }
                    placeholder="Outcome one, outcome two"
                  />
                </label>
                <button type="submit" disabled={moduleSaving}>
                  <Plus size={15} />
                  {moduleSaving ? "Adding..." : "Add module"}
                </button>
              </form>
            </section>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="academic-governance-workspace">
      <PlatformWorkspaceHeader
        className="academic-governance-hero"
        title="Academic governance"
        description="Manage programs, courses, curriculum, teachers, classes, and academic approvals."
        context={<span>{focusLabel}</span>}
        actionsClassName="academic-governance-actions"
        actions={
          <>
            {academicNavItems.map(([label, routeId, Icon]) => (
              <Link
                key={String(routeId)}
                href={`/app/hod/${routeId}`}
                className={pageId === routeId ? "active" : ""}
                aria-current={pageId === routeId ? "page" : undefined}
              >
                <Icon size={15} />
                {label as string}
              </Link>
            ))}
          </>
        }
      />

      <div className="academic-governance-kpis">
        <AdminAccessMetric label="Programs" value={String(programs.length)} />
        <AdminAccessMetric
          label="Active courses"
          value={`${activeCourses}/${scopedCourses.length}`}
        />
        <AdminAccessMetric label="Teachers" value={String(teacherCount)} />
        <AdminAccessMetric
          label="Seat usage"
          value={`${enrolledSeats}/${classCapacity}`}
        />
        <AdminAccessMetric
          label="Lessons"
          value={String(scopedLessons.length)}
        />
      </div>

      {scope === "hod" ? (
        <div className="academic-oversight-grid">
          <section className="academic-panel">
            <div className="academic-panel-head">
              <div>
                <span>Course health</span>
                <strong>{courseHealthRows.length} department courses</strong>
              </div>
              <Activity size={18} />
            </div>
            <div className="academic-health-list">
              {courseHealthRows.slice(0, 4).map(row => (
                <article key={row.course.id}>
                  <div>
                    <strong>{row.course.title}</strong>
                    <small>
                      {row.modules} modules · {row.lessons} lessons ·{" "}
                      {row.enrollments} enrollments
                    </small>
                  </div>
                  <span>{row.coverage}% coverage</span>
                  <em>{row.averageProgress}% progress</em>
                </article>
              ))}
            </div>
          </section>

          <section className="academic-panel">
            <div className="academic-panel-head">
              <div>
                <span>Teacher load</span>
                <strong>{teacherLoadRows.length} faculty profiles</strong>
              </div>
              <Users size={18} />
            </div>
            <div className="academic-health-list">
              {teacherLoadRows.slice(0, 4).map(teacher => (
                <article key={teacher.id}>
                  <div>
                    <strong>{teacher.name}</strong>
                    <small>
                      {teacher.classes} classes · {teacher.students} learners
                    </small>
                  </div>
                  <span>{teacher.status.replace("_", " ")}</span>
                </article>
              ))}
            </div>
          </section>

          <section className="academic-panel">
            <div className="academic-panel-head">
              <div>
                <span>Academic risk</span>
                <strong>{atRiskStudents.length} learners need review</strong>
              </div>
              <AlertTriangle size={18} />
            </div>
            <div className="academic-health-list">
              {atRiskStudents.length ? (
                atRiskStudents.map(row => (
                  <article key={row.enrollment.id}>
                    <div>
                      <strong>{row.studentName}</strong>
                      <small>
                        {row.courseTitle} · {row.enrollment.progress}% progress
                      </small>
                    </div>
                    <span>{row.enrollment.attendanceRate}% att.</span>
                    <em>{row.enrollment.currentGrade}% grade</em>
                  </article>
                ))
              ) : (
                <article>
                  <div>
                    <strong>No current risk flags</strong>
                    <small>
                      Attendance, progress, and grade thresholds are clear in
                      this department.
                    </small>
                  </div>
                </article>
              )}
            </div>
          </section>
        </div>
      ) : null}

      {pageId === "reports" ? (
        <section className="academic-panel academic-attendance-panel">
          <div className="academic-panel-head">
            <div>
              <span>Attendance health</span>
              <strong>
                {
                  scopedSessions.filter(session => session.attendanceSaved)
                    .length
                }
                /{scopedSessions.length} saved sessions
              </strong>
            </div>
            <ClipboardCheck size={18} />
          </div>
          <div className="academic-course-stats">
            <article>
              <span>Saved sessions</span>
              <strong>
                {
                  scopedSessions.filter(session => session.attendanceSaved)
                    .length
                }
              </strong>
            </article>
            <article>
              <span>Pending sessions</span>
              <strong>
                {
                  scopedSessions.filter(session => !session.attendanceSaved)
                    .length
                }
              </strong>
            </article>
            <article>
              <span>Roster records</span>
              <strong>
                {scopedAttendance.length}/{expectedAttendanceRows}
              </strong>
            </article>
            <article>
              <span>Completion</span>
              <strong>{attendanceCompletion}%</strong>
            </article>
          </div>
          <div className="platform-attendance-status-grid">
            {attendanceStatusCounts.map(item => (
              <article key={item.status}>
                <span className={`platform-attendance-chip ${item.status}`}>
                  {item.label}
                </span>
                <strong>{item.count}</strong>
              </article>
            ))}
          </div>
          <div className="academic-class-list compact">
            {scopedSessions.slice(0, 4).map(session => {
              const classGroup = scopedClasses.find(
                item => item.id === session.classGroupId
              );
              return (
                <article key={session.id}>
                  <div>
                    <strong>{session.title}</strong>
                    <small>
                      {classGroup?.name ?? "Class"} ·{" "}
                      {new Date(session.startsAt).toLocaleString()}
                    </small>
                  </div>
                  <span>{session.attendanceSaved ? "saved" : "pending"}</span>
                </article>
              );
            })}
          </div>
          <div className="academic-class-list compact">
            {attendanceAuditRows.length ? (
              attendanceAuditRows.map(audit => (
                <article key={audit.id}>
                  <div>
                    <strong>Attendance saved</strong>
                    <small>{audit.summary}</small>
                  </div>
                  <span>{new Date(audit.createdAt).toLocaleDateString()}</span>
                </article>
              ))
            ) : (
              <article>
                <div>
                  <strong>No attendance audit rows</strong>
                  <small>
                    Saved attendance will appear after a teacher or branch admin
                    marks a session.
                  </small>
                </div>
              </article>
            )}
          </div>
        </section>
      ) : null}

      <div className="academic-governance-layout">
        <section className="academic-panel academic-program-rail">
          <div className="academic-panel-head">
            <div>
              <span>Program portfolio</span>
              <strong>{visiblePrograms.length} programs</strong>
            </div>
            <BookOpen size={18} />
          </div>
          <div className="platform-toolbar-search academic-search">
            <Search size={15} />
            <input
              aria-label="Search academic programs and departments"
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder="Search programs, departments"
            />
          </div>
          <div className="academic-program-list">
            {visiblePrograms.map(program => {
              const department = state.departments.find(
                item => item.id === program.departmentId
              );
              const courses = state.courses.filter(
                course => course.programId === program.id
              );
              const levels = state.levels.filter(
                level => level.programId === program.id
              );
              return (
                <button
                  key={program.id}
                  className={selectedProgram?.id === program.id ? "active" : ""}
                  onClick={() => selectProgram(program.id)}
                >
                  <span>{program.category.slice(0, 2).toUpperCase()}</span>
                  <div>
                    <strong>{program.title}</strong>
                    <small>
                      {department?.name ?? "No department"} · {courses.length}{" "}
                      courses · {levels.length} levels
                    </small>
                  </div>
                  <em>{program.status}</em>
                </button>
              );
            })}
          </div>
        </section>

        <section className="academic-panel academic-catalog-panel">
          <div className="academic-panel-head">
            <div>
              <span>Course catalog</span>
              <strong>{selectedProgram?.title ?? "No program selected"}</strong>
            </div>
            <select
              value={selectedCourse?.id ?? ""}
              onChange={event => setSelectedCourseId(event.target.value)}
              aria-label="Selected course"
            >
              {programCourses.map(course => (
                <option key={course.id} value={course.id}>
                  {course.title}
                </option>
              ))}
            </select>
          </div>

          {selectedCourse ? (
            <div className="academic-course-profile">
              <div>
                <span>{selectedLevel?.title ?? "No level"}</span>
                <h3>{selectedCourse.title}</h3>
                <p>{selectedCourse.description}</p>
              </div>
              <label>
                Course status
                <select
                  value={selectedCourse.status}
                  disabled={courseStatusSavingKey === selectedCourse.id}
                  onChange={event =>
                    void updateCourseStatus(
                      selectedCourse.id,
                      event.target.value as Extract<
                        EntityStatus,
                        "draft" | "active" | "paused" | "completed"
                      >
                    )
                  }
                >
                  <option value="draft">Draft</option>
                  <option value="active">Active</option>
                  <option value="paused">Paused</option>
                  <option value="completed">Completed</option>
                </select>
              </label>
            </div>
          ) : null}

          <div className="academic-outcome-list">
            {(selectedCourse?.outcomes ?? []).map(outcome => (
              <span key={outcome}>
                <CheckCircle2 size={14} />
                {outcome}
              </span>
            ))}
          </div>

          <div className="academic-course-stats">
            <article>
              <span>Modules</span>
              <strong>{selectedModules.length}</strong>
            </article>
            <article>
              <span>Lessons</span>
              <strong>{selectedLessons.length}</strong>
            </article>
            <article>
              <span>Resources</span>
              <strong>
                {
                  state.resources.filter(resource =>
                    selectedLessons.some(lesson =>
                      lesson.resourceIds.includes(resource.id)
                    )
                  ).length
                }
              </strong>
            </article>
          </div>
        </section>

        <section className="academic-panel academic-team-panel">
          <div className="academic-panel-head">
            <div>
              <span>Teaching team</span>
              <strong>{teacherCount} teachers</strong>
            </div>
            <Users size={18} />
          </div>
          <div className="academic-teacher-list">
            {state.teachers
              .filter(teacher => departmentIds.includes(teacher.departmentId))
              .map(teacher => {
                const user = state.users.find(
                  item => item.id === teacher.userId
                );
                const classes = state.courseRuns.filter(
                  run => run.teacherId === teacher.userId
                ).length;
                return (
                  <article key={teacher.id}>
                    <span>
                      {user?.name
                        .split(" ")
                        .map(part => part[0])
                        .join("")
                        .slice(0, 2) ?? "TC"}
                    </span>
                    <div>
                      <strong>{user?.name ?? "Teacher"}</strong>
                      <small>
                        {teacher.specialties.join(", ")} · {classes} active runs
                      </small>
                    </div>
                  </article>
                );
              })}
          </div>
        </section>
      </div>

      <div className="academic-governance-lower-grid">
        <section className="academic-panel academic-level-panel">
          <div className="academic-panel-head">
            <div>
              <span>Level structure</span>
              <strong>{selectedProgram?.title ?? "Program"}</strong>
            </div>
            <Layers size={18} />
          </div>
          <div className="academic-level-list">
            {state.levels
              .filter(level => level.programId === selectedProgram?.id)
              .sort((a, b) => a.order - b.order)
              .map(level => (
                <article
                  key={level.id}
                  className={selectedLevel?.id === level.id ? "active" : ""}
                >
                  <div>
                    <strong>{level.title}</strong>
                    <small>{level.prerequisites.join(" · ")}</small>
                  </div>
                  <div>
                    {level.completionRules.map(rule => (
                      <span key={rule}>{rule}</span>
                    ))}
                  </div>
                </article>
              ))}
          </div>
        </section>

        <section className="academic-panel academic-curriculum-panel">
          <div className="academic-panel-head">
            <div>
              <span>Curriculum builder</span>
              <strong>{selectedCourse?.title ?? "Course"}</strong>
            </div>
            <FileText size={18} />
          </div>
          <div className="academic-module-list">
            {selectedModules.map(module => {
              const lessons = state.lessons.filter(
                lesson => lesson.moduleId === module.id
              );
              return (
                <article key={module.id}>
                  <div>
                    <strong>
                      {module.order}. {module.title}
                    </strong>
                    <small>
                      {lessons.length} lessons · {module.outcomes.join(", ")}
                    </small>
                  </div>
                  <em>
                    {lessons.reduce(
                      (sum, lesson) => sum + lesson.durationMinutes,
                      0
                    )}{" "}
                    min
                  </em>
                </article>
              );
            })}
          </div>
          <form className="academic-module-form" onSubmit={addModule}>
            <label>
              Module title
              <input
                value={moduleDraft.title}
                onChange={event =>
                  setModuleDraft(value => ({
                    ...value,
                    title: event.target.value,
                  }))
                }
                placeholder="New curriculum module"
              />
            </label>
            <label>
              Outcomes
              <input
                value={moduleDraft.outcomes}
                onChange={event =>
                  setModuleDraft(value => ({
                    ...value,
                    outcomes: event.target.value,
                  }))
                }
                placeholder="Outcome one, outcome two"
              />
            </label>
            <button type="submit" disabled={moduleSaving}>
              <Plus size={15} />
              {moduleSaving ? "Adding..." : "Add module"}
            </button>
          </form>
        </section>

        <section className="academic-panel academic-class-panel">
          <div className="academic-panel-head">
            <div>
              <span>Class delivery</span>
              <strong>{scopedClasses.length} groups</strong>
            </div>
            <CalendarDays size={18} />
          </div>
          <div className="academic-class-list">
            {scopedClasses.map(classGroup => {
              const run = state.courseRuns.find(
                item => item.id === classGroup.courseRunId
              );
              const course = state.courses.find(
                item => item.id === run?.courseId
              );
              const teacherUser = state.users.find(
                item => item.id === run?.teacherId
              );
              return (
                <article key={classGroup.id}>
                  <div>
                    <strong>{classGroup.name}</strong>
                    <small>
                      {course?.title ?? "No course"} ·{" "}
                      {teacherUser?.name ?? "No teacher"}
                    </small>
                  </div>
                  <span>
                    {classGroup.studentIds.length}/{classGroup.capacity}
                  </span>
                  <em>{classGroup.schedule}</em>
                </article>
              );
            })}
          </div>
        </section>

        <section className="academic-panel academic-audit-panel">
          <div className="academic-panel-head">
            <div>
              <span>Academic audit</span>
              <strong>Recent changes</strong>
            </div>
            <ShieldCheck size={18} />
          </div>
          <div className="admin-audit-list">
            {auditRows.length ? (
              auditRows.map(auditRow => (
                <article key={auditRow.id}>
                  <strong>{auditRow.action}</strong>
                  <small>{auditRow.summary}</small>
                  <span>{new Date(auditRow.createdAt).toLocaleString()}</span>
                </article>
              ))
            ) : (
              <article>
                <strong>academic.ready</strong>
                <small>Academic workspace is connected to system data.</small>
                <span>Now</span>
              </article>
            )}
          </div>
        </section>
      </div>

      <div className="academic-governance-lower-grid academic-operations-grid">
        <section className="academic-panel academic-assessment-panel">
          <div className="academic-panel-head">
            <div>
              <span>Assessment command</span>
              <strong>{assessmentCompletion}% completion</strong>
            </div>
            <ClipboardList size={18} />
          </div>
          <div className="academic-course-stats">
            <article>
              <span>Assignments</span>
              <strong>{scopedAssignments.length}</strong>
            </article>
            <article>
              <span>Quizzes</span>
              <strong>{scopedQuizzes.length}</strong>
            </article>
            <article>
              <span>Completed</span>
              <strong>
                {completedAssessmentRows}/{expectedAssessmentRows}
              </strong>
            </article>
          </div>
          <div className="academic-module-list">
            {[...scopedAssignments, ...scopedQuizzes].slice(0, 5).map(item => (
              <article key={item.id}>
                <div>
                  <strong>{item.title}</strong>
                  <small>
                    {item.status} · due{" "}
                    {new Date(item.dueAt).toLocaleDateString()}
                  </small>
                </div>
                <em>
                  {"submissionType" in item
                    ? item.submissionType
                    : `${item.attemptsAllowed} attempts`}
                </em>
              </article>
            ))}
          </div>
          <form className="academic-module-form" onSubmit={createAssessment}>
            <label>
              Assessment title
              <input
                value={assessmentDraft.title}
                onChange={event =>
                  setAssessmentDraft(value => ({
                    ...value,
                    title: event.target.value,
                  }))
                }
                placeholder="Department assessment title"
              />
            </label>
            <label>
              Type
              <select
                value={assessmentDraft.type}
                onChange={event =>
                  setAssessmentDraft(value => ({
                    ...value,
                    type: event.target.value as "assignment" | "quiz",
                  }))
                }
              >
                <option value="quiz">Quiz</option>
                <option value="assignment">Assignment</option>
              </select>
            </label>
            <button type="submit" disabled={assessmentSaving}>
              <Plus size={15} />
              {assessmentSaving ? "Creating..." : "Create assessment"}
            </button>
          </form>
        </section>

        <section className="academic-panel academic-certificate-panel">
          <div className="academic-panel-head">
            <div>
              <span>Certificate approvals</span>
              <strong>{certificateQueue.length} in review</strong>
            </div>
            <ShieldCheck size={18} />
          </div>
          <div className="academic-class-list">
            {scopedCertificates.length ? (
              scopedCertificates.map(certificate => {
                const student = state.students.find(
                  item => item.id === certificate.studentId
                );
                const user = state.users.find(
                  item => item.id === student?.userId
                );
                const course = state.courses.find(
                  item => item.id === certificate.courseId
                );
                const approved =
                  certificate.status === "approved" ||
                  certificate.status === "issued";
                const eligible =
                  certificate.grade >= 80 && certificate.attendanceRate >= 80;
                const canApprove =
                  certificate.status === "pending_approval" && eligible;
                const canIssue = certificate.status === "approved";
                const canReject =
                  certificate.status === "pending_approval" ||
                  certificate.status === "approved";
                const issued = certificate.status === "issued";
                const rejectReason =
                  certificateRejectReasons[certificate.id]?.trim() ?? "";
                const approveKey = `certificate.approve:${certificate.id}`;
                const issueKey = `certificate.issue:${certificate.id}`;
                const rejectKey = `certificate.reject:${certificate.id}`;
                return (
                  <article key={certificate.id}>
                    <div>
                      <strong>{certificate.verificationCode}</strong>
                      <small>
                        {user?.name ?? "Student"} · {course?.title ?? "Course"}{" "}
                        · {certificate.grade}% grade ·{" "}
                        {certificate.attendanceRate}% attendance
                      </small>
                    </div>
                    <span
                      className={`platform-certificate-status ${certificate.status}`}
                    >
                      {certificate.status}
                    </span>
                    <div className="platform-row-actions">
                      {canReject ? (
                        <label className="platform-certificate-reject-reason">
                          Reject reason
                          <input
                            value={
                              certificateRejectReasons[certificate.id] ?? ""
                            }
                            onChange={event =>
                              setCertificateRejectReasons(current => ({
                                ...current,
                                [certificate.id]: event.target.value,
                              }))
                            }
                            placeholder="Eligibility note"
                          />
                        </label>
                      ) : null}
                      <button
                        disabled={!canApprove || Boolean(certificateSavingKey)}
                        onClick={() =>
                          runAcademicCertificateAction(
                            "certificate.approve",
                            certificate
                          )
                        }
                      >
                        {certificateSavingKey === approveKey
                          ? "Approving"
                          : approved
                            ? "Approved"
                            : eligible
                              ? "Approve"
                              : "Not eligible"}
                      </button>
                      <button
                        disabled={
                          !canIssue || issued || Boolean(certificateSavingKey)
                        }
                        onClick={() =>
                          runAcademicCertificateAction(
                            "certificate.issue",
                            certificate
                          )
                        }
                      >
                        {certificateSavingKey === issueKey
                          ? "Issuing"
                          : issued
                            ? "Issued"
                            : canIssue
                              ? "Issue"
                              : "Approve first"}
                      </button>
                      <button
                        disabled={
                          !canReject ||
                          !rejectReason ||
                          Boolean(certificateSavingKey)
                        }
                        onClick={() =>
                          runAcademicCertificateAction(
                            "certificate.reject",
                            certificate
                          )
                        }
                      >
                        {certificateSavingKey === rejectKey
                          ? "Rejecting"
                          : canReject
                            ? "Reject"
                            : "Closed"}
                      </button>
                    </div>
                  </article>
                );
              })
            ) : (
              <article>
                <div>
                  <strong>No certificates in scope</strong>
                  <small>
                    Eligible learners appear here after grades and attendance
                    are ready.
                  </small>
                </div>
                <span>0</span>
              </article>
            )}
          </div>
        </section>

        <section className="academic-panel academic-report-panel">
          <div className="academic-panel-head">
            <div>
              <span>Academic reports</span>
              <strong>{scopedReportRows.length} rows</strong>
            </div>
            <Database size={18} />
          </div>
          <div className="platform-report-table compact">
            {scopedReportRows.slice(0, 5).map((row, index) => (
              <article key={`${row.type}_${row.name}_${index}`}>
                <span>
                  <strong>Type</strong>
                  {row.type}
                </span>
                <span>
                  <strong>Name</strong>
                  {row.name}
                </span>
                <span>
                  <strong>Status</strong>
                  {row.status}
                </span>
                <span>
                  <strong>Owner</strong>
                  {row.owner}
                </span>
              </article>
            ))}
          </div>
          <button
            className="platform-secondary-button"
            onClick={exportAcademicCsv}
          >
            <Download size={15} />
            Export academic CSV
          </button>
        </section>

        <section className="academic-panel academic-message-panel">
          <div className="academic-panel-head">
            <div>
              <span>Department messages</span>
              <strong>{academicMessages.length} scoped</strong>
            </div>
            <MessageSquare size={18} />
          </div>
          <form
            className="academic-module-form stacked"
            onSubmit={sendAcademicMessage}
          >
            <label>
              Recipient
              <select
                value={messageDraft.recipientId}
                onChange={event =>
                  setMessageDraft(value => ({
                    ...value,
                    recipientId: event.target.value,
                  }))
                }
              >
                {academicRecipients.map(user => (
                  <option key={user.id} value={user.id}>
                    {user.name} · {roleMeta[user.activeRole].label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Subject
              <input
                value={messageDraft.subject}
                onChange={event =>
                  setMessageDraft(value => ({
                    ...value,
                    subject: event.target.value,
                  }))
                }
                placeholder="Department update"
              />
            </label>
            <label>
              Message
              <textarea
                value={messageDraft.body}
                onChange={event =>
                  setMessageDraft(value => ({
                    ...value,
                    body: event.target.value,
                  }))
                }
                placeholder="Write a concise department message"
              />
            </label>
            <button
              type="submit"
              disabled={!academicRecipients.length || messageSaving}
            >
              <Send size={15} />
              {messageSaving ? "Sending..." : "Send academic message"}
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}

function SuperAdminAcademicExperience({ pageId }: { pageId: string }) {
  return <AcademicGovernanceExperience pageId={pageId} scope="admin" />;
}

function BranchOperationsExperience({ pageId }: { pageId: string }) {
  const [version, setVersion] = useState(0);
  const [selectedBranchId, setSelectedBranchId] = useState("br_cairo");
  const [roomDraft, setRoomDraft] = useState({
    name: "",
    capacity: "18",
    equipment: "",
  });
  const [eventDraft, setEventDraft] = useState({
    title: "Branch review session",
    type: "live_session" as CalendarEventType,
    date: "2026-07-03",
    starts: "14:00",
    ends: "14:45",
    roomId: "",
    classGroupId: "",
  });
  const [eventSaving, setEventSaving] = useState(false);
  const [roomStatusSaving, setRoomStatusSaving] = useState<string | null>(null);
  const [roomCreateSaving, setRoomCreateSaving] = useState(false);
  const [paymentSaving, setPaymentSaving] = useState(false);
  const [messageSaving, setMessageSaving] = useState(false);
  const [messageDraft, setMessageDraft] = useState({
    recipientId: "usr_registrar_demo",
    subject: "Branch operations update",
    body: "Please review the branch schedule, attendance, and payment queue.",
  });
  const state = useMemo(() => platformStore.getState(), [version]);
  const refresh = () => setVersion(value => value + 1);
  const actorId = getDemoUser("branchadmin").id;
  const actorUser = state.users.find(user => user.id === actorId);
  const branch =
    state.branches.find(item => item.id === selectedBranchId) ??
    state.branches.find(item => item.id === "br_cairo") ??
    state.branches[0];
  const branchUsers = state.users.filter(user => user.branchId === branch?.id);
  const branchStudents = state.students
    .map(student => ({
      student,
      user: state.users.find(user => user.id === student.userId),
    }))
    .filter(({ user }) => user?.branchId === branch?.id);
  const branchTeachers = state.teachers
    .map(teacher => ({
      teacher,
      user: state.users.find(user => user.id === teacher.userId),
    }))
    .filter(
      ({ teacher, user }) =>
        user?.branchId === branch?.id ||
        state.teacherAvailability.some(
          slot =>
            slot.teacherId === teacher.userId && slot.branchId === branch?.id
        )
    );
  const branchRuns = state.courseRuns.filter(
    run => run.branchId === branch?.id
  );
  const branchRunIds = new Set(branchRuns.map(run => run.id));
  const branchClasses = state.classGroups.filter(classGroup =>
    branchRuns.some(run => run.id === classGroup.courseRunId)
  );
  const branchRooms = state.rooms.filter(room => room.branchId === branch?.id);
  const branchRoomKey = branchRooms.map(room => room.id).join("|");
  const branchClassKey = branchClasses
    .map(classGroup => classGroup.id)
    .join("|");
  const branchEvents = state.events.filter(
    event =>
      event.branchId === branch?.id ||
      (event.classGroupId &&
        branchClasses.some(classGroup => classGroup.id === event.classGroupId))
  );
  const branchAttendance = state.attendance.filter(record =>
    branchClasses.some(classGroup => classGroup.id === record.classGroupId)
  );
  const branchStudentIds = new Set(
    branchStudents.map(({ student }) => student.id)
  );
  const branchInvoices = state.invoices.filter(invoice =>
    branchStudentIds.has(invoice.studentId)
  );
  const branchInvoiceRows = branchInvoices.map(invoice => {
    const paid = state.payments
      .filter(
        payment => payment.invoiceId === invoice.id && payment.status === "paid"
      )
      .reduce((total, payment) => total + payment.amount, 0);
    return { invoice, paid, balance: Math.max(0, invoice.amount - paid) };
  });
  const branchOpenInvoices = branchInvoiceRows.filter(
    row => row.balance > 0 || row.invoice.status !== "paid"
  );
  const branchPaymentBalance = branchInvoiceRows.reduce(
    (total, row) => total + row.balance,
    0
  );
  const branchSessions = state.classSessions.filter(session =>
    branchClasses.some(classGroup => classGroup.id === session.classGroupId)
  );
  const missingAttendanceSessions = branchSessions.filter(
    session => !session.attendanceSaved
  );
  const branchAttendanceExceptions = branchAttendance.filter(
    record =>
      record.status === "late" ||
      record.status === "absent" ||
      record.status === "excused"
  );
  const pendingBranchEvents = branchEvents.filter(
    event => event.status === "pending"
  );
  const nextBranchEvents = branchEvents.slice(0, 4);
  const branchRecipientIds = new Set([
    actorId,
    ...branchUsers.map(user => user.id),
    ...branchTeachers.map(({ teacher }) => teacher.userId),
  ]);
  const branchRecipients = state.users.filter(
    user => user.id !== actorId && branchRecipientIds.has(user.id)
  );
  const branchMessages = state.messages.filter(
    message =>
      branchRecipientIds.has(message.fromUserId) ||
      branchRecipientIds.has(message.toUserId)
  );
  const roomCapacity = branchRooms.reduce(
    (total, room) => total + room.capacity,
    0
  );
  const assignedSeats = branchClasses.reduce(
    (total, classGroup) => total + classGroup.studentIds.length,
    0
  );
  const activeRooms = branchRooms.filter(
    room => room.status === "active"
  ).length;
  const branchFocusLabels: Record<string, string> = {
    rooms: "Room readiness",
    schedule: "Branch scheduling",
    attendance: "Attendance control",
    payments: "Payment queue",
    reports: "Branch reports",
    messages: "Branch messages",
    classes: "Class delivery",
    teachers: "Teaching staff",
    settings: "Branch settings",
    students: "Branch students",
  };
  const focusLabel = branchFocusLabels[pageId] ?? "Branch operations";
  const auditRows = state.auditLogs
    .filter(audit =>
      /branch|room|class|attendance|schedule|payment|settings/i.test(
        `${audit.action} ${audit.entityType} ${audit.summary}`
      )
    )
    .slice(0, 5);

  const updateRoomStatus = async (roomId: string, status: EntityStatus) => {
    setRoomStatusSaving(roomId);
    const result = await runPlatformWorkflowActionRequest({
      type: "room.status.update",
      roomId,
      status: status as Extract<EntityStatus, "active" | "pending" | "paused">,
      actorId,
    });
    setRoomStatusSaving(null);
    if (!result.ok || !result.data) {
      toast.error("Room status update failed", {
        description: result.error ?? "The server could not update this room.",
      });
      return;
    }
    platformStore.setState(result.data.state);
    refresh();
    toast.success("Room status updated", {
      description: result.data.persistence,
    });
  };

  const addRoom = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!branch || !roomDraft.name.trim()) {
      toast.error("Room name is required");
      return;
    }
    setRoomCreateSaving(true);
    const result = await runPlatformWorkflowActionRequest({
      type: "room.create",
      branchId: branch.id,
      name: roomDraft.name.trim(),
      capacity: Number(roomDraft.capacity) || 18,
      equipment: roomDraft.equipment
        .split(",")
        .map(item => item.trim())
        .filter(Boolean),
      actorId,
    });
    setRoomCreateSaving(false);
    if (!result.ok || !result.data) {
      toast.error("Room create failed", {
        description: result.error ?? "The server could not create this room.",
      });
      return;
    }
    platformStore.setState(result.data.state);
    setRoomDraft({ name: "", capacity: "18", equipment: "" });
    refresh();
    toast.success("Room added", { description: result.data.persistence });
  };

  useEffect(() => {
    if (actorUser?.branchId && actorUser.branchId !== selectedBranchId) {
      setSelectedBranchId(actorUser.branchId);
    }
  }, [actorUser?.branchId, selectedBranchId]);

  useEffect(() => {
    setEventDraft(value => ({
      ...value,
      roomId: branchRooms.some(room => room.id === value.roomId)
        ? value.roomId
        : branchRooms[0]?.id || "",
      classGroupId: branchClasses.some(
        classGroup => classGroup.id === value.classGroupId
      )
        ? value.classGroupId
        : branchClasses[0]?.id || "",
    }));
  }, [branchClassKey, branchRoomKey]);

  const createBranchEvent = async (event: React.FormEvent) => {
    event.preventDefault();
    if (
      !branch ||
      !eventDraft.title.trim() ||
      !eventDraft.date ||
      !eventDraft.starts ||
      !eventDraft.ends ||
      eventDraft.starts >= eventDraft.ends
    ) {
      toast.error("Valid title, date, and time range are required");
      return;
    }
    const needsClass =
      eventDraft.type === "live_session" || eventDraft.type === "class_session";
    const classGroupId = branchClasses.some(
      classGroup => classGroup.id === eventDraft.classGroupId
    )
      ? eventDraft.classGroupId
      : needsClass
        ? branchClasses[0]?.id
        : undefined;
    if (needsClass && !classGroupId) {
      toast.error(
        "Assign a branch class before scheduling a live class session"
      );
      return;
    }
    const roomId = branchRooms.some(room => room.id === eventDraft.roomId)
      ? eventDraft.roomId
      : branchRooms[0]?.id;
    setEventSaving(true);
    const result = await runPlatformWorkflowActionRequest({
      type: "calendar.create",
      eventType: eventDraft.type,
      title: eventDraft.title.trim(),
      startsAt: `${eventDraft.date}T${eventDraft.starts}:00+03:00`,
      endsAt: `${eventDraft.date}T${eventDraft.ends}:00+03:00`,
      branchId: branch.id,
      roomId,
      classGroupId,
    });
    setEventSaving(false);
    if (!result.ok || !result.data) {
      toast.error("Event save failed", {
        description:
          result.error ?? "The server could not save this branch event.",
      });
      return;
    }
    const payload = result.data.result.result as
      | { conflicts?: unknown[] }
      | undefined;
    platformStore.setState(result.data.state);
    refresh();
    toast.success(
      payload?.conflicts?.length
        ? "Event saved with conflict"
        : "Event scheduled",
      {
        description: `${eventDraft.title.trim()} · ${result.data.persistence}`,
      }
    );
  };

  const recordBranchPayment = async () => {
    const invoice = branchOpenInvoices[0]?.invoice ?? branchInvoices[0];
    if (!invoice) {
      toast.info("No branch invoice is ready for payment");
      return;
    }
    setPaymentSaving(true);
    const result = await runPlatformWorkflowActionRequest({
      type: "payment.record",
      invoiceId: invoice.id,
      method: "manual",
      actorId,
    });
    setPaymentSaving(false);
    if (!result.ok || !result.data) {
      toast.error("Branch payment failed", {
        description:
          result.error ?? "The server could not record this payment.",
      });
      return;
    }
    platformStore.setState(result.data.state);
    refresh();
    toast.success("Branch payment recorded", {
      description: `${invoice.id} · ${result.data.persistence}`,
    });
  };

  const sendBranchMessage = async (event: React.FormEvent) => {
    event.preventDefault();
    if (
      !messageDraft.recipientId ||
      !messageDraft.subject.trim() ||
      !messageDraft.body.trim()
    ) {
      toast.error("Recipient, subject, and body are required");
      return;
    }
    setMessageSaving(true);
    const result = await runPlatformWorkflowActionRequest({
      type: "message.send",
      toUserId: messageDraft.recipientId,
      subject: messageDraft.subject.trim(),
      body: messageDraft.body.trim(),
      channel: "in_app",
      actorId,
    });
    setMessageSaving(false);
    if (!result.ok || !result.data) {
      toast.error("Branch message failed", {
        description:
          result.error ?? "The server could not send this branch message.",
      });
      return;
    }
    platformStore.setState(result.data.state);
    setMessageDraft(value => ({ ...value, subject: "", body: "" }));
    refresh();
    toast.success("Branch message sent", {
      description: result.data.persistence,
    });
  };

  const exportBranchCsv = () => {
    const rows = [
      ...branchClasses.map(classGroup => ({
        type: "Class",
        name: classGroup.name,
        status: `${classGroup.studentIds.length}/${classGroup.capacity}`,
        branch: branch?.name ?? "Branch",
      })),
      ...branchRooms.map(room => ({
        type: "Room",
        name: room.name,
        status: room.status,
        branch: branch?.name ?? "Branch",
      })),
      ...branchInvoices.map(invoice => ({
        type: "Invoice",
        name: invoice.id,
        status: invoice.status,
        branch: branch?.name ?? "Branch",
      })),
      ...branchAttendance.map(record => ({
        type: "Attendance",
        name: record.studentId,
        status: record.status,
        branch: branch?.name ?? "Branch",
      })),
    ];
    const csv = platformStore.buildCsv(rows);
    if (!csv) {
      toast.info("No branch rows to export");
      return;
    }
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `branch-${branch?.code ?? "ops"}-report.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    toast.success("Branch CSV exported", {
      description: `${rows.length} row(s)`,
    });
  };

  return (
    <div className="branch-ops-workspace">
      <PlatformWorkspaceHeader
        className="branch-ops-hero"
        title="Branch operations"
        description="Manage local students, teachers, rooms, classes, attendance, payments, and schedules."
        context={<span>{focusLabel}</span>}
        actionsClassName="branch-ops-actions"
        actions={
          <>
            {[
              ["Students", "students", Users],
              ["Teachers", "teachers", UserPlus],
              ["Classes", "classes", CalendarDays],
              ["Rooms", "rooms", Building2],
              ["Schedule", "schedule", CalendarDays],
              ["Attendance", "attendance", ClipboardList],
              ["Payments", "payments", CreditCard],
              ["Reports", "reports", Database],
              ["Messages", "messages", MessageSquare],
              ["Settings", "settings", SlidersHorizontal],
            ].map(([label, routeId, Icon]) => (
              <Link
                key={String(routeId)}
                href={`/app/branch/${routeId}`}
                className={pageId === routeId ? "active" : ""}
                aria-current={pageId === routeId ? "page" : undefined}
              >
                <Icon size={15} />
                {label as string}
              </Link>
            ))}
          </>
        }
      />

      <div className="branch-ops-kpis">
        <AdminAccessMetric
          label="Branch users"
          value={String(branchUsers.length)}
        />
        <AdminAccessMetric
          label="Students"
          value={String(branchStudents.length)}
        />
        <AdminAccessMetric
          label="Teachers"
          value={String(branchTeachers.length)}
        />
        <AdminAccessMetric
          label="Rooms active"
          value={`${activeRooms}/${branchRooms.length}`}
        />
        <AdminAccessMetric
          label="Exceptions"
          value={`${branchAttendanceExceptions.length}/${missingAttendanceSessions.length}`}
        />
      </div>

      <div className="branch-ops-layout">
        <section className="branch-panel branch-scope-panel">
          <div className="branch-panel-head">
            <div>
              <span>Branch access</span>
              <strong>{branch?.name ?? "Branch"}</strong>
            </div>
            <select
              value={branch?.id ?? ""}
              disabled
              aria-label="Branch operations scope"
            >
              {branch ? (
                <option value={branch.id}>{branch.name}</option>
              ) : (
                <option value="">No branch assigned</option>
              )}
            </select>
          </div>
          <div className="branch-scope-card">
            <span>{branch?.code ?? "BR"}</span>
            <div>
              <strong>{branch?.address ?? "Branch address"}</strong>
              <small>
                {branch?.timezone ?? "Africa/Cairo"} ·{" "}
                {branch?.status ?? "active"}
              </small>
            </div>
          </div>
          <div className="branch-readiness-list">
            {[
              [
                "Rooms",
                branchRooms.length
                  ? `${activeRooms} active rooms`
                  : "Add rooms before scheduling",
              ],
              [
                "Classes",
                branchClasses.length
                  ? `${branchClasses.length} class groups`
                  : "No class group assigned",
              ],
              [
                "Course runs",
                branchRunIds.size
                  ? `${branchRunIds.size} run(s)`
                  : "No course run assigned",
              ],
              [
                "Students",
                branchStudents.length
                  ? `${branchStudents.length} local students`
                  : "No local students yet",
              ],
              [
                "Staff",
                branchTeachers.length
                  ? `${branchTeachers.length} teacher(s)`
                  : "No local teacher availability",
              ],
            ].map(([label, value]) => (
              <article key={label}>
                <strong>{label}</strong>
                <small>{value}</small>
              </article>
            ))}
          </div>
        </section>

        <section className="branch-panel branch-people-panel">
          <div className="branch-panel-head">
            <div>
              <span>Local people</span>
              <strong>{branchUsers.length} users</strong>
            </div>
            <Users size={18} />
          </div>
          <div className="branch-person-list">
            {branchUsers.length ? (
              branchUsers.map(user => (
                <article key={user.id}>
                  <span>
                    {roleMeta[user.activeRole].shortLabel
                      .slice(0, 2)
                      .toUpperCase()}
                  </span>
                  <div>
                    <strong>{user.name}</strong>
                    <small>
                      {roleMeta[user.activeRole].label} · {user.status}
                    </small>
                  </div>
                </article>
              ))
            ) : (
              <article>
                <span>BR</span>
                <div>
                  <strong>No assigned branch users</strong>
                  <small>
                    Use Super Admin users to assign staff and students to this
                    branch.
                  </small>
                </div>
              </article>
            )}
          </div>
        </section>

        <section className="branch-panel branch-class-panel">
          <div className="branch-panel-head">
            <div>
              <span>Class delivery</span>
              <strong>{branchClasses.length} groups</strong>
            </div>
            <CalendarDays size={18} />
          </div>
          <div className="branch-class-list">
            {branchClasses.length ? (
              branchClasses.map(classGroup => {
                const run = state.courseRuns.find(
                  item => item.id === classGroup.courseRunId
                );
                const course = state.courses.find(
                  item => item.id === run?.courseId
                );
                const teacher = state.users.find(
                  item => item.id === run?.teacherId
                );
                const room = state.rooms.find(
                  item => item.id === classGroup.roomId
                );
                return (
                  <article key={classGroup.id}>
                    <div>
                      <strong>{classGroup.name}</strong>
                      <small>
                        {course?.title ?? "No course"} ·{" "}
                        {teacher?.name ?? "No teacher"} ·{" "}
                        {room?.name ?? "No room"}
                      </small>
                    </div>
                    <span>
                      {classGroup.studentIds.length}/{classGroup.capacity}
                    </span>
                    <em>{classGroup.schedule}</em>
                  </article>
                );
              })
            ) : (
              <article>
                <div>
                  <strong>No active classes in this branch</strong>
                  <small>
                    Create a course run and room booking before publishing the
                    schedule.
                  </small>
                </div>
                <span>0</span>
                <em>Ready for setup</em>
              </article>
            )}
          </div>
        </section>
      </div>

      <div className="branch-ops-lower-grid">
        <section className="branch-panel branch-room-panel">
          <div className="branch-panel-head">
            <div>
              <span>Rooms</span>
              <strong>{branchRooms.length} rooms</strong>
            </div>
            <Building2 size={18} />
          </div>
          <div className="branch-room-list">
            {branchRooms.map(room => (
              <article key={room.id}>
                <div>
                  <strong>{room.name}</strong>
                  <small>
                    {room.capacity} seats ·{" "}
                    {room.equipment.join(", ") || "No equipment listed"}
                  </small>
                </div>
                <select
                  value={room.status}
                  disabled={roomStatusSaving === room.id}
                  onChange={event =>
                    void updateRoomStatus(
                      room.id,
                      event.target.value as EntityStatus
                    )
                  }
                  aria-label={`${room.name} status`}
                >
                  <option value="active">Active</option>
                  <option value="paused">Paused</option>
                  <option value="pending">Pending</option>
                </select>
              </article>
            ))}
          </div>
          <form className="branch-room-form" onSubmit={addRoom}>
            <label>
              Room name
              <input
                value={roomDraft.name}
                disabled={roomCreateSaving}
                onChange={event =>
                  setRoomDraft(value => ({
                    ...value,
                    name: event.target.value,
                  }))
                }
                placeholder="Room name"
              />
            </label>
            <label>
              Capacity
              <input
                type="number"
                min={1}
                max={200}
                value={roomDraft.capacity}
                disabled={roomCreateSaving}
                onChange={event =>
                  setRoomDraft(value => ({
                    ...value,
                    capacity: event.target.value,
                  }))
                }
                placeholder="18"
              />
            </label>
            <label>
              Equipment
              <input
                value={roomDraft.equipment}
                disabled={roomCreateSaving}
                onChange={event =>
                  setRoomDraft(value => ({
                    ...value,
                    equipment: event.target.value,
                  }))
                }
                placeholder="Projector, whiteboard"
              />
            </label>
            <button type="submit" disabled={roomCreateSaving}>
              <Plus size={15} />
              {roomCreateSaving ? "Adding room" : "Add room"}
            </button>
          </form>
        </section>

        <section className="branch-panel branch-settings-panel">
          <div className="branch-panel-head">
            <div>
              <span>Branch settings</span>
              <strong>Operational checks</strong>
            </div>
            <ShieldCheck size={18} />
          </div>
          <div className="branch-settings-list">
            {[
              [
                "Room capacity",
                roomCapacity
                  ? `${roomCapacity} seats configured`
                  : "Needs room setup",
              ],
              [
                "Meeting links",
                branchClasses.some(classGroup => classGroup.meetingLinkId)
                  ? "Live links available"
                  : "No live links",
              ],
              [
                "Attendance",
                branchAttendance.length
                  ? "Attendance history present"
                  : "No attendance records",
              ],
              [
                "Payments",
                branchInvoices.length ? "Invoices visible" : "No invoices",
              ],
            ].map(([label, value]) => (
              <article key={label}>
                <CheckCircle2 size={15} />
                <div>
                  <strong>{label}</strong>
                  <small>{value}</small>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="branch-panel branch-audit-panel">
          <div className="branch-panel-head">
            <div>
              <span>Branch audit</span>
              <strong>Recent operations</strong>
            </div>
            <ShieldCheck size={18} />
          </div>
          <div className="admin-audit-list">
            {auditRows.length ? (
              auditRows.map(auditRow => (
                <article key={auditRow.id}>
                  <strong>{auditRow.action}</strong>
                  <small>{auditRow.summary}</small>
                  <span>{new Date(auditRow.createdAt).toLocaleString()}</span>
                </article>
              ))
            ) : (
              <article>
                <strong>branch.ready</strong>
                <small>Branch workspace is connected to system data.</small>
                <span>Now</span>
              </article>
            )}
          </div>
        </section>
      </div>

      <div className="branch-ops-lower-grid branch-ops-command-grid">
        <section className="branch-panel branch-schedule-panel">
          <div className="branch-panel-head">
            <div>
              <span>Schedule command</span>
              <strong>
                {branchEvents.length} branch events ·{" "}
                {pendingBranchEvents.length} review
              </strong>
            </div>
            <CalendarDays size={18} />
          </div>
          <div className="branch-class-list compact">
            {(pendingBranchEvents.length
              ? pendingBranchEvents
              : nextBranchEvents
            )
              .slice(0, 3)
              .map(eventRow => {
                const eventRoom = state.rooms.find(
                  room => room.id === eventRow.roomId
                );
                const eventClass = state.classGroups.find(
                  classGroup => classGroup.id === eventRow.classGroupId
                );
                return (
                  <article key={eventRow.id}>
                    <div>
                      <strong>{eventRow.title}</strong>
                      <small>
                        {eventRoom?.name ?? "No room"} ·{" "}
                        {eventClass?.name ?? eventRow.type}
                      </small>
                    </div>
                    <span>
                      {eventRow.status === "pending"
                        ? "review"
                        : eventRow.status}
                    </span>
                    <em>{new Date(eventRow.startsAt).toLocaleString()}</em>
                  </article>
                );
              })}
            {!branchEvents.length ? (
              <article>
                <div>
                  <strong>No branch events scheduled</strong>
                  <small>
                    Create a room booking, placement test, or class session for
                    this branch.
                  </small>
                </div>
                <span>empty</span>
              </article>
            ) : null}
          </div>
          <form
            className="branch-room-form stacked"
            onSubmit={createBranchEvent}
          >
            <label>
              Title
              <input
                value={eventDraft.title}
                onChange={event =>
                  setEventDraft(value => ({
                    ...value,
                    title: event.target.value,
                  }))
                }
                placeholder="Branch session title"
              />
            </label>
            <label>
              Type
              <select
                value={eventDraft.type}
                onChange={event =>
                  setEventDraft(value => ({
                    ...value,
                    type: event.target.value as CalendarEventType,
                  }))
                }
              >
                <option value="live_session">Live session</option>
                <option value="placement_test">Placement test</option>
                <option value="room_booking">Room booking</option>
                <option value="exam">Exam</option>
              </select>
            </label>
            <label>
              Date
              <input
                type="date"
                value={eventDraft.date}
                onChange={event =>
                  setEventDraft(value => ({
                    ...value,
                    date: event.target.value,
                  }))
                }
              />
            </label>
            <label>
              Starts
              <input
                type="time"
                value={eventDraft.starts}
                onChange={event =>
                  setEventDraft(value => ({
                    ...value,
                    starts: event.target.value,
                  }))
                }
              />
            </label>
            <label>
              Ends
              <input
                type="time"
                value={eventDraft.ends}
                onChange={event =>
                  setEventDraft(value => ({
                    ...value,
                    ends: event.target.value,
                  }))
                }
              />
            </label>
            <label>
              Room
              <select
                value={eventDraft.roomId}
                onChange={event =>
                  setEventDraft(value => ({
                    ...value,
                    roomId: event.target.value,
                  }))
                }
              >
                {branchRooms.length ? (
                  branchRooms.map(room => (
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
                value={eventDraft.classGroupId}
                onChange={event =>
                  setEventDraft(value => ({
                    ...value,
                    classGroupId: event.target.value,
                  }))
                }
              >
                {branchClasses.length ? (
                  branchClasses.map(classGroup => (
                    <option key={classGroup.id} value={classGroup.id}>
                      {classGroup.name}
                    </option>
                  ))
                ) : (
                  <option value="">General branch event</option>
                )}
              </select>
            </label>
            <button type="submit" disabled={eventSaving}>
              <Plus size={15} />
              {eventSaving ? "Saving event" : "Create event"}
            </button>
          </form>
        </section>

        <section className="branch-panel branch-attendance-panel">
          <div className="branch-panel-head">
            <div>
              <span>Attendance exceptions</span>
              <strong>
                {branchAttendanceExceptions.length} exceptions ·{" "}
                {missingAttendanceSessions.length} missing
              </strong>
            </div>
            <ClipboardList size={18} />
          </div>
          <div className="branch-settings-list">
            {[
              [
                "Missing sessions",
                `${missingAttendanceSessions.length} session(s) need save`,
              ],
              [
                "Late",
                `${branchAttendance.filter(record => record.status === "late").length} learner record(s)`,
              ],
              [
                "Absent",
                `${branchAttendance.filter(record => record.status === "absent").length} learner record(s)`,
              ],
              [
                "Excused",
                `${branchAttendance.filter(record => record.status === "excused").length} learner record(s)`,
              ],
            ].map(([label, value]) => (
              <article key={label}>
                <CheckCircle2 size={15} />
                <div>
                  <strong>{label}</strong>
                  <small>{value}</small>
                </div>
              </article>
            ))}
          </div>
          <div className="branch-class-list compact">
            {branchAttendanceExceptions.length
              ? branchAttendanceExceptions.slice(0, 4).map(record => {
                  const student = state.students.find(
                    item => item.id === record.studentId
                  );
                  const user = state.users.find(
                    item => item.id === student?.userId
                  );
                  const classGroup = branchClasses.find(
                    item => item.id === record.classGroupId
                  );
                  return (
                    <article key={record.id}>
                      <div>
                        <strong>{user?.name ?? record.studentId}</strong>
                        <small>
                          {classGroup?.name ?? "Branch class"} ·{" "}
                          {record.notes ?? "No note"}
                        </small>
                      </div>
                      <span>{record.status}</span>
                    </article>
                  );
                })
              : missingAttendanceSessions.slice(0, 4).map(session => {
                  const classGroup = branchClasses.find(
                    item => item.id === session.classGroupId
                  );
                  return (
                    <article key={session.id}>
                      <div>
                        <strong>{session.title}</strong>
                        <small>
                          {classGroup?.name ?? "Branch class"} ·{" "}
                          {new Date(session.startsAt).toLocaleString()}
                        </small>
                      </div>
                      <span>save due</span>
                    </article>
                  );
                })}
            {!branchAttendanceExceptions.length &&
            !missingAttendanceSessions.length ? (
              <article>
                <div>
                  <strong>Attendance is clear</strong>
                  <small>
                    Saved branch attendance has no late, absent, or excused
                    exceptions.
                  </small>
                </div>
                <span>clear</span>
              </article>
            ) : null}
          </div>
        </section>

        <section className="branch-panel branch-payment-panel">
          <div className="branch-panel-head">
            <div>
              <span>Payment queue</span>
              <strong>
                {branchOpenInvoices.length} open · EGP {branchPaymentBalance}
              </strong>
            </div>
            <CreditCard size={18} />
          </div>
          <div className="branch-class-list compact">
            {branchInvoiceRows.length ? (
              branchInvoiceRows.map(row => (
                <article key={row.invoice.id}>
                  <div>
                    <strong>{row.invoice.id}</strong>
                    <small>
                      {row.invoice.currency} {row.invoice.amount} · paid{" "}
                      {row.paid} · due{" "}
                      {new Date(row.invoice.dueAt).toLocaleDateString()}
                    </small>
                  </div>
                  <span>
                    {row.balance > 0
                      ? `${row.invoice.currency} ${row.balance}`
                      : row.invoice.status}
                  </span>
                </article>
              ))
            ) : (
              <article>
                <div>
                  <strong>No branch invoices</strong>
                  <small>
                    Invoices appear when a local learner has a payment package.
                  </small>
                </div>
                <span>0</span>
              </article>
            )}
          </div>
          <button
            className="platform-secondary-button"
            onClick={() => void recordBranchPayment()}
            disabled={paymentSaving || !branchOpenInvoices.length}
          >
            <CreditCard size={15} />
            {paymentSaving ? "Recording payment" : "Record payment"}
          </button>
        </section>

        <section className="branch-panel branch-report-panel">
          <div className="branch-panel-head">
            <div>
              <span>Branch reports</span>
              <strong>
                {branchClasses.length +
                  branchRooms.length +
                  branchInvoices.length +
                  branchAttendance.length}{" "}
                rows
              </strong>
            </div>
            <Database size={18} />
          </div>
          <div className="platform-report-table compact">
            {[
              [
                "Classes",
                `${branchClasses.length} active groups`,
                `${assignedSeats}/${roomCapacity || 0} seat usage`,
              ],
              [
                "Rooms",
                `${activeRooms}/${branchRooms.length} active`,
                `${pendingBranchEvents.length} schedule review`,
              ],
              [
                "Payments",
                `${branchOpenInvoices.length} open invoices`,
                `EGP ${branchPaymentBalance} balance`,
              ],
              [
                "Attendance",
                `${branchAttendanceExceptions.length} exceptions`,
                `${missingAttendanceSessions.length} missing sessions`,
              ],
            ].map(([type, value, detail]) => (
              <article key={type}>
                <span>
                  <strong>Type</strong>
                  {type}
                </span>
                <span>
                  <strong>Value</strong>
                  {value}
                </span>
                <span>
                  <strong>Detail</strong>
                  {detail}
                </span>
              </article>
            ))}
          </div>
          <button
            className="platform-secondary-button"
            onClick={exportBranchCsv}
          >
            <Download size={15} />
            Export branch CSV
          </button>
        </section>

        <section className="branch-panel branch-message-panel">
          <div className="branch-panel-head">
            <div>
              <span>Branch messages</span>
              <strong>{branchMessages.length} scoped</strong>
            </div>
            <MessageSquare size={18} />
          </div>
          <form
            className="branch-room-form stacked"
            onSubmit={sendBranchMessage}
          >
            <label>
              Recipient
              <select
                value={messageDraft.recipientId}
                disabled={messageSaving}
                onChange={event =>
                  setMessageDraft(value => ({
                    ...value,
                    recipientId: event.target.value,
                  }))
                }
              >
                {branchRecipients.length ? (
                  branchRecipients.map(user => (
                    <option key={user.id} value={user.id}>
                      {user.name} · {roleMeta[user.activeRole].label}
                    </option>
                  ))
                ) : (
                  <option value="">No branch recipient</option>
                )}
              </select>
            </label>
            <label>
              Subject
              <input
                value={messageDraft.subject}
                disabled={messageSaving}
                onChange={event =>
                  setMessageDraft(value => ({
                    ...value,
                    subject: event.target.value,
                  }))
                }
                placeholder="Branch update"
              />
            </label>
            <label>
              Message
              <textarea
                value={messageDraft.body}
                disabled={messageSaving}
                onChange={event =>
                  setMessageDraft(value => ({
                    ...value,
                    body: event.target.value,
                  }))
                }
                placeholder="Write a branch message"
              />
            </label>
            <button
              type="submit"
              disabled={!branchRecipients.length || messageSaving}
            >
              <Send size={15} />
              {messageSaving ? "Sending message" : "Send branch message"}
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}

function RegistrarAdmissionsExperience({
  pageId,
  params,
}: {
  pageId: string;
  params?: Record<string, string | undefined>;
}) {
  const [version, setVersion] = useState(0);
  const [leadDraft, setLeadDraft] = useState<{
    fullName: string;
    email: string;
    phone: string;
    country: string;
    subject: string;
    source: Lead["source"];
    notes: string;
  }>({
    fullName: "",
    email: "",
    phone: "",
    country: "",
    subject: "Arabic Language",
    source: "manual",
    notes: "",
  });
  const [applicationDraft, setApplicationDraft] = useState({
    fullName: "",
    email: "",
    phone: "",
    branchId: "br_cairo",
    courseInterest: "Arabic Language",
    schedulePreference: "Evening",
    notes: "",
  });
  const [placementDraft, setPlacementDraft] = useState({
    fullName: "",
    email: "",
    phone: "",
    branchId: "br_online",
    subject: "Arabic Language",
    preferredDate: getDefaultDueAt(2),
    currentLevel: "Placement pending",
  });
  const [studentDraft, setStudentDraft] = useState({
    fullName: "",
    email: "",
    phone: "",
    branchId: "br_online",
    preferredLanguage: "English",
    courseInterest: "Arabic Language",
    ageGroup: "Adult",
    guardianName: "",
    guardianPhone: "",
    currentLevel: "Arabic Level 3",
    status: "active" as Extract<
      StudentStatus,
      "ready_to_enroll" | "enrolled" | "active" | "paused"
    >,
    notes: "",
    courseRunId: "run_ar_l3_2026",
    classGroupId: "class_ar_l3_a",
  });
  const [studentStatusDrafts, setStudentStatusDrafts] = useState<
    Record<string, StudentStatus>
  >({});
  const [selectedPlacementId, setSelectedPlacementId] = useState(
    params?.bookingId ?? ""
  );
  const [recommendedLevel, setRecommendedLevel] = useState("Arabic Level 2");
  const [score, setScore] = useState(78);
  const [paymentSearch, setPaymentSearch] = useState("");
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<
    "all" | "open" | "paid" | "overdue"
  >("all");
  const [paymentAmountDrafts, setPaymentAmountDrafts] = useState<
    Record<string, string>
  >({});
  const [paymentMethodDrafts, setPaymentMethodDrafts] = useState<
    Record<string, Payment["method"]>
  >({});
  const [paymentReferenceDrafts, setPaymentReferenceDrafts] = useState<
    Record<string, string>
  >({});
  const [enrollmentAssignmentDrafts, setEnrollmentAssignmentDrafts] = useState<
    Record<string, { courseRunId: string; classGroupId: string }>
  >({});
  const [pendingRegistrarAction, setPendingRegistrarAction] = useState<
    string | null
  >(null);
  const state = useMemo(() => platformStore.getState(), [version]);
  const refresh = () => setVersion(value => value + 1);
  const actorId = getDemoUser("registrar").id;
  const activePage = pageId.includes("lead")
    ? "leads"
    : pageId.includes("application")
      ? "applications"
      : pageId.includes("placement")
        ? "placement-tests"
        : pageId.includes("student")
          ? "students"
          : pageId;
  const requestedLeadId = params?.leadId;
  const requestedApplicationId = params?.applicationId;
  const requestedStudentId = params?.studentId;
  const requestedPlacementId = params?.bookingId;
  const selectedPlacement = requestedPlacementId
    ? state.placementTests.find(booking => booking.id === requestedPlacementId)
    : (state.placementTests.find(
        booking => booking.id === selectedPlacementId
      ) ??
      state.placementTests.find(booking => booking.status !== "completed") ??
      state.placementTests[0]);
  const selectedLead = requestedLeadId
    ? state.leads.find(lead => lead.id === requestedLeadId)
    : state.leads[0];
  const selectedApplication = requestedApplicationId
    ? state.applications.find(
        application => application.id === requestedApplicationId
      )
    : state.applications[0];
  const selectedStudent = requestedStudentId
    ? state.students.find(student => student.id === requestedStudentId)
    : state.students[0];
  const detailRecordMissing =
    (pageId === "lead-detail" && requestedLeadId && !selectedLead) ||
    (pageId === "application-detail" &&
      requestedApplicationId &&
      !selectedApplication) ||
    (pageId === "student-detail" && requestedStudentId && !selectedStudent) ||
    (pageId === "placement-detail" &&
      requestedPlacementId &&
      !selectedPlacement);
  const selectedStudentUser = state.users.find(
    user => user.id === selectedStudent?.userId
  );
  const selectedStudentEnrollments = state.enrollments.filter(
    enrollment => enrollment.studentId === selectedStudent?.id
  );
  const selectedLeadApplication = state.applications.find(
    application => application.leadId === selectedLead?.id
  );
  const selectedApplicationLead = state.leads.find(
    lead => lead.id === selectedApplication?.leadId
  );
  const selectedApplicationBranch = state.branches.find(
    branch => branch.id === selectedApplication?.branchId
  );
  const selectedApplicationWorkflow = state.enrollmentWorkflows.find(
    workflow => workflow.applicationId === selectedApplication?.id
  );
  const selectedApplicationAuditRows = state.auditLogs
    .filter(
      audit =>
        audit.entityId === selectedApplication?.id ||
        audit.entityId === selectedApplicationWorkflow?.id ||
        audit.summary.includes(
          selectedApplicationLead?.fullName ?? "__no_app__"
        )
    )
    .slice(0, 5);
  const readyWorkflows = state.enrollmentWorkflows.filter(
    workflow => workflow.status === "ready_to_enroll"
  );
  const pendingPlacements = state.placementTests.filter(
    booking => booking.status !== "completed"
  );
  const studentCreateCourseRuns = state.courseRuns.filter(
    run => run.branchId === studentDraft.branchId
  );
  const selectedStudentCreateRun =
    studentCreateCourseRuns.find(run => run.id === studentDraft.courseRunId) ??
    studentCreateCourseRuns[0] ??
    state.courseRuns[0];
  const studentCreateClassGroups = state.classGroups.filter(
    group => group.courseRunId === selectedStudentCreateRun?.id
  );
  const studentCreateAvailableClassGroups = studentCreateClassGroups.filter(
    group => group.studentIds.length < group.capacity
  );
  const selectedStudentCreateClass =
    studentCreateAvailableClassGroups.find(
      group => group.id === studentDraft.classGroupId
    ) ?? studentCreateAvailableClassGroups[0];
  const selectedStudentDetailRows = selectedStudentEnrollments.map(
    enrollment => {
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
      const teacher = state.users.find(
        item => item.id === (enrollment.teacherId ?? run?.teacherId)
      );
      return { enrollment, run, course, classGroup, teacher };
    }
  );
  const selectedStudentAuditRows = state.auditLogs
    .filter(
      audit =>
        audit.entityId === selectedStudent?.id ||
        audit.entityId === selectedStudentUser?.id ||
        selectedStudentEnrollments.some(
          enrollment => enrollment.id === audit.entityId
        ) ||
        (/student|enrollment/i.test(`${audit.action} ${audit.summary}`) &&
          audit.summary.includes(selectedStudentUser?.name ?? "__no_student__"))
    )
    .slice(0, 5);
  const selectedStudentPlacement = state.placementTests.find(booking =>
    selectedStudentUser
      ? booking.email.toLowerCase() === selectedStudentUser.email.toLowerCase()
      : false
  );
  const selectedStudentPlacementResult = state.placementResults.find(
    result => result.bookingId === selectedStudentPlacement?.id
  );
  const selectedStudentWorkflow = state.enrollmentWorkflows.find(
    workflow =>
      workflow.studentId === selectedStudent?.id ||
      (workflow.placementTestId
        ? workflow.placementTestId === selectedStudentPlacement?.id
        : false) ||
      selectedStudentEnrollments.some(
        enrollment =>
          workflow.classGroupId === enrollment.classGroupId ||
          workflow.courseRunId === enrollment.courseRunId
      )
  );
  const selectedStudentPrimaryConnection = selectedStudentDetailRows[0];
  const selectedStudentLevelLabel =
    selectedStudentPlacementResult?.recommendedLevel ??
    selectedStudent?.currentLevel ??
    selectedStudentWorkflow?.recommendedLevel ??
    "Level pending";
  const selectedStudentNextAction = !selectedStudentUser
    ? "Create profile"
    : selectedStudentPlacement && !selectedStudentPlacementResult
      ? "Record placement result"
      : !selectedStudentEnrollments.length
        ? "Create enrollment"
        : !selectedStudentPrimaryConnection?.classGroup
          ? "Assign class"
          : !selectedStudentPrimaryConnection?.teacher
            ? "Assign teacher through class"
            : selectedStudent?.status !== "active"
              ? "Activate portal"
              : "Monitor progress";
  const registrarAuditRows = state.auditLogs
    .filter(audit =>
      /lead|application|placement|enrollment|payment|invoice|student/i.test(
        `${audit.action} ${audit.entityType} ${audit.summary}`
      )
    )
    .slice(0, 6);
  const paymentRows = state.invoices.map(invoice => {
    const student = state.students.find(item => item.id === invoice.studentId);
    const user = state.users.find(item => item.id === student?.userId);
    const branch = state.branches.find(item => item.id === user?.branchId);
    const enrollment = state.enrollments.find(
      item => item.studentId === invoice.studentId
    );
    const run = state.courseRuns.find(
      item => item.id === enrollment?.courseRunId
    );
    const course = state.courses.find(item => item.id === run?.courseId);
    const classGroup = state.classGroups.find(
      item => item.id === enrollment?.classGroupId
    );
    const payments = state.payments.filter(
      payment => payment.invoiceId === invoice.id && payment.status === "paid"
    );
    const paid = payments.reduce((sum, payment) => sum + payment.amount, 0);
    const balance = Math.max(0, invoice.amount - paid);
    const lastPayment = [...payments].sort((a, b) =>
      b.paidAt.localeCompare(a.paidAt)
    )[0];
    const status = balance <= 0 ? "paid" : invoice.status;
    return {
      invoice,
      student,
      user,
      branch,
      enrollment,
      run,
      course,
      classGroup,
      payments,
      paid,
      balance,
      lastPayment,
      status,
    };
  });
  const filteredPaymentRows = paymentRows.filter(row => {
    const query = paymentSearch.trim().toLowerCase();
    const matchesQuery =
      !query ||
      [
        row.invoice.id,
        row.enrollment?.id,
        row.user?.name,
        row.user?.email,
        row.branch?.name,
        row.course?.title,
        row.classGroup?.name,
        row.status,
      ]
        .filter(Boolean)
        .some(value => String(value).toLowerCase().includes(query));
    const matchesStatus =
      paymentStatusFilter === "all" ||
      (paymentStatusFilter === "open" &&
        row.balance > 0 &&
        row.status !== "overdue") ||
      (paymentStatusFilter === "paid" && row.balance <= 0) ||
      (paymentStatusFilter === "overdue" && row.status === "overdue");
    return matchesQuery && matchesStatus;
  });
  const paymentTotals = {
    invoices: paymentRows.length,
    open: paymentRows.filter(row => row.balance > 0).length,
    paid: paymentRows.filter(row => row.balance <= 0).length,
    collected: paymentRows.reduce((sum, row) => sum + row.paid, 0),
    balance: paymentRows.reduce((sum, row) => sum + row.balance, 0),
  };
  const paymentMethods: Payment["method"][] = [
    "manual",
    "cash",
    "bank_transfer",
    "card",
  ];
  const focusLabel =
    activePage === "payments"
      ? "Payment desk"
      : activePage === "placement-tests"
        ? "Placement desk"
        : activePage === "classes" || activePage === "schedule"
          ? "Enrollment delivery"
          : activePage === "students"
            ? "Student records"
            : "Admissions pipeline";
  const registrarPageCopy =
    pageId === "lead-detail"
      ? {
          title: selectedLead?.fullName ?? "Lead detail",
          description: "Review one enquiry and its next follow-up.",
          context: "Lead detail",
        }
        : pageId === "application-detail"
        ? {
            title: selectedApplicationLead?.fullName ?? "Application detail",
            description: "Review one application file and next step.",
            context: "Application detail",
          }
        : pageId === "student-detail"
          ? {
              title: selectedStudentUser?.name ?? "Student detail",
              description: "Review one student record and current status.",
              context: "Student detail",
            }
          : pageId === "placement-detail"
            ? {
                title: selectedPlacement?.fullName ?? "Placement detail",
                description: "Record the result for one placement booking.",
                context: "Placement detail",
              }
            : activePage === "leads"
              ? {
                  title: "Leads",
                  description: "Capture enquiries and follow up.",
                  context: "Admissions pipeline",
                }
              : activePage === "applications"
                ? {
                    title: "Applications",
                    description: "Create and review application files.",
                    context: "Application desk",
                  }
                : activePage === "placement-tests"
                  ? {
                      title: "Placement tests",
                      description: "Book placement tests and record results.",
                      context: "Placement desk",
                    }
                  : activePage === "students"
                    ? {
                        title: "Students",
                        description: "Find student records and create students.",
                        context: "Student records",
                      }
                    : activePage === "enrollments"
                      ? {
                          title: "Enrollments",
                          description: "Activate students into courses and classes.",
                          context: "Enrollment handoff",
                        }
                      : activePage === "classes"
                        ? {
                            title: "Classes",
                            description: "Review class assignment and delivery readiness.",
                            context: "Enrollment delivery",
                          }
                        : activePage === "payments"
                          ? {
                              title: "Payments",
                              description: "Record receipts and review open balances.",
                              context: "Payment desk",
                            }
                          : activePage === "messages"
                            ? {
                                title: "Messages",
                                description: "Follow up with admissions contacts.",
                                context: "Admissions follow-up",
                              }
                            : activePage === "reports"
                              ? {
                                  title: "Reports",
                                  description: "Review registrar activity and outcomes.",
                                  context: "Activity reports",
                                }
                              : activePage === "settings"
                                ? {
                                    title: "Settings",
                                    description: "Manage admissions defaults.",
                                    context: "Admissions settings",
                                  }
                                : {
                                    title: "Admissions",
                                    description: "Manage one registrar task at a time.",
                                    context: focusLabel,
                                  };
  const isRegistrarDetailPage = [
    "lead-detail",
    "application-detail",
    "student-detail",
    "placement-detail",
  ].includes(pageId);
  const showLeadDesk = activePage === "leads";
  const showPlacementDesk = activePage === "placement-tests";
  const showApplicationsDesk = activePage === "applications";
  const showEnrollmentDesk = activePage === "enrollments";
  const showStudentDesk = activePage === "students" || activePage === "classes";
  const showStudentCreateDesk = activePage === "students";
  const showAuditDesk = activePage === "reports";
  const showOperationsDesk = ["messages", "settings", "reports", "classes"].includes(
    activePage
  );
  const registrarMessages = state.communicationLogs
    .filter(
      log =>
        log.actorId === actorId ||
        /placement|admission|payment|trial/i.test(`${log.subject} ${log.body}`)
    )
    .slice(0, 5);
  const registrarScheduleEvents = state.events
    .filter(event =>
      ["placement_test", "trial_lesson", "room_booking"].includes(event.type)
    )
    .slice(0, 5);

  const runRegistrarAction = async (
    actionKey: string,
    action: Parameters<typeof runPlatformWorkflowActionRequest>[0],
    successMessage: string,
    successDescription?: string
  ) => {
    setPendingRegistrarAction(actionKey);
    try {
      const response = await runPlatformWorkflowActionRequest(action);
      if (!response.data)
        throw new Error(
          response.error ?? "Registrar action returned no state."
        );
      platformStore.setState(response.data.state);
      refresh();
      toast.success(
        successMessage,
        successDescription ? { description: successDescription } : undefined
      );
      return response.data.result;
    } catch (error) {
      toast.error("Registrar action could not be saved", {
        description:
          error instanceof Error
            ? error.message
            : "Check your session and try again.",
      });
      return undefined;
    } finally {
      setPendingRegistrarAction(null);
    }
  };

  const createLead = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!leadDraft.fullName.trim() || !leadDraft.phone.trim()) {
      toast.error("Name and phone are required");
      return;
    }
    const result = await runRegistrarAction(
      "lead.create",
      {
        type: "lead.create",
        fullName: leadDraft.fullName.trim(),
        email:
          leadDraft.email.trim() ||
          `${Date.now().toString(36)}@nilelearn.local`,
        phone: leadDraft.phone.trim(),
        country: leadDraft.country.trim() || "Egypt",
        subject: leadDraft.subject.trim() || "Arabic Language",
        source: leadDraft.source,
        notes: leadDraft.notes.trim(),
        actorId,
      },
      "Lead added to admissions"
    );
    if (result) {
      setLeadDraft({
        fullName: "",
        email: "",
        phone: "",
        country: "",
        subject: "Arabic Language",
        source: "manual",
        notes: "",
      });
    }
  };

  const createApplication = async (event: React.FormEvent) => {
    event.preventDefault();
    if (
      !applicationDraft.fullName.trim() ||
      !applicationDraft.email.trim() ||
      !applicationDraft.phone.trim()
    ) {
      toast.error("Applicant name, email, and phone are required");
      return;
    }
    const result = await runRegistrarAction(
      "application.create",
      {
        type: "application.create",
        fullName: applicationDraft.fullName.trim(),
        email: applicationDraft.email.trim(),
        phone: applicationDraft.phone.trim(),
        branchId: applicationDraft.branchId,
        courseInterest:
          applicationDraft.courseInterest.trim() || "Arabic Language",
        schedulePreference:
          applicationDraft.schedulePreference.trim() || "To confirm",
        notes: applicationDraft.notes.trim() || undefined,
        country: "Egypt",
        source: "manual",
        actorId,
      },
      "Application created",
      "Lead, application file, communication log, and audit evidence were saved."
    );
    if (result) {
      setApplicationDraft(value => ({
        ...value,
        fullName: "",
        email: "",
        phone: "",
        notes: "",
      }));
    }
  };

  const createPlacementBooking = async (event: React.FormEvent) => {
    event.preventDefault();
    if (
      !placementDraft.fullName.trim() ||
      !placementDraft.phone.trim() ||
      !placementDraft.preferredDate.trim()
    ) {
      toast.error("Name, phone, and date are required");
      return;
    }
    const email =
      placementDraft.email.trim() ||
      `${Date.now().toString(36)}@nilelearn.local`;
    const result = await runRegistrarAction(
      "placement.create",
      {
        type: "placement.create",
        fullName: placementDraft.fullName.trim(),
        email,
        phone: placementDraft.phone.trim(),
        branchId: placementDraft.branchId,
        subject: placementDraft.subject.trim() || "Arabic Language",
        preferredDate: placementDraft.preferredDate,
        currentLevel: placementDraft.currentLevel.trim() || "Placement pending",
        actorId,
      },
      "Placement booking added"
    );
    if (result) {
      const booking = result.result as { id?: string } | undefined;
      if (booking?.id) setSelectedPlacementId(booking.id);
      setPlacementDraft({
        fullName: "",
        email: "",
        phone: "",
        branchId: placementDraft.branchId,
        subject: "Arabic Language",
        preferredDate: getDefaultDueAt(2),
        currentLevel: "Placement pending",
      });
    }
  };

  const convertLead = async (leadId: string) => {
    await runRegistrarAction(
      `lead.convert:${leadId}`,
      { type: "lead.convert", leadId, actorId },
      "Lead converted to application"
    );
  };

  const convertApplication = async (applicationId: string) => {
    await runRegistrarAction(
      `application.convert:${applicationId}`,
      { type: "application.convert", applicationId, actorId },
      "Application prepared for enrollment"
    );
  };

  const createStudent = async (event: React.FormEvent) => {
    event.preventDefault();
    const courseRunId =
      selectedStudentCreateRun?.id ?? studentDraft.courseRunId;
    const classGroupId =
      selectedStudentCreateClass?.id ?? studentDraft.classGroupId;
    const fullName = studentDraft.fullName.trim();
    const email = studentDraft.email.trim().toLowerCase();
    const phone = studentDraft.phone.trim();
    const courseInterest = studentDraft.courseInterest.trim();
    const currentLevel = studentDraft.currentLevel.trim();
    if (!fullName || !email || !phone) {
      toast.error("Student name, email, and phone are required");
      return;
    }
    if (!email.includes("@")) {
      toast.error("Enter a valid student email address");
      return;
    }
    if (state.users.some(user => user.email.toLowerCase() === email)) {
      toast.error("This student email is already in the identity directory");
      return;
    }
    if (!courseInterest) {
      toast.error("Subject or course interest is required");
      return;
    }
    if (!currentLevel) {
      toast.error("Current level or placement result is required");
      return;
    }
    if (
      isMinorAgeGroup(studentDraft.ageGroup) &&
      (!studentDraft.guardianName.trim() || !studentDraft.guardianPhone.trim())
    ) {
      toast.error("Guardian name and phone are required for minor students");
      return;
    }
    if (!courseRunId || !classGroupId) {
      toast.error(
        "Choose a course run and class group before creating the student"
      );
      return;
    }
    if (selectedStudentCreateRun?.branchId !== studentDraft.branchId) {
      toast.error("Student branch must match the selected course run");
      return;
    }
    if (
      !selectedStudentCreateClass ||
      selectedStudentCreateClass.courseRunId !== courseRunId
    ) {
      toast.error(
        "Selected class group must belong to the selected course run"
      );
      return;
    }
    if (
      selectedStudentCreateClass.studentIds.length >=
      selectedStudentCreateClass.capacity
    ) {
      toast.error("Selected class is already at capacity");
      return;
    }
    const result = await runRegistrarAction(
      "student.create",
      {
        type: "student.create",
        fullName,
        email,
        phone,
        branchId: studentDraft.branchId,
        preferredLanguage: studentDraft.preferredLanguage,
        courseInterest,
        ageGroup: studentDraft.ageGroup,
        guardianName: studentDraft.guardianName.trim() || undefined,
        guardianPhone: studentDraft.guardianPhone.trim() || undefined,
        currentLevel,
        status: studentDraft.status,
        notes: studentDraft.notes.trim() || undefined,
        courseRunId,
        classGroupId,
        source: "direct",
        actorId,
      },
      "Student created and enrolled",
      "Identity, enrollment, class roster, teacher link, lesson path, and invoice were created."
    );
    if (result) {
      setStudentDraft(value => ({
        ...value,
        fullName: "",
        email: "",
        phone: "",
        guardianName: "",
        guardianPhone: "",
        notes: "",
      }));
    }
  };

  const updateStudentStatus = async (studentId: string) => {
    const nextStatus =
      studentStatusDrafts[studentId] ??
      state.students.find(student => student.id === studentId)?.status;
    if (!nextStatus) return;
    await runRegistrarAction(
      `student.status.update:${studentId}`,
      {
        type: "student.status.update",
        studentId,
        status: nextStatus,
        notes: "Updated from registrar student detail.",
        actorId,
      },
      "Student status updated"
    );
  };

  const recordPlacement = async () => {
    if (!selectedPlacement) {
      toast.error("No placement booking selected");
      return;
    }
    await runRegistrarAction(
      `placement.result.record:${selectedPlacement.id}`,
      {
        type: "placement.result.record",
        bookingId: selectedPlacement.id,
        recommendedLevel: recommendedLevel.trim() || "Arabic Level 2",
        score: Math.max(0, Math.min(100, Number(score) || 0)),
        notes: "Recorded from registrar admissions workspace.",
        actorId,
      },
      "Placement result recorded"
    );
  };

  const recordInvoicePayment = async (invoiceId: string, balance: number) => {
    const paymentRow = Array.from(
      document.querySelectorAll<HTMLElement>(".registrar-payment-row")
    ).find(row => row.dataset.invoiceId === invoiceId);
    const amountInput = paymentRow?.querySelector<HTMLInputElement>(
      ".registrar-payment-amount-input"
    );
    const methodSelect = paymentRow?.querySelector<HTMLSelectElement>(
      ".registrar-payment-record-fields select"
    );
    const referenceInput = Array.from(
      paymentRow?.querySelectorAll<HTMLInputElement>(
        ".registrar-payment-record-fields input"
      ) ?? []
    ).find(input => !input.classList.contains("registrar-payment-amount-input"));
    const requestedAmount = Number(
      paymentAmountDrafts[invoiceId] ?? amountInput?.value ?? balance
    );
    const result = await runRegistrarAction(
      `payment.record:${invoiceId}`,
      {
        type: "payment.record",
        invoiceId,
        amount: Number.isFinite(requestedAmount) ? requestedAmount : balance,
        method: (paymentMethodDrafts[invoiceId] ??
          methodSelect?.value ??
          "manual") as Payment["method"],
        reference:
          paymentReferenceDrafts[invoiceId]?.trim() ||
          referenceInput?.value.trim() ||
          undefined,
        actorId,
      },
      "Payment recorded"
    );
    if (result) {
      setPaymentAmountDrafts(current => {
        const next = { ...current };
        delete next[invoiceId];
        return next;
      });
      setPaymentReferenceDrafts(current => {
        const next = { ...current };
        delete next[invoiceId];
        return next;
      });
    }
  };

  const activateEnrollment = async (
    workflowId: string,
    assignment?: { courseRunId?: string; classGroupId?: string }
  ) => {
    const result = await runRegistrarAction(
      `enrollment.activate:${workflowId}`,
      {
        type: "enrollment.activate",
        workflowId,
        courseRunId: assignment?.courseRunId,
        classGroupId: assignment?.classGroupId,
        actorId,
      },
      "Student portal activated",
      "Account, class, enrollment, lesson path, and invoice are connected."
    );
    if (!result) {
      toast.error("Enrollment could not be activated", {
        description: "Check class capacity and target course.",
      });
    }
  };

  const isActionPending = (actionKey: string) =>
    pendingRegistrarAction === actionKey;
  const isAnyRegistrarActionPending = Boolean(pendingRegistrarAction);

  return (
    <div className="registrar-workspace">
      <PlatformWorkspaceHeader
        className="registrar-hero"
        title={registrarPageCopy.title}
        description={registrarPageCopy.description}
        context={<span>{registrarPageCopy.context}</span>}
        actionsClassName="registrar-actions"
        actions={
          <>
            {[
              ["Leads", "leads", Megaphone],
              ["Applications", "applications", FileText],
              ["Students", "students", Users],
              ["Placement", "placement-tests", ClipboardList],
              ["Enrollments", "enrollments", UserPlus],
              ["Classes", "classes", CalendarDays],
              ["Payments", "payments", CreditCard],
              ["Settings", "settings", SlidersHorizontal],
            ].map(([label, routeId, Icon]) => (
              <Link
                key={String(routeId)}
                href={`/app/registrar/${routeId}`}
                className={activePage === routeId ? "active" : ""}
                aria-current={activePage === routeId ? "page" : undefined}
              >
                <Icon size={15} />
                {label as string}
              </Link>
            ))}
          </>
        }
      />

      {activePage === "payments" ? (
        <div className="registrar-payment-desk">
          <section className="registrar-payment-command registrar-panel">
            <div className="registrar-panel-head">
              <div>
                <span>Payment operations</span>
                <strong>Collect, reconcile, and audit invoices</strong>
              </div>
              <CreditCard size={18} />
            </div>
            <div className="registrar-payment-summary">
              <article>
                <span>Total invoices</span>
                <strong>{paymentTotals.invoices}</strong>
                <small>Visible in registrar scope</small>
              </article>
              <article>
                <span>Open balances</span>
                <strong>{paymentTotals.open}</strong>
                <small>EGP {paymentTotals.balance} remaining</small>
              </article>
              <article>
                <span>Collected</span>
                <strong>EGP {paymentTotals.collected}</strong>
                <small>{paymentTotals.paid} settled invoice(s)</small>
              </article>
            </div>
            <div className="registrar-payment-toolbar">
              <label>
                <Search size={15} />
                <input
                  aria-label="Search registrar payment ledger"
                  value={paymentSearch}
                  onChange={event => setPaymentSearch(event.target.value)}
                  placeholder="Search invoice, student, email, branch"
                />
              </label>
              <label>
                <Filter size={15} />
                <select
                  value={paymentStatusFilter}
                  onChange={event =>
                    setPaymentStatusFilter(
                      event.target.value as typeof paymentStatusFilter
                    )
                  }
                >
                  <option value="all">All statuses</option>
                  <option value="open">Open balance</option>
                  <option value="paid">Paid</option>
                  <option value="overdue">Overdue</option>
                </select>
              </label>
            </div>
          </section>

          <section className="registrar-panel registrar-payment-table-card">
            <div className="registrar-panel-head">
              <div>
                <span>Invoice ledger</span>
                <strong>{filteredPaymentRows.length} row(s)</strong>
              </div>
              <ShieldCheck size={18} />
            </div>
            <div
              className="registrar-payment-table"
              role="table"
              aria-label="Registrar invoice ledger"
            >
              <div className="registrar-payment-table-head" role="row">
                <span role="columnheader">Student</span>
                <span role="columnheader">Invoice</span>
                <span role="columnheader">Amount</span>
                <span role="columnheader">Paid</span>
                <span role="columnheader">Balance</span>
                <span role="columnheader">Status</span>
                <span role="columnheader">Record</span>
                <span role="columnheader">Action</span>
              </div>
              {filteredPaymentRows.map(row => (
                <article
                  key={row.invoice.id}
                  className="registrar-payment-row"
                  data-invoice-id={row.invoice.id}
                  role="row"
                >
                  <div role="cell">
                    <strong>{row.user?.name ?? row.invoice.studentId}</strong>
                    <small>
                      {row.user?.email ?? "No email"} ·{" "}
                      {row.branch?.name ?? "No branch"} ·{" "}
                      {row.course?.title ?? "No course"}
                    </small>
                  </div>
                  <div role="cell">
                    <strong>{row.invoice.id}</strong>
                    <small>
                      {row.enrollment?.id ?? "No enrollment"} ·{" "}
                      {row.classGroup?.name ?? "Class pending"} · due{" "}
                      {row.invoice.dueAt} ·{" "}
                      {row.lastPayment
                        ? `${row.lastPayment.method}${row.lastPayment.reference ? ` · ${row.lastPayment.reference}` : ""} · ${row.lastPayment.paidAt.slice(0, 10)}`
                        : "No receipt yet"}
                    </small>
                  </div>
                  <span role="cell">
                    {row.invoice.currency} {row.invoice.amount}
                  </span>
                  <span role="cell">
                    {row.invoice.currency} {row.paid}
                  </span>
                  <span
                    role="cell"
                    className={row.balance > 0 ? "attention" : "settled"}
                  >
                    {row.invoice.currency} {row.balance}
                  </span>
                  <span
                    role="cell"
                    className={`registrar-payment-status ${row.status}`}
                  >
                    {row.status}
                  </span>
                  <div className="registrar-payment-record-fields" role="cell">
                    <input
                      className="registrar-payment-amount-input"
                      type="number"
                      min="0"
                      max={row.balance}
                      value={
                        paymentAmountDrafts[row.invoice.id] ??
                        String(row.balance)
                      }
                      disabled={
                        row.balance <= 0 ||
                        row.invoice.status === "paid" ||
                        isAnyRegistrarActionPending
                      }
                      aria-label={`Payment amount for ${row.invoice.id}`}
                      onChange={event =>
                        setPaymentAmountDrafts(current => ({
                          ...current,
                          [row.invoice.id]: event.target.value,
                        }))
                      }
                    />
                    <select
                      value={paymentMethodDrafts[row.invoice.id] ?? "manual"}
                      disabled={
                        row.balance <= 0 ||
                        row.invoice.status === "paid" ||
                        isAnyRegistrarActionPending
                      }
                      aria-label={`Payment method for ${row.invoice.id}`}
                      onChange={event =>
                        setPaymentMethodDrafts(current => ({
                          ...current,
                          [row.invoice.id]: event.target
                            .value as Payment["method"],
                        }))
                      }
                    >
                      {paymentMethods.map(method => (
                        <option key={method} value={method}>
                          {method.replace("_", " ")}
                        </option>
                      ))}
                    </select>
                    <input
                      value={paymentReferenceDrafts[row.invoice.id] ?? ""}
                      disabled={
                        row.balance <= 0 ||
                        row.invoice.status === "paid" ||
                        isAnyRegistrarActionPending
                      }
                      aria-label={`Payment reference for ${row.invoice.id}`}
                      placeholder="Reference"
                      onChange={event =>
                        setPaymentReferenceDrafts(current => ({
                          ...current,
                          [row.invoice.id]: event.target.value,
                        }))
                      }
                    />
                  </div>
                  <button
                    type="button"
                    disabled={
                      row.balance <= 0 ||
                      row.invoice.status === "paid" ||
                      isAnyRegistrarActionPending
                    }
                    onClick={() =>
                      recordInvoicePayment(row.invoice.id, row.balance)
                    }
                  >
                    {isActionPending(`payment.record:${row.invoice.id}`)
                      ? "Recording..."
                      : row.balance <= 0 || row.invoice.status === "paid"
                        ? "Settled"
                        : "Record payment"}
                  </button>
                </article>
              ))}
              {filteredPaymentRows.length === 0 ? (
                <div className="registrar-payment-empty">
                  <CreditCard size={18} />
                  <strong>No invoices match this view</strong>
                  <small>Clear the search or switch the status filter.</small>
                </div>
              ) : null}
            </div>
          </section>

        </div>
      ) : (
        <>
          {[
            "lead-detail",
            "application-detail",
            "student-detail",
            "placement-detail",
          ].includes(pageId) ? (
            <section className="registrar-panel registrar-detail-focus">
              <div className="registrar-panel-head">
                <div>
                  <span>Selected record</span>
                  <strong>
                    {detailRecordMissing
                      ? "Record not found"
                      : pageId === "student-detail"
                        ? (selectedStudentUser?.name ?? "Student record")
                        : pageId === "application-detail"
                          ? (selectedApplicationLead?.fullName ??
                            "Application file")
                          : pageId === "placement-detail"
                            ? (selectedPlacement?.fullName ??
                              "Placement booking")
                            : (selectedLead?.fullName ?? "Lead record")}
                  </strong>
                </div>
                <UserCircle size={18} />
              </div>
              {detailRecordMissing ? (
                <div className="registrar-detail-empty">
                  <AlertCircle size={18} />
                  <div>
                    <strong>This registrar record does not exist.</strong>
                    <small>
                      Use the list pages to choose a valid lead, application,
                      student, or placement booking.
                    </small>
                  </div>
                  <Link
                    className="platform-secondary-button compact"
                    href={`/app/registrar/${activePage}`}
                  >
                    <ArrowRight size={15} />
                    Back to {activePage.replace("-", " ")}
                  </Link>
                </div>
              ) : (
                <>
                  <div className="registrar-detail-grid">
                    {pageId === "lead-detail" ? (
                      <>
                        <article>
                          <span>Lead status</span>
                          <strong>{selectedLead?.status ?? "No lead"}</strong>
                          <small>
                            {selectedLead?.subject ?? "Subject"} ·{" "}
                            {selectedLead?.source ?? "source"}
                          </small>
                        </article>
                        <article>
                          <span>Contact</span>
                          <strong>{selectedLead?.phone ?? "No phone"}</strong>
                          <small>{selectedLead?.email ?? "No email"}</small>
                        </article>
                        <article>
                          <span>Application</span>
                          <strong>
                            {selectedLeadApplication
                              ? "Converted"
                              : "Not converted"}
                          </strong>
                          <small>
                            {selectedLeadApplication?.courseInterest ??
                              selectedLead?.notes ??
                              "Ready for follow-up"}
                          </small>
                        </article>
                        <button
                          disabled={
                            !selectedLead ||
                            Boolean(selectedLeadApplication) ||
                            isAnyRegistrarActionPending
                          }
                          onClick={() =>
                            selectedLead && convertLead(selectedLead.id)
                          }
                        >
                          <UserPlus size={15} />
                          {isActionPending(`lead.convert:${selectedLead?.id}`)
                            ? "Converting..."
                            : selectedLeadApplication
                              ? "Application exists"
                              : "Convert lead"}
                        </button>
                      </>
                    ) : pageId === "application-detail" ? (
                      <>
                        <article>
                          <span>Application status</span>
                          <strong>
                            {selectedApplication?.status ?? "No application"}
                          </strong>
                          <small>
                            {selectedApplication?.courseInterest ?? "Course"} ·{" "}
                            {selectedApplication?.schedulePreference ??
                              "Schedule pending"}
                          </small>
                        </article>
                        <article>
                          <span>Applicant</span>
                          <strong>
                            {selectedApplicationLead?.fullName ??
                              "No linked lead"}
                          </strong>
                          <small>
                            {selectedApplicationLead?.phone ?? "No phone"} ·{" "}
                            {selectedApplicationLead?.email ?? "No email"}
                          </small>
                        </article>
                        <article>
                          <span>Branch access</span>
                          <strong>
                            {selectedApplicationBranch?.name ??
                              selectedApplication?.branchId ??
                              "No branch"}
                          </strong>
                          <small>
                            {selectedApplicationLead?.notes ??
                              "Internal admissions follow-up only"}
                          </small>
                        </article>
                        <article>
                          <span>Enrollment handoff</span>
                          <strong>
                            {selectedApplicationWorkflow
                              ? "Prepared"
                              : "Not prepared"}
                          </strong>
                          <small>
                            {selectedApplicationWorkflow?.nextStep ??
                              "Prepare after branch, level, and course fit are confirmed."}
                          </small>
                        </article>
                        <button
                          disabled={
                            !selectedApplication ||
                            Boolean(selectedApplicationWorkflow) ||
                            isAnyRegistrarActionPending
                          }
                          onClick={() =>
                            selectedApplication &&
                            convertApplication(selectedApplication.id)
                          }
                        >
                          <UserPlus size={15} />
                          {isActionPending(
                            `application.convert:${selectedApplication?.id}`
                          )
                            ? "Preparing..."
                            : selectedApplicationWorkflow
                              ? "Enrollment prepared"
                              : "Prepare enrollment"}
                        </button>
                        <Link
                          className="registrar-row-link"
                          href="/app/registrar/enrollments"
                        >
                          <ArrowRight size={15} />
                          Open handoff
                        </Link>
                      </>
                    ) : pageId === "placement-detail" ? (
                      <>
                        <article>
                          <span>Booking</span>
                          <strong>
                            {selectedPlacement?.subject ?? "Placement"}
                          </strong>
                          <small>
                            {selectedPlacement?.preferredDate ?? "No date"} ·{" "}
                            {selectedPlacement?.currentLevel ?? "No level"}
                          </small>
                        </article>
                        <article>
                          <span>Status</span>
                          <strong>
                            {selectedPlacement?.status ?? "No booking"}
                          </strong>
                          <small>
                            {selectedPlacement?.recommendedLevel ??
                              "Result not recorded"}
                          </small>
                        </article>
                        <article>
                          <span>Contact</span>
                          <strong>
                            {selectedPlacement?.phone ?? "No phone"}
                          </strong>
                          <small>
                            {selectedPlacement?.email ?? "No email"}
                          </small>
                        </article>
                        <div className="registrar-placement-inputs">
                          <label>
                            Recommended level
                            <input
                              value={recommendedLevel}
                              onChange={event =>
                                setRecommendedLevel(event.target.value)
                              }
                            />
                          </label>
                          <label>
                            Score
                            <input
                              type="number"
                              min={0}
                              max={100}
                              value={score}
                              onChange={event =>
                                setScore(Number(event.target.value))
                              }
                            />
                          </label>
                        </div>
                        <button
                          type="button"
                          disabled={
                            !selectedPlacement ||
                            selectedPlacement.status === "completed" ||
                            isAnyRegistrarActionPending
                          }
                          onClick={recordPlacement}
                        >
                          <CheckCircle2 size={15} />
                          {isActionPending(
                            `placement.result.record:${selectedPlacement?.id}`
                          )
                            ? "Saving result..."
                            : selectedPlacement?.status === "completed"
                              ? "Result recorded"
                              : "Record placement result"}
                        </button>
                      </>
                    ) : (
                      <>
                        <article>
                          <span>Student</span>
                          <strong>
                            {selectedStudentUser?.email ?? "No account"}
                          </strong>
                          <small>
                            {selectedStudent?.preferredLanguage ?? "Language"} ·{" "}
                            {selectedStudent?.ageGroup ?? "Age group"} ·{" "}
                            {selectedStudent?.timezone ?? "Timezone"}
                          </small>
                        </article>
                        <article>
                          <span>Status</span>
                          <strong>
                            {selectedStudent?.status ?? "No status"}
                          </strong>
                          <small>
                            {selectedStudent?.currentLevel ?? "Level pending"} ·{" "}
                            {selectedStudent?.source ?? "existing"} intake
                          </small>
                        </article>
                        <article>
                          <span>Class and teacher</span>
                          <strong>
                            {selectedStudentDetailRows[0]?.classGroup?.name ??
                              "Class pending"}
                          </strong>
                          <small>
                            {selectedStudentDetailRows[0]?.teacher?.name ??
                              "Teacher through class"}{" "}
                            ·{" "}
                            {selectedStudentDetailRows[0]?.classGroup
                              ?.schedule ?? "Schedule pending"}
                          </small>
                        </article>
                        <article>
                          <span>Guardian</span>
                          <strong>
                            {selectedStudent?.guardianName ?? "Not required"}
                          </strong>
                          <small>
                            {selectedStudent?.guardianPhone ??
                              selectedStudentUser?.phone ??
                              "No guardian phone"}
                          </small>
                        </article>
                      </>
                    )}
                  </div>
                  {pageId === "application-detail" && selectedApplication ? (
                    <div className="registrar-student-detail-workspace">
                      <section>
                        <div className="registrar-panel-head compact">
                          <div>
                            <span>Application lifecycle</span>
                            <strong>
                              {selectedApplicationLead?.fullName ??
                                selectedApplication.id}
                            </strong>
                          </div>
                          <FileText size={16} />
                        </div>
                        <div className="registrar-lifecycle-rail">
                          {[
                            [
                              "Lead",
                              selectedApplicationLead ? "done" : "pending",
                            ],
                            [
                              "Application",
                              selectedApplication ? "done" : "pending",
                            ],
                            [
                              "Branch",
                              selectedApplicationBranch ? "done" : "pending",
                            ],
                            [
                              "Level",
                              selectedApplicationWorkflow?.targetLevelId
                                ? "done"
                                : "pending",
                            ],
                            [
                              "Enrollment",
                              selectedApplicationWorkflow ? "done" : "pending",
                            ],
                            [
                              "Portal",
                              selectedApplicationWorkflow?.studentId
                                ? "done"
                                : "pending",
                            ],
                          ].map(([label, status]) => (
                            <article key={label}>
                              <span className={status}>{status}</span>
                              <strong>{label}</strong>
                            </article>
                          ))}
                        </div>
                      </section>
                      <section>
                        <div className="registrar-panel-head compact">
                          <div>
                            <span>Communication log</span>
                            <strong>Internal placeholder</strong>
                          </div>
                          <MessageSquare size={16} />
                        </div>
                        <div className="registrar-operations-list">
                          {state.communicationLogs
                            .filter(log =>
                              /application|admission|follow-up|intake/i.test(
                                `${log.subject} ${log.body}`
                              )
                            )
                            .slice(0, 3)
                            .map(log => (
                              <article key={log.id}>
                                <strong>{log.subject}</strong>
                                <small>{log.body}</small>
                                <span>{log.status}</span>
                              </article>
                            ))}
                        </div>
                      </section>
                      <section className="wide">
                        <div className="registrar-panel-head compact">
                          <div>
                            <span>Audit</span>
                            <strong>Application transitions</strong>
                          </div>
                          <ShieldCheck size={16} />
                        </div>
                        <div className="admin-audit-list">
                          {selectedApplicationAuditRows.length ? (
                            selectedApplicationAuditRows.map(auditRow => (
                              <article key={auditRow.id}>
                                <strong>{auditRow.action}</strong>
                                <small>{auditRow.summary}</small>
                                <span>
                                  {new Date(
                                    auditRow.createdAt
                                  ).toLocaleString()}
                                </span>
                              </article>
                            ))
                          ) : (
                            <article>
                              <strong>application.ready</strong>
                              <small>
                                Application changes will appear after prepare or
                                enrollment actions.
                              </small>
                              <span>Now</span>
                            </article>
                          )}
                        </div>
                      </section>
                    </div>
                  ) : null}
                  {pageId === "student-detail" && selectedStudent ? (
                    <div className="registrar-student-detail-workspace">
                      <section>
                        <div className="registrar-panel-head compact">
                          <div>
                            <span>Lifecycle</span>
                            <strong>Admissions to active portal</strong>
                          </div>
                          <CheckCircle2 size={16} />
                        </div>
                        <div className="registrar-lifecycle-rail">
                          {[
                            [
                              "Profile",
                              selectedStudentUser ? "done" : "pending",
                            ],
                            [
                              "Level",
                              selectedStudent.currentLevel ? "done" : "pending",
                            ],
                            [
                              "Enrollment",
                              selectedStudentEnrollments.length
                                ? "done"
                                : "pending",
                            ],
                            [
                              "Class",
                              selectedStudentDetailRows.some(
                                row => row.classGroup
                              )
                                ? "done"
                                : "pending",
                            ],
                            [
                              "Teacher",
                              selectedStudentDetailRows.some(row => row.teacher)
                                ? "done"
                                : "pending",
                            ],
                            [
                              "Portal",
                              selectedStudent.status === "active"
                                ? "done"
                                : "pending",
                            ],
                          ].map(([label, status]) => (
                            <article key={label}>
                              <span className={status}>{status}</span>
                              <strong>{label}</strong>
                            </article>
                          ))}
                        </div>
                      </section>
                      <section>
                        <div className="registrar-panel-head compact">
                          <div>
                            <span>Manage status</span>
                            <strong>
                              {selectedStudentUser?.name ?? selectedStudent.id}
                            </strong>
                          </div>
                          <SlidersHorizontal size={16} />
                        </div>
                        <div className="registrar-student-status-control">
                          <select
                            value={
                              studentStatusDrafts[selectedStudent.id] ??
                              selectedStudent.status
                            }
                            disabled={isAnyRegistrarActionPending}
                            onChange={event =>
                              setStudentStatusDrafts(current => ({
                                ...current,
                                [selectedStudent.id]: event.target
                                  .value as StudentStatus,
                              }))
                            }
                          >
                            {[
                              "ready_to_enroll",
                              "enrolled",
                              "active",
                              "paused",
                              "completed",
                              "cancelled",
                            ].map(status => (
                              <option key={status} value={status}>
                                {status.replaceAll("_", " ")}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            disabled={isAnyRegistrarActionPending}
                            onClick={() =>
                              updateStudentStatus(selectedStudent.id)
                            }
                          >
                            {isActionPending(
                              `student.status.update:${selectedStudent.id}`
                            )
                              ? "Saving..."
                              : "Save status"}
                          </button>
                        </div>
                        <div className="registrar-student-next-action">
                          <span>Next action</span>
                          <strong>{selectedStudentNextAction}</strong>
                        </div>
                      </section>
                      <section>
                        <div className="registrar-panel-head compact">
                          <div>
                            <span>Placement and level</span>
                            <strong>{selectedStudentLevelLabel}</strong>
                          </div>
                          <ClipboardCheck size={16} />
                        </div>
                        <div className="registrar-student-fact-list">
                          <article>
                            <span>Placement</span>
                            <strong>
                              {selectedStudentPlacement?.status ?? "Not booked"}
                            </strong>
                            <small>
                              {selectedStudentPlacement?.preferredDate ??
                                "No placement booking linked"}
                            </small>
                          </article>
                          <article>
                            <span>Result</span>
                            <strong>
                              {selectedStudentPlacementResult
                                ? `${selectedStudentPlacementResult.score}%`
                                : "Pending"}
                            </strong>
                            <small>
                              {selectedStudentPlacementResult?.notes ??
                                selectedStudentWorkflow?.nextStep ??
                                "Level can be set directly or from placement."}
                            </small>
                          </article>
                        </div>
                      </section>
                      <section>
                        <div className="registrar-panel-head compact">
                          <div>
                            <span>Course, class, teacher</span>
                            <strong>
                              {selectedStudentPrimaryConnection?.course
                                ?.title ?? "Assignment pending"}
                            </strong>
                          </div>
                          <BookOpen size={16} />
                        </div>
                        <div className="registrar-student-fact-list">
                          <article>
                            <span>Class/group</span>
                            <strong>
                              {selectedStudentPrimaryConnection?.classGroup
                                ?.name ?? "Pending"}
                            </strong>
                            <small>
                              {selectedStudentPrimaryConnection?.classGroup
                                ?.schedule ??
                                "Assign a class group to unlock schedule, attendance, and portal data."}
                            </small>
                          </article>
                          <article>
                            <span>Teacher</span>
                            <strong>
                              {selectedStudentPrimaryConnection?.teacher
                                ?.name ?? "Pending"}
                            </strong>
                            <small>
                              {selectedStudentPrimaryConnection?.run
                                ? "Assigned through the class course run."
                                : "Teacher assignment happens through the class/group."}
                            </small>
                          </article>
                        </div>
                      </section>
                      <section className="wide">
                        <div className="registrar-panel-head compact">
                          <div>
                            <span>Enrollment panel</span>
                            <strong>
                              {selectedStudentDetailRows.length} active
                              connection(s)
                            </strong>
                          </div>
                          <UserPlus size={16} />
                        </div>
                        <div className="registrar-student-enrollment-list">
                          {selectedStudentDetailRows.length ? (
                            selectedStudentDetailRows.map(
                              ({ enrollment, course, classGroup, teacher }) => (
                                <article key={enrollment.id}>
                                  <div>
                                    <strong>
                                      {course?.title ?? enrollment.courseRunId}
                                    </strong>
                                    <small>
                                      {classGroup?.name ??
                                        enrollment.classGroupId ??
                                        "Class pending"}{" "}
                                      ·{" "}
                                      {teacher?.name ??
                                        enrollment.teacherId ??
                                        "Teacher pending"}{" "}
                                      ·{" "}
                                      {classGroup?.schedule ??
                                        "Schedule pending"}
                                    </small>
                                  </div>
                                  <span>{enrollment.status}</span>
                                </article>
                              )
                            )
                          ) : (
                            <article className="registrar-empty-row">
                              <div>
                                <strong>No enrollment</strong>
                                <small>
                                  Create or activate an enrollment before the
                                  student portal is useful.
                                </small>
                              </div>
                            </article>
                          )}
                        </div>
                      </section>
                      <section className="wide">
                        <div className="registrar-panel-head compact">
                          <div>
                            <span>Audit</span>
                            <strong>Recent student transitions</strong>
                          </div>
                          <ShieldCheck size={16} />
                        </div>
                        <div className="admin-audit-list">
                          {selectedStudentAuditRows.length ? (
                            selectedStudentAuditRows.map(auditRow => (
                              <article key={auditRow.id}>
                                <strong>{auditRow.action}</strong>
                                <small>{auditRow.summary}</small>
                                <span>
                                  {new Date(
                                    auditRow.createdAt
                                  ).toLocaleString()}
                                </span>
                              </article>
                            ))
                          ) : (
                            <article>
                              <strong>student.ready</strong>
                              <small>
                                Student lifecycle changes will appear here after
                                status or enrollment updates.
                              </small>
                              <span>Now</span>
                            </article>
                          )}
                        </div>
                      </section>
                    </div>
                  ) : null}
                </>
              )}
            </section>
          ) : null}

          {!isRegistrarDetailPage ? (
            <>
              <div className="registrar-layout">
                {showLeadDesk ? (
              <section className="registrar-panel registrar-intake-panel">
                <div className="registrar-panel-head">
                  <div>
                    <span>Lead intake</span>
                    <strong>{state.leads.length} active records</strong>
                  </div>
                  <Megaphone size={18} />
                </div>
                <div className="registrar-lead-list">
                  {[...state.leads]
                    .sort(
                      (a, b) =>
                        new Date(b.createdAt).getTime() -
                        new Date(a.createdAt).getTime()
                    )
                    .slice(0, 5)
                    .map(lead => {
                    const converted = state.applications.some(
                      application => application.leadId === lead.id
                    );
                    return (
                      <article key={lead.id}>
                        <div>
                          <strong>{lead.fullName}</strong>
                          <small>
                            {lead.subject} · {lead.phone} · {lead.source}
                          </small>
                        </div>
                        <span>{lead.status}</span>
                        <button
                          disabled={converted || isAnyRegistrarActionPending}
                          onClick={() => convertLead(lead.id)}
                        >
                          {isActionPending(`lead.convert:${lead.id}`)
                            ? "Converting..."
                            : converted
                              ? "Converted"
                              : "Convert"}
                        </button>
                      </article>
                    );
                  })}
                  {state.leads.length === 0 ? (
                    <article className="registrar-empty-row">
                      <div>
                        <strong>No active leads</strong>
                        <small>
                          Add the first enquiry to start the admissions
                          pipeline.
                        </small>
                      </div>
                    </article>
                  ) : null}
                </div>
                <form className="registrar-lead-form" onSubmit={createLead}>
                  <label>
                    Full name
                    <input
                      value={leadDraft.fullName}
                      onChange={event =>
                        setLeadDraft(value => ({
                          ...value,
                          fullName: event.target.value,
                        }))
                      }
                      placeholder="Student or guardian name"
                    />
                  </label>
                  <label>
                    Phone
                    <input
                      value={leadDraft.phone}
                      onChange={event =>
                        setLeadDraft(value => ({
                          ...value,
                          phone: event.target.value,
                        }))
                      }
                      placeholder="+20..."
                    />
                  </label>
                  <label>
                    Email
                    <input
                      type="email"
                      value={leadDraft.email}
                      onChange={event =>
                        setLeadDraft(value => ({
                          ...value,
                          email: event.target.value,
                        }))
                      }
                      placeholder="email@example.com"
                    />
                  </label>
                  <label>
                    Subject
                    <input
                      value={leadDraft.subject}
                      onChange={event =>
                        setLeadDraft(value => ({
                          ...value,
                          subject: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label>
                    Source
                    <select
                      value={leadDraft.source}
                      onChange={event =>
                        setLeadDraft(value => ({
                          ...value,
                          source: event.target.value as Lead["source"],
                        }))
                      }
                    >
                      <option value="manual">Manual</option>
                      <option value="website">Website</option>
                      <option value="trial_form">Trial form</option>
                      <option value="placement_form">Placement form</option>
                      <option value="whatsapp">WhatsApp</option>
                    </select>
                  </label>
                  <label>
                    Notes
                    <input
                      value={leadDraft.notes}
                      onChange={event =>
                        setLeadDraft(value => ({
                          ...value,
                          notes: event.target.value,
                        }))
                      }
                      placeholder="Schedule, branch, or language notes"
                    />
                  </label>
                  <button type="submit" disabled={isAnyRegistrarActionPending}>
                    <Plus size={15} />
                    {isActionPending("lead.create") ? "Adding..." : "Add lead"}
                  </button>
                </form>
              </section>
            ) : null}

            {showPlacementDesk ? (
              <section className="registrar-panel registrar-placement-panel">
                <div className="registrar-panel-head">
                  <div>
                    <span>Placement</span>
                    <strong>
                      {pendingPlacements.length} pending · book and result
                    </strong>
                  </div>
                  <ClipboardList size={18} />
                </div>
                <form
                  className="registrar-placement-booking-form"
                  onSubmit={createPlacementBooking}
                >
                  <label>
                    Student name
                    <input
                      value={placementDraft.fullName}
                      onChange={event =>
                        setPlacementDraft(value => ({
                          ...value,
                          fullName: event.target.value,
                        }))
                      }
                      placeholder="Student or guardian name"
                    />
                  </label>
                  <label>
                    Phone
                    <input
                      value={placementDraft.phone}
                      onChange={event =>
                        setPlacementDraft(value => ({
                          ...value,
                          phone: event.target.value,
                        }))
                      }
                      placeholder="+20..."
                    />
                  </label>
                  <label>
                    Email
                    <input
                      type="email"
                      value={placementDraft.email}
                      onChange={event =>
                        setPlacementDraft(value => ({
                          ...value,
                          email: event.target.value,
                        }))
                      }
                      placeholder="optional"
                    />
                  </label>
                  <label>
                    Branch
                    <select
                      value={placementDraft.branchId}
                      onChange={event =>
                        setPlacementDraft(value => ({
                          ...value,
                          branchId: event.target.value,
                        }))
                      }
                    >
                      {state.branches.map(branch => (
                        <option key={branch.id} value={branch.id}>
                          {branch.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Subject
                    <input
                      value={placementDraft.subject}
                      onChange={event =>
                        setPlacementDraft(value => ({
                          ...value,
                          subject: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label>
                    Preferred date
                    <input
                      type="date"
                      value={placementDraft.preferredDate}
                      onChange={event =>
                        setPlacementDraft(value => ({
                          ...value,
                          preferredDate: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label className="wide">
                    Current level
                    <input
                      value={placementDraft.currentLevel}
                      onChange={event =>
                        setPlacementDraft(value => ({
                          ...value,
                          currentLevel: event.target.value,
                        }))
                      }
                      placeholder="What the learner can already do"
                    />
                  </label>
                  <button type="submit" disabled={isAnyRegistrarActionPending}>
                    <Plus size={15} />
                    {isActionPending("placement.create")
                      ? "Booking..."
                      : "Book placement"}
                  </button>
                </form>
                <div className="registrar-placement-card">
                  <label>
                    Booking
                    <select
                      value={selectedPlacement?.id ?? ""}
                      onChange={event =>
                        setSelectedPlacementId(event.target.value)
                      }
                    >
                      {state.placementTests.map(booking => (
                        <option key={booking.id} value={booking.id}>
                          {booking.fullName} · {booking.subject}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div>
                    <strong>
                      {selectedPlacement?.fullName ?? "No booking selected"}
                    </strong>
                    <small>
                      {selectedPlacement
                        ? `${selectedPlacement.preferredDate} · ${selectedPlacement.currentLevel} · ${selectedPlacement.status}`
                        : "Create a placement booking first."}
                    </small>
                  </div>
                  <div className="registrar-placement-inputs">
                    <label>
                      Recommended level
                      <input
                        value={recommendedLevel}
                        onChange={event =>
                          setRecommendedLevel(event.target.value)
                        }
                      />
                    </label>
                    <label>
                      Score
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={score}
                        onChange={event => setScore(Number(event.target.value))}
                      />
                    </label>
                  </div>
                  <button
                    type="button"
                    disabled={
                      !selectedPlacement ||
                      selectedPlacement.status === "completed" ||
                      isAnyRegistrarActionPending
                    }
                    onClick={recordPlacement}
                  >
                    <CheckCircle2 size={15} />
                    {isActionPending(
                      `placement.result.record:${selectedPlacement?.id}`
                    )
                      ? "Saving result..."
                      : selectedPlacement?.status === "completed"
                        ? "Result recorded"
                        : "Record placement result"}
                  </button>
                </div>
              </section>
            ) : null}

            {showStudentCreateDesk ? (
              <section className="registrar-panel registrar-student-create-panel">
                <div className="registrar-panel-head">
                  <div>
                    <span>Direct student creation</span>
                    <strong>
                      Profile, enrollment, class, teacher, and portal
                    </strong>
                  </div>
                  <UserPlus size={18} />
                </div>
                <form
                  className="registrar-student-create-form"
                  onSubmit={createStudent}
                >
                  <label>
                    Full name
                    <input
                      value={studentDraft.fullName}
                      onChange={event =>
                        setStudentDraft(value => ({
                          ...value,
                          fullName: event.target.value,
                        }))
                      }
                      placeholder="Student full name"
                    />
                  </label>
                  <label>
                    Email
                    <input
                      type="email"
                      value={studentDraft.email}
                      onChange={event =>
                        setStudentDraft(value => ({
                          ...value,
                          email: event.target.value,
                        }))
                      }
                      placeholder="student@nilelearn.local"
                    />
                  </label>
                  <label>
                    Phone / WhatsApp
                    <input
                      value={studentDraft.phone}
                      onChange={event =>
                        setStudentDraft(value => ({
                          ...value,
                          phone: event.target.value,
                        }))
                      }
                      placeholder="+20..."
                    />
                  </label>
                  <label>
                    Branch
                    <select
                      value={studentDraft.branchId}
                      onChange={event => {
                        const branchId = event.target.value;
                        const run =
                          state.courseRuns.find(
                            item => item.branchId === branchId
                          ) ?? state.courseRuns[0];
                        const group =
                          state.classGroups.find(
                            item =>
                              item.courseRunId === run?.id &&
                              item.studentIds.length < item.capacity
                          ) ?? undefined;
                        setStudentDraft(value => ({
                          ...value,
                          branchId,
                          courseRunId: run?.id ?? "",
                          classGroupId: group?.id ?? "",
                        }));
                      }}
                    >
                      {state.branches.map(branch => (
                        <option key={branch.id} value={branch.id}>
                          {branch.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Preferred language
                    <select
                      value={studentDraft.preferredLanguage}
                      onChange={event =>
                        setStudentDraft(value => ({
                          ...value,
                          preferredLanguage: event.target.value,
                        }))
                      }
                    >
                      <option value="English">English</option>
                      <option value="Arabic">Arabic</option>
                      <option value="Turkish">Turkish</option>
                      <option value="Russian">Russian</option>
                    </select>
                  </label>
                  <label>
                    Subject / course interest
                    <input
                      value={studentDraft.courseInterest}
                      onChange={event =>
                        setStudentDraft(value => ({
                          ...value,
                          courseInterest: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label>
                    Age group
                    <select
                      value={studentDraft.ageGroup}
                      onChange={event =>
                        setStudentDraft(value => ({
                          ...value,
                          ageGroup: event.target.value,
                        }))
                      }
                    >
                      <option value="Adult">Adult</option>
                      <option value="Teen minor">Teen minor</option>
                      <option value="Child minor">Child minor</option>
                    </select>
                  </label>
                  <label>
                    Current level / placement
                    <input
                      value={studentDraft.currentLevel}
                      onChange={event =>
                        setStudentDraft(value => ({
                          ...value,
                          currentLevel: event.target.value,
                        }))
                      }
                      placeholder="Arabic Level 3"
                    />
                  </label>
                  <label>
                    Course run
                    <select
                      value={selectedStudentCreateRun?.id ?? ""}
                      onChange={event => {
                        const runId = event.target.value;
                        const group =
                          state.classGroups.find(
                            item =>
                              item.courseRunId === runId &&
                              item.studentIds.length < item.capacity
                          ) ?? undefined;
                        setStudentDraft(value => ({
                          ...value,
                          courseRunId: runId,
                          classGroupId: group?.id ?? "",
                        }));
                      }}
                    >
                      {studentCreateCourseRuns.length ? (
                        studentCreateCourseRuns.map(run => {
                          const course = state.courses.find(
                            item => item.id === run.courseId
                          );
                          return (
                            <option key={run.id} value={run.id}>
                              {course?.title ?? run.courseId} · {run.term}
                            </option>
                          );
                        })
                      ) : (
                        <option value="">No course runs in branch</option>
                      )}
                    </select>
                  </label>
                  <label>
                    Class / group
                    <select
                      value={selectedStudentCreateClass?.id ?? ""}
                      onChange={event =>
                        setStudentDraft(value => ({
                          ...value,
                          classGroupId: event.target.value,
                        }))
                      }
                    >
                      {studentCreateClassGroups.length ? (
                        studentCreateClassGroups.map(group => (
                          <option key={group.id} value={group.id}>
                            {group.name} · {group.studentIds.length}/
                            {group.capacity}
                          </option>
                        ))
                      ) : (
                        <option value="">No class groups</option>
                      )}
                    </select>
                  </label>
                  <label>
                    Student status
                    <select
                      value={studentDraft.status}
                      onChange={event =>
                        setStudentDraft(value => ({
                          ...value,
                          status: event.target
                            .value as typeof studentDraft.status,
                        }))
                      }
                    >
                      <option value="active">Active portal</option>
                      <option value="enrolled">Enrolled</option>
                      <option value="ready_to_enroll">Ready to enroll</option>
                      <option value="paused">Paused</option>
                    </select>
                  </label>
                  <label>
                    Guardian name
                    <input
                      value={studentDraft.guardianName}
                      onChange={event =>
                        setStudentDraft(value => ({
                          ...value,
                          guardianName: event.target.value,
                        }))
                      }
                      placeholder="Required for minors"
                    />
                  </label>
                  <label>
                    Guardian phone
                    <input
                      value={studentDraft.guardianPhone}
                      onChange={event =>
                        setStudentDraft(value => ({
                          ...value,
                          guardianPhone: event.target.value,
                        }))
                      }
                      placeholder="Required for minors"
                    />
                  </label>
                  <label className="wide">
                    Notes
                    <input
                      value={studentDraft.notes}
                      onChange={event =>
                        setStudentDraft(value => ({
                          ...value,
                          notes: event.target.value,
                        }))
                      }
                      placeholder="Placement, schedule, guardian, or class notes"
                    />
                  </label>
                  <div className="registrar-student-create-summary">
                    <span>
                      {selectedStudentCreateClass
                        ? `${Math.max(0, selectedStudentCreateClass.capacity - selectedStudentCreateClass.studentIds.length)} seats left`
                        : "No available class selected"}
                    </span>
                    <small>
                      {selectedStudentCreateClass?.schedule ??
                        "Choose a class group with an open seat"}{" "}
                      · teacher{" "}
                      {state.users.find(
                        user => user.id === selectedStudentCreateRun?.teacherId
                      )?.name ?? "pending"}
                    </small>
                  </div>
                  <button
                    type="submit"
                    disabled={
                      isAnyRegistrarActionPending ||
                      !selectedStudentCreateRun ||
                      !selectedStudentCreateClass
                    }
                  >
                    <Plus size={15} />
                    {isActionPending("student.create")
                      ? "Creating..."
                      : "Create and enroll"}
                  </button>
                </form>
              </section>
            ) : null}

          </div>

          {showOperationsDesk ? (
            <section className="registrar-panel registrar-operations-panel">
              <div className="registrar-panel-head">
                <div>
                  <span>{activePage}</span>
                  <strong>
                    {activePage === "schedule"
                      ? "Admissions calendar and room readiness"
                      : activePage === "messages"
                        ? "Follow-up messages and templates"
                        : activePage === "settings"
                          ? "Admissions configuration"
                          : activePage === "classes"
                            ? "Class capacity and assignment view"
                            : "Registrar reports and activity"}
                  </strong>
                </div>
                <SlidersHorizontal size={18} />
              </div>
              <div className="registrar-operations-grid">
                {activePage === "schedule" || activePage === "classes" ? (
                  <div className="registrar-operations-list">
                    {registrarScheduleEvents.length ? (
                      registrarScheduleEvents.map(event => {
                        const branch = state.branches.find(
                          item => item.id === event.branchId
                        );
                        const room = state.rooms.find(
                          item => item.id === event.roomId
                        );
                        return (
                          <article key={event.id}>
                            <strong>{event.title}</strong>
                            <small>
                              {event.startsAt} · {branch?.name ?? "No branch"} ·{" "}
                              {room?.name ?? "No room"}
                            </small>
                            <span>{event.status}</span>
                          </article>
                        );
                      })
                    ) : (
                      <article className="registrar-empty-row">
                        <div>
                          <strong>No admissions events</strong>
                          <small>
                            Placement tests and room bookings will appear here.
                          </small>
                        </div>
                      </article>
                    )}
                  </div>
                ) : null}
                {activePage === "messages" ? (
                  <div className="registrar-operations-list">
                    {registrarMessages.length ? (
                      registrarMessages.map(message => {
                        const relatedUser = state.users.find(
                          item => item.id === message.relatedUserId
                        );
                        return (
                          <article key={message.id}>
                            <strong>{message.subject}</strong>
                            <small>
                              {message.channel} ·{" "}
                              {relatedUser?.name ?? "Admissions contact"} ·{" "}
                              {message.createdAt}
                            </small>
                            <span>{message.status}</span>
                          </article>
                        );
                      })
                    ) : (
                      <article className="registrar-empty-row">
                        <div>
                          <strong>No registrar follow-ups</strong>
                          <small>
                            Lead, placement, and payment messages will be
                            tracked here.
                          </small>
                        </div>
                      </article>
                    )}
                  </div>
                ) : null}
                {activePage === "settings" || activePage === "reports" ? (
                  <div className="registrar-operations-list">
                    <article>
                      <strong>Admission branches</strong>
                      <small>
                        {state.branches.map(branch => branch.name).join(", ")}
                      </small>
                      <span>{state.branches.length}</span>
                    </article>
                    <article>
                      <strong>Payment methods</strong>
                      <small>
                        {paymentMethods
                          .map(method => method.replace("_", " "))
                          .join(", ")}
                      </small>
                      <span>active</span>
                    </article>
                    <article>
                      <strong>Templates</strong>
                      <small>
                        {state.messageTemplates
                          .filter(
                            template => template.category === "admissions"
                          )
                          .map(template => template.title)
                          .join(", ") || "No admissions templates"}
                      </small>
                      <span>
                        {
                          state.messageTemplates.filter(
                            template => template.category === "admissions"
                          ).length
                        }
                      </span>
                    </article>
                  </div>
                ) : null}
              </div>
            </section>
          ) : null}

          <div className="registrar-lower-grid">
            {showApplicationsDesk ? (
              <section className="registrar-panel">
                <div className="registrar-panel-head">
                  <div>
                    <span>Applications</span>
                    <strong>{state.applications.length} files</strong>
                  </div>
                  <FileText size={18} />
                </div>
                {activePage === "applications" ? (
                  <form
                    className="registrar-application-form"
                    onSubmit={createApplication}
                    aria-label="Create registrar application"
                  >
                    <label>
                      Applicant name
                      <input
                        name="applicationFullName"
                        value={applicationDraft.fullName}
                        onChange={event =>
                          setApplicationDraft(value => ({
                            ...value,
                            fullName: event.target.value,
                          }))
                        }
                        placeholder="Student or guardian name"
                      />
                    </label>
                    <label>
                      Email
                      <input
                        name="applicationEmail"
                        type="email"
                        value={applicationDraft.email}
                        onChange={event =>
                          setApplicationDraft(value => ({
                            ...value,
                            email: event.target.value,
                          }))
                        }
                        placeholder="applicant@nilelearn.local"
                      />
                    </label>
                    <label>
                      Phone
                      <input
                        name="applicationPhone"
                        value={applicationDraft.phone}
                        onChange={event =>
                          setApplicationDraft(value => ({
                            ...value,
                            phone: event.target.value,
                          }))
                        }
                        placeholder="+20..."
                      />
                    </label>
                    <label>
                      Branch
                      <select
                        name="applicationBranch"
                        value={applicationDraft.branchId}
                        onChange={event =>
                          setApplicationDraft(value => ({
                            ...value,
                            branchId: event.target.value,
                          }))
                        }
                      >
                        {state.branches.map(branch => (
                          <option key={branch.id} value={branch.id}>
                            {branch.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Course interest
                      <input
                        name="applicationCourseInterest"
                        value={applicationDraft.courseInterest}
                        onChange={event =>
                          setApplicationDraft(value => ({
                            ...value,
                            courseInterest: event.target.value,
                          }))
                        }
                      />
                    </label>
                    <label>
                      Schedule preference
                      <input
                        name="applicationSchedulePreference"
                        value={applicationDraft.schedulePreference}
                        onChange={event =>
                          setApplicationDraft(value => ({
                            ...value,
                            schedulePreference: event.target.value,
                          }))
                        }
                        placeholder="Morning, evening, weekend"
                      />
                    </label>
                    <label className="wide">
                      Notes
                      <input
                        name="applicationNotes"
                        value={applicationDraft.notes}
                        onChange={event =>
                          setApplicationDraft(value => ({
                            ...value,
                            notes: event.target.value,
                          }))
                        }
                        placeholder="Placement, guardian, schedule, or payment context"
                      />
                    </label>
                    <button
                      type="submit"
                      disabled={isAnyRegistrarActionPending}
                    >
                      <Plus size={15} />
                      {isActionPending("application.create")
                        ? "Creating..."
                        : "Create application"}
                    </button>
                  </form>
                ) : null}
                <div className="registrar-application-list">
                  {state.applications.map(application => {
                    const lead = state.leads.find(
                      item => item.id === application.leadId
                    );
                    const branch = state.branches.find(
                      item => item.id === application.branchId
                    );
                    const workflow = state.enrollmentWorkflows.find(
                      item => item.applicationId === application.id
                    );
                    return (
                      <article key={application.id}>
                        <div>
                          <strong>{lead?.fullName ?? application.id}</strong>
                          <small>
                            {application.courseInterest} ·{" "}
                            {branch?.name ?? "No branch"} ·{" "}
                            {application.schedulePreference}
                          </small>
                        </div>
                        <span>{application.status}</span>
                        <Link
                          className="registrar-row-link"
                          href={`/app/registrar/applications/${application.id}`}
                        >
                          Open
                        </Link>
                        <button
                          type="button"
                          disabled={
                            Boolean(workflow) || isAnyRegistrarActionPending
                          }
                          onClick={() => convertApplication(application.id)}
                        >
                          {isActionPending(
                            `application.convert:${application.id}`
                          )
                            ? "Preparing..."
                            : workflow
                              ? "Prepared"
                              : "Prepare"}
                        </button>
                      </article>
                    );
                  })}
                  {state.applications.length === 0 ? (
                    <article className="registrar-empty-row">
                      <div>
                        <strong>No applications</strong>
                        <small>
                          Convert a lead to create the first application file.
                        </small>
                      </div>
                    </article>
                  ) : null}
                </div>
              </section>
            ) : null}

            {showEnrollmentDesk ? (
              <section className="registrar-panel">
                <div className="registrar-panel-head">
                  <div>
                    <span>Enrollment handoff</span>
                    <strong>{readyWorkflows.length} ready</strong>
                  </div>
                  <UserPlus size={18} />
                </div>
                <div className="registrar-workflow-list">
                  {state.enrollmentWorkflows.map(workflow => {
                    const lead = state.leads.find(
                      item => item.id === workflow.leadId
                    );
                    const student = state.students.find(
                      item => item.id === workflow.studentId
                    );
                    const user = state.users.find(
                      item => item.id === student?.userId
                    );
                    const course = state.courses.find(
                      item => item.id === workflow.targetCourseId
                    );
                    const courseRuns = state.courseRuns.filter(
                      item => item.courseId === workflow.targetCourseId
                    );
                    const defaultCourseRun =
                      courseRuns.find(item => item.status === "active") ??
                      courseRuns[0];
                    const draft = enrollmentAssignmentDrafts[workflow.id];
                    const selectedCourseRun =
                      courseRuns.find(item => item.id === draft?.courseRunId) ??
                      defaultCourseRun;
                    const classGroups = state.classGroups.filter(
                      item => item.courseRunId === selectedCourseRun?.id
                    );
                    const defaultClassGroup =
                      classGroups.find(
                        item => item.studentIds.length < item.capacity
                      ) ?? classGroups[0];
                    const selectedClassGroup =
                      classGroups.find(
                        item => item.id === draft?.classGroupId
                      ) ?? defaultClassGroup;
                    const invoice = state.invoices.find(
                      item => item.studentId === student?.id
                    );
                    const isActivated = Boolean(workflow.studentId && student);
                    const canActivate =
                      !isActivated &&
                      workflow.status === "ready_to_enroll" &&
                      Boolean(selectedCourseRun && selectedClassGroup);
                    return (
                      <article key={workflow.id}>
                        <div>
                          <strong>
                            {lead?.fullName ?? user?.name ?? workflow.id}
                          </strong>
                          <small>
                            {course?.title ?? "Course"} ·{" "}
                            {selectedClassGroup?.name ?? "Class pending"} ·{" "}
                            {workflow.nextStep}
                          </small>
                        </div>
                        <span>{isActivated ? "active" : workflow.status}</span>
                        {!isActivated ? (
                          <div className="registrar-workflow-assignment">
                            <label>
                              Run
                              <select
                                value={selectedCourseRun?.id ?? ""}
                                disabled={
                                  isAnyRegistrarActionPending ||
                                  !courseRuns.length
                                }
                                onChange={event => {
                                  const nextRunId = event.target.value;
                                  const nextClassGroup =
                                    state.classGroups.find(
                                      item =>
                                        item.courseRunId === nextRunId &&
                                        item.studentIds.length < item.capacity
                                    ) ??
                                    state.classGroups.find(
                                      item => item.courseRunId === nextRunId
                                    );
                                  setEnrollmentAssignmentDrafts(current => ({
                                    ...current,
                                    [workflow.id]: {
                                      courseRunId: nextRunId,
                                      classGroupId: nextClassGroup?.id ?? "",
                                    },
                                  }));
                                }}
                              >
                                {courseRuns.length ? (
                                  courseRuns.map(run => {
                                    const branch = state.branches.find(
                                      item => item.id === run.branchId
                                    );
                                    return (
                                      <option key={run.id} value={run.id}>
                                        {run.term} ·{" "}
                                        {branch?.name ?? run.branchId}
                                      </option>
                                    );
                                  })
                                ) : (
                                  <option value="">No course run</option>
                                )}
                              </select>
                            </label>
                            <label>
                              Class
                              <select
                                value={selectedClassGroup?.id ?? ""}
                                disabled={
                                  isAnyRegistrarActionPending ||
                                  !classGroups.length
                                }
                                onChange={event =>
                                  setEnrollmentAssignmentDrafts(current => ({
                                    ...current,
                                    [workflow.id]: {
                                      courseRunId: selectedCourseRun?.id ?? "",
                                      classGroupId: event.target.value,
                                    },
                                  }))
                                }
                              >
                                {classGroups.length ? (
                                  classGroups.map(group => (
                                    <option key={group.id} value={group.id}>
                                      {group.name} · {group.studentIds.length}/
                                      {group.capacity}
                                    </option>
                                  ))
                                ) : (
                                  <option value="">No class</option>
                                )}
                              </select>
                            </label>
                            <small>
                              {selectedClassGroup
                                ? `${selectedClassGroup.schedule} · ${Math.max(0, selectedClassGroup.capacity - selectedClassGroup.studentIds.length)} seats left`
                                : "Create a class before activation."}
                            </small>
                          </div>
                        ) : null}
                        <button
                          disabled={!canActivate || isAnyRegistrarActionPending}
                          onClick={() =>
                            activateEnrollment(workflow.id, {
                              courseRunId: selectedCourseRun?.id,
                              classGroupId: selectedClassGroup?.id,
                            })
                          }
                        >
                          {isActionPending(`enrollment.activate:${workflow.id}`)
                            ? "Activating..."
                            : isActivated
                              ? `Invoice ${invoice?.status ?? "pending"}`
                              : "Activate"}
                        </button>
                      </article>
                    );
                  })}
                  {state.enrollmentWorkflows.length === 0 ? (
                    <article className="registrar-empty-row">
                      <div>
                        <strong>No enrollment handoffs</strong>
                        <small>
                          Convert a lead or record placement to prepare
                          enrollment.
                        </small>
                      </div>
                    </article>
                  ) : null}
                </div>
              </section>
            ) : null}

            {showStudentDesk ? (
              <section className="registrar-panel">
                <div className="registrar-panel-head">
                  <div>
                    <span>Students and classes</span>
                    <strong>{state.students.length} students</strong>
                  </div>
                  <Users size={18} />
                </div>
                <div className="registrar-student-class-list">
                  {state.enrollments.slice(0, 5).map(enrollment => {
                    const student = state.students.find(
                      item => item.id === enrollment.studentId
                    );
                    const user = state.users.find(
                      item => item.id === student?.userId
                    );
                    const run = state.courseRuns.find(
                      item => item.id === enrollment.courseRunId
                    );
                    const course = state.courses.find(
                      item => item.id === run?.courseId
                    );
                    const classGroup =
                      state.classGroups.find(
                        item => item.id === enrollment.classGroupId
                      ) ??
                      state.classGroups.find(
                        item =>
                          item.courseRunId === run?.id &&
                          item.studentIds.includes(enrollment.studentId)
                      ) ??
                      state.classGroups.find(
                        item => item.courseRunId === run?.id
                      );
                    return (
                      <article key={enrollment.id}>
                        <div>
                          <strong>{user?.name ?? enrollment.studentId}</strong>
                          <small>
                            {course?.title ?? "Course"} ·{" "}
                            {classGroup?.name ?? "Class pending"}
                          </small>
                        </div>
                        <span>{enrollment.status}</span>
                        <Link
                          className="registrar-row-link"
                          href={`/app/registrar/students/${enrollment.studentId}`}
                        >
                          Open
                        </Link>
                      </article>
                    );
                  })}
                  {state.enrollments.length === 0 ? (
                    <article className="registrar-empty-row">
                      <div>
                        <strong>No active enrollments</strong>
                        <small>
                          Activate an enrollment workflow to assign a student to
                          a class.
                        </small>
                      </div>
                    </article>
                  ) : null}
                </div>
              </section>
            ) : null}

            {showAuditDesk ? (
              <section className="registrar-panel">
                <div className="registrar-panel-head">
                  <div>
                    <span>Admissions audit</span>
                    <strong>Recent operations</strong>
                  </div>
                  <ShieldCheck size={18} />
                </div>
                <div className="admin-audit-list">
                  {registrarAuditRows.length ? (
                    registrarAuditRows.map(auditRow => (
                      <article key={auditRow.id}>
                        <strong>{auditRow.action}</strong>
                        <small>{auditRow.summary}</small>
                        <span>
                          {new Date(auditRow.createdAt).toLocaleString()}
                        </span>
                      </article>
                    ))
                  ) : (
                    <article>
                      <strong>registrar.ready</strong>
                      <small>
                        Admissions workspace is connected to local platform
                        state.
                      </small>
                      <span>Now</span>
                    </article>
                  )}
                </div>
              </section>
            ) : null}
          </div>
            </>
          ) : null}
        </>
      )}
    </div>
  );
}

function TeacherDeliveryExperience({
  pageId,
  params,
}: {
  pageId: string;
  params?: Record<string, string | undefined>;
}) {
  const [version, setVersion] = useState(0);
  const [selectedClassId, setSelectedClassId] = useState(params?.classId ?? "");
  const [sessionDraft, setSessionDraft] = useState({
    title: "Focused live class",
    startsAt: "2026-06-29T09:00",
    endsAt: "2026-06-29T10:30",
  });
  const [assignmentDraft, setAssignmentDraft] = useState({
    title: "Applied grammar checkpoint",
    dueAt: "2026-07-03T18:00",
    submissionType: "text" as "text" | "file" | "audio" | "video",
    rubric: "Accuracy, examples, clarity",
  });
  const [quizDraft, setQuizDraft] = useState({
    title: "Live class exit quiz",
    durationMinutes: 20,
    attemptsAllowed: 2,
    questionTypes: "multiple_choice, short_answer",
  });
  const [gradeDraft, setGradeDraft] = useState({
    score: 92,
    feedback: "Clear answer structure. Add one more example in the next draft.",
  });
  const [sessionSaving, setSessionSaving] = useState(false);
  const [attendanceSaving, setAttendanceSaving] = useState(false);
  const [reminderSaving, setReminderSaving] = useState(false);
  const [materialSavingKey, setMaterialSavingKey] = useState("");
  const state = useMemo(() => platformStore.getState(), [version]);
  const refresh = () => setVersion(value => value + 1);
  const actorId = getDemoUser("teacher").id;
  const teacherRuns = state.courseRuns.filter(run => run.teacherId === actorId);
  const teacherClasses = state.classGroups.filter(classGroup =>
    teacherRuns.some(run => run.id === classGroup.courseRunId)
  );
  const selectedClass =
    teacherClasses.find(
      classGroup => classGroup.id === (params?.classId ?? selectedClassId)
    ) ??
    teacherClasses.find(classGroup => classGroup.id === selectedClassId) ??
    teacherClasses[0];
  const selectedRun = state.courseRuns.find(
    run => run.id === selectedClass?.courseRunId
  );
  const selectedCourse = state.courses.find(
    course => course.id === selectedRun?.courseId
  );
  const selectedBranch = state.branches.find(
    branch => branch.id === selectedRun?.branchId
  );
  const selectedRoom = state.rooms.find(
    room => room.id === selectedClass?.roomId
  );
  const meeting = state.meetingLinks.find(
    link => link.id === selectedClass?.meetingLinkId
  );
  const modules = state.modules
    .filter(moduleItem => moduleItem.courseId === selectedCourse?.id)
    .sort((a, b) => a.order - b.order);
  const lessonRows = modules.flatMap(moduleItem =>
    state.lessons
      .filter(lesson => lesson.moduleId === moduleItem.id)
      .map(lesson => ({ lesson, module: moduleItem }))
  );
  const resourceRows = lessonRows.flatMap(({ lesson }) =>
    state.resources
      .filter(resource => resource.lessonId === lesson.id)
      .map(resource => ({ resource, lesson }))
  );
  const classStudents = (selectedClass?.studentIds ?? [])
    .map(studentId => {
      const student = state.students.find(item => item.id === studentId);
      const user = state.users.find(item => item.id === student?.userId);
      const enrollment = state.enrollments.find(
        item =>
          item.studentId === studentId && item.courseRunId === selectedRun?.id
      );
      return student && user ? { student, user, enrollment } : null;
    })
    .filter(Boolean) as Array<{
    student: (typeof state.students)[number];
    user: (typeof state.users)[number];
    enrollment?: (typeof state.enrollments)[number];
  }>;
  const classSessions = state.classSessions.filter(
    session => session.classGroupId === selectedClass?.id
  );
  const activeSession = classSessions[0];
  const assignments = state.assignments.filter(
    assignment => assignment.courseRunId === selectedRun?.id
  );
  const quizzes = state.quizzes.filter(
    quiz => quiz.courseRunId === selectedRun?.id
  );
  const selectedAssignment =
    assignments.find(assignment => assignment.id === params?.assignmentId) ??
    assignments[0];
  const selectedQuiz =
    quizzes.find(quiz => quiz.id === params?.quizId) ?? quizzes[0];
  const pendingSubmissions = state.assignmentSubmissions.filter(
    submission =>
      assignments.some(
        assignment => assignment.id === submission.assignmentId
      ) &&
      classStudents.some(row => row.student.id === submission.studentId) &&
      submission.status === "pending"
  );
  const selectedSubmission =
    pendingSubmissions.find(
      submission => submission.assignmentId === selectedAssignment?.id
    ) ?? pendingSubmissions[0];
  const selectedSubmissionAssignment = assignments.find(
    assignment => assignment.id === selectedSubmission?.assignmentId
  );
  const selectedSubmissionStudent = classStudents.find(
    row => row.student.id === selectedSubmission?.studentId
  );
  const attendanceRecords = state.attendance.filter(
    record => record.classGroupId === selectedClass?.id
  );
  const savedAttendance = classSessions.filter(
    session => session.attendanceSaved
  ).length;
  const averageProgress = classStudents.length
    ? Math.round(
        classStudents.reduce(
          (sum, row) => sum + (row.enrollment?.progress ?? 0),
          0
        ) / classStudents.length
      )
    : 0;
  const teacherAuditRows = state.auditLogs
    .filter(audit =>
      /class|attendance|calendar|lesson|material|assignment|quiz|message/i.test(
        `${audit.action} ${audit.entityType} ${audit.summary}`
      )
    )
    .slice(0, 6);
  const activePage =
    pageId === "class-detail"
      ? "class-detail"
      : pageId === "sessions"
        ? "sessions"
        : pageId === "students"
          ? "students"
          : pageId === "materials"
            ? "materials"
            : pageId === "assignments" || pageId === "assignment-detail"
              ? "assignments"
              : pageId === "grading"
                ? "grading"
                : pageId === "quizzes"
                  ? "quizzes"
                  : pageId === "question-bank"
                    ? "question-bank"
                    : "classes";
  const classBaseHref = selectedClass
    ? `/app/teacher/classes/${selectedClass.id}`
    : "/app/teacher/classes";

  const createSession = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedClass || !selectedRun || !sessionDraft.title.trim()) {
      toast.error("Select a class and enter a session title");
      return;
    }
    setSessionSaving(true);
    const result = await runPlatformWorkflowActionRequest({
      type: "calendar.create",
      eventType: "live_session",
      title: sessionDraft.title.trim(),
      startsAt: new Date(sessionDraft.startsAt).toISOString(),
      endsAt: new Date(sessionDraft.endsAt).toISOString(),
      ownerId: actorId,
      branchId: selectedRun.branchId,
      roomId: selectedClass.roomId,
      classGroupId: selectedClass.id,
    });
    setSessionSaving(false);
    if (!result.ok || !result.data) {
      toast.error("Class session save failed", {
        description: result.error ?? "Check the selected class and time.",
      });
      return;
    }
    platformStore.setState(result.data.state);
    setSessionDraft({
      title: "Focused live class",
      startsAt: "2026-06-29T09:00",
      endsAt: "2026-06-29T10:30",
    });
    refresh();
    toast.success("Class session created", {
      description: result.data.persistence,
    });
  };

  const saveAllPresent = async () => {
    if (!selectedClass || !activeSession) {
      toast.error("Create a session before saving attendance");
      return;
    }
    const statuses = classStudents.reduce<Record<string, AttendanceStatus>>(
      (acc, row) => {
        acc[row.student.id] = "present";
        return acc;
      },
      {}
    );
    setAttendanceSaving(true);
    const result = await runPlatformWorkflowActionRequest({
      type: "attendance.save",
      classGroupId: selectedClass.id,
      sessionId: activeSession.id,
      statuses,
    });
    setAttendanceSaving(false);
    if (!result.ok || !result.data) {
      toast.error("Attendance save failed", {
        description: result.error ?? "Check the current session and roster.",
      });
      return;
    }
    platformStore.setState(result.data.state);
    refresh();
    toast.success("Attendance saved", {
      description: `${selectedClass.name} · ${result.data.persistence}`,
    });
  };

  const sendClassReminder = async () => {
    const firstStudent = classStudents[0];
    if (!firstStudent || !selectedClass) {
      toast.error("No student is assigned to this class");
      return;
    }
    setReminderSaving(true);
    const result = await runPlatformWorkflowActionRequest({
      type: "message.send",
      toUserId: firstStudent.user.id,
      subject: `${selectedClass.name} reminder`,
      body: `${selectedClass.name} is scheduled for ${selectedClass.schedule}.`,
      channel: "in_app",
      actorId,
    });
    setReminderSaving(false);
    if (!result.ok || !result.data) {
      toast.error("Class reminder failed", {
        description:
          result.error ?? "The server could not send this class reminder.",
      });
      return;
    }
    platformStore.setState(result.data.state);
    refresh();
    toast.success("Class reminder sent", {
      description: result.data.persistence,
    });
  };

  const toggleResourcePublish = async (resourceId: string) => {
    const resource = state.resources.find(item => item.id === resourceId);
    if (!resource) return;
    setMaterialSavingKey(resource.id);
    const result = await runPlatformWorkflowActionRequest({
      type: "material.publish.update",
      id: resource.id,
      published: !resource.published,
      actorId,
    });
    setMaterialSavingKey("");
    if (!result.ok || !result.data) {
      toast.error("Material publish update failed", {
        description:
          result.error ?? "The server could not save this material state.",
      });
      return;
    }
    platformStore.setState(result.data.state);
    refresh();
    toast.success(
      !resource.published ? "Material published" : "Material unpublished",
      {
        description: result.data.persistence,
      }
    );
  };

  const createAssignment = (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedRun || !assignmentDraft.title.trim()) {
      toast.error("Select a class and enter an assignment title");
      return;
    }
    const assignment = platformStore.createAssignment(
      {
        courseRunId: selectedRun.id,
        title: assignmentDraft.title.trim(),
        dueAt: new Date(assignmentDraft.dueAt).toISOString(),
        submissionType: assignmentDraft.submissionType,
        rubric: assignmentDraft.rubric
          .split(",")
          .map(item => item.trim())
          .filter(Boolean),
      },
      actorId
    );
    refresh();
    toast.success("Assignment created", { description: assignment.title });
  };

  const createQuiz = (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedRun || !quizDraft.title.trim()) {
      toast.error("Select a class and enter a quiz title");
      return;
    }
    const quiz = platformStore.createQuiz(
      {
        courseRunId: selectedRun.id,
        title: quizDraft.title.trim(),
        dueAt: getDefaultDueAt(2),
        durationMinutes: Number(quizDraft.durationMinutes) || 20,
        attemptsAllowed: Math.max(1, Number(quizDraft.attemptsAllowed) || 1),
        questionTypes: quizDraft.questionTypes
          .split(",")
          .map(item => item.trim())
          .filter(Boolean),
      },
      actorId
    );
    refresh();
    toast.success("Quiz created", { description: quiz.title });
  };

  const gradeSelectedSubmission = () => {
    if (!selectedSubmission) {
      toast.error("No pending submission selected");
      return;
    }
    const graded = platformStore.gradeAssignmentSubmission(
      selectedSubmission.id,
      Math.min(100, Math.max(0, Number(gradeDraft.score) || 0)),
      gradeDraft.feedback.trim() || "Reviewed by teacher.",
      actorId
    );
    refresh();
    if (!graded) {
      toast.error("Submission was not found");
      return;
    }
    toast.success("Submission graded", { description: graded.id });
  };

  return (
    <div className="teacher-delivery-workspace">
      <PlatformWorkspaceHeader
        className="teacher-delivery-hero"
        title="Class delivery"
        description="Run sessions, attendance, materials, assignments, quizzes, and grading from one workspace."
        context={<span>{selectedCourse?.title ?? "Class delivery"}</span>}
        actionsClassName="teacher-delivery-actions"
        actions={
          <>
            {[
              ["Classes", "/app/teacher/classes", "classes", BookOpen],
              ["Overview", classBaseHref, "class-detail", MonitorPlay],
              [
                "Sessions",
                `${classBaseHref}/sessions`,
                "sessions",
                CalendarDays,
              ],
              ["Students", `${classBaseHref}/students`, "students", Users],
              [
                "Materials",
                `${classBaseHref}/materials`,
                "materials",
                FileText,
              ],
              [
                "Attendance",
                `${classBaseHref}/attendance`,
                "attendance",
                CheckCircle2,
              ],
              [
                "Assignments",
                "/app/teacher/assignments",
                "assignments",
                FileQuestion,
              ],
              ["Grading", "/app/teacher/grading", "grading", ShieldCheck],
              ["Quizzes", "/app/teacher/quizzes", "quizzes", ClipboardList],
              [
                "Question bank",
                "/app/teacher/question-bank",
                "question-bank",
                Database,
              ],
            ].map(([label, href, routeId, Icon]) => (
              <Link
                key={String(routeId)}
                href={String(href)}
                className={activePage === routeId ? "active" : ""}
                aria-current={activePage === routeId ? "page" : undefined}
              >
                <Icon size={15} />
                {label as string}
              </Link>
            ))}
          </>
        }
      />

      <div className="teacher-delivery-kpis">
        <AdminAccessMetric
          label="Classes"
          value={String(teacherClasses.length)}
        />
        <AdminAccessMetric
          label="Students"
          value={String(classStudents.length)}
        />
        <AdminAccessMetric label="Lessons" value={String(lessonRows.length)} />
        <AdminAccessMetric
          label="Pending grading"
          value={String(pendingSubmissions.length)}
        />
        <AdminAccessMetric label="Progress" value={`${averageProgress}%`} />
      </div>

      {[
        "assignments",
        "assignment-detail",
        "grading",
        "quizzes",
        "question-bank",
      ].includes(pageId) ? (
        <section className="teacher-panel teacher-assessment-command">
          <div className="teacher-panel-head">
            <div>
              <span>Assessment command</span>
              <strong>
                {pageId === "grading"
                  ? "Grade learner work"
                  : pageId === "quizzes" || pageId === "question-bank"
                    ? "Build quiz activity"
                    : (selectedAssignment?.title ?? "Create assignment")}
              </strong>
            </div>
            <FileQuestion size={18} />
          </div>
          <div className="teacher-assessment-command-grid">
            <form className="teacher-session-form" onSubmit={createAssignment}>
              <strong>Create assignment</strong>
              <label>
                Title
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
                Due
                <input
                  type="datetime-local"
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
                Submission type
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
              <button type="submit">
                <Plus size={15} />
                Create assignment
              </button>
            </form>

            <form className="teacher-session-form" onSubmit={createQuiz}>
              <strong>Create quiz</strong>
              <label>
                Title
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
                Duration minutes
                <input
                  type="number"
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
              <button type="submit">
                <Plus size={15} />
                Create quiz
              </button>
            </form>

            <div className="teacher-grading-card">
              <strong>
                {selectedSubmission
                  ? "Pending submission"
                  : "No pending submission"}
              </strong>
              <small>
                {selectedSubmission
                  ? `${selectedSubmissionStudent?.user.name ?? selectedSubmission.studentId} · ${selectedSubmissionAssignment?.title ?? selectedSubmission.assignmentId}`
                  : "Submitted work will appear here when students turn in assignments."}
              </small>
              <label>
                Score
                <input
                  type="number"
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
                <textarea
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
                onClick={gradeSelectedSubmission}
                disabled={!selectedSubmission}
              >
                <ShieldCheck size={15} />
                Return feedback
              </button>
            </div>

            <div className="teacher-assessment-route-card">
              <strong>Selected route context</strong>
              <small>
                {selectedCourse?.title ?? "Course"} ·{" "}
                {selectedClass?.name ?? "Class"}
              </small>
              <div className="teacher-route-context-list">
                <span>Assignment: {selectedAssignment?.title ?? "None"}</span>
                <span>Quiz: {selectedQuiz?.title ?? "None"}</span>
                <span>Pending: {pendingSubmissions.length}</span>
                <span>
                  Question bank:{" "}
                  {quizzes.reduce(
                    (sum, quiz) => sum + quiz.questionTypes.length,
                    0
                  )}{" "}
                  mapped types
                </span>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      <div className="teacher-delivery-layout">
        <section className="teacher-panel teacher-class-panel">
          <div className="teacher-panel-head">
            <div>
              <span>Teaching scope</span>
              <strong>{selectedClass?.name ?? "No class selected"}</strong>
            </div>
            <select
              value={selectedClass?.id ?? ""}
              onChange={event => setSelectedClassId(event.target.value)}
              aria-label="Teacher class scope"
            >
              {teacherClasses.map(classGroup => (
                <option key={classGroup.id} value={classGroup.id}>
                  {classGroup.name}
                </option>
              ))}
            </select>
          </div>
          <div className="teacher-class-card">
            <span>{selectedBranch?.code ?? "CL"}</span>
            <div>
              <strong>
                {selectedCourse?.description ?? "Course description"}
              </strong>
              <small>
                {selectedClass?.schedule ?? "Schedule pending"} ·{" "}
                {selectedRoom?.name ?? "Room pending"} ·{" "}
                {meeting?.status ?? "meeting pending"}
              </small>
            </div>
          </div>
          <div className="teacher-readiness-list">
            {[
              [
                "Sessions",
                classSessions.length
                  ? `${classSessions.length} scheduled`
                  : "Create first session",
              ],
              [
                "Attendance",
                savedAttendance
                  ? `${savedAttendance} saved`
                  : "Attendance pending",
              ],
              [
                "Assignments",
                assignments.length
                  ? `${assignments.length} active`
                  : "No assignment",
              ],
              [
                "Resources",
                `${resourceRows.filter(row => row.resource.published).length}/${resourceRows.length} published`,
              ],
            ].map(([label, value]) => (
              <article key={label}>
                <strong>{label}</strong>
                <small>{value}</small>
              </article>
            ))}
          </div>
        </section>

        <section className="teacher-panel teacher-session-panel">
          <div className="teacher-panel-head">
            <div>
              <span>Live session</span>
              <strong>{activeSession?.title ?? "No session yet"}</strong>
            </div>
            <Video size={18} />
          </div>
          <div className="teacher-session-card">
            <div>
              <strong>
                {activeSession
                  ? new Date(activeSession.startsAt).toLocaleString()
                  : "Create a live class session"}
              </strong>
              <small>
                {activeSession
                  ? `${activeSession.status} · attendance ${activeSession.attendanceSaved ? "saved" : "pending"}`
                  : "The session will create a calendar event and class session record."}
              </small>
            </div>
            <div className="teacher-session-actions">
              <button
                onClick={saveAllPresent}
                disabled={
                  !activeSession || !classStudents.length || attendanceSaving
                }
              >
                <CheckCircle2 size={15} />
                {attendanceSaving ? "Saving" : "Save all present"}
              </button>
              <button
                onClick={() => void sendClassReminder()}
                disabled={!classStudents.length || reminderSaving}
              >
                <MessageSquare size={15} />
                {reminderSaving ? "Sending" : "Send reminder"}
              </button>
            </div>
          </div>
          <form className="teacher-session-form" onSubmit={createSession}>
            <label>
              Title
              <input
                value={sessionDraft.title}
                onChange={event =>
                  setSessionDraft(value => ({
                    ...value,
                    title: event.target.value,
                  }))
                }
              />
            </label>
            <label>
              Starts
              <input
                type="datetime-local"
                value={sessionDraft.startsAt}
                onChange={event =>
                  setSessionDraft(value => ({
                    ...value,
                    startsAt: event.target.value,
                  }))
                }
              />
            </label>
            <label>
              Ends
              <input
                type="datetime-local"
                value={sessionDraft.endsAt}
                onChange={event =>
                  setSessionDraft(value => ({
                    ...value,
                    endsAt: event.target.value,
                  }))
                }
              />
            </label>
            <button type="submit" disabled={sessionSaving}>
              <Plus size={15} />
              {sessionSaving ? "Saving session" : "Create session"}
            </button>
          </form>
        </section>

        <section className="teacher-panel teacher-course-panel">
          <div className="teacher-panel-head">
            <div>
              <span>Course map</span>
              <strong>{modules.length} modules</strong>
            </div>
            <Layers size={18} />
          </div>
          <div className="teacher-lesson-list">
            {lessonRows.slice(0, 6).map(({ lesson, module }) => (
              <article key={lesson.id}>
                <div>
                  <strong>{lesson.title}</strong>
                  <small>
                    {module.title} · {lesson.type} · {lesson.durationMinutes}{" "}
                    min
                  </small>
                </div>
                <span>{lesson.resourceIds.length} files</span>
              </article>
            ))}
          </div>
        </section>
      </div>

      <div className="teacher-delivery-lower-grid">
        <section className="teacher-panel">
          <div className="teacher-panel-head">
            <div>
              <span>Roster</span>
              <strong>{classStudents.length} learners</strong>
            </div>
            <Users size={18} />
          </div>
          <div className="teacher-roster-list">
            {classStudents.map(row => (
              <article key={row.student.id}>
                <div>
                  <strong>{row.user.name}</strong>
                  <small>
                    {row.student.timezone} · attendance{" "}
                    {row.enrollment?.attendanceRate ?? 0}% · grade{" "}
                    {row.enrollment?.currentGrade ?? 0}%
                  </small>
                </div>
                <span>{row.enrollment?.progress ?? 0}%</span>
              </article>
            ))}
          </div>
        </section>

        <section className="teacher-panel">
          <div className="teacher-panel-head">
            <div>
              <span>Assessment work</span>
              <strong>{assignments.length + quizzes.length} items</strong>
            </div>
            <FileQuestion size={18} />
          </div>
          <div className="teacher-assessment-list">
            {[
              ...assignments.map(item => ({
                id: item.id,
                title: item.title,
                meta: `${item.submissionType} · due ${item.dueAt}`,
                status: item.status,
              })),
              ...quizzes.map(item => ({
                id: item.id,
                title: item.title,
                meta: `${item.durationMinutes} min · ${item.questionTypes.join(", ")}`,
                status: item.status,
              })),
            ].map(item => (
              <article key={item.id}>
                <div>
                  <strong>{item.title}</strong>
                  <small>{item.meta}</small>
                </div>
                <span>{item.status}</span>
              </article>
            ))}
          </div>
        </section>

        <section className="teacher-panel">
          <div className="teacher-panel-head">
            <div>
              <span>Materials</span>
              <strong>{resourceRows.length} resources</strong>
            </div>
            <Headphones size={18} />
          </div>
          <div className="teacher-material-list">
            {resourceRows.map(({ resource, lesson }) => (
              <article key={resource.id}>
                <div>
                  <strong>{resource.title}</strong>
                  <small>
                    {lesson.title} · {resource.type}
                  </small>
                </div>
                <button
                  onClick={() => void toggleResourcePublish(resource.id)}
                  disabled={materialSavingKey === resource.id}
                >
                  {materialSavingKey === resource.id
                    ? "Saving"
                    : resource.published
                      ? "Published"
                      : "Publish"}
                </button>
              </article>
            ))}
          </div>
        </section>

        <section className="teacher-panel">
          <div className="teacher-panel-head">
            <div>
              <span>Teaching audit</span>
              <strong>Recent operations</strong>
            </div>
            <ShieldCheck size={18} />
          </div>
          <div className="admin-audit-list">
            {teacherAuditRows.length ? (
              teacherAuditRows.map(auditRow => (
                <article key={auditRow.id}>
                  <strong>{auditRow.action}</strong>
                  <small>{auditRow.summary}</small>
                  <span>{new Date(auditRow.createdAt).toLocaleString()}</span>
                </article>
              ))
            ) : (
              <article>
                <strong>teacher.ready</strong>
                <small>
                  Class delivery workspace is connected to system data.
                </small>
                <span>Now</span>
              </article>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

const activityTypeLabel: Record<MoodleActivityType, string> = {
  page: "Page",
  book: "Book",
  hvp: "H5P",
  videotime: "Video Time",
  quiz: "Quiz",
  url: "URL",
  external_quizizz: "Quizizz",
  label: "Label",
};

function getActivityIcon(type: MoodleActivityType) {
  switch (type) {
    case "book":
      return BookOpen;
    case "hvp":
      return Puzzle;
    case "videotime":
      return Video;
    case "quiz":
      return FileQuestion;
    case "url":
    case "external_quizizz":
      return Link2;
    case "label":
      return FileText;
    case "page":
    default:
      return FileText;
  }
}

function activityKey(activity: MoodleActivity) {
  return activity.cmid ? `cmid-${activity.cmid}` : activity.sourceUrl;
}

function MoodleSourceExperience({
  config,
  role,
}: {
  config: PageConfig;
  role: Role;
}) {
  const course = useMemo(() => getMoodleSourceCourseSnapshot(), []);
  const canSeeHidden = role !== "student";
  const [activeType, setActiveType] = useState<"all" | MoodleActivityType>(
    "all"
  );
  const [visibility, setVisibility] = useState<"student" | "all" | "hidden">(
    canSeeHidden ? "all" : "student"
  );
  const [selectedSectionId, setSelectedSectionId] = useState<number | null>(
    course.sections.find(section => section.activities.length)?.id ??
      course.sections[0]?.id ??
      null
  );
  const [selectedActivityKey, setSelectedActivityKey] = useState<string>(() => {
    const firstActivity = course.sections
      .flatMap(section => section.activities)
      .find(activity => canSeeHidden || !activity.hiddenFromStudents);
    return firstActivity ? activityKey(firstActivity) : "";
  });
  const selectedSection =
    course.sections.find(section => section.id === selectedSectionId) ??
    course.sections.find(section => section.activities.length) ??
    course.sections[0];
  const hiddenCount = course.sections
    .flatMap(section => section.activities)
    .filter(activity => activity.hiddenFromStudents).length;

  const filteredSections = useMemo(() => {
    return course.sections
      .map(section => {
        const activities = section.activities.filter(activity => {
          const typeMatch =
            activeType === "all" || activity.type === activeType;
          const visibilityMatch =
            visibility === "all" ||
            (visibility === "student" && !activity.hiddenFromStudents) ||
            (visibility === "hidden" && activity.hiddenFromStudents);
          return typeMatch && visibilityMatch;
        });
        return { ...section, activities };
      })
      .filter(
        section =>
          section.activities.length || section.id === course.observedSectionId
      );
  }, [activeType, course, visibility]);

  const selectedActivity = useMemo(() => {
    const allActivities = filteredSections.flatMap(
      section => section.activities
    );
    return (
      allActivities.find(
        activity => activityKey(activity) === selectedActivityKey
      ) ??
      allActivities[0] ??
      null
    );
  }, [filteredSections, selectedActivityKey]);

  const selectedActivityIcon = selectedActivity
    ? getActivityIcon(selectedActivity.type)
    : FileText;
  const SelectedActivityIcon = selectedActivityIcon;
  const visibleCount = Object.values(course.activityTotals).reduce(
    (sum, value) => sum + value,
    0
  );

  const logSyncReview = () => {
    const audit = platformStore.audit(
      "moodle.sync.review",
      course.shortname,
      `moodle-course-${course.id}`,
      `Queued Moodle review for ${course.shortname}.`,
      getDemoUser(role).id
    );
    toast.success("Moodle review queued", { description: audit.id });
  };

  return (
    <div className="moodle-source-layout">
      <PlatformWorkspaceHeader
        className="moodle-source-hero"
        copyClassName="moodle-source-hero-copy"
        title="Course source"
        description={course.fullname}
        context={<span>Moodle course {course.shortname}</span>}
        meta={
          <div className="moodle-source-meta">
            <span>
              <Layers size={14} /> {course.moodleFormat}
            </span>
            <span>
              <BookOpen size={14} /> section {course.observedSectionId}
            </span>
            <span>
              <Server size={14} /> {course.integration.restAccess}
            </span>
          </div>
        }
        aside={
          <div className="moodle-source-sync">
            <strong>Integration status</strong>
            <span className="platform-status danger">
              <AlertTriangle size={14} />
              REST permissions required
            </span>
            <p>{course.integration.blockedReason}</p>
            <button
              className="platform-primary-button"
              style={{ background: roleMeta[role].color }}
              onClick={logSyncReview}
            >
              <RefreshCcw size={15} />
              {config.primaryAction}
            </button>
          </div>
        }
      />

      <div className="moodle-source-total-grid">
        {Object.entries(course.activityTotals)
          .filter(([, count]) => count > 0)
          .map(([type, count], index) => {
            const moodleType = type as MoodleActivityType;
            const Icon = getActivityIcon(moodleType);
            return (
              <button
                key={type}
                className={activeType === moodleType ? "active" : ""}
                onClick={() =>
                  setActiveType(activeType === moodleType ? "all" : moodleType)
                }
                style={{ "--delay": `${index * 35}ms` } as CSSProperties}
              >
                <Icon size={17} />
                <span>{activityTypeLabel[moodleType]}</span>
                <strong>{count}</strong>
              </button>
            );
          })}
      </div>

      <div className="moodle-source-controls">
        <div>
          <strong>{visibleCount} Moodle activities mapped</strong>
          <span>
            {canSeeHidden
              ? `${hiddenCount} teacher-only or hidden items included`
              : `${hiddenCount} teacher-only items hidden from the student view`}
          </span>
        </div>
        <div className="platform-toolbar-filters">
          <button
            className={visibility === "student" ? "active" : ""}
            onClick={() => setVisibility("student")}
          >
            <Eye size={14} />
            Student visible
          </button>
          {canSeeHidden ? (
            <>
              <button
                className={visibility === "hidden" ? "active" : ""}
                onClick={() => setVisibility("hidden")}
              >
                <EyeOff size={14} />
                Hidden
              </button>
              <button
                className={visibility === "all" ? "active" : ""}
                onClick={() => setVisibility("all")}
              >
                All source
              </button>
            </>
          ) : null}
        </div>
      </div>

      <div className="moodle-source-grid">
        <div className="moodle-source-outline">
          <div className="platform-card-title">
            <div>
              <span>Course outline</span>
              <strong>Sections and lessons</strong>
            </div>
          </div>
          <div className="moodle-section-list">
            {filteredSections.map(section => (
              <MoodleSectionButton
                key={section.id ?? section.title}
                section={section}
                active={section.id === selectedSection?.id}
                role={role}
                onSelect={() => {
                  setSelectedSectionId(section.id);
                  const firstActivity = section.activities[0];
                  if (firstActivity)
                    setSelectedActivityKey(activityKey(firstActivity));
                }}
              />
            ))}
          </div>
        </div>

        <div className="moodle-source-activities">
          <div className="platform-card-title">
            <div>
              <span>Selected section</span>
              <strong>{selectedSection?.title ?? "No section selected"}</strong>
            </div>
          </div>
          <div className="moodle-activity-list">
            {(
              filteredSections.find(
                section => section.id === selectedSection?.id
              )?.activities ?? []
            ).map(activity => {
              const Icon = getActivityIcon(activity.type);
              const active =
                selectedActivity &&
                activityKey(selectedActivity) === activityKey(activity);
              return (
                <button
                  key={activityKey(activity)}
                  className={active ? "active" : ""}
                  onClick={() => setSelectedActivityKey(activityKey(activity))}
                >
                  <span className="moodle-activity-icon">
                    <Icon size={16} />
                  </span>
                  <div>
                    <strong>{activity.title}</strong>
                    <small>
                      {activityTypeLabel[activity.type]} ·{" "}
                      {activity.cmid ? `cmid ${activity.cmid}` : "external"}
                    </small>
                  </div>
                  {activity.hiddenFromStudents ? (
                    <em>Hidden</em>
                  ) : (
                    <em>Visible</em>
                  )}
                </button>
              );
            })}
            {!filteredSections.find(
              section => section.id === selectedSection?.id
            )?.activities.length ? (
              <div className="platform-empty-state">
                <Filter size={18} />
                <strong>No activities in this filter</strong>
                <small>
                  Switch module type or visibility to inspect more source items.
                </small>
              </div>
            ) : null}
          </div>
        </div>

        <aside className="moodle-source-inspector">
          <div className="platform-card-title">
            <div>
              <span>Activity renderer</span>
              <strong>
                {selectedActivity?.title ?? "No activity selected"}
              </strong>
            </div>
            <SelectedActivityIcon
              size={18}
              style={{ color: roleMeta[role].color }}
            />
          </div>
          {selectedActivity ? (
            <>
              <div className="moodle-render-preview">
                <span
                  className={`moodle-render-type ${selectedActivity.renderer}`}
                >
                  {selectedActivity.renderer}
                </span>
                <MonitorPlay size={34} />
                <strong>{activityTypeLabel[selectedActivity.type]}</strong>
                <p>{selectedActivity.summary}</p>
              </div>
              <dl className="moodle-source-definition">
                <div>
                  <dt>Module id</dt>
                  <dd>{selectedActivity.cmid ?? "External"}</dd>
                </div>
                <div>
                  <dt>Visibility</dt>
                  <dd>
                    {selectedActivity.hiddenFromStudents
                      ? "Hidden from students"
                      : "Student visible"}
                  </dd>
                </div>
                <div>
                  <dt>Completion</dt>
                  <dd>{selectedActivity.completion}</dd>
                </div>
              </dl>
              <a
                className="platform-secondary-button"
                href={selectedActivity.sourceUrl}
                target="_blank"
                rel="noreferrer"
              >
                <ExternalLink size={15} />
                Open Moodle
              </a>
            </>
          ) : (
            <p>
              Select an activity to inspect its Moodle content and renderer
              strategy.
            </p>
          )}
        </aside>
      </div>

      <div className="moodle-integration-grid">
        <article className="platform-panel">
          <div className="platform-card-title">
            <div>
              <span>Protected contract</span>
              <strong>Required Moodle functions</strong>
            </div>
          </div>
          <ul>
            {course.integration.requiredFunctions.map(name => (
              <li key={name}>
                <CheckCircle2 size={15} />
                {name}
              </li>
            ))}
          </ul>
        </article>
        <article className="platform-panel">
          <div className="platform-card-title">
            <div>
              <span>Teacher operations</span>
              <strong>Controls observed in Moodle</strong>
            </div>
          </div>
          <ul>
            {course.teacherTools.slice(0, 9).map(tool => (
              <li key={tool}>
                <CheckCircle2 size={15} />
                {tool}
              </li>
            ))}
          </ul>
        </article>
        <article className="platform-panel">
          <div className="platform-card-title">
            <div>
              <span>Sync strategy</span>
              <strong>How our app should use this</strong>
            </div>
          </div>
          <p>{course.integration.syncStrategy}</p>
          <div className="moodle-source-path">
            <span>courseid</span>
            <ArrowRight size={14} />
            <span>sectionid</span>
            <ArrowRight size={14} />
            <span>cmid</span>
            <ArrowRight size={14} />
            <span>renderer</span>
          </div>
        </article>
      </div>
    </div>
  );
}

function MoodleSectionButton({
  section,
  active,
  role,
  onSelect,
}: {
  section: MoodleSection;
  active: boolean;
  role: Role;
  onSelect: () => void;
}) {
  const hidden = section.activities.filter(
    activity => activity.hiddenFromStudents
  ).length;
  return (
    <button className={active ? "active" : ""} onClick={onSelect}>
      <span>{String(section.moodleIndex).padStart(2, "0")}</span>
      <div>
        <strong>{section.title}</strong>
        <small>
          {section.id ? `sectionid ${section.id}` : "Moodle section"} ·{" "}
          {section.activities.length} item
          {section.activities.length === 1 ? "" : "s"}
          {hidden && role !== "student" ? ` · ${hidden} hidden` : ""}
        </small>
      </div>
    </button>
  );
}

function ListExperience({ config, role }: { config: PageConfig; role: Role }) {
  const [records, setRecords] = useState<RecordItem[]>(config.records);
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState(config.filters[0] ?? "All");
  const [sortKey, setSortKey] = useState<"title" | "status" | "owner" | "due">(
    "title"
  );
  const [page, setPage] = useState(1);
  const [selectedRecord, setSelectedRecord] = useState<RecordItem | null>(
    records[0] ?? null
  );
  const pageSize = 6;
  const filteredRecords = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const filter = activeFilter.toLowerCase();
    return records
      .filter(record => {
        const queryMatch =
          !normalized ||
          `${record.title} ${record.subtitle} ${record.status} ${record.owner} ${record.metric}`
            .toLowerCase()
            .includes(normalized);
        const filterMatch =
          filter === "all" ||
          record.status.toLowerCase().includes(filter) ||
          record.subtitle.toLowerCase().includes(filter);
        return queryMatch && filterMatch;
      })
      .sort((a, b) => a[sortKey].localeCompare(b[sortKey]));
  }, [activeFilter, query, records, sortKey]);
  const pageCount = Math.max(1, Math.ceil(filteredRecords.length / pageSize));
  const visibleRecords = filteredRecords.slice(
    (page - 1) * pageSize,
    page * pageSize
  );

  const addSavedRecord = (values: Record<string, string>, recordId: string) => {
    const record: RecordItem = {
      id: recordId,
      title:
        values.title ||
        values.fullName ||
        values.name ||
        `${config.title} record`,
      subtitle:
        values.notes || values.subject || `Saved from ${config.formTitle}`,
      status: values.status || "Saved",
      owner: values.owner || roleMeta[role].label,
      due: values.date || values.dueDate || "Now",
      metric: "Local",
      tone: "teal",
    };
    setRecords(prev => [record, ...prev]);
    setSelectedRecord(record);
    setPage(1);
  };

  return (
    <div className="platform-two-column">
      <div className="platform-stack">
        <RecordsToolbar
          config={config}
          query={query}
          setQuery={setQuery}
          activeFilter={activeFilter}
          setActiveFilter={filter => {
            setActiveFilter(filter);
            setPage(1);
          }}
          sortKey={sortKey}
          setSortKey={setSortKey}
          resultCount={filteredRecords.length}
          onReset={() => {
            setQuery("");
            setActiveFilter(config.filters[0] ?? "All");
            setSortKey("title");
            setPage(1);
          }}
        />
        <RecordsTable
          records={visibleRecords}
          selectedRecordId={selectedRecord?.id}
          onOpen={setSelectedRecord}
          page={page}
          pageCount={pageCount}
          totalRecords={filteredRecords.length}
          onPageChange={setPage}
        />
      </div>
      <div className="platform-stack">
        <QuickForm config={config} role={role} onSaved={addSavedRecord} />
        <RecordInspector
          record={selectedRecord}
          role={role}
          onClose={() => setSelectedRecord(null)}
        />
        <Panels config={config} />
      </div>
    </div>
  );
}

function FormAndPanels({ config, role }: { config: PageConfig; role: Role }) {
  return (
    <div className="platform-two-column">
      <QuickForm config={config} role={role} wide />
      <div className="platform-stack">
        <Panels config={config} />
        <Timeline records={config.timeline} />
      </div>
    </div>
  );
}

function RecordsToolbar({
  config,
  query: controlledQuery,
  setQuery: controlledSetQuery,
  activeFilter: controlledActiveFilter,
  setActiveFilter: controlledSetActiveFilter,
  sortKey: controlledSortKey,
  setSortKey: controlledSetSortKey,
  resultCount = config.records.length,
  onReset: controlledReset,
}: {
  config: PageConfig;
  query?: string;
  setQuery?: (value: string) => void;
  activeFilter?: string;
  setActiveFilter?: (value: string) => void;
  sortKey?: "title" | "status" | "owner" | "due";
  setSortKey?: (value: "title" | "status" | "owner" | "due") => void;
  resultCount?: number;
  onReset?: () => void;
}) {
  const [localQuery, setLocalQuery] = useState("");
  const [localActiveFilter, setLocalActiveFilter] = useState(
    config.filters[0] ?? "All"
  );
  const [localSortKey, setLocalSortKey] = useState<
    "title" | "status" | "owner" | "due"
  >("title");
  const query = controlledQuery ?? localQuery;
  const setQuery = controlledSetQuery ?? setLocalQuery;
  const activeFilter = controlledActiveFilter ?? localActiveFilter;
  const setActiveFilter = controlledSetActiveFilter ?? setLocalActiveFilter;
  const sortKey = controlledSortKey ?? localSortKey;
  const setSortKey = controlledSetSortKey ?? setLocalSortKey;
  const onReset =
    controlledReset ??
    (() => {
      setLocalQuery("");
      setLocalActiveFilter(config.filters[0] ?? "All");
      setLocalSortKey("title");
    });

  return (
    <div className="platform-toolbar">
      <div className="platform-toolbar-search">
        <Search size={15} />
        <input
          aria-label={`Search ${config.title.toLowerCase()}`}
          value={query}
          onChange={event => setQuery(event.target.value)}
          placeholder={`Search ${config.title.toLowerCase()}...`}
        />
      </div>
      <div className="platform-toolbar-filters">
        {config.filters.map(filter => (
          <button
            key={filter}
            className={activeFilter === filter ? "active" : ""}
            onClick={() => setActiveFilter(filter)}
          >
            {filter}
          </button>
        ))}
      </div>
      <select
        className="platform-toolbar-select"
        value={sortKey}
        onChange={event =>
          setSortKey(event.target.value as "title" | "status" | "owner" | "due")
        }
        aria-label="Sort records"
      >
        <option value="title">Sort by record</option>
        <option value="status">Sort by status</option>
        <option value="owner">Sort by owner</option>
        <option value="due">Sort by due</option>
      </select>
      <button className="platform-secondary-button compact" onClick={onReset}>
        <Filter size={14} />
        Reset
      </button>
      <span className="platform-result-count">
        {resultCount} result{resultCount === 1 ? "" : "s"}
      </span>
    </div>
  );
}

function RecordsTable({
  records,
  selectedRecordId,
  onOpen,
  page = 1,
  pageCount = 1,
  totalRecords = records.length,
  onPageChange,
}: {
  records: RecordItem[];
  selectedRecordId?: string;
  onOpen?: (record: RecordItem) => void;
  page?: number;
  pageCount?: number;
  totalRecords?: number;
  onPageChange?: (page: number) => void;
}) {
  const [fallbackSelectedId, setFallbackSelectedId] = useState<
    string | undefined
  >(selectedRecordId);
  const activeSelectedId = selectedRecordId ?? fallbackSelectedId;
  const openRecord = (record: RecordItem) => {
    setFallbackSelectedId(record.id);
    if (onOpen) onOpen(record);
    else toast.info(`Opened ${record.title}`);
  };
  const changePage = (nextPage: number) => {
    onPageChange?.(nextPage);
  };

  return (
    <div className="platform-table-card">
      <table>
        <thead>
          <tr>
            <th>Record</th>
            <th>Status</th>
            <th>Owner</th>
            <th>Due</th>
            <th>Metric</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {records.length ? (
            records.map(record => (
              <tr
                key={record.id}
                className={activeSelectedId === record.id ? "selected" : ""}
              >
                <td>
                  <strong>{record.title}</strong>
                  <small>{record.subtitle}</small>
                </td>
                <td>
                  <StatusBadge tone={record.tone ?? "teal"}>
                    {record.status}
                  </StatusBadge>
                </td>
                <td>{record.owner}</td>
                <td>{record.due}</td>
                <td>{record.metric}</td>
                <td>
                  <button
                    aria-label={`Open ${record.title}`}
                    onClick={() => openRecord(record)}
                  >
                    <ArrowRight size={15} />
                  </button>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={6}>
                <div className="platform-empty-state">
                  <Search size={18} />
                  <strong>No matching records</strong>
                  <small>Change the search text or reset filters.</small>
                </div>
              </td>
            </tr>
          )}
        </tbody>
      </table>
      <div className="platform-pagination">
        <span>
          {totalRecords} records · page {page} of {pageCount}
        </span>
        <div>
          <button
            disabled={page === 1}
            onClick={() => changePage(Math.max(1, page - 1))}
          >
            Prev
          </button>
          {Array.from({ length: pageCount })
            .slice(0, 5)
            .map((_, index) => {
              const nextPage = index + 1;
              return (
                <button
                  key={nextPage}
                  className={nextPage === page ? "active" : ""}
                  onClick={() => changePage(nextPage)}
                >
                  {nextPage}
                </button>
              );
            })}
          <button
            disabled={page === pageCount}
            onClick={() => changePage(Math.min(pageCount, page + 1))}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}

function QuickForm({
  config,
  role,
  wide = false,
  onSaved,
}: {
  config: PageConfig;
  role: Role;
  wide?: boolean;
  onSaved?: (values: Record<string, string>, recordId: string) => void;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const schema = useMemo(() => {
    return z.object(
      Object.fromEntries(
        config.formFields
          .filter(field => field.type !== "textarea")
          .map(field => [
            field.name,
            z.preprocess(
              value => (typeof value === "string" ? value : ""),
              z.string().min(1, `${field.label} is required`)
            ),
          ])
      )
    );
  }, [config.formFields]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const result = schema.safeParse(values);
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? "Check the form");
      return;
    }
    setError(null);
    setSaving(true);
    await new Promise(resolve => setTimeout(resolve, 450));
    const recordId = platformStore.saveOperationalRecord(
      config.title,
      values,
      getDemoUser(role).id
    );
    const backend = await saveBackendRecord(
      "operational",
      {
        module: config.title,
        formTitle: config.formTitle,
        localId: recordId,
        values,
      },
      getDemoUser(role).id
    );
    onSaved?.(values, recordId);
    setValues({});
    setLastSaved(recordId);
    setSaving(false);
    if (!backend.ok) {
      toast.warning("Saved locally; backend sync pending", {
        description: backend.error,
      });
      return;
    }
    toast.success(`${config.primaryAction} saved`, {
      description: `Activity record ${recordId} was added to system data.`,
    });
  };

  return (
    <form
      className={`platform-form-card ${wide ? "wide" : ""}`}
      onSubmit={submit}
      data-platform-create-form
    >
      <div className="platform-card-title">
        <div>
          <span>{config.eyebrow}</span>
          <strong>{config.formTitle}</strong>
        </div>
        <ShieldCheck size={17} style={{ color: roleMeta[role].color }} />
      </div>
      <div className="platform-form-grid">
        {config.formFields.map(field => (
          <label
            key={field.name}
            className={field.type === "textarea" ? "full" : ""}
          >
            <span>{field.label}</span>
            {field.type === "select" ? (
              <select
                value={values[field.name] ?? ""}
                onChange={event =>
                  setValues(prev => ({
                    ...prev,
                    [field.name]: event.target.value,
                  }))
                }
              >
                <option value="">Select...</option>
                {field.options?.map(option => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            ) : field.type === "textarea" ? (
              <textarea
                value={values[field.name] ?? ""}
                placeholder={field.placeholder}
                onChange={event =>
                  setValues(prev => ({
                    ...prev,
                    [field.name]: event.target.value,
                  }))
                }
              />
            ) : (
              <input
                type={field.type}
                value={values[field.name] ?? ""}
                placeholder={field.placeholder}
                onChange={event =>
                  setValues(prev => ({
                    ...prev,
                    [field.name]: event.target.value,
                  }))
                }
              />
            )}
          </label>
        ))}
      </div>
      {error ? <p className="platform-form-error">{error}</p> : null}
      {lastSaved ? (
        <p className="platform-form-success">Saved locally as {lastSaved}</p>
      ) : null}
      <div className="platform-form-actions">
        <button
          type="button"
          className="platform-secondary-button"
          onClick={() => {
            setValues({});
            setError(null);
          }}
        >
          Cancel
        </button>
        <button
          type="submit"
          className="platform-primary-button"
          style={{ background: roleMeta[role].color }}
          disabled={saving}
        >
          {saving ? "Saving..." : config.primaryAction}
        </button>
      </div>
    </form>
  );
}

function RecordInspector({
  record,
  role,
  onClose,
}: {
  record: RecordItem | null;
  role: Role;
  onClose: () => void;
}) {
  if (!record) {
    return (
      <article className="platform-inspector empty">
        <div className="platform-card-title">
          <div>
            <span>Selection</span>
            <strong>No record selected</strong>
          </div>
        </div>
        <p>
          Select a row to inspect status, owner, due date, metric, and audit
          action.
        </p>
      </article>
    );
  }

  return (
    <article className="platform-inspector">
      <div className="platform-card-title">
        <div>
          <span>Selected record</span>
          <strong>{record.title}</strong>
        </div>
        <button aria-label="Close record inspector" onClick={onClose}>
          <X size={15} />
        </button>
      </div>
      <p>{record.subtitle}</p>
      <dl>
        <div>
          <dt>Status</dt>
          <dd>
            <StatusBadge tone={record.tone ?? "teal"}>
              {record.status}
            </StatusBadge>
          </dd>
        </div>
        <div>
          <dt>Owner</dt>
          <dd>{record.owner}</dd>
        </div>
        <div>
          <dt>Due</dt>
          <dd>{record.due}</dd>
        </div>
        <div>
          <dt>Metric</dt>
          <dd>{record.metric}</dd>
        </div>
      </dl>
      <div className="platform-inspector-actions">
        <button
          onClick={() =>
            toast.success("Status copied to audit queue", {
              description: record.title,
            })
          }
        >
          Queue follow-up
        </button>
        <button
          style={{
            background: roleMeta[role].color,
            color: "white",
            borderColor: roleMeta[role].color,
          }}
          onClick={() => {
            const audit = platformStore.audit(
              "record.reviewed",
              record.title,
              record.id,
              `Reviewed ${record.title}.`,
              getDemoUser(role).id
            );
            toast.success("Review logged", { description: audit.id });
          }}
        >
          Log review
        </button>
      </div>
    </article>
  );
}

function Panels({ config }: { config: PageConfig }) {
  return (
    <>
      {config.panels.map(panel => (
        <article key={panel.title} className="platform-panel">
          <div className="platform-card-title">
            <div>
              <span>{panel.description}</span>
              <strong>{panel.title}</strong>
            </div>
          </div>
          <ul>
            {panel.items.map(item => (
              <li key={item}>
                <CheckCircle2 size={15} />
                {item}
              </li>
            ))}
          </ul>
        </article>
      ))}
    </>
  );
}

function Timeline({ records }: { records: RecordItem[] }) {
  return (
    <article className="platform-panel">
      <div className="platform-card-title">
        <div>
          <span>Audit-ready activity</span>
          <strong>Timeline</strong>
        </div>
      </div>
      <div className="platform-timeline">
        {records.map(record => (
          <div key={record.id}>
            <span style={{ background: toneColor[record.tone ?? "teal"] }} />
            <strong>{record.title}</strong>
            <small>
              {record.status} - {record.due}
            </small>
          </div>
        ))}
      </div>
    </article>
  );
}

function QuranExperience({ config, role }: { config: PageConfig; role: Role }) {
  const milestones = [
    { label: "Juz 1", progress: 100 },
    { label: "Juz 2", progress: 72 },
    { label: "Juz 3", progress: 48 },
    { label: "Ijazah milestone", progress: 36 },
  ];

  return (
    <div className="platform-two-column">
      <div className="platform-stack">
        <div className="platform-special-card">
          <div className="platform-card-title">
            <div>
              <span>Quran pathway</span>
              <strong>Memorization and revision</strong>
            </div>
            <Headphones size={18} style={{ color: roleMeta[role].color }} />
          </div>
          {milestones.map(item => (
            <div key={item.label} className="platform-progress-row">
              <div>
                <strong>{item.label}</strong>
                <span>{item.progress}%</span>
              </div>
              <div>
                <span
                  style={{
                    width: `${item.progress}%`,
                    background: roleMeta[role].color,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
        <RecordsTable records={config.records} />
      </div>
      <div className="platform-stack">
        <QuickForm config={config} role={role} />
        <Panels config={config} />
      </div>
    </div>
  );
}

function CalendarExperience({
  config,
  role,
}: {
  config: PageConfig;
  role: Role;
}) {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return (
    <div className="platform-two-column">
      <div className="platform-calendar-card">
        <div className="platform-card-title">
          <div>
            <span>Week view</span>
            <strong>{config.title}</strong>
          </div>
          <CalendarDays size={18} style={{ color: roleMeta[role].color }} />
        </div>
        <div className="platform-calendar-grid">
          {days.map((day, index) => (
            <div key={day}>
              <strong>{day}</strong>
              <article>
                <span>{index % 2 === 0 ? "09:00" : "13:30"}</span>
                <p>{config.records[index % config.records.length]?.title}</p>
              </article>
              <article className={index === 4 ? "warning" : ""}>
                <span>{index % 2 === 0 ? "16:00" : "18:00"}</span>
                <p>
                  {index === 4
                    ? "Conflict placeholder"
                    : "Office hour / review"}
                </p>
              </article>
            </div>
          ))}
        </div>
      </div>
      <div className="platform-stack">
        <QuickForm config={config} role={role} />
        <Panels config={config} />
      </div>
    </div>
  );
}

function AssessmentExperience({
  config,
  role,
}: {
  config: PageConfig;
  role: Role;
}) {
  return (
    <div className="platform-two-column">
      <div className="platform-stack">
        <div className="platform-assessment-grid">
          {[
            "Multiple choice",
            "True/false",
            "Short answer",
            "Essay",
            "Oral record",
            "File/audio",
          ].map((type, index) => (
            <article key={type}>
              <ListIcon index={index} color={roleMeta[role].color} />
              <strong>{type}</strong>
              <span>{index < 2 ? "Auto-grade ready" : "Manual review"}</span>
            </article>
          ))}
        </div>
        <RecordsToolbar config={config} />
        <RecordsTable records={config.records} />
      </div>
      <div className="platform-stack">
        <QuickForm config={config} role={role} />
        <Panels config={config} />
      </div>
    </div>
  );
}

function AttendanceExperience({
  config,
  role,
}: {
  config: PageConfig;
  role: Role;
}) {
  const statuses = ["present", "late", "absent", "excused"];
  return (
    <div className="platform-two-column">
      <div className="platform-special-card">
        <div className="platform-card-title">
          <div>
            <span>Fast grid</span>
            <strong>Mark attendance</strong>
          </div>
          <SlidersHorizontal
            size={18}
            style={{ color: roleMeta[role].color }}
          />
        </div>
        <div className="platform-attendance-grid">
          {config.records
            .concat(config.records)
            .slice(0, 6)
            .map((record, index) => (
              <article key={`${record.id}_${index}`}>
                <div>
                  <strong>{record.title}</strong>
                  <span>{record.subtitle}</span>
                </div>
                <div>
                  {statuses.map(status => (
                    <button
                      key={status}
                      className={
                        index % 4 === statuses.indexOf(status) ? "active" : ""
                      }
                    >
                      {status}
                    </button>
                  ))}
                </div>
              </article>
            ))}
        </div>
      </div>
      <div className="platform-stack">
        <QuickForm config={config} role={role} />
        <Panels config={config} />
      </div>
    </div>
  );
}

function CertificateExperience({
  config,
  role,
}: {
  config: PageConfig;
  role: Role;
}) {
  return (
    <div className="platform-two-column">
      <div className="platform-certificate-grid">
        {config.records.map(record => (
          <article key={record.id}>
            <AwardIcon color={roleMeta[role].color} />
            <StatusBadge tone={record.tone ?? "teal"}>
              {record.status}
            </StatusBadge>
            <h3>{record.title}</h3>
            <p>{record.subtitle}</p>
            <strong>{record.metric}</strong>
            <button
              onClick={() =>
                toast.success(`Certificate action: ${record.title}`)
              }
            >
              {record.status.includes("Pending")
                ? "Approve"
                : "Download placeholder"}
            </button>
          </article>
        ))}
      </div>
      <div className="platform-stack">
        <QuickForm config={config} role={role} />
        <Panels config={config} />
      </div>
    </div>
  );
}

function ReportExperience({
  config,
  role,
}: {
  config: PageConfig;
  role: Role;
}) {
  const bars = [72, 48, 88, 63, 91, 57];
  return (
    <div className="platform-two-column">
      <div className="platform-stack">
        <div className="platform-report-card">
          <div className="platform-card-title">
            <div>
              <span>Filtered analytics</span>
              <strong>{config.title}</strong>
            </div>
            <FileText size={18} style={{ color: roleMeta[role].color }} />
          </div>
          <div className="platform-bar-chart">
            {bars.map((value, index) => (
              <div key={index}>
                <span
                  style={{
                    height: `${value}%`,
                    background:
                      index % 2 ? roleMeta[role].accent : roleMeta[role].color,
                  }}
                />
                <small>W{index + 1}</small>
              </div>
            ))}
          </div>
        </div>
        <RecordsTable records={config.records} />
      </div>
      <div className="platform-stack">
        <Panels config={config} />
        <Timeline records={config.timeline} />
      </div>
    </div>
  );
}

function MessagesExperience({
  config,
  role,
}: {
  config: PageConfig;
  role: Role;
}) {
  return (
    <div className="platform-two-column">
      <div className="platform-message-card">
        <div className="platform-card-title">
          <div>
            <span>Communication center</span>
            <strong>Conversations</strong>
          </div>
          <MessageSquare size={18} style={{ color: roleMeta[role].color }} />
        </div>
        {config.records.map(record => (
          <button
            key={record.id}
            onClick={() => toast.info(`Opened ${record.title}`)}
          >
            <span
              style={{
                background: `${toneColor[record.tone ?? "teal"]}18`,
                color: toneColor[record.tone ?? "teal"],
              }}
            >
              {record.owner.slice(0, 2).toUpperCase()}
            </span>
            <div>
              <strong>{record.title}</strong>
              <small>{record.subtitle}</small>
            </div>
            <em>{record.status}</em>
          </button>
        ))}
      </div>
      <div className="platform-stack">
        <QuickForm config={config} role={role} />
        <Panels config={config} />
      </div>
    </div>
  );
}

function ListIcon({ index, color }: { index: number; color: string }) {
  const icons = [CheckCircle2, Filter, FileText, Send, Play, Download];
  const Icon = icons[index] ?? CheckCircle2;
  return (
    <span style={{ background: `${color}14`, color }}>
      <Icon size={18} />
    </span>
  );
}

function AwardIcon({ color }: { color: string }) {
  return (
    <span
      className="platform-award-icon"
      style={{ background: `${color}14`, color }}
    >
      <CheckCircle2 size={22} />
    </span>
  );
}

function decorateTitle(
  title: string,
  params: Record<string, string | undefined>
) {
  return Object.values(params).some(Boolean) ? title : title;
}
