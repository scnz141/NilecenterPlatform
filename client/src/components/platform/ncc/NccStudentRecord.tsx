import { useCallback, useEffect, useState } from "react";
import { Link } from "wouter";
import { Copy, Eye, EyeOff } from "lucide-react";
import NccReadStatus from "@/components/platform/NccReadStatus";
import OperationalDirectoryTable from "@/components/platform/OperationalDirectoryTable";
import PlatformShell from "@/components/platform/PlatformShell";
import { DetailLayout } from "@/components/platform/PlatformLayouts";
import {
  DataTableCard,
  StatusBadge,
} from "@/components/platform/PlatformPrimitives";
import NccStudentForm, {
  nccIdentityInputFromValues,
  type NccGuardianFormValues,
  type NccStudentFormValues,
} from "@/components/platform/ncc/NccStudentForm";
import {
  bindNccStudentMoodleRequest,
  disableNccStudentRequest,
  enableNccStudentRequest,
  fetchNccMoodleUsersRequest,
  fetchNccStudentEnrolmentsRequest,
  fetchNccStudentRequest,
  patchNccStudentRequest,
  resetNccStudentMoodlePasswordRequest,
  type NccMoodleUserDto,
  type NccStudentDto,
  type NccStudentEnrolmentDto,
  type NccStudentWriteInput,
} from "@/lib/backend/api";
import {
  classifyNccFailure,
  type NccReadState,
} from "@/lib/backend/nccReadState";

type RecordData = {
  student: NccStudentDto;
  enrolments: NccStudentEnrolmentDto[];
};

const blankGuardian: NccGuardianFormValues = {
  name: "",
  phone: "",
  email: "",
  relationship: "",
};

function formValues(student: NccStudentDto): NccStudentFormValues {
  const guardianRow = (index: number): NccGuardianFormValues => {
    const guardian = student.guardians[index];
    return guardian
      ? {
          name: guardian.name,
          phone: guardian.phone,
          email: guardian.email,
          relationship: guardian.relationship,
        }
      : { ...blankGuardian };
  };
  return {
    firstName: student.firstName,
    lastName: student.lastName,
    email: student.email,
    nationality: student.nationality ?? "",
    address: student.address ?? "",
    gender: student.gender ?? "",
    dateOfBirth: student.dateOfBirth ?? "",
    phone: student.phone ?? "",
    passportNumber: student.passportNumber ?? "",
    nationalId: student.nationalId ?? "",
    guardians: [guardianRow(0), guardianRow(1)],
  };
}

