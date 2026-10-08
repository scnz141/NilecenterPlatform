import { useState } from "react";
import { Link, useLocation, useParams } from "wouter";
import { MoreHorizontal, Pencil, Plus, RefreshCw } from "lucide-react";
import {
  disableNccCourseRequest,
  enableNccCourseRequest,
  refreshNccCourseRequest,
  type NccClassDto,
  type NccCourseDto,
  type NccCourseStatisticsDto,
  type NccPageDto,
} from "@/lib/backend/api";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/staff/ui/kit";
import { staffWrite, useInvalidate, useNcc } from "../api";
import { copy } from "../copy";
import { fillPercent } from "../dashboard";
import { formatDateTime } from "../i18n";
import { isClassCatalogWriter } from "../roles";
import { runAction } from "../run-action";
import { useStaffSession } from "../session";
import { useStaffCrumb } from "../shell/staff-shell";
import { scheduleText } from "../teaching";
import { ConfirmDialog } from "../ui/confirm-dialog";
import { ErrorState, LoadingRows, StatusBadge } from "../ui/primitives";
import { SeatsMeter } from "./teaching-ui";
import { ClassForm } from "./class-form";
import { CourseForm } from "./course-form";
import { courseTitle, MoodleState } from "./teaching-ui";

const C = copy.teaching.courses;

