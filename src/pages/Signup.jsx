import { useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import Input from "../components/ui/Input";
import { supabase } from "../lib/supabase";

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
  // Simple, reliable client-side check (Supabase will still validate server-side)
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidPhone(v) {
  if (!v) return true; // optional
  const digits = String(v).replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 15;
}

export default function Signup({ session }) {
  const navigate = useNavigate();

  const [fullName, setFullName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [category, setCategory] = useState("Tattoo Artist");
  const [city, setCity] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);

  // Field-level errors (keyed by field name)
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

  // Refs so we can focus the first invalid input
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
    const next = {
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
    if (n.length < 2) next.fullName = "Please enter your full name.";

    const b = (values.businessName || "").trim();
    if (b.length < 2) next.businessName = "Please enter your business / brand name.";

    const c = (values.category || "").trim();
    if (!c) next.category = "Please choose a category.";

    const cityN = normalizeCity(values.city);
    if (cityN.length < 2) next.city = "Please enter your city.";

    if (!isValidPhone(values.phone)) {
      next.phone = "Phone number looks invalid. Use at least 10 digits.";
    }

    const e = (values.email || "").trim();
    if (!e) next.email = "Email is required.";
    else if (!isValidEmail(e)) next.email = "Enter a valid email (example: you@domain.com).";

    const p = values.password || "";
    if (!p) next.password = "Password is required.";
    else if (p.length < 8) next.password = "Password must be at least 8 characters.";

    return next;
  }

  function firstErrorField(nextErrors) {
    const order = ["fullName", "businessName", "category", "city", "phone", "email", "password"];
    return order.find((k) => nextErrors[k]) || null;
  }

  function focusField(field) {
    const r = refs[field]?.current;
    if (r && typeof r.focus === "function") r.focus();
  }

  // validate live (optional) — here we only clear a field error when user edits it
  function clearFieldError(name) {
    setErrors((prev) => ({ ...prev, [name]: "", form: "" }));
  }

  const canSubmit = useMemo(() => {
    const next = validate({ fullName, businessName, category, city, phone, email, password });
    return !Object.entries(next).some(([k, v]) => k !== "form" && Boolean(v));
  }, [fullName, businessName, category, city, phone, email, password]);

  async function onSubmit(e) {
    e.preventDefault();

    const next = validate({ fullName, businessName, category, city, phone, email, password });
    setErrors(next);

    const first = firstErrorField(next);
    if (first) {
      focusField(first);
      return;
    }

    try {
      setLoading(true);

      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: fullName.trim(),
            business_name: businessName.trim(),
            category: category.trim(),
            city: normalizeCity(city),
            phone: phone.trim() || null,
          },
        },
      });

      if (error) {
        // Map common Supabase errors -> field errors
        const msg = (error.message || "").toLowerCase();

        // default form-level message
        const mapped = { ...next, form: error.message || "Signup failed. Try again." };

        if (msg.includes("email") && (msg.includes("invalid") || msg.includes("format"))) {
          mapped.email = "That email doesn’t look valid. Example: you@domain.com";
          mapped.form = "";
          setErrors(mapped);
          focusField("email");
          return;
        }

        if (msg.includes("password") && (msg.includes("short") || msg.includes("least"))) {
          mapped.password = "Password must be at least 8 characters.";
          mapped.form = "";
          setErrors(mapped);
          focusField("password");
          return;
        }

        if (msg.includes("already registered") || msg.includes("already exists")) {
          mapped.email = "This email is already in use. Try signing in instead.";
          mapped.form = "";
          setErrors(mapped);
          focusField("email");
          return;
        }

        setErrors(mapped);
        return;
      }

      // Route to plans after signup
      navigate("/pricing", { replace: true });
    } catch (err) {
      setErrors((prev) => ({
        ...prev,
        form: err?.message || "Could not create account. Please try again.",
      }));
    } finally {
      setLoading(false);
    }
  }

  // Already logged in
  if (session) {
    return (
      <div className="authPage">
        <div className="authTopNav">
          <div className="authTopNavInner">
            <Link className="authBrand" to="/">
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
        </div>

        <div className="authShell">
          <Card className="authCard">
            <h1 className="authTitle">You’re already signed in</h1>
            <p className="authSub">Head to the app, or view plans if you need to subscribe.</p>

            <div className="authActions">
              <Link to="/app" style={{ width: "100%" }}>
                <Button className="authPrimaryBtn">Go to app</Button>
              </Link>
              <Link to="/pricing" style={{ width: "100%" }}>
                <Button variant="outline" className="authSecondaryBtn">
                  View plans
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
            <span className="authBrandStrong">Glow’d Up</span>
            <span className="authBrandLight"> Booking</span>
          </Link>

          <div className="authTopNavRight">
            <Link className="authNavLink" to="/pricing">
              Plans
            </Link>
            <Link className="authNavBtn" to="/login">
              Sign In <span className="authArrow">→</span>
            </Link>
          </div>
        </div>
      </header>

      <main className="authShell">
        <Card className="authCard">
          <div className="authHeader">
            <h1 className="authTitle">Create your Pro account</h1>
            <p className="authSub">
              Pro-first access. Set up your profile, then you’ll get your booking link.
            </p>
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