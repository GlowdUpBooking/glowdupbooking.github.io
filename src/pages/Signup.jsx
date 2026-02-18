import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
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

function Field({
  label,
  required,
  className = "",
  error,
  children,
  hint,
}) {
  return (
    <div className={`authField ${className}`.trim()}>
      <label className="authLabel">
        {label} {required ? "*" : ""}
      </label>
      {children}
      {hint ? <div className="authHint">{hint}</div> : null}
      {error ? <div className="authError">{error}</div> : null}
    </div>
  );
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
  const [formError, setFormError] = useState("");

  const canSubmit = useMemo(() => {
    return (
      fullName.trim().length >= 2 &&
      businessName.trim().length >= 2 &&
      category.trim().length > 0 &&
      normalizeCity(city).length >= 2 &&
      email.trim().length >= 4 &&
      password.length >= 8
    );
  }, [fullName, businessName, category, city, email, password]);

  async function onSubmit(e) {
    e.preventDefault();
    setFormError("");

    if (!canSubmit) {
      setFormError("Please fill all required fields to continue.");
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

      if (error) throw error;

      // Route them to plans to subscribe
      navigate("/pricing", { replace: true });
    } catch (err) {
      setFormError(err?.message || "Could not create account. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  // Already logged in view
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
            <div className="authHeader">
              <h1 className="authTitle">You’re already signed in</h1>
              <p className="authSub">
                Head to the app, or view plans if you need to subscribe.
              </p>
            </div>

            <div className="authActions">
              <Link to="/app" style={{ width: "100%" }}>
                <Button className="authPrimaryBtn">Go to app</Button>
              </Link>
              <Link to="/pricing" style={{ width: "100%" }}>
                <Button variant="outline" className="authPrimaryBtn">
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

          {formError ? <div className="authFormError">{formError}</div> : null}

          <form onSubmit={onSubmit} className="authForm">
            <div className="authGrid">
              <Field label="Full name" required>
                <input
                  className="authInput"
                  placeholder="Your name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  autoComplete="name"
                />
              </Field>

              <Field label="Business / brand name" required>
                <input
                  className="authInput"
                  placeholder="e.g., Kamara Cuts / Ink"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  autoComplete="organization"
                />
              </Field>

              <Field label="Category" required>
                <select
                  className="authInput authSelect"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="City" required>
                <input
                  className="authInput"
                  placeholder="Dallas, Houston, Austin"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  autoComplete="address-level2"
                />
              </Field>

              <Field label="Phone (optional)">
                <input
                  className="authInput"
                  placeholder="For booking + reminders"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  autoComplete="tel"
                  inputMode="tel"
                />
              </Field>

              <Field label="Email" required>
                <input
                  className="authInput"
                  placeholder="you@business.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  inputMode="email"
                />
              </Field>

              <Field label="Password (8+ characters)" required className="authFull">
                <input
                  className="authInput"
                  type="password"
                  placeholder="Create a password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                />
              </Field>
            </div>

            <div className="authActions">
              <Button
                className="authPrimaryBtn"
                disabled={!canSubmit || loading}
                type="submit"
              >
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
                By creating an account, you agree to Pro-first onboarding. Your booking link
                is built for your clients — not a marketplace.
              </div>
            </div>
          </form>
        </Card>
      </main>
    </div>
  );
}