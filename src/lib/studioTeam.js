import { supabase } from "./supabase";

export const STUDIO_BASE_MONTHLY_PRICE = 39.99;
export const STUDIO_INCLUDED_ACCOUNTS = 3;
export const STUDIO_EXTRA_ACCOUNT_MONTHLY_PRICE = 9.99;
export const STUDIO_MAX_ACCOUNTS = 10;

export function getStudioSeatSummary(activeAccounts) {
  const normalizedActive = Math.max(0, Math.min(STUDIO_MAX_ACCOUNTS, Math.round(Number(activeAccounts ?? 0))));
  const includedUsed = Math.min(STUDIO_INCLUDED_ACCOUNTS, normalizedActive);
  const extraAccounts = Math.max(0, normalizedActive - STUDIO_INCLUDED_ACCOUNTS);
  const monthlyEstimated = STUDIO_BASE_MONTHLY_PRICE + extraAccounts * STUDIO_EXTRA_ACCOUNT_MONTHLY_PRICE;
  const seatsRemaining = Math.max(0, STUDIO_MAX_ACCOUNTS - normalizedActive);

  return {
    activeAccounts: normalizedActive,
    includedUsed,
    extraAccounts,
    seatsRemaining,
    monthlyEstimated,
  };
}

async function getSupabaseClient() {
  return supabase;
}

function asObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value;
}

function asString(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizePercentage(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 100;
  return Math.min(100, Math.max(0, Math.round(parsed)));
}

function normalizeStudioMemberRole(value) {
  const normalized = String(value ?? "staff").trim().toLowerCase();
  if (normalized === "owner") return "owner";
  if (normalized === "manager") return "manager";
  if (normalized === "assistant") return "assistant";
  return "staff";
}

function normalizeResourceType(value) {
  const normalized = String(value ?? "calendar").trim().toLowerCase();
  if (normalized === "chair") return "chair";
  if (normalized === "room") return "room";
  if (normalized === "station") return "station";
  return "calendar";
}

function normalizeRentCadence(value) {
  const normalized = String(value ?? "weekly").trim().toLowerCase();
  return normalized === "monthly" ? "monthly" : "weekly";
}

function normalizeMoneyAmount(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.round((parsed + Number.EPSILON) * 100) / 100);
}

function normalizeDueWeekday(value) {
  const parsed = Math.round(Number(value));
  if (!Number.isFinite(parsed)) return null;
  return Math.min(6, Math.max(0, parsed));
}

function normalizeDueDayOfMonth(value) {
  const parsed = Math.round(Number(value));
  if (!Number.isFinite(parsed)) return null;
  return Math.min(31, Math.max(1, parsed));
}

function parseIsoDateToUtc(value) {
  const iso = String(value ?? "").trim();
  if (!iso) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month, day));
  if (!Number.isFinite(date.getTime())) return null;
  return date;
}

function todayUtcDate() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function toIsoDateUtc(date) {
  return date.toISOString().slice(0, 10);
}

function addUtcDays(date, days) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + days));
}

