import { useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { Plus } from "lucide-react";
import type { NccClassDto, NccPageDto } from "@/lib/backend/api";
import { useNcc, type StaffQuery } from "../api";
import { copy } from "../copy";
import { isClassCatalogWriter } from "../roles";
import { useStaffSession } from "../session";
import { scheduleText } from "../teaching";
import { ListPage, type ListColumn, type ListFilter } from "../ui/list-page";
import { EmptyState, ErrorState, LoadingRows, PageHeader, StatusBadge } from "../ui/primitives";
import { ServerSegments } from "../ui/server-segments";
import { useListQuery } from "../ui/use-list-query";
import { useActiveCourses, useBranches } from "./admissions-ui";
import { formatDate } from "./catalog-shared";
import { SeatsMeter } from "./teaching-ui";
import { ClassForm } from "./class-form";

const K = copy.teaching.classes;
const FILTER_KEYS = ["status", "course", "branch"] as const;

export default function ClassesPage() {
  const { session } = useStaffSession();
  const role = session?.ncc?.activeRole ?? null;
  const canWrite = isClassCatalogWriter(role);
  const superAdmin = role === "super_admin";
  const branches = useBranches();
  const courses = useActiveCourses();
  const [, navigate] = useLocation();
  const [formOpen, setFormOpen] = useState(false);

  const url = useListQuery(FILTER_KEYS);
  const query = useMemo<StaffQuery>(
    () => ({
      pageSize: url.pageSize,
      ...(url.page ? { page: url.page } : {}),
      ...(url.q ? { q: url.q } : {}),
      status: url.status ?? "active",
      ...(url.course ? { courseId: url.course } : {}),
      ...(url.branch ? { branchId: url.branch } : {}),
    }),
    [url]
  );
  const { status: _status, page: _page, pageSize: _size, ...countBase } = query;
  const classes = useNcc<NccPageDto<NccClassDto>>("/api/ncc/delivery/classes", query, {
    keepPreviousData: true,
  });

  const filters: ListFilter[] = [
    ...(courses.length > 1
      ? [{ key: "course", label: K.course, allLabel: K.allCourses, options: courses }]
      : []),
    ...(superAdmin && branches.active.length > 1
      ? [
          {
            key: "branch",
            label: copy.teaching.branch,
            allLabel: copy.teaching.allBranches,
            options: branches.active.map(branch => ({ value: branch.id, label: branch.name })),
          },
        ]
      : []),
  ];

  const columns: ListColumn<NccClassDto>[] = [
    {
      id: "class",
      label: K.title,
      always: true,
      render: row => (
        <span className="staff-cell-stack">
          <Link href={`/app/classes/${row.id}`} className="staff-stretch staff-link-quiet" title={row.name}>
            {row.name}
          </Link>
          <span className="staff-muted">
            {row.courseName} · {row.kind === "individual" ? K.individual : K.group}
          </span>
        </span>
      ),
    },
    {
      id: "teachers",
      label: K.teachers,
      render: row =>
        row.teachers.length ? (
          <span className="staff-nowrap" title={row.teachers.map(t => t.name).join(", ")}>
            {row.teachers[0].name}
            {row.teachers.length > 1 ? <span className="staff-tag">+{row.teachers.length - 1}</span> : null}
          </span>
        ) : (
          <StatusBadge status="pending" label={K.noTeacher} />
        ),
    },
    {
      id: "schedule",
      label: K.usualTime,
      render: row => scheduleText(row.schedule) ?? <span className="staff-muted">{K.noSchedule}</span>,
    },
    { id: "fill", label: K.fill, render: row => <SeatsMeter item={row} /> },
    {
      id: "moodle",
      label: K.moodleGroup,
      render: row => (
        <StatusBadge status={row.moodleGroupId ? "ok" : "plain"} label={row.moodleGroupId ? K.moodleLinked : K.moodleMissing} />
      ),
    },
    { id: "branch", label: copy.teaching.branch, defaultHidden: !superAdmin, render: row => row.branchName },
    {
      id: "dates",
      label: K.dates,
      defaultHidden: true,
      render: row => `${formatDate(row.startAt)} – ${formatDate(row.endAt)}`,
    },
  ];

  const page = classes.data;
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <PageHeader
        title={K.title}
        description={K.description}
        actions={
          canWrite ? (
            <button type="button" className="staff-btn" data-variant="primary" onClick={() => setFormOpen(true)}>
              <Plus strokeWidth={1.75} aria-hidden />
              {K.add}
            </button>
          ) : undefined
        }
      />
      <ServerSegments
        path="/api/ncc/delivery/classes"
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
      {classes.error && !page ? (
        <ErrorState error={classes.error} onRetry={() => void classes.mutate()} />
      ) : !page ? (
        <LoadingRows />
      ) : (
        <ListPage
          title={K.title}
          listId="classes"
          items={page.items}
          columns={columns}
          rowKey={row => row.id}
          searchText={row => row.name}
          filters={filters}
          server={{ total: page.total, pageSize: page.pageSize, refreshing: classes.isValidating }}
          renderCard={row => (
            <div className="staff-rowcard-main">
              <span className="staff-person-name">
                <Link href={`/app/classes/${row.id}`} className="staff-stretch">
                  {row.name}
                </Link>
              </span>
              <span className="staff-muted">
                {row.courseName} · {scheduleText(row.schedule) ?? K.noSchedule}
              </span>
              <div className="staff-rowcard-badges">
                <SeatsMeter item={row} />
                <StatusBadge status={row.moodleGroupId ? "ok" : "plain"} label={row.moodleGroupId ? K.moodleLinked : K.moodleMissing} />
              </div>
            </div>
          )}
          empty={<EmptyState title={K.empty} description={canWrite ? K.emptyHint : undefined} />}
        />
      )}
      <ClassForm
        open={formOpen}
        onOpenChange={setFormOpen}
        item={null}
        onSaved={item => navigate(`/app/classes/${item.id}`)}
      />
    </div>
  );
}
