import { motion } from "framer-motion";
import { useMemo, type CSSProperties } from "react";
import {
  Activity,
  ArrowRight,
  Award,
  BookOpen,
  BookCopy,
  Building2,
  CheckCircle2,
  Clock,
  Database,
  GraduationCap,
  KeyRound,
  Layers,
  Library,
  ListChecks,
  MessageSquare,
  Network,
  Plus,
  PlugZap,
  Presentation,
  ScrollText,
  ShieldCheck,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Link } from "wouter";
import PlatformShell from "@/components/platform/PlatformShell";
import { PlatformPageHeader, platformReveal } from "@/components/platform/PlatformPrimitives";
import { platformStore } from "@/lib/domain/store";
import { dashboardByRole, roleMeta, rolePermissions, sidebarByRole, type Role, type Stat } from "@/lib/platformData";

const toneColor: Record<Stat["tone"], string> = {
  teal: "#1A4A3A",
  amber: "#C4A35A",
  green: "#2D5016",
  red: "#C75B39",
  purple: "#3D1A5C",
  slate: "#1A1A1A",
};

const dashboardReveal = platformReveal;

export default function RoleDashboard({ role }: { role: Role }) {
  const dashboard = dashboardByRole[role];
  const meta = roleMeta[role];
  const primaryActionsByRole: Partial<Record<Role, { label: string; href: string; Icon: LucideIcon }>> = {
    student: {
      label: "Continue lesson",
      href: "/app/student/courses/course_ar_l3/learn/lesson_ar_conditional",
      Icon: BookOpen,
    },
    teacher: {
      label: "Create session",
      href: "/app/teacher/classes/class_ar_l3_a/sessions",
      Icon: Presentation,
    },
    registrar: {
      label: "Add lead",
      href: "/app/registrar/leads",
      Icon: Users,
    },
    branchadmin: {
      label: "Resolve conflict",
      href: "/app/branch/rooms",
      Icon: Building2,
    },
  };
  const primaryDashboardAction = primaryActionsByRole[role] ?? {
    label: "Open workspace",
    href: meta.defaultRoute,
    Icon: Plus,
  };
  const reportActionLabel = role === "student" ? "My report" : "Reports";
  const spotlightRoutes: Partial<Record<Role, string>> = {
    student: "/app/student/courses/course_ar_l3/learn/lesson_ar_conditional",
    teacher: "/app/teacher/classes/class_ar_l3_a/attendance",
    registrar: "/app/registrar/placement-tests",
    branchadmin: "/app/branch/rooms",
  };
  const spotlightHref = spotlightRoutes[role] ?? meta.defaultRoute.replace("/dashboard", "/reports");
  const actionRoutesByRole: Partial<Record<Role, Record<string, string>>> = {
    student: {
      "Join class": "/app/student/courses/course_ar_l3/live",
      "Submit assignment": "/app/student/assignments/asg_ar_grammar",
      "Message teacher": "/app/student/messages",
      "View calendar": "/app/student/calendar",
    },
    teacher: {
      "Create assignment": "/app/teacher/assignments",
      "Upload material": "/app/teacher/classes/class_ar_l3_a/materials",
      "Mark attendance": "/app/teacher/classes/class_ar_l3_a/attendance",
      "Create quiz": "/app/teacher/quizzes",
    },
    registrar: {
      "Add lead": "/app/registrar/leads",
      "Book placement test": "/app/registrar/placement-tests",
      "Register student": "/app/registrar/enrollments",
      "Send message": "/app/registrar/messages",
    },
    branchadmin: {
      "Add room": "/app/branch/rooms",
      "View schedule": "/app/branch/classes",
      "Contact student": "/app/branch/students",
      "Resolve conflict": "/app/branch/rooms",
    },
  };
  const quickActionRoutes = actionRoutesByRole[role] ?? {};

  if (role === "superadmin") {
    return <SuperAdminDashboard />;
  }

  if (role === "headofdepartment") {
    return <HeadOfDepartmentDashboard />;
  }

  return (
    <PlatformShell role={role} title="Dashboard">
      <PlatformPageHeader
        compact
        title={dashboard.title}
        description={dashboard.subtitle}
        actions={
          <>
          <Link href={meta.defaultRoute.replace("/dashboard", "/reports")} className="platform-secondary-button">
            {reportActionLabel}
          </Link>
          <Link
            href={primaryDashboardAction.href}
            className="platform-primary-button"
            style={{ background: meta.color }}
          >
            <primaryDashboardAction.Icon size={15} />
            {primaryDashboardAction.label}
          </Link>
          </>
        }
      />

      <motion.div className="platform-metric-grid" initial="hidden" animate="visible">
        {dashboard.stats.map((stat, index) => (
          <motion.article key={stat.label} className="platform-metric" custom={0.05 + index * 0.045} variants={dashboardReveal}>
            <div>
              <span>{stat.label}</span>
              <strong>{stat.value}</strong>
            </div>
            <small style={{ color: toneColor[stat.tone], background: `${toneColor[stat.tone]}14` }}>{stat.change}</small>
          </motion.article>
        ))}
      </motion.div>

      <motion.div className="platform-dashboard-grid" initial="hidden" animate="visible" custom={0.14} variants={dashboardReveal}>
        <article className="platform-spotlight">
          <div className="platform-card-title">
            <div>
              <span>Next priority</span>
              <strong>{dashboard.spotlight.title}</strong>
            </div>
            <Clock size={18} style={{ color: meta.color }} />
          </div>
          <p>{dashboard.spotlight.description}</p>
          <div className="platform-progress-row">
            <div>
              <strong>Completion</strong>
              <span>{dashboard.spotlight.progress}%</span>
            </div>
            <div>
              <span style={{ width: `${dashboard.spotlight.progress}%`, background: meta.color }} />
            </div>
          </div>
          <Link href={spotlightHref} className="platform-primary-button" style={{ background: meta.color }}>
            {dashboard.spotlight.action}
            <ArrowRight size={15} />
          </Link>
        </article>

        <article className="platform-panel">
          <div className="platform-card-title">
            <div>
              <span>Role tools</span>
              <strong>Quick actions</strong>
            </div>
          </div>
          <div className="platform-action-list">
            {dashboard.actions.map((action) => (
              <Link key={action} href={quickActionRoutes[action] ?? meta.defaultRoute}>
                <CheckCircle2 size={15} style={{ color: meta.color }} />
                {action}
              </Link>
            ))}
          </div>
        </article>

        <article className="platform-table-card wide">
          <div className="platform-card-title compact">
            <div>
              <span>Live data</span>
              <strong>Today</strong>
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th>Status</th>
                <th>Owner</th>
                <th>Due</th>
                <th>Metric</th>
              </tr>
            </thead>
            <tbody>
              {dashboard.records.map((record) => (
                <tr key={record.id}>
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
                </tr>
              ))}
            </tbody>
          </table>
        </article>
      </motion.div>
    </PlatformShell>
  );
}

