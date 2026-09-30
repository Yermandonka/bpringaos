#!/usr/bin/env python3
"""Cruza los JSON crudos de data/raw/ y produce data/stats.json con las
estadísticas de las personas objetivo (matching difuso de nombres)."""
import json
import re
import statistics
import sys
import unicodedata
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw"

TARGETS = [
    {
        "key": "german",
        "display": "Germán Mendonça Costa-Frossard",
        "required_any": [["mendon", "mendoc", "frossard", "frosard", "costa-fro"]],
        "required_all": ["german"],
    },
    {
        "key": "lucia",
        "display": "Lucía Vadillo",
        "required_any": [["vadillo", "badillo"]],
        "required_all": ["lucia"],
    },
]

SIDES = ["og", "oo", "cg", "co"]
SIDE_ES = {"og": "Alta Gobierno", "oo": "Alta Oposición", "cg": "Baja Gobierno", "co": "Baja Oposición"}

TOPIC_RULES = [
    ("rol / actor", r"\beres\b|\bte conviertes\b|\bte encuentras\b|\bdecides\b.*\btu\b|como (lider|líder|presidente|ceo|director)"),
    ("feminismo y género", r"mujer|género|genero|feminis|patriarc|machis|lgtb|lgbt|trans\b|queer|aborto"),
    ("psicología y salud mental", r"psicolog|salud mental|terapia|ansiedad|depresi|trauma|autoestima|emocion"),
    ("filosofía y ética", r"moral|ética|etica|filosof|virtud|deber\b|justo\b|libre albedr|existencia|nihilis|utilitaris"),
    ("religión", r"religi|iglesia|dios\b|fe\b|catolic|católic|islam|secular"),
    ("economía", r"econom|impuesto|mercado|salario|empresa|capitalis|renta\b|subsidi|inversion|inversión|criptomoneda|banco"),
    ("relaciones internacionales", r"internacional|onu\b|otan\b|guerra|sancion|país(es)? en desarrollo|potencia|diplom|frontera|migraci|refugiad|colonial"),
    ("política nacional", r"gobierno|estado\b|democracia|partido|eleccion|elección|votar|parlament|ley\b|constituci|politic|polític|ciudadan"),
    ("ciencia y tecnología", r"tecnolog|inteligencia artificial|\bia\b|algoritmo|red(es)? sociales|internet|datos|cient[íi]f|espacio|gen[ée]tic"),
    ("educación", r"educaci|escuela|universidad|estudiante|profesor|academi"),
    ("medios y cultura", r"arte\b|cine|música|musica|cultur|medios|prensa|periodis|celebrit|videojuego|deporte|f[úu]tbol"),
    ("medioambiente", r"clima|ambiental|ecolog|carbono|energ[íi]a|nuclear"),
]


def norm(s):
    s = unicodedata.normalize("NFKD", s or "").encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9 ]+", " ", s)


def matches(target, name):
    n = " " + norm(name) + " "
    for token in target["required_all"]:
        if token not in n:
            return False
    for group in target["required_any"]:
        if not any(g in n for g in group):
            return False
    return True


def classify_motion(text, info_slide=""):
    t = norm(text) + " " + norm(info_slide or "")
    for topic, rx in TOPIC_RULES:
        if re.search(rx, t):
            return topic
    return "otros"


def pick_ballot(ballots):
    if not ballots:
        return None
    confirmed = [b for b in ballots if b.get("confirmed")]
    return (confirmed or ballots)[-1]


def is_online(data):
    names = " ".join(norm(v.get("name", "")) for v in (data.get("venues") or []))
    tname = norm(data["tournament"].get("name", "")) + " " + norm(data["slug"])
    if re.search(r"zoom|meet|discord|jitsi|http|sala virtual|craft", names + " " + tname):
        return True
    return False


def tournament_date(data):
    dates = [r.get("starts_at") for r in (data.get("rounds") or []) if r.get("starts_at")]
    if dates:
        return min(dates)[:10]
    m = re.search(r"(20\d\d)", data["tournament"].get("name", "") + data["slug"] + data["base"])
    return f"{m.group(1)}-01-01" if m else None


def load_tournaments():
    out = []
    for f in sorted(RAW.glob("*.json")):
        try:
            out.append(json.loads(f.read_text()))
        except Exception as e:
            print(f"!! {f.name}: {e}", file=sys.stderr)
    return out


