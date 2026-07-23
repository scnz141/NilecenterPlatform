import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  CircleSlash,
  CircleX,
  Clock3,
  FileText,
  Users,
} from "lucide-react";
import { Link } from "wouter";
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
import { runPlatformWorkflowActionRequest } from "@/lib/backend/api";
import { requireActiveUser } from "@/lib/auth/session";
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
  materials: {
    title: "Materials",
    description: "Published class learning resources.",
    icon: FileText,
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

export default function TeacherClassWorkspacePage({
  classId,
  view,
}: TeacherClassWorkspacePageProps) {
  const [state, setState] = useState(() => platformStore.getState());
  const [materialSavingKey, setMaterialSavingKey] = useState("");
  const [selectedSessionId, setSelectedSessionId] = useState("");
  const [attendanceStatuses, setAttendanceStatuses] = useState<
    Record<string, AttendanceStatus>
  >({});
  const [attendanceNotes, setAttendanceNotes] = useState<
    Record<string, string>
  >({});
  const [attendanceSaving, setAttendanceSaving] = useState(false);
  const attendanceCommandKey = useRef(
    `attendance.save:${crypto.randomUUID()}`
  );
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
  const moduleIds = new Set(
    state.modules
      .filter(item => item.courseId === course?.id)
      .map(item => item.id)
  );
  const lessons = state.lessons.filter(item => moduleIds.has(item.moduleId));
  const lessonIds = new Set(lessons.map(item => item.id));
  const resources = state.resources.filter(item =>
    lessonIds.has(item.lessonId)
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

  const toggleResourcePublish = async (resourceId: string) => {
    const resource = state.resources.find(item => item.id === resourceId);
    if (!resource) return;
    setMaterialSavingKey(resource.id);
    const result = await runPlatformWorkflowActionRequest({
      type: "material.publish.update",
      id: resource.id,
      published: !resource.published,
      actorId,
    });
    setMaterialSavingKey("");
    if (result.ok && result.data) {
      platformStore.setState(result.data.state);
      setState(result.data.state);
    }
  };

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
        subtitle={`${resources.length} resources`}
      >
        <div className="teacher-material-list teacher-class-material-list">
          {resources.length ? (
            resources.map(resource => {
              const lesson = lessons.find(
                item => item.id === resource.lessonId
              );
              return (
                <article key={resource.id}>
                  <div>
                    <strong>{resource.title}</strong>
                    <small>
                      {lesson?.title ?? "Lesson"} · {resource.type}
                    </small>
                  </div>
                  <button
                    type="button"
                    onClick={() => void toggleResourcePublish(resource.id)}
                    disabled={materialSavingKey === resource.id}
                  >
                    {materialSavingKey === resource.id
                      ? "Saving..."
                      : resource.published
                        ? "Published"
                        : "Publish"}
                  </button>
                </article>
              );
            })
          ) : (
            <article>
              <div>
                <strong>No materials yet</strong>
                <small>
                  Published resources for this class will appear here.
                </small>
              </div>
            </article>
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
