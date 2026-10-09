import { useMemo, useState } from "react";
import { useLocation, useParams, useSearch } from "wouter";
import { MoreHorizontal, Pencil, Plus, Printer } from "lucide-react";
import {
  bindNccStudentMoodleRequest,
  disableNccStudentRequest,
  enableNccStudentRequest,
  resetNccStudentMoodlePasswordRequest,
  type NccEnrolmentDto,
  type NccPageDto,
  type NccPlacementTestDto,
  type NccStudentDto,
  type NccStudentLearningDto,
  type NccStudentReportDto,
  type NccTrialLessonDto,
} from "@/lib/backend/api";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/staff/ui/kit";
import { formatAmount } from "../admissions";
import { staffGet, staffWrite, useInvalidate, useNcc } from "../api";
import { copy } from "../copy";
import { formatDob } from "../date-of-birth";
import { formatDateTime } from "../i18n";
import { isAdmissionsRole } from "../roles";
import { runAction } from "../run-action";
import { useStaffSession } from "../session";
import { useStaffCrumb } from "../shell/staff-shell";
import { ConfirmDialog } from "../ui/confirm-dialog";
import { MoodleBindDialog } from "../ui/moodle-bind-dialog";
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
import { MoneyBar, useBranches } from "./admissions-ui";
import { BookingList } from "./booking-list";
import { BookingSheet, FeeSheet } from "./booking-sheets";
import {
  BalanceCell,
  kindLabel,
  SaleSheet,
  useEnrolmentActions,
} from "./enrolment-actions";
import { StudentForm } from "./student-form";

const S = copy.admissions.students;
const E = copy.admissions.enrolments;
const I = copy.admissions.identity;
const L = copy.admissions.leads;

const TABS = ["overview", "courses", "learning", "bookings", "report"] as const;
type Tab = (typeof TABS)[number];

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value ?? <NotSet />}</dd>
    </div>
  );
}

/**
 * A student's course sales. EMS lists class-attached enrolments per student
 * but not unattached sales, so the queue is searched by email and merged.
 */
function useStudentEnrolments(student: NccStudentDto | undefined) {
  const attached = useNcc<{ items: NccEnrolmentDto[] }>(
    student
      ? `/api/ncc/admissions/students/${encodeURIComponent(student.id)}/enrolments`
      : null
  );
  const sales = useNcc<NccPageDto<NccEnrolmentDto>>(
    student ? "/api/ncc/admissions/enrolments" : null,
    student ? { status: "all", q: student.email, pageSize: 100 } : undefined
  );
  return useMemo(() => {
    const byId = new Map<string, NccEnrolmentDto>();
    for (const item of sales.data?.items ?? []) {
      if (item.studentId === student?.id) byId.set(item.id, item);
    }
    for (const item of attached.data?.items ?? []) byId.set(item.id, item);
    const items = Array.from(byId.values()).sort((a, b) =>
      (b.enrolledAt ?? "").localeCompare(a.enrolledAt ?? "")
    );
    return {
      items,
      loading: !attached.data || !sales.data,
      error: attached.error ?? sales.error,
    };
  }, [attached.data, attached.error, sales.data, sales.error, student?.id]);
}

