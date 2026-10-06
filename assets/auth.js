// Desbloqueo de perfiles. La clave (secreta, vive en Vercel como BP_CLAVE) se
// guarda en este navegador y se envía a /api/stats. Sin clave solo se ve el
// perfil público (german); con ella, todos.
(function () {
  "use strict";
  window.BP = window.BP || {};

  BP.getClave = function () {
    try { return localStorage.getItem("bp_clave") || ""; } catch (e) { return ""; }
  };

  // URL del endpoint de datos, con la clave si la hay guardada.
  BP.statsURL = function () {
    var c = BP.getClave();
    return "/api/stats" + (c ? "?c=" + encodeURIComponent(c) : "");
  };

  // Pide la clave, la valida contra el servidor y la guarda si es correcta.
  BP.pedirClave = async function () {
    var v = prompt("Clave de acceso a los expedientes:");
    if (v == null || v === "") { return false; }
    try {
      var r = await fetch("/api/stats?c=" + encodeURIComponent(v), { cache: "no-store" });
      var d = await r.json();
      if (d && d.authed) {
        try { localStorage.setItem("bp_clave", v); } catch (e) {}
        return true;
      }
    } catch (e) {}
    alert("Esa clave no abre ningún portal.");
    return false;
  };

  // Enlaza un elemento (p. ej. el logo) como disparador oculto del desbloqueo.
  BP.wireLogo = function (el) {
    if (!el) { return; }
    el.addEventListener("click", async function () {
      if (await BP.pedirClave()) { location.reload(); }
    });
  };
})();
