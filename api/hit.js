// Registro de visitas con fines educativos. Al abrir la web, la página llama a
// este endpoint (mismo dominio) y guardamos IP + hora (y algún dato extra) como
// un archivo JSON privado en Vercel Blob. Lo revisas desde el panel de Blob.
//
// Se escribe UN archivo por visita (nada de leer-modificar-escribir), así que
// no hay condiciones de carrera aunque entren varios a la vez.
import { put } from '@vercel/blob';

// La IP real del visitante la pone el proxy de Vercel en x-forwarded-for
// (puede venir "ip_cliente, proxy1, proxy2"; nos quedamos la primera).
function ipDe(req) {
  const xff = req.headers['x-forwarded-for'];
  if (xff) { return String(xff).split(',')[0].trim(); }
  return req.headers['x-real-ip'] || req.socket?.remoteAddress || 'desconocida';
}

// Para el nombre de archivo: deja solo caracteres seguros.
function limpio(s) {
  return String(s || '').replace(/[^a-zA-Z0-9.-]+/g, '-').slice(0, 40) || 'x';
}

export default async function handler(req, res) {
  // Cada visita debe llegar al servidor: que el CDN no cachee la respuesta.
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Método no permitido.' });
  }

  // En Vercel basta con tener el store de Blob conectado al proyecto: la v2 de
  // @vercel/blob usa el token OIDC del proyecto + BLOB_STORE_ID.
  if (!process.env.BLOB_READ_WRITE_TOKEN && !process.env.BLOB_STORE_ID) {
    return res.status(503).json({
      error: 'Falta el Blob: conecta un store de Blob a este proyecto en Vercel y vuelve a desplegar.',
    });
  }

  try {
    const ahora = new Date();
    const iso = ahora.toISOString();          // 2026-10-06T12:34:56.789Z
    const dia = iso.slice(0, 10);             // 2026-10-06
    const ip = ipDe(req);

    // El visitante dice en qué página está con ?p=home / ?p=stats...
    const pagina = (req.query && req.query.p) ? String(req.query.p) : '';

    const registro = {
      ip,
      hora: iso,
      hora_madrid: ahora.toLocaleString('es-ES', { timeZone: 'Europe/Madrid' }),
      pagina,
      navegador: req.headers['user-agent'] || '',
      idioma: req.headers['accept-language'] || '',
      referer: req.headers['referer'] || '',
      pais: req.headers['x-vercel-ip-country'] || '',       // los pone el proxy de Vercel
      ciudad: req.headers['x-vercel-ip-city'] || '',
    };

    // Nombre ordenable por fecha y único; carpeta por día para que el panel de
    // Blob quede ordenado: visitas/2026-10-06/2026-10-06T12-34-56-789Z__1-2-3-4__ab12.json
    const sello = iso.replace(/[:.]/g, '-');
    const rnd = Math.random().toString(36).slice(2, 6);
    const ruta = `visitas/${dia}/${sello}__${limpio(ip)}__${rnd}.json`;

    await put(ruta, JSON.stringify(registro, null, 2), {
      access: 'private',              // privado: solo visible desde el panel de Blob / con token
      contentType: 'application/json; charset=utf-8',
      addRandomSuffix: false,
    });

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error del servidor: ' + err.message });
  }
}
