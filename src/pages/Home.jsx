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
              <div className="brandTag">Tailored to Pros</div>
            </div>
          </a>

          <nav className="navLinks">
            <a className="navLink" href="/pricing">Pricing</a>
          </nav>

          <div className="navCta">
            <a className="btn ghost" href="/signup">Get early access</a>
            <a className="btn gold" href="/login">Sign in</a>
          </div>
        </div>
      </header>

      <main className="container">
        <section className="heroPanel">
          <h1>Your Bookings. Your Brand. Your Clients.</h1>
          <p>
            Glow’d Up Booking is a luxury booking platform made for professionals—tattoo artists,
            barbers, stylists, nail techs, and more. Share your link, collect deposits, and manage
            your schedule without marketplace noise.
          </p>

          <div className="heroBtns">
            <a className="btn gold" href="/signup">Get Early Access (Pro)</a>
            <a className="btn ghost" href="#how-it-works">See How It Works</a>
            <a className="btn ghost" href="/pricing">View pricing</a>
          </div>

          <p className="heroMicro">
            Pro-first launch • Invite-only booking • Clients book through <strong>your</strong> link
          </p>
        </section>

        <section className="section" id="how-it-works">
          <div className="sectionHead">
            <h2>Designed for the way Pros actually book</h2>
            <p>Simple, premium, and built around your workflow.</p>
          </div>

          <div className="grid">
            {[
              { title: "Create your pro profile", status: "Step 1", detail: "Services, availability, policies, branding" },
              { title: "Share your booking link", status: "Step 2", detail: "DM, Instagram bio, text, website — one link" },
              { title: "Get booked + paid", status: "Step 3", detail: "Deposits, confirmations, reminders, reschedule flow" },
            ].map((x) => (
              <div className="card" key={x.title}>
                <div className="cardTop">
                  <div className="cardTitle">{x.title}</div>
                  <span className="pill pill-now">{x.status}</span>
                </div>
                <div className="cardDetail">{x.detail}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="section">
          <div className="sectionHead">
            <h2>What we’re building</h2>
            <p>Pro tools first — then we scale city by city.</p>
          </div>

          <div className="grid">
            {[
              { title: "Web Platform (React)", status: "Now", detail: "Premium UI, routing, production deployment" },
              { title: "Supabase Auth", status: "Now", detail: "Sign up, sign in, sessions, protected routes" },
              { title: "Pro Dashboard", status: "Next", detail: "Schedule, services, availability, pro profile" },
              { title: "Client Booking", status: "Next", detail: "Link-based booking, confirmations, appointment history" },
              { title: "Analytics", status: "Planned", detail: "Revenue, retention, cancellations, exports" },
              { title: "Notifications", status: "Planned", detail: "Email/SMS reminders, reschedule links" },
            ].map((x) => (
              <div className="card" key={x.title}>
                <div className="cardTop">
                  <div className="cardTitle">{x.title}</div>
                  <span
                    className={
                      x.status === "Now"
                        ? "pill pill-now"
                        : x.status === "Next"
                        ? "pill pill-next"
                        : "pill pill-planned"
                    }
                  >
                    {x.status}
                  </span>
                </div>
                <div className="cardDetail">{x.detail}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="section">
          <div className="sectionHead">
            <h2>Pro-first upgrades</h2>
            <p>High-impact tools that make Pros look and operate premium.</p>
          </div>

          <div className="grid">
            {[
              { title: "Deposits & policies", detail: "No-show protection + clear cancellation rules" },
              { title: "Client history + notes", detail: "Preferences, photos, past services, internal notes" },
              { title: "Advanced analytics", detail: "KPIs, trends, exports, performance insights" },
              { title: "Intake forms", detail: "Collect info before appointments by category" },
              { title: "Team accounts", detail: "Studios/salons with multiple pros and roles" },
              { title: "Portfolio + reviews", detail: "Show work and convert visitors" },
            ].map((x) => (
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
            <a href="/pricing">Pricing</a>
            <a href="/login">Sign in</a>
            <a href="/signup">Get early access</a>
          </div>
        </div>
      </footer>
    </div>
  );
}