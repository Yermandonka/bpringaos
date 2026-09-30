#!/usr/bin/env python3
"""Añade break_categories a los raw ya descargados que no la tengan."""
import json
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from fetch import get

RAW = Path(__file__).resolve().parent.parent / "data" / "raw"

def patch(f):
    d = json.loads(f.read_text())
    if "break_categories" in d:
        return f"skip {f.name}"
    d["break_categories"] = get(f'{d["base"]}/api/v1/tournaments/{d["slug"]}/break-categories')
    f.write_text(json.dumps(d, ensure_ascii=False))
    return f"ok {f.name}"

with ThreadPoolExecutor(max_workers=8) as ex:
    for r in ex.map(patch, sorted(RAW.glob("*.json"))):
        print(r, flush=True)
