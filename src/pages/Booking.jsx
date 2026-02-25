import { useEffect, useMemo } from "react";
import { Link, useParams } from "react-router-dom";

function normalizeBase(raw) {
  const v = String(raw || "").trim();
  if (!v) return "";
  return v.endsWith("/") ? v.slice(0, -1) : v;
}

export default function Booking() {
  const params = useParams();
  const code = params.code || params.id;
  const bookingBase = useMemo(() => normalizeBase(import.meta.env.VITE_BOOKING_BASE_URL), []);

  useEffect(() => {
    if (!bookingBase) return;
    if (typeof window === "undefined") return;
    const origin = window.location.origin;
    const isExternal = bookingBase && !bookingBase.startsWith(origin);
    if (!isExternal) return;
    const target = `${bookingBase}/professional/${code || ""}`;
    window.location.replace(target);
  }, [bookingBase, code]);

  return (
    <div className="obPage page">
      <div className="bg" aria-hidden="true" />

      <header className="nav">
        <div className="navInner">
          <Link className="brand" to="/">
            <img className="logo" src="/assets/logo.png" alt="Glow'd Up Booking logo" />
            <div className="brandText">
              <div className="brandName">Glow'd Up Booking</div>
              <div className="brandTag">Client booking</div>
            </div>
          </Link>
        </div>
      </header>

      <main className="container">
        <section className="heroPanel">
          <h1>Booking is almost here.</h1>
          <p>
            This professional's booking page is getting ready. Please contact them directly to book for now.
          </p>

          <div className="heroBtns" style={{ marginTop: 16 }}>
            <Link className="btn gold" to="/">
              Back to home
            </Link>
          </div>

          <div className="heroMicro" style={{ marginTop: 12 }}>
            If you received this link from a professional, keep it saved for when booking goes live.
          </div>
        </section>
      </main>
    </div>
  );
}
