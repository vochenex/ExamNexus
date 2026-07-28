import { useNavigationProgress } from "../contexts/NavigationProgressContext";
import { useAppSplash } from "../contexts/AppSplashContext";
import LogoSplashScreen from "./LogoSplashScreen";
import { useTheme } from "../layouts/ThemeContext";

/**
 * Top progress bar + click-blocking overlay while a route change is in flight.
 * Also shows the logo splash when AppSplashContext reports a blocking load.
 */
export default function NavigationProgressOverlay() {
  const { isNavigating } = useNavigationProgress();
  const { blocking } = useAppSplash();
  const { theme } = useTheme();

  if (blocking) {
    return <LogoSplashScreen theme={theme} />;
  }

  if (!isNavigating) return null;

  return (
    <>
      <div className="en-nav-progress" role="progressbar" aria-label="Loading page" aria-busy="true">
        <div className="en-nav-progress__bar" />
      </div>
      <div
        className="en-nav-blocker"
        aria-hidden="true"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
        }}
        onPointerDown={(event) => {
          event.preventDefault();
          event.stopPropagation();
        }}
      />
    </>
  );
}
