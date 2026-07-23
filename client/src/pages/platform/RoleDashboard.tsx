import { requireActiveUser } from "@/lib/auth/session";
import { motion } from "framer-motion";
import { useMemo, type CSSProperties } from "react";
import {
  Activity,
  ArrowRight,
  AlertTriangle,
  Award,
  BookOpen,
  Building2,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  CreditCard,
  FileText,
  ListChecks,
  MessageSquare,
  Plus,
  PlugZap,
  Presentation,
  ScrollText,
  ShieldCheck,
  UserPlus,
  Users,
  type LucideIcon,
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
  StatusBadge,
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

function formatConnectionStatus(status: string) {
  return status === "mock_mode" ? "Test mode" : status.replace("_", " ");
}

export default function RoleDashboard({ role }: { role: Role }) {
  if (role === "superadmin") {
    return <SuperAdminDashboard />;
  }

  if (role === "headofdepartment") {
    return <HeadOfDepartmentDashboard />;
  }

  if (role === "registrar") {
    return <RegistrarCommandDashboard />;
  }

  if (role === "teacher") {
    return <TeacherCommandDashboard />;
  }

  if (role === "branchadmin") {
    return <BranchAdminOperationsDashboard />;
  }

  if (role === "student") {
    return <StudentLearningDashboard />;
  }

  return null;
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

function RegistrarCommandDashboard() {
  const meta = roleMeta.registrar;
  const state = useMemo(() => platformStore.getState(), []);
  const actor = state.users.find(
    user => user.id === requireActiveUser("registrar").id
  );
  const branch = state.branches.find(item => item.id === actor?.branchId);
  const applications = state.applications;
  const pendingApplications = applications.filter(
    application => application.status === "pending"
  );
  const pendingPlacements = state.placementTests.filter(
    booking => booking.status !== "completed"
  );
  const readyWorkflows = state.enrollmentWorkflows.filter(
    workflow => workflow.status === "ready_to_enroll"
  );
  const invoiceRows = state.invoices.map(invoice => {
    const paid = state.payments
      .filter(
        payment => payment.invoiceId === invoice.id && payment.status === "paid"
      )
      .reduce((sum, payment) => sum + payment.amount, 0);
    return { invoice, paid, balance: Math.max(0, invoice.amount - paid) };
  });
  const openInvoices = invoiceRows.filter(row => row.balance > 0);
  const collected = invoiceRows.reduce((sum, row) => sum + row.paid, 0);
  const nextPlacement = pendingPlacements[0];
  const nextPlacementBranch = state.branches.find(
    item => item.id === nextPlacement?.branchId
  );
  const nextApplication = pendingApplications[0];
  const nextApplicationLead = state.leads.find(
    item => item.id === nextApplication?.leadId
  );
  const activeStudents = state.students.filter(
    student => student.status === "active"
  );
  const pipelineStats: Stat[] = [
    {
      label: "Leads",
      value: String(state.leads.length),
      change: `${state.leads.filter(lead => lead.status === "lead").length} new`,
      tone: "teal",
    },
    {
      label: "Applications",
      value: String(applications.length),
      change: `${pendingApplications.length} pending`,
      tone: "amber",
    },
    {
      label: "Placement queue",
      value: String(pendingPlacements.length),
      change: "awaiting result",
      tone: pendingPlacements.length ? "red" : "green",
    },
    {
      label: "Open balance",
      value: `EGP ${openInvoices.reduce((sum, row) => sum + row.balance, 0)}`,
      change: `${openInvoices.length} invoice(s)`,
      tone: openInvoices.length ? "amber" : "green",
    },
  ];
  const workflowTiles: Array<{
    label: string;
    href: string;
    count: number;
    detail: string;
    tone: Stat["tone"];
    Icon: LucideIcon;
  }> = [
    {
      label: "Admissions pipeline",
      href: "/app/registrar/leads",
      count: state.leads.filter(lead => lead.status === "lead").length,
      detail: "New leads and pending applications.",
      tone: "teal",
      Icon: Users,
    },
    {
      label: "Placement tests",
      href: "/app/registrar/placement-tests",
      count: pendingPlacements.length,
      detail: "Booked tests waiting for result.",
      tone: pendingPlacements.length ? "red" : "green",
      Icon: ClipboardList,
    },
    {
      label: "Ready to enroll",
      href: "/app/registrar/enrollments",
      count: readyWorkflows.length,
      detail: "Placement and file checks are ready.",
      tone: "purple",
      Icon: UserPlus,
    },
    {
      label: "Payments pending",
      href: "/app/registrar/payments",
      count: openInvoices.length,
      detail: "Manual receipts or balances to review.",
      tone: openInvoices.length ? "amber" : "green",
      Icon: CreditCard,
    },
  ];
  const registrarTaskItems = [
    ...pendingPlacements.slice(0, 2).map(booking => ({
      id: booking.id,
      label: booking.fullName,
      detail: `${booking.subject} · ${booking.preferredDate} · ${booking.currentLevel}`,
      href: `/app/registrar/placement-tests/${booking.id}`,
      meta: "placement",
      tone: "amber" as const,
    })),
    ...readyWorkflows.slice(0, 2).map(workflow => {
      const lead = state.leads.find(item => item.id === workflow.leadId);
      const course = state.courses.find(
        item => item.id === workflow.targetCourseId
      );
      return {
        id: workflow.id,
        label: lead?.fullName ?? "Enrollment handoff",
        detail: `${course?.title ?? workflow.targetCourseId} · ${workflow.nextStep}`,
        href: "/app/registrar/enrollments",
        meta: "enroll",
        tone: "purple" as const,
      };
    }),
    ...pendingApplications.slice(0, 2).map(application => {
      const lead = state.leads.find(item => item.id === application.leadId);
      return {
        id: application.id,
        label: lead?.fullName ?? application.id,
        detail: `${application.courseInterest} · ${application.schedulePreference}`,
        href: `/app/registrar/applications/${application.id}`,
        meta: "review",
        tone: "teal" as const,
      };
    }),
  ].slice(0, 5);
  const registrarAttentionItems = [
    {
      label: "Applications pending",
      detail: pendingApplications.length
        ? `${pendingApplications.length} file(s) need review.`
        : "No pending application files.",
      href: "/app/registrar/applications",
      Icon: FileText,
      tone: pendingApplications.length
        ? ("amber" as const)
        : ("green" as const),
    },
    {
      label: "Placement queue",
      detail: pendingPlacements.length
        ? `${pendingPlacements.length} test(s) need a result.`
        : "Placement queue is clear.",
      href: "/app/registrar/placement-tests",
      Icon: ClipboardList,
      tone: pendingPlacements.length ? ("red" as const) : ("green" as const),
    },
    {
      label: "Ready to enroll",
      detail: readyWorkflows.length
        ? `${readyWorkflows.length} student(s) ready for class assignment.`
        : `${activeStudents.length} active students live.`,
      href: "/app/registrar/enrollments",
      Icon: UserPlus,
      tone: readyWorkflows.length ? ("purple" as const) : ("green" as const),
    },
    {
      label: "Payments pending",
      detail: openInvoices.length
        ? `EGP ${openInvoices.reduce((sum, row) => sum + row.balance, 0)} balance open.`
        : `EGP ${collected} collected.`,
      href: "/app/registrar/payments",
      Icon: CreditCard,
      tone: openInvoices.length ? ("amber" as const) : ("green" as const),
    },
  ];
  const admissionsInsightPoints: InsightPoint[] = [
    {
      label: "New leads",
      value: state.leads.filter(lead => lead.status === "lead").length,
    },
    { label: "Applications", value: pendingApplications.length },
    { label: "Placement", value: pendingPlacements.length },
    { label: "Ready", value: readyWorkflows.length },
  ];

  return (
    <PlatformShell role="registrar" title="Dashboard">
      <PlatformPageHeader
        compact
        title="Admissions Dashboard"
        description={`${branch?.name ?? "Admissions"} intake, placement, enrollment, and payments.`}
        actions={
          <>
            <Link
              href="/app/registrar/reports"
              className="platform-secondary-button"
            >
              Reports
            </Link>
            <Link
              href="/app/registrar/leads"
              className="platform-primary-button"
              style={{ background: meta.color }}
            >
              <Users size={15} />
              Add lead
            </Link>
          </>
        }
      />

      <motion.div
        className="platform-metric-grid"
        initial="hidden"
        animate="visible"
      >
        {pipelineStats.map((stat, index) => (
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
        custom={0.14}
        variants={dashboardReveal}
      >
        <div className="platform-v2-role-stack">
          <section className="platform-v2-panel platform-v2-work-summary">
            <PlatformWorkspaceHeader
              title="Admissions pipeline"
              description="Move each applicant from enquiry to placement and enrollment."
            />
            <div className="platform-v2-summary-body">
              <div className="platform-v2-summary-copy">
                <span>Next admissions action</span>
                <h2>
                  {nextPlacement?.fullName ??
                    nextApplicationLead?.fullName ??
                    "Pipeline ready"}
                </h2>
                <p>
                  {nextPlacement
                    ? `${nextPlacement.subject} placement at ${nextPlacementBranch?.name ?? nextPlacement.branchId}.`
                    : nextApplication
                      ? "Review the next pending application file."
                      : "Admissions queue is clear."}
                </p>
                <div className="platform-v2-summary-actions">
                  <Link
                    href="/app/registrar/placement-tests"
                    className="platform-primary-button"
                    style={{ background: meta.color }}
                  >
                    Placement queue
                  </Link>
                  <Link
                    href="/app/registrar/applications"
                    className="platform-secondary-button"
                  >
                    Applications
                  </Link>
                </div>
              </div>
              <div className="platform-v2-summary-facts">
                {workflowTiles.slice(0, 3).map(item => (
                  <article key={item.label}>
                    <span>{item.label}</span>
                    <strong>{item.count}</strong>
                    <small>{item.detail}</small>
                  </article>
                ))}
              </div>
            </div>
          </section>

          <section className="platform-v2-panel">
            <PlatformWorkspaceHeader
              title="Placement & enrollment"
              description="Short queue of files that can move today."
            />
            <div className="platform-v2-dashboard-list">
              {registrarTaskItems.map(item => (
                <Link
                  key={item.id}
                  href={item.href}
                  style={
                    { "--item-color": toneColor[item.tone] } as CSSProperties
                  }
                >
                  <div>
                    <strong>{item.label}</strong>
                    <small>{item.detail}</small>
                  </div>
                  <span>{item.meta}</span>
                </Link>
              ))}
              {!registrarTaskItems.length ? (
                <article>
                  <div>
                    <strong>No enrollment blocker</strong>
                    <small>
                      New placement and application rows will appear here.
                    </small>
                  </div>
                  <span>clear</span>
                </article>
              ) : null}
            </div>
          </section>
        </div>

        <aside className="platform-v2-panel">
          <PlatformWorkspaceHeader
            title="Needs attention"
            description="Admissions, placement, enrollment, and payments."
          />
          <div className="platform-v2-attention-list">
            {registrarAttentionItems.map(item => (
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
        eyebrow="Admissions flow"
        title="Pipeline at a glance"
        value={activeStudents.length}
        valueLabel="active learners"
        description="See where current enquiries need their next admissions decision."
        points={admissionsInsightPoints}
        variant="bars"
        tone="amber"
        testId="registrar-dashboard-insight"
      />
    </PlatformShell>
  );
}

function TeacherCommandDashboard() {
  const dashboard = dashboardByRole.teacher;
  const meta = roleMeta.teacher;
  const state = useMemo(() => platformStore.getState(), []);
  const actorId = requireActiveUser("teacher").id;
  const teacherUser = state.users.find(user => user.id === actorId);
  const teacherProfile = state.teachers.find(
    teacher => teacher.userId === actorId
  );
  const staffProfile = state.staffProfiles.find(
    profile => profile.userId === actorId && profile.role === "teacher"
  );
  const teacherRuns = state.courseRuns.filter(run => run.teacherId === actorId);
  const runIds = new Set(teacherRuns.map(run => run.id));
  const teacherClasses = state.classGroups.filter(group =>
    runIds.has(group.courseRunId)
  );
  const classIds = new Set(teacherClasses.map(group => group.id));
  const studentIds = new Set(teacherClasses.flatMap(group => group.studentIds));
  const teacherStudents = state.students.filter(student =>
    studentIds.has(student.id)
  );
  const sessions = state.classSessions
    .filter(session => classIds.has(session.classGroupId))
    .sort(
      (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()
    );
  const pendingAttendance = sessions.filter(
    session => !session.attendanceSaved
  );
  const assignments = state.assignments.filter(assignment =>
    runIds.has(assignment.courseRunId)
  );
  const assignmentIds = new Set(assignments.map(assignment => assignment.id));
  const pendingSubmissions = state.assignmentSubmissions.filter(
    submission =>
      submission.status === "pending" &&
      studentIds.has(submission.studentId) &&
      assignmentIds.has(submission.assignmentId)
  );
  const grades = state.grades.filter(
    grade => studentIds.has(grade.studentId) && runIds.has(grade.courseRunId)
  );
  const averageProgress = teacherStudents.length
    ? Math.round(
        teacherStudents.reduce((sum, student) => {
          const studentEnrollments = state.enrollments.filter(
            enrollment =>
              enrollment.studentId === student.id &&
              runIds.has(enrollment.courseRunId)
          );
          if (!studentEnrollments.length) return sum;
          return (
            sum +
            Math.round(
              studentEnrollments.reduce(
                (inner, enrollment) => inner + enrollment.progress,
                0
              ) / studentEnrollments.length
            )
          );
        }, 0) / teacherStudents.length
      )
    : 0;
  const studentsNeedingAttention = teacherStudents
    .map(student => {
      const user = state.users.find(item => item.id === student.userId);
      const enrollments = state.enrollments.filter(
        enrollment =>
          enrollment.studentId === student.id &&
          runIds.has(enrollment.courseRunId)
      );
      const lowestAttendance = enrollments.length
        ? Math.min(...enrollments.map(enrollment => enrollment.attendanceRate))
        : 0;
      const lowestGrade = enrollments.length
        ? Math.min(...enrollments.map(enrollment => enrollment.currentGrade))
        : 0;
      const progress = enrollments.length
        ? Math.round(
            enrollments.reduce(
              (sum, enrollment) => sum + enrollment.progress,
              0
            ) / enrollments.length
          )
        : 0;
      return {
        student,
        user,
        lowestAttendance,
        lowestGrade,
        progress,
        classGroupId: enrollments[0]?.classGroupId,
      };
    })
    .filter(
      row =>
        row.lowestAttendance < 85 || row.lowestGrade < 75 || row.progress < 50
    )
    .slice(0, 4);
  const nextClass =
    sessions.find(session => !session.attendanceSaved) ?? sessions[0];
  const nextClassGroup =
    teacherClasses.find(group => group.id === nextClass?.classGroupId) ??
    teacherClasses[0];
  const nextRun = teacherRuns.find(
    run => run.id === nextClassGroup?.courseRunId
  );
  const nextCourse = state.courses.find(
    course => course.id === nextRun?.courseId
  );
  const todayKey = new Date().toISOString().slice(0, 10);
  const todaySessions = sessions.filter(
    session => session.startsAt.slice(0, 10) === todayKey
  );
  const visibleSessions = todaySessions.length
    ? todaySessions
    : sessions.slice(0, 4);
  const unreadMessages = state.messages.filter(
    message => message.toUserId === actorId && !message.read
  );
  const dashboardStats: Stat[] = [
    {
      label: "Today’s classes",
      value: String(todaySessions.length || visibleSessions.length),
      change: todaySessions.length ? "scheduled today" : "next scheduled",
      tone: "teal",
    },
    {
      label: "Attendance due",
      value: String(pendingAttendance.length),
      change: `${sessions.length} session(s)`,
      tone: pendingAttendance.length ? "amber" : "green",
    },
    {
      label: "Grading queue",
      value: String(pendingSubmissions.length),
      change: `${grades.length} grade item(s)`,
      tone: pendingSubmissions.length ? "red" : "green",
    },
    {
      label: "Need support",
      value: String(studentsNeedingAttention.length),
      change: `${teacherStudents.length} learner(s)`,
      tone: studentsNeedingAttention.length ? "amber" : "green",
    },
  ];
  const teacherAttentionItems = [
    {
      label: "Attendance to mark",
      detail: pendingAttendance.length
        ? `${pendingAttendance.length} session(s) need attendance.`
        : "Attendance is saved for current sessions.",
      href: `/app/teacher/classes/${nextClassGroup?.id ?? "class_ar_l3_a"}/attendance`,
      Icon: CheckCircle2,
      tone: pendingAttendance.length ? ("amber" as const) : ("green" as const),
    },
    {
      label: "Grading queue",
      detail: pendingSubmissions.length
        ? `${pendingSubmissions.length} submission(s) waiting.`
        : "No pending submissions.",
      href: "/app/teacher/grading",
      Icon: ListChecks,
      tone: pendingSubmissions.length ? ("red" as const) : ("green" as const),
    },
    {
      label: "Students needing attention",
      detail: studentsNeedingAttention.length
        ? `${studentsNeedingAttention.length} learner(s) need review.`
        : "Progress and attendance are stable.",
      href: `/app/teacher/classes/${nextClassGroup?.id ?? "class_ar_l3_a"}/students`,
      Icon: Users,
      tone: studentsNeedingAttention.length
        ? ("amber" as const)
        : ("green" as const),
    },
    {
      label: "Messages",
      detail: unreadMessages.length
        ? `${unreadMessages.length} unread class message(s).`
        : "No unread class messages.",
      href: "/app/teacher/messages",
      Icon: MessageSquare,
      tone: unreadMessages.length ? ("teal" as const) : ("green" as const),
    },
  ];
  const classMomentumPoints: InsightPoint[] = teacherClasses
    .slice(0, 6)
    .map(classGroup => {
      const classEnrollments = state.enrollments.filter(
        enrollment => enrollment.classGroupId === classGroup.id
      );
      const value = classEnrollments.length
        ? Math.round(
            classEnrollments.reduce(
              (sum, enrollment) => sum + enrollment.progress,
              0
            ) / classEnrollments.length
          )
        : 0;
      return { label: classGroup.name, value };
    });

  return (
    <PlatformShell role="teacher" title="Dashboard">
      <PlatformPageHeader
        compact
        title="Teaching Dashboard"
        description="Today’s classes, attendance, grading, and student support."
        actions={
          <>
            <Link
              href="/app/teacher/reports"
              className="platform-secondary-button"
            >
              Reports
            </Link>
            <Link
              href={`/app/teacher/classes/${nextClassGroup?.id ?? "class_ar_l3_a"}/attendance`}
              className="platform-primary-button"
              style={{ background: meta.color }}
            >
              <CheckCircle2 size={15} />
              Mark attendance
            </Link>
          </>
        }
      />

      <motion.div
        className="platform-metric-grid"
        initial="hidden"
        animate="visible"
      >
        {dashboardStats.map((stat, index) => (
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
        className="platform-v2-role-main teacher-dashboard-main"
        initial="hidden"
        animate="visible"
        custom={0.14}
        variants={dashboardReveal}
      >
        <div className="platform-v2-role-stack teacher-dashboard-stack">
          <section className="platform-v2-panel platform-v2-work-summary teacher-plan-panel">
            <PlatformWorkspaceHeader
              title="Today’s teaching plan"
              description={`${teacherUser?.name ?? "Teacher"} · ${staffProfile?.subjects.join(", ") || teacherProfile?.subjects.join(", ") || "assigned classes"}`}
            />
            <div className="platform-v2-summary-body teacher-plan-body">
              <div className="platform-v2-summary-copy teacher-plan-copy">
                <span>Next class</span>
                <h2>
                  {nextClass?.title ??
                    nextClassGroup?.name ??
                    dashboard.spotlight.title}
                </h2>
                <p>{nextCourse?.title ?? dashboard.spotlight.description}</p>
                <div className="platform-v2-summary-actions">
                  <Link
                    href={`/app/teacher/classes/${nextClassGroup?.id ?? "class_ar_l3_a"}/attendance`}
                    className="platform-primary-button"
                    style={{ background: meta.color }}
                  >
                    Mark attendance
                  </Link>
                  <Link
                    href={`/app/teacher/classes/${nextClassGroup?.id ?? "class_ar_l3_a"}`}
                    className="platform-secondary-button"
                  >
                    Class panel
                  </Link>
                </div>
              </div>
              <div className="platform-v2-summary-facts teacher-plan-facts">
                <article>
                  <span>Schedule</span>
                  <strong>
                    {nextClass
                      ? formatStudentDate(nextClass.startsAt)
                      : "No session"}
                  </strong>
                  <small>{nextClassGroup?.schedule ?? "Class schedule"}</small>
                </article>
                <article>
                  <span>Roster</span>
                  <strong>{nextClassGroup?.studentIds.length ?? 0}</strong>
                  <small>learner(s)</small>
                </article>
                <article>
                  <span>Progress</span>
                  <strong>{averageProgress}%</strong>
                  <small>class average</small>
                </article>
              </div>
            </div>
          </section>

          <section className="platform-v2-panel teacher-delivery-panel">
            <PlatformWorkspaceHeader
              title="Class delivery"
              description="The next sessions and the attendance state attached to them."
            />
            <div className="platform-v2-dashboard-list">
              {visibleSessions.map(session => {
                const group = teacherClasses.find(
                  item => item.id === session.classGroupId
                );
                const run = teacherRuns.find(
                  item => item.id === group?.courseRunId
                );
                const course = state.courses.find(
                  item => item.id === run?.courseId
                );
                return (
                  <Link
                    key={session.id}
                    href={`/app/teacher/classes/${group?.id ?? "class_ar_l3_a"}/attendance`}
                    style={
                      {
                        "--item-color": session.attendanceSaved
                          ? toneColor.green
                          : toneColor.amber,
                      } as CSSProperties
                    }
                  >
                    <div>
                      <strong>{session.title}</strong>
                      <small>
                        {group?.name ?? "Class group"} ·{" "}
                        {course?.title ?? "Course"}
                      </small>
                    </div>
                    <span>{session.attendanceSaved ? "saved" : "mark"}</span>
                  </Link>
                );
              })}
              {!visibleSessions.length ? (
                <article>
                  <div>
                    <strong>No classes scheduled</strong>
                    <small>Assigned sessions will appear here.</small>
                  </div>
                  <span>clear</span>
                </article>
              ) : null}
            </div>
          </section>
        </div>

        <aside className="platform-v2-panel teacher-attention-panel">
          <PlatformWorkspaceHeader
            title="Needs attention"
            description="Attendance, grading, and learner support queues."
          />
          <div className="platform-v2-attention-list">
            {teacherAttentionItems.map(item => (
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
            {studentsNeedingAttention.slice(0, 2).map(row => (
              <Link
                key={row.student.id}
                href={`/app/teacher/classes/${row.classGroupId ?? nextClassGroup?.id ?? "class_ar_l3_a"}/students`}
                style={{ "--item-color": toneColor.amber } as CSSProperties}
              >
                <span>
                  <Users size={16} />
                </span>
                <div>
                  <strong>{row.user?.name ?? row.student.id}</strong>
                  <small>
                    Attendance {row.lowestAttendance}% · Grade {row.lowestGrade}
                    %
                  </small>
                </div>
                <ArrowRight size={15} />
              </Link>
            ))}
          </div>
        </aside>
      </motion.div>

      <PortalInsight
        eyebrow="Class progress"
        title="Teaching momentum"
        value={`${averageProgress}%`}
        valueLabel="average learner progress"
        description="Compare the learning pace across your assigned class groups."
        points={classMomentumPoints}
        variant="bars"
        tone="navy"
        testId="teacher-dashboard-insight"
      />
    </PlatformShell>
  );
}

function BranchAdminOperationsDashboard() {
  const meta = roleMeta.branchadmin;
  const state = useMemo(() => platformStore.getState(), []);
  const actor =
    state.users.find(user => user.id === requireActiveUser("branchadmin").id) ??
    state.users.find(user => user.activeRole === "branchadmin");
  const branch =
    state.branches.find(item => item.id === actor?.branchId) ??
    state.branches.find(item => item.id === "br_cairo") ??
    state.branches[0];
  const branchId = branch?.id ?? actor?.branchId ?? "";
  const branchRuns = state.courseRuns.filter(run => run.branchId === branchId);
  const branchRunIds = new Set(branchRuns.map(run => run.id));
  const branchClasses = state.classGroups.filter(group =>
    branchRunIds.has(group.courseRunId)
  );
  const branchClassIds = new Set(branchClasses.map(group => group.id));
  const branchSessions = state.classSessions
    .filter(session => branchClassIds.has(session.classGroupId))
    .sort(
      (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()
    );
  const branchEnrollmentStudentIds = new Set(
    state.enrollments
      .filter(enrollment => branchRunIds.has(enrollment.courseRunId))
      .map(enrollment => enrollment.studentId)
  );
  const branchStudents = state.students.filter(student => {
    const user = state.users.find(item => item.id === student.userId);
    return (
      branchEnrollmentStudentIds.has(student.id) || user?.branchId === branchId
    );
  });
  const branchStudentIds = new Set(branchStudents.map(student => student.id));
  const branchTeachers = state.teachers.filter(teacher => {
    const user = state.users.find(item => item.id === teacher.userId);
    return (
      user?.branchId === branchId ||
      state.teacherAvailability.some(
        slot => slot.teacherId === teacher.userId && slot.branchId === branchId
      )
    );
  });
  const branchRooms = state.rooms.filter(room => room.branchId === branchId);
  const activeRooms = branchRooms.filter(
    room => room.status === "active"
  ).length;
  const roomCapacity = branchRooms.reduce(
    (total, room) => total + room.capacity,
    0
  );
  const assignedSeats = branchClasses.reduce(
    (total, group) => total + group.studentIds.length,
    0
  );
  const branchEvents = state.events
    .filter(
      event =>
        event.branchId === branchId ||
        (event.classGroupId ? branchClassIds.has(event.classGroupId) : false)
    )
    .sort(
      (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()
    );
  const todayKey = new Date().toISOString().slice(0, 10);
  const todaySessions = branchSessions.filter(
    session => session.startsAt.slice(0, 10) === todayKey
  );
  const visibleSessions = todaySessions.length
    ? todaySessions
    : branchSessions.slice(0, 4);
  const pendingScheduleReviews = branchEvents.filter(
    event => event.status === "pending"
  );
  const branchAttendance = state.attendance.filter(
    record =>
      branchClassIds.has(record.classGroupId) &&
      branchStudentIds.has(record.studentId)
  );
  const attendanceExceptions = branchAttendance.filter(
    record =>
      record.status === "late" ||
      record.status === "absent" ||
      record.status === "excused"
  );
  const missingAttendance = branchSessions.filter(
    session => !session.attendanceSaved
  );
  const branchInvoices = state.invoices.filter(invoice =>
    branchStudentIds.has(invoice.studentId)
  );
  const paymentRows = branchInvoices.map(invoice => {
    const paid = state.payments
      .filter(
        payment => payment.invoiceId === invoice.id && payment.status === "paid"
      )
      .reduce((sum, payment) => sum + payment.amount, 0);
    return { invoice, paid, balance: Math.max(0, invoice.amount - paid) };
  });
  const openPayments = paymentRows.filter(
    row => row.balance > 0 || row.invoice.status !== "paid"
  );
  const balanceDue = paymentRows.reduce((sum, row) => sum + row.balance, 0);
  const seatUsage = roomCapacity
    ? Math.round((assignedSeats / roomCapacity) * 100)
    : 0;
  const dashboardStats: Stat[] = [
    {
      label: "Classes today",
      value: String(todaySessions.length),
      change: `${branchSessions.length} scheduled`,
      tone: todaySessions.length ? "teal" : "amber",
    },
    {
      label: "Room usage",
      value: `${activeRooms}/${branchRooms.length}`,
      change: `${seatUsage}% seats`,
      tone: activeRooms === branchRooms.length ? "green" : "amber",
    },
    {
      label: "Attendance exceptions",
      value: String(attendanceExceptions.length),
      change: `${missingAttendance.length} unsaved`,
      tone:
        attendanceExceptions.length || missingAttendance.length
          ? "red"
          : "green",
    },
    {
      label: "Payment balance",
      value: `EGP ${balanceDue}`,
      change: `${openPayments.length} open`,
      tone: balanceDue ? "amber" : "green",
    },
  ];
  const branchAttentionItems = [
    {
      label: "Attendance exceptions",
      detail: attendanceExceptions.length
        ? `${attendanceExceptions.length} late, absent, or excused record(s).`
        : "No exception rows for this branch.",
      href: "/app/branch/attendance",
      Icon: AlertTriangle,
      tone: attendanceExceptions.length ? ("red" as const) : ("green" as const),
    },
    {
      label: "Branch payments",
      detail: openPayments.length
        ? `Payment overview: EGP ${balanceDue} balance open.`
        : "Payment overview: queue is clear.",
      href: "/app/branch/payments",
      Icon: CreditCard,
      tone: openPayments.length ? ("amber" as const) : ("green" as const),
    },
    {
      label: "Schedule reviews",
      detail: pendingScheduleReviews.length
        ? `${pendingScheduleReviews.length} pending event(s).`
        : "No schedule review blocker.",
      href: "/app/branch/schedule",
      Icon: CalendarDays,
      tone: pendingScheduleReviews.length
        ? ("amber" as const)
        : ("green" as const),
    },
  ];
  const seatReadinessPoints: InsightPoint[] = branchClasses
    .slice(0, 6)
    .map(classGroup => ({
      label: classGroup.name,
      value: classGroup.capacity
        ? Math.round((classGroup.studentIds.length / classGroup.capacity) * 100)
        : 0,
    }));

  return (
    <PlatformShell role="branchadmin" title="Dashboard">
      <PlatformPageHeader
        compact
        title="Branch overview"
        description="Today’s classes, rooms, attendance, and payments."
        actions={
          <>
            <Link
              href="/app/branch/reports"
              className="platform-secondary-button"
            >
              Reports
            </Link>
            <Link
              href="/app/branch/schedule"
              className="platform-primary-button"
              style={{ background: meta.color }}
            >
              <CalendarDays size={15} />
              Open schedule
            </Link>
          </>
        }
      />

      <motion.div
        className="platform-metric-grid branch-dashboard-metrics"
        initial="hidden"
        animate="visible"
      >
        {dashboardStats.map((stat, index) => (
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
        className="platform-v2-role-main branch-dashboard-v3"
        initial="hidden"
        animate="visible"
        custom={0.14}
        variants={dashboardReveal}
      >
        <div className="platform-v2-role-stack">
          <section className="platform-v2-panel platform-v2-work-summary">
            <PlatformWorkspaceHeader
              title="Today at your branch"
              description={branch?.name ?? "Branch"}
            />
            <div className="platform-v2-summary-body">
              <div className="platform-v2-summary-copy">
                <span>Today’s operations</span>
                <h2>
                  {todaySessions.length
                    ? "Classes are ready for today"
                    : "Review the next branch sessions"}
                </h2>
                <p>
                  {branchStudents.length} learners · {branchTeachers.length}{" "}
                  teachers · {branchClasses.length} classes.
                </p>
                <div className="platform-v2-summary-actions">
                  <Link
                    href="/app/branch/schedule"
                    className="platform-primary-button"
                    style={{ background: meta.color }}
                  >
                    Open schedule
                  </Link>
                  <Link
                    href="/app/branch/rooms"
                    className="platform-secondary-button"
                  >
                    Manage rooms
                  </Link>
                </div>
              </div>
              <div className="platform-v2-summary-facts">
                <article>
                  <span>Room capacity</span>
                  <strong>
                    {assignedSeats}/{roomCapacity || 0}
                  </strong>
                  <small>{activeRooms} active rooms</small>
                </article>
                <article>
                  <span>Attendance to check</span>
                  <strong>
                    {attendanceExceptions.length + missingAttendance.length}
                  </strong>
                  <small>needs review</small>
                </article>
                <article>
                  <span>Open payments</span>
                  <strong>{openPayments.length}</strong>
                  <small>follow-ups due</small>
                </article>
              </div>
            </div>
          </section>

          <section className="platform-v2-panel">
            <PlatformWorkspaceHeader
              title="Next work"
              description={
                todaySessions.length
                  ? "Start with today’s class sessions."
                  : "Review the next scheduled work."
              }
            />
            <div className="platform-v2-dashboard-list">
              {visibleSessions.length ? (
                visibleSessions.map(session => {
                  const group = branchClasses.find(
                    item => item.id === session.classGroupId
                  );
                  const run = branchRuns.find(
                    item => item.id === group?.courseRunId
                  );
                  const teacher = state.users.find(
                    item => item.id === run?.teacherId
                  );
                  return (
                    <Link
                      key={session.id}
                      href="/app/branch/schedule"
                      style={
                        {
                          "--item-color": session.attendanceSaved
                            ? toneColor.green
                            : toneColor.amber,
                        } as CSSProperties
                      }
                    >
                      <div>
                        <strong>{session.title}</strong>
                        <small>
                          {group?.name ?? "Class group"} ·{" "}
                          {teacher?.name ?? "Teacher pending"}
                        </small>
                      </div>
                      <span>
                        {session.attendanceSaved ? "saved" : "attendance due"}
                      </span>
                    </Link>
                  );
                })
              ) : (
                <article>
                  <div>
                    <strong>No scheduled class sessions</strong>
                    <small>
                      Create a branch event to populate the local schedule.
                    </small>
                  </div>
                  <span>empty</span>
                </article>
              )}
              <Link
                href="/app/branch/rooms"
                style={{ "--item-color": toneColor.green } as CSSProperties}
              >
                <div>
                  <strong>Room readiness</strong>
                  <small>
                    {activeRooms}/{branchRooms.length} rooms active ·{" "}
                    {seatUsage}% capacity in use
                  </small>
                </div>
                <span>rooms</span>
              </Link>
            </div>
          </section>
        </div>

        <aside className="platform-v2-panel">
          <PlatformWorkspaceHeader
            title="Needs attention"
            description="Items that need follow-up."
          />
          <div className="platform-v2-attention-list">
            {branchAttentionItems.map(item => (
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
        eyebrow="Branch capacity"
        title="Seat readiness"
        value={`${seatUsage}%`}
        valueLabel="room capacity in use"
        description="Compare enrolled seats across the branch classes that are open now."
        points={seatReadinessPoints}
        variant="bars"
        tone="green"
        testId="branch-dashboard-insight"
      />
    </PlatformShell>
  );
}

function HeadOfDepartmentDashboard() {
  const meta = roleMeta.headofdepartment;
  const state = platformStore.getState();
  const actorUser =
    state.users.find(
      user => user.id === requireActiveUser("headofdepartment").id
    ) ??
    state.users.find(user => user.activeRole === "headofdepartment");
  const departmentIds = new Set(
    state.departments
      .filter(
        department =>
          department.ownerUserId === actorUser?.id ||
          department.id === actorUser?.departmentId
      )
      .map(department => department.id)
  );
  const programIds = new Set(
    state.programs
      .filter(program => departmentIds.has(program.departmentId))
      .map(program => program.id)
  );
  const courseIds = new Set(
    state.courses
      .filter(course => programIds.has(course.programId))
      .map(course => course.id)
  );
  const courseRuns = state.courseRuns.filter(run =>
    courseIds.has(run.courseId)
  );
  const courseRunIds = new Set(courseRuns.map(run => run.id));
  const classes = state.classGroups.filter(group =>
    courseRunIds.has(group.courseRunId)
  );
  const classCapacity = classes.reduce(
    (total, classGroup) => total + classGroup.capacity,
    0
  );
  const enrolledSeats = classes.reduce(
    (total, classGroup) => total + classGroup.studentIds.length,
    0
  );
  const enrollments = state.enrollments.filter(enrollment =>
    courseRunIds.has(enrollment.courseRunId)
  );
  const studentIds = new Set(
    enrollments.map(enrollment => enrollment.studentId)
  );
  const teachers = state.teachers.filter(teacher =>
    departmentIds.has(teacher.departmentId)
  );
  const modules = state.modules.filter(module =>
    courseIds.has(module.courseId)
  );
  const moduleIds = new Set(modules.map(module => module.id));
  const lessons = state.lessons.filter(lesson =>
    moduleIds.has(lesson.moduleId)
  );
  const assignments = state.assignments.filter(assignment =>
    courseRunIds.has(assignment.courseRunId)
  );
  const assignmentIds = new Set(assignments.map(assignment => assignment.id));
  const quizzes = state.quizzes.filter(quiz =>
    courseRunIds.has(quiz.courseRunId)
  );
  const quizIds = new Set(quizzes.map(quiz => quiz.id));
  const completedAssessmentRows =
    state.assignmentSubmissions.filter(
      submission =>
        assignmentIds.has(submission.assignmentId) &&
        submission.status === "completed"
    ).length +
    state.quizAttempts.filter(
      attempt => quizIds.has(attempt.quizId) && attempt.status === "completed"
    ).length;
  const expectedAssessmentRows =
    studentIds.size * (assignments.length + quizzes.length);
  const assessmentCompletion = expectedAssessmentRows
    ? Math.round((completedAssessmentRows / expectedAssessmentRows) * 100)
    : 0;
  const certificates = state.certificates.filter(
    certificate =>
      courseIds.has(certificate.courseId) &&
      studentIds.has(certificate.studentId)
  );
  const pendingCertificates = certificates.filter(
    certificate => certificate.status === "pending_approval"
  ).length;
  const atRiskEnrollments = enrollments.filter(
    enrollment =>
      enrollment.attendanceRate < 85 ||
      enrollment.currentGrade < 80 ||
      enrollment.progress < 55
  );
  const activeCourses = state.courses.filter(
    course => courseIds.has(course.id) && course.status === "active"
  ).length;
  const curriculumCoverage = modules.length
    ? Math.min(100, Math.round((lessons.length / (modules.length * 3)) * 100))
    : 0;
  const seatUsage = classCapacity
    ? Math.round((enrolledSeats / classCapacity) * 100)
    : 0;
  const hodStats = [
    {
      label: "Department courses",
      value: String(courseIds.size),
      change: `${activeCourses} active`,
      tone: "teal" as const,
    },
    {
      label: "Curriculum coverage",
      value: `${curriculumCoverage}%`,
      change: `${lessons.length} lessons`,
      tone: "amber" as const,
    },
    {
      label: "Teacher load",
      value: String(teachers.length),
      change: `${classes.length} classes`,
      tone: "green" as const,
    },
    {
      label: "Learners to review",
      value: String(atRiskEnrollments.length),
      change: pendingCertificates
        ? `${pendingCertificates} approval(s)`
        : "No approvals due",
      tone: atRiskEnrollments.length ? ("red" as const) : ("teal" as const),
    },
  ];
  const academicTaskItems = [
    {
      label: "Curriculum plan",
      detail: `${modules.length} modules mapped across ${courseIds.size} courses.`,
      href: "/app/hod/curriculum",
      meta: `${curriculumCoverage}%`,
      tone: curriculumCoverage >= 80 ? ("green" as const) : ("amber" as const),
    },
    {
      label: "Teaching teams",
      detail: `${teachers.length} teachers supporting ${classes.length} classes.`,
      href: "/app/hod/teachers",
      meta: `${teachers.length} teachers`,
      tone: "teal" as const,
    },
    {
      label: "Assessment queue",
      detail: `${completedAssessmentRows}/${expectedAssessmentRows || 0} learning records complete.`,
      href: "/app/hod/assessments",
      meta: `${assessmentCompletion}%`,
      tone:
        assessmentCompletion >= 75 ? ("green" as const) : ("amber" as const),
    },
  ];
  const hodAttentionItems = [
    {
      label: "Certificate decisions",
      detail: pendingCertificates
        ? `${pendingCertificates} certificate(s) need approval.`
        : `${certificates.length} certificates tracked.`,
      href: "/app/hod/certificates",
      Icon: Award,
      tone: pendingCertificates ? ("red" as const) : ("green" as const),
    },
    {
      label: "Learners needing review",
      detail: atRiskEnrollments.length
        ? `${atRiskEnrollments.length} learner(s) need academic review.`
        : "No learner risk above threshold.",
      href: "/app/hod/reports",
      Icon: AlertTriangle,
      tone: atRiskEnrollments.length ? ("amber" as const) : ("green" as const),
    },
    {
      label: "Curriculum gaps",
      detail:
        curriculumCoverage >= 80
          ? "Coverage is on track."
          : "Map the next lessons and outcomes.",
      href: "/app/hod/curriculum",
      Icon: BookOpen,
      tone: curriculumCoverage >= 80 ? ("green" as const) : ("amber" as const),
    },
  ];
  const curriculumInsightPoints: InsightPoint[] = state.courses
    .filter(course => courseIds.has(course.id))
    .slice(0, 6)
    .map(course => {
      const courseModules = modules.filter(
        module => module.courseId === course.id
      );
      const courseLessonCount = lessons.filter(lesson =>
        courseModules.some(module => module.id === lesson.moduleId)
      ).length;
      return {
        label: course.title,
        value: courseModules.length
          ? Math.min(
              100,
              Math.round((courseLessonCount / (courseModules.length * 3)) * 100)
            )
          : 0,
      };
    });

  return (
    <PlatformShell role="headofdepartment" title="Dashboard">
      <PlatformPageHeader
        compact
        title="Academic overview"
        description="Review curriculum, teaching, and approvals for your department."
        actions={
          <>
            <Link href="/app/hod/reports" className="platform-secondary-button">
              Reports
            </Link>
            <Link
              href="/app/hod/courses"
              className="platform-primary-button"
              style={{ background: meta.color }}
            >
              <Plus size={15} />
              Review curriculum
            </Link>
          </>
        }
      />

      <motion.div
        className="platform-metric-grid hod-dashboard-metrics"
        initial="hidden"
        animate="visible"
      >
        {hodStats.map((stat, index) => (
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
        className="platform-v2-role-main hod-dashboard-v3"
        initial="hidden"
        animate="visible"
        custom={0.16}
        variants={dashboardReveal}
      >
        <div className="platform-v2-role-stack">
          <section className="platform-v2-panel platform-v2-work-summary">
            <PlatformWorkspaceHeader
              title="Academic focus"
              description={
                state.departments
                  .filter(department => departmentIds.has(department.id))
                  .map(department => department.name)
                  .join(", ") || "Department scope"
              }
            />
            <div className="platform-v2-summary-body">
              <div className="platform-v2-summary-copy">
                <span>Department overview</span>
                <h2>{curriculumCoverage}% of the curriculum is mapped</h2>
                <p>
                  {activeCourses} active courses · {teachers.length} teachers ·{" "}
                  {classes.length} classes.
                </p>
                <div className="platform-v2-summary-actions">
                  <Link
                    href="/app/hod/curriculum"
                    className="platform-primary-button"
                    style={{ background: meta.color }}
                  >
                    Open curriculum
                  </Link>
                  <Link
                    href="/app/hod/moodle-source"
                    className="platform-secondary-button"
                  >
                    Course content
                  </Link>
                </div>
              </div>
              <div className="platform-v2-summary-facts">
                <article>
                  <span>Class capacity</span>
                  <strong>{seatUsage}%</strong>
                  <small>
                    {enrolledSeats}/{classCapacity || 0} seats
                  </small>
                </article>
                <article>
                  <span>Assessment progress</span>
                  <strong>{assessmentCompletion}%</strong>
                  <small>completion</small>
                </article>
                <article>
                  <span>Certificate decisions</span>
                  <strong>{pendingCertificates}</strong>
                  <small>awaiting action</small>
                </article>
              </div>
            </div>
          </section>

          <section className="platform-v2-panel">
            <PlatformWorkspaceHeader
              title="Work to review"
              description="Choose the next academic task."
            />
            <div className="platform-v2-dashboard-list">
              {academicTaskItems.map(item => (
                <Link
                  key={item.label}
                  href={item.href}
                  style={
                    { "--item-color": toneColor[item.tone] } as CSSProperties
                  }
                >
                  <div>
                    <strong>{item.label}</strong>
                    <small>{item.detail}</small>
                  </div>
                  <span>{item.meta}</span>
                </Link>
              ))}
            </div>
          </section>
        </div>

        <aside className="platform-v2-panel">
          <PlatformWorkspaceHeader
            title="Needs attention"
            description="Items that need a decision or follow-up."
          />
          <div className="platform-v2-attention-list">
            {hodAttentionItems.map(item => (
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
        eyebrow="Curriculum health"
        title="Coverage by course"
        value={`${curriculumCoverage}%`}
        valueLabel="department curriculum mapped"
        description="Compare lesson coverage across the courses in your academic scope."
        points={curriculumInsightPoints}
        variant="bars"
        tone="purple"
        testId="hod-dashboard-insight"
      />
    </PlatformShell>
  );
}

function SuperAdminDashboard() {
  const meta = roleMeta.superadmin;
  const state = useMemo(() => platformStore.getState(), []);
  const activeUsers = state.users.filter(
    user => user.status === "active"
  ).length;
  const activeStudents = state.students.filter(
    student => student.status === "active"
  ).length;
  const activeClasses = state.classGroups.length;
  const pendingInvoices = state.invoices.filter(
    invoice => invoice.status !== "paid" && invoice.status !== "cancelled"
  ).length;
  const pausedUsers = state.users.filter(
    user => user.status !== "active"
  ).length;
  const pendingCertificates = state.certificates.filter(
    certificate => certificate.status === "pending_approval"
  ).length;
  const itemsNeedingReview =
    pausedUsers + pendingInvoices + pendingCertificates;
  const superAdminStats: Stat[] = [
    {
      label: "Active users",
      value: String(activeUsers),
      change: `${state.users.length} accounts`,
      tone: "teal",
    },
    {
      label: "Active learners",
      value: String(activeStudents),
      change: `${state.enrollments.length} enrollments`,
      tone: "green",
    },
    {
      label: "Class groups",
      value: String(activeClasses),
      change: `${state.events.length} scheduled`,
      tone: "amber",
    },
    {
      label: "Needs review",
      value: String(itemsNeedingReview),
      change: "Access, finance, certificates",
      tone: itemsNeedingReview ? "amber" : "green",
    },
  ];
  const administrationTiles = [
    {
      label: "Users & roles",
      description: "Accounts, roles, and access level.",
      metric: `${activeUsers} active users`,
      href: "/app/admin/users",
      Icon: Users,
      tone: "teal" as Stat["tone"],
    },
    {
      label: "Academic structure",
      description: "Departments, programs, courses, certificates.",
      metric: `${state.courses.length} courses`,
      href: "/app/admin/courses",
      Icon: BookOpen,
      tone: "purple" as Stat["tone"],
    },
    {
      label: "Branch operations",
      description: "Branches, rooms, schedules, local delivery.",
      metric: `${state.branches.length} branches`,
      href: "/app/admin/branches",
      Icon: Building2,
      tone: "green" as Stat["tone"],
    },
    {
      label: "Admissions & finance",
      description: "Enrollment, placement, invoices, reports.",
      metric: `${pendingInvoices} pending payments`,
      href: "/app/admin/reports",
      Icon: CreditCard,
      tone: "amber" as Stat["tone"],
    },
    {
      label: "Activity & health",
      description: "Activity, settings, connections, checks.",
      metric: `${state.auditLogs.length} activity events`,
      href: "/app/admin/system-health",
      Icon: Activity,
      tone: "slate" as Stat["tone"],
    },
  ];
  const latestAudit = state.auditLogs[0];
  const attentionItems = [
    {
      label: pausedUsers ? "Review paused access" : "Access review current",
      detail: pausedUsers
        ? `${pausedUsers} account(s) are not active.`
        : "No paused accounts in this workspace.",
      href: "/app/admin/users",
      Icon: Users,
      tone: pausedUsers ? ("amber" as Stat["tone"]) : ("green" as Stat["tone"]),
    },
    {
      label: pendingInvoices ? "Finance follow-up" : "Finance queue clear",
      detail: pendingInvoices
        ? `${pendingInvoices} invoice(s) need a decision.`
        : "No open payment exception.",
      href: "/app/admin/reports",
      Icon: CreditCard,
      tone: pendingInvoices
        ? ("amber" as Stat["tone"])
        : ("green" as Stat["tone"]),
    },
    {
      label: pendingCertificates
        ? "Certificate approvals"
        : "Certificate queue clear",
      detail: pendingCertificates
        ? `${pendingCertificates} certificate(s) need approval.`
        : "No certificate approval blockers.",
      href: "/app/admin/certificates",
      Icon: Award,
      tone: pendingCertificates
        ? ("red" as Stat["tone"])
        : ("green" as Stat["tone"]),
    },
    {
      label: "Review latest activity",
      detail:
        latestAudit?.summary ?? "Activity will appear after admin actions.",
      href: "/app/admin/audit-logs",
      Icon: ScrollText,
      tone: "slate" as Stat["tone"],
    },
  ];
  const recentAudits = state.auditLogs.slice(0, 4);
  return (
    <PlatformShell role="superadmin" title="Command center">
      <PlatformPageHeader
        compact
        title="Platform overview"
        description="Open the area that needs attention and continue the next admin task."
        actions={
          <>
            <Link
              href="/app/admin/audit-logs"
              className="platform-secondary-button"
            >
              View activity
            </Link>
            <Link
              href="/app/admin/users/new"
              className="platform-primary-button"
              style={{ background: meta.color }}
            >
              <Plus size={15} />
              Create user
            </Link>
          </>
        }
      />

      <motion.div
        className="platform-metric-grid platform-admin-metric-grid"
        initial="hidden"
        animate="visible"
      >
        {superAdminStats.map((stat, index) => (
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
        className="platform-v2-admin-main"
        initial="hidden"
        animate="visible"
        custom={0.14}
        variants={dashboardReveal}
      >
        <section className="platform-v2-panel platform-v2-admin-map">
          <PlatformWorkspaceHeader
            title="Administration map"
            description="Open the workspaces used most by platform operations."
            actions={
              <Link
                href="/app/admin/platform-blueprint"
                className="platform-secondary-button compact"
              >
                Blueprint
              </Link>
            }
          />
          <div className="platform-v2-workflow-tiles">
            {administrationTiles.map(item => (
              <Link
                key={item.label}
                href={item.href}
                className="platform-v2-workflow-tile"
                style={
                  { "--item-color": toneColor[item.tone] } as CSSProperties
                }
              >
                <span>
                  <item.Icon size={18} />
                </span>
                <div>
                  <strong>{item.label}</strong>
                  <p>{item.description}</p>
                  <small>{item.metric}</small>
                </div>
                <ArrowRight size={15} />
              </Link>
            ))}
          </div>
        </section>

        <aside className="platform-v2-panel platform-v2-attention-panel">
          <PlatformWorkspaceHeader
            title="Needs attention"
            description="Actionable items worth opening now."
          />
          <div className="platform-v2-attention-list">
            {attentionItems.map(item => (
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

      <motion.div
        className="platform-v2-admin-activity"
        initial="hidden"
        animate="visible"
        custom={0.2}
        variants={dashboardReveal}
      >
        <section className="platform-v2-panel">
          <PlatformWorkspaceHeader
            title="Recent activity"
            description="Latest administrative workflow updates."
            actions={
              <Link
                href="/app/admin/audit-logs"
                className="platform-secondary-button compact"
              >
                Open activity
              </Link>
            }
          />
          <div className="platform-v2-audit-list">
            {recentAudits.length ? (
              recentAudits.map(audit => (
                <article key={audit.id}>
                  <div>
                    <strong>{audit.action}</strong>
                    <small>{audit.summary}</small>
                  </div>
                  <span>{formatStudentDate(audit.createdAt)}</span>
                </article>
              ))
            ) : (
              <article>
                <div>
                  <strong>No activity</strong>
                  <small>Administrative actions will appear here.</small>
                </div>
                <span>Ready</span>
              </article>
            )}
          </div>
        </section>
      </motion.div>
    </PlatformShell>
  );
}
