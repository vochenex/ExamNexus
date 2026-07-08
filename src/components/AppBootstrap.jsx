import App from "../App";
import UpdatePrompt from "./pwa/UpdatePrompt";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { syncPushTokenForCurrentUser } from "../utils/pushNotifications";
import { isNativeApp } from "../utils/platform";

function PushNavigationBridge() {
  const navigate = useNavigate();

  useEffect(() => {
    if (!isNativeApp()) return undefined;

    syncPushTokenForCurrentUser();

    const onPushNavigate = (event) => {
      const path = event?.detail?.path;
      if (typeof path === "string" && path.startsWith("/")) {
        navigate(path);
      }
    };

    window.addEventListener("en:push-navigate", onPushNavigate);
    return () => window.removeEventListener("en:push-navigate", onPushNavigate);
  }, [navigate]);

  return null;
}

export default function AppBootstrap() {
  return (
    <>
      <App />
      <UpdatePrompt />
      <PushNavigationBridge />
    </>
  );
}
