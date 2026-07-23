import { requireActiveUser } from "@/lib/auth/session";
import { useMemo, useState } from "react";
import { ArrowRight, Plus, Search } from "lucide-react";
import { Link } from "wouter";
import OperationalDirectoryTable from "@/components/platform/OperationalDirectoryTable";
import PlatformShell from "@/components/platform/PlatformShell";
import { WorkspaceLayout } from "@/components/platform/PlatformLayouts";
import {
  DataTableCard,
  StatusBadge,
} from "@/components/platform/PlatformPrimitives";
import { platformStore } from "@/lib/domain/store";

type HodDirectoryView =
  | "departments"
  | "programs"
  | "levels"
  | "teachers"
  | "classes";

type DirectoryRow = {
  id: string;
  name: string;
  detail: string;
  scope: string;
  status: string;
  metric: string;
  href?: string;
};

const viewCopy: Record<
  HodDirectoryView,
  { title: string; description: string; empty: string; action?: string }
> = {
  departments: {
    title: "Departments",
    description: "Review academic departments in your scope.",
    empty: "No departments found.",
    action: "Open programs",
  },
  programs: {
    title: "Programs",
    description: "Find programs owned by your departments.",
    empty: "No programs found.",
    action: "Open courses",
  },
  levels: {
    title: "Levels",
    description: "Review level order and completion rules.",
    empty: "No levels found.",
    action: "Open curriculum",
  },
  teachers: {
    title: "Teachers",
    description: "Review teachers connected to your departments.",
    empty: "No teachers found.",
    action: "Message team",
  },
  classes: {
    title: "Classes",
    description: "Find academic classes and their delivery scope.",
    empty: "No classes found.",
    action: "Open schedule",
  },
};

function humanize(value?: string) {
  if (!value) return "Not set";
  return value
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, character => character.toUpperCase());
}

function statusTone(status: string): "green" | "amber" | "red" | "slate" {
  if (status === "active" || status === "completed" || status === "available")
    return "green";
  if (status === "pending" || status === "draft" || status === "limited")
    return "amber";
  if (
    status === "paused" ||
    status === "cancelled" ||
    status === "overdue" ||
    status === "unavailable"
  )
    return "red";
  return "slate";
}

function actionHref(view: HodDirectoryView) {
  if (view === "departments") return "/app/hod/programs";
  if (view === "programs") return "/app/hod/courses";
  if (view === "levels") return "/app/hod/curriculum";
  if (view === "teachers") return "/app/hod/messages";
  return "/app/hod/schedule";
}

