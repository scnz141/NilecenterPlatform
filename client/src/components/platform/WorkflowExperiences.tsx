import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowRight,
  Award,
  BookMarked,
  BookOpen,
  CalendarDays,
  Captions,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  CreditCard,
  Download,
  FileText,
  GraduationCap,
  Headphones,
  ListChecks,
  Maximize2,
  MessageSquare,
  Minimize2,
  NotebookPen,
  Pause,
  Play,
  Radio,
  Send,
  Settings,
  ShieldCheck,
  SkipBack,
  SkipForward,
  SlidersHorizontal,
  UserPlus,
  Video,
  Volume2,
  VolumeX,
} from "lucide-react";
import { toast } from "sonner";
import {
  fetchPlatformStateRequest,
  runPlatformLearningActionRequest,
} from "@/lib/backend/api";
import type { PlatformLearningAction } from "@/lib/domain/actions";
import { platformStore } from "@/lib/domain/store";
import type {
  AttendanceStatus,
  CalendarEventType,
  Lesson,
  LessonResource,
} from "@/lib/domain/types";
import { checkSupabaseBrowserConnection } from "@/lib/supabase/client";
import { withRuntimeIntegrationStatus } from "@/lib/integrations/registry";
import {
  getDemoUser,
  roleMeta,
  type PageConfig,
  type Role,
} from "@/lib/platformData";

const assessmentPages = new Set([
  "assignments",
  "assignment-detail",
  "quizzes",
  "quiz-detail",
  "grading",
  "question-bank",
  "assessments",
]);
const admissionsPages = new Set([
  "leads",
  "lead-detail",
  "applications",
  "placement-tests",
  "placement-detail",
  "enrollments",
]);
const learningPages = new Set([
  "courses",
  "course-detail",
  "lesson",
  "live",
  "grades",
]);
const reportLabels = {
  enrollments: "Enrollment",
  attendance: "Attendance",
  finance: "Finance",
  audit: "Audit",
} as const;

export function isStatefulWorkflowPage(
  role: Role,
  pageId: string,
  kind: PageConfig["kind"]
) {
  if (role === "student" && learningPages.has(pageId)) return true;
  if (assessmentPages.has(pageId) || kind === "assessment") return true;
  if (kind === "attendance") return true;
  if (kind === "calendar") return true;
  if (kind === "certificate") return true;
  if (kind === "quran") return true;
  if (kind === "messages") return true;
  if (pageId === "payments") return true;
  if (admissionsPages.has(pageId)) return true;
  if (pageId === "integrations") return true;
  if (
    kind === "report" ||
    pageId === "system-health" ||
    pageId === "audit-logs"
  )
    return true;
  return false;
}

