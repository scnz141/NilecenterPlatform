import { getStoredAuthSession, requireActiveUser } from "@/lib/auth/session";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  FileText,
  Megaphone,
  Search,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";
import { Link, useLocation } from "wouter";
import NccReadStatus from "@/components/platform/NccReadStatus";
import OperationalDirectoryTable from "@/components/platform/OperationalDirectoryTable";
import PlatformShell from "@/components/platform/PlatformShell";
import {
  DetailLayout,
  FormFlowLayout,
  WorkspaceLayout,
} from "@/components/platform/PlatformLayouts";
import {
  DataTableCard,
  StatusBadge,
} from "@/components/platform/PlatformPrimitives";
import {
  cancelNccPlacementTestRequest,
  convertNccLeadRequest,
  createNccLeadRequest,
  createNccPlacementTestRequest,
  fetchNccCoursesRequest,
  fetchNccLeadRequest,
  fetchNccLeadsRequest,
  fetchNccPlacementTestRequest,
  fetchNccPlacementTestsRequest,
  fetchNccRoomsRequest,
  fetchNccStudentsRequest,
  markNccLeadReadyRequest,
  patchNccLeadRequest,
  patchNccPlacementTestRequest,
  recordNccPlacementResultRequest,
  runPlatformWorkflowActionRequest,
  type NccCourseDto,
  type NccLeadDto,
  type NccPlacementTestDto,
  type NccRoomDto,
  type NccStudentDto,
} from "@/lib/backend/api";
import {
  emptyNccIdentityValues,
  NccIdentityFields,
  nccIdentityInputFromValues,
  type NccIdentityFormValues,
} from "@/components/platform/ncc/NccStudentForm";
import {
  classifyNccFailure,
  type NccReadState,
} from "@/lib/backend/nccReadState";
import { useNccWorkspaceBranchName } from "@/lib/backend/nccWorkspaceBranch";
import { platformStore } from "@/lib/domain/store";
import type { Lead } from "@/lib/domain/types";

type RegistrarAdmissionsView =
  | "leads"
  | "lead-create"
  | "lead-detail"
  | "applications"
  | "application-create"
  | "application-detail"
  | "placement-tests"
  | "placement-create"
  | "placement-detail";

type RegistrarAdmissionsPageProps = {
  view: RegistrarAdmissionsView;
  leadId?: string;
  applicationId?: string;
  bookingId?: string;
};

type LeadDraft = {
  fullName: string;
  email: string;
  phone: string;
  country: string;
  subject: string;
  source: Lead["source"];
  notes: string;
};

type ApplicationDraft = {
  fullName: string;
  email: string;
  phone: string;
  branchId: string;
  courseInterest: string;
  schedulePreference: string;
  notes: string;
};

type PlacementDraft = {
  fullName: string;
  email: string;
  phone: string;
  branchId: string;
  subject: string;
  preferredDate: string;
  currentLevel: string;
};

function statusTone(status?: string): "green" | "amber" | "red" | "slate" {
  if (!status) return "slate";
  if (["active", "approved", "completed", "ready_to_enroll"].includes(status)) {
    return "green";
  }
  if (["lead", "pending", "placement_booked"].includes(status)) return "amber";
  if (["paused", "cancelled", "rejected"].includes(status)) return "red";
  return "slate";
}

function nccStatusTone(status: string): "green" | "amber" | "slate" {
  if (["active", "completed", "converted", "ready"].includes(status)) {
    return "green";
  }
  if (
    ["scheduled", "new", "placement_test", "trial_lesson", "pending"].includes(
      status
    )
  ) {
    return "amber";
  }
  return "slate";
}

function formatDate(value?: string) {
  if (!value) return "No date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function statusLabel(value?: string) {
  return (value ?? "not set")
    .replace(/_/g, " ")
    .replace(/\b\w/g, character => character.toUpperCase());
}

function defaultPlacementDate() {
  return "2026-07-15";
}

