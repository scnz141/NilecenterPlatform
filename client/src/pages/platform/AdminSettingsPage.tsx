import { useMemo, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import PlatformShell from "@/components/platform/PlatformShell";
import SettingsAreaNav from "@/components/platform/SettingsAreaNav";
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
  const [savedAt, setSavedAt] = useState("");

  const saveSettings = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError("");
    setSavedAt("");
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
    setSavedAt(
      new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    );
    toast.success("Platform settings saved");
  };

  return (
    <PlatformShell role="superadmin" title="Settings">
      <SettingsLayout
        className="admin-settings-page"
        title="Settings"
        description="Set the school-wide defaults used across Nile Learn."
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
        toolbar={<SettingsAreaNav role="superadmin" active="workspace" />}
        main={
          <DataTableCard
            title="School setup"
            subtitle="Changes apply across Nile Learn."
            className="admin-settings-card"
          >
            <form
              id="admin-platform-settings-form"
              className="admin-simple-settings-form"
              data-testid="admin-settings-form"
              onSubmit={saveSettings}
            >
              <section className="admin-settings-section">
                <div>
                  <span>School profile</span>
                  <h2>Identity and language</h2>
                  <p>Use clear defaults for every school workspace.</p>
                </div>
                <div className="admin-settings-field-grid">
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
                </div>
              </section>
              <section className="admin-settings-section">
                <div>
                  <span>Academic defaults</span>
                  <h2>Learning cycle</h2>
                  <p>
                    Keep academic context and activity retention consistent.
                  </p>
                </div>
                <div className="admin-settings-field-grid">
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
                </div>
              </section>
              <p className="admin-settings-helper">
                Connections and activity have their own System pages.
              </p>
              {error ? (
                <div className="admin-system-result error" role="alert">
                  <strong>Settings were not saved</strong>
                  <span>{error}</span>
                </div>
              ) : null}
              {savedAt ? (
                <div className="admin-system-result success" role="status">
                  <strong>Settings saved</strong>
                  <span>Saved at {savedAt}.</span>
                </div>
              ) : null}
            </form>
          </DataTableCard>
        }
      />
    </PlatformShell>
  );
}
