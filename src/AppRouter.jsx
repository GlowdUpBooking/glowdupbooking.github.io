import { Suspense, lazy, useEffect } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";

// ✅ Route guards
import RequireAuth from "./components/auth/RequireAuth";
import RequireSubscription from "./components/billing/RequireSubscription";
import RequireOnboarding from "./components/onboarding/RequireOnboarding";
import FullScreenLoader from "./components/ui/FullScreenLoader";

// Lazy-loaded pages for code-splitting
const Home = lazy(() => import("./pages/Home"));
const Login = lazy(() => import("./pages/Login"));
const Signup = lazy(() => import("./pages/Signup"));
const VerifyEmail = lazy(() => import("./pages/VerifyEmail"));
const App = lazy(() => import("./pages/App"));
const Booking = lazy(() => import("./pages/Booking"));
const Calendar = lazy(() => import("./pages/Calendar"));
const Profile = lazy(() => import("./pages/Profile"));
const Settings = lazy(() => import("./pages/Settings"));
const Services = lazy(() => import("./pages/Services"));
const Support = lazy(() => import("./pages/Support"));
const Payouts = lazy(() => import("./pages/Payouts"));
const Pricing = lazy(() => import("./pages/Pricing"));
const Onboarding = lazy(() => import("./pages/Onboarding"));

import { trackPageView } from "./lib/analytics";
import { getSignupPath, isSignupPaused } from "./lib/siteFlags";

function RouteTracker() {
  const location = useLocation();

  useEffect(() => {
    const fullPath = `${location.pathname}${location.search || ""}`;
    trackPageView(fullPath);
  }, [location.pathname, location.search]);

  return null;
}

export default function AppRouter() {
  const signupPaused = isSignupPaused();

  return (
    <>
      <RouteTracker />
      <Suspense fallback={<FullScreenLoader label="Loading..." />}>
        <Routes>
          {/* Public marketing */}
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route
            path="/signup"
            element={signupPaused ? <Navigate to={getSignupPath()} replace /> : <Signup />}
          />
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route path="/book/:code" element={<Booking />} />
          <Route path="/professional/:id" element={<Booking />} />
          <Route path="/support" element={<Support />} />

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
            path="/app/onboarding/*"
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

          <Route
            path="/app/calendar"
            element={
              <RequireAuth>
                <RequireOnboarding>
                  <Calendar />
                </RequireOnboarding>
              </RequireAuth>
            }
          />

          <Route
            path="/app/profile"
            element={
              <RequireAuth>
                <RequireOnboarding>
                  <Profile />
                </RequireOnboarding>
              </RequireAuth>
            }
          />

          <Route
            path="/app/settings"
            element={
              <RequireAuth>
                <RequireOnboarding>
                  <Settings />
                </RequireOnboarding>
              </RequireAuth>
            }
          />

          <Route
            path="/app/services"
            element={
              <RequireAuth>
                <RequireOnboarding>
                  <Services />
                </RequireOnboarding>
              </RequireAuth>
            }
          />

          <Route
            path="/app/payouts"
            element={
              <RequireAuth>
                <RequireOnboarding>
                  <Payouts />
                </RequireOnboarding>
              </RequireAuth>
            }
          />

          <Route path="/app/support" element={<Navigate to="/support" replace />} />

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </>
  );
}
