import { getStoredAuthSession, requireActiveUser } from "@/lib/auth/session";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRight, Search } from "lucide-react";
import { Link } from "wouter";
import NccReadStatus from "@/components/platform/NccReadStatus";
import OperationalDirectoryTable from "@/components/platform/OperationalDirectoryTable";
import PlatformShell from "@/components/platform/PlatformShell";
import { WorkspaceLayout } from "@/components/platform/PlatformLayouts";
import {
  DataTableCard,
  StatusBadge,
} from "@/components/platform/PlatformPrimitives";
import { fetchNccClassesRequest, type NccClassDto } from "@/lib/backend/api";
import {
  classifyNccFailure,
  type NccReadState,
} from "@/lib/backend/nccReadState";
import { platformStore } from "@/lib/domain/store";
import type { EntityStatus } from "@/lib/domain/types";

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
  return getStoredAuthSession()?.provider === "ncc" ? (
    <NccRegistrarClassesPage />
  ) : (
    <CompatibilityRegistrarClassesPage />
  );
}

function NccRegistrarClassesPage() {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [readState, setReadState] = useState<NccReadState<NccClassDto[]>>({
    status: "loading",
  });
  const load = useCallback(async () => {
    setReadState({ status: "loading" });
    const result = await fetchNccClassesRequest();
    setReadState(
      result.ok && result.data
        ? { status: "ready", data: result.data.items }
        : classifyNccFailure(result)
    );
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  const classes = readState.status === "ready" ? readState.data : [];
  const statuses = Array.from(new Set(classes.map(row => row.status)));
  const rows = classes.filter(row => {
    const text = `${row.name} ${row.courseName} ${row.departmentName} ${row.teachers.map(teacher => teacher.name).join(" ")} ${row.status}`.toLowerCase();
    return (
      (!query.trim() || text.includes(query.trim().toLowerCase())) &&
      (status === "all" || row.status === status)
    );
  });

  return (
    <PlatformShell role="registrar" title="Registrar classes">
      <WorkspaceLayout
        className="registrar-classes-page"
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
          readState.status === "ready" ? (
            <div className="registrar-list-toolbar-v3">
              <label className="registrar-list-search">
                <span className="sr-only">Search classes</span>
                <Search size={15} />
                <input
                  value={query}
                  onChange={event => setQuery(event.target.value)}
                  placeholder="Search classes"
                />
              </label>
              <label className="registrar-list-select">
                <span>Status</span>
                <select
                  value={status}
                  onChange={event => setStatus(event.target.value)}
                >
                  <option value="all">All statuses</option>
                  {statuses.map(value => (
                    <option key={value} value={value}>
                      {humanize(value)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          ) : undefined
        }
        main={
          readState.status !== "ready" ? (
            <NccReadStatus state={readState} onRetry={() => void load()} />
          ) : (
            <DataTableCard
              title="Class capacity"
              subtitle={`${rows.length} classes`}
              className="registrar-record-card registrar-classes-record-card"
            >
              {rows.length ? (
                <div className="platform-directory-table-wrap">
                  <OperationalDirectoryTable
                    rows={rows}
                    rowKey={row => row.id}
                    columns={[
                      { key: "class", label: "Class", render: row => <strong>{row.name}</strong> },
                      { key: "course", label: "Course", render: row => row.courseName },
                      { key: "department", label: "Department", render: row => row.departmentName },
                      {
                        key: "teachers",
                        label: "Teachers",
                        render: row =>
                          row.teachers.map(teacher => teacher.name).join(", ") ||
                          "No teacher",
                      },
                      {
                        key: "enrolled",
                        label: "Enrolled",
                        render: row =>
                          `${row.activeEnrolmentCount}/${row.capacity}`,
                      },
                      {
                        key: "status",
                        label: "Status",
                        render: row => (
                          <StatusBadge
                            tone={row.status === "active" ? "green" : "slate"}
                          >
                            {humanize(row.status)}
                          </StatusBadge>
                        ),
                      },
                    ]}
                    action={{ href: () => undefined, label: row => row.name }}
                  />
                </div>
              ) : (
                <div className="platform-empty-state">
                  <strong>No classes found</strong>
                </div>
              )}
            </DataTableCard>
          )
        }
      />
    </PlatformShell>
  );
}

function CompatibilityRegistrarClassesPage() {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | EntityStatus>("all");
  const state = useMemo(() => platformStore.getState(), []);
  const actorId = requireActiveUser("registrar").id;
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

  return (
    <PlatformShell role="registrar" title="Registrar classes">
      <WorkspaceLayout
        className="registrar-classes-page"
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
          <div className="registrar-list-toolbar-v3">
            <label className="registrar-list-search">
              <span className="sr-only">Search classes</span>
              <Search size={15} />
              <input
                value={query}
                onChange={event => setQuery(event.target.value)}
                placeholder="Search classes"
              />
            </label>
            <label className="registrar-list-select">
              <span>Status</span>
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
            className="registrar-record-card registrar-classes-record-card"
          >
            <div
              className="registrar-record-list registrar-classes-record-list"
              data-testid="registrar-classes-list"
            >
              {filteredRows.map(row => (
                <article
                  key={row.id}
                  className="registrar-record-row registrar-class-record"
                  data-class-id={row.id}
                >
                  <div className="registrar-record-primary">
                    <strong>{row.name}</strong>
                    <span>
                      {row.course} · {row.branch}
                    </span>
                  </div>
                  <dl className="registrar-record-facts">
                    <div>
                      <dt>Schedule</dt>
                      <dd>{row.schedule}</dd>
                    </div>
                    <div>
                      <dt>Teacher</dt>
                      <dd>
                        {row.teacher} · {row.room}
                      </dd>
                    </div>
                    <div>
                      <dt>Seats</dt>
                      <dd>
                        {row.seatsUsed}/{row.capacity} · {row.seatsOpen} open
                      </dd>
                    </div>
                  </dl>
                  <StatusBadge tone={statusTone(row.status)}>
                    {humanize(row.status)}
                  </StatusBadge>
                </article>
              ))}
              {!filteredRows.length ? (
                <div className="platform-empty-state">
                  <strong>No classes found</strong>
                  <span>Try a different search or review branch access.</span>
                </div>
              ) : null}
            </div>
          </DataTableCard>
        }
      />
    </PlatformShell>
  );
}
