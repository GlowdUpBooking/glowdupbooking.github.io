import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import { trackEvent } from "../lib/analytics";
import { getSignupPath, isStudioWebBillingRestricted } from "../lib/siteFlags";

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
    flow: [
      {
        label: "Step 1",
        title: "Choose service",
        detail: "Loc Retwist · 75 min · $85",
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

const IOS_APP_URL = "https://apps.apple.com/us/app/glowd-up-booking/id6758881771";

const MOBILE_FEATURES = [
  {
    eyebrow: "Dashboard",
    title: "Run your day from your phone",
    text: "Check today’s numbers, upcoming appointments, rebook prompts, and payout health without opening a laptop.",
  },
  {
    eyebrow: "Appointments",
    title: "Review bookings in real time",
    text: "See completed and upcoming appointments, confirm deposit status, and keep your calendar moving while you are in the chair.",
  },
  {
    eyebrow: "Services",
    title: "Update pricing and deposits fast",
    text: "Edit services, control deposit amounts, and keep your booking menu polished directly from iPhone.",
  },
];

const MOBILE_SCREENSHOTS = [
  { src: "/assets/app-store/dashboard.jpg", alt: "Glow'd Up Booking iPhone dashboard screen" },
  { src: "/assets/app-store/appointments.jpg", alt: "Glow'd Up Booking iPhone appointments screen" },
  { src: "/assets/app-store/services.jpg", alt: "Glow'd Up Booking iPhone services screen" },
  { src: "/assets/app-store/login.jpg", alt: "Glow'd Up Booking iPhone login screen" },
];

export default function Home() {
  const signupPath = getSignupPath();
  const studioBillingRestricted = isStudioWebBillingRestricted();
  const showStudioPlan = !studioBillingRestricted;
  const [activeTab, setActiveTab] = useState("book");
  const [activeStep, setActiveStep] = useState(0);
  const [openFaq, setOpenFaq] = useState(null);
  const whyPros = [
    "Keep more of what you earn with clear, transparent pricing",
    "Reduce no-shows with deposits and optional prepay",
    "Get paid faster with reliable payout options",
    "Build your brand with a premium booking experience",
    "Grow with tools designed for independent pros",
    ...(showStudioPlan ? ["Scale into a shared Studio workspace when you are ready for team seats"] : []),
  ];
  const faqs = [
    {
      q: "Is it free to get started?",
      a: "Yes. Every pro account starts with a free 7-day trial and no credit card required.",
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
      a: "Standard payouts arrive the next business day. An instant payout option is also available when you need funds sooner - the fee is shown before you confirm.",
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
      q: "What happens after 7 days?",
      a: showStudioPlan
        ? "After your free 7-day period, you can stay on Free or move to Pro at $19.99/month. Studio is available on the web at $39.99/month for team businesses."
        : "After your free 7-day period, you can stay on Free or move to Pro at $19.99/month.",
    },
  ];

  const activePreview = useMemo(
    () => PREVIEW_TABS.find((tab) => tab.id === activeTab) || PREVIEW_TABS[0],
    [activeTab]
  );
  const activeFlow = activePreview.flow || [];
  const activeFlowStep = activeFlow[activeStep] || activeFlow[0];

  useEffect(() => {
    const preload = ["/assets/hero-1.jpg", "/assets/hero-2.jpg", "/assets/hero-3.jpg", "/assets/hero-4.jpg"];
    const links = preload.map((href) => {
      const link = document.createElement("link");
      link.rel = "preload";
      link.as = "image";
      link.href = href;
      document.head.appendChild(link);
      return link;
    });

    return () => {
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
              <a
                href={IOS_APP_URL}
                target="_blank"
                rel="noreferrer"
                onClick={() => trackEvent("cta_click", { page: "home", cta: "download_ios_hero" })}
              >
                <Button variant="outline" className="lpBtn lpBtnGold">
                  Download for iPhone
                </Button>
              </a>
            </div>

            <div className="lpTrustRow">
              <span>Stripe-secured payments</span>
              <span>Cancel anytime</span>
              <span>Now on the App Store</span>
            </div>

            <div className="lpLiveChip">Free 7-day trial available</div>
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
            {whyPros.map((item) => (
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
                  setActiveStep(0);
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
            <div className="lpSub">{showStudioPlan ? "Choose Free 7-Day, Pro, or Studio." : "Choose Free 7-Day or Pro."}</div>
          </div>

          <div className="lpGrid">
            <Card className="lpPriceCard lpPlanCard lpReveal" style={{ animationDelay: "0ms" }}>
              <div className="lpTier">Free 7-Day</div>
              <div className="lpPriceLine">
                <span className="lpPrice">$0</span>
                <span className="lpTerm">/7 days</span>
              </div>

              <ul className="lpList">
                <li>✓ 7-day free trial to launch fast</li>
                <li>✓ Professional booking link</li>
                <li>✓ Core scheduling and booking workflow</li>
                <li>✓ Stripe-secured payment setup</li>
                <li>{showStudioPlan ? "✓ Upgrade to Pro or Studio anytime" : "✓ Upgrade to Pro anytime"}</li>
              </ul>

              <Link
                to="/pricing#plans"
                className="lpChooseWrap"
                onClick={() => trackEvent("plan_cta_click", { page: "home", plan: "free_7_day", cta: "start_free" })}
              >
                <Button variant="outline" className="lpChoose">
                  Start Free Trial
                </Button>
              </Link>
            </Card>

            <Card className="lpPriceCard lpPlanCard lpFeatured lpReveal" style={{ animationDelay: "70ms" }}>
              <div className="lpTierRow">
                <div className="lpTier">Pro</div>
              </div>
              <div className="lpPriceLine">
                <span className="lpPrice">$19.99</span>
                <span className="lpTerm">/month</span>
              </div>

              <ul className="lpList">
                <li>✓ Everything in Free 7-Day</li>
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

            {showStudioPlan ? (
              <Card className="lpPriceCard lpPlanCard lpReveal" style={{ animationDelay: "140ms" }}>
                <div className="lpTierRow">
                  <div className="lpTier">Studio</div>
                </div>
                <div className="lpPriceLine">
                  <span className="lpPrice">$39.99</span>
                  <span className="lpTerm">/month</span>
                </div>

                <ul className="lpList">
                  <li>✓ Everything in Pro</li>
                  <li>✓ Shared Studio workspace and team seats</li>
                  <li>✓ Chairs, rooms, and shared resource calendars</li>
                  <li>✓ Owner-managed seat billing and payout reporting</li>
                  <li>✓ Mobile Studio tools unlock after web checkout</li>
                  <li>✓ Includes 3 accounts, with extra seats available up to 10 total</li>
                </ul>

                <Link
                  to="/pricing#plans"
                  className="lpChooseWrap"
                  onClick={() => trackEvent("plan_cta_click", { page: "home", plan: "studio", cta: "start_studio" })}
                >
                  <Button variant="outline" className="lpChoose">
                    Start Studio
                  </Button>
                </Link>
              </Card>
            ) : null}
          </div>
        </div>
      </section>

      <section className="lpFaq lpReveal lpSectionLazy" id="faq">
        <div className="lpPricingInner">
          <div className="lpPricingHead">
            <h2 className="lpH2">Common questions</h2>
          </div>
          <ul className="lpFaqList">
            {faqs.map((item, i) => (
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
            <div className="lpMobileTeaserText">
              <div className="lpMobileBadge">Now live on iPhone</div>
              <h2 className="lpH2">Glow’d Up Booking is on the App Store.</h2>
              <p className="lpMobileTeaserLead">
                Built for beauty and service pros who move fast. Manage appointments, services, deposits,
                availability, and payouts with the same dark-luxury experience shown in the app.
              </p>
              <div className="lpMobileFeatureGrid">
                {MOBILE_FEATURES.map((feature) => (
                  <Card className="lpMobileFeatureCard" key={feature.title}>
                    <div className="lpMobileFeatureEyebrow">{feature.eyebrow}</div>
                    <h3>{feature.title}</h3>
                    <p>{feature.text}</p>
                  </Card>
                ))}
              </div>
              <div className="lpMobileTeaserActions">
                <a
                  href={IOS_APP_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="lpStoreButton"
                  onClick={() => trackEvent("cta_click", { page: "home", cta: "download_ios_section" })}
                >
                  <span className="lpStoreButtonOverline">Download on the</span>
                  <span className="lpStoreButtonLabel">App Store</span>
                </a>
                <p className="lpMobileTeaserSub">
                  Web dashboard also available at{" "}
                  <a href="https://glowdupbooking.biz" className="lpMobileTeaserLink">
                    glowdupbooking.biz
                  </a>
                </p>
              </div>
            </div>

            <div className="lpMobileShowcase" aria-hidden="true">
              {MOBILE_SCREENSHOTS.map((shot, index) => (
                <figure className={`lpScreenshotCard lpScreenshotCard${index + 1}`} key={shot.src}>
                  <img className="lpScreenshotImage" src={shot.src} alt={shot.alt} loading="lazy" />
                </figure>
              ))}
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
