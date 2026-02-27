import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import FullScreenLoader from "../ui/FullScreenLoader";
import AuthContext from "./authContext";

export function AuthProvider({ children }) {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);

  useEffect(() => {
    let mounted = true;

    async function init() {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;

      const sess = data?.session ?? null;
      setSession(sess);
      setUser(sess?.user ?? null);
      setReady(true);
    }

    init();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!mounted) return;
      setSession(newSession);
      setUser(newSession?.user ?? null);
      setReady(true);
    });

    return () => {
      mounted = false;
      sub?.subscription?.unsubscribe?.();
    };
  }, []);

  const value = useMemo(() => ({ ready, session, user }), [ready, session, user]);

  // Optional: you can remove this loader if you prefer to render nothing
  if (!ready) return <FullScreenLoader label="Preparing your session..." />;

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
