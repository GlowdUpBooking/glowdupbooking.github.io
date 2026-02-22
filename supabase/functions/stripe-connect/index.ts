/// <reference deno.land/x/supabase_functions@1.0.0/mod.ts />

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

function getEnv(name: string) {
  const v = Deno.env.get(name);
  return v && v.trim().length ? v.trim() : null;
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

function stripeHeaders(stripeKey: string) {
  return {
    Authorization: `Bearer ${stripeKey}`,
    "Content-Type": "application/x-www-form-urlencoded",
  };
}

function isNoSuchAccount(stripeError: any) {
  const msg = String(stripeError?.message ?? "").toLowerCase();
  const code = String(stripeError?.code ?? "").toLowerCase();
  const param = String(stripeError?.param ?? "").toLowerCase();
  return (
    msg.includes("no such account") ||
    (code === "resource_missing" && (param === "account" || msg.includes("account")))
  );
}

function notStartedStatus() {
  return {
    connected: false,
    account_id: null,
    charges_enabled: false,
    payouts_enabled: false,
    details_submitted: false,
    status: "not_started",
  };
}

async function createExpressConnectAccount(params: {
  stripeKey: string;
  userId: string;
  email: string | null | undefined;
}) {
  const createForm = new URLSearchParams();
  createForm.set("type", "express");
  createForm.set("country", "US");
  if (params.email) createForm.set("email", params.email);
  createForm.set("capabilities[card_payments][requested]", "true");
  createForm.set("capabilities[transfers][requested]", "true");
  createForm.set("metadata[user_id]", params.userId);

  const createRes = await stripePost("accounts", createForm, params.stripeKey);
  if (!createRes.ok) return { ok: false as const, createRes };
  const accountId = createRes.data?.id ?? null;
  if (!accountId) return { ok: false as const, createRes };
  return { ok: true as const, accountId };
}

async function createAccountLink(params: {
  stripeKey: string;
  accountId: string;
  siteUrl: string;
}) {
  const refreshUrl = `${params.siteUrl}/app/onboarding/payouts?stripe=refresh`;
  const returnUrl = `${params.siteUrl}/app/onboarding/payouts?stripe=return`;

  const linkForm = new URLSearchParams();
  linkForm.set("account", params.accountId);
  linkForm.set("type", "account_onboarding");
  linkForm.set("refresh_url", refreshUrl);
  linkForm.set("return_url", returnUrl);

  return stripePost("account_links", linkForm, params.stripeKey);
}

async function stripePost(path: string, params: URLSearchParams, stripeKey: string) {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: "POST",
    headers: stripeHeaders(stripeKey),
    body: params.toString(),
  });
  const text = await res.text();
  let data: any = null;
  try {
    data = JSON.parse(text);
  } catch {}
  return { ok: res.ok, status: res.status, data, text };
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
  } catch {}
  return { ok: res.ok, status: res.status, data, text };
}

