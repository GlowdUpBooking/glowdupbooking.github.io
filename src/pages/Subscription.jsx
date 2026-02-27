import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppShell from "../components/layout/AppShell";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import { supabase } from "../lib/supabase";
import { normalizePlanKey } from "../lib/format";
import {
  DEFAULT_PRICES,
  mergeLivePrices,
  formatMoneyFromStripe,
  formatTerm,
} from "../lib/pricing";

const PLAN_CARDS = [
  {
    key: "starter",
    tier: "starter_monthly",
    title: "Starter",
    priceKey: "starter_monthly",
    billingCycle: "monthly",
    description: "Great for getting started with unlimited services and bookings.",
    bullets: [
      "Unlimited services",
      "Unlimited accepted bookings",
      "Deposits (fixed amount)",
      "Service photos",
    ],
  },
  {
    key: "pro",
    tier: "pro_monthly",
    title: "Pro",
    priceKey: "pro_monthly",
    billingCycle: "monthly",
    description: "Advanced tools for growth and premium client experience.",
    bullets: [
      "Advanced deposits + optional prepay",
      "Advanced availability rules",
      "Portfolio/gallery polish",
      "Priority support",
    ],
  },
  {
    key: "founder",
    tier: "founder_annual",
    title: "Founder",
    priceKey: "founder_annual",
    billingCycle: "annual",
    description: "First 500 pros only. Lock in Pro features at a founding price.",
    bullets: [
      "Everything in Pro",
      "Founder pricing locked while active",
      "Founder badge + early access",
      "Best long-term value",
    ],
  },
];

