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
  border: "1px solid rgba(255,255,255,0.15)",
  background: "rgba(0,0,0,0.35)",
  color: "#f3f3f3",
  padding: "10px 14px",
  fontSize: 15,
  outline: "none",
  transition: "border-color 0.15s",
};

const textareaStyle = {
  ...fieldStyle,
  minHeight: 100,
  resize: "vertical",
};

function Section({ title, hint, children }) {
  return (
    <div className="pf-section">
      <div className="pf-sectionHead">
        <div className="pf-sectionTitle">{title}</div>
        {hint && <div className="pf-sectionHint">{hint}</div>}
      </div>
      <div className="pf-sectionBody">{children}</div>
    </div>
  );
}

function Field({ label, hint, children }) {
  return (
    <label className="pf-field">
      <span className="pf-label">{label}</span>
      {children}
      {hint && <span className="pf-hint">{hint}</span>}
    </label>
  );
}

function TwoCol({ children }) {
  return <div className="pf-twoCol">{children}</div>;
}

export default function Profile() {
  const nav = useNavigate();

  const [loading, setSaving2]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [userId, setUserId]     = useState(null);
  const [err, setErr]           = useState("");
  const [msg, setMsg]           = useState("");

  // Public profile
  const [businessName, setBusinessName]   = useState("");
  const [businessType, setBusinessType]   = useState("");
  const [bio, setBio]                     = useState("");
  const [avatarUrl, setAvatarUrl]         = useState("");

  // Personal
  const [fullName, setFullName]           = useState("");
  const [phone, setPhone]                 = useState("");

  // Social / online
  const [instagram, setInstagram]         = useState("");
  const [website, setWebsite]             = useState("");
  const [cashapp, setCashapp]             = useState("");

  // Booking defaults
  const [bookingDeposit, setBookingDeposit] = useState("");

  useEffect(() => {
    let mounted = true;
    (async () => {
      setSaving2(true);
      const { data: authRes, error: authErr } = await supabase.auth.getUser();
      const u = authRes?.user ?? null;
      if (authErr || !u) { nav("/login", { replace: true }); return; }

      const { data: profile, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", u.id)
        .maybeSingle();

      if (!mounted) return;
      if (error) setErr("Could not load profile details.");

      setUserId(u.id);
      setBusinessName(profile?.business_name ?? "");
      setBusinessType(profile?.business_type ?? "");
      setBio(profile?.bio ?? "");
      setAvatarUrl(profile?.avatar_url ?? "");
      setFullName(profile?.full_name ?? "");
      setPhone(profile?.phone ?? "");
      setInstagram(profile?.instagram_handle ?? "");
      setWebsite(profile?.website_url ?? "");
      setCashapp(profile?.cashapp_handle ?? "");
      setBookingDeposit(profile?.booking_deposit == null ? "" : String(profile.booking_deposit));
      setSaving2(false);
    })();
    return () => { mounted = false; };
  }, [nav]);

  async function onSave() {
    if (!userId) return;
    setSaving(true);
    setErr(""); setMsg("");
    try {
      const depositVal = bookingDeposit === "" || Number.isNaN(Number(bookingDeposit))
        ? 0
        : Math.max(0, Number(bookingDeposit));

      const payload = {
        id:               userId,
        role:             "professional",
        business_name:    businessName.trim() || null,
        business_type:    businessType.trim() || null,
        bio:              bio.trim() || null,
        avatar_url:       avatarUrl.trim() || null,
        full_name:        fullName.trim() || null,
        phone:            phone.trim() || null,
        instagram_handle: instagram.trim() || null,
        website_url:      website.trim() || null,
        cashapp_handle:   cashapp.trim() || null,
        booking_deposit:  depositVal,
      };

      const { error } = await supabase.from("profiles").upsert(payload, { onConflict: "id" });
      if (error) throw error;
      setMsg("Profile saved successfully.");
    } catch (e) {
      console.error("[Profile] save:", e);
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
        <div className="g-page">
          <div className="ap-loadingGrid">
            {[1, 2, 3].map((i) => <div key={i} className="ap-skeleton" style={{ height: 120 }} />)}
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Profile" onSignOut={signOut}>
      <div className="g-page">
        <div className="pf-header">
          <h1 className="g-h1">Profile</h1>
          <div className="u-muted">This is what clients see when they visit your booking page.</div>
        </div>

        <div className="pf-layout">
          <div className="pf-main">

            {/* Public Profile */}
            <Section title="Public Profile" hint="Shown on your booking page">
              <Field label="Business name" hint="Required — clients book under this name">
                <input
                  style={fieldStyle}
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="e.g. Cuts by Marcus"
                />
              </Field>
              <Field label="Business type" hint="Your specialty or industry">
                <input
                  style={fieldStyle}
                  value={businessType}
                  onChange={(e) => setBusinessType(e.target.value)}
                  placeholder="e.g. Barber, Nail Tech, Tattoo Artist"
                />
              </Field>
              <Field label="Bio" hint="Tell clients about yourself and your work">
                <textarea
                  style={textareaStyle}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Describe your experience, specialties, and what makes you unique..."
                  maxLength={500}
                />
                <span className="pf-charCount">{bio.length}/500</span>
              </Field>
              <Field label="Profile photo URL" hint="Direct link to your headshot or logo">
                <input
                  style={fieldStyle}
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                  placeholder="https://..."
                />
              </Field>
            </Section>

            {/* Personal Info */}
            <Section title="Personal Info" hint="Not shown publicly — for internal use">
              <TwoCol>
                <Field label="Full name">
                  <input
                    style={fieldStyle}
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Your legal or preferred name"
                  />
                </Field>
                <Field label="Phone number" hint="For client contact and SMS">
                  <input
                    style={fieldStyle}
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+1 (555) 000-0000"
                  />
                </Field>
              </TwoCol>
            </Section>

            {/* Social & Online */}
            <Section title="Social &amp; Online" hint="Shown on your public profile">
              <TwoCol>
                <Field label="Instagram">
                  <input
                    style={fieldStyle}
                    value={instagram}
                    onChange={(e) => setInstagram(e.target.value)}
                    placeholder="@yourhandle"
                  />
                </Field>
                <Field label="CashApp" hint="Clients may use this for alternative payments">
                  <input
                    style={fieldStyle}
                    value={cashapp}
                    onChange={(e) => setCashapp(e.target.value)}
                    placeholder="$yourcashtag"
                  />
                </Field>
              </TwoCol>
              <Field label="Website URL">
                <input
                  style={fieldStyle}
                  type="url"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="https://your-site.com"
                />
              </Field>
            </Section>

            {/* Booking Defaults */}
            <Section title="Booking Defaults" hint="Default values applied to new bookings">
              <Field label="Default deposit amount (USD)" hint="Can be overridden per service">
                <input
                  style={fieldStyle}
                  inputMode="decimal"
                  value={bookingDeposit}
                  onChange={(e) => setBookingDeposit(e.target.value)}
                  placeholder="0.00"
                />
              </Field>
            </Section>

          </div>

          {/* Preview sidebar */}
          <div className="pf-sidebar">
            <Card className="pf-previewCard">
              <div className="pf-previewLabel">Preview</div>
              <div className="pf-previewAvatar">
                {avatarUrl
                  ? <img src={avatarUrl} alt={businessName} className="pf-previewImg" onError={(e) => { e.currentTarget.style.display = "none"; }} />
                  : <div className="pf-previewAvatarFallback">{businessName?.charAt(0)?.toUpperCase() || "?"}</div>
                }
              </div>
              <div className="pf-previewName">{businessName || "Business Name"}</div>
              <div className="pf-previewType u-muted">{businessType || "Type"}</div>
              {bio && <div className="pf-previewBio u-muted">{bio}</div>}
              {instagram && (
                <div className="pf-previewLink">
                  <span>◎</span>
                  <span>{instagram.startsWith("@") ? instagram : `@${instagram}`}</span>
                </div>
              )}
              {website && (
                <div className="pf-previewLink">
                  <span>⌂</span>
                  <span className="pf-previewWebsite">{website}</span>
                </div>
              )}
            </Card>

            <div className="pf-actions">
              {err && <div className="ap-msg ap-msgErr">{err}</div>}
              {msg && <div className="ap-msg ap-msgOk">{msg}</div>}
              <Button variant="primary" onClick={onSave} disabled={saving}>
                {saving ? "Saving…" : "Save Changes"}
              </Button>
              <Button variant="outline" onClick={() => nav("/app/settings")}>
                Open Settings
              </Button>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
