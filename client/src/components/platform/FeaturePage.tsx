import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { motion } from "framer-motion";
import { z } from "zod";
import { Link } from "wouter";
import {
  ArrowRight,
  AlertTriangle,
  Bell,
  BookOpen,
  Building2,
  CalendarDays,
  CheckCircle2,
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
import { saveBackendRecord } from "@/lib/backend/api";
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
import { getMoodleSourceCourseSnapshot } from "@/lib/moodle/client";
import type { AttendanceStatus, CalendarEventType, EntityStatus, IntegrationConfig, IntegrationStatus, Lead } from "@/lib/domain/types";
import type { MoodleActivity, MoodleActivityType, MoodleSection } from "@/lib/moodle/types";
import PlatformShell from "./PlatformShell";
import StatefulWorkflowExperience, { isStatefulWorkflowPage } from "./WorkflowExperiences";

const toneColor: Record<Stat["tone"], string> = {
  teal: "#1A4A3A",
  amber: "#C4A35A",
  green: "#2D5016",
  red: "#C75B39",
  purple: "#3D1A5C",
  slate: "#1A1A1A",
};

const pageReveal = {
  hidden: { opacity: 0, y: 18 },
  visible: (delay = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.42, delay, ease: [0.23, 1, 0.32, 1] as const },
  }),
};

type FeaturePageProps = {
  role: Role;
  pageId: string;
  params?: Record<string, string | undefined>;
};

