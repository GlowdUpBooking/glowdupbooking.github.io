// src/pages/Signup.jsx
import { useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import Input from "../components/ui/Input";
import { supabase } from "../lib/supabase";
import { trackEvent } from "../lib/analytics";
import { useAuth } from "../components/auth/AuthProvider";
import "../styles/signup.css";

const CATEGORIES = [
  "Tattoo Artist",
  "Barber",
  "Hair Stylist",
  "Nail Tech",
  "Makeup Artist",
  "Braider",
  "Esthetician",
  "Lash Tech",
  "Piercer",
  "Other",
];

function normalizeCity(s) {
  return (s || "").trim();
}

function isValidEmail(v) {
  const email = (v || "").trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidPhone(v) {
  if (!v) return true;
  const digits = String(v).replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 15;
}

function planLabel(p) {
  const v = (p || "").toLowerCase();
  if (v === "free") return "Free";
  if (v === "starter") return "Starter";
  if (v === "pro") return "Pro";
  if (v === "founder") return "Founder";
  return null;
}

export default function Signup() {
  const navigate = useNavigate();
  const location = useLocation();
  const { session: liveSession } = useAuth();

  const qs = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const pickedPlan = planLabel(qs.get("plan"));
  const next = qs.get("next"); // optional

  const [fullName, setFullName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [category, setCategory] = useState("Tattoo Artist");
  const [city, setCity] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const [errors, setErrors] = useState({
    fullName: "",
    businessName: "",
    category: "",
    city: "",
    phone: "",
    email: "",
    password: "",
    form: "",
  });

  const refs = {
    fullName: useRef(null),
    businessName: useRef(null),
    category: useRef(null),
    city: useRef(null),
    phone: useRef(null),
    email: useRef(null),
    password: useRef(null),
  };

  function validate(values) {
    const nextErrs = {
      fullName: "",
      businessName: "",
      category: "",
      city: "",
      phone: "",
      email: "",
      password: "",
      form: "",
    };

    const n = (values.fullName || "").trim();
    if (n.length < 2) nextErrs.fullName = "Please enter your full name.";

    const b = (values.businessName || "").trim();
    if (b.length < 2) nextErrs.businessName = "Please enter your business / brand name.";

    const c = (values.category || "").trim();
    if (!c) nextErrs.category = "Please choose a category.";

    const cityN = normalizeCity(values.city);
    if (cityN.length < 2) nextErrs.city = "Please enter your city.";

    if (!isValidPhone(values.phone)) {
      nextErrs.phone = "Phone number looks invalid. Use at least 10 digits.";
    }

    const e = (values.email || "").trim();
    if (!e) nextErrs.email = "Email is required.";
    else if (!isValidEmail(e)) nextErrs.email = "Enter a valid email (example: you@domain.com).";

    const p = values.password || "";
    if (!p) nextErrs.password = "Password is required.";
    else if (p.length < 8) nextErrs.password = "Password must be at least 8 characters.";

    return nextErrs;
  }

  function firstErrorField(nextErrors) {
    const order = ["fullName", "businessName", "category", "city", "phone", "email", "password"];
    return order.find((k) => nextErrors[k]) || null;
  }

  function focusField(field) {
    const r = refs[field]?.current;
    if (r && typeof r.focus === "function") r.focus();
  }

  function clearFieldError(name) {
    setErrors((prev) => ({ ...prev, [name]: "", form: "" }));
  }

  const canSubmit = useMemo(() => {
    const nextErrs = validate({ fullName, businessName, category, city, phone, email, password });
    return !Object.entries(nextErrs).some(([k, v]) => k !== "form" && Boolean(v));
  }, [fullName, businessName, category, city, phone, email, password]);

  async function onSubmit(e) {
    e.preventDefault();
    trackEvent("signup_submit", {
      page: "signup",
      selected_plan: (qs.get("plan") || "free").toLowerCase(),
    });

    const nextErrs = validate({ fullName, businessName, category, city, phone, email, password });
    setErrors(nextErrs);

    const first = firstErrorField(nextErrs);
    if (first) {
      trackEvent("signup_validation_failed", {
        page: "signup",
        field: first,
      });
      focusField(first);
      return;
    }

    try {
      setLoading(true);

      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: fullName.trim(),
            business_name: businessName.trim(),
            category: category.trim(),
            city: normalizeCity(city),
            phone: phone.trim() || null,
            selected_plan: (qs.get("plan") || "free").toLowerCase(),
          },
        },
      });

      if (error) {
        const msg = (error.message || "").toLowerCase();
        const mapped = { ...nextErrs, form: error.message || "Signup failed. Try again." };

        if (msg.includes("email") && (msg.includes("invalid") || msg.includes("format"))) {
          trackEvent("signup_error", { page: "signup", type: "email_invalid" });
          mapped.email = "That email doesn’t look valid. Example: you@domain.com";
          mapped.form = "";
          setErrors(mapped);
          focusField("email");
          return;
        }

        if (msg.includes("password") && (msg.includes("short") || msg.includes("least"))) {
          trackEvent("signup_error", { page: "signup", type: "password_invalid" });
          mapped.password = "Password must be at least 8 characters.";
          mapped.form = "";
          setErrors(mapped);
          focusField("password");
          return;
        }

        if (msg.includes("already registered") || msg.includes("already exists")) {
          trackEvent("signup_error", { page: "signup", type: "email_exists" });
          mapped.email = "This email is already in use. Try signing in instead.";
          mapped.form = "";
          setErrors(mapped);
          focusField("email");
          return;
        }

        trackEvent("signup_error", { page: "signup", type: "auth_error" });
        setErrors(mapped);
        return;
      }

      // Store plan locally (simple + reliable), onboarding can read this later if needed.
      try {
        localStorage.setItem("gub_selected_plan", (qs.get("plan") || "free").toLowerCase());
      } catch {}

      trackEvent("signup_success", {
        page: "signup",
        selected_plan: (qs.get("plan") || "free").toLowerCase(),
      });

      // If email confirmation is required, Supabase returns no session.
      if (!data?.session) {
        trackEvent("signup_pending_verification", { page: "signup" });
        navigate(`/verify-email?email=${encodeURIComponent(email.trim())}`, { replace: true });
        return;
      }

      // Session exists: continue immediately.
      navigate("/app/onboarding", { replace: true });
    } catch (err) {
      trackEvent("signup_error", { page: "signup", type: "exception", message: err?.message || "unknown_error" });
      setErrors((prev) => ({
        ...prev,
        form: err?.message || "Could not create account. Please try again.",
      }));
    } finally {
      setLoading(false);
    }
  }

  // Already logged in
  if (liveSession) {
    return (
      <div className="authPage">
        <header className="authTopNav">
          <div className="authTopNavInner">
            <Link className="authBrand" to="/">
              <img className="authBrandLogo" src="/assets/logo.png" alt="Glow'd Up Booking logo" />
              <span className="authBrandStrong">Glow’d Up</span>
              <span className="authBrandLight"> Booking</span>
            </Link>
            <div className="authTopNavRight">
              <Link className="authNavLink" to="/pricing">
                Plans
              </Link>
              <Link className="authNavBtn" to="/app">
                Go to app <span className="authArrow">→</span>
              </Link>
            </div>
          </div>
        </header>

        <div className="authShell">
          <Card className="authCard">
            <h1 className="authTitle">You’re already signed in</h1>
            <p className="authSub">Head to onboarding or the app.</p>

            <div className="authActions">
              <Link to="/app/onboarding" style={{ width: "100%" }}>
                <Button className="authPrimaryBtn">Continue onboarding</Button>
              </Link>
              <Link to="/app" style={{ width: "100%" }}>
                <Button variant="outline" className="authSecondaryBtn">
                  Go to app
                </Button>
              </Link>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="authPage">
      <header className="authTopNav">
        <div className="authTopNavInner">
          <Link className="authBrand" to="/">
            <img className="authBrandLogo" src="/assets/logo.png" alt="Glow'd Up Booking logo" />
            <span className="authBrandStrong">Glow’d Up</span>
            <span className="authBrandLight"> Booking</span>
          </Link>

          <div className="authTopNavRight">
            <Link className="authNavLink" to="/pricing" onClick={() => trackEvent("nav_click", { page: "signup", cta: "pricing" })}>
              Pricing
            </Link>
            <Link className="authNavBtn authNavBtnGhost" to="/login" onClick={() => trackEvent("nav_click", { page: "signup", cta: "sign_in" })}>
              Sign In
            </Link>
            <Link className="authNavBtn" to="/pricing#plans" onClick={() => trackEvent("cta_click", { page: "signup", cta: "view_plans" })}>
              View Plans <span className="authArrow">→</span>
            </Link>
          </div>
        </div>
      </header>

      <main className="authShell">
        <section className="authPitch">
          <div className="authKicker">FOR BEAUTY PROS</div>
          <h2>Create your Pro account</h2>
          <p>
            Start free. Set up your profile, then share your booking link. Designed for barbers,
            stylists, tattoo artists, nail techs, and more.
          </p>
          <div className="authTrustRow">
            <span>Stripe-secured payments</span>
            <span>Upgrade anytime</span>
          </div>
        </section>

        <Card className="authCard">
          <div className="authHeader">
            <h1 className="authTitle">Create your Pro account</h1>
            <p className="authSub">Start free. Set up your profile, then share your booking link.</p>
            {pickedPlan ? (
              <div className="authPlanPill">
                Selected plan: <strong>{pickedPlan}</strong>
                {next ? <span className="authPlanHint"> (you’ll continue after onboarding)</span> : null}
              </div>
            ) : null}
          </div>

          {errors.form ? <div className="authFormError">{errors.form}</div> : null}

          <form onSubmit={onSubmit} className="authForm">
            <div className="authGrid">
              <Input
                inputRef={refs.fullName}
                label="Full name *"
                placeholder="Your name"
                value={fullName}
                onChange={(e) => {
                  setFullName(e.target.value);
                  clearFieldError("fullName");
                }}
                autoComplete="name"
                error={errors.fullName}
              />

              <Input
                inputRef={refs.businessName}
                label="Business / brand name *"
                placeholder="e.g., Kamara Cuts / Ink"
                value={businessName}
                onChange={(e) => {
                  setBusinessName(e.target.value);
                  clearFieldError("businessName");
                }}
                autoComplete="organization"
                error={errors.businessName}
              />

              <div className="uiField">
                <label className="uiLabel">
                  Category <span className="uiReq">*</span>
                </label>
                <div className={`uiControl ${errors.category ? "uiControlError" : ""}`}>
                  <select
                    ref={refs.category}
                    className="uiInput"
                    value={category}
                    onChange={(e) => {
                      setCategory(e.target.value);
                      clearFieldError("category");
                    }}
                    style={{ appearance: "none" }}
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                {errors.category ? <div className="uiError">{errors.category}</div> : null}
              </div>

              <Input
                inputRef={refs.city}
                label="City *"
                placeholder="Dallas, Houston, Austin"
                value={city}
                onChange={(e) => {
                  setCity(e.target.value);
                  clearFieldError("city");
                }}
                autoComplete="address-level2"
                error={errors.city}
              />

              <Input
                inputRef={refs.phone}
                label="Phone (optional)"
                placeholder="For booking + reminders"
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  clearFieldError("phone");
                }}
                autoComplete="tel"
                inputMode="tel"
                error={errors.phone}
              />

              <Input
                inputRef={refs.email}
                label="Email *"
                placeholder="you@business.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  clearFieldError("email");
                }}
                autoComplete="email"
                inputMode="email"
                error={errors.email}
              />

              <div className="authFull">
                <Input
                  inputRef={refs.password}
                  label="Password (8+ characters) *"
                  type="password"
                  placeholder="Create a password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    clearFieldError("password");
                  }}
                  autoComplete="new-password"
                  error={errors.password}
                />
              </div>
            </div>

            <div className="authActions">
              <Button className="authPrimaryBtn" disabled={!canSubmit || loading} type="submit">
                {loading ? "Creating..." : "Create account"}
              </Button>
            </div>

            <div className="authFooter">
              <div className="authFooterLinks">
                <span>Already have an account?</span>
                <Link to="/login">Sign in</Link>
                <span className="authDot">·</span>
                <Link to="/pricing">View plans</Link>
              </div>

              <div className="authFinePrint">
                By creating an account, you agree to Pro-first onboarding. Your booking link is
                built for your clients — not a marketplace.
              </div>
            </div>
          </form>
        </Card>
      </main>
    </div>
  );
}
