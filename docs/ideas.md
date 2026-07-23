# Nile Center Learning Platform - Design Brainstorm

> Current authority note: this is an early brainstorm, not an integration
> contract. ADR-010 makes Moodle authoritative for Moodle-managed learning
> records, and ADR-011 authorizes full synthetic Moodle sandbox CRUD. Follow
> `docs/NILE_LEARN_MASTER_PLAN.md` and
> `docs/MOODLE_INTEGRATION_EXECUTION_PLAN.md` when this file differs.

## Three Stylistic Approaches

### 1. "Oasis Scholastica" — Desert Modernism meets Digital Learning
A warm, earth-toned interface inspired by Egyptian architecture and the Nile's flowing geometry. Combines terracotta, sand, and deep teal with flowing organic shapes.
**Probability:** 0.04

### 2. "Meridian" — Structured Swiss Precision with Warm Accents
A clean, grid-heavy interface using a strict typographic hierarchy, monochromatic base with a single bold accent color. Inspired by Swiss/International design but warmed with golden amber highlights.
**Probability:** 0.06

### 3. "Lumina" — Glassmorphism-infused Knowledge Platform
A contemporary interface using frosted glass panels, soft gradients, and luminous accent colors. Light and airy with depth created through layered translucent surfaces.
**Probability:** 0.03

---

## Chosen Approach: "Oasis Scholastica" — Desert Modernism meets Digital Learning

### Design Movement
Neo-Egyptian Modernism — drawing from the geometry of Islamic patterns, the warmth of Nile Valley earth tones, and the precision of modern digital interfaces. This is NOT a themed novelty; it's a sophisticated fusion that feels both culturally rooted and forward-looking.

### Core Principles
1. **Flowing Geometry:** Curved containers and asymmetric layouts inspired by the Nile's path — nothing feels boxy or rigid.
2. **Warm Authority:** Deep, confident colors that convey academic seriousness without coldness.
3. **Layered Depth:** Multiple visual planes using shadows and subtle elevation to create a sense of architectural space.
4. **Purposeful Negative Space:** Content breathes; density is managed through progressive disclosure.

### Color Philosophy
The palette draws from the Egyptian landscape at golden hour — when the Nile reflects warm amber light against deep teal waters and terracotta buildings.
- **Primary:** Deep Teal `#0F4C5C` — the depth of the Nile, used for navigation and primary actions
- **Secondary:** Warm Amber `#E8A838` — golden accents for highlights, CTAs, and active states
- **Background:** Warm Sand `#FAF6F0` — not cold white, but the warmth of papyrus
- **Surface:** Soft Cream `#FFFFFF` with warm shadows
- **Text Primary:** Deep Charcoal `#1A1A2E` — near-black with warmth
- **Text Secondary:** Warm Gray `#6B6B7B`
- **Success:** Olive Green `#4A7C59`
- **Accent:** Terracotta `#C75B39` — for alerts and important markers

### Layout Paradigm
Asymmetric dashboard with a persistent left sidebar that uses a slightly curved right edge. Main content area uses a card-based system with varied card sizes creating visual rhythm. The top area features a wide, gently curved header that flows into the content below.

### Signature Elements
1. **Flowing Dividers:** Section separators use gentle wave/curve shapes instead of straight lines, echoing the Nile's flow.
2. **Geometric Accent Patterns:** Subtle Islamic geometric patterns used as background textures in headers and empty states.
3. **Warm Glow Shadows:** All elevated elements use warm-toned shadows (amber-tinted) instead of cold gray shadows.

### Interaction Philosophy
Interactions feel like water flowing — smooth, continuous, and natural. Hover states expand gently, transitions use ease-out curves, and elements appear to rise toward the user rather than snap into place.

### Animation
- Page transitions: 250ms ease-out with subtle vertical slide (8px)
- Card hover: 180ms scale(1.02) with warm shadow expansion
- Sidebar items: 150ms background-color transition with left-border reveal
- Data loading: Skeleton shimmer using warm gradient (sand to cream)
- Modal entry: 300ms from scale(0.95) + opacity with backdrop blur
- Stagger delay: 50ms per item for list reveals

### Typography System
- **Display/Headlines:** "Playfair Display" — serif with character, used for page titles and hero text
- **Body/UI:** "Inter" at 400/500/600 weights — clean and highly readable
- **Monospace/Data:** "JetBrains Mono" — for grades, IDs, and numerical data
- Hierarchy: Display 2.5rem → H1 2rem → H2 1.5rem → H3 1.25rem → Body 1rem → Small 0.875rem

### Brand Essence
**Nile Center: Where ancient wisdom meets modern learning** — for international students seeking authentic Arabic, Quran, and language education through a platform that respects tradition while embracing technology.
Personality: **Scholarly, Warm, Confident**

### Brand Voice
Headlines sound authoritative yet inviting: "Your Journey Through Knowledge Begins Here" and "Master Arabic with Scholars Who Care." CTAs are direct and encouraging: "Begin Your Path" / "Explore Courses" / "View Your Progress." Microcopy is helpful and human: "We'll get you set up in moments" / "Your learning awaits."

### Wordmark & Logo
A stylized "NC" monogram where the N flows into the C like water, with a subtle crescent/dome shape integrated into the negative space. Bold, geometric, and instantly recognizable — rendered in deep teal on light backgrounds, warm amber on dark.

### Signature Brand Color
**Deep Teal `#0F4C5C`** — this is unmistakably Nile Center's color. It appears in the sidebar, primary buttons, and navigation. It evokes the depth of the Nile while maintaining professional gravitas.










