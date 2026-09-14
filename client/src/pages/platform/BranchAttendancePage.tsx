import { getStoredAuthSession, requireActiveUser } from "@/lib/auth/session";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, CircleSlash, Clock3, CircleX, Users } from "lucide-react";
import { toast } from "sonner";
import NccReadStatus from "@/components/platform/NccReadStatus";
import PlatformShell from "@/components/platform/PlatformShell";
import { WorkspaceLayout } from "@/components/platform/PlatformLayouts";
import {
  DataTableCard,
  StatusBadge,
} from "@/components/platform/PlatformPrimitives";
import {
  fetchNccClassesRequest,
  fetchNccClassSessionsRequest,
  fetchNccSessionAttendanceRequest,
  markNccSessionAttendanceRequest,
  runPlatformWorkflowActionRequest,
  type NccAttendanceDetailDto,
  type NccClassDto,
  type NccSessionDto,
} from "@/lib/backend/api";
import {
  classifyNccFailure,
  type NccReadState,
} from "@/lib/backend/nccReadState";
import { platformStore } from "@/lib/domain/store";
import type { AttendanceStatus } from "@/lib/domain/types";

const attendanceOptions: {
  value: AttendanceStatus;
  label: string;
  Icon: typeof Check;
}[] = [
  { value: "present", label: "Present", Icon: Check },
  { value: "late", label: "Late", Icon: Clock3 },
  { value: "absent", label: "Absent", Icon: CircleX },
  { value: "excused", label: "Excused", Icon: CircleSlash },
];

const attendanceLabels: Record<AttendanceStatus, string> = {
  present: "Present",
  late: "Late",
  absent: "Absent",
  excused: "Excused",
};

function attendanceTone(
  status: AttendanceStatus
): "green" | "amber" | "red" | "slate" {
  if (status === "present") return "green";
  if (status === "late" || status === "excused") return "amber";
  return "red";
}

function formatSession(value?: string) {
  if (!value) return "Not scheduled";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not scheduled";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export default function BranchAttendancePage() {
  return getStoredAuthSession()?.provider === "ncc" ? (
    <NccBranchAttendancePage />
  ) : (
    <CompatibilityBranchAttendancePage />
  );
}

