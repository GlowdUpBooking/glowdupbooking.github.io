import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import OnboardingProgress from "../../components/onboarding/OnboardingProgress";
import { supabase } from "../../lib/supabase";
import {
  createStripeConnectOnboardingLink,
  fetchStripeConnectStatus,
} from "../../lib/stripeConnect";

export default function OnboardingPayouts() {
  const nav = useNavigate();
  const [params] = useSearchParams();

  const [userId, setUserId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [autosaveStatus, setAutosaveStatus] = useState("Checking payout status...");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [status, setStatus] = useState({
    connected: false,
    account_id: null,
    charges_enabled: false,
    payouts_enabled: false,
    details_submitted: false,
    status: "not_started",
  });

  const stripeState = params.get("stripe");

  async function refreshStatus() {
    setAutosaveStatus("Checking payout status...");
    const s = await fetchStripeConnectStatus();
    setStatus(s);
    setAutosaveStatus(s.connected ? "Connected" : "Needs setup");
    return s;
  }

  useEffect(() => {
    let mounted = true;

    (async () => {
      setLoading(true);
      const { data } = await supabase.auth.getUser();
      const user = data?.user ?? null;
      if (!user) {
        nav("/login");
        return;
      }
      if (!mounted) return;
      setUserId(user.id);

      if (stripeState === "return") {
        setMsg("Welcome back. We rechecked your Stripe setup.");
      } else if (stripeState === "refresh") {
        setMsg("Stripe requested another step. Continue setup below.");
      }

      await refreshStatus();
      if (!mounted) return;
      setLoading(false);
    })();

    return () => {
      mounted = false;
    };
  }, [nav, stripeState]);

  const statusLabel = useMemo(() => {
    if (status.connected) return "Connected and payout-ready";
    if (status.details_submitted) return "Submitted to Stripe (pending review)";
    if (status.account_id) return "Setup started";
    return "Not connected";
  }, [status]);

  async function startConnect() {
    setBusy(true);
    setErr("");
    setMsg("");
    try {
      const data = await createStripeConnectOnboardingLink();
      if (data?.url) {
        window.location.assign(data.url);
        return;
      }
      throw new Error("Could not start Stripe onboarding.");
    } catch (err) {
      setErr(err?.message || "Couldn’t start Stripe onboarding.");
      setBusy(false);
    }
  }

  async function finishOnboarding() {
    if (!userId) return;
    setBusy(true);
    setErr("");
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ onboarding_step: "complete" })
        .eq("id", userId);
      if (error) throw error;
      nav("/app", { replace: true });
    } catch {
      setErr("Couldn’t finish onboarding. Please try again.");
      setBusy(false);
    }
  }

  if (loading) return null;

  return (
    <div className="obPage page">
      <div className="bg" aria-hidden="true" />
      <main className="container">
        <section className="heroPanel">
          <h1>Payout setup</h1>
          <p className="heroMicro">
            Connect Stripe so deposits, prepay, and payouts can run in your account.
          </p>

          <OnboardingProgress active="payouts" autosaveStatus={autosaveStatus} />

          <div
            style={{
              marginTop: 16,
              border: "1px solid rgba(255,255,255,0.14)",
              borderRadius: 14,
              padding: 14,
              background: "rgba(255,255,255,0.03)",
              maxWidth: 700,
            }}
          >
            <div style={{ fontWeight: 800, fontSize: 18 }}>{statusLabel}</div>
            <div style={{ marginTop: 8, opacity: 0.84, fontSize: 14 }}>
              {status.account_id ? `Stripe account: ${status.account_id}` : "No Stripe account linked yet."}
            </div>

            <ul style={{ marginTop: 14, display: "grid", gap: 8, paddingLeft: 18 }}>
              <li>Charges enabled: {status.charges_enabled ? "Yes" : "No"}</li>
              <li>Payouts enabled: {status.payouts_enabled ? "Yes" : "No"}</li>
              <li>Details submitted: {status.details_submitted ? "Yes" : "No"}</li>
            </ul>
          </div>

          {msg ? <div style={{ marginTop: 12, opacity: 0.95 }}>{msg}</div> : null}
          {err ? <div style={{ marginTop: 12, opacity: 0.95 }}>{err}</div> : null}

          <div className="heroBtns" style={{ marginTop: 18, gap: 10 }}>
            <button className="btn gold" onClick={startConnect} disabled={busy}>
              {busy ? "Loading..." : status.connected ? "Review Stripe setup" : "Connect Stripe payouts"}
            </button>
            <button className="btn ghost" onClick={refreshStatus} disabled={busy}>
              Refresh status
            </button>
            <button className="btn ghost" onClick={finishOnboarding} disabled={busy}>
              Continue to dashboard
            </button>
          </div>

          <p className="heroMicro" style={{ marginTop: 10 }}>
            You can keep working without Stripe connected, but payout features stay locked until setup is complete.
          </p>
        </section>
      </main>
    </div>
  );
}
