import { useMemo, useState } from "react";
import { Activity, RefreshCcw, Server, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import PlatformShell from "@/components/platform/PlatformShell";
import { ReportLayout } from "@/components/platform/PlatformLayouts";
import {
  DataTableCard,
  StatusBadge,
} from "@/components/platform/PlatformPrimitives";
import { runPlatformWorkflowActionRequest } from "@/lib/backend/api";
import { platformStore } from "@/lib/domain/store";
import type { IntegrationStatus } from "@/lib/domain/types";

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

export default function AdminSystemHealthPage() {
  const [version, setVersion] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const state = useMemo(() => platformStore.getState(), [version]);
  const integrations = state.integrations;
  const platformEntityTotal =
    state.users.length +
    state.courses.length +
    state.classGroups.length +
    state.enrollments.length +
    state.events.length +
    state.auditLogs.length;

  const healthChecks: Array<{
    id: string;
    label: string;
    detail: string;
    status: IntegrationStatus;
    metric: string;
  }> = [
    {
      id: "app",
      label: "Application shell",
      detail:
        "Role routing, responsive platform shell, and local state are available.",
      status: "connected",
      metric: "Ready",
    },
    {
      id: "data",
      label: "System data",
      detail: `${platformEntityTotal} records across users, courses, classes, enrollments, events, and activity logs.`,
      status: "connected",
      metric: `${platformEntityTotal} records`,
    },
    {
      id: "supabase",
      label: "Supabase boundary",
      detail:
        "Browser code uses publishable credentials only; privileged keys stay protected.",
      status:
        integrations.find(integration => integration.id === "supabase")
          ?.status ?? "not_configured",
      metric: "Auth boundary",
    },
    {
      id: "moodle",
      label: "Moodle",
      detail:
        "Course mapping and activity inspection remain in test/import mode.",
      status:
        integrations.find(integration => integration.id === "moodle")?.status ??
        "not_configured",
      metric: `${state.courses.length} courses`,
    },
    {
      id: "communications",
      label: "Communications",
      detail:
        "Email and WhatsApp remain log-first until delivery providers are connected.",
      status: integrations.some(
        integration =>
          ["email", "whatsapp"].includes(integration.id) &&
          integration.status === "connected"
      )
        ? "connected"
        : "mock_mode",
      metric: `${state.communicationLogs.length} logs`,
    },
  ];
  const healthScore = Math.round(
    (healthChecks.filter(
      check => check.status === "connected" || check.status === "mock_mode"
    ).length /
      healthChecks.length) *
      100
  );
  const latestHealthAudit = state.auditLogs.find(
    audit => audit.action === "system.health_checked"
  );

  const runHealthChecks = async () => {
    if (saving) return;
    setSaving(true);
    setError("");
    const response = await runPlatformWorkflowActionRequest({
      type: "system.health_check",
      score: healthScore,
    });
    setSaving(false);
    if (!response.ok || !response.data) {
      const message = response.error ?? "System health check was not saved.";
      setError(message);
      toast.error("Health check failed", { description: message });
      return;
    }
    platformStore.setState(response.data.state);
    setVersion(value => value + 1);
    toast.success("Health checked", {
      description: `System health check scored ${healthScore}%.`,
    });
  };

  return (
    <PlatformShell role="superadmin" title="System health">
      <ReportLayout
        className="admin-system-health-page"
        title="System health"
        description="Run and review internal platform readiness checks."
        context="Admin"
        actions={
          <button
            type="button"
            className="platform-primary-button"
            onClick={() => void runHealthChecks()}
            disabled={saving}
          >
            <RefreshCcw size={15} />
            {saving ? "Checking" : "Run checks"}
          </button>
        }
        main={
          <DataTableCard
            title="Operational checks"
            subtitle={`${healthScore}% readiness`}
          >
            {error ? (
              <div className="platform-empty-state error">
                <strong>Health check was not saved</strong>
                <span>{error}</span>
              </div>
            ) : null}
            <table>
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Check</th>
                  <th>Signal</th>
                  <th>Metric</th>
                </tr>
              </thead>
              <tbody>
                {healthChecks.map(check => (
                  <tr key={check.id}>
                    <td>
                      <StatusBadge tone={integrationTone(check.status)}>
                        {formatConnectionStatus(check.status)}
                      </StatusBadge>
                    </td>
                    <td>
                      <strong>{check.label}</strong>
                    </td>
                    <td>{check.detail}</td>
                    <td>{check.metric}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </DataTableCard>
        }
        side={
          <div className="portal-simple-stack">
            <section className="portal-simple-side-card">
              <span>
                <Activity size={15} />
                Readiness score
              </span>
              <strong>{healthScore}%</strong>
              <p>
                Connected and test-mode checks count as usable during internal
                alpha stabilization.
              </p>
            </section>

            <section className="portal-simple-side-card">
              <span>
                <Server size={15} />
                Data surface
              </span>
              <strong>{platformEntityTotal} records</strong>
              <p>
                Users, courses, classes, enrollments, events, and audit rows
                are included in the current local platform state check.
              </p>
            </section>

            <section className="portal-simple-side-card">
              <span>
                <ShieldCheck size={15} />
                Latest health audit
              </span>
              {latestHealthAudit ? (
                <>
                  <strong>{latestHealthAudit.action}</strong>
                  <p>{latestHealthAudit.summary}</p>
                </>
              ) : (
                <p>Run checks to write the first health audit row.</p>
              )}
            </section>
          </div>
        }
      />
    </PlatformShell>
  );
}