function NccBranchAttendancePage() {
  const [readState, setReadState] = useState<
    NccReadState<{ classes: NccClassDto[]; sessions: NccSessionDto[] }>
  >({ status: "loading" });
  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedSessionId, setSelectedSessionId] = useState("");
  const [attendanceState, setAttendanceState] = useState<
    NccReadState<NccAttendanceDetailDto> | null
  >(null);
  const [draft, setDraft] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    kind: "success" | "error";
    text: string;
  } | null>(null);

  const load = useCallback(async () => {
    setReadState({ status: "loading" });
    const classesResult = await fetchNccClassesRequest();
    if (!classesResult.ok || !classesResult.data) {
      setReadState(classifyNccFailure(classesResult));
      return;
    }
    const classes = classesResult.data.items;
    const sessionResults = await Promise.all(
      classes.map(item => fetchNccClassSessionsRequest(item.id))
    );
    for (const result of sessionResults) {
      if (!result.ok || !result.data) {
        setReadState(classifyNccFailure(result));
        return;
      }
    }
    setReadState({
      status: "ready",
      data: {
        classes,
        sessions: sessionResults.flatMap(result => result.data!.items),
      },
    });
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const data = readState.status === "ready" ? readState.data : null;
  const sessionsDesc = (data?.sessions ?? [])
    .slice()
    .sort(
      (a, b) =>
        new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime()
    );
  const selectedClass =
    data?.classes.find(item => item.id === selectedClassId) ??
    data?.classes.find(item =>
      sessionsDesc.some(session => session.classId === item.id)
    ) ??
    data?.classes[0];
  const classSessions = sessionsDesc.filter(
    session => session.classId === selectedClass?.id
  );
  const selectedSession =
    classSessions.find(session => session.id === selectedSessionId) ??
    classSessions[0];

  const loadAttendance = useCallback(async () => {
    if (!selectedSession) return;
    setAttendanceState({ status: "loading" });
    setMessage(null);
    const result = await fetchNccSessionAttendanceRequest(selectedSession.id);
    if (result.ok && result.data) {
      const attendance = result.data.attendance;
      setAttendanceState({ status: "ready", data: attendance });
      const statusIds = new Set(attendance.statuses.map(item => item.id));
      const fallbackStatusId =
        attendance.statuses.find(item => item.acronym === "P")?.id ??
        attendance.statuses[0]?.id;
      const next: Record<string, number> = {};
      for (const student of attendance.students) {
        const parsed =
          student.statusId === null ? NaN : Number(student.statusId);
        next[student.studentId] =
          Number.isSafeInteger(parsed) && statusIds.has(parsed)
            ? parsed
            : fallbackStatusId;
      }
      setDraft(next);
    } else {
      setAttendanceState(classifyNccFailure(result));
    }
  }, [selectedSession?.id]);

  useEffect(() => {
    if (selectedSession) void loadAttendance();
  }, [loadAttendance, selectedSession]);

  const save = async () => {
    if (!selectedSession || attendanceState?.status !== "ready" || saving) {
      return;
    }
    const attendance = attendanceState.data;
    setSaving(true);
    setMessage(null);
    const result = await markNccSessionAttendanceRequest(selectedSession.id, {
      marks: attendance.students.map(student => ({
        studentId: student.studentId,
        statusId: draft[student.studentId],
      })),
    });
    setSaving(false);
    if (result.ok && result.data) {
      setAttendanceState({ status: "ready", data: result.data.attendance });
      setMessage({ kind: "success", text: "Attendance saved." });
      toast.success("Attendance saved.");
    } else {
      const text = result.error ?? "Attendance could not be saved.";
      setMessage({ kind: "error", text });
      toast.error(text);
    }
  };

  const attendanceReady =
    attendanceState?.status === "ready" ? attendanceState.data : null;
  const saveDisabled =
    saving ||
    !selectedSession ||
    !attendanceReady ||
    attendanceReady.students.some(
      student => !Number.isSafeInteger(draft[student.studentId])
    );

  return (
    <PlatformShell role="branchadmin" title="Attendance">
      <WorkspaceLayout
        className="branch-attendance-page"
        title="Attendance"
        description="Record one class session at a time."
        context={selectedClass?.branchName ?? "Branch"}
        toolbar={
          <div
            className="branch-compact-toolbar branch-attendance-toolbar"
            data-testid="branch-attendance-toolbar"
          >
            <label>
              Class
              <select
                value={selectedClass?.id ?? ""}
                disabled={!data?.classes.length}
                onChange={event => {
                  setSelectedClassId(event.target.value);
                  setSelectedSessionId("");
                }}
              >
                {data?.classes.length ? (
                  data.classes.map(item => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))
                ) : (
                  <option value="">No classes</option>
                )}
              </select>
            </label>
            <label>
              Session
              <select
                value={selectedSession?.id ?? ""}
                onChange={event => setSelectedSessionId(event.target.value)}
                disabled={!classSessions.length}
              >
                {classSessions.length ? (
                  classSessions.map(session => (
                    <option key={session.id} value={session.id}>
                      {formatSession(session.startsAt)}
                    </option>
                  ))
                ) : (
                  <option value="">No sessions</option>
                )}
              </select>
            </label>
          </div>
        }
        main={
          !data ? (
            <NccReadStatus state={readState} onRetry={() => void load()} />
          ) : !data.classes.length ? (
            <div className="platform-empty-state" role="status">
              <strong>No classes are assigned to this branch.</strong>
            </div>
          ) : !classSessions.length ? (
            <div className="platform-empty-state" role="status">
              <strong>No sessions available for attendance.</strong>
            </div>
          ) : (
            <section
              className="branch-attendance-workspace"
              data-testid="branch-attendance-workspace"
            >
              <div className="branch-attendance-head">
                <div>
                  <span>Take attendance</span>
                  <strong>{selectedClass?.name ?? "Class"}</strong>
                  <small>{formatSession(selectedSession?.startsAt)}</small>
                </div>
                <span>{attendanceReady?.students.length ?? 0} learners</span>
              </div>
              {attendanceState?.status !== "ready" ? (
                <NccReadStatus
                  state={attendanceState ?? { status: "loading" }}
                  onRetry={() => void loadAttendance()}
                />
              ) : (
                <div className="branch-attendance-list">
                  {attendanceReady!.students.map(student => {
                    const studentName =
                      `${student.firstName} ${student.lastName}`.trim() ||
                      "Student";
                    return (
                      <article key={student.studentId}>
                        <div className="branch-attendance-learner">
                          <strong>{studentName}</strong>
                          <small>{student.email}</small>
                        </div>
                        <label>
                          <span className="sr-only">
                            Attendance for {studentName}
                          </span>
                          <select
                            aria-label={`Attendance for ${studentName}`}
                            value={draft[student.studentId] ?? ""}
                            onChange={event =>
                              setDraft(value => ({
                                ...value,
                                [student.studentId]: Number(
                                  event.target.value
                                ),
                              }))
                            }
                          >
                            {attendanceReady!.statuses.map(status => (
                              <option key={status.id} value={status.id}>
                                {status.description ??
                                  status.acronym ??
                                  `Status ${status.id}`}
                              </option>
                            ))}
                          </select>
                        </label>
                      </article>
                    );
                  })}
                </div>
              )}
              <div className="branch-attendance-save-bar">
                {message ? (
                  <span
                    className={`branch-attendance-result ${message.kind}`}
                    role={message.kind === "error" ? "alert" : "status"}
                  >
                    {message.text}
                  </span>
                ) : (
                  <span>Changes apply to this session only.</span>
                )}
                <button
                  type="button"
                  className="platform-primary-button"
                  data-testid="branch-attendance-save"
                  disabled={saveDisabled}
                  onClick={() => void save()}
                >
                  {saving ? "Saving attendance" : "Save attendance"}
                </button>
              </div>
            </section>
          )
        }
      />
    </PlatformShell>
  );
}