function daysInUtcMonth(year, monthIndex) {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

function makeUtcDate(year, monthIndex, day) {
  const clampedDay = Math.min(daysInUtcMonth(year, monthIndex), Math.max(1, Math.round(day)));
  return new Date(Date.UTC(year, monthIndex, clampedDay));
}

function addUtcMonths(date, months, preferredDay) {
  const totalMonths = date.getUTCFullYear() * 12 + date.getUTCMonth() + months;
  const year = Math.floor(totalMonths / 12);
  const monthIndex = totalMonths % 12;
  return makeUtcDate(year, monthIndex, preferredDay);
}

function getFirstStudioRentDueDate(schedule) {
  const startDate = parseIsoDateToUtc(schedule.start_date) ?? todayUtcDate();
  if (schedule.cadence === "weekly") {
    const dueWeekday = normalizeDueWeekday(schedule.due_weekday) ?? startDate.getUTCDay();
    const delta = (dueWeekday - startDate.getUTCDay() + 7) % 7;
    return addUtcDays(startDate, delta);
  }

  const dueDay = normalizeDueDayOfMonth(schedule.due_day_of_month) ?? startDate.getUTCDate();
  const sameMonthDue = makeUtcDate(startDate.getUTCFullYear(), startDate.getUTCMonth(), dueDay);
  if (sameMonthDue.getTime() >= startDate.getTime()) return sameMonthDue;
  return addUtcMonths(startDate, 1, dueDay);
}

function getLastStudioRentDueOnOrBefore(schedule, targetDate) {
  let dueDate = getFirstStudioRentDueDate(schedule);
  if (dueDate.getTime() > targetDate.getTime()) return null;

  if (schedule.cadence === "weekly") {
    while (true) {
      const next = addUtcDays(dueDate, 7);
      if (next.getTime() > targetDate.getTime()) return dueDate;
      dueDate = next;
    }
  }

  const preferredDay = normalizeDueDayOfMonth(schedule.due_day_of_month) ?? dueDate.getUTCDate();
  while (true) {
    const next = addUtcMonths(dueDate, 1, preferredDay);
    if (next.getTime() > targetDate.getTime()) return dueDate;
    dueDate = next;
  }
}

function getNextStudioRentDueAfter(schedule, targetDate) {
  const firstDue = getFirstStudioRentDueDate(schedule);
  if (firstDue.getTime() > targetDate.getTime()) return firstDue;
  const lastDue = getLastStudioRentDueOnOrBefore(schedule, targetDate) ?? firstDue;
  if (schedule.cadence === "weekly") return addUtcDays(lastDue, 7);
  const preferredDay = normalizeDueDayOfMonth(schedule.due_day_of_month) ?? lastDue.getUTCDate();
  return addUtcMonths(lastDue, 1, preferredDay);
}

function getStudioRentDueDatesThrough(schedule, targetDate) {
  const dueDates = [];
  const firstDue = getFirstStudioRentDueDate(schedule);
  if (firstDue.getTime() > targetDate.getTime()) return dueDates;

  let current = firstDue;
  if (schedule.cadence === "weekly") {
    while (current.getTime() <= targetDate.getTime()) {
      dueDates.push(current);
      current = addUtcDays(current, 7);
    }
    return dueDates;
  }

  const preferredDay = normalizeDueDayOfMonth(schedule.due_day_of_month) ?? firstDue.getUTCDate();
  while (current.getTime() <= targetDate.getTime()) {
    dueDates.push(current);
    current = addUtcMonths(current, 1, preferredDay);
  }
  return dueDates;
}

function errorBlob(error) {
  const anyErr = error;
  return `${anyErr?.message ?? ""} ${anyErr?.details ?? ""} ${anyErr?.hint ?? ""}`.toLowerCase();
}

async function normalizeFunctionInvokeError(error) {
  const anyErr = error;
  const response = anyErr?.context;
  let message = String(anyErr?.message ?? "").trim();

  if (response?.clone) {
    const cloned = response.clone();
    try {
      const payload = await cloned.json?.();
      const payloadError = String(asObject(payload).error ?? "").trim();
      if (payloadError) message = payloadError;
    } catch {
      try {
        const text = String((await cloned.text?.()) ?? "").trim();
        if (text) {
          try {
            const parsed = JSON.parse(text);
            const parsedError = String(asObject(parsed).error ?? "").trim();
            if (parsedError) {
              message = parsedError;
            } else if (text) {
              message = text;
            }
          } catch {
            message = text;
          }
        }
      } catch {
        // Ignore response parsing issues and fall back to the original wrapper message.
      }
    }
  }

  if (!message) return error;

  const normalized = new Error(message);
  normalized.status = response?.status;
  normalized.cause = error;
  if (anyErr?.name) {
    normalized.name = String(anyErr.name);
  }
  return normalized;
}

export function isStudioTeamFeatureUnavailableError(error) {
  const anyErr = error;
  const code = String(anyErr?.code ?? "").toUpperCase();
  const blob = errorBlob(error);
  const missingRelationHint =
    blob.includes("does not exist") ||
    blob.includes("not found in schema cache") ||
    blob.includes("could not find");
  const recursivePolicyHint = blob.includes("infinite recursion detected in policy");

  return (
    code === "42P01" ||
    code === "42P17" ||
    code === "42703" ||
    code === "PGRST202" ||
    code === "PGRST204" ||
    code === "PGRST205" ||
    recursivePolicyHint ||
    (missingRelationHint &&
      (blob.includes("studios") ||
        blob.includes("studio_members") ||
        blob.includes("studio_calendar_resources") ||
        blob.includes("appointment_team_assignments") ||
        blob.includes("studio_payout_reports") ||
        blob.includes("studio_rent_schedules") ||
        blob.includes("studio_rent_payments") ||
        blob.includes("get_studio_member_directory")))
  );
}

export function isStudioLeadershipRole(role) {
  const normalized = String(role ?? "").trim().toLowerCase();
  return normalized === "owner" || normalized === "manager";
}

export function formatStudioRoleLabel(role) {
  const normalized = String(role ?? "").trim().toLowerCase();
  if (normalized === "owner") return "Owner";
  if (normalized === "manager") return "Manager";
  if (normalized === "assistant") return "Assistant";
  if (normalized === "staff") return "Staff";
  return "Member";
}

export function formatStudioRentCadenceLabel(schedule) {
  if (schedule.cadence === "monthly") {
    const dueDay = normalizeDueDayOfMonth(schedule.due_day_of_month) ?? 1;
    return `Monthly - due on day ${dueDay}`;
  }

  const weekday = normalizeDueWeekday(schedule.due_weekday) ?? 0;
  const weekdayLabel = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][weekday];
  return `Weekly - due every ${weekdayLabel}`;
}

