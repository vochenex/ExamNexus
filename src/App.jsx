import { lazy, Suspense } from "react";
import { Routes, Route } from "react-router-dom";
import ProtectedRoute from "./guards/ProtectedRoute";
import AdminRouteGuard from "./components/AdminRouteGuard";
import RouteFallback from "./components/RouteFallback";
import WebOnlyHomeRoute from "./components/WebOnlyHomeRoute";

const HomePage = lazy(() => import("./pages/HomePage"));
const ExamNexusAuth = lazy(() => import("./components/ExamNexusAuth"));
const DashboardLayout = lazy(() => import("./layouts/DashboardLayout"));
const AdminLayout = lazy(() => import("./layouts/AdminLayout"));
const Profile = lazy(() => import("./pages/Profile"));
const StudentDashboard = lazy(() => import("./pages/Student/StudentDashboard"));
const FacultyDashboard = lazy(() => import("./pages/Faculty/FacultyDashboard"));
const CreateAssessment = lazy(() => import("./pages/Faculty/CreateAssessment"));
const SubjectDetails = lazy(() => import("./pages/Faculty/SubjectDetails"));
const AssessmentDetails = lazy(() => import("./pages/Faculty/AssessmentDetails"));
const EditAssessment = lazy(() => import("./pages/Faculty/EditAssessment"));
const StudentAssessments = lazy(() => import("./pages/Student/StudentAssessments"));
const StudentResultsList = lazy(() => import("./pages/Student/StudentResultsList"));
const StudentSubjects = lazy(() => import("./pages/Student/StudentSubjects"));
const StudentSubjectDetails = lazy(() => import("./pages/Student/StudentSubjectDetails"));
const FacultySubjectSocial = lazy(() => import("./pages/Faculty/FacultySubjectSocial"));
const FacultyAnnouncementsHub = lazy(() => import("./pages/Faculty/FacultyAnnouncementsHub"));
const QuestionBank = lazy(() => import("./pages/Faculty/QuestionBank"));
const StudentSubjectSocial = lazy(() => import("./pages/Student/StudentSubjectSocial"));
const TakeAssessment = lazy(() => import("./pages/Student/TakeAssessment"));
const StudentResults = lazy(() => import("./pages/Student/StudentResults"));
const AdminDashboard = lazy(() => import("./pages/Admin/AdminDashboard"));
const AdminAccounts = lazy(() => import("./pages/Admin/AdminAccounts"));
const AdminSubjects = lazy(() => import("./pages/Admin/AdminSubjects"));
const AdminAssignedSubjects = lazy(() => import("./pages/Admin/AdminAssignedSubjects"));
const AdminCatalog = lazy(() => import("./pages/Admin/AdminCatalog"));
const AdminAnnouncements = lazy(() => import("./pages/Admin/AdminAnnouncements"));
const AdminAssessments = lazy(() => import("./pages/Admin/AdminAssessments"));
const AdminExamLogs = lazy(() => import("./pages/Admin/AdminExamLogs"));
const AdminExports = lazy(() => import("./pages/Admin/AdminExports"));
const AdminPasswordResets = lazy(() => import("./pages/Admin/AdminPasswordResets"));
const PlatformAnnouncements = lazy(() => import("./pages/PlatformAnnouncements"));

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
        <Route path="/auth" element={<ExamNexusAuth />} />

        <Route element={<AdminRouteGuard />}>
          <Route element={<AdminLayout />}>
            <Route path="/admin/dashboard" element={<AdminDashboard />} />
            <Route path="/admin/profile" element={<Profile />} />
            <Route path="/admin/accounts" element={<AdminAccounts />} />
            <Route path="/admin/password-resets" element={<AdminPasswordResets />} />
            <Route path="/admin/subjects" element={<AdminSubjects />} />
            <Route path="/admin/assigned-subjects" element={<AdminAssignedSubjects />} />
            <Route path="/admin/catalog" element={<AdminCatalog />} />
            <Route path="/admin/announcements" element={<AdminAnnouncements />} />
            <Route path="/admin/assessments" element={<AdminAssessments />} />
            <Route path="/admin/exam-logs" element={<AdminExamLogs />} />
            <Route path="/admin/exports" element={<AdminExports />} />
          </Route>
        </Route>

        <Route element={<ProtectedRoute />}>
          <Route element={<DashboardLayout />}>
            <Route path="/faculty/profile" element={<Profile />} />
            <Route path="/faculty/dashboard" element={<FacultyDashboard />} />
            <Route path="/faculty/platform-announcements" element={<PlatformAnnouncements />} />
            <Route path="/student/dashboard" element={<StudentDashboard />} />
            <Route path="/student/profile" element={<Profile />} />
            <Route path="/student/platform-announcements" element={<PlatformAnnouncements />} />
            <Route path="/student/assessments" element={<StudentAssessments />} />
            <Route path="/student/results" element={<StudentResultsList />} />
            <Route path="/student/results/:examId/:studentId" element={<StudentResults />} />
            <Route path="/student/take-assessment/:id" element={<TakeAssessment />} />
            <Route path="/student/subjects" element={<StudentSubjects />} />
            <Route path="/student/subject/:subjectId" element={<StudentSubjectDetails />} />
            <Route path="/student/subject/:subjectId/social" element={<StudentSubjectSocial />} />
            <Route path="/faculty/announcements" element={<FacultyAnnouncementsHub />} />
            <Route path="/faculty/question-bank" element={<QuestionBank />} />
            <Route path="/faculty/create-assessment" element={<CreateAssessment />} />
            <Route path="/faculty/edit-assessment/:examId" element={<EditAssessment />} />
            <Route path="/faculty/subject/:subjectId" element={<SubjectDetails />} />
            <Route path="/faculty/subject/:subjectId/social" element={<FacultySubjectSocial />} />
            <Route path="/faculty/assessment/:examId" element={<AssessmentDetails />} />
          </Route>
        </Route>
      </Routes>
    </Suspense>
  );
}
