import ThemeToggle from "./ThemeToggle";
import ExamNexusBrand from "./ExamNexusBrand";
import InstallIconButton from "./pwa/InstallIconButton";
import { isNativeApp } from "../utils/platform";

/** Same top bar chrome as the logged-in mobile dashboard header. */
export default function NativeAuthHeader() {
  return (
    <header className="en-native-auth-header">
      <ExamNexusBrand
        variant="compact"
        logoSize={28}
        showTagline={false}
        idSuffix="auth-top"
      />
      <div className="en-native-topbar-actions">
        {!isNativeApp() && <InstallIconButton compact />}
        <ThemeToggle compact />
      </div>
    </header>
  );
}
