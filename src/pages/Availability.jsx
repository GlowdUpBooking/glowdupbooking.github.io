import { useNavigate } from "react-router-dom";
import AppShell from "../components/layout/AppShell";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import { supabase } from "../lib/supabase";

export default function Availability() {
  const nav = useNavigate();

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  return (
    <AppShell title="Availability" onSignOut={signOut}>
      <div className="g-page">
        <Card style={{ padding: 18 }}>
          <h1 className="g-h1" style={{ marginBottom: 8 }}>Availability</h1>
          <p className="u-muted" style={{ marginBottom: 16 }}>
            Availability editing is available in Settings for now. A dedicated page is coming soon.
          </p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Button variant="primary" onClick={() => nav("/app/settings")}>
              Open Settings
            </Button>
            <Button variant="outline" onClick={() => nav("/app")}>
              Back to dashboard
            </Button>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
