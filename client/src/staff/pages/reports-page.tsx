import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type Key,
  type ReactNode,
} from "react";
import useSWR from "swr";
import { Link, useLocation, useSearch } from "wouter";
import { BarChart3, Download } from "lucide-react";
import type {
  NccClassDto,
  NccEnrolmentDto,
  NccLeadDto,
  NccPlacementTestDto,
  NccRole,
  NccTrialLessonDto,
} from "@/lib/backend/api";
import {
  fetchAllPages,
  toStaffKey,
  useAllPages,
} from "../api";
import { copy } from "../copy";
import { downloadCsv, toCsv, type CsvColumn, type CsvRow } from "../csv";
import { REPORT_PERIODS, delta, fillPercent, type Period } from "../dashboard";
import { intlLocale } from "../i18n";
import { CLASS_READ } from "../nav";
import { isAdmissionsRole } from "../roles";
import {
  admissionsReport,
  bookingsReport,
  classesReport,
  enrolmentsReport,
  inWindow,
  reportWindows,
  type BreakdownRow,
  type EnrolmentGroupRow,
  type ReportWindow,
  type ShareRow,
} from "../reports";
import { staffScope, useStaffSession } from "../session";
import { Columns, Donut, Funnel, SplitBar, type ChartTone } from "../ui/charts";
import { Change, Panel, PeriodSwitch, Tile, fmt } from "../ui/insights";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/kit";
import {
  ActiveMark,
  EmptyState,
  ErrorState,
  LoadingRows,
  PageHeader,
} from "../ui/primitives";
import { useBranches } from "./admissions-ui";
import { SeatsMeter } from "./teaching-ui";

const R = copy.reports;
const ALL = "__all";
const PAGE_ROWS = 10;

const REPORT_IDS = ["admissions", "bookings", "enrolments", "classes"] as const;
type ReportId = (typeof REPORT_IDS)[number];

/** Reports each role can see; classes is the only one open beyond admissions. */
function visibleReports(role: NccRole | null): ReportId[] {
  const out: ReportId[] = [];
  if (isAdmissionsRole(role)) out.push("admissions", "bookings", "enrolments");
  if (role && (CLASS_READ as readonly NccRole[]).includes(role)) out.push("classes");
  return out;
}

/** `{n}` / `{total}` placeholders in copy strings. */
function fill(template: string, vars: Record<string, string>) {
  return Object.entries(vars).reduce(
    (text, [key, value]) => text.replace(`{${key}}`, value),
    template
  );
}

const pctLabel = (value: number | null) => (value === null ? "–" : `${value}%`);

const dayLabel = (iso: string, month = false) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString(
    intlLocale(),
    month ? { month: "short" } : { day: "numeric", month: "short" }
  );

/** EMS weekdays: 0 = Monday … 6 = Sunday. */
const WEEKDAY_BASE = new Date("2024-01-01T12:00:00Z"); // a Monday
const weekdayLabel = (index: number) =>
  new Date(WEEKDAY_BASE.getTime() + index * 864e5).toLocaleDateString(
    intlLocale(),
    { weekday: "short" }
  );

/* ---------------- Shared page pieces -------------------------------------- */

/**
 * Breakdown table. The first column is the row label: it truncates with an
 * ellipsis plus a tooltip rather than squeezing the numeric columns. Below
 * 600px the table collapses into two-line rows (label, then "metric value"
 * pairs) via `.staff-table-compact`.
 */
