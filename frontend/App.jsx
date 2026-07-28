import { lazy, Suspense } from "react";
import { Routes, Route } from "react-router-dom";
import ProtectedRoute from "./guards/ProtectedRoute";
import AdminRouteGuard from "./components/AdminRouteGuard";
import RouteFallback from "./components/RouteFallback";
import WebOnlyHomeRoute from "./components/WebOnlyHomeRoute";

const HomePage = lazy(() => import("./pages/public/HomePage"));
const AuthPage = lazy(() => import("./pages/auth/AuthPage"));
const DashboardLayout = lazy(() => import("./layouts/DashboardLayout"));
const AdminLayout = lazy(() => import("./layouts/AdminLayout"));
const ProfilePage = lazy(() => import("./pages/shared/ProfilePage"));
const StudentDashboardPage = lazy(() => import("./pages/Student/StudentDashboardPage"));
const FacultyDashboardPage = lazy(() => import("./pages/Faculty/FacultyDashboardPage"));
const CreateAssessmentPage = lazy(() => import("./pages/Faculty/CreateAssessmentPage"));
const FacultySubjectDetailsPage = lazy(() => import("./pages/Faculty/FacultySubjectDetailsPage"));
const FacultyAssessmentDetailsPage = lazy(() => import("./pages/Faculty/FacultyAssessmentDetailsPage"));
const EditAssessmentPage = lazy(() => import("./pages/Faculty/EditAssessmentPage"));
const StudentAssessmentsPage = lazy(() => import("./pages/Student/StudentAssessmentsPage"));
const StudentResultsListPage = lazy(() => import("./pages/Student/StudentResultsListPage"));
const StudentSubjectsPage = lazy(() => import("./pages/Student/StudentSubjectsPage"));
const StudentSubjectDetailsPage = lazy(() => import("./pages/Student/StudentSubjectDetailsPage"));
const FacultySubjectSocialPage = lazy(() => import("./pages/Faculty/FacultySubjectSocialPage"));
const FacultyAnnouncementsHubPage = lazy(() => import("./pages/Faculty/FacultyAnnouncementsHubPage"));
const QuestionBankPage = lazy(() => import("./pages/Faculty/QuestionBankPage"));
const StudentSubjectSocialPage = lazy(() => import("./pages/Student/StudentSubjectSocialPage"));
const TakeAssessmentPage = lazy(() => import("./pages/Student/TakeAssessmentPage"));
const StudentResultDetailPage = lazy(() => import("./pages/Student/StudentResultDetailPage"));
const AdminDashboardPage = lazy(() => import("./pages/Admin/AdminDashboardPage"));
const AdminAccountsPage = lazy(() => import("./pages/Admin/AdminAccountsPage"));
const AdminSubjectsPage = lazy(() => import("./pages/Admin/AdminSubjectsPage"));
const AdminAssignedSubjectsPage = lazy(() => import("./pages/Admin/AdminAssignedSubjectsPage"));
const AdminCatalogPage = lazy(() => import("./pages/Admin/AdminCatalogPage"));
const AdminAnnouncementsPage = lazy(() => import("./pages/Admin/AdminAnnouncementsPage"));
const AdminAssessmentsPage = lazy(() => import("./pages/Admin/AdminAssessmentsPage"));
const AdminExamLogsPage = lazy(() => import("./pages/Admin/AdminExamLogsPage"));
const AdminExportsPage = lazy(() => import("./pages/Admin/AdminExportsPage"));
const AdminPasswordResetsPage = lazy(() => import("./pages/Admin/AdminPasswordResetsPage"));
const PlatformAnnouncementsPage = lazy(() => import("./pages/shared/PlatformAnnouncementsPage"));

export default function App() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route
          path="/"
          element={
            <WebOnlyHomeRoute>
              <HomePage />
            </WebOnlyHomeRoute>
          }
        />
        <Route path="/auth" element={<AuthPage />} />

        <Route element={<AdminRouteGuard />}>
          <Route element={<AdminLayout />}>
            <Route path="/admin/dashboard" element={<AdminDashboardPage />} />
            <Route path="/admin/profile" element={<ProfilePage />} />
            <Route path="/admin/accounts" element={<AdminAccountsPage />} />
            <Route path="/admin/password-resets" element={<AdminPasswordResetsPage />} />
            <Route path="/admin/subjects" element={<AdminSubjectsPage />} />
            <Route path="/admin/assigned-subjects" element={<AdminAssignedSubjectsPage />} />
            <Route path="/admin/catalog" element={<AdminCatalogPage />} />
            <Route path="/admin/announcements" element={<AdminAnnouncementsPage />} />
            <Route path="/admin/assessments" element={<AdminAssessmentsPage />} />
            <Route path="/admin/exam-logs" element={<AdminExamLogsPage />} />
            <Route path="/admin/exports" element={<AdminExportsPage />} />
          </Route>
        </Route>

        <Route element={<ProtectedRoute />}>
          <Route element={<DashboardLayout />}>
            <Route path="/faculty/profile" element={<ProfilePage />} />
            <Route path="/faculty/dashboard" element={<FacultyDashboardPage />} />
            <Route path="/faculty/platform-announcements" element={<PlatformAnnouncementsPage />} />
            <Route path="/student/dashboard" element={<StudentDashboardPage />} />
            <Route path="/student/profile" element={<ProfilePage />} />
            <Route path="/student/platform-announcements" element={<PlatformAnnouncementsPage />} />
            <Route path="/student/assessments" element={<StudentAssessmentsPage />} />
            <Route path="/student/results" element={<StudentResultsListPage />} />
            <Route path="/student/results/:examId/:studentId" element={<StudentResultDetailPage />} />
            <Route path="/student/take-assessment/:id" element={<TakeAssessmentPage />} />
            <Route path="/student/subjects" element={<StudentSubjectsPage />} />
            <Route path="/student/subject/:subjectId" element={<StudentSubjectDetailsPage />} />
            <Route path="/student/subject/:subjectId/social" element={<StudentSubjectSocialPage />} />
            <Route path="/faculty/announcements" element={<FacultyAnnouncementsHubPage />} />
            <Route path="/faculty/question-bank" element={<QuestionBankPage />} />
            <Route path="/faculty/create-assessment" element={<CreateAssessmentPage />} />
            <Route path="/faculty/edit-assessment/:examId" element={<EditAssessmentPage />} />
            <Route path="/faculty/subject/:subjectId" element={<FacultySubjectDetailsPage />} />
            <Route path="/faculty/subject/:subjectId/social" element={<FacultySubjectSocialPage />} />
            <Route path="/faculty/assessment/:examId" element={<FacultyAssessmentDetailsPage />} />
          </Route>
        </Route>
      </Routes>
    </Suspense>
  );
}
