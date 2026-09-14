import {
  getStoredAuthSession,
  requireActiveUser,
} from "@/lib/auth/session";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Download, Search } from "lucide-react";
import { toast } from "sonner";
import PlatformShell from "@/components/platform/PlatformShell";
import NccReadStatus from "@/components/platform/NccReadStatus";
import { ReportLayout } from "@/components/platform/PlatformLayouts";
import {
  DataTableCard,
  StatusBadge,
} from "@/components/platform/PlatformPrimitives";
import { platformStore } from "@/lib/domain/store";
import {
  fetchNccAuditEventsRequest,
  runPlatformWorkflowActionRequest,
  type NccAuditEventDto,
} from "@/lib/backend/api";
import {
  classifyNccFailure,
  type NccReadState,
} from "@/lib/backend/nccReadState";
import type { AuditLog } from "@/lib/domain/types";

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No date";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function actionGroup(action: string) {
  return action.split(".")[0] || "activity";
}

function humanize(value: string) {
  return value
    .replace(/[_-]/g, " ")
    .replace(/\./g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, character => character.toUpperCase());
}

function actionTone(
  action: string
): "green" | "amber" | "red" | "purple" | "slate" {
  if (action.includes("created") || action.includes("saved")) return "green";
  if (action.includes("updated") || action.includes("changed")) return "amber";
  if (action.includes("rejected") || action.includes("revoked")) return "red";
  if (action.includes("exported") || action.includes("checked"))
    return "purple";
  return "slate";
}

function matchesAudit(audit: AuditLog, query: string, group: string) {
  const normalizedQuery = query.trim().toLowerCase();
  const text = [
    audit.actorId,
    audit.action,
    audit.entityType,
    audit.entityId,
    audit.summary,
  ]
    .join(" ")
    .toLowerCase();
  return (
    (!normalizedQuery || text.includes(normalizedQuery)) &&
    (group === "All" || actionGroup(audit.action) === group)
  );
}

export default function AdminAuditLogsPage() {
  return getStoredAuthSession()?.provider === "ncc" ? (
    <NccAdminAuditLogsPage />
  ) : (
    <CompatibilityAdminAuditLogsPage />
  );
}

