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

const AVAILABILITY_LOCAL_KEY_PREFIX = "gub_availability_";

const DAYS = [
  { key: "mon", label: "Mon" },
  { key: "tue", label: "Tue" },
  { key: "wed", label: "Wed" },
  { key: "thu", label: "Thu" },
  { key: "fri", label: "Fri" },
  { key: "sat", label: "Sat" },
  { key: "sun", label: "Sun" },
];

function defaultWeek() {
  return {
    mon: { enabled: true, start: "09:00", end: "17:00" },
    tue: { enabled: true, start: "09:00", end: "17:00" },
    wed: { enabled: true, start: "09:00", end: "17:00" },
    thu: { enabled: true, start: "09:00", end: "17:00" },
    fri: { enabled: true, start: "09:00", end: "17:00" },
    sat: { enabled: false, start: "10:00", end: "15:00" },
    sun: { enabled: false, start: "10:00", end: "15:00" },
  };
}

function normalizeWeek(raw, fallbackTz = "UTC") {
  const base = defaultWeek();
  if (!raw || typeof raw !== "object") {
    return {
      timezone: fallbackTz,
      week: base,
      blocked_dates: [],
    };
  }

  const tz = typeof raw.timezone === "string" && raw.timezone.trim() ? raw.timezone.trim() : fallbackTz;
  const blocked =
    Array.isArray(raw.blocked_dates) ? raw.blocked_dates.filter(Boolean) : [];

  const source = raw.week && typeof raw.week === "object" ? raw.week : raw;
  for (const d of DAYS) {
    const item = source[d.key];
    if (!item || typeof item !== "object") continue;
    base[d.key] = {
      enabled: Boolean(item.enabled),
      start: typeof item.start === "string" ? item.start : base[d.key].start,
      end: typeof item.end === "string" ? item.end : base[d.key].end,
    };
  }
  return {
    timezone: tz,
    week: base,
    blocked_dates: blocked,
  };
}

