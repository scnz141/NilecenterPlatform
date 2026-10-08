import { useState } from "react";
import { Link, useLocation, useParams, useSearch } from "wouter";
import { MoreHorizontal, Pencil, RefreshCw } from "lucide-react";
import {
  attachNccClassEnrolmentRequest,
  bindNccClassMoodleRequest,
  disableNccClassRequest,
  enableNccClassRequest,
  syncNccClassMoodleRequest,
  type NccClassDto,
  type NccClassGradesDto,
  type NccClassSyncStepDto,
  type NccEnrolmentDto,
  type NccMoodleGroupDto,
  type NccPageDto,
} from "@/lib/backend/api";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/staff/ui/kit";
import { staffWrite, useInvalidate, useNcc } from "../api";
import { copy } from "../copy";
import { formatDateTime } from "../i18n";
import { isAdmissionsRole, isClassCatalogWriter } from "../roles";
import { runAction } from "../run-action";
import { useStaffSession } from "../session";
import { useStaffCrumb } from "../shell/staff-shell";
import { scheduleText } from "../teaching";
import { ConfirmDialog } from "../ui/confirm-dialog";
import {
  ActiveMark,
  Avatar,
  EmptyState,
  ErrorState,
  LoadingRows,
  NotSet,
  StatusBadge,
} from "../ui/primitives";
import { useBranches } from "./admissions-ui";
import { formatDate } from "./catalog-shared";
import { ClassAttendance } from "./class-attendance";
import { ClassForm } from "./class-form";
import { ClassSessions } from "./class-sessions";
import { BalanceCell } from "./enrolment-actions";
import { SeatsMeter } from "./teaching-ui";

const K = copy.teaching.classes;
const T = copy.teaching;
const TABS = ["sessions", "students", "attendance", "grades"] as const;
type Tab = (typeof TABS)[number];

/* ---------------- Students ------------------------------------------ */

