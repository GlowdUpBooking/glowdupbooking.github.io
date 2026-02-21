import { useEffect } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";

import Home from "./pages/Home";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import VerifyEmail from "./pages/VerifyEmail";
import App from "./pages/App";

// Pricing / Paywall
import Pricing from "./pages/Pricing";

// ✅ Route guards
import RequireAuth from "./components/auth/RequireAuth";
import RequireSubscription from "./components/billing/RequireSubscription";
import RequireOnboarding from "./components/onboarding/RequireOnboarding";

// Onboarding (existing file in your tree)
import Onboarding from "./pages/Onboarding";
import { trackPageView } from "./lib/analytics";

function RouteTracker() {
  const location = useLocation();

  useEffect(() => {
    const fullPath = `${location.pathname}${location.search || ""}`;
    trackPageView(fullPath);
  }, [location.pathname, location.search]);

  return null;
}

export default function AppRouter() {
  return (
    <>
      <RouteTracker />
      <Routes>
        {/* Public marketing */}
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/verify-email" element={<VerifyEmail />} />

        {/* Pricing page (public ok; you can keep it public or wrap it later) */}
        <Route path="/pricing" element={<Pricing />} />

        {/* Paywall page: only for logged-in users who are NOT Pro/Founder */}
        <Route
          path="/paywall"
          element={
            <RequireAuth>
              <RequireSubscription mode="require-not-subscribed">
                <Pricing />
              </RequireSubscription>
            </RequireAuth>
          }
        />

        {/* Onboarding: allow all logged-in users (starter/free included) */}
        <Route
          path="/app/onboarding"
          element={
            <RequireAuth>
              <Onboarding />
            </RequireAuth>
          }
        />

        {/* App Dashboard: allow all logged-in users, but still enforce onboarding completion */}
        <Route
          path="/app"
          element={
            <RequireAuth>
              <RequireOnboarding>
                <App />
              </RequireOnboarding>
            </RequireAuth>
          }
        />

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
