import { useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { Plus, RefreshCw } from "lucide-react";
import { refreshNccCoursesRequest, type NccCourseDto, type NccPageDto } from "@/lib/backend/api";
import { staffQueryString, staffWrite, useInvalidate, useNcc, type StaffQuery } from "../api";
import { copy } from "../copy";
import { runAction } from "../run-action";
import { useStaffSession } from "../session";
import { ListPage, type ListColumn, type ListFilter } from "../ui/list-page";
import { EmptyState, ErrorState, LoadingRows, PageHeader } from "../ui/primitives";
import { ServerSegments } from "../ui/server-segments";
import { useListQuery } from "../ui/use-list-query";
import { CourseForm, useDepartments } from "./course-form";
import { courseTitle, MoodleState } from "./teaching-ui";

const C = copy.teaching.courses;
const FILTER_KEYS = ["status", "department"] as const;

export default function CoursesPage() {
  const { session } = useStaffSession();
  const superAdmin = session?.ncc?.activeRole === "super_admin";
  const departments = useDepartments();
  const invalidate = useInvalidate();
  const [, navigate] = useLocation();
  const [formOpen, setFormOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const url = useListQuery(FILTER_KEYS);
  const query = useMemo<StaffQuery>(
    () => ({
      pageSize: url.pageSize,
      ...(url.page ? { page: url.page } : {}),
      ...(url.q ? { q: url.q } : {}),
      status: url.status ?? "active",
      ...(url.department ? { departmentId: url.department } : {}),
    }),
    [url]
  );
  const { status: _status, page: _page, pageSize: _size, ...countBase } = query;
  const courses = useNcc<NccPageDto<NccCourseDto>>("/api/ncc/delivery/courses", query, {
    keepPreviousData: true,
  });

  const filters: ListFilter[] =
    departments.length > 1
      ? [
          {
            key: "department",
            label: C.department,
            allLabel: C.allDepartments,
            options: departments.map(item => ({ value: item.id, label: item.name })),
          },
        ]
      : [];

  const columns: ListColumn<NccCourseDto>[] = [
    {
      id: "course",
      label: C.course,
      always: true,
      render: row => (
        <span className="staff-cell-stack">
          <Link href={`/app/courses/${row.id}`} className="staff-stretch staff-link-quiet" title={courseTitle(row)}>
            {courseTitle(row)}
          </Link>
          <span className="staff-muted staff-ltr">{row.shortname}</span>
        </span>
      ),
    },
    { id: "department", label: C.department, render: row => row.departmentName },
    {
      id: "area",
      label: C.area,
      render: row => row.areaOfStudyName ?? <span className="staff-muted">{C.noArea}</span>,
    },
    {
      id: "hours",
      label: C.hours,
      render: row =>
        row.totalHours ? (
          <span className="staff-figures">
            {row.totalHours} {copy.teaching.hourUnit}
          </span>
        ) : (
          <span className="staff-muted">{copy.state.notSet}</span>
        ),
    },
    { id: "moodle", label: C.moodle, render: row => <MoodleState course={row} /> },
    { id: "previous", label: C.previous, defaultHidden: true, render: row => row.previousCourseName ?? "" },
  ];

  async function refreshAll() {
    setRefreshing(true);
    await runAction(
      async () => {
        await staffWrite(refreshNccCoursesRequest(staffQueryString(query)));
        await invalidate("/api/ncc/delivery/courses");
      },
      { success: C.refreshAllToast }
    );
    setRefreshing(false);
  }

  const page = courses.data;
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <PageHeader
        title={C.title}
        description={C.description}
        actions={
          superAdmin ? (
            <>
              <button type="button" className="staff-btn" disabled={refreshing} onClick={() => void refreshAll()}>
                <RefreshCw strokeWidth={1.75} aria-hidden />
                {C.refreshAll}
              </button>
              <button type="button" className="staff-btn" data-variant="primary" onClick={() => setFormOpen(true)}>
                <Plus strokeWidth={1.75} aria-hidden />
                {C.link}
              </button>
            </>
          ) : undefined
        }
      />
      {superAdmin ? (
        <ServerSegments
          path="/api/ncc/delivery/courses"
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
      ) : null}
      {courses.error && !page ? (
        <ErrorState error={courses.error} onRetry={() => void courses.mutate()} />
      ) : !page ? (
        <LoadingRows />
      ) : (
        <ListPage
          title={C.title}
          listId="courses"
          items={page.items}
          columns={columns}
          rowKey={row => row.id}
          searchText={row => row.fullname}
          filters={filters}
          server={{ total: page.total, pageSize: page.pageSize, refreshing: courses.isValidating }}
          renderCard={row => (
            <div className="staff-rowcard-main">
              <span className="staff-person-name">
                <Link href={`/app/courses/${row.id}`} className="staff-stretch">
                  {courseTitle(row)}
                </Link>
              </span>
              <span className="staff-muted">
                {row.departmentName}
                {row.totalHours ? ` · ${row.totalHours} ${copy.teaching.hourUnit}` : ""}
              </span>
              <div className="staff-rowcard-badges">
                <MoodleState course={row} />
              </div>
            </div>
          )}
          empty={<EmptyState title={C.empty} description={superAdmin ? C.emptyHint : undefined} />}
        />
      )}
      <CourseForm
        open={formOpen}
        onOpenChange={setFormOpen}
        course={null}
        onSaved={course => navigate(`/app/courses/${course.id}`)}
      />
    </div>
  );
}
