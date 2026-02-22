import { supabase } from "./supabase";

function fallbackStatus() {
  return {
    connected: false,
    account_id: null,
    charges_enabled: false,
    payouts_enabled: false,
    details_submitted: false,
    status: "not_started",
  };
}

async function formatInvokeError(error) {
  if (!error) return "Unknown edge function error.";
  try {
    if (error.context && typeof error.context.text === "function") {
      const raw = await error.context.text();
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          const message = [
            parsed?.error || "Edge Function error",
            parsed?.details ? `(${parsed.details})` : "",
            parsed?.reason ? `[${parsed.reason}]` : "",
          ]
            .filter(Boolean)
            .join(" ");
          return message || raw;
        } catch {
          return raw;
        }
      }
    }
  } catch {
    // fall through
  }
  return error.message || "Edge Function request failed.";
}

export async function fetchStripeConnectStatus() {
  try {
    const { data, error } = await supabase.functions.invoke("stripe-connect", {
      body: { action: "status" },
    });

    if (error) throw new Error(await formatInvokeError(error));
    return { ...fallbackStatus(), ...(data || {}) };
  } catch {
    return fallbackStatus();
  }
}

export async function createStripeConnectOnboardingLink() {
  const { data, error } = await supabase.functions.invoke("stripe-connect", {
    body: { action: "create_link" },
  });
  if (error) throw new Error(await formatInvokeError(error));
  if (!data?.url) throw new Error("No Stripe onboarding URL returned.");
  return data;
}
