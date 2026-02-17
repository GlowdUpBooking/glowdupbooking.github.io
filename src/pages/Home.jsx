import { Link } from "react-router-dom";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";

export default function Home() {
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
            <Link className="lpNavBtn" to="/login">
              Sign In <span className="lpArrow">→</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Collage Strip */}
      <section className="lpHero">
        <div className="lpHeroStrip" aria-hidden="true">
          <div className="lpHeroImg lpHeroImg1" />
          <div className="lpHeroImg lpHeroImg2" />
          <div className="lpHeroImg lpHeroImg3" />
          <div className="lpHeroImg lpHeroImg4" />
        </div>

        <div className="lpHeroInner">
          <h1 className="lpH1">
            Your Bookings. Your Brand.
            <br />
            Your Clients.
          </h1>

          <p className="lpLead">
            Glow’d Up Booking is a premium booking platform made for professionals—
            tattoo artists, barbers, stylists, nail techs, and more. Share your link,
            collect deposits, and manage your schedule without marketplace noise.
          </p>

          <div className="lpHeroBtns">
            <Link to="/pricing">
              <Button variant="outline" className="lpBtn">
                Get Early Access (Pro)
              </Button>
            </Link>
            <Link to="/pricing">
              <Button variant="outline" className="lpBtn">
                See How It Works
              </Button>
            </Link>
            <Link to="/pricing">
              <Button variant="outline" className="lpBtn">
                View pricing
              </Button>
            </Link>
          </div>

          <div className="lpMicro">
            Pro-first launch · Invite-only booking · Clients book through your link
          </div>
        </div>
      </section>

      {/* Pricing Preview (same as screenshot) */}
      <section className="lpPricing">
        <div className="lpPricingInner">
          <div className="lpPricingHead">
            <h2 className="lpH2">Simple pricing for professionals.</h2>
            <div className="lpSub">Choose what fits your workflow.</div>
          </div>

          <div className="lpGrid">
            {/* Starter */}
            <Card className="lpPriceCard">
              <div className="lpTier">Tier 1 — Starter</div>
              <div className="lpPriceLine">
                <span className="lpPrice">$9.99</span>
                <span className="lpTerm">/month</span>
              </div>

              <ul className="lpList">
                <li>✓ Pro profile + booking link</li>
                <li>✓ Add services (name, price, duration)</li>
                <li>✓ Basic scheduling + booking requests</li>
                <li>✓ Clients book through your link</li>
              </ul>

              <Link to="/pricing" className="lpChooseWrap">
                <Button variant="outline" className="lpChoose">
                  Choose Starter
                </Button>
              </Link>
            </Card>

            {/* Pro (Featured) */}
            <Card className="lpPriceCard lpFeatured">
              <div className="lpTier">Tier 2 • Pro (Featured)</div>
              <div className="lpPriceLine">
                <span className="lpPrice">$14.99</span>
                <span className="lpTerm">/month</span>
              </div>

              <ul className="lpList">
                <li>✓ Everything in Starter</li>
                <li>✓ Priority placement (later when you open marketplace)</li>
                <li>✓ Advanced scheduling tools (availability rules, buffers, etc.)</li>
                <li>✓ Deposits + booking controls</li>
                <li>✓ Portfolio/service photos</li>
                <li>✓ Better customization + branding</li>
              </ul>

              <Link to="/pricing" className="lpChooseWrap">
                <Button variant="outline" className="lpChoose">
                  Choose Pro
                </Button>
              </Link>
            </Card>

            {/* Founder */}
            <Card className="lpPriceCard">
              <div className="lpTier">Tier 3 • Founder (Annual)</div>
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
                First 1,000 Pros lock in <strong>$99/year</strong> forever.{" "}
                <span className="lpFounderWarn">Don’t miss out</span>
              </div>

              <ul className="lpList">
                <li>✓ Everything in Pro</li>
                <li>✓ Locked-in annual price (best deal)</li>
                <li>✓ Founder badge + early feature access</li>
                <li>✓ Priority support</li>
              </ul>

              <Link to="/pricing" className="lpChooseWrap">
                <Button variant="outline" className="lpChoose">
                  Choose Founder
                </Button>
              </Link>
            </Card>
          </div>

          <div className="lpFooterLine">
            <div className="lpFooterBig">Founder spots left ~ Only 1,000 nationwide</div>
            <div className="lpFooterSmall">
              First 1,000 Pros lock in $99/year forever. Don’t miss out.
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}