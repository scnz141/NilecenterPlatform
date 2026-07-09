import { useMemo, useState } from "react";
import {
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
import PlatformShell from "@/components/platform/PlatformShell";
import { WorkspaceLayout } from "@/components/platform/PlatformLayouts";
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
import { getDemoUser } from "@/lib/platformData";

type HodWorkflowPageId =
  | "courses"
  | "curriculum"
  | "schedule"
  | "assessments"
  | "certificates";

type HodWorkflowPageProps = {
  pageId: HodWorkflowPageId;
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
  const actorId = getDemoUser("headofdepartment").id;
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

export default function HodWorkflowPage({ pageId }: HodWorkflowPageProps) {
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
  const [selectedSubmissionId, setSelectedSubmissionId] = useState(
    "sub_ar_grammar_draft"
  );
  const [gradeScore, setGradeScore] = useState(89);
  const [gradeFeedback, setGradeFeedback] = useState(
    "Clear answer. Keep evidence specific."
  );
  const [rejectReasons, setRejectReasons] = useState<Record<string, string>>(
    {}
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
        return;
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
    },
  };

  const assessmentActions = {
    createAssignment: async () => {
      if (!selectedRun || !assignmentTitle.trim()) {
        toast.error("Add an assignment title first.");
        return;
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
    },
    gradeSubmission: () => {
      if (!selectedSubmissionId) {
        toast.error("Choose a submission first.");
        return;
      }
      return runAction(
        {
          type: "assignment.grade",
          submissionId: selectedSubmissionId,
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
    reject: (certificateId: string) => {
      const reason = rejectReasons[certificateId]?.trim();
      if (!reason) {
        toast.error("Add a reject reason first.");
        return;
      }
      return runAction(
        {
          type: "certificate.reject",
          certificateId,
          reason,
          actorId: scope.actorId,
        },
        "Certificate rejected"
      );
    },
  };

  const toolbar =
    pageId === "courses" ? (
      <div className="simple-portal-toolbar hod-workflow-toolbar">
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
    ) : pageId === "curriculum" || pageId === "assessments" ? (
      <div className="simple-portal-toolbar hod-workflow-toolbar">
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
                    {findRunTitle(scope, run.id)}
                  </option>
                ))}
            </select>
          </label>
        ) : null}
      </div>
    ) : null;

  return (
    <PlatformShell role="headofdepartment" title={copy.title}>
      <WorkspaceLayout
        className={`hod-workflow-page hod-${pageId}-page`}
        title={copy.title}
        description={copy.description}
        context={copy.context}
        toolbar={toolbar}
        main={
          pageId === "courses" ? (
            <CoursesMain
              scope={scope}
              courses={visibleCourses}
              selectedCourse={selectedCourse}
              setSelectedCourseId={setSelectedCourseId}
              updateStatus={courseActions.updateStatus}
              busyKey={busyKey}
            />
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
            />
          ) : pageId === "schedule" ? (
            <ScheduleMain scope={scope} />
          ) : pageId === "assessments" ? (
            <AssessmentsMain
              scope={scope}
              selectedRun={selectedRun}
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
              setSelectedSubmissionId={setSelectedSubmissionId}
              setGradeScore={setGradeScore}
              setGradeFeedback={setGradeFeedback}
              createAssignment={assessmentActions.createAssignment}
              gradeSubmission={assessmentActions.gradeSubmission}
              busyKey={busyKey}
            />
          ) : (
            <CertificatesMain
              scope={scope}
              rejectReasons={rejectReasons}
              setRejectReasons={setRejectReasons}
              approveCertificate={certificateActions.approve}
              issueCertificate={certificateActions.issue}
              rejectCertificate={certificateActions.reject}
              busyKey={busyKey}
            />
          )
        }
        side={<HodSidePanel pageId={pageId} scope={scope} />}
      />
    </PlatformShell>
  );
}

