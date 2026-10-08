import useSWR from "swr";
import { Link, useLocation, useSearch } from "wouter";
import { Check } from "lucide-react";
import type {
  NccClassDto,
  NccDashboardSummaryDto,
  NccPageDto,
  NccPlacementTestDto,
  NccTeacherWorkspaceDto,
  NccTrialLessonDto,
} from "@/lib/backend/api";
import { formatInZone } from "../admissions";
import { staffGet, useNcc, type StaffQuery } from "../api";
import { copy } from "../copy";
import {
  PERIODS,
  bookingOutcomes,
  delta,
  fillPercent,
  greetingPart,
  leadOutcomes,
  periodWindows,
  splitToday,
  weekWindows,
  type Period,
} from "../dashboard";
import { canManageForms } from "../forms/model";
import { intlLocale } from "../i18n";
import { canSetAssignee, isAdmissionsRole } from "../roles";
import { useStaffSession } from "../session";
import { Columns, Donut, Funnel, Sparkline, SplitBar } from "../ui/charts";
import { Change, Panel, PanelLink, PeriodSwitch, Tile, fmt } from "../ui/insights";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/kit";
import { EmptyState, ErrorState, LoadingRows, StatusBadge } from "../ui/primitives";
import { useBranches } from "./admissions-ui";
import { dayKey } from "./booking-list";
import { scheduleText } from "./enrolment-actions";

const D = copy.dashboard;
const OPEN_STAGES = "in_process,follow_up,placement_test,trial_lesson,future_registration";
const ALL = "__all";

/* ---------------- Building blocks ----------------------------------- */

