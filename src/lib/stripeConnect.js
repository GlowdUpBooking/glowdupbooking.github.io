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

export async function fetchStripeConnectStatus() {
  try {
    const { data, error } = await supabase.functions.invoke("stripe-connect", {
      body: { action: "status" },
    });

    if (error) throw error;
    return { ...fallbackStatus(), ...(data || {}) };
  } catch (e) {
    console.warn("[stripe-connect] status failed:", e?.message || e);
    return fallbackStatus();
  }
}

export async function createStripeConnectOnboardingLink() {
  const { data, error } = await supabase.functions.invoke("stripe-connect", {
    body: { action: "create_link" },
  });
  if (error) throw error;
  if (!data?.url) throw new Error("No Stripe onboarding URL returned.");
  return data;
}
