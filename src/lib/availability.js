const AVAILABILITY_LOCAL_KEY_PREFIX = "gub_availability_";

const TIMEZONES = [
  { value: "America/New_York",    label: "Eastern Time (ET) — New York, Miami, Atlanta" },
  { value: "America/Chicago",     label: "Central Time (CT) — Chicago, Houston, Dallas" },
  { value: "America/Denver",      label: "Mountain Time (MT) — Denver, Salt Lake City" },
  { value: "America/Phoenix",     label: "Mountain Time — Phoenix (no DST)" },
  { value: "America/Los_Angeles", label: "Pacific Time (PT) — Los Angeles, Seattle" },
  { value: "America/Anchorage",   label: "Alaska Time (AKT) — Anchorage" },
  { value: "Pacific/Honolulu",    label: "Hawaii Time (HT) — Honolulu" },
];

const DAYS = [
  { key: "mon", label: "Monday" },
  { key: "tue", label: "Tuesday" },
  { key: "wed", label: "Wednesday" },
  { key: "thu", label: "Thursday" },
  { key: "fri", label: "Friday" },
  { key: "sat", label: "Saturday" },
  { key: "sun", label: "Sunday" },
];

function defaultWeek() {
  return {
    mon: { enabled: true,  start: "09:00", end: "17:00" },
    tue: { enabled: true,  start: "09:00", end: "17:00" },
    wed: { enabled: true,  start: "09:00", end: "17:00" },
    thu: { enabled: true,  start: "09:00", end: "17:00" },
    fri: { enabled: true,  start: "09:00", end: "17:00" },
    sat: { enabled: false, start: "10:00", end: "15:00" },
    sun: { enabled: false, start: "10:00", end: "15:00" },
  };
}

function normalizeWeek(raw, fallbackTz = "UTC") {
  const base = defaultWeek();
  if (!raw || typeof raw !== "object") return { timezone: fallbackTz, week: base, blocked_dates: [] };
  const tz = typeof raw.timezone === "string" && raw.timezone.trim() ? raw.timezone.trim() : fallbackTz;
  const blocked = Array.isArray(raw.blocked_dates) ? raw.blocked_dates.filter(Boolean) : [];
  const source = raw.week && typeof raw.week === "object" ? raw.week : raw;
  for (const d of DAYS) {
    const item = source[d.key];
    if (!item || typeof item !== "object") continue;
    base[d.key] = {
      enabled: Boolean(item.enabled),
      start: typeof item.start === "string" ? item.start : base[d.key].start,
      end:   typeof item.end   === "string" ? item.end   : base[d.key].end,
    };
  }
  return { timezone: tz, week: base, blocked_dates: blocked };
}

function readLocalAvailability(userId, fallbackTz) {
  try {
    const raw = localStorage.getItem(`${AVAILABILITY_LOCAL_KEY_PREFIX}${userId}`);
    if (!raw) return null;
    return normalizeWeek(JSON.parse(raw), fallbackTz);
  } catch { return null; }
}

function saveLocalAvailability(userId, payload) {
  try {
    localStorage.setItem(`${AVAILABILITY_LOCAL_KEY_PREFIX}${userId}`, JSON.stringify(payload));
  } catch { /* ignore */ }
}

function validateEnabledRanges(week) {
  for (const d of DAYS) {
    const row = week?.[d.key];
    if (!row?.enabled) continue;
    if (!row.start || !row.end || row.start >= row.end) return false;
  }
  return true;
}

export {
  TIMEZONES,
  DAYS,
  defaultWeek,
  normalizeWeek,
  readLocalAvailability,
  saveLocalAvailability,
  validateEnabledRanges,
};
