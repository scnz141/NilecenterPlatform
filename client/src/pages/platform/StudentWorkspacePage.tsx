import { requireActiveUser } from "@/lib/auth/session";
import { useMemo, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  FileText,
  Play,
  Radio,
  Search,
} from "lucide-react";
import { Link } from "wouter";
import PlatformShell from "@/components/platform/PlatformShell";
import { WorkspaceLayout } from "@/components/platform/PlatformLayouts";
import { StatusBadge } from "@/components/platform/PlatformPrimitives";
import { platformStore } from "@/lib/domain/store";
import type { CalendarEventType, PlatformState } from "@/lib/domain/types";

export type StudentWorkspaceView =
  | "courses"
  | "assignments"
  | "quizzes"
  | "calendar";

type StudentWorkspacePageProps = {
  view: StudentWorkspaceView;
};

type Tone = "green" | "amber" | "red" | "purple" | "slate";

type StudentCourseRow = {
  enrollment: PlatformState["enrollments"][number];
  run: PlatformState["courseRuns"][number];
  course: PlatformState["courses"][number];
  classGroup: PlatformState["classGroups"][number] | undefined;
  nextLesson: PlatformState["lessons"][number] | undefined;
};

const pageCopy: Record<
  StudentWorkspaceView,
  { title: string; description: string; searchLabel: string }
> = {
  courses: {
    title: "My courses",
    description: "Open a course and continue from your next lesson.",
    searchLabel: "Search courses",
  },
  assignments: {
    title: "Assignments",
    description: "See the work that needs your attention.",
    searchLabel: "Search assignments",
  },
  quizzes: {
    title: "Quizzes",
    description: "Open an available quiz or review a completed attempt.",
    searchLabel: "Search quizzes",
  },
  calendar: {
    title: "Calendar",
    description: "Keep track of your upcoming classes and due dates.",
    searchLabel: "Search calendar",
  },
};

function formatDate(value?: string, includeTime = false) {
  if (!value) return "No date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    ...(includeTime ? { hour: "numeric", minute: "2-digit" } : {}),
  }).format(date);
}

function humanize(value?: string) {
  return (value ?? "not started")
    .replace(/_/g, " ")
    .replace(/\b\w/g, character => character.toUpperCase());
}

function statusTone(value?: string): Tone {
  if (["completed", "active", "issued", "present"].includes(value ?? "")) {
    return "green";
  }
  if (["pending", "draft", "late", "in_progress"].includes(value ?? "")) {
    return "amber";
  }
  if (
    ["paused", "absent", "rejected", "overdue", "cancelled"].includes(
      value ?? ""
    )
  ) {
    return "red";
  }
  return "slate";
}

function getStudentScope(state: PlatformState) {
  const user = requireActiveUser("student");
  const student = state.students.find(profile => profile.userId === user.id);
  const studentId = student?.id ?? "";
  const enrollments = state.enrollments.filter(
    enrollment =>
      enrollment.studentId === studentId &&
      ["active", "enrolled", "paused"].includes(enrollment.status)
  );
  const runIds = new Set(enrollments.map(enrollment => enrollment.courseRunId));
  const classIds = new Set(
    enrollments
      .map(enrollment => enrollment.classGroupId)
      .filter((classId): classId is string => Boolean(classId))
  );

  return { studentId, enrollments, runIds, classIds };
}

function EventIcon({ type }: { type: CalendarEventType }) {
  if (type === "class_session" || type === "live_session") {
    return <Radio size={16} />;
  }
  if (type === "assignment_due" || type === "quiz_due") {
    return <ClipboardCheck size={16} />;
  }
  return <CalendarDays size={16} />;
}

