import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch } from "wouter";
import { Fragment, lazy, Suspense } from "react";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import ProtectedRoute from "./components/platform/ProtectedRoute";
import LegacyRouteRedirect from "./components/platform/LegacyRouteRedirect";
import { nileFormsCutoverEnabled } from "./lib/forms/cutover";
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
const PlatformBlueprintPage = lazy(
  () => import("./pages/platform/PlatformBlueprintPage")
);
const AdminUsersPage = lazy(() => import("./pages/platform/AdminUsersPage"));
const AdminUserDetailPage = lazy(
  () => import("./pages/platform/AdminUserDetailPage")
);
const AdminRolesPage = lazy(() => import("./pages/platform/AdminRolesPage"));
const AdminPermissionsPage = lazy(
  () => import("./pages/platform/AdminPermissionsPage")
);
const AdminSchedulePage = lazy(
  () => import("./pages/platform/AdminSchedulePage")
);
const AdminReportsPage = lazy(
  () => import("./pages/platform/AdminReportsPage")
);
const AdminCoursesPage = lazy(
  () => import("./pages/platform/AdminCoursesPage")
);
const AdminAuditLogsPage = lazy(
  () => import("./pages/platform/AdminAuditLogsPage")
);
const AdminSystemHealthPage = lazy(
  () => import("./pages/platform/AdminSystemHealthPage")
);
const AdminSettingsPage = lazy(
  () => import("./pages/platform/AdminSettingsPage")
);
const AdminIntegrationsPage = lazy(
  () => import("./pages/platform/AdminIntegrationsPage")
);
const AdminDirectoryPage = lazy(
  () => import("./pages/platform/AdminDirectoryPage")
);
const RegistrarStudentsPage = lazy(
  () => import("./pages/platform/RegistrarStudentsPage")
);
const RegistrarAdmissionsPage = lazy(
  () => import("./pages/platform/RegistrarAdmissionsPage")
);
const RegistrarEnrollmentsPage = lazy(
  () => import("./pages/platform/RegistrarEnrollmentsPage")
);
const RegistrarEnrollmentRecordsPage = lazy(
  () => import("./pages/platform/RegistrarEnrollmentRecordsPage")
);
const RegistrarPaymentsPage = lazy(
  () => import("./pages/platform/RegistrarPaymentsPage")
);
const RegistrarSchedulePage = lazy(
  () => import("./pages/platform/RegistrarSchedulePage")
);
const RegistrarClassesPage = lazy(
  () => import("./pages/platform/RegistrarClassesPage")
);
const BranchRoomsPage = lazy(() => import("./pages/platform/BranchRoomsPage"));
const BranchSchedulePage = lazy(
  () => import("./pages/platform/BranchSchedulePage")
);
const BranchSessionDetailPage = lazy(
  () => import("./pages/platform/BranchSessionDetailPage")
);
const BranchAttendancePage = lazy(
  () => import("./pages/platform/BranchAttendancePage")
);
const BranchPaymentsPage = lazy(
  () => import("./pages/platform/BranchPaymentsPage")
);
const BranchReportsPage = lazy(
  () => import("./pages/platform/BranchReportsPage")
);
const TeacherAssessmentPage = lazy(
  () => import("./pages/platform/TeacherAssessmentPage")
);
const TeacherWorkPage = lazy(() => import("./pages/platform/TeacherWorkPage"));
const TeacherClassesPage = lazy(
  () => import("./pages/platform/TeacherClassesPage")
);
const TeacherClassDetailPage = lazy(
  () => import("./pages/platform/TeacherClassDetailPage")
);
const TeacherClassWorkspacePage = lazy(
  () => import("./pages/platform/TeacherClassWorkspacePage")
);
const MoodleSourcePage = lazy(
  () => import("./pages/platform/MoodleSourcePage")
);
const MoodleCourseContentPage = lazy(
  () => import("./pages/platform/MoodleCourseContentPage")
);
const PortalReportsPage = lazy(
  () => import("./pages/platform/PortalReportsPage")
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
const PortalSettingsPage = lazy(
  () => import("./pages/platform/PortalSettingsPage")
);
const ProfileWorkspace = lazy(
  () => import("./pages/platform/ProfileWorkspace")
);
const BranchDirectoryPage = lazy(
  () => import("./pages/platform/BranchDirectoryPage")
);
const BranchClassCreatePage = lazy(
  () => import("./pages/platform/BranchClassCreatePage")
);
const BranchClassDetailPage = lazy(
  () => import("./pages/platform/BranchClassDetailPage")
);
const HodCourseRunCreatePage = lazy(
  () => import("./pages/platform/HodCourseRunCreatePage")
);
const HodDirectoryPage = lazy(
  () => import("./pages/platform/HodDirectoryPage")
);
const HodReportsPage = lazy(() => import("./pages/platform/HodReportsPage"));
const HodWorkflowPage = lazy(() => import("./pages/platform/HodWorkflowPage"));
const SimplePortalPage = lazy(
  () => import("./pages/platform/SimplePortalPage")
);
const NileFormsAssignedPage = lazy(
  () => import("./pages/platform/NileFormsAssignedPage")
);
const NileFormsManagePage = lazy(
  () => import("./pages/platform/NileFormsManagePage")
);
const NileFormsCreatePage = lazy(
  () => import("./pages/platform/NileFormsCreatePage")
);
const NileFormsBuilderPage = lazy(
  () => import("./pages/platform/NileFormsBuilderPage")
);
const NileFormsPublishPage = lazy(
  () => import("./pages/platform/NileFormsPublishPage")
);
const NileFormsPublicationsPage = lazy(
  () => import("./pages/platform/NileFormsPublicationsPage")
);
const NileFormsAssignmentsPage = lazy(
  () => import("./pages/platform/NileFormsAssignmentsPage")
);
const NileFormsReviewPage = lazy(
  () => import("./pages/platform/NileFormsReviewPage")
);
const NileFormsReviewDetailPage = lazy(
  () => import("./pages/platform/NileFormsReviewDetailPage")
);
const NileFormsResponsePage = lazy(
  () => import("./pages/platform/NileFormsResponsePage")
);
const NileFormsOfflinePage = lazy(
  () => import("./pages/platform/NileFormsOfflinePage")
);
const NileFormsMigrationPage = lazy(
  () => import("./pages/platform/NileFormsMigrationPage")
);
const NotFound = lazy(() => import("./pages/NotFound"));

const dashboardRoutes: { path: string; role: Role }[] = [
  { path: "/app/student/dashboard", role: "student" },
  { path: "/app/teacher/dashboard", role: "teacher" },
  { path: "/app/registrar/dashboard", role: "registrar" },
  { path: "/app/hod/dashboard", role: "headofdepartment" },
  { path: "/app/branch/dashboard", role: "branchadmin" },
  { path: "/app/admin/dashboard", role: "superadmin" },
];

const simplePortalRoutes: { path: string; role: Role; pageId: string }[] = [
  { path: "/app/admin/branches", role: "superadmin", pageId: "branches" },
];

const formsRoleRoutes: { prefix: string; role: Role; manage: boolean }[] = [
  { prefix: "/app/student", role: "student", manage: false },
  { prefix: "/app/teacher", role: "teacher", manage: false },
  { prefix: "/app/registrar", role: "registrar", manage: true },
  { prefix: "/app/hod", role: "headofdepartment", manage: true },
  { prefix: "/app/branch", role: "branchadmin", manage: true },
  { prefix: "/app/admin", role: "superadmin", manage: true },
];

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
        <Route path="/auth/select-role">
          <AuthFlowPage mode="select-role" />
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

        {dashboardRoutes.map(route => (
          <Route key={route.path} path={route.path}>
            <ProtectedRoute role={route.role} pageId="dashboard">
              <RoleDashboard role={route.role} />
            </ProtectedRoute>
          </Route>
        ))}

        {formsRoleRoutes.map(route => (
          <Fragment key={route.prefix}>
            {route.manage ? (
              <>
                <Route path={`${route.prefix}/forms/manage/new`}>
                  <ProtectedRoute role={route.role} pageId="forms-manage">
                    <NileFormsCreatePage role={route.role} />
                  </ProtectedRoute>
                </Route>
                <Route path={`${route.prefix}/forms/manage/:formId/builder`}>
                  {params => (
                    <ProtectedRoute role={route.role} pageId="form-builder">
                      <NileFormsBuilderPage
                        role={route.role}
                        formId={params.formId}
                      />
                    </ProtectedRoute>
                  )}
                </Route>
                <Route path={`${route.prefix}/forms/manage/:formId/publish`}>
                  {params => (
                    <ProtectedRoute role={route.role} pageId="form-publish">
                      <NileFormsPublishPage
                        role={route.role}
                        formId={params.formId}
                      />
                    </ProtectedRoute>
                  )}
                </Route>
                <Route
                  path={`${route.prefix}/forms/manage/:formId/publications/:publicationId/assignments`}
                >
                  {params => (
                    <ProtectedRoute role={route.role} pageId="form-assignments">
                      <NileFormsAssignmentsPage
                        role={route.role}
                        formId={params.formId}
                        publicationId={params.publicationId}
                      />
                    </ProtectedRoute>
                  )}
                </Route>
                <Route
                  path={`${route.prefix}/forms/manage/:formId/publications`}
                >
                  {params => (
                    <ProtectedRoute role={route.role} pageId="form-publish">
                      <NileFormsPublicationsPage
                        role={route.role}
                        formId={params.formId}
                      />
                    </ProtectedRoute>
                  )}
                </Route>
                <Route path={`${route.prefix}/forms/review/:submissionId`}>
                  {params => (
                    <ProtectedRoute role={route.role} pageId="form-submission">
                      <NileFormsReviewDetailPage
                        role={route.role}
                        submissionId={params.submissionId}
                      />
                    </ProtectedRoute>
                  )}
                </Route>
                <Route path={`${route.prefix}/forms/manage`}>
                  <ProtectedRoute role={route.role} pageId="forms-manage">
                    <NileFormsManagePage role={route.role} />
                  </ProtectedRoute>
                </Route>
                <Route path={`${route.prefix}/forms/review`}>
                  <ProtectedRoute role={route.role} pageId="forms-review">
                    <NileFormsReviewPage role={route.role} />
                  </ProtectedRoute>
                </Route>
                {route.role === "superadmin" ? (
                  <Route path={`${route.prefix}/forms/migration`}>
                    <ProtectedRoute role="superadmin" pageId="forms-manage">
                      <NileFormsMigrationPage />
                    </ProtectedRoute>
                  </Route>
                ) : null}
              </>
            ) : null}
            {route.role !== "student" ? (
              <Route path={`${route.prefix}/forms/offline`}>
                <ProtectedRoute role={route.role} pageId="forms">
                  <NileFormsOfflinePage role={route.role} />
                </ProtectedRoute>
              </Route>
            ) : null}
            <Route
              path={`${route.prefix}/forms/:publicationId/responses/:submissionId`}
            >
              {params => (
                <ProtectedRoute role={route.role} pageId="forms">
                  <NileFormsResponsePage
                    role={route.role}
                    publicationId={params.publicationId}
                    submissionId={params.submissionId}
                  />
                </ProtectedRoute>
              )}
            </Route>
            <Route path={`${route.prefix}/forms/:publicationId`}>
              {params => (
                <ProtectedRoute role={route.role} pageId="forms">
                  <NileFormsAssignedPage
                    role={route.role}
                    publicationId={params.publicationId}
                  />
                </ProtectedRoute>
              )}
            </Route>
            <Route path={`${route.prefix}/forms`}>
              <ProtectedRoute role={route.role} pageId="forms">
                <NileFormsAssignedPage role={route.role} />
              </ProtectedRoute>
            </Route>
          </Fragment>
        ))}

        <Route path="/app/admin/platform-blueprint">
          <ProtectedRoute role="superadmin" pageId="platform-blueprint">
            <PlatformBlueprintPage />
          </ProtectedRoute>
        </Route>

        <Route path="/app/registrar/students/new">
          <ProtectedRoute role="registrar" pageId="students">
            <RegistrarStudentsPage view="create" />
          </ProtectedRoute>
        </Route>

        <Route path="/app/registrar/students/:studentId">
          {params => (
            <ProtectedRoute role="registrar" pageId="student-detail">
              <RegistrarStudentsPage
                view="detail"
                studentId={params.studentId}
              />
            </ProtectedRoute>
          )}
        </Route>

        <Route path="/app/registrar/students">
          <ProtectedRoute role="registrar" pageId="students">
            <RegistrarStudentsPage view="list" />
          </ProtectedRoute>
        </Route>

        <Route path="/app/registrar/leads/new">
          <ProtectedRoute role="registrar" pageId="leads">
            <RegistrarAdmissionsPage view="lead-create" />
          </ProtectedRoute>
        </Route>

        <Route path="/app/registrar/leads/:leadId">
          {params => (
            <ProtectedRoute role="registrar" pageId="leads">
              <RegistrarAdmissionsPage
                view="lead-detail"
                leadId={params.leadId}
              />
            </ProtectedRoute>
          )}
        </Route>

        <Route path="/app/registrar/leads">
          <ProtectedRoute role="registrar" pageId="leads">
            <RegistrarAdmissionsPage view="leads" />
          </ProtectedRoute>
        </Route>

        <Route path="/app/registrar/applications/new">
          <ProtectedRoute role="registrar" pageId="applications">
            <RegistrarAdmissionsPage view="application-create" />
          </ProtectedRoute>
        </Route>

        <Route path="/app/registrar/applications/:applicationId/placement">
          {params => (
            <ProtectedRoute role="registrar" pageId="placement-tests">
              <RegistrarAdmissionsPage
                view="placement-create"
                applicationId={params.applicationId}
              />
            </ProtectedRoute>
          )}
        </Route>

        <Route path="/app/registrar/applications/:applicationId">
          {params => (
            <ProtectedRoute role="registrar" pageId="applications">
              <RegistrarAdmissionsPage
                view="application-detail"
                applicationId={params.applicationId}
              />
            </ProtectedRoute>
          )}
        </Route>

        <Route path="/app/registrar/applications">
          <ProtectedRoute role="registrar" pageId="applications">
            <RegistrarAdmissionsPage view="applications" />
          </ProtectedRoute>
        </Route>

        <Route path="/app/registrar/placement-tests/new">
          <ProtectedRoute role="registrar" pageId="placement-tests">
            <RegistrarAdmissionsPage view="placement-create" />
          </ProtectedRoute>
        </Route>

        <Route path="/app/registrar/placement-tests/:bookingId">
          {params => (
            <ProtectedRoute role="registrar" pageId="placement-tests">
              <RegistrarAdmissionsPage
                view="placement-detail"
                bookingId={params.bookingId}
              />
            </ProtectedRoute>
          )}
        </Route>

        <Route path="/app/registrar/placement-tests">
          <ProtectedRoute role="registrar" pageId="placement-tests">
            <RegistrarAdmissionsPage view="placement-tests" />
          </ProtectedRoute>
        </Route>

        <Route path="/app/registrar/enrollments/records/:enrollmentId">
          {params => (
            <ProtectedRoute role="registrar" pageId="enrollments">
              <RegistrarEnrollmentRecordsPage
                enrollmentId={params.enrollmentId}
              />
            </ProtectedRoute>
          )}
        </Route>

        <Route path="/app/registrar/enrollments/records">
          <ProtectedRoute role="registrar" pageId="enrollments">
            <RegistrarEnrollmentRecordsPage />
          </ProtectedRoute>
        </Route>

        <Route path="/app/registrar/enrollments/:workflowId">
          {params => (
            <ProtectedRoute role="registrar" pageId="enrollments">
              <RegistrarEnrollmentsPage workflowId={params.workflowId} />
            </ProtectedRoute>
          )}
        </Route>

        <Route path="/app/registrar/enrollments">
          <ProtectedRoute role="registrar" pageId="enrollments">
            <RegistrarEnrollmentsPage />
          </ProtectedRoute>
        </Route>

        <Route path="/app/registrar/payments/:invoiceId">
          {params => (
            <ProtectedRoute role="registrar" pageId="payments">
              <RegistrarPaymentsPage invoiceId={params.invoiceId} />
            </ProtectedRoute>
          )}
        </Route>

        <Route path="/app/registrar/payments">
          <ProtectedRoute role="registrar" pageId="payments">
            <RegistrarPaymentsPage />
          </ProtectedRoute>
        </Route>

        <Route path="/app/registrar/schedule/new">
          <ProtectedRoute role="registrar" pageId="schedule">
            <RegistrarSchedulePage view="create" />
          </ProtectedRoute>
        </Route>

        <Route path="/app/registrar/schedule">
          <ProtectedRoute role="registrar" pageId="schedule">
            <RegistrarSchedulePage />
          </ProtectedRoute>
        </Route>

        <Route path="/app/registrar/classes">
          <ProtectedRoute role="registrar" pageId="classes">
            <RegistrarClassesPage />
          </ProtectedRoute>
        </Route>

        <Route path="/app/admin/users/new">
          <ProtectedRoute role="superadmin" pageId="users">
            <AdminUsersPage mode="create" />
          </ProtectedRoute>
        </Route>

        <Route path="/app/admin/users/:userId/access">
          {params => (
            <ProtectedRoute role="superadmin" pageId="user-detail">
              <AdminUserDetailPage userId={params.userId} view="access" />
            </ProtectedRoute>
          )}
        </Route>

        <Route path="/app/admin/users/:userId/activity">
          {params => (
            <ProtectedRoute role="superadmin" pageId="user-detail">
              <AdminUserDetailPage userId={params.userId} view="activity" />
            </ProtectedRoute>
          )}
        </Route>

        <Route path="/app/admin/users/:userId/related">
          {params => (
            <ProtectedRoute role="superadmin" pageId="user-detail">
              <AdminUserDetailPage userId={params.userId} view="related" />
            </ProtectedRoute>
          )}
        </Route>

        <Route path="/app/admin/users/:userId/assignment">
          {params => (
            <ProtectedRoute role="superadmin" pageId="user-detail">
              <AdminUserDetailPage userId={params.userId} view="assignment" />
            </ProtectedRoute>
          )}
        </Route>

        <Route path="/app/admin/users/:userId">
          {params => (
            <ProtectedRoute role="superadmin" pageId="user-detail">
              <AdminUserDetailPage userId={params.userId} />
            </ProtectedRoute>
          )}
        </Route>

        <Route path="/app/admin/users">
          <ProtectedRoute role="superadmin" pageId="users">
            <AdminUsersPage />
          </ProtectedRoute>
        </Route>

        <Route path="/app/admin/roles">
          <ProtectedRoute role="superadmin" pageId="roles">
            <AdminRolesPage />
          </ProtectedRoute>
        </Route>

        <Route path="/app/admin/permissions">
          <ProtectedRoute role="superadmin" pageId="permissions">
            <AdminPermissionsPage />
          </ProtectedRoute>
        </Route>

        <Route path="/app/admin/departments">
          <ProtectedRoute role="superadmin" pageId="departments">
            <AdminDirectoryPage view="departments" />
          </ProtectedRoute>
        </Route>

        <Route path="/app/admin/programs">
          <ProtectedRoute role="superadmin" pageId="programs">
            <AdminDirectoryPage view="programs" />
          </ProtectedRoute>
        </Route>

        <Route path="/app/admin/certificates">
          <ProtectedRoute role="superadmin" pageId="certificates">
            <AdminDirectoryPage view="certificates" />
          </ProtectedRoute>
        </Route>

        <Route path="/app/admin/schedule/conflicts">
          <ProtectedRoute role="superadmin" pageId="schedule">
            <AdminSchedulePage view="conflicts" />
          </ProtectedRoute>
        </Route>

        <Route path="/app/admin/schedule/sessions">
          <ProtectedRoute role="superadmin" pageId="schedule">
            <AdminSchedulePage view="sessions" />
          </ProtectedRoute>
        </Route>

        <Route path="/app/admin/schedule/rooms">
          <ProtectedRoute role="superadmin" pageId="schedule">
            <AdminSchedulePage view="rooms" />
          </ProtectedRoute>
        </Route>

        <Route path="/app/admin/schedule/activity">
          <ProtectedRoute role="superadmin" pageId="schedule">
            <AdminSchedulePage view="activity" />
          </ProtectedRoute>
        </Route>

        <Route path="/app/admin/schedule/calendar">
          <ProtectedRoute role="superadmin" pageId="schedule">
            <AdminSchedulePage view="calendar" />
          </ProtectedRoute>
        </Route>

        <Route path="/app/admin/schedule">
          <ProtectedRoute role="superadmin" pageId="schedule">
            <AdminSchedulePage view="calendar" />
          </ProtectedRoute>
        </Route>

        <Route path="/app/admin/reports/attendance">
          <ProtectedRoute role="superadmin" pageId="reports">
            <AdminReportsPage view="attendance" />
          </ProtectedRoute>
        </Route>

        <Route path="/app/admin/reports/finance">
          <ProtectedRoute role="superadmin" pageId="reports">
            <AdminReportsPage view="finance" />
          </ProtectedRoute>
        </Route>

        <Route path="/app/admin/reports/certificates">
          <ProtectedRoute role="superadmin" pageId="reports">
            <AdminReportsPage view="certificates" />
          </ProtectedRoute>
        </Route>

        <Route path="/app/admin/reports/admissions">
          <ProtectedRoute role="superadmin" pageId="reports">
            <AdminReportsPage view="admissions" />
          </ProtectedRoute>
        </Route>

        <Route path="/app/admin/reports/classes">
          <ProtectedRoute role="superadmin" pageId="reports">
            <AdminReportsPage view="classes" />
          </ProtectedRoute>
        </Route>

        <Route path="/app/admin/reports/saved-views">
          <ProtectedRoute role="superadmin" pageId="reports">
            <AdminReportsPage view="saved-views" />
          </ProtectedRoute>
        </Route>

        <Route path="/app/admin/reports">
          <ProtectedRoute role="superadmin" pageId="reports">
            <AdminReportsPage view="overview" />
          </ProtectedRoute>
        </Route>

        <Route path="/app/admin/courses/programs">
          <ProtectedRoute role="superadmin" pageId="courses">
            <AdminCoursesPage view="programs" />
          </ProtectedRoute>
        </Route>

        <Route path="/app/admin/courses/levels">
          <ProtectedRoute role="superadmin" pageId="courses">
            <AdminCoursesPage view="levels" />
          </ProtectedRoute>
        </Route>

        <Route path="/app/admin/courses/curriculum">
          <ProtectedRoute role="superadmin" pageId="courses">
            <AdminCoursesPage view="curriculum" />
          </ProtectedRoute>
        </Route>

        <Route path="/app/admin/courses/teachers">
          <ProtectedRoute role="superadmin" pageId="courses">
            <AdminCoursesPage view="teachers" />
          </ProtectedRoute>
        </Route>

        <Route path="/app/admin/courses/resources">
          <ProtectedRoute role="superadmin" pageId="courses">
            <AdminCoursesPage view="resources" />
          </ProtectedRoute>
        </Route>

        <Route path="/app/admin/courses/:courseId">
          {params => (
            <ProtectedRoute role="superadmin" pageId="courses">
              <AdminCoursesPage view="detail" courseId={params.courseId} />
            </ProtectedRoute>
          )}
        </Route>

        <Route path="/app/admin/courses">
          <ProtectedRoute role="superadmin" pageId="courses">
            <AdminCoursesPage view="catalog" />
          </ProtectedRoute>
        </Route>

        <Route path="/app/admin/audit-logs">
          <ProtectedRoute role="superadmin" pageId="audit-logs">
            <AdminAuditLogsPage />
          </ProtectedRoute>
        </Route>

        <Route path="/app/admin/system-health">
          <ProtectedRoute role="superadmin" pageId="system-health">
            <AdminSystemHealthPage />
          </ProtectedRoute>
        </Route>

        <Route path="/app/admin/settings">
          <ProtectedRoute role="superadmin" pageId="settings">
            <AdminSettingsPage />
          </ProtectedRoute>
        </Route>

        <Route path="/app/admin/integrations">
          <ProtectedRoute role="superadmin" pageId="integrations">
            <AdminIntegrationsPage />
          </ProtectedRoute>
        </Route>

        <Route path="/app/branch/rooms/new">
          <ProtectedRoute role="branchadmin" pageId="rooms">
            <BranchRoomsPage view="create" />
          </ProtectedRoute>
        </Route>

        <Route path="/app/branch/rooms">
          <ProtectedRoute role="branchadmin" pageId="rooms">
            <BranchRoomsPage />
          </ProtectedRoute>
        </Route>

        <Route path="/app/branch/schedule/new">
          <ProtectedRoute role="branchadmin" pageId="schedule">
            <BranchSchedulePage view="create" />
          </ProtectedRoute>
        </Route>

        <Route path="/app/branch/schedule/sessions/:sessionId">
          {params => (
            <ProtectedRoute role="branchadmin" pageId="schedule">
              <BranchSessionDetailPage sessionId={params.sessionId} />
            </ProtectedRoute>
          )}
        </Route>

        <Route path="/app/branch/schedule">
          <ProtectedRoute role="branchadmin" pageId="schedule">
            <BranchSchedulePage />
          </ProtectedRoute>
        </Route>

        <Route path="/app/branch/attendance">
          <ProtectedRoute role="branchadmin" pageId="attendance">
            <BranchAttendancePage />
          </ProtectedRoute>
        </Route>

        <Route path="/app/branch/payments/:invoiceId">
          {params => (
            <ProtectedRoute role="branchadmin" pageId="payments">
              <BranchPaymentsPage invoiceId={params.invoiceId} />
            </ProtectedRoute>
          )}
        </Route>

        <Route path="/app/branch/payments">
          <ProtectedRoute role="branchadmin" pageId="payments">
            <BranchPaymentsPage />
          </ProtectedRoute>
        </Route>

        <Route path="/app/branch/reports">
          <ProtectedRoute role="branchadmin" pageId="reports">
            <BranchReportsPage />
          </ProtectedRoute>
        </Route>

        <Route path="/app/branch/students">
          <ProtectedRoute role="branchadmin" pageId="students">
            <BranchDirectoryPage view="students" />
          </ProtectedRoute>
        </Route>

        <Route path="/app/branch/teachers">
          <ProtectedRoute role="branchadmin" pageId="teachers">
            <BranchDirectoryPage view="teachers" />
          </ProtectedRoute>
        </Route>

        <Route path="/app/branch/classes">
          <ProtectedRoute role="branchadmin" pageId="classes">
            <BranchDirectoryPage view="classes" />
          </ProtectedRoute>
        </Route>

        <Route path="/app/branch/classes/new">
          <ProtectedRoute role="branchadmin" pageId="classes">
            <BranchClassCreatePage />
          </ProtectedRoute>
        </Route>

        <Route path="/app/branch/classes/:classGroupId">
          <ProtectedRoute role="branchadmin" pageId="classes">
            <BranchClassDetailPage />
          </ProtectedRoute>
        </Route>

        <Route path="/app/hod/departments">
          <ProtectedRoute role="headofdepartment" pageId="departments">
            <HodDirectoryPage view="departments" />
          </ProtectedRoute>
        </Route>

        <Route path="/app/hod/programs">
          <ProtectedRoute role="headofdepartment" pageId="programs">
            <HodDirectoryPage view="programs" />
          </ProtectedRoute>
        </Route>

        <Route path="/app/hod/levels">
          <ProtectedRoute role="headofdepartment" pageId="levels">
            <HodDirectoryPage view="levels" />
          </ProtectedRoute>
        </Route>

        <Route path="/app/hod/teachers">
          <ProtectedRoute role="headofdepartment" pageId="teachers">
            <HodDirectoryPage view="teachers" />
          </ProtectedRoute>
        </Route>

        <Route path="/app/hod/classes">
          <ProtectedRoute role="headofdepartment" pageId="classes">
            <HodDirectoryPage view="classes" />
          </ProtectedRoute>
        </Route>

        <Route path="/app/hod/classes/runs/new">
          <ProtectedRoute role="headofdepartment" pageId="classes">
            <HodCourseRunCreatePage />
          </ProtectedRoute>
        </Route>

        <Route path="/app/hod/courses/:courseId">
          {params => (
            <ProtectedRoute role="headofdepartment" pageId="courses">
              <HodWorkflowPage
                pageId="courses"
                mode="course-detail"
                courseId={params.courseId}
              />
            </ProtectedRoute>
          )}
        </Route>

        <Route path="/app/hod/courses">
          <ProtectedRoute role="headofdepartment" pageId="courses">
            <HodWorkflowPage pageId="courses" />
          </ProtectedRoute>
        </Route>

        <Route path="/app/hod/curriculum/new">
          <ProtectedRoute role="headofdepartment" pageId="curriculum">
            <HodWorkflowPage pageId="curriculum" mode="create" />
          </ProtectedRoute>
        </Route>

        <Route path="/app/hod/curriculum">
          <ProtectedRoute role="headofdepartment" pageId="curriculum">
            <HodWorkflowPage pageId="curriculum" />
          </ProtectedRoute>
        </Route>

        <Route path="/app/hod/schedule/sessions">
          <ProtectedRoute role="headofdepartment" pageId="schedule">
            <HodWorkflowPage pageId="schedule" mode="sessions" />
          </ProtectedRoute>
        </Route>

        <Route path="/app/hod/schedule">
          <ProtectedRoute role="headofdepartment" pageId="schedule">
            <HodWorkflowPage pageId="schedule" />
          </ProtectedRoute>
        </Route>

        <Route path="/app/hod/assessments/new">
          <ProtectedRoute role="headofdepartment" pageId="assessments">
            <HodWorkflowPage pageId="assessments" mode="create" />
          </ProtectedRoute>
        </Route>

        <Route path="/app/hod/assessments/review/:submissionId">
          {params => (
            <ProtectedRoute role="headofdepartment" pageId="assessments">
              <HodWorkflowPage
                pageId="assessments"
                mode="review-detail"
                reviewSubmissionId={params.submissionId}
              />
            </ProtectedRoute>
          )}
        </Route>

        <Route path="/app/hod/assessments/review">
          <ProtectedRoute role="headofdepartment" pageId="assessments">
            <HodWorkflowPage pageId="assessments" mode="review" />
          </ProtectedRoute>
        </Route>

        <Route path="/app/hod/assessments">
          <ProtectedRoute role="headofdepartment" pageId="assessments">
            <HodWorkflowPage pageId="assessments" />
          </ProtectedRoute>
        </Route>

        <Route path="/app/hod/certificates/:certificateId">
          {params => (
            <ProtectedRoute role="headofdepartment" pageId="certificates">
              <HodWorkflowPage
                pageId="certificates"
                mode="certificate-detail"
                certificateId={params.certificateId}
              />
            </ProtectedRoute>
          )}
        </Route>

        <Route path="/app/hod/certificates">
          <ProtectedRoute role="headofdepartment" pageId="certificates">
            <HodWorkflowPage pageId="certificates" />
          </ProtectedRoute>
        </Route>

        <Route path="/app/hod/reports">
          <ProtectedRoute role="headofdepartment" pageId="reports">
            <HodReportsPage />
          </ProtectedRoute>
        </Route>

        <Route path="/app/teacher/quizzes/new">
          <ProtectedRoute role="teacher" pageId="quizzes">
            <TeacherAssessmentPage view="new-quiz" />
          </ProtectedRoute>
        </Route>

        <Route path="/app/teacher/quizzes/review/:attemptId">
          {params => (
            <ProtectedRoute role="teacher" pageId="quizzes">
              <TeacherAssessmentPage
                view="review-detail"
                reviewAttemptId={params.attemptId}
              />
            </ProtectedRoute>
          )}
        </Route>

        <Route path="/app/teacher/quizzes/review">
          <ProtectedRoute role="teacher" pageId="quizzes">
            <TeacherAssessmentPage view="review" />
          </ProtectedRoute>
        </Route>

        <Route path="/app/teacher/quizzes/:quizId">
          {params => (
            <ProtectedRoute role="teacher" pageId="quizzes">
              <TeacherAssessmentPage
                view="quiz-detail"
                quizId={params.quizId}
              />
            </ProtectedRoute>
          )}
        </Route>

        <Route path="/app/teacher/quizzes">
          <ProtectedRoute role="teacher" pageId="quizzes">
            <TeacherAssessmentPage view="quizzes" />
          </ProtectedRoute>
        </Route>

        <Route path="/app/teacher/question-bank/new">
          <ProtectedRoute role="teacher" pageId="question-bank">
            <TeacherAssessmentPage view="new-question" />
          </ProtectedRoute>
        </Route>

        <Route path="/app/teacher/question-bank">
          <ProtectedRoute role="teacher" pageId="question-bank">
            <TeacherAssessmentPage view="question-bank" />
          </ProtectedRoute>
        </Route>

        <Route path="/app/teacher/assignments/new">
          <ProtectedRoute role="teacher" pageId="assignments">
            <TeacherWorkPage view="new-assignment" />
          </ProtectedRoute>
        </Route>

        <Route path="/app/teacher/assignments/:assignmentId">
          {params => (
            <ProtectedRoute role="teacher" pageId="assignment-detail">
              <TeacherWorkPage
                view="assignment-detail"
                assignmentId={params.assignmentId}
              />
            </ProtectedRoute>
          )}
        </Route>

        <Route path="/app/teacher/assignments">
          <ProtectedRoute role="teacher" pageId="assignments">
            <TeacherWorkPage view="assignments" />
          </ProtectedRoute>
        </Route>

        <Route path="/app/teacher/grading/:submissionId">
          {params => (
            <ProtectedRoute role="teacher" pageId="grading">
              <TeacherWorkPage
                view="grading-detail"
                submissionId={params.submissionId}
              />
            </ProtectedRoute>
          )}
        </Route>

        <Route path="/app/teacher/grading">
          <ProtectedRoute role="teacher" pageId="grading">
            <TeacherWorkPage view="grading" />
          </ProtectedRoute>
        </Route>

        <Route path="/app/teacher/calendar/new">
          <ProtectedRoute role="teacher" pageId="calendar">
            <TeacherWorkPage view="calendar-new" />
          </ProtectedRoute>
        </Route>

        <Route path="/app/teacher/calendar">
          <ProtectedRoute role="teacher" pageId="calendar">
            <TeacherWorkPage view="calendar" />
          </ProtectedRoute>
        </Route>

        <Route path="/app/teacher/quran-review/:recitationId">
          {params => (
            <ProtectedRoute role="teacher" pageId="quran-review">
              <TeacherWorkPage
                view="quran-detail"
                recitationId={params.recitationId}
              />
            </ProtectedRoute>
          )}
        </Route>

        <Route path="/app/teacher/quran-review">
          <ProtectedRoute role="teacher" pageId="quran-review">
            <TeacherWorkPage view="quran" />
          </ProtectedRoute>
        </Route>

        <Route path="/app/teacher/classes">
          <ProtectedRoute role="teacher" pageId="classes">
            <TeacherClassesPage />
          </ProtectedRoute>
        </Route>

        <Route path="/app/teacher/classes/:classId">
          {params => (
            <ProtectedRoute role="teacher" pageId="class-detail">
              <TeacherClassDetailPage classId={params.classId} />
            </ProtectedRoute>
          )}
        </Route>

        <Route path="/app/teacher/classes/:classId/sessions">
          {params => (
            <ProtectedRoute role="teacher" pageId="sessions">
              <TeacherClassWorkspacePage
                classId={params.classId}
                view="sessions"
              />
            </ProtectedRoute>
          )}
        </Route>

        <Route path="/app/teacher/classes/:classId/attendance">
          {params => (
            <ProtectedRoute role="teacher" pageId="attendance">
              <TeacherClassWorkspacePage
                classId={params.classId}
                view="attendance"
              />
            </ProtectedRoute>
          )}
        </Route>

        <Route path="/app/teacher/classes/:classId/students">
          {params => (
            <ProtectedRoute role="teacher" pageId="students">
              <TeacherClassWorkspacePage
                classId={params.classId}
                view="students"
              />
            </ProtectedRoute>
          )}
        </Route>

        <Route path="/app/teacher/classes/:classId/materials">
          {params => (
            <ProtectedRoute role="teacher" pageId="materials">
              <TeacherClassWorkspacePage
                classId={params.classId}
                view="materials"
              />
            </ProtectedRoute>
          )}
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

        <Route path="/app/teacher/moodle-source/:courseId">
          {params => (
            <ProtectedRoute role="teacher" pageId="moodle-source">
              <MoodleCourseContentPage
                role="teacher"
                courseId={params.courseId}
              />
            </ProtectedRoute>
          )}
        </Route>

        <Route path="/app/teacher/moodle-source">
          <ProtectedRoute role="teacher" pageId="moodle-source">
            <MoodleSourcePage role="teacher" />
          </ProtectedRoute>
        </Route>

        <Route path="/app/hod/moodle-source/:courseId">
          {params => (
            <ProtectedRoute role="headofdepartment" pageId="moodle-source">
              <MoodleCourseContentPage
                role="headofdepartment"
                courseId={params.courseId}
              />
            </ProtectedRoute>
          )}
        </Route>

        <Route path="/app/hod/moodle-source">
          <ProtectedRoute role="headofdepartment" pageId="moodle-source">
            <MoodleSourcePage role="headofdepartment" />
          </ProtectedRoute>
        </Route>

        <Route path="/app/admin/moodle-source/:courseId">
          {params => (
            <ProtectedRoute role="superadmin" pageId="moodle-source">
              <MoodleCourseContentPage
                role="superadmin"
                courseId={params.courseId}
              />
            </ProtectedRoute>
          )}
        </Route>

        <Route path="/app/admin/moodle-source">
          <ProtectedRoute role="superadmin" pageId="moodle-source">
            <MoodleSourcePage role="superadmin" />
          </ProtectedRoute>
        </Route>

        <Route path="/app/student/profile">
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

        <Route path="/app/teacher/profile">
          <ProtectedRoute role="teacher" pageId="profile">
            <ProfileWorkspace role="teacher" />
          </ProtectedRoute>
        </Route>

        <Route path="/app/registrar/profile">
          <ProtectedRoute role="registrar" pageId="profile">
            <ProfileWorkspace role="registrar" />
          </ProtectedRoute>
        </Route>

        <Route path="/app/hod/profile">
          <ProtectedRoute role="headofdepartment" pageId="profile">
            <ProfileWorkspace role="headofdepartment" />
          </ProtectedRoute>
        </Route>

        <Route path="/app/branch/profile">
          <ProtectedRoute role="branchadmin" pageId="profile">
            <ProfileWorkspace role="branchadmin" />
          </ProtectedRoute>
        </Route>

        <Route path="/app/admin/profile">
          <ProtectedRoute role="superadmin" pageId="profile">
            <ProfileWorkspace role="superadmin" />
          </ProtectedRoute>
        </Route>

        <Route path="/app/teacher/reports/attendance">
          <ProtectedRoute role="teacher" pageId="reports">
            <PortalReportsPage role="teacher" view="attendance" />
          </ProtectedRoute>
        </Route>

        <Route path="/app/teacher/reports/grades">
          <ProtectedRoute role="teacher" pageId="reports">
            <PortalReportsPage role="teacher" view="grades" />
          </ProtectedRoute>
        </Route>

        <Route path="/app/teacher/reports">
          <ProtectedRoute role="teacher" pageId="reports">
            <PortalReportsPage role="teacher" view="overview" />
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

        <Route path="/app/teacher/messages/new">
          <ProtectedRoute role="teacher" pageId="messages">
            <PortalMessagesPage role="teacher" mode="compose" />
          </ProtectedRoute>
        </Route>

        <Route path="/app/teacher/messages">
          <ProtectedRoute role="teacher" pageId="messages">
            <PortalMessagesPage role="teacher" />
          </ProtectedRoute>
        </Route>

        <Route path="/app/registrar/messages/new">
          <ProtectedRoute role="registrar" pageId="messages">
            <PortalMessagesPage role="registrar" mode="compose" />
          </ProtectedRoute>
        </Route>

        <Route path="/app/registrar/messages">
          <ProtectedRoute role="registrar" pageId="messages">
            <PortalMessagesPage role="registrar" />
          </ProtectedRoute>
        </Route>

        <Route path="/app/hod/messages/new">
          <ProtectedRoute role="headofdepartment" pageId="messages">
            <PortalMessagesPage role="headofdepartment" mode="compose" />
          </ProtectedRoute>
        </Route>

        <Route path="/app/hod/messages">
          <ProtectedRoute role="headofdepartment" pageId="messages">
            <PortalMessagesPage role="headofdepartment" />
          </ProtectedRoute>
        </Route>

        <Route path="/app/branch/messages/new">
          <ProtectedRoute role="branchadmin" pageId="messages">
            <PortalMessagesPage role="branchadmin" mode="compose" />
          </ProtectedRoute>
        </Route>

        <Route path="/app/branch/messages">
          <ProtectedRoute role="branchadmin" pageId="messages">
            <PortalMessagesPage role="branchadmin" />
          </ProtectedRoute>
        </Route>

        <Route path="/app/admin/messages/new">
          <ProtectedRoute role="superadmin" pageId="messages">
            <PortalMessagesPage role="superadmin" mode="compose" />
          </ProtectedRoute>
        </Route>

        <Route path="/app/admin/messages">
          <ProtectedRoute role="superadmin" pageId="messages">
            <PortalMessagesPage role="superadmin" />
          </ProtectedRoute>
        </Route>

        <Route path="/app/registrar/reports/admissions">
          <ProtectedRoute role="registrar" pageId="reports">
            <PortalReportsPage role="registrar" view="admissions" />
          </ProtectedRoute>
        </Route>

        <Route path="/app/registrar/reports/payments">
          <ProtectedRoute role="registrar" pageId="reports">
            <PortalReportsPage role="registrar" view="payments" />
          </ProtectedRoute>
        </Route>

        <Route path="/app/registrar/reports">
          <ProtectedRoute role="registrar" pageId="reports">
            <PortalReportsPage role="registrar" view="overview" />
          </ProtectedRoute>
        </Route>

        <Route path="/app/registrar/settings">
          <ProtectedRoute role="registrar" pageId="settings">
            <PortalSettingsPage role="registrar" />
          </ProtectedRoute>
        </Route>

        <Route path="/app/hod/settings">
          <ProtectedRoute role="headofdepartment" pageId="settings">
            <PortalSettingsPage role="headofdepartment" />
          </ProtectedRoute>
        </Route>

        <Route path="/app/branch/settings">
          <ProtectedRoute role="branchadmin" pageId="settings">
            <PortalSettingsPage role="branchadmin" />
          </ProtectedRoute>
        </Route>

        {simplePortalRoutes.map(route => (
          <Route key={route.path} path={route.path}>
            <ProtectedRoute role={route.role} pageId={route.pageId}>
              <SimplePortalPage role={route.role} pageId={route.pageId} />
            </ProtectedRoute>
          </Route>
        ))}

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
