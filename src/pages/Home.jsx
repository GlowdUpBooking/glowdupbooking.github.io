// src/pages/Home.jsx
import { Link } from "react-router-dom";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import PaywallBanner from "../components/Pricing/PaywallBanner";

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
            <a className="lpNavLink" href="#plans">
              Plans
            </a>
            <Link className="lpNavLink" to="/signup">
              Create account
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
            Glow’d Up Booking is a premium booking platform made for professionals— tattoo artists,
            barbers, stylists, nail techs, and more. Share your link, collect deposits, and manage
            your schedule without marketplace noise.
          </p>

          <div className="lpHeroBtns">
            <Link to="/signup">
              <Button variant="outline" className="lpBtn">
                Get Early Access (Pro)
              </Button>
            </Link>
            <a href="#plans">
              <Button variant="outline" className="lpBtn">
                See Plans
              </Button>
            </a>
            <Link to="/login">
              <Button variant="outline" className="lpBtn">
                Sign in
              </Button>
            </Link>
          </div>

          <div className="lpMicro">
            Pro-first launch · Invite-only booking · Clients book through your link
          </div>
        </div>
      </section>

      {/* Plans */}
      <section id="plans" className="lpPricing">
        <div className="lpPricingInner">
          <div className="lpPricingHead">
            <h2 className="lpH2">Simple pricing for professionals.</h2>
            <div className="lpSub">Choose what fits your workflow.</div>
          </div>

          {/* ✅ Counter / founder availability (this is what was missing) */}
          <PaywallBanner />

          <div className="lpGrid">
            {/* Starter */}
            <Card className="lpPriceCard">
              <div className="lpTier">Starter</div>
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

              <Link to="/signup" className="lpChooseWrap">
                <Button variant="outline" className="lpChoose">
                  Create account
                </Button>
              </Link>
            </Card>

            {/* Pro (Featured) */}
            <Card className="lpPriceCard lpFeatured">
              <div className="lpTier">Pro (Featured)</div>
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

              <Link to="/signup" className="lpChooseWrap">
                <Button variant="outline" className="lpChoose">
                  Create account
                </Button>
              </Link>
            </Card>

            {/* Founder */}
            <Card className="lpPriceCard">
              <div className="lpTier">Founder (Annual)</div>
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

              <Link to="/signup" className="lpChooseWrap">
                <Button variant="outline" className="lpChoose">
                  Create account
                </Button>
              </Link>
            </Card>
          </div>
        </div>
      </section>
    </div>
  );
}