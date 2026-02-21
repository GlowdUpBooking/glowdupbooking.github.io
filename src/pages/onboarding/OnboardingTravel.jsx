// src/pages/onboarding/Travel.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import OnboardingProgress from "../../components/onboarding/OnboardingProgress";

export default function Travel() {
  const nav = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [autosaveStatus, setAutosaveStatus] = useState("Loading...");
  const hydrated = useRef(false);

  const [userId, setUserId] = useState(null);

  const [travels, setTravels] = useState(true); // on this page we assume mobile
  const [travelFee, setTravelFee] = useState(""); // numeric string
  const [travelRadiusMiles, setTravelRadiusMiles] = useState(""); // numeric string

  useEffect(() => {
    let mounted = true;

    (async () => {
      setLoading(true);
      setErr("");

      const { data: authRes, error: authErr } = await supabase.auth.getUser();
      const u = authRes?.user ?? null;
      if (!u || authErr) {
        nav("/login");
        return;
      }

      setUserId(u.id);

      const { data: profile, error } = await supabase
        .from("profiles")
        .select("travels_to_clients, travel_fee, travel_radius_miles")
        .eq("id", u.id)
        .maybeSingle();

      if (!mounted) return;

      if (!error && profile) {
        setTravels(profile.travels_to_clients ?? true);
        setTravelFee(profile.travel_fee != null ? String(profile.travel_fee) : "");
        setTravelRadiusMiles(profile.travel_radius_miles != null ? String(profile.travel_radius_miles) : "");
      }

      hydrated.current = true;
      setAutosaveStatus("Ready");
      setLoading(false);
    })();

    return () => {
      mounted = false;
    };
  }, [nav]);

  const feeNum = useMemo(() => (travelFee === "" ? null : Number(travelFee)), [travelFee]);
  const radiusNum = useMemo(
    () => (travelRadiusMiles === "" ? null : Number(travelRadiusMiles)),
    [travelRadiusMiles]
  );

  const hasValidNumbers = useMemo(() => {
    if (!travels) return true; // if they toggle off, no numbers needed
    if (feeNum == null || radiusNum == null) return false;
    if (Number.isNaN(feeNum) || Number.isNaN(radiusNum)) return false;
    if (feeNum < 0 || radiusNum < 0) return false;
    return true;
  }, [travels, feeNum, radiusNum]);

  async function onContinue() {
    if (!userId) return;
    setErr("");

    if (!hasValidNumbers) {
      setErr("Please enter a valid travel fee and travel radius (non-negative numbers).");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        travels_to_clients: travels,
        travel_fee: travels ? feeNum : 0,
        travel_radius_miles: travels ? Math.trunc(radiusNum) : 0,
        onboarding_step: "travel",
      };

      const { error: updateErr } = await supabase.from("profiles").update(payload).eq("id", userId);
      if (updateErr) throw updateErr;

      await supabase.from("profiles").update({ onboarding_step: "social" }).eq("id", userId);
      nav("/app/onboarding/social");
    } catch (e) {
      console.error("[Travel] save error:", e);
      setErr("Couldn’t save your travel settings. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    if (!hydrated.current || !userId) return;
    const t = setTimeout(async () => {
      setAutosaveStatus("Saving...");
      const payload = {
        id: userId,
        travels_to_clients: travels,
        travel_fee: travels ? feeNum : 0,
        travel_radius_miles: travels ? Math.trunc(radiusNum ?? 0) : 0,
      };
      const { error } = await supabase.from("profiles").upsert(payload, { onConflict: "id" });
      setAutosaveStatus(error ? "Autosave failed" : "Saved");
    }, 600);
    return () => clearTimeout(t);
  }, [userId, travels, feeNum, radiusNum]);

  if (loading) return null;

  return (
    <div className="page">
      <div className="bg" aria-hidden="true" />
      <main className="container">
        <section className="heroPanel">
          <h1>Travel</h1>
          <p style={{ maxWidth: 720 }}>
            Set your travel details so clients know what to expect.
          </p>
          <OnboardingProgress active="profile" autosaveStatus={autosaveStatus} />

          <label style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 18 }}>
            <input
              type="checkbox"
              checked={travels}
              onChange={(e) => setTravels(e.target.checked)}
            />
            <span>Yes, I travel to clients</span>
          </label>

          {travels ? (
            <div style={{ marginTop: 14 }}>
              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontSize: 13, opacity: 0.9, fontWeight: 700 }}>
                  Travel fee (USD)
                </span>
                <input
                  className="input"
                  inputMode="decimal"
                  placeholder="Example: 15"
                  value={travelFee}
                  onChange={(e) => setTravelFee(e.target.value)}
                />
                <span className="heroMicro">
                  Enter <strong>0</strong> if you don’t charge a travel fee.
                </span>
              </label>

              <div style={{ height: 10 }} />

              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontSize: 13, opacity: 0.9, fontWeight: 700 }}>
                  Max travel distance (miles)
                </span>
                <input
                  className="input"
                  inputMode="numeric"
                  placeholder="Example: 10"
                  value={travelRadiusMiles}
                  onChange={(e) => setTravelRadiusMiles(e.target.value)}
                />
                <span className="heroMicro">
                  This sets how far clients can book mobile appointments.
                </span>
              </label>

              <p className="heroMicro" style={{ marginTop: 10 }}>
                Tip: Use <strong>0</strong> travel fee if you don’t charge, and set a realistic mile radius.
              </p>
            </div>
          ) : (
            <p className="heroMicro" style={{ marginTop: 12 }}>
              You can enable mobile travel later anytime.
            </p>
          )}

          {err ? <div style={{ marginTop: 14, opacity: 0.9 }}>{err}</div> : null}

          <div className="heroBtns" style={{ marginTop: 18 }}>
            <button className="btn gold" onClick={onContinue} disabled={!hasValidNumbers || saving}>
              {saving ? "Saving…" : "Continue"}
            </button>
          </div>

          {!hasValidNumbers ? (
            <p className="heroMicro" style={{ marginTop: 10 }}>
              Travel fee + miles are required (and must be non-negative).
            </p>
          ) : null}
        </section>
      </main>
    </div>
  );
}
