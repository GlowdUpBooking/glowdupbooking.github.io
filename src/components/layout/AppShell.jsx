import { Link, NavLink, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";

const NAV_ITEMS = [
  { to: "/app", label: "Dashboard", shortLabel: "Home", icon: "dashboard", end: true },
  { to: "/app/calendar", label: "Appointments", shortLabel: "Book", icon: "calendar" },
  { to: "/app/services", label: "Services", shortLabel: "Serve", icon: "services" },
  { to: "/app/availability", label: "Availability", shortLabel: "Time", icon: "availability" },
  { to: "/app/payouts", label: "Payouts", shortLabel: "Pay", icon: "payouts" },
  { to: "/app/subscription", label: "Subscription", shortLabel: "Plan", icon: "subscription" },
  { to: "/app/studio", label: "Studio Team", shortLabel: "Studio", icon: "studio" },
  { to: "/app/analytics", label: "Analytics", shortLabel: "Stats", icon: "analytics" },
  { to: "/app/settings", label: "Settings", shortLabel: "Setup", icon: "settings" },
  { to: "/app/profile", label: "Profile", shortLabel: "Profile", icon: "profile" },
];

const MOBILE_ITEMS = NAV_ITEMS.filter((item) =>
  ["/app", "/app/calendar", "/app/services", "/app/payouts", "/app/studio", "/app/settings"].includes(item.to)
);

const ROUTE_THEMES = [
  { match: (pathname) => pathname === "/app", key: "dashboard", label: "Overview", accent: "#f1b35c", accentSoft: "rgba(241, 179, 92, 0.16)", accentRgb: "241, 179, 92" },
  { match: (pathname) => pathname.startsWith("/app/calendar"), key: "calendar", label: "Bookings", accent: "#6fa9ff", accentSoft: "rgba(111, 169, 255, 0.18)", accentRgb: "111, 169, 255" },
  { match: (pathname) => pathname.startsWith("/app/services"), key: "services", label: "Services", accent: "#f5c985", accentSoft: "rgba(245, 201, 133, 0.18)", accentRgb: "245, 201, 133" },
  { match: (pathname) => pathname.startsWith("/app/availability"), key: "availability", label: "Schedule", accent: "#82d6ff", accentSoft: "rgba(130, 214, 255, 0.18)", accentRgb: "130, 214, 255" },
  { match: (pathname) => pathname.startsWith("/app/payouts"), key: "payouts", label: "Payouts", accent: "#69edb0", accentSoft: "rgba(105, 237, 176, 0.18)", accentRgb: "105, 237, 176" },
  { match: (pathname) => pathname.startsWith("/app/subscription"), key: "subscription", label: "Plan", accent: "#f1cd72", accentSoft: "rgba(241, 205, 114, 0.18)", accentRgb: "241, 205, 114" },
  { match: (pathname) => pathname.startsWith("/app/studio"), key: "studio", label: "Workspace", accent: "#ff9b79", accentSoft: "rgba(255, 155, 121, 0.18)", accentRgb: "255, 155, 121" },
  { match: (pathname) => pathname.startsWith("/app/analytics"), key: "analytics", label: "Insights", accent: "#7de7cf", accentSoft: "rgba(125, 231, 207, 0.18)", accentRgb: "125, 231, 207" },
  { match: (pathname) => pathname.startsWith("/app/settings"), key: "settings", label: "Control", accent: "#97abff", accentSoft: "rgba(151, 171, 255, 0.18)", accentRgb: "151, 171, 255" },
  { match: (pathname) => pathname.startsWith("/app/profile"), key: "profile", label: "Identity", accent: "#efb8a4", accentSoft: "rgba(239, 184, 164, 0.18)", accentRgb: "239, 184, 164" },
];

function Icon({ name }) {
  const icons = {
    dashboard: (
      <path d="M4.5 5.5h6v6h-6zm9 0h6v4h-6zm0 7h6v8h-6zm-9 9h6v-7h-6z" />
    ),
    calendar: (
      <>
        <path d="M5.5 8.5h13a1 1 0 0 1 1 1v9a2 2 0 0 1-2 2h-11a2 2 0 0 1-2-2v-9a1 1 0 0 1 1-1Z" />
        <path d="M8 4.5v4m8-4v4M4.5 10.5h15" />
      </>
    ),
    services: (
      <>
        <path d="M6 8.5h12.5a1.5 1.5 0 0 1 0 3H11L8 15.5H6a1.5 1.5 0 0 1 0-3h2.5" />
        <path d="M7.5 8.5V6.75A2.25 2.25 0 0 1 9.75 4.5h2.5A2.25 2.25 0 0 1 14.5 6.75V8.5" />
      </>
    ),
    availability: (
      <>
        <path d="M12 6.25a6.75 6.75 0 1 0 6.75 6.75A6.75 6.75 0 0 0 12 6.25Z" />
        <path d="M12 9.25v4.25l2.75 1.5" />
      </>
    ),
    payouts: (
      <>
        <path d="M5.5 7.5h13a1.5 1.5 0 0 1 1.5 1.5v6a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 15V9a1.5 1.5 0 0 1 1.5-1.5Z" />
        <path d="M4.5 11.25h15" />
      </>
    ),
    subscription: (
      <>
        <path d="M12 4.75 18.5 8v8L12 19.25 5.5 16V8Z" />
        <path d="M12 12.25 18.5 8M12 12.25 5.5 8M12 12.25V19" />
      </>
    ),
    studio: (
      <>
        <path d="M8.25 11a2.25 2.25 0 1 0 0-4.5 2.25 2.25 0 0 0 0 4.5Zm7.5 0a2.25 2.25 0 1 0 0-4.5 2.25 2.25 0 0 0 0 4.5Z" />
        <path d="M4.75 18a3.5 3.5 0 0 1 7 0m2.5 0a3.5 3.5 0 0 1 7 0" />
      </>
    ),
    analytics: (
      <>
        <path d="M5.5 18.5V11m6.5 7.5V7.5m6.5 11V4.5" />
        <path d="M4.5 18.5h15" />
      </>
    ),
    settings: (
      <>
        <path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z" />
        <path d="M19 12a7 7 0 0 0-.12-1.28l2.01-1.56-1.9-3.29-2.43.77a7.02 7.02 0 0 0-2.2-1.27L14 3h-4l-.36 2.37a7.02 7.02 0 0 0-2.2 1.27l-2.43-.77-1.9 3.29 2.01 1.56A7 7 0 0 0 5 12c0 .44.04.87.12 1.28l-2.01 1.56 1.9 3.29 2.43-.77c.66.55 1.4.98 2.2 1.27L10 21h4l.36-2.37c.8-.29 1.54-.72 2.2-1.27l2.43.77 1.9-3.29-2.01-1.56c.08-.41.12-.84.12-1.28Z" />
      </>
    ),
    profile: (
      <>
        <path d="M12 12a3.25 3.25 0 1 0 0-6.5 3.25 3.25 0 0 0 0 6.5Z" />
        <path d="M5.5 19a6.5 6.5 0 0 1 13 0" />
      </>
    ),
    support: (
      <>
        <path d="M9.25 9.5a2.75 2.75 0 1 1 5.1 1.42c-.55.95-1.6 1.26-2.1 2.08-.18.31-.25.66-.25 1" />
        <path d="M12 17.75h.01" />
        <path d="M12 3.75a8.25 8.25 0 1 0 0 16.5 8.25 8.25 0 0 0 0-16.5Z" />
      </>
    ),
    themeDark: (
      <>
        <path d="M18.25 14.5A6.75 6.75 0 0 1 9.5 5.75a6.75 6.75 0 1 0 8.75 8.75Z" />
      </>
    ),
    themeLight: (
      <>
        <circle cx="12" cy="12" r="3.5" />
        <path d="M12 3.75v2.1m0 12.3v2.1m8.25-8.25h-2.1M5.85 12h-2.1m14.08-5.83-1.49 1.49M7.66 16.34l-1.49 1.49m0-11.66 1.49 1.49m8.68 8.68 1.49 1.49" />
      </>
    ),
  };

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="shellSvgIcon">
      {icons[name] ?? icons.dashboard}
    </svg>
  );
}

