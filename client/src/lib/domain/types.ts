import type { Permission, Role } from "../platformData";

export type EntityStatus =
  | "draft"
  | "active"
  | "paused"
  | "completed"
  | "cancelled"
  | "pending"
  | "approved"
  | "rejected"
  | "issued"
  | "overdue";

export type StudentStatus =
  | "lead"
  | "trial_booked"
  | "placement_booked"
  | "placement_completed"
  | "ready_to_enroll"
  | "enrolled"
  | "active"
  | "paused"
  | "completed"
  | "cancelled";

export type AttendanceStatus = "present" | "late" | "absent" | "excused";
export type PaymentStatus = "draft" | "issued" | "pending" | "paid" | "overdue" | "cancelled" | "refunded";
export type CertificateStatus = "draft" | "pending_approval" | "approved" | "issued" | "revoked";
export type LessonProgressStatus = "not_started" | "in_progress" | "completed";
export type CalendarEventType =
  | "class_session"
  | "live_session"
  | "trial_lesson"
  | "placement_test"
  | "assignment_due"
  | "quiz_due"
  | "exam"
  | "teacher_availability"
  | "room_booking"
  | "reminder";

export type PlatformModuleId =
  | "public_site"
  | "auth_rbac"
  | "admissions_ems"
  | "student_learning"
  | "teaching"
  | "academic_management"
  | "branch_operations"
  | "assessment"
  | "attendance"
  | "scheduling"
  | "communication"
  | "certificates"
  | "quran"
  | "finance"
  | "reports"
  | "integrations"
  | "system_admin";

export type PlatformModule = {
  id: PlatformModuleId;
  label: string;
  ownerRole: Role;
  purpose: string;
  routeRoot: string;
  dataEntities: string[];
  services: string[];
  integrations: string[];
  remainingWork: string[];
};

export type User = {
  id: string;
  name: string;
  email: string;
  phone?: string;
  notes?: string;
  roles: Role[];
  activeRole: Role;
  branchId?: string;
  departmentId?: string;
  status: EntityStatus;
};

export type Branch = {
  id: string;
  name: string;
  code: string;
  timezone: string;
  address: string;
  status: EntityStatus;
};

export type Department = {
  id: string;
  name: string;
  ownerUserId: string;
  branchIds: string[];
  status: EntityStatus;
};

export type Program = {
  id: string;
  title: string;
  category: string;
  departmentId: string;
  language: string;
  status: EntityStatus;
};

export type CourseLevel = {
  id: string;
  programId: string;
  title: string;
  order: number;
  prerequisites: string[];
  completionRules: string[];
};

export type Course = {
  id: string;
  programId: string;
  levelId: string;
  slug: string;
  title: string;
  description: string;
  outcomes: string[];
  status: EntityStatus;
};

export type Module = {
  id: string;
  courseId: string;
  title: string;
  order: number;
  outcomes: string[];
};

export type Lesson = {
  id: string;
  moduleId: string;
  title: string;
  type: "video" | "live" | "reading" | "practice" | "assessment";
  durationMinutes: number;
  resourceIds: string[];
};

export type LessonResource = {
  id: string;
  lessonId: string;
  title: string;
  type: "pdf" | "video" | "audio" | "link" | "document";
  url: string;
  published: boolean;
};

export type CourseRun = {
  id: string;
  courseId: string;
  branchId: string;
  teacherId: string;
  term: string;
  startsOn: string;
  endsOn: string;
  status: EntityStatus;
};

export type ClassGroup = {
  id: string;
  courseRunId: string;
  name: string;
  capacity: number;
  schedule: string;
  roomId?: string;
  meetingLinkId?: string;
  studentIds: string[];
};

export type StudentProfile = {
  id: string;
  userId: string;
  status: StudentStatus;
  guardianId?: string;
  guardianName?: string;
  guardianPhone?: string;
  currentLevel?: string;
  ageGroup?: string;
  notes?: string;
  country: string;
  preferredLanguage: string;
  timezone: string;
};

export type TeacherProfile = {
  id: string;
  userId: string;
  departmentId: string;
  specialties: string[];
  availability: string[];
};

export type Enrollment = {
  id: string;
  studentId: string;
  courseRunId: string;
  status: StudentStatus;
  progress: number;
  attendanceRate: number;
  currentGrade: number;
};

export type Assignment = {
  id: string;
  courseRunId: string;
  title: string;
  dueAt: string;
  submissionType: "text" | "file" | "audio" | "video";
  rubric: string[];
  status: EntityStatus;
};

export type AssignmentSubmission = {
  id: string;
  assignmentId: string;
  studentId: string;
  submittedAt: string;
  status: EntityStatus;
  response: string;
  score?: number;
  feedback?: string;
};

