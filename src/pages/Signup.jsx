import { useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient"; // adjust path if yours differs
import { Link, useNavigate } from "react-router-dom";

const CATEGORIES = [
  "Tattoo Artist",
  "Barber",
  "Hair Stylist",
  "Nail Tech",
  "Makeup Artist",
  "Esthetician",
  "Lash Tech",
  "Braider",
  "Other",
];

export default function Signup() {
  const nav = useNavigate();

  const [form, setForm] = useState({
    fullName: "",
    businessName: "",
    category: "Tattoo Artist",
    city: "",
    phone: "",
    email: "",
    password: "",
  });

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [ok, setOk] = useState(false);

  const canSubmit = useMemo(() => {
    const emailOk = /^\S+@\S+\.\S+$/.test(form.email.trim());
    return (
      form.fullName.trim().length >= 2 &&
      form.businessName.trim().length >= 2 &&
      form.city.trim().length >= 2 &&
      emailOk &&
      form.password.length >= 8
    );
  }, [form]);

  function setField(key, val) {
    setForm((p) => ({ ...p, [key]: val }));
    setMsg("");
  }

  async function onSubmit(e) {
    e.preventDefault();
    if (!canSubmit || busy) return;

    setBusy(true);
    setMsg("");
    setOk(false);

    try {
      // 1) Create auth user
      const { data, error } = await supabase.auth.signUp({
        email: form.email.trim(),
        password: form.password,
        options: {
          data: {
            full_name: form.fullName.trim(),
            business_name: form.businessName.trim(),
            category: form.category,
            city: form.city.trim(),
            phone: form.phone.trim(),
          },
        },
      });

      if (error) throw error;

      // 2) OPTIONAL: If you have a profiles table, upsert a row.
      // If you don't have this table yet, leave it — it won't break your signup flow
      // as long as you keep it inside try/catch.
      if (data?.user?.id) {
        const { error: pErr } = await supabase
          .from("profiles")
          .upsert(
            {
              id: data.user.id,
              full_name: form.fullName.trim(),
              business_name: form.businessName.trim(),
              category: form.category,
              city: form.city.trim(),
              phone: form.phone.trim() || null,
              created_at: new Date().toISOString(),
            },
            { onConflict: "id" }
          );

        // ignore profiles errors if table isn't set up yet
        if (pErr) console.warn("profiles upsert skipped:", pErr.message);
      }

      setOk(true);
      setMsg("Account created. Check your email to confirm, then sign in.");
      // If you don't require email confirmation, you can redirect immediately:
      // nav("/app");
    } catch (err) {
      setMsg(err?.message || "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="authPage">
      <div className="authCard">
        <img className="authLogo" src="/assets/logo-1.png" alt="Glow’d Up Booking" />

        <h1>Create your Pro account</h1>
        <p className="muted">
          Pro-first access. Set up your profile, then you’ll get your booking link.
        </p>

        {msg ? <div className="authMsg">{msg}</div> : null}

        <form className="authForm" onSubmit={onSubmit}>
          <label>
            Full name
            <input
              value={form.fullName}
              onChange={(e) => setField("fullName", e.target.value)}
              placeholder="Your name"
              autoComplete="name"
            />
          </label>

          <label>
            Business / brand name
            <input
              value={form.businessName}
              onChange={(e) => setField("businessName", e.target.value)}
              placeholder="e.g., Kamara Cuts / Ink by ____"
              autoComplete="organization"
            />
          </label>

          <label>
            Category
            <select
              value={form.category}
              onChange={(e) => setField("category", e.target.value)}
              style={{
                padding: "12px 12px",
                borderRadius: "14px",
                border: "1px solid rgba(255,255,255,.10)",
                background: "rgba(0,0,0,.25)",
                color: "var(--text)",
                outline: "none",
              }}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>

          <label>
            City
            <input
              value={form.city}
              onChange={(e) => setField("city", e.target.value)}
              placeholder="Dallas, Houston, Austin..."
              autoComplete="address-level2"
            />
          </label>

          <label>
            Phone (optional)
            <input
              value={form.phone}
              onChange={(e) => setField("phone", e.target.value)}
              placeholder="For booking + reminder alerts"
              autoComplete="tel"
            />
          </label>

          <label>
            Email
            <input
              value={form.email}
              onChange={(e) => setField("email", e.target.value)}
              placeholder="you@business.com"
              autoComplete="email"
            />
          </label>

          <label>
            Password (8+ characters)
            <input
              type="password"
              value={form.password}
              onChange={(e) => setField("password", e.target.value)}
              placeholder="••••••••"
              autoComplete="new-password"
            />
          </label>

          <button className="btn gold full" disabled={!canSubmit || busy} type="submit">
            {busy ? "Creating…" : "Create account"}
          </button>

          <div className="authLinks">
            <Link to="/login">Already have an account?</Link>
            <Link to="/pricing">View pricing</Link>
          </div>

          {!ok ? (
            <p className="muted" style={{ marginTop: 8, fontSize: 12 }}>
              By creating an account, you agree to Pro-first onboarding. Your booking link is built
              for your clients — not a marketplace.
            </p>
          ) : null}
        </form>
      </div>
    </div>
  );
}