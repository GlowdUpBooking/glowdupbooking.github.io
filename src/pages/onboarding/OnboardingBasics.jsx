import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { roleForProfileWrite } from "../../lib/roles";
import OnboardingProgress from "../../components/onboarding/OnboardingProgress";
import FullScreenLoader from "../../components/ui/FullScreenLoader";

export default function OnboardingBasics() {
  const nav = useNavigate();
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [autosaveStatus, setAutosaveStatus] = useState("Loading...");
  const [userId, setUserId] = useState(null);
  const [businessName, setBusinessName] = useState("");
  const [businessType, setBusinessType] = useState("");
  const [fullName, setFullName] = useState("");
  const [profileRole, setProfileRole] = useState("professional");
  const hydrated = useRef(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      const user = data?.user;
      if (!user) return;
      setUserId(user.id);

      const metaRole = roleForProfileWrite(user.user_metadata?.role);
      const { data: profile } = await supabase
        .from("profiles")
        .select("role, business_name, business_type, full_name")
        .eq("id", user.id)
        .maybeSingle();

      setProfileRole(roleForProfileWrite(profile?.role) ?? metaRole ?? "professional");
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
            role: profileRole,
            business_name: businessName || null,
            business_type: businessType || null,
            full_name: fullName || null,
          },
          { onConflict: "id" }
        );
      setAutosaveStatus(error ? "Autosave failed" : "Saved");
    }, 500);

    return () => clearTimeout(t);
  }, [userId, profileRole, businessName, businessType, fullName]);

  async function next() {
    setSaving(true);
    setErr("");
    const { data } = await supabase.auth.getUser();
    const user = data?.user;
    if (!user) {
      setSaving(false);
      nav("/login");
      return;
    }

    const { error } = await supabase
      .from("profiles")
      .update({
        role: profileRole,
        business_name: businessName || null,
        business_type: businessType || null,
        full_name: fullName || null,
        onboarding_step: "location",
      })
      .eq("id", user.id);

    if (error) {
      setErr("Couldn’t save your basics. Please try again.");
      setSaving(false);
      return;
    }

    setSaving(false);
    nav("/app/onboarding/location");
  }

  if (autosaveStatus === "Loading..." && !userId) {
    return <FullScreenLoader label="Loading basics..." />;
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

          {err ? <div style={{ marginTop: 12, opacity: 0.9 }}>{err}</div> : null}
        </section>
      </main>
    </div>
  );
}