function readLocalAvailability(userId, fallbackTz) {
  try {
    const raw = localStorage.getItem(`${AVAILABILITY_LOCAL_KEY_PREFIX}${userId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return normalizeWeek(parsed, fallbackTz);
  } catch {
    return null;
  }
}

function saveLocalAvailability(userId, payload) {
  try {
    localStorage.setItem(
      `${AVAILABILITY_LOCAL_KEY_PREFIX}${userId}`,
      JSON.stringify(payload)
    );
  } catch {
    // ignore localStorage failures
  }
}

function validateEnabledRanges(week) {
  for (const d of DAYS) {
    const row = week?.[d.key];
    if (!row?.enabled) continue;
    if (!row.start || !row.end || row.start >= row.end) return false;
  }
  return true;
}

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
  const [travelFee, setTravelFee] = useState("");
  const [travelRadius, setTravelRadius] = useState("");
  const [timezone, setTimezone] = useState(
    Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
  );
  const [week, setWeek] = useState(defaultWeek());
  const [blockedDatesText, setBlockedDatesText] = useState("");
  const [availabilityStorage, setAvailabilityStorage] = useState("checking"); // checking | cloud | local

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

      const fallbackTz =
        Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
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
      setTravelFee(profile?.travel_fee == null ? "" : String(profile?.travel_fee));
      setTravelRadius(
        profile?.travel_radius_miles == null ? "" : String(profile?.travel_radius_miles)
      );
      setTimezone(schedule.timezone);
      setWeek(schedule.week);
      setBlockedDatesText(schedule.blocked_dates.join(", "));
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
      if (!validateEnabledRanges(week)) {
        setErr("Each enabled day needs a valid start/end time and end must be after start.");
        setSaving(false);
        return;
      }

      const blockedDates = blockedDatesText
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      const availabilityPayload = {
        timezone: timezone.trim() || "UTC",
        week,
        blocked_dates: blockedDates,
      };

      const payload = {
        id: userId,
        has_location: hasLocation,
        travels_to_clients: travelsToClients,
        display_location: displayLocation.trim() || null,
        travel_fee:
          travelFee === "" || Number.isNaN(Number(travelFee))
            ? 0
            : Math.max(0, Number(travelFee)),
        travel_radius_miles:
          travelRadius === "" || Number.isNaN(Number(travelRadius))
            ? null
            : Math.max(0, Math.trunc(Number(travelRadius))),
      };
      const { error } = await supabase.from("profiles").upsert(payload, { onConflict: "id" });
      if (error) throw error;

      let cloudSaved = false;
      const { error: availabilityErr } = await supabase
        .from("pro_availability")
        .upsert(
          {
            user_id: userId,
            timezone: availabilityPayload.timezone,
            week: availabilityPayload.week,
            blocked_dates: availabilityPayload.blocked_dates,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" }
        );
      if (!availabilityErr) {
        cloudSaved = true;
        setAvailabilityStorage("cloud");
      } else {
        console.warn("[Settings] failed to save cloud availability, using local fallback", availabilityErr);
        setAvailabilityStorage("local");
      }
      saveLocalAvailability(userId, availabilityPayload);

      setMsg(
        cloudSaved
          ? "Settings and availability saved."
          : "Settings saved. Availability saved on this device (cloud sync still needs DB setup)."
      );
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
              <span>Travel fee (USD)</span>
              <input
                style={fieldStyle}
                inputMode="decimal"
                placeholder="0"
                value={travelFee}
                onChange={(e) => setTravelFee(e.target.value)}
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

          <div style={{ marginTop: 20, display: "grid", gap: 10 }}>
            <strong>Availability schedule</strong>
            <div className="u-muted">
              Set available days and working hours for client bookings.
            </div>

            <label style={{ display: "grid", gap: 6, maxWidth: 320 }}>
              <span>Time zone</span>
              <input
                style={fieldStyle}
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                placeholder="America/Chicago"
              />
            </label>

            <div style={{ display: "grid", gap: 8 }}>
              {DAYS.map((d) => {
                const row = week[d.key];
                return (
                  <div
                    key={d.key}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "150px 1fr",
                      gap: 10,
                      alignItems: "center",
                    }}
                  >
                    <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <input
                        type="checkbox"
                        checked={Boolean(row?.enabled)}
                        onChange={(e) =>
                          setWeek((prev) => ({
                            ...prev,
                            [d.key]: { ...prev[d.key], enabled: e.target.checked },
                          }))
                        }
                      />
                      <span>{d.label}</span>
                    </label>

                    <div style={{ display: "flex", gap: 8 }}>
                      <input
                        type="time"
                        style={{ ...fieldStyle, maxWidth: 180 }}
                        value={row?.start || "09:00"}
                        disabled={!row?.enabled}
                        onChange={(e) =>
                          setWeek((prev) => ({
                            ...prev,
                            [d.key]: { ...prev[d.key], start: e.target.value },
                          }))
                        }
                      />
                      <input
                        type="time"
                        style={{ ...fieldStyle, maxWidth: 180 }}
                        value={row?.end || "17:00"}
                        disabled={!row?.enabled}
                        onChange={(e) =>
                          setWeek((prev) => ({
                            ...prev,
                            [d.key]: { ...prev[d.key], end: e.target.value },
                          }))
                        }
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <label style={{ display: "grid", gap: 6, marginTop: 8 }}>
              <span>Blocked dates (optional)</span>
              <input
                style={fieldStyle}
                placeholder="2026-03-10, 2026-03-12"
                value={blockedDatesText}
                onChange={(e) => setBlockedDatesText(e.target.value)}
              />
            </label>

            {availabilityStorage === "cloud" ? (
              <div className="u-muted">Availability sync: cloud</div>
            ) : null}
            {availabilityStorage === "local" ? (
              <div className="u-muted">
                Availability sync is currently local-only for this environment; schedule is still usable on this device.
              </div>
            ) : null}
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