def build():
    tournaments = load_tournaments()
    people = {t["key"]: {"target": t, "rows": [], "elim_rows": [], "tournaments": {},
                         "team_urls": {}, "breaks": []} for t in TARGETS}
    all_speaker_rows = 0

    for data in tournaments:
        tslug = f'{data["base"].split("//")[1].split(".")[0]}__{data["slug"]}'
        tname = data["tournament"]["name"]
        online = is_online(data)
        tdate = tournament_date(data)

        speakers = {s["url"]: s for s in (data.get("speakers") or [])}
        teams = {t["url"]: t for t in (data.get("teams") or [])}
        venues = {v["url"]: v for v in (data.get("venues") or [])}
        rounds = {r["url"]: r for r in (data.get("rounds") or [])}
        rounds_by_seq = {r["seq"]: r for r in (data.get("rounds") or [])}
        adjs = {a["url"]: a for a in (data.get("adjudicators") or [])} if data.get("adjudicators") else {}

        motion_by_round_seq = {}
        for m in data.get("motions") or []:
            for link in m.get("rounds", []):
                # el nº de ronda va en la URL (…/rounds/N); link["seq"] es el
                # orden de la moción dentro de la ronda (casi siempre 1)
                try:
                    rseq = int(str(link.get("round", "")).rstrip("/").rsplit("/", 1)[1])
                except (ValueError, IndexError):
                    rseq = link.get("seq")
                motion_by_round_seq[rseq] = m

        # media de speaks del torneo (contexto para percentiles)
        t_scores = []

        target_speaker_urls = {}  # url -> person key
        for surl, s in speakers.items():
            for t in TARGETS:
                if matches(t, s.get("name", "")):
                    target_speaker_urls[surl] = t["key"]

        for rd in data.get("rounds_data") or []:
            seq = rd["seq"]
            rnd = rounds_by_seq.get(seq, {})
            stage = rnd.get("stage", "P")
            rname = rnd.get("name") or f"Ronda {seq}"
            motion = motion_by_round_seq.get(seq)
            mtext = motion.get("text") if motion else None
            mtopic = classify_motion(mtext or "", motion.get("info_slide_plain") or motion.get("info_slide") if motion else "")

            for p in rd.get("pairings") or []:
                ballot = pick_ballot(p.get("ballots"))
                if not ballot or not ballot.get("result"):
                    continue
                sheets = ballot["result"].get("sheets") or []
                if not sheets:
                    continue
                sheet = sheets[0]
                steams = sheet.get("teams") or []
                # ranking de las 8 intervenciones de la sala
                room_scores = []
                for st in steams:
                    for sp in st.get("speeches") or []:
                        if sp.get("score") is not None and not sp.get("ghost"):
                            room_scores.append(sp["score"])
                if stage == "P":
                    t_scores.extend(room_scores)

                chair_url = (p.get("adjudicators") or {}).get("chair")
                chair = adjs.get(chair_url, {}).get("name") if chair_url else None
                venue = venues.get(p.get("venue"), {}).get("name")

                for st in steams:
                    team = teams.get(st.get("team"), {})
                    speeches = st.get("speeches") or []
                    for idx, sp in enumerate(speeches):
                        key = target_speaker_urls.get(sp.get("speaker"))
                        if not key:
                            continue
                        mate = None
                        for tm_s in team.get("speakers", []):
                            if tm_s.get("url") != sp.get("speaker") and matches_name_not_anon(tm_s):
                                mate = tm_s.get("name")
                        score = sp.get("score")
                        row = {
                            "t": tslug, "tname": tname, "date": tdate, "online": online,
                            "round": rname, "seq": seq, "stage": stage,
                            "side": st.get("side"), "points": st.get("points"),
                            "win": st.get("win"),
                            "position": idx + 1, "score": score,
                            "room_rank": (sorted(room_scores, reverse=True).index(score) + 1) if score in room_scores else None,
                            "motion": mtext, "topic": mtopic,
                            "team": team.get("short_name") or team.get("reference"),
                            "mate": mate, "chair": chair, "venue": venue,
                        }
                        person = people[key]
                        (person["rows"] if stage == "P" else person["elim_rows"]).append(row)
                        person["tournaments"].setdefault(tslug, {
                            "name": tname, "date": tdate, "online": online,
                            "team": row["team"],
                        })
                        person["team_urls"].setdefault(tslug, set()).add(st.get("team"))
                        all_speaker_rows += 1

        # ---- breaks: aparición del equipo de la persona en rondas eliminatorias ----
        bc_names = {b["url"]: b.get("name", "") for b in (data.get("break_categories") or [])}
        for key, person in people.items():
            my_teams = person["team_urls"].get(tslug)
            if not my_teams:
                continue
            broke_open = broke_novice = False
            for rd in data.get("rounds_data") or []:
                rnd = rounds_by_seq.get(rd["seq"], {})
                if rnd.get("stage") != "E":
                    continue
                appears = any(t.get("team") in my_teams
                              for pr in (rd.get("pairings") or [])
                              for t in (pr.get("teams") or []))
                if not appears:
                    continue
                label = norm((rnd.get("name") or "") + " " + bc_names.get(rnd.get("break_category"), ""))
                if re.search(r"novat|novice|novel|principiante|rookie|inicia", label):
                    broke_novice = True
                else:
                    broke_open = True
            for is_nov, hit in [(False, broke_open), (True, broke_novice)]:
                if hit:
                    person["breaks"].append({"t": tslug, "tname": tname, "date": tdate, "novice": is_nov})

        # percentil dentro del torneo
        if t_scores:
            tavg = sum(t_scores) / len(t_scores)
            for person in people.values():
                for row in person["rows"]:
                    if row["t"] == tslug:
                        row["t_avg"] = round(tavg, 2)

    return people, tournaments, all_speaker_rows


