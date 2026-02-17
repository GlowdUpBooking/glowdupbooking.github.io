// src/pages/Pricing.jsx
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
  const i = priceObj?.interval; // "month" | "year"
  const c = priceObj?.interval_count || 1;
  if (!i) return null;

  if (i === "month") return c === 1 ? "/month" : `/${c} months`;
  if (i === "year") return c === 1 ? "/year" : `/${c} years`;
  return null;
}

export default function Pricing() {
  const nav = useNavigate();

  // auth session
  const [session, setSession] = useState(null);

  // founder counter
  const [loading, setLoading] = useState(true);
  const [maxSpots, setMaxSpots] = useState(1000);
  const [claimed, setClaimed] = useState(0);
  const [err, setErr] = useState("");

  // UI
  const [sessionLoading, setSessionLoading] = useState(false);
  const [toast, setToast] = useState("");

  // live prices from Stripe (via Edge Function)
  const [pricesLoading, setPricesLoading] = useState(true);
  const [pricesErr, setPricesErr] = useState("");
  const [prices, setPrices] = useState(null); // { starter_monthly, pro_monthly, founder_annual }

  const remaining = useMemo(() => {
    const max = typeof maxSpots === "number" ? maxSpots : 1000;
    const used = typeof claimed === "number" ? claimed : 0;
    return Math.max(0, max - used);
  }, [maxSpots, claimed]);

  // keep session live
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

  // founder counter (works for anon after policy)
  useEffect(() => {
    let mounted = true;

    async function loadFounderCounter() {
      setLoading(true);
      setErr("");

      try {
        // IMPORTANT: table name must match exactly: founding_offer
        const { data, error } = await supabase
          .from("founding_offer")
          .select("max_spots, claimed_spots")
          .eq("id", 1)
          .maybeSingle();

        if (error) throw error;

        // If row doesn't exist, fall back safely
        const max = typeof data?.max_spots === "number" ? data.max_spots : 1000;
        const used = typeof data?.claimed_spots === "number" ? data.claimed_spots : 0;

        if (!mounted) return;
        setMaxSpots(max);
        setClaimed(used);
      } catch (e) {
        // Don’t hide errors anymore — this is what makes it “fool proof”
        console.error("[FounderCounter] load failed:", e);

        if (!mounted) return;

        // Keep showing something even if the DB call fails
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

  // Load live prices from Stripe via Edge Function
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

  // Stripe return message
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("success") === "1") setToast("✅ Payment complete. Your access will update shortly.");
    if (params.get("canceled") === "1") setToast("Payment canceled — no worries. You can try again anytime.");
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

      // Try invoke first
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

      // Fallback to manual fetch
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

      if (!res.ok) throw new Error(`Edge Function failed (${res.status}). ${json?.error || json?.message || text}`);
      if (!json?.url) throw new Error(`No checkout URL returned. Response: ${text}`);

      window.location.assign(json.url);
    } catch (e) {
      console.error(e);
      setToast(`❌ Checkout failed: ${e?.message || "Please try again."}`);
      setSessionLoading(false);
    }
  }

  const starterPrice = prices ? formatMoneyFromStripe(prices.starter_monthly) : null;
  const proPrice = prices ? formatMoneyFromStripe(prices.pro_monthly) : null;
  const founderPrice = prices ? formatMoneyFromStripe(prices.founder_annual) : null;

  const starterTerm = prices ? formatInterval(prices.starter_monthly) : null;
  const proTerm = prices ? formatInterval(prices.pro_monthly) : null;
  const founderTerm = prices ? formatInterval(prices.founder_annual) : null;

  return (
    <div className="lp">
      {/* Top Nav */}
      <header className="lpNav">
        <div className="lpNavInner">
          <Link className="lpBrand" to="/">
            <span className="lpBrandStrong">Glow’d Up</span>
            <span className="lpBrandLight"> Booking</span>
          </Link>

          <div className="lpNavRight">
            <Link className="lpNavLink" to="/pricing">
              Pricing
            </Link>

            {!session ? (
              <Link className="lpNavBtn" to="/login">
                Sign In <span className="lpArrow">→</span>
              </Link>
            ) : (
              <button className="lpNavBtn" onClick={signOut}>
                Sign out <span className="lpArrow">→</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="lpHero">
        <div className="lpHeroStrip" aria-hidden="true">
          <div className="lpHeroImg lpHeroImg1" />
          <div className="lpHeroImg lpHeroImg2" />
          <div className="lpHeroImg lpHeroImg3" />
          <div className="lpHeroImg lpHeroImg4" />
        </div>

        <div className="lpHeroInner">
          <h1 className="lpH1">Simple pricing for professionals.</h1>
          <p className="lpLead">
            Clients book free. Pros get premium tools on web + app — powered by a straightforward subscription.
          </p>

          <div className="lpHeroBtns">
            {!session ? (
              <>
                <Link to="/signup">
                  <Button variant="outline" className="lpBtn">
                    Create account
                  </Button>
                </Link>
                <Link to="/login">
                  <Button variant="outline" className="lpBtn">
                    Sign in
                  </Button>
                </Link>
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

      {/* Plans */}
      <section className="lpPricing">
        <div className="lpPricingInner">
          <div className="lpPricingHead">
            <h2 className="lpH2">Plans</h2>
            <div className="lpSub">Choose what fits your workflow.</div>
          </div>

          <div className="lpGrid">
            {/* Starter */}
            <Card className="lpPriceCard">
              <div className="lpTier" style={{ fontWeight: 900, opacity: 0.95 }}>Starter</div>

              <div className="lpPriceLine">
                <span className="lpPrice">{pricesLoading ? "—" : starterPrice || "—"}</span>
                <span className="lpTerm">{starterTerm || ""}</span>
              </div>

              <ul className="lpList">
                <li>✓ Pro profile + booking link</li>
                <li>✓ Add services (name, price, duration)</li>
                <li>✓ Basic scheduling + booking requests</li>
                <li>✓ Clients book through your link</li>
              </ul>

              <div className="lpChooseWrap">
                <Button
                  variant="outline"
                  className="lpChoose"
                  onClick={() => startCheckout("starter_monthly")}
                  disabled={sessionLoading || pricesLoading}
                >
                  {sessionLoading ? "Redirecting…" : "Choose Starter"}
                </Button>
              </div>
            </Card>

            {/* Pro */}
            <Card className="lpPriceCard lpFeatured">
              <div className="lpTier" style={{ fontWeight: 900, opacity: 0.95 }}>Pro</div>

              <div className="lpPriceLine">
                <span className="lpPrice">{pricesLoading ? "—" : proPrice || "—"}</span>
                <span className="lpTerm">{proTerm || ""}</span>
              </div>

              <ul className="lpList">
                <li>✓ Everything in Starter</li>
                <li>✓ Priority placement (later when you open marketplace)</li>
                <li>✓ Advanced scheduling tools</li>
                <li>✓ Deposits + booking controls</li>
                <li>✓ Portfolio/service photos</li>
                <li>✓ Better customization + branding</li>
              </ul>

              <div className="lpChooseWrap">
                <Button
                  variant="outline"
                  className="lpChoose"
                  onClick={() => startCheckout("pro_monthly")}
                  disabled={sessionLoading || pricesLoading}
                >
                  {sessionLoading ? "Redirecting…" : "Choose Pro"}
                </Button>
              </div>
            </Card>

            {/* Founder */}
            <Card className="lpPriceCard">
              <div className="lpTier" style={{ fontWeight: 900, opacity: 0.95 }}>Founder</div>

              <div className="lpPriceLine">
                <span className="lpPrice">{pricesLoading ? "—" : founderPrice || "—"}</span>
                <span className="lpTerm">{founderTerm || ""}</span>
              </div>

              <div className="lpFounderBox">
                <div className="lpFounderTop">
                  <div className="lpFounderTitle">Founder Annual</div>
                  <div className="lpFounderRule">Price locked while active</div>
                </div>
              </div>

              <div className="lpFounderText">
                First 1,000 Pros lock in{" "}
                <strong>
                  {pricesLoading ? "$99/year" : `${founderPrice}${founderTerm ? ` ${founderTerm}` : ""}`}
                </strong>{" "}
                while active. <span className="lpFounderWarn">Don’t miss out</span>
              </div>

              <div className="lpCounter">
                {loading ? (
                  "Checking founder spots…"
                ) : (
                  <>
                    <strong>{remaining}</strong> founder spots left
                  </>
                )}
                {err ? <div className="lpCounterErr">{err}</div> : null}
              </div>

              <ul className="lpList">
                <li>✓ Everything in Pro</li>
                <li>✓ Locked-in annual price (best deal)</li>
                <li>✓ Founder badge + early feature access</li>
                <li>✓ Priority support</li>
              </ul>

              <div className="lpChooseWrap">
                <Button
                  variant="outline"
                  className="lpChoose"
                  onClick={() => startCheckout("founder_annual")}
                  disabled={sessionLoading || pricesLoading}
                >
                  {sessionLoading ? "Redirecting…" : "Choose Founder"}
                </Button>
              </div>
            </Card>
          </div>

          <div className="lpFooterLine">
            <div className="lpFooterBig">
              {loading ? "Founder spots left" : `${remaining} Founder spots left`}
            </div>
            <div className="lpFooterSmall">
              Lock in Founder pricing while your membership stays active.
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}