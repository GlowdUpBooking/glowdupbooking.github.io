// src/pages/Pricing.jsx
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

export default function Pricing() {
  const [loading, setLoading] = useState(true);
  const [maxSpots, setMaxSpots] = useState(500);
  const [claimed, setClaimed] = useState(0);
  const [err, setErr] = useState("");

  const [sessionLoading, setSessionLoading] = useState(false);
  const [toast, setToast] = useState("");

  const remaining = useMemo(
    () => Math.max(0, (maxSpots ?? 500) - (claimed ?? 0)),
    [maxSpots, claimed]
  );

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
          .single();

        if (error) throw error;

        if (!mounted) return;
        setMaxSpots(data?.max_spots ?? 500);
        setClaimed(data?.claimed_spots ?? 0);
      } catch (e) {
        if (!mounted) return;
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

  // Read success/canceled after Stripe returns
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("success") === "1") {
      setToast("✅ Payment complete. Your Pro access will update shortly.");
    }
    if (params.get("canceled") === "1") {
      setToast("Payment canceled — no worries. You can try again anytime.");
    }
  }, []);

  async function startCheckout(interval) {
    setToast("");
    setSessionLoading(true);

    try {
      const { data: authData } = await supabase.auth.getSession();
      const session = authData?.session;

      // Not logged in → go to signup
      if (!session?.access_token) {
        window.location.href = "/signup";
        return;
      }

      // Call Supabase Edge Function
      const { data, error } = await supabase.functions.invoke(
        "create-checkout-session",
        {
          body: { interval }, // "monthly" | "6mo" | "annual"
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      if (error) throw error;

      if (!data?.url) {
        throw new Error("No checkout URL returned");
      }

      // Redirect to Stripe Checkout
      window.location.href = data.url;
    } catch (e) {
      console.error(e);
      setToast("Something went wrong starting checkout. Please try again.");
    } finally {
      setSessionLoading(false);
    }
  }

  return (
    <div className="page">
      <div className="bg" aria-hidden="true" />

      <header className="nav">
        <div className="navInner">
          <a className="brand" href="/">
            <img
              className="logo"
              src="/assets/logo-1.png"
              alt="Glow’d Up Booking"
            />
            <div className="brandText">
              <div className="brandName">Glow’d Up Booking</div>
              <div className="brandTag">Pricing</div>
            </div>
          </a>

          <nav className="navLinks">
            <a className="navLink" href="/">
              Home
            </a>
            <a className="navLink navLink--active" href="/pricing">
              Pricing
            </a>
          </nav>

          <div className="navCta">
            <a className="btn ghost" href="/signup">
              Create account
            </a>
            <a className="btn gold" href="/login">
              Sign in
            </a>
          </div>
        </div>
      </header>

      <main className="container">
        <section className="heroPanel">
          <h1>Simple pricing for professionals.</h1>
          <p>
            Clients book free. Pros get premium tools on web + app — powered by a
            straightforward subscription.
          </p>

          <div className="heroBtns">
            <a className="btn gold" href="/signup">
              Create account
            </a>
            <a className="btn ghost" href="/login">
              Sign in
            </a>
          </div>

          {toast ? (
            <div style={{ marginTop: 14, opacity: 0.9 }}>{toast}</div>
          ) : null}
        </section>

        <section className="section">
          <div className="sectionHead">
            <h2>Plans</h2>
            <p>Choose what fits your workflow.</p>
          </div>

          <div className="pricingGrid">
            {/* Annual (featured) */}
            <div className="priceCard priceCard--featured">
              <div className="priceTop">
                <div>
                  <div className="priceBadge">Annual • Best value</div>
                  <div className="priceTitle">Pro (Annual)</div>
                  <div className="priceSub">
                    One payment for the year. Built for serious professionals.
                  </div>
                </div>

                <div className="priceNumber">
                  <span className="priceAmount">$99</span>
                  <span className="priceTerm">/year</span>
                </div>
              </div>

              {/* Founder Annual price lock */}
              <div className="founderBox">
                <div className="founderTop">
                  <span className="founderBadge">Founder Annual</span>
                  <span className="founderRule">Price locked while active</span>
                </div>

                <div className="founderText">
                  First 500 Pros who choose the Annual plan get{" "}
                  <strong>$99/year locked in</strong> for as long as their
                  membership stays active.
                </div>

                <div className="countdownRow">
                  <div className="countdownPill">
                    {loading
                      ? "Checking founder spots…"
                      : `Founder spots left: ${remaining} / ${maxSpots}`}
                  </div>
                  {err ? <div className="countdownNote">{err}</div> : null}
                </div>

                <div className="founderFine">
                  If your membership is canceled or lapses, Founder pricing is
                  forfeited.
                </div>
              </div>

              <ul className="priceList">
                <li>Web + app access</li>
                <li>Booking tools as they roll out</li>
                <li>Analytics modules as they roll out</li>
                <li>City-by-city rollout for marketplace discovery</li>
              </ul>

              <div className="priceCtas">
                <button
                  className="btn gold full"
                  onClick={() => startCheckout("annual")}
                  disabled={sessionLoading}
                >
                  {sessionLoading ? "Redirecting…" : "Choose annual"}
                </button>

                <a className="btn ghost full" href="/login">
                  Already have an account?
                </a>
              </div>

              <div className="finePrint">
                Subscription-only for now. We’ll add advanced tools over time.
              </div>
            </div>

            {/* 6-month (popular) */}
            <div className="priceCard">
              <div className="priceTop">
                <div>
                  <div className="priceBadge">6 months • Most popular</div>
                  <div className="priceTitle">Pro (6 months)</div>
                  <div className="priceSub">
                    A strong middle option with savings.
                  </div>
                </div>

                <div className="priceNumber">
                  <span className="priceAmount">$59</span>
                  <span className="priceTerm">/6 months</span>
                </div>
              </div>

              <ul className="priceList">
                <li>Web + app access</li>
                <li>Booking tools as they roll out</li>
                <li>Analytics modules as they roll out</li>
                <li>City-by-city rollout for marketplace discovery</li>
              </ul>

              <div className="priceCtas">
                <button
                  className="btn gold full"
                  onClick={() => startCheckout("6mo")}
                  disabled={sessionLoading}
                >
                  {sessionLoading ? "Redirecting…" : "Choose 6 months"}
                </button>
                <a className="btn ghost full" href="/login">
                  Sign in
                </a>
              </div>

              <div className="finePrint">
                Great for pros who want savings without a full year commitment.
              </div>
            </div>

            {/* Monthly */}
            <div className="priceCard">
              <div className="priceTop">
                <div>
                  <div className="priceBadge priceBadge--muted">Monthly</div>
                  <div className="priceTitle">Pro (Monthly)</div>
                  <div className="priceSub">Flexible month-to-month.</div>
                </div>

                <div className="priceNumber">
                  <span className="priceAmount">$15</span>
                  <span className="priceTerm">/month</span>
                </div>
              </div>

              <ul className="priceList">
                <li>Web + app access</li>
                <li>Booking tools as they roll out</li>
                <li>Analytics modules as they roll out</li>
                <li>City-by-city rollout for marketplace discovery</li>
              </ul>

              <div className="priceCtas">
                <button
                  className="btn gold full"
                  onClick={() => startCheckout("monthly")}
                  disabled={sessionLoading}
                >
                  {sessionLoading ? "Redirecting…" : "Choose monthly"}
                </button>
                <a className="btn ghost full" href="/login">
                  Sign in
                </a>
              </div>

              <div className="finePrint">
                Best if you’re just getting started or want maximum flexibility.
              </div>
            </div>
          </div>
        </section>

        <section className="section">
          <div className="sectionHead">
            <h2>FAQ</h2>
            <p>Clear answers, no surprises.</p>
          </div>

          <div className="grid">
            <div className="card">
              <div className="cardTitle">What is Founder Annual?</div>
              <div className="cardDetail">
                Founder Annual is a limited early access offer. The first 500
                Annual members keep $99/year pricing as long as their membership
                stays active.
              </div>
            </div>

            <div className="card">
              <div className="cardTitle">
                What does “price locked while active” mean?
              </div>
              <div className="cardDetail">
                If you keep your Annual membership active (no cancellation or
                lapse), you keep the Founder price. If it ends and you rejoin
                later, current pricing applies.
              </div>
            </div>

            <div className="card">
              <div className="cardTitle">Do clients pay to book?</div>
              <div className="cardDetail">No — clients book free.</div>
            </div>

            <div className="card">
              <div className="cardTitle">Do you take a cut of bookings?</div>
              <div className="cardDetail">
                Not right now. Pricing is subscription-only while we build
                density and ship core features.
              </div>
            </div>

            <div className="card">
              <div className="cardTitle">When does marketplace search launch?</div>
              <div className="cardDetail">
                City-by-city. We’ll enable it once there are enough pros in an
                area to make discovery worth it.
              </div>
            </div>

            <div className="card">
              <div className="cardTitle">Can I cancel?</div>
              <div className="cardDetail">
                Monthly will be cancelable. 6-month and annual cover their full
                term (billing integration next).
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="footer">
        <div className="footerInner">
          <div>
            <div className="footerTitle">Glow’d Up Booking</div>
            <div className="footerSub">© Kamara Labs LLC</div>
          </div>
          <div className="footerLinks">
            <a href="/">Home</a>
            <a href="/pricing">Pricing</a>
            <a href="/login">Sign in</a>
            <a href="/signup">Create account</a>
          </div>
        </div>
      </footer>
    </div>
  );
}