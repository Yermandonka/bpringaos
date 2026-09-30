#!/usr/bin/env python3
"""Detecta si alguna persona objetivo está en un torneo EN DIRECTO y, para las
rondas ya emparejadas (cerradas), predice cuántos puntos ha sacado y estudia a
sus rivales. Escribe data/live.json (lo lee la web; el panel solo se ve si live=true).

Estrategia:
  1. Una llamada por host a /api/v1/tournaments → detecta torneos con current_rounds
     activos (= torneo en marcha). Añade también el torneo más reciente de cada
     persona (por si estamos entre rondas).
  2. Para cada torneo candidato, comprueba si la persona debate en él.
  3. Para cada ronda con emparejamiento: si hay resultado confirmado → puntos reales;
     si no → predice el puesto ordenando los 4 equipos de la sala por su rendimiento
     en rondas anteriores del torneo (puntos y speaks acumulados).
  4. Estudia a los rivales de la sala más reciente.
"""
import json
import re
import sys
import unicodedata
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from fetch import get  # reutiliza el GET con reintentos
from analyze import TARGETS, matches, norm, SIDE_ES

ROOT = Path(__file__).resolve().parent.parent
RANK_PTS = {0: 3, 1: 2, 2: 1, 3: 0}  # puesto 0=1º→3pts … 3=4º→0pts
RANK_TXT = {3: "1º", 2: "2º", 1: "3º", 0: "4º"}


def candidate_hosts():
    hosts = set()
    for f in ROOT.glob("data/sites_*.json"):
        try:
            for s in json.loads(f.read_text()):
                hosts.add(s["base"].rstrip("/"))
        except Exception:
            pass
    return sorted(hosts)


def active_tournaments(base):
    """Devuelve [(base, slug, name, current_round_seq)] con torneos en marcha."""
    ts = get(f"{base}/api/v1/tournaments", retries=1, timeout=12)
    out = []
    for t in ts or []:
        cur = t.get("current_rounds") or []
        if cur:
            out.append((base, t["slug"], t.get("name", ""), t))
    return out


def recent_from_stats():
    """El torneo más reciente de cada persona según stats.json (por si entre rondas)."""
    p = ROOT / "data" / "stats.json"
    out = []
    if not p.exists():
        return out
    stats = json.loads(p.read_text())
    for person in (stats.get("people") or {}).values():
        ts = person.get("tournaments") or []
        if ts:
            last = sorted(ts, key=lambda x: x.get("date") or "")[-1]
            slug = last["slug"]
            base = "https://" + slug.split("__")[0] + ".calicotab.com"
            real_slug = slug.split("__", 1)[1]
            out.append((base, real_slug))
    return out


def pick_ballot(ballots):
    if not ballots:
        return None
    confirmed = [b for b in ballots if b.get("confirmed")]
    return (confirmed or ballots)[-1]


def analyze_tournament(base, slug):
    api = f"{base}/api/v1/tournaments/{slug}"
    t = get(api, retries=1)
    if not t:
        return None
    speakers = {s["url"]: s for s in (get(f"{api}/speakers") or [])}
    teams = {tm["url"]: tm for tm in (get(f"{api}/teams") or [])}
    rounds = get(f"{api}/rounds") or []
    motions = get(f"{api}/motions") or []
    institutions = {i["url"]: i for i in (get(f"{api}/institutions") or [])}

    motion_by_seq = {}
    for m in motions:
        for link in m.get("rounds", []):
            try:
                rseq = int(str(link.get("round", "")).rstrip("/").rsplit("/", 1)[1])
            except (ValueError, IndexError):
                rseq = link.get("seq")
            motion_by_seq[rseq] = m.get("text")

    # ¿qué personas objetivo debaten aquí?
    target_urls = {}
    for surl, s in speakers.items():
        for tg in TARGETS:
            if matches(tg, s.get("name", "")):
                target_urls[surl] = tg["key"]
    if not target_urls:
        return None

    # equipos de cada persona
    person_teams = {}
    for tm in teams.values():
        for sp in tm.get("speakers", []) or []:
            key = target_urls.get(sp.get("url"))
            if key:
                person_teams.setdefault(key, set()).add(tm["url"])

    # descargar pairings+ballots por ronda (solo con draw)
    rounds_sorted = sorted(rounds, key=lambda r: r.get("seq") or 0)
    round_data = {}
    for r in rounds_sorted:
        seq = r.get("seq")
        pairings = get(f"{api}/rounds/{seq}/pairings")
        if not pairings:
            continue
        for p in pairings:
            p["ballots"] = get(f"{api}/rounds/{seq}/pairings/{p['id']}/ballots")
        round_data[seq] = {"round": r, "pairings": pairings}

    # rendimiento acumulado por equipo hasta la ronda X (solo prelim con resultado)
    def perf_before(seq_limit):
        acc = {}  # team_url -> [points, speaks, n]
        for seq, rd in round_data.items():
            if seq >= seq_limit or (rd["round"].get("stage") != "P"):
                continue
            for p in rd["pairings"]:
                b = pick_ballot(p.get("ballots"))
                if not b or not b.get("result"):
                    continue
                for sheet in b["result"].get("sheets", []):
                    for st in sheet.get("teams", []):
                        a = acc.setdefault(st.get("team"), [0, 0.0, 0])
                        if st.get("points") is not None:
                            a[0] += st["points"]
                        a[1] += (st.get("score") or 0)
                        a[2] += 1
        return acc

    results = {}
    for key in person_teams:
        results[key] = build_person_live(
            key, person_teams[key], round_data, rounds_sorted, teams, speakers,
            institutions, motion_by_seq, perf_before, t, base, slug)
    return results


def team_label(tm):
    return tm.get("short_name") or tm.get("long_name") or tm.get("reference") or "¿?"


