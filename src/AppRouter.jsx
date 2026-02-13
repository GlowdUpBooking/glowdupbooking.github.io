import { useEffect, useState } from "react";
import { Routes, Route } from "react-router-dom";
import { supabase } from "./lib/supabase";

import Home from "./pages/Home";
import Pricing from "./pages/Pricing";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import App from "./pages/App";
import ProtectedRoute from "./components/ProtectedRoute";
import PaywallRoute from "./components/PaywallRoute"; // ✅ add this

export default function AppRouter() {
  const [session, setSession] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data?.session ?? null);
      setReady(true);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => sub?.subscription?.unsubscribe?.();
  }, []);

  if (!ready) return null;

  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/pricing" element={<Pricing />} />
      <Route path="/login" element={<Login session={session} />} />
      <Route path="/signup" element={<Signup session={session} />} />
      <Route
        path="/app"
        element={
          <ProtectedRoute>
            <PaywallRoute>
              <App />
            </PaywallRoute>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}