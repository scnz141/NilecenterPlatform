export type Role =
  | "student"
  | "teacher"
  | "registrar"
  | "headofdepartment"
  | "branchadmin"
  | "superadmin";

export type Permission =
  | "dashboard:read"
  | "courses:read"
  | "courses:write"
  | "classes:read"
  | "classes:write"
  | "rooms:read"
  | "rooms:write"
  | "schedule:read"
  | "schedule:write"
  | "students:read"
  | "students:write"
  | "teachers:read"
  | "teachers:write"
  | "attendance:read"
  | "attendance:write"
  | "assessments:read"
  | "assessments:write"
  | "payments:read"
  | "payments:write"
  | "certificates:read"
  | "certificates:approve"
  | "settings:write"
  | "reports:read"
  | "messages:write"
  | "audit:read";

export type NavItem = {
  label: string;
  href: string;
  icon: string;
  badge?: string;
};

export type DemoUser = {
  id: string;
  name: string;
  email: string;
  roles: Role[];
  activeRole: Role;
  branch: string;
  department: string;
  avatar: string;
};

export type Stat = {
  label: string;
  value: string;
  change: string;
  tone: "teal" | "amber" | "green" | "red" | "purple" | "slate";
};

export type RecordItem = {
  id: string;
  title: string;
  subtitle: string;
  status: string;
  owner: string;
  due: string;
  metric: string;
  tone?: Stat["tone"];
};

export type FormField = {
  name: string;
  label: string;
  type: "text" | "email" | "tel" | "date" | "time" | "number" | "select" | "textarea";
  placeholder?: string;
  options?: string[];
};

export type PageConfig = {
  title: string;
  eyebrow: string;
  description: string;
  primaryAction: string;
  secondaryAction?: string;
  stats: Stat[];
  filters: string[];
  records: RecordItem[];
  panels: {
    title: string;
    description: string;
    items: string[];
  }[];
  formTitle: string;
  formFields: FormField[];
  timeline: RecordItem[];
  kind:
    | "list"
    | "detail"
    | "form"
    | "calendar"
    | "assessment"
    | "attendance"
    | "certificate"
    | "quran"
    | "report"
    | "settings"
    | "profile"
    | "support"
    | "messages"
    | "moodle";
};

export const roleOrder: Role[] = [
  "student",
  "teacher",
  "registrar",
  "headofdepartment",
  "branchadmin",
  "superadmin",
];

export const roleMeta: Record<Role, {
  label: string;
  shortLabel: string;
  defaultRoute: string;
  color: string;
  tint: string;
  accent: string;
  branchLabel: string;
}> = {
  student: {
    label: "Student",
    shortLabel: "Student",
    defaultRoute: "/app/student/dashboard",
    color: "#2D5016",
    tint: "#EEF4EA",
    accent: "#C4A35A",
    branchLabel: "Online",
  },
  teacher: {
    label: "Teacher",
    shortLabel: "Teacher",
    defaultRoute: "/app/teacher/dashboard",
    color: "#1A3A5C",
    tint: "#E9F0F7",
    accent: "#C4A35A",
    branchLabel: "Arabic Dept.",
  },
  registrar: {
    label: "Registrar",
    shortLabel: "Registrar",
    defaultRoute: "/app/registrar/dashboard",
    color: "#5C2D00",
    tint: "#F5ECE4",
    accent: "#B8A898",
    branchLabel: "Branch B1",
  },
  headofdepartment: {
    label: "Head of Department",
    shortLabel: "HOD",
    defaultRoute: "/app/hod/dashboard",
    color: "#3D1A5C",
    tint: "#F0EAF5",
    accent: "#C4A35A",
    branchLabel: "Arabic and Quran",
  },
  branchadmin: {
    label: "Branch Admin",
    shortLabel: "Branch",
    defaultRoute: "/app/branch/dashboard",
    color: "#1A4A3A",
    tint: "#EAF3EF",
    accent: "#C4A35A",
    branchLabel: "Cairo B1",
  },
  superadmin: {
    label: "Super Admin",
    shortLabel: "Admin",
    defaultRoute: "/app/admin/dashboard",
    color: "#4A3A1A",
    tint: "#F1EDE4",
    accent: "#1A1A1A",
    branchLabel: "Global",
  },
};

export type RoleInspiration = {
  arabic: string;
  meaning: string;
  source: string;
  theme: string;
};

export const roleInspirations: Record<Role, RoleInspiration> = {
  student: {
    arabic: "رَبِّ زِدْنِي عِلْمًا",
    meaning: "My Lord, increase me in knowledge.",
    source: "Qur'an 20:114",
    theme: "Learning with humility",
  },
  teacher: {
    arabic: "عَلَّمَ بِالْقَلَمِ",
    meaning: "He taught by the pen.",
    source: "Qur'an 96:4",
    theme: "Teaching with care",
  },
  registrar: {
    arabic: "فَاسْتَبِقُوا الْخَيْرَاتِ",
    meaning: "Race toward what is good.",
    source: "Qur'an 2:148",
    theme: "Welcoming people well",
  },
  headofdepartment: {
    arabic: "وَشَاوِرْهُمْ فِي الْأَمْرِ",
    meaning: "Consult them in the matter.",
    source: "Qur'an 3:159",
    theme: "Academic leadership",
  },
  branchadmin: {
    arabic: "وَأَمْرُهُمْ شُورَىٰ بَيْنَهُمْ",
    meaning: "Their affairs are by consultation.",
    source: "Qur'an 42:38",
    theme: "Local stewardship",
  },
  superadmin: {
    arabic: "إِنَّ اللَّهَ يَأْمُرُ بِالْعَدْلِ",
    meaning: "Allah commands justice.",
    source: "Qur'an 16:90",
    theme: "Governance with justice",
  },
};

export const demoUsers: DemoUser[] = [
  {
    id: "usr_student_demo",
    name: "Student Demo",
    email: "student.demo@nilelearn.local",
    roles: ["student"],
    activeRole: "student",
    branch: "Online",
    department: "Arabic Language",
    avatar: "SD",
  },
  {
    id: "usr_teacher_demo",
    name: "Teacher Demo",
    email: "teacher.demo@nilelearn.local",
    roles: ["teacher"],
    activeRole: "teacher",
    branch: "Online",
    department: "Arabic Language",
    avatar: "TD",
  },
  {
    id: "usr_registrar_demo",
    name: "Registrar Demo",
    email: "registrar.demo@nilelearn.local",
    roles: ["registrar"],
    activeRole: "registrar",
    branch: "Cairo B1",
    department: "Enrollment",
    avatar: "RD",
  },
  {
    id: "usr_hod_demo",
    name: "HOD Demo",
    email: "hod.demo@nilelearn.local",
    roles: ["headofdepartment"],
    activeRole: "headofdepartment",
    branch: "Global",
    department: "Arabic and Quran",
    avatar: "HD",
  },
  {
    id: "usr_branch_demo",
    name: "Branch Demo",
    email: "branch.demo@nilelearn.local",
    roles: ["branchadmin"],
    activeRole: "branchadmin",
    branch: "Cairo B1",
    department: "Operations",
    avatar: "BD",
  },
  {
    id: "usr_admin_demo",
    name: "Admin Demo",
    email: "admin.demo@nilelearn.local",
    roles: ["superadmin"],
    activeRole: "superadmin",
    branch: "Global",
    department: "Platform",
    avatar: "AD",
  },
];