export default function StudentWorkspacePage({
  view,
}: StudentWorkspacePageProps) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const state = useMemo(() => platformStore.getState(), []);
  const scope = getStudentScope(state);
  const copy = pageCopy[view];
  const courseRows = scope.enrollments
    .map(enrollment => {
      const run = state.courseRuns.find(
        item => item.id === enrollment.courseRunId
      );
      const course = state.courses.find(item => item.id === run?.courseId);
      const classGroup = state.classGroups.find(
        item => item.id === enrollment.classGroupId
      );
      const lessonIds = new Set(
        state.lessons
          .filter(lesson =>
            state.modules.some(
              module =>
                module.id === lesson.moduleId && module.courseId === course?.id
            )
          )
          .map(lesson => lesson.id)
      );
      const nextLesson = state.lessons.find(lesson => {
        if (!lessonIds.has(lesson.id)) return false;
        const progress = state.lessonProgress.find(
          item =>
            item.lessonId === lesson.id &&
            item.studentId === scope.studentId &&
            item.enrollmentId === enrollment.id
        );
        return progress?.status !== "completed";
      });
      return { enrollment, run, course, classGroup, nextLesson };
    })
    .filter((row): row is StudentCourseRow => Boolean(row.run && row.course));
  const assignments = state.assignments
    .filter(
      assignment =>
        scope.runIds.has(assignment.courseRunId) &&
        (assignment.status === "active" || assignment.status === "completed")
    )
    .map(assignment => {
      const run = state.courseRuns.find(
        item => item.id === assignment.courseRunId
      );
      const course = state.courses.find(item => item.id === run?.courseId);
      const submission = state.assignmentSubmissions
        .filter(
          item =>
            item.assignmentId === assignment.id &&
            item.studentId === scope.studentId
        )
        .sort(
          (a, b) =>
            new Date(b.submittedAt).getTime() -
            new Date(a.submittedAt).getTime()
        )[0];
      return { assignment, course, submission };
    });
  const quizzes = state.quizzes
    .filter(
      quiz =>
        scope.runIds.has(quiz.courseRunId) &&
        (quiz.status === "active" || quiz.status === "completed")
    )
    .map(quiz => {
      const run = state.courseRuns.find(item => item.id === quiz.courseRunId);
      const course = state.courses.find(item => item.id === run?.courseId);
      const attempt = state.quizAttempts
        .filter(
          item => item.quizId === quiz.id && item.studentId === scope.studentId
        )
        .sort(
          (a, b) =>
            new Date(b.submittedAt ?? b.startedAt).getTime() -
            new Date(a.submittedAt ?? a.startedAt).getTime()
        )[0];
      return { quiz, course, attempt };
    });
  const calendarRows = [
    ...state.events
      .filter(
        event => event.classGroupId && scope.classIds.has(event.classGroupId)
      )
      .map(event => ({
        id: `event-${event.id}`,
        title: event.title,
        date: event.startsAt,
        type: event.type,
        status: event.status,
        href:
          event.type === "live_session"
            ? "/app/student/courses/course_ar_l3/live"
            : undefined,
      })),
    ...assignments.map(({ assignment }) => ({
      id: `assignment-${assignment.id}`,
      title: assignment.title,
      date: assignment.dueAt,
      type: "assignment_due" as const,
      status: assignment.status,
      href: `/app/student/assignments/${assignment.id}`,
    })),
    ...quizzes.map(({ quiz }) => ({
      id: `quiz-${quiz.id}`,
      title: quiz.title,
      date: quiz.dueAt,
      type: "quiz_due" as const,
      status: quiz.status,
      href: `/app/student/quizzes/${quiz.id}`,
    })),
  ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const normalizedQuery = query.trim().toLowerCase();
  const filteredCourses = courseRows.filter(row =>
    `${row.course.title} ${row.classGroup?.name ?? ""}`
      .toLowerCase()
      .includes(normalizedQuery)
  );
  const filteredAssignments = assignments.filter(row => {
    const submitted = Boolean(row.submission);
    return (
      `${row.assignment.title} ${row.course?.title ?? ""}`
        .toLowerCase()
        .includes(normalizedQuery) &&
      (filter === "all" ||
        (filter === "to-do" && !submitted) ||
        (filter === "submitted" && submitted))
    );
  });
  const filteredQuizzes = quizzes.filter(row => {
    const completed = row.attempt?.status === "completed";
    return (
      `${row.quiz.title} ${row.course?.title ?? ""}`
        .toLowerCase()
        .includes(normalizedQuery) &&
      (filter === "all" ||
        (filter === "ready" && !completed) ||
        (filter === "completed" && completed))
    );
  });
  const filteredCalendar = calendarRows.filter(row =>
    `${row.title} ${row.type}`.toLowerCase().includes(normalizedQuery)
  );
  const primaryCourse = courseRows[0];

  const toolbar = (
    <div
      className="student-workspace-toolbar"
      data-testid={`student-${view}-toolbar`}
    >
      <label className="student-workspace-search">
        <span className="sr-only">{copy.searchLabel}</span>
        <Search size={16} />
        <input
          value={query}
          onChange={event => setQuery(event.target.value)}
          placeholder={copy.searchLabel}
        />
      </label>
      {view === "assignments" ? (
        <div
          className="student-workspace-filter"
          aria-label="Assignment status"
        >
          {["all", "to-do", "submitted"].map(item => (
            <button
              key={item}
              type="button"
              className={filter === item ? "active" : ""}
              onClick={() => setFilter(item)}
            >
              {item === "to-do" ? "To do" : humanize(item)}
            </button>
          ))}
        </div>
      ) : null}
      {view === "quizzes" ? (
        <div className="student-workspace-filter" aria-label="Quiz status">
          {["all", "ready", "completed"].map(item => (
            <button
              key={item}
              type="button"
              className={filter === item ? "active" : ""}
              onClick={() => setFilter(item)}
            >
              {humanize(item)}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );

  return (
    <PlatformShell role="student" title={copy.title}>
      <WorkspaceLayout
        className={`student-workspace-page student-workspace-${view}`}
        title={copy.title}
        description={copy.description}
        context="Student"
        actions={
          view === "courses" && primaryCourse ? (
            <Link
              className="platform-primary-button"
              href={
                primaryCourse.nextLesson
                  ? `/app/student/courses/${primaryCourse.course.id}/learn/${primaryCourse.nextLesson.id}`
                  : `/app/student/courses/${primaryCourse.course.id}`
              }
            >
              <Play size={15} />
              Continue learning
            </Link>
          ) : null
        }
        toolbar={toolbar}
        main={
          view === "courses" ? (
            <CourseList rows={filteredCourses} />
          ) : view === "assignments" ? (
            <AssignmentList rows={filteredAssignments} />
          ) : view === "quizzes" ? (
            <QuizList rows={filteredQuizzes} />
          ) : (
            <CalendarList rows={filteredCalendar} />
          )
        }
      />
    </PlatformShell>
  );
}

function EmptyWorkspace({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="student-workspace-empty">
      <CheckCircle2 size={20} />
      <div>
        <strong>{title}</strong>
        <p>{detail}</p>
      </div>
    </div>
  );
}

function CourseList({ rows }: { rows: StudentCourseRow[] }) {
  return (
    <section
      className="student-workspace-surface student-course-list"
      data-testid="student-courses-list"
    >
      <div className="student-workspace-surface-head">
        <div>
          <span>Learning now</span>
          <h2>
            {rows.length} active course{rows.length === 1 ? "" : "s"}
          </h2>
        </div>
      </div>
      {rows.length ? (
        <div className="student-course-list-rows">
          {rows.map(({ enrollment, course, classGroup, nextLesson }) => (
            <article key={enrollment.id} className="student-course-list-row">
              <span className="student-workspace-icon">
                <BookOpen size={19} />
              </span>
              <div className="student-workspace-copy">
                <strong>{course.title}</strong>
                <span>{classGroup?.name ?? "Assigned class"}</span>
              </div>
              <div className="student-course-progress">
                <div>
                  <span>Progress</span>
                  <strong>{enrollment.progress}%</strong>
                </div>
                <i>
                  <b style={{ width: `${enrollment.progress}%` }} />
                </i>
              </div>
              <div className="student-workspace-next">
                <span>Next lesson</span>
                <strong>{nextLesson?.title ?? "Course complete"}</strong>
              </div>
              <Link
                className="student-workspace-row-action"
                href={`/app/student/courses/${course.id}`}
              >
                Open course <ArrowRight size={15} />
              </Link>
            </article>
          ))}
        </div>
      ) : (
        <EmptyWorkspace
          title="No courses found"
          detail="Your active courses will appear here after enrollment is confirmed."
        />
      )}
    </section>
  );
}

function AssignmentList({
  rows,
}: {
  rows: Array<{
    assignment: PlatformState["assignments"][number];
    course?: PlatformState["courses"][number];
    submission?: PlatformState["assignmentSubmissions"][number];
  }>;
}) {
  return (
    <section
      className="student-workspace-surface student-task-list"
      data-testid="student-assignments-list"
    >
      <div className="student-workspace-surface-head">
        <div>
          <span>My work</span>
          <h2>
            {rows.length} assignment{rows.length === 1 ? "" : "s"}
          </h2>
        </div>
      </div>
      {rows.length ? (
        <div className="student-task-list-rows">
          {rows.map(({ assignment, course, submission }) => {
            const status = submission?.status ?? assignment.status;
            return (
              <article key={assignment.id} className="student-task-list-row">
                <span className="student-workspace-icon">
                  <ClipboardCheck size={19} />
                </span>
                <div className="student-workspace-copy">
                  <strong>{assignment.title}</strong>
                  <span>{course?.title ?? "Course assignment"}</span>
                </div>
                <div className="student-workspace-date">
                  <Clock3 size={15} />
                  <span>Due {formatDate(assignment.dueAt)}</span>
                </div>
                <StatusBadge tone={statusTone(status)}>
                  {humanize(status)}
                </StatusBadge>
                <Link
                  className="student-workspace-row-action"
                  href={`/app/student/assignments/${assignment.id}`}
                >
                  {submission ? "Review" : "Open"} <ArrowRight size={15} />
                </Link>
              </article>
            );
          })}
        </div>
      ) : (
        <EmptyWorkspace
          title="No assignments found"
          detail="You do not have matching assignments right now."
        />
      )}
    </section>
  );
}

function QuizList({
  rows,
}: {
  rows: Array<{
    quiz: PlatformState["quizzes"][number];
    course?: PlatformState["courses"][number];
    attempt?: PlatformState["quizAttempts"][number];
  }>;
}) {
  return (
    <section
      className="student-workspace-surface student-task-list"
      data-testid="student-quizzes-list"
    >
      <div className="student-workspace-surface-head">
        <div>
          <span>Knowledge checks</span>
          <h2>
            {rows.length} quiz{rows.length === 1 ? "" : "zes"}
          </h2>
        </div>
      </div>
      {rows.length ? (
        <div className="student-task-list-rows">
          {rows.map(({ quiz, course, attempt }) => {
            const complete = attempt?.status === "completed";
            const status = complete ? "completed" : quiz.status;
            const isClosed = quiz.status === "completed";
            return (
              <article key={quiz.id} className="student-task-list-row">
                <span className="student-workspace-icon">
                  <FileText size={19} />
                </span>
                <div className="student-workspace-copy">
                  <strong>{quiz.title}</strong>
                  <span>{course?.title ?? "Course quiz"}</span>
                </div>
                <div className="student-workspace-date">
                  <Clock3 size={15} />
                  <span>
                    {quiz.durationMinutes} min · Due {formatDate(quiz.dueAt)}
                  </span>
                </div>
                <StatusBadge tone={statusTone(status)}>
                  {complete && attempt
                    ? `${attempt.score}/${attempt.maxScore}`
                    : humanize(status)}
                </StatusBadge>
                <Link
                  className="student-workspace-row-action"
                  href={`/app/student/quizzes/${quiz.id}`}
                >
                  {complete ? "Review" : isClosed ? "View" : "Open"} <ArrowRight size={15} />
                </Link>
              </article>
            );
          })}
        </div>
      ) : (
        <EmptyWorkspace
          title="No quizzes found"
          detail="You do not have matching quizzes right now."
        />
      )}
    </section>
  );
}

function CalendarList({
  rows,
}: {
  rows: Array<{
    id: string;
    title: string;
    date: string;
    type: CalendarEventType;
    status: string;
    href?: string;
  }>;
}) {
  return (
    <section
      className="student-workspace-surface student-calendar-list"
      data-testid="student-calendar-list"
    >
      <div className="student-workspace-surface-head">
        <div>
          <span>Coming up</span>
          <h2>
            {rows.length} scheduled item{rows.length === 1 ? "" : "s"}
          </h2>
        </div>
      </div>
      {rows.length ? (
        <div className="student-calendar-list-rows">
          {rows.map(row => (
            <article key={row.id} className="student-calendar-list-row">
              <span className="student-workspace-icon">
                <EventIcon type={row.type} />
              </span>
              <div className="student-workspace-copy">
                <strong>{row.title}</strong>
                <span>{humanize(row.type)}</span>
              </div>
              <time dateTime={row.date}>{formatDate(row.date, true)}</time>
              <StatusBadge tone={statusTone(row.status)}>
                {humanize(row.status)}
              </StatusBadge>
              {row.href ? (
                <Link className="student-workspace-row-action" href={row.href}>
                  Open <ArrowRight size={15} />
                </Link>
              ) : (
                <span className="student-calendar-static">Scheduled</span>
              )}
            </article>
          ))}
        </div>
      ) : (
        <EmptyWorkspace
          title="Nothing scheduled"
          detail="New classes and due dates will appear here."
        />
      )}
    </section>
  );
}
