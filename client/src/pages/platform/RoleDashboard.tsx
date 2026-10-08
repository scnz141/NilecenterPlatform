import { requireActiveUser } from "@/lib/auth/session";
import { motion } from "framer-motion";
import { useMemo, type CSSProperties } from "react";
import {
  ArrowRight,
  Award,
  BookOpen,
  ClipboardList,
  MessageSquare,
} from "lucide-react";
import { Link } from "wouter";
import PlatformShell from "@/components/platform/PlatformShell";
import {
  PortalInsight,
  type InsightPoint,
} from "@/components/platform/PortalInsights";
import {
  PlatformPageHeader,
  PlatformWorkspaceHeader,
  platformReveal,
  StatCard,
} from "@/components/platform/PlatformPrimitives";
import { platformStore } from "@/lib/domain/store";
import {
  dashboardByRole,
  roleMeta,
  type Role,
  type Stat,
} from "@/lib/platformData";

const toneColor: Record<Stat["tone"], string> = {
  teal: "#1A4A3A",
  amber: "#C4A35A",
  green: "#2D5016",
  red: "#C75B39",
  purple: "#3D1A5C",
  slate: "#1A1A1A",
};

const dashboardReveal = platformReveal;

export default function RoleDashboard({ role }: { role: Role }) {
  if (role !== "student") return null;
  return <StudentLearningDashboard />;
}

