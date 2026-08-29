import App from "../App";
import UpdatePrompt from "./pwa/UpdatePrompt";
import NativeBackBridge from "./NativeBackBridge";
import NavigationProgressOverlay from "./NavigationProgressOverlay";
import DevRouteFileIndicator from "./DevRouteFileIndicator";
import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { syncPushTokenForCurrentUser } from "../utils/pushNotifications";
import { isNativeApp } from "../utils/platform";
import { isNativeEntryPath, getNativeEntryPath } from "../utils/nativeRoutes";
import { getCachedExamNexusUser } from "../utils/authUser";
import { sanitizeAppPath } from "../utils/notificationRoutes";

function PushNavigationBridge() {
  const navigate = useNavigate();

  useEffect(() => {
    syncPushTokenForCurrentUser();

    const resolveRoleStudent = () => {
      const role = String(getCachedExamNexusUser()?.role || "").toLowerCase();
      return role !== "faculty" && role !== "teacher" && role !== "admin";
    };

    const go = (rawPath) => {
      const path = sanitizeAppPath(rawPath, {
        isStudent: resolveRoleStudent(),
      });
      navigate(path);
    };

    const onPushNavigate = (event) => {
      const path = event?.detail?.path;
      if (typeof path === "string" && path.startsWith("/")) {
        go(path);
      }
    };

    const onSwMessage = (event) => {
      const data = event?.data;
      if (data?.type === "en:push-navigate" && typeof data.path === "string") {
        if (data.path.startsWith("/")) go(data.path);
      }
      if (data?.type === "en:push-received") {
        const payload = data.payload || {};
        const recipient = String(
          payload?.data?.recipient_user_id || payload?.recipient_user_id || ""
        ).trim();
        try {
          const cached = JSON.parse(localStorage.getItem("examnexus_user") || "{}");
          if (recipient && cached?.id && String(cached.id) !== recipient) {
            return;
          }
        } catch {
          // ignore parse errors
        }
        window.dispatchEvent(
          new CustomEvent("en:push-received", { detail: payload })
        );
      }
    };

    window.addEventListener("en:push-navigate", onPushNavigate);
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.addEventListener("message", onSwMessage);
    }
    return () => {
      window.removeEventListener("en:push-navigate", onPushNavigate);
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.removeEventListener("message", onSwMessage);
      }
    };
  }, [navigate]);

  return null;
}

function NativeEntryRedirect() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isNativeApp()) return;
    if (isNativeEntryPath(location.pathname)) {
      navigate(getNativeEntryPath(), { replace: true });
    }
  }, [location.pathname, navigate]);

  return null;
}

export default function AppBootstrap() {
  return (
    <>
      <App />
      <NavigationProgressOverlay />
      <UpdatePrompt />
      <NativeEntryRedirect />
      <PushNavigationBridge />
      <NativeBackBridge />
      <DevRouteFileIndicator />
    </>
  );
}