You are Codex working inside the Nile Learn repository.

Your task is to build the entire Nile Center modern learning platform end-to-end, using the existing prototype UI as the visual source of truth:

Prototype UI reference:
https://nilelearn-ie3udmyh.manus.space/

Current legacy/reference systems:
https://nilecenter.online/
https://register.nilecenter.org/

Important security rule:
Do not hard-code real emails, passwords, tokens, Moodle credentials, EMS credentials, API keys, or private data anywhere in the repository. Use .env.example placeholders only. Never commit secrets. If any secrets already exist in the repo, move them to environment variables and document the required variable names.

Main goal:
Build a complete modern Nile Center platform that replaces/recreates the learning management system and registration/EMS portals. It must include public pages, authentication, role-based portals, student learning, teacher teaching tools, registrar operations, head-of-department academic management, branch admin operations, super-admin settings, reports, notifications, scheduling, assessments, attendance, certificates, and a clean modern UI matching the prototype.

The final result should feel like a production-ready modern learning platform, not just a static demo.

Before coding:
1. Inspect the current repository structure.
2. Identify the stack already used.
3. Preserve the existing stack unless there is no real app yet.
4. If this is a Next.js/React/Tailwind app, continue with that.
5. If the repo already has design components from the prototype, reuse them.
6. If the repo is mostly empty, create a full Next.js App Router + TypeScript + Tailwind + shadcn/ui-style component system.
7. Create a clear implementation plan internally, then implement.

============================================================
VISUAL DESIGN REQUIREMENTS
============================================================

Use the prototype at https://nilelearn-ie3udmyh.manus.space/ as the visual and UX reference.

Match the prototype’s:
- Overall layout style
- Sidebar/header structure
- Card style
- Spacing
- Border radius
- Typography hierarchy
- Dashboard look and feel
- Color palette
- Button styling
- Table/list styling
- Modern SaaS/LMS feel
- Mobile responsive behavior
- Light theme design

Create a design system with:
- App shell
- Role-aware sidebar
- Top navigation/header
- Cards
- Stat cards
- Data tables
- Empty states
- Loading skeletons
- Error states
- Forms
- Dialogs/modals
- Tabs
- Badges
- Toasts
- Dropdown menus
- Calendar cards
- Course cards
- Lesson cards
- Student cards
- Teacher cards
- Report cards
- Progress bars
- Grade indicators
- Attendance indicators
- Certificate cards
- Notification dropdown
- User profile menu

Design rules:
- Modern, clean, premium education platform.
- Avoid old Moodle-style UI.
- Use strong whitespace and clear hierarchy.
- Every dashboard should be role-specific.
- Support English and Arabic from the start.
- Implement RTL layout support for Arabic.
- Keep all UI responsive: desktop, tablet, mobile.
- Use accessible contrast.
- Add keyboard/focus states.
- Use consistent icons across the app.
- Use smooth but subtle transitions.

If there are existing prototype components, refactor them into reusable components instead of duplicating code.

============================================================
TECHNICAL REQUIREMENTS
============================================================

Use the existing project’s stack. If no stack exists, implement with:

- Next.js App Router
- TypeScript
- Tailwind CSS
- React Server Components where useful
- Client components for interactive dashboards/forms
- shadcn/ui-style reusable components
- lucide-react icons
- zod validation
- react-hook-form
- Prisma ORM or the existing database layer
- PostgreSQL-compatible schema
- Seed data for all roles and demo content
- Role-based access control
- Server-side route protection
- API/service layer
- Clean folder structure
- Tests where practical
- README documentation

Do not create only static pages. Implement real data models, seed data, route guards, and functional UI flows.

If there is no backend configured, implement a local mock/data service that can later be replaced by Supabase/Postgres, but still design the schema and types properly.

Preferred folder structure if using Next.js App Router:

/app
  /(public)
  /auth
  /app
    /student
    /teacher
    /registrar
    /hod
    /branch
    /admin
/components
  /ui
  /layout
  /dashboard
  /courses
  /students
  /teachers
  /forms
  /calendar
  /reports
  /learning
  /ems
/lib
  /auth
  /rbac
  /data
  /db
  /validators
  /utils
  /i18n
  /notifications
  /moodle
/types
/prisma or /db
/scripts
/tests

============================================================
AUTHENTICATION AND RBAC
============================================================

Implement authentication and role-based access control.

Roles:
1. student
2. teacher
3. registrar
4. headofdepartment
5. branchadmin
6. superadmin

Also support future roles:
- finance
- support
- contentmanager
- parent/guardian

Core auth pages:
- /auth/login
- /auth/forgot-password
- /auth/reset-password
- /auth/select-role if a user has multiple roles
- /auth/logout

Login page requirements:
- Match the prototype style.
- Branded Nile Center / Nile Learn page.
- Email/username field.
- Password field.
- Remember me.
- Forgot password.
- Language selector.
- Demo role switcher only in development mode.
- Strong error state.
- Loading state.
- Do not expose real credentials in the UI.

RBAC requirements:
- Every protected route must check user role.
- Every sidebar item must be role-aware.
- Every server action/API call must check permission.
- Unauthorized users should see a clean “Access denied” page.
- Store permissions in a central permission map.
- Add helper functions:
  - hasRole(user, role)
  - hasPermission(user, permission)
  - requireRole(role)
  - requirePermission(permission)
  - getDefaultRouteForRole(role)
  - getSidebarForRole(role)

