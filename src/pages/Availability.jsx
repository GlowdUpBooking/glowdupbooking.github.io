import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppShell from "../components/layout/AppShell";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
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

export default function Availability() {
  const nav = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState(null);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");

  const [timezone, setTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
  const [week, setWeek] = useState(defaultWeek());
  const [blockedDatesText, setBlockedDatesText] = useState("");
  const [availabilityStorage, setAvailabilityStorage] = useState("checking");

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      const { data: authRes, error: authErr } = await supabase.auth.getUser();
      const u = authRes?.user ?? null;
      if (authErr || !u) { nav("/login", { replace: true }); return; }

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
        console.warn("[Availability] pro_availability unavailable, using local fallback", cloudErr);
        setAvailabilityStorage("local");
      }

      if (!schedule) {
        schedule = readLocalAvailability(u.id, fallbackTz) || normalizeWeek({}, fallbackTz);
      }

      if (!mounted) return;
      setUserId(u.id);
      setTimezone(schedule.timezone);
      setWeek(schedule.week);
      setBlockedDatesText(schedule.blocked_dates.join(", "));
      setLoading(false);
    })();
    return () => { mounted = false; };
  }, [nav]);

  async function onSave() {
    if (!userId) return;
    setSaving(true);
    setErr("");
    setMsg("");
    try {
      if (!validateEnabledRanges(week)) {
        setErr("Each enabled day needs a valid start/end time (end must be after start).");
        setSaving(false);
        return;
      }

      const blockedDates = blockedDatesText.split(",").map((s) => s.trim()).filter(Boolean);
      const availabilityPayload = { timezone: timezone.trim() || "UTC", week, blocked_dates: blockedDates };

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
        console.warn("[Availability] cloud availability save failed", availErr);
        setAvailabilityStorage("local");
      }

      saveLocalAvailability(userId, availabilityPayload);
      setMsg(cloudSaved ? "Availability saved." : "Saved locally. Cloud sync pending DB setup.");
    } catch (e) {
      console.error("[Availability] save:", e);
      setErr("Could not save availability. Please try again.");
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
      <AppShell title="Availability" onSignOut={signOut}>
        <div className="g-page">
          <div className="ap-loadingGrid">
            {[1, 2, 3].map((i) => <div key={i} className="ap-skeleton" style={{ height: 120 }} />)}
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Availability" onSignOut={signOut}>
      <div className="g-page">
        <div className="pf-header">
          <h1 className="g-h1">Availability</h1>
          <div className="u-muted">Set the days and hours clients can book.</div>
        </div>

        <Card style={{ padding: 18 }}>
          <label className="pf-field">
            <span className="pf-label">Time zone</span>
            <select
              style={fieldStyle}
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
            >
              {!TIMEZONES.some((t) => t.value === timezone) && (
                <option value={timezone}>{timezone}</option>
              )}
              {TIMEZONES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            <span className="pf-hint">All booking times use this timezone</span>
          </label>

          <div className="st-weekGrid" style={{ marginTop: 16 }}>
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

          <label className="pf-field" style={{ marginTop: 16 }}>
            <span className="pf-label">Blocked dates</span>
            <input
              style={fieldStyle}
              placeholder="2026-07-04, 2026-12-25"
              value={blockedDatesText}
              onChange={(e) => setBlockedDatesText(e.target.value)}
            />
            <span className="pf-hint">Comma-separated dates you are unavailable</span>
          </label>

          {availabilityStorage === "local" && (
            <div className="u-muted" style={{ fontSize: 13, padding: "8px 12px", background: "rgba(255,209,102,0.06)", borderRadius: 10, border: "1px solid rgba(255,209,102,0.15)", marginTop: 12 }}>
              Availability is stored locally on this device. Cloud sync is pending.
            </div>
          )}

          <div className="pf-saveRow" style={{ marginTop: 16 }}>
            {err && <div className="ap-msg ap-msgErr">{err}</div>}
            {msg && <div className="ap-msg ap-msgOk">{msg}</div>}
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Button variant="primary" onClick={onSave} disabled={saving}>
                {saving ? "Saving…" : "Save Availability"}
              </Button>
              <Button variant="outline" onClick={() => nav("/app/settings")}>Open full settings</Button>
            </div>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
