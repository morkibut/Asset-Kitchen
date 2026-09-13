# -*- coding: utf-8 -*-
"""Le banc de l'univers — ce que le projet pose, et ce qui part vraiment.

Écrit le 30 août 2026 pour la maquette `docs/archive/maquettes-v2.1/06-univers.html`, qui
**cite ses chiffres**. Il existe pour qu'on puisse les refaire : une maquette qui
affirme une mesure sans banc pour la rejouer devient invérifiable au premier doute.

**Il ne coûte rien.** Les projets, les cartes et les générations sont déjà sur le
disque, l'extraction de palette est du processeur pur et déterministe — aucune clé
n'est lue, aucun appel n'est fait.

L'écran Univers pose cinq choses : la bible, la palette, la taille de pixel, le
barème et les modèles par défaut. La question que personne n'avait posée est
**laquelle de ces cinq atteint réellement le fournisseur**, et le banc y répond en
sept relevés :

1. **La bible pèse combien dans un prompt réel ?** — et combien pèse le sujet.
2. **Combien de générations l'ont réellement portée ?** avec, en regard, celles qui
   ont porté un artwork officiel. Le croisement des deux est la mesure qui décide
   de la maquette.
3. **La bible se contredit-elle avec le projet qui la porte ?** Un seul nombre est
   écrit des deux côtés — la taille de pixel — et il suffit à le savoir.
4. **La bible se contredit-elle avec la consigne de reprise ?** Sept collisions
   listées, vérifiées mot pour mot dans un prompt payé.
5. **Le nombre de couleurs demandé achète quoi ?** La palette est réextraite des
   vrais artworks à chaque cran du réglage, et l'on compte ce qui reste
   *franchement* distinct.
6. **La palette atteint-elle les images ?** Part des pixels rendus qui tombent
   exactement dessus, et nombre de couleurs qu'un rendu emploie.
7. **Le tableau tient-il dans son écran ?** Poids de la plus grosse carte texte,
   rapportée à la bible qu'elle double.
8. **Le barème et les modèles ont-ils jamais décidé quelque chose ?** Combien de
   valeurs s'écartent du défaut, sur tous les projets du disque.

    Lancer :  py essais/essai_ce_qui_part.py
              py essais/essai_ce_qui_part.py --projet bac-a-sable

Sortie : ce journal, et `essais/mesures_ce_qui_part.json` pour lire la dérive
d'une exécution à l'autre.
"""

from __future__ import annotations

import argparse
import itertools
import json
import pathlib
import sys

import numpy as np
from PIL import Image

RACINE = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RACINE))

from atelier.domaine.projet import BAREME_PAR_DEFAUT, INTITULES  # noqa: E402
from atelier.image.palette import palette_de  # noqa: E402

SORTIE = RACINE / "essais" / "mesures_ce_qui_part.json"
DONNEES = RACINE / "donnees"

# Les crans du réglage « couleurs demandées » de l'écran, plus 64 qui est le
# plafond du domaine — pour voir si la courbe s'arrête ou continue.
CRANS = (8, 12, 16, 24, 32, 48, 64)

# Deux couleurs plus proches que ça, côte à côte dans une palette, ne se
# distinguent pas à l'œil sur un aplat. **Deux seuils et non un** : 12 est le
# voisinage strict, 24 le voisinage large. Un seuil unique laisserait croire à une
# frontière que la perception n'a pas.
PROCHE = 12
LARGE = 24

# Ce que la consigne de reprise d'une planche interdit, et ce que la bible du
# projet réel écrit malgré tout. Les paires sont écrites ici et **vérifiées** dans
# les deux textes : le banc ne les affirme pas, il les retrouve.
COLLISIONS = (
    ("vue", "3/4 top-down orthographic view", "the same viewing angles"),
    ("technique", "4-directional orientation", "the same viewing angles"),
    ("technique", "neutral grey or transparent background", "the same plain flat light gray background"),
    ("technique", "strict 64x64 px tile snap", "same cell sizes"),
    ("trait", "1-pixel dark slate outline", "the same outline weight"),
    ("eclairage", "Dynamic warm radial lighting", "the same colors everywhere else"),
    ("rendu", "2D pixel art on a 64x64 grid", "the same pixel art style"),
)

# Ce qu'une consigne de reprise dit, et qui la reconnaît sans ambiguïté.
MARQUE_REPRISE = "Change absolutely nothing else"