Role landing pages:
- student -> /app/student/dashboard
- teacher -> /app/teacher/dashboard
- registrar -> /app/registrar/dashboard
- headofdepartment -> /app/hod/dashboard
- branchadmin -> /app/branch/dashboard
- superadmin -> /app/admin/dashboard

============================================================
CORE DATA MODEL
============================================================

Create typed models and database schema/mocks for these entities.

Identity:
- User
- Role
- Permission
- UserRole
- Branch
- Department
- AuditLog
- UserSession
- NotificationPreference

Profiles:
- StudentProfile
- TeacherProfile
- GuardianProfile
- StaffProfile

Academic:
- Program
- Course
- CourseLevel
- CourseRun
- Cohort
- ClassGroup
- Module
- Lesson
- LessonResource
- CurriculumItem
- LearningOutcome

Learning:
- Enrollment
- LessonProgress
- CourseProgress
- Assignment
- AssignmentSubmission
- Quiz
- QuizQuestion
- QuizAttempt
- QuizAnswer
- GradeItem
- Grade
- Feedback
- ForumThread
- ForumPost
- Announcement
- Certificate

Scheduling:
- CalendarEvent
- ClassSession
- TeacherAvailability
- AttendanceRecord
- Room
- MeetingLink
- RescheduleRequest

EMS / Operations:
- Lead
- Application
- PlacementTestBooking
- PlacementTestResult
- EnrollmentWorkflow
- Invoice
- Payment
- Package
- Discount
- CommunicationLog
- MessageTemplate
- SupportTicket
- Document

Quran-specific:
- QuranMemorizationPlan
- QuranProgressRecord
- RecitationSubmission
- TajweedFeedback
- RevisionSchedule
- IjazahMilestone

Course categories:
- Arabic
- Quran & Tajweed
- Islamic Studies
- Turkish
- English
- Teacher Training
- Kids Programs
- Enterprise Programs
- Community Programs

Student statuses:
- lead
- trial_booked
- placement_booked
- placement_completed
- ready_to_enroll
- enrolled
- active
- paused
- completed
- cancelled

Class/session statuses:
- scheduled
- live
- completed
- cancelled
- rescheduled

Attendance statuses:
- present
- late
- absent
- excused

Payment statuses:
- draft
- issued
- pending
- paid
- overdue
- cancelled
- refunded

Certificate statuses:
- draft
- pending_approval
- approved
- issued
- revoked

============================================================
PUBLIC WEBSITE PAGES
============================================================

Build public pages with the same modern Nile Learn UI.

Routes:
- /
- /courses
- /courses/arabic
- /courses/quran
- /courses/islamic-studies
- /courses/turkish
- /courses/english
- /courses/teacher-training
- /courses/kids
- /courses/enterprise
- /courses/:slug
- /book-free-trial
- /book-placement-test
- /faq
- /contact
- /about
- /privacy
- /terms

Public home page:
- Hero section
- “Start learning with Nile Center” CTA
- Book free trial CTA
- Book placement test CTA
- Course category cards
- Why Nile Center
- How online learning works
- Featured teachers
- Student outcomes
- Testimonials
- Platform preview cards
- FAQ
- Footer with links

Course catalog:
- Search
- Filters by subject, level, language, age group, online/offline, teacher availability
- Course cards
- Level badges
- Schedule preview
- CTA to trial/placement/enroll

Course detail page:
- Course overview
- Levels
- Outcomes
- Curriculum/modules
- Teacher information
- Schedule options
- Requirements
- Assessment/certificate information
- FAQ
- CTA

Book free trial form:
- Name
- Email
- Phone/WhatsApp
- Country
- Preferred language
- Subject
- Age group
- Preferred schedule
- Notes
- Submit flow
- Success page/state
- Creates Lead/Application record

Book placement test form:
- Name
- Email
- Phone/WhatsApp
- Branch
- Subject
- Preferred date/time
- Current level
- Notes
- Submit flow
- Success page/state
- Creates PlacementTestBooking record

============================================================
GLOBAL APP SHELL
============================================================

Route:
- /app

Global protected layout must include:
- Role-aware sidebar
- Header with search
- Notifications
- Language switcher
- Profile menu
- Breadcrumbs
- Quick actions
- Mobile sidebar drawer
- Role badge
- Branch selector where relevant
- Academic term selector where relevant

Global search:
- Search students
- Courses
- Classes
- Teachers
- Lessons
- Assignments
- Invoices
- Certificates

Notifications:
- Class reminders
- Assignment due
- Quiz due
- Placement test reminder
- Attendance warning
- Payment reminder
- Certificate approved
- Message received
- Announcement received

============================================================
STUDENT PORTAL
============================================================

Build all student pages.

Routes:
- /app/student/dashboard
- /app/student/courses
- /app/student/courses/:courseId
- /app/student/courses/:courseId/learn/:lessonId
- /app/student/courses/:courseId/live
- /app/student/assignments
- /app/student/assignments/:assignmentId
- /app/student/quizzes
- /app/student/quizzes/:quizId
- /app/student/grades
- /app/student/attendance
- /app/student/calendar
- /app/student/messages
- /app/student/certificates
- /app/student/support
- /app/student/profile
- /app/student/quran-progress

Student dashboard:
- Welcome header
- Next class card
- Continue learning card
- Active courses
- Progress summary
- Attendance summary
- Upcoming assignments
- Upcoming quizzes
- Recent teacher feedback
- Announcements
- Messages
- Certificate progress
- Quick actions:
  - Join class
  - Continue lesson
  - Submit assignment
  - Message teacher
  - View calendar

