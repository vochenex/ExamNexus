import "./styles/motion.css";
import "./styles/splash.css";
import "./index.css";
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import AppBootstrap from "./components/AppBootstrap.jsx";
import { ThemeProvider } from "./layouts/ThemeContext";
import { AssessmentLockdownProvider } from "./contexts/AssessmentLockdownContext";
import { AppModalProvider } from "./contexts/AppModalContext";
import "@fontsource/poppins/400.css";
import "@fontsource/poppins/500.css";
import "@fontsource/poppins/600.css";
import "@fontsource/poppins/700.css";
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