import { publicCourses } from "../platformData";
import { mapMoodleCourseToCourse, mapMoodleGradeToGrade, mapMoodleAssignmentToAssignment } from "./mappers";
import type { MoodleActivityType, MoodleAssignment, MoodleCourse, MoodleGrade, MoodleSourceCourse } from "./types";

const mockMoodleCourses: MoodleCourse[] = publicCourses.slice(0, 4).map((course, index) => ({
  id: index + 1,
  fullname: course.title,
  shortname: course.slug.toUpperCase(),
  summary: course.description,
  categoryname: course.level,
}));

const mockMoodleGrades: MoodleGrade[] = [
  { courseid: 1, itemname: "Grammar quiz 3", gradeformatted: "88%", feedback: "Strong syntax control." },
  { courseid: 2, itemname: "Tajweed oral review", gradeformatted: "92%", feedback: "Madd timing improved." },
];

const mockMoodleAssignments: MoodleAssignment[] = [
  { id: 101, course: 1, name: "Arabic writing reflection", duedate: 1782873600 },
  { id: 102, course: 2, name: "Audio recitation upload", duedate: 1782960000 },
];

const moduleTotals: Record<MoodleActivityType, number> = {
  page: 89,
  book: 6,
  hvp: 66,
  videotime: 16,
  quiz: 42,
  url: 9,
  external_quizizz: 2,
  label: 0,
};

