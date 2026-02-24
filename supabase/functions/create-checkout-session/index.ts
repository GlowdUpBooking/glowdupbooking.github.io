// supabase/functions/create-checkout-session/index.ts
/// <reference deno.land/x/supabase_functions@1.0.0/mod.ts />

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

type Plan = "free" | "starter" | "pro" | "founder" | "elite";
type Tier = "starter_monthly" | "pro_monthly" | "founder_annual" | "elite_monthly";

function getEnv(name: string) {
  const v = Deno.env.get(name);
  return v && v.trim().length ? v.trim() : null;
}

function isNoSuchPriceError(err: unknown) {
  const msg = String(err ?? "").toLowerCase();
  return msg.includes("no such price");
}

function safeErr(e: unknown) {
  const anyE = e as any;
  return {
    message: anyE?.message ?? String(e),
    type: anyE?.type,
    code: anyE?.code,
    statusCode: anyE?.statusCode,
    rawType: anyE?.raw?.type,
    rawMessage: anyE?.raw?.message,
  };
}

function getAllowedOrigins(siteUrl: string | null) {
  const allowlistRaw = getEnv("ALLOWED_ORIGINS") ?? "";
  const siteOrigin = (() => {
    if (!siteUrl) return null;
    try {
      return new URL(siteUrl).origin;
    } catch {
      return null;
    }
  })();

  const allowlist = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:4173",
    "http://127.0.0.1:4173",
    ...allowlistRaw.split(",").map((s) => s.trim()).filter(Boolean),
    ...(siteOrigin ? [siteOrigin] : []),
  ];
  return Array.from(new Set(allowlist));
}

function pickRedirectBase(req: Request, siteUrl: string) {
  const origin = (req.headers.get("origin") ?? "").trim();
  const allowedOrigins = getAllowedOrigins(siteUrl);
  if (origin && allowedOrigins.includes(origin)) {
    return origin.replace(/\/+$/, "");
  }
  return siteUrl.replace(/\/+$/, "");
}

function corsHeaders(req: Request) {
  const origin = req.headers.get("origin") ?? "";
  const uniqueAllowlist = getAllowedOrigins(getEnv("SITE_URL"));
  const allowed = !origin || uniqueAllowlist.includes(origin);
  const fallbackOrigin = uniqueAllowlist[0] ?? "http://localhost:5173";
  return {
    "Access-Control-Allow-Origin": allowed ? (origin || fallbackOrigin) : fallbackOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Credentials": "true",
    "Vary": "Origin",
  };
}

function json(req: Request, status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders(req),
    },
  });
}

async function getUserIdFromJwt(authHeader: string) {
  const supabaseUrl = getEnv("SUPABASE_URL") ?? getEnv("SB_URL");
  const anonKey =
    getEnv("SUPABASE_ANON_KEY") ??
    getEnv("SB_ANON_KEY") ??
    getEnv("SUPABASE_ANON_PUBLIC") ??
    getEnv("SB_ANON_PUBLIC");

  if (!supabaseUrl || !anonKey) {
    return { userId: null, reason: "missing_supabase_env" as const };
  }

  const auth = authHeader ?? "";
  if (!auth.toLowerCase().startsWith("bearer ")) {
    return { userId: null, reason: "missing_bearer" as const };
  }

  const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { Authorization: auth, apikey: anonKey },
  });

  if (!res.ok) {
    const t = await res.text().catch(() => "");
    return { userId: null, reason: `auth_lookup_failed:${res.status}` as const, detail: t };
  }

  const data = await res.json().catch(() => null);
  const userId = typeof data?.id === "string" ? data.id : null;
  return { userId, reason: userId ? null : ("missing_id" as const) };
}

function assertTier(x: any): Tier | null {
  const t = String(x ?? "").trim();
  if (t === "starter_monthly") return "starter_monthly";
  if (t === "pro_monthly") return "pro_monthly";
  if (t === "founder_annual") return "founder_annual";
  if (t === "elite_monthly") return "elite_monthly";
  return null;
}

