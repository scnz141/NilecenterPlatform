import { Spinner } from "@/staff/ui/kit";
import type { NccSystemHealthDto } from "@/lib/backend/api";
import { useNcc } from "../api";
import { copy } from "../copy";
import { useStaffSession } from "../session";
import {
  EmptyState,
  ErrorState,
  LoadingRows,
  StatusBadge,
} from "../ui/primitives";
import { formatDate } from "./catalog-shared";

const C = copy.system;

function yesNo(value: boolean | null) {
  if (value === null) return copy.moodleSite.unknown;
  return value ? copy.moodleSite.yes : copy.moodleSite.no;
}

export default function SystemHealthPage() {
  const { session } = useStaffSession();
  const isSuperAdmin = session?.ncc?.activeRole === "super_admin";
  const health = useNcc<{ health: NccSystemHealthDto }>(
    isSuperAdmin ? "/api/ncc/system/health" : null
  );

  if (!isSuperAdmin) {
    return (
      <EmptyState title={copy.shell.noAccess} description={C.noAccess} />
    );
  }
  if (health.error) {
    return (
      <ErrorState
        error={health.error}
        onRetry={() => void health.mutate()}
      />
    );
  }
  if (health.isLoading || !health.data) {
    return <LoadingRows />;
  }

  const data = health.data.health;
  const moodle = data.components.moodle;
  const rows: { label: string; status: string; detail: string | null }[] = [
    {
      label: C.componentApi,
      status: data.components.api.status,
      detail: data.components.api.detail,
    },
    {
      label: C.componentDatabase,
      status: data.components.database.status,
      detail: data.components.database.detail,
    },
    {
      label: C.componentSchema,
      status: data.components.schemaCheck.status,
      detail:
        data.components.schemaCheck.missingTables?.length
          ? `${data.components.schemaCheck.detail ?? ""} Missing: ${data.components.schemaCheck.missingTables.join(", ")}`
          : data.components.schemaCheck.detail,
    },
    {
      label: C.componentMigration,
      status: data.components.migration.status,
      detail: [
        data.components.migration.version
          ? `${C.version} ${data.components.migration.version}`
          : null,
        data.components.migration.detail,
      ]
        .filter(Boolean)
        .join(" · ") || null,
    },
    {
      label: C.componentMoodle,
      status: moodle.status,
      detail: [
        moodle.siteName,
        moodle.release,
        `${C.configured} ${yesNo(moodle.configured)}`,
        `${C.reachable} ${yesNo(moodle.reachable)}`,
        `${C.expected} ${yesNo(moodle.versionExpected)}`,
        moodle.detail,
      ]
        .filter(Boolean)
        .join(" · "),
    },
  ];

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="staff-page-header">{C.title}</h1>
        <p className="staff-muted max-w-prose">{C.description}</p>
      </header>

      <section className="staff-card" role="status">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <StatusBadge status={data.status} />
            <span className="staff-muted">
              {C.checked} {formatDate(data.checkedAt)}
            </span>
          </div>
          <button
            type="button"
            className="staff-btn"
            data-size="sm"
            onClick={() => void health.mutate()}
            disabled={health.isLoading}
          >
            {health.isLoading ? <Spinner aria-hidden /> : null}
            {C.refresh}
          </button>
        </div>
      </section>

      <section className="staff-card">
        <div className="flex flex-col divide-y divide-[var(--staff-border)]">
          {rows.map(row => (
            <div
              key={row.label}
              className="flex items-start justify-between gap-4 py-3"
            >
              <div className="min-w-0">
                <strong className="text-sm">{row.label}</strong>
                {row.detail ? (
                  <p className="staff-muted break-words">{row.detail}</p>
                ) : null}
              </div>
              <StatusBadge status={row.status} />
            </div>
          ))}
        </div>
        {moodle.warnings?.length ? (
          <p className="staff-muted mt-3" role="status">
            {C.warnings}: {moodle.warnings.join(" ")}
          </p>
        ) : null}
      </section>
    </div>
  );
}
