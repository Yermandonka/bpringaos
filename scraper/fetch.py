#!/usr/bin/env python3
"""Descarga datos públicos de instancias Tabbycat (calicotab) para bpringaos.

Para cada torneo guarda en data/raw/<host>__<slug>.json:
  tournament, rounds, motions, teams, speakers, venues, pairings+ballots por ronda.
Uso: python3 fetch.py sites.json
"""
import json
import sys
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

RAW = Path(__file__).resolve().parent.parent / "data" / "raw"
RAW.mkdir(parents=True, exist_ok=True)

HEADERS = {"User-Agent": "bpringaos-stats/1.0 (proyecto estadistico; contacto lufrossard@yahoo.es)"}


def get(url, retries=3, timeout=25):
    for i in range(retries):
        try:
            req = urllib.request.Request(url, headers=HEADERS)
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return json.loads(r.read().decode("utf-8"))
        except Exception as e:
            if i == retries - 1:
                print(f"  !! {url}: {e}", file=sys.stderr)
                return None
            time.sleep(1.5 * (i + 1))


def fetch_tournament(base, slug):
    api = f"{base}/api/v1/tournaments/{slug}"
    out = {"base": base, "slug": slug, "fetched_at": time.strftime("%Y-%m-%d")}
    t = get(api)
    if t is None:
        return None
    out["tournament"] = t
    for key, path in [
        ("rounds", "rounds"), ("motions", "motions"), ("teams", "teams"),
        ("speakers", "speakers"), ("venues", "venues"), ("adjudicators", "adjudicators"),
        ("team_standings", "teams/standings"), ("speaker_standings", "speakers/standings"),
        ("institutions", "institutions"),
    ]:
        out[key] = get(f"{api}/{path}")
    out["rounds_data"] = []
    for rnd in out.get("rounds") or []:
        seq = rnd.get("seq")
        pairings = get(f"{api}/rounds/{seq}/pairings") or []
        for p in pairings:
            ballots = get(f"{api}/rounds/{seq}/pairings/{p['id']}/ballots")
            p["ballots"] = ballots
        out["rounds_data"].append({"seq": seq, "pairings": pairings})
    return out


def main():
    sites = json.loads(Path(sys.argv[1]).read_text())
    jobs = []
    for site in sites:
        base = site["base"].rstrip("/")
        for t in site.get("tournaments", []):
            jobs.append((base, t["slug"]))
    print(f"{len(jobs)} torneos a descargar")

    def run(job):
        base, slug = job
        host = base.split("//")[1].split(".")[0]
        dest = RAW / f"{host}__{slug}.json"
        if dest.exists():
            return f"skip {dest.name}"
        data = fetch_tournament(base, slug)
        if data is None:
            return f"FAIL {base}/{slug}"
        dest.write_text(json.dumps(data, ensure_ascii=False))
        return f"ok   {dest.name} ({dest.stat().st_size//1024} KB)"

    with ThreadPoolExecutor(max_workers=6) as ex:
        futs = {ex.submit(run, j): j for j in jobs}
        for f in as_completed(futs):
            print(f.result(), flush=True)


if __name__ == "__main__":
    main()
