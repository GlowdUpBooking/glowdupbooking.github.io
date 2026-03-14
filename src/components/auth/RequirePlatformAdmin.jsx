import { useMemo } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./useAuth";
import { isPlatformAdminUser } from "../../lib/platformAdmin";

export default function RequirePlatformAdmin({ children }) {
  const { user } = useAuth();
  const location = useLocation();

  const next = useMemo(
    () => encodeURIComponent(location.pathname + location.search),
    [location.pathname, location.search]
  );

  if (!user) {
    return <Navigate to={`/login?next=${next}`} replace />;
  }

  if (!isPlatformAdminUser(user)) {
    return <Navigate to="/" replace />;
  }

  return children;
}
