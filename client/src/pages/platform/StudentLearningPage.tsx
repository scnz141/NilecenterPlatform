import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  Captions,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  FileText,
  Headphones,
  MapPin,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  Radio,
  SkipBack,
  SkipForward,
  Video,
  Volume2,
  VolumeX,
} from "lucide-react";
import { toast } from "sonner";
import { Link } from "wouter";
import PlatformShell from "@/components/platform/PlatformShell";
import { WorkspaceLayout } from "@/components/platform/PlatformLayouts";
import {
  DataTableCard,
  StatusBadge,
} from "@/components/platform/PlatformPrimitives";
import { fetchPlatformStateRequest } from "@/lib/backend/api";
import { platformStore } from "@/lib/domain/store";
import type {
  Lesson,
  LessonProgressStatus,
  LessonResource,
  PlatformState,
} from "@/lib/domain/types";
import { getDemoUser } from "@/lib/platformData";

const PLATFORM_STATE_UPDATED_EVENT = "nilelearn:platform-state-updated";

type StudentLearningMode = "course" | "lesson" | "live";

type StudentLearningPageProps = {
  mode: StudentLearningMode;
  courseId?: string;
  lessonId?: string;
};

type LearningOption = {
  enrollment: PlatformState["enrollments"][number];
  run: PlatformState["courseRuns"][number];
  course: PlatformState["courses"][number];
  classGroup?: PlatformState["classGroups"][number];
};

type LessonRow = {
  module: PlatformState["modules"][number];
  lesson: PlatformState["lessons"][number];
  progress?: PlatformState["lessonProgress"][number];
  resources: PlatformState["resources"];
};

function formatDate(value?: string) {
  if (!value) return "Not scheduled";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
  }).format(date);
}

function formatLiveDate(value?: string) {
  if (!value) return "Not scheduled";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(date);
}

function formatLiveTime(startsAt?: string, endsAt?: string) {
  if (!startsAt) return "Time to be confirmed";
  const start = new Date(startsAt);
  const end = endsAt ? new Date(endsAt) : undefined;
  if (Number.isNaN(start.getTime())) return startsAt;
  const formatter = new Intl.DateTimeFormat("en", {
    hour: "numeric",
    minute: "2-digit",
  });
  return end && !Number.isNaN(end.getTime())
    ? `${formatter.format(start)} - ${formatter.format(end)}`
    : formatter.format(start);
}

function readableStatus(value?: string) {
  if (!value) return "not started";
  return value.replace(/_/g, " ");
}

function statusTone(
  status?: string
): "green" | "amber" | "red" | "purple" | "slate" {
  if (!status) return "slate";
  if (["completed", "active", "issued", "present"].includes(status))
    return "green";
  if (["in_progress", "pending", "late", "draft"].includes(status))
    return "amber";
  if (["paused", "absent", "rejected", "revoked"].includes(status))
    return "red";
  return "slate";
}

function getStudentOptionData(state: PlatformState, courseId?: string) {
  const demoUser = getDemoUser("student");
  const student =
    state.students.find(item => item.userId === demoUser.id) ??
    state.students[0];
  const studentId = student?.id ?? "stu_demo";
  const options = state.enrollments
    .filter(enrollment => enrollment.studentId === studentId)
    .map(enrollment => {
      const run = state.courseRuns.find(
        item => item.id === enrollment.courseRunId
      );
      const course = state.courses.find(item => item.id === run?.courseId);
      const classGroup =
        state.classGroups.find(item => item.id === enrollment.classGroupId) ??
        state.classGroups.find(
          item =>
            item.courseRunId === run?.id &&
            item.studentIds.includes(enrollment.studentId)
        ) ??
        state.classGroups.find(item => item.courseRunId === run?.id);
      return run && course ? { enrollment, run, course, classGroup } : null;
    })
    .filter(Boolean) as LearningOption[];
  const selected =
    options.find(
      option =>
        courseId === option.course.id ||
        courseId === option.course.slug ||
        courseId === option.run.id
    ) ?? options[0];

  return { student, studentId, options, selected };
}

