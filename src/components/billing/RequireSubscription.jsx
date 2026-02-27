// src/components/billing/RequireSubscription.jsx
import { useEffect, useMemo, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../auth/useAuth";
import FullScreenLoader from "../ui/FullScreenLoader";

function isActiveRow(row) {
  if (!row) return false;
  if (row.status !== "active") return false;

  // If current_period_end is null, treat as active (free/manual/founder flags)
  if (!row.current_period_end) return true;

  return new Date(row.current_period_end).getTime() > Date.now();
}

export default function RequireSubscription({ children, mode = "require-subscribed" }) {
  const { user } = useAuth();
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState(false);

  const next = useMemo(
    () => encodeURIComponent(location.pathname + location.search),
    [location.pathname, location.search]
  );

  useEffect(() => {
    let mounted = true;

    async function run() {
      if (!user) return;
      setLoading(true);

      const { data, error } = await supabase
        .from("pro_subscriptions")
        .select("status, plan, current_period_end")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!mounted) return;

      const ok = !error && isActiveRow(data);
      setActive(ok);
      setLoading(false);
    }

    run();
    return () => {
      mounted = false;
    };
  }, [user]);

  if (loading) return <FullScreenLoader label="Checking your plan..." />;

  // require-subscribed: must have ANY active plan (free counts)
  if (mode === "require-subscribed") {
    if (!active) return <Navigate to={`/pricing?next=${next}`} replace />;
    return children;
  }

  // require-not-subscribed: must have NO active plan
  if (mode === "require-not-subscribed") {
    if (active) return <Navigate to="/app" replace />;
    return children;
  }

  // unknown mode => fail safe
  return <Navigate to={`/pricing?next=${next}`} replace />;
}
