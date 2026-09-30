/* BPringaos — el expediente: deck horizontal de estadísticas */
(async function () {
  "use strict";

  const COLORS = { german: "#e8620c", lucia: "#5fa32b" };
  const UI = { german: "#ff7a1a", lucia: "#97ce4c" };
  const ORD = { 3: "#f08326", 2: "#cf6410", 1: "#a1500e", 0: "#7a4012" };
  const POS_LABEL = { 3: "Primeros", 2: "Segundos", 1: "Terceros", 0: "Cuartos" };
  const RANK_TXT = ["4º", "3º", "2º", "1º"];
  const SIDE = { og: "Alta Gobierno", oo: "Alta Oposición", cg: "Baja Gobierno", co: "Baja Oposición" };
  const NAMES = { german: "Germán", lucia: "Lucía" };
  const FULL = { german: "Germán Mendonça Costa-Frossard", lucia: "Lucía Vadillo" };

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const fmt = (v, d = 2) => {
    if (v == null || Number.isNaN(+v)) return "—";
    const s = (+v).toFixed(d);
    return d > 0 ? s.replace(/\.?0+$/, "") || "0" : s;
  };
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

  const person = new URLSearchParams(location.search).get("p") === "lucia" ? "lucia" : "german";
  document.body.dataset.person = person;

  let DATA;
  try {
    DATA = await (await fetch("data/stats.json", { cache: "no-store" })).json();
  } catch (e) {
    $("#loader .loader-txt").textContent = "El portal ha fallado. Esta dimensión no tiene datos.";
    throw e;
  }
  const P = DATA.people[person] || {};
  const rows = (P.rows || []).filter((r) => r.score != null);

  $("#deckPerson").textContent = FULL[person];

  const hideLoader = () => $("#loader").classList.add("done");
  setTimeout(hideLoader, 700);

  // ---------- tooltip ----------
  const tip = $("#tooltip");
  function showTip(html, x, y) {
    tip.innerHTML = html;
    tip.classList.add("show");
    const w = tip.offsetWidth;
    tip.style.left = Math.min(Math.max(8, x - w / 2), innerWidth - w - 8) + "px";
    tip.style.top = Math.max(8, y - tip.offsetHeight - 14) + "px";
  }
  const hideTip = () => tip.classList.remove("show");

  // ---------- helpers de animación ----------
  function countUp(el, target, decimals = 0, suffix = "") {
    if (reduced || target == null || typeof target === "string") {
      el.textContent = (typeof target === "string" ? target : fmt(target, decimals)) + suffix;
      return;
    }
    const dur = 1400, t0 = performance.now();
    (function step(now) {
      const k = Math.min(1, (now - t0) / dur);
      const ease = 1 - Math.pow(1 - k, 3);
      el.textContent = (target * ease).toFixed(decimals) + suffix;
      if (k < 1) requestAnimationFrame(step);
      else el.textContent = fmt(target, decimals) + suffix;
    })(t0);
  }

  // ================================================================
  // DEFINICIÓN DE SLIDES — cada una: {id, kicker, title, quip, build(el), enter(el)}
  // ================================================================
  const slides = [];
  const add = (s) => slides.push(s);

  const noData = !rows.length;

  // ---- 0 · portada del expediente ----
  add({
    id: "expediente", kicker: "expediente clasificado",
    title: "",
    build: (el) => {
      const teams = [...new Set((P.tournaments || []).map((t) => t.team).filter(Boolean))];
      el.innerHTML = `
        <div class="sl-center">
          <div class="file-stamp">EXPEDIENTE BP-137/${person === "german" ? "G" : "L"}</div>
          <h1 class="sl-mega">${NAMES[person]}</h1>
          <p class="sl-sub">${FULL[person]}</p>
          <div class="file-row">
            <div class="file-cell"><b data-count="${P.n_tournaments || 0}">0</b><span>torneos</span></div>
            <div class="file-cell"><b data-count="${P.n_rounds || 0}">0</b><span>discursos</span></div>
            <div class="file-cell"><b data-count="${P.n_elim_rounds || 0}">0</b><span>rondas elim.</span></div>
            <div class="file-cell"><b data-count="${(DATA.n_tournaments_scanned) || 0}">0</b><span>tabs escaneados</span></div>
          </div>
          <p class="sl-quip">${noData
            ? "Cero apariciones en los tabs de esta dimensión. O alias nivel dios, o toca debatir más."
            : `Alias detectados: «${teams.slice(0, 4).join("», «")}»${teams.length > 4 ? "…" : ""}. El Consejo lo sabe todo.`}</p>
        </div>`;
    },
    enter: (el) => $$("[data-count]", el).forEach((b) => countUp(b, +b.dataset.count)),
  });

  if (!noData) {

  // ---- 1 · media de speaks (gauge) ----
  add({
    id: "media", kicker: "estadística 01 · la media",
    title: "Media de speaks",
    build: (el) => {
      const avg = P.avg_speaks, lo = 65, hi = 85;
      const pct = Math.max(0, Math.min(1, (avg - lo) / (hi - lo)));
      el.innerHTML = `
        <div class="sl-split">
          <div class="gauge-wrap">
            <svg viewBox="0 0 200 120" class="gauge">
              <path d="M15 105 A 85 85 0 0 1 185 105" fill="none" stroke="var(--surface-2)" stroke-width="14" stroke-linecap="round"/>
              <path d="M15 105 A 85 85 0 0 1 185 105" fill="none" stroke="var(--serie)" stroke-width="14" stroke-linecap="round"
                class="gauge-arc" pathLength="100" stroke-dasharray="0 100" data-target="${pct * 100}"/>
              <text x="100" y="86" text-anchor="middle" class="gauge-num" data-avg>0</text>
              <text x="100" y="104" text-anchor="middle" class="gauge-lab">speaks de media</text>
            </svg>
          </div>
          <div class="sl-side">
            <p class="sl-big-line">σ = <b>${fmt(P.stdev)}</b> de consistencia</p>
            <p class="sl-big-line">${fmt(P.vs_field)} vs. la media del campo</p>
            <p class="sl-quip">${P.vs_field > 0
              ? "Por encima del campo. La ciencia dice que eres estadísticamente insufrible en la mesa."
              : "El campo va por delante. Tranquilidad: en otra dimensión vas ganando."}</p>
          </div>
        </div>`;
    },
    enter: (el) => {
      const arc = $(".gauge-arc", el);
      arc.style.transition = reduced ? "none" : "stroke-dasharray 1.6s cubic-bezier(.2,.7,.2,1)";
      requestAnimationFrame(() => (arc.style.strokeDasharray = `${arc.dataset.target} 100`));
      countUp($("[data-avg]", el), P.avg_speaks, 2);
    },
  });

  // ---- 2 · evolución ronda a ronda ----
  add({
    id: "evolucion", kicker: "estadística 02 · la película",
    title: "Speaks ronda a ronda",
    quip: "Cada punto, un discurso real. La discontinua es la media del torneo: por debajo de ella «es culpa del panel».",
    build: (el) => {
      el.innerHTML = `<div class="chart-scroll deck-chart"><svg id="evoChart" role="img" aria-label="Evolución ronda a ronda"></svg></div>`;
    },
    enter: (el) => drawEvo($("#evoChart", el)),
  });

  // ---- 3 · resultados 1º-4º ----
  add({
    id: "resultados", kicker: "estadística 03 · el histograma de la verdad",
    title: `Media de puntos: ${fmt(P.avg_points)}`,
    quip: "De 0 a 3 por ronda. Como las estrellas Michelin, pero con más llanto en los pasillos.",
    build: (el) => {
      const dist = P.results_dist || {};
      const total = Object.values(dist).reduce((a, b) => a + b, 0) || 1;
      el.innerHTML = `<div class="rbars">` + [3, 2, 1, 0].map((pts) => {
        const n = dist[pts] || 0;
        return `<div class="rbar-row">
          <div class="rbar-label">${POS_LABEL[pts]}</div>
          <div class="rbar-track"><div class="rbar-fill" style="background:${ORD[pts]}" data-w="${(n / total) * 100}"></div></div>
          <div class="rbar-n">${n}× · ${Math.round((n / total) * 100)}%</div>
        </div>`;
      }).join("") + `</div>`;
    },
    enter: (el) => $$(".rbar-fill", el).forEach((f, i) =>
      setTimeout(() => (f.style.width = f.dataset.w + "%"), 100 + i * 140)),
  });

  // ---- 4 · cámaras ----
  add({
    id: "camaras", kicker: "estadística 04 · el mapa de la sala",
    title: "¿En qué cámara haces más daño?",
    build: (el) => {
      const sides = P.sides || {};
      const best = Object.entries(sides).filter(([, v]) => v.avg_points != null)
        .sort((a, b) => b[1].avg_points - a[1].avg_points)[0]?.[0];
      el.innerHTML = `<div class="room">` + ["og", "oo", "cg", "co"].map((s, i) => {
        const v = sides[s] || { n: 0 };
        return `<div class="quad" style="transition-delay:${i * 110}ms">
          ${s === best ? '<span class="quad-best">ZONA DE CONFORT</span>' : ""}
          <div class="quad-side">${s.toUpperCase()}</div>
          <h3>${SIDE[s]}</h3>
          <div class="quad-n">${v.n || 0} debates · ${v.firsts || 0} primeros</div>
          <div class="meter"><i data-w="${v.avg_points != null ? (v.avg_points / 3) * 100 : 0}"></i></div>
          <div class="quad-val">${fmt(v.avg_points)}<small> pts de media</small></div>
          <div class="quad-n">speaks medios: ${fmt(v.avg_speaks)}</div>
        </div>`;
      }).join("") + `</div>`;
    },
    enter: (el) => {
      $$(".quad", el).forEach((q) => q.classList.add("in"));
      $$(".meter i", el).forEach((m, i) => setTimeout(() => (m.style.width = m.dataset.w + "%"), 300 + i * 120));
    },
  });

  // ---- 5 · posición ----
  add({
    id: "posicion", kicker: "estadística 05 · el orden de los factores",
    title: "¿1º o 2º orador?",
    quip: "El primero abre el debate y reza; el segundo arregla (o remata) lo del primero.",
    build: (el) => {
      el.innerHTML = `<div class="pos-grid">` + [1, 2].map((n, i) => {
        const info = P[`pos${n}`] || {};
        return `<div class="pos-card" style="transition-delay:${i * 140}ms">
          <div class="lab">${n}º orador</div>
          <div class="big" data-count="${info.n || 0}">0</div>
          <div class="avg">${info.avg != null ? `media de ${fmt(info.avg)} speaks` : "sin datos"}</div>
        </div>`;
      }).join("") + `</div>
      <p class="sl-quip center">${(P.pos1?.avg ?? -1) > (P.pos2?.avg ?? -1)
        ? "Los datos dicen que rindes más abriendo. Cero presión la próxima vez que te toque cerrar."
        : "Los datos dicen que rindes más en el segundo discurso. El drama del cierre te sienta bien."}</p>`;
    },
    enter: (el) => {
      $$(".pos-card", el).forEach((c) => c.classList.add("in"));
      $$("[data-count]", el).forEach((b) => countUp(b, +b.dataset.count, 0, "×"));
    },
  });

  // ---- 6 · mejor discurso ----
  add({
    id: "mejor", kicker: "estadística 06 · el pico de la carrera",
    title: "El discurso de oro",
    build: (el) => {
      const r = P.best;
      el.innerHTML = `<div class="sl-center">
        <div class="mega-score gold" data-count="${r.score}">0</div>
        <p class="sl-sub">${r.tname} · ${r.round} · ${SIDE[r.side] || ""} · ${r.position}º orador</p>
        ${r.motion ? `<p class="sl-motion">«${r.motion}»</p>` : ""}
        <p class="sl-quip">Guardado en el Archivo de la Ciudadela. Enmarcadlo.</p>
      </div>`;
    },
    enter: (el) => countUp($("[data-count]", el), P.best.score),
  });

  // ---- 7 · peor discurso ----
  add({
    id: "peor", kicker: "estadística 07 · el incidente",
    title: "De esto no se habla",
    build: (el) => {
      const r = P.worst;
      el.innerHTML = `<div class="sl-center">
        <div class="mega-score coal" data-count="${r.score}">0</div>
        <p class="sl-sub">${r.tname} · ${r.round} · ${SIDE[r.side] || ""} · ${r.position}º orador</p>
        ${r.motion ? `<p class="sl-motion">«${r.motion}»</p>` : ""}
        <p class="sl-quip">Los jueces implicados fueron reasignados a otra dimensión. Caso cerrado.</p>
      </div>`;
    },
    enter: (el) => countUp($("[data-count]", el), P.worst.score),
  });

  // ---- 8 · rank en sala ----
  add({
    id: "sala", kicker: "estadística 08 · los ocho magníficos",
    title: "Tu sitio entre los 8 discursos de la sala",
    quip: "Cada debate BP tiene 8 discursos. Posición media del tuyo, y veces que fue el mejor de todos.",
    build: (el) => {
      const rank = P.avg_room_rank || 0;
      el.innerHTML = `<div class="rank8">` +
        Array.from({ length: 8 }, (_, i) => {
          const pos = i + 1;
          const isYou = Math.round(rank) === pos;
          return `<div class="rank-dot ${isYou ? "you" : ""}" style="transition-delay:${i * 90}ms">
            <span>${pos}</span>${isYou ? `<em>tú (media ${fmt(rank)})</em>` : ""}
          </div>`;
        }).join("") + `</div>
        <p class="sl-big-line center"><b data-count="${P.room_best_count || 0}">0</b>&nbsp;veces el mejor discurso de la sala</p>`;
    },
    enter: (el) => {
      $$(".rank-dot", el).forEach((d) => d.classList.add("in"));
      $$("[data-count]", el).forEach((b) => countUp(b, +b.dataset.count, 0, "×"));
    },
  });

  // ---- 9 · temas ----
  add({
    id: "temas", kicker: "estadística 09 · astrología con pasos extra",
    title: "Temas que se te dan bien (y los otros)",
    quip: "Clasificación automática de cada moción. Con n pequeño esto es un horóscopo, y lo sabes.",
    build: (el) => {
      const topics = Object.entries(P.topics || {}).filter(([, v]) => v.avg_points != null)
        .sort((a, b) => b[1].avg_points - a[1].avg_points);
      el.innerHTML = `<div class="topics">` + topics.map(([name, v]) =>
        `<div class="topic-row">
          <div class="topic-name">${name}</div>
          <div class="topic-track"><div class="topic-fill" data-w="${(v.avg_points / 3) * 100}"></div></div>
          <div class="topic-meta">${fmt(v.avg_points)} pts · n=${v.n}</div>
        </div>`).join("") + `</div>`;
    },
    enter: (el) => $$(".topic-fill", el).forEach((f, i) =>
      setTimeout(() => (f.style.width = f.dataset.w + "%"), 100 + i * 90)),
  });

  // ---- 10 · racha y clutch ----
  add({
    id: "racha", kicker: "estadística 10 · modo campaña",
    title: "Racha y factor clutch",
    build: (el) => {
      const d = P.clutch?.delta;
      el.innerHTML = `<div class="duo">
        <div class="duo-card"><div class="lab">mejor racha de 1º/2º seguidos</div>
          <div class="big" data-count="${P.streak_top2 || 0}">0</div>
          <p class="sl-quip">rondas encadenadas en el top de la sala</p></div>
        <div class="duo-card"><div class="lab">última ronda vs. tu media</div>
          <div class="big ${d >= 0 ? "up" : "down"}">${d != null ? (d >= 0 ? "+" : "") + fmt(d) : "—"}</div>
          <p class="sl-quip">${d >= 0 ? "Subes cuando importa. Jugador de playoffs." : "La última ronda es tu criptonita. A todos nos pasa. A ti más."}</p></div>
      </div>`;
    },
    enter: (el) => $$("[data-count]", el).forEach((b) => countUp(b, +b.dataset.count)),
  });

  // ---- 11 · online vs presencial ----
  add({
    id: "entorno", kicker: "estadística 11 · pijama contra nervios",
    title: "Online vs. presencial",
    build: (el) => {
      const o = P.env_online || {}, p_ = P.env_presencial || {};
      el.innerHTML = `<div class="duo split-env">
        <div class="duo-card env-on"><div class="lab">🖥 online</div>
          <div class="big">${fmt(o.avg_speaks)}</div>
          <p class="sl-quip">${o.n || 0} discursos · ${fmt(o.avg_points)} pts de media · en pijama cuenta igual</p></div>
        <div class="duo-card env-off"><div class="lab">🏛 presencial</div>
          <div class="big">${fmt(p_.avg_speaks)}</div>
          <p class="sl-quip">${p_.n || 0} discursos · ${fmt(p_.avg_points)} pts de media · con nervios de verdad</p></div>
      </div>
      <p class="sl-quip center">${(o.avg_speaks || 0) > (p_.avg_speaks || 0)
        ? "Rindes más a través de la pantalla. Ser un holograma te favorece."
        : "Rindes más en persona. La presencia física intimida, al parecer."}</p>`;
    },
    enter: () => {},
  });

  // ---- 12 · compañeros ----
  add({
    id: "mates", kicker: "estadística 12 · daños colaterales",
    title: "Gente que debatió contigo y sobrevivió",
    build: (el) => {
      const mates = P.mates || [];
      el.innerHTML = `<div class="mates">` + (mates.length ? mates.map((m, i) =>
        `<span class="mate-chip" style="transition-delay:${i * 60}ms"><b>${m.name}</b>
          <span class="mmeta">${m.n} rondas · ${fmt(m.avg_points)} pts · ${fmt(m.avg_speaks)} spk</span></span>`).join("")
        : '<p class="sl-quip">Debate solo contra el universo.</p>') + `</div>`;
    },
    enter: (el) => $$(".mate-chip", el).forEach((c) => c.classList.add("in")),
  });

  // ---- 13 · jueces ----
  add({
    id: "jueces", kicker: "estadística 13 · el tribunal",
    title: "Jueces de silla más recurrentes",
    quip: "Las caras que más veces han decidido tu destino. Salúdalos con respeto (o miedo).",
    build: (el) => {
      const chairs = P.chairs || [];
      el.innerHTML = `<div class="chairs">` + (chairs.length ? chairs.map(([name, n], i) =>
        `<div class="chair-row" style="transition-delay:${i * 100}ms">
          <span class="chair-n">${n}×</span><span class="chair-name">${name}</span>
        </div>`).join("") : '<p class="sl-quip">Jueces anónimos. Como debe ser.</p>') + `</div>`;
    },
    enter: (el) => $$(".chair-row", el).forEach((c) => c.classList.add("in")),
  });

  // ---- 14 · la gira ----
  add({
    id: "gira", kicker: "las fuentes · la gira interdimensional",
    title: "Torneos como debatiente",
    quip: "Solo cuentan torneos con discursos suyos en el tab: de aquí salen todas las estadísticas anteriores. Juzgar no computa (eso es otro expediente).",
    build: (el) => {
      el.innerHTML = `<div class="tour-strip">` + (P.tournaments || []).map((t, i) =>
        `<div class="tour-card" style="transition-delay:${i * 70}ms">
          <div class="tour-date">${t.date || "¿?"}</div>
          <div class="tour-name">${t.name}</div>
          <div class="tour-team">como «${t.team || "?"}»</div>
          <span class="tour-badge">${t.online ? "ONLINE" : "PRESENCIAL"}</span>
        </div>`).join("") + `</div>`;
    },
    enter: (el) => $$(".tour-card", el).forEach((c) => c.classList.add("in")),
  });

  } // fin noData

  // ---- final ----
  add({
    id: "fin", kicker: "fin de la transmisión",
    title: noData ? "Vuelve cuando hayas debatido" : "Wubba lubba dub dub",
    build: (el) => {
      const share = encodeURIComponent(`El expediente de ${NAMES[person]} en BPringaos es ciencia pura: https://bpringaos.com/stats.html?p=${person}`);
      el.innerHTML = `<div class="sl-center">
        <p class="sl-quip">«Los speaks van y vienen, Morty. La vergüenza de una cuarta en AG es para siempre.»</p>
        <div class="fin-cta">
          <a class="btn btn-primary" href="https://wa.me/?text=${share}">Compartir por WhatsApp</a>
          <a class="btn btn-ghost" href="stats.html?p=${person === "german" ? "lucia" : "german"}">Ver a ${NAMES[person === "german" ? "lucia" : "german"]}</a>
          <a class="btn btn-ghost" href="index.html">Volver al portal</a>
        </div>
        <p class="hero-note">${DATA.n_tournaments_scanned} torneos indexados · datos públicos de calicotab · sin permiso del Consejo de Ricks</p>
      </div>`;
    },
    enter: () => {},
  });

  // ================================================================
  // gráfica de evolución (se dibuja al entrar en su slide)
  // ================================================================
  let evoDrawn = false;
  function drawEvo(svg) {
    if (evoDrawn || !svg) return;
    evoDrawn = true;
    const Wc = Math.max(900, rows.length * 52), Hc = 440, m = { t: 30, r: 24, b: 70, l: 46 };
    svg.setAttribute("viewBox", `0 0 ${Wc} ${Hc}`);
    svg.style.minWidth = Wc + "px";
    const NS = "http://www.w3.org/2000/svg";
    const mk = (tag, attrs, parent = svg) => {
      const el = document.createElementNS(NS, tag);
      for (const k in attrs) el.setAttribute(k, attrs[k]);
      parent.appendChild(el);
      return el;
    };
    const xs = (i) => m.l + (i + 0.5) * ((Wc - m.l - m.r) / rows.length);
    const lo = Math.floor(Math.min(...rows.map((r) => r.score)) - 2);
    const hi = Math.ceil(Math.max(...rows.map((r) => r.score)) + 2);
    const ys = (v) => m.t + (hi - v) * ((Hc - m.t - m.b) / (hi - lo));

    let start = 0, bandN = 0;
    rows.forEach((r, i) => {
      const next = rows[i + 1];
      if (!next || next.t !== r.t) {
        const x0 = xs(start) - 20, x1 = xs(i) + 20;
        if (bandN % 2 === 0) mk("rect", { x: x0, y: m.t, width: x1 - x0, height: Hc - m.t - m.b, class: "tband" });
        const lbl = mk("text", { x: (x0 + x1) / 2, y: Hc - 36, "text-anchor": "middle", class: "tband-label" });
        const short = r.tname.length > 20 ? r.tname.slice(0, 19) + "…" : r.tname;
        lbl.textContent = short.toUpperCase();
        if (r.t_avg != null)
          mk("line", { x1: x0 + 6, x2: x1 - 6, y1: ys(r.t_avg), y2: ys(r.t_avg), class: "evo-avg" });
        bandN++; start = i + 1;
      }
    });

    const grid = mk("g", { class: "grid axis" });
    for (let v = lo; v <= hi; v += hi - lo > 14 ? 4 : 2) {
      mk("line", { x1: m.l, x2: Wc - m.r, y1: ys(v), y2: ys(v) }, grid);
      const t = mk("text", { x: m.l - 8, y: ys(v) + 3, "text-anchor": "end" }, grid);
      t.textContent = v;
    }

    const dPath = rows.map((r, i) => `${i ? "L" : "M"}${xs(i)},${ys(r.score)}`).join("");
    const path = mk("path", { d: dPath, class: "evo-line", stroke: COLORS[person] });
    if (!reduced) {
      const len = path.getTotalLength();
      path.style.strokeDasharray = len;
      path.style.strokeDashoffset = len;
      requestAnimationFrame(() => {
        path.style.transition = "stroke-dashoffset 2.4s cubic-bezier(.3,.6,.2,1)";
        path.style.strokeDashoffset = "0";
      });
    }

    const maxV = Math.max(...rows.map((r) => r.score));
    const minV = Math.min(...rows.map((r) => r.score));
    rows.forEach((r, i) => {
      const dot = mk("circle", { cx: xs(i), cy: ys(r.score), r: 5, fill: COLORS[person], class: "evo-dot" });
      dot.addEventListener("mousemove", (e) =>
        showTip(`<div class="tt-title">${r.score} speaks</div>
          <div class="tt-row">${r.tname} · ${r.round}</div>
          <div class="tt-row">${SIDE[r.side] || r.side} · ${r.points != null ? RANK_TXT[r.points] : "?"} · ${r.position}º orador</div>
          ${r.motion ? `<div class="tt-row" style="margin-top:4px">«${r.motion.slice(0, 110)}${r.motion.length > 110 ? "…" : ""}»</div>` : ""}`,
          e.clientX, e.clientY));
      dot.addEventListener("mouseleave", hideTip);
      if (r.score === maxV || r.score === minV) {
        const t = mk("text", { x: xs(i), y: ys(r.score) + (r.score === maxV ? -13 : 22), "text-anchor": "middle", class: "direct-label", fill: COLORS[person] });
        t.textContent = r.score;
      }
    });
  }

  // ================================================================
  // montaje del deck
  // ================================================================
  const deck = $("#deck");
  slides.forEach((s, i) => {
    const sec = document.createElement("section");
    sec.className = "slide";
    sec.dataset.idx = i;
    sec.innerHTML = `
      <div class="slide-inner">
        <p class="slide-kicker">${s.kicker}</p>
        ${s.title ? `<h2 class="slide-title">${s.title}</h2>` : ""}
        ${s.quip ? `<p class="slide-quip">${s.quip}</p>` : ""}
        <div class="slide-body"></div>
      </div>`;
    deck.appendChild(sec);
    s.build($(".slide-body", sec));
  });

  // dots
  const dots = $("#deckDots");
  slides.forEach((s, i) => {
    const b = document.createElement("button");
    b.className = "dot";
    b.setAttribute("aria-label", `Ir a ${s.title}`);
    b.addEventListener("click", () => goTo(i));
    dots.appendChild(b);
  });

  let current = -1;
  const entered = new Set();

  function updateUI(idx) {
    if (idx === current) return;
    current = idx;
    $$(".dot", dots).forEach((d, i) => d.classList.toggle("on", i === idx));
    $("#deckCount").textContent = `${idx + 1} / ${slides.length}`;
    $("#deckGhost").textContent = String(idx + 1).padStart(2, "0");
    $("#deckGhost").classList.remove("pop");
    void $("#deckGhost").offsetWidth;
    $("#deckGhost").classList.add("pop");
    $("#prevBtn").disabled = idx === 0;
    $("#nextBtn").disabled = idx === slides.length - 1;
    if (idx > 0) $("#deckHint").classList.add("gone");
    const sec = deck.children[idx];
    sec.classList.add("active");
    if (!entered.has(idx)) {
      entered.add(idx);
      setTimeout(() => slides[idx].enter($(".slide-body", sec)), reduced ? 0 : 350);
    }
  }

  function goTo(i) {
    i = Math.max(0, Math.min(slides.length - 1, i));
    deck.children[i].scrollIntoView({ behavior: reduced ? "instant" : "smooth", inline: "start" });
  }

  // observar qué slide está visible
  const vis = new IntersectionObserver((es) => {
    es.forEach((e) => { if (e.isIntersecting) updateUI(+e.target.dataset.idx); });
  }, { root: deck, threshold: 0.55 });
  $$(".slide", deck).forEach((s) => vis.observe(s));

  // rueda vertical → avance horizontal (con acumulador para trackpads)
  let wheelLock = 0;
  deck.addEventListener("wheel", (e) => {
    const target = e.target.closest(".chart-scroll, .tour-strip, .mates, .topics");
    if (target && Math.abs(e.deltaX) > Math.abs(e.deltaY)) return; // scroll interno horizontal
    e.preventDefault();
    const now = Date.now();
    if (now < wheelLock) return;
    const d = Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
    if (Math.abs(d) < 12) return;
    wheelLock = now + 650;
    goTo(current + (d > 0 ? 1 : -1));
  }, { passive: false });

  addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight" || e.key === "PageDown" || e.key === " ") { e.preventDefault(); goTo(current + 1); }
    if (e.key === "ArrowLeft" || e.key === "PageUp") { e.preventDefault(); goTo(current - 1); }
    if (e.key === "Home") goTo(0);
    if (e.key === "End") goTo(slides.length - 1);
  });

  $("#prevBtn").addEventListener("click", () => goTo(current - 1));
  $("#nextBtn").addEventListener("click", () => goTo(current + 1));

  // ---------- polvo de fondo ----------
  (function dust() {
    const cv = $("#dustCanvas");
    if (!cv || reduced) return;
    const ctx = cv.getContext("2d");
    let W, H;
    const ps = [];
    function resize() { W = cv.width = innerWidth * devicePixelRatio; H = cv.height = innerHeight * devicePixelRatio; }
    resize(); addEventListener("resize", resize);
    for (let i = 0; i < 60; i++) ps.push({
      x: Math.random(), y: Math.random(),
      vx: (Math.random() - 0.5) * 0.0006, vy: (Math.random() - 0.5) * 0.0004,
      sz: (0.5 + Math.random() * 1.8) * devicePixelRatio,
      hue: Math.random() < 0.85 ? "232,98,12" : "151,206,76",
      ph: Math.random() * Math.PI * 2,
    });
    let t = 0;
    (function draw() {
      ctx.clearRect(0, 0, W, H);
      t += 0.01;
      for (const p of ps) {
        p.x = (p.x + p.vx + 1) % 1; p.y = (p.y + p.vy + 1) % 1;
        const a = 0.08 + 0.22 * (0.5 + 0.5 * Math.sin(t + p.ph));
        ctx.beginPath();
        ctx.fillStyle = `rgba(${p.hue},${a})`;
        ctx.arc(p.x * W, p.y * H, p.sz, 0, Math.PI * 2);
        ctx.fill();
      }
      requestAnimationFrame(draw);
    })();
  })();

  updateUI(0);
  deck.focus({ preventScroll: true });
})();
