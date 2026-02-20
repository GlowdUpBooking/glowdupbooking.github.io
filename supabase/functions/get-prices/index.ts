// supabase/functions/get-prices/index.ts
/// <reference deno.land/x/supabase_functions@1.0.0/mod.ts />

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    },
  });
}

function getEnv(name: string) {
  const v = Deno.env.get(name);
  return v && v.trim().length ? v.trim() : null;
}

async function stripeGet(path: string, stripeKey: string) {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${stripeKey}` },
  });

  const text = await res.text();
  let data: any = null;
  try {
    data = JSON.parse(text);
  } catch {
    // ignore
  }

  if (!res.ok) {
    return {
      ok: false as const,
      status: res.status,
      error: data?.error?.message ?? text ?? "Stripe request failed",
      raw: data ?? text,
    };
  }

  return { ok: true as const, status: res.status, data };
}

function normalizePrice(p: any) {
  const unitAmount =
    typeof p?.unit_amount === "number"
      ? p.unit_amount
      : typeof p?.unit_amount_decimal === "string"
      ? Number(p.unit_amount_decimal)
      : null;

  const currency = typeof p?.currency === "string" ? p.currency.toUpperCase() : "USD";
  const interval = typeof p?.recurring?.interval === "string" ? p.recurring.interval : null;
  const intervalCount = typeof p?.recurring?.interval_count === "number" ? p.recurring.interval_count : 1;

  const productName =
    typeof p?.product?.name === "string"
      ? p.product.name
      : typeof p?.nickname === "string"
      ? p.nickname
      : null;

  return {
    id: p?.id ?? null,
    unit_amount: unitAmount,
    currency,
    interval,
    interval_count: intervalCount,
    product_name: productName,
    livemode: !!p?.livemode,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return json(200, { ok: true });

  if (req.method !== "GET" && req.method !== "POST") {
    return json(405, { error: "method_not_allowed" });
  }

  const stripeKey = getEnv("STRIPE_SECRET_KEY");
  const priceStarter = getEnv("STRIPE_PRICE_STARTER_MONTHLY");
  const pricePro = getEnv("STRIPE_PRICE_PRO_MONTHLY");
  const priceFounder = getEnv("STRIPE_PRICE_FOUNDER_ANNUAL");
  const priceStudio = getEnv("STRIPE_PRICE_STUDIO_MONTHLY"); // optional

  if (!stripeKey) return json(500, { error: "Missing STRIPE_SECRET_KEY" });
  if (!priceStarter || !pricePro || !priceFounder) {
    return json(500, {
      error: "Missing one or more STRIPE price env vars",
      missing: {
        STRIPE_PRICE_STARTER_MONTHLY: !priceStarter,
        STRIPE_PRICE_PRO_MONTHLY: !pricePro,
        STRIPE_PRICE_FOUNDER_ANNUAL: !priceFounder,
      },
    });
  }

  const starterRes = await stripeGet(`prices/${priceStarter}?expand[]=product`, stripeKey);
  const proRes = await stripeGet(`prices/${pricePro}?expand[]=product`, stripeKey);
  const founderRes = await stripeGet(`prices/${priceFounder}?expand[]=product`, stripeKey);

  let studioNorm: any = null;
  if (priceStudio) {
    const studioRes = await stripeGet(`prices/${priceStudio}?expand[]=product`, stripeKey);
    if (studioRes.ok) studioNorm = normalizePrice(studioRes.data);
  }

  if (!starterRes.ok || !proRes.ok || !founderRes.ok) {
    return json(500, {
      error: "stripe_price_fetch_failed",
      details: {
        starter: starterRes.ok ? null : { status: starterRes.status, error: starterRes.error },
        pro: proRes.ok ? null : { status: proRes.status, error: proRes.error },
        founder: founderRes.ok ? null : { status: founderRes.status, error: founderRes.error },
      },
    });
  }

  return json(200, {
    ok: true,
    prices: {
      // Free is $0 and not a Stripe price
      free_monthly: { id: "free", unit_amount: 0, currency: "USD", interval: "month", interval_count: 1, product_name: "Free", livemode: null },

      starter_monthly: normalizePrice(starterRes.data),
      pro_monthly: normalizePrice(proRes.data),
      founder_annual: normalizePrice(founderRes.data),

      // optional: only present if you set STRIPE_PRICE_STUDIO_MONTHLY
      studio_monthly: studioNorm,
    },
  });
});