export function getStudioRentScheduleSummary(schedule, payments, now = new Date()) {
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const todayIso = toIsoDateUtc(today);
  const schedulePayments = payments
    .filter((row) => row.rent_schedule_id === schedule.id)
    .sort((a, b) => Date.parse(String(b.paid_at ?? "")) - Date.parse(String(a.paid_at ?? "")));
  const latestPayment = schedulePayments[0] ?? null;

  if (!schedule.is_active) {
    return {
      status: "inactive",
      current_due_date: null,
      next_due_date: null,
      current_payment: null,
      latest_payment: latestPayment,
      outstanding_due_count: 0,
    };
  }

  const dueDatesThroughToday = getStudioRentDueDatesThrough(schedule, today);
  const settledDueDates = new Set(
    schedulePayments
      .filter((payment) => payment.status === "paid" || payment.status === "waived")
      .map((payment) => String(payment.due_date ?? "").trim())
      .filter(Boolean)
  );
  const unpaidDueDates = dueDatesThroughToday.filter((dueDate) => !settledDueDates.has(toIsoDateUtc(dueDate)));
  const outstandingDueCount = unpaidDueDates.length;
  const currentDue = unpaidDueDates[0] ?? dueDatesThroughToday[dueDatesThroughToday.length - 1] ?? null;
  const currentDueIso = currentDue ? toIsoDateUtc(currentDue) : null;
  const nextDue = getNextStudioRentDueAfter(schedule, today);
  const nextDueIso = nextDue ? toIsoDateUtc(nextDue) : null;
  const currentPayment = currentDueIso
    ? schedulePayments.find((payment) => String(payment.due_date ?? "") === currentDueIso) ?? null
    : null;

  if (currentPayment?.status === "waived") {
    return {
      status: "waived",
      current_due_date: currentDueIso,
      next_due_date: nextDueIso,
      current_payment: currentPayment,
      latest_payment: latestPayment,
      outstanding_due_count: 0,
    };
  }

  if (currentPayment?.status === "paid" && outstandingDueCount === 0) {
    return {
      status: "paid",
      current_due_date: currentDueIso,
      next_due_date: nextDueIso,
      current_payment: currentPayment,
      latest_payment: latestPayment,
      outstanding_due_count: 0,
    };
  }

  if (dueDatesThroughToday.length === 0 || !currentDueIso) {
    return {
      status: "upcoming",
      current_due_date: null,
      next_due_date: nextDueIso,
      current_payment: null,
      latest_payment: latestPayment,
      outstanding_due_count: 0,
    };
  }

  return {
    status: currentDueIso < todayIso ? "overdue" : "due_today",
    current_due_date: currentDueIso,
    next_due_date: nextDueIso,
    current_payment: null,
    latest_payment: latestPayment,
    outstanding_due_count: outstandingDueCount,
  };
}

export async function fetchStudiosForProfile(profileId) {
  const userId = String(profileId ?? "").trim();
  if (!userId) return { studios: [], memberships: [], unsupported: false, error: null };

  const client = await getSupabaseClient();
  const [ownedRes, memberRes] = await Promise.all([
    client
      .from("studios")
      .select("id, owner_id, name, slug, timezone, payout_reporting_enabled, created_at, updated_at")
      .eq("owner_id", userId)
      .order("created_at", { ascending: true }),
    client
      .from("studio_members")
      .select("id, studio_id, profile_id, member_role, calendar_color, is_active, joined_at, created_at, updated_at")
      .eq("profile_id", userId)
      .eq("is_active", true)
      .order("created_at", { ascending: true }),
  ]);

  if (ownedRes.error) {
    if (isStudioTeamFeatureUnavailableError(ownedRes.error)) {
      return { studios: [], memberships: [], unsupported: true, error: null };
    }
    return { studios: [], memberships: [], unsupported: false, error: ownedRes.error };
  }

  if (memberRes.error) {
    if (isStudioTeamFeatureUnavailableError(memberRes.error)) {
      return { studios: ownedRes.data ?? [], memberships: [], unsupported: true, error: null };
    }
    return { studios: [], memberships: [], unsupported: false, error: memberRes.error };
  }

  const memberships = memberRes.data ?? [];
  const studioIds = new Set((ownedRes.data ?? []).map((row) => String(row.id ?? "").trim()).filter(Boolean));
  memberships.forEach((row) => {
    const studioId = String(row.studio_id ?? "").trim();
    if (studioId) studioIds.add(studioId);
  });

  let studios = ownedRes.data ?? [];
  const missingIds = [...studioIds].filter((id) => !studios.some((studio) => studio.id === id));
  if (missingIds.length > 0) {
    const additionalRes = await client
      .from("studios")
      .select("id, owner_id, name, slug, timezone, payout_reporting_enabled, created_at, updated_at")
      .in("id", missingIds);

    if (additionalRes.error && !isStudioTeamFeatureUnavailableError(additionalRes.error)) {
      return { studios: [], memberships: [], unsupported: false, error: additionalRes.error };
    }

    studios = [...studios, ...(additionalRes.data ?? [])];
  }

  return { studios, memberships, unsupported: false, error: null };
}

