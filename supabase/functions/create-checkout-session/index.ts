// supabase/functions/create-checkout-session/index.ts
/// <reference deno.land/x/supabase_functions@1.0.0/mod.ts />

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

type Plan = "free" | "starter" | "pro" | "founder" | "studio";
type Tier = "starter_monthly" | "pro_monthly" | "founder_annual" | "studio_monthly";

function getEnv(name: string) {
  const v = Deno.env.get(name);
  return v && v.trim().length ? v.trim() : null;
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

function corsHeaders(req: Request) {
  const origin = req.headers.get("origin") ?? "";
  const allowlistRaw = getEnv("ALLOWED_ORIGINS") ?? "";
  const allowlist = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:4173",
    "http://127.0.0.1:4173",
    ...allowlistRaw.split(",").map((s) => s.trim()).filter(Boolean),
  ];
  const uniqueAllowlist = Array.from(new Set(allowlist));
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
  if (t === "studio_monthly") return "studio_monthly";
  return null;
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
    const priceStudio = getEnv("STRIPE_PRICE_STUDIO_MONTHLY"); // optional (only used if you have it)

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
        allowed: ["starter_monthly", "pro_monthly", "founder_annual", "studio_monthly"],
        received: payload?.tier ?? null,
      });
    }

    const authHeader = req.headers.get("authorization") ?? "";
    const { userId, reason, detail } = await getUserIdFromJwt(authHeader);

    if (!userId) {
      if (DEBUG) console.log("[create-checkout-session] auth failed", { reason, detail });
      return json(req, 401, { error: "not_authenticated", reason });
    }

    let plan: Plan = "pro";
    let interval: "monthly" | "annual" = "monthly";
    let priceId: string | null = null;

    if (tier === "starter_monthly") {
      plan = "starter";
      interval = "monthly";
      priceId = priceStarter;
    } else if (tier === "pro_monthly") {
      plan = "pro";
      interval = "monthly";
      priceId = pricePro;
    } else if (tier === "founder_annual") {
      plan = "founder";
      interval = "annual";
      priceId = priceFounder;
    } else if (tier === "studio_monthly") {
      plan = "studio";
      interval = "monthly";
      priceId = priceStudio;
    }

    if (!priceId) {
      return json(req, 500, {
        error: "Missing price for tier (set STRIPE_PRICE_STUDIO_MONTHLY if using Studio)",
        tier,
      });
    }

    const successUrl = `${siteUrl}/app?checkout=success`;
    const cancelUrl = `${siteUrl}/pricing?checkout=cancel`;

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
        used: { tier, plan, interval, priceId },
      });
    }

    const session = JSON.parse(stripeText);
    return json(req, 200, { url: session.url, id: session.id });
  } catch (e) {
    console.error("[create-checkout-session] fatal", safeErr(e));
    return json(req, 500, { error: "Server error", details: safeErr(e) });
  }
});
