import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import OnboardingProgress from "../../components/onboarding/OnboardingProgress";

export default function OnboardingBasics() {
  const nav = useNavigate();
  const [saving, setSaving] = useState(false);
  const [autosaveStatus, setAutosaveStatus] = useState("Loading...");
  const [userId, setUserId] = useState(null);
  const [businessName, setBusinessName] = useState("");
  const [businessType, setBusinessType] = useState("");
  const [fullName, setFullName] = useState("");
  const hydrated = useRef(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      const user = data?.user;
      if (!user) return;
      setUserId(user.id);

      const { data: profile } = await supabase
        .from("profiles")
        .select("business_name, business_type, full_name")
        .eq("id", user.id)
        .maybeSingle();

      setBusinessName(profile?.business_name ?? "");
      setBusinessType(profile?.business_type ?? "");
      setFullName(profile?.full_name ?? "");
      hydrated.current = true;
      setAutosaveStatus("Ready");
    })();
  }, []);

  useEffect(() => {
    if (!hydrated.current || !userId) return;

    const t = setTimeout(async () => {
      setAutosaveStatus("Saving...");
      const { error } = await supabase
        .from("profiles")
        .upsert(
          {
            id: userId,
            role: "professional",
            business_name: businessName || null,
            business_type: businessType || null,
            full_name: fullName || null,
          },
          { onConflict: "id" }
        );
      setAutosaveStatus(error ? "Autosave failed" : "Saved");
    }, 500);

    return () => clearTimeout(t);
  }, [userId, businessName, businessType, fullName]);

  async function next() {
    setSaving(true);
    const { data } = await supabase.auth.getUser();
    const user = data?.user;
    if (!user) return;

    await supabase
      .from("profiles")
      .update({
        role: "professional",
        business_name: businessName || null,
        business_type: businessType || null,
        full_name: fullName || null,
        onboarding_step: "location",
      })
      .eq("id", user.id);

    setSaving(false);
    nav("/app/onboarding/location");
  }

  return (
    <div className="obPage page">
      <div className="bg" aria-hidden="true" />
      <main className="container">
        <section className="heroPanel">
          <h1>Basics</h1>
          <p className="heroMicro">Tell us about your business.</p>
          <OnboardingProgress active="profile" autosaveStatus={autosaveStatus} />

          <div style={{ display: "grid", gap: 12, marginTop: 16, maxWidth: 520 }}>
            <input
              className="input"
              placeholder="Full name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
            <input
              className="input"
              placeholder="Business name"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
            />
            <input
              className="input"
              placeholder="Business type (barber, nails, tattoo, etc.)"
              value={businessType}
              onChange={(e) => setBusinessType(e.target.value)}
            />
          </div>

          <div className="heroBtns" style={{ marginTop: 18 }}>
            <button className="btn gold" onClick={next} disabled={saving}>
              {saving ? "Saving..." : "Continue"}
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}
