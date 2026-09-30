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

  fetch("data/stats.json", { cache: "no-store" }).then((r) => r.json()).then((d) => {
    const speeches = Object.values(d.people || {}).reduce((a, p) => a + (p.n_rounds || 0), 0);
    $("#heroMeta").textContent =
      `${d.n_tournaments_scanned} torneos escaneados · ${speeches} discursos analizados · 0 permisos pedidos`;
  }).catch(() => {});

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
