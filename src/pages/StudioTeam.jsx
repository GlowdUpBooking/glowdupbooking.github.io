import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import AppShell from "../components/layout/AppShell";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import { formatApptDate, money, normalizePlanKey } from "../lib/format";
import { supabase } from "../lib/supabase";
import { fetchStudioAccessContext } from "../lib/studioAccess";
import {
  STUDIO_EXTRA_ACCOUNT_MONTHLY_PRICE,
  STUDIO_INCLUDED_ACCOUNTS,
  STUDIO_MAX_ACCOUNTS,
  createStudioCalendarResource,
  createStudioRentPaymentSession,
  createStudioRentSchedule,
  createStudioWithOwner,
  deleteStudioCalendarResource,
  fetchAppointmentTeamAssignments,
  fetchStudioCalendarResources,
  fetchStudioMemberDirectory,
  fetchStudioMembers,
  fetchStudioPayoutReports,
  fetchStudioRentPayments,
  fetchStudioRentSchedules,
  fetchStudiosForProfile,
  formatStudioRentCadenceLabel,
  formatStudioRoleLabel,
  getStudioRentScheduleSummary,
  getStudioSeatSummary,
  inviteStudioMemberByEmail,
  isStudioTeamFeatureUnavailableError,
  recordStudioRentPayment,
  setStudioMemberActive,
  syncStudioRentPaymentSession,
  syncStudioSeatBilling,
  updateStudioCalendarResource,
  updateStudioMemberRole,
  updateStudioRentSchedule,
  upsertAppointmentTeamAssignment,
} from "../lib/studioTeam";

const RESOURCE_TYPES = ["calendar", "chair", "room", "station"];
const MEMBER_ROLES = ["staff", "assistant", "manager", "owner"];
const RENT_CADENCE_OPTIONS = ["weekly", "monthly"];
const RENT_WEEKDAY_OPTIONS = [
  { label: "Sun", value: 0 },
  { label: "Mon", value: 1 },
  { label: "Tue", value: 2 },
  { label: "Wed", value: 3 },
  { label: "Thu", value: 4 },
  { label: "Fri", value: 5 },
  { label: "Sat", value: 6 },
];

function hasActiveStarterTrial(trialEndsAt) {
  const raw = String(trialEndsAt ?? "").trim();
  if (!raw) return false;
  const endMs = Date.parse(raw);
  return Number.isFinite(endMs) && endMs > Date.now();
}

function normalizeBillingTier(value, trialEndsAt) {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "studio") return "studio";
  if (normalized === "pro" || normalized === "elite") return "pro";
  if (normalized === "starter" && hasActiveStarterTrial(trialEndsAt)) return "pro";
  return "free";
}

function firstName(value, fallback = "Studio") {
  const raw = String(value ?? "").trim();
  if (!raw) return fallback;
  return raw.split(/\s+/)[0] || fallback;
}

function shortId(value) {
  const id = String(value ?? "").trim();
  if (!id) return "Unknown";
  if (id.length <= 8) return id;
  return `${id.slice(0, 8)}...`;
}

function formatStudioDate(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "-";
  const date = new Date(raw.length > 10 ? raw : `${raw}T12:00:00Z`);
  if (!Number.isFinite(date.getTime())) return raw;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatStudioResourceTypeLabel(value) {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "chair") return "Chair";
  if (normalized === "room") return "Room";
  if (normalized === "station") return "Station";
  return "Calendar";
}

function studioResourceLabel(resource) {
  const name = String(resource?.resource_name ?? "").trim();
  const typeLabel = formatStudioResourceTypeLabel(resource?.resource_type);
  return name ? `${typeLabel}: ${name}` : typeLabel;
}

function studioMemberDisplayName(profileId, directoryByProfileId) {
  const key = String(profileId ?? "").trim();
  const entry = key ? directoryByProfileId.get(key) : null;
  const businessName = String(entry?.business_name ?? "").trim();
  if (businessName) return businessName;
  const fullName = String(entry?.full_name ?? "").trim();
  if (fullName) return fullName;
  return shortId(key);
}

function describeStudioRentStatus(summary) {
  if (summary.status === "inactive") return "Inactive";
  if (summary.status === "upcoming") {
    return summary.next_due_date ? `First rent due ${formatStudioDate(summary.next_due_date)}` : "Starts soon";
  }
  if (summary.status === "paid") {
    return summary.current_due_date ? `Paid for ${formatStudioDate(summary.current_due_date)}` : "Paid";
  }
  if (summary.status === "waived") {
    return summary.current_due_date ? `Waived for ${formatStudioDate(summary.current_due_date)}` : "Waived";
  }
  if (summary.status === "due_today") return "Due today";
  if (summary.outstanding_due_count > 1) return `${summary.outstanding_due_count} rent periods overdue`;
  return summary.current_due_date ? `Overdue since ${formatStudioDate(summary.current_due_date)}` : "Overdue";
}

function describeStudioRentPaymentMethod(payment) {
  const method = String(payment?.payment_method ?? "").trim().toLowerCase();
  if (!method) return null;
  if (method === "card_via_stripe_checkout") return "Paid by card";
  if (method === "recorded_in_app") return "Recorded by studio owner";
  return method.replace(/_/g, " ");
}

function studioInviteErrorCopy(message) {
  const raw = String(message ?? "").trim();
  const lower = raw.toLowerCase();
  if (lower.includes("no glow'd up account was found")) {
    return "No Glow'd Up professional account was found for that email yet. Ask the teammate to sign up first, then try again.";
  }
  if (lower.includes("needs to finish setting up") || lower.includes("not set up as a professional profile")) {
    return "That account still needs to finish professional setup before it can join the studio.";
  }
  if (lower.includes("10-account limit")) {
    return "This studio has reached the 10-account limit. Deactivate a seat before adding another teammate.";
  }
  return raw || "Please try again.";
}

function studioRentCheckoutErrorCopy(message) {
  const raw = String(message ?? "").trim();
  const lower = raw.toLowerCase();
  if (lower.includes("owner has not finished stripe setup") || lower.includes("not ready to collect")) {
    return "The studio owner still needs to finish Stripe setup before card rent payments are available.";
  }
  if (lower.includes("already marked paid")) return "This rent cycle is already marked paid.";
  if (lower.includes("nothing is due") || lower.includes("not due yet")) return "This rent cycle is not due yet.";
  if (lower.includes("inactive")) return "This rent schedule is inactive right now.";
  return raw || "Could not start the rent payment session.";
}

