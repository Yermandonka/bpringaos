// Avisa al endpoint de visitas (mismo dominio: /api/hit, función serverless en
// Vercel) para contar, con fines educativos, cuántos dispositivos entran. El
// servidor guarda IP + hora. Si algo falla, falla en silencio: no molesta.
(function () {
  var pagina = /stats/i.test(location.pathname)
    ? 'stats' + (location.search || '')
    : 'home';

  var url = '/api/hit?p=' + encodeURIComponent(pagina);

  try {
    if (navigator.sendBeacon) {
      navigator.sendBeacon(url);
    } else {
      fetch(url, { method: 'POST', keepalive: true });
    }
  } catch (e) { /* da igual */ }
})();
