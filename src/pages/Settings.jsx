import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppShell from "../components/layout/AppShell";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import { supabase } from "../lib/supabase";

const fieldStyle = {
  width: "100%",
  minHeight: 44,
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.2)",
  background: "rgba(0,0,0,0.35)",
  color: "#f3f3f3",
  padding: "10px 12px",
};

export default function Settings() {
  const nav = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");

  const [userId, setUserId] = useState(null);
  const [hasLocation, setHasLocation] = useState(false);
  const [travelsToClients, setTravelsToClients] = useState(false);
  const [displayLocation, setDisplayLocation] = useState("");
  const [travelRadius, setTravelRadius] = useState("");

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      const { data: authRes, error: authErr } = await supabase.auth.getUser();
      const u = authRes?.user ?? null;
      if (authErr || !u) {
        nav("/login", { replace: true });
        return;
      }

      const { data: profile, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", u.id)
        .maybeSingle();

      if (!mounted) return;
      if (error) {
        setErr("Could not load settings.");
      }

      setUserId(u.id);
      setHasLocation(Boolean(profile?.has_location));
      setTravelsToClients(Boolean(profile?.travels_to_clients));
      setDisplayLocation(profile?.display_location ?? "");
      setTravelRadius(
        profile?.travel_radius_miles == null ? "" : String(profile?.travel_radius_miles)
      );
      setLoading(false);
    })();

    return () => {
      mounted = false;
    };
  }, [nav]);

  async function onSave() {
    if (!userId) return;
    setSaving(true);
    setErr("");
    setMsg("");
    try {
      const payload = {
        id: userId,
        has_location: hasLocation,
        travels_to_clients: travelsToClients,
        display_location: displayLocation.trim() || null,
        travel_radius_miles:
          travelRadius === "" || Number.isNaN(Number(travelRadius))
            ? null
            : Math.max(0, Math.trunc(Number(travelRadius))),
      };
      const { error } = await supabase.from("profiles").upsert(payload, { onConflict: "id" });
      if (error) throw error;
      setMsg("Settings saved.");
    } catch (e) {
      console.error("[Settings] save error:", e);
      setErr("Could not save settings. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  if (loading) {
    return (
      <AppShell title="Settings" onSignOut={signOut}>
        <Card>Loading settings…</Card>
      </AppShell>
    );
  }

  return (
    <AppShell title="Settings" onSignOut={signOut}>
      <div className="g-page">
        <h1 className="g-h1">Settings</h1>
        <Card>
          <div style={{ display: "grid", gap: 12, maxWidth: 760 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <input
                type="checkbox"
                checked={hasLocation}
                onChange={(e) => setHasLocation(e.target.checked)}
              />
              <span>I have a business location clients can visit</span>
            </label>

            <label style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <input
                type="checkbox"
                checked={travelsToClients}
                onChange={(e) => setTravelsToClients(e.target.checked)}
              />
              <span>I travel to clients (mobile service)</span>
            </label>

            <label style={{ display: "grid", gap: 6 }}>
              <span>Display location</span>
              <input
                style={fieldStyle}
                placeholder="City, State"
                value={displayLocation}
                onChange={(e) => setDisplayLocation(e.target.value)}
              />
            </label>

            <label style={{ display: "grid", gap: 6 }}>
              <span>Travel radius (miles)</span>
              <input
                style={fieldStyle}
                inputMode="numeric"
                placeholder="10"
                value={travelRadius}
                onChange={(e) => setTravelRadius(e.target.value)}
              />
            </label>
          </div>

          {err ? <div style={{ marginTop: 12 }}>{err}</div> : null}
          {msg ? <div style={{ marginTop: 12 }}>{msg}</div> : null}

          <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
            <Button variant="primary" onClick={onSave} disabled={saving}>
              {saving ? "Saving..." : "Save settings"}
            </Button>
            <Button variant="outline" onClick={() => nav("/app/onboarding/payouts")}>
              Payout setup
            </Button>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
