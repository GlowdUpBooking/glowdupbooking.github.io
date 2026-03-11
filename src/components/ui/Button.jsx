export default function Button({
  children,
  className = "",
  variant = "outline", // "primary" | "outline"
  full = false,
  type = "button",
  ...props
}) {
  const v = variant === "primary" ? "btnPrimary" : "btnOutline";
  const w = full ? "btnFull" : "";
  return (
    <button type={type} className={`btn ${v} ${w} ${className}`} {...props}>
      {children}
    </button>
  );
}
