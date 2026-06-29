import { rolePermissions } from "../platformData";
import type { PlatformState } from "./types";

export const seedPlatformState: PlatformState = {
  users: [
    { id: "usr_student_demo", name: "Student Demo", email: "student.demo@nilelearn.local", roles: ["student"], activeRole: "student", branchId: "br_online", departmentId: "dep_arabic", status: "active" },
    { id: "usr_student_cairo_demo", name: "Cairo Student Demo", email: "cairo.student.demo@nilelearn.local", roles: ["student"], activeRole: "student", branchId: "br_cairo", departmentId: "dep_arabic", status: "active" },
    { id: "usr_teacher_demo", name: "Teacher Demo", email: "teacher.demo@nilelearn.local", roles: ["teacher"], activeRole: "teacher", branchId: "br_online", departmentId: "dep_arabic", status: "active" },
    { id: "usr_registrar_demo", name: "Registrar Demo", email: "registrar.demo@nilelearn.local", roles: ["registrar"], activeRole: "registrar", branchId: "br_cairo", departmentId: "dep_admissions", status: "active" },
    { id: "usr_hod_demo", name: "HOD Demo", email: "hod.demo@nilelearn.local", roles: ["headofdepartment"], activeRole: "headofdepartment", branchId: "br_global", departmentId: "dep_arabic", status: "active" },
    { id: "usr_branch_demo", name: "Branch Demo", email: "branch.demo@nilelearn.local", roles: ["branchadmin"], activeRole: "branchadmin", branchId: "br_cairo", departmentId: "dep_operations", status: "active" },
    { id: "usr_admin_demo", name: "Admin Demo", email: "admin.demo@nilelearn.local", roles: ["superadmin"], activeRole: "superadmin", branchId: "br_global", departmentId: "dep_platform", status: "active" },
  ],
  branches: [
    { id: "br_global", name: "Global", code: "GLOBAL", timezone: "Africa/Cairo", address: "Global online operations", status: "active" },
    { id: "br_cairo", name: "Cairo B1", code: "B1", timezone: "Africa/Cairo", address: "Cairo branch", status: "active" },
    { id: "br_alex", name: "Alexandria B2", code: "B2", timezone: "Africa/Cairo", address: "Alexandria branch", status: "active" },
    { id: "br_online", name: "Online", code: "ONLINE", timezone: "Africa/Cairo", address: "Online classroom", status: "active" },
  ],
  departments: [
    { id: "dep_arabic", name: "Arabic and Quran", ownerUserId: "usr_hod_demo", branchIds: ["br_cairo", "br_online"], status: "active" },
    { id: "dep_admissions", name: "Admissions", ownerUserId: "usr_registrar_demo", branchIds: ["br_cairo", "br_online"], status: "active" },
    { id: "dep_operations", name: "Branch Operations", ownerUserId: "usr_branch_demo", branchIds: ["br_cairo"], status: "active" },
    { id: "dep_platform", name: "Platform", ownerUserId: "usr_admin_demo", branchIds: ["br_global"], status: "active" },
  ],
  programs: [
    { id: "prog_arabic", title: "Arabic Language", category: "Arabic", departmentId: "dep_arabic", language: "English", status: "active" },
    { id: "prog_quran", title: "Quran and Tajweed", category: "Quran & Tajweed", departmentId: "dep_arabic", language: "English", status: "active" },
    { id: "prog_islamic", title: "Islamic Studies", category: "Islamic Studies", departmentId: "dep_arabic", language: "English", status: "active" },
  ],
  levels: [
    { id: "lvl_ar_l3", programId: "prog_arabic", title: "Level 3", order: 3, prerequisites: ["Level 2 completion or placement"], completionRules: ["80% attendance", "70% grade"] },
    { id: "lvl_qt_1", programId: "prog_quran", title: "Tajweed 1", order: 1, prerequisites: ["Can read Arabic letters"], completionRules: ["90% recitation review", "Teacher approval"] },
  ],
  courses: [
    { id: "course_ar_l3", programId: "prog_arabic", levelId: "lvl_ar_l3", slug: "standard-arabic-l3", title: "Standard Arabic Level 3", description: "Intermediate grammar, reading, writing, and conversation.", outcomes: ["Use conditional sentences", "Write short essays", "Read graded texts"], status: "active" },
    { id: "course_qt_1", programId: "prog_quran", levelId: "lvl_qt_1", slug: "quran-tajweed-1", title: "Quran Tajweed 1", description: "Tajweed foundations with recitation feedback.", outcomes: ["Apply madd rules", "Improve makharij", "Track revision"], status: "active" },
  ],
  modules: [
    { id: "mod_ar_3_grammar", courseId: "course_ar_l3", title: "Grammar and syntax", order: 1, outcomes: ["Conditional sentences", "Verb patterns"] },
    { id: "mod_ar_3_reading", courseId: "course_ar_l3", title: "Reading and listening", order: 2, outcomes: ["Read graded passages", "Recognize connected speech"] },
    { id: "mod_ar_3_writing", courseId: "course_ar_l3", title: "Writing studio", order: 3, outcomes: ["Draft short essays", "Use teacher feedback"] },
    { id: "mod_qt_madd", courseId: "course_qt_1", title: "Madd rules", order: 1, outcomes: ["Recognize madd", "Apply timing"] },
    { id: "mod_qt_recitation", courseId: "course_qt_1", title: "Recitation practice", order: 2, outcomes: ["Submit recordings", "Apply tajweed correction"] },
  ],
  lessons: [
    { id: "lesson_ar_conditional", moduleId: "mod_ar_3_grammar", title: "Conditional Sentences", type: "video", durationMinutes: 42, resourceIds: ["res_ar_pdf"] },
    { id: "lesson_ar_patterns", moduleId: "mod_ar_3_grammar", title: "Verb Patterns in Context", type: "practice", durationMinutes: 35, resourceIds: ["res_ar_patterns"] },
    { id: "lesson_ar_reading_market", moduleId: "mod_ar_3_reading", title: "Reading: A Day at the Market", type: "reading", durationMinutes: 28, resourceIds: ["res_ar_reading_market"] },
    { id: "lesson_ar_listening_dialogue", moduleId: "mod_ar_3_reading", title: "Listening Dialogue Lab", type: "video", durationMinutes: 31, resourceIds: ["res_ar_dialogue_audio"] },
    { id: "lesson_ar_writing_outline", moduleId: "mod_ar_3_writing", title: "Writing a Paragraph Outline", type: "practice", durationMinutes: 40, resourceIds: ["res_ar_outline_doc"] },
    { id: "lesson_qt_madd", moduleId: "mod_qt_madd", title: "Madd Tabi'i Practice", type: "live", durationMinutes: 60, resourceIds: ["res_qt_audio"] },
    { id: "lesson_qt_munfasil", moduleId: "mod_qt_madd", title: "Madd Munfasil Drill", type: "practice", durationMinutes: 36, resourceIds: ["res_qt_munfasil_audio"] },
    { id: "lesson_qt_recording", moduleId: "mod_qt_recitation", title: "Submit a Recitation Clip", type: "assessment", durationMinutes: 25, resourceIds: ["res_qt_recording_guide"] },
  ],
  resources: [
    { id: "res_ar_pdf", lessonId: "lesson_ar_conditional", title: "Grammar handout", type: "pdf", url: "#mock-resource", published: true },
    { id: "res_ar_patterns", lessonId: "lesson_ar_patterns", title: "Verb pattern worksheet", type: "document", url: "#mock-resource", published: true },
    { id: "res_ar_reading_market", lessonId: "lesson_ar_reading_market", title: "Reading passage and vocabulary", type: "pdf", url: "#mock-resource", published: true },
    { id: "res_ar_dialogue_audio", lessonId: "lesson_ar_listening_dialogue", title: "Dialogue audio track", type: "audio", url: "#mock-resource", published: true },
    { id: "res_ar_outline_doc", lessonId: "lesson_ar_writing_outline", title: "Paragraph outline template", type: "document", url: "#mock-resource", published: true },
    { id: "res_qt_audio", lessonId: "lesson_qt_madd", title: "Madd practice audio", type: "audio", url: "#mock-resource", published: true },
    { id: "res_qt_munfasil_audio", lessonId: "lesson_qt_munfasil", title: "Madd munfasil examples", type: "audio", url: "#mock-resource", published: true },
    { id: "res_qt_recording_guide", lessonId: "lesson_qt_recording", title: "Recording checklist", type: "document", url: "#mock-resource", published: true },
  ],
  courseRuns: [
    { id: "run_ar_l3_2026", courseId: "course_ar_l3", branchId: "br_online", teacherId: "usr_teacher_demo", term: "Summer 2026", startsOn: "2026-06-01", endsOn: "2026-08-31", status: "active" },
    { id: "run_ar_l3_cairo_2026", courseId: "course_ar_l3", branchId: "br_cairo", teacherId: "usr_teacher_demo", term: "Summer 2026 Cairo", startsOn: "2026-06-01", endsOn: "2026-08-31", status: "active" },
    { id: "run_qt_1_2026", courseId: "course_qt_1", branchId: "br_online", teacherId: "usr_teacher_demo", term: "Summer 2026", startsOn: "2026-06-01", endsOn: "2026-08-31", status: "active" },
  ],
  classGroups: [
    { id: "class_ar_l3_a", courseRunId: "run_ar_l3_2026", name: "Arabic L3 - Group A", capacity: 16, schedule: "Mon/Wed/Fri 09:00", roomId: "room_online_a", meetingLinkId: "meet_ar_l3", studentIds: ["stu_demo"] },
    { id: "class_ar_l3_cairo", courseRunId: "run_ar_l3_cairo_2026", name: "Arabic L3 - Cairo Group", capacity: 20, schedule: "Sun/Tue 14:00", roomId: "room_cairo_4", meetingLinkId: "meet_ar_l3", studentIds: ["stu_cairo_demo"] },
    { id: "class_qt_1_b", courseRunId: "run_qt_1_2026", name: "Quran Tajweed - Group B", capacity: 12, schedule: "Tue/Thu 10:30", roomId: "room_online_b", meetingLinkId: "meet_qt_1", studentIds: ["stu_demo"] },
  ],
  students: [
    { id: "stu_demo", userId: "usr_student_demo", status: "active", country: "Demo Country", preferredLanguage: "English", timezone: "Africa/Cairo" },
    { id: "stu_cairo_demo", userId: "usr_student_cairo_demo", status: "active", country: "Egypt", preferredLanguage: "English", timezone: "Africa/Cairo" },
  ],
  teachers: [
    { id: "tch_demo", userId: "usr_teacher_demo", departmentId: "dep_arabic", specialties: ["Arabic grammar", "Tajweed"], availability: ["Mon 09:00", "Tue 10:30", "Thu 10:30"] },
  ],
  enrollments: [
    { id: "enr_ar_l3", studentId: "stu_demo", courseRunId: "run_ar_l3_2026", status: "active", progress: 68, attendanceRate: 94, currentGrade: 88 },
    { id: "enr_ar_l3_cairo", studentId: "stu_cairo_demo", courseRunId: "run_ar_l3_cairo_2026", status: "active", progress: 52, attendanceRate: 90, currentGrade: 84 },
    { id: "enr_qt_1", studentId: "stu_demo", courseRunId: "run_qt_1_2026", status: "active", progress: 45, attendanceRate: 91, currentGrade: 92 },
  ],
  lessonProgress: [
    { id: "lp_ar_conditional", studentId: "stu_demo", lessonId: "lesson_ar_conditional", status: "in_progress", notes: "Watched once, needs quiz." },
    { id: "lp_ar_patterns", studentId: "stu_demo", lessonId: "lesson_ar_patterns", status: "completed", completedAt: "2026-06-24T10:15:00+03:00" },
    { id: "lp_ar_reading_market", studentId: "stu_demo", lessonId: "lesson_ar_reading_market", status: "not_started" },
    { id: "lp_ar_listening_dialogue", studentId: "stu_demo", lessonId: "lesson_ar_listening_dialogue", status: "not_started" },
    { id: "lp_ar_writing_outline", studentId: "stu_demo", lessonId: "lesson_ar_writing_outline", status: "not_started" },
    { id: "lp_qt_madd", studentId: "stu_demo", lessonId: "lesson_qt_madd", status: "not_started" },
    { id: "lp_qt_munfasil", studentId: "stu_demo", lessonId: "lesson_qt_munfasil", status: "not_started" },
    { id: "lp_qt_recording", studentId: "stu_demo", lessonId: "lesson_qt_recording", status: "not_started" },
  ],
  assignments: [
    { id: "asg_ar_grammar", courseRunId: "run_ar_l3_2026", title: "Grammar worksheet", dueAt: "2026-06-30T18:00:00+03:00", submissionType: "text", rubric: ["Accuracy", "Examples", "Clarity"], status: "active" },
    { id: "asg_qt_audio", courseRunId: "run_qt_1_2026", title: "Audio recitation", dueAt: "2026-07-01T18:00:00+03:00", submissionType: "audio", rubric: ["Makharij", "Madd", "Fluency"], status: "active" },
  ],
  assignmentSubmissions: [
    { id: "sub_ar_grammar_draft", assignmentId: "asg_ar_grammar", studentId: "stu_demo", submittedAt: "2026-06-25T17:30:00+03:00", status: "pending", response: "Draft answer saved locally." },
  ],
  quizzes: [
    { id: "quiz_ar_3", courseRunId: "run_ar_l3_2026", title: "Grammar Quiz 3", durationMinutes: 30, questionTypes: ["multiple_choice", "short_answer"], attemptsAllowed: 2, status: "active" },
    { id: "quiz_qt_madd", courseRunId: "run_qt_1_2026", title: "Madd Rules Check", durationMinutes: 18, questionTypes: ["listening", "multiple_choice"], attemptsAllowed: 2, status: "active" },
  ],
  quizAttempts: [
    { id: "attempt_ar_3_demo", quizId: "quiz_ar_3", studentId: "stu_demo", startedAt: "2026-06-24T12:00:00+03:00", submittedAt: "2026-06-24T12:22:00+03:00", status: "completed", score: 88, maxScore: 100, answers: { q1: "Correct", q2: "Needs review" } },
  ],
  grades: [
    { id: "gr_ar_quiz_3", studentId: "stu_demo", courseRunId: "run_ar_l3_2026", itemTitle: "Grammar Quiz 3", score: 88, maxScore: 100, feedback: "Strong syntax control." },
  ],
  events: [
    { id: "evt_ar_live", type: "live_session", title: "Arabic L3 live class", startsAt: "2026-06-26T09:00:00+03:00", endsAt: "2026-06-26T10:30:00+03:00", ownerId: "usr_teacher_demo", branchId: "br_online", classGroupId: "class_ar_l3_a", status: "active" },
    { id: "evt_ar_cairo_live", type: "live_session", title: "Arabic L3 Cairo live class", startsAt: "2026-06-27T14:00:00+03:00", endsAt: "2026-06-27T15:15:00+03:00", ownerId: "usr_teacher_demo", branchId: "br_cairo", roomId: "room_cairo_4", classGroupId: "class_ar_l3_cairo", status: "active" },
    { id: "evt_pt_demo", type: "placement_test", title: "Placement test booking", startsAt: "2026-06-27T13:00:00+03:00", endsAt: "2026-06-27T13:30:00+03:00", ownerId: "usr_registrar_demo", branchId: "br_online", status: "pending" },
  ],
  classSessions: [
    { id: "session_ar_live", classGroupId: "class_ar_l3_a", eventId: "evt_ar_live", title: "Arabic L3 live class", startsAt: "2026-06-26T09:00:00+03:00", endsAt: "2026-06-26T10:30:00+03:00", status: "active", attendanceSaved: false },
    { id: "session_ar_cairo_live", classGroupId: "class_ar_l3_cairo", eventId: "evt_ar_cairo_live", title: "Arabic L3 Cairo live class", startsAt: "2026-06-27T14:00:00+03:00", endsAt: "2026-06-27T15:15:00+03:00", status: "active", attendanceSaved: false },
  ],
  teacherAvailability: [
    { id: "avail_teacher_mon", teacherId: "usr_teacher_demo", weekday: "Monday", startsAt: "09:00", endsAt: "13:00", branchId: "br_online" },
    { id: "avail_teacher_sun_cairo", teacherId: "usr_teacher_demo", weekday: "Sunday", startsAt: "13:00", endsAt: "17:00", branchId: "br_cairo" },
    { id: "avail_teacher_thu", teacherId: "usr_teacher_demo", weekday: "Thursday", startsAt: "10:00", endsAt: "15:00", branchId: "br_online" },
  ],
  rooms: [
    { id: "room_online_a", branchId: "br_online", name: "Online Room A", capacity: 38, equipment: ["Meeting link", "Recording placeholder"], status: "active" },
    { id: "room_online_b", branchId: "br_online", name: "Online Room B", capacity: 24, equipment: ["Meeting link", "Audio review"], status: "active" },
    { id: "room_cairo_4", branchId: "br_cairo", name: "Cairo Room 4", capacity: 20, equipment: ["Projector", "Whiteboard"], status: "active" },
  ],
  meetingLinks: [
    { id: "meet_ar_l3", provider: "mock", url: "https://meet.nilelearn.local/arabic-l3", status: "active" },
    { id: "meet_qt_1", provider: "mock", url: "https://meet.nilelearn.local/quran-tajweed-1", status: "active" },
  ],
  attendance: [
    { id: "att_ar_1", classGroupId: "class_ar_l3_a", studentId: "stu_demo", sessionId: "evt_ar_live", status: "present", notes: "On time" },
    { id: "att_ar_cairo_1", classGroupId: "class_ar_l3_cairo", studentId: "stu_cairo_demo", sessionId: "evt_ar_cairo_live", status: "present", notes: "Checked in at Cairo branch" },
  ],
  leads: [
    { id: "lead_demo_1", fullName: "Lead Demo", email: "lead.demo@nilelearn.local", phone: "+20 100 000 0020", subject: "Arabic Language", source: "website", status: "lead", notes: "Interested in evening classes", createdAt: "2026-06-26T09:00:00+03:00" },
  ],
  applications: [
    { id: "app_demo_1", leadId: "lead_demo_1", branchId: "br_online", courseInterest: "Arabic Language", schedulePreference: "Evening", status: "pending" },
  ],
  placementTests: [
    { id: "pt_demo_1", leadId: "lead_demo_1", fullName: "Lead Demo", email: "lead.demo@nilelearn.local", phone: "+20 100 000 0020", branchId: "br_online", subject: "Arabic Language", preferredDate: "2026-06-27", currentLevel: "Some reading ability", status: "pending" },
  ],
  placementResults: [
    { id: "ptr_demo_1", bookingId: "pt_demo_1", examinerId: "usr_teacher_demo", score: 74, recommendedLevel: "Arabic Level 2", notes: "Good reading base, needs grammar review.", createdAt: "2026-06-26T12:00:00+03:00" },
  ],
  enrollmentWorkflows: [
    { id: "ew_demo_1", leadId: "lead_demo_1", placementTestId: "pt_demo_1", targetCourseId: "course_ar_l3", status: "ready_to_enroll", nextStep: "Confirm package and create invoice", updatedAt: "2026-06-26T12:10:00+03:00" },
  ],
  invoices: [
    { id: "inv_demo_1", studentId: "stu_demo", amount: 2400, currency: "EGP", dueAt: "2026-06-30", status: "pending" },
    { id: "inv_cairo_demo_1", studentId: "stu_cairo_demo", amount: 2400, currency: "EGP", dueAt: "2026-07-05", status: "pending" },
  ],
  payments: [
    { id: "pay_demo_1", invoiceId: "inv_demo_1", amount: 1200, method: "manual", paidAt: "2026-06-20", status: "paid" },
  ],
  packages: [
    { id: "pkg_ar_l3_month", title: "Arabic L3 monthly", courseId: "course_ar_l3", amount: 2400, currency: "EGP", sessions: 12, status: "active" },
    { id: "pkg_qt_month", title: "Quran Tajweed monthly", courseId: "course_qt_1", amount: 1800, currency: "EGP", sessions: 12, status: "active" },
  ],
  discounts: [
    { id: "disc_family", code: "FAMILY10", amount: 240, currency: "EGP", status: "active" },
  ],
  certificates: [
    { id: "cert_ar_2", studentId: "stu_demo", courseId: "course_ar_l3", status: "pending_approval", grade: 88, attendanceRate: 94, verificationCode: "NCL-AR2-DEMO" },
  ],
  quranPlans: [
    { id: "qp_demo", studentId: "stu_demo", target: "Juz 1-5", currentJuz: "Juz 2", revisionCycle: "Every 7 days", teacherId: "usr_teacher_demo" },
  ],
  quranProgress: [
    { id: "qr_demo", studentId: "stu_demo", surah: "Al-Baqarah", juz: "2", memorizedPercent: 72, tajweedScore: 88, notes: "Madd timing improved." },
  ],
  recitationSubmissions: [
    { id: "rec_demo", studentId: "stu_demo", teacherId: "usr_teacher_demo", title: "Surah Al-Baqarah 24-29", submittedAt: "2026-06-25T18:00:00+03:00", status: "pending" },
  ],
  messages: [
    { id: "msg_demo_1", fromUserId: "usr_teacher_demo", toUserId: "usr_student_demo", subject: "Class reminder", body: "Arabic L3 starts at 09:00 Cairo time.", read: false, createdAt: "2026-06-26T08:30:00+03:00" },
  ],
  communicationLogs: [
    { id: "comm_demo_1", actorId: "usr_registrar_demo", channel: "in_app", subject: "Placement confirmation", body: "Placement test confirmed for tomorrow.", relatedUserId: "usr_student_demo", status: "completed", createdAt: "2026-06-26T10:00:00+03:00" },
  ],
  messageTemplates: [
    { id: "tmpl_trial", title: "Trial lesson confirmation", channel: "whatsapp", subject: "Trial lesson confirmed", body: "Your Nile Center trial lesson is confirmed.", category: "admissions", status: "active" },
    { id: "tmpl_payment", title: "Payment reminder", channel: "email", subject: "Payment reminder", body: "Your invoice is ready for review.", category: "finance", status: "active" },
  ],
  documents: [
    { id: "doc_cert_demo", ownerId: "stu_demo", title: "Certificate preview", type: "certificate", url: "#certificate-preview", status: "draft" },
  ],
  notifications: [
    { id: "not_demo_1", userId: "usr_student_demo", title: "Class reminder", body: "Arabic L3 starts in 30 minutes.", href: "/app/student/calendar", read: false, createdAt: "2026-06-26T08:30:00+03:00" },
  ],
  supportTickets: [
    { id: "ticket_demo_1", requesterId: "usr_student_demo", subject: "Need recording link", status: "pending", priority: "normal", lastUpdatedAt: "2026-06-25T15:00:00+03:00" },
  ],
  auditLogs: [
    { id: "audit_seed_1", actorId: "usr_admin_demo", action: "seed.loaded", entityType: "PlatformState", entityId: "seed", summary: "Loaded local demo platform state.", createdAt: "2026-06-26T08:00:00+03:00" },
  ],
  integrations: [
    { id: "supabase", label: "Supabase data platform", status: "not_configured", envVars: ["VITE_SUPABASE_URL", "VITE_SUPABASE_PUBLISHABLE_KEY", "SUPABASE_SECRET_KEY"], serverOnly: false, notes: "Browser code uses only the publishable or anon key. Admin/service credentials stay server-only." },
    { id: "moodle", label: "Moodle LMS", status: "mock_mode", envVars: ["MOODLE_BASE_URL", "MOODLE_SERVICE", "MOODLE_TOKEN"], serverOnly: true, notes: "Content, courses, grades, and assignments should sync server-side." },
    { id: "ems", label: "EMS registration portal", status: "mock_mode", envVars: ["EMS_BASE_URL"], serverOnly: true, notes: "Admissions and enrollment import boundary." },
    { id: "email", label: "Email provider", status: "not_configured", envVars: ["EMAIL_PROVIDER"], serverOnly: true, notes: "Templates are logged until delivery is connected." },
    { id: "whatsapp", label: "WhatsApp provider", status: "not_configured", envVars: ["WHATSAPP_PROVIDER"], serverOnly: true, notes: "No external sending from the browser." },
    { id: "meeting", label: "Meeting provider", status: "not_configured", envVars: ["MEETING_PROVIDER"], serverOnly: true, notes: "Live class links and recordings." },
    { id: "payment", label: "Payment provider", status: "not_configured", envVars: ["PAYMENT_PROVIDER"], serverOnly: true, notes: "Invoices stay manual until connected." },
    { id: "jotform", label: "Jotform/import", status: "not_configured", envVars: [], serverOnly: true, notes: "Future import adapter for legacy forms." },
  ],
  permissions: rolePermissions,
};
