import { useMemo, useState } from "react";
import { ArrowRight, Search, Users } from "lucide-react";
import { Link } from "wouter";
import PlatformShell from "@/components/platform/PlatformShell";
import { WorkspaceLayout } from "@/components/platform/PlatformLayouts";
import {
  DataTableCard,
  StatusBadge,
} from "@/components/platform/PlatformPrimitives";
import { platformStore } from "@/lib/domain/store";
import { getDemoUser } from "@/lib/platformData";

type BranchDirectoryView = "students" | "teachers" | "classes";

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
  BranchDirectoryView,
  { title: string; description: string; empty: string }
> = {
  students: {
    title: "Students",
    description: "Find learners assigned to this branch.",
    empty: "No branch students found.",
  },
  teachers: {
    title: "Teachers",
    description: "Review local teachers and their class load.",
    empty: "No branch teachers found.",
  },
  classes: {
    title: "Classes",
    description: "Find branch class groups and open schedule work.",
    empty: "No branch classes found.",
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
  if (status === "pending" || status === "draft") return "amber";
  if (
    status === "paused" ||
    status === "cancelled" ||
    status === "overdue" ||
    status === "unavailable"
  )
    return "red";
  return "slate";
}

export default function BranchDirectoryPage({
  view,
}: {
  view: BranchDirectoryView;
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const state = useMemo(() => platformStore.getState(), []);
  const actorId = getDemoUser("branchadmin").id;
  const actor = state.users.find(user => user.id === actorId);
  const staffProfile = state.staffProfiles.find(
    profile => profile.userId === actorId && profile.role === "branchadmin"
  );
  const branchId = actor?.branchId ?? staffProfile?.branchIds[0] ?? "br_cairo";
  const branch = state.branches.find(item => item.id === branchId);

  const rows = useMemo<DirectoryRow[]>(() => {
    if (!branch) return [];

    if (view === "students") {
      return state.students
        .map(student => {
          const user = state.users.find(item => item.id === student.userId);
          const enrollment = state.enrollments.find(
            item => item.studentId === student.id
          );
          const classGroup = state.classGroups.find(
            item => item.id === enrollment?.classGroupId
          );
          if (user?.branchId !== branch.id) return null;
          return {
            id: student.id,
            name: user?.name ?? "Student",
            detail: user?.email ?? student.country,
            scope: classGroup?.name ?? student.currentLevel ?? "No class",
            status: student.status,
            metric: enrollment
              ? `${enrollment.progress}% progress`
              : humanize(student.source),
          };
        })
        .filter(Boolean) as DirectoryRow[];
    }

    if (view === "teachers") {
      return state.teachers
        .filter(teacher => teacher.branchId === branch.id)
        .map(teacher => {
          const user = state.users.find(item => item.id === teacher.userId);
          const department = state.departments.find(
            item => item.id === teacher.departmentId
          );
          return {
            id: teacher.id,
            name: user?.name ?? "Teacher",
            detail: department?.name ?? "Department not set",
            scope: teacher.subjects.join(", ") || "No subjects listed",
            status: teacher.availabilityStatus,
            metric: `${teacher.assignedClassIds.length} classes`,
          };
        });
    }

    return state.classGroups
      .map(group => {
        const run = state.courseRuns.find(
          item => item.id === group.courseRunId
        );
        if (run?.branchId !== branch.id) return null;
        const course = state.courses.find(item => item.id === run.courseId);
        const room = state.rooms.find(item => item.id === group.roomId);
        return {
          id: group.id,
          name: group.name,
          detail: course?.title ?? "Course",
          scope: room?.name ?? group.schedule,
          status: run.status,
          metric: `${group.studentIds.length}/${group.capacity} learners`,
          href: "/app/branch/schedule",
        };
      })
      .filter(Boolean) as DirectoryRow[];
  }, [branch, state, view]);

  const statuses = Array.from(new Set(rows.map(row => row.status)));
  const filteredRows = rows.filter(row => {
    const text =
      `${row.name} ${row.detail} ${row.scope} ${row.status} ${row.metric}`.toLowerCase();
    return (
      (!query.trim() || text.includes(query.trim().toLowerCase())) &&
      (status === "all" || row.status === status)
    );
  });
  const copy = viewCopy[view];
  const action =
    view === "classes" ? (
      <Link className="platform-primary-button" href="/app/branch/schedule">
        Open schedule
        <ArrowRight size={15} />
      </Link>
    ) : null;

  return (
    <PlatformShell role="branchadmin" title={copy.title}>
      <WorkspaceLayout
        className="branch-directory-page"
        title={copy.title}
        description={copy.description}
        context={branch?.name ?? "Branch"}
        actions={action}
        toolbar={
          <div className="simple-portal-toolbar branch-directory-toolbar">
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
          >
            <table className="branch-directory-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Branch detail</th>
                  <th>Status</th>
                  <th>Summary</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.length ? (
                  filteredRows.map(row => (
                    <tr key={row.id}>
                      <td>
                        <strong>{row.name}</strong>
                        <small>{row.detail}</small>
                      </td>
                      <td>
                        <strong>{row.scope}</strong>
                        <small>{row.id}</small>
                      </td>
                      <td>
                        <StatusBadge tone={statusTone(row.status)}>
                          {humanize(row.status)}
                        </StatusBadge>
                      </td>
                      <td>
                        {row.href ? (
                          <Link
                            className="simple-portal-row-action"
                            href={row.href}
                          >
                            {row.metric}
                            <ArrowRight size={14} />
                          </Link>
                        ) : (
                          row.metric
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4}>
                      <strong>{copy.empty}</strong>
                      <small>Try a different search or status filter.</small>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </DataTableCard>
        }
        side={
          <aside className="portal-simple-stack">
            <section className="portal-simple-side-card">
              <span>
                <Users size={15} />
                Branch scope
              </span>
              <strong>{branch?.name ?? "Branch"}</strong>
              <p>{filteredRows.length} visible records in this view.</p>
            </section>
          </aside>
        }
      />
    </PlatformShell>
  );
}
