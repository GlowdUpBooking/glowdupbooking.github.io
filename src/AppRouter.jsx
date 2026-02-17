import { useEffect, useState } from "react";
import { Routes, Route } from "react-router-dom";
import { supabase } from "./lib/supabase";

import Home from "./pages/Home";
import Pricing from "./pages/Pricing";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import App from "./pages/App";
import ProtectedRoute from "./components/ProtectedRoute";

// ✅ Onboarding pages
import OnboardingIndex from "./pages/onboarding/OnboardingIndex";
import OnboardingBasics from "./pages/onboarding/OnboardingBasics";
import OnboardingLocation from "./pages/onboarding/OnboardingLocation";
import OnboardingTravel from "./pages/onboarding/OnboardingTravel";
import OnboardingSocial from "./pages/onboarding/OnboardingSocial";
import OnboardingServices from "./pages/onboarding/OnboardingServices";

export default function AppRouter() {
  const [session, setSession] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data?.session ?? null);
      setReady(true);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!mounted) return;
      setSession(newSession);
    });

    return () => {
      mounted = false;
      sub?.subscription?.unsubscribe?.();
    };
  }, []);

  if (!ready) return null;

  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/pricing" element={<Pricing />} />
      <Route path="/login" element={<Login session={session} />} />
      <Route path="/signup" element={<Signup session={session} />} />

      {/* ✅ Onboarding (protected) */}
      <Route
        path="/app/onboarding"
        element={
          <ProtectedRoute>
            <OnboardingIndex />
          </ProtectedRoute>
        }
      />
      <Route
        path="/app/onboarding/basics"
        element={
          <ProtectedRoute>
            <OnboardingBasics />
          </ProtectedRoute>
        }
      />
      <Route
        path="/app/onboarding/location"
        element={
          <ProtectedRoute>
            <OnboardingLocation />
          </ProtectedRoute>
        }
      />
      <Route
        path="/app/onboarding/travel"
        element={
          <ProtectedRoute>
            <OnboardingTravel />
          </ProtectedRoute>
        }
      />
      <Route
        path="/app/onboarding/social"
        element={
          <ProtectedRoute>
            <OnboardingSocial />
          </ProtectedRoute>
        }
      />
      <Route
        path="/app/onboarding/services"
        element={
          <ProtectedRoute>
            <OnboardingServices />
          </ProtectedRoute>
        }
      />

      {/* ✅ Dashboard */}
      <Route
        path="/app"
        element={
          <ProtectedRoute>
            <App />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}