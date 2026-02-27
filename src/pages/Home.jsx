import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import { getFounderSpotsLeft } from "../lib/foundingOffer";
import { trackEvent } from "../lib/analytics";
import { getSignupPath } from "../lib/siteFlags";

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

const FAQS = [
  {
    q: "Is it free to get started?",
    a: "Yes. The Free plan requires no credit card. You get a booking link, up to 5 services, and up to 20 bookings per month at no cost.",
  },
  {
    q: "Do my clients need to create an account?",
    a: "No. Clients book directly through your link without signing up for anything.",
  },
  {
    q: "How do deposits work?",
    a: "Deposits are collected from the client at the time of booking through Stripe. The funds are paid out to your connected Stripe account on your standard payout schedule.",
  },
  {
    q: "How fast do I get paid?",
    a: "Standard payouts arrive the next business day. An instant payout option is also available when you need funds sooner — the fee is shown before you confirm.",
  },
  {
    q: "What payment methods do clients use?",
    a: "All major credit and debit cards are accepted through Stripe. No additional setup required on your end.",
  },
  {
    q: "Can I cancel my plan anytime?",
    a: "Yes. No contracts, no lock-in. You can upgrade, downgrade, or cancel from your dashboard at any time.",
  },
  {
    q: "Do I need a website or technical experience?",
    a: "No. You get a ready-to-share booking link. Paste it in your Instagram bio, send it in a DM, or add it anywhere. No website or coding required.",
  },
  {
    q: "What is the Founder plan?",
    a: "The Founder plan is available to the first 500 pros at $99/year. It includes everything in Pro with your price locked for as long as the plan stays active.",
  },
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
    flow: [
      {
        label: "Step 1",
        title: "Choose service",
        detail: "Starter Loc Retwist · 75 min · $85",
        tags: ["Mobile + web", "Realtime availability"],
        cta: "Continue",
      },
      {
        label: "Step 2",
        title: "Pick time + pay deposit",
        detail: "Sat 2:30 PM · $20 deposit today",
        tags: ["Secure checkout", "Stripe-powered"],
        cta: "Confirm booking",
      },
      {
        label: "Step 3",
        title: "Booked instantly",
        detail: "Receipt + reminder sent. Client sees confirmation right away.",
        tags: ["SMS reminder", "Calendar updated"],
        cta: "View confirmation",
      },
    ],
  },
  {
    id: "manage",
    title: "How pros manage day",
    subtitle: "Everything in one dashboard",
    points: ["Calendar + buffers", "Client notes and history", "Smart availability rules"],
    flow: [
      {
        label: "Step 1",
        title: "Today at a glance",
        detail: "6 bookings today · 1 gap at 3:15 PM",
        tags: ["Auto buffers", "No-overlap rules"],
        cta: "Open calendar",
      },
      {
        label: "Step 2",
        title: "Client details ready",
        detail: "Past services, notes, and no-show risk shown before check-in.",
        tags: ["Client history", "Quick notes"],
        cta: "Open profile",
      },
      {
        label: "Step 3",
        title: "Smart schedule updates",
        detail: "Shift hours and breaks once. Booking windows update everywhere.",
        tags: ["One update syncs all", "Live booking link"],
        cta: "Update availability",
      },
    ],
  },
  {
    id: "payout",
    title: "How payouts work",
    subtitle: "Clear processing with optional instant payout",
    points: ["Stripe-secured payments", "Transparent payout timing", "Instant payout when needed"],
    flow: [
      {
        label: "Step 1",
        title: "Payment captured",
        detail: "Deposit and prepay charges post to your Stripe-connected account.",
        tags: ["PCI handled", "Clear fee breakdown"],
        cta: "View transaction",
      },
      {
        label: "Step 2",
        title: "Payout scheduled",
        detail: "Standard payout ETA: next business day.",
        tags: ["Daily summary", "Revenue snapshot"],
        cta: "See payout timeline",
      },
      {
        label: "Step 3",
        title: "Need funds now?",
        detail: "Use Instant Payout when available. Fee is shown before confirm.",
        tags: ["Optional instant payout", "No surprises"],
        cta: "Run instant payout",
      },
    ],
  },
];

