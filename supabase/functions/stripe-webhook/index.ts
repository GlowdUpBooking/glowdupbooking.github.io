/// <reference lib="deno.ns" />
import Stripe from "https://esm.sh/stripe@14.25.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY");
const STRIPE_WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const stripe = STRIPE_SECRET_KEY
  ? new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2023-10-16" })
  : null;
const admin = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    })
  : null;

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

type Tier = "starter_monthly" | "pro_monthly" | "founder_annual" | "studio_monthly";
type Interval = "monthly" | "annual";

function normalizeFromTier(tier: Tier) {
  if (tier === "starter_monthly") return { plan: "starter", interval: "monthly" as Interval };
  if (tier === "pro_monthly") return { plan: "pro", interval: "monthly" as Interval };
  if (tier === "studio_monthly") return { plan: "studio", interval: "monthly" as Interval };
  return { plan: "founder", interval: "annual" as Interval };
}

function readMeta(obj: any) {
  const m = obj?.metadata ?? {};
  const userId = typeof m.user_id === "string" ? m.user_id : null;

  const tier: Tier | null =
    m.tier === "starter_monthly" ||
    m.tier === "pro_monthly" ||
    m.tier === "founder_annual" ||
    m.tier === "studio_monthly"
      ? m.tier
      : null;

  const intervalFromOldMeta: Interval | null =
    m.interval === "monthly" || m.interval === "annual" ? m.interval : null;

  const derived = tier ? normalizeFromTier(tier) : null;

  const plan = typeof m.plan === "string" ? m.plan : derived?.plan ?? "starter";
  const interval = derived?.interval ?? intervalFromOldMeta ?? "monthly";

  return { userId, tier, plan, interval };
}

function periodEndIso(unixSeconds: number | null | undefined) {
  if (!unixSeconds || Number.isNaN(unixSeconds)) return null;
  return new Date(unixSeconds * 1000).toISOString();
}

async function findUserIdByStripeRefs(params: {
  stripeSubscriptionId?: string | null;
  stripeCustomerId?: string | null;
}) {
  if (!admin) return null;
  const filters: string[] = [];

  if (params.stripeSubscriptionId) {
    filters.push(`stripe_subscription_id.eq.${params.stripeSubscriptionId}`);
  }
  if (params.stripeCustomerId) {
    filters.push(`stripe_customer_id.eq.${params.stripeCustomerId}`);
  }
  if (!filters.length) return null;

  const { data, error } = await admin
    .from("pro_subscriptions")
    .select("user_id, updated_at")
    .or(filters.join(","))
    .order("updated_at", { ascending: false })
    .limit(1);

  if (error) throw error;
  return data?.[0]?.user_id ?? null;
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
    { onConflict: "user_id" }
  );
  if (error) throw error;
}

async function claimFounderAnnual(userId: string) {
  if (!admin) return;
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

async function handleSubscriptionLifecycle(sub: Stripe.Subscription, options?: { deleted?: boolean }) {
  const deleted = options?.deleted === true;
  const meta = readMeta(sub);
  const stripeCustomerId = typeof sub.customer === "string" ? sub.customer : null;
  const userId = meta.userId ??
    await findUserIdByStripeRefs({
      stripeSubscriptionId: sub.id,
      stripeCustomerId,
    });

  if (!userId) return { ok: true, note: "missing_user" } as const;

  const status = deleted ? "canceled" : sub.status;
  const plan = meta.plan ?? "starter";
  const interval = meta.interval ?? "monthly";

  await upsertProSubscription({
    userId,
    stripeCustomerId,
    stripeSubscriptionId: sub.id,
    plan,
    interval,
    status,
    currentPeriodEnd: deleted ? null : periodEndIso(sub.current_period_end),
  });

  if (deleted) {
    await admin!
      .from("pro_subscriptions")
      .update({
        is_founder_annual: false,
        founder_claimed_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);
    return { received: true } as const;
  }

  if (
    (meta.tier === "founder_annual" || plan === "founder") &&
    (status === "active" || status === "trialing")
  ) {
    await claimFounderAnnual(userId);
  }

  return { received: true } as const;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });
  if (!stripe || !admin || !STRIPE_WEBHOOK_SECRET) {
    return json(500, { error: "misconfigured_webhook_env" });
  }

  const sig = req.headers.get("stripe-signature");
  if (!sig) return json(400, { error: "missing_signature" });

  const raw = await req.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(raw, sig, STRIPE_WEBHOOK_SECRET);
  } catch (e) {
    return json(400, { error: "bad_signature", details: String(e) });
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;

      const meta = readMeta(session);
      const userId =
        meta.userId ??
        (typeof session.client_reference_id === "string" ? session.client_reference_id : null) ??
        await findUserIdByStripeRefs({
          stripeSubscriptionId: typeof session.subscription === "string" ? session.subscription : null,
          stripeCustomerId: typeof session.customer === "string" ? session.customer : null,
        });

      if (!userId) return json(200, { ok: true, note: "missing_user" });

      const stripeCustomerId = typeof session.customer === "string" ? session.customer : null;
      const stripeSubscriptionId =
        typeof session.subscription === "string" ? session.subscription : null;

      let plan = meta.plan;
      let interval = meta.interval;
      let tier = meta.tier;
      let status = "active";
      let currentPeriodEndIso: string | null = null;

      if (stripeSubscriptionId) {
        const sub = await stripe.subscriptions.retrieve(stripeSubscriptionId);
        status = sub.status;
        currentPeriodEndIso = periodEndIso(sub.current_period_end);

        const subMeta = readMeta(sub);
        tier = tier ?? subMeta.tier;
        plan = subMeta.plan ?? plan;
        interval = subMeta.interval ?? interval;
      }

      await upsertProSubscription({
        userId,
        stripeCustomerId,
        stripeSubscriptionId,
        plan,
        interval,
        status,
        currentPeriodEnd: currentPeriodEndIso,
      });

      // Founder claim only when founder_annual
      if (
        (tier === "founder_annual" || plan === "founder") &&
        (status === "active" || status === "trialing")
      ) {
        await claimFounderAnnual(userId);
      }

      return json(200, { received: true });
    }

    if (event.type === "customer.subscription.created") {
      const sub = event.data.object as Stripe.Subscription;
      return json(200, await handleSubscriptionLifecycle(sub));
    }

    if (event.type === "customer.subscription.updated") {
      const sub = event.data.object as Stripe.Subscription;
      return json(200, await handleSubscriptionLifecycle(sub));
    }

    if (event.type === "customer.subscription.deleted") {
      const sub = event.data.object as Stripe.Subscription;
      return json(200, await handleSubscriptionLifecycle(sub, { deleted: true }));
    }

    return json(200, { received: true, ignored: event.type });
  } catch (e) {
    return json(500, { error: "webhook_failed", details: String(e) });
  }
});
