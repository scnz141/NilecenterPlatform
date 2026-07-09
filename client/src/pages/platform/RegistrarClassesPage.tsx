import { useMemo, useState } from "react";
import { ArrowRight, Presentation, Search, Users } from "lucide-react";
import { Link } from "wouter";
import PlatformShell from "@/components/platform/PlatformShell";
import { WorkspaceLayout } from "@/components/platform/PlatformLayouts";
import {
  DataTableCard,
  StatusBadge,
} from "@/components/platform/PlatformPrimitives";
import { platformStore } from "@/lib/domain/store";
import type { EntityStatus } from "@/lib/domain/types";
import { getDemoUser } from "@/lib/platformData";

type ClassRow = {
  id: string;
  name: string;
  course: string;
  branch: string;
  teacher: string;
  room: string;
  schedule: string;
  seatsUsed: number;
  capacity: number;
  seatsOpen: number;
  status: EntityStatus;
  searchText: string;
};

function statusTone(status: EntityStatus): "green" | "amber" | "red" | "slate" {
  if (status === "active" || status === "completed") return "green";
  if (status === "pending" || status === "draft") return "amber";
  if (status === "paused" || status === "cancelled" || status === "overdue")
    return "red";
  return "slate";
}

function humanize(value: string) {
  return value
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, character => character.toUpperCase());
}

export default function RegistrarClassesPage() {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | EntityStatus>("all");
  const state = useMemo(() => platformStore.getState(), []);
  const actorId = getDemoUser("registrar").id;
  const actor = state.users.find(user => user.id === actorId);
  const staffProfile = state.staffProfiles.find(
    profile => profile.userId === actorId && profile.role === "registrar"
  );
  const branchIds = new Set([
    ...(staffProfile?.branchIds ?? []),
    ...(actor?.branchId ? [actor.branchId] : []),
  ]);

  const classRows = useMemo<ClassRow[]>(() => {
    return state.classGroups
      .map(classGroup => {
        const run = state.courseRuns.find(
          item => item.id === classGroup.courseRunId
        );
        if (branchIds.size && (!run || !branchIds.has(run.branchId))) {
          return null;
        }
        const course = state.courses.find(item => item.id === run?.courseId);
        const branch = state.branches.find(item => item.id === run?.branchId);
        const teacher = state.users.find(item => item.id === run?.teacherId);
        const room = state.rooms.find(item => item.id === classGroup.roomId);
        const seatsUsed = classGroup.studentIds.length;
        const seatsOpen = Math.max(0, classGroup.capacity - seatsUsed);
        const statusValue = run?.status ?? "active";
        const searchText = [
          classGroup.name,
          course?.title,
          branch?.name,
          teacher?.name,
          room?.name,
          classGroup.schedule,
          statusValue,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return {
          id: classGroup.id,
          name: classGroup.name,
          course: course?.title ?? "Course not set",
          branch: branch?.name ?? "Branch not set",
          teacher: teacher?.name ?? "Teacher not set",
          room: room?.name ?? "Room not set",
          schedule: classGroup.schedule,
          seatsUsed,
          capacity: classGroup.capacity,
          seatsOpen,
          status: statusValue,
          searchText,
        };
      })
      .filter(Boolean) as ClassRow[];
  }, [branchIds, state]);

  const statuses = Array.from(new Set(classRows.map(row => row.status)));
  const filteredRows = classRows.filter(row => {
    const matchesQuery =
      !query.trim() || row.searchText.includes(query.trim().toLowerCase());
    const matchesStatus = status === "all" || row.status === status;
    return matchesQuery && matchesStatus;
  });
  const totalOpenSeats = classRows.reduce((sum, row) => sum + row.seatsOpen, 0);
  const fullClasses = classRows.filter(row => row.seatsOpen === 0).length;
  const activeClasses = classRows.filter(row => row.status === "active").length;
  const visibleBranches = state.branches.filter(branch =>
    branchIds.size ? branchIds.has(branch.id) : true
  );

  return (
    <PlatformShell role="registrar" title="Registrar classes">
      <WorkspaceLayout
        title="Classes"
        description="Find class capacity before assigning students."
        context="Registrar"
        actions={
          <Link className="platform-primary-button" href="/app/registrar/enrollments">
            Open enrollments
            <ArrowRight size={15} />
          </Link>
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
                  placeholder="Class, course, teacher, room"
                />
              </span>
            </label>
            <label>
              Status
              <select
                value={status}
                onChange={event =>
                  setStatus(event.target.value as "all" | EntityStatus)
                }
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
            title="Class capacity"
            subtitle={`${filteredRows.length} classes`}
          >
            <table className="simple-portal-table">
              <thead>
                <tr>
                  <th>Class</th>
                  <th>Schedule</th>
                  <th>Capacity</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.length ? (
                  filteredRows.map(row => (
                    <tr key={row.id}>
                      <td>
                        <strong>{row.name}</strong>
                        <small>
                          {row.course} · {row.branch}
                        </small>
                      </td>
                      <td>
                        <strong>{row.schedule}</strong>
                        <small>
                          {row.teacher} · {row.room}
                        </small>
                      </td>
                      <td>
                        <strong>
                          {row.seatsUsed}/{row.capacity}
                        </strong>
                        <small>{row.seatsOpen} seat(s) open</small>
                      </td>
                      <td>
                        <StatusBadge tone={statusTone(row.status)}>
                          {humanize(row.status)}
                        </StatusBadge>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4}>
                      <strong>No classes found</strong>
                      <small>
                        Try a different search or review branch access.
                      </small>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </DataTableCard>
        }
        side={
          <section className="registrar-panel">
            <div className="registrar-panel-head">
              <div>
                <span>Assignment readiness</span>
                <strong>{totalOpenSeats} open seats</strong>
              </div>
              <Presentation size={18} />
            </div>
            <div className="registrar-operations-list">
              <article>
                <Users size={15} />
                <div>
                  <strong>{activeClasses} active classes</strong>
                  <small>
                    {fullClasses} full · {classRows.length} visible total
                  </small>
                </div>
              </article>
              <article>
                <div>
                  <strong>Branch access</strong>
                  <small>
                    {visibleBranches.map(branch => branch.name).join(", ") ||
                      "No branch assigned"}
                  </small>
                </div>
                <span>{visibleBranches.length || 0}</span>
              </article>
              <article>
                <div>
                  <strong>Next step</strong>
                  <small>
                    Choose a class here, then activate the student from
                    Enrollments.
                  </small>
                </div>
                <span>ready</span>
              </article>
            </div>
          </section>
        }
      />
    </PlatformShell>
  );
}