export default function StatefulWorkflowExperience({
  config,
  role,
  pageId,
  params,
}: {
  config: PageConfig;
  role: Role;
  pageId: string;
  params?: Record<string, string | undefined>;
}) {
  const [version, setVersion] = useState(0);
  const [backendSyncStatus, setBackendSyncStatus] = useState<
    "loading" | "supabase" | "local" | "offline"
  >("loading");
  const state = useMemo(() => platformStore.getState(), [version]);
  const refresh = () => setVersion(value => value + 1);

  useEffect(() => {
    let cancelled = false;
    setBackendSyncStatus("loading");
    fetchPlatformStateRequest().then(result => {
      if (cancelled) return;
      if (result.ok && result.data) {
        platformStore.setState(result.data.state);
        setBackendSyncStatus(result.data.persistence);
        refresh();
        return;
      }
      setBackendSyncStatus("offline");
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (role === "student" && learningPages.has(pageId)) {
    return (
      <LearningWorkflow
        role={role}
        state={state}
        refresh={refresh}
        params={params}
        backendSyncStatus={backendSyncStatus}
        setBackendSyncStatus={setBackendSyncStatus}
      />
    );
  }
  if (role === "student" && (assessmentPages.has(pageId) || config.kind === "assessment"))
    return (
      <AssessmentWorkflow
        role={role}
        state={state}
        refresh={refresh}
        params={params}
      />
    );
  if (role === "student" && config.kind === "attendance")
    return <StudentAttendanceWorkflow role={role} state={state} refresh={refresh} />;
  if (role === "student" && config.kind === "calendar")
    return <StudentCalendarWorkflow role={role} state={state} refresh={refresh} />;
  if (role === "student" && config.kind === "certificate")
    return <StudentCertificateWorkflow role={role} state={state} refresh={refresh} />;
  if (role === "student" && config.kind === "quran")
    return <StudentQuranWorkflow role={role} state={state} refresh={refresh} />;
  if (role === "student" && config.kind === "messages")
    return <StudentMessageWorkflow role={role} state={state} refresh={refresh} />;
  if (role === "student" && config.kind === "report")
    return <StudentReportsWorkflow role={role} state={state} pageId={pageId} />;
  if (assessmentPages.has(pageId) || config.kind === "assessment")
    return <AssessmentWorkflow role={role} state={state} refresh={refresh} params={params} />;
  if (config.kind === "attendance")
    return (
      <AttendanceWorkflow
        role={role}
        state={state}
        refresh={refresh}
        params={params}
      />
    );
  if (admissionsPages.has(pageId))
    return <AdmissionsWorkflow role={role} state={state} refresh={refresh} />;
  if (config.kind === "calendar")
    return <SchedulingWorkflow role={role} state={state} refresh={refresh} />;
  if (config.kind === "certificate")
    return <CertificateWorkflow role={role} state={state} refresh={refresh} />;
  if (config.kind === "quran")
    return <QuranWorkflow role={role} state={state} refresh={refresh} />;
  if (config.kind === "messages")
    return <MessageWorkflow role={role} state={state} refresh={refresh} />;
  if (pageId === "payments")
    return <FinanceWorkflow role={role} state={state} refresh={refresh} />;
  if (pageId === "integrations")
    return <IntegrationsWorkflow role={role} state={state} refresh={refresh} />;
  return <ReportsWorkflow role={role} state={state} pageId={pageId} />;
}

type WorkflowProps = {
  role: Role;
  state: ReturnType<typeof platformStore.getState>;
  refresh: () => void;
  params?: Record<string, string | undefined>;
  backendSyncStatus?: "loading" | "supabase" | "local" | "offline";
  setBackendSyncStatus?: (
    status: "loading" | "supabase" | "local" | "offline"
  ) => void;
};

type PlatformStateSnapshot = ReturnType<typeof platformStore.getState>;

const STUDENT_PROFILE_ID = "stu_demo";
const STUDENT_USER_ID = "usr_student_demo";

function getStudentScope(state: PlatformStateSnapshot) {
  const student =
    state.students.find(item => item.id === STUDENT_PROFILE_ID) ??
    state.students[0];
  const studentId = student?.id ?? STUDENT_PROFILE_ID;
  const user =
    state.users.find(item => item.id === student?.userId) ??
    state.users.find(item => item.id === STUDENT_USER_ID);
  const userId = user?.id ?? STUDENT_USER_ID;
  const enrollments = state.enrollments.filter(
    enrollment => enrollment.studentId === studentId
  );
  const runIds = new Set(enrollments.map(enrollment => enrollment.courseRunId));
  const classGroups = state.classGroups.filter(group =>
    runIds.has(group.courseRunId)
  );
  const classIds = new Set(classGroups.map(group => group.id));
  const courses = enrollments
    .map(enrollment => {
      const run = state.courseRuns.find(item => item.id === enrollment.courseRunId);
      const course = state.courses.find(item => item.id === run?.courseId);
      return run && course ? { enrollment, run, course } : null;
    })
    .filter(Boolean) as Array<{
    enrollment: PlatformStateSnapshot["enrollments"][number];
    run: PlatformStateSnapshot["courseRuns"][number];
    course: PlatformStateSnapshot["courses"][number];
  }>;

  return {
    student,
    studentId,
    user,
    userId,
    enrollments,
    runIds,
    classGroups,
    classIds,
    courses,
  };
}

function formatDateTime(value?: string) {
  if (!value) return "Not scheduled";
  return new Date(value).toLocaleString();
}

function LearningWorkflow({
  role,
  state,
  refresh,
  params,
  backendSyncStatus = "offline",
  setBackendSyncStatus,
}: WorkflowProps) {
  const [assignmentResponse, setAssignmentResponse] = useState(
    "I completed the checkpoint and need feedback on examples."
  );
  const [quizAnswer, setQuizAnswer] = useState("Correct");
  const [manualRunId, setManualRunId] = useState<string | null>(null);
  const [manualLessonId, setManualLessonId] = useState<string | null>(null);
  const studentId = "stu_demo";
  const routeCourseId = params?.courseId;
  const routeLessonId = params?.lessonId;
  const enrollments = state.enrollments.filter(
    item => item.studentId === studentId
  );
  const courseOptions = enrollments
    .map(enrollment => {
      const run = state.courseRuns.find(
        item => item.id === enrollment.courseRunId
      );
      const course = state.courses.find(item => item.id === run?.courseId);
      const classGroup = state.classGroups.find(
        item => item.courseRunId === run?.id
      );
      return run && course ? { enrollment, run, course, classGroup } : null;
    })
    .filter(Boolean) as Array<{
    enrollment: (typeof state.enrollments)[number];
    run: (typeof state.courseRuns)[number];
    course: (typeof state.courses)[number];
    classGroup?: (typeof state.classGroups)[number];
  }>;
  const routedOption = courseOptions.find(
    ({ course, run }) =>
      routeCourseId === course.id ||
      routeCourseId === course.slug ||
      routeCourseId === run.id
  );
  const selectedOption =
    courseOptions.find(({ run }) => run.id === manualRunId) ??
    routedOption ??
    courseOptions[0];
  const enrollment = selectedOption?.enrollment;
  const run = selectedOption?.run;
  const course = selectedOption?.course;
  const classGroup =
    selectedOption?.classGroup ??
    state.classGroups.find(item => item.courseRunId === run?.id);
  const teacher = state.teachers.find(item => item.id === run?.teacherId);
  const teacherUser = state.users.find(
    item => item.id === teacher?.userId || item.id === run?.teacherId
  );
  const meeting = state.meetingLinks.find(
    item => item.id === classGroup?.meetingLinkId
  );
  const modules = state.modules
    .filter(item => item.courseId === course?.id)
    .sort((a, b) => a.order - b.order);
  const lessonRows = modules.flatMap(module =>
    state.lessons
      .filter(lesson => lesson.moduleId === module.id)
      .map(lesson => {
        const progress = state.lessonProgress.find(
          item => item.lessonId === lesson.id && item.studentId === studentId
        );
        const resources = state.resources.filter(
          resource =>
            lesson.resourceIds.includes(resource.id) && resource.published
        );
        return { module, lesson, progress, resources };
      })
  );
  const nextLessonRow =
    lessonRows.find(row => row.progress?.status !== "completed") ??
    lessonRows[0];
  const selectedLessonRow =
    lessonRows.find(row => row.lesson.id === manualLessonId) ??
    lessonRows.find(row => row.lesson.id === routeLessonId) ??
    nextLessonRow;
  const selectedLesson = selectedLessonRow?.lesson;
  const selectedResources = selectedLessonRow?.resources ?? [];
  const completedLessons = lessonRows.filter(
    row => row.progress?.status === "completed"
  ).length;
  const lessonCompletion = lessonRows.length
    ? Math.round((completedLessons / lessonRows.length) * 100)
    : 0;
  const allLessonsComplete =
    lessonRows.length > 0 && completedLessons === lessonRows.length;
  const assignment = state.assignments.find(
    item => item.courseRunId === run?.id
  );
  const submission = assignment
    ? state.assignmentSubmissions.find(
        item =>
          item.assignmentId === assignment.id && item.studentId === studentId
      )
    : undefined;
  const quiz = state.quizzes.find(item => item.courseRunId === run?.id);
  const quizAttempts = quiz
    ? state.quizAttempts.filter(
        item => item.quizId === quiz.id && item.studentId === studentId
      )
    : [];
  const attemptsRemaining = Math.max(
    0,
    (quiz?.attemptsAllowed ?? 0) - quizAttempts.length
  );
  const latestAttempt = quizAttempts[0];
  const setSyncStatus = setBackendSyncStatus ?? (() => undefined);
  const syncStatus = backendSyncStatus;
  const syncLabel =
    syncStatus === "supabase"
      ? "Supabase synced"
      : syncStatus === "local"
        ? "Local fallback"
        : syncStatus === "loading"
          ? "Syncing"
          : "Offline cache";

  const syncLearningAction = (action: PlatformLearningAction) => {
    runPlatformLearningActionRequest(action).then(result => {
      if (result.ok && result.data) {
        platformStore.setState(result.data.state);
        setSyncStatus(result.data.persistence);
        refresh();
        return;
      }
      setSyncStatus("offline");
      toast.error("Saved locally only", {
        description: result.error ?? "Backend sync failed.",
      });
    });
  };

  const selectCourse = (runId: string) => {
    setManualRunId(runId);
    setManualLessonId(null);
  };

  const startSelectedLesson = () => {
    if (!selectedLesson) return;
    setManualLessonId(selectedLesson.id);
    const lesson = platformStore.startLesson(
      selectedLesson.id,
      studentId,
      getDemoUser(role).id
    );
    refresh();
    syncLearningAction({
      type: "lesson.start",
      lessonId: selectedLesson.id,
      studentId,
    });
    toast.success("Lesson opened", { description: lesson.title });
  };

  const completeSelectedLesson = () => {
    if (!selectedLesson) return;
    setManualLessonId(selectedLesson.id);
    const lesson = platformStore.completeLesson(
      selectedLesson.id,
      studentId,
      getDemoUser(role).id
    );
    refresh();
    syncLearningAction({
      type: "lesson.complete",
      lessonId: selectedLesson.id,
      studentId,
    });
    toast.success("Lesson marked complete", { description: lesson.title });
  };

  const submitCheckpoint = () => {
    if (!assignment || !assignmentResponse.trim()) return;
    const saved = platformStore.submitAssignment(
      assignment.id,
      assignmentResponse,
      studentId,
      getDemoUser(role).id
    );
    refresh();
    syncLearningAction({
      type: "assignment.submit",
      assignmentId: assignment.id,
      response: assignmentResponse,
      studentId,
    });
    toast.success("Checkpoint submitted", { description: saved.id });
  };

  const submitQuickQuiz = () => {
    if (!quiz || !quizAnswer.trim() || attemptsRemaining <= 0) return;
    const attempt = platformStore.submitQuizAttempt(
      quiz.id,
      { q1: quizAnswer },
      studentId,
      getDemoUser(role).id
    );
    refresh();
    syncLearningAction({
      type: "quiz.submit",
      quizId: quiz.id,
      answers: { q1: quizAnswer },
      studentId,
    });
    toast.success("Quiz attempt saved", {
      description: `${attempt.score}/${attempt.maxScore}`,
    });
  };

  if (!selectedOption || !course || !run) {
    return (
      <section className="platform-workflow-card">
        <div className="platform-workflow-title">
          <span>
            <BookOpen size={16} /> Learning workspace
          </span>
          <strong>No active enrollment</strong>
        </div>
        <p>
          The student does not have an active course enrollment in the local
          platform state.
        </p>
      </section>
    );
  }

  return (
    <div className="learning-workspace">
      <section className="learning-course-rail">
        <div className="platform-workflow-title">
          <span>
            <GraduationCap size={16} /> Enrolled courses
          </span>
          <strong>{courseOptions.length}</strong>
        </div>
        <div className="learning-course-switcher">
          {courseOptions.map(option => (
            <button
              key={option.run.id}
              className={option.run.id === run.id ? "active" : ""}
              onClick={() => selectCourse(option.run.id)}
            >
              <span>{option.course.title}</span>
              <small>{option.classGroup?.schedule ?? option.run.term}</small>
              <ChevronRight size={15} />
            </button>
          ))}
        </div>
      </section>

      <section className="learning-hero-panel">
        <div>
          <span className="platform-eyebrow">Course workspace</span>
          <h2>{course.title}</h2>
          <p>{course.description}</p>
          <div className="learning-hero-meta">
            <span>
              <CalendarDays size={14} /> {classGroup?.schedule ?? run.term}
            </span>
            <span>
              <BookMarked size={14} /> {modules.length} modules
            </span>
            <span>
              <Clock3 size={14} />{" "}
              {lessonRows.reduce(
                (sum, row) => sum + row.lesson.durationMinutes,
                0
              )}{" "}
              min
            </span>
            <span className={`learning-sync-pill ${syncStatus}`}>
              <Activity size={14} /> {syncLabel}
            </span>
          </div>
        </div>
        <div className="learning-progress-panel">
          <span>Lesson completion</span>
          <strong>{lessonCompletion}%</strong>
          <div>
            <i
              style={{
                width: `${lessonCompletion}%`,
                background: roleMeta[role].color,
              }}
            />
          </div>
          <small>
            {completedLessons} of {lessonRows.length} lessons complete ·
            enrollment {enrollment?.progress ?? 0}%
          </small>
        </div>
      </section>

      <div className="learning-main-grid">
        <section className="learning-player-panel">
          <div className="learning-player-top">
            <span className="learning-lesson-type">
              {selectedLesson?.type ?? "lesson"}
            </span>
            <span>
              {selectedLessonRow?.progress?.status.replace("_", " ") ??
                "not started"}
            </span>
          </div>
          <NileLessonPlayer
            lesson={selectedLesson}
            moduleTitle={selectedLessonRow?.module.title}
            outcomes={selectedLessonRow?.module.outcomes ?? []}
            resources={selectedResources}
            progressStatus={selectedLessonRow?.progress?.status}
            syncStatus={syncStatus}
          />
          <div className="learning-player-actions">
            <button disabled={!selectedLesson} onClick={startSelectedLesson}>
              <Play size={15} />
              Start lesson
            </button>
            <button
              disabled={
                !selectedLesson ||
                selectedLessonRow?.progress?.status === "completed"
              }
              onClick={completeSelectedLesson}
            >
              <CheckCircle2 size={15} />
              {selectedLessonRow?.progress?.status === "completed"
                ? "Completed"
                : "Mark complete"}
            </button>
            <button
              onClick={() =>
                toast.success("Live class ready", {
                  description:
                    meeting?.url ?? "Meeting provider is not connected yet.",
                })
              }
            >
              <Radio size={15} />
              Join live
            </button>
          </div>
        </section>

        <section className="learning-path-panel">
          <div className="platform-workflow-title">
            <span>
              <ListChecks size={16} /> Lesson pathway
            </span>
            <strong>{run.term}</strong>
          </div>
          <div className="learning-module-list">
            {modules.map(module => {
              const moduleLessons = lessonRows.filter(
                row => row.module.id === module.id
              );
              return (
                <div key={module.id} className="learning-module-group">
                  <div>
                    <strong>{module.title}</strong>
                    <small>{module.outcomes.join(" · ")}</small>
                  </div>
                  {moduleLessons.map(row => {
                    const Icon = getLessonIcon(row.lesson.type);
                    const active = selectedLesson?.id === row.lesson.id;
                    return (
                      <button
                        key={row.lesson.id}
                        className={`learning-lesson-row ${active ? "active" : ""}`}
                        onClick={() => setManualLessonId(row.lesson.id)}
                      >
                        <span>
                          <Icon size={15} />
                        </span>
                        <div>
                          <strong>{row.lesson.title}</strong>
                          <small>
                            {row.lesson.type} · {row.lesson.durationMinutes} min
                            · {row.resources.length} resources
                          </small>
                        </div>
                        <em>
                          {row.progress?.status.replace("_", " ") ??
                            "not started"}
                        </em>
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </section>

        <aside className="learning-context-panel">
          <div className="learning-metric-strip">
            <MiniMetric
              label="Attendance"
              value={`${enrollment?.attendanceRate ?? 0}%`}
            />
            <MiniMetric
              label="Grade"
              value={`${enrollment?.currentGrade ?? 0}%`}
            />
            <MiniMetric
              label="Teacher"
              value={teacherUser?.name ?? "Assigned"}
            />
          </div>

          <section className="learning-side-card">
            <div className="platform-workflow-title">
              <span>
                <Download size={16} /> Lesson resources
              </span>
              <strong>{selectedResources.length}</strong>
            </div>
            <div className="learning-resource-list">
              {selectedResources.map(resource => {
                const Icon =
                  resource.type === "audio"
                    ? Headphones
                    : resource.type === "video"
                      ? Video
                      : FileText;
                return (
                  <a key={resource.id} href={resource.url}>
                    <Icon size={15} />
                    <span>{resource.title}</span>
                    <ArrowRight size={14} />
                  </a>
                );
              })}
              {!selectedResources.length ? (
                <small>No resources attached to this lesson.</small>
              ) : null}
            </div>
          </section>

          <section className="learning-side-card">
            <div className="platform-workflow-title">
              <span>
                <NotebookPen size={16} /> Assignment checkpoint
              </span>
              <strong>{submission?.status ?? "not submitted"}</strong>
            </div>
            <p>
              {assignment?.title ??
                "No assignment is attached to this course run."}
            </p>
            {assignment ? (
              <>
                <textarea
                  value={assignmentResponse}
                  onChange={event => setAssignmentResponse(event.target.value)}
                />
                <button
                  onClick={submitCheckpoint}
                  disabled={!assignmentResponse.trim()}
                >
                  <Send size={15} />
                  Submit checkpoint
                </button>
              </>
            ) : null}
          </section>

          <section className="learning-side-card">
            <div className="platform-workflow-title">
              <span>
                <ClipboardCheck size={16} /> Quiz readiness
              </span>
              <strong>{attemptsRemaining} left</strong>
            </div>
            <p>
              {quiz
                ? `${quiz.title} · ${quiz.durationMinutes} minutes · latest ${latestAttempt ? `${latestAttempt.score}/${latestAttempt.maxScore}` : "not attempted"}.`
                : "No quiz is attached to this course run."}
            </p>
            {quiz ? (
              <div className="learning-quiz-inline">
                <input
                  value={quizAnswer}
                  onChange={event => setQuizAnswer(event.target.value)}
                  aria-label="Quick quiz answer"
                />
                <button
                  onClick={submitQuickQuiz}
                  disabled={!quizAnswer.trim() || attemptsRemaining <= 0}
                >
                  Submit
                </button>
              </div>
            ) : null}
          </section>

          <section className="learning-side-card">
            <div className="platform-workflow-title">
              <span>
                <Award size={16} /> Certificate path
              </span>
              <strong>
                {state.certificates.find(item => item.courseId === course.id)
                  ?.verificationCode ?? "Pending"}
              </strong>
            </div>
            <p>
              Eligibility uses lesson completion, grade, attendance, and teacher
              approval from the platform state.
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}

function NileLessonPlayer({
  lesson,
  moduleTitle,
  outcomes,
  resources,
  progressStatus,
  syncStatus,
}: {
  lesson?: Lesson;
  moduleTitle?: string;
  outcomes: string[];
  resources: LessonResource[];
  progressStatus?: string;
  syncStatus: "loading" | "supabase" | "local" | "offline";
}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(
    progressStatus === "completed"
      ? 100
      : progressStatus === "in_progress"
        ? 36
        : 0
  );
  const [volume, setVolume] = useState(84);
  const [speed, setSpeed] = useState("1x");
  const [captionsOn, setCaptionsOn] = useState(true);
  const [boardMode, setBoardMode] = useState(false);
  const primaryMedia = resources.find(
    resource => resource.type === "video" || resource.type === "audio"
  );
  const playerMode =
    lesson?.type === "live"
      ? "live"
      : primaryMedia?.type === "audio"
        ? "audio"
        : lesson?.type === "video" || primaryMedia?.type === "video"
          ? "video"
          : lesson?.type === "assessment"
            ? "assessment"
            : "studio";
  const durationSeconds = Math.max(60, (lesson?.durationMinutes ?? 1) * 60);
  const currentSeconds = Math.round((progress / 100) * durationSeconds);
  const MediaIcon =
    playerMode === "audio"
      ? Headphones
      : playerMode === "live"
        ? Radio
        : playerMode === "assessment"
          ? ClipboardCheck
          : Video;
  const syncCopy =
    syncStatus === "supabase"
      ? "Synced"
      : syncStatus === "loading"
        ? "Syncing"
        : syncStatus === "offline"
          ? "Offline"
          : "Local";
  const captionText = lesson
    ? playerMode === "live"
      ? "Live room opens with attendance, recitation, and class notes attached."
      : `${moduleTitle ?? "Lesson"} · ${lesson.durationMinutes} min · ${outcomes.slice(0, 2).join(" and ")}.`
    : "Select a lesson to load the player.";

  useEffect(() => {
    setIsPlaying(false);
    setProgress(
      progressStatus === "completed"
        ? 100
        : progressStatus === "in_progress"
          ? 36
          : 0
    );
  }, [lesson?.id, progressStatus]);

  useEffect(() => {
    if (!isPlaying) return;
    const interval = window.setInterval(() => {
      setProgress(value => {
        if (value >= 100) {
          window.clearInterval(interval);
          setIsPlaying(false);
          return 100;
        }
        return Math.min(100, value + 1.25);
      });
    }, 900);
    return () => window.clearInterval(interval);
  }, [isPlaying]);

  const shiftProgress = (amount: number) => {
    setProgress(value => Math.min(100, Math.max(0, value + amount)));
  };

  return (
    <div
      className={`nile-player ${boardMode ? "board-mode" : ""} ${playerMode}`}
    >
      <div className="nile-player-header">
        <div>
          <span>Nile Player</span>
          <strong>{lesson?.title ?? "No lesson selected"}</strong>
        </div>
        <div className="nile-player-status">
          <em>{playerMode}</em>
          <em>{syncCopy}</em>
        </div>
      </div>

      <div className="nile-player-stage">
        <div className="nile-player-pattern" aria-hidden="true" />
        <div className="nile-player-mark">
          <MediaIcon size={boardMode ? 54 : 42} />
        </div>
        <div className="nile-player-content">
          <span>{moduleTitle ?? "Course media"}</span>
          <h3>{lesson?.title ?? "Choose a lesson"}</h3>
          <p>{captionText}</p>
        </div>
        {playerMode === "audio" || playerMode === "live" ? (
          <div className="nile-waveform" aria-hidden="true">
            {Array.from({ length: 34 }).map((_, index) => (
              <i
                key={index}
                style={{ height: `${20 + ((index * 17) % 56)}%` }}
              />
            ))}
          </div>
        ) : (
          <div className="nile-video-grid" aria-hidden="true">
            <span />
            <span />
            <span />
            <span />
          </div>
        )}
        {captionsOn ? (
          <div className="nile-caption-line">{captionText}</div>
        ) : null}
      </div>

      <div className="nile-player-controls">
        <button
          type="button"
          aria-label="Back 10 seconds"
          onClick={() => shiftProgress(-8)}
          disabled={!lesson}
        >
          <SkipBack size={16} />
        </button>
        <button
          type="button"
          className="nile-play-button"
          aria-label={isPlaying ? "Pause lesson" : "Play lesson"}
          onClick={() => setIsPlaying(value => !value)}
          disabled={!lesson}
        >
          {isPlaying ? <Pause size={18} /> : <Play size={18} />}
        </button>
        <button
          type="button"
          aria-label="Forward 10 seconds"
          onClick={() => shiftProgress(8)}
          disabled={!lesson}
        >
          <SkipForward size={16} />
        </button>

        <div className="nile-timeline">
          <span>{formatPlayerTime(currentSeconds)}</span>
          <input
            type="range"
            aria-label="Lesson timeline"
            min="0"
            max="100"
            value={Math.round(progress)}
            onChange={event => setProgress(Number(event.target.value))}
            disabled={!lesson}
          />
          <span>{formatPlayerTime(durationSeconds)}</span>
        </div>

        <div className="nile-volume">
          {volume > 0 ? <Volume2 size={16} /> : <VolumeX size={16} />}
          <input
            type="range"
            aria-label="Lesson volume"
            min="0"
            max="100"
            value={volume}
            onChange={event => setVolume(Number(event.target.value))}
          />
        </div>

        <select
          aria-label="Playback speed"
          value={speed}
          onChange={event => setSpeed(event.target.value)}
        >
          <option value="0.75x">0.75x</option>
          <option value="1x">1x</option>
          <option value="1.25x">1.25x</option>
          <option value="1.5x">1.5x</option>
        </select>

        <button
          type="button"
          aria-label="Toggle captions"
          className={captionsOn ? "active" : ""}
          onClick={() => setCaptionsOn(value => !value)}
        >
          <Captions size={16} />
        </button>
        <button
          type="button"
          aria-label="Toggle classroom mode"
          className={boardMode ? "active" : ""}
          onClick={() => setBoardMode(value => !value)}
        >
          {boardMode ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
        </button>
        <button type="button" aria-label="Player settings">
          <Settings size={16} />
        </button>
      </div>
    </div>
  );
}

function formatPlayerTime(seconds: number) {
  const safeSeconds = Math.max(0, seconds);
  const minutes = Math.floor(safeSeconds / 60);
  const remaining = safeSeconds % 60;
  return `${minutes}:${String(remaining).padStart(2, "0")}`;
}

function getLessonIcon(
  type: "video" | "live" | "reading" | "practice" | "assessment"
) {
  if (type === "video") return Video;
  if (type === "live") return Radio;
  if (type === "practice") return NotebookPen;
  if (type === "assessment") return ClipboardCheck;
  return BookOpen;
}

function AssessmentWorkflow({ role, state, refresh, params }: WorkflowProps) {
  const [submissionText, setSubmissionText] = useState(
    "Completed response with examples."
  );
  const [quizAnswer, setQuizAnswer] = useState("Correct");
  const studentScope = getStudentScope(state);
  const studentRunIds = studentScope.runIds;
  const assignmentOptions =
    role === "student"
      ? state.assignments.filter(assignment =>
          studentRunIds.has(assignment.courseRunId)
        )
      : state.assignments;
  const quizOptions =
    role === "student"
      ? state.quizzes.filter(quiz => studentRunIds.has(quiz.courseRunId))
      : state.quizzes;
  const assignment =
    assignmentOptions.find(item => item.id === params?.assignmentId) ??
    assignmentOptions[0];
  const quiz =
    quizOptions.find(item => item.id === params?.quizId) ?? quizOptions[0];
  const latestSubmission = state.assignmentSubmissions.find(
    item =>
      item.assignmentId === assignment?.id &&
      (role !== "student" || item.studentId === studentScope.studentId)
  );
  const latestAttempt = state.quizAttempts.find(
    item =>
      item.quizId === quiz?.id &&
      (role !== "student" || item.studentId === studentScope.studentId)
  );
  const attemptsUsed = state.quizAttempts.filter(
    item => item.quizId === quiz?.id && item.studentId === studentScope.studentId
  ).length;
  const attemptsRemaining = Math.max(
    0,
    (quiz?.attemptsAllowed ?? 0) - attemptsUsed
  );
  const selectedAssignmentRun = state.courseRuns.find(
    run => run.id === assignment?.courseRunId
  );
  const selectedAssignmentCourse = state.courses.find(
    course => course.id === selectedAssignmentRun?.courseId
  );
  const selectedQuizRun = state.courseRuns.find(
    run => run.id === quiz?.courseRunId
  );
  const selectedQuizCourse = state.courses.find(
    course => course.id === selectedQuizRun?.courseId
  );

  return (
    <div className="platform-workflow-layout">
      <div className="platform-workflow-main">
        <section className="platform-workflow-card">
          <div className="platform-workflow-title">
            <span>
              <ClipboardCheck size={16} /> Assignment workflow
            </span>
            <strong>{assignment?.title}</strong>
          </div>
          {assignment ? (
            <>
              <p>
                {selectedAssignmentCourse?.title ?? "Course"} · Submission type:{" "}
                {assignment.submissionType}. Rubric:{" "}
                {assignment.rubric.join(", ")}.
              </p>
              <div className="platform-row-list compact">
                {assignmentOptions.slice(0, 4).map(item => (
                  <article
                    key={item.id}
                    className={item.id === assignment.id ? "selected" : ""}
                  >
                    <div>
                      <strong>{item.title}</strong>
                      <small>
                        Due {new Date(item.dueAt).toLocaleDateString()} ·{" "}
                        {item.status}
                      </small>
                    </div>
                  </article>
                ))}
              </div>
              <textarea
                value={submissionText}
                onChange={event => setSubmissionText(event.target.value)}
              />
              <button
                className="platform-primary-button"
                style={{ background: roleMeta[role].color }}
                disabled={!submissionText.trim()}
                onClick={() => {
                  const submission = platformStore.submitAssignment(
                    assignment.id,
                    submissionText,
                    studentScope.studentId,
                    getDemoUser(role).id
                  );
                  refresh();
                  toast.success("Assignment submitted", {
                    description: submission.id,
                  });
                }}
              >
                <Send size={15} />
                Submit assignment
              </button>
            </>
          ) : (
            <div className="platform-empty-state">
              <strong>No assignment available</strong>
              <span>This learner has no assignment in the selected course run.</span>
            </div>
          )}
        </section>

        <section className="platform-workflow-card">
          <div className="platform-workflow-title">
            <span>
              <ListChecks size={16} /> Quiz attempt
            </span>
            <strong>{quiz?.title}</strong>
          </div>
          {quiz ? (
            <>
              <p>
                {selectedQuizCourse?.title ?? "Course"} · {quiz.durationMinutes}{" "}
                minute timer · {attemptsRemaining} attempt(s) remaining ·{" "}
                {quiz.questionTypes.join(", ")}.
              </p>
              <div className="platform-row-list compact">
                {quizOptions.slice(0, 4).map(item => (
                  <article key={item.id} className={item.id === quiz.id ? "selected" : ""}>
                    <div>
                      <strong>{item.title}</strong>
                      <small>
                        {item.durationMinutes} minutes · {item.attemptsAllowed} attempts
                      </small>
                    </div>
                  </article>
                ))}
              </div>
              <div className="platform-inline-form">
                <label>
                  Short answer
                  <input
                    value={quizAnswer}
                    onChange={event => setQuizAnswer(event.target.value)}
                  />
                </label>
                <button
                  disabled={!quizAnswer.trim() || attemptsRemaining <= 0}
                  onClick={() => {
                    const attempt = platformStore.submitQuizAttempt(
                      quiz.id,
                      { q1: quizAnswer },
                      studentScope.studentId,
                      getDemoUser(role).id
                    );
                    refresh();
                    toast.success("Quiz submitted", {
                      description: `${attempt.score}/${attempt.maxScore}`,
                    });
                  }}
                >
                  {attemptsRemaining <= 0 ? "Attempts used" : "Submit attempt"}
                </button>
              </div>
            </>
          ) : (
            <div className="platform-empty-state">
              <strong>No quiz available</strong>
              <span>This learner has no quiz in the selected course run.</span>
            </div>
          )}
        </section>
      </div>
      <aside className="platform-workflow-side">
        <MiniMetric
          label="Latest submission"
          value={latestSubmission?.status ?? "none"}
        />
        <MiniMetric
          label="Latest quiz score"
          value={
            latestAttempt
              ? `${latestAttempt.score}/${latestAttempt.maxScore}`
              : "none"
          }
        />
        <MiniMetric label="Grade items" value={String(state.grades.length)} />
        <WorkflowAudit state={state} />
      </aside>
    </div>
  );
}

function StudentAttendanceWorkflow({ role, state }: WorkflowProps) {
  const scope = getStudentScope(state);
  const records = state.attendance.filter(
    record =>
      record.studentId === scope.studentId && scope.classIds.has(record.classGroupId)
  );
  const upcomingSessions = state.classSessions
    .filter(session => scope.classIds.has(session.classGroupId))
    .sort(
      (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()
    )
    .slice(0, 6);
  const averageAttendance = scope.enrollments.length
    ? Math.round(
        scope.enrollments.reduce(
          (sum, enrollment) => sum + enrollment.attendanceRate,
          0
        ) / scope.enrollments.length
      )
    : 0;
  const exceptionCount = records.filter(record => record.status !== "present").length;

  return (
    <div className="platform-workflow-layout">
      <div className="platform-workflow-main">
        <section className="platform-workflow-card">
          <div className="platform-workflow-title">
            <span>
              <SlidersHorizontal size={16} /> Attendance record
            </span>
            <strong>{scope.user?.name ?? "Student"}</strong>
          </div>
          <p>
            Read-only attendance history from enrolled classes. Teachers and
            registrars save attendance; students can review status and raise a
            support request when a record needs correction.
          </p>
          <div className="platform-row-list">
            {records.length ? (
              records.map(record => {
                const session = state.classSessions.find(
                  item =>
                    item.id === record.sessionId || item.eventId === record.sessionId
                );
                const group = state.classGroups.find(
                  item => item.id === record.classGroupId
                );
                return (
                  <article key={record.id}>
                    <div>
                      <strong>{session?.title ?? group?.name ?? "Class session"}</strong>
                      <small>
                        {group?.name ?? "Class"} · {formatDateTime(session?.startsAt)}
                      </small>
                    </div>
                    <div className="platform-row-actions">
                      <span>{record.status}</span>
                      <button
                        type="button"
                        onClick={() =>
                          toast.info("Open support to request an attendance review.")
                        }
                      >
                        Request review
                      </button>
                    </div>
                  </article>
                );
              })
            ) : (
              <div className="platform-empty-state">
                <strong>No attendance saved yet</strong>
                <span>Your classes are active, but no teacher attendance rows are saved.</span>
              </div>
            )}
          </div>
        </section>
        <section className="platform-workflow-card">
          <div className="platform-workflow-title">
            <span>
              <Clock3 size={16} /> Upcoming sessions
            </span>
            <strong>{upcomingSessions.length} scheduled</strong>
          </div>
          <div className="platform-row-list compact">
            {upcomingSessions.map(session => {
              const group = state.classGroups.find(
                item => item.id === session.classGroupId
              );
              return (
                <article key={session.id}>
                  <div>
                    <strong>{session.title}</strong>
                    <small>
                      {group?.name ?? "Class"} · {formatDateTime(session.startsAt)}
                    </small>
                  </div>
                  <span>{session.attendanceSaved ? "saved" : "pending"}</span>
                </article>
              );
            })}
          </div>
        </section>
      </div>
      <aside className="platform-workflow-side">
        <MiniMetric label="Attendance" value={`${averageAttendance}%`} />
        <MiniMetric label="Recorded sessions" value={String(records.length)} />
        <MiniMetric label="Exceptions" value={String(exceptionCount)} />
        <MiniMetric label="Classes" value={String(scope.classGroups.length)} />
      </aside>
    </div>
  );
}

function StudentCalendarWorkflow({ role, state }: WorkflowProps) {
  const [viewMode, setViewMode] = useState<"day" | "week" | "month">("week");
  const scope = getStudentScope(state);
  const classEvents = state.events.filter(
    event => event.classGroupId && scope.classIds.has(event.classGroupId)
  );
  const assignmentEvents = state.assignments
    .filter(assignment => scope.runIds.has(assignment.courseRunId))
    .map(assignment => ({
      id: assignment.id,
      title: assignment.title,
      startsAt: assignment.dueAt,
      type: "assignment_due",
      status: assignment.status,
    }));
  const quizEvents = state.quizzes
    .filter(quiz => scope.runIds.has(quiz.courseRunId))
    .map(quiz => ({
      id: quiz.id,
      title: quiz.title,
      startsAt: "",
      type: "quiz_due",
      status: quiz.status,
    }));
  const timeline = [...classEvents, ...assignmentEvents, ...quizEvents]
    .sort(
      (a, b) =>
        new Date(a.startsAt || "2999-01-01").getTime() -
        new Date(b.startsAt || "2999-01-01").getTime()
    )
    .slice(0, viewMode === "day" ? 4 : viewMode === "week" ? 8 : 12);

  return (
    <div className="platform-workflow-layout">
      <div className="platform-workflow-main">
        <section className="platform-workflow-card">
          <div className="platform-workflow-title">
            <span>
              <CalendarDays size={16} /> Learner calendar
            </span>
            <strong>Classes, due dates, reminders</strong>
          </div>
          <div className="platform-segmented" aria-label="Student calendar view">
            {(["day", "week", "month"] as const).map(mode => (
              <button
                key={mode}
                className={viewMode === mode ? "active" : ""}
                onClick={() => setViewMode(mode)}
              >
                {mode}
              </button>
            ))}
          </div>
          <div className="platform-row-list">
            {timeline.length ? (
              timeline.map(event => (
                <article key={`${event.type}_${event.id}`}>
                  <div>
                    <strong>{event.title}</strong>
                    <small>
                      {event.type.replace("_", " ")} · {formatDateTime(event.startsAt)}
                    </small>
                  </div>
                  <div className="platform-row-actions">
                    <span>{event.status}</span>
                    <button
                      type="button"
                      onClick={() =>
                        toast.info(
                          event.type === "live_session"
                            ? "Open the live class page to join."
                            : "Reminder saved in this learner view."
                        )
                      }
                    >
                      {event.type === "live_session" ? "Open live" : "Remind me"}
                    </button>
                  </div>
                </article>
              ))
            ) : (
              <div className="platform-empty-state">
                <strong>No calendar items</strong>
                <span>Your enrolled classes do not have scheduled items yet.</span>
              </div>
            )}
          </div>
        </section>
      </div>
      <aside className="platform-workflow-side">
        <MiniMetric label="Class events" value={String(classEvents.length)} />
        <MiniMetric label="Assignments" value={String(assignmentEvents.length)} />
        <MiniMetric label="Quizzes" value={String(quizEvents.length)} />
        <MiniMetric label="View" value={viewMode} />
      </aside>
    </div>
  );
}

function StudentCertificateWorkflow({ role, state }: WorkflowProps) {
  const scope = getStudentScope(state);
  const certificates = state.certificates.filter(
    certificate => certificate.studentId === scope.studentId
  );
  const [selectedId, setSelectedId] = useState(certificates[0]?.id ?? "");
  const selected =
    certificates.find(certificate => certificate.id === selectedId) ??
    certificates[0];
  const selectedCourse = state.courses.find(
    course => course.id === selected?.courseId
  );
  const [verificationCode, setVerificationCode] = useState(
    selected?.verificationCode ?? ""
  );
  const verification = platformStore.verifyCertificate(verificationCode);

  return (
    <div className="platform-workflow-layout">
      <div className="platform-workflow-main">
        <section className="platform-workflow-card">
          <div className="platform-workflow-title">
            <span>
              <Award size={16} /> Certificate wallet
            </span>
            <strong>{certificates.length} certificate(s)</strong>
          </div>
          <div className="platform-row-list">
            {certificates.length ? (
              certificates.map(certificate => {
                const course = state.courses.find(
                  item => item.id === certificate.courseId
                );
                return (
                  <article
                    key={certificate.id}
                    className={selected?.id === certificate.id ? "selected" : ""}
                  >
                    <div>
                      <strong>{course?.title ?? "Course certificate"}</strong>
                      <small>
                        Grade {certificate.grade}% · Attendance{" "}
                        {certificate.attendanceRate}% · {certificate.status}
                      </small>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedId(certificate.id);
                        setVerificationCode(certificate.verificationCode);
                      }}
                    >
                      Preview
                    </button>
                  </article>
                );
              })
            ) : (
              <div className="platform-empty-state">
                <strong>No certificates yet</strong>
                <span>Complete grade and attendance requirements to unlock certificates.</span>
              </div>
            )}
          </div>
        </section>
        {selected ? (
          <section className="platform-certificate-preview">
            <div>
              <span>Nile Learn Certificate</span>
              <strong>{scope.user?.name ?? "Student"}</strong>
              <p>
                {selectedCourse?.title ?? "Course"} · Grade {selected.grade}% ·
                Attendance {selected.attendanceRate}%
              </p>
              <em>{selected.verificationCode}</em>
            </div>
            <button type="button" onClick={() => window.print()}>
              <Download size={15} />
              Print preview
            </button>
          </section>
        ) : null}
      </div>
      <aside className="platform-workflow-side">
        <MiniMetric
          label="Issued"
          value={String(certificates.filter(item => item.status === "issued").length)}
        />
        <MiniMetric
          label="Eligible"
          value={String(certificates.filter(item => item.grade >= 80).length)}
        />
        <section className="platform-workflow-card">
          <div className="platform-workflow-title">
            <span>
              <ShieldCheck size={16} /> Verify code
            </span>
            <strong>Student lookup</strong>
          </div>
          <div className="platform-inline-form">
            <label>
              Verification code
              <input
                value={verificationCode}
                onChange={event => setVerificationCode(event.target.value)}
              />
            </label>
          </div>
          <div
            className={`platform-verification-result ${verification ? "valid" : "missing"}`}
          >
            <strong>
              {verification ? "Certificate found" : "No local match"}
            </strong>
            <small>
              {verification
                ? `${verification.course?.title ?? "Course"} · ${verification.certificate.status}`
                : "Check the verification code on your certificate."}
            </small>
          </div>
        </section>
      </aside>
    </div>
  );
}

function StudentQuranWorkflow({ role, state, refresh }: WorkflowProps) {
  const scope = getStudentScope(state);
  const plan = state.quranPlans.find(item => item.studentId === scope.studentId);
  const progress = state.quranProgress.find(
    item => item.studentId === scope.studentId
  );
  const submissions = state.recitationSubmissions.filter(
    item => item.studentId === scope.studentId
  );
  const [title, setTitle] = useState(
    progress ? `${progress.surah} ${progress.juz} recitation` : "Daily recitation"
  );
  const waveform = [34, 62, 45, 78, 52, 88, 41, 64, 36, 70, 58, 46];

  return (
    <div className="platform-workflow-layout">
      <div className="platform-workflow-main">
        <section className="platform-workflow-card">
          <div className="platform-workflow-title">
            <span>
              <Headphones size={16} /> Quran learner progress
            </span>
            <strong>{progress?.surah ?? plan?.target ?? "Memorization plan"}</strong>
          </div>
          <p>
            {plan?.target ?? "Teacher plan"} · Current Juz{" "}
            {plan?.currentJuz ?? progress?.juz ?? "-"} · revision{" "}
            {plan?.revisionCycle ?? "daily"}
          </p>
          <div className="platform-chart-bars">
            {[progress?.memorizedPercent ?? 0, progress?.tajweedScore ?? 0, submissions.length * 18].map(
              (bar, index) => (
                <div key={index}>
                  <span
                    style={{
                      height: `${Math.min(96, Math.max(18, bar))}%`,
                      background:
                        index % 2 ? roleMeta[role].accent : roleMeta[role].color,
                    }}
                  />
                  <small>{["Memory", "Tajweed", "Submits"][index]}</small>
                </div>
              )
            )}
          </div>
          <div className="platform-waveform" aria-label="Recitation practice visual">
            {waveform.map((height, index) => (
              <span
                key={index}
                style={{
                  height: `${height}%`,
                  background: roleMeta[role].color,
                }}
              />
            ))}
          </div>
          <div className="platform-inline-form">
            <label>
              Recitation title
              <input value={title} onChange={event => setTitle(event.target.value)} />
            </label>
            <button
              className="platform-primary-button"
              style={{ background: roleMeta[role].color }}
              disabled={!title.trim()}
              onClick={() => {
                const submission = platformStore.submitRecitation(
                  {
                    studentId: scope.studentId,
                    teacherId: plan?.teacherId ?? getDemoUser("teacher").id,
                    title,
                  },
                  scope.userId
                );
                refresh();
                toast.success("Recitation submitted", {
                  description: submission.id,
                });
              }}
            >
              <Send size={15} />
              Submit recitation
            </button>
          </div>
        </section>
        <section className="platform-workflow-card">
          <div className="platform-workflow-title">
            <span>
              <BookMarked size={16} /> Submission history
            </span>
            <strong>{submissions.length} submissions</strong>
          </div>
          <div className="platform-row-list compact">
            {submissions.map(submission => (
              <article key={submission.id}>
                <div>
                  <strong>{submission.title}</strong>
                  <small>{formatDateTime(submission.submittedAt)}</small>
                </div>
                <span>{submission.status}</span>
              </article>
            ))}
          </div>
        </section>
      </div>
      <aside className="platform-workflow-side">
        <MiniMetric label="Memorized" value={`${progress?.memorizedPercent ?? 0}%`} />
        <MiniMetric label="Tajweed" value={`${progress?.tajweedScore ?? 0}%`} />
        <MiniMetric label="Current Juz" value={plan?.currentJuz ?? "-"} />
      </aside>
    </div>
  );
}

function StudentMessageWorkflow({ role, state, refresh }: WorkflowProps) {
  const scope = getStudentScope(state);
  const teacherIds = Array.from(
    new Set(
      scope.courses
        .map(({ run }) => run.teacherId)
        .filter(Boolean)
    )
  );
  const recipients = state.users.filter(
    user =>
      teacherIds.includes(user.id) ||
      user.activeRole === "registrar" ||
      user.activeRole === "branchadmin"
  );
  const [toUserId, setToUserId] = useState(
    recipients[0]?.id ?? getDemoUser("teacher").id
  );
  const [subject, setSubject] = useState("Question about my lesson");
  const [body, setBody] = useState("Please review my question before the next class.");
  const messages = state.messages.filter(
    message =>
      message.fromUserId === scope.userId || message.toUserId === scope.userId
  );

  return (
    <div className="platform-workflow-layout">
      <div className="platform-workflow-main">
        <section className="platform-workflow-card">
          <div className="platform-workflow-title">
            <span>
              <MessageSquare size={16} /> Student messages
            </span>
            <strong>Teacher and support inbox</strong>
          </div>
          <div className="platform-inline-form grid">
            <label>
              Recipient
              <select value={toUserId} onChange={event => setToUserId(event.target.value)}>
                {recipients.map(user => (
                  <option key={user.id} value={user.id}>
                    {user.name} · {roleMeta[user.activeRole].label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Subject
              <input value={subject} onChange={event => setSubject(event.target.value)} />
            </label>
          </div>
          <textarea value={body} onChange={event => setBody(event.target.value)} />
          <button
            className="platform-primary-button"
            style={{ background: roleMeta[role].color }}
            disabled={!subject.trim() || !body.trim() || !toUserId}
            onClick={() => {
              platformStore.sendMessage({
                fromUserId: scope.userId,
                toUserId,
                subject,
                body,
              });
              refresh();
              toast.success("Message sent");
            }}
          >
            <Send size={15} />
            Send message
          </button>
        </section>
        <section className="platform-workflow-card">
          <div className="platform-workflow-title">
            <span>
              <MessageSquare size={16} /> Conversation history
            </span>
            <strong>{messages.length} messages</strong>
          </div>
          <div className="platform-row-list">
            {messages.length ? (
              messages.map(message => {
                const from = state.users.find(user => user.id === message.fromUserId);
                const to = state.users.find(user => user.id === message.toUserId);
                return (
                  <article key={message.id}>
                    <div>
                      <strong>{message.subject}</strong>
                      <small>
                        {from?.name ?? "Student"} to {to?.name ?? "Team"} ·{" "}
                        {formatDateTime(message.createdAt)}
                      </small>
                    </div>
                    <span>{message.read ? "read" : "unread"}</span>
                  </article>
                );
              })
            ) : (
              <div className="platform-empty-state">
                <strong>No messages yet</strong>
                <span>Send your teacher or support team a message when you need help.</span>
              </div>
            )}
          </div>
        </section>
      </div>
      <aside className="platform-workflow-side">
        <MiniMetric label="Inbox" value={String(messages.length)} />
        <MiniMetric label="Teachers" value={String(teacherIds.length)} />
        <MiniMetric
          label="Unread"
          value={String(messages.filter(message => !message.read).length)}
        />
      </aside>
    </div>
  );
}

function StudentReportsWorkflow({
  role,
  state,
  pageId,
}: Omit<WorkflowProps, "refresh"> & { pageId: string }) {
  const scope = getStudentScope(state);
  const grades = state.grades.filter(grade => grade.studentId === scope.studentId);
  const submissions = state.assignmentSubmissions.filter(
    item => item.studentId === scope.studentId
  );
  const attempts = state.quizAttempts.filter(item => item.studentId === scope.studentId);
  const rows = [
    ...scope.courses.map(({ enrollment, course }) => ({
      type: "course",
      title: course.title,
      progress: `${enrollment.progress}%`,
      score: `${enrollment.currentGrade}%`,
      status: enrollment.status,
    })),
    ...grades.map(grade => ({
      type: "grade",
      title: grade.itemTitle,
      progress: grade.feedback,
      score: `${grade.score}/${grade.maxScore}`,
      status: "recorded",
    })),
    ...submissions.map(submission => ({
      type: "assignment",
      title:
        state.assignments.find(assignment => assignment.id === submission.assignmentId)
          ?.title ?? submission.assignmentId,
      progress: formatDateTime(submission.submittedAt),
      score: submission.score ? `${submission.score}%` : "pending",
      status: submission.status,
    })),
    ...attempts.map(attempt => ({
      type: "quiz",
      title: state.quizzes.find(quiz => quiz.id === attempt.quizId)?.title ?? attempt.quizId,
      progress: formatDateTime(attempt.submittedAt),
      score: `${attempt.score}/${attempt.maxScore}`,
      status: attempt.status,
    })),
  ];
  const exportCsv = () => {
    const csv = platformStore.buildCsv(rows);
    if (!csv) {
      toast.info("No student rows to export");
      return;
    }
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `nile-student-${pageId}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    toast.success("Student CSV exported", { description: `${rows.length} row(s)` });
  };

  return (
    <div className="platform-workflow-layout">
      <div className="platform-workflow-main">
        <section className="platform-workflow-card">
          <div className="platform-workflow-title">
            <span>
              <Activity size={16} /> Student report
            </span>
            <strong>{pageId === "grades" ? "Gradebook" : "Progress report"}</strong>
          </div>
          <div className="platform-report-controls">
            <button onClick={exportCsv}>
              <Download size={15} />
              Export my CSV
            </button>
          </div>
          <div className="platform-report-table">
            {rows.map((row, index) => (
              <article key={`${row.type}_${index}`}>
                {Object.entries(row).map(([key, value]) => (
                  <span key={key}>
                    <strong>{key}</strong>
                    {String(value)}
                  </span>
                ))}
              </article>
            ))}
          </div>
        </section>
      </div>
      <aside className="platform-workflow-side">
        <MiniMetric label="Courses" value={String(scope.courses.length)} />
        <MiniMetric label="Grades" value={String(grades.length)} />
        <MiniMetric label="Assignments" value={String(submissions.length)} />
        <MiniMetric label="Quizzes" value={String(attempts.length)} />
      </aside>
    </div>
  );
}

function AttendanceWorkflow({ role, state, refresh, params }: WorkflowProps) {
  const routeClassId = params?.classId;
  const demoStudentId = "stu_demo";
  const teacherUserId = getDemoUser("teacher").id;
  const teacherRunIds = new Set(
    state.courseRuns
      .filter(run => run.teacherId === teacherUserId)
      .map(run => run.id)
  );
  const studentRunIds = new Set(
    state.enrollments
      .filter(enrollment => enrollment.studentId === demoStudentId)
      .map(enrollment => enrollment.courseRunId)
  );
  const classOptions = state.classGroups.filter(group => {
    if (role === "teacher") return teacherRunIds.has(group.courseRunId);
    if (role === "student") return studentRunIds.has(group.courseRunId);
    return true;
  });
  const classOptionKey = classOptions.map(group => group.id).join("|");
  const initialClassId =
    classOptions.find(group => group.id === routeClassId)?.id ??
    classOptions[0]?.id ??
    "";
  const [selectedClassId, setSelectedClassId] = useState(initialClassId);
  const selectedClass =
    classOptions.find(group => group.id === selectedClassId) ??
    classOptions.find(group => group.id === routeClassId) ??
    classOptions[0];
  const sessions = state.classSessions
    .filter(session => session.classGroupId === selectedClass?.id)
    .sort(
      (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()
    );
  const sessionOptionKey = sessions.map(session => session.id).join("|");
  const [selectedSessionId, setSelectedSessionId] = useState(
    sessions[0]?.id ?? ""
  );
  const session =
    sessions.find(item => item.id === selectedSessionId) ?? sessions[0];
  const [statuses, setStatuses] = useState<Record<string, AttendanceStatus>>(
    {}
  );
  const options: AttendanceStatus[] = ["present", "late", "absent", "excused"];
  const statusLabels: Record<AttendanceStatus, string> = {
    present: "Present",
    late: "Late",
    absent: "Absent",
    excused: "Excused",
  };
  const presentCount = Object.values(statuses).filter(
    value => value === "present"
  ).length;
  const exceptionCount = Object.values(statuses).filter(
    value => value !== "present"
  ).length;
  const savedRecords = session
    ? state.attendance.filter(
        record =>
          record.classGroupId === selectedClass?.id &&
          (record.sessionId === session.id ||
            record.sessionId === session.eventId)
      )
    : [];
  const attendanceReady =
    Boolean(session) &&
    Boolean(selectedClass?.studentIds.length) &&
    Object.keys(statuses).length === selectedClass?.studentIds.length;
  const recentAttendanceAudits = state.auditLogs
    .filter(
      audit =>
        audit.action === "attendance.saved" &&
        audit.entityId === selectedClass?.id
    )
    .slice(0, 3);
  const formatSessionLabel = (item: typeof session) => {
    if (!item) return "No session selected";
    return `${item.title} · ${new Date(item.startsAt).toLocaleString()}`;
  };

  useEffect(() => {
    const routedClassId = classOptions.find(
      group => group.id === routeClassId
    )?.id;
    if (routedClassId) {
      setSelectedClassId(routedClassId);
      return;
    }
    setSelectedClassId(current =>
      current && classOptions.some(group => group.id === current)
        ? current
        : (classOptions[0]?.id ?? "")
    );
  }, [classOptionKey, routeClassId]);

  useEffect(() => {
    setSelectedSessionId(current =>
      current && sessions.some(item => item.id === current)
        ? current
        : (sessions[0]?.id ?? "")
    );
  }, [sessionOptionKey]);

  useEffect(() => {
    if (!selectedClass || !session) {
      setStatuses({});
      return;
    }
    const nextStatuses = Object.fromEntries(
      selectedClass.studentIds.map(studentId => {
        const current = state.attendance.find(
          record =>
            record.classGroupId === selectedClass.id &&
            record.studentId === studentId &&
            (record.sessionId === session.id ||
              record.sessionId === session.eventId)
        );
        return [studentId, current?.status ?? "present"];
      })
    ) as Record<string, AttendanceStatus>;
    setStatuses(nextStatuses);
  }, [selectedClass?.id, session?.id, session?.eventId, state.attendance]);

  if (!selectedClass) {
    return (
      <section className="platform-workflow-card">
        <div className="platform-workflow-title">
          <span>
            <SlidersHorizontal size={16} /> Class attendance
          </span>
          <strong>No class available</strong>
        </div>
        <p>
          No class group is available for this role in the local platform state.
        </p>
      </section>
    );
  }

  return (
    <div className="platform-workflow-layout">
      <div className="platform-workflow-main">
        <section className="platform-workflow-card">
          <div className="platform-workflow-title">
            <span>
              <SlidersHorizontal size={16} /> Class attendance
            </span>
            <strong>{selectedClass.name}</strong>
          </div>
          <div className="platform-inline-form grid">
            <label>
              Class
              <select
                value={selectedClass.id}
                onChange={event => setSelectedClassId(event.target.value)}
                disabled={classOptions.length <= 1}
              >
                {classOptions.map(group => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Session
              <select
                value={session?.id ?? ""}
                onChange={event => setSelectedSessionId(event.target.value)}
                disabled={!sessions.length}
              >
                {sessions.length ? (
                  sessions.map(item => (
                    <option key={item.id} value={item.id}>
                      {formatSessionLabel(item)}
                    </option>
                  ))
                ) : (
                  <option value="">No sessions scheduled</option>
                )}
              </select>
            </label>
          </div>
          {!session ? (
            <div className="platform-empty-state">
              <strong>No session to mark</strong>
              <span>
                Create or schedule a class session before saving attendance for{" "}
                {selectedClass.name}.
              </span>
              <button
                type="button"
                onClick={() =>
                  toast.info(
                    "Open the sessions tab to create a class session first."
                  )
                }
              >
                Open sessions
              </button>
            </div>
          ) : !selectedClass.studentIds.length ? (
            <div className="platform-empty-state">
              <strong>No students enrolled</strong>
              <span>This class has no roster in the local platform state.</span>
              <button
                type="button"
                onClick={() =>
                  toast.info(
                    "Open the students tab to review the class roster."
                  )
                }
              >
                Review roster
              </button>
            </div>
          ) : (
            <div className="platform-attendance-grid stateful">
              {selectedClass.studentIds.map(studentId => {
                const student = state.students.find(
                  item => item.id === studentId
                );
                const user = state.users.find(
                  item => item.id === student?.userId
                );
                return (
                  <article key={studentId}>
                    <div>
                      <strong>{user?.name ?? studentId}</strong>
                      <span>
                        {session.title} ·{" "}
                        {new Date(session.startsAt).toLocaleString()}
                      </span>
                    </div>
                    <div>
                      {options.map(status => (
                        <button
                          key={status}
                          className={
                            statuses[studentId] === status ? "active" : ""
                          }
                          onClick={() =>
                            setStatuses(prev => ({
                              ...prev,
                              [studentId]: status,
                            }))
                          }
                        >
                          {statusLabels[status]}
                        </button>
                      ))}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
          <button
            className="platform-primary-button"
            style={{ background: roleMeta[role].color }}
            disabled={!attendanceReady}
            onClick={() => {
              if (!session || !attendanceReady) return;
              platformStore.saveAttendanceBulk(
                selectedClass.id,
                session.id,
                statuses,
                getDemoUser(role).id
              );
              refresh();
              toast.success("Attendance saved", {
                description: `${selectedClass.name} · ${session.title}`,
              });
            }}
          >
            <CheckCircle2 size={15} />
            Save attendance
          </button>
        </section>
        {session ? (
          <section className="platform-workflow-card">
            <div className="platform-workflow-title">
              <span>
                <ClipboardCheck size={16} /> Saved roster
              </span>
              <strong>{savedRecords.length} saved</strong>
            </div>
            <div className="platform-row-list compact">
              {savedRecords.length ? (
                savedRecords.map(record => {
                  const student = state.students.find(
                    item => item.id === record.studentId
                  );
                  const user = state.users.find(
                    item => item.id === student?.userId
                  );
                  return (
                    <article key={record.id}>
                      <div>
                        <strong>{user?.name ?? record.studentId}</strong>
                        <small>{statusLabels[record.status]}</small>
                      </div>
                    </article>
                  );
                })
              ) : (
                <article>
                  <div>
                    <strong>No saved records</strong>
                    <small>
                      Statuses are pending until you save this session.
                    </small>
                  </div>
                </article>
              )}
            </div>
          </section>
        ) : null}
      </div>
      <aside className="platform-workflow-side">
        <MiniMetric
          label="Session status"
          value={
            session?.attendanceSaved ? "saved" : session ? "pending" : "none"
          }
        />
        <MiniMetric
          label="Students"
          value={String(selectedClass.studentIds.length)}
        />
        <MiniMetric label="Present" value={String(presentCount)} />
        <MiniMetric label="Exceptions" value={String(exceptionCount)} />
        <section className="platform-workflow-card">
          <div className="platform-workflow-title">
            <span>
              <ShieldCheck size={16} /> Attendance audit
            </span>
            <strong>Latest saves</strong>
          </div>
          <div className="platform-row-list compact">
            {recentAttendanceAudits.length ? (
              recentAttendanceAudits.map(audit => (
                <article key={audit.id}>
                  <div>
                    <strong>Attendance saved</strong>
                    <small>{audit.summary}</small>
                  </div>
                </article>
              ))
            ) : (
              <article>
                <div>
                  <strong>No saved attendance yet</strong>
                  <small>Save this session to create an audit row.</small>
                </div>
              </article>
            )}
          </div>
        </section>
      </aside>
    </div>
  );
}

function SchedulingWorkflow({ role, state, refresh }: WorkflowProps) {
  const [viewMode, setViewMode] = useState<"day" | "week" | "month">("week");
  const [title, setTitle] = useState("Arabic L3 review session");
  const [date, setDate] = useState("2026-07-02");
  const [starts, setStarts] = useState("09:00");
  const [ends, setEnds] = useState("10:30");
  const [type, setType] = useState<CalendarEventType>("live_session");
  const actorId = getDemoUser(role).id;
  const branchUser = state.users.find(user => user.id === actorId);
  const roleRuns = state.courseRuns.filter(run => {
    if (role === "teacher") return run.teacherId === actorId;
    if (role === "branchadmin") return run.branchId === branchUser?.branchId;
    return true;
  });
  const roleRunIds = new Set(roleRuns.map(run => run.id));
  const classOptions = state.classGroups.filter(group => roleRunIds.has(group.courseRunId));
  const branchIds = new Set(roleRuns.map(run => run.branchId));
  const roomOptions = state.rooms.filter(room => !branchIds.size || branchIds.has(room.branchId));
  const [roomId, setRoomId] = useState(roomOptions[0]?.id ?? "");
  const [classGroupId, setClassGroupId] = useState(classOptions[0]?.id ?? "");
  const [lastConflict, setLastConflict] = useState<string | null>(null);
  const invalidEvent =
    !title.trim() || !date || !starts || !ends || starts >= ends || !roomId;
  const selectedRoom = state.rooms.find(room => room.id === roomId);
  const selectedClass = state.classGroups.find(group => group.id === classGroupId);
  const selectedRun = state.courseRuns.find(run => run.id === selectedClass?.courseRunId);
  const roomEvents = state.events.filter(
    event =>
      event.roomId === roomId || (classGroupId && event.classGroupId === classGroupId)
  );
  const scopedEvents = state.events.filter(event => {
    if (role === "teacher") return event.ownerId === actorId || (event.classGroupId ? classOptions.some(group => group.id === event.classGroupId) : false);
    if (role === "branchadmin") return event.branchId === branchUser?.branchId || (event.classGroupId ? classOptions.some(group => group.id === event.classGroupId) : false);
    return true;
  });

  useEffect(() => {
    if (!roomId || !roomOptions.some(room => room.id === roomId)) {
      setRoomId(roomOptions[0]?.id ?? "");
    }
    if (!classGroupId || !classOptions.some(group => group.id === classGroupId)) {
      setClassGroupId(classOptions[0]?.id ?? "");
    }
  }, [roomId, classGroupId, roomOptions, classOptions]);

  return (
    <div className="platform-workflow-layout">
      <div className="platform-workflow-main">
        <section className="platform-workflow-card">
          <div className="platform-workflow-title">
            <span>
              <CalendarDays size={16} /> Scheduling engine
            </span>
            <strong>Create event</strong>
          </div>
          <div className="platform-segmented" aria-label="Calendar view">
            {(["day", "week", "month"] as const).map(mode => (
              <button
                key={mode}
                className={viewMode === mode ? "active" : ""}
                onClick={() => setViewMode(mode)}
              >
                {mode}
              </button>
            ))}
          </div>
          <div className="platform-inline-form grid">
            <label>
              Title
              <input
                value={title}
                onChange={event => setTitle(event.target.value)}
              />
            </label>
            <label>
              Type
              <select
                value={type}
                onChange={event =>
                  setType(event.target.value as CalendarEventType)
                }
              >
                <option value="live_session">Live session</option>
                <option value="placement_test">Placement test</option>
                <option value="assignment_due">Assignment due</option>
                <option value="room_booking">Room booking</option>
              </select>
            </label>
            <label>
              Date
              <input
                type="date"
                value={date}
                onChange={event => setDate(event.target.value)}
              />
            </label>
            <label>
              Starts
              <input
                type="time"
                value={starts}
                onChange={event => setStarts(event.target.value)}
              />
            </label>
            <label>
              Ends
              <input
                type="time"
                value={ends}
                onChange={event => setEnds(event.target.value)}
              />
            </label>
            <label>
              Room
              <select
                value={roomId}
                onChange={event => setRoomId(event.target.value)}
              >
                {roomOptions.map(room => (
                  <option key={room.id} value={room.id}>
                    {room.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Class
              <select
                value={classGroupId}
                onChange={event => setClassGroupId(event.target.value)}
              >
                {classOptions.length ? (
                  classOptions.map(group => (
                    <option key={group.id} value={group.id}>
                      {group.name}
                    </option>
                  ))
                ) : (
                  <option value="">General event</option>
                )}
              </select>
            </label>
          </div>
          {lastConflict ? (
            <p className="platform-form-error">{lastConflict}</p>
          ) : null}
          <div className="platform-conflict-panel">
            <strong>Conflict preview</strong>
            <span>{selectedRoom?.name ?? "No room selected"}</span>
            {roomEvents.length ? (
              roomEvents
                .slice(0, viewMode === "day" ? 2 : viewMode === "week" ? 4 : 6)
                .map(event => (
                  <small key={event.id}>
                    {event.title} ·{" "}
                    {new Date(event.startsAt).toLocaleDateString()} ·{" "}
                    {event.status}
                  </small>
                ))
            ) : (
              <small>No room or class conflicts in the local calendar.</small>
            )}
          </div>
          <button
            className="platform-primary-button"
            style={{ background: roleMeta[role].color }}
            disabled={invalidEvent}
            onClick={() => {
              const result = platformStore.createCalendarEvent(
                {
                  title,
                  type,
                  startsAt: `${date}T${starts}:00+03:00`,
                  endsAt: `${date}T${ends}:00+03:00`,
                  ownerId: actorId,
                  branchId: selectedRun?.branchId ?? selectedRoom?.branchId,
                  roomId,
                  classGroupId: classGroupId || undefined,
                },
                actorId
              );
              setLastConflict(
                result.conflicts.length
                  ? `${result.conflicts.length} conflict(s) detected. Event saved as pending.`
                  : null
              );
              refresh();
              toast.success(
                result.conflicts.length
                  ? "Event saved with conflict"
                  : "Event scheduled"
              );
            }}
          >
            Create event
          </button>
        </section>
        <EventList
          state={state}
          events={scopedEvents}
          limit={viewMode === "day" ? 3 : viewMode === "week" ? 5 : 8}
        />
      </div>
      <aside className="platform-workflow-side">
        <MiniMetric label="Events" value={String(state.events.length)} />
        <MiniMetric label="Rooms" value={String(state.rooms.length)} />
        <MiniMetric
          label="Availability blocks"
          value={String(state.teacherAvailability.length)}
        />
        <section className="platform-workflow-card">
          <div className="platform-workflow-title">
            <span>
              <CalendarDays size={16} /> Recurring rules
            </span>
            <strong>Mock mode</strong>
          </div>
          <p>
            Recurring schedules and external calendar sync stay disabled until a
            server scheduler is connected.
          </p>
          <button disabled>Enable recurrence</button>
        </section>
      </aside>
    </div>
  );
}

function CertificateWorkflow({ role, state, refresh }: WorkflowProps) {
  const [selectedId, setSelectedId] = useState(state.certificates[0]?.id ?? "");
  const selected =
    state.certificates.find(certificate => certificate.id === selectedId) ??
    state.certificates[0];
  const selectedStudent = state.students.find(
    student => student.id === selected?.studentId
  );
  const selectedUser = state.users.find(
    user => user.id === selectedStudent?.userId
  );
  const selectedCourse = state.courses.find(
    course => course.id === selected?.courseId
  );
  const [verificationCode, setVerificationCode] = useState(
    selected?.verificationCode ?? ""
  );
  const verification = platformStore.verifyCertificate(verificationCode);

  return (
    <div className="platform-workflow-layout">
      <div className="platform-workflow-main">
        <section className="platform-workflow-card">
          <div className="platform-workflow-title">
            <span>
              <Award size={16} /> Certificate workflow
            </span>
            <strong>Approval queue</strong>
          </div>
          <div className="platform-row-list">
            {state.certificates.map(certificate =>
              (() => {
                const approved =
                  certificate.status === "approved" ||
                  certificate.status === "issued";
                const issued = certificate.status === "issued";
                return (
                  <article
                    key={certificate.id}
                    className={
                      selected?.id === certificate.id ? "selected" : ""
                    }
                  >
                    <div>
                      <strong>{certificate.verificationCode}</strong>
                      <small>
                        Grade {certificate.grade}% · Attendance{" "}
                        {certificate.attendanceRate}% · {certificate.status}
                      </small>
                    </div>
                    <div className="platform-row-actions">
                      <button
                        onClick={() => {
                          setSelectedId(certificate.id);
                          setVerificationCode(certificate.verificationCode);
                        }}
                      >
                        Preview
                      </button>
                      <button
                        disabled={approved}
                        onClick={() => {
                          platformStore.approveCertificate(
                            certificate.id,
                            getDemoUser(role).id
                          );
                          refresh();
                          toast.success("Certificate approved");
                        }}
                      >
                        {approved ? "Approved" : "Approve"}
                      </button>
                      <button
                        disabled={issued}
                        onClick={() => {
                          platformStore.issueCertificate(
                            certificate.id,
                            getDemoUser(role).id
                          );
                          refresh();
                          toast.success("Certificate issued");
                        }}
                      >
                        {issued ? "Issued" : "Issue"}
                      </button>
                    </div>
                  </article>
                );
              })()
            )}
          </div>
        </section>
        {selected ? (
          <section className="platform-certificate-preview">
            <div>
              <span>Nile Learn Certificate</span>
              <strong>{selectedUser?.name ?? "Student"}</strong>
              <p>
                {selectedCourse?.title ?? "Course"} · Grade {selected.grade}% ·
                Attendance {selected.attendanceRate}%
              </p>
              <em>{selected.verificationCode}</em>
            </div>
            <button onClick={() => window.print()}>
              <Download size={15} />
              Print preview
            </button>
          </section>
        ) : null}
      </div>
      <aside className="platform-workflow-side">
        <MiniMetric
          label="Pending"
          value={String(
            state.certificates.filter(
              item => item.status === "pending_approval"
            ).length
          )}
        />
        <MiniMetric
          label="Approved"
          value={String(
            state.certificates.filter(item => item.status === "approved").length
          )}
        />
        <MiniMetric
          label="Issued"
          value={String(
            state.certificates.filter(item => item.status === "issued").length
          )}
        />
        <section className="platform-workflow-card">
          <div className="platform-workflow-title">
            <span>
              <ShieldCheck size={16} /> Verify code
            </span>
            <strong>Local lookup</strong>
          </div>
          <div className="platform-inline-form">
            <label>
              Verification code
              <input
                value={verificationCode}
                onChange={event => setVerificationCode(event.target.value)}
              />
            </label>
          </div>
          <div
            className={`platform-verification-result ${verification ? "valid" : "missing"}`}
          >
            <strong>
              {verification ? "Certificate found" : "No local match"}
            </strong>
            <small>
              {verification
                ? `${verification.user?.name ?? "Student"} · ${verification.course?.title ?? "Course"}`
                : "Check the code or issue the certificate first."}
            </small>
          </div>
        </section>
      </aside>
    </div>
  );
}

function QuranWorkflow({ role, state, refresh }: WorkflowProps) {
  const progress = state.quranProgress[0];
  const submission = state.recitationSubmissions[0];
  const [memorized, setMemorized] = useState(progress?.memorizedPercent ?? 0);
  const [tajweed, setTajweed] = useState(progress?.tajweedScore ?? 0);
  const [feedback, setFeedback] = useState(
    "Madd timing improved. Continue daily revision."
  );
  const [mistakes, setMistakes] = useState<string[]>(["Madd timing"]);
  const mistakeOptions = [
    "Madd timing",
    "Makharij",
    "Ghunnah",
    "Stopping",
    "Revision gap",
  ];
  const waveform = [34, 62, 45, 78, 52, 88, 41, 64, 36, 70, 58, 46];

  return (
    <div className="platform-workflow-layout">
      <div className="platform-workflow-main">
        <section className="platform-workflow-card">
          <div className="platform-workflow-title">
            <span>
              <Headphones size={16} /> Quran progress
            </span>
            <strong>{progress?.surah}</strong>
          </div>
          <div className="platform-inline-form grid">
            <label>
              Memorized %
              <input
                type="number"
                value={memorized}
                onChange={event => setMemorized(Number(event.target.value))}
              />
            </label>
            <label>
              Tajweed score
              <input
                type="number"
                value={tajweed}
                onChange={event => setTajweed(Number(event.target.value))}
              />
            </label>
          </div>
          <textarea
            value={feedback}
            onChange={event => setFeedback(event.target.value)}
          />
          <div
            className="platform-waveform"
            aria-label="Recitation waveform placeholder"
          >
            {waveform.map((height, index) => (
              <span
                key={index}
                style={{
                  height: `${height}%`,
                  background: roleMeta[role].color,
                }}
              />
            ))}
          </div>
          <div className="platform-tag-grid" aria-label="Tajweed mistake tags">
            {mistakeOptions.map(mistake => (
              <button
                key={mistake}
                className={mistakes.includes(mistake) ? "active" : ""}
                onClick={() => {
                  setMistakes(current =>
                    current.includes(mistake)
                      ? current.filter(item => item !== mistake)
                      : [...current, mistake]
                  );
                }}
              >
                {mistake}
              </button>
            ))}
          </div>
          <div className="platform-action-grid">
            <button
              disabled={!progress}
              onClick={() => {
                platformStore.updateQuranProgress(
                  progress.id,
                  memorized,
                  tajweed,
                  feedback,
                  getDemoUser(role).id
                );
                refresh();
                toast.success("Quran progress updated");
              }}
            >
              Update progress
            </button>
            <button
              disabled={!submission || submission.status === "approved"}
              onClick={() => {
                platformStore.reviewRecitation(
                  submission.id,
                  feedback,
                  getDemoUser(role).id
                );
                refresh();
                toast.success("Recitation reviewed");
              }}
            >
              {submission?.status === "approved"
                ? "Reviewed"
                : "Review recitation"}
            </button>
          </div>
        </section>
      </div>
      <aside className="platform-workflow-side">
        <MiniMetric
          label="Plan"
          value={state.quranPlans[0]?.target ?? "No plan"}
        />
        <MiniMetric
          label="Current Juz"
          value={state.quranPlans[0]?.currentJuz ?? "-"}
        />
        <MiniMetric
          label="Recitations"
          value={String(state.recitationSubmissions.length)}
        />
        <section className="platform-workflow-card">
          <div className="platform-workflow-title">
            <span>
              <Headphones size={16} /> Audio storage
            </span>
            <strong>Not connected</strong>
          </div>
          <p>
            Review tools are ready locally. Upload and playback require the
            future storage provider.
          </p>
          <button disabled>Upload audio</button>
        </section>
      </aside>
    </div>
  );
}

function MessageWorkflow({ role, state, refresh }: WorkflowProps) {
  const actorId = getDemoUser(role).id;
  const teacherRunIds = new Set(
    state.courseRuns
      .filter(run => run.teacherId === actorId)
      .map(run => run.id)
  );
  const teacherStudentIds = new Set(
    state.classGroups
      .filter(group => teacherRunIds.has(group.courseRunId))
      .flatMap(group => group.studentIds)
  );
  const branchUser = state.users.find(user => user.id === actorId);
  const branchRecipients = state.users.filter(
    user => user.branchId === branchUser?.branchId && user.id !== actorId
  );
  const recipientOptions =
    role === "teacher"
      ? state.users.filter(user =>
          state.students.some(
            student => student.userId === user.id && teacherStudentIds.has(student.id)
          )
        )
      : role === "registrar"
        ? state.users.filter(user =>
            ["student", "branchadmin", "headofdepartment", "superadmin"].includes(user.activeRole)
          )
        : role === "branchadmin"
          ? branchRecipients
          : role === "headofdepartment"
            ? state.users.filter(user => ["teacher", "student", "superadmin"].includes(user.activeRole))
            : state.users.filter(user => user.id !== actorId);
  const [toUserId, setToUserId] = useState(recipientOptions[0]?.id ?? "usr_student_demo");
  const [subject, setSubject] = useState("Class update");
  const [body, setBody] = useState("Your next Nile Learn update is ready.");
  const recipientIds = new Set([actorId, ...recipientOptions.map(user => user.id)]);
  const scopedMessages =
    role === "superadmin"
      ? state.messages
      : state.messages.filter(
          message =>
            recipientIds.has(message.fromUserId) || recipientIds.has(message.toUserId)
        );

  useEffect(() => {
    if (recipientOptions.length && !recipientOptions.some(user => user.id === toUserId)) {
      setToUserId(recipientOptions[0].id);
    }
  }, [recipientOptions, toUserId]);

  return (
    <div className="platform-workflow-layout">
      <div className="platform-workflow-main">
        <section className="platform-workflow-card">
          <div className="platform-workflow-title">
            <span>
              <MessageSquare size={16} /> Communication center
            </span>
            <strong>Compose and log</strong>
          </div>
          <div className="platform-inline-form grid">
            <label>
              Recipient
              <select
                value={toUserId}
                onChange={event => setToUserId(event.target.value)}
              >
                {recipientOptions.map(user => (
                  <option key={user.id} value={user.id}>
                    {user.name} · {roleMeta[user.activeRole].label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Subject
              <input
                value={subject}
                onChange={event => setSubject(event.target.value)}
              />
            </label>
          </div>
          <textarea
            value={body}
            onChange={event => setBody(event.target.value)}
          />
          <button
            className="platform-primary-button"
            style={{ background: roleMeta[role].color }}
            disabled={!subject.trim() || !body.trim() || !toUserId}
            onClick={() => {
              platformStore.sendMessage({
                fromUserId: actorId,
                toUserId,
                subject,
                body,
              });
              refresh();
              toast.success("Message sent and logged");
            }}
          >
            <Send size={15} />
            Send message
          </button>
        </section>
        <MessageList state={state} messages={scopedMessages} />
      </div>
      <aside className="platform-workflow-side">
        <MiniMetric label="Messages" value={String(scopedMessages.length)} />
        <MiniMetric
          label="Logs"
          value={String(
            state.communicationLogs.filter(
              log => role === "superadmin" || log.actorId === actorId || (log.relatedUserId ? recipientIds.has(log.relatedUserId) : false)
            ).length
          )}
        />
        <MiniMetric
          label="Templates"
          value={String(state.messageTemplates.length)}
        />
      </aside>
    </div>
  );
}

function FinanceWorkflow({ role, state, refresh }: WorkflowProps) {
  return (
    <div className="platform-workflow-layout">
      <div className="platform-workflow-main">
        <section className="platform-workflow-card">
          <div className="platform-workflow-title">
            <span>
              <CreditCard size={16} /> Finance workflow
            </span>
            <strong>Invoices and payments</strong>
          </div>
          <div className="platform-row-list">
            {state.invoices.map(invoice => {
              const paid = state.payments
                .filter(
                  payment =>
                    payment.invoiceId === invoice.id &&
                    payment.status === "paid"
                )
                .reduce((sum, payment) => sum + payment.amount, 0);
              return (
                <article key={invoice.id}>
                  <div>
                    <strong>{invoice.id}</strong>
                    <small>
                      {invoice.currency} {invoice.amount} · paid {paid} · due{" "}
                      {invoice.dueAt}
                    </small>
                  </div>
                  <div className="platform-row-actions">
                    <span>{invoice.status}</span>
                    <button
                      disabled={invoice.status === "paid"}
                      onClick={() => {
                        platformStore.recordPayment(
                          invoice.id,
                          getDemoUser(role).id
                        );
                        refresh();
                        toast.success("Payment recorded");
                      }}
                    >
                      {invoice.status === "paid" ? "Paid" : "Record payment"}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </div>
      <aside className="platform-workflow-side">
        <MiniMetric label="Packages" value={String(state.packages.length)} />
        <MiniMetric label="Discounts" value={String(state.discounts.length)} />
        <MiniMetric
          label="Paid records"
          value={String(
            state.payments.filter(payment => payment.status === "paid").length
          )}
        />
      </aside>
    </div>
  );
}

function AdmissionsWorkflow({ role, state, refresh }: WorkflowProps) {
  const [recommendedLevel, setRecommendedLevel] = useState("Arabic Level 2");
  const [score, setScore] = useState(78);

  return (
    <div className="platform-workflow-layout">
      <div className="platform-workflow-main">
        <section className="platform-workflow-card">
          <div className="platform-workflow-title">
            <span>
              <UserPlus size={16} /> Admissions pipeline
            </span>
            <strong>Lead to enrollment</strong>
          </div>
          <div className="platform-row-list">
            {state.leads.slice(0, 5).map(lead =>
              (() => {
                const converted = state.applications.some(
                  application => application.leadId === lead.id
                );
                return (
                  <article key={lead.id}>
                    <div>
                      <strong>{lead.fullName}</strong>
                      <small>
                        {lead.subject} · {lead.source} · {lead.status}
                      </small>
                    </div>
                    <button
                      disabled={converted}
                      onClick={() => {
                        platformStore.convertLeadToApplication(
                          lead.id,
                          getDemoUser(role).id
                        );
                        refresh();
                        toast.success("Lead converted to application");
                      }}
                    >
                      {converted ? "Converted" : "Convert"}
                    </button>
                  </article>
                );
              })()
            )}
          </div>
        </section>
        <section className="platform-workflow-card">
          <div className="platform-workflow-title">
            <span>
              <FileText size={16} /> Placement result
            </span>
            <strong>{state.placementTests[0]?.fullName}</strong>
          </div>
          <div className="platform-inline-form grid">
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
                value={score}
                onChange={event => setScore(Number(event.target.value))}
              />
            </label>
          </div>
          <button
            disabled={
              !state.placementTests[0] ||
              state.placementTests[0].status === "completed"
            }
            onClick={() => {
              platformStore.recordPlacementResult(
                state.placementTests[0].id,
                recommendedLevel,
                score,
                "Recorded from registrar workflow.",
                getDemoUser(role).id
              );
              refresh();
              toast.success("Placement result recorded");
            }}
          >
            {state.placementTests[0]?.status === "completed"
              ? "Result recorded"
              : "Record placement result"}
          </button>
        </section>
      </div>
      <aside className="platform-workflow-side">
        <MiniMetric label="Leads" value={String(state.leads.length)} />
        <MiniMetric
          label="Applications"
          value={String(state.applications.length)}
        />
        <MiniMetric
          label="Ready workflows"
          value={String(
            state.enrollmentWorkflows.filter(
              item => item.status === "ready_to_enroll"
            ).length
          )}
        />
      </aside>
    </div>
  );
}

function ReportsWorkflow({
  role,
  state,
  pageId,
}: Omit<WorkflowProps, "refresh"> & { pageId: string }) {
  const [reportType, setReportType] = useState<keyof typeof reportLabels>(
    pageId === "audit-logs"
      ? "audit"
      : pageId === "system-health"
        ? "audit"
        : "enrollments"
  );
  const [savedPresets, setSavedPresets] = useState<string[]>([
    "Executive weekly",
    "Branch operations",
  ]);
  const actorId = getDemoUser(role).id;
  const teacherRunIds = new Set(
    state.courseRuns
      .filter(run => run.teacherId === actorId)
      .map(run => run.id)
  );
  const teacherClassIds = new Set(
    state.classGroups
      .filter(group => teacherRunIds.has(group.courseRunId))
      .map(group => group.id)
  );
  const branchUser = state.users.find(user => user.id === actorId);
  const branchStudentIds = new Set(
    state.students
      .filter(student =>
        state.users.some(
          user => user.id === student.userId && user.branchId === branchUser?.branchId
        )
      )
      .map(student => student.id)
  );
  const baseRows = platformStore.exportReportRows(reportType);
  const rows = baseRows.filter(row => {
    if (role === "superadmin") return true;
    if (role === "teacher") {
      if ("courseRunId" in row) return teacherRunIds.has(String(row.courseRunId));
      if ("classGroupId" in row) return teacherClassIds.has(String(row.classGroupId));
      if ("actorId" in row) return row.actorId === actorId;
      return false;
    }
    if (role === "registrar") {
      if ("studentId" in row) return true;
      if ("actorId" in row) return /lead|application|placement|payment|enrollment|message/.test(String(row.action ?? ""));
      return true;
    }
    if (role === "branchadmin") {
      if ("studentId" in row) return branchStudentIds.has(String(row.studentId));
      if ("actorId" in row) return row.actorId === actorId;
      return false;
    }
    if ("actorId" in row) return row.actorId === actorId;
    return true;
  });
  const bars = [
    rows.filter(row => "courseRunId" in row || "studentId" in row).length * 30,
    rows.filter(row => "classGroupId" in row && row.status === "present").length * 45,
    state.assignmentSubmissions.filter(item => role !== "teacher" || teacherRunIds.has(state.assignments.find(assignment => assignment.id === item.assignmentId)?.courseRunId ?? "")).length * 35,
    state.quizAttempts.filter(item => role !== "teacher" || teacherRunIds.has(state.quizzes.find(quiz => quiz.id === item.quizId)?.courseRunId ?? "")).length * 30,
    rows.filter(row => "balance" in row && row.status === "paid").length * 45,
    rows.filter(row => "actorId" in row).length * 6,
  ].map(value => Math.min(96, Math.max(18, value)));
  const exportCsv = () => {
    const csv = platformStore.buildCsv(rows);
    if (!csv) {
      toast.info("No rows to export");
      return;
    }
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `nile-${reportType}-report.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exported locally", {
      description: `${rows.length} row(s)`,
    });
  };

  return (
    <div className="platform-workflow-layout">
      <div className="platform-workflow-main">
        <section className="platform-workflow-card">
          <div className="platform-workflow-title">
            <span>
              <Activity size={16} /> Reports
            </span>
            <strong>Live local metrics</strong>
          </div>
          <div className="platform-report-controls">
            <label>
              Report type
              <select
                value={reportType}
                onChange={event =>
                  setReportType(event.target.value as keyof typeof reportLabels)
                }
              >
                {Object.entries(reportLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <button
              onClick={() => {
                const label = `${reportLabels[reportType]} snapshot ${savedPresets.length + 1}`;
                setSavedPresets(current => [label, ...current].slice(0, 5));
                toast.success("Preset saved locally", { description: label });
              }}
            >
              Save preset
            </button>
            <button onClick={exportCsv}>
              <Download size={15} />
              Export CSV
            </button>
          </div>
          <div className="platform-chart-bars">
            {bars.map((bar, index) => (
              <div key={index}>
                <span
                  style={{
                    height: `${bar}%`,
                    background:
                      index % 2 ? roleMeta[role].accent : roleMeta[role].color,
                  }}
                />
                <small>
                  {
                    ["Enroll", "Attend", "Submit", "Quiz", "Paid", "Audit"][
                      index
                    ]
                  }
                </small>
              </div>
            ))}
          </div>
        </section>
        <section className="platform-workflow-card">
          <div className="platform-workflow-title">
            <span>
              <FileText size={16} /> Result rows
            </span>
            <strong>{reportLabels[reportType]} report</strong>
          </div>
          <div className="platform-report-table">
            {rows.slice(0, 6).map((row, index) => (
              <article key={`${reportType}_${index}`}>
                {Object.entries(row)
                  .slice(0, 4)
                  .map(([key, value]) => (
                    <span key={key}>
                      <strong>{key}</strong>
                      {String(value)}
                    </span>
                  ))}
              </article>
            ))}
          </div>
        </section>
        <WorkflowAudit state={state} />
      </div>
      <aside className="platform-workflow-side">
        <MiniMetric label="Rows" value={String(rows.length)} />
        <MiniMetric label="Courses" value={String(role === "teacher" ? teacherRunIds.size : state.courses.length)} />
        <MiniMetric label="Audit rows" value={String(rows.filter(row => "actorId" in row).length)} />
        <MiniMetric
          label="Integrations"
          value={String(state.integrations.length)}
        />
        <section className="platform-workflow-card">
          <div className="platform-workflow-title">
            <span>
              <ShieldCheck size={16} /> Saved views
            </span>
            <strong>{savedPresets.length} presets</strong>
          </div>
          <div className="platform-row-list compact">
            {savedPresets.map(preset => (
              <article key={preset}>
                <div>
                  <strong>{preset}</strong>
                  <small>Stored in this browser session</small>
                </div>
              </article>
            ))}
          </div>
        </section>
      </aside>
    </div>
  );
}

function IntegrationsWorkflow({ role, state }: WorkflowProps) {
  const integrations = useMemo(
    () => withRuntimeIntegrationStatus(state.integrations),
    [state.integrations]
  );
  const [activeId, setActiveId] = useState(integrations[0]?.id ?? "");
  const [lastCheck, setLastCheck] = useState<Record<string, string>>({});
  const active =
    integrations.find(integration => integration.id === activeId) ??
    integrations[0];

  const runLocalCheck = async () => {
    if (!active) return;

    const stamp = new Date().toLocaleTimeString();
    setLastCheck(current => ({ ...current, [active.id]: stamp }));

    if (active.id !== "supabase") {
      toast.success("Local integration check recorded", {
        description: `${active.label} remains in ${active.status.replace("_", " ")}.`,
      });
      return;
    }

    try {
      const result = await checkSupabaseBrowserConnection();
      const description = `REST status ${result.status}${result.projectRef ? ` · ${result.projectRef}` : ""} · ${result.keyMode} key`;
      if (result.ok) {
        toast.success("Supabase browser check passed", { description });
      } else {
        toast.error("Supabase responded but did not pass", { description });
      }
    } catch (error) {
      toast.error("Supabase browser check unavailable", {
        description:
          error instanceof Error
            ? error.message
            : "Check VITE_SUPABASE_URL and browser-safe key env vars.",
      });
    }
  };

  return (
    <div className="platform-workflow-layout">
      <div className="platform-workflow-main">
        <section className="platform-workflow-card">
          <div className="platform-workflow-title">
            <span>
              <Activity size={16} /> Provider registry
            </span>
            <strong>Connector readiness</strong>
          </div>
          <div className="platform-integration-grid">
            {integrations.map(integration => (
              <button
                key={integration.id}
                className={activeId === integration.id ? "active" : ""}
                onClick={() => setActiveId(integration.id)}
              >
                <strong>{integration.label}</strong>
                <span
                  className={`platform-integration-status ${integration.status === "connected" ? "green" : integration.status === "mock_mode" ? "amber" : integration.status === "error" ? "red" : "slate"}`}
                >
                  {integration.status.replace("_", " ")}
                </span>
                <small>
                  {integration.serverOnly
                    ? "Server-only secrets"
                    : "Client visible"}
                </small>
              </button>
            ))}
          </div>
        </section>
        {active ? (
          <section className="platform-workflow-card">
            <div className="platform-workflow-title">
              <span>
                <ShieldCheck size={16} /> Setup details
              </span>
              <strong>{active.label}</strong>
            </div>
            <p>{active.notes}</p>
            <div className="platform-env-list">
              {active.envVars.map(envVar => (
                <code key={envVar}>{envVar}</code>
              ))}
            </div>
            <div className="platform-action-grid">
              <button onClick={runLocalCheck}>Run local check</button>
              <button disabled={active.status !== "connected"}>
                Start sync
              </button>
            </div>
          </section>
        ) : null}
      </div>
      <aside className="platform-workflow-side">
        <MiniMetric label="Providers" value={String(integrations.length)} />
        <MiniMetric
          label="Mock mode"
          value={String(
            integrations.filter(item => item.status === "mock_mode").length
          )}
        />
        <MiniMetric
          label="Connected"
          value={String(
            integrations.filter(item => item.status === "connected").length
          )}
        />
        <section className="platform-workflow-card">
          <div className="platform-workflow-title">
            <span>
              <FileText size={16} /> Check log
            </span>
            <strong>Local only</strong>
          </div>
          <div className="platform-row-list compact">
            {Object.entries(lastCheck).length ? (
              Object.entries(lastCheck).map(([id, stamp]) => (
                <article key={id}>
                  <div>
                    <strong>
                      {integrations.find(item => item.id === id)?.label ?? id}
                    </strong>
                    <small>Checked at {stamp}</small>
                  </div>
                </article>
              ))
            ) : (
              <article>
                <div>
                  <strong>No checks yet</strong>
                  <small>Run a local check from any provider.</small>
                </div>
              </article>
            )}
          </div>
          <p style={{ borderTop: "1px solid var(--border)", paddingTop: 10 }}>
            Real sync jobs stay disabled until server-side credentials and
            queues are connected.
          </p>
        </section>
      </aside>
    </div>
  );
}

function EventList({
  state,
  events = state.events,
  limit = 5,
}: {
  state: WorkflowProps["state"];
  events?: WorkflowProps["state"]["events"];
  limit?: number;
}) {
  return (
    <section className="platform-workflow-card">
      <div className="platform-workflow-title">
        <span>
          <CalendarDays size={16} /> Calendar
        </span>
        <strong>Upcoming events</strong>
      </div>
      <div className="platform-row-list">
        {events.slice(0, limit).map(event => (
          <article key={event.id}>
            <div>
              <strong>{event.title}</strong>
              <small>
                {event.type} · {new Date(event.startsAt).toLocaleString()}
              </small>
            </div>
            <span>{event.status}</span>
          </article>
        ))}
      </div>
    </section>
  );
}

function MessageList({
  state,
  messages = state.messages,
}: {
  state: WorkflowProps["state"];
  messages?: WorkflowProps["state"]["messages"];
}) {
  return (
    <section className="platform-workflow-card">
      <div className="platform-workflow-title">
        <span>
          <MessageSquare size={16} /> Threads
        </span>
        <strong>Recent messages</strong>
      </div>
      <div className="platform-row-list">
        {messages.slice(0, 5).map(message => (
          <article key={message.id}>
            <div>
              <strong>{message.subject}</strong>
              <small>{message.body}</small>
            </div>
            <span>{message.read ? "read" : "unread"}</span>
          </article>
        ))}
      </div>
    </section>
  );
}

function WorkflowAudit({ state }: { state: WorkflowProps["state"] }) {
  return (
    <section className="platform-workflow-card">
      <div className="platform-workflow-title">
        <span>
          <ShieldCheck size={16} /> Audit trail
        </span>
        <strong>Latest activity</strong>
      </div>
      <div className="platform-row-list compact">
        {state.auditLogs.slice(0, 4).map(audit => (
          <article key={audit.id}>
            <div>
              <strong>{audit.action}</strong>
              <small>{audit.summary}</small>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <article className="platform-mini-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}
