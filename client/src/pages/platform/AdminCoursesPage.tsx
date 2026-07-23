import { useMemo, useState } from "react";
import { BookOpen, ArrowRight, Library, Search } from "lucide-react";
import { toast } from "sonner";
import { Link } from "wouter";
import PlatformShell from "@/components/platform/PlatformShell";
import { WorkspaceLayout } from "@/components/platform/PlatformLayouts";
import {
  DataTableCard,
  StatusBadge,
} from "@/components/platform/PlatformPrimitives";
import { runPlatformWorkflowActionRequest } from "@/lib/backend/api";
import { requireActiveUser } from "@/lib/auth/session";
import { platformStore } from "@/lib/domain/store";
import type { Course, EntityStatus } from "@/lib/domain/types";

type AdminCoursesView =
  | "catalog"
  | "programs"
  | "levels"
  | "curriculum"
  | "teachers"
  | "resources"
  | "detail";

type AdminCoursesPageProps = {
  view?: AdminCoursesView;
  courseId?: string;
};

type CourseStatus = Extract<
  EntityStatus,
  "draft" | "active" | "paused" | "completed"
>;

const courseStatusOptions: CourseStatus[] = [
  "draft",
  "active",
  "paused",
  "completed",
];

function statusTone(status: EntityStatus): "green" | "amber" | "slate" {
  if (status === "active" || status === "completed") return "green";
  if (status === "draft" || status === "paused" || status === "pending") {
    return "amber";
  }
  return "slate";
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date not set";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export default function AdminCoursesPage({
  view = "catalog",
  courseId,
}: AdminCoursesPageProps) {
  const [version, setVersion] = useState(0);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | CourseStatus>("all");
  const [savingCourseId, setSavingCourseId] = useState("");
  const state = useMemo(() => platformStore.getState(), [version]);

  const tabs = [
    {
      href: "/app/admin/courses",
      label: "Catalog",
      active: view === "catalog",
    },
    {
      href: "/app/admin/courses/programs",
      label: "Programs",
      active: view === "programs",
    },
    {
      href: "/app/admin/courses/levels",
      label: "Levels",
      active: view === "levels",
    },
    {
      href: "/app/admin/courses/curriculum",
      label: "Curriculum",
      active: view === "curriculum",
    },
    {
      href: "/app/admin/courses/teachers",
      label: "Teachers",
      active: view === "teachers",
    },
    {
      href: "/app/admin/courses/resources",
      label: "Resources",
      active: view === "resources",
    },
  ];

  const getProgram = (programId?: string) =>
    state.programs.find(program => program.id === programId);
  const getDepartment = (departmentId?: string) =>
    state.departments.find(department => department.id === departmentId);
  const getLevel = (levelId?: string) =>
    state.levels.find(level => level.id === levelId);
  const selectedCourse = courseId
    ? state.courses.find(course => course.id === courseId)
    : undefined;
  const selectedProgram = getProgram(selectedCourse?.programId);
  const selectedDepartment = getDepartment(selectedProgram?.departmentId);
  const selectedLevel = getLevel(selectedCourse?.levelId);
  const selectedModules = selectedCourse
    ? state.modules
        .filter(module => module.courseId === selectedCourse.id)
        .sort((a, b) => a.order - b.order)
    : [];
  const selectedLessonIds = new Set(
    state.lessons
      .filter(lesson =>
        selectedModules.some(module => module.id === lesson.moduleId)
      )
      .map(lesson => lesson.id)
  );
  const selectedRuns = selectedCourse
    ? state.courseRuns.filter(run => run.courseId === selectedCourse.id)
    : [];
  const selectedRunIds = new Set(selectedRuns.map(run => run.id));
  const selectedClasses = state.classGroups.filter(group =>
    selectedRunIds.has(group.courseRunId)
  );
  const selectedResources = state.resources.filter(resource =>
    selectedLessonIds.has(resource.lessonId)
  );

  const courseRows = state.courses
    .map(course => {
      const program = getProgram(course.programId);
      const department = getDepartment(program?.departmentId);
      const level = getLevel(course.levelId);
      const runs = state.courseRuns.filter(run => run.courseId === course.id);
      return { course, program, department, level, runs };
    })
    .filter(row => {
      const text = [
        row.course.title,
        row.course.description,
        row.program?.title,
        row.department?.name,
        row.level?.title,
        row.course.status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return (
        text.includes(search.toLowerCase()) &&
        (status === "all" || row.course.status === status)
      );
    });

  const updateCourseStatus = async (
    course: Course,
    nextStatus: CourseStatus
  ) => {
    setSavingCourseId(course.id);
    const response = await runPlatformWorkflowActionRequest({
      type: "course.status.update",
      courseId: course.id,
      status: nextStatus,
      actorId: requireActiveUser("superadmin").id,
    });
    setSavingCourseId("");

    if (!response.ok || !response.data) {
      toast.error("Course status could not be saved", {
        description: response.error ?? "The course catalog was not updated.",
      });
      return;
    }

    platformStore.setState(response.data.state);
    setVersion(current => current + 1);
    toast.success("Course status updated", {
      description: `${course.title} is now ${nextStatus}.`,
    });
  };

  const catalog = (
    <DataTableCard
      title="Course catalog"
      subtitle={`${courseRows.length} course(s)`}
      className="admin-ia-table-card admin-courses-catalog-list"
    >
      <div className="admin-record-list admin-course-catalog-records">
        {courseRows.map(({ course, program, department, level, runs }) => (
          <article key={course.id}>
            <div className="admin-record-list-copy">
              <span>{program?.title ?? "Program not set"}</span>
              <strong>{course.title}</strong>
              <p>{course.description}</p>
            </div>
            <dl className="admin-record-list-facts">
              <div>
                <dt>Department</dt>
                <dd>{department?.name ?? "Not set"}</dd>
              </div>
              <div>
                <dt>Level</dt>
                <dd>{level?.title ?? "Not set"}</dd>
              </div>
              <div>
                <dt>Class runs</dt>
                <dd>{runs.length}</dd>
              </div>
            </dl>
            <div className="admin-record-list-actions">
              <label className="admin-record-list-select">
                <span>Course status</span>
                <select
                  value={course.status}
                  disabled={savingCourseId === course.id}
                  onChange={event =>
                    void updateCourseStatus(
                      course,
                      event.target.value as CourseStatus
                    )
                  }
                >
                  {courseStatusOptions.map(option => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
              <Link
                className="simple-portal-row-action"
                href={`/app/admin/courses/${course.id}`}
              >
                Details
                <ArrowRight size={14} />
              </Link>
            </div>
          </article>
        ))}
        {!courseRows.length ? (
          <div className="platform-empty-state">
            <strong>No courses found</strong>
            <span>Try a different search or status filter.</span>
          </div>
        ) : null}
      </div>
    </DataTableCard>
  );

  const detail = selectedCourse ? (
    <div className="admin-courses-detail-stack">
      <section className="admin-courses-detail-card">
        <div>
          <span className="admin-courses-detail-kicker">Course record</span>
          <h2>{selectedCourse.title}</h2>
          <p>{selectedCourse.description}</p>
        </div>
        <StatusBadge tone={statusTone(selectedCourse.status)}>
          {selectedCourse.status}
        </StatusBadge>
      </section>

      <div className="admin-courses-detail-grid">
        <section className="admin-courses-detail-card">
          <span className="admin-courses-detail-kicker">
            Academic structure
          </span>
          <dl className="admin-courses-detail-list">
            <div>
              <dt>Program</dt>
              <dd>{selectedProgram?.title ?? "No program"}</dd>
            </div>
            <div>
              <dt>Department</dt>
              <dd>{selectedDepartment?.name ?? "No department"}</dd>
            </div>
            <div>
              <dt>Level</dt>
              <dd>{selectedLevel?.title ?? "No level"}</dd>
            </div>
            <div>
              <dt>Outcomes</dt>
              <dd>{selectedCourse.outcomes.join(", ") || "No outcomes"}</dd>
            </div>
          </dl>
        </section>

        <section className="admin-courses-detail-card">
          <span className="admin-courses-detail-kicker">Delivery summary</span>
          <dl className="admin-courses-detail-list">
            <div>
              <dt>Course runs</dt>
              <dd>{selectedRuns.length}</dd>
            </div>
            <div>
              <dt>Class groups</dt>
              <dd>{selectedClasses.length}</dd>
            </div>
            <div>
              <dt>Modules</dt>
              <dd>{selectedModules.length}</dd>
            </div>
            <div>
              <dt>Resources</dt>
              <dd>{selectedResources.length}</dd>
            </div>
          </dl>
        </section>
      </div>

      <DataTableCard
        title="Course modules"
        subtitle={`${selectedModules.length} module(s)`}
        className="admin-ia-table-card admin-courses-detail-modules-list"
      >
        <div className="admin-record-list admin-course-module-records">
          {selectedModules.map(module => {
            const lessons = state.lessons.filter(
              lesson => lesson.moduleId === module.id
            );
            return (
              <article key={module.id}>
                <div className="admin-record-list-copy">
                  <span>Module {module.order}</span>
                  <strong>{module.title}</strong>
                  <p>
                    {module.outcomes.slice(0, 2).join(" · ") ||
                      "No outcomes set"}
                  </p>
                </div>
                <div className="admin-record-list-meta">
                  <small>{lessons.length} lessons</small>
                </div>
              </article>
            );
          })}
          {!selectedModules.length ? (
            <div className="platform-empty-state">
              <strong>No modules yet</strong>
              <span>This course has no curriculum modules assigned.</span>
            </div>
          ) : null}
        </div>
      </DataTableCard>
    </div>
  ) : (
    <DataTableCard
      title="Course not found"
      subtitle="No matching catalog record"
      className="admin-ia-table-card"
    >
      <div className="platform-empty-state">
        <strong>No course record found</strong>
        <span>Return to the catalog and open an existing course.</span>
        <Link className="platform-row-link" href="/app/admin/courses">
          Back to catalog
        </Link>
      </div>
    </DataTableCard>
  );

  const programs = (
    <DataTableCard
      title="Programs"
      subtitle={`${state.programs.length} program(s)`}
      className="admin-ia-table-card admin-courses-programs-list"
    >
      <div className="admin-record-list admin-course-program-records">
        {state.programs.map(program => {
          const department = getDepartment(program.departmentId);
          const courses = state.courses.filter(
            course => course.programId === program.id
          );
          const levels = state.levels.filter(
            level => level.programId === program.id
          );
          return (
            <article key={program.id}>
              <div className="admin-record-list-copy">
                <span>{department?.name ?? "Department not set"}</span>
                <strong>{program.title}</strong>
                <p>
                  {program.category} · {program.language}
                </p>
              </div>
              <dl className="admin-record-list-facts">
                <div>
                  <dt>Courses</dt>
                  <dd>{courses.length}</dd>
                </div>
                <div>
                  <dt>Levels</dt>
                  <dd>{levels.length}</dd>
                </div>
              </dl>
              <div className="admin-record-list-meta">
                <StatusBadge tone={statusTone(program.status)}>
                  {program.status}
                </StatusBadge>
              </div>
            </article>
          );
        })}
      </div>
    </DataTableCard>
  );

  const levels = (
    <DataTableCard
      title="Levels"
      subtitle={`${state.levels.length} level(s)`}
      className="admin-ia-table-card admin-courses-levels-list"
    >
      <div className="admin-record-list admin-course-level-records">
        {[...state.levels]
          .sort((a, b) => a.order - b.order)
          .map(level => {
            const program = getProgram(level.programId);
            const courses = state.courses.filter(
              course => course.levelId === level.id
            );
            return (
              <article key={level.id}>
                <div className="admin-record-list-copy">
                  <span>{program?.title ?? "Program not set"}</span>
                  <strong>{level.title}</strong>
                  <p>
                    {level.prerequisites.length
                      ? `Prerequisites: ${level.prerequisites.join(", ")}`
                      : "No prerequisites"}
                  </p>
                </div>
                <dl className="admin-record-list-facts">
                  <div>
                    <dt>Courses</dt>
                    <dd>{courses.length}</dd>
                  </div>
                  <div>
                    <dt>Completion</dt>
                    <dd>{level.completionRules.length} rule(s)</dd>
                  </div>
                </dl>
                <div className="admin-record-list-meta">
                  <small>Level {level.order}</small>
                </div>
              </article>
            );
          })}
      </div>
    </DataTableCard>
  );

  const curriculum = (
    <DataTableCard
      title="Curriculum"
      subtitle={`${state.modules.length} module(s)`}
      className="admin-ia-table-card admin-courses-curriculum-list"
    >
      <div className="admin-record-list admin-course-curriculum-records">
        {[...state.modules]
          .sort((a, b) => a.order - b.order)
          .map(module => {
            const course = state.courses.find(
              item => item.id === module.courseId
            );
            const lessons = state.lessons.filter(
              lesson => lesson.moduleId === module.id
            );
            return (
              <article key={module.id}>
                <div className="admin-record-list-copy">
                  <span>{course?.title ?? "Course not set"}</span>
                  <strong>{module.title}</strong>
                  <p>
                    {module.outcomes.slice(0, 2).join(" · ") ||
                      "No outcomes set"}
                  </p>
                </div>
                <dl className="admin-record-list-facts">
                  <div>
                    <dt>Lessons</dt>
                    <dd>{lessons.length}</dd>
                  </div>
                </dl>
                <div className="admin-record-list-meta">
                  <small>Module {module.order}</small>
                </div>
              </article>
            );
          })}
      </div>
    </DataTableCard>
  );

  const teachers = (
    <DataTableCard
      title="Teaching assignments"
      subtitle={`${state.courseRuns.length} course run(s)`}
      className="admin-ia-table-card admin-courses-teachers-list"
    >
      <div className="admin-record-list admin-course-teacher-records">
        {state.courseRuns.map(run => {
          const course = state.courses.find(item => item.id === run.courseId);
          const teacher = state.teachers.find(
            item => item.id === run.teacherId
          );
          const user = state.users.find(item => item.id === teacher?.userId);
          const branch = state.branches.find(item => item.id === run.branchId);
          return (
            <article key={run.id}>
              <div className="admin-record-list-copy">
                <span>{user?.name ?? "Teacher not set"}</span>
                <strong>{course?.title ?? "Course not set"}</strong>
                <p>
                  {branch?.name ?? "Branch not set"} · {run.term}
                </p>
              </div>
              <dl className="admin-record-list-facts">
                <div>
                  <dt>Dates</dt>
                  <dd>
                    {formatDate(run.startsOn)} - {formatDate(run.endsOn)}
                  </dd>
                </div>
              </dl>
              <div className="admin-record-list-meta">
                <StatusBadge tone={statusTone(run.status)}>
                  {run.status}
                </StatusBadge>
              </div>
            </article>
          );
        })}
      </div>
    </DataTableCard>
  );

  const resources = (
    <DataTableCard
      title="Resources"
      subtitle={`${state.resources.length} resource(s)`}
      className="admin-ia-table-card admin-courses-resources-list"
    >
      <div className="admin-record-list admin-course-resource-records">
        {state.resources.map(resource => {
          const lesson = state.lessons.find(
            item => item.id === resource.lessonId
          );
          const module = state.modules.find(
            item => item.id === lesson?.moduleId
          );
          const course = state.courses.find(
            item => item.id === module?.courseId
          );
          return (
            <article key={resource.id}>
              <div className="admin-record-list-copy">
                <span>{course?.title ?? "Course not set"}</span>
                <strong>{resource.title}</strong>
                <p>
                  {lesson?.title ?? "Lesson not set"} · {resource.type}
                </p>
              </div>
              <div className="admin-record-list-meta">
                <StatusBadge tone={resource.published ? "green" : "amber"}>
                  {resource.published ? "published" : "draft"}
                </StatusBadge>
              </div>
            </article>
          );
        })}
      </div>
    </DataTableCard>
  );

  const pageCopy: Record<
    AdminCoursesView,
    { title: string; description: string }
  > = {
    catalog: {
      title: "Courses",
      description: "Manage the course catalog only.",
    },
    programs: {
      title: "Programs",
      description: "Review program structure.",
    },
    levels: {
      title: "Levels",
      description: "Review learning levels and prerequisites.",
    },
    curriculum: {
      title: "Curriculum",
      description: "Review modules and lessons.",
    },
    teachers: {
      title: "Course teachers",
      description: "Review teaching assignments.",
    },
    resources: {
      title: "Resources",
      description: "Review lesson resources.",
    },
    detail: {
      title: selectedCourse?.title ?? "Course detail",
      description: "Review one course record and its relationships.",
    },
  };

  const main = {
    catalog,
    programs,
    levels,
    curriculum,
    teachers,
    resources,
    detail,
  }[view];

  return (
    <PlatformShell role="superadmin" title="Courses">
      <WorkspaceLayout
        className="admin-ia-page admin-courses-page"
        title={pageCopy[view].title}
        description={pageCopy[view].description}
        actions={
          view === "catalog" ? (
            <Link
              className="platform-secondary-button"
              href="/app/admin/programs"
            >
              <Library size={15} />
              View programs
            </Link>
          ) : (
            <Link className="platform-primary-button" href="/app/admin/courses">
              <BookOpen size={15} />
              Back to catalog
            </Link>
          )
        }
        toolbar={
          view === "detail" ? null : (
            <div className="admin-ia-control-row">
              <nav className="admin-ia-subnav" aria-label="Course sections">
                {tabs.map(tab => (
                  <Link
                    key={tab.href}
                    href={tab.href}
                    className={tab.active ? "active" : ""}
                  >
                    {tab.label}
                  </Link>
                ))}
              </nav>
              {view === "catalog" ? (
                <div className="admin-ia-toolbar">
                  <label className="admin-ia-search">
                    <Search size={16} />
                    <input
                      value={search}
                      onChange={event => setSearch(event.target.value)}
                      placeholder="Search courses"
                      aria-label="Search courses"
                    />
                  </label>
                  <label>
                    Status
                    <select
                      value={status}
                      onChange={event =>
                        setStatus(event.target.value as "all" | CourseStatus)
                      }
                    >
                      <option value="all">All statuses</option>
                      {courseStatusOptions.map(option => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              ) : null}
            </div>
          )
        }
        main={main}
      />
    </PlatformShell>
  );
}
