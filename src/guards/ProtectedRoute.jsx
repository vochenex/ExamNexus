import { Navigate, Outlet } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { syncProfileOnLogin } from "../utils/authProfile";
import { isAccountApproved } from "../utils/adminData";
import { getAuthSession } from "../utils/authUser";

export default function ProtectedRoute({ allowedRoles }) {
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState(null);
  const [auth, setAuth] = useState(false);

  useEffect(() => {
    const check = async () => {
      const session = await getAuthSession();

      if (!session?.user) {
        localStorage.removeItem("examnexus_user");
        setAuth(false);
        setLoading(false);
        return;
      }

      const { profile, error } = await syncProfileOnLogin(supabase);

      if (profile && !isAccountApproved(profile)) {
        await supabase.auth.signOut();
        localStorage.removeItem("examnexus_user");
        setAuth(false);
        setLoading(false);
        return;
      }

      if (profile?.role) {
        setRole(profile.role);
        setAuth(true);
        setLoading(false);
        return;
      }

      const { data: fallbackProfile } = await supabase
        .from("users")
        .select("role")
        .eq("id", session.user.id)
        .maybeSingle();

      setRole(fallbackProfile?.role ?? profile?.role ?? null);
      setAuth(true);

      if (error && !fallbackProfile?.role) {
        console.error("Profile sync failed:", error);
      }

      setLoading(false);
    };

    check();
  }, []);

  if (loading) return <div className="text-white p-10">Loading...</div>;

  if (!auth) return <Navigate to="/auth" replace />;

  if (allowedRoles?.length && !allowedRoles.includes(role)) {
    const normalizedRole = String(role || "").toLowerCase();
    if (normalizedRole === "admin") return <Navigate to="/admin/dashboard" replace />;
    if (normalizedRole === "faculty") return <Navigate to="/faculty/dashboard" replace />;
    return <Navigate to="/student/dashboard" replace />;
  }

  return <Outlet />;
}