# ── Lire le disque ───────────────────────────────────────────────────────────


def titre(numero: str, texte: str) -> None:
    print()
    print(f"── {numero} · {texte} " + "─" * max(0, 74 - len(texte)))


def projet(nom: str) -> dict:
    fichier = DONNEES / "projets" / nom / "projet.json"
    if not fichier.exists():
        presents = sorted(p.name for p in (DONNEES / "projets").glob("*") if p.is_dir())
        raise SystemExit(f"projet « {nom} » introuvable — présents : {', '.join(presents)}")
    return json.loads(fichier.read_text(encoding="utf-8"))


def cartes(nom: str) -> list[dict]:
    dossier = DONNEES / "projets" / nom / "tableau"
    if not dossier.is_dir():
        return []
    return [json.loads(f.read_text(encoding="utf-8")) for f in sorted(dossier.glob("*.json"))]


def generations() -> list[dict]:
    dossier = DONNEES / "generations"
    if not dossier.is_dir():
        return []
    lues = []
    for chemin in sorted(dossier.iterdir()):
        fichier = chemin / "generation.json"
        if fichier.exists():
            lues.append(json.loads(fichier.read_text(encoding="utf-8")))
    return lues


def rvb(hexa: str) -> tuple[int, int, int]:
    hexa = hexa.lstrip("#")
    return tuple(int(hexa[i : i + 2], 16) for i in (0, 2, 4))  # type: ignore[return-value]


def ecart(a: tuple[int, int, int], b: tuple[int, int, int]) -> float:
    return float(sum((x - y) ** 2 for x, y in zip(a, b)) ** 0.5)


def franchement_distinctes(palette: tuple[str, ...], seuil: float) -> int:
    """Combien de couleurs restent si l'on fusionne tout ce qui est trop voisin.

    Un glouton dans l'ordre de la palette, et non un regroupement optimal : c'est
    ce que fait l'œil qui parcourt la rangée de carrés de gauche à droite, et le
    chiffre doit décrire cette lecture-là.
    """
    gardees: list[tuple[int, int, int]] = []
    for couleur in map(rvb, palette):
        if all(ecart(couleur, g) >= seuil for g in gardees):
            gardees.append(couleur)
    return len(gardees)


def prompt_de(generation: dict) -> str:
    return (generation.get("demande") or {}).get("prompt") or ""


def porte_la_bible(generation: dict, champs: dict[str, str]) -> bool:
    """Un prompt porte-t-il la bible ? Repéré par l'intitulé d'un champ qui parle.

    L'intitulé et non le texte : c'est lui que l'assemblage écrit, et il ne peut
    pas apparaître dans un sujet tapé à la main.
    """
    prompt = prompt_de(generation)
    return any(
        f"{INTITULES[nom]}:" in prompt for nom, texte in champs.items() if texte.strip()
    )


def porte_un_artwork(generation: dict) -> bool:
    return any(r.get("role") == "style" for r in (generation.get("references") or []))


# ── Les sept relevés ─────────────────────────────────────────────────────────


