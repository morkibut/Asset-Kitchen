# -*- coding: utf-8 -*-
"""Le banc de `M1` — ce que le découpage du coin gardait, et ce qu'il jetait.

**La mesure qui a ouvert la tranche, rejouée sur les vraies images du dépôt.**
Le serveur ne redimensionnait pas l'image du dessus pour la faire entrer dans le
cadre du dessous : il la collait dans le coin haut-gauche et jetait ce qui
dépassait. Sans conséquence tant que les deux images ont des tailles voisines —
ce qui était vrai avant `G16`. Depuis, le dessus peut être **la case telle
qu'elle est arrivée du modèle**, huit fois plus grande que le corps.

Ce banc reprend **toutes les pièces d'équipement du dépôt**, pas seulement
celles qui souffrent, et c'est le point : la moitié de la tranche est ce qui
**ne bouge pas**. Pour chacune il pose la question dans les deux sens —

1. combien de pixels de sujet le calque contenait-il **avec le coin** ?
2. combien en contient-il **avec le cadre** ?

**Il ne coûte rien.** Les images sont déjà payées et déjà sur le disque : la
planche revenue, et le corps sur lequel elle a été composée. Aucun appel n'est
fait, aucune clé n'est lue, et la base n'est ouverte **qu'en lecture** — un
atelier peut tourner à côté sans que ce banc le dérange.

    Lancer :  py essais/essai_superposition_cadre.py

Sortie : ce journal, et `essais/mesures_superposition_cadre.json`.
"""

from __future__ import annotations

import io
import json
import sqlite3
import sys
from pathlib import Path

RACINE = Path(__file__).resolve().parent
sys.path.insert(0, str(RACINE.parent))

import numpy as np  # noqa: E402
from PIL import Image  # noqa: E402

from atelier.domaine.pliage import Geometrie  # noqa: E402
from atelier.domaine.superposition import Superposition  # noqa: E402
from atelier.image.calque import avec_alpha, cadrer, cases_de, superposer  # noqa: E402

DONNEES = RACINE.parent / "donnees"
SORTIE = RACINE / "mesures_superposition_cadre.json"
OPACITE = 128


# ── Le disque, en lecture seule ──────────────────────────────────────────────


def _base() -> sqlite3.Connection:
    """**En lecture seule, et c'est délibéré.** L'index est reconstructible, mais
    l'auteur travaille dans son atelier pendant qu'un banc tourne."""
    lien = (DONNEES / "atelier.sqlite3").as_uri() + "?mode=ro"
    connexion = sqlite3.connect(lien, uri=True)
    connexion.row_factory = sqlite3.Row
    return connexion


def _assets(base: sqlite3.Connection) -> dict[str, dict]:
    return {
        ligne["identifiant"]: json.loads(ligne["contenu"])
        for ligne in base.execute(
            "select identifiant, contenu from assets where supprime_le is null"
        )
    }


def _generation(identifiant: str) -> dict | None:
    fichier = DONNEES / "generations" / identifiant / "generation.json"
    if not fichier.exists():
        return None
    return json.loads(fichier.read_text(encoding="utf-8"))


def _pixels(chemin: str) -> np.ndarray:
    with Image.open(DONNEES / chemin) as image:
        return np.asarray(image.convert("RGBA")).copy()


def _rendu(asset: dict) -> np.ndarray:
    """Ce que la superposition lit vraiment — l'image **rendue**, pas le brut."""
    return _pixels(asset.get("rendu") or asset["brut"])


def _sujet(rgba: np.ndarray) -> int:
    return int((rgba[:, :, 3] >= OPACITE).sum())


# ── La case telle qu'elle est arrivée ────────────────────────────────────────


def _case_arrivee(generation: dict, index: int) -> np.ndarray | None:
    """La case du modèle, découpée de la planche — sans aucun recalage.

    **Le découpage seul**, comme `case_arrivee` le fait depuis `G16` : ce qu'on
    veut ici est l'image *avant* que l'atelier ne la cale sur son corps.
    """
    emplacement = next(
        (e for e in generation.get("emplacements", []) if e.get("resultat")), None
    )
    if emplacement is None:
        return None
    fichier = emplacement["resultat"]["fichier"]
    if not (DONNEES / fichier).exists():
        return None
    planche = _pixels(fichier)
    pliage = generation.get("pliage") or {}
    forme = Geometrie(
        cases=int(pliage.get("nombre") or 1),
        colonnes=int(pliage.get("colonnes") or 1),
        lignes=int(pliage.get("lignes") or 1),
    )
    hauteur, largeur = planche.shape[:2]
    boites = cases_de(largeur, hauteur, forme)
    if index >= len(boites):
        return None
    x0, y0, x1, y1 = boites[index]
    return planche[y0 : y1 + 1, x0 : x1 + 1]


