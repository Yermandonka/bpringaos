#!/usr/bin/env python3
"""Auto-descubrimiento de torneos NUEVOS en calicotab.

Dos estrategias, las dos baratas (un 404 de calicotab tarda menos de 1 s):

1. REESCANEAR los hosts ya conocidos. Una instancia como bpeliasahuja.calicotab.com
   acumula ediciones como slugs nuevos (ahuja23, ahuja24, ...). Se vuelve a pedir
   /api/v1/tournaments a cada host conocido y se apuntan los slugs que no teníamos.

2. GENERAR CANDIDATOS de "siguiente edición" a partir de las SERIES conocidas.
   De cada host, slug y nombre de torneo se extrae un tallo (sin año, sin número
   romano, sin acentos ni espacios): "bpeliasahuja2022", "ahuja24" y
   "BP Elías Ahuja 2024" dan los tallos "bpeliasahuja", "ahuja" y "bpeliasahuja".
   Para cada tallo se prueban combinaciones con el AÑO ACTUAL y el siguiente
   (la versión anterior sumaba +1/+2 al año del host, así que de bpeliasahuja2022
   solo salían 2023 y 2024 y nunca bpeliasahuja2026), con el año en dos cifras,
   con el siguiente número romano de la serie (prefijo y sufijo), con la siguiente
   edición en arábigo (toex14 → toex15), con y sin el prefijo "bp", y el tallo a pelo.

Los hallazgos van a data/sites_auto.json (el workflow los mezcla con el resto).

Uso: python3 discover_new.py [--dry-run] [--year 2026] [--show HOST] [--ignore HOST]
  --dry-run      genera candidatos y no toca la red
  --show HOST    dice si HOST está entre los candidatos y de qué tallo sale
  --ignore HOST  finge que HOST no se conoce (para probar que lo encontraríamos)
  --no-rescan    salta el reescaneo de hosts conocidos
"""
import argparse
import datetime as dt
import json
import re
import sys
import unicodedata
import urllib.request
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
DEST = DATA / "sites_auto.json"

ROMAN = ["i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix", "x",
         "xi", "xii", "xiii", "xiv", "xv", "xvi", "xvii", "xviii", "xix", "xx",
         "xxi", "xxii", "xxiii", "xxiv", "xxv"]
ROMAN_IDX = {r: i + 1 for i, r in enumerate(ROMAN)}          # "iv" -> 4
RE_ROMAN = r"(?:x{0,2}(?:ix|iv|v?i{0,3}))"                   # i..xxxix (puede ser vacío)
STOP = {"de", "del", "la", "el", "los", "las", "y", "e", "en", "edicion", "torneo",
        "campeonato", "copa", "open", "abierto"}
HEADERS = {"User-Agent": "bpringaos/1.1 (descubrimiento de torneos; contacto lufrossard@yahoo.es)"}
HOST_OK = re.compile(r"^[a-z0-9][a-z0-9-]{2,62}$")


def norm(s):
    """minúsculas, sin acentos, solo [a-z0-9]."""
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", "", s)


# ----------------------------------------------------------------------------
# series conocidas
# ----------------------------------------------------------------------------
class Series:
    """Lo que sabemos de un tallo: ediciones vistas y formatos de host usados."""
    __slots__ = ("years", "roman_pre", "roman_suf", "edition", "bare", "yy", "sources")

    def __init__(self):
        self.years = set()        # años de 4 cifras vistos
        self.yy = False           # ¿se ha visto año de 2 cifras (ahuja24)?
        self.roman_pre = 0        # mayor romano como prefijo (xibpuam → 11)
        self.roman_suf = 0        # mayor romano como sufijo (usciv → 4)
        self.edition = 0          # mayor edición arábiga (toex14 → 14)
        self.bare = False         # ¿existe el tallo a pelo como host?
        self.sources = set()


