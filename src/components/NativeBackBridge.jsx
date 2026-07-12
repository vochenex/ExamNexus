import { useCallback, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { App as CapApp } from "@capacitor/app";
import { useAppModal } from "../contexts/AppModalContext";
import { isNativeApp } from "../utils/platform";
import {
  getSafeBackPath,
  isNativeExitPath,
  sealAuthNavigation,
  subscribeAndroidBack,
} from "../utils/nativeBack";

const DOUBLE_BACK_MS = 2000;

/**
 * Android system back: stay inside the current account/role tree.
 * Never walks WebView history (that revived previous Saved Accounts).
 * At role home / auth: first Back arms exit; second Back within 2s opens confirm.
 */
export default function NativeBackBridge() {
  const location = useLocation();
  const navigate = useNavigate();
  const { confirm } = useAppModal();
  const pathRef = useRef(location.pathname);
  const confirmingRef = useRef(false);
  const armedExitAtRef = useRef(0);

  useEffect(() => {
    pathRef.current = location.pathname;
    armedExitAtRef.current = 0;
  }, [location.pathname]);

  const requestExit = useCallback(async () => {
    if (confirmingRef.current) return;
    confirmingRef.current = true;
    armedExitAtRef.current = 0;
    try {
      const leave = await confirm({
        title: "Exit ExamNexus?",
        message: "Do you want to close the app?",
        confirmLabel: "Exit",
        cancelLabel: "Stay",
        tone: "warning",
      });
      if (leave) {
        try {
          await CapApp.exitApp();
        } catch {
          // ignore
        }
      }
    } finally {
      confirmingRef.current = false;
    }
  }, [confirm]);

  const handleExitGesture = useCallback(() => {
    const now = Date.now();
    if (now - armedExitAtRef.current <= DOUBLE_BACK_MS) {
      requestExit();
      return;
    }
    armedExitAtRef.current = now;
  }, [requestExit]);

  const handleBack = useCallback(() => {
    const pathname = pathRef.current || window.location.pathname;

    if (isNativeExitPath(pathname)) {
      handleExitGesture();
      return;
    }

    const safePath = getSafeBackPath(pathname);
    if (!safePath) {
      handleExitGesture();
      return;
    }

    armedExitAtRef.current = 0;
    // Never history.back() — that reopens another account's pages in the stack.
    navigate(safePath, { replace: false });
  }, [navigate, handleExitGesture]);

  useEffect(() => {
    if (!isNativeApp()) return undefined;
    return subscribeAndroidBack(handleBack);
  }, [handleBack]);

  useEffect(() => {
    if (!isNativeApp()) return;
    try {
      const epoch = sessionStorage.getItem("en_auth_nav_epoch");
      if (!epoch) return;
      window.history.replaceState(
        { ...(window.history.state || {}), enAuthEpoch: epoch },
        "",
        location.pathname + location.search + location.hash
      );
    } catch {
      // ignore
    }
  }, [location.pathname, location.search, location.hash]);

  useEffect(() => {
    if (!isNativeApp()) return;
    if (location.pathname.startsWith("/auth")) {
      sealAuthNavigation("/auth");
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}
