import { useNavigate } from "react-router-dom";
import AppShell from "../components/layout/AppShell";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import { supabase } from "../lib/supabase";

export default function Calendar() {
  const nav = useNavigate();

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  return (
    <AppShell title="Calendar" onSignOut={signOut}>
      <div className="g-page">
        <h1 className="g-h1">Calendar</h1>
        <Card>
          <div style={{ display: "grid", gap: 12 }}>
            <div className="u-muted">Your upcoming bookings will appear here.</div>

            <div style={{ display: "grid", gap: 6 }}>
              <strong>No bookings yet</strong>
              <div className="u-muted">
                Add services and set availability to start receiving client bookings.
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Button variant="primary" onClick={() => nav("/app/services")}>
                Manage services
              </Button>
              <Button variant="outline" onClick={() => nav("/app/settings")}>
                Set availability
              </Button>
              <Button variant="outline" onClick={() => nav("/app")}>
                Back to dashboard
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
