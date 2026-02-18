export default function FullScreenLoader({ label = "Loading..." }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: "24px",
      }}
    >
      <div style={{ textAlign: "center", maxWidth: 420, width: "100%" }}>
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: "999px",
            border: "3px solid rgba(255,255,255,.15)",
            borderTopColor: "rgba(255,255,255,.8)",
            margin: "0 auto 14px",
            animation: "spin 0.9s linear infinite",
          }}
        />
        <div style={{ opacity: 0.9, fontSize: 14 }}>{label}</div>

        <style>{`
          @keyframes spin { to { transform: rotate(360deg); } }
        `}</style>
      </div>
    </div>
  );
}