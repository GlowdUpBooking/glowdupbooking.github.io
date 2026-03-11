import { supabase } from "./supabase";

function asString(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function asStudioAccessType(value) {
  const normalized = asString(value)?.toLowerCase();
  if (normalized === "owner") return "owner";
  if (normalized === "member") return "member";
  return null;
}

function parseStudioAccessContextRow(value) {
  const row = value && typeof value === "object" ? value : {};
  const accessType = asStudioAccessType(row.access_type);
  const hasStudioAccess = Boolean(row.has_studio_access);

  return {
    hasStudioAccess,
    accessType,
    studioId: asString(row.studio_id),
    studioName: asString(row.studio_name),
    studioOwnerId: asString(row.studio_owner_id),
    studioMemberRole: asString(row.studio_member_role),
    studioMemberCovered: hasStudioAccess && accessType === "member",
  };
}

export async function fetchStudioAccessContext(profileId) {
  const userId = asString(profileId);
  if (!userId) {
    return {
      hasStudioAccess: false,
      accessType: null,
      studioId: null,
      studioName: null,
      studioOwnerId: null,
      studioMemberRole: null,
      studioMemberCovered: false,
    };
  }

  const { data, error } = await supabase.rpc("get_studio_access_context", {
    p_user_id: userId,
  });

  if (error) throw error;

  const row = Array.isArray(data) ? data[0] : data;
  return parseStudioAccessContextRow(row);
}
