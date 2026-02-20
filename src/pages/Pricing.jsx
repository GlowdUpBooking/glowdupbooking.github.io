import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import PaywallBanner from "../components/Pricing/PaywallBanner";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import { supabase } from "../lib/supabase";


function moneyFromStripeUnitAmount(unitAmountCents) {
  const cents = Number(unitAmountCents ?? 0);
  const dollars = cents / 100;
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(dollars);
  } catch {
    return `$${dollars.toFixed(2)}`;
  }
}

function TopNav() {
  return (
    <header className="prNav">
      <div className="prNavInner">
        <Link className="prBrand" to="/">
          Glow’d Up Booking
        </Link>

        <nav className="prNavRight">
          <Link className="prNavLink" to="/pricing">
            Plans
          </Link>
          <Link className="prNavLink" to="/signup">
            Create account
          </Link>
          <Link className="prNavBtn" to="/login">
            Sign In <span className="prArrow">→</span>
          </Link>
        </nav>
      </div>
    </header>
  );
}

function PlanCard({ tag, title, price, term, desc, bullets, noteTitle, noteText, cta, onClick }) {
  return (
    <div className="prCard">
      <div className="prCardTop">
        <div className="prTier">{title}</div>
        {tag ? <div className="prTag">{tag}</div> : null}
      </div>

      <div className="prPriceRow">
        <div className="prPrice">{price}</div>
        <div className="prTerm">{term}</div>
      </div>

      {desc ? <div className="prDesc">{desc}</div> : null}

      <ul className="prList">
        {bullets.map((b) => (
          <li key={b}>{b}</li>
        ))}
      </ul>

      {(noteTitle || noteText) && (
        <div className="prNote">
          {noteTitle ? <div className="prNoteTitle">{noteTitle}</div> : null}
          {noteText ? <div className="prNoteText">{noteText}</div> : null}
        </div>
      )}

      <button className="prBtn" onClick={onClick}>
        {cta}
      </button>
    </div>
  );
}

export default function Pricing() {
  const nav = useNavigate();
  const location = useLocation();

  const [prices, setPrices] = useState(null);
  const [err, setErr] = useState("");

  const qs = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const checkoutState = qs.get("checkout");

  useEffect(() => {
    let mounted = true;

    async function load() {
      setErr("");
      try {
        const { data, error } = await supabase.functions.invoke("get-prices");
        if (error) throw error;
        if (!data?.prices) throw new Error("Missing prices");
        if (!mounted) return;
        setPrices(data.prices);
      } catch (e) {
        console.error("[Pricing] get-prices error:", e);
        if (mounted) setErr("Couldn’t load pricing right now. Please refresh.");
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, []);

  // Most apps: choose plan → create account → onboarding → pay (if paid plan)
  const goSignup = (plan) => nav(`/signup?plan=${encodeURIComponent(plan)}&next=/app/onboarding`);

  const starterPrice = prices?.starter_monthly
    ? moneyFromStripeUnitAmount(prices.starter_monthly.unit_amount)
    : "$9.99";

  const proPrice = prices?.pro_monthly
    ? moneyFromStripeUnitAmount(prices.pro_monthly.unit_amount)
    : "$14.99";

  const founderPrice = prices?.founder_annual
    ? moneyFromStripeUnitAmount(prices.founder_annual.unit_amount)
    : "$99";

  return (
    <div className="prPage">
      <TopNav />

      <main className="prMain">
        <div className="prWrap">
          <header className="prHeader">
            <h1 className="prH1">Simple pricing for professionals.</h1>
            <p className="prSub">
              Built for barbers, stylists, tattoo artists, nail techs, and more. Start free. Upgrade when
              you’re ready.
            </p>
            <p className="prMicro">Clients book free. Pros pay only for tools + growth.</p>
          </header>

          <PaywallBanner />

          {checkoutState === "cancel" && <div className="prToast">Checkout canceled.</div>}
          {checkoutState === "success" && <div className="prToast">Success! Your subscription is processing.</div>}
          {err ? <div className="prToast prToastErr">{err}</div> : null}

          <section className="prGrid">
            <PlanCard
              title="Free"
              tag="$0"
              price="$0"
              term="/ month"
              desc="For pros who want to try Glow’d Up Booking with real clients."
              bullets={[
                "Pro profile + shareable booking link",
                "Unlimited booking requests",
                "Accept up to 20 bookings per month (resets on the 1st)",
                "Optional deposits (you choose)",
                "Basic scheduling + booking management",
              ]}
              noteTitle="Limitations"
              noteText="No full prepay. Deposit only (if enabled)."
              cta="Start Free"
              onClick={() => goSignup("free")}
            />

            <PlanCard
              title="Starter"
              price={starterPrice}
              term="/ month"
              desc="For solo pros who need a clean booking flow that looks premium."
              bullets={[
                "Everything in Free",
                "Unlimited accepted bookings",
                "Better booking controls",
                "Service menu + durations + pricing",
                "Client notes + simple organization",
                "Faster setup + smoother workflow",
              ]}
              cta="Choose Starter"
              onClick={() => goSignup("starter")}
            />

            <PlanCard
              title="Pro"
              tag="Featured"
              price={proPrice}
              term="/ month"
              desc="For pros who want the full system — more control, more flexibility."
              bullets={[
                "Everything in Starter",
                "Optional deposits and optional full prepay",
                "Advanced scheduling rules (buffers, availability rules, etc.)",
                "Portfolio / service photos",
                "Stronger branding + customization",
                "Priority placement (when the marketplace opens later)",
                "Instant payout option (fee applies)",
              ]}
              cta="Choose Pro"
              onClick={() => goSignup("pro")}
            />

            <PlanCard
              title="Founder"
              tag="Limited"
              price={founderPrice}
              term="/ year"
              desc="First 1,000 pros only. Lock in the best price while you stay active."
              bullets={[
                "Everything in Pro",
                "Founder price locked while active",
                "Founder badge + early feature access",
                "Priority support",
                "Best long-term value",
              ]}
              noteTitle="Important"
              noteText="If your membership lapses for more than 7 days, Founder pricing can’t be reclaimed."
              cta="Choose Founder"
              onClick={() => goSignup("founder")}
            />
          </section>

          <footer className="prFine">
            <ul>
              <li>Booking limits on Free reset on the 1st of every month.</li>
              <li>Deposits and payments run through Stripe when enabled.</li>
              <li>Instant payout is optional and includes a fee (so payouts stay immediate).</li>
              <li>You can upgrade or downgrade anytime.</li>
            </ul>
          </footer>
        </div>
      </main>
    </div>
  );
}