export default function HodDirectoryPage({ view }: { view: HodDirectoryView }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const state = useMemo(() => platformStore.getState(), []);
  const actorId = requireActiveUser("headofdepartment").id;
  const actor = state.users.find(user => user.id === actorId);
  const academicDepartments = state.departments.filter(
    department =>
      department.ownerUserId === actorId ||
      department.id === actor?.departmentId
  );
  const departmentIds = new Set(academicDepartments.map(item => item.id));
  const scopedPrograms = state.programs.filter(program =>
    departmentIds.has(program.departmentId)
  );
  const scopedProgramIds = new Set(scopedPrograms.map(program => program.id));
  const scopedCourses = state.courses.filter(course =>
    scopedProgramIds.has(course.programId)
  );
  const scopedCourseIds = new Set(scopedCourses.map(course => course.id));
  const scopedRuns = state.courseRuns.filter(run =>
    scopedCourseIds.has(run.courseId)
  );
  const scopedRunIds = new Set(scopedRuns.map(run => run.id));
  const copy = viewCopy[view];
  const primaryAction =
    view === "classes" ? (
      <div className="platform-page-actions">
        <Link className="platform-secondary-button" href="/app/hod/schedule">
          Open schedule
          <ArrowRight size={15} />
        </Link>
        <Link
          className="platform-primary-button"
          href="/app/hod/classes/runs/new"
        >
          <Plus size={15} />
          New course run
        </Link>
      </div>
    ) : copy.action ? (
      <Link className="platform-primary-button" href={actionHref(view)}>
        {copy.action}
        <ArrowRight size={15} />
      </Link>
    ) : null;

  const rows = useMemo<DirectoryRow[]>(() => {
    const departmentName = (departmentId?: string) =>
      state.departments.find(department => department.id === departmentId)
        ?.name ?? "No department";
    const branchNames = (branchIds: string[]) =>
      branchIds
        .map(
          branchId =>
            state.branches.find(branch => branch.id === branchId)?.name
        )
        .filter(Boolean)
        .join(", ") || "No branch";

    if (view === "departments") {
      return academicDepartments.map(department => {
        const owner = state.users.find(
          user => user.id === department.ownerUserId
        );
        const programs = scopedPrograms.filter(
          program => program.departmentId === department.id
        );
        return {
          id: department.id,
          name: department.name,
          detail: owner?.name ?? "No owner",
          scope: branchNames(department.branchIds),
          status: department.status,
          metric: `${programs.length} programs`,
          href: "/app/hod/programs",
        };
      });
    }

    if (view === "programs") {
      return scopedPrograms.map(program => {
        const courses = scopedCourses.filter(
          course => course.programId === program.id
        );
        const levels = state.levels.filter(
          level => level.programId === program.id
        );
        return {
          id: program.id,
          name: program.title,
          detail: departmentName(program.departmentId),
          scope: `${program.category} · ${program.language}`,
          status: program.status,
          metric: `${courses.length} courses · ${levels.length} levels`,
          href: "/app/hod/courses",
        };
      });
    }

    if (view === "levels") {
      return state.levels
        .filter(level => scopedProgramIds.has(level.programId))
        .sort((a, b) => a.order - b.order)
        .map(level => {
          const program = scopedPrograms.find(
            item => item.id === level.programId
          );
          return {
            id: level.id,
            name: level.title,
            detail: program?.title ?? "Program not set",
            scope: level.prerequisites.join(", ") || "No prerequisite",
            status: "active",
            metric: `${level.completionRules.length} rules`,
            href: "/app/hod/curriculum",
          };
        });
    }

    if (view === "teachers") {
      return state.teachers
        .filter(teacher => departmentIds.has(teacher.departmentId))
        .map(teacher => {
          const user = state.users.find(item => item.id === teacher.userId);
          const classCount = scopedRuns.filter(
            run => run.teacherId === teacher.userId
          ).length;
          return {
            id: teacher.id,
            name: user?.name ?? "Teacher",
            detail: departmentName(teacher.departmentId),
            scope: teacher.subjects.join(", ") || "No subjects listed",
            status: teacher.availabilityStatus,
            metric: `${classCount} course runs`,
            href: "/app/hod/messages",
          };
        });
    }

    return state.classGroups
      .filter(group => scopedRunIds.has(group.courseRunId))
      .map(group => {
        const run = scopedRuns.find(item => item.id === group.courseRunId);
        const course = scopedCourses.find(item => item.id === run?.courseId);
        const branch = state.branches.find(item => item.id === run?.branchId);
        return {
          id: group.id,
          name: group.name,
          detail: course?.title ?? "Course not set",
          scope: `${branch?.name ?? "Branch"} · ${group.schedule}`,
          status: group.status,
          metric: `${group.studentIds.length}/${group.capacity} learners`,
          href: "/app/hod/schedule",
        };
      });
  }, [
    academicDepartments,
    departmentIds,
    scopedCourses,
    scopedProgramIds,
    scopedPrograms,
    scopedRunIds,
    scopedRuns,
    state,
    view,
  ]);

  const statuses = Array.from(new Set(rows.map(row => row.status)));
  const filteredRows = rows.filter(row => {
    const text =
      `${row.name} ${row.detail} ${row.scope} ${row.status} ${row.metric}`.toLowerCase();
    return (
      (!query.trim() || text.includes(query.trim().toLowerCase())) &&
      (status === "all" || row.status === status)
    );
  });
  return (
    <PlatformShell role="headofdepartment" title={copy.title}>
      <WorkspaceLayout
        className="hod-directory-page"
        title={copy.title}
        description={copy.description}
        context="Academic"
        actions={primaryAction}
        toolbar={
          <div
            className="hod-compact-toolbar hod-directory-toolbar-v3"
            data-testid={`hod-${view}-toolbar`}
          >
            <label>
              Search
              <span>
                <Search size={15} />
                <input
                  value={query}
                  onChange={event => setQuery(event.target.value)}
                  placeholder={`Search ${copy.title.toLowerCase()}`}
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
          <DataTableCard
            title={copy.title}
            subtitle={`${filteredRows.length} records`}
            className="platform-directory-card hod-directory-card-v2"
          >
            <div
              className="platform-directory-table-wrap"
              data-testid={`hod-${view}-list`}
            >
              {filteredRows.length ? (
                <OperationalDirectoryTable
                  rows={filteredRows}
                  rowKey={row => row.id}
                  columns={[
                    {
                      key: "name",
                      label: "Name",
                      className: "platform-directory-col-name",
                      render: row => (
                        <div className="platform-directory-primary">
                          <strong>{row.name}</strong>
                        </div>
                      ),
                    },
                    {
                      key: "detail",
                      label: "Details",
                      className: "platform-directory-col-detail",
                      render: row => row.detail,
                    },
                    {
                      key: "scope",
                      label: "Scope",
                      className: "platform-directory-col-scope",
                      render: row => row.scope,
                    },
                    {
                      key: "status",
                      label: "Status",
                      className: "platform-directory-col-status",
                      render: row => (
                        <StatusBadge tone={statusTone(row.status)}>
                          {humanize(row.status)}
                        </StatusBadge>
                      ),
                    },
                    {
                      key: "metric",
                      label: "Summary",
                      className: "platform-directory-col-metric",
                      render: row => row.metric,
                    },
                  ]}
                  action={{
                    href: row => row.href,
                    label: row => row.name,
                    title: row => row.metric,
                  }}
                />
              ) : (
                <div className="platform-empty-state">
                  <strong>{copy.empty}</strong>
                  <span>Try a different search or status filter.</span>
                </div>
              )}
            </div>
          </DataTableCard>
        }
      />
    </PlatformShell>
  );
}
