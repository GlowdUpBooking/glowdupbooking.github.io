// ------------------ Recommended carousel data (demo; next we’ll load from data/pros.json) ------------------
const imagePool = [
  "assets/pro-1.jpg",
  "assets/pro-2.jpg",
  "assets/pro-3.jpg",
  "assets/model6.png"
];

const recs = [
  { name: "Sarah", city: "Dallas, TX", badge: "Highly rated", img: imagePool[0] },
  { name: "Jelmes", city: "Dallas, TX", badge: "Barber • Fade", img: imagePool[1] },
  { name: "James", city: "Dallas, TX", badge: "Barber • Beard", img: imagePool[2] },
  { name: "Luxury Nails Studio", city: "Houston, TX", badge: "Nails • Gel", img: imagePool[3] },
  { name: "Skincare", city: "Austin, TX", badge: "Facials • Glow", img: imagePool[0] },
  { name: "Makeup Pro", city: "Dallas, TX", badge: "Makeup • Glam", img: imagePool[3] },
];

const track = document.getElementById("track");
const dotsEl = document.getElementById("dots");
const prev = document.getElementById("prev");
const next = document.getElementById("next");

function cardTemplate(item){
  return `
    <article class="card">
      <div class="card__img" style="background-image:url('${item.img}')"></div>
      <div class="card__body">
        <div class="card__name">${item.name}</div>
        <div class="card__meta">${item.city}</div>
        <div class="card__row">
          <span class="badge">${item.badge}</span>
          <button class="card__book" type="button">Book</button>
        </div>
      </div>
    </article>
  `;
}

track.innerHTML = recs.map(cardTemplate).join("");

let index = 0;

const visible = () => {
  const w = window.innerWidth;
  if (w < 600) return 1;
  if (w < 900) return 2;
  if (w < 1200) return 3;
  return 4;
};

function pages(){
  return Math.max(1, Math.ceil(recs.length / visible()));
}

function renderDots(){
  dotsEl.innerHTML = "";
  for (let i = 0; i < pages(); i++){
    const b = document.createElement("button");
    b.className = "dot" + (i === index ? " is-active" : "");
    b.addEventListener("click", () => { index = i; snap(); });
    dotsEl.appendChild(b);
  }
}

function snap(){
  const card = track.querySelector(".card");
  if (!card) return;
  const gap = 14;
  const cardW = card.getBoundingClientRect().width;
  const shift = index * (visible() * (cardW + gap));
  track.scrollTo({ left: shift, behavior: "smooth" });

  [...dotsEl.children].forEach((d,i)=> d.classList.toggle("is-active", i === index));
}

prev.addEventListener("click", () => { index = Math.max(0, index - 1); snap(); });
next.addEventListener("click", () => { index = Math.min(pages() - 1, index + 1); snap(); });

window.addEventListener("resize", () => {
  index = Math.min(index, pages() - 1);
  renderDots();
  snap();
});

renderDots();
snap();

// ------------------ Category chip state (visual only for now) ------------------
document.querySelectorAll(".chip").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".chip").forEach(b => b.classList.remove("is-active"));
    btn.classList.add("is-active");
  });
});

// ------------------ Search button (visual only for now) ------------------
document.getElementById("searchBtn").addEventListener("click", () => {
  const q = document.getElementById("q").value.trim();
  const loc = document.getElementById("loc").value;
  const when = document.getElementById("when").value.trim();
  console.log("Search:", { q, loc, when });
});

// ------------------ Sparkles / luxury dust ---------- */
(function sparkles(){
  const canvas = document.getElementById("sparkles");
  const ctx = canvas.getContext("2d");

  const resize = () => {
    canvas.width = Math.floor(window.innerWidth * devicePixelRatio);
    canvas.height = Math.floor(window.innerHeight * devicePixelRatio);
  };
  resize();
  window.addEventListener("resize", resize);

  const rand = (a,b) => a + Math.random()*(b-a);

  const dots = Array.from({length: 110}).map(() => ({
    x: rand(0, canvas.width),
    y: rand(0, canvas.height),
    r: rand(0.9, 2.3) * devicePixelRatio,
    vx: rand(-0.09, 0.09) * devicePixelRatio,
    vy: rand(-0.06, 0.11) * devicePixelRatio,
    a: rand(0.05, 0.22),
    gold: Math.random() < 0.7
  }));

  function tick(){
    ctx.clearRect(0,0,canvas.width,canvas.height);

    for (const p of dots){
      p.x += p.vx;
      p.y += p.vy;

      if (p.x < -60) p.x = canvas.width + 60;
      if (p.x > canvas.width + 60) p.x = -60;
      if (p.y < -60) p.y = canvas.height + 60;
      if (p.y > canvas.height + 60) p.y = -60;

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = p.gold
        ? `rgba(216, 180, 106, ${p.a})`
        : `rgba(200, 190, 255, ${p.a * 0.9})`;
      ctx.fill();
    }

    requestAnimationFrame(tick);
  }
  tick();
})();