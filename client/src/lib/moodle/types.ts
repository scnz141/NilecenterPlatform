export type MoodleCourse = {
  id: number;
  fullname: string;
  shortname: string;
  summary?: string;
  categoryname?: string;
};

export type MoodleGrade = {
  courseid: number;
  itemname: string;
  gradeformatted: string;
  feedback?: string;
};

export type MoodleAssignment = {
  id: number;
  course: number;
  name: string;
  duedate?: number;
  intro?: string;
};

export type MoodleActivityType =
  | "page"
  | "book"
  | "hvp"
  | "videotime"
  | "quiz"
  | "url"
  | "external_quizizz"
  | "label";

export type MoodleSourceState = "api-blocked" | "html-observed" | "ready-for-sync";

export type MoodleActivity = {
  cmid: number | null;
  title: string;
  type: MoodleActivityType;
  sourceUrl: string;
  hiddenFromStudents: boolean;
  completion: "manual" | "automatic" | "none";
  renderer: "native" | "embed" | "external" | "moodle";
  summary: string;
};

export type MoodleSection = {
  id: number | null;
  moodleIndex: number;
  title: string;
  visible: boolean;
  activities: MoodleActivity[];
};

export type MoodleSourceCourse = MoodleCourse & {
  sourceUrl: string;
  observedSectionUrl: string;
  observedSectionId: number;
  moodleFormat: string;
  teacherName: string;
  activityTotals: Record<MoodleActivityType, number>;
  sections: MoodleSection[];
  teacherTools: string[];
  integration: {
    tokenEndpoint: "enabled" | "not-tested" | "disabled";
    restAccess: MoodleSourceState;
    blockedReason: string;
    requiredFunctions: string[];
    syncStrategy: string;
  };
};
