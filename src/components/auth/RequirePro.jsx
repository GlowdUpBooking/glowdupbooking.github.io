import { useEffect, useMemo, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useAuth } from "./useAuth";
import FullScreenLoader from "../ui/FullScreenLoader";
import { isPlatformAdminUser } from "../../lib/platformAdmin";
import { isClientRole, isProRole, normalizeRole, roleForProfileWrite } from "../../lib/roles";

export default function RequirePro({ children }) {
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
      if (!user) return;
      setLoading(true);

      const metaRole = normalizeRole(user.user_metadata?.role);
      if (isClientRole(metaRole)) {
        if (mounted) {
          setAllowed(false);
          setLoading(false);
        }
        return;
      }

      const { data: profile, error: profileErr } = await supabase
        .from("profiles")
        .select("id, role, onboarding_step")
        .eq("id", user.id)
        .maybeSingle();

      if (!mounted) return;

      const profileRole = normalizeRole(profile?.role);
      if (isClientRole(profileRole)) {
        setAllowed(false);
        setLoading(false);
        return;
      }

      if (isProRole(profileRole)) {
        setAllowed(true);
        setLoading(false);
        return;
      }

      if (!profile || profileErr) {
        if (isProRole(metaRole)) {
          const { error } = await supabase
            .from("profiles")
            .upsert(
              { id: user.id, role: roleForProfileWrite(metaRole), onboarding_step: "basics" },
              { onConflict: "id" }
            );
          if (!mounted) return;
          setAllowed(!error);
          setLoading(false);
          return;
        }
      }

      if (isProRole(metaRole)) {
        const { error } = await supabase
          .from("profiles")
          .update({ role: roleForProfileWrite(metaRole) })
          .eq("id", user.id);
        if (!mounted) return;
        if (!error) {
          setAllowed(true);
          setLoading(false);
          return;
        }
      }

      // Final fallback: if a pro subscription exists, allow access.
      const { data: subRow } = await supabase
        .from("pro_subscriptions")
        .select("user_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!mounted) return;
      setAllowed(Boolean(subRow));
      setLoading(false);
    }

    run();
    return () => {
      mounted = false;
    };
  }, [user]);

  if (!user) return <Navigate to={`/login?next=${next}`} replace />;
  if (isPlatformAdminUser(user)) return <Navigate to="/admin" replace />;
  if (loading) return <FullScreenLoader label="Checking account access..." />;

  if (!allowed) {
    return <Navigate to="/login?blocked=client" replace />;
  }

  return children;
}
