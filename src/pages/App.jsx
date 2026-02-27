import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppShell from "../components/layout/AppShell";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import { supabase } from "../lib/supabase";
import { fetchStripeConnectStatus } from "../lib/stripeConnect";
import { money, durationLabel, formatNextAppt, normalizePlanKey } from "../lib/format";

function safeFirstName(fullName, fallback = "there") {
  const v = (fullName || fallback).trim();
  const first = v.split(" ")[0]?.trim();
  return first || fallback;
}

function extractAvailabilityRaw(profile) {
  if (!profile || typeof profile !== "object") return null;
  const keys = ["availability_schedule", "weekly_availability", "availability", "availability_json"];
  for (const k of keys) {
    if (profile[k]) return profile[k];
  }
  return null;
}

function countEnabledAvailabilityDays(raw) {
  if (!raw || typeof raw !== "object") return 0;
  const source = raw.week && typeof raw.week === "object" ? raw.week : raw;
  let count = 0;
  for (const key of ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]) {
    if (source[key] && source[key].enabled) count += 1;
  }
  return count;
}

export default function App() {
  const nav = useNavigate();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [retryKey, setRetryKey] = useState(0);

  // Auth / subscription
  const [user, setUser] = useState(null);
  const [subStatus, setSubStatus] = useState(null);
  const [plan, setPlan] = useState(null);
  const [interval, setInterval] = useState(null);
  const [currentPeriodEnd, setCurrentPeriodEnd] = useState(null);
  const [billingLoading, setBillingLoading] = useState(false);
  const [billingMsg, setBillingMsg] = useState("");

  // Profile + services
  const [profile, setProfile] = useState(null);
  const [services, setServices] = useState([]);
  const [availabilityDays, setAvailabilityDays] = useState(0);
  const [stats, setStats] = useState({
    bookings: 0,
    nextAppointment: "n/a",
    services: 0,
    inquiries: 0,
    monthRevenue: 0,
  });
  const [nudgeMsg, setNudgeMsg] = useState("");
  const [payoutStatus, setPayoutStatus] = useState({
    connected: false,
    account_id: null,
    charges_enabled: false,
    payouts_enabled: false,
    details_submitted: false,
    status: "not_started",
  });

  const isActive = subStatus === "active";

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      setErr("");

      try {
        // 1) Auth
        const { data: userRes, error: userErr } = await supabase.auth.getUser();
        if (userErr) throw userErr;

        const u = userRes?.user ?? null;
        if (!mounted) return;
        setUser(u);

        if (!u) {
          nav("/login", { replace: true });
          return;
        }

        const connect = await fetchStripeConnectStatus();
        if (mounted) setPayoutStatus(connect);

        // 2) Subscription
        const { data: subRow, error: subErr } = await supabase
          .from("pro_subscriptions")
          .select("status, interval, plan, current_period_end")
          .eq("user_id", u.id)
          .maybeSingle();

        if (subErr) {
          console.error("[App] pro_subscriptions error:", subErr);
        }

        if (!mounted) return;

        setSubStatus(subRow?.status ?? null);
        setPlan(subRow?.plan ?? null);
        setInterval(subRow?.interval ?? null);
        setCurrentPeriodEnd(subRow?.current_period_end ?? null);

        // Do not stop dashboard data loading for non-active plans.
        // We still fetch profile/services and show upgrade state in UI.

        // 3) Profile
        const { data: prof, error: profErr } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", u.id)
          .maybeSingle();

        if (profErr) {
          console.error("[App] profiles error:", profErr);
          setErr("Couldn’t load all profile details yet. Showing what we can.");
        }

        // If missing, create a forgiving default then send to onboarding
        if (!prof) {
          await supabase
            .from("profiles")
            .upsert({ id: u.id, role: "professional", onboarding_step: "basics" }, { onConflict: "id" });

          nav("/app/onboarding", { replace: true });
          return;
        }

        // Gate: pros must finish onboarding
        if (prof?.role === "professional" && prof?.onboarding_step !== "complete") {
          nav("/app/onboarding", { replace: true });
          return;
        }

        if (!mounted) return;
        setProfile(prof || {});

        // 4) Availability (cloud table; optional while migrating)
        const { data: availabilityRow, error: availabilityErr } = await supabase
          .from("pro_availability")
          .select("week")
          .eq("user_id", u.id)
          .maybeSingle();

        if (availabilityErr) {
          console.warn("[App] pro_availability read warning:", availabilityErr);
          setAvailabilityDays(0);
        } else {
          setAvailabilityDays(countEnabledAvailabilityDays(availabilityRow?.week));
        }

        // 5) Services
        const { data: svcs, error: svcErr } = await supabase
          .from("services")
          .select("*")
          .eq("stylist_id", u.id)
          .order("created_at", { ascending: false });

        if (svcErr) {
          console.error("[App] services error:", svcErr);
          setErr("Couldn’t load services yet. Please refresh.");
          setLoading(false);
          return;
        }

        const serviceIds = (svcs || []).map((s) => s.id);

        // 6) Service Photos (pick first photo per service by sort_order)
        let photosByService = {};
        if (serviceIds.length) {
          const { data: photos, error: photoErr } = await supabase
            .from("service_photos")
            .select("service_id, url, sort_order")
            .in("service_id", serviceIds)
            .order("sort_order", { ascending: true });

          if (photoErr) {
            console.error("[App] service_photos error:", photoErr);
          } else {
            for (const p of photos || []) {
              if (!photosByService[p.service_id]) photosByService[p.service_id] = [];
              photosByService[p.service_id].push(p);
            }
          }
        }

        const mappedServices =
          (svcs || []).map((s) => {
            const photo0 = photosByService[s.id]?.[0]?.url || null;
            const thumb = photo0 || s.image_url || "/assets/cover.png";

            return {
              id: s.id,
              title: s.description || "Service",
              duration_minutes: s.duration_minutes ?? 0,
              price: s.price ?? 0,
              deposit_amount: s.deposit_amount ?? null,
              thumb,
            };
          }) ?? [];

        if (!mounted) return;
        setServices(mappedServices);

        // 7) Bookings stats
        const todayStr = new Date().toISOString().split("T")[0];
        const thisMonthStr = new Date().toISOString().slice(0, 7);

        const { data: bookingRows } = await supabase
          .from("appointments")
          .select("id, status, appointment_date, appointment_time, deposit_amount")
          .eq("profile_id", u.id)
          .order("appointment_date", { ascending: true })
          .order("appointment_time", { ascending: true });

        const allBookings = bookingRows ?? [];
        const nextAppt = allBookings.find(
          (b) =>
            (b.status === "confirmed" || b.status === "pending") &&
            b.appointment_date >= todayStr
        );
        const pendingCount = allBookings.filter((b) => b.status === "pending").length;
        const monthRevenue = allBookings
          .filter(
            (b) =>
              (b.status === "confirmed" || b.status === "completed") &&
              b.appointment_date?.startsWith(thisMonthStr)
          )
          .reduce((sum, b) => sum + Number(b.deposit_amount ?? 0), 0);

        if (!mounted) return;
        setStats({
          bookings: allBookings.length,
          nextAppointment: nextAppt
            ? formatNextAppt(nextAppt.appointment_date, nextAppt.appointment_time)
            : "n/a",
          services: mappedServices.length,
          inquiries: pendingCount,
          monthRevenue,
        });

        setLoading(false);
      } catch (e) {
        console.error("[App] load error:", e);
        if (!mounted) return;
        setErr("Something went wrong loading your dashboard.");
        setLoading(false);
      }
    }

    load();

    return () => {
      mounted = false;
    };
  }, [nav, retryKey]);

  const firstName = useMemo(() => {
    if (profile?.full_name) return safeFirstName(profile.full_name, "there");
    if (profile?.business_name) return safeFirstName(profile.business_name, "there");
    return "there";
  }, [profile]);

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  async function openBillingPortal() {
    if (billingLoading) return;

    const likelyFreePlan = currentPlanKey === "free" || !isActive;
    if (likelyFreePlan) {
      nav("/pricing?billing=setup&focus=plans");
      return;
    }

    setBillingLoading(true);
    setBillingMsg("");

    try {
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";
      const sbUrl = import.meta.env.VITE_SUPABASE_URL || "";

      if (!anonKey || !sbUrl) {
        throw new Error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY.");
      }

      const { data: authData, error: sessErr } = await supabase.auth.getSession();
      if (sessErr) throw sessErr;

      const s = authData?.session;
      if (!s?.access_token) {
        const next = encodeURIComponent(`${window.location.pathname}${window.location.search}`);
        nav(`/login?next=${next}`, { replace: true });
        return;
      }

      const { data, error } = await supabase.functions.invoke("create-billing-portal-session", {
        body: { return_path: "/app" },
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${s.access_token}`,
          "Content-Type": "application/json",
        },
      });

      if (!error && data?.url) {
        window.location.assign(data.url);
        return;
      }

      try {
        const invokePayload = error?.context ? await error.context.json() : null;
        if (invokePayload?.error === "no_stripe_customer") {
          nav("/pricing?billing=setup&focus=plans");
          return;
        }
      } catch {
        // Continue to explicit fetch fallback
      }

      const fnUrl = `${sbUrl}/functions/v1/create-billing-portal-session`;
      const res = await fetch(fnUrl, {
        method: "POST",
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${s.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ return_path: "/app" }),
      });

      const text = await res.text();
      let json;
      try {
        json = JSON.parse(text);
      } catch {
        json = { raw: text };
      }

      if (!res.ok) {
        const code = json?.error || json?.code || "";
        if (code === "no_stripe_customer") {
          nav("/pricing?billing=setup&focus=plans");
          return;
        }
        throw new Error(json?.message || json?.error || `Edge Function failed (${res.status})`);
      }

      if (!json?.url) throw new Error("No billing portal URL returned.");
      window.location.assign(json.url);
    } catch (e) {
      console.error("[App] openBillingPortal failed:", e);
      setBillingMsg("Couldn’t open billing right now. You can manage plans from Pricing.");
    } finally {
      setBillingLoading(false);
    }
  }

  const currentPlanKey = useMemo(() => {
    const fromDb = normalizePlanKey(plan);
    if (fromDb) return fromDb;

    const fromMeta = normalizePlanKey(user?.user_metadata?.selected_plan);
    if (fromMeta) return fromMeta;

    if (isActive && interval === "annual") return "founder";
    if (!isActive) return "free";
    return "paid";
  }, [plan, user, isActive, interval]);

  const planLabel = useMemo(() => {
    if (currentPlanKey === "free") return "Free";
    if (currentPlanKey === "starter") return "Starter";
    if (currentPlanKey === "pro") return "Pro";
    if (currentPlanKey === "founder") return "Founder";
    if (currentPlanKey === "elite") return "Elite";
    if (currentPlanKey === "paid") return "Paid";
    return "Free";
  }, [currentPlanKey]);

  const isFounder = currentPlanKey === "founder";

  const subscriptionLine = useMemo(() => {
    if (!isActive) return `${planLabel} plan`;
    return `${planLabel} plan active`;
  }, [isActive, planLabel]);

  const billingCtaLabel = useMemo(() => {
    if (!isActive || currentPlanKey === "free") return "Upgrade Plan";
    return "Manage Subscription";
  }, [isActive, currentPlanKey]);

  function formatDate(iso) {
    if (!iso) return null;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleDateString();
  }

  async function copyText(value, success) {
    try {
      await navigator.clipboard.writeText(value);
      setNudgeMsg(success);
    } catch {
      setNudgeMsg("Could not copy. Please copy manually.");
    }
  }

  // Loading screen
  if (loading) {
    return (
      <AppShell title="Dashboard" onSignOut={signOut}>
        <Card style={{ padding: 18 }}>
          <div style={{ fontWeight: 800, fontSize: 18 }}>Loading…</div>
          <div className="u-muted" style={{ marginTop: 6 }}>
            Please wait.
          </div>
        </Card>
      </AppShell>
    );
  }
  // If subscription is not active, DO NOT block the app for starter/free.
  // We show an upgrade card, but continue rendering the dashboard.

  // Dashboard content
  const displayBusinessName = profile?.business_name || "Your Business";
  const displayType = profile?.business_type || "Professional";
  const displayLocation = profile?.display_location || "—";
  const mobileLabel = profile?.travels_to_clients ? "Yes" : "No";
  const radiusLabel =
    profile?.travels_to_clients && (profile?.travel_radius_miles ?? null) !== null
      ? `${profile.travel_radius_miles} miles`
      : "—";

  const bookingBase = (import.meta.env.VITE_BOOKING_BASE_URL || window.location.origin || "").replace(/\/$/, "");
  const bookingLink = user?.id ? `${bookingBase}/professional/${user.id}` : "";
  const activationText = `Hey! You can book me here: ${bookingLink}. Pick your service + time and I will confirm right away.`;

  const hasProfileStep = Boolean(profile?.business_name && profile?.business_type);
  const hasServicesStep = services.length > 0;
  const hasPhotosStep = services.some((s) => s.thumb && !String(s.thumb).includes("/assets/cover.png"));
  const hasDepositStep = services.some((s) => Number(s.deposit_amount ?? 0) > 0);
  const profileEnabledDays = countEnabledAvailabilityDays(extractAvailabilityRaw(profile));
  const hasAvailabilityStep = Boolean(
    profile?.has_location || profile?.travels_to_clients || profileEnabledDays > 0 || availabilityDays > 0
  );
  const hasPayoutStep = Boolean(payoutStatus.connected);
  const publishDone = [
    hasProfileStep,
    hasServicesStep,
    hasPhotosStep,
    hasDepositStep,
    hasAvailabilityStep,
    hasPayoutStep,
  ].filter(Boolean).length;

  return (
    <AppShell title="Dashboard" onSignOut={signOut}>
      <div className="g-page">
        <h1 className="g-h1">Welcome back, {firstName}!</h1>

        <div className="g-grid">
          {/* LEFT COLUMN */}
          <div className="g-colLeft">
            {/* Plan Card */}
            <Card className="g-planCard">
              <div className="g-planTop">
                <div className="u-muted">Current Plan</div>
                <div className="g-badge">{planLabel}</div>
              </div>

              <div className="g-planBottom">
                <div className="g-planMeta">
                  <span className="g-dotIcon">👤</span>
                  <span className="u-muted">
                    {currentPeriodEnd ? `Renews on ${formatDate(currentPeriodEnd)}` : subscriptionLine}
                  </span>
                </div>

                <button className="g-linkBtn" type="button" onClick={openBillingPortal}>
                  {billingLoading ? "Opening billing..." : billingCtaLabel}
                  {!billingLoading ? <span className="g-ext">↗</span> : null}
                </button>
              </div>
              </Card>

            {billingMsg ? <div className="u-muted">{billingMsg}</div> : null}

            {/* Profile Card */}
            <Card className="g-profileCard">
              <div className="g-profileRow">
                <div className="g-avatarWrap">
                  <img
                    className="g-avatar"
                    src={profile?.avatar_url || "/assets/cover.png"}
                    alt={displayBusinessName}
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                  />
                  <div className="g-avatarFallback" aria-hidden="true" />
                </div>

                <div className="g-profileMain">
                  <div className="g-profileNameRow">
                    <div className="g-profileName">{displayBusinessName}</div>
                    {isFounder ? <span className="g-founderBadge">Founder</span> : null}
                  </div>
                  <div className="g-profileType">{displayType}</div>

                  <div className="g-profileMeta">
                    <div className="g-metaItem">
                      <span className="g-metaIcon">📍</span>
                      <span>{displayLocation}</span>
                    </div>
                    <div className="g-metaItem">
                      <span className="g-metaIcon">🚗</span>
                      <span>Mobile: {mobileLabel}</span>
                    </div>
                    <div className="g-metaItem">
                      <span className="g-metaIcon">〽</span>
                      <span>Radius: {radiusLabel}</span>
                    </div>
                  </div>

                  <div className="g-profileLinks">
                    {profile?.instagram_handle ? (
                      <div className="g-metaItem">
                        <span className="g-metaIcon">◎</span>
                        <span>{profile.instagram_handle.startsWith("@") ? profile.instagram_handle : `@${profile.instagram_handle}`}</span>
                      </div>
                    ) : null}

                    {profile?.website_url ? (
                      <div className="g-metaItem">
                        <span className="g-metaIcon">⌂</span>
                        <span>{profile.website_url}</span>
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="g-profileCtas">
                  <Button variant="primary" className="g-ctaWide" onClick={() => nav("/app/profile")}>
                    Edit Profile
                  </Button>

                  <Button variant="outline" className="g-ctaWide" onClick={() => nav("/app/services")}>
                    Manage Services
                  </Button>
                </div>
              </div>
            </Card>

            {/* Services List */}
            <Card className="g-servicesCard">
                <div className="g-cardHeader">
                  <div className="g-cardTitle">Your Services</div>
                <Button variant="outline" onClick={() => nav("/app/services")}>
                    + Add Service
                  </Button>
                </div>

              {services.length ? (
                <div className="g-serviceList">
                  {services.map((s) => (
                    <div key={s.id} className="g-serviceRow">
                      <div className="g-serviceLeft">
                        <div className="g-serviceThumbWrap">
                          <img
                            className="g-serviceThumb"
                            src={s.thumb}
                            alt={s.title}
                            onError={(e) => {
                              e.currentTarget.style.display = "none";
                            }}
                          />
                          <div className="g-serviceThumbFallback" aria-hidden="true" />
                        </div>

                        <div className="g-serviceInfo">
                          <div className="g-serviceTitle">{s.title}</div>
                          <div className="g-serviceSub">{durationLabel(s.duration_minutes) || "—"}</div>
                        </div>
                      </div>

                      <div className="g-serviceRight">
                        <div className="g-price">{money(s.price)}</div>
                        <Button
                          variant="outline"
                          className="g-editPill"
                          onClick={() => nav("/app/services")}
                        >
                          Edit
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="u-muted" style={{ padding: "10px 2px" }}>
                  No services yet. Click <strong>+ Add Service</strong> to create your first one.
                </div>
              )}
            </Card>
          </div>

          {/* RIGHT COLUMN */}
          <div className="g-colRight">
            {/* At a Glance */}
            <Card className="g-glanceCard">
              <div className="g-cardTitle">At a Glance</div>

              <div className="g-statList">
                <div className="g-statRow">
                  <div className="g-statLeft">
                    <span className="g-statIcon">▦</span>Bookings
                  </div>
                  <div className="g-statVal">{stats.bookings}</div>
                </div>
                <div className="g-divider" />

                <div className="g-statRow">
                  <div className="g-statLeft">
                    <span className="g-statIcon">🕒</span>Next Appointment
                  </div>
                  <div className="g-statVal">{stats.nextAppointment}</div>
                </div>
                <div className="g-divider" />

                <div className="g-statRow">
                  <div className="g-statLeft">
                    <span className="g-statIcon">🏷</span>Services
                  </div>
                  <div className="g-statVal">{stats.services}</div>
                </div>
                <div className="g-divider" />

                <div className="g-statRow">
                  <div className="g-statLeft">
                    <span className="g-statIcon">⏳</span>Pending
                  </div>
                  <div className="g-statVal">{stats.inquiries}</div>
                </div>
                <div className="g-divider" />

                <div className="g-statRow">
                  <div className="g-statLeft">
                    <span className="g-statIcon">💰</span>Revenue (mo.)
                  </div>
                  <div className="g-statVal" style={{ color: "#6CFFB3" }}>{money(stats.monthRevenue)}</div>
                </div>
              </div>

              <Button variant="outline" className="btnFull" onClick={() => nav("/app/calendar")}>
                View All Appointments
              </Button>

              <Button
                variant="outline"
                className="btnFull"
                onClick={() => nav("/app/payouts")}
              >
                {hasPayoutStep ? "⚡ Payouts" : "💳 Connect Stripe"}
              </Button>

              {err ? (
                <div className="u-muted" style={{ marginTop: 12 }}>
                  {err}
                  <button
                    className="g-pillBtn"
                    style={{ marginLeft: 8 }}
                    onClick={() => setRetryKey((k) => k + 1)}
                  >
                    Retry
                  </button>
                </div>
              ) : null}
            </Card>

            {/* Get Started */}
            {publishDone < 6 ? (
              <Card className="g-startCard">
                <div className="g-cardTitle">Publish Readiness</div>
                <div className="u-muted" style={{ marginTop: 4, marginBottom: 10 }}>
                  {publishDone}/6 complete before your best booking conversion.
                </div>

                <div className="g-checklist">
                  <div className={`g-checkItem ${hasProfileStep ? "g-checkItemDone" : ""}`}>
                    <div className="g-checkMeta">
                      <strong>{hasProfileStep ? "Done" : "Complete profile basics"}</strong>
                      <span>Business name and business type</span>
                    </div>
                    {!hasProfileStep ? (
                      <button className="g-pillBtn" onClick={() => nav("/app/profile")}>Fix</button>
                    ) : <span>✓</span>}
                  </div>

                  <div className={`g-checkItem ${hasServicesStep ? "g-checkItemDone" : ""}`}>
                    <div className="g-checkMeta">
                      <strong>{hasServicesStep ? "Done" : "Add at least one service"}</strong>
                      <span>Clients need bookable options</span>
                    </div>
                    {!hasServicesStep ? (
                      <button className="g-pillBtn" onClick={() => nav("/app/services")}>Add</button>
                    ) : <span>✓</span>}
                  </div>

                  <div className={`g-checkItem ${hasPhotosStep ? "g-checkItemDone" : ""}`}>
                    <div className="g-checkMeta">
                      <strong>{hasPhotosStep ? "Done" : "Upload service photos"}</strong>
                      <span>Portfolio photos improve trust and conversion</span>
                    </div>
                    {!hasPhotosStep ? (
                      <button className="g-pillBtn" onClick={() => nav("/app/services")}>Upload</button>
                    ) : <span>✓</span>}
                  </div>

                  <div className={`g-checkItem ${hasDepositStep ? "g-checkItemDone" : ""}`}>
                    <div className="g-checkMeta">
                      <strong>{hasDepositStep ? "Done" : "Enable a deposit"}</strong>
                      <span>Deposits reduce no-shows and lock intent</span>
                    </div>
                    {!hasDepositStep ? (
                      <button className="g-pillBtn" onClick={() => nav("/app/services")}>Enable</button>
                    ) : <span>✓</span>}
                  </div>

                  <div className={`g-checkItem ${hasAvailabilityStep ? "g-checkItemDone" : ""}`}>
                    <div className="g-checkMeta">
                      <strong>{hasAvailabilityStep ? "Done" : "Set availability"} </strong>
                      <span>Define where/when clients can book</span>
                    </div>
                    {!hasAvailabilityStep ? (
                      <button className="g-pillBtn" onClick={() => nav("/app/settings")}>Set</button>
                    ) : <span>✓</span>}
                  </div>

                  <div className={`g-checkItem ${hasPayoutStep ? "g-checkItemDone" : ""}`}>
                    <div className="g-checkMeta">
                      <strong>{hasPayoutStep ? "Done" : "Connect Stripe payouts"}</strong>
                      <span>
                        {hasPayoutStep
                          ? "Deposits and payouts are unlocked."
                          : "Required for payout features and instant payout."}
                      </span>
                    </div>
                    {!hasPayoutStep ? (
                      <button className="g-pillBtn" onClick={() => nav("/app/onboarding/payouts")}>Connect</button>
                    ) : <span>✓</span>}
                  </div>
                </div>
              </Card>
            ) : null}

            <Card className="g-nudgeCard">
              <div className="g-cardTitle">First Booking Activation</div>
              <div className="g-nudgeList">
                <div className="g-nudgeRow">
                  <div>
                    <strong>Copy booking link</strong>
                    <span>{bookingLink || "Link unavailable"}</span>
                  </div>
                  <button className="g-pillBtn" onClick={() => copyText(bookingLink, "Booking link copied.")}>
                    Copy
                  </button>
                </div>
                <div className="g-nudgeRow">
                  <div>
                    <strong>Share SMS template</strong>
                    <span>Quick client text with your booking link</span>
                  </div>
                  <button className="g-pillBtn" onClick={() => copyText(activationText, "SMS template copied.")}>
                    Copy
                  </button>
                </div>
                <div className="g-nudgeRow">
                  <div>
                    <strong>Deposit toggle</strong>
                    <span>Set a deposit on your top services</span>
                  </div>
                  <button className="g-pillBtn" onClick={() => nav("/app/services")}>
                    Open
                  </button>
                </div>
                <div className="g-nudgeRow">
                  <div>
                    <strong>Payout features</strong>
                    <span>
                      {hasPayoutStep ? "Connected to Stripe. Payout tools unlocked." : "Connect Stripe to unlock payout actions."}
                    </span>
                  </div>
                  <button className="g-pillBtn" onClick={() => (hasPayoutStep ? openBillingPortal() : nav("/app/onboarding/payouts"))}>
                    {hasPayoutStep ? "Manage" : "Connect"}
                  </button>
                </div>
              </div>
              {nudgeMsg ? <div className="g-smallMsg">{nudgeMsg}</div> : null}
            </Card>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
