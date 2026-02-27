import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../components/auth/useAuth";
import {
  SIGNIN_PAUSED_MESSAGE,
  SIGNUP_PAUSED_MESSAGE,
  isSigninPaused,
  isSignupPaused,
} from "../lib/siteFlags";
import "../styles/signup.css";

export default function Login() {
  const nav = useNavigate();
  const location = useLocation();
  const { session } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const signinPaused = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return isSigninPaused() || params.get("signin") === "paused";
  }, [location.search]);
  const signupPaused = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return isSignupPaused() || params.get("signup") === "paused";
  }, [location.search]);
  const nextPath = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get("next") || "/app";
  }, [location.search]);

  useEffect(() => {
    if (session?.access_token) nav(nextPath, { replace: true });
  }, [session?.access_token, nav, nextPath]);

  async function onSubmit(e) {
    e.preventDefault();
    setMsg("");

    if (signinPaused) {
      setMsg(SIGNIN_PAUSED_MESSAGE);
      return;
    }

    setBusy(true);

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    setBusy(false);

    if (error) {
      const lower = String(error.message || "").toLowerCase();
      if (lower.includes("email not confirmed") || lower.includes("not confirmed")) {
        setMsg("Email not verified yet. Redirecting to verification help…");
        const target = `/verify-email?email=${encodeURIComponent(email.trim())}`;
        window.setTimeout(() => nav(target), 450);
        return;
      }
      setMsg(error.message);
      return;
    }

    nav(nextPath, { replace: true });
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

          <div className="authTopNavRight">
            <Link className="authNavLink" to="/pricing#plans">
              Pricing
            </Link>
            {!signupPaused ? (
              <>
                <Link className="authNavBtn authNavBtnGhost" to="/signup">
                  Create Account
                </Link>
                <Link className="authNavBtn" to="/signup">
                  Start Free <span className="authArrow">→</span>
                </Link>
              </>
            ) : (
              <span className="authNavTag">Auth paused</span>
            )}
          </div>
        </div>
      </header>

      <main className="authShell">
        <section className="authPitch">
          <div className="authKicker">WELCOME BACK</div>
          <h2>Sign in to your dashboard</h2>
          <p>
            Manage your services, bookings, and growth tools in one place.
            Pick up where you left off.
          </p>
          <div className="authTrustRow">
            <span>Fast pro workflow</span>
            <span>Secure account access</span>
            <span>Built for independent pros</span>
          </div>
        </section>

        <section className="authCard">
          <div className="authHeader">
            <h1 className="authTitle">Sign in</h1>
            <p className="authSub">Access your account and continue managing bookings.</p>
          </div>

          {signinPaused ? <div className="authFormInfo">{SIGNIN_PAUSED_MESSAGE}</div> : null}
          {signupPaused ? <div className="authFormInfo">{SIGNUP_PAUSED_MESSAGE}</div> : null}
          <form onSubmit={onSubmit} className="authForm">
            <div className="authGrid">
              <div className="authFull uiField">
                <label className="uiLabel">Email</label>
                <div className="uiControl">
                  <input
                    className="uiInput"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    type="email"
                    autoComplete="email"
                    disabled={signinPaused}
                    required
                  />
                </div>
              </div>

              <div className="authFull uiField">
                <label className="uiLabel">Password</label>
                <div className="uiControl">
                  <input
                    className="uiInput"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    type="password"
                    autoComplete="current-password"
                    disabled={signinPaused}
                    required
                  />
                </div>
              </div>
            </div>

            {msg ? <div className="authFormError">{msg}</div> : null}

            <div className="authActions">
              <button className="authPrimaryBtn" disabled={busy || signinPaused} type="submit">
                {signinPaused ? "Sign in unavailable" : busy ? "Signing in..." : "Sign in"}
              </button>
            </div>
          </form>

          <div className="authFooter">
            <div className="authFooterLinks">
              {!signupPaused ? (
                <>
                  <span>Need an account?</span>
                  <Link to="/signup">Create account</Link>
                  <span className="authDot">·</span>
                </>
              ) : (
                <>
                  <span>New account signup is paused.</span>
                  <span className="authDot">·</span>
                </>
              )}
              <Link to={`/verify-email?email=${encodeURIComponent(email)}`}>Resend email</Link>
              <span className="authDot">·</span>
              <Link to="/">Back home</Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
