import { supabase } from "./supabase";

const DEFAULT_PLATFORM_ADMIN_EMAILS = ["glowdupbooking@gmail.com"];

function normalizeEmail(value) {
  return String(value ?? "").trim().toLowerCase();
}

function parseEmailList(raw) {
  return String(raw ?? "")
    .split(",")
    .map((value) => normalizeEmail(value))
    .filter(Boolean);
}

const configuredPlatformAdminEmails = parseEmailList(import.meta.env.VITE_PLATFORM_ADMIN_EMAILS);
const allowedPlatformAdminEmails = Array.from(
  new Set([...DEFAULT_PLATFORM_ADMIN_EMAILS, ...configuredPlatformAdminEmails])
);

export function isPlatformAdminEmail(email) {
  const normalized = normalizeEmail(email);
  return normalized.length > 0 && allowedPlatformAdminEmails.includes(normalized);
}

export function isPlatformAdminUser(user) {
  return isPlatformAdminEmail(user?.email);
}

async function formatInvokeError(error) {
  if (!error) return "Unknown edge function error.";
  try {
    if (error.context && typeof error.context.text === "function") {
      const raw = await error.context.text();
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          const message = [
            parsed?.error || "Edge Function error",
            parsed?.details ? `(${parsed.details})` : "",
            parsed?.reason ? `[${parsed.reason}]` : "",
          ]
            .filter(Boolean)
            .join(" ");
          return message || raw;
        } catch {
          return raw;
        }
      }
    }
  } catch {
    // Fall through to the generic message.
  }

  return error.message || "Edge Function request failed.";
}

export async function fetchPlatformAdminDashboard() {
  const { data, error } = await supabase.functions.invoke("platform-admin-dashboard", {
    body: {},
  });

  if (error) {
    throw new Error(await formatInvokeError(error));
  }

  return data ?? null;
}
