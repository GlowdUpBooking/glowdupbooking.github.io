// src/pages/onboarding/Location.jsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import OnboardingProgress from "../../components/onboarding/OnboardingProgress";

export default function Location() {
  const nav = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [autosaveStatus, setAutosaveStatus] = useState("Loading...");
  const hydrated = useRef(false);

  const [userId, setUserId] = useState(null);

  // Form state
  const [hasLocation, setHasLocation] = useState(false);
  const [mobile, setMobile] = useState(false);

  const [address1, setAddress1] = useState("");
  const [address2, setAddress2] = useState("");
  const [city, setCity] = useState("");
  const [stateProv, setStateProv] = useState("");
  const [postal, setPostal] = useState("");
  const [country, setCountry] = useState("US");

  // Load existing profile values
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
        .select(
          "has_location, address_line1, address_line2, city, state, postal_code, country, travels_to_clients, onboarding_step"
        )
        .eq("id", u.id)
        .maybeSingle();

      if (!mounted) return;

      if (!error && profile) {
        setHasLocation(!!profile.has_location);
        setMobile(!!profile.travels_to_clients);

        setAddress1(profile.address_line1 ?? "");
        setAddress2(profile.address_line2 ?? "");
        setCity(profile.city ?? "");
        setStateProv(profile.state ?? "");
        setPostal(profile.postal_code ?? "");
        setCountry(profile.country ?? "US");
      }

      hydrated.current = true;
      setAutosaveStatus("Ready");
      setLoading(false);
    })();

    return () => {
      mounted = false;
    };
  }, [nav]);

  // Validation rules:
  // - If hasLocation => require address1, city, stateProv, postal
  // - If NOT hasLocation => require "mobile" choice (at least checked or not checked is still a choice)
  //   BUT: user asked “If they say no then ask if they are mobile.” That means they must explicitly choose.
  //   In UI we use a checkbox; so we enforce they click Continue only after they interact.
  //   Simplest: require they pick either "Yes I'm mobile" OR "No I'm not mobile" (we’ll do radio buttons).
  const [mobileChoice, setMobileChoice] = useState(null); // null | true | false

  // Sync checkbox -> radio-based choice
  useEffect(() => {
    // If hasLocation, we allow mobileChoice to remain as-is.
    // If no location, we want explicit choice; keep mobileChoice until chosen.
  }, [hasLocation]);

  const locationRequiredMissing = useMemo(() => {
    if (!hasLocation) return false;
    return !address1.trim() || !city.trim() || !stateProv.trim() || !postal.trim();
  }, [hasLocation, address1, city, stateProv, postal]);

  const needsMobileChoice = useMemo(() => {
    return !hasLocation && mobileChoice === null;
  }, [hasLocation, mobileChoice]);

  const canContinue = useMemo(() => {
    if (hasLocation) return !locationRequiredMissing;
    return !needsMobileChoice; // must pick yes/no
  }, [hasLocation, locationRequiredMissing, needsMobileChoice]);

  const buildDisplayLocation = useCallback(() => {
    // For public display, you may want city/state only.
    // Keeping it simple: if hasLocation -> "City, State"
    if (!hasLocation) return null;
    const c = city.trim();
    const s = stateProv.trim();
    if (!c && !s) return null;
    return [c, s].filter(Boolean).join(", ");
  }, [hasLocation, city, stateProv]);

  async function onContinue() {
    if (!userId) return;

    setErr("");

    if (!canContinue) {
      setErr("Please complete the required fields before continuing.");
      return;
    }

    setSaving(true);
    try {
      const travelsToClients = hasLocation ? !!mobile : (mobileChoice === true);

      // If user has NO location and says not mobile, we still allow them to continue
      // (they might be “coming soon” / placeholder). But we store it clearly.
      const payload = {
        id: userId,
        has_location: hasLocation,
        travels_to_clients: travelsToClients,
        address_line1: hasLocation ? address1.trim() : null,
        address_line2: hasLocation ? (address2.trim() || null) : null,
        city: hasLocation ? city.trim() : null,
        state: hasLocation ? stateProv.trim() : null,
        postal_code: hasLocation ? postal.trim() : null,
        country: hasLocation ? (country.trim() || "US") : "US",
        display_location: buildDisplayLocation(),
        onboarding_step: "location",
      };

      const { error: upsertErr } = await supabase.from("profiles").upsert(payload, { onConflict: "id" });
      if (upsertErr) throw upsertErr;

      // Next step:
      // - If no location AND mobile = true -> go to travel page (collect fee + radius)
      // - Otherwise -> go to social
      if (!hasLocation && mobileChoice === true) {
        await supabase.from("profiles").update({ onboarding_step: "travel" }).eq("id", userId);
        nav("/app/onboarding/travel");
        return;
      }

      await supabase.from("profiles").update({ onboarding_step: "social" }).eq("id", userId);
      nav("/app/onboarding/social");
    } catch (e) {
      console.error("[Location] save error:", e);
      setErr("Couldn’t save your location details. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    if (!hydrated.current || !userId) return;
    const t = setTimeout(async () => {
      setAutosaveStatus("Saving...");
      const travelsToClients = hasLocation ? !!mobile : mobileChoice === true;
      const payload = {
        id: userId,
        has_location: hasLocation,
        travels_to_clients: travelsToClients,
        address_line1: hasLocation ? address1.trim() : null,
        address_line2: hasLocation ? (address2.trim() || null) : null,
        city: hasLocation ? city.trim() : null,
        state: hasLocation ? stateProv.trim() : null,
        postal_code: hasLocation ? postal.trim() : null,
        country: hasLocation ? (country.trim() || "US") : "US",
        display_location: buildDisplayLocation(),
      };
      const { error } = await supabase.from("profiles").upsert(payload, { onConflict: "id" });
      setAutosaveStatus(error ? "Autosave failed" : "Saved");
    }, 600);

    return () => clearTimeout(t);
  }, [
    userId,
    hasLocation,
    mobile,
    mobileChoice,
    address1,
    address2,
    city,
    stateProv,
    postal,
    country,
    buildDisplayLocation,
  ]);

  if (loading) return null;

  return (
    <div className="obPage page">
      <div className="bg" aria-hidden="true" />
      <main className="container">
        <section className="heroPanel">
          <h1>Location</h1>
          <p style={{ maxWidth: 720 }}>
            Do you have a business location clients can visit? If not, tell us if you’re mobile.
          </p>
          <OnboardingProgress active="profile" autosaveStatus={autosaveStatus} />

          {/* Step 1: Has location */}
          <label style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 18 }}>
            <input
              type="checkbox"
              checked={hasLocation}
              onChange={(e) => {
                const v = e.target.checked;
                setHasLocation(v);
                if (!v) {
                  // When turning off location, clear address fields visually (optional)
                  // but keep state if you want. We'll keep them as-is so they can toggle back.
                }
              }}
            />
            <span>Yes, I have a location</span>
          </label>

          {/* If has location => show address fields (required) */}
          {hasLocation ? (
            <div style={{ marginTop: 14 }}>
              <input
                className="input"
                placeholder="Address line 1 (required)"
                value={address1}
                onChange={(e) => setAddress1(e.target.value)}
              />
              <div style={{ height: 10 }} />
              <input
                className="input"
                placeholder="Address line 2 (optional)"
                value={address2}
                onChange={(e) => setAddress2(e.target.value)}
              />
              <div style={{ height: 10 }} />
              <input
                className="input"
                placeholder="City (required)"
                value={city}
                onChange={(e) => setCity(e.target.value)}
              />
              <div style={{ height: 10 }} />
              <input
                className="input"
                placeholder="State (required)"
                value={stateProv}
                onChange={(e) => setStateProv(e.target.value)}
              />
              <div style={{ height: 10 }} />
              <input
                className="input"
                placeholder="Postal code (required)"
                value={postal}
                onChange={(e) => setPostal(e.target.value)}
              />
              <div style={{ height: 10 }} />
              <input
                className="input"
                placeholder="Country (default: US)"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
              />

              <div style={{ height: 14 }} />

              {/* Optional: if they have a location, ask if they ALSO travel */}
              <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <input
                  type="checkbox"
                  checked={mobile}
                  onChange={(e) => setMobile(e.target.checked)}
                />
                <span>I also travel to clients (mobile)</span>
              </label>

              <p className="heroMicro" style={{ marginTop: 8 }}>
                If you’re mobile, we’ll ask your travel fee and radius next.
              </p>
            </div>
          ) : (
            <div style={{ marginTop: 18 }}>
              <p className="heroMicro" style={{ marginBottom: 10 }}>
                No location — are you mobile (do you travel to clients)?
              </p>

              {/* Force explicit yes/no */}
              <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <input
                  type="radio"
                  name="mobileChoice"
                  checked={mobileChoice === true}
                  onChange={() => setMobileChoice(true)}
                />
                <span>Yes, I’m mobile</span>
              </label>

              <div style={{ height: 10 }} />

              <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <input
                  type="radio"
                  name="mobileChoice"
                  checked={mobileChoice === false}
                  onChange={() => setMobileChoice(false)}
                />
                <span>No, I’m not mobile</span>
              </label>
            </div>
          )}

          {err ? <div style={{ marginTop: 14, opacity: 0.9 }}>{err}</div> : null}

          <div className="heroBtns" style={{ marginTop: 18 }}>
            <button
              className="btn gold"
              onClick={onContinue}
              disabled={!canContinue || saving}
              title={!canContinue ? "Complete required fields to continue" : ""}
            >
              {saving ? "Saving…" : "Continue"}
            </button>
          </div>

          {hasLocation && locationRequiredMissing ? (
            <p className="heroMicro" style={{ marginTop: 10 }}>
              Address line 1, City, State, and Postal code are required.
            </p>
          ) : null}

          {!hasLocation && needsMobileChoice ? (
            <p className="heroMicro" style={{ marginTop: 10 }}>
              Please select whether you’re mobile to continue.
            </p>
          ) : null}
        </section>
      </main>
    </div>
  );
}
