/// <reference deno.land/x/supabase_functions@1.0.0/mod.ts />

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const DEFAULT_PLATFORM_ADMIN_EMAILS = ["glowdupbooking@gmail.com"];
const PRO_ROLES = [
  "professional",
  "stylist",
  "pro",
  "owner",
  "staff",
  "studio_owner",
  "studio_staff",
  "team_owner",
  "team_staff",
];

function getEnv(name: string) {
  const value = Deno.env.get(name);
  return value && value.trim().length ? value.trim() : null;
}

function normalizeEmail(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

function parseEmailList(raw: string | null) {
  return String(raw ?? "")
    .split(",")
    .map((value) => normalizeEmail(value))
    .filter(Boolean);
}

function getPlatformAdminEmails() {
  return Array.from(
    new Set([...DEFAULT_PLATFORM_ADMIN_EMAILS, ...parseEmailList(getEnv("PLATFORM_ADMIN_EMAILS"))])
  );
}

function isPlatformAdminEmail(email: unknown) {
  const normalized = normalizeEmail(email);
  return normalized.length > 0 && getPlatformAdminEmails().includes(normalized);
}

function getAllowedOrigins(siteUrl: string | null) {
  const allowlistRaw = getEnv("ALLOWED_ORIGINS") ?? "";
  const siteOrigin = (() => {
    if (!siteUrl) return null;
    try {
      return new URL(siteUrl).origin;
    } catch {
      return null;
    }
  })();

  const allowlist = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:4173",
    "http://127.0.0.1:4173",
    ...allowlistRaw.split(",").map((value) => value.trim()).filter(Boolean),
    ...(siteOrigin ? [siteOrigin] : []),
  ];

  return Array.from(new Set(allowlist));
}

function corsHeaders(req: Request) {
  const origin = req.headers.get("origin") ?? "";
  const allowlist = getAllowedOrigins(getEnv("SITE_URL"));
  const allowed = !origin || allowlist.includes(origin);
  const fallbackOrigin = allowlist[0] ?? "http://localhost:5173";

  return {
    "Access-Control-Allow-Origin": allowed ? (origin || fallbackOrigin) : fallbackOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Credentials": "true",
    Vary: "Origin",
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
    const details = await res.text().catch(() => "");
    return { userId: null, reason: `auth_lookup_failed:${res.status}` as const, details };
  }

  const data = await res.json().catch(() => null);
  const userId = typeof data?.id === "string" ? data.id : null;

  return {
    userId,
    reason: userId ? null : ("missing_id" as const),
  };
}

function getDashboardTimeZone() {
  return getEnv("ADMIN_DASHBOARD_TIMEZONE") ?? "America/Chicago";
}

function datePartsForTimeZone(value: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const parts = formatter.formatToParts(value);
  const mapped = {
    year: parts.find((part) => part.type === "year")?.value ?? "0000",
    month: parts.find((part) => part.type === "month")?.value ?? "01",
    day: parts.find((part) => part.type === "day")?.value ?? "01",
  };

  return {
    ...mapped,
    iso: `${mapped.year}-${mapped.month}-${mapped.day}`,
  };
}

function currentDateContext(timeZone: string) {
  const todayParts = datePartsForTimeZone(new Date(), timeZone);
  const monthNumber = Number(todayParts.month);
  const yearNumber = Number(todayParts.year);
  const nextMonthYear = monthNumber === 12 ? yearNumber + 1 : yearNumber;
  const nextMonthNumber = monthNumber === 12 ? 1 : monthNumber + 1;

  return {
    todayIso: todayParts.iso,
    monthStartIso: `${todayParts.year}-${todayParts.month}-01`,
    nextMonthStartIso: `${String(nextMonthYear).padStart(4, "0")}-${String(nextMonthNumber).padStart(2, "0")}-01`,
    monthPrefix: `${todayParts.year}-${todayParts.month}`,
  };
}

function normalizeRole(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

function normalizePlanKey(value: unknown) {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "studio") return "studio";
  if (
    normalized === "pro" ||
    normalized === "founder" ||
    normalized === "elite" ||
    normalized === "starter"
  ) {
    return "pro";
  }
  return normalized || "free";
}

function isMissingRelationError(error: unknown) {
  const code = String((error as { code?: string } | null)?.code ?? "").trim().toUpperCase();
  const message = String((error as { message?: string } | null)?.message ?? "").toLowerCase();
  return (
    code === "42P01" ||
    code === "PGRST205" ||
    message.includes("does not exist") ||
    message.includes("could not find the table")
  );
}