export const rolePermissions: Record<Role, Permission[]> = {
  student: [
    "dashboard:read",
    "courses:read",
    "schedule:read",
    "attendance:read",
    "assessments:read",
    "certificates:read",
    "messages:write",
    "reports:read",
  ],
  teacher: [
    "dashboard:read",
    "courses:read",
    "classes:read",
    "students:read",
    "schedule:read",
    "schedule:write",
    "attendance:read",
    "attendance:write",
    "assessments:read",
    "assessments:write",
    "messages:write",
    "reports:read",
  ],
  registrar: [
    "dashboard:read",
    "students:read",
    "students:write",
    "courses:read",
    "classes:read",
    "schedule:read",
    "schedule:write",
    "payments:read",
    "payments:write",
    "messages:write",
    "reports:read",
    "settings:write",
  ],
  headofdepartment: [
    "dashboard:read",
    "courses:read",
    "courses:write",
    "classes:read",
    "students:read",
    "teachers:read",
    "teachers:write",
    "attendance:read",
    "schedule:read",
    "assessments:read",
    "assessments:write",
    "certificates:read",
    "certificates:approve",
    "messages:write",
    "reports:read",
  ],
  branchadmin: [
    "dashboard:read",
    "students:read",
    "teachers:read",
    "classes:read",
    "classes:write",
    "rooms:read",
    "rooms:write",
    "schedule:read",
    "schedule:write",
    "attendance:read",
    "attendance:write",
    "payments:read",
    "payments:write",
    "messages:write",
    "reports:read",
    "settings:write",
  ],
  superadmin: [
    "dashboard:read",
    "courses:read",
    "courses:write",
    "classes:read",
    "classes:write",
    "rooms:read",
    "rooms:write",
    "schedule:read",
    "students:read",
    "students:write",
    "teachers:read",
    "teachers:write",
    "attendance:read",
    "assessments:read",
    "assessments:write",
    "payments:read",
    "payments:write",
    "certificates:read",
    "certificates:approve",
    "settings:write",
    "reports:read",
    "messages:write",
    "audit:read",
  ],
};

export const sidebarByRole: Record<Role, NavItem[]> = {
  student: [
    { label: "Dashboard", href: "/app/student/dashboard", icon: "LayoutDashboard" },
    { label: "Courses", href: "/app/student/courses", icon: "BookOpen" },
    { label: "Course Map", href: "/app/student/moodle-source", icon: "BookCopy" },
    { label: "Assignments", href: "/app/student/assignments", icon: "ClipboardCheck", badge: "3" },
    { label: "Quizzes", href: "/app/student/quizzes", icon: "ListChecks" },
    { label: "Grades", href: "/app/student/grades", icon: "BarChart3" },
    { label: "Attendance", href: "/app/student/attendance", icon: "CheckSquare" },
    { label: "Calendar", href: "/app/student/calendar", icon: "CalendarDays" },
    { label: "Messages", href: "/app/student/messages", icon: "MessageSquare" },
    { label: "Certificates", href: "/app/student/certificates", icon: "Award" },
    { label: "Reports", href: "/app/student/reports", icon: "BarChart3" },
    { label: "Support", href: "/app/student/support", icon: "LifeBuoy" },
    { label: "Quran Progress", href: "/app/student/quran-progress", icon: "BookMarked" },
    { label: "Profile", href: "/app/student/profile", icon: "UserCircle" },
  ],
  teacher: [
    { label: "Dashboard", href: "/app/teacher/dashboard", icon: "LayoutDashboard" },
    { label: "Classes", href: "/app/teacher/classes", icon: "Presentation" },
    { label: "Moodle Source", href: "/app/teacher/moodle-source", icon: "PlugZap" },
    { label: "Assignments", href: "/app/teacher/assignments", icon: "ClipboardCheck", badge: "9" },
    { label: "Grading", href: "/app/teacher/grading", icon: "PenLine", badge: "14" },
    { label: "Quizzes", href: "/app/teacher/quizzes", icon: "ListChecks" },
    { label: "Question Bank", href: "/app/teacher/question-bank", icon: "Database" },
    { label: "Calendar", href: "/app/teacher/calendar", icon: "CalendarDays" },
    { label: "Messages", href: "/app/teacher/messages", icon: "MessageSquare" },
    { label: "Reports", href: "/app/teacher/reports", icon: "BarChart3" },
    { label: "Quran Review", href: "/app/teacher/quran-review", icon: "BookMarked" },
    { label: "Profile", href: "/app/teacher/profile", icon: "UserCircle" },
  ],
  registrar: [
    { label: "Dashboard", href: "/app/registrar/dashboard", icon: "LayoutDashboard" },
    { label: "Leads", href: "/app/registrar/leads", icon: "Megaphone", badge: "18" },
    { label: "Applications", href: "/app/registrar/applications", icon: "FileText" },
    { label: "Students", href: "/app/registrar/students", icon: "Users" },
    { label: "Placement Tests", href: "/app/registrar/placement-tests", icon: "ClipboardList", badge: "6" },
    { label: "Enrollments", href: "/app/registrar/enrollments", icon: "UserPlus" },
    { label: "Classes", href: "/app/registrar/classes", icon: "Presentation" },
    { label: "Schedule", href: "/app/registrar/schedule", icon: "CalendarDays" },
    { label: "Payments", href: "/app/registrar/payments", icon: "CreditCard" },
    { label: "Messages", href: "/app/registrar/messages", icon: "MessageSquare" },
    { label: "Reports", href: "/app/registrar/reports", icon: "BarChart3" },
    { label: "Settings", href: "/app/registrar/settings", icon: "Settings" },
  ],
  headofdepartment: [
    { label: "Dashboard", href: "/app/hod/dashboard", icon: "LayoutDashboard" },
    { label: "Departments", href: "/app/hod/departments", icon: "Building2" },
    { label: "Programs", href: "/app/hod/programs", icon: "Library" },
    { label: "Courses", href: "/app/hod/courses", icon: "BookOpen" },
    { label: "Moodle Source", href: "/app/hod/moodle-source", icon: "PlugZap" },
    { label: "Levels", href: "/app/hod/levels", icon: "Layers" },
    { label: "Curriculum", href: "/app/hod/curriculum", icon: "BookCopy" },
    { label: "Teachers", href: "/app/hod/teachers", icon: "GraduationCap" },
    { label: "Classes", href: "/app/hod/classes", icon: "Presentation" },
    { label: "Schedule", href: "/app/hod/schedule", icon: "CalendarDays" },
    { label: "Assessments", href: "/app/hod/assessments", icon: "ListChecks" },
    { label: "Certificates", href: "/app/hod/certificates", icon: "Award", badge: "5" },
    { label: "Reports", href: "/app/hod/reports", icon: "BarChart3" },
    { label: "Messages", href: "/app/hod/messages", icon: "MessageSquare" },
  ],
  branchadmin: [
    { label: "Dashboard", href: "/app/branch/dashboard", icon: "LayoutDashboard" },
    { label: "Students", href: "/app/branch/students", icon: "Users" },
    { label: "Teachers", href: "/app/branch/teachers", icon: "GraduationCap" },
    { label: "Classes", href: "/app/branch/classes", icon: "Presentation" },
    { label: "Rooms", href: "/app/branch/rooms", icon: "DoorOpen" },
    { label: "Schedule", href: "/app/branch/schedule", icon: "CalendarDays" },
    { label: "Attendance", href: "/app/branch/attendance", icon: "CheckSquare", badge: "7" },
    { label: "Payments", href: "/app/branch/payments", icon: "CreditCard" },
    { label: "Reports", href: "/app/branch/reports", icon: "BarChart3" },
    { label: "Messages", href: "/app/branch/messages", icon: "MessageSquare" },
    { label: "Settings", href: "/app/branch/settings", icon: "Settings" },
  ],
  superadmin: [
    { label: "Dashboard", href: "/app/admin/dashboard", icon: "LayoutDashboard" },
    { label: "Blueprint", href: "/app/admin/platform-blueprint", icon: "Network" },
    { label: "Users", href: "/app/admin/users", icon: "Users" },
    { label: "Roles", href: "/app/admin/roles", icon: "ShieldCheck" },
    { label: "Permissions", href: "/app/admin/permissions", icon: "KeyRound" },
    { label: "Branches", href: "/app/admin/branches", icon: "Building2" },
    { label: "Departments", href: "/app/admin/departments", icon: "Network" },
    { label: "Programs", href: "/app/admin/programs", icon: "Library" },
    { label: "Courses", href: "/app/admin/courses", icon: "BookOpen" },
    { label: "Certificates", href: "/app/admin/certificates", icon: "Award" },
    { label: "Schedule", href: "/app/admin/schedule", icon: "CalendarDays" },
    { label: "Moodle Source", href: "/app/admin/moodle-source", icon: "PlugZap" },
    { label: "Settings", href: "/app/admin/settings", icon: "Settings" },
    { label: "Integrations", href: "/app/admin/integrations", icon: "PlugZap" },
    { label: "Audit Logs", href: "/app/admin/audit-logs", icon: "ScrollText" },
    { label: "Reports", href: "/app/admin/reports", icon: "BarChart3" },
    { label: "System Health", href: "/app/admin/system-health", icon: "Activity" },
  ],
};