type AdminCapability = {
  label: string;
  description: string;
  metric: string;
  href: string;
  Icon: LucideIcon;
  tone: Stat["tone"];
};

const adminQuickActions = [
  { label: "Create user", description: "Open the user management workspace", href: "/app/admin/users", Icon: Users },
  { label: "Manage roles", description: "Review RBAC rules and assignments", href: "/app/admin/roles", Icon: KeyRound },
  { label: "Review audit logs", description: "Trace platform activity", href: "/app/admin/audit-logs", Icon: ScrollText },
  { label: "Open integrations", description: "Check Moodle, email, meetings, payments", href: "/app/admin/integrations", Icon: PlugZap },
];

const hodCapabilities: AdminCapability[] = [
  {
    label: "Departments",
    description: "Review academic ownership, program responsibility, and department KPIs.",
    metric: "Arabic and Quran",
    href: "/app/hod/departments",
    Icon: Building2,
    tone: "purple",
  },
  {
    label: "Programs and levels",
    description: "Coordinate pathways, levels, placement outcomes, and progression gates.",
    metric: "7 pathways",
    href: "/app/hod/programs",
    Icon: Library,
    tone: "teal",
  },
  {
    label: "Course map",
    description: "Open courses and imported Moodle sections for academic review.",
    metric: "42 courses",
    href: "/app/hod/courses",
    Icon: BookOpen,
    tone: "green",
  },
  {
    label: "Curriculum coverage",
    description: "Track outcomes, lesson sequencing, activities, and hidden teacher-only material.",
    metric: "82% mapped",
    href: "/app/hod/curriculum",
    Icon: BookCopy,
    tone: "amber",
  },
  {
    label: "Teacher quality",
    description: "Review observations, class health, teacher load, and intervention notes.",
    metric: "12 notes",
    href: "/app/hod/teachers",
    Icon: GraduationCap,
    tone: "slate",
  },
  {
    label: "Assessment approvals",
    description: "Review quizzes, certificate eligibility, and academic approval queues.",
    metric: "5 pending",
    href: "/app/hod/certificates",
    Icon: Award,
    tone: "red",
  },
];