function ClassStudents({ item, canWrite }: { item: NccClassDto; canWrite: boolean }) {
  const { session } = useStaffSession();
  const canOpenStudents = isAdmissionsRole(session?.ncc?.activeRole);
  const invalidate = useInvalidate();
  const roster = useNcc<{ items: NccEnrolmentDto[] }>(
    `/api/ncc/delivery/classes/${encodeURIComponent(item.id)}/enrolments`
  );
  // Paid sales for this course and branch still waiting for a class of this kind.
  const waiting = useNcc<NccPageDto<NccEnrolmentDto>>(
    canWrite ? "/api/ncc/admissions/enrolments" : null,
    {
      status: "waiting",
      courseId: item.courseId,
      branchId: item.branchId,
      ...(item.kind ? { kind: item.kind } : {}),
      pageSize: 100,
    }
  );
  const ready = (waiting.data?.items ?? []).filter(sale => sale.status !== "pending_payment" && !sale.classId);
  const seatsLeft = item.capacity - item.activeEnrolmentCount;

  const nameCell = (sale: NccEnrolmentDto) =>
    canOpenStudents ? (
      <Link href={`/app/students/${sale.studentId}`} className="staff-link-quiet">
        {sale.studentName}
      </Link>
    ) : (
      <span>{sale.studentName}</span>
    );

  return (
    <div className="flex flex-col gap-4">
      <section className="staff-section">
        <h2 className="staff-section-title">
          {K.students} · {roster.data?.items.length ?? "–"}
        </h2>
        {roster.error ? (
          <ErrorState error={roster.error} onRetry={() => void roster.mutate()} />
        ) : !roster.data ? (
          <LoadingRows rows={3} />
        ) : roster.data.items.length === 0 ? (
          <p className="staff-muted">{K.studentsEmpty}</p>
        ) : (
          <ul className="staff-class-list">
            {roster.data.items.map(sale => (
              <li key={sale.id}>
                <span className="staff-person">
                  <Avatar name={sale.studentName} seed={sale.studentId} size="sm" />
                  <span className="staff-person-meta">
                    <span className="staff-person-name">{nameCell(sale)}</span>
                    <span className="staff-person-email staff-ltr">{sale.student.email}</span>
                  </span>
                </span>
                <span className="staff-row-actions">
                  {!sale.student.moodleLinked ? (
                    <StatusBadge status="pending" label={K.noMoodleAccount} />
                  ) : null}
                  <StatusBadge status={sale.status} />
                  <BalanceCell enrolment={sale} />
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {canWrite ? (
        <section className="staff-section">
          <div className="staff-section-head">
            <h2 className="staff-section-title">{K.addStudents}</h2>
            <span className="staff-muted staff-figures">
              {Math.max(0, seatsLeft)} {T.seats} {T.seatsLeft}
            </span>
          </div>
          <p className="staff-hint">{K.addStudentsHint}</p>
          {!waiting.data ? (
            <LoadingRows rows={2} />
          ) : ready.length === 0 ? (
            <p className="staff-muted">{K.noWaiting}</p>
          ) : (
            <ul className="staff-class-list">
              {ready.map(sale => (
                <li key={sale.id}>
                  <span className="staff-person">
                    <Avatar name={sale.studentName} seed={sale.studentId} size="sm" />
                    <span className="staff-person-meta">
                      <span className="staff-person-name">{nameCell(sale)}</span>
                      <span className="staff-person-email staff-ltr">{sale.student.email}</span>
                    </span>
                  </span>
                  <span className="staff-row-actions">
                    {!sale.student.moodleLinked ? (
                      <StatusBadge status="pending" label={K.noMoodleAccount} />
                    ) : null}
                    <button
                      type="button"
                      className="staff-btn"
                      data-size="sm"
                      data-variant="primary"
                      disabled={!sale.student.moodleLinked || seatsLeft <= 0}
                      title={!sale.student.moodleLinked ? copy.admissions.enrolments.moodleRequired : undefined}
                      onClick={() =>
                        void runAction(
                          async () => {
                            await staffWrite(attachNccClassEnrolmentRequest(item.id, { enrolmentId: sale.id }));
                            await Promise.all([
                              invalidate(`/api/ncc/delivery/classes/${item.id}`),
                              invalidate("/api/ncc/admissions/enrolments"),
                            ]);
                          },
                          { success: K.attachToast }
                        )
                      }
                    >
                      {copy.admissions.enrolments.attach}
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </div>
  );
}

/* ---------------- Grades -------------------------------------------- */

function ClassGrades({ item }: { item: NccClassDto }) {
  const grades = useNcc<{ grades: NccClassGradesDto }>(
    `/api/ncc/delivery/classes/${encodeURIComponent(item.id)}/grades`
  );
  if (grades.error) return <ErrorState error={grades.error} onRetry={() => void grades.mutate()} />;
  if (!grades.data) return <LoadingRows rows={3} />;
  const students = grades.data.grades.students;
  if (students.length === 0) return <EmptyState title={copy.teaching.grades.empty} />;
  const items = students[0].gradeItems.filter(entry => entry.itemType !== "course");
  return (
    <div className="staff-table-wrap">
      <table className="staff-table">
        <thead>
          <tr>
            <th scope="col">{copy.teaching.grades.student}</th>
            {items.map(entry => (
              <th scope="col" key={entry.id}>
                {entry.itemName ?? entry.itemModule ?? entry.id}
              </th>
            ))}
            <th scope="col">{copy.teaching.grades.courseGrade}</th>
          </tr>
        </thead>
        <tbody>
          {students.map(student => (
            <tr key={student.studentId}>
              <td>
                {student.firstName} {student.lastName}
              </td>
              {items.map(entry => {
                const own = student.gradeItems.find(value => value.id === entry.id);
                return (
                  <td key={entry.id} className="staff-figures">
                    {own?.gradeFormatted ?? <NotSet />}
                  </td>
                );
              })}
              <td className="staff-figures">
                <strong>{student.courseGrade ?? "–"}</strong>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---------------- Moodle group -------------------------------------- */

function MoodleGroupDialog({
  item,
  open,
  onOpenChange,
}: {
  item: NccClassDto;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const invalidate = useInvalidate();
  const [mode, setMode] = useState<"create" | "link">("create");
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const groups = useNcc<{ items: NccMoodleGroupDto[] }>(
    open && mode === "link" && query.trim().length >= 2 ? "/api/ncc/delivery/moodle-groups" : null,
    { courseId: item.courseId, q: query.trim() }
  );

  async function bind() {
    setSaving(true);
    await runAction(
      async () => {
        await staffWrite(
          bindNccClassMoodleRequest(
            item.id,
            mode === "link" && picked !== null ? { mode: "link", moodleGroupId: picked } : { mode: "create" }
          )
        );
        await invalidate(`/api/ncc/delivery/classes/${item.id}`);
        onOpenChange(false);
      },
      { success: K.moodleBound }
    );
    setSaving(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{K.moodleTitle}</DialogTitle>
          <DialogDescription>{K.moodleDescription}</DialogDescription>
        </DialogHeader>
        <div className="staff-choice-list" role="radiogroup" aria-label={K.moodleTitle}>
          {(["create", "link"] as const).map(value => (
            <label key={value} className="staff-choice">
              <input type="radio" name="moodle-mode" checked={mode === value} onChange={() => setMode(value)} />
              <span className="staff-choice-body">
                <span className="staff-choice-title">{value === "create" ? K.moodleCreate : K.moodleLink}</span>
              </span>
            </label>
          ))}
        </div>
        {mode === "link" ? (
          <div className="flex flex-col gap-2">
            <input
              type="search"
              className="staff-input"
              placeholder={K.moodleSearch}
              value={query}
              onChange={event => {
                setQuery(event.target.value);
                setPicked(null);
              }}
            />
            {(groups.data?.items ?? []).map(group => (
              <label key={group.id} className="staff-choice">
                <input
                  type="radio"
                  name="moodle-group"
                  checked={picked === group.id}
                  onChange={() => setPicked(group.id)}
                />
                <span className="staff-choice-body">
                  <span className="staff-choice-title">{group.name}</span>
                  <span className="staff-muted">#{group.id}</span>
                </span>
              </label>
            ))}
          </div>
        ) : null}
        <DialogFooter>
          <button type="button" className="staff-btn" onClick={() => onOpenChange(false)}>
            {copy.actions.cancel}
          </button>
          <button
            type="button"
            className="staff-btn"
            data-variant="primary"
            disabled={saving || (mode === "link" && picked === null)}
            onClick={() => void bind()}
          >
            {mode === "create" ? K.moodleCreate : K.moodleLink}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const STEP_LABELS: Record<NccClassSyncStepDto["step"], string> = {
  get group() {
    return K.stepGroup;
  },
  get teachers() {
    return K.stepTeachers;
  },
  get students() {
    return K.stepStudents;
  },
  get sessions() {
    return K.stepSessions;
  },
  get grades() {
    return K.stepGrades;
  },
};

function SyncResultDialog({
  result,
  onOpenChange,
}: {
  result: { steps: NccClassSyncStepDto[]; warnings: string[] } | null;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={result !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{K.syncTitle}</DialogTitle>
          <DialogDescription>
            {result?.steps.some(step => step.status === "error") ? K.syncPartial : K.syncDone}
          </DialogDescription>
        </DialogHeader>
        <ul className="staff-attention">
          {(result?.steps ?? []).map(step => (
            <li key={step.step} className="staff-sync-step">
              <span className="staff-cell-stack">
                <span>{STEP_LABELS[step.step]}</span>
                {step.detail ? <span className="staff-muted">{step.detail}</span> : null}
                {step.warnings.map(warning => (
                  <span key={warning} className="staff-muted">
                    {warning}
                  </span>
                ))}
              </span>
              <StatusBadge status={step.status === "ok" ? "ok" : "failed"} label={step.status === "ok" ? K.stepOk : K.stepError} />
            </li>
          ))}
        </ul>
        {result?.warnings.length ? (
          <p className="staff-banner" data-tone="caution">
            {result.warnings.join(" ")}
          </p>
        ) : null}
        <DialogFooter>
          <button type="button" className="staff-btn" data-variant="primary" onClick={() => onOpenChange(false)}>
            {copy.actions.close}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------- Page ---------------------------------------------- */

type Pending = "edit" | "moodle" | "disable" | "enable" | null;

export default function ClassDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { session } = useStaffSession();
  const role = session?.ncc?.activeRole ?? null;
  const canWrite = isClassCatalogWriter(role);
  const invalidate = useInvalidate();
  const branches = useBranches();
  const search = useSearch();
  const [, navigate] = useLocation();
  const [pending, setPending] = useState<Pending>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ steps: NccClassSyncStepDto[]; warnings: string[] } | null>(null);
  const query = useNcc<{ class: NccClassDto }>(id ? `/api/ncc/delivery/classes/${encodeURIComponent(id)}` : null);
  const item = query.data?.class;
  useStaffCrumb(item?.name ?? null);

  if (query.error) return <ErrorState error={query.error} onRetry={() => void query.mutate()} />;
  if (!item) return <LoadingRows />;

  const branch = branches.get(item.branchId);
  const requested = new URLSearchParams(search).get("tab") as Tab | null;
  const tab: Tab = requested && TABS.includes(requested) ? requested : "sessions";
  const setTab = (next: Tab) => {
    const params = new URLSearchParams(search);
    if (next === "sessions") params.delete("tab");
    else params.set("tab", next);
    navigate(`?${params.toString()}`, { replace: true });
  };
  const labels: Record<Tab, string> = {
    sessions: K.tabSessions,
    students: K.tabStudents,
    attendance: K.tabAttendance,
    grades: K.tabGrades,
  };
  const refresh = () => invalidate(`/api/ncc/delivery/classes/${item.id}`);

  async function sync() {
    setSyncing(true);
    const result = await runAction(async () => {
      const value = await staffWrite(syncNccClassMoodleRequest(item!.id));
      await refresh();
      return value;
    });
    setSyncing(false);
    if (result) setSyncResult({ steps: result.steps, warnings: result.warnings });
  }

  return (
    <div className="staff-detail flex min-w-0 flex-col gap-6">
      <header className="staff-detail-head">
        <div className="min-w-0">
          <div className="staff-eyebrow">
            {item.courseName} · {item.branchName}
          </div>
          <h1 className="staff-detail-name">{item.name}</h1>
          <div className="staff-detail-meta">
            <StatusBadge status={item.status} />
            <span className="staff-mode">{item.kind === "individual" ? K.individual : K.group}</span>
            {item.meetingUrl ? (
              <a className="staff-link" href={item.meetingUrl} target="_blank" rel="noreferrer">
                {copy.admissions.booking.joinLink}
              </a>
            ) : null}
          </div>
        </div>
        <div className="staff-detail-actions">
          {canWrite ? (
            <>
              <button type="button" className="staff-btn" data-size="sm" disabled={syncing} onClick={() => void sync()}>
                <RefreshCw strokeWidth={1.75} aria-hidden />
                {K.sync}
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
                <DropdownMenuContent align="end" className="w-60">
                  <DropdownMenuItem onSelect={() => setPending("moodle")}>
                    {item.moodleGroupId ? K.moodleLink : K.moodleCreate}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {item.status === "active" ? (
                    <DropdownMenuItem className="text-[var(--staff-red)]" onSelect={() => setPending("disable")}>
                      {K.disable}
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem onSelect={() => setPending("enable")}>{K.enable}</DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : null}
        </div>
      </header>

      {!canWrite ? <p className="staff-hint">{K.readOnly}</p> : null}

      <dl className="staff-facts">
        <div className="staff-fact">
          <dt>{K.fill}</dt>
          <dd>
            <SeatsMeter item={item} />
          </dd>
        </div>
        <div className="staff-fact">
          <dt>{K.teachers}</dt>
          <dd>{item.teachers.length ? item.teachers.map(teacher => teacher.name).join(", ") : K.noTeacher}</dd>
        </div>
        <div className="staff-fact">
          <dt>{K.usualTime}</dt>
          <dd>{scheduleText(item.schedule) ?? <span className="staff-muted">{K.noSchedule}</span>}</dd>
        </div>
        <div className="staff-fact">
          <dt>{K.dates}</dt>
          <dd>
            {formatDate(item.startAt)} – {formatDate(item.endAt)}
          </dd>
        </div>
        <div className="staff-fact">
          <dt>{K.moodleGroup}</dt>
          <dd>
            {item.moodleGroupId ? `${K.moodleLinked} · #${item.moodleGroupId}` : <span className="staff-muted">{K.moodleMissing}</span>}
            <span className="staff-fact-note">
              {item.lastSyncedAt ? `${K.lastSynced} ${formatDateTime(item.lastSyncedAt)}` : K.neverSynced}
            </span>
          </dd>
        </div>
      </dl>

      <div className="staff-tabs" role="tablist" aria-label={item.name}>
        {TABS.map(value => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={tab === value}
            className="staff-tab"
            data-active={tab === value}
            onClick={() => setTab(value)}
          >
            {tab === value ? <ActiveMark group="class-tabs" /> : null}
            {labels[value]}
          </button>
        ))}
      </div>

      {tab === "sessions" ? <ClassSessions item={item} branch={branch} canWrite={canWrite} /> : null}
      {tab === "students" ? <ClassStudents item={item} canWrite={canWrite} /> : null}
      {tab === "attendance" ? <ClassAttendance item={item} timeZone={branch?.timezone} /> : null}
      {tab === "grades" ? <ClassGrades item={item} /> : null}

      <ClassForm open={pending === "edit"} onOpenChange={open => !open && setPending(null)} item={item} />
      <MoodleGroupDialog item={item} open={pending === "moodle"} onOpenChange={open => !open && setPending(null)} />
      <SyncResultDialog result={syncResult} onOpenChange={open => !open && setSyncResult(null)} />
      <ConfirmDialog
        open={pending === "disable"}
        onOpenChange={open => !open && setPending(null)}
        title={K.disableTitle}
        description={K.disableBody}
        confirmLabel={K.disable}
        destructive
        reasonKind="disable_class"
        reasonRequired
        onConfirm={reasonId =>
          runAction(
            async () => {
              await staffWrite(disableNccClassRequest(item.id, reasonId));
              await refresh();
            },
            { success: K.disabledToast }
          )
        }
      />
      <ConfirmDialog
        open={pending === "enable"}
        onOpenChange={open => !open && setPending(null)}
        title={K.enableTitle}
        description={K.enableBody}
        confirmLabel={K.enable}
        onConfirm={() =>
          runAction(
            async () => {
              await staffWrite(enableNccClassRequest(item.id));
              await refresh();
            },
            { success: K.enabledToast }
          )
        }
      />
    </div>
  );
}

