# bpringaos.com

Estadísticas descaradamente sofisticadas del circuito BP en español, con estética
naranja/negro (Comunícate UCM) y humor interdimensional.

**Web:** https://yermandonka.github.io/bpringaos/ (→ bpringaos.com cuando el DNS esté listo)

## Estructura

- `index.html` — portada con menú hamburguesa de perfiles.
- `stats.html?p=<clave>` — el expediente: deck horizontal, una estadística por pantalla.
- `assets/` — estilos, JS de portada y del deck.
- `scraper/` — pipeline de datos:
  - `discover.py hosts.txt out.json` — dado un fichero de hosts, lista los torneos de cada instancia.
  - `brute.sh hosts.txt` — comprueba en paralelo qué subdominios de calicotab existen.
  - `fetch.py sites.json` — descarga rondas, mociones, equipos, oradores, jueces y ballots a `data/raw/`.
  - `analyze.py` — cruza todo, busca a las personas objetivo (matching difuso de nombres) y escribe `data/stats.json`.
- `data/raw/` — JSON crudo por torneo (~150 torneos hispanos).

## Actualizar datos

```bash
python3 scraper/fetch.py data/sites_agent.json   # se salta lo ya descargado
python3 scraper/analyze.py
git add data && git commit -m "datos frescos" && git push
```

Para añadir una persona: nueva entrada en `TARGETS` de `scraper/analyze.py`
(tokens `required_all` + variantes en `required_any`), re-ejecutar `analyze.py`,
y aparece sola en el menú.

## Dominio

El repo se sirve con GitHub Pages. Para activar bpringaos.com: apuntar el DNS
(A: 185.199.108.153/109/110/111 o CNAME a `yermandonka.github.io`) y volver a
añadir el fichero `CNAME` con `bpringaos.com`.