def main() -> int:
    # Windows encode la sortie en cp1252 dès qu'elle est redirigée, et un simple
    # « ── » lève alors une UnicodeEncodeError (`docs/PIEGES.md`).
    sys.stdout.reconfigure(encoding="utf-8")  # type: ignore[union-attr]

    arguments = argparse.ArgumentParser(description=__doc__)
    arguments.add_argument("--projet", default="coeur-de-pierre-01")
    options = arguments.parse_args()

    lu = projet(options.projet)
    univers = lu["univers"]
    champs = {c["nom"]: c["texte"] for c in univers["bible"]}
    releve: dict = {"projet": options.projet, "nom": lu["nom"]}

    print(f"projet « {lu['nom']} » — taille de pixel {univers['cible_px']} px · "
          f"{univers['couleurs']} couleurs demandées · {len(univers['palette'])} rendues")

    # ── 1 ────────────────────────────────────────────────────────────────────
    titre("1", "Ce que la bible pèse dans un prompt réel")
    assemblee = "".join(
        f"{INTITULES[nom]}: {texte}\n" for nom, texte in champs.items() if texte.strip()
    )
    ecrit = sum(len(t) for t in champs.values())
    print(f"  écrite dans les champs        {ecrit:6d} caractères sur "
          f"{sum(1 for t in champs.values() if t.strip())} champs qui parlent")
    print(f"  assemblée avec ses intitulés  {len(assemblee):6d} caractères")
    for nom, texte in champs.items():
        if texte.strip():
            print(f"      {nom:10s} {len(texte):4d}")

    toutes = generations()
    avec_bible = [g for g in toutes if porte_la_bible(g, champs)]
    if avec_bible:
        exemple = max(avec_bible, key=lambda g: len(prompt_de(g)))
        blocs = prompt_de(exemple).split("\n\n")
        entier = len(prompt_de(exemple))
        print(f"\n  mesuré sur la génération {exemple['identifiant'][:8]} — {entier} caractères partis :")
        for rang, bloc in enumerate(blocs):
            quoi = "la bible" if rang == 0 else ("le sujet" if len(bloc) < 200 else "la consigne")
            print(f"      bloc {rang} · {quoi:12s} {len(bloc):5d} car. · {100 * len(bloc) // entier:3d} %"
                  f"   {bloc[:52]!r}")
        releve["prompt_exemple"] = {
            "generation": exemple["identifiant"],
            "total": entier,
            "blocs": [len(b) for b in blocs],
        }
    releve["bible_caracteres"] = ecrit
    releve["bible_assemblee"] = len(assemblee)

    # ── 2 ────────────────────────────────────────────────────────────────────
    titre("2", "Ce que l'univers a réellement envoyé, sur toutes les générations payées")
    payees = [g for g in toutes if g.get("modele") != "import"]
    b = sum(1 for g in payees if porte_la_bible(g, champs))
    a = sum(1 for g in payees if porte_un_artwork(g))
    deux = sum(1 for g in payees if porte_la_bible(g, champs) and porte_un_artwork(g))
    rien = sum(1 for g in payees if not porte_la_bible(g, champs) and not porte_un_artwork(g))
    print(f"  générations payées, tous projets      {len(payees):3d}")
    print(f"    avec la bible                       {b:3d}")
    print(f"    avec un artwork officiel            {a:3d}")
    print(f"    avec les deux                       {deux:3d}   ← la mesure qui décide")
    print(f"    avec ni l'un ni l'autre             {rien:3d}")
    echelles = sum(1 for g in toutes if (g.get("demande") or {}).get("echelle"))
    print(f"\n  un sujet nommé au moment de générer   {echelles} sur {len(toutes)} générations"
          f"  — c'est lui qui décide des artworks qui partent")
    releve["envoi"] = {"payees": len(payees), "bible": b, "artwork": a,
                       "les_deux": deux, "ni_l_un_ni_l_autre": rien, "sujet_nomme": echelles}

    # ── 3 ────────────────────────────────────────────────────────────────────
    titre("3", "La bible et le projet se contredisent-ils sur la taille de pixel ?")
    import re

    cible = int(univers["cible_px"])
    trouves = []
    for nom, texte in champs.items():
        for brut in re.findall(r"(\d+)\s*x\s*\1|(\d+)\s*px", texte, re.I):
            valeur = int(next(v for v in brut if v))
            trouves.append((nom, valeur))
    if not trouves:
        print("  aucune taille écrite dans la bible — rien à contredire")
    for nom, valeur in trouves:
        verdict = "D'ACCORD" if valeur == cible else f"CONTREDIT le projet ({cible} px)"
        print(f"  champ {nom:10s} écrit {valeur:4d} px  → {verdict}")
    releve["tailles_ecrites"] = trouves
    releve["cible_px"] = cible

    # ── 4 ────────────────────────────────────────────────────────────────────
    titre("4", "La bible et la consigne de reprise se contredisent-elles ?")
    reprises = [g for g in toutes if MARQUE_REPRISE.lower() in prompt_de(g).lower()]
    print(f"  générations qui portent « {MARQUE_REPRISE} » : {len(reprises)}")
    tenues = 0
    if reprises:
        consigne = prompt_de(reprises[0])
        for champ, extrait, contre in COLLISIONS:
            ok = extrait.lower() in champs.get(champ, "").lower() and contre.lower() in consigne.lower()
            tenues += ok
            print(f"  {'vérifiée' if ok else '  —     '}  {champ:10s} « {extrait} »"
                  f"  contre  « {contre} »")
        touches = sorted({c for c, _, _ in COLLISIONS
                          if any(e.lower() in champs.get(c, '').lower() for cc, e, _ in COLLISIONS if cc == c)})
        print(f"\n  {tenues} collisions retrouvées dans les deux textes, "
              f"sur {len(touches)} champs de bible sur {len(champs)}")
    releve["collisions"] = {"verifiees": tenues, "sur": len(COLLISIONS),
                            "generations_de_reprise": len(reprises)}

    # ── 5 ────────────────────────────────────────────────────────────────────
    titre("5", "Ce que le nombre de couleurs demandé achète vraiment")
    artworks = [
        (DONNEES / c["fichier"]).read_bytes()
        for c in cartes(options.projet)
        if c.get("officiel") and c.get("genre") == "image" and (DONNEES / c.get("fichier", "")).exists()
    ]
    print(f"  la palette est déduite de {len(artworks)} artwork(s) officiel(s)")
    courbe = []
    if artworks:
        print(f"  {'demandées':>10s} {'rendues':>8s} {'distinctes à ' + str(PROCHE):>17s}"
              f" {'à ' + str(LARGE):>8s}   ce que le cran de plus ajoute")
        precedent = None
        for combien in CRANS:
            pal = palette_de(artworks, combien)
            proche = franchement_distinctes(pal, PROCHE)
            large = franchement_distinctes(pal, LARGE)
            gain = "" if precedent is None else f"+{proche - precedent} franchement distincte(s)"
            print(f"  {combien:10d} {len(pal):8d} {proche:17d} {large:8d}   {gain}")
            courbe.append({"demandees": combien, "rendues": len(pal),
                           "distinctes_12": proche, "distinctes_24": large})
            precedent = proche

        posee = tuple(univers["palette"])
        paires = [
            ecart(rvb(x), rvb(y)) for x, y in itertools.combinations(posee, 2)
        ]
        if paires:
            print(f"\n  la palette posée : {len(posee)} couleurs · "
                  f"la paire la plus proche à {min(paires):.1f} sur 255 · "
                  f"{sum(1 for d in paires if d < PROCHE)} paires sous {PROCHE}")
            releve["palette_posee"] = {"couleurs": len(posee), "plus_proche": round(min(paires), 1),
                                       "paires_sous_seuil": sum(1 for d in paires if d < PROCHE)}

        # ce que chaque artwork tient de la palette commune
        if len(artworks) > 1:
            commune = palette_de(artworks, univers["couleurs"])
            for rang in range(len(artworks)):
                sans = palette_de([o for i, o in enumerate(artworks) if i != rang], univers["couleurs"])
                partent = sum(
                    1 for c in commune if min(ecart(rvb(c), rvb(s)) for s in sans) >= PROCHE
                )
                print(f"  sans l'artwork {rang + 1} : {partent} des {len(commune)} couleurs disparaissent")
    releve["courbe_couleurs"] = courbe

    # ── 6 ────────────────────────────────────────────────────────────────────
    titre("6", "La palette atteint-elle les images ?")
    posee = np.array([rvb(c) for c in univers["palette"]], dtype=np.int32)
    dessus, a_cote, emplois = 0, 0, []
    total_px, sur_px = 0, 0
    if posee.size:
        for rendu in sorted((DONNEES / "generations").glob("*/*-rendu.png")):
            fiche = rendu.parent / "generation.json"
            if not fiche.exists():
                continue
            if json.loads(fiche.read_text(encoding="utf-8")).get("projet") != options.projet:
                continue
            pixels = np.asarray(Image.open(rendu).convert("RGBA"))
            opaques = pixels[pixels[:, :, 3] > 0][:, :3].astype(np.int32)
            if not opaques.size:
                continue
            couleurs, comptes = np.unique(opaques.reshape(-1, 3), axis=0, return_counts=True)
            distances = ((couleurs[:, None, :] - posee[None, :, :]) ** 2).sum(2).min(1)
            exact = int(comptes[distances == 0].sum())
            total_px += int(comptes.sum())
            sur_px += exact
            if exact > 0.9 * comptes.sum():
                dessus += 1
                emplois.append(len(couleurs))
            else:
                a_cote += 1
    if dessus or a_cote:
        print(f"  rendus du projet                       {dessus + a_cote}")
        print(f"    entièrement sur la palette           {dessus}")
        print(f"    qui ne la touchent pas               {a_cote}")
        print(f"  part des pixels rendus qui tombent dessus  {100 * sur_px // max(1, total_px)} %")
        if emplois:
            print(f"  couleurs employées par un rendu sur palette : de {min(emplois)} à {max(emplois)}"
                  f" sur les {len(univers['palette'])} de la palette")
        releve["rendus"] = {"sur_palette": dessus, "hors_palette": a_cote,
                            "part_pixels": 100 * sur_px // max(1, total_px),
                            "emplois_min": min(emplois) if emplois else None,
                            "emplois_max": max(emplois) if emplois else None}

    # ── 7 ────────────────────────────────────────────────────────────────────
    titre("7", "Le tableau tient-il dans son écran ?")
    toutes_cartes = cartes(options.projet)
    textes = [c for c in toutes_cartes if c.get("genre") == "texte"]
    images = [c for c in toutes_cartes if c.get("genre") == "image"]
    art = [c for c in toutes_cartes if c.get("officiel")]
    print(f"  {len(toutes_cartes)} cartes — {len(images)} images, {len(textes)} textes, "
          f"{len(art)} artworks officiels")
    groupes = sorted({c.get("groupe") or "" for c in toutes_cartes} - {""})
    print(f"  {len(groupes)} îlots : {', '.join(groupes) if groupes else '—'}")
    sans_famille = sum(1 for c in toutes_cartes if (c.get("famille") or "tous") == "tous")
    print(f"  cartes sans famille propre : {sans_famille} sur {len(toutes_cartes)}")
    if textes:
        plus_grosse = max(textes, key=lambda c: len(c.get("texte") or ""))
        longueur = len(plus_grosse.get("texte") or "")
        print(f"\n  la plus grosse carte texte : {longueur} caractères, "
              f"{len((plus_grosse.get('texte') or '').split())} mots")
        if ecrit:
            print(f"  elle écrit le même univers que la bible, {longueur / ecrit:.0f} fois plus longuement")
        releve["carte_texte"] = {"caracteres": longueur,
                                 "mots": len((plus_grosse.get("texte") or "").split()),
                                 "rapport_bible": round(longueur / ecrit, 1) if ecrit else None}
    releve["tableau"] = {"cartes": len(toutes_cartes), "images": len(images),
                         "textes": len(textes), "artworks": len(art),
                         "ilots": len(groupes), "sans_famille": sans_famille}

    # ── 8 ────────────────────────────────────────────────────────────────────
    titre("8", "Le barème et les modèles ont-ils jamais décidé quelque chose ?")
    defauts = {e.nom: (e.famille, e.occupation, e.silhouette) for e in BAREME_PAR_DEFAUT}
    valeurs, bougees, ici = 0, 0, 0
    for autre in sorted(p.name for p in (DONNEES / "projets").glob("*") if p.is_dir()):
        univers_autre = projet(autre)["univers"]
        for echelle in univers_autre.get("bareme", ()):
            defaut = defauts.get(echelle["nom"])
            if not defaut:
                continue
            for rang, (quoi, pose) in enumerate(
                (("famille", echelle["famille"]),
                 ("occupation", echelle["occupation"]),
                 ("silhouette", echelle["silhouette"]))
            ):
                valeurs += 1
                if pose != defaut[rang]:
                    bougees += 1
                    ici += autre == options.projet
                    print(f"  {autre:22s} {echelle['nom']:20s} {quoi:11s} "
                          f"{defaut[rang]} → {pose}")
    if not bougees:
        print("  aucune valeur de barème ne s'écarte du défaut, sur aucun projet")
    print(f"  {bougees} valeur(s) sur {valeurs}, dont {ici} sur « {options.projet} »")

    familles_reglees = sum(1 for f, m in (univers.get("modeles") or {}).items() if m)
    print(f"\n  modèle par défaut posé sur {familles_reglees} famille(s)")
    for champ in ("modele_planche", "modele_edition"):
        print(f"  {champ:16s} {univers.get(champ) or '— (le défaut du catalogue décide)'}")
    releve["bareme"] = {"valeurs": valeurs, "bougees": bougees, "bougees_ici": ici,
                        "familles_reglees": familles_reglees}

    SORTIE.write_text(json.dumps(releve, ensure_ascii=False, indent=2), encoding="utf-8")
    print()
    print(f"relevé écrit dans {SORTIE.relative_to(RACINE)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
