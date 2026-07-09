import { useMemo, useState } from "react";
import { Download, Search } from "lucide-react";
import { toast } from "sonner";
import PlatformShell from "@/components/platform/PlatformShell";
import { ReportLayout } from "@/components/platform/PlatformLayouts";
import {
  DataTableCard,
  StatusBadge,
} from "@/components/platform/PlatformPrimitives";
import { runPlatformWorkflowActionRequest } from "@/lib/backend/api";
import { platformStore } from "@/lib/domain/store";
import type { PlatformState, ReportType } from "@/lib/domain/types";
import { getDemoUser } from "@/lib/platformData";

type HodReportType = Exclude<ReportType, "finance">;
type SortKey = "record" | "status" | "metric";

type HodReportRow = {
  id: string;
  record: string;
  detail: string;
  status: string;
  metric: string;
  date: string;
};

const reportOptions: { value: HodReportType; label: string }[] = [
  { value: "enrollments", label: "Enrollment" },
  { value: "attendance", label: "Attendance" },
  { value: "audit", label: "Activity" },
];

function humanize(value?: string) {
  if (!value) return "Not set";
  return value
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, character => character.toUpperCase());
}

function statusTone(status: string): "green" | "amber" | "red" | "slate" {
  if (["active", "completed", "present", "approved", "issued"].includes(status)) {
    return "green";
  }
  if (["pending", "late", "overdue", "draft"].includes(status)) {
    return "amber";
  }
  if (["paused", "absent", "rejected", "cancelled"].includes(status)) {
    return "red";
  }
  return "slate";
}

