function parseBool(value) {
  const v = String(value ?? "").trim().toLowerCase();
  if (!v) return null;
  if (v === "1" || v === "true" || v === "yes" || v === "on") return true;
  if (v === "0" || v === "false" || v === "no" || v === "off") return false;
  return null;
}

export function isLiveMarketingHost() {
  if (typeof window === "undefined") return false;
  const host = String(window.location.hostname || "").toLowerCase();
  return host === "glowdupbooking.biz" || host === "www.glowdupbooking.biz";
}

export function isSignupPaused() {
  const override = parseBool(import.meta.env.VITE_SIGNUPS_PAUSED);
  if (override !== null) return override;
  return isLiveMarketingHost();
}

export function isSigninPaused() {
  const override = parseBool(import.meta.env.VITE_SIGNIN_PAUSED);
  if (override !== null) return override;
  return isLiveMarketingHost();
}

export function getSignupPath() {
  return isSignupPaused() ? "/login?signup=paused" : "/signup";
}

export const SIGNUP_PAUSED_MESSAGE =
  "New signups are temporarily paused while we finish setup. Please check back soon.";

export const SIGNIN_PAUSED_MESSAGE =
  "Sign-in is temporarily paused while we finish setup. Please check back soon.";
