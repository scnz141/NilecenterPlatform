import type { PlatformState } from "./types";

export type HodOperationalMetricStatus =
  | "healthy"
  | "watch"
  | "action"
  | "unavailable";

export type HodOperationalMetric = {
  id:
    | "active_classes"
    | "teacher_workload"
    | "attendance_completion"
    | "capacity_utilization"
    | "open_interventions";
  label: string;
  value: string;
  status: HodOperationalMetricStatus;
  numerator: number;
  denominator?: number;
  definition: string;
  source: "Nile Learn";
};

export type HodMoodleOutcomeBoundary = {
  id: "curriculum_completion" | "assessment_completion" | "released_outcomes";
  label: string;
  status: "unavailable";
  reason: string;
  source: "Moodle";
};

export type HodOperationalMetricsResult = {
  departmentIds: string[];
  courseRunIds: string[];
  classGroupIds: string[];
  metrics: HodOperationalMetric[];
  moodleOutcomes: HodMoodleOutcomeBoundary[];
};

function percentage(numerator: number, denominator: number) {
  if (denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 100);
}

function ratioStatus(
  value: number,
  healthyAt: number,
  watchAt: number
): HodOperationalMetricStatus {
  if (value >= healthyAt) return "healthy";
  if (value >= watchAt) return "watch";
  return "action";
}

export function buildHodOperationalMetrics(
  state: PlatformState,
  actorId: string,
  now = new Date()
): HodOperationalMetricsResult {
  const actor = state.users.find(user => user.id === actorId);
  const departments = state.departments.filter(
    department =>
      department.ownerUserId === actorId ||
      department.id === actor?.departmentId
  );
  const departmentIds = departments.map(department => department.id);
  const departmentIdSet = new Set(departmentIds);
  const programIds = new Set(
    state.programs
      .filter(program => departmentIdSet.has(program.departmentId))
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
  const courseRunIds = courseRuns.map(run => run.id);
  const courseRunIdSet = new Set(courseRunIds);
  const activeRunIds = new Set(
    courseRuns.filter(run => run.status === "active").map(run => run.id)
  );
  const classGroups = state.classGroups.filter(group =>
    courseRunIdSet.has(group.courseRunId)
  );
  const classGroupIds = classGroups.map(group => group.id);
  const classGroupIdSet = new Set(classGroupIds);
  const activeClasses = classGroups.filter(
    group => group.status === "active" && activeRunIds.has(group.courseRunId)
  );
  const activeClassIds = new Set(activeClasses.map(group => group.id));

  const activeTeacherIds = new Set(
    courseRuns
      .filter(run => run.status === "active")
      .map(run => run.teacherId)
      .filter(Boolean)
  );
  const activeTeacherClassCount = activeClasses.length;
  const teacherCount = activeTeacherIds.size;
  const averageTeacherLoad =
    teacherCount > 0 ? activeTeacherClassCount / teacherCount : 0;

  const dueSessions = state.classSessions.filter(session => {
    if (!activeClassIds.has(session.classGroupId)) return false;
    if (session.status === "cancelled") return false;
    const startsAt = new Date(session.startsAt);
    return (
      session.status === "completed" ||
      (!Number.isNaN(startsAt.getTime()) && startsAt <= now)
    );
  });
  const savedAttendance = dueSessions.filter(
    session => session.attendanceSaved
  ).length;
  const attendanceCompletion = percentage(savedAttendance, dueSessions.length);

  const occupiedSeats = activeClasses.reduce(
    (total, group) => total + group.studentIds.length,
    0
  );
  const availableSeats = activeClasses.reduce(
    (total, group) => total + Math.max(0, group.capacity),
    0
  );
  const capacityUtilization = percentage(occupiedSeats, availableSeats);

  const openInterventions = state.studentInterventions.filter(
    intervention =>
      classGroupIdSet.has(intervention.classGroupId) &&
      (intervention.status === "open" || intervention.status === "monitoring")
  ).length;

  return {
    departmentIds,
    courseRunIds,
    classGroupIds,
    metrics: [
      {
        id: "active_classes",
        label: "Active classes",
        value: String(activeClasses.length),
        status: activeClasses.length > 0 ? "healthy" : "watch",
        numerator: activeClasses.length,
        definition:
          "Active class groups attached to active course runs in this department.",
        source: "Nile Learn",
      },
      {
        id: "teacher_workload",
        label: "Teacher workload",
        value:
          teacherCount > 0
            ? `${averageTeacherLoad.toFixed(1)} classes`
            : "No assignments",
        status:
          teacherCount === 0
            ? "watch"
            : averageTeacherLoad > 6
              ? "action"
              : averageTeacherLoad > 4
                ? "watch"
                : "healthy",
        numerator: activeTeacherClassCount,
        denominator: teacherCount,
        definition:
          "Average active classes per teacher with an active course-run assignment.",
        source: "Nile Learn",
      },
      {
        id: "attendance_completion",
        label: "Attendance completion",
        value: `${attendanceCompletion}%`,
        status: ratioStatus(attendanceCompletion, 95, 80),
        numerator: savedAttendance,
        denominator: dueSessions.length,
        definition:
          "Due or completed class sessions whose attendance register has been saved.",
        source: "Nile Learn",
      },
      {
        id: "capacity_utilization",
        label: "Class capacity",
        value: `${capacityUtilization}%`,
        status:
          capacityUtilization > 100
            ? "action"
            : capacityUtilization >= 85
              ? "watch"
              : "healthy",
        numerator: occupiedSeats,
        denominator: availableSeats,
        definition:
          "Students on active class rosters divided by configured class capacity.",
        source: "Nile Learn",
      },
      {
        id: "open_interventions",
        label: "Learner interventions",
        value: String(openInterventions),
        status:
          openInterventions === 0
            ? "healthy"
            : openInterventions <= 3
              ? "watch"
              : "action",
        numerator: openInterventions,
        definition:
          "Open or monitored teacher support plans for learners in department classes.",
        source: "Nile Learn",
      },
    ],
    moodleOutcomes: [
      {
        id: "curriculum_completion",
        label: "Curriculum completion",
        status: "unavailable",
        reason:
          "Requires a fresh, verified Moodle activity-completion projection.",
        source: "Moodle",
      },
      {
        id: "assessment_completion",
        label: "Assessment completion",
        status: "unavailable",
        reason:
          "Requires fresh Moodle assignment and quiz outcome projections.",
        source: "Moodle",
      },
      {
        id: "released_outcomes",
        label: "Released grades",
        status: "unavailable",
        reason:
          "Requires a fresh Moodle grade projection with released outcomes.",
        source: "Moodle",
      },
    ],
  };
}
