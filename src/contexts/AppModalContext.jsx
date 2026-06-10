import { createContext, useCallback, useContext, useMemo, useState } from "react";
import AppModal from "../components/ui/AppModal";

const AppModalContext = createContext(null);

function normalizeAlertOptions(input, defaults = {}) {
  if (typeof input === "string") {
    return { message: input, ...defaults };
  }
  return { ...defaults, ...input };
}

export function AppModalProvider({ children }) {
  const [modal, setModal] = useState(null);

  const close = useCallback((result = false) => {
    setModal((current) => {
      current?.resolve?.(result);
      return null;
    });
  }, []);

  const alert = useCallback((input) => {
    const options = normalizeAlertOptions(input, {
      title: "Notice",
      tone: "info",
      confirmLabel: "OK",
    });

    return new Promise((resolve) => {
      setModal({
        mode: "alert",
        ...options,
        resolve: () => resolve(true),
      });
    });
  }, []);

  const confirm = useCallback((input) => {
    const options = normalizeAlertOptions(input, {
      title: "Confirm",
      tone: "warning",
      confirmLabel: "Confirm",
      cancelLabel: "Cancel",
    });

    return new Promise((resolve) => {
      setModal({
        mode: "confirm",
        ...options,
        resolve,
      });
    });
  }, []);

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
    () => ({ alert, confirm, success, error, warning }),
    [alert, confirm, success, error, warning]
  );

  return (
    <AppModalContext.Provider value={value}>
      {children}
      {modal && (
        <AppModal
          open
          mode={modal.mode}
          tone={modal.tone}
          title={modal.title}
          message={modal.message}
          confirmLabel={modal.confirmLabel}
          cancelLabel={modal.cancelLabel}
          loading={modal.loading}
          showClose={modal.showClose !== false}
          onCancel={() => close(false)}
          onConfirm={() => close(modal.mode === "confirm" ? true : true)}
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
