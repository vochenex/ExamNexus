import "./styles/motion.css";
import "./styles/splash.css";
import "./index.css";
import "./styles/native-app.css";
import "./styles/auth.css";
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import AppBootstrap from "./components/AppBootstrap.jsx";
import { ThemeProvider } from "./layouts/ThemeContext";
import { AssessmentLockdownProvider } from "./contexts/AssessmentLockdownContext";
import { AppModalProvider } from "./contexts/AppModalContext";
import { clearStaleAccountCacheOnLoad } from "./utils/sessionReset";
import { initNativeApp } from "./utils/nativeApp";
import { initMobileShell } from "./utils/mobileShell";
import { initIosInputZoomFix } from "./utils/iosInputZoom";
import { registerServiceWorker } from "./utils/pwa";
import "@fontsource/poppins/400.css";
import "@fontsource/poppins/500.css";
import "@fontsource/poppins/600.css";
import "@fontsource/poppins/700.css";

clearStaleAccountCacheOnLoad();
initNativeApp();
initMobileShell();
initIosInputZoomFix();
registerServiceWorker();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ThemeProvider>
      <BrowserRouter>
        <AppModalProvider>
          <AssessmentLockdownProvider>
            <AppBootstrap />
          </AssessmentLockdownProvider>
        </AppModalProvider>
      </BrowserRouter>
    </ThemeProvider>
  </React.StrictMode>
);