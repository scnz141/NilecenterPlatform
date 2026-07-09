import { useMemo, useState } from "react";
import {
  BookOpen,
  ArrowRight,
  Library,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import { Link } from "wouter";
import PlatformShell from "@/components/platform/PlatformShell";
import { WorkspaceLayout } from "@/components/platform/PlatformLayouts";
import {
  DataTableCard,
  StatusBadge,
} from "@/components/platform/PlatformPrimitives";
import { runPlatformWorkflowActionRequest } from "@/lib/backend/api";
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

  const updateCourseStatus = async (course: Course, nextStatus: CourseStatus) => {
    setSavingCourseId(course.id);
    const response = await runPlatformWorkflowActionRequest({
      type: "course.status.update",
      courseId: course.id,
      status: nextStatus,
      actorId: "usr_admin_demo",
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
      className="admin-ia-table-card admin-courses-catalog-table"
    >
      <div className="admin-ia-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Course</th>
              <th>Program</th>
              <th>Department</th>
              <th>Level</th>
              <th>Runs</th>
              <th>Course status</th>
              <th>Open</th>
            </tr>
          </thead>
          <tbody>
            {courseRows.map(({ course, program, department, level, runs }) => (
              <tr key={course.id}>
                <td>
                  <strong>{course.title}</strong>
                  <small>{course.description}</small>
                </td>
                <td>{program?.title ?? "No program"}</td>
                <td>{department?.name ?? "No department"}</td>
                <td>{level?.title ?? "No level"}</td>
                <td>{runs.length}</td>
                <td>
                  <label className="admin-courses-status-control">
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
                </td>
                <td>
                  <Link
                    className="platform-row-link"
                    href={`/app/admin/courses/${course.id}`}
                  >
                    Details
                    <ArrowRight size={13} />
                  </Link>
                </td>
              </tr>
            ))}
            {!courseRows.length ? (
              <tr>
                <td colSpan={7}>
                  <div className="platform-empty-state">
                    <strong>No courses found</strong>
                    <span>Try a different search or status filter.</span>
                  </div>
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
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
          <span className="admin-courses-detail-kicker">Academic structure</span>
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
        className="admin-ia-table-card admin-courses-detail-modules-table"
      >
        <div className="admin-ia-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Module</th>
                <th>Order</th>
                <th>Lessons</th>
                <th>Outcomes</th>
              </tr>
            </thead>
            <tbody>
              {selectedModules.map(module => {
                const lessons = state.lessons.filter(
                  lesson => lesson.moduleId === module.id
                );
                return (
                  <tr key={module.id}>
                    <td>
                      <strong>{module.title}</strong>
                      <small>{module.id}</small>
                    </td>
                    <td>{module.order}</td>
                    <td>{lessons.length}</td>
                    <td>{module.outcomes.join(", ") || "No outcomes"}</td>
                  </tr>
                );
              })}
              {!selectedModules.length ? (
                <tr>
                  <td colSpan={4}>
                    <div className="platform-empty-state">
                      <strong>No modules yet</strong>
                      <span>This course has no curriculum modules assigned.</span>
                    </div>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
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
      className="admin-ia-table-card admin-courses-programs-table"
    >
      <div className="admin-ia-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Program</th>
              <th>Department</th>
              <th>Language</th>
              <th>Courses</th>
              <th>Levels</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {state.programs.map(program => {
              const department = getDepartment(program.departmentId);
              const courses = state.courses.filter(
                course => course.programId === program.id
              );
              const levels = state.levels.filter(
                level => level.programId === program.id
              );
              return (
                <tr key={program.id}>
                  <td>
                    <strong>{program.title}</strong>
                    <small>{program.category}</small>
                  </td>
                  <td>{department?.name ?? "No department"}</td>
                  <td>{program.language}</td>
                  <td>{courses.length}</td>
                  <td>{levels.length}</td>
                  <td>
                    <StatusBadge tone={statusTone(program.status)}>
                      {program.status}
                    </StatusBadge>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </DataTableCard>
  );

  const levels = (
    <DataTableCard
      title="Levels"
      subtitle={`${state.levels.length} level(s)`}
      className="admin-ia-table-card admin-courses-levels-table"
    >
      <div className="admin-ia-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Level</th>
              <th>Program</th>
              <th>Order</th>
              <th>Courses</th>
              <th>Completion rules</th>
            </tr>
          </thead>
          <tbody>
            {[...state.levels]
              .sort((a, b) => a.order - b.order)
              .map(level => {
                const program = getProgram(level.programId);
                const courses = state.courses.filter(
                  course => course.levelId === level.id
                );
                return (
                  <tr key={level.id}>
                    <td>
                      <strong>{level.title}</strong>
                      <small>
                        {level.prerequisites.length
                          ? level.prerequisites.join(", ")
                          : "No prerequisites"}
                      </small>
                    </td>
                    <td>{program?.title ?? "No program"}</td>
                    <td>{level.order}</td>
                    <td>{courses.length}</td>
                    <td>{level.completionRules.join(", ")}</td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
    </DataTableCard>
  );

  const curriculum = (
    <DataTableCard
      title="Curriculum"
      subtitle={`${state.modules.length} module(s)`}
      className="admin-ia-table-card admin-courses-curriculum-table"
    >
      <div className="admin-ia-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Module</th>
              <th>Course</th>
              <th>Order</th>
              <th>Lessons</th>
              <th>Outcomes</th>
            </tr>
          </thead>
          <tbody>
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
                  <tr key={module.id}>
                    <td>
                      <strong>{module.title}</strong>
                      <small>{module.id}</small>
                    </td>
                    <td>{course?.title ?? "No course"}</td>
                    <td>{module.order}</td>
                    <td>{lessons.length}</td>
                    <td>{module.outcomes.join(", ") || "No outcomes"}</td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
    </DataTableCard>
  );

  const teachers = (
    <DataTableCard
      title="Teaching assignments"
      subtitle={`${state.courseRuns.length} course run(s)`}
      className="admin-ia-table-card admin-courses-teachers-table"
    >
      <div className="admin-ia-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Course</th>
              <th>Teacher</th>
              <th>Branch</th>
              <th>Term</th>
              <th>Dates</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {state.courseRuns.map(run => {
              const course = state.courses.find(item => item.id === run.courseId);
              const teacher = state.teachers.find(
                item => item.id === run.teacherId
              );
              const user = state.users.find(item => item.id === teacher?.userId);
              const branch = state.branches.find(
                item => item.id === run.branchId
              );
              return (
                <tr key={run.id}>
                  <td>
                    <strong>{course?.title ?? "No course"}</strong>
                    <small>{run.id}</small>
                  </td>
                  <td>{user?.name ?? "No teacher"}</td>
                  <td>{branch?.name ?? "No branch"}</td>
                  <td>{run.term}</td>
                  <td>
                    {formatDate(run.startsOn)} - {formatDate(run.endsOn)}
                  </td>
                  <td>
                    <StatusBadge tone={statusTone(run.status)}>
                      {run.status}
                    </StatusBadge>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </DataTableCard>
  );

  const resources = (
    <DataTableCard
      title="Resources"
      subtitle={`${state.resources.length} resource(s)`}
      className="admin-ia-table-card admin-courses-resources-table"
    >
      <div className="admin-ia-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Resource</th>
              <th>Lesson</th>
              <th>Course</th>
              <th>Type</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
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
                <tr key={resource.id}>
                  <td>
                    <strong>{resource.title}</strong>
                    <small>{resource.url}</small>
                  </td>
                  <td>{lesson?.title ?? "No lesson"}</td>
                  <td>{course?.title ?? "No course"}</td>
                  <td>{resource.type}</td>
                  <td>
                    <StatusBadge tone={resource.published ? "green" : "amber"}>
                      {resource.published ? "published" : "draft"}
                    </StatusBadge>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
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
            <Link className="platform-secondary-button" href="/app/admin/programs">
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
