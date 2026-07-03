import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch } from "wouter";
import { lazy, Suspense } from "react";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import ProtectedRoute from "./components/platform/ProtectedRoute";
import LegacyRouteRedirect from "./components/platform/LegacyRouteRedirect";
import type { Role } from "./lib/platformData";

// Public
const Home = lazy(() => import("./pages/Home"));
const Login = lazy(() => import("./pages/Login"));
const PublicSitePage = lazy(() => import("./pages/public/PublicSitePage"));
const RoleDashboard = lazy(() => import("./pages/platform/RoleDashboard"));
const AuthFlowPage = lazy(() => import("./pages/platform/AuthFlowPage"));
const PlatformBlueprintPage = lazy(() => import("./pages/platform/PlatformBlueprintPage"));
const FeaturePage = lazy(() => import("./components/platform/FeaturePage"));
const NotFound = lazy(() => import("./pages/NotFound"));

const dashboardRoutes: { path: string; role: Role }[] = [
  { path: "/app/student/dashboard", role: "student" },
  { path: "/app/teacher/dashboard", role: "teacher" },
  { path: "/app/registrar/dashboard", role: "registrar" },
  { path: "/app/hod/dashboard", role: "headofdepartment" },
  { path: "/app/branch/dashboard", role: "branchadmin" },
  { path: "/app/admin/dashboard", role: "superadmin" },
];

