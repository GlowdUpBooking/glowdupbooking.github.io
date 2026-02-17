import Button from "../ui/Button";

export default function TopNav({ title = "Dashboard", onSignOut }) {
  return (
    <header className="g-topbar">
      <div className="g-topLeft">
        <div className="g-brand">
          <div className="g-brandLogo" aria-hidden="true">G</div>
          <div className="g-brandText">
            <div className="g-brandName">Glow’d Up Booking</div>
            <div className="g-brandSub">Platform</div>
          </div>
        </div>

        <div className="g-topTitle">{title}</div>
      </div>

      <div className="g-topRight">
        <Button variant="pill" onClick={onSignOut}>Sign out</Button>
      </div>
    </header>
  );
}