function statusFromAccount(account: any) {
  const chargesEnabled = !!account?.charges_enabled;
  const payoutsEnabled = !!account?.payouts_enabled;
  const detailsSubmitted = !!account?.details_submitted;
  const connected = chargesEnabled && payoutsEnabled && detailsSubmitted;

  return {
    connected,
    charges_enabled: chargesEnabled,
    payouts_enabled: payoutsEnabled,
    details_submitted: detailsSubmitted,
    status: connected ? "connected" : detailsSubmitted ? "pending_review" : "pending_onboarding",
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return json(req, 200, { ok: true });
  if (req.method !== "POST") return json(req, 405, { error: "method_not_allowed" });

  const stripeKey = getEnv("STRIPE_SECRET_KEY");
  const siteUrl = getEnv("SITE_URL");
  const supabaseUrl = getEnv("SUPABASE_URL");
  const serviceRole = getEnv("SUPABASE_SERVICE_ROLE_KEY");

  if (!stripeKey) return json(req, 500, { error: "missing_stripe_key" });
  if (!siteUrl) {
    console.error("[stripe-connect] missing_site_url");
    return json(req, 500, { error: "missing_site_url" });
  }
  if (!supabaseUrl || !serviceRole) {
    console.error("[stripe-connect] missing_supabase_admin_env", {
      hasSupabaseUrl: Boolean(supabaseUrl),
      hasServiceRole: Boolean(serviceRole),
    });
    return json(req, 500, { error: "missing_supabase_admin_env" });
  }

  let payload: any = {};
  try {
    payload = await req.json();
  } catch {
    payload = {};
  }
  const action = String(payload?.action || "status");

  const authHeader = req.headers.get("authorization") ?? "";
  const { userId, reason } = await getUserIdFromJwt(authHeader);
  if (!userId) return json(req, 401, { error: "not_authenticated", reason });

  const admin = createClient(supabaseUrl, serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const userRes = await admin.auth.admin.getUserById(userId);
  if (userRes.error || !userRes.data?.user) {
    console.error("[stripe-connect] user_lookup_failed", userRes.error);
    return json(req, 500, { error: "user_lookup_failed", details: userRes.error?.message || null });
  }

  const authUser = userRes.data.user;
  const existingMeta = authUser.user_metadata || {};
  let accountId = typeof existingMeta?.stripe_connect_account_id === "string"
    ? existingMeta.stripe_connect_account_id
    : null;

  if (action === "status") {
    if (!accountId) {
      return json(req, 200, notStartedStatus());
    }

    const accountRes = await stripeGet(`accounts/${accountId}`, stripeKey);
    if (!accountRes.ok) {
      const stripeError = accountRes.data?.error;
      if (isNoSuchAccount(stripeError)) {
        await admin.auth.admin.updateUserById(userId, {
          user_metadata: {
            ...existingMeta,
            stripe_connect_account_id: null,
            stripe_connect_status: "not_started",
          },
        });
        return json(req, 200, notStartedStatus());
      }

      console.error("[stripe-connect] stripe_account_fetch_failed", accountRes.data ?? accountRes.text);
      return json(req, 500, {
        error: "stripe_account_fetch_failed",
        status_code: accountRes.status,
        details: stripeError?.message ?? accountRes.text,
      });
    }

    const statusPayload = statusFromAccount(accountRes.data);
    await admin.auth.admin.updateUserById(userId, {
      user_metadata: {
        ...existingMeta,
        stripe_connect_account_id: accountId,
        stripe_connect_status: statusPayload.status,
      },
    });

    return json(req, 200, { account_id: accountId, ...statusPayload });
  }

  if (action !== "create_link") {
    return json(req, 400, { error: "invalid_action", allowed: ["status", "create_link"] });
  }

  if (!accountId) {
    const created = await createExpressConnectAccount({
      stripeKey,
      userId,
      email: authUser.email,
    });
    if (!created.ok) {
      console.error("[stripe-connect] stripe_account_create_failed", created.createRes.data ?? created.createRes.text);
      return json(req, 500, {
        error: "stripe_account_create_failed",
        status_code: created.createRes.status,
        details: created.createRes.data?.error?.message ?? created.createRes.text,
      });
    }

    accountId = created.accountId;
  }

  let linkRes = await createAccountLink({
    stripeKey,
    accountId,
    siteUrl,
  });

  // Migration guard: test-mode account IDs can be stale when moving to live mode.
  if (!linkRes.ok && isNoSuchAccount(linkRes.data?.error)) {
    const created = await createExpressConnectAccount({
      stripeKey,
      userId,
      email: authUser.email,
    });
    if (!created.ok) {
      console.error("[stripe-connect] stripe_account_create_failed_after_stale_id", created.createRes.data ?? created.createRes.text);
      return json(req, 500, {
        error: "stripe_account_create_failed",
        status_code: created.createRes.status,
        details: created.createRes.data?.error?.message ?? created.createRes.text,
      });
    }

    accountId = created.accountId;
    linkRes = await createAccountLink({
      stripeKey,
      accountId,
      siteUrl,
    });
  }

  if (!linkRes.ok) {
    console.error("[stripe-connect] stripe_account_link_failed", linkRes.data ?? linkRes.text);
    return json(req, 500, {
      error: "stripe_account_link_failed",
      status_code: linkRes.status,
      details: linkRes.data?.error?.message ?? linkRes.text,
    });
  }

  await admin.auth.admin.updateUserById(userId, {
    user_metadata: {
      ...existingMeta,
      stripe_connect_account_id: accountId,
      stripe_connect_status: "pending_onboarding",
    },
  });

  return json(req, 200, {
    url: linkRes.data?.url ?? null,
    account_id: accountId,
    status: "pending_onboarding",
  });
});