const moodleCourseSource: MoodleSourceCourse = {
  id: 25472,
  fullname: "Kos-B02-Onli - Quran Reading for Beginners Level 01 (English) (C26060247)",
  shortname: "C26060247",
  categoryname: "Quran Reading for Beginners",
  summary: "Observed teacher course with nested lesson sections, H5P activities, Moodle pages, books, quizzes, Video Time lessons, and external Quizizz links.",
  sourceUrl: "https://nilecenter.online/course/view.php?id=25472",
  observedSectionUrl: "https://nilecenter.online/course/view.php?id=25472&sectionid=774610",
  observedSectionId: 774610,
  moodleFormat: "multitopic",
  teacherName: "Ahmed Abdelaziz",
  activityTotals: moduleTotals,
  teacherTools: [
    "Turn editing on",
    "Edit settings",
    "Course completion",
    "Enrolled users",
    "Enrolment methods",
    "Groups",
    "Reports",
    "Logs and live logs",
    "Activity report",
    "Course participation",
    "Activity completion",
    "Gradebook setup",
    "Backup, restore, import, reset",
    "Question bank",
  ],
  integration: {
    tokenEndpoint: "enabled",
    restAccess: "api-blocked",
    blockedReason: "The Moodle token endpoint issued a token, but standard REST functions returned webservice_access_exception for the provided teacher service.",
    requiredFunctions: [
      "core_webservice_get_site_info",
      "core_course_get_contents",
      "core_course_get_courses_by_field",
      "core_enrol_get_users_courses",
      "core_completion_get_activities_completion_status",
      "mod_quiz_get_quizzes_by_courses",
    ],
    syncStrategy: "Use a dedicated server-side Moodle integration token with the required REST functions enabled. Keep the authenticated HTML importer only as a temporary verification fallback.",
  },
  sections: [
    {
      id: 774610,
      moodleIndex: 1,
      title: "Lessons",
      visible: true,
      activities: [],
    },
    {
      id: 774611,
      moodleIndex: 2,
      title: "01- Arabic letters (أ: ذ) Surat Al-Fatihah",
      visible: true,
      activities: [
        {
          cmid: 5104067,
          title: "Lesson Objectives",
          type: "page",
          sourceUrl: "https://nilecenter.online/mod/page/view.php?id=5104067",
          hiddenFromStudents: true,
          completion: "manual",
          renderer: "moodle",
          summary: "Teacher-facing lesson objective page hidden from students.",
        },
        {
          cmid: 5104068,
          title: "Arabic letters: (أ:ذ)",
          type: "book",
          sourceUrl: "https://nilecenter.online/mod/book/view.php?id=5104068",
          hiddenFromStudents: false,
          completion: "manual",
          renderer: "moodle",
          summary: "Moodle Book with chapter table of contents, images, print/export actions, and listening chapter.",
        },
        {
          cmid: 5104070,
          title: "Activity 1: Listen and choose the correct word",
          type: "hvp",
          sourceUrl: "https://nilecenter.online/mod/hvp/view.php?id=5104070",
          hiddenFromStudents: false,
          completion: "manual",
          renderer: "embed",
          summary: "H5P interactive content. Requires Moodle H5P libraries, xAPI collector, and user-data save endpoint.",
        },
        {
          cmid: 5104072,
          title: "Listen and recite: Surat Al-Fatihah",
          type: "page",
          sourceUrl: "https://nilecenter.online/mod/page/view.php?id=5104072",
          hiddenFromStudents: false,
          completion: "manual",
          renderer: "embed",
          summary: "Moodle Page embedding Google Drive preview and pluginfile Quran image content.",
        },
        {
          cmid: 5104073,
          title: "Watch and remember: Surat Al-Fatihah",
          type: "videotime",
          sourceUrl: "https://nilecenter.online/mod/videotime/view.php?id=5104073",
          hiddenFromStudents: false,
          completion: "manual",
          renderer: "embed",
          summary: "Video Time activity using a Vimeo player and Moodle completion hooks.",
        },
        {
          cmid: 5104075,
          title: "Quizizz link",
          type: "url",
          sourceUrl: "https://nilecenter.online/mod/url/view.php?id=5104075",
          hiddenFromStudents: true,
          completion: "manual",
          renderer: "external",
          summary: "Moodle URL activity that opens an external Quizizz resource.",
        },
        {
          cmid: 5104076,
          title: "01- Test yourself",
          type: "quiz",
          sourceUrl: "https://nilecenter.online/mod/quiz/view.php?id=5104076",
          hiddenFromStudents: false,
          completion: "manual",
          renderer: "moodle",
          summary: "Moodle quiz with one attempt, preview/results controls for teachers, and question bank linkage.",
        },
        {
          cmid: 5104077,
          title: "01- Record your voice to test yourself",
          type: "quiz",
          sourceUrl: "https://nilecenter.online/mod/quiz/view.php?id=5104077",
          hiddenFromStudents: false,
          completion: "manual",
          renderer: "moodle",
          summary: "Voice-oriented quiz workflow that should become a native oral submission surface later.",
        },
      ],
    },
    {
      id: 774612,
      moodleIndex: 3,
      title: "02- Arabic letters (ر: غ)",
      visible: true,
      activities: [
        {
          cmid: 5104078,
          title: "Lesson Objectives",
          type: "page",
          sourceUrl: "https://nilecenter.online/mod/page/view.php?id=5104078",
          hiddenFromStudents: true,
          completion: "manual",
          renderer: "moodle",
          summary: "Teacher-facing lesson objectives.",
        },
        {
          cmid: 5104079,
          title: "Arabic letters (ر:غ)",
          type: "book",
          sourceUrl: "https://nilecenter.online/mod/book/view.php?id=5104079",
          hiddenFromStudents: false,
          completion: "manual",
          renderer: "moodle",
          summary: "Book activity with reading/listening structure.",
        },
        {
          cmid: 5104082,
          title: "Listen and choose the correct answer",
          type: "hvp",
          sourceUrl: "https://nilecenter.online/mod/hvp/view.php?id=5104082",
          hiddenFromStudents: false,
          completion: "manual",
          renderer: "embed",
          summary: "H5P listening activity.",
        },
        {
          cmid: 5104085,
          title: "02- Test yourself",
          type: "quiz",
          sourceUrl: "https://nilecenter.online/mod/quiz/view.php?id=5104085",
          hiddenFromStudents: false,
          completion: "manual",
          renderer: "moodle",
          summary: "Moodle quiz activity for lesson self-check.",
        },
      ],
    },
    {
      id: 774613,
      moodleIndex: 4,
      title: "03- Arabic letters (ف: ي) / Surat An-Nas",
      visible: true,
      activities: [
        {
          cmid: 5104088,
          title: "Lesson Objectives",
          type: "page",
          sourceUrl: "https://nilecenter.online/mod/page/view.php?id=5104088",
          hiddenFromStudents: true,
          completion: "manual",
          renderer: "moodle",
          summary: "Teacher-facing objective page.",
        },
        {
          cmid: 5104091,
          title: "Activity 1: Listen and choose the right word",
          type: "hvp",
          sourceUrl: "https://nilecenter.online/mod/hvp/view.php?id=5104091",
          hiddenFromStudents: false,
          completion: "manual",
          renderer: "embed",
          summary: "H5P listening activity.",
        },
        {
          cmid: 5104094,
          title: "Listen and recite: Surat An-Nas",
          type: "page",
          sourceUrl: "https://nilecenter.online/mod/page/view.php?id=5104094",
          hiddenFromStudents: false,
          completion: "manual",
          renderer: "embed",
          summary: "Quran read/listen page.",
        },
        {
          cmid: 5104095,
          title: "Watch the video and memorize: Surat An-Nas",
          type: "videotime",
          sourceUrl: "https://nilecenter.online/mod/videotime/view.php?id=5104095",
          hiddenFromStudents: false,
          completion: "manual",
          renderer: "embed",
          summary: "Video Time memorization activity.",
        },
        {
          cmid: 5104098,
          title: "03- Test yourself",
          type: "quiz",
          sourceUrl: "https://nilecenter.online/mod/quiz/view.php?id=5104098",
          hiddenFromStudents: false,
          completion: "manual",
          renderer: "moodle",
          summary: "Lesson quiz.",
        },
      ],
    },
    {
      id: 774614,
      moodleIndex: 5,
      title: "04- A review of the Arabic letters",
      visible: true,
      activities: [
        {
          cmid: 5104100,
          title: "The letter names PPT",
          type: "page",
          sourceUrl: "https://nilecenter.online/mod/page/view.php?id=5104100",
          hiddenFromStudents: true,
          completion: "manual",
          renderer: "moodle",
          summary: "Hidden teacher presentation material.",
        },
        {
          cmid: 5104101,
          title: "Listen to the letters",
          type: "hvp",
          sourceUrl: "https://nilecenter.online/mod/hvp/view.php?id=5104101",
          hiddenFromStudents: false,
          completion: "manual",
          renderer: "embed",
          summary: "H5P listening review.",
        },
        {
          cmid: null,
          title: "Quizizz review link",
          type: "external_quizizz",
          sourceUrl: "https://quizizz.com/admin/quiz/626a94b9f76428001d8b04e8",
          hiddenFromStudents: true,
          completion: "manual",
          renderer: "external",
          summary: "External Quizizz item observed as a hidden teacher link.",
        },
      ],
    },
    {
      id: 774615,
      moodleIndex: 6,
      title: "05- Forms of Arabic letters / Surat Al-Falaq",
      visible: true,
      activities: [
        {
          cmid: 5104111,
          title: "Lesson Objectives",
          type: "page",
          sourceUrl: "https://nilecenter.online/mod/page/view.php?id=5104111",
          hiddenFromStudents: true,
          completion: "manual",
          renderer: "moodle",
          summary: "Teacher-facing objectives.",
        },
        {
          cmid: 5104113,
          title: "Choose the correct shape of the letter",
          type: "hvp",
          sourceUrl: "https://nilecenter.online/mod/hvp/view.php?id=5104113",
          hiddenFromStudents: false,
          completion: "manual",
          renderer: "embed",
          summary: "H5P shape recognition activity.",
        },
        {
          cmid: 5104117,
          title: "Listen and recite: Surat Al-Falaq",
          type: "page",
          sourceUrl: "https://nilecenter.online/mod/page/view.php?id=5104117",
          hiddenFromStudents: false,
          completion: "manual",
          renderer: "embed",
          summary: "Quran read/listen page.",
        },
        {
          cmid: 5104118,
          title: "Watch the video and memorize: Surat Al-Falaq",
          type: "videotime",
          sourceUrl: "https://nilecenter.online/mod/videotime/view.php?id=5104118",
          hiddenFromStudents: false,
          completion: "manual",
          renderer: "embed",
          summary: "Video Time memorization activity.",
        },
        {
          cmid: 5104121,
          title: "05- Test yourself",
          type: "quiz",
          sourceUrl: "https://nilecenter.online/mod/quiz/view.php?id=5104121",
          hiddenFromStudents: false,
          completion: "manual",
          renderer: "moodle",
          summary: "Lesson quiz.",
        },
      ],
    },
    {
      id: 774616,
      moodleIndex: 7,
      title: "06- Short Vowels (Fatha) / Surat Al-Ikhlas",
      visible: true,
      activities: [
        {
          cmid: 5104123,
          title: "Lesson Objectives",
          type: "page",
          sourceUrl: "https://nilecenter.online/mod/page/view.php?id=5104123",
          hiddenFromStudents: true,
          completion: "manual",
          renderer: "moodle",
          summary: "Teacher objectives for short vowels.",
        },
        {
          cmid: 5104127,
          title: "Words with fatha",
          type: "book",
          sourceUrl: "https://nilecenter.online/mod/book/view.php?id=5104127",
          hiddenFromStudents: false,
          completion: "manual",
          renderer: "moodle",
          summary: "Book activity for fatha word practice.",
        },
        {
          cmid: 5104128,
          title: "Listen and choose the correct answer",
          type: "hvp",
          sourceUrl: "https://nilecenter.online/mod/hvp/view.php?id=5104128",
          hiddenFromStudents: false,
          completion: "manual",
          renderer: "embed",
          summary: "H5P listening practice.",
        },
        {
          cmid: 5104131,
          title: "Watch and memorize: Surat Al-Ikhlas",
          type: "videotime",
          sourceUrl: "https://nilecenter.online/mod/videotime/view.php?id=5104131",
          hiddenFromStudents: false,
          completion: "manual",
          renderer: "embed",
          summary: "Video Time memorization lesson.",
        },
      ],
    },
  ],
};

export function getMoodleSourceCourseSnapshot() {
  return moodleCourseSource;
}

export async function getMoodleCourses() {
  return mockMoodleCourses.map(mapMoodleCourseToCourse);
}

export async function getMoodleCourse(id: number) {
  const course = mockMoodleCourses.find((item) => item.id === id) ?? mockMoodleCourses[0];
  return mapMoodleCourseToCourse(course);
}

export async function getMoodleUserCourses(_userId: string) {
  return getMoodleCourses();
}

export async function getMoodleGrades(_userId: string) {
  return mockMoodleGrades.map(mapMoodleGradeToGrade);
}

export async function getMoodleAssignments(courseId: number) {
  return mockMoodleAssignments
    .filter((assignment) => assignment.course === courseId)
    .map(mapMoodleAssignmentToAssignment);
}

export async function getMoodleSourceCourse() {
  return moodleCourseSource;
}
