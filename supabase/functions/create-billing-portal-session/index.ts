// supabase/functions/create-billing-portal-session/index.ts
/// <reference deno.land/x/supabase_functions@1.0.0/mod.ts />

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

function getEnv(name: string) {
  const v = Deno.env.get(name);
  return v && v.trim().length ? v.trim() : null;
}

function corsHeaders(req: Request) {
  const origin = req.headers.get("origin") ?? "";
  const allowlistRaw =
    getEnv("ALLOWED_ORIGINS") ?? "http://localhost:5173,http://127.0.0.1:5173";
  const allowlist = allowlistRaw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const allowed = allowlist.includes(origin);
  return {
    "Access-Control-Allow-Origin": allowed ? origin : allowlist[0] ?? "",
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
    headers: {
      Authorization: auth,
      apikey: anonKey,
    },
  });

  if (!res.ok) {
    const t = await res.text().catch(() => "");
    return {
      userId: null,
      reason: `auth_lookup_failed:${res.status}` as const,
      detail: t,
    };
  }

  const data = await res.json().catch(() => null);
  const userId = typeof data?.id === "string" ? data.id : null;
  return { userId, reason: userId ? null : ("missing_id" as const) };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return json(req, 200, { ok: true });
  if (req.method !== "POST") return json(req, 405, { error: "method_not_allowed" });

  try {
    const stripeKey = getEnv("STRIPE_SECRET_KEY");
    const siteUrl = getEnv("SITE_URL");
    const supabaseUrl = getEnv("SUPABASE_URL") ?? getEnv("SB_URL");
    const serviceRoleKey =
      getEnv("SUPABASE_SERVICE_ROLE_KEY") ?? getEnv("SB_SERVICE_ROLE_KEY");

    if (!stripeKey) return json(req, 500, { error: "Missing STRIPE_SECRET_KEY" });
    if (!siteUrl) return json(req, 500, { error: "Missing SITE_URL" });
    if (!supabaseUrl || !serviceRoleKey) {
      return json(req, 500, { error: "Missing Supabase service role env vars" });
    }

    const authHeader = req.headers.get("authorization") ?? "";
    const { userId, reason } = await getUserIdFromJwt(authHeader);

    if (!userId) {
      return json(req, 401, { error: "not_authenticated", reason });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const { data: subRow, error: subErr } = await admin
      .from("pro_subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (subErr) {
      return json(req, 500, {
        error: "subscription_lookup_failed",
        details: subErr.message,
      });
    }

    const customerId = subRow?.stripe_customer_id;
    if (!customerId) {
      return json(req, 400, {
        error: "no_stripe_customer",
        message: "No Stripe customer exists yet for this account.",
      });
    }

    let payload: any = {};
    try {
      payload = await req.json();
    } catch {
      payload = {};
    }

    const reqPath = typeof payload?.return_path === "string" ? payload.return_path.trim() : "";
    const safePath = reqPath.startsWith("/") ? reqPath : "/app";
    const returnUrl = `${siteUrl.replace(/\/+$/, "")}${safePath}`;

    const form = new URLSearchParams();
    form.set("customer", customerId);
    form.set("return_url", returnUrl);

    const stripeRes = await fetch("https://api.stripe.com/v1/billing_portal/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stripeKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
    });

    const text = await stripeRes.text();
    if (!stripeRes.ok) {
      let stripeJson: any = null;
      try {
        stripeJson = JSON.parse(text);
      } catch {
        stripeJson = null;
      }

      return json(req, 500, {
        error: "stripe_billing_portal_failed",
        message: stripeJson?.error?.message ?? text ?? "Stripe request failed",
      });
    }

    const session = JSON.parse(text);
    return json(req, 200, { url: session.url, id: session.id });
  } catch (e) {
    const anyE = e as any;
    return json(req, 500, {
      error: "server_error",
      message: anyE?.message ?? String(e),
    });
  }
});
