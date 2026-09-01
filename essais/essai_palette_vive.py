# -*- coding: utf-8 -*-
"""Le banc de la palette qui ne fait plus attendre — les deux temps, mesurés.

Écrit le 1<sup>er</sup> septembre 2026 en tenant `U6`, dont un critère dit :
« un banc gratuit mesure les deux temps — avant et après — et garde son relevé ».

**Ce qu'on mesure, et pourquoi c'était lent.** Avant de rendre une palette,
l'atelier vérifie si elle est encore d'accord avec ses sources ; pour cela il
fabrique une empreinte, et cette empreinte était faite des couleurs elles-mêmes
— donc il **relisait et requantifiait tout le paquet d'images**, y compris quand
on n'avait bougé qu'un curseur qui ne touche pas aux sources. Le calcul qu'on
refaisait était très exactement celui dont on voulait savoir s'il fallait le
refaire. L'auteur a mesuré 2,1 secondes par relâchement de curseur, sur un
paquet de trois images, le 31 août 2026.

**Comment l'avant est mesuré alors qu'il n'existe plus.** Le banc le remonte :
il repose sur le service la fonction d'empreinte d'avant — dix lignes, recopiées
ici — et neutralise la lecture gardée. Les deux temps sont donc pris sur le même
service, les mêmes images et la même machine, ce qui est la seule façon qu'ils
soient comparables. La version d'avant est lisible en fin de fichier ; si elle
cessait de correspondre à ce qui a été remplacé, ce banc mentirait, et c'est la
raison pour laquelle elle est écrite en entier plutôt que résumée.

**Il ne coûte rien et ne touche à rien.** Les images sont de vraies cartes déjà
sur le disque, recopiées dans un atelier jetable monté dans un dossier
temporaire : le jeu de l'auteur n'est ni lu en écriture ni modifié. Aucune clé
n'est lue, aucun appel n'est fait, tout le calcul est du processeur.

    Lancer :  py essais/essai_palette_vive.py
              py essais/essai_palette_vive.py --images 3 --tours 5

Sortie : ce journal, et `essais/mesures_palette_vive.json` pour lire la dérive
d'une exécution à l'autre.
"""

from __future__ import annotations

import argparse
import json
import pathlib
import shutil
import sys
import tempfile
import time

RACINE = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RACINE))

from atelier.domaine.ambiance import empreinte_de_palette  # noqa: E402
from atelier.services import Atelier  # noqa: E402
from atelier.domaine.recette import Grille, Recette  # noqa: E402
from atelier.services.ambiances import PROFONDEUR  # noqa: E402

SORTIE = RACINE / "essais" / "mesures_palette_vive.json"
GROUPE = "le paquet du banc"


# ── Le corpus : de vraies cartes, recopiées dans un atelier jetable ──────────


def cartes_du_disque(combien: int) -> list[tuple[str, bytes]]:
    """Les premières images de tableau assez grandes, sur n'importe quel projet.

    **De vraies images, et c'est le point du banc.** Des carrés de couleur
    fabriqués pour l'occasion se quantifieraient en quelques millisecondes et ne
    diraient rien du temps qu'on cherche à mesurer — c'est déjà ce que les
    essais font, et ce n'est pas ce qu'on cherche ici.
    """
    trouvees: list[tuple[str, bytes]] = []
    for tableau in sorted((RACINE / "donnees" / "projets").glob("*/tableau")):
        for fichier in sorted(tableau.glob("*.png")):
            octets = fichier.read_bytes()
            if len(octets) < 50_000:  # une vignette ne mesure rien
                continue
            trouvees.append((fichier.name, octets))
            if len(trouvees) >= combien:
                return trouvees
    if not trouvees:
        raise SystemExit(
            "aucune image de tableau sur le disque — ce banc mesure ce qui est là"
        )
    return trouvees


