#!/usr/bin/env python3
"""Borra de data/raw los torneos que pueden tener novedades, para que fetch.py los vuelva a bajar.

Se refresca un torneo si cumple alguna condición:
  1. lleva el año en curso o el anterior en el nombre o el slug;
  2. alguna de sus rondas empezó en los últimos 60 días (o está programada);
  3. no tiene fechas, le quedan rondas sin cerrar y nada en él apunta a un año viejo
     (p. ej. «XII BP URJC», descubierto vacío antes de empezar y sin año en el nombre).
Uso: python3 mark_refresh.py [--dry-run]
"""
import json
import re
import sys
from datetime import date, timedelta
from pathlib import Path

RAW = Path(__file__).resolve().parent.parent / "data" / "raw"
DAYS = 60


def needs_refresh(d, today):
    years = {str(today.year), str(today.year - 1)}
    label = ((d.get("tournament") or {}).get("name") or "") + " " + (d.get("slug") or "")
    if any(y in label for y in years):
        return True
    rounds = d.get("rounds") or []
    starts = [r["starts_at"][:10] for r in rounds if r.get("starts_at")]
    if starts:
        return max(starts) >= (today - timedelta(days=DAYS)).isoformat()
    if any(y not in years for y in re.findall(r"20[0-9]{2}", label + " " + (d.get("base") or ""))):
        return False
    return any(not r.get("completed") for r in rounds)


def main():
    dry = "--dry-run" in sys.argv
    marked = 0
    for f in sorted(RAW.glob("*.json")):
        try:
            d = json.loads(f.read_text())
        except Exception:
            continue
        if needs_refresh(d, date.today()):
            marked += 1
            if dry:
                print(f.name)
            else:
                f.unlink()
    print("marcados para refrescar:", marked)


if __name__ == "__main__":
    main()
