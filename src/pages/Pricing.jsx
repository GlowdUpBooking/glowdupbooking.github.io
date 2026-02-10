// src/pages/Pricing.jsx
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

export default function Pricing() {
  const [loading, setLoading] = useState(true);
  const [maxSpots, setMaxSpots] = useState(500);
  const [claimed, setClaimed] = useState(0);
  const [err, setErr] = useState("");

  const remaining = useMemo(
    () => Math.max(0, (maxSpots ?? 500) - (claimed ?? 0)),
    [maxSpots, claimed]
  );

  useEffect(() => {
    let mounted = true;

    async function load() {
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

    load();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="page">
      <div className="bg" aria-hidden="true" />

      <header className="nav">
        <div className="navInner">
          <a className="brand" href="/">
            <img className="logo" src="/assets/logo-1.png" alt="Glow’d Up Booking" />
            <div className="brandText">
              <div className="brandName">Glow’d Up Booking</div>
              <div className="brandTag">Pricing</div>
            </div>
          </a>

          <nav className="navLinks">
            <a className="navLink" href="/">Home</a>
            <a className="navLink navLink--active" href="/pricing">Pricing</a>
          </nav>

          <div className="navCta">
            <a className="btn ghost" href="/signup">Create account</a>
            <a className="btn gold" href="/login">Sign in</a>
          </div>
        </div>
      </header>

      <main className="container">
        <section className="heroPanel">
          <h1>Simple pricing for professionals.</h1>
          <p>
            Clients book free. Pros get premium tools on web + app — powered by a straightforward subscription.
          </p>

          <div className="heroBtns">
            <a className="btn gold" href="/signup">Create account</a>
            <a className="btn ghost" href="/login">Sign in</a>
          </div>
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

              <div className="countdownRow">
                <div className="countdownPill">
                  {loading ? "Checking availability…" : `Early access spots left: ${remaining} / ${maxSpots}`}
                </div>
                {err ? <div className="countdownNote">{err}</div> : null}
              </div>

              <ul className="priceList">
                <li>Web + app access</li>
                <li>Booking tools as they roll out</li>
                <li>Analytics modules as they roll out</li>
                <li>City-by-city rollout for marketplace discovery</li>
              </ul>

              <div className="priceCtas">
                <a className="btn gold full" href="/signup">Choose annual</a>
                <a className="btn ghost full" href="/login">Already have an account?</a>
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
                  <div className="priceSub">A strong middle option with savings.</div>
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
                <a className="btn gold full" href="/signup">Choose 6 months</a>
                <a className="btn ghost full" href="/login">Sign in</a>
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
                <a className="btn gold full" href="/signup">Choose monthly</a>
                <a className="btn ghost full" href="/login">Sign in</a>
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
              <div className="cardTitle">Do clients pay to book?</div>
              <div className="cardDetail">No — clients book free.</div>
            </div>

            <div className="card">
              <div className="cardTitle">Do you take a cut of bookings?</div>
              <div className="cardDetail">
                Not right now. Pricing is subscription-only while we build density and ship core features.
              </div>
            </div>

            <div className="card">
              <div className="cardTitle">When does marketplace search launch?</div>
              <div className="cardDetail">
                City-by-city. We’ll enable it once there are enough pros in an area to make discovery worth it.
              </div>
            </div>

            <div className="card">
              <div className="cardTitle">Can I cancel?</div>
              <div className="cardDetail">
                Monthly will be cancelable. 6-month and annual cover their full term (billing integration next).
              </div>
            </div>

            <div className="card">
              <div className="cardTitle">What’s included?</div>
              <div className="cardDetail">
                Web + app access, booking tools, and analytics modules as they roll out.
              </div>
            </div>

            <div className="card">
              <div className="cardTitle">Will pricing change?</div>
              <div className="cardDetail">
                We’ll keep pricing simple. If we add major paid features later, we’ll communicate changes clearly.
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