export async function createStudioWithOwner(args) {
  const ownerId = String(args.ownerId ?? "").trim();
  const name = String(args.name ?? "").trim();
  if (!ownerId || !name) {
    return { studio: null, unsupported: false, alreadyExists: false, error: new Error("Missing ownerId/name") };
  }

  const client = await getSupabaseClient();
  const existingRes = await client
    .from("studios")
    .select("id, owner_id, name, slug, timezone, payout_reporting_enabled, created_at, updated_at")
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: true })
    .limit(1);

  if (existingRes.error) {
    if (isStudioTeamFeatureUnavailableError(existingRes.error)) {
      return { studio: null, unsupported: true, alreadyExists: false, error: null };
    }
    return { studio: null, unsupported: false, alreadyExists: false, error: existingRes.error };
  }

  const existingStudio = (existingRes.data ?? [])[0] ?? null;
  if (existingStudio) {
    return { studio: existingStudio, unsupported: false, alreadyExists: true, error: null };
  }

  const { data, error } = await client
    .from("studios")
    .insert({
      owner_id: ownerId,
      name,
      slug: args.slug ?? null,
      timezone: args.timezone ?? null,
    })
    .select("id, owner_id, name, slug, timezone, payout_reporting_enabled, created_at, updated_at")
    .single();

  if (error) {
    if (isStudioTeamFeatureUnavailableError(error)) return { studio: null, unsupported: true, alreadyExists: false, error: null };
    return { studio: null, unsupported: false, alreadyExists: false, error };
  }

  await client.from("studio_members").upsert(
    {
      studio_id: data.id,
      profile_id: ownerId,
      member_role: "owner",
      is_active: true,
    },
    { onConflict: "studio_id,profile_id" }
  );

  return { studio: data, unsupported: false, alreadyExists: false, error: null };
}

export async function fetchStudioMembers(studioId, options) {
  const studioIdClean = String(studioId ?? "").trim();
  if (!studioIdClean) return { members: [], unsupported: false, error: null };

  const client = await getSupabaseClient();
  const includeInactive = options?.includeInactive === true;
  let query = client
    .from("studio_members")
    .select("id, studio_id, profile_id, member_role, calendar_color, is_active, joined_at, created_at, updated_at")
    .eq("studio_id", studioIdClean)
    .order("member_role", { ascending: true })
    .order("created_at", { ascending: true });

  if (!includeInactive) {
    query = query.eq("is_active", true);
  }

  const { data, error } = await query;
  if (error) {
    if (isStudioTeamFeatureUnavailableError(error)) return { members: [], unsupported: true, error: null };
    return { members: [], unsupported: false, error };
  }
  return { members: data ?? [], unsupported: false, error: null };
}

export async function fetchStudioMemberDirectory(studioId) {
  const studioIdClean = String(studioId ?? "").trim();
  if (!studioIdClean) return { entries: [], unsupported: false, error: null };

  const client = await getSupabaseClient();
  const { data, error } = await client.rpc("get_studio_member_directory", {
    p_studio_id: studioIdClean,
  });

  if (error) {
    if (isStudioTeamFeatureUnavailableError(error)) return { entries: [], unsupported: true, error: null };
    return { entries: [], unsupported: false, error };
  }

  return {
    entries: (data ?? []).map((row) => ({
      profile_id: String(row.profile_id ?? "").trim(),
      full_name: typeof row.full_name === "string" ? row.full_name : null,
      business_name: typeof row.business_name === "string" ? row.business_name : null,
      avatar_url: typeof row.avatar_url === "string" ? row.avatar_url : null,
    })),
    unsupported: false,
    error: null,
  };
}

export async function fetchStudioCalendarResources(studioId, options) {
  const studioIdClean = String(studioId ?? "").trim();
  if (!studioIdClean) return { resources: [], unsupported: false, error: null };

  const client = await getSupabaseClient();
  let query = client
    .from("studio_calendar_resources")
    .select("id, studio_id, resource_name, resource_type, member_id, is_active, created_at, updated_at")
    .eq("studio_id", studioIdClean)
    .order("created_at", { ascending: true });

  if (!options?.includeInactive) {
    query = query.eq("is_active", true);
  }

  const { data, error } = await query;
  if (error) {
    if (isStudioTeamFeatureUnavailableError(error)) {
      return { resources: [], unsupported: true, error: null };
    }
    return { resources: [], unsupported: false, error };
  }

  return { resources: data ?? [], unsupported: false, error: null };
}

export async function fetchStudioPayoutReports(args) {
  const studioId = String(args.studioId ?? "").trim();
  if (!studioId) return { reports: [], unsupported: false, error: null };

  const client = await getSupabaseClient();
  let query = client
    .from("studio_payout_reports")
    .select("id, studio_id, period_start, period_end, gross_amount, payout_amount, tips_amount, appointment_count, generated_by, report_metadata, created_at, updated_at")
    .eq("studio_id", studioId)
    .order("period_end", { ascending: false });

  if (Number.isFinite(Number(args.limit ?? 0)) && Number(args.limit) > 0) {
    query = query.limit(Math.round(Number(args.limit)));
  }

  const { data, error } = await query;
  if (error) {
    if (isStudioTeamFeatureUnavailableError(error)) return { reports: [], unsupported: true, error: null };
    return { reports: [], unsupported: false, error };
  }

  const reports = (data ?? []).map((row) => ({
    ...row,
    report_metadata: asObject(row.report_metadata),
  }));

  return { reports, unsupported: false, error: null };
}

