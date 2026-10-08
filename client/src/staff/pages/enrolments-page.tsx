import { useMemo, useState } from "react";
import { Link } from "wouter";
import { Plus } from "lucide-react";
import type { NccEnrolmentDto, NccPageDto } from "@/lib/backend/api";
import { useNcc, type StaffQuery } from "../api";
import { copy } from "../copy";
import { isAdmissionsRole } from "../roles";
import { useStaffSession } from "../session";
import { ListPage, type ListColumn, type ListFilter } from "../ui/list-page";
import {
  Avatar,
  EmptyState,
  ErrorState,
  LoadingRows,
  PageHeader,
  StatusBadge,
} from "../ui/primitives";
import { ServerSegments } from "../ui/server-segments";
import { useListQuery } from "../ui/use-list-query";
import { formatDate } from "./catalog-shared";
import { useActiveCourses, useBranches } from "./admissions-ui";
import {
  BalanceCell,
  kindLabel,
  SaleSheet,
  useEnrolmentActions,
} from "./enrolment-actions";

const E = copy.admissions.enrolments;
const FILTER_KEYS = ["status", "kind", "course", "branch"] as const;
const STATUSES = [
  "waiting",
  "enrolled",
  "completed",
  "left",
  "cancelled",
  "all",
] as const;

function statusTab(value: (typeof STATUSES)[number]) {
  if (value === "waiting") return E.waiting;
  if (value === "all") return copy.staffUsers.all;
  return copy.status[value];
}

export default function EnrolmentsPage() {
  const { session } = useStaffSession();
  const role = session?.ncc?.activeRole ?? null;
  const allowed = isAdmissionsRole(role);
  const superAdmin = role === "super_admin";
  const branches = useBranches();
  const courses = useActiveCourses(allowed);
  const actions = useEnrolmentActions();
  const [saleOpen, setSaleOpen] = useState(false);

  const url = useListQuery(FILTER_KEYS);
  const query = useMemo<StaffQuery>(
    () => ({
      pageSize: url.pageSize,
      ...(url.page ? { page: url.page } : {}),
      ...(url.q ? { q: url.q } : {}),
      status: url.status ?? "waiting",
      ...(url.kind ? { kind: url.kind } : {}),
      ...(url.course ? { courseId: url.course } : {}),
      ...(url.branch ? { branchId: url.branch } : {}),
    }),
    [url]
  );
  const { status: _status, page: _page, pageSize: _size, ...countBase } = query;
  const list = useNcc<NccPageDto<NccEnrolmentDto>>(
    allowed ? "/api/ncc/admissions/enrolments" : null,
    query,
    { keepPreviousData: true }
  );

  const filters: ListFilter[] = [
    {
      key: "kind",
      label: E.kind,
      allLabel: E.kind,
      options: [
        { value: "group", label: E.group },
        { value: "individual", label: E.individual },
      ],
    },
    ...(courses.length
      ? [
          {
            key: "course",
            label: E.course,
            allLabel: E.course,
            options: courses,
          },
        ]
      : []),
    ...(superAdmin && branches.active.length > 1
      ? [
          {
            key: "branch",
            label: E.branch,
            allLabel: copy.admissions.students.allBranches,
            options: branches.active.map(branch => ({
              value: branch.id,
              label: branch.name,
            })),
          },
        ]
      : []),
  ];

  const columns: ListColumn<NccEnrolmentDto>[] = [
    {
      id: "student",
      label: E.student,
      always: true,
      render: row => (
        <div className="staff-person">
          <Avatar name={row.studentName} seed={row.studentId} />
          <div className="staff-person-meta">
            <span className="staff-person-name">
              <Link
                href={`/app/students/${row.studentId}?tab=courses`}
                className="staff-stretch"
                title={row.studentName}
              >
                {row.studentName}
              </Link>
            </span>
            <span className="staff-person-email staff-ltr">
              {row.student.email}
            </span>
          </div>
        </div>
      ),
    },
    {
      id: "course",
      label: E.course,
      render: row => (
        <span className="staff-cell-stack">
          <span className="staff-nowrap" title={row.courseName}>
            {row.courseName}
          </span>
          <span
            className="staff-muted staff-nowrap"
            title={row.className ?? E.noClass}
          >
            {kindLabel(row.kind)}
            {row.nextLevel ? ` · ${E.nextLevel}` : ""} ·{" "}
            {row.className ?? E.noClass}
          </span>
        </span>
      ),
    },
    {
      id: "status",
      label: copy.catalog.shared.status,
      render: row => <StatusBadge status={row.status} />,
    },
    {
      id: "balance",
      label: E.balance,
      render: row => <BalanceCell enrolment={row} />,
    },
    {
      id: "branch",
      label: E.branch,
      defaultHidden: !superAdmin,
      render: row => row.branchName,
    },
    {
      id: "opened",
      label: E.opened,
      render: row =>
        row.enrolledAt ? formatDate(row.enrolledAt) : copy.state.notSet,
    },
    {
      id: "actions",
      label: "",
      always: true,
      render: row => actions.menu(row),
    },
  ];

  if (!allowed)
    return <EmptyState title={copy.shell.noAccess} description={E.noAccess} />;
  const page = list.data;

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <PageHeader
        title={E.title}
        description={E.description}
        actions={
          <button
            type="button"
            className="staff-btn"
            data-variant="primary"
            onClick={() => setSaleOpen(true)}
          >
            <Plus strokeWidth={1.75} aria-hidden />
            {E.sell}
          </button>
        }
      />
      <ServerSegments
        path="/api/ncc/admissions/enrolments"
        base={countBase}
        param="status"
        defaultValue="waiting"
        label={copy.catalog.shared.status}
        segments={STATUSES.map(value => ({
          value,
          label: statusTab(value),
          query: { status: value },
        }))}
      />
      {list.error && !page ? (
        <ErrorState error={list.error} onRetry={() => void list.mutate()} />
      ) : !page ? (
        <LoadingRows />
      ) : (
        <ListPage
          title={E.title}
          listId="enrolments"
          items={page.items}
          columns={columns}
          rowKey={row => row.id}
          searchText={row => row.studentName}
          filters={filters}
          server={{
            total: page.total,
            pageSize: page.pageSize,
            refreshing: list.isValidating,
          }}
          renderCard={row => (
            <>
              <Avatar name={row.studentName} seed={row.studentId} />
              <div className="staff-rowcard-main">
                <span className="staff-person-name">
                  <Link
                    href={`/app/students/${row.studentId}?tab=courses`}
                    className="staff-stretch"
                  >
                    {row.studentName}
                  </Link>
                </span>
                <span className="staff-muted">
                  {row.courseName} · {kindLabel(row.kind)}
                </span>
                <div className="staff-rowcard-badges">
                  <StatusBadge status={row.status} />
                  <BalanceCell enrolment={row} />
                </div>
              </div>
              <div className="staff-cell-top">{actions.menu(row)}</div>
            </>
          )}
          empty={<EmptyState title={E.empty} description={E.emptyHint} />}
        />
      )}
      {actions.dialogs}
      <SaleSheet open={saleOpen} onOpenChange={setSaleOpen} student={null} />
    </div>
  );
}