export const dashboardByRole: Record<Role, {
  title: string;
  subtitle: string;
  stats: Stat[];
  spotlight: {
    title: string;
    description: string;
    progress: number;
    action: string;
  };
  actions: string[];
  records: RecordItem[];
}> = {
  student: {
    title: "Welcome back, Student Demo",
    subtitle: "Your Arabic Level 3 class starts at 09:00 Cairo time.",
    stats: [
      { label: "Active courses", value: "4", change: "2 live this week", tone: "teal" },
      { label: "Course progress", value: "68%", change: "+8% this month", tone: "green" },
      { label: "Attendance", value: "94%", change: "1 excused absence", tone: "amber" },
      { label: "Certificate path", value: "82%", change: "3 items left", tone: "purple" },
    ],
    spotlight: {
      title: "Continue Arabic Grammar: Conditional Sentences",
      description: "Lesson 8 of Module 3 is ready with teacher notes and a short quiz.",
      progress: 68,
      action: "Continue lesson",
    },
    actions: ["Join class", "Submit assignment", "Message teacher", "View calendar"],
    records: [
      record("cls_ar_3", "Standard Arabic L3 live class", "Ahmed Hassan, Room 4", "Live soon", "Teacher", "09:00", "14 students", "teal"),
      record("asg_grammar", "Grammar worksheet", "Due before next class", "Due today", "Ahmed Hassan", "18:00", "Draft saved", "amber"),
      record("quran_review", "Quran revision review", "Juz 2 checkpoint", "Pending feedback", "Fatima Al-Zahra", "Tomorrow", "45%", "green"),
    ],
  },
  teacher: {
    title: "Teacher workspace",
    subtitle: "Two classes today, attendance pending for Arabic L2.",
    stats: [
      { label: "Active classes", value: "6", change: "3 online", tone: "teal" },
      { label: "Students", value: "74", change: "8 need attention", tone: "amber" },
      { label: "Pending grading", value: "14", change: "5 overdue", tone: "red" },
      { label: "Attendance saved", value: "91%", change: "+4% vs last week", tone: "green" },
    ],
    spotlight: {
      title: "Mark attendance for Standard Arabic L2",
      description: "Class ended 22 minutes ago. Save attendance before the registrar cutoff.",
      progress: 76,
      action: "Open attendance",
    },
    actions: ["Create assignment", "Upload material", "Mark attendance", "Create quiz"],
    records: [
      record("class_a", "Standard Arabic L3 - Group A", "14 students, Module 3", "Today", "Ahmed Hassan", "09:00", "68%", "teal"),
      record("grading_queue", "Essay submissions", "Arabic writing assignment", "Needs grading", "6 students", "Friday", "6 left", "amber"),
      record("quran_queue", "Recitation queue", "Tajweed review submissions", "Review", "Fatima Al-Zahra", "Today", "9 clips", "green"),
    ],
  },
  registrar: {
    title: "Registrar operations",
    subtitle: "Lead, placement, enrollment, and payment queues for Cairo B1.",
    stats: [
      { label: "New leads", value: "18", change: "+6 today", tone: "teal" },
      { label: "Placement pending", value: "6", change: "2 unassigned", tone: "amber" },
      { label: "Ready to enroll", value: "11", change: "4 paid", tone: "green" },
      { label: "Payments pending", value: "EGP 42K", change: "9 invoices", tone: "purple" },
    ],
    spotlight: {
      title: "Placement test pipeline",
      description: "Six bookings need examiner assignment or result entry.",
      progress: 58,
      action: "Manage placement",
    },
    actions: ["Add lead", "Book placement test", "Register student", "Send message"],
    records: [
      record("lead_184", "Amina Rahman", "Interested in Quran and Tajweed", "New lead", "Website", "Today", "WhatsApp", "teal"),
      record("pt_338", "Placement test: Yusuf Karim", "Arabic language", "Assign teacher", "Registrar", "Tomorrow", "B1", "amber"),
      record("inv_778", "Invoice due: Omar Sayed", "Academic English package", "Pending", "Finance", "Jun 29", "EGP 1,600", "purple"),
    ],
  },
  headofdepartment: {
    title: "Academic department overview",
    subtitle: "Arabic and Quran programs, curriculum coverage, and quality signals.",
    stats: [
      { label: "Active courses", value: "42", change: "7 categories", tone: "teal" },
      { label: "Teacher load", value: "84%", change: "Balanced", tone: "green" },
      { label: "At-risk students", value: "23", change: "-5 this week", tone: "amber" },
      { label: "Certificates pending", value: "5", change: "Need approval", tone: "purple" },
    ],
    spotlight: {
      title: "Certificate approvals",
      description: "Five students meet grade and attendance requirements and are waiting for review.",
      progress: 84,
      action: "Review certificates",
    },
    actions: ["Create course", "Edit curriculum", "Assign teacher", "Approve certificate"],
    records: [
      record("curr_ar", "Arabic Level 4 curriculum", "Outcome mapping in review", "Draft", "Curriculum team", "Jul 4", "82%", "teal"),
      record("teacher_quality", "Teacher quality review", "Observation notes ready", "Review", "HOD", "This week", "12 notes", "amber"),
      record("cert_quran", "Quran Tajweed certificate", "Eligibility confirmed", "Pending approval", "Student Demo", "Today", "94%", "green"),
    ],
  },
  branchadmin: {
    title: "Cairo B1 branch operations",
    subtitle: "Rooms, branch classes, attendance exceptions, and local payments.",
    stats: [
      { label: "Classes today", value: "28", change: "4 online", tone: "teal" },
      { label: "Rooms in use", value: "9/12", change: "2 conflicts", tone: "amber" },
      { label: "Branch students", value: "384", change: "+21 month", tone: "green" },
      { label: "Payment issues", value: "12", change: "EGP 38K", tone: "red" },
    ],
    spotlight: {
      title: "Room conflict at 17:00",
      description: "Room 4 is double-booked for Arabic L1 and Kids Quran.",
      progress: 42,
      action: "Resolve conflict",
    },
    actions: ["Add room", "View schedule", "Contact student", "Resolve conflict"],
    records: [
      record("room_4", "Room 4 conflict", "Arabic L1 and Kids Quran", "Conflict", "Operations", "17:00", "2 classes", "red"),
      record("late_list", "Late arrivals", "Seven attendance exceptions", "Needs review", "Front desk", "Today", "7 records", "amber"),
      record("branch_payments", "Overdue payments", "Branch invoices", "Follow up", "Registrar", "Jun 30", "12 invoices", "purple"),
    ],
  },
  superadmin: {
    title: "Platform administration",
    subtitle: "Global users, roles, branches, integrations, and system activity.",
    stats: [
      { label: "Total users", value: "6,412", change: "+3.2%", tone: "teal" },
      { label: "Active students", value: "5,284", change: "+12%", tone: "green" },
      { label: "Active classes", value: "318", change: "26 live today", tone: "amber" },
      { label: "System health", value: "99.9%", change: "All checks passing", tone: "purple" },
    ],
    spotlight: {
      title: "Integration readiness",
      description: "Moodle, EMS, email, WhatsApp, meeting, and payment providers are configured as placeholders.",
      progress: 66,
      action: "Open integrations",
    },
    actions: ["Create user", "Manage roles", "Review audit logs", "System health"],
    records: [
      record("audit_1", "Role changed", "Teacher Demo assigned to Arabic Dept.", "Audited", "Admin Demo", "Today", "RBAC", "teal"),
      record("integration_moodle", "Moodle connector", "Mock mode until token is configured", "Placeholder", "System", "Now", "Ready", "amber"),
      record("branch_report", "Branch comparison", "Cairo B1 outpacing Alexandria", "Report", "Analytics", "Jun 26", "+9%", "green"),
    ],
  },
};