function CoursesMain({
  scope,
  courses,
  selectedCourse,
  setSelectedCourseId,
  updateStatus,
  busyKey,
}: {
  scope: ScopedHodData;
  courses: PlatformState["courses"];
  selectedCourse?: PlatformState["courses"][number];
  setSelectedCourseId: (courseId: string) => void;
  updateStatus: (courseId: string, status: CourseStatus) => void;
  busyKey: string | null;
}) {
  return (
    <div className="hod-workflow-main">
      <DataTableCard title="Course list" subtitle={`${courses.length} courses`}>
        <table className="hod-workflow-table">
          <thead>
            <tr>
              <th>Course</th>
              <th>Program</th>
              <th>Status</th>
              <th>Modules</th>
            </tr>
          </thead>
          <tbody>
            {courses.map(course => {
              const program = scope.programs.find(
                item => item.id === course.programId
              );
              const modules = scope.state.modules.filter(
                module => module.courseId === course.id
              );
              return (
                <tr key={course.id}>
                  <td>
                    <button
                      type="button"
                      className="hod-row-button"
                      onClick={() => setSelectedCourseId(course.id)}
                    >
                      <strong>{course.title}</strong>
                      <small>{course.description}</small>
                    </button>
                  </td>
                  <td>{program?.title ?? "Program not set"}</td>
                  <td>
                    <StatusBadge tone={statusTone(course.status)}>
                      {humanize(course.status)}
                    </StatusBadge>
                  </td>
                  <td>{modules.length} modules</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </DataTableCard>

      <DataTableCard
        className="hod-action-card"
        title="Selected course"
        subtitle={selectedCourse?.title ?? "Choose a course"}
      >
        {selectedCourse ? (
          <div className="hod-form-grid">
            <label>
              Course status
              <select
                value={selectedCourse.status}
                onChange={event =>
                  updateStatus(
                    selectedCourse.id,
                    event.target.value as CourseStatus
                  )
                }
                disabled={busyKey === "course.status.update"}
              >
                {courseStatuses.map(status => (
                  <option key={status} value={status}>
                    {humanize(status)}
                  </option>
                ))}
              </select>
            </label>
            <p>{selectedCourse.outcomes.slice(0, 2).join(" · ")}</p>
          </div>
        ) : (
          <p>No course selected.</p>
        )}
      </DataTableCard>
    </div>
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
}: {
  scope: ScopedHodData;
  selectedCourse?: PlatformState["courses"][number];
  moduleTitle: string;
  moduleOutcomes: string;
  setModuleTitle: (value: string) => void;
  setModuleOutcomes: (value: string) => void;
  addModule: () => void;
  busyKey: string | null;
}) {
  const modules = scope.state.modules
    .filter(module => module.courseId === selectedCourse?.id)
    .sort((first, second) => first.order - second.order);

  return (
    <div className="hod-workflow-main">
      <DataTableCard title="Add module" subtitle={selectedCourse?.title}>
        <div className="hod-form-grid">
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
            type="button"
            className="platform-primary-button"
            onClick={addModule}
            disabled={busyKey === "curriculum.module.create"}
          >
            <Plus size={15} />
            Add module
          </button>
        </div>
      </DataTableCard>

      <DataTableCard title="Modules" subtitle={`${modules.length} records`}>
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
    </div>
  );
}

function ScheduleMain({ scope }: { scope: ScopedHodData }) {
  const sessions = scope.state.classSessions
    .filter(session => scope.classGroupIds.has(session.classGroupId))
    .slice()
    .sort(
      (first, second) =>
        new Date(first.startsAt).getTime() - new Date(second.startsAt).getTime()
    );

  return (
    <div className="hod-workflow-main">
      <DataTableCard
        title="Class schedule"
        subtitle={`${scope.classGroups.length} classes`}
      >
        <table className="hod-workflow-table">
          <thead>
            <tr>
              <th>Class</th>
              <th>Course</th>
              <th>Schedule</th>
              <th>Learners</th>
            </tr>
          </thead>
          <tbody>
            {scope.classGroups.map(group => {
              const run = scope.courseRuns.find(
                item => item.id === group.courseRunId
              );
              return (
                <tr key={group.id}>
                  <td>
                    <strong>{group.name}</strong>
                    <small>{group.roomId ?? "Room not set"}</small>
                  </td>
                  <td>{findCourseTitle(scope, run?.courseId)}</td>
                  <td>{group.schedule}</td>
                  <td>{group.studentIds.length} learners</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </DataTableCard>

      <DataTableCard title="Sessions" subtitle={`${sessions.length} sessions`}>
        <div className="platform-row-list hod-row-list">
          {sessions.slice(0, 6).map(session => (
            <article key={session.id}>
              <div>
                <strong>{session.title}</strong>
                <small>{formatDateTime(session.startsAt)}</small>
              </div>
              <StatusBadge tone={session.attendanceSaved ? "green" : "amber"}>
                {session.attendanceSaved ? "Attendance saved" : "Pending"}
              </StatusBadge>
            </article>
          ))}
        </div>
      </DataTableCard>
    </div>
  );
}

function AssessmentsMain({
  scope,
  selectedRun,
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
  setSelectedSubmissionId,
  setGradeScore,
  setGradeFeedback,
  createAssignment,
  gradeSubmission,
  busyKey,
}: {
  scope: ScopedHodData;
  selectedRun?: PlatformState["courseRuns"][number];
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
  setSelectedSubmissionId: (value: string) => void;
  setGradeScore: (value: number) => void;
  setGradeFeedback: (value: string) => void;
  createAssignment: () => void;
  gradeSubmission: () => void;
  busyKey: string | null;
}) {
  const assignments = scope.state.assignments.filter(assignment =>
    scope.courseRunIds.has(assignment.courseRunId)
  );
  const submissions = scope.state.assignmentSubmissions.filter(submission => {
    const assignment = assignments.find(
      item => item.id === submission.assignmentId
    );
    return Boolean(assignment);
  });
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
    submissions.find(submission => submission.id === selectedSubmissionId) ??
    reviewSubmissions[0];

  return (
    <div className="hod-workflow-main">
      <DataTableCard
        title="Create assignment"
        subtitle={findRunTitle(scope, selectedRun?.id)}
      >
        <div className="hod-form-grid">
          <label>
            Assignment title
            <input
              value={assignmentTitle}
              onChange={event => setAssignmentTitle(event.target.value)}
              placeholder="Example: Grammar worksheet"
            />
          </label>
          <label>
            Submission
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
                  {type}
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
            />
          </label>
          <button
            type="button"
            className="platform-primary-button"
            onClick={createAssignment}
            disabled={busyKey === "assignment.create"}
          >
            <Plus size={15} />
            Create assignment
          </button>
        </div>
      </DataTableCard>

      <DataTableCard
        title="Assessment list"
        subtitle={`${assignments.length} items`}
      >
        <table className="hod-workflow-table">
          <thead>
            <tr>
              <th>Assessment</th>
              <th>Course run</th>
              <th>Submission</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {assignments.map(assignment => (
              <tr key={assignment.id}>
                <td>
                  <strong>{assignment.title}</strong>
                  <small>Due {formatDate(assignment.dueAt)}</small>
                </td>
                <td>{findRunTitle(scope, assignment.courseRunId)}</td>
                <td>{humanize(assignment.submissionType)}</td>
                <td>
                  <StatusBadge tone={statusTone(assignment.status)}>
                    {humanize(assignment.status)}
                  </StatusBadge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </DataTableCard>

      <section className="platform-workflow-card hod-review-card">
        <div className="hod-section-title">
          <ClipboardCheck size={16} />
          <div>
            <span>Manual review</span>
            <strong>Submission queue</strong>
          </div>
        </div>
        <div className="platform-row-list hod-row-list">
          {reviewSubmissions.length ? (
            reviewSubmissions.map(submission => {
              const assignment = assignments.find(
                item => item.id === submission.assignmentId
              );
              return (
                <article key={submission.id}>
                  <button
                    type="button"
                    className="hod-row-button"
                    onClick={() => setSelectedSubmissionId(submission.id)}
                  >
                    <strong>{assignment?.title ?? "Submission"}</strong>
                    <small>
                      {findStudentName(scope.state, submission.studentId)} ·{" "}
                      {submission.response || "Draft answer saved locally"}
                    </small>
                  </button>
                  <StatusBadge tone={statusTone(submission.status)}>
                    {humanize(submission.status)}
                  </StatusBadge>
                </article>
              );
            })
          ) : (
            <article>
              <div>
                <strong>No pending submissions</strong>
                <small>New review work appears here.</small>
              </div>
            </article>
          )}
        </div>
        {selectedSubmission ? (
          <GradeEditor
            submission={selectedSubmission}
            score={gradeScore}
            feedback={gradeFeedback}
            setScore={setGradeScore}
            setFeedback={setGradeFeedback}
            gradeSubmission={gradeSubmission}
            busyKey={busyKey}
          />
        ) : null}
      </section>
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
  gradeSubmission: () => void;
  busyKey: string | null;
}) {
  return (
    <div className="hod-grade-editor">
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
          placeholder={`Feedback for ${submission.id}`}
        />
      </label>
      <button
        type="button"
        className="platform-primary-button"
        onClick={gradeSubmission}
        disabled={busyKey === "assignment.grade"}
      >
        Grade submission
      </button>
    </div>
  );
}

function CertificatesMain({
  scope,
  rejectReasons,
  setRejectReasons,
  approveCertificate,
  issueCertificate,
  rejectCertificate,
  busyKey,
}: {
  scope: ScopedHodData;
  rejectReasons: Record<string, string>;
  setRejectReasons: (value: Record<string, string>) => void;
  approveCertificate: (certificateId: string) => void;
  issueCertificate: (certificateId: string) => void;
  rejectCertificate: (certificateId: string) => void;
  busyKey: string | null;
}) {
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
      <div className="platform-row-list hod-certificate-list">
        {priorityCertificates.map(certificate => (
          <CertificateRow
            key={certificate.id}
            scope={scope}
            certificate={certificate}
            rejectReason={rejectReasons[certificate.id] ?? ""}
            setRejectReason={value =>
              setRejectReasons({ ...rejectReasons, [certificate.id]: value })
            }
            approveCertificate={approveCertificate}
            issueCertificate={issueCertificate}
            rejectCertificate={rejectCertificate}
            busyKey={busyKey}
          />
        ))}
      </div>
    </DataTableCard>
  );
}

function CertificateRow({
  scope,
  certificate,
  rejectReason,
  setRejectReason,
  approveCertificate,
  issueCertificate,
  rejectCertificate,
  busyKey,
}: {
  scope: ScopedHodData;
  certificate: Certificate;
  rejectReason: string;
  setRejectReason: (value: string) => void;
  approveCertificate: (certificateId: string) => void;
  issueCertificate: (certificateId: string) => void;
  rejectCertificate: (certificateId: string) => void;
  busyKey: string | null;
}) {
  const studentName = findStudentName(scope.state, certificate.studentId);
  const courseTitle = findCourseTitle(scope, certificate.courseId);
  const isApproved = certificate.status === "approved";
  const isPending = certificate.status === "pending_approval";

  return (
    <article>
      <div className="hod-certificate-copy">
        <strong>{certificate.verificationCode}</strong>
        <small>
          {studentName} · {courseTitle} · grade {certificate.grade}%
        </small>
      </div>
      <StatusBadge tone={statusTone(certificate.status)}>
        {humanize(certificate.status)}
      </StatusBadge>
      <div className="hod-certificate-actions">
        <button
          type="button"
          onClick={() => approveCertificate(certificate.id)}
          disabled={!isPending || busyKey === "certificate.approve"}
        >
          Approve
        </button>
        <button
          type="button"
          onClick={() => issueCertificate(certificate.id)}
          disabled={!isApproved || busyKey === "certificate.issue"}
        >
          Issue
        </button>
        <label>
          Reject reason
          <input
            value={rejectReason}
            onChange={event => setRejectReason(event.target.value)}
            placeholder="Reason"
          />
        </label>
        <button
          type="button"
          onClick={() => rejectCertificate(certificate.id)}
          disabled={busyKey === "certificate.reject"}
        >
          Reject
        </button>
      </div>
    </article>
  );
}

function HodSidePanel({
  pageId,
  scope,
}: {
  pageId: HodWorkflowPageId;
  scope: ScopedHodData;
}) {
  const pendingSubmissions = scope.state.assignmentSubmissions.filter(
    submission => {
      const assignment = scope.state.assignments.find(
        item => item.id === submission.assignmentId
      );
      return (
        assignment &&
        scope.courseRunIds.has(assignment.courseRunId) &&
        submission.status !== "completed"
      );
    }
  );
  const pendingCertificates = scope.state.certificates.filter(
    certificate =>
      scope.courseIds.has(certificate.courseId) &&
      certificate.status === "pending_approval"
  );
  const nextSession = scope.state.classSessions
    .filter(session => scope.classGroupIds.has(session.classGroupId))
    .slice()
    .sort(
      (first, second) =>
        new Date(first.startsAt).getTime() - new Date(second.startsAt).getTime()
    )[0];

  const summary =
    pageId === "courses"
      ? {
          icon: <BookOpen size={15} />,
          title: "Course scope",
          value: `${scope.courses.length} courses`,
          detail: `${scope.programs.length} programs`,
        }
      : pageId === "curriculum"
        ? {
            icon: <GraduationCap size={15} />,
            title: "Curriculum",
            value: `${scope.state.modules.filter(module => scope.courseIds.has(module.courseId)).length} modules`,
            detail: "Course modules only",
          }
        : pageId === "schedule"
          ? {
              icon: <CalendarDays size={15} />,
              title: "Next session",
              value: nextSession?.title ?? "No session",
              detail: formatDateTime(nextSession?.startsAt),
            }
          : pageId === "assessments"
            ? {
                icon: <ClipboardCheck size={15} />,
                title: "Review queue",
                value: `${pendingSubmissions.length} pending`,
                detail: "Submissions needing action",
              }
            : {
                icon: <ShieldCheck size={15} />,
                title: "Certificate queue",
                value: `${pendingCertificates.length} pending`,
                detail: "Requests awaiting decision",
              };

  return (
    <aside className="portal-simple-stack">
      <section className="portal-simple-side-card">
        <span>
          {summary.icon}
          {summary.title}
        </span>
        <strong>{summary.value}</strong>
        <p>{summary.detail}</p>
      </section>
      <section className="portal-simple-side-card">
        <span>
          <CheckCircle2 size={15} />
          Scope
        </span>
        <strong>{scope.departmentIds.size} departments</strong>
        <p>{scope.classGroups.length} classes visible.</p>
      </section>
    </aside>
  );
}
