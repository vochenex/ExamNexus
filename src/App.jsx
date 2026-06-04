import { Routes, Route, Navigate } from "react-router-dom";

import ExamNexusAuth from "./components/ExamNexusAuth";
import DashboardLayout from "./layouts/DashboardLayout";
import Profile from "./pages/Profile";
import FacultyDashboard from "./pages/Faculty/FacultyDashboard";
import CreateAssessment from "./pages/Faculty/CreateAssessment";
import SubjectDetails from "./pages/Faculty/SubjectDetails";
import AssessmentDetails from "./pages/Faculty/AssessmentDetails";

export default function App() {
  return (
    <Routes>

      {/* AUTH */}
      <Route
        path="/auth"
        element={<ExamNexusAuth />}
      />

      {/* FACULTY DASHBOARD LAYOUT */}
      <Route element={<DashboardLayout />}>

        <Route
          path="/"
          element={<Navigate to="/faculty/dashboard" />}
        />
        <Route
          path="/faculty/profile"
          element={<Profile />}
        />
        <Route
          path="/faculty/dashboard"
          element={<FacultyDashboard />}
        />

        <Route
          path="/faculty/create-assessment"
          element={<CreateAssessment />}
        />

        <Route
          path="/faculty/subject/:subjectId"
          element={<SubjectDetails />}
        />

        <Route
          path="/faculty/assessment/:examId"
          element={<AssessmentDetails />}
        />

      </Route>

    </Routes>
  );
}