function getLessonRows(
  state: PlatformState,
  courseId?: string,
  studentId?: string,
  enrollmentId?: string
) {
  const modules = state.modules
    .filter(item => item.courseId === courseId)
    .sort((a, b) => a.order - b.order);
  return modules.flatMap(module =>
    state.lessons
      .filter(lesson => lesson.moduleId === module.id)
      .map(lesson => ({
        module,
        lesson,
        progress: state.lessonProgress.find(
          item =>
            item.lessonId === lesson.id &&
            item.studentId === studentId &&
            item.enrollmentId === enrollmentId
        ),
        resources: state.resources.filter(
          resource =>
            lesson.resourceIds.includes(resource.id) && resource.published
        ),
      }))
  );
}

function getLessonIcon(
  type: "video" | "live" | "reading" | "practice" | "assessment"
) {
  if (type === "video") return Video;
  if (type === "live") return Radio;
  if (type === "practice") return ClipboardCheck;
  if (type === "assessment") return ClipboardCheck;
  return BookOpen;
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <article className="platform-mini-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

export default function StudentLearningPage({
  mode,
  courseId,
  lessonId,
}: StudentLearningPageProps) {
  const [version, setVersion] = useState(0);
  const state = useMemo(() => platformStore.getState(), [version]);

  useEffect(() => {
    let cancelled = false;
    fetchPlatformStateRequest().then(result => {
      if (cancelled) return;
      if (result.ok && result.data) {
        platformStore.setState(result.data.state);
        setVersion(value => value + 1);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const syncLocalPlatformState = () => setVersion(value => value + 1);
    window.addEventListener(
      PLATFORM_STATE_UPDATED_EVENT,
      syncLocalPlatformState
    );
    return () => {
      window.removeEventListener(
        PLATFORM_STATE_UPDATED_EVENT,
        syncLocalPlatformState
      );
    };
  }, []);

  const { studentId, options, selected } = getStudentOptionData(
    state,
    courseId
  );
  const run = selected?.run;
  const course = selected?.course;
  const classGroup = selected?.classGroup;
  const branch = state.branches.find(item => item.id === run?.branchId);
  const meeting = state.meetingLinks.find(
    item => item.id === classGroup?.meetingLinkId
  );
  const lessonRows = getLessonRows(
    state,
    course?.id,
    studentId,
    selected?.enrollment.id
  );
  const completedLessons = lessonRows.filter(
    row => row.progress?.status === "completed"
  ).length;
  const lessonCompletion = lessonRows.length
    ? Math.round((completedLessons / lessonRows.length) * 100)
    : 0;
  const nextLessonRow =
    lessonRows.find(row => row.progress?.status !== "completed") ??
    lessonRows[0];
  const liveLessonRow = lessonRows.find(row => row.lesson.type === "live");
  const selectedLessonRow =
    mode === "live"
      ? liveLessonRow
      : (lessonRows.find(row => row.lesson.id === lessonId) ?? nextLessonRow);
  const selectedLesson = selectedLessonRow?.lesson;
  const classSessions = state.classSessions
    .filter(
      item =>
        item.classGroupId === classGroup?.id && item.status !== "cancelled"
    )
    .sort(
      (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()
    );
  const now = Date.now();
  const liveSession =
    classSessions.find(item => new Date(item.endsAt).getTime() >= now) ??
    [...classSessions].reverse()[0];
  const room = state.rooms.find(item => item.id === classGroup?.roomId);
  const completeSelectedLesson = () => {
    if (!selectedLesson) return;
    const lesson = platformStore.completeLesson(
      selectedLesson.id,
      studentId,
      getDemoUser("student").id,
      selected.enrollment.id
    );
    setVersion(value => value + 1);
    toast.success("Lesson marked complete", { description: lesson.title });
  };

  const startSelectedLesson = () => {
    if (!selectedLesson) return;
    const lesson = platformStore.startLesson(
      selectedLesson.id,
      studentId,
      getDemoUser("student").id,
      selected.enrollment.id
    );
    setVersion(value => value + 1);
    toast.success("Lesson opened", { description: lesson.title });
  };

  const joinLiveClass = () => {
    toast.success("Live class ready", {
      description:
        meeting?.url ?? "The live session link is not available in this demo.",
    });
  };

  if (!selected || !course || !run) {
    return (
      <PlatformShell role="student" title="Courses">
        <WorkspaceLayout
          className="student-learning-page"
          title="Courses"
          description="No active course enrollment is available."
          context="Student"
          main={
            <DataTableCard title="No active enrollment">
              <div className="platform-empty-state">
                <BookOpen size={18} />
                <strong>No course found</strong>
                <span>Ask the registrar to confirm your enrollment.</span>
              </div>
            </DataTableCard>
          }
        />
      </PlatformShell>
    );
  }

  const courseHref = `/app/student/courses/${course.id}`;
  const lessonNavigationRow =
    mode === "lesson" ? selectedLessonRow : nextLessonRow;
  const lessonHref = lessonNavigationRow
    ? `/app/student/courses/${course.id}/learn/${lessonNavigationRow.lesson.id}`
    : courseHref;
  const liveHref = `/app/student/courses/${course.id}/live`;
  const title =
    mode === "course"
      ? course.title
      : mode === "live"
        ? "Live class"
        : (selectedLesson?.title ?? "Lesson");
  const description =
    mode === "course"
      ? "Review the course path and continue the next lesson."
      : mode === "live"
        ? "Join the scheduled class and keep the course context nearby."
        : "Study one lesson and mark it complete when finished.";
  const action =
    mode === "course" ? (
      <Link className="platform-primary-button" href={lessonHref}>
        Continue lesson
        <ArrowRight size={15} />
      </Link>
    ) : mode === "live" ? (
      <button
        type="button"
        className="platform-primary-button"
        onClick={joinLiveClass}
      >
        <Radio size={15} />
        Join live
      </button>
    ) : (
      <button
        type="button"
        className="platform-primary-button"
        onClick={completeSelectedLesson}
        disabled={selectedLessonRow?.progress?.status === "completed"}
      >
        <CheckCircle2 size={15} />
        {selectedLessonRow?.progress?.status === "completed"
          ? "Completed"
          : "Mark complete"}
      </button>
    );

  return (
    <PlatformShell role="student" title={title}>
      <WorkspaceLayout
        className="student-learning-page"
        title={title}
        description={description}
        context="Student"
        actions={action}
        toolbar={
          <div className="student-learning-toolbar">
            {options.length > 1 ? (
              <label className="student-learning-course-select">
                <span>Course</span>
                <select
                  value={run.id}
                  onChange={event => {
                    const option = options.find(
                      item => item.run.id === event.target.value
                    );
                    if (option) {
                      window.history.pushState(
                        null,
                        "",
                        `/app/student/courses/${option.course.id}`
                      );
                      window.dispatchEvent(new PopStateEvent("popstate"));
                    }
                  }}
                >
                  {options.map(option => (
                    <option key={option.run.id} value={option.run.id}>
                      {option.course.title}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <nav className="portal-simple-tabs" aria-label="Learning sections">
              <Link
                href={courseHref}
                className={mode === "course" ? "active" : ""}
              >
                Overview
              </Link>
              <Link
                href={lessonHref}
                className={mode === "lesson" ? "active" : ""}
              >
                Lesson
              </Link>
              <Link href={liveHref} className={mode === "live" ? "active" : ""}>
                Live class
              </Link>
            </nav>
          </div>
        }
        main={
          mode === "course" ? (
            <CourseOverview
              course={course}
              run={run}
              classGroup={classGroup}
              branchName={branch?.name}
              lessonRows={lessonRows}
              lessonCompletion={lessonCompletion}
              completedLessons={completedLessons}
            />
          ) : mode === "live" ? (
            <LiveClassWorkspace
              course={course}
              classGroup={classGroup}
              branchName={branch?.name}
              roomName={room?.name}
              meeting={meeting}
              session={liveSession}
              nextLessonRow={nextLessonRow}
              lessonHref={lessonHref}
              joinLiveClass={joinLiveClass}
            />
          ) : (
            <LessonWorkspace
              mode={mode}
              lessonRow={selectedLessonRow}
              startSelectedLesson={startSelectedLesson}
              completeSelectedLesson={completeSelectedLesson}
              joinLiveClass={joinLiveClass}
            />
          )
        }
      />
    </PlatformShell>
  );
}

function LiveClassWorkspace({
  course,
  classGroup,
  branchName,
  roomName,
  meeting,
  session,
  nextLessonRow,
  lessonHref,
  joinLiveClass,
}: {
  course: PlatformState["courses"][number];
  classGroup?: PlatformState["classGroups"][number];
  branchName?: string;
  roomName?: string;
  meeting?: PlatformState["meetingLinks"][number];
  session?: PlatformState["classSessions"][number];
  nextLessonRow?: LessonRow;
  lessonHref: string;
  joinLiveClass: () => void;
}) {
  const liveReady = Boolean(meeting?.url && meeting.status === "active");

  return (
    <div className="student-learning-main student-live-main">
      <section className="student-live-workspace">
        <header className="student-live-heading">
          <div>
            <span>Next live class</span>
            <h2>{session?.title ?? classGroup?.name ?? "Live class"}</h2>
            <p>{course.title}</p>
          </div>
          <StatusBadge tone={liveReady ? "green" : "amber"}>
            {liveReady ? "Link ready" : "Link pending"}
          </StatusBadge>
        </header>

        <dl className="student-live-facts">
          <div>
            <CalendarDays size={17} aria-hidden="true" />
            <dt>Date</dt>
            <dd>{formatLiveDate(session?.startsAt)}</dd>
          </div>
          <div>
            <Clock3 size={17} aria-hidden="true" />
            <dt>Time</dt>
            <dd>
              {session
                ? formatLiveTime(session.startsAt, session.endsAt)
                : (classGroup?.schedule ?? "Time to be confirmed")}
            </dd>
          </div>
          <div>
            <MapPin size={17} aria-hidden="true" />
            <dt>Location</dt>
            <dd>
              {meeting
                ? `${meeting.provider === "mock" ? "Online classroom" : meeting.provider.replace(/_/g, " ")} · ${branchName ?? "Online"}`
                : (roomName ?? branchName ?? "To be confirmed")}
            </dd>
          </div>
        </dl>

        <div className="student-live-actions">
          <button
            type="button"
            className="platform-primary-button"
            onClick={joinLiveClass}
          >
            <Radio size={15} />
            Join live
          </button>
          <p>
            {liveReady
              ? "The class link is available for this enrolled group."
              : "The class link will appear after the school confirms the session."}
          </p>
        </div>
      </section>

      <section className="student-live-next-lesson">
        <div>
          <span>Course context</span>
          <h2>{nextLessonRow?.lesson.title ?? "No lesson scheduled"}</h2>
          <p>
            {nextLessonRow
              ? `${nextLessonRow.module.title} · ${nextLessonRow.lesson.durationMinutes} min`
              : "Your next lesson will appear when the course path is published."}
          </p>
        </div>
        {nextLessonRow ? (
          <Link className="platform-secondary-button" href={lessonHref}>
            Open next lesson
            <ArrowRight size={15} />
          </Link>
        ) : null}
      </section>
    </div>
  );
}

function CourseOverview({
  course,
  run,
  classGroup,
  branchName,
  lessonRows,
  lessonCompletion,
  completedLessons,
}: {
  course: PlatformState["courses"][number];
  run: PlatformState["courseRuns"][number];
  classGroup?: PlatformState["classGroups"][number];
  branchName?: string;
  lessonRows: LessonRow[];
  lessonCompletion: number;
  completedLessons: number;
}) {
  return (
    <div className="student-learning-main">
      <section className="student-course-hero-v3">
        <div className="student-course-overview-copy">
          <span>What you will learn</span>
          <p>{course.description}</p>
        </div>
        <div className="student-course-hero-progress">
          <div>
            <span>Course progress</span>
            <strong>{lessonCompletion}%</strong>
          </div>
          <i>
            <b style={{ width: `${lessonCompletion}%` }} />
          </i>
          <small>
            {completedLessons} of {lessonRows.length} lessons complete
          </small>
        </div>
        <dl className="student-course-hero-facts">
          <div>
            <dt>Class</dt>
            <dd>{classGroup?.name ?? "Assigned class"}</dd>
          </div>
          <div>
            <dt>Schedule</dt>
            <dd>{classGroup?.schedule ?? run.term}</dd>
          </div>
          <div>
            <dt>Branch</dt>
            <dd>{branchName ?? "Online"}</dd>
          </div>
        </dl>
      </section>

      <section className="student-course-map-v3">
        <div className="student-course-map-head">
          <div>
            <span>Course map</span>
            <h2>Learning path</h2>
          </div>
          <small>{lessonRows.length} lessons</small>
        </div>
        <div className="student-course-map-list">
          {lessonRows.map(row => {
            const Icon = getLessonIcon(row.lesson.type);
            return (
              <article key={row.lesson.id}>
                <span className="student-course-map-icon">
                  <Icon size={17} />
                </span>
                <div>
                  <strong>{row.lesson.title}</strong>
                  <span>
                    {row.module.title} · {row.lesson.durationMinutes} min
                  </span>
                </div>
                <StatusBadge tone={statusTone(row.progress?.status)}>
                  {readableStatus(row.progress?.status)}
                </StatusBadge>
                <Link
                  className="student-course-map-action"
                  href={`/app/student/courses/${course.id}/learn/${row.lesson.id}`}
                >
                  Open <ArrowRight size={14} />
                </Link>
              </article>
            );
          })}
          {!lessonRows.length ? (
            <div className="platform-empty-state">
              <strong>No lessons yet</strong>
              <span>This course does not have published lessons.</span>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function LessonWorkspace({
  mode,
  lessonRow,
  startSelectedLesson,
  completeSelectedLesson,
  joinLiveClass,
}: {
  mode: StudentLearningMode;
  lessonRow?: LessonRow;
  startSelectedLesson: () => void;
  completeSelectedLesson: () => void;
  joinLiveClass: () => void;
}) {
  const selectedLesson = lessonRow?.lesson;

  return (
    <div className="student-learning-main">
      <section className="learning-player-panel student-learning-player-card">
        <div className="learning-player-top">
          <span className="learning-lesson-type">
            {selectedLesson?.type ?? "lesson"}
          </span>
          <span>{readableStatus(lessonRow?.progress?.status)}</span>
        </div>
        <NileLessonPlayer
          lesson={selectedLesson}
          moduleTitle={lessonRow?.module.title}
          outcomes={lessonRow?.module.outcomes ?? []}
          resources={lessonRow?.resources ?? []}
          progressStatus={lessonRow?.progress?.status}
        />
        <div className="learning-player-actions">
          <button
            type="button"
            disabled={!selectedLesson}
            onClick={startSelectedLesson}
          >
            <Play size={15} />
            Start lesson
          </button>
          <button
            type="button"
            disabled={
              !selectedLesson || lessonRow?.progress?.status === "completed"
            }
            onClick={completeSelectedLesson}
          >
            <CheckCircle2 size={15} />
            {lessonRow?.progress?.status === "completed"
              ? "Completed"
              : "Mark complete"}
          </button>
          <button type="button" onClick={joinLiveClass}>
            <Radio size={15} />
            {mode === "live" ? "Join live" : "Live class"}
          </button>
        </div>
      </section>

      <section className="student-lesson-resources-v3">
        <div className="student-lesson-resources-head">
          <div>
            <span>Lesson materials</span>
            <h2>Resources</h2>
          </div>
          <small>{lessonRow?.resources.length ?? 0} available</small>
        </div>
        <div className="student-resource-list">
          {lessonRow?.resources.map(resource => {
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
          {!lessonRow?.resources.length ? (
            <div className="platform-empty-state">
              <strong>No resources attached</strong>
              <span>This lesson can be completed without extra files.</span>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function NileLessonPlayer({
  lesson,
  moduleTitle,
  outcomes,
  resources,
  progressStatus,
}: {
  lesson?: Lesson;
  moduleTitle?: string;
  outcomes: string[];
  resources: LessonResource[];
  progressStatus?: LessonProgressStatus;
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
  const captionText = lesson
    ? playerMode === "live"
      ? "Live room opens with attendance and class notes attached."
      : `${moduleTitle ?? "Lesson"} · ${lesson.durationMinutes} min${
          outcomes.length ? ` · ${outcomes.slice(0, 2).join(" and ")}` : ""
        }.`
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
          <span>Lesson player</span>
          <strong>{lesson?.title ?? "No lesson selected"}</strong>
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
