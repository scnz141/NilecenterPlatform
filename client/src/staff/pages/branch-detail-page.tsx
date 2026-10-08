import { useParams } from "wouter";
import type {
  NccBranchDto,
  NccBranchStatisticsDto,
} from "@/lib/backend/api";
import { useNcc } from "../api";
import { copy } from "../copy";
import { ErrorState, LoadingRows, PageHeader } from "../ui/primitives";
import { CatalogStatus, formatDate } from "./catalog-shared";

const C = copy.catalog.branches;
const S = copy.catalog.shared;

function Stat({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="staff-stat">
      <span className="staff-stat-value">{value ?? copy.state.notSet}</span>
      <span className="staff-stat-label">{label}</span>
    </div>
  );
}

export default function BranchDetailPage() {
  const { id } = useParams<{ id: string }>();
  const branch = useNcc<{ branch: NccBranchDto }>(
    id ? `/api/ncc/directory/branches/${encodeURIComponent(id)}` : null
  );
  const statistics = useNcc<{ statistics: NccBranchStatisticsDto }>(
    id
      ? `/api/ncc/directory/branches/${encodeURIComponent(id)}/statistics`
      : null
  );

  if (branch.error) {
    return (
      <ErrorState
        error={branch.error}
        onRetry={() => void branch.mutate()}
      />
    );
  }
  if (branch.isLoading || !branch.data) {
    return <LoadingRows />;
  }

  const item = branch.data.branch;
  const stats = statistics.data?.statistics;

  return (
    <div className="flex flex-col gap-5 min-w-0">
      <PageHeader
        title={item.name}
        description={`${item.code ?? item.id} · ${item.timezone}`}
        actions={<CatalogStatus status={item.status} />}
      />
      <section className="staff-card" aria-label={S.customFields}>
        <dl className="grid gap-x-8 gap-y-2 sm:grid-cols-2">
          <div>
            <dt className="staff-muted">{S.name}</dt>
            <dd>{item.name}</dd>
          </div>
          <div>
            <dt className="staff-muted">{S.code}</dt>
            <dd>{item.code ?? copy.state.notSet}</dd>
          </div>
          <div>
            <dt className="staff-muted">{C.timezone}</dt>
            <dd>{item.timezone}</dd>
          </div>
          <div>
            <dt className="staff-muted">{C.online}</dt>
            <dd>{item.isOnline ? C.onlineYes : C.onlineNo}</dd>
          </div>
          <div>
            <dt className="staff-muted">{S.sortOrder}</dt>
            <dd>{item.sortOrder}</dd>
          </div>
          <div>
            <dt className="staff-muted">{S.created}</dt>
            <dd>{formatDate(item.createdAt)}</dd>
          </div>
          <div>
            <dt className="staff-muted">{S.status}</dt>
            <dd>
              <CatalogStatus status={item.status} />
            </dd>
          </div>
          <div>
            <dt className="staff-muted">{S.access}</dt>
            <dd>
              {item.access
                ? item.access === "manage"
                  ? S.accessManage
                  : S.accessView
                : copy.state.notSet}
            </dd>
          </div>
        </dl>
        {Object.keys(item.customFields).length > 0 ? (
          <dl className="mt-3 grid gap-x-8 gap-y-2 sm:grid-cols-2">
            {Object.entries(item.customFields).map(([key, value]) => (
              <div key={key}>
                <dt className="staff-muted">{key}</dt>
                <dd>{value === null ? copy.state.notSet : String(value)}</dd>
              </div>
            ))}
          </dl>
        ) : null}
      </section>

      <section aria-labelledby="staff-branch-stats">
        <h2
          id="staff-branch-stats"
          className="mb-3 text-base font-semibold"
        >
          {C.statisticsTitle}
        </h2>
        {statistics.error ? (
          <ErrorState
            error={statistics.error}
            onRetry={() => void statistics.mutate()}
          />
        ) : statistics.isLoading || !stats ? (
          <LoadingRows rows={2} />
        ) : (
          <div className="staff-stat-grid">
            <Stat label={C.statActiveStudents} value={stats.activeStudents} />
            <Stat label={C.statOpenLeads} value={stats.openLeads} />
            <Stat label={C.statActiveClasses} value={stats.activeClasses} />
            <Stat label={C.statEnrolmentFill} value={stats.enrolmentFill} />
            <Stat
              label={C.statEnrolmentCapacity}
              value={stats.enrolmentCapacity}
            />
            <Stat
              label={C.statPendingEnrolments}
              value={stats.pendingEnrolments}
            />
            <Stat
              label={C.statPlacements}
              value={stats.scheduledPlacements}
            />
            <Stat label={C.statTrials} value={stats.scheduledTrials} />
            <Stat label={C.statStaff} value={stats.staffCount} />
          </div>
        )}
      </section>
    </div>
  );
}
