import { Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { syncProfileOnLogin } from "../utils/authProfile";
import { getAuthSession } from "../utils/authUser";

export default function ProtectedRoute({ children, allowedRoles }) {
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState(null);
  const [auth, setAuth] = useState(false);

  useEffect(() => {
    const check = async () => {
      const session = await getAuthSession().catch(() => null);

      if (!session?.user) {
        setAuth(false);
        setLoading(false);
        return;
      }

      setAuth(true);

      const { profile, error } = await syncProfileOnLogin(supabase);

      if (profile?.role) {
        setRole(profile.role);
        setLoading(false);
        return;
      }

      const { data: fallbackProfile } = await supabase
        .from("users")
        .select("role")
        .eq("id", session.user.id)
        .maybeSingle();

      setRole(fallbackProfile?.role ?? profile?.role ?? null);

      if (error && !fallbackProfile?.role) {
        console.error("Profile sync failed:", error);
      }

      setLoading(false);
    };

    check();
  }, []);

  if (loading) return <div className="text-white p-10">Loading...</div>;

  if (!auth) return <Navigate to="/" />;

  if (allowedRoles && !allowedRoles.includes(role)) {
    return <Navigate to="/" />;
  }

  return children;
}