def load_known():
    """hosts conocidos → {host: {slug: name}}"""
    known = defaultdict(dict)
    for f in sorted(DATA.glob("sites_*.json")):
        try:
            for s in json.loads(f.read_text()):
                host = s["base"].split("//")[1].split(".")[0].lower()
                for t in s.get("tournaments", []):
                    known[host][t["slug"]] = t.get("name", "")
                known[host]  # asegura la clave aunque no tenga torneos
        except Exception as e:
            print(f"  (salto {f.name}: {e})", file=sys.stderr)
    return known


def split_compact(tok):
    """Descompone un host/slug compacto: ('tallo', dict de meta).

    bpeliasahuja2022 → bpeliasahuja {year 2022}
    ahuja24          → ahuja        {yy 24}
    xibpuam          → bpuam        {roman_pre 11}
    usciv            → usc          {roman_suf 4}
    toex14           → toex         {edition 14}
    """
    h = tok.lower()
    meta = {}
    m = re.search(r"(20[1-3]\d)", h)
    if m:
        meta["year"] = int(m.group(1))
        h = h[:m.start()] + h[m.end():]
    else:
        m = re.search(r"(?<![0-9])(1[89]|2[0-9]|3[0-5])$", h)
        if m:
            meta["yy"] = 2000 + int(m.group(1))
            h = h[:m.start()]
        else:
            m = re.search(r"(?<![0-9])(\d{1,2})$", h)
            if m:
                meta["edition"] = int(m.group(1))
                h = h[:m.start()]
    h = h.strip("-_")
    m = re.match(r"^(" + RE_ROMAN + r")(?=[a-z])", h)
    if m and m.group(1):
        meta["roman_pre"] = ROMAN_IDX.get(m.group(1), 0)
        meta["pre_len"] = len(m.group(1))
        h_pre = h[m.end():]
    else:
        h_pre = h
    m = re.search(r"(?<=[a-z])(" + RE_ROMAN + r")$", h_pre)
    if m and m.group(1):
        meta["roman_suf"] = ROMAN_IDX.get(m.group(1), 0)
        meta["suf_len"] = len(m.group(1))
        h_suf = h_pre[:m.start()]
    else:
        h_suf = h_pre
    return h, h_pre, h_suf, meta


def split_name(name):
    """Descompone un nombre legible: 'XI BP UAM' → ['bpuam'] + meta."""
    meta = {}
    rest = []
    for w in re.findall(r"[\w'-]+", name.lower()):
        wn = norm(w)
        if not wn:
            continue
        if wn in ROMAN_IDX and len(wn) <= 5:
            meta["roman_pre" if not rest else "roman_suf"] = max(
                meta.get("roman_pre" if not rest else "roman_suf", 0), ROMAN_IDX[wn])
        elif re.fullmatch(r"20[1-3]\d", wn):
            meta["year"] = int(wn)
        elif re.fullmatch(r"\d{1,2}", wn):
            n = int(wn)
            if 18 <= n <= 35:
                meta["yy"] = 2000 + n
            else:
                meta["edition"] = n
        else:
            rest.append(wn)
    full = "".join(rest)
    short = "".join(w for w in rest if w not in STOP)
    return {s for s in (full, short) if len(s) >= 3}, meta


def apply_meta(series, meta, source):
    if "year" in meta:
        series.years.add(meta["year"])
    if "yy" in meta:
        series.yy = True
        series.years.add(meta["yy"])
    series.roman_pre = max(series.roman_pre, meta.get("roman_pre", 0))
    series.roman_suf = max(series.roman_suf, meta.get("roman_suf", 0))
    series.edition = max(series.edition, meta.get("edition", 0))
    if not meta:
        series.bare = True
    series.sources.add(source)


