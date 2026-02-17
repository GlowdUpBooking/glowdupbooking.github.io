export default function Button({
  children,
  className = "",
  variant = "outline", // "primary" | "outline"
  full = false,
  ...props
}) {
  const v = variant === "primary" ? "btnPrimary" : "btnOutline";
  const w = full ? "btnFull" : "";
  return (
    <button className={`btn ${v} ${w} ${className}`} {...props}>
      {children}
    </button>
  );
}