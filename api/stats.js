// Sirve las estadísticas con control de acceso.
//   · Sin clave → solo los perfiles públicos (german) con datos completos;
//     del resto solo el nombre, marcado como bloqueado (para el menú).
//   · Con la clave correcta (variable secreta BP_CLAVE en Vercel) → todo.
// El archivo crudo data/stats.json queda bloqueado por middleware.js, así que
// este endpoint es la única puerta a los datos.
import data from '../data/stats.json' with { type: 'json' };

// Perfiles accesibles SIN contraseña.
const PUBLICOS = ['german'];

function autorizado(req) {
  const clave = process.env.BP_CLAVE;
  if (!clave) { return false; }               // sin clave configurada, todo bloqueado salvo lo público
  const q = (req.query && (req.query.c || req.query.clave)) || '';
  const h = req.headers['x-clave'] || '';
  return q === clave || h === clave;
}

export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  const authed = autorizado(req);

  // Índice para el menú: nombre de TODOS (visibles), con marca de bloqueo.
  const menu = Object.entries(data.people || {}).map(function ([key, p]) {
    return {
      key,
      display: p.display || key,
      locked: !authed && !PUBLICOS.includes(key),
    };
  });

  if (authed) {
    return res.status(200).json({ ...data, menu, authed: true });
  }

  // No autorizado: solo datos de los perfiles públicos.
  const people = {};
  for (const k of PUBLICOS) {
    if (data.people && data.people[k]) { people[k] = data.people[k]; }
  }

  return res.status(200).json({
    generated: data.generated,
    n_tournaments_scanned: data.n_tournaments_scanned,
    n_people: data.n_people,
    tournaments_scanned: data.tournaments_scanned,
    people,
    menu,
    authed: false,
  });
}
