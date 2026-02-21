import { useEffect, useMemo, useState } from "react";
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

const METRICS = [
  { value: "< 10 min", label: "Average setup" },
  { value: "24/7", label: "Booking availability" },
  { value: "Same day", label: "Fast payout option" },
];

const TESTIMONIALS = [
  {
    name: "Maya R.",
    role: "Braider · Dallas",
    quote: "The booking flow feels premium, and deposits cut my no-shows right away.",
  },
  {
    name: "Jules K.",
    role: "Barber · Atlanta",
    quote: "Setup was fast. My clients book cleaner and I spend less time texting slots.",
  },
  {
    name: "Nia T.",
    role: "Nail Tech · Houston",
    quote: "Branding + booking links make me look more established than social DMs ever did.",
  },
];

const PREVIEW_TABS = [
  {
    id: "book",
    title: "How clients book",
    subtitle: "Clean flow from service pick to confirmation",
    points: ["Pick service and time", "Pay deposit or prepay", "Instant confirmation + reminders"],
  },
  {
    id: "manage",
    title: "How pros manage day",
    subtitle: "Everything in one dashboard",
    points: ["Calendar + buffers", "Client notes and history", "Smart availability rules"],
  },
  {
    id: "payout",
    title: "How payouts work",
    subtitle: "Clear processing with optional instant payout",
    points: ["Stripe-secured payments", "Transparent payout timing", "Instant payout when needed"],
  },
];

function relativeUpdate(ts) {
  if (!ts) return "Updated recently";
  const mins = Math.max(0, Math.floor((Date.now() - ts) / 60000));
  if (mins < 1) return "Updated just now";
  if (mins === 1) return "Updated 1 min ago";
  if (mins < 60) return `Updated ${mins} mins ago`;
  return "Updated today";
}

