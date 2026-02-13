/// <reference lib="deno.ns" />
import Stripe from "https://esm.sh/stripe@14.25.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SITE_URL = Deno.env.get("SITE_URL")!;

const PRICE_MONTHLY = Deno.env.get("STRIPE_PRICE_PRO_MONTHLY")!;
const PRICE_6MO = Deno.env.get("STRIPE_PRICE_PRO_6MO")!;
const PRICE_ANNUAL = Deno.env.get("STRIPE_PRICE_PRO_ANNUAL")!;

const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2023-10-16" });

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  const authHeader = req.headers.get("Authorization") ?? "";
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });

  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData?.user) return json(401, { error: "not_authenticated" });

  const userId = userData.user.id;

  let interval: "monthly" | "6mo" | "annual";
  try {
    const body = await req.json();
    interval = body.interval; // <- IMPORTANT: use "interval" consistently
  } catch {
    return json(400, { error: "invalid_json" });
  }

  const price =
    interval === "monthly" ? PRICE_MONTHLY :
    interval === "6mo" ? PRICE_6MO :
    interval === "annual" ? PRICE_ANNUAL :
    null;

  if (!price) return json(400, { error: "invalid_interval" });

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price, quantity: 1 }],
    client_reference_id: userId,

    // ✅ metadata on session
    metadata: { user_id: userId, plan: "pro", interval },

    // ✅ metadata on subscription (this is the big fix)
    subscription_data: {
      metadata: { user_id: userId, plan: "pro", interval },
    },

    success_url: `${SITE_URL}/pricing?p=${encodeURIComponent("/pricing?success=1")}`,
    cancel_url: `${SITE_URL}/pricing?p=${encodeURIComponent("/pricing?canceled=1")}`,
  });

  return json(200, { url: session.url });
});