function Greeting({ context }: { context?: string | null }) {
  const { session } = useStaffSession();
  const first = session?.name?.split(" ")[0] ?? "";
  const date = new Date().toLocaleDateString(intlLocale(), {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  return (
    <header className="staff-page-header">
      <div className="staff-page-heading">
        <div className="staff-eyebrow">
          {date}
          {context ? ` · ${context}` : ""}
        </div>
        <h1>
          {D[greetingPart(new Date().getHours())]}
          {first ? `${D.nameSeparator}${first}` : ""}
        </h1>
        <p className="staff-page-desc">{D.intro}</p>
      </div>
    </header>
  );
}

/** Server total of a one-row page read; `null` while loading or denied. */
function useTotal(path: string | null, query: StaffQuery) {
  const result = useNcc<{ total: number }>(path, { ...query, pageSize: 1 });
  return result.data ? result.data.total : null;
}

/* ---------------- Admissions and management ------------------------- */

const SUMMARY = "/api/ncc/dashboard/summary";

function AdmissionsDashboard() {
  const { session } = useStaffSession();
  const role = session?.ncc?.activeRole ?? null;
  const branches = useBranches();
  const search = useSearch();
  const [, navigate] = useLocation();
  const params = new URLSearchParams(search);
  const period = (PERIODS as string[]).includes(params.get("period") ?? "") ? (params.get("period") as Period) : "30d";
  const branchFilter = role === "super_admin" ? (params.get("branch") ?? "") : "";
  const setParam = (key: string, value: string, fallback: string) => {
    const next = new URLSearchParams(search);
    if (value === fallback) next.delete(key);
    else next.set(key, value);
    navigate(`?${next.toString()}`, { replace: true });
  };
  const scope = branchFilter ? { branchId: branchFilter } : {};
  const windows = periodWindows(period);
  const summary = useNcc<{ summary: NccDashboardSummaryDto }>(SUMMARY, scope);
  const current = useNcc<{ summary: NccDashboardSummaryDto }>(
    windows.current ? SUMMARY : null,
    { ...scope, ...windows.current }
  );
  const previous = useNcc<{ summary: NccDashboardSummaryDto }>(
    windows.previous ? SUMMARY : null,
    { ...scope, ...windows.previous }
  );
  // Eight weekly windows in one request batch for the intake chart.
  const weeksKey = weekWindows(8);
  const weeks = useSWR(
    session ? ["dashboard-weeks", session.userId, role, branchFilter, weeksKey[0].createdFrom] : null,
    () =>
      Promise.all(
        weeksKey.map(window => staffGet<{ summary: NccDashboardSummaryDto }>(SUMMARY, { ...scope, ...window }))
      ),
    { revalidateOnFocus: false }
  );
  const bookingQuery = { status: "scheduled", sort: "scheduled_at", order: "asc", pageSize: 100 };
  const placements = useNcc<NccPageDto<NccPlacementTestDto>>(
    "/api/ncc/admissions/placement-tests",
    bookingQuery
  );
  const trials = useNcc<NccPageDto<NccTrialLessonDto>>(
    "/api/ncc/admissions/trial-lessons",
    bookingQuery
  );
  const unpaid = useTotal("/api/ncc/admissions/enrolments", { status: "pending_payment" });
  // The enrolment status filter takes one value; paid sales wait in two.
  const pendingClass = useTotal("/api/ncc/admissions/enrolments", { status: "pending_class" });
  const pendingGroup = useTotal("/api/ncc/admissions/enrolments", { status: "pending_group" });
  const waitingClass =
    pendingClass === null || pendingGroup === null ? null : pendingClass + pendingGroup;
  // Our own forms: new responses waiting for a decision.
  const formResponses = useNcc<Array<{ submission: { status: string } }>>(
    canManageForms(session?.activeRole) ? "/api/forms/submissions" : null
  );
  const newResponses = formResponses.data
    ? formResponses.data.filter(item => item.submission.status === "submitted").length
    : null;
  const unowned = useTotal(
    canSetAssignee(role) ? "/api/ncc/admissions/leads" : null,
    { unassigned: true, status: OPEN_STAGES }
  );

  const zone = (branchId: string) => branches.get(branchId)?.timezone;
  const bookings = [
    ...(placements.data?.items ?? []).map(item => ({ ...item, kind: "placement" as const })),
    ...(trials.data?.items ?? []).map(item => ({ ...item, kind: "trial" as const })),
  ];
  const { today, overdue } = splitToday(bookings, zone);
  const cards = summary.data?.summary.cards;
  const fill = cards ? fillPercent(cards.enrolmentFill, cards.enrolmentCapacity) : 0;
  const pipeline = (summary.data?.summary.charts.leadsByStatus ?? []).filter(
    item => !["registered", "lost"].includes(item.key)
  );
  const pipelineMax = Math.max(1, ...pipeline.map(item => item.count));
  const byBranch = summary.data?.summary.byBranch ?? [];
  const workspace = branches.get(session?.ncc?.workspaceBranchId)?.name ?? null;

  // Period insights ("all" reads the unfiltered summary).
  const periodSummary = windows.current ? current.data?.summary : summary.data?.summary;
  const now = periodSummary ? leadOutcomes(periodSummary.charts.leadsByStatus) : null;
  const before = previous.data ? leadOutcomes(previous.data.summary.charts.leadsByStatus) : null;
  const outcomes = periodSummary ? bookingOutcomes(periodSummary.charts.placementTrialByStatus) : null;
  const weekly = (weeks.data ?? []).map(item => leadOutcomes(item.summary.charts.leadsByStatus).total);
  const weekLabel = (from: string) =>
    new Date(`${from}T12:00:00Z`).toLocaleDateString(intlLocale(), { day: "numeric", month: "short", timeZone: "UTC" });

  const attention = [
    { label: D.resultsToRecord, count: placements.data && trials.data ? overdue.length : null, href: "/app/placement-tests" },
    { label: D.unpaid, count: unpaid, href: "/app/enrolments?status=pending_payment" },
    { label: D.waitingClass, count: waitingClass, href: "/app/enrolments" },
    ...(canSetAssignee(role)
      ? [{ label: D.unowned, count: unowned, href: "/app/leads?owner=none" }]
      : []),
    ...(canManageForms(session?.activeRole)
      ? [{ label: D.formResponses, count: newResponses, href: "/app/forms?tab=responses" }]
      : []),
  ];
  const clear = attention.every(item => item.count === 0);

  return (
    <div className="staff-dash">
      <div className="staff-dash-head">
        <Greeting context={workspace} />
        <div className="staff-dash-controls">
          {role === "super_admin" && branches.active.length > 1 ? (
            <Select value={branchFilter || ALL} onValueChange={value => setParam("branch", value === ALL ? "" : value, "")}>
              <SelectTrigger size="sm" aria-label={D.branch}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{copy.teaching.allBranches}</SelectItem>
                {branches.active.map(branch => (
                  <SelectItem key={branch.id} value={branch.id}>
                    {branch.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
          <PeriodSwitch value={period} onChange={value => setParam("period", value, "30d")} />
        </div>
      </div>

      {summary.error ? (
        <ErrorState error={summary.error} onRetry={() => void summary.mutate()} />
      ) : (
        <div className="staff-tiles staff-tiles-insight">
          <Tile
            label={D.newLeads}
            value={now ? fmt(now.total) : "–"}
            note={
              <>
                <Change value={delta(now?.total ?? null, before?.total ?? null)} />
                {weekly.length ? <Sparkline values={weekly} label={D.intakeNote} /> : null}
              </>
            }
            href="/app/leads"
          />
          <Tile
            label={D.conversion}
            value={now?.conversion !== null && now ? `${now.conversion}%` : "–"}
            note={
              <>
                <Change value={delta(now?.conversion ?? null, before?.conversion ?? null)} unit={D.pts} />
                <span className="staff-tile-note">{D.conversionNote}</span>
              </>
            }
          />
          <Tile
            label={D.bookings}
            value={cards ? fmt(cards.scheduledPlacements + cards.scheduledTrials) : "–"}
            note={
              cards
                ? `${fmt(cards.scheduledPlacements)} ${D.tests} · ${fmt(cards.scheduledTrials)} ${D.trials}`
                : null
            }
            href="/app/placement-tests"
          />
          <Tile
            label={D.classFill}
            value={cards ? `${fill}%` : "–"}
            meter={cards ? fill : undefined}
            note={
              cards
                ? `${fmt(cards.enrolmentFill)} ${D.seatsOf} ${fmt(cards.enrolmentCapacity)} ${D.seats}`
                : null
            }
          />
        </div>
      )}

      <div className="staff-dash-board">
        <Panel area="intake" title={D.intake} action={<span className="staff-muted staff-panel-note">{D.intakeNote}</span>}>
          {!weeks.data ? (
            <LoadingRows rows={4} />
          ) : (
            <Columns
              label={D.intake}
              points={weeksKey.map((window, index) => ({
                label: weekLabel(window.createdFrom),
                value: weekly[index] ?? null,
                hint: `${D.weekOf} ${weekLabel(window.createdFrom)}: ${weekly[index] ?? 0}`,
              }))}
            />
          )}
        </Panel>

        <Panel area="outcomes" title={D.outcomes} action={<span className="staff-muted staff-panel-note">{D.periods[period]}</span>}>
          {!now ? (
            <LoadingRows rows={4} />
          ) : now.total === 0 ? (
            <p className="staff-muted">{D.noData}</p>
          ) : (
            <Donut
              centerValue={now.conversion === null ? "–" : `${now.conversion}%`}
              centerLabel={D.conversion}
              segments={[
                { label: D.open, value: now.open, tone: "gold" },
                { label: D.registered, value: now.registered, tone: "positive" },
                { label: D.lost, value: now.lost, tone: "neutral" },
              ]}
            />
          )}
        </Panel>

        <Panel area="today" title={D.today} action={<PanelLink href="/app/placement-tests" label={D.openAgenda} />}>
          {!placements.data || !trials.data ? (
            <LoadingRows rows={3} />
          ) : today.length === 0 ? (
            <p className="staff-muted">{D.todayEmpty}</p>
          ) : (
            <ul className="staff-agenda-list">
              {today.map(item => (
                <li key={`${item.kind}-${item.id}`} className="staff-agenda-item">
                  <span className="staff-agenda-time">
                    {new Date(item.scheduledAt as string).toLocaleTimeString(intlLocale(), {
                      hour: "numeric",
                      minute: "2-digit",
                      ...(zone(item.branchId) ? { timeZone: zone(item.branchId) } : {}),
                    })}
                  </span>
                  <span className="staff-agenda-body">
                    <Link
                      href={item.subject.type === "lead" ? `/app/leads/${item.subject.id}` : `/app/students/${item.subject.id}`}
                      className="staff-agenda-name"
                    >
                      {item.subject.name}
                    </Link>
                    <span className="staff-muted">
                      {item.kind === "placement" ? D.placement : D.trial}
                      {item.meetingUrl ? ` · ${copy.admissions.mode.online}` : item.roomName ? ` · ${item.roomName}` : ""}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel area="attention" title={D.attention}>
          {clear ? (
            <p className="staff-allclear">
              <Check strokeWidth={2} aria-hidden />
              {D.allClear}
            </p>
          ) : null}
          <ul className="staff-attention">
            {attention.map(item => (
              <li key={item.label}>
                <Link href={item.href} className="staff-attention-row" data-zero={item.count === 0 || undefined}>
                  <span>{item.label}</span>
                  <span className="staff-attention-count">{item.count === null ? "–" : fmt(item.count)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel area="funnel" title={D.funnel} action={<span className="staff-muted staff-panel-note">{D.periods[period]}</span>}>
          {!now || !outcomes ? (
            <LoadingRows rows={3} />
          ) : (
            <Funnel
              steps={[
                { label: D.funnelLeads, value: now.total },
                { label: D.funnelBooked, value: outcomes.placement.completed + outcomes.trial.completed },
                { label: D.registered, value: now.registered },
              ]}
            />
          )}
        </Panel>

        <Panel area="bookings" title={D.bookingsTitle} action={<span className="staff-muted staff-panel-note">{D.periods[period]}</span>}>
          {!outcomes ? (
            <LoadingRows rows={3} />
          ) : (
            <div className="staff-dash-stack">
              {(["placement", "trial"] as const).map(kind => {
                const side = outcomes[kind];
                return (
                  <div key={kind} className="staff-dash-split">
                    <div className="staff-section-head">
                      <span className="staff-dash-split-title">{kind === "placement" ? D.placementTests : D.trialLessons}</span>
                      <span className="staff-muted">
                        {side.showRate === null ? "–" : `${side.showRate}%`} {D.showRate}
                      </span>
                    </div>
                    <SplitBar
                      label={kind === "placement" ? D.placementTests : D.trialLessons}
                      segments={[
                        { label: D.completed, value: side.completed, tone: "positive" },
                        { label: D.scheduledLabel, value: side.scheduled, tone: "gold" },
                        { label: D.noShow, value: side.noShow, tone: "caution" },
                        { label: D.cancelled, value: side.cancelled, tone: "neutral" },
                      ]}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </Panel>

        <Panel area="pipeline" title={D.pipeline} action={<PanelLink href="/app/leads" label={copy.admissions.leads.title} />}>
          {!summary.data ? (
            <LoadingRows rows={4} />
          ) : pipeline.every(item => item.count === 0) ? (
            <p className="staff-muted">{D.pipelineEmpty}</p>
          ) : (
            <ul className="staff-bars">
              {pipeline.map(item => (
                <li key={item.key}>
                  <Link href={`/app/leads?status=${item.key}`} className="staff-bar-row">
                    <span className="staff-bar-label">
                      {copy.status[item.key as keyof typeof copy.status] ?? item.label}
                    </span>
                    <span className="staff-bar-track" aria-hidden>
                      <span style={{ inlineSize: `${(item.count / pipelineMax) * 100}%` }} />
                    </span>
                    <span className="staff-bar-count">{fmt(item.count)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel area="students" title={D.activeStudents} action={<PanelLink href="/app/students" label={copy.admissions.students.title} />}>
          <div className="staff-bignum">
            <span>{cards ? fmt(cards.activeStudents) : "–"}</span>
            <span className="staff-muted">{D.activeStudentsNote}</span>
          </div>
          {cards ? (
            <dl className="staff-mini-facts">
              <div>
                <dt>{D.classes}</dt>
                <dd>{fmt(cards.activeClasses)}</dd>
              </div>
              {cards.staffCount !== null ? (
                <div>
                  <dt>{copy.nav.staffUsers}</dt>
                  <dd>{fmt(cards.staffCount)}</dd>
                </div>
              ) : null}
            </dl>
          ) : null}
        </Panel>
      </div>

      {byBranch.length > 1 || (role === "super_admin" && byBranch.length > 0) ? (
        <Panel title={D.branches}>
          <div className="staff-table-wrap staff-table-flat">
            <table className="staff-table">
              <thead>
                <tr>
                  <th scope="col">{D.branch}</th>
                  <th scope="col">{D.students}</th>
                  <th scope="col">{D.openLeads}</th>
                  <th scope="col">{D.classes}</th>
                  <th scope="col">{D.fill}</th>
                  <th scope="col">{D.waiting}</th>
                </tr>
              </thead>
              <tbody>
                {byBranch.map(row => {
                  const pct = fillPercent(row.enrolmentFill, row.enrolmentCapacity);
                  return (
                    <tr key={row.branchId}>
                      <td>
                        <Link href={`/app/branches/${row.branchId}`} className="staff-link-quiet">
                          {row.branchName}
                        </Link>
                      </td>
                      <td>{fmt(row.activeStudents)}</td>
                      <td>{fmt(row.openLeads)}</td>
                      <td>{fmt(row.activeClasses)}</td>
                      <td>
                        <span className="staff-inline-meter">
                          <span className="staff-tile-meter" aria-hidden>
                            <span style={{ inlineSize: `${pct}%` }} />
                          </span>
                          {pct}%
                        </span>
                      </td>
                      <td>{fmt(row.pendingEnrolments)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      ) : null}
    </div>
  );
}

/* ---------------- Teacher ------------------------------------------- */

function TeacherDashboard() {
  const workspace = useNcc<{ workspace: NccTeacherWorkspaceDto }>(
    "/api/ncc/delivery/teacher-workspace"
  );
  if (workspace.error) {
    return (
      <div className="staff-dash">
        <Greeting />
        <ErrorState error={workspace.error} onRetry={() => void workspace.mutate()} />
      </div>
    );
  }
  const data = workspace.data?.workspace;
  const classes = data?.classes ?? [];
  const sessions = (data?.upcomingSessions ?? []).filter(item => item.status !== "cancelled");
  const next = sessions[0];
  const students = classes.reduce((sum, item) => sum + item.activeEnrolmentCount, 0);
  const days = new Map<string, typeof sessions>();
  for (const item of sessions) {
    const key = dayKey(item.startsAt);
    days.set(key, [...(days.get(key) ?? []), item]);
  }

  return (
    <div className="staff-dash">
      <Greeting />
      <div className="staff-tiles">
        <Tile label={D.myClasses} value={data ? fmt(classes.length) : "–"} />
        <Tile label={D.myStudents} value={data ? fmt(students) : "–"} />
        <Tile
          label={D.nextSession}
          value={next ? formatInZone(next.startsAt) : data ? "–" : "–"}
          note={next ? `${next.className ?? ""}${next.roomName ? ` · ${next.roomName}` : ""}` : data ? D.noNextSession : null}
        />
      </div>
      <div className="staff-dash-grid">
        <Panel title={D.sessions} action={<PanelLink href="/app/sessions" label={copy.teaching.week.title} />}>
          {!data ? (
            <LoadingRows rows={3} />
          ) : sessions.length === 0 ? (
            <p className="staff-muted">{D.sessionsEmpty}</p>
          ) : (
            <div className="staff-day-groups">
              {Array.from(days, ([key, items]) => (
                <div key={key}>
                  <h3 className="staff-day-label">
                    {new Date(`${key}T12:00:00Z`).toLocaleDateString(intlLocale(), {
                      weekday: "long",
                      day: "numeric",
                      month: "short",
                      timeZone: "UTC",
                    })}
                  </h3>
                  <ul className="staff-agenda-list">
                    {items.map(item => (
                      <li key={item.id} className="staff-agenda-item">
                        <span className="staff-agenda-time">
                          {new Date(item.startsAt).toLocaleTimeString(intlLocale(), {
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </span>
                        <span className="staff-agenda-body">
                          {item.classId ? (
                            <Link href={`/app/classes/${item.classId}`} className="staff-agenda-name">
                              {item.className}
                            </Link>
                          ) : (
                            <span className="staff-agenda-name">{item.className}</span>
                          )}
                          <span className="staff-muted">{item.roomName ?? copy.admissions.mode.online}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </Panel>
        <Panel title={D.myClasses}>
          {!data ? (
            <LoadingRows rows={3} />
          ) : classes.length === 0 ? (
            <p className="staff-muted">{D.classesEmpty}</p>
          ) : (
            <ul className="staff-class-list">
              {classes.map(item => (
                <li key={item.id}>
                  <span className="staff-cell-stack">
                    <Link href={`/app/classes/${item.id}`} className="staff-agenda-name">
                      {item.name}
                    </Link>
                    <span className="staff-muted">
                      {item.courseName ?? ""} · {fmt(item.activeEnrolmentCount)} {D.enrolled}
                    </span>
                  </span>
                  {item.moodleCourseUrl ? (
                    <a className="staff-btn" data-size="sm" href={item.moodleCourseUrl} target="_blank" rel="noreferrer">
                      {D.openMoodle}
                    </a>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}

/* ---------------- Head of department -------------------------------- */

function DepartmentDashboard() {
  const classes = useNcc<NccPageDto<NccClassDto>>("/api/ncc/delivery/classes", {
    status: "active",
    pageSize: 100,
  });
  if (classes.error) {
    return (
      <div className="staff-dash">
        <Greeting />
        <ErrorState error={classes.error} onRetry={() => void classes.mutate()} />
      </div>
    );
  }
  const items = classes.data?.items ?? [];
  const enrolled = items.reduce((sum, item) => sum + item.activeEnrolmentCount, 0);
  const capacity = items.reduce((sum, item) => sum + item.capacity, 0);
  const noTeacher = items.filter(item => item.teachers.length === 0).length;
  const fill = fillPercent(enrolled, capacity);

  return (
    <div className="staff-dash">
      <Greeting />
      <div className="staff-tiles">
        <Tile label={D.departmentClasses} value={classes.data ? fmt(items.length) : "–"} />
        <Tile
          label={D.classFill}
          value={classes.data ? `${fill}%` : "–"}
          meter={classes.data ? fill : undefined}
          note={classes.data ? `${fmt(enrolled)} ${D.seatsOf} ${fmt(capacity)} ${D.seats}` : null}
        />
        <Tile label={D.seatsFree} value={classes.data ? fmt(Math.max(0, capacity - enrolled)) : "–"} />
        <Tile label={D.noTeacher} value={classes.data ? fmt(noTeacher) : "–"} />
      </div>
      <Panel title={D.departmentClasses}>
        {!classes.data ? (
          <LoadingRows rows={4} />
        ) : items.length === 0 ? (
          <p className="staff-muted">{D.departmentEmpty}</p>
        ) : (
          <div className="staff-table-wrap staff-table-flat">
            <table className="staff-table">
              <thead>
                <tr>
                  <th scope="col">{D.classes}</th>
                  <th scope="col">{D.teachers}</th>
                  <th scope="col">{D.schedule}</th>
                  <th scope="col">{D.fill}</th>
                </tr>
              </thead>
              <tbody>
                {items.map(item => {
                  const pct = fillPercent(item.activeEnrolmentCount, item.capacity);
                  return (
                    <tr key={item.id}>
                      <td>
                        <span className="staff-cell-stack">
                          <Link href={`/app/classes/${item.id}`} className="staff-link-quiet">
                            {item.name}
                          </Link>
                          <span className="staff-muted">{item.courseName}</span>
                        </span>
                      </td>
                      <td>
                        {item.teachers.length ? (
                          item.teachers.map(teacher => teacher.name).join(", ")
                        ) : (
                          <StatusBadge status="pending" label={D.unassignedTeacher} />
                        )}
                      </td>
                      <td>{scheduleText(item) ?? <span className="staff-muted">{copy.state.notSet}</span>}</td>
                      <td>
                        <span className="staff-inline-meter">
                          <span className="staff-tile-meter" aria-hidden>
                            <span style={{ inlineSize: `${pct}%` }} />
                          </span>
                          {fmt(item.activeEnrolmentCount)}/{fmt(item.capacity)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}

/* ---------------- Route --------------------------------------------- */

/** One dashboard per job: admissions and management, teaching, department. */
export default function DashboardPage() {
  const { session } = useStaffSession();
  const role = session?.ncc?.activeRole ?? null;
  if (role === "teacher") return <TeacherDashboard />;
  if (role === "hod") return <DepartmentDashboard />;
  if (isAdmissionsRole(role)) return <AdmissionsDashboard />;
  return <EmptyState title={copy.shell.noAccess} />;
}
