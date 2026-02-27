function parseBool(value) {
  const v = String(value ?? "").trim().toLowerCase();
  if (!v) return null;
  if (v === "1" || v === "true" || v === "yes" || v === "on") return true;
  if (v === "0" || v === "false" || v === "no" || v === "off") return false;
  return null;
}

function isDevHost() {
  if (typeof window === "undefined") return true;
  const host = String(window.location.hostname || "").toLowerCase();
  return host === "localhost" || host === "127.0.0.1" || host.endsWith(".local");
}

// Global lock to keep the pro site offline.
export function isSiteLocked() {
  const override = parseBool(import.meta.env.VITE_SITE_LOCKED);
  if (override !== null) return override;
  if (isDevHost()) return false;
  return true;
}

// The pro app lives at glowdupbooking.biz — this is the only production host
// where pros should be able to sign up and sign in.
export function isProHost() {
  if (typeof window === "undefined") return false;
  const host = String(window.location.hostname || "").toLowerCase();
  return host === "glowdupbooking.biz" || host === "www.glowdupbooking.biz";
}

// Signup is blocked on any non-pro, non-dev host (e.g. glowdupbooking.com — the client site).
export function isSignupPaused() {
  if (isSiteLocked()) return true;
  const override = parseBool(import.meta.env.VITE_SIGNUPS_PAUSED);
  if (override !== null) return override;
  if (isDevHost()) return false;
  return !isProHost();
}

// Sign-in is blocked on non-pro, non-dev hosts for the same reason.
export function isSigninPaused() {
  if (isSiteLocked()) return true;
  const override = parseBool(import.meta.env.VITE_SIGNIN_PAUSED);
  if (override !== null) return override;
  if (isDevHost()) return false;
  return !isProHost();
}

export function getSignupPath() {
  return isSignupPaused() ? "/login?signup=paused" : "/signup";
}

export const SIGNUP_PAUSED_MESSAGE =
  "Pro accounts are managed at glowdupbooking.biz. Clients, visit glowdupbooking.com to book an appointment.";

export const SIGNIN_PAUSED_MESSAGE =
  "Pro sign-in is available at glowdupbooking.biz. Clients, visit glowdupbooking.com to book an appointment.";

export const SITE_LOCKED_MESSAGE =
  "The Glow’d Up Booking Pro site is temporarily offline. Please check back soon.";
