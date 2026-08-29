import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getCachedExamNexusUser } from "../utils/authUser";
import RouteFallback from "./RouteFallback";

/**
 * Unmatched URLs (e.g. legacy /login from notifications) used to render an empty
 * outlet — blank green page. Send the user somewhere real instead.
 */
export default function UnknownRouteRedirect() {
  const navigate = useNavigate();

  useEffect(() => {
    const role = String(getCachedExamNexusUser()?.role || "").toLowerCase();
    const path = window.location.pathname;

    if (path === "/login" || path.startsWith("/login/")) {
      navigate(`/auth${window.location.search}`, { replace: true });
      return;
    }

    if (role === "admin") {
      navigate("/admin/dashboard", { replace: true });
      return;
    }
    if (role === "faculty" || role === "teacher") {
      navigate("/faculty/dashboard", { replace: true });
      return;
    }
    if (role === "student") {
      navigate("/student/dashboard", { replace: true });
      return;
    }

    navigate("/auth", { replace: true });
  }, [navigate]);

  return <RouteFallback />;
}
