import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Copy,
  Eye,
  EyeOff,
  Search,
  UserPlus,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";
import PlatformShell from "@/components/platform/PlatformShell";
import {
  FormFlowLayout,
  WorkspaceLayout,
} from "@/components/platform/PlatformLayouts";
import {
  DataTableCard,
  StatusBadge,
} from "@/components/platform/PlatformPrimitives";
import {
  createNccStaffUserRequest,
  createUserInvitationRequest,
  fetchNccDirectoryBranchesRequest,
  fetchNccDirectoryCustomFieldsRequest,
  fetchNccDirectoryDepartmentsRequest,
  fetchNccDirectoryUsersRequest,
  runPlatformWorkflowActionRequest,
  type NccBranchDto,
  type NccCustomFieldDefinitionDto,
  type NccDepartmentDto,
  type NccStaffUserDto,
} from "@/lib/backend/api";
import { getStoredAuthSession } from "@/lib/auth/session";
import { platformStore } from "@/lib/domain/store";
import type {
  EntityStatus,
  StaffAvailabilityStatus,
  StaffPermissionScope,
  StaffRole,
} from "@/lib/domain/types";
import { roleMeta, roleOrder, type Role } from "@/lib/platformData";

const staffRoleOptions = roleOrder.filter(
  (role): role is StaffRole => role !== "student"
);

const staffRoleDefaults: Record<
  StaffRole,
  {
    branchId: string;
    departmentId: string;
    permissionScope: StaffPermissionScope;
    subjects: string;
    teachingLevels: string;
    availabilityStatus: StaffAvailabilityStatus;
    operationalScope: string;
  }
> = {
  teacher: {
    branchId: "br_online",
    departmentId: "dep_arabic",
    permissionScope: "department",
    subjects: "Arabic grammar, Tajweed",
    teachingLevels: "Arabic Level 3",
    availabilityStatus: "available",
    operationalScope: "classes, attendance, grading",
  },
  registrar: {
    branchId: "br_cairo",
    departmentId: "dep_admissions",
    permissionScope: "admissions",
    subjects: "",
    teachingLevels: "",
    availabilityStatus: "not_applicable",
    operationalScope: "leads, placement, enrollments, payments",
  },
  headofdepartment: {
    branchId: "br_global",
    departmentId: "dep_arabic",
    permissionScope: "department",
    subjects: "",
    teachingLevels: "Arabic Language, Quran and Tajweed",
    availabilityStatus: "not_applicable",
    operationalScope: "curriculum, teachers, certificates, reports",
  },
  branchadmin: {
    branchId: "br_cairo",
    departmentId: "dep_operations",
    permissionScope: "operations",
    subjects: "",
    teachingLevels: "",
    availabilityStatus: "not_applicable",
    operationalScope: "rooms, schedule, attendance, payments",
  },
  superadmin: {
    branchId: "br_global",
    departmentId: "dep_platform",
    permissionScope: "global",
    subjects: "",
    teachingLevels: "",
    availabilityStatus: "not_applicable",
    operationalScope: "users, roles, permissions, audit",
  },
};

type AdminUsersPageProps = {
  mode?: "list" | "create";
};

type CreateStep = 0 | 1 | 2 | 3;

const createSteps = [
  "Role",
  "Basic information",
  "Scope and profile",
  "Review",
];

const createRoleOptions: Array<{
  role: Role;
  label: string;
  description: string;
}> = [
  {
    role: "student",
    label: "Student",
    description: "Students are created through admissions and enrollment.",
  },
  {
    role: "teacher",
    label: "Teacher",
    description: "Can teach classes, mark attendance, and review work.",
  },
  {
    role: "registrar",
    label: "Registrar",
    description: "Can manage admissions, placement, enrollment, and payments.",
  },
  {
    role: "headofdepartment",
    label: "HOD",
    description: "Can manage academic quality, curriculum, and approvals.",
  },
  {
    role: "branchadmin",
    label: "Branch Admin",
    description: "Can manage local branch operations.",
  },
  {
    role: "superadmin",
    label: "Super Admin",
    description: "Can manage the whole platform.",
  },
];

function splitListInput(value: string) {
  return value
    .split(/[,\n]/)
    .map(item => item.trim())
    .filter(Boolean);
}

function isRole(value: unknown): value is Role {
  return typeof value === "string" && value in roleMeta;
}

function safeRole(value: unknown, fallback: Role = "teacher"): Role {
  return isRole(value) ? value : fallback;
}

function safeStaffRole(
  value: unknown,
  fallback: StaffRole = "teacher"
): StaffRole {
  const role = safeRole(value, fallback);
  return role === "student" ? fallback : role;
}

