import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import Input from "../components/ui/Input";
import { supabase } from "../lib/supabase";

export default function Signup({ session }) {
  const nav = useNavigate();

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const [fullName, setFullName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [category, setCategory] = useState("Tattoo Artist");
  const [city, setCity] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const categories = useMemo(
    () => [
      "Tattoo Artist",
      "Barber",
      "Hair Stylist",
      "Nail Tech",
      "Lash Tech",
      "Makeup Artist",
      "Braider",
      "Esthetician",
      "Other",
    ],
    []
  );

  // If already signed in, you can send them to /app (Paywall will gate)
  if (session) {
    // don’t hard redirect in render loops; just show a small message
    return (
      <div className="lp authPage">
        <header className="lpNav">
          <div className="lpNavInner">
            <Link className="lpBrand" to="/">
              <span className="lpBrandStrong">Glow’d Up</span>
              <span className="lpBrandLight"> Booking</span>
            </Link>
            <div className="lpNavRight">
              <Link className="lpNavLink" to="/pricing">
                Plans
              </Link>
              <Link className="lpNavBtn" to="/app">
                Go to app <span className="lpArrow">→</span>
              </Link>
            </div>
          </div>
        </header>

        <main className="authWrap">
          <Card className="authCard">
            <h1 className="authTitle">You’re already signed in</h1>
            <p className="authSub">
              Continue to the app. If you don’t have an active plan, you’ll be
              prompted to choose one.
            </p>
            <div className="authActions">
              <Link to="/app" style={{ width: "100%" }}>
                <Button variant="outline" className="authPrimaryBtn">
                  Continue
                </Button>
              </Link>
            </div>
          </Card>
        </main>
      </div>
    );
  }

  async function onSubmit(e) {
    e.preventDefault();
    setErr("");
    setLoading(true);

    try {
      // Create account
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });
      if (error) throw error;

      // Create/seed profile (optional but recommended)
      const userId = data?.user?.id;
      if (userId) {
        await supabase.from("profiles").upsert(
          {
            id: userId,
            full_name: fullName,
            business_name: businessName,
            business_type: category,
            city,
            phone: phone || null,
            onboarding_step: "basics",
          },
          { onConflict: "id" }
        );
      }

      // Send them to pricing/plans to pay (Paywall logic will enforce)
      nav("/pricing");
    } catch (e) {
      setErr(e?.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="lp authPage">
      {/* Top Nav - same as landing */}
      <header className="lpNav">
        <div className="lpNavInner">
          <Link className="lpBrand" to="/">
            <span className="lpBrandStrong">Glow’d Up</span>
            <span className="lpBrandLight"> Booking</span>
          </Link>

          <div className="lpNavRight">
            <Link className="lpNavLink" to="/pricing">
              Plans
            </Link>
            <Link className="lpNavBtn" to="/login">
              Sign In <span className="lpArrow">→</span>
            </Link>
          </div>
        </div>
      </header>

      <main className="authWrap">
        <Card className="authCard">
          <div className="authHead">
            <h1 className="authTitle">Create your Pro account</h1>
            <p className="authSub">
              Pro-first access. Set up your profile, then you’ll get your booking
              link.
            </p>
          </div>

          {err ? <div className="authAlert">{err}</div> : null}

          <form onSubmit={onSubmit} className="authForm">
            <div className="authGrid">
              <Input
                label="Full name"
                required
                name="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Your name"
                autoComplete="name"
              />

              <Input
                label="Business / brand name"
                required
                name="businessName"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="e.g., Kamara Cuts / Ink"
              />

              <Input
                label="Category"
                required
                name="category"
                as="select"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Input>

              <Input
                label="City"
                required
                name="city"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Dallas, Houston, Austin"
                autoComplete="address-level2"
              />

              <Input
                label="Phone (optional)"
                name="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="For booking + reminders"
                autoComplete="tel"
              />

              <Input
                label="Email"
                required
                name="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@business.com"
                autoComplete="email"
              />
            </div>

            <Input
              label="Password (8+ characters)"
              required
              name="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="new-password"
            />

            <div className="authActions">
              <Button
                variant="outline"
                className="authPrimaryBtn"
                type="submit"
                disabled={loading}
              >
                {loading ? "Creating…" : "Create account"}
              </Button>

              <div className="authMeta">
                <span>Already have an account?</span>{" "}
                <Link to="/login" className="authLink">
                  Sign in
                </Link>
                <span className="authDot">·</span>
                <Link to="/pricing" className="authLink">
                  View plans
                </Link>
              </div>

              <div className="authFine">
                By creating an account, you agree to Pro-first onboarding. Your
                booking link is built for your clients — not a marketplace.
              </div>
            </div>
          </form>
        </Card>
      </main>
    </div>
  );
}