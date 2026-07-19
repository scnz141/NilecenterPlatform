import { useEffect, useState } from "react";
import {
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Headphones,
  Plus,
  Search,
  XCircle,
} from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";
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
import { runPlatformWorkflowActionRequest } from "@/lib/backend/api";
import { getActiveUser } from "@/lib/auth/session";
import { platformStore } from "@/lib/domain/store";
import type {
  AssignmentSubmission,
  CalendarEvent,
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
  | "grading-detail"
  | "calendar"
  | "calendar-new"
  | "quran"
  | "quran-detail";

type TeacherWorkPageProps = {
  view: TeacherWorkView;
  assignmentId?: string;
  submissionId?: string;
  recitationId?: string;
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

function assignmentStatusLabel(status: EntityStatus) {
  if (status === "draft") return "Draft";
  if (status === "active") return "Published";
  if (status === "completed") return "Closed";
  if (status === "cancelled") return "Cancelled";
  return status;
}

function dateInputValue(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

function truncate(value: string, maxLength = 70) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 3).trimEnd()}...`;
}

function startOfDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function isSameDay(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function monthLabel(value: Date) {
  return new Intl.DateTimeFormat("en", {
    month: "long",
    year: "numeric",
  }).format(value);
}

function weekdayLabels() {
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
}

function buildMonthCells(month: Date) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const startOffset = first.getDay();
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells: Array<{ date: Date; inMonth: boolean }> = [];

  for (let index = 0; index < startOffset; index += 1) {
    cells.push({
      date: new Date(
        month.getFullYear(),
        month.getMonth(),
        1 - startOffset + index
      ),
      inMonth: false,
    });
  }

  for (let day = 1; day <= days; day += 1) {
    cells.push({
      date: new Date(month.getFullYear(), month.getMonth(), day),
      inMonth: true,
    });
  }

  while (cells.length % 7 !== 0) {
    const last = cells[cells.length - 1]?.date ?? first;
    cells.push({
      date: new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1),
      inMonth: false,
    });
  }

  return cells;
}

function eventsOnDay(events: CalendarEvent[], day: Date) {
  return events.filter(event => {
    const starts = new Date(event.startsAt);
    return !Number.isNaN(starts.getTime()) && isSameDay(starts, day);
  });
}

export default function TeacherWorkPage({
  view,
  assignmentId,
  submissionId,
  recitationId,
}: TeacherWorkPageProps) {
  const [state, setState] = useState(() => platformStore.getState());
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | EntityStatus>("all");
  const [savingAction, setSavingAction] = useState("");
  const [actionError, setActionError] = useState("");
  const [selectedAttemptId, setSelectedAttemptId] = useState("");
  const [assignmentScore, setAssignmentScore] = useState(88);
  const [assignmentFeedback, setAssignmentFeedback] = useState(
    "Good work. Strengthen examples in the next submission."
  );
  const [gradeSaved, setGradeSaved] = useState(false);
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
  const [assignmentEdit, setAssignmentEdit] = useState({
    title: "",
    dueAt: "",
    submissionType: "text" as "text" | "file" | "audio" | "video",
    rubric: "",
  });
  const [cancelReason, setCancelReason] = useState("");
  const [showAssignmentCancel, setShowAssignmentCancel] = useState(false);
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
  const [calendarResult, setCalendarResult] = useState("");
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedCalendarDay, setSelectedCalendarDay] = useState(() =>
    startOfDay(new Date())
  );
  const [memorizedPercent, setMemorizedPercent] = useState(0);
  const [tajweedScore, setTajweedScore] = useState(0);
  const [recitationFeedback, setRecitationFeedback] = useState(
    "Clear recitation. Continue revision before the next lesson."
  );
  const [quranReviewSaved, setQuranReviewSaved] = useState(false);

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
    toast.success(label);
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

  const studentClassLabel = (runId?: string, studentId?: string) => {
    const enrollment = state.enrollments.find(
      item =>
        item.courseRunId === runId &&
        item.studentId === studentId &&
        item.status === "active"
    );
    const group = teacherClassGroups.find(
      item => item.id === enrollment?.classGroupId
    );
    return group?.name ?? classLabel(runId);
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
  const routeAssignmentActiveLearnerIds = new Set(
    state.enrollments
      .filter(
        enrollment =>
          enrollment.courseRunId === routeAssignment?.courseRunId &&
          enrollment.status === "active"
      )
      .map(enrollment => enrollment.studentId)
      .filter(studentId => {
        const student = state.students.find(item => item.id === studentId);
        const user = state.users.find(item => item.id === student?.userId);
        return student?.status === "active" && user?.status === "active";
      })
  );
  const routeAssignmentCompletedLearnerIds = new Set(
    routeAssignmentSubmissions
      .filter(submission => submission.status === "completed")
      .map(submission => submission.studentId)
  );
  const routeAssignmentCanClose = Boolean(
    routeAssignment &&
      (new Date(routeAssignment.dueAt).getTime() <= Date.now() ||
        (routeAssignmentActiveLearnerIds.size > 0 &&
          Array.from(routeAssignmentActiveLearnerIds).every(studentId =>
            routeAssignmentCompletedLearnerIds.has(studentId)
          )))
  );
  const routeAssignmentCanCancel = Boolean(
    routeAssignment &&
      (routeAssignment.status === "draft" ||
        routeAssignment.status === "active") &&
      routeAssignmentSubmissions.length === 0
  );
  const routeAssignmentHasUnsavedDraftChanges = Boolean(
    routeAssignment &&
      routeAssignment.status === "draft" &&
      (assignmentEdit.title !== routeAssignment.title ||
        assignmentEdit.dueAt !== dateInputValue(routeAssignment.dueAt) ||
        assignmentEdit.submissionType !== routeAssignment.submissionType ||
        assignmentEdit.rubric !== routeAssignment.rubric.join(", "))
  );

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
  const routeGradingSubmission = submissionId
    ? assignmentSubmissions.find(submission => submission.id === submissionId)
    : undefined;
  const routeGradingAssignment = state.assignments.find(
    assignment => assignment.id === routeGradingSubmission?.assignmentId
  );

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
  const routeRecitation = recitationId
    ? recitations.find(recitation => recitation.id === recitationId)
    : undefined;
  const activeRecitation =
    view === "quran-detail" ? routeRecitation : selectedRecitation;
  const recitationKey = recitations.map(item => item.id).join("|");
  const selectedStudent = state.students.find(
    item => item.id === activeRecitation?.studentId
  );
  const selectedQuranPlan = state.quranPlans.find(
    item => item.studentId === activeRecitation?.studentId
  );
  const selectedProgress =
    state.quranProgress.find(
      item => item.studentId === activeRecitation?.studentId
    ) ?? state.quranProgress[0];

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
    if (!routeAssignment) return;
    setAssignmentEdit({
      title: routeAssignment.title,
      dueAt: dateInputValue(routeAssignment.dueAt),
      submissionType: routeAssignment.submissionType,
      rubric: routeAssignment.rubric.join(", "),
    });
    setCancelReason("");
    setShowAssignmentCancel(false);
  }, [routeAssignment?.id]);

  useEffect(() => {
    setMemorizedPercent(selectedProgress?.memorizedPercent ?? 0);
    setTajweedScore(selectedProgress?.tajweedScore ?? 0);
    setRecitationFeedback(
      activeRecitation?.feedback ??
        selectedProgress?.notes ??
        "Clear recitation. Continue revision before the next lesson."
    );
  }, [selectedProgress?.id, activeRecitation?.id]);

  const createAssignment = async () => {
    if (!assignmentDraft.courseRunId || !assignmentDraft.title.trim()) return;
    await runAction("Draft saved", {
      type: "assignment.create",
      courseRunId: assignmentDraft.courseRunId,
      title: assignmentDraft.title.trim(),
      dueAt: new Date(assignmentDraft.dueAt).toISOString(),
      submissionType: assignmentDraft.submissionType,
      rubric: splitList(assignmentDraft.rubric),
    });
  };

  const updateAssignment = async () => {
    if (
      !routeAssignment ||
      !assignmentEdit.title.trim() ||
      !assignmentEdit.dueAt
    ) {
      return;
    }
    await runAction("Draft saved", {
      type: "assignment.update",
      assignmentId: routeAssignment.id,
      title: assignmentEdit.title.trim(),
      dueAt: new Date(assignmentEdit.dueAt).toISOString(),
      submissionType: assignmentEdit.submissionType,
      rubric: splitList(assignmentEdit.rubric),
    });
  };

  const publishAssignment = async () => {
    if (!routeAssignment) return;
    await runAction("Assignment published", {
      type: "assignment.status.update",
      assignmentId: routeAssignment.id,
      status: "active",
    });
  };

  const closeAssignment = async () => {
    if (!routeAssignment) return;
    await runAction("Assignment closed", {
      type: "assignment.status.update",
      assignmentId: routeAssignment.id,
      status: "completed",
    });
  };

  const cancelAssignment = async () => {
    if (!routeAssignment || cancelReason.trim().length < 5) return;
    const cancelled = await runAction("Assignment cancelled", {
      type: "assignment.status.update",
      assignmentId: routeAssignment.id,
      status: "cancelled",
      reason: cancelReason.trim(),
    });
    if (cancelled) {
      setCancelReason("");
      setShowAssignmentCancel(false);
    }
  };

  const gradeSubmission = async (submission?: AssignmentSubmission) => {
    if (!submission) return false;
    const graded = await runAction("Submission graded", {
      type: "assignment.grade",
      submissionId: submission.id,
      score: Math.min(100, Math.max(0, Number(assignmentScore) || 0)),
      feedback: assignmentFeedback.trim() || "Reviewed by teacher.",
    });
    if (graded) setGradeSaved(true);
    return graded;
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
    const created = await runAction("Event scheduled", {
      type: "calendar.create",
      eventType: submitDraft.eventType,
      title: submitDraft.title.trim(),
      startsAt: `${submitDraft.date}T${submitDraft.starts}:00+03:00`,
      endsAt: `${submitDraft.date}T${submitDraft.ends}:00+03:00`,
      branchId: submitBranchId,
      roomId: usesRoom ? submitRoom?.id : undefined,
      classGroupId: usesClass ? submitClass?.id : undefined,
    });
    if (created) {
      setCalendarResult("Your event is now on the teaching calendar.");
    }
  };

  const updateQuranProgress = async () => {
    if (!selectedProgress) return false;
    return runAction("Progress updated", {
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
    if (!activeRecitation || !recitationFeedback.trim()) return false;
    const reviewed = await runAction("Recitation reviewed", {
      type: "recitation.review",
      submissionId: activeRecitation.id,
      feedback: recitationFeedback.trim(),
    });
    if (reviewed) setQuranReviewSaved(true);
    return reviewed;
  };

  if (view === "new-assignment") {
    return (
      <PlatformShell role="teacher" title="Create assignment">
        <FormFlowLayout
          className="portal-ia-page teacher-work-page teacher-assignment-create-page"
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
          main={
            <section
              className="portal-ia-form-card"
              data-testid="teacher-assignment-create-form"
            >
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
                    savingAction === "Draft saved" ||
                    !assignmentDraft.courseRunId ||
                    !assignmentDraft.title.trim()
                  }
                  onClick={createAssignment}
                >
                  <Plus size={15} />
                  {savingAction === "Draft saved" ? "Saving" : "Save draft"}
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
          className="portal-ia-page teacher-work-page teacher-assignments-page"
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
                  <option value="draft">Draft</option>
                  <option value="active">Published</option>
                  <option value="completed">Closed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </label>
            </div>
          }
          main={
            <DataTableCard
              title="Assignments"
              subtitle={`${filteredAssignments.length} items`}
              className="teacher-work-record-card"
            >
              {filteredAssignments.length ? (
                <div className="teacher-work-record-list">
                  {filteredAssignments.map(assignment => (
                    <article key={assignment.id}>
                      <div className="teacher-work-record-copy">
                        <span>{classLabel(assignment.courseRunId)}</span>
                        <strong>{assignment.title}</strong>
                        <p>{assignment.rubric.slice(0, 2).join(" · ")}</p>
                      </div>
                      <dl className="teacher-work-record-facts">
                        <div>
                          <dt>Due</dt>
                          <dd>{formatDate(assignment.dueAt)}</dd>
                        </div>
                        <div>
                          <dt>Submission</dt>
                          <dd>{assignment.submissionType}</dd>
                        </div>
                      </dl>
                      <div className="teacher-work-record-actions">
                        <StatusBadge tone={statusTone(assignment.status)}>
                          {assignmentStatusLabel(assignment.status)}
                        </StatusBadge>
                        <Link
                          className="platform-row-link"
                          href={`/app/teacher/assignments/${assignment.id}`}
                        >
                          Open
                        </Link>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="platform-empty-state">
                  <strong>No assignments found</strong>
                  <span>Try another search or create an assignment.</span>
                </div>
              )}
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
          className="portal-ia-page teacher-work-page teacher-assignment-detail-page"
          context={<span>Teacher</span>}
          title={routeAssignment?.title ?? "Assignment detail"}
          description={
            routeAssignment?.status === "draft"
              ? "Finish the draft, then publish it for the assigned class."
              : "Review one assignment and its submitted work."
          }
          actions={
            <Link
              className="platform-secondary-button"
              href="/app/teacher/assignments"
            >
              Back to assignments
            </Link>
          }
          main={
            routeAssignment ? (
              <>
                {actionError ? (
                  <p className="platform-form-error" role="alert">
                    {actionError}
                  </p>
                ) : null}
                <section className="platform-workflow-card teacher-assignment-brief">
                  <div className="platform-workflow-title">
                    <span>
                      <BookOpen size={16} /> Assignment
                    </span>
                    <StatusBadge tone={statusTone(routeAssignment.status)}>
                      {assignmentStatusLabel(routeAssignment.status)}
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

                  {routeAssignment.status === "draft" ? (
                    <section
                      className="teacher-assignment-lifecycle"
                      data-testid="teacher-assignment-draft-controls"
                    >
                      <div className="teacher-assignment-lifecycle-head">
                        <div>
                          <span>Draft details</span>
                          <h2>Prepare this assignment</h2>
                          <p>Learners will not see it until you publish it.</p>
                        </div>
                        <StatusBadge tone="amber">Draft</StatusBadge>
                      </div>
                      <div className="portal-ia-form-grid teacher-assignment-lifecycle-form">
                        <label>
                          Title
                          <input
                            value={assignmentEdit.title}
                            onChange={event =>
                              setAssignmentEdit(current => ({
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
                            min={routeAssignmentRun?.startsOn}
                            max={routeAssignmentRun?.endsOn}
                            value={assignmentEdit.dueAt}
                            onChange={event =>
                              setAssignmentEdit(current => ({
                                ...current,
                                dueAt: event.target.value,
                              }))
                            }
                          />
                        </label>
                        <label>
                          Submission type
                          <select
                            value={assignmentEdit.submissionType}
                            onChange={event =>
                              setAssignmentEdit(current => ({
                                ...current,
                                submissionType: event.target.value as
                                  | "text"
                                  | "file"
                                  | "audio"
                                  | "video",
                              }))
                            }
                          >
                            <option value="text">Written response</option>
                            <option value="file">File</option>
                            <option value="audio">Audio</option>
                            <option value="video">Video</option>
                          </select>
                        </label>
                        <label>
                          Rubric
                          <input
                            value={assignmentEdit.rubric}
                            onChange={event =>
                              setAssignmentEdit(current => ({
                                ...current,
                                rubric: event.target.value,
                              }))
                            }
                          />
                        </label>
                      </div>
                      <div className="teacher-assignment-lifecycle-actions">
                        <button
                          type="button"
                          className="platform-secondary-button"
                          disabled={
                            savingAction === "Draft saved" ||
                            !assignmentEdit.title.trim() ||
                            !assignmentEdit.dueAt
                          }
                          onClick={updateAssignment}
                        >
                          {savingAction === "Draft saved"
                            ? "Saving"
                            : "Save draft"}
                        </button>
                        <button
                          type="button"
                          className="platform-primary-button"
                          data-testid="teacher-assignment-publish"
                          disabled={
                            savingAction === "Assignment published" ||
                            routeAssignmentHasUnsavedDraftChanges
                          }
                          onClick={publishAssignment}
                        >
                          <CheckCircle2 size={15} />
                          {savingAction === "Assignment published"
                            ? "Publishing"
                            : "Publish assignment"}
                        </button>
                        {routeAssignmentCanCancel ? (
                          <button
                            type="button"
                            className="platform-secondary-button"
                            onClick={() => setShowAssignmentCancel(true)}
                          >
                            <XCircle size={15} />
                            Cancel assignment
                          </button>
                        ) : null}
                      </div>
                      {routeAssignmentHasUnsavedDraftChanges ? (
                        <p className="teacher-assignment-lifecycle-note">
                          Save your changes before publishing this assignment.
                        </p>
                      ) : null}
                    </section>
                  ) : routeAssignment.status === "active" ? (
                    <section
                      className="teacher-assignment-lifecycle"
                      data-testid="teacher-assignment-published-controls"
                    >
                      <div className="teacher-assignment-lifecycle-head">
                        <div>
                          <span>Published</span>
                          <h2>Available to learners</h2>
                          <p>
                            Close it after the due date or when every active
                            learner has a graded submission.
                          </p>
                        </div>
                        <StatusBadge tone="green">Published</StatusBadge>
                      </div>
                      <div className="teacher-assignment-lifecycle-actions">
                        <button
                          type="button"
                          className="platform-primary-button"
                          data-testid="teacher-assignment-close"
                          disabled={
                            !routeAssignmentCanClose ||
                            savingAction === "Assignment closed"
                          }
                          onClick={closeAssignment}
                        >
                          <CheckCircle2 size={15} />
                          {savingAction === "Assignment closed"
                            ? "Closing"
                            : "Close assignment"}
                        </button>
                        {routeAssignmentCanCancel ? (
                          <button
                            type="button"
                            className="platform-secondary-button"
                            onClick={() => setShowAssignmentCancel(true)}
                          >
                            <XCircle size={15} />
                            Cancel assignment
                          </button>
                        ) : null}
                      </div>
                      {!routeAssignmentCanClose ? (
                        <p className="teacher-assignment-lifecycle-note">
                          Closing becomes available after the due date or when
                          every active learner has a graded submission.
                        </p>
                      ) : null}
                    </section>
                  ) : (
                    <section
                      className="teacher-assignment-lifecycle teacher-assignment-lifecycle-terminal"
                      data-testid="teacher-assignment-terminal-state"
                    >
                      <div className="teacher-assignment-lifecycle-head">
                        <div>
                          <span>
                            {assignmentStatusLabel(routeAssignment.status)}
                          </span>
                          <h2>
                            {routeAssignment.status === "completed"
                              ? "Assignment closed"
                              : "Assignment cancelled"}
                          </h2>
                          <p>
                            {routeAssignment.status === "completed"
                              ? "Submitted work and grades remain available as a record."
                              : "This assignment is no longer available to learners."}
                          </p>
                        </div>
                        <StatusBadge tone={statusTone(routeAssignment.status)}>
                          {assignmentStatusLabel(routeAssignment.status)}
                        </StatusBadge>
                      </div>
                    </section>
                  )}

                  {showAssignmentCancel && routeAssignmentCanCancel ? (
                    <section
                      className="teacher-assignment-cancel-form"
                      data-testid="teacher-assignment-cancel-form"
                    >
                      <label>
                        Cancellation reason
                        <textarea
                          value={cancelReason}
                          onChange={event =>
                            setCancelReason(event.target.value)
                          }
                          placeholder="Tell learners why this assignment is cancelled."
                        />
                      </label>
                      <div className="teacher-assignment-lifecycle-actions">
                        <button
                          type="button"
                          className="platform-danger-button"
                          data-testid="teacher-assignment-cancel"
                          disabled={
                            cancelReason.trim().length < 5 ||
                            savingAction === "Assignment cancelled"
                          }
                          onClick={cancelAssignment}
                        >
                          <XCircle size={15} />
                          {savingAction === "Assignment cancelled"
                            ? "Cancelling"
                            : "Cancel assignment"}
                        </button>
                        <button
                          type="button"
                          className="platform-secondary-button"
                          onClick={() => {
                            setCancelReason("");
                            setShowAssignmentCancel(false);
                          }}
                        >
                          Keep assignment
                        </button>
                      </div>
                    </section>
                  ) : null}
                </section>

                <DataTableCard
                  title="Submitted work"
                  subtitle={`${routeAssignmentSubmissions.length} submission(s)`}
                  className="teacher-work-record-card"
                >
                  {routeAssignmentSubmissions.length ? (
                    <div className="teacher-work-record-list">
                      {routeAssignmentSubmissions.map(submission => (
                        <article key={submission.id}>
                          <div className="teacher-work-record-copy">
                            <span>{studentName(submission.studentId)}</span>
                            <strong>
                              {truncate(
                                submission.response || "No response",
                                76
                              )}
                            </strong>
                            <p>{submission.feedback ?? "Awaiting review"}</p>
                          </div>
                          <dl className="teacher-work-record-facts">
                            <div>
                              <dt>Submitted</dt>
                              <dd>{formatDateTime(submission.submittedAt)}</dd>
                            </div>
                            <div>
                              <dt>Score</dt>
                              <dd>
                                {submission.score === undefined
                                  ? "Not graded"
                                  : `${submission.score}/100`}
                              </dd>
                            </div>
                          </dl>
                          <div className="teacher-work-record-actions">
                            <StatusBadge tone={statusTone(submission.status)}>
                              {submission.status}
                            </StatusBadge>
                          </div>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <div className="platform-empty-state">
                      <strong>No submissions yet</strong>
                      <span>
                        Student submissions for this assignment will appear
                        here.
                      </span>
                    </div>
                  )}
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

  if (view === "grading-detail") {
    const submission = routeGradingSubmission;
    const assignment = routeGradingAssignment;

    return (
      <PlatformShell role="teacher" title="Review submission">
        <DetailLayout
          className="portal-ia-page teacher-work-page teacher-grading-detail-page"
          context={<span>Teacher</span>}
          title="Review submission"
          description="Review one learner response and record a clear outcome."
          actions={
            <Link
              className="platform-secondary-button"
              href="/app/teacher/grading"
            >
              Back to grading
            </Link>
          }
          main={
            submission && assignment ? (
              gradeSaved ? (
                <section
                  className="teacher-action-success"
                  data-testid="teacher-grade-success"
                >
                  <CheckCircle2 aria-hidden="true" size={20} />
                  <div>
                    <strong>Submission graded</strong>
                    <span>The learner feedback has been saved.</span>
                  </div>
                  <Link
                    className="platform-primary-button"
                    href="/app/teacher/grading"
                  >
                    Return to grading
                  </Link>
                </section>
              ) : (
                <section
                  className="teacher-submission-review"
                  data-testid="teacher-submission-review"
                >
                  <header className="teacher-submission-review-head">
                    <div>
                      <span>Submission</span>
                      <h2>{assignment.title}</h2>
                      <p>
                        {studentName(submission.studentId)} ·{" "}
                        {studentClassLabel(
                          assignment.courseRunId,
                          submission.studentId
                        )}
                      </p>
                    </div>
                    <StatusBadge tone={statusTone(submission.status)}>
                      {submission.status}
                    </StatusBadge>
                  </header>
                  <section className="teacher-submission-response">
                    <span>Learner response</span>
                    <p>
                      {submission.response || "No written response provided."}
                    </p>
                  </section>
                  {submission.status === "pending" ? (
                    <form
                      className="teacher-submission-grade-form"
                      data-testid="teacher-grade-editor"
                      onSubmit={event => {
                        event.preventDefault();
                        void gradeSubmission(submission);
                      }}
                    >
                      <div className="teacher-submission-grade-heading">
                        <div>
                          <span>Result</span>
                          <strong>Record the learner outcome</strong>
                        </div>
                        <StatusBadge tone={statusTone(submission.status)}>
                          {submission.status}
                        </StatusBadge>
                      </div>
                      <label>
                        Score
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={assignmentScore}
                          onChange={event => {
                            setGradeSaved(false);
                            setAssignmentScore(Number(event.target.value));
                          }}
                        />
                      </label>
                      <label>
                        Feedback
                        <input
                          value={assignmentFeedback}
                          onChange={event => {
                            setGradeSaved(false);
                            setAssignmentFeedback(event.target.value);
                          }}
                          placeholder="Brief feedback for the learner"
                        />
                      </label>
                      <button
                        type="submit"
                        className="platform-primary-button"
                        disabled={savingAction === "Submission graded"}
                      >
                        <CheckCircle2 size={15} />
                        {savingAction === "Submission graded"
                          ? "Saving result"
                          : "Save result"}
                      </button>
                    </form>
                  ) : (
                    <section className="teacher-submission-result">
                      <div>
                        <span>Recorded result</span>
                        <strong>
                          {submission.score === undefined
                            ? "Reviewed"
                            : `${submission.score}/100`}
                        </strong>
                        <p>{submission.feedback ?? "No feedback recorded."}</p>
                      </div>
                      <StatusBadge tone={statusTone(submission.status)}>
                        {submission.status}
                      </StatusBadge>
                    </section>
                  )}
                </section>
              )
            ) : (
              <section className="platform-empty-state">
                <strong>This submission is not available.</strong>
                <span>
                  Return to grading and choose an item from your queue.
                </span>
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
          className="portal-ia-page teacher-work-page teacher-grading-page"
          context={<span>Teacher</span>}
          title="Grading"
          description="Review assignment submissions from your classes."
          actions={
            <Link
              className="platform-secondary-button"
              href="/app/teacher/quizzes/review"
            >
              Review quizzes
            </Link>
          }
          main={
            <>
              {actionError ? (
                <p className="platform-form-error">{actionError}</p>
              ) : null}
              <DataTableCard
                title="Submission queue"
                subtitle={`${reviewSubmissions.length} waiting for review`}
              >
                <div
                  className="platform-row-list teacher-grading-list"
                  data-testid="teacher-grading-list"
                >
                  {reviewSubmissions.length ? (
                    reviewSubmissions.map(submission => (
                      <Link
                        key={submission.id}
                        className="teacher-grading-row-link"
                        href={`/app/teacher/grading/${submission.id}`}
                      >
                        <div>
                          <strong>
                            {assignmentTitle(submission.assignmentId)}
                          </strong>
                          <small>
                            {studentName(submission.studentId)} ·{" "}
                            {studentClassLabel(
                              state.assignments.find(
                                item => item.id === submission.assignmentId
                              )?.courseRunId,
                              submission.studentId
                            )}
                          </small>
                        </div>
                        <StatusBadge tone={statusTone(submission.status)}>
                          {submission.status}
                        </StatusBadge>
                      </Link>
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
              </DataTableCard>
            </>
          }
        />
      </PlatformShell>
    );
  }

  if (view === "calendar-new") {
    return (
      <PlatformShell role="teacher" title="New calendar event">
        <FormFlowLayout
          className="teacher-work-page teacher-calendar-create-page"
          context={<span>Teacher</span>}
          title="New calendar event"
          description="Schedule one class event for your assigned teaching work."
          actions={
            calendarResult ? (
              <Link
                className="platform-primary-button"
                href="/app/teacher/calendar"
              >
                View calendar
              </Link>
            ) : (
              <>
                <Link
                  className="platform-secondary-button"
                  href="/app/teacher/calendar"
                >
                  Cancel
                </Link>
                <button
                  type="submit"
                  form="teacher-calendar-event-form"
                  className="platform-primary-button"
                  disabled={
                    savingAction === "Event scheduled" ||
                    !calendarDraft.title.trim() ||
                    !calendarDraft.date ||
                    calendarDraft.starts >= calendarDraft.ends
                  }
                >
                  <CalendarDays size={15} />
                  {savingAction === "Event scheduled"
                    ? "Saving event"
                    : "Create event"}
                </button>
              </>
            )
          }
          main={
            <section className="teacher-calendar-create-flow">
              {actionError ? (
                <p className="platform-form-error">{actionError}</p>
              ) : null}
              {calendarResult ? (
                <div className="teacher-calendar-create-success" role="status">
                  <CheckCircle2 size={20} />
                  <div>
                    <strong>Event created</strong>
                    <span>{calendarResult}</span>
                  </div>
                </div>
              ) : (
                <form
                  id="teacher-calendar-event-form"
                  className="teacher-calendar-form teacher-calendar-create-flow-form"
                  onSubmit={event => {
                    event.preventDefault();
                    void createCalendarEvent();
                  }}
                >
                  <div className="teacher-calendar-create-flow-heading">
                    <span>Event details</span>
                    <h2>Choose the class, time, and place</h2>
                    <p>
                      Your event stays within the classes and branches assigned
                      to you.
                    </p>
                  </div>
                  <div className="teacher-calendar-create-flow-grid">
                    <label className="teacher-calendar-title-field">
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
                </form>
              )}
            </section>
          }
        />
      </PlatformShell>
    );
  }

  if (view === "calendar") {
    const today = startOfDay(new Date());
    const monthCells = buildMonthCells(calendarMonth);
    const selectedDayEvents = eventsOnDay(visibleEvents, selectedCalendarDay);
    const upcomingEvents = visibleEvents
      .filter(event => {
        const starts = new Date(event.startsAt);
        return !Number.isNaN(starts.getTime()) && starts >= today;
      })
      .slice(0, 6);

    return (
      <PlatformShell role="teacher" title="Calendar">
        <WorkspaceLayout
          className="portal-ia-page teacher-work-page teacher-calendar-page"
          context={<span>Teacher</span>}
          title="Calendar"
          description="Review the class events on your teaching calendar."
          actions={
            <Link
              className="platform-primary-button"
              href="/app/teacher/calendar/new"
            >
              <Plus size={15} />
              Create event
            </Link>
          }
          main={
            <>
              {actionError ? (
                <p className="platform-form-error">{actionError}</p>
              ) : null}
              <section
                className="teacher-calendar-board"
                aria-label="Teaching calendar"
              >
                <div className="teacher-calendar-board-main">
                  <header className="teacher-calendar-board-head">
                    <div>
                      <span>Scheduled events</span>
                      <strong>{monthLabel(calendarMonth)}</strong>
                      <p>{visibleEvents.length} visible on your calendar</p>
                    </div>
                    <div className="teacher-calendar-board-nav">
                      <button
                        type="button"
                        className="platform-icon-button"
                        aria-label="Previous month"
                        onClick={() =>
                          setCalendarMonth(
                            new Date(
                              calendarMonth.getFullYear(),
                              calendarMonth.getMonth() - 1,
                              1
                            )
                          )
                        }
                      >
                        <ChevronLeft size={16} />
                      </button>
                      <button
                        type="button"
                        className="platform-secondary-button"
                        onClick={() => {
                          const now = startOfDay(new Date());
                          setCalendarMonth(
                            new Date(now.getFullYear(), now.getMonth(), 1)
                          );
                          setSelectedCalendarDay(now);
                        }}
                      >
                        Today
                      </button>
                      <button
                        type="button"
                        className="platform-icon-button"
                        aria-label="Next month"
                        onClick={() =>
                          setCalendarMonth(
                            new Date(
                              calendarMonth.getFullYear(),
                              calendarMonth.getMonth() + 1,
                              1
                            )
                          )
                        }
                      >
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  </header>

                  <div className="teacher-calendar-weekdays" aria-hidden="true">
                    {weekdayLabels().map(label => (
                      <span key={label}>{label}</span>
                    ))}
                  </div>

                  <div className="teacher-calendar-month-grid" role="grid">
                    {monthCells.map(cell => {
                      const dayEvents = eventsOnDay(visibleEvents, cell.date);
                      const selected = isSameDay(
                        cell.date,
                        selectedCalendarDay
                      );
                      const isToday = isSameDay(cell.date, today);
                      return (
                        <button
                          key={cell.date.toISOString()}
                          type="button"
                          role="gridcell"
                          className={[
                            "teacher-calendar-day",
                            cell.inMonth ? "" : "is-outside",
                            selected ? "is-selected" : "",
                            isToday ? "is-today" : "",
                            dayEvents.length ? "has-events" : "",
                          ]
                            .filter(Boolean)
                            .join(" ")}
                          aria-label={`${formatDate(cell.date.toISOString())}${dayEvents.length ? `, ${dayEvents.length} events` : ""}`}
                          aria-pressed={selected}
                          onClick={() =>
                            setSelectedCalendarDay(startOfDay(cell.date))
                          }
                        >
                          <span className="teacher-calendar-day-number">
                            {cell.date.getDate()}
                          </span>
                          <span className="teacher-calendar-day-events">
                            {dayEvents.slice(0, 3).map(event => (
                              <em key={event.id} title={event.title}>
                                {event.title}
                              </em>
                            ))}
                            {dayEvents.length > 3 ? (
                              <small>+{dayEvents.length - 3} more</small>
                            ) : null}
                          </span>
                          {dayEvents.length ? (
                            <span
                              className="teacher-calendar-day-dots"
                              aria-hidden="true"
                            >
                              {dayEvents.slice(0, 3).map(event => (
                                <i key={event.id} />
                              ))}
                            </span>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <aside className="teacher-calendar-agenda">
                  <header>
                    <span>Day plan</span>
                    <strong>
                      {new Intl.DateTimeFormat("en", {
                        weekday: "long",
                        month: "short",
                        day: "numeric",
                      }).format(selectedCalendarDay)}
                    </strong>
                    <p>
                      {selectedDayEvents.length
                        ? `${selectedDayEvents.length} event${selectedDayEvents.length === 1 ? "" : "s"}`
                        : "No events this day"}
                    </p>
                  </header>

                  <div className="teacher-calendar-agenda-list">
                    {selectedDayEvents.length ? (
                      selectedDayEvents.map(event => (
                        <article key={event.id}>
                          <div>
                            <span>{event.type.replaceAll("_", " ")}</span>
                            <strong>{event.title}</strong>
                            <p>
                              {teacherClassGroups.find(
                                group => group.id === event.classGroupId
                              )?.name ?? "General"}{" "}
                              · {formatDateTime(event.startsAt)}
                            </p>
                          </div>
                          <StatusBadge tone={statusTone(event.status)}>
                            {event.status}
                          </StatusBadge>
                        </article>
                      ))
                    ) : (
                      <div className="teacher-calendar-agenda-empty">
                        <CalendarDays size={18} aria-hidden="true" />
                        <strong>Free day</strong>
                        <span>Create an event for this date when needed.</span>
                        <Link
                          className="platform-secondary-button"
                          href="/app/teacher/calendar/new"
                        >
                          Create event
                        </Link>
                      </div>
                    )}
                  </div>

                  <div className="teacher-calendar-upcoming">
                    <strong>Coming up</strong>
                    {upcomingEvents.length ? (
                      <ul>
                        {upcomingEvents.map(event => (
                          <li key={event.id}>
                            <button
                              type="button"
                              onClick={() => {
                                const starts = new Date(event.startsAt);
                                if (Number.isNaN(starts.getTime())) return;
                                setSelectedCalendarDay(startOfDay(starts));
                                setCalendarMonth(
                                  new Date(
                                    starts.getFullYear(),
                                    starts.getMonth(),
                                    1
                                  )
                                );
                              }}
                            >
                              <span>{formatDateTime(event.startsAt)}</span>
                              <em>{event.title}</em>
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p>No upcoming events yet.</p>
                    )}
                  </div>
                </aside>
              </section>
            </>
          }
        />
      </PlatformShell>
    );
  }

  if (view === "quran-detail") {
    const recitation = activeRecitation;

    return (
      <PlatformShell role="teacher" title="Review recitation">
        <DetailLayout
          className="portal-ia-page teacher-work-page teacher-quran-detail-page"
          context={<span>Teacher</span>}
          title="Review recitation"
          description="Review one learner recording and update the learning record."
          actions={
            <Link
              className="platform-secondary-button"
              href="/app/teacher/quran-review"
            >
              Back to recitations
            </Link>
          }
          main={
            recitation ? (
              quranReviewSaved ? (
                <section
                  className="teacher-action-success"
                  data-testid="teacher-quran-review-success"
                >
                  <CheckCircle2 aria-hidden="true" size={20} />
                  <div>
                    <strong>Recitation reviewed</strong>
                    <span>The learner feedback has been saved.</span>
                  </div>
                  <Link
                    className="platform-primary-button"
                    href="/app/teacher/quran-review"
                  >
                    Return to recitations
                  </Link>
                </section>
              ) : (
                <section
                  className="teacher-recitation-review"
                  data-testid="teacher-recitation-review"
                >
                  <header className="teacher-recitation-review-head">
                    <div>
                      <span>Recitation</span>
                      <h2>{recitation.title}</h2>
                      <p>
                        {studentName(recitation.studentId)} · submitted{" "}
                        {formatDateTime(recitation.submittedAt)}
                      </p>
                    </div>
                    <StatusBadge tone={statusTone(recitation.status)}>
                      {recitation.status}
                    </StatusBadge>
                  </header>
                  <dl className="teacher-recitation-facts">
                    <div>
                      <dt>Plan</dt>
                      <dd>{selectedQuranPlan?.target ?? "Not set"}</dd>
                    </div>
                    <div>
                      <dt>Current juz</dt>
                      <dd>{selectedQuranPlan?.currentJuz ?? "Not set"}</dd>
                    </div>
                    <div>
                      <dt>Level</dt>
                      <dd>{selectedStudent?.currentLevel ?? "Not set"}</dd>
                    </div>
                  </dl>
                  {recitation.pendingMedia?.length ? (
                    <section className="teacher-recitation-media">
                      <span>Attached media</span>
                      <div>
                        {recitation.pendingMedia.map(media => (
                          <article key={media.id}>
                            <Headphones aria-hidden="true" size={16} />
                            <div>
                              <strong>{media.previewLabel}</strong>
                              <small>{media.name}</small>
                            </div>
                          </article>
                        ))}
                      </div>
                    </section>
                  ) : null}
                  {recitation.status === "pending" ? (
                    <form
                      className="teacher-recitation-review-form"
                      data-testid="teacher-recitation-review-form"
                      onSubmit={event => {
                        event.preventDefault();
                        void reviewRecitation();
                      }}
                    >
                      <div className="teacher-recitation-review-form-head">
                        <div>
                          <span>Review</span>
                          <strong>
                            Update progress and leave concise feedback.
                          </strong>
                        </div>
                      </div>
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
                      <label className="teacher-recitation-feedback">
                        Feedback
                        <textarea
                          value={recitationFeedback}
                          onChange={event => {
                            setQuranReviewSaved(false);
                            setRecitationFeedback(event.target.value);
                          }}
                          placeholder="Brief feedback for the learner"
                        />
                      </label>
                      <div className="teacher-recitation-review-actions">
                        <button
                          type="button"
                          className="platform-secondary-button"
                          disabled={
                            !selectedProgress ||
                            savingAction === "Progress updated"
                          }
                          onClick={() => void updateQuranProgress()}
                        >
                          {savingAction === "Progress updated"
                            ? "Saving progress"
                            : "Save progress"}
                        </button>
                        <button
                          type="submit"
                          className="platform-primary-button"
                          disabled={
                            savingAction === "Recitation reviewed" ||
                            !recitationFeedback.trim()
                          }
                        >
                          {savingAction === "Recitation reviewed"
                            ? "Saving review"
                            : "Save review"}
                        </button>
                      </div>
                    </form>
                  ) : (
                    <section className="teacher-recitation-result">
                      <div>
                        <span>Recorded feedback</span>
                        <p>
                          {recitation.feedback ??
                            selectedProgress?.notes ??
                            "No feedback was recorded."}
                        </p>
                      </div>
                      <StatusBadge tone={statusTone(recitation.status)}>
                        {recitation.status}
                      </StatusBadge>
                    </section>
                  )}
                </section>
              )
            ) : (
              <section className="platform-empty-state">
                <strong>This recitation is not available.</strong>
                <span>
                  Return to the recitation queue and choose another item.
                </span>
              </section>
            )
          }
        />
      </PlatformShell>
    );
  }

  return (
    <PlatformShell role="teacher" title="Quran review">
      <WorkspaceLayout
        className="portal-ia-page teacher-work-page teacher-quran-review-page"
        context={<span>Teacher</span>}
        title="Quran review"
        description="Review learner recitations and recorded feedback."
        main={
          <>
            {actionError ? (
              <p className="platform-form-error">{actionError}</p>
            ) : null}
            <DataTableCard
              title="Recitation queue"
              subtitle={`${recitations.length} recitations`}
            >
              <div
                className="platform-row-list teacher-recitation-list"
                data-testid="teacher-recitation-list"
              >
                {recitations.length ? (
                  recitations.map(recitation => (
                    <Link
                      key={recitation.id}
                      className="teacher-recitation-row-link"
                      href={`/app/teacher/quran-review/${recitation.id}`}
                    >
                      <div>
                        <strong>{recitation.title}</strong>
                        <small>
                          {studentName(recitation.studentId)} ·{" "}
                          {formatDateTime(recitation.submittedAt)}
                        </small>
                      </div>
                      <StatusBadge tone={statusTone(recitation.status)}>
                        {recitation.status}
                      </StatusBadge>
                    </Link>
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
            </DataTableCard>
          </>
        }
      />
    </PlatformShell>
  );
}