Student courses:
- Active courses
- Completed courses
- Upcoming courses
- Filter/search
- Course progress bars
- Teacher name
- Next session
- Course status

Course detail:
- Course hero
- Progress
- Modules
- Lessons
- Resources
- Assignments
- Quizzes
- Grades
- Attendance
- Teacher info
- Announcements
- Classmates/forum if enabled

Lesson player:
- Lesson title
- Module navigation
- Video/recording area
- Live class link where relevant
- PDF/resource viewer area
- Downloads
- Notes
- Mark complete
- Previous/next lesson
- Teacher feedback
- Discussion/comments
- Completion tracking

Live class page:
- Meeting link
- Join button
- Session time
- Teacher
- Materials
- Attendance check-in
- Recording after class
- Session notes

Assignments:
- List assignments
- Status: not started, submitted, graded, overdue
- Due dates
- Course filter
- Submission form
- File upload
- Text response
- Audio/video upload placeholder
- Rubric display
- Teacher feedback
- Resubmission if allowed

Quizzes:
- Quiz list
- Start quiz
- Timed attempt UI
- Multiple choice
- Short answer
- Essay/manual grading placeholder
- Submit attempt
- Results page
- Attempt history
- Feedback

Grades:
- Gradebook by course
- Grade items
- Assignment grades
- Quiz grades
- Attendance contribution if enabled
- Teacher feedback
- Overall progress
- Certificate eligibility

Attendance:
- Class attendance records
- Present/late/absent/excused
- Attendance percentage
- Absence notes
- Excuse request form

Calendar:
- Monthly/weekly/list views
- Classes
- Assignments
- Quizzes
- Exams
- Trial/placement events if relevant
- Click event detail

Messages:
- Conversations with teacher, registrar, support
- Thread list
- Message composer
- Attachments placeholder
- Read/unread states

Certificates:
- Certificate cards
- Status
- Download button
- Verification code/link
- Requirements remaining

Support:
- FAQ
- Create support ticket
- Ticket list
- Ticket detail
- Contact info

Profile:
- Personal info
- Contact info
- Guardian info if minor
- Language/timezone
- Password/security
- Notification preferences

Quran progress:
- Surah/Juz tracker
- Memorization plan
- Revision schedule
- Recitation submissions
- Tajweed feedback
- Teacher notes
- Ijazah milestones

============================================================
TEACHER PORTAL
============================================================

Build all teacher pages.

Routes:
- /app/teacher/dashboard
- /app/teacher/classes
- /app/teacher/classes/:classId
- /app/teacher/classes/:classId/sessions
- /app/teacher/classes/:classId/attendance
- /app/teacher/classes/:classId/students
- /app/teacher/classes/:classId/materials
- /app/teacher/assignments
- /app/teacher/assignments/:assignmentId
- /app/teacher/grading
- /app/teacher/quizzes
- /app/teacher/question-bank
- /app/teacher/calendar
- /app/teacher/messages
- /app/teacher/reports
- /app/teacher/profile
- /app/teacher/quran-review

Teacher dashboard:
- Today’s classes
- Start class buttons
- Pending attendance
- Pending grading
- Students needing attention
- Upcoming sessions
- Recent messages
- Quick actions:
  - Create announcement
  - Upload material
  - Mark attendance
  - Grade submissions
  - Create assignment
  - Create quiz

Teacher classes:
- Class cards/table
- Course, level, students, schedule, progress
- Filters by active/completed/upcoming
- Class detail

Class detail:
- Class overview
- Student roster
- Sessions
- Attendance
- Assignments
- Quizzes
- Materials
- Announcements
- Progress analytics

Sessions:
- Create session
- Edit session
- Cancel/reschedule
- Meeting link
- Upload recording
- Session notes
- Mark completed

Attendance:
- Fast attendance grid
- Present/late/absent/excused
- Bulk actions
- Notes
- Save attendance
- Attendance history

Students:
- Roster
- Student progress
- Attendance summary
- Grade summary
- Risk flag
- Message student
- View profile

Materials:
- Upload PDFs/videos/audio/links
- Organize by module/lesson
- Publish/unpublish
- Download/view
- Attach to session

Assignments:
- Create assignment
- Edit assignment
- Due date
- Attach resources
- Rubric
- Submission type
- Review submissions
- Grade
- Feedback

Grading:
- Queue of pending submissions
- Filters
- Rubric grading
- Written comments
- Audio feedback placeholder
- Return to student
- Resubmission controls

Quizzes/question bank:
- Create quiz
- Question bank
- Multiple choice
- True/false
- Short answer
- Essay/manual
- Assign to class
- Attempts
- Results
- Manual grading

Calendar:
- Teaching schedule
- Class sessions
- Office hours/availability
- Exams
- Deadlines

Messages:
- Students
- Registrar
- HOD
- Support
- Announcements

Reports:
- Class performance
- Attendance trends
- Assignment completion
- Quiz performance
- At-risk students
- Course progress

Profile:
- Teacher info
- Department
- Branch
- Availability
- Contact
- Password/security

Quran review:
- Recitation submissions
- Tajweed mistake tracking
- Memorization progress
- Revision plan
- Ijazah milestones

============================================================
REGISTRAR PORTAL
============================================================

Build all registrar pages.

