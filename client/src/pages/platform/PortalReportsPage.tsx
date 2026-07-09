import { useMemo, useState } from "react";
import { Download, Search } from "lucide-react";
import { Link } from "wouter";
import PlatformShell from "@/components/platform/PlatformShell";
import { ReportLayout } from "@/components/platform/PlatformLayouts";
import { DataTableCard, StatusBadge } from "@/components/platform/PlatformPrimitives";
import { platformStore } from "@/lib/domain/store";
import type { Role } from "@/lib/platformData";

type PortalReportsPageProps = {
  role: Extract<Role, "teacher" | "registrar">;
  view?: "overview" | "attendance" | "grades" | "admissions" | "payments";
};

type ReportRow = {
  id: string;
  primary: string;
  secondary: string;
  status: string;
  date: string;
  value: string;
};

function formatDate(value?: string) {
  if (!value) return "No date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No date";
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(date);
}

function statusTone(status: string): "green" | "amber" | "red" | "slate" {
  if (["active", "present", "paid", "completed", "approved"].includes(status)) return "green";
  if (["pending", "late", "partial", "ready_to_enroll"].includes(status)) return "amber";
  if (["absent", "overdue", "rejected", "cancelled"].includes(status)) return "red";
  return "slate";
}

function downloadCsv(filename: string, rows: ReportRow[]) {
  const csv = [
    ["Item", "Detail", "Status", "Date", "Value"],
    ...rows.map(row => [row.primary, row.secondary, row.status, row.date, row.value]),
  ]
    .map(row => row.map(value => `"${String(value).replaceAll('"', '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function PortalReportsPage({ role, view = "overview" }: PortalReportsPageProps) {
  const state = useMemo(() => platformStore.getState(), []);
  const [search, setSearch] = useState("");
  const roleRoot = role === "teacher" ? "/app/teacher/reports" : "/app/registrar/reports";
  const tabs =
    role === "teacher"
      ? [
          { href: roleRoot, label: "Overview", active: view === "overview" },
          { href: `${roleRoot}/attendance`, label: "Attendance", active: view === "attendance" },
          { href: `${roleRoot}/grades`, label: "Grades", active: view === "grades" },
        ]
      : [
          { href: roleRoot, label: "Overview", active: view === "overview" },
          { href: `${roleRoot}/admissions`, label: "Admissions", active: view === "admissions" },
          { href: `${roleRoot}/payments`, label: "Payments", active: view === "payments" },
        ];

  const rows: ReportRow[] =
    role === "teacher"
      ? view === "grades"
        ? state.grades.map(grade => {
            const student = state.students.find(item => item.id === grade.studentId);
            const user = state.users.find(item => item.id === student?.userId);
            return {
              id: grade.id,
              primary: user?.name ?? "Student",
              secondary: grade.itemTitle,
              status: grade.score >= 70 ? "approved" : "needs review",
              date: "Current",
              value: `${grade.score}/${grade.maxScore}`,
            };
          })
        : state.attendance.map(record => {
            const student = state.students.find(item => item.id === record.studentId);
            const user = state.users.find(item => item.id === student?.userId);
            const group = state.classGroups.find(item => item.id === record.classGroupId);
            return {
              id: record.id,
              primary: user?.name ?? "Student",
              secondary: group?.name ?? "Class",
              status: record.status,
              date: formatDate(state.events.find(item => item.id === record.sessionId)?.startsAt),
              value: record.notes || "No note",
            };
          })
      : view === "payments"
        ? state.invoices.map(invoice => {
            const student = state.students.find(item => item.id === invoice.studentId);
            const user = state.users.find(item => item.id === student?.userId);
            return {
              id: invoice.id,
              primary: user?.name ?? "Student",
              secondary: `Invoice ${invoice.id}`,
              status: invoice.status,
              date: formatDate(invoice.dueAt),
              value: `${invoice.currency} ${invoice.amount}`,
            };
          })
        : state.applications.map(application => {
            const lead = state.leads.find(item => item.id === application.leadId);
            const branch = state.branches.find(item => item.id === application.branchId);
            return {
              id: application.id,
              primary: lead?.fullName ?? "Applicant",
              secondary: `${application.courseInterest} · ${branch?.name ?? "Branch"}`,
              status: application.status,
              date: formatDate(lead?.createdAt),
              value: application.schedulePreference,
            };
          });

  const filteredRows = rows.filter(row =>
    [row.primary, row.secondary, row.status, row.value]
      .join(" ")
      .toLowerCase()
      .includes(search.toLowerCase()),
  );

  return (
    <PlatformShell role={role} title="Reports">
      <ReportLayout
        className="portal-simple-page"
        title={view === "overview" ? "Reports" : tabs.find(tab => tab.active)?.label ?? "Reports"}
        description={role === "teacher" ? "Review class progress and learning records." : "Review admissions and payment follow-up."}
        context={role === "teacher" ? "Teacher" : "Registrar"}
        actions={
          <button type="button" className="platform-primary-button" onClick={() => downloadCsv(`nile-${role}-report.csv`, filteredRows)}>
            <Download size={15} />
            Export CSV
          </button>
        }
        toolbar={
          <div className="portal-simple-toolbar portal-report-toolbar">
            <nav className="portal-simple-tabs" aria-label="Report views">
              {tabs.map(tab => (
                <Link key={tab.href} href={tab.href} className={tab.active ? "active" : ""}>
                  {tab.label}
                </Link>
              ))}
            </nav>
            <label>
              Search
              <span>
                <Search size={14} />
                <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search report rows" />
              </span>
            </label>
          </div>
        }
        main={
          <DataTableCard title={view === "overview" ? "Report rows" : `${tabs.find(tab => tab.active)?.label} rows`} subtitle={`${filteredRows.length} row(s)`}>
            <div className="admin-ia-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Detail</th>
                    <th>Status</th>
                    <th>Date</th>
                    <th>Value</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map(row => (
                    <tr key={row.id}>
                      <td>
                        <strong>{row.primary}</strong>
                        <small>{row.id}</small>
                      </td>
                      <td>{row.secondary}</td>
                      <td>
                        <StatusBadge tone={statusTone(row.status)}>{row.status}</StatusBadge>
                      </td>
                      <td>{row.date}</td>
                      <td>{row.value}</td>
                    </tr>
                  ))}
                  {!filteredRows.length ? (
                    <tr>
                      <td colSpan={5}>
                        <div className="platform-empty-state">
                          <strong>No report rows</strong>
                          <span>Try a different search or report view.</span>
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </DataTableCard>
        }
        side={
          <section className="portal-simple-side-card">
            <span>Scope</span>
            <strong>{role === "teacher" ? "Assigned classes" : "Admissions desk"}</strong>
            <p>
              {role === "teacher"
                ? "Reports focus on attendance and grades for class work."
                : "Reports focus on applications and payment follow-up."}
            </p>
            <StatusBadge tone="slate">{filteredRows.length} visible</StatusBadge>
          </section>
        }
      />
    </PlatformShell>
  );
}