def matches_name_not_anon(sp):
    return bool(sp.get("name")) and not sp.get("anonymous")


def summarize(person):
    rows = sorted(person["rows"], key=lambda r: (r["date"] or "", r["seq"]))
    scored = [r for r in rows if r["score"] is not None]
    scores = [r["score"] for r in scored]
    breaks = sorted(person["breaks"], key=lambda b: b["date"] or "")
    out = {"display": person["target"]["display"], "n_tournaments": len(person["tournaments"]),
           "n_rounds": len(rows), "n_elim_rounds": len(person["elim_rows"]),
           "breaks": breaks, "n_breaks": len(breaks),
           "n_breaks_novice": sum(1 for b in breaks if b["novice"]),
           "n_breaks_open": sum(1 for b in breaks if not b["novice"]),
           "tournaments": [dict(slug=k, **v) for k, v in sorted(person["tournaments"].items(), key=lambda kv: kv[1]["date"] or "")],
           "rows": rows, "elim_rows": person["elim_rows"]}
    if not scores:
        return out

    out["avg_speaks"] = round(statistics.mean(scores), 2)
    out["stdev"] = round(statistics.pstdev(scores), 2) if len(scores) > 1 else 0
    out["best"] = max(scored, key=lambda r: r["score"])
    out["worst"] = min(scored, key=lambda r: r["score"])

    pts = [r["points"] for r in rows if r["points"] is not None]
    out["avg_points"] = round(statistics.mean(pts), 2) if pts else None
    out["results_dist"] = {str(3 - i): pts.count(3 - i) for i in range(4)}

    # posiciones
    for pos in (1, 2):
        sub = [r["score"] for r in scored if r["position"] == pos]
        out[f"pos{pos}"] = {"n": len([r for r in rows if r["position"] == pos]),
                            "avg": round(statistics.mean(sub), 2) if sub else None}

    # cámaras
    out["sides"] = {}
    for side in SIDES:
        sub = [r for r in rows if r["side"] == side]
        spts = [r["points"] for r in sub if r["points"] is not None]
        sscr = [r["score"] for r in sub if r["score"] is not None]
        out["sides"][side] = {
            "label": SIDE_ES[side], "n": len(sub),
            "avg_points": round(statistics.mean(spts), 2) if spts else None,
            "avg_speaks": round(statistics.mean(sscr), 2) if sscr else None,
            "firsts": sum(1 for p in spts if p == 3),
        }

    # temas de moción
    out["topics"] = {}
    for r in rows:
        tp = r["topic"]
        d = out["topics"].setdefault(tp, {"n": 0, "pts": [], "scr": []})
        d["n"] += 1
        if r["points"] is not None:
            d["pts"].append(r["points"])
        if r["score"] is not None:
            d["scr"].append(r["score"])
    for tp, d in out["topics"].items():
        d["avg_points"] = round(statistics.mean(d["pts"]), 2) if d["pts"] else None
        d["avg_speaks"] = round(statistics.mean(d["scr"]), 2) if d["scr"] else None
        del d["pts"], d["scr"]

    # evolución por torneo
    evo = defaultdict(list)
    for r in scored:
        evo[(r["date"] or "", r["tname"])].append(r["score"])
    out["evolution"] = [{"date": k[0], "tname": k[1], "avg": round(statistics.mean(v), 2), "n": len(v)}
                        for k, v in sorted(evo.items())]

    # compañeros
    mates = defaultdict(lambda: {"n": 0, "pts": [], "scr": []})
    for r in rows:
        if r["mate"]:
            m = mates[r["mate"]]
            m["n"] += 1
            if r["points"] is not None:
                m["pts"].append(r["points"])
            if r["score"] is not None:
                m["scr"].append(r["score"])
    out["mates"] = [{"name": k, "n": v["n"],
                     "avg_points": round(statistics.mean(v["pts"]), 2) if v["pts"] else None,
                     "avg_speaks": round(statistics.mean(v["scr"]), 2) if v["scr"] else None}
                    for k, v in sorted(mates.items(), key=lambda kv: -kv[1]["n"])]

    # vs media del torneo
    diffs = [r["score"] - r["t_avg"] for r in scored if r.get("t_avg")]
    out["vs_field"] = round(statistics.mean(diffs), 2) if diffs else None

    # clutch: última ronda preliminar de cada torneo
    last_by_t = {}
    for r in scored:
        cur = last_by_t.get(r["t"])
        if cur is None or r["seq"] > cur["seq"]:
            last_by_t[r["t"]] = r
    lasts = [r["score"] for r in last_by_t.values()]
    out["clutch"] = {"avg_last_round": round(statistics.mean(lasts), 2) if lasts else None,
                     "delta": round(statistics.mean(lasts) - out["avg_speaks"], 2) if lasts else None}

    # rachas de 1º/2º
    best_streak = streak = 0
    for r in rows:
        if r["points"] in (2, 3):
            streak += 1
            best_streak = max(best_streak, streak)
        else:
            streak = 0
    out["streak_top2"] = best_streak

    # online vs presencial
    for label, flag in [("online", True), ("presencial", False)]:
        sub = [r["score"] for r in scored if r["online"] == flag]
        subp = [r["points"] for r in rows if r["online"] == flag and r["points"] is not None]
        out[f"env_{label}"] = {"n": len([r for r in rows if r["online"] == flag]),
                               "avg_speaks": round(statistics.mean(sub), 2) if sub else None,
                               "avg_points": round(statistics.mean(subp), 2) if subp else None}

    # media de rank en sala (1 = mejor discurso de la sala)
    rr = [r["room_rank"] for r in scored if r.get("room_rank")]
    out["avg_room_rank"] = round(statistics.mean(rr), 2) if rr else None
    out["room_best_count"] = sum(1 for x in rr if x == 1)

    # jueces de silla más frecuentes
    chairs = Counter(r["chair"] for r in rows if r["chair"])
    out["chairs"] = chairs.most_common(5)

    return out