function NccLeadCreatePage() {
  const [, navigate] = useLocation();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [source, setSource] = useState("");
  const [notes, setNotes] = useState("");
  const [coursesState, setCoursesState] = useState<
    NccReadState<NccCourseDto[]>
  >({ status: "loading" });
  const [preferredCourseIds, setPreferredCourseIds] = useState<string[]>([]);
  const [wantsOnline, setWantsOnline] = useState(false);
  const [wantsOnsite, setWantsOnsite] = useState(false);
  const [entryPath, setEntryPath] = useState<NccLeadDto["entryPath"]>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const branchName = useNccWorkspaceBranchName();
  useEffect(() => {
    let active = true;
    void fetchNccCoursesRequest().then(response => {
      if (!active) return;
      setCoursesState(
        response.ok && response.data
          ? {
              status: "ready",
              data: response.data.items.filter(
                course => course.status === "active"
              ),
            }
          : classifyNccFailure(response)
      );
    });
    return () => {
      active = false;
    };
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError("");
    const response = await createNccLeadRequest({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim(),
      phone: phone.trim() || undefined,
      source: source.trim() || undefined,
      notes: notes.trim() || undefined,
      preferredCourseIds,
      wantsOnline,
      wantsOnsite,
      entryPath,
    });
    setPending(false);
    if (!response.ok || !response.data) {
      setError(response.error ?? "The lead could not be created.");
      return;
    }
    navigate(`/app/registrar/leads/${response.data.lead.id}`);
  };

  return (
    <PlatformShell role="registrar" title="New lead">
      <FormFlowLayout
        title="New lead"
        description="Create one lead in EMS."
        context={branchName}
        actions={
          <Link
            className="platform-secondary-button"
            href="/app/registrar/leads"
          >
            Back to leads
          </Link>
        }
        main={
          <form className="registrar-lead-form" onSubmit={submit}>
            <p>Branch: {branchName}</p>
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
              Email
              <input
                type="email"
                value={email}
                onChange={event => setEmail(event.target.value)}
              />
            </label>
            <label>
              Phone
              <input
                value={phone}
                onChange={event => setPhone(event.target.value)}
              />
            </label>
            <label>
              Source
              <input
                list="ncc-lead-sources"
                value={source}
                onChange={event => setSource(event.target.value)}
              />
              <datalist id="ncc-lead-sources">
                {[
                  "website",
                  "referral",
                  "walk-in",
                  "phone",
                  "social",
                  "other",
                ].map(value => (
                  <option key={value} value={value} />
                ))}
              </datalist>
            </label>
            <label>
              Notes
              <textarea
                value={notes}
                onChange={event => setNotes(event.target.value)}
              />
            </label>
            <fieldset>
              <legend>Preferred courses</legend>
              {coursesState.status !== "ready" ? (
                <small>
                  {coursesState.status === "loading"
                    ? "Loading courses..."
                    : "Courses could not be loaded. You can save without selecting one."}
                </small>
              ) : coursesState.data.length ? (
                coursesState.data.map(course => (
                  <label key={course.id}>
                    <input
                      type="checkbox"
                      checked={preferredCourseIds.includes(course.id)}
                      onChange={event =>
                        setPreferredCourseIds(current =>
                          event.target.checked
                            ? [...current, course.id]
                            : current.filter(id => id !== course.id)
                        )
                      }
                    />
                    {course.fullname}
                  </label>
                ))
              ) : (
                <small>No active courses in EMS.</small>
              )}
            </fieldset>
            <label>
              <input
                type="checkbox"
                checked={wantsOnline}
                onChange={event => setWantsOnline(event.target.checked)}
              />
              Wants online learning
            </label>
            <label>
              <input
                type="checkbox"
                checked={wantsOnsite}
                onChange={event => setWantsOnsite(event.target.checked)}
              />
              Wants onsite learning
            </label>
            <label>
              Entry path
              <select
                value={entryPath ?? ""}
                onChange={event =>
                  setEntryPath(
                    (event.target.value ||
                      null) as NccLeadDto["entryPath"]
                  )
                }
              >
                <option value="">Not set</option>
                <option value="direct">Direct</option>
                <option value="placement">Placement test</option>
                <option value="trial">Trial lesson</option>
                <option value="unset">Unset</option>
              </select>
            </label>
            {error ? (
              <p className="platform-form-error" role="alert">
                {error}
              </p>
            ) : null}
            <button
              type="submit"
              className="platform-primary-button"
              disabled={pending}
            >
              {pending ? "Creating..." : "Add lead"}
            </button>
          </form>
        }
      />
    </PlatformShell>
  );
}

function NccLeadRecordPage({ leadId }: { leadId: string }) {
  const [, navigate] = useLocation();
  const [state, setState] = useState<NccReadState<NccLeadDto>>({
    status: "loading",
  });
  const [editing, setEditing] = useState(false);
  const [converting, setConverting] = useState(false);
  const [identity, setIdentity] = useState<NccIdentityFormValues>(
    emptyNccIdentityValues()
  );
  const [editPreferredCourseIds, setEditPreferredCourseIds] = useState<
    string[]
  >([]);
  const [editWantsOnline, setEditWantsOnline] = useState(false);
  const [editWantsOnsite, setEditWantsOnsite] = useState(false);
  const [editEntryPath, setEditEntryPath] =
    useState<NccLeadDto["entryPath"]>("unset");
  const [coursesState, setCoursesState] = useState<
    NccReadState<NccCourseDto[]>
  >({ status: "loading" });
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const resetEditDraft = useCallback((lead: NccLeadDto) => {
    setEditPreferredCourseIds(lead.preferredCourses.map(({ id }) => id));
    setEditWantsOnline(lead.wantsOnline);
    setEditWantsOnsite(lead.wantsOnsite);
    setEditEntryPath(lead.entryPath ?? "unset");
  }, []);
  const load = useCallback(async () => {
    setState({ status: "loading" });
    setCoursesState({ status: "loading" });
    const response = await fetchNccLeadRequest(leadId);
    setState(
      response.ok && response.data
        ? { status: "ready", data: response.data.lead }
        : classifyNccFailure(response)
    );
    if (response.ok && response.data) {
      resetEditDraft(response.data.lead);
    }
    const courses = await fetchNccCoursesRequest();
    setCoursesState(
      courses.ok && courses.data
        ? {
            status: "ready",
            data: courses.data.items.filter(
              course => course.status === "active"
            ),
          }
        : classifyNccFailure(courses)
    );
  }, [leadId, resetEditDraft]);
  useEffect(() => {
    void load();
  }, [load]);
  if (state.status !== "ready") {
    return (
      <PlatformShell role="registrar" title="Lead detail">
        <DetailLayout
          title="Lead detail"
          main={<NccReadStatus state={state} onRetry={() => void load()} />}
        />
      </PlatformShell>
    );
  }
  const lead = state.data;
  const cancelLead = async () => {
    if (!window.confirm("Cancel this lead?")) return;
    setPending(true);
    setSaved(false);
    setError("");
    const response = await patchNccLeadRequest(lead.id, {
      status: "cancelled",
    });
    setPending(false);
    if (!response.ok) {
      setError(response.error ?? "Lead could not be cancelled.");
      return;
    }
    setSaved(true);
    await load();
  };
  const saveDetails = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const patch: Parameters<typeof patchNccLeadRequest>[1] = {};
    for (const [name, key] of [
      ["firstName", "firstName"],
      ["lastName", "lastName"],
      ["email", "email"],
      ["phone", "phone"],
      ["source", "source"],
      ["notes", "notes"],
    ] as const) {
      const value = String(form.get(name) ?? "");
      const original =
        key === "firstName"
          ? lead.firstName
          : key === "lastName"
            ? lead.lastName
            : key === "email"
              ? lead.email
              : key === "phone"
                ? (lead.phone ?? "")
                : key === "source"
                  ? (lead.source ?? "")
                  : (lead.notes ?? "");
      if (value !== original)
        (patch as Record<string, unknown>)[key] = value || null;
    }
    const originalCourseIds = lead.preferredCourses.map(({ id }) => id);
    if (
      JSON.stringify([...editPreferredCourseIds].sort()) !==
      JSON.stringify([...originalCourseIds].sort())
    ) {
      patch.preferredCourseIds = editPreferredCourseIds;
    }
    if (editWantsOnline !== lead.wantsOnline)
      patch.wantsOnline = editWantsOnline;
    if (editWantsOnsite !== lead.wantsOnsite)
      patch.wantsOnsite = editWantsOnsite;
    if (editEntryPath !== (lead.entryPath ?? "unset"))
      patch.entryPath = editEntryPath;
    setPending(true);
    setError("");
    const response = await patchNccLeadRequest(lead.id, patch);
    setPending(false);
    if (!response.ok) {
      setError(response.error ?? "Lead details could not be saved.");
      return;
    }
    setEditing(false);
    setSaved(true);
    await load();
  };
  const markReady = async () => {
    setPending(true);
    setError("");
    const response = await markNccLeadReadyRequest(lead.id);
    setPending(false);
    if (!response.ok) {
      setError(response.error ?? "Lead could not be marked ready.");
      return;
    }
    setSaved(true);
    await load();
  };
  const convert = async () => {
    const parsed = nccIdentityInputFromValues(identity);
    if (!parsed.input) {
      setError(parsed.error ?? "Student identity details are incomplete.");
      return;
    }
    setPending(true);
    setError("");
    const response = await convertNccLeadRequest(lead.id, parsed.input);
    setPending(false);
    if (!response.ok || !response.data) {
      setError(response.error ?? "Lead could not be converted.");
      return;
    }
    navigate(`/app/registrar/students/${response.data.student.id}`);
  };
  const converted = lead.status === "converted";
  const terminal = converted || lead.status === "cancelled";
  return (
    <PlatformShell role="registrar" title={lead.name}>
      <DetailLayout
        title={lead.name}
        description={`${lead.email} · ${lead.branchName}`}
        actions={
          <Link
            className="platform-secondary-button"
            href="/app/registrar/leads"
          >
            Back to leads
          </Link>
        }
        main={
          <section className="registrar-panel registrar-detail-focus">
            <StatusBadge tone={nccStatusTone(lead.status)}>
              {statusLabel(lead.status)}
            </StatusBadge>
            {saved ? <small role="status">Saved</small> : null}
            <div className="registrar-detail-grid">
              <article>
                <span>Phone</span>
                <strong>{lead.phone ?? "—"}</strong>
              </article>
              <article>
                <span>Source</span>
                <strong>{lead.source ?? "—"}</strong>
              </article>
              <article>
                <span>Entry path</span>
                <strong>
                  {lead.entryPath ? statusLabel(lead.entryPath) : "—"}
                </strong>
              </article>
              <article>
                <span>Preferred courses</span>
                <strong>
                  {lead.preferredCourses.length
                    ? lead.preferredCourses
                        .map(course => course.name)
                        .join(", ")
                    : "—"}
                </strong>
              </article>
              <article>
                <span>Delivery</span>
                <strong>
                  {[
                    lead.wantsOnline ? "Online" : null,
                    lead.wantsOnsite ? "Onsite" : null,
                  ]
                    .filter(Boolean)
                    .join(" + ") || "—"}
                </strong>
              </article>
              <article>
                <span>Notes</span>
                <strong>{lead.notes ?? "—"}</strong>
              </article>
            </div>
            {!terminal ? (
              <div className="platform-page-actions">
                <button
                  type="button"
                  onClick={() => {
                    setEditing(value => {
                      if (!value) resetEditDraft(lead);
                      return !value;
                    });
                  }}
                >
                  Edit details
                </button>
                <Link
                  href={`/app/registrar/placement-tests/new?leadId=${encodeURIComponent(lead.id)}`}
                >
                  Book placement test
                </Link>
                {lead.status !== "ready" ? (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => void markReady()}
                  >
                    Mark ready
                  </button>
                ) : null}
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => void cancelLead()}
                >
                  Cancel lead
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => setConverting(value => !value)}
                >
                  Convert to student
                </button>
              </div>
            ) : converted && lead.studentId ? (
              <Link href={`/app/registrar/students/${lead.studentId}`}>
                Open student
              </Link>
            ) : null}
            {converting && !terminal ? (
              <form
                className="registrar-lead-form"
                onSubmit={event => {
                  event.preventDefault();
                  void convert();
                }}
              >
                <NccIdentityFields
                  values={identity}
                  onChange={patch =>
                    setIdentity(current => ({ ...current, ...patch }))
                  }
                />
                <button type="submit" disabled={pending}>
                  {pending ? "Converting..." : "Confirm conversion"}
                </button>
              </form>
            ) : null}
            {editing ? (
              <form className="registrar-lead-form" onSubmit={saveDetails}>
                <label>
                  First name
                  <input name="firstName" defaultValue={lead.firstName} />
                </label>
                <label>
                  Last name
                  <input name="lastName" defaultValue={lead.lastName} />
                </label>
                <label>
                  Email
                  <input name="email" type="email" defaultValue={lead.email} />
                </label>
                <label>
                  Phone
                  <input name="phone" defaultValue={lead.phone ?? ""} />
                </label>
                <label>
                  Source
                  <input name="source" defaultValue={lead.source ?? ""} />
                </label>
                <label>
                  Notes
                  <textarea name="notes" defaultValue={lead.notes ?? ""} />
                </label>
                <fieldset>
                  <legend>Preferred courses</legend>
                  {coursesState.status !== "ready" ? (
                    <small>
                      {coursesState.status === "loading"
                        ? "Loading courses..."
                        : "Courses could not be loaded. You can save without selecting one."}
                    </small>
                  ) : coursesState.data.length ? (
                    coursesState.data.map(course => (
                      <label key={course.id}>
                        <input
                          type="checkbox"
                          checked={editPreferredCourseIds.includes(course.id)}
                          onChange={event =>
                            setEditPreferredCourseIds(current =>
                              event.target.checked
                                ? [...current, course.id]
                                : current.filter(id => id !== course.id)
                            )
                          }
                        />
                        {course.fullname}
                      </label>
                    ))
                  ) : (
                    <small>No active courses in EMS.</small>
                  )}
                </fieldset>
                <label>
                  <input
                    type="checkbox"
                    checked={editWantsOnline}
                    onChange={event =>
                      setEditWantsOnline(event.target.checked)
                    }
                  />
                  Wants online learning
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={editWantsOnsite}
                    onChange={event =>
                      setEditWantsOnsite(event.target.checked)
                    }
                  />
                  Wants onsite learning
                </label>
                <label>
                  Entry path
                  <select
                    value={editEntryPath ?? "unset"}
                    onChange={event =>
                      setEditEntryPath(
                        event.target.value as NccLeadDto["entryPath"]
                      )
                    }
                  >
                    <option value="unset">Unset</option>
                    <option value="direct">Direct</option>
                    <option value="placement">Placement test</option>
                    <option value="trial">Trial lesson</option>
                  </select>
                </label>
                <button type="submit" disabled={pending}>
                  Save details
                </button>
              </form>
            ) : null}
            {error ? (
              <p className="platform-form-error" role="alert">
                {error}
              </p>
            ) : null}
          </section>
        }
      />
    </PlatformShell>
  );
}

