const SUPABASE_URL = "https://divallvcsszwtpeqrdhr.supabase.co";
const PROJECT_REF = new URL(SUPABASE_URL).hostname.split(".")[0];
const STORAGE_KEY = `sb-${PROJECT_REF}-auth-token`;

function addDays(baseDate, days) {
  const copy = new Date(baseDate);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function addMonths(baseDate, months) {
  return new Date(baseDate.getFullYear(), baseDate.getMonth() + months, baseDate.getDate());
}

function isoDate(value) {
  return value.toISOString().slice(0, 10);
}

function isoDateTime(value) {
  return value.toISOString();
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createJwtPart(payload) {
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

function createMockSession(user, now) {
  const expiresIn = 60 * 60 * 24 * 7;
  const accessToken = `${createJwtPart({ alg: "HS256", typ: "JWT" })}.${createJwtPart({
    aud: "authenticated",
    exp: Math.floor(now.getTime() / 1000) + expiresIn,
    sub: user.id,
    email: user.email,
    role: "authenticated",
  })}.mock-signature`;

  return {
    access_token: accessToken,
    refresh_token: "mock-refresh-token",
    token_type: "bearer",
    expires_in: expiresIn,
    expires_at: Math.floor(now.getTime() / 1000) + expiresIn,
    user,
  };
}

function createFixtures() {
  const now = new Date();
  const currentPeriodEnd = addDays(now, 28);
  const user = {
    id: "mock-pro-user",
    aud: "authenticated",
    role: "authenticated",
    email: "pro@example.com",
    email_confirmed_at: isoDateTime(addDays(now, -30)),
    phone: "",
    app_metadata: { provider: "email" },
    user_metadata: { role: "pro" },
    identities: [],
    created_at: isoDateTime(addDays(now, -120)),
    updated_at: isoDateTime(addDays(now, -1)),
  };

  const profile = {
    id: user.id,
    role: "pro",
    onboarding_step: "complete",
    full_name: "Daniel Kurtz",
    business_name: "Dans Kurtz",
    business_type: "barber",
    bio: "Precision cuts and detail work.",
    avatar_url: "/assets/cover.png",
    display_location: "Chicago, IL",
    has_location: true,
    travels_to_clients: false,
    travel_radius_miles: null,
    instagram_handle: "@mrdanielkamara",
    website_url: "https://example.com",
    phone: "4435127950",
    billing_tier: "studio",
    plan: "studio",
    trial_ends_at: null,
    studio_member_covered: false,
    created_at: isoDateTime(addDays(now, -120)),
    updated_at: isoDateTime(addDays(now, -1)),
  };

  const appointments = [
    {
      id: "appt-1",
      profile_id: user.id,
      client_name: "Alex Carter",
      client_phone: "5551112222",
      service: "Dark Ceasar",
      appointment_date: isoDate(addDays(now, 2)),
      appointment_time: "09:15:00",
      status: "confirmed",
      deposit_paid: true,
      deposit_amount: 50,
      service_price_at_booking: 50,
      duration_minutes: 45,
      notes: "First time client",
      created_at: isoDateTime(addDays(now, -4)),
      updated_at: isoDateTime(addDays(now, -4)),
    },
    {
      id: "appt-2",
      profile_id: user.id,
      client_name: "Jordan Lee",
      client_phone: "5551113333",
      service: "Buzzzzz Cut",
      appointment_date: isoDate(addDays(now, 5)),
      appointment_time: "12:30:00",
      status: "pending",
      deposit_paid: false,
      deposit_amount: 0,
      service_price_at_booking: 60,
      duration_minutes: 45,
      notes: "",
      created_at: isoDateTime(addDays(now, -3)),
      updated_at: isoDateTime(addDays(now, -3)),
    },
    {
      id: "appt-3",
      profile_id: user.id,
      client_name: "Chris Moore",
      client_phone: "5551114444",
      service: "Ceasar Dark",
      appointment_date: isoDate(addDays(now, 8)),
      appointment_time: "14:00:00",
      status: "confirmed",
      deposit_paid: true,
      deposit_amount: 60,
      service_price_at_booking: 60,
      duration_minutes: 45,
      notes: "",
      created_at: isoDateTime(addDays(now, -2)),
      updated_at: isoDateTime(addDays(now, -2)),
    },
    {
      id: "appt-4",
      profile_id: user.id,
      client_name: "Sam Taylor",
      client_phone: "5551115555",
      service: "Dark Ceasar",
      appointment_date: isoDate(addDays(now, -3)),
      appointment_time: "11:00:00",
      status: "completed",
      deposit_paid: true,
      deposit_amount: 50,
      service_price_at_booking: 50,
      duration_minutes: 45,
      notes: "Repeat client",
      created_at: isoDateTime(addDays(now, -12)),
      updated_at: isoDateTime(addDays(now, -3)),
    },
    {
      id: "appt-5",
      profile_id: user.id,
      client_name: "Taylor Brooks",
      client_phone: "5551116666",
      service: "Dark Ceasar",
      appointment_date: isoDate(addMonths(now, -1)),
      appointment_time: "10:00:00",
      status: "completed",
      deposit_paid: true,
      deposit_amount: 45,
      service_price_at_booking: 45,
      duration_minutes: 45,
      notes: "",
      created_at: isoDateTime(addMonths(now, -1)),
      updated_at: isoDateTime(addMonths(now, -1)),
    },
    {
      id: "appt-6",
      profile_id: user.id,
      client_name: "Morgan Price",
      client_phone: "5551117777",
      service: "Buzzzzz Cut",
      appointment_date: isoDate(addDays(now, 12)),
      appointment_time: "16:30:00",
      status: "canceled",
      deposit_paid: false,
      deposit_amount: 0,
      service_price_at_booking: 60,
      duration_minutes: 45,
      notes: "",
      created_at: isoDateTime(addDays(now, -1)),
      updated_at: isoDateTime(addDays(now, -1)),
    },
  ];

  const services = [
    {
      id: "svc-1",
      stylist_id: user.id,
      description: "Dark Ceasar",
      price: 50,
      duration_minutes: 45,
      category: "barber",
      image_url: "/assets/cover.png",
      deposit_amount: 20,
      created_at: isoDateTime(addDays(now, -40)),
    },
    {
      id: "svc-2",
      stylist_id: user.id,
      description: "Buzzzzz Cut",
      price: 60,
      duration_minutes: 45,
      category: "barber",
      image_url: "/assets/cover.png",
      deposit_amount: 20,
      created_at: isoDateTime(addDays(now, -35)),
    },
    {
      id: "svc-3",
      stylist_id: user.id,
      description: "Ceasar Dark",
      price: 50,
      duration_minutes: 45,
      category: "barber",
      image_url: "/assets/cover.png",
      deposit_amount: 20,
      created_at: isoDateTime(addDays(now, -30)),
    },
  ];

  const servicePhotos = services.map((service, index) => ({
    id: `photo-${index + 1}`,
    service_id: service.id,
    url: service.image_url,
    sort_order: 0,
    created_at: isoDateTime(addDays(now, -20 + index)),
  }));

  const week = {
    mon: { enabled: true, start: "09:00", end: "17:00" },
    tue: { enabled: true, start: "09:00", end: "17:00" },
    wed: { enabled: true, start: "09:00", end: "17:00" },
    thu: { enabled: true, start: "09:00", end: "17:00" },
    fri: { enabled: true, start: "09:00", end: "17:00" },
    sat: { enabled: false, start: "10:00", end: "15:00" },
    sun: { enabled: false, start: "10:00", end: "15:00" },
  };

  const studio = {
    id: "studio-1",
    owner_id: user.id,
    name: "Dans Kurtz",
    slug: "dans-kurtz",
    timezone: "America/Chicago",
    payout_reporting_enabled: true,
    created_at: isoDateTime(addDays(now, -90)),
    updated_at: isoDateTime(addDays(now, -1)),
  };

  const ownerMember = {
    id: "member-owner",
    studio_id: studio.id,
    profile_id: user.id,
    member_role: "owner",
    calendar_color: "#6fa9ff",
    is_active: true,
    joined_at: isoDateTime(addDays(now, -89)),
    created_at: isoDateTime(addDays(now, -89)),
    updated_at: isoDateTime(addDays(now, -1)),
  };

  const studioResource = {
    id: "resource-1",
    studio_id: studio.id,
    resource_name: "Main chair",
    resource_type: "calendar",
    member_id: ownerMember.id,
    is_active: true,
    created_at: isoDateTime(addDays(now, -80)),
    updated_at: isoDateTime(addDays(now, -1)),
  };

  const studioReport = {
    id: "report-1",
    studio_id: studio.id,
    period_start: isoDate(new Date(now.getFullYear(), now.getMonth(), 1)),
    period_end: isoDate(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
    gross_amount: 110,
    payout_amount: 95,
    tips_amount: 15,
    appointment_count: 4,
    generated_by: user.id,
    report_metadata: {},
    created_at: isoDateTime(addDays(now, -1)),
    updated_at: isoDateTime(addDays(now, -1)),
  };

  const rentSchedule = {
    id: "rent-1",
    studio_id: studio.id,
    member_id: ownerMember.id,
    resource_id: studioResource.id,
    amount: 39.99,
    cadence: "monthly",
    due_weekday: null,
    due_day_of_month: 1,
    start_date: isoDate(new Date(now.getFullYear(), now.getMonth(), 1)),
    notes: "Owner seat",
    is_active: true,
    created_by: user.id,
    created_at: isoDateTime(addDays(now, -70)),
    updated_at: isoDateTime(addDays(now, -1)),
  };

  const rentPayment = {
    id: "rent-payment-1",
    rent_schedule_id: rentSchedule.id,
    studio_id: studio.id,
    member_id: ownerMember.id,
    due_date: isoDate(new Date(now.getFullYear(), now.getMonth(), 1)),
    amount: 39.99,
    status: "paid",
    payment_method: "manual",
    payment_notes: "",
    recorded_by: user.id,
    paid_at: isoDateTime(addDays(now, -5)),
    created_at: isoDateTime(addDays(now, -5)),
    updated_at: isoDateTime(addDays(now, -5)),
  };

  return {
    user,
    session: createMockSession(user, now),
    profile,
    subscription: {
      user_id: user.id,
      status: "active",
      interval: "month",
      plan: "studio",
      current_period_end: isoDateTime(currentPeriodEnd),
    },
    studioAccess: {
      has_studio_access: true,
      access_type: "owner",
      studio_id: studio.id,
      studio_name: studio.name,
      studio_owner_id: user.id,
      studio_member_role: "owner",
    },
    profileDirectory: [
      {
        profile_id: user.id,
        full_name: profile.full_name,
        business_name: profile.business_name,
        avatar_url: profile.avatar_url,
      },
    ],
    availability: {
      user_id: user.id,
      timezone: "America/Chicago",
      week,
      blocked_dates: [
        isoDate(addDays(now, 30)),
        isoDate(addDays(now, 60)),
      ],
    },
    services,
    servicePhotos,
    appointments,
    studios: [studio],
    studioMembers: [ownerMember],
    studioResources: [studioResource],
    studioReports: [studioReport],
    studioRentSchedules: [rentSchedule],
    studioRentPayments: [rentPayment],
    appointmentAssignments: [
      {
        appointment_id: "appt-1",
        studio_id: studio.id,
        assigned_member_id: ownerMember.id,
        resource_id: studioResource.id,
        assigned_by: user.id,
        payout_split_percent: 100,
        assignment_notes: "",
        created_at: isoDateTime(addDays(now, -2)),
        updated_at: isoDateTime(addDays(now, -2)),
      },
    ],
    stripe: {
      status: {
        connected: true,
        account_id: "acct_mock_12345",
        charges_enabled: true,
        payouts_enabled: true,
        details_submitted: true,
        status: "active",
      },
      balance: {
        available: 0,
        pending: 0,
      },
    },
    prices: {
      free_monthly: { id: "free", unit_amount: 0, currency: "USD", interval: "month", interval_count: 1, product_name: "Free" },
      pro_monthly: { id: "price_mock_pro", unit_amount: 1999, currency: "USD", interval: "month", interval_count: 1, product_name: "Pro" },
    },
  };
}

const FIXTURES = createFixtures();

const TABLE_DATA = {
  profiles: [FIXTURES.profile],
  pro_subscriptions: [FIXTURES.subscription],
  pro_availability: [FIXTURES.availability],
  services: FIXTURES.services,
  service_photos: FIXTURES.servicePhotos,
  appointments: FIXTURES.appointments,
  studios: FIXTURES.studios,
  studio_members: FIXTURES.studioMembers,
  studio_calendar_resources: FIXTURES.studioResources,
  studio_payout_reports: FIXTURES.studioReports,
  studio_rent_schedules: FIXTURES.studioRentSchedules,
  studio_rent_payments: FIXTURES.studioRentPayments,
  appointment_team_assignments: FIXTURES.appointmentAssignments,
};

function parseList(raw) {
  return raw
    .replace(/^\(/, "")
    .replace(/\)$/, "")
    .split(",")
    .map((part) => decodeURIComponent(part.trim()).replace(/^['"]|['"]$/g, ""))
    .filter(Boolean);
}

function compareValues(left, right) {
  const leftNumber = Number(left);
  const rightNumber = Number(right);
  if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) {
    return leftNumber - rightNumber;
  }
  return String(left ?? "").localeCompare(String(right ?? ""));
}

function matchesFilter(row, key, rawExpression) {
  const value = row?.[key];
  const expression = decodeURIComponent(rawExpression);

  if (expression.startsWith("eq.")) return String(value ?? "") === expression.slice(3);
  if (expression.startsWith("neq.")) return String(value ?? "") !== expression.slice(4);
  if (expression.startsWith("gte.")) return compareValues(value, expression.slice(4)) >= 0;
  if (expression.startsWith("gt.")) return compareValues(value, expression.slice(3)) > 0;
  if (expression.startsWith("lte.")) return compareValues(value, expression.slice(4)) <= 0;
  if (expression.startsWith("lt.")) return compareValues(value, expression.slice(3)) < 0;
  if (expression.startsWith("in.")) return parseList(expression.slice(3)).includes(String(value ?? ""));
  if (expression.startsWith("not.in.")) return !parseList(expression.slice(7)).includes(String(value ?? ""));
  if (expression.startsWith("is.null")) return value == null;

  return true;
}

function applyQuery(rows, url) {
  let filtered = [...rows];

  for (const [key, value] of url.searchParams.entries()) {
    if (key === "select" || key === "order" || key === "limit" || key === "offset") continue;
    filtered = filtered.filter((row) => matchesFilter(row, key, value));
  }

  const orders = url.searchParams.getAll("order");
  if (orders.length > 0) {
    filtered.sort((left, right) => {
      for (const clause of orders) {
        const [column, direction = "asc"] = decodeURIComponent(clause).split(".");
        const result = compareValues(left?.[column], right?.[column]);
        if (result !== 0) return direction === "desc" ? -result : result;
      }
      return 0;
    });
  }

  const limitParam = url.searchParams.get("limit");
  const limit = limitParam == null ? null : Number(limitParam);
  if (limit != null && Number.isFinite(limit) && limit >= 0) {
    filtered = filtered.slice(0, limit);
  }

  return filtered;
}

function contentRange(count) {
  if (count <= 0) return "*/0";
  return `0-${Math.max(0, count - 1)}/${count}`;
}

async function fulfillJson(route, payload, options = {}) {
  await route.fulfill({
    status: options.status ?? 200,
    headers: {
      "content-type": "application/json",
      ...(options.headers ?? {}),
    },
    body: payload === undefined ? "" : JSON.stringify(payload),
  });
}

async function handleRest(route, url) {
  const request = route.request();
  const headers = request.headers();
  const pathname = url.pathname;

  if (pathname.startsWith("/rest/v1/rpc/")) {
    const rpcName = pathname.split("/").pop();
    if (rpcName === "get_studio_access_context") {
      await fulfillJson(route, FIXTURES.studioAccess);
      return;
    }
    if (rpcName === "get_studio_member_directory") {
      await fulfillJson(route, FIXTURES.profileDirectory);
      return;
    }
    await route.fulfill({ status: 404, body: "" });
    return;
  }

  const tableName = pathname.split("/").pop();
  const sourceRows = TABLE_DATA[tableName] ?? [];
  const rows = applyQuery(clone(sourceRows), url);
  const prefersObject = String(headers.accept ?? "").includes("application/vnd.pgrst.object+json");
  const singleRowTables = new Set(["profiles", "pro_subscriptions", "pro_availability"]);

  if (request.method() === "HEAD") {
    await route.fulfill({
      status: 200,
      headers: {
        "content-range": contentRange(rows.length),
      },
      body: "",
    });
    return;
  }

  await fulfillJson(route, prefersObject || singleRowTables.has(tableName) ? (rows[0] ?? null) : rows, {
    headers: {
      "content-range": contentRange(rows.length),
    },
  });
}

async function parsePostData(route) {
  try {
    return route.request().postDataJSON();
  } catch {
    return null;
  }
}

async function handleFunctions(route, url) {
  const fnName = url.pathname.split("/").pop();
  const body = (await parsePostData(route)) ?? {};

  if (fnName === "stripe-connect") {
    if (body?.action === "create_link") {
      await fulfillJson(route, { url: "https://example.com/stripe/onboarding" });
      return;
    }
    await fulfillJson(route, FIXTURES.stripe.status);
    return;
  }

  if (fnName === "stripe-connect-balance") {
    await fulfillJson(route, FIXTURES.stripe.balance);
    return;
  }

  if (fnName === "stripe-connect-login") {
    await fulfillJson(route, { url: "https://example.com/stripe/dashboard" });
    return;
  }

  if (fnName === "get-prices") {
    await fulfillJson(route, { prices: FIXTURES.prices });
    return;
  }

  if (fnName === "create-billing-portal-session") {
    await fulfillJson(route, { url: "https://example.com/billing-portal" });
    return;
  }

  if (fnName === "create-checkout-session") {
    await fulfillJson(route, { url: "https://example.com/checkout" });
    return;
  }

  await fulfillJson(route, {});
}

export async function installMockSupabase(page) {
  await page.context().addInitScript(
    ({ storageKey, session, user }) => {
      window.localStorage.setItem(storageKey, JSON.stringify(session));
      window.localStorage.setItem(`${storageKey}-user`, JSON.stringify(user));
    },
    {
      storageKey: STORAGE_KEY,
      session: FIXTURES.session,
      user: FIXTURES.user,
    }
  );

  await page.context().route(`**/${PROJECT_REF}.supabase.co/**`, async (route) => {
    const url = new URL(route.request().url());

    if (url.pathname === "/auth/v1/user") {
      await fulfillJson(route, FIXTURES.user);
      return;
    }

    if (url.pathname === "/auth/v1/logout") {
      await fulfillJson(route, {});
      return;
    }

    if (url.pathname.startsWith("/functions/v1/")) {
      await handleFunctions(route, url);
      return;
    }

    if (url.pathname.startsWith("/rest/v1/")) {
      await handleRest(route, url);
      return;
    }

    await route.continue();
  });
}

export const mockUser = FIXTURES.user;
