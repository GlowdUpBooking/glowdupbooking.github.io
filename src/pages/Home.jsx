import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import { getFounderSpotsLeft } from "../lib/foundingOffer";

const WHY_PROS = [
  "Keep more of what you earn with clear, transparent pricing",
  "Reduce no-shows with deposits and optional prepay",
  "Get paid faster with reliable payout options",
  "Build your brand with a premium booking experience",
  "Grow with tools designed for independent pros",
];

export default function Home() {
  const [founderLeft, setFounderLeft] = useState(1000);
  const [loadingFounder, setLoadingFounder] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function loadFounderLeft() {
      setLoadingFounder(true);
      try {
        const left = await getFounderSpotsLeft();
        if (!mounted) return;
        setFounderLeft(typeof left === "number" ? left : 1000);
      } catch {
        if (!mounted) return;
        setFounderLeft(1000);
      } finally {
        if (!mounted) return;
        setLoadingFounder(false);
      }
    }

    loadFounderLeft();
    return () => {
      mounted = false;
    };
  }, []);

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
            <Link className="lpNavBtn lpNavBtnSecondary" to="/signup">
              Create Account
            </Link>
            <Link className="lpNavBtn" to="/login">
              Sign In <span className="lpArrow">→</span>
            </Link>
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
            <Link to="/pricing">
              <Button variant="outline" className="lpBtn">
                Start Free
              </Button>
            </Link>
            <Link to="/pricing">
              <Button variant="outline" className="lpBtn">
                View Plans
              </Button>
            </Link>
          </div>

          <div className="lpMicro">Built for independent pros on web + app.</div>
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

      <section className="lpPricing">
        <div className="lpPricingInner">
          <div className="lpPricingHead">
            <h2 className="lpH2">Simple pricing for professionals.</h2>
            <div className="lpSub">Choose what fits your workflow.</div>
            <div className="lpCounter lpCounterTop">
              {loadingFounder ? "Founder spots left" : `${founderLeft} Founder spots left`}
            </div>
          </div>

          <div className="lpGrid lpGrid4">
            <Card className="lpPriceCard lpPlanCard">
              <div className="lpTier">Free</div>
              <div className="lpPriceLine">
                <span className="lpPrice">$0</span>
              </div>

              <ul className="lpList">
                <li>✓ Pro profile + shareable booking link</li>
                <li>✓ Unlimited booking requests</li>
                <li>✓ Accept up to 20 bookings per month</li>
                <li>✓ Optional deposits</li>
                <li>✓ Basic scheduling + booking management</li>
              </ul>

              <Link to="/pricing" className="lpChooseWrap">
                <Button variant="outline" className="lpChoose">
                  Start Free
                </Button>
              </Link>
            </Card>

            <Card className="lpPriceCard lpPlanCard">
              <div className="lpTier">Starter</div>
              <div className="lpPriceLine">
                <span className="lpPrice">$9.99</span>
                <span className="lpTerm">/month</span>
              </div>

              <ul className="lpList">
                <li>✓ Everything in Free</li>
                <li>✓ Unlimited accepted bookings</li>
                <li>✓ Better booking controls</li>
                <li>✓ Service menu (durations + pricing)</li>
                <li>✓ Client notes + simple organization</li>
              </ul>

              <Link to="/pricing" className="lpChooseWrap">
                <Button variant="outline" className="lpChoose">
                  Choose Starter
                </Button>
              </Link>
            </Card>

            <Card className="lpPriceCard lpPlanCard lpFeatured">
              <div className="lpTier">Pro</div>
              <div className="lpPriceLine">
                <span className="lpPrice">$14.99</span>
                <span className="lpTerm">/month</span>
              </div>

              <ul className="lpList">
                <li>✓ Everything in Starter</li>
                <li>✓ Optional deposits and optional full prepay</li>
                <li>✓ Advanced scheduling rules (buffers, availability windows, etc.)</li>
                <li>✓ Portfolio/service photos</li>
                <li>✓ Stronger branding + customization</li>
                <li>✓ Instant payout option (fee applies)</li>
              </ul>

              <Link to="/pricing" className="lpChooseWrap">
                <Button variant="outline" className="lpChoose">
                  Choose Pro
                </Button>
              </Link>
            </Card>

            <Card className="lpPriceCard lpPlanCard">
              <div className="lpTier">Founder</div>
              <div className="lpPriceLine">
                <span className="lpPrice">$99</span>
                <span className="lpTerm">/year</span>
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
                {loadingFounder ? (
                  "Checking founder spots..."
                ) : (
                  <>
                    <strong>{founderLeft}</strong> Founder spots left
                  </>
                )}
              </div>

              <ul className="lpList">
                <li>✓ Everything in Pro</li>
                <li>✓ Founder pricing locked while active</li>
                <li>✓ Founder badge + early feature access</li>
                <li>✓ Priority support</li>
                <li>✓ Best long-term value</li>
              </ul>

              <Link to="/pricing" className="lpChooseWrap">
                <Button variant="outline" className="lpChoose">
                  Choose Founder
                </Button>
              </Link>
            </Card>
          </div>

          <div className="lpFooterLine">
            <div className="lpFooterBig">
              {loadingFounder ? "Founder spots left" : `${founderLeft} Founder spots left`}
            </div>
            <div className="lpFooterSmall">
              Active means your paid subscription is in good standing.
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
