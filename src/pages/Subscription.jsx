import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import AppShell from "../components/layout/AppShell";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import { supabase } from "../lib/supabase";
import { normalizePlanKey } from "../lib/format";
import { createStudioBillingSession, syncStudioSubscription } from "../lib/studioBilling";
import {
  DEFAULT_PRICES,
  formatMoneyFromStripe,
  formatTerm,
  mergeLivePrices,
} from "../lib/pricing";

const PLAN_CARDS = [
  {
    key: "free",
    tier: null,
    title: "Free 7-Day",
    priceKey: "free_monthly",
    billingCycle: "trial",
    description: "Start fast with a free 7-day trial and core booking workflow.",
    bullets: [
      "7-day free trial",
      "Professional booking link",
      "Core scheduling and booking workflow",
      "Stripe-secured payment setup",
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
    key: "studio",
    tier: "studio_monthly",
    title: "Studio",
    priceKey: null,
    billingCycle: "monthly",
    description: "Shared team workspace and owner-managed billing for multi-account studios.",
    bullets: [
      "Everything in Pro",
      "3 included accounts",
      "Shared chairs, rooms, and resources",
      "Owner-managed seat billing and payout reporting",
    ],
  },
];

export default function Subscription() {
  const nav = useNavigate();
  const location = useLocation();

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [reloadNonce, setReloadNonce] = useState(0);
  const handledStudioResultRef = useRef("");

  const [user, setUser] = useState(null);
  const [subStatus, setSubStatus] = useState(null);
  const [plan, setPlan] = useState(null);
  const [interval, setInterval] = useState(null);
  const [currentPeriodEnd, setCurrentPeriodEnd] = useState(null);

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
  }, [nav, reloadNonce]);

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

  const currentPlanKey = useMemo(() => {
    const fromDb = normalizePlanKey(plan);
    if (fromDb === "studio") return "studio";
    if (fromDb === "pro" || fromDb === "starter" || fromDb === "founder" || fromDb === "elite") return "pro";
    if (fromDb === "free") return "free";

    const fromMeta = normalizePlanKey(user?.user_metadata?.selected_plan);
    if (fromMeta === "studio") return "studio";
    if (fromMeta === "pro" || fromMeta === "starter" || fromMeta === "founder" || fromMeta === "elite") return "pro";
    if (fromMeta === "free") return "free";

    if (isActive && interval === "annual") return "pro";
    if (!isActive) return "free";
    return "pro";
  }, [plan, user, isActive, interval]);

  const planLabel = useMemo(() => {
    if (currentPlanKey === "free") return "Free 7-Day";
    if (currentPlanKey === "studio") return "Studio";
    if (currentPlanKey === "pro") return "Pro";
    return "Free 7-Day";
  }, [currentPlanKey]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const studioResult = params.get("studio");
    if (!studioResult) return;

    const sessionId = params.get("session_id") || "";
    const marker = `${studioResult}:${sessionId}`;
    if (handledStudioResultRef.current === marker) return;
    handledStudioResultRef.current = marker;

    const nextParams = new URLSearchParams(location.search);
    nextParams.delete("studio");
    nextParams.delete("session_id");
    const nextSearch = nextParams.toString();
    nav(`${location.pathname}${nextSearch ? `?${nextSearch}` : ""}`, { replace: true });

    if (studioResult === "cancel") {
      setMsg("Studio checkout canceled.");
      return;
    }

    if (studioResult !== "success") return;

    setMsg("Studio checkout received. Syncing your access...");
    setErr("");

    void (async () => {
      try {
        await syncStudioSubscription(sessionId || null);
        setMsg("Studio is active on this account.");
        setReloadNonce((value) => value + 1);
      } catch (syncError) {
        console.error("[Subscription] studio sync failed:", syncError);
        setErr(syncError?.message || "Studio checkout completed, but we could not sync access yet.");
      }
    })();
  }, [location.pathname, location.search, nav]);

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

  async function startStudioCheckout() {
    if (busy) return;
    setBusy(true);
    setMsg("");
    setErr("");

    try {
      const billingSession = await createStudioBillingSession({
        intent: "checkout",
        returnPath: "/app/subscription",
        successPath: "/app/subscription?studio=success&session_id={CHECKOUT_SESSION_ID}",
        cancelPath: "/app/subscription?studio=cancel",
      });
      window.location.assign(billingSession.url);
    } catch (checkoutError) {
      console.error("[Subscription] studio checkout failed:", checkoutError);
      setErr(checkoutError?.message || "Studio checkout failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  function planActionLabel(card) {
    if (card.key === currentPlanKey) return "Current plan";
    if (card.key === "free") return "Downgrade in billing";
    if (card.key === "studio") return currentPlanKey === "pro" ? "Upgrade to Studio" : "Choose plan";
    if (!isActive || currentPlanKey === "free") return "Choose plan";
    return "Change plan";
  }

  function handlePlanAction(card) {
    if (card.key === currentPlanKey) return;
    if (card.key === "studio") {
      startStudioCheckout();
      return;
    }
    if (card.key === "free") {
      openBillingPortal();
      return;
    }
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
      <div className="sub-page g-page">
        <div className="sub-hero">
          <div>
            <h1 className="g-h1">Subscription</h1>
            <div className="u-muted sub-heroCopy">
              Pick the plan that fits your workflow. Upgrade or downgrade anytime.
            </div>
          </div>
          <div className="sub-current">
            <span className="sub-currentLabel">Current plan</span>
            <strong>{planLabel}</strong>
            {currentPeriodEnd ? (
              <span className="u-muted">Renews on {new Date(currentPeriodEnd).toLocaleDateString()}</span>
            ) : (
              <span className="u-muted">Active plan status</span>
            )}
          </div>
        </div>

        <div className="sub-actions">
          <Button variant="outline" onClick={openBillingPortal} disabled={busy}>
            {busy ? "Opening…" : "Manage subscription"}
          </Button>
          <Button variant="outline" onClick={() => nav("/pricing#plans")}>
            View public pricing
          </Button>
        </div>

        {msg ? <div className="u-muted sub-alert">{msg}</div> : null}
        {err ? <div className="u-muted sub-alert">{err}</div> : null}
        {pricesErr ? <div className="u-muted sub-alert">{pricesErr}</div> : null}

        <div className="sub-grid">
          {PLAN_CARDS.map((card) => {
            const isCurrent = card.key === currentPlanKey;
            const isFeatured = card.key === "pro";
            const priceObj = card.priceKey ? prices?.[card.priceKey] || null : null;
            const priceLabel =
              card.key === "free"
                ? "$0"
                : card.key === "studio"
                  ? "$39.99"
                  : formatMoneyFromStripe(priceObj, "monthly") || "$19.99";
            const termLabel =
              card.key === "free"
                ? "/7 days"
                : card.key === "studio"
                  ? "/month"
                  : formatTerm(priceObj, "monthly") || "/month";
            return (
              <Card
                key={card.key}
                className={`sub-card${isFeatured ? " sub-cardFeatured" : ""}${isCurrent ? " sub-cardCurrent" : ""}`}
              >
                <div className="sub-cardHeader">
                  <div>
                    <div className="sub-cardTitle">{card.title}</div>
                    <div className="sub-desc">{card.description}</div>
                  </div>
                  <div className="sub-badges">
                    {isFeatured ? <span className="sub-badge sub-badgeFeatured">Most popular</span> : null}
                    {isCurrent ? <span className="sub-badge sub-badgeCurrent">Current</span> : null}
                  </div>
                </div>

                <div className="sub-priceRow">
                  <div className="sub-price">
                    {priceLabel}
                    <span className="sub-term">{termLabel}</span>
                  </div>
                </div>

                <ul className="sub-list">
                  {card.bullets.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>

                <div className="sub-ctaRow">
                  <Button
                    variant={isCurrent ? "outline" : "primary"}
                    onClick={() => handlePlanAction(card)}
                    disabled={busy || isCurrent || (card.key === "pro" && pricesLoading)}
                  >
                    {planActionLabel(card)}
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>

        <Card className="sub-faqCard">
          <div className="sub-faqTitle">FAQ</div>
          <div className="sub-faqItem">
            <div className="sub-faqQ">Can I downgrade or upgrade anytime?</div>
            <div className="sub-faqA">Yes. You can change plans in the billing portal and your new plan applies immediately.</div>
          </div>
          <div className="sub-faqItem">
            <div className="sub-faqQ">How does Free 7-Day work?</div>
            <div className="sub-faqA">Your account starts on Free 7-Day, then you can move to Pro at $19.99/month when ready.</div>
          </div>
          <div className="sub-faqItem">
            <div className="sub-faqQ">What happens if I cancel?</div>
            <div className="sub-faqA">You keep access until the end of your billing period. You can always re‑subscribe later.</div>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
