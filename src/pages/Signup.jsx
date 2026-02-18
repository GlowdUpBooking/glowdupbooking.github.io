// src/pages/Signup.jsx
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";

const CATEGORIES = [
  "Tattoo Artist",
  "Barber",
  "Hair Stylist",
  "Nail Tech",
  "Makeup Artist",
  "Lash Tech",
  "Brow Tech",
  "Esthetician",
  "Massage Therapist",
  "Other",
];

export default function Signup({ session }) {
  const nav = useNavigate();

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const [form, setForm] = useState({
    full_name: "",
    business_name: "",
    business_type: "Tattoo Artist",
    city: "",
    phone: "",
    email: "",
    password: "",
  });

  const canSubmit = useMemo(() => {
    return (
      form.full_name.trim().length > 1 &&
      form.business_name.trim().length > 1 &&
      form.business_type.trim().length > 0 &&
      form.city.trim().length > 1 &&
      form.email.trim().length > 3 &&
      form.password.length >= 8 &&
      !loading
    );
  }, [form, loading]);

  async function onSubmit(e) {
    e.preventDefault();
    setErr("");
    setLoading(true);

    try {
      // 1) Create auth user
      const { data, error } = await supabase.auth.signUp({
        email: form.email.trim(),
        password: form.password,
        options: {
          data: {
            full_name: form.full_name.trim(),
          },
        },
      });

      if (error) throw error;

      const userId = data?.user?.id;
      if (!userId) {
        // Email confirmations can cause user to be null, but still no reason to break layout.
        // You can customize this later.
        throw new Error("Account created. Please check your email to confirm your account.");
      }

      // 2) Upsert profile details (match your existing `profiles` columns)
      const { error: pErr } = await supabase.from("profiles").upsert(
        {
          id: userId,
          full_name: form.full_name.trim(),
          business_name: form.business_name.trim(),
          business_type: form.business_type.trim(),
          city: form.city.trim(),
          phone: form.phone.trim() || null,
          role: "pro",
          onboarding_step: "start",
        },
        { onConflict: "id" }
      );

      if (pErr) throw pErr;

      // 3) Send them to pricing (or paywall flow)
      nav("/pricing", { replace: true });
    } catch (e) {
      setErr(e?.message ?? "Signup failed");
    } finally {
      setLoading(false);
    }
  }

  // If already logged in, send them forward (you can adjust destination later)
  if (session) {
    // If they’re logged in but not subscribed, your gate will handle it.
    // Keep it simple:
    nav("/app", { replace: true });
    return null;
  }

  return (
    <div className="authPage">
      <div className="authShell">
        <div className="authHeader">
          <Link className="authBrand" to="/">
            <span className="authBrandStrong">Glow’d Up</span>
            <span className="authBrandLight"> Booking</span>
          </Link>

          <div className="authHeaderRight">
            <Link className="authLink" to="/pricing">
              Pricing
            </Link>
            <Link className="authLinkBtn" to="/login">
              Sign In <span className="lpArrow">→</span>
            </Link>
          </div>
        </div>

        <Card className="authCard">
          <h1 className="authTitle">Create your Pro account</h1>
          <p className="authSub">
            Pro-first access. Set up your profile, then you’ll get your booking link.
          </p>

          {err ? <div className="authError">{err}</div> : null}

          <form onSubmit={onSubmit} className="authForm">
            <div className="formGrid">
              <Field label="Full name" required>
                <input
                  className="authInput"
                  placeholder="Your name"
                  value={form.full_name}
                  onChange={(e) => setForm((s) => ({ ...s, full_name: e.target.value }))}
                  autoComplete="name"
                />
              </Field>

              <Field label="Business / brand name" required>
                <input
                  className="authInput"
                  placeholder="e.g., Kamara Cuts / Ink"
                  value={form.business_name}
                  onChange={(e) => setForm((s) => ({ ...s, business_name: e.target.value }))}
                />
              </Field>

              <Field label="Category" required>
                <select
                  className="authInput"
                  value={form.business_type}
                  onChange={(e) => setForm((s) => ({ ...s, business_type: e.target.value }))}
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
                  value={form.city}
                  onChange={(e) => setForm((s) => ({ ...s, city: e.target.value }))}
                />
              </Field>

              <Field label="Phone (optional)">
                <input
                  className="authInput"
                  placeholder="For booking + reminders"
                  value={form.phone}
                  onChange={(e) => setForm((s) => ({ ...s, phone: e.target.value }))}
                  autoComplete="tel"
                />
              </Field>

              <Field label="Email" required>
                <input
                  className="authInput"
                  placeholder="you@business.com"
                  value={form.email}
                  onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))}
                  autoComplete="email"
                />
              </Field>

              <Field label="Password (8+ characters)" required className="span2">
                <input
                  className="authInput"
                  type="password"
                  placeholder="••••••••"
                  value={form.password}
                  onChange={(e) => setForm((s) => ({ ...s, password: e.target.value }))}
                  autoComplete="new-password"
                />
              </Field>
            </div>

            <div className="authActions">
              <Button
                className="authPrimaryBtn"
                variant="outline"
                type="submit"
                disabled={!canSubmit}
              >
                {loading ? "Creating…" : "Create account"}
              </Button>

              <div className="authMeta">
                Already have an account? <Link to="/login">Sign in</Link>
                <span className="authDot">·</span>
                <Link to="/pricing">View pricing</Link>
              </div>

              <div className="authFinePrint">
                By creating an account, you agree to Pro-first onboarding. Your booking link is
                built for your clients — not a marketplace.
              </div>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}

function Field({ label, required, className = "", children }) {
  return (
    <div className={`formField ${className}`}>
      <label className="formLabel">
        {label} {required ? <span className="req">*</span> : null}
      </label>
      {children}
    </div>
  );
}