export const publicCourses = [
  {
    slug: "arabic",
    title: "Arabic Language",
    level: "A1 to advanced",
    schedule: "Morning, evening, and weekend cohorts",
    description: "Reading, writing, grammar, conversation, and classical text pathways.",
    outcomes: ["Read connected Arabic text", "Build grammar fluency", "Speak with confidence"],
  },
  {
    slug: "quran",
    title: "Quran and Tajweed",
    level: "Beginner to ijazah path",
    schedule: "Daily and weekly online sessions",
    description: "Recitation, tajweed correction, memorization plans, and revision tracking.",
    outcomes: ["Improve recitation", "Track memorization", "Receive tajweed feedback"],
  },
  {
    slug: "islamic-studies",
    title: "Islamic Studies",
    level: "Foundations to intermediate",
    schedule: "Weekly live cohorts",
    description: "Fiqh, aqeedah, seerah, hadith introductions, and guided reading.",
    outcomes: ["Understand worship basics", "Study seerah", "Build reliable foundations"],
  },
  {
    slug: "turkish",
    title: "Turkish",
    level: "A1 to B2",
    schedule: "Small group classes",
    description: "Modern Turkish language for study, travel, and daily communication.",
    outcomes: ["Handle daily conversations", "Build vocabulary", "Practice listening"],
  },
  {
    slug: "english",
    title: "English",
    level: "Foundation to academic",
    schedule: "Flexible online and branch classes",
    description: "General English, academic writing, and conversation practice.",
    outcomes: ["Improve speaking", "Write clearly", "Prepare for academic study"],
  },
  {
    slug: "teacher-training",
    title: "Teacher Training",
    level: "Professional development",
    schedule: "Intensive workshops",
    description: "Teaching methods, assessment design, and classroom practice.",
    outcomes: ["Design better lessons", "Assess fairly", "Support diverse learners"],
  },
  {
    slug: "kids",
    title: "Kids Programs",
    level: "Ages 5 to 14",
    schedule: "After-school and weekend",
    description: "Gentle Quran, Arabic, and Islamic studies pathways for children.",
    outcomes: ["Build routine", "Learn with care", "Track parent-visible progress"],
  },
  {
    slug: "enterprise",
    title: "Enterprise Programs",
    level: "Custom cohorts",
    schedule: "Designed with your organization",
    description: "Language and cultural programs for schools, teams, and institutions.",
    outcomes: ["Custom curriculum", "Group reports", "Dedicated coordinator"],
  },
];

export const notifications = [
  record("n1", "Class reminder", "Arabic L3 begins in 30 minutes", "Unread", "System", "Today", "09:00", "teal"),
  record("n2", "Assignment due", "Grammar worksheet closes tonight", "Unread", "Ahmed Hassan", "Today", "18:00", "amber"),
  record("n3", "Certificate approved", "Quran Tajweed Level 1 is ready", "Read", "HOD", "Yesterday", "Verified", "green"),
];

export const globalSearchItems = [
  "Student Demo",
  "Arabic Language Level 3",
  "Quran Tajweed Certificate",
  "Placement test bookings",
  "Cairo B1 Room 4",
  "Teacher Demo",
  "Invoice INV-778",
  "Attendance exceptions",
  "Moodle connector",
];

function record(
  id: string,
  title: string,
  subtitle: string,
  status: string,
  owner: string,
  due: string,
  metric: string,
  tone: Stat["tone"] = "teal",
): RecordItem {
  return { id, title, subtitle, status, owner, due, metric, tone };
}

const commonStats: Stat[] = [
  { label: "Open items", value: "24", change: "+4 today", tone: "teal" },
  { label: "Completion", value: "76%", change: "+9% this month", tone: "green" },
  { label: "Needs review", value: "8", change: "2 urgent", tone: "amber" },
  { label: "Reports ready", value: "12", change: "Export available", tone: "purple" },
];