def build_series(known):
    """Agrupa todo lo conocido en series por tallo."""
    series = defaultdict(Series)
    # pasada 1: tallos "seguros" (sin quitar romanos de una sola letra)
    compact = []
    for host, slugs in known.items():
        compact.append((host, f"host {host}"))
        for slug in slugs:
            compact.append((slug, f"slug {slug}@{host}"))
    safe = set()
    for tok, src in compact:
        h, h_pre, h_suf, meta = split_compact(tok)
        safe.add(h)
        if meta.get("pre_len", 0) >= 2:
            safe.add(h_pre)
        if meta.get("suf_len", 0) >= 2:
            safe.add(h_suf)
    for host, slugs in known.items():
        for slug, name in slugs.items():
            stems, _ = split_name(name or "")
            safe |= stems
    # pasada 2: aplicar; un romano de una letra ("i", "v", "x") solo se quita si lo que
    # queda ya es un tallo conocido (evita que "interpoli" se parta en i+nterpoli)
    for tok, src in compact:
        h, h_pre, h_suf, meta = split_compact(tok)
        stem = h
        m2 = dict(meta)
        if "roman_pre" in meta and (meta.get("pre_len", 0) >= 2 or h_pre in safe):
            stem = h_pre
            if "roman_suf" in meta and (meta.get("suf_len", 0) >= 2 or h_suf in safe):
                stem = h_suf
            else:
                m2.pop("roman_suf", None)
        elif "roman_suf" in meta and (meta.get("suf_len", 0) >= 2 or h_suf in safe):
            # sufijo sin prefijo: el sufijo cuelga de h (que no tiene prefijo quitado)
            stem = h[:len(h) - meta["suf_len"]]
            m2.pop("roman_pre", None)
        else:
            m2.pop("roman_pre", None)
            m2.pop("roman_suf", None)
        m2.pop("pre_len", None)
        m2.pop("suf_len", None)
        if len(stem) >= 3:
            apply_meta(series[stem], m2, src)
    for host, slugs in known.items():
        for slug, name in slugs.items():
            stems, meta = split_name(name or "")
            for s in stems:
                apply_meta(series[s], meta, f"nombre «{name}»@{host}")
    return series


# ----------------------------------------------------------------------------
# candidatos
# ----------------------------------------------------------------------------
def with_bp(stem):
    """variantes con/sin prefijo bp."""
    out = {stem}
    if stem.startswith("bp") and len(stem) > 5:
        out.add(stem[2:])
    else:
        out.add("bp" + stem)
    return out


def candidates(series, year):
    """{host_candidato: motivo}"""
    cands = {}
    years = (year, year + 1)

    def add(h, why):
        if HOST_OK.match(h) and h not in cands:
            cands[h] = why

    for stem, s in series.items():
        for st in with_bp(stem):
            # año actual y siguiente, en 4 y 2 cifras
            for y in years:
                if y not in s.years:
                    add(f"{st}{y}", f"{stem} + año {y}")
                    add(f"{st}{str(y)[2:]}", f"{stem} + año {str(y)[2:]}")
            # tallo a pelo (instancias que reutilizan host para cada edición)
            add(st, f"{stem} a pelo")
        # siguiente número romano de la serie (prefijo y sufijo)
        if s.roman_pre:
            for n in (s.roman_pre + 1, s.roman_pre + 2):
                if n <= len(ROMAN):
                    for st in with_bp(stem):
                        add(f"{ROMAN[n - 1]}{st}", f"{stem} + romano {ROMAN[n - 1].upper()} delante")
                        add(f"{ROMAN[n - 1]}{st}{year}", f"{stem} + romano {ROMAN[n - 1].upper()} delante + {year}")
        if s.roman_suf:
            for n in (s.roman_suf + 1, s.roman_suf + 2):
                if n <= len(ROMAN):
                    add(f"{stem}{ROMAN[n - 1]}", f"{stem} + romano {ROMAN[n - 1].upper()} detrás")
                    add(f"{stem}{ROMAN[n - 1]}{year}", f"{stem} + romano {ROMAN[n - 1].upper()} detrás + {year}")
        # edición arábiga (toex14 → toex15, toex16)
        if s.edition:
            for n in (s.edition + 1, s.edition + 2):
                add(f"{stem}{n}", f"{stem} + edición {n}")
    return cands


