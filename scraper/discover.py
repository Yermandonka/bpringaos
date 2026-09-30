#!/usr/bin/env python3
"""Dado un fichero con hosts (uno por línea), consulta /api/v1/tournaments y emite sites.json."""
import json, sys, urllib.request
from concurrent.futures import ThreadPoolExecutor

def probe(host):
    url = f"https://{host}/api/v1/tournaments"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "bpringaos/1.0"})
        with urllib.request.urlopen(req, timeout=20) as r:
            ts = json.loads(r.read().decode())
        return {"base": f"https://{host}", "tournaments": [{"slug": t["slug"], "name": t["name"]} for t in ts]}
    except Exception as e:
        print(f"!! {host}: {e}", file=sys.stderr)
        return None

hosts = [l.strip() for l in open(sys.argv[1]) if l.strip() and not l.startswith("#")]
with ThreadPoolExecutor(max_workers=10) as ex:
    sites = [s for s in ex.map(probe, hosts) if s]
json.dump(sites, open(sys.argv[2], "w"), ensure_ascii=False, indent=1)
print(f"{len(sites)} instancias OK de {len(hosts)}")