async function fetchFounderRolloutState() {
  const supabaseUrl = getEnv("SUPABASE_URL") ?? getEnv("SB_URL");
  const serviceRoleKey =
    getEnv("SUPABASE_SERVICE_ROLE_KEY") ??
    getEnv("SB_SERVICE_ROLE_KEY");
  const anonKey =
    getEnv("SUPABASE_ANON_KEY") ??
    getEnv("SB_ANON_KEY") ??
    getEnv("SUPABASE_ANON_PUBLIC") ??
    getEnv("SB_ANON_PUBLIC");

  const apiKey = serviceRoleKey ?? anonKey;

  if (!supabaseUrl || !apiKey) {
    return { ok: false as const, error: "missing_supabase_env" };
  }

  const res = await fetch(
    `${supabaseUrl}/rest/v1/founding_offer?select=max_spots,claimed_spots&id=eq.1&limit=1`,
    {
      headers: {
        apikey: apiKey,
        Authorization: `Bearer ${apiKey}`,
      },
    }
  );

  const text = await res.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    // ignore
  }

  if (!res.ok) {
    return {
      ok: false as const,
      error: `founding_offer_lookup_failed:${res.status}`,
      detail: json ?? text,
    };
  }

  const row = Array.isArray(json) ? json[0] : null;
  if (!row) {
    return { ok: false as const, error: "founding_offer_row_missing" };
  }

  const maxSpots = Number(row.max_spots ?? 1000);
  const claimedSpots = Number(row.claimed_spots ?? 0);
  if (!Number.isFinite(maxSpots) || !Number.isFinite(claimedSpots)) {
    return { ok: false as const, error: "founding_offer_bad_values" };
  }

  return {
    ok: true as const,
    maxSpots,
    claimedSpots,
    remaining: Math.max(0, maxSpots - claimedSpots),
  };
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
    };
  }
  return { ok: true as const, status: res.status, data };
}

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

