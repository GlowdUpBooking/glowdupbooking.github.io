// Shared formatting utilities — used across App, Calendar, Services, Payouts

export function money(n) {
  const num = Number(n ?? 0);
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(num);
  } catch {
    return `$${num.toFixed(2)}`;
  }
}

export function durationLabel(mins) {
  const m = Number(mins ?? 0);
  if (!m) return null;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  if (h && mm) return `${h}h ${mm}m`;
  if (h) return `${h}h`;
  return `${mm}m`;
}

// Short date used in appointment lists (Today / Tomorrow / Mar 5, 2026 · 2:00 PM)
export function formatApptDate(dateStr, timeStr) {
  if (!dateStr) return "—";
  try {
    const [y, m, d] = dateStr.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
    let dayLabel;
    if (date.getTime() === today.getTime()) dayLabel = "Today";
    else if (date.getTime() === tomorrow.getTime()) dayLabel = "Tomorrow";
    else dayLabel = date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
    if (!timeStr) return dayLabel;
    const [h, min] = timeStr.split(":").map(Number);
    const timeLabel = new Date(y, m - 1, d, h, min).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
    return `${dayLabel} · ${timeLabel}`;
  } catch {
    return `${dateStr}${timeStr ? " " + timeStr : ""}`;
  }
}

// Long date used in appointment detail panels (Wednesday, March 5, 2026 at 2:00 PM)
export function formatDateLong(dateStr, timeStr) {
  if (!dateStr) return "—";
  try {
    const [y, m, d] = dateStr.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    const dayLabel = date.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
    if (!timeStr) return dayLabel;
    const [h, min] = timeStr.split(":").map(Number);
    const timeLabel = new Date(y, m - 1, d, h, min).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
    return `${dayLabel} at ${timeLabel}`;
  } catch {
    return dateStr;
  }
}

// Next-appointment label used on the dashboard (Today · 2pm / Tomorrow · 10am / Mar 5 · 2pm)
export function formatNextAppt(dateStr, timeStr) {
  if (!dateStr) return "n/a";
  try {
    const [y, m, d] = dateStr.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
    let dayLabel;
    if (date.getTime() === today.getTime()) dayLabel = "Today";
    else if (date.getTime() === tomorrow.getTime()) dayLabel = "Tomorrow";
    else dayLabel = date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    if (!timeStr) return dayLabel;
    const [h, min] = timeStr.split(":").map(Number);
    const timeLabel = new Date(y, m - 1, d, h, min).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
    return `${dayLabel} · ${timeLabel}`;
  } catch {
    return dateStr;
  }
}

// Normalize a raw Stripe plan name / DB value to a canonical plan key
export function normalizePlanKey(raw) {
  const v = String(raw || "").trim().toLowerCase();
  if (!v) return null;
  if (v === "free") return "free";
  if (v === "starter" || v === "starter_monthly" || v === "starter_annual") return "starter";
  if (v === "pro" || v === "pro_monthly" || v === "pro_annual") return "pro";
  if (v === "founder" || v === "founder_annual") return "founder";
  if (v === "elite" || v === "elite_monthly" || v === "elite_annual") return "elite";
  return null;
}
