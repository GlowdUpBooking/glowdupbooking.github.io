import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";

function formatMoneyFromStripe(priceObj) {
  const cents = priceObj?.unit_amount;
  const currency = priceObj?.currency || "USD";
  if (typeof cents !== "number") return null;

  const amount = cents / 100;

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

function formatInterval(priceObj) {
  const i = priceObj?.interval;
  const c = priceObj?.interval_count || 1;
  if (!i) return null;

  if (i === "month") return c === 1 ? "/month" : `/${c} months`;
  if (i === "year") return c === 1 ? "/year" : `/${c} years`;
  return null;
}

const WHY_PROS = [
  "Keep more of what you earn with clear, transparent pricing",
  "Reduce no-shows with deposits and optional prepay",
  "Get paid faster with reliable payout options",
  "Build your brand with a premium booking experience",
  "Grow with tools designed for independent pros",
];

const FAQ_ITEMS = [
  {
    q: "Do clients pay to book?",
    a: "No. Booking is free for clients.",
  },
  {
    q: "When does the Free plan booking limit reset?",
    a: "On the 1st of every month.",
  },
  {
    q: "How do deposits and payments work?",
    a: "Deposits and payments are processed through Stripe when enabled.",
  },
  {
    q: "Can I change plans later?",
    a: "Yes. Upgrade or downgrade anytime.",
  },
  {
    q: "What is instant payout?",
    a: "An optional payout method with an additional fee for immediate access to funds.",
  },
];

export default function Pricing() {
  const nav = useNavigate();

  const [session, setSession] = useState(null);

  const [loading, setLoading] = useState(true);
  const [maxSpots, setMaxSpots] = useState(1000);
  const [claimed, setClaimed] = useState(0);
  const [err, setErr] = useState("");

  const [sessionLoading, setSessionLoading] = useState(false);
  const [toast, setToast] = useState("");

  const [pricesLoading, setPricesLoading] = useState(true);
  const [pricesErr, setPricesErr] = useState("");
  const [prices, setPrices] = useState(null);

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
        const { data, error } = await supabase.functions.invoke("get-prices");
        if (error) throw error;

        const p = data?.prices ?? null;
        if (!p?.starter_monthly || !p?.pro_monthly || !p?.founder_annual) {
          throw new Error("Invalid pricing payload.");
        }

        if (!mounted) return;
        setPrices(p);
      } catch (e) {
        console.error("[Pricing] get-prices failed:", e);
        if (!mounted) return;
        setPricesErr("Pricing unavailable. Refresh the page or try again soon.");
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
    const params = new URLSearchParams(window.location.search);
    if (params.get("checkout") === "success") {
      setToast("Payment complete. Your access will update shortly.");
    }
    if (params.get("checkout") === "cancel") {
      setToast("Payment canceled. You can try again anytime.");
    }
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    nav("/", { replace: true });
  }

  async function startCheckout(tier) {
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
        nav("/signup", { replace: true });
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
      console.error(e);
      setToast(`Checkout failed: ${e?.message || "Please try again."}`);
      setSessionLoading(false);
    }
  }

  const starterPrice = prices ? formatMoneyFromStripe(prices.starter_monthly) : null;
  const proPrice = prices ? formatMoneyFromStripe(prices.pro_monthly) : null;
  const founderPrice = prices ? formatMoneyFromStripe(prices.founder_annual) : null;

  const starterTerm = prices ? formatInterval(prices.starter_monthly) : null;
  const proTerm = prices ? formatInterval(prices.pro_monthly) : null;
  const founderTerm = prices ? formatInterval(prices.founder_annual) : null;

  const founderSoldOut = !loading && remaining <= 0;

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
            <Link className="lpNavBtn lpNavBtnSecondary" to="/pricing">
              Pricing
            </Link>

            {!session ? (
              <>
                <Link className="lpNavBtn lpNavBtnSecondary" to="/signup">
                  Create Account
                </Link>
                <Link className="lpNavBtn" to="/login">
                  Sign In <span className="lpArrow">→</span>
                </Link>
              </>
            ) : (
              <button className="lpNavBtn lpNavBtnSecondary" onClick={() => nav("/app")}>
                Dashboard
              </button>
            )}
            {session ? (
              <button className="lpNavBtn" onClick={signOut}>
                Sign out <span className="lpArrow">→</span>
              </button>
            ) : null}
          </div>
        </div>
      </header>

      <section className="lpHero">
        <div className="lpHeroStrip" aria-hidden="true">
          <div className="lpHeroImg lpHeroImg1" />
          <div className="lpHeroImg lpHeroImg2" />
          <div className="lpHeroImg lpHeroImg3" />
          <div className="lpHeroImg lpHeroImg4" />
        </div>

        <div className="lpHeroInner">
          <h1 className="lpH1">Simple pricing for beauty professionals.</h1>
          <p className="lpLead">
            Built for barbers, stylists, tattoo artists, nail techs, and more. Start free and upgrade
            when you are ready.
          </p>
          <p className="lpLead">Clients book free. Pros pay only for tools and growth.</p>

          <div className="lpHeroBtns">
            {!session ? (
              <>
                <Link to="/signup">
                  <Button variant="outline" className="lpBtn">
                    Start Free
                  </Button>
                </Link>
                <Button
                  variant="outline"
                  className="lpBtn"
                  onClick={() => document.getElementById("plans")?.scrollIntoView({ behavior: "smooth" })}
                >
                  View Plans
                </Button>
              </>
            ) : (
              <Link to="/app">
                <Button variant="outline" className="lpBtn">
                  Go to Dashboard
                </Button>
              </Link>
            )}
          </div>

          {toast ? <div className="lpToast">{toast}</div> : null}
          {pricesErr ? <div className="lpToast">{pricesErr}</div> : null}
        </div>
      </section>

      <section className="lpWhy">
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
            <div className="lpCounter lpCounterTop">
              {loading ? "Founder spots left" : `${remaining} Founder spots left`}
            </div>
          </div>

          <div className="lpGrid lpGrid4">
            <Card className="lpPriceCard lpPlanCard">
              <div className="lpTier" style={{ fontWeight: 900, opacity: 0.95 }}>Free</div>

              <div className="lpPriceLine">
                <span className="lpPrice">$0</span>
              </div>

              <ul className="lpList">
                <li>✓ Pro profile + shareable booking link</li>
                <li>✓ Unlimited booking requests</li>
                <li>✓ Accept up to 20 bookings per month (resets on the 1st)</li>
                <li>✓ Optional deposits</li>
                <li>✓ Basic scheduling + booking management</li>
                <li>✓ No full prepay (deposit-only payments if enabled)</li>
              </ul>

              <div className="lpChooseWrap">
                {!session ? (
                  <Link to="/signup">
                    <Button variant="outline" className="lpChoose">
                      Start Free
                    </Button>
                  </Link>
                ) : (
                  <Link to="/app">
                    <Button variant="outline" className="lpChoose">
                      Go to Dashboard
                    </Button>
                  </Link>
                )}
              </div>
            </Card>

            <Card className="lpPriceCard lpPlanCard">
              <div className="lpTier" style={{ fontWeight: 900, opacity: 0.95 }}>Starter</div>

              <div className="lpPriceLine">
                <span className="lpPrice">{pricesLoading ? "-" : starterPrice || "-"}</span>
                <span className="lpTerm">{starterTerm || ""}</span>
              </div>

              <ul className="lpList">
                <li>✓ Everything in Free</li>
                <li>✓ Unlimited accepted bookings</li>
                <li>✓ Better booking controls</li>
                <li>✓ Service menu (durations + pricing)</li>
                <li>✓ Client notes + simple organization</li>
                <li>✓ Faster setup + smoother workflow</li>
              </ul>

              <div className="lpChooseWrap">
                <Button
                  variant="outline"
                  className="lpChoose"
                  onClick={() => startCheckout("starter_monthly")}
                  disabled={sessionLoading || pricesLoading}
                >
                  {sessionLoading ? "Redirecting..." : "Choose Starter"}
                </Button>
              </div>
            </Card>

            <Card className="lpPriceCard lpPlanCard lpFeatured">
              <div className="lpTier" style={{ fontWeight: 900, opacity: 0.95 }}>Pro</div>

              <div className="lpPriceLine">
                <span className="lpPrice">{pricesLoading ? "-" : proPrice || "-"}</span>
                <span className="lpTerm">{proTerm || ""}</span>
              </div>

              <ul className="lpList">
                <li>✓ Everything in Starter</li>
                <li>✓ Optional deposits and optional full prepay</li>
                <li>✓ Advanced scheduling rules (buffers, availability windows, etc.)</li>
                <li>✓ Portfolio/service photos</li>
                <li>✓ Stronger branding + customization</li>
                <li>✓ Priority placement (when marketplace launches)</li>
                <li>✓ Instant payout option (fee applies)</li>
              </ul>

              <div className="lpChooseWrap">
                <Button
                  variant="outline"
                  className="lpChoose"
                  onClick={() => startCheckout("pro_monthly")}
                  disabled={sessionLoading || pricesLoading}
                >
                  {sessionLoading ? "Redirecting..." : "Choose Pro"}
                </Button>
              </div>
            </Card>

            <Card className="lpPriceCard lpPlanCard">
              <div className="lpTier" style={{ fontWeight: 900, opacity: 0.95 }}>Founder</div>

              <div className="lpPriceLine">
                <span className="lpPrice">{pricesLoading ? "-" : founderPrice || "-"}</span>
                <span className="lpTerm">{founderTerm || ""}</span>
              </div>

              <div className="lpFounderBox">
                <div className="lpFounderTop">
                  <div className="lpFounderTitle">Founder Annual</div>
                  <div className="lpFounderRule">Price locked while active</div>
                </div>
              </div>

              <div className="lpFounderText">
                First 1,000 pros only. Lock in the best price while you stay active.
              </div>

              <div className="lpCounter">
                {loading ? (
                  "Checking founder spots..."
                ) : (
                  <>
                    <strong>{remaining}</strong> Founder spots left
                  </>
                )}
                {err ? <div className="lpCounterErr">{err}</div> : null}
              </div>

              <ul className="lpList">
                <li>✓ Everything in Pro</li>
                <li>✓ Founder pricing locked while active</li>
                <li>✓ Founder badge + early feature access</li>
                <li>✓ Priority support</li>
                <li>✓ Best long-term value</li>
                <li>✓ Lapse over 7 days cannot reclaim Founder pricing</li>
              </ul>

              <div className="lpChooseWrap">
                <Button
                  variant="outline"
                  className="lpChoose"
                  onClick={() => startCheckout("founder_annual")}
                  disabled={sessionLoading || pricesLoading || founderSoldOut}
                >
                  {founderSoldOut ? "Founder Sold Out" : sessionLoading ? "Redirecting..." : "Choose Founder"}
                </Button>
              </div>
            </Card>
          </div>

          <div className="lpFooterLine">
            <div className="lpFooterBig">
              {loading ? "Founder spots left" : `${remaining} Founder spots left`}
            </div>
            <div className="lpFooterSmall">
              Active means your paid subscription is in good standing.
            </div>
          </div>
        </div>
      </section>

      <section className="lpPricing">
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

          <div className="lpFooterLine">
            <div className="lpFooterSmall">Free plan accepted-booking limits reset on the 1st of each month.</div>
            <div className="lpFooterSmall">Deposits and payments are processed via Stripe when enabled.</div>
            <div className="lpFooterSmall">Instant payout is optional and includes an additional fee.</div>
            <div className="lpFooterSmall">You can upgrade or downgrade at any time.</div>
          </div>
        </div>
      </section>
    </div>
  );
}
