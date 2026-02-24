import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import { trackEvent } from "../lib/analytics";
import { getSignupPath } from "../lib/siteFlags";

const WHY_PROS = [
  "Keep more of what you earn with clear, transparent pricing",
  "Reduce no-shows with deposits and optional prepay",
  "Get paid faster with reliable payout options",
  "Build your brand with a premium booking experience",
  "Grow with tools designed for independent pros",
];

const FAQ_ITEMS = [
  { q: "Do clients pay to book?", a: "No. Booking is free for clients." },
  { q: "When does the Free plan booking limit reset?", a: "On the 1st of every month." },
  { q: "How do deposits and payments work?", a: "Deposits and payments are processed through Stripe when enabled." },
  { q: "Can I change plans later?", a: "Yes. Upgrade or downgrade anytime." },
  { q: "What is instant payout?", a: "An optional payout method with an additional fee for immediate access to funds." },
];

const DEFAULT_PRICES = Object.freeze({
  free_monthly: { id: "free", unit_amount: 0, currency: "USD", interval: "month", interval_count: 1, product_name: "Free" },
  starter_monthly: { id: "starter_default", unit_amount: 999, currency: "USD", interval: "month", interval_count: 1, product_name: "Starter" },
  pro_monthly: { id: "pro_default", unit_amount: 1999, currency: "USD", interval: "month", interval_count: 1, product_name: "Pro" },
  elite_monthly: { id: "elite_default", unit_amount: 2999, currency: "USD", interval: "month", interval_count: 1, product_name: "Elite" },
  founder_annual: { id: "founder_default", unit_amount: 9900, currency: "USD", interval: "year", interval_count: 1, product_name: "Founder" },
});

function toCents(priceObj) {
  if (typeof priceObj?.unit_amount === "number" && Number.isFinite(priceObj.unit_amount)) return priceObj.unit_amount;
  if (typeof priceObj?.unit_amount === "string" && priceObj.unit_amount.trim().length) {
    const n = Number(priceObj.unit_amount);
    if (Number.isFinite(n)) return n;
  }
  if (typeof priceObj?.unit_amount_decimal === "string" && priceObj.unit_amount_decimal.trim().length) {
    const n = Number(priceObj.unit_amount_decimal);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function mergeLivePrices(livePrices) {
  const pick = (key) => {
    const fallback = DEFAULT_PRICES[key];
    const candidate = livePrices?.[key];
    const unitAmount = toCents(candidate);

    if (!candidate || typeof candidate !== "object" || unitAmount === null) {
      return fallback;
    }

    return {
      ...fallback,
      ...candidate,
      unit_amount: unitAmount,
      currency: typeof candidate.currency === "string" && candidate.currency ? candidate.currency : fallback.currency,
    };
  };

  return {
    free_monthly: DEFAULT_PRICES.free_monthly,
    starter_monthly: pick("starter_monthly"),
    pro_monthly: pick("pro_monthly"),
    elite_monthly: pick("elite_monthly"),
    founder_annual: pick("founder_annual"),
  };
}

function formatMoneyFromStripe(priceObj, billingCycle = "monthly") {
  const cents = toCents(priceObj);
  const currency = priceObj?.currency || "USD";
  if (cents === null) return null;

  let amount = cents / 100;
  if (billingCycle === "annual" && priceObj?.interval === "month") {
    amount = amount * 12 * 0.85;
  }

  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
    }).format(amount);
  } catch {
    return `$${amount}`;
  }
}

function formatTerm(priceObj, billingCycle = "monthly") {
  if (!priceObj) return null;
  if (billingCycle === "annual" && priceObj?.interval === "month") return "/year";

  const i = priceObj?.interval;
  const c = priceObj?.interval_count || 1;
  if (!i) return null;
  if (i === "month") return c === 1 ? "/month" : `/${c} months`;
  if (i === "year") return c === 1 ? "/year" : `/${c} years`;
  return null;
}

