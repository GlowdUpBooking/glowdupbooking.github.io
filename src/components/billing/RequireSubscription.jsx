import { useEffect, useMemo, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../auth/AuthProvider";
import FullScreenLoader from "../ui/FullScreenLoader";

function computeAllowed(row) {
  if (!row) return false;
  if (row.status !== "active") return false;
  if (row.plan !== "pro") return false;

  // If current_period_end is null, treat as allowed (ex: founder/manual)
  if (!row.current_period_end) return true;

  return new Date(row.current_period_end).getTime() > Date.now();
}

export default function RequireSubscription({ children }) {
  const { user } = useAuth();
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);

  const next = useMemo(
    () => encodeURIComponent(location.pathname + location.search),
    [location.pathname, location.search]
  );

  useEffect(() => {
    let mounted = true;

    async function run() {
      if (!user) return; // RequireAuth should run before this
      setLoading(true);

      const { data, error } = await supabase
        .from("pro_subscriptions")
        .select("status, plan, current_period_end")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!mounted) return;

      const ok = !error && computeAllowed(data);
      setAllowed(ok);
      setLoading(false);
    }

    run();
    return () => {
      mounted = false;
    };
  }, [user]);

  if (loading) return <FullScreenLoader label="Checking your subscription..." />;

  if (!allowed) {
    return <Navigate to={`/pricing?next=${next}`} replace />;
  }

  return children;
}