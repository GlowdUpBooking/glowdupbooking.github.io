import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import PaywallBanner from "../components/Pricing/PaywallBanner";

export default function Pricing() {
  const location = useLocation();
  const navigate = useNavigate();

  const isPaywall = location.state?.reason === "paywall";

  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null);

  const [pricesLoading, setPricesLoading] = useState(true);
  const [prices, setPrices] = useState([]);
  const [subAllowed, setSubAllowed] = useState(false);
  const [checkoutLoadingId, setCheckoutLoadingId] = useState(null);

  // ---- Session ----
  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data?.session ?? null);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!mounted) return;
      setSession(newSession);
    });

    return () => {
      mounted = false;
      sub?.subscription?.unsubscribe?.();
    };
  }, []);

  // ---- Pull prices (via edge function) ----
  useEffect(() => {
    let mounted = true;

    async function run() {
      setPricesLoading(true);

      try {
        const res = await supabase.functions.invoke("get-prices");
        const raw = res?.data?.prices || res?.data || [];

        // Normalize a bit so UI doesn't explode if shape changes
        const normalized = Array.isArray(raw)
          ? raw.map((p) => ({
              id: p.id || p.price_id || p.priceId,
              nickname: p.nickname || p.name || p.product_name || "Pro",
              unit_amount: p.unit_amount ?? p.amount ?? 0,
              currency: (p.currency || "usd").toUpperCase(),
              interval:
                p.recurring?.interval ||
                p.interval ||
                p.recurring_interval ||
                "month",
              description:
                p.product?.description || p.description || "",
            }))
          : [];

        if (mounted) setPrices(normalized.filter((p) => !!p.id));
      } catch (e) {
        if (mounted) setPrices([]);
      } finally {
        if (mounted) setPricesLoading(false);
      }
    }

    run();
    return () => {
      mounted = false;
    };
  }, []);

  // ---- Check if user already allowed ----
  useEffect(() => {
    let mounted = true;

    async function run() {
      if (!session?.user) {
        if (!mounted) return;
        setSubAllowed(false);
        return;
      }

      const { data, error } = await supabase
        .from("pro_subscriptions")
        .select("status, current_period_end")
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (!mounted) return;

      if (error || !data) {
        setSubAllowed(false);
        return;
      }

      const statusOk = data.status === "active";
      const endOk =
        data.current_period_end == null
          ? true
          : new Date(data.current_period_end).getTime() > Date.now();

      setSubAllowed(statusOk && endOk);
    }

    run();
    return () => {
      mounted = false;
    };
  }, [session]);

  const fromPath = useMemo(() => location.state?.from || "/app", [location.state]);

  async function startCheckout(priceId) {
    if (!session?.user) {
      navigate("/login", { state: { from: "/pricing" } });
      return;
    }

    setCheckoutLoadingId(priceId);

    try {
      const successUrl = `${window.location.origin}${fromPath}`;
      const cancelUrl = `${window.location.origin}/pricing`;

      const { data, error } = await supabase.functions.invoke(
        "create-checkout-session",
        {
          body: {
            priceId,
            successUrl,
            cancelUrl,
          },
        }
      );

      if (error) throw error;

      const url = data?.url || data?.checkoutUrl;
      if (url) window.location.href = url;
    } catch (e) {
      // Keep it simple — you can replace with a toast component
      alert("Checkout failed. Please try again.");
    } finally {
      setCheckoutLoadingId(null);
    }
  }

  function formatPrice(unitAmount, currency) {
    const amt = Number(unitAmount || 0) / 100;
    try {
      return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: (currency || "USD").toUpperCase(),
      }).format(amt);
    } catch {
      return `$${amt.toFixed(2)}`;
    }
  }

  if (loading) return null;

  return (
    <div style={{ maxWidth: 980, margin: "0 auto", padding: "28px 16px" }}>
      {isPaywall && <PaywallBanner />}

      <div style={{ marginBottom: 18 }}>
        <h1 style={{ fontSize: 34, margin: 0, lineHeight: 1.15 }}>
          Pricing
        </h1>
        <p style={{ opacity: 0.8, marginTop: 10, lineHeight: 1.45 }}>
          Unlock Pro to access your dashboard, finish onboarding, and start taking bookings.
        </p>
      </div>

      {session?.user && subAllowed && (
        <div
          style={{
            border: "1px solid rgba(255,255,255,0.12)",
            background: "rgba(0,0,0,0.25)",
            borderRadius: 16,
            padding: 16,
            marginBottom: 16,
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 6 }}>
            You already have Pro access ✅
          </div>
          <div style={{ opacity: 0.85, marginBottom: 12 }}>
            Head back to your dashboard.
          </div>
          <button
            onClick={() => navigate(fromPath)}
            style={{
              padding: "10px 14px",
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.18)",
              background: "rgba(255,255,255,0.08)",
              cursor: "pointer",
            }}
          >
            Continue to app
          </button>
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: 14,
        }}
      >
        {pricesLoading ? (
          <div style={{ opacity: 0.8 }}>Loading plans…</div>
        ) : prices.length === 0 ? (
          <div style={{ opacity: 0.8 }}>
            No plans found. Make sure your `get-prices` function returns prices.
          </div>
        ) : (
          prices.map((p) => (
            <div
              key={p.id}
              style={{
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 18,
                padding: 16,
                background: "rgba(0,0,0,0.25)",
              }}
            >
              <div style={{ fontSize: 18, fontWeight: 800 }}>
                {p.nickname}
              </div>

              <div style={{ marginTop: 10, fontSize: 28, fontWeight: 900 }}>
                {formatPrice(p.unit_amount, p.currency)}
                <span style={{ fontSize: 14, opacity: 0.75, marginLeft: 8 }}>
                  / {p.interval}
                </span>
              </div>

              {p.description && (
                <div style={{ marginTop: 10, opacity: 0.82, lineHeight: 1.45 }}>
                  {p.description}
                </div>
              )}

              <button
                onClick={() => startCheckout(p.id)}
                disabled={!!checkoutLoadingId}
                style={{
                  width: "100%",
                  marginTop: 14,
                  padding: "12px 14px",
                  borderRadius: 14,
                  border: "1px solid rgba(255,255,255,0.18)",
                  background: "rgba(255,255,255,0.10)",
                  cursor: checkoutLoadingId ? "not-allowed" : "pointer",
                  fontWeight: 800,
                }}
              >
                {checkoutLoadingId === p.id ? "Starting checkout…" : "Choose plan"}
              </button>
            </div>
          ))
        )}
      </div>

      {!session?.user && (
        <div style={{ marginTop: 18, opacity: 0.85 }}>
          Already have an account?{" "}
          <button
            onClick={() => navigate("/login", { state: { from: "/pricing" } })}
            style={{
              background: "none",
              border: "none",
              padding: 0,
              cursor: "pointer",
              textDecoration: "underline",
              color: "inherit",
              fontWeight: 700,
            }}
          >
            Sign in
          </button>
        </div>
      )}
    </div>
  );
}