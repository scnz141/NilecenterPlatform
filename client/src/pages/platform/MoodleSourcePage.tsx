import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BookOpen,
  ChevronRight,
  CloudOff,
  RefreshCw,
  Search,
} from "lucide-react";
import { Link } from "wouter";
import PlatformShell from "@/components/platform/PlatformShell";
import { WorkspaceLayout } from "@/components/platform/PlatformLayouts";
import {
  fetchMoodleCourseCatalogProjectionRequest,
  type MoodleCourseCatalogProjectionDto,
  type MoodleCourseProjectionDto,
} from "@/lib/backend/api";
import { roleMeta, type Role } from "@/lib/platformData";

type MoodleSourceRole = Extract<
  Role,
  "student" | "teacher" | "headofdepartment" | "superadmin"
>;

type MoodleSourcePageProps = {
  role: MoodleSourceRole;
};

function courseRoute(role: MoodleSourceRole) {
  if (role === "student") return "/app/student/courses";
  if (role === "teacher") return "/app/teacher/classes";
  if (role === "headofdepartment") return "/app/hod/courses";
  return "/app/admin/courses";
}

export function moodleCourseContentRoute(
  role: MoodleSourceRole,
  courseId: string
) {
  const rolePath =
    role === "headofdepartment"
      ? "hod"
      : role === "superadmin"
        ? "admin"
        : role;
  return `/app/${rolePath}/moodle-source/${encodeURIComponent(courseId)}`;
}

export function filterMoodleCourseRows(
  rows: readonly MoodleCourseProjectionDto[],
  search: string
) {
  const query = search.trim().toLowerCase();
  if (!query) return rows;
  return rows.filter(row =>
    [
      row.course?.title,
      row.course?.shortTitle,
      row.mappingState,
      row.reconciliationReason,
    ]
      .filter(Boolean)
      .join(" ")
      .replaceAll("_", " ")
      .toLowerCase()
      .includes(query)
  );
}

export function resolveMoodleCatalogDisplayState(input: {
  catalog: MoodleCourseCatalogProjectionDto | null;
  loading: boolean;
  error: string;
  search: string;
}) {
  const rows = filterMoodleCourseRows(input.catalog?.rows ?? [], input.search);
  const freshness = input.catalog?.freshness ?? "unavailable";
  const availability = input.catalog?.availability ?? "unavailable";
  const state = input.loading
    ? "loading"
    : input.error
      ? "error"
      : availability === "unavailable" && rows.length === 0
        ? "unavailable"
        : rows.length
          ? "ready"
          : "empty";
  return {
    availability,
    freshness,
    rows,
    state,
  } as const;
}

