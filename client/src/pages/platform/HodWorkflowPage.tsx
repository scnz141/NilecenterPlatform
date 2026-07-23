import { requireActiveUser } from "@/lib/auth/session";
import { useMemo, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  GraduationCap,
  Plus,
  Search,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { Link } from "wouter";
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
import type { PlatformWorkflowAction } from "@/lib/domain/actions";
import { platformStore } from "@/lib/domain/store";
import type {
  Assignment,
  AssignmentSubmission,
  Certificate,
  PlatformState,
} from "@/lib/domain/types";

type HodWorkflowPageId =
  | "courses"
  | "curriculum"
  | "schedule"
  | "assessments"
  | "certificates";

type HodWorkflowPageProps = {
  pageId: HodWorkflowPageId;
  mode?:
    | "list"
    | "create"
    | "review"
    | "review-detail"
    | "sessions"
    | "course-detail"
    | "certificate-detail";
  courseId?: string;
  certificateId?: string;
  reviewSubmissionId?: string;
};

type CourseStatus = "draft" | "active" | "paused" | "completed";

type ScopedHodData = {
  actorId: string;
  state: PlatformState;
  departmentIds: Set<string>;
  programs: PlatformState["programs"];
  programIds: Set<string>;
  courses: PlatformState["courses"];
  courseIds: Set<string>;
  courseRuns: PlatformState["courseRuns"];
  courseRunIds: Set<string>;
  classGroups: PlatformState["classGroups"];
  classGroupIds: Set<string>;
};

const pageCopy: Record<
  HodWorkflowPageId,
  { title: string; description: string; context: string }
> = {
  courses: {
    title: "Courses",
    description: "Review course status and academic ownership.",
    context: "Academic",
  },
  curriculum: {
    title: "Curriculum",
    description: "Add and review modules for one course at a time.",
    context: "Academic",
  },
  schedule: {
    title: "Schedule",
    description: "Review classes and sessions in your department scope.",
    context: "Academic",
  },
  assessments: {
    title: "Assessments",
    description: "Create assessment work and review pending submissions.",
    context: "Academic",
  },
  certificates: {
    title: "Certificates",
    description: "Approve, issue, or reject certificate requests.",
    context: "Academic",
  },
};

const courseStatuses: CourseStatus[] = [
  "draft",
  "active",
  "paused",
  "completed",
];

const submissionTypes: Assignment["submissionType"][] = [
  "text",
  "file",
  "audio",
  "video",
];

function humanize(value?: string) {
  if (!value) return "Not set";
  return value
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, character => character.toUpperCase());
}