function EnrolmentTable({
  items,
  menu,
}: {
  items: NccEnrolmentDto[];
  menu: (e: NccEnrolmentDto) => React.ReactNode;
}) {
  return (
    <>
      <ul className="staff-enrol-cards staff-only-narrow">
        {items.map(item => (
          <li key={item.id} className="staff-enrol-card">
            <span className="staff-cell-stack">
              <span>{item.courseName}</span>
              <span className="staff-muted">
                {kindLabel(item.kind)} · {item.className ?? E.noClass}
              </span>
            </span>
            <span className="staff-cell-top">{menu(item)}</span>
            <span className="staff-rowcard-badges">
              <StatusBadge status={item.status} />
              <BalanceCell enrolment={item} />
            </span>
          </li>
        ))}
      </ul>
      <div className="staff-table-wrap staff-only-wide">
        <table className="staff-table">
          <thead>
            <tr>
              <th scope="col">{E.course}</th>
              <th scope="col">{copy.catalog.shared.status}</th>
              <th scope="col">{E.class}</th>
              <th scope="col">{E.balance}</th>
              <th scope="col">{E.opened}</th>
              <th scope="col" aria-label={copy.actions.rowActions} />
            </tr>
          </thead>
          <tbody>
            {items.map(item => (
              <tr key={item.id}>
                <td>
                  <span className="staff-cell-stack">
                    <span>{item.courseName}</span>
                    <span className="staff-muted">
                      {kindLabel(item.kind)} · {item.branchName}
                      {item.nextLevel ? ` · ${E.nextLevel}` : ""}
                    </span>
                  </span>
                </td>
                <td>
                  <StatusBadge status={item.status} />
                </td>
                <td>
                  {item.className ?? (
                    <span className="staff-muted">{E.noClass}</span>
                  )}
                </td>
                <td>
                  <BalanceCell enrolment={item} />
                </td>
                <td>
                  {item.enrolledAt ? formatDate(item.enrolledAt) : <NotSet />}
                </td>
                <td className="staff-cell-actions">{menu(item)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function LearningTable({ learning }: { learning: NccStudentLearningDto }) {
  if (learning.courses.length === 0)
    return <p className="staff-muted">{S.learningEmpty}</p>;
  return (
    <div className="staff-table-wrap">
      <table className="staff-table">
        <thead>
          <tr>
            <th scope="col">{E.course}</th>
            <th scope="col">{S.learningClass}</th>
            <th scope="col">{S.learningGrade}</th>
            <th scope="col">{S.learningCompletion}</th>
          </tr>
        </thead>
        <tbody>
          {learning.courses.map(course => (
            <tr key={`${course.classId}-${course.courseId}`}>
              <td>{course.courseName ?? <NotSet />}</td>
              <td>{course.className ?? <NotSet />}</td>
              <td className="staff-figures">
                {course.courseGrade ?? <NotSet />}
              </td>
              <td>
                {course.courseCompleted === null ? (
                  <NotSet />
                ) : (
                  <StatusBadge
                    status={course.courseCompleted ? "completed" : "scheduled"}
                    label={
                      course.courseCompleted
                        ? S.learningDone
                        : S.learningOngoing
                    }
                  />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ReportView({ report }: { report: NccStudentReportDto }) {
  const { identity } = report;
  return (
    <article className="staff-report">
      <header className="staff-report-head">
        <div>
          <p className="staff-eyebrow">{copy.brand.name}</p>
          <h2 className="staff-report-title">{S.reportTitle}</h2>
        </div>
        <p className="staff-muted">
          {S.reportGenerated}: {formatDateTime(new Date().toISOString())}
        </p>
      </header>
      <dl className="staff-dl">
        <Field label={copy.admissions.leads.person} value={identity.name} />
        <Field
          label={L.email}
          value={<span className="staff-ltr">{identity.email}</span>}
        />
        <Field label={S.branch} value={identity.branchName} />
        <Field label={I.dateOfBirth} value={formatDob(identity.dateOfBirth)} />
        <Field label={I.nationality} value={identity.nationality} />
        <Field
          label={I.nationalId}
          value={identity.nationalId ?? identity.passportNumber}
        />
      </dl>
      <h3 className="staff-section-title">{S.tabCourses}</h3>
      {report.enrolments.length ? (
        <table className="staff-table">
          <thead>
            <tr>
              <th scope="col">{E.course}</th>
              <th scope="col">{E.class}</th>
              <th scope="col">{copy.catalog.shared.status}</th>
            </tr>
          </thead>
          <tbody>
            {report.enrolments.map(item => (
              <tr key={item.id}>
                <td>{item.courseName}</td>
                <td>{item.className ?? E.noClass}</td>
                <td>
                  <StatusBadge status={item.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="staff-muted">{E.empty}</p>
      )}
      <h3 className="staff-section-title">{S.tabLearning}</h3>
      {report.learning ? (
        <LearningTable learning={report.learning} />
      ) : (
        <p className="staff-muted">
          {report.learningError ?? S.reportLearningError}
        </p>
      )}
    </article>
  );
}

type Dialog =
  | "edit"
  | "fee"
  | "sale"
  | "moodle"
  | "moodle-reset"
  | "disable"
  | "enable"
  | { book: "placement" | "trial" };

export default function StudentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { session } = useStaffSession();
  const allowed = isAdmissionsRole(session?.ncc?.activeRole);
  const invalidate = useInvalidate();
  const branches = useBranches();
  const search = useSearch();
  const [, navigate] = useLocation();
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [secrets, setSecrets] = useState<StaffSecret[] | null>(null);
  const actions = useEnrolmentActions();

  const studentQuery = useNcc<{ student: NccStudentDto }>(
    allowed && id
      ? `/api/ncc/admissions/students/${encodeURIComponent(id)}`
      : null
  );
  const student = studentQuery.data?.student;
  useStaffCrumb(student?.name ?? null);
  const requested = new URLSearchParams(search).get("tab") as Tab | null;
  const tab: Tab =
    requested && TABS.includes(requested) ? requested : "overview";
  const enrolments = useStudentEnrolments(
    tab === "courses" ? student : undefined
  );
  const learning = useNcc<{ learning: NccStudentLearningDto }>(
    student && tab === "learning"
      ? `/api/ncc/admissions/students/${encodeURIComponent(student.id)}/learning`
      : null
  );
  const report = useNcc<{ report: NccStudentReportDto }>(
    student && tab === "report"
      ? `/api/ncc/admissions/students/${encodeURIComponent(student.id)}/report`
      : null
  );
  const placements = useNcc<NccPageDto<NccPlacementTestDto>>(
    student && tab === "bookings"
      ? "/api/ncc/admissions/placement-tests"
      : null,
    { studentId: id, pageSize: 100 }
  );
  const trials = useNcc<NccPageDto<NccTrialLessonDto>>(
    student && tab === "bookings" ? "/api/ncc/admissions/trial-lessons" : null,
    { studentId: id, pageSize: 100 }
  );

  if (!allowed)
    return <EmptyState title={copy.shell.noAccess} description={S.noAccess} />;
  if (studentQuery.error) {
    return (
      <ErrorState
        error={studentQuery.error}
        onRetry={() => void studentQuery.mutate()}
      />
    );
  }
  if (!student) return <LoadingRows />;

  const branch = branches.get(student.homeBranchId);
  const setTab = (next: Tab) => {
    const params = new URLSearchParams(search);
    if (next === "overview") params.delete("tab");
    else params.set("tab", next);
    navigate(`?${params.toString()}`, { replace: true });
  };
  const refresh = () => invalidate("/api/ncc/admissions/students");
  const labels: Record<Tab, string> = {
    overview: S.tabOverview,
    courses: S.tabCourses,
    learning: S.tabLearning,
    bookings: S.tabBookings,
    report: S.tabReport,
  };

  return (
    <div className="staff-detail flex min-w-0 flex-col gap-6">
      <header className="staff-detail-head staff-print-hide">
        <div className="staff-detail-id">
          <Avatar name={student.name} seed={student.id} size="lg" />
          <div className="min-w-0">
            <h1 className="staff-detail-name">{student.name}</h1>
            <div className="staff-detail-contact staff-ltr">
              <span title={student.email}>{student.email}</span>
              {student.phone ? <span>{student.phone}</span> : null}
            </div>
            <div className="staff-detail-meta">
              <StatusBadge status={student.status} />
              <StatusBadge
                status={student.moodleLinked ? "ok" : "plain"}
                label={`${S.moodle}: ${student.moodleLinked ? S.moodleLinked : S.moodleMissing}`}
              />
              <span className="staff-muted">{student.branchName}</span>
            </div>
          </div>
        </div>
        <div className="staff-detail-actions">
          <button
            type="button"
            className="staff-btn"
            data-size="sm"
            onClick={() => setDialog("edit")}
          >
            <Pencil strokeWidth={1.75} aria-hidden />
            {copy.actions.edit}
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="staff-icon-btn"
                aria-label={copy.staffUsers.moreActions}
              >
                <MoreHorizontal strokeWidth={1.75} aria-hidden />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              {student.moodleLinked ? (
                <DropdownMenuItem onSelect={() => setDialog("moodle-reset")}>
                  {S.moodleReset}
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onSelect={() => setDialog("moodle")}>
                  {S.moodleCreate}
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              {student.status === "active" ? (
                <DropdownMenuItem
                  className="text-[var(--staff-red)]"
                  onSelect={() => setDialog("disable")}
                >
                  {S.disable}
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onSelect={() => setDialog("enable")}>
                  {S.enable}
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {student.warnings?.length ? (
        <div
          className="staff-banner staff-print-hide"
          data-tone="caution"
          role="status"
        >
          <strong>{S.warnings}: </strong>
          {student.warnings.join(" ")}
        </div>
      ) : null}

      <dl className="staff-facts staff-print-hide">
        <div className="staff-fact">
          <dt>{S.branch}</dt>
          <dd>{student.branchName}</dd>
        </div>
        <div className="staff-fact">
          <dt>{S.owner}</dt>
          <dd>
            {student.assignedSsaName ?? (
              <span className="staff-muted">{L.unassigned}</span>
            )}
          </dd>
        </div>
        <div className="staff-fact">
          <dt>{S.registration}</dt>
          <dd>
            {student.registration ? (
              <button
                type="button"
                className="staff-link"
                onClick={() => setDialog("fee")}
              >
                {(student.registration.remaining ?? 0) <= 0
                  ? copy.admissions.money.settled
                  : `${formatAmount(student.registration.remaining)} ${copy.admissions.money.remaining.toLowerCase()}`}
              </button>
            ) : (
              <button
                type="button"
                className="staff-link"
                onClick={() => setDialog("fee")}
              >
                {L.recordFee}
              </button>
            )}
          </dd>
        </div>
        <div className="staff-fact">
          <dt>{S.added}</dt>
          <dd>{formatDate(student.createdAt)}</dd>
        </div>
      </dl>

      <div
        className="staff-tabs staff-print-hide"
        role="tablist"
        aria-label={student.name}
      >
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
            {tab === value ? <ActiveMark group="student-tabs" /> : null}
            {labels[value]}
          </button>
        ))}
      </div>

      {tab === "overview" ? (
        <div className="staff-detail-grid">
          <div className="staff-detail-main">
            <section className="staff-section">
              <h2 className="staff-section-title">{S.identity}</h2>
              <dl className="staff-dl">
                <Field label={I.nationality} value={student.nationality} />
                <Field
                  label={I.gender}
                  value={
                    student.gender
                      ? student.gender === "male"
                        ? I.male
                        : I.female
                      : null
                  }
                />
                <Field label={I.dateOfBirth} value={formatDob(student.dateOfBirth)} />
                <Field
                  label={I.nationalId}
                  value={
                    student.nationalId ? (
                      <span className="staff-ltr">{student.nationalId}</span>
                    ) : null
                  }
                />
                <Field label={I.passport} value={student.passportNumber} />
                <Field label={I.address} value={student.address} />
              </dl>
            </section>
            <section className="staff-section">
              <h2 className="staff-section-title">{S.guardians}</h2>
              {student.guardians.length === 0 ? (
                <p className="staff-muted">{S.noGuardians}</p>
              ) : (
                <ul className="staff-plain-list">
                  {student.guardians.map(guardian => (
                    <li key={guardian.sortOrder} className="staff-guardian-row">
                      <strong>{guardian.name}</strong>
                      <span className="staff-muted">
                        {guardian.relationship}
                      </span>
                      <span className="staff-ltr">{guardian.phone}</span>
                      <span className="staff-ltr staff-muted">
                        {guardian.email}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
          <aside className="staff-detail-side">
            <section className="staff-section">
              <div className="staff-section-head">
                <h2 className="staff-section-title">{S.registration}</h2>
                <button
                  type="button"
                  className="staff-icon-btn"
                  aria-label={student.registration ? L.editFee : L.recordFee}
                  title={student.registration ? L.editFee : L.recordFee}
                  onClick={() => setDialog("fee")}
                >
                  {student.registration ? (
                    <Pencil strokeWidth={1.75} aria-hidden />
                  ) : (
                    <Plus strokeWidth={1.75} aria-hidden />
                  )}
                </button>
              </div>
              {student.registration ? (
                <MoneyBar registration={student.registration} />
              ) : (
                <p className="staff-muted">{L.noFee}</p>
              )}
            </section>
            {student.note ? (
              <section className="staff-section">
                <h2 className="staff-section-title">{S.note}</h2>
                <p className="whitespace-pre-line">{student.note}</p>
              </section>
            ) : null}
          </aside>
        </div>
      ) : null}

      {tab === "courses" ? (
        <section className="staff-section">
          <div className="staff-section-head">
            <h2 className="staff-section-title">{S.tabCourses}</h2>
            <button
              type="button"
              className="staff-btn"
              data-size="sm"
              data-variant="primary"
              onClick={() => setDialog("sale")}
            >
              <Plus strokeWidth={1.75} aria-hidden />
              {E.sell}
            </button>
          </div>
          {enrolments.error ? (
            <ErrorState error={enrolments.error} />
          ) : enrolments.loading ? (
            <LoadingRows rows={3} />
          ) : enrolments.items.length === 0 ? (
            <EmptyState title={E.empty} description={E.emptyHint} />
          ) : (
            <EnrolmentTable items={enrolments.items} menu={actions.menu} />
          )}
        </section>
      ) : null}

      {tab === "learning" ? (
        <section className="staff-section">
          {learning.error ? (
            <ErrorState
              error={learning.error}
              onRetry={() => void learning.mutate()}
            />
          ) : !learning.data ? (
            <LoadingRows rows={3} />
          ) : (
            <>
              {learning.data.learning.moodleWarning ? (
                <p className="staff-banner" data-tone="caution">
                  {learning.data.learning.moodleWarning}
                </p>
              ) : null}
              <LearningTable learning={learning.data.learning} />
            </>
          )}
        </section>
      ) : null}

      {tab === "bookings" ? (
        <div className="flex flex-col gap-6">
          <section className="staff-section">
            <div className="staff-section-head">
              <h2 className="staff-section-title">{L.placements}</h2>
              <button
                type="button"
                className="staff-btn"
                data-size="sm"
                onClick={() => setDialog({ book: "placement" })}
              >
                {L.bookPlacement}
              </button>
            </div>
            {!placements.data ? (
              <LoadingRows rows={2} />
            ) : (
              <BookingList
                bookings={placements.data.items.map(item => ({
                  kind: "placement",
                  item,
                }))}
                branchFor={branches.get}
                empty={L.noPlacements}
              />
            )}
          </section>
          <section className="staff-section">
            <div className="staff-section-head">
              <h2 className="staff-section-title">{L.trials}</h2>
              <button
                type="button"
                className="staff-btn"
                data-size="sm"
                onClick={() => setDialog({ book: "trial" })}
              >
                {L.bookTrial}
              </button>
            </div>
            {!trials.data ? (
              <LoadingRows rows={2} />
            ) : (
              <BookingList
                bookings={trials.data.items.map(item => ({
                  kind: "trial",
                  item,
                }))}
                branchFor={branches.get}
                empty={L.noTrials}
              />
            )}
          </section>
        </div>
      ) : null}

      {tab === "report" ? (
        <section className="flex flex-col gap-4">
          <div className="staff-print-hide">
            <button
              type="button"
              className="staff-btn"
              data-size="sm"
              onClick={() => window.print()}
              disabled={!report.data}
            >
              <Printer strokeWidth={1.75} aria-hidden />
              {S.print}
            </button>
          </div>
          {report.error ? (
            <ErrorState
              error={report.error}
              onRetry={() => void report.mutate()}
            />
          ) : !report.data ? (
            <LoadingRows rows={4} />
          ) : (
            <ReportView report={report.data.report} />
          )}
        </section>
      ) : null}

      {actions.dialogs}
      <StudentForm
        open={dialog === "edit"}
        onOpenChange={open => !open && setDialog(null)}
        student={student}
      />
      <FeeSheet
        open={dialog === "fee"}
        onOpenChange={open => !open && setDialog(null)}
        target={{ type: "student", id: student.id }}
        registration={student.registration}
      />
      <SaleSheet
        open={dialog === "sale"}
        onOpenChange={open => !open && setDialog(null)}
        student={student}
      />
      <BookingSheet
        open={typeof dialog === "object" && dialog !== null}
        onOpenChange={open => !open && setDialog(null)}
        kind={typeof dialog === "object" && dialog ? dialog.book : "placement"}
        subject={{ type: "student", id: student.id, branch }}
        onSecrets={setSecrets}
      />
      <MoodleBindDialog
        open={dialog === "moodle"}
        onOpenChange={open => !open && setDialog(null)}
        onConfirm={bind =>
          runAction(
            async () => {
              const result = await staffWrite(
                bindNccStudentMoodleRequest(student.id, bind)
              );
              if (result.oneTime?.generatedMoodlePassword) {
                setSecrets([
                  {
                    label: S.moodlePassword,
                    value: result.oneTime.generatedMoodlePassword,
                  },
                ]);
              }
              await refresh();
              setDialog(null);
            },
            { success: S.moodleToast }
          )
        }
      />
      <ConfirmDialog
        open={dialog === "moodle-reset"}
        onOpenChange={open => !open && setDialog(null)}
        title={S.moodleResetTitle}
        description={S.moodleResetBody}
        confirmLabel={S.moodleReset}
        onConfirm={() =>
          runAction(
            async () => {
              const result = await staffWrite(
                resetNccStudentMoodlePasswordRequest(student.id)
              );
              setSecrets([
                {
                  label: S.moodlePassword,
                  value: result.oneTime.generatedMoodlePassword,
                },
              ]);
            },
            { success: S.moodleToast }
          )
        }
      />
      <ConfirmDialog
        open={dialog === "disable"}
        onOpenChange={open => !open && setDialog(null)}
        title={S.disableTitle}
        description={S.disableBody}
        confirmLabel={S.disable}
        destructive
        reasonKind="disable_student"
        reasonRequired
        onConfirm={reasonId =>
          runAction(
            async () => {
              await staffWrite(disableNccStudentRequest(student.id, reasonId));
              // Registrar and SSA cannot see disabled students (EMS returns 404).
              const visible = await staffGet(
                `/api/ncc/admissions/students/${encodeURIComponent(student.id)}`
              ).then(
                () => true,
                () => false
              );
              if (!visible) navigate("/app/students");
              await refresh();
            },
            { success: S.disabledToast }
          )
        }
      />
      <ConfirmDialog
        open={dialog === "enable"}
        onOpenChange={open => !open && setDialog(null)}
        title={S.enableTitle}
        description={S.enableBody}
        confirmLabel={S.enable}
        onConfirm={() =>
          runAction(
            async () => {
              await staffWrite(enableNccStudentRequest(student.id));
              await refresh();
            },
            { success: S.enabledToast }
          )
        }
      />
      <SecretDialog secrets={secrets} onClose={() => setSecrets(null)} />
    </div>
  );
}
