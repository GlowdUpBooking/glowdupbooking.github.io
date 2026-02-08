let ALL_PROS = [];
let visibleCount = 6;

const grid = document.getElementById("proGrid");
const loadMoreBtn = document.getElementById("loadMoreBtn");
const yearEl = document.getElementById("year");
const toast = document.getElementById("toast");

const serviceFilter = document.getElementById("serviceFilter");
const cityFilter = document.getElementById("cityFilter");
const searchBtn = document.getElementById("searchBtn");
const chipRow = document.getElementById("chipRow");

const hamburger = document.getElementById("hamburger");
const mobileMenu = document.getElementById("mobileMenu");

function showToast(msg){
  toast.textContent = msg;
  toast.style.display = "block";
  setTimeout(() => (toast.style.display = "none"), 2200);
}

function matchesFilters(p){
  const svc = (serviceFilter?.value || "all").toLowerCase();
  const city = (cityFilter?.value || "").trim().toLowerCase();

  const svcOk = svc === "all" ? true : (p.category || "").toLowerCase() === svc;
  const cityOk = !city ? true : (p.city || "").toLowerCase().includes(city);

  return svcOk && cityOk;
}

function filteredPros(){
  return ALL_PROS.filter(matchesFilters);
}

function cardHTML(p){
  const badge = p.badge || "New";
  const price = p.starting_price ? `$${p.starting_price}` : "$—";
  const duration = p.duration ? `${p.duration} min` : "—";
  const city = p.city || "—";
  const category = p.category || "—";
  const name = p.name || "Professional";
  const image = p.image || "assets/pro-1.jpg";

  return `
    <article class="card">
      <div class="card__img">
        <img src="${image}" alt="${name} ${category} in ${city}" loading="lazy" />
        <div class="card__badge">${badge}</div>
      </div>
      <div class="card__body">
        <div class="card__title">${name}</div>
        <div class="card__meta">
          <span>${category}</span>
          <span>•</span>
          <span>${city}</span>
          <span>•</span>
          <span>${duration}</span>
        </div>
        <div class="card__row">
          <div class="price">${price}</div>
          <button class="card__btn" data-pro="${encodeURIComponent(name)}">Book</button>
        </div>
      </div>
    </article>
  `;
}

function render(){
  const list = filteredPros();
  const slice = list.slice(0, visibleCount);

  grid.innerHTML = slice.map(cardHTML).join("");

  // Load more visibility
  loadMoreBtn.style.display = list.length > visibleCount ? "inline-flex" : "none";

  // Demo booking button
  grid.querySelectorAll(".card__btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const pro = decodeURIComponent(btn.getAttribute("data-pro") || "");
      showToast(`Booking preview coming soon — selected: ${pro}`);
    });
  });
}

function setChipActive(value){
  document.querySelectorAll(".chip").forEach(c => c.classList.remove("is-active"));
  const target = document.querySelector(`.chip[data-chip="${value}"]`);
  if (target) target.classList.add("is-active");
}

function initChips(){
  if (!chipRow) return;
  chipRow.addEventListener("click", (e) => {
    const btn = e.target.closest(".chip");
    if (!btn) return;
    const v = btn.getAttribute("data-chip");
    setChipActive(v);
    serviceFilter.value = v === "all" ? "all" : v;
    visibleCount = 6;
    render();
  });
}

async function loadPros(){
  try{
    const res = await fetch("data/pros.json", { cache: "no-store" });
    ALL_PROS = await res.json();
  }catch(err){
    ALL_PROS = [];
    console.error(err);
  }
  render();
}

function init(){
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  initChips();

  loadMoreBtn?.addEventListener("click", () => {
    visibleCount += 6;
    render();
  });

  searchBtn?.addEventListener("click", () => {
    visibleCount = 6;
    render();
  });

  serviceFilter?.addEventListener("change", () => {
    const v = serviceFilter.value;
    setChipActive(v === "all" ? "all" : serviceFilter.options[serviceFilter.selectedIndex].text);
    visibleCount = 6;
    render();
  });

  cityFilter?.addEventListener("keydown", (e) => {
    if (e.key === "Enter"){
      visibleCount = 6;
      render();
    }
  });

  const joinBtn = document.getElementById("joinBtn");
  const emailInput = document.getElementById("emailInput");
  joinBtn?.addEventListener("click", () => {
    const email = (emailInput?.value || "").trim();
    if (!email) return showToast("Enter your email to join the waitlist.");
    showToast("✅ Added to waitlist (demo).");
    if (emailInput) emailInput.value = "";
  });

  hamburger?.addEventListener("click", () => {
    mobileMenu.classList.toggle("is-open");
  });

  loadPros();
}

init();