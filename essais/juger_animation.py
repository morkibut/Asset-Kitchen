# -*- coding: utf-8 -*-
"""Juger les planches du banc, et dire **ce qu'une planche qui marche coûte vraiment**.

**Le tarif affiché ment sur le prix réel.** Un modèle à quatre centimes qui rate
une fois sur deux coûte huit centimes la planche utilisable ; un modèle à quatorze
centimes qui ne rate jamais en coûte quatorze. C'est cette division-là qui décide,
et c'est elle que ce programme calcule.

## Les cinq mesures, dans l'ordre où elles décident

1. **Le compte** — huit sujets sur la planche. En dessous ou au-dessus, l'atelier
   la refuse aujourd'hui : l'argent est parti, rien n'entre.
2. **La forme** — l'écart du rapport hauteur/largeur entre les huit cases. C'est
   **le** juge du mouvement : constant, le modèle a dessiné huit fois le même
   sprite (à l'échelle près, ce qui se recale) ; variable, le corps se déforme
   vraiment, et c'est ça, marcher.
3. **Les jambes** — part de la silhouette du tiers bas qui change d'une case à la
   suivante. Huit copies donnent deux à cinq pour cent.
4. **Le balancement** — de combien le sommet du crâne monte et descend, ramené à
   une hauteur de soixante-quatre pixels. C'est ce qui fait qu'un personnage
   marche au lieu de glisser.
5. **La lanterne** — sa flamme suivie en pourcentage de la largeur du sujet. Un
   bras qui balance la déplace franchement ; le bruit vaut deux points.

## Ce qu'« utilisable » veut dire ici

Le compte exploitable **et** un corps qui se déforme d'au moins huit pour cent.
Le seuil est écrit ici en clair pour qu'on puisse le contester : la manche 1
sépare nettement les planches animées (huit à seize) des planches figées (zéro à
cinq), et rien ne vit entre six et huit.

**Deux taux, pas un**, et l'écart entre les deux est un argument pour la V3 :
le taux *strict* est ce que l'atelier accepte aujourd'hui — exactement huit
sujets ; le taux *avec un geste* accepte une planche à neuf sujets, dont on
écarterait une case à la main.

    .venv\\Scripts\\python.exe essais/juger_animation.py
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np

RACINE = Path(__file__).resolve().parent
sys.path.insert(0, str(RACINE.parent))

from atelier.domaine.recette import Passe, Recette
from atelier.image.decoupe import en_ordre_de_lecture, zones_opaques
from atelier.image.traitement import detourer

BANC = RACINE / "resultats_animation"
CASES = 8
SEUIL_FORME = 8.0


def mesurer(octets: bytes) -> dict:
    """Les cinq mesures sur une planche. Rien n'est jugé ici, tout est compté."""
    rgba = detourer(Recette(passes=(Passe(moteur="bord"),)), octets)
    boites = en_ordre_de_lecture(zones_opaques(rgba[:, :, 3]))
    m: dict = {"sujets": len(boites)}
    if len(boites) < 6:
        return m

    h = np.array([b[3] - b[1] for b in boites], float)
    w = np.array([b[2] - b[0] for b in boites], float)
    forme = h / w
    m["ecart_hauteur_pct"] = round(float(h.max() / h.min() - 1) * 100, 1)
    m["ecart_largeur_pct"] = round(float(w.max() / w.min() - 1) * 100, 1)
    m["forme_pct"] = round(float(forme.max() / forme.min() - 1) * 100, 1)

    rangees: dict[int, list[int]] = {}
    for b in boites:
        rangees.setdefault(round(b[1] / 60), []).append(b[3])
    m["ecart_sol_px"] = int(max((max(v) - min(v)) for v in rangees.values()))

    H, W = int(h.max()) + 4, int(w.max()) + 4
    alpha = rgba[:, :, 3] > 127
    cadres, sommets = [], []
    for x0, y0, x1, y1 in boites:
        crop = alpha[y0:y1, x0:x1]
        cadre = np.zeros((H, W), bool)
        dy, dx = H - crop.shape[0], (W - crop.shape[1]) // 2
        cadre[dy : dy + crop.shape[0], dx : dx + crop.shape[1]] = crop
        cadres.append(cadre)
        sommets.append(dy)
    bas = slice(int(H * 0.62), H)
    jambes = [
        np.logical_xor(a[bas], cadres[(i + 1) % len(cadres)][bas]).sum()
        / max(1, np.logical_or(a[bas], cadres[(i + 1) % len(cadres)][bas]).sum())
        * 100
        for i, a in enumerate(cadres)
    ]
    m["jambes_pct"] = round(float(np.mean(jambes)), 1)
    m["balancement_px"] = round((max(sommets) - min(sommets)) * 64 / H, 1)

    xs = []
    for x0, y0, x1, y1 in boites:
        c = rgba[y0:y1, x0:x1].astype(int)
        r, g, b, a = c[:, :, 0], c[:, :, 1], c[:, :, 2], c[:, :, 3]
        flamme = (a > 127) & (r > 200) & (g > 140) & (b < 140)
        xs.append(float(np.where(flamme)[1].mean()) / (x1 - x0) * 100 if flamme.any() else None)
    connus = [v for v in xs if v is not None]
    m["lanterne_pct"] = round(max(connus) - min(connus), 1) if len(connus) >= 2 else None
    return m


