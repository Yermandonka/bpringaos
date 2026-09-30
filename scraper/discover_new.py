#!/usr/bin/env python3
"""Auto-descubrimiento de torneos NUEVOS en calicotab.

A partir de los hosts ya conocidos (data/sites_*.json) genera candidatos para la
siguiente edición de cada serie: incrementa el número romano (V→VI) y el año
(2025→2026/2027). Prueba cada candidato contra la API y añade los que existan a
data/sites_auto.json. Así, cuando salga "VII BP Complu" o "CMUDE 2027", entran
solos en el siguiente pase.
"""
import json
import re
import sys
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ROMAN = ["i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix", "x",
         "xi", "xii", "xiii", "xiv", "xv", "xvi", "xvii", "xviii", "xix", "xx"]
ROMAN_NEXT = {ROMAN[i]: ROMAN[i + 1] for i in range(len(ROMAN) - 1)}


def known_hosts():
    hosts = set()
    for f in ROOT.glob("data/sites_*.json"):
        try:
            for s in json.loads(f.read_text()):
                hosts.add(s["base"].split("//")[1].split(".")[0])
        except Exception:
            pass
    return hosts


def candidates(host):
    """Genera hosts de la posible siguiente edición."""
    out = set()
    # año: sube +1 y +2
    for y in re.findall(r"20\d\d", host):
        yi = int(y)
        for ny in (yi + 1, yi + 2):
            out.add(host.replace(y, str(ny)))
    # dos dígitos de año (24 → 25, 26)
    m = re.search(r"(?<!\d)(2[0-9])(?!\d)", host)
    if m:
        yi = int(m.group(1))
        for ny in (yi + 1, yi + 2):
            out.add(host[:m.start()] + str(ny) + host[m.end():])
    # número romano al principio (vbpcomplu → vibpcomplu)
    m = re.match(r"^(i|ii|iii|iv|v|vi|vii|viii|ix|x|xi|xii|xiii|xiv|xv|xvi|xvii|xviii|xix)(?=[a-z])", host)
    if m and m.group(1) in ROMAN_NEXT:
        out.add(ROMAN_NEXT[m.group(1)] + host[m.end():])
    # número romano al final (gaduab no; aduziv → aduzv)
    m = re.search(r"(i|ii|iii|iv|v|vi|vii|viii|ix|x|xi|xii|xiii|xiv|xv|xvi|xvii|xviii|xix)$", host)
    if m and m.group(1) in ROMAN_NEXT:
        out.add(host[:m.start()] + ROMAN_NEXT[m.group(1)])
    out.discard(host)
    return out


def probe(host):
    url = f"https://{host}.calicotab.com/api/v1/tournaments"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "bpringaos/1.0"})
        with urllib.request.urlopen(req, timeout=12) as r:
            ts = json.loads(r.read().decode())
        if ts:
            return {"base": f"https://{host}.calicotab.com",
                    "tournaments": [{"slug": t["slug"], "name": t["name"]} for t in ts]}
    except Exception:
        return None
    return None


def main():
    known = known_hosts()
    cands = set()
    for h in known:
        cands |= candidates(h)
    cands -= known
    print(f"{len(known)} hosts conocidos → {len(cands)} candidatos a probar", file=sys.stderr)
    found = []
    with ThreadPoolExecutor(max_workers=16) as ex:
        for res in ex.map(probe, sorted(cands)):
            if res:
                found.append(res)
                print("NUEVO:", res["base"], file=sys.stderr)
    if found:
        dest = ROOT / "data" / "sites_auto.json"
        existing = []
        if dest.exists():
            existing = json.loads(dest.read_text())
        seen = {s["base"] for s in existing}
        existing += [f for f in found if f["base"] not in seen]
        dest.write_text(json.dumps(existing, ensure_ascii=False, indent=1))
    print(f"{len(found)} torneos nuevos añadidos")


if __name__ == "__main__":
    main()