export default function FeaturePage({ role, pageId, params }: FeaturePageProps) {
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

  if (role === "headofdepartment" && academicGovernancePages.has(pageId)) {
    return (
      <PlatformShell role={role} title={config.title}>
        <AcademicGovernanceExperience pageId={pageId} />
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

  return (
    <PlatformShell role={role} title={config.title}>
      <motion.section className="platform-page-header" initial="hidden" animate="visible" custom={0} variants={pageReveal}>
        <div>
          <span className="platform-eyebrow">{config.eyebrow}</span>
          <h1>{params ? decorateTitle(config.title, params) : config.title}</h1>
          <p>{config.description}</p>
        </div>
        <div className="platform-header-actions">
          <button className="platform-secondary-button" onClick={() => toast.info(config.secondaryAction ?? "Opened")}>
            <Download size={15} />
            {config.secondaryAction}
          </button>
          <button className="platform-primary-button" style={{ background: roleMeta[role].color }} onClick={() => toast.success(`${config.primaryAction} started`)}>
            <Plus size={15} />
            {config.primaryAction}
          </button>
        </div>
      </motion.section>

      <MetricGrid stats={config.stats} />

      <motion.div initial="hidden" animate="visible" custom={0.14} variants={pageReveal}>
        <KindExperience config={config} role={role} pageId={pageId} params={params} />
      </motion.div>
    </PlatformShell>
  );
}

function MetricGrid({ stats }: { stats: Stat[] }) {
  return (
    <motion.div className="platform-metric-grid" initial="hidden" animate="visible">
      {stats.map((stat, index) => (
        <motion.article key={stat.label} className="platform-metric" custom={0.05 + index * 0.045} variants={pageReveal}>
          <div>
            <span>{stat.label}</span>
            <strong>{stat.value}</strong>
          </div>
          <small style={{ color: toneColor[stat.tone], background: `${toneColor[stat.tone]}14` }}>{stat.change}</small>
        </motion.article>
      ))}
    </motion.div>
  );
}

function KindExperience({ config, role, pageId, params }: { config: PageConfig; role: Role; pageId: string; params?: Record<string, string | undefined> }) {
  if (role === "student" && studentAccountPages.has(pageId)) return <StudentAccountExperience pageId={pageId} />;
  if (role === "superadmin" && adminAccessPages.has(pageId)) return <AdminAccessExperience pageId={pageId} params={params} />;
  if (role === "superadmin" && adminSystemPages.has(pageId)) return <AdminSystemExperience pageId={pageId} />;
  if (role === "superadmin" && adminAcademicPages.has(pageId)) return <SuperAdminAcademicExperience pageId={pageId} />;
  if (role === "headofdepartment" && academicGovernancePages.has(pageId)) return <AcademicGovernanceExperience pageId={pageId} />;
  if (role === "branchadmin" && branchOperationsPages.has(pageId)) return <BranchOperationsExperience pageId={pageId} />;
  if (role === "registrar" && registrarAdmissionsPages.has(pageId)) return <RegistrarAdmissionsExperience pageId={pageId} params={params} />;
  if (role === "teacher" && teacherDeliveryPages.has(pageId)) return <TeacherDeliveryExperience pageId={pageId} params={params} />;
  if (isStatefulWorkflowPage(role, pageId, config.kind)) {
    return <StatefulWorkflowExperience config={config} role={role} pageId={pageId} params={params} />;
  }
  if (config.kind === "moodle") return <MoodleSourceExperience config={config} role={role} />;
  if (config.kind === "quran") return <QuranExperience config={config} role={role} />;
  if (config.kind === "calendar") return <CalendarExperience config={config} role={role} />;
  if (config.kind === "assessment") return <AssessmentExperience config={config} role={role} />;
  if (config.kind === "attendance") return <AttendanceExperience config={config} role={role} />;
  if (config.kind === "certificate") return <CertificateExperience config={config} role={role} />;
  if (config.kind === "report") return <ReportExperience config={config} role={role} />;
  if (config.kind === "messages") return <MessagesExperience config={config} role={role} />;
  if (config.kind === "profile" || config.kind === "settings" || config.kind === "support" || config.kind === "form") {
    return <FormAndPanels config={config} role={role} />;
  }
  return <ListExperience config={config} role={role} />;
}

const studentAccountPages = new Set(["profile", "support"]);
const adminAccessPages = new Set(["users", "user-detail", "roles", "permissions", "branches"]);
const adminSystemPages = new Set(["settings", "integrations", "audit-logs", "system-health"]);
const adminAcademicPages = new Set(["departments", "programs", "courses"]);
const academicGovernancePages = new Set(["departments", "programs", "courses", "levels", "curriculum", "teachers", "classes", "assessments", "certificates", "reports", "messages"]);
const branchOperationsPages = new Set(["students", "teachers", "classes", "rooms", "schedule", "attendance", "payments", "reports", "messages", "settings"]);
const registrarAdmissionsPages = new Set(["leads", "lead-detail", "applications", "students", "student-detail", "placement-tests", "placement-detail", "enrollments", "classes", "schedule", "payments", "settings"]);
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
const allPermissions = Array.from(new Set(Object.values(rolePermissions).flat())) as Permission[];

function formatPermission(permission: Permission) {
  return permission
    .split(":")
    .map((part) => part.replace(/_/g, " "))
    .join(" / ");
}

function clonePlatformState() {
  return JSON.parse(JSON.stringify(platformStore.getState())) as ReturnType<typeof platformStore.getState>;
}

function StudentAccountExperience({ pageId }: { pageId: string }) {
  const [version, setVersion] = useState(0);
  const state = useMemo(() => platformStore.getState(), [version]);
  const refresh = () => setVersion((value) => value + 1);
  const student = state.students.find((item) => item.id === "stu_demo") ?? state.students[0];
  const user = state.users.find((item) => item.id === student?.userId) ?? getDemoUser("student");
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
  const enrollments = state.enrollments.filter((item) => item.studentId === student?.id);
  const tickets = state.supportTickets.filter((ticket) => ticket.requesterId === user.id);
  const notifications = state.notifications.filter((notification) => notification.userId === user.id);
  const documents = state.documents.filter((document) => document.ownerId === student?.id);
  const invoices = state.invoices.filter((invoice) => invoice.studentId === student?.id);
  const unreadCount = notifications.filter((notification) => !notification.read).length;
  const openTickets = tickets.filter((ticket) => ticket.status !== "completed" && ticket.status !== "cancelled").length;
  const focusCopy = pageId === "support" ? "Student support" : "Student profile";

  const saveProfile = (event: React.FormEvent) => {
    event.preventDefault();
    const next = clonePlatformState();
    next.users = next.users.map((item) =>
      item.id === user.id
        ? { ...item, name: profileDraft.name.trim() || item.name, email: profileDraft.email.trim() || item.email }
        : item,
    );
    next.students = next.students.map((item) =>
      item.id === student.id
        ? {
            ...item,
            country: profileDraft.country.trim() || item.country,
            preferredLanguage: profileDraft.preferredLanguage,
            timezone: profileDraft.timezone.trim() || item.timezone,
          }
        : item,
    );
    platformStore.setState(next);
    platformStore.audit("profile.updated", "StudentProfile", student.id, `Updated profile for ${profileDraft.name.trim() || user.name}.`, user.id);
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
    platformStore.audit("support.ticket_created", "SupportTicket", id, `Created support ticket: ${ticketDraft.subject.trim()}.`, user.id);
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
      <section className="student-account-hero">
        <div>
          <span className="platform-eyebrow">{focusCopy}</span>
          <h2>Keep learning details, support requests, notices, and documents connected to one student account.</h2>
          <p>Designed for repeated use by active learners: fast support, clear status, and no hunting across separate portals.</p>
        </div>
        <div className="student-account-nav" aria-label="Student account navigation">
          <Link href="/app/student/profile" className={pageId === "profile" ? "active" : ""} aria-current={pageId === "profile" ? "page" : undefined}>
            <UserCircle size={15} />
            Profile
          </Link>
          <Link href="/app/student/support" className={pageId === "support" ? "active" : ""} aria-current={pageId === "support" ? "page" : undefined}>
            <LifeBuoy size={15} />
            Support
          </Link>
        </div>
      </section>

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
                  <input value={profileDraft.name} onChange={(event) => setProfileDraft((value) => ({ ...value, name: event.target.value }))} />
                </label>
                <label>
                  Email
                  <input type="email" value={profileDraft.email} onChange={(event) => setProfileDraft((value) => ({ ...value, email: event.target.value }))} />
                </label>
                <label>
                  Country
                  <input value={profileDraft.country} onChange={(event) => setProfileDraft((value) => ({ ...value, country: event.target.value }))} />
                </label>
                <label>
                  Preferred language
                  <select value={profileDraft.preferredLanguage} onChange={(event) => setProfileDraft((value) => ({ ...value, preferredLanguage: event.target.value }))}>
                    <option>English</option>
                    <option>Arabic</option>
                    <option>Turkish</option>
                    <option>Russian</option>
                  </select>
                </label>
                <label>
                  Timezone
                  <input value={profileDraft.timezone} onChange={(event) => setProfileDraft((value) => ({ ...value, timezone: event.target.value }))} />
                </label>
                <button type="submit">
                  <ShieldCheck size={15} />
                  Save profile
                </button>
              </form>
              <div className="student-account-row-list">
                {enrollments.map((enrollment) => {
                  const run = state.courseRuns.find((item) => item.id === enrollment.courseRunId);
                  const course = state.courses.find((item) => item.id === run?.courseId);
                  return (
                    <article key={enrollment.id}>
                      <div>
                        <strong>{course?.title ?? enrollment.courseRunId}</strong>
                        <small>{enrollment.status} · progress {enrollment.progress}% · grade {enrollment.currentGrade}%</small>
                      </div>
                      <Link href={`/app/student/courses/${course?.id ?? run?.id ?? enrollment.courseRunId}`}>Open</Link>
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
                  <input value={ticketDraft.subject} onChange={(event) => setTicketDraft((value) => ({ ...value, subject: event.target.value }))} placeholder="What do you need help with?" />
                </label>
                <label>
                  Priority
                  <select value={ticketDraft.priority} onChange={(event) => setTicketDraft((value) => ({ ...value, priority: event.target.value as typeof ticketDraft.priority }))}>
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
                {tickets.map((ticket) => (
                  <article key={ticket.id}>
                    <div>
                      <strong>{ticket.subject}</strong>
                      <small>{ticket.priority} priority · {ticket.status} · {new Date(ticket.lastUpdatedAt).toLocaleString()}</small>
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
              {notifications.map((notification) => (
                <button key={notification.id} className={notification.read ? "read" : ""} onClick={() => markNotificationRead(notification.id)}>
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
              {documents.map((document) => (
                <article key={document.id}>
                  <div>
                    <strong>{document.title}</strong>
                    <small>{document.type} · {document.status}</small>
                  </div>
                  <span>{document.status}</span>
                </article>
              ))}
              {invoices.map((invoice) => (
                <article key={invoice.id}>
                  <div>
                    <strong>{invoice.id}</strong>
                    <small>{invoice.currency} {invoice.amount} · due {invoice.dueAt}</small>
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

function AdminAccessExperience({ pageId, params }: { pageId: string; params?: Record<string, string | undefined> }) {
  const [version, setVersion] = useState(0);
  const [query, setQuery] = useState("");
  const [selectedRole, setSelectedRole] = useState<Role>("teacher");
  const [selectedUserId, setSelectedUserId] = useState(params?.userId ?? "usr_teacher_demo");
  const [newUser, setNewUser] = useState({
    name: "",
    email: "",
    role: "teacher" as Role,
    branchId: "br_online",
    departmentId: "dep_arabic",
  });
  const state = useMemo(() => platformStore.getState(), [version]);
  const refresh = () => setVersion((value) => value + 1);
  const actorId = getDemoUser("superadmin").id;
  const selectedUser = state.users.find((user) => user.id === selectedUserId) ?? state.users[0];
  const activeBranch = state.branches.find((branch) => branch.id === selectedUser?.branchId);
  const activeDepartment = state.departments.find((department) => department.id === selectedUser?.departmentId);
  const visibleUsers = state.users.filter((user) => {
    const branch = state.branches.find((item) => item.id === user.branchId);
    const department = state.departments.find((item) => item.id === user.departmentId);
    const text = `${user.name} ${user.email} ${user.activeRole} ${branch?.name ?? ""} ${department?.name ?? ""}`.toLowerCase();
    return text.includes(query.toLowerCase());
  });
  const permissionCoverage = Math.round((state.permissions[selectedRole].length / allPermissions.length) * 100);
  const activeUsers = state.users.filter((user) => user.status === "active").length;
  const multiRoleUsers = state.users.filter((user) => user.roles.length > 1).length;
  const selectedRoleUsers = state.users.filter((user) => user.roles.includes(selectedRole)).length;
  const auditRows = state.auditLogs
    .filter((audit) => /user|role|permission|branch|record|rbac/i.test(`${audit.action} ${audit.entityType} ${audit.summary}`))
    .slice(0, 5);
  const focusLabel =
    pageId === "branches"
      ? "Branch scope"
      : pageId === "permissions"
        ? "Permission matrix"
        : pageId === "roles"
          ? "Role assignment"
      : "Identity directory";

  useEffect(() => {
    if (params?.userId && params.userId !== selectedUserId) {
      setSelectedUserId(params.userId);
    }
  }, [params?.userId, selectedUserId]);

  const audit = (action: string, entityType: string, entityId: string, summary: string) => {
    platformStore.audit(action, entityType, entityId, summary, actorId);
    refresh();
  };

  const updateUser = (userId: string, updater: (user: typeof state.users[number]) => typeof state.users[number], summary: string) => {
    const next = clonePlatformState();
    next.users = next.users.map((user) => (user.id === userId ? updater(user) : user));
    platformStore.setState(next);
    audit("user.updated", "User", userId, summary);
    toast.success("User access updated");
  };

  const setUserRole = (userId: string, role: Role) => {
    updateUser(userId, (user) => {
      const roles = user.roles.includes(role) ? user.roles : [...user.roles, role];
      return { ...user, roles, activeRole: role };
    }, `Assigned ${roleMeta[role].label} as active role.`);
    setSelectedRole(role);
  };

  const toggleUserRole = (userId: string, role: Role) => {
    updateUser(userId, (user) => {
      const hasRole = user.roles.includes(role);
      const roles = hasRole ? user.roles.filter((item) => item !== role) : [...user.roles, role];
      const safeRoles = roles.length ? roles : [user.activeRole];
      const activeRole = safeRoles.includes(user.activeRole) ? user.activeRole : safeRoles[0];
      return { ...user, roles: safeRoles, activeRole };
    }, `Changed ${roleMeta[role].label} access.`);
  };

  const updateUserScope = (field: "branchId" | "departmentId", value: string) => {
    if (!selectedUser) return;
    updateUser(selectedUser.id, (user) => ({ ...user, [field]: value }), `Updated ${field === "branchId" ? "branch" : "department"} scope.`);
  };

  const toggleUserStatus = () => {
    if (!selectedUser) return;
    const nextStatus: EntityStatus = selectedUser.status === "active" ? "paused" : "active";
    updateUser(selectedUser.id, (user) => ({ ...user, status: nextStatus }), `Set user status to ${nextStatus}.`);
  };

  const togglePermission = (role: Role, permission: Permission) => {
    const next = clonePlatformState();
    const current = next.permissions[role] ?? [];
    next.permissions[role] = current.includes(permission)
      ? current.filter((item) => item !== permission)
      : [...current, permission];
    platformStore.setState(next);
    audit("permission.updated", "Role", role, `${roleMeta[role].label}: ${formatPermission(permission)} ${current.includes(permission) ? "removed" : "granted"}.`);
    toast.success("Permission matrix updated");
  };

  const updateBranchStatus = (branchId: string, status: EntityStatus) => {
    const next = clonePlatformState();
    next.branches = next.branches.map((branch) => (branch.id === branchId ? { ...branch, status } : branch));
    platformStore.setState(next);
    audit("branch.updated", "Branch", branchId, `Set branch status to ${status}.`);
    toast.success("Branch status updated");
  };

  const addUser = (event: React.FormEvent) => {
    event.preventDefault();
    if (!newUser.name.trim() || !newUser.email.trim()) {
      toast.error("Name and email are required");
      return;
    }
    const next = clonePlatformState();
    const id = `usr_${newUser.role}_${Date.now().toString(36)}`;
    next.users = [
      {
        id,
        name: newUser.name.trim(),
        email: newUser.email.trim(),
        roles: [newUser.role],
        activeRole: newUser.role,
        branchId: newUser.branchId,
        departmentId: newUser.departmentId,
        status: "active",
      },
      ...next.users,
    ];
    platformStore.setState(next);
    setSelectedUserId(id);
    setNewUser({ name: "", email: "", role: "teacher", branchId: "br_online", departmentId: "dep_arabic" });
    audit("user.created", "User", id, `Created ${roleMeta[newUser.role].label} account for ${newUser.name.trim()}.`);
    toast.success("User created locally");
  };

  return (
    <div className="admin-access-workspace">
      <section className="admin-access-hero">
        <div>
          <span className="platform-eyebrow">{focusLabel}</span>
          <h2>Govern identity, roles, permissions, and branch scope from one controlled surface.</h2>
          <p>Modelled after the legacy EMS access patterns, but redesigned for faster assignment, clearer RBAC coverage, and auditable changes.</p>
        </div>
        <div className="admin-access-hero-actions">
          <button className={pageId === "users" || pageId === "user-detail" ? "active" : ""} onClick={() => setSelectedRole(selectedUser?.activeRole ?? "teacher")}>
            <Users size={15} />
            Users
          </button>
          <button className={pageId === "roles" ? "active" : ""} onClick={() => setSelectedRole("teacher")}>
            <ShieldCheck size={15} />
            Roles
          </button>
          <button className={pageId === "permissions" ? "active" : ""} onClick={() => setSelectedRole("superadmin")}>
            <KeyRound size={15} />
            Permissions
          </button>
          <button className={pageId === "branches" ? "active" : ""}>
            <Building2 size={15} />
            Branches
          </button>
        </div>
      </section>

      <div className="admin-access-kpis">
        <AdminAccessMetric label="Active users" value={`${activeUsers}/${state.users.length}`} />
        <AdminAccessMetric label="Selected role" value={roleMeta[selectedRole].label} />
        <AdminAccessMetric label="Role users" value={String(selectedRoleUsers)} />
        <AdminAccessMetric label="RBAC coverage" value={`${permissionCoverage}%`} />
        <AdminAccessMetric label="Multi-role" value={String(multiRoleUsers)} />
      </div>

      <div className="admin-access-layout">
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
            <input aria-label="Search users, roles, branches" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search users, roles, branches" />
          </div>
          <div className="admin-access-user-list">
            {visibleUsers.map((user) => {
              const branch = state.branches.find((item) => item.id === user.branchId);
              const department = state.departments.find((item) => item.id === user.departmentId);
              return (
                <button key={user.id} className={selectedUser?.id === user.id ? "active" : ""} onClick={() => {
                  setSelectedUserId(user.id);
                  setSelectedRole(user.activeRole);
                }}>
                  <span style={{ background: roleMeta[user.activeRole].tint, color: roleMeta[user.activeRole].color }}>{roleMeta[user.activeRole].shortLabel}</span>
                  <div>
                    <strong>{user.name}</strong>
                    <small>{branch?.name ?? "No branch"} · {department?.name ?? "No department"}</small>
                  </div>
                  <em>{user.status}</em>
                </button>
              );
            })}
          </div>
        </section>

        <section className="admin-access-panel selected-user">
          <div className="admin-access-panel-head">
            <div>
              <span>Selected account</span>
              <strong>{selectedUser?.name ?? "No user"}</strong>
            </div>
            <button onClick={toggleUserStatus}>{selectedUser?.status === "active" ? "Pause" : "Activate"}</button>
          </div>
          {selectedUser ? (
            <>
              <div className="admin-access-user-profile">
                <span style={{ background: roleMeta[selectedUser.activeRole].color }}>{roleMeta[selectedUser.activeRole].shortLabel}</span>
                <div>
                  <strong>{selectedUser.email}</strong>
                  <small>{activeBranch?.name ?? "No branch"} · {activeDepartment?.name ?? "No department"}</small>
                </div>
              </div>

              <div className="admin-access-field-grid">
                <label>
                  Active role
                  <select value={selectedUser.activeRole} onChange={(event) => setUserRole(selectedUser.id, event.target.value as Role)}>
                    {roleOrder.map((role) => <option key={role} value={role}>{roleMeta[role].label}</option>)}
                  </select>
                </label>
                <label>
                  Branch
                  <select value={selectedUser.branchId ?? ""} onChange={(event) => updateUserScope("branchId", event.target.value)}>
                    {state.branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
                  </select>
                </label>
                <label>
                  Department
                  <select value={selectedUser.departmentId ?? ""} onChange={(event) => updateUserScope("departmentId", event.target.value)}>
                    {state.departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
                  </select>
                </label>
              </div>

              <div className="admin-access-role-grid" aria-label={`${selectedUser.name} roles`}>
                {roleOrder.map((role) => (
                  <button key={role} className={selectedUser.roles.includes(role) ? "active" : ""} onClick={() => toggleUserRole(selectedUser.id, role)}>
                    <span style={{ background: roleMeta[role].tint, color: roleMeta[role].color }}>{roleMeta[role].shortLabel}</span>
                    <strong>{roleMeta[role].label}</strong>
                    {selectedUser.activeRole === role ? <em>active</em> : null}
                  </button>
                ))}
              </div>
            </>
          ) : null}
        </section>

        <section className="admin-access-panel create-user">
          <div className="admin-access-panel-head">
            <div>
              <span>Create account</span>
              <strong>Staff or learner</strong>
            </div>
            <CheckCircle2 size={18} />
          </div>
          <form className="admin-access-form" onSubmit={addUser}>
            <label>
              Full name
              <input value={newUser.name} onChange={(event) => setNewUser((value) => ({ ...value, name: event.target.value }))} placeholder="New staff member" />
            </label>
            <label>
              Email
              <input type="email" value={newUser.email} onChange={(event) => setNewUser((value) => ({ ...value, email: event.target.value }))} placeholder="name@nilecenter.org" />
            </label>
            <label>
              Role
              <select value={newUser.role} onChange={(event) => setNewUser((value) => ({ ...value, role: event.target.value as Role }))}>
                {roleOrder.map((role) => <option key={role} value={role}>{roleMeta[role].label}</option>)}
              </select>
            </label>
            <label>
              Branch
              <select value={newUser.branchId} onChange={(event) => setNewUser((value) => ({ ...value, branchId: event.target.value }))}>
                {state.branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
              </select>
            </label>
            <label>
              Department
              <select value={newUser.departmentId} onChange={(event) => setNewUser((value) => ({ ...value, departmentId: event.target.value }))}>
                {state.departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
              </select>
            </label>
            <button type="submit">
              <UserPlus size={15} />
              Create user
            </button>
          </form>
        </section>
      </div>

      <div className="admin-access-lower-grid">
        <section className="admin-access-panel permission-matrix">
          <div className="admin-access-panel-head">
            <div>
              <span>Permission matrix</span>
              <strong>{roleMeta[selectedRole].label}</strong>
            </div>
            <select value={selectedRole} onChange={(event) => setSelectedRole(event.target.value as Role)} aria-label="Permission role">
              {roleOrder.map((role) => <option key={role} value={role}>{roleMeta[role].label}</option>)}
            </select>
          </div>
          <div className="admin-permission-grid">
            {allPermissions.map((permission) => {
              const granted = state.permissions[selectedRole].includes(permission);
              return (
                <button key={permission} className={granted ? "granted" : ""} onClick={() => togglePermission(selectedRole, permission)}>
                  <span>{granted ? <CheckCircle2 size={14} /> : <X size={14} />}</span>
                  <strong>{formatPermission(permission)}</strong>
                </button>
              );
            })}
          </div>
        </section>

        <section className="admin-access-panel branch-scope">
          <div className="admin-access-panel-head">
            <div>
              <span>Branch scope</span>
              <strong>{state.branches.length} branches</strong>
            </div>
            <Building2 size={18} />
          </div>
          <div className="admin-branch-list">
            {state.branches.map((branch) => {
              const users = state.users.filter((user) => user.branchId === branch.id).length;
              const departments = state.departments.filter((department) => department.branchIds.includes(branch.id)).length;
              return (
                <article key={branch.id}>
                  <div>
                    <strong>{branch.name}</strong>
                    <small>{branch.code} · {branch.timezone} · {users} users · {departments} departments</small>
                  </div>
                  <select value={branch.status} onChange={(event) => updateBranchStatus(branch.id, event.target.value as EntityStatus)} aria-label={`${branch.name} status`}>
                    <option value="active">Active</option>
                    <option value="paused">Paused</option>
                    <option value="pending">Pending</option>
                  </select>
                </article>
              );
            })}
          </div>
        </section>

        <section className="admin-access-panel audit-feed">
          <div className="admin-access-panel-head">
            <div>
              <span>Audit trail</span>
              <strong>Recent access changes</strong>
            </div>
            <ShieldCheck size={18} />
          </div>
          <div className="admin-audit-list">
            {auditRows.map((auditRow) => (
              <article key={auditRow.id}>
                <strong>{auditRow.action}</strong>
                <small>{auditRow.summary}</small>
                <span>{new Date(auditRow.createdAt).toLocaleString()}</span>
              </article>
            ))}
          </div>
        </section>
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
  const [selectedIntegrationId, setSelectedIntegrationId] = useState<IntegrationConfig["id"]>("moodle");
  const [auditQuery, setAuditQuery] = useState("");
  const [auditFilter, setAuditFilter] = useState("All");
  const [settingsDraft, setSettingsDraft] = useState({
    organization: "Nile Center",
    defaultLanguage: "English",
    academicTerm: "Summer 2026",
    retentionDays: "365",
  });
  const [integrationCheck, setIntegrationCheck] = useState("");
  const state = useMemo(() => platformStore.getState(), [version]);
  const refresh = () => setVersion((value) => value + 1);
  const actorId = getDemoUser("superadmin").id;
  const integrations = state.integrations;
  const selectedIntegration = integrations.find((integration) => integration.id === selectedIntegrationId) ?? integrations[0];
  const connectedCount = integrations.filter((integration) => integration.status === "connected").length;
  const mockCount = integrations.filter((integration) => integration.status === "mock_mode").length;
  const serverOnlyCount = integrations.filter((integration) => integration.serverOnly).length;
  const auditActions = Array.from(new Set(state.auditLogs.map((audit) => audit.action.split(".")[0]))).slice(0, 6);
  const filteredAuditLogs = state.auditLogs.filter((audit) => {
    const text = `${audit.actorId} ${audit.action} ${audit.entityType} ${audit.entityId} ${audit.summary}`.toLowerCase();
    const matchesQuery = !auditQuery.trim() || text.includes(auditQuery.toLowerCase());
    const matchesFilter = auditFilter === "All" || audit.action.startsWith(auditFilter);
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
      detail: "Role routing, responsive platform shell, and local store are available.",
      status: "connected" as IntegrationStatus,
      metric: "Ready",
    },
    {
      id: "data",
      label: "Platform state",
      detail: `${platformEntityTotal} local entities across users, courses, classes, enrollments, events, and audit logs.`,
      status: "connected" as IntegrationStatus,
      metric: `${platformEntityTotal} records`,
    },
    {
      id: "supabase",
      label: "Supabase boundary",
      detail: "Browser uses publishable credentials only; privileged keys stay server-side.",
      status: integrations.find((integration) => integration.id === "supabase")?.status ?? "not_configured",
      metric: "Auth kept",
    },
    {
      id: "moodle",
      label: "Moodle source",
      detail: "Course mapping and activity inspection are available in mock/import mode.",
      status: integrations.find((integration) => integration.id === "moodle")?.status ?? "not_configured",
      metric: `${state.courses.length} courses`,
    },
    {
      id: "communications",
      label: "Communications",
      detail: "Email and WhatsApp remain log-first until delivery providers are connected server-side.",
      status: integrations.some((integration) => ["email", "whatsapp"].includes(integration.id) && integration.status === "connected") ? "connected" : "mock_mode",
      metric: `${state.communicationLogs.length} logs`,
    },
  ];
  const healthScore = Math.round((healthChecks.filter((check) => check.status === "connected" || check.status === "mock_mode").length / healthChecks.length) * 100);
  const focusCopy =
    pageId === "audit-logs"
      ? "Audit evidence"
      : pageId === "system-health"
        ? "System health"
        : pageId === "settings"
          ? "Platform settings"
          : "Integration control";

  const setIntegrationStatus = (integrationId: IntegrationConfig["id"], status: IntegrationStatus) => {
    const next = clonePlatformState();
    next.integrations = next.integrations.map((integration) =>
      integration.id === integrationId
        ? {
            ...integration,
            status,
            lastSyncAt: status === "connected" || status === "mock_mode" ? new Date().toISOString() : integration.lastSyncAt,
          }
        : integration,
    );
    platformStore.setState(next);
    platformStore.audit("integration.status_updated", "IntegrationConfig", integrationId, `${integrationId} set to ${status}.`, actorId);
    refresh();
    toast.success("Integration status updated", { description: `${integrationId} is now ${status.replace("_", " ")}.` });
  };

  const runHealthChecks = () => {
    platformStore.audit("system.health_checked", "PlatformSystem", "health", `System health check scored ${healthScore}%.`, actorId);
    refresh();
    toast.success("System health checked", { description: `${healthScore}% readiness based on local platform signals.` });
  };
  const runIntegrationLocalCheck = () => {
    const checkedAt = new Date().toLocaleString();
    setIntegrationCheck(`Checked at ${checkedAt}`);
    platformStore.audit("integration.local_checked", "IntegrationConfig", selectedIntegration.id, `${selectedIntegration.label} checked locally.`, actorId);
    refresh();
    toast.success("Local integration check logged", { description: selectedIntegration.label });
  };

  const exportAuditCsv = () => {
    const rows = filteredAuditLogs.map((audit) => ({
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
      toast.error("No audit rows to export");
      return;
    }
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `nile-audit-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    platformStore.audit("audit.exported", "AuditLog", "filtered", `Exported ${rows.length} audit row(s).`, actorId);
    refresh();
    toast.success("Audit CSV prepared", { description: `${rows.length} row(s) exported from the local audit log.` });
  };

  const saveSettings = (event: React.FormEvent) => {
    event.preventDefault();
    platformStore.audit(
      "settings.saved",
      "PlatformSettings",
      "global",
      `${settingsDraft.organization} · ${settingsDraft.defaultLanguage} · ${settingsDraft.academicTerm} · ${settingsDraft.retentionDays} day retention.`,
      actorId,
    );
    refresh();
    toast.success("Platform settings saved locally");
  };
  const updateAuditQuery = (event: React.ChangeEvent<HTMLInputElement> | React.FormEvent<HTMLInputElement>) => {
    setAuditQuery(event.currentTarget.value);
  };

  return (
    <div className="admin-system-workspace">
      <section className="admin-system-hero">
        <div>
          <span className="platform-eyebrow">{focusCopy}</span>
          <h2>Operate integrations, health, audit evidence, and platform settings from one governed workspace.</h2>
          <p>External connectors stay explicit: mock mode means visible local behavior, connected means the server-side boundary is expected to own credentials and sync.</p>
        </div>
        <div className="admin-system-nav" aria-label="Admin system navigation">
          {[
            { label: "Integrations", routeId: "integrations", Icon: Puzzle },
            { label: "Audit logs", routeId: "audit-logs", Icon: FileText },
            { label: "Health", routeId: "system-health", Icon: Server },
            { label: "Settings", routeId: "settings", Icon: SlidersHorizontal },
          ].map(({ label, routeId, Icon }) => (
            <Link key={String(routeId)} href={`/app/admin/${routeId}`} className={pageId === routeId ? "active" : ""} aria-current={pageId === routeId ? "page" : undefined}>
              <Icon size={15} />
              {label}
            </Link>
          ))}
        </div>
      </section>

      <div className="admin-system-kpis">
        <AdminAccessMetric label="Connectors" value={`${connectedCount}/${integrations.length}`} />
        <AdminAccessMetric label="Mock mode" value={String(mockCount)} />
        <AdminAccessMetric label="Server-only" value={String(serverOnlyCount)} />
        <AdminAccessMetric label="Health score" value={`${healthScore}%`} />
        <AdminAccessMetric label="Audit rows" value={String(state.auditLogs.length)} />
      </div>

      <div className="admin-system-layout">
        <section className="admin-system-panel wide">
          {pageId === "integrations" ? (
            <>
              <div className="admin-system-panel-head">
                <div>
                  <span>Connector registry</span>
                  <strong>{integrations.length} integration boundaries</strong>
                </div>
                <button onClick={() => setIntegrationStatus(selectedIntegration.id, "mock_mode")}>
                  <RefreshCcw size={15} />
                  Review selected
                </button>
              </div>
              <div className="admin-system-integration-grid">
                {integrations.map((integration) => (
                  <button key={integration.id} className={integration.id === selectedIntegration.id ? "active" : ""} onClick={() => setSelectedIntegrationId(integration.id)}>
                    <span className={`platform-integration-status ${integrationTone(integration.status)}`}>{integration.status.replace("_", " ")}</span>
                    <strong>{integration.label}</strong>
                    <small>{integration.serverOnly ? "Server-side connector" : "Browser-safe boundary"} · {integration.envVars.length || "No"} env vars</small>
                  </button>
                ))}
              </div>
              <div className="admin-system-detail">
                <div>
                  <span className="platform-eyebrow">Selected connector</span>
                  <h3>{selectedIntegration.label}</h3>
                  <p>{selectedIntegration.notes}</p>
                </div>
                <label>
                  Status
                  <select value={selectedIntegration.status} onChange={(event) => setIntegrationStatus(selectedIntegration.id, event.target.value as IntegrationStatus)}>
                    <option value="not_configured">Not configured</option>
                    <option value="mock_mode">Mock mode</option>
                    <option value="connected">Connected</option>
                    <option value="error">Error</option>
                  </select>
                </label>
                <div className="platform-env-list">
                  {selectedIntegration.envVars.length ? selectedIntegration.envVars.map((envVar) => <code key={envVar}>{envVar}</code>) : <code>No env vars required</code>}
                </div>
                <div className="platform-action-grid">
                  <button onClick={runIntegrationLocalCheck}>Run local check</button>
                  <button disabled={selectedIntegration.status !== "connected"}>Start sync</button>
                </div>
                {integrationCheck ? <small>{integrationCheck}</small> : null}
                <small>Last sync: {selectedIntegration.lastSyncAt ? new Date(selectedIntegration.lastSyncAt).toLocaleString() : "Not run"}</small>
              </div>
            </>
          ) : null}

          {pageId === "audit-logs" ? (
            <>
              <div className="admin-system-panel-head">
                <div>
                  <span>Audit explorer</span>
                  <strong>{filteredAuditLogs.length} matching events</strong>
                </div>
                <button onClick={exportAuditCsv}>
                  <Download size={15} />
                  Export CSV
                </button>
              </div>
              <div className="admin-system-filters">
                <label>
                  Search audit log
                  <input value={auditQuery} onInput={updateAuditQuery} onChange={updateAuditQuery} placeholder="Actor, action, entity, summary" />
                </label>
                <label>
                  Action group
                  <select value={auditFilter} onChange={(event) => setAuditFilter(event.target.value)}>
                    <option value="All">All</option>
                    {auditActions.map((action) => <option key={action} value={action}>{action}</option>)}
                  </select>
                </label>
              </div>
              <div className="admin-system-audit-list">
                {filteredAuditLogs.slice(0, 12).map((audit) => (
                  <article key={audit.id}>
                    <span>{audit.action}</span>
                    <div>
                      <strong>{audit.summary}</strong>
                      <small>{audit.entityType} · {audit.entityId}</small>
                    </div>
                    <em>{new Date(audit.createdAt).toLocaleString()}</em>
                  </article>
                ))}
                {!filteredAuditLogs.length ? (
                  <div className="platform-empty-state">
                    <Search size={18} />
                    <strong>No audit events match</strong>
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
                <button onClick={runHealthChecks}>
                  <RefreshCcw size={15} />
                  Run checks
                </button>
              </div>
              <div className="admin-system-health-grid">
                {healthChecks.map((check) => (
                  <article key={check.id}>
                    <span className={`platform-integration-status ${integrationTone(check.status)}`}>{check.status.replace("_", " ")}</span>
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
              <form className="admin-system-settings-form" onSubmit={saveSettings}>
                <label>
                  Organization
                  <input value={settingsDraft.organization} onChange={(event) => setSettingsDraft((value) => ({ ...value, organization: event.target.value }))} />
                </label>
                <label>
                  Default language
                  <select value={settingsDraft.defaultLanguage} onChange={(event) => setSettingsDraft((value) => ({ ...value, defaultLanguage: event.target.value }))}>
                    <option>English</option>
                    <option>Arabic</option>
                    <option>Turkish</option>
                    <option>Russian</option>
                  </select>
                </label>
                <label>
                  Academic term
                  <input value={settingsDraft.academicTerm} onChange={(event) => setSettingsDraft((value) => ({ ...value, academicTerm: event.target.value }))} />
                </label>
                <label>
                  Audit retention days
                  <input type="number" min="30" value={settingsDraft.retentionDays} onChange={(event) => setSettingsDraft((value) => ({ ...value, retentionDays: event.target.value }))} />
                </label>
                <div className="admin-system-policy-list">
                  {[
                    "Use server-only credentials for Moodle, EMS, payment, email, and WhatsApp.",
                    "Keep browser keys publishable and protected by policies.",
                    "Log operational changes before provider delivery is connected.",
                    "Review audit evidence before changing role or branch scope.",
                  ].map((policy) => (
                    <span key={policy}><CheckCircle2 size={15} /> {policy}</span>
                  ))}
                </div>
                <button type="submit">
                  <ShieldCheck size={15} />
                  Save settings
                </button>
              </form>
            </>
          ) : null}
        </section>

        <aside className="admin-system-side">
          <section className="admin-system-panel">
            <div className="admin-system-panel-head">
              <div>
                <span>Integration readiness</span>
                <strong>{connectedCount + mockCount}/{integrations.length} usable</strong>
              </div>
              <Server size={18} />
            </div>
            <div className="admin-system-readiness">
              {integrations.map((integration) => (
                <button key={integration.id} onClick={() => {
                  setSelectedIntegrationId(integration.id);
                  if (pageId !== "integrations") toast.info(`${integration.label}: ${integration.status.replace("_", " ")}`);
                }}>
                  <span className={`platform-integration-status ${integrationTone(integration.status)}`}>{integration.status.replace("_", " ")}</span>
                  <strong>{integration.label}</strong>
                </button>
              ))}
            </div>
          </section>

          <section className="admin-system-panel">
            <div className="admin-system-panel-head">
              <div>
                <span>Recent audit</span>
                <strong>Latest 5</strong>
              </div>
              <FileText size={18} />
            </div>
            <div className="admin-system-recent-audit">
              {state.auditLogs.slice(0, 5).map((audit) => (
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
  scope = "hod",
}: {
  pageId: string;
  scope?: "hod" | "admin";
}) {
  const [version, setVersion] = useState(0);
  const [query, setQuery] = useState("");
  const [selectedProgramId, setSelectedProgramId] = useState("prog_arabic");
  const [selectedCourseId, setSelectedCourseId] = useState("course_ar_l3");
  const [assessmentDraft, setAssessmentDraft] = useState({
    title: "Department oral assessment",
    type: "quiz" as "assignment" | "quiz",
  });
  const [messageDraft, setMessageDraft] = useState({
    recipientId: "usr_teacher_demo",
    subject: "Academic department update",
    body: "Please review the latest curriculum and assessment readiness notes.",
  });
  const [moduleDraft, setModuleDraft] = useState({
    title: "",
    outcomes: "",
  });
  const state = useMemo(() => platformStore.getState(), [version]);
  const refresh = () => setVersion((value) => value + 1);
  const actorRole = scope === "admin" ? "superadmin" : "headofdepartment";
  const actorId = getDemoUser(actorRole).id;
  const academicDepartments =
    scope === "admin"
      ? state.departments
      : state.departments.filter((department) => department.id === "dep_arabic" || department.ownerUserId === actorId);
  const departmentIds = academicDepartments.map((department) => department.id);
  const programs = state.programs.filter((program) => departmentIds.includes(program.departmentId));
  const scopedCourseIds = new Set(state.courses.filter((course) => programs.some((program) => program.id === course.programId)).map((course) => course.id));
  const scopedRuns = state.courseRuns.filter((run) => scopedCourseIds.has(run.courseId));
  const scopedRunIds = new Set(scopedRuns.map((run) => run.id));
  const scopedClasses = state.classGroups.filter((group) => scopedRunIds.has(group.courseRunId));
  const scopedAssignments = state.assignments.filter((assignment) => scopedRunIds.has(assignment.courseRunId));
  const scopedQuizzes = state.quizzes.filter((quiz) => scopedRunIds.has(quiz.courseRunId));
  const scopedCertificates = state.certificates.filter((certificate) => scopedCourseIds.has(certificate.courseId));
  const scopedTeacherUserIds = new Set(
    state.teachers
      .filter((teacher) => departmentIds.includes(teacher.departmentId))
      .map((teacher) => teacher.userId),
  );
  const scopedStudentIds = new Set(
    state.enrollments
      .filter((enrollment) => scopedRunIds.has(enrollment.courseRunId))
      .map((enrollment) => enrollment.studentId),
  );
  const scopedStudentUserIds = new Set(
    state.students
      .filter((student) => scopedStudentIds.has(student.id))
      .map((student) => student.userId),
  );
  const academicRecipientIds = new Set([
    actorId,
    ...Array.from(scopedTeacherUserIds),
    ...Array.from(scopedStudentUserIds),
  ]);
  const academicRecipients = state.users.filter((user) => user.id !== actorId && academicRecipientIds.has(user.id));
  const academicMessages = state.messages.filter((message) => academicRecipientIds.has(message.fromUserId) || academicRecipientIds.has(message.toUserId));
  const selectedProgram = programs.find((program) => program.id === selectedProgramId) ?? programs[0];
  const programCourses = state.courses.filter((course) => course.programId === selectedProgram?.id);
  const selectedCourse = programCourses.find((course) => course.id === selectedCourseId) ?? programCourses[0] ?? state.courses[0];
  const selectedLevel = state.levels.find((level) => level.id === selectedCourse?.levelId);
  const selectedModules = state.modules
    .filter((module) => module.courseId === selectedCourse?.id)
    .sort((a, b) => a.order - b.order);
  const selectedLessons = selectedModules.flatMap((module) => state.lessons.filter((lesson) => lesson.moduleId === module.id));
  const activeCourses = state.courses.filter((course) => course.status === "active").length;
  const classCapacity = state.classGroups.reduce((total, classGroup) => total + classGroup.capacity, 0);
  const enrolledSeats = state.classGroups.reduce((total, classGroup) => total + classGroup.studentIds.length, 0);
  const teacherCount = state.teachers.filter((teacher) => departmentIds.includes(teacher.departmentId)).length;
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
  const visiblePrograms = programs.filter((program) => {
    const department = state.departments.find((item) => item.id === program.departmentId);
    const text = `${program.title} ${program.category} ${program.language} ${department?.name ?? ""}`.toLowerCase();
    return text.includes(query.toLowerCase());
  });
  const auditRows = state.auditLogs
    .filter((audit) => /academic|course|program|module|level|curriculum|class/i.test(`${audit.action} ${audit.entityType} ${audit.summary}`))
    .slice(0, 5);
  const scopedReportRows = [
    ...programs.map((program) => ({ type: "Program", name: program.title, status: program.status, owner: academicDepartments.find((department) => department.id === program.departmentId)?.name ?? "Department" })),
    ...state.courses.filter((course) => scopedCourseIds.has(course.id)).map((course) => ({ type: "Course", name: course.title, status: course.status, owner: state.levels.find((level) => level.id === course.levelId)?.title ?? "Level" })),
    ...scopedClasses.map((classGroup) => ({ type: "Class", name: classGroup.name, status: `${classGroup.studentIds.length}/${classGroup.capacity}`, owner: classGroup.schedule })),
    ...scopedCertificates.map((certificate) => ({ type: "Certificate", name: certificate.verificationCode, status: certificate.status, owner: `${certificate.grade}% grade` })),
  ];

  const audit = (action: string, entityType: string, entityId: string, summary: string) => {
    platformStore.audit(action, entityType, entityId, summary, actorId);
    refresh();
  };

  const updateCourseStatus = (courseId: string, status: EntityStatus) => {
    const next = clonePlatformState();
    next.courses = next.courses.map((course) => (course.id === courseId ? { ...course, status } : course));
    platformStore.setState(next);
    audit("course.status_updated", "Course", courseId, `Set course status to ${status}.`);
    toast.success("Course status updated");
  };

  const addModule = (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedCourse || !moduleDraft.title.trim()) {
      toast.error("Module title is required");
      return;
    }
    const next = clonePlatformState();
    const courseModules = next.modules.filter((module) => module.courseId === selectedCourse.id);
    const id = `mod_${selectedCourse.id}_${Date.now().toString(36)}`;
    next.modules = [
      ...next.modules,
      {
        id,
        courseId: selectedCourse.id,
        title: moduleDraft.title.trim(),
        order: courseModules.length + 1,
        outcomes: moduleDraft.outcomes
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
      },
    ];
    platformStore.setState(next);
    setModuleDraft({ title: "", outcomes: "" });
    audit("curriculum.module_created", "Module", id, `Added module to ${selectedCourse.title}.`);
    toast.success("Module added");
  };

  const selectProgram = (programId: string) => {
    setSelectedProgramId(programId);
    const course = state.courses.find((item) => item.programId === programId);
    if (course) setSelectedCourseId(course.id);
  };

  const createAssessment = (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedCourse || !assessmentDraft.title.trim()) {
      toast.error("Assessment title is required");
      return;
    }
    const run = scopedRuns.find((item) => item.courseId === selectedCourse.id) ?? scopedRuns[0];
    if (!run) {
      toast.error("Create a course run before creating assessments");
      return;
    }
    if (assessmentDraft.type === "quiz") {
      platformStore.createQuiz(
        {
          courseRunId: run.id,
          title: assessmentDraft.title.trim(),
          durationMinutes: 30,
          attemptsAllowed: 1,
          questionTypes: ["multiple_choice", "short_answer", "oral_record"],
        },
        actorId,
      );
    } else {
      platformStore.createAssignment(
        {
          courseRunId: run.id,
          title: assessmentDraft.title.trim(),
          dueAt: "2026-07-05T18:00:00.000Z",
          submissionType: "text",
          rubric: ["Accuracy", "Fluency", "Teacher feedback"],
        },
        actorId,
      );
    }
    setAssessmentDraft({ title: "", type: "quiz" });
    refresh();
    toast.success("Assessment added to academic plan");
  };

  const sendAcademicMessage = (event: React.FormEvent) => {
    event.preventDefault();
    if (!messageDraft.recipientId || !messageDraft.subject.trim() || !messageDraft.body.trim()) {
      toast.error("Recipient, subject, and body are required");
      return;
    }
    platformStore.sendMessage({
      fromUserId: actorId,
      toUserId: messageDraft.recipientId,
      subject: messageDraft.subject.trim(),
      body: messageDraft.body.trim(),
    });
    setMessageDraft((value) => ({ ...value, subject: "", body: "" }));
    refresh();
    toast.success("Academic message sent");
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
    toast.success("Academic CSV exported", { description: `${scopedReportRows.length} row(s)` });
  };
  const academicNavItems = (scope === "admin"
    ? [
        ["Departments", "departments", Building2],
        ["Programs", "programs", BookOpen],
        ["Courses", "courses", Layers],
        ["Moodle Source", "moodle-source", Database],
      ]
    : [
        ["Departments", "departments", Building2],
        ["Programs", "programs", BookOpen],
        ["Courses", "courses", Layers],
        ["Curriculum", "curriculum", FileText],
        ["Teachers", "teachers", Users],
        ["Classes", "classes", CalendarDays],
        ["Assessments", "assessments", ClipboardList],
        ["Certificates", "certificates", ShieldCheck],
        ["Reports", "reports", Database],
        ["Messages", "messages", MessageSquare],
      ]) as Array<[string, string, typeof BookOpen]>;

  return (
    <div className="academic-governance-workspace">
      <section className="academic-governance-hero">
        <div>
          <span className="platform-eyebrow">{focusLabel}</span>
          <h2>Shape the academic catalog, curriculum readiness, and class delivery from one HOD workspace.</h2>
          <p>Programs, levels, courses, teachers, classes, outcomes, assessments, and Moodle-derived content stay connected instead of living as disconnected lists.</p>
        </div>
        <div className="academic-governance-actions">
          {academicNavItems.map(([label, routeId, Icon]) => (
            <Link
              key={String(routeId)}
              href={scope === "admin" ? `/app/admin/${routeId}` : `/app/hod/${routeId}`}
              className={pageId === routeId ? "active" : ""}
              aria-current={pageId === routeId ? "page" : undefined}
            >
              <Icon size={15} />
              {label as string}
            </Link>
          ))}
        </div>
      </section>

      <div className="academic-governance-kpis">
        <AdminAccessMetric label="Programs" value={String(programs.length)} />
        <AdminAccessMetric label="Active courses" value={`${activeCourses}/${state.courses.length}`} />
        <AdminAccessMetric label="Teachers" value={String(teacherCount)} />
        <AdminAccessMetric label="Seat usage" value={`${enrolledSeats}/${classCapacity}`} />
        <AdminAccessMetric label="Lessons" value={String(state.lessons.length)} />
      </div>

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
            <input aria-label="Search academic programs and departments" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search programs, departments" />
          </div>
          <div className="academic-program-list">
            {visiblePrograms.map((program) => {
              const department = state.departments.find((item) => item.id === program.departmentId);
              const courses = state.courses.filter((course) => course.programId === program.id);
              const levels = state.levels.filter((level) => level.programId === program.id);
              return (
                <button key={program.id} className={selectedProgram?.id === program.id ? "active" : ""} onClick={() => selectProgram(program.id)}>
                  <span>{program.category.slice(0, 2).toUpperCase()}</span>
                  <div>
                    <strong>{program.title}</strong>
                    <small>{department?.name ?? "No department"} · {courses.length} courses · {levels.length} levels</small>
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
            <select value={selectedCourse?.id ?? ""} onChange={(event) => setSelectedCourseId(event.target.value)} aria-label="Selected course">
              {programCourses.map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}
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
                <select value={selectedCourse.status} onChange={(event) => updateCourseStatus(selectedCourse.id, event.target.value as EntityStatus)}>
                  <option value="draft">Draft</option>
                  <option value="active">Active</option>
                  <option value="paused">Paused</option>
                  <option value="completed">Completed</option>
                </select>
              </label>
            </div>
          ) : null}

          <div className="academic-outcome-list">
            {(selectedCourse?.outcomes ?? []).map((outcome) => (
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
              <strong>{state.resources.filter((resource) => selectedLessons.some((lesson) => lesson.resourceIds.includes(resource.id))).length}</strong>
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
              .filter((teacher) => departmentIds.includes(teacher.departmentId))
              .map((teacher) => {
                const user = state.users.find((item) => item.id === teacher.userId);
                const classes = state.courseRuns.filter((run) => run.teacherId === teacher.userId).length;
                return (
                  <article key={teacher.id}>
                    <span>{user?.name.split(" ").map((part) => part[0]).join("").slice(0, 2) ?? "TC"}</span>
                    <div>
                      <strong>{user?.name ?? "Teacher"}</strong>
                      <small>{teacher.specialties.join(", ")} · {classes} active runs</small>
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
              .filter((level) => level.programId === selectedProgram?.id)
              .sort((a, b) => a.order - b.order)
              .map((level) => (
                <article key={level.id} className={selectedLevel?.id === level.id ? "active" : ""}>
                  <div>
                    <strong>{level.title}</strong>
                    <small>{level.prerequisites.join(" · ")}</small>
                  </div>
                  <div>
                    {level.completionRules.map((rule) => <span key={rule}>{rule}</span>)}
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
            {selectedModules.map((module) => {
              const lessons = state.lessons.filter((lesson) => lesson.moduleId === module.id);
              return (
                <article key={module.id}>
                  <div>
                    <strong>{module.order}. {module.title}</strong>
                    <small>{lessons.length} lessons · {module.outcomes.join(", ")}</small>
                  </div>
                  <em>{lessons.reduce((sum, lesson) => sum + lesson.durationMinutes, 0)} min</em>
                </article>
              );
            })}
          </div>
          <form className="academic-module-form" onSubmit={addModule}>
            <label>
              Module title
              <input value={moduleDraft.title} onChange={(event) => setModuleDraft((value) => ({ ...value, title: event.target.value }))} placeholder="New curriculum module" />
            </label>
            <label>
              Outcomes
              <input value={moduleDraft.outcomes} onChange={(event) => setModuleDraft((value) => ({ ...value, outcomes: event.target.value }))} placeholder="Outcome one, outcome two" />
            </label>
            <button type="submit">
              <Plus size={15} />
              Add module
            </button>
          </form>
        </section>

        <section className="academic-panel academic-class-panel">
          <div className="academic-panel-head">
            <div>
              <span>Class delivery</span>
              <strong>{state.classGroups.length} groups</strong>
            </div>
            <CalendarDays size={18} />
          </div>
          <div className="academic-class-list">
            {state.classGroups.map((classGroup) => {
              const run = state.courseRuns.find((item) => item.id === classGroup.courseRunId);
              const course = state.courses.find((item) => item.id === run?.courseId);
              const teacherUser = state.users.find((item) => item.id === run?.teacherId);
              return (
                <article key={classGroup.id}>
                  <div>
                    <strong>{classGroup.name}</strong>
                    <small>{course?.title ?? "No course"} · {teacherUser?.name ?? "No teacher"}</small>
                  </div>
                  <span>{classGroup.studentIds.length}/{classGroup.capacity}</span>
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
            {auditRows.length ? auditRows.map((auditRow) => (
              <article key={auditRow.id}>
                <strong>{auditRow.action}</strong>
                <small>{auditRow.summary}</small>
                <span>{new Date(auditRow.createdAt).toLocaleString()}</span>
              </article>
            )) : (
              <article>
                <strong>academic.ready</strong>
                <small>Academic workspace is connected to the local platform state.</small>
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
              <strong>{scopedAssignments.length + scopedQuizzes.length} items</strong>
            </div>
            <ClipboardList size={18} />
          </div>
          <div className="academic-module-list">
            {[...scopedAssignments, ...scopedQuizzes].slice(0, 5).map((item) => (
              <article key={item.id}>
                <div>
                  <strong>{item.title}</strong>
                  <small>{item.status} · {"dueAt" in item ? new Date(item.dueAt).toLocaleDateString() : `${item.durationMinutes} min quiz`}</small>
                </div>
                <em>{"submissionType" in item ? item.submissionType : `${item.attemptsAllowed} attempts`}</em>
              </article>
            ))}
          </div>
          <form className="academic-module-form" onSubmit={createAssessment}>
            <label>
              Assessment title
              <input value={assessmentDraft.title} onChange={(event) => setAssessmentDraft((value) => ({ ...value, title: event.target.value }))} placeholder="Department assessment title" />
            </label>
            <label>
              Type
              <select value={assessmentDraft.type} onChange={(event) => setAssessmentDraft((value) => ({ ...value, type: event.target.value as "assignment" | "quiz" }))}>
                <option value="quiz">Quiz</option>
                <option value="assignment">Assignment</option>
              </select>
            </label>
            <button type="submit">
              <Plus size={15} />
              Create assessment
            </button>
          </form>
        </section>

        <section className="academic-panel academic-certificate-panel">
          <div className="academic-panel-head">
            <div>
              <span>Certificate approvals</span>
              <strong>{scopedCertificates.filter((certificate) => certificate.status !== "issued").length} open</strong>
            </div>
            <ShieldCheck size={18} />
          </div>
          <div className="academic-class-list">
            {scopedCertificates.length ? scopedCertificates.map((certificate) => {
              const student = state.students.find((item) => item.id === certificate.studentId);
              const user = state.users.find((item) => item.id === student?.userId);
              const course = state.courses.find((item) => item.id === certificate.courseId);
              const approved = certificate.status === "approved" || certificate.status === "issued";
              const issued = certificate.status === "issued";
              return (
                <article key={certificate.id}>
                  <div>
                    <strong>{certificate.verificationCode}</strong>
                    <small>{user?.name ?? "Student"} · {course?.title ?? "Course"} · {certificate.grade}% grade</small>
                  </div>
                  <span>{certificate.status}</span>
                  <div className="platform-row-actions">
                    <button
                      disabled={approved}
                      onClick={() => {
                        platformStore.approveCertificate(certificate.id, actorId);
                        refresh();
                        toast.success("Certificate approved");
                      }}
                    >
                      {approved ? "Approved" : "Approve"}
                    </button>
                    <button
                      disabled={issued}
                      onClick={() => {
                        platformStore.issueCertificate(certificate.id, actorId);
                        refresh();
                        toast.success("Certificate issued");
                      }}
                    >
                      {issued ? "Issued" : "Issue"}
                    </button>
                  </div>
                </article>
              );
            }) : (
              <article>
                <div>
                  <strong>No certificates in scope</strong>
                  <small>Eligible learners appear here after grades and attendance are ready.</small>
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
          <button className="platform-secondary-button" onClick={exportAcademicCsv}>
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
          <form className="academic-module-form stacked" onSubmit={sendAcademicMessage}>
            <label>
              Recipient
              <select value={messageDraft.recipientId} onChange={(event) => setMessageDraft((value) => ({ ...value, recipientId: event.target.value }))}>
                {academicRecipients.map((user) => (
                  <option key={user.id} value={user.id}>{user.name} · {roleMeta[user.activeRole].label}</option>
                ))}
              </select>
            </label>
            <label>
              Subject
              <input value={messageDraft.subject} onChange={(event) => setMessageDraft((value) => ({ ...value, subject: event.target.value }))} placeholder="Department update" />
            </label>
            <label>
              Message
              <textarea value={messageDraft.body} onChange={(event) => setMessageDraft((value) => ({ ...value, body: event.target.value }))} placeholder="Write a concise department message" />
            </label>
            <button type="submit" disabled={!academicRecipients.length}>
              <Send size={15} />
              Send academic message
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
  const [roomDraft, setRoomDraft] = useState({ name: "", capacity: "18", equipment: "" });
  const [eventDraft, setEventDraft] = useState({
    title: "Branch review session",
    type: "live_session" as CalendarEventType,
    date: "2026-07-03",
    starts: "14:00",
    ends: "14:45",
    roomId: "",
    classGroupId: "",
  });
  const [messageDraft, setMessageDraft] = useState({
    recipientId: "usr_registrar_demo",
    subject: "Branch operations update",
    body: "Please review the branch schedule, attendance, and payment queue.",
  });
  const state = useMemo(() => platformStore.getState(), [version]);
  const refresh = () => setVersion((value) => value + 1);
  const actorId = getDemoUser("branchadmin").id;
  const actorUser = state.users.find((user) => user.id === actorId);
  const branch = state.branches.find((item) => item.id === selectedBranchId) ?? state.branches.find((item) => item.id === "br_cairo") ?? state.branches[0];
  const branchUsers = state.users.filter((user) => user.branchId === branch?.id);
  const branchStudents = state.students
    .map((student) => ({ student, user: state.users.find((user) => user.id === student.userId) }))
    .filter(({ user }) => user?.branchId === branch?.id);
  const branchTeachers = state.teachers
    .map((teacher) => ({ teacher, user: state.users.find((user) => user.id === teacher.userId) }))
    .filter(({ teacher, user }) => user?.branchId === branch?.id || state.teacherAvailability.some((slot) => slot.teacherId === teacher.userId && slot.branchId === branch?.id));
  const branchRuns = state.courseRuns.filter((run) => run.branchId === branch?.id);
  const branchRunIds = new Set(branchRuns.map((run) => run.id));
  const branchClasses = state.classGroups.filter((classGroup) => branchRuns.some((run) => run.id === classGroup.courseRunId));
  const branchRooms = state.rooms.filter((room) => room.branchId === branch?.id);
  const branchEvents = state.events.filter((event) => event.branchId === branch?.id || (event.classGroupId && branchClasses.some((classGroup) => classGroup.id === event.classGroupId)));
  const branchAttendance = state.attendance.filter((record) => branchClasses.some((classGroup) => classGroup.id === record.classGroupId));
  const branchStudentIds = new Set(branchStudents.map(({ student }) => student.id));
  const branchInvoices = state.invoices.filter((invoice) => branchStudentIds.has(invoice.studentId));
  const branchRecipientIds = new Set([actorId, ...branchUsers.map((user) => user.id), ...branchTeachers.map(({ teacher }) => teacher.userId)]);
  const branchRecipients = state.users.filter((user) => user.id !== actorId && branchRecipientIds.has(user.id));
  const branchMessages = state.messages.filter((message) => branchRecipientIds.has(message.fromUserId) || branchRecipientIds.has(message.toUserId));
  const roomCapacity = branchRooms.reduce((total, room) => total + room.capacity, 0);
  const assignedSeats = branchClasses.reduce((total, classGroup) => total + classGroup.studentIds.length, 0);
  const activeRooms = branchRooms.filter((room) => room.status === "active").length;
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
    .filter((audit) => /branch|room|class|attendance|schedule|payment|settings/i.test(`${audit.action} ${audit.entityType} ${audit.summary}`))
    .slice(0, 5);

  const audit = (action: string, entityType: string, entityId: string, summary: string) => {
    platformStore.audit(action, entityType, entityId, summary, actorId);
    refresh();
  };

  const updateRoomStatus = (roomId: string, status: EntityStatus) => {
    const next = clonePlatformState();
    next.rooms = next.rooms.map((room) => (room.id === roomId ? { ...room, status } : room));
    platformStore.setState(next);
    audit("room.status_updated", "Room", roomId, `Set room status to ${status}.`);
    toast.success("Room status updated");
  };

  const addRoom = (event: React.FormEvent) => {
    event.preventDefault();
    if (!branch || !roomDraft.name.trim()) {
      toast.error("Room name is required");
      return;
    }
    const next = clonePlatformState();
    const id = `room_${branch.code.toLowerCase()}_${Date.now().toString(36)}`;
    next.rooms = [
      {
        id,
        branchId: branch.id,
        name: roomDraft.name.trim(),
        capacity: Number(roomDraft.capacity) || 18,
        equipment: roomDraft.equipment
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
        status: "active",
      },
      ...next.rooms,
    ];
    platformStore.setState(next);
    setRoomDraft({ name: "", capacity: "18", equipment: "" });
    audit("room.created", "Room", id, `Added room ${roomDraft.name.trim()} to ${branch.name}.`);
    toast.success("Room added");
  };

  useEffect(() => {
    if (actorUser?.branchId && actorUser.branchId !== selectedBranchId) {
      setSelectedBranchId(actorUser.branchId);
    }
  }, [actorUser?.branchId, selectedBranchId]);

  useEffect(() => {
    setEventDraft((value) => ({
      ...value,
      roomId: value.roomId || branchRooms[0]?.id || "",
      classGroupId: value.classGroupId || branchClasses[0]?.id || "",
    }));
  }, [branchRooms[0]?.id, branchClasses[0]?.id]);

  const createBranchEvent = (event: React.FormEvent) => {
    event.preventDefault();
    if (!branch || !eventDraft.title.trim() || !eventDraft.date || !eventDraft.starts || !eventDraft.ends || eventDraft.starts >= eventDraft.ends) {
      toast.error("Valid title, date, and time range are required");
      return;
    }
    const result = platformStore.createCalendarEvent(
      {
        title: eventDraft.title.trim(),
        type: eventDraft.type,
        startsAt: `${eventDraft.date}T${eventDraft.starts}:00+03:00`,
        endsAt: `${eventDraft.date}T${eventDraft.ends}:00+03:00`,
        ownerId: actorId,
        branchId: branch.id,
        roomId: eventDraft.roomId || branchRooms[0]?.id,
        classGroupId: eventDraft.classGroupId || branchClasses[0]?.id || state.classGroups[0]?.id,
      },
      actorId,
    );
    refresh();
    toast.success(result.conflicts.length ? "Event saved with conflict" : "Event scheduled", {
      description: eventDraft.title.trim(),
    });
  };

  const recordBranchPayment = () => {
    const invoice = branchInvoices.find((item) => item.status !== "paid") ?? branchInvoices[0];
    if (!invoice) {
      toast.info("No branch invoice is ready for payment");
      return;
    }
    platformStore.recordPayment(invoice.id, actorId);
    refresh();
    toast.success("Branch payment recorded", { description: invoice.id });
  };

  const sendBranchMessage = (event: React.FormEvent) => {
    event.preventDefault();
    if (!messageDraft.recipientId || !messageDraft.subject.trim() || !messageDraft.body.trim()) {
      toast.error("Recipient, subject, and body are required");
      return;
    }
    platformStore.sendMessage({
      fromUserId: actorId,
      toUserId: messageDraft.recipientId,
      subject: messageDraft.subject.trim(),
      body: messageDraft.body.trim(),
    });
    setMessageDraft((value) => ({ ...value, subject: "", body: "" }));
    refresh();
    toast.success("Branch message sent");
  };

  const exportBranchCsv = () => {
    const rows = [
      ...branchClasses.map((classGroup) => ({ type: "Class", name: classGroup.name, status: `${classGroup.studentIds.length}/${classGroup.capacity}`, branch: branch?.name ?? "Branch" })),
      ...branchRooms.map((room) => ({ type: "Room", name: room.name, status: room.status, branch: branch?.name ?? "Branch" })),
      ...branchInvoices.map((invoice) => ({ type: "Invoice", name: invoice.id, status: invoice.status, branch: branch?.name ?? "Branch" })),
      ...branchAttendance.map((record) => ({ type: "Attendance", name: record.studentId, status: record.status, branch: branch?.name ?? "Branch" })),
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
    toast.success("Branch CSV exported", { description: `${rows.length} row(s)` });
  };

  return (
    <div className="branch-ops-workspace">
      <section className="branch-ops-hero">
        <div>
          <span className="platform-eyebrow">{focusLabel}</span>
          <h2>Run the branch from one operational surface: people, rooms, classes, and readiness.</h2>
          <p>Branch administration connects local staff, class groups, room capacity, payments, attendance, and schedule decisions without making operators hunt through disconnected pages.</p>
        </div>
        <div className="branch-ops-actions">
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
        </div>
      </section>

      <div className="branch-ops-kpis">
        <AdminAccessMetric label="Branch users" value={String(branchUsers.length)} />
        <AdminAccessMetric label="Students" value={String(branchStudents.length)} />
        <AdminAccessMetric label="Teachers" value={String(branchTeachers.length)} />
        <AdminAccessMetric label="Rooms active" value={`${activeRooms}/${branchRooms.length}`} />
        <AdminAccessMetric label="Seat usage" value={`${assignedSeats}/${roomCapacity || 0}`} />
      </div>

      <div className="branch-ops-layout">
        <section className="branch-panel branch-scope-panel">
          <div className="branch-panel-head">
            <div>
              <span>Branch scope</span>
              <strong>{branch?.name ?? "Branch"}</strong>
            </div>
            <select value={branch?.id ?? ""} onChange={(event) => setSelectedBranchId(event.target.value)} aria-label="Branch operations scope">
              {state.branches.filter((item) => item.id !== "br_global").map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </div>
          <div className="branch-scope-card">
            <span>{branch?.code ?? "BR"}</span>
            <div>
              <strong>{branch?.address ?? "Branch address"}</strong>
              <small>{branch?.timezone ?? "Africa/Cairo"} · {branch?.status ?? "active"}</small>
            </div>
          </div>
          <div className="branch-readiness-list">
            {[
              ["Rooms", branchRooms.length ? `${activeRooms} active rooms` : "Add rooms before scheduling"],
              ["Classes", branchClasses.length ? `${branchClasses.length} class groups` : "No class group assigned"],
              ["Course runs", branchRunIds.size ? `${branchRunIds.size} run(s)` : "No course run assigned"],
              ["Students", branchStudents.length ? `${branchStudents.length} local students` : "No local students yet"],
              ["Staff", branchTeachers.length ? `${branchTeachers.length} teacher(s)` : "No local teacher availability"],
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
            {branchUsers.length ? branchUsers.map((user) => (
              <article key={user.id}>
                <span>{roleMeta[user.activeRole].shortLabel.slice(0, 2).toUpperCase()}</span>
                <div>
                  <strong>{user.name}</strong>
                  <small>{roleMeta[user.activeRole].label} · {user.status}</small>
                </div>
              </article>
            )) : (
              <article>
                <span>BR</span>
                <div>
                  <strong>No assigned branch users</strong>
                  <small>Use Super Admin users to assign staff and students to this branch.</small>
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
            {branchClasses.length ? branchClasses.map((classGroup) => {
              const run = state.courseRuns.find((item) => item.id === classGroup.courseRunId);
              const course = state.courses.find((item) => item.id === run?.courseId);
              const teacher = state.users.find((item) => item.id === run?.teacherId);
              const room = state.rooms.find((item) => item.id === classGroup.roomId);
              return (
                <article key={classGroup.id}>
                  <div>
                    <strong>{classGroup.name}</strong>
                    <small>{course?.title ?? "No course"} · {teacher?.name ?? "No teacher"} · {room?.name ?? "No room"}</small>
                  </div>
                  <span>{classGroup.studentIds.length}/{classGroup.capacity}</span>
                  <em>{classGroup.schedule}</em>
                </article>
              );
            }) : (
              <article>
                <div>
                  <strong>No active classes in this branch</strong>
                  <small>Create a course run and room booking before publishing the schedule.</small>
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
            {branchRooms.map((room) => (
              <article key={room.id}>
                <div>
                  <strong>{room.name}</strong>
                  <small>{room.capacity} seats · {room.equipment.join(", ") || "No equipment listed"}</small>
                </div>
                <select value={room.status} onChange={(event) => updateRoomStatus(room.id, event.target.value as EntityStatus)} aria-label={`${room.name} status`}>
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
              <input value={roomDraft.name} onChange={(event) => setRoomDraft((value) => ({ ...value, name: event.target.value }))} placeholder="Room name" />
            </label>
            <label>
              Capacity
              <input type="number" value={roomDraft.capacity} onChange={(event) => setRoomDraft((value) => ({ ...value, capacity: event.target.value }))} placeholder="18" />
            </label>
            <label>
              Equipment
              <input value={roomDraft.equipment} onChange={(event) => setRoomDraft((value) => ({ ...value, equipment: event.target.value }))} placeholder="Projector, whiteboard" />
            </label>
            <button type="submit">
              <Plus size={15} />
              Add room
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
              ["Room capacity", roomCapacity ? `${roomCapacity} seats configured` : "Needs room setup"],
              ["Meeting links", branchClasses.some((classGroup) => classGroup.meetingLinkId) ? "Live links available" : "No live links"],
              ["Attendance", branchAttendance.length ? "Attendance history present" : "No attendance records"],
              ["Payments", branchInvoices.length ? "Invoices visible" : "No invoices"],
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
            {auditRows.length ? auditRows.map((auditRow) => (
              <article key={auditRow.id}>
                <strong>{auditRow.action}</strong>
                <small>{auditRow.summary}</small>
                <span>{new Date(auditRow.createdAt).toLocaleString()}</span>
              </article>
            )) : (
              <article>
                <strong>branch.ready</strong>
                <small>Branch workspace is connected to local platform state.</small>
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
              <strong>{branchEvents.length} branch events</strong>
            </div>
            <CalendarDays size={18} />
          </div>
          <form className="branch-room-form stacked" onSubmit={createBranchEvent}>
            <label>
              Title
              <input value={eventDraft.title} onChange={(event) => setEventDraft((value) => ({ ...value, title: event.target.value }))} placeholder="Branch session title" />
            </label>
            <label>
              Type
              <select value={eventDraft.type} onChange={(event) => setEventDraft((value) => ({ ...value, type: event.target.value as CalendarEventType }))}>
                <option value="live_session">Live session</option>
                <option value="placement_test">Placement test</option>
                <option value="room_booking">Room booking</option>
                <option value="exam">Exam</option>
              </select>
            </label>
            <label>
              Date
              <input type="date" value={eventDraft.date} onChange={(event) => setEventDraft((value) => ({ ...value, date: event.target.value }))} />
            </label>
            <label>
              Starts
              <input type="time" value={eventDraft.starts} onChange={(event) => setEventDraft((value) => ({ ...value, starts: event.target.value }))} />
            </label>
            <label>
              Ends
              <input type="time" value={eventDraft.ends} onChange={(event) => setEventDraft((value) => ({ ...value, ends: event.target.value }))} />
            </label>
            <label>
              Room
              <select value={eventDraft.roomId} onChange={(event) => setEventDraft((value) => ({ ...value, roomId: event.target.value }))}>
                {branchRooms.length ? branchRooms.map((room) => <option key={room.id} value={room.id}>{room.name}</option>) : <option value="">No room</option>}
              </select>
            </label>
            <label>
              Class
              <select value={eventDraft.classGroupId} onChange={(event) => setEventDraft((value) => ({ ...value, classGroupId: event.target.value }))}>
                {branchClasses.length ? branchClasses.map((classGroup) => <option key={classGroup.id} value={classGroup.id}>{classGroup.name}</option>) : <option value="">General branch event</option>}
              </select>
            </label>
            <button type="submit">
              <Plus size={15} />
              Create event
            </button>
          </form>
        </section>

        <section className="branch-panel branch-attendance-panel">
          <div className="branch-panel-head">
            <div>
              <span>Attendance watch</span>
              <strong>{branchAttendance.length} records</strong>
            </div>
            <ClipboardList size={18} />
          </div>
          <div className="branch-settings-list">
            {(["present", "late", "absent", "excused"] as AttendanceStatus[]).map((status) => (
              <article key={status}>
                <CheckCircle2 size={15} />
                <div>
                  <strong>{status}</strong>
                  <small>{branchAttendance.filter((record) => record.status === status).length} learner record(s)</small>
                </div>
              </article>
            ))}
          </div>
          <div className="branch-class-list compact">
            {branchClasses.slice(0, 3).map((classGroup) => (
              <article key={classGroup.id}>
                <div>
                  <strong>{classGroup.name}</strong>
                  <small>{classGroup.studentIds.length} enrolled · {state.classSessions.filter((session) => session.classGroupId === classGroup.id && session.attendanceSaved).length} saved sessions</small>
                </div>
                <span>{classGroup.schedule}</span>
              </article>
            ))}
          </div>
        </section>

        <section className="branch-panel branch-payment-panel">
          <div className="branch-panel-head">
            <div>
              <span>Payment queue</span>
              <strong>{branchInvoices.filter((invoice) => invoice.status !== "paid").length} open</strong>
            </div>
            <CreditCard size={18} />
          </div>
          <div className="branch-class-list compact">
            {branchInvoices.length ? branchInvoices.map((invoice) => (
              <article key={invoice.id}>
                <div>
                  <strong>{invoice.id}</strong>
                  <small>{invoice.currency} {invoice.amount} · due {new Date(invoice.dueAt).toLocaleDateString()}</small>
                </div>
                <span>{invoice.status}</span>
              </article>
            )) : (
              <article>
                <div>
                  <strong>No branch invoices</strong>
                  <small>Invoices appear when a local learner has a payment package.</small>
                </div>
                <span>0</span>
              </article>
            )}
          </div>
          <button className="platform-secondary-button" onClick={recordBranchPayment}>
            <CreditCard size={15} />
            Record payment
          </button>
        </section>

        <section className="branch-panel branch-report-panel">
          <div className="branch-panel-head">
            <div>
              <span>Branch reports</span>
              <strong>{branchClasses.length + branchRooms.length + branchInvoices.length + branchAttendance.length} rows</strong>
            </div>
            <Database size={18} />
          </div>
          <div className="platform-report-table compact">
            {[
              ["Classes", `${branchClasses.length} active groups`, `${assignedSeats}/${roomCapacity || 0} seat usage`],
              ["Rooms", `${activeRooms}/${branchRooms.length} active`, branch?.name ?? "Branch"],
              ["Payments", `${branchInvoices.filter((invoice) => invoice.status !== "paid").length} open invoices`, `${branchInvoices.length} total`],
              ["Attendance", `${branchAttendance.length} records`, `${branchAttendance.filter((record) => record.status === "present").length} present`],
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
          <button className="platform-secondary-button" onClick={exportBranchCsv}>
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
          <form className="branch-room-form stacked" onSubmit={sendBranchMessage}>
            <label>
              Recipient
              <select value={messageDraft.recipientId} onChange={(event) => setMessageDraft((value) => ({ ...value, recipientId: event.target.value }))}>
                {branchRecipients.length ? branchRecipients.map((user) => (
                  <option key={user.id} value={user.id}>{user.name} · {roleMeta[user.activeRole].label}</option>
                )) : <option value="">No branch recipient</option>}
              </select>
            </label>
            <label>
              Subject
              <input value={messageDraft.subject} onChange={(event) => setMessageDraft((value) => ({ ...value, subject: event.target.value }))} placeholder="Branch update" />
            </label>
            <label>
              Message
              <textarea value={messageDraft.body} onChange={(event) => setMessageDraft((value) => ({ ...value, body: event.target.value }))} placeholder="Write a branch message" />
            </label>
            <button type="submit" disabled={!branchRecipients.length}>
              <Send size={15} />
              Send branch message
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}

function RegistrarAdmissionsExperience({ pageId, params }: { pageId: string; params?: Record<string, string | undefined> }) {
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
  const [selectedPlacementId, setSelectedPlacementId] = useState(params?.bookingId ?? "");
  const [recommendedLevel, setRecommendedLevel] = useState("Arabic Level 2");
  const [score, setScore] = useState(78);
  const state = useMemo(() => platformStore.getState(), [version]);
  const refresh = () => setVersion((value) => value + 1);
  const actorId = getDemoUser("registrar").id;
  const activePage =
    pageId.includes("lead")
      ? "leads"
      : pageId.includes("placement")
        ? "placement-tests"
        : pageId.includes("student")
          ? "students"
          : pageId;
  const selectedPlacement =
    state.placementTests.find((booking) => booking.id === params?.bookingId) ??
    state.placementTests.find((booking) => booking.id === selectedPlacementId) ??
    state.placementTests.find((booking) => booking.status !== "completed") ??
    state.placementTests[0];
  const selectedLead =
    state.leads.find((lead) => lead.id === params?.leadId) ??
    state.leads[0];
  const selectedStudent =
    state.students.find((student) => student.id === params?.studentId) ??
    state.students[0];
  const selectedStudentUser = state.users.find((user) => user.id === selectedStudent?.userId);
  const selectedStudentEnrollments = state.enrollments.filter((enrollment) => enrollment.studentId === selectedStudent?.id);
  const selectedLeadApplication = state.applications.find((application) => application.leadId === selectedLead?.id);
  const readyWorkflows = state.enrollmentWorkflows.filter((workflow) => workflow.status === "ready_to_enroll");
  const pendingPlacements = state.placementTests.filter((booking) => booking.status !== "completed");
  const paymentBalance = state.invoices.reduce((total, invoice) => {
    const paid = state.payments
      .filter((payment) => payment.invoiceId === invoice.id && payment.status === "paid")
      .reduce((sum, payment) => sum + payment.amount, 0);
    return total + Math.max(0, invoice.amount - paid);
  }, 0);
  const registrarAuditRows = state.auditLogs
    .filter((audit) => /lead|application|placement|enrollment|payment|invoice|student/i.test(`${audit.action} ${audit.entityType} ${audit.summary}`))
    .slice(0, 6);
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

  const createLead = (event: React.FormEvent) => {
    event.preventDefault();
    if (!leadDraft.fullName.trim() || !leadDraft.phone.trim()) {
      toast.error("Name and phone are required");
      return;
    }
    platformStore.createLead({
      fullName: leadDraft.fullName.trim(),
      email: leadDraft.email.trim() || `${Date.now().toString(36)}@nilelearn.local`,
      phone: leadDraft.phone.trim(),
      country: leadDraft.country.trim() || "Egypt",
      subject: leadDraft.subject.trim() || "Arabic Language",
      source: leadDraft.source,
      notes: leadDraft.notes.trim(),
    });
    setLeadDraft({ fullName: "", email: "", phone: "", country: "", subject: "Arabic Language", source: "manual", notes: "" });
    refresh();
    toast.success("Lead added to admissions");
  };

  const convertLead = (leadId: string) => {
    platformStore.convertLeadToApplication(leadId, actorId);
    refresh();
    toast.success("Lead converted to application");
  };

  const recordPlacement = () => {
    if (!selectedPlacement) {
      toast.error("No placement booking selected");
      return;
    }
    platformStore.recordPlacementResult(
      selectedPlacement.id,
      recommendedLevel.trim() || "Arabic Level 2",
      Math.max(0, Math.min(100, Number(score) || 0)),
      "Recorded from registrar admissions workspace.",
      actorId,
    );
    refresh();
    toast.success("Placement result recorded");
  };

  const recordInvoicePayment = (invoiceId: string) => {
    platformStore.recordPayment(invoiceId, actorId);
    refresh();
    toast.success("Payment recorded");
  };

  return (
    <div className="registrar-workspace">
      <section className="registrar-hero">
        <div>
          <span className="platform-eyebrow">{focusLabel}</span>
          <h2>Manage the admissions journey from first contact to placement, payment, and class handoff.</h2>
          <p>Registrar work needs one calm surface for leads, applications, placement results, enrollment readiness, invoices, and communication follow-up.</p>
        </div>
        <div className="registrar-actions">
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
        </div>
      </section>

      <div className="registrar-kpis">
        <AdminAccessMetric label="Leads" value={String(state.leads.length)} />
        <AdminAccessMetric label="Applications" value={String(state.applications.length)} />
        <AdminAccessMetric label="Pending placement" value={String(pendingPlacements.length)} />
        <AdminAccessMetric label="Ready to enroll" value={String(readyWorkflows.length)} />
        <AdminAccessMetric label="Balance" value={`EGP ${paymentBalance}`} />
      </div>

      {["lead-detail", "student-detail", "placement-detail"].includes(pageId) ? (
        <section className="registrar-panel registrar-detail-focus">
          <div className="registrar-panel-head">
            <div>
              <span>Selected record</span>
              <strong>
                {pageId === "student-detail"
                  ? selectedStudentUser?.name ?? "Student record"
                  : pageId === "placement-detail"
                    ? selectedPlacement?.fullName ?? "Placement booking"
                    : selectedLead?.fullName ?? "Lead record"}
              </strong>
            </div>
            <UserCircle size={18} />
          </div>
          <div className="registrar-detail-grid">
            {pageId === "lead-detail" ? (
              <>
                <article>
                  <span>Lead status</span>
                  <strong>{selectedLead?.status ?? "No lead"}</strong>
                  <small>{selectedLead?.subject ?? "Subject"} · {selectedLead?.source ?? "source"}</small>
                </article>
                <article>
                  <span>Contact</span>
                  <strong>{selectedLead?.phone ?? "No phone"}</strong>
                  <small>{selectedLead?.email ?? "No email"}</small>
                </article>
                <article>
                  <span>Application</span>
                  <strong>{selectedLeadApplication ? "Converted" : "Not converted"}</strong>
                  <small>{selectedLeadApplication?.courseInterest ?? selectedLead?.notes ?? "Ready for follow-up"}</small>
                </article>
                <button disabled={!selectedLead || Boolean(selectedLeadApplication)} onClick={() => selectedLead && convertLead(selectedLead.id)}>
                  <UserPlus size={15} />
                  {selectedLeadApplication ? "Application exists" : "Convert lead"}
                </button>
              </>
            ) : pageId === "placement-detail" ? (
              <>
                <article>
                  <span>Booking</span>
                  <strong>{selectedPlacement?.subject ?? "Placement"}</strong>
                  <small>{selectedPlacement?.preferredDate ?? "No date"} · {selectedPlacement?.currentLevel ?? "No level"}</small>
                </article>
                <article>
                  <span>Status</span>
                  <strong>{selectedPlacement?.status ?? "No booking"}</strong>
                  <small>{selectedPlacement?.recommendedLevel ?? "Result not recorded"}</small>
                </article>
                <article>
                  <span>Contact</span>
                  <strong>{selectedPlacement?.phone ?? "No phone"}</strong>
                  <small>{selectedPlacement?.email ?? "No email"}</small>
                </article>
                <button disabled={!selectedPlacement || selectedPlacement.status === "completed"} onClick={recordPlacement}>
                  <CheckCircle2 size={15} />
                  {selectedPlacement?.status === "completed" ? "Result recorded" : "Record placement result"}
                </button>
              </>
            ) : (
              <>
                <article>
                  <span>Student</span>
                  <strong>{selectedStudentUser?.email ?? "No account"}</strong>
                  <small>{selectedStudent?.preferredLanguage ?? "Language"} · {selectedStudent?.timezone ?? "Timezone"}</small>
                </article>
                <article>
                  <span>Enrollments</span>
                  <strong>{selectedStudentEnrollments.length}</strong>
                  <small>{selectedStudentEnrollments.map((item) => item.status).join(", ") || "No enrollment"}</small>
                </article>
                <article>
                  <span>Performance</span>
                  <strong>{selectedStudentEnrollments[0]?.currentGrade ?? 0}%</strong>
                  <small>Attendance {selectedStudentEnrollments[0]?.attendanceRate ?? 0}%</small>
                </article>
                <Link className="platform-secondary-button compact" href="/app/registrar/enrollments">
                  <ArrowRight size={15} />
                  Open enrollment
                </Link>
              </>
            )}
          </div>
        </section>
      ) : null}

      <div className="registrar-layout">
        <section className="registrar-panel registrar-intake-panel">
          <div className="registrar-panel-head">
            <div>
              <span>Lead intake</span>
              <strong>{state.leads.length} active records</strong>
            </div>
            <Megaphone size={18} />
          </div>
          <div className="registrar-lead-list">
            {state.leads.slice(0, 5).map((lead) => {
              const converted = state.applications.some((application) => application.leadId === lead.id);
              return (
                <article key={lead.id}>
                  <div>
                    <strong>{lead.fullName}</strong>
                    <small>{lead.subject} · {lead.phone} · {lead.source}</small>
                  </div>
                  <span>{lead.status}</span>
                  <button disabled={converted} onClick={() => convertLead(lead.id)}>{converted ? "Converted" : "Convert"}</button>
                </article>
              );
            })}
          </div>
          <form className="registrar-lead-form" onSubmit={createLead}>
            <label>
              Full name
              <input value={leadDraft.fullName} onChange={(event) => setLeadDraft((value) => ({ ...value, fullName: event.target.value }))} placeholder="Student or guardian name" />
            </label>
            <label>
              Phone
              <input value={leadDraft.phone} onChange={(event) => setLeadDraft((value) => ({ ...value, phone: event.target.value }))} placeholder="+20..." />
            </label>
            <label>
              Email
              <input type="email" value={leadDraft.email} onChange={(event) => setLeadDraft((value) => ({ ...value, email: event.target.value }))} placeholder="email@example.com" />
            </label>
            <label>
              Subject
              <input value={leadDraft.subject} onChange={(event) => setLeadDraft((value) => ({ ...value, subject: event.target.value }))} />
            </label>
            <label>
              Source
              <select value={leadDraft.source} onChange={(event) => setLeadDraft((value) => ({ ...value, source: event.target.value as Lead["source"] }))}>
                <option value="manual">Manual</option>
                <option value="website">Website</option>
                <option value="trial_form">Trial form</option>
                <option value="placement_form">Placement form</option>
                <option value="whatsapp">WhatsApp</option>
              </select>
            </label>
            <label>
              Notes
              <input value={leadDraft.notes} onChange={(event) => setLeadDraft((value) => ({ ...value, notes: event.target.value }))} placeholder="Schedule, branch, or language notes" />
            </label>
            <button type="submit">
              <Plus size={15} />
              Add lead
            </button>
          </form>
        </section>

        <section className="registrar-panel registrar-placement-panel">
          <div className="registrar-panel-head">
            <div>
              <span>Placement</span>
              <strong>{pendingPlacements.length} pending</strong>
            </div>
            <ClipboardList size={18} />
          </div>
          <div className="registrar-placement-card">
            <label>
              Booking
              <select value={selectedPlacement?.id ?? ""} onChange={(event) => setSelectedPlacementId(event.target.value)}>
                {state.placementTests.map((booking) => <option key={booking.id} value={booking.id}>{booking.fullName} · {booking.subject}</option>)}
              </select>
            </label>
            <div>
              <strong>{selectedPlacement?.fullName ?? "No booking selected"}</strong>
              <small>{selectedPlacement ? `${selectedPlacement.preferredDate} · ${selectedPlacement.currentLevel} · ${selectedPlacement.status}` : "Create a placement booking first."}</small>
            </div>
            <div className="registrar-placement-inputs">
              <label>
                Recommended level
                <input value={recommendedLevel} onChange={(event) => setRecommendedLevel(event.target.value)} />
              </label>
              <label>
                Score
                <input type="number" min={0} max={100} value={score} onChange={(event) => setScore(Number(event.target.value))} />
              </label>
            </div>
            <button disabled={!selectedPlacement || selectedPlacement.status === "completed"} onClick={recordPlacement}>
              <CheckCircle2 size={15} />
              {selectedPlacement?.status === "completed" ? "Result recorded" : "Record placement result"}
            </button>
          </div>
        </section>

        <section className="registrar-panel registrar-finance-panel">
          <div className="registrar-panel-head">
            <div>
              <span>Finance</span>
              <strong>Invoices and receipts</strong>
            </div>
            <CreditCard size={18} />
          </div>
          <div className="registrar-invoice-list">
            {state.invoices.map((invoice) => {
              const student = state.students.find((item) => item.id === invoice.studentId);
              const user = state.users.find((item) => item.id === student?.userId);
              const paid = state.payments
                .filter((payment) => payment.invoiceId === invoice.id && payment.status === "paid")
                .reduce((sum, payment) => sum + payment.amount, 0);
              const balance = Math.max(0, invoice.amount - paid);
              return (
                <article key={invoice.id}>
                  <div>
                    <strong>{user?.name ?? invoice.studentId}</strong>
                    <small>{invoice.id} · {invoice.currency} {invoice.amount} · balance {balance}</small>
                  </div>
                  <span>{invoice.status}</span>
                  <button disabled={balance <= 0 || invoice.status === "paid"} onClick={() => recordInvoicePayment(invoice.id)}>
                    {invoice.status === "paid" ? "Paid" : "Record payment"}
                  </button>
                </article>
              );
            })}
          </div>
        </section>
      </div>

      <div className="registrar-lower-grid">
        <section className="registrar-panel">
          <div className="registrar-panel-head">
            <div>
              <span>Applications</span>
              <strong>{state.applications.length} files</strong>
            </div>
            <FileText size={18} />
          </div>
          <div className="registrar-application-list">
            {state.applications.map((application) => {
              const lead = state.leads.find((item) => item.id === application.leadId);
              const branch = state.branches.find((item) => item.id === application.branchId);
              return (
                <article key={application.id}>
                  <div>
                    <strong>{lead?.fullName ?? application.id}</strong>
                    <small>{application.courseInterest} · {branch?.name ?? "No branch"} · {application.schedulePreference}</small>
                  </div>
                  <span>{application.status}</span>
                </article>
              );
            })}
          </div>
        </section>

        <section className="registrar-panel">
          <div className="registrar-panel-head">
            <div>
              <span>Enrollment handoff</span>
              <strong>{readyWorkflows.length} ready</strong>
            </div>
            <UserPlus size={18} />
          </div>
          <div className="registrar-workflow-list">
            {state.enrollmentWorkflows.map((workflow) => {
              const lead = state.leads.find((item) => item.id === workflow.leadId);
              const student = state.students.find((item) => item.id === workflow.studentId);
              const user = state.users.find((item) => item.id === student?.userId);
              const course = state.courses.find((item) => item.id === workflow.targetCourseId);
              return (
                <article key={workflow.id}>
                  <div>
                    <strong>{lead?.fullName ?? user?.name ?? workflow.id}</strong>
                    <small>{course?.title ?? "Course"} · {workflow.nextStep}</small>
                  </div>
                  <span>{workflow.status}</span>
                </article>
              );
            })}
          </div>
        </section>

        <section className="registrar-panel">
          <div className="registrar-panel-head">
            <div>
              <span>Students and classes</span>
              <strong>{state.students.length} students</strong>
            </div>
            <Users size={18} />
          </div>
          <div className="registrar-student-class-list">
            {state.enrollments.slice(0, 5).map((enrollment) => {
              const student = state.students.find((item) => item.id === enrollment.studentId);
              const user = state.users.find((item) => item.id === student?.userId);
              const run = state.courseRuns.find((item) => item.id === enrollment.courseRunId);
              const course = state.courses.find((item) => item.id === run?.courseId);
              const classGroup = state.classGroups.find((item) => item.courseRunId === run?.id);
              return (
                <article key={enrollment.id}>
                  <div>
                    <strong>{user?.name ?? enrollment.studentId}</strong>
                    <small>{course?.title ?? "Course"} · {classGroup?.name ?? "Class pending"}</small>
                  </div>
                  <span>{enrollment.status}</span>
                </article>
              );
            })}
          </div>
        </section>

        <section className="registrar-panel">
          <div className="registrar-panel-head">
            <div>
              <span>Admissions audit</span>
              <strong>Recent operations</strong>
            </div>
            <ShieldCheck size={18} />
          </div>
          <div className="admin-audit-list">
            {registrarAuditRows.length ? registrarAuditRows.map((auditRow) => (
              <article key={auditRow.id}>
                <strong>{auditRow.action}</strong>
                <small>{auditRow.summary}</small>
                <span>{new Date(auditRow.createdAt).toLocaleString()}</span>
              </article>
            )) : (
              <article>
                <strong>registrar.ready</strong>
                <small>Admissions workspace is connected to local platform state.</small>
                <span>Now</span>
              </article>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function TeacherDeliveryExperience({ pageId, params }: { pageId: string; params?: Record<string, string | undefined> }) {
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
  const state = useMemo(() => platformStore.getState(), [version]);
  const refresh = () => setVersion((value) => value + 1);
  const actorId = getDemoUser("teacher").id;
  const teacherRuns = state.courseRuns.filter((run) => run.teacherId === actorId);
  const teacherClasses = state.classGroups.filter((classGroup) => teacherRuns.some((run) => run.id === classGroup.courseRunId));
  const selectedClass =
    teacherClasses.find((classGroup) => classGroup.id === (params?.classId ?? selectedClassId)) ??
    teacherClasses.find((classGroup) => classGroup.id === selectedClassId) ??
    teacherClasses[0];
  const selectedRun = state.courseRuns.find((run) => run.id === selectedClass?.courseRunId);
  const selectedCourse = state.courses.find((course) => course.id === selectedRun?.courseId);
  const selectedBranch = state.branches.find((branch) => branch.id === selectedRun?.branchId);
  const selectedRoom = state.rooms.find((room) => room.id === selectedClass?.roomId);
  const meeting = state.meetingLinks.find((link) => link.id === selectedClass?.meetingLinkId);
  const modules = state.modules.filter((moduleItem) => moduleItem.courseId === selectedCourse?.id).sort((a, b) => a.order - b.order);
  const lessonRows = modules.flatMap((moduleItem) =>
    state.lessons
      .filter((lesson) => lesson.moduleId === moduleItem.id)
      .map((lesson) => ({ lesson, module: moduleItem })),
  );
  const resourceRows = lessonRows.flatMap(({ lesson }) =>
    state.resources
      .filter((resource) => resource.lessonId === lesson.id)
      .map((resource) => ({ resource, lesson })),
  );
  const classStudents = (selectedClass?.studentIds ?? [])
    .map((studentId) => {
      const student = state.students.find((item) => item.id === studentId);
      const user = state.users.find((item) => item.id === student?.userId);
      const enrollment = state.enrollments.find((item) => item.studentId === studentId && item.courseRunId === selectedRun?.id);
      return student && user ? { student, user, enrollment } : null;
    })
    .filter(Boolean) as Array<{
      student: (typeof state.students)[number];
      user: (typeof state.users)[number];
      enrollment?: (typeof state.enrollments)[number];
    }>;
  const classSessions = state.classSessions.filter((session) => session.classGroupId === selectedClass?.id);
  const activeSession = classSessions[0];
  const assignments = state.assignments.filter((assignment) => assignment.courseRunId === selectedRun?.id);
  const quizzes = state.quizzes.filter((quiz) => quiz.courseRunId === selectedRun?.id);
  const selectedAssignment =
    assignments.find((assignment) => assignment.id === params?.assignmentId) ??
    assignments[0];
  const selectedQuiz =
    quizzes.find((quiz) => quiz.id === params?.quizId) ??
    quizzes[0];
  const pendingSubmissions = state.assignmentSubmissions.filter((submission) =>
    assignments.some((assignment) => assignment.id === submission.assignmentId) && submission.status === "pending",
  );
  const selectedSubmission =
    pendingSubmissions.find((submission) => submission.assignmentId === selectedAssignment?.id) ??
    pendingSubmissions[0];
  const selectedSubmissionAssignment = assignments.find((assignment) => assignment.id === selectedSubmission?.assignmentId);
  const selectedSubmissionStudent = classStudents.find((row) => row.student.id === selectedSubmission?.studentId);
  const attendanceRecords = state.attendance.filter((record) => record.classGroupId === selectedClass?.id);
  const savedAttendance = classSessions.filter((session) => session.attendanceSaved).length;
  const averageProgress = classStudents.length
    ? Math.round(classStudents.reduce((sum, row) => sum + (row.enrollment?.progress ?? 0), 0) / classStudents.length)
    : 0;
  const teacherAuditRows = state.auditLogs
    .filter((audit) => /class|attendance|calendar|lesson|material|assignment|quiz|message/i.test(`${audit.action} ${audit.entityType} ${audit.summary}`))
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
  const classBaseHref = selectedClass ? `/app/teacher/classes/${selectedClass.id}` : "/app/teacher/classes";

  const createSession = (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedClass || !selectedRun || !sessionDraft.title.trim()) {
      toast.error("Select a class and enter a session title");
      return;
    }
    platformStore.createCalendarEvent(
      {
        type: "live_session",
        title: sessionDraft.title.trim(),
        startsAt: new Date(sessionDraft.startsAt).toISOString(),
        endsAt: new Date(sessionDraft.endsAt).toISOString(),
        ownerId: actorId,
        branchId: selectedRun.branchId,
        roomId: selectedClass.roomId,
        classGroupId: selectedClass.id,
      },
      actorId,
    );
    setSessionDraft({ title: "Focused live class", startsAt: "2026-06-29T09:00", endsAt: "2026-06-29T10:30" });
    refresh();
    toast.success("Class session created");
  };

  const saveAllPresent = () => {
    if (!selectedClass || !activeSession) {
      toast.error("Create a session before saving attendance");
      return;
    }
    const statuses = classStudents.reduce<Record<string, AttendanceStatus>>((acc, row) => {
      acc[row.student.id] = "present";
      return acc;
    }, {});
    platformStore.saveAttendanceBulk(selectedClass.id, activeSession.id, statuses, actorId);
    refresh();
    toast.success("Attendance saved");
  };

  const sendClassReminder = () => {
    const firstStudent = classStudents[0];
    if (!firstStudent || !selectedClass) {
      toast.error("No student is assigned to this class");
      return;
    }
    platformStore.sendMessage({
      fromUserId: actorId,
      toUserId: firstStudent.user.id,
      subject: `${selectedClass.name} reminder`,
      body: `${selectedClass.name} is scheduled for ${selectedClass.schedule}.`,
    });
    refresh();
    toast.success("Class reminder sent");
  };

  const toggleResourcePublish = (resourceId: string) => {
    const next = clonePlatformState();
    const resource = next.resources.find((item) => item.id === resourceId);
    if (!resource) return;
    resource.published = !resource.published;
    platformStore.setState(next);
    platformStore.audit(
      resource.published ? "material.published" : "material.unpublished",
      "LessonResource",
      resource.id,
      `${resource.title} marked ${resource.published ? "published" : "unpublished"}.`,
      actorId,
    );
    refresh();
    toast.success(resource.published ? "Material published" : "Material unpublished");
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
          .map((item) => item.trim())
          .filter(Boolean),
      },
      actorId,
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
        durationMinutes: Number(quizDraft.durationMinutes) || 20,
        attemptsAllowed: Math.max(1, Number(quizDraft.attemptsAllowed) || 1),
        questionTypes: quizDraft.questionTypes
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
      },
      actorId,
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
      actorId,
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
      <section className="teacher-delivery-hero">
        <div>
          <span className="platform-eyebrow">{selectedCourse?.title ?? "Class delivery"}</span>
          <h2>Run live teaching, student progress, attendance, assignments, and materials from one focused class surface.</h2>
          <p>Teacher screens need to work on classroom boards and laptops: clear session state, large course context, fast roster checks, and material controls without visual clutter.</p>
        </div>
        <div className="teacher-delivery-actions">
          {[
            ["Classes", "/app/teacher/classes", "classes", BookOpen],
            ["Overview", classBaseHref, "class-detail", MonitorPlay],
            ["Sessions", `${classBaseHref}/sessions`, "sessions", CalendarDays],
            ["Students", `${classBaseHref}/students`, "students", Users],
            ["Materials", `${classBaseHref}/materials`, "materials", FileText],
            ["Attendance", `${classBaseHref}/attendance`, "attendance", CheckCircle2],
            ["Assignments", "/app/teacher/assignments", "assignments", FileQuestion],
            ["Grading", "/app/teacher/grading", "grading", ShieldCheck],
            ["Quizzes", "/app/teacher/quizzes", "quizzes", ClipboardList],
            ["Question bank", "/app/teacher/question-bank", "question-bank", Database],
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
        </div>
      </section>

      <div className="teacher-delivery-kpis">
        <AdminAccessMetric label="Classes" value={String(teacherClasses.length)} />
        <AdminAccessMetric label="Students" value={String(classStudents.length)} />
        <AdminAccessMetric label="Lessons" value={String(lessonRows.length)} />
        <AdminAccessMetric label="Pending grading" value={String(pendingSubmissions.length)} />
        <AdminAccessMetric label="Progress" value={`${averageProgress}%`} />
      </div>

      {["assignments", "assignment-detail", "grading", "quizzes", "question-bank"].includes(pageId) ? (
        <section className="teacher-panel teacher-assessment-command">
          <div className="teacher-panel-head">
            <div>
              <span>Assessment command</span>
              <strong>
                {pageId === "grading"
                  ? "Grade learner work"
                  : pageId === "quizzes" || pageId === "question-bank"
                    ? "Build quiz activity"
                    : selectedAssignment?.title ?? "Create assignment"}
              </strong>
            </div>
            <FileQuestion size={18} />
          </div>
          <div className="teacher-assessment-command-grid">
            <form className="teacher-session-form" onSubmit={createAssignment}>
              <strong>Create assignment</strong>
              <label>
                Title
                <input value={assignmentDraft.title} onChange={(event) => setAssignmentDraft((value) => ({ ...value, title: event.target.value }))} />
              </label>
              <label>
                Due
                <input type="datetime-local" value={assignmentDraft.dueAt} onChange={(event) => setAssignmentDraft((value) => ({ ...value, dueAt: event.target.value }))} />
              </label>
              <label>
                Submission type
                <select value={assignmentDraft.submissionType} onChange={(event) => setAssignmentDraft((value) => ({ ...value, submissionType: event.target.value as "text" | "file" | "audio" | "video" }))}>
                  <option value="text">Text</option>
                  <option value="file">File</option>
                  <option value="audio">Audio</option>
                  <option value="video">Video</option>
                </select>
              </label>
              <label>
                Rubric
                <input value={assignmentDraft.rubric} onChange={(event) => setAssignmentDraft((value) => ({ ...value, rubric: event.target.value }))} />
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
                <input value={quizDraft.title} onChange={(event) => setQuizDraft((value) => ({ ...value, title: event.target.value }))} />
              </label>
              <label>
                Duration minutes
                <input type="number" value={quizDraft.durationMinutes} onChange={(event) => setQuizDraft((value) => ({ ...value, durationMinutes: Number(event.target.value) }))} />
              </label>
              <label>
                Attempts
                <input type="number" value={quizDraft.attemptsAllowed} onChange={(event) => setQuizDraft((value) => ({ ...value, attemptsAllowed: Number(event.target.value) }))} />
              </label>
              <label>
                Question types
                <input value={quizDraft.questionTypes} onChange={(event) => setQuizDraft((value) => ({ ...value, questionTypes: event.target.value }))} />
              </label>
              <button type="submit">
                <Plus size={15} />
                Create quiz
              </button>
            </form>

            <div className="teacher-grading-card">
              <strong>{selectedSubmission ? "Pending submission" : "No pending submission"}</strong>
              <small>
                {selectedSubmission
                  ? `${selectedSubmissionStudent?.user.name ?? selectedSubmission.studentId} · ${selectedSubmissionAssignment?.title ?? selectedSubmission.assignmentId}`
                  : "Submitted work will appear here when students turn in assignments."}
              </small>
              <label>
                Score
                <input type="number" value={gradeDraft.score} onChange={(event) => setGradeDraft((value) => ({ ...value, score: Number(event.target.value) }))} />
              </label>
              <label>
                Feedback
                <textarea value={gradeDraft.feedback} onChange={(event) => setGradeDraft((value) => ({ ...value, feedback: event.target.value }))} />
              </label>
              <button type="button" onClick={gradeSelectedSubmission} disabled={!selectedSubmission}>
                <ShieldCheck size={15} />
                Return feedback
              </button>
            </div>

            <div className="teacher-assessment-route-card">
              <strong>Selected route context</strong>
              <small>{selectedCourse?.title ?? "Course"} · {selectedClass?.name ?? "Class"}</small>
              <div className="teacher-route-context-list">
                <span>Assignment: {selectedAssignment?.title ?? "None"}</span>
                <span>Quiz: {selectedQuiz?.title ?? "None"}</span>
                <span>Pending: {pendingSubmissions.length}</span>
                <span>Question bank: {quizzes.reduce((sum, quiz) => sum + quiz.questionTypes.length, 0)} mapped types</span>
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
            <select value={selectedClass?.id ?? ""} onChange={(event) => setSelectedClassId(event.target.value)} aria-label="Teacher class scope">
              {teacherClasses.map((classGroup) => <option key={classGroup.id} value={classGroup.id}>{classGroup.name}</option>)}
            </select>
          </div>
          <div className="teacher-class-card">
            <span>{selectedBranch?.code ?? "CL"}</span>
            <div>
              <strong>{selectedCourse?.description ?? "Course description"}</strong>
              <small>{selectedClass?.schedule ?? "Schedule pending"} · {selectedRoom?.name ?? "Room pending"} · {meeting?.status ?? "meeting pending"}</small>
            </div>
          </div>
          <div className="teacher-readiness-list">
            {[
              ["Sessions", classSessions.length ? `${classSessions.length} scheduled` : "Create first session"],
              ["Attendance", savedAttendance ? `${savedAttendance} saved` : "Attendance pending"],
              ["Assignments", assignments.length ? `${assignments.length} active` : "No assignment"],
              ["Resources", `${resourceRows.filter((row) => row.resource.published).length}/${resourceRows.length} published`],
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
              <strong>{activeSession ? new Date(activeSession.startsAt).toLocaleString() : "Create a live class session"}</strong>
              <small>{activeSession ? `${activeSession.status} · attendance ${activeSession.attendanceSaved ? "saved" : "pending"}` : "The session will create a calendar event and class session record."}</small>
            </div>
            <div className="teacher-session-actions">
              <button onClick={saveAllPresent} disabled={!activeSession || !classStudents.length}>
                <CheckCircle2 size={15} />
                Save all present
              </button>
              <button onClick={sendClassReminder} disabled={!classStudents.length}>
                <MessageSquare size={15} />
                Send reminder
              </button>
            </div>
          </div>
          <form className="teacher-session-form" onSubmit={createSession}>
            <label>
              Title
              <input value={sessionDraft.title} onChange={(event) => setSessionDraft((value) => ({ ...value, title: event.target.value }))} />
            </label>
            <label>
              Starts
              <input type="datetime-local" value={sessionDraft.startsAt} onChange={(event) => setSessionDraft((value) => ({ ...value, startsAt: event.target.value }))} />
            </label>
            <label>
              Ends
              <input type="datetime-local" value={sessionDraft.endsAt} onChange={(event) => setSessionDraft((value) => ({ ...value, endsAt: event.target.value }))} />
            </label>
            <button type="submit">
              <Plus size={15} />
              Create session
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
                  <small>{module.title} · {lesson.type} · {lesson.durationMinutes} min</small>
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
            {classStudents.map((row) => (
              <article key={row.student.id}>
                <div>
                  <strong>{row.user.name}</strong>
                  <small>{row.student.timezone} · attendance {row.enrollment?.attendanceRate ?? 0}% · grade {row.enrollment?.currentGrade ?? 0}%</small>
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
            {[...assignments.map((item) => ({ id: item.id, title: item.title, meta: `${item.submissionType} · due ${item.dueAt}`, status: item.status })), ...quizzes.map((item) => ({ id: item.id, title: item.title, meta: `${item.durationMinutes} min · ${item.questionTypes.join(", ")}`, status: item.status }))].map((item) => (
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
                  <small>{lesson.title} · {resource.type}</small>
                </div>
                <button onClick={() => toggleResourcePublish(resource.id)}>{resource.published ? "Published" : "Publish"}</button>
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
            {teacherAuditRows.length ? teacherAuditRows.map((auditRow) => (
              <article key={auditRow.id}>
                <strong>{auditRow.action}</strong>
                <small>{auditRow.summary}</small>
                <span>{new Date(auditRow.createdAt).toLocaleString()}</span>
              </article>
            )) : (
              <article>
                <strong>teacher.ready</strong>
                <small>Class delivery workspace is connected to local platform state.</small>
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

function MoodleSourceExperience({ config, role }: { config: PageConfig; role: Role }) {
  const course = useMemo(() => getMoodleSourceCourseSnapshot(), []);
  const canSeeHidden = role !== "student";
  const [activeType, setActiveType] = useState<"all" | MoodleActivityType>("all");
  const [visibility, setVisibility] = useState<"student" | "all" | "hidden">(canSeeHidden ? "all" : "student");
  const [selectedSectionId, setSelectedSectionId] = useState<number | null>(course.sections.find((section) => section.activities.length)?.id ?? course.sections[0]?.id ?? null);
  const [selectedActivityKey, setSelectedActivityKey] = useState<string>(() => {
    const firstActivity = course.sections.flatMap((section) => section.activities).find((activity) => canSeeHidden || !activity.hiddenFromStudents);
    return firstActivity ? activityKey(firstActivity) : "";
  });
  const selectedSection = course.sections.find((section) => section.id === selectedSectionId) ?? course.sections.find((section) => section.activities.length) ?? course.sections[0];
  const hiddenCount = course.sections.flatMap((section) => section.activities).filter((activity) => activity.hiddenFromStudents).length;

  const filteredSections = useMemo(() => {
    return course.sections
      .map((section) => {
        const activities = section.activities.filter((activity) => {
          const typeMatch = activeType === "all" || activity.type === activeType;
          const visibilityMatch =
            visibility === "all" ||
            (visibility === "student" && !activity.hiddenFromStudents) ||
            (visibility === "hidden" && activity.hiddenFromStudents);
          return typeMatch && visibilityMatch;
        });
        return { ...section, activities };
      })
      .filter((section) => section.activities.length || section.id === course.observedSectionId);
  }, [activeType, course, visibility]);

  const selectedActivity = useMemo(() => {
    const allActivities = filteredSections.flatMap((section) => section.activities);
    return allActivities.find((activity) => activityKey(activity) === selectedActivityKey) ?? allActivities[0] ?? null;
  }, [filteredSections, selectedActivityKey]);

  const selectedActivityIcon = selectedActivity ? getActivityIcon(selectedActivity.type) : FileText;
  const SelectedActivityIcon = selectedActivityIcon;
  const visibleCount = Object.values(course.activityTotals).reduce((sum, value) => sum + value, 0);

  const logSyncReview = () => {
    const audit = platformStore.audit(
      "moodle.sync.review",
      course.shortname,
      `moodle-course-${course.id}`,
      `Queued Moodle course source review for ${course.shortname}.`,
      getDemoUser(role).id,
    );
    toast.success("Moodle source review queued", { description: audit.id });
  };

  return (
    <div className="moodle-source-layout">
      <section className="moodle-source-hero">
        <div className="moodle-source-hero-copy">
          <span className="platform-eyebrow">Moodle course {course.id}</span>
          <h2>{course.shortname}</h2>
          <p>{course.fullname}</p>
          <div className="moodle-source-meta">
            <span><Layers size={14} /> {course.moodleFormat}</span>
            <span><BookOpen size={14} /> section {course.observedSectionId}</span>
            <span><Server size={14} /> {course.integration.restAccess}</span>
          </div>
        </div>
        <div className="moodle-source-sync">
          <strong>Integration status</strong>
          <span className="platform-status danger">
            <AlertTriangle size={14} />
            REST permissions required
          </span>
          <p>{course.integration.blockedReason}</p>
          <button className="platform-primary-button" style={{ background: roleMeta[role].color }} onClick={logSyncReview}>
            <RefreshCcw size={15} />
            {config.primaryAction}
          </button>
        </div>
      </section>

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
                onClick={() => setActiveType(activeType === moodleType ? "all" : moodleType)}
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
          <span>{canSeeHidden ? `${hiddenCount} teacher-only or hidden items included` : `${hiddenCount} teacher-only items hidden from the student view`}</span>
        </div>
        <div className="platform-toolbar-filters">
          <button className={visibility === "student" ? "active" : ""} onClick={() => setVisibility("student")}>
            <Eye size={14} />
            Student visible
          </button>
          {canSeeHidden ? (
            <>
              <button className={visibility === "hidden" ? "active" : ""} onClick={() => setVisibility("hidden")}>
                <EyeOff size={14} />
                Hidden
              </button>
              <button className={visibility === "all" ? "active" : ""} onClick={() => setVisibility("all")}>
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
            {filteredSections.map((section) => (
              <MoodleSectionButton
                key={section.id ?? section.title}
                section={section}
                active={section.id === selectedSection?.id}
                role={role}
                onSelect={() => {
                  setSelectedSectionId(section.id);
                  const firstActivity = section.activities[0];
                  if (firstActivity) setSelectedActivityKey(activityKey(firstActivity));
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
            {(filteredSections.find((section) => section.id === selectedSection?.id)?.activities ?? []).map((activity) => {
              const Icon = getActivityIcon(activity.type);
              const active = selectedActivity && activityKey(selectedActivity) === activityKey(activity);
              return (
                <button key={activityKey(activity)} className={active ? "active" : ""} onClick={() => setSelectedActivityKey(activityKey(activity))}>
                  <span className="moodle-activity-icon">
                    <Icon size={16} />
                  </span>
                  <div>
                    <strong>{activity.title}</strong>
                    <small>{activityTypeLabel[activity.type]} · {activity.cmid ? `cmid ${activity.cmid}` : "external"}</small>
                  </div>
                  {activity.hiddenFromStudents ? <em>Hidden</em> : <em>Visible</em>}
                </button>
              );
            })}
            {!filteredSections.find((section) => section.id === selectedSection?.id)?.activities.length ? (
              <div className="platform-empty-state">
                <Filter size={18} />
                <strong>No activities in this filter</strong>
                <small>Switch module type or visibility to inspect more source items.</small>
              </div>
            ) : null}
          </div>
        </div>

        <aside className="moodle-source-inspector">
          <div className="platform-card-title">
            <div>
              <span>Activity renderer</span>
              <strong>{selectedActivity?.title ?? "No activity selected"}</strong>
            </div>
            <SelectedActivityIcon size={18} style={{ color: roleMeta[role].color }} />
          </div>
          {selectedActivity ? (
            <>
              <div className="moodle-render-preview">
                <span className={`moodle-render-type ${selectedActivity.renderer}`}>
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
                  <dd>{selectedActivity.hiddenFromStudents ? "Hidden from students" : "Student visible"}</dd>
                </div>
                <div>
                  <dt>Completion</dt>
                  <dd>{selectedActivity.completion}</dd>
                </div>
              </dl>
              <a className="platform-secondary-button" href={selectedActivity.sourceUrl} target="_blank" rel="noreferrer">
                <ExternalLink size={15} />
                Open Moodle source
              </a>
            </>
          ) : (
            <p>Select an activity to inspect its Moodle source and renderer strategy.</p>
          )}
        </aside>
      </div>

      <div className="moodle-integration-grid">
        <article className="platform-panel">
          <div className="platform-card-title">
            <div>
              <span>Server-side contract</span>
              <strong>Required Moodle functions</strong>
            </div>
          </div>
          <ul>
            {course.integration.requiredFunctions.map((name) => (
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
            {course.teacherTools.slice(0, 9).map((tool) => (
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
  const hidden = section.activities.filter((activity) => activity.hiddenFromStudents).length;
  return (
    <button className={active ? "active" : ""} onClick={onSelect}>
      <span>{String(section.moodleIndex).padStart(2, "0")}</span>
      <div>
        <strong>{section.title}</strong>
        <small>
          {section.id ? `sectionid ${section.id}` : "Moodle section"} · {section.activities.length} item{section.activities.length === 1 ? "" : "s"}
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
  const [sortKey, setSortKey] = useState<"title" | "status" | "owner" | "due">("title");
  const [page, setPage] = useState(1);
  const [selectedRecord, setSelectedRecord] = useState<RecordItem | null>(records[0] ?? null);
  const pageSize = 6;
  const filteredRecords = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const filter = activeFilter.toLowerCase();
    return records
      .filter((record) => {
        const queryMatch = !normalized || `${record.title} ${record.subtitle} ${record.status} ${record.owner} ${record.metric}`.toLowerCase().includes(normalized);
        const filterMatch = filter === "all" || record.status.toLowerCase().includes(filter) || record.subtitle.toLowerCase().includes(filter);
        return queryMatch && filterMatch;
      })
      .sort((a, b) => a[sortKey].localeCompare(b[sortKey]));
  }, [activeFilter, query, records, sortKey]);
  const pageCount = Math.max(1, Math.ceil(filteredRecords.length / pageSize));
  const visibleRecords = filteredRecords.slice((page - 1) * pageSize, page * pageSize);

  const addSavedRecord = (values: Record<string, string>, recordId: string) => {
    const record: RecordItem = {
      id: recordId,
      title: values.title || values.fullName || values.name || `${config.title} record`,
      subtitle: values.notes || values.subject || `Saved from ${config.formTitle}`,
      status: values.status || "Saved",
      owner: values.owner || roleMeta[role].label,
      due: values.date || values.dueDate || "Now",
      metric: "Local",
      tone: "teal",
    };
    setRecords((prev) => [record, ...prev]);
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
          setActiveFilter={(filter) => {
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
        <RecordInspector record={selectedRecord} role={role} onClose={() => setSelectedRecord(null)} />
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
  const [localActiveFilter, setLocalActiveFilter] = useState(config.filters[0] ?? "All");
  const [localSortKey, setLocalSortKey] = useState<"title" | "status" | "owner" | "due">("title");
  const query = controlledQuery ?? localQuery;
  const setQuery = controlledSetQuery ?? setLocalQuery;
  const activeFilter = controlledActiveFilter ?? localActiveFilter;
  const setActiveFilter = controlledSetActiveFilter ?? setLocalActiveFilter;
  const sortKey = controlledSortKey ?? localSortKey;
  const setSortKey = controlledSetSortKey ?? setLocalSortKey;
  const onReset = controlledReset ?? (() => {
    setLocalQuery("");
    setLocalActiveFilter(config.filters[0] ?? "All");
    setLocalSortKey("title");
  });

  return (
    <div className="platform-toolbar">
      <div className="platform-toolbar-search">
        <Search size={15} />
        <input aria-label={`Search ${config.title.toLowerCase()}`} value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search ${config.title.toLowerCase()}...`} />
      </div>
      <div className="platform-toolbar-filters">
        {config.filters.map((filter) => (
          <button key={filter} className={activeFilter === filter ? "active" : ""} onClick={() => setActiveFilter(filter)}>
            {filter}
          </button>
        ))}
      </div>
      <select className="platform-toolbar-select" value={sortKey} onChange={(event) => setSortKey(event.target.value as "title" | "status" | "owner" | "due")} aria-label="Sort records">
        <option value="title">Sort by record</option>
        <option value="status">Sort by status</option>
        <option value="owner">Sort by owner</option>
        <option value="due">Sort by due</option>
      </select>
      <button className="platform-secondary-button compact" onClick={onReset}>
        <Filter size={14} />
        Reset
      </button>
      <span className="platform-result-count">{resultCount} result{resultCount === 1 ? "" : "s"}</span>
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
  const [fallbackSelectedId, setFallbackSelectedId] = useState<string | undefined>(selectedRecordId);
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
          {records.length ? records.map((record) => (
            <tr key={record.id} className={activeSelectedId === record.id ? "selected" : ""}>
              <td>
                <strong>{record.title}</strong>
                <small>{record.subtitle}</small>
              </td>
              <td>
                <span className="platform-status" style={{ color: toneColor[record.tone ?? "teal"], background: `${toneColor[record.tone ?? "teal"]}14` }}>
                  {record.status}
                </span>
              </td>
              <td>{record.owner}</td>
              <td>{record.due}</td>
              <td>{record.metric}</td>
              <td>
                <button aria-label={`Open ${record.title}`} onClick={() => openRecord(record)}>
                  <ArrowRight size={15} />
                </button>
              </td>
            </tr>
          )) : (
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
        <span>{totalRecords} records · page {page} of {pageCount}</span>
        <div>
          <button disabled={page === 1} onClick={() => changePage(Math.max(1, page - 1))}>Prev</button>
          {Array.from({ length: pageCount }).slice(0, 5).map((_, index) => {
            const nextPage = index + 1;
            return (
              <button key={nextPage} className={nextPage === page ? "active" : ""} onClick={() => changePage(nextPage)}>
                {nextPage}
              </button>
            );
          })}
          <button disabled={page === pageCount} onClick={() => changePage(Math.min(pageCount, page + 1))}>Next</button>
        </div>
      </div>
    </div>
  );
}

function QuickForm({ config, role, wide = false, onSaved }: { config: PageConfig; role: Role; wide?: boolean; onSaved?: (values: Record<string, string>, recordId: string) => void }) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const schema = useMemo(() => {
    return z.object(
      Object.fromEntries(
        config.formFields
          .filter((field) => field.type !== "textarea")
          .map((field) => [
            field.name,
            z.preprocess((value) => (typeof value === "string" ? value : ""), z.string().min(1, `${field.label} is required`)),
          ]),
      ),
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
    await new Promise((resolve) => setTimeout(resolve, 450));
    const recordId = platformStore.saveOperationalRecord(config.title, values, getDemoUser(role).id);
    const backend = await saveBackendRecord("operational", { module: config.title, formTitle: config.formTitle, localId: recordId, values }, getDemoUser(role).id);
    onSaved?.(values, recordId);
    setValues({});
    setLastSaved(recordId);
    setSaving(false);
    if (!backend.ok) {
      toast.warning("Saved locally; backend sync pending", { description: backend.error });
      return;
    }
    toast.success(`${config.primaryAction} saved`, {
      description: `Audit record ${recordId} was added to the local platform state.`,
    });
  };

  return (
    <form className={`platform-form-card ${wide ? "wide" : ""}`} onSubmit={submit} data-platform-create-form>
      <div className="platform-card-title">
        <div>
          <span>{config.eyebrow}</span>
          <strong>{config.formTitle}</strong>
        </div>
        <ShieldCheck size={17} style={{ color: roleMeta[role].color }} />
      </div>
      <div className="platform-form-grid">
        {config.formFields.map((field) => (
          <label key={field.name} className={field.type === "textarea" ? "full" : ""}>
            <span>{field.label}</span>
            {field.type === "select" ? (
              <select value={values[field.name] ?? ""} onChange={(event) => setValues((prev) => ({ ...prev, [field.name]: event.target.value }))}>
                <option value="">Select...</option>
                {field.options?.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            ) : field.type === "textarea" ? (
              <textarea value={values[field.name] ?? ""} placeholder={field.placeholder} onChange={(event) => setValues((prev) => ({ ...prev, [field.name]: event.target.value }))} />
            ) : (
              <input type={field.type} value={values[field.name] ?? ""} placeholder={field.placeholder} onChange={(event) => setValues((prev) => ({ ...prev, [field.name]: event.target.value }))} />
            )}
          </label>
        ))}
      </div>
      {error ? <p className="platform-form-error">{error}</p> : null}
      {lastSaved ? <p className="platform-form-success">Saved locally as {lastSaved}</p> : null}
      <div className="platform-form-actions">
        <button type="button" className="platform-secondary-button" onClick={() => {
          setValues({});
          setError(null);
        }}>
          Cancel
        </button>
        <button type="submit" className="platform-primary-button" style={{ background: roleMeta[role].color }} disabled={saving}>
          {saving ? "Saving..." : config.primaryAction}
        </button>
      </div>
    </form>
  );
}

function RecordInspector({ record, role, onClose }: { record: RecordItem | null; role: Role; onClose: () => void }) {
  if (!record) {
    return (
      <article className="platform-inspector empty">
        <div className="platform-card-title">
          <div>
            <span>Selection</span>
            <strong>No record selected</strong>
          </div>
        </div>
        <p>Select a row to inspect status, owner, due date, metric, and audit action.</p>
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
          <dd><span className="platform-status" style={{ color: toneColor[record.tone ?? "teal"], background: `${toneColor[record.tone ?? "teal"]}14` }}>{record.status}</span></dd>
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
        <button onClick={() => toast.success("Status copied to audit queue", { description: record.title })}>Queue follow-up</button>
        <button style={{ background: roleMeta[role].color, color: "white", borderColor: roleMeta[role].color }} onClick={() => {
          const audit = platformStore.audit("record.reviewed", record.title, record.id, `Reviewed ${record.title}.`, getDemoUser(role).id);
          toast.success("Review logged", { description: audit.id });
        }}>
          Log review
        </button>
      </div>
    </article>
  );
}

function Panels({ config }: { config: PageConfig }) {
  return (
    <>
      {config.panels.map((panel) => (
        <article key={panel.title} className="platform-panel">
          <div className="platform-card-title">
            <div>
              <span>{panel.description}</span>
              <strong>{panel.title}</strong>
            </div>
          </div>
          <ul>
            {panel.items.map((item) => (
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
        {records.map((record) => (
          <div key={record.id}>
            <span style={{ background: toneColor[record.tone ?? "teal"] }} />
            <strong>{record.title}</strong>
            <small>{record.status} - {record.due}</small>
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
          {milestones.map((item) => (
            <div key={item.label} className="platform-progress-row">
              <div>
                <strong>{item.label}</strong>
                <span>{item.progress}%</span>
              </div>
              <div>
                <span style={{ width: `${item.progress}%`, background: roleMeta[role].color }} />
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

function CalendarExperience({ config, role }: { config: PageConfig; role: Role }) {
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
                <p>{index === 4 ? "Conflict placeholder" : "Office hour / review"}</p>
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

function AssessmentExperience({ config, role }: { config: PageConfig; role: Role }) {
  return (
    <div className="platform-two-column">
      <div className="platform-stack">
        <div className="platform-assessment-grid">
          {["Multiple choice", "True/false", "Short answer", "Essay", "Oral record", "File/audio"].map((type, index) => (
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

function AttendanceExperience({ config, role }: { config: PageConfig; role: Role }) {
  const statuses = ["present", "late", "absent", "excused"];
  return (
    <div className="platform-two-column">
      <div className="platform-special-card">
        <div className="platform-card-title">
          <div>
            <span>Fast grid</span>
            <strong>Mark attendance</strong>
          </div>
          <SlidersHorizontal size={18} style={{ color: roleMeta[role].color }} />
        </div>
        <div className="platform-attendance-grid">
          {config.records.concat(config.records).slice(0, 6).map((record, index) => (
            <article key={`${record.id}_${index}`}>
              <div>
                <strong>{record.title}</strong>
                <span>{record.subtitle}</span>
              </div>
              <div>
                {statuses.map((status) => (
                  <button key={status} className={index % 4 === statuses.indexOf(status) ? "active" : ""}>
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

function CertificateExperience({ config, role }: { config: PageConfig; role: Role }) {
  return (
    <div className="platform-two-column">
      <div className="platform-certificate-grid">
        {config.records.map((record) => (
          <article key={record.id}>
            <AwardIcon color={roleMeta[role].color} />
            <span className="platform-status" style={{ color: toneColor[record.tone ?? "teal"], background: `${toneColor[record.tone ?? "teal"]}14` }}>
              {record.status}
            </span>
            <h3>{record.title}</h3>
            <p>{record.subtitle}</p>
            <strong>{record.metric}</strong>
            <button onClick={() => toast.success(`Certificate action: ${record.title}`)}>
              {record.status.includes("Pending") ? "Approve" : "Download placeholder"}
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

function ReportExperience({ config, role }: { config: PageConfig; role: Role }) {
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
                <span style={{ height: `${value}%`, background: index % 2 ? roleMeta[role].accent : roleMeta[role].color }} />
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

function MessagesExperience({ config, role }: { config: PageConfig; role: Role }) {
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
        {config.records.map((record) => (
          <button key={record.id} onClick={() => toast.info(`Opened ${record.title}`)}>
            <span style={{ background: `${toneColor[record.tone ?? "teal"]}18`, color: toneColor[record.tone ?? "teal"] }}>
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
    <span className="platform-award-icon" style={{ background: `${color}14`, color }}>
      <CheckCircle2 size={22} />
    </span>
  );
}

function decorateTitle(title: string, params: Record<string, string | undefined>) {
  return Object.values(params).some(Boolean) ? title : title;
}