function formatDate(value?: string) {
  if (!value) return "No date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No date";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function getHodScope(state: PlatformState) {
  const actorId = getDemoUser("headofdepartment").id;
  const actor = state.users.find(user => user.id === actorId);
  const departments = state.departments.filter(
    department =>
      department.ownerUserId === actorId ||
      department.id === actor?.departmentId
  );
  const departmentIds = new Set(departments.map(department => department.id));
  const programs = state.programs.filter(program =>
    departmentIds.has(program.departmentId)
  );
  const programIds = new Set(programs.map(program => program.id));
  const courses = state.courses.filter(course => programIds.has(course.programId));
  const courseIds = new Set(courses.map(course => course.id));
  const courseRuns = state.courseRuns.filter(run => courseIds.has(run.courseId));
  const courseRunIds = new Set(courseRuns.map(run => run.id));
  const classGroups = state.classGroups.filter(group =>
    courseRunIds.has(group.courseRunId)
  );
  const classGroupIds = new Set(classGroups.map(group => group.id));
  return {
    actorId,
    departments,
    courses,
    courseIds,
    courseRuns,
    courseRunIds,
    classGroups,
    classGroupIds,
  };
}

function findStudentName(state: PlatformState, studentId?: string) {
  const student = state.students.find(item => item.id === studentId);
  return state.users.find(user => user.id === student?.userId)?.name ?? "Student";
}

function findCourseTitle(state: PlatformState, courseId?: string) {
  return state.courses.find(course => course.id === courseId)?.title ?? "Course";
}

function makeReportRows(
  state: PlatformState,
  reportType: HodReportType
): HodReportRow[] {
  const scope = getHodScope(state);
  if (reportType === "attendance") {
    return state.attendance
      .filter(record => scope.classGroupIds.has(record.classGroupId))
      .map(record => {
        const classGroup = state.classGroups.find(
          group => group.id === record.classGroupId
        );
        const session = state.classSessions.find(
          item => item.id === record.sessionId
        );
        return {
          id: record.id,
          record: findStudentName(state, record.studentId),
          detail: classGroup?.name ?? "Class",
          status: record.status,
          metric: record.notes || "Attendance saved",
          date: formatDate(session?.startsAt),
        };
      });
  }

  if (reportType === "audit") {
    return state.auditLogs
      .filter(
        log =>
          log.actorId === scope.actorId ||
          log.entityType === "Course" ||
          log.entityType === "Assignment" ||
          log.entityType === "Certificate"
      )
      .slice(0, 24)
      .map(log => ({
        id: log.id,
        record: humanize(log.action),
        detail: log.summary,
        status: "logged",
        metric: log.entityType,
        date: formatDate(log.createdAt),
      }));
  }

  return state.enrollments
    .filter(enrollment => scope.courseRunIds.has(enrollment.courseRunId))
    .map(enrollment => {
      const run = state.courseRuns.find(item => item.id === enrollment.courseRunId);
      const classGroup = state.classGroups.find(
        item => item.id === enrollment.classGroupId
      );
      return {
        id: enrollment.id,
        record: findStudentName(state, enrollment.studentId),
        detail: `${findCourseTitle(state, run?.courseId)} · ${classGroup?.name ?? "Class pending"}`,
        status: enrollment.status,
        metric: `${enrollment.progress}% progress`,
        date: formatDate(enrollment.createdAt),
      };
    });
}

export default function HodReportsPage() {
  const [state, setState] = useState(() => platformStore.getState());
  const [reportType, setReportType] = useState<HodReportType>("enrollments");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("record");
  const [saving, setSaving] = useState(false);
  const scope = useMemo(() => getHodScope(state), [state]);
  const rows = useMemo(
    () => makeReportRows(state, reportType),
    [reportType, state]
  );
  const statusOptions = Array.from(new Set(rows.map(row => row.status)));
  const filteredRows = rows
    .filter(row => {
      const text = [row.record, row.detail, row.status, row.metric, row.date]
        .join(" ")
        .toLowerCase();
      return (
        (!search.trim() || text.includes(search.trim().toLowerCase())) &&
        (status === "all" || row.status === status)
      );
    })
    .sort((first, second) => first[sortKey].localeCompare(second[sortKey]));

  const saveView = async () => {
    setSaving(true);
    const response = await runPlatformWorkflowActionRequest({
      type: "report.preset.save",
      role: "headofdepartment",
      label: `${reportOptions.find(option => option.value === reportType)?.label ?? "Academic"} view`,
      reportType,
      search,
      status,
      rowCount: filteredRows.length,
      actorId: scope.actorId,
    });
    setSaving(false);
    if (!response.ok || !response.data) {
      toast.error(response.error ?? "Could not save view");
      return;
    }
    platformStore.setState(response.data.state);
    setState(response.data.state);
    toast.success("Report view saved");
  };

  const exportCsv = () => {
    const csv = platformStore.buildCsv(
      filteredRows.map(row => ({
        record: row.record,
        detail: row.detail,
        status: row.status,
        metric: row.metric,
        date: row.date,
      }))
    );
    if (!csv) return;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `hod-${reportType}-report.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <PlatformShell role="headofdepartment" title="Reports">
      <ReportLayout
        className="hod-report-page"
        title="Academic reports"
        description="Review learning records inside your department scope."
        context="Academic"
        actions={
          <button
            type="button"
            className="platform-primary-button"
            onClick={exportCsv}
            disabled={!filteredRows.length}
          >
            <Download size={15} />
            Export CSV
          </button>
        }
        toolbar={
          <div className="platform-report-controls hod-report-controls">
            <label>
              Report type
              <select
                value={reportType}
                onChange={event => {
                  setReportType(event.target.value as HodReportType);
                  setStatus("all");
                }}
              >
                {reportOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Status
              <select
                value={status}
                onChange={event => setStatus(event.target.value)}
              >
                <option value="all">All statuses</option>
                {statusOptions.map(option => (
                  <option key={option} value={option}>
                    {humanize(option)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Search
              <span>
                <Search size={15} />
                <input
                  value={search}
                  onChange={event => setSearch(event.target.value)}
                  placeholder="Search report rows"
                />
              </span>
            </label>
            <button type="button" onClick={saveView} disabled={saving}>
              Save view
            </button>
          </div>
        }
        main={
          <DataTableCard
            title={`${reportOptions.find(option => option.value === reportType)?.label ?? "Academic"} report`}
            subtitle={`${filteredRows.length} row(s)`}
          >
            <div className="platform-report-table typed">
              <div className="platform-report-row header" role="row">
                <button
                  type="button"
                  aria-pressed={sortKey === "record"}
                  onClick={() => setSortKey("record")}
                >
                  Record
                </button>
                <button
                  type="button"
                  aria-pressed={sortKey === "status"}
                  onClick={() => setSortKey("status")}
                >
                  Status
                </button>
                <button
                  type="button"
                  aria-pressed={sortKey === "metric"}
                  onClick={() => setSortKey("metric")}
                >
                  Detail
                </button>
              </div>
              {filteredRows.length ? (
                filteredRows.map(row => (
                  <article key={row.id} className="platform-report-row">
                    <div className="platform-report-row-main">
                      <small>{row.date}</small>
                      <strong>{row.record}</strong>
                      <span>{row.detail}</span>
                    </div>
                    <StatusBadge tone={statusTone(row.status)}>
                      {humanize(row.status)}
                    </StatusBadge>
                    <div className="platform-report-row-metric">
                      <strong>{row.metric}</strong>
                      <span>{row.id}</span>
                    </div>
                  </article>
                ))
              ) : (
                <article className="platform-report-row empty">
                  <div className="platform-report-row-main">
                    <strong>No report rows found</strong>
                    <span>Try a different filter.</span>
                  </div>
                </article>
              )}
            </div>
          </DataTableCard>
        }
        side={
          <aside className="portal-simple-stack">
            <section className="portal-simple-side-card">
              <span>Scope</span>
              <strong>{scope.departments[0]?.name ?? "Academic scope"}</strong>
              <p>{scope.classGroups.length} classes in this report scope.</p>
            </section>
            <section className="portal-simple-side-card">
              <span>Saved views</span>
              <strong>
                {
                  state.reportPresets.filter(
                    preset =>
                      preset.role === "headofdepartment" &&
                      preset.ownerUserId === scope.actorId
                  ).length
                }
              </strong>
              <p>Saved academic report filters.</p>
            </section>
          </aside>
        }
      />
    </PlatformShell>
  );
}
