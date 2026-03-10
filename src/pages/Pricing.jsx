import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import { trackEvent } from "../lib/analytics";
import { getSignupPath, isStudioWebBillingRestricted } from "../lib/siteFlags";
import { createStudioBillingSession } from "../lib/studioBilling";
import {
  DEFAULT_PRICES,
  formatMoneyFromStripe,
  formatTerm,
  mergeLivePrices,
} from "../lib/pricing";

const IOS_APP_URL = "https://apps.apple.com/us/app/glowd-up-booking/id6758881771";

export default function Pricing() {
  const nav = useNavigate();
  const location = useLocation();
  const signupPath = getSignupPath();
  const studioBillingRestricted = isStudioWebBillingRestricted();
  const showStudioPlan = !studioBillingRestricted;

  const [session, setSession] = useState(null);
  const [sessionLoading, setSessionLoading] = useState(false);
  const [showStickyCta, setShowStickyCta] = useState(false);
  const [toast, setToast] = useState("");

  const [pricesLoading, setPricesLoading] = useState(true);
  const [pricesErr, setPricesErr] = useState("");
  const [prices, setPrices] = useState(DEFAULT_PRICES);

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
        if (mounted) setPricesLoading(false);
      }
    }

    loadPrices();
    return () => {
      mounted = false;
    };
  }, []);

  // Scroll-triggered reveals
  useEffect(() => {
    const hero = document.querySelector(".lpHero");
    if (hero) hero.classList.add("is-visible");

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1, rootMargin: "0px 0px -40px 0px" }
    );

    document.querySelectorAll(".lpReveal:not(.lpHero)").forEach((el) => {
      observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  // Nav darken on scroll
  useEffect(() => {
    const navEl = document.querySelector(".lpNav");
    const onScroll = () => navEl?.classList.toggle("is-scrolled", window.scrollY > 30);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const updateStickyVisibility = () => {
      const isMobile = window.matchMedia("(max-width: 760px)").matches;
      setShowStickyCta(isMobile && window.scrollY > 260);
    };

    updateStickyVisibility();
    window.addEventListener("scroll", updateStickyVisibility, { passive: true });
    window.addEventListener("resize", updateStickyVisibility);
    return () => {
      window.removeEventListener("scroll", updateStickyVisibility);
      window.removeEventListener("resize", updateStickyVisibility);
    };
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("checkout") === "success") setToast("Payment complete. Your access will update shortly.");
    if (params.get("checkout") === "cancel") setToast("Payment canceled. You can try again anytime.");

    const fromBillingSetup = params.get("billing") === "setup";
    const focusPlans = params.get("focus") === "plans" || location.hash === "#plans";

    if (fromBillingSetup) {
      setToast("You’re on Free. Choose Pro when you’re ready.");
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
    trackEvent("checkout_start", { page: "pricing", tier, billing_cycle: "monthly" });
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

  async function startStudioCheckout() {
    if (studioBillingRestricted) {
      setToast("Studio checkout is not available from this device. Use the desktop web app.");
      return;
    }

    trackEvent("checkout_start", { page: "pricing", tier: "studio_monthly", billing_cycle: "monthly" });
    setToast("");
    setSessionLoading(true);

    try {
      const { data: authData, error: sessErr } = await supabase.auth.getSession();
      if (sessErr) throw sessErr;

      if (!authData?.session?.access_token) {
        trackEvent("checkout_requires_auth", { page: "pricing", tier: "studio_monthly" });
        nav(signupWithPlan("studio"), { replace: false });
        return;
      }

      const billingSession = await createStudioBillingSession({
        intent: "checkout",
        returnPath: "/app/subscription",
        successPath: "/app/subscription?studio=success&session_id={CHECKOUT_SESSION_ID}",
        cancelPath: "/app/subscription?studio=cancel",
      });

      trackEvent("checkout_redirect", { page: "pricing", tier: "studio_monthly", source: "studio_checkout" });
      window.location.assign(billingSession.url);
    } catch (e) {
      console.error("[Pricing] studio checkout failed:", e);
      trackEvent("checkout_error", { page: "pricing", tier: "studio_monthly", message: e?.message || "unknown_error" });
      setToast(`Studio checkout failed: ${e?.message || "Please try again."}`);
    } finally {
      setSessionLoading(false);
    }
  }

  function signupWithPlan(plan) {
    const joiner = signupPath.includes("?") ? "&" : "?";
    return `${signupPath}${joiner}plan=${encodeURIComponent(plan)}`;
  }

  function onStickyProClick() {
    trackEvent("plan_cta_click", { page: "pricing", plan: "pro", cta: "sticky_choose_pro" });
    if (!session) {
      nav(signupWithPlan("pro"), { replace: false });
      return;
    }
    void startCheckout("pro_monthly");
  }

  const proPrice = formatMoneyFromStripe(prices?.pro_monthly, "monthly") || "$19.99";
  const proTerm = formatTerm(prices?.pro_monthly, "monthly") || "/month";
  const studioPrice = "$39.99";
  const studioTerm = "/month";
  const whyPros = [
    "Keep more of what you earn with clear, transparent pricing",
    "Reduce no-shows with deposits and optional prepay",
    "Get paid faster with reliable payout options",
    "Build your brand with a premium booking experience",
    "Grow with tools designed for independent pros",
    ...(showStudioPlan ? ["Scale into a team workspace when you are ready for Studio"] : []),
  ];
  const faqItems = [
    { q: "Do clients pay to book?", a: "No. Booking is always free for clients." },
    { q: "How long is the free trial?", a: "Every pro account starts with a free 7-day trial." },
    {
      q: "What happens after the trial?",
      a: showStudioPlan
        ? "You can stay on Free or move to Pro at $19.99/month. Studio is available on the web at $39.99/month for team businesses."
        : "You can stay on Free or move to Pro at $19.99/month.",
    },
    { q: "How do deposits and payments work?", a: "Deposits and payments are processed through Stripe when enabled." },
    { q: "Can I change plans later?", a: "Yes. Upgrade or downgrade anytime." },
    ...(showStudioPlan
      ? [
          {
            q: "What does Studio include?",
            a: "Studio includes the Pro toolkit plus shared team seats, studio resources, and payout reporting for multi-account businesses.",
          },
        ]
      : []),
  ];

  return (
    <div className="lp lpPricingPage">
      <header className="lpNav">
        <div className="lpNavInner">
          <Link className="lpBrand" to="/">
            <img className="lpBrandLogo" src="/assets/logo.png" alt="Glow&apos;d Up Booking logo" />
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
        <div className="lpHeroInner">
          <div className="lpHeroContent">
            <h1 className="lpH1">Simple pricing for beauty professionals.</h1>
            <p className="lpLead">Built for barbers, stylists, tattoo artists, nail techs, and more. Start free and scale with better tools.</p>
            <p className="lpLead">Clients book free. Pros pay only for tools and growth.</p>

            <div className="lpHeroBtns">
              <Link className="lpBtn" to={signupPath} onClick={() => trackEvent("cta_click", { page: "pricing", cta: "start_free_hero" })}>
                Start Free
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
              <a
                className="lpBtn lpBtnGold"
                href={IOS_APP_URL}
                target="_blank"
                rel="noreferrer"
                onClick={() => trackEvent("cta_click", { page: "pricing", cta: "download_ios_hero" })}
              >
                Download for iPhone
              </a>
            </div>

            <div className="lpTrustRow">
              <span>Stripe-secured payments</span>
              <span>Cancel anytime</span>
              <span>Now on the App Store</span>
            </div>

            <div className="lpLiveChip">Free 7-day trial available</div>

            {toast ? <div className="lpToast">{toast}</div> : null}
            {pricesErr ? <div className="lpToast">{pricesErr}</div> : null}
          </div>

          <div className="lpHeroPhotos" aria-hidden="true">
            <div className="lpHeroImg lpHeroImg1" />
            <div className="lpHeroImg lpHeroImg2" />
            <div className="lpHeroImg lpHeroImg3" />
            <div className="lpHeroImg lpHeroImg4" />
          </div>
        </div>
      </section>

      <section className="lpWhy lpReveal lpSectionLazy">
        <div className="lpPricingInner">
          <div className="lpPricingHead">
            <h2 className="lpH2">Why Pros Choose Glow’d Up Booking</h2>
          </div>
          <ul className="lpList lpWhyList">
            {whyPros.map((item) => (
              <li key={item}>✓ {item}</li>
            ))}
          </ul>
        </div>
      </section>

      <section className="lpPricing" id="plans">
        <div className="lpPricingInner">
          <div className="lpPricingHead">
            <h2 className="lpH2">Plans</h2>
            <div className="lpSub">{showStudioPlan ? "Three paths: Free 7-Day, Pro, and Studio." : "Two paths: Free 7-Day and Pro."}</div>
          </div>

          <div className="lpGrid">
            <Card className="lpPriceCard lpPlanCard lpPlanCardCompact lpReveal" style={{ animationDelay: "0ms" }}>
              <div className="lpTier" style={{ fontWeight: 900, opacity: 0.95 }}>Free 7-Day</div>
              <div className="lpPriceLine">
                <span className="lpPrice">$0</span>
                <span className="lpTerm">/7 days</span>
              </div>
              <div className="lpCardPath">
                {showStudioPlan
                  ? "Day 1-7: free trial. After day 7, stay on Free, upgrade to Pro, or start Studio on the web."
                  : "Day 1-7: free trial. After day 7, stay on Free or upgrade to Pro."}
              </div>
              <ul className="lpList">
                <li>✓ 7-day free trial to launch fast</li>
                <li>✓ Professional booking link</li>
                <li>✓ Core scheduling and booking workflow</li>
                <li>✓ Stripe-secured payment setup</li>
                <li>{showStudioPlan ? "✓ Upgrade to Pro or Studio anytime" : "✓ Upgrade to Pro anytime"}</li>
              </ul>
              <div className="lpChooseWrap">
                {!session ? (
                  <Link
                    to={signupPath}
                    className="lpChoose"
                    onClick={() => trackEvent("plan_cta_click", { page: "pricing", plan: "free_7_day", cta: "start_free" })}
                  >
                    Start Free Trial
                  </Link>
                ) : (
                  <Link
                    to="/app"
                    className="lpChoose"
                    onClick={() => trackEvent("plan_cta_click", { page: "pricing", plan: "free_7_day", cta: "go_to_dashboard" })}
                  >
                    Go to Dashboard
                  </Link>
                )}
              </div>
            </Card>

            <Card className="lpPriceCard lpPlanCard lpPlanCardCompact lpFeatured lpReveal" style={{ animationDelay: "70ms" }}>
              <div className="lpTierRow">
                <div className="lpTier" style={{ fontWeight: 900, opacity: 0.95 }}>Pro</div>
              </div>
              <div className="lpPriceLine">
                <span className="lpPrice">{proPrice}</span>
                <span className="lpTerm">{proTerm}</span>
              </div>
              <div className="lpCardPath">Upgrade anytime during trial. Pro is billed at $19.99/month.</div>
              <ul className="lpList">
                <li>✓ Everything in Free 7-Day</li>
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
                    trackEvent("plan_cta_click", { page: "pricing", plan: "pro", cta: "choose_pro", billing_cycle: "monthly" });
                    startCheckout("pro_monthly");
                  }}
                  disabled={sessionLoading || pricesLoading}
                >
                  {sessionLoading ? "Redirecting..." : "Choose Pro"}
                </Button>
              </div>
            </Card>

            {showStudioPlan ? (
              <Card className="lpPriceCard lpPlanCard lpPlanCardCompact lpReveal" style={{ animationDelay: "140ms" }}>
                <div className="lpTierRow">
                  <div className="lpTier" style={{ fontWeight: 900, opacity: 0.95 }}>Studio</div>
                </div>
                <div className="lpPriceLine">
                  <span className="lpPrice">{studioPrice}</span>
                  <span className="lpTerm">{studioTerm}</span>
                </div>
                <div className="lpCardPath">Studio checkout runs on the web. Includes 3 accounts, with extra seats at $9.99/month each up to 10 total accounts.</div>
                <ul className="lpList">
                  <li>✓ Everything in Pro</li>
                  <li>✓ Shared Studio workspace and team seats</li>
                  <li>✓ Chairs, rooms, and shared resource calendars</li>
                  <li>✓ Owner-managed seat billing and payout reporting</li>
                  <li>✓ Mobile Studio tools unlock after web checkout</li>
                </ul>
                <div className="lpChooseWrap">
                  {!session ? (
                    <Link
                      to={signupWithPlan("studio")}
                      className="lpChoose"
                      onClick={() => trackEvent("plan_cta_click", { page: "pricing", plan: "studio", cta: "start_studio_signup" })}
                    >
                      Start Studio
                    </Link>
                  ) : (
                    <Button
                      variant="outline"
                      className="lpChoose"
                      onClick={() => {
                        trackEvent("plan_cta_click", { page: "pricing", plan: "studio", cta: "choose_studio", billing_cycle: "monthly" });
                        startStudioCheckout();
                      }}
                      disabled={sessionLoading}
                    >
                      {sessionLoading ? "Redirecting..." : "Start Studio"}
                    </Button>
                  )}
                </div>
              </Card>
            ) : null}
          </div>

          <div className="lpCompareWrap lpReveal">
            <Card className="lpPriceCard lpCompareCard">
              <div className="lpCompareTitle">Feature comparison</div>
              <div className="lpCompareScroll" role="region" aria-label="Plan comparison" tabIndex={0}>
                <table className="lpCompareTable">
                  <thead>
                    <tr>
                      <th>Feature</th>
                      <th>Free 7-Day</th>
                      <th>Pro</th>
                      {showStudioPlan ? <th>Studio</th> : null}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Professional booking link</td>
                      <td>✓</td>
                      <td>✓</td>
                      {showStudioPlan ? <td>✓</td> : null}
                    </tr>
                    <tr>
                      <td>Core scheduling + bookings</td>
                      <td>✓</td>
                      <td>✓</td>
                      {showStudioPlan ? <td>✓</td> : null}
                    </tr>
                    <tr>
                      <td>Advanced deposits + prepay</td>
                      <td>—</td>
                      <td>✓</td>
                      {showStudioPlan ? <td>✓</td> : null}
                    </tr>
                    <tr>
                      <td>Advanced availability rules</td>
                      <td>—</td>
                      <td>✓</td>
                      {showStudioPlan ? <td>✓</td> : null}
                    </tr>
                    <tr>
                      <td>Portfolio polish + priority support</td>
                      <td>—</td>
                      <td>✓</td>
                      {showStudioPlan ? <td>✓</td> : null}
                    </tr>
                    {showStudioPlan ? (
                      <tr>
                        <td>Shared team seats + studio resources</td>
                        <td>—</td>
                        <td>—</td>
                        <td>✓</td>
                      </tr>
                    ) : null}
                    {showStudioPlan ? (
                      <tr>
                        <td>Studio payout reporting + seat billing</td>
                        <td>—</td>
                        <td>—</td>
                        <td>✓</td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>

          <div className="lpFooterLine">
            <div className="lpFooterSmall">All pro accounts begin with a free 7-day trial.</div>
            <div className="lpFooterSmall">Pro is billed at $19.99/month after trial.</div>
            {showStudioPlan ? <div className="lpFooterSmall">Studio is billed on the web at $39.99/month and includes 3 accounts.</div> : null}
            <div className="lpFooterSmall">Deposits and payments are processed via Stripe when enabled.</div>
            <div className="lpFooterSmall">You can upgrade or downgrade at any time.</div>
          </div>
        </div>
      </section>

      <section className="lpPricing lpReveal lpSectionLazy">
        <div className="lpPricingInner">
          <div className="lpAppPromo">
            <div className="lpAppPromoCopy">
              <div className="lpMobileBadge">Also on iPhone</div>
              <h2 className="lpH2">Download the app after you pick your plan.</h2>
              <p className="lpSub">
                Manage appointments, services, availability, and payouts from your phone with the live iOS app.
              </p>
              <a
                href={IOS_APP_URL}
                target="_blank"
                rel="noreferrer"
                className="lpStoreButton"
                onClick={() => trackEvent("cta_click", { page: "pricing", cta: "download_ios_section" })}
              >
                <span className="lpStoreButtonOverline">Download on the</span>
                <span className="lpStoreButtonLabel">App Store</span>
              </a>
            </div>

            <div className="lpAppPromoShots" aria-hidden="true">
              <figure className="lpScreenshotCard lpScreenshotCard1">
                <img className="lpScreenshotImage" src="/assets/app-store/dashboard.jpg" alt="" loading="lazy" />
              </figure>
              <figure className="lpScreenshotCard lpScreenshotCard2">
                <img className="lpScreenshotImage" src="/assets/app-store/appointments.jpg" alt="" loading="lazy" />
              </figure>
            </div>
          </div>
        </div>
      </section>

      <section className="lpPricing lpReveal lpSectionLazy">
        <div className="lpPricingInner">
          <div className="lpPricingHead">
            <h2 className="lpH2">FAQ</h2>
          </div>

          <div className="lpFaqList">
            {faqItems.map((item) => (
              <Card key={item.q} className="lpPriceCard">
                <div className="lpTier" style={{ fontWeight: 900, opacity: 0.95 }}>{item.q}</div>
                <div className="lpSub" style={{ marginTop: 8 }}>{item.a}</div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {showStickyCta ? (
        <div className="lpStickyCta" role="region" aria-label="Quick plan actions">
          <div className="lpStickyCopy">{showStudioPlan ? "Free 7-Day, Pro, or Studio on web" : "Free 7-Day or Pro"}</div>
          <div className="lpStickyActions">
            <Link
              className="lpStickyBtn lpStickyBtnGhost"
              to={session ? "/app" : signupPath}
              onClick={() => trackEvent("plan_cta_click", { page: "pricing", plan: "free_7_day", cta: "sticky_start_free" })}
            >
              {session ? "Dashboard" : "Start Free"}
            </Link>
            <button className="lpStickyBtn" type="button" onClick={onStickyProClick} disabled={sessionLoading}>
              {sessionLoading ? "Redirecting..." : "Choose Pro"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