def atelier_jetable(images: list[tuple[str, bytes]]) -> tuple[Atelier, str, str, str]:
    """Un atelier neuf dans un dossier temporaire, avec un paquet et une palette.

    Rend l'atelier, le projet, l'identifiant de la palette et le dossier à
    effacer. **Rien du jeu de l'auteur n'est écrit** : on lui a seulement
    emprunté des octets.
    """
    dossier = tempfile.mkdtemp(prefix="banc-palette-")
    atelier = Atelier(racine=pathlib.Path(dossier), fabrique_fournisseur=lambda: None)
    projet = atelier.bibliotheque.creer_projet("le banc").identifiant

    for nom, octets in images:
        pose = atelier.univers.coller_image(projet, octets, nom=nom, forcer=True)
        carte = pose["carte"]
        atelier.univers.regler(projet, carte["identifiant"], groupe=GROUPE)

    # **Trois images dans la bibliothèque**, sans quoi l'aperçu n'a rien à
    # poser la palette dessus et se mesurerait à zéro — un chiffre qui aurait
    # l'air d'une bonne nouvelle en ne mesurant rien du tout.
    for nom, octets in images_de_la_bibliotheque(3):
        atelier.generations.importer(octets, nom, projet=projet, forcer=True)

    palette = atelier.ambiances.creer_palette(
        projet, "la palette du banc", sources=[{"genre": "images", "reference": GROUPE}]
    )
    return atelier, projet, palette.identifiant, dossier


def images_de_la_bibliotheque(combien: int) -> list[tuple[str, bytes]]:
    """De vraies images générées, une par génération — de quoi peupler l'aperçu.

    Une par génération et non toutes : huit variations du même sujet
    quantifieraient huit fois la même chose.
    """
    trouvees: list[tuple[str, bytes]] = []
    dossier = RACINE / "donnees" / "generations"
    if not dossier.exists():
        return trouvees
    for generation in sorted(dossier.iterdir()):
        if not generation.is_dir():
            continue
        for fichier in sorted(generation.glob("*-brut.png")):
            trouvees.append((f"{generation.name[:8]}.png", fichier.read_bytes()))
            break
        if len(trouvees) >= combien:
            break
    return trouvees


# ── L'empreinte d'avant, remontée pour être mesurée ──────────────────────────


class SansLectureGardee(dict):
    """Un cache qui rate toujours — l'état du service avant l'étape.

    Une sous-classe de `dict` plutôt qu'un drapeau dans le service : le service
    n'a pas à savoir qu'un banc le mesure, et un drapeau dans le code livré
    serait une seconde façon de se comporter, donc une seconde chose à tenir.
    """

    def get(self, cle, defaut=None):  # noqa: D102 — le docstring est au-dessus
        return None

    def __setitem__(self, cle, valeur) -> None:
        return None


def empreinte_davant(service, objet, palette) -> str:
    """La fonction remplacée, recopiée mot pour mot.

    L'empreinte d'une source `images` portait les couleurs qu'elle rend — donc
    il fallait les lire pour la fabriquer.
    """
    matieres = []
    for source in palette.sources:
        couleurs = service._couleurs_de_source(objet, source, PROFONDEUR)
        matieres.append(f"{source.genre}:{source.reference}:{','.join(couleurs)}")
    return empreinte_de_palette(
        matieres,
        palette.couleurs,
        palette.du_jeu,
        palette.attraction,
        palette.retouches,
    )


# ── Les deux mesures ─────────────────────────────────────────────────────────


def un_tour(atelier: Atelier, projet: str, palette: str, attraction: float) -> float:
    """Un relâchement de curseur, du geste à ce que l'écran reçoit.

    C'est le geste que l'auteur a chronométré : bouger l'attraction, puis lire
    le côté — la route de réglage rend le côté entier, donc les deux sont un
    seul aller-retour et se mesurent ensemble.
    """
    depart = time.perf_counter()
    atelier.ambiances.regler_palette(projet, palette, attraction=attraction)
    atelier.ambiances.cote(projet)
    return time.perf_counter() - depart


def mesurer(atelier: Atelier, projet: str, palette: str, tours: int) -> dict:
    """Les deux temps, dans cet ordre — avant puis après, sur les mêmes images."""
    service = atelier.ambiances
    vraie_empreinte = type(service)._empreinte
    vrais_paquets = service._paquets

    # ── Avant : l'empreinte lit les couleurs, et rien n'est gardé ────────────
    type(service)._empreinte = empreinte_davant
    service._paquets = SansLectureGardee()
    # Un tour à blanc : le premier appel paie le disque froid du système, qui
    # n'est ni de l'avant ni de l'après.
    un_tour(atelier, projet, palette, 0.05)
    avant = [un_tour(atelier, projet, palette, 0.1 + i * 0.05) for i in range(tours)]

    # ── Après : l'empreinte est une signature, la lecture est gardée ─────────
    type(service)._empreinte = vraie_empreinte
    service._paquets = vrais_paquets
    un_tour(atelier, projet, palette, 0.05)
    apres = [un_tour(atelier, projet, palette, 0.1 + i * 0.05) for i in range(tours)]

    return {
        "avant_s": avant,
        "apres_s": apres,
        "avant_median_ms": round(median(avant) * 1000, 1),
        "apres_median_ms": round(median(apres) * 1000, 1),
    }


