import { useNavigate } from "react-router-dom";
import AppShell from "../components/layout/AppShell";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import { supabase } from "../lib/supabase";

export default function Analytics() {
  const nav = useNavigate();

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  return (
    <AppShell title="Analytics" onSignOut={signOut}>
      <div className="g-page">
        <Card style={{ padding: 18 }}>
          <h1 className="g-h1" style={{ marginBottom: 8 }}>Analytics</h1>
          <p className="u-muted" style={{ marginBottom: 16 }}>
            This section is wired to the mobile app and is coming to web next.
          </p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Button variant="outline" onClick={() => nav("/app")}>
              Back to dashboard
            </Button>
            <Button variant="primary" onClick={() => nav("/support")}>
              Request analytics
            </Button>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