function Table<T>({
  caption,
  columns,
  rows,
  rowKey,
  rowTitle,
  render,
}: {
  /** Screen-reader caption; reuse the panel title. */
  caption: string;
  columns: { label: string; title?: string; num?: boolean }[];
  rows: T[];
  rowKey: (row: T, index: number) => Key;
  /** Tooltip text for the truncating label cell. */
  rowTitle?: (row: T) => string;
  render: (row: T) => ReactNode[];
}) {
  const [all, setAll] = useState(false);
  const shown = all ? rows : rows.slice(0, PAGE_ROWS);
  return (
    <div className="staff-table-wrap staff-table-flat staff-table-compact">
      <table className="staff-table">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            {columns.map((column, index) => (
              <th
                key={index}
                scope="col"
                className={column.num ? "staff-num" : undefined}
                title={column.title}
                aria-label={column.title}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {shown.map((row, index) => (
            <tr key={rowKey(row, index)}>
              {render(row).map((cell, cellIndex) => {
                const column = columns[cellIndex];
                if (cellIndex === 0)
                  return (
                    <td key={0} className="staff-cell-label">
                      <span
                        className="staff-cell-ellip"
                        title={rowTitle ? rowTitle(row) : undefined}
                      >
                        {cell}
                      </span>
                    </td>
                  );
                return (
                  <td
                    key={cellIndex}
                    className={column?.num ? "staff-num" : undefined}
                    data-label={column?.title ?? column?.label}
                  >
                    {cell}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > PAGE_ROWS ? (
        <button
          type="button"
          className="staff-report-more"
          onClick={() => setAll(value => !value)}
        >
          {all ? R.showLess : fill(R.showAll, { n: fmt(rows.length) })}
        </button>
      ) : null}
    </div>
  );
}

function ReportNotice({
  truncated,
  total,
  footnote,
}: {
  truncated: boolean;
  total: number;
  footnote: string;
}) {
  return (
    <footer className="staff-report-foot">
      {truncated ? (
        <p className="staff-report-truncated">
          {fill(R.truncated, { n: fmt(5000), total: fmt(total) })}
        </p>
      ) : null}
      <p className="staff-muted">
        {footnote} {R.liveFootnote}
      </p>
    </footer>
  );
}

function ReportEmpty({ text, onWiden }: { text: string; onWiden?: () => void }) {
  return (
    <EmptyState
      icon={<BarChart3 strokeWidth={1.75} />}
      title={R.emptyTitle}
      description={text}
      action={
        onWiden ? (
          <button type="button" className="staff-btn" onClick={onWiden}>
            {R.changePeriod}
          </button>
        ) : null
      }
    />
  );
}

const PanelEmpty = ({ text }: { text: string }) => (
  <p className="staff-panel-note staff-muted">{text}</p>
);

const breakdownLabel = (row: BreakdownRow | ShareRow, fallback: string) =>
  row.label ?? fallback;

const dateOnly = (iso: string | null | undefined) => iso?.slice(0, 10) ?? null;

const dateTime = (iso: string | null | undefined) =>
  iso ? iso.slice(0, 16).replace("T", " ") : null;

/* ---------------- Per-report data hooks ----------------------------------- */

const ENROLMENT_STATUSES = [
  "pending_payment",
  "pending_class",
  "pending_group",
  "enrolled",
  "cancelled",
  "completed",
  "left",
] as const;

/** EMS only returns enrolments when a status filter is present — read all seven. */
function useEnrolmentsByStatus(branchId: string | null) {
  const { session } = useStaffSession();
  const scope = staffScope(session);
  const query = { branchId: branchId ?? undefined };
  const result = useSWR(
    toStaffKey(scope, "/api/ncc/admissions/enrolments#all-statuses", query),
    async () => {
      const parts = await Promise.all(
        ENROLMENT_STATUSES.map(status =>
          fetchAllPages<NccEnrolmentDto>("/api/ncc/admissions/enrolments", {
            ...query,
            status,
          })
        )
      );
      return {
        items: parts.flatMap(part => part.items),
        total: parts.reduce((sum, part) => sum + part.total, 0),
        truncated: parts.some(part => part.truncated),
      };
    },
    { revalidateOnFocus: false }
  );
  return {
    items: result.data?.items ?? [],
    total: result.data?.total ?? 0,
    truncated: result.data?.truncated ?? false,
    isLoading: result.isLoading,
    error: result.error,
    mutate: result.mutate,
  };
}

/* ---------------- CSV ------------------------------------------------------ */

function exportCsv(name: string, columns: CsvColumn[], rows: CsvRow[]) {
  const stamp = new Date().toISOString().slice(0, 10);
  downloadCsv(`nile-${name}-${stamp}.csv`, toCsv(columns, rows));
}

/**
 * Each report body registers its exporter once its data is ready; `null`
 * keeps the header button disabled while loading or empty.
 */
type RegisterExport = (fn: (() => void) | null) => void;

/* ---------------- Report bodies ------------------------------------------- */

function AdmissionsBody({
  branchId,
  window,
  previous,
  widen,
  registerExport,
}: {
  branchId: string | null;
  window: ReportWindow;
  previous: ReportWindow;
  widen: () => void;
  registerExport: RegisterExport;
}) {
  const leads = useAllPages<NccLeadDto>(
    "/api/ncc/admissions/leads",
    branchId ? { branchId } : undefined
  );
  const report = useMemo(
    () => admissionsReport(leads.items, window, previous),
    [leads.items, window, previous]
  );

  useEffect(() => {
    if (leads.isLoading || leads.error || report.kpis.total === 0) {
      registerExport(null);
      return;
    }
    registerExport(() =>
      exportCsv(
        "report-admissions",
        [
          { key: "name", label: R.csv.name },
          { key: "email", label: R.csv.email },
          { key: "phone", label: R.csv.phone },
          { key: "branch", label: R.csv.branch },
          { key: "source", label: R.csv.source },
          { key: "status", label: R.csv.status },
          { key: "lostReason", label: R.csv.lostReason },
          { key: "owner", label: R.csv.owner },
          { key: "area", label: R.csv.area },
          { key: "studyMode", label: R.csv.studyMode },
          { key: "created", label: R.csv.created },
        ],
        leads.items
          .filter(item => inWindow(item.createdAt, window))
          .map(item => ({
            name: item.name,
            email: item.email,
            phone: item.phone,
            branch: item.branchName,
            source: item.source,
            status: copy.status[item.status] ?? item.status,
            lostReason: item.lostReasonName ?? null,
            owner: item.assignedSsaName,
            area: item.areaOfStudyName ?? null,
            studyMode:
              R.modes[
                item.wantsOnline && item.wantsOnsite
                  ? "both"
                  : item.wantsOnline
                    ? "online"
                    : item.wantsOnsite
                      ? "onsite"
                      : "unset"
              ],
            created: dateOnly(item.createdAt),
          }))
      )
    );
    return () => registerExport(null);
  }, [leads.isLoading, leads.error, leads.items, report, window, registerExport]);

  if (leads.error)
    return <ErrorState error={leads.error} onRetry={() => void leads.mutate()} />;
  if (leads.isLoading) return <LoadingRows rows={8} />;
  if (report.kpis.total === 0)
    return (
      <>
        <ReportEmpty text={R.emptyAdmissions} onWiden={window ? widen : undefined} />
        <ReportNotice truncated={leads.truncated} total={leads.total} footnote={R.footnoteAdmissions} />
      </>
    );

  const prev = report.previous;
  const sourceLabel = (row: BreakdownRow | ShareRow) => breakdownLabel(row, R.noSource);
  const ownerLabel = (row: BreakdownRow) => row.label ?? R.noOwner;
  const areaLabel = (row: BreakdownRow) => row.label ?? R.notSet;
  const modeLabel = (row: ShareRow) =>
    R.modes[row.label as keyof typeof R.modes] ?? row.label ?? R.notSet;
  const typeLabel = (row: ShareRow) =>
    R.leadTypes[row.label as keyof typeof R.leadTypes] ?? row.label ?? R.notSet;

  const breakdownCells = (row: BreakdownRow, label: ReactNode) => [
    label,
    fmt(row.leads),
    fmt(row.open),
    fmt(row.registered),
    fmt(row.lost),
    pctLabel(row.conversion),
  ];
  const breakdownCols = [
    { label: "" },
    { label: R.leads, num: true },
    { label: R.open, num: true },
    { label: R.registered, num: true },
    { label: R.lost, num: true },
    { label: R.rate, title: R.conversion, num: true },
  ];

  return (
    <>
      <div className="staff-tiles staff-tiles-insight">
        <Tile
          label={R.newLeads}
          value={fmt(report.kpis.total)}
          note={<Change value={delta(report.kpis.total, prev?.total ?? null)} />}
        />
        <Tile
          label={R.registered}
          value={fmt(report.kpis.registered)}
          note={<Change value={delta(report.kpis.registered, prev?.registered ?? null)} />}
        />
        <Tile
          label={R.lost}
          value={fmt(report.kpis.lost)}
          note={<Change value={delta(report.kpis.lost, prev?.lost ?? null)} />}
        />
        <Tile
          label={R.open}
          value={fmt(report.kpis.open)}
          note={<Change value={delta(report.kpis.open, prev?.open ?? null)} />}
        />
        <Tile
          label={R.conversion}
          value={pctLabel(report.kpis.conversion)}
          note={
            <Change
              value={delta(report.kpis.conversion, prev?.conversion ?? null)}
              unit={copy.dashboard.pts}
            />
          }
        />
      </div>

      <div className="staff-dash-grid">
        <Panel
          title={R.intake}
          action={
            <span className="staff-panel-note staff-muted">
              {report.series.granularity === "week" ? R.intakePerWeek : R.intakePerMonth}
            </span>
          }
        >
          <Columns
            label={R.intake}
            points={report.series.points.map(point => ({
              label: dayLabel(point.from, report.series.granularity === "month"),
              value: point.count,
            }))}
          />
        </Panel>
        <Panel title={R.funnel}>
          <Funnel
            steps={[
              { label: R.newLeads, value: report.funnel.leads },
              { label: R.funnelDecided, value: report.funnel.decided },
              { label: R.registered, value: report.funnel.registered },
            ]}
          />
        </Panel>
      </div>

      <div className="staff-report-grid">
        <Panel title={R.bySource} wide>
          <Table
            caption={R.bySource}
            columns={breakdownCols}
            rows={report.bySource}
            rowKey={row => row.label ?? "none"}
            rowTitle={sourceLabel}
            render={row => breakdownCells(row, sourceLabel(row))}
          />
        </Panel>
        <Panel title={R.byOwner} wide>
          <Table
            caption={R.byOwner}
            columns={[
              { label: "" },
              { label: R.leads, num: true },
              { label: R.open, num: true },
              { label: R.registered, num: true },
              { label: R.rate, title: R.conversion, num: true },
            ]}
            rows={report.byOwner}
            rowKey={row => row.label ?? "none"}
            rowTitle={ownerLabel}
            render={row => [
              ownerLabel(row),
              fmt(row.leads),
              fmt(row.open),
              fmt(row.registered),
              pctLabel(row.conversion),
            ]}
          />
        </Panel>
        <Panel title={R.byArea} wide>
          <Table
            caption={R.byArea}
            columns={breakdownCols}
            rows={report.byArea}
            rowKey={row => row.label ?? "none"}
            rowTitle={areaLabel}
            render={row => breakdownCells(row, areaLabel(row))}
          />
        </Panel>
        {report.byBranch ? (
          <Panel title={R.byBranch} wide>
            <Table
              caption={R.byBranch}
              columns={breakdownCols}
              rows={report.byBranch}
              rowKey={row => row.label ?? "none"}
              rowTitle={row => row.label ?? R.notSet}
              render={row => breakdownCells(row, row.label ?? R.notSet)}
            />
          </Panel>
        ) : null}
        <Panel title={R.byLostReason}>
          {report.byLostReason.length === 0 ? (
            <PanelEmpty text={R.emptyLostReasons} />
          ) : (
            <Table
              caption={R.byLostReason}
              columns={[
                { label: "" },
                { label: R.count, num: true },
                { label: R.share, num: true },
              ]}
              rows={report.byLostReason}
              rowKey={row => row.label ?? "none"}
              rowTitle={row => row.label ?? R.noReason}
              render={row => [
                <Link
                  key="l"
                  href="/app/leads?status=lost"
                  className="staff-link-quiet"
                >
                  {row.label ?? R.noReason}
                </Link>,
                fmt(row.count),
                `${row.share}%`,
              ]}
            />
          )}
        </Panel>
        <Panel title={R.studyMode}>
          <SplitBar
            label={R.studyMode}
            segments={report.byStudyMode.map((row, index) => ({
              label: modeLabel(row),
              value: row.count,
              tone: (["ink", "gold", "positive", "neutral"] as ChartTone[])[index] ?? "neutral",
            }))}
          />
        </Panel>
        <Panel title={R.leadType}>
          <SplitBar
            label={R.leadType}
            segments={report.byLeadType.map((row, index) => ({
              label: typeLabel(row),
              value: row.count,
              tone: (["ink", "gold", "positive", "neutral"] as ChartTone[])[
                index % 4
              ],
            }))}
          />
        </Panel>
      </div>
      <ReportNotice truncated={leads.truncated} total={leads.total} footnote={R.footnoteAdmissions} />
    </>
  );
}

function BookingsBody({
  branchId,
  window,
  previous,
  widen,
  registerExport,
}: {
  branchId: string | null;
  window: ReportWindow;
  previous: ReportWindow;
  widen: () => void;
  registerExport: RegisterExport;
}) {
  const scope = branchId ? { branchId } : undefined;
  const placements = useAllPages<NccPlacementTestDto>(
    "/api/ncc/admissions/placement-tests",
    scope
  );
  const trials = useAllPages<NccTrialLessonDto>(
    "/api/ncc/admissions/trial-lessons",
    scope
  );
  const leads = useAllPages<NccLeadDto>("/api/ncc/admissions/leads", scope);
  const report = useMemo(
    () => bookingsReport(placements.items, trials.items, leads.items, window, previous),
    [placements.items, trials.items, leads.items, window, previous]
  );

  const error = placements.error ?? trials.error ?? leads.error;
  const retry = () => {
    void placements.mutate();
    void trials.mutate();
    void leads.mutate();
  };

  useEffect(() => {
    if (error || placements.isLoading || trials.isLoading || leads.isLoading) {
      registerExport(null);
      return;
    }
    registerExport(() =>
      exportCsv(
        "report-bookings",
        [
          { key: "type", label: R.csv.type },
          { key: "person", label: R.csv.person },
          { key: "branch", label: R.csv.branch },
          { key: "scheduled", label: R.csv.scheduled },
          { key: "status", label: R.csv.status },
          { key: "result", label: R.csv.result },
          { key: "courseOrArea", label: R.csv.courseOrArea },
          { key: "recommended", label: R.csv.recommended },
        ],
        [
          ...placements.items
            .filter(item => inWindow(item.scheduledAt, window))
            .map(item => ({
              sort: item.scheduledAt ?? "",
              type: R.placementTests,
              person: item.subject.name,
              branch: item.branchName,
              scheduled: dateTime(item.scheduledAt),
              status: copy.status[item.status] ?? item.status,
              result: item.resultScore,
              courseOrArea: item.areaOfStudyName ?? null,
              recommended: item.recommendedCourseName,
            })),
          ...trials.items
            .filter(item => inWindow(item.scheduledAt, window))
            .map(item => ({
              sort: item.scheduledAt ?? "",
              type: R.trialLessons,
              person: item.subject.name,
              branch: item.branchName,
              scheduled: dateTime(item.scheduledAt),
              status: copy.status[item.status] ?? item.status,
              result: item.resultScore,
              courseOrArea: item.courseName ?? item.areaOfStudyName,
              recommended: item.recommendedCourseName,
            })),
        ].sort((a, b) => a.sort.localeCompare(b.sort))
      )
    );
    return () => registerExport(null);
  }, [error, placements.isLoading, trials.isLoading, leads.isLoading, placements.items, trials.items, report, window, registerExport]);

  if (error) return <ErrorState error={error} onRetry={retry} />;
  if (placements.isLoading || trials.isLoading || leads.isLoading)
    return <LoadingRows rows={8} />;
  const total =
    report.placement.scheduled +
    report.placement.completed +
    report.placement.noShow +
    report.placement.cancelled +
    report.trial.scheduled +
    report.trial.completed +
    report.trial.noShow +
    report.trial.cancelled;
  const truncated =
    placements.truncated || trials.truncated || leads.truncated;
  const footnote = R.footnoteBookings;
  if (total === 0)
    return (
      <>
        <ReportEmpty text={R.emptyBookings} onWiden={window ? widen : undefined} />
        <ReportNotice
          truncated={truncated}
          total={placements.total + trials.total}
          footnote={footnote}
        />
      </>
    );

  const sidePanel = (
    title: string,
    emptyText: string,
    side: { scheduled: number; completed: number; noShow: number; cancelled: number; showRate: number | null },
    previousRate: number | null
  ) => (
    <Panel title={title}>
      <Donut
        centerValue={pctLabel(side.showRate)}
        centerLabel={R.showRate}
        empty={<PanelEmpty text={emptyText} />}
        segments={[
          { label: R.scheduled, value: side.scheduled, tone: "neutral" },
          { label: R.completed, value: side.completed, tone: "positive" },
          { label: R.noShow, value: side.noShow, tone: "critical" },
          { label: R.cancelled, value: side.cancelled, tone: "caution" },
        ]}
      />
      <p className="staff-panel-note staff-muted">
        <Change value={delta(side.showRate, previousRate)} unit={copy.dashboard.pts} />
      </p>
    </Panel>
  );

  const bandLabels = ["0–25%", "25–50%", "50–75%", "75–100%"];

  return (
    <>
      <div className="staff-dash-grid">
        {sidePanel(R.placementTests, R.emptyPlacements, report.placement, report.placementShowRatePrevious)}
        {sidePanel(R.trialLessons, R.emptyTrialLessons, report.trial, report.trialShowRatePrevious)}
      </div>

      <div className="staff-report-grid">
        <Panel title={R.scoreSummary}>
          {report.placementScore.count === 0 ? (
            <PanelEmpty text={R.emptyScores} />
          ) : (
            <>
              <dl className="staff-report-facts">
                <div>
                  <dt>{R.count}</dt>
                  <dd>{fmt(report.placementScore.count)}</dd>
                </div>
                <div>
                  <dt>{R.scoreAverage}</dt>
                  <dd>{report.placementScore.average ?? "–"}</dd>
                </div>
                <div>
                  <dt>{R.scoreMin}</dt>
                  <dd>{report.placementScore.min ?? "–"}</dd>
                </div>
                <div>
                  <dt>{R.scoreMax}</dt>
                  <dd>{report.placementScore.max ?? "–"}</dd>
                </div>
              </dl>
              <Columns
                label={R.scoreBands}
                height={120}
                points={report.placementScore.bands.map((count, index) => ({
                  label: bandLabels[index],
                  value: count,
                }))}
              />
            </>
          )}
        </Panel>
        <Panel title={R.trialResults}>
          {report.trialResults.length === 0 ? (
            <PanelEmpty text={R.emptyTrialResults} />
          ) : (
            <Table
              caption={R.trialResults}
              columns={[
                { label: "" },
                { label: R.count, num: true },
                { label: R.share, num: true },
              ]}
              rows={report.trialResults}
              rowKey={row => row.label ?? "none"}
              rowTitle={row => row.label ?? R.notSet}
              render={row => [row.label ?? R.notSet, fmt(row.count), `${row.share}%`]}
            />
          )}
        </Panel>
        <Panel title={R.trialsByCourse} wide>
          {report.trialsByCourse.length === 0 ? (
            <PanelEmpty text={R.emptyTrialLessons} />
          ) : (
            <Table
              caption={R.trialsByCourse}
              columns={[
                { label: "" },
                { label: R.trials, num: true },
                { label: R.completed, num: true },
                { label: R.showRate, num: true },
              ]}
              rows={report.trialsByCourse}
              rowKey={row => row.label ?? "none"}
              rowTitle={row => row.label ?? R.notSet}
              render={row => [
                row.label ?? R.notSet,
                fmt(row.trials),
                fmt(row.completed),
                pctLabel(row.showRate),
              ]}
            />
          )}
        </Panel>
        <Panel title={R.trialToRegistered}>
          <div className="staff-tile-value">{pctLabel(report.trialToRegistered.rate)}</div>
          <p className="staff-panel-note staff-muted">
            {fmt(report.trialToRegistered.converted)} / {fmt(report.trialToRegistered.total)}
          </p>
        </Panel>
        {report.byBranch ? (
          <Panel title={R.byBranch}>
            <Table
              caption={R.byBranch}
              columns={[
                { label: "" },
                { label: R.placements, num: true },
                { label: R.trials, num: true },
              ]}
              rows={report.byBranch}
              rowKey={row => row.label ?? "none"}
              rowTitle={row => row.label ?? R.notSet}
              render={row => [row.label ?? R.notSet, fmt(row.placements), fmt(row.trials)]}
            />
          </Panel>
        ) : null}
      </div>
      <ReportNotice truncated={truncated} total={placements.total + trials.total} footnote={footnote} />
    </>
  );
}

function EnrolmentsBody({
  branchId,
  period,
  window,
  previous,
  registerExport,
}: {
  branchId: string | null;
  period: Period;
  window: ReportWindow;
  previous: ReportWindow;
  registerExport: RegisterExport;
}) {
  const enrolments = useEnrolmentsByStatus(branchId);
  const report = useMemo(
    () => enrolmentsReport(enrolments.items, window, previous),
    [enrolments.items, window, previous]
  );

  useEffect(() => {
    if (enrolments.isLoading || enrolments.error || enrolments.items.length === 0) {
      registerExport(null);
      return;
    }
    registerExport(() =>
      exportCsv(
        "report-enrolments",
        [
          { key: "student", label: R.csv.student },
          { key: "course", label: R.csv.course },
          { key: "className", label: R.csv.className },
          { key: "branch", label: R.csv.branch },
          { key: "status", label: R.csv.status },
          { key: "enrolled", label: R.csv.enrolled },
          { key: "cancelled", label: R.csv.cancelled },
          { key: "toBePaid", label: R.csv.toBePaid },
          { key: "paid", label: R.csv.paid },
          { key: "remaining", label: R.csv.remaining },
        ],
        enrolments.items.map(item => ({
          student: item.studentName,
          course: item.courseName,
          className: item.className,
          branch: item.branchName,
          status: copy.status[item.status] ?? item.status,
          enrolled: dateOnly(item.enrolledAt),
          cancelled: dateOnly(item.cancelledAt),
          toBePaid: item.toBePaid,
          paid: item.paid,
          remaining: item.remaining,
        }))
      )
    );
    return () => registerExport(null);
  }, [enrolments.isLoading, enrolments.error, enrolments.items, registerExport]);

  if (enrolments.error)
    return <ErrorState error={enrolments.error} onRetry={() => void enrolments.mutate()} />;
  if (enrolments.isLoading) return <LoadingRows rows={8} />;
  if (enrolments.items.length === 0)
    return (
      <>
        <ReportEmpty text={R.emptyEnrolments} />
        <ReportNotice truncated={enrolments.truncated} total={enrolments.total} footnote={R.footnoteEnrolments} />
      </>
    );

  const groupCols = [
    { label: "" },
    { label: R.active, num: true },
    { label: R.pending, num: true },
    { label: R.completed, num: true },
    { label: R.leftCancelled, num: true },
    { label: R.billed, num: true },
    { label: R.collected, num: true },
    { label: R.outstanding, num: true },
  ];
  const groupCells = (row: EnrolmentGroupRow) => [
    row.label,
    fmt(row.active),
    fmt(row.pending),
    fmt(row.completed),
    fmt(row.leftCancelled),
    fmt(row.billed),
    fmt(row.collected),
    fmt(row.outstanding),
  ];

  return (
    <>
      <div className="staff-report-group">
        <h3 className="staff-report-group-title">{R.rightNow}</h3>
        <div className="staff-tiles staff-tiles-insight">
          <Tile
            label={copy.status.pending_payment}
            value={fmt(report.pipeline.pendingPayment)}
          />
          <Tile
            label={copy.status.pending_class}
            value={fmt(report.pipeline.pendingClass)}
          />
          <Tile
            label={copy.status.pending_group}
            value={fmt(report.pipeline.pendingGroup)}
          />
          <Tile
            label={copy.status.enrolled}
            value={fmt(report.pipeline.enrolled)}
          />
        </div>
      </div>
      <div className="staff-report-group">
        <h3 className="staff-report-group-title">
          {R.inThisPeriod} · {copy.dashboard.periods[period]}
        </h3>
        <div className="staff-tiles staff-tiles-insight">
          <Tile
            label={R.enrolledInPeriod}
            value={fmt(report.enrolledInPeriod)}
            note={
              <Change value={delta(report.enrolledInPeriod, report.enrolledPrevious)} />
            }
          />
          <Tile
            label={R.cancelledInPeriod}
            value={fmt(report.cancelledInPeriod)}
            note={
              <Change value={delta(report.cancelledInPeriod, report.cancelledPrevious)} />
            }
          />
        </div>
      </div>

      <div className="staff-report-grid">
        <Panel title={R.money} action={<span className="staff-panel-note staff-muted">{R.moneyNote}</span>}>
          <dl className="staff-report-facts">
            <div>
              <dt>{R.billed}</dt>
              <dd>{fmt(report.money.billed)}</dd>
            </div>
            <div>
              <dt>{R.collected}</dt>
              <dd>{fmt(report.money.collected)}</dd>
            </div>
            <div>
              <dt>{R.outstanding}</dt>
              <dd>{fmt(report.money.outstanding)}</dd>
            </div>
            <div>
              <dt>{R.outstandingPending}</dt>
              <dd>{fmt(report.money.outstandingPending)}</dd>
            </div>
          </dl>
          {report.money.billed > 0 ? (
            <SplitBar
              label={R.collectionRate}
              segments={[
                { label: R.collected, value: report.money.collected, tone: "positive" },
                {
                  label: R.outstanding,
                  value: Math.max(0, report.money.billed - report.money.collected),
                  tone: "caution",
                },
              ]}
            />
          ) : null}
        </Panel>
        <Panel title={R.allTime}>
          <dl className="staff-report-facts">
            <div>
              <dt>{copy.status.completed}</dt>
              <dd>{fmt(report.allTime.completed)}</dd>
            </div>
            <div>
              <dt>{copy.status.left}</dt>
              <dd>{fmt(report.allTime.left)}</dd>
            </div>
            <div>
              <dt>{copy.status.cancelled}</dt>
              <dd>{fmt(report.allTime.cancelled)}</dd>
            </div>
          </dl>
          {report.byKind.individual + report.byKind.group > 0 ? (
            <SplitBar
              label={R.byKind}
              segments={[
                { label: R.kinds.individual, value: report.byKind.individual, tone: "ink" },
                { label: R.kinds.group, value: report.byKind.group, tone: "gold" },
              ]}
            />
          ) : null}
        </Panel>
      </div>

      <div className="staff-report-grid">
        <Panel title={R.byCourse} wide>
          <Table
            caption={R.byCourse}
            columns={groupCols}
            rows={report.byCourse}
            rowKey={row => row.label}
            rowTitle={row => row.label}
            render={groupCells}
          />
        </Panel>
        {report.byBranch ? (
          <Panel title={R.byBranch} wide>
            <Table
              caption={R.byBranch}
              columns={groupCols}
              rows={report.byBranch}
              rowKey={row => row.label}
              rowTitle={row => row.label}
              render={groupCells}
            />
          </Panel>
        ) : null}
      </div>
      <ReportNotice truncated={enrolments.truncated} total={enrolments.total} footnote={R.footnoteEnrolments} />
    </>
  );
}

function ClassesBody({
  branchId,
  registerExport,
}: {
  branchId: string | null;
  registerExport: RegisterExport;
}) {
  const classes = useAllPages<NccClassDto>(
    "/api/ncc/delivery/classes",
    { status: "active", ...(branchId ? { branchId } : {}) }
  );
  const report = useMemo(() => classesReport(classes.items), [classes.items]);

  useEffect(() => {
    if (classes.isLoading || classes.error || report.kpis.activeClasses === 0) {
      registerExport(null);
      return;
    }
    registerExport(() =>
      exportCsv(
        "report-classes",
        [
          { key: "name", label: R.csv.name },
          { key: "course", label: R.csv.course },
          { key: "department", label: R.csv.department },
          { key: "branch", label: R.csv.branch },
          { key: "teachers", label: R.csv.teachers },
          { key: "schedule", label: R.csv.schedule },
          { key: "capacity", label: R.csv.capacity },
          { key: "taken", label: R.csv.taken },
          { key: "fill", label: R.csv.fill },
          { key: "start", label: R.csv.start },
          { key: "end", label: R.csv.end },
        ],
        classes.items.map(item => {
          const days = (item.schedule.daysOfWeek ?? [])
            .map(weekdayLabel)
            .join(" ");
          const time =
            item.schedule.startTime && item.schedule.endTime
              ? `${item.schedule.startTime}–${item.schedule.endTime}`
              : (item.schedule.startTime ?? "");
          return {
            name: item.name,
            course: item.courseName,
            department: item.departmentName,
            branch: item.branchName,
            teachers: item.teachers
              .map(teacher => teacher.name || teacher.email)
              .join("; "),
            schedule: [days, time].filter(Boolean).join(" ") || null,
            capacity: item.capacity,
            taken: item.activeEnrolmentCount,
            fill: `${fillPercent(item.activeEnrolmentCount, item.capacity)}%`,
            start: dateOnly(item.startAt),
            end: dateOnly(item.endAt),
          };
        })
      )
    );
    return () => registerExport(null);
  }, [classes.isLoading, classes.error, classes.items, report, registerExport]);

  if (classes.error)
    return <ErrorState error={classes.error} onRetry={() => void classes.mutate()} />;
  if (classes.isLoading) return <LoadingRows rows={8} />;
  if (report.kpis.activeClasses === 0)
    return (
      <>
        <ReportEmpty text={R.emptyClasses} />
        <ReportNotice truncated={classes.truncated} total={classes.total} footnote={R.footnoteClasses} />
      </>
    );

  const fillCols = [
    { label: "" },
    { label: R.classes, num: true },
    { label: R.seats, num: true },
  ];
  const fillCells = (row: { label: string; classes: number; taken: number; capacity: number }) => [
    row.label,
    fmt(row.classes),
    <SeatsMeter
      key="s"
      item={{ activeEnrolmentCount: row.taken, capacity: row.capacity }}
    />,
  ];

  return (
    <>
      <div className="staff-tiles staff-tiles-insight">
        <Tile label={R.activeClasses} value={fmt(report.kpis.activeClasses)} />
        <Tile
          label={R.fill}
          value={`${report.kpis.fill}%`}
          meter={report.kpis.fill}
          note={
            <span>
              {fmt(report.kpis.seatsTaken)} / {fmt(report.kpis.capacity)} {R.seats.toLowerCase()}
            </span>
          }
        />
        <Tile label={R.seatsTaken} value={fmt(report.kpis.seatsTaken)} />
        <Tile label={R.freeSeats} value={fmt(report.kpis.freeSeats)} />
      </div>

      <div className="staff-report-grid">
        <Panel title={R.fillByCourse}>
          <Table
            caption={R.fillByCourse}
            columns={fillCols}
            rows={report.byCourse}
            rowKey={row => row.courseId || row.label}
            rowTitle={row => row.label}
            render={row => [
              row.courseId ? (
                <Link
                  key="c"
                  href={`/app/courses/${row.courseId}`}
                  className="staff-link-quiet"
                >
                  {row.label}
                </Link>
              ) : (
                row.label
              ),
              fmt(row.classes),
              <SeatsMeter
                key="s"
                item={{ activeEnrolmentCount: row.taken, capacity: row.capacity }}
              />,
            ]}
          />
        </Panel>
        <Panel title={R.fillByDepartment}>
          <Table
            caption={R.fillByDepartment}
            columns={fillCols}
            rows={report.byDepartment}
            rowKey={row => row.label}
            rowTitle={row => row.label}
            render={fillCells}
          />
        </Panel>
        <Panel title={R.teacherLoad}>
          <Table
            caption={R.teacherLoad}
            columns={[
              { label: "" },
              { label: R.classes, num: true },
              { label: R.students, num: true },
            ]}
            rows={report.teacherLoad}
            rowKey={row => row.name ?? "none"}
            rowTitle={row => row.name ?? R.noTeacher}
            render={row => [row.name ?? R.noTeacher, fmt(row.classes), fmt(row.students)]}
          />
        </Panel>
        <Panel title={R.endingSoon}>
          {report.endingSoon.length === 0 ? (
            <PanelEmpty text={R.endingSoonEmpty} />
          ) : (
            <Table
              caption={R.endingSoon}
              columns={[
                { label: "" },
                { label: R.endDate, num: true },
                { label: R.daysLeft, num: true },
              ]}
              rows={report.endingSoon}
              rowKey={row => row.id}
              rowTitle={row => row.name}
              render={row => [
                <Link key="c" href={`/app/classes/${row.id}`} className="staff-link-quiet">
                  {row.name}
                </Link>,
                dayLabel(row.endAt.slice(0, 10)),
                fmt(row.daysLeft),
              ]}
            />
          )}
        </Panel>
        <Panel title={R.weekdayLoad}>
          {report.weekdayLoad.every(count => count === 0) ? (
            <PanelEmpty text={R.emptyWeekdays} />
          ) : (
            <Columns
              label={R.weekdayLoad}
              points={report.weekdayLoad.map((count, index) => ({
                label: weekdayLabel(index),
                value: count,
              }))}
            />
          )}
        </Panel>
        {report.byBranch ? (
          <Panel title={R.byBranch}>
            <Table
              caption={R.byBranch}
              columns={fillCols}
              rows={report.byBranch}
              rowKey={row => row.label}
              rowTitle={row => row.label}
              render={fillCells}
            />
          </Panel>
        ) : null}
      </div>
      <ReportNotice truncated={classes.truncated} total={classes.total} footnote={R.footnoteClasses} />
    </>
  );
}

/* ---------------- Page ----------------------------------------------------- */

export default function ReportsPage() {
  const { session } = useStaffSession();
  const role = session?.ncc?.activeRole ?? null;
  const branches = useBranches();
  const search = useSearch();
  const [, navigate] = useLocation();
  const params = new URLSearchParams(search);
  const visible = visibleReports(role);
  const requested = params.get("report") as ReportId | null;
  const report = visible.includes(requested as ReportId)
    ? (requested as ReportId)
    : visible[0];
  const periodParam = params.get("period");
  const period: Period = (REPORT_PERIODS as string[]).includes(periodParam ?? "")
    ? (periodParam as Period)
    : "30d";
  const branchFilter = role === "super_admin" ? params.get("branch") : null;
  const { current, previous } = useMemo(() => reportWindows(period), [period]);
  const showBranch =
    role === "super_admin" && branches.active.length > 1;

  if (!report) {
    return (
      <EmptyState
        title={copy.shell.noAccess}
        description={copy.shell.noAccessHint}
      />
    );
  }

  const setParam = (key: string, value: string, fallback: string) => {
    const next = new URLSearchParams(search);
    if (value === fallback) next.delete(key);
    else next.set(key, value);
    navigate(`?${next.toString()}`, { replace: true });
  };

  const [exporter, setExporter] = useState<(() => void) | null>(null);
  const registerExport = useCallback(
    (fn: (() => void) | null) => setExporter(() => fn),
    []
  );

  const widen = () => setParam("period", "all", "30d");

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <PageHeader
        title={R.title}
        description={R.description}
        actions={
          <button
            type="button"
            className="staff-btn"
            disabled={!exporter}
            onClick={() => exporter?.()}
          >
            <Download strokeWidth={1.75} aria-hidden />
            {R.exportCsv}
          </button>
        }
      />
      <div className="staff-dash-controls">
        <div className="staff-segments staff-report-tabs" role="group" aria-label={R.report}>
          {visible.map(item => (
            <button
              key={item}
              type="button"
              className="staff-segment"
              data-active={report === item}
              aria-pressed={report === item}
              onClick={() => setParam("report", item, "")}
            >
              {report === item ? <ActiveMark group="report-tab" /> : null}
              {R.tabs[item]}
            </button>
          ))}
        </div>
        <div className="staff-report-controls">
          {showBranch ? (
            <Select
              value={branchFilter || ALL}
              onValueChange={value => setParam("branch", value === ALL ? "" : value, "")}
            >
              <SelectTrigger size="sm" aria-label={R.branch} className="staff-report-branch">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{R.allBranches}</SelectItem>
                {branches.active.map(branch => (
                  <SelectItem key={branch.id} value={branch.id}>
                    {branch.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
          {report === "classes" ? (
            <span className="staff-report-asof staff-muted">{R.asOfToday}</span>
          ) : (
            <PeriodSwitch
              value={period}
              onChange={value => setParam("period", value, "30d")}
              options={REPORT_PERIODS}
              label={R.period}
            />
          )}
        </div>
      </div>

      {report === "admissions" ? (
        <AdmissionsBody
          branchId={branchFilter}
          window={current}
          previous={previous}
          widen={widen}
          registerExport={registerExport}
        />
      ) : null}
      {report === "bookings" ? (
        <BookingsBody
          branchId={branchFilter}
          window={current}
          previous={previous}
          widen={widen}
          registerExport={registerExport}
        />
      ) : null}
      {report === "enrolments" ? (
        <EnrolmentsBody
          branchId={branchFilter}
          period={period}
          window={current}
          previous={previous}
          registerExport={registerExport}
        />
      ) : null}
      {report === "classes" ? (
        <ClassesBody branchId={branchFilter} registerExport={registerExport} />
      ) : null}
    </div>
  );
}
