import { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { supabase } from "../supabaseClient";
import { syncProfileOnLogin } from "../utils/authProfile";
import { getAuthSession, getCachedExamNexusUser, hasLikelyAuthSession } from "../utils/authUser";
import { isAdminUser } from "../utils/adminData";
import { useTheme } from "../layouts/ThemeContext";
import { PageLoadingSkeleton } from "./ui/PageLoadingSkeleton";

export default function AdminRouteGuard() {
  const { theme } = useTheme();
  const cachedProfile = getCachedExamNexusUser();
  const cachedAdmin = Boolean(cachedProfile && isAdminUser(cachedProfile));
  const likelySession = hasLikelyAuthSession();
  const [loading, setLoading] = useState(!cachedAdmin && likelySession);
  const [allowed, setAllowed] = useState(cachedAdmin);
  const [redirectRole, setRedirectRole] = useState("student");

  useEffect(() => {
    const check = async () => {
      if (!hasLikelyAuthSession()) {
        localStorage.removeItem("examnexus_user");
        setAllowed(false);
        setLoading(false);
        return;
      }

      const session = await getAuthSession();

      if (!session?.user) {
        localStorage.removeItem("examnexus_user");
        setAllowed(false);
        setLoading(false);
        return;
      }

      const { profile } = await syncProfileOnLogin(supabase);
      const role = String(profile?.role || "").toLowerCase();

      if (profile && isAdminUser(profile)) {
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
    return <PageLoadingSkeleton theme={theme} variant="dashboard" />;
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
