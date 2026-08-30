import { useCallback, useState } from "react";
import { fetchAdminDashboardStats } from "../utils/adminData";
import { supabase } from "../supabaseClient";
import { usePolling } from "./useRealtimeFetch";

export default function useSidebarPendingBadges(role) {
  const [badges, setBadges] = useState({});

  const load = useCallback(async () => {
    const normalized = String(role || "").toLowerCase();
    const next = {};

    if (normalized === "admin") {
      try {
        const stats = await fetchAdminDashboardStats();
        if ((stats.pending_requests ?? 0) > 0) {
          next["/admin/accounts"] = true;
        }
        if ((stats.pending_password_resets ?? 0) > 0) {
          next["/admin/password-resets"] = true;
        }
      } catch {
        // ignore polling errors
      }
    }

    if (normalized === "faculty" || normalized === "teacher") {
      try {
        const { count, error } = await supabase
          .from("exam_retake_requests")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending");

        if (!error && (count ?? 0) > 0) {
          next["/faculty/dashboard"] = true;
        }
      } catch {
        // ignore polling errors
      }
    }

    setBadges(next);
  }, [role]);

  usePolling(load, [role]);

  return badges;
}