Routes:
- /app/registrar/dashboard
- /app/registrar/leads
- /app/registrar/leads/:leadId
- /app/registrar/applications
- /app/registrar/students
- /app/registrar/students/:studentId
- /app/registrar/placement-tests
- /app/registrar/placement-tests/:bookingId
- /app/registrar/enrollments
- /app/registrar/classes
- /app/registrar/schedule
- /app/registrar/payments
- /app/registrar/messages
- /app/registrar/reports
- /app/registrar/settings

Registrar dashboard:
- New leads
- Trial lessons booked
- Placement tests pending
- Placement results pending
- Ready to enroll
- Payment pending
- LMS account pending
- Active student count
- Today’s appointments
- Pipeline chart/table
- Quick actions:
  - Add lead
  - Book placement test
  - Register student
  - Create enrollment
  - Send message

Leads:
- Lead list
- Search/filter
- Source: website, trial form, placement form, WhatsApp, manual
- Status pipeline
- Lead detail
- Notes
- Contact history
- Convert to application/student

Applications:
- Applicant details
- Course interest
- Branch
- Schedule preference
- Status
- Assign placement test
- Convert to enrollment

Students:
- Student list
- Search/filter by status, branch, course, teacher
- Student detail profile
- Contact info
- Guardian info
- Enrollments
- Attendance
- Grades
- Payments
- Documents
- Communication history
- Support tickets

Placement tests:
- Booking list
- Calendar view
- Assign teacher/examiner
- Record result
- Recommended level
- Notes
- Convert to enrollment

Enrollments:
- Enrollment pipeline
- Select student
- Select course/program
- Select level
- Select class group
- Start date
- Package/payment plan
- Create LMS account/link
- Status transitions

Classes:
- View all class groups
- Capacity
- Teacher
- Schedule
- Enrolled students
- Add/remove students

Schedule:
- Calendar for trial lessons, placement tests, classes
- Filters by branch, teacher, course
- Conflict detection placeholder

Payments:
- Invoices
- Payment status
- Amount
- Due date
- Discounts
- Receipts placeholder
- Payment history

Messages:
- Email/WhatsApp-ready templates
- Send to student/guardian
- Log communication
- Message history

Reports:
- Enrollment funnel
- Lead sources
- Conversion rate
- Placement outcomes
- Active students
- Drop-offs
- Branch/course breakdown

Settings:
- Registrar templates
- Lead sources
- Application statuses

============================================================
HEAD OF DEPARTMENT PORTAL
============================================================

Build all HOD pages.

Routes:
- /app/hod/dashboard
- /app/hod/departments
- /app/hod/programs
- /app/hod/courses
- /app/hod/levels
- /app/hod/curriculum
- /app/hod/teachers
- /app/hod/classes
- /app/hod/assessments
- /app/hod/certificates
- /app/hod/reports
- /app/hod/messages

HOD dashboard:
- Department overview
- Active courses
- Active classes
- Teacher performance
- Student progress distribution
- Assessment completion
- Certificate approvals pending
- At-risk students
- Curriculum coverage
- Quick actions:
  - Create course
  - Edit curriculum
  - Assign teacher
  - Review report
  - Approve certificate

Departments:
- Department list/detail
- Department teachers
- Department courses
- KPIs

Programs/courses:
- Create/edit programs
- Create/edit courses
- Assign levels
- Learning outcomes
- Course status
- Course resources overview

Levels:
- Level structure
- Prerequisites
- Placement mapping
- Completion requirements

Curriculum:
- Modules
- Lessons
- Curriculum items
- Outcomes
- Required resources
- Assessment mapping
- Publish/unpublish

Teachers:
- Teacher list
- Load
- Assigned classes
- Performance indicators
- Student feedback
- Attendance completion
- Grading completion

Classes:
- Department classes
- Progress
- Attendance
- Student outcomes
- Teacher assignment

Assessments:
- Quiz/exam overview
- Assessment completion
- Grade distribution
- Oral/written exam records
- Rubric templates

Certificates:
- Pending approval
- Student eligibility
- Approve/reject
- Issue certificate
- Certificate history

Reports:
- Department performance
- Course completion
- Teacher quality
- Student progress
- Attendance trends
- Assessment performance

Messages:
- Message teachers
- Message registrar
- Department announcements

============================================================
BRANCH ADMIN PORTAL
============================================================

Build all branch admin pages.

Routes:
- /app/branch/dashboard
- /app/branch/students
- /app/branch/teachers
- /app/branch/classes
- /app/branch/rooms
- /app/branch/schedule
- /app/branch/attendance
- /app/branch/payments
- /app/branch/reports
- /app/branch/messages
- /app/branch/settings

Branch dashboard:
- Branch KPIs
- Classes today
- Rooms in use
- Online/live sessions
- Branch students
- Branch teachers
- Attendance exceptions
- Room conflicts
- Payment issues
- Quick actions:
  - Add room
  - View schedule
  - Contact student
  - Resolve conflict

Students:
- Branch student list
- Status
- Course/class
- Contact
- Attendance
- Payments

Teachers:
- Branch teacher list
- Availability
- Schedule
- Classes
- Contact

Classes:
- Branch classes
- Capacity
- Room/online
- Teacher
- Schedule
- Students

Rooms:
- Room list
- Capacity
- Equipment
- Availability
- Conflicts

Schedule:
- Branch calendar
- Class sessions
- Placement tests
- Trial lessons
- Room usage

Attendance:
- Attendance exceptions
- Absences
- Late students
- Reports

Payments:
- Branch invoices/payments
- Overdue
- Paid
- Pending

Reports:
- Branch performance
- Student count
- Revenue placeholder
- Attendance
- Teacher load
- Class utilization

