import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactElement,
} from "react";
import {
  ArrowLeft,
  Copy,
  Edit3,
  Eye,
  EyeOff,
  PauseCircle,
  PlayCircle,
  Save,
  ShieldCheck,
} from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";
import PlatformShell from "@/components/platform/PlatformShell";
import { DetailLayout } from "@/components/platform/PlatformLayouts";
import {
  DataTableCard,
  StatusBadge,
} from "@/components/platform/PlatformPrimitives";
import {
  bindNccStaffMoodleRequest,
  cancelNccStaffInvitationRequest,
  disableNccStaffUserRequest,
  enableNccStaffUserRequest,
  fetchNccDirectoryBranchesRequest,
  fetchNccDirectoryCustomFieldsRequest,
  fetchNccDirectoryDepartmentsRequest,
  fetchNccDirectoryUserRequest,
  fetchNccMoodleUsersRequest,
  inviteNccStaffUserRequest,
  patchNccStaffUserRequest,
  resetNccStaffMoodlePasswordRequest,
  resetNccStaffPasswordRequest,
  runPlatformWorkflowActionRequest,
  type NccBranchDto,
  type NccCustomFieldDefinitionDto,
  type NccDepartmentDto,
  type NccMoodleUserDto,
  type NccStaffUserDto,
  type NccStaffUserPatchInput,
} from "@/lib/backend/api";
import { getStoredAuthSession } from "@/lib/auth/session";
import type { PlatformWorkflowAction } from "@/lib/domain/actions";
import { platformStore } from "@/lib/domain/store";
import type { EntityStatus } from "@/lib/domain/types";
import {
  roleMeta,
  roleOrder,
  rolePermissions,
  type Role,
} from "@/lib/platformData";

type AdminUserDetailPageProps = {
  userId?: string;
  view?: UserDetailView;
};

type UserDetailView =
  | "overview"
  | "access"
  | "activity"
  | "related"
  | "assignment";

function isRole(value: unknown): value is Role {
  return typeof value === "string" && value in roleMeta;
}

function safeRole(value: unknown, fallback: Role = "teacher"): Role {
  return isRole(value) ? value : fallback;
}

function statusTone(status: EntityStatus): "green" | "amber" | "slate" {
  if (status === "active") return "green";
  if (status === "pending" || status === "paused") return "amber";
  return "slate";
}

function nccStatusTone(
  status: NccStaffUserDto["status"]
): "green" | "amber" | "slate" {
  if (status === "active") return "green";
  if (status === "invited") return "amber";
  return "slate";
}

