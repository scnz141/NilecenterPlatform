import { useMemo, useState } from "react";
import { CheckCircle2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import PlatformShell from "@/components/platform/PlatformShell";
import { SettingsLayout } from "@/components/platform/PlatformLayouts";
import { DataTableCard } from "@/components/platform/PlatformPrimitives";
import { runPlatformWorkflowActionRequest } from "@/lib/backend/api";
import { platformStore } from "@/lib/domain/store";

export default function AdminSettingsPage() {
  const [version, setVersion] = useState(0);
  const state = useMemo(() => platformStore.getState(), [version]);
  const [settingsDraft, setSettingsDraft] = useState(() => ({
    organization: state.settings.organization,
    defaultLanguage: state.settings.defaultLanguage,
    academicTerm: state.settings.academicTerm,
    retentionDays: String(state.settings.retentionDays),
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const saveSettings = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError("");
    const response = await runPlatformWorkflowActionRequest({
      type: "settings.save",
      organization: settingsDraft.organization,
      defaultLanguage: settingsDraft.defaultLanguage,
      academicTerm: settingsDraft.academicTerm,
      retentionDays: Number(settingsDraft.retentionDays),
    });
    setSaving(false);

    if (!response.ok || !response.data) {
      const message = response.error ?? "Platform settings could not be saved.";
      setError(message);
      toast.error("Settings save failed", { description: message });
      return;
    }

    platformStore.setState(response.data.state);
    setVersion(value => value + 1);
    toast.success("Platform settings saved", {
      description: response.data.persistence,
    });
  };

  return (
    <PlatformShell role="superadmin" title="Settings">
      <SettingsLayout
        className="admin-settings-page"
        title="Settings"
        description="Manage global platform configuration only."
        context="Admin"
        actions={
          <button
            type="submit"
            form="admin-platform-settings-form"
            className="platform-primary-button"
            disabled={saving}
          >
            <ShieldCheck size={15} />
            {saving ? "Saving settings" : "Save settings"}
          </button>
        }
        main={
          <DataTableCard
            title="Global platform settings"
            subtitle="Protected local configuration"
          >
            <form
              id="admin-platform-settings-form"
              className="admin-system-settings-form"
              onSubmit={saveSettings}
            >
              <label>
                Organization
                <input
                  value={settingsDraft.organization}
                  onChange={event =>
                    setSettingsDraft(value => ({
                      ...value,
                      organization: event.target.value,
                    }))
                  }
                />
              </label>
              <label>
                Default language
                <select
                  value={settingsDraft.defaultLanguage}
                  onChange={event =>
                    setSettingsDraft(value => ({
                      ...value,
                      defaultLanguage: event.target.value,
                    }))
                  }
                >
                  <option>English</option>
                  <option>Arabic</option>
                  <option>Turkish</option>
                  <option>Russian</option>
                </select>
              </label>
              <label>
                Academic term
                <input
                  value={settingsDraft.academicTerm}
                  onChange={event =>
                    setSettingsDraft(value => ({
                      ...value,
                      academicTerm: event.target.value,
                    }))
                  }
                />
              </label>
              <label>
                Activity retention days
                <input
                  type="number"
                  min="30"
                  value={settingsDraft.retentionDays}
                  onChange={event =>
                    setSettingsDraft(value => ({
                      ...value,
                      retentionDays: event.target.value,
                    }))
                  }
                />
              </label>
              <div className="admin-system-policy-list">
                {[
                  "Global settings apply to all portals.",
                  "Provider setup stays on Connections.",
                  "Activity review stays on Activity log.",
                ].map(policy => (
                  <span key={policy}>
                    <CheckCircle2 size={15} /> {policy}
                  </span>
                ))}
              </div>
              {error ? (
                <div className="platform-empty-state error">
                  <strong>Settings were not saved</strong>
                  <span>{error}</span>
                </div>
              ) : null}
            </form>
          </DataTableCard>
        }
        side={
          <div className="portal-simple-stack">
            <section className="portal-simple-side-card">
              <span>
                <ShieldCheck size={15} />
                Settings scope
              </span>
              <strong>{state.settings.organization}</strong>
              <p>
                This page only controls organization, language, term, and
                activity retention.
              </p>
            </section>
            <section className="portal-simple-side-card">
              <span>
                <ShieldCheck size={15} />
                Current policy
              </span>
              <strong>{state.settings.academicTerm}</strong>
              <p>{state.settings.retentionDays} day activity retention.</p>
            </section>
          </div>
        }
      />
    </PlatformShell>
  );
}
