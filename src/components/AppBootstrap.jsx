import { useEffect, useState } from "react";
import { useTheme } from "../layouts/ThemeContext";
import LogoSplashScreen from "./LogoSplashScreen";
import App from "../App";

const MIN_SPLASH_MS = 1500;
const EXIT_MS = 480;

export default function AppBootstrap() {
  const { theme } = useTheme();
  const [phase, setPhase] = useState("loading");

  useEffect(() => {
    let doneTimer;
    let cancelled = false;

    const finish = () => {
      if (cancelled) return;
      setPhase("exiting");
      doneTimer = window.setTimeout(() => {
        if (!cancelled) setPhase("done");
      }, EXIT_MS);
    };

    const minDelay = new Promise((resolve) => {
      window.setTimeout(resolve, MIN_SPLASH_MS);
    });
    const fontsReady = document.fonts?.ready ?? Promise.resolve();

    Promise.all([minDelay, fontsReady]).then(finish);

    return () => {
      cancelled = true;
      window.clearTimeout(doneTimer);
    };
  }, []);

  return (
    <>
      <App />
      {phase !== "done" && (
        <LogoSplashScreen theme={theme} exiting={phase === "exiting"} />
      )}
    </>
  );
}
