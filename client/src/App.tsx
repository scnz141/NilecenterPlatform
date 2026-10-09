import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Redirect, Route, Switch, useLocation } from "wouter";
import { Fragment, lazy, Suspense } from "react";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import ProtectedRoute from "./components/platform/ProtectedRoute";
import LegacyRouteRedirect from "./components/platform/LegacyRouteRedirect";
import { nileFormsCutoverEnabled } from "./lib/forms/cutover";
import { legacyStaffTarget } from "./staff/legacy-redirects";
import type { Role } from "./lib/platformData";

// Public
const Home = lazy(() => import("./pages/Home"));
const Login = lazy(() => import("./pages/Login"));
const PublicSitePage = lazy(() => import("./pages/public/PublicSitePage"));
const PublicNileFormPage = lazy(
  () => import("./pages/public/PublicNileFormPage")
);
const RoleDashboard = lazy(() => import("./pages/platform/RoleDashboard"));
const AuthFlowPage = lazy(() => import("./pages/platform/AuthFlowPage"));
const MoodleSourcePage = lazy(
  () => import("./pages/platform/MoodleSourcePage")
);
const MoodleCourseContentPage = lazy(
  () => import("./pages/platform/MoodleCourseContentPage")
);
const PortalMessagesPage = lazy(
  () => import("./pages/platform/PortalMessagesPage")
);
const StudentRecordsPage = lazy(
  () => import("./pages/platform/StudentRecordsPage")
);
const StudentAssessmentPage = lazy(
  () => import("./pages/platform/StudentAssessmentPage")
);
const StudentSupportPage = lazy(
  () => import("./pages/platform/StudentSupportPage")
);
const StudentLearningPage = lazy(
  () => import("./pages/platform/StudentLearningPage")
);
const StudentWorkspacePage = lazy(
  () => import("./pages/platform/StudentWorkspacePage")
);
const ProfileWorkspace = lazy(
  () => import("./pages/platform/ProfileWorkspace")
);
const NileFormsAssignedPage = lazy(
  () => import("./pages/platform/NileFormsAssignedPage")
);
const StaffRoute = lazy(() =>
  import("./staff/shell/staff-route").then(m => ({ default: m.StaffRoute }))
);
const StaffNotificationsPage = lazy(
  () => import("./staff/pages/notifications-page")
);
const StaffProfilePage = lazy(() => import("./staff/pages/profile-page"));
const StaffBranchesPage = lazy(() => import("./staff/pages/branches-page"));
const StaffBranchDetailPage = lazy(
  () => import("./staff/pages/branch-detail-page")
);
const StaffDepartmentsPage = lazy(
  () => import("./staff/pages/departments-page")
);
const StaffLostReasonsPage = lazy(
  () => import("./staff/pages/lost-reasons-page")
);
const StaffActionReasonsPage = lazy(
  () => import("./staff/pages/action-reasons-page")
);
const StaffAreasOfStudyPage = lazy(
  () => import("./staff/pages/areas-of-study-page")
);
const StaffCustomFieldsPage = lazy(
  () => import("./staff/pages/custom-fields-page")
);
const StaffUsersPage = lazy(() => import("./staff/pages/staff-page"));
const StaffUserDetailPage = lazy(
  () => import("./staff/pages/staff-detail-page")
);
const StaffMoodleSitePage = lazy(
  () => import("./staff/pages/moodle-page")
);
const StaffSystemPage = lazy(() => import("./staff/pages/system-page"));
const StaffAuditPage = lazy(() => import("./staff/pages/audit-page"));
const StaffLeadsPage = lazy(() => import("./staff/pages/leads-page"));
const StaffDashboardPage = lazy(() => import("./staff/pages/dashboard-page"));
const StaffReportsPage = lazy(() => import("./staff/pages/reports-page"));
const StaffCoursesPage = lazy(() => import("./staff/pages/courses-page"));
const StaffCourseDetailPage = lazy(
  () => import("./staff/pages/course-detail-page")
);
const StaffClassesPage = lazy(() => import("./staff/pages/classes-page"));
const StaffClassDetailPage = lazy(
  () => import("./staff/pages/class-detail-page")
);
const StaffRoomsPage = lazy(() => import("./staff/pages/rooms-page"));
const StaffMyWeekPage = lazy(() => import("./staff/pages/my-week-page"));
const StaffFormsPage = lazy(() => import("./staff/pages/forms-page"));
const StaffFormPage = lazy(() => import("./staff/pages/form-page"));
const StaffFormResponsePage = lazy(
  () => import("./staff/pages/form-response-page")
);
const StaffFormFillPage = lazy(() => import("./staff/pages/form-fill-page"));
const StaffFormsImportPage = lazy(
  () => import("./staff/pages/forms-import-page")
);
const StaffRoomDetailPage = lazy(
  () => import("./staff/pages/room-detail-page")
);
const StaffLeadDetailPage = lazy(
  () => import("./staff/pages/lead-detail-page")
);
const StaffStudentsPage = lazy(() => import("./staff/pages/students-page"));
const StaffStudentDetailPage = lazy(
  () => import("./staff/pages/student-detail-page")
);
const StaffEnrolmentsPage = lazy(() => import("./staff/pages/enrolments-page"));
const StaffPlacementTestsPage = lazy(() =>
  import("./staff/pages/bookings-page").then(m => ({
    default: m.PlacementTestsPage,
  }))
);
const StaffTrialLessonsPage = lazy(() =>
  import("./staff/pages/bookings-page").then(m => ({
    default: m.TrialLessonsPage,
  }))
);
const NileFormsResponsePage = lazy(
  () => import("./pages/platform/NileFormsResponsePage")
);
const NileRequestsListPage = lazy(
  () => import("./pages/platform/NileRequestsListPage")
);
const NileRequestDetailPage = lazy(
  () => import("./pages/platform/NileRequestDetailPage")
);
const NotFound = lazy(() => import("./pages/NotFound"));

