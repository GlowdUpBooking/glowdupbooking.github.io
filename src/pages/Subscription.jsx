import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import AppShell from "../components/layout/AppShell";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import { supabase } from "../lib/supabase";
import { fetchEffectiveBillingAccess } from "../lib/billingAccess";
import { isStudioWebBillingRestricted } from "../lib/siteFlags";
import { createStudioBillingSession, syncStudioSubscription } from "../lib/studioBilling";
import {
  DEFAULT_PRICES,
  formatMoneyFromStripe,
  formatTerm,
  mergeLivePrices,
} from "../lib/pricing";

const STUDIO_INCLUDED_ACCOUNTS = 3;
const STUDIO_MAX_ACCOUNTS = 10;
const STUDIO_EXTRA_ACCOUNT_MONTHLY_PRICE = "$9.99";

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
      `${STUDIO_INCLUDED_ACCOUNTS} included accounts`,
      "Shared chairs, rooms, and resources",
      "Owner-managed seat billing and payout reporting",
    ],
  },
];

export default function Subscription() {
  const nav = useNavigate();
  const location = useLocation();
  const studioBillingRestricted = isStudioWebBillingRestricted();
  const visiblePlanCards = studioBillingRestricted
    ? PLAN_CARDS.filter((card) => card.key !== "studio")
    : PLAN_CARDS;

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [reloadNonce, setReloadNonce] = useState(0);
  const handledStudioResultRef = useRef("");

  const [billingAccess, setBillingAccess] = useState(null);

  const [pricesLoading, setPricesLoading] = useState(true);
  const [pricesErr, setPricesErr] = useState("");
  const [prices, setPrices] = useState(DEFAULT_PRICES);

  const isActive = Boolean(billingAccess?.hasActiveAccess);
  const currentPeriodEnd = billingAccess?.currentPeriodEnd ?? null;

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      setErr("");

      try {
        const { data: userRes, error: userErr } = await supabase.auth.getUser();
        if (userErr) throw userErr;
        const u = userRes?.user ?? null;

        if (!u) {
          nav("/login", { replace: true });
          return;
        }

        if (!mounted) return;

        const access = await fetchEffectiveBillingAccess(u.id);
        if (access.warnings.subscription) {
          console.error("[Subscription] pro_subscriptions error:", access.warnings.subscription);
        }
        if (access.warnings.profile) {
          console.error("[Subscription] billing profile error:", access.warnings.profile);
        }
        if (access.warnings.studioAccess) {
          console.warn("[Subscription] studio access warning:", access.warnings.studioAccess);
        }
        if (!mounted) return;
        setBillingAccess(access);
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

  const currentPlanKey = useMemo(() => billingAccess?.planKey ?? "free", [billingAccess]);

  const planLabel = useMemo(() => {
    if (currentPlanKey === "free") return "Free 7-Day";
    if (currentPlanKey === "studio") return "Studio";
    if (currentPlanKey === "pro") return "Pro";
    return "Free 7-Day";
  }, [currentPlanKey]);

  const manageBillingLabel = useMemo(() => {
    if (!isActive || currentPlanKey === "free") return "Manage subscription";
    if (billingAccess?.studioMemberCovered) return "Open Studio workspace";
    if (!billingAccess?.canManageWebBilling) return "Billing managed elsewhere";
    return "Manage subscription";
  }, [billingAccess, currentPlanKey, isActive]);

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

    if (billingAccess?.studioMemberCovered) {
      nav("/app/studio");
      return;
    }

    if (!billingAccess?.canManageWebBilling) {
      setErr("This plan is already active on your account. Billing is managed outside the web billing portal.");
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

      try {
        const invokePayload = error?.context ? await error.context.json() : null;
        if (invokePayload?.error === "no_stripe_customer") {
          setErr("This plan is already active on your account. Billing is managed outside the web billing portal.");
          return;
        }
      } catch {
        // Continue to explicit fetch fallback
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
          setErr("This plan is already active on your account. Billing is managed outside the web billing portal.");
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
    if (studioBillingRestricted) {
      setErr("Studio checkout is not available from this device. Use the desktop web app.");
      return;
    }

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
    if (billingAccess?.studioMemberCovered) return "Owner manages billing";
    if (card.key === "free") {
      return billingAccess?.canManageWebBilling ? "Downgrade in billing" : "Managed elsewhere";
    }
    if (card.key === "studio") {
      if (!billingAccess?.canManageWebBilling && isActive) return "Managed elsewhere";
      return currentPlanKey === "pro" ? "Upgrade to Studio" : "Choose plan";
    }
    if (!isActive || currentPlanKey === "free") return "Choose plan";
    if (!billingAccess?.canManageWebBilling) return "Managed elsewhere";
    return "Change plan";
  }

  function planActionDisabled(card) {
    if (busy || card.key === currentPlanKey) return true;
    if (card.key === "pro" && pricesLoading) return true;
    if (isActive && !billingAccess?.canManageWebBilling) return true;
    return false;
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
            ) : billingAccess?.studioMemberCovered ? (
              <span className="u-muted">Studio owner manages this seat.</span>
            ) : isActive && !billingAccess?.canManageWebBilling ? (
              <span className="u-muted">Billing is active on this account outside the web portal.</span>
            ) : (
              <span className="u-muted">Active plan status</span>
            )}
          </div>
        </div>

        <div className="sub-actions">
          <Button variant="outline" onClick={openBillingPortal} disabled={busy}>
            {busy ? "Opening…" : manageBillingLabel}
          </Button>
          <Button variant="outline" onClick={() => nav("/pricing#plans")}>
            View public pricing
          </Button>
        </div>

        {msg ? <div className="u-muted sub-alert">{msg}</div> : null}
        {err ? <div className="u-muted sub-alert">{err}</div> : null}
        {pricesErr ? <div className="u-muted sub-alert">{pricesErr}</div> : null}

        <div className="sub-grid">
          {visiblePlanCards.map((card) => {
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

                {card.key === "studio" ? (
                  <div className="sub-seatNote">
                    <div className="sub-seatNoteTitle">How extra accounts work</div>
                    <div className="sub-seatNoteCopy">
                      Add teammates from Studio Team after upgrading. The first {STUDIO_INCLUDED_ACCOUNTS} active
                      accounts are included, and accounts {STUDIO_INCLUDED_ACCOUNTS + 1}-{STUDIO_MAX_ACCOUNTS} add{" "}
                      {STUDIO_EXTRA_ACCOUNT_MONTHLY_PRICE}/month each.
                    </div>
                    <Button variant="outline" onClick={() => nav("/app/studio")}>
                      Open Studio Team
                    </Button>
                  </div>
                ) : null}

                <div className="sub-ctaRow">
                  <Button
                    variant={isCurrent ? "outline" : "primary"}
                    onClick={() => handlePlanAction(card)}
                    disabled={planActionDisabled(card)}
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
            <div className="sub-faqQ">How do I add extra Studio accounts?</div>
            <div className="sub-faqA">
              Add teammates from Studio Team. The first {STUDIO_INCLUDED_ACCOUNTS} active accounts are included, and
              accounts {STUDIO_INCLUDED_ACCOUNTS + 1}-{STUDIO_MAX_ACCOUNTS} add {STUDIO_EXTRA_ACCOUNT_MONTHLY_PRICE}
              /month each.
            </div>
          </div>
          <div className="sub-faqItem">
            <div className="sub-faqQ">What happens if I cancel?</div>
            <div className="sub-faqA">You keep access until the end of your billing period. You can always re-subscribe later.</div>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
