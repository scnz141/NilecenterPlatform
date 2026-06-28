import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Database,
  Layers,
  Network,
  PlugZap,
  ScrollText,
  ShieldCheck,
} from "lucide-react";
import PlatformShell from "@/components/platform/PlatformShell";
import { platformModules } from "@/lib/domain/modules";
import { platformStore } from "@/lib/domain/store";
import type { IntegrationConfig } from "@/lib/domain/types";
import { integrationRegistry, getServerOnlyIntegrationNotes } from "@/lib/integrations/registry";
import { roleMeta } from "@/lib/platformData";

const statusMeta: Record<IntegrationConfig["status"], { label: string; tone: string }> = {
  connected: { label: "Connected", tone: "green" },
  mock_mode: { label: "Mock mode", tone: "amber" },
  not_configured: { label: "Not configured", tone: "slate" },
  error: { label: "Needs attention", tone: "red" },
};

const statusIcon = {
  connected: CheckCircle2,
  mock_mode: Activity,
  not_configured: AlertTriangle,
  error: AlertTriangle,
};

export default function PlatformBlueprintPage() {
  const state = platformStore.getState();
  const serverNotes = getServerOnlyIntegrationNotes();
  const recentAudit = state.auditLogs.slice(0, 6);
  const entityCounts = [
    { label: "Users", value: state.users.length, helper: "Identity and role accounts" },
    { label: "Courses", value: state.courses.length, helper: "Academic catalog records" },
    { label: "Classes", value: state.classGroups.length, helper: "Cohorts and live groups" },
    { label: "Leads", value: state.leads.length, helper: "Public intake pipeline" },
    { label: "Placements", value: state.placementTests.length, helper: "Level mapping bookings" },
    { label: "Audit logs", value: state.auditLogs.length, helper: "Local workflow trail" },
  ];

  return (
    <PlatformShell role="superadmin" title="Platform blueprint">
      <section className="platform-page-header">
        <div>
          <span className="platform-eyebrow">Super Admin</span>
          <h1>Platform blueprint</h1>
          <p>
            The operating map for Nile Learn: product modules, route ownership, domain entities, services,
            integrations, and the backend work still required before production launch.
          </p>
        </div>
        <div className="platform-header-actions">
          <a className="platform-secondary-button" href="/app/admin/integrations">
            <PlugZap size={15} />
            Open integrations
          </a>
          <a className="platform-primary-button" style={{ background: roleMeta.superadmin.color }} href="/app/admin/audit-logs">
            <ScrollText size={15} />
            Review audit logs
          </a>
        </div>
      </section>

      <section className="platform-blueprint-hero">
        <div>
          <span className="platform-eyebrow">System model</span>
          <h2>Designed as a long-lived LMS plus EMS platform.</h2>
          <p>
            Public website intake, registrar operations, student learning, teaching tools, academic management,
            branch operations, certificates, reporting, and integrations are separated by ownership and data
            boundaries. The current app uses local mock storage with server-only integration placeholders.
          </p>
        </div>
        <div className="platform-blueprint-kpis">
          <article>
            <Network size={18} />
            <strong>{platformModules.length}</strong>
            <span>Product modules</span>
          </article>
          <article>
            <Database size={18} />
            <strong>{entityCounts.reduce((sum, item) => sum + item.value, 0)}</strong>
            <span>Seeded records</span>
          </article>
          <article>
            <ShieldCheck size={18} />
            <strong>6</strong>
            <span>Protected roles</span>
          </article>
        </div>
      </section>

      <section className="platform-entity-grid">
        {entityCounts.map((item) => (
          <article key={item.label}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
            <small>{item.helper}</small>
          </article>
        ))}
      </section>

      <section className="platform-blueprint-layout">
        <div className="platform-module-grid">
          {platformModules.map((module) => {
            const owner = roleMeta[module.ownerRole];
            return (
              <article key={module.id} className="platform-module-card">
                <div className="platform-module-title">
                  <span style={{ background: owner.tint, color: owner.color }}>{owner.shortLabel}</span>
                  <strong>{module.label}</strong>
                </div>
                <p>{module.purpose}</p>
                <dl>
                  <div>
                    <dt>Route root</dt>
                    <dd>{module.routeRoot}</dd>
                  </div>
                  <div>
                    <dt>Services</dt>
                    <dd>{module.services.join(", ")}</dd>
                  </div>
                </dl>
                <div className="platform-chip-row">
                  {module.dataEntities.slice(0, 5).map((entity) => (
                    <span key={entity}>{entity}</span>
                  ))}
                </div>
                <div className="platform-module-work">
                  <strong>Production backend still needed</strong>
                  {module.remainingWork.map((item) => (
                    <small key={item}>
                      <Layers size={13} />
                      {item}
                    </small>
                  ))}
                </div>
              </article>
            );
          })}
        </div>

        <aside className="platform-blueprint-side">
          <article className="platform-panel">
            <div className="platform-card-title">
              <div>
                <span>Server-only connectors</span>
                <strong>Integration readiness</strong>
              </div>
              <PlugZap size={18} />
            </div>
            <div className="platform-integration-list">
              {integrationRegistry.map((integration) => {
                const meta = statusMeta[integration.status];
                const Icon = statusIcon[integration.status];
                return (
                  <div key={integration.id}>
                    <span className={`platform-integration-status ${meta.tone}`}>
                      <Icon size={13} />
                      {meta.label}
                    </span>
                    <strong>{integration.label}</strong>
                    <small>{integration.notes}</small>
                    <em>{integration.envVars.length ? integration.envVars.join(", ") : "No env vars required yet"}</em>
                  </div>
                );
              })}
            </div>
          </article>

          <article className="platform-panel">
            <div className="platform-card-title">
              <div>
                <span>Secrets boundary</span>
                <strong>Environment variables</strong>
              </div>
              <ShieldCheck size={18} />
            </div>
            <ul>
              {serverNotes.map((note) => (
                <li key={note}>
                  <CheckCircle2 size={15} />
                  {note}
                </li>
              ))}
            </ul>
          </article>

          <article className="platform-panel">
            <div className="platform-card-title">
              <div>
                <span>Recent state changes</span>
                <strong>Audit trail</strong>
              </div>
              <ScrollText size={18} />
            </div>
            <div className="platform-audit-list">
              {recentAudit.map((audit) => (
                <div key={audit.id}>
                  <strong>{audit.action}</strong>
                  <span>{audit.summary}</span>
                  <small>{new Date(audit.createdAt).toLocaleString()}</small>
                </div>
              ))}
            </div>
          </article>
        </aside>
      </section>
    </PlatformShell>
  );
}
