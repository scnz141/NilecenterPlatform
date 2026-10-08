import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useLocation, useParams, useSearch } from "wouter";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Copy, Pencil } from "lucide-react";
import { toast } from "sonner";
import {
  patchNccUserHourCellsRequest,
  updateNccUserCoursesRequest,
  type NccBranchDto,
  type NccCourseDto,
  type NccHourCellOpDto,
  type NccHourCellRangeDto,
  type NccStaffStatisticsDto,
  type NccStaffUserDto,
} from "@/lib/backend/api";
import { staffWrite, useInvalidate, useNcc } from "../api";
import { copy } from "../copy";
import { isStaffManager, roleLabel } from "../roles";
import { runAction } from "../run-action";
import { useStaffSession } from "../session";
import { useStaffCrumb } from "../shell/staff-shell";
import { toIsoDate, weekDates } from "../hour-cells";
import { HourCellsGrid } from "../ui/hour-cells-grid";
import { MultiSelect } from "../ui/multi-select";
import {
  ActiveMark,
  Avatar,
  EmptyState,
  ErrorState,
  LoadingRows,
  NotSet,
  StatusBadge,
} from "../ui/primitives";
import { SecretDialog, type StaffSecret } from "../ui/secret-dialog";
import { formatDate } from "./catalog-shared";
import { StaffActionsMenu } from "./staff-actions";
import { StaffForm } from "./staff-form";

const C = copy.staffUsers;

const TABS = ["overview", "courses", "availability", "activity"] as const;
type Tab = (typeof TABS)[number];

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="staff-stat">
      <span className="staff-stat-value">{value}</span>
      <span className="staff-stat-label">{label}</span>
    </div>
  );
}

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value ?? <NotSet />}</dd>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="staff-fact">
      <dt>{label}</dt>
      <dd>{value ?? <NotSet />}</dd>
    </div>
  );
}

function CopyEmailButton({ email }: { email: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1600);
    return () => window.clearTimeout(timer);
  }, [copied]);

  return (
    <button
      type="button"
      className="staff-copy-btn"
      aria-label={C.copyEmail}
      onClick={() => {
        void (async () => {
          try {
            await navigator.clipboard.writeText(email);
            setCopied(true);
            toast.success(C.emailCopied);
          } catch {
            toast.error(copy.state.errorGeneric);
          }
        })();
      }}
    >
      <AnimatePresence initial={false} mode="wait">
        <motion.span
          key={copied ? "check" : "copy"}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.12 }}
        >
          {copied ? (
            <Check strokeWidth={2} aria-hidden />
          ) : (
            <Copy strokeWidth={1.75} aria-hidden />
          )}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}

