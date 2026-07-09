import { useMemo, useState } from "react";
import { Download, Search, ScrollText, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import PlatformShell from "@/components/platform/PlatformShell";
import { ReportLayout } from "@/components/platform/PlatformLayouts";
import {
  DataTableCard,
  StatusBadge,
} from "@/components/platform/PlatformPrimitives";
import { platformStore } from "@/lib/domain/store";
import type { AuditLog } from "@/lib/domain/types";
import { getDemoUser } from "@/lib/platformData";

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

function actionTone(
  action: string
): "green" | "amber" | "red" | "purple" | "slate" {
  if (action.includes("created") || action.includes("saved")) return "green";
  if (action.includes("updated") || action.includes("changed")) return "amber";
  if (action.includes("rejected") || action.includes("revoked")) return "red";
  if (action.includes("exported") || action.includes("checked")) return "purple";
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
  const [version, setVersion] = useState(0);
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState("All");
  const state = useMemo(() => platformStore.getState(), [version]);
  const actorId = getDemoUser("superadmin").id;

  const groups = useMemo(
    () =>
      Array.from(new Set(state.auditLogs.map(audit => actionGroup(audit.action))))
        .sort((a, b) => a.localeCompare(b))
        .slice(0, 12),
    [state.auditLogs]
  );
  const filteredAudits = state.auditLogs.filter(audit =>
    matchesAudit(audit, query, group)
  );
  const latestAudit = state.auditLogs[0];
  const actorCount = new Set(state.auditLogs.map(audit => audit.actorId)).size;
  const entityCount = new Set(
    state.auditLogs.map(audit => `${audit.entityType}:${audit.entityId}`)
  ).size;

  const exportAuditCsv = () => {
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
    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8" })
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `nile-audit-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    platformStore.audit(
      "audit.exported",
      "AuditLog",
      "filtered",
      `Exported ${rows.length} audit row(s).`,
      actorId
    );
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
          <div className="admin-system-filters">
            <label>
              Search activity
              <input
                value={query}
                onInput={event => setQuery(event.currentTarget.value)}
                onChange={event => setQuery(event.currentTarget.value)}
                placeholder="Actor, action, entity, summary"
              />
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
                    {item}
                  </option>
                ))}
              </select>
            </label>
          </div>
        }
        main={
          <DataTableCard
            title="Audit events"
            subtitle={`${filteredAudits.length} matching row(s)`}
          >
            {filteredAudits.length ? (
              <table>
                <thead>
                  <tr>
                    <th>Action</th>
                    <th>Summary</th>
                    <th>Entity</th>
                    <th>Actor</th>
                    <th>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAudits.slice(0, 30).map(audit => (
                    <tr key={audit.id}>
                      <td>
                        <StatusBadge tone={actionTone(audit.action)}>
                          {audit.action}
                        </StatusBadge>
                      </td>
                      <td>
                        <strong>{audit.summary}</strong>
                      </td>
                      <td>
                        {audit.entityType}
                        <br />
                        <small>{audit.entityId}</small>
                      </td>
                      <td>{audit.actorId}</td>
                      <td>{formatDateTime(audit.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="platform-empty-state">
                <Search size={18} />
                <strong>No activity matches</strong>
                <small>Clear the query or choose another action group.</small>
              </div>
            )}
          </DataTableCard>
        }
        side={
          <div className="portal-simple-stack">
            <section className="portal-simple-side-card">
              <span>
                <ScrollText size={15} />
                Audit scope
              </span>
              <strong>{state.auditLogs.length} total events</strong>
              <p>
                Internal workflow actions, user lifecycle changes, settings,
                exports, and system checks are recorded here.
              </p>
              <div className="portal-simple-mini-list">
                <span>Actors</span>
                <strong>{actorCount}</strong>
                <span>Entities</span>
                <strong>{entityCount}</strong>
              </div>
            </section>

            <section className="portal-simple-side-card">
              <span>
                <ShieldCheck size={15} />
                Latest event
              </span>
              {latestAudit ? (
                <>
                  <strong>{latestAudit.action}</strong>
                  <p>{latestAudit.summary}</p>
                  <small>{formatDateTime(latestAudit.createdAt)}</small>
                </>
              ) : (
                <p>No audit events recorded yet.</p>
              )}
            </section>
          </div>
        }
      />
    </PlatformShell>
  );
}
