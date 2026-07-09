import { useMemo, useState } from "react";
import { RefreshCcw, Server, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import PlatformShell from "@/components/platform/PlatformShell";
import { SettingsLayout } from "@/components/platform/PlatformLayouts";
import {
  DataTableCard,
  StatusBadge,
} from "@/components/platform/PlatformPrimitives";
import { runPlatformWorkflowActionRequest } from "@/lib/backend/api";
import { platformStore } from "@/lib/domain/store";
import type { IntegrationConfig, IntegrationStatus } from "@/lib/domain/types";

function formatConnectionStatus(status: IntegrationStatus) {
  return status === "mock_mode" ? "Test mode" : status.replace("_", " ");
}

function integrationTone(
  status: IntegrationStatus
): "green" | "amber" | "red" | "slate" {
  if (status === "connected") return "green";
  if (status === "mock_mode") return "amber";
  if (status === "error") return "red";
  return "slate";
}

export default function AdminIntegrationsPage() {
  const [version, setVersion] = useState(0);
  const [selectedIntegrationId, setSelectedIntegrationId] =
    useState<IntegrationConfig["id"]>("moodle");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [integrationCheck, setIntegrationCheck] = useState("");
  const state = useMemo(() => platformStore.getState(), [version]);
  const integrations = state.integrations;
  const selectedIntegration =
    integrations.find(
      integration => integration.id === selectedIntegrationId
    ) ?? integrations[0];
  const connectedCount = integrations.filter(
    integration => integration.status === "connected"
  ).length;
  const protectedCount = integrations.filter(
    integration => integration.serverOnly
  ).length;
  const latestIntegrationAudit = state.auditLogs.find(audit =>
    audit.action.startsWith("integration.")
  );

  const runIntegrationAction = async (
    action:
      | {
          type: "integration.status.update";
          integrationId: IntegrationConfig["id"];
          status: IntegrationStatus;
        }
      | {
          type: "integration.local_check";
          integrationId: IntegrationConfig["id"];
        },
    successMessage: string
  ) => {
    if (saving) return undefined;
    setSaving(true);
    setError("");
    const response = await runPlatformWorkflowActionRequest(action);
    setSaving(false);

    if (!response.ok || !response.data) {
      const message = response.error ?? "Connection action could not be saved.";
      setError(message);
      toast.error("Connection action failed", { description: message });
      return undefined;
    }

    platformStore.setState(response.data.state);
    setVersion(value => value + 1);
    toast.success(successMessage);
    return response.data.result.result;
  };

  const setIntegrationStatus = (
    integrationId: IntegrationConfig["id"],
    status: IntegrationStatus
  ) => {
    void runIntegrationAction(
      {
        type: "integration.status.update",
        integrationId,
        status,
      },
      "Connection status updated"
    );
  };

  const runIntegrationLocalCheck = () => {
    if (!selectedIntegration) return;
    void runIntegrationAction(
      {
        type: "integration.local_check",
        integrationId: selectedIntegration.id,
      },
      "Local integration check logged"
    ).then(result => {
      const checkedAt = (result as { checkedAt?: string } | undefined)
        ?.checkedAt;
      setIntegrationCheck(
        `Checked at ${checkedAt ? new Date(checkedAt).toLocaleString() : new Date().toLocaleString()}`
      );
    });
  };

  return (
    <PlatformShell role="superadmin" title="Connections">
      <SettingsLayout
        className="admin-integrations-page"
        title="Connections"
        description="Review provider status without storing real credentials."
        context="Admin"
        actions={
          <button
            type="button"
            className="platform-primary-button"
            onClick={runIntegrationLocalCheck}
            disabled={saving || !selectedIntegration}
          >
            <RefreshCcw size={15} />
            {saving ? "Checking" : "Run local check"}
          </button>
        }
        main={
          <DataTableCard
            title="Connector registry"
            subtitle={`${integrations.length} connection record(s)`}
          >
            <div className="admin-system-integration-grid">
              {integrations.map(integration => (
                <button
                  key={integration.id}
                  type="button"
                  className={
                    integration.id === selectedIntegration?.id ? "active" : ""
                  }
                  onClick={() => setSelectedIntegrationId(integration.id)}
                >
                  <StatusBadge tone={integrationTone(integration.status)}>
                    {formatConnectionStatus(integration.status)}
                  </StatusBadge>
                  <strong>{integration.label}</strong>
                  <small>
                    {integration.serverOnly
                      ? "Protected connector"
                      : "Browser-safe boundary"}{" "}
                    · {integration.envVars.length || "No"} setup fields
                  </small>
                </button>
              ))}
            </div>

            {selectedIntegration ? (
              <section className="admin-system-detail">
                <div>
                  <span className="platform-section-kicker">
                    Selected connector
                  </span>
                  <h3>{selectedIntegration.label}</h3>
                  <p>{selectedIntegration.notes}</p>
                </div>
                <label>
                  Status
                  <select
                    value={selectedIntegration.status}
                    disabled={saving}
                    onChange={event =>
                      setIntegrationStatus(
                        selectedIntegration.id,
                        event.target.value as IntegrationStatus
                      )
                    }
                  >
                    <option value="not_configured">Not configured</option>
                    <option value="mock_mode">Test mode</option>
                    <option value="connected">Connected</option>
                    <option value="error">Error</option>
                  </select>
                </label>
                <div className="platform-env-list">
                  {selectedIntegration.envVars.length ? (
                    selectedIntegration.envVars.map(envVar => (
                      <code key={envVar}>{envVar}</code>
                    ))
                  ) : (
                    <code>No setup fields required</code>
                  )}
                </div>
                <div className="platform-action-grid">
                  <button
                    type="button"
                    onClick={runIntegrationLocalCheck}
                    disabled={saving}
                  >
                    Run local check
                  </button>
                </div>
                {error ? (
                  <div className="platform-empty-state error">
                    <strong>Connection action was not saved</strong>
                    <span>{error}</span>
                  </div>
                ) : null}
                {integrationCheck ? <small>{integrationCheck}</small> : null}
                <small>
                  Last sync:{" "}
                  {selectedIntegration.lastSyncAt
                    ? new Date(selectedIntegration.lastSyncAt).toLocaleString()
                    : "Not run"}
                </small>
              </section>
            ) : (
              <div className="platform-empty-state">
                <strong>No connections configured</strong>
                <span>Connection records will appear here.</span>
              </div>
            )}
          </DataTableCard>
        }
        side={
          <div className="portal-simple-stack">
            <section className="portal-simple-side-card">
              <span>
                <Server size={15} />
                Connection status
              </span>
              <strong>
                {connectedCount}/{integrations.length} connected
              </strong>
              <p>
                Test mode and not-configured states are allowed during internal
                alpha. No live provider credentials are collected here.
              </p>
            </section>
            <section className="portal-simple-side-card">
              <span>
                <ShieldCheck size={15} />
                Protected providers
              </span>
              <strong>{protectedCount} server-side</strong>
              <p>
                Protected connectors must stay server-owned before production
                persistence and provider delivery are connected.
              </p>
            </section>
            <section className="portal-simple-side-card">
              <span>
                <RefreshCcw size={15} />
                Latest connection activity
              </span>
              {latestIntegrationAudit ? (
                <>
                  <strong>{latestIntegrationAudit.action}</strong>
                  <p>{latestIntegrationAudit.summary}</p>
                </>
              ) : (
                <>
                  <strong>No local checks yet</strong>
                  <p>Connection checks and status changes will be audited.</p>
                </>
              )}
            </section>
          </div>
        }
      />
    </PlatformShell>
  );
}