const baseFields: FormField[] = [
  { name: "title", label: "Title", type: "text", placeholder: "Enter a clear title" },
  { name: "owner", label: "Owner", type: "text", placeholder: "Responsible person" },
  { name: "date", label: "Date", type: "date" },
  { name: "status", label: "Status", type: "select", options: ["Draft", "Scheduled", "Active", "Pending review", "Completed"] },
  { name: "notes", label: "Notes", type: "textarea", placeholder: "Add operational notes" },
];

const studentFields: FormField[] = [
  { name: "fullName", label: "Full name", type: "text", placeholder: "Student name" },
  { name: "email", label: "Email", type: "email", placeholder: "student.demo@nilelearn.local" },
  { name: "phone", label: "Phone or WhatsApp", type: "tel", placeholder: "+20 100 000 0000" },
  { name: "subject", label: "Subject", type: "select", options: ["Arabic", "Quran", "Islamic Studies", "Turkish", "English"] },
  { name: "notes", label: "Notes", type: "textarea", placeholder: "Learning goals, schedule needs, guardian notes" },
];

const assessmentFields: FormField[] = [
  { name: "name", label: "Assessment name", type: "text", placeholder: "Midterm quiz" },
  { name: "course", label: "Course", type: "select", options: ["Arabic L3", "Quran Tajweed", "Islamic Fiqh", "Kids Arabic"] },
  { name: "dueDate", label: "Due date", type: "date" },
  { name: "duration", label: "Duration minutes", type: "number", placeholder: "30" },
  { name: "rubric", label: "Rubric", type: "textarea", placeholder: "Objective, oral, essay, and manual grading notes" },
];

const messageFields: FormField[] = [
  { name: "recipient", label: "Recipient", type: "select", options: ["Student", "Teacher", "Registrar", "HOD", "Branch", "All active students"] },
  { name: "template", label: "Template", type: "select", options: ["Class reminder", "Placement confirmation", "Payment reminder", "Absence warning", "Certificate issued"] },
  { name: "subject", label: "Subject", type: "text", placeholder: "Message subject" },
  { name: "body", label: "Body", type: "textarea", placeholder: "Message content" },
];

