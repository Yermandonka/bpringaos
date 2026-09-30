/* BPringaos — motor de la web. Carga data/stats.json y pinta todo. */
(async function () {
  "use strict";

  const COLORS = { german: "#e8620c", lucia: "#5fa32b" };
  const UI = { german: "#ff7a1a", lucia: "#97ce4c" };
  const ORD = { 3: "#f08326", 2: "#cf6410", 1: "#a1500e", 0: "#7a4012" };
  const POS_LABEL = { 3: "Primeros", 2: "Segundos", 1: "Terceros", 0: "Cuartos" };
  const SIDE = { og: "Alta Gobierno", oo: "Alta Oposición", cg: "Baja Gobierno", co: "Baja Oposición" };
  const NAMES = { german: "Germán", lucia: "Lucía" };

  const QUIPS = {
    german: [
      "Sujeto de pruebas nº1. En infinitas dimensiones hay infinitos Germanes; este es el que os ha tocado.",
      "Los datos no mienten. Germán a veces sí, pero es parte de su encanto retórico.",
    ],
    lucia: [
      "Sujeto de pruebas nº2. Científicamente comprobado: no es una versión de Germán de otra dimensión.",
      "Advertencia del Consejo: sus refutaciones pueden abrir portales.",
    ],
  };
  const TYPE_LINES = [
    "Estadísticas de debate que nadie pidió.",
    "Con la energía de un microondas y la precisión de un tab.",
    "20 años de terapia o 20 métricas de speaks. Elegimos esto.",
    "*eructo* ...la media no perdona, Morty.",
    "Bienvenido a la dimensión BP-137.",
  ];

  // ---------- carga de datos ----------
  let DATA;
  try {
    DATA = await (await fetch("data/stats.json", { cache: "no-store" })).json();
  } catch (e) {
    document.getElementById("loader").querySelector(".loader-txt").textContent =
      "El portal ha fallado. Recarga, o acepta que vives en la dimensión sin datos.";
    throw e;
  }

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const fmt = (v, d = 2) => (v == null ? "—" : (+v).toFixed(d).replace(/\.?0+$/, ""));
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

  let person = "german";
  const P = () => DATA.people[person];

  // ---------- preloader ----------
  const hideLoader = () => $("#loader").classList.add("done");
  if (document.readyState === "complete") setTimeout(hideLoader, 400);
  else addEventListener("load", () => setTimeout(hideLoader, 400));
  setTimeout(hideLoader, 2500); // por si acaso

  // ---------- barra scroll + nav ----------
  addEventListener("scroll", () => {
    const h = document.documentElement;
    $("#scrollbar").style.width = (h.scrollTop / (h.scrollHeight - h.clientHeight)) * 100 + "%";
    $("#topnav").classList.toggle("scrolled", h.scrollTop > 40);
  }, { passive: true });

  // ---------- typewriter ----------
  (function typewriter() {
    const el = $("#typewriter");
    let li = 0, ci = 0, del = false;
    if (reduced) { el.textContent = TYPE_LINES[0]; return; }
    (function tick() {
      const line = TYPE_LINES[li];
      el.textContent = line.slice(0, ci);
      if (!del && ci < line.length) { ci++; setTimeout(tick, 38); }
      else if (!del) { del = true; setTimeout(tick, 2100); }
      else if (ci > 0) { ci--; setTimeout(tick, 14); }
      else { del = false; li = (li + 1) % TYPE_LINES.length; setTimeout(tick, 350); }
    })();
  })();

  // ---------- canvas portal hero ----------
  (function portal() {
    const cv = $("#portalCanvas"), ctx = cv.getContext("2d");
    let W, H, parts = [], t = 0;
    const N = reduced ? 0 : 130;
    function resize() {
      W = cv.width = cv.offsetWidth * devicePixelRatio;
      H = cv.height = cv.offsetHeight * devicePixelRatio;
    }
    resize(); addEventListener("resize", resize);
    for (let i = 0; i < N; i++) parts.push({
      a: Math.random() * Math.PI * 2,
      r: 0.12 + Math.random() * 0.42,
      sp: 0.002 + Math.random() * 0.006,
      sz: (0.6 + Math.random() * 2.2) * devicePixelRatio,
      hue: Math.random() < 0.82 ? "232,98,12" : "151,206,76",
      wob: Math.random() * Math.PI * 2,
    });
    (function draw() {
      if (!N) return;
      ctx.clearRect(0, 0, W, H);
      const cx = W / 2, cy = H * 0.44, base = Math.min(W, H);
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

  // ---------- tooltip ----------
  const tip = $("#tooltip");
  function showTip(html, x, y) {
    tip.innerHTML = html;
    tip.classList.add("show");
    const w = tip.offsetWidth, sw = innerWidth;
    tip.style.left = Math.min(Math.max(8, x - w / 2), sw - w - 8) + "px";
    tip.style.top = (y - tip.offsetHeight - 14) + "px";
  }
  function hideTip() { tip.classList.remove("show"); }

  // ---------- reveal genérico ----------
  const io = new IntersectionObserver((es) => {
    es.forEach((e) => {
      if (e.isIntersecting) {
        e.target.classList.add("in");
        (e.target._onin || []).forEach((f) => f());
        io.unobserve(e.target);
      }
    });
  }, { threshold: 0.18 });
  function observe(el, fn) {
    if (fn) (el._onin = el._onin || []).push(fn);
    io.observe(el);
  }
  $$(".reveal").forEach((el) => observe(el));

  // ---------- contador animado ----------
  function countUp(el, target, decimals = 0, suffix = "") {
    if (reduced || target == null) { el.textContent = fmt(target, decimals) + suffix; return; }
    const dur = 1300, t0 = performance.now();
    (function step(now) {
      const k = Math.min(1, (now - t0) / dur);
      const ease = 1 - Math.pow(1 - k, 3);
      el.textContent = (target * ease).toFixed(decimals) + suffix;
      if (k < 1) requestAnimationFrame(step);
      else el.textContent = fmt(target, decimals) + suffix;
    })(t0);
  }

  // ---------- hero meta ----------
  $("#heroMeta").textContent =
    `${DATA.n_tournaments_scanned} torneos escaneados · ${Object.values(DATA.people).reduce((a, p) => a + (p.n_rounds || 0), 0)} discursos analizados · 0 permisos pedidos`;
  $("#footMeta").textContent = `${DATA.n_tournaments_scanned} torneos indexados`;

  // ================= RENDER PRINCIPAL =================
  function renderAll() {
    document.body.dataset.person = person;
    $("#selectorQuip").textContent = QUIPS[person][Math.floor(Math.random() * QUIPS[person].length)];
    renderTiles(); renderEvo(); renderRoom(); renderPos();
    renderResults(); renderTopics(); renderExtremes(); renderMates(); renderTours();
  }

  // ---------- 1. tiles ----------
  function renderTiles() {
    const p = P(), c = $("#tiles");
    c.innerHTML = "";
    if (!p || !p.n_rounds) {
      c.innerHTML = `<div class="tile in"><div class="tile-label">houston</div>
        <div class="tile-value">0</div>
        <div class="tile-quip">Aún no hay rastro de ${NAMES[person]} en los tabs escaneados. O usa un alias muy bueno, o esta es la dimensión donde no debate.</div></div>`;
      return;
    }
    const posBest = p.pos1?.avg != null && p.pos2?.avg != null ? (p.pos1.avg > p.pos2.avg ? "1º" : "2º") : "—";
    const bestSide = Object.entries(p.sides || {}).filter(([, v]) => v.avg_points != null)
      .sort((a, b) => b[1].avg_points - a[1].avg_points)[0];
    const bestTopic = Object.entries(p.topics || {}).filter(([, v]) => v.avg_points != null && v.n >= 2)
      .sort((a, b) => b[1].avg_points - a[1].avg_points)[0];
    const tiles = [
      ["Media de speaks", p.avg_speaks, 2, "", "El número que defines como «injusto» en la cena de después."],
      ["Media de puntos", p.avg_points, 2, "", "De 0 a 3. Como las estrellas Michelin pero con más llanto."],
      ["Discursos analizados", p.n_rounds, 0, "", "Cada uno guardado para siempre. De nada."],
      ["Torneos", p.n_tournaments, 0, "", "La gira. El tour. La deuda en trenes."],
      ["Mejor speak", p.best?.score, 0, "", p.best ? `${p.best.tname}, ${p.best.round}. Enmarcadlo.` : ""],
      ["Peor speak", p.worst?.score, 0, "", p.worst ? `${p.worst.tname}. De esto no se habla.` : ""],
      ["Consistencia (σ)", p.stdev, 2, "", "Cuanto más bajo, más robot. Cuanto más alto, más artista."],
      ["vs. media del torneo", p.vs_field, 2, "", p.vs_field > 0 ? "Por encima del campo. La ciencia lo confirma." : "La media del campo gana. De momento."],
      ["Mejor posición", posBest, null, "", `Media como 1º: ${fmt(p.pos1?.avg)} · como 2º: ${fmt(p.pos2?.avg)}`],
      ["Mejor cámara", bestSide ? bestSide[1].label : "—", null, "", bestSide ? `${fmt(bestSide[1].avg_points)} puntos de media ahí.` : ""],
      ["Mejor discurso de la sala", p.room_best_count, 0, "×", "Veces con el speak más alto de las 8 intervenciones."],
      ["Rank medio en sala", p.avg_room_rank, 2, "", "De 8 discursos por sala. 1 sería dios. 8 sería… crecimiento personal."],
      ["Racha top-2", p.streak_top2, 0, "", "Mejor racha seguida de primeros/segundos. Modo campaña."],
      ["Clutch (última ronda)", p.clutch?.delta, 2, "", p.clutch?.delta >= 0 ? "Sube cuando importa. Jugador de playoffs." : "La última ronda es su criptonita."],
      ["Rondas eliminatorias", p.n_elim_rounds, 0, "", "Breaks incluidos. Aquí ya no hay speaks, solo gloria."],
      ["Mejor tema", bestTopic ? bestTopic[0] : "—", null, "", bestTopic ? `${fmt(bestTopic[1].avg_points)} pts de media (n=${bestTopic[1].n}).` : "Aún sin muestra decente."],
      ["Online", p.env_online?.avg_speaks, 2, "", `n=${p.env_online?.n ?? 0}. Debatir en pijama cuenta igual.`],
      ["Presencial", p.env_presencial?.avg_speaks, 2, "", `n=${p.env_presencial?.n ?? 0}. Con nervios de verdad.`],
    ];
    tiles.forEach(([label, value, dec, suffix, quip], i) => {
      const d = document.createElement("div");
      d.className = "tile";
      d.style.transitionDelay = `${(i % 6) * 60}ms`;
      d.innerHTML = `<div class="tile-label">${label}</div>
        <div class="tile-value">—</div><div class="tile-quip">${quip}</div>`;
      c.appendChild(d);
      const vEl = $(".tile-value", d);
      observe(d, () => {
        if (dec === null || typeof value === "string") vEl.textContent = value ?? "—";
        else countUp(vEl, value, dec, suffix);
      });
    });
  }

  // ---------- 2. evolución ronda a ronda ----------
  function renderEvo() {
    const svg = $("#evoChart");
    svg.innerHTML = "";
    const rows = (P()?.rows || []).filter((r) => r.score != null);
    $("#evoLegend").innerHTML = `
      <span class="key"><span class="swatch" style="background:${COLORS[person]}"></span>${NAMES[person]} — speaks por discurso</span>
      <span class="key"><span class="swatch" style="background:#8a7a68;height:2px"></span>media del torneo</span>`;
    if (!rows.length) { svg.outerHTML = svg.outerHTML; return; }

    const Wc = Math.max(700, rows.length * 46), Hc = 380, m = { t: 30, r: 20, b: 66, l: 44 };
    svg.setAttribute("viewBox", `0 0 ${Wc} ${Hc}`);
    svg.style.minWidth = Wc + "px";
    const xs = (i) => m.l + (i + 0.5) * ((Wc - m.l - m.r) / rows.length);
    const lo = Math.floor(Math.min(...rows.map((r) => r.score)) - 2);
    const hi = Math.ceil(Math.max(...rows.map((r) => r.score)) + 2);
    const ys = (v) => m.t + (hi - v) * ((Hc - m.t - m.b) / (hi - lo));
    const NS = "http://www.w3.org/2000/svg";
    const mk = (tag, attrs, parent = svg) => {
      const el = document.createElementNS(NS, tag);
      for (const k in attrs) el.setAttribute(k, attrs[k]);
      parent.appendChild(el); return el;
    };

    // bandas por torneo (alternadas) + etiquetas
    let start = 0;
    const bandsG = mk("g", {});
    rows.forEach((r, i) => {
      const next = rows[i + 1];
      if (!next || next.t !== r.t) {
        const x0 = xs(start) - 18, x1 = xs(i) + 18;
        if ((bandsG.childElementCount / 2) % 2 === 0)
          mk("rect", { x: x0, y: m.t, width: x1 - x0, height: Hc - m.t - m.b, class: "tband" }, bandsG);
        const lbl = mk("text", { x: (x0 + x1) / 2, y: Hc - 34, "text-anchor": "middle", class: "tband-label" }, bandsG);
        const short = r.tname.length > 22 ? r.tname.slice(0, 21) + "…" : r.tname;
        lbl.textContent = short.toUpperCase();
        start = i + 1;
      }
    });

    // grid + eje Y
    const grid = mk("g", { class: "grid axis" });
    for (let v = lo; v <= hi; v += (hi - lo > 14 ? 4 : 2)) {
      mk("line", { x1: m.l, x2: Wc - m.r, y1: ys(v), y2: ys(v) }, grid);
      const t = mk("text", { x: m.l - 8, y: ys(v) + 3, "text-anchor": "end" }, grid);
      t.textContent = v;
    }

    // media del torneo (línea discontinua por tramos)
    let s2 = 0;
    rows.forEach((r, i) => {
      const next = rows[i + 1];
      if (!next || next.t !== r.t) {
        if (r.t_avg != null)
          mk("line", { x1: xs(s2) - 14, x2: xs(i) + 14, y1: ys(r.t_avg), y2: ys(r.t_avg), class: "evo-avg" });
        s2 = i + 1;
      }
    });

    // línea principal con animación de trazo
    const dPath = rows.map((r, i) => `${i ? "L" : "M"}${xs(i)},${ys(r.score)}`).join("");
    const path = mk("path", { d: dPath, class: "evo-line", stroke: COLORS[person] });
    if (!reduced) {
      const len = path.getTotalLength();
      path.style.strokeDasharray = len;
      path.style.strokeDashoffset = len;
      observe(svg.parentElement, () => {
        path.style.transition = "stroke-dashoffset 2.2s cubic-bezier(.3,.6,.2,1)";
        requestAnimationFrame(() => (path.style.strokeDashoffset = "0"));
      });
    }

    // puntos + tooltip + etiquetas selectivas (máx y mín)
    const maxV = Math.max(...rows.map((r) => r.score));
    const minV = Math.min(...rows.map((r) => r.score));
    rows.forEach((r, i) => {
      const dot = mk("circle", { cx: xs(i), cy: ys(r.score), r: 4.5, fill: COLORS[person], class: "evo-dot" });
      dot.addEventListener("mousemove", (e) =>
        showTip(`<div class="tt-title">${r.score} speaks</div>
          <div class="tt-row">${r.tname} · ${r.round}</div>
          <div class="tt-row">${SIDE[r.side] || r.side} · ${r.points != null ? ["4º","3º","2º","1º"][r.points] : "?"} · orador ${r.position}º</div>
          ${r.motion ? `<div class="tt-row" style="margin-top:4px">«${r.motion.slice(0, 110)}${r.motion.length > 110 ? "…" : ""}»</div>` : ""}`,
          e.clientX, e.clientY));
      dot.addEventListener("mouseleave", hideTip);
      if (r.score === maxV || r.score === minV) {
        const t = mk("text", { x: xs(i), y: ys(r.score) + (r.score === maxV ? -12 : 20), "text-anchor": "middle", class: "direct-label", fill: COLORS[person] });
        t.textContent = r.score;
      }
    });

    // tabla accesible
    $("#evoTable").innerHTML = `<table><thead><tr><th>Torneo</th><th>Ronda</th><th>Cámara</th><th>Posición</th><th>Speaks</th><th>Pts equipo</th></tr></thead>
      <tbody>${rows.map((r) => `<tr><td>${r.tname}</td><td>${r.round}</td><td>${SIDE[r.side] || ""}</td><td>${r.position}º</td><td>${r.score}</td><td>${r.points ?? ""}</td></tr>`).join("")}</tbody></table>`;
  }

  // ---------- 3. sala BP ----------
  function renderRoom() {
    const p = P(), c = $("#room");
    c.innerHTML = "";
    const sides = p?.sides || {};
    const best = Object.entries(sides).filter(([, v]) => v.avg_points != null)
      .sort((a, b) => b[1].avg_points - a[1].avg_points)[0]?.[0];
    ["og", "oo", "cg", "co"].forEach((s, i) => {
      const v = sides[s] || { n: 0 };
      const d = document.createElement("div");
      d.className = "quad";
      d.style.transitionDelay = `${i * 110}ms`;
      d.innerHTML = `
        ${s === best ? '<span class="quad-best">ZONA DE CONFORT</span>' : ""}
        <div class="quad-side">${s.toUpperCase()}</div>
        <h3>${SIDE[s]}</h3>
        <div class="quad-n">${v.n || 0} debates · ${v.firsts || 0} primeros</div>
        <div class="meter"><i data-w="${v.avg_points != null ? (v.avg_points / 3) * 100 : 0}"></i></div>
        <div class="quad-val">${fmt(v.avg_points)}<small> pts de media</small></div>
        <div class="quad-n">speaks medios: ${fmt(v.avg_speaks)}</div>`;
      c.appendChild(d);
      observe(d, () => setTimeout(() => { $(".meter i", d).style.width = $(".meter i", d).dataset.w + "%"; }, 150));
    });
  }

  // ---------- 4. posición ----------
  function renderPos() {
    const p = P(), c = $("#posGrid");
    c.innerHTML = "";
    [[1, "Primer orador", "El que abre el debate y reza."], [2, "Segundo orador", "El que arregla (o remata) lo del primero."]].forEach(([n, lab, quip], i) => {
      const d = document.createElement("div");
      const info = p?.[`pos${n}`] || {};
      d.className = "pos-card";
      d.style.transitionDelay = `${i * 140}ms`;
      d.innerHTML = `<div class="lab">${lab}</div><div class="big">0</div>
        <div class="avg">${info.avg != null ? `media de ${fmt(info.avg)} speaks` : "sin datos"} · ${quip}</div>`;
      c.appendChild(d);
      observe(d, () => countUp($(".big", d), info.n || 0, 0, "×"));
    });
  }

  // ---------- 5. resultados 1º-4º ----------
  function renderResults() {
    const p = P(), c = $("#resultBars");
    c.innerHTML = "";
    const dist = p?.results_dist || {};
    const total = Object.values(dist).reduce((a, b) => a + b, 0) || 1;
    [3, 2, 1, 0].forEach((pts, i) => {
      const n = dist[pts] || 0;
      const row = document.createElement("div");
      row.className = "rbar-row";
      row.innerHTML = `<div class="rbar-label">${POS_LABEL[pts]}</div>
        <div class="rbar-track"><div class="rbar-fill" style="background:${ORD[pts]}" data-w="${(n / total) * 100}"></div></div>
        <div class="rbar-n">${n}× (${Math.round((n / total) * 100)}%)</div>`;
      c.appendChild(row);
      observe(row, () => setTimeout(() => { $(".rbar-fill", row).style.width = $(".rbar-fill", row).dataset.w + "%"; }, i * 120));
    });
  }

  // ---------- 6. temas ----------
  function renderTopics() {
    const p = P(), c = $("#topicBars");
    c.innerHTML = "";
    const topics = Object.entries(p?.topics || {}).filter(([, v]) => v.avg_points != null)
      .sort((a, b) => b[1].avg_points - a[1].avg_points);
    if (!topics.length) { c.innerHTML = '<p class="sec-sub">Sin mociones clasificables aún.</p>'; return; }
    topics.forEach(([name, v], i) => {
      const row = document.createElement("div");
      row.className = "topic-row";
      row.innerHTML = `<div class="topic-name">${name}</div>
        <div class="topic-track"><div class="topic-fill" data-w="${(v.avg_points / 3) * 100}"></div></div>
        <div class="topic-meta">${fmt(v.avg_points)} pts · n=${v.n}</div>`;
      c.appendChild(row);
      observe(row, () => setTimeout(() => { $(".topic-fill", row).style.width = $(".topic-fill", row).dataset.w + "%"; }, i * 90));
    });
  }

  // ---------- 7. extremos ----------
  function renderExtremes() {
    const p = P(), c = $("#extremes");
    c.innerHTML = "";
    [["best", "El discurso de oro", p?.best, "Guardado en el Archivo de la Ciudadela."],
     ["worst", "El incidente", p?.worst, "Los jueces han sido reasignados a otra dimensión."]].forEach(([cls, tag, r, quip], i) => {
      if (!r) return;
      const d = document.createElement("div");
      d.className = `ext-card ${cls}`;
      d.style.transitionDelay = `${i * 150}ms`;
      d.innerHTML = `<div class="ext-tag">${tag}</div>
        <div class="ext-score">0</div>
        <div class="ext-meta">${r.tname} · ${r.round} · ${SIDE[r.side] || ""} · orador ${r.position}º</div>
        ${r.motion ? `<div class="ext-motion">«${r.motion}»</div>` : ""}
        <div class="ext-meta">${quip}</div>`;
      c.appendChild(d);
      observe(d, () => countUp($(".ext-score", d), r.score, 0));
    });
  }

  // ---------- 8. compañeros ----------
  function renderMates() {
    const p = P(), c = $("#matesList");
    c.innerHTML = "";
    const mates = p?.mates || [];
    if (!mates.length) { c.innerHTML = '<p class="sec-sub">Debate solo contra el universo.</p>'; return; }
    mates.forEach((m, i) => {
      const d = document.createElement("span");
      d.className = "mate-chip";
      d.style.transitionDelay = `${i * 70}ms`;
      d.innerHTML = `<b>${m.name}</b><span class="mmeta">${m.n} rondas · ${fmt(m.avg_points)} pts</span>`;
      c.appendChild(d);
      observe(d);
    });
  }

  // ---------- 9. versus ----------
  function renderVersus() {
    const g = DATA.people.german, l = DATA.people.lucia;
    const board = $("#vsBoard");
    const metrics = [
      ["media de speaks", g?.avg_speaks, l?.avg_speaks, 50, 90],
      ["media de puntos", g?.avg_points, l?.avg_points, 0, 3],
      ["mejor speak", g?.best?.score, l?.best?.score, 50, 90],
      ["torneos", g?.n_tournaments, l?.n_tournaments, 0, Math.max(g?.n_tournaments || 1, l?.n_tournaments || 1)],
      ["racha top-2", g?.streak_top2, l?.streak_top2, 0, Math.max(g?.streak_top2 || 1, l?.streak_top2 || 1, 1)],
      ["vs. campo", g?.vs_field, l?.vs_field, -3, 3],
    ];
    board.innerHTML = metrics.map(([lab, gv, lv, lo, hi]) => {
      const pct = (v) => v == null ? 0 : Math.max(4, ((v - lo) / (hi - lo)) * 100);
      const gWin = gv != null && lv != null && gv > lv, lWin = gv != null && lv != null && lv > gv;
      return `<div class="vs-row">
        <div class="vs-cell left"><div class="vs-bar"><i data-w="${pct(gv)}"></i></div>
          <div class="vs-val ${gWin ? "vs-win" : ""}" style="color:${gWin ? UI.german : "inherit"}">${fmt(gv)}</div></div>
        <div class="vs-metric">${lab}</div>
        <div class="vs-cell right"><div class="vs-bar"><i data-w="${pct(lv)}"></i></div>
          <div class="vs-val ${lWin ? "vs-win" : ""}" style="color:${lWin ? UI.lucia : "inherit"}">${fmt(lv)}</div></div>
      </div>`;
    }).join("");
    observe(board, () => $$(".vs-bar i", board).forEach((el, i) =>
      setTimeout(() => (el.style.width = el.dataset.w + "%"), i * 80)));

    const h2h = DATA.h2h || [];
    $("#h2hList").innerHTML = h2h.length
      ? h2h.map((h) => `<div class="h2h-card">
          <div class="h2h-head"><span>${h.t} · ${h.round}</span><span>${h.same_team ? "MISMO EQUIPO 🤝" : "SALA COMPARTIDA ⚔️"}</span></div>
          ${h.motion ? `<div class="h2h-motion">«${h.motion}»</div>` : ""}
          <div class="h2h-res">
            <span class="g">Germán: ${SIDE[h.german.side] || ""} · ${h.german.points != null ? ["4º","3º","2º","1º"][h.german.points] : "?"} · ${fmt(h.german.score)} spk</span>
            <span class="l">Lucía: ${SIDE[h.lucia.side] || ""} · ${h.lucia.points != null ? ["4º","3º","2º","1º"][h.lucia.points] : "?"} · ${fmt(h.lucia.score)} spk</span>
          </div></div>`).join("")
      : '<p class="sec-sub">Todavía no han coincidido en sala. El multiverso los está reservando para la gran final.</p>';
    $$(".h2h-card").forEach((el, i) => { el.style.transitionDelay = `${i * 90}ms`; observe(el); });
  }

  // ---------- 10. torneos ----------
  function renderTours() {
    const p = P(), c = $("#tourStrip");
    c.innerHTML = "";
    (p?.tournaments || []).forEach((t, i) => {
      const d = document.createElement("div");
      d.className = "tour-card";
      d.style.transitionDelay = `${i * 80}ms`;
      d.innerHTML = `<div class="tour-date">${t.date || "¿?"}</div>
        <div class="tour-name">${t.name}</div>
        <div class="tour-team">como «${t.team || "?"}»</div>
        <span class="tour-badge">${t.online ? "ONLINE" : "PRESENCIAL"}</span>`;
      c.appendChild(d);
      observe(d);
    });
    if (!p?.tournaments?.length) c.innerHTML = '<p class="sec-sub">Sin torneos detectados aún en esta dimensión.</p>';
  }

  // ---------- selector ----------
  const pill = $(".sel-pill");
  function movePill() {
    const btn = $(".sel-btn.active");
    pill.style.width = btn.offsetWidth + "px";
    pill.style.transform = `translateX(${btn.offsetLeft - 5}px)`;
  }
  $$(".sel-btn").forEach((b) => b.addEventListener("click", () => {
    if (b.dataset.sel === person) return;
    $$(".sel-btn").forEach((x) => { x.classList.toggle("active", x === b); x.setAttribute("aria-selected", x === b); });
    person = b.dataset.sel;
    movePill();
    renderAll();
  }));
  addEventListener("resize", movePill);

  // ---------- tabla toggle ----------
  $$(".table-toggle").forEach((b) => b.addEventListener("click", () => {
    const t = $("#" + b.dataset.table);
    t.hidden = !t.hidden;
    b.textContent = t.hidden ? "Ver tabla (para tu yo de la dimensión aburrida)" : "Ocultar tabla";
  }));

  // ---------- go ----------
  renderAll();
  renderVersus();
  movePill();
})();
