// Registro de visitas con fines educativos, en Upstash Redis (mucho más barato
// que un archivo por visita: un contador + una lista de las últimas visitas).
// Por cada carga de página sumamos 1 al total, 1 al día, y guardamos IP + hora
// al principio de una lista que recortamos a las últimas 5000.
import { Redis } from '@upstash/redis';

function redisDesdeEnv() {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!url || !token) { return null; }
  return new Redis({ url, token });
}

// La IP real del visitante la pone el proxy de Vercel en x-forwarded-for.
function ipDe(req) {
  const xff = req.headers['x-forwarded-for'];
  if (xff) { return String(xff).split(',')[0].trim(); }
  return req.headers['x-real-ip'] || req.socket?.remoteAddress || 'desconocida';
}

const LOG_MAX = 5000;

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Método no permitido.' });
  }

  const redis = redisDesdeEnv();
  if (!redis) {
    return res.status(503).json({
      error: 'Falta Redis: instala la integración Upstash en Vercel y conéctala a este proyecto.',
    });
  }

  try {
    const ahora = new Date();
    const iso = ahora.toISOString();
    const dia = iso.slice(0, 10);

    const registro = {
      ip: ipDe(req),
      hora: iso,
      hora_madrid: ahora.toLocaleString('es-ES', { timeZone: 'Europe/Madrid' }),
      pagina: (req.query && req.query.p) ? String(req.query.p) : '',
      navegador: req.headers['user-agent'] || '',
      pais: req.headers['x-vercel-ip-country'] || '',
      ciudad: req.headers['x-vercel-ip-city'] || '',
    };

    const p = redis.pipeline();
    p.incr('visitas:total');
    p.incr('visitas:dia:' + dia);
    p.lpush('visitas:log', registro);     // @upstash/redis serializa el objeto solo
    p.ltrim('visitas:log', 0, LOG_MAX - 1);
    await p.exec();

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error del servidor: ' + err.message });
  }
}
