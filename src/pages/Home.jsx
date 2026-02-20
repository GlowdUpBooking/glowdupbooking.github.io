// src/pages/Home.jsx
import React from "react";
import { Link } from "react-router-dom";
import Card from "../components/ui/Card";
import "../styles/landing.css";

const founderTotal = 1000;
const founderClaimed = 5; // TODO: wire to real number later
const founderLeft = Math.max(0, founderTotal - founderClaimed);
const founderPct = Math.min(100, Math.max(0, (founderClaimed / founderTotal) * 100));

function buildSignupUrl(plan) {
  const next = encodeURIComponent("/onboarding");
  const p = encodeURIComponent(plan);
  return `/signup?plan=${p}&next=${next}`;
}

export default function Home() {
  return (
    <div className="lp">
      {/* Top Nav */}
      <header className="lpNav">
        <div className="lpNavInner">
          <Link className="lpBrand" to="/">
            <span className="lpBrandStrong">Glow’d Up</span>{" "}
            <span className="lpBrandLight">Booking</span>
          </Link>

          <nav className="lpNavRight">
            <Link className="lpNavLink" to="/pricing">
              Plans
            </Link>
            <Link className="lpNavLink" to={buildSignupUrl("free")}>
              Create account
            </Link>
            <Link className="lpNavBtn" to="/login">
              Sign In <span className="lpArrow">→</span>
            </Link>
          </nav>
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
          <div className="lpKicker">FOR BEAUTY PROS • CLIENT BOOKING COMING SOON</div>

          <h1 className="lpH1">Your Bookings. Your Brand. Your Clients.</h1>

          <p className="lpLead">
            Glow’d Up Booking is a premium booking platform made for professionals — barbers,
            stylists, tattoo artists, nail techs, and more. Share your link, collect deposits, and
            manage your schedule without marketplace noise.
          </p>

          <div className="lpHeroBtns">
            <Link className="lpBtn lpBtnPrimary" to={buildSignupUrl("free")}>
              Start Free
            </Link>
            <Link className="lpBtn lpBtnGhost" to="/pricing">
              See Plans
            </Link>
            <Link className="lpBtn lpBtnGhost" to="/login">
              Sign in
            </Link>
          </div>

          <div className="lpMicro">Start free • Upgrade when you’re ready • Clients book through your link</div>
        </div>
      </section>

      {/* Pricing Preview */}
      <section className="lpPricing" id="plans">
        <div className="lpPricingInner">
          <div className="lpPricingHead">
            <h2 className="lpH2">Pro plans built for growth.</h2>
            <div className="lpSub">
              No booking fee to pros. You earn on deposits / prepay + optional instant payout fees.
            </div>
          </div>

          {/* Founder progress */}
          <div className="lpFounderBar" role="group" aria-label="Founder spots progress">
            <div className="lpFounderTop">
              <div className="lpFounderTitle">
                Founder spots left: <span className="lpFounderEm">{founderLeft}</span> of {founderTotal}
              </div>
              <div className="lpFounderRule">First {founderTotal} pros lock in $99/year while active.</div>
            </div>
            <div className="lpProgressTrack" aria-hidden="true">
              <div className="lpProgressFill" style={{ width: `${founderPct}%` }} />
            </div>
          </div>

          <div className="lpGrid lpGrid4">
            {/* FREE */}
            <Card className="lpPriceCard">
              <div className="lpTierRow">
                <div className="lpTier">Free</div>
                <div className="lpChip">Try it</div>
              </div>

              <div className="lpPriceLine">
                <div className="lpPrice">$0</div>
                <div className="lpTerm">/month</div>
              </div>

              <div className="lpMiniDesc">For new pros testing the platform.</div>

              <div className="lpSectionTitle">Bookings</div>
              <ul className="lpList">
                <li>Unlimited booking requests</li>
                <li>
                  <b>20</b> accepted bookings per month (resets on the 1st)
                </li>
              </ul>

              <div className="lpSectionTitle">Payments</div>
              <ul className="lpList">
                <li>Deposit optional ✅ (per service)</li>
                <li>Full prepay not allowed ❌</li>
              </ul>

              <div className="lpSectionTitle">Payout</div>
              <ul className="lpList">
                <li>Standard payouts only</li>
                <li>No instant payout tools</li>
              </ul>

              <div className="lpSectionTitle">Tools</div>
              <ul className="lpList">
                <li>Basic profile + services + booking link</li>
                <li>Basic availability / calendar</li>
                <li>Basic client management</li>
              </ul>

              <div className="lpFine">
                <div className="lpFineTitle">Monetization</div>
                Deposits run through Stripe — you take your platform cut. No booking fees charged to pros.
              </div>

              <Link className="lpChooseWrap" to={buildSignupUrl("free")}>
                <span className="lpChooseBtn">Start Free</span>
              </Link>
            </Card>

{/* PRO */}
            <Card className="lpPriceCard">
              <div className="lpTierRow">
                <div className="lpTier">Pro</div>
                <div className="lpChip">Popular</div>
              </div>

              <div className="lpPriceLine">
                <div className="lpPrice">$24.99</div>
                <div className="lpTerm">/month</div>
              </div>

              <div className="lpMiniDesc">Same feature set as Founder Pro (normal pricing).</div>

              <div className="lpSectionTitle">Includes</div>
              <ul className="lpList">
                <li>Unlimited accepted bookings</li>
                <li>Deposit optional ✅</li>
                <li>Full prepay optional ✅</li>
                <li>Instant payout option ✅ (fee applies)</li>
                <li>Advanced controls + customization</li>
              </ul>

              <Link className="lpChooseWrap" to={buildSignupUrl("pro")}>
                <span className="lpChooseBtn">Choose Pro</span>
              </Link>
            </Card>

            
            {/* FOUNDER */}
            <Card className="lpPriceCard lpFeatured">
              <div className="lpTierRow">
                <div className="lpTier">Founder Pro</div>
                <div className="lpChip">Limited</div>
              </div>

              <div className="lpPriceLine">
                <div className="lpPrice">$99</div>
                <div className="lpTerm">/year</div>
              </div>

              <div className="lpMiniDesc">Early adopters. Locked price while you stay active.</div>

              <div className="lpSectionTitle">Bookings</div>
              <ul className="lpList">
                <li>Unlimited accepted bookings (no cap)</li>
              </ul>

              <div className="lpSectionTitle">Payments</div>
              <ul className="lpList">
                <li>Deposit optional ✅</li>
                <li>Full prepay optional ✅</li>
              </ul>

              <div className="lpSectionTitle">Payout</div>
              <ul className="lpList">
                <li>Standard payouts ✅</li>
                <li>Instant payout available ✅ (extra fee)</li>
              </ul>

              <div className="lpSectionTitle">Tools</div>
              <ul className="lpList">
                <li>Everything in Free</li>
                <li>More customization + better insights</li>
                <li>Priority support</li>
              </ul>

              <div className="lpFine">
                <div className="lpFineTitle">Founder lock</div>
                Only available until 1,000 claimed. If your membership lapses for more than 7 days,
                Founder pricing can’t be reclaimed.
              </div>

              <Link className="lpChooseWrap" to={buildSignupUrl("founder")}>
                <span className="lpChooseBtn">Claim Founder</span>
              </Link>

              <div className="lpTinyNote">{founderLeft} Founder spots left</div>
            </Card>


            {/* STUDIO / TEAM (ONLY AFTER FOUNDER SELLS OUT) */}
            {founderLeft === 0 && (
              <Card className="lpPriceCard">
                <div className="lpTierRow">
                  <div className="lpTier">Studio / Team</div>
                  <div className="lpChip">Teams</div>
                </div>

                <div className="lpPriceLine">
                  <div className="lpPrice">$49.99</div>
                  <div className="lpTerm">/month</div>
                </div>

                <div className="lpMiniDesc">For shops, shared suites, and teams.</div>

                <div className="lpSectionTitle">Seats</div>
                <ul className="lpList">
                  <li>Includes up to 3 members</li>
                  <li>+ $10/month per additional member</li>
                </ul>

                <div className="lpSectionTitle">Includes</div>
                <ul className="lpList">
                  <li>Everything in Pro</li>
                  <li>Team seats / roles</li>
                  <li>Shared calendar + staff assignment (rolling out)</li>
                  <li>Stronger analytics + controls</li>
                </ul>

                <Link className="lpChooseWrap" to={buildSignupUrl("studio")}>
                  <span className="lpChooseBtn">Choose Studio</span>
                </Link>
              </Card>
            )}
          </div>

          <div className="lpFootnotes">
            <div>• Free accepted booking cap resets on the 1st of every month.</div>
            <div>• Free tier cannot take full payment upfront.</div>
            <div>• Deposits can be optional for everyone.</div>
            <div>• No booking fees to pros — platform earns on deposits/prepay + instant payout fees.</div>
          </div>
        </div>
      </section>
    </div>
  );
}