Messages:
- Students
- Teachers
- Registrar
- Announcements

Settings:
- Branch info
- Rooms
- Local templates

============================================================
SUPER ADMIN PORTAL
============================================================

Build all admin pages.

Routes:
- /app/admin/dashboard
- /app/admin/users
- /app/admin/users/:userId
- /app/admin/roles
- /app/admin/permissions
- /app/admin/branches
- /app/admin/departments
- /app/admin/programs
- /app/admin/courses
- /app/admin/settings
- /app/admin/integrations
- /app/admin/audit-logs
- /app/admin/reports
- /app/admin/system-health

Admin dashboard:
- Total users
- Active students
- Active teachers
- Active classes
- Revenue placeholder
- System activity
- Recent audit logs
- Platform health
- Quick actions

Users:
- User list
- Create user
- Edit user
- Assign roles
- Activate/deactivate
- Reset password placeholder
- View audit history

Roles:
- Role list
- Permission matrix
- Assign permissions
- Role descriptions

Permissions:
- Permission registry
- Group by module
- Read/create/update/delete/export permissions

Branches:
- Manage branches
- Branch admins
- Rooms
- Settings

Departments:
- Manage departments
- HOD assignments
- Course ownership

Programs/courses:
- Global academic catalog management

Settings:
- Platform name/branding
- Languages
- Timezone
- Academic terms
- Notification settings
- Certificate settings
- Payment settings placeholder

Integrations:
- Moodle connection, capability, command, and reconciliation configuration
- Email provider placeholder
- WhatsApp provider placeholder
- Meeting provider placeholder
- Payment provider placeholder
- Jotform/import placeholder

Audit logs:
- Actor
- Action
- Entity
- Timestamp
- Before/after summary
- Filters
- Export placeholder

Reports:
- Global reports
- User growth
- Enrollments
- Attendance
- Course performance
- Branch performance
- Teacher performance

System health:
- App status
- Database status placeholder
- Queue status placeholder
- Integration status placeholder

============================================================
ASSESSMENT ENGINE
============================================================

Implement a functional assessment module shared by student, teacher, HOD, and admin.

Features:
- Question bank
- Quiz creation
- Quiz attempts
- Timed quiz UI
- Auto-grading for objective questions
- Manual grading for essay/oral/written
- Rubrics
- Gradebook
- Feedback
- Attempt history
- Assessment reports
- Placement test result mapping
- Midterm/final exam support
- Certificate eligibility rules

Question types:
- Multiple choice
- True/false
- Short answer
- Essay
- Oral exam record
- File/audio submission placeholder

============================================================
ATTENDANCE ENGINE
============================================================

Implement attendance across teacher, student, registrar, branch admin, and reports.

Features:
- Mark attendance per class session
- Present/late/absent/excused
- Notes
- Bulk save
- Attendance percentage
- Absence alerts
- Excuse requests
- Attendance reports
- Student attendance history
- Class attendance history
- Branch attendance exceptions

============================================================
CALENDAR AND SCHEDULING
============================================================

Implement a unified calendar model.

Event types:
- Class session
- Live session
- Trial lesson
- Placement test
- Assignment due
- Quiz due
- Exam
- Teacher availability
- Room booking
- Reminder

Calendar views:
- Month
- Week
- Day/list
- Role-specific filters
- Event detail drawer/modal
- Create/edit events where permitted

Conflict placeholders:
- Teacher double-booked
- Room double-booked
- Student class overlap

============================================================
COMMUNICATION AND NOTIFICATIONS
============================================================

Implement in-app notifications and communication logs.

Notification center:
- Unread count
- Notification list
- Mark as read
- Deep links
- Notification preferences

Communication:
- Messages between roles
- Registrar/student communication
- Teacher/student communication
- HOD/teacher announcements
- Branch announcements
- Templates for email/WhatsApp-ready messages
- CommunicationLog records

Templates:
- Trial lesson confirmation
- Placement test confirmation
- Enrollment confirmation
- Class reminder
- Assignment reminder
- Payment reminder
- Absence warning
- Certificate issued

Do not actually send external emails/WhatsApp unless integration exists. Use placeholders and logs.

============================================================
CERTIFICATES
============================================================

Implement certificate module.

Features:
- Certificate eligibility
- Pending approval queue
- HOD approval
- Issue certificate
- Certificate card
- Download placeholder
- Verification code/link
- Certificate status
- Certificate history
- Revoke certificate for admin/HOD

Certificate data:
- Student
- Course
- Level
- Completion date
- Grade
- Attendance percentage
- Approved by
- Verification code

============================================================
QURAN-SPECIFIC FEATURES
============================================================

Build Quran-specific functionality, especially for student and teacher portals.

Student Quran page:
- Memorization plan
- Surah/Juz progress
- Revision schedule
- Recitation submission
- Tajweed feedback
- Teacher notes
- Ijazah milestone progress

Teacher Quran review:
- Recitation submissions queue
- Listen/review placeholder
- Mark mistakes
- Tajweed feedback categories
- Memorization progress update
- Revision assignment
- Ijazah milestone update

Data:
- QuranMemorizationPlan
- QuranProgressRecord
- RecitationSubmission
- TajweedFeedback
- RevisionSchedule
- IjazahMilestone

UI:
- Make it beautiful and specialized, not generic.
- Use progress trackers and milestone cards.

============================================================
MOODLE CRUD INTEGRATION / LEGACY EMS MIGRATION
============================================================

