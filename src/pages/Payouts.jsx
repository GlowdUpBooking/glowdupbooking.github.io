import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppShell from "../components/layout/AppShell";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import { supabase } from "../lib/supabase";
import {
  fetchStripeConnectStatus,
  fetchStripeConnectBalance,
  requestInstantPayout,
  getStripeLoginLink,
  createStripeConnectOnboardingLink,
} from "../lib/stripeConnect";

function money(n) {
  const num = Number(n ?? 0);
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(num);
  } catch {
    return `$${num.toFixed(2)}`;
  }
}

function StatusDot({ ok, pending }) {
  const cls = ok ? "py-dotGreen" : pending ? "py-dotYellow" : "py-dotGray";
  return <span className={`py-dot ${cls}`} />;
}

export default function Payouts() {
  const nav = useNavigate();

  const [loading, setLoading]           = useState(true);
  const [connectStatus, setConnectStatus] = useState(null);
  const [balance, setBalance]           = useState(null);
  const [payoutLoading, setPayoutLoading] = useState(false);
  const [loginLoading, setLoginLoading]   = useState(false);
  const [connectLoading, setConnectLoading] = useState(false);
  const [msg, setMsg]                   = useState("");
  const [err, setErr]                   = useState("");

  useEffect(() => {
    let mounted = true;
    async function load() {
      const { data: authRes, error: authErr } = await supabase.auth.getUser();
      if (authErr || !authRes?.user) { nav("/login", { replace: true }); return; }

      const status = await fetchStripeConnectStatus();
      if (!mounted) return;
      setConnectStatus(status);

      if (status?.connected) {
        const bal = await fetchStripeConnectBalance();
        if (mounted) setBalance(bal);
      }

      if (mounted) setLoading(false);
    }
    load();
    return () => { mounted = false; };
  }, [nav]);

  async function handleInstantPayout() {
    setPayoutLoading(true);
    setMsg(""); setErr("");
    try {
      const result = await requestInstantPayout();
      if (result?.error) throw new Error(result.error);
      const payoutAmount = result?.amount ? money(result.amount / 100) : "";
      const arrivalDate = result?.arrival_date
        ? new Date(result.arrival_date * 1000).toLocaleDateString(undefined, { month: "short", day: "numeric" })
        : null;
      setMsg(`Payout${payoutAmount ? ` of ${payoutAmount}` : ""} initiated.${arrivalDate ? ` Arrives ${arrivalDate}.` : ""}`);
      const bal = await fetchStripeConnectBalance();
      setBalance(bal);
    } catch (e) {
      setErr(e.message || "Payout failed. Please try again or check your Stripe dashboard.");
    }
    setPayoutLoading(false);
  }

  async function handleOpenDashboard() {
    setLoginLoading(true);
    setErr("");
    try {
      const url = await getStripeLoginLink();
      if (url) window.open(url, "_blank", "noopener");
      else setErr("Could not open Stripe dashboard. Try again.");
    } catch (e) {
      setErr(e.message || "Could not open Stripe dashboard.");
    }
    setLoginLoading(false);
  }

  async function handleConnect() {
    setConnectLoading(true);
    setErr("");
    try {
      const { url } = await createStripeConnectOnboardingLink();
      if (url) window.location.assign(url);
      else setErr("Could not start Stripe onboarding. Please try again.");
    } catch (e) {
      setErr(e.message || "Could not start Stripe onboarding.");
    }
    setConnectLoading(false);
  }

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  if (loading) {
    return (
      <AppShell title="Payouts" onSignOut={signOut}>
        <div className="g-page">
          <div className="ap-loadingGrid">
            {[1, 2].map((i) => <div key={i} className="ap-skeleton" style={{ height: 160 }} />)}
          </div>
        </div>
      </AppShell>
    );
  }

  const isConnected   = Boolean(connectStatus?.connected);
  const chargesOk     = Boolean(connectStatus?.charges_enabled);
  const payoutsOk     = Boolean(connectStatus?.payouts_enabled);
  const availCents    = balance?.available ?? 0;
  const pendingCents  = balance?.pending ?? 0;

  return (
    <AppShell title="Payouts" onSignOut={signOut}>
      <div className="g-page">
        <h1 className="g-h1">Payouts</h1>

        {!isConnected ? (
          /* ── Not connected ─────────────────────────────────────── */
          <div className="py-connectCard">
            <div className="py-connectIcon">💳</div>
            <div className="py-connectTitle">Connect Stripe to get paid</div>
            <div className="u-muted" style={{ maxWidth: 400, textAlign: "center" }}>
              Link your Stripe account to start collecting client deposits and requesting instant payouts directly to your bank.
            </div>
            {err && <div className="ap-msg ap-msgErr">{err}</div>}
            <button
              className="py-actionBtn py-actionPrimary"
              style={{ minWidth: 200 }}
              disabled={connectLoading}
              onClick={handleConnect}
            >
              {connectLoading ? "Opening Stripe…" : "Connect with Stripe →"}
            </button>
            <div className="u-muted" style={{ fontSize: 12 }}>
              Powered by Stripe Connect — industry-standard secure payouts.
            </div>
          </div>
        ) : (
          /* ── Connected ──────────────────────────────────────────── */
          <div className="py-grid">

            {/* Balance + actions */}
            <div className="py-balanceCard">
              <div className="py-balanceMeta">
                <div className="py-balanceLabel">Available Balance</div>
                <div className="py-statusRow">
                  <StatusDot ok={payoutsOk} pending={!payoutsOk} />
                  <span style={{ fontSize: 12, opacity: 0.7 }}>
                    {payoutsOk ? "Payouts active" : "Payouts pending verification"}
                  </span>
                </div>
              </div>

              <div className="py-balanceAmount">{money(availCents / 100)}</div>

              {pendingCents > 0 && (
                <div className="py-balancePending">
                  {money(pendingCents / 100)} pending (in transit to Stripe)
                </div>
              )}

              {msg && <div className="ap-msg ap-msgOk">{msg}</div>}
              {err && <div className="ap-msg ap-msgErr">{err}</div>}

              <div className="py-actions">
                <button
                  className="py-actionBtn py-actionPrimary"
                  disabled={payoutLoading || availCents === 0 || !payoutsOk}
                  onClick={handleInstantPayout}
                >
                  {payoutLoading
                    ? "Processing…"
                    : availCents > 0
                    ? `⚡ Instant Payout · ${money(availCents / 100)}`
                    : "⚡ Instant Payout"}
                </button>

                <button
                  className="py-actionBtn py-actionSecondary"
                  disabled={loginLoading}
                  onClick={handleOpenDashboard}
                >
                  {loginLoading ? "Opening…" : "↗ Open Stripe Dashboard"}
                </button>
              </div>

              <div className="u-muted" style={{ fontSize: 12 }}>
                Instant payouts typically arrive within minutes, depending on your bank.
              </div>
            </div>

            {/* Account status */}
            <Card>
              <div className="g-cardTitle" style={{ marginBottom: 14 }}>Account Status</div>
              <div className="py-statusGrid">
                <div className="py-statusItem">
                  <span className="py-statusLabel">Stripe Connect</span>
                  <span className="py-statusRow">
                    <StatusDot ok={isConnected} />
                    {isConnected ? "Connected" : "Not connected"}
                  </span>
                </div>
                <div className="py-statusItem">
                  <span className="py-statusLabel">Charges enabled</span>
                  <span className="py-statusRow">
                    <StatusDot ok={chargesOk} pending={!chargesOk} />
                    {chargesOk ? "Active" : "Pending review"}
                  </span>
                </div>
                <div className="py-statusItem">
                  <span className="py-statusLabel">Payouts enabled</span>
                  <span className="py-statusRow">
                    <StatusDot ok={payoutsOk} pending={!payoutsOk} />
                    {payoutsOk ? "Active" : "Pending review"}
                  </span>
                </div>
                <div className="py-statusItem">
                  <span className="py-statusLabel">Details submitted</span>
                  <span className="py-statusRow">
                    <StatusDot ok={connectStatus?.details_submitted} pending={!connectStatus?.details_submitted} />
                    {connectStatus?.details_submitted ? "Complete" : "Incomplete"}
                  </span>
                </div>
                {connectStatus?.account_id && (
                  <div className="py-statusItem">
                    <span className="py-statusLabel">Account ID</span>
                    <span style={{ fontSize: 12, opacity: 0.6, fontFamily: "monospace" }}>
                      {connectStatus.account_id}
                    </span>
                  </div>
                )}
              </div>

              {!payoutsOk && (
                <div className="u-muted" style={{ fontSize: 13, marginTop: 14, padding: "10px 14px", background: "rgba(255,209,102,0.08)", borderRadius: 10, border: "1px solid rgba(255,209,102,0.2)" }}>
                  Stripe is still reviewing your account. Payouts will be enabled once verification is complete — typically 1–2 business days.
                </div>
              )}

              <button
                className="py-actionBtn py-actionSecondary"
                style={{ marginTop: 14 }}
                disabled={loginLoading}
                onClick={handleOpenDashboard}
              >
                {loginLoading ? "Opening…" : "↗ Manage in Stripe"}
              </button>
            </Card>

          </div>
        )}
      </div>
    </AppShell>
  );
}