const dashboardRoutes: { path: string; role: Role }[] = [
  { path: "/app/student/dashboard", role: "student" },
];

function LegacyStaffRedirect() {
  const [location] = useLocation();
  return (
    <Redirect to={legacyStaffTarget(location) ?? "/app/dashboard"} replace />
  );
}

function RouteLoading() {
  return (
    <main className="platform-route-loading" aria-live="polite">
      <span />
      <strong>Loading workspace</strong>
    </main>
  );
}

function Router() {
  return (
    <Suspense fallback={<RouteLoading />}>
      <Switch>
        {/* Public */}
        <Route path="/" component={Home} />
        <Route path="/login">
          <Login />
        </Route>
        <Route path="/auth/login">
          <Login />
        </Route>
        <Route path="/auth/student-login">
          <Login audience="student" />
        </Route>
        <Route path="/auth/administration-login">
          <Login audience="administration" />
        </Route>
        <Route path="/auth/admin-login">
          <Login audience="administration" />
        </Route>
        <Route path="/auth/forgot-password">
          <AuthFlowPage mode="forgot-password" />
        </Route>
        <Route path="/auth/reset-password">
          <AuthFlowPage mode="reset-password" />
        </Route>
        <Route path="/auth/accept-invitation">
          <AuthFlowPage mode="accept-invitation" />
        </Route>
        <Route path="/auth/select-role">
          <AuthFlowPage mode="select-role" />
        </Route>
        <Route path="/auth/select-workspace">
          <AuthFlowPage mode="select-workspace" />
        </Route>
        <Route path="/auth/logout">
          <AuthFlowPage mode="logout" />
        </Route>

        <Route path="/courses">
          <PublicSitePage mode="catalog" />
        </Route>
        <Route path="/courses/arabic">
          <PublicSitePage mode="catalog" slug="arabic" />
        </Route>
        <Route path="/courses/quran">
          <PublicSitePage mode="catalog" slug="quran" />
        </Route>
        <Route path="/courses/islamic-studies">
          <PublicSitePage mode="catalog" slug="islamic-studies" />
        </Route>
        <Route path="/courses/turkish">
          <PublicSitePage mode="catalog" slug="turkish" />
        </Route>
        <Route path="/courses/english">
          <PublicSitePage mode="catalog" slug="english" />
        </Route>
        <Route path="/courses/teacher-training">
          <PublicSitePage mode="catalog" slug="teacher-training" />
        </Route>
        <Route path="/courses/kids">
          <PublicSitePage mode="catalog" slug="kids" />
        </Route>
        <Route path="/courses/enterprise">
          <PublicSitePage mode="catalog" slug="enterprise" />
        </Route>
        <Route path="/courses/:slug">
          {params => <PublicSitePage mode="course" slug={params.slug} />}
        </Route>
        <Route path="/book-free-trial">
          {nileFormsCutoverEnabled ? (
            <PublicNileFormPage slug="free-trial-enquiry" />
          ) : (
            <PublicSitePage mode="trial" />
          )}
        </Route>
        <Route path="/book-placement-test">
          {nileFormsCutoverEnabled ? (
            <PublicNileFormPage slug="placement-request" />
          ) : (
            <PublicSitePage mode="placement" />
          )}
        </Route>
        <Route path="/apply">
          {nileFormsCutoverEnabled ? (
            <PublicNileFormPage slug="course-application" />
          ) : (
            <PublicSitePage mode="contact" />
          )}
        </Route>
        <Route path="/verify-certificate">
          <PublicSitePage mode="verify" />
        </Route>
        <Route path="/faq">
          <PublicSitePage mode="faq" />
        </Route>
        <Route path="/contact">
          <PublicSitePage mode="contact" />
        </Route>
        <Route path="/about">
          <PublicSitePage mode="about" />
        </Route>
        <Route path="/privacy">
          <PublicSitePage mode="privacy" />
        </Route>
        <Route path="/terms">
          <PublicSitePage mode="terms" />
        </Route>
        <Route path="/forms/:slug">
          {params => <PublicNileFormPage slug={params.slug} />}
        </Route>

        <Route path="/app">
          <AuthFlowPage mode="select-role" />
        </Route>

        {/* Unified staff app (NCC sessions only) */}
        <StaffRoute path="/app/dashboard">
          <StaffDashboardPage />
        </StaffRoute>
        <StaffRoute path="/app/reports">
          <StaffReportsPage />
        </StaffRoute>
        <StaffRoute path="/app/notifications">
          <StaffNotificationsPage />
        </StaffRoute>
        <StaffRoute path="/app/profile">
          <StaffProfilePage />
        </StaffRoute>
        <StaffRoute path="/app/branches/:id">
          <StaffBranchDetailPage />
        </StaffRoute>
        <StaffRoute path="/app/branches">
          <StaffBranchesPage />
        </StaffRoute>
        <StaffRoute path="/app/departments">
          <StaffDepartmentsPage />
        </StaffRoute>
        <StaffRoute path="/app/lost-reasons">
          <StaffLostReasonsPage />
        </StaffRoute>
        <StaffRoute path="/app/action-reasons">
          <StaffActionReasonsPage />
        </StaffRoute>
        <StaffRoute path="/app/areas-of-study">
          <StaffAreasOfStudyPage />
        </StaffRoute>
        <StaffRoute path="/app/custom-fields">
          <StaffCustomFieldsPage />
        </StaffRoute>
        <StaffRoute path="/app/staff/:id">
          <StaffUserDetailPage />
        </StaffRoute>
        <StaffRoute path="/app/staff">
          <StaffUsersPage />
        </StaffRoute>
        <StaffRoute path="/app/moodle">
          <StaffMoodleSitePage />
        </StaffRoute>
        <StaffRoute path="/app/system">
          <StaffSystemPage />
        </StaffRoute>
        <StaffRoute path="/app/audit">
          <StaffAuditPage />
        </StaffRoute>
        <StaffRoute path="/app/leads/:id">
          <StaffLeadDetailPage />
        </StaffRoute>
        <StaffRoute path="/app/leads">
          <StaffLeadsPage />
        </StaffRoute>
        <StaffRoute path="/app/students/:id">
          <StaffStudentDetailPage />
        </StaffRoute>
        <StaffRoute path="/app/students">
          <StaffStudentsPage />
        </StaffRoute>
        <StaffRoute path="/app/enrolments">
          <StaffEnrolmentsPage />
        </StaffRoute>
        <StaffRoute path="/app/courses/:id">
          <StaffCourseDetailPage />
        </StaffRoute>
        <StaffRoute path="/app/courses">
          <StaffCoursesPage />
        </StaffRoute>
        <StaffRoute path="/app/classes/:id">
          <StaffClassDetailPage />
        </StaffRoute>
        <StaffRoute path="/app/classes">
          <StaffClassesPage />
        </StaffRoute>
        <StaffRoute path="/app/forms/import">
          <StaffFormsImportPage />
        </StaffRoute>
        <StaffRoute path="/app/forms/responses/:submissionId">
          <StaffFormResponsePage />
        </StaffRoute>
        <StaffRoute path="/app/forms/fill/:publicationId">
          <StaffFormFillPage />
        </StaffRoute>
        <StaffRoute path="/app/forms/:formId">
          <StaffFormPage />
        </StaffRoute>
        <StaffRoute path="/app/forms">
          <StaffFormsPage />
        </StaffRoute>
        <StaffRoute path="/app/sessions">
          <StaffMyWeekPage />
        </StaffRoute>
        <StaffRoute path="/app/rooms/:id">
          <StaffRoomDetailPage />
        </StaffRoute>
        <StaffRoute path="/app/rooms">
          <StaffRoomsPage />
        </StaffRoute>
        <StaffRoute path="/app/placement-tests">
          <StaffPlacementTestsPage />
        </StaffRoute>
        <StaffRoute path="/app/trial-lessons">
          <StaffTrialLessonsPage />
        </StaffRoute>

        {dashboardRoutes.map(route => (
          <Route key={route.path} path={route.path}>
            <ProtectedRoute role={route.role} pageId="dashboard">
              <RoleDashboard role={route.role} />
            </ProtectedRoute>
          </Route>
        ))}

        <Route path="/app/student/requests/:requestId">
          {params => (
            <ProtectedRoute role="student" pageId="request-detail">
              <NileRequestDetailPage
                role="student"
                requestId={params.requestId}
              />
            </ProtectedRoute>
          )}
        </Route>

        <Route path="/app/student/requests">
          <ProtectedRoute role="student" pageId="requests">
            <NileRequestsListPage role="student" />
          </ProtectedRoute>
        </Route>

        <Route
          path="/app/student/forms/:publicationId/responses/:submissionId"
        >
          {params => (
            <ProtectedRoute role="student" pageId="forms">
              <NileFormsResponsePage
                role="student"
                publicationId={params.publicationId}
                submissionId={params.submissionId}
              />
            </ProtectedRoute>
          )}
        </Route>

        <Route path="/app/student/forms/:publicationId">
          {params => (
            <ProtectedRoute role="student" pageId="forms">
              <NileFormsAssignedPage
                role="student"
                publicationId={params.publicationId}
              />
            </ProtectedRoute>
          )}
        </Route>

        <Route path="/app/student/forms">
          <ProtectedRoute role="student" pageId="forms">
            <NileFormsAssignedPage role="student" />
          </ProtectedRoute>
        </Route>

        <Route path="/app/student/moodle-source/:courseId">
          {params => (
            <ProtectedRoute role="student" pageId="moodle-source">
              <MoodleCourseContentPage
                role="student"
                courseId={params.courseId}
              />
            </ProtectedRoute>
          )}
        </Route>

        <Route path="/app/student/moodle-source">
          <ProtectedRoute role="student" pageId="moodle-source">
            <MoodleSourcePage role="student" />
          </ProtectedRoute>
        </Route>

        <Route path="/app/student/courses/:courseId/learn/:lessonId">
          {params => (
            <ProtectedRoute role="student" pageId="lesson">
              <StudentLearningPage
                mode="lesson"
                courseId={params.courseId}
                lessonId={params.lessonId}
              />
            </ProtectedRoute>
          )}
        </Route>

        <Route path="/app/student/courses/:courseId/live">
          {params => (
            <ProtectedRoute role="student" pageId="live">
              <StudentLearningPage mode="live" courseId={params.courseId} />
            </ProtectedRoute>
          )}
        </Route>

        <Route path="/app/student/courses/:courseId">
          {params => (
            <ProtectedRoute role="student" pageId="course-detail">
              <StudentLearningPage mode="course" courseId={params.courseId} />
            </ProtectedRoute>
          )}
        </Route>

        <Route path="/app/student/courses">
          <ProtectedRoute role="student" pageId="courses">
            <StudentWorkspacePage view="courses" />
          </ProtectedRoute>
        </Route>

        <Route path="/app/student/assignments/:assignmentId">
          {params => (
            <ProtectedRoute role="student" pageId="assignment-detail">
              <StudentAssessmentPage
                view="assignment-detail"
                assignmentId={params.assignmentId}
              />
            </ProtectedRoute>
          )}
        </Route>

        <Route path="/app/student/quizzes/:quizId">
          {params => (
            <ProtectedRoute role="student" pageId="quiz-detail">
              <StudentAssessmentPage
                view="quiz-detail"
                quizId={params.quizId}
              />
            </ProtectedRoute>
          )}
        </Route>

        <Route path="/app/student/assignments">
          <ProtectedRoute role="student" pageId="assignments">
            <StudentWorkspacePage view="assignments" />
          </ProtectedRoute>
        </Route>

        <Route path="/app/student/quizzes">
          <ProtectedRoute role="student" pageId="quizzes">
            <StudentWorkspacePage view="quizzes" />
          </ProtectedRoute>
        </Route>

        <Route path="/app/student/calendar">
          <ProtectedRoute role="student" pageId="calendar">
            <StudentWorkspacePage view="calendar" />
          </ProtectedRoute>
        </Route>

        <Route path="/app/student/profile">
          <ProtectedRoute role="student" pageId="profile">
            <Redirect to="/app/student/settings" replace />
          </ProtectedRoute>
        </Route>

        <Route path="/app/student/settings">
          <ProtectedRoute role="student" pageId="profile">
            <ProfileWorkspace role="student" />
          </ProtectedRoute>
        </Route>

        <Route path="/app/student/support/new">
          <ProtectedRoute role="student" pageId="support">
            {nileFormsCutoverEnabled ? (
              <NileFormsAssignedPage
                role="student"
                publicationId="publication_form_support_1"
              />
            ) : (
              <StudentSupportPage mode="create" />
            )}
          </ProtectedRoute>
        </Route>

        <Route path="/app/student/support">
          <ProtectedRoute role="student" pageId="support">
            <StudentSupportPage />
          </ProtectedRoute>
        </Route>

        <Route path="/app/student/grades">
          <ProtectedRoute role="student" pageId="grades">
            <StudentRecordsPage pageId="grades" />
          </ProtectedRoute>
        </Route>

        <Route path="/app/student/attendance">
          <ProtectedRoute role="student" pageId="attendance">
            <StudentRecordsPage pageId="attendance" />
          </ProtectedRoute>
        </Route>

        <Route path="/app/student/certificates">
          <ProtectedRoute role="student" pageId="certificates">
            <StudentRecordsPage pageId="certificates" />
          </ProtectedRoute>
        </Route>

        <Route path="/app/student/reports">
          <ProtectedRoute role="student" pageId="reports">
            <StudentRecordsPage pageId="reports" />
          </ProtectedRoute>
        </Route>

        <Route path="/app/student/quran-progress">
          <ProtectedRoute role="student" pageId="quran-progress">
            <StudentRecordsPage pageId="quran-progress" />
          </ProtectedRoute>
        </Route>

        <Route path="/app/student/messages/new">
          <ProtectedRoute role="student" pageId="messages">
            <PortalMessagesPage role="student" mode="compose" />
          </ProtectedRoute>
        </Route>

        <Route path="/app/student/messages">
          <ProtectedRoute role="student" pageId="messages">
            <PortalMessagesPage role="student" />
          </ProtectedRoute>
        </Route>

        {/* Legacy prototype routes now land in the maintained /app platform. */}
        {[
          "/dashboard",
          "/students",
          "/classes",
          "/users",
          "/messages",
          "/payments",
          "/reports",
          "/schedule",
          "/profile",
          "/notifications",
          "/settings",
          "/student",
          "/student/courses",
          "/student/grades",
          "/student/attendance",
          "/student/schedule",
          "/teacher",
          "/teacher/classes",
          "/teacher/attendance",
          "/teacher/scores",
          "/teacher/schedule",
          "/registrar",
          "/registrar/register",
          "/registrar/pending",
          "/registrar/payments",
        ].map(path => (
          <Route key={path} path={path}>
            <LegacyRouteRedirect legacyPath={path} />
          </Route>
        ))}

        {/* Removed staff portals redirect into the unified staff app. */}
        {[
          "/app/admin",
          "/app/registrar",
          "/app/hod",
          "/app/branch",
          "/app/teacher",
        ].map(prefix => (
          <Fragment key={prefix}>
            <Route path={prefix}>
              <LegacyStaffRedirect />
            </Route>
            <Route path={`${prefix}/*`}>
              <LegacyStaffRedirect />
            </Route>
          </Fragment>
        ))}

        <Route path="/404" component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
