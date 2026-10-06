// Avisa al registro de visitas (proyecto bpringaos-hits en Vercel) para contar,
// con fines educativos, cuántos dispositivos entran. El servidor guarda IP+hora.
// Si el endpoint está caído o bloqueado, no pasa nada: falla en silencio.
(function () {
  // ⬇️ Cambia esto por la URL real de tu proyecto de Vercel tras desplegarlo.
  var ENDPOINT = 'https://bpringaos-hits.vercel.app/api/hit';

  var pagina = /stats/i.test(location.pathname)
    ? 'stats' + (location.search || '')
    : 'home';

  var url = ENDPOINT + '?p=' + encodeURIComponent(pagina);

  try {
    if (navigator.sendBeacon) {
      navigator.sendBeacon(url);
    } else {
      fetch(url, { method: 'POST', mode: 'no-cors', keepalive: true });
    }
  } catch (e) { /* da igual */ }
})();
