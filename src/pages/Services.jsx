import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppShell from "../components/layout/AppShell";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import { supabase } from "../lib/supabase";

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
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export default function Services() {
  const nav = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [user, setUser] = useState(null);

  const [services, setServices] = useState([]);
  const [selectedId, setSelectedId] = useState(null);

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

  const [photos, setPhotos] = useState([]);
  const [newFiles, setNewFiles] = useState([]);
  const [err, setErr] = useState("");
  const [okMsg, setOkMsg] = useState("");

  async function loadServices(userId) {
    const { data: svc, error: svcErr } = await supabase
      .from("services")
      .select("id, stylist_id, description, price, duration_minutes, category, image_url, deposit_amount, created_at")
      .eq("stylist_id", userId)
      .order("created_at", { ascending: false });

    if (svcErr) {
      console.error("[Services] services error:", svcErr);
      setErr("Couldn’t load services.");
      setServices([]);
      return;
    }

    setServices(svc ?? []);
    setSelectedId((prev) => {
      const hasPrev = (svc ?? []).some((s) => s.id === prev);
      if (hasPrev) return prev;
      return (svc ?? [])[0]?.id ?? null;
    });
  }

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setErr("");

      const { data: authRes, error: authErr } = await supabase.auth.getUser();
      const u = authRes?.user ?? null;

      if (authErr || !u) {
        nav("/login", { replace: true });
        return;
      }

      if (!mounted) return;
      setUser(u);

      await loadServices(u.id);
      if (!mounted) return;
      setLoading(false);
    })();

    return () => {
      mounted = false;
    };
  }, [nav]);

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
        console.error("[Services] service_photos error:", phErr);
        setPhotos([]);
      } else {
        setPhotos(ph ?? []);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [selected?.id]); // eslint-disable-line react-hooks/exhaustive-deps

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
    setOkMsg("");
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
        console.warn("[Services] full payload save failed, retrying with compatibility payload", firstErr);
        try {
          saved = await persistService(payloadNoOptional);
        } catch (secondErr) {
          console.warn("[Services] compatibility payload save failed, retrying with legacy-safe payload", secondErr);
          saved = await persistService(payloadLegacySafe);
        }
      }

      await loadServices(user.id);
      setSelectedId(saved.id);

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
            console.error("[Services] upload error:", upErr);
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

        const { error: insErr } = await supabase.from("service_photos").insert(insertedRows);
        if (insErr) {
          console.error("[Services] insert service_photos error:", insErr);
          throw new Error("Couldn’t save photo records.");
        }

        const coverCandidate = coverUrl?.trim() ? null : insertedRows[0]?.url;
        if (coverCandidate) {
          await supabase
            .from("services")
            .update({ image_url: coverCandidate })
            .eq("id", saved.id)
            .eq("stylist_id", user.id);
          setCoverUrl(coverCandidate);
        }

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
    } catch (e) {
      console.error("[Services] save error:", e);
      setErr(e?.message || "Something went wrong saving this service.");
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

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  if (loading) {
    return (
      <AppShell title="Services" onSignOut={signOut}>
        <Card>Loading services…</Card>
      </AppShell>
    );
  }

  return (
    <AppShell title="Services" onSignOut={signOut}>
      <div className="g-page">
        <h1 className="g-h1">Manage Services</h1>
        <Card>
          <div className="u-muted">
            Add services clients can book. Upload photos and set deposits for each service.
          </div>

          {err ? <div style={{ marginTop: 12 }}>{err}</div> : null}
          {okMsg ? <div style={{ marginTop: 12 }}>{okMsg}</div> : null}

          <div className="sv-grid">
            <div className="sv-panel">
              <div className="sv-head">
                <strong>Your services</strong>
                <Button variant="primary" onClick={startNewService}>
                  + New
                </Button>
              </div>

              <div className="sv-list">
                {services.length === 0 ? (
                  <div className="u-muted">No services yet. Add your first one.</div>
                ) : (
                  services.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => setSelectedId(s.id)}
                      className={`sv-item ${selectedId === s.id ? "sv-itemActive" : ""}`}
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

            <div className="sv-panel">
              <strong>{selectedId ? "Edit service" : "New service"}</strong>

              <div className="sv-formGrid">
                <label className="sv-label">
                  <span>Service name / description *</span>
                  <input
                    className="sv-input"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="e.g., Haircut + Beard"
                  />
                </label>

                <div className="sv-twoCol">
                  <label className="sv-label">
                    <span>Price (USD) *</span>
                    <input
                      className="sv-input"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      placeholder="e.g., 45"
                    />
                  </label>
                  <label className="sv-label">
                    <span>Duration (minutes) *</span>
                    <input
                      className="sv-input"
                      value={durationMinutes}
                      onChange={(e) => setDurationMinutes(e.target.value)}
                      placeholder="e.g., 30"
                    />
                  </label>
                </div>

                <div className="sv-twoCol">
                  <label className="sv-label">
                    <span>Category (optional)</span>
                    <input
                      className="sv-input"
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      placeholder="e.g., barber / nails / tattoo"
                    />
                  </label>
                  <label className="sv-label">
                    <span>Deposit amount (optional)</span>
                    <input
                      className="sv-input"
                      value={depositAmount}
                      onChange={(e) => setDepositAmount(e.target.value)}
                      placeholder="e.g., 10"
                    />
                  </label>
                </div>

                <div style={{ marginTop: 6, display: "flex", gap: 10, alignItems: "center" }}>
                  <Button variant="primary" onClick={saveService} disabled={saving}>
                    {saving ? "Saving..." : "Save service"}
                  </Button>
                  <div style={{ fontSize: 12, opacity: 0.8 }}>
                    Save first, then upload photos (or upload after save).
                  </div>
                </div>

                <div style={{ marginTop: 10 }}>
                  <strong style={{ display: "block", marginBottom: 8 }}>Service photos</strong>

                  {!selectedId ? (
                    <div className="u-muted">Save the service first, then upload photos.</div>
                  ) : (
                    <>
                      <input type="file" accept="image/*" multiple onChange={onPickFiles} />
                      {newFiles.length > 0 ? (
                        <div style={{ marginTop: 8, fontSize: 12, opacity: 0.85 }}>
                          Selected {newFiles.length} file(s). Click <b>Save service</b> to upload.
                        </div>
                      ) : null}

                      {photos.length > 0 ? (
                        <div className="sv-photoGrid">
                          {photos.map((p) => (
                            <div key={p.id} className="sv-photoCard">
                              <img src={p.url} alt="service" className="sv-photoImg" />
                              <div className="sv-photoActions">
                                <Button variant="outline" onClick={() => setAsCover(p.url)}>
                                  Set cover
                                </Button>
                                {coverUrl === p.url ? (
                                  <span style={{ fontSize: 12, opacity: 0.8, alignSelf: "center" }}>Cover</span>
                                ) : null}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div style={{ marginTop: 10 }} className="u-muted">
                          No photos yet. Upload a few to make your service page look premium.
                        </div>
                      )}
                    </>
                  )}
                </div>

                <div style={{ marginTop: 16, display: "flex", gap: 10, justifyContent: "flex-end" }}>
                  <Button variant="outline" onClick={() => nav("/app")}>
                    Back to dashboard
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}