export default function StaffDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { session } = useStaffSession();
  const callerRole = session?.ncc?.activeRole ?? null;
  const canManage = isStaffManager(callerRole);
  const invalidate = useInvalidate();
  const search = useSearch();
  const [, navigate] = useLocation();

  const user = useNcc<{ user: NccStaffUserDto }>(
    canManage && id
      ? `/api/ncc/directory/users/${encodeURIComponent(id)}`
      : null
  );
  const stats = useNcc<{ statistics: NccStaffStatisticsDto }>(
    canManage && id
      ? `/api/ncc/directory/users/${encodeURIComponent(id)}/statistics`
      : null
  );
  const branches = useNcc<{ items: NccBranchDto[] }>(
    canManage ? "/api/ncc/directory/branches" : null
  );
  const isTeacher = user.data?.user.emsRole === "teacher";
  const courses = useNcc<{ items: NccCourseDto[] }>(
    canManage && isTeacher ? "/api/ncc/delivery/courses" : null
  );

  const [formOpen, setFormOpen] = useState(false);
  const [secrets, setSecrets] = useState<StaffSecret[] | null>(null);
  const [courseIds, setCourseIds] = useState<string[] | null>(null);
  const [anchor, setAnchor] = useState(() => toIsoDate(new Date()));

  const current = user.data?.user;
  useStaffCrumb(current?.name ?? null);
  const week = useMemo(() => weekDates(anchor), [anchor]);
  const hourCells = useNcc<{ range: NccHourCellRangeDto }>(
    canManage && id && isTeacher
      ? `/api/ncc/directory/users/${encodeURIComponent(id)}/hour-cells`
      : null,
    { from: week[0], to: week[6] }
  );

  useEffect(() => {
    setCourseIds(null);
  }, [current?.id]);

  const editCourseIds = courseIds ?? current?.courseIds ?? [];

  if (!canManage) {
    return (
      <EmptyState
        title={copy.shell.noAccess}
        description={C.noAccess}
      />
    );
  }

  if (user.error) {
    return (
      <ErrorState error={user.error} onRetry={() => void user.mutate()} />
    );
  }
  if (user.isLoading || !current) {
    return <LoadingRows />;
  }

  const branchName = (branchId: string) =>
    (branches.data?.items ?? []).find(b => b.id === branchId)?.name ??
    branchId;

  async function saveCourses() {
    if (!current) return;
    await runAction(async () => {
      await staffWrite(updateNccUserCoursesRequest(current.id, editCourseIds));
      setCourseIds(null);
      await invalidate(`/api/ncc/directory/users/${current.id}`);
    }, { success: C.coursesSaved });
  }

  async function saveHourCells(ops: NccHourCellOpDto[]): Promise<boolean> {
    if (!current) return false;
    const result = await runAction(async () => {
      const out = await staffWrite(
        patchNccUserHourCellsRequest(current.id, ops)
      );
      if (out.skippedBooked > 0) {
        toast.message(C.cellsSkippedBooked);
      }
      await hourCells.mutate();
      return out;
    }, { success: C.cellsSaved });
    return result !== undefined;
  }

  const admissions = stats.data?.statistics;
  const teacher = current.emsRole === "teacher";
  const hasAdmissions =
    admissions != null &&
    (admissions.leadsCreated > 0 ||
      admissions.leadsAssigned > 0 ||
      admissions.studentsAssigned > 0);
  const hasTeaching =
    admissions != null &&
    (admissions.classesTeaching > 0 ||
      admissions.sessionsScheduled > 0 ||
      admissions.studentsTaught > 0);
  const showAdmissions =
    current.emsRole === "ssa" || current.emsRole === "registrar" || hasAdmissions;
  const showTeaching = teacher || hasTeaching;
  const showActivity =
    teacher ||
    current.emsRole === "registrar" ||
    current.emsRole === "ssa" ||
    hasAdmissions ||
    hasTeaching;

  const tabs: { value: Tab; label: string }[] = [
    { value: "overview", label: C.tabOverview },
    ...(teacher ? [{ value: "courses" as const, label: C.tabCourses }] : []),
    ...(teacher
      ? [{ value: "availability" as const, label: C.tabAvailability }]
      : []),
    ...(showActivity ? [{ value: "activity" as const, label: C.tabActivity }] : []),
  ];
  const requested = new URLSearchParams(search).get("tab") as Tab | null;
  const tab: Tab = tabs.some(t => t.value === requested)
    ? (requested as Tab)
    : "overview";

  function setTab(value: Tab) {
    const next = new URLSearchParams(search);
    if (value === "overview") next.delete("tab");
    else next.set("tab", value);
    navigate(`?${next.toString()}`, { replace: true });
  }

  const isSelf =
    current.email.toLowerCase() === (session?.email?.toLowerCase() ?? null);
  const worksAt =
    current.scopeType === "global"
      ? C.globalScope
      : current.branchIds.map(branchName).join(", ") || null;
  const departments = current.departments.map(d => d.name).join(", ") || null;
  const lastSignIn = current.lastLoginAt
    ? formatDate(current.lastLoginAt)
    : C.neverSignedIn;
  const hasMoreDetails =
    Boolean(current.notes) || Object.keys(current.customFields).length > 0;

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <div className="staff-detail-head">
        <div className="staff-detail-id">
          <Avatar name={current.name} seed={current.id} size="lg" />
          <div className="min-w-0">
            <h1 className="staff-detail-name">{current.name}</h1>
            <div className="staff-detail-email">
              <span className="staff-ltr">{current.email}</span>
              <CopyEmailButton email={current.email} />
            </div>
            <div className="staff-detail-meta">
              <span>{roleLabel(current.emsRole)}</span>
              <StatusBadge status={current.status} />
              {isSelf ? <span className="staff-tag">{C.you}</span> : null}
            </div>
          </div>
        </div>
        {canManage ? (
          <div className="staff-detail-actions">
            <button
              type="button"
              className="staff-btn"
              data-size="sm"
              onClick={() => setFormOpen(true)}
            >
              <Pencil strokeWidth={1.75} aria-hidden />
              {copy.actions.edit}
            </button>
            <StaffActionsMenu
              user={current}
              trigger="button"
              onEdit={() => setFormOpen(true)}
            />
          </div>
        ) : null}
      </div>

      <dl className="staff-facts">
        <Fact label={C.role} value={roleLabel(current.emsRole)} />
        <Fact label={C.worksAt} value={worksAt} />
        <Fact
          label={C.moodle}
          value={current.moodleLinked ? C.moodleLinked : C.moodleMissing}
        />
        <Fact label={C.lastSignIn} value={lastSignIn} />
        <Fact label={C.added} value={formatDate(current.createdAt)} />
      </dl>

      <div className="staff-tabs" role="tablist" aria-label={C.title}>
        {tabs.map(item => (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={tab === item.value}
            className="staff-tab"
            data-active={tab === item.value}
            onClick={() => setTab(item.value)}
          >
            {tab === item.value ? <ActiveMark group="staff-detail-tabs" /> : null}
            {item.label}
          </button>
        ))}
      </div>

      {tab === "overview" ? (
        <div className="flex flex-col gap-6">
          <section className="staff-section">
            <h2 className="staff-section-title">{C.sectionContact}</h2>
            <dl className="staff-dl">
              <Field label={C.firstName} value={current.firstName || null} />
              <Field label={C.lastName} value={current.lastName || null} />
              <Field label={C.email} value={current.email} />
              <Field label={C.phone} value={current.phone} />
              <Field label={C.nationality} value={current.nationality} />
              <Field label={C.dateOfBirth} value={current.dateOfBirth} />
              <Field label={C.address} value={current.address} />
            </dl>
          </section>
          <section className="staff-section">
            <h2 className="staff-section-title">{C.sectionAccess}</h2>
            <dl className="staff-dl">
              <Field label={C.departments} value={departments} />
              <Field
                label={C.placementCapability}
                value={
                  current.canTakePlacementTest ? C.placementYes : C.placementNo
                }
              />
            </dl>
          </section>
          {hasMoreDetails ? (
            <section className="staff-section">
              <h2 className="staff-section-title">{C.sectionMore}</h2>
              <dl className="staff-dl">
                <Field label={C.notes} value={current.notes} />
                {Object.entries(current.customFields).map(([key, value]) => (
                  <Field
                    key={key}
                    label={key}
                    value={value === null ? null : String(value)}
                  />
                ))}
              </dl>
            </section>
          ) : null}
        </div>
      ) : null}

      {tab === "courses" ? (
        <section className="staff-card">
          <div className="flex flex-col gap-3">
            <h2 className="text-base font-semibold">{C.coursesTitle}</h2>
            <MultiSelect
              options={(courses.data?.items ?? [])
                .filter(
                  course =>
                    course.status === "active" ||
                    editCourseIds.includes(course.id)
                )
                .map(course => ({
                  value: course.id,
                  label:
                    course.displayName ?? course.fullname ?? course.shortname,
                }))}
              value={editCourseIds}
              onChange={setCourseIds}
              allLabel={C.coursesTitle}
              noun="courses"
              searchPlaceholder={C.coursesSearchPlaceholder}
              ariaLabel={C.coursesTitle}
              disabled={!canManage}
            />
            <p className="staff-muted">{C.coursesHint}</p>
            {canManage ? (
              <div>
                <button
                  type="button"
                  className="staff-btn"
                  data-variant="primary"
                  data-size="sm"
                  onClick={() => void saveCourses()}
                >
                  {C.saveChanges}
                </button>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {tab === "activity" ? (
        <section>
          {stats.error ? (
            <ErrorState
              error={stats.error}
              onRetry={() => void stats.mutate()}
            />
          ) : stats.isLoading || !admissions ? (
            <LoadingRows rows={2} />
          ) : !showAdmissions && !showTeaching ? (
            <EmptyState title={C.statsEmpty} />
          ) : (
            <div className="flex flex-col gap-4">
              {showAdmissions ? (
                <div className="flex flex-col gap-2">
                  <h2 className="text-sm font-medium staff-muted">
                    {C.statsAdmissions}
                  </h2>
                  <div className="staff-stat-grid">
                    <Stat
                      label={C.statLeadsCreated}
                      value={admissions.leadsCreated}
                    />
                    <Stat
                      label={C.statLeadsAssigned}
                      value={admissions.leadsAssigned}
                    />
                    <Stat label={C.statLeadsOpen} value={admissions.leadsOpen} />
                    <Stat
                      label={C.statLeadsRegistered}
                      value={admissions.leadsRegistered}
                    />
                    <Stat label={C.statLeadsLost} value={admissions.leadsLost} />
                    <Stat
                      label={C.statStudentsAssigned}
                      value={admissions.studentsAssigned}
                    />
                  </div>
                </div>
              ) : null}
              {showTeaching ? (
                <div className="flex flex-col gap-2">
                  <h2 className="text-sm font-medium staff-muted">
                    {C.statsTeaching}
                  </h2>
                  <div className="staff-stat-grid">
                    <Stat
                      label={C.statClassesTeaching}
                      value={admissions.classesTeaching}
                    />
                    <Stat
                      label={C.statSessionsScheduled}
                      value={admissions.sessionsScheduled}
                    />
                    <Stat
                      label={C.statStudentsTaught}
                      value={admissions.studentsTaught}
                    />
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </section>
      ) : null}

      {tab === "availability" ? (
        <section className="staff-card">
          {hourCells.error ? (
            <ErrorState
              error={hourCells.error}
              onRetry={() => void hourCells.mutate()}
            />
          ) : (
            <HourCellsGrid
              range={hourCells.data?.range ?? null}
              loading={hourCells.isLoading}
              canPaint={canManage}
              anchor={anchor}
              onAnchorChange={setAnchor}
              onSave={saveHourCells}
            />
          )}
        </section>
      ) : null}

      <StaffForm
        open={formOpen}
        onOpenChange={setFormOpen}
        user={current}
        onSecrets={setSecrets}
      />
      <SecretDialog secrets={secrets} onClose={() => setSecrets(null)} />
    </div>
  );
}
