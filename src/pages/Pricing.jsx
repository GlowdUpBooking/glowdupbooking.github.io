import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

export default function Pricing() {
  const [loading, setLoading] = useState(true);
  const [maxSpots, setMaxSpots] = useState(500);
  const [claimed, setClaimed] = useState(0);
  const [err, setErr] = useState("");

  const remaining = useMemo(() => Math.max(0, (maxSpots ?? 500) - (claimed ?? 0)), [maxSpots, claimed]);

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
        setErr("Countdown unavailable (still fine to sign up).");
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
          <h1>Pricing built for professionals.</h1>
          <p>
            Clients book free. Pros get premium tools on web + app — with fair platform fees that
            scale only when you earn.
          </p>

          <div className="heroBtns">
            <a className="btn gold" href="/signup">Create account</a>
            <a className="btn ghost" href="/login">Sign in</a>
          </div>
        </section>

        <section className="section">
          <div className="sectionHead">
            <h2>Founding Pro</h2>
            <p>Limited offer for the first 500 professionals.</p>
          </div>

          <div className="pricingGrid">
            <div className="priceCard priceCard--featured">
              <div className="priceTop">
                <div>
                  <div className="priceBadge">Founding • Limited</div>
                  <div className="priceTitle">Founding Pro</div>
                  <div className="priceSub">Pay once. Lock in your year.</div>
                </div>

                <div className="priceNumber">
                  <span className="priceAmount">$99</span>
                  <span className="priceTerm">/year</span>
                </div>
              </div>

              <div className="countdownRow">
                <div className="countdownPill">
                  {loading ? "Checking spots…" : `Spots left: ${remaining} / ${maxSpots}`}
                </div>
                {err ? <div className="countdownNote">{err}</div> : null}
              </div>

              <ul className="priceList">
                <li><strong>Choose any 4 months</strong> in your year with <strong>$0 platform fees</strong></li>
                <li>Founding badge + early placement when marketplace launches</li>
                <li>Access to web platform + app tools</li>
                <li>City-by-city rollout (marketplace search turns on when density is ready)</li>
              </ul>

              <div className="priceCtas">
                <a className="btn gold full" href="/signup">Claim founding spot</a>
                <a className="btn ghost full" href="/login">Already have an account?</a>
              </div>

              <div className="finePrint">
                Intro offer for the first 500. Pricing may evolve after early access.
              </div>
            </div>

            <div className="priceCard">
              <div className="priceTop">
                <div>
                  <div className="priceBadge priceBadge--muted">Standard</div>
                  <div className="priceTitle">Pro</div>
                  <div className="priceSub">Everything you need to run bookings.</div>
                </div>

                <div className="priceNumber">
                  <span className="priceAmount">$15</span>
                  <span className="priceTerm">/month</span>
                </div>
              </div>

              <ul className="priceList">
                <li>Web + app access</li>
                <li>Booking tools + pro dashboard foundation</li>
                <li>Analytics modules as they roll out</li>
                <li>Support for link-based booking before marketplace search launches</li>
              </ul>

              <div className="feeBox">
                <div className="feeTitle">Platform fees</div>
                <div className="feeRow">
                  <span>Direct bookings (your link / repeats)</span>
                  <strong>5% capped at $5</strong>
                </div>
                <div className="feeRow">
                  <span>Marketplace bookings (later)</span>
                  <strong>10% capped at $10</strong>
                </div>
              </div>

              <div className="priceCtas">
                <a className="btn gold full" href="/signup">Create account</a>
                <a className="btn ghost full" href="/login">Sign in</a>
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
              <div className="cardDetail">No — clients book free. Pros choose a plan.</div>
            </div>

            <div className="card">
              <div className="cardTitle">When do platform fees apply?</div>
              <div className="cardDetail">
                Fees apply to completed online bookings made through Glow’d Up. Direct bookings have a lower fee than marketplace bookings.
              </div>
            </div>

            <div className="card">
              <div className="cardTitle">How do the 4 fee-free months work?</div>
              <div className="cardDetail">
                Founding Pros will be able to pick any 4 months inside their settings to waive platform fees for those months.
              </div>
            </div>

            <div className="card">
              <div className="cardTitle">When does marketplace search launch?</div>
              <div className="cardDetail">
                City-by-city. We’ll enable it once there are enough pros in an area to make discovery worth it.
              </div>
            </div>

            <div className="card">
              <div className="cardTitle">Can I cancel the $15/mo plan?</div>
              <div className="cardDetail">
                Yes. Subscription billing will be handled in the platform (Stripe integration next).
              </div>
            </div>

            <div className="card">
              <div className="cardTitle">Do you support deposits?</div>
              <div className="cardDetail">
                Deposits + policies are on the roadmap (and are a big part of reducing no-shows).
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