function NccAdminAuditLogsPage() {
  const [readState, setReadState] = useState<
    NccReadState<NccAuditEventDto[]>
  >({ status: "loading" });
  const [query, setQuery] = useState("");
  const [stream, setStream] = useState("All");

  const load = useCallback(async () => {
    setReadState({ status: "loading" });
    const result = await fetchNccAuditEventsRequest({ limit: 100 });
    setReadState(
      result.ok && result.data
        ? { status: "ready", data: result.data.items }
        : classifyNccFailure(result)
    );
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const events = readState.status === "ready" ? readState.data : null;
  const streams = useMemo(
    () =>
      Array.from(new Set((events ?? []).map(event => event.stream))).sort(
        (a, b) => a.localeCompare(b)
      ),
    [events]
  );
  const normalizedQuery = query.trim().toLowerCase();
  const filtered = (events ?? []).filter(event => {
    const text = [
      event.actorDisplayName,
      event.eventType,
      event.stream,
      event.entityLabel,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return (
      (!normalizedQuery || text.includes(normalizedQuery)) &&
      (stream === "All" || event.stream === stream)
    );
  });

  return (
    <PlatformShell role="superadmin" title="Activity log">
      <ReportLayout
        className="admin-audit-page"
        title="Activity log"
        description="Search recent EMS audit events."
        context="Admin"
        toolbar={
          <div
            className="admin-compact-toolbar admin-audit-toolbar"
            data-testid="admin-activity-toolbar"
          >
            <label>
              Search
              <span>
                <Search size={15} />
                <input
                  value={query}
                  onInput={event => setQuery(event.currentTarget.value)}
                  onChange={event => setQuery(event.currentTarget.value)}
                  placeholder="Search activity"
                />
              </span>
            </label>
            <label>
              Stream
              <select
                value={stream}
                onChange={event => setStream(event.target.value)}
              >
                <option value="All">All streams</option>
                {streams.map(item => (
                  <option key={item} value={item}>
                    {humanize(item)}
                  </option>
                ))}
              </select>
            </label>
          </div>
        }
        main={
          !events ? (
            <NccReadStatus state={readState} onRetry={() => void load()} />
          ) : (
            <DataTableCard
              title="Recent activity"
              subtitle={`${filtered.length} matching events · latest 100`}
            >
              {filtered.length ? (
                <div
                  className="admin-record-list admin-audit-record-list"
                  data-testid="admin-activity-list"
                >
                  {filtered.map(event => (
                    <article key={event.id}>
                      <div className="admin-record-list-copy">
                        <span>{humanize(event.stream)}</span>
                        <strong>{humanize(event.eventType)}</strong>
                        <p>{event.entityLabel ?? "System activity"}</p>
                      </div>
                      <dl className="admin-record-list-facts">
                        <div>
                          <dt>By</dt>
                          <dd>{event.actorDisplayName ?? "System"}</dd>
                        </div>
                        <div>
                          <dt>When</dt>
                          <dd>{formatDateTime(event.createdAt)}</dd>
                        </div>
                      </dl>
                      <div className="admin-record-list-meta">
                        <StatusBadge tone={actionTone(event.eventType)}>
                          {humanize(
                            event.eventType.split(".").at(-1) ??
                              event.eventType
                          )}
                        </StatusBadge>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="platform-empty-state">
                  <Search size={18} />
                  <strong>No activity matches</strong>
                  <small>Clear the query or choose another stream.</small>
                </div>
              )}
            </DataTableCard>
          )
        }
      />
    </PlatformShell>
  );
}

function CompatibilityAdminAuditLogsPage() {
  const [version, setVersion] = useState(0);
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState("All");
  const state = useMemo(() => platformStore.getState(), [version]);
  const actorId = requireActiveUser("superadmin").id;

  const groups = useMemo(
    () =>
      Array.from(
        new Set(state.auditLogs.map(audit => actionGroup(audit.action)))
      )
        .sort((a, b) => a.localeCompare(b))
        .slice(0, 12),
    [state.auditLogs]
  );
  const filteredAudits = state.auditLogs.filter(audit =>
    matchesAudit(audit, query, group)
  );

  const exportAuditCsv = async () => {
    const rows = filteredAudits.map(audit => ({
      id: audit.id,
      actorId: audit.actorId,
      action: audit.action,
      entityType: audit.entityType,
      entityId: audit.entityId,
      summary: audit.summary,
      createdAt: audit.createdAt,
    }));
    const csv = platformStore.buildCsv(rows);
    if (!csv) {
      toast.error("No activity rows to export");
      return;
    }
    const result = await runPlatformWorkflowActionRequest({
      type: "audit.export",
      rowCount: rows.length,
      format: "csv",
    });
    if (!result.ok || !result.data) {
      toast.error("Activity export could not be authorized", {
        description: result.error,
      });
      return;
    }
    platformStore.setState(result.data.state);
    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8" })
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `nile-audit-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    setVersion(value => value + 1);
    toast.success("Activity CSV prepared", {
      description: `${rows.length} row(s) exported from the local activity log.`,
    });
  };

  return (
    <PlatformShell role="superadmin" title="Activity log">
      <ReportLayout
        className="admin-audit-page"
        title="Activity log"
        description="Search, filter, and export platform audit events."
        context="Admin"
        actions={
          <button
            type="button"
            className="platform-primary-button"
            onClick={exportAuditCsv}
            disabled={!filteredAudits.length}
          >
            <Download size={15} />
            Export CSV
          </button>
        }
        toolbar={
          <div
            className="admin-compact-toolbar admin-audit-toolbar"
            data-testid="admin-activity-toolbar"
          >
            <label>
              Search
              <span>
                <Search size={15} />
                <input
                  value={query}
                  onInput={event => setQuery(event.currentTarget.value)}
                  onChange={event => setQuery(event.currentTarget.value)}
                  placeholder="Search activity"
                />
              </span>
            </label>
            <label>
              Action group
              <select
                value={group}
                onChange={event => setGroup(event.target.value)}
              >
                <option value="All">All groups</option>
                {groups.map(item => (
                  <option key={item} value={item}>
                    {humanize(item)}
                  </option>
                ))}
              </select>
            </label>
          </div>
        }
        main={
          <DataTableCard
            title="Recent activity"
            subtitle={`${filteredAudits.length} matching events`}
          >
            {filteredAudits.length ? (
              <div
                className="admin-record-list admin-audit-record-list"
                data-testid="admin-activity-list"
              >
                {filteredAudits.slice(0, 30).map(audit => (
                  <article key={audit.id}>
                    <div className="admin-record-list-copy">
                      <span>{humanize(audit.entityType)}</span>
                      <strong>{humanize(audit.action)}</strong>
                      <p>{audit.summary}</p>
                    </div>
                    <dl className="admin-record-list-facts">
                      <div>
                        <dt>By</dt>
                        <dd>
                          {state.users.find(user => user.id === audit.actorId)
                            ?.name ?? "System"}
                        </dd>
                      </div>
                      <div>
                        <dt>When</dt>
                        <dd>{formatDateTime(audit.createdAt)}</dd>
                      </div>
                    </dl>
                    <div className="admin-record-list-meta">
                      <StatusBadge tone={actionTone(audit.action)}>
                        {humanize(
                          audit.action.split(".").at(-1) ?? audit.action
                        )}
                      </StatusBadge>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="platform-empty-state">
                <Search size={18} />
                <strong>No activity matches</strong>
                <small>Clear the query or choose another action group.</small>
              </div>
            )}
          </DataTableCard>
        }
      />
    </PlatformShell>
  );
}