def build_person_live(key, my_team_urls, round_data, rounds_sorted, teams, speakers,
                      institutions, motion_by_seq, perf_before, t, base, slug):
    my_rounds = []
    latest_room = None
    predicted_total = actual_total = 0

    for r in rounds_sorted:
        seq = r.get("seq")
        rd = round_data.get(seq)
        if not rd:
            continue
        # localizar la sala de la persona
        my_pairing = None
        for p in rd["pairings"]:
            if any(tt.get("team") in my_team_urls for tt in (p.get("teams") or [])):
                my_pairing = p
                break
        if not my_pairing:
            continue

        room_teams = my_pairing.get("teams") or []
        my_side = next((tt.get("side") for tt in room_teams if tt.get("team") in my_team_urls), None)
        ballot = pick_ballot(my_pairing.get("ballots"))

        entry = {"seq": seq, "name": r.get("name") or f"Ronda {seq}",
                 "stage": r.get("stage"), "side": my_side,
                 "side_label": SIDE_ES.get(my_side, my_side or ""),
                 "motion": motion_by_seq.get(seq)}

        if ballot and ballot.get("result") and ballot["result"].get("sheets"):
            # resultado real disponible
            sheet = ballot["result"]["sheets"][0]
            mine = next((st for st in sheet.get("teams", []) if st.get("team") in my_team_urls), None)
            pts = mine.get("points") if mine else None
            entry.update(status="resultado", my_points=pts,
                         my_rank=RANK_TXT.get(pts) if pts is not None else None)
            if pts is not None:
                actual_total += pts
        else:
            # PREDICCIÓN: ordenar los 4 equipos por rendimiento previo
            perf = perf_before(seq)
            ranked = sorted(
                room_teams,
                key=lambda tt: (perf.get(tt.get("team"), [0, 0, 0])[0],
                                perf.get(tt.get("team"), [0, 0, 0])[1]),
                reverse=True)
            pos = next((i for i, tt in enumerate(ranked) if tt.get("team") in my_team_urls), None)
            pred_pts = RANK_PTS.get(pos) if pos is not None else None
            # confianza: separación de speaks entre equipos de la sala
            speaks = sorted([perf.get(tt.get("team"), [0, 0, 0])[1] for tt in room_teams], reverse=True)
            spread = (speaks[0] - speaks[-1]) if len(speaks) > 1 else 0
            has_history = any(perf.get(tt.get("team"), [0, 0, 0])[2] for tt in room_teams)
            conf = "alta" if spread > 8 else "media" if spread > 3 else "baja"
            if not has_history:
                conf = "baja"
            entry.update(status="prediccion", predicted_points=pred_pts,
                         predicted_rank=RANK_TXT.get(pred_pts) if pred_pts is not None else None,
                         confidence=conf)
            if pred_pts is not None:
                predicted_total += pred_pts

        # estudiar rivales (guardamos la sala más reciente)
        perf = perf_before(seq + 1)
        rivals = []
        for tt in room_teams:
            if tt.get("team") in my_team_urls:
                continue
            tm = teams.get(tt.get("team"), {})
            p = perf.get(tt.get("team"), [0, 0, 0])
            spk_names = [sp.get("name") for sp in tm.get("speakers", []) if sp.get("name")]
            inst = institutions.get(tm.get("institution"), {}).get("name") if tm.get("institution") else None
            avg = round(p[1] / p[2], 1) if p[2] else None
            rivals.append({
                "team": team_label(tm), "side": tt.get("side"),
                "side_label": SIDE_ES.get(tt.get("side"), tt.get("side") or ""),
                "institution": inst, "speakers": spk_names,
                "points_so_far": p[0], "avg_speaks": avg,
                "threat": "alta" if (avg or 0) >= 76 else "media" if (avg or 0) >= 72 else "baja",
            })
        latest_room = {"seq": seq, "name": entry["name"], "motion": entry["motion"],
                       "my_side_label": entry["side_label"], "rivals": rivals}
        my_rounds.append(entry)

    if not my_rounds:
        return None
    return {
        "live": True,
        "tournament": {"name": t.get("name"), "base": base, "slug": slug},
        "my_team": next((team_label(teams.get(u, {})) for u in my_team_urls if u in teams), "?"),
        "rounds": my_rounds,
        "predicted_total": predicted_total,
        "actual_total": actual_total,
        "latest_room": latest_room,
    }


def main():
    hosts = candidate_hosts()
    print(f"escaneando {len(hosts)} hosts en busca de torneos activos…", file=sys.stderr)
    actives = []
    with ThreadPoolExecutor(max_workers=16) as ex:
        for res in ex.map(active_tournaments, hosts):
            actives.extend(res)
    cand = {(b, s) for (b, s, *_ ) in actives}
    cand |= set(recent_from_stats())
    print(f"{len(cand)} torneos candidatos", file=sys.stderr)

    people = {tg["key"]: {"live": False, "display": tg["display"]} for tg in TARGETS}
    for base, slug in cand:
        try:
            res = analyze_tournament(base, slug)
        except Exception as e:
            print(f"!! {base}/{slug}: {e}", file=sys.stderr)
            continue
        if not res:
            continue
        for key, data in res.items():
            if data and (not people[key]["live"] or True):
                data["display"] = people[key]["display"]
                people[key] = data

    out = {"people": people}
    (ROOT / "data" / "live.json").write_text(json.dumps(out, ensure_ascii=False, indent=1))
    for k, v in people.items():
        if v.get("live"):
            print(f"{k}: EN DIRECTO en {v['tournament']['name']} · {len(v['rounds'])} rondas")
        else:
            print(f"{k}: sin torneo activo")


if __name__ == "__main__":
    main()
