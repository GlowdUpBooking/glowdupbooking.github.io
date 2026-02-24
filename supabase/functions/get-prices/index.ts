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

function isNoSuchPriceError(err: unknown) {
  const msg = String(err ?? "").toLowerCase();
  return msg.includes("no such price");
}

type Tier = "starter_monthly" | "pro_monthly" | "founder_annual" | "elite_monthly";

function specForTier(tier: Tier) {
  if (tier === "starter_monthly") return { token: "starter", interval: "month" as const };
  if (tier === "pro_monthly") return { token: "pro", interval: "month" as const };
  if (tier === "founder_annual") return { token: "founder", interval: "year" as const };
  return { token: "elite", interval: "month" as const };
}

function pickFallbackPrice(listData: any, tier: Tier) {
  const spec = specForTier(tier);
  const rows = Array.isArray(listData?.data) ? listData.data : [];

  const candidates = rows.filter((p: any) => {
    const recurringInterval = typeof p?.recurring?.interval === "string" ? p.recurring.interval : null;
    if (recurringInterval !== spec.interval) return false;

    const productName = typeof p?.product?.name === "string" ? p.product.name : "";
    const nickname = typeof p?.nickname === "string" ? p.nickname : "";
    const haystack = `${productName} ${nickname}`.toLowerCase();
    return haystack.includes(spec.token);
  });

  if (!candidates.length) return null;
  candidates.sort((a: any, b: any) => Number(b?.created ?? 0) - Number(a?.created ?? 0));
  return candidates[0];
}

async function resolvePrice(
  stripeKey: string,
  configuredPriceId: string | null,
  tier: Tier
) {
  if (configuredPriceId) {
    const direct = await stripeGet(`prices/${configuredPriceId}?expand[]=product`, stripeKey);
    if (direct.ok) {
      return { ok: true as const, price: direct.data, resolved_price_id: configuredPriceId, source: "env" as const };
    }

    if (!isNoSuchPriceError(direct.error)) {
      return {
        ok: false as const,
        status: direct.status,
        error: direct.error,
      };
    }
  }

  const list = await stripeGet("prices?active=true&limit=100&expand[]=data.product", stripeKey);
  if (!list.ok) {
    return {
      ok: false as const,
      status: list.status,
      error: list.error,
    };
  }

  const fallback = pickFallbackPrice(list.data, tier);
  if (!fallback?.id) {
    return {
      ok: false as const,
      status: 404,
      error: `No active fallback price found for ${tier}`,
    };
  }

  return { ok: true as const, price: fallback, resolved_price_id: fallback.id, source: "fallback" as const };
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
  const priceElite = getEnv("STRIPE_PRICE_ELITE_MONTHLY"); // optional (falls back by product token)

  if (!stripeKey) return json(500, { error: "Missing STRIPE_SECRET_KEY" });

  const starterRes = await resolvePrice(stripeKey, priceStarter, "starter_monthly");
  const proRes = await resolvePrice(stripeKey, pricePro, "pro_monthly");
  const founderRes = await resolvePrice(stripeKey, priceFounder, "founder_annual");
  const eliteRes = await resolvePrice(stripeKey, priceElite, "elite_monthly");

  const eliteNorm: any = eliteRes.ok ? normalizePrice(eliteRes.price) : null;
  if (!eliteRes.ok) {
    console.warn("[get-prices] elite price lookup failed; returning null for elite_monthly", {
      status: eliteRes.status,
      error: eliteRes.error,
    });
  }

  if (!starterRes.ok || !proRes.ok || !founderRes.ok) {
    return json(500, {
      error: "stripe_price_fetch_failed",
      details: {
        starter: starterRes.ok ? null : { status: starterRes.status, error: starterRes.error },
        pro: proRes.ok ? null : { status: proRes.status, error: proRes.error },
        founder: founderRes.ok ? null : { status: founderRes.status, error: founderRes.error },
        elite: eliteRes.ok ? null : { status: eliteRes.status, error: eliteRes.error },
      },
    });
  }

  return json(200, {
    ok: true,
    prices: {
      // Free is $0 and not a Stripe price
      free_monthly: { id: "free", unit_amount: 0, currency: "USD", interval: "month", interval_count: 1, product_name: "Free", livemode: null },

      starter_monthly: normalizePrice(starterRes.price),
      pro_monthly: normalizePrice(proRes.price),
      founder_annual: normalizePrice(founderRes.price),
      elite_monthly: eliteNorm,
    },
    sources: {
      starter_monthly: starterRes.source,
      pro_monthly: proRes.source,
      founder_annual: founderRes.source,
      elite_monthly: eliteRes.ok ? eliteRes.source : null,
    },
  });
});
