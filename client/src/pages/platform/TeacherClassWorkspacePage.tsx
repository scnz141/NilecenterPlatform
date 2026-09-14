import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  CircleSlash,
  CircleX,
  Clock3,
  Users,
} from "lucide-react";
import { Link } from "wouter";
import NccReadStatus from "@/components/platform/NccReadStatus";
import PlatformShell from "@/components/platform/PlatformShell";
import {
  TeacherClassNavigation,
  type TeacherClassSection,
} from "@/components/platform/TeacherClassNavigation";
import { WorkspaceLayout } from "@/components/platform/PlatformLayouts";
import {
  DataTableCard,
  StatusBadge,
} from "@/components/platform/PlatformPrimitives";
import {
  fetchNccClassEnrolmentsRequest,
  fetchNccClassGradesRequest,
  fetchNccClassRequest,
  fetchNccClassSessionsRequest,
  fetchNccSessionAttendanceRequest,
  fetchNccTeacherWorkspaceRequest,
  markNccSessionAttendanceRequest,
  runPlatformWorkflowActionRequest,
  type NccAttendanceDetailDto,
  type NccClassDto,
  type NccClassEnrolmentDto,
  type NccClassGradesDto,
  type NccSessionDto,
  type NccTeacherWorkspaceDto,
} from "@/lib/backend/api";
import {
  classifyNccFailure,
  type NccReadState,
} from "@/lib/backend/nccReadState";
import { getStoredAuthSession, requireActiveUser } from "@/lib/auth/session";
import { platformStore } from "@/lib/domain/store";
import type {
  AttendanceStatus,
  EntityStatus,
  StudentStatus,
} from "@/lib/domain/types";

type TeacherClassWorkspaceView =
  | "sessions"
  | "attendance"
  | "students"
  | "grades"
  | "materials";

type TeacherClassWorkspacePageProps = {
  classId: string;
  view: TeacherClassWorkspaceView;
};

const viewMeta: Record<
  TeacherClassWorkspaceView,
  { title: string; description: string; icon: typeof CalendarDays }
> = {
  sessions: {
    title: "Sessions",
    description: "Class meeting times and attendance state.",
    icon: CalendarDays,
  },
  attendance: {
    title: "Attendance",
    description: "Class attendance records only.",
    icon: CheckCircle2,
  },
  students: {
    title: "Students",
    description: "Learners enrolled in this class.",
    icon: Users,
  },
  grades: {
    title: "Grades",
    description: "Moodle grades for this class.",
    icon: BookOpen,
  },
  materials: {
    title: "Materials",
    description: "Verified Moodle sections and learning resources.",
    icon: BookOpen,
  },
};

function statusTone(status: EntityStatus): "green" | "amber" | "red" | "slate" {
  if (status === "active" || status === "completed") return "green";
  if (status === "pending" || status === "draft") return "amber";
  if (status === "paused" || status === "cancelled" || status === "overdue")
    return "red";
  return "slate";
}

function attendanceTone(
  status: AttendanceStatus
): "green" | "amber" | "red" | "slate" {
  if (status === "present") return "green";
  if (status === "late" || status === "excused") return "amber";
  if (status === "absent") return "red";
  return "slate";
}

const attendanceStatusLabels: Record<AttendanceStatus, string> = {
  present: "Present",
  late: "Late",
  absent: "Absent",
  excused: "Excused",
};

const attendanceStatusIcons: Record<AttendanceStatus, typeof CheckCircle2> = {
  present: CheckCircle2,
  late: Clock3,
  absent: CircleX,
  excused: CircleSlash,
};

function studentTone(
  status: StudentStatus
): "green" | "amber" | "red" | "slate" {
  if (status === "active" || status === "enrolled" || status === "completed")
    return "green";
  if (status === "paused" || status === "cancelled") return "red";
  if (status === "lead") return "slate";
  return "amber";
}

