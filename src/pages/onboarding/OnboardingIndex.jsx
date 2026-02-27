import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import FullScreenLoader from "../../components/ui/FullScreenLoader";

const STEP_TO_ROUTE = {
  "role-selection": "/app/onboarding/basics", // legacy default
  basics: "/app/onboarding/basics",
  location: "/app/onboarding/location",
  travel: "/app/onboarding/travel",
  social: "/app/onboarding/social",
  services: "/app/onboarding/services",
  payouts: "/app/onboarding/payouts",
  complete: "/app",
};

function normalizeRole(value) {
  const v = String(value || "").trim().toLowerCase();
  if (v === "pro" || v === "professional") return "pro";
  if (v === "client") return "client";
  return null;
}

export default function OnboardingIndex() {
  const nav = useNavigate();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    (async () => {
      setLoading(true);

      // 1) Must be signed in
      const { data: authRes, error: authErr } = await supabase.auth.getUser();
      const user = authRes?.user ?? null;

      if (!user || authErr) {
        nav("/login");
        return;
      }

      // 2) Load profile row (don't hard-fail if missing)
      const { data: profile, error: profileErr } = await supabase
        .from("profiles")
        .select("id, role, onboarding_step")
        .eq("id", user.id)
        .maybeSingle();

      if (!mounted) return;

      const metaRole = normalizeRole(user?.user_metadata?.role);

      // 3) If profile doesn't exist yet, create it only for pro accounts
      if (profileErr || !profile) {
        if (metaRole !== "pro") {
          nav("/login?blocked=client");
          setLoading(false);
          return;
        }

        await supabase
          .from("profiles")
          .upsert(
            {
              id: user.id,
              role: "professional",
              onboarding_step: "basics",
            },
            { onConflict: "id" }
          );

        nav("/app/onboarding/basics");
        setLoading(false);
        return;
      }

      // 4) Block non-pro profiles from entering pro onboarding
      const profileRole = normalizeRole(profile.role);
      if (profileRole === "client") {
        nav("/login?blocked=client");
        setLoading(false);
        return;
      }

      // 5) Route by onboarding_step
      const step = profile.onboarding_step || "basics";
      nav(STEP_TO_ROUTE[step] || "/app/onboarding/basics");
      setLoading(false);
    })();

    return () => {
      mounted = false;
    };
  }, [nav]);

  if (loading) return <FullScreenLoader label="Preparing onboarding..." />;
  return null;
}
