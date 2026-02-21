import { NavLink } from "react-router-dom";

export default function AppShell({ title, onSignOut, children }) {
  const navClass = ({ isActive }) => `navItem${isActive ? " navItemActive" : ""}`;

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
          <NavLink to="/app" end className={navClass}>
            <div className="navIcon">▦</div>
            Dashboard
          </NavLink>

          <div className="navItem" style={{ opacity: 0.5 }}>
            <div className="navIcon">🗓</div>
            Calendar
          </div>

          <NavLink to="/app/services" className={navClass}>
            <div className="navIcon">🏷</div>
            Services
          </NavLink>

          <div className="navItem" style={{ opacity: 0.5 }}>
            <div className="navIcon">👥</div>
            Clients
          </div>

          <NavLink to="/app/settings" className={navClass}>
            <div className="navIcon">✓</div>
            Availability
          </NavLink>

          <NavLink to="/app/settings" className={navClass}>
            <div className="navIcon">⚙</div>
            Settings
          </NavLink>

          <div className="navItem" style={{ opacity: 0.5 }}>
            <div className="navIcon">?</div>
            Support
          </div>
        </nav>

        <div className="shellFooter">
          <NavLink to="/app/settings" className={navClass}>
            <div className="navIcon">⚙</div>
            Settings
          </NavLink>
          <div className="navItem" style={{ opacity: 0.5 }}>
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
