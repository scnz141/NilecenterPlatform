import { useMemo, useState, type FormEvent } from "react";
import {
  ArrowLeft,
  Edit3,
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
import { runPlatformWorkflowActionRequest } from "@/lib/backend/api";
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
};

type DetailTab = "overview" | "access" | "activity" | "related";

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

export default function AdminUserDetailPage({
  userId,
}: AdminUserDetailPageProps) {
  const [version, setVersion] = useState(0);
  const [activeTab, setActiveTab] = useState<DetailTab>("overview");
  const [editMode, setEditMode] = useState(false);
  const [savingAccess, setSavingAccess] = useState(false);
  const [savingTeacher, setSavingTeacher] = useState(false);
  const [accessError, setAccessError] = useState("");
  const [teacherError, setTeacherError] = useState("");
  const state = useMemo(() => platformStore.getState(), [version]);
  const refresh = () => setVersion(value => value + 1);

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
  const lastActivity = activityRows[0]?.createdAt ?? staffProfile?.updatedAt;
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

  const tabs: Array<{ id: DetailTab; label: string }> = [
    { id: "overview", label: "Overview" },
    { id: "access", label: "Access" },
    { id: "activity", label: "Activity" },
    { id: "related", label: "Related records" },
  ];

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
          <h1>{user.name}</h1>
          <p>
            {role.label} · {branch?.name ?? "No branch"} ·{" "}
            {department?.name ?? "No department"}
          </p>
        </div>
      </div>
      <div className="admin-user-detail-status">
        <StatusBadge tone={statusTone(user.status)}>{user.status}</StatusBadge>
        <span>{user.email}</span>
      </div>
      <div className="admin-user-detail-actions">
        <button
          type="button"
          className="platform-primary-button"
          onClick={() => {
            setActiveTab("access");
            setEditMode(true);
            setAccessDraft({
              activeRole: user.activeRole,
              branchId: user.branchId ?? "",
              departmentId: user.departmentId ?? "",
              status: user.status,
            });
          }}
        >
          <Edit3 size={15} />
          Edit user
        </button>
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
      </div>
    </section>
  );

  const overview = (
    <div className="admin-user-detail-grid">
      <section className="admin-user-detail-section">
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
      <section className="admin-user-detail-section">
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
      <section className="admin-user-detail-section">
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
      <section className="admin-user-detail-section">
        <h2>Recent activity</h2>
        <p>
          {activityRows[0]?.summary ??
            "No recent activity recorded for this user."}
        </p>
        <small>{formatDate(lastActivity)}</small>
      </section>
    </div>
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
        {editMode ? (
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
              <button type="button" onClick={() => setEditMode(false)}>
                Cancel
              </button>
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
              Use Edit user to update role, branch, department, or status.
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
        <h2>Assigned work</h2>
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
      {isTeacherAccount ? (
        <section className="admin-user-detail-section">
          <h2>Course run assignment</h2>
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
              <button
                type="submit"
                className="platform-primary-button"
                disabled={savingTeacher}
              >
                {savingTeacher ? "Saving..." : "Save teacher assignment"}
              </button>
            </div>
          </form>
        </section>
      ) : null}
    </div>
  );

  return (
    <PlatformShell role="superadmin" title={user.name}>
      <DetailLayout
        className="admin-user-detail-page"
        title={user.name}
        description="Understand and manage one Nile Learn account."
        context={<span>{role.label}</span>}
        main={
          <>
            {header}
            <div
              className="admin-user-detail-tabs"
              role="tablist"
              aria-label="User detail sections"
            >
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  className={activeTab === tab.id ? "active" : ""}
                  onClick={() => setActiveTab(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <div className="admin-user-detail-tab-panel">
              {activeTab === "overview" ? overview : null}
              {activeTab === "access" ? access : null}
              {activeTab === "activity" ? activity : null}
              {activeTab === "related" ? related : null}
            </div>
          </>
        }
      />
    </PlatformShell>
  );
}
