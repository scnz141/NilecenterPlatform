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

type HodMoodleArea = "curriculum" | "assessments";

type HodMoodleGovernancePageProps = {
  area: HodMoodleArea;
  mode?: "list" | "create" | "review" | "review-detail";
  recordId?: string;
};

const areaMeta: Record<
  HodMoodleArea,
  {
    title: string;
    description: string;
    capabilities: string[];
    unavailable: string;
  }
> = {
  curriculum: {
    title: "Curriculum",
    description:
      "Review department course mappings and approved Moodle authoring access.",
    capabilities: ["section.upsert", "section.reorder", "page.upsert"],
    unavailable: "Moodle curriculum editing is not active in this environment.",
  },
  assessments: {
    title: "Assessments",
    description:
      "Review Moodle assessment mappings, outcomes, and moderation access.",
    capabilities: [
      "assignment.upsert",
      "quiz.upsert",
      "question.upsert",
      "grade.update",
    ],
    unavailable: "Moodle assessment editing is not active in this environment.",
  },
};

export default function HodMoodleGovernancePage({
  area,
  mode = "list",
  recordId,
}: HodMoodleGovernancePageProps) {
  const [capabilities, setCapabilities] =
    useState<MoodleCommandCapabilitiesDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const state = platformStore.getState();
  const hodId = requireActiveUser("headofdepartment").id;
  const meta = areaMeta[area];

  const courses = useMemo(() => {
    const hod = state.users.find(user => user.id === hodId);
    const departmentIds = new Set(
      state.departments
        .filter(
          department =>
            department.ownerUserId === hodId ||
            department.id === hod?.departmentId
        )
        .map(department => department.id)
    );
    const programIds = new Set(
      state.programs
        .filter(program => departmentIds.has(program.departmentId))
        .map(program => program.id)
    );
    return state.courses.filter(course => programIds.has(course.programId));
  }, [hodId, state]);

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

  const availableOperations =
    capabilities?.state === "available"
      ? meta.capabilities.filter(capability =>
          capabilities.operations.includes(capability)
        )
      : [];
  const title =
    mode === "create"
      ? area === "curriculum"
        ? "New curriculum release"
        : "New assessment"
      : mode === "review" || mode === "review-detail"
        ? "Assessment review"
        : meta.title;

  return (
    <PlatformShell role="headofdepartment" title={title}>
      <WorkspaceLayout
        className="portal-simple-page hod-moodle-governance-page"
        context="Academic governance"
        title={title}
        description={meta.description}
        main={
          <div className="portal-simple-stack">
            <section
              className="portal-simple-form-card"
              data-testid={`hod-moodle-${area}-authority`}
              data-moodle-authority="true"
              data-native-write="false"
            >
              <div>
                <span>Learning authority</span>
                <h2>Moodle owns this academic record</h2>
                <p>
                  Nile Learn verifies department scope, template mappings, and
                  moderation authority. It does not create a second local
                  curriculum module, assignment, quiz, grade, or feedback
                  record.
                </p>
              </div>

              {loading ? (
                <div role="status" className="platform-empty-state">
                  <RefreshCw size={18} aria-hidden="true" />
                  <strong>Checking Moodle governance access</strong>
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
              ) : availableOperations.length ? (
                <div role="status" className="platform-empty-state">
                  <CheckCircle2 size={18} aria-hidden="true" />
                  <strong>Moodle governance commands are available</strong>
                  <span>
                    Department scope, target mapping, and Moodle capability are
                    rechecked for every command.
                  </span>
                </div>
              ) : (
                <div
                  role="status"
                  className="platform-empty-state"
                  data-testid="hod-moodle-write-disabled"
                >
                  <AlertTriangle size={18} aria-hidden="true" />
                  <strong>{meta.unavailable}</strong>
                  <span>
                    Verified course projections remain available. No local
                    fallback write will be used.
                  </span>
                </div>
              )}

              {recordId ? (
                <p>
                  Requested record: <strong>{recordId}</strong>. It must resolve
                  through a current Moodle mapping before review or mutation is
                  allowed.
                </p>
              ) : null}
            </section>

            <DataTableCard
              title="Department courses"
              subtitle={`${courses.length} mapped course${courses.length === 1 ? "" : "s"}`}
            >
              {courses.length ? (
                <div className="teacher-class-record-list">
                  {courses.map(course => (
                    <article key={course.id}>
                      <div className="teacher-class-record-copy">
                        <span>
                          {area === "curriculum" ? "Template" : "Outcomes"}
                        </span>
                        <strong>{course.title}</strong>
                        <p>{course.description}</p>
                      </div>
                      <div className="teacher-class-record-actions">
                        <StatusBadge
                          tone={course.status === "active" ? "green" : "amber"}
                        >
                          {course.status}
                        </StatusBadge>
                        <Link
                          className="teacher-classes-row-action"
                          href={`/app/hod/moodle-source/${course.id}`}
                        >
                          <BookOpen size={14} />
                          Open Moodle record
                          <ArrowRight size={14} />
                        </Link>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="platform-empty-state">
                  <BookOpen size={18} aria-hidden="true" />
                  <strong>No department courses</strong>
                  <span>
                    Academic governance begins after a course and Moodle mapping
                    are available in the HOD scope.
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
