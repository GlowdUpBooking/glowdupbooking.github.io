import { Routes, Route, Navigate } from "react-router-dom";

import Home from "./pages/Home";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import App from "./pages/App";

// ✅ Paywall (repurposed Pricing.jsx)
import Pricing from "./pages/Pricing";

// ✅ Onboarding pages
import OnboardingIndex from "./pages/onboarding/OnboardingIndex";
import OnboardingBasics from "./pages/onboarding/OnboardingBasics";
import OnboardingLocation from "./pages/onboarding/OnboardingLocation";
import OnboardingTravel from "./pages/onboarding/OnboardingTravel";
import OnboardingSocial from "./pages/onboarding/OnboardingSocial";
import OnboardingServices from "./pages/onboarding/OnboardingServices";

// ✅ Route guards (components)
import RequireAuth from "./components/auth/RequireAuth";
import RequireSubscription from "./components/billing/RequireSubscription";
import RequireOnboarding from "./components/onboarding/RequireOnboarding";

export default function AppRouter() {
  return (
    <Routes>
      {/* Public marketing */}
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />

      {/* ✅ Paywall (only for logged-in users WITHOUT subscription) */}
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

      {/* ✅ Onboarding (must be logged in + subscribed) */}
      <Route
        path="/app/onboarding"
        element={
          <RequireAuth>
            <RequireSubscription>
              <OnboardingIndex />
            </RequireSubscription>
          </RequireAuth>
        }
      />
      <Route
        path="/app/onboarding/basics"
        element={
          <RequireAuth>
            <RequireSubscription>
              <OnboardingBasics />
            </RequireSubscription>
          </RequireAuth>
        }
      />
      <Route
        path="/app/onboarding/location"
        element={
          <RequireAuth>
            <RequireSubscription>
              <OnboardingLocation />
            </RequireSubscription>
          </RequireAuth>
        }
      />
      <Route
        path="/app/onboarding/travel"
        element={
          <RequireAuth>
            <RequireSubscription>
              <OnboardingTravel />
            </RequireSubscription>
          </RequireAuth>
        }
      />
      <Route
        path="/app/onboarding/social"
        element={
          <RequireAuth>
            <RequireSubscription>
              <OnboardingSocial />
            </RequireSubscription>
          </RequireAuth>
        }
      />
      <Route
        path="/app/onboarding/services"
        element={
          <RequireAuth>
            <RequireSubscription>
              <OnboardingServices />
            </RequireSubscription>
          </RequireAuth>
        }
      />

      {/* ✅ App Dashboard (must be logged in + subscribed + onboarding complete) */}
      <Route
        path="/app"
        element={
          <RequireAuth>
            <RequireSubscription>
              <RequireOnboarding>
                <App />
              </RequireOnboarding>
            </RequireSubscription>
          </RequireAuth>
        }
      />

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}