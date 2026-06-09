import DashboardLayout from "../layouts/DashboardLayout";

export default function Student() {
  return (
    <DashboardLayout title="Student Dashboard">
      <p>Welcome Student 🎓</p>
      <p className="text-gray-300 mt-2">
        Take exams assigned by your faculty.
      </p>
    </DashboardLayout>
  );
}