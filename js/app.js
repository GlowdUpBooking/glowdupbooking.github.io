const state = {
  pros: [],
  filtered: [],
  activeCategory: "All",
};

const categories = ["All","Hair","Barber","Braiding","Nails","Tattoo","Skincare","Makeup","Lashes","Massage"];

const els = {
  grid: document.getElementById("prosGrid"),
  chips: document.getElementById("categoryChips"),
  search: document.getElementById("searchInput"),
  year: document.getElementById("year"),
  modal: document.getElementById("modal"),
  modalTitle: document.getElementById("modalTitle"),
  modalBody: document.getElementById("modalBody"),
};

function escapeHtml(str=""){
  return str.replace(/[&<>"']/g, (m) => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[m]));
}

function openModal(title, html){
  els.modalTitle.textContent = title;
  els.modalBody.innerHTML = html;
  els.modal.classList.add("show");
}
function closeModal(){
  els.modal.classList.remove("show");
}
document.addEventListener("click", (e) => {
  if (e.target?.dataset?.close) closeModal();
});

function renderChips(){
  els.chips.innerHTML = categories.map(c => {
    const active = c === state.activeCategory ? "active" : "";
    return `<button class="chip ${active}" data-chip="${c}">${c}</button>`;
  }).join("");
}

function applyFilters(){
  const q = (els.search.value || "").trim().toLowerCase();
  state.filtered = state.pros.filter(p => {
    const catOk = state.activeCategory === "All" || (p.category || "").toLowerCase() === state.activeCategory.toLowerCase();
    const qOk = !q || `${p.business_name} ${p.full_name} ${p.category} ${p.city} ${p.zip}`.toLowerCase().includes(q);
    return catOk && qOk;
  });
  renderPros();
}

function proCard(p){
  const img = p.image || "./assets/pro-1.jpg";
  const name = escapeHtml(p.business_name || p.full_name || "Professional");
  const meta = escapeHtml(`${p.category || "Service"} • ${p.city || "Near you"}${p.zip ? " • " + p.zip : ""}`);
  const badge = p.badge ? escapeHtml(p.badge) : "Available";

  return `
    <article class="pro">
      <img class="pro__img" src="${img}" alt="${name}" loading="lazy" />
      <div class="pro__body">
        <div class="pro__top">
          <div class="pro__name">${name}</div>
          <span class="badge">${badge}</span>
        </div>
        <div class="pro__meta">${meta}</div>
        <div class="pro__cta">
          <button class="btn btn--gold btn--sm" data-book="${escapeHtml(p.id)}">Book</button>
          <button class="btn btn--ghost btn--sm" data-view="${escapeHtml(p.id)}">View</button>
        </div>
      </div>
    </article>
  `;
}

function renderPros(){
  const list = state.filtered.length ? state.filtered : state.pros;
  if (!list.length){
    els.grid.innerHTML = `<div class="muted">No pros found. Try another search.</div>`;
    return;
  }
  els.grid.innerHTML = list.map(proCard).join("");
}

async function loadPros(){
  const res = await fetch("./data/pros.json", { cache: "no-store" });
  const data = await res.json();
  // Expecting array
  state.pros = Array.isArray(data) ? data : (data.pros || []);
  state.filtered = state.pros.slice();
  renderPros();
}

function setupEvents(){
  els.chips.addEventListener("click", (e) => {
    const c = e.target?.dataset?.chip;
    if (!c) return;
    state.activeCategory = c;
    renderChips();
    applyFilters();
  });

  document.getElementById("searchBtn").addEventListener("click", applyFilters);
  els.search.addEventListener("input", applyFilters);

  // CTA + Book buttons
  const bookBtns = ["openBook","openBook2","ctaBook","clientsBook"];
  bookBtns.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("click", () => openBookModal());
  });

  document.getElementById("ctaPros").addEventListener("click", () => openWaitlistModal(true));
  document.getElementById("prosWaitlist").addEventListener("click", () => openWaitlistModal(true));
  document.getElementById("openWaitlist").addEventListener("click", () => openWaitlistModal(false));

  // Card actions
  els.grid.addEventListener("click", (e) => {
    const bookId = e.target?.dataset?.book;
    const viewId = e.target?.dataset?.view;

    if (bookId){
      const p = state.pros.find(x => x.id === bookId);
      openBookModal(p);
    }
    if (viewId){
      const p = state.pros.find(x => x.id === viewId);
      openModal("Preview profile", `
        <div style="display:flex; gap:12px; align-items:flex-start; flex-wrap:wrap">
          <img src="${p?.image || "./assets/pro-1.jpg"}" style="width:140px;height:140px;object-fit:cover;border-radius:14px;border:1px solid rgba(255,255,255,.12)" />
          <div>
            <div style="font-weight:800; font-size:16px">${escapeHtml(p?.business_name || p?.full_name || "Professional")}</div>
            <div class="muted" style="margin-top:6px">${escapeHtml((p?.category || "Service") + " • " + (p?.city || "Near you"))}</div>
            <div style="margin-top:12px; display:flex; gap:10px">
              <button class="btn btn--gold btn--sm" onclick="document.querySelector('[data-close]').click();">Book</button>
              <button class="btn btn--ghost btn--sm" data-close="1">Close</button>
            </div>
          </div>
        </div>
        <div class="muted" style="margin-top:14px">
          (Web booking flow comes next. For now this is a premium preview like Booksy.)
        </div>
      `);
    }
  });
}

function openBookModal(pro){
  const name = escapeHtml(pro?.business_name || "Glow’d Up Booking");
  openModal("Book now", `
    <div><strong>${name}</strong></div>
    <div class="muted" style="margin-top:6px">
      This is the web booking preview. Next step: connect to Supabase to show real services & times.
    </div>
    <div style="margin-top:14px; display:flex; gap:10px; flex-wrap:wrap">
      <a class="btn btn--gold btn--sm" href="mailto:glowdupbooking@gmail.com?subject=Book%20request&body=Hi%2C%20I%20want%20to%20book%20${encodeURIComponent(name)}">Request booking</a>
      <button class="btn btn--ghost btn--sm" data-close="1">Close</button>
    </div>
  `);
}

function openWaitlistModal(proOnly){
  const title = proOnly ? "Join pro waitlist" : "Join waitlist";
  openModal(title, `
    <div class="muted">Drop your email and we’ll send early access when web booking goes live.</div>
    <form id="wlForm" style="margin-top:12px; display:flex; gap:10px; flex-wrap:wrap">
      <input id="wlEmail" type="email" required placeholder="you@email.com"
        style="flex:1; min-width:220px; padding:12px 14px; border-radius:12px; border:1px solid rgba(255,255,255,.14); background:rgba(255,255,255,.06); color:#fff; outline:none;">
      <button class="btn btn--gold" type="submit">Join</button>
      <button class="btn btn--ghost" type="button" data-close="1">Cancel</button>
    </form>
    <div class="muted" style="margin-top:10px; font-size:12px">We’ll replace this with a real waitlist backend next.</div>
  `);

  const form = document.getElementById("wlForm");
  form?.addEventListener("submit", (e) => {
    e.preventDefault();
    const email = document.getElementById("wlEmail").value.trim();
    openModal("You’re in ✅", `
      <div>Saved: <strong>${escapeHtml(email)}</strong></div>
      <div class="muted" style="margin-top:8px">(Next: wire to Supabase table / Mailchimp.)</div>
      <div style="margin-top:14px"><button class="btn btn--gold" data-close="1">Done</button></div>
    `);
  });
}

(async function init(){
  els.year.textContent = new Date().getFullYear();
  renderChips();
  setupEvents();
  await loadPros();
})();