function formatActivity(value?: string) {
  if (!value) return "No recent activity";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No recent activity";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
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

function formatNccActivity(value: string | null) {
  return value ? formatActivity(value) : "Never";
}

function roleInitials(role: Role) {
  return roleMeta[role].label
    .split(/\s+/)
    .map(word => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function compactEmail(email: string) {
  const [name, domain] = email.split("@");
  if (!domain) return email;
  const shortName = name.length > 22 ? `${name.slice(0, 19)}...` : name;
  return `${shortName}@${domain}`;
}

function NccAdminUserCreatePage() {
  const [step, setStep] = useState<CreateStep>(0);
  const [role, setRole] = useState<StaffRole>("teacher");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [branchIds, setBranchIds] = useState<string[]>([]);
  const [departmentIds, setDepartmentIds] = useState<string[]>([]);
  const [customFields, setCustomFields] = useState<
    Record<string, string | number | boolean | null>
  >({});
  const [provisioning, setProvisioning] = useState<"invitation" | "manual">(
    "invitation"
  );
  const [callerPassword, setCallerPassword] = useState("");
  const [branches, setBranches] = useState<NccBranchDto[]>([]);
  const [departments, setDepartments] = useState<NccDepartmentDto[]>([]);
  const [definitions, setDefinitions] = useState<
    NccCustomFieldDefinitionDto[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [errorStatus, setErrorStatus] = useState<number>();
  const [revealed, setRevealed] = useState(false);
  const [result, setResult] = useState<{
    user: NccStaffUserDto;
    secret: string | null;
    kind: "password" | "invitation";
    unparseable: boolean;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [branchesResult, departmentsResult, fieldsResult] =
        await Promise.all([
          fetchNccDirectoryBranchesRequest(),
          fetchNccDirectoryDepartmentsRequest(),
          fetchNccDirectoryCustomFieldsRequest(),
        ]);
      if (cancelled) return;
      const failed = [branchesResult, departmentsResult, fieldsResult].find(
        response => !response.ok
      );
      if (
        failed ||
        !branchesResult.data ||
        !departmentsResult.data ||
        !fieldsResult.data
      ) {
        setError(failed?.error ?? "EMS account options could not be loaded.");
        setErrorStatus(failed?.status);
        setLoading(false);
        return;
      }
      setBranches(
        branchesResult.data.items.filter(branch => branch.status === "active")
      );
      setDepartments(
        departmentsResult.data.items.filter(
          department => department.status === "active"
        )
      );
      setDefinitions(
        [...fieldsResult.data.items].sort((a, b) => a.sortOrder - b.sortOrder)
      );
      setLoading(false);
    })();
    return () => {
      cancelled = true;
      setCallerPassword("");
    };
  }, []);

  const toggle = (
    value: string,
    current: string[],
    update: (value: string[]) => void
  ) => {
    update(
      current.includes(value)
        ? current.filter(item => item !== value)
        : [...current, value]
    );
  };

  const validateStep = () => {
    setError("");
    setErrorStatus(undefined);
    if (step === 1) {
      if (!firstName.trim()) {
        setError("First name is required.");
        return false;
      }
      if (!lastName.trim()) {
        setError("Last name is required.");
        return false;
      }
      if (!email.trim() || !email.includes("@")) {
        setError("A valid email is required.");
        return false;
      }
    }
    if (step === 2) {
      if (
        ["teacher", "registrar", "headofdepartment"].includes(role) &&
        branchIds.length === 0
      ) {
        setError("Choose at least one branch.");
        return false;
      }
      if (role === "headofdepartment" && departmentIds.length === 0) {
        setError("Choose at least one department.");
        return false;
      }
      const missing = definitions.find(definition => {
        if (!definition.isRequired) return false;
        const value = customFields[definition.fieldKey];
        return value === undefined || value === null || value === "";
      });
      if (missing) {
        setError(`${missing.label} is required.`);
        return false;
      }
    }
    if (step === 3 && role === "superadmin" && !callerPassword) {
      setError("Your current password is required.");
      return false;
    }
    return true;
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (pending || !validateStep()) return;
    if (step < 3) {
      setStep(current => (current + 1) as CreateStep);
      return;
    }
    setPending(true);
    const response = await createNccStaffUserRequest({
      email: email.trim(),
      role,
      provisioning,
      profile: {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone.trim() || undefined,
      },
      branchIds: role === "superadmin" ? undefined : branchIds,
      departmentIds: role === "headofdepartment" ? departmentIds : undefined,
      customFields,
      callerPassword: role === "superadmin" ? callerPassword : undefined,
    });
    setCallerPassword("");
    setPending(false);
    if (!response.ok || !response.data) {
      setErrorStatus(response.status);
      setError(
        response.status === 409
          ? "This email already has an EMS account."
          : response.status === 401
            ? "Your password was not accepted."
            : response.error ?? "The EMS account could not be created."
      );
      return;
    }
    const invitationPath = response.data.oneTime.invitationPath;
    setResult({
      user: response.data.user,
      secret:
        provisioning === "manual"
          ? response.data.oneTime.generatedPassword
          : invitationPath
            ? `${window.location.origin}${invitationPath}`
            : null,
      kind: provisioning === "manual" ? "password" : "invitation",
      unparseable: response.data.oneTime.invitationUrlUnparseable,
    });
    setFirstName("");
    setLastName("");
    setEmail("");
    setPhone("");
    setBranchIds([]);
    setDepartmentIds([]);
    setCustomFields({});
    setStep(0);
  };

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
          {definition.helpText ? <small>{definition.helpText}</small> : null}
        </label>
      );
    }
    if (definition.fieldType === "textarea") {
      return (
        <label key={definition.id}>
          {definition.label}
          <textarea
            value={typeof value === "string" ? value : ""}
            onChange={event => update(event.target.value)}
          />
          {definition.helpText ? <small>{definition.helpText}</small> : null}
        </label>
      );
    }
    return (
      <label key={definition.id}>
        {definition.label}
        <input
          type={definition.fieldType}
          value={
            typeof value === "string" || typeof value === "number" ? value : ""
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
        {definition.helpText ? <small>{definition.helpText}</small> : null}
      </label>
    );
  };

  if (loading) {
    return (
      <PlatformShell role="superadmin" title="Create user">
        <FormFlowLayout
          title="Create user"
          description="Create one EMS staff account."
          main={
            <section className="platform-empty-state" role="status">
              <strong>Loading account options from EMS</strong>
            </section>
          }
        />
      </PlatformShell>
    );
  }

  if (result) {
    const userMeta = roleMeta[result.user.role];
    return (
      <PlatformShell role="superadmin" title="Create user">
        <FormFlowLayout
          title="Account created"
          description="Share the one-time credential securely."
          main={
            <section className="admin-users-create-card">
              <div className="admin-users-create-success">
                <span style={{ background: userMeta.tint, color: userMeta.color }}>
                  {userMeta.shortLabel}
                </span>
                <strong>{result.user.name}</strong>
                <span>{result.user.email}</span>
                <div className="admin-users-create-note" role="status">
                  <strong>
                    {result.kind === "password"
                      ? "Temporary password"
                      : "Invitation link"}
                  </strong>
                  {result.secret ? (
                    <span>{revealed ? result.secret : "••••••••••••"}</span>
                  ) : (
                    <span>
                      EMS returned an invitation link we could not translate;
                      resend it from the user page.
                    </span>
                  )}
                  {result.secret ? (
                    <div className="admin-users-create-actions">
                      <button type="button" onClick={() => setRevealed(value => !value)}>
                        {revealed ? <EyeOff size={15} /> : <Eye size={15} />}
                        {revealed ? "Hide" : "Reveal"}
                      </button>
                      <button
                        type="button"
                        onClick={() => void navigator.clipboard.writeText(result.secret!)}
                      >
                        <Copy size={15} /> Copy
                      </button>
                    </div>
                  ) : null}
                  <small>
                    Shown once. Nile Learn does not store it — share it securely
                    now.
                  </small>
                </div>
                <div className="admin-users-create-actions">
                  <Link
                    className="platform-primary-button"
                    href={`/app/admin/users/${result.user.id}`}
                  >
                    Open user
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      setResult(null);
                      setRevealed(false);
                    }}
                  >
                    Create another
                  </button>
                  <Link href="/app/admin/users">Back to users</Link>
                </div>
              </div>
            </section>
          }
        />
      </PlatformShell>
    );
  }

  return (
    <PlatformShell role="superadmin" title="Create user">
      <FormFlowLayout
        className="admin-users-create-page"
        title="Create user"
        description="Create one EMS staff account and assign its access."
        actions={
          <Link className="platform-secondary-button" href="/app/admin/users">
            <ArrowLeft size={15} /> Back to users
          </Link>
        }
        main={
          <section className="admin-users-create-card">
            <div className="admin-users-create-shell">
              <nav className="admin-users-create-steps" aria-label="Create user steps">
                {["Role", "Basic information", "Access", "Provisioning & review"].map(
                  (label, index) => (
                    <button
                      key={label}
                      type="button"
                      className={
                        index === step ? "active" : index < step ? "complete" : ""
                      }
                      onClick={() => {
                        if (index < step) setStep(index as CreateStep);
                      }}
                    >
                      <span>{index + 1}</span>
                      {label}
                    </button>
                  )
                )}
              </nav>
              <form
                className="admin-access-form admin-access-guided-form admin-users-simple-form admin-users-step-form"
                onSubmit={submit}
              >
                {step === 0 ? (
                  <div className="admin-users-role-grid" role="radiogroup" aria-label="Role">
                    {staffRoleOptions.map(value => (
                      <button
                        key={value}
                        type="button"
                        role="radio"
                        aria-checked={role === value}
                        className={role === value ? "active" : ""}
                        onClick={() => {
                          setRole(value);
                          setBranchIds([]);
                          setDepartmentIds([]);
                        }}
                      >
                        <strong>{roleMeta[value].label}</strong>
                      </button>
                    ))}
                  </div>
                ) : null}
                {step === 1 ? (
                  <>
                    <label>
                      First name
                      <input value={firstName} onChange={event => setFirstName(event.target.value)} />
                    </label>
                    <label>
                      Last name
                      <input value={lastName} onChange={event => setLastName(event.target.value)} />
                    </label>
                    <label>
                      Email
                      <input type="email" value={email} onChange={event => setEmail(event.target.value)} />
                    </label>
                    <label>
                      Phone
                      <input value={phone} onChange={event => setPhone(event.target.value)} />
                    </label>
                  </>
                ) : null}
                {step === 2 ? (
                  <>
                    {role === "superadmin" ? (
                      <div className="admin-users-create-confirmation">
                        <strong>Global access to every branch</strong>
                      </div>
                    ) : (
                      <fieldset>
                        <legend>Branch access</legend>
                        {branches.map(branch => (
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
                    )}
                    {role === "headofdepartment" ? (
                      <fieldset>
                        <legend>Departments</legend>
                        {departments.map(department => (
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
                  </>
                ) : null}
                {step === 3 ? (
                  <>
                    <fieldset>
                      <legend>Provisioning</legend>
                      <label>
                        <input
                          type="radio"
                          checked={provisioning === "invitation"}
                          onChange={() => setProvisioning("invitation")}
                        />
                        Send an invitation link
                      </label>
                      <label>
                        <input
                          type="radio"
                          checked={provisioning === "manual"}
                          onChange={() => setProvisioning("manual")}
                        />
                        Generate a password now
                      </label>
                    </fieldset>
                    <div className="admin-users-create-review">
                      <div><span>Role</span><strong>{roleMeta[role].label}</strong></div>
                      <div><span>Name</span><strong>{firstName} {lastName}</strong></div>
                      <div><span>Email</span><strong>{email}</strong></div>
                      <div><span>Branches</span><strong>{role === "superadmin" ? "All branches" : branchIds.length}</strong></div>
                    </div>
                    {role === "superadmin" ? (
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
                  </>
                ) : null}
                {error ? (
                  <div className="platform-form-error" role="alert">
                    {error}
                    {errorStatus === 409 ? (
                      <Link href="/app/admin/users">Search the user directory</Link>
                    ) : null}
                  </div>
                ) : null}
                <div className="admin-users-create-actions">
                  {step > 0 ? (
                    <button type="button" onClick={() => setStep(current => (current - 1) as CreateStep)}>
                      Back
                    </button>
                  ) : null}
                  <button type="submit" className="platform-primary-button" disabled={pending}>
                    <UserPlus size={15} />
                    {step < 3 ? "Continue" : pending ? "Creating..." : "Create account"}
                  </button>
                </div>
              </form>
            </div>
          </section>
        }
      />
    </PlatformShell>
  );
}

export default function AdminUsersPage({ mode = "list" }: AdminUsersPageProps) {
  const isNccMode = getStoredAuthSession()?.provider === "ncc";
  const [version, setVersion] = useState(0);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [branchFilter, setBranchFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [createStep, setCreateStep] = useState<CreateStep>(0);
  const [selectedCreateRole, setSelectedCreateRole] = useState<Role>("teacher");
  const [globalAccessConfirmed, setGlobalAccessConfirmed] = useState(false);
  const [createSuccess, setCreateSuccess] = useState<{
    id: string;
    name: string;
    role: StaffRole;
    delivery: "created" | "invited";
  } | null>(null);
  const [creatingAccount, setCreatingAccount] = useState(false);
  const [createAccountError, setCreateAccountError] = useState("");
  const [nccUsers, setNccUsers] = useState<NccStaffUserDto[]>([]);
  const [nccBranches, setNccBranches] = useState<NccBranchDto[]>([]);
  const [nccDepartments, setNccDepartments] = useState<NccDepartmentDto[]>([]);
  const [nccLoading, setNccLoading] = useState(isNccMode);
  const [nccError, setNccError] = useState<{
    message: string;
    status?: number;
  } | null>(null);
  const [, navigate] = useLocation();
  const [newUser, setNewUser] = useState({
    name: "",
    email: "",
    phone: "",
    role: "teacher" as StaffRole,
    branchId: staffRoleDefaults.teacher.branchId,
    departmentId: staffRoleDefaults.teacher.departmentId,
    status: "active" as EntityStatus,
    permissionScope: staffRoleDefaults.teacher.permissionScope,
    subjects: staffRoleDefaults.teacher.subjects,
    teachingLevels: staffRoleDefaults.teacher.teachingLevels,
    availabilityStatus: staffRoleDefaults.teacher.availabilityStatus,
    operationalScope: staffRoleDefaults.teacher.operationalScope,
    notes: "",
  });

  const state = useMemo(() => platformStore.getState(), [version]);
  const normalizedInvitationsEnabled =
    import.meta.env.VITE_NILE_NORMALIZED_INVITATIONS_ENABLED === "1";
  const refresh = () => setVersion(value => value + 1);
  const draftRoleMeta = roleMeta[newUser.role];
  const branchOptions = state.branches;
  const statusOptions = Array.from(
    new Set(state.users.map(user => user.status))
  ).sort();
  const loadNccDirectory = useCallback(async () => {
    setNccLoading(true);
    setNccError(null);
    const [usersResponse, branchesResponse, departmentsResponse] =
      await Promise.all([
        fetchNccDirectoryUsersRequest(),
        fetchNccDirectoryBranchesRequest(),
        fetchNccDirectoryDepartmentsRequest(),
      ]);
    const failedResponse = [
      usersResponse,
      branchesResponse,
      departmentsResponse,
    ].find(response => !response.ok);
    if (failedResponse) {
      setNccError({
        message: failedResponse.error ?? "The EMS staff directory could not load.",
        status: failedResponse.status,
      });
      setNccLoading(false);
      return;
    }
    if (
      !usersResponse.data ||
      !branchesResponse.data ||
      !departmentsResponse.data
    ) {
      setNccError({ message: "The EMS staff directory returned no data." });
      setNccLoading(false);
      return;
    }
    setNccUsers(usersResponse.data.items);
    setNccBranches(branchesResponse.data.items);
    setNccDepartments(departmentsResponse.data.items);
    setNccLoading(false);
  }, []);

  useEffect(() => {
    if (isNccMode) void loadNccDirectory();
  }, [isNccMode, loadNccDirectory]);

  const nccVisibleUsers = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return nccUsers.filter(user => {
      const branchNames = nccBranches
        .filter(
          branch =>
            user.scopeType === "global" || user.branchIds.includes(branch.id)
        )
        .map(branch => branch.name);
      const departmentNames = nccDepartments
        .filter(department =>
          user.departments.some(item => item.id === department.id)
        )
        .map(department => department.name);
      const text = `${user.name} ${user.email} ${roleMeta[user.role].label} ${branchNames.join(" ")} ${departmentNames.join(" ")}`.toLowerCase();
      return (
        text.includes(normalizedQuery) &&
        (roleFilter === "all" || user.role === roleFilter) &&
        (branchFilter === "all" ||
          user.scopeType === "global" ||
          user.branchIds.includes(branchFilter)) &&
        (statusFilter === "all" || user.status === statusFilter)
      );
    });
  }, [
    branchFilter,
    nccBranches,
    nccDepartments,
    nccUsers,
    query,
    roleFilter,
    statusFilter,
  ]);

  const visibleUsers = state.users.filter(user => {
    const branch = state.branches.find(item => item.id === user.branchId);
    const department = state.departments.find(
      item => item.id === user.departmentId
    );
    const text =
      `${user.name} ${user.email} ${user.activeRole} ${branch?.name ?? ""} ${department?.name ?? ""}`.toLowerCase();
    return (
      text.includes(query.toLowerCase()) &&
      (roleFilter === "all" || user.activeRole === roleFilter) &&
      (branchFilter === "all" || user.branchId === branchFilter) &&
      (statusFilter === "all" || user.status === statusFilter)
    );
  });

  const activityByUser = useMemo(() => {
    const activity = new Map<string, string>();
    state.staffProfiles.forEach(profile => {
      const value = profile.updatedAt ?? profile.createdAt;
      if (value) activity.set(profile.userId, value);
    });
    state.auditLogs.forEach(audit => {
      const relatedUser = state.users.find(
        user =>
          audit.entityId === user.id ||
          audit.actorId === user.id ||
          audit.summary.includes(user.name)
      );
      if (!relatedUser) return;
      const existing = activity.get(relatedUser.id);
      if (
        !existing ||
        new Date(audit.createdAt).getTime() > new Date(existing).getTime()
      ) {
        activity.set(relatedUser.id, audit.createdAt);
      }
    });
    return activity;
  }, [state.auditLogs, state.staffProfiles, state.users]);

  if (isNccMode && mode === "create") {
    return <NccAdminUserCreatePage />;
  }

  if (isNccMode) {
    const branchAccess = (user: NccStaffUserDto) => {
      if (user.scopeType === "global") return "All branches";
      const names = nccBranches
        .filter(branch => user.branchIds.includes(branch.id))
        .map(branch => branch.name);
      return names.join(", ") || "No branch";
    };
    const toolbar = (
      <div
        className="admin-users-simple-toolbar"
        aria-label="User directory filters"
      >
        <label className="admin-users-simple-search-field">
          <span>Search</span>
          <span className="platform-toolbar-search admin-users-simple-search">
            <Search size={15} />
            <input
              aria-label="Search users"
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder="Search by name, email, role, branch"
            />
          </span>
        </label>
        <label>
          <span>Role</span>
          <select
            value={roleFilter}
            onChange={event => setRoleFilter(event.target.value)}
          >
            <option value="all">All roles</option>
            {staffRoleOptions.map(role => (
              <option key={role} value={role}>
                {roleMeta[role].label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Branch</span>
          <select
            value={branchFilter}
            onChange={event => setBranchFilter(event.target.value)}
          >
            <option value="all">All branches</option>
            {nccBranches.map(branch => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Status</span>
          <select
            value={statusFilter}
            onChange={event => setStatusFilter(event.target.value)}
          >
            <option value="all">All status</option>
            {(["invited", "active", "disabled", "canceled"] as const).map(
              status => (
                <option key={status} value={status}>
                  {status}
                </option>
              )
            )}
          </select>
        </label>
      </div>
    );
    const directory = nccLoading ? (
      <div className="platform-empty-state" role="status">
        <strong>Loading users from EMS</strong>
      </div>
    ) : nccError?.status === 503 || nccError?.status === 404 ? (
      <div className="platform-empty-state" role="status">
        <strong>
          The EMS staff directory is not connected in this environment yet.
        </strong>
      </div>
    ) : nccError ? (
      <div className="platform-empty-state" role="alert">
        <strong>Users could not be loaded from EMS</strong>
        <span>{nccError.message}</span>
        <button
          type="button"
          className="platform-secondary-button"
          onClick={() => void loadNccDirectory()}
        >
          Retry
        </button>
      </div>
    ) : (
      <DataTableCard
        title="User directory · EMS"
        subtitle={`${nccVisibleUsers.length} people`}
        className="admin-users-simple-card"
      >
        {nccVisibleUsers.length ? (
          <div className="admin-users-simple-table-wrap">
            <table>
              <thead>
                <tr>
                  <th className="admin-users-col-name" scope="col">
                    User
                  </th>
                  <th className="admin-users-col-role" scope="col">
                    Role
                  </th>
                  <th className="admin-users-col-branch" scope="col">
                    Branch access
                  </th>
                  <th className="admin-users-col-department" scope="col">
                    Departments
                  </th>
                  <th className="admin-users-col-status" scope="col">
                    Status
                  </th>
                  <th className="admin-users-col-activity" scope="col">
                    Last sign-in
                  </th>
                  <th className="admin-users-col-actions" scope="col">
                    <span className="platform-sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {nccVisibleUsers.map(user => {
                  const userMeta = roleMeta[user.role];
                  return (
                    <tr key={user.id} data-testid={`admin-user-row-${user.id}`}>
                      <td>
                        <Link
                          className="admin-users-simple-person"
                          href={`/app/admin/users/${user.id}`}
                          aria-label={`Open ${user.name}`}
                        >
                          <span
                            style={{
                              background: userMeta.tint,
                              color: userMeta.color,
                            }}
                          >
                            {roleInitials(user.role)}
                          </span>
                          <span>
                            <strong>{user.name}</strong>
                            <small title={user.email}>
                              {compactEmail(user.email)}
                            </small>
                          </span>
                        </Link>
                      </td>
                      <td>{userMeta.label}</td>
                      <td>{branchAccess(user)}</td>
                      <td>
                        {user.departments.map(item => item.name).join(", ") ||
                          "—"}
                      </td>
                      <td>
                        <StatusBadge tone={nccStatusTone(user.status)}>
                          {user.status}
                        </StatusBadge>
                      </td>
                      <td>{formatNccActivity(user.lastLoginAt)}</td>
                      <td>
                        <div className="platform-row-actions">
                          <Link
                            className="simple-portal-row-action admin-users-open-link"
                            href={`/app/admin/users/${user.id}`}
                            aria-label={`Open ${user.name}`}
                          >
                            <span>Open</span>
                            <ArrowRight size={14} aria-hidden="true" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="platform-empty-state">
            <strong>No users found</strong>
            <span>Try a different search or clear one of the filters.</span>
          </div>
        )}
      </DataTableCard>
    );

    return (
      <PlatformShell role="superadmin" title="Users">
        <WorkspaceLayout
          className="admin-users-simple-page"
          title="Users"
          description="Manage people who can access Nile Learn."
          actions={
            <Link className="platform-primary-button" href="/app/admin/users/new">
              <UserPlus size={15} />
              Create user
            </Link>
          }
          toolbar={!nccLoading && !nccError ? toolbar : undefined}
          main={directory}
        />
      </PlatformShell>
    );
  }

  const applyRoleDefaults = (roleValue: unknown) => {
    const role = safeStaffRole(roleValue);
    const defaults = staffRoleDefaults[role];
    setNewUser(current => ({
      ...current,
      role,
      branchId: defaults.branchId,
      departmentId: defaults.departmentId,
      permissionScope: defaults.permissionScope,
      subjects: defaults.subjects,
      teachingLevels: defaults.teachingLevels,
      availabilityStatus: defaults.availabilityStatus,
      operationalScope: defaults.operationalScope,
    }));
  };

  const selectCreateRole = (role: Role) => {
    setSelectedCreateRole(role);
    setCreateAccountError("");
    setCreateSuccess(null);
    if (role !== "student") {
      applyRoleDefaults(role);
      setGlobalAccessConfirmed(role !== "superadmin");
    }
  };

  const validateCreateStep = (step: CreateStep) => {
    setCreateAccountError("");
    if (step === 0) {
      if (selectedCreateRole === "student") {
        setCreateAccountError(
          "Create students from the registrar student intake flow."
        );
        return false;
      }
      return true;
    }
    if (step === 1) {
      const name = newUser.name.trim();
      const email = newUser.email.trim().toLowerCase();
      if (!name || !email) {
        setCreateAccountError("Full name and email are required.");
        return false;
      }
      if (!email.includes("@")) {
        setCreateAccountError("Enter a valid email address.");
        return false;
      }
      if (state.users.some(user => user.email.toLowerCase() === email)) {
        setCreateAccountError("This email is already in the user directory.");
        return false;
      }
      return true;
    }
    if (step === 2) {
      const selectedBranch = state.branches.find(
        branch => branch.id === newUser.branchId
      );
      const selectedDepartment = state.departments.find(
        department => department.id === newUser.departmentId
      );
      if (!selectedBranch || !selectedDepartment) {
        setCreateAccountError("Choose a valid branch and department.");
        return false;
      }
      if (
        !selectedDepartment.branchIds.includes(selectedBranch.id) &&
        selectedBranch.id !== "br_global"
      ) {
        setCreateAccountError(
          "Selected department is not available in the chosen branch."
        );
        return false;
      }
      if (
        newUser.role === "teacher" &&
        !splitListInput(newUser.subjects).length
      ) {
        setCreateAccountError("Add at least one subject for this teacher.");
        return false;
      }
      if (
        newUser.role === "teacher" &&
        !splitListInput(newUser.teachingLevels).length
      ) {
        setCreateAccountError(
          "Add at least one teaching level for this teacher."
        );
        return false;
      }
      if (
        newUser.role === "registrar" &&
        newUser.permissionScope !== "admissions"
      ) {
        setCreateAccountError("Registrar accounts need admissions scope.");
        return false;
      }
      if (
        newUser.role === "headofdepartment" &&
        newUser.permissionScope !== "department"
      ) {
        setCreateAccountError("HOD accounts need department scope.");
        return false;
      }
      if (newUser.role === "superadmin" && !globalAccessConfirmed) {
        setCreateAccountError(
          "Confirm global access before creating a super admin."
        );
        return false;
      }
    }
    return true;
  };

  const moveCreateStep = (direction: "next" | "back") => {
    if (direction === "back") {
      setCreateAccountError("");
      setCreateStep(step => Math.max(0, step - 1) as CreateStep);
      return;
    }
    if (!validateCreateStep(createStep)) return;
    setCreateStep(step => Math.min(3, step + 1) as CreateStep);
  };

  const addUser = async (event: FormEvent) => {
    event.preventDefault();
    if (creatingAccount) return;
    if (!validateCreateStep(2)) return;
    const name = newUser.name.trim();
    const email = newUser.email.trim().toLowerCase();
    const phone = newUser.phone.trim();
    setCreateAccountError("");
    if (!name || !email) {
      const message = "Full name and email are required";
      setCreateAccountError(message);
      toast.error(message);
      return;
    }
    if (!email.includes("@")) {
      const message = "Enter a valid email address";
      setCreateAccountError(message);
      toast.error(message);
      return;
    }
    if (state.users.some(user => user.email.toLowerCase() === email)) {
      const message = "This email is already in the identity directory";
      setCreateAccountError(message);
      toast.error(message);
      return;
    }
    const selectedBranch = state.branches.find(
      branch => branch.id === newUser.branchId
    );
    const selectedDepartment = state.departments.find(
      department => department.id === newUser.departmentId
    );
    if (!selectedBranch || !selectedDepartment) {
      const message = "Choose a valid branch and department";
      setCreateAccountError(message);
      toast.error(message);
      return;
    }
    if (
      !selectedDepartment.branchIds.includes(selectedBranch.id) &&
      selectedBranch.id !== "br_global"
    ) {
      const message =
        "Selected department is not available in the chosen branch";
      setCreateAccountError(message);
      toast.error(message);
      return;
    }
    if (
      newUser.role === "teacher" &&
      !splitListInput(newUser.subjects).length
    ) {
      const message = "Add at least one subject taught by the teacher";
      setCreateAccountError(message);
      toast.error(message);
      return;
    }
    if (
      newUser.role === "teacher" &&
      !splitListInput(newUser.teachingLevels).length
    ) {
      const message = "Add at least one teaching level for the teacher";
      setCreateAccountError(message);
      toast.error(message);
      return;
    }
    if (
      newUser.role === "branchadmin" &&
      !splitListInput(newUser.operationalScope).length
    ) {
      const message = "Add at least one branch operation scope";
      setCreateAccountError(message);
      toast.error(message);
      return;
    }
    if (
      newUser.role === "registrar" &&
      newUser.permissionScope !== "admissions"
    ) {
      const message = "Registrar accounts require admissions access level";
      setCreateAccountError(message);
      toast.error(message);
      return;
    }
    if (
      newUser.role === "headofdepartment" &&
      newUser.permissionScope !== "department"
    ) {
      const message = "HOD accounts require department access level";
      setCreateAccountError(message);
      toast.error(message);
      return;
    }
    if (newUser.role === "superadmin" && newUser.permissionScope !== "global") {
      const message = "Super admin accounts require global access level";
      setCreateAccountError(message);
      toast.error(message);
      return;
    }
    if (newUser.role === "superadmin" && !globalAccessConfirmed) {
      const message = "Confirm global access before creating a super admin";
      setCreateAccountError(message);
      toast.error(message);
      return;
    }
    setCreatingAccount(true);
    if (normalizedInvitationsEnabled) {
      const response = await createUserInvitationRequest({
        fullName: name,
        email,
        phone: phone || undefined,
        role: newUser.role,
        branchRef: newUser.role === "superadmin" ? undefined : newUser.branchId,
        departmentRef:
          newUser.role === "teacher" || newUser.role === "headofdepartment"
            ? newUser.departmentId
            : undefined,
        title: draftRoleMeta.label,
        availabilityStatus: newUser.availabilityStatus,
        subjects: splitListInput(newUser.subjects),
        teachingLevels: splitListInput(newUser.teachingLevels),
        locale: window.localStorage.getItem("nilelearn.locale") ?? "en",
        idempotencyKey: `user-invite:${crypto.randomUUID()}`,
      });
      setCreatingAccount(false);
      if (!response.ok || !response.data) {
        const message = response.error ?? "Invitation could not be queued.";
        setCreateAccountError(message);
        toast.error("Invitation failed", { description: message });
        return;
      }
      setCreateSuccess({
        id: response.data.invitation.userId,
        name,
        role: newUser.role,
        delivery: "invited",
      });
      toast.success(
        response.data.delivery === "dispatched"
          ? "Invitation email sent"
          : "Account invitation queued",
        {
          description:
            response.data.delivery === "dispatched"
              ? `${name} can now verify the email and choose a password.`
              : `${name}'s invitation is stored for automatic email retry.`,
        }
      );
      return;
    }
    const response = await runPlatformWorkflowActionRequest({
      type: "staff.user.create",
      name,
      email,
      phone: phone || undefined,
      role: newUser.role,
      branchId: newUser.branchId,
      departmentId: newUser.departmentId,
      status: newUser.status,
      permissionScope: newUser.permissionScope,
      subjects: splitListInput(newUser.subjects),
      teachingLevels: splitListInput(newUser.teachingLevels),
      availabilityStatus: newUser.availabilityStatus,
      operationalScope: splitListInput(newUser.operationalScope),
      notes: newUser.notes.trim() || undefined,
    });
    setCreatingAccount(false);
    if (!response.ok || !response.data) {
      const message = response.error ?? "Account could not be created.";
      setCreateAccountError(message);
      toast.error("Account creation failed", { description: message });
      return;
    }
    platformStore.setState(response.data.state);
    const created = response.data.result.result as
      | {
          user?: {
            id: string;
            name: string;
            activeRole: StaffRole;
          };
          relationshipSummary?: string;
        }
      | undefined;
    const id = created?.user?.id ?? response.data.result.entityId;
    setCreateSuccess({
      id,
      name: created?.user?.name ?? name,
      role: created?.user?.activeRole ?? newUser.role,
      delivery: "created",
    });
    const defaults = staffRoleDefaults.teacher;
    setNewUser({
      name: "",
      email: "",
      phone: "",
      role: "teacher",
      branchId: defaults.branchId,
      departmentId: defaults.departmentId,
      status: "active",
      permissionScope: defaults.permissionScope,
      subjects: defaults.subjects,
      teachingLevels: defaults.teachingLevels,
      availabilityStatus: defaults.availabilityStatus,
      operationalScope: defaults.operationalScope,
      notes: "",
    });
    refresh();
    toast.success("Account created and connected", {
      description:
        created?.relationshipSummary ??
        `${draftRoleMeta.label} account created.`,
    });
    window.setTimeout(() => navigate(`/app/admin/users/${id}`), 700);
  };

  const toolbar = (
    <div
      className="admin-users-simple-toolbar"
      aria-label="User directory filters"
    >
      <label className="admin-users-simple-search-field">
        <span>Search</span>
        <span className="platform-toolbar-search admin-users-simple-search">
          <Search size={15} />
          <input
            aria-label="Search users"
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Search by name, email, role, branch"
          />
        </span>
      </label>
      <label>
        <span>Role</span>
        <select
          value={roleFilter}
          onChange={event => setRoleFilter(event.target.value)}
        >
          <option value="all">All roles</option>
          {roleOrder.map(role => (
            <option key={role} value={role}>
              {roleMeta[role].label}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>Branch</span>
        <select
          value={branchFilter}
          onChange={event => setBranchFilter(event.target.value)}
        >
          <option value="all">All branches</option>
          {branchOptions.map(branch => (
            <option key={branch.id} value={branch.id}>
              {branch.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>Status</span>
        <select
          value={statusFilter}
          onChange={event => setStatusFilter(event.target.value)}
        >
          <option value="all">All status</option>
          {statusOptions.map(status => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </label>
    </div>
  );

  const usersTable = (
    <DataTableCard
      title="User directory"
      subtitle={`${visibleUsers.length} people`}
      className="admin-users-simple-card"
    >
      {visibleUsers.length ? (
        <div className="admin-users-simple-table-wrap">
          <table>
            <thead>
              <tr>
                <th className="admin-users-col-name" scope="col">
                  User
                </th>
                <th className="admin-users-col-role" scope="col">
                  Role
                </th>
                <th className="admin-users-col-branch" scope="col">
                  Branch
                </th>
                <th className="admin-users-col-department" scope="col">
                  Department
                </th>
                <th className="admin-users-col-status" scope="col">
                  Status
                </th>
                <th className="admin-users-col-activity" scope="col">
                  Last activity
                </th>
                <th className="admin-users-col-actions" scope="col">
                  <span className="platform-sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {visibleUsers.map(user => {
                const branch = state.branches.find(
                  item => item.id === user.branchId
                );
                const department = state.departments.find(
                  item => item.id === user.departmentId
                );
                const userMeta = roleMeta[safeRole(user.activeRole)];
                return (
                  <tr key={user.id} data-testid={`admin-user-row-${user.id}`}>
                    <td>
                      <Link
                        className="admin-users-simple-person"
                        href={`/app/admin/users/${user.id}`}
                        aria-label={`Open ${user.name}`}
                      >
                        <span
                          style={{
                            background: userMeta.tint,
                            color: userMeta.color,
                          }}
                        >
                          {roleInitials(safeRole(user.activeRole))}
                        </span>
                        <span>
                          <strong>{user.name}</strong>
                          <small title={user.email}>
                            {compactEmail(user.email)}
                          </small>
                        </span>
                      </Link>
                    </td>
                    <td>{userMeta.label}</td>
                    <td>{branch?.name ?? "Not set"}</td>
                    <td>{department?.name ?? "Not set"}</td>
                    <td>
                      <StatusBadge tone={statusTone(user.status)}>
                        {user.status}
                      </StatusBadge>
                    </td>
                    <td>{formatActivity(activityByUser.get(user.id))}</td>
                    <td>
                      <div className="platform-row-actions">
                        <Link
                          className="simple-portal-row-action admin-users-open-link"
                          href={`/app/admin/users/${user.id}`}
                          aria-label={`Open ${user.name}`}
                        >
                          <span>Open</span>
                          <ArrowRight size={14} aria-hidden="true" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="platform-empty-state">
          <strong>No users found</strong>
          <span>Try a different search or clear one of the filters.</span>
        </div>
      )}
    </DataTableCard>
  );

  const scopeStep = (
    <>
      {newUser.role === "teacher" ? (
        <>
          <label>
            Branch
            <select
              value={newUser.branchId}
              onChange={event =>
                setNewUser(current => ({
                  ...current,
                  branchId: event.target.value,
                }))
              }
            >
              {state.branches.map(branch => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Department
            <select
              value={newUser.departmentId}
              onChange={event =>
                setNewUser(current => ({
                  ...current,
                  departmentId: event.target.value,
                }))
              }
            >
              {state.departments.map(department => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Subjects
            <textarea
              value={newUser.subjects}
              onChange={event =>
                setNewUser(current => ({
                  ...current,
                  subjects: event.target.value,
                }))
              }
              placeholder="Arabic grammar, Tajweed"
            />
          </label>
          <label>
            Teaching levels
            <textarea
              value={newUser.teachingLevels}
              onChange={event =>
                setNewUser(current => ({
                  ...current,
                  teachingLevels: event.target.value,
                }))
              }
              placeholder="Arabic Level 3"
            />
          </label>
        </>
      ) : null}
      {newUser.role === "registrar" ? (
        <>
          <label>
            Branch
            <select
              value={newUser.branchId}
              onChange={event =>
                setNewUser(current => ({
                  ...current,
                  branchId: event.target.value,
                }))
              }
            >
              {state.branches.map(branch => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Access level
            <select
              value={newUser.permissionScope}
              onChange={event =>
                setNewUser(current => ({
                  ...current,
                  permissionScope: event.target.value as StaffPermissionScope,
                }))
              }
            >
              <option value="admissions">Admissions</option>
            </select>
          </label>
        </>
      ) : null}
      {newUser.role === "headofdepartment" ? (
        <>
          <label>
            Department
            <select
              value={newUser.departmentId}
              onChange={event =>
                setNewUser(current => ({
                  ...current,
                  departmentId: event.target.value,
                }))
              }
            >
              {state.departments.map(department => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Branch access
            <select
              value={newUser.branchId}
              onChange={event =>
                setNewUser(current => ({
                  ...current,
                  branchId: event.target.value,
                }))
              }
            >
              {state.branches.map(branch => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
          </label>
        </>
      ) : null}
      {newUser.role === "branchadmin" ? (
        <label>
          Branch
          <select
            value={newUser.branchId}
            onChange={event =>
              setNewUser(current => ({
                ...current,
                branchId: event.target.value,
              }))
            }
          >
            {state.branches
              .filter(branch => branch.id !== "br_global")
              .map(branch => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
          </select>
        </label>
      ) : null}
      {newUser.role === "superadmin" ? (
        <div className="admin-users-create-confirmation">
          <strong>Global access</strong>
          <span>
            This account can manage users, roles, school structure, reports, and
            settings across Nile Learn.
          </span>
          <label>
            <input
              type="checkbox"
              checked={globalAccessConfirmed}
              onChange={event => setGlobalAccessConfirmed(event.target.checked)}
            />
            I understand this account has global access.
          </label>
        </div>
      ) : null}
    </>
  );

  const createReviewItems = [
    ["Role", draftRoleMeta.label],
    ["Name", newUser.name || "Not added"],
    ["Email", newUser.email || "Not added"],
    ["Phone", newUser.phone || "Optional"],
    [
      "Branch",
      state.branches.find(branch => branch.id === newUser.branchId)?.name ??
        "Global",
    ],
    [
      "Department",
      state.departments.find(
        department => department.id === newUser.departmentId
      )?.name ?? "Global",
    ],
    [
      "Account activation",
      normalizedInvitationsEnabled
        ? "Email verification and password setup"
        : "Compatibility mode - no verification email",
    ],
  ];

  const createForm = (
    <section className="admin-users-create-card">
      {createSuccess ? (
        <div className="admin-users-create-success">
          <CheckCircle2 size={28} />
          <strong>
            {createSuccess.name}{" "}
            {createSuccess.delivery === "invited"
              ? "was invited"
              : "was created"}
          </strong>
          <span>
            {createSuccess.delivery === "invited"
              ? "The account stays pending until the email is verified and its owner chooses a password."
              : "Opening the user detail page now."}
          </span>
          {createSuccess.delivery === "created" ? (
            <Link
              className="platform-primary-button"
              href={`/app/admin/users/${createSuccess.id}`}
            >
              Open user detail
            </Link>
          ) : (
            <Link className="platform-primary-button" href="/app/admin/users">
              Return to users
            </Link>
          )}
        </div>
      ) : (
        <div className="admin-users-create-shell">
          <nav
            className="admin-users-create-steps"
            aria-label="Create user steps"
          >
            {createSteps.map((step, index) => (
              <button
                key={step}
                type="button"
                className={
                  index === createStep
                    ? "active"
                    : index < createStep
                      ? "complete"
                      : ""
                }
                onClick={() => {
                  if (index < createStep) {
                    setCreateStep(index as CreateStep);
                    setCreateAccountError("");
                  }
                }}
              >
                <span>{index + 1}</span>
                {step}
              </button>
            ))}
          </nav>
          <form
            className="admin-access-form admin-access-guided-form admin-users-simple-form admin-users-step-form"
            onSubmit={event => {
              event.preventDefault();
              if (createStep < 3) {
                moveCreateStep("next");
                return;
              }
              void addUser(event);
            }}
          >
            <div className="admin-users-step-head">
              <span>Step {createStep + 1} of 4</span>
              <strong>{createSteps[createStep]}</strong>
            </div>
            {createStep === 0 ? (
              <div
                className="admin-users-role-grid"
                role="radiogroup"
                aria-label="Role"
              >
                {createRoleOptions.map(option => (
                  <button
                    key={option.role}
                    type="button"
                    className={
                      selectedCreateRole === option.role ? "active" : ""
                    }
                    onClick={() => selectCreateRole(option.role)}
                    role="radio"
                    aria-checked={selectedCreateRole === option.role}
                  >
                    <strong>{option.label}</strong>
                    <span>{option.description}</span>
                  </button>
                ))}
                {selectedCreateRole === "student" ? (
                  <div className="admin-users-create-note">
                    <strong>Student accounts use admissions</strong>
                    <span>
                      Create students from registrar student intake so
                      enrollment, course, and payment records stay connected.
                    </span>
                    <Link href="/app/registrar/students">
                      Open student intake
                    </Link>
                  </div>
                ) : null}
              </div>
            ) : null}
            {createStep === 1 ? (
              <>
                <label>
                  Full name
                  <input
                    value={newUser.name}
                    onChange={event =>
                      setNewUser(current => ({
                        ...current,
                        name: event.target.value,
                      }))
                    }
                    placeholder="e.g. Mariam Hassan"
                  />
                </label>
                <label>
                  Email
                  <input
                    type="email"
                    value={newUser.email}
                    onChange={event =>
                      setNewUser(current => ({
                        ...current,
                        email: event.target.value,
                      }))
                    }
                    placeholder="name@nilelearn.local"
                  />
                </label>
                <label>
                  Phone / WhatsApp
                  <input
                    value={newUser.phone}
                    onChange={event =>
                      setNewUser(current => ({
                        ...current,
                        phone: event.target.value,
                      }))
                    }
                    placeholder="+20 ..."
                  />
                </label>
              </>
            ) : null}
            {createStep === 2 ? scopeStep : null}
            {createStep === 3 ? (
              <div className="admin-users-create-review">
                {createReviewItems.map(([label, value]) => (
                  <div key={label}>
                    <span>{label}</span>
                    <strong>{value}</strong>
                  </div>
                ))}
                <p>
                  {draftRoleMeta.label} access will be created with the selected
                  school scope.
                </p>
                <div
                  className="admin-users-create-note"
                  role="status"
                  data-mode={
                    normalizedInvitationsEnabled
                      ? "invitation"
                      : "compatibility"
                  }
                >
                  <strong>
                    {normalizedInvitationsEnabled
                      ? "Email verification is active"
                      : "Email verification is not active"}
                  </strong>
                  <span>
                    {normalizedInvitationsEnabled
                      ? "The user receives a verification link, verifies this email address, and chooses a private password. The account remains pending until that is complete."
                      : "This environment still uses compatibility account creation. It does not send an OTP or password-setup email. Enable normalized invitations before creating a real account."}
                  </span>
                </div>
              </div>
            ) : null}
            {createAccountError ? (
              <p className="platform-form-error">{createAccountError}</p>
            ) : null}
            <div className="admin-users-create-actions">
              {createStep === 0 ? (
                <Link href="/app/admin/users">Cancel</Link>
              ) : (
                <button type="button" onClick={() => moveCreateStep("back")}>
                  Back
                </button>
              )}
              <button
                type="submit"
                className="platform-primary-button"
                disabled={creatingAccount || selectedCreateRole === "student"}
              >
                <UserPlus size={15} />
                {createStep < 3
                  ? "Continue"
                  : creatingAccount
                    ? "Creating..."
                    : normalizedInvitationsEnabled
                      ? "Send verification invitation"
                      : "Create connected account"}
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );

  if (mode === "create") {
    return (
      <PlatformShell role="superadmin" title="Create user">
        <FormFlowLayout
          className="admin-users-create-page"
          title="Create user"
          description="Create one Nile Learn account and connect it to the right school role."
          actions={
            <Link className="platform-secondary-button" href="/app/admin/users">
              <ArrowLeft size={15} />
              Back to users
            </Link>
          }
          main={createForm}
        />
      </PlatformShell>
    );
  }

  return (
    <PlatformShell role="superadmin" title="Users">
      <WorkspaceLayout
        className="admin-users-simple-page"
        title="Users"
        description="Manage people who can access Nile Learn."
        actions={
          <Link className="platform-primary-button" href="/app/admin/users/new">
            <UserPlus size={15} />
            Create user
          </Link>
        }
        toolbar={toolbar}
        main={usersTable}
      />
    </PlatformShell>
  );
}
