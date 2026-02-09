import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

export default function Login({ session }) {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (session) nav("/app", { replace: true });
  }, [session, nav]);

  async function onSubmit(e) {
    e.preventDefault();
    setMsg("");
    setBusy(true);

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);

    if (error) setMsg(error.message);
    else nav("/app", { replace: true });
  }

  return (
    <div className="authPage">
      <div className="bg" aria-hidden="true" />
      <div className="authCard">
        <img className="authLogo" src="/assets/logo-1.png" alt="Glow’d Up Booking" />
        <h1>Sign in</h1>
        <p className="muted">Access the platform.</p>

        <form onSubmit={onSubmit} className="authForm">
          <label>
            Email
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required />
          </label>

          <label>
            Password
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              required
            />
          </label>

          {msg ? <div className="authMsg">{msg}</div> : null}

          <button className="btn gold full" disabled={busy} type="submit">
            {busy ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <div className="authLinks">
          <a href="/signup">Create account</a>
          <a href="/">Back home</a>
        </div>
      </div>
    </div>
  );
}
