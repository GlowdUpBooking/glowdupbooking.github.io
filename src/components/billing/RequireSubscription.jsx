// src/components/billing/RequireSubscription.jsx
import { useEffect, useMemo, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { fetchEffectiveBillingAccess } from "../../lib/billingAccess";
import { useAuth } from "../auth/useAuth";
import FullScreenLoader from "../ui/FullScreenLoader";

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
      if (!user) {
        if (mounted) {
          setActive(false);
          setLoading(false);
        }
        return;
      }
      setLoading(true);

      if (!mounted) return;

      const access = await fetchEffectiveBillingAccess(user.id);
      if (!mounted) return;

      if (access.warnings.subscription) {
        console.warn("[RequireSubscription] pro_subscriptions warning:", access.warnings.subscription);
      }
      if (access.warnings.profile) {
        console.warn("[RequireSubscription] profiles billing warning:", access.warnings.profile);
      }
      if (access.warnings.studioAccess) {
        console.warn("[RequireSubscription] studio access warning:", access.warnings.studioAccess);
      }

      setActive(access.hasActiveAccess);
      setLoading(false);
    }

    run();
    return () => {
      mounted = false;
    };
  }, [user]);

  if (!user && !loading) return <Navigate to={`/login?next=${next}`} replace />;
  if (loading) return <FullScreenLoader label="Checking your plan..." />;

  // require-subscribed: must have paid or studio-backed access
  if (mode === "require-subscribed") {
    if (!active) return <Navigate to={`/pricing?next=${next}`} replace />;
    return children;
  }

  // require-not-subscribed: only free users should continue through
  if (mode === "require-not-subscribed") {
    if (active) return <Navigate to="/app" replace />;
    return children;
  }

  // unknown mode => fail safe
  return <Navigate to={`/pricing?next=${next}`} replace />;
}
