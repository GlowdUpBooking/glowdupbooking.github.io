import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";

export default function OnboardingSocial() {
  const nav = useNavigate();
  const [saving, setSaving] = useState(false);

  const [instagram, setInstagram] = useState("");
  const [tiktok, setTiktok] = useState("");
  const [facebookUrl, setFacebookUrl] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      const user = data?.user;
      if (!user) return;

      const { data: p } = await supabase
        .from("profiles")
        .select("instagram_handle,tiktok_handle,facebook_url,youtube_url,website_url")
        .eq("id", user.id)
        .maybeSingle();

      setInstagram(p?.instagram_handle ?? "");
      setTiktok(p?.tiktok_handle ?? "");
      setFacebookUrl(p?.facebook_url ?? "");
      setYoutubeUrl(p?.youtube_url ?? "");
      setWebsiteUrl(p?.website_url ?? "");
    })();
  }, []);

  async function next() {
    setSaving(true);
    const { data } = await supabase.auth.getUser();
    const user = data?.user;
    if (!user) return;

    await supabase
      .from("profiles")
      .update({
        instagram_handle: instagram || null,
        tiktok_handle: tiktok || null,
        facebook_url: facebookUrl || null,
        youtube_url: youtubeUrl || null,
        website_url: websiteUrl || null,
        onboarding_step: "services",
      })
      .eq("id", user.id);

    setSaving(false);
    nav("/app/onboarding/services");
  }

  return (
    <div className="page">
      <div className="bg" aria-hidden="true" />
      <main className="container">
        <section className="heroPanel">
          <h1>Social</h1>
          <p className="heroMicro">Add your social handles/links (optional).</p>

          <div style={{ display: "grid", gap: 12, marginTop: 16, maxWidth: 520 }}>
            <input
              className="input"
              placeholder="Instagram handle (no @ needed)"
              value={instagram}
              onChange={(e) => setInstagram(e.target.value)}
            />
            <input
              className="input"
              placeholder="TikTok handle (no @ needed)"
              value={tiktok}
              onChange={(e) => setTiktok(e.target.value)}
            />
            <input
              className="input"
              placeholder="Facebook URL"
              value={facebookUrl}
              onChange={(e) => setFacebookUrl(e.target.value)}
            />
            <input
              className="input"
              placeholder="YouTube URL"
              value={youtubeUrl}
              onChange={(e) => setYoutubeUrl(e.target.value)}
            />
            <input
              className="input"
              placeholder="Website URL"
              value={websiteUrl}
              onChange={(e) => setWebsiteUrl(e.target.value)}
            />
          </div>

          <div className="heroBtns" style={{ marginTop: 18 }}>
            <button className="btn gold" onClick={next} disabled={saving}>
              {saving ? "Saving..." : "Continue"}
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}