function statusTone(status: string): "green" | "amber" | "red" | "slate" {
  if (
    [
      "active",
      "approved",
      "issued",
      "completed",
      "present",
      "available",
    ].includes(status)
  ) {
    return "green";
  }
  if (
    ["draft", "pending", "pending_approval", "late", "overdue"].includes(status)
  ) {
    return "amber";
  }
  if (
    ["paused", "rejected", "revoked", "cancelled", "absent"].includes(status)
  ) {
    return "red";
  }
  return "slate";
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

function getFutureDateInput(days = 7) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function buildHodScope(state: PlatformState): ScopedHodData {
  const actorId = requireActiveUser("headofdepartment").id;
  const actor = state.users.find(user => user.id === actorId);
  const departments = state.departments.filter(
    department =>
      department.ownerUserId === actorId ||
      department.id === actor?.departmentId
  );
  const departmentIds = new Set(departments.map(department => department.id));
  const programs = state.programs.filter(program =>
    departmentIds.has(program.departmentId)
  );
  const programIds = new Set(programs.map(program => program.id));
  const courses = state.courses.filter(course =>
    programIds.has(course.programId)
  );
  const courseIds = new Set(courses.map(course => course.id));
  const courseRuns = state.courseRuns.filter(run =>
    courseIds.has(run.courseId)
  );
  const courseRunIds = new Set(courseRuns.map(run => run.id));
  const classGroups = state.classGroups.filter(group =>
    courseRunIds.has(group.courseRunId)
  );
  const classGroupIds = new Set(classGroups.map(group => group.id));

  return {
    actorId,
    state,
    departmentIds,
    programs,
    programIds,
    courses,
    courseIds,
    courseRuns,
    courseRunIds,
    classGroups,
    classGroupIds,
  };
}

function findCourseTitle(scope: ScopedHodData, courseId?: string) {
  return (
    scope.courses.find(course => course.id === courseId)?.title ??
    "Course not set"
  );
}

function findRunTitle(scope: ScopedHodData, courseRunId?: string) {
  const run = scope.courseRuns.find(item => item.id === courseRunId);
  const course = scope.courses.find(item => item.id === run?.courseId);
  return run && course ? `${course.title} · ${run.term}` : "Course run";
}

function findStudentName(state: PlatformState, studentId?: string) {
  const student = state.students.find(item => item.id === studentId);
  return (
    state.users.find(user => user.id === student?.userId)?.name ?? "Student"
  );
}

function normalizeStatusClass(status: string) {
  return status.replace(/[_\s]/g, "-");
}

export default function HodWorkflowPage({
  pageId,
  mode = "list",
  courseId,
  certificateId,
  reviewSubmissionId,
}: HodWorkflowPageProps) {
  const [state, setState] = useState(() => platformStore.getState());
  const [query, setQuery] = useState("");
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [selectedCourseId, setSelectedCourseId] = useState("course_ar_l3");
  const [selectedRunId, setSelectedRunId] = useState("run_ar_l3_2026");
  const [moduleTitle, setModuleTitle] = useState("");
  const [moduleOutcomes, setModuleOutcomes] = useState("");
  const [assignmentTitle, setAssignmentTitle] = useState("");
  const [assignmentSubmission, setAssignmentSubmission] =
    useState<Assignment["submissionType"]>("text");
  const [assignmentDueAt, setAssignmentDueAt] = useState(getFutureDateInput());
  const [assignmentRubric, setAssignmentRubric] = useState(
    "Accuracy, Evidence, Teacher notes"
  );
  const [selectedSubmissionId] = useState("sub_ar_grammar_draft");
  const [gradeScore, setGradeScore] = useState(89);
  const [gradeFeedback, setGradeFeedback] = useState(
    "Clear answer. Keep evidence specific."
  );

  const scope = useMemo(() => buildHodScope(state), [state]);
  const copy = pageCopy[pageId];
  const visibleCourses = scope.courses.filter(course => {
    const program = scope.programs.find(item => item.id === course.programId);
    const text =
      `${course.title} ${course.description} ${course.status} ${program?.title ?? ""}`.toLowerCase();
    return !query.trim() || text.includes(query.trim().toLowerCase());
  });
  const selectedCourse =
    scope.courses.find(course => course.id === selectedCourseId) ??
    scope.courses[0];
  const selectedRun =
    scope.courseRuns.find(run => run.id === selectedRunId) ??
    scope.courseRuns.find(run => run.courseId === selectedCourse?.id) ??
    scope.courseRuns[0];

  const updateFromResponse = (nextState: PlatformState) => {
    platformStore.setState(nextState);
    setState(nextState);
  };

  const runAction = async (action: PlatformWorkflowAction, success: string) => {
    setBusyKey(action.type);
    const response = await runPlatformWorkflowActionRequest(action);
    setBusyKey(null);
    if (!response.ok || !response.data) {
      toast.error(response.error ?? "Action failed");
      return false;
    }
    updateFromResponse(response.data.state);
    toast.success(success);
    return true;
  };

  const courseActions = {
    updateStatus: (courseId: string, status: CourseStatus) =>
      runAction(
        {
          type: "course.status.update",
          courseId,
          status,
          actorId: scope.actorId,
        },
        "Course status updated"
      ),
  };

  const curriculumActions = {
    addModule: async () => {
      const title = moduleTitle.trim();
      const outcomes = moduleOutcomes
        .split(/\n|,/)
        .map(item => item.trim())
        .filter(Boolean);
      if (!selectedCourse || !title) {
        toast.error("Add a module title first.");
        return false;
      }
      const saved = await runAction(
        {
          type: "curriculum.module.create",
          courseId: selectedCourse.id,
          title,
          outcomes,
          actorId: scope.actorId,
        },
        "Module added"
      );
      if (saved) {
        setModuleTitle("");
        setModuleOutcomes("");
      }
      return saved;
    },
  };

  const assessmentActions = {
    createAssignment: async () => {
      if (!selectedRun || !assignmentTitle.trim()) {
        toast.error("Add an assignment title first.");
        return false;
      }
      const saved = await runAction(
        {
          type: "assignment.create",
          courseRunId: selectedRun.id,
          title: assignmentTitle.trim(),
          dueAt: new Date(assignmentDueAt).toISOString(),
          submissionType: assignmentSubmission,
          rubric: assignmentRubric
            .split(/\n|,/)
            .map(item => item.trim())
            .filter(Boolean),
          actorId: scope.actorId,
        },
        "Assignment created"
      );
      if (saved) setAssignmentTitle("");
      return saved;
    },
    gradeSubmission: (submissionId = selectedSubmissionId) => {
      if (!submissionId) {
        toast.error("Choose a submission first.");
        return Promise.resolve(false);
      }
      return runAction(
        {
          type: "assignment.grade",
          submissionId,
          score: Math.min(100, Math.max(0, Number(gradeScore) || 0)),
          feedback: gradeFeedback.trim() || "Reviewed by HOD.",
          actorId: scope.actorId,
        },
        "Submission graded"
      );
    },
  };

  const certificateActions = {
    approve: (certificateId: string) =>
      runAction(
        {
          type: "certificate.approve",
          certificateId,
          actorId: scope.actorId,
        },
        "Certificate approved"
      ),
    issue: (certificateId: string) =>
      runAction(
        {
          type: "certificate.issue",
          certificateId,
          actorId: scope.actorId,
        },
        "Certificate issued"
      ),
    reject: async (certificateId: string, reason: string) => {
      const trimmedReason = reason.trim();
      if (!trimmedReason) {
        toast.error("Add a reject reason first.");
        return false;
      }
      return runAction(
        {
          type: "certificate.reject",
          certificateId,
          reason: trimmedReason,
          actorId: scope.actorId,
        },
        "Certificate rejected"
      );
    },
  };

  const isCurriculumCreate = pageId === "curriculum" && mode === "create";
  const isAssessmentCreate = pageId === "assessments" && mode === "create";
  const isAssessmentReview = pageId === "assessments" && mode === "review";
  const isAssessmentReviewDetail =
    pageId === "assessments" && mode === "review-detail";
  const isScheduleSessions = pageId === "schedule" && mode === "sessions";
  const isCourseDetail = pageId === "courses" && mode === "course-detail";
  const detailCourse = isCourseDetail
    ? scope.courses.find(course => course.id === courseId)
    : undefined;
  const isCertificateDetail =
    pageId === "certificates" && mode === "certificate-detail";
  const detailCertificate = isCertificateDetail
    ? scope.state.certificates.find(
        certificate => certificate.id === certificateId
      )
    : undefined;
  const isFormFlow = isCurriculumCreate || isAssessmentCreate;

  const toolbar =
    pageId === "courses" ? (
      <div
        className="hod-compact-toolbar hod-workflow-toolbar-v3"
        data-testid="hod-courses-toolbar"
      >
        <label>
          Search
          <span>
            <Search size={15} />
            <input
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder="Search courses"
            />
          </span>
        </label>
      </div>
    ) : pageId === "curriculum" ||
      (pageId === "assessments" &&
        !isAssessmentCreate &&
        !isAssessmentReviewDetail) ? (
      <div
        className="hod-compact-toolbar hod-workflow-toolbar-v3"
        data-testid={`hod-${pageId}-toolbar`}
      >
        <label>
          Course
          <select
            value={selectedCourse?.id ?? ""}
            onChange={event => {
              setSelectedCourseId(event.target.value);
              const nextRun = scope.courseRuns.find(
                run => run.courseId === event.target.value
              );
              if (nextRun) setSelectedRunId(nextRun.id);
            }}
          >
            {scope.courses.map(course => (
              <option key={course.id} value={course.id}>
                {course.title}
              </option>
            ))}
          </select>
        </label>
        {pageId === "assessments" ? (
          <label>
            Class run
            <select
              value={selectedRun?.id ?? ""}
              onChange={event => setSelectedRunId(event.target.value)}
            >
              {scope.courseRuns
                .filter(
                  run => !selectedCourse || run.courseId === selectedCourse.id
                )
                .map(run => (
                  <option key={run.id} value={run.id}>
                    {run.term}
                  </option>
                ))}
            </select>
          </label>
        ) : null}
      </div>
    ) : null;

  const Layout =
    isAssessmentReviewDetail || isCourseDetail || isCertificateDetail
      ? DetailLayout
      : isFormFlow
        ? FormFlowLayout
        : WorkspaceLayout;
  const layoutTitle = isCurriculumCreate
    ? "Add module"
    : isAssessmentCreate
      ? "New assignment"
      : isCourseDetail
        ? (detailCourse?.title ?? "Course")
        : isCertificateDetail
          ? "Certificate request"
          : isAssessmentReview
            ? "Assessment review"
            : isAssessmentReviewDetail
              ? "Review submission"
              : isScheduleSessions
                ? "Sessions"
                : copy.title;
  const layoutDescription = isCurriculumCreate
    ? "Add one learning module to the selected course."
    : isAssessmentCreate
      ? "Set one clear assignment for a selected class."
      : isCourseDetail
        ? (detailCourse?.description ??
          "Review this course and its academic status.")
        : isCertificateDetail
          ? "Review one learner certificate request and record the decision."
          : isAssessmentReview
            ? "Work that needs an academic decision."
            : isAssessmentReviewDetail
              ? "Review one learner submission and record the result."
              : isScheduleSessions
                ? "Review upcoming department sessions and attendance follow-up."
                : copy.description;
  const pageActions = isCurriculumCreate ? (
    <Link className="platform-secondary-button" href="/app/hod/curriculum">
      Cancel
    </Link>
  ) : isAssessmentCreate ? (
    <Link className="platform-secondary-button" href="/app/hod/assessments">
      Cancel
    </Link>
  ) : isCourseDetail ? (
    <Link className="platform-secondary-button" href="/app/hod/courses">
      Back to courses
    </Link>
  ) : isCertificateDetail ? (
    <Link className="platform-secondary-button" href="/app/hod/certificates">
      Back to certificates
    </Link>
  ) : isAssessmentReviewDetail ? (
    <Link
      className="platform-secondary-button"
      href="/app/hod/assessments/review"
    >
      Back to review queue
    </Link>
  ) : isAssessmentReview ? (
    <Link className="platform-secondary-button" href="/app/hod/assessments">
      Back to assignments
    </Link>
  ) : isScheduleSessions ? (
    <Link className="platform-secondary-button" href="/app/hod/schedule">
      Back to class schedule
    </Link>
  ) : pageId === "curriculum" ? (
    <Link className="platform-primary-button" href="/app/hod/curriculum/new">
      <Plus size={15} />
      Add module
    </Link>
  ) : pageId === "assessments" ? (
    <>
      <Link
        className="platform-secondary-button"
        href="/app/hod/assessments/review"
      >
        Review queue
      </Link>
      <Link className="platform-primary-button" href="/app/hod/assessments/new">
        <Plus size={15} />
        New assignment
      </Link>
    </>
  ) : pageId === "schedule" ? (
    <Link
      className="platform-secondary-button"
      href="/app/hod/schedule/sessions"
    >
      View sessions
    </Link>
  ) : undefined;

  return (
    <PlatformShell role="headofdepartment" title={layoutTitle}>
      <Layout
        className={`hod-workflow-page hod-${pageId}-page${isCurriculumCreate ? " hod-curriculum-create-page" : ""}${isAssessmentCreate ? " hod-assessments-create-page" : ""}${isAssessmentReview ? " hod-assessments-review-page" : ""}${isAssessmentReviewDetail ? " hod-assessment-review-detail-page" : ""}${isScheduleSessions ? " hod-schedule-sessions-page" : ""}${isCourseDetail ? " hod-course-detail-page" : ""}${isCertificateDetail ? " hod-certificate-detail-page" : ""}`}
        title={layoutTitle}
        description={layoutDescription}
        context={copy.context}
        actions={pageActions}
        toolbar={toolbar}
        main={
          pageId === "courses" ? (
            isCourseDetail ? (
              <CourseDetailMain
                scope={scope}
                course={detailCourse}
                updateStatus={courseActions.updateStatus}
                busyKey={busyKey}
              />
            ) : (
              <CoursesMain scope={scope} courses={visibleCourses} />
            )
          ) : pageId === "curriculum" ? (
            <CurriculumMain
              scope={scope}
              selectedCourse={selectedCourse}
              moduleTitle={moduleTitle}
              moduleOutcomes={moduleOutcomes}
              setModuleTitle={setModuleTitle}
              setModuleOutcomes={setModuleOutcomes}
              addModule={curriculumActions.addModule}
              busyKey={busyKey}
              mode={isCurriculumCreate ? "create" : "list"}
            />
          ) : pageId === "schedule" ? (
            <ScheduleMain
              scope={scope}
              view={isScheduleSessions ? "sessions" : "classes"}
            />
          ) : pageId === "assessments" ? (
            <AssessmentsMain
              scope={scope}
              view={
                isAssessmentCreate
                  ? "create"
                  : isAssessmentReview
                    ? "review"
                    : isAssessmentReviewDetail
                      ? "review-detail"
                      : "list"
              }
              selectedCourse={selectedCourse}
              selectedRun={selectedRun}
              reviewSubmissionId={reviewSubmissionId}
              assignmentTitle={assignmentTitle}
              assignmentSubmission={assignmentSubmission}
              assignmentDueAt={assignmentDueAt}
              assignmentRubric={assignmentRubric}
              selectedSubmissionId={selectedSubmissionId}
              gradeScore={gradeScore}
              gradeFeedback={gradeFeedback}
              setAssignmentTitle={setAssignmentTitle}
              setAssignmentSubmission={setAssignmentSubmission}
              setAssignmentDueAt={setAssignmentDueAt}
              setAssignmentRubric={setAssignmentRubric}
              setSelectedCourseId={setSelectedCourseId}
              setSelectedRunId={setSelectedRunId}
              setGradeScore={setGradeScore}
              setGradeFeedback={setGradeFeedback}
              createAssignment={assessmentActions.createAssignment}
              gradeSubmission={assessmentActions.gradeSubmission}
              busyKey={busyKey}
            />
          ) : isCertificateDetail ? (
            <CertificateDetailMain
              scope={scope}
              certificate={detailCertificate}
              approveCertificate={certificateActions.approve}
              issueCertificate={certificateActions.issue}
              rejectCertificate={certificateActions.reject}
              busyKey={busyKey}
            />
          ) : (
            <CertificatesMain scope={scope} />
          )
        }
      />
    </PlatformShell>
  );
}

function CoursesMain({
  scope,
  courses,
}: {
  scope: ScopedHodData;
  courses: PlatformState["courses"];
}) {
  return (
    <DataTableCard title="Courses" subtitle={`${courses.length} available`}>
      <div className="hod-course-list" data-testid="hod-courses-list">
        {courses.map(course => {
          const program = scope.programs.find(
            item => item.id === course.programId
          );
          const modules = scope.state.modules.filter(
            module => module.courseId === course.id
          );
          return (
            <article key={course.id}>
              <div className="hod-course-list-copy">
                <span>{program?.title ?? "Academic program"}</span>
                <strong>{course.title}</strong>
                <p>{course.description}</p>
              </div>
              <div className="hod-course-list-meta">
                <StatusBadge tone={statusTone(course.status)}>
                  {humanize(course.status)}
                </StatusBadge>
                <small>{modules.length} modules</small>
                <Link
                  className="hod-table-action"
                  href={`/app/hod/courses/${course.id}`}
                >
                  Open course <ArrowRight size={14} />
                </Link>
              </div>
            </article>
          );
        })}
        {!courses.length ? (
          <div className="platform-empty-state">
            <strong>No courses match this search.</strong>
            <span>Try a different course name or clear the search.</span>
          </div>
        ) : null}
      </div>
    </DataTableCard>
  );
}

function CourseDetailMain({
  scope,
  course,
  updateStatus,
  busyKey,
}: {
  scope: ScopedHodData;
  course?: PlatformState["courses"][number];
  updateStatus: (courseId: string, status: CourseStatus) => Promise<boolean>;
  busyKey: string | null;
}) {
  const [nextStatus, setNextStatus] = useState<CourseStatus>(() => {
    const current = course?.status as CourseStatus | undefined;
    return current && courseStatuses.includes(current) ? current : "draft";
  });
  const [saved, setSaved] = useState(false);

  if (!course) {
    return (
      <DataTableCard title="Course not found">
        <div className="platform-empty-state">
          <strong>This course is not available in your department.</strong>
          <span>Return to the course list and choose another course.</span>
        </div>
      </DataTableCard>
    );
  }

  const program = scope.programs.find(item => item.id === course.programId);
  const modules = scope.state.modules
    .filter(module => module.courseId === course.id)
    .sort((first, second) => first.order - second.order);
  const runs = scope.courseRuns.filter(run => run.courseId === course.id);

  return (
    <section className="hod-course-detail" data-testid="hod-course-detail">
      <header className="hod-course-detail-head">
        <div>
          <span>Course overview</span>
          <h2>{course.title}</h2>
          <p>{course.description}</p>
        </div>
        <StatusBadge tone={statusTone(course.status)}>
          {humanize(course.status)}
        </StatusBadge>
      </header>
      <dl className="hod-course-facts">
        <div>
          <dt>Program</dt>
          <dd>{program?.title ?? "Program not set"}</dd>
        </div>
        <div>
          <dt>Modules</dt>
          <dd>{modules.length}</dd>
        </div>
        <div>
          <dt>Class runs</dt>
          <dd>{runs.length}</dd>
        </div>
      </dl>
      <section className="hod-course-outcomes">
        <span>Learning outcomes</span>
        <ul>
          {course.outcomes.map(outcome => (
            <li key={outcome}>{outcome}</li>
          ))}
        </ul>
      </section>
      <form
        className="hod-course-status-form"
        data-testid="hod-course-status-form"
        onSubmit={async event => {
          event.preventDefault();
          if (await updateStatus(course.id, nextStatus)) setSaved(true);
        }}
      >
        <div>
          <span>Course status</span>
          <strong>Choose the current academic state.</strong>
          <small>Changes are recorded in the activity log.</small>
        </div>
        <label>
          Status
          <select
            value={nextStatus}
            onChange={event => {
              setNextStatus(event.target.value as CourseStatus);
              setSaved(false);
            }}
            disabled={busyKey === "course.status.update"}
          >
            {courseStatuses.map(status => (
              <option key={status} value={status}>
                {humanize(status)}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="platform-primary-button"
          disabled={
            busyKey === "course.status.update" || nextStatus === course.status
          }
        >
          {busyKey === "course.status.update" ? "Saving status" : "Save status"}
        </button>
      </form>
      {saved ? (
        <p className="hod-inline-success" role="status">
          <CheckCircle2 aria-hidden="true" size={15} /> Course status updated.
        </p>
      ) : null}
    </section>
  );
}

function CurriculumMain({
  scope,
  selectedCourse,
  moduleTitle,
  moduleOutcomes,
  setModuleTitle,
  setModuleOutcomes,
  addModule,
  busyKey,
  mode,
}: {
  scope: ScopedHodData;
  selectedCourse?: PlatformState["courses"][number];
  moduleTitle: string;
  moduleOutcomes: string;
  setModuleTitle: (value: string) => void;
  setModuleOutcomes: (value: string) => void;
  addModule: () => Promise<boolean>;
  busyKey: string | null;
  mode: "list" | "create";
}) {
  const [saved, setSaved] = useState(false);
  const modules = scope.state.modules
    .filter(module => module.courseId === selectedCourse?.id)
    .sort((first, second) => first.order - second.order);

  const moduleList = (
    <DataTableCard title="Modules" subtitle={`${modules.length} modules`}>
      <div className="platform-row-list hod-row-list">
        {modules.length ? (
          modules.map(module => (
            <article key={module.id}>
              <div>
                <strong>{module.title}</strong>
                <small>{module.outcomes.slice(0, 2).join(" · ")}</small>
              </div>
              <StatusBadge tone="slate">Module {module.order}</StatusBadge>
            </article>
          ))
        ) : (
          <article>
            <div>
              <strong>No modules yet</strong>
              <small>Add the first module for this course.</small>
            </div>
          </article>
        )}
      </div>
    </DataTableCard>
  );

  if (mode === "create") {
    return saved ? (
      <section className="hod-create-success" role="status">
        <CheckCircle2 size={20} />
        <div>
          <strong>Module added</strong>
          <span>The course map now includes the new module.</span>
        </div>
        <Link className="platform-primary-button" href="/app/hod/curriculum">
          View curriculum
        </Link>
      </section>
    ) : (
      <section className="hod-create-surface" data-testid="hod-module-composer">
        <div className="hod-create-surface-head">
          <span>Course map</span>
          <strong>{selectedCourse?.title ?? "Choose a course"}</strong>
          <p>Use a short title and only the outcomes learners need to see.</p>
        </div>
        <form
          className="hod-form-grid"
          onSubmit={async event => {
            event.preventDefault();
            if (await addModule()) setSaved(true);
          }}
        >
          <label>
            Module title
            <input
              value={moduleTitle}
              onChange={event => setModuleTitle(event.target.value)}
              placeholder="Example: Conditional sentences"
            />
          </label>
          <label className="wide">
            Outcomes
            <textarea
              value={moduleOutcomes}
              onChange={event => setModuleOutcomes(event.target.value)}
              placeholder="One or two learning outcomes"
              rows={3}
            />
          </label>
          <button
            type="submit"
            className="platform-primary-button"
            disabled={!selectedCourse || busyKey === "curriculum.module.create"}
          >
            <Plus size={15} />
            {busyKey === "curriculum.module.create"
              ? "Adding module"
              : "Add module"}
          </button>
        </form>
      </section>
    );
  }

  return <div className="hod-workflow-main">{moduleList}</div>;
}

function ScheduleMain({
  scope,
  view,
}: {
  scope: ScopedHodData;
  view: "classes" | "sessions";
}) {
  const sessions = scope.state.classSessions
    .filter(session => scope.classGroupIds.has(session.classGroupId))
    .slice()
    .sort(
      (first, second) =>
        new Date(first.startsAt).getTime() - new Date(second.startsAt).getTime()
    );

  if (view === "sessions") {
    return (
      <DataTableCard title="Sessions" subtitle={`${sessions.length} sessions`}>
        <div
          className="platform-row-list hod-row-list hod-session-list"
          data-testid="hod-sessions-list"
        >
          {sessions.length ? (
            sessions.map(session => (
              <article key={session.id}>
                <div>
                  <strong>{session.title}</strong>
                  <small>{formatDateTime(session.startsAt)}</small>
                </div>
                <StatusBadge tone={session.attendanceSaved ? "green" : "amber"}>
                  {session.attendanceSaved ? "Attendance saved" : "Pending"}
                </StatusBadge>
              </article>
            ))
          ) : (
            <article>
              <div>
                <strong>No sessions scheduled</strong>
                <small>
                  When a class session is planned, it will appear here.
                </small>
              </div>
            </article>
          )}
        </div>
      </DataTableCard>
    );
  }

  return (
    <DataTableCard
      title="Class schedule"
      subtitle={`${scope.classGroups.length} classes`}
    >
      <div className="hod-schedule-list" data-testid="hod-class-schedule-list">
        {scope.classGroups.map(group => {
          const run = scope.courseRuns.find(
            item => item.id === group.courseRunId
          );
          const room = scope.state.rooms.find(item => item.id === group.roomId);
          return (
            <article key={group.id}>
              <div>
                <span>{findCourseTitle(scope, run?.courseId)}</span>
                <strong>{group.name}</strong>
                <p>{room?.name ?? "Room not set"}</p>
              </div>
              <dl>
                <div>
                  <dt>Schedule</dt>
                  <dd>{group.schedule}</dd>
                </div>
                <div>
                  <dt>Learners</dt>
                  <dd>{group.studentIds.length}</dd>
                </div>
              </dl>
            </article>
          );
        })}
        {!scope.classGroups.length ? (
          <div className="platform-empty-state">
            <strong>No classes are scheduled.</strong>
            <span>Assigned department classes will appear here.</span>
          </div>
        ) : null}
      </div>
    </DataTableCard>
  );
}

function AssessmentsMain({
  scope,
  view,
  selectedCourse,
  selectedRun,
  reviewSubmissionId,
  assignmentTitle,
  assignmentSubmission,
  assignmentDueAt,
  assignmentRubric,
  selectedSubmissionId,
  gradeScore,
  gradeFeedback,
  setAssignmentTitle,
  setAssignmentSubmission,
  setAssignmentDueAt,
  setAssignmentRubric,
  setSelectedCourseId,
  setSelectedRunId,
  setGradeScore,
  setGradeFeedback,
  createAssignment,
  gradeSubmission,
  busyKey,
}: {
  scope: ScopedHodData;
  view: "list" | "create" | "review" | "review-detail";
  selectedCourse?: PlatformState["courses"][number];
  selectedRun?: PlatformState["courseRuns"][number];
  reviewSubmissionId?: string;
  assignmentTitle: string;
  assignmentSubmission: Assignment["submissionType"];
  assignmentDueAt: string;
  assignmentRubric: string;
  selectedSubmissionId: string;
  gradeScore: number;
  gradeFeedback: string;
  setAssignmentTitle: (value: string) => void;
  setAssignmentSubmission: (value: Assignment["submissionType"]) => void;
  setAssignmentDueAt: (value: string) => void;
  setAssignmentRubric: (value: string) => void;
  setSelectedCourseId: (value: string) => void;
  setSelectedRunId: (value: string) => void;
  setGradeScore: (value: number) => void;
  setGradeFeedback: (value: string) => void;
  createAssignment: () => Promise<boolean>;
  gradeSubmission: (submissionId?: string) => Promise<boolean>;
  busyKey: string | null;
}) {
  const [assignmentCreated, setAssignmentCreated] = useState(false);
  const scopedAssignments = scope.state.assignments.filter(assignment =>
    scope.courseRunIds.has(assignment.courseRunId)
  );
  const assignments = selectedRun
    ? scopedAssignments.filter(
        assignment => assignment.courseRunId === selectedRun.id
      )
    : scopedAssignments;
  const submissions = scope.state.assignmentSubmissions.filter(submission =>
    assignments.some(assignment => assignment.id === submission.assignmentId)
  );
  const reviewSubmissions = submissions
    .filter(submission => submission.status !== "completed")
    .concat(
      submissions.filter(submission => submission.id === selectedSubmissionId)
    )
    .filter(
      (submission, index, list) =>
        list.findIndex(item => item.id === submission.id) === index
    );
  const selectedSubmission =
    submissions.find(
      submission =>
        submission.id === (reviewSubmissionId ?? selectedSubmissionId)
    ) ?? reviewSubmissions[0];
  const selectedAssignment = scopedAssignments.find(
    assignment => assignment.id === selectedSubmission?.assignmentId
  );
  const availableRuns = scope.courseRuns.filter(
    run => !selectedCourse || run.courseId === selectedCourse.id
  );
  const canCreateAssignment = Boolean(
    selectedRun && selectedCourse?.status === "active"
  );

  const changeCourse = (courseId: string) => {
    setSelectedCourseId(courseId);
    const nextRun = scope.courseRuns.find(run => run.courseId === courseId);
    if (nextRun) setSelectedRunId(nextRun.id);
  };

  if (view === "create") {
    return assignmentCreated ? (
      <section
        className="hod-create-success"
        data-testid="hod-assignment-success"
      >
        <CheckCircle2 aria-hidden="true" size={20} />
        <div>
          <strong>Assignment created</strong>
          <span>The class now has its next piece of work.</span>
        </div>
        <Link className="platform-primary-button" href="/app/hod/assessments">
          View assignments
        </Link>
      </section>
    ) : (
      <section
        className="hod-create-surface"
        data-testid="hod-assignment-composer"
      >
        <div className="hod-create-surface-head">
          <div>
            <span>Assignment scope</span>
            <strong>Choose the class before setting the work.</strong>
          </div>
        </div>
        <form
          className="hod-form-grid"
          onSubmit={async event => {
            event.preventDefault();
            if (await createAssignment()) setAssignmentCreated(true);
          }}
        >
          <label>
            Course
            <select
              value={selectedCourse?.id ?? ""}
              onChange={event => changeCourse(event.target.value)}
            >
              {scope.courses.map(course => (
                <option key={course.id} value={course.id}>
                  {course.title} · {humanize(course.status)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Class
            <select
              value={selectedRun?.id ?? ""}
              onChange={event => setSelectedRunId(event.target.value)}
            >
              {availableRuns.map(run => (
                <option key={run.id} value={run.id}>
                  {run.term}
                </option>
              ))}
            </select>
          </label>
          <label className="wide">
            Assignment title
            <input
              value={assignmentTitle}
              onChange={event => setAssignmentTitle(event.target.value)}
              placeholder="Example: Grammar worksheet"
            />
          </label>
          <label>
            Submission type
            <select
              value={assignmentSubmission}
              onChange={event =>
                setAssignmentSubmission(
                  event.target.value as Assignment["submissionType"]
                )
              }
            >
              {submissionTypes.map(type => (
                <option key={type} value={type}>
                  {humanize(type)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Due date
            <input
              type="date"
              value={assignmentDueAt}
              onChange={event => setAssignmentDueAt(event.target.value)}
            />
          </label>
          <label className="wide">
            Rubric
            <input
              value={assignmentRubric}
              onChange={event => setAssignmentRubric(event.target.value)}
              placeholder="Keep the criteria short and clear"
            />
          </label>
          <div className="hod-assessment-eligibility wide">
            <StatusBadge tone={statusTone(selectedCourse?.status ?? "draft")}>
              {selectedCourse?.status === "active"
                ? "Ready for assessment"
                : `${humanize(selectedCourse?.status)} course`}
            </StatusBadge>
            <span>
              {selectedCourse?.status === "active"
                ? "This course can receive new learner work."
                : "Select an active course before creating learner work."}
            </span>
          </div>
          <div className="hod-create-form-actions wide">
            <button
              type="submit"
              className="platform-primary-button"
              disabled={!canCreateAssignment || busyKey === "assignment.create"}
            >
              <Plus size={15} />
              {busyKey === "assignment.create"
                ? "Creating assignment"
                : "Create assignment"}
            </button>
          </div>
        </form>
      </section>
    );
  }

  if (view === "review-detail") {
    if (!selectedSubmission || !selectedAssignment) {
      return (
        <DataTableCard title="Submission not found">
          <div className="platform-empty-state">
            <strong>This submission is no longer available.</strong>
            <span>Return to the review queue and choose another item.</span>
          </div>
        </DataTableCard>
      );
    }

    return (
      <section
        className="hod-submission-review"
        data-testid="hod-submission-review"
      >
        <header className="hod-submission-review-head">
          <div>
            <span>Submission</span>
            <h2>{selectedAssignment.title}</h2>
            <p>
              {findStudentName(scope.state, selectedSubmission.studentId)} ·{" "}
              {findRunTitle(scope, selectedAssignment.courseRunId)}
            </p>
          </div>
          <StatusBadge tone={statusTone(selectedSubmission.status)}>
            {humanize(selectedSubmission.status)}
          </StatusBadge>
        </header>
        <section className="hod-submission-response">
          <span>Learner response</span>
          <p>
            {selectedSubmission.response || "No written response provided."}
          </p>
        </section>
        <GradeEditor
          submission={selectedSubmission}
          score={gradeScore}
          feedback={gradeFeedback}
          setScore={setGradeScore}
          setFeedback={setGradeFeedback}
          gradeSubmission={() => gradeSubmission(selectedSubmission.id)}
          busyKey={busyKey}
        />
      </section>
    );
  }

  if (view === "review") {
    return (
      <div className="hod-workflow-main">
        <DataTableCard
          title="Review queue"
          subtitle={`${reviewSubmissions.length} waiting for review`}
        >
          <div
            className="platform-row-list hod-row-list hod-review-list"
            data-testid="hod-review-list"
          >
            {reviewSubmissions.length ? (
              reviewSubmissions.map(submission => {
                const assignment = scopedAssignments.find(
                  item => item.id === submission.assignmentId
                );
                return (
                  <Link
                    key={submission.id}
                    className="hod-review-row-link"
                    href={`/app/hod/assessments/review/${submission.id}`}
                  >
                    <div>
                      <strong>{assignment?.title ?? "Submission"}</strong>
                      <small>
                        {findStudentName(scope.state, submission.studentId)} ·{" "}
                        {findRunTitle(scope, assignment?.courseRunId)}
                      </small>
                    </div>
                    <StatusBadge tone={statusTone(submission.status)}>
                      {humanize(submission.status)}
                    </StatusBadge>
                  </Link>
                );
              })
            ) : (
              <article>
                <div>
                  <strong>No submissions need review</strong>
                  <small>New learner work will appear here.</small>
                </div>
              </article>
            )}
          </div>
        </DataTableCard>
      </div>
    );
  }

  return (
    <div className="hod-workflow-main">
      <DataTableCard
        title="Assignments"
        subtitle={`${assignments.length} for this class`}
        className="hod-assignment-record-card"
      >
        <div
          className="hod-assignment-record-list"
          data-testid="hod-assignments-list"
        >
          {assignments.length ? (
            assignments.map(assignment => (
              <article
                key={assignment.id}
                className="hod-assignment-record"
                data-assignment-id={assignment.id}
              >
                <div className="hod-assignment-record-primary">
                  <strong>{assignment.title}</strong>
                  <span>{humanize(assignment.submissionType)}</span>
                </div>
                <dl className="hod-assignment-record-facts">
                  <div>
                    <dt>Due</dt>
                    <dd>{formatDate(assignment.dueAt)}</dd>
                  </div>
                </dl>
                <StatusBadge tone={statusTone(assignment.status)}>
                  {humanize(assignment.status)}
                </StatusBadge>
              </article>
            ))
          ) : (
            <div className="platform-empty-state">
              <strong>No assignments for this class</strong>
              <span>Create an assignment when this class needs one.</span>
            </div>
          )}
        </div>
      </DataTableCard>
    </div>
  );
}

function GradeEditor({
  submission,
  score,
  feedback,
  setScore,
  setFeedback,
  gradeSubmission,
  busyKey,
}: {
  submission: AssignmentSubmission;
  score: number;
  feedback: string;
  setScore: (value: number) => void;
  setFeedback: (value: string) => void;
  gradeSubmission: () => Promise<boolean>;
  busyKey: string | null;
}) {
  const [graded, setGraded] = useState(false);

  if (graded) {
    return (
      <section className="hod-create-success" data-testid="hod-grade-success">
        <CheckCircle2 aria-hidden="true" size={20} />
        <div>
          <strong>Submission graded</strong>
          <span>The learner feedback has been recorded.</span>
        </div>
        <Link
          className="platform-primary-button"
          href="/app/hod/assessments/review"
        >
          Return to review queue
        </Link>
      </section>
    );
  }

  return (
    <form
      className="hod-grade-editor"
      data-testid="hod-grade-editor"
      onSubmit={async event => {
        event.preventDefault();
        if (await gradeSubmission()) setGraded(true);
      }}
    >
      <div className="hod-grade-editor-head">
        <div>
          <span>Result</span>
          <strong>Record the learner outcome</strong>
        </div>
        <StatusBadge tone={statusTone(submission.status)}>
          {humanize(submission.status)}
        </StatusBadge>
      </div>
      <label>
        Score
        <input
          type="number"
          min={0}
          max={100}
          value={score}
          onChange={event => setScore(Number(event.target.value))}
        />
      </label>
      <label>
        Feedback
        <input
          value={feedback}
          onChange={event => setFeedback(event.target.value)}
          placeholder="Brief feedback for the learner"
        />
      </label>
      <button
        type="submit"
        className="platform-primary-button"
        disabled={busyKey === "assignment.grade"}
      >
        {busyKey === "assignment.grade" ? "Saving result" : "Save result"}
      </button>
    </form>
  );
}

function CertificatesMain({ scope }: { scope: ScopedHodData }) {
  const certificates = scope.state.certificates.filter(certificate =>
    scope.courseIds.has(certificate.courseId)
  );
  const priorityCertificates = certificates.sort((first, second) => {
    const order = [
      "pending_approval",
      "approved",
      "issued",
      "rejected",
      "draft",
    ];
    return order.indexOf(first.status) - order.indexOf(second.status);
  });

  return (
    <DataTableCard
      title="Certificate requests"
      subtitle={`${certificates.length} records`}
    >
      <div
        className="platform-row-list hod-certificate-list"
        data-testid="hod-certificates-list"
      >
        {priorityCertificates.length ? (
          priorityCertificates.map(certificate => (
            <Link
              key={certificate.id}
              className="hod-certificate-row-link"
              href={`/app/hod/certificates/${certificate.id}`}
            >
              <div>
                <strong>{certificate.verificationCode}</strong>
                <small>
                  {findStudentName(scope.state, certificate.studentId)} ·{" "}
                  {findCourseTitle(scope, certificate.courseId)}
                </small>
              </div>
              <StatusBadge tone={statusTone(certificate.status)}>
                {humanize(certificate.status)}
              </StatusBadge>
            </Link>
          ))
        ) : (
          <article>
            <div>
              <strong>No certificate requests</strong>
              <small>New academic requests will appear here.</small>
            </div>
          </article>
        )}
      </div>
    </DataTableCard>
  );
}

function CertificateDetailMain({
  scope,
  certificate,
  approveCertificate,
  issueCertificate,
  rejectCertificate,
  busyKey,
}: {
  scope: ScopedHodData;
  certificate?: Certificate;
  approveCertificate: (certificateId: string) => Promise<boolean>;
  issueCertificate: (certificateId: string) => Promise<boolean>;
  rejectCertificate: (
    certificateId: string,
    reason: string
  ) => Promise<boolean>;
  busyKey: string | null;
}) {
  const [rejecting, setRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [result, setResult] = useState<string | null>(null);

  if (!certificate) {
    return (
      <DataTableCard title="Certificate not found">
        <div className="platform-empty-state">
          <strong>This certificate request is not available.</strong>
          <span>
            Return to the certificate list and choose another request.
          </span>
        </div>
      </DataTableCard>
    );
  }

  const studentName = findStudentName(scope.state, certificate.studentId);
  const courseTitle = findCourseTitle(scope, certificate.courseId);
  const isApproved = certificate.status === "approved";
  const isPending = certificate.status === "pending_approval";

  return (
    <section
      className="hod-certificate-detail"
      data-testid="hod-certificate-detail"
    >
      <header className="hod-certificate-detail-head">
        <div>
          <span>Certificate request</span>
          <h2>{certificate.verificationCode}</h2>
          <p>
            {studentName} · {courseTitle}
          </p>
        </div>
        <StatusBadge tone={statusTone(certificate.status)}>
          {humanize(certificate.status)}
        </StatusBadge>
      </header>
      <dl className="hod-certificate-facts">
        <div>
          <dt>Grade</dt>
          <dd>{certificate.grade}%</dd>
        </div>
        <div>
          <dt>Attendance</dt>
          <dd>{certificate.attendanceRate}%</dd>
        </div>
        <div>
          <dt>Course</dt>
          <dd>{courseTitle}</dd>
        </div>
      </dl>
      <section className="hod-certificate-decision">
        <div>
          <span>Academic decision</span>
          <strong>
            {isPending
              ? "Confirm the completion result."
              : isApproved
                ? "The request is ready to issue."
                : "This request has already been decided."}
          </strong>
          <small>
            {isPending
              ? "Approve the record when it meets the programme requirements."
              : isApproved
                ? "Issue the certificate when the final check is complete."
                : "The activity log retains the decision history."}
          </small>
        </div>
        {isPending ? (
          <div className="hod-certificate-decision-actions">
            <button
              type="button"
              className="platform-primary-button"
              onClick={async () => {
                if (await approveCertificate(certificate.id)) {
                  setResult("Certificate approved.");
                }
              }}
              disabled={busyKey === "certificate.approve"}
            >
              Approve
            </button>
            {!rejecting ? (
              <button type="button" onClick={() => setRejecting(true)}>
                Reject
              </button>
            ) : (
              <form
                className="hod-reject-composer"
                onSubmit={async event => {
                  event.preventDefault();
                  if (await rejectCertificate(certificate.id, rejectReason)) {
                    setResult("Certificate rejected.");
                    setRejecting(false);
                  }
                }}
              >
                <label>
                  Reason for rejection
                  <input
                    value={rejectReason}
                    onChange={event => setRejectReason(event.target.value)}
                    placeholder="Add a short reason"
                  />
                </label>
                <button
                  type="submit"
                  disabled={busyKey === "certificate.reject"}
                >
                  Confirm rejection
                </button>
                <button
                  type="button"
                  className="hod-quiet-button"
                  onClick={() => setRejecting(false)}
                >
                  Cancel
                </button>
              </form>
            )}
          </div>
        ) : null}
        {isApproved ? (
          <button
            type="button"
            className="platform-primary-button"
            onClick={async () => {
              if (await issueCertificate(certificate.id)) {
                setResult("Certificate issued.");
              }
            }}
            disabled={busyKey === "certificate.issue"}
          >
            Issue certificate
          </button>
        ) : null}
      </section>
      {result ? (
        <p className="hod-inline-success" role="status">
          <CheckCircle2 aria-hidden="true" size={15} /> {result}
        </p>
      ) : null}
    </section>
  );
}