function NccPlacementCreatePage() {
  const [, navigate] = useLocation();
  const branchName = useNccWorkspaceBranchName();
  const query = new URLSearchParams(window.location.search);
  const preselectedLead = query.get("leadId") ?? "";
  const preselectedStudent = query.get("studentId") ?? "";
  const [subjectType, setSubjectType] = useState<"lead" | "student">(
    preselectedStudent ? "student" : "lead"
  );
  const [subjectId, setSubjectId] = useState(
    preselectedStudent || preselectedLead
  );
  const [scheduledAt, setScheduledAt] = useState("");
  const [roomId, setRoomId] = useState("");
  const [leads, setLeads] = useState<NccLeadDto[]>([]);
  const [students, setStudents] = useState<NccStudentDto[]>([]);
  const [rooms, setRooms] = useState<NccRoomDto[]>([]);
  const [roomsUnavailable, setRoomsUnavailable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [leadResult, studentResult, roomResult] = await Promise.all([
        fetchNccLeadsRequest(),
        fetchNccStudentsRequest(),
        fetchNccRoomsRequest(),
      ]);
      if (cancelled) return;
      if (
        !leadResult.ok ||
        !leadResult.data ||
        !studentResult.ok ||
        !studentResult.data
      ) {
        setError(
          leadResult.error ??
            studentResult.error ??
            "Subjects could not be loaded."
        );
        setLoading(false);
        return;
      }
      setLeads(
        leadResult.data.items.filter(
          lead => !["converted", "cancelled"].includes(lead.status)
        )
      );
      setStudents(
        studentResult.data.items.filter(student => student.status === "active")
      );
      if (roomResult.ok && roomResult.data)
        setRooms(
          roomResult.data.items.filter(room => room.status === "active")
        );
      else setRoomsUnavailable(true);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  const subjects =
    subjectType === "lead"
      ? leads.map(item => ({ id: item.id, name: item.name }))
      : students;
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!subjectId || !scheduledAt) {
      setError("Subject and date are required.");
      return;
    }
    setPending(true);
    setError("");
    const response = await createNccPlacementTestRequest({
      subject: { type: subjectType, id: subjectId },
      scheduledAt: new Date(scheduledAt).toISOString(),
      roomId: roomId || undefined,
    });
    setPending(false);
    if (!response.ok || !response.data) {
      setError(response.error ?? "Placement could not be booked.");
      return;
    }
    navigate(
      `/app/registrar/placement-tests/${response.data.placementTest.id}`
    );
  };
  return (
    <PlatformShell role="registrar" title="Book placement">
      <FormFlowLayout
        title="Book placement test"
        description="Schedule one EMS placement test."
        context={branchName}
        actions={
          <Link href="/app/registrar/placement-tests">Back to placement</Link>
        }
        main={
          loading ? (
            <NccReadStatus state={{ status: "loading" }} />
          ) : (
            <form
              className="registrar-placement-booking-form"
              onSubmit={submit}
            >
              <p>Branch: {branchName}</p>
              <fieldset>
                <legend>Subject</legend>
                <label>
                  <input
                    type="radio"
                    checked={subjectType === "lead"}
                    onChange={() => {
                      setSubjectType("lead");
                      setSubjectId("");
                    }}
                  />
                  Lead
                </label>
                <label>
                  <input
                    type="radio"
                    checked={subjectType === "student"}
                    onChange={() => {
                      setSubjectType("student");
                      setSubjectId("");
                    }}
                  />
                  Student
                </label>
              </fieldset>
              <label>
                Person
                <select
                  value={subjectId}
                  onChange={event => setSubjectId(event.target.value)}
                >
                  <option value="">Choose</option>
                  {subjects.map(item => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Date and time
                <input
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={event => setScheduledAt(event.target.value)}
                />
              </label>
              <label>
                Room
                <select
                  value={roomId}
                  disabled={roomsUnavailable}
                  onChange={event => setRoomId(event.target.value)}
                >
                  <option value="">
                    {roomsUnavailable ? "Rooms unavailable" : "No room"}
                  </option>
                  {rooms.map(room => (
                    <option key={room.id} value={room.id}>
                      {room.name}
                    </option>
                  ))}
                </select>
              </label>
              {error ? (
                <p className="platform-form-error" role="alert">
                  {error}
                </p>
              ) : null}
              <button type="submit" disabled={pending}>
                {pending ? "Booking..." : "Book placement"}
              </button>
            </form>
          )
        }
      />
    </PlatformShell>
  );
}

function NccPlacementRecordPage({ bookingId }: { bookingId: string }) {
  const [state, setState] = useState<NccReadState<NccPlacementTestDto>>({
    status: "loading",
  });
  const [rooms, setRooms] = useState<NccRoomDto[]>([]);
  const [courses, setCourses] = useState<NccCourseDto[]>([]);
  const [scheduledAt, setScheduledAt] = useState("");
  const [roomId, setRoomId] = useState("");
  const [courseId, setCourseId] = useState("");
  const [score, setScore] = useState("");
  const [notes, setNotes] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setState({ status: "loading" });
    const [record, roomResult, courseResult] = await Promise.all([
      fetchNccPlacementTestRequest(bookingId),
      fetchNccRoomsRequest(),
      fetchNccCoursesRequest(),
    ]);
    if (!record.ok || !record.data) {
      setState(classifyNccFailure(record));
      return;
    }
    setState({ status: "ready", data: record.data.placementTest });
    setRooms(
      roomResult.ok && roomResult.data
        ? roomResult.data.items.filter(room => room.status === "active")
        : []
    );
    setCourses(
      courseResult.ok && courseResult.data
        ? courseResult.data.items.filter(course => course.status === "active")
        : []
    );
  }, [bookingId]);
  useEffect(() => {
    void load();
  }, [load]);
  const run = async (
    operation: Promise<{ ok: boolean; data?: unknown; error?: string }>
  ) => {
    setPending(true);
    setError("");
    const response = await operation;
    setPending(false);
    if (!response.ok) {
      setError(response.error ?? "Placement could not be updated.");
      return;
    }
    await load();
  };
  if (state.status !== "ready")
    return (
      <PlatformShell role="registrar" title="Placement detail">
        <DetailLayout
          title="Placement detail"
          main={<NccReadStatus state={state} onRetry={() => void load()} />}
        />
      </PlatformShell>
    );
  const placement = state.data;
  const scheduled = placement.status === "scheduled";
  return (
    <PlatformShell role="registrar" title={placement.subject.name}>
      <DetailLayout
        title={placement.subject.name}
        description={`${placement.subject.email} · ${placement.branchName}`}
        actions={
          <Link href="/app/registrar/placement-tests">Back to placement</Link>
        }
        main={
          <section className="registrar-panel registrar-detail-focus">
            <div className="registrar-detail-grid">
              <article>
                <span>Status</span>
                <strong>{statusLabel(placement.status)}</strong>
              </article>
              <article>
                <span>Scheduled</span>
                <strong>
                  {formatDate(placement.scheduledAt ?? undefined)}
                </strong>
              </article>
              <article>
                <span>Room</span>
                <strong>{placement.roomName ?? "—"}</strong>
              </article>
              <article>
                <span>Result</span>
                <strong>{placement.resultScore ?? "Pending"}</strong>
              </article>
            </div>
            {scheduled ? (
              <>
                <form
                  onSubmit={event => {
                    event.preventDefault();
                    void run(
                      patchNccPlacementTestRequest(placement.id, {
                        scheduledAt: scheduledAt
                          ? new Date(scheduledAt).toISOString()
                          : undefined,
                        roomId: roomId || undefined,
                      })
                    );
                  }}
                >
                  <label>
                    Reschedule
                    <input
                      type="datetime-local"
                      value={scheduledAt}
                      onChange={event => setScheduledAt(event.target.value)}
                    />
                  </label>
                  <label>
                    Room
                    <select
                      value={roomId}
                      onChange={event => setRoomId(event.target.value)}
                    >
                      <option value="">No room</option>
                      {rooms.map(room => (
                        <option key={room.id} value={room.id}>
                          {room.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button disabled={pending}>Reschedule</button>
                </form>
                <button
                  disabled={pending}
                  onClick={() =>
                    void run(
                      patchNccPlacementTestRequest(placement.id, {
                        status: "no_show",
                      })
                    )
                  }
                >
                  Mark no-show
                </button>
                <button
                  disabled={pending}
                  onClick={() => {
                    if (window.confirm("Cancel this placement test?"))
                      void run(cancelNccPlacementTestRequest(placement.id));
                  }}
                >
                  Cancel
                </button>
                <form
                  onSubmit={event => {
                    event.preventDefault();
                    void run(
                      recordNccPlacementResultRequest(placement.id, {
                        recommendedCourseId: courseId,
                        resultScore: score || undefined,
                        resultNotes: notes || undefined,
                      })
                    );
                  }}
                >
                  <label>
                    Recommended course
                    <select
                      value={courseId}
                      disabled={!courses.length}
                      onChange={event => setCourseId(event.target.value)}
                    >
                      <option value="">Choose course</option>
                      {courses.map(course => (
                        <option key={course.id} value={course.id}>
                          {course.fullname}
                        </option>
                      ))}
                    </select>
                  </label>
                  {!courses.length ? (
                    <p>
                      No EMS courses exist yet — results can be recorded once
                      courses are linked.
                    </p>
                  ) : null}
                  <label>
                    Score
                    <input
                      value={score}
                      onChange={event => setScore(event.target.value)}
                    />
                  </label>
                  <label>
                    Notes
                    <textarea
                      value={notes}
                      onChange={event => setNotes(event.target.value)}
                    />
                  </label>
                  <button disabled={pending || !courseId}>Record result</button>
                </form>
              </>
            ) : null}
            {error ? (
              <p className="platform-form-error" role="alert">
                {error}
              </p>
            ) : null}
          </section>
        }
      />
    </PlatformShell>
  );
}

export default function RegistrarAdmissionsPage({
  view,
  leadId,
  applicationId,
  bookingId,
}: RegistrarAdmissionsPageProps) {
  if (getStoredAuthSession()?.provider === "ncc") {
    if (view === "lead-create") return <NccLeadCreatePage />;
    if (view === "lead-detail" && leadId)
      return <NccLeadRecordPage leadId={leadId} />;
    if (view === "placement-create") return <NccPlacementCreatePage />;
    if (view === "placement-detail" && bookingId)
      return <NccPlacementRecordPage bookingId={bookingId} />;
    return (
      <NccRegistrarAdmissionsPage
        view={view}
        leadId={leadId}
        bookingId={bookingId}
      />
    );
  }
  return (
    <CompatibilityRegistrarAdmissionsPage
      view={view}
      leadId={leadId}
      applicationId={applicationId}
      bookingId={bookingId}
    />
  );
}

type NccAdmissionsData =
  | { kind: "leads"; items: NccLeadDto[] }
  | { kind: "lead"; item: NccLeadDto }
  | { kind: "placements"; items: NccPlacementTestDto[] }
  | { kind: "placement"; item: NccPlacementTestDto };

function NccRegistrarAdmissionsPage({
  view,
  leadId,
  bookingId,
}: Pick<RegistrarAdmissionsPageProps, "view" | "leadId" | "bookingId">) {
  const [search, setSearch] = useState("");
  const [readState, setReadState] = useState<NccReadState<NccAdmissionsData>>({
    status: "loading",
  });
  const load = useCallback(async () => {
    if (view === "leads") {
      setReadState({ status: "loading" });
      const result = await fetchNccLeadsRequest();
      setReadState(
        result.ok && result.data
          ? {
              status: "ready",
              data: { kind: "leads", items: result.data.items },
            }
          : classifyNccFailure(result)
      );
      return;
    }
    if (view === "lead-detail" && leadId) {
      setReadState({ status: "loading" });
      const result = await fetchNccLeadRequest(leadId);
      setReadState(
        result.ok && result.data
          ? { status: "ready", data: { kind: "lead", item: result.data.lead } }
          : classifyNccFailure(result)
      );
      return;
    }
    if (view === "placement-tests") {
      setReadState({ status: "loading" });
      const result = await fetchNccPlacementTestsRequest();
      setReadState(
        result.ok && result.data
          ? {
              status: "ready",
              data: { kind: "placements", items: result.data.items },
            }
          : classifyNccFailure(result)
      );
      return;
    }
    if (view === "placement-detail" && bookingId) {
      setReadState({ status: "loading" });
      const result = await fetchNccPlacementTestRequest(bookingId);
      setReadState(
        result.ok && result.data
          ? {
              status: "ready",
              data: { kind: "placement", item: result.data.placementTest },
            }
          : classifyNccFailure(result)
      );
    }
  }, [bookingId, leadId, view]);
  useEffect(() => {
    void load();
  }, [load]);
  const navigation = (
    <nav className="portal-simple-tabs" aria-label="Admissions work areas">
      <Link
        className={view === "leads" || view === "lead-detail" ? "active" : ""}
        href="/app/registrar/leads"
      >
        Leads
      </Link>
      <Link
        className={view.startsWith("application") ? "active" : ""}
        href="/app/registrar/applications"
      >
        Applications
      </Link>
      <Link
        className={
          view === "placement-tests" || view === "placement-detail"
            ? "active"
            : ""
        }
        href="/app/registrar/placement-tests"
      >
        Placement
      </Link>
    </nav>
  );

  if (view.startsWith("application")) {
    return (
      <PlatformShell role="registrar" title="Applications">
        <WorkspaceLayout
          title="Applications"
          description="Review admissions work in EMS."
          context="Registrar"
          toolbar={navigation}
          main={
            <div className="platform-empty-state" role="status">
              <strong>
                Applications are not available in EMS yet — leads convert
                directly to students.
              </strong>
            </div>
          }
        />
      </PlatformShell>
    );
  }

  if (view === "lead-create" || view === "placement-create") {
    const leadCreate = view === "lead-create";
    return (
      <PlatformShell
        role="registrar"
        title={leadCreate ? "New lead" : "Book placement"}
      >
        <FormFlowLayout
          title={leadCreate ? "New lead" : "Book placement"}
          description="Create this record in EMS for now."
          context="Registrar"
          main={
            <div className="platform-empty-state" role="status">
              <strong>
                {leadCreate
                  ? "Lead creation is not connected yet"
                  : "Placement booking is not connected yet"}
              </strong>
              <Link
                className="platform-secondary-button"
                href={
                  leadCreate
                    ? "/app/registrar/leads"
                    : "/app/registrar/placement-tests"
                }
              >
                Back
              </Link>
            </div>
          }
        />
      </PlatformShell>
    );
  }

  if (readState.status !== "ready") {
    return (
      <PlatformShell role="registrar" title="Admissions">
        <WorkspaceLayout
          title="Admissions"
          description="Read admissions records from EMS."
          context="Registrar"
          toolbar={navigation}
          main={<NccReadStatus state={readState} onRetry={() => void load()} />}
        />
      </PlatformShell>
    );
  }

  if (readState.data.kind === "lead") {
    const lead = readState.data.item;
    return (
      <PlatformShell role="registrar" title="Lead detail">
        <DetailLayout
          title={lead.name}
          description={`${lead.email} · ${lead.branchName}`}
          context="Registrar"
          actions={
            <Link
              className="platform-secondary-button"
              href="/app/registrar/leads"
            >
              Back to leads
            </Link>
          }
          main={
            <section className="registrar-panel registrar-detail-focus">
              <div className="registrar-detail-grid">
                {[
                  ["Status", statusLabel(lead.status)],
                  ["Phone", lead.phone ?? "—"],
                  ["Branch", lead.branchName],
                  ["Source", lead.source ?? "—"],
                  [
                    "Preferred courses",
                    lead.preferredCourses.length
                      ? lead.preferredCourses
                          .map(course => course.name)
                          .join(", ")
                      : "—",
                  ],
                  [
                    "Entry path",
                    lead.entryPath ? statusLabel(lead.entryPath) : "—",
                  ],
                  ["Notes", lead.notes ?? "—"],
                  ["Created", formatDate(lead.createdAt)],
                ].map(([label, value]) => (
                  <article key={label}>
                    <span>{label}</span>
                    <strong>{value}</strong>
                  </article>
                ))}
                {lead.studentId ? (
                  <Link
                    className="registrar-row-link"
                    href={`/app/registrar/students/${lead.studentId}`}
                  >
                    Converted student
                  </Link>
                ) : null}
              </div>
            </section>
          }
        />
      </PlatformShell>
    );
  }

  if (readState.data.kind === "placement") {
    const placement = readState.data.item;
    return (
      <PlatformShell role="registrar" title="Placement detail">
        <DetailLayout
          title={placement.subject.name}
          description={`${placement.subject.email} · ${placement.branchName}`}
          context="Registrar"
          actions={
            <Link
              className="platform-secondary-button"
              href="/app/registrar/placement-tests"
            >
              Back to placement
            </Link>
          }
          main={
            <section className="registrar-panel registrar-detail-focus">
              <div className="registrar-detail-grid">
                {[
                  ["Subject type", statusLabel(placement.subject.type)],
                  ["Status", statusLabel(placement.status)],
                  ["Scheduled", formatDate(placement.scheduledAt ?? undefined)],
                  ["Room", placement.roomName ?? "—"],
                  ["Branch", placement.branchName],
                  [
                    "Recommended course",
                    placement.recommendedCourseName ?? "—",
                  ],
                  ["Result score", placement.resultScore ?? "—"],
                  ["Result notes", placement.resultNotes ?? "—"],
                  ["Completed", formatDate(placement.completedAt ?? undefined)],
                  ["Cancelled", formatDate(placement.cancelledAt ?? undefined)],
                ].map(([label, value]) => (
                  <article key={label}>
                    <span>{label}</span>
                    <strong>{value}</strong>
                  </article>
                ))}
              </div>
            </section>
          }
        />
      </PlatformShell>
    );
  }

  const items = readState.data.items.filter(item => {
    const text =
      readState.data.kind === "leads"
        ? `${(item as NccLeadDto).name} ${(item as NccLeadDto).email} ${(item as NccLeadDto).phone ?? ""} ${(item as NccLeadDto).branchName} ${(item as NccLeadDto).source ?? ""}`
        : `${(item as NccPlacementTestDto).subject.name} ${(item as NccPlacementTestDto).subject.email} ${(item as NccPlacementTestDto).branchName} ${(item as NccPlacementTestDto).roomName ?? ""}`;
    return text.toLowerCase().includes(search.trim().toLowerCase());
  });
  const isLeadList = readState.data.kind === "leads";
  return (
    <PlatformShell
      role="registrar"
      title={isLeadList ? "Leads" : "Placement tests"}
    >
      <WorkspaceLayout
        title={isLeadList ? "Leads" : "Placement tests"}
        description={
          isLeadList
            ? "Review enquiries from EMS."
            : "Review placement tests from EMS."
        }
        context="Registrar"
        toolbar={
          <div className="registrar-admissions-toolbar-v3">
            {navigation}
            <label className="platform-search-field">
              <Search size={16} />
              <input
                value={search}
                onChange={event => setSearch(event.target.value)}
                placeholder="Search admissions records"
                aria-label="Search admissions records"
              />
            </label>
          </div>
        }
        main={
          <DataTableCard
            title={isLeadList ? "Lead records" : "Placement bookings"}
            subtitle={`${items.length} visible record(s)`}
          >
            {items.length ? (
              <div className="platform-directory-table-wrap">
                {isLeadList ? (
                  <OperationalDirectoryTable
                    rows={items as NccLeadDto[]}
                    rowKey={row => row.id}
                    columns={[
                      {
                        key: "lead",
                        label: "Lead",
                        render: row => (
                          <div>
                            <strong>{row.name}</strong>
                            <small>{row.email}</small>
                          </div>
                        ),
                      },
                      {
                        key: "phone",
                        label: "Phone",
                        render: row => row.phone ?? "—",
                      },
                      {
                        key: "branch",
                        label: "Branch",
                        render: row => row.branchName,
                      },
                      {
                        key: "source",
                        label: "Source",
                        render: row => row.source ?? "—",
                      },
                      {
                        key: "status",
                        label: "Status",
                        render: row => (
                          <StatusBadge tone={nccStatusTone(row.status)}>
                            {statusLabel(row.status)}
                          </StatusBadge>
                        ),
                      },
                    ]}
                    action={{
                      href: row => `/app/registrar/leads/${row.id}`,
                      label: row => row.name,
                    }}
                  />
                ) : (
                  <OperationalDirectoryTable
                    rows={items as NccPlacementTestDto[]}
                    rowKey={row => row.id}
                    columns={[
                      {
                        key: "subject",
                        label: "Subject",
                        render: row => (
                          <div>
                            <strong>{row.subject.name}</strong>
                            <small>{row.subject.email}</small>
                            <StatusBadge tone="amber">
                              {row.subject.type}
                            </StatusBadge>
                          </div>
                        ),
                      },
                      {
                        key: "scheduled",
                        label: "Scheduled at",
                        render: row => formatDate(row.scheduledAt ?? undefined),
                      },
                      {
                        key: "room",
                        label: "Room",
                        render: row => row.roomName ?? "—",
                      },
                      {
                        key: "branch",
                        label: "Branch",
                        render: row => row.branchName,
                      },
                      {
                        key: "status",
                        label: "Status",
                        render: row => (
                          <StatusBadge tone={nccStatusTone(row.status)}>
                            {statusLabel(row.status)}
                          </StatusBadge>
                        ),
                      },
                    ]}
                    action={{
                      href: row => `/app/registrar/placement-tests/${row.id}`,
                      label: row => row.subject.name,
                    }}
                  />
                )}
              </div>
            ) : (
              <div className="platform-empty-state">
                <strong>No records found</strong>
              </div>
            )}
          </DataTableCard>
        }
      />
    </PlatformShell>
  );
}

function CompatibilityRegistrarAdmissionsPage({
  view,
  leadId,
  applicationId,
  bookingId,
}: RegistrarAdmissionsPageProps) {
  const initialState = platformStore.getState();
  const initialApplication = applicationId
    ? initialState.applications.find(item => item.id === applicationId)
    : undefined;
  const initialApplicationLead = initialApplication
    ? initialState.leads.find(item => item.id === initialApplication.leadId)
    : undefined;
  const [version, setVersion] = useState(0);
  const [search, setSearch] = useState("");
  const [creationResult, setCreationResult] = useState<{
    message: string;
    href: string;
    label: string;
  } | null>(null);
  const [pendingAction, setPendingAction] = useState("");
  const [selectedPlacementId, setSelectedPlacementId] = useState(
    bookingId ?? ""
  );
  const [recommendedLevel, setRecommendedLevel] = useState("Arabic Level 2");
  const [score, setScore] = useState(78);
  const [leadDraft, setLeadDraft] = useState<LeadDraft>({
    fullName: "",
    email: "",
    phone: "",
    country: "",
    subject: "Arabic Language",
    source: "manual",
    notes: "",
  });
  const [applicationDraft, setApplicationDraft] = useState<ApplicationDraft>({
    fullName: "",
    email: "",
    phone: "",
    branchId: "br_online",
    courseInterest: "Arabic Language",
    schedulePreference: "To confirm",
    notes: "",
  });
  const [placementDraft, setPlacementDraft] = useState<PlacementDraft>({
    fullName: initialApplicationLead?.fullName ?? "",
    email: initialApplicationLead?.email ?? "",
    phone: initialApplicationLead?.phone ?? "",
    branchId: initialApplication?.branchId ?? "br_online",
    subject: initialApplication?.courseInterest ?? "Arabic Language",
    preferredDate: defaultPlacementDate(),
    currentLevel: "Placement pending",
  });

  const state = useMemo(() => platformStore.getState(), [version]);
  const actorId = requireActiveUser("registrar").id;
  const refresh = () => setVersion(current => current + 1);
  const isAnyActionPending = Boolean(pendingAction);

  const selectedLead = leadId
    ? state.leads.find(lead => lead.id === leadId)
    : state.leads[0];
  const selectedLeadApplication = state.applications.find(
    application => application.leadId === selectedLead?.id
  );
  const selectedApplication = applicationId
    ? state.applications.find(application => application.id === applicationId)
    : state.applications[0];
  const selectedApplicationLead = state.leads.find(
    lead => lead.id === selectedApplication?.leadId
  );
  const selectedApplicationBranch = state.branches.find(
    branch => branch.id === selectedApplication?.branchId
  );
  const selectedApplicationWorkflow = state.enrollmentWorkflows.find(
    workflow => workflow.applicationId === selectedApplication?.id
  );
  const selectedPlacement = bookingId
    ? state.placementTests.find(booking => booking.id === bookingId)
    : (state.placementTests.find(
        booking => booking.id === selectedPlacementId
      ) ??
      state.placementTests.find(booking => booking.status !== "completed") ??
      state.placementTests[0]);
  const selectedPlacementResult = state.placementResults.find(
    result => result.bookingId === selectedPlacement?.id
  );
  const selectedPlacementWorkflow = state.enrollmentWorkflows.find(
    workflow => workflow.placementTestId === selectedPlacement?.id
  );

  useEffect(() => {
    setCreationResult(null);
    if (view !== "placement-create" || !applicationId) return;
    const latestState = platformStore.getState();
    const application = latestState.applications.find(
      item => item.id === applicationId
    );
    const lead = application
      ? latestState.leads.find(item => item.id === application.leadId)
      : undefined;
    if (!application || !lead) return;
    setPlacementDraft(current => ({
      ...current,
      fullName: lead.fullName,
      email: lead.email,
      phone: lead.phone,
      branchId: application.branchId,
      subject: application.courseInterest,
    }));
  }, [applicationId, view]);

  const query = search.trim().toLowerCase();
  const filteredLeads = state.leads.filter(lead =>
    [lead.fullName, lead.email, lead.phone, lead.subject, lead.status]
      .join(" ")
      .toLowerCase()
      .includes(query)
  );
  const filteredApplications = state.applications.filter(application => {
    const lead = state.leads.find(item => item.id === application.leadId);
    const branch = state.branches.find(
      item => item.id === application.branchId
    );
    return [
      lead?.fullName,
      lead?.email,
      application.courseInterest,
      application.schedulePreference,
      branch?.name,
      application.status,
    ]
      .join(" ")
      .toLowerCase()
      .includes(query);
  });
  const filteredPlacements = state.placementTests.filter(booking => {
    const branch = state.branches.find(item => item.id === booking.branchId);
    return [
      booking.fullName,
      booking.email,
      booking.phone,
      booking.subject,
      booking.currentLevel,
      booking.recommendedLevel,
      branch?.name,
      booking.status,
    ]
      .join(" ")
      .toLowerCase()
      .includes(query);
  });

  const runRegistrarAction = async (
    actionKey: string,
    action: Parameters<typeof runPlatformWorkflowActionRequest>[0],
    successMessage: string,
    successDescription?: string
  ) => {
    setPendingAction(actionKey);
    try {
      const response = await runPlatformWorkflowActionRequest(action);
      if (!response.data) {
        throw new Error(
          response.error ?? "Registrar action returned no state."
        );
      }
      platformStore.setState(response.data.state);
      refresh();
      toast.success(
        successMessage,
        successDescription ? { description: successDescription } : undefined
      );
      return response.data.result;
    } catch (error) {
      toast.error("Registrar action could not be saved", {
        description:
          error instanceof Error
            ? error.message
            : "Check your session and try again.",
      });
      return undefined;
    } finally {
      setPendingAction("");
    }
  };

  const isActionPending = (key: string) => pendingAction === key;

  const createLead = async (event: FormEvent) => {
    event.preventDefault();
    if (!leadDraft.fullName.trim() || !leadDraft.phone.trim()) {
      toast.error("Name and phone are required");
      return;
    }
    const sourceKey = crypto.randomUUID();
    const result = await runRegistrarAction(
      "lead.create",
      {
        type: "lead.create",
        branchId: state.branches[0]?.id,
        fullName: leadDraft.fullName.trim(),
        email:
          leadDraft.email.trim() ||
          `${Date.now().toString(36)}@nilelearn.local`,
        phone: leadDraft.phone.trim(),
        country: leadDraft.country.trim() || "Egypt",
        subject: leadDraft.subject.trim() || "Arabic Language",
        source: leadDraft.source,
        notes: leadDraft.notes.trim(),
        sourceKey,
        idempotencyKey: `lead.create:${sourceKey}`,
        actorId,
      },
      "Lead added to admissions"
    );
    if (result) {
      setLeadDraft({
        fullName: "",
        email: "",
        phone: "",
        country: "",
        subject: "Arabic Language",
        source: "manual",
        notes: "",
      });
      setCreationResult({
        message: "The enquiry has been added to the admissions queue.",
        href: "/app/registrar/leads",
        label: "View leads",
      });
    }
  };

  const convertLead = async (id: string) => {
    const lead = state.leads.find(item => item.id === id);
    await runRegistrarAction(
      `lead.convert:${id}`,
      {
        type: "lead.convert",
        leadId: id,
        actorId,
        expectedVersion: lead?.version ?? 1,
        idempotencyKey: `lead.convert:${id}`,
      },
      "Lead converted to application"
    );
  };

  const createApplication = async (event: FormEvent) => {
    event.preventDefault();
    if (
      !applicationDraft.fullName.trim() ||
      !applicationDraft.email.trim() ||
      !applicationDraft.phone.trim()
    ) {
      toast.error("Applicant name, email, and phone are required");
      return;
    }
    const sourceKey = crypto.randomUUID();
    const result = await runRegistrarAction(
      "application.create",
      {
        type: "application.create",
        fullName: applicationDraft.fullName.trim(),
        email: applicationDraft.email.trim(),
        phone: applicationDraft.phone.trim(),
        branchId: applicationDraft.branchId,
        courseInterest:
          applicationDraft.courseInterest.trim() || "Arabic Language",
        schedulePreference:
          applicationDraft.schedulePreference.trim() || "To confirm",
        notes: applicationDraft.notes.trim() || undefined,
        country: "Egypt",
        source: "manual",
        sourceKey,
        idempotencyKey: `application.create:${sourceKey}`,
        actorId,
      },
      "Application created",
      "The application is ready for admissions review."
    );
    if (result) {
      setApplicationDraft(current => ({
        ...current,
        fullName: "",
        email: "",
        phone: "",
        notes: "",
      }));
      setCreationResult({
        message: "The application is ready for admissions review.",
        href: "/app/registrar/applications",
        label: "View applications",
      });
    }
  };

  const convertApplication = async (id: string) => {
    await runRegistrarAction(
      `application.convert:${id}`,
      { type: "application.convert", applicationId: id, actorId },
      "Application prepared for enrollment"
    );
  };

  const createPlacementBooking = async (event: FormEvent) => {
    event.preventDefault();
    if (
      !placementDraft.fullName.trim() ||
      !placementDraft.phone.trim() ||
      !placementDraft.preferredDate.trim()
    ) {
      toast.error("Name, phone, and date are required");
      return;
    }
    const sourceKey = crypto.randomUUID();
    const result = await runRegistrarAction(
      "placement.create",
      {
        type: "placement.create",
        fullName: placementDraft.fullName.trim(),
        email:
          placementDraft.email.trim() ||
          `${Date.now().toString(36)}@nilelearn.local`,
        phone: placementDraft.phone.trim(),
        branchId: placementDraft.branchId,
        subject: placementDraft.subject.trim() || "Arabic Language",
        preferredDate: placementDraft.preferredDate,
        currentLevel: placementDraft.currentLevel.trim() || "Placement pending",
        leadId: applicationId ? selectedApplicationLead?.id : undefined,
        sourceKey,
        idempotencyKey: `placement.create:${sourceKey}`,
        actorId,
      },
      "Placement booking added"
    );
    if (result && typeof result === "object" && "result" in result) {
      const booking = result.result as { id?: string } | undefined;
      if (booking?.id) setSelectedPlacementId(booking.id);
    }
    if (result) {
      setPlacementDraft(current => ({
        ...current,
        fullName: "",
        email: "",
        phone: "",
        subject: "Arabic Language",
        preferredDate: defaultPlacementDate(),
        currentLevel: "Placement pending",
      }));
      const booking =
        result && typeof result === "object" && "result" in result
          ? (result.result as { id?: string } | undefined)
          : undefined;
      setCreationResult({
        message: "The placement booking is ready for review.",
        href: booking?.id
          ? `/app/registrar/placement-tests/${booking.id}`
          : "/app/registrar/placement-tests",
        label: booking?.id ? "Open booking" : "View placement bookings",
      });
    }
  };

  const recordPlacement = async () => {
    if (!selectedPlacement) {
      toast.error("No placement booking selected");
      return;
    }
    await runRegistrarAction(
      `placement.result.record:${selectedPlacement.id}`,
      {
        type: "placement.result.record",
        bookingId: selectedPlacement.id,
        recommendedLevel: recommendedLevel.trim() || "Arabic Level 2",
        score: Math.max(0, Math.min(100, Number(score) || 0)),
        notes: "Recorded from registrar admissions workspace.",
        expectedVersion: selectedPlacement.version ?? 1,
        idempotencyKey: `placement.result.record:${selectedPlacement.id}`,
        actorId,
      },
      "Placement result recorded"
    );
  };

  const admissionsNavigation = (
    <>
      <Link
        className={view === "leads" || view === "lead-detail" ? "active" : ""}
        href="/app/registrar/leads"
      >
        Leads
      </Link>
      <Link
        className={
          view === "applications" || view === "application-detail"
            ? "active"
            : ""
        }
        href="/app/registrar/applications"
      >
        Applications
      </Link>
      <Link
        className={
          view === "placement-tests" || view === "placement-detail"
            ? "active"
            : ""
        }
        href="/app/registrar/placement-tests"
      >
        Placement
      </Link>
    </>
  );

  const admissionsToolbar = (
    <div className="registrar-admissions-toolbar-v3">
      <nav className="portal-simple-tabs" aria-label="Admissions work areas">
        {admissionsNavigation}
      </nav>
      <label className="platform-search-field">
        <Search size={16} />
        <input
          value={search}
          onChange={event => setSearch(event.target.value)}
          placeholder="Search admissions records"
          aria-label="Search admissions records"
        />
      </label>
    </div>
  );

  const leadList = (
    <DataTableCard
      title="Lead records"
      subtitle={`${filteredLeads.length} visible lead(s)`}
      className="registrar-panel registrar-admissions-card"
    >
      <div className="registrar-lead-list">
        {filteredLeads.map(lead => {
          const converted = state.applications.some(
            application => application.leadId === lead.id
          );
          return (
            <article key={lead.id}>
              <div>
                <strong>{lead.fullName}</strong>
                <small>
                  {lead.subject} · {lead.phone} · {lead.source}
                </small>
              </div>
              <span>{statusLabel(lead.status)}</span>
              <Link
                className="registrar-row-link"
                href={`/app/registrar/leads/${lead.id}`}
              >
                Open
              </Link>
              <button
                type="button"
                disabled={converted || isAnyActionPending}
                onClick={() => convertLead(lead.id)}
              >
                {isActionPending(`lead.convert:${lead.id}`)
                  ? "Converting..."
                  : converted
                    ? "Converted"
                    : "Convert"}
              </button>
            </article>
          );
        })}
        {!filteredLeads.length ? (
          <article className="registrar-empty-row">
            <div>
              <strong>No leads match this view</strong>
              <small>Add a lead or clear the search.</small>
            </div>
          </article>
        ) : null}
      </div>
    </DataTableCard>
  );

  const leadForm = (
    <section className="registrar-panel">
      <div className="registrar-panel-head">
        <div>
          <span>Lead intake</span>
          <strong>Add one enquiry</strong>
        </div>
        <Link className="registrar-inline-close" href="/app/registrar/leads">
          Cancel
        </Link>
      </div>
      <form className="registrar-lead-form" onSubmit={createLead}>
        <label>
          Full name
          <input
            value={leadDraft.fullName}
            onChange={event =>
              setLeadDraft(current => ({
                ...current,
                fullName: event.target.value,
              }))
            }
            placeholder="Student or guardian name"
          />
        </label>
        <label>
          Phone
          <input
            value={leadDraft.phone}
            onChange={event =>
              setLeadDraft(current => ({
                ...current,
                phone: event.target.value,
              }))
            }
            placeholder="+20..."
          />
        </label>
        <label>
          Email
          <input
            type="email"
            value={leadDraft.email}
            onChange={event =>
              setLeadDraft(current => ({
                ...current,
                email: event.target.value,
              }))
            }
            placeholder="email@example.com"
          />
        </label>
        <label>
          Subject
          <input
            value={leadDraft.subject}
            onChange={event =>
              setLeadDraft(current => ({
                ...current,
                subject: event.target.value,
              }))
            }
          />
        </label>
        <label>
          Source
          <select
            value={leadDraft.source}
            onChange={event =>
              setLeadDraft(current => ({
                ...current,
                source: event.target.value as Lead["source"],
              }))
            }
          >
            <option value="manual">Manual</option>
            <option value="website">Website</option>
            <option value="trial_form">Trial form</option>
            <option value="placement_form">Placement form</option>
            <option value="whatsapp">WhatsApp</option>
          </select>
        </label>
        <label>
          Notes
          <input
            value={leadDraft.notes}
            onChange={event =>
              setLeadDraft(current => ({
                ...current,
                notes: event.target.value,
              }))
            }
            placeholder="Schedule, branch, or language notes"
          />
        </label>
        <button type="submit" disabled={isAnyActionPending}>
          <UserPlus size={15} />
          {isActionPending("lead.create") ? "Adding..." : "Add lead"}
        </button>
      </form>
    </section>
  );

  const applicationsList = (
    <DataTableCard
      title="Application files"
      subtitle={`${filteredApplications.length} visible application(s)`}
      className="registrar-panel registrar-admissions-card"
    >
      <div className="registrar-application-list">
        {filteredApplications.map(application => {
          const lead = state.leads.find(item => item.id === application.leadId);
          const branch = state.branches.find(
            item => item.id === application.branchId
          );
          const workflow = state.enrollmentWorkflows.find(
            item => item.applicationId === application.id
          );
          return (
            <article key={application.id}>
              <div>
                <strong>{lead?.fullName ?? application.id}</strong>
                <small>
                  {application.courseInterest} · {branch?.name ?? "No branch"} ·{" "}
                  {application.schedulePreference}
                </small>
              </div>
              <span>{statusLabel(application.status)}</span>
              <Link
                className="registrar-row-link"
                href={`/app/registrar/applications/${application.id}`}
              >
                Open
              </Link>
              <button
                type="button"
                disabled={Boolean(workflow) || isAnyActionPending}
                onClick={() => convertApplication(application.id)}
              >
                {isActionPending(`application.convert:${application.id}`)
                  ? "Preparing..."
                  : workflow
                    ? "Prepared"
                    : "Prepare"}
              </button>
            </article>
          );
        })}
        {!filteredApplications.length ? (
          <article className="registrar-empty-row">
            <div>
              <strong>No applications match this view</strong>
              <small>Create an application or clear the search.</small>
            </div>
          </article>
        ) : null}
      </div>
    </DataTableCard>
  );

  const applicationForm = (
    <section className="registrar-panel">
      <div className="registrar-panel-head">
        <div>
          <span>Application intake</span>
          <strong>Create one application file</strong>
        </div>
        <Link
          className="registrar-inline-close"
          href="/app/registrar/applications"
        >
          Cancel
        </Link>
      </div>
      <form
        className="registrar-application-form"
        onSubmit={createApplication}
        aria-label="Create registrar application"
      >
        <label>
          Applicant name
          <input
            name="applicationFullName"
            value={applicationDraft.fullName}
            onChange={event =>
              setApplicationDraft(current => ({
                ...current,
                fullName: event.target.value,
              }))
            }
            placeholder="Student or guardian name"
          />
        </label>
        <label>
          Email
          <input
            name="applicationEmail"
            type="email"
            value={applicationDraft.email}
            onChange={event =>
              setApplicationDraft(current => ({
                ...current,
                email: event.target.value,
              }))
            }
            placeholder="applicant@nilelearn.local"
          />
        </label>
        <label>
          Phone
          <input
            name="applicationPhone"
            value={applicationDraft.phone}
            onChange={event =>
              setApplicationDraft(current => ({
                ...current,
                phone: event.target.value,
              }))
            }
            placeholder="+20..."
          />
        </label>
        <label>
          Branch
          <select
            name="applicationBranch"
            value={applicationDraft.branchId}
            onChange={event =>
              setApplicationDraft(current => ({
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
          Course interest
          <input
            name="applicationCourseInterest"
            value={applicationDraft.courseInterest}
            onChange={event =>
              setApplicationDraft(current => ({
                ...current,
                courseInterest: event.target.value,
              }))
            }
          />
        </label>
        <label>
          Schedule preference
          <input
            name="applicationSchedulePreference"
            value={applicationDraft.schedulePreference}
            onChange={event =>
              setApplicationDraft(current => ({
                ...current,
                schedulePreference: event.target.value,
              }))
            }
            placeholder="Morning, evening, weekend"
          />
        </label>
        <label className="wide">
          Notes
          <input
            name="applicationNotes"
            value={applicationDraft.notes}
            onChange={event =>
              setApplicationDraft(current => ({
                ...current,
                notes: event.target.value,
              }))
            }
            placeholder="Placement, guardian, schedule, or payment context"
          />
        </label>
        <button type="submit" disabled={isAnyActionPending}>
          <UserPlus size={15} />
          {isActionPending("application.create")
            ? "Creating..."
            : "Create application"}
        </button>
      </form>
    </section>
  );

  const placementList = (
    <DataTableCard
      title="Placement bookings"
      subtitle={`${filteredPlacements.length} visible booking(s)`}
      className="registrar-panel registrar-admissions-card"
    >
      <div className="registrar-application-list">
        {filteredPlacements.map(booking => {
          const branch = state.branches.find(
            item => item.id === booking.branchId
          );
          return (
            <article key={booking.id}>
              <div>
                <strong>{booking.fullName}</strong>
                <small>
                  {booking.subject} · {formatDate(booking.preferredDate)} ·{" "}
                  {branch?.name ?? "No branch"}
                </small>
              </div>
              <span>{statusLabel(booking.status)}</span>
              <Link
                className="registrar-row-link"
                href={`/app/registrar/placement-tests/${booking.id}`}
              >
                Open
              </Link>
              <StatusBadge tone={statusTone(booking.status)}>
                {booking.recommendedLevel ?? booking.currentLevel}
              </StatusBadge>
            </article>
          );
        })}
        {!filteredPlacements.length ? (
          <article className="registrar-empty-row">
            <div>
              <strong>No placement bookings match this view</strong>
              <small>Book a placement test or clear the search.</small>
            </div>
          </article>
        ) : null}
      </div>
    </DataTableCard>
  );

  const placementForm = (
    <section className="registrar-panel">
      <div className="registrar-panel-head">
        <div>
          <span>Placement booking</span>
          <strong>Book one test</strong>
        </div>
        <Link
          className="registrar-inline-close"
          href="/app/registrar/placement-tests"
        >
          Cancel
        </Link>
      </div>
      <form
        className="registrar-placement-booking-form"
        onSubmit={createPlacementBooking}
      >
        <label>
          Student name
          <input
            value={placementDraft.fullName}
            onChange={event =>
              setPlacementDraft(current => ({
                ...current,
                fullName: event.target.value,
              }))
            }
            placeholder="Student or guardian name"
          />
        </label>
        <label>
          Phone
          <input
            value={placementDraft.phone}
            onChange={event =>
              setPlacementDraft(current => ({
                ...current,
                phone: event.target.value,
              }))
            }
            placeholder="+20..."
          />
        </label>
        <label>
          Email
          <input
            type="email"
            value={placementDraft.email}
            onChange={event =>
              setPlacementDraft(current => ({
                ...current,
                email: event.target.value,
              }))
            }
            placeholder="optional"
          />
        </label>
        <label>
          Branch
          <select
            value={placementDraft.branchId}
            onChange={event =>
              setPlacementDraft(current => ({
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
          Subject
          <input
            value={placementDraft.subject}
            onChange={event =>
              setPlacementDraft(current => ({
                ...current,
                subject: event.target.value,
              }))
            }
          />
        </label>
        <label>
          Preferred date
          <input
            type="date"
            value={placementDraft.preferredDate}
            onChange={event =>
              setPlacementDraft(current => ({
                ...current,
                preferredDate: event.target.value,
              }))
            }
          />
        </label>
        <label className="wide">
          Current level
          <input
            value={placementDraft.currentLevel}
            onChange={event =>
              setPlacementDraft(current => ({
                ...current,
                currentLevel: event.target.value,
              }))
            }
            placeholder="What the learner can already do"
          />
        </label>
        <button type="submit" disabled={isAnyActionPending}>
          <UserPlus size={15} />
          {isActionPending("placement.create")
            ? "Booking..."
            : "Book placement"}
        </button>
      </form>
    </section>
  );

  const placementResultCard = (
    <section className="registrar-panel registrar-placement-card">
      <div className="registrar-panel-head">
        <div>
          <span>Result</span>
          <strong>
            {selectedPlacement?.fullName ?? "No booking selected"}
          </strong>
        </div>
        <CheckCircle2 size={18} />
      </div>
      {!bookingId ? (
        <label>
          Booking
          <select
            value={selectedPlacement?.id ?? ""}
            onChange={event => setSelectedPlacementId(event.target.value)}
          >
            {state.placementTests.map(booking => (
              <option key={booking.id} value={booking.id}>
                {booking.fullName} · {booking.subject}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <small>
        {selectedPlacement
          ? `${formatDate(selectedPlacement.preferredDate)} · ${selectedPlacement.currentLevel} · ${selectedPlacement.status}`
          : "Create a placement booking first."}
      </small>
      <div className="registrar-placement-inputs">
        <label>
          Recommended level
          <input
            value={recommendedLevel}
            onChange={event => setRecommendedLevel(event.target.value)}
          />
        </label>
        <label>
          Score
          <input
            type="number"
            min={0}
            max={100}
            value={score}
            onChange={event => setScore(Number(event.target.value))}
          />
        </label>
      </div>
      <button
        type="button"
        disabled={
          !selectedPlacement ||
          selectedPlacement.status === "completed" ||
          isAnyActionPending
        }
        onClick={recordPlacement}
      >
        <CheckCircle2 size={15} />
        {isActionPending(`placement.result.record:${selectedPlacement?.id}`)
          ? "Saving result..."
          : selectedPlacement?.status === "completed"
            ? "Result recorded"
            : "Record placement result"}
      </button>
    </section>
  );

  if (
    view === "lead-create" ||
    view === "application-create" ||
    view === "placement-create"
  ) {
    const createConfig =
      view === "lead-create"
        ? {
            title: "New lead",
            description: "Capture one new enquiry for the admissions team.",
            form: leadForm,
          }
        : view === "application-create"
          ? {
              title: "New application",
              description: "Create one application file for admissions review.",
              form: applicationForm,
            }
          : {
              title: "Book placement",
              description: "Schedule one learner placement test.",
              form: placementForm,
            };

    return (
      <PlatformShell role="registrar" title={createConfig.title}>
        <FormFlowLayout
          className="registrar-admissions-page registrar-create-page"
          title={createConfig.title}
          description={createConfig.description}
          context="Registrar"
          actions={
            creationResult ? (
              <Link
                className="platform-primary-button"
                href={creationResult.href}
              >
                {creationResult.label}
              </Link>
            ) : undefined
          }
          main={
            creationResult ? (
              <section className="registrar-create-success" role="status">
                <CheckCircle2 size={20} />
                <div>
                  <strong>Saved</strong>
                  <span>{creationResult.message}</span>
                </div>
              </section>
            ) : (
              createConfig.form
            )
          }
        />
      </PlatformShell>
    );
  }

  if (view === "lead-detail") {
    const missing = leadId && !selectedLead;
    return (
      <PlatformShell role="registrar" title="Lead detail">
        <DetailLayout
          title={selectedLead?.fullName ?? "Lead detail"}
          description="Review one enquiry and decide the next admissions action."
          context="Registrar"
          actions={
            <Link
              className="platform-secondary-button"
              href="/app/registrar/leads"
            >
              <ArrowRight size={15} />
              Back to leads
            </Link>
          }
          main={
            missing ? (
              <div className="registrar-detail-empty">
                <AlertCircle size={18} />
                <div>
                  <strong>This lead does not exist.</strong>
                  <small>Use the leads page to choose a valid record.</small>
                </div>
              </div>
            ) : (
              <section className="registrar-panel registrar-detail-focus">
                <div className="registrar-panel-head">
                  <div>
                    <span>Lead lifecycle</span>
                    <strong>{selectedLead?.fullName}</strong>
                  </div>
                  <Megaphone size={18} />
                </div>
                <div className="registrar-detail-grid">
                  <article>
                    <span>Status</span>
                    <strong>{selectedLead?.status}</strong>
                    <small>{selectedLead?.subject}</small>
                  </article>
                  <article>
                    <span>Contact</span>
                    <strong>{selectedLead?.phone}</strong>
                    <small>{selectedLead?.email}</small>
                  </article>
                  <article>
                    <span>Application</span>
                    <strong>
                      {selectedLeadApplication ? "Converted" : "Not converted"}
                    </strong>
                    <small>
                      {selectedLeadApplication?.courseInterest ??
                        selectedLead?.notes ??
                        "Ready for follow-up"}
                    </small>
                  </article>
                  <button
                    type="button"
                    disabled={
                      !selectedLead ||
                      Boolean(selectedLeadApplication) ||
                      isAnyActionPending
                    }
                    onClick={() => selectedLead && convertLead(selectedLead.id)}
                  >
                    <UserPlus size={15} />
                    {isActionPending(`lead.convert:${selectedLead?.id}`)
                      ? "Converting..."
                      : selectedLeadApplication
                        ? "Application exists"
                        : "Convert lead"}
                  </button>
                </div>
              </section>
            )
          }
        />
      </PlatformShell>
    );
  }

  if (view === "application-detail") {
    const missing = applicationId && !selectedApplication;
    return (
      <PlatformShell role="registrar" title="Application detail">
        <DetailLayout
          title={selectedApplicationLead?.fullName ?? "Application detail"}
          description="Review one application file and prepare enrollment when ready."
          context="Registrar"
          actions={
            <Link
              className="platform-secondary-button"
              href="/app/registrar/applications"
            >
              <ArrowRight size={15} />
              Back to applications
            </Link>
          }
          main={
            missing ? (
              <div className="registrar-detail-empty">
                <AlertCircle size={18} />
                <div>
                  <strong>This application does not exist.</strong>
                  <small>
                    Use the applications page to choose a valid file.
                  </small>
                </div>
              </div>
            ) : (
              <section className="registrar-panel registrar-detail-focus">
                <div className="registrar-panel-head">
                  <div>
                    <span>Application lifecycle</span>
                    <strong>{selectedApplicationLead?.fullName}</strong>
                  </div>
                  <FileText size={18} />
                </div>
                <div className="registrar-detail-grid">
                  <article>
                    <span>Status</span>
                    <strong>{selectedApplication?.status}</strong>
                    <small>{selectedApplication?.courseInterest}</small>
                  </article>
                  <article>
                    <span>Applicant</span>
                    <strong>{selectedApplicationLead?.phone}</strong>
                    <small>{selectedApplicationLead?.email}</small>
                  </article>
                  <article>
                    <span>Branch</span>
                    <strong>
                      {selectedApplicationBranch?.name ?? "No branch"}
                    </strong>
                    <small>{selectedApplication?.schedulePreference}</small>
                  </article>
                  <article>
                    <span>Enrollment handoff</span>
                    <strong>
                      {selectedApplicationWorkflow
                        ? "Prepared"
                        : "Not prepared"}
                    </strong>
                    <small>
                      {selectedApplicationWorkflow?.nextStep ??
                        "Prepare after branch, level, and course fit are confirmed."}
                    </small>
                  </article>
                  <button
                    type="button"
                    disabled={
                      !selectedApplication ||
                      Boolean(selectedApplicationWorkflow) ||
                      isAnyActionPending
                    }
                    onClick={() =>
                      selectedApplication &&
                      convertApplication(selectedApplication.id)
                    }
                  >
                    <UserPlus size={15} />
                    {isActionPending(
                      `application.convert:${selectedApplication?.id}`
                    )
                      ? "Preparing..."
                      : selectedApplicationWorkflow
                        ? "Enrollment prepared"
                        : "Prepare enrollment"}
                  </button>
                  <Link
                    className="registrar-row-link"
                    href="/app/registrar/enrollments"
                  >
                    <ArrowRight size={15} />
                    Open handoff
                  </Link>
                  <Link
                    className="registrar-row-link"
                    href={`/app/registrar/applications/${selectedApplication?.id}/placement`}
                  >
                    <ClipboardList size={15} />
                    Book placement
                  </Link>
                </div>
              </section>
            )
          }
        />
      </PlatformShell>
    );
  }

  if (view === "placement-detail") {
    const missing = bookingId && !selectedPlacement;
    return (
      <PlatformShell role="registrar" title="Placement detail">
        <DetailLayout
          title={selectedPlacement?.fullName ?? "Placement detail"}
          description="Record one placement result and prepare the enrollment handoff."
          context="Registrar"
          actions={
            <Link
              className="platform-secondary-button"
              href="/app/registrar/placement-tests"
            >
              <ArrowRight size={15} />
              Back to placement
            </Link>
          }
          main={
            missing ? (
              <div className="registrar-detail-empty">
                <AlertCircle size={18} />
                <div>
                  <strong>This placement booking does not exist.</strong>
                  <small>
                    Use the placement page to choose a valid booking.
                  </small>
                </div>
              </div>
            ) : (
              <section className="registrar-panel registrar-detail-focus">
                <div className="registrar-panel-head">
                  <div>
                    <span>Placement lifecycle</span>
                    <strong>{selectedPlacement?.fullName}</strong>
                  </div>
                  <ClipboardList size={18} />
                </div>
                <div className="registrar-detail-grid">
                  <article>
                    <span>Booking</span>
                    <strong>{selectedPlacement?.subject}</strong>
                    <small>
                      {formatDate(selectedPlacement?.preferredDate)} ·{" "}
                      {selectedPlacement?.currentLevel}
                    </small>
                  </article>
                  <article>
                    <span>Status</span>
                    <strong>{selectedPlacement?.status}</strong>
                    <small>
                      {selectedPlacementResult
                        ? `${selectedPlacementResult.score}/100`
                        : "Result pending"}
                    </small>
                  </article>
                  <article>
                    <span>Recommended level</span>
                    <strong>
                      {selectedPlacement?.recommendedLevel ??
                        selectedPlacementResult?.recommendedLevel ??
                        "Not recorded"}
                    </strong>
                    <small>
                      {selectedPlacementWorkflow?.nextStep ??
                        "Record a result to prepare enrollment."}
                    </small>
                  </article>
                </div>
                {placementResultCard}
              </section>
            )
          }
        />
      </PlatformShell>
    );
  }

  if (view === "applications") {
    return (
      <PlatformShell role="registrar" title="Applications">
        <WorkspaceLayout
          title="Applications"
          description="Review application files and prepare enrollment."
          context="Registrar"
          actions={
            <Link
              className="platform-primary-button"
              href="/app/registrar/applications/new"
            >
              <UserPlus size={15} />
              New application
            </Link>
          }
          toolbar={admissionsToolbar}
          main={applicationsList}
          className="registrar-workspace registrar-admissions-page"
        />
      </PlatformShell>
    );
  }

  if (view === "placement-tests") {
    return (
      <PlatformShell role="registrar" title="Placement tests">
        <WorkspaceLayout
          title="Placement tests"
          description="Review scheduled placement tests and learner levels."
          context="Registrar"
          actions={
            <Link
              className="platform-primary-button"
              href="/app/registrar/placement-tests/new"
            >
              <UserPlus size={15} />
              Book placement
            </Link>
          }
          toolbar={admissionsToolbar}
          main={placementList}
          className="registrar-workspace registrar-admissions-page"
        />
      </PlatformShell>
    );
  }

  return (
    <PlatformShell role="registrar" title="Leads">
      <WorkspaceLayout
        title="Leads"
        description="Review enquiries and convert ready contacts."
        context="Registrar"
        actions={
          <Link
            className="platform-primary-button"
            href="/app/registrar/leads/new"
          >
            <UserPlus size={15} />
            Add lead
          </Link>
        }
        toolbar={admissionsToolbar}
        main={leadList}
        className="registrar-workspace registrar-admissions-page"
      />
    </PlatformShell>
  );
}