# ----------------------------------------------------------------------------
# red
# ----------------------------------------------------------------------------
def probe(host, timeout=12, tries=2):
    """Lista de torneos de un host, [] si existe pero vacío, None si no existe."""
    url = f"https://{host}.calicotab.com/api/v1/tournaments"
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers=HEADERS)
            with urllib.request.urlopen(req, timeout=timeout) as r:
                ts = json.loads(r.read().decode())
            return [{"slug": t["slug"], "name": t.get("name", t["slug"])} for t in ts]
        except urllib.error.HTTPError as e:
            if e.code in (404, 410):
                return None
            if i == tries - 1:
                return None
        except Exception:
            if i == tries - 1:
                return None
    return None


def save_auto(entries):
    existing = []
    if DEST.exists():
        try:
            existing = json.loads(DEST.read_text())
        except Exception:
            existing = []
    by_base = {s["base"]: s for s in existing}
    added = 0
    for e in entries:
        cur = by_base.get(e["base"])
        if cur is None:
            existing.append(e)
            by_base[e["base"]] = e
            added += len(e["tournaments"])
        else:
            have = {t["slug"] for t in cur["tournaments"]}
            for t in e["tournaments"]:
                if t["slug"] not in have:
                    cur["tournaments"].append(t)
                    added += 1
    DEST.write_text(json.dumps(existing, ensure_ascii=False, indent=1))
    return added


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--year", type=int, default=dt.date.today().year)
    ap.add_argument("--show", action="append", default=[])
    ap.add_argument("--ignore", action="append", default=[])
    ap.add_argument("--no-rescan", action="store_true")
    ap.add_argument("--workers", type=int, default=24)
    args = ap.parse_args()

    known = load_known()
    for h in args.ignore:
        known.pop(h.lower(), None)
    series = build_series(known)
    cands = candidates(series, args.year)
    for h in list(cands):
        if h in known:
            del cands[h]
    print(f"{len(known)} hosts conocidos · {len(series)} series · {len(cands)} candidatos", file=sys.stderr)

    for h in args.show:
        h = h.lower()
        if h in known:
            print(f"{h}: ya conocido", file=sys.stderr)
        elif h in cands:
            print(f"{h}: CANDIDATO ← {cands[h]}", file=sys.stderr)
        else:
            print(f"{h}: NO sale como candidato", file=sys.stderr)
    if args.dry_run:
        return

    found = []
    # 1. reescaneo de hosts conocidos: slugs nuevos en instancias que ya teníamos
    if not args.no_rescan:
        hosts = sorted(known)
        with ThreadPoolExecutor(max_workers=args.workers) as ex:
            for host, ts in zip(hosts, ex.map(probe, hosts)):
                if not ts:
                    continue
                new = [t for t in ts if t["slug"] not in known[host]]
                if new:
                    found.append({"base": f"https://{host}.calicotab.com", "tournaments": new})
                    for t in new:
                        print(f"NUEVO slug en {host}: {t['slug']} ({t['name']})", file=sys.stderr)
        print(f"reescaneo: {len(hosts)} hosts revisados", file=sys.stderr)

    # 2. candidatos de siguiente edición
    hosts = sorted(cands)
    n_ok = 0
    with ThreadPoolExecutor(max_workers=args.workers) as ex:
        for host, ts in zip(hosts, ex.map(probe, hosts)):
            if ts is None:
                continue
            n_ok += 1
            if ts:
                found.append({"base": f"https://{host}.calicotab.com", "tournaments": ts})
                print(f"NUEVO host: {host} ← {cands[host]}: "
                      + ", ".join(t["name"] for t in ts), file=sys.stderr)
            else:
                print(f"(existe pero vacío: {host})", file=sys.stderr)
    print(f"candidatos: {len(hosts)} probados, {n_ok} existen", file=sys.stderr)

    added = save_auto(found) if found else 0
    print(f"{added} torneos nuevos añadidos a {DEST.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
