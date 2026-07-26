import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  CloudOff,
  RefreshCw,
} from "lucide-react";
import { Link } from "wouter";
import PlatformShell from "@/components/platform/PlatformShell";
import { WorkspaceLayout } from "@/components/platform/PlatformLayouts";
import {
  DataTableCard,
  StatusBadge,
} from "@/components/platform/PlatformPrimitives";
import {
  fetchMoodleCommandCapabilitiesRequest,
  type MoodleCommandCapabilitiesDto,
} from "@/lib/backend/api";
import { requireActiveUser } from "@/lib/auth/session";
import { platformStore } from "@/lib/domain/store";

type TeacherMoodleArea =
  | "assignments"
  | "quizzes"
  | "question-bank"
  | "grading";

type TeacherMoodleLearningPageProps = {
  area: TeacherMoodleArea;
  mode?: "list" | "create" | "detail" | "review";
  recordId?: string;
};

const areaMeta: Record<
  TeacherMoodleArea,
  {
    title: string;
    description: string;
    capability: string;
    unavailable: string;
  }
> = {
  assignments: {
    title: "Assignments",
    description: "Open the assigned Moodle course to manage class work.",
    capability: "assignment.upsert",
    unavailable: "Assignment editing is not active in this environment.",
  },
  quizzes: {
    title: "Quizzes",
    description: "Open the assigned Moodle course to manage quizzes.",
    capability: "quiz.upsert",
    unavailable: "Quiz editing is not active in this environment.",
  },
  "question-bank": {
    title: "Question bank",
    description: "Question authoring remains in the assigned Moodle course.",
    capability: "question.upsert",
    unavailable: "Question-bank editing is not active in this environment.",
  },
  grading: {
    title: "Grading",
    description: "Review verified Moodle outcomes for assigned classes.",
    capability: "grade.update",
    unavailable: "Moodle grading is not active in this environment.",
  },
};

export default function TeacherMoodleLearningPage({
  area,
  mode = "list",
  recordId,
}: TeacherMoodleLearningPageProps) {
  const [capabilities, setCapabilities] =
    useState<MoodleCommandCapabilitiesDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const state = platformStore.getState();
  const teacherId = requireActiveUser("teacher").id;
  const meta = areaMeta[area];

  const classes = useMemo(() => {
    const runs = state.courseRuns.filter(run => run.teacherId === teacherId);
    return runs.flatMap(run => {
      const course = state.courses.find(item => item.id === run.courseId);
      return state.classGroups
        .filter(item => item.courseRunId === run.id)
        .map(classGroup => ({
          classGroup,
          course,
          run,
        }));
    });
  }, [state, teacherId]);

  const loadCapabilities = () => {
    setLoading(true);
    setError("");
    void fetchMoodleCommandCapabilitiesRequest().then(result => {
      if (!result.ok || !result.data) {
        setCapabilities(null);
        setError(result.error ?? "Moodle capability status is unavailable.");
      } else {
        setCapabilities(result.data);
      }
      setLoading(false);
    });
  };

  useEffect(loadCapabilities, []);

  const canWrite =
    capabilities?.state === "available" &&
    capabilities.operations.includes(meta.capability);
  const title =
    mode === "create"
      ? `New ${meta.title.toLowerCase().replace(/s$/, "")}`
      : mode === "review"
        ? `${meta.title} review`
        : meta.title;

  return (
    <PlatformShell role="teacher" title={title}>
      <WorkspaceLayout
        className="portal-simple-page teacher-moodle-learning-page"
        context="Teacher"
        title={title}
        description={meta.description}
        main={
          <div className="portal-simple-stack">
            <section
              className="portal-simple-form-card"
              data-testid={`teacher-moodle-${area}-authority`}
              data-moodle-authority="true"
              data-native-write="false"
            >
              <div>
                <span>Learning authority</span>
                <h2>Moodle manages this work</h2>
                <p>
                  Nile Learn verifies your assigned class before any Moodle
                  command. It does not create a second local assignment, quiz,
                  question, grade, or feedback record.
                </p>
              </div>

              {loading ? (
                <div role="status" className="platform-empty-state">
                  <RefreshCw size={18} aria-hidden="true" />
                  <strong>Checking Moodle access</strong>
                </div>
              ) : error ? (
                <div role="alert" className="platform-empty-state">
                  <CloudOff size={18} aria-hidden="true" />
                  <strong>Capability status unavailable</strong>
                  <span>{error}</span>
                  <button
                    type="button"
                    className="platform-secondary-button"
                    onClick={loadCapabilities}
                  >
                    Retry
                  </button>
                </div>
              ) : canWrite ? (
                <div role="status" className="platform-empty-state">
                  <CheckCircle2 size={18} aria-hidden="true" />
                  <strong>Moodle command access is available</strong>
                  <span>
                    Target class and Moodle capability are rechecked when an
                    operation is submitted.
                  </span>
                </div>
              ) : (
                <div
                  role="status"
                  className="platform-empty-state"
                  data-testid="teacher-moodle-write-disabled"
                >
                  <AlertTriangle size={18} aria-hidden="true" />
                  <strong>{meta.unavailable}</strong>
                  <span>
                    Read-only verified course content remains available. No
                    local fallback write will be used.
                  </span>
                </div>
              )}

              {recordId ? (
                <p>
                  Requested record: <strong>{recordId}</strong>. It must resolve
                  through a current Moodle mapping before an action is allowed.
                </p>
              ) : null}
            </section>

            <DataTableCard
              title="Assigned courses"
              subtitle={`${classes.length} class${classes.length === 1 ? "" : "es"}`}
            >
              {classes.length ? (
                <div className="teacher-class-record-list">
                  {classes.map(({ classGroup, course, run }) => (
                    <article key={classGroup.id}>
                      <div className="teacher-class-record-copy">
                        <span>{run.term}</span>
                        <strong>{classGroup.name}</strong>
                        <p>{course?.title ?? "Course mapping required"}</p>
                      </div>
                      <div className="teacher-class-record-actions">
                        <StatusBadge
                          tone={run.status === "active" ? "green" : "amber"}
                        >
                          {run.status}
                        </StatusBadge>
                        {course ? (
                          <Link
                            className="teacher-classes-row-action"
                            href={`/app/teacher/moodle-source/${course.id}`}
                          >
                            <BookOpen size={14} />
                            Open content
                            <ArrowRight size={14} />
                          </Link>
                        ) : null}
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="platform-empty-state">
                  <BookOpen size={18} aria-hidden="true" />
                  <strong>No assigned courses</strong>
                  <span>
                    Moodle learning access begins after a current class
                    assignment is available.
                  </span>
                </div>
              )}
            </DataTableCard>
          </div>
        }
      />
    </PlatformShell>
  );
}