function toAbsoluteUrl(path) {
  const origin = window.location.origin.replace(/\/$/, "");
  const rawPath = String(path ?? "").trim();
  if (!rawPath) return origin;
  if (/^https?:\/\//i.test(rawPath)) return rawPath;
  const normalizedPath = rawPath.startsWith("/") ? rawPath : `/${rawPath.replace(/^\/+/, "")}`;
  return `${origin}${normalizedPath}`;
}

export default function StudioTeam() {
  const nav = useNavigate();
  const location = useLocation();
  const handledRentResultRef = useRef("");

  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [unsupported, setUnsupported] = useState(false);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");

  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [subPlan, setSubPlan] = useState(null);
  const [activeStudioId, setActiveStudioId] = useState(null);

  const [studioAccess, setStudioAccess] = useState({
    hasStudioAccess: false,
    accessType: null,
    studioId: null,
    studioName: null,
    studioOwnerId: null,
    studioMemberRole: null,
    studioMemberCovered: false,
  });

  const [studios, setStudios] = useState([]);
  const [memberships, setMemberships] = useState([]);
  const [members, setMembers] = useState([]);
  const [memberDirectory, setMemberDirectory] = useState([]);
  const [resources, setResources] = useState([]);
  const [reports, setReports] = useState([]);
  const [rentSchedules, setRentSchedules] = useState([]);
  const [rentPayments, setRentPayments] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [assignments, setAssignments] = useState([]);

  const [createStudioName, setCreateStudioName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("staff");
  const [newResourceName, setNewResourceName] = useState("");
  const [newResourceType, setNewResourceType] = useState("calendar");
  const [newResourceMemberId, setNewResourceMemberId] = useState("");
  const [newRentMemberId, setNewRentMemberId] = useState("");
  const [newRentResourceId, setNewRentResourceId] = useState("");
  const [newRentAmount, setNewRentAmount] = useState("");
  const [newRentCadence, setNewRentCadence] = useState("weekly");
  const [newRentDueWeekday, setNewRentDueWeekday] = useState("1");
  const [newRentDueDayOfMonth, setNewRentDueDayOfMonth] = useState("1");
  const [newRentStartDate, setNewRentStartDate] = useState(() => new Date().toISOString().slice(0, 10));

  const [createBusy, setCreateBusy] = useState(false);
  const [inviteBusy, setInviteBusy] = useState(false);
  const [memberBusyId, setMemberBusyId] = useState(null);
  const [resourceBusyId, setResourceBusyId] = useState(null);
  const [rentBusyId, setRentBusyId] = useState(null);
  const [assignmentBusyId, setAssignmentBusyId] = useState(null);
  const [assignmentInputs, setAssignmentInputs] = useState({});

  const billingTier = normalizeBillingTier(profile?.billing_tier ?? profile?.plan, profile?.trial_ends_at);
  const isStudioTier = billingTier === "studio" || normalizePlanKey(subPlan) === "studio";
  const studioMemberCovered = Boolean(profile?.studio_member_covered) || studioAccess.studioMemberCovered;
  const hasStudioWorkspace = studios.length > 0;

  const activeMembership = useMemo(() => {
    if (!activeStudioId || !user?.id) return null;
    return (
      memberships.find((row) => row.studio_id === activeStudioId && row.profile_id === user.id && row.is_active) ??
      memberships.find((row) => row.studio_id === activeStudioId && row.profile_id === user.id) ??
      null
    );
  }, [activeStudioId, memberships, user?.id]);

  const activeStudio = useMemo(
    () => studios.find((studio) => studio.id === activeStudioId) ?? null,
    [activeStudioId, studios]
  );

  const directoryByProfileId = useMemo(() => {
    const map = new Map();
    for (const entry of memberDirectory) {
      map.set(String(entry.profile_id ?? "").trim(), entry);
    }
    return map;
  }, [memberDirectory]);

  const memberById = useMemo(() => {
    const map = new Map();
    for (const member of members) {
      map.set(member.id, member);
    }
    return map;
  }, [members]);

  const resourceById = useMemo(() => {
    const map = new Map();
    for (const resource of resources) {
      map.set(resource.id, resource);
    }
    return map;
  }, [resources]);

  const assignmentByAppointmentId = useMemo(() => {
    const map = new Map();
    for (const assignment of assignments) {
      map.set(assignment.appointment_id, assignment);
    }
    return map;
  }, [assignments]);

  const activeMembers = useMemo(() => members.filter((member) => member.is_active), [members]);
  const inactiveMembers = useMemo(() => members.filter((member) => !member.is_active), [members]);
  const seatSummary = useMemo(() => getStudioSeatSummary(activeMembers.length), [activeMembers.length]);
  const canManageStudio = Boolean(activeMembership?.member_role === "owner");
  const canAssignAppointments = Boolean(activeMembership?.is_active);
  const visibleRentSchedules = useMemo(() => {
    if (canManageStudio) return rentSchedules;
    if (!activeMembership?.id) return [];
    return rentSchedules.filter((schedule) => schedule.member_id === activeMembership.id);
  }, [activeMembership?.id, canManageStudio, rentSchedules]);

  const reportSummary = useMemo(() => {
    return reports.reduce(
      (acc, report) => {
        acc.gross += Number(report.gross_amount ?? 0);
        acc.payout += Number(report.payout_amount ?? 0);
        acc.appointments += Number(report.appointment_count ?? 0);
        return acc;
      },
      { gross: 0, payout: 0, appointments: 0 }
    );
  }, [reports]);

  const canUseStudioWorkspace = isStudioTier || studioMemberCovered || studioAccess.hasStudioAccess || hasStudioWorkspace;

  useEffect(() => {
    if (!profile) return;
    setCreateStudioName((current) => {
      if (current.trim()) return current;
      const businessName = String(profile.business_name ?? "").trim();
      if (businessName) return businessName;
      return `${firstName(profile.full_name, "Glow'd Up")}'s Studio`;
    });
  }, [profile]);

  useEffect(() => {
    if (activeMembers.length === 0) {
      if (newRentMemberId) setNewRentMemberId("");
      return;
    }
    if (newRentMemberId && activeMembers.some((member) => member.id === newRentMemberId)) return;
    setNewRentMemberId(activeMembers[0]?.id ?? "");
  }, [activeMembers, newRentMemberId]);

  useEffect(() => {
    if (!newRentResourceId) return;
    if (resources.some((resource) => resource.id === newRentResourceId && resource.is_active)) return;
    setNewRentResourceId("");
  }, [newRentResourceId, resources]);

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      setErr("");

      try {
        const { data: userRes, error: userErr } = await supabase.auth.getUser();
        if (userErr) throw userErr;

        const nextUser = userRes?.user ?? null;
        if (!mounted) return;
        setUser(nextUser);

        if (!nextUser) {
          nav("/login", { replace: true });
          return;
        }

        const [
          profileRes,
          subRes,
          accessRes,
          studioRes,
        ] = await Promise.all([
          supabase
            .from("profiles")
            .select("id, full_name, business_name, billing_tier, plan, trial_ends_at, studio_member_covered")
            .eq("id", nextUser.id)
            .maybeSingle(),
          supabase
            .from("pro_subscriptions")
            .select("status, plan")
            .eq("user_id", nextUser.id)
            .maybeSingle(),
          fetchStudioAccessContext(nextUser.id).catch((error) => ({ error })),
          fetchStudiosForProfile(nextUser.id),
        ]);

        if (!mounted) return;

        if (profileRes.error && !isStudioTeamFeatureUnavailableError(profileRes.error)) {
          throw profileRes.error;
        }
        setProfile(profileRes.data ?? null);
        setSubPlan(subRes.data?.plan ?? null);

        const accessError = accessRes?.error;
        if (accessError) {
          if (isStudioTeamFeatureUnavailableError(accessError)) {
            setUnsupported(true);
          } else {
            throw accessError;
          }
        } else {
          setStudioAccess(accessRes);
        }

        if (studioRes.error) throw studioRes.error;
        if (studioRes.unsupported) setUnsupported(true);
        setStudios(studioRes.studios);
        setMemberships(studioRes.memberships);

        const knownStudioIds = studioRes.studios.map((studio) => studio.id);
        const preferredStudioId =
          (activeStudioId && knownStudioIds.includes(activeStudioId) && activeStudioId) ||
          (accessRes?.studioId && knownStudioIds.includes(accessRes.studioId) && accessRes.studioId) ||
          knownStudioIds[0] ||
          null;

        if (preferredStudioId !== activeStudioId) {
          setActiveStudioId(preferredStudioId);
        }

        if (!preferredStudioId) {
          setMembers([]);
          setMemberDirectory([]);
          setResources([]);
          setReports([]);
          setRentSchedules([]);
          setRentPayments([]);
          setAppointments([]);
          setAssignments([]);
          setAssignmentInputs({});
          return;
        }

        const [
          membersRes,
          directoryRes,
          resourcesRes,
          reportsRes,
          rentSchedulesRes,
          rentPaymentsRes,
        ] = await Promise.all([
          fetchStudioMembers(preferredStudioId, { includeInactive: true }),
          fetchStudioMemberDirectory(preferredStudioId),
          fetchStudioCalendarResources(preferredStudioId, { includeInactive: true }),
          fetchStudioPayoutReports({ studioId: preferredStudioId, limit: 6 }),
          fetchStudioRentSchedules(preferredStudioId, { includeInactive: true }),
          fetchStudioRentPayments(preferredStudioId),
        ]);

        if (!mounted) return;

        const featureResults = [membersRes, directoryRes, resourcesRes, reportsRes, rentSchedulesRes, rentPaymentsRes];
        if (featureResults.some((result) => result.unsupported)) {
          setUnsupported(true);
        }

        for (const result of featureResults) {
          if (result.error) throw result.error;
        }

        setMembers(membersRes.members);
        setMemberDirectory(directoryRes.entries);
        setResources(resourcesRes.resources);
        setReports(reportsRes.reports);
        setRentSchedules(rentSchedulesRes.schedules);
        setRentPayments(rentPaymentsRes.payments);

        const profileIds = [...new Set(membersRes.members.filter((row) => row.is_active).map((row) => row.profile_id).filter(Boolean))];
        if (profileIds.length === 0) {
          setAppointments([]);
          setAssignments([]);
          setAssignmentInputs({});
          return;
        }

        const appointmentRes = await supabase
          .from("appointments")
          .select("id, profile_id, client_name, service, appointment_date, appointment_time, status")
          .in("profile_id", profileIds)
          .not("status", "in", '("canceled","cancelled")')
          .order("appointment_date", { ascending: false })
          .order("appointment_time", { ascending: true })
          .limit(20);

        if (appointmentRes.error) throw appointmentRes.error;

        const appointmentRows = appointmentRes.data ?? [];
        setAppointments(appointmentRows);

        const assignmentRes = await fetchAppointmentTeamAssignments(
          preferredStudioId,
          appointmentRows.map((row) => row.id)
        );

        if (assignmentRes.unsupported) {
          setUnsupported(true);
          setAssignments([]);
          setAssignmentInputs({});
          return;
        }
        if (assignmentRes.error) throw assignmentRes.error;

        setAssignments(assignmentRes.assignments);
        const nextInputs = {};
        for (const appointment of appointmentRows) {
          const assigned = assignmentRes.assignments.find((assignment) => assignment.appointment_id === appointment.id);
          nextInputs[appointment.id] = {
            memberId: assigned?.assigned_member_id ?? "",
            resourceId: assigned?.resource_id ?? "",
            payoutSplit: String(assigned?.payout_split_percent ?? 100),
          };
        }
        setAssignmentInputs(nextInputs);
      } catch (error) {
        console.error("[StudioTeam] load error:", error);
        if (mounted) setErr(error?.message || "Could not load Studio Team right now.");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void load();
    return () => {
      mounted = false;
    };
  }, [activeStudioId, nav, refreshKey]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const result = params.get("rent_payment");
    if (!result) return;

    const sessionId = params.get("session_id") || "";
    const marker = `${result}:${sessionId}`;
    if (handledRentResultRef.current === marker) return;
    handledRentResultRef.current = marker;

    const nextParams = new URLSearchParams(location.search);
    nextParams.delete("rent_payment");
    nextParams.delete("session_id");
    const nextSearch = nextParams.toString();
    nav(`${location.pathname}${nextSearch ? `?${nextSearch}` : ""}`, { replace: true });

    if (result === "cancel") {
      setMsg("Studio rent checkout canceled.");
      return;
    }

    if (result !== "success" || !sessionId) return;

    setMsg("Rent checkout received. Syncing the payment...");
    setErr("");

    void (async () => {
      try {
        const syncResult = await syncStudioRentPaymentSession({ sessionId });
        if (syncResult.error) {
          throw syncResult.error;
        }
        setMsg(syncResult.paid ? "Rent payment recorded." : "Rent checkout was submitted. Refreshing workspace data.");
        setRefreshKey((value) => value + 1);
      } catch (error) {
        setErr(error?.message || "We could not sync the rent payment yet.");
      }
    })();
  }, [location.pathname, location.search, nav]);

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  async function syncSeatBillingSafely(studioId, successMessage = "") {
    const seatBilling = await syncStudioSeatBilling(studioId);
    if (seatBilling.unsupported) {
      setUnsupported(true);
      return;
    }
    if (seatBilling.error && !seatBilling.missingSubscription) {
      setErr("The studio change was saved, but Stripe seat billing could not be updated right now.");
      return;
    }
    if (seatBilling.missingSubscription) {
      setMsg("The workspace change was saved. Finish Studio billing in Subscription to keep seat billing synced.");
      return;
    }
    if (successMessage) {
      setMsg(successMessage);
    }
  }

  async function handleCreateStudio() {
    if (!user?.id || createBusy) return;
    const name = createStudioName.trim();
    if (!name) {
      setErr("Name the studio before creating the workspace.");
      return;
    }

    setCreateBusy(true);
    setErr("");
    try {
      const res = await createStudioWithOwner({
        ownerId: user.id,
        name,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || null,
      });
      if (res.unsupported) {
        setUnsupported(true);
        return;
      }
      if (res.error) throw res.error;
      setMsg(res.alreadyExists ? "Studio workspace already exists on this account." : "Studio workspace created.");
      setRefreshKey((value) => value + 1);
    } catch (error) {
      setErr(error?.message || "Could not create the studio workspace.");
    } finally {
      setCreateBusy(false);
    }
  }

  async function handleInviteMember() {
    if (!activeStudioId || !canManageStudio || inviteBusy) return;
    const email = inviteEmail.trim().toLowerCase();
    if (!email) {
      setErr("Enter the teammate's Glow'd Up email first.");
      return;
    }

    setInviteBusy(true);
    setErr("");
    try {
      const res = await inviteStudioMemberByEmail({
        studioId: activeStudioId,
        email,
        memberRole: inviteRole,
      });
      if (res.unsupported) {
        setUnsupported(true);
        return;
      }
      if (res.error) throw new Error(studioInviteErrorCopy(res.error?.message));

      setInviteEmail("");
      await syncSeatBillingSafely(activeStudioId, res.existingMember ? "Studio teammate reactivated." : "Studio teammate invited.");
      setRefreshKey((value) => value + 1);
    } catch (error) {
      setErr(error?.message || "Could not invite the teammate.");
    } finally {
      setInviteBusy(false);
    }
  }

  async function handleMemberRoleChange(member, nextRole) {
    if (!canManageStudio || !activeStudioId || !member?.id) return;
    if (member.member_role === "owner") return;

    setMemberBusyId(member.id);
    setErr("");
    try {
      const res = await updateStudioMemberRole({
        studioId: activeStudioId,
        memberId: member.id,
        memberRole: nextRole,
      });
      if (res.unsupported) {
        setUnsupported(true);
        return;
      }
      if (res.error) throw res.error;
      setMsg("Studio role updated.");
      setRefreshKey((value) => value + 1);
    } catch (error) {
      setErr(error?.message || "Could not update the teammate role.");
    } finally {
      setMemberBusyId(null);
    }
  }

  async function handleMemberActiveToggle(member) {
    if (!canManageStudio || !activeStudioId || !member?.id) return;
    if (member.profile_id === user?.id && member.member_role === "owner") {
      setErr("You cannot deactivate the owner account from this workspace.");
      return;
    }

    setMemberBusyId(member.id);
    setErr("");
    try {
      const res = await setStudioMemberActive({
        studioId: activeStudioId,
        memberId: member.id,
        isActive: !member.is_active,
      });
      if (res.unsupported) {
        setUnsupported(true);
        return;
      }
      if (res.error) throw res.error;
      await syncSeatBillingSafely(activeStudioId, "Studio seat updated.");
      setRefreshKey((value) => value + 1);
    } catch (error) {
      setErr(error?.message || "Could not update the teammate seat.");
    } finally {
      setMemberBusyId(null);
    }
  }

  async function handleCreateResource() {
    if (!canManageStudio || !activeStudioId) return;
    const resourceName = newResourceName.trim();
    if (!resourceName) {
      setErr("Name the resource before creating it.");
      return;
    }

    setResourceBusyId("__new__");
    setErr("");
    try {
      const res = await createStudioCalendarResource({
        studioId: activeStudioId,
        resourceName,
        resourceType: newResourceType,
        memberId: newResourceMemberId || null,
      });
      if (res.unsupported) {
        setUnsupported(true);
        return;
      }
      if (res.error) throw res.error;
      setNewResourceName("");
      setNewResourceMemberId("");
      setMsg("Studio resource created.");
      setRefreshKey((value) => value + 1);
    } catch (error) {
      setErr(error?.message || "Could not create the studio resource.");
    } finally {
      setResourceBusyId(null);
    }
  }

  async function handleResourceAssignment(resource, nextMemberId) {
    if (!canManageStudio || !activeStudioId) return;
    setResourceBusyId(resource.id);
    setErr("");
    try {
      const res = await updateStudioCalendarResource({
        studioId: activeStudioId,
        resourceId: resource.id,
        memberId: nextMemberId || null,
      });
      if (res.unsupported) {
        setUnsupported(true);
        return;
      }
      if (res.error) throw res.error;
      setMsg("Studio resource updated.");
      setRefreshKey((value) => value + 1);
    } catch (error) {
      setErr(error?.message || "Could not update the resource assignment.");
    } finally {
      setResourceBusyId(null);
    }
  }

  async function handleResourceActiveToggle(resource) {
    if (!canManageStudio || !activeStudioId) return;
    setResourceBusyId(resource.id);
    setErr("");
    try {
      const res = await updateStudioCalendarResource({
        studioId: activeStudioId,
        resourceId: resource.id,
        isActive: !resource.is_active,
      });
      if (res.unsupported) {
        setUnsupported(true);
        return;
      }
      if (res.error) throw res.error;
      setMsg("Studio resource status updated.");
      setRefreshKey((value) => value + 1);
    } catch (error) {
      setErr(error?.message || "Could not update the resource status.");
    } finally {
      setResourceBusyId(null);
    }
  }

  async function handleDeleteResource(resource) {
    if (!canManageStudio || !activeStudioId) return;
    if (!window.confirm(`Delete ${resource.resource_name}? This cannot be undone.`)) return;

    setResourceBusyId(resource.id);
    setErr("");
    try {
      const res = await deleteStudioCalendarResource({
        studioId: activeStudioId,
        resourceId: resource.id,
      });
      if (res.unsupported) {
        setUnsupported(true);
        return;
      }
      if (res.error) throw res.error;
      setMsg("Studio resource deleted.");
      setRefreshKey((value) => value + 1);
    } catch (error) {
      setErr(error?.message || "Could not delete the resource.");
    } finally {
      setResourceBusyId(null);
    }
  }

  async function handleCreateRentSchedule() {
    if (!canManageStudio || !activeStudioId || !newRentMemberId) return;
    const amount = Number(newRentAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setErr("Enter a valid rent amount.");
      return;
    }

    setRentBusyId("__new__");
    setErr("");
    try {
      const res = await createStudioRentSchedule({
        studioId: activeStudioId,
        memberId: newRentMemberId,
        resourceId: newRentResourceId || null,
        amount,
        cadence: newRentCadence,
        dueWeekday: newRentCadence === "weekly" ? Number(newRentDueWeekday) : null,
        dueDayOfMonth: newRentCadence === "monthly" ? Number(newRentDueDayOfMonth) : null,
        startDate: newRentStartDate || null,
        createdBy: user?.id ?? null,
      });
      if (res.unsupported) {
        setUnsupported(true);
        return;
      }
      if (res.error) throw res.error;
      setNewRentAmount("");
      setNewRentResourceId("");
      setNewRentCadence("weekly");
      setNewRentDueWeekday("1");
      setNewRentDueDayOfMonth("1");
      setMsg("Studio rent schedule saved.");
      setRefreshKey((value) => value + 1);
    } catch (error) {
      setErr(error?.message || "Could not save the rent schedule.");
    } finally {
      setRentBusyId(null);
    }
  }

  async function handleToggleRentSchedule(schedule) {
    if (!canManageStudio || !activeStudioId) return;
    setRentBusyId(schedule.id);
    setErr("");
    try {
      const res = await updateStudioRentSchedule({
        studioId: activeStudioId,
        scheduleId: schedule.id,
        isActive: !schedule.is_active,
      });
      if (res.unsupported) {
        setUnsupported(true);
        return;
      }
      if (res.error) throw res.error;
      setMsg("Studio rent schedule updated.");
      setRefreshKey((value) => value + 1);
    } catch (error) {
      setErr(error?.message || "Could not update the rent schedule.");
    } finally {
      setRentBusyId(null);
    }
  }

  async function handleRecordRentPaid(schedule) {
    if (!canManageStudio || !activeStudioId || !user?.id) return;
    const schedulePayments = rentPayments.filter((payment) => payment.rent_schedule_id === schedule.id);
    const summary = getStudioRentScheduleSummary(schedule, schedulePayments);

    if (!schedule.is_active) {
      setErr("Reactivate this rent schedule before recording a payment.");
      return;
    }
    if (!summary.current_due_date) {
      setErr("This rent schedule has not reached its first due date yet.");
      return;
    }
    if (summary.status === "paid" || summary.status === "waived") {
      setErr("The current rent period is already marked paid.");
      return;
    }

    setRentBusyId(`paid:${schedule.id}`);
    setErr("");
    try {
      const res = await recordStudioRentPayment({
        studioId: activeStudioId,
        scheduleId: schedule.id,
        memberId: schedule.member_id,
        dueDate: summary.current_due_date,
        amount: schedule.amount,
        recordedBy: user.id,
        paymentMethod: "recorded_in_app",
      });
      if (res.unsupported) {
        setUnsupported(true);
        return;
      }
      if (res.error) throw res.error;
      setMsg("Rent payment recorded.");
      setRefreshKey((value) => value + 1);
    } catch (error) {
      setErr(error?.message || "Could not record the rent payment.");
    } finally {
      setRentBusyId(null);
    }
  }

  async function handlePayRent(schedule) {
    if (canManageStudio) return;

    const schedulePayments = rentPayments.filter((payment) => payment.rent_schedule_id === schedule.id);
    const summary = getStudioRentScheduleSummary(schedule, schedulePayments);
    if (!schedule.is_active) {
      setErr("This rent schedule is inactive right now.");
      return;
    }
    if (!summary.current_due_date) {
      setErr("This rent cycle is not due yet.");
      return;
    }
    if (summary.status === "paid" || summary.status === "waived") {
      setErr("This rent cycle is already marked paid.");
      return;
    }

    setRentBusyId(`checkout:${schedule.id}`);
    setErr("");
    try {
      const session = await createStudioRentPaymentSession({
        rentScheduleId: schedule.id,
        currency: "usd",
        returnUrl: toAbsoluteUrl("/app/studio"),
        successUrl: toAbsoluteUrl("/app/studio?rent_payment=success&session_id={CHECKOUT_SESSION_ID}"),
        cancelUrl: toAbsoluteUrl("/app/studio?rent_payment=cancel"),
      });

      if (session.unsupported) {
        setUnsupported(true);
        return;
      }
      if (session.error || !session.url) {
        throw new Error(studioRentCheckoutErrorCopy(session.error?.message));
      }

      window.location.assign(session.url);
    } catch (error) {
      setErr(error?.message || "Could not start the rent payment session.");
    } finally {
      setRentBusyId(null);
    }
  }

  function updateAssignmentInput(appointmentId, patch) {
    setAssignmentInputs((current) => ({
      ...current,
      [appointmentId]: {
        memberId: current[appointmentId]?.memberId ?? "",
        resourceId: current[appointmentId]?.resourceId ?? "",
        payoutSplit: current[appointmentId]?.payoutSplit ?? "100",
        ...patch,
      },
    }));
  }

  async function handleSaveAssignment(appointment) {
    if (!canAssignAppointments || !activeStudioId || !appointment?.id) return;
    const input = assignmentInputs[appointment.id] ?? { memberId: "", resourceId: "", payoutSplit: "100" };
    const payoutSplit = Number(input.payoutSplit);
    if (!Number.isFinite(payoutSplit) || payoutSplit < 0 || payoutSplit > 100) {
      setErr("Payout split must be a percent between 0 and 100.");
      return;
    }

    setAssignmentBusyId(appointment.id);
    setErr("");
    try {
      const res = await upsertAppointmentTeamAssignment({
        appointmentId: appointment.id,
        studioId: activeStudioId,
        assignedMemberId: input.memberId || null,
        resourceId: input.resourceId || null,
        assignedBy: user?.id ?? null,
        payoutSplitPercent: payoutSplit,
        assignmentNotes: input.memberId || input.resourceId ? "Assigned from web studio dashboard" : "Assignment cleared",
      });
      if (res.unsupported) {
        setUnsupported(true);
        return;
      }
      if (res.error) throw res.error;
      setMsg("Appointment assignment saved.");
      setRefreshKey((value) => value + 1);
    } catch (error) {
      setErr(error?.message || "Could not save the appointment assignment.");
    } finally {
      setAssignmentBusyId(null);
    }
  }

  return (
    <AppShell title="Studio Team" onSignOut={signOut}>
      <div className="tm-page">
        <Card className="tm-hero">
          <div className="tm-heroTop">
            <div>
              <div className="tm-kicker">Studio workspace</div>
              <h1 className="tm-title">{activeStudio?.name ?? "Studio Team"}</h1>
              <p className="tm-sub">
                {studioMemberCovered
                  ? "Your Studio owner covers this seat while you stay active in the workspace."
                  : isStudioTier
                    ? "Manage teammates, shared resources, rent tracking, and recent assignment controls from the web dashboard."
                    : "Studio is billed on the web and unlocks shared team workspaces, resources, and payout reporting across the app."}
              </p>
            </div>

            <div className="tm-heroActions">
              <Button variant="outline" onClick={() => setRefreshKey((value) => value + 1)}>
                Refresh
              </Button>
              <Button variant="outline" onClick={() => nav("/app/subscription")}>
                Subscription
              </Button>
            </div>
          </div>

          <div className="tm-stepList">
            <div className="tm-step">
              {isStudioTier || studioMemberCovered
                ? "Studio access is active on this account."
                : "Upgrade to Studio in Subscription to unlock the shared workspace."}
            </div>
            <div className="tm-step">
              Teammates need their own Glow&apos;d Up professional account before you invite them.
            </div>
            <div className="tm-step">
              The first {STUDIO_INCLUDED_ACCOUNTS} active accounts are included. Accounts {STUDIO_INCLUDED_ACCOUNTS + 1}-{STUDIO_MAX_ACCOUNTS} add {money(STUDIO_EXTRA_ACCOUNT_MONTHLY_PRICE)}/month each.
            </div>
            <div className="tm-step">
              Owners manage seats, resources, and rent tracking. Active teammates can still save appointment assignments.
            </div>
          </div>
        </Card>

        {msg ? <div className="tm-banner tm-bannerOk">{msg}</div> : null}
        {err ? <div className="tm-banner tm-bannerErr">{err}</div> : null}

        {unsupported ? (
          <Card className="tm-panel">
            <div className="tm-panelTitle">Studio deployment required</div>
            <p className="tm-copy">
              Some Studio workspace tables or helper functions are not available in this environment yet. Billing can still be managed in Subscription.
            </p>
          </Card>
        ) : null}

        {!loading && !unsupported && !canUseStudioWorkspace ? (
          <Card className="tm-panel">
            <div className="tm-panelTitle">Studio upgrade required</div>
            <p className="tm-copy">
              This account does not have Studio access yet. Upgrade in Subscription to unlock team seats, shared resources, rent tracking, and payout reporting.
            </p>
            <div className="tm-inlineActions">
              <Button variant="primary" onClick={() => nav("/app/subscription")}>
                Open Subscription
              </Button>
            </div>
          </Card>
        ) : null}

        {!loading && !unsupported && isStudioTier && !hasStudioWorkspace ? (
          <Card className="tm-panel">
            <div className="tm-panelTitle">Create your Studio workspace</div>
            <p className="tm-copy">
              Finish this once to open the shared workspace on web and mobile.
            </p>
            <div className="tm-formRow">
              <label className="tm-field tm-fieldGrow">
                <span>Studio name</span>
                <input
                  value={createStudioName}
                  onChange={(event) => setCreateStudioName(event.target.value)}
                  placeholder="Glow'd Up Studio"
                />
              </label>
              <Button variant="primary" onClick={handleCreateStudio} disabled={createBusy}>
                {createBusy ? "Creating..." : "Create Studio"}
              </Button>
            </div>
          </Card>
        ) : null}

        {!loading && !unsupported && hasStudioWorkspace ? (
          <>
            {studios.length > 1 ? (
              <Card className="tm-panel">
                <div className="tm-panelTitle">Workspace switcher</div>
                <div className="tm-chipRow">
                  {studios.map((studio) => (
                    <button
                      key={studio.id}
                      type="button"
                      className={`tm-chipBtn${activeStudioId === studio.id ? " tm-chipBtnActive" : ""}`}
                      onClick={() => setActiveStudioId(studio.id)}
                    >
                      {studio.name}
                    </button>
                  ))}
                </div>
              </Card>
            ) : null}

            <div className="tm-stats">
              <Card className="tm-statCard">
                <div className="tm-statLabel">Access</div>
                <div className="tm-statValue">{studioMemberCovered ? "Covered seat" : isStudioTier ? "Studio owner" : "Member"}</div>
              </Card>
              <Card className="tm-statCard">
                <div className="tm-statLabel">Active seats</div>
                <div className="tm-statValue">{seatSummary.activeAccounts}/{STUDIO_MAX_ACCOUNTS}</div>
              </Card>
              <Card className="tm-statCard">
                <div className="tm-statLabel">Active resources</div>
                <div className="tm-statValue">{resources.filter((resource) => resource.is_active).length}</div>
              </Card>
              <Card className="tm-statCard">
                <div className="tm-statLabel">Recent report gross</div>
                <div className="tm-statValue">{money(reportSummary.gross)}</div>
              </Card>
            </div>

            <div className="tm-grid">
              <div className="tm-mainCol">
                <Card className="tm-panel">
                  <div className="tm-panelHeader">
                    <div>
                      <div className="tm-panelTitle">Team members</div>
                      <div className="tm-panelHint">
                        Active accounts count toward Studio seats. Owners manage seats and roles.
                      </div>
                    </div>
                    <div className="tm-panelMeta">
                      Included {STUDIO_INCLUDED_ACCOUNTS} | Extra seats {seatSummary.extraAccounts} | Est. total {money(seatSummary.monthlyEstimated)}
                    </div>
                  </div>

                  {canManageStudio ? (
                    <div className="tm-formGrid">
                      <label className="tm-field tm-fieldGrow">
                        <span>Invite teammate email</span>
                        <input
                          value={inviteEmail}
                          onChange={(event) => setInviteEmail(event.target.value)}
                          placeholder="teammate@email.com"
                          type="email"
                        />
                      </label>
                      <label className="tm-field">
                        <span>Role</span>
                        <select value={inviteRole} onChange={(event) => setInviteRole(event.target.value)}>
                          {MEMBER_ROLES.filter((role) => role !== "owner").map((role) => (
                            <option key={role} value={role}>
                              {formatStudioRoleLabel(role)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <Button variant="primary" onClick={handleInviteMember} disabled={inviteBusy}>
                        {inviteBusy ? "Inviting..." : "Invite staff"}
                      </Button>
                    </div>
                  ) : null}

                  <div className="tm-subsectionTitle">Active ({activeMembers.length})</div>
                  <div className="tm-list">
                    {activeMembers.length === 0 ? (
                      <div className="tm-empty">No active teammates yet.</div>
                    ) : (
                      activeMembers.map((member) => (
                        <div key={member.id} className="tm-listRow">
                          <div className="tm-listMain">
                            <div className="tm-listTitle">
                              {studioMemberDisplayName(member.profile_id, directoryByProfileId)}
                            </div>
                            <div className="tm-listSub">
                              {formatStudioRoleLabel(member.member_role)} | {member.profile_id === user?.id ? "You" : "Seat active"}
                            </div>
                          </div>

                          <div className="tm-rowActions">
                            {canManageStudio && member.member_role !== "owner" ? (
                              <select
                                className="tm-inlineSelect"
                                value={member.member_role}
                                onChange={(event) => void handleMemberRoleChange(member, event.target.value)}
                                disabled={memberBusyId === member.id}
                              >
                                {MEMBER_ROLES.filter((role) => role !== "owner").map((role) => (
                                  <option key={role} value={role}>
                                    {formatStudioRoleLabel(role)}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <span className="tm-badge">{formatStudioRoleLabel(member.member_role)}</span>
                            )}
                            {canManageStudio ? (
                              <Button
                                variant="outline"
                                onClick={() => void handleMemberActiveToggle(member)}
                                disabled={memberBusyId === member.id}
                              >
                                {memberBusyId === member.id ? "Saving..." : "Deactivate"}
                              </Button>
                            ) : null}
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="tm-subsectionTitle">Inactive ({inactiveMembers.length})</div>
                  <div className="tm-list">
                    {inactiveMembers.length === 0 ? (
                      <div className="tm-empty">No inactive teammates.</div>
                    ) : (
                      inactiveMembers.map((member) => (
                        <div key={member.id} className="tm-listRow">
                          <div className="tm-listMain">
                            <div className="tm-listTitle">
                              {studioMemberDisplayName(member.profile_id, directoryByProfileId)}
                            </div>
                            <div className="tm-listSub">{formatStudioRoleLabel(member.member_role)} | Seat inactive</div>
                          </div>
                          {canManageStudio ? (
                            <Button
                              variant="outline"
                              onClick={() => void handleMemberActiveToggle(member)}
                              disabled={memberBusyId === member.id}
                            >
                              {memberBusyId === member.id ? "Saving..." : "Reactivate"}
                            </Button>
                          ) : null}
                        </div>
                      ))
                    )}
                  </div>
                </Card>

                <Card className="tm-panel">
                  <div className="tm-panelHeader">
                    <div>
                      <div className="tm-panelTitle">Recent appointments</div>
                      <div className="tm-panelHint">
                        Save shared team assignments and payout-report credit without leaving the workspace.
                      </div>
                    </div>
                  </div>

                  <div className="tm-list">
                    {appointments.length === 0 ? (
                      <div className="tm-empty">No recent appointments for active Studio members yet.</div>
                    ) : (
                      appointments.map((appointment) => {
                        const input = assignmentInputs[appointment.id] ?? { memberId: "", resourceId: "", payoutSplit: "100" };
                        const existingAssignment = assignmentByAppointmentId.get(appointment.id);
                        return (
                          <div key={appointment.id} className="tm-appointment">
                            <div className="tm-appointmentTop">
                              <div>
                                <div className="tm-listTitle">{appointment.client_name || "Client"}</div>
                                <div className="tm-listSub">
                                  {appointment.service || "Service"} | {formatApptDate(appointment.appointment_date, appointment.appointment_time)}
                                </div>
                              </div>
                              <div className="tm-badge">
                                {existingAssignment ? "Assigned" : "Unassigned"}
                              </div>
                            </div>

                            <div className="tm-formGrid tm-formGridCompact">
                              <label className="tm-field">
                                <span>Teammate</span>
                                <select
                                  value={input.memberId}
                                  onChange={(event) => updateAssignmentInput(appointment.id, { memberId: event.target.value })}
                                  disabled={!canAssignAppointments}
                                >
                                  <option value="">No teammate</option>
                                  {activeMembers.map((member) => (
                                    <option key={member.id} value={member.id}>
                                      {studioMemberDisplayName(member.profile_id, directoryByProfileId)}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <label className="tm-field">
                                <span>Resource</span>
                                <select
                                  value={input.resourceId}
                                  onChange={(event) => updateAssignmentInput(appointment.id, { resourceId: event.target.value })}
                                  disabled={!canAssignAppointments}
                                >
                                  <option value="">No shared resource</option>
                                  {resources
                                    .filter((resource) => resource.is_active || resource.id === input.resourceId)
                                    .map((resource) => (
                                      <option key={resource.id} value={resource.id}>
                                        {studioResourceLabel(resource)}
                                      </option>
                                    ))}
                                </select>
                              </label>
                              <label className="tm-field">
                                <span>Payout credit %</span>
                                <input
                                  value={input.payoutSplit}
                                  onChange={(event) => updateAssignmentInput(appointment.id, { payoutSplit: event.target.value })}
                                  type="number"
                                  min="0"
                                  max="100"
                                  disabled={!canAssignAppointments}
                                />
                              </label>
                              <Button
                                variant="primary"
                                onClick={() => void handleSaveAssignment(appointment)}
                                disabled={!canAssignAppointments || assignmentBusyId === appointment.id}
                              >
                                {assignmentBusyId === appointment.id ? "Saving..." : "Save assignment"}
                              </Button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </Card>
              </div>

              <div className="tm-sideCol">
                <Card className="tm-panel">
                  <div className="tm-panelHeader">
                    <div>
                      <div className="tm-panelTitle">Resources</div>
                      <div className="tm-panelHint">
                        Shared calendars, chairs, rooms, or stations tied to the Studio workspace.
                      </div>
                    </div>
                  </div>

                  {canManageStudio ? (
                    <div className="tm-formGrid">
                      <label className="tm-field tm-fieldGrow">
                        <span>Resource name</span>
                        <input
                          value={newResourceName}
                          onChange={(event) => setNewResourceName(event.target.value)}
                          placeholder="Main chair"
                        />
                      </label>
                      <label className="tm-field">
                        <span>Type</span>
                        <select value={newResourceType} onChange={(event) => setNewResourceType(event.target.value)}>
                          {RESOURCE_TYPES.map((resourceType) => (
                            <option key={resourceType} value={resourceType}>
                              {formatStudioResourceTypeLabel(resourceType)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="tm-field">
                        <span>Assign to</span>
                        <select value={newResourceMemberId} onChange={(event) => setNewResourceMemberId(event.target.value)}>
                          <option value="">No teammate</option>
                          {activeMembers.map((member) => (
                            <option key={member.id} value={member.id}>
                              {studioMemberDisplayName(member.profile_id, directoryByProfileId)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <Button variant="primary" onClick={handleCreateResource} disabled={resourceBusyId === "__new__"}>
                        {resourceBusyId === "__new__" ? "Saving..." : "Create resource"}
                      </Button>
                    </div>
                  ) : null}

                  <div className="tm-list">
                    {resources.length === 0 ? (
                      <div className="tm-empty">No Studio resources yet.</div>
                    ) : (
                      resources.map((resource) => (
                        <div key={resource.id} className="tm-listRow tm-listRowStack">
                          <div className="tm-listMain">
                            <div className="tm-listTitle">{resource.resource_name}</div>
                            <div className="tm-listSub">
                              {formatStudioResourceTypeLabel(resource.resource_type)} | {resource.is_active ? "Active" : "Inactive"}
                            </div>
                          </div>
                          <div className="tm-formGrid tm-formGridCompact">
                            <label className="tm-field tm-fieldGrow">
                              <span>Assigned teammate</span>
                              <select
                                value={resource.member_id ?? ""}
                                onChange={(event) => void handleResourceAssignment(resource, event.target.value)}
                                disabled={!canManageStudio || resourceBusyId === resource.id}
                              >
                                <option value="">No teammate</option>
                                {activeMembers.map((member) => (
                                  <option key={member.id} value={member.id}>
                                    {studioMemberDisplayName(member.profile_id, directoryByProfileId)}
                                  </option>
                                ))}
                              </select>
                            </label>
                            {canManageStudio ? (
                              <>
                                <Button
                                  variant="outline"
                                  onClick={() => void handleResourceActiveToggle(resource)}
                                  disabled={resourceBusyId === resource.id}
                                >
                                  {resourceBusyId === resource.id ? "Saving..." : resource.is_active ? "Deactivate" : "Activate"}
                                </Button>
                                <Button
                                  variant="outline"
                                  onClick={() => void handleDeleteResource(resource)}
                                  disabled={resourceBusyId === resource.id}
                                >
                                  Delete
                                </Button>
                              </>
                            ) : null}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </Card>

                <Card className="tm-panel">
                  <div className="tm-panelHeader">
                    <div>
                      <div className="tm-panelTitle">{canManageStudio ? "Rent tracking" : "Your tracked rent"}</div>
                      <div className="tm-panelHint">
                        Owners can track chair or room rent. Covered members can pay the current due cycle by card.
                      </div>
                    </div>
                  </div>

                  {canManageStudio ? (
                    <div className="tm-formGrid">
                      <label className="tm-field">
                        <span>Teammate</span>
                        <select value={newRentMemberId} onChange={(event) => setNewRentMemberId(event.target.value)}>
                          <option value="">Select teammate</option>
                          {activeMembers.map((member) => (
                            <option key={member.id} value={member.id}>
                              {studioMemberDisplayName(member.profile_id, directoryByProfileId)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="tm-field">
                        <span>Resource</span>
                        <select value={newRentResourceId} onChange={(event) => setNewRentResourceId(event.target.value)}>
                          <option value="">No linked resource</option>
                          {resources.filter((resource) => resource.is_active).map((resource) => (
                            <option key={resource.id} value={resource.id}>
                              {studioResourceLabel(resource)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="tm-field">
                        <span>Amount</span>
                        <input
                          value={newRentAmount}
                          onChange={(event) => setNewRentAmount(event.target.value)}
                          placeholder="250"
                          type="number"
                          min="0"
                          step="0.01"
                        />
                      </label>
                      <label className="tm-field">
                        <span>Cadence</span>
                        <select value={newRentCadence} onChange={(event) => setNewRentCadence(event.target.value)}>
                          {RENT_CADENCE_OPTIONS.map((cadence) => (
                            <option key={cadence} value={cadence}>
                              {cadence}
                            </option>
                          ))}
                        </select>
                      </label>
                      {newRentCadence === "weekly" ? (
                        <label className="tm-field">
                          <span>Due weekday</span>
                          <select value={newRentDueWeekday} onChange={(event) => setNewRentDueWeekday(event.target.value)}>
                            {RENT_WEEKDAY_OPTIONS.map((option) => (
                              <option key={option.value} value={String(option.value)}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </label>
                      ) : (
                        <label className="tm-field">
                          <span>Due day</span>
                          <input
                            value={newRentDueDayOfMonth}
                            onChange={(event) => setNewRentDueDayOfMonth(event.target.value)}
                            type="number"
                            min="1"
                            max="31"
                          />
                        </label>
                      )}
                      <label className="tm-field">
                        <span>Start date</span>
                        <input
                          value={newRentStartDate}
                          onChange={(event) => setNewRentStartDate(event.target.value)}
                          type="date"
                        />
                      </label>
                      <Button variant="primary" onClick={handleCreateRentSchedule} disabled={rentBusyId === "__new__"}>
                        {rentBusyId === "__new__" ? "Saving..." : "Save rent schedule"}
                      </Button>
                    </div>
                  ) : null}

                  <div className="tm-list">
                    {visibleRentSchedules.length === 0 ? (
                      <div className="tm-empty">
                        {canManageStudio ? "No rent schedules yet." : "No rent schedule is assigned to your seat yet."}
                      </div>
                    ) : (
                      visibleRentSchedules.map((schedule) => {
                        const schedulePayments = rentPayments.filter((payment) => payment.rent_schedule_id === schedule.id);
                        const summary = getStudioRentScheduleSummary(schedule, schedulePayments);
                        const member = memberById.get(schedule.member_id);
                        const resource = schedule.resource_id ? resourceById.get(schedule.resource_id) ?? null : null;
                        return (
                          <div key={schedule.id} className="tm-listRow tm-listRowStack">
                            <div className="tm-listMain">
                              <div className="tm-listTitle">
                                {studioMemberDisplayName(member?.profile_id ?? schedule.member_id, directoryByProfileId)}
                              </div>
                              <div className="tm-listSub">
                                {money(schedule.amount)} | {formatStudioRentCadenceLabel(schedule)}
                              </div>
                              <div className={`tm-rentStatus${summary.status === "overdue" ? " tm-rentStatusAlert" : ""}`}>
                                {describeStudioRentStatus(summary)}
                              </div>
                              <div className="tm-listSub">
                                {resource ? `Linked to ${studioResourceLabel(resource)}` : "Not linked to a specific resource"}
                              </div>
                              <div className="tm-listSub">
                                {summary.next_due_date ? `Next due ${formatStudioDate(summary.next_due_date)}` : "No next due date yet"}
                                {summary.latest_payment?.paid_at ? ` | Last recorded ${formatStudioDate(summary.latest_payment.paid_at.slice(0, 10))}` : ""}
                              </div>
                              {describeStudioRentPaymentMethod(summary.latest_payment) ? (
                                <div className="tm-listSub">{describeStudioRentPaymentMethod(summary.latest_payment)}</div>
                              ) : null}
                            </div>
                            <div className="tm-rowActions">
                              {canManageStudio ? (
                                <>
                                  <Button
                                    variant="outline"
                                    onClick={() => void handleRecordRentPaid(schedule)}
                                    disabled={
                                      rentBusyId === `paid:${schedule.id}` ||
                                      !schedule.is_active ||
                                      summary.status === "paid" ||
                                      summary.status === "waived" ||
                                      !summary.current_due_date
                                    }
                                  >
                                    {rentBusyId === `paid:${schedule.id}` ? "Saving..." : "Record payment"}
                                  </Button>
                                  <Button
                                    variant="outline"
                                    onClick={() => void handleToggleRentSchedule(schedule)}
                                    disabled={rentBusyId === schedule.id}
                                  >
                                    {rentBusyId === schedule.id ? "Saving..." : schedule.is_active ? "Deactivate" : "Reactivate"}
                                  </Button>
                                </>
                              ) : (
                                <Button
                                  variant="primary"
                                  onClick={() => void handlePayRent(schedule)}
                                  disabled={
                                    rentBusyId === `checkout:${schedule.id}` ||
                                    !schedule.is_active ||
                                    summary.status === "paid" ||
                                    summary.status === "waived" ||
                                    !summary.current_due_date
                                  }
                                >
                                  {rentBusyId === `checkout:${schedule.id}` ? "Redirecting..." : "Pay now"}
                                </Button>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </Card>

                <Card className="tm-panel">
                  <div className="tm-panelHeader">
                    <div>
                      <div className="tm-panelTitle">Payout reporting</div>
                      <div className="tm-panelHint">
                        Aggregated from recent studio payout report rows.
                      </div>
                    </div>
                    <div className="tm-panelMeta">
                      Gross {money(reportSummary.gross)} | Payout {money(reportSummary.payout)}
                    </div>
                  </div>

                  <div className="tm-list">
                    {reports.length === 0 ? (
                      <div className="tm-empty">No payout reports yet.</div>
                    ) : (
                      reports.map((report) => (
                        <div key={report.id} className="tm-listRow">
                          <div className="tm-listMain">
                            <div className="tm-listTitle">
                              {formatStudioDate(report.period_start)} - {formatStudioDate(report.period_end)}
                            </div>
                            <div className="tm-listSub">
                              Appointments {Number(report.appointment_count ?? 0)} | Gross {money(report.gross_amount)} | Payout {money(report.payout_amount)}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </Card>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </AppShell>
  );
}
