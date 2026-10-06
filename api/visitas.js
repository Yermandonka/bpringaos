// Ver las visitas registradas. Protegido con la misma clave secreta (BP_CLAVE).
// Uso: /api/visitas?c=TU_CLAVE   (opcional &n=500 para cuántas listar)
import { Redis } from '@upstash/redis';

function redisDesdeEnv() {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!url || !token) { return null; }
  return new Redis({ url, token });
}

function autorizado(req) {
  const clave = process.env.BP_CLAVE;
  if (!clave) { return false; }
  const q = (req.query && (req.query.c || req.query.clave)) || '';
  const h = req.headers['x-clave'] || '';
  return q === clave || h === clave;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (!autorizado(req)) {
    return res.status(401).json({ error: 'Clave incorrecta o ausente. Usa /api/visitas?c=TU_CLAVE' });
  }

  const redis = redisDesdeEnv();
  if (!redis) {
    return res.status(503).json({ error: 'Falta Redis: instala la integración Upstash en Vercel.' });
  }

  try {
    const n = Math.min(Math.max(parseInt(req.query.n, 10) || 200, 1), 2000);
    const hoy = new Date().toISOString().slice(0, 10);

    const [total, deHoy, log] = await Promise.all([
      redis.get('visitas:total'),
      redis.get('visitas:dia:' + hoy),
      redis.lrange('visitas:log', 0, n - 1),
    ]);

    // @upstash/redis deserializa los objetos guardados automáticamente.
    const visitas = (log || []).map(function (x) {
      if (x && typeof x === 'object') { return x; }
      try { return JSON.parse(x); } catch (e) { return { raw: x }; }
    });

    return res.status(200).json({
      total: total || 0,
      hoy: deHoy || 0,
      mostradas: visitas.length,
      visitas,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error del servidor: ' + err.message });
  }
}
