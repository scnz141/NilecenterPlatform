import { requireActiveUser } from "@/lib/auth/session";
import { useMemo, useState } from "react";
import { Download, Search } from "lucide-react";
import PlatformShell from "@/components/platform/PlatformShell";
import { ReportLayout } from "@/components/platform/PlatformLayouts";
import {
  PortalInsight,
  countInsightPoints,
} from "@/components/platform/PortalInsights";
import { DataTableCard } from "@/components/platform/PlatformPrimitives";
import { platformStore } from "@/lib/domain/store";
import type { ReportType } from "@/lib/domain/types";

type BranchReportType = Exclude<ReportType, "audit">;
type SortKey = "record" | "status" | "metric";

type BranchReportRow = {
  id: string;
  record: string;
  detail: string;
  status: string;
  metric: string;
  scope: string;
};

const reportOptions: { value: BranchReportType; label: string }[] = [
  { value: "attendance", label: "Attendance" },
  { value: "finance", label: "Finance" },
  { value: "enrollments", label: "Enrollments" },
];

function statusTone(status: string): "green" | "amber" | "red" | "slate" {
  if (["present", "paid", "active", "completed"].includes(status)) {
    return "green";
  }
  if (["pending", "late", "overdue", "draft", "issued"].includes(status)) {
    return "amber";
  }
  if (["absent", "cancelled", "refunded", "paused"].includes(status)) {
    return "red";
  }
  return "slate";
}

function humanize(value: string) {
  return value
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, character => character.toUpperCase());
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

