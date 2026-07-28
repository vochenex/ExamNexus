import { createContext, useCallback, useContext, useMemo, useState } from "react";

const AssessmentLockdownContext = createContext(null);

export function AssessmentLockdownProvider({ children }) {
  const [lockdown, setLockdown] = useState(null);

  const startLockdown = useCallback((examId, title = "") => {
    setLockdown({ examId, title });
  }, []);

  const endLockdown = useCallback(() => {
    setLockdown(null);
  }, []);

  const value = useMemo(
    () => ({
      lockdown,
      isLockdownActive: Boolean(lockdown),
      startLockdown,
      endLockdown,
    }),
    [lockdown, startLockdown, endLockdown]
  );

  return (
    <AssessmentLockdownContext.Provider value={value}>
      {children}
    </AssessmentLockdownContext.Provider>
  );
}

export function useAssessmentLockdown() {
  const context = useContext(AssessmentLockdownContext);
  if (!context) {
    throw new Error("useAssessmentLockdown must be used within AssessmentLockdownProvider");
  }
  return context;
}
