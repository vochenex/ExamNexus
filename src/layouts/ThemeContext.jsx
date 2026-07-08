import { createContext, useContext, useEffect, useState } from "react";
import { isNativeApp } from "../utils/platform";

const ThemeContext = createContext();

function syncNativeStatusBar(theme) {
  if (!isNativeApp()) return;
  import("@capacitor/status-bar")
    .then(({ StatusBar, Style }) =>
      StatusBar.setStyle({ style: theme === "light" ? Style.Light : Style.Dark })
    )
    .catch(() => {});
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(
    localStorage.getItem("examnexus_theme") || "dark"
  );

  useEffect(() => {
    localStorage.setItem("examnexus_theme", theme);
    document.documentElement.classList.toggle("light", theme === "light");
    syncNativeStatusBar(theme);
  }, [theme]);

  return (
    <ThemeContext.Provider
      value={{
        theme,
        setTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}