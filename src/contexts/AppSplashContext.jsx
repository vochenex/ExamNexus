import { createContext, useCallback, useContext, useMemo, useState } from "react";

const AppSplashContext = createContext({
  blocking: false,
  registerBlockingLoad: () => () => {},
});

export function AppSplashProvider({ children }) {
  const [blockingCount, setBlockingCount] = useState(0);

  const registerBlockingLoad = useCallback(() => {
    setBlockingCount((count) => count + 1);
    return () => setBlockingCount((count) => Math.max(0, count - 1));
  }, []);

  const value = useMemo(
    () => ({
      blocking: blockingCount > 0,
      registerBlockingLoad,
    }),
    [blockingCount, registerBlockingLoad]
  );

  return (
    <AppSplashContext.Provider value={value}>{children}</AppSplashContext.Provider>
  );
}

export function useAppSplash() {
  return useContext(AppSplashContext);
}
