// src/components/Pricing/PaywallBanner.jsx
import Card from "../ui/Card";

export default function PaywallBanner() {
  return (
    <div style={{ marginTop: 18, marginBottom: 18 }}>
      <Card className="lpPriceCard" style={{ padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div style={{ fontWeight: 800 }}>
            Start with <span style={{ fontWeight: 900 }}>Free 7-Day</span>
          </div>
          <div style={{ opacity: 0.8 }}>
            Upgrade to <strong>Pro at $19.99/month</strong> or start <strong>Studio on the web at $39.99/month</strong>.
          </div>
        </div>
      </Card>
    </div>
  );
}
