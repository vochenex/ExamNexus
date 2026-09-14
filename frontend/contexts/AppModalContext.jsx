import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import AppModal from "../components/ui/AppModal";
import AppToastStack from "../components/ui/AppToastStack";
import { forceUnlockBodyScroll } from "../utils/bodyScrollLock";

const AppModalContext = createContext(null);

let toastSeq = 0;

function normalizeAlertOptions(input, defaults = {}) {
  if (typeof input === "string") {
    return { message: input, ...defaults };
  }
  return { ...defaults, ...input };
}

function toastDurationMs(tone, mode) {
  if (mode === "confirm" || mode === "choice") return 0;
  if (tone === "error") return 5200;
  if (tone === "warning") return 4500;
  if (tone === "success") return 3600;
  return 4000;
}

export function AppModalProvider({ children }) {
  const [modal, setModal] = useState(null);
  const [toasts, setToasts] = useState([]);
  const timersRef = useRef(new Map());
  const location = useLocation();

  const clearToastTimer = useCallback((id) => {
    const timer = timersRef.current.get(id);
    if (timer) {
      window.clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const removeToast = useCallback(
    (id, result) => {
      clearToastTimer(id);
      setToasts((current) => {
        const target = current.find((item) => item.id === id);
        if (target?.resolve) {
          target.resolve(result);
        }
        return current.filter((item) => item.id !== id);
      });
    },
    [clearToastTimer]
  );

  const beginDismissToast = useCallback(
    (id, result) => {
      clearToastTimer(id);
      setToasts((current) =>
        current.map((item) => (item.id === id ? { ...item, leaving: true } : item))
      );
      window.setTimeout(() => removeToast(id, result), 280);
    },
    [clearToastTimer, removeToast]
  );

  const pushToast = useCallback(
    (entry) =>
      new Promise((resolve) => {
        const id = `toast-${Date.now()}-${(toastSeq += 1)}`;
        const next = {
          id,
          leaving: false,
          resolve,
          ...entry,
        };
        setToasts((current) => [next, ...current].slice(0, 4));

        const duration = toastDurationMs(entry.tone, entry.mode);
        if (duration > 0) {
          const timer = window.setTimeout(() => {
            beginDismissToast(id, entry.mode === "confirm" ? false : true);
          }, duration);
          timersRef.current.set(id, timer);
        }
      }),
    [beginDismissToast]
  );

  const closeModal = useCallback((result = false) => {
    setModal((current) => {
      current?.resolve?.(result);
      return null;
    });
  }, []);

  // Navigating via the tab bar must never leave a modal overlay eating touches.
  useEffect(() => {
    setModal((current) => {
      current?.resolve?.(false);
      return null;
    });
    setToasts((current) => {
      current.forEach((item) => item.resolve?.(item.mode === "confirm" ? false : "cancel"));
      return [];
    });
    timersRef.current.forEach((timer) => window.clearTimeout(timer));
    timersRef.current.clear();
    forceUnlockBodyScroll();
  }, [location.pathname]);

  useEffect(
    () => () => {
      timersRef.current.forEach((timer) => window.clearTimeout(timer));
      timersRef.current.clear();
    },
    []
  );

  const alert = useCallback(
    (input) => {
      const options = normalizeAlertOptions(input, {
        title: "Notice",
        tone: "info",
        confirmLabel: "OK",
      });

      if (options.forceModal) {
        return new Promise((resolve) => {
          setModal({
            mode: "alert",
            ...options,
            resolve: () => resolve(true),
          });
        });
      }

      return pushToast({
        mode: "alert",
        title: options.title,
        message: options.message,
        tone: options.tone || "info",
      });
    },
    [pushToast]
  );

  const confirm = useCallback(
    (input) => {
      const options = normalizeAlertOptions(input, {
        title: "Confirm",
        tone: "warning",
        confirmLabel: "Confirm",
        cancelLabel: "Cancel",
      });

      // Student exam submit keeps a real dialog via ActionDialog — not this API.
      // forceModal reserved for rare blocking cases.
      if (options.forceModal) {
        return new Promise((resolve) => {
          setModal({
            mode: "confirm",
            ...options,
            resolve,
          });
        });
      }

      return pushToast({
        mode: "confirm",
        title: options.title,
        message: options.message,
        tone: options.tone || "warning",
        confirmLabel: options.confirmLabel,
        cancelLabel: options.cancelLabel,
      });
    },
    [pushToast]
  );

  const choose = useCallback(
    (input) => {
      const options = normalizeAlertOptions(input, {
        title: "Choose an option",
        tone: "warning",
        actions: [],
      });

      if (options.forceModal) {
        return new Promise((resolve) => {
          setModal({
            mode: "choice",
            ...options,
            resolve,
          });
        });
      }

      return pushToast({
        mode: "choice",
        title: options.title,
        message: options.message,
        tone: options.tone || "info",
        actions: options.actions || [],
      });
    },
    [pushToast]
  );

  const success = useCallback(
    (message, title = "Success") =>
      alert({ title, message, tone: "success", confirmLabel: "OK" }),
    [alert]
  );

  const error = useCallback(
    (message, title = "Something went wrong") =>
      alert({ title, message, tone: "error", confirmLabel: "OK" }),
    [alert]
  );

  const warning = useCallback(
    (message, title = "Warning") =>
      alert({ title, message, tone: "warning", confirmLabel: "OK" }),
    [alert]
  );

  const value = useMemo(
    () => ({ alert, confirm, choose, success, error, warning }),
    [alert, confirm, choose, success, error, warning]
  );

  return (
    <AppModalContext.Provider value={value}>
      {children}
      <AppToastStack
        toasts={toasts}
        onDismiss={beginDismissToast}
        onConfirm={(id) => beginDismissToast(id, true)}
        onAction={(id, actionId) => beginDismissToast(id, actionId)}
      />
      {modal && (
        <AppModal
          open
          mode={modal.mode}
          tone={modal.tone}
          title={modal.title}
          message={modal.message}
          confirmLabel={modal.confirmLabel}
          cancelLabel={modal.cancelLabel}
          actions={modal.actions}
          loading={modal.loading}
          showClose={modal.showClose !== false}
          onCancel={() => closeModal(modal.mode === "choice" ? "cancel" : false)}
          onConfirm={() => closeModal(modal.mode === "confirm" ? true : true)}
          onAction={(actionId) => closeModal(actionId)}
        />
      )}
    </AppModalContext.Provider>
  );
}

export function useAppModal() {
  const context = useContext(AppModalContext);
  if (!context) {
    throw new Error("useAppModal must be used within AppModalProvider");
  }
  return context;
}
