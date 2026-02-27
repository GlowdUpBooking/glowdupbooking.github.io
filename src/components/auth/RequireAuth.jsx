import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./useAuth";

export default function RequireAuth({ children }) {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }

  // Block client accounts from accessing the pro dashboard.
  // Existing pro accounts with no role are allowed for backwards compatibility.
  if (user.user_metadata?.role === "client") {
    return <Navigate to="/login?blocked=client" replace />;
  }

  return children;
}