function formatNccDate(value: string | null, fallback: string) {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function splitListInput(value: string) {
  return value
    .split(/[,\n]/)
    .map(item => item.trim())
    .filter(Boolean);
}

function formatDate(value?: string) {
  if (!value) return "No recent activity";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No recent activity";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function NccAdminUserDetail({
  user,
  branches,
  departments,
  definitions,
  view,
  reload,
}: {
  user: NccStaffUserDto;
  branches: NccBranchDto[];
  departments: NccDepartmentDto[];
  definitions: NccCustomFieldDefinitionDto[];
  view: UserDetailView;
  reload: () => Promise<void>;
}) {
  const session = getStoredAuthSession();
  const [firstName, setFirstName] = useState(user.firstName);
  const [lastName, setLastName] = useState(user.lastName);
  const [phone, setPhone] = useState(user.phone ?? "");
  const [role, setRole] = useState(user.role);
  const [branchIds, setBranchIds] = useState(user.branchIds);
  const [departmentIds, setDepartmentIds] = useState(
    user.departments.map(department => department.id)
  );
  const [customFields, setCustomFields] = useState(user.customFields);
  const [callerPassword, setCallerPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [oneTime, setOneTime] = useState<{
    label: string;
    value: string;
  } | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [moodleQuery, setMoodleQuery] = useState("");
  const [moodleSearch, setMoodleSearch] = useState<{
    status: "idle" | "loading" | "error" | "ready";
    items: NccMoodleUserDto[];
  }>({ status: "idle", items: [] });
  const [moodleUserId, setMoodleUserId] = useState<number | null>(null);
  const activeBranches = branches.filter(branch => branch.status === "active");
  const activeDepartments = departments.filter(
    department => department.status === "active"
  );
  const roleChanged = role !== user.role;
  const needsStepUp =
    roleChanged && (role === "superadmin" || user.role === "superadmin");
  const isSelf = user.id === session?.userId;
  const basePath = `/app/admin/users/${user.id}`;

  useEffect(
    () => () => {
      setCallerPassword("");
    },
    []
  );

  const fail = (status: number | undefined, message?: string) => {
    setError(
      status === 401
        ? "Your password was not accepted."
        : (message ?? "The EMS account could not be updated.")
    );
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (pending) return;
    if (!firstName.trim() || !lastName.trim()) {
      setError("First and last name are required.");
      return;
    }
    if (needsStepUp && !callerPassword) {
      setError("Your current password is required.");
      return;
    }
    const patch: NccStaffUserPatchInput = {};
    if (
      firstName.trim() !== user.firstName ||
      lastName.trim() !== user.lastName ||
      (phone.trim() || null) !== user.phone
    ) {
      patch.profile = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone.trim() || null,
      };
    }
    if (roleChanged) patch.role = role;
    if (JSON.stringify(branchIds) !== JSON.stringify(user.branchIds)) {
      patch.branchIds = branchIds;
    }
    const originalDepartments = user.departments.map(item => item.id);
    if (
      role === "headofdepartment" &&
      JSON.stringify(departmentIds) !== JSON.stringify(originalDepartments)
    ) {
      patch.departmentIds = departmentIds;
    }
    if (JSON.stringify(customFields) !== JSON.stringify(user.customFields)) {
      patch.customFields = customFields;
    }
    if (needsStepUp) patch.callerPassword = callerPassword;
    setPending(true);
    setError("");
    const response = await patchNccStaffUserRequest(user.id, patch);
    setCallerPassword("");
    setPending(false);
    if (!response.ok) {
      fail(response.status, response.error);
      return;
    }
    toast.success("Access saved");
    await reload();
  };

  const lifecycle = async (action: "disable" | "enable" | "cancel") => {
    if (
      action === "disable" &&
      !window.confirm("They will be signed out immediately.")
    ) {
      return;
    }
    if (action === "cancel" && !window.confirm("Cancel this invitation?")) {
      return;
    }
    setPending(true);
    setError("");
    const response =
      action === "disable"
        ? await disableNccStaffUserRequest(user.id)
        : action === "enable"
          ? await enableNccStaffUserRequest(user.id)
          : await cancelNccStaffInvitationRequest(user.id);
    setPending(false);
    if (!response.ok) {
      fail(response.status, response.error);
      return;
    }
    await reload();
  };

  const resetPassword = async () => {
    if (!window.confirm("Generate a new temporary password?")) return;
    const stepUp =
      user.role === "superadmin"
        ? (window.prompt("Your current password") ?? "")
        : undefined;
    if (user.role === "superadmin" && !stepUp) return;
    setPending(true);
    setError("");
    const response = await resetNccStaffPasswordRequest(user.id, stepUp);
    setPending(false);
    if (!response.ok || !response.data) {
      fail(response.status, response.error);
      return;
    }
    setOneTime({
      label:
        user.status === "canceled"
          ? "Activate with a generated password"
          : "Temporary password",
      value: response.data.oneTime.generatedPassword,
    });
    setRevealed(false);
  };

  const moodleCreate = async () => {
    if (pending) return;
    setPending(true);
    setError("");
    const response = await bindNccStaffMoodleRequest(user.id, {
      mode: "create",
    });
    setPending(false);
    if (!response.ok || !response.data) {
      fail(response.status, response.error);
      return;
    }
    if (response.data.oneTime.generatedMoodlePassword) {
      setOneTime({
        label: "Moodle password",
        value: response.data.oneTime.generatedMoodlePassword,
      });
      setRevealed(false);
    }
    await reload();
  };

  const moodleSearchUsers = async () => {
    const query = moodleQuery.trim();
    if (pending || query.length < 2) return;
    setPending(true);
    setError("");
    setMoodleSearch({ status: "loading", items: [] });
    setMoodleUserId(null);
    const response = await fetchNccMoodleUsersRequest(query);
    setPending(false);
    if (!response.ok || !response.data) {
      setMoodleSearch({ status: "error", items: [] });
      fail(response.status, response.error);
      return;
    }
    setMoodleSearch({ status: "ready", items: response.data.items });
  };

  const moodleLink = async () => {
    if (pending || moodleUserId === null) return;
    setPending(true);
    setError("");
    const response = await bindNccStaffMoodleRequest(user.id, {
      mode: "link",
      moodleUserId,
    });
    setPending(false);
    if (!response.ok) {
      fail(response.status, response.error);
      return;
    }
    setLinkOpen(false);
    setMoodleQuery("");
    setMoodleSearch({ status: "idle", items: [] });
    setMoodleUserId(null);
    await reload();
  };

  const moodleReset = async () => {
    if (!window.confirm("Generate a new Moodle password?")) return;
    setPending(true);
    setError("");
    const response = await resetNccStaffMoodlePasswordRequest(user.id);
    setPending(false);
    if (!response.ok || !response.data) {
      fail(response.status, response.error);
      return;
    }
    setOneTime({
      label: "Moodle password",
      value: response.data.oneTime.generatedMoodlePassword,
    });
    setRevealed(false);
  };

  const resendInvitation = async () => {
    setPending(true);
    setError("");
    const response = await inviteNccStaffUserRequest(user.id);
    setPending(false);
    if (!response.ok || !response.data) {
      fail(response.status, response.error);
      return;
    }
    if (!response.data.oneTime.invitationPath) {
      setError(
        "EMS returned an invitation link we could not translate; resend it from EMS."
      );
      return;
    }
    setOneTime({
      label: "Invitation link",
      value: `${window.location.origin}${response.data.oneTime.invitationPath}`,
    });
    setRevealed(false);
  };

  const toggle = (
    value: string,
    current: string[],
    update: (next: string[]) => void
  ) =>
    update(
      current.includes(value)
        ? current.filter(item => item !== value)
        : [...current, value]
    );

  const renderCustomField = (definition: NccCustomFieldDefinitionDto) => {
    const value = customFields[definition.fieldKey];
    const update = (next: string | number | boolean | null) =>
      setCustomFields(current => ({
        ...current,
        [definition.fieldKey]: next,
      }));
    if (definition.fieldType === "boolean") {
      return (
        <label key={definition.id}>
          <input
            type="checkbox"
            checked={value === true}
            onChange={event => update(event.target.checked)}
          />
          {definition.label}
        </label>
      );
    }
    if (definition.fieldType === "select") {
      return (
        <label key={definition.id}>
          {definition.label}
          <select
            value={typeof value === "string" ? value : ""}
            onChange={event => update(event.target.value)}
          >
            <option value="">Select</option>
            {(definition.options ?? []).map(option => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
      );
    }
    return (
      <label key={definition.id}>
        {definition.label}
        {definition.fieldType === "textarea" ? (
          <textarea
            value={typeof value === "string" ? value : ""}
            onChange={event => update(event.target.value)}
          />
        ) : (
          <input
            type={definition.fieldType}
            value={
              typeof value === "string" || typeof value === "number"
                ? value
                : ""
            }
            onChange={event =>
              update(
                definition.fieldType === "number"
                  ? event.target.value === ""
                    ? null
                    : Number(event.target.value)
                  : event.target.value
              )
            }
          />
        )}
      </label>
    );
  };

  const meta = roleMeta[user.role];
  const branchAccess =
    user.scopeType === "global"
      ? "All branches"
      : branches
          .filter(branch => user.branchIds.includes(branch.id))
          .map(branch => branch.name)
          .join(", ") || "No branch";
  const departmentNames =
    user.departments.map(department => department.name).join(", ") ||
    "No department";
  const header = (
    <section className="admin-access-panel selected-user admin-user-detail-hero">
      <div className="admin-user-detail-identity">
        <span style={{ background: meta.tint, color: meta.color }}>
          {meta.shortLabel}
        </span>
        <div>
          <Link href="/app/admin/users">
            <ArrowLeft size={14} /> Users
          </Link>
          <h2>{user.name}</h2>
          <p>
            {meta.label} · {branchAccess} · {departmentNames}
          </p>
        </div>
      </div>
      <div className="admin-user-detail-actions">
        {view !== "access" ? (
          <Link className="platform-primary-button" href={`${basePath}/access`}>
            <Edit3 size={15} /> Edit access
          </Link>
        ) : null}
        {!isSelf && user.status === "active" ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => void lifecycle("disable")}
          >
            Disable
          </button>
        ) : null}
        {user.status === "disabled" ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => void lifecycle("enable")}
          >
            Enable
          </button>
        ) : null}
        {!isSelf && user.status !== "invited" ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => void resetPassword()}
          >
            Reset password
          </button>
        ) : null}
        {user.status === "invited" ? (
          <>
            <button
              type="button"
              disabled={pending}
              onClick={() => void resendInvitation()}
            >
              Resend invitation
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => void lifecycle("cancel")}
            >
              Cancel invitation
            </button>
          </>
        ) : null}
      </div>
      <dl className="admin-user-detail-facts">
        <div>
          <dt>Status</dt>
          <dd>
            <StatusBadge tone={nccStatusTone(user.status)}>
              {user.status}
            </StatusBadge>
          </dd>
        </div>
        <div>
          <dt>Email</dt>
          <dd>{user.email}</dd>
        </div>
        <div>
          <dt>Branch access</dt>
          <dd>{branchAccess}</dd>
        </div>
        <div>
          <dt>Departments</dt>
          <dd>{departmentNames}</dd>
        </div>
        <div>
          <dt>Moodle account</dt>
          <dd>{user.moodleLinked ? "Linked" : "Not linked"}</dd>
        </div>
        <div>
          <dt>Last sign-in</dt>
          <dd>{formatNccDate(user.lastLoginAt, "Never")}</dd>
        </div>
        <div>
          <dt>Created</dt>
          <dd>{formatNccDate(user.createdAt, "Unknown")}</dd>
        </div>
      </dl>
    </section>
  );

  const access = (
    <form className="admin-user-detail-form" onSubmit={save}>
      <label>
        First name
        <input
          value={firstName}
          onChange={event => setFirstName(event.target.value)}
        />
      </label>
      <label>
        Last name
        <input
          value={lastName}
          onChange={event => setLastName(event.target.value)}
        />
      </label>
      <label>
        Phone
        <input value={phone} onChange={event => setPhone(event.target.value)} />
      </label>
      <label>
        Role
        <select
          value={role}
          onChange={event =>
            setRole(event.target.value as NccStaffUserDto["role"])
          }
        >
          {roleOrder
            .filter(item => item !== "student")
            .map(item => (
              <option key={item} value={item}>
                {roleMeta[item].label}
              </option>
            ))}
        </select>
      </label>
      {roleChanged ? (
        <p role="status">
          Changing the role signs this person out everywhere and replaces their
          access.
        </p>
      ) : null}
      {role !== "superadmin" ? (
        <fieldset>
          <legend>Branch access</legend>
          {activeBranches.map(branch => (
            <label key={branch.id}>
              <input
                type="checkbox"
                checked={branchIds.includes(branch.id)}
                onChange={() => toggle(branch.id, branchIds, setBranchIds)}
              />
              {branch.name}
            </label>
          ))}
        </fieldset>
      ) : null}
      {role === "headofdepartment" ? (
        <fieldset>
          <legend>Departments</legend>
          {activeDepartments.map(department => (
            <label key={department.id}>
              <input
                type="checkbox"
                checked={departmentIds.includes(department.id)}
                onChange={() =>
                  toggle(department.id, departmentIds, setDepartmentIds)
                }
              />
              {department.name}
            </label>
          ))}
        </fieldset>
      ) : null}
      {definitions.map(renderCustomField)}
      {needsStepUp ? (
        <label>
          Your current password
          <input
            type="password"
            autoComplete="current-password"
            value={callerPassword}
            onChange={event => setCallerPassword(event.target.value)}
          />
        </label>
      ) : null}
      {error ? (
        <p className="platform-form-error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="admin-user-detail-form-actions">
        <Link href={basePath}>Cancel</Link>
        <button
          className="platform-primary-button"
          type="submit"
          disabled={pending}
        >
          <Save size={15} /> {pending ? "Saving..." : "Save changes"}
        </button>
      </div>
    </form>
  );

  return (
    <PlatformShell role="superadmin" title={user.name}>
      <DetailLayout
        className="admin-user-detail-page"
        title={view === "access" ? "Access settings" : "Account overview"}
        description="Manage this EMS staff account."
        main={
          <>
            {header}
            <nav
              className="admin-user-detail-tabs"
              aria-label="User detail sections"
            >
              <Link
                href={basePath}
                className={view === "overview" ? "active" : ""}
              >
                Overview
              </Link>
              <Link
                href={`${basePath}/access`}
                className={view === "access" ? "active" : ""}
              >
                Access
              </Link>
            </nav>
            {oneTime ? (
              <section className="admin-users-create-note" role="status">
                <strong>{oneTime.label}</strong>
                <span>{revealed ? oneTime.value : "••••••••••••"}</span>
                <button
                  type="button"
                  onClick={() => setRevealed(value => !value)}
                >
                  {revealed ? <EyeOff size={15} /> : <Eye size={15} />}
                  {revealed ? "Hide" : "Reveal"}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    void navigator.clipboard.writeText(oneTime.value)
                  }
                >
                  <Copy size={15} /> Copy
                </button>
                <small>
                  Shown once. Nile Learn does not store it — share it securely
                  now.
                </small>
              </section>
            ) : null}
            {view === "access" ? (
              access
            ) : (
              <section className="platform-empty-state" role="status">
                <strong>Account changes are managed in EMS</strong>
                <span>
                  Use the Access tab or account actions to update this person.
                </span>
                {!isSelf && user.status !== "canceled" ? (
                  <div className="admin-user-detail-form-actions">
                    {user.moodleLinked ? (
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => void moodleReset()}
                      >
                        Reset Moodle password
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => void moodleCreate()}
                        >
                          Create Moodle account
                        </button>
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => {
                            setLinkOpen(value => !value);
                            setMoodleUserId(null);
                          }}
                        >
                          Link existing account
                        </button>
                      </>
                    )}
                  </div>
                ) : null}
                {linkOpen && !user.moodleLinked ? (
                  <div className="admin-user-detail-form">
                    <label>
                      Search Moodle users
                      <input
                        value={moodleQuery}
                        placeholder="Name, username, or email"
                        onChange={event =>
                          setMoodleQuery(event.target.value)
                        }
                      />
                    </label>
                    <div className="admin-user-detail-form-actions">
                      <button
                        type="button"
                        className="platform-secondary-button"
                        disabled={pending || moodleQuery.trim().length < 2}
                        onClick={() => void moodleSearchUsers()}
                      >
                        Search
                      </button>
                    </div>
                    {moodleSearch.status === "loading" ? (
                      <p role="status">Searching Moodle users...</p>
                    ) : null}
                    {moodleSearch.status === "error" ? (
                      <p role="alert">Moodle users could not be loaded.</p>
                    ) : null}
                    {moodleSearch.status === "ready" &&
                    !moodleSearch.items.length ? (
                      <p role="status">No Moodle users matched.</p>
                    ) : null}
                    {moodleSearch.items.map(item => (
                      <label key={item.id}>
                        <input
                          type="radio"
                          name="moodle-user"
                          checked={moodleUserId === item.id}
                          onChange={() => setMoodleUserId(item.id)}
                        />
                        {item.fullName ??
                          item.username ??
                          item.email ??
                          `Moodle user ${item.id}`}
                      </label>
                    ))}
                    {moodleUserId !== null ? (
                      <div className="admin-user-detail-form-actions">
                        <button
                          type="button"
                          className="platform-primary-button"
                          disabled={pending}
                          onClick={() => void moodleLink()}
                        >
                          Link account
                        </button>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </section>
            )}
            {error && view !== "access" ? (
              <p className="platform-form-error" role="alert">
                {error}
              </p>
            ) : null}
          </>
        }
      />
    </PlatformShell>
  );
}

export default function AdminUserDetailPage({
  userId,
  view = "overview",
}: AdminUserDetailPageProps) {
  const isNccMode = getStoredAuthSession()?.provider === "ncc";
  const [version, setVersion] = useState(0);
  const [editMode, setEditMode] = useState(view === "access");
  const [savingAccess, setSavingAccess] = useState(false);
  const [savingTeacher, setSavingTeacher] = useState(false);
  const [accessError, setAccessError] = useState("");
  const [teacherError, setTeacherError] = useState("");
  const [nccUser, setNccUser] = useState<NccStaffUserDto | null>(null);
  const [nccBranches, setNccBranches] = useState<NccBranchDto[]>([]);
  const [nccDepartments, setNccDepartments] = useState<NccDepartmentDto[]>([]);
  const [nccDefinitions, setNccDefinitions] = useState<
    NccCustomFieldDefinitionDto[]
  >([]);
  const [nccLoading, setNccLoading] = useState(isNccMode);
  const [nccError, setNccError] = useState<{
    message: string;
    status?: number;
  } | null>(null);
  const state = useMemo(() => platformStore.getState(), [version]);
  const refresh = () => setVersion(value => value + 1);
  const loadNccUser = useCallback(async () => {
    if (!userId) {
      setNccLoading(false);
      setNccError({ message: "User not found", status: 404 });
      return;
    }
    setNccLoading(true);
    setNccError(null);
    const [
      userResponse,
      branchesResponse,
      departmentsResponse,
      fieldsResponse,
    ] = await Promise.all([
      fetchNccDirectoryUserRequest(userId),
      fetchNccDirectoryBranchesRequest(),
      fetchNccDirectoryDepartmentsRequest(),
      fetchNccDirectoryCustomFieldsRequest(),
    ]);
    const failedResponse = [
      userResponse,
      branchesResponse,
      departmentsResponse,
      fieldsResponse,
    ].find(response => !response.ok);
    if (failedResponse) {
      setNccUser(null);
      setNccError({
        message:
          failedResponse.error ?? "The EMS staff account could not load.",
        status: failedResponse.status,
      });
      setNccLoading(false);
      return;
    }
    if (
      !userResponse.data ||
      !branchesResponse.data ||
      !departmentsResponse.data ||
      !fieldsResponse.data
    ) {
      setNccUser(null);
      setNccError({ message: "The EMS staff account returned no data." });
      setNccLoading(false);
      return;
    }
    setNccUser(userResponse.data.user);
    setNccBranches(branchesResponse.data.items);
    setNccDepartments(departmentsResponse.data.items);
    setNccDefinitions(fieldsResponse.data.items);
    setNccLoading(false);
  }, [userId]);

  useEffect(() => {
    if (isNccMode) void loadNccUser();
  }, [isNccMode, loadNccUser]);

  const user = state.users.find(item => item.id === userId);
  const [accessDraft, setAccessDraft] = useState({
    activeRole: user?.activeRole ?? "teacher",
    branchId: user?.branchId ?? "",
    departmentId: user?.departmentId ?? "",
    status: user?.status ?? "active",
  });
  const [teacherDraft, setTeacherDraft] = useState({
    courseRunId: "",
    departmentId: "",
    specialties: "",
    availability: "",
  });

  const branch = state.branches.find(item => item.id === user?.branchId);
  const department = state.departments.find(
    item => item.id === user?.departmentId
  );
  const activeRole = safeRole(user?.activeRole);
  const role = roleMeta[activeRole];
  const staffProfile = user
    ? (state.staffProfiles.find(
        profile =>
          profile.userId === user.id && profile.role === user.activeRole
      ) ?? state.staffProfiles.find(profile => profile.userId === user.id))
    : undefined;
  const teacherProfile = user
    ? state.teachers.find(teacher => teacher.userId === user.id)
    : undefined;
  const isTeacherAccount = Boolean(
    user && (user.activeRole === "teacher" || user.roles.includes("teacher"))
  );
  const studentProfile = user
    ? state.students.find(student => student.userId === user.id)
    : undefined;
  const permissions =
    state.permissions[user?.activeRole ?? "teacher"] ??
    rolePermissions[user?.activeRole ?? "teacher"] ??
    [];
  const activityRows = user
    ? state.auditLogs
        .filter(
          audit =>
            audit.entityId === user.id ||
            audit.actorId === user.id ||
            audit.summary.includes(user.name)
        )
        .slice(0, 8)
    : [];
  const teacherRuns = user
    ? state.courseRuns.filter(run => run.teacherId === user.id)
    : [];
  const teacherRunIds = new Set(teacherRuns.map(run => run.id));
  const teacherClasses = state.classGroups.filter(group =>
    teacherRunIds.has(group.courseRunId)
  );
  const studentEnrollments = studentProfile
    ? state.enrollments.filter(
        enrollment => enrollment.studentId === studentProfile.id
      )
    : [];
  const studentClassIds = new Set(
    studentEnrollments.map(enrollment => enrollment.classGroupId)
  );
  const studentClasses = state.classGroups.filter(group =>
    studentClassIds.has(group.id)
  );
  const selectedRun =
    state.courseRuns.find(run => run.id === teacherDraft.courseRunId) ??
    teacherRuns.find(
      run => run.status === "active" || run.status === "pending"
    ) ??
    state.courseRuns.find(
      run =>
        (run.status === "active" || run.status === "pending") &&
        (!user?.branchId || user.branchId === run.branchId)
    );
  const selectedCourse = state.courses.find(
    course => course.id === selectedRun?.courseId
  );
  const selectedProgram = state.programs.find(
    program => program.id === selectedCourse?.programId
  );
  const assignableDepartments = state.departments.filter(item => {
    if (!selectedRun) return item.id === user?.departmentId;
    const branchMatches =
      item.branchIds.includes(selectedRun.branchId) ||
      selectedRun.branchId === "br_global";
    const programMatches =
      !selectedProgram || selectedProgram.departmentId === item.id;
    return branchMatches && programMatches;
  });
  const assignableClasses = state.classGroups.filter(
    group => group.courseRunId === selectedRun?.id
  );
  const previousTeacher = state.users.find(
    item => item.id === selectedRun?.teacherId
  );

  if (isNccMode) {
    if (nccLoading) {
      return (
        <PlatformShell role="superadmin" title="User">
          <DetailLayout
            className="admin-user-detail-page"
            title="Account overview"
            description="Read identity and school scope from EMS."
            main={
              <section className="platform-empty-state" role="status">
                <strong>Loading user from EMS</strong>
              </section>
            }
          />
        </PlatformShell>
      );
    }

    if (nccError?.status === 404) {
      return (
        <PlatformShell role="superadmin" title="User not found">
          <DetailLayout
            className="admin-user-detail-page"
            title="User not found"
            description="This account could not be found in the Nile Learn directory."
            actions={
              <Link
                className="platform-secondary-button"
                href="/app/admin/users"
              >
                <ArrowLeft size={15} />
                Back to users
              </Link>
            }
            main={
              <section className="platform-empty-state">
                <strong>No matching user</strong>
                <span>
                  Return to the users list and open a current account.
                </span>
              </section>
            }
          />
        </PlatformShell>
      );
    }

    if (nccError?.status === 503) {
      return (
        <PlatformShell role="superadmin" title="User">
          <DetailLayout
            className="admin-user-detail-page"
            title="Account overview"
            description="Read identity and school scope from EMS."
            main={
              <section className="platform-empty-state" role="status">
                <strong>
                  The EMS staff directory is not connected in this environment
                  yet.
                </strong>
              </section>
            }
          />
        </PlatformShell>
      );
    }

    if (nccError || !nccUser) {
      return (
        <PlatformShell role="superadmin" title="User">
          <DetailLayout
            className="admin-user-detail-page"
            title="Account overview"
            description="Read identity and school scope from EMS."
            main={
              <section className="platform-empty-state" role="alert">
                <strong>User could not be loaded from EMS</strong>
                <span>
                  {nccError?.message ??
                    "The EMS staff account returned no data."}
                </span>
                <button
                  type="button"
                  className="platform-secondary-button"
                  onClick={() => void loadNccUser()}
                >
                  Retry
                </button>
              </section>
            }
          />
        </PlatformShell>
      );
    }

    return (
      <NccAdminUserDetail
        user={nccUser}
        branches={nccBranches}
        departments={nccDepartments}
        definitions={nccDefinitions}
        view={view === "access" ? "access" : "overview"}
        reload={loadNccUser}
      />
    );
  }

  const updateUserAccess = async (
    action: Extract<PlatformWorkflowAction, { type: "user.update" }>,
    successMessage: string
  ) => {
    if (savingAccess) return;
    setSavingAccess(true);
    setAccessError("");
    const response = await runPlatformWorkflowActionRequest(action);
    setSavingAccess(false);
    if (!response.ok || !response.data) {
      const message = response.error ?? "User access could not be updated.";
      setAccessError(message);
      toast.error("User update failed", { description: message });
      return;
    }
    platformStore.setState(response.data.state);
    refresh();
    setEditMode(false);
    toast.success(successMessage);
  };

  const toggleStatus = () => {
    if (!user) return;
    const nextStatus: EntityStatus =
      user.status === "active" ? "paused" : "active";
    void updateUserAccess(
      {
        type: "user.update",
        userId: user.id,
        activeRole: user.activeRole,
        roles: user.roles,
        branchId: user.branchId,
        departmentId: user.departmentId,
        status: nextStatus,
      },
      `User ${nextStatus === "active" ? "activated" : "paused"}`
    );
  };

  const saveAccess = (event: FormEvent) => {
    event.preventDefault();
    if (!user) return;
    const roleValue = safeRole(accessDraft.activeRole, user.activeRole);
    const roles = user.roles.includes(roleValue)
      ? user.roles
      : [...user.roles, roleValue];
    void updateUserAccess(
      {
        type: "user.update",
        userId: user.id,
        activeRole: roleValue,
        roles,
        branchId: accessDraft.branchId,
        departmentId: accessDraft.departmentId,
        status: accessDraft.status,
      },
      "User access saved"
    );
  };

  const assignTeacher = async (event: FormEvent) => {
    event.preventDefault();
    if (!user || safeRole(user.activeRole) !== "teacher") {
      setTeacherError(
        "Select a teacher account before assigning a course run."
      );
      return;
    }
    const courseRunId = teacherDraft.courseRunId || selectedRun?.id;
    const departmentId =
      teacherDraft.departmentId ||
      teacherProfile?.departmentId ||
      user.departmentId ||
      "";
    if (!courseRunId || !departmentId) {
      setTeacherError("Choose a course run and department.");
      return;
    }
    setSavingTeacher(true);
    setTeacherError("");
    const response = await runPlatformWorkflowActionRequest({
      type: "teacher.assign",
      userId: user.id,
      courseRunId,
      departmentId,
      specialties: splitListInput(teacherDraft.specialties),
      availability: splitListInput(teacherDraft.availability),
    });
    setSavingTeacher(false);
    if (!response.ok || !response.data) {
      const message =
        response.error ?? "Teacher assignment could not be saved.";
      setTeacherError(message);
      toast.error("Teacher assignment failed", { description: message });
      return;
    }
    platformStore.setState(response.data.state);
    refresh();
    toast.success("Teacher assignment saved");
  };

  if (!user) {
    return (
      <PlatformShell role="superadmin" title="User not found">
        <DetailLayout
          className="admin-user-detail-page"
          title="User not found"
          description="This account could not be found in the Nile Learn directory."
          actions={
            <Link className="platform-secondary-button" href="/app/admin/users">
              <ArrowLeft size={15} />
              Back to users
            </Link>
          }
          main={
            <section className="platform-empty-state">
              <strong>No matching user</strong>
              <span>Return to the users list and open a current account.</span>
            </section>
          }
        />
      </PlatformShell>
    );
  }

  const baseUserPath = `/app/admin/users/${user.id}`;
  const sections: Array<{ id: UserDetailView; label: string; href: string }> = [
    { id: "overview", label: "Overview", href: baseUserPath },
    { id: "access", label: "Access", href: `${baseUserPath}/access` },
    { id: "activity", label: "Activity", href: `${baseUserPath}/activity` },
    {
      id: "related",
      label: "Related records",
      href: `${baseUserPath}/related`,
    },
  ];

  if (isTeacherAccount) {
    sections.push({
      id: "assignment",
      label: "Teacher assignment",
      href: `${baseUserPath}/assignment`,
    });
  }

  const activeView =
    view === "assignment" && !isTeacherAccount ? "related" : view;
  const tabMeta: Record<
    UserDetailView,
    { title: string; description: string }
  > = {
    overview: {
      title: "Account overview",
      description: "Read identity, contact, role, and school scope.",
    },
    access: {
      title: "Access settings",
      description: "Update this user's role, branch, department, or status.",
    },
    activity: {
      title: "Account activity",
      description: "Review recent changes for this account.",
    },
    related: {
      title: "Related records",
      description: "Review assigned classes and connected work.",
    },
    assignment: {
      title: "Teacher assignment",
      description: "Assign this teacher to one course run.",
    },
  };

  const headerActions =
    activeView === "access" ? (
      <>
        <Link className="platform-secondary-button" href={baseUserPath}>
          Overview
        </Link>
        <button
          type="button"
          className="platform-secondary-button"
          onClick={toggleStatus}
          disabled={savingAccess}
        >
          {user.status === "active" ? (
            <PauseCircle size={15} />
          ) : (
            <PlayCircle size={15} />
          )}
          {user.status === "active" ? "Pause" : "Activate"}
        </button>
      </>
    ) : (
      <>
        <Link
          className="platform-primary-button"
          href={`${baseUserPath}/access`}
        >
          <Edit3 size={15} />
          Edit access
        </Link>
        <Link
          className="platform-secondary-button"
          href={`${baseUserPath}/activity`}
        >
          Activity
        </Link>
      </>
    );

  const header = (
    <section
      className="admin-access-panel selected-user admin-user-detail-hero"
      aria-busy={savingAccess}
    >
      <div className="admin-user-detail-identity">
        <span style={{ background: role.tint, color: role.color }}>
          {role.shortLabel}
        </span>
        <div>
          <Link href="/app/admin/users">
            <ArrowLeft size={14} />
            Users
          </Link>
          <h2>{user.name}</h2>
          <p>
            {role.label} · {branch?.name ?? "No branch"} ·{" "}
            {department?.name ?? "No department"}
          </p>
        </div>
      </div>
      <div className="admin-user-detail-actions">{headerActions}</div>
      <dl className="admin-user-detail-facts">
        <div>
          <dt>Status</dt>
          <dd>
            <StatusBadge tone={statusTone(user.status)}>
              {user.status}
            </StatusBadge>
          </dd>
        </div>
        <div>
          <dt>Email</dt>
          <dd>{user.email}</dd>
        </div>
        <div>
          <dt>Branch</dt>
          <dd>{branch?.name ?? "No branch"}</dd>
        </div>
        <div>
          <dt>Department</dt>
          <dd>{department?.name ?? "No department"}</dd>
        </div>
      </dl>
    </section>
  );

  const nav = (
    <nav className="admin-user-detail-tabs" aria-label="User detail sections">
      {sections.map(section => (
        <Link
          key={section.id}
          href={section.href}
          className={activeView === section.id ? "active" : ""}
        >
          {section.label}
        </Link>
      ))}
    </nav>
  );

  const overview = (
    <section className="admin-user-detail-overview">
      <section className="admin-user-detail-overview-section">
        <h2>Contact information</h2>
        <dl className="admin-user-detail-list">
          <div>
            <dt>Email</dt>
            <dd>{user.email}</dd>
          </div>
          <div>
            <dt>Phone</dt>
            <dd>{user.phone ?? "Not added"}</dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>{user.status}</dd>
          </div>
        </dl>
      </section>
      <section className="admin-user-detail-overview-section">
        <h2>Role summary</h2>
        <dl className="admin-user-detail-list">
          <div>
            <dt>Primary role</dt>
            <dd>{role.label}</dd>
          </div>
          <div>
            <dt>Assigned roles</dt>
            <dd>{user.roles.map(item => roleMeta[item].label).join(", ")}</dd>
          </div>
          <div>
            <dt>Access level</dt>
            <dd>{staffProfile?.permissionScope ?? "Role default"}</dd>
          </div>
        </dl>
      </section>
      <section className="admin-user-detail-overview-section">
        <h2>School scope</h2>
        <dl className="admin-user-detail-list">
          <div>
            <dt>Branch</dt>
            <dd>{branch?.name ?? "No branch"}</dd>
          </div>
          <div>
            <dt>Department</dt>
            <dd>{department?.name ?? "No department"}</dd>
          </div>
          <div>
            <dt>Operational scope</dt>
            <dd>
              {staffProfile?.operationalScope.join(", ") || "No special scope"}
            </dd>
          </div>
        </dl>
      </section>
    </section>
  );

  const access = (
    <div className="admin-user-detail-grid">
      <section className="admin-user-detail-section">
        <h2>Access summary</h2>
        <dl className="admin-user-detail-list">
          <div>
            <dt>Role</dt>
            <dd>{role.label}</dd>
          </div>
          <div>
            <dt>Branch</dt>
            <dd>{branch?.name ?? "No branch"}</dd>
          </div>
          <div>
            <dt>Department</dt>
            <dd>{department?.name ?? "No department"}</dd>
          </div>
          <div>
            <dt>Access rules</dt>
            <dd>{permissions.length} role rules</dd>
          </div>
        </dl>
        <details className="admin-user-detail-disclosure">
          <summary>Advanced access rules</summary>
          <ul>
            {permissions.map(permission => (
              <li key={permission}>{permission.replace(/_/g, " ")}</li>
            ))}
          </ul>
        </details>
      </section>
      <section className="admin-user-detail-section">
        <h2>Edit access</h2>
        {editMode || activeView === "access" ? (
          <form className="admin-user-detail-form" onSubmit={saveAccess}>
            <label>
              Role
              <select
                value={accessDraft.activeRole}
                onChange={event =>
                  setAccessDraft(current => ({
                    ...current,
                    activeRole: safeRole(event.target.value),
                  }))
                }
              >
                {roleOrder.map(item => (
                  <option key={item} value={item}>
                    {roleMeta[item].label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Branch
              <select
                value={accessDraft.branchId}
                onChange={event =>
                  setAccessDraft(current => ({
                    ...current,
                    branchId: event.target.value,
                  }))
                }
              >
                {state.branches.map(item => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Department
              <select
                value={accessDraft.departmentId}
                onChange={event =>
                  setAccessDraft(current => ({
                    ...current,
                    departmentId: event.target.value,
                  }))
                }
              >
                {state.departments.map(item => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Status
              <select
                value={accessDraft.status}
                onChange={event =>
                  setAccessDraft(current => ({
                    ...current,
                    status: event.target.value as EntityStatus,
                  }))
                }
              >
                <option value="active">Active</option>
                <option value="pending">Pending</option>
                <option value="paused">Paused</option>
                <option value="archived">Archived</option>
              </select>
            </label>
            {accessError ? (
              <p className="platform-form-error">{accessError}</p>
            ) : null}
            <div className="admin-user-detail-form-actions">
              <Link href={baseUserPath}>Cancel</Link>
              <button
                type="submit"
                className="platform-primary-button"
                disabled={savingAccess}
              >
                <Save size={15} />
                {savingAccess ? "Saving..." : "Save changes"}
              </button>
            </div>
          </form>
        ) : (
          <div className="admin-user-detail-edit-placeholder">
            <ShieldCheck size={18} />
            <span>
              Use Edit access to update role, branch, department, or status.
            </span>
          </div>
        )}
      </section>
    </div>
  );

  const activity = (
    <DataTableCard
      title="Activity"
      subtitle={`${activityRows.length} recent records`}
      className="admin-user-detail-activity"
    >
      <div className="admin-user-detail-activity-list">
        {activityRows.map(audit => (
          <article key={audit.id}>
            <div>
              <strong>{audit.summary}</strong>
              <small>
                {audit.action.replace(/_/g, " ")} ·{" "}
                {formatDate(audit.createdAt)}
              </small>
            </div>
          </article>
        ))}
        {!activityRows.length ? (
          <div className="platform-empty-state">
            <strong>No activity yet</strong>
            <span>Changes made to this user will appear here.</span>
          </div>
        ) : null}
      </div>
    </DataTableCard>
  );

  const related = (
    <div className="admin-user-detail-grid">
      <section className="admin-user-detail-section">
        <h2>{isTeacherAccount ? "Assigned classes" : "Assigned work"}</h2>
        {isTeacherAccount ? (
          <div className="admin-user-detail-related-list">
            {teacherClasses.slice(0, 5).map(group => {
              const run = state.courseRuns.find(
                item => item.id === group.courseRunId
              );
              const course = state.courses.find(
                item => item.id === run?.courseId
              );
              return (
                <article key={group.id}>
                  <strong>{group.name}</strong>
                  <span>
                    {course?.title ?? "Course"} · {group.studentIds.length}{" "}
                    students
                  </span>
                </article>
              );
            })}
            {!teacherClasses.length ? (
              <span>No assigned classes yet.</span>
            ) : null}
          </div>
        ) : studentProfile ? (
          <div className="admin-user-detail-related-list">
            {studentClasses.map(group => (
              <article key={group.id}>
                <strong>{group.name}</strong>
                <span>{group.schedule}</span>
              </article>
            ))}
            {!studentClasses.length ? (
              <span>No current class assignments.</span>
            ) : null}
          </div>
        ) : (
          <p>
            {staffProfile?.operationalScope.join(", ") ||
              "No related class or student records for this role."}
          </p>
        )}
      </section>
    </div>
  );

  const assignment = (
    <div className="admin-user-detail-grid">
      <section className="admin-user-detail-section">
        <h2>Course run assignment</h2>
        {isTeacherAccount ? (
          <form
            className="admin-access-teacher-assignment-form admin-user-detail-form"
            onSubmit={assignTeacher}
          >
            <label>
              Course run
              <select
                value={teacherDraft.courseRunId || selectedRun?.id || ""}
                onChange={event =>
                  setTeacherDraft(current => ({
                    ...current,
                    courseRunId: event.target.value,
                  }))
                }
              >
                {state.courseRuns
                  .filter(
                    run => run.status === "active" || run.status === "pending"
                  )
                  .map(run => {
                    const course = state.courses.find(
                      item => item.id === run.courseId
                    );
                    const runBranch = state.branches.find(
                      item => item.id === run.branchId
                    );
                    return (
                      <option key={run.id} value={run.id}>
                        {course?.title ?? run.id} · {run.term} ·{" "}
                        {runBranch?.name ?? "Branch"}
                      </option>
                    );
                  })}
              </select>
            </label>
            <label>
              Department
              <select
                value={
                  teacherDraft.departmentId ||
                  teacherProfile?.departmentId ||
                  user.departmentId ||
                  ""
                }
                onChange={event =>
                  setTeacherDraft(current => ({
                    ...current,
                    departmentId: event.target.value,
                  }))
                }
              >
                {assignableDepartments.map(item => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Subjects / specialties
              <textarea
                value={teacherDraft.specialties}
                onChange={event =>
                  setTeacherDraft(current => ({
                    ...current,
                    specialties: event.target.value,
                  }))
                }
                placeholder={
                  teacherProfile?.specialties.join(", ") || "Arabic grammar"
                }
              />
            </label>
            <label>
              Availability
              <textarea
                value={teacherDraft.availability}
                onChange={event =>
                  setTeacherDraft(current => ({
                    ...current,
                    availability: event.target.value,
                  }))
                }
                placeholder="Fri 09:00, Fri 10:30"
              />
            </label>
            <div className="admin-user-detail-assignment-summary">
              <span>
                {previousTeacher?.name ?? "No teacher"} currently assigned
              </span>
              <span>{assignableClasses.length} class group(s)</span>
            </div>
            {teacherError ? (
              <p className="platform-form-error">{teacherError}</p>
            ) : null}
            <div className="admin-user-detail-form-actions">
              <Link href={`${baseUserPath}/related`}>Cancel</Link>
              <button
                type="submit"
                className="platform-primary-button"
                disabled={savingTeacher}
              >
                {savingTeacher ? "Saving..." : "Save teacher assignment"}
              </button>
            </div>
          </form>
        ) : (
          <div className="platform-empty-state">
            <strong>Not a teacher account</strong>
            <span>Teacher assignment is available only for teacher users.</span>
          </div>
        )}
      </section>
    </div>
  );

  const contentByView: Record<UserDetailView, ReactElement> = {
    overview,
    access,
    activity,
    related,
    assignment,
  };

  return (
    <PlatformShell role="superadmin" title={user.name}>
      <DetailLayout
        className="admin-user-detail-page"
        title={tabMeta[activeView].title}
        description={tabMeta[activeView].description}
        actions={
          <Link className="platform-secondary-button" href="/app/admin/users">
            <ArrowLeft size={15} />
            Back to users
          </Link>
        }
        main={
          <>
            {header}
            {nav}
            <div className="admin-user-detail-tab-panel">
              {contentByView[activeView]}
            </div>
          </>
        }
      />
    </PlatformShell>
  );
}