export async function fetchStudioRentSchedules(studioId, options) {
  const studioIdClean = String(studioId ?? "").trim();
  if (!studioIdClean) return { schedules: [], unsupported: false, error: null };

  const client = await getSupabaseClient();
  let query = client
    .from("studio_rent_schedules")
    .select("id, studio_id, member_id, resource_id, amount, cadence, due_weekday, due_day_of_month, start_date, notes, is_active, created_by, created_at, updated_at")
    .eq("studio_id", studioIdClean)
    .order("is_active", { ascending: false })
    .order("created_at", { ascending: false });

  if (!options?.includeInactive) {
    query = query.eq("is_active", true);
  }

  const { data, error } = await query;
  if (error) {
    if (isStudioTeamFeatureUnavailableError(error)) return { schedules: [], unsupported: true, error: null };
    return { schedules: [], unsupported: false, error };
  }

  const schedules = (data ?? []).map((row) => ({
    ...row,
    amount: normalizeMoneyAmount(row.amount),
    cadence: normalizeRentCadence(row.cadence),
    due_weekday: normalizeDueWeekday(row.due_weekday),
    due_day_of_month: normalizeDueDayOfMonth(row.due_day_of_month),
  }));

  return { schedules, unsupported: false, error: null };
}

export async function fetchStudioRentPayments(studioId, scheduleIds) {
  const studioIdClean = String(studioId ?? "").trim();
  if (!studioIdClean) return { payments: [], unsupported: false, error: null };

  const client = await getSupabaseClient();
  let query = client
    .from("studio_rent_payments")
    .select("id, rent_schedule_id, studio_id, member_id, due_date, amount, status, payment_method, payment_notes, recorded_by, paid_at, created_at, updated_at")
    .eq("studio_id", studioIdClean)
    .order("due_date", { ascending: false })
    .order("paid_at", { ascending: false });

  const ids = [...new Set((scheduleIds ?? []).map((value) => String(value ?? "").trim()).filter(Boolean))];
  if (ids.length > 0) {
    query = query.in("rent_schedule_id", ids);
  }

  const { data, error } = await query;
  if (error) {
    if (isStudioTeamFeatureUnavailableError(error)) return { payments: [], unsupported: true, error: null };
    return { payments: [], unsupported: false, error };
  }

  const payments = (data ?? []).map((row) => ({
    ...row,
    amount: normalizeMoneyAmount(row.amount),
    status: String(row.status ?? "").trim().toLowerCase() === "waived" ? "waived" : "paid",
  }));

  return { payments, unsupported: false, error: null };
}

export async function createStudioRentSchedule(args) {
  const studioId = String(args.studioId ?? "").trim();
  const memberId = String(args.memberId ?? "").trim();
  const cadence = normalizeRentCadence(args.cadence);
  const amount = normalizeMoneyAmount(args.amount);
  const dueWeekday = cadence === "weekly" ? normalizeDueWeekday(args.dueWeekday) : null;
  const dueDayOfMonth = cadence === "monthly" ? normalizeDueDayOfMonth(args.dueDayOfMonth) : null;
  const startDate = String(args.startDate ?? "").trim() || toIsoDateUtc(todayUtcDate());

  if (!studioId || !memberId) {
    return { schedule: null, unsupported: false, error: new Error("Missing studioId/memberId") };
  }
  if (cadence === "weekly" && dueWeekday == null) {
    return { schedule: null, unsupported: false, error: new Error("Weekly rent schedules require a due weekday.") };
  }
  if (cadence === "monthly" && dueDayOfMonth == null) {
    return { schedule: null, unsupported: false, error: new Error("Monthly rent schedules require a due day of month.") };
  }

  const client = await getSupabaseClient();
  const { data, error } = await client
    .from("studio_rent_schedules")
    .insert({
      studio_id: studioId,
      member_id: memberId,
      resource_id: String(args.resourceId ?? "").trim() || null,
      amount,
      cadence,
      due_weekday: dueWeekday,
      due_day_of_month: dueDayOfMonth,
      start_date: startDate,
      notes: String(args.notes ?? "").trim() || null,
      created_by: String(args.createdBy ?? "").trim() || null,
      is_active: true,
    })
    .select("id, studio_id, member_id, resource_id, amount, cadence, due_weekday, due_day_of_month, start_date, notes, is_active, created_by, created_at, updated_at")
    .single();

  if (error) {
    if (isStudioTeamFeatureUnavailableError(error)) return { schedule: null, unsupported: true, error: null };
    return { schedule: null, unsupported: false, error };
  }

  return {
    schedule: {
      ...data,
      amount: normalizeMoneyAmount(data.amount),
      cadence: normalizeRentCadence(data.cadence),
      due_weekday: normalizeDueWeekday(data.due_weekday),
      due_day_of_month: normalizeDueDayOfMonth(data.due_day_of_month),
    },
    unsupported: false,
    error: null,
  };
}