export default function CourseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { session } = useStaffSession();
  const role = session?.ncc?.activeRole ?? null;
  const superAdmin = role === "super_admin";
  const invalidate = useInvalidate();
  const [, navigate] = useLocation();
  const [pending, setPending] = useState<"edit" | "class" | "disable" | "enable" | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const query = useNcc<{ course: NccCourseDto }>(id ? `/api/ncc/delivery/courses/${encodeURIComponent(id)}` : null);
  const statistics = useNcc<{ statistics: NccCourseStatisticsDto }>(
    id ? `/api/ncc/delivery/courses/${encodeURIComponent(id)}/statistics` : null
  );
  const classes = useNcc<NccPageDto<NccClassDto>>(id ? "/api/ncc/delivery/classes" : null, {
    courseId: id,
    pageSize: 100,
  });
  const course = query.data?.course;
  useStaffCrumb(course ? courseTitle(course) : null);

  if (query.error) return <ErrorState error={query.error} onRetry={() => void query.mutate()} />;
  if (!course) return <LoadingRows />;
  const stats = statistics.data?.statistics;
  const refresh = () => invalidate("/api/ncc/delivery/courses");

  async function refreshFromMoodle() {
    setRefreshing(true);
    await runAction(
      async () => {
        await staffWrite(refreshNccCourseRequest(course!.id));
        await refresh();
      },
      { success: C.refreshOneToast }
    );
    setRefreshing(false);
  }

  return (
    <div className="staff-detail flex min-w-0 flex-col gap-6">
      <header className="staff-detail-head">
        <div className="min-w-0">
          <div className="staff-eyebrow staff-ltr">{course.shortname}</div>
          <h1 className="staff-detail-name">{courseTitle(course)}</h1>
          <div className="staff-detail-meta">
            <StatusBadge status={course.status} />
            <MoodleState course={course} />
            <span className="staff-muted">{course.departmentName}</span>
          </div>
        </div>
        <div className="staff-detail-actions">
          {superAdmin ? (
            <>
              <button type="button" className="staff-btn" data-size="sm" disabled={refreshing} onClick={() => void refreshFromMoodle()}>
                <RefreshCw strokeWidth={1.75} aria-hidden />
                {C.refreshOne}
              </button>
              <button type="button" className="staff-btn" data-size="sm" onClick={() => setPending("edit")}>
                <Pencil strokeWidth={1.75} aria-hidden />
                {copy.actions.edit}
              </button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button type="button" className="staff-icon-btn" aria-label={copy.staffUsers.moreActions}>
                    <MoreHorizontal strokeWidth={1.75} aria-hidden />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  {course.status === "active" ? (
                    <DropdownMenuItem className="text-[var(--staff-red)]" onSelect={() => setPending("disable")}>
                      {C.disable}
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem onSelect={() => setPending("enable")}>{C.enable}</DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : null}
        </div>
      </header>

      {course.moodleRefreshError ? (
        <p className="staff-banner" data-tone="caution" role="status">
          {C.refreshError}: {course.moodleRefreshError}
        </p>
      ) : null}

      <dl className="staff-facts">
        <div className="staff-fact">
          <dt>{C.totalHours}</dt>
          <dd>{course.totalHours ? `${course.totalHours} ${copy.teaching.hourUnit}` : copy.state.notSet}</dd>
        </div>
        <div className="staff-fact">
          <dt>{C.area}</dt>
          <dd>{course.areaOfStudyName ?? <span className="staff-muted">{C.noArea}</span>}</dd>
        </div>
        <div className="staff-fact">
          <dt>{C.previous}</dt>
          <dd>
            {course.previousCourseId ? (
              <Link href={`/app/courses/${course.previousCourseId}`} className="staff-link-quiet">
                {course.previousCourseName}
              </Link>
            ) : (
              <span className="staff-muted">{C.noPrevious}</span>
            )}
          </dd>
        </div>
        <div className="staff-fact">
          <dt>{C.attendanceId}</dt>
          <dd>
            {course.moodleAttendanceId ? (
              `#${course.moodleAttendanceId}`
            ) : (
              <span className="staff-banner-inline">{C.noAttendance}</span>
            )}
          </dd>
        </div>
        <div className="staff-fact">
          <dt>{C.moodleChecked}</dt>
          <dd>{formatDateTime(course.moodleRefreshedAt)}</dd>
        </div>
      </dl>

      <section className="flex flex-col gap-3" aria-label={C.demand}>
        <h2 className="staff-section-title">{C.demand}</h2>
        <div className="staff-tiles">
          <div className="staff-tile">
            <span className="staff-tile-label">{C.activeClasses}</span>
            <span className="staff-tile-value">{stats?.activeClasses ?? "–"}</span>
          </div>
          <div className="staff-tile">
            <span className="staff-tile-label">{C.seatsTaken}</span>
            <span className="staff-tile-value">
              {stats ? `${fillPercent(stats.enrolmentFill, stats.enrolmentCapacity)}%` : "–"}
            </span>
            {stats ? (
              <>
                <span className="staff-tile-meter" aria-hidden>
                  <span style={{ inlineSize: `${fillPercent(stats.enrolmentFill, stats.enrolmentCapacity)}%` }} />
                </span>
                <span className="staff-tile-note">
                  {stats.enrolmentFill} {copy.dashboard.seatsOf} {stats.enrolmentCapacity}
                </span>
              </>
            ) : null}
          </div>
          <Link href={`/app/enrolments?course=${course.id}`} className="staff-tile" data-link>
            <span className="staff-tile-label">{C.waitingSales}</span>
            <span className="staff-tile-value">{stats?.pendingEnrolments ?? "–"}</span>
          </Link>
          <div className="staff-tile">
            <span className="staff-tile-label">{C.interestedLeads}</span>
            <span className="staff-tile-value">{stats?.openLeads ?? "–"}</span>
          </div>
        </div>
      </section>

      <section className="staff-section">
        <div className="staff-section-head">
          <h2 className="staff-section-title">{C.classes}</h2>
          {isClassCatalogWriter(role) && course.status === "active" ? (
            <button type="button" className="staff-btn" data-size="sm" onClick={() => setPending("class")}>
              <Plus strokeWidth={1.75} aria-hidden />
              {copy.teaching.classes.add}
            </button>
          ) : null}
        </div>
        {!classes.data ? (
          <LoadingRows rows={2} />
        ) : classes.data.items.length === 0 ? (
          <p className="staff-muted">{C.noClasses}</p>
        ) : (
          <ul className="staff-class-list">
            {classes.data.items.map(item => (
              <li key={item.id}>
                <span className="staff-cell-stack">
                  <Link href={`/app/classes/${item.id}`} className="staff-link-quiet">
                    {item.name}
                  </Link>
                  <span className="staff-muted">
                    {item.branchName} · {scheduleText(item.schedule) ?? copy.teaching.classes.noSchedule}
                  </span>
                </span>
                <span className="staff-row-actions">
                  <SeatsMeter item={item} />
                  <StatusBadge status={item.status} />
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <CourseForm open={pending === "edit"} onOpenChange={open => !open && setPending(null)} course={course} />
      <ClassForm
        open={pending === "class"}
        onOpenChange={open => !open && setPending(null)}
        item={null}
        defaultCourseId={course.id}
        onSaved={item => navigate(`/app/classes/${item.id}`)}
      />
      <ConfirmDialog
        open={pending === "disable"}
        onOpenChange={open => !open && setPending(null)}
        title={C.disableTitle}
        description={C.disableBody}
        confirmLabel={C.disable}
        destructive
        reasonKind="disable_course"
        reasonRequired
        onConfirm={reasonId =>
          runAction(
            async () => {
              await staffWrite(disableNccCourseRequest(course.id, reasonId));
              await refresh();
            },
            { success: C.disabledToast }
          )
        }
      />
      <ConfirmDialog
        open={pending === "enable"}
        onOpenChange={open => !open && setPending(null)}
        title={C.enableTitle}
        description={C.enableBody}
        confirmLabel={C.enable}
        onConfirm={() =>
          runAction(
            async () => {
              await staffWrite(enableNccCourseRequest(course.id));
              await refresh();
            },
            { success: C.enabledToast }
          )
        }
      />
    </div>
  );
}
