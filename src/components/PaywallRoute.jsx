import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

export default function PaywallRoute({ children }) {
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function run() {
      setLoading(true);

      // must be logged in first
      const { data: userRes } = await supabase.auth.getUser();
      const user = userRes?.user;

      if (!user) {
        if (mounted) {
          setAllowed(false);
          setLoading(false);
        }
        return;
      }

      // check pro_subscriptions for active status
      const { data, error } = await supabase
        .from("pro_subscriptions")
        .select("status, current_period_end")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!mounted) return;

      // Allowed if active (you can tighten later with period_end checks)
      setAllowed(!error && data?.status === "active");
      setLoading(false);
    }

    run();
    return () => {
      mounted = false;
    };
  }, []);

  if (loading) return null; // or a spinner component
  if (!allowed) return <Navigate to="/pricing" replace />;

  return children;
}