const pageCopy: Record<string, { title: string; description: string; kind: PageConfig["kind"]; action: string }> = {
  courses: {
    title: "Courses",
    description: "Active, completed, and upcoming course work with progress, schedules, resources, and outcomes.",
    kind: "list",
    action: "Create course",
  },
  "course-detail": {
    title: "Course workspace",
    description: "Modules, lessons, assignments, quizzes, grades, attendance, resources, and announcements in one place.",
    kind: "detail",
    action: "Open lesson",
  },
  lesson: {
    title: "Lesson player",
    description: "Video, live class link, resources, notes, completion tracking, discussion, and teacher feedback.",
    kind: "detail",
    action: "Mark complete",
  },
  live: {
    title: "Live class",
    description: "Meeting link, session materials, attendance check-in, recording placeholder, and session notes.",
    kind: "detail",
    action: "Join class",
  },
  assignments: {
    title: "Assignments",
    description: "Create, submit, grade, and track assignments with due dates, rubrics, files, and feedback.",
    kind: "assessment",
    action: "Create assignment",
  },
  "assignment-detail": {
    title: "Assignment detail",
    description: "Submission status, rubric, attachments, text response, feedback, and resubmission controls.",
    kind: "detail",
    action: "Return feedback",
  },
  quizzes: {
    title: "Quizzes",
    description: "Timed attempts, question sets, results, attempt history, and manual grading where needed.",
    kind: "assessment",
    action: "Create quiz",
  },
  "quiz-detail": {
    title: "Quiz attempt",
    description: "Multiple choice, true or false, short answer, essay, timing, results, and feedback.",
    kind: "assessment",
    action: "Start attempt",
  },
  grades: {
    title: "Gradebook",
    description: "Grade items, assignment grades, quiz results, attendance contribution, feedback, and certificate eligibility.",
    kind: "report",
    action: "Export grades",
  },
  attendance: {
    title: "Attendance",
    description: "Present, late, absent, and excused records with notes, bulk save, alerts, and history.",
    kind: "attendance",
    action: "Save attendance",
  },
  calendar: {
    title: "Calendar",
    description: "Class sessions, trials, placement tests, assignments, quizzes, exams, rooms, and reminders.",
    kind: "calendar",
    action: "Create event",
  },
  messages: {
    title: "Messages",
    description: "Role-based conversations, announcements, templates, communication logs, and read states.",
    kind: "messages",
    action: "Compose message",
  },
  certificates: {
    title: "Certificates",
    description: "Eligibility, approvals, issue history, verification codes, download placeholders, and revocation controls.",
    kind: "certificate",
    action: "Approve certificate",
  },
  support: {
    title: "Support",
    description: "FAQs, support tickets, contact records, ticket status, and response history.",
    kind: "support",
    action: "Create ticket",
  },
  profile: {
    title: "Profile and preferences",
    description: "Personal details, branch, department, language, timezone, security, and notification preferences.",
    kind: "profile",
    action: "Save profile",
  },
  "quran-progress": {
    title: "Quran progress",
    description: "Memorization plan, Surah and Juz progress, revision schedule, recitation submissions, and ijazah milestones.",
    kind: "quran",
    action: "Submit recitation",
  },
  "moodle-source": {
    title: "Moodle course source",
    description: "Imported course structure, section ids, activity modules, hidden student state, and integration readiness for Nile Center Moodle content.",
    kind: "moodle",
    action: "Queue sync review",
  },
  classes: {
    title: "Classes",
    description: "Class groups, capacity, teacher assignment, sessions, rosters, attendance, materials, and progress analytics.",
    kind: "list",
    action: "Create class",
  },
  "class-detail": {
    title: "Class detail",
    description: "Overview, student roster, sessions, attendance, assignments, quizzes, materials, announcements, and analytics.",
    kind: "detail",
    action: "Open session",
  },
  sessions: {
    title: "Sessions",
    description: "Create, edit, cancel, reschedule, add meeting links, upload recordings, and mark sessions complete.",
    kind: "calendar",
    action: "Create session",
  },
  students: {
    title: "Students",
    description: "Student profiles, status, course, class, contact, attendance, grades, payments, documents, and support history.",
    kind: "list",
    action: "Add student",
  },
  materials: {
    title: "Materials",
    description: "Upload PDFs, videos, audio, links, resources, modules, publish state, downloads, and session attachments.",
    kind: "list",
    action: "Upload material",
  },
  grading: {
    title: "Grading queue",
    description: "Pending submissions, rubric grading, written comments, audio feedback placeholder, returns, and resubmission controls.",
    kind: "assessment",
    action: "Grade selected",
  },
  "question-bank": {
    title: "Question bank",
    description: "Multiple choice, true or false, short answer, essay, oral record, and file/audio submission question types.",
    kind: "assessment",
    action: "Add question",
  },
  reports: {
    title: "Reports",
    description: "Role-specific analytics, filters, charts, tables, export placeholders, and trend summaries.",
    kind: "report",
    action: "Export report",
  },
  "quran-review": {
    title: "Quran review",
    description: "Recitation queue, tajweed mistakes, memorization updates, revision assignments, and ijazah milestones.",
    kind: "quran",
    action: "Review recitation",
  },
  leads: {
    title: "Leads",
    description: "Lead source, status pipeline, notes, contact history, and conversion to application or student.",
    kind: "list",
    action: "Add lead",
  },
  "lead-detail": {
    title: "Lead detail",
    description: "Lead profile, communication log, notes, interest, source, next action, and conversion controls.",
    kind: "detail",
    action: "Convert lead",
  },
  applications: {
    title: "Applications",
    description: "Applicant details, course interest, branch, schedule preference, placement assignment, and enrollment conversion.",
    kind: "list",
    action: "Create application",
  },
  "student-detail": {
    title: "Student detail",
    description: "Profile, guardian, enrollments, attendance, grades, payments, documents, messages, and support tickets.",
    kind: "detail",
    action: "Update student",
  },
  "placement-tests": {
    title: "Placement tests",
    description: "Bookings, calendar, examiner assignment, result entry, recommended level, notes, and enrollment conversion.",
    kind: "calendar",
    action: "Book test",
  },
  "placement-detail": {
    title: "Placement result",
    description: "Booking details, examiner notes, score, recommended level, and conversion to enrollment.",
    kind: "detail",
    action: "Record result",
  },
  enrollments: {
    title: "Enrollments",
    description: "Enrollment pipeline, student, program, level, class group, start date, package, LMS account, and transitions.",
    kind: "list",
    action: "Create enrollment",
  },
  schedule: {
    title: "Schedule",
    description: "Trials, placement tests, classes, rooms, teachers, conflicts, and role-specific calendar filters.",
    kind: "calendar",
    action: "Add schedule item",
  },
  payments: {
    title: "Payments",
    description: "Invoices, payment status, amounts, due dates, discounts, receipt placeholders, and history.",
    kind: "list",
    action: "Create invoice",
  },
  settings: {
    title: "Settings",
    description: "Templates, statuses, local branch data, languages, terms, notifications, certificate, and payment settings.",
    kind: "settings",
    action: "Save settings",
  },
  departments: {
    title: "Departments",
    description: "Departments, teachers, courses, HOD ownership, KPIs, and academic responsibilities.",
    kind: "list",
    action: "Add department",
  },
  programs: {
    title: "Programs",
    description: "Programs, levels, outcomes, course ownership, status, and academic catalog management.",
    kind: "list",
    action: "Create program",
  },
  levels: {
    title: "Levels",
    description: "Level structure, prerequisites, placement mapping, and completion requirements.",
    kind: "list",
    action: "Create level",
  },
  curriculum: {
    title: "Curriculum",
    description: "Modules, lessons, items, learning outcomes, resources, assessment mapping, and publish controls.",
    kind: "list",
    action: "Publish curriculum",
  },
  teachers: {
    title: "Teachers",
    description: "Teacher list, workload, availability, assigned classes, performance, feedback, and attendance completion.",
    kind: "list",
    action: "Add teacher",
  },
  assessments: {
    title: "Assessments",
    description: "Quiz and exam overview, completion, grade distributions, oral and written records, and rubric templates.",
    kind: "assessment",
    action: "Create assessment",
  },
  rooms: {
    title: "Rooms",
    description: "Rooms, capacity, equipment, availability, room usage, booking conflicts, and local settings.",
    kind: "list",
    action: "Add room",
  },
  users: {
    title: "Users",
    description: "Create users, edit profiles, assign roles, activate or deactivate accounts, and review audit history.",
    kind: "list",
    action: "Create user",
  },
  "user-detail": {
    title: "User detail",
    description: "Account profile, role assignment, activity history, security placeholders, and audit trail.",
    kind: "detail",
    action: "Update user",
  },
  roles: {
    title: "Roles",
    description: "Role descriptions, permission matrix, assignments, and future finance/support/content/guardian roles.",
    kind: "settings",
    action: "Save roles",
  },
  permissions: {
    title: "Permissions",
    description: "Permission registry grouped by module with read, create, update, delete, and export capabilities.",
    kind: "settings",
    action: "Update permissions",
  },
  branches: {
    title: "Branches",
    description: "Branches, branch admins, rooms, local settings, and operational configuration.",
    kind: "list",
    action: "Add branch",
  },
  integrations: {
    title: "Integrations",
    description: "Moodle, EMS, email, WhatsApp, meeting, payment, Jotform, and import connector placeholders.",
    kind: "settings",
    action: "Save integration",
  },
  "audit-logs": {
    title: "Audit logs",
    description: "Actor, action, entity, timestamp, before and after summaries, filters, and export placeholder.",
    kind: "report",
    action: "Export logs",
  },
  "system-health": {
    title: "System health",
    description: "Application, database, queue, integration, and job status placeholders with operational signals.",
    kind: "report",
    action: "Run checks",
  },
};

export function getDemoUser(role: Role): DemoUser {
  return demoUsers.find((user) => user.activeRole === role) ?? demoUsers[0];
}

const studentLearningPageIds = new Set(["courses", "course-detail", "lesson", "live"]);

function getPrimaryAction(role: Role, pageId: string, fallback: string) {
  if (role === "student" && studentLearningPageIds.has(pageId)) {
    if (pageId === "live") return "Join class";
    return "Continue learning";
  }
  if (role === "student") {
    const studentActions: Record<string, string> = {
      assignments: "Submit assignment",
      "assignment-detail": "Submit assignment",
      quizzes: "Start attempt",
      "quiz-detail": "Submit attempt",
      grades: "View grades",
      attendance: "View attendance",
      calendar: "View schedule",
      messages: "Message teacher",
      certificates: "Open certificate",
      reports: "Export my report",
      "quran-progress": "Submit recitation",
    };
    return studentActions[pageId] ?? fallback;
  }
  return fallback;
}

function getSecondaryAction(role: Role, pageId: string, kind: PageConfig["kind"]) {
  if (role === "student" && studentLearningPageIds.has(pageId)) return "View calendar";
  if (role === "student") {
    if (pageId === "messages" || pageId === "support") return "Open support";
    if (kind === "report") return "Download my CSV";
    return "Get support";
  }
  if (kind === "report") return "Download CSV";
  if (kind === "moodle") return "Review source";
  return "Open audit log";
}

export function getPageConfig(role: Role, pageId: string): PageConfig {
  const copy = pageCopy[pageId] ?? pageCopy.reports;
  const roleLabel = roleMeta[role].label;
  const records = buildRecords(role, pageId);
  const formFields = getFormFields(pageId);

  return {
    title: copy.title,
    eyebrow: roleLabel,
    description: copy.description,
    primaryAction: getPrimaryAction(role, pageId, copy.action),
    secondaryAction: getSecondaryAction(role, pageId, copy.kind),
    stats: buildStats(role, pageId, copy.kind),
    filters: buildFilters(pageId, copy.kind),
    records,
    panels: buildPanels(role, pageId, copy.kind),
    formTitle: `${copy.action} form`,
    formFields,
    timeline: records.slice(0, 4).map((item, index) => ({
      ...item,
      id: `${item.id}_timeline_${index}`,
      status: index === 0 ? "Now" : item.status,
    })),
    kind: copy.kind,
  };
}

