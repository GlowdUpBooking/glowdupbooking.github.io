import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppShell from "../components/layout/AppShell";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import { supabase } from "../lib/supabase";

const fieldStyle = {
  width: "100%",
  minHeight: 44,
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.2)",
  background: "rgba(0,0,0,0.35)",
  color: "#f3f3f3",
  padding: "10px 12px",
};

export default function Profile() {
  const nav = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");

  const [userId, setUserId] = useState(null);
  const [fullName, setFullName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [businessType, setBusinessType] = useState("");
  const [instagram, setInstagram] = useState("");
  const [website, setWebsite] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      const { data: authRes, error: authErr } = await supabase.auth.getUser();
      const u = authRes?.user ?? null;
      if (authErr || !u) {
        nav("/login", { replace: true });
        return;
      }

      const { data: profile, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", u.id)
        .maybeSingle();

      if (!mounted) return;
      if (error) {
        setErr("Could not load profile details.");
      }

      setUserId(u.id);
      setFullName(profile?.full_name ?? "");
      setBusinessName(profile?.business_name ?? "");
      setBusinessType(profile?.business_type ?? "");
      setInstagram(profile?.instagram_handle ?? "");
      setWebsite(profile?.website_url ?? "");
      setAvatarUrl(profile?.avatar_url ?? "");
      setLoading(false);
    })();

    return () => {
      mounted = false;
    };
  }, [nav]);

  async function onSave() {
    if (!userId) return;
    setSaving(true);
    setErr("");
    setMsg("");

    try {
      const payload = {
        id: userId,
        role: "professional",
        full_name: fullName.trim() || null,
        business_name: businessName.trim() || null,
        business_type: businessType.trim() || null,
        instagram_handle: instagram.trim() || null,
        website_url: website.trim() || null,
        avatar_url: avatarUrl.trim() || null,
      };
      const { error } = await supabase.from("profiles").upsert(payload, { onConflict: "id" });
      if (error) throw error;
      setMsg("Profile saved.");
    } catch (e) {
      console.error("[Profile] save error:", e);
      setErr("Could not save profile. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  if (loading) {
    return (
      <AppShell title="Profile" onSignOut={signOut}>
        <Card>Loading profile…</Card>
      </AppShell>
    );
  }

  return (
    <AppShell title="Profile" onSignOut={signOut}>
      <div className="g-page">
        <h1 className="g-h1">Profile</h1>
        <Card>
          <div style={{ display: "grid", gap: 12, maxWidth: 760 }}>
            <label style={{ display: "grid", gap: 6 }}>
              <span>Full name</span>
              <input style={fieldStyle} value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </label>

            <label style={{ display: "grid", gap: 6 }}>
              <span>Business name</span>
              <input style={fieldStyle} value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
            </label>

            <label style={{ display: "grid", gap: 6 }}>
              <span>Business type</span>
              <input style={fieldStyle} value={businessType} onChange={(e) => setBusinessType(e.target.value)} />
            </label>

            <label style={{ display: "grid", gap: 6 }}>
              <span>Instagram handle</span>
              <input
                style={fieldStyle}
                placeholder="@yourhandle"
                value={instagram}
                onChange={(e) => setInstagram(e.target.value)}
              />
            </label>

            <label style={{ display: "grid", gap: 6 }}>
              <span>Website URL</span>
              <input
                style={fieldStyle}
                placeholder="https://your-site.com"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
              />
            </label>

            <label style={{ display: "grid", gap: 6 }}>
              <span>Avatar image URL</span>
              <input
                style={fieldStyle}
                placeholder="https://..."
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
              />
            </label>
          </div>

          {err ? <div style={{ marginTop: 12 }}>{err}</div> : null}
          {msg ? <div style={{ marginTop: 12 }}>{msg}</div> : null}

          <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
            <Button variant="primary" onClick={onSave} disabled={saving}>
              {saving ? "Saving..." : "Save changes"}
            </Button>
            <Button variant="outline" onClick={() => nav("/app/settings")}>
              Open settings
            </Button>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