const featureRoutes: { path: string; role: Role; pageId: string }[] = [
  { path: "/app/student/courses/:courseId/learn/:lessonId", role: "student", pageId: "lesson" },
  { path: "/app/student/courses/:courseId/live", role: "student", pageId: "live" },
  { path: "/app/student/courses/:courseId", role: "student", pageId: "course-detail" },
  { path: "/app/student/assignments/:assignmentId", role: "student", pageId: "assignment-detail" },
  { path: "/app/student/quizzes/:quizId", role: "student", pageId: "quiz-detail" },
  { path: "/app/student/courses", role: "student", pageId: "courses" },
  { path: "/app/student/moodle-source", role: "student", pageId: "moodle-source" },
  { path: "/app/student/assignments", role: "student", pageId: "assignments" },
  { path: "/app/student/quizzes", role: "student", pageId: "quizzes" },
  { path: "/app/student/grades", role: "student", pageId: "grades" },
  { path: "/app/student/attendance", role: "student", pageId: "attendance" },
  { path: "/app/student/calendar", role: "student", pageId: "calendar" },
  { path: "/app/student/messages", role: "student", pageId: "messages" },
  { path: "/app/student/certificates", role: "student", pageId: "certificates" },
  { path: "/app/student/reports", role: "student", pageId: "reports" },
  { path: "/app/student/support", role: "student", pageId: "support" },
  { path: "/app/student/profile", role: "student", pageId: "profile" },
  { path: "/app/student/quran-progress", role: "student", pageId: "quran-progress" },

  { path: "/app/teacher/classes/:classId/sessions", role: "teacher", pageId: "sessions" },
  { path: "/app/teacher/classes/:classId/attendance", role: "teacher", pageId: "attendance" },
  { path: "/app/teacher/classes/:classId/students", role: "teacher", pageId: "students" },
  { path: "/app/teacher/classes/:classId/materials", role: "teacher", pageId: "materials" },
  { path: "/app/teacher/classes/:classId", role: "teacher", pageId: "class-detail" },
  { path: "/app/teacher/assignments/:assignmentId", role: "teacher", pageId: "assignment-detail" },
  { path: "/app/teacher/classes", role: "teacher", pageId: "classes" },
  { path: "/app/teacher/moodle-source", role: "teacher", pageId: "moodle-source" },
  { path: "/app/teacher/assignments", role: "teacher", pageId: "assignments" },
  { path: "/app/teacher/grading", role: "teacher", pageId: "grading" },
  { path: "/app/teacher/quizzes", role: "teacher", pageId: "quizzes" },
  { path: "/app/teacher/question-bank", role: "teacher", pageId: "question-bank" },
  { path: "/app/teacher/calendar", role: "teacher", pageId: "calendar" },
  { path: "/app/teacher/messages", role: "teacher", pageId: "messages" },
  { path: "/app/teacher/reports", role: "teacher", pageId: "reports" },
  { path: "/app/teacher/profile", role: "teacher", pageId: "profile" },
  { path: "/app/teacher/quran-review", role: "teacher", pageId: "quran-review" },

  { path: "/app/registrar/leads/:leadId", role: "registrar", pageId: "lead-detail" },
  { path: "/app/registrar/students/:studentId", role: "registrar", pageId: "student-detail" },
  { path: "/app/registrar/placement-tests/:bookingId", role: "registrar", pageId: "placement-detail" },
  { path: "/app/registrar/leads", role: "registrar", pageId: "leads" },
  { path: "/app/registrar/applications", role: "registrar", pageId: "applications" },
  { path: "/app/registrar/students", role: "registrar", pageId: "students" },
  { path: "/app/registrar/placement-tests", role: "registrar", pageId: "placement-tests" },
  { path: "/app/registrar/enrollments", role: "registrar", pageId: "enrollments" },
  { path: "/app/registrar/classes", role: "registrar", pageId: "classes" },
  { path: "/app/registrar/schedule", role: "registrar", pageId: "schedule" },
  { path: "/app/registrar/payments", role: "registrar", pageId: "payments" },
  { path: "/app/registrar/messages", role: "registrar", pageId: "messages" },
  { path: "/app/registrar/reports", role: "registrar", pageId: "reports" },
  { path: "/app/registrar/settings", role: "registrar", pageId: "settings" },

  { path: "/app/hod/departments", role: "headofdepartment", pageId: "departments" },
  { path: "/app/hod/programs", role: "headofdepartment", pageId: "programs" },
  { path: "/app/hod/courses", role: "headofdepartment", pageId: "courses" },
  { path: "/app/hod/moodle-source", role: "headofdepartment", pageId: "moodle-source" },
  { path: "/app/hod/levels", role: "headofdepartment", pageId: "levels" },
  { path: "/app/hod/curriculum", role: "headofdepartment", pageId: "curriculum" },
  { path: "/app/hod/teachers", role: "headofdepartment", pageId: "teachers" },
  { path: "/app/hod/classes", role: "headofdepartment", pageId: "classes" },
  { path: "/app/hod/schedule", role: "headofdepartment", pageId: "schedule" },
  { path: "/app/hod/assessments", role: "headofdepartment", pageId: "assessments" },
  { path: "/app/hod/certificates", role: "headofdepartment", pageId: "certificates" },
  { path: "/app/hod/reports", role: "headofdepartment", pageId: "reports" },
  { path: "/app/hod/messages", role: "headofdepartment", pageId: "messages" },

  { path: "/app/branch/students", role: "branchadmin", pageId: "students" },
  { path: "/app/branch/teachers", role: "branchadmin", pageId: "teachers" },
  { path: "/app/branch/classes", role: "branchadmin", pageId: "classes" },
  { path: "/app/branch/rooms", role: "branchadmin", pageId: "rooms" },
  { path: "/app/branch/schedule", role: "branchadmin", pageId: "schedule" },
  { path: "/app/branch/attendance", role: "branchadmin", pageId: "attendance" },
  { path: "/app/branch/payments", role: "branchadmin", pageId: "payments" },
  { path: "/app/branch/reports", role: "branchadmin", pageId: "reports" },
  { path: "/app/branch/messages", role: "branchadmin", pageId: "messages" },
  { path: "/app/branch/settings", role: "branchadmin", pageId: "settings" },

  { path: "/app/admin/users/:userId", role: "superadmin", pageId: "user-detail" },
  { path: "/app/admin/users", role: "superadmin", pageId: "users" },
  { path: "/app/admin/roles", role: "superadmin", pageId: "roles" },
  { path: "/app/admin/permissions", role: "superadmin", pageId: "permissions" },
  { path: "/app/admin/branches", role: "superadmin", pageId: "branches" },
  { path: "/app/admin/departments", role: "superadmin", pageId: "departments" },
  { path: "/app/admin/programs", role: "superadmin", pageId: "programs" },
  { path: "/app/admin/courses", role: "superadmin", pageId: "courses" },
  { path: "/app/admin/certificates", role: "superadmin", pageId: "certificates" },
  { path: "/app/admin/schedule", role: "superadmin", pageId: "schedule" },
  { path: "/app/admin/moodle-source", role: "superadmin", pageId: "moodle-source" },
  { path: "/app/admin/settings", role: "superadmin", pageId: "settings" },
  { path: "/app/admin/integrations", role: "superadmin", pageId: "integrations" },
  { path: "/app/admin/audit-logs", role: "superadmin", pageId: "audit-logs" },
  { path: "/app/admin/reports", role: "superadmin", pageId: "reports" },
  { path: "/app/admin/system-health", role: "superadmin", pageId: "system-health" },
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
        <Route path="/login"><Login /></Route>
        <Route path="/auth/login"><Login /></Route>
        <Route path="/auth/student-login"><Login audience="student" /></Route>
        <Route path="/auth/administration-login"><Login audience="administration" /></Route>
        <Route path="/auth/admin-login"><Login audience="administration" /></Route>
        <Route path="/auth/forgot-password"><AuthFlowPage mode="forgot-password" /></Route>
        <Route path="/auth/reset-password"><AuthFlowPage mode="reset-password" /></Route>
        <Route path="/auth/select-role"><AuthFlowPage mode="select-role" /></Route>
        <Route path="/auth/logout"><AuthFlowPage mode="logout" /></Route>

        <Route path="/courses"><PublicSitePage mode="catalog" /></Route>
        <Route path="/courses/arabic"><PublicSitePage mode="catalog" slug="arabic" /></Route>
        <Route path="/courses/quran"><PublicSitePage mode="catalog" slug="quran" /></Route>
        <Route path="/courses/islamic-studies"><PublicSitePage mode="catalog" slug="islamic-studies" /></Route>
        <Route path="/courses/turkish"><PublicSitePage mode="catalog" slug="turkish" /></Route>
        <Route path="/courses/english"><PublicSitePage mode="catalog" slug="english" /></Route>
        <Route path="/courses/teacher-training"><PublicSitePage mode="catalog" slug="teacher-training" /></Route>
        <Route path="/courses/kids"><PublicSitePage mode="catalog" slug="kids" /></Route>
        <Route path="/courses/enterprise"><PublicSitePage mode="catalog" slug="enterprise" /></Route>
        <Route path="/courses/:slug">{(params) => <PublicSitePage mode="course" slug={params.slug} />}</Route>
        <Route path="/book-free-trial"><PublicSitePage mode="trial" /></Route>
        <Route path="/book-placement-test"><PublicSitePage mode="placement" /></Route>
        <Route path="/verify-certificate"><PublicSitePage mode="verify" /></Route>
        <Route path="/faq"><PublicSitePage mode="faq" /></Route>
        <Route path="/contact"><PublicSitePage mode="contact" /></Route>
        <Route path="/about"><PublicSitePage mode="about" /></Route>
        <Route path="/privacy"><PublicSitePage mode="privacy" /></Route>
        <Route path="/terms"><PublicSitePage mode="terms" /></Route>

        <Route path="/app"><AuthFlowPage mode="select-role" /></Route>

        {dashboardRoutes.map((route) => (
          <Route key={route.path} path={route.path}>
            <ProtectedRoute role={route.role} pageId="dashboard">
              <RoleDashboard role={route.role} />
            </ProtectedRoute>
          </Route>
        ))}

        <Route path="/app/admin/platform-blueprint">
          <ProtectedRoute role="superadmin" pageId="platform-blueprint">
            <PlatformBlueprintPage />
          </ProtectedRoute>
        </Route>

        {featureRoutes.map((route) => (
          <Route key={route.path} path={route.path}>
            {(params) => (
              <ProtectedRoute role={route.role} pageId={route.pageId}>
                <FeaturePage role={route.role} pageId={route.pageId} params={params} />
              </ProtectedRoute>
            )}
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
        ].map((path) => (
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
