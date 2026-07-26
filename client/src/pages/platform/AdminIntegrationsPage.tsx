import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { ChevronRight, RefreshCcw } from "lucide-react";
import PlatformShell from "@/components/platform/PlatformShell";
import { SettingsLayout } from "@/components/platform/PlatformLayouts";
import {
  DataTableCard,
  StatusBadge,
} from "@/components/platform/PlatformPrimitives";
import {
  fetchIntegrationHealthRequest,
  type IntegrationHealthDto,
} from "@/lib/backend/api";
import "@/styles/integration-health.css";

type Provider = IntegrationHealthDto["providers"][number];
type ConnectionFilter = "all" | "verified" | "attention" | "deferred";

const connectionFilters: Array<{
  id: ConnectionFilter;
  label: string;
}> = [
  { id: "all", label: "All" },
  { id: "verified", label: "Live verified" },
  { id: "attention", label: "Needs attention" },
  { id: "deferred", label: "Deferred" },
];

function matchesConnectionFilter(
  state: Provider["state"],
  filter: ConnectionFilter
) {
  if (filter === "all") return true;
  if (filter === "verified") return state === "verified";
  if (filter === "deferred") return state === "deferred";
  return (
    state === "configured" ||
    state === "unavailable" ||
    state === "disabled" ||
    state === "incomplete"
  );
}

function stateLabel(state: Provider["state"]) {
  if (state === "verified") return "Live verified";
  if (state === "configured") return "Configured";
  if (state === "unavailable") return "Unavailable";
  if (state === "incomplete") return "Needs setup";
  if (state === "deferred") return "Deferred";
  return "Disabled";
}

function stateTone(
  state: Provider["state"]
): "green" | "amber" | "red" | "slate" {
  if (state === "verified") return "green";
  if (state === "configured" || state === "incomplete") return "amber";
  if (state === "unavailable") return "red";
  return "slate";
}

function checkLabel(status: Provider["checks"][number]["status"]) {
  if (status === "passed") return "Passed";
  if (status === "failed") return "Failed";
  if (status === "not_applicable") return "Not applicable";
  return "Not run";
}

export default function AdminIntegrationsPage() {
  const [health, setHealth] = useState<IntegrationHealthDto | null>(null);
  const [selectedIntegrationId, setSelectedIntegrationId] = useState("moodle");
  const [filter, setFilter] = useState<ConnectionFilter>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadHealth = () => {
    setLoading(true);
    setError("");
    void fetchIntegrationHealthRequest().then(result => {
      if (!result.ok || !result.data) {
        setHealth(null);
        setError(result.error ?? "Connection health is unavailable.");
      } else {
        setHealth(result.data);
      }
      setLoading(false);
    });
  };

  useEffect(loadHealth, []);

  const integrations = health?.providers ?? [];
  const visibleIntegrations = useMemo(
    () =>
      integrations.filter(integration =>
        matchesConnectionFilter(integration.state, filter)
      ),
    [filter, integrations]
  );
  const selectedIntegration =
    visibleIntegrations.find(
      integration => integration.id === selectedIntegrationId
    ) ?? visibleIntegrations[0];

  return (
    <PlatformShell role="superadmin" title="Connections">
      <SettingsLayout
        className="admin-integrations-page"
        title="Connections"
        description="Separate configured services from providers that have passed a live server check."
        context="Admin"
        actions={
          <button
            type="button"
            className="platform-primary-button"
            onClick={loadHealth}
            disabled={loading}
            data-testid="admin-connections-refresh"
          >
            <RefreshCcw size={15} />
            {loading ? "Checking" : "Refresh status"}
          </button>
        }
        toolbar={
          <div
            className="admin-system-filter-bar"
            data-testid="admin-connections-toolbar"
          >
            <span>Show</span>
            <div role="group" aria-label="Filter connections">
              {connectionFilters.map(item => (
                <button
                  key={item.id}
                  type="button"
                  className={filter === item.id ? "active" : ""}
                  aria-pressed={filter === item.id}
                  data-testid={`admin-connections-filter-${item.id}`}
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
            title="Connections"
            subtitle={`${visibleIntegrations.length} of ${integrations.length} services`}
            className="admin-connections-list-card"
          >
            {loading ? (
              <div role="status" className="platform-empty-state">
                <RefreshCcw size={18} aria-hidden="true" />
                <strong>Checking server configuration</strong>
              </div>
            ) : error ? (
              <div role="alert" className="platform-empty-state">
                <strong>Connection status unavailable</strong>
                <span>{error}</span>
                <button
                  type="button"
                  className="platform-secondary-button"
                  onClick={loadHealth}
                >
                  Retry
                </button>
              </div>
            ) : (
              <div
                className="admin-connection-list"
                data-testid="admin-connections-list"
                data-authority={health?.authority}
              >
                {visibleIntegrations.map(integration => (
                  <button
                    key={integration.id}
                    type="button"
                    className={
                      integration.id === selectedIntegration?.id ? "active" : ""
                    }
                    aria-pressed={integration.id === selectedIntegration?.id}
                    data-testid={`admin-connection-${integration.id}`}
                    onClick={() => setSelectedIntegrationId(integration.id)}
                  >
                    <div>
                      <strong>{integration.label}</strong>
                      <small>{integration.summary}</small>
                    </div>
                    <StatusBadge tone={stateTone(integration.state)}>
                      {stateLabel(integration.state)}
                    </StatusBadge>
                    <ChevronRight size={16} aria-hidden="true" />
                  </button>
                ))}
                {!visibleIntegrations.length ? (
                  <div className="platform-empty-state">
                    <strong>No connections in this view</strong>
                    <span>Choose another filter to review other services.</span>
                  </div>
                ) : null}
              </div>
            )}
          </DataTableCard>
        }
        side={
          selectedIntegration ? (
            <section
              className="admin-connection-inspector"
              data-testid="admin-connection-detail"
            >
              <div className="admin-connection-inspector-heading">
                <span>Selected connection</span>
                <h2>{selectedIntegration.label}</h2>
                <StatusBadge tone={stateTone(selectedIntegration.state)}>
                  {stateLabel(selectedIntegration.state)}
                </StatusBadge>
              </div>
              <p>{selectedIntegration.summary}</p>
              <div className="admin-connection-inspector-boundary">
                <span>Server checks</span>
                {selectedIntegration.checks.map(check => (
                  <div key={check.label}>
                    <strong>{check.label}</strong>
                    <small data-status={check.status}>
                      {checkLabel(check.status)}
                    </small>
                  </div>
                ))}
              </div>
              <small className="admin-connection-meta">
                {selectedIntegration.verification.status === "verified"
                  ? "Live verification passed "
                  : selectedIntegration.verification.status === "failed"
                    ? "Live verification failed "
                    : "Configuration reviewed "}
                {selectedIntegration.verification.checkedAt
                  ? new Date(
                      selectedIntegration.verification.checkedAt
                    ).toLocaleString()
                  : health?.checkedAt
                  ? new Date(health.checkedAt).toLocaleString()
                  : "by the server"}
                . Secrets and raw provider errors are never returned.
              </small>
              {selectedIntegration.id === "moodle" ? (
                <Link
                  href="/app/admin/integrations/moodle-commands"
                  className="platform-secondary-button"
                  data-testid="admin-moodle-command-queue-link"
                >
                  Review command queue
                </Link>
              ) : null}
            </section>
          ) : (
            <div className="platform-empty-state">
              <strong>No connection selected</strong>
              <span>Choose a service to review its readiness.</span>
            </div>
          )
        }
      />
    </PlatformShell>
  );
}
