import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppShell from "../components/layout/AppShell";
import Button from "../components/ui/Button";
import { supabase } from "../lib/supabase";
import {
  TIMEZONES,
  DAYS,
  defaultWeek,
  normalizeWeek,
  readLocalAvailability,
  saveLocalAvailability,
  validateEnabledRanges,
} from "../lib/availability";

const fieldStyle = {
  width: "100%",
  minHeight: 44,
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.15)",
  background: "rgba(0,0,0,0.35)",
  color: "#f3f3f3",
  padding: "10px 14px",
  fontSize: 15,
};

const textareaStyle = {
  ...fieldStyle,
  minHeight: 100,
  resize: "vertical",
};

function Section({ title, hint, children }) {
  return (
    <div className="pf-section">
      <div className="pf-sectionHead">
        <div className="pf-sectionTitle">{title}</div>
        {hint && <div className="pf-sectionHint">{hint}</div>}
      </div>
      <div className="pf-sectionBody">{children}</div>
    </div>
  );
}

function Field({ label, hint, children }) {
  return (
    <label className="pf-field">
      <span className="pf-label">{label}</span>
      {children}
      {hint && <span className="pf-hint">{hint}</span>}
    </label>
  );
}

function TwoCol({ children }) {
  return <div className="pf-twoCol">{children}</div>;
}

