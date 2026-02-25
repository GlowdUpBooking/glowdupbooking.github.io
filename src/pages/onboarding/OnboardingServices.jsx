import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import OnboardingProgress from "../../components/onboarding/OnboardingProgress";
import { fetchStripeConnectStatus } from "../../lib/stripeConnect";

const BUCKET = "service-photos";

function moneyToNumber(v) {
  if (v === "" || v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function intOrNull(v) {
  if (v === "" || v == null) return null;
  const n = parseInt(String(v), 10);
  return Number.isFinite(n) ? n : null;
}

function fileExt(name = "") {
  const parts = name.split(".");
  return parts.length > 1 ? parts.pop().toLowerCase() : "jpg";
}

function uuidLike() {
  // crypto.randomUUID() is supported in modern browsers
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export default function OnboardingServices() {
  const nav = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);

  const [services, setServices] = useState([]);
  const [selectedId, setSelectedId] = useState(null);

  // Form fields
  const selected = useMemo(
    () => services.find((s) => s.id === selectedId) || null,
    [services, selectedId]
  );

  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("");
  const [category, setCategory] = useState("");
  const [depositAmount, setDepositAmount] = useState("");
  const [coverUrl, setCoverUrl] = useState("");

  const [photos, setPhotos] = useState([]); // service_photos for selected service
  const [newFiles, setNewFiles] = useState([]); // File[]
  const [err, setErr] = useState("");
  const [okMsg, setOkMsg] = useState("");
  const [autosaveStatus, setAutosaveStatus] = useState("Ready");

  // ---------- Load ----------
  useEffect(() => {
    let mounted = true;

    (async () => {
      setLoading(true);
      setErr("");

      const { data: authRes, error: authErr } = await supabase.auth.getUser();
      const u = authRes?.user ?? null;

      if (authErr || !u) {
        nav("/login");
        return;
      }

      if (!mounted) return;
      setUser(u);

      // profile
      const { data: prof, error: profErr } = await supabase
        .from("profiles")
        .select("id, role, onboarding_step")
        .eq("id", u.id)
        .maybeSingle();

      if (!mounted) return;

      if (profErr) {
        console.error("[OnboardingServices] profiles error:", profErr);
      } else if (!prof) {
        await supabase
          .from("profiles")
          .upsert({ id: u.id, role: "professional", onboarding_step: "services" }, { onConflict: "id" });
      } else {
        setProfile(prof);
      }

      // services
      const { data: svc, error: svcErr } = await supabase
        .from("services")
        .select("id, stylist_id, description, price, duration_minutes, category, image_url, deposit_amount, created_at")
        .eq("stylist_id", u.id)
        .order("created_at", { ascending: false });

      if (!mounted) return;

      if (svcErr) {
        console.error("[OnboardingServices] services error:", svcErr);
        setErr("Couldn’t load services.");
        setServices([]);
      } else {
        setServices(svc ?? []);
        // auto select first service if exists
        if ((svc ?? []).length > 0) setSelectedId((svc ?? [])[0].id);
      }

      setLoading(false);
    })();

    return () => {
      mounted = false;
    };
  }, [nav]);

  // When selecting a service, populate form + load photos
  useEffect(() => {
    let mounted = true;

    (async () => {
      setErr("");
      setNewFiles([]);

      if (!selected) {
        setDescription("");
        setPrice("");
        setDurationMinutes("");
        setCategory("");
        setDepositAmount("");
        setCoverUrl("");
        setPhotos([]);
        return;
      }

      setDescription(selected.description ?? "");
      setPrice(selected.price != null ? String(selected.price) : "");
      setDurationMinutes(selected.duration_minutes != null ? String(selected.duration_minutes) : "");
      setCategory(selected.category ?? "");
      setDepositAmount(selected.deposit_amount != null ? String(selected.deposit_amount) : "");
      setCoverUrl(selected.image_url ?? "");

      const { data: ph, error: phErr } = await supabase
        .from("service_photos")
        .select("id, service_id, url, sort_order, created_at")
        .eq("service_id", selected.id)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });

      if (!mounted) return;

      if (phErr) {
        console.error("[OnboardingServices] service_photos error:", phErr);
        setPhotos([]);
      } else {
        setPhotos(ph ?? []);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [selected?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (loading) return;
    const t = setTimeout(() => {
      try {
        localStorage.setItem(
          "gub_service_draft",
          JSON.stringify({
            selectedId,
            description,
            price,
            durationMinutes,
            category,
            depositAmount,
            coverUrl,
            ts: Date.now(),
          })
        );
        setAutosaveStatus("Draft saved");
      } catch {
        setAutosaveStatus("Draft save failed");
      }
    }, 500);
    return () => clearTimeout(t);
  }, [loading, selectedId, description, price, durationMinutes, category, depositAmount, coverUrl]);

  // ---------- Actions ----------
  function startNewService() {
    setSelectedId(null);
    setDescription("");
    setPrice("");
    setDurationMinutes("");
    setCategory("");
    setDepositAmount("");
    setCoverUrl("");
    setPhotos([]);
    setNewFiles([]);
    setErr("");
  }

  async function saveService() {
    if (!user) return;

    setSaving(true);
    setErr("");
    setOkMsg("");

    try {
      const fullPayload = {
        stylist_id: user.id,
        description: description.trim(),
        price: moneyToNumber(price),
        duration_minutes: intOrNull(durationMinutes),
        category: category.trim() || null,
        deposit_amount: moneyToNumber(depositAmount),
        image_url: coverUrl?.trim() || null,
      };

      if (!fullPayload.description) {
        setErr("Service name/description is required.");
        setSaving(false);
        return;
      }
      if (fullPayload.price == null || fullPayload.price < 0) {
        setErr("Price must be a valid number.");
        setSaving(false);
        return;
      }
      if (fullPayload.duration_minutes == null || fullPayload.duration_minutes <= 0) {
        setErr("Duration must be a valid number of minutes.");
        setSaving(false);
        return;
      }

      // Schema-compatible payloads:
      // 1) full payload (new schema)
      // 2) no optional fields (older schema)
      // 3) include safe defaults for legacy NOT NULL columns
      const payloadNoOptional = {
        stylist_id: user.id,
        description: fullPayload.description,
        price: fullPayload.price,
        duration_minutes: fullPayload.duration_minutes,
      };
      const payloadLegacySafe = {
        ...payloadNoOptional,
        image_url: fullPayload.image_url || "/assets/cover.png",
        deposit_amount: fullPayload.deposit_amount ?? 0,
      };

      async function persistService(payload) {
        if (selectedId) {
          const { data, error } = await supabase
            .from("services")
            .update(payload)
            .eq("id", selectedId)
            .eq("stylist_id", user.id)
            .select()
            .single();
          if (error) throw error;
          return data;
        }

        const { data, error } = await supabase
          .from("services")
          .insert(payload)
          .select()
          .single();
        if (error) throw error;
        return data;
      }

      let saved;
      try {
        saved = await persistService(fullPayload);
      } catch (firstErr) {
        console.warn("[OnboardingServices] full payload save failed, retrying with compatibility payload", firstErr);
        try {
          saved = await persistService(payloadNoOptional);
        } catch (secondErr) {
          console.warn("[OnboardingServices] compatibility payload save failed, retrying with legacy-safe payload", secondErr);
          saved = await persistService(payloadLegacySafe);
        }
      }

      // Refresh list (keep selected)
      const { data: svc, error: svcErr } = await supabase
        .from("services")
        .select("id, stylist_id, description, price, duration_minutes, category, image_url, deposit_amount, created_at")
        .eq("stylist_id", user.id)
        .order("created_at", { ascending: false });

      if (svcErr) console.warn("[OnboardingServices] refresh services error:", svcErr);
      setServices(svc ?? []);
      setSelectedId(saved.id);

      // Upload new photos (if any)
      if (newFiles.length > 0) {
        const startingOrder =
          photos.length > 0 ? Math.max(...photos.map((p) => p.sort_order ?? 0)) + 1 : 0;

        const insertedRows = [];

        for (let i = 0; i < newFiles.length; i++) {
          const file = newFiles[i];
          const ext = fileExt(file.name);
          const path = `${user.id}/${saved.id}/${uuidLike()}.${ext}`;

          const { error: upErr } = await supabase.storage
            .from(BUCKET)
            .upload(path, file, { upsert: false });

          if (upErr) {
            console.error("[OnboardingServices] upload error:", upErr);
            throw new Error("Photo upload failed. Check bucket/policies.");
          }

          const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
          const url = pub?.publicUrl;

          if (!url) throw new Error("Couldn’t create public URL for photo.");

          insertedRows.push({
            service_id: saved.id,
            url,
            sort_order: startingOrder + i,
          });
        }

        // Insert service_photos rows
        const { error: insErr } = await supabase.from("service_photos").insert(insertedRows);
        if (insErr) {
          console.error("[OnboardingServices] insert service_photos error:", insErr);
          throw new Error("Couldn’t save photo records.");
        }

        // If service has no cover yet, set cover to first newly uploaded
        const coverCandidate = (coverUrl && coverUrl.trim()) ? null : insertedRows[0]?.url;
        if (coverCandidate) {
          await supabase
            .from("services")
            .update({ image_url: coverCandidate })
            .eq("id", saved.id)
            .eq("stylist_id", user.id);
          setCoverUrl(coverCandidate);
        }

        // Reload photos list
        const { data: ph, error: phErr } = await supabase
          .from("service_photos")
          .select("id, service_id, url, sort_order, created_at")
          .eq("service_id", saved.id)
          .order("sort_order", { ascending: true })
          .order("created_at", { ascending: true });

        if (!phErr) setPhotos(ph ?? []);
        setNewFiles([]);
      }

      setOkMsg(selectedId ? "Service updated." : "Service added.");
      setAutosaveStatus("Saved");
    } catch (e) {
      console.error("[OnboardingServices] save error:", e);
      setErr(e?.message || "Something went wrong saving this service.");
    } finally {
      setSaving(false);
    }
  }

  async function continueToPayouts() {
    if (!user) return;
    setSaving(true);
    setErr("");
    setOkMsg("");

    try {
      // Require at least 1 service
      if (services.length === 0 && !selectedId) {
        setErr("Please add at least 1 service before finishing.");
        setSaving(false);
        return;
      }

      // If Stripe is already connected, finish onboarding now.
      const connect = await fetchStripeConnectStatus();
      if (connect?.connected) {
        const { error: doneErr } = await supabase
          .from("profiles")
          .update({ onboarding_step: "complete" })
          .eq("id", user.id);
        if (doneErr) throw doneErr;
        nav("/app", { replace: true });
        return;
      }

      // Otherwise move to payout onboarding step.
      const { error } = await supabase
        .from("profiles")
        .update({ onboarding_step: "payouts" })
        .eq("id", user.id);

      if (error) throw error;

      nav("/app/onboarding/payouts", { replace: true });
    } catch (e) {
      console.error("[OnboardingServices] payouts step error:", e);
      setErr("Couldn’t continue to payout setup. Try again.");
    } finally {
      setSaving(false);
    }
  }

  async function setAsCover(url) {
    if (!user || !selectedId) return;
    setCoverUrl(url);
    await supabase
      .from("services")
      .update({ image_url: url })
      .eq("id", selectedId)
      .eq("stylist_id", user.id);
  }

  function onPickFiles(e) {
    const files = Array.from(e.target.files || []);
    setNewFiles(files);
  }

  if (loading) return null;

  return (
    <div className="obPage page">
      <div className="bg" aria-hidden="true" />

      <header className="nav">
        <div className="navInner">
          <a className="brand" href="/app">
            <img className="logo" src="/assets/logo.png" alt="Glow’d Up Booking" />
            <div className="brandText">
              <div className="brandName">Glow’d Up Booking</div>
              <div className="brandTag">Onboarding</div>
            </div>
          </a>

          <div className="navCta">
            <button className="btn ghost" onClick={() => nav("/app/onboarding/social")}>
              Back
            </button>
          </div>
        </div>
      </header>

      <main className="container">
        <section className="heroPanel">
          <h1>Add your services</h1>
          <p className="heroMicro" style={{ marginTop: 6 }}>
            Add services clients can book. Upload photos for each service (these will display on your pro page).
          </p>
          <OnboardingProgress active="services" autosaveStatus={autosaveStatus} />

          {err ? <div style={{ marginTop: 12, opacity: 0.95 }}>{err}</div> : null}
          {okMsg ? <div style={{ marginTop: 12, opacity: 0.95 }}>{okMsg}</div> : null}

          <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 18, marginTop: 18 }}>
            {/* Left: list */}
            <div style={{ borderRadius: 16, padding: 14, background: "rgba(0,0,0,0.35)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <strong>Your services</strong>
                <button className="btn gold" onClick={startNewService}>
                  + New
                </button>
              </div>

              <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                {services.length === 0 ? (
                  <div style={{ opacity: 0.85 }}>No services yet. Add your first one.</div>
                ) : (
                  services.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => setSelectedId(s.id)}
                      className="btn ghost"
                      style={{
                        textAlign: "left",
                        padding: 12,
                        borderRadius: 14,
                        opacity: selectedId === s.id ? 1 : 0.85,
                        outline: selectedId === s.id ? "1px solid rgba(255,215,0,0.45)" : "none",
                      }}
                    >
                      <div style={{ fontWeight: 700 }}>{s.description}</div>
                      <div style={{ fontSize: 12, opacity: 0.8 }}>
                        ${s.price} · {s.duration_minutes} min
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* Right: form */}
            <div style={{ borderRadius: 16, padding: 14, background: "rgba(0,0,0,0.35)" }}>
              <strong>{selectedId ? "Edit service" : "New service"}</strong>

              <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
                <label style={{ display: "grid", gap: 6 }}>
                  <span style={{ fontSize: 12, opacity: 0.85 }}>Service name / description *</span>
                  <input
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="e.g., Haircut + Beard"
                    style={{ padding: 12, borderRadius: 12 }}
                  />
                </label>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <label style={{ display: "grid", gap: 6 }}>
                    <span style={{ fontSize: 12, opacity: 0.85 }}>Price (USD) *</span>
                    <input
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      placeholder="e.g., 45"
                      style={{ padding: 12, borderRadius: 12 }}
                    />
                  </label>

                  <label style={{ display: "grid", gap: 6 }}>
                    <span style={{ fontSize: 12, opacity: 0.85 }}>Duration (minutes) *</span>
                    <input
                      value={durationMinutes}
                      onChange={(e) => setDurationMinutes(e.target.value)}
                      placeholder="e.g., 30"
                      style={{ padding: 12, borderRadius: 12 }}
                    />
                  </label>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <label style={{ display: "grid", gap: 6 }}>
                    <span style={{ fontSize: 12, opacity: 0.85 }}>Category (optional)</span>
                    <input
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      placeholder="e.g., barber / nails / tattoo"
                      style={{ padding: 12, borderRadius: 12 }}
                    />
                  </label>

                  <label style={{ display: "grid", gap: 6 }}>
                    <span style={{ fontSize: 12, opacity: 0.85 }}>Deposit amount (optional)</span>
                    <input
                      value={depositAmount}
                      onChange={(e) => setDepositAmount(e.target.value)}
                      placeholder="e.g., 10"
                      style={{ padding: 12, borderRadius: 12 }}
                    />
                  </label>
                </div>

                <div style={{ marginTop: 6, display: "flex", gap: 10, alignItems: "center" }}>
                  <button className="btn gold" onClick={saveService} disabled={saving}>
                    {saving ? "Saving..." : "Save service"}
                  </button>
                  <div style={{ fontSize: 12, opacity: 0.8 }}>
                    Save first, then upload photos (or upload after save — both work).
                  </div>
                </div>

                {/* Photos */}
                <div style={{ marginTop: 14 }}>
                  <strong style={{ display: "block", marginBottom: 8 }}>Service photos</strong>

                  {!selectedId ? (
                    <div style={{ opacity: 0.85, fontSize: 13 }}>
                      Save the service first, then upload photos.
                    </div>
                  ) : (
                    <>
                      <input type="file" accept="image/*" multiple onChange={onPickFiles} />
                      {newFiles.length > 0 ? (
                        <div style={{ marginTop: 8, fontSize: 12, opacity: 0.85 }}>
                          Selected {newFiles.length} file(s). Click <b>Save service</b> to upload them.
                        </div>
                      ) : null}

                      {photos.length > 0 ? (
                        <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
                          {photos.map((p) => (
                            <div key={p.id} style={{ borderRadius: 14, overflow: "hidden", background: "rgba(255,255,255,0.05)" }}>
                              <img
                                src={p.url}
                                alt="service"
                                style={{ width: "100%", height: 120, objectFit: "cover", display: "block" }}
                              />
                              <div style={{ padding: 8, display: "flex", justifyContent: "space-between", gap: 8 }}>
                                <button className="btn ghost" style={{ padding: "8px 10px" }} onClick={() => setAsCover(p.url)}>
                                  Set cover
                                </button>
                                {coverUrl === p.url ? (
                                  <span style={{ fontSize: 12, opacity: 0.8, alignSelf: "center" }}>Cover</span>
                                ) : null}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div style={{ marginTop: 10, opacity: 0.85, fontSize: 13 }}>
                          No photos yet. Upload a few to make your service page look premium.
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* Finish */}
                <div style={{ marginTop: 16, display: "flex", gap: 10, justifyContent: "flex-end" }}>
                  <button className="btn ghost" onClick={() => nav("/app")}>
                    Skip for now
                  </button>
                  <button className="btn gold" onClick={continueToPayouts} disabled={saving}>
                    Continue to payouts
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
