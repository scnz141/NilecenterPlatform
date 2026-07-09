import { useEffect, useState } from "react";
import {
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Headphones,
  Plus,
  Search,
} from "lucide-react";
import { Link } from "wouter";
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
import { runPlatformWorkflowActionRequest } from "@/lib/backend/api";
import { getActiveUser } from "@/lib/auth/session";
import { platformStore } from "@/lib/domain/store";
import type {
  AssignmentSubmission,
  CalendarEventType,
  EntityStatus,
  QuizAttempt,
} from "@/lib/domain/types";
import { demoUsers } from "@/lib/platformData";

type TeacherWorkView =
  | "assignments"
  | "assignment-detail"
  | "new-assignment"
  | "grading"
  | "calendar"
  | "quran";

type TeacherWorkPageProps = {
  view: TeacherWorkView;
  assignmentId?: string;
};

const calendarTypeOptions: { value: CalendarEventType; label: string }[] = [
  { value: "live_session", label: "Live session" },
  { value: "class_session", label: "Class session" },
  { value: "assignment_due", label: "Assignment due" },
  { value: "quiz_due", label: "Quiz due" },
  { value: "reminder", label: "Reminder" },
  { value: "room_booking", label: "Room booking" },
];

function getFutureDateInput(days = 4) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function formatDate(value?: string) {
  if (!value) return "No date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No date";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
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

function splitList(value: string) {
  return value
    .split(",")
    .map(item => item.trim())
    .filter(Boolean);
}

function statusTone(status: EntityStatus): "green" | "amber" | "red" | "slate" {
  if (status === "active" || status === "completed" || status === "approved") {
    return "green";
  }
  if (status === "pending" || status === "draft") return "amber";
  if (status === "paused" || status === "cancelled" || status === "rejected") {
    return "red";
  }
  return "slate";
}

function truncate(value: string, maxLength = 70) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 3).trimEnd()}...`;
}

export default function TeacherWorkPage({
  view,
  assignmentId,
}: TeacherWorkPageProps) {
  const [state, setState] = useState(() => platformStore.getState());
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | EntityStatus>("all");
  const [savingAction, setSavingAction] = useState("");
  const [actionError, setActionError] = useState("");
  const [selectedSubmissionId, setSelectedSubmissionId] = useState("");
  const [selectedAttemptId, setSelectedAttemptId] = useState("");
  const [assignmentScore, setAssignmentScore] = useState(88);
  const [assignmentFeedback, setAssignmentFeedback] = useState(
    "Good work. Strengthen examples in the next submission."
  );
  const [quizScore, setQuizScore] = useState(90);
  const [quizFeedback, setQuizFeedback] = useState(
    "Reviewed. Keep improving grammar accuracy."
  );
  const [assignmentDraft, setAssignmentDraft] = useState({
    courseRunId: "",
    title: "Practice assignment",
    dueAt: getFutureDateInput(5),
    submissionType: "text" as "text" | "file" | "audio" | "video",
    rubric: "Accuracy, Evidence, Teacher notes",
  });
  const [calendarDraft, setCalendarDraft] = useState({
    title: "Arabic L3 review session",
    eventType: "live_session" as CalendarEventType,
    branchId: "",
    classGroupId: "",
    roomId: "",
    date: getFutureDateInput(3),
    starts: "09:00",
    ends: "10:30",
  });
  const [selectedRecitationId, setSelectedRecitationId] = useState("");
  const [memorizedPercent, setMemorizedPercent] = useState(0);
  const [tajweedScore, setTajweedScore] = useState(0);
  const [recitationFeedback, setRecitationFeedback] = useState(
    "Clear recitation. Continue revision before the next lesson."
  );

  const activeUser =
    getActiveUser() ?? demoUsers.find(user => user.activeRole === "teacher");
  const teacherId = activeUser?.id ?? "usr_teacher_demo";

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

  const teacherRuns = state.courseRuns.filter(
    run => run.teacherId === teacherId
  );
  const runIds = new Set(teacherRuns.map(run => run.id));
  const teacherClassGroups = state.classGroups.filter(group =>
    runIds.has(group.courseRunId)
  );
  const classGroupIds = new Set(teacherClassGroups.map(group => group.id));
  const branchIds = new Set(teacherRuns.map(run => run.branchId));
  const branchOptions = state.branches.filter(branch =>
    branchIds.has(branch.id)
  );
  const selectedBranch =
    branchOptions.find(branch => branch.id === calendarDraft.branchId) ??
    branchOptions[0];
  const classOptions = teacherClassGroups.filter(group => {
    if (!selectedBranch) return true;
    const run = state.courseRuns.find(item => item.id === group.courseRunId);
    return run?.branchId === selectedBranch.id;
  });
  const roomOptions = state.rooms.filter(room =>
    selectedBranch
      ? room.branchId === selectedBranch.id
      : branchIds.has(room.branchId)
  );
  const teacherRunKey = teacherRuns.map(run => run.id).join("|");
  const branchOptionKey = branchOptions.map(branch => branch.id).join("|");
  const classOptionKey = classOptions.map(group => group.id).join("|");
  const roomOptionKey = roomOptions.map(room => room.id).join("|");

  useEffect(() => {
    setAssignmentDraft(current => ({
      ...current,
      courseRunId: current.courseRunId || teacherRuns[0]?.id || "",
    }));
  }, [teacherRunKey]);

  useEffect(() => {
    setCalendarDraft(current => ({
      ...current,
      branchId:
        current.branchId &&
        branchOptions.some(branch => branch.id === current.branchId)
          ? current.branchId
          : branchOptions[0]?.id || "",
      classGroupId:
        current.classGroupId &&
        classOptions.some(group => group.id === current.classGroupId)
          ? current.classGroupId
          : classOptions[0]?.id || "",
      roomId:
        current.roomId && roomOptions.some(room => room.id === current.roomId)
          ? current.roomId
          : roomOptions[0]?.id || "",
    }));
  }, [branchOptionKey, classOptionKey, roomOptionKey]);

  const refreshWithState = (nextState: typeof state) => {
    platformStore.setState(nextState);
    setState(nextState);
  };

  const runAction = async (
    label: string,
    payload: Parameters<typeof runPlatformWorkflowActionRequest>[0]
  ) => {
    setSavingAction(label);
    setActionError("");
    const response = await runPlatformWorkflowActionRequest(payload);
    setSavingAction("");
    if (!response.ok || !response.data) {
      const message = response.error ?? `${label} failed.`;
      setActionError(message);
      toast.error(`${label} failed`, { description: message });
      return false;
    }
    refreshWithState(response.data.state);
    toast.success(label, { description: response.data.persistence });
    return true;
  };

  const courseLabel = (runId?: string) => {
    const run = state.courseRuns.find(item => item.id === runId);
    const course = state.courses.find(item => item.id === run?.courseId);
    return course?.title ?? run?.term ?? "Assigned class";
  };

  const classLabel = (runId?: string) => {
    const group = teacherClassGroups.find(item => item.courseRunId === runId);
    return group?.name ?? courseLabel(runId);
  };

  const studentName = (studentId?: string) => {
    const student = state.students.find(item => item.id === studentId);
    const user = state.users.find(item => item.id === student?.userId);
    return user?.name ?? "Student";
  };

  const assignmentTitle = (assignmentId?: string) =>
    state.assignments.find(item => item.id === assignmentId)?.title ??
    "Assignment";

  const quizTitle = (quizId?: string) =>
    state.quizzes.find(item => item.id === quizId)?.title ?? "Quiz";

  const assignments = state.assignments
    .filter(assignment => runIds.has(assignment.courseRunId))
    .sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());

  const filteredAssignments = assignments.filter(assignment => {
    const text = [
      assignment.title,
      assignment.submissionType,
      assignment.status,
      courseLabel(assignment.courseRunId),
      classLabel(assignment.courseRunId),
    ]
      .join(" ")
      .toLowerCase();
    const matchesSearch =
      !search.trim() || text.includes(search.trim().toLowerCase());
    const matchesStatus = status === "all" || assignment.status === status;
    return matchesSearch && matchesStatus;
  });
  const routeAssignment = assignmentId
    ? assignments.find(assignment => assignment.id === assignmentId)
    : undefined;
  const routeAssignmentRun = state.courseRuns.find(
    run => run.id === routeAssignment?.courseRunId
  );
  const routeAssignmentCourse = state.courses.find(
    course => course.id === routeAssignmentRun?.courseId
  );
  const routeAssignmentSubmissions = routeAssignment
    ? state.assignmentSubmissions
        .filter(submission => submission.assignmentId === routeAssignment.id)
        .sort(
          (a, b) =>
            new Date(b.submittedAt).getTime() -
            new Date(a.submittedAt).getTime()
        )
    : [];
  const routeAssignmentPending = routeAssignmentSubmissions.filter(
    submission => submission.status === "pending"
  ).length;

  const assignmentSubmissions = state.assignmentSubmissions
    .filter(submission => {
      const assignment = state.assignments.find(
        item => item.id === submission.assignmentId
      );
      return Boolean(assignment && runIds.has(assignment.courseRunId));
    })
    .sort((a, b) => {
      const statusPriority = (item: AssignmentSubmission) =>
        item.status === "pending" ? 0 : 1;
      const priorityDelta = statusPriority(a) - statusPriority(b);
      if (priorityDelta !== 0) return priorityDelta;
      return (
        new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
      );
    });
  const reviewSubmissions = assignmentSubmissions.filter(
    submission => submission.status === "pending"
  );
  const reviewSubmissionKey = reviewSubmissions.map(item => item.id).join("|");
  const selectedSubmission =
    reviewSubmissions.find(item => item.id === selectedSubmissionId) ??
    reviewSubmissions[0];

  const quizAttempts = state.quizAttempts
    .filter(attempt => {
      const quiz = state.quizzes.find(item => item.id === attempt.quizId);
      return Boolean(quiz && runIds.has(quiz.courseRunId));
    })
    .sort((a, b) => {
      const statusPriority = (item: QuizAttempt) =>
        item.status === "pending" ? 0 : 1;
      const priorityDelta = statusPriority(a) - statusPriority(b);
      if (priorityDelta !== 0) return priorityDelta;
      return (
        new Date(b.submittedAt ?? b.startedAt).getTime() -
        new Date(a.submittedAt ?? a.startedAt).getTime()
      );
    });
  const reviewAttempts = quizAttempts.filter(
    attempt => attempt.status === "pending"
  );
  const reviewAttemptKey = reviewAttempts.map(item => item.id).join("|");
  const selectedAttempt =
    reviewAttempts.find(item => item.id === selectedAttemptId) ??
    reviewAttempts[0];

  const visibleEvents = state.events
    .filter(event => {
      if (event.ownerId === teacherId) return true;
      return event.classGroupId ? classGroupIds.has(event.classGroupId) : false;
    })
    .sort(
      (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()
    );

  const recitations = state.recitationSubmissions
    .filter(submission => {
      const plan = state.quranPlans.find(
        item => item.studentId === submission.studentId
      );
      return !plan || plan.teacherId === teacherId;
    })
    .sort(
      (a, b) =>
        new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
    );
  const selectedRecitation =
    recitations.find(item => item.id === selectedRecitationId) ??
    recitations[0];
  const recitationKey = recitations.map(item => item.id).join("|");
  const selectedStudent = state.students.find(
    item => item.id === selectedRecitation?.studentId
  );
  const selectedQuranPlan = state.quranPlans.find(
    item => item.studentId === selectedRecitation?.studentId
  );
  const selectedProgress =
    state.quranProgress.find(
      item => item.studentId === selectedRecitation?.studentId
    ) ?? state.quranProgress[0];

  useEffect(() => {
    if (!selectedSubmissionId && reviewSubmissions[0]?.id) {
      setSelectedSubmissionId(reviewSubmissions[0].id);
    }
  }, [reviewSubmissionKey, selectedSubmissionId]);

  useEffect(() => {
    if (!selectedAttemptId && reviewAttempts[0]?.id) {
      setSelectedAttemptId(reviewAttempts[0].id);
    }
  }, [reviewAttemptKey, selectedAttemptId]);

  useEffect(() => {
    if (!selectedRecitationId && recitations[0]?.id) {
      setSelectedRecitationId(recitations[0].id);
    }
  }, [recitationKey, selectedRecitationId]);

  useEffect(() => {
    setMemorizedPercent(selectedProgress?.memorizedPercent ?? 0);
    setTajweedScore(selectedProgress?.tajweedScore ?? 0);
    setRecitationFeedback(
      selectedRecitation?.feedback ??
        selectedProgress?.notes ??
        "Clear recitation. Continue revision before the next lesson."
    );
  }, [selectedProgress?.id, selectedRecitation?.id]);

  const createAssignment = async () => {
    if (!assignmentDraft.courseRunId || !assignmentDraft.title.trim()) return;
    await runAction("Assignment created", {
      type: "assignment.create",
      courseRunId: assignmentDraft.courseRunId,
      title: assignmentDraft.title.trim(),
      dueAt: new Date(assignmentDraft.dueAt).toISOString(),
      submissionType: assignmentDraft.submissionType,
      rubric: splitList(assignmentDraft.rubric),
    });
  };

  const gradeSubmission = async () => {
    if (!selectedSubmission) return;
    await runAction("Submission graded", {
      type: "assignment.grade",
      submissionId: selectedSubmission.id,
      score: Math.min(100, Math.max(0, Number(assignmentScore) || 0)),
      feedback: assignmentFeedback.trim() || "Reviewed by teacher.",
    });
  };

  const reviewQuizAttempt = async () => {
    if (!selectedAttempt) return;
    await runAction("Quiz reviewed", {
      type: "quiz.review",
      attemptId: selectedAttempt.id,
      score: Math.min(100, Math.max(0, Number(quizScore) || 0)),
      feedback: quizFeedback.trim() || "Reviewed by teacher.",
    });
  };

  const createCalendarEvent = async () => {
    const calendarForm = document.querySelector<HTMLElement>(
      ".teacher-calendar-form"
    );
    const formValue = (name: string, fallback: string) =>
      calendarForm
        ?.querySelector<
          HTMLInputElement | HTMLSelectElement
        >(`[name="${name}"]`)
        ?.value.trim() || fallback;
    const submitDraft = {
      title: formValue("title", calendarDraft.title),
      eventType: formValue(
        "eventType",
        calendarDraft.eventType
      ) as CalendarEventType,
      branchId: formValue("branchId", calendarDraft.branchId),
      classGroupId: formValue("classGroupId", calendarDraft.classGroupId),
      roomId: formValue("roomId", calendarDraft.roomId),
      date: formValue("date", calendarDraft.date),
      starts: formValue("starts", calendarDraft.starts),
      ends: formValue("ends", calendarDraft.ends),
    };
    if (!submitDraft.title.trim()) return;
    const usesClass =
      submitDraft.eventType === "live_session" ||
      submitDraft.eventType === "class_session";
    const usesRoom =
      submitDraft.eventType !== "assignment_due" &&
      submitDraft.eventType !== "quiz_due" &&
      submitDraft.eventType !== "reminder";
    const submitBranch =
      branchOptions.find(branch => branch.id === submitDraft.branchId) ??
      selectedBranch;
    const submitClassOptions = teacherClassGroups.filter(group => {
      if (!submitBranch) return true;
      const run = state.courseRuns.find(item => item.id === group.courseRunId);
      return run?.branchId === submitBranch.id;
    });
    const submitRoomOptions = state.rooms.filter(room =>
      submitBranch
        ? room.branchId === submitBranch.id
        : branchIds.has(room.branchId)
    );
    const submitClass = usesClass
      ? (submitClassOptions.find(
          group => group.id === submitDraft.classGroupId
        ) ?? submitClassOptions[0])
      : undefined;
    const submitRun = state.courseRuns.find(
      run => run.id === submitClass?.courseRunId
    );
    const submitRoom = usesRoom
      ? (submitRoomOptions.find(room => room.id === submitDraft.roomId) ??
        submitRoomOptions.find(room => room.branchId === submitRun?.branchId) ??
        submitRoomOptions[0])
      : undefined;
    const submitBranchId =
      submitRun?.branchId ?? submitRoom?.branchId ?? submitBranch?.id;
    await runAction("Event scheduled", {
      type: "calendar.create",
      eventType: submitDraft.eventType,
      title: submitDraft.title.trim(),
      startsAt: `${submitDraft.date}T${submitDraft.starts}:00+03:00`,
      endsAt: `${submitDraft.date}T${submitDraft.ends}:00+03:00`,
      branchId: submitBranchId,
      roomId: usesRoom ? submitRoom?.id : undefined,
      classGroupId: usesClass ? submitClass?.id : undefined,
    });
  };

  const updateQuranProgress = async () => {
    if (!selectedProgress) return;
    await runAction("Progress updated", {
      type: "quran.progress.update",
      recordId: selectedProgress.id,
      memorizedPercent: Math.min(
        100,
        Math.max(0, Number(memorizedPercent) || 0)
      ),
      tajweedScore: Math.min(100, Math.max(0, Number(tajweedScore) || 0)),
      notes: recitationFeedback.trim(),
    });
  };

  const reviewRecitation = async () => {
    if (!selectedRecitation || !recitationFeedback.trim()) return;
    await runAction("Recitation reviewed", {
      type: "recitation.review",
      submissionId: selectedRecitation.id,
      feedback: recitationFeedback.trim(),
    });
  };

  const workTabs = (
    <nav
      className="portal-ia-subnav teacher-work-tabs"
      aria-label="Teacher work"
    >
      <Link
        href="/app/teacher/assignments"
        className={
          view === "assignments" ||
          view === "assignment-detail" ||
          view === "new-assignment"
            ? "active"
            : ""
        }
      >
        Assignments
      </Link>
      <Link
        href="/app/teacher/grading"
        className={view === "grading" ? "active" : ""}
      >
        Grading
      </Link>
      <Link
        href="/app/teacher/calendar"
        className={view === "calendar" ? "active" : ""}
      >
        Calendar
      </Link>
      <Link
        href="/app/teacher/quran-review"
        className={view === "quran" ? "active" : ""}
      >
        Quran review
      </Link>
    </nav>
  );

  if (view === "new-assignment") {
    return (
      <PlatformShell role="teacher" title="Create assignment">
        <FormFlowLayout
          className="portal-ia-page teacher-work-page"
          context={<span>Teacher</span>}
          title="Create assignment"
          description="Create one assignment for an assigned class."
          actions={
            <Link
              className="platform-secondary-button"
              href="/app/teacher/assignments"
            >
              Back to assignments
            </Link>
          }
          toolbar={workTabs}
          main={
            <section className="portal-ia-form-card">
              {actionError ? (
                <p className="platform-form-error">{actionError}</p>
              ) : null}
              <div className="portal-ia-form-grid">
                <label>
                  Class
                  <select
                    value={assignmentDraft.courseRunId}
                    onChange={event =>
                      setAssignmentDraft(current => ({
                        ...current,
                        courseRunId: event.target.value,
                      }))
                    }
                  >
                    {teacherRuns.map(run => (
                      <option key={run.id} value={run.id}>
                        {courseLabel(run.id)} · {run.term}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Title
                  <input
                    value={assignmentDraft.title}
                    onChange={event =>
                      setAssignmentDraft(current => ({
                        ...current,
                        title: event.target.value,
                      }))
                    }
                  />
                </label>
                <label>
                  Due date
                  <input
                    type="date"
                    value={assignmentDraft.dueAt}
                    onChange={event =>
                      setAssignmentDraft(current => ({
                        ...current,
                        dueAt: event.target.value,
                      }))
                    }
                  />
                </label>
                <label>
                  Submission
                  <select
                    value={assignmentDraft.submissionType}
                    onChange={event =>
                      setAssignmentDraft(current => ({
                        ...current,
                        submissionType: event.target
                          .value as typeof assignmentDraft.submissionType,
                      }))
                    }
                  >
                    <option value="text">Text</option>
                    <option value="file">File</option>
                    <option value="audio">Audio</option>
                    <option value="video">Video</option>
                  </select>
                </label>
                <label className="wide">
                  Rubric
                  <input
                    value={assignmentDraft.rubric}
                    onChange={event =>
                      setAssignmentDraft(current => ({
                        ...current,
                        rubric: event.target.value,
                      }))
                    }
                  />
                </label>
              </div>
              <div className="portal-ia-actions">
                <button
                  type="button"
                  className="platform-primary-button"
                  disabled={
                    savingAction === "Assignment created" ||
                    !assignmentDraft.courseRunId ||
                    !assignmentDraft.title.trim()
                  }
                  onClick={createAssignment}
                >
                  <Plus size={15} />
                  {savingAction === "Assignment created"
                    ? "Creating"
                    : "Create assignment"}
                </button>
              </div>
            </section>
          }
        />
      </PlatformShell>
    );
  }

  if (view === "assignments") {
    return (
      <PlatformShell role="teacher" title="Assignments">
        <WorkspaceLayout
          className="portal-ia-page teacher-work-page"
          context={<span>Teacher</span>}
          title="Assignments"
          description="Find assignments for your classes."
          actions={
            <Link
              className="platform-primary-button"
              href="/app/teacher/assignments/new"
            >
              <Plus size={15} />
              New assignment
            </Link>
          }
          toolbar={
            <>
              {workTabs}
              <div className="portal-simple-toolbar teacher-work-toolbar">
                <label>
                  Search
                  <span>
                    <Search size={14} />
                    <input
                      value={search}
                      onChange={event => setSearch(event.target.value)}
                      placeholder="Assignment, class, type"
                    />
                  </span>
                </label>
                <label>
                  Status
                  <select
                    value={status}
                    onChange={event =>
                      setStatus(event.target.value as "all" | EntityStatus)
                    }
                  >
                    <option value="all">All statuses</option>
                    <option value="active">Active</option>
                    <option value="pending">Pending</option>
                    <option value="paused">Paused</option>
                    <option value="completed">Completed</option>
                  </select>
                </label>
              </div>
            </>
          }
          main={
            <DataTableCard
              title="Assignments"
              subtitle={`${filteredAssignments.length} items`}
            >
              <div className="admin-ia-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Assignment</th>
                      <th>Class</th>
                      <th>Due</th>
                      <th>Submission</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAssignments.map(assignment => (
                      <tr key={assignment.id}>
                        <td>
                          <strong>{assignment.title}</strong>
                          <small>
                            {assignment.rubric.slice(0, 2).join(", ")}
                          </small>
                        </td>
                        <td>{classLabel(assignment.courseRunId)}</td>
                        <td>{formatDate(assignment.dueAt)}</td>
                        <td>{assignment.submissionType}</td>
                        <td>
                          <StatusBadge tone={statusTone(assignment.status)}>
                            {assignment.status}
                          </StatusBadge>
                        </td>
                        <td>
                          <Link
                            className="platform-row-link"
                            href={`/app/teacher/assignments/${assignment.id}`}
                          >
                            Open
                          </Link>
                        </td>
                      </tr>
                    ))}
                    {!filteredAssignments.length ? (
                      <tr>
                        <td colSpan={6}>
                          <div className="platform-empty-state">
                            <strong>No assignments found</strong>
                            <span>
                              Try another search or create an assignment.
                            </span>
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </DataTableCard>
          }
        />
      </PlatformShell>
    );
  }

  if (view === "assignment-detail") {
    return (
      <PlatformShell role="teacher" title="Assignment detail">
        <WorkspaceLayout
          className="portal-ia-page teacher-work-page"
          context={<span>Teacher</span>}
          title={routeAssignment?.title ?? "Assignment detail"}
          description="Review one assignment and its submitted work."
          actions={
            <Link
              className="platform-secondary-button"
              href="/app/teacher/assignments"
            >
              Back to assignments
            </Link>
          }
          toolbar={workTabs}
          main={
            routeAssignment ? (
              <>
                <section className="platform-workflow-card">
                  <div className="platform-workflow-title">
                    <span>
                      <BookOpen size={16} /> Assignment
                    </span>
                    <StatusBadge tone={statusTone(routeAssignment.status)}>
                      {routeAssignment.status}
                    </StatusBadge>
                  </div>
                  <div className="teacher-assignment-detail-grid">
                    <article>
                      <span>Class</span>
                      <strong>{classLabel(routeAssignment.courseRunId)}</strong>
                      <small>
                        {routeAssignmentCourse?.title ?? "Assigned course"}
                      </small>
                    </article>
                    <article>
                      <span>Due</span>
                      <strong>{formatDate(routeAssignment.dueAt)}</strong>
                      <small>{routeAssignment.submissionType} submission</small>
                    </article>
                    <article>
                      <span>Submitted</span>
                      <strong>{routeAssignmentSubmissions.length}</strong>
                      <small>{routeAssignmentPending} pending review</small>
                    </article>
                  </div>
                  <div className="platform-chip-row">
                    {routeAssignment.rubric.map(item => (
                      <span key={item}>{item}</span>
                    ))}
                  </div>
                </section>

                <DataTableCard
                  title="Submitted work"
                  subtitle={`${routeAssignmentSubmissions.length} submission(s)`}
                >
                  <div className="admin-ia-table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Student</th>
                          <th>Submitted</th>
                          <th>Status</th>
                          <th>Score</th>
                          <th>Feedback</th>
                        </tr>
                      </thead>
                      <tbody>
                        {routeAssignmentSubmissions.map(submission => (
                          <tr key={submission.id}>
                            <td>
                              <strong>
                                {studentName(submission.studentId)}
                              </strong>
                              <small>{truncate(submission.response, 64)}</small>
                            </td>
                            <td>{formatDateTime(submission.submittedAt)}</td>
                            <td>
                              <StatusBadge tone={statusTone(submission.status)}>
                                {submission.status}
                              </StatusBadge>
                            </td>
                            <td>
                              {submission.score === undefined
                                ? "-"
                                : `${submission.score}/100`}
                            </td>
                            <td>{submission.feedback ?? "Not reviewed"}</td>
                          </tr>
                        ))}
                        {!routeAssignmentSubmissions.length ? (
                          <tr>
                            <td colSpan={5}>
                              <div className="platform-empty-state">
                                <strong>No submissions yet</strong>
                                <span>
                                  Student submissions for this assignment will
                                  appear here.
                                </span>
                              </div>
                            </td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>
                </DataTableCard>
              </>
            ) : (
              <section className="platform-workflow-card">
                <div className="platform-empty-state">
                  <strong>Assignment is not available</strong>
                  <span>
                    This assignment is outside your assigned classes or no
                    longer exists.
                  </span>
                  <Link
                    className="platform-secondary-button"
                    href="/app/teacher/assignments"
                  >
                    Back to assignments
                  </Link>
                </div>
              </section>
            )
          }
        />
      </PlatformShell>
    );
  }

  if (view === "grading") {
    return (
      <PlatformShell role="teacher" title="Grading">
        <WorkspaceLayout
          className="portal-ia-page teacher-work-page"
          context={<span>Teacher</span>}
          title="Grading"
          description="Review submitted work."
          toolbar={workTabs}
          main={
            <>
              {actionError ? (
                <p className="platform-form-error">{actionError}</p>
              ) : null}
              <div className="teacher-work-review-grid">
                <section className="platform-workflow-card">
                  <div className="platform-workflow-title">
                    <span>
                      <ClipboardCheck size={16} /> Manual review
                    </span>
                    <strong>{reviewSubmissions.length} pending</strong>
                  </div>
                  <div className="platform-row-list compact">
                    {reviewSubmissions.length ? (
                      reviewSubmissions.map(submission => (
                        <article
                          key={submission.id}
                          className={
                            selectedSubmission?.id === submission.id
                              ? "selected"
                              : ""
                          }
                        >
                          <div>
                            <strong>
                              {assignmentTitle(submission.assignmentId)}
                            </strong>
                            <small>
                              {studentName(submission.studentId)} ·{" "}
                              {truncate(submission.response, 86)}
                            </small>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              setSelectedSubmissionId(submission.id)
                            }
                          >
                            Open
                          </button>
                        </article>
                      ))
                    ) : (
                      <article>
                        <div>
                          <strong>No assignments need review</strong>
                          <small>Submitted assignments will appear here.</small>
                        </div>
                      </article>
                    )}
                  </div>
                  <div className="teacher-review-editor">
                    <label>
                      Score
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={assignmentScore}
                        onChange={event =>
                          setAssignmentScore(Number(event.target.value))
                        }
                      />
                    </label>
                    <label>
                      Feedback
                      <input
                        value={assignmentFeedback}
                        onChange={event =>
                          setAssignmentFeedback(event.target.value)
                        }
                      />
                    </label>
                    <button
                      type="button"
                      className="platform-primary-button"
                      disabled={
                        !selectedSubmission ||
                        savingAction === "Submission graded"
                      }
                      onClick={gradeSubmission}
                    >
                      <CheckCircle2 size={15} />
                      {savingAction === "Submission graded"
                        ? "Saving"
                        : "Grade submission"}
                    </button>
                  </div>
                </section>

                <section className="platform-workflow-card">
                  <div className="platform-workflow-title">
                    <span>
                      <BookOpen size={16} /> Quiz review
                    </span>
                    <strong>{reviewAttempts.length} pending</strong>
                  </div>
                  <div className="platform-row-list compact">
                    {reviewAttempts.length ? (
                      reviewAttempts.map(attempt => (
                        <article
                          key={attempt.id}
                          className={
                            selectedAttempt?.id === attempt.id ? "selected" : ""
                          }
                        >
                          <div>
                            <strong>{quizTitle(attempt.quizId)}</strong>
                            <small>
                              {studentName(attempt.studentId)} ·{" "}
                              {formatDate(
                                attempt.submittedAt ?? attempt.startedAt
                              )}
                            </small>
                          </div>
                          <button
                            type="button"
                            onClick={() => setSelectedAttemptId(attempt.id)}
                          >
                            Open
                          </button>
                        </article>
                      ))
                    ) : (
                      <article>
                        <div>
                          <strong>No quiz attempts need review</strong>
                          <small>Pending attempts will appear here.</small>
                        </div>
                      </article>
                    )}
                  </div>
                  <div className="teacher-review-editor">
                    <label>
                      Score
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={quizScore}
                        onChange={event =>
                          setQuizScore(Number(event.target.value))
                        }
                      />
                    </label>
                    <label>
                      Feedback
                      <input
                        value={quizFeedback}
                        onChange={event => setQuizFeedback(event.target.value)}
                      />
                    </label>
                    <button
                      type="button"
                      className="platform-primary-button"
                      disabled={
                        !selectedAttempt || savingAction === "Quiz reviewed"
                      }
                      onClick={reviewQuizAttempt}
                    >
                      <CheckCircle2 size={15} />
                      {savingAction === "Quiz reviewed"
                        ? "Saving"
                        : "Save quiz review"}
                    </button>
                  </div>
                </section>
              </div>
            </>
          }
        />
      </PlatformShell>
    );
  }

  if (view === "calendar") {
    return (
      <PlatformShell role="teacher" title="Calendar">
        <WorkspaceLayout
          className="portal-ia-page teacher-work-page"
          context={<span>Teacher</span>}
          title="Calendar"
          description="Schedule class events."
          toolbar={workTabs}
          main={
            <>
              {actionError ? (
                <p className="platform-form-error">{actionError}</p>
              ) : null}
              <section className="platform-workflow-card teacher-calendar-create-card">
                <div className="platform-workflow-title">
                  <span>
                    <CalendarDays size={16} /> Create event
                  </span>
                  <strong>{selectedBranch?.name ?? "Assigned classes"}</strong>
                </div>
                <div className="teacher-calendar-form teacher-calendar-form-grid">
                  <label>
                    Title
                    <input
                      name="title"
                      value={calendarDraft.title}
                      onChange={event =>
                        setCalendarDraft(current => ({
                          ...current,
                          title: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label>
                    Type
                    <select
                      name="eventType"
                      value={calendarDraft.eventType}
                      onChange={event =>
                        setCalendarDraft(current => ({
                          ...current,
                          eventType: event.target.value as CalendarEventType,
                        }))
                      }
                    >
                      {calendarTypeOptions.map(option => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Branch
                    <select
                      name="branchId"
                      value={calendarDraft.branchId}
                      onChange={event =>
                        setCalendarDraft(current => ({
                          ...current,
                          branchId: event.target.value,
                        }))
                      }
                    >
                      {branchOptions.map(branch => (
                        <option key={branch.id} value={branch.id}>
                          {branch.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Class
                    <select
                      name="classGroupId"
                      value={calendarDraft.classGroupId}
                      onChange={event =>
                        setCalendarDraft(current => ({
                          ...current,
                          classGroupId: event.target.value,
                        }))
                      }
                    >
                      {classOptions.map(group => (
                        <option key={group.id} value={group.id}>
                          {group.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Room
                    <select
                      name="roomId"
                      value={calendarDraft.roomId}
                      onChange={event =>
                        setCalendarDraft(current => ({
                          ...current,
                          roomId: event.target.value,
                        }))
                      }
                    >
                      {roomOptions.map(room => (
                        <option key={room.id} value={room.id}>
                          {room.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Date
                    <input
                      name="date"
                      type="date"
                      value={calendarDraft.date}
                      onChange={event =>
                        setCalendarDraft(current => ({
                          ...current,
                          date: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label>
                    Starts
                    <input
                      name="starts"
                      type="time"
                      value={calendarDraft.starts}
                      onChange={event =>
                        setCalendarDraft(current => ({
                          ...current,
                          starts: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label>
                    Ends
                    <input
                      name="ends"
                      type="time"
                      value={calendarDraft.ends}
                      onChange={event =>
                        setCalendarDraft(current => ({
                          ...current,
                          ends: event.target.value,
                        }))
                      }
                    />
                  </label>
                </div>
                <div className="platform-calendar-actions">
                  <button
                    type="button"
                    className="platform-primary-button"
                    disabled={
                      savingAction === "Event scheduled" ||
                      !calendarDraft.title.trim() ||
                      !calendarDraft.date ||
                      calendarDraft.starts >= calendarDraft.ends
                    }
                    onClick={createCalendarEvent}
                  >
                    <CalendarDays size={15} />
                    {savingAction === "Event scheduled"
                      ? "Saving event"
                      : "Create event"}
                  </button>
                </div>
              </section>
              <DataTableCard
                title="Scheduled events"
                subtitle={`${visibleEvents.length} visible`}
              >
                <div className="admin-ia-table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Event</th>
                        <th>When</th>
                        <th>Class</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleEvents.map(event => (
                        <tr key={event.id}>
                          <td>
                            <strong>{event.title}</strong>
                            <small>{event.type.replace(/_/g, " ")}</small>
                          </td>
                          <td>{formatDateTime(event.startsAt)}</td>
                          <td>
                            {teacherClassGroups.find(
                              group => group.id === event.classGroupId
                            )?.name ?? "General"}
                          </td>
                          <td>
                            <StatusBadge tone={statusTone(event.status)}>
                              {event.status}
                            </StatusBadge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </DataTableCard>
            </>
          }
        />
      </PlatformShell>
    );
  }

  return (
    <PlatformShell role="teacher" title="Quran review">
      <WorkspaceLayout
        className="portal-ia-page teacher-work-page"
        context={<span>Teacher</span>}
        title="Quran review"
        description="Review recitations and update progress."
        toolbar={workTabs}
        main={
          <>
            {actionError ? (
              <p className="platform-form-error">{actionError}</p>
            ) : null}
            <section className="platform-workflow-card">
              <div className="platform-workflow-title">
                <span>
                  <Headphones size={16} /> Quran review
                </span>
                <strong>{recitations.length} recitations</strong>
              </div>
              <div className="platform-row-list compact">
                {recitations.length ? (
                  recitations.map(recitation => (
                    <article
                      key={recitation.id}
                      className={
                        selectedRecitation?.id === recitation.id
                          ? "selected"
                          : ""
                      }
                    >
                      <div>
                        <strong>{recitation.title}</strong>
                        <small>
                          {studentName(recitation.studentId)} ·{" "}
                          {formatDateTime(recitation.submittedAt)}
                        </small>
                      </div>
                      <div className="platform-row-actions">
                        <StatusBadge tone={statusTone(recitation.status)}>
                          {recitation.status}
                        </StatusBadge>
                        <button
                          type="button"
                          onClick={() => setSelectedRecitationId(recitation.id)}
                        >
                          Open
                        </button>
                      </div>
                    </article>
                  ))
                ) : (
                  <article>
                    <div>
                      <strong>No recitations in scope</strong>
                      <small>Student recitations will appear here.</small>
                    </div>
                  </article>
                )}
              </div>
            </section>

            <section className="platform-workflow-card">
              <div className="platform-workflow-title">
                <span>
                  <BookOpen size={16} /> Memorization and tajweed
                </span>
                <strong>
                  {selectedStudent?.currentLevel ?? "Progress review"}
                </strong>
              </div>
              <div className="teacher-quran-summary">
                <span>Plan: {selectedQuranPlan?.target ?? "No plan"}</span>
                <span>Current juz: {selectedQuranPlan?.currentJuz ?? "-"}</span>
                <span>{studentName(selectedRecitation?.studentId)}</span>
              </div>
              <div className="teacher-calendar-form-grid compact">
                <label>
                  Memorized %
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={memorizedPercent}
                    onChange={event =>
                      setMemorizedPercent(Number(event.target.value))
                    }
                  />
                </label>
                <label>
                  Tajweed score
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={tajweedScore}
                    onChange={event =>
                      setTajweedScore(Number(event.target.value))
                    }
                  />
                </label>
              </div>
              <textarea
                value={recitationFeedback}
                onChange={event => setRecitationFeedback(event.target.value)}
              />
              <div className="platform-action-grid">
                <button
                  type="button"
                  disabled={
                    !selectedProgress || savingAction === "Progress updated"
                  }
                  onClick={updateQuranProgress}
                >
                  {savingAction === "Progress updated"
                    ? "Updating"
                    : "Update progress"}
                </button>
                <button
                  type="button"
                  className="platform-primary-button"
                  disabled={
                    !selectedRecitation ||
                    selectedRecitation.status === "approved" ||
                    savingAction === "Recitation reviewed" ||
                    !recitationFeedback.trim()
                  }
                  onClick={reviewRecitation}
                >
                  {savingAction === "Recitation reviewed"
                    ? "Saving"
                    : selectedRecitation?.status === "approved"
                      ? "Reviewed"
                      : "Review recitation"}
                </button>
              </div>
            </section>
          </>
        }
      />
    </PlatformShell>
  );
}
