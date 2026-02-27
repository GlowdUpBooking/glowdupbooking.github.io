import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import AppShell from "../components/layout/AppShell";
import { supabase } from "../lib/supabase";

// ─── Helpers ────────────────────────────────────────────────────────────────

function money(n) {
  const num = Number(n ?? 0);
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(num);
  } catch {
    return `$${num.toFixed(2)}`;
  }
}

function formatApptDate(dateStr, timeStr) {
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

function formatDateLong(dateStr, timeStr) {
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

function durationLabel(mins) {
  const m = Number(mins ?? 0);
  if (!m) return null;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  if (h && mm) return `${h}h ${mm}m`;
  if (h) return `${h}h`;
  return `${mm}m`;
}

function getInitials(name) {
  if (!name) return "?";
  return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
}

function StatusBadge({ status }) {
  const map = {
    pending:   { label: "Pending",   cls: "ap-badgePending" },
    confirmed: { label: "Confirmed", cls: "ap-badgeConfirmed" },
    completed: { label: "Completed", cls: "ap-badgeCompleted" },
    canceled:  { label: "Canceled",  cls: "ap-badgeCanceled" },
    cancelled: { label: "Canceled",  cls: "ap-badgeCanceled" },
  };
  const { label, cls } = map[status] ?? { label: status, cls: "ap-badgePending" };
  return <span className={`ap-badge ${cls}`}>{label}</span>;
}

const TABS = [
  { key: "pending",   label: "Pending" },
  { key: "upcoming",  label: "Upcoming" },
  { key: "all",       label: "All" },
  { key: "completed", label: "Completed" },
  { key: "canceled",  label: "Canceled" },
];

// ─── Component ──────────────────────────────────────────────────────────────

export default function Appointments() {
  const nav = useNavigate();

  const [loading, setLoading]         = useState(true);
  const [userId, setUserId]           = useState(null);
  const [appointments, setAppointments] = useState([]);
  const [selectedId, setSelectedId]   = useState(null);
  const [activeTab, setActiveTab]     = useState("pending");
  const [actionLoading, setActionLoading] = useState(null);
  const [showDetail, setShowDetail]   = useState(false);
  const [msg, setMsg]                 = useState("");
  const [err, setErr]                 = useState("");

  useEffect(() => {
    let mounted = true;
    async function load() {
      const { data: authRes, error: authErr } = await supabase.auth.getUser();
      const u = authRes?.user ?? null;
      if (authErr || !u) { nav("/login", { replace: true }); return; }
      if (!mounted) return;
      setUserId(u.id);
      await loadAppointments(u.id, mounted);
    }
    load();
    return () => { mounted = false; };
  }, [nav]);

  async function loadAppointments(uid, mounted = true) {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("appointments")
        .select(
          "id, client_name, client_phone, service, appointment_date, appointment_time, " +
          "status, deposit_paid, deposit_amount, service_price_at_booking, duration_minutes, notes, created_at"
        )
        .eq("profile_id", uid)
        .order("appointment_date", { ascending: false })
        .order("appointment_time", { ascending: false });
      if (!mounted) return;
      if (error) setErr("Could not load appointments.");
      else setAppointments(data ?? []);
    } catch {
      if (!mounted) return;
      setErr("Something went wrong loading appointments.");
    }
    if (mounted) setLoading(false);
  }

  const todayStr    = new Date().toISOString().split("T")[0];
  const thisMonthStr = new Date().toISOString().slice(0, 7);

  const counts = useMemo(() => ({
    all:       appointments.length,
    pending:   appointments.filter((a) => a.status === "pending").length,
    upcoming:  appointments.filter((a) => a.status === "confirmed" && a.appointment_date >= todayStr).length,
    completed: appointments.filter((a) => a.status === "completed").length,
    canceled:  appointments.filter((a) => a.status === "canceled" || a.status === "cancelled").length,
  }), [appointments, todayStr]);

  const filtered = useMemo(() => {
    switch (activeTab) {
      case "pending":
        return appointments.filter((a) => a.status === "pending");
      case "upcoming":
        return appointments
          .filter((a) => a.status === "confirmed" && a.appointment_date >= todayStr)
          .sort((a, b) => {
            const dc = (a.appointment_date ?? "").localeCompare(b.appointment_date ?? "");
            return dc !== 0 ? dc : (a.appointment_time ?? "").localeCompare(b.appointment_time ?? "");
          });
      case "completed":
        return appointments.filter((a) => a.status === "completed");
      case "canceled":
        return appointments.filter((a) => a.status === "canceled" || a.status === "cancelled");
      default:
        return [...appointments].sort((a, b) => {
          const order = { pending: 0, confirmed: 1, completed: 2, canceled: 3, cancelled: 3 };
          const diff = (order[a.status] ?? 9) - (order[b.status] ?? 9);
          return diff !== 0 ? diff : (b.appointment_date ?? "").localeCompare(a.appointment_date ?? "");
        });
    }
  }, [appointments, activeTab, todayStr]);

  const monthRevenue = useMemo(() =>
    appointments
      .filter((a) =>
        (a.status === "confirmed" || a.status === "completed") &&
        a.appointment_date?.startsWith(thisMonthStr)
      )
      .reduce((sum, a) => sum + Number(a.deposit_amount ?? 0), 0),
    [appointments, thisMonthStr]
  );

  const selectedAppt = useMemo(() =>
    appointments.find((a) => a.id === selectedId) ?? null,
    [appointments, selectedId]
  );

  function selectAppt(id) {
    setSelectedId(id);
    setShowDetail(true);
    setMsg("");
    setErr("");
  }

  async function handleAccept(appt) {
    setActionLoading(`${appt.id}_accept`);
    setMsg(""); setErr("");
    try {
      const { error } = await supabase
        .from("appointments")
        .update({ status: "confirmed", updated_at: new Date().toISOString() })
        .eq("id", appt.id);
      if (error) throw error;
      try {
        await supabase.functions.invoke("send-booking-notification", {
          body: { appointment_id: appt.id, event: "status_confirmed" },
        });
      } catch { /* best-effort */ }
      setAppointments((prev) =>
        prev.map((a) => (a.id === appt.id ? { ...a, status: "confirmed" } : a))
      );
      setMsg("Appointment confirmed. Client has been notified.");
    } catch {
      setErr("Could not confirm appointment. Please try again.");
    }
    setActionLoading(null);
  }

  async function handleDecline(appt) {
    setActionLoading(`${appt.id}_decline`);
    setMsg(""); setErr("");
    try {
      if (appt.deposit_paid) {
        const { error } = await supabase.functions.invoke("refund-deposit", {
          body: { appointment_id: appt.id, reason: "pro_declined" },
        });
        if (error) throw new Error("Refund failed");
      } else {
        const { error } = await supabase
          .from("appointments")
          .update({ status: "canceled", updated_at: new Date().toISOString() })
          .eq("id", appt.id);
        if (error) throw error;
      }
      try {
        await supabase.functions.invoke("send-booking-notification", {
          body: { appointment_id: appt.id, event: "status_canceled" },
        });
      } catch { /* best-effort */ }
      setAppointments((prev) =>
        prev.map((a) => (a.id === appt.id ? { ...a, status: "canceled" } : a))
      );
      setMsg(
        appt.deposit_paid
          ? "Appointment declined and deposit refunded to client."
          : "Appointment declined."
      );
    } catch {
      setErr("Could not decline appointment. Please try again.");
    }
    setActionLoading(null);
  }

  async function handleComplete(appt) {
    setActionLoading(`${appt.id}_complete`);
    setMsg(""); setErr("");
    try {
      const { error } = await supabase
        .from("appointments")
        .update({ status: "completed", updated_at: new Date().toISOString() })
        .eq("id", appt.id);
      if (error) throw error;
      try {
        await supabase.functions.invoke("send-booking-notification", {
          body: { appointment_id: appt.id, event: "status_completed" },
        });
      } catch { /* best-effort */ }
      setAppointments((prev) =>
        prev.map((a) => (a.id === appt.id ? { ...a, status: "completed" } : a))
      );
      setMsg("Appointment marked as completed.");
    } catch {
      setErr("Could not complete appointment. Please try again.");
    }
    setActionLoading(null);
  }

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  // ─── Render ────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <AppShell title="Appointments" onSignOut={signOut}>
        <div className="g-page">
          <div className="ap-loadingGrid">
            {[1, 2, 3, 4].map((i) => <div key={i} className="ap-skeleton" />)}
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Appointments" onSignOut={signOut} pendingCount={counts.pending}>
      <div className="g-page">

        {/* Stats bar */}
        <div className="ap-stats">
          <div className="ap-stat">
            <div className="ap-statLabel">Total Bookings</div>
            <div className="ap-statVal">{counts.all}</div>
          </div>
          <div className="ap-stat ap-statAlert">
            <div className="ap-statLabel">Needs Action</div>
            <div className="ap-statVal">{counts.pending}</div>
          </div>
          <div className="ap-stat ap-statGreen">
            <div className="ap-statLabel">Revenue (this month)</div>
            <div className="ap-statVal">{money(monthRevenue)}</div>
          </div>
          <div className="ap-stat">
            <div className="ap-statLabel">Upcoming</div>
            <div className="ap-statVal">{counts.upcoming}</div>
          </div>
        </div>

        {/* Tab bar */}
        <div className="ap-tabBar" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.key}
              role="tab"
              aria-selected={activeTab === t.key}
              className={`ap-tab${activeTab === t.key ? " ap-tabActive" : ""}`}
              onClick={() => { setActiveTab(t.key); setSelectedId(null); setShowDetail(false); }}
            >
              {t.label}
              {counts[t.key] > 0 && (
                <span className={`ap-tabCount${t.key === "pending" && counts.pending > 0 ? " ap-tabCountAlert" : ""}`}>
                  {counts[t.key]}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Master-detail layout */}
        <div className="ap-layout">

          {/* Appointment list */}
          <div className="ap-list" role="list">
            {filtered.length === 0 ? (
              <div className="ap-empty">
                <div className="ap-emptyIcon">🗓</div>
                <div style={{ fontWeight: 700 }}>
                  {activeTab === "pending" ? "You're all caught up" : `No ${activeTab} appointments`}
                </div>
                <div className="u-muted">
                  {activeTab === "pending"
                    ? "No pending requests right now."
                    : "Nothing to show here yet."}
                </div>
              </div>
            ) : (
              filtered.map((appt) => (
                <button
                  key={appt.id}
                  role="listitem"
                  className={
                    `ap-item` +
                    (selectedId === appt.id ? " ap-itemSelected" : "") +
                    (appt.status === "pending" ? " ap-itemPending" : "")
                  }
                  onClick={() => selectAppt(appt.id)}
                >
                  <div className="ap-avatar" data-status={appt.status}>
                    {getInitials(appt.client_name)}
                  </div>
                  <div className="ap-info">
                    <div className="ap-infoTop">
                      <span className="ap-clientName">{appt.client_name || "Client"}</span>
                      <StatusBadge status={appt.status} />
                    </div>
                    <div className="ap-service">{appt.service || "—"}</div>
                    <div className="ap-meta">
                      {formatApptDate(appt.appointment_date, appt.appointment_time)}
                      {durationLabel(appt.duration_minutes) ? ` · ${durationLabel(appt.duration_minutes)}` : ""}
                    </div>
                  </div>
                  {Number(appt.deposit_amount) > 0 && (
                    <div className="ap-itemAmount">
                      {money(appt.deposit_amount)}
                      {appt.deposit_paid && <span className="ap-itemPaid">paid</span>}
                    </div>
                  )}
                </button>
              ))
            )}
          </div>

          {/* Detail panel */}
          {selectedAppt ? (
            <div className={`ap-detail${showDetail ? " ap-detailOpen" : ""}`}>
              <div className="ap-detailHead">
                <button
                  className="ap-detailClose"
                  aria-label="Close"
                  onClick={() => { setShowDetail(false); setSelectedId(null); }}
                >
                  ✕
                </button>
                <StatusBadge status={selectedAppt.status} />
              </div>

              <div className="ap-detailHero">
                <div className="ap-detailAvatar">{getInitials(selectedAppt.client_name)}</div>
                <div>
                  <div className="ap-detailName">{selectedAppt.client_name || "Client"}</div>
                  {selectedAppt.client_phone && (
                    <a className="ap-detailPhone" href={`tel:${selectedAppt.client_phone}`}>
                      📞 {selectedAppt.client_phone}
                    </a>
                  )}
                </div>
              </div>

              <div className="ap-detailSection">
                <div className="ap-detailRow">
                  <span className="ap-detailLabel">Service</span>
                  <span>{selectedAppt.service || "—"}</span>
                </div>
                <div className="ap-detailRow">
                  <span className="ap-detailLabel">Date &amp; Time</span>
                  <span>{formatDateLong(selectedAppt.appointment_date, selectedAppt.appointment_time)}</span>
                </div>
                <div className="ap-detailRow">
                  <span className="ap-detailLabel">Duration</span>
                  <span>{durationLabel(selectedAppt.duration_minutes) || "—"}</span>
                </div>
                <div className="ap-detailRow">
                  <span className="ap-detailLabel">Service Price</span>
                  <span>
                    {Number(selectedAppt.service_price_at_booking) > 0
                      ? money(selectedAppt.service_price_at_booking)
                      : "—"}
                  </span>
                </div>
                <div className="ap-detailRow">
                  <span className="ap-detailLabel">Deposit</span>
                  <span>
                    {Number(selectedAppt.deposit_amount) > 0
                      ? `${money(selectedAppt.deposit_amount)}${selectedAppt.deposit_paid ? " ✓" : " (unpaid)"}`
                      : "None"}
                  </span>
                </div>
                {selectedAppt.notes && (
                  <div className="ap-detailRow ap-detailRowFull">
                    <span className="ap-detailLabel">Notes</span>
                    <span>{selectedAppt.notes}</span>
                  </div>
                )}
              </div>

              {msg && <div className="ap-msg ap-msgOk">{msg}</div>}
              {err && <div className="ap-msg ap-msgErr">{err}</div>}

              <div className="ap-detailActions">
                {selectedAppt.status === "pending" && (
                  <>
                    <button
                      className="ap-actionBtn ap-actionAccept"
                      disabled={!!actionLoading}
                      onClick={() => handleAccept(selectedAppt)}
                    >
                      {actionLoading === `${selectedAppt.id}_accept` ? "Confirming…" : "✓ Accept Booking"}
                    </button>
                    <button
                      className="ap-actionBtn ap-actionDecline"
                      disabled={!!actionLoading}
                      onClick={() => handleDecline(selectedAppt)}
                    >
                      {actionLoading === `${selectedAppt.id}_decline` ? "Declining…" : "✕ Decline"}
                    </button>
                  </>
                )}
                {selectedAppt.status === "confirmed" && (
                  <>
                    <button
                      className="ap-actionBtn ap-actionComplete"
                      disabled={!!actionLoading}
                      onClick={() => handleComplete(selectedAppt)}
                    >
                      {actionLoading === `${selectedAppt.id}_complete` ? "Completing…" : "✓ Mark as Complete"}
                    </button>
                    <button
                      className="ap-actionBtn ap-actionDecline"
                      disabled={!!actionLoading}
                      onClick={() => handleDecline(selectedAppt)}
                    >
                      {actionLoading === `${selectedAppt.id}_decline` ? "Canceling…" : "✕ Cancel Appointment"}
                    </button>
                  </>
                )}
                {selectedAppt.status === "completed" && (
                  <div className="ap-detailState ap-detailStateDone">✓ Completed</div>
                )}
                {(selectedAppt.status === "canceled" || selectedAppt.status === "cancelled") && (
                  <div className="ap-detailState ap-detailStateCanceled">Appointment Canceled</div>
                )}
              </div>
            </div>
          ) : (
            <div className="ap-detailEmpty">
              <div className="ap-detailEmptyIcon">👈</div>
              <div style={{ fontWeight: 600 }}>Select an appointment</div>
              <div className="u-muted">Tap any appointment to view details and take action.</div>
            </div>
          )}
        </div>

      </div>
    </AppShell>
  );
}
