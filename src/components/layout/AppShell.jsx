import { NavLink, Link } from "react-router-dom";

export default function AppShell({ title, onSignOut, children, pendingCount = 0 }) {
  const navClass = ({ isActive }) => `navItem${isActive ? " navItemActive" : ""}`;

  return (
    <div className="shell">
      {/* Sidebar */}
      <aside className="shellSidebar">
        <div className="shellBrand">
          <div className="shellLogo" aria-hidden="true" />
          <div className="shellBrandText">
            <div className="shellBrandName">Glow'd Up</div>
            <div className="shellBrandSub">Pro Dashboard</div>
          </div>
        </div>

        <nav className="shellNav">
          <NavLink to="/app" end className={navClass}>
            <div className="navIcon">▦</div>
            Dashboard
          </NavLink>

          <NavLink to="/app/calendar" className={navClass}>
            <div className="navIcon">🗓</div>
            Appointments
            {pendingCount > 0 && (
              <span className="navBadge">{pendingCount}</span>
            )}
          </NavLink>

          <NavLink to="/app/services" className={navClass}>
            <div className="navIcon">🏷</div>
            Services
          </NavLink>

          <NavLink to="/app/payouts" className={navClass}>
            <div className="navIcon">💳</div>
            Payouts
          </NavLink>

          <NavLink to="/app/settings" className={navClass}>
            <div className="navIcon">⚙</div>
            Settings
          </NavLink>

          <NavLink to="/app/profile" className={navClass}>
            <div className="navIcon">👤</div>
            Profile
          </NavLink>
        </nav>

        <div className="shellFooter">
          <Link to="/support" className="navItem">
            <div className="navIcon">?</div>
            Support
          </Link>
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

        {/* Mobile tab bar */}
        <nav className="shellMobileNav" aria-label="Mobile navigation">
          <NavLink to="/app" end className={navClass}>
            <div className="navIcon">▦</div>
            Home
          </NavLink>

          <NavLink to="/app/calendar" className={({ isActive }) => `navItem${isActive ? " navItemActive" : ""} navItemRelative`}>
            <div className="navIcon">🗓</div>
            Bookings
            {pendingCount > 0 && (
              <span className="navBadgeMobile">{pendingCount}</span>
            )}
          </NavLink>

          <NavLink to="/app/services" className={navClass}>
            <div className="navIcon">🏷</div>
            Services
          </NavLink>

          <NavLink to="/app/payouts" className={navClass}>
            <div className="navIcon">💳</div>
            Payouts
          </NavLink>

          <NavLink to="/app/settings" className={navClass}>
            <div className="navIcon">⚙</div>
            Settings
          </NavLink>
        </nav>

        <main className="shellContent">{children}</main>
      </section>
    </div>
  );
}
