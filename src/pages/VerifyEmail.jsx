import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { getSignupPath } from "../lib/siteFlags";
import "../styles/signup.css";

export default function VerifyEmail() {
  const [params] = useSearchParams();
  const signupPath = getSignupPath();
  const initialEmail = (params.get("email") || "").trim();
  const [email] = useState(initialEmail);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const canResend = useMemo(() => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email), [email]);

  async function onResend() {
    if (!canResend) return;
    setBusy(true);
    setErr("");
    setMsg("");
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: email.trim(),
    });
    setBusy(false);
    if (error) {
      setErr(error.message || "Couldn’t resend verification email.");
      return;
    }
    setMsg("Verification email sent. Check inbox and spam/promotions folders.");
  }

  return (
    <div className="authPage">
      <header className="authTopNav">
        <div className="authTopNavInner">
          <Link className="authBrand" to="/">
            <img className="authBrandLogo" src="/assets/logo.png" alt="Glow&apos;d Up Booking logo" />
            <span className="authBrandStrong">Glow’d Up</span>
            <span className="authBrandLight"> Booking</span>
          </Link>
        </div>
      </header>

      <main className="authShell" style={{ gridTemplateColumns: "minmax(320px, 700px)" }}>
        <section className="authCard">
          <div className="authHeader">
            <h1 className="authTitle">Verify your email</h1>
            <p className="authSub">
              We created your account. Check your email and click the verification link to continue to onboarding.
            </p>
          </div>

          <div className="authForm">
            <div className="authFull uiField">
              <label className="uiLabel">Email</label>
              <div className="uiControl">
                <input
                  className="uiInput"
                  value={email}
                  readOnly
                  type="email"
                  autoComplete="email"
                  placeholder="you@business.com"
                  style={{ opacity: 0.75, cursor: "default" }}
                />
              </div>
              <div style={{ fontSize: 12, opacity: 0.6, marginTop: 5 }}>
                This is the email you signed up with. Wrong email?{" "}
                <Link to={signupPath} style={{ color: "inherit", textDecoration: "underline" }}>Start over</Link>.
              </div>
            </div>

            {msg ? <div className="authPlanPill">{msg}</div> : null}
            {err ? <div className="authFormError">{err}</div> : null}

            <div className="authActions">
              <button className="authPrimaryBtn" type="button" disabled={busy || !canResend} onClick={onResend}>
                {busy ? "Sending..." : "Resend verification email"}
              </button>
            </div>
          </div>

          <div className="authFooter">
            <div className="authFooterLinks">
              <Link to="/login">Back to sign in</Link>
              <span className="authDot">·</span>
              <Link to={signupPath}>Use a different email</Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