export default function Home() {
  const signupPath = getSignupPath();
  const [founderLeft, setFounderLeft] = useState(500);
  const [loadingFounder, setLoadingFounder] = useState(true);
  const [activeTab, setActiveTab] = useState("book");
  const [activeStep, setActiveStep] = useState(0);
  const [openFaq, setOpenFaq] = useState(null);

  const activePreview = useMemo(
    () => PREVIEW_TABS.find((tab) => tab.id === activeTab) || PREVIEW_TABS[0],
    [activeTab]
  );
  const showFounderPlan = loadingFounder || founderLeft > 0;
  const activeFlow = activePreview.flow || [];
  const activeFlowStep = activeFlow[activeStep] || activeFlow[0];

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
        setFounderLeft(typeof left === "number" ? left : 500);
      } catch {
        if (!mounted) return;
        setFounderLeft(500);
      } finally {
        if (mounted) setLoadingFounder(false);
      }
    }

    loadFounderLeft();

    return () => {
      mounted = false;
      links.forEach((link) => link.remove());
    };
  }, []);

  // Scroll-triggered reveals
  useEffect(() => {
    const hero = document.querySelector(".lpHero");
    if (hero) hero.classList.add("is-visible");

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1, rootMargin: "0px 0px -40px 0px" }
    );

    document.querySelectorAll(".lpReveal:not(.lpHero)").forEach((el) => {
      observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  // Nav darken on scroll
  useEffect(() => {
    const nav = document.querySelector(".lpNav");
    const onScroll = () => nav?.classList.toggle("is-scrolled", window.scrollY > 30);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setActiveStep(0);
  }, [activeTab]);

  useEffect(() => {
    if (!activeFlow.length) return undefined;
    const timer = window.setInterval(() => {
      setActiveStep((curr) => (curr + 1) % activeFlow.length);
    }, 2600);
    return () => window.clearInterval(timer);
  }, [activeFlow.length, activeTab]);

  return (
    <div className="lp">
      <header className="lpNav">
        <div className="lpNavInner">
          <Link className="lpBrand" to="/">
            <img className="lpBrandLogo" src="/assets/logo.png" alt="Glow&apos;d Up Booking logo" />
            <span className="lpBrandStrong">Glow’d Up</span>
            <span className="lpBrandLight"> Booking</span>
          </Link>

          <div className="lpNavRight">
            <Link
              className="lpNavBtn lpNavBtnSecondary"
              to="/pricing#plans"
              onClick={() => trackEvent("nav_click", { page: "home", cta: "pricing" })}
            >
              Pricing
            </Link>
            <Link
              className="lpNavBtn lpNavBtnSecondary"
              to="/login"
              onClick={() => trackEvent("nav_click", { page: "home", cta: "sign_in" })}
            >
              Sign In
            </Link>
            <Link className="lpNavBtn" to={signupPath} onClick={() => trackEvent("cta_click", { page: "home", cta: "start_free_nav" })}>
              Start Free <span className="lpArrow">→</span>
            </Link>
          </div>
        </div>
      </header>

      <section className="lpHero lpReveal">
        <div className="lpHeroInner">
          <div className="lpHeroContent">
            <h1 className="lpH1">Stop managing bookings in your DMs.</h1>

            <p className="lpLead">
              Glow&apos;d Up Booking gives barbers, stylists, tattoo artists, nail techs, and more a
              professional booking link, deposit collection, and client management — all in one place.
            </p>
            <p className="lpLead">Clients book free. Pros pay only for tools and growth.</p>

            <div className="lpHeroBtns">
              <Link to={signupPath} onClick={() => trackEvent("cta_click", { page: "home", cta: "start_free_hero" })}>
                <Button variant="outline" className="lpBtn">
                  Start Free
                </Button>
              </Link>
              <Link to="/pricing#plans" onClick={() => trackEvent("cta_click", { page: "home", cta: "view_plans_hero" })}>
                <Button variant="outline" className="lpBtn">
                  View Plans
                </Button>
              </Link>
            </div>

            <div className="lpTrustRow">
              <span>Stripe-secured payments</span>
              <span>Cancel anytime</span>
            </div>

            <div className={`lpLiveChip ${loadingFounder ? "is-loading" : ""}`}>
              {loadingFounder
                ? "Loading founder availability..."
                : showFounderPlan
                ? `${founderLeft} Founder spots left`
                : "Founder spots filled · Elite now available"}
            </div>
          </div>

          <div className="lpHeroPhotos" aria-hidden="true">
            <div className="lpHeroImg lpHeroImg1" />
            <div className="lpHeroImg lpHeroImg2" />
            <div className="lpHeroImg lpHeroImg3" />
            <div className="lpHeroImg lpHeroImg4" />
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
                onClick={() => {
                  setActiveTab(tab.id);
                  trackEvent("preview_tab_click", { page: "home", tab_id: tab.id });
                }}
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
            <div className="lpPreviewBody" key={activePreview.id}>
              <div className="lpPreviewPhone" aria-hidden="true">
                <div className="lpPreviewTopBar">Glow’d Up Flow</div>
                <div className="lpPreviewScene" key={`${activePreview.id}-${activeStep}`}>
                  <div className="lpPreviewStep">{activeFlowStep?.label}</div>
                  <div className="lpPreviewSceneTitle">{activeFlowStep?.title}</div>
                  <div className="lpPreviewSceneDetail">{activeFlowStep?.detail}</div>
                  <div className="lpPreviewTags">
                    {(activeFlowStep?.tags || []).map((tag) => (
                      <span key={tag} className="lpPreviewTag">
                        {tag}
                      </span>
                    ))}
                  </div>
                  <div className="lpPreviewPill">{activeFlowStep?.cta}</div>
                </div>
                <div className="lpPreviewDots" role="presentation">
                  {activeFlow.map((_, idx) => (
                    <span key={idx} className={`lpPreviewDot ${idx === activeStep ? "is-active" : ""}`} />
                  ))}
                </div>
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
              {loadingFounder
                ? "Founder spots left"
                : showFounderPlan
                ? `${founderLeft} Founder spots left`
                : "Founder spots filled · Elite now available"}
            </div>
          </div>

          <div className="lpGrid lpGrid4">
            <Card className="lpPriceCard lpPlanCard lpReveal" style={{ animationDelay: "0ms" }}>
              <div className="lpTier">Free</div>
              <div className="lpPriceLine">
                <span className="lpPrice">$0</span>
              </div>

              <ul className="lpList">
                <li>✓ Basic booking link</li>
                <li>✓ Up to 5 services</li>
                <li>✓ Up to 20 bookings per month</li>
                <li>✓ No deposits or full prepay</li>
                <li>✓ No service photos</li>
                <li>✓ Basic profile + standard support</li>
              </ul>

              <Link
                to="/pricing#plans"
                className="lpChooseWrap"
                onClick={() => trackEvent("plan_cta_click", { page: "home", plan: "free", cta: "start_free" })}
              >
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
                <li>✓ Unlimited services</li>
                <li>✓ Fixed-amount deposits</li>
                <li>✓ Service photos</li>
                <li>✓ Better booking controls + reminders</li>
                <li>✓ Basic reporting</li>
              </ul>

              <Link
                to="/pricing#plans"
                className="lpChooseWrap"
                onClick={() => trackEvent("plan_cta_click", { page: "home", plan: "starter", cta: "choose_starter" })}
              >
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
                <span className="lpPrice">$19.99</span>
                <span className="lpTerm">/month</span>
              </div>

              <ul className="lpList">
                <li>✓ Everything in Starter</li>
                <li>✓ Advanced deposits + optional full prepay</li>
                <li>✓ Advanced availability/scheduling rules</li>
                <li>✓ Social/payment profile fields (IG/X/Cash App)</li>
                <li>✓ Portfolio/gallery polish</li>
                <li>✓ Higher reporting capability</li>
                <li>✓ Priority support</li>
              </ul>

              <Link
                to="/pricing#plans"
                className="lpChooseWrap"
                onClick={() => trackEvent("plan_cta_click", { page: "home", plan: "pro", cta: "choose_pro" })}
              >
                <Button variant="outline" className="lpChoose">
                  Choose Pro
                </Button>
              </Link>
            </Card>

            {showFounderPlan ? (
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

                <div className="lpFounderText">First 500 pros only. Same feature access as Pro with locked annual pricing.</div>

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

                <Link
                  to="/pricing#plans"
                  className="lpChooseWrap"
                  onClick={() => trackEvent("plan_cta_click", { page: "home", plan: "founder", cta: "choose_founder" })}
                >
                  <Button variant="outline" className="lpChoose">
                    Choose Founder
                  </Button>
                </Link>
              </Card>
            ) : (
              <Card className="lpPriceCard lpPlanCard lpReveal" style={{ animationDelay: "210ms" }}>
                <div className="lpTier">Elite</div>
                <div className="lpPriceLine">
                  <span className="lpPrice">$29.99</span>
                  <span className="lpTerm">/month</span>
                </div>
                <ul className="lpList">
                  <li>✓ Everything in Pro</li>
                  <li>✓ Team/staff workflows</li>
                  <li>✓ +1 member included</li>
                  <li>✓ Additional members +$10 each (max 10 total)</li>
                  <li>✓ Multi-location + advanced business controls</li>
                  <li>✓ Advanced analytics + concierge support</li>
                </ul>
                <Link
                  to="/pricing#plans"
                  className="lpChooseWrap"
                  onClick={() => trackEvent("plan_cta_click", { page: "home", plan: "elite", cta: "choose_elite" })}
                >
                  <Button variant="outline" className="lpChoose">
                    Choose Elite
                  </Button>
                </Link>
              </Card>
            )}
          </div>
        </div>
      </section>

      <section className="lpFaq lpReveal lpSectionLazy" id="faq">
        <div className="lpPricingInner">
          <div className="lpPricingHead">
            <h2 className="lpH2">Common questions</h2>
          </div>
          <ul className="lpFaqList">
            {FAQS.map((item, i) => (
              <li
                key={i}
                className={`lpFaqItem ${openFaq === i ? "is-open" : ""}`}
              >
                <button
                  className="lpFaqQ"
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  aria-expanded={openFaq === i}
                >
                  {item.q}
                  <span className="lpFaqChevron" aria-hidden="true">⌄</span>
                </button>
                <div className="lpFaqA">{item.a}</div>
              </li>
            ))}
          </ul>
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


      <section className="lpMobileTeaser lpReveal lpSectionLazy">
        <div className="lpPricingInner">
          <div className="lpMobileTeaserInner">
            <div className="lpMobileTeaserIcon" aria-hidden="true">📱</div>
            <div className="lpMobileTeaserText">
              <h2 className="lpH2">The full experience, in your pocket.</h2>
              <p className="lpMobileTeaserLead">
                The Glow&apos;d Up Booking mobile app is coming to iPhone. Accept booking requests, manage
                your schedule, message clients, and track payments — all from your phone. Built for
                pros who are always on the move.
              </p>
              <p className="lpMobileTeaserSub">
                iOS app coming soon · Web dashboard available now at{" "}
                <a href="https://glowdupbooking.biz" className="lpMobileTeaserLink">
                  glowdupbooking.biz
                </a>
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="lpFinalCta lpReveal lpSectionLazy">
        <div className="lpFinalCtaInner">
          <h2 className="lpH2">Take your bookings off social.</h2>
          <p className="lpFinalCtaSub">Start free. No credit card required.</p>
          <Link
            to={signupPath}
            onClick={() => trackEvent("cta_click", { page: "home", cta: "start_free_final" })}
          >
            <Button variant="outline" className="lpBtn">
              Start Free →
            </Button>
          </Link>
        </div>
      </section>

      <section className="lpFooterInlineWrap lpReveal lpSectionLazy">
        <div className="lpPricingInner">
          <div className="lpFooterInline">
            <span>© {new Date().getFullYear()} Glow’d Up Booking</span>
            <span className="lpFooterDot">•</span>
            <a href="https://glowdupbooking.com/privacy.html">Privacy Policy</a>
            <span className="lpFooterDot">•</span>
            <a href="https://glowdupbooking.com/terms.html">Terms of Use</a>
            <span className="lpFooterDot">•</span>
            <Link to="/support">Support</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
