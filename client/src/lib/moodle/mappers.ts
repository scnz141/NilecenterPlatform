import type { MoodleAssignment, MoodleCourse, MoodleGrade } from "./types";

export function mapMoodleCourseToCourse(course: MoodleCourse) {
  return {
    id: `moodle-course-${course.id}`,
    title: course.fullname,
    code: course.shortname,
    category: course.categoryname ?? "Legacy Moodle",
    description: course.summary ?? "Imported from Moodle once integration credentials are configured.",
  };
}

export function mapMoodleGradeToGrade(grade: MoodleGrade) {
  return {
    courseId: `moodle-course-${grade.courseid}`,
    item: grade.itemname,
    value: grade.gradeformatted,
    feedback: grade.feedback ?? "No Moodle feedback yet.",
  };
}

export function mapMoodleAssignmentToAssignment(assignment: MoodleAssignment) {
  return {
    id: `moodle-assignment-${assignment.id}`,
    courseId: `moodle-course-${assignment.course}`,
    title: assignment.name,
    dueDate: assignment.duedate ? new Date(assignment.duedate * 1000).toISOString() : null,
    description: assignment.intro ?? "Imported assignment placeholder.",
  };
}

