export default function AppShell({ title, onSignOut, children }) {
  return (
    <div className="shell">
      {/* Sidebar */}
      <aside className="shellSidebar">
        <div className="shellBrand">
          <div className="shellLogo" aria-hidden="true" />
          <div className="shellBrandText">
            <div className="shellBrandName">Glow’d Up Booking</div>
            <div className="shellBrandSub">Platform</div>
          </div>
        </div>

        <nav className="shellNav">
          <div className="navItem navItemActive">
            <div className="navIcon">▦</div>
            Dashboard
          </div>

          <div className="navItem">
            <div className="navIcon">🗓</div>
            Calendar
          </div>

          <div className="navItem">
            <div className="navIcon">🏷</div>
            Services
          </div>

          <div className="navItem">
            <div className="navIcon">👥</div>
            Clients
          </div>

          <div className="navItem">
            <div className="navIcon">✓</div>
            Availability
          </div>

          <div className="navItem">
            <div className="navIcon">⚙</div>
            Settings
          </div>

          <div className="navItem">
            <div className="navIcon">?</div>
            Support
          </div>
        </nav>

        <div className="shellFooter">
          <div className="navItem">
            <div className="navIcon">⚙</div>
            Settings
          </div>
          <div className="navItem">
            <div className="navIcon">?</div>
            Support
          </div>
        </div>
      </aside>

      {/* Main */}
      <section className="shellMain">
        <header className="shellTopbar">
          <div className="shellTitle">{title}</div>

          <button className="btn btnOutline" onClick={onSignOut}>
            Sign out
          </button>
        </header>

        <main className="shellContent">{children}</main>
      </section>
    </div>
  );
}