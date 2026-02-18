import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Button from "../ui/Button";
import Card from "../ui/Card";
import FullScreenLoader from "../ui/FullScreenLoader";
import { supabase } from "../../lib/supabase";

function useQuery() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

export default function PaywallBanner() {
  const navigate = useNavigate();
  const query = useQuery();

  const [loadingPlans, setLoadingPlans] = useState(true);
  const [plans, setPlans] = useState(null);
  const [err, setErr] = useState("");
  const [busyPlan, setBusyPlan] = useState(null);

  const [finalizing, setFinalizing] = useState(false);
  const [finalizeMsg, setFinalizeMsg] = useState("Finalizing your subscription…");

  const isSuccessReturn = query.get("success") === "1";
  const isCanceledReturn = query.get("canceled") === "1";

  // 1) Load plan catalog (server-authoritative)
  useEffect(() => {
    let mounted = true;

    async function loadPlans() {
      setLoadingPlans(true);
      setErr("");

      try {
        const { data, error } = await supabase.functions.invoke("get-prices", {
          body: {},
        });

        if (error) throw error;
        if (!data?.plans) throw new Error("No plan catalog returned.");

        // Expect shape:
        // data.plans = [{ key, name, amount, interval, features[], highlight, cta }]
        if (mounted) setPlans(data.plans);
      } catch (e) {
        if (mounted) setErr(e?.message || "Failed to load plans.");
      } finally {
        if (mounted) setLoadingPlans(false);
      }
    }

    loadPlans();
    return () => {
      mounted = false;
    };
  }, []);

  // 2) If we returned from Stripe success, poll DB until webhook updates pro_subscriptions
  useEffect(() => {
    if (!isSuccessReturn) return;

    let mounted = true;
    let timer = null;

    async function poll() {
      setFinalizing(true);
      setFinalizeMsg("Finalizing your subscription…");

      const { data: userRes } = await supabase.auth.getUser();
      const user = userRes?.user;
      if (!user) {
        setFinalizeMsg("Please sign in again to finish setup.");
        return;
      }

      const start = Date.now();
      const maxMs = 60_000; // 60s
      const intervalMs = 2000;

      async function checkOnce() {
        const { data, error } = await supabase
          .from("pro_subscriptions")
          .select("status, current_period_end, updated_at")
          .eq("user_id", user.id)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!mounted) return;

        const isActive = !error && data?.status === "active";
        const hasValidPeriod =
          !data?.current_period_end ||
          new Date(data.current_period_end).getTime() > Date.now();

        if (isActive && hasValidPeriod) {
          // clean the query params (optional)
          navigate("/app/onboarding", { replace: true });
          return;
        }

        if (Date.now() - start > maxMs) {
          setFinalizeMsg(
            "Still syncing your subscription. If this doesn’t update in a minute, refresh."
          );
          return;
        }

        timer = setTimeout(checkOnce, intervalMs);
      }

      await checkOnce();
    }

    poll();

    return () => {
      mounted = false;
      if (timer) clearTimeout(timer);
    };
  }, [isSuccessReturn, navigate]);

  // 3) Start checkout (server creates session + validates)
  async function startCheckout(planKey) {
    setErr("");
    setBusyPlan(planKey);

    try {
      const { data: userRes } = await supabase.auth.getUser();
      const user = userRes?.user;
      if (!user) {
        navigate("/login");
        return;
      }

      const { data, error } = await supabase.functions.invoke(
        "create-checkout-session",
        {
          body: {
            planKey, // IMPORTANT: server validates this
            // Where to send user back
            returnPath: "/paywall",
          },
        }
      );

      if (error) throw error;
      if (!data?.url) throw new Error("No checkout URL returned.");

      window.location.href = data.url;
    } catch (e) {
      setErr(e?.message || "Checkout failed. Please try again.");
    } finally {
      setBusyPlan(null);
    }
  }

  if (finalizing) {
    return (
      <Card className="lpPriceCard" style={{ marginBottom: 18 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div className="lpTier">Almost there</div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{finalizeMsg}</div>
          <div style={{ opacity: 0.8 }}>
            Don’t close this tab — we’re confirming with Stripe.
          </div>
        </div>
      </Card>
    );
  }

  if (loadingPlans) return <FullScreenLoader />;

  return (
    <Card className="lpPriceCard" style={{ marginBottom: 18 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div className="lpTier">Access locked</div>

        <div style={{ fontSize: 22, fontWeight: 800 }}>
          Subscribe to unlock onboarding
        </div>

        <div style={{ opacity: 0.85 }}>
          You’ll choose your services, location, and booking settings right after subscribing.
        </div>

        {isCanceledReturn && (
          <div style={{ opacity: 0.9 }}>
            Checkout canceled — you can pick a plan anytime.
          </div>
        )}

        {err ? (
          <div style={{ opacity: 0.9 }}>
            <strong>Problem:</strong> {err}
          </div>
        ) : null}

        {/* Compact plan buttons (production: driven by server plan catalog) */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 12,
            marginTop: 8,
          }}
        >
          {plans?.map((p) => (
            <Card
              key={p.key}
              className={`lpPriceCard ${p.highlight ? "lpFeatured" : ""}`}
              style={{ padding: 14 }}
            >
              <div style={{ fontWeight: 800 }}>{p.name}</div>
              <div style={{ opacity: 0.85, marginTop: 4 }}>
                <span style={{ fontSize: 20, fontWeight: 900 }}>
                  {p.amountFormatted}
                </span>{" "}
                <span style={{ opacity: 0.75 }}>
                  /{p.interval}
                </span>
              </div>

              <ul className="lpList" style={{ marginTop: 10 }}>
                {(p.features || []).slice(0, 4).map((f, i) => (
                  <li key={i}>✓ {f}</li>
                ))}
              </ul>

              <Button
                variant="outline"
                className="lpChoose"
                style={{ width: "100%", marginTop: 10 }}
                onClick={() => startCheckout(p.key)}
                disabled={busyPlan && busyPlan !== p.key}
              >
                {busyPlan === p.key ? "Starting checkout…" : p.cta || "Choose"}
              </Button>
            </Card>
          ))}
        </div>
      </div>
    </Card>
  );
}