import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarClock,
  BookOpen,
  CloudOff,
  FileArchive,
  FileAudio,
  FileImage,
  FileText,
  FileVideo,
  MonitorUp,
  EyeOff,
  RefreshCw,
} from "lucide-react";
import { Link } from "wouter";
import PlatformShell from "@/components/platform/PlatformShell";
import { DetailLayout } from "@/components/platform/PlatformLayouts";
import {
  fetchMoodleCourseContentProjectionRequest,
  type MoodleCourseContentProjectionDto,
} from "@/lib/backend/api";
import { roleMeta, type Role } from "@/lib/platformData";

export type MoodleCourseContentViewModel = MoodleCourseContentProjectionDto;

type MoodleCourseContentPageProps = {
  courseId: string;
  role: MoodleContentRole;
};

type MoodleContentRole = Extract<
  Role,
  "student" | "teacher" | "headofdepartment" | "superadmin"
>;

function rolePath(role: MoodleContentRole) {
  if (role === "headofdepartment") return "hod";
  if (role === "superadmin") return "admin";
  return role;
}

export function resolveMoodleContentDisplayState(input: {
  content: MoodleCourseContentViewModel | null;
  loading: boolean;
  error: string;
}) {
  const sections = input.content?.projection.sections ?? [];
  const activityCount = sections.reduce(
    (total, section) => total + section.activities.length,
    0
  );
  const availability = input.content?.availability ?? "unavailable";
  const freshness = input.content?.freshness ?? "unavailable";
  const hasContent = sections.length > 0 || activityCount > 0;
  const state = input.loading
    ? "loading"
    : input.error
      ? "error"
      : !input.content || (availability === "unavailable" && !hasContent)
        ? "unavailable"
        : availability === "empty" || !hasContent
          ? "empty"
          : "ready";

  return {
    activityCount,
    availability,
    freshness,
    isPartial: availability === "unavailable" && hasContent,
    sections,
    state,
  } as const;
}

export function formatMoodleActivityType(value: string) {
  const words = value.trim().replaceAll("_", " ").replaceAll("-", " ");
  return words
    ? words.replace(/\b\w/g, letter => letter.toUpperCase())
    : "Activity";
}