export default function BranchReportsPage() {
  const [reportType, setReportType] = useState<BranchReportType>("attendance");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("record");

  const state = useMemo(() => platformStore.getState(), []);
  const actorId = requireActiveUser("branchadmin").id;
  const actor = state.users.find(user => user.id === actorId);
  const staffProfile = state.staffProfiles.find(
    profile => profile.userId === actorId && profile.role === "branchadmin"
  );
  const branchId = actor?.branchId ?? staffProfile?.branchIds[0] ?? "br_cairo";
  const branch = state.branches.find(item => item.id === branchId);
  const branchUsers = state.users.filter(user => user.branchId === branch?.id);
  const branchStudents = state.students.filter(student =>
    branchUsers.some(user => user.id === student.userId)
  );
  const branchStudentIds = new Set(branchStudents.map(student => student.id));
  const branchClasses = state.classGroups.filter(classGroup =>
    classGroup.studentIds.some(studentId => branchStudentIds.has(studentId))
  );
  const branchClassIds = new Set(
    branchClasses.map(classGroup => classGroup.id)
  );
  const branchInvoices = state.invoices.filter(invoice =>
    branchStudentIds.has(invoice.studentId)
  );
  const branchAttendance = state.attendance.filter(
    record =>
      branchClassIds.has(record.classGroupId) ||
      branchStudentIds.has(record.studentId)
  );
  const rows: BranchReportRow[] =
    reportType === "finance"
      ? branchInvoices.map(invoice => {
          const student = state.students.find(
            item => item.id === invoice.studentId
          );
          const user = state.users.find(item => item.id === student?.userId);
          const paid = state.payments
            .filter(
              payment =>
                payment.invoiceId === invoice.id && payment.status === "paid"
            )
            .reduce((sum, payment) => sum + payment.amount, 0);
          return {
            id: invoice.id,
            record: user?.name ?? invoice.studentId,
            detail: `Payment due ${formatDate(invoice.dueAt)}`,
            status: invoice.status,
            metric: `${invoice.currency} ${Math.max(0, invoice.amount - paid)} balance`,
            scope: branch?.name ?? "Branch",
          };
        })
      : reportType === "enrollments"
        ? state.enrollments
            .filter(enrollment => branchStudentIds.has(enrollment.studentId))
            .map(enrollment => {
              const student = state.students.find(
                item => item.id === enrollment.studentId
              );
              const user = state.users.find(
                item => item.id === student?.userId
              );
              const classGroup = state.classGroups.find(
                item => item.id === enrollment.classGroupId
              );
              const courseRun = state.courseRuns.find(
                item => item.id === enrollment.courseRunId
              );
              const course = state.courses.find(
                item => item.id === courseRun?.courseId
              );
              return {
                id: enrollment.id,
                record: user?.name ?? enrollment.studentId,
                detail: `${course?.title ?? "Course"} · ${classGroup?.name ?? "Class pending"}`,
                status: enrollment.status,
                metric: `${enrollment.progress}% progress`,
                scope: branch?.name ?? "Branch",
              };
            })
        : branchAttendance.map(record => {
            const student = state.students.find(
              item => item.id === record.studentId
            );
            const user = state.users.find(item => item.id === student?.userId);
            const classGroup = state.classGroups.find(
              item => item.id === record.classGroupId
            );
            const session = state.events.find(
              item => item.id === record.sessionId
            );
            return {
              id: record.id,
              record: user?.name ?? record.studentId,
              detail: `${classGroup?.name ?? "Branch class"} · ${formatDate(session?.startsAt)}`,
              status: record.status,
              metric: record.notes || "No note",
              scope: branch?.name ?? "Branch",
            };
          });

  const statusOptions = Array.from(new Set(rows.map(row => row.status)));
  const filteredRows = rows
    .filter(row => {
      const text = [row.record, row.detail, row.status, row.metric, row.scope]
        .join(" ")
        .toLowerCase();
      const matchesSearch =
        !search.trim() || text.includes(search.trim().toLowerCase());
      const matchesStatus = status === "all" || row.status === status;
      return matchesSearch && matchesStatus;
    })
    .sort((first, second) => first[sortKey].localeCompare(second[sortKey]));
  const reportInsightPoints = countInsightPoints(
    filteredRows.map(row => row.status)
  );
  const activeReportLabel =
    reportOptions.find(option => option.value === reportType)?.label ??
    "Branch";

  const exportCsv = () => {
    const csv = platformStore.buildCsv(
      filteredRows.map(row => ({
        record: row.record,
        detail: row.detail,
        status: row.status,
        metric: row.metric,
        scope: row.scope,
      }))
    );
    if (!csv) return;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `branch-${branch?.code ?? "reports"}-${reportType}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <PlatformShell role="branchadmin" title="Reports">
      <ReportLayout
        className="branch-reports-page"
        title="Branch reports"
        description="Inspect branch attendance, finance, and enrollment rows."
        context={branch?.name ?? "Branch access"}
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
          <div
            className="branch-compact-toolbar branch-report-controls-v3"
            data-testid="branch-reports-toolbar"
          >
            <label>
              Report type
              <select
                value={reportType}
                onChange={event => {
                  setReportType(event.target.value as BranchReportType);
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
              Search
              <span>
                <Search size={15} />
                <input
                  value={search}
                  onChange={event => setSearch(event.target.value)}
                  placeholder="Search branch rows"
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
                {statusOptions.map(option => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
          </div>
        }
        main={
          <DataTableCard
            title={`${reportOptions.find(option => option.value === reportType)?.label} rows`}
            subtitle={`${filteredRows.length} visible row(s)`}
            className="branch-report-card"
          >
            <div
              className="platform-report-table typed"
              data-testid="branch-reports-list"
            >
              <div className="platform-report-row header" role="row">
                {[
                  ["record", "Record"],
                  ["status", "Status"],
                  ["metric", "Metric"],
                ].map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    aria-pressed={sortKey === key}
                    onClick={() => setSortKey(key as SortKey)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {filteredRows.length ? (
                filteredRows.map(row => (
                  <article key={row.id} className="platform-report-row">
                    <div className="platform-report-row-main">
                      <small>{row.scope}</small>
                      <strong>{row.record}</strong>
                      <span>{row.detail}</span>
                    </div>
                    <span
                      className={`platform-report-status status-${row.status.replace(/[_\s]/g, "-")}`}
                    >
                      {humanize(row.status)}
                    </span>
                    <div className="platform-report-row-metric">
                      <strong>{row.metric}</strong>
                    </div>
                  </article>
                ))
              ) : (
                <article className="platform-report-row empty">
                  <div className="platform-empty-state">
                    <strong>No report rows</strong>
                    <span>Try another report type, search, or status.</span>
                  </div>
                </article>
              )}
            </div>
          </DataTableCard>
        }
        side={
          <PortalInsight
            compact
            eyebrow="Branch signal"
            title={`${activeReportLabel} status`}
            value={filteredRows.length}
            valueLabel="visible records"
            description="Use the current branch status mix to decide the next local follow-up."
            points={reportInsightPoints}
            variant="distribution"
            tone="green"
            testId="branch-reports-insight"
          />
        }
      />
    </PlatformShell>
  );
}