function buildStats(role: Role, pageId: string, kind: PageConfig["kind"]): Stat[] {
  if (role === "student" && studentLearningPageIds.has(pageId)) {
    return [
      { label: "Active courses", value: "2", change: "Enrolled", tone: "green" },
      { label: "Lesson progress", value: "68%", change: "Arabic L3", tone: "teal" },
      { label: "Next class", value: "09:00", change: "Mon/Wed/Fri", tone: "amber" },
      { label: "Current grade", value: "88%", change: "Passing", tone: "purple" },
    ];
  }
  if (kind === "moodle") {
    return [
      { label: "Observed activities", value: "230", change: "From Moodle section", tone: "teal" },
      { label: "H5P interactives", value: "66", change: "Embed/xAPI required", tone: "purple" },
      { label: "Quizzes", value: "42", change: "Question bank linked", tone: "amber" },
      { label: "REST access", value: "Blocked", change: "Needs service permissions", tone: "red" },
    ];
  }
  if (pageId === "system-health") {
    return [
      { label: "App status", value: "Healthy", change: "Build ready", tone: "green" },
      { label: "Database", value: "Mock", change: "Postgres schema planned", tone: "amber" },
      { label: "Queue", value: "Idle", change: "Placeholder", tone: "teal" },
      { label: "Integrations", value: "6", change: "Mock mode", tone: "purple" },
    ];
  }
  if (kind === "attendance") {
    return [
      { label: "Present", value: "91%", change: "+3% vs last week", tone: "green" },
      { label: "Late", value: "6", change: "Needs notes", tone: "amber" },
      { label: "Absent", value: "3", change: "1 excused", tone: "red" },
      { label: "Saved sessions", value: "18", change: "This week", tone: "teal" },
    ];
  }
  if (kind === "certificate") {
    return [
      { label: "Eligible", value: "12", change: "Grade and attendance met", tone: "green" },
      { label: "Pending approval", value: "5", change: "HOD review", tone: "amber" },
      { label: "Issued", value: "184", change: "+18 this month", tone: "teal" },
      { label: "Revoked", value: "0", change: "No issues", tone: "purple" },
    ];
  }
  if (kind === "quran") {
    return [
      { label: "Memorized", value: "4.5 Juz", change: "+3 pages week", tone: "green" },
      { label: "Revision due", value: "7", change: "This cycle", tone: "amber" },
      { label: "Tajweed score", value: "88%", change: "+5%", tone: "teal" },
      { label: "Ijazah path", value: "36%", change: "Milestone 2", tone: "purple" },
    ];
  }
  if (kind === "report") {
    return [
      { label: "Trend", value: "+12%", change: "Current period", tone: "green" },
      { label: "Cohorts", value: "18", change: "Filtered", tone: "teal" },
      { label: "Exceptions", value: "7", change: "Review", tone: "amber" },
      { label: "Exports", value: "CSV", change: "Ready", tone: "purple" },
    ];
  }
  return commonStats.map((stat, index) => ({
    ...stat,
    value: role === "student" && index === 0 ? "4" : stat.value,
  }));
}

function buildFilters(pageId: string, kind: PageConfig["kind"]): string[] {
  if (kind === "moodle") return ["All", "Student visible", "Hidden", "Embeds", "Quizzes"];
  if (kind === "calendar") return ["Today", "Week", "Month", "Conflicts"];
  if (kind === "assessment") return ["Draft", "Assigned", "Submitted", "Graded"];
  if (kind === "attendance") return ["Present", "Late", "Absent", "Excused"];
  if (kind === "certificate") return ["Eligible", "Pending", "Issued", "Revoked"];
  if (pageId.includes("payment")) return ["Paid", "Pending", "Overdue", "Refunded"];
  return ["All", "Active", "Pending", "Completed"];
}

