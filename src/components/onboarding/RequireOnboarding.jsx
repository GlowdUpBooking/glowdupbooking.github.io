import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../auth/useAuth";
import FullScreenLoader from "../ui/FullScreenLoader";

// Map step -> route
const STEP_TO_PATH = {
  basics: "/app/onboarding/basics",
  location: "/app/onboarding/location",
  travel: "/app/onboarding/travel",
  social: "/app/onboarding/social",
  services: "/app/onboarding/services",
  payouts: "/app/onboarding/payouts",
  complete: "/app",
};

function normalizeStep(step) {
  if (!step) return "basics";
  if (step === "done") return "complete";
  return step;
}

export default function RequireOnboarding({ children }) {
  const { user } = useAuth();
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState("basics");

  useEffect(() => {
    let mounted = true;

    async function run() {
      if (!user) return;

      setLoading(true);

      const { data, error } = await supabase
        .from("profiles")
        .select("onboarding_step")
        .eq("id", user.id)
        .maybeSingle();

      if (!mounted) return;

      const nextStep = !error ? normalizeStep(data?.onboarding_step) : "basics";
      setStep(nextStep);
      setLoading(false);
    }

    run();
    return () => {
      mounted = false;
    };
  }, [user]);

  if (loading) return <FullScreenLoader label="Loading your profile..." />;

  // If user hasn't completed onboarding, force them into it.
  if (step !== "complete") {
    const target = STEP_TO_PATH[step] || "/app/onboarding/basics";

    // Avoid redirect loops if they're already on the correct onboarding page
    if (location.pathname !== target && !location.pathname.startsWith("/app/onboarding")) {
      return <Navigate to={target} replace />;
    }
  }

  return children;
}
