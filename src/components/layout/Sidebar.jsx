import { NavLink } from "react-router-dom";

const items = [
  { label: "Dashboard", to: "/app", icon: "▣" },
  { label: "Calendar", to: "/app/calendar", icon: "🗓" },
  { label: "Services", to: "/app/services", icon: "🧰" },
  { label: "Clients", to: "/app/clients", icon: "👤" },
  { label: "Availability", to: "/app/availability", icon: "✓" },
  { label: "Settings", to: "/app/settings", icon: "⚙" },
  { label: "Support", to: "/app/support", icon: "?" },
];

export default function Sidebar() {
  return (
    <aside className="g-sidebar">
      <nav className="g-sideNav">
        {items.map((it) => (
          <NavLink
            key={it.to}
            to={it.to}
            className={({ isActive }) => `g-sideItem ${isActive ? "active" : ""}`}
            end={it.to === "/app"}
          >
            <span className="g-sideIcon">{it.icon}</span>
            <span className="g-sideLabel">{it.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="g-sideBottom">
        <NavLink to="/app/settings" className="g-sideItem">
          <span className="g-sideIcon">⚙</span>
          <span className="g-sideLabel">Settings</span>
        </NavLink>
        <NavLink to="/app/support" className="g-sideItem">
          <span className="g-sideIcon">?</span>
          <span className="g-sideLabel">Support</span>
        </NavLink>
      </div>
    </aside>
  );
}