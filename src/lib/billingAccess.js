import { normalizePlanKey } from "./format";
import { supabase } from "./supabase";
import { fetchStudioAccessContext } from "./studioAccess";

const PLAN_RANK = {
  free: 0,
  pro: 1,
  studio: 2,
};

function hasActiveStarterTrial(trialEndsAt) {
  const raw = String(trialEndsAt ?? "").trim();
  if (!raw) return false;
  const endMs = Date.parse(raw);
  return Number.isFinite(endMs) && endMs > Date.now();
}

export function normalizeBillingTierWithTrial(value, trialEndsAt) {
  const normalized = normalizePlanKey(value);
  if (normalized === "studio") return "studio";
  if (normalized === "pro" || normalized === "founder" || normalized === "elite") return "pro";
  if (normalized === "starter" && hasActiveStarterTrial(trialEndsAt)) return "pro";
  return "free";
}

export function normalizeAccessPlanKey(value, trialEndsAt = null) {
  const normalizedPlan = normalizePlanKey(value);
  if (normalizedPlan === "studio") return "studio";
  if (
    normalizedPlan === "pro" ||
    normalizedPlan === "starter" ||
    normalizedPlan === "founder" ||
    normalizedPlan === "elite"
  ) {
    if (normalizedPlan === "starter") {
      return normalizeBillingTierWithTrial(normalizedPlan, trialEndsAt);
    }
    return "pro";
  }
  return "free";
}

export function isActiveSubscriptionRow(row) {
  if (!row) return false;

  const status = String(row.status ?? "").trim().toLowerCase();
  if (status !== "active" && status !== "trialing") return false;
  if (!row.current_period_end) return true;

  return new Date(row.current_period_end).getTime() > Date.now();
}

function defaultProfileBillingSnapshot() {
  return {
    billing_tier: null,
    plan: null,
    trial_ends_at: null,
    studio_member_covered: false,
  };
}

function missingProfileBillingColumn(error) {
  const code = String(error?.code ?? "").trim().toUpperCase();
  const message = `${error?.message ?? ""} ${error?.details ?? ""} ${error?.hint ?? ""}`.toLowerCase();
  return (
    code === "42703" ||
    code === "PGRST204" ||
    message.includes("billing_tier") ||
    message.includes("trial_ends_at") ||
    message.includes("studio_member_covered")
  );
}

async function fetchProfileBillingSnapshot(userId) {
  const selectors = [
    "billing_tier, plan, trial_ends_at, studio_member_covered",
    "plan, trial_ends_at, studio_member_covered",
    "plan, studio_member_covered",
    "plan",
  ];

  let lastError = null;

  for (const selector of selectors) {
    const result = await supabase
      .from("profiles")
      .select(selector)
      .eq("id", userId)
      .maybeSingle();

    if (!result.error) {
      return {
        data: {
          ...defaultProfileBillingSnapshot(),
          ...(result.data ?? {}),
        },
        error: null,
      };
    }

    lastError = result.error;
    if (!missingProfileBillingColumn(result.error)) {
      return {
        data: defaultProfileBillingSnapshot(),
        error: result.error,
      };
    }
  }

  return {
    data: defaultProfileBillingSnapshot(),
    error: lastError,
  };
}

function defaultStudioAccess() {
  return {
    hasStudioAccess: false,
    accessType: null,
    studioId: null,
    studioName: null,
    studioOwnerId: null,
    studioMemberRole: null,
    studioMemberCovered: false,
  };
}

function maxPlanKey(a, b) {
  return PLAN_RANK[b] > PLAN_RANK[a] ? b : a;
}

export async function fetchEffectiveBillingAccess(userId) {
  const uid = String(userId ?? "").trim();
  if (!uid) {
    return {
      planKey: "free",
      hasActiveAccess: false,
      canManageWebBilling: false,
      currentPeriodEnd: null,
      interval: null,
      subscriptionPlanKey: "free",
      profilePlanKey: "free",
      studioAccess: defaultStudioAccess(),
      studioMemberCovered: false,
      accessSource: "free",
      warnings: {},
    };
  }

  let studioAccessError = null;

  const [subscriptionResult, profileResult, studioAccess] = await Promise.all([
    supabase
      .from("pro_subscriptions")
      .select("status, interval, plan, current_period_end")
      .eq("user_id", uid)
      .maybeSingle(),
    fetchProfileBillingSnapshot(uid),
    fetchStudioAccessContext(uid).catch((error) => {
      studioAccessError = error;
      return defaultStudioAccess();
    }),
  ]);

  const subscriptionRow = subscriptionResult.data ?? null;
  const profile = profileResult.data ?? defaultProfileBillingSnapshot();

  const subscriptionPlanKey = isActiveSubscriptionRow(subscriptionRow)
    ? normalizeAccessPlanKey(subscriptionRow?.plan, profile?.trial_ends_at)
    : "free";
  const profilePlanKey = normalizeBillingTierWithTrial(
    profile?.billing_tier ?? profile?.plan,
    profile?.trial_ends_at
  );
  const hasStudioAccess = Boolean(studioAccess?.hasStudioAccess);
  const studioMemberCovered =
    Boolean(profile?.studio_member_covered) || Boolean(studioAccess?.studioMemberCovered);

  let planKey = maxPlanKey(subscriptionPlanKey, profilePlanKey);
  let accessSource = planKey === "free" ? "free" : subscriptionPlanKey !== "free" ? "subscription" : "profile";

  if (hasStudioAccess) {
    planKey = "studio";
    accessSource = studioAccess?.accessType === "owner" ? "studio_owner" : "studio_member";
  }

  return {
    planKey,
    hasActiveAccess: planKey !== "free",
    canManageWebBilling:
      (subscriptionPlanKey === "pro" || subscriptionPlanKey === "studio") && !studioMemberCovered,
    currentPeriodEnd: isActiveSubscriptionRow(subscriptionRow)
      ? subscriptionRow?.current_period_end ?? null
      : null,
    interval: subscriptionRow?.interval ?? null,
    subscriptionPlanKey,
    profilePlanKey,
    studioAccess,
    studioMemberCovered,
    accessSource,
    warnings: {
      subscription: subscriptionResult.error ?? null,
      profile: profileResult.error ?? null,
      studioAccess: studioAccessError,
    },
  };
}