export async function updateStudioRentSchedule(args) {
  const studioId = String(args.studioId ?? "").trim();
  const scheduleId = String(args.scheduleId ?? "").trim();
  if (!studioId || !scheduleId) {
    return { error: new Error("Missing studioId/scheduleId"), unsupported: false };
  }

  const payload = {};
  if (args.memberId) payload.member_id = String(args.memberId).trim();
  if (args.resourceId !== undefined) payload.resource_id = String(args.resourceId ?? "").trim() || null;
  if (args.amount !== undefined) payload.amount = normalizeMoneyAmount(args.amount);
  if (args.cadence !== undefined) payload.cadence = normalizeRentCadence(args.cadence);
  if (args.startDate !== undefined) payload.start_date = String(args.startDate ?? "").trim() || null;
  if (args.notes !== undefined) payload.notes = String(args.notes ?? "").trim() || null;
  if (typeof args.isActive === "boolean") payload.is_active = args.isActive;

  const cadence = normalizeRentCadence(payload.cadence ?? args.cadence);
  const dueWeekday = args.dueWeekday !== undefined ? normalizeDueWeekday(args.dueWeekday) : undefined;
  const dueDayOfMonth = args.dueDayOfMonth !== undefined ? normalizeDueDayOfMonth(args.dueDayOfMonth) : undefined;
  if (cadence === "weekly") {
    if (dueWeekday !== undefined) payload.due_weekday = dueWeekday;
    if (payload.cadence === "weekly") payload.due_day_of_month = null;
  }
  if (cadence === "monthly") {
    if (dueDayOfMonth !== undefined) payload.due_day_of_month = dueDayOfMonth;
    if (payload.cadence === "monthly") payload.due_weekday = null;
  }

  if (Object.keys(payload).length === 0) return { error: null, unsupported: false };

  const client = await getSupabaseClient();
  const { error } = await client
    .from("studio_rent_schedules")
    .update(payload)
    .eq("studio_id", studioId)
    .eq("id", scheduleId);

  if (error) {
    if (isStudioTeamFeatureUnavailableError(error)) return { error: null, unsupported: true };
    return { error, unsupported: false };
  }
  return { error: null, unsupported: false };
}

export async function recordStudioRentPayment(args) {
  const studioId = String(args.studioId ?? "").trim();
  const scheduleId = String(args.scheduleId ?? "").trim();
  const memberId = String(args.memberId ?? "").trim();
  const dueDate = String(args.dueDate ?? "").trim();
  const amount = normalizeMoneyAmount(args.amount);
  const status = String(args.status ?? "paid").trim().toLowerCase() === "waived" ? "waived" : "paid";

  if (!studioId || !scheduleId || !memberId || !dueDate) {
    return { payment: null, unsupported: false, error: new Error("Missing studioId/scheduleId/memberId/dueDate") };
  }

  const client = await getSupabaseClient();
  const { data, error } = await client
    .from("studio_rent_payments")
    .upsert(
      {
        rent_schedule_id: scheduleId,
        studio_id: studioId,
        member_id: memberId,
        due_date: dueDate,
        amount,
        status,
        payment_method: String(args.paymentMethod ?? "").trim() || null,
        payment_notes: String(args.paymentNotes ?? "").trim() || null,
        recorded_by: String(args.recordedBy ?? "").trim() || null,
        paid_at: new Date().toISOString(),
      },
      { onConflict: "rent_schedule_id,due_date" }
    )
    .select("id, rent_schedule_id, studio_id, member_id, due_date, amount, status, payment_method, payment_notes, recorded_by, paid_at, created_at, updated_at")
    .single();

  if (error) {
    if (isStudioTeamFeatureUnavailableError(error)) return { payment: null, unsupported: true, error: null };
    return { payment: null, unsupported: false, error };
  }

  return {
    payment: {
      ...data,
      amount: normalizeMoneyAmount(data.amount),
      status: String(data.status ?? "").trim().toLowerCase() === "waived" ? "waived" : "paid",
    },
    unsupported: false,
    error: null,
  };
}

export async function createStudioRentPaymentSession(args) {
  const rentScheduleId = String(args.rentScheduleId ?? "").trim();
  if (!rentScheduleId) {
    return {
      id: null,
      url: null,
      returnUrl: null,
      dueDate: null,
      amount: null,
      currency: null,
      existingSession: false,
      unsupported: false,
      error: new Error("Missing rentScheduleId"),
    };
  }

  const client = await getSupabaseClient();
  const { data, error } = await client.functions.invoke("create-studio-rent-payment-session", {
    body: {
      rent_schedule_id: rentScheduleId,
      currency: String(args.currency ?? "usd").trim().toLowerCase() || "usd",
      return_url: String(args.returnUrl ?? "").trim() || null,
      success_url: String(args.successUrl ?? "").trim() || null,
      cancel_url: String(args.cancelUrl ?? "").trim() || null,
    },
  });

  if (error) {
    const normalizedError = await normalizeFunctionInvokeError(error);
    return {
      id: null,
      url: null,
      returnUrl: null,
      dueDate: null,
      amount: null,
      currency: null,
      existingSession: false,
      unsupported: false,
      error: normalizedError,
    };
  }

  const payload = asObject(data);
  return {
    id: asString(payload.id) ?? null,
    url: asString(payload.url) ?? null,
    returnUrl: asString(payload.return_url) ?? null,
    dueDate: asString(payload.due_date) ?? null,
    amount: payload.amount == null ? null : normalizeMoneyAmount(payload.amount),
    currency: asString(payload.currency) ?? null,
    existingSession: payload.existing_session === true,
    unsupported: false,
    error: null,
  };
}