export default function Settings() {
  const nav = useNavigate();

  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [userId, setUserId]       = useState(null);
  const [err, setErr]             = useState("");
  const [msg, setMsg]             = useState("");

  // Location & travel
  const [hasLocation, setHasLocation]         = useState(false);
  const [travelsToClients, setTravelsToClients] = useState(false);
  const [displayLocation, setDisplayLocation] = useState("");
  const [travelFee, setTravelFee]             = useState("");
  const [travelRadius, setTravelRadius]       = useState("");

  // Availability
  const [timezone, setTimezone]     = useState(Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
  const [week, setWeek]             = useState(defaultWeek());
  const [blockedDatesText, setBlockedDatesText] = useState("");
  const [availabilityStorage, setAvailabilityStorage] = useState("checking");

  // No-show fee
  const [noshowFeeType, setNoshowFeeType]     = useState("none");
  const [noshowFeeAmount, setNoshowFeeAmount] = useState("");
  const [noshowFeeTerms, setNoshowFeeTerms]   = useState("");

  // Booking policy
  const [bookingPolicy, setBookingPolicy]     = useState("");

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      const { data: authRes, error: authErr } = await supabase.auth.getUser();
      const u = authRes?.user ?? null;
      if (authErr || !u) { nav("/login", { replace: true }); return; }

      const { data: profile, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", u.id)
        .maybeSingle();

      if (!mounted) return;
      if (error) setErr("Could not load settings.");

      const fallbackTz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
      let schedule = null;

      const { data: cloudAvailability, error: cloudErr } = await supabase
        .from("pro_availability")
        .select("timezone, week, blocked_dates")
        .eq("user_id", u.id)
        .maybeSingle();

      if (!cloudErr) {
        setAvailabilityStorage("cloud");
        schedule = normalizeWeek(cloudAvailability || {}, fallbackTz);
      } else {
        console.warn("[Settings] pro_availability unavailable, using local fallback", cloudErr);
        setAvailabilityStorage("local");
      }

      if (!schedule) {
        schedule = readLocalAvailability(u.id, fallbackTz) || normalizeWeek({}, fallbackTz);
      }

      setUserId(u.id);
      setHasLocation(Boolean(profile?.has_location));
      setTravelsToClients(Boolean(profile?.travels_to_clients));
      setDisplayLocation(profile?.display_location ?? "");
      setTravelFee(profile?.travel_fee == null ? "" : String(profile.travel_fee));
      setTravelRadius(profile?.travel_radius_miles == null ? "" : String(profile.travel_radius_miles));
      setTimezone(schedule.timezone);
      setWeek(schedule.week);
      setBlockedDatesText(schedule.blocked_dates.join(", "));
      setNoshowFeeType(profile?.noshow_fee_type ?? "none");
      setNoshowFeeAmount(profile?.noshow_fee_amount == null ? "" : String(profile.noshow_fee_amount));
      setNoshowFeeTerms(profile?.noshow_fee_terms ?? "");
      setBookingPolicy(profile?.booking_policy ?? "");
      setLoading(false);
    })();
    return () => { mounted = false; };
  }, [nav]);

  async function onSave() {
    if (!userId) return;
    setSaving(true);
    setErr(""); setMsg("");
    try {
      if (!validateEnabledRanges(week)) {
        setErr("Each enabled day needs a valid start/end time (end must be after start).");
        setSaving(false);
        return;
      }

      const blockedDates = blockedDatesText.split(",").map((s) => s.trim()).filter(Boolean);
      const availabilityPayload = { timezone: timezone.trim() || "UTC", week, blocked_dates: blockedDates };

      const noshowAmount = noshowFeeAmount === "" || Number.isNaN(Number(noshowFeeAmount))
        ? 0
        : Math.max(0, Number(noshowFeeAmount));

      const profilePayload = {
        id:               userId,
        has_location:     hasLocation,
        travels_to_clients: travelsToClients,
        display_location: displayLocation.trim() || null,
        travel_fee:       travelFee === "" || Number.isNaN(Number(travelFee)) ? 0 : Math.max(0, Number(travelFee)),
        travel_radius_miles: travelRadius === "" || Number.isNaN(Number(travelRadius)) ? null : Math.max(0, Math.trunc(Number(travelRadius))),
        noshow_fee_type:   noshowFeeType,
        noshow_fee_amount: noshowFeeType === "none" ? null : noshowAmount,
        noshow_fee_terms:  noshowFeeTerms.trim() || null,
        booking_policy:    bookingPolicy.trim() || null,
      };

      const { error: profileErr } = await supabase.from("profiles").upsert(profilePayload, { onConflict: "id" });
      if (profileErr) throw profileErr;

      let cloudSaved = false;
      const { error: availErr } = await supabase
        .from("pro_availability")
        .upsert(
          { user_id: userId, ...availabilityPayload, updated_at: new Date().toISOString() },
          { onConflict: "user_id" }
        );

      if (!availErr) {
        cloudSaved = true;
        setAvailabilityStorage("cloud");
      } else {
        console.warn("[Settings] cloud availability save failed", availErr);
        setAvailabilityStorage("local");
      }
      saveLocalAvailability(userId, availabilityPayload);

      setMsg(cloudSaved ? "Settings saved." : "Settings saved. Availability stored locally (cloud sync pending DB setup).");
    } catch (e) {
      console.error("[Settings] save:", e);
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
        <div className="g-page">
          <div className="ap-loadingGrid">
            {[1, 2, 3].map((i) => <div key={i} className="ap-skeleton" style={{ height: 120 }} />)}
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Settings" onSignOut={signOut}>
      <div className="g-page">
        <div className="pf-header">
          <h1 className="g-h1">Settings</h1>
          <div className="u-muted">Manage your location, availability, policies, and booking rules.</div>
        </div>

        <div className="pf-settingsLayout">

          {/* Location & Travel */}
          <Section title="Location &amp; Travel" hint="Where and how you serve clients">
            <div className="st-toggles">
              <label className="st-toggle">
                <input
                  type="checkbox"
                  checked={hasLocation}
                  onChange={(e) => setHasLocation(e.target.checked)}
                />
                <div className="st-toggleContent">
                  <span className="st-toggleLabel">I have a shop / studio location</span>
                  <span className="pf-hint">Clients can visit you at a fixed address</span>
                </div>
              </label>
              <label className="st-toggle">
                <input
                  type="checkbox"
                  checked={travelsToClients}
                  onChange={(e) => setTravelsToClients(e.target.checked)}
                />
                <div className="st-toggleContent">
                  <span className="st-toggleLabel">I offer mobile / travel service</span>
                  <span className="pf-hint">You go to the client&apos;s location</span>
                </div>
              </label>
            </div>

            <TwoCol>
              <Field label="Display location" hint="Shown publicly, e.g. &quot;Atlanta, GA&quot;">
                <input style={fieldStyle} placeholder="City, State" value={displayLocation} onChange={(e) => setDisplayLocation(e.target.value)} />
              </Field>
              {travelsToClients && (
                <Field label="Travel radius (miles)">
                  <input style={fieldStyle} inputMode="numeric" placeholder="10" value={travelRadius} onChange={(e) => setTravelRadius(e.target.value)} />
                </Field>
              )}
            </TwoCol>

            {travelsToClients && (
              <Field label="Travel fee (USD)" hint="Added to the total for mobile appointments">
                <input style={fieldStyle} inputMode="decimal" placeholder="0.00" value={travelFee} onChange={(e) => setTravelFee(e.target.value)} />
              </Field>
            )}
          </Section>

          {/* Availability */}
          <Section title="Availability" hint="Set the days and hours clients can book">
            <Field label="Time zone" hint="All booking times use this timezone">
              <select
                style={fieldStyle}
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
              >
                {/* If the saved value isn't in our list, show it as-is so data isn't lost */}
                {!TIMEZONES.some((t) => t.value === timezone) && (
                  <option value={timezone}>{timezone}</option>
                )}
                {TIMEZONES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </Field>

            <div className="st-weekGrid">
              {DAYS.map((d) => {
                const row = week[d.key];
                return (
                  <div key={d.key} className={`st-dayRow${row?.enabled ? " st-dayRowActive" : ""}`}>
                    <label className="st-dayToggle">
                      <input
                        type="checkbox"
                        checked={Boolean(row?.enabled)}
                        onChange={(e) =>
                          setWeek((prev) => ({ ...prev, [d.key]: { ...prev[d.key], enabled: e.target.checked } }))
                        }
                      />
                      <span className="st-dayLabel">{d.label}</span>
                    </label>
                    <div className={`st-dayTimes${!row?.enabled ? " st-dayTimesDisabled" : ""}`}>
                      <input
                        type="time"
                        className="st-timeInput"
                        value={row?.start || "09:00"}
                        disabled={!row?.enabled}
                        onChange={(e) =>
                          setWeek((prev) => ({ ...prev, [d.key]: { ...prev[d.key], start: e.target.value } }))
                        }
                      />
                      <span className="st-timeSep">→</span>
                      <input
                        type="time"
                        className="st-timeInput"
                        value={row?.end || "17:00"}
                        disabled={!row?.enabled}
                        onChange={(e) =>
                          setWeek((prev) => ({ ...prev, [d.key]: { ...prev[d.key], end: e.target.value } }))
                        }
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <Field label="Blocked dates" hint="Comma-separated dates you are unavailable, e.g. 2026-07-04, 2026-12-25">
              <input
                style={fieldStyle}
                placeholder="2026-07-04, 2026-12-25"
                value={blockedDatesText}
                onChange={(e) => setBlockedDatesText(e.target.value)}
              />
            </Field>

            {availabilityStorage === "local" && (
              <div className="u-muted" style={{ fontSize: 13, padding: "8px 12px", background: "rgba(255,209,102,0.06)", borderRadius: 10, border: "1px solid rgba(255,209,102,0.15)" }}>
                Availability is stored locally on this device. Cloud sync is pending.
              </div>
            )}
          </Section>

          {/* No-Show Fee */}
          <Section title="No-Show Fee" hint="Charge clients who miss their appointment">
            <Field label="Fee type">
              <select
                style={fieldStyle}
                value={noshowFeeType}
                onChange={(e) => setNoshowFeeType(e.target.value)}
              >
                <option value="none">None — no fee</option>
                <option value="flat">Flat fee (fixed dollar amount)</option>
                <option value="percent">Percent of service price</option>
              </select>
            </Field>

            {noshowFeeType !== "none" && (
              <Field
                label={noshowFeeType === "flat" ? "Fee amount (USD)" : "Percentage (%)"}
                hint={noshowFeeType === "flat" ? "e.g. 25 for a $25 no-show fee" : "e.g. 50 for 50% of the service price"}
              >
                <input
                  style={fieldStyle}
                  inputMode="decimal"
                  placeholder={noshowFeeType === "flat" ? "25.00" : "50"}
                  value={noshowFeeAmount}
                  onChange={(e) => setNoshowFeeAmount(e.target.value)}
                />
              </Field>
            )}

            {noshowFeeType !== "none" && (
              <Field label="Fee terms (optional)" hint="Shown to clients during booking">
                <textarea
                  style={textareaStyle}
                  value={noshowFeeTerms}
                  onChange={(e) => setNoshowFeeTerms(e.target.value)}
                  placeholder="e.g. No-show fees are charged 30 minutes after the scheduled appointment time."
                  maxLength={400}
                />
              </Field>
            )}
          </Section>

          {/* Booking Policy */}
          <Section title="Booking Policy" hint="Clients see this before confirming their booking">
            <Field label="Policy text" hint="Cancellation policy, what to expect, arrival instructions, etc.">
              <textarea
                style={{ ...textareaStyle, minHeight: 140 }}
                value={bookingPolicy}
                onChange={(e) => setBookingPolicy(e.target.value)}
                placeholder="e.g. Please arrive 5 minutes early. Cancellations must be made at least 24 hours in advance. Deposits are non-refundable for same-day cancellations."
                maxLength={800}
              />
              <span className="pf-charCount">{bookingPolicy.length}/800</span>
            </Field>
          </Section>

          {/* Save */}
          <div className="pf-saveRow">
            {err && <div className="ap-msg ap-msgErr">{err}</div>}
            {msg && <div className="ap-msg ap-msgOk">{msg}</div>}
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Button variant="primary" onClick={onSave} disabled={saving}>
                {saving ? "Saving…" : "Save Settings"}
              </Button>
              <Button variant="outline" onClick={() => nav("/app/onboarding/payouts")}>
                Stripe Payout Setup
              </Button>
            </div>
          </div>

        </div>
      </div>
    </AppShell>
  );
}
