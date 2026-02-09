import { supabase } from "../lib/supabase";

export default function App() {
  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  return (
    <div className="page">
      <div className="bg" aria-hidden="true" />

      <header className="nav">
        <div className="navInner">
          <a className="brand" href="/">
            <img className="logo" src="/assets/logo-1.png" alt="Glow’d Up Booking" />
            <div className="brandText">
              <div className="brandName">Glow’d Up Booking</div>
              <div className="brandTag">Platform</div>
            </div>
          </a>

          <div className="navCta">
            <button className="btn ghost" onClick={signOut}>Sign out</button>
          </div>
        </div>
      </header>

      <main className="container">
        <section className="heroPanel">
          <h1>Dashboard</h1>
          <p>
            You’re signed in. Next we’ll add your real platform modules: bookings, pros, analytics.
          </p>
        </section>
      </main>
    </div>
  );
}