export default function Subscription() {
  const nav = useNavigate();

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const [user, setUser] = useState(null);
  const [subStatus, setSubStatus] = useState(null);
  const [plan, setPlan] = useState(null);
  const [interval, setInterval] = useState(null);
  const [currentPeriodEnd, setCurrentPeriodEnd] = useState(null);

  const [maxSpots, setMaxSpots] = useState(500);
  const [claimed, setClaimed] = useState(0);
  const [pricesLoading, setPricesLoading] = useState(true);
  const [pricesErr, setPricesErr] = useState("");
  const [prices, setPrices] = useState(DEFAULT_PRICES);

  const isActive = subStatus === "active";

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
          .select("status, interval, plan, current_period_end")
          .eq("user_id", u.id)
          .maybeSingle();
        if (subErr) console.error("[Subscription] pro_subscriptions error:", subErr);
        if (!mounted) return;
        setSubStatus(subRow?.status ?? null);
        setPlan(subRow?.plan ?? null);
        setInterval(subRow?.interval ?? null);
        setCurrentPeriodEnd(subRow?.current_period_end ?? null);

        const { data: offer, error: offerErr } = await supabase
          .from("founding_offer")
          .select("max_spots, claimed_spots")
          .eq("id", 1)
          .maybeSingle();
        if (!offerErr && offer) {
          setMaxSpots(typeof offer.max_spots === "number" ? offer.max_spots : 500);
          setClaimed(typeof offer.claimed_spots === "number" ? offer.claimed_spots : 0);
        }
      } catch (e) {
        console.error("[Subscription] load error:", e);
        if (mounted) setErr("Couldn’t load subscription details.");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, [nav]);

  useEffect(() => {
    let mounted = true;

    async function loadPrices() {
      setPricesLoading(true);
      setPricesErr("");
      try {
        const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";
        const sbUrl = import.meta.env.VITE_SUPABASE_URL || "";
        if (!anonKey || !sbUrl) {
          throw new Error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY.");
        }

        const invokeRes = await supabase.functions.invoke("get-prices", {
          headers: {
            apikey: anonKey,
            Authorization: `Bearer ${anonKey}`,
            "Content-Type": "application/json",
          },
        });

        if (!invokeRes.error && invokeRes.data?.prices) {
          if (!mounted) return;
          setPrices(mergeLivePrices(invokeRes.data.prices));
          return;
        }

        const fnUrl = `${sbUrl}/functions/v1/get-prices`;
        const res = await fetch(fnUrl, {
          method: "GET",
          headers: {
            apikey: anonKey,
            Authorization: `Bearer ${anonKey}`,
          },
        });

        const text = await res.text();
        let json;
        try {
          json = JSON.parse(text);
        } catch {
          json = { raw: text };
        }

        if (!res.ok) {
          throw new Error(json?.error || json?.message || "Could not load live prices.");
        }

        if (json?.prices) {
          if (!mounted) return;
          setPrices(mergeLivePrices(json.prices));
          return;
        }

        throw new Error("Live pricing is unavailable.");
      } catch (e) {
        if (!mounted) return;
        setPricesErr(e?.message || "Live pricing unavailable.");
      } finally {
        if (mounted) setPricesLoading(false);
      }
    }

    loadPrices();
    return () => {
      mounted = false;
    };
  }, []);

  const remaining = useMemo(() => Math.max(0, Number(maxSpots || 0) - Number(claimed || 0)), [maxSpots, claimed]);

  const currentPlanKey = useMemo(() => {
    const fromDb = normalizePlanKey(plan);
    if (fromDb) return fromDb;

    const fromMeta = normalizePlanKey(user?.user_metadata?.selected_plan);
    if (fromMeta) return fromMeta;

    if (isActive && interval === "annual") return "founder";
    if (!isActive) return "free";
    return "paid";
  }, [plan, user, isActive, interval]);

  const planLabel = useMemo(() => {
    if (currentPlanKey === "free") return "Free";
    if (currentPlanKey === "starter") return "Starter";
    if (currentPlanKey === "pro") return "Pro";
    if (currentPlanKey === "founder") return "Founder";
    if (currentPlanKey === "elite") return "Elite";
    if (currentPlanKey === "paid") return "Paid";
    return "Free";
  }, [currentPlanKey]);

  const showFounder = remaining > 0 || currentPlanKey === "founder";

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  async function openBillingPortal() {
    if (busy) return;

    const likelyFreePlan = currentPlanKey === "free" || !isActive;
    if (likelyFreePlan) {
      nav("/pricing?billing=setup&focus=plans");
      return;
    }

    setBusy(true);
    setMsg("");
    setErr("");

    try {
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";
      const sbUrl = import.meta.env.VITE_SUPABASE_URL || "";

      if (!anonKey || !sbUrl) {
        throw new Error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY.");
      }

      const { data: authData, error: sessErr } = await supabase.auth.getSession();
      if (sessErr) throw sessErr;

      const s = authData?.session;
      if (!s?.access_token) {
        const next = encodeURIComponent(`${window.location.pathname}${window.location.search}`);
        nav(`/login?next=${next}`, { replace: true });
        return;
      }

      const { data, error } = await supabase.functions.invoke("create-billing-portal-session", {
        body: { return_path: "/app/subscription" },
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${s.access_token}`,
          "Content-Type": "application/json",
        },
      });

      if (!error && data?.url) {
        window.location.assign(data.url);
        return;
      }

      const fnUrl = `${sbUrl}/functions/v1/create-billing-portal-session`;
      const res = await fetch(fnUrl, {
        method: "POST",
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${s.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ return_path: "/app/subscription" }),
      });

      const text = await res.text();
      let json;
      try {
        json = JSON.parse(text);
      } catch {
        json = { raw: text };
      }

      if (!res.ok) {
        const code = json?.error || json?.code || "";
        if (code === "no_stripe_customer") {
          nav("/pricing?billing=setup&focus=plans");
          return;
        }
        throw new Error(json?.message || json?.error || `Edge Function failed (${res.status})`);
      }

      if (!json?.url) throw new Error("No billing portal URL returned.");
      window.location.assign(json.url);
    } catch (e) {
      console.error("[Subscription] openBillingPortal failed:", e);
      setErr("Couldn’t open billing right now. You can manage plans from Pricing.");
    } finally {
      setBusy(false);
    }
  }

  async function startCheckout(tier) {
    if (busy) return;
    setBusy(true);
    setMsg("");
    setErr("");

    try {
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";
      const sbUrl = import.meta.env.VITE_SUPABASE_URL || "";

      if (!anonKey || !sbUrl) {
        throw new Error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in your web env.");
      }

      const { data: authData, error: sessErr } = await supabase.auth.getSession();
      if (sessErr) throw sessErr;

      const s = authData?.session;
      if (!s?.access_token) {
        nav("/login", { replace: true });
        return;
      }

      const { data, error } = await supabase.functions.invoke("create-checkout-session", {
        body: { tier },
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${s.access_token}`,
          "Content-Type": "application/json",
        },
      });

      if (!error && data?.url) {
        window.location.assign(data.url);
        return;
      }

      const fnUrl = `${sbUrl}/functions/v1/create-checkout-session`;
      const res = await fetch(fnUrl, {
        method: "POST",
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${s.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ tier }),
      });

      const text = await res.text();
      let json;
      try {
        json = JSON.parse(text);
      } catch {
        json = { raw: text };
      }

      if (!res.ok) {
        throw new Error(`Edge Function failed (${res.status}). ${json?.error || json?.message || text}`);
      }
      if (!json?.url) throw new Error(`No checkout URL returned. Response: ${text}`);

      window.location.assign(json.url);
    } catch (e) {
      console.error("[Subscription] checkout failed:", e);
      setErr(`Checkout failed: ${e?.message || "Please try again."}`);
    } finally {
      setBusy(false);
    }
  }

  function handlePlanAction(card) {
    if (card.key === currentPlanKey) return;
    if (isActive) {
      openBillingPortal();
      return;
    }
    startCheckout(card.tier);
  }

  if (loading) {
    return (
      <AppShell title="Subscription" onSignOut={signOut}>
        <Card style={{ padding: 18 }}>
          <div style={{ fontWeight: 800, fontSize: 18 }}>Loading…</div>
          <div className="u-muted" style={{ marginTop: 6 }}>
            Please wait.
          </div>
        </Card>
      </AppShell>
    );
  }

  return (
    <AppShell title="Subscription" onSignOut={signOut}>
      <div className="g-page">
        <h1 className="g-h1">Subscription</h1>
        <div className="u-muted" style={{ marginTop: 4 }}>
          Current plan: <strong>{planLabel}</strong>
          {currentPeriodEnd ? ` · Renews on ${new Date(currentPeriodEnd).toLocaleDateString()}` : ""}
        </div>

        <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Button variant="outline" onClick={openBillingPortal} disabled={busy}>
            {busy ? "Opening…" : "Manage subscription"}
          </Button>
          <Button variant="outline" onClick={() => nav("/pricing#plans")}>
            View public pricing
          </Button>
        </div>

        {msg ? <div className="u-muted" style={{ marginTop: 10 }}>{msg}</div> : null}
        {err ? <div className="u-muted" style={{ marginTop: 10 }}>{err}</div> : null}
        {pricesErr ? <div className="u-muted" style={{ marginTop: 10 }}>{pricesErr}</div> : null}

        <div style={{ marginTop: 18, display: "grid", gap: 14 }}>
          {PLAN_CARDS.filter((c) => (c.key === "founder" ? showFounder : true)).map((card) => {
            const isCurrent = card.key === currentPlanKey;
            const showRemaining = card.key === "founder" && remaining > 0 && currentPlanKey !== "founder";
            const priceObj = prices?.[card.priceKey] || null;
            const priceLabel = pricesLoading ? "$--" : formatMoneyFromStripe(priceObj, card.billingCycle) || card.priceKey;
            const termLabel = pricesLoading ? "" : formatTerm(priceObj, card.billingCycle) || "";
            return (
              <Card key={card.key} style={{ padding: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 18 }}>{card.title}</div>
                    <div className="u-muted">{card.description}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 20, fontWeight: 800 }}>
                      {priceLabel}
                      <span className="u-muted" style={{ fontSize: 14, marginLeft: 6 }}>{termLabel}</span>
                    </div>
                    {isCurrent ? (
                      <div className="u-muted" style={{ fontSize: 12, marginTop: 4 }}>Current plan</div>
                    ) : null}
                  </div>
                </div>

                {showRemaining ? (
                  <div className="u-muted" style={{ marginTop: 8 }}>
                    {remaining} Founder spots left
                  </div>
                ) : null}

                <ul style={{ marginTop: 10, paddingLeft: 18 }}>
                  {card.bullets.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>

                <div style={{ marginTop: 12 }}>
                  <Button
                    variant={isCurrent ? "outline" : "primary"}
                    onClick={() => handlePlanAction(card)}
                    disabled={busy || isCurrent}
                  >
                    {isCurrent ? "Current plan" : isActive ? "Change plan" : "Choose plan"}
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}
