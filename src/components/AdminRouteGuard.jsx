import { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { supabase } from "../supabaseClient";
import { syncProfileOnLogin } from "../utils/authProfile";
import { getAuthSession } from "../utils/authUser";
import { isAccountApproved, isAdminUser } from "../utils/adminData";

export default function AdminRouteGuard() {
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [redirectRole, setRedirectRole] = useState("student");

  useEffect(() => {
    const check = async () => {
      const session = await getAuthSession();

      if (!session?.user) {
        localStorage.removeItem("examnexus_user");
        setAllowed(false);
        setLoading(false);
        return;
      }

      const { profile } = await syncProfileOnLogin(supabase);
      const role = String(profile?.role || "").toLowerCase();

      if (profile && isAdminUser(profile) && isAccountApproved(profile)) {
        setAllowed(true);
        setLoading(false);
        return;
      }

      setRedirectRole(role === "faculty" ? "faculty" : "student");
      setAllowed(false);
      setLoading(false);
    };

    check();
  }, []);

  if (loading) {
    return <div className="min-h-screen p-10 text-white">Loading admin workspace...</div>;
  }

  if (!allowed) {
    const sessionUser = JSON.parse(localStorage.getItem("examnexus_user") || "{}");
    if (!sessionUser?.id) {
      return <Navigate to="/auth" replace />;
    }
    if (redirectRole === "faculty") {
      return <Navigate to="/faculty/dashboard" replace />;
    }
    return <Navigate to="/student/dashboard" replace />;
  }

  return <Outlet />;
}
