const DEFAULT_PRICES = Object.freeze({
  free_monthly:    { id: "free",            unit_amount: 0,    currency: "USD", interval: "month", interval_count: 1, product_name: "Free"    },
  starter_monthly: { id: "starter_default", unit_amount: 999,  currency: "USD", interval: "month", interval_count: 1, product_name: "Starter" },
  pro_monthly:     { id: "pro_default",     unit_amount: 1999, currency: "USD", interval: "month", interval_count: 1, product_name: "Pro"     },
  founder_annual:  { id: "founder_default", unit_amount: 9900, currency: "USD", interval: "year",  interval_count: 1, product_name: "Founder" },
});

function toCents(priceObj) {
  if (typeof priceObj?.unit_amount === "number" && Number.isFinite(priceObj.unit_amount)) return priceObj.unit_amount;
  if (typeof priceObj?.unit_amount === "string" && priceObj.unit_amount.trim().length) {
    const n = Number(priceObj.unit_amount);
    if (Number.isFinite(n)) return n;
  }
  if (typeof priceObj?.unit_amount_decimal === "string" && priceObj.unit_amount_decimal.trim().length) {
    const n = Number(priceObj.unit_amount_decimal);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function mergeLivePrices(livePrices) {
  const pick = (key) => {
    const fallback = DEFAULT_PRICES[key];
    const candidate = livePrices?.[key];
    const unitAmount = toCents(candidate);

    if (!candidate || typeof candidate !== "object" || unitAmount === null) {
      return fallback;
    }

    return {
      ...fallback,
      ...candidate,
      unit_amount: unitAmount,
      currency: typeof candidate.currency === "string" && candidate.currency ? candidate.currency : fallback.currency,
    };
  };

  return {
    free_monthly:    DEFAULT_PRICES.free_monthly,
    starter_monthly: pick("starter_monthly"),
    pro_monthly:     pick("pro_monthly"),
    founder_annual:  pick("founder_annual"),
  };
}

function formatMoneyFromStripe(priceObj, billingCycle = "monthly") {
  const cents = toCents(priceObj);
  const currency = priceObj?.currency || "USD";
  if (cents === null) return null;

  let amount = cents / 100;
  if (billingCycle === "annual" && priceObj?.interval === "month") {
    amount = amount * 12;
  }

  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
    }).format(amount);
  } catch {
    return `$${amount}`;
  }
}

function formatTerm(priceObj, billingCycle = "monthly") {
  if (!priceObj) return null;
  if (billingCycle === "annual" && priceObj?.interval === "month") return "/year";

  const i = priceObj?.interval;
  const c = priceObj?.interval_count || 1;
  if (!i) return null;
  if (i === "month") return c === 1 ? "/month" : `/${c} months`;
  if (i === "year") return c === 1 ? "/year" : `/${c} years`;
  return null;
}

export {
  DEFAULT_PRICES,
  mergeLivePrices,
  formatMoneyFromStripe,
  formatTerm,
};
