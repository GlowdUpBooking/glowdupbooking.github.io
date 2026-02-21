let analyticsInitialized = false;
const GA_EVENT_MAP = {
  page_view: "page_view",
  nav_click: "nav_click",
  cta_click: "cta_click",
  preview_tab_click: "preview_tab_click",
  plan_cta_click: "plan_cta_click",
  billing_cycle_change: "billing_cycle_change",
  checkout_start: "checkout_start",
  checkout_requires_auth: "checkout_requires_auth",
  checkout_redirect: "checkout_redirect",
  checkout_error: "checkout_error",
  signup_submit: "signup_submit",
  signup_validation_failed: "signup_validation_failed",
  signup_success: "signup_success",
  signup_error: "signup_error",
};

function toGaName(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_")
    .slice(0, 40);
}

function sanitizeAnalyticsPayload(payload = {}, { maxKeys = 20, maxLen = 100 } = {}) {
  const out = {};
  const entries = Object.entries(payload || {}).slice(0, maxKeys);
  for (const [key, val] of entries) {
    const safeKey = toGaName(key);
    if (!safeKey) continue;
    if (["string", "number", "boolean"].includes(typeof val)) {
      out[safeKey] = typeof val === "string" ? val.slice(0, maxLen) : val;
    }
  }
  return out;
}

function loadScript(src, id) {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  if (id && document.getElementById(id)) return;
  const script = document.createElement("script");
  script.async = true;
  script.src = src;
  if (id) script.id = id;
  document.head.appendChild(script);
}

function initGa4(measurementId) {
  if (!measurementId || typeof window === "undefined") return;
  loadScript(`https://www.googletagmanager.com/gtag/js?id=${measurementId}`, "gub-ga4-script");
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function gtag() {
    window.dataLayer.push(arguments);
  };
  window.gtag("js", new Date());
  window.gtag("config", measurementId, { send_page_view: false });
}

function initPosthog(apiKey, host) {
  if (!apiKey || typeof window === "undefined" || typeof document === "undefined") return;
  if (window.posthog?.__SV) return;

  (function (d, w) {
    let ph = w.posthog;
    if (ph?.__SV) return;
    if (!ph) {
      ph = [];
      w.posthog = ph;
    }
    ph._i = ph._i || [];
    ph.init = function init(token, config, name) {
      function factory(instance, method) {
        const proxy = function proxyFn(...args) {
          instance.push([method, ...args]);
        };
        proxy.toString = function toString() {
          return `posthog.${method}`;
        };
        return proxy;
      }
      const key = name || "posthog";
      const instance = w[key] = w[key] || [];
      const methods = [
        "capture",
        "identify",
        "alias",
        "people.set",
        "group",
        "reset",
        "register",
        "unregister",
      ];
      methods.forEach((method) => {
        const safe = method.replace(".", "_");
        instance[safe] = factory(instance, method);
      });
      ph._i.push([token, config, key]);
    };
    ph.__SV = 1;
    const script = d.createElement("script");
    script.async = true;
    script.src = `${host.replace(/\/$/, "")}/static/array.js`;
    script.id = "gub-posthog-script";
    const first = d.getElementsByTagName("script")[0];
    if (first?.parentNode) first.parentNode.insertBefore(script, first);
    else d.head.appendChild(script);
  })(document, window);

  window.posthog.init(apiKey, {
    api_host: host,
    autocapture: true,
    capture_pageview: false,
    capture_pageleave: true,
  });
}

function pushDataLayer(event, payload) {
  if (!window?.dataLayer || typeof window.dataLayer.push !== "function") return;
  window.dataLayer.push({ event, ...payload });
}

function sendGtag(event, payload) {
  if (typeof window?.gtag !== "function") return;
  const gaEvent = GA_EVENT_MAP[event] || toGaName(event) || "custom_event";
  const gaPayload = sanitizeAnalyticsPayload(payload);
  window.gtag("event", gaEvent, gaPayload);
}

function sendPlausible(event, payload) {
  if (typeof window?.plausible !== "function") return;
  window.plausible(event, { props: payload });
}

function sendPosthog(event, payload) {
  if (typeof window?.posthog?.capture !== "function") return;
  window.posthog.capture(event, payload);
}

export function initAnalytics() {
  if (analyticsInitialized || typeof window === "undefined") return;
  analyticsInitialized = true;

  const ga4Id = import.meta.env.VITE_GA4_ID;
  const posthogKey = import.meta.env.VITE_POSTHOG_KEY;
  const posthogHost = import.meta.env.VITE_POSTHOG_HOST || "https://us.i.posthog.com";

  if (ga4Id) initGa4(ga4Id);
  if (posthogKey) initPosthog(posthogKey, posthogHost);

  if (import.meta.env.DEV) {
    console.debug("[analytics:init]", {
      ga4: Boolean(ga4Id),
      posthog: Boolean(posthogKey),
      posthogHost,
    });
  }
}

export function trackEvent(event, payload = {}) {
  if (typeof window === "undefined") return;
  const safePayload = payload && typeof payload === "object" ? payload : {};

  pushDataLayer(event, safePayload);
  sendGtag(event, safePayload);
  sendPlausible(event, safePayload);
  sendPosthog(event, safePayload);

  if (import.meta.env.DEV) {
    console.debug("[analytics:event]", event, safePayload);
  }
}

export function trackPageView(pathname) {
  if (!pathname) return;
  trackEvent("page_view", { page_path: pathname });
}