def median(valeurs: list[float]) -> float:
    """La médiane, et non la moyenne : une pause du ramasse-miettes au milieu
    d'une série tire une moyenne et laisse une médiane tranquille."""
    triees = sorted(valeurs)
    milieu = len(triees) // 2
    if len(triees) % 2:
        return triees[milieu]
    return (triees[milieu - 1] + triees[milieu]) / 2


def mesurer_lapercu(atelier: Atelier, projet: str, palette: str) -> dict[str, float]:
    """L'aperçu sur de vraies images — la demi-seconde qui suivait le réglage.

    Il n'y a pas d'avant et d'après ici : l'aperçu n'a pas changé. Il est mesuré
    parce que le relevé de l'auteur le comptait dans l'attente, et qu'un chiffre
    cité sans banc devient invérifiable au premier doute.

    **Deux fois, et l'écart est le renseignement.** L'aperçu pose la palette sur
    ce que la bibliothèque contient : des images brutes de mille pixels tant
    qu'on n'a rien rangé, des sprites de soixante-quatre une fois la grille
    posée. Le second est le cas ordinaire — le relevé de l'auteur en vient — et
    le premier dit ce que coûte un aperçu demandé trop tôt.
    """
    brut = time.perf_counter()
    atelier.ambiances.apercu(projet, palette, 3)
    sur_le_brut = time.perf_counter() - brut

    for asset in atelier.bibliotheque.chercher(projet=projet, limite=3):
        atelier.assets.poser_recette(
            asset.identifiant, Recette(grille=Grille(cible=64))
        )
    range_ = time.perf_counter()
    atelier.ambiances.apercu(projet, palette, 3)
    sur_les_sprites = time.perf_counter() - range_

    return {
        "apercu_brut_ms": round(sur_le_brut * 1000, 1),
        "apercu_sprites_ms": round(sur_les_sprites * 1000, 1),
    }


# ── Le journal ───────────────────────────────────────────────────────────────


def main() -> None:
    analyse = argparse.ArgumentParser(description=__doc__)
    analyse.add_argument("--images", type=int, default=3)
    analyse.add_argument("--tours", type=int, default=5)
    options = analyse.parse_args()

    images = cartes_du_disque(options.images)
    print("Banc de la palette vive — aucun frais, aucun réseau, aucune écriture du jeu")
    print("=" * 78)
    print(f"  {len(images)} image(s) réelle(s), {options.tours} relâchements de curseur")
    for nom, octets in images:
        print(f"    {nom}  {len(octets) / 1024:.0f} Ko")
    print()

    atelier, projet, palette, dossier = atelier_jetable(images)
    try:
        releve = mesurer(atelier, projet, palette, options.tours)
        releve.update(mesurer_lapercu(atelier, projet, palette))
        releve["images"] = len(images)
        releve["tours"] = options.tours
    finally:
        shutil.rmtree(dossier, ignore_errors=True)

    avant, apres = releve["avant_median_ms"], releve["apres_median_ms"]
    print("Bouger l'attraction, puis relire le côté")
    print("-" * 78)
    print(f"  avant   {avant:8.1f} ms   l'empreinte relit et requantifie le paquet")
    print(f"  après   {apres:8.1f} ms   l'empreinte est une signature, la lecture est gardée")
    gain = avant / apres if apres else float("inf")
    print(f"  gain    {gain:8.1f} ×")
    print()
    print("L'aperçu sur trois images, qui n'a pas changé")
    print("-" * 78)
    print(f"  brut    {releve['apercu_brut_ms']:8.1f} ms   images de mille pixels, rien n'est rangé")
    print(f"  rangé   {releve['apercu_sprites_ms']:8.1f} ms   sprites de 64 px, le cas ordinaire")
    print()

    print("Verdict")
    print("-------")
    tenu = apres < 300
    print(
        f"  {'✔' if tenu else '✘'} le critère demande moins de 300 ms — "
        f"mesuré {apres:.1f} ms."
    )
    SORTIE.write_text(
        json.dumps(releve, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(f"  Relevé écrit : {SORTIE}")


if __name__ == "__main__":
    main()