export default function NccStudentRecord({
  studentId,
  role,
  backHref,
}: {
  studentId: string;
  role: "registrar" | "branchadmin";
  backHref: string;
}) {
  const [state, setState] = useState<NccReadState<RecordData>>({
    status: "loading",
  });
  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [linkOpen, setLinkOpen] = useState(false);
  const [moodleQuery, setMoodleQuery] = useState("");
  const [moodleSearch, setMoodleSearch] = useState<{
    status: "idle" | "loading" | "error" | "ready";
    items: NccMoodleUserDto[];
  }>({ status: "idle", items: [] });
  const [moodleUserId, setMoodleUserId] = useState<number | null>(null);
  const [oneTime, setOneTime] = useState<{
    label: string;
    value: string;
  } | null>(null);
  const [revealed, setRevealed] = useState(false);
  const load = useCallback(async () => {
    setState({ status: "loading" });
    const [studentResponse, enrolmentResponse] = await Promise.all([
      fetchNccStudentRequest(studentId),
      fetchNccStudentEnrolmentsRequest(studentId),
    ]);
    const failed = [studentResponse, enrolmentResponse].find(
      response => !response.ok
    );
    if (failed || !studentResponse.data || !enrolmentResponse.data) {
      setState(
        classifyNccFailure(
          failed ?? { error: "EMS student data returned no record." }
        )
      );
      return;
    }
    setState({
      status: "ready",
      data: {
        student: studentResponse.data.student,
        enrolments: enrolmentResponse.data.items,
      },
    });
  }, [studentId]);
  useEffect(() => {
    void load();
  }, [load]);

  const save = async (values: NccStudentFormValues) => {
    if (state.status !== "ready") return;
    const student = state.data.student;
    const identity = nccIdentityInputFromValues(values);
    if (!identity.input) {
      setError(identity.error ?? "Student identity details are incomplete.");
      return;
    }
    const patch: NccStudentWriteInput = {};
    for (const key of ["firstName", "lastName", "email"] as const) {
      if (values[key] !== student[key]) patch[key] = values[key];
    }
    const identityOriginal = {
      phone: student.phone,
      dateOfBirth: student.dateOfBirth,
      nationality: student.nationality,
      address: student.address,
      gender: student.gender,
      passportNumber: student.passportNumber,
      nationalId: student.nationalId,
    };
    for (const key of Object.keys(identityOriginal) as Array<
      keyof typeof identityOriginal
    >) {
      if (identity.input[key] !== identityOriginal[key]) {
        (patch as Record<string, unknown>)[key] = identity.input[key];
      }
    }
    if (
      JSON.stringify(identity.input.guardians ?? []) !==
      JSON.stringify(student.guardians)
    ) {
      patch.guardians = identity.input.guardians ?? [];
    }
    setPending(true);
    setError("");
    const response = await patchNccStudentRequest(studentId, patch);
    setPending(false);
    if (!response.ok) {
      setError(response.error ?? "The student could not be updated.");
      return;
    }
    setEditing(false);
    await load();
  };

  const lifecycle = async (action: "disable" | "enable") => {
    if (
      action === "disable" &&
      !window.confirm("This student will lose access immediately.")
    ) {
      return;
    }
    setPending(true);
    setError("");
    const response =
      action === "disable"
        ? await disableNccStudentRequest(studentId)
        : await enableNccStudentRequest(studentId);
    setPending(false);
    if (!response.ok) {
      setError(response.error ?? "The student status could not be updated.");
      return;
    }
    await load();
  };

  const moodleCreate = async () => {
    if (pending) return;
    setPending(true);
    setError("");
    const response = await bindNccStudentMoodleRequest(studentId, {
      mode: "create",
    });
    setPending(false);
    if (!response.ok || !response.data) {
      setError(response.error ?? "The Moodle account could not be created.");
      return;
    }
    if (response.data.oneTime.generatedMoodlePassword) {
      setOneTime({
        label: "Moodle password",
        value: response.data.oneTime.generatedMoodlePassword,
      });
      setRevealed(false);
    }
    await load();
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
      setError(response.error ?? "Moodle users could not be loaded.");
      return;
    }
    setMoodleSearch({ status: "ready", items: response.data.items });
  };

  const moodleLink = async () => {
    if (pending || moodleUserId === null) return;
    setPending(true);
    setError("");
    const response = await bindNccStudentMoodleRequest(studentId, {
      mode: "link",
      moodleUserId,
    });
    setPending(false);
    if (!response.ok) {
      setError(response.error ?? "The Moodle account could not be linked.");
      return;
    }
    setLinkOpen(false);
    setMoodleQuery("");
    setMoodleSearch({ status: "idle", items: [] });
    setMoodleUserId(null);
    await load();
  };

  const moodleReset = async () => {
    if (!window.confirm("Generate a new Moodle password?")) return;
    setPending(true);
    setError("");
    const response = await resetNccStudentMoodlePasswordRequest(studentId);
    setPending(false);
    if (!response.ok || !response.data) {
      setError(response.error ?? "The Moodle password could not be reset.");
      return;
    }
    setOneTime({
      label: "Moodle password",
      value: response.data.oneTime.generatedMoodlePassword,
    });
    setRevealed(false);
  };

  if (state.status !== "ready") {
    return (
      <PlatformShell role={role} title="Student detail">
        <DetailLayout
          title="Student detail"
          description="Read one EMS student record."
          main={<NccReadStatus state={state} onRetry={() => void load()} />}
        />
      </PlatformShell>
    );
  }

  const { student, enrolments } = state.data;
  return (
    <PlatformShell role={role} title={student.name}>
      <DetailLayout
        title={student.name}
        description={`${student.email} · ${student.branchName}`}
        actions={
          <div className="platform-page-actions">
            <Link className="platform-secondary-button" href={backHref}>
              Back to students
            </Link>
            <button type="button" onClick={() => setEditing(value => !value)}>
              {editing ? "Close edit" : "Edit"}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                void lifecycle(
                  student.status === "active" ? "disable" : "enable"
                )
              }
            >
              {student.status === "active" ? "Disable" : "Enable"}
            </button>
            {role === "registrar" ? (
              <Link
                className="platform-primary-button"
                href={`/app/registrar/placement-tests/new?studentId=${encodeURIComponent(student.id)}`}
              >
                Book placement test
              </Link>
            ) : null}
          </div>
        }
        main={
          <div className="registrar-student-detail-workspace">
            <section className="registrar-panel">
              <StatusBadge
                tone={student.status === "active" ? "green" : "slate"}
              >
                {student.status}
              </StatusBadge>
              <dl className="admin-user-detail-list">
                <div>
                  <dt>Phone</dt>
                  <dd>{student.phone ?? "—"}</dd>
                </div>
                <div>
                  <dt>Date of birth</dt>
                  <dd>{student.dateOfBirth ?? "—"}</dd>
                </div>
                <div>
                  <dt>Nationality</dt>
                  <dd>{student.nationality ?? "—"}</dd>
                </div>
                <div>
                  <dt>Address</dt>
                  <dd>{student.address ?? "—"}</dd>
                </div>
                <div>
                  <dt>Gender</dt>
                  <dd>{student.gender ?? "—"}</dd>
                </div>
                <div>
                  <dt>Passport number</dt>
                  <dd>{student.passportNumber ?? "—"}</dd>
                </div>
                <div>
                  <dt>National ID</dt>
                  <dd>{student.nationalId ?? "—"}</dd>
                </div>
                {student.guardians.map((guardian, index) => (
                  <div key={guardian.sortOrder}>
                    <dt>Guardian {index + 1}</dt>
                    <dd>
                      {guardian.name} · {guardian.relationship} ·{" "}
                      {guardian.phone} · {guardian.email}
                    </dd>
                  </div>
                ))}
                <div>
                  <dt>Moodle account</dt>
                  <dd>{student.moodleLinked ? "Linked" : "Not linked"}</dd>
                </div>
              </dl>
              {student.status === "active" ? (
                <div className="admin-user-detail-form-actions">
                  {student.moodleLinked ? (
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
              {linkOpen && !student.moodleLinked ? (
                <div className="admin-user-detail-form">
                  <label>
                    Search Moodle users
                    <input
                      value={moodleQuery}
                      placeholder="Name, username, or email"
                      onChange={event => setMoodleQuery(event.target.value)}
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
                        name="student-moodle-user"
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
            {editing ? (
              <section className="registrar-panel">
                <NccStudentForm
                  key={student.updatedAt}
                  initial={formValues(student)}
                  onSubmit={save}
                  pending={pending}
                  submitLabel="Save student"
                  error={error}
                />
              </section>
            ) : null}
            {error && !editing ? (
              <p className="platform-form-error" role="alert">
                {error}
              </p>
            ) : null}
            <DataTableCard
              title="Class enrolments"
              subtitle={`${enrolments.length} records`}
            >
              {enrolments.length ? (
                <div className="platform-directory-table-wrap">
                  <OperationalDirectoryTable
                    rows={enrolments}
                    rowKey={row => row.classId}
                    columns={[
                      {
                        key: "class",
                        label: "Class",
                        render: row => <strong>{row.className}</strong>,
                      },
                      {
                        key: "course",
                        label: "Course",
                        render: row => row.courseName ?? "—",
                      },
                      {
                        key: "status",
                        label: "Status",
                        render: row => row.status,
                      },
                    ]}
                    action={{
                      href: () => undefined,
                      label: row => row.className,
                    }}
                  />
                </div>
              ) : (
                <div className="platform-empty-state">
                  <strong>No class enrolments yet</strong>
                </div>
              )}
            </DataTableCard>
          </div>
        }
      />
    </PlatformShell>
  );
}