function getRouteTheme(pathname) {
  return ROUTE_THEMES.find((theme) => theme.match(pathname)) ?? ROUTE_THEMES[0];
}

function getInitialScheme() {
  if (typeof window === "undefined") return "dark";

  const saved = String(window.localStorage.getItem("glowdup-pro-theme") || "").trim().toLowerCase();
  return saved === "light" || saved === "dark" ? saved : "dark";
}

export default function AppShell({ title, onSignOut, children, pendingCount = 0 }) {
  const location = useLocation();
  const theme = getRouteTheme(location.pathname);
  const [scheme, setScheme] = useState(getInitialScheme);
  const todayLabel = new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date());

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("glowdup-pro-theme", scheme);
  }, [scheme]);

  const shellStyle = {
    "--shell-accent": theme.accent,
    "--shell-accent-soft": theme.accentSoft,
    "--shell-accent-rgb": theme.accentRgb,
  };

  const navClass = ({ isActive }) => `navItem${isActive ? " navItemActive" : ""}`;
  const nextScheme = scheme === "dark" ? "light" : "dark";
  const toggleLabel = scheme === "dark" ? "Light theme" : "Night theme";

  return (
    <div className="shell" style={shellStyle} data-shell-theme={theme.key} data-shell-scheme={scheme}>
      <aside className="shellSidebar">
        <div className="shellSidebarGlow" aria-hidden="true" />

        <Link to="/app" className="shellBrand">
          <div className="shellLogoFrame">
            <img src="/assets/logo.png" alt="" className="shellLogo" aria-hidden="true" />
          </div>
          <div className="shellBrandText">
            <div className="shellBrandEyebrow">Glow&apos;d Up</div>
            <div className="shellBrandName">Pro Control</div>
            <div className="shellBrandSub">Client-ready booking operations</div>
          </div>
        </Link>

        <div className="shellWorkspaceCard">
          <div className="shellWorkspaceLabel">Live workspace</div>
          <div className="shellWorkspaceTitle">{theme.label}</div>
          <div className="shellWorkspaceMeta">{todayLabel}</div>
          <div className="shellWorkspaceStats">
            <div className="shellWorkspaceStat">
              <span className="shellWorkspaceStatLabel">Status</span>
              <span className="shellWorkspaceStatValue">Active</span>
            </div>
            <div className="shellWorkspaceStat">
              <span className="shellWorkspaceStatLabel">Pending</span>
              <span className="shellWorkspaceStatValue">{pendingCount}</span>
            </div>
          </div>
        </div>

        <nav className="shellNav" aria-label="Primary navigation">
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={navClass}>
              <span className="navIconWrap">
                <span className="navIcon">
                  <Icon name={item.icon} />
                </span>
              </span>
              <span className="navText">{item.label}</span>
              {item.to === "/app/calendar" && pendingCount > 0 ? <span className="navBadge">{pendingCount}</span> : null}
            </NavLink>
          ))}
        </nav>

        <div className="shellFooter">
          <Link to="/support" className="navItem shellSupportLink">
            <span className="navIconWrap">
              <span className="navIcon">
                <Icon name="support" />
              </span>
            </span>
            <span className="navText">Support</span>
          </Link>
        </div>
      </aside>

      <section className="shellMain">
        <div className="shellMainGlow" aria-hidden="true" />

        <header className="shellTopbar">
          <div className="shellTopMeta">
            <div className="shellTitleEyebrow">Glow&apos;d Up Pro</div>
            <div className="shellTitleRow">
              <div className="shellTitle">{title}</div>
              <span className="shellTopBadge">{theme.label}</span>
            </div>
          </div>

          <div className="shellTopActions">
            <div className="shellNowPill">
              <span className="shellNowDot" aria-hidden="true" />
              {todayLabel}
            </div>
            <button
              type="button"
              className="shellThemeToggle"
              onClick={() => setScheme(nextScheme)}
              role="switch"
              aria-label={`Color theme ${scheme}. Switch to ${nextScheme} theme`}
              aria-checked={scheme === "light"}
              title={`Switch to ${nextScheme} theme`}
            >
              <span className="shellThemeToggleIcon">
                <Icon name={scheme === "dark" ? "themeLight" : "themeDark"} />
              </span>
              <span className="shellThemeToggleText">{toggleLabel}</span>
              <span className={`shellThemeToggleTrack shellThemeToggleTrack${scheme === "light" ? "Light" : "Dark"}`}>
                <span className="shellThemeToggleThumb" />
              </span>
            </button>
            <button type="button" className="btn btnOutline shellSignOutBtn" onClick={onSignOut}>
              Sign out
            </button>
          </div>
        </header>

        <main className="shellContent">
          <div className="shellContentInner">{children}</div>
        </main>

        <nav className="shellMobileNav" aria-label="Mobile navigation">
          {MOBILE_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `navItem${isActive ? " navItemActive" : ""}${item.to === "/app/calendar" ? " navItemRelative" : ""}`}
            >
              <span className="navIconWrap">
                <span className="navIcon">
                  <Icon name={item.icon} />
                </span>
              </span>
              <span className="navText">{item.shortLabel}</span>
              {item.to === "/app/calendar" && pendingCount > 0 ? <span className="navBadgeMobile">{pendingCount}</span> : null}
            </NavLink>
          ))}
        </nav>
      </section>
    </div>
  );
}
