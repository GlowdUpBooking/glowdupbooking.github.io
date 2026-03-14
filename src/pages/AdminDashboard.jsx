import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import { useAuth } from "../components/auth/useAuth";
import { fetchPlatformAdminDashboard } from "../lib/platformAdmin";
import { supabase } from "../lib/supabase";

function formatMoney(amount) {
  const value = Number(amount ?? 0);
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `$${value.toFixed(0)}`;
  }
}

function formatNumber(value) {
  return new Intl.NumberFormat().format(Number(value ?? 0));
}

function formatDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unavailable";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatShortDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unavailable";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function StatusPill({ confirmed }) {
  return (
    <span className={`adm-statusPill${confirmed ? " is-confirmed" : ""}`}>
      {confirmed ? "Confirmed" : "Pending"}
    </span>
  );
}

function MetricCard({ label, value, tone = "default", detail }) {
  return (
    <Card className={`adm-metricCard adm-tone-${tone}`}>
      <div className="adm-metricLabel">{label}</div>
      <div className="adm-metricValue">{value}</div>
      {detail ? <div className="adm-metricDetail">{detail}</div> : null}
    </Card>
  );
}

function DetailRow({ label, value }) {
  return (
    <div className="adm-detailRow">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export default function AdminDashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [dashboard, setDashboard] = useState(null);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError("");

      try {
        const nextDashboard = await fetchPlatformAdminDashboard();
        if (!active) return;
        setDashboard(nextDashboard);
      } catch (err) {
        console.error("[AdminDashboard] load error:", err);
        if (!active) return;
        setError(err?.message || "Could not load platform metrics.");
      } finally {
        if (!active) return;
        setLoading(false);
      }
    }

    load();

    return () => {
      active = false;
    };
  }, []);

  const headlineCards = useMemo(() => {
    if (!dashboard) return [];
    return [
      {
        label: "Current users",
        value: formatNumber(dashboard.users?.total),
        detail: `${formatNumber(dashboard.users?.professionals)} professional accounts`,
        tone: "primary",
      },
      {
        label: "New users today",
        value: formatNumber(dashboard.users?.newToday),
        detail: `${formatNumber(dashboard.users?.newMonth)} new this month`,
      },
      {
        label: "Sales today",
        value: formatMoney(dashboard.sales?.today),
        detail: `${formatMoney(dashboard.sales?.month)} this month`,
        tone: "success",
      },
      {
        label: "Bookings today",
        value: formatNumber(dashboard.bookings?.today),
        detail: `${formatNumber(dashboard.bookings?.month)} this month`,
      },
      {
        label: "Active subscriptions",
        value: formatNumber(dashboard.subscriptions?.active),
        detail: `${formatNumber(dashboard.subscriptions?.trialing)} trialing`,
      },
      {
        label: "Studio seats",
        value: formatNumber(dashboard.users?.studioMembers),
        detail: "Active studio members",
      },
      {
        label: "Pending bookings",
        value: formatNumber(dashboard.bookings?.pending),
        detail: `${formatNumber(dashboard.bookings?.completedMonth)} completed this month`,
      },
      {
        label: "Canceled this month",
        value: formatNumber(dashboard.bookings?.canceledMonth),
        detail: `Timezone: ${dashboard.timezone || "America/Chicago"}`,
        tone: "muted",
      },
    ];
  }, [dashboard]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  async function handleRefresh() {
    setRefreshing(true);
    setError("");
    try {
      const nextDashboard = await fetchPlatformAdminDashboard();
      setDashboard(nextDashboard);
    } catch (err) {
      console.error("[AdminDashboard] refresh error:", err);
      setError(err?.message || "Could not refresh platform metrics.");
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div className="adm-page">
      <div className="adm-shell">
        <header className="adm-topbar">
          <div>
            <Link className="adm-brand" to="/">
              Glow&apos;d Up Booking
            </Link>
            <div className="adm-kicker">Platform Admin</div>
            <h1 className="adm-title">Business dashboard</h1>
            <p className="adm-subtitle">
              Signups, bookings, and sales across the platform in one place.
            </p>
          </div>

          <div className="adm-topbarActions">
            <div className="adm-identityCard">
              <span className="adm-identityLabel">Signed in as</span>
              <strong>{user?.email || "Admin"}</strong>
              <span className="adm-identityMeta">
                {dashboard?.generatedAt ? `Updated ${formatDateTime(dashboard.generatedAt)}` : "Waiting for data"}
              </span>
            </div>

            <div className="adm-actionRow">
              <Button variant="outline" onClick={handleRefresh} disabled={refreshing || loading}>
                {refreshing ? "Refreshing..." : "Refresh"}
              </Button>
              <Button variant="primary" onClick={handleSignOut}>
                Sign out
              </Button>
            </div>
          </div>
        </header>

        {error ? <Card className="adm-alertCard">{error}</Card> : null}

        {loading ? (
          <Card className="adm-loadingCard">Loading platform metrics…</Card>
        ) : (
          <>
            <section className="adm-metricGrid">
              {headlineCards.map((card) => (
                <MetricCard
                  key={card.label}
                  label={card.label}
                  value={card.value}
                  detail={card.detail}
                  tone={card.tone}
                />
              ))}
            </section>

            <section className="adm-detailGrid">
              <Card className="adm-panelCard">
                <div className="adm-panelHeader">
                  <div>
                    <div className="adm-panelEyebrow">Revenue mix</div>
                    <h2 className="adm-panelTitle">Sales and demand</h2>
                  </div>
                </div>

                <div className="adm-detailList">
                  <DetailRow label="Sales today" value={formatMoney(dashboard?.sales?.today)} />
                  <DetailRow label="Sales this month" value={formatMoney(dashboard?.sales?.month)} />
                  <DetailRow label="Bookings this month" value={formatNumber(dashboard?.bookings?.month)} />
                  <DetailRow label="Pending bookings" value={formatNumber(dashboard?.bookings?.pending)} />
                  <DetailRow
                    label="Completed this month"
                    value={formatNumber(dashboard?.bookings?.completedMonth)}
                  />
                </div>
              </Card>

              <Card className="adm-panelCard">
                <div className="adm-panelHeader">
                  <div>
                    <div className="adm-panelEyebrow">Account mix</div>
                    <h2 className="adm-panelTitle">Users and plans</h2>
                  </div>
                </div>

                <div className="adm-detailList">
                  <DetailRow label="Total users" value={formatNumber(dashboard?.users?.total)} />
                  <DetailRow label="Professionals" value={formatNumber(dashboard?.users?.professionals)} />
                  <DetailRow label="New users this month" value={formatNumber(dashboard?.users?.newMonth)} />
                  <DetailRow label="Active subscriptions" value={formatNumber(dashboard?.subscriptions?.active)} />
                  <DetailRow label="Active Pro plans" value={formatNumber(dashboard?.subscriptions?.pro)} />
                  <DetailRow label="Active Studio plans" value={formatNumber(dashboard?.subscriptions?.studio)} />
                </div>
              </Card>
            </section>

            <Card className="adm-tableCard">
              <div className="adm-panelHeader">
                <div>
                  <div className="adm-panelEyebrow">Newest accounts</div>
                  <h2 className="adm-panelTitle">Recent users</h2>
                </div>
              </div>

              {dashboard?.recentUsers?.length ? (
                <div className="adm-tableWrap">
                  <table className="adm-table">
                    <thead>
                      <tr>
                        <th>User</th>
                        <th>Joined</th>
                        <th>Role</th>
                        <th>Plan</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dashboard.recentUsers.map((entry) => {
                        const displayName =
                          entry?.businessName || entry?.fullName || entry?.email || "Unknown account";
                        return (
                          <tr key={entry.id}>
                            <td>
                              <div className="adm-userCell">
                                <strong>{displayName}</strong>
                                <span>{entry?.email || "No email"}</span>
                              </div>
                            </td>
                            <td>{formatShortDate(entry?.createdAt)}</td>
                            <td>{entry?.role || "unassigned"}</td>
                            <td>{entry?.planKey || "free"}</td>
                            <td>
                              <StatusPill confirmed={Boolean(entry?.emailConfirmed)} />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="adm-emptyState">No user records have been returned yet.</div>
              )}
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