# ── L'alignement d'avant la tranche, gardé comme témoin ──────────────────────


def _coin(dessus: np.ndarray, dessous: np.ndarray) -> np.ndarray:
    """Le contrat d'avant `M1` : le coin haut-gauche, et le reste jeté."""
    hauteur, largeur = dessous.shape[:2]
    cadre = Image.new("RGBA", (largeur, hauteur), (0, 0, 0, 0))
    cadre.paste(Image.fromarray(dessus, "RGBA"), (0, 0))
    return np.asarray(cadre)


def _calque_avec_coin(dessous: np.ndarray, dessus: np.ndarray) -> np.ndarray:
    """Le calque tel qu'il sortait avant la tranche.

    La comparaison elle-même n'a pas changé : seul l'alignement l'a. On lui donne
    donc le dessus **déjà coupé au coin**, à la taille du cadre — `superposer` le
    laisse alors tel quel, puisqu'il tient déjà dedans.
    """
    return superposer(dessous, _coin(dessus, dessous), Superposition())[0]


def _detouree(cell: np.ndarray) -> np.ndarray:
    """La case arrivée, détourée — **le chemin que l'écran propose lui-même**.

    Une case qui revient du modèle est opaque de bord à bord, et l'outil le dit :
    *« sans alpha sur le dessus, le calque prendrait tout le fond »*, avec le
    geste à côté. C'est donc l'image sur laquelle la question a un sens : sans
    détourage, un coin de fond uni compte comme du sujet et **la mesure dirait le
    contraire de ce qu'on voit**.
    """
    tampon = io.BytesIO()
    Image.fromarray(cell, "RGBA").save(tampon, format="PNG")
    return avec_alpha(tampon.getvalue())


# ── Le banc ──────────────────────────────────────────────────────────────────


def _pieces(base: sqlite3.Connection) -> list[dict]:
    """Chaque pièce d'équipement, avec le corps sur lequel elle a été composée.

    Le corps se lit sur le **pliage de sa génération** — `cases[i].base` —, qui
    est le seul endroit du dépôt à le savoir sans le deviner.
    """
    assets = _assets(base)
    trouvees = []
    for identifiant, asset in sorted(assets.items()):
        if not asset.get("piece") or asset.get("calque") is None:
            continue
        generation = _generation(asset["generation"])
        pliage = (generation or {}).get("pliage") or {}
        cases = pliage.get("cases") or []
        rangs = sorted(
            a["rang"] for a in assets.values()
            if a["generation"] == asset["generation"] and a["rang"] >= 100
        )
        if generation is None or asset["rang"] not in rangs:
            continue
        index = rangs.index(asset["rang"])
        if index >= len(cases):
            continue
        corps = assets.get(cases[index].get("base") or "")
        if corps is None:
            continue
        trouvees.append(
            {
                "calque": identifiant,
                "label": asset.get("label", ""),
                "personnage": asset.get("personnage"),
                "generation": asset["generation"],
                "index": index,
                "asset": asset,
                "corps": corps,
            }
        )
    return trouvees


def mesurer() -> list[dict]:
    with _base() as base:
        pieces = _pieces(base)

    lignes = []
    for piece in pieces:
        generation = _generation(piece["generation"])
        brute = _case_arrivee(generation, piece["index"]) if generation else None
        if brute is None:
            continue
        dessus = _detouree(brute)
        dessous = _rendu(piece["corps"])
        boite = cadrer(dessus.shape[:2], dessous.shape[:2])

        avant = _calque_avec_coin(dessous, dessus)
        apres = superposer(dessous, dessus, Superposition())[0]
        # **Ce que le calque contenait sans détourer**, et c'est l'autre moitié
        # du symptôme : un rectangle plein de fond uni, presque entièrement
        # rempli, qui a toute l'apparence d'un résultat.
        brut_au_coin = _calque_avec_coin(dessous, brute)
        cadre = dessous.shape[0] * dessous.shape[1]
        # **L'autre moitié de la tranche : ce qui ne doit pas bouger.** Le même
        # calcul sur le dessus **tel qu'il est rangé**, avant et après. Sur une
        # image qui tient déjà dans le cadre, les deux doivent être identiques
        # au pixel près.
        range_ = _rendu(piece["asset"])
        avant_range = _calque_avec_coin(dessous, range_)
        apres_range = superposer(dessous, range_, Superposition())[0]
        lignes.append(
            {
                "calque": piece["calque"],
                "label": piece["label"],
                "personnage": piece["personnage"],
                "arrivee": [int(brute.shape[1]), int(brute.shape[0])],
                "corps": [int(dessous.shape[1]), int(dessous.shape[0])],
                "ramene": boite.ramene,
                "part_gardee_par_le_coin": round(cadre / (brute.shape[0] * brute.shape[1]), 4),
                "sujet_de_l_arrivee": _sujet(dessus),
                "sujet_avec_le_coin": _sujet(avant),
                "sujet_avec_le_cadre": _sujet(apres),
                "remplissage_du_calque_sans_detourage": round(
                    _sujet(brut_au_coin) / cadre, 4
                ),
                "range": [int(range_.shape[1]), int(range_.shape[0])],
                "range_tient_dans_le_cadre": not cadrer(
                    range_.shape[:2], dessous.shape[:2]
                ).ramene,
                "range_identique": bool(np.array_equal(avant_range, apres_range)),
            }
        )
    return lignes


