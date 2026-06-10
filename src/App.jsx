import { Routes, Route, Navigate } from "react-router-dom";
import StudentDashboard from "./pages/Student/StudentDashboard";
import ExamNexusAuth from "./components/ExamNexusAuth";
import DashboardLayout from "./layouts/DashboardLayout";
import AdminLayout from "./layouts/AdminLayout";
import AdminRouteGuard from "./components/AdminRouteGuard";
import Profile from "./pages/Profile";
import FacultyDashboard from "./pages/Faculty/FacultyDashboard";
import CreateAssessment from "./pages/Faculty/CreateAssessment";
import SubjectDetails from "./pages/Faculty/SubjectDetails";
import AssessmentDetails from "./pages/Faculty/AssessmentDetails";
import EditAssessment from "./pages/Faculty/EditAssessment";
import StudentAssessments from "./pages/Student/StudentAssessments";
import StudentResultsList from "./pages/Student/StudentResultsList";
import StudentSubjects from "./pages/Student/StudentSubjects";
import StudentSubjectDetails from "./pages/Student/StudentSubjectDetails";
import FacultySubjectSocial from "./pages/Faculty/FacultySubjectSocial";
import FacultyAnnouncementsHub from "./pages/Faculty/FacultyAnnouncementsHub";
import StudentSubjectSocial from "./pages/Student/StudentSubjectSocial";
import TakeAssessment from "./pages/Student/TakeAssessment";
import StudentResults from "./pages/Student/StudentResults";
import AnimatedPage from "./components/ui/AnimatedPage";
import AdminDashboard from "./pages/Admin/AdminDashboard";
import AdminAccounts from "./pages/Admin/AdminAccounts";
import AdminSubjects from "./pages/Admin/AdminSubjects";
import AdminAssignedSubjects from "./pages/Admin/AdminAssignedSubjects";
import AdminCatalog from "./pages/Admin/AdminCatalog";
import AdminAnnouncements from "./pages/Admin/AdminAnnouncements";
import AdminAssessments from "./pages/Admin/AdminAssessments";
import AdminExamLogs from "./pages/Admin/AdminExamLogs";
import AdminExports from "./pages/Admin/AdminExports";
import AdminPasswordResets from "./pages/Admin/AdminPasswordResets";
import ProtectedRoute from "./guards/ProtectedRoute";

export default function App() {
  return (
    <Routes>
      <Route
        path="/auth"
        element={
          <AnimatedPage>
            <ExamNexusAuth />
          </AnimatedPage>
        }
      />

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
          <Route path="/" element={<Navigate to="/auth" replace />} />
          <Route path="/faculty/profile" element={<Profile />} />
          <Route path="/faculty/dashboard" element={<FacultyDashboard />} />
          <Route path="/student/dashboard" element={<StudentDashboard />} />
          <Route path="/student/profile" element={<Profile />} />
          <Route path="/student/assessments" element={<StudentAssessments />} />
          <Route path="/student/results" element={<StudentResultsList />} />
          <Route path="/student/results/:examId/:studentId" element={<StudentResults />} />
          <Route path="/student/take-assessment/:id" element={<TakeAssessment />} />
          <Route path="/student/subjects" element={<StudentSubjects />} />
          <Route path="/student/subject/:subjectId" element={<StudentSubjectDetails />} />
          <Route path="/student/subject/:subjectId/social" element={<StudentSubjectSocial />} />
          <Route path="/faculty/announcements" element={<FacultyAnnouncementsHub />} />
          <Route path="/faculty/create-assessment" element={<CreateAssessment />} />
          <Route path="/faculty/edit-assessment/:examId" element={<EditAssessment />} />
          <Route path="/faculty/subject/:subjectId" element={<SubjectDetails />} />
          <Route path="/faculty/subject/:subjectId/social" element={<FacultySubjectSocial />} />
          <Route path="/faculty/assessment/:examId" element={<AssessmentDetails />} />
        </Route>
      </Route>
    </Routes>
  );
}