export async function syncStudioRentPaymentSession(args) {
  const sessionId = String(args.sessionId ?? "").trim();
  if (!sessionId) {
    return {
      status: null,
      paid: false,
      unsupported: false,
      error: new Error("Missing sessionId"),
    };
  }

  const client = await getSupabaseClient();
  const { data, error } = await client.functions.invoke("sync-studio-rent-payment", {
    body: {
      session_id: sessionId,
    },
  });

  if (error) {
    const normalizedError = await normalizeFunctionInvokeError(error);
    return {
      status: null,
      paid: false,
      unsupported: false,
      error: normalizedError,
    };
  }

  const payload = asObject(data);
  const status = asString(payload.status);
  return {
    status,
    paid: payload.paid === true || status === "complete",
    unsupported: false,
    error: null,
  };
}

export async function upsertAppointmentTeamAssignment(args) {
  const appointmentId = String(args.appointmentId ?? "").trim();
  const studioId = String(args.studioId ?? "").trim();
  if (!appointmentId || !studioId) {
    return { error: new Error("Missing appointmentId/studioId"), unsupported: false };
  }

  const payoutSplitPercent = Number.isFinite(Number(args.payoutSplitPercent))
    ? Math.min(100, Math.max(0, Number(args.payoutSplitPercent)))
    : 100;

  const client = await getSupabaseClient();
  const { error } = await client.from("appointment_team_assignments").upsert(
    {
      appointment_id: appointmentId,
      studio_id: studioId,
      assigned_member_id: args.assignedMemberId ?? null,
      resource_id: args.resourceId ?? null,
      assigned_by: args.assignedBy ?? null,
      payout_split_percent: payoutSplitPercent,
      assignment_notes: args.assignmentNotes ?? null,
    },
    { onConflict: "appointment_id" }
  );

  if (error) {
    if (isStudioTeamFeatureUnavailableError(error)) return { error: null, unsupported: true };
    return { error, unsupported: false };
  }
  return { error: null, unsupported: false };
}

export async function updateStudioMemberRole(args) {
  const studioId = String(args.studioId ?? "").trim();
  const memberId = String(args.memberId ?? "").trim();
  const role = normalizeStudioMemberRole(args.memberRole);
  if (!studioId || !memberId) {
    return { error: new Error("Missing studioId/memberId"), unsupported: false };
  }

  const client = await getSupabaseClient();
  const { error } = await client
    .from("studio_members")
    .update({ member_role: role })
    .eq("studio_id", studioId)
    .eq("id", memberId);

  if (error) {
    if (isStudioTeamFeatureUnavailableError(error)) return { error: null, unsupported: true };
    return { error, unsupported: false };
  }
  return { error: null, unsupported: false };
}

export async function setStudioMemberActive(args) {
  const studioId = String(args.studioId ?? "").trim();
  const memberId = String(args.memberId ?? "").trim();
  const isActive = !!args.isActive;
  if (!studioId || !memberId) {
    return { error: new Error("Missing studioId/memberId"), unsupported: false };
  }

  const client = await getSupabaseClient();
  const { error } = await client
    .from("studio_members")
    .update({ is_active: isActive })
    .eq("studio_id", studioId)
    .eq("id", memberId);

  if (error) {
    if (isStudioTeamFeatureUnavailableError(error)) return { error: null, unsupported: true };
    return { error, unsupported: false };
  }
  return { error: null, unsupported: false };
}

export async function upsertStudioMember(args) {
  const studioId = String(args.studioId ?? "").trim();
  const profileId = String(args.profileId ?? "").trim();
  const memberRole = normalizeStudioMemberRole(args.memberRole);
  if (!studioId || !profileId) {
    return { member: null, unsupported: false, error: new Error("Missing studioId/profileId") };
  }

  const client = await getSupabaseClient();
  const { data, error } = await client
    .from("studio_members")
    .upsert(
      {
        studio_id: studioId,
        profile_id: profileId,
        member_role: memberRole,
        is_active: args.isActive !== false,
      },
      { onConflict: "studio_id,profile_id" }
    )
    .select("id, studio_id, profile_id, member_role, calendar_color, is_active, joined_at, created_at, updated_at")
    .single();

  if (error) {
    if (isStudioTeamFeatureUnavailableError(error)) return { member: null, unsupported: true, error: null };
    return { member: null, unsupported: false, error };
  }
  return { member: data ?? null, unsupported: false, error: null };
}

export async function inviteStudioMemberByEmail(args) {
  const studioId = String(args.studioId ?? "").trim();
  const email = String(args.email ?? "").trim().toLowerCase();
  const memberRole = normalizeStudioMemberRole(args.memberRole);
  if (!studioId || !email) {
    return {
      member: null,
      inviteeName: null,
      existingMember: false,
      unsupported: false,
      error: new Error("Missing studioId/email"),
    };
  }

  const client = await getSupabaseClient();
  const { data, error } = await client.functions.invoke("invite-studio-member", {
    body: {
      studio_id: studioId,
      email,
      member_role: memberRole,
    },
  });

  if (error) {
    const normalizedError = await normalizeFunctionInvokeError(error);
    return {
      member: null,
      inviteeName: null,
      existingMember: false,
      unsupported: false,
      error: normalizedError,
    };
  }

  return {
    member: data?.member ?? null,
    inviteeName: String(data?.invitee_name ?? "").trim() || null,
    existingMember: Boolean(data?.existing_member),
    unsupported: false,
    error: null,
  };
}