function StudentLearningDashboard() {
  const meta = roleMeta.student;
  const dashboard = dashboardByRole.student;
  const state = useMemo(() => platformStore.getState(), []);
  const studentUser = state.users.find(
    user => user.id === requireActiveUser("student").id
  );
  const student = state.students.find(
    profile => profile.userId === studentUser?.id
  );
  const studentId = student?.id ?? "";
  const enrollments = state.enrollments.filter(
    enrollment =>
      enrollment.studentId === studentId && enrollment.status === "active"
  );
  const primaryEnrollment = enrollments[0];
  const courseRun = state.courseRuns.find(
    run => run.id === primaryEnrollment?.courseRunId
  );
  const course = state.courses.find(item => item.id === courseRun?.courseId);
  const classGroup = state.classGroups.find(
    item => item.id === primaryEnrollment?.classGroupId
  );
  const branch = state.branches.find(item => item.id === courseRun?.branchId);
  const teacher = state.users.find(
    user => user.id === primaryEnrollment?.teacherId
  );
  const courseModuleIds = new Set(
    state.modules
      .filter(module => module.courseId === course?.id)
      .map(module => module.id)
  );
  const courseLessons = state.lessons.filter(lesson =>
    courseModuleIds.has(lesson.moduleId)
  );
  const studentLessonProgress = state.lessonProgress.filter(
    progress =>
      progress.studentId === studentId &&
      courseLessons.some(lesson => lesson.id === progress.lessonId)
  );
  const nextLessonProgress =
    studentLessonProgress.find(progress => progress.status === "in_progress") ??
    studentLessonProgress.find(progress => progress.status === "not_started");
  const nextLesson =
    state.lessons.find(lesson => lesson.id === nextLessonProgress?.lessonId) ??
    courseLessons[0];
  const activeRunIds = new Set(
    enrollments.map(enrollment => enrollment.courseRunId)
  );
  const assignments = state.assignments.filter(
    assignment =>
      activeRunIds.has(assignment.courseRunId) && assignment.status === "active"
  );
  const pendingAssignments = assignments.filter(
    assignment =>
      !state.assignmentSubmissions.some(
        submission =>
          submission.assignmentId === assignment.id &&
          submission.studentId === studentId &&
          submission.status === "completed"
      )
  );
  const quizzes = state.quizzes.filter(
    quiz => activeRunIds.has(quiz.courseRunId) && quiz.status === "active"
  );
  const quizAttempts = state.quizAttempts.filter(
    attempt => attempt.studentId === studentId
  );
  const activeCertificate = state.certificates.find(
    certificate => certificate.studentId === studentId
  );
  const quranProgress = state.quranProgress.find(
    record => record.studentId === studentId
  );
  const quranPlan = state.quranPlans.find(plan => plan.studentId === studentId);
  const unreadMessages = state.messages.filter(
    message => message.toUserId === studentUser?.id && !message.read
  );
  const studentEvents = state.events
    .filter(
      event =>
        event.classGroupId &&
        enrollments.some(
          enrollment => enrollment.classGroupId === event.classGroupId
        )
    )
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const nextEvent = studentEvents[0];
  const submittedAssignments = assignments.length - pendingAssignments.length;
  const completedLessons = studentLessonProgress.filter(
    progress => progress.status === "completed"
  ).length;
  const progressPercent =
    primaryEnrollment?.progress ?? dashboard.spotlight.progress;
  const learningTasks: Array<{
    id: string;
    title: string;
    subtitle: string;
    meta: string;
    tone: NonNullable<Stat["tone"]>;
    href: string;
  }> = [
    {
      id: "next-lesson",
      title: nextLesson?.title ?? dashboard.spotlight.title,
      subtitle: course?.title ?? "Arabic Level 3",
      meta:
        nextLessonProgress?.status === "completed"
          ? "Complete"
          : nextLessonProgress?.status === "in_progress"
            ? "In progress"
            : "Ready",
      tone: nextLessonProgress?.status === "completed" ? "green" : "teal",
      href: "/app/student/courses/course_ar_l3/learn/lesson_ar_conditional",
    },
    ...pendingAssignments.slice(0, 2).map(assignment => ({
      id: assignment.id,
      title: assignment.title,
      subtitle:
        assignment.submissionType === "audio"
          ? "Audio submission"
          : "Course task",
      meta: state.assignmentSubmissions.some(
        submission =>
          submission.assignmentId === assignment.id &&
          submission.studentId === studentId
      )
        ? "Draft saved"
        : "Open",
      tone: "amber" as const,
      href: `/app/student/assignments/${assignment.id}`,
    })),
    ...quizzes.slice(0, 1).map(quiz => ({
      id: quiz.id,
      title: quiz.title,
      subtitle: `${quiz.durationMinutes} min check`,
      meta: quizAttempts.some(
        attempt => attempt.quizId === quiz.id && attempt.status === "completed"
      )
        ? "Attempted"
        : "Ready",
      tone: (quizAttempts.some(
        attempt => attempt.quizId === quiz.id && attempt.status === "completed"
      )
        ? "green"
        : "purple") as NonNullable<Stat["tone"]>,
      href: "/app/student/quizzes",
    })),
  ];
  const studentAttentionItems = [
    {
      label: "Assignments due",
      detail: pendingAssignments.length
        ? `${pendingAssignments.length} task(s) waiting.`
        : "No open assignment blockers.",
      href: "/app/student/assignments",
      Icon: ClipboardList,
      tone: pendingAssignments.length ? ("amber" as const) : ("green" as const),
    },
    {
      label: "Teacher feedback",
      detail: unreadMessages.length
        ? `${unreadMessages.length} unread message(s).`
        : `Feedback from ${teacher?.name ?? "teacher"} is current.`,
      href: "/app/student/messages",
      Icon: MessageSquare,
      tone: unreadMessages.length ? ("teal" as const) : ("green" as const),
    },
    {
      label: "Quran progress",
      detail: `${quranProgress?.memorizedPercent ?? 0}% memorized · ${quranPlan?.currentJuz ?? "revision cycle"}.`,
      href: "/app/student/quran-progress",
      Icon: BookOpen,
      tone: "purple" as const,
    },
    {
      label: "Certificate path",
      detail:
        activeCertificate?.status.replaceAll("_", " ") ??
        "Keep progress and attendance on track.",
      href: "/app/student/certificates",
      Icon: Award,
      tone: activeCertificate ? ("green" as const) : ("amber" as const),
    },
  ];

  const hasLessonProgress = studentLessonProgress.length > 0;
  const studentStats: Stat[] = [
    {
      label: "Active courses",
      value: String(enrollments.length),
      change: `${assignments.length} tasks`,
      tone: "teal",
    },
    {
      label: "Course progress",
      value: `${progressPercent}%`,
      change: hasLessonProgress
        ? `${completedLessons}/${Math.max(courseLessons.length, 1)} lessons`
        : "Start your first lesson",
      tone: "green",
    },
    {
      label: "Attendance",
      value: `${primaryEnrollment?.attendanceRate ?? 0}%`,
      change: branch?.name ?? "Online",
      tone: "amber",
    },
    {
      label: "Certificate path",
      value: activeCertificate ? `${activeCertificate.grade}%` : "New",
      change: activeCertificate?.status.replaceAll("_", " ") ?? "in progress",
      tone: "purple",
    },
  ];
  const studentInsightPoints: InsightPoint[] = hasLessonProgress
    ? courseLessons.slice(0, 6).map((lesson, index) => {
        const lessonProgress = studentLessonProgress.find(
          progress => progress.lessonId === lesson.id
        );
        const value =
          lessonProgress?.status === "completed"
            ? 100
            : lessonProgress?.status === "in_progress"
              ? 60
              : 0;
        return { label: `Lesson ${index + 1}`, value };
      })
    : [
        {
          label: course?.title ?? "Current course",
          value: progressPercent,
        },
      ];

  return (
    <PlatformShell role="student" title="Dashboard">
      <PlatformPageHeader
        compact
        title="My Learning Dashboard"
        description="Your next class, one lesson, and the work due soon."
        context={
          <>
            <span>{course?.title ?? "Arabic Level 3"}</span>
            <span>{classGroup?.name ?? "Live class"}</span>
            <span>{student?.timezone ?? "Africa/Cairo"}</span>
          </>
        }
        actions={
          <>
            <Link
              href="/app/student/reports"
              className="platform-secondary-button"
            >
              My report
            </Link>
            <Link
              href="/app/student/courses/course_ar_l3/learn/lesson_ar_conditional"
              className="platform-primary-button"
              style={{ background: meta.color }}
            >
              <BookOpen size={15} />
              Continue lesson
            </Link>
          </>
        }
      />

      <motion.div
        className="platform-metric-grid"
        initial="hidden"
        animate="visible"
      >
        {studentStats.map((stat, index) => (
          <StatCard
            key={stat.label}
            label={stat.label}
            value={stat.value}
            change={stat.change}
            tone={stat.tone}
            delay={0.05 + index * 0.045}
          />
        ))}
      </motion.div>

      <motion.div
        className="platform-v2-role-main"
        initial="hidden"
        animate="visible"
        custom={0.12}
        variants={dashboardReveal}
      >
        <div className="platform-v2-role-stack">
          <section className="platform-v2-panel platform-v2-work-summary">
            <PlatformWorkspaceHeader
              title="Continue learning"
              description="Your next class, lesson, and progress in one place."
            />
            <div className="platform-v2-summary-body">
              <div className="platform-v2-summary-copy">
                <span>Next learning block</span>
                <h2>{nextLesson?.title ?? "Continue Arabic Grammar"}</h2>
                <p>
                  {course?.title ?? "Arabic Level 3"} with{" "}
                  {teacher?.name ?? "your teacher"}.
                </p>
                <div className="platform-progress-row">
                  <div>
                    <strong>Course progress</strong>
                    <span>{progressPercent}%</span>
                  </div>
                  <div>
                    <span
                      style={{
                        width: `${progressPercent}%`,
                        background: meta.color,
                      }}
                    />
                  </div>
                </div>
                <div className="platform-v2-summary-actions">
                  <Link
                    href="/app/student/courses/course_ar_l3/learn/lesson_ar_conditional"
                    className="platform-primary-button"
                    style={{ background: meta.color }}
                  >
                    Continue lesson
                    <ArrowRight size={15} />
                  </Link>
                  <Link
                    href="/app/student/courses/course_ar_l3/live"
                    className="platform-secondary-button"
                  >
                    Join class
                  </Link>
                </div>
              </div>
              <div className="platform-v2-summary-facts">
                <article>
                  <span>Next class</span>
                  <strong>
                    {nextEvent
                      ? formatStudentDate(nextEvent.startsAt)
                      : "Scheduled"}
                  </strong>
                  <small>{classGroup?.name ?? "Live class"}</small>
                </article>
                <article>
                  <span>Teacher</span>
                  <strong>{teacher?.name ?? "Teacher"}</strong>
                  <small>{unreadMessages.length} unread message(s)</small>
                </article>
                <article>
                  <span>Attendance</span>
                  <strong>{primaryEnrollment?.attendanceRate ?? 0}%</strong>
                  <small>{branch?.name ?? "Online"}</small>
                </article>
              </div>
            </div>
          </section>

          <section className="platform-v2-panel">
            <PlatformWorkspaceHeader
              title="Learning focus"
              description="Only the next lesson, due work, and quick checks."
            />
            <div className="platform-v2-dashboard-list">
              {learningTasks.map(item => (
                <Link
                  key={item.id}
                  href={item.href}
                  style={
                    { "--item-color": toneColor[item.tone] } as CSSProperties
                  }
                >
                  <div>
                    <strong>{item.title}</strong>
                    <small>{item.subtitle}</small>
                  </div>
                  <span>{item.meta}</span>
                </Link>
              ))}
              <Link
                href="/app/student/assignments"
                style={{ "--item-color": toneColor.amber } as CSSProperties}
              >
                <div>
                  <strong>{pendingAssignments.length} assignments open</strong>
                  <small>
                    {submittedAssignments} submitted or saved · {quizzes.length}{" "}
                    quiz check(s)
                  </small>
                </div>
                <span>review</span>
              </Link>
            </div>
          </section>
        </div>

        <aside className="platform-v2-panel">
          <PlatformWorkspaceHeader
            title="Upcoming & feedback"
            description="Short signals that need the student’s attention."
          />
          <div className="platform-v2-attention-list">
            {studentAttentionItems.map(item => (
              <Link
                key={item.label}
                href={item.href}
                style={
                  { "--item-color": toneColor[item.tone] } as CSSProperties
                }
              >
                <span>
                  <item.Icon size={16} />
                </span>
                <div>
                  <strong>{item.label}</strong>
                  <small>{item.detail}</small>
                </div>
                <ArrowRight size={15} />
              </Link>
            ))}
          </div>
        </aside>
      </motion.div>

      <PortalInsight
        eyebrow="Learning pace"
        title="Learning momentum"
        value={
          hasLessonProgress
            ? courseLessons.length
              ? `${completedLessons}/${courseLessons.length}`
              : "No lessons"
            : `${progressPercent}%`
        }
        valueLabel={hasLessonProgress ? "lessons completed" : "course progress"}
        description={
          hasLessonProgress
            ? "Track how your current course is progressing lesson by lesson."
            : "Your current course progress is ready; lesson detail appears as it is recorded."
        }
        points={studentInsightPoints}
        tone="navy"
        testId="student-dashboard-insight"
      />
    </PlatformShell>
  );
}

function formatStudentDate(value?: string) {
  if (!value) {
    return "Scheduled";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("en", { month: "short", day: "numeric" });
}