function formatObservationTime(value?: string) {
  if (!value || !Number.isFinite(Date.parse(value))) return "Not yet available";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function completionCopy(value?: "none" | "manual" | "automatic") {
  if (value === "automatic") return "Automatic completion";
  if (value === "manual") return "Manual completion";
  return "No completion tracking";
}

function formatFileSize(value?: number) {
  if (value === undefined) return "Size unavailable";
  if (value < 1_024) return `${value} B`;
  if (value < 1_048_576) return `${(value / 1_024).toFixed(1)} KB`;
  return `${(value / 1_048_576).toFixed(1)} MB`;
}

function ResourceIcon({ kind }: { kind: string }) {
  if (kind === "audio") return <FileAudio size={16} />;
  if (kind === "video") return <FileVideo size={16} />;
  if (kind === "image") return <FileImage size={16} />;
  if (kind === "archive") return <FileArchive size={16} />;
  return <FileText size={16} />;
}

export default function MoodleCourseContentPage({
  courseId,
  role,
}: MoodleCourseContentPageProps) {
  const [content, setContent] = useState<MoodleCourseContentViewModel | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadContent = useCallback(async () => {
    setLoading(true);
    setError("");
    const result = await fetchMoodleCourseContentProjectionRequest(courseId);
    if (!result.ok || !result.data) {
      setContent(null);
      setError(result.error ?? "Course content is temporarily unavailable.");
      setLoading(false);
      return;
    }
    setContent(result.data);
    setLoading(false);
  }, [courseId]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    fetchMoodleCourseContentProjectionRequest(courseId).then(result => {
      if (!active) return;
      if (!result.ok || !result.data) {
        setContent(null);
        setError(result.error ?? "Course content is temporarily unavailable.");
      } else {
        setContent(result.data);
      }
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [courseId]);

  const display = resolveMoodleContentDisplayState({ content, loading, error });
  const sourceRoute = `/app/${rolePath(role)}/moodle-source`;

  return (
    <PlatformShell role={role} title="Moodle">
      <DetailLayout
        className="portal-simple-page moodle-content-page"
        title="Course content"
        description="Read-only sections and activities from the latest verified course snapshot."
        context={roleMeta[role].label}
        actions={
          <Link className="platform-secondary-button" href={sourceRoute}>
            <ArrowLeft size={15} />
            All Moodle courses
          </Link>
        }
        main={
          <section
            className="moodle-content-workspace-v3"
            data-testid={`moodle-course-content-${role}`}
            data-projection-source={content ? "server" : "unavailable"}
            aria-busy={loading}
            aria-labelledby="moodle-content-heading"
            data-read-only="true"
          >
            <header className="moodle-content-heading-v3">
              <div>
                <span>Learning sequence</span>
                <h2 id="moodle-content-heading">Sections and activities</h2>
              </div>
              {content ? (
                <div
                  className="moodle-content-summary-v3"
                  aria-label="Content summary"
                >
                  <span className={`moodle-course-status ${display.freshness}`}>
                    {display.freshness}
                  </span>
                  <small>
                    {display.sections.length} section(s),{" "}
                    {display.activityCount} activity(s)
                  </small>
                </div>
              ) : null}
            </header>

            {content && display.freshness === "stale" ? (
              <div
                className="moodle-source-notice warning"
                role="status"
                data-testid="moodle-content-stale"
              >
                <AlertTriangle size={17} />
                <div>
                  <strong>Showing the last verified course snapshot</strong>
                  <p>
                    Last authority check:{" "}
                    {formatObservationTime(content.authorityObservedAt)}
                  </p>
                </div>
              </div>
            ) : null}

            {content && display.isPartial ? (
              <div
                className="moodle-source-notice warning"
                role="status"
                data-testid="moodle-content-partial"
              >
                <AlertTriangle size={17} />
                <div>
                  <strong>
                    Some course content is temporarily unavailable
                  </strong>
                  <p>Available verified sections are still shown below.</p>
                </div>
              </div>
            ) : null}

            {display.state === "loading" ? (
              <div
                className="moodle-source-state-v3"
                role="status"
                data-testid="moodle-content-loading"
              >
                <RefreshCw className="moodle-source-spinner" size={20} />
                <div>
                  <strong>Loading course content</strong>
                  <p>Checking your current access and the latest snapshot.</p>
                </div>
              </div>
            ) : null}

            {display.state === "error" || display.state === "unavailable" ? (
              <div
                className="moodle-source-state-v3 error"
                role="alert"
                data-testid="moodle-content-error"
              >
                <CloudOff size={20} />
                <div>
                  <strong>Course content is unavailable</strong>
                  <p>
                    {error ||
                      "No verified course-content snapshot is available."}
                  </p>
                </div>
                <button
                  className="platform-secondary-button"
                  type="button"
                  onClick={loadContent}
                >
                  <RefreshCw size={15} />
                  Retry
                </button>
              </div>
            ) : null}

            {display.state === "empty" ? (
              <div
                className="moodle-content-empty-v3"
                data-testid="moodle-content-empty"
              >
                <BookOpen size={20} />
                <div>
                  <strong>No course content is available yet</strong>
                  <p>
                    This verified course snapshot has no sections or activities.
                  </p>
                </div>
              </div>
            ) : null}

            {display.state === "ready" ? (
              <div
                className="moodle-content-sections-v3"
                data-testid="moodle-content-ready"
              >
                {display.sections.map(section => (
                  <section
                    key={section.sourceId}
                    className="moodle-content-section-v3"
                    aria-labelledby={`moodle-section-${section.sourceId}`}
                    data-testid="moodle-content-section"
                  >
                    <header>
                      <div>
                        <span>Section {section.position}</span>
                        <h3 id={`moodle-section-${section.sourceId}`}>
                          {section.title?.trim() ||
                            `Section ${section.position}`}
                        </h3>
                      </div>
                      {section.visible === false ? (
                        <span className="moodle-content-visibility-v3">
                          <EyeOff size={14} />
                          Hidden
                        </span>
                      ) : null}
                    </header>
                    {section.activities.length ? (
                      <ul
                        aria-label={`${section.title?.trim() || `Section ${section.position}`} activities`}
                      >
                        {section.activities.map(activity => (
                          <li
                            key={activity.sourceId}
                            data-testid="moodle-content-activity"
                          >
                            <div>
                              <span>
                                {formatMoodleActivityType(activity.type)}
                              </span>
                              <strong>{activity.title}</strong>
                            </div>
                            <div className="moodle-content-activity-meta-v3">
                              {activity.visible === false ? (
                                <span>
                                  <EyeOff size={14} />
                                  Hidden
                                </span>
                              ) : null}
                              <small>
                                {completionCopy(activity.completionTracking)}
                              </small>
                              {activity.launchAvailable ? (
                                <small>
                                  <MonitorUp size={14} />
                                  Available in Moodle
                                </small>
                              ) : null}
                            </div>
                            {activity.dates?.length ? (
                              <div className="moodle-content-dates-v3">
                                {activity.dates.map(date => (
                                  <span key={`${date.label}-${date.at}`}>
                                    <CalendarClock size={14} />
                                    {date.label}:{" "}
                                    {formatObservationTime(date.at)}
                                  </span>
                                ))}
                              </div>
                            ) : null}
                            {activity.resources?.length ? (
                              <ul
                                className="moodle-content-resources-v3"
                                aria-label={`${activity.title} resources`}
                              >
                                {activity.resources.map(resource => (
                                  <li key={resource.resourceId}>
                                    <ResourceIcon kind={resource.kind} />
                                    <span>
                                      <strong>{resource.name}</strong>
                                      <small>
                                        {resource.mimeType ?? "File"} ·{" "}
                                        {formatFileSize(resource.sizeBytes)}
                                      </small>
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="moodle-content-section-empty-v3">
                        No activities in this section.
                      </p>
                    )}
                  </section>
                ))}
              </div>
            ) : null}

            <span className="platform-sr-only" aria-live="polite">
              {display.state === "ready"
                ? `${display.sections.length} sections and ${display.activityCount} activities available.`
                : display.state === "empty"
                  ? "No course content is available."
                  : ""}
            </span>
          </section>
        }
      />
    </PlatformShell>
  );
}
