import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import { stashAuthNotice } from "../utils/authNotice";
import {
  ACTIVE_SESSION_HEARTBEAT_MS,
  SESSION_CONFLICT_NOTICE,
  claimActiveSession,
  discardThisSession,
} from "../utils/activeSession";

/**
 * Keeps this browser marked as the account's active session while a dashboard is open,
 * and signs it out if the account has since become active on another device.
 */
export function useActiveSessionHeartbeat() {
  const navigate = useNavigate();

  useEffect(() => {
    let stopped = false;
    let busy = false;

    const beat = async () => {
      if (stopped || busy) return;
      busy = true;
      try {
        const { data } = await supabase.auth.getSession();
        if (!data?.session || stopped) return;
        const result = await claimActiveSession();
        if (stopped || result.ok !== false) return;

        stopped = true;
        const authNotice = {
          kind: SESSION_CONFLICT_NOTICE,
          title: "Account active on another device",
          deviceLabel: result.deviceLabel,
          secondsAgo: result.secondsAgo,
          message: `This account is now logged in and active on ${result.deviceLabel}. You were signed out here.`,
        };
        await discardThisSession();
        stashAuthNotice(authNotice);
        navigate("/auth", { replace: true, state: { authNotice } });
      } finally {
        busy = false;
      }
    };

    const onVisible = () => {
      if (document.visibilityState === "visible") beat();
    };

    beat();
    const timer = window.setInterval(beat, ACTIVE_SESSION_HEARTBEAT_MS);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    window.addEventListener("online", beat);
    return () => {
      stopped = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
      window.removeEventListener("online", beat);
    };
  }, [navigate]);
}