export type Quiz = {
  id: string;
  courseRunId: string;
  title: string;
  dueAt: string;
  durationMinutes: number;
  questionTypes: string[];
  questionIds: string[];
  attemptsAllowed: number;
  status: EntityStatus;
};

export type QuestionBankItem = {
  id: string;
  courseRunId: string;
  prompt: string;
  type:
    | "multiple_choice"
    | "true_false"
    | "short_answer"
    | "essay"
    | "oral_record"
    | "file_upload";
  difficulty: "foundation" | "core" | "challenge";
  tags: string[];
  choices: string[];
  answerKey?: string;
  rubric: string[];
  createdBy: string;
  updatedAt: string;
  status: EntityStatus;
};

export type QuizQuestionPreview = Pick<
  QuestionBankItem,
  "id" | "courseRunId" | "prompt" | "type" | "difficulty" | "tags" | "choices" | "status"
> & {
  quizId: string;
};

export type QuizAttempt = {
  id: string;
  quizId: string;
  studentId: string;
  startedAt: string;
  submittedAt?: string;
  status: EntityStatus;
  score: number;
  maxScore: number;
  answers: Record<string, string>;
};

export type Grade = {
  id: string;
  studentId: string;
  courseRunId: string;
  itemId?: string;
  itemTitle: string;
  score: number;
  maxScore: number;
  feedback: string;
};

export type LessonProgress = {
  id: string;
  studentId: string;
  lessonId: string;
  status: LessonProgressStatus;
  completedAt?: string;
  notes?: string;
};

export type CalendarEvent = {
  id: string;
  type: CalendarEventType;
  title: string;
  startsAt: string;
  endsAt: string;
  ownerId: string;
  branchId?: string;
  roomId?: string;
  classGroupId?: string;
  status: EntityStatus;
};

export type ClassSession = {
  id: string;
  classGroupId: string;
  eventId: string;
  title: string;
  startsAt: string;
  endsAt: string;
  status: EntityStatus;
  attendanceSaved: boolean;
};

export type TeacherAvailability = {
  id: string;
  teacherId: string;
  weekday: string;
  startsAt: string;
  endsAt: string;
  branchId: string;
};

export type Room = {
  id: string;
  branchId: string;
  name: string;
  capacity: number;
  equipment: string[];
  status: EntityStatus;
};

export type MeetingLink = {
  id: string;
  provider: "mock" | "zoom" | "google_meet" | "teams";
  url: string;
  status: EntityStatus;
};

export type AttendanceRecord = {
  id: string;
  classGroupId: string;
  studentId: string;
  sessionId: string;
  status: AttendanceStatus;
  notes?: string;
};

export type Lead = {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  country?: string;
  subject: string;
  source: "website" | "trial_form" | "placement_form" | "whatsapp" | "manual";
  status: StudentStatus;
  notes?: string;
  createdAt: string;
};

export type Application = {
  id: string;
  leadId: string;
  branchId: string;
  courseInterest: string;
  schedulePreference: string;
  status: EntityStatus;
};

export type PlacementTestBooking = {
  id: string;
  leadId?: string;
  fullName: string;
  email: string;
  phone: string;
  branchId: string;
  subject: string;
  preferredDate: string;
  currentLevel: string;
  status: EntityStatus;
  recommendedLevel?: string;
};

export type PlacementTestResult = {
  id: string;
  bookingId: string;
  examinerId: string;
  score: number;
  recommendedLevel: string;
  notes: string;
  createdAt: string;
};

export type EnrollmentWorkflow = {
  id: string;
  leadId?: string;
  studentId?: string;
  placementTestId?: string;
  targetCourseId: string;
  status: StudentStatus;
  nextStep: string;
  updatedAt: string;
};

export type Invoice = {
  id: string;
  studentId: string;
  amount: number;
  currency: "EGP" | "USD";
  dueAt: string;
  status: PaymentStatus;
};

export type Payment = {
  id: string;
  invoiceId: string;
  amount: number;
  method: "cash" | "bank_transfer" | "card" | "manual";
  reference?: string;
  paidAt: string;
  status: PaymentStatus;
};

export type Package = {
  id: string;
  title: string;
  courseId: string;
  amount: number;
  currency: "EGP" | "USD";
  sessions: number;
  status: EntityStatus;
};

export type Discount = {
  id: string;
  code: string;
  amount: number;
  currency: "EGP" | "USD";
  status: EntityStatus;
};

export type Certificate = {
  id: string;
  studentId: string;
  courseId: string;
  status: CertificateStatus;
  grade: number;
  attendanceRate: number;
  verificationCode: string;
  approvedBy?: string;
  approvedAt?: string;
  issuedBy?: string;
  issuedAt?: string;
};