def main() -> None:
    couts = json.loads((BANC / "mesures.json").read_text("utf-8"))
    lignes: list[dict] = []
    for dossier in sorted(BANC.iterdir()):
        if not dossier.is_dir():
            continue
        modele = dossier.name.replace("_", "/", 1)
        releve = couts.get(modele, {})
        # Les échecs d'appel comptent comme des essais : ils prennent du temps et
        # ils font partie du prix réel, même s'ils ne coûtent pas un centime.
        for jet, ligne in sorted(releve.items()):
            if "echec" in ligne:
                lignes.append(
                    {
                        "modele": modele,
                        "jet": jet,
                        "sujets": 0,
                        "echec": ligne["echec"].split(":")[0],
                        "cout_usd": 0.0,
                        "secondes": ligne.get("secondes"),
                    }
                )
        for planche in sorted(dossier.glob("jet*.png")):
            jet = planche.stem
            m = mesurer(planche.read_bytes())
            m["modele"], m["jet"], m["fichier"] = modele, jet, str(planche)
            m["cout_usd"] = releve.get(jet, {}).get("cout_usd")
            m["secondes"] = releve.get(jet, {}).get("secondes")
            lignes.append(m)

    for l in lignes:
        compte_strict = l.get("sujets") == CASES
        compte_geste = l.get("sujets") in (CASES, CASES + 1)
        anime = (l.get("forme_pct") or 0) >= SEUIL_FORME
        l["utilisable_strict"] = bool(compte_strict and anime)
        l["utilisable_geste"] = bool(compte_geste and anime)

    (BANC / "jugements.json").write_text(
        json.dumps(lignes, indent=1, ensure_ascii=False), "utf-8"
    )

    # ── Le détail, planche par planche ───────────────────────────────────────
    e = f"{'modele':<32} {'jet':<5} {'suj':>4} {'forme':>6} {'jambes':>7} {'balanc':>7} {'lant':>5} {'sec':>5} {'$':>7}  ok"
    print(e)
    print("-" * len(e))
    for l in lignes:
        if l.get("echec"):
            print(f"{l['modele']:<32} {l['jet']:<5}    —  appel echoue ({l['echec']}) en {l['secondes']:.0f}s")
            continue
        if l["sujets"] < 6:
            print(f"{l['modele']:<32} {l['jet']:<5} {l['sujets']:>4}  planche illisible")
            continue
        marque = "OUI" if l["utilisable_strict"] else ("geste" if l["utilisable_geste"] else "non")
        print(
            f"{l['modele']:<32} {l['jet']:<5} {l['sujets']:>4} {l['forme_pct']:>6} "
            f"{l['jambes_pct']:>7} {l['balancement_px']:>7} "
            f"{l['lanterne_pct'] if l['lanterne_pct'] is not None else '—':>5} "
            f"{l['secondes'] if l['secondes'] is not None else '—':>5} "
            f"{l['cout_usd'] if l['cout_usd'] is not None else '—':>7}  {marque}"
        )

    # ── La synthèse, et c'est elle qui décide ────────────────────────────────
    print()
    e2 = (
        f"{'modele':<32} {'essais':>7} {'ok':>4} {'geste':>6} {'reussite':>9} "
        f"{'$ total':>8} {'$/utile':>8} {'sec/utile':>10} {'forme moy':>10}"
    )
    print(e2)
    print("-" * len(e2))
    synthese = []
    for modele in sorted({l["modele"] for l in lignes}):
        siens = [l for l in lignes if l["modele"] == modele]
        essais = len(siens)
        ok = sum(1 for l in siens if l["utilisable_strict"])
        geste = sum(1 for l in siens if l["utilisable_geste"])
        total = sum(l.get("cout_usd") or 0.0 for l in siens)
        secondes = sum(l.get("secondes") or 0.0 for l in siens)
        formes = [l["forme_pct"] for l in siens if l.get("forme_pct") is not None]
        s = {
            "modele": modele,
            "essais": essais,
            "utilisables": ok,
            "utilisables_geste": geste,
            "reussite_pct": round(ok / essais * 100) if essais else 0,
            "cout_total": round(total, 4),
            "cout_par_utile": round(total / ok, 4) if ok else None,
            "cout_par_utile_geste": round(total / geste, 4) if geste else None,
            "secondes_par_utile": round(secondes / ok) if ok else None,
            "forme_moyenne": round(float(np.mean(formes)), 1) if formes else None,
        }
        synthese.append(s)
        taux = f"{s['reussite_pct']}%"
        cpu = f"{s['cout_par_utile']:.3f}" if s["cout_par_utile"] else "—"
        spu = str(s["secondes_par_utile"]) if s["secondes_par_utile"] else "—"
        fm = str(s["forme_moyenne"]) if s["forme_moyenne"] is not None else "—"
        print(
            f"{modele:<32} {essais:>7} {ok:>4} {geste:>6} {taux:>9} "
            f"{total:>8.3f} {cpu:>8} {spu:>10} {fm:>10}"
        )

    (BANC / "synthese.json").write_text(
        json.dumps(synthese, indent=1, ensure_ascii=False), "utf-8"
    )
    print()
    print(f"utilisable = compte exploitable ET forme >= {SEUIL_FORME} %")
    print("ok     = compte exact (ce que l'atelier accepte aujourd'hui)")
    print("geste  = compte exact OU neuf sujets, dont on ecarterait une case a la main")
    print("$/utile= tout ce qui a ete paye, divise par les planches qui marchent")
    print()
    print("-> essais/resultats_animation/jugements.json et synthese.json")


if __name__ == "__main__":
    main()