def head_to_head(people):
    """Rondas en las que Germán y Lucía estaban en la misma sala."""
    g = {(r["t"], r["seq"]): r for r in people["german"]["rows"]}
    h2h = []
    for r in people["lucia"]["rows"]:
        gr = g.get((r["t"], r["seq"]))
        if not gr:
            continue
        same_team = gr["team"] == r["team"]
        h2h.append({"t": r["tname"], "date": r["date"], "round": r["round"],
                    "same_team": same_team, "motion": r["motion"],
                    "german": {"side": gr["side"], "points": gr["points"], "score": gr["score"]},
                    "lucia": {"side": r["side"], "points": r["points"], "score": r["score"]}})
    return h2h


def main():
    people, tournaments, nrows = build()
    stats = {
        "generated": True,
        "n_tournaments_scanned": len(tournaments),
        "tournaments_scanned": [{"name": d["tournament"]["name"], "slug": d["slug"],
                                 "base": d["base"], "date": tournament_date(d), "online": is_online(d)}
                                for d in tournaments],
        "people": {k: summarize(p) for k, p in people.items()},
        "h2h": head_to_head(people),
    }
    dest = ROOT / "data" / "stats.json"
    dest.write_text(json.dumps(stats, ensure_ascii=False, indent=1))
    for k, p in people.items():
        print(f"{k}: {len(p['rows'])} rondas prelim, {len(p['elim_rows'])} elim, {len(p['tournaments'])} torneos")
    print(f"stats.json escrito ({dest.stat().st_size//1024} KB), {len(tournaments)} torneos escaneados")


if __name__ == "__main__":
    main()