Moodle is the writable authority for Moodle-managed learning records. Build a
server-only integration with scoped projections, full allowlisted CRUD
commands, native launches, audit/outbox evidence, reconciliation, and cleanup.
Do not hard-code credentials.

Create:
- /lib/moodle/client.ts
- /lib/moodle/types.ts
- /lib/moodle/mappers.ts

Environment variables in .env.example:
- MOODLE_BASE_URL
- MOODLE_SERVICE
- MOODLE_TOKEN
- EMS_BASE_URL

Implement typed reads and CRUD commands:
- getMoodleCourses()
- getMoodleCourse(id)
- getMoodleUserCourses(userId)
- getMoodleGrades(userId)
- getMoodleAssignments(courseId)
- mapMoodleCourseToCourse()
- mapMoodleGradeToGrade()
- createMoodleDeliveryCourse()
- updateMoodleSection()
- upsertMoodleResource()
- upsertMoodleAssignment()
- upsertMoodleQuizAndQuestions()
- updateMoodleGradeAndFeedback()
- archiveOrRestoreMoodleActivity()
- reconcileMoodleCommand()

When the runtime is disabled, show an explicit unavailable state. Never report
mock data as synchronized provider state.

============================================================
SEED DATA
============================================================

Create rich demo/seed data so every page looks real.

Seed users:
- Student demo user
- Teacher demo user
- Registrar demo user
- HOD demo user
- Branch admin demo user
- Super admin demo user

Use fake safe emails only:
- student.demo@nilelearn.local
- teacher.demo@nilelearn.local
- registrar.demo@nilelearn.local
- hod.demo@nilelearn.local
- branch.demo@nilelearn.local
- admin.demo@nilelearn.local

Never use real emails/passwords from the prompt or environment.

Seed:
- Multiple programs
- Multiple courses
- Course levels
- Modules/lessons
- Assignments
- Quizzes
- Announcements
- Student enrollments
- Class groups
- Teachers
- Branches
- Rooms
- Placement tests
- Leads
- Invoices/payments
- Attendance records
- Certificates
- Quran progress records
- Messages/notifications
- Reports data

The app should look full and alive, not empty.

============================================================
REPORTING AND ANALYTICS
============================================================

Build report pages with charts/cards/tables.

Reports by role:

Student:
- Personal progress
- Grades
- Attendance
- Completion

Teacher:
- Class progress
- Student performance
- Attendance trends
- Grading queue
- At-risk students

Registrar:
- Lead funnel
- Placement tests
- Enrollments
- Conversion rate
- Student status

HOD:
- Course performance
- Department performance
- Teacher performance
- Assessment completion
- Certificate approvals

Branch admin:
- Branch performance
- Room utilization
- Attendance exceptions
- Branch classes
- Payment status

Super admin:
- Global KPIs
- User growth
- Course/category performance
- Branch comparison
- System activity

Charts:
- Use simple, clean chart components.
- If a chart library exists, use it.
- Otherwise build clean stat cards and simple SVG/CSS charts.
- Every report needs filters and export placeholder.

============================================================
FORMS AND VALIDATION
============================================================

Every create/edit page should have:
- Real form fields
- zod validation
- Loading state
- Success state/toast
- Error state
- Cancel/back behavior
- Save button
- Audit log creation where applicable

Important forms:
- Lead form
- Student form
- Teacher form
- Placement test booking form
- Placement test result form
- Enrollment form
- Course form
- Class group form
- Session form
- Attendance form
- Assignment form
- Quiz form
- Question form
- Grade/feedback form
- Certificate approval form
- Message template form
- User/role form

============================================================
TABLES AND FILTERS
============================================================

All list pages should have:
- Search
- Filters
- Sort
- Status badges
- Row actions
- Empty state
- Loading state
- Pagination or simple page controls
- Responsive mobile layout

Tables required:
- Users
- Students
- Teachers
- Leads
- Applications
- Placement tests
- Enrollments
- Courses
- Classes
- Sessions
- Attendance
- Assignments
- Submissions
- Quizzes
- Grades
- Certificates
- Invoices
- Payments
- Messages
- Audit logs
- Reports

============================================================
ACCESSIBILITY, RESPONSIVENESS, AND QUALITY
============================================================

Implement:
- Semantic HTML
- aria-labels where needed
- Keyboard accessible dialogs/menus
- Focus states
- Responsive layout
- Mobile sidebar
- Good empty states
- Good error messages
- Loading skeletons
- No broken links
- No TypeScript errors
- No lint errors
- No console errors
- Consistent formatting

============================================================
INTERNATIONALIZATION
============================================================

Implement basic i18n structure.

Languages:
- English default
- Arabic supported
- Keep room for Turkish, Russian, French, Indonesian, Malay, German, Persian, Chinese, Kazakh, Kyrgyz, Uzbek

Requirements:
- Language selector in public site and app shell
- RTL support for Arabic
- Store translations in /lib/i18n or equivalent
- Translate main navigation labels, buttons, common states, and key dashboard labels
- Do not translate every long paragraph if time is limited, but structure the app so it is easy to extend

============================================================
ROUTING MAP SUMMARY
============================================================

Public:
/
 /courses
 /courses/arabic
 /courses/quran
 /courses/islamic-studies
 /courses/turkish
 /courses/english
 /courses/teacher-training
 /courses/kids
 /courses/enterprise
 /courses/:slug
 /book-free-trial
 /book-placement-test
 /faq
 /contact
 /about
 /privacy
 /terms

Auth:
 /auth/login
 /auth/forgot-password
 /auth/reset-password
 /auth/select-role
 /auth/logout

