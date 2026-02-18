import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";

export default function PaywallBanner() {
  const [params] = useSearchParams();
  const next = params.get("next");

  const text = useMemo(() => {
    if (!next) return null;
    return "Subscribe to continue — your account is ready, you just need a plan to access the app.";
  }, [next]);

  if (!text) return null;

  return (
    <div
      style={{
        margin: "16px 0",
        padding: "12px 14px",
        borderRadius: 14,
        border: "1px solid rgba(255,255,255,.12)",
        background: "rgba(255,255,255,.06)",
      }}
    >
      <div style={{ fontSize: 14, lineHeight: 1.35, opacity: 0.92 }}>{text}</div>
    </div>
  );
}