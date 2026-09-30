/* Portada BPringaos */
(function () {
  "use strict";
  const $ = (s) => document.querySelector(s);
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

  const hideLoader = () => $("#loader").classList.add("done");
  if (document.readyState === "complete") setTimeout(hideLoader, 400);
  else addEventListener("load", () => setTimeout(hideLoader, 400));
  setTimeout(hideLoader, 2500);

  const TYPE_LINES = [
    "Estadísticas de debate que nadie pidió.",
    "Elige a tu luchador y cruza el portal.",
    "*eructo* ...la media no perdona, Morty.",
    "20 años de terapia o 20 métricas de speaks. Elegimos esto.",
    "Bienvenido a la dimensión BP-137.",
  ];
  (function typewriter() {
    const el = $("#typewriter");
    if (!el) return;
    if (reduced) { el.textContent = TYPE_LINES[0]; return; }
    let li = 0, ci = 0, del = false;
    (function tick() {
      const line = TYPE_LINES[li];
      el.textContent = line.slice(0, ci);
      if (!del && ci < line.length) { ci++; setTimeout(tick, 38); }
      else if (!del) { del = true; setTimeout(tick, 2100); }
      else if (ci > 0) { ci--; setTimeout(tick, 14); }
      else { del = false; li = (li + 1) % TYPE_LINES.length; setTimeout(tick, 350); }
    })();
  })();

  const HUES = ["#ff7a1a", "#97ce4c", "#f0b429", "#e8620c", "#5fa32b", "#ffa04d"];
  fetch("data/stats.json", { cache: "no-store" }).then((r) => r.json()).then((d) => {
    const np = d.n_people || Object.keys(d.people || {}).length;
    $("#heroMeta").textContent =
      `${d.n_tournaments_scanned} torneos escaneados · ${np} pringaos fichados · 0 permisos pedidos`;

    // construir la lista del menú
    const list = $("#menuList");
    // orden: por número de torneos participados (desc), desempate por discursos
    const people = Object.entries(d.people || {}).sort((a, b) =>
      (b[1].n_tournaments || 0) - (a[1].n_tournaments || 0) ||
      (b[1].n_rounds || 0) - (a[1].n_rounds || 0));
    people.forEach(([key, p], i) => {
      const a = document.createElement("a");
      a.className = "menu-row";
      a.href = `stats.html?p=${key}`;
      a.style.setProperty("--pc", HUES[i % HUES.length]);
      a.style.transitionDelay = `${80 + i * 70}ms`;
      a.dataset.search = (p.display || key).toLowerCase();
      a.innerHTML = `
        <span class="menu-num">${String(i + 1).padStart(2, "0")}</span>
        <span class="menu-name">${p.display || key}</span>
        <span class="menu-meta">${p.n_tournaments || 0} torneos · ${p.n_rounds || 0} discursos · ${p.avg_speaks != null ? p.avg_speaks + " spk" : "sin datos"}</span>
        <span class="menu-go">→</span>`;
      list.appendChild(a);
    });
    if (people.length < 9) $("#menuSearch").style.display = "none";
  }).catch(() => {});

  // ---------- menú hamburguesa ----------
  const burger = $("#burger"), menu = $("#menu");
  let menuOpen = false;
  function setMenu(open) {
    menuOpen = open;
    burger.classList.toggle("open", open);
    burger.setAttribute("aria-expanded", open);
    menu.classList.toggle("open", open);
    menu.setAttribute("aria-hidden", !open);
    document.body.style.overflow = open ? "hidden" : "";
    if (open) setTimeout(() => $("#menuSearch")?.focus({ preventScroll: true }), 400);
  }
  burger.addEventListener("click", () => setMenu(!menuOpen));
  $("#openMenuBtn")?.addEventListener("click", () => setMenu(true));
  addEventListener("keydown", (e) => { if (e.key === "Escape" && menuOpen) setMenu(false); });
  $("#menuSearch")?.addEventListener("input", (e) => {
    const q = e.target.value.trim().toLowerCase();
    document.querySelectorAll(".menu-row").forEach((r) =>
      r.classList.toggle("hidden", q && !r.dataset.search.includes(q)));
  });

  // portal de partículas
  const cv = $("#portalCanvas");
  if (!cv || reduced) return;
  const ctx = cv.getContext("2d");
  let W, H, t = 0;
  const parts = [];
  function resize() {
    W = cv.width = cv.offsetWidth * devicePixelRatio;
    H = cv.height = cv.offsetHeight * devicePixelRatio;
  }
  resize(); addEventListener("resize", resize);
  for (let i = 0; i < 130; i++) parts.push({
    a: Math.random() * Math.PI * 2,
    r: 0.12 + Math.random() * 0.42,
    sp: 0.002 + Math.random() * 0.006,
    sz: (0.6 + Math.random() * 2.2) * devicePixelRatio,
    hue: Math.random() < 0.82 ? "232,98,12" : "151,206,76",
    wob: Math.random() * Math.PI * 2,
  });
  (function draw() {
    ctx.clearRect(0, 0, W, H);
    const cx = W / 2, cy = H * 0.36, base = Math.min(W, H);
    t += 1;
    for (const p of parts) {
      p.a += p.sp;
      const wob = Math.sin(t * 0.02 + p.wob) * 0.03;
      const r = (p.r + wob) * base;
      const x = cx + Math.cos(p.a) * r * 1.25;
      const y = cy + Math.sin(p.a) * r * 0.55;
      const alpha = 0.12 + 0.5 * (0.5 + 0.5 * Math.sin(p.a * 3 + t * 0.01));
      ctx.beginPath();
      ctx.fillStyle = `rgba(${p.hue},${alpha})`;
      ctx.arc(x, y, p.sz, 0, Math.PI * 2);
      ctx.fill();
    }
    requestAnimationFrame(draw);
  })();
})();