const hodQuickActions = [
  { label: "Edit curriculum", description: "Update outcomes and lesson sequence", href: "/app/hod/curriculum", Icon: BookCopy },
  { label: "Assign teacher", description: "Balance teacher load and ownership", href: "/app/hod/teachers", Icon: GraduationCap },
  { label: "Review assessments", description: "Open quizzes and grading quality", href: "/app/hod/assessments", Icon: ListChecks },
  { label: "Approve certificates", description: "Check grade and attendance eligibility", href: "/app/hod/certificates", Icon: Award },
];

function HeadOfDepartmentDashboard() {
  const dashboard = dashboardByRole.headofdepartment;
  const meta = roleMeta.headofdepartment;
  const permissionCount = rolePermissions.headofdepartment.length;
  const navCount = sidebarByRole.headofdepartment.length;

  return (
    <PlatformShell role="headofdepartment" title="Dashboard">
      <PlatformPageHeader
        compact
        title={dashboard.title}
        description={dashboard.subtitle}
        actions={
          <>
          <Link href="/app/hod/reports" className="platform-secondary-button">
            Reports
          </Link>
          <Link href="/app/hod/courses" className="platform-primary-button" style={{ background: meta.color }}>
            <Plus size={15} />
            Course plan
          </Link>
          </>
        }
      />

      <motion.div className="platform-admin-status-strip platform-academic-status-strip" initial="hidden" animate="visible">
        {[
          ["Academic scope", "Arabic and Quran"],
          ["HOD modules", `${navCount} workspaces`],
          ["Approval rights", `${permissionCount} permissions`],
          ["Review queue", "5 certificates"],
        ].map(([label, value], index) => (
          <motion.article key={label} custom={0.03 + index * 0.035} variants={dashboardReveal}>
            <span>{label}</span>
            <strong>{value}</strong>
          </motion.article>
        ))}
      </motion.div>

      <motion.div className="platform-metric-grid platform-admin-metric-grid" initial="hidden" animate="visible">
        {dashboard.stats.map((stat, index) => (
          <motion.article key={stat.label} className="platform-metric" custom={0.07 + index * 0.045} variants={dashboardReveal}>
            <div>
              <span>{stat.label}</span>
              <strong>{stat.value}</strong>
            </div>
            <small style={{ color: toneColor[stat.tone], background: `${toneColor[stat.tone]}14` }}>{stat.change}</small>
          </motion.article>
        ))}
      </motion.div>

      <motion.div className="platform-admin-layout" initial="hidden" animate="visible" custom={0.16} variants={dashboardReveal}>
        <section className="platform-admin-command platform-academic-command">
          <div className="platform-admin-command-copy">
            <span>Academic command center</span>
            <h2>Keep curriculum, teacher quality, assessments, and certificates aligned across the department.</h2>
            <p>HOD work starts from academic evidence: coverage, observation notes, eligibility, and course structure.</p>
          </div>

          <div className="platform-admin-command-grid">
            {[
              { label: "Curriculum", value: "82%", color: toneColor.teal },
              { label: "Teachers", value: "84%", color: toneColor.green },
              { label: "Certificates", value: "5", color: toneColor.purple },
            ].map((item) => (
              <article key={item.label} style={{ "--item-color": item.color } as CSSProperties}>
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </article>
            ))}
          </div>

          <div className="platform-admin-command-actions">
            <Link href="/app/hod/moodle-source" className="platform-secondary-button">
              <PlugZap size={15} />
              Moodle source
            </Link>
            <Link href="/app/hod/certificates" className="platform-primary-button" style={{ background: meta.color }}>
              {dashboard.spotlight.action}
              <ArrowRight size={15} />
            </Link>
          </div>
        </section>

        <aside className="platform-admin-action-panel platform-academic-action-panel">
          <div className="platform-card-title compact">
            <div>
              <span>Academic tools</span>
              <strong>Review actions</strong>
            </div>
          </div>
          <div className="platform-admin-action-list">
            {hodQuickActions.map((action) => (
              <Link key={action.label} href={action.href}>
                <span>
                  <action.Icon size={16} />
                </span>
                <span>
                  <strong>{action.label}</strong>
                  <small>{action.description}</small>
                </span>
                <ArrowRight size={15} />
              </Link>
            ))}
          </div>
        </aside>
      </motion.div>

      <motion.section className="platform-admin-capability-grid platform-academic-capability-grid" initial="hidden" animate="visible" custom={0.2} variants={dashboardReveal}>
        {hodCapabilities.map((item) => (
          <Link key={item.label} href={item.href} className="platform-admin-capability-card" style={{ "--item-color": toneColor[item.tone] } as CSSProperties}>
            <span>
              <item.Icon size={18} />
            </span>
            <div>
              <small>{item.metric}</small>
              <strong>{item.label}</strong>
              <p>{item.description}</p>
            </div>
            <ArrowRight size={15} />
          </Link>
        ))}
      </motion.section>

      <motion.section className="platform-admin-event-board platform-academic-event-board" initial="hidden" animate="visible" custom={0.24} variants={dashboardReveal}>
        <div className="platform-card-title compact">
          <div>
            <span>Academic review stream</span>
            <strong>Today</strong>
          </div>
          <Link href="/app/hod/reports" className="platform-secondary-button compact">
            Reports
          </Link>
        </div>
        <div className="platform-admin-event-head" aria-hidden="true">
          <span>Item</span>
          <span>Status</span>
          <span>Owner</span>
          <span>Due</span>
          <span>Metric</span>
        </div>
        <div className="platform-admin-event-list">
          {dashboard.records.map((record) => (
            <article key={record.id} className="platform-admin-event-row">
              <div>
                <strong>{record.title}</strong>
                <small>{record.subtitle}</small>
              </div>
              <span className="platform-status" style={{ color: toneColor[record.tone ?? "teal"], background: `${toneColor[record.tone ?? "teal"]}14` }}>
                {record.status}
              </span>
              <span className="platform-admin-event-meta" data-label="Owner">{record.owner}</span>
              <span className="platform-admin-event-meta" data-label="Due">{record.due}</span>
              <span className="platform-admin-event-meta" data-label="Metric">{record.metric}</span>
            </article>
          ))}
        </div>
      </motion.section>
    </PlatformShell>
  );
}

