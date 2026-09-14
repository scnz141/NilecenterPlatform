import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCcw } from "lucide-react";
import { toast } from "sonner";
import NccReadStatus from "@/components/platform/NccReadStatus";
import PlatformShell from "@/components/platform/PlatformShell";
import { ReportLayout } from "@/components/platform/PlatformLayouts";
import {
  DataTableCard,
  StatusBadge,
} from "@/components/platform/PlatformPrimitives";
import {
  PortalInsight,
  type InsightPoint,
} from "@/components/platform/PortalInsights";
import { getStoredAuthSession } from "@/lib/auth/session";
import {
  fetchNccSystemHealthRequest,
  runPlatformWorkflowActionRequest,
  type NccSystemHealthDto,
} from "@/lib/backend/api";
import {
  classifyNccFailure,
  type NccReadState,
} from "@/lib/backend/nccReadState";
import {
  emsStagingStatusRequest,
  type EmsStagingStatus,
} from "@/lib/backend/emsStaging";
import { platformStore } from "@/lib/domain/store";
import type { IntegrationStatus } from "@/lib/domain/types";

function formatConnectionStatus(status: IntegrationStatus) {
  if (status === "connected") return "Ready";
  if (status === "mock_mode") return "Test mode";
  if (status === "error") return "Needs review";
  return "Needs setup";
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
  return getStoredAuthSession()?.provider === "ncc" ? (
    <NccAdminSystemHealthPage />
  ) : (
    <CompatibilityAdminSystemHealthPage />
  );
}

function nccHealthTone(
  status: string
): "green" | "amber" | "red" | "slate" {
  if (status === "ok" || status === "healthy") return "green";
  if (status === "warning" || status === "degraded" || status === "not_configured")
    return "amber";
  if (status === "error" || status === "unhealthy") return "red";
  return "slate";
}

function humanizeHealthStatus(status: string) {
  return status
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, character => character.toUpperCase());
}

function formatHealthDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function boolLabel(value: boolean | null) {
  return value === null ? "Unknown" : value ? "Yes" : "No";
}