function relativeUpdate(ts) {
  if (!ts) return "Updated recently";
  const mins = Math.max(0, Math.floor((Date.now() - ts) / 60000));
  if (mins < 1) return "Updated just now";
  if (mins === 1) return "Updated 1 min ago";
  if (mins < 60) return `Updated ${mins} mins ago`;
  return "Updated today";
}

export default function Pricing() {
  const nav = useNavigate();
  const location = useLocation();
  const signupPath = getSignupPath();

  const [session, setSession] = useState(null);
  const [billingCycle, setBillingCycle] = useState("monthly");

  const [loading, setLoading] = useState(true);
  const [maxSpots, setMaxSpots] = useState(1000);
  const [claimed, setClaimed] = useState(0);
  const [updatedAt, setUpdatedAt] = useState(null);
  const [err, setErr] = useState("");

  const [sessionLoading, setSessionLoading] = useState(false);
  const [toast, setToast] = useState("");

  const [pricesLoading, setPricesLoading] = useState(true);
  const [pricesErr, setPricesErr] = useState("");
  const [prices, setPrices] = useState(DEFAULT_PRICES);

  const remaining = useMemo(() => {
    const max = typeof maxSpots === "number" ? maxSpots : 1000;
    const used = typeof claimed === "number" ? claimed : 0;
    return Math.max(0, max - used);
  }, [maxSpots, claimed]);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data?.session ?? null);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!mounted) return;
      setSession(newSession ?? null);
    });

    return () => {
      mounted = false;
      sub?.subscription?.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    async function loadFounderCounter() {
      setLoading(true);
      setErr("");

      try {
        const { data, error } = await supabase
          .from("founding_offer")
          .select("max_spots, claimed_spots")
          .eq("id", 1)
          .maybeSingle();

        if (error) throw error;

        const max = typeof data?.max_spots === "number" ? data.max_spots : 1000;
        const used = typeof data?.claimed_spots === "number" ? data.claimed_spots : 0;

        if (!mounted) return;
        setMaxSpots(max);
        setClaimed(used);
      } catch (e) {
        console.error("[FounderCounter] load failed:", e);

        if (!mounted) return;
        setMaxSpots(1000);
        setClaimed(0);
        setErr("Availability counter unavailable (still fine to sign up).");
      } finally {
        if (!mounted) return;
        setUpdatedAt(Date.now());
        setLoading(false);
      }
    }

    loadFounderCounter();
    return () => {
      mounted = false;
    };
  }, []);

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

        let payload = null;

        const invokeRes = await supabase.functions.invoke("get-prices", {
          headers: {
            apikey: anonKey,
            Authorization: `Bearer ${anonKey}`,
            "Content-Type": "application/json",
          },
        });

        if (!invokeRes.error && invokeRes.data?.prices) {
          payload = invokeRes.data;
        } else {
          const fnUrl = `${sbUrl}/functions/v1/get-prices`;
          const res = await fetch(fnUrl, {
            method: "POST",
            headers: {
              apikey: anonKey,
              Authorization: `Bearer ${anonKey}`,
              "Content-Type": "application/json",
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
            throw new Error(
              `get-prices failed (${res.status}): ${json?.error || json?.message || text}`
            );
          }
          payload = json;
        }

        const p = mergeLivePrices(payload?.prices ?? null);

        if (!mounted) return;
        setPrices(p);
      } catch (e) {
        console.error("[Pricing] get-prices failed:", e);
        if (!mounted) return;
        setPrices(DEFAULT_PRICES);
        setPricesErr("Live pricing sync is unavailable. Showing standard plan rates.");
      } finally {
        if (!mounted) return;
        setPricesLoading(false);
      }
    }

    loadPrices();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("checkout") === "success") setToast("Payment complete. Your access will update shortly.");
    if (params.get("checkout") === "cancel") setToast("Payment canceled. You can try again anytime.");

    const fromBillingSetup = params.get("billing") === "setup";
    const focusPlans = params.get("focus") === "plans" || location.hash === "#plans";

    if (fromBillingSetup) {
      setToast("You’re on Free. Choose a paid plan first, then billing management opens automatically.");
    }

    if (fromBillingSetup || focusPlans) {
      window.requestAnimationFrame(() => {
        document.getElementById("plans")?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  }, [location.search, location.hash]);

  async function signOut() {
    await supabase.auth.signOut();
    nav("/", { replace: true });
  }

  async function startCheckout(tier) {
    trackEvent("checkout_start", { page: "pricing", tier, billing_cycle: billingCycle });
    setToast("");
    setSessionLoading(true);

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
        trackEvent("checkout_requires_auth", { page: "pricing", tier });
        nav(signupPath, { replace: true });
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
        trackEvent("checkout_redirect", { page: "pricing", tier, source: "invoke" });
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

      trackEvent("checkout_redirect", { page: "pricing", tier, source: "fetch" });
      window.location.assign(json.url);
    } catch (e) {
      console.error(e);
      trackEvent("checkout_error", { page: "pricing", tier, message: e?.message || "unknown_error" });
      setToast(`Checkout failed: ${e?.message || "Please try again."}`);
      setSessionLoading(false);
    }
  }

  const starterPrice = prices ? formatMoneyFromStripe(prices.starter_monthly, billingCycle) : null;
  const proPrice = prices ? formatMoneyFromStripe(prices.pro_monthly, billingCycle) : null;
  const elitePrice = prices ? formatMoneyFromStripe(prices.elite_monthly, billingCycle) : null;
  const founderPrice = prices ? formatMoneyFromStripe(prices.founder_annual, "annual") : null;

  const starterTerm = prices ? formatTerm(prices.starter_monthly, billingCycle) : null;
  const proTerm = prices ? formatTerm(prices.pro_monthly, billingCycle) : null;
  const eliteTerm = prices ? formatTerm(prices.elite_monthly, billingCycle) : null;
  const founderTerm = prices ? formatTerm(prices.founder_annual, "annual") : null;

  const showFounderPlan = loading || remaining > 0;

  return (
    <div className="lp">
      <header className="lpNav">
        <div className="lpNavInner">
          <Link className="lpBrand" to="/">
            <img className="lpBrandLogo" src="/assets/logo.png" alt="Glow'd Up Booking logo" />
            <span className="lpBrandStrong">Glow’d Up</span>
            <span className="lpBrandLight"> Booking</span>
          </Link>

          <div className="lpNavRight">
            <button
              className="lpNavBtn lpNavBtnSecondary"
              onClick={() => {
                trackEvent("cta_click", { page: "pricing", cta: "pricing_nav_scroll" });
                document.getElementById("plans")?.scrollIntoView({ behavior: "smooth" });
              }}
            >
              Pricing
            </button>

            {!session ? (
              <>
                <Link className="lpNavBtn lpNavBtnSecondary" to="/login" onClick={() => trackEvent("nav_click", { page: "pricing", cta: "sign_in" })}>
                  Sign In
                </Link>
                <Link className="lpNavBtn" to={signupPath} onClick={() => trackEvent("cta_click", { page: "pricing", cta: "start_free_nav" })}>
                  Start Free <span className="lpArrow">→</span>
                </Link>
              </>
            ) : (
              <>
                <button className="lpNavBtn lpNavBtnSecondary" onClick={() => nav("/app")}>Dashboard</button>
                <button className="lpNavBtn" onClick={signOut}>Sign out <span className="lpArrow">→</span></button>
              </>
            )}
          </div>
        </div>
      </header>

      <section className="lpHero lpReveal">
        <div className="lpHeroStrip" aria-hidden="true">
          <div className="lpHeroImg lpHeroImg1" />
          <div className="lpHeroImg lpHeroImg2" />
          <div className="lpHeroImg lpHeroImg3" />
          <div className="lpHeroImg lpHeroImg4" />
        </div>

        <div className="lpHeroInner">
          <h1 className="lpH1">Simple pricing for beauty professionals.</h1>
          <p className="lpLead">Built for barbers, stylists, tattoo artists, nail techs, and more. Start free and scale with better tools.</p>
          <p className="lpLead">Clients book free. Pros pay only for tools and growth.</p>

          <div className="lpHeroBtns">
            <Link to={signupPath} onClick={() => trackEvent("cta_click", { page: "pricing", cta: "start_free_hero" })}>
              <Button variant="outline" className="lpBtn">Start Free</Button>
            </Link>
            <Button
              variant="outline"
              className="lpBtn"
              onClick={() => {
                trackEvent("cta_click", { page: "pricing", cta: "view_plans_hero" });
                document.getElementById("plans")?.scrollIntoView({ behavior: "smooth" });
              }}
            >
              View Plans
            </Button>
          </div>

          <div className="lpTrustRow">
            <span>No booking fees</span>
            <span>Stripe-secured payments</span>
            <span>Cancel anytime</span>
          </div>

          <div className={`lpLiveChip ${loading ? "is-loading" : ""}`}>
            {loading ? "Loading founder availability..." : showFounderPlan ? `${remaining} Founder spots left` : "Founder spots filled · Elite unlocked"} · {relativeUpdate(updatedAt)}
          </div>

          {toast ? <div className="lpToast">{toast}</div> : null}
          {pricesErr ? <div className="lpToast">{pricesErr}</div> : null}
        </div>
      </section>

      <section className="lpWhy lpReveal lpSectionLazy">
        <div className="lpPricingInner">
          <div className="lpPricingHead">
            <h2 className="lpH2">Why Pros Choose Glow’d Up Booking</h2>
          </div>
          <ul className="lpList lpWhyList">
            {WHY_PROS.map((item) => (
              <li key={item}>✓ {item}</li>
            ))}
          </ul>
        </div>
      </section>

      <section className="lpPricing" id="plans">
        <div className="lpPricingInner">
          <div className="lpPricingHead">
            <h2 className="lpH2">Plans</h2>
            <div className="lpSub">Choose what fits your workflow.</div>

            <div className="lpToggleWrap" role="radiogroup" aria-label="Billing cycle">
              <button
                className={`lpToggleBtn ${billingCycle === "monthly" ? "is-active" : ""}`}
                onClick={() => {
                  setBillingCycle("monthly");
                  trackEvent("billing_cycle_change", { page: "pricing", billing_cycle: "monthly" });
                }}
                role="radio"
                aria-checked={billingCycle === "monthly"}
              >
                Monthly
              </button>
              <button
                className={`lpToggleBtn ${billingCycle === "annual" ? "is-active" : ""}`}
                onClick={() => {
                  setBillingCycle("annual");
                  trackEvent("billing_cycle_change", { page: "pricing", billing_cycle: "annual" });
                }}
                role="radio"
                aria-checked={billingCycle === "annual"}
              >
                Annual (save 15%)
              </button>
            </div>

            <div className={`lpCounter lpCounterTop ${loading ? "lpSkeleton" : ""}`}>
              {loading ? "Founder spots left" : showFounderPlan ? `${remaining} Founder spots left` : "Founder spots filled · Elite now available"}
            </div>
          </div>

          <div className="lpGrid lpGrid4">
            <Card className="lpPriceCard lpPlanCard lpReveal" style={{ animationDelay: "0ms" }}>
              <div className="lpTier" style={{ fontWeight: 900, opacity: 0.95 }}>Free</div>
              <div className="lpPriceLine"><span className="lpPrice">$0</span></div>
              <ul className="lpList">
                <li>✓ Basic booking link</li>
                <li>✓ Up to 5 services</li>
                <li>✓ Up to 20 bookings per month (resets on the 1st)</li>
                <li>✓ No deposits or full prepay</li>
                <li>✓ No service photos</li>
                <li>✓ Basic profile + standard support</li>
              </ul>
              <div className="lpChooseWrap">
                {!session ? (
                  <Link
                    to={signupPath}
                    onClick={() => trackEvent("plan_cta_click", { page: "pricing", plan: "free", cta: "start_free" })}
                  >
                    <Button variant="outline" className="lpChoose">Start Free</Button>
                  </Link>
                ) : (
                  <Link
                    to="/app"
                    onClick={() => trackEvent("plan_cta_click", { page: "pricing", plan: "free", cta: "go_to_dashboard" })}
                  >
                    <Button variant="outline" className="lpChoose">Go to Dashboard</Button>
                  </Link>
                )}
              </div>
            </Card>

            <Card className="lpPriceCard lpPlanCard lpReveal" style={{ animationDelay: "70ms" }}>
              <div className="lpTier" style={{ fontWeight: 900, opacity: 0.95 }}>Starter</div>
              <div className="lpPriceLine">
                <span className={`lpPrice ${pricesLoading ? "lpSkeleton" : ""}`}>{pricesLoading ? "$--" : starterPrice || "-"}</span>
                <span className="lpTerm">{starterTerm || ""}</span>
              </div>
              {billingCycle === "annual" ? <div className="lpTinyNote">Display estimate for annual billing</div> : null}
              <ul className="lpList">
                <li>✓ Everything in Free</li>
                <li>✓ Unlimited accepted bookings</li>
                <li>✓ Unlimited services</li>
                <li>✓ Fixed-amount deposits</li>
                <li>✓ Service photos</li>
                <li>✓ Better booking controls + reminders</li>
                <li>✓ Basic reporting</li>
              </ul>
              <div className="lpChooseWrap">
                <Button
                  variant="outline"
                  className="lpChoose"
                  onClick={() => {
                    trackEvent("plan_cta_click", { page: "pricing", plan: "starter", cta: "choose_starter", billing_cycle: billingCycle });
                    startCheckout("starter_monthly");
                  }}
                  disabled={sessionLoading || pricesLoading}
                >
                  {sessionLoading ? "Redirecting..." : "Choose Starter"}
                </Button>
              </div>
            </Card>

            <Card className="lpPriceCard lpPlanCard lpFeatured lpReveal" style={{ animationDelay: "140ms" }}>
              <div className="lpTierRow">
                <div className="lpTier" style={{ fontWeight: 900, opacity: 0.95 }}>Pro</div>
                <div className="lpBadge">Most chosen</div>
              </div>
              <div className="lpPriceLine">
                <span className={`lpPrice ${pricesLoading ? "lpSkeleton" : ""}`}>{pricesLoading ? "$--" : proPrice || "-"}</span>
                <span className="lpTerm">{proTerm || ""}</span>
              </div>
              {billingCycle === "annual" ? <div className="lpTinyNote">Display estimate for annual billing</div> : null}
              <ul className="lpList">
                <li>✓ Everything in Starter</li>
                <li>✓ Advanced deposits + optional full prepay</li>
                <li>✓ Advanced availability/scheduling rules</li>
                <li>✓ Social/payment profile fields (IG/X/Cash App)</li>
                <li>✓ Portfolio/gallery polish</li>
                <li>✓ Higher reporting capability</li>
                <li>✓ Priority support</li>
              </ul>
              <div className="lpChooseWrap">
                <Button
                  variant="outline"
                  className="lpChoose"
                  onClick={() => {
                    trackEvent("plan_cta_click", { page: "pricing", plan: "pro", cta: "choose_pro", billing_cycle: billingCycle });
                    startCheckout("pro_monthly");
                  }}
                  disabled={sessionLoading || pricesLoading}
                >
                  {sessionLoading ? "Redirecting..." : "Choose Pro"}
                </Button>
              </div>
            </Card>

            {showFounderPlan ? (
              <Card className="lpPriceCard lpPlanCard lpReveal" style={{ animationDelay: "210ms" }}>
                <div className="lpTier" style={{ fontWeight: 900, opacity: 0.95 }}>Founder</div>
                <div className="lpPriceLine">
                  <span className={`lpPrice ${pricesLoading ? "lpSkeleton" : ""}`}>{pricesLoading ? "$--" : founderPrice || "-"}</span>
                  <span className="lpTerm">{founderTerm || ""}</span>
                </div>

                <div className="lpFounderBox">
                  <div className="lpFounderTop">
                    <div className="lpFounderTitle">Founder Annual</div>
                    <div className="lpFounderRule">Price locked while active</div>
                  </div>
                </div>

                <div className="lpFounderText">First 1,000 pros only. Same feature access as Pro with locked annual pricing.</div>

                <div className={`lpCounter ${loading ? "lpSkeleton" : ""}`}>
                  {loading ? "Checking founder spots..." : <><strong>{remaining}</strong> Founder spots left</>}
                  {err ? <div className="lpCounterErr">{err}</div> : null}
                </div>

                <ul className="lpList">
                  <li>✓ Everything in Pro</li>
                  <li>✓ Founder badge + early feature access</li>
                  <li>✓ Founder pricing locked while active</li>
                  <li>✓ Priority support</li>
                  <li>✓ Best long-term value</li>
                </ul>

                <div className="lpChooseWrap">
                  <Button
                    variant="outline"
                    className="lpChoose"
                    onClick={() => {
                      trackEvent("plan_cta_click", { page: "pricing", plan: "founder", cta: "choose_founder", billing_cycle: "annual" });
                      startCheckout("founder_annual");
                    }}
                    disabled={sessionLoading || pricesLoading}
                  >
                    {sessionLoading ? "Redirecting..." : "Choose Founder"}
                  </Button>
                </div>
              </Card>
            ) : (
              <Card className="lpPriceCard lpPlanCard lpReveal" style={{ animationDelay: "210ms" }}>
                <div className="lpTier" style={{ fontWeight: 900, opacity: 0.95 }}>Elite</div>
                <div className="lpPriceLine">
                  <span className={`lpPrice ${pricesLoading ? "lpSkeleton" : ""}`}>{pricesLoading ? "$--" : elitePrice || "-"}</span>
                  <span className="lpTerm">{eliteTerm || ""}</span>
                </div>
                <ul className="lpList">
                  <li>✓ Everything in Pro</li>
                  <li>✓ Team/staff workflows</li>
                  <li>✓ +1 member included</li>
                  <li>✓ Additional members +$10 each (max 10 total)</li>
                  <li>✓ Multi-location + advanced business controls</li>
                  <li>✓ Advanced analytics + concierge support</li>
                </ul>
                <div className="lpChooseWrap">
                  <Button
                    variant="outline"
                    className="lpChoose"
                    onClick={() => {
                      trackEvent("plan_cta_click", { page: "pricing", plan: "elite", cta: "choose_elite", billing_cycle: billingCycle });
                      startCheckout("elite_monthly");
                    }}
                    disabled={sessionLoading || pricesLoading}
                  >
                    {sessionLoading ? "Redirecting..." : "Choose Elite"}
                  </Button>
                </div>
              </Card>
            )}
          </div>

          <div className="lpFooterLine">
            <div className="lpFooterSmall">Free plan accepted-booking limits reset on the 1st of each month.</div>
            <div className="lpFooterSmall">Deposits and payments are processed via Stripe when enabled.</div>
            <div className="lpFooterSmall">Instant payout is optional and includes an additional fee.</div>
            <div className="lpFooterSmall">You can upgrade or downgrade at any time.</div>
          </div>
        </div>
      </section>

      <section className="lpPricing lpReveal lpSectionLazy">
        <div className="lpPricingInner">
          <div className="lpPricingHead">
            <h2 className="lpH2">FAQ</h2>
          </div>

          <div className="lpFaqList">
            {FAQ_ITEMS.map((item) => (
              <Card key={item.q} className="lpPriceCard">
                <div className="lpTier" style={{ fontWeight: 900, opacity: 0.95 }}>{item.q}</div>
                <div className="lpSub" style={{ marginTop: 8 }}>{item.a}</div>
              </Card>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
