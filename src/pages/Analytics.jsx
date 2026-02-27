import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppShell from "../components/layout/AppShell";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import { supabase } from "../lib/supabase";
import { normalizePlanKey } from "../lib/format";

function fmtMoney(amount) {
  const n = Number(amount ?? 0);
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
  } catch {
    return `$${n.toFixed(0)}`;
  }
}

function trendLabel(current, previous) {
  const c = Number(current ?? 0);
  const p = Number(previous ?? 0);
  if (p === 0) return c > 0 ? "▲ New this month" : "—";
  const diff = c - p;
  const sign = diff >= 0 ? "▲" : "▼";
  const abs = Math.abs(diff);
  return `${sign} ${abs} vs last month`;
}

function trendColor(current, previous) {
  const c = Number(current ?? 0);
  const p = Number(previous ?? 0);
  if (p === 0) return "#9aa0a6";
  return c >= p ? "#4cd964" : "#ff3b30";
}

function monthStart(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), 1);
  return d.toISOString().split("T")[0];
}

function dayStart(date, daysBack) {
  const d = new Date(date);
  d.setDate(d.getDate() - daysBack);
  return d.toISOString().split("T")[0];
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function monthKey(date) {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, "0");
  return `${y}-${m}`;
}

function monthLabel(date) {
  return date.toLocaleDateString(undefined, { month: "short" });
}

function buildMonthSeries(rows, months, valueFn) {
  const map = new Map();
  months.forEach((m) => map.set(m.key, 0));
  rows.forEach((row) => {
    const d = row.appointment_date ? new Date(row.appointment_date) : null;
    if (!d || Number.isNaN(d.getTime())) return;
    const key = monthKey(d);
    if (!map.has(key)) return;
    map.set(key, map.get(key) + valueFn(row));
  });
  return months.map((m) => ({ label: m.label, value: map.get(m.key) || 0 }));
}

function LineChart({ series, color }) {
  const width = 520;
  const height = 120;
  const pad = 10;
  const max = Math.max(1, ...series.map((s) => s.value));
  const stepX = (width - pad * 2) / Math.max(1, series.length - 1);
  const points = series.map((s, i) => {
    const x = pad + i * stepX;
    const y = height - pad - (s.value / max) * (height - pad * 2);
    return `${x},${y}`;
  });
  const areaPoints = [`${pad},${height - pad}`, ...points, `${width - pad},${height - pad}`].join(" ");

  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="2"
        points={points.join(" ")}
      />
      <polyline
        fill={color}
        opacity="0.1"
        stroke="none"
        points={areaPoints}
      />
    </svg>
  );
}

function StatCard({ label, value, trend, trendColor: tColor }) {
  return (
    <Card style={{ padding: 16, flex: 1, minWidth: 220 }}>
      <div style={{ fontSize: 26, fontWeight: 800 }}>{value}</div>
      <div className="u-muted" style={{ marginTop: 6, fontWeight: 700 }}>{label}</div>
      {trend ? (
        <div style={{ marginTop: 6, fontSize: 12, fontWeight: 700, color: tColor }}>
          {trend}
        </div>
      ) : null}
    </Card>
  );
}

function FunnelRow({ label, value, total }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <div style={{ fontWeight: 700 }}>{label}</div>
      <div>
        <strong>{value}</strong>
        {total > 0 ? <span className="u-muted" style={{ marginLeft: 8 }}>{pct}%</span> : null}
      </div>
    </div>
  );
}

