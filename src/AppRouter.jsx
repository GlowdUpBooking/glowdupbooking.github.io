import { Routes, Route } from "react-router-dom";

import Home from "./pages/Home";
import Pricing from "./pages/Pricing";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import App from "./pages/App";

import RequireAuth from "./components/auth/RequireAuth";
import RequireSubscription from "./components/billing/RequireSubscription";
import RequireOnboarding from "./components/onboarding/RequireOnboarding";
import OnboardingRoutes from "./routes/OnboardingRoutes";

export default function AppRouter() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/" element={<Home />} />
      <Route path="/pricing" element={<Pricing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />

      {/* App onboarding: must be authed + subscribed (but not necessarily onboarded) */}
      <Route
        path="/app/onboarding/*"
        element={
          <RequireAuth>
            <RequireSubscription>
              <OnboardingRoutes />
            </RequireSubscription>
          </RequireAuth>
        }
      />

      {/* Dashboard: authed + subscribed + onboarding complete */}
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
    </Routes>
  );
}