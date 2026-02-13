/// <reference lib="deno.ns" />
import Stripe from "https://esm.sh/stripe@14.25.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;
const STRIPE_WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2023-10-16" });
const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function readMeta(obj: any) {
  const m = obj?.metadata ?? {};
  return {
    userId: typeof m.user_id === "string" ? m.user_id : null,
    plan: typeof m.plan === "string" ? m.plan : "pro",
    interval:
      m.interval === "monthly" || m.interval === "6mo" || m.interval === "annual"
        ? m.interval
        : null,
  };
}

async function upsertProSubscription(params: {
  userId: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  plan: string;
  interval: string;
  status: string;
  currentPeriodEnd: string | null;
}) {
  const { error } = await admin.from("pro_subscriptions").upsert(
    {
      user_id: params.userId,
      stripe_customer_id: params.stripeCustomerId,
      stripe_subscription_id: params.stripeSubscriptionId,
      plan: params.plan,
      interval: params.interval,
      status: params.status,
      current_period_end: params.currentPeriodEnd,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (error) throw error;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  const sig = req.headers.get("stripe-signature");
  if (!sig) return json(400, { error: "missing_signature" });

  const raw = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig, STRIPE_WEBHOOK_SECRET);
  } catch (e) {
    return json(400, { error: "bad_signature", details: String(e) });
  }

  try {
    // ✅ checkout completed = guaranteed moment to write subscription row
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;

      // Map userId: prefer metadata, fallback to client_reference_id
      const meta = readMeta(session);
      const userId =
        meta.userId ??
        (typeof session.client_reference_id === "string" ? session.client_reference_id : null);

      if (!userId) return json(200, { ok: true, note: "missing_user" });

      const stripeCustomerId =
        typeof session.customer === "string" ? session.customer : null;

      const stripeSubscriptionId =
        typeof session.subscription === "string" ? session.subscription : null;

      let interval = meta.interval; // monthly/6mo/annual
      let plan = meta.plan ?? "pro";
      let status = "active";
      let currentPeriodEndIso: string | null = null;

      if (stripeSubscriptionId) {
        const sub = await stripe.subscriptions.retrieve(stripeSubscriptionId);
        status = sub.status;
        currentPeriodEndIso = new Date(sub.current_period_end * 1000).toISOString();

        // If metadata wasn’t present on session, it SHOULD be on subscription (after our fix)
        const subMeta = readMeta(sub);
        interval = interval ?? subMeta.interval;
        plan = subMeta.plan ?? plan;
      }

      // If interval still missing, default to monthly so row still exists (prevents bouncing)
      interval = interval ?? "monthly";

      await upsertProSubscription({
        userId,
        stripeCustomerId,
        stripeSubscriptionId,
        plan,
        interval,
        status,
        currentPeriodEnd: currentPeriodEndIso,
      });

      // Founder annual claim (first 500 annual only)
      if (interval === "annual") {
        const { data } = await admin.rpc("claim_founder_annual", { p_user_id: userId });
        if (data?.claimed === true) {
          await admin
            .from("pro_subscriptions")
            .update({
              is_founder_annual: true,
              founder_claimed_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("user_id", userId);
        }
      }

      return json(200, { received: true });
    }

    // keep row in sync on updates
    if (event.type === "customer.subscription.updated") {
      const sub = event.data.object as Stripe.Subscription;
      const meta = readMeta(sub);
      if (!meta.userId || !meta.interval) return json(200, { ok: true, note: "missing_meta" });

      const currentPeriodEndIso = new Date(sub.current_period_end * 1000).toISOString();

      await upsertProSubscription({
        userId: meta.userId,
        stripeCustomerId: typeof sub.customer === "string" ? sub.customer : null,
        stripeSubscriptionId: sub.id,
        plan: meta.plan ?? "pro",
        interval: meta.interval,
        status: sub.status,
        currentPeriodEnd: currentPeriodEndIso,
      });

      return json(200, { received: true });
    }

    // cancel/ended
    if (event.type === "customer.subscription.deleted") {
      const sub = event.data.object as Stripe.Subscription;
      const meta = readMeta(sub);
      if (!meta.userId) return json(200, { ok: true, note: "missing_user" });

      await upsertProSubscription({
        userId: meta.userId,
        stripeCustomerId: typeof sub.customer === "string" ? sub.customer : null,
        stripeSubscriptionId: sub.id,
        plan: meta.plan ?? "pro",
        interval: meta.interval ?? "monthly",
        status: "canceled",
        currentPeriodEnd: null,
      });

      // forfeits founder if you want “only while active”
      await admin
        .from("pro_subscriptions")
        .update({
          is_founder_annual: false,
          founder_claimed_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", meta.userId);

      return json(200, { received: true });
    }

    return json(200, { received: true, ignored: event.type });
  } catch (e) {
    return json(500, { error: "webhook_failed", details: String(e) });
  }
});