function SuperAdminDashboard() {
  const dashboard = dashboardByRole.superadmin;
  const meta = roleMeta.superadmin;
  const state = useMemo(() => platformStore.getState(), []);
  const permissionCount = rolePermissions.superadmin.length;
  const navCount = sidebarByRole.superadmin.length;
  const activeUsers = state.users.filter((user) => user.status === "active").length;
  const activeStudents = state.students.filter((student) => student.status === "active").length;
  const activeClasses = state.classGroups.length;
  const connectedIntegrations = state.integrations.filter((integration) => integration.status === "connected").length;
  const usableIntegrations = state.integrations.filter((integration) => integration.status === "connected" || integration.status === "mock_mode").length;
  const pendingInvoices = state.invoices.filter((invoice) => invoice.status !== "paid" && invoice.status !== "cancelled").length;
  const platformEntityTotal =
    state.users.length +
    state.branches.length +
    state.departments.length +
    state.programs.length +
    state.courses.length +
    state.courseRuns.length +
    state.classGroups.length +
    state.enrollments.length +
    state.events.length +
    state.auditLogs.length;
  const integrationReadiness = state.integrations.length
    ? Math.round((usableIntegrations / state.integrations.length) * 100)
    : 0;
  const superAdminStats: Stat[] = [
    { label: "Users in state", value: `${activeUsers}/${state.users.length}`, change: "active accounts", tone: "teal" },
    { label: "Active learners", value: String(activeStudents), change: `${state.enrollments.length} enrollments`, tone: "green" },
    { label: "Class groups", value: String(activeClasses), change: `${state.events.length} scheduled events`, tone: "amber" },
    { label: "Integration readiness", value: `${integrationReadiness}%`, change: `${connectedIntegrations} connected`, tone: "purple" },
  ];
  const capabilities: AdminCapability[] = [
    {
      label: "Identity and users",
      description: "Create staff, assign roles, pause accounts, and inspect branch/department scope.",
      metric: `${state.users.length} accounts`,
      href: "/app/admin/users",
      Icon: Users,
      tone: "teal",
    },
    {
      label: "Roles and permissions",
      description: "Control who can read, edit, approve, report, message, and audit each module.",
      metric: `${permissionCount} permissions`,
      href: "/app/admin/roles",
      Icon: ShieldCheck,
      tone: "amber",
    },
    {
      label: "Branch network",
      description: "Review global branches, departments, rooms, and operational ownership.",
      metric: `${state.branches.length} branches`,
      href: "/app/admin/branches",
      Icon: Building2,
      tone: "green",
    },
    {
      label: "Programs and courses",
      description: "Govern Arabic, Quran, language, kids, and teacher-training course catalogs.",
      metric: `${state.courses.length} courses`,
      href: "/app/admin/courses",
      Icon: BookOpen,
      tone: "purple",
    },
    {
      label: "Moodle source",
      description: "Track observed Moodle course sections, activities, and future sync coverage.",
      metric: `${state.modules.length} modules`,
      href: "/app/admin/moodle-source",
      Icon: Database,
      tone: "slate",
    },
    {
      label: "Audit and health",
      description: "Open audit evidence, connector readiness, settings, and system health checks.",
      metric: `${state.auditLogs.length} audit rows`,
      href: "/app/admin/system-health",
      Icon: Activity,
      tone: "red",
    },
  ];
  const hierarchy = [
    {
      label: "Global governance",
      detail: "Super Admin owns platform settings, RBAC, audit evidence, and connector boundaries.",
      metric: `${navCount} admin workspaces`,
      href: "/app/admin/platform-blueprint",
      Icon: Network,
      tone: "slate" as Stat["tone"],
    },
    {
      label: "Academic ownership",
      detail: "Departments, programs, levels, courses, curriculum, certificates, and Moodle source.",
      metric: `${state.departments.length} departments · ${state.programs.length} programs`,
      href: "/app/admin/departments",
      Icon: Library,
      tone: "purple" as Stat["tone"],
    },
    {
      label: "Branch operations",
      detail: "Branches, rooms, branch classes, attendance exceptions, payments, and local schedules.",
      metric: `${state.branches.length} branches · ${state.rooms.length} rooms`,
      href: "/app/admin/branches",
      Icon: Building2,
      tone: "green" as Stat["tone"],
    },
    {
      label: "Admissions and finance",
      detail: "Leads, placement tests, enrollment workflows, invoices, payment records, and reports.",
      metric: `${state.leads.length} lead · ${pendingInvoices} pending invoices`,
      href: "/app/admin/reports",
      Icon: ScrollText,
      tone: "amber" as Stat["tone"],
    },
    {
      label: "Teaching delivery",
      detail: "Teachers, course runs, class groups, resources, assessments, Quran review, and messages.",
      metric: `${state.teachers.length} teacher · ${state.classGroups.length} classes`,
      href: "/app/admin/moodle-source",
      Icon: GraduationCap,
      tone: "teal" as Stat["tone"],
    },
  ];

  return (
    <PlatformShell role="superadmin" title="Dashboard">
      <PlatformPageHeader
        compact
        title={dashboard.title}
        description={dashboard.subtitle}
        actions={
          <>
          <Link href="/app/admin/reports" className="platform-secondary-button">
            Reports
          </Link>
          <Link href="/app/admin/users" className="platform-primary-button" style={{ background: meta.color }}>
            <Plus size={15} />
            Quick create
          </Link>
          </>
        }
      />

      <motion.div className="platform-admin-status-strip" initial="hidden" animate="visible">
        {[
          ["Scope", "Global platform"],
          ["Admin modules", `${navCount} workspaces`],
          ["RBAC coverage", `${permissionCount} permissions`],
          ["Data state", `${platformEntityTotal} local records`],
        ].map(([label, value], index) => (
          <motion.article key={label} custom={0.03 + index * 0.035} variants={dashboardReveal}>
            <span>{label}</span>
            <strong>{value}</strong>
          </motion.article>
        ))}
      </motion.div>

      <motion.div className="platform-metric-grid platform-admin-metric-grid" initial="hidden" animate="visible">
        {superAdminStats.map((stat, index) => (
          <motion.article key={stat.label} className="platform-metric" custom={0.07 + index * 0.045} variants={dashboardReveal}>
            <div>
              <span>{stat.label}</span>
              <strong>{stat.value}</strong>
            </div>
            <small style={{ color: toneColor[stat.tone], background: `${toneColor[stat.tone]}14` }}>{stat.change}</small>
          </motion.article>
        ))}
      </motion.div>

      <motion.section className="platform-admin-hierarchy" initial="hidden" animate="visible" custom={0.12} variants={dashboardReveal}>
        <div className="platform-card-title compact">
          <div>
            <span>Platform hierarchy</span>
            <strong>Administration operating map</strong>
          </div>
          <Link href="/app/admin/platform-blueprint" className="platform-secondary-button compact">
            Blueprint
          </Link>
        </div>
        <div className="platform-admin-hierarchy-grid">
          {hierarchy.map((item, index) => (
            <Link
              key={item.label}
              href={item.href}
              className="platform-admin-hierarchy-card"
              style={{ "--item-color": toneColor[item.tone] } as CSSProperties}
            >
              <span className="platform-admin-hierarchy-index">{String(index + 1).padStart(2, "0")}</span>
              <span className="platform-admin-hierarchy-icon">
                <item.Icon size={17} />
              </span>
              <div>
                <small>{item.metric}</small>
                <strong>{item.label}</strong>
                <p>{item.detail}</p>
              </div>
              <ArrowRight size={15} />
            </Link>
          ))}
        </div>
      </motion.section>

      <motion.div className="platform-admin-layout" initial="hidden" animate="visible" custom={0.16} variants={dashboardReveal}>
        <section className="platform-admin-command">
          <div className="platform-admin-command-copy">
            <span>Governance command center</span>
            <h2>Govern people, academic structure, branch operations, integrations, and audit evidence from one controlled surface.</h2>
            <p>Every tile opens the module that owns the decision, so administration stays fast without hiding accountability.</p>
          </div>

          <div className="platform-admin-command-grid">
            {[
              { label: "Identity", value: `${activeUsers}/${state.users.length}`, color: toneColor.teal },
              { label: "RBAC", value: `${permissionCount}`, color: toneColor.amber },
              { label: "Integrations", value: `${usableIntegrations}/${state.integrations.length}`, color: toneColor.purple },
            ].map((item) => (
              <article key={item.label} style={{ "--item-color": item.color } as CSSProperties}>
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </article>
            ))}
          </div>

          <div className="platform-admin-command-actions">
            <Link href="/app/admin/platform-blueprint" className="platform-secondary-button">
              <Network size={15} />
              Blueprint
            </Link>
            <Link href="/app/admin/integrations" className="platform-primary-button" style={{ background: meta.color }}>
              {dashboard.spotlight.action}
              <ArrowRight size={15} />
            </Link>
          </div>
        </section>

        <aside className="platform-admin-action-panel">
          <div className="platform-card-title compact">
            <div>
              <span>Role tools</span>
              <strong>Quick actions</strong>
            </div>
          </div>
          <div className="platform-admin-action-list">
            {adminQuickActions.map((action) => (
              <Link key={action.label} href={action.href}>
                <span>
                  <action.Icon size={16} />
                </span>
                <span>
                  <strong>{action.label}</strong>
                  <small>{action.description}</small>
                </span>
                <ArrowRight size={15} />
              </Link>
            ))}
          </div>
        </aside>
      </motion.div>

      <motion.section className="platform-admin-capability-grid" initial="hidden" animate="visible" custom={0.2} variants={dashboardReveal}>
        {capabilities.map((item) => (
          <Link key={item.label} href={item.href} className="platform-admin-capability-card" style={{ "--item-color": toneColor[item.tone] } as CSSProperties}>
            <span>
              <item.Icon size={18} />
            </span>
            <div>
              <small>{item.metric}</small>
              <strong>{item.label}</strong>
              <p>{item.description}</p>
            </div>
            <ArrowRight size={15} />
          </Link>
        ))}
      </motion.section>

      <motion.section className="platform-admin-event-board" initial="hidden" animate="visible" custom={0.24} variants={dashboardReveal}>
        <div className="platform-card-title compact">
          <div>
            <span>Live governance stream</span>
            <strong>Today</strong>
          </div>
          <Link href="/app/admin/audit-logs" className="platform-secondary-button compact">
            Audit logs
          </Link>
        </div>
        <div className="platform-admin-event-head" aria-hidden="true">
          <span>Item</span>
          <span>Status</span>
          <span>Owner</span>
          <span>Due</span>
          <span>Metric</span>
        </div>
        <div className="platform-admin-event-list">
          {dashboard.records.map((record) => (
            <article key={record.id} className="platform-admin-event-row">
              <div>
                <strong>{record.title}</strong>
                <small>{record.subtitle}</small>
              </div>
              <span className="platform-status" style={{ color: toneColor[record.tone ?? "teal"], background: `${toneColor[record.tone ?? "teal"]}14` }}>
                {record.status}
              </span>
              <span className="platform-admin-event-meta" data-label="Owner">{record.owner}</span>
              <span className="platform-admin-event-meta" data-label="Due">{record.due}</span>
              <span className="platform-admin-event-meta" data-label="Metric">{record.metric}</span>
            </article>
          ))}
        </div>
      </motion.section>
    </PlatformShell>
  );
}
