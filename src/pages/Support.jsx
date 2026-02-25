import { Link } from "react-router-dom";
import Card from "../components/ui/Card";
import { trackEvent } from "../lib/analytics";
import { getSignupPath } from "../lib/siteFlags";

const SUPPORT_EMAIL = "glowdupbooking@gmail.com";

const SUPPORT_CARDS = [
  {
    title: "Contact support",
    lead: `Email us at ${SUPPORT_EMAIL}. We respond within 2 to 5 business days.`,
    items: [
      "Include your account email",
      "Share the client name + appointment time",
      "Tell us your device + app version",
    ],
    cta: { label: "Email support", href: `mailto:${SUPPORT_EMAIL}` },
  },
  {
    title: "Bookings + deposits",
    lead: "Need help with booking links or deposit settings? We can help.",
    items: [
      "Booking link missing times",
      "Deposit amount not applying",
      "Reschedule or cancel rules",
    ],
  },
  {
    title: "Account + subscription",
    lead: "Login, profile, and plan settings for pros.",
    items: [
      "Reset password or update email",
      "Change plan or billing details",
      "Account deletion requests",
    ],
  },
  {
    title: "Payouts + timing",
    lead: "Help with Stripe onboarding, payouts, or payment issues.",
    items: [
      "Stripe onboarding or verification",
      "Payout status or delays",
      "Refund questions",
    ],
  },
];

const FAQ_ITEMS = [
  {
    q: "How do I delete my account?",
    a: "In the app, go to Profile > Settings > Delete Account. If you cannot access the app, email support for help.",
  },
  {
    q: "How do deposits work for pros?",
    a: "Deposits are collected at booking and applied toward the total service price. You control deposit rules per service.",
  },
  {
    q: "How do payouts work?",
    a: "Payouts are handled through Stripe. You can view payout status in your Stripe dashboard once connected.",
  },
  {
    q: "Why can’t I sign in?",
    a: "Double-check your email and password. If you forgot your password, use the reset link on the sign-in screen.",
  },
];

export default function Support() {
  const signupPath = getSignupPath();

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
            <Link
              className="lpNavBtn lpNavBtnSecondary"
              to="/pricing#plans"
              onClick={() => trackEvent("nav_click", { page: "support", cta: "pricing" })}
            >
              Pricing
            </Link>
            <Link
              className="lpNavBtn lpNavBtnSecondary"
              to="/login"
              onClick={() => trackEvent("nav_click", { page: "support", cta: "sign_in" })}
            >
              Sign In
            </Link>
            <Link
              className="lpNavBtn"
              to={signupPath}
              onClick={() => trackEvent("cta_click", { page: "support", cta: "start_free_nav" })}
            >
              Start Free <span className="lpArrow">→</span>
            </Link>
          </div>
        </div>
      </header>

      <section className="lpHero lpReveal">
        <div className="lpHeroInner">
          <h1 className="lpH1">Support</h1>
          <p className="lpLead">
            Pro support for bookings, deposits, payouts, and subscriptions.
          </p>

          <div className="lpHeroBtns">
            <a className="lpNavBtn" href={`mailto:${SUPPORT_EMAIL}`}>
              Email Support
            </a>
            <Link className="lpNavBtn lpNavBtnSecondary" to="/">
              Back to Home
            </Link>
          </div>

          <div className="lpTrustRow">
            <span>Response within 2 to 5 business days</span>
            <span>Dedicated pro support</span>
          </div>
        </div>
      </section>

      <section className="lpPricing lpReveal lpSectionLazy">
        <div className="lpPricingInner">
          <div className="lpPricingHead">
            <h2 className="lpH2">How we can help</h2>
            <p className="lpSub">Include as much detail as you can so we can resolve it quickly.</p>
          </div>

          <div className="lpGrid">
            {SUPPORT_CARDS.map((card) => (
              <Card key={card.title} className="lpPriceCard">
                <div className="lpTier" style={{ fontWeight: 900, opacity: 0.95 }}>
                  {card.title}
                </div>
                <div className="lpSub" style={{ marginTop: 8 }}>
                  {card.lead}
                </div>
                <ul className="lpList" style={{ marginTop: 12 }}>
                  {card.items.map((item) => (
                    <li key={item}>✓ {item}</li>
                  ))}
                </ul>
                {card.cta ? (
                  <div className="lpChooseWrap">
                    <a className="lpChoose" href={card.cta.href}>
                      {card.cta.label}
                    </a>
                  </div>
                ) : null}
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="lpPricing lpReveal lpSectionLazy">
        <div className="lpPricingInner">
          <div className="lpPricingHead">
            <h2 className="lpH2">Common questions</h2>
          </div>

          <div className="lpFaqList">
            {FAQ_ITEMS.map((item) => (
              <Card key={item.q} className="lpPriceCard">
                <div className="lpTier" style={{ fontWeight: 900, opacity: 0.95 }}>
                  {item.q}
                </div>
                <div className="lpSub" style={{ marginTop: 8 }}>
                  {item.a}
                </div>
              </Card>
            ))}
          </div>

          <div className="lpFooterLine">
            <div className="lpFooterBig">Glow’d Up Booking Support</div>
            <div className="lpFooterSmall">Email {SUPPORT_EMAIL}</div>
          </div>
        </div>
      </section>
    </div>
  );
}