export default function Home() {
  const [founderLeft, setFounderLeft] = useState(1000);
  const [loadingFounder, setLoadingFounder] = useState(true);
  const [updatedAt, setUpdatedAt] = useState(null);
  const [activeTab, setActiveTab] = useState("book");

  const activePreview = useMemo(
    () => PREVIEW_TABS.find((tab) => tab.id === activeTab) || PREVIEW_TABS[0],
    [activeTab]
  );

  useEffect(() => {
    let mounted = true;

    const preload = ["/assets/hero-1.jpg", "/assets/hero-2.jpg", "/assets/hero-3.jpg", "/assets/hero-4.jpg"];
    const links = preload.map((href) => {
      const link = document.createElement("link");
      link.rel = "preload";
      link.as = "image";
      link.href = href;
      document.head.appendChild(link);
      return link;
    });

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
        setUpdatedAt(Date.now());
        setLoadingFounder(false);
      }
    }

    loadFounderLeft();

    return () => {
      mounted = false;
      links.forEach((link) => link.remove());
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
            <Link className="lpNavBtn lpNavBtnSecondary" to="/pricing#plans">
              Pricing
            </Link>
            <Link className="lpNavBtn lpNavBtnSecondary" to="/login">
              Sign In
            </Link>
            <Link className="lpNavBtn" to="/signup">
              Start Free <span className="lpArrow">→</span>
            </Link>
          </div>
        </div>
      </header>

      <section className="lpHero lpReveal">
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
            <Link to="/signup">
              <Button variant="outline" className="lpBtn">
                Start Free
              </Button>
            </Link>
            <Link to="/pricing#plans">
              <Button variant="outline" className="lpBtn">
                View Plans
              </Button>
            </Link>
          </div>

          <div className="lpTrustRow">
            <span>No booking fees</span>
            <span>Stripe-secured payments</span>
            <span>Cancel anytime</span>
          </div>

          <div className={`lpLiveChip ${loadingFounder ? "is-loading" : ""}`}>
            {loadingFounder ? "Loading founder availability..." : `${founderLeft} Founder spots left`} · {relativeUpdate(updatedAt)}
          </div>
        </div>
      </section>

      <section className="lpWhy lpReveal lpSectionLazy">
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

      <section className="lpPricing lpReveal lpSectionLazy">
        <div className="lpPricingInner">
          <div className="lpMetricsGrid">
            {METRICS.map((m) => (
              <Card className="lpMetricCard" key={m.label}>
                <div className="lpMetricValue">{m.value}</div>
                <div className="lpMetricLabel">{m.label}</div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="lpPricing lpReveal lpSectionLazy">
        <div className="lpPricingInner">
          <div className="lpPricingHead">
            <h2 className="lpH2">See The Booking Flow</h2>
            <div className="lpSub">Interactive product preview</div>
          </div>

          <div className="lpTabs" role="tablist" aria-label="Product preview tabs">
            {PREVIEW_TABS.map((tab) => (
              <button
                key={tab.id}
                className={`lpTab ${activeTab === tab.id ? "is-active" : ""}`}
                onClick={() => setActiveTab(tab.id)}
                role="tab"
                aria-selected={activeTab === tab.id}
              >
                {tab.title}
              </button>
            ))}
          </div>

          <Card className="lpPreviewCard">
            <div className="lpPreviewHeader">
              <h3>{activePreview.title}</h3>
              <p>{activePreview.subtitle}</p>
            </div>
            <div className="lpPreviewBody">
              <div className="lpPreviewPhone" aria-hidden="true">
                <div className="lpPreviewTopBar" />
                <div className="lpPreviewLine lg" />
                <div className="lpPreviewLine" />
                <div className="lpPreviewLine" />
                <div className="lpPreviewPill" />
              </div>
              <ul className="lpList lpPreviewList">
                {activePreview.points.map((point) => (
                  <li key={point}>✓ {point}</li>
                ))}
              </ul>
            </div>
          </Card>
        </div>
      </section>

      <section className="lpPricing" id="plans">
        <div className="lpPricingInner">
          <div className="lpPricingHead">
            <h2 className="lpH2">Simple pricing for professionals.</h2>
            <div className="lpSub">Choose what fits your workflow.</div>
            <div className={`lpCounter lpCounterTop ${loadingFounder ? "lpSkeleton" : ""}`}>
              {loadingFounder ? "Founder spots left" : `${founderLeft} Founder spots left`}
            </div>
          </div>

          <div className="lpGrid lpGrid4">
            <Card className="lpPriceCard lpPlanCard lpReveal" style={{ animationDelay: "0ms" }}>
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

              <Link to="/pricing#plans" className="lpChooseWrap">
                <Button variant="outline" className="lpChoose">
                  Start Free
                </Button>
              </Link>
            </Card>

            <Card className="lpPriceCard lpPlanCard lpReveal" style={{ animationDelay: "70ms" }}>
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

              <Link to="/pricing#plans" className="lpChooseWrap">
                <Button variant="outline" className="lpChoose">
                  Choose Starter
                </Button>
              </Link>
            </Card>

            <Card className="lpPriceCard lpPlanCard lpFeatured lpReveal" style={{ animationDelay: "140ms" }}>
              <div className="lpTierRow">
                <div className="lpTier">Pro</div>
                <div className="lpBadge">Most chosen</div>
              </div>
              <div className="lpPriceLine">
                <span className="lpPrice">$14.99</span>
                <span className="lpTerm">/month</span>
              </div>

              <ul className="lpList">
                <li>✓ Everything in Starter</li>
                <li>✓ Optional deposits and optional full prepay</li>
                <li>✓ Advanced scheduling rules</li>
                <li>✓ Portfolio/service photos</li>
                <li>✓ Stronger branding + customization</li>
                <li>✓ Instant payout option (fee applies)</li>
              </ul>

              <Link to="/pricing#plans" className="lpChooseWrap">
                <Button variant="outline" className="lpChoose">
                  Choose Pro
                </Button>
              </Link>
            </Card>

            <Card className="lpPriceCard lpPlanCard lpReveal" style={{ animationDelay: "210ms" }}>
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

              <div className="lpFounderText">First 1,000 pros only. Lock in the best price while you stay active.</div>

              <div className={`lpCounter ${loadingFounder ? "lpSkeleton" : ""}`}>
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

              <Link to="/pricing#plans" className="lpChooseWrap">
                <Button variant="outline" className="lpChoose">
                  Choose Founder
                </Button>
              </Link>
            </Card>
          </div>
        </div>
      </section>

      <section className="lpPricing lpReveal lpSectionLazy">
        <div className="lpPricingInner">
          <div className="lpPricingHead">
            <h2 className="lpH2">What Pros Say</h2>
          </div>
          <div className="lpTestimonialGrid">
            {TESTIMONIALS.map((t) => (
              <Card className="lpTestimonialCard" key={t.name}>
                <p className="lpQuote">“{t.quote}”</p>
                <div className="lpTestimonialMeta">
                  <strong>{t.name}</strong>
                  <span>{t.role}</span>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
