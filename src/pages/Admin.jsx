import DashboardLayout from "../layouts/DashboardLayout";

export default function Admin() {
  return (
    <DashboardLayout title="Admin Dashboard">
      <p>System Control Panel 🔐</p>
      <p className="text-gray-300 mt-2">
        Manage users, roles, and system settings.
      </p>
    </DashboardLayout>
  );
}