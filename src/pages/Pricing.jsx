import { Link } from "react-router-dom";
import PaywallBanner from "../components/Pricing/PaywallBanner";

export default function Pricing() {
  return (
    <div className="lp" style={{ minHeight: "100vh" }}>
      <header className="lpNav">
        <div className="lpNavInner">
          <Link className="lpBrand" to="/">
            <span className="lpBrandStrong">Glow’d Up</span>
            <span className="lpBrandLight"> Booking</span>
          </Link>

          <div className="lpNavRight">
            <Link className="lpNavBtn" to="/app">
              Back to App <span className="lpArrow">→</span>
            </Link>
          </div>
        </div>
      </header>

      <main className="lpPricing" style={{ paddingTop: 24 }}>
        <div className="lpPricingInner">
          <PaywallBanner />
        </div>
      </main>
    </div>
  );
}