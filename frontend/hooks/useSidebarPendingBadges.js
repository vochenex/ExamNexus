import { useCallback, useState } from "react";
import { fetchAdminDashboardStats } from "../utils/adminData";
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

    setBadges(next);
  }, [role]);

  usePolling(load, [role]);

  return badges;
}