function CompatibilityBranchAttendancePage() {
  const [state, setState] = useState(() => platformStore.getState());
  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedSessionId, setSelectedSessionId] = useState("");
  const [statuses, setStatuses] = useState<Record<string, AttendanceStatus>>(
    {}
  );
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [reviewingId, setReviewingId] = useState("");
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [saveResult, setSaveResult] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);
  const actorId = requireActiveUser("branchadmin").id;

  useEffect(() => {
    const refreshState = () => setState(platformStore.getState());
    window.addEventListener("nilelearn:platform-state-updated", refreshState);
    window.addEventListener("storage", refreshState);
    return () => {
      window.removeEventListener(
        "nilelearn:platform-state-updated",
        refreshState
      );
      window.removeEventListener("storage", refreshState);
    };
  }, []);

  const actor = state.users.find(user => user.id === actorId);
  const staffProfile = state.staffProfiles.find(
    profile => profile.userId === actorId && profile.role === "branchadmin"
  );
  const branchId = actor?.branchId ?? staffProfile?.branchIds[0] ?? "br_cairo";
  const branch = state.branches.find(item => item.id === branchId);
  const branchRunIds = new Set(
    state.courseRuns.filter(run => run.branchId === branchId).map(run => run.id)
  );
  const classes = state.classGroups.filter(group =>
    branchRunIds.has(group.courseRunId)
  );
  const selectedClass =
    classes.find(group => group.id === selectedClassId) ?? classes[0];
  const sessions = state.classSessions
    .filter(session => session.classGroupId === selectedClass?.id)
    .slice()
    .sort(
      (first, second) =>
        new Date(first.startsAt).getTime() - new Date(second.startsAt).getTime()
    );
  const selectedSession =
    sessions.find(session => session.id === selectedSessionId) ?? sessions[0];
  const learnerRows = useMemo(
    () =>
      (selectedClass?.studentIds ?? []).map(studentId => {
        const student = state.students.find(item => item.id === studentId);
        const user = state.users.find(item => item.id === student?.userId);
        const enrollment = state.enrollments.find(
          item =>
            item.studentId === studentId &&
            item.classGroupId === selectedClass.id
        );
        return { studentId, student, user, enrollment };
      }),
    [selectedClass, state]
  );
  const selectedSessionKeys = new Set(
    [selectedSession?.id, selectedSession?.eventId].filter(Boolean)
  );
  const savedRows = state.attendance.filter(
    record =>
      record.classGroupId === selectedClass?.id &&
      selectedSessionKeys.has(record.sessionId)
  );
  const branchClassIds = new Set(classes.map(item => item.id));
  const pendingExceptions = state.attendanceExceptions
    .filter(
      request =>
        request.status === "pending" && branchClassIds.has(request.classGroupId)
    )
    .sort((a, b) => a.submittedAt.localeCompare(b.submittedAt));

  useEffect(() => {
    if (!selectedClassId && classes[0]?.id) setSelectedClassId(classes[0].id);
  }, [classes, selectedClassId]);

  useEffect(() => {
    if (!selectedSessionId && sessions[0]?.id) {
      setSelectedSessionId(sessions[0].id);
    }
  }, [selectedSessionId, sessions]);

  useEffect(() => {
    if (!selectedClass || !selectedSession) {
      setStatuses({});
      setNotes({});
      return;
    }
    const nextStatuses: Record<string, AttendanceStatus> = {};
    const nextNotes: Record<string, string> = {};
    selectedClass.studentIds.forEach(studentId => {
      const record = state.attendance.find(
        item =>
          item.classGroupId === selectedClass.id &&
          item.studentId === studentId &&
          selectedSessionKeys.has(item.sessionId)
      );
      nextStatuses[studentId] = record?.status ?? "present";
      nextNotes[studentId] = record?.notes ?? "";
    });
    setStatuses(nextStatuses);
    setNotes(nextNotes);
  }, [selectedClass?.id, selectedSession?.id, state]);

  const saveAttendance = async () => {
    if (!selectedClass || !selectedSession) {
      setSaveResult({
        tone: "error",
        message: "Choose a class and session first.",
      });
      toast.error("Choose a class and session first.");
      return;
    }
    const completeStatuses = selectedClass.studentIds.reduce<
      Record<string, AttendanceStatus>
    >((result, studentId) => {
      result[studentId] = statuses[studentId] ?? "present";
      return result;
    }, {});
    setSaving(true);
    const response = await runPlatformWorkflowActionRequest({
      type: "attendance.save",
      classGroupId: selectedClass.id,
      sessionId: selectedSession.id,
      statuses: completeStatuses,
      notes,
      actorId,
    });
    setSaving(false);
    if (!response.ok || !response.data) {
      const message = response.error ?? "Attendance could not be saved.";
      setSaveResult({ tone: "error", message });
      toast.error(message);
      return;
    }
    platformStore.setState(response.data.state);
    setState(response.data.state);
    setSaveResult({
      tone: "success",
      message: `Attendance saved for ${learnerRows.length} learners.`,
    });
    toast.success("Attendance saved");
  };

  const reviewException = async (
    requestId: string,
    decision: "approved" | "rejected"
  ) => {
    const reviewNote = reviewNotes[requestId]?.trim() ?? "";
    if (reviewNote.length < 5) {
      toast.error("Add a short review note before deciding");
      return;
    }
    setReviewingId(requestId);
    const response = await runPlatformWorkflowActionRequest({
      type: "attendance.exception.review",
      requestId,
      decision,
      reviewNote,
    });
    setReviewingId("");
    if (!response.ok || !response.data) {
      toast.error("Exception review failed", { description: response.error });
      return;
    }
    platformStore.setState(response.data.state);
    setState(response.data.state);
    setReviewNotes(value => ({ ...value, [requestId]: "" }));
    toast.success(`Attendance exception ${decision}`);
  };

  return (
    <PlatformShell role="branchadmin" title="Attendance">
      <WorkspaceLayout
        className="branch-attendance-page"
        title="Attendance"
        description="Record one class session at a time."
        context={branch?.name ?? "Branch"}
        toolbar={
          <div
            className="branch-compact-toolbar branch-attendance-toolbar"
            data-testid="branch-attendance-toolbar"
          >
            <label>
              Class
              <select
                value={selectedClass?.id ?? ""}
                onChange={event => {
                  setSelectedClassId(event.target.value);
                  setSelectedSessionId("");
                }}
              >
                {classes.map(group => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Session
              <select
                value={selectedSession?.id ?? ""}
                onChange={event => setSelectedSessionId(event.target.value)}
                disabled={!sessions.length}
              >
                {sessions.length ? (
                  sessions.map(session => (
                    <option key={session.id} value={session.id}>
                      {session.title}
                    </option>
                  ))
                ) : (
                  <option value="">No sessions</option>
                )}
              </select>
            </label>
          </div>
        }
        main={
          <div className="branch-workspace-main">
            <section
              className="branch-attendance-workspace"
              data-testid="branch-attendance-workspace"
            >
              <div className="branch-attendance-head">
                <div>
                  <span>Take attendance</span>
                  <strong>
                    {selectedSession?.title ?? "Choose a session"}
                  </strong>
                  <small>{formatSession(selectedSession?.startsAt)}</small>
                </div>
                <span>{learnerRows.length} learners</span>
              </div>
              {learnerRows.length && selectedSession ? (
                <div className="branch-attendance-list">
                  {learnerRows.map(row => (
                    <article key={row.studentId}>
                      <div className="branch-attendance-learner">
                        <strong>{row.user?.name ?? "Learner"}</strong>
                        <small>
                          {row.enrollment
                            ? `${row.enrollment.attendanceRate}% attendance`
                            : "Enrolled learner"}
                        </small>
                      </div>
                      <div
                        className="branch-attendance-options"
                        aria-label={`${row.user?.name ?? "Learner"} attendance`}
                      >
                        {attendanceOptions.map(option => {
                          const Icon = option.Icon;
                          const active =
                            (statuses[row.studentId] ?? "present") ===
                            option.value;
                          return (
                            <button
                              key={option.value}
                              type="button"
                              className={active ? "active" : ""}
                              aria-label={option.label}
                              aria-pressed={active}
                              title={option.label}
                              onClick={() =>
                                setStatuses(value => ({
                                  ...value,
                                  [row.studentId]: option.value,
                                }))
                              }
                            >
                              <Icon size={15} />
                            </button>
                          );
                        })}
                      </div>
                      <label className="branch-attendance-note">
                        <span className="sr-only">
                          Note for {row.user?.name ?? "learner"}
                        </span>
                        <input
                          value={notes[row.studentId] ?? ""}
                          onChange={event =>
                            setNotes(value => ({
                              ...value,
                              [row.studentId]: event.target.value,
                            }))
                          }
                          placeholder="Optional note"
                        />
                      </label>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="branch-attendance-empty">
                  <Users size={18} />
                  <div>
                    <strong>No class session is ready for attendance.</strong>
                    <small>
                      Choose another class or schedule a session first.
                    </small>
                  </div>
                </div>
              )}
              <div className="branch-attendance-save-bar">
                <span
                  className={
                    saveResult
                      ? `branch-attendance-result ${saveResult.tone}`
                      : ""
                  }
                  role={saveResult?.tone === "error" ? "alert" : undefined}
                >
                  {saveResult?.message ?? "Changes apply to this session only."}
                </span>
                <button
                  type="button"
                  className="platform-primary-button"
                  data-testid="branch-attendance-save"
                  disabled={!selectedSession || !learnerRows.length || saving}
                  onClick={() => void saveAttendance()}
                >
                  {saving ? "Saving attendance" : "Save attendance"}
                </button>
              </div>
            </section>

            <DataTableCard
              title="Exception queue"
              subtitle={`${pendingExceptions.length} request(s) awaiting review`}
            >
              <div
                className="branch-attendance-exception-list"
                data-testid="branch-attendance-exception-list"
              >
                {pendingExceptions.length ? (
                  pendingExceptions.map(request => {
                    const record = state.attendance.find(
                      item => item.id === request.attendanceRecordId
                    );
                    const student = state.students.find(
                      item => item.id === request.studentId
                    );
                    const user = state.users.find(
                      item => item.id === student?.userId
                    );
                    const session = state.classSessions.find(
                      item => item.id === request.sessionId
                    );
                    return (
                      <article key={request.id}>
                        <div>
                          <strong>{user?.name ?? "Learner"}</strong>
                          <small>
                            {session?.title ?? "Class session"} ·{" "}
                            {request.reason}
                          </small>
                        </div>
                        <label>
                          <span className="sr-only">
                            Review note for {user?.name ?? "learner"}
                          </span>
                          <input
                            value={reviewNotes[request.id] ?? ""}
                            onChange={event =>
                              setReviewNotes(value => ({
                                ...value,
                                [request.id]: event.target.value,
                              }))
                            }
                            placeholder="Review note"
                          />
                        </label>
                        <div>
                          <button
                            type="button"
                            disabled={reviewingId === request.id}
                            onClick={() =>
                              void reviewException(request.id, "approved")
                            }
                            data-testid={`branch-attendance-exception-approve-${request.id}`}
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            disabled={reviewingId === request.id}
                            onClick={() =>
                              void reviewException(request.id, "rejected")
                            }
                          >
                            Reject
                          </button>
                        </div>
                        {record ? (
                          <StatusBadge tone={attendanceTone(record.status)}>
                            {attendanceLabels[record.status]}
                          </StatusBadge>
                        ) : null}
                      </article>
                    );
                  })
                ) : (
                  <article>
                    <div>
                      <strong>No pending exceptions</strong>
                      <small>New learner requests will appear here.</small>
                    </div>
                  </article>
                )}
              </div>
            </DataTableCard>

            <DataTableCard
              title="Saved attendance"
              subtitle={`${savedRows.length} records for this session`}
            >
              <div className="branch-attendance-saved-list">
                {savedRows.length ? (
                  savedRows.map(record => {
                    const student = state.students.find(
                      item => item.id === record.studentId
                    );
                    const user = state.users.find(
                      item => item.id === student?.userId
                    );
                    return (
                      <article key={record.id}>
                        <div>
                          <strong>{user?.name ?? "Learner"}</strong>
                          <small>{record.notes || "No note"}</small>
                        </div>
                        <StatusBadge tone={attendanceTone(record.status)}>
                          {attendanceLabels[record.status]}
                        </StatusBadge>
                      </article>
                    );
                  })
                ) : (
                  <article>
                    <div>
                      <strong>No attendance saved yet</strong>
                      <small>Save the roster above when it is ready.</small>
                    </div>
                  </article>
                )}
              </div>
            </DataTableCard>
          </div>
        }
      />
    </PlatformShell>
  );
}