function NccAdminSystemHealthPage() {
  const [readState, setReadState] = useState<NccReadState<NccSystemHealthDto>>({
    status: "loading",
  });

  const load = useCallback(async () => {
    setReadState({ status: "loading" });
    const result = await fetchNccSystemHealthRequest();
    setReadState(
      result.ok && result.data
        ? { status: "ready", data: result.data.health }
        : classifyNccFailure(result)
    );
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const health = readState.status === "ready" ? readState.data : null;

  const componentRows = health
    ? ([
        {
          key: "api",
          label: "API",
          status: health.components.api.status,
          detail: health.components.api.detail,
        },
        {
          key: "database",
          label: "Database",
          status: health.components.database.status,
          detail: health.components.database.detail,
        },
        {
          key: "schema",
          label: "Schema",
          status: health.components.schemaCheck.status,
          detail:
            health.components.schemaCheck.missingTables?.length
              ? `Missing tables: ${health.components.schemaCheck.missingTables.join(", ")}`
              : health.components.schemaCheck.detail,
        },
        {
          key: "migration",
          label: "Migration",
          status: health.components.migration.status,
          detail: [
            health.components.migration.version
              ? `Version ${health.components.migration.version}`
              : null,
            health.components.migration.detail,
          ]
            .filter(Boolean)
            .join(" · ") || null,
        },
        {
          key: "moodle",
          label: "Moodle",
          status: health.components.moodle.status,
          detail: [
            health.components.moodle.siteName,
            health.components.moodle.release,
            `Configured ${boolLabel(health.components.moodle.configured)}`,
            `Reachable ${boolLabel(health.components.moodle.reachable)}`,
            `Expected version ${boolLabel(health.components.moodle.versionExpected)}`,
            health.components.moodle.detail,
          ]
            .filter(Boolean)
            .join(" · "),
        },
      ] as const)
    : [];

  return (
    <PlatformShell role="superadmin" title="System health">
      <ReportLayout
        className="admin-system-health-page"
        title="Health"
        description="Review live EMS and Moodle service status."
        context="Admin"
        actions={
          <button
            type="button"
            className="platform-primary-button"
            onClick={() => void load()}
            disabled={readState.status === "loading"}
          >
            <RefreshCcw size={15} />
            {readState.status === "loading" ? "Checking" : "Run check"}
          </button>
        }
        main={
          <div className="admin-health-workspace">
            {!health ? (
              <NccReadStatus state={readState} onRetry={() => void load()} />
            ) : (
              <>
                <section className="admin-health-summary" role="status">
                  <div className="teacher-class-overview-heading">
                    <span>
                      <RefreshCcw size={16} />
                      Overall status
                    </span>
                    <StatusBadge tone={nccHealthTone(health.status)}>
                      {humanizeHealthStatus(health.status)}
                    </StatusBadge>
                  </div>
                  <p>Checked {formatHealthDateTime(health.checkedAt)}</p>
                </section>
                <DataTableCard
                  title="Service health"
                  subtitle={humanizeHealthStatus(health.status)}
                  className="admin-health-checks-card"
                >
                  <div
                    className="admin-record-list admin-health-record-list"
                    data-testid="admin-health-list"
                  >
                    {componentRows.map(row => (
                      <article key={row.key}>
                        <div className="admin-record-list-copy">
                          <strong>{row.label}</strong>
                          {row.detail ? <p>{row.detail}</p> : null}
                        </div>
                        <div className="admin-record-list-meta">
                          <StatusBadge tone={nccHealthTone(row.status)}>
                            {humanizeHealthStatus(row.status)}
                          </StatusBadge>
                        </div>
                      </article>
                    ))}
                  </div>
                  {health.components.moodle.warnings?.length ? (
                    <p role="status">
                      {health.components.moodle.warnings.join(" ")}
                    </p>
                  ) : null}
                </DataTableCard>
              </>
            )}
          </div>
        }
      />
    </PlatformShell>
  );
}

function CompatibilityAdminSystemHealthPage() {
  const [version, setVersion] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [stagingStatus, setStagingStatus] = useState<EmsStagingStatus | null>(
    null
  );
  const [stagingChecking, setStagingChecking] = useState(false);
  const [stagingError, setStagingError] = useState("");
  const state = useMemo(() => platformStore.getState(), [version]);
  const integrations = state.integrations;

  const healthChecks: Array<{
    id: string;
    label: string;
    detail: string;
    status: IntegrationStatus;
    metric: string;
  }> = [
    {
      id: "app",
      label: "Nile Learn workspace",
      detail: "Sign-in, school workspaces, and core navigation are available.",
      status: "connected",
      metric: "Ready",
    },
    {
      id: "data",
      label: "School records",
      detail: "People, classes, learning records, and activity are available.",
      status: "connected",
      metric: "Available",
    },
    {
      id: "supabase",
      label: "Data connection",
      detail: "Protected setup stays outside the browser workspace.",
      status:
        integrations.find(integration => integration.id === "supabase")
          ?.status ?? "not_configured",
      metric: "Protected",
    },
    {
      id: "moodle",
      label: "Moodle",
      detail: "Course content is available only through the approved setup.",
      status:
        integrations.find(integration => integration.id === "moodle")?.status ??
        "not_configured",
      metric: "Course source",
    },
    {
      id: "communications",
      label: "Message delivery",
      detail:
        "External delivery remains unavailable until a provider is approved.",
      status: integrations.some(
        integration =>
          ["email", "whatsapp"].includes(integration.id) &&
          integration.status === "connected"
      )
        ? "connected"
        : "mock_mode",
      metric: "Internal only",
    },
  ];
  const healthScore = Math.round(
    (healthChecks.filter(
      check => check.status === "connected" || check.status === "mock_mode"
    ).length /
      healthChecks.length) *
      100
  );
  const insightPoints: InsightPoint[] = [
    {
      label: "Ready",
      value: healthChecks.filter(check => check.status === "connected").length,
    },
    {
      label: "Test mode",
      value: healthChecks.filter(check => check.status === "mock_mode").length,
    },
    {
      label: "Needs review",
      value: healthChecks.filter(
        check => check.status === "error" || check.status === "not_configured"
      ).length,
    },
  ];
  const availableChecks = healthChecks.filter(
    check => check.status === "connected" || check.status === "mock_mode"
  ).length;
  const attentionChecks = healthChecks.length - availableChecks;
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
  const probeStaging = async () => {
    if (stagingChecking) return;
    setStagingChecking(true);
    setStagingError("");
    const response = await emsStagingStatusRequest();
    setStagingChecking(false);
    if (!response.ok || !response.data) {
      const message = response.error ?? "Staging probe failed.";
      setStagingError(message);
      return;
    }
    setStagingStatus(response.data);
  };

  return (
    <PlatformShell role="superadmin" title="System health">
      <ReportLayout
        className="admin-system-health-page"
        title="Health"
        description="Review the services that need attention."
        context="Admin"
        actions={
          <button
            type="button"
            className="platform-primary-button"
            onClick={() => void runHealthChecks()}
            disabled={saving}
          >
            <RefreshCcw size={15} />
            {saving ? "Checking" : "Run check"}
          </button>
        }
        main={
          <div className="admin-health-workspace">
            <PortalInsight
              eyebrow="Health overview"
              title="Service readiness"
              value={`${availableChecks}/${healthChecks.length}`}
              valueLabel="checks available"
              description={
                attentionChecks
                  ? `${attentionChecks} check${attentionChecks === 1 ? " needs" : "s need"} review.`
                  : "All current checks are available."
              }
              points={insightPoints}
              variant="distribution"
              tone={attentionChecks ? "amber" : "green"}
              testId="admin-health-insight"
              className="admin-health-insight"
            />
            <DataTableCard
              title="Health checks"
              subtitle={
                attentionChecks
                  ? `${attentionChecks} need attention`
                  : "All checks available"
              }
              className="admin-health-checks-card"
            >
              {error ? (
                <div className="admin-system-result error" role="alert">
                  <strong>Health check was not saved</strong>
                  <span>{error}</span>
                </div>
              ) : null}
              <div
                className="admin-record-list admin-health-record-list"
                data-testid="admin-health-list"
              >
                {healthChecks.map(check => (
                  <article key={check.id}>
                    <div className="admin-record-list-copy">
                      <strong>{check.label}</strong>
                      <p>{check.detail}</p>
                    </div>
                    <dl className="admin-record-list-facts">
                      <div>
                        <dt>Summary</dt>
                        <dd>{check.metric}</dd>
                      </div>
                    </dl>
                    <div className="admin-record-list-meta">
                      <StatusBadge tone={integrationTone(check.status)}>
                        {formatConnectionStatus(check.status)}
                      </StatusBadge>
                    </div>
                  </article>
                ))}
              </div>
            </DataTableCard>
            <DataTableCard
              title="NCC EMS staging"
              subtitle={
                stagingStatus
                  ? stagingStatus.configured
                    ? stagingStatus.reachable
                      ? "API reachable"
                      : "Configured but unavailable"
                    : "Server configuration required"
                  : "Server-derived transport readiness"
              }
              className="admin-health-staging-card"
            >
              <div
                className="admin-health-staging"
                data-testid="admin-health-staging"
              >
                {stagingError ? (
                  <div className="admin-system-result error" role="alert">
                    <strong>Staging probe failed</strong>
                    <span>{stagingError}</span>
                  </div>
                ) : null}
                <button
                  type="button"
                  className="platform-secondary-button"
                  onClick={() => void probeStaging()}
                  disabled={stagingChecking}
                >
                  {stagingChecking ? "Probing" : "Probe staging"}
                </button>
                {stagingStatus ? (
                  <dl className="admin-record-list-facts">
                    <div>
                      <dt>API configuration</dt>
                      <dd>{stagingStatus.configured ? "Ready" : "Not set"}</dd>
                    </div>
                    <div>
                      <dt>Transport</dt>
                      <dd>
                        {stagingStatus.reachable ? "Reachable" : "Unavailable"}
                      </dd>
                    </div>
                    <div>
                      <dt>Session protection</dt>
                      <dd>
                        {stagingStatus.sessionProtectionConfigured
                          ? "Ready"
                          : "Not set"}
                      </dd>
                    </div>
                    <div>
                      <dt>Staff session</dt>
                      <dd>
                        {stagingStatus.linked ? "Verified" : "Not verified"}
                      </dd>
                    </div>
                  </dl>
                ) : null}
              </div>
            </DataTableCard>
          </div>
        }
      />
    </PlatformShell>
  );
}