function formatDateTime(value?: string) {
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

export default function TeacherClassWorkspacePage(
  props: TeacherClassWorkspacePageProps
) {
  return getStoredAuthSession()?.provider === "ncc" ? (
    <NccTeacherClassWorkspacePage {...props} />
  ) : (
    <CompatibilityTeacherClassWorkspacePage {...props} />
  );
}

function NccTeacherClassWorkspacePage({
  classId,
  view,
}: TeacherClassWorkspacePageProps) {
  const [readState, setReadState] = useState<
    NccReadState<{
      classRecord: NccClassDto;
      enrolments: NccClassEnrolmentDto[];
      sessions: NccSessionDto[];
      workspace: NccTeacherWorkspaceDto;
    }>
  >({ status: "loading" });
  const [selectedSessionId, setSelectedSessionId] = useState("");
  const [attendanceState, setAttendanceState] = useState<
    NccReadState<NccAttendanceDetailDto> | null
  >(null);
  const [attendanceDraft, setAttendanceDraft] = useState<
    Record<string, number>
  >({});
  const [attendanceSaving, setAttendanceSaving] = useState(false);
  const [attendanceMessage, setAttendanceMessage] = useState<{
    kind: "success" | "error";
    text: string;
  } | null>(null);
  const [gradesState, setGradesState] = useState<
    NccReadState<NccClassGradesDto> | null
  >(null);

  const load = useCallback(async () => {
    setReadState({ status: "loading" });
    const [classResult, enrolmentsResult, sessionsResult, workspaceResult] =
      await Promise.all([
        fetchNccClassRequest(classId),
        fetchNccClassEnrolmentsRequest(classId),
        fetchNccClassSessionsRequest(classId),
        fetchNccTeacherWorkspaceRequest(),
      ]);
    for (const result of [
      classResult,
      enrolmentsResult,
      sessionsResult,
      workspaceResult,
    ]) {
      if (!result.ok || !result.data) {
        setReadState(classifyNccFailure(result));
        return;
      }
    }
    setReadState({
      status: "ready",
      data: {
        classRecord: classResult.data!.class,
        enrolments: enrolmentsResult.data!.items,
        sessions: sessionsResult.data!.items,
        workspace: workspaceResult.data!.workspace,
      },
    });
  }, [classId]);

  useEffect(() => {
    void load();
  }, [load]);

  const data = readState.status === "ready" ? readState.data : null;
  const sessions = data
    ? [...data.sessions].sort(
        (a, b) =>
          new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()
      )
    : [];
  const selectedSession =
    sessions.find(item => item.id === selectedSessionId) ??
    sessions.find(item => item.status === "scheduled") ??
    sessions[0];
  const workspaceClass = data?.workspace.classes.find(
    item => item.id === classId
  );
  const meta = viewMeta[view];

  const loadAttendance = useCallback(async () => {
    if (view !== "attendance" || !selectedSession) return;
    setAttendanceState({ status: "loading" });
    setAttendanceMessage(null);
    const result = await fetchNccSessionAttendanceRequest(selectedSession.id);
    if (result.ok && result.data) {
      const attendance = result.data.attendance;
      setAttendanceState({ status: "ready", data: attendance });
      const statusIds = new Set(attendance.statuses.map(item => item.id));
      const fallbackStatusId =
        attendance.statuses.find(item => item.acronym === "P")?.id ??
        attendance.statuses[0]?.id;
      const draft: Record<string, number> = {};
      for (const student of attendance.students) {
        const parsed =
          student.statusId === null ? NaN : Number(student.statusId);
        draft[student.studentId] =
          Number.isSafeInteger(parsed) && statusIds.has(parsed)
            ? parsed
            : fallbackStatusId;
      }
      setAttendanceDraft(draft);
    } else {
      setAttendanceState(classifyNccFailure(result));
    }
  }, [view, selectedSession?.id]);

  useEffect(() => {
    if (view !== "attendance") return;
    void loadAttendance();
  }, [view, loadAttendance]);

  const loadGrades = useCallback(async () => {
    if (view !== "grades") return;
    setGradesState({ status: "loading" });
    const result = await fetchNccClassGradesRequest(classId);
    setGradesState(
      result.ok && result.data
        ? { status: "ready", data: result.data.grades }
        : classifyNccFailure(result)
    );
  }, [view, classId]);

  useEffect(() => {
    if (view !== "grades") return;
    void loadGrades();
  }, [view, loadGrades]);

  const saveAttendance = async () => {
    if (!selectedSession || attendanceState?.status !== "ready") return;
    const attendance = attendanceState.data;
    setAttendanceSaving(true);
    setAttendanceMessage(null);
    const result = await markNccSessionAttendanceRequest(selectedSession.id, {
      marks: attendance.students.map(student => ({
        studentId: student.studentId,
        statusId: attendanceDraft[student.studentId],
      })),
    });
    setAttendanceSaving(false);
    if (result.ok && result.data) {
      setAttendanceState({ status: "ready", data: result.data.attendance });
      setAttendanceMessage({ kind: "success", text: "Attendance saved." });
      toast.success("Attendance saved.");
    } else {
      const message = result.error ?? "Attendance could not be saved.";
      setAttendanceMessage({ kind: "error", text: message });
      toast.error(message);
    }
  };

  const attendanceReady =
    attendanceState?.status === "ready" ? attendanceState.data : null;
  const attendanceSaveDisabled =
    attendanceSaving ||
    !attendanceReady ||
    attendanceReady.students.some(
      student =>
        typeof attendanceDraft[student.studentId] !== "number" ||
        !Number.isSafeInteger(attendanceDraft[student.studentId])
    );

  function renderMain() {
    if (!data) {
      return <NccReadStatus state={readState} onRetry={() => void load()} />;
    }

    if (view === "sessions") {
      return (
        <DataTableCard
          title="Class sessions"
          subtitle={`${sessions.length} sessions`}
          className="teacher-class-record-card"
        >
          {sessions.length ? (
            <div className="teacher-class-record-list">
              {sessions.map(session => (
                <article key={session.id}>
                  <div className="teacher-class-record-copy">
                    <span>{formatDateTime(session.startsAt)}</span>
                    <strong>{session.roomName ?? "Room not set"}</strong>
                  </div>
                  <dl className="teacher-class-record-facts">
                    <div>
                      <dt>Ends</dt>
                      <dd>{formatDateTime(session.endsAt)}</dd>
                    </div>
                    <div>
                      <dt>Teacher</dt>
                      <dd>{session.teacherName ?? "Teacher not set"}</dd>
                    </div>
                  </dl>
                  <div className="teacher-class-record-actions">
                    <StatusBadge
                      tone={session.status === "scheduled" ? "green" : "slate"}
                    >
                      {session.status}
                    </StatusBadge>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="platform-empty-state">
              <strong>No sessions yet</strong>
              <span>Class sessions will appear here when scheduled.</span>
            </div>
          )}
        </DataTableCard>
      );
    }

    if (view === "attendance") {
      if (!sessions.length) {
        return (
          <div className="platform-empty-state" role="status">
            <strong>No sessions available for attendance.</strong>
          </div>
        );
      }
      return (
        <section
          className="teacher-attendance-workspace"
          data-testid="teacher-attendance-workspace"
        >
          <div className="teacher-attendance-workspace-header">
            <div>
              <span>
                {selectedSession
                  ? formatDateTime(selectedSession.startsAt)
                  : "No session selected"}
              </span>
              <h2>Take attendance</h2>
              <p>{data.classRecord.name}</p>
            </div>
            <label className="teacher-attendance-session-select">
              <span>Session</span>
              <select
                value={selectedSession?.id ?? ""}
                onChange={event => setSelectedSessionId(event.target.value)}
                data-testid="teacher-attendance-session"
              >
                {sessions.map(session => (
                  <option key={session.id} value={session.id}>
                    {formatDateTime(session.startsAt)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {attendanceState?.status !== "ready" ? (
            <NccReadStatus
              state={attendanceState ?? { status: "loading" }}
              onRetry={() => void loadAttendance()}
            />
          ) : (
            <>
              <div className="teacher-attendance-roster" role="list">
                {attendanceReady!.students.map(student => {
                  const studentName =
                    `${student.firstName} ${student.lastName}`.trim() ||
                    "Student";
                  return (
                    <article
                      key={student.studentId}
                      role="listitem"
                      className="teacher-attendance-row"
                    >
                      <div className="teacher-attendance-identity">
                        <span aria-hidden="true">
                          {studentName.slice(0, 1)}
                        </span>
                        <div>
                          <strong>{studentName}</strong>
                          <small>{student.email}</small>
                        </div>
                      </div>
                      <label className="teacher-attendance-status-select">
                        <span className="sr-only">
                          Attendance for {studentName}
                        </span>
                        <select
                          aria-label={`Attendance for ${studentName}`}
                          value={attendanceDraft[student.studentId] ?? ""}
                          onChange={event =>
                            setAttendanceDraft(previous => ({
                              ...previous,
                              [student.studentId]: Number(event.target.value),
                            }))
                          }
                          data-testid={`teacher-attendance-status-${student.studentId}`}
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
              <div className="teacher-attendance-save-bar">
                <span>
                  {attendanceReady!.students.length} learner
                  {attendanceReady!.students.length === 1 ? "" : "s"} in this
                  roster
                </span>
                <button
                  type="button"
                  className="platform-primary-button"
                  onClick={() => void saveAttendance()}
                  disabled={attendanceSaveDisabled}
                  data-testid="teacher-attendance-save"
                >
                  <CheckCircle2 size={15} />
                  {attendanceSaving ? "Saving attendance" : "Save attendance"}
                </button>
              </div>
              {attendanceMessage ? (
                <p
                  role={attendanceMessage.kind === "error" ? "alert" : "status"}
                >
                  {attendanceMessage.text}
                </p>
              ) : null}
            </>
          )}
        </section>
      );
    }

    if (view === "grades") {
      if (gradesState?.status !== "ready") {
        return (
          <NccReadStatus
            state={gradesState ?? { status: "loading" }}
            onRetry={() => void loadGrades()}
          />
        );
      }
      const gradeStudents = gradesState.data.students;
      return (
        <DataTableCard
          title="Class grades"
          subtitle={`${gradeStudents.length} learners · Moodle`}
          className="teacher-class-record-card"
        >
          <p role="status">Grades are read from Moodle.</p>
          {gradeStudents.length ? (
            <div className="teacher-class-record-list">
              {gradeStudents.map(student => {
                const studentName =
                  `${student.firstName} ${student.lastName}`.trim() ||
                  "Student";
                return (
                  <article key={student.studentId}>
                    <div className="teacher-class-record-copy">
                      <span>{student.email}</span>
                      <strong>{studentName}</strong>
                    </div>
                    <dl className="teacher-class-record-facts">
                      <div>
                        <dt>Course grade</dt>
                        <dd>{student.courseGrade ?? "Not graded"}</dd>
                      </div>
                    </dl>
                    {student.gradeItems.length ? (
                      <dl className="teacher-class-record-facts">
                        {student.gradeItems.map(item => (
                          <div key={item.id}>
                            <dt>
                              {item.itemName ?? "Grade item"} ·{" "}
                              {item.itemModule ?? item.itemType ?? "Course"}
                            </dt>
                            <dd>
                              {item.gradeFormatted ?? "Not graded"}
                              {item.percentageFormatted
                                ? ` · ${item.percentageFormatted}`
                                : ""}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    ) : null}
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="platform-empty-state">
              <strong>No Moodle grades yet</strong>
              <span>
                Grades appear after Moodle activities are assessed.
              </span>
            </div>
          )}
        </DataTableCard>
      );
    }

    if (view === "students") {
      return (
        <DataTableCard
          title="Class students"
          subtitle={`${data.enrolments.length} learners`}
          className="teacher-class-record-card"
        >
          {data.enrolments.length ? (
            <div className="teacher-class-record-list">
              {data.enrolments.map(enrolment => {
                const studentName =
                  `${enrolment.student.firstName} ${enrolment.student.lastName}`.trim() ||
                  "Student";
                return (
                  <article key={enrolment.studentId}>
                    <div className="teacher-class-record-copy">
                      <span>{enrolment.student.email}</span>
                      <strong>{studentName}</strong>
                    </div>
                    <dl className="teacher-class-record-facts">
                      <div>
                        <dt>Moodle</dt>
                        <dd>
                          {enrolment.student.moodleLinked
                            ? "Linked"
                            : "Not linked"}
                        </dd>
                      </div>
                    </dl>
                    <div className="teacher-class-record-actions">
                      <StatusBadge
                        tone={
                          enrolment.status === "enrolled" ? "green" : "slate"
                        }
                      >
                        {enrolment.status}
                      </StatusBadge>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="platform-empty-state">
              <strong>No enrolled students.</strong>
            </div>
          )}
        </DataTableCard>
      );
    }

    return (
      <DataTableCard
        title="Class materials"
        subtitle="Moodle-managed learning content"
      >
        <div
          className="platform-empty-state"
          data-testid="teacher-materials-moodle-owner"
        >
          <BookOpen size={20} aria-hidden="true" />
          <strong>Materials are managed in Moodle</strong>
          {workspaceClass?.moodleCourseUrl ? (
            <a
              className="platform-primary-button"
              href={workspaceClass.moodleCourseUrl}
              target="_blank"
              rel="noreferrer"
              data-testid="teacher-materials-open-moodle"
            >
              Open course in Moodle
              <ArrowRight size={15} />
            </a>
          ) : (
            <span role="status">
              Moodle course is not available for this class.
            </span>
          )}
        </div>
      </DataTableCard>
    );
  }

  return (
    <PlatformShell
      role="teacher"
      title={`${data?.classRecord.name ?? "Class"} ${meta.title}`}
    >
      <WorkspaceLayout
        className="teacher-class-workspace-page portal-simple-page"
        context="Teacher"
        title={meta.title}
        description={
          data
            ? `${data.classRecord.name} · ${meta.description}`
            : meta.description
        }
        actions={
          <Link
            className="platform-secondary-button"
            href={`/app/teacher/classes/${classId}`}
          >
            <ArrowLeft size={15} />
            Class overview
          </Link>
        }
        toolbar={
          <TeacherClassNavigation
            classId={classId}
            active={view as TeacherClassSection}
          />
        }
        main={renderMain()}
      />
    </PlatformShell>
  );
}

function CompatibilityTeacherClassWorkspacePage({
  classId,
  view,
}: TeacherClassWorkspacePageProps) {
  const [state, setState] = useState(() => platformStore.getState());
  const [selectedSessionId, setSelectedSessionId] = useState("");
  const [attendanceStatuses, setAttendanceStatuses] = useState<
    Record<string, AttendanceStatus>
  >({});
  const [attendanceNotes, setAttendanceNotes] = useState<
    Record<string, string>
  >({});
  const [attendanceSaving, setAttendanceSaving] = useState(false);
  const attendanceCommandKey = useRef(`attendance.save:${crypto.randomUUID()}`);
  const actorId = requireActiveUser("teacher").id;

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

  const classGroup = state.classGroups.find(item => item.id === classId);
  const run = state.courseRuns.find(
    item => item.id === classGroup?.courseRunId
  );
  const course = state.courses.find(item => item.id === run?.courseId);
  const room = state.rooms.find(item => item.id === classGroup?.roomId);
  const sessions = state.classSessions
    .filter(item => item.classGroupId === classGroup?.id)
    .sort(
      (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()
    );
  const enrollments = state.enrollments.filter(
    item => item.classGroupId === classGroup?.id
  );
  const attendanceRecords = state.attendance.filter(
    item => item.classGroupId === classGroup?.id
  );
  const activeSession =
    sessions.find(item => item.id === selectedSessionId) ?? sessions[0];
  const meta = viewMeta[view];

  useEffect(() => {
    if (!selectedSessionId && sessions[0]?.id) {
      setSelectedSessionId(sessions[0].id);
    }
  }, [selectedSessionId, sessions]);

  useEffect(() => {
    if (!classGroup || !activeSession) return;
    attendanceCommandKey.current = `attendance.save:${activeSession.id}:${crypto.randomUUID()}`;
    const sessionKeys = new Set(
      [activeSession.id, activeSession.eventId].filter(Boolean)
    );
    const nextStatuses: Record<string, AttendanceStatus> = {};
    const nextNotes: Record<string, string> = {};
    classGroup.studentIds.forEach(studentId => {
      const record = state.attendance.find(
        item =>
          item.classGroupId === classGroup.id &&
          item.studentId === studentId &&
          sessionKeys.has(item.sessionId)
      );
      nextStatuses[studentId] = record?.status ?? "present";
      nextNotes[studentId] = record?.notes ?? "";
    });
    setAttendanceStatuses(nextStatuses);
    setAttendanceNotes(nextNotes);
  }, [activeSession?.id, classGroup?.id, state]);

  if (!classGroup) {
    return (
      <PlatformShell role="teacher" title="Class not found">
        <WorkspaceLayout
          className="teacher-class-workspace-page portal-simple-page"
          context="Teacher"
          title="Class not found"
          description="Return to the class list and choose an assigned class."
          actions={
            <Link
              className="platform-secondary-button"
              href="/app/teacher/classes"
            >
              <ArrowLeft size={15} />
              All classes
            </Link>
          }
          main={
            <div className="portal-simple-form-card">
              This class is not available for the current workspace.
            </div>
          }
        />
      </PlatformShell>
    );
  }

  const currentClass = classGroup;

  const nav = (
    <TeacherClassNavigation
      classId={currentClass.id}
      active={view as TeacherClassSection}
    />
  );

  const saveAttendance = async () => {
    if (!classGroup || !activeSession) return;
    const statuses = classGroup.studentIds.reduce<
      Record<string, AttendanceStatus>
    >((acc, studentId) => {
      acc[studentId] = attendanceStatuses[studentId] ?? "present";
      return acc;
    }, {});
    setAttendanceSaving(true);
    const result = await runPlatformWorkflowActionRequest({
      type: "attendance.save",
      classGroupId: classGroup.id,
      sessionId: activeSession.id,
      statuses,
      notes: attendanceNotes,
      expectedVersion: activeSession.attendanceVersion ?? 1,
      idempotencyKey: attendanceCommandKey.current,
      actorId,
    });
    setAttendanceSaving(false);
    if (result.ok && result.data) {
      attendanceCommandKey.current = `attendance.save:${activeSession.id}:${crypto.randomUUID()}`;
      platformStore.setState(result.data.state);
      setState(result.data.state);
    }
  };

  function renderMain() {
    if (view === "sessions") {
      return (
        <DataTableCard
          title="Class sessions"
          subtitle={`${sessions.length} sessions`}
          className="teacher-class-record-card"
        >
          {sessions.length ? (
            <div className="teacher-class-record-list">
              {sessions.map(session => (
                <article key={session.id}>
                  <div className="teacher-class-record-copy">
                    <span>{room?.name ?? "Room not set"}</span>
                    <strong>{session.title}</strong>
                  </div>
                  <dl className="teacher-class-record-facts">
                    <div>
                      <dt>Starts</dt>
                      <dd>{formatDateTime(session.startsAt)}</dd>
                    </div>
                    <div>
                      <dt>Ends</dt>
                      <dd>{formatDateTime(session.endsAt)}</dd>
                    </div>
                    <div>
                      <dt>Attendance</dt>
                      <dd>{session.attendanceSaved ? "Saved" : "To check"}</dd>
                    </div>
                  </dl>
                  <div className="teacher-class-record-actions">
                    <StatusBadge tone={statusTone(session.status)}>
                      {session.status}
                    </StatusBadge>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="platform-empty-state">
              <strong>No sessions yet</strong>
              <span>Class sessions will appear here when scheduled.</span>
            </div>
          )}
        </DataTableCard>
      );
    }

    if (view === "attendance") {
      return (
        <div className="portal-simple-stack">
          <section
            className="teacher-attendance-workspace"
            data-testid="teacher-attendance-workspace"
          >
            <div className="teacher-attendance-workspace-header">
              <div>
                <span>
                  {activeSession
                    ? formatDateTime(activeSession.startsAt)
                    : "No session selected"}
                </span>
                <h2>Take attendance</h2>
                <p>{currentClass.name}</p>
              </div>
              <label className="teacher-attendance-session-select">
                <span>Session</span>
                <select
                  value={activeSession?.id ?? ""}
                  onChange={event => setSelectedSessionId(event.target.value)}
                  data-testid="teacher-attendance-session"
                >
                  {sessions.map(session => (
                    <option key={session.id} value={session.id}>
                      {session.title}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="teacher-attendance-roster" role="list">
              {currentClass.studentIds.map(studentId => {
                const student = state.students.find(
                  item => item.id === studentId
                );
                const user = state.users.find(
                  item => item.id === student?.userId
                );
                const status = attendanceStatuses[studentId] ?? "present";
                return (
                  <article
                    key={studentId}
                    role="listitem"
                    className="teacher-attendance-row"
                  >
                    <div className="teacher-attendance-identity">
                      <span aria-hidden="true">
                        {(user?.name ?? "Student").slice(0, 1)}
                      </span>
                      <div>
                        <strong>{user?.name ?? "Student"}</strong>
                        <small>
                          {student?.currentLevel ?? course?.title ?? "Learner"}
                        </small>
                      </div>
                    </div>
                    <div
                      className="teacher-attendance-status-group"
                      role="group"
                      aria-label={`Attendance for ${user?.name ?? "student"}`}
                    >
                      {(
                        [
                          "present",
                          "late",
                          "absent",
                          "excused",
                        ] as AttendanceStatus[]
                      ).map(option => {
                        const Icon = attendanceStatusIcons[option];
                        return (
                          <button
                            key={option}
                            type="button"
                            title={attendanceStatusLabels[option]}
                            aria-label={`Mark ${user?.name ?? "student"} ${attendanceStatusLabels[option]}`}
                            aria-pressed={status === option}
                            data-status={option}
                            data-testid={`teacher-attendance-status-${studentId}-${option}`}
                            className={status === option ? "active" : ""}
                            onClick={() =>
                              setAttendanceStatuses(previous => ({
                                ...previous,
                                [studentId]: option,
                              }))
                            }
                          >
                            <Icon size={15} aria-hidden="true" />
                            <span className="sr-only">
                              {attendanceStatusLabels[option]}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    <label className="teacher-attendance-note">
                      <span className="sr-only">
                        Note for {user?.name ?? "student"}
                      </span>
                      <input
                        aria-label={`${user?.name ?? "Student"} attendance note`}
                        value={attendanceNotes[studentId] ?? ""}
                        onChange={event =>
                          setAttendanceNotes(previous => ({
                            ...previous,
                            [studentId]: event.target.value,
                          }))
                        }
                        placeholder="Add note"
                      />
                    </label>
                  </article>
                );
              })}
            </div>
            <div className="teacher-attendance-save-bar">
              <span>
                {currentClass.studentIds.length} learner
                {currentClass.studentIds.length === 1 ? "" : "s"} in this roster
              </span>
              <button
                type="button"
                className="platform-primary-button"
                onClick={() => void saveAttendance()}
                disabled={attendanceSaving || !activeSession}
                data-testid="teacher-attendance-save"
              >
                <CheckCircle2 size={15} />
                {attendanceSaving ? "Saving attendance" : "Save attendance"}
              </button>
            </div>
          </section>

          <DataTableCard
            title="Attendance records"
            subtitle={`${attendanceRecords.length} records`}
            className="teacher-class-record-card"
          >
            {attendanceRecords.length ? (
              <div className="teacher-class-record-list">
                {attendanceRecords.map(record => {
                  const student = state.students.find(
                    item => item.id === record.studentId
                  );
                  const user = state.users.find(
                    item => item.id === student?.userId
                  );
                  const session = sessions.find(
                    item => item.id === record.sessionId
                  );
                  return (
                    <article key={record.id}>
                      <div className="teacher-class-record-copy">
                        <span>
                          {student?.currentLevel ?? course?.title ?? "Learner"}
                        </span>
                        <strong>{user?.name ?? "Student"}</strong>
                      </div>
                      <dl className="teacher-class-record-facts">
                        <div>
                          <dt>Session</dt>
                          <dd>{session?.title ?? "Session"}</dd>
                        </div>
                        <div>
                          <dt>Note</dt>
                          <dd>{record.notes ?? "No note"}</dd>
                        </div>
                      </dl>
                      <div className="teacher-class-record-actions">
                        <StatusBadge tone={attendanceTone(record.status)}>
                          {record.status}
                        </StatusBadge>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="platform-empty-state">
                <strong>No attendance records</strong>
                <span>
                  Attendance records will appear after a class session is saved.
                </span>
              </div>
            )}
          </DataTableCard>
        </div>
      );
    }

    if (view === "grades") {
      return (
        <DataTableCard
          title="Class grades"
          subtitle="Provider-managed grades"
          className="teacher-class-record-card"
        >
          <div className="platform-empty-state" role="status">
            <strong>Grades are available from the connected learning provider.</strong>
          </div>
        </DataTableCard>
      );
    }

    if (view === "students") {
      return (
        <DataTableCard
          title="Class students"
          subtitle={`${enrollments.length || currentClass.studentIds.length} learners`}
          className="teacher-class-record-card"
        >
          <div className="teacher-class-record-list">
            {(enrollments.length
              ? enrollments
              : currentClass.studentIds.map(studentId => ({
                  id: studentId,
                  studentId,
                }))
            ).map(item => {
              const student = state.students.find(
                profile => profile.id === item.studentId
              );
              const user = state.users.find(
                profile => profile.id === student?.userId
              );
              const attendanceRate =
                "attendanceRate" in item ? item.attendanceRate : undefined;
              return (
                <article key={item.id}>
                  <div className="teacher-class-record-copy">
                    <span>{student?.currentLevel ?? "Course learner"}</span>
                    <strong>{user?.name ?? "Student"}</strong>
                    <p>{user?.email ?? "Student profile"}</p>
                  </div>
                  <dl className="teacher-class-record-facts">
                    <div>
                      <dt>Attendance</dt>
                      <dd>
                        {typeof attendanceRate === "number"
                          ? `${attendanceRate}%`
                          : "Not recorded"}
                      </dd>
                    </div>
                  </dl>
                  <div className="teacher-class-record-actions">
                    <StatusBadge
                      tone={studentTone(student?.status ?? "active")}
                    >
                      {student?.status ?? "active"}
                    </StatusBadge>
                    <Link
                      className="teacher-classes-row-action"
                      href={`/app/teacher/classes/${currentClass.id}/students/${item.studentId}`}
                    >
                      View
                      <ArrowRight size={14} />
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        </DataTableCard>
      );
    }

    return (
      <DataTableCard
        title="Class materials"
        subtitle="Moodle-managed learning content"
      >
        <div
          className="platform-empty-state"
          data-testid="teacher-materials-moodle-owner"
        >
          <BookOpen size={20} aria-hidden="true" />
          <strong>Materials are managed in Moodle</strong>
          <span>
            Open the verified course snapshot to review sections, pages, files,
            audio, video, assignments, and quizzes for this class.
          </span>
          {course ? (
            <Link
              className="platform-primary-button"
              href={`/app/teacher/moodle-source/${course.id}`}
              data-testid="teacher-materials-open-moodle"
            >
              Open course content
              <ArrowRight size={15} />
            </Link>
          ) : (
            <span role="status">
              This class does not have a mapped course yet.
            </span>
          )}
        </div>
      </DataTableCard>
    );
  }

  return (
    <PlatformShell role="teacher" title={`${currentClass.name} ${meta.title}`}>
      <WorkspaceLayout
        className="teacher-class-workspace-page portal-simple-page"
        context="Teacher"
        title={meta.title}
        description={`${currentClass.name} · ${meta.description}`}
        actions={
          <Link
            className="platform-secondary-button"
            href={`/app/teacher/classes/${currentClass.id}`}
          >
            <ArrowLeft size={15} />
            Class overview
          </Link>
        }
        toolbar={nav}
        main={renderMain()}
      />
    </PlatformShell>
  );
}