export async function createStudioCalendarResource(args) {
  const studioId = String(args.studioId ?? "").trim();
  const resourceName = String(args.resourceName ?? "").trim();
  if (!studioId || !resourceName) {
    return {
      resource: null,
      unsupported: false,
      error: new Error("Missing studioId/resourceName"),
    };
  }

  const client = await getSupabaseClient();
  const { data, error } = await client
    .from("studio_calendar_resources")
    .insert({
      studio_id: studioId,
      resource_name: resourceName,
      resource_type: normalizeResourceType(args.resourceType),
      member_id: String(args.memberId ?? "").trim() || null,
      is_active: args.isActive !== false,
    })
    .select("id, studio_id, resource_name, resource_type, member_id, is_active, created_at, updated_at")
    .single();

  if (error) {
    if (isStudioTeamFeatureUnavailableError(error)) return { resource: null, unsupported: true, error: null };
    return { resource: null, unsupported: false, error };
  }
  return { resource: data ?? null, unsupported: false, error: null };
}

export async function updateStudioCalendarResource(args) {
  const studioId = String(args.studioId ?? "").trim();
  const resourceId = String(args.resourceId ?? "").trim();
  if (!studioId || !resourceId) {
    return { error: new Error("Missing studioId/resourceId"), unsupported: false };
  }

  const payload = {};
  const normalizedName = String(args.resourceName ?? "").trim();
  if (normalizedName) payload.resource_name = normalizedName;
  if (args.resourceType) payload.resource_type = normalizeResourceType(args.resourceType);
  if (typeof args.isActive === "boolean") payload.is_active = args.isActive;
  if (args.memberId !== undefined) payload.member_id = String(args.memberId ?? "").trim() || null;
  if (Object.keys(payload).length === 0) return { error: null, unsupported: false };

  const client = await getSupabaseClient();
  const { error } = await client
    .from("studio_calendar_resources")
    .update(payload)
    .eq("studio_id", studioId)
    .eq("id", resourceId);

  if (error) {
    if (isStudioTeamFeatureUnavailableError(error)) return { error: null, unsupported: true };
    return { error, unsupported: false };
  }
  return { error: null, unsupported: false };
}

export async function deleteStudioCalendarResource(args) {
  const studioId = String(args.studioId ?? "").trim();
  const resourceId = String(args.resourceId ?? "").trim();
  if (!studioId || !resourceId) {
    return { error: new Error("Missing studioId/resourceId"), unsupported: false };
  }

  const client = await getSupabaseClient();
  const { error } = await client
    .from("studio_calendar_resources")
    .delete()
    .eq("studio_id", studioId)
    .eq("id", resourceId);

  if (error) {
    if (isStudioTeamFeatureUnavailableError(error)) return { error: null, unsupported: true };
    return { error, unsupported: false };
  }
  return { error: null, unsupported: false };
}

export async function fetchAppointmentTeamAssignments(studioId, appointmentIds) {
  const studioIdClean = String(studioId ?? "").trim();
  if (!studioIdClean) return { assignments: [], unsupported: false, error: new Error("Missing studioId") };

  let query = (await getSupabaseClient())
    .from("appointment_team_assignments")
    .select("appointment_id, studio_id, assigned_member_id, resource_id, assigned_by, payout_split_percent, assignment_notes, created_at, updated_at")
    .eq("studio_id", studioIdClean)
    .order("updated_at", { ascending: false });

  const ids = [...new Set((appointmentIds ?? []).map((value) => String(value ?? "").trim()).filter(Boolean))];
  if (ids.length > 0) {
    query = query.in("appointment_id", ids);
  }

  const { data, error } = await query;
  if (error) {
    if (isStudioTeamFeatureUnavailableError(error)) {
      return { assignments: [], unsupported: true, error: null };
    }
    return { assignments: [], unsupported: false, error };
  }

  const assignments = (data ?? []).map((row) => ({
    ...row,
    payout_split_percent: normalizePercentage(row?.payout_split_percent),
  }));

  return { assignments, unsupported: false, error: null };
}

export async function syncStudioSeatBilling(studioId) {
  const studioIdClean = String(studioId ?? "").trim();
  if (!studioIdClean) {
    return {
      extraSeats: 0,
      activeAccounts: 0,
      unsupported: false,
      missingSubscription: false,
      error: new Error("Missing studioId"),
    };
  }

  const client = await getSupabaseClient();
  const { data, error } = await client.functions.invoke("sync-studio-seat-billing", {
    body: { studio_id: studioIdClean },
  });

  if (error) {
    const normalizedError = await normalizeFunctionInvokeError(error);
    const message = String(normalizedError?.message ?? "");
    const lower = message.toLowerCase();
    return {
      extraSeats: 0,
      activeAccounts: 0,
      unsupported: false,
      missingSubscription:
        lower.includes("no active studio subscription") ||
        lower.includes("no studio billing profile"),
      error: normalizedError,
    };
  }

  return {
    extraSeats: Number(data?.extra_seats ?? 0),
    activeAccounts: Number(data?.active_accounts ?? 0),
    unsupported: false,
    missingSubscription: false,
    error: null,
  };
}