export default function Analytics() {
  const nav = useNavigate();

  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [err, setErr] = useState("");

  const [user, setUser] = useState(null);
  const [subStatus, setSubStatus] = useState(null);
  const [plan, setPlan] = useState(null);
  const [interval, setInterval] = useState(null);

  const [stats, setStats] = useState({
    thisMonthBookings: 0,
    lastMonthBookings: 0,
    allTimeBookings: 0,
    thisMonthRevenue: 0,
    lastMonthRevenue: 0,
    allTimeRevenue: 0,
    avgDepositThisMonth: 0,
    avgDepositAllTime: 0,
    status30: { pending: 0, confirmed: 0, completed: 0, canceled: 0, total: 0 },
    funnel30: { requests: 0, confirmed: 0, completed: 0 },
    bookingsSeries: [],
    depositsSeries: [],
  });

  const isActive = subStatus === "active";

  const currentPlanKey = useMemo(() => {
    const fromDb = normalizePlanKey(plan);
    if (fromDb) return fromDb;
    if (isActive && interval === "annual") return "founder";
    if (!isActive) return "free";
    return "paid";
  }, [plan, isActive, interval]);

  const isPro = currentPlanKey === "pro" || currentPlanKey === "founder" || currentPlanKey === "elite" || (isActive && currentPlanKey === "paid");

  const thisMonthStart = useMemo(() => monthStart(new Date()), []);
  const lastMonthStart = useMemo(() => monthStart(new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1)), []);
  const last30Start = useMemo(() => dayStart(new Date(), 30), []);
  const sixMonthStart = useMemo(() => monthStart(new Date(new Date().getFullYear(), new Date().getMonth() - 5, 1)), []);

  const lastSixMonths = useMemo(() => {
    const list = [];
    const now = new Date();
    for (let i = 5; i >= 0; i -= 1) {
      const d = startOfMonth(new Date(now.getFullYear(), now.getMonth() - i, 1));
      list.push({ key: monthKey(d), label: monthLabel(d) });
    }
    return list;
  }, []);

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      setErr("");

      try {
        const { data: userRes, error: userErr } = await supabase.auth.getUser();
        if (userErr) throw userErr;
        const u = userRes?.user ?? null;
        if (!mounted) return;
        setUser(u);

        if (!u) {
          nav("/login", { replace: true });
          return;
        }

        const { data: subRow, error: subErr } = await supabase
          .from("pro_subscriptions")
          .select("status, interval, plan")
          .eq("user_id", u.id)
          .maybeSingle();

        if (subErr) {
          console.error("[Analytics] pro_subscriptions error:", subErr);
        }

        if (!mounted) return;
        setSubStatus(subRow?.status ?? null);
        setPlan(subRow?.plan ?? null);
        setInterval(subRow?.interval ?? null);
      } catch (e) {
        console.error("[Analytics] load error:", e);
        if (mounted) setErr("Couldn’t load analytics.");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, [nav]);

  const loadStats = useCallback(async () => {
    if (!user?.id) return;
    setStatsLoading(true);
    try {
      const [
        tmB,
        lmB,
        atB,
        tmP,
        lmP,
        atP,
        last30Rows,
        sixMonthRows,
      ] = await Promise.all([
        supabase
          .from("appointments")
          .select("id", { count: "exact", head: true })
          .eq("profile_id", user.id)
          .gte("appointment_date", thisMonthStart)
          .not("status", "in", '("canceled","cancelled")'),
        supabase
          .from("appointments")
          .select("id", { count: "exact", head: true })
          .eq("profile_id", user.id)
          .gte("appointment_date", lastMonthStart)
          .lt("appointment_date", thisMonthStart)
          .not("status", "in", '("canceled","cancelled")'),
        supabase
          .from("appointments")
          .select("id", { count: "exact", head: true })
          .eq("profile_id", user.id)
          .not("status", "in", '("canceled","cancelled")'),
        supabase
          .from("appointments")
          .select("deposit_amount")
          .eq("profile_id", user.id)
          .eq("deposit_paid", true)
          .gte("appointment_date", thisMonthStart),
        supabase
          .from("appointments")
          .select("deposit_amount")
          .eq("profile_id", user.id)
          .eq("deposit_paid", true)
          .gte("appointment_date", lastMonthStart)
          .lt("appointment_date", thisMonthStart),
        supabase
          .from("appointments")
          .select("deposit_amount")
          .eq("profile_id", user.id)
          .eq("deposit_paid", true),
        supabase
          .from("appointments")
          .select("status, deposit_paid, deposit_amount")
          .eq("profile_id", user.id)
          .gte("appointment_date", last30Start),
        supabase
          .from("appointments")
          .select("appointment_date, status, deposit_paid, deposit_amount")
          .eq("profile_id", user.id)
          .gte("appointment_date", sixMonthStart),
      ]);

      const sumDeposits = (rows) => (rows ?? []).reduce((acc, r) => acc + Number(r.deposit_amount ?? 0), 0);

      const tmDepositSum = sumDeposits(tmP.data);
      const atDepositSum = sumDeposits(atP.data);
      const tmDepositCount = (tmP.data ?? []).length;
      const atDepositCount = (atP.data ?? []).length;

      const statusCounts = { pending: 0, confirmed: 0, completed: 0, canceled: 0, total: 0 };
      const rows = last30Rows.data ?? [];
      rows.forEach((r) => {
        const s = String(r.status || "").toLowerCase();
        statusCounts.total += 1;
        if (s === "pending") statusCounts.pending += 1;
        else if (s === "confirmed") statusCounts.confirmed += 1;
        else if (s === "completed") statusCounts.completed += 1;
        else if (s === "canceled" || s === "cancelled") statusCounts.canceled += 1;
      });

      const confirmedOrCompleted = statusCounts.confirmed + statusCounts.completed;

      const sixRows = sixMonthRows.data ?? [];
      const bookingsSeries = buildMonthSeries(
        sixRows.filter((r) => !["canceled", "cancelled"].includes(String(r.status || "").toLowerCase())),
        lastSixMonths,
        () => 1
      );
      const depositsSeries = buildMonthSeries(
        sixRows.filter((r) => r.deposit_paid),
        lastSixMonths,
        (r) => Number(r.deposit_amount ?? 0)
      );

      setStats({
        thisMonthBookings: tmB.count ?? 0,
        lastMonthBookings: lmB.count ?? 0,
        allTimeBookings: atB.count ?? 0,
        thisMonthRevenue: tmDepositSum,
        lastMonthRevenue: sumDeposits(lmP.data),
        allTimeRevenue: atDepositSum,
        avgDepositThisMonth: tmDepositCount ? tmDepositSum / tmDepositCount : 0,
        avgDepositAllTime: atDepositCount ? atDepositSum / atDepositCount : 0,
        status30: statusCounts,
        funnel30: {
          requests: statusCounts.total,
          confirmed: confirmedOrCompleted,
          completed: statusCounts.completed,
        },
        bookingsSeries,
        depositsSeries,
      });
    } catch (e) {
      console.error("[Analytics] loadStats error:", e);
    } finally {
      setStatsLoading(false);
    }
  }, [user?.id, thisMonthStart, lastMonthStart, last30Start, lastSixMonths, sixMonthStart]);

  useEffect(() => {
    if (!loading && isPro) loadStats();
    else if (!loading) setStatsLoading(false);
  }, [loading, isPro, loadStats]);

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  if (loading) {
    return (
      <AppShell title="Analytics" onSignOut={signOut}>
        <Card style={{ padding: 18 }}>
          <div style={{ fontWeight: 800, fontSize: 18 }}>Loading…</div>
          <div className="u-muted" style={{ marginTop: 6 }}>
            Please wait.
          </div>
        </Card>
      </AppShell>
    );
  }

  if (!isPro) {
    return (
      <AppShell title="Analytics" onSignOut={signOut}>
        <div className="g-page">
          <Card style={{ padding: 18 }}>
            <div style={{ fontSize: 28, fontWeight: 900 }}>Analytics</div>
            <div className="u-muted" style={{ marginTop: 6 }}>
              Track booking trends and deposit revenue. Analytics is included in the Pro plan.
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginTop: 16 }}>
              {[
                "Bookings this month",
                "Revenue this month",
                "All-time bookings",
                "All-time revenue",
              ].map((label) => (
                <Card key={label} style={{ padding: 14, opacity: 0.55 }}>
                  <div style={{ fontSize: 24, fontWeight: 800 }}>—</div>
                  <div className="u-muted" style={{ marginTop: 6 }}>{label}</div>
                </Card>
              ))}
            </div>

            <div style={{ marginTop: 16, display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Button variant="primary" onClick={() => nav("/app/subscription")}>Upgrade to Pro</Button>
              <Button variant="outline" onClick={() => nav("/app")}>Back to dashboard</Button>
            </div>
          </Card>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Analytics" onSignOut={signOut}>
      <div className="g-page">
        <h1 className="g-h1">Analytics</h1>
        <div className="u-muted" style={{ marginTop: 4 }}>
          {new Date().toLocaleString(undefined, { month: "long", year: "numeric" })}
        </div>

        {err ? <div className="u-muted" style={{ marginTop: 10 }}>{err}</div> : null}

        <div style={{ marginTop: 18 }}>
          <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 8 }}>Bookings</div>
          {statsLoading ? (
            <Card style={{ padding: 16 }}>Loading metrics…</Card>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
              <StatCard
                label="This month"
                value={String(stats.thisMonthBookings)}
                trend={trendLabel(stats.thisMonthBookings, stats.lastMonthBookings)}
                trendColor={trendColor(stats.thisMonthBookings, stats.lastMonthBookings)}
              />
              <StatCard
                label="Last month"
                value={String(stats.lastMonthBookings)}
              />
              <Card style={{ padding: 16, gridColumn: "1 / -1" }}>
                <div style={{ fontSize: 32, fontWeight: 900 }}>{stats.allTimeBookings}</div>
                <div className="u-muted" style={{ marginTop: 6 }}>Total bookings</div>
              </Card>
            </div>
          )}
        </div>

        <div style={{ marginTop: 20 }}>
          <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 4 }}>Deposit Revenue</div>
          <div className="u-muted" style={{ marginBottom: 8 }}>
            Total deposits collected from paid bookings
          </div>
          {statsLoading ? (
            <Card style={{ padding: 16 }}>Loading metrics…</Card>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
              <StatCard
                label="This month"
                value={fmtMoney(stats.thisMonthRevenue)}
                trend={trendLabel(stats.thisMonthRevenue, stats.lastMonthRevenue)}
                trendColor={trendColor(stats.thisMonthRevenue, stats.lastMonthRevenue)}
              />
              <StatCard
                label="Last month"
                value={fmtMoney(stats.lastMonthRevenue)}
              />
              <Card style={{ padding: 16, gridColumn: "1 / -1" }}>
                <div style={{ fontSize: 32, fontWeight: 900 }}>{fmtMoney(stats.allTimeRevenue)}</div>
                <div className="u-muted" style={{ marginTop: 6 }}>All-time deposits collected</div>
              </Card>
            </div>
          )}
        </div>

        <div style={{ marginTop: 20 }}>
          <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 8 }}>6‑Month Trends</div>
          {statsLoading ? (
            <Card style={{ padding: 16 }}>Loading metrics…</Card>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
              <Card style={{ padding: 16 }}>
                <div style={{ fontWeight: 700, marginBottom: 8 }}>Bookings</div>
                <LineChart series={stats.bookingsSeries || []} color="#6cffb3" />
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, opacity: 0.7, marginTop: 6 }}>
                  {(stats.bookingsSeries || []).map((s) => (
                    <span key={s.label}>{s.label}</span>
                  ))}
                </div>
              </Card>
              <Card style={{ padding: 16 }}>
                <div style={{ fontWeight: 700, marginBottom: 8 }}>Deposit Revenue</div>
                <LineChart series={stats.depositsSeries || []} color="#ffd678" />
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, opacity: 0.7, marginTop: 6 }}>
                  {(stats.depositsSeries || []).map((s) => (
                    <span key={s.label}>{s.label}</span>
                  ))}
                </div>
              </Card>
            </div>
          )}
        </div>

        <div style={{ marginTop: 20 }}>
          <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 8 }}>Last 30 Days Breakdown</div>
          {statsLoading ? (
            <Card style={{ padding: 16 }}>Loading metrics…</Card>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
              <StatCard label="Pending" value={String(stats.status30.pending)} />
              <StatCard label="Confirmed" value={String(stats.status30.confirmed)} />
              <StatCard label="Completed" value={String(stats.status30.completed)} />
              <StatCard label="Canceled" value={String(stats.status30.canceled)} />
            </div>
          )}
        </div>

        <div style={{ marginTop: 20 }}>
          <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 8 }}>Conversion Funnel (Last 30 Days)</div>
          {statsLoading ? (
            <Card style={{ padding: 16 }}>Loading metrics…</Card>
          ) : (
            <Card style={{ padding: 16, display: "grid", gap: 10 }}>
              <FunnelRow label="Requests" value={stats.funnel30.requests} total={stats.funnel30.requests} />
              <FunnelRow label="Confirmed" value={stats.funnel30.confirmed} total={stats.funnel30.requests} />
              <FunnelRow label="Completed" value={stats.funnel30.completed} total={stats.funnel30.requests} />
            </Card>
          )}
        </div>

        <div style={{ marginTop: 20 }}>
          <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 8 }}>Deposit Summary</div>
          {statsLoading ? (
            <Card style={{ padding: 16 }}>Loading metrics…</Card>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
              <StatCard label="Avg deposit (this month)" value={fmtMoney(stats.avgDepositThisMonth)} />
              <StatCard label="Avg deposit (all-time)" value={fmtMoney(stats.avgDepositAllTime)} />
            </div>
          )}
        </div>

        <div style={{ marginTop: 18 }}>
          <Button variant="outline" onClick={loadStats} disabled={statsLoading}>Refresh</Button>
        </div>
      </div>
    </AppShell>
  );
}
