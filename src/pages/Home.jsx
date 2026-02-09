const progress = [
  { title: "Web Platform (React)", status: "Now", detail: "Premium UI, routing, deploy pipeline" },
  { title: "Supabase Auth", status: "Now", detail: "Sign up, sign in, sessions, protected routes" },
  { title: "Pro Dashboard", status: "Next", detail: "Schedule, services, availability, profile" },
  { title: "Client Booking", status: "Next", detail: "Book flow, confirmations, history" },
  { title: "Analytics", status: "Planned", detail: "Revenue, retention, cancellations, exports" },
  { title: "Notifications", status: "Planned", detail: "Email/SMS reminders, reschedule links" },
];

const featureIdeas = [
  { title: "Advanced analytics", detail: "KPIs, trends, exports, performance insights" },
  { title: "Client history + notes", detail: "Preferences, photos, past services, internal notes" },
  { title: "Team accounts", detail: "Studios/salons with multiple pros and roles" },
  { title: "Intake forms", detail: "Collect info before appointment by category" },
  { title: "Deposits & policies", detail: "No-show protection + cancellation rules" },
  { title: "Portfolio + reviews", detail: "Show work and convert visitors" },
];

function StatusPill({ value }) {
  const cls =
    value === "Now" ? "pill pill-now" : value === "Next" ? "pill pill-next" : "pill pill-planned";
  return <span className={cls}>{value}</span>;
}

export default function Home() {
  return (
    <div className="page">
      <div className="bg" aria-hidden="true" />

      <header className="nav">
        <div className="navInner">
          <a className="brand" href="/">
            <img className="logo" src="/assets/logo-1.png" alt="Glow’d Up Booking" />
            <div className="brandText">
              <div className="brandName">Glow’d Up Booking</div>
              <div className="brandTag">Premium booking platform</div>
            </div>
          </a>

          <div className="navCta">
            <a className="btn ghost" href="/signup">Create account</a>
            <a className="btn gold" href="/login">Sign in</a>
          </div>
        </div>
      </header>

      <main className="container">
        <section className="heroPanel">
          <h1>Discover top beauty &amp; grooming professionals.</h1>
          <p>
            The web platform runs parallel with the app — built for deeper analytics, stronger
            management tools, and a premium booking experience.
          </p>

          <div className="heroBtns">
            <a className="btn gold" href="/login">Sign in</a>
            <a className="btn ghost" href="/signup">Create account</a>
          </div>
        </section>

        <section className="section">
          <div className="sectionHead">
            <h2>Progress</h2>
            <p>What we’re building right now.</p>
          </div>

          <div className="grid">
            {progress.map((x) => (
              <div className="card" key={x.title}>
                <div className="cardTop">
                  <div className="cardTitle">{x.title}</div>
                  <StatusPill value={x.status} />
                </div>
                <div className="cardDetail">{x.detail}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="section">
          <div className="sectionHead">
            <h2>Feature ideas</h2>
            <p>Possible additions we can ship next.</p>
          </div>

          <div className="grid">
            {featureIdeas.map((x) => (
              <div className="card" key={x.title}>
                <div className="cardTitle">{x.title}</div>
                <div className="cardDetail">{x.detail}</div>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="footer">
        <div className="footerInner">
          <div>
            <div className="footerTitle">Glow’d Up Booking</div>
            <div className="footerSub">© Kamara Labs LLC</div>
          </div>
          <div className="footerLinks">
            <a href="/login">Sign in</a>
            <a href="/signup">Create account</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
