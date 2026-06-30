import { useTheme } from "../layouts/ThemeContext";
import LogoSplashScreen from "./LogoSplashScreen";

/**
 * Full-screen or in-page branded loader (logo animation).
 * Use fullscreen for route guards; inline for page data loading inside layouts.
 */
export default function AppLoadingScreen({
  fullscreen = true,
  exiting = false,
  theme: themeProp,
}) {
  const { theme: contextTheme } = useTheme();
  const theme = themeProp ?? contextTheme;

  return (
    <LogoSplashScreen
      theme={theme}
      exiting={exiting}
      variant={fullscreen ? "fullscreen" : "inline"}
    />
  );
}