async function resolvePriceId(stripeKey: string, tier: Tier, configuredPriceId: string | null) {
  if (configuredPriceId) {
    const direct = await stripeGet(`prices/${configuredPriceId}?expand[]=product`, stripeKey);
    if (direct.ok) {
      return { ok: true as const, priceId: configuredPriceId, source: "env" as const };
    }
    if (!isNoSuchPriceError(direct.error)) {
      return { ok: false as const, status: direct.status, error: direct.error };
    }
  }

  const list = await stripeGet("prices?active=true&limit=100&expand[]=data.product", stripeKey);
  if (!list.ok) {
    return { ok: false as const, status: list.status, error: list.error };
  }

  const fallback = pickFallbackPrice(list.data, tier);
  if (!fallback?.id) {
    return { ok: false as const, status: 404, error: `No active fallback price found for ${tier}` };
  }

  return { ok: true as const, priceId: fallback.id as string, source: "fallback" as const };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return json(req, 200, { ok: true });
  if (req.method !== "POST") return json(req, 405, { error: "method_not_allowed" });

  const DEBUG = (getEnv("DEBUG") ?? "false") === "true";

  try {
    const stripeKey = getEnv("STRIPE_SECRET_KEY");
    const siteUrl = getEnv("SITE_URL");

    const priceStarter = getEnv("STRIPE_PRICE_STARTER_MONTHLY");
    const pricePro = getEnv("STRIPE_PRICE_PRO_MONTHLY");
    const priceFounder = getEnv("STRIPE_PRICE_FOUNDER_ANNUAL");
    const priceElite = getEnv("STRIPE_PRICE_ELITE_MONTHLY"); // optional (falls back by product token)

    if (!stripeKey) return json(req, 500, { error: "Missing STRIPE_SECRET_KEY" });
    if (!siteUrl) return json(req, 500, { error: "Missing SITE_URL (required for prod redirects)" });
    if (!priceStarter || !pricePro || !priceFounder) {
      return json(req, 500, {
        error: "Missing Stripe price env vars",
        missing: {
          STRIPE_PRICE_STARTER_MONTHLY: !priceStarter,
          STRIPE_PRICE_PRO_MONTHLY: !pricePro,
          STRIPE_PRICE_FOUNDER_ANNUAL: !priceFounder,
        },
      });
    }

    let payload: any = {};
    try {
      payload = await req.json();
    } catch {
      payload = {};
    }

    const tier = assertTier(payload?.tier);
    if (!tier) {
      return json(req, 400, {
        error: "invalid_tier",
        allowed: ["starter_monthly", "pro_monthly", "founder_annual", "elite_monthly"],
        received: payload?.tier ?? null,
      });
    }

    const authHeader = req.headers.get("authorization") ?? "";
    const { userId, reason, detail } = await getUserIdFromJwt(authHeader);

    if (!userId) {
      if (DEBUG) console.log("[create-checkout-session] auth failed", { reason, detail });
      return json(req, 401, { error: "not_authenticated", reason });
    }

    // Rollout guard: Elite is blocked until Founder spots are fully claimed.
    // Founder is blocked once spots are exhausted.
    if (tier === "founder_annual" || tier === "elite_monthly") {
      const rollout = await fetchFounderRolloutState();

      if (!rollout.ok) {
        return json(req, 503, {
          error: "founder_rollout_unavailable",
          detail: rollout.error,
        });
      }

      if (tier === "elite_monthly" && rollout.remaining > 0) {
        return json(req, 403, {
          error: "elite_locked_until_founder_full",
          founder_spots_left: rollout.remaining,
        });
      }

      if (tier === "founder_annual" && rollout.remaining <= 0) {
        return json(req, 403, {
          error: "founder_closed_elite_live",
          founder_spots_left: rollout.remaining,
        });
      }
    }

    let plan: Plan = "pro";
    let interval: "monthly" | "annual" = "monthly";
    let configuredPriceId: string | null = null;

    if (tier === "starter_monthly") {
      plan = "starter";
      interval = "monthly";
      configuredPriceId = priceStarter;
    } else if (tier === "pro_monthly") {
      plan = "pro";
      interval = "monthly";
      configuredPriceId = pricePro;
    } else if (tier === "founder_annual") {
      plan = "founder";
      interval = "annual";
      configuredPriceId = priceFounder;
    } else if (tier === "elite_monthly") {
      plan = "elite";
      interval = "monthly";
      configuredPriceId = priceElite;
    }

    const priceResolve = await resolvePriceId(stripeKey, tier, configuredPriceId);
    if (!priceResolve.ok) {
      return json(req, 500, {
        error: priceResolve.error,
        stripe_status: priceResolve.status,
        used: { tier, plan, interval, configuredPriceId },
      });
    }
    const priceId = priceResolve.priceId;

    const redirectBase = pickRedirectBase(req, siteUrl);
    const successUrl = `${redirectBase}/app?checkout=success`;
    const cancelUrl = `${redirectBase}/pricing?checkout=cancel`;

    const form = new URLSearchParams();
    form.set("mode", "subscription");
    form.set("success_url", successUrl);
    form.set("cancel_url", cancelUrl);
    form.set("line_items[0][price]", priceId);
    form.set("line_items[0][quantity]", "1");
    form.set("billing_address_collection", "auto");
    form.set("allow_promotion_codes", "true");

    form.set("client_reference_id", userId);

    // metadata for webhook
    form.set("metadata[user_id]", userId);
    form.set("metadata[tier]", tier);
    form.set("metadata[plan]", plan);
    form.set("metadata[interval]", interval);

    form.set("subscription_data[metadata][user_id]", userId);
    form.set("subscription_data[metadata][tier]", tier);
    form.set("subscription_data[metadata][plan]", plan);
    form.set("subscription_data[metadata][interval]", interval);

    const stripeRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stripeKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
    });

    const stripeText = await stripeRes.text();

    if (!stripeRes.ok) {
      let stripeJson: any = null;
      try {
        stripeJson = JSON.parse(stripeText);
      } catch {}

      if (DEBUG) console.error("[create-checkout-session] stripe error", stripeJson ?? stripeText);

      return json(req, 500, {
        error: stripeJson?.error?.message ?? "Stripe request failed",
        stripe_status: stripeRes.status,
        used: { tier, plan, interval, configuredPriceId, resolvedPriceId: priceId, resolvedFrom: priceResolve.source },
      });
    }

    const session = JSON.parse(stripeText);
    return json(req, 200, { url: session.url, id: session.id });
  } catch (e) {
    console.error("[create-checkout-session] fatal", safeErr(e));
    return json(req, 500, { error: "Server error", details: safeErr(e) });
  }
});
