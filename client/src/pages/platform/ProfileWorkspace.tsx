import { useMemo, useState } from "react";
import {
  Bell,
  CheckCircle2,
  KeyRound,
  ShieldCheck,
  UserCircle,
} from "lucide-react";
import PlatformShell from "@/components/platform/PlatformShell";
import SettingsAreaNav from "@/components/platform/SettingsAreaNav";
import { DetailLayout } from "@/components/platform/PlatformLayouts";
import { StatusBadge } from "@/components/platform/PlatformPrimitives";
import {
  changePasswordRequest,
  runPlatformWorkflowActionRequest,
} from "@/lib/backend/api";
import {
  getStoredAuthSession,
  requireActiveUser,
} from "@/lib/auth/session";
import { platformStore } from "@/lib/domain/store";
import type {
  StaffAvailabilityStatus,
  User,
  UserNotificationPreferences,
} from "@/lib/domain/types";
import { roleMeta, type Role } from "@/lib/platformData";

type ProfileWorkspaceProps = {
  role: Role;
};

type ProfileDraft = {
  name: string;
  phone: string;
  preferredLanguage: string;
  timezone: string;
  country: string;
  guardianName: string;
  guardianPhone: string;
  title: string;
  availabilityStatus: StaffAvailabilityStatus;
  notificationPreferences: UserNotificationPreferences;
};

const titleByRole: Record<Role, string> = {
  student: "Student profile",
  teacher: "Teacher profile",
  registrar: "Registrar profile",
  headofdepartment: "HOD profile",
  branchadmin: "Branch admin profile",
  superadmin: "Admin profile",
};

const descriptionByRole: Record<Role, string> = {
  student:
    "Manage your learning account, contact details, preferences, and security.",
  teacher:
    "Manage your teaching contact details, availability, and preferences.",
  registrar:
    "Manage your admissions account details, preferences, and security.",
  headofdepartment:
    "Manage your academic leadership account details, preferences, and security.",
  branchadmin:
    "Manage your branch operations account details, preferences, and security.",
  superadmin:
    "Manage your platform account details, preferences, and security.",
};

const defaultPreferences: UserNotificationPreferences = {
  messages: true,
  schedule: true,
  academic: true,
  billing: false,
  system: false,
};

function userInitials(name: string) {
  const parts = name
    .split(/\s+/)
    .map(part => part.trim()[0])
    .filter(Boolean);
  return parts.slice(0, 2).join("").toUpperCase() || "NL";
}

