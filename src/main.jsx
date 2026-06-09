import "./index.css";
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import App from "./App.jsx";
import { ThemeProvider } from "./layouts/ThemeContext";
import { AssessmentLockdownProvider } from "./contexts/AssessmentLockdownContext";
import "@fontsource/poppins/400.css";
import "@fontsource/poppins/500.css";
import "@fontsource/poppins/600.css";
import "@fontsource/poppins/700.css";
ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ThemeProvider>
      <BrowserRouter>
        <AssessmentLockdownProvider>
          <App />
        </AssessmentLockdownProvider>
      </BrowserRouter>
    </ThemeProvider>
  </React.StrictMode>
);