Student:
 /app/student/dashboard
 /app/student/courses
 /app/student/courses/:courseId
 /app/student/courses/:courseId/learn/:lessonId
 /app/student/courses/:courseId/live
 /app/student/assignments
 /app/student/assignments/:assignmentId
 /app/student/quizzes
 /app/student/quizzes/:quizId
 /app/student/grades
 /app/student/attendance
 /app/student/calendar
 /app/student/messages
 /app/student/certificates
 /app/student/support
 /app/student/profile
 /app/student/quran-progress

Teacher:
 /app/teacher/dashboard
 /app/teacher/classes
 /app/teacher/classes/:classId
 /app/teacher/classes/:classId/sessions
 /app/teacher/classes/:classId/attendance
 /app/teacher/classes/:classId/students
 /app/teacher/classes/:classId/materials
 /app/teacher/assignments
 /app/teacher/assignments/:assignmentId
 /app/teacher/grading
 /app/teacher/quizzes
 /app/teacher/question-bank
 /app/teacher/calendar
 /app/teacher/messages
 /app/teacher/reports
 /app/teacher/profile
 /app/teacher/quran-review

Registrar:
 /app/registrar/dashboard
 /app/registrar/leads
 /app/registrar/leads/:leadId
 /app/registrar/applications
 /app/registrar/students
 /app/registrar/students/:studentId
 /app/registrar/placement-tests
 /app/registrar/placement-tests/:bookingId
 /app/registrar/enrollments
 /app/registrar/classes
 /app/registrar/schedule
 /app/registrar/payments
 /app/registrar/messages
 /app/registrar/reports
 /app/registrar/settings

HOD:
 /app/hod/dashboard
 /app/hod/departments
 /app/hod/programs
 /app/hod/courses
 /app/hod/levels
 /app/hod/curriculum
 /app/hod/teachers
 /app/hod/classes
 /app/hod/assessments
 /app/hod/certificates
 /app/hod/reports
 /app/hod/messages

Branch Admin:
 /app/branch/dashboard
 /app/branch/students
 /app/branch/teachers
 /app/branch/classes
 /app/branch/rooms
 /app/branch/schedule
 /app/branch/attendance
 /app/branch/payments
 /app/branch/reports
 /app/branch/messages
 /app/branch/settings

Super Admin:
 /app/admin/dashboard
 /app/admin/users
 /app/admin/users/:userId
 /app/admin/roles
 /app/admin/permissions
 /app/admin/branches
 /app/admin/departments
 /app/admin/programs
 /app/admin/courses
 /app/admin/settings
 /app/admin/integrations
 /app/admin/audit-logs
 /app/admin/reports
 /app/admin/system-health

============================================================
IMPLEMENTATION SEQUENCE
============================================================

Implement in this order:

1. Project inspection and cleanup
2. Design tokens and reusable UI components
3. Data types/schema/mock data
4. Auth and RBAC
5. Global app shell and role sidebars
6. Public pages
7. Student portal
8. Teacher portal
9. Registrar portal
10. HOD portal
11. Branch admin portal
12. Super admin portal
13. Assessment engine
14. Attendance engine
15. Calendar/scheduling
16. Notifications/messages
17. Certificates
18. Quran-specific features
19. Reports
20. Moodle CRUD integration and finite EMS migration boundaries
21. Seed data
22. Tests/lint/build fixes
23. README/update documentation

Do not stop after creating only a shell. Build all pages listed above with functional UI using data, actions, forms, and state.

============================================================
ACCEPTANCE CRITERIA
============================================================

The task is complete only when:

1. The app builds successfully.
2. There are no TypeScript errors.
3. There are no obvious runtime console errors.
4. All route groups exist.
5. Every role has a complete dashboard.
6. Every role has its full sidebar/navigation.
7. Every listed page renders meaningful UI.
8. All major list pages have search/filter/table/card UI.
9. All major create/edit flows have forms and validation.
10. Student can view courses, lessons, assignments, quizzes, grades, attendance, calendar, messages, certificates, support, and Quran progress.
11. Teacher can manage classes, sessions, attendance, materials, assignments, grading, quizzes, calendar, messages, reports, and Quran review.
12. Registrar can manage leads, applications, students, placement tests, enrollments, classes, schedule, payments, messages, and reports.
13. HOD can manage departments, programs, courses, levels, curriculum, teachers, classes, assessments, certificates, reports, and messages.
14. Branch admin can manage students, teachers, classes, rooms, schedule, attendance, payments, reports, messages, and settings.
15. Super admin can manage users, roles, permissions, branches, departments, programs, courses, settings, integrations, audit logs, reports, and system health.
16. RBAC prevents users from opening pages outside their role.
17. The design matches the prototype visual direction.
18. Public pages look modern and complete.
19. Arabic/RTL support is started and works structurally.
20. Seed/mock data makes the whole product feel complete.
21. .env.example documents required environment variables.
22. README explains how to run, seed, test, and connect Moodle/EMS later.

============================================================
OUTPUT REQUIREMENTS
============================================================

After implementation, provide:

1. Summary of what was built.
2. List of major files/folders changed.
3. Any commands needed to run the app.
4. Any environment variables needed.
5. Any remaining limitations or integration placeholders.
6. Confirmation that build/typecheck/lint were run, or explain why not.

Remember:
- Do not include real credentials.
- Do not leave TODO-only pages.
- Do not create empty placeholder screens.
- Build meaningful, navigable, role-based, end-to-end UI.
- Match the existing prototype as closely as possible while completing the full platform.
