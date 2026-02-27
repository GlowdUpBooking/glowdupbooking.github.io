import { useEffect, useMemo, useState } from "react";
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
  const [copiedDayKey, setCopiedDayKey] = useState(null);

  const activeDays = useMemo(
    () => DAYS.reduce((acc, d) => (week?.[d.key]?.enabled ? acc + 1 : acc), 0),
    [week]
  );

  const summary = useMemo(() => {
    const parseTime = (value) => {
      if (!value) return null;
      const [h, m] = value.split(":").map((n) => Number(n));
      if (Number.isNaN(h) || Number.isNaN(m)) return null;
      return h * 60 + m;
    };
    const formatTimeLabel = (value) => {
      if (!value) return "—";
      const [hRaw, mRaw] = value.split(":").map((n) => Number(n));
      if (Number.isNaN(hRaw) || Number.isNaN(mRaw)) return value;
      const ampm = hRaw >= 12 ? "PM" : "AM";
      const hour = hRaw % 12 === 0 ? 12 : hRaw % 12;
      return `${hour}${mRaw ? `:${String(mRaw).padStart(2, "0")}` : ""} ${ampm}`;
    };

    const active = DAYS.filter((d) => week?.[d.key]?.enabled).map((d) => ({
      ...d,
      start: week[d.key]?.start || "09:00",
      end: week[d.key]?.end || "17:00",
    }));
    const totalMinutes = active.reduce((acc, d) => {
      const start = parseTime(d.start);
      const end = parseTime(d.end);
      if (start == null || end == null || end <= start) return acc;
      return acc + (end - start);
    }, 0);

    const allSameHours = active.length > 0 && active.every((d) => d.start === active[0].start && d.end === active[0].end);
    const hoursLabel = active.length === 0
      ? "No active hours"
      : allSameHours
        ? `${formatTimeLabel(active[0].start)}–${formatTimeLabel(active[0].end)}`
        : "Varies by day";

    const totalHours = totalMinutes / 60;
    const totalHoursLabel = totalHours === 0
      ? "0 hrs"
      : Number.isInteger(totalHours)
        ? `${totalHours} hrs`
        : `${totalHours.toFixed(1)} hrs`;

    const daysLabel = active.length === 0 ? "None" : active.map((d) => d.label).join(", ");

    return {
      daysLabel,
      hoursLabel,
      totalHoursLabel,
      averageLabel: active.length > 0 ? `${(totalHours / active.length).toFixed(1)} hrs/day` : "—",
    };
  }, [week]);

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

  function applyPreset(preset) {
    const next = defaultWeek();
    const enableAll = preset === "all";
    const enableWeekdays = preset === "weekdays";

    for (const d of DAYS) {
      const isWeekday = ["mon", "tue", "wed", "thu", "fri"].includes(d.key);
      const enabled = enableAll || (enableWeekdays && isWeekday);
      next[d.key] = {
        ...next[d.key],
        enabled,
        start: preset === "late" ? "10:00" : "09:00",
        end: preset === "late" ? "18:00" : "17:00",
      };
      if (preset === "clear") {
        next[d.key].enabled = false;
      }
    }

    setWeek(next);
  }

  function handleCopyDay(key) {
    setCopiedDayKey(key);
  }

  function handlePasteDay(targetKey) {
    if (!copiedDayKey || !week[copiedDayKey]) return;
    const source = week[copiedDayKey];
    setWeek((prev) => ({
      ...prev,
      [targetKey]: {
        ...prev[targetKey],
        enabled: source.enabled,
        start: source.start,
        end: source.end,
      },
    }));
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
          <div className="st-toolbar">
            <div>
              <div style={{ fontWeight: 800 }}>Quick presets</div>
              <div className="u-muted" style={{ fontSize: 12 }}>
                {activeDays} active day{activeDays === 1 ? "" : "s"}
              </div>
            </div>
            <div className="st-presetBtns">
              <button className="g-pillBtn" type="button" onClick={() => applyPreset("weekdays")}>
                Weekdays 9–5
              </button>
              <button className="g-pillBtn" type="button" onClick={() => applyPreset("late")}>
                Weekdays 10–6
              </button>
              <button className="g-pillBtn" type="button" onClick={() => applyPreset("all")}>
                All days 9–5
              </button>
              <button className="g-pillBtn" type="button" onClick={() => applyPreset("clear")}>
                Clear all
              </button>
            </div>
          </div>

          <div className="st-summary">
            <div className="st-summaryRow">
              <span className="st-summaryLabel">Active days:</span>
              <span>{summary.daysLabel}</span>
            </div>
            <div className="st-summaryRow">
              <span className="st-summaryLabel">Hours:</span>
              <span>{summary.hoursLabel}</span>
              <span className="st-summaryDivider">•</span>
              <span className="st-summaryLabel">Weekly total:</span>
              <span>{summary.totalHoursLabel}</span>
              <span className="st-summaryDivider">•</span>
              <span className="st-summaryLabel">Avg:</span>
              <span>{summary.averageLabel}</span>
            </div>
            {copiedDayKey && (
              <div className="st-summaryNote">
                Copied {DAYS.find((d) => d.key === copiedDayKey)?.label}. Tap Paste on another day.
              </div>
            )}
          </div>

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
                  <div className="st-dayActions">
                    <button className="st-dayBtn" type="button" onClick={() => handleCopyDay(d.key)}>
                      Copy
                    </button>
                    {copiedDayKey && copiedDayKey !== d.key && (
                      <button className="st-dayBtn st-dayBtnPrimary" type="button" onClick={() => handlePasteDay(d.key)}>
                        Paste
                      </button>
                    )}
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
