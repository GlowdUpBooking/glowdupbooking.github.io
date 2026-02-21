import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import AppRouter from "./AppRouter";
import { AuthProvider } from "./components/auth/AuthProvider";

import "./index.css";
// IMPORTANT: app.css contains global .card styles that break the home pricing grid
// import "./styles/app.css";
import "./styles/landing.css";
import "./styles/onboarding-dashboard.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AuthProvider>
      <BrowserRouter>
        <AppRouter />
      </BrowserRouter>
    </AuthProvider>
  </React.StrictMode>
);
