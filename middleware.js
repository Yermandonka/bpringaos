// Bloquea el acceso directo al JSON crudo de estadísticas: todo debe pasar por
// /api/stats, que filtra según la clave. Sin esto, cualquiera podría bajar el
// archivo entero y saltarse el control de acceso.
export const config = { matcher: '/data/stats.json' };

export default function middleware() {
  return new Response('No disponible.', {
    status: 404,
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });
}
