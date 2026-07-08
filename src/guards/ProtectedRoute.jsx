import { Navigate, Outlet } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { syncProfileOnLogin } from "../utils/authProfile";
import { fetchAccountAccess } from "../utils/adminData";
import { getAuthSession, getCachedExamNexusUser, hasLikelyAuthSession } from "../utils/authUser";
import { useTheme } from "../layouts/ThemeContext";
import { PageLoadingSkeleton } from "../components/ui/PageLoadingSkeleton";
import {
  buildPendingAuthNotice,
  peekAuthNotice,
  stashAuthNotice,
} from "../utils/authNotice";

export { stashAuthNotice, consumeAuthNotice, peekAuthNotice, clearAuthNotice } from "../utils/authNotice";

export default function ProtectedRoute({ allowedRoles }) {
  const { theme } = useTheme();
  const cachedProfile = getCachedExamNexusUser();
  const likelySession = hasLikelyAuthSession();
  const [loading, setLoading] = useState(!cachedProfile && likelySession);
  const [role, setRole] = useState(cachedProfile?.role || null);
  const [auth, setAuth] = useState(Boolean(cachedProfile));
  const [authRedirectNotice, setAuthRedirectNotice] = useState(null);

  useEffect(() => {
    const check = async () => {
      if (!hasLikelyAuthSession()) {
        localStorage.removeItem("examnexus_user");
        setAuth(false);
        setAuthRedirectNotice(null);
        setLoading(false);
        return;
      }

      const session = await getAuthSession();

      if (!session?.user) {
        localStorage.removeItem("examnexus_user");
        setAuth(false);
        setAuthRedirectNotice(null);
        setLoading(false);
        return;
      }

      const access = await fetchAccountAccess(supabase, session.user.id);

      if (!access.allowed) {
        const notice = buildPendingAuthNotice(access.profile);
        stashAuthNotice(notice);
        await supabase.auth.signOut();
        localStorage.removeItem("examnexus_user");
        setAuth(false);
        setAuthRedirectNotice(notice);
        setLoading(false);
        return;
      }

      const { profile, error, pendingApproval } = await syncProfileOnLogin(supabase);

      if (pendingApproval || !profile) {
        const notice = buildPendingAuthNotice(access.profile);
        stashAuthNotice(notice);
        await supabase.auth.signOut();
        localStorage.removeItem("examnexus_user");
        setAuth(false);
        setAuthRedirectNotice(notice);
        setLoading(false);
        if (error) console.error("Profile sync failed:", error);
        return;
      }

      setAuthRedirectNotice(null);
      setRole(profile.role);
      setAuth(true);
      setLoading(false);
    };

    check();
  }, []);

  if (loading) {
    return <PageLoadingSkeleton theme={theme} variant="dashboard" />;
  }

  if (!auth) {
    const notice = authRedirectNotice || peekAuthNotice();
    return (
      <Navigate
        to="/auth"
        replace
        state={notice ? { authNotice: notice } : undefined}
      />
    );
  }

  if (allowedRoles?.length && !allowedRoles.includes(role)) {
    const normalizedRole = String(role || "").toLowerCase();
    if (normalizedRole === "admin") return <Navigate to="/admin/dashboard" replace />;
    if (normalizedRole === "faculty") return <Navigate to="/faculty/dashboard" replace />;
    return <Navigate to="/student/dashboard" replace />;
  }

  return <Outlet />;
}
