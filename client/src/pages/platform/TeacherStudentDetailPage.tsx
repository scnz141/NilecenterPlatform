import { useState } from "react";
import {
  ArrowLeft,
  BookOpen,
  CalendarCheck,
  Mail,
  Plus,
  Save,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { Link } from "wouter";
import PlatformShell from "@/components/platform/PlatformShell";
import { DetailLayout } from "@/components/platform/PlatformLayouts";
import {
  DataTableCard,
  StatusBadge,
} from "@/components/platform/PlatformPrimitives";
import { requireActiveUser } from "@/lib/auth/session";
import { runPlatformWorkflowActionRequest } from "@/lib/backend/api";
import { platformStore } from "@/lib/domain/store";
import type { AttendanceStatus, StudentStatus } from "@/lib/domain/types";

type TeacherStudentDetailPageProps = {
  classId: string;
  studentId: string;
};

const attendanceLabels: Record<AttendanceStatus, string> = {
  present: "Present",
  late: "Late",
  absent: "Absent",
  excused: "Excused",
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
  if (!value || Number.isNaN(Date.parse(value))) return "Session";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function TeacherStudentDetailPage({
  classId,
  studentId,
}: TeacherStudentDetailPageProps) {
  const [state, setState] = useState(() => platformStore.getState());
  const [category, setCategory] = useState<
    "attendance" | "engagement" | "academic" | "wellbeing"
  >("academic");
  const [priority, setPriority] = useState<
    "low" | "normal" | "high" | "urgent"
  >("normal");
  const [summary, setSummary] = useState("");
  const [nextStep, setNextStep] = useState("");
  const [studentVisible, setStudentVisible] = useState(true);
  const [updateNotes, setUpdateNotes] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const teacherId = requireActiveUser("teacher").id;
  const classGroup = state.classGroups.find(item => item.id === classId);
  const run = state.courseRuns.find(
    item => item.id === classGroup?.courseRunId && item.teacherId === teacherId
  );
  const isRosterMember =
    classGroup?.studentIds.includes(studentId) ||
    state.enrollments.some(
      item => item.classGroupId === classId && item.studentId === studentId
    );
  const student = isRosterMember
    ? state.students.find(item => item.id === studentId)
    : undefined;
  const user = state.users.find(item => item.id === student?.userId);
  const course = state.courses.find(item => item.id === run?.courseId);
  const enrollment = state.enrollments.find(
    item => item.classGroupId === classId && item.studentId === studentId
  );
  const interventions = state.studentInterventions
    .filter(
      item => item.classGroupId === classId && item.studentId === studentId
    )
    .sort(
      (left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt)
    );

  const syncState = (next: typeof state) => {
    platformStore.setState(next);
    setState(next);
  };

  const createIntervention = async () => {
    setSaving(true);
    const response = await runPlatformWorkflowActionRequest({
      type: "student.intervention.create",
      studentId,
      classGroupId: classId,
      category,
      priority,
      summary,
      nextStep,
      studentVisible,
    });
    setSaving(false);
    if (!response.ok || !response.data) {
      toast.error("Intervention was not created", {
        description: response.error ?? "Check the details and try again.",
      });
      return;
    }
    syncState(response.data.state);
    setSummary("");
    setNextStep("");
    toast.success("Intervention created");
  };

  const updateIntervention = async (
    interventionId: string,
    status: "monitoring" | "resolved" | "cancelled",
    expectedVersion: number
  ) => {
    const resolutionNote = updateNotes[interventionId]?.trim() ?? "";
    setSaving(true);
    const response = await runPlatformWorkflowActionRequest({
      type: "student.intervention.status.update",
      interventionId,
      status,
      resolutionNote,
      expectedVersion,
    });
    setSaving(false);
    if (!response.ok || !response.data) {
      toast.error("Intervention was not updated", {
        description: response.error ?? "Check the note and try again.",
      });
      return;
    }
    syncState(response.data.state);
    setUpdateNotes(value => ({ ...value, [interventionId]: "" }));
    toast.success(
      status === "resolved" ? "Intervention resolved" : "Intervention updated"
    );
  };

  if (!classGroup || !run || !student || !user) {
    return (
      <PlatformShell role="teacher" title="Student not available">
        <DetailLayout
          className="portal-simple-page teacher-student-detail-page"
          context="Teacher"
          title="Student not available"
          description="This learner is not in one of your currently assigned classes."
          actions={
            <Link
              className="platform-secondary-button"
              href={`/app/teacher/classes/${classId}/students`}
            >
              <ArrowLeft size={15} />
              Back to roster
            </Link>
          }
          main={
            <div className="platform-empty-state" role="status">
              <UserRound size={20} aria-hidden="true" />
              <strong>Access is limited to your class roster</strong>
              <span>Choose a learner from an assigned class.</span>
            </div>
          }
        />
      </PlatformShell>
    );
  }

  const attendance = state.attendance
    .filter(
      item => item.classGroupId === classId && item.studentId === student.id
    )
    .sort((left, right) => {
      const leftSession = state.classSessions.find(
        item => item.id === left.sessionId
      );
      const rightSession = state.classSessions.find(
        item => item.id === right.sessionId
      );
      return (
        Date.parse(rightSession?.startsAt ?? "") -
        Date.parse(leftSession?.startsAt ?? "")
      );
    });
  const countedAttendance = attendance.filter(
    item => item.status !== "excused"
  );
  const attended = countedAttendance.filter(
    item => item.status === "present" || item.status === "late"
  ).length;
  const attendanceRate = countedAttendance.length
    ? Math.round((attended / countedAttendance.length) * 100)
    : null;

  return (
    <PlatformShell role="teacher" title={user.name}>
      <DetailLayout
        className="portal-simple-page teacher-student-detail-page"
        context={classGroup.name}
        title={user.name}
        description="Class membership, attendance, and learning access."
        actions={
          <Link
            className="platform-secondary-button"
            href={`/app/teacher/classes/${classId}/students`}
          >
            <ArrowLeft size={15} />
            Back to roster
          </Link>
        }
        main={
          <div className="portal-simple-stack">
            <section className="portal-simple-form-card">
              <div>
                <span>Student</span>
                <h2>{student.currentLevel ?? course?.title ?? "Learner"}</h2>
              </div>
              <StatusBadge tone={studentTone(student.status)}>
                {student.status}
              </StatusBadge>
              <dl className="teacher-class-fact-grid">
                <div>
                  <dt>Class</dt>
                  <dd>{classGroup.name}</dd>
                </div>
                <div>
                  <dt>Course</dt>
                  <dd>{course?.title ?? "Course not mapped"}</dd>
                </div>
                <div>
                  <dt>Attendance</dt>
                  <dd>
                    {attendanceRate === null
                      ? "Not recorded"
                      : `${attendanceRate}%`}
                  </dd>
                </div>
                <div>
                  <dt>Enrollment</dt>
                  <dd>{enrollment?.status ?? "Roster member"}</dd>
                </div>
              </dl>
              <div className="teacher-class-overview-actions">
                <a
                  className="platform-secondary-button"
                  href={`mailto:${user.email}`}
                >
                  <Mail size={15} />
                  Email student
                </a>
                {course ? (
                  <Link
                    className="platform-primary-button"
                    href={`/app/teacher/moodle-source/${course.id}`}
                  >
                    <BookOpen size={15} />
                    Course content
                  </Link>
                ) : null}
              </div>
            </section>

            <DataTableCard
              title="Attendance history"
              subtitle={`${attendance.length} record${attendance.length === 1 ? "" : "s"}`}
            >
              {attendance.length ? (
                <div className="teacher-class-record-list">
                  {attendance.map(record => {
                    const session = state.classSessions.find(
                      item => item.id === record.sessionId
                    );
                    return (
                      <article key={record.id}>
                        <div className="teacher-class-record-copy">
                          <span>{formatDateTime(session?.startsAt)}</span>
                          <strong>{session?.title ?? "Class session"}</strong>
                          <p>{record.notes || "No attendance note"}</p>
                        </div>
                        <div className="teacher-class-record-actions">
                          <StatusBadge
                            tone={
                              record.status === "present"
                                ? "green"
                                : record.status === "absent"
                                  ? "red"
                                  : "amber"
                            }
                          >
                            {attendanceLabels[record.status]}
                          </StatusBadge>
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <div className="platform-empty-state">
                  <CalendarCheck size={20} aria-hidden="true" />
                  <strong>No attendance history</strong>
                  <span>Saved class attendance will appear here.</span>
                </div>
              )}
            </DataTableCard>

            <section
              className="portal-simple-form-card teacher-intervention-workspace"
              data-testid="teacher-student-interventions"
            >
              <div className="teacher-intervention-heading">
                <div>
                  <span>Student support</span>
                  <h2>Interventions</h2>
                  <p>
                    Record one clear concern, next action, and follow-up state
                    for this class.
                  </p>
                </div>
                <StatusBadge
                  tone={
                    interventions.some(item => item.status === "open")
                      ? "amber"
                      : "green"
                  }
                >
                  {
                    interventions.filter(
                      item =>
                        item.status === "open" || item.status === "monitoring"
                    ).length
                  }{" "}
                  active
                </StatusBadge>
              </div>

              <div className="teacher-intervention-create">
                <label>
                  Category
                  <select
                    value={category}
                    onChange={event =>
                      setCategory(
                        event.target.value as
                          | "attendance"
                          | "engagement"
                          | "academic"
                          | "wellbeing"
                      )
                    }
                  >
                    <option value="academic">Academic</option>
                    <option value="attendance">Attendance</option>
                    <option value="engagement">Engagement</option>
                    <option value="wellbeing">Wellbeing</option>
                  </select>
                </label>
                <label>
                  Priority
                  <select
                    value={priority}
                    onChange={event =>
                      setPriority(
                        event.target.value as
                          | "low"
                          | "normal"
                          | "high"
                          | "urgent"
                      )
                    }
                  >
                    <option value="low">Low</option>
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </label>
                <label className="teacher-intervention-wide">
                  Concern
                  <textarea
                    value={summary}
                    onChange={event => setSummary(event.target.value)}
                    placeholder="Describe the observed concern."
                    rows={3}
                  />
                </label>
                <label className="teacher-intervention-wide">
                  Next action
                  <textarea
                    value={nextStep}
                    onChange={event => setNextStep(event.target.value)}
                    placeholder="State the next action and review point."
                    rows={3}
                  />
                </label>
                <label className="teacher-intervention-visibility">
                  <input
                    type="checkbox"
                    checked={studentVisible}
                    onChange={event => setStudentVisible(event.target.checked)}
                  />
                  Share the support action with the student
                </label>
                <button
                  type="button"
                  className="platform-primary-button"
                  onClick={createIntervention}
                  disabled={
                    saving ||
                    summary.trim().length < 10 ||
                    nextStep.trim().length < 10
                  }
                  data-testid="teacher-intervention-create"
                >
                  <Plus size={15} />
                  Create intervention
                </button>
              </div>

              {interventions.length ? (
                <div className="teacher-intervention-list">
                  {interventions.map(intervention => {
                    const complete =
                      intervention.status === "resolved" ||
                      intervention.status === "cancelled";
                    return (
                      <article key={intervention.id}>
                        <div className="teacher-intervention-record-heading">
                          <div>
                            <span>
                              {intervention.category} · {intervention.priority}
                            </span>
                            <strong>{intervention.summary}</strong>
                          </div>
                          <StatusBadge
                            tone={
                              intervention.status === "resolved"
                                ? "green"
                                : intervention.priority === "urgent" ||
                                    intervention.priority === "high"
                                  ? "red"
                                  : "amber"
                            }
                          >
                            {intervention.status}
                          </StatusBadge>
                        </div>
                        <p>{intervention.nextStep}</p>
                        <small>
                          {intervention.studentVisible
                            ? "Visible to student"
                            : "Staff only"}{" "}
                          · Updated {formatDateTime(intervention.updatedAt)}
                        </small>
                        {!complete ? (
                          <div className="teacher-intervention-update">
                            <label>
                              Follow-up note
                              <input
                                value={updateNotes[intervention.id] ?? ""}
                                onChange={event =>
                                  setUpdateNotes(value => ({
                                    ...value,
                                    [intervention.id]: event.target.value,
                                  }))
                                }
                                placeholder="Record the result or next review."
                              />
                            </label>
                            <button
                              type="button"
                              className="platform-secondary-button"
                              disabled={
                                saving ||
                                (updateNotes[intervention.id]?.trim().length ??
                                  0) < 10
                              }
                              onClick={() =>
                                updateIntervention(
                                  intervention.id,
                                  "monitoring",
                                  intervention.version
                                )
                              }
                            >
                              <Save size={14} />
                              Keep monitoring
                            </button>
                            <button
                              type="button"
                              className="platform-primary-button"
                              disabled={
                                saving ||
                                (updateNotes[intervention.id]?.trim().length ??
                                  0) < 10
                              }
                              onClick={() =>
                                updateIntervention(
                                  intervention.id,
                                  "resolved",
                                  intervention.version
                                )
                              }
                            >
                              Resolve
                            </button>
                          </div>
                        ) : intervention.resolutionNote ? (
                          <p className="teacher-intervention-resolution">
                            {intervention.resolutionNote}
                          </p>
                        ) : null}
                      </article>
                    );
                  })}
                </div>
              ) : (
                <div className="platform-empty-state">
                  <UserRound size={20} aria-hidden="true" />
                  <strong>No interventions</strong>
                  <span>Create one only when a learner needs follow-up.</span>
                </div>
              )}
            </section>

            <section
              className="portal-simple-form-card"
              data-testid="teacher-student-moodle-boundary"
            >
              <div>
                <span>Learning outcomes</span>
                <h2>Moodle-managed results</h2>
                <p>
                  Assignments, quiz attempts, completion, grades, and feedback
                  appear only from verified Moodle projections. This page does
                  not calculate or store replacement learning results.
                </p>
              </div>
            </section>
          </div>
        }
      />
    </PlatformShell>
  );
}