export type CertificateVerificationResult = {
  verificationCode: string;
  studentName: string;
  courseTitle: string;
  status: "issued";
  issuedAt?: string;
};

export type QuranMemorizationPlan = {
  id: string;
  studentId: string;
  target: string;
  currentJuz: string;
  revisionCycle: string;
  teacherId: string;
};

export type QuranProgressRecord = {
  id: string;
  studentId: string;
  surah: string;
  juz: string;
  memorizedPercent: number;
  tajweedScore: number;
  notes: string;
};

export type RecitationSubmission = {
  id: string;
  studentId: string;
  teacherId: string;
  title: string;
  submittedAt: string;
  status: EntityStatus;
  feedback?: string;
};

export type Message = {
  id: string;
  fromUserId: string;
  toUserId: string;
  subject: string;
  body: string;
  read: boolean;
  createdAt: string;
};

export type CommunicationLog = {
  id: string;
  actorId: string;
  channel: "in_app" | "email" | "whatsapp" | "phone" | "manual";
  subject: string;
  body: string;
  relatedUserId?: string;
  status: EntityStatus;
  createdAt: string;
};

export type MessageTemplate = {
  id: string;
  title: string;
  channel: "email" | "whatsapp" | "in_app";
  subject: string;
  body: string;
  category: string;
  status: EntityStatus;
};

export type Document = {
  id: string;
  ownerId: string;
  title: string;
  type: "id" | "receipt" | "certificate" | "resource" | "other";
  url: string;
  status: EntityStatus;
};

export type Notification = {
  id: string;
  userId: string;
  title: string;
  body: string;
  href: string;
  read: boolean;
  createdAt: string;
};

export type SupportTicket = {
  id: string;
  requesterId: string;
  subject: string;
  status: EntityStatus;
  priority: "low" | "normal" | "high" | "urgent";
  lastUpdatedAt: string;
};

export type AuditLog = {
  id: string;
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
  summary: string;
  createdAt: string;
};

export type ReportType = "enrollments" | "attendance" | "finance" | "audit";

export type ReportPreset = {
  id: string;
  ownerUserId: string;
  role: Role;
  label: string;
  reportType: ReportType;
  search: string;
  status: string;
  rowCount: number;
  createdAt: string;
};

export type IntegrationStatus = "not_configured" | "mock_mode" | "connected" | "error";

export type IntegrationConfig = {
  id: "supabase" | "moodle" | "ems" | "email" | "whatsapp" | "meeting" | "payment" | "jotform";
  label: string;
  status: IntegrationStatus;
  envVars: string[];
  serverOnly: boolean;
  lastSyncAt?: string;
  notes: string;
};

export type PlatformState = {
  users: User[];
  branches: Branch[];
  departments: Department[];
  programs: Program[];
  levels: CourseLevel[];
  courses: Course[];
  modules: Module[];
  lessons: Lesson[];
  resources: LessonResource[];
  courseRuns: CourseRun[];
  classGroups: ClassGroup[];
  students: StudentProfile[];
  teachers: TeacherProfile[];
  enrollments: Enrollment[];
  lessonProgress: LessonProgress[];
  assignments: Assignment[];
  assignmentSubmissions: AssignmentSubmission[];
  quizzes: Quiz[];
  questionBankItems: QuestionBankItem[];
  quizQuestionPreviews: QuizQuestionPreview[];
  quizAttempts: QuizAttempt[];
  grades: Grade[];
  events: CalendarEvent[];
  classSessions: ClassSession[];
  teacherAvailability: TeacherAvailability[];
  rooms: Room[];
  meetingLinks: MeetingLink[];
  attendance: AttendanceRecord[];
  leads: Lead[];
  applications: Application[];
  placementTests: PlacementTestBooking[];
  placementResults: PlacementTestResult[];
  enrollmentWorkflows: EnrollmentWorkflow[];
  invoices: Invoice[];
  payments: Payment[];
  packages: Package[];
  discounts: Discount[];
  certificates: Certificate[];
  quranPlans: QuranMemorizationPlan[];
  quranProgress: QuranProgressRecord[];
  recitationSubmissions: RecitationSubmission[];
  messages: Message[];
  communicationLogs: CommunicationLog[];
  messageTemplates: MessageTemplate[];
  documents: Document[];
  notifications: Notification[];
  supportTickets: SupportTicket[];
  reportPresets: ReportPreset[];
  auditLogs: AuditLog[];
  integrations: IntegrationConfig[];
  permissions: Record<Role, Permission[]>;
};
