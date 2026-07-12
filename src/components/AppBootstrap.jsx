import App from "../App";
import UpdatePrompt from "./pwa/UpdatePrompt";
import NativeBackBridge from "./NativeBackBridge";
import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { syncPushTokenForCurrentUser } from "../utils/pushNotifications";
import { isNativeApp } from "../utils/platform";
import { isNativeEntryPath, getNativeEntryPath } from "../utils/nativeRoutes";

function PushNavigationBridge() {
  const navigate = useNavigate();

  useEffect(() => {
    syncPushTokenForCurrentUser();

    const onPushNavigate = (event) => {
      const path = event?.detail?.path;
      if (typeof path === "string" && path.startsWith("/")) {
        navigate(path);
      }
    };

    const onSwMessage = (event) => {
      const data = event?.data;
      if (data?.type === "en:push-navigate" && typeof data.path === "string") {
        if (data.path.startsWith("/")) navigate(data.path);
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
      <UpdatePrompt />
      <NativeEntryRedirect />
      <PushNavigationBridge />
      <NativeBackBridge />
    </>
  );
}
