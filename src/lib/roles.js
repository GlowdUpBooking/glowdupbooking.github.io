export function normalizeRole(value) {
  return String(value || "").trim().toLowerCase();
}

export function isClientRole(value) {
  return normalizeRole(value) === "client";
}

export function isProRole(value) {
  const role = normalizeRole(value);
  return (
    role === "professional" ||
    role === "stylist" ||
    role === "pro" ||
    role === "owner" ||
    role === "staff" ||
    role === "studio_owner" ||
    role === "studio_staff" ||
    role === "team_owner" ||
    role === "team_staff"
  );
}

export function roleForProfileWrite(value) {
  const role = normalizeRole(value);
  if (!role) return null;
  return role === "pro" ? "professional" : role;
}