function sumAmount(rows: Array<{ deposit_amount?: unknown }> | null | undefined) {
  return (rows ?? []).reduce((sum, row) => sum + Number(row?.deposit_amount ?? 0), 0);
}

function isTimestampInMonth(timestamp: unknown, monthPrefix: string, timeZone: string) {
  const date = new Date(String(timestamp ?? ""));
  if (Number.isNaN(date.getTime())) return false;
  return datePartsForTimeZone(date, timeZone).iso.startsWith(monthPrefix);
}

function isTimestampToday(timestamp: unknown, todayIso: string, timeZone: string) {
  const date = new Date(String(timestamp ?? ""));
  if (Number.isNaN(date.getTime())) return false;
  return datePartsForTimeZone(date, timeZone).iso === todayIso;
}

async function listAllAuthUsers(admin: ReturnType<typeof createClient>) {
  const perPage = 500;
  const allUsers: any[] = [];
  let page = 1;

  while (page <= 25) {
    const result = await admin.auth.admin.listUsers({ page, perPage });
    if (result.error) throw result.error;

    const batch = result.data?.users ?? [];
    allUsers.push(...batch);

    if (!result.data?.nextPage || batch.length === 0) break;
    page = result.data.nextPage;
  }

  return allUsers;
}

async function fetchStudioMemberCount(admin: ReturnType<typeof createClient>) {
  const result = await admin
    .from("studio_members")
    .select("id", { count: "exact", head: true })
    .eq("is_active", true);

  if (result.error && isMissingRelationError(result.error)) {
    return { count: 0, error: null };
  }

  return {
    count: result.count ?? 0,
    error: result.error ?? null,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return json(req, 200, { ok: true });
  if (req.method !== "POST") return json(req, 405, { error: "method_not_allowed" });

  try {
    const supabaseUrl = getEnv("SUPABASE_URL");
    const serviceRole = getEnv("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRole) {
      return json(req, 500, { error: "missing_supabase_admin_env" });
    }

    const authHeader = req.headers.get("authorization") ?? "";
    const { userId, reason, details } = await getUserIdFromJwt(authHeader);

    if (!userId) {
      return json(req, 401, { error: "not_authenticated", reason, details: details ?? null });
    }

    const admin = createClient(supabaseUrl, serviceRole, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const viewerResult = await admin.auth.admin.getUserById(userId);
    if (viewerResult.error || !viewerResult.data?.user) {
      return json(req, 500, {
        error: "viewer_lookup_failed",
        details: viewerResult.error?.message ?? null,
      });
    }

    const viewer = viewerResult.data.user;
    if (!isPlatformAdminEmail(viewer.email)) {
      return json(req, 403, {
        error: "forbidden",
        details: "This account is not allowed to view platform metrics.",
      });
    }

    const timeZone = getDashboardTimeZone();
    const { todayIso, monthStartIso, nextMonthStartIso, monthPrefix } = currentDateContext(timeZone);

    const authUsers = await listAllAuthUsers(admin);
    const totalUsers = authUsers.length;
    const newUsersToday = authUsers.filter((user) => isTimestampToday(user.created_at, todayIso, timeZone)).length;
    const newUsersMonth = authUsers.filter((user) =>
      isTimestampInMonth(user.created_at, monthPrefix, timeZone)
    ).length;

    const recentAuthUsers = [...authUsers]
      .sort(
        (left, right) =>
          new Date(String(right?.created_at ?? 0)).getTime() -
          new Date(String(left?.created_at ?? 0)).getTime()
      )
      .slice(0, 8);

    const recentIds = recentAuthUsers.map((entry) => entry.id).filter(Boolean);
    const profileMap = new Map<string, any>();

    if (recentIds.length > 0) {
      const profileResult = await admin
        .from("profiles")
        .select("id, full_name, business_name, role, plan, billing_tier")
        .in("id", recentIds);

      if (profileResult.error) {
        console.warn("[platform-admin-dashboard] recent_profiles_failed", profileResult.error);
      } else {
        for (const profile of profileResult.data ?? []) {
          profileMap.set(profile.id, profile);
        }
      }
    }

    const [
      professionalCountResult,
      studioMemberCountResult,
      bookingsTodayResult,
      bookingsMonthResult,
      pendingBookingsResult,
      completedMonthResult,
      canceledMonthResult,
      salesTodayResult,
      salesMonthResult,
      activeSubscriptionsResult,
    ] = await Promise.all([
      admin
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .in("role", PRO_ROLES),
      fetchStudioMemberCount(admin),
      admin
        .from("appointments")
        .select("id", { count: "exact", head: true })
        .eq("appointment_date", todayIso)
        .not("status", "in", '("canceled","cancelled")'),
      admin
        .from("appointments")
        .select("id", { count: "exact", head: true })
        .gte("appointment_date", monthStartIso)
        .lt("appointment_date", nextMonthStartIso)
        .not("status", "in", '("canceled","cancelled")'),
      admin
        .from("appointments")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending"),
      admin
        .from("appointments")
        .select("id", { count: "exact", head: true })
        .eq("status", "completed")
        .gte("appointment_date", monthStartIso)
        .lt("appointment_date", nextMonthStartIso),
      admin
        .from("appointments")
        .select("id", { count: "exact", head: true })
        .in("status", ["canceled", "cancelled"])
        .gte("appointment_date", monthStartIso)
        .lt("appointment_date", nextMonthStartIso),
      admin
        .from("appointments")
        .select("deposit_amount")
        .eq("deposit_paid", true)
        .eq("appointment_date", todayIso),
      admin
        .from("appointments")
        .select("deposit_amount")
        .eq("deposit_paid", true)
        .gte("appointment_date", monthStartIso)
        .lt("appointment_date", nextMonthStartIso),
      admin
        .from("pro_subscriptions")
        .select("plan, status, current_period_end")
        .in("status", ["active", "trialing"]),
    ]);

    const optionalError = [
      professionalCountResult.error,
      studioMemberCountResult.error,
      bookingsTodayResult.error,
      bookingsMonthResult.error,
      pendingBookingsResult.error,
      completedMonthResult.error,
      canceledMonthResult.error,
      salesTodayResult.error,
      salesMonthResult.error,
      activeSubscriptionsResult.error,
    ].find(Boolean);

    if (optionalError) throw optionalError;

    const activeSubscriptions = (activeSubscriptionsResult.data ?? []).filter((row) => {
      if (!row.current_period_end) return true;
      const expiresAt = new Date(String(row.current_period_end));
      return Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() > Date.now();
    });

    const response = {
      generatedAt: new Date().toISOString(),
      timezone: timeZone,
      viewer: {
        id: viewer.id,
        email: viewer.email ?? null,
      },
      users: {
        total: totalUsers,
        newToday: newUsersToday,
        newMonth: newUsersMonth,
        professionals: professionalCountResult.count ?? 0,
        studioMembers: studioMemberCountResult.count ?? 0,
      },
      subscriptions: {
        active: activeSubscriptions.length,
        trialing: activeSubscriptions.filter((row) => String(row.status).toLowerCase() === "trialing").length,
        pro: activeSubscriptions.filter((row) => normalizePlanKey(row.plan) === "pro").length,
        studio: activeSubscriptions.filter((row) => normalizePlanKey(row.plan) === "studio").length,
      },
      bookings: {
        today: bookingsTodayResult.count ?? 0,
        month: bookingsMonthResult.count ?? 0,
        pending: pendingBookingsResult.count ?? 0,
        completedMonth: completedMonthResult.count ?? 0,
        canceledMonth: canceledMonthResult.count ?? 0,
      },
      sales: {
        today: sumAmount(salesTodayResult.data),
        month: sumAmount(salesMonthResult.data),
      },
      recentUsers: recentAuthUsers.map((entry) => {
        const profile = profileMap.get(entry.id);
        return {
          id: entry.id,
          email: entry.email ?? null,
          createdAt: entry.created_at ?? null,
          emailConfirmed: Boolean(entry.email_confirmed_at),
          fullName: profile?.full_name ?? null,
          businessName: profile?.business_name ?? null,
          role: normalizeRole(profile?.role) || null,
          planKey: normalizePlanKey(profile?.billing_tier ?? profile?.plan),
        };
      }),
    };

    return json(req, 200, response);
  } catch (error) {
    console.error("[platform-admin-dashboard] failed", error);
    return json(req, 500, {
      error: "dashboard_load_failed",
      details: error instanceof Error ? error.message : String(error),
    });
  }
});