function buildRecords(role: Role, pageId: string): RecordItem[] {
  const rolePrefix = roleMeta[role].shortLabel;
  const pool: Record<string, RecordItem[]> = {
    courses: [
      record("course_ar3", "Standard Arabic - Level 3", "Grammar, writing, reading, conversation", "Active", "Ahmed Hassan", "Mon/Wed/Fri", "68%", "teal"),
      record("course_quran", "Quran and Tajweed", "Recitation, memorization, revision", "Active", "Fatima Al-Zahra", "Daily", "45%", "green"),
      record("course_fiqh", "Islamic Fiqh Fundamentals", "Worship, transactions, contemporary issues", "Upcoming", "Omar Khalil", "Tue/Thu", "24 seats", "purple"),
    ],
    students: [
      record("stu_demo", "Student Demo", "student.demo@nilelearn.local", "Active", "Arabic L3", "Cairo time", "94% attendance", "green"),
      record("stu_amira", "Amira Hassan", "Safe demo profile", "At risk", "Quran Tajweed", "Review today", "68% attendance", "amber"),
      record("stu_yusuf", "Yusuf Karim", "Placement complete", "Ready to enroll", "Arabic L1", "Jun 30", "Recommended A2", "teal"),
    ],
    teachers: [
      record("tch_demo", "Teacher Demo", "Arabic language department", "Active", "6 classes", "This week", "84% load", "teal"),
      record("tch_quran", "Quran Teacher Demo", "Tajweed and Hifz", "Active", "4 classes", "Daily", "91% attendance", "green"),
      record("tch_review", "Teacher observation", "Class quality review", "Needs review", "HOD", "Jul 2", "12 notes", "amber"),
    ],
    classes: [
      record("class_ar3", "Arabic L3 - Group A", "14 students, Room 4, hybrid", "Live today", "Teacher Demo", "09:00", "68% progress", "teal"),
      record("class_quran", "Quran Tajweed - Group B", "12 students, online", "Scheduled", "Quran Teacher Demo", "10:30", "45% progress", "green"),
      record("class_kids", "Kids Arabic - Weekend", "18 students, Room 2", "Capacity watch", "Branch", "Saturday", "16/18 seats", "amber"),
    ],
    assignments: [
      record("asg_1", "Grammar worksheet", "Short answer and upload placeholder", "Due today", "Teacher Demo", "18:00", "8 submissions", "amber"),
      record("asg_2", "Reading reflection", "Rubric and feedback enabled", "Graded", "Teacher Demo", "Jun 25", "92 avg", "green"),
      record("asg_3", "Audio recitation", "File/audio submission placeholder", "Open", "Quran Teacher", "Jul 1", "11 drafts", "teal"),
    ],
    quizzes: [
      record("quiz_1", "Arabic grammar quiz", "Timed objective questions", "Assigned", "Teacher Demo", "Jun 30", "30 min", "teal"),
      record("quiz_2", "Tajweed rules check", "MCQ and oral review", "Manual grading", "Quran Teacher", "Jul 2", "9 attempts", "amber"),
      record("quiz_3", "Placement mapping quiz", "Level recommendation", "Ready", "Registrar", "Today", "A1-B2", "green"),
    ],
    certificates: [
      record("cert_1", "Arabic Level 2 Certificate", "Grade A, attendance 94%", "Pending approval", "HOD", "Today", "NCL-AR2-184", "amber"),
      record("cert_2", "Quran Tajweed Level 1", "Verification ready", "Issued", "System", "Jun 20", "NCL-QT1-092", "green"),
      record("cert_3", "Kids Arabic Foundation", "Eligibility review", "Draft", "Teacher Demo", "Jul 4", "83%", "teal"),
    ],
    payments: [
      record("inv_778", "Invoice INV-778", "Arabic Level 3 package", "Pending", "Registrar", "Jun 29", "EGP 2,400", "amber"),
      record("inv_779", "Invoice INV-779", "Quran monthly plan", "Paid", "Branch B1", "Today", "EGP 1,800", "green"),
      record("inv_780", "Invoice INV-780", "Kids program renewal", "Overdue", "Registrar", "Jun 22", "EGP 1,200", "red"),
    ],
    messages: [
      record("msg_1", "Class reminder template", "Ready for email or WhatsApp copy", "Draft", "Registrar", "Today", "42 recipients", "teal"),
      record("msg_2", "Absence warning", "Communication log created", "Sent", "Teacher Demo", "Yesterday", "3 students", "amber"),
      record("msg_3", "Certificate issued", "Student notification", "Scheduled", "HOD", "Tomorrow", "5 students", "green"),
    ],
    rooms: [
      record("room_4", "Room 4", "Projector, whiteboard, 20 seats", "Conflict", "Branch B1", "17:00", "2 bookings", "red"),
      record("room_2", "Room 2", "Kids setup, 18 seats", "Available", "Branch B1", "14:00", "Ready", "green"),
      record("room_online", "Online room A", "Meeting provider placeholder", "Active", "System", "Now", "38 live", "teal"),
    ],
    integrations: [
      record("moodle", "Moodle LMS", "MOODLE_BASE_URL, MOODLE_SERVICE, MOODLE_TOKEN", "Mock mode", "Platform", "Now", "Configured later", "amber"),
      record("ems", "EMS portal", "EMS_BASE_URL placeholder", "Mock mode", "Platform", "Now", "Mapper ready", "teal"),
      record("whatsapp", "WhatsApp provider", "Template logs only", "Placeholder", "Platform", "Future", "No sending", "purple"),
    ],
    "moodle-source": [
      record("moodle_course_25472", "C26060247 Moodle course", "Quran Reading for Beginners Level 01, teacher course observed", "Observed", "Moodle", "Now", "230 activities", "teal"),
      record("moodle_rest_access", "REST function access", "Token endpoint works but course functions return access control exception", "Needs permissions", "Admin", "Before sync", "6 functions", "red"),
      record("moodle_h5p_rendering", "H5P and Video Time rendering", "H5P, xAPI, Vimeo, Google Drive, pluginfile media, and Quizizz links require renderer decisions", "Mapping ready", "Learning team", "Next", "7 module types", "purple"),
    ],
  };

  const byPage = pool[pageId] ?? pool[pageId.replace("-detail", "s")] ?? pool[pageId.replace("quran-review", "assignments")];
  if (byPage) return byPage;

  return [
    record(`${pageId}_1`, `${rolePrefix} ${titleize(pageId)} item`, "Operational workflow with status, owner, due date, and metric", "Active", roleMeta[role].label, "Today", "76%", "teal"),
    record(`${pageId}_2`, `${titleize(pageId)} review`, "Approval, notes, and communication log available", "Pending", "Coordinator", "Tomorrow", "8 items", "amber"),
    record(`${pageId}_3`, `${titleize(pageId)} report`, "Filtered table and export placeholder", "Ready", "Analytics", "This week", "+12%", "green"),
  ];
}

function buildPanels(role: Role, pageId: string, kind: PageConfig["kind"]): PageConfig["panels"] {
  if (kind === "moodle") {
    return [
      {
        title: "Integration contract",
        description: "Moodle remains the source of truth until migration.",
        items: ["Sync by course id, section id, and cmid", "Keep Moodle tokens server-side", "Use HTML observation only as temporary fallback"],
      },
      {
        title: "Renderer decisions",
        description: "Each Moodle plugin needs a clear UI strategy.",
        items: ["H5P and Video Time embed in learning player", "Quizzes and question bank sync when API opens", "Hidden activities stay teacher/HOD only"],
      },
    ];
  }
  if (kind === "quran") {
    return [
      {
        title: "Memorization plan",
        description: "Personal Surah and Juz targets.",
        items: ["Juz 2 revision due Sunday", "Surah Al-Baqarah pages 24-29", "Ijazah milestone 2 in progress"],
      },
      {
        title: "Tajweed feedback",
        description: "Mistake categories and teacher notes.",
        items: ["Madd timing improved", "Ghunnah needs review", "Upload next recitation by Thursday"],
      },
    ];
  }
  if (kind === "assessment") {
    return [
      {
        title: "Question types",
        description: "Objective and manual grading are supported.",
        items: ["Multiple choice and true/false auto-grade", "Short answer and essay manual review", "Oral/file/audio submission placeholders"],
      },
      {
        title: "Rubric and feedback",
        description: "Keep assessment decisions consistent.",
        items: ["Score bands", "Written comments", "Resubmission controls"],
      },
    ];
  }
  if (kind === "calendar") {
    return [
      {
        title: "Conflict checks",
        description: "Conflict placeholders are visible before saving.",
        items: ["Teacher double-booked", "Room double-booked", "Student class overlap"],
      },
      {
        title: "Event types",
        description: "Unified scheduling model.",
        items: ["Class session", "Trial lesson", "Placement test", "Assignment due", "Room booking"],
      },
    ];
  }
  if (kind === "settings") {
    return [
      {
        title: "Security note",
        description: "No secrets belong in the repository.",
        items: ["Use .env.example placeholders", "Keep tokens server-side", "Audit settings changes"],
      },
      {
        title: "Localization",
        description: "English default with Arabic RTL structure.",
        items: ["Language selector", "RTL direction support", "Translation keys ready"],
      },
    ];
  }
  return [
    {
      title: "Workflow coverage",
      description: `${roleMeta[role].label} actions for ${titleize(pageId)}.`,
      items: ["Search and filters", "Status badges", "Row actions", "Audit-ready save flow"],
    },
    {
      title: "Next actions",
      description: "Keep the page operational, not empty.",
      items: ["Review high-priority records", "Create or update a record", "Export or message stakeholders"],
    },
  ];
}

function getFormFields(pageId: string): FormField[] {
  if (["students", "leads", "applications", "enrollments", "placement-tests"].includes(pageId)) return studentFields;
  if (["assignments", "quizzes", "assessments", "question-bank", "grading"].includes(pageId)) return assessmentFields;
  if (["messages"].includes(pageId)) return messageFields;
  return baseFields;
}

function titleize(value: string): string {
  return value
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
