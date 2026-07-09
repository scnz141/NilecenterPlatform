import { useMemo, useState, type ReactElement } from "react";
import { BarChart3, Download, Search } from "lucide-react";
import { Link } from "wouter";
import PlatformShell from "@/components/platform/PlatformShell";
import { ReportLayout } from "@/components/platform/PlatformLayouts";
import {
  DataTableCard,
  StatusBadge,
} from "@/components/platform/PlatformPrimitives";
import { platformStore } from "@/lib/domain/store";
import type {
  AttendanceStatus,
  CertificateStatus,
  PaymentStatus,
} from "@/lib/domain/types";

type AdminReportsPageProps = {
  view:
    | "overview"
    | "attendance"
    | "finance"
    | "certificates"
    | "admissions"
    | "classes"
    | "saved-views";
};

type ReportArea = {
  title: string;
  purpose: string;
  rows: number;
  href: string;
  available: boolean;
};

type ReportRow = Record<string, string | number>;

function formatDateTime(value?: string) {
  if (!value) return "No date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No date";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function statusTone(status: string): "green" | "amber" | "red" | "slate" {
  if (
    ["present", "paid", "active", "approved", "issued", "completed"].includes(
      status
    )
  )
    return "green";
  if (
    ["late", "excused", "pending", "pending_approval", "issued"].includes(
      status
    )
  )
    return "amber";
  if (
    [
      "absent",
      "overdue",
      "rejected",
      "revoked",
      "cancelled",
      "refunded",
    ].includes(status)
  )
    return "red";
  return "slate";
}

function attendanceTone(
  status: AttendanceStatus
): "green" | "amber" | "red" | "slate" {
  if (status === "present") return "green";
  if (status === "late" || status === "excused") return "amber";
  if (status === "absent") return "red";
  return "slate";
}

function downloadCsv(filename: string, rows: Array<Array<string | number>>) {
  const csv = rows
    .map(row =>
      row.map(value => `"${String(value).replaceAll('"', '""')}"`).join(",")
    )
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function AdminReportsPage({ view }: AdminReportsPageProps) {
  const state = useMemo(() => platformStore.getState(), []);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");

  const studentUserName = (studentId?: string) => {
    const student = state.students.find(item => item.id === studentId);
    return (
      state.users.find(item => item.id === student?.userId)?.name ?? "Student"
    );
  };

  const branchForStudent = (studentId?: string) => {
    const enrollment = state.enrollments.find(
      item => item.studentId === studentId
    );
    const run = state.courseRuns.find(
      item => item.id === enrollment?.courseRunId
    );
    return (
      state.branches.find(item => item.id === run?.branchId)?.name ??
      "Unassigned"
    );
  };

  const courseTitle = (courseId?: string) =>
    state.courses.find(item => item.id === courseId)?.title ?? "Course";

  const branchName = (branchId?: string) =>
    state.branches.find(item => item.id === branchId)?.name ?? "Branch";

  const teacherName = (teacherId?: string) =>
    state.users.find(item => item.id === teacherId)?.name ?? "Teacher";

  const matchesSearch = (values: Array<string | number | undefined>) =>
    values.join(" ").toLowerCase().includes(search.toLowerCase());

  const matchesStatus = (value: string) => status === "all" || value === status;

  const reportAreas: ReportArea[] = [
    {
      title: "Attendance",
      purpose: "Class attendance records and exceptions.",
      rows: state.attendance.length,
      href: "/app/admin/reports/attendance",
      available: true,
    },
    {
      title: "Finance",
      purpose: "Payments and invoice follow-up.",
      rows: state.invoices.length,
      href: "/app/admin/reports/finance",
      available: true,
    },
    {
      title: "Admissions",
      purpose: "Leads, applications, and placement activity.",
      rows:
        state.applications.length +
        state.leads.length +
        state.placementTests.length,
      href: "/app/admin/reports/admissions",
      available: true,
    },
    {
      title: "Certificates",
      purpose: "Certificate approvals and issue status.",
      rows: state.certificates.length,
      href: "/app/admin/reports/certificates",
      available: true,
    },
    {
      title: "Classes",
      purpose: "Class groups, branches, and learner counts.",
      rows: state.classGroups.length,
      href: "/app/admin/reports/classes",
      available: true,
    },
    {
      title: "Saved views",
      purpose: "Saved report filters for repeat checks.",
      rows: state.reportPresets.length,
      href: "/app/admin/reports/saved-views",
      available: true,
    },
  ];

  const attendanceRows = state.attendance
    .map(record => {
      const student = state.students.find(item => item.id === record.studentId);
      const user = state.users.find(item => item.id === student?.userId);
      const group = state.classGroups.find(
        item => item.id === record.classGroupId
      );
      const run = state.courseRuns.find(item => item.id === group?.courseRunId);
      const event = state.events.find(item => item.id === record.sessionId);
      const branch = state.branches.find(item => item.id === run?.branchId);
      return {
        ...record,
        studentName: user?.name ?? "Student",
        className: group?.name ?? "Class",
        branchName: branch?.name ?? "Branch",
        date: event?.startsAt,
      };
    })
    .filter(record => {
      const text = [
        record.studentName,
        record.className,
        record.branchName,
        record.notes,
        record.status,
      ]
        .join(" ")
        .toLowerCase();
      return (
        text.includes(search.toLowerCase()) && matchesStatus(record.status)
      );
    });

  const financeRows = state.invoices
    .map(invoice => {
      const payments = state.payments.filter(
        item => item.invoiceId === invoice.id
      );
      const paid = payments.reduce((sum, item) => sum + item.amount, 0);
      return {
        ...invoice,
        studentName: studentUserName(invoice.studentId),
        branchName: branchForStudent(invoice.studentId),
        paid,
      };
    })
    .filter(
      row =>
        matchesSearch([
          row.studentName,
          row.branchName,
          row.status,
          row.amount,
          row.currency,
        ]) && matchesStatus(row.status)
    );

  const certificateRows = state.certificates
    .map(certificate => ({
      ...certificate,
      studentName: studentUserName(certificate.studentId),
      courseTitle: courseTitle(certificate.courseId),
    }))
    .filter(
      row =>
        matchesSearch([
          row.studentName,
          row.courseTitle,
          row.status,
          row.grade,
        ]) && matchesStatus(row.status)
    );

  const admissionRows = [
    ...state.leads.map(lead => ({
      id: lead.id,
      person: lead.fullName,
      stage: "Lead",
      branch: "Unassigned",
      course: lead.subject,
      status: lead.status,
      date: lead.createdAt,
    })),
    ...state.applications.map(application => {
      const lead = state.leads.find(item => item.id === application.leadId);
      return {
        id: application.id,
        person: lead?.fullName ?? "Applicant",
        stage: "Application",
        branch: branchName(application.branchId),
        course: application.courseInterest,
        status: application.status,
        date: lead?.createdAt,
      };
    }),
    ...state.placementTests.map(test => ({
      id: test.id,
      person: test.fullName,
      stage: "Placement",
      branch: branchName(test.branchId),
      course: test.subject,
      status: test.status,
      date: test.preferredDate,
    })),
  ].filter(
    row =>
      matchesSearch([
        row.person,
        row.stage,
        row.branch,
        row.course,
        row.status,
      ]) && matchesStatus(row.status)
  );

  const classRows = state.classGroups
    .map(group => {
      const run = state.courseRuns.find(item => item.id === group.courseRunId);
      return {
        ...group,
        courseTitle: courseTitle(run?.courseId),
        branchName: branchName(run?.branchId),
        teacherName: teacherName(run?.teacherId),
        status: run?.status ?? "draft",
      };
    })
    .filter(
      row =>
        matchesSearch([
          row.name,
          row.courseTitle,
          row.branchName,
          row.teacherName,
          row.status,
        ]) && matchesStatus(row.status)
    );

  const savedViewRows = state.reportPresets
    .filter(
      preset => view !== "saved-views" || matchesStatus(preset.reportType)
    )
    .filter(preset =>
      matchesSearch([
        preset.label,
        preset.role,
        preset.reportType,
        preset.search,
        preset.status,
      ])
    );

  const summaryForView = () => {
    if (view === "attendance")
      return `${attendanceRows.length} attendance rows`;
    if (view === "finance") return `${financeRows.length} invoice rows`;
    if (view === "certificates")
      return `${certificateRows.length} certificate rows`;
    if (view === "admissions") return `${admissionRows.length} pipeline rows`;
    if (view === "classes") return `${classRows.length} class rows`;
    if (view === "saved-views") return `${savedViewRows.length} saved views`;
    return `${reportAreas.length} report areas`;
  };

  const reportRows: ReportRow[] = (() => {
    if (view === "attendance") {
      return attendanceRows.map(record => ({
        Student: record.studentName,
        Class: record.className,
        Branch: record.branchName,
        Date: formatDateTime(record.date),
        Status: record.status,
        Notes: record.notes ?? "",
      }));
    }
    if (view === "finance") {
      return financeRows.map(row => ({
        Student: row.studentName,
        Branch: row.branchName,
        Amount: `${row.amount} ${row.currency}`,
        Paid: `${row.paid} ${row.currency}`,
        Due: formatDateTime(row.dueAt),
        Status: row.status,
      }));
    }
    if (view === "certificates") {
      return certificateRows.map(row => ({
        Student: row.studentName,
        Course: row.courseTitle,
        Grade: `${row.grade}%`,
        Attendance: `${row.attendanceRate}%`,
        Status: row.status,
        Issued: formatDateTime(row.issuedAt),
      }));
    }
    if (view === "admissions") {
      return admissionRows.map(row => ({
        Applicant: row.person,
        Stage: row.stage,
        Branch: row.branch,
        Course: row.course,
        Status: row.status,
        Date: formatDateTime(row.date),
      }));
    }
    if (view === "classes") {
      return classRows.map(row => ({
        Class: row.name,
        Course: row.courseTitle,
        Teacher: row.teacherName,
        Branch: row.branchName,
        Learners: row.studentIds.length,
        Status: row.status,
      }));
    }
    if (view === "saved-views") {
      return savedViewRows.map(row => ({
        View: row.label,
        Report: row.reportType,
        Role: row.role,
        Filter: row.search || row.status,
        Rows: row.rowCount,
        Created: formatDateTime(row.createdAt),
      }));
    }
    return [];
  })();

  const exportRows = [
    Object.keys(reportRows[0] ?? { Report: "No rows" }),
    ...reportRows.map(row => Object.values(row)),
  ];

  const overview = (
    <DataTableCard
      title="Report areas"
      subtitle="Choose one area to review"
      className="admin-ia-table-card admin-reports-overview-table"
    >
      <div className="admin-ia-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Area</th>
              <th>Purpose</th>
              <th>Rows</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {reportAreas.map(area => (
              <tr key={area.title}>
                <td>
                  <strong>{area.title}</strong>
                  <small>{area.available ? "Ready" : "Planned"}</small>
                </td>
                <td>{area.purpose}</td>
                <td>{area.rows}</td>
                <td>
                  {area.available ? (
                    <Link className="platform-row-link" href={area.href}>
                      Open
                    </Link>
                  ) : (
                    <StatusBadge tone="slate">Not ready</StatusBadge>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </DataTableCard>
  );

  const attendance = (
    <DataTableCard
      title="Attendance records"
      subtitle={`${attendanceRows.length} matching record(s)`}
      className="admin-ia-table-card admin-reports-attendance-table"
    >
      <div className="admin-ia-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Student</th>
              <th>Class</th>
              <th>Branch</th>
              <th>Date</th>
              <th>Status</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {attendanceRows.map(record => (
              <tr key={record.id}>
                <td>
                  <strong>{record.studentName}</strong>
                  <small>{record.id}</small>
                </td>
                <td>{record.className}</td>
                <td>{record.branchName}</td>
                <td>{formatDateTime(record.date)}</td>
                <td>
                  <StatusBadge tone={attendanceTone(record.status)}>
                    {record.status}
                  </StatusBadge>
                </td>
                <td>{record.notes || "No note"}</td>
              </tr>
            ))}
            {!attendanceRows.length ? (
              <tr>
                <td colSpan={6}>
                  <div className="platform-empty-state">
                    <strong>No attendance records</strong>
                    <span>Try a different search or status filter.</span>
                  </div>
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </DataTableCard>
  );

  const finance = (
    <DataTableCard
      title="Finance report"
      subtitle={`${financeRows.length} matching invoice(s)`}
      className="admin-ia-table-card admin-reports-finance-table"
    >
      <div className="admin-ia-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Student</th>
              <th>Branch</th>
              <th>Amount</th>
              <th>Paid</th>
              <th>Due</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {financeRows.map(row => (
              <tr key={row.id}>
                <td>
                  <strong>{row.studentName}</strong>
                  <small>{row.id}</small>
                </td>
                <td>{row.branchName}</td>
                <td>
                  {row.amount} {row.currency}
                </td>
                <td>
                  {row.paid} {row.currency}
                </td>
                <td>{formatDateTime(row.dueAt)}</td>
                <td>
                  <StatusBadge tone={statusTone(row.status)}>
                    {row.status}
                  </StatusBadge>
                </td>
              </tr>
            ))}
            {!financeRows.length ? (
              <tr>
                <td colSpan={6}>
                  <div className="platform-empty-state">
                    <strong>No invoice rows</strong>
                    <span>Try a different search or payment status.</span>
                  </div>
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </DataTableCard>
  );

  const certificates = (
    <DataTableCard
      title="Certificate report"
      subtitle={`${certificateRows.length} matching certificate(s)`}
      className="admin-ia-table-card admin-reports-certificates-table"
    >
      <div className="admin-ia-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Student</th>
              <th>Course</th>
              <th>Grade</th>
              <th>Attendance</th>
              <th>Status</th>
              <th>Issued</th>
            </tr>
          </thead>
          <tbody>
            {certificateRows.map(row => (
              <tr key={row.id}>
                <td>
                  <strong>{row.studentName}</strong>
                  <small>{row.verificationCode}</small>
                </td>
                <td>{row.courseTitle}</td>
                <td>{row.grade}%</td>
                <td>{row.attendanceRate}%</td>
                <td>
                  <StatusBadge tone={statusTone(row.status)}>
                    {row.status}
                  </StatusBadge>
                </td>
                <td>{formatDateTime(row.issuedAt)}</td>
              </tr>
            ))}
            {!certificateRows.length ? (
              <tr>
                <td colSpan={6}>
                  <div className="platform-empty-state">
                    <strong>No certificates</strong>
                    <span>Try a different search or certificate status.</span>
                  </div>
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </DataTableCard>
  );

  const admissions = (
    <DataTableCard
      title="Admissions report"
      subtitle={`${admissionRows.length} matching pipeline row(s)`}
      className="admin-ia-table-card admin-reports-admissions-table"
    >
      <div className="admin-ia-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Applicant</th>
              <th>Stage</th>
              <th>Branch</th>
              <th>Course</th>
              <th>Status</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {admissionRows.map(row => (
              <tr key={row.id}>
                <td>
                  <strong>{row.person}</strong>
                  <small>{row.id}</small>
                </td>
                <td>{row.stage}</td>
                <td>{row.branch}</td>
                <td>{row.course}</td>
                <td>
                  <StatusBadge tone={statusTone(row.status)}>
                    {row.status}
                  </StatusBadge>
                </td>
                <td>{formatDateTime(row.date)}</td>
              </tr>
            ))}
            {!admissionRows.length ? (
              <tr>
                <td colSpan={6}>
                  <div className="platform-empty-state">
                    <strong>No admissions rows</strong>
                    <span>Try a different applicant or status filter.</span>
                  </div>
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </DataTableCard>
  );

  const classes = (
    <DataTableCard
      title="Classes report"
      subtitle={`${classRows.length} matching class(es)`}
      className="admin-ia-table-card admin-reports-classes-table"
    >
      <div className="admin-ia-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Class</th>
              <th>Course</th>
              <th>Teacher</th>
              <th>Branch</th>
              <th>Learners</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {classRows.map(row => (
              <tr key={row.id}>
                <td>
                  <strong>{row.name}</strong>
                  <small>{row.schedule}</small>
                </td>
                <td>{row.courseTitle}</td>
                <td>{row.teacherName}</td>
                <td>{row.branchName}</td>
                <td>{row.studentIds.length}</td>
                <td>
                  <StatusBadge tone={statusTone(row.status)}>
                    {row.status}
                  </StatusBadge>
                </td>
              </tr>
            ))}
            {!classRows.length ? (
              <tr>
                <td colSpan={6}>
                  <div className="platform-empty-state">
                    <strong>No classes</strong>
                    <span>Try a different class, branch, or status.</span>
                  </div>
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </DataTableCard>
  );

  const savedViews = (
    <DataTableCard
      title="Saved report views"
      subtitle={`${savedViewRows.length} saved view(s)`}
      className="admin-ia-table-card admin-reports-saved-table"
    >
      <div className="admin-ia-table-wrap">
        <table>
          <thead>
            <tr>
              <th>View</th>
              <th>Report</th>
              <th>Role</th>
              <th>Filter</th>
              <th>Rows</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {savedViewRows.map(row => (
              <tr key={row.id}>
                <td>
                  <strong>{row.label}</strong>
                  <small>{row.id}</small>
                </td>
                <td>{row.reportType}</td>
                <td>{row.role}</td>
                <td>{row.search || row.status}</td>
                <td>{row.rowCount}</td>
                <td>{formatDateTime(row.createdAt)}</td>
              </tr>
            ))}
            {!savedViewRows.length ? (
              <tr>
                <td colSpan={6}>
                  <div className="platform-empty-state">
                    <strong>No saved views</strong>
                    <span>Saved report filters will appear here.</span>
                  </div>
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </DataTableCard>
  );

  const mainByView = {
    overview,
    attendance,
    finance,
    certificates,
    admissions,
    classes,
    "saved-views": savedViews,
  } satisfies Record<AdminReportsPageProps["view"], ReactElement>;

  const titleByView: Record<AdminReportsPageProps["view"], string> = {
    overview: "Reports",
    attendance: "Attendance report",
    finance: "Finance report",
    certificates: "Certificate report",
    admissions: "Admissions report",
    classes: "Classes report",
    "saved-views": "Saved views",
  };

  const descriptionByView: Record<AdminReportsPageProps["view"], string> = {
    overview: "Choose one report area to open.",
    attendance: "Filter and export attendance records.",
    finance: "Review invoices and payment follow-up.",
    certificates: "Review certificate status and issue readiness.",
    admissions: "Review leads, applications, and placement activity.",
    classes: "Review class groups, teachers, branches, and learner counts.",
    "saved-views": "Review saved report filters.",
  };

  const tabs = [
    {
      href: "/app/admin/reports",
      label: "Overview",
      active: view === "overview",
    },
    {
      href: "/app/admin/reports/attendance",
      label: "Attendance",
      active: view === "attendance",
    },
    {
      href: "/app/admin/reports/finance",
      label: "Finance",
      active: view === "finance",
    },
    {
      href: "/app/admin/reports/certificates",
      label: "Certificates",
      active: view === "certificates",
    },
    {
      href: "/app/admin/reports/admissions",
      label: "Admissions",
      active: view === "admissions",
    },
    {
      href: "/app/admin/reports/classes",
      label: "Classes",
      active: view === "classes",
    },
    {
      href: "/app/admin/reports/saved-views",
      label: "Saved views",
      active: view === "saved-views",
    },
  ];

  const statusOptions: Record<
    Exclude<AdminReportsPageProps["view"], "overview">,
    Array<{ value: string; label: string }>
  > = {
    attendance: [
      { value: "all", label: "All statuses" },
      { value: "present", label: "Present" },
      { value: "late", label: "Late" },
      { value: "absent", label: "Absent" },
      { value: "excused", label: "Excused" },
    ],
    finance: [
      { value: "all", label: "All statuses" },
      { value: "pending", label: "Pending" },
      { value: "paid", label: "Paid" },
      { value: "overdue", label: "Overdue" },
      { value: "issued", label: "Issued" },
    ] satisfies Array<{ value: PaymentStatus | "all"; label: string }>,
    certificates: [
      { value: "all", label: "All statuses" },
      { value: "pending_approval", label: "Pending" },
      { value: "approved", label: "Approved" },
      { value: "issued", label: "Issued" },
      { value: "rejected", label: "Rejected" },
    ] satisfies Array<{ value: CertificateStatus | "all"; label: string }>,
    admissions: [
      { value: "all", label: "All statuses" },
      { value: "lead", label: "Lead" },
      { value: "active", label: "Active" },
      { value: "pending", label: "Pending" },
      { value: "approved", label: "Approved" },
      { value: "ready_to_enroll", label: "Ready" },
    ],
    classes: [
      { value: "all", label: "All statuses" },
      { value: "active", label: "Active" },
      { value: "paused", label: "Paused" },
      { value: "completed", label: "Completed" },
    ],
    "saved-views": [
      { value: "all", label: "All reports" },
      { value: "attendance", label: "Attendance" },
      { value: "finance", label: "Finance" },
      { value: "enrollments", label: "Admissions" },
      { value: "audit", label: "Activity" },
    ],
  };

  const searchableView = view !== "overview";
  const searchPlaceholder =
    view === "attendance"
      ? "Search attendance"
      : `Search ${titleByView[view].toLowerCase()}`;

  return (
    <PlatformShell role="superadmin" title="Reports">
      <ReportLayout
        className="admin-ia-page admin-reports-page"
        title={titleByView[view]}
        description={descriptionByView[view]}
        actions={
          searchableView ? (
            <button
              type="button"
              className="platform-primary-button"
              onClick={() => downloadCsv(`nile-${view}-report.csv`, exportRows)}
            >
              <Download size={15} />
              Export CSV
            </button>
          ) : (
            <Link
              className="platform-primary-button"
              href="/app/admin/reports/attendance"
            >
              <BarChart3 size={15} />
              Open attendance
            </Link>
          )
        }
        toolbar={
          <div className="admin-ia-control-row">
            <nav className="admin-ia-subnav" aria-label="Report sections">
              {tabs.map(tab => (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={tab.active ? "active" : ""}
                >
                  {tab.label}
                </Link>
              ))}
            </nav>
            {searchableView ? (
              <div className="admin-ia-toolbar">
                <label className="admin-ia-search">
                  <Search size={16} />
                  <input
                    value={search}
                    onChange={event => setSearch(event.target.value)}
                    placeholder={searchPlaceholder}
                    aria-label={searchPlaceholder}
                  />
                </label>
                <label>
                  {view === "saved-views" ? "Type" : "Status"}
                  <select
                    value={status}
                    onChange={event => setStatus(event.target.value)}
                  >
                    {statusOptions[view].map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <span className="admin-ia-toolbar-count">
                  {summaryForView()}
                </span>
              </div>
            ) : null}
          </div>
        }
        main={mainByView[view]}
      />
    </PlatformShell>
  );
}
