// src/components/Pricing/PaywallBanner.jsx
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import Card from "../ui/Card";

export default function PaywallBanner() {
  const [loading, setLoading] = useState(true);
  const [offer, setOffer] = useState(null);

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        setLoading(true);

        const { data, error } = await supabase
          .from("founding_offer")
          .select("id, max_spots, claimed_spots, updated_at")
          .eq("id", 1)
          .maybeSingle();

        if (!mounted) return;

        if (error || !data) {
          setOffer(null);
        } else {
          setOffer(data);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, []);

  const computed = useMemo(() => {
    if (!offer) return null;
    const max = Number(offer.max_spots ?? 0);
    const claimed = Number(offer.claimed_spots ?? 0);
    const left = Math.max(0, max - claimed);
    const pct = max > 0 ? Math.min(100, Math.max(0, (claimed / max) * 100)) : 0;
    return { max, claimed, left, pct };
  }, [offer]);

  // If it’s loading, we can show a subtle placeholder or nothing.
  if (loading) return null;

  // If no offer is readable, don't show anything (prevents ugly "missing" UI)
  if (!computed || computed.max <= 0) return null;

  return (
    <div style={{ marginTop: 18, marginBottom: 18 }}>
      <Card className="lpPriceCard" style={{ padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div style={{ fontWeight: 800 }}>
            Founder spots left:{" "}
            <span style={{ fontWeight: 900 }}>{computed.left}</span>{" "}
            <span style={{ opacity: 0.8 }}>of {computed.max}</span>
          </div>
          <div style={{ opacity: 0.8 }}>
            First 500 Pros lock in <strong>$99/year</strong> while active.
          </div>
        </div>

        <div
          style={{
            marginTop: 12,
            height: 10,
            borderRadius: 999,
            background: "rgba(255,255,255,0.08)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${computed.pct}%`,
              borderRadius: 999,
              background: "rgba(255,255,255,0.22)",
            }}
          />
        </div>
      </Card>
    </div>
  );
}