def raconter(lignes: list[dict]) -> None:
    print()
    print("  Refaire à la main le calque d'une pièce, en repartant de la case arrivée")
    print("  " + "─" * 98)
    print(
        f"  {'la pièce':<28} {'arrivée':>10} {'corps':>10} {'coin':>7} "
        f"{'son sujet':>10} {'gardé · coin':>13} {'gardé · cadre':>14}"
    )
    for ligne in lignes:
        arrivee = "×".join(str(v) for v in ligne["arrivee"])
        corps = "×".join(str(v) for v in ligne["corps"])
        part = f"{ligne['part_gardee_par_le_coin'] * 100:.1f} %"
        nom = f"{ligne['label']} · {ligne['personnage'] or '—'}"
        print(
            f"  {nom[:28]:<28} {arrivee:>10} {corps:>10} "
            f"{(part if ligne['ramene'] else '—'):>7} "
            f"{ligne['sujet_de_l_arrivee']:>10} "
            f"{ligne['sujet_avec_le_coin']:>13} {ligne['sujet_avec_le_cadre']:>14}"
        )

    perdues = [l for l in lignes if l["sujet_avec_le_coin"] == 0]
    print()
    print(
        f"  {len(perdues)} pièces sur {len(lignes)} ne rendaient **aucun pixel de sujet** "
        f"avec le coin :"
    )
    for ligne in perdues:
        print(
            f"    · {ligne['label']} · {ligne['personnage']} — 0 pixel sur "
            f"{ligne['sujet_de_l_arrivee']}, et le calque sortait rempli à "
            f"{ligne['remplissage_du_calque_sans_detourage'] * 100:.0f} % de fond uni. "
            f"Avec le cadre : {ligne['sujet_avec_le_cadre']} pixels."
        )
    reste = [l for l in lignes if l["sujet_avec_le_coin"] > 0]
    if reste:
        print()
        print(f"  {len(reste)} en gardaient une part, et en gardent plus :")
        for ligne in reste:
            print(
                f"    · {ligne['label']} · {ligne['personnage']} — "
                f"{ligne['sujet_avec_le_coin']} avec le coin, "
                f"{ligne['sujet_avec_le_cadre']} avec le cadre"
            )

    # ── Ce qui ne devait pas bouger, et qui n'a pas bougé ────────────────────
    tiennent = [l for l in lignes if l["range_tient_dans_le_cadre"]]
    intacts = [l for l in tiennent if l["range_identique"]]
    print()
    print(
        f"  Sur le dessus **tel qu'il est rangé**, {len(tiennent)} pièces sur "
        f"{len(lignes)} tiennent déjà dans le cadre du corps,"
    )
    print(
        f"  et {len(intacts)} d'entre elles rendent le calque d'avant la tranche "
        f"au pixel près."
    )
    for ligne in tiennent:
        if not ligne["range_identique"]:
            print(f"    ⚠ {ligne['label']} · {ligne['personnage']} — A CHANGÉ")
    print()


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
    if not (DONNEES / "atelier.sqlite3").exists():
        print("  aucun atelier sur ce disque — ce banc lit les images déjà payées")
        raise SystemExit(0)
    lignes = mesurer()
    raconter(lignes)
    SORTIE.write_text(
        json.dumps(lignes, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    print(f"  relevé écrit dans {SORTIE.relative_to(RACINE.parent)}")