function formatObservationTime(value?: string) {
  if (!value || !Number.isFinite(Date.parse(value))) return "Not yet available";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function courseRowCopy(row: MoodleCourseProjectionDto) {
  if (row.course) {
    return {
      title: row.course.title,
      meta: row.course.shortTitle,
    };
  }
  return {
    title: "Course source unavailable",
    meta:
      row.reconciliationReason === "missing_mapping"
        ? "The course mapping needs review."
        : "The latest Moodle course record is unavailable.",
  };
}

export default function MoodleSourcePage({ role }: MoodleSourcePageProps) {
  const [search, setSearch] = useState("");
  const [catalog, setCatalog] =
    useState<MoodleCourseCatalogProjectionDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadCatalog = useCallback(async () => {
    setLoading(true);
    setError("");
    const result = await fetchMoodleCourseCatalogProjectionRequest();
    if (!result.ok || !result.data) {
      setCatalog(null);
      setError(
        result.error ?? "Moodle course content is temporarily unavailable."
      );
      setLoading(false);
      return;
    }
    setCatalog(result.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    fetchMoodleCourseCatalogProjectionRequest().then(result => {
      if (!active) return;
      if (!result.ok || !result.data) {
        setCatalog(null);
        setError(
          result.error ?? "Moodle course content is temporarily unavailable."
        );
      } else {
        setCatalog(result.data);
      }
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  const display = useMemo(
    () => resolveMoodleCatalogDisplayState({ catalog, loading, error, search }),
    [catalog, error, loading, search]
  );
  const { availability, freshness, rows } = display;

  return (
    <PlatformShell role={role} title="Moodle">
      <WorkspaceLayout
        className="portal-simple-page moodle-source-page"
        title="Moodle content"
        description="Review the course content available to this workspace."
        context={roleMeta[role].label}
        actions={
          <Link className="platform-primary-button" href={courseRoute(role)}>
            <BookOpen size={15} />
            Open courses
          </Link>
        }
        toolbar={
          <div className="moodle-source-toolbar-v3">
            <label>
              <span className="sr-only">Search course content</span>
              <Search size={15} />
              <input
                value={search}
                onChange={event => setSearch(event.target.value)}
                placeholder="Search course content"
              />
            </label>
          </div>
        }
        main={
          <section
            className="moodle-source-list-v3"
            data-testid={`moodle-source-list-${role}`}
            data-projection-source={catalog ? "server" : "unavailable"}
            aria-busy={loading}
          >
            <div className="moodle-source-list-heading">
              <div>
                <span>Course content</span>
                <h2>Available courses</h2>
              </div>
              <div className="moodle-source-list-status">
                {catalog ? (
                  <span
                    className={`moodle-course-status ${freshness}`}
                    data-testid="moodle-source-freshness"
                  >
                    {freshness}
                  </span>
                ) : null}
                <small>
                  {loading ? "Loading" : `${rows.length} course(s)`}
                </small>
              </div>
            </div>
            {catalog && freshness === "stale" ? (
              <div
                className="moodle-source-notice warning"
                role="status"
                data-testid="moodle-source-stale"
              >
                <AlertTriangle size={17} />
                <div>
                  <strong>Showing the last verified Moodle snapshot</strong>
                  <p>
                    Last authority check:{" "}
                    {formatObservationTime(catalog.authorityObservedAt)}
                  </p>
                </div>
              </div>
            ) : null}
            {catalog && availability === "unavailable" && rows.length > 0 ? (
              <div
                className="moodle-source-notice warning"
                role="status"
                data-testid="moodle-source-partial"
              >
                <AlertTriangle size={17} />
                <div>
                  <strong>
                    Some Moodle courses are temporarily unavailable
                  </strong>
                  <p>
                    Available verified course records are still shown below.
                  </p>
                </div>
              </div>
            ) : null}
            <div>
              {loading ? (
                <div
                  className="moodle-source-state-v3"
                  role="status"
                  data-testid="moodle-source-loading"
                >
                  <RefreshCw className="moodle-source-spinner" size={20} />
                  <div>
                    <strong>Loading Moodle course content</strong>
                    <p>Checking your current course access.</p>
                  </div>
                </div>
              ) : null}
              {!loading && error ? (
                <div
                  className="moodle-source-state-v3 error"
                  role="alert"
                  data-testid="moodle-source-error"
                >
                  <CloudOff size={20} />
                  <div>
                    <strong>Course content is unavailable</strong>
                    <p>{error}</p>
                  </div>
                  <button
                    className="platform-secondary-button"
                    type="button"
                    onClick={loadCatalog}
                  >
                    <RefreshCw size={15} />
                    Retry
                  </button>
                </div>
              ) : null}
              {!loading && !error && display.state === "unavailable" ? (
                <div
                  className="moodle-source-state-v3 error"
                  role="alert"
                  data-testid="moodle-source-error"
                >
                  <CloudOff size={20} />
                  <div>
                    <strong>Course content is unavailable</strong>
                    <p>No verified Moodle course snapshot is available.</p>
                  </div>
                  <button
                    className="platform-secondary-button"
                    type="button"
                    onClick={loadCatalog}
                  >
                    <RefreshCw size={15} />
                    Retry
                  </button>
                </div>
              ) : null}
              {!loading && !error && display.state !== "unavailable"
                ? rows.map((row, index) => {
                    const copy = courseRowCopy(row);
                    return (
                      <article
                        key={`${row.internalCourseId ?? "unmatched"}-${row.course?.sourceId ?? index}`}
                        data-testid="moodle-source-course"
                      >
                        <div>
                          <span>{copy.meta}</span>
                          <strong title={copy.title}>{copy.title}</strong>
                          <p>Read-only Moodle course source</p>
                        </div>
                        <span
                          className={`moodle-course-status ${row.mappingState}`}
                          title="Moodle mapping status"
                        >
                          {row.mappingState}
                        </span>
                        {row.internalCourseId ? (
                          <Link
                            href={moodleCourseContentRoute(
                              role,
                              row.internalCourseId
                            )}
                            aria-label={`Open ${copy.title}`}
                            data-testid={`moodle-source-course-open-${row.internalCourseId}`}
                          >
                            <ChevronRight size={17} />
                          </Link>
                        ) : (
                          <span aria-hidden="true" />
                        )}
                      </article>
                    );
                  })
                : null}
              {!loading &&
              !error &&
              display.state === "empty" &&
              !rows.length ? (
                <div className="moodle-source-empty-v3">
                  <strong>
                    {availability === "empty"
                      ? "No Moodle courses are assigned"
                      : "No course content found"}
                  </strong>
                  <p>
                    {availability === "empty"
                      ? "This workspace has no mapped Moodle course content yet."
                      : "Try a different course name."}
                  </p>
                </div>
              ) : null}
            </div>
            <span className="platform-sr-only" aria-live="polite">
              {!loading && !error && display.state === "ready"
                ? `${rows.length} Moodle course${rows.length === 1 ? "" : "s"} available.`
                : ""}
              {!loading && !error && display.state === "empty"
                ? availability === "empty"
                  ? "No Moodle courses are assigned."
                  : "No Moodle courses match the current search."
                : ""}
            </span>
          </section>
        }
      />
    </PlatformShell>
  );
}
