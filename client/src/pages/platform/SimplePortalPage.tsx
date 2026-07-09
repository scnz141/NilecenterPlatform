import { useMemo, useState } from "react";
import { ArrowRight, Building2, CheckCircle2, Search } from "lucide-react";
import { Link } from "wouter";
import PlatformShell from "@/components/platform/PlatformShell";
import { WorkspaceLayout } from "@/components/platform/PlatformLayouts";
import {
  DataTableCard,
  StatusBadge,
} from "@/components/platform/PlatformPrimitives";
import { runPlatformWorkflowActionRequest } from "@/lib/backend/api";
import { platformStore } from "@/lib/domain/store";
import type { EntityStatus } from "@/lib/domain/types";
import {
  getPageConfig,
  roleMeta,
  roleOrder,
  rolePermissions,
  type Role,
} from "@/lib/platformData";

type SimplePortalPageProps = {
  role: Role;
  pageId: string;
};

type SimpleRow = {
  id: string;
  title: string;
  subtitle: string;
  meta: string;
  status: string;
  metric: string;
  href?: string;
};

function humanize(value?: string) {
  if (!value) return "Not set";
  return value
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, character => character.toUpperCase());
}

function formatDate(value?: string) {
  if (!value) return "Not scheduled";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function statusTone(status: string): "green" | "amber" | "red" | "slate" {
  const normalized = status.toLowerCase();
  if (
    ["active", "paid", "approved", "issued", "completed", "present"].includes(
      normalized
    )
  )
    return "green";
  if (
    [
      "pending",
      "draft",
      "ready_to_enroll",
      "placement_booked",
      "issued",
    ].includes(normalized)
  )
    return "amber";
  if (
    [
      "overdue",
      "rejected",
      "paused",
      "cancelled",
      "revoked",
      "absent",
    ].includes(normalized)
  )
    return "red";
  return "slate";
}

function basePathFor(role: Role) {
  if (role === "headofdepartment") return "/app/hod";
  if (role === "branchadmin") return "/app/branch";
  if (role === "superadmin") return "/app/admin";
  return `/app/${role}`;
}

function primaryActionFor(role: Role, pageId: string) {
  if (role === "student") {
    if (pageId === "courses") return "Continue learning";
    if (pageId === "messages") return "New message";
    return "Open";
  }
  if (pageId === "messages") return "New message";
  if (pageId === "leads") return "Create lead";
  if (pageId === "applications") return "Create application";
  if (pageId === "placement-tests") return "Book placement";
  if (pageId === "students") return "Create student";
  if (pageId === "teachers") return "Add teacher";
  if (pageId === "classes") return "Create class";
  if (pageId === "rooms") return "Create room";
  if (pageId === "payments") return "Record payment";
  if (["departments", "programs", "courses", "levels"].includes(pageId))
    return "Add item";
  return "Create";
}

function subtitleFor(role: Role, pageId: string, fallback: string) {
  if (role === "student" && pageId === "courses")
    return "Find your courses and continue the next lesson.";
  if (role === "student" && pageId === "assignments")
    return "Find assigned work and open what needs attention.";
  if (role === "student" && pageId === "quizzes")
    return "Find quizzes and review your attempts.";
  if (role === "student" && pageId === "calendar")
    return "See upcoming classes, due dates, and events.";
  if (pageId === "branches")
    return "Find branches and review their local operations.";
  if (pageId === "certificates") return "Find issued and pending certificates.";
  if (pageId === "permissions") return "Review access rules by role.";
  if (pageId === "departments")
    return "Find departments and their academic owners.";
  if (pageId === "programs") return "Find programs and their course groups.";
  if (pageId === "teachers") return "Find teachers and their assigned work.";
  if (pageId === "classes") return "Find classes and open the right workspace.";
  const firstSentence = fallback.split(".")[0]?.trim();
  return firstSentence || "Find records and open the next task.";
}

function buildRows(role: Role, pageId: string): SimpleRow[] {
  const state = platformStore.getState();
  const basePath = basePathFor(role);
  const branchName = (branchId?: string) =>
    state.branches.find(branch => branch.id === branchId)?.name ?? "No branch";
  const departmentName = (departmentId?: string) =>
    state.departments.find(department => department.id === departmentId)
      ?.name ?? "No department";
  const userName = (userId?: string) =>
    state.users.find(user => user.id === userId)?.name ?? "Unassigned";
  const courseTitle = (courseId?: string) =>
    state.courses.find(course => course.id === courseId)?.title ?? "Course";
  const className = (classGroupId?: string) =>
    state.classGroups.find(group => group.id === classGroupId)?.name ??
    "No class";

  if (pageId === "courses") {
    return state.courses.map(course => {
      const program = state.programs.find(item => item.id === course.programId);
      const level = state.levels.find(item => item.id === course.levelId);
      return {
        id: course.id,
        title: course.title,
        subtitle: program?.title ?? "Program",
        meta: level?.title ?? "Level not set",
        status: course.status,
        metric: `${state.modules.filter(module => module.courseId === course.id).length} modules`,
        href:
          role === "student" ? `${basePath}/courses/${course.id}` : undefined,
      };
    });
  }

  if (pageId === "assignments") {
    return state.assignments.map(assignment => {
      const run = state.courseRuns.find(
        item => item.id === assignment.courseRunId
      );
      const submissions = state.assignmentSubmissions.filter(
        item => item.assignmentId === assignment.id
      );
      return {
        id: assignment.id,
        title: assignment.title,
        subtitle: courseTitle(run?.courseId),
        meta: `Due ${formatDate(assignment.dueAt)}`,
        status: assignment.status,
        metric: `${submissions.length} submissions`,
        href:
          role === "student"
            ? `${basePath}/assignments/${assignment.id}`
            : undefined,
      };
    });
  }

  if (pageId === "quizzes") {
    return state.quizzes.map(quiz => {
      const run = state.courseRuns.find(item => item.id === quiz.courseRunId);
      const attempts = state.quizAttempts.filter(
        item => item.quizId === quiz.id
      );
      return {
        id: quiz.id,
        title: quiz.title,
        subtitle: courseTitle(run?.courseId),
        meta: `Due ${formatDate(quiz.dueAt)}`,
        status: quiz.status,
        metric: `${attempts.length} attempts`,
        href: role === "student" ? `${basePath}/quizzes/${quiz.id}` : undefined,
      };
    });
  }

  if (pageId === "grades") {
    return state.grades.map(grade => ({
      id: grade.id,
      title: grade.itemTitle,
      subtitle: userName(
        state.students.find(student => student.id === grade.studentId)?.userId
      ),
      meta: courseTitle(
        state.courseRuns.find(run => run.id === grade.courseRunId)?.courseId
      ),
      status: grade.score >= grade.maxScore * 0.8 ? "strong" : "review",
      metric: `${grade.score}/${grade.maxScore}`,
    }));
  }

  if (pageId === "attendance") {
    return state.attendance.map(record => ({
      id: record.id,
      title: userName(
        state.students.find(student => student.id === record.studentId)?.userId
      ),
      subtitle: className(record.classGroupId),
      meta:
        state.classSessions.find(session => session.id === record.sessionId)
          ?.title ?? "Session",
      status: record.status,
      metric: record.notes ?? "Recorded",
    }));
  }

  if (pageId === "calendar" || pageId === "schedule") {
    return state.events.map(event => ({
      id: event.id,
      title: event.title,
      subtitle: humanize(event.type),
      meta: `${formatDate(event.startsAt)} · ${branchName(event.branchId)}`,
      status: event.status,
      metric: className(event.classGroupId),
    }));
  }

  if (pageId === "students") {
    return state.students.map(student => {
      const user = state.users.find(item => item.id === student.userId);
      const enrollment = state.enrollments.find(
        item => item.studentId === student.id
      );
      return {
        id: student.id,
        title: user?.name ?? "Student",
        subtitle: user?.email ?? student.country,
        meta: enrollment
          ? className(enrollment.classGroupId)
          : (student.currentLevel ?? "No class"),
        status: student.status,
        metric: enrollment
          ? `${enrollment.progress}% progress`
          : humanize(student.source),
        href:
          role === "registrar"
            ? `${basePath}/students/${student.id}`
            : undefined,
      };
    });
  }

  if (pageId === "teachers") {
    return state.teachers.map(teacher => ({
      id: teacher.id,
      title: userName(teacher.userId),
      subtitle: departmentName(teacher.departmentId),
      meta: branchName(teacher.branchId),
      status: teacher.status,
      metric: `${teacher.assignedClassIds.length} classes`,
    }));
  }

  if (pageId === "classes") {
    return state.classGroups.map(group => {
      const run = state.courseRuns.find(item => item.id === group.courseRunId);
      return {
        id: group.id,
        title: group.name,
        subtitle: courseTitle(run?.courseId),
        meta: group.schedule,
        status: run?.status ?? "active",
        metric: `${group.studentIds.length}/${group.capacity} learners`,
      };
    });
  }

  if (pageId === "leads") {
    return state.leads.map(lead => ({
      id: lead.id,
      title: lead.fullName,
      subtitle: lead.subject,
      meta: `${lead.phone} · ${lead.country ?? "Country not set"}`,
      status: lead.status,
      metric: formatDate(lead.createdAt),
      href: `${basePath}/leads/${lead.id}`,
    }));
  }

  if (pageId === "applications") {
    return state.applications.map(application => {
      const lead = state.leads.find(item => item.id === application.leadId);
      return {
        id: application.id,
        title: lead?.fullName ?? "Application",
        subtitle: application.courseInterest,
        meta: branchName(application.branchId),
        status: application.status,
        metric: application.schedulePreference,
        href: `${basePath}/applications/${application.id}`,
      };
    });
  }

  if (pageId === "placement-tests") {
    return state.placementTests.map(test => ({
      id: test.id,
      title: test.fullName,
      subtitle: test.subject,
      meta: branchName(test.branchId),
      status: test.status,
      metric: formatDate(test.preferredDate),
      href: `${basePath}/placement-tests/${test.id}`,
    }));
  }

  if (pageId === "enrollments") {
    return state.enrollments.map(enrollment => ({
      id: enrollment.id,
      title: userName(
        state.students.find(student => student.id === enrollment.studentId)
          ?.userId
      ),
      subtitle: courseTitle(
        state.courseRuns.find(run => run.id === enrollment.courseRunId)
          ?.courseId
      ),
      meta: className(enrollment.classGroupId),
      status: enrollment.status,
      metric: `${enrollment.progress}% progress`,
    }));
  }

  if (pageId === "payments") {
    return state.invoices.map(invoice => {
      const payment = state.payments.find(
        item => item.invoiceId === invoice.id
      );
      return {
        id: invoice.id,
        title: userName(
          state.students.find(student => student.id === invoice.studentId)
            ?.userId
        ),
        subtitle: `${invoice.currency} ${invoice.amount.toLocaleString()}`,
        meta: `Due ${formatDate(invoice.dueAt)}`,
        status: payment?.status ?? invoice.status,
        metric: payment?.method ? humanize(payment.method) : "Awaiting payment",
      };
    });
  }

  if (pageId === "rooms") {
    return state.rooms.map(room => ({
      id: room.id,
      title: room.name,
      subtitle: branchName(room.branchId),
      meta: `${room.capacity} seats`,
      status: room.status,
      metric: room.equipment.slice(0, 2).join(", ") || "Basic room",
    }));
  }

  if (pageId === "branches") {
    return state.branches.map(branch => ({
      id: branch.id,
      title: branch.name,
      subtitle: `${branch.code} · ${branch.timezone}`,
      meta: `${state.users.filter(user => user.branchId === branch.id).length} users`,
      status: branch.status,
      metric: `${state.rooms.filter(room => room.branchId === branch.id).length} rooms`,
    }));
  }

  if (pageId === "departments") {
    return state.departments.map(department => ({
      id: department.id,
      title: department.name,
      subtitle: userName(department.ownerUserId),
      meta: `${department.branchIds.length} branches`,
      status: department.status,
      metric: `${state.programs.filter(program => program.departmentId === department.id).length} programs`,
    }));
  }

  if (pageId === "permissions") {
    return roleOrder.map(role => ({
      id: role,
      title: roleMeta[role].label,
      subtitle: "Access rules",
      meta:
        role === "superadmin" ? "All workspaces" : roleMeta[role].branchLabel,
      status: "active",
      metric: `${rolePermissions[role].length} rules`,
    }));
  }

  if (pageId === "programs") {
    return state.programs.map(program => ({
      id: program.id,
      title: program.title,
      subtitle: program.category,
      meta: departmentName(program.departmentId),
      status: program.status,
      metric: `${state.courses.filter(course => course.programId === program.id).length} courses`,
    }));
  }

  if (pageId === "levels") {
    return state.levels.map(level => ({
      id: level.id,
      title: level.title,
      subtitle:
        state.programs.find(program => program.id === level.programId)?.title ??
        "Program",
      meta: `Level ${level.order}`,
      status: "active",
      metric: `${level.completionRules.length} rules`,
    }));
  }

  if (pageId === "curriculum") {
    return state.modules.map(module => ({
      id: module.id,
      title: module.title,
      subtitle: courseTitle(module.courseId),
      meta: `Module ${module.order}`,
      status: "active",
      metric: `${state.lessons.filter(lesson => lesson.moduleId === module.id).length} lessons`,
    }));
  }

  if (pageId === "messages") {
    return state.messages.map(message => ({
      id: message.id,
      title: message.subject,
      subtitle: userName(message.fromUserId),
      meta: message.body,
      status: message.read ? "read" : "unread",
      metric: formatDate(message.createdAt),
    }));
  }

  if (pageId === "reports") {
    return state.reportPresets
      .filter(preset => preset.role === role || role === "superadmin")
      .map(preset => ({
        id: preset.id,
        title: preset.label,
        subtitle: humanize(preset.reportType),
        meta: preset.search || "All records",
        status: preset.status || "ready",
        metric: `${preset.rowCount} rows`,
      }));
  }

  if (pageId === "certificates") {
    return state.certificates.map(certificate => ({
      id: certificate.id,
      title: userName(
        state.students.find(student => student.id === certificate.studentId)
          ?.userId
      ),
      subtitle: courseTitle(certificate.courseId),
      meta: certificate.verificationCode,
      status: certificate.status,
      metric: `${certificate.grade}% grade`,
    }));
  }

  const config = getPageConfig(role, pageId);
  return config.records.map(record => ({
    id: record.id,
    title: record.title,
    subtitle: record.subtitle,
    meta: record.owner,
    status: record.status,
    metric: record.metric,
  }));
}

const branchStatuses: EntityStatus[] = ["active", "paused", "pending"];

function AdminBranchesPage() {
  const [version, setVersion] = useState(0);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [savingBranchId, setSavingBranchId] = useState<string | null>(null);
  const [result, setResult] = useState<{
    tone: "success" | "error";
    title: string;
    detail: string;
  } | null>(null);
  const state = useMemo(() => platformStore.getState(), [version]);
  const rows = state.branches.map(branch => {
    const userCount = state.users.filter(
      user => user.branchId === branch.id
    ).length;
    const roomCount = state.rooms.filter(
      room => room.branchId === branch.id
    ).length;
    const classCount = state.classGroups.filter(group => {
      const run = state.courseRuns.find(item => item.id === group.courseRunId);
      return run?.branchId === branch.id;
    }).length;
    return {
      branch,
      userCount,
      roomCount,
      classCount,
      searchText:
        `${branch.name} ${branch.code} ${branch.address} ${branch.timezone} ${branch.status} ${userCount} ${classCount}`.toLowerCase(),
    };
  });
  const statuses = Array.from(
    new Set(rows.map(row => row.branch.status))
  ).filter(Boolean);
  const filteredRows = rows.filter(row => {
    const matchesQuery =
      !query.trim() || row.searchText.includes(query.trim().toLowerCase());
    const matchesStatus = status === "all" || row.branch.status === status;
    return matchesQuery && matchesStatus;
  });
  const activeCount = state.branches.filter(
    branch => branch.status === "active"
  ).length;
  const classCount = state.classGroups.filter(group =>
    state.courseRuns.some(
      run => run.id === group.courseRunId && run.branchId !== "br_global"
    )
  ).length;

  const updateBranchStatus = async (
    branchId: string,
    nextStatus: EntityStatus
  ) => {
    const branch = state.branches.find(item => item.id === branchId);
    if (!branch || branch.status === nextStatus || savingBranchId) return;
    setSavingBranchId(branchId);
    setResult(null);
    const response = await runPlatformWorkflowActionRequest({
      type: "branch.update",
      branchId,
      status: nextStatus,
    });
    setSavingBranchId(null);
    if (!response.ok || !response.data) {
      setResult({
        tone: "error",
        title: "Branch status was not saved",
        detail: response.error ?? "Try again or review your session.",
      });
      return;
    }
    platformStore.setState(response.data.state);
    setVersion(value => value + 1);
    setResult({
      tone: "success",
      title: "Branch status saved",
      detail: `${branch.name} is now ${humanize(nextStatus).toLowerCase()}.`,
    });
  };

  return (
    <PlatformShell role="superadmin" title="Branches">
      <WorkspaceLayout
        className="admin-branches-page"
        title="Branches"
        description="Manage branch status and review local operations."
        context="Admin"
        toolbar={
          <div className="simple-portal-toolbar admin-branches-toolbar">
            <label>
              Search
              <span>
                <Search size={15} />
                <input
                  value={query}
                  onChange={event => setQuery(event.target.value)}
                  placeholder="Search branches"
                  data-testid="branch-search"
                />
              </span>
            </label>
            <label>
              Status
              <select
                value={status}
                onChange={event => setStatus(event.target.value)}
                data-testid="branch-status-filter"
              >
                <option value="all">All statuses</option>
                {statuses.map(item => (
                  <option key={item} value={item}>
                    {humanize(item)}
                  </option>
                ))}
              </select>
            </label>
          </div>
        }
        main={
          <section
            className="admin-branches-main"
            data-testid="admin-branches-page"
          >
            {result ? (
              <div
                className={`admin-branches-result ${result.tone}`}
                data-testid="branch-result"
                role={result.tone === "error" ? "alert" : "status"}
              >
                <strong>{result.title}</strong>
                <span>{result.detail}</span>
              </div>
            ) : null}
            <DataTableCard
              title="Branch access"
              subtitle={`${filteredRows.length} branches`}
            >
              <table className="admin-branches-table">
                <thead>
                  <tr>
                    <th>Branch</th>
                    <th>Local summary</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.length ? (
                    filteredRows.map(row => (
                      <tr
                        key={row.branch.id}
                        data-testid={`branch-row-${row.branch.id}`}
                      >
                        <td>
                          <strong>{row.branch.name}</strong>
                          <small>
                            {row.branch.code} ·{" "}
                            {row.branch.address || row.branch.timezone}
                          </small>
                        </td>
                        <td>
                          <strong>
                            {row.userCount} users · {row.classCount} classes
                          </strong>
                          <small>
                            {row.roomCount} rooms · {row.branch.timezone}
                          </small>
                        </td>
                        <td>
                          <StatusBadge tone={statusTone(row.branch.status)}>
                            {humanize(row.branch.status)}
                          </StatusBadge>
                        </td>
                        <td>
                          <select
                            value={row.branch.status}
                            disabled={Boolean(savingBranchId)}
                            data-testid={`branch-status-${row.branch.id}`}
                            aria-label={`${row.branch.name} status`}
                            onChange={event =>
                              void updateBranchStatus(
                                row.branch.id,
                                event.target.value as EntityStatus
                              )
                            }
                          >
                            {branchStatuses.map(item => (
                              <option key={item} value={item}>
                                {humanize(item)}
                              </option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4}>
                        <strong>No branches found</strong>
                        <small>Try a different search or status filter.</small>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </DataTableCard>
          </section>
        }
        side={
          <aside className="admin-branches-side">
            <div className="admin-branches-side-head">
              <span>
                <Building2 size={16} />
              </span>
              <div>
                <strong>Branch management</strong>
                <p>
                  Keep each branch status current. Changes are saved to
                  Activity.
                </p>
              </div>
            </div>
            <div className="admin-branches-side-stats">
              <div>
                <span>Active branches</span>
                <strong>
                  {activeCount}/{state.branches.length}
                </strong>
              </div>
              <div>
                <span>Class groups</span>
                <strong>{classCount}</strong>
              </div>
              <div>
                <span>Local users</span>
                <strong>
                  {
                    state.users.filter(user => user.branchId !== "br_global")
                      .length
                  }
                </strong>
              </div>
            </div>
            {result?.tone === "success" ? (
              <div className="admin-branches-side-note">
                <CheckCircle2 size={15} />
                <span>{result.title}</span>
              </div>
            ) : null}
          </aside>
        }
      />
    </PlatformShell>
  );
}

function GenericSimplePortalPage({ role, pageId }: SimplePortalPageProps) {
  const config = getPageConfig(role, pageId);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const rows = useMemo(() => buildRows(role, pageId), [role, pageId]);
  const statuses = useMemo(
    () => Array.from(new Set(rows.map(row => row.status))).filter(Boolean),
    [rows]
  );
  const filteredRows = rows.filter(row => {
    const text =
      `${row.title} ${row.subtitle} ${row.meta} ${row.status} ${row.metric}`.toLowerCase();
    return (
      (!query.trim() || text.includes(query.trim().toLowerCase())) &&
      (status === "all" || row.status === status)
    );
  });
  const primaryRow = filteredRows[0] ?? rows[0];
  const roleLabel = roleMeta[role].shortLabel;
  const actionHref = primaryRow?.href;
  const hasOpenableRows = filteredRows.some(row => Boolean(row.href));

  return (
    <PlatformShell role={role} title={config.title}>
      <WorkspaceLayout
        className="simple-portal-page"
        title={config.title}
        description={subtitleFor(role, pageId, config.description)}
        context={roleLabel}
        actions={
          actionHref ? (
            <Link className="platform-primary-button" href={actionHref}>
              {primaryActionFor(role, pageId)}
              <ArrowRight size={15} />
            </Link>
          ) : null
        }
        toolbar={
          <div className="simple-portal-toolbar">
            <label>
              Search
              <span>
                <Search size={15} />
                <input
                  value={query}
                  onChange={event => setQuery(event.target.value)}
                  placeholder={`Search ${config.title.toLowerCase()}`}
                />
              </span>
            </label>
            <label>
              Status
              <select
                value={status}
                onChange={event => setStatus(event.target.value)}
              >
                <option value="all">All statuses</option>
                {statuses.slice(0, 8).map(item => (
                  <option key={item} value={item}>
                    {humanize(item)}
                  </option>
                ))}
              </select>
            </label>
          </div>
        }
        main={
          <DataTableCard
            title={config.title}
            subtitle={`${filteredRows.length} records`}
          >
            <table className="simple-portal-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Scope</th>
                  <th>Status</th>
                  {hasOpenableRows ? <th>Action</th> : null}
                </tr>
              </thead>
              <tbody>
                {filteredRows.length ? (
                  filteredRows.map(row => (
                    <tr key={row.id}>
                      <td>
                        <strong>{row.title}</strong>
                        <small>{row.subtitle}</small>
                      </td>
                      <td>
                        <strong>{row.meta}</strong>
                        <small>{row.metric}</small>
                      </td>
                      <td>
                        <StatusBadge tone={statusTone(row.status)}>
                          {humanize(row.status)}
                        </StatusBadge>
                      </td>
                      {hasOpenableRows ? (
                        <td>
                          {row.href ? (
                            <Link
                              className="simple-portal-row-action"
                              href={row.href}
                            >
                              Open
                              <ArrowRight size={14} />
                            </Link>
                          ) : (
                            <span className="simple-portal-muted-action">
                              View
                            </span>
                          )}
                        </td>
                      ) : null}
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={hasOpenableRows ? 4 : 3}>
                      <strong>No records found</strong>
                      <small>Try a different search or status filter.</small>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </DataTableCard>
        }
      />
    </PlatformShell>
  );
}

export default function SimplePortalPage(props: SimplePortalPageProps) {
  if (props.role === "superadmin" && props.pageId === "branches") {
    return <AdminBranchesPage />;
  }
  return <GenericSimplePortalPage {...props} />;
}
