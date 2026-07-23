import { useMemo, useState } from "react";
import { CheckCircle2, Settings } from "lucide-react";
import PlatformShell from "@/components/platform/PlatformShell";
import SettingsAreaNav from "@/components/platform/SettingsAreaNav";
import { SettingsLayout } from "@/components/platform/PlatformLayouts";
import { StatusBadge } from "@/components/platform/PlatformPrimitives";
import {
  getStoredAuthSession,
  requireActiveUser,
} from "@/lib/auth/session";
import { runPlatformWorkflowActionRequest } from "@/lib/backend/api";
import { platformStore } from "@/lib/domain/store";
import type { PortalSettingsRole, ScopedPortalSettings } from "@/lib/domain/types";
import type { Role } from "@/lib/platformData";

type PortalSettingsPageProps = {
  role: PortalSettingsRole;
};

const titleByRole: Record<PortalSettingsRole, string> = {
  registrar: "Registrar settings",
  branchadmin: "Branch settings",
  headofdepartment: "Academic settings",
};

function roleToShellRole(role: PortalSettingsRole): Role {
  return role;
}

function defaultSettings(role: PortalSettingsRole, scopeId: string, label: string): ScopedPortalSettings {
  return {
    role,
    scopeId,
    label,
    language: "English",
    timezone: "Africa/Cairo",
    notifications: true,
    reviewCadenceDays: role === "branchadmin" ? undefined : 7,
    paymentReminderDays: role === "headofdepartment" ? undefined : 5,
    attendanceCutoffMinutes: role === "registrar" ? undefined : 15,
  };
}

export default function PortalSettingsPage({ role }: PortalSettingsPageProps) {
  const [version, setVersion] = useState(0);
  const state = useMemo(() => platformStore.getState(), [version]);
  const activeUser = requireActiveUser(role);
  const session = getStoredAuthSession();
  const user = state.users.find(item => item.id === activeUser.id);
  const branchId = user?.branchId ?? session?.branchIds[0];
  const departmentId = user?.departmentId ?? session?.departmentIds[0];
  const branch = state.branches.find(item => item.id === branchId);
  const department = state.departments.find(item => item.id === departmentId);
  const scopeId =
    role === "headofdepartment"
      ? (department?.id ?? departmentId ?? "")
      : (branch?.id ?? branchId ?? "");
  const scopeLabel =
    role === "headofdepartment"
      ? (department?.name ?? "No department assigned")
      : (branch?.name ?? "No branch assigned");
  const savedSettings =
    state.portalSettings.find(item => item.role === role && item.scopeId === scopeId) ??
    defaultSettings(role, scopeId, scopeLabel);
  const [form, setForm] = useState(savedSettings);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const updateForm = <K extends keyof ScopedPortalSettings>(key: K, value: ScopedPortalSettings[K]) => {
    setForm(current => ({ ...current, [key]: value }));
  };

  const saveSettings = async () => {
    setSaving(true);
    setError("");
    setMessage("");
    const result = await runPlatformWorkflowActionRequest({
      type: "portal.settings.save",
      role,
      scopeId,
      label: form.label,
      language: form.language,
      timezone: form.timezone,
      notifications: form.notifications,
      reviewCadenceDays: form.reviewCadenceDays,
      paymentReminderDays: form.paymentReminderDays,
      attendanceCutoffMinutes: form.attendanceCutoffMinutes,
    });
    setSaving(false);
    if (!result.ok || !result.data) {
      setError(result.error ?? "Settings could not be saved.");
      return;
    }
    platformStore.setState(result.data.state);
    setVersion(current => current + 1);
    setMessage("Settings saved.");
  };

  return (
    <PlatformShell role={roleToShellRole(role)} title="Settings">
      <SettingsLayout
        className="portal-simple-page"
        title={titleByRole[role]}
        description="Manage settings for this workspace only."
        context={scopeLabel}
        actions={
          <button type="button" className="platform-primary-button" disabled={saving} onClick={saveSettings}>
            <CheckCircle2 size={15} />
            {saving ? "Saving" : "Save settings"}
          </button>
        }
        toolbar={<SettingsAreaNav role={roleToShellRole(role)} active="workspace" />}
        main={
          <div className="portal-simple-stack">
            <section className="portal-simple-form-card">
              <div className="platform-card-title compact">
                <div>
                  <span>Workspace</span>
                  <strong>General settings</strong>
                </div>
              </div>
              <div className="portal-simple-form-grid">
                <label>
                  Workspace label
                  <input value={form.label} onChange={event => updateForm("label", event.target.value)} />
                </label>
                <label>
                  Language
                  <select value={form.language} onChange={event => updateForm("language", event.target.value)}>
                    <option>English</option>
                    <option>Arabic</option>
                  </select>
                </label>
                <label>
                  Timezone
                  <select value={form.timezone} onChange={event => updateForm("timezone", event.target.value)}>
                    <option>Africa/Cairo</option>
                    <option>Europe/Istanbul</option>
                    <option>UTC</option>
                  </select>
                </label>
                <label className="portal-simple-check">
                  <input
                    type="checkbox"
                    checked={form.notifications}
                    onChange={event => updateForm("notifications", event.target.checked)}
                  />
                  Notify me about work queues
                </label>
              </div>
            </section>

            <section className="portal-simple-form-card">
              <div className="platform-card-title compact">
                <div>
                  <span>Workflow</span>
                  <strong>{role === "registrar" ? "Admissions" : role === "branchadmin" ? "Operations" : "Academic review"}</strong>
                </div>
              </div>
              <div className="portal-simple-form-grid">
                {role !== "branchadmin" ? (
                  <label>
                    Review cadence days
                    <input
                      type="number"
                      min="1"
                      max="90"
                      value={form.reviewCadenceDays ?? 7}
                      onChange={event => updateForm("reviewCadenceDays", Number(event.target.value))}
                    />
                  </label>
                ) : null}
                {role !== "headofdepartment" ? (
                  <label>
                    Payment reminder days
                    <input
                      type="number"
                      min="1"
                      max="30"
                      value={form.paymentReminderDays ?? 5}
                      onChange={event => updateForm("paymentReminderDays", Number(event.target.value))}
                    />
                  </label>
                ) : null}
                {role !== "registrar" ? (
                  <label>
                    Attendance cutoff minutes
                    <input
                      type="number"
                      min="0"
                      max="120"
                      value={form.attendanceCutoffMinutes ?? 15}
                      onChange={event => updateForm("attendanceCutoffMinutes", Number(event.target.value))}
                    />
                  </label>
                ) : null}
              </div>
              {message ? <p className="platform-scheduler-feedback success">{message}</p> : null}
              {error ? <p className="platform-attendance-error">{error}</p> : null}
            </section>
          </div>
        }
        side={
          <section className="portal-simple-side-card">
            <span>Scope</span>
            <strong>{scopeLabel}</strong>
            <p>This page saves settings for this role workspace only. Platform-wide settings stay in Super Admin.</p>
            <StatusBadge tone="slate">{role.replace("headofdepartment", "HOD")}</StatusBadge>
            <div className="portal-simple-mini-list">
              <span><Settings size={14} /> {form.timezone}</span>
              <span>{form.language}</span>
              <span>{form.notifications ? "Notifications on" : "Notifications off"}</span>
            </div>
          </section>
        }
      />
    </PlatformShell>
  );
}
