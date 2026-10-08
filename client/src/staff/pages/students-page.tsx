import { useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { Plus } from "lucide-react";
import type { NccPageDto, NccStudentDto } from "@/lib/backend/api";
import { formatAmount } from "../admissions";
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
import { SecretDialog, type StaffSecret } from "../ui/secret-dialog";
import { ServerSegments } from "../ui/server-segments";
import { useListQuery } from "../ui/use-list-query";
import { formatDate } from "./catalog-shared";
import { useBranches } from "./admissions-ui";
import { StudentForm } from "./student-form";

const S = copy.admissions.students;
const $ = copy.admissions.money;
const FILTER_KEYS = ["status", "branch"] as const;

export function FeeCell({
  student,
}: {
  student: Pick<NccStudentDto, "registration">;
}) {
  const fee = student.registration;
  if (!fee) return <span className="staff-muted">{S.noFee}</span>;
  const remaining = fee.remaining ?? fee.toBePaid - (fee.paid ?? 0);
  if (remaining <= 0)
    return (
      <span className="staff-balance" data-settled="true">
        {$.settled}
      </span>
    );
  return (
    <span className="staff-balance staff-figures">
      {formatAmount(remaining)}{" "}
      <span className="staff-muted">{$.remaining.toLowerCase()}</span>
    </span>
  );
}

export default function StudentsPage() {
  const { session } = useStaffSession();
  const role = session?.ncc?.activeRole ?? null;
  const allowed = isAdmissionsRole(role);
  const superAdmin = role === "super_admin";
  const branches = useBranches();
  const [, navigate] = useLocation();
  const [formOpen, setFormOpen] = useState(false);
  const [secrets, setSecrets] = useState<StaffSecret[] | null>(null);

  const url = useListQuery(FILTER_KEYS);
  const query = useMemo<StaffQuery>(() => {
    const next: StaffQuery = {
      pageSize: url.pageSize,
      ...(url.page ? { page: url.page } : {}),
      ...(url.q ? { q: url.q } : {}),
      status: url.status ?? "active",
      ...(url.branch ? { homeBranchId: url.branch } : {}),
    };
    return next;
  }, [url]);
  const { status: _status, page: _page, pageSize: _size, ...countBase } = query;
  const students = useNcc<NccPageDto<NccStudentDto>>(
    allowed ? "/api/ncc/admissions/students" : null,
    query,
    { keepPreviousData: true }
  );

  const filters: ListFilter[] =
    superAdmin && branches.active.length > 1
      ? [
          {
            key: "branch",
            label: S.branch,
            allLabel: S.allBranches,
            options: branches.active.map(branch => ({
              value: branch.id,
              label: branch.name,
            })),
          },
        ]
      : [];

  const columns: ListColumn<NccStudentDto>[] = [
    {
      id: "person",
      label: S.person,
      always: true,
      render: row => (
        <div className="staff-person">
          <Avatar name={row.name} seed={row.id} />
          <div className="staff-person-meta">
            <span className="staff-person-name">
              <Link
                href={`/app/students/${row.id}`}
                className="staff-stretch"
                title={row.name}
              >
                {row.name}
              </Link>
            </span>
            <span className="staff-person-email staff-ltr" title={row.email}>
              {row.email}
            </span>
          </div>
        </div>
      ),
    },
    { id: "branch", label: S.branch, render: row => row.branchName },
    {
      id: "moodle",
      label: S.moodle,
      render: row => (
        <StatusBadge
          status={row.moodleLinked ? "ok" : "plain"}
          label={row.moodleLinked ? S.moodleLinked : S.moodleMissing}
        />
      ),
    },
    {
      id: "fee",
      label: S.registration,
      render: row => <FeeCell student={row} />,
    },
    {
      id: "owner",
      label: S.owner,
      render: row =>
        row.assignedSsaName ?? (
          <span className="staff-muted">
            {copy.admissions.leads.unassigned}
          </span>
        ),
    },
    { id: "added", label: S.added, render: row => formatDate(row.createdAt) },
  ];

  if (!allowed)
    return <EmptyState title={copy.shell.noAccess} description={S.noAccess} />;
  const page = students.data;

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <PageHeader
        title={S.title}
        description={S.description}
        actions={
          <button
            type="button"
            className="staff-btn"
            data-variant="primary"
            onClick={() => setFormOpen(true)}
          >
            <Plus strokeWidth={1.75} aria-hidden />
            {S.add}
          </button>
        }
      />
      <ServerSegments
        path="/api/ncc/admissions/students"
        base={countBase}
        param="status"
        defaultValue="active"
        label={copy.catalog.shared.status}
        segments={(["active", "disabled"] as const).map(value => ({
          value,
          label: copy.status[value],
          query: { status: value },
        }))}
      />
      {students.error && !page ? (
        <ErrorState
          error={students.error}
          onRetry={() => void students.mutate()}
        />
      ) : !page ? (
        <LoadingRows />
      ) : (
        <ListPage
          title={S.title}
          listId="students"
          items={page.items}
          columns={columns}
          rowKey={row => row.id}
          searchText={row => row.name}
          filters={filters}
          server={{
            total: page.total,
            pageSize: page.pageSize,
            refreshing: students.isValidating,
          }}
          renderCard={row => (
            <>
              <Avatar name={row.name} seed={row.id} />
              <div className="staff-rowcard-main">
                <span className="staff-person-name">
                  <Link
                    href={`/app/students/${row.id}`}
                    className="staff-stretch"
                  >
                    {row.name}
                  </Link>
                </span>
                <span className="staff-person-email staff-ltr">
                  {row.email}
                </span>
                <div className="staff-rowcard-badges">
                  <StatusBadge
                    status={row.moodleLinked ? "ok" : "plain"}
                    label={row.moodleLinked ? S.moodleLinked : S.moodleMissing}
                  />
                  <FeeCell student={row} />
                </div>
              </div>
            </>
          )}
          empty={<EmptyState title={S.empty} description={S.emptyHint} />}
        />
      )}
      <StudentForm
        open={formOpen}
        onOpenChange={setFormOpen}
        student={null}
        onSecrets={setSecrets}
        onSaved={student => navigate(`/app/students/${student.id}`)}
      />
      <SecretDialog secrets={secrets} onClose={() => setSecrets(null)} />
    </div>
  );
}
