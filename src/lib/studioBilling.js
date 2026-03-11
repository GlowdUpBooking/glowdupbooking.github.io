import { supabase } from "./supabase";
import { isStudioWebBillingRestricted } from "./siteFlags";

function getEnvOrThrow(name) {
  const value = import.meta.env[name] || "";
  if (!value) {
    throw new Error(`Missing ${name}.`);
  }
  return value;
}

function toAbsoluteUrl(path) {
  const origin = window.location.origin.replace(/\/$/, "");
  const rawPath = String(path || "").trim();
  if (!rawPath) return origin;
  if (/^https?:\/\//i.test(rawPath)) return rawPath;
  const normalizedPath = rawPath.startsWith("/") ? rawPath : `/${rawPath.replace(/^\/+/, "")}`;
  return `${origin}${normalizedPath}`;
}

async function getAuthedRequestContext() {
  const anonKey = getEnvOrThrow("VITE_SUPABASE_ANON_KEY");
  const sbUrl = getEnvOrThrow("VITE_SUPABASE_URL");

  const { data: authData, error: sessErr } = await supabase.auth.getSession();
  if (sessErr) throw sessErr;

  const accessToken = authData?.session?.access_token || "";
  if (!accessToken) {
    throw new Error("Missing session token. Please sign in again.");
  }

  return { anonKey, sbUrl, accessToken };
}

async function invokeWithFallback(functionName, body) {
  const { anonKey, sbUrl, accessToken } = await getAuthedRequestContext();
  const headers = {
    apikey: anonKey,
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };

  const invokeRes = await supabase.functions.invoke(functionName, {
    body,
    headers,
  });

  if (!invokeRes.error && invokeRes.data) {
    return invokeRes.data;
  }

  const fnUrl = `${sbUrl}/functions/v1/${functionName}`;
  const res = await fetch(fnUrl, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }

  if (!res.ok) {
    throw new Error(json?.error || json?.message || `Edge Function failed (${res.status})`);
  }

  return json;
}

export async function createStudioBillingSession(options = {}) {
  if (isStudioWebBillingRestricted()) {
    throw new Error("Studio billing is not available from this device. Use the desktop web app.");
  }

  const intent = options.intent === "manage" ? "manage" : "checkout";
  const returnPath = options.returnPath || "/app/subscription";
  const successPath =
    options.successPath || "/app/subscription?studio=success&session_id={CHECKOUT_SESSION_ID}";
  const cancelPath = options.cancelPath || "/app/subscription?studio=cancel";

  const payload = await invokeWithFallback("create-studio-subscription-session", {
    intent,
    return_url: toAbsoluteUrl(returnPath),
    success_url: toAbsoluteUrl(successPath),
    cancel_url: toAbsoluteUrl(cancelPath),
  });

  const url = String(payload?.url || "").trim();
  if (!url) {
    throw new Error("No Studio billing URL returned.");
  }

  return {
    url,
    mode: String(payload?.mode || intent),
  };
}

export async function syncStudioSubscription(sessionId) {
  const payload = {};
  if (sessionId) payload.session_id = sessionId;
  return invokeWithFallback("sync-stripe-subscription", payload);
}
