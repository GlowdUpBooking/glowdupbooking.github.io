// src/components/Pricing/PlanCard.jsx
import Card from "../ui/Card";
import Button from "../ui/Button";

export default function PlanCard({
  title,
  priceLine,
  description,
  bullets = [],
  finePrint,
  badge,
  featured = false,
  ctaLabel,
  onCta,
  disabled = false,
  busy = false,
  secondaryNote,
}) {
  return (
    <Card className={`lpPriceCard ${featured ? "lpFeatured" : ""}`} style={{ padding: 18 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <div style={{ fontWeight: 900, fontSize: 18 }}>{title}</div>
        {badge ? (
          <div
            style={{
              fontSize: 12,
              fontWeight: 800,
              padding: "6px 10px",
              borderRadius: 999,
              background: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.10)",
            }}
          >
            {badge}
          </div>
        ) : null}
      </div>

      <div className="u-muted" style={{ marginTop: 8, fontSize: 14 }}>
        {priceLine}
      </div>

      {description ? (
        <div className="u-muted" style={{ marginTop: 10, opacity: 0.9, lineHeight: 1.5 }}>
          {description}
        </div>
      ) : null}

      {bullets?.length ? (
        <ul style={{ marginTop: 12, opacity: 0.92, lineHeight: 1.7, paddingLeft: 18 }}>
          {bullets.map((b, idx) => (
            <li key={idx}>{b}</li>
          ))}
        </ul>
      ) : null}

      {finePrint ? (
        <div className="u-muted2" style={{ marginTop: 10, lineHeight: 1.5 }}>
          {finePrint}
        </div>
      ) : null}

      <Button
        style={{ marginTop: 14, width: "100%" }}
        variant={featured ? "primary" : "outline"}
        onClick={onCta}
        disabled={disabled || busy}
      >
        {busy ? "Starting…" : ctaLabel}
      </Button>

      {secondaryNote ? (
        <div className="u-muted2" style={{ marginTop: 10 }}>
          {secondaryNote}
        </div>
      ) : null}
    </Card>
  );
}