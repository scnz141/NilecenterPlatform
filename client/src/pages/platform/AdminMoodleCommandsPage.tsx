import { useEffect, useMemo, useState } from "react";
import { RefreshCcw } from "lucide-react";
import PlatformShell from "@/components/platform/PlatformShell";
import { WorkspaceLayout } from "@/components/platform/PlatformLayouts";
import {
  DataTableCard,
  StatusBadge,
} from "@/components/platform/PlatformPrimitives";
import {
  fetchMoodleAdminCommandsRequest,
  type MoodleAdminCommandDto,
} from "@/lib/backend/api";

type QueueFilter = "all" | MoodleAdminCommandDto["status"];

const filters: Array<{ id: QueueFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "queued", label: "Queued" },
  { id: "processing", label: "Processing" },
  { id: "failed", label: "Failed" },
  { id: "reconciliation_required", label: "Reconciliation" },
  { id: "applied", label: "Applied" },
  { id: "cancelled", label: "Cancelled" },
];

function humanize(value: string) {
  return value
    .replace(/[._-]/g, " ")
    .replace(/\b\w/g, letter => letter.toUpperCase());
}

function statusTone(
  status: MoodleAdminCommandDto["status"]
): "green" | "amber" | "red" | "slate" {
  if (status === "applied") return "green";
  if (status === "failed") return "red";
  if (
    status === "queued" ||
    status === "processing" ||
    status === "reconciliation_required"
  ) {
    return "amber";
  }
  return "slate";
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export default function AdminMoodleCommandsPage() {
  const [commands, setCommands] = useState<MoodleAdminCommandDto[]>([]);
  const [runtimeState, setRuntimeState] = useState<
    "available" | "disabled" | "normalized_session_required" | "unknown"
  >("unknown");
  const [filter, setFilter] = useState<QueueFilter>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = () => {
    setLoading(true);
    setError("");
    void fetchMoodleAdminCommandsRequest().then(result => {
      if (!result.ok || !result.data) {
        setCommands([]);
        setRuntimeState("unknown");
        setError(result.error ?? "Moodle command evidence is unavailable.");
      } else {
        setCommands(result.data.commands);
        setRuntimeState(result.data.runtimeState);
      }
      setLoading(false);
    });
  };

  useEffect(load, []);

  const visibleCommands = useMemo(
    () =>
      filter === "all"
        ? commands
        : commands.filter(command => command.status === filter),
    [commands, filter]
  );

  return (
    <PlatformShell role="superadmin" title="Moodle commands">
      <WorkspaceLayout
        className="admin-moodle-commands-page"
        title="Moodle command queue"
        description="Review durable provider commands and reconciliation evidence."
        context="Connections"
        actions={
          <button
            type="button"
            className="platform-primary-button"
            onClick={load}
            disabled={loading}
            data-testid="admin-moodle-commands-refresh"
          >
            <RefreshCcw size={15} />
            {loading ? "Refreshing" : "Refresh queue"}
          </button>
        }
        toolbar={
          <div
            className="admin-system-filter-bar"
            data-testid="admin-moodle-command-filters"
          >
            <span>Status</span>
            <div role="group" aria-label="Filter Moodle commands">
              {filters.map(item => (
                <button
                  key={item.id}
                  type="button"
                  className={filter === item.id ? "active" : ""}
                  aria-pressed={filter === item.id}
                  onClick={() => setFilter(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        }
        main={
          <DataTableCard
            title="Command evidence"
            subtitle={`${visibleCommands.length} command(s)`}
          >
            {loading ? (
              <div className="platform-empty-state" role="status">
                <RefreshCcw size={18} aria-hidden="true" />
                <strong>Loading command evidence</strong>
              </div>
            ) : error ? (
              <div className="platform-empty-state" role="alert">
                <strong>Command queue unavailable</strong>
                <span>{error}</span>
                <button
                  type="button"
                  className="platform-secondary-button"
                  onClick={load}
                >
                  Retry
                </button>
              </div>
            ) : visibleCommands.length ? (
              <div
                className="admin-moodle-command-list"
                data-testid="admin-moodle-command-list"
              >
                {visibleCommands.map(command => (
                  <article key={command.commandId}>
                    <div>
                      <strong>{humanize(command.operation)}</strong>
                      <small>{command.commandId}</small>
                    </div>
                    <dl>
                      <div>
                        <dt>Attempts</dt>
                        <dd>{command.attemptCount}</dd>
                      </div>
                      <div>
                        <dt>Updated</dt>
                        <dd>{formatDate(command.updatedAt)}</dd>
                      </div>
                    </dl>
                    <StatusBadge tone={statusTone(command.status)}>
                      {humanize(command.status)}
                    </StatusBadge>
                  </article>
                ))}
              </div>
            ) : (
              <div className="platform-empty-state">
                <strong>No commands in this view</strong>
                <span>
                  No durable Moodle command evidence matches this status.
                </span>
              </div>
            )}
          </DataTableCard>
        }
        side={
          <section
            className="admin-moodle-command-boundary"
            data-testid="admin-moodle-command-boundary"
          >
            <span>Runtime</span>
            <h2>
              {runtimeState === "available"
                ? "Command processing active"
                : runtimeState === "normalized_session_required"
                  ? "Normalized access required"
                  : runtimeState === "disabled"
                    ? "Writes disabled"
                    : "Authority unavailable"}
            </h2>
            <p>
              Plugin installation and live Moodle writes remain deferred. Queue
              inspection never activates a provider operation.
            </p>
            <StatusBadge
              tone={runtimeState === "available" ? "green" : "slate"}
            >
              {runtimeState === "available" ? "Available" : "Fail closed"}
            </StatusBadge>
          </section>
        }
      />
    </PlatformShell>
  );
}