export default function ProfileWorkspace({ role }: ProfileWorkspaceProps) {
  const [version, setVersion] = useState(0);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState("");
  const [profileError, setProfileError] = useState("");
  const [passwordDraft, setPasswordDraft] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [activeSection, setActiveSection] = useState<
    "details" | "preferences" | "security"
  >("details");

  const state = useMemo(() => platformStore.getState(), [version]);
  const session = getStoredAuthSession();
  const actor = requireActiveUser(role);
  const user: User = state.users.find(item => item.id === actor.id) ?? {
    id: actor.id,
    name: actor.name,
    email: actor.email,
    roles: actor.roles,
    activeRole: actor.activeRole,
    status: "active",
  };
  const student = state.students.find(item => item.userId === user?.id);
  const teacherProfile = state.teachers.find(item => item.userId === user?.id);
  const staffProfile =
    state.staffProfiles.find(
      item => item.userId === user?.id && item.role === user?.activeRole
    ) ?? state.staffProfiles.find(item => item.userId === user?.id);
  const branches = staffProfile?.branchIds.length
    ? state.branches.filter(item => staffProfile.branchIds.includes(item.id))
    : state.branches.filter(item => item.id === user?.branchId);
  const departments = staffProfile?.departmentIds.length
    ? state.departments.filter(item =>
        staffProfile.departmentIds.includes(item.id)
      )
    : state.departments.filter(item => item.id === user?.departmentId);

  const initialDraft = useMemo<ProfileDraft>(
    () => ({
      name: user?.name ?? "",
      phone: user?.phone ?? "",
      preferredLanguage:
        user?.preferredLanguage ?? student?.preferredLanguage ?? "English",
      timezone:
        user?.timezone ??
        student?.timezone ??
        branches[0]?.timezone ??
        "Africa/Cairo",
      country: student?.country ?? "Egypt",
      guardianName: student?.guardianName ?? "",
      guardianPhone: student?.guardianPhone ?? "",
      title: staffProfile?.title ?? roleMeta[role].label,
      availabilityStatus:
        staffProfile?.availabilityStatus ??
        teacherProfile?.availabilityStatus ??
        "not_applicable",
      notificationPreferences: {
        ...defaultPreferences,
        billing:
          role === "registrar" ||
          role === "branchadmin" ||
          role === "superadmin",
        system: role === "superadmin",
        ...user?.notificationPreferences,
      },
    }),
    [branches, role, staffProfile, student, teacherProfile, user]
  );
  const [draft, setDraft] = useState<ProfileDraft>(initialDraft);

  const updateDraft = <K extends keyof ProfileDraft>(
    key: K,
    value: ProfileDraft[K]
  ) => {
    setDraft(current => ({ ...current, [key]: value }));
  };

  const updatePreference = (
    key: keyof UserNotificationPreferences,
    value: boolean
  ) => {
    setDraft(current => ({
      ...current,
      notificationPreferences: {
        ...current.notificationPreferences,
        [key]: value,
      },
    }));
  };

  const saveProfile = async () => {
    if (!user || savingProfile) return;
    setSavingProfile(true);
    setProfileError("");
    setProfileMessage("");
    const result = await runPlatformWorkflowActionRequest({
      type: "profile.update",
      userId: user.id,
      idempotencyKey: `profile.update:${crypto.randomUUID()}`,
      expectedVersion: user.version ?? 1,
      name: draft.name,
      phone: draft.phone,
      preferredLanguage: draft.preferredLanguage,
      timezone: draft.timezone,
      notificationPreferences: draft.notificationPreferences,
      country: student ? draft.country : undefined,
      guardianName: student ? draft.guardianName : undefined,
      guardianPhone: student ? draft.guardianPhone : undefined,
      title: staffProfile ? draft.title : undefined,
      availabilityStatus:
        role === "teacher" ? draft.availabilityStatus : undefined,
    });
    setSavingProfile(false);
    if (!result.ok || !result.data) {
      setProfileError(result.error ?? "Profile could not be saved.");
      return;
    }
    platformStore.setState(result.data.state);
    setVersion(current => current + 1);
    setProfileMessage("Profile saved.");
  };

  const changePassword = async () => {
    if (savingPassword) return;
    setPasswordError("");
    setPasswordMessage("");
    if (passwordDraft.newPassword.length < 8) {
      setPasswordError("Use at least 8 characters.");
      return;
    }
    if (passwordDraft.newPassword !== passwordDraft.confirmPassword) {
      setPasswordError("New password and confirmation must match.");
      return;
    }
    setSavingPassword(true);
    const result = await changePasswordRequest({
      currentPassword: passwordDraft.currentPassword,
      newPassword: passwordDraft.newPassword,
    });
    setSavingPassword(false);
    if (!result.ok || !result.data) {
      setPasswordError(result.error ?? "Password could not be changed.");
      return;
    }
    if (result.data.state) {
      platformStore.setState(result.data.state);
      setVersion(current => current + 1);
    }
    setPasswordDraft({
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    });
    setPasswordMessage("Password changed.");
  };

  if (!user) {
    return (
      <PlatformShell role={role} title="Settings">
        <section className="platform-empty-state">
          <strong>Profile unavailable</strong>
          <span>Sign in again to load your Nile Learn profile.</span>
        </section>
      </PlatformShell>
    );
  }

  const profileSections = [
    { id: "details", label: student ? "Details" : "Contact" },
    { id: "preferences", label: "Preferences" },
    { id: "security", label: "Security" },
  ] as const;

  return (
    <PlatformShell role={role} title="Settings">
      <DetailLayout
        className="profile-workspace portal-simple-page"
        title={titleByRole[role]}
        description={descriptionByRole[role]}
        context={roleMeta[role].label}
        actions={
          activeSection === "security" ? undefined : (
            <button
              type="button"
              className="platform-primary-button"
              disabled={savingProfile}
              onClick={saveProfile}
            >
              <CheckCircle2 size={15} />
              {savingProfile ? "Saving" : "Save profile"}
            </button>
          )
        }
        toolbar={
          <div className="settings-area-toolbar">
            <SettingsAreaNav role={role} active="account" />
            <nav
              className="portal-simple-tabs profile-section-tabs"
              aria-label="Profile sections"
            >
              {profileSections.map(section => (
                <button
                  key={section.id}
                  type="button"
                  className={activeSection === section.id ? "active" : ""}
                  onClick={() => setActiveSection(section.id)}
                >
                  {section.label}
                </button>
              ))}
            </nav>
          </div>
        }
        main={
          <div className="profile-main-stack">
            <section className="profile-identity-strip">
              <div className="profile-avatar-large">
                {userInitials(user.name)}
              </div>
              <div>
                <span>{roleMeta[role].label}</span>
                <strong>{user.name}</strong>
                <p>{user.email}</p>
              </div>
              <StatusBadge tone={user.status === "active" ? "green" : "amber"}>
                {user.status}
              </StatusBadge>
            </section>

            {activeSection === "details" ? (
              <>
                <section className="profile-form-card">
                  <div className="profile-section-title">
                    <UserCircle size={17} />
                    <div>
                      <span>Personal details</span>
                      <strong>Identity and contact</strong>
                    </div>
                  </div>
                  <div className="profile-form-grid">
                    <label>
                      Full name
                      <input
                        value={draft.name}
                        onChange={event =>
                          updateDraft("name", event.target.value)
                        }
                      />
                    </label>
                    <label>
                      Email
                      <input
                        value={user.email}
                        readOnly
                        className="profile-readonly-input"
                      />
                    </label>
                    <label>
                      Phone / WhatsApp
                      <input
                        value={draft.phone}
                        onChange={event =>
                          updateDraft("phone", event.target.value)
                        }
                      />
                    </label>
                    {student ? (
                      <label>
                        Country
                        <input
                          value={draft.country}
                          onChange={event =>
                            updateDraft("country", event.target.value)
                          }
                        />
                      </label>
                    ) : null}
                    {staffProfile ? (
                      <label>
                        Title
                        <input
                          value={draft.title}
                          onChange={event =>
                            updateDraft("title", event.target.value)
                          }
                        />
                      </label>
                    ) : null}
                    {role === "teacher" ? (
                      <label>
                        Availability
                        <select
                          value={draft.availabilityStatus}
                          onChange={event =>
                            updateDraft(
                              "availabilityStatus",
                              event.target.value as StaffAvailabilityStatus
                            )
                          }
                        >
                          <option value="available">Available</option>
                          <option value="limited">Limited</option>
                          <option value="unavailable">Unavailable</option>
                        </select>
                      </label>
                    ) : null}
                  </div>
                </section>

                {student ? (
                  <section className="profile-form-card">
                    <div className="profile-section-title">
                      <ShieldCheck size={17} />
                      <div>
                        <span>Guardian</span>
                        <strong>Family contact</strong>
                      </div>
                    </div>
                    <div className="profile-form-grid">
                      <label>
                        Guardian name
                        <input
                          value={draft.guardianName}
                          onChange={event =>
                            updateDraft("guardianName", event.target.value)
                          }
                        />
                      </label>
                      <label>
                        Guardian phone
                        <input
                          value={draft.guardianPhone}
                          onChange={event =>
                            updateDraft("guardianPhone", event.target.value)
                          }
                        />
                      </label>
                    </div>
                  </section>
                ) : null}
              </>
            ) : null}

            {activeSection === "preferences" ? (
              <section className="profile-form-card">
                <div className="profile-section-title">
                  <Bell size={17} />
                  <div>
                    <span>Preferences</span>
                    <strong>Language, time, and alerts</strong>
                  </div>
                </div>
                <div className="profile-form-grid">
                  <label>
                    UI language
                    <select
                      value={draft.preferredLanguage}
                      onChange={event =>
                        updateDraft("preferredLanguage", event.target.value)
                      }
                    >
                      <option>English</option>
                      <option>Arabic</option>
                      <option>Chinese</option>
                      <option>Russian</option>
                      <option>Urdu</option>
                      <option>Turkish</option>
                    </select>
                  </label>
                  <label>
                    Timezone
                    <select
                      value={draft.timezone}
                      onChange={event =>
                        updateDraft("timezone", event.target.value)
                      }
                    >
                      <option>Africa/Cairo</option>
                      <option>Europe/Istanbul</option>
                      <option>Asia/Riyadh</option>
                      <option>Asia/Karachi</option>
                      <option>Asia/Shanghai</option>
                      <option>UTC</option>
                    </select>
                  </label>
                </div>
                <div className="profile-toggle-grid">
                  {[
                    ["messages", "Messages"],
                    ["schedule", "Schedule"],
                    ["academic", "Academic updates"],
                    ["billing", "Payments"],
                    ["system", "System notices"],
                  ].map(([key, label]) => (
                    <label className="profile-toggle" key={key}>
                      <input
                        type="checkbox"
                        checked={
                          draft.notificationPreferences[
                            key as keyof UserNotificationPreferences
                          ]
                        }
                        onChange={event =>
                          updatePreference(
                            key as keyof UserNotificationPreferences,
                            event.target.checked
                          )
                        }
                      />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
              </section>
            ) : null}

            {activeSection === "security" ? (
              <section className="profile-form-card">
                <div className="profile-section-title">
                  <KeyRound size={17} />
                  <div>
                    <span>Security</span>
                    <strong>Password</strong>
                  </div>
                </div>
                {session?.provider === "demo" ? (
                  <div className="profile-security-form">
                    <label>
                      Current password
                      <input
                        type="password"
                        value={passwordDraft.currentPassword}
                        onChange={event =>
                          setPasswordDraft(current => ({
                            ...current,
                            currentPassword: event.target.value,
                          }))
                        }
                      />
                    </label>
                    <label>
                      New password
                      <input
                        type="password"
                        value={passwordDraft.newPassword}
                        onChange={event =>
                          setPasswordDraft(current => ({
                            ...current,
                            newPassword: event.target.value,
                          }))
                        }
                      />
                    </label>
                    <label>
                      Confirm password
                      <input
                        type="password"
                        value={passwordDraft.confirmPassword}
                        onChange={event =>
                          setPasswordDraft(current => ({
                            ...current,
                            confirmPassword: event.target.value,
                          }))
                        }
                      />
                    </label>
                    <button
                      type="button"
                      className="platform-secondary-button"
                      disabled={savingPassword}
                      onClick={changePassword}
                    >
                      {savingPassword ? "Updating" : "Change password"}
                    </button>
                  </div>
                ) : (
                  <div className="profile-provider-note">
                    <ShieldCheck size={18} />
                    <div>
                      <strong>Provider-managed password</strong>
                      <span>
                        Use your sign-in provider to change this account
                        password.
                      </span>
                    </div>
                  </div>
                )}
                {passwordMessage ? (
                  <p className="platform-scheduler-feedback success">
                    {passwordMessage}
                  </p>
                ) : null}
                {passwordError ? (
                  <p className="platform-attendance-error">{passwordError}</p>
                ) : null}
              </section>
            ) : null}

            {profileMessage ? (
              <p className="platform-scheduler-feedback success">
                {profileMessage}
              </p>
            ) : null}
            {profileError ? (
              <p className="platform-attendance-error">{profileError}</p>
            ) : null}
          </div>
        }
      />
    </PlatformShell>
  );
}
