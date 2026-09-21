# -*- coding: utf-8 -*-
"""RV8 — **ce que la livraison écrit dans Godot ne bouge pas d'un octet** (C03).

RV8 réunit « Livrer dans Godot » (AU1) et « Exporter des fichiers » (B21) sous un
seul écran, et range le dossier du jeu à un seul endroit. Rien de cela ne doit
changer les fichiers posés dans le jeu pour un même choix. Ce script en garde la
preuve **entre deux commits** : lancé avant la tranche, puis après, il écrit
`{chemin relatif : sha256}` de tout ce que les livraisons ont posé ; le diff des
deux sorties doit être vide.

## Comment le lancer

    .venv/Scripts/python.exe essais/essai_rv8_identite.py --sortie avant.json
    … le code change …
    .venv/Scripts/python.exe essais/essai_rv8_identite.py --sortie apres.json

## Pourquoi un « socle » gardé entre les deux lancements

Deux ateliers montés deux fois ne donnent pas les mêmes octets : identifiants
tirés au hasard, dates de création, et le chemin du dossier Godot recopié dans
chaque manifeste AU1. Le script monte donc l'atelier **une seule fois** (le socle,
au premier lancement) et, à chaque lancement, en livre **une copie fraîche** dans
un dossier de jeu dont le chemin ne change pas. Même données, même chemin : seul
le code diffère entre « avant » et « après ». Le socle est monté par le code
d'avant — c'est voulu, les données de l'auteur aussi l'ont été.

Tout vit dans le dossier temporaire du système (`asset-kitchen-rv8-identite/`),
jamais dans `donnees/` ni dans un vrai projet Godot. Les images viennent du double
de fournisseur des essais : **rien n'est payé**, et le script marche réseau coupé.

## Ce qui est livré

- **B21, par l'entrée qui existe aujourd'hui** — le dossier nommé dans l'appel
  (`POST /api/output` avec `dossier`) : tout le jeu à plat ; tout le jeu en
  dossiers avec le catalogue Godot ; les animations seules avec Phaser ; un seul
  sujet en dossiers avec Unity.
- **AU1, par l'association du jeu** : l'animation d'un sujet (paquet Godot), une
  image fixe, un son, un jeu de tuiles — chacun préparé puis livré.

On retire **seulement** `exporte_le` du descriptif de l'atelier avant de
l'empreinter : c'est l'instant de la sortie, il change à chaque passage.

La fixture n'a **aucune** bande tirée d'un clip `echouee` : RV8c l'écarte exprès,
et ce changement-là doit se voir ailleurs que dans ce diff.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import sys
import tempfile
from pathlib import Path

import numpy as np

RACINE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RACINE))
sys.path.insert(0, str(RACINE / "tests"))
sys.path.insert(0, str(RACINE / "essais"))

from fastapi.testclient import TestClient  # noqa: E402

from atelier.api.app import creer_application  # noqa: E402
from atelier.audio.traitement import encoder  # noqa: E402
from atelier.domaine import sortie as vocabulaire  # noqa: E402
from atelier.services import Atelier  # noqa: E402
from atelier.services.export import DESCRIPTIF  # noqa: E402

# Le double et le peuplement de B21, **importés et pas recopiés** : c'est le
# même jeu que l'écran de la sortie a déjà cliqué.
from atelier_jetable_b21 import peupler  # noqa: E402
from conftest import AnimateurMuet, FournisseurDouble  # noqa: E402
from tests.test_tu4_livraison import carte_de_l_ile, fabriquer  # noqa: E402

DEFAUT = Path(tempfile.gettempdir()) / "asset-kitchen-rv8-identite"

PROJECT_GODOT = (
    'config_version=5\n[application]\nconfig/name="Essai RV8"\n'
    'config/features=PackedStringArray("4.7", "GL Compatibility")\n'
    '[rendering]\nrenderer/rendering_method="gl_compatibility"\n'
)

# Les quatre sorties B21, chacune dans son dossier du jeu. Le nom du dossier est
# la clé : il se relit dans le manifeste, à côté des chemins.
SORTIES_B21 = {
    "fichiers-a-plat": {"lot": vocabulaire.TOUT, "rangement": vocabulaire.A_PLAT},
    "fichiers-en-dossiers": {
        "lot": vocabulaire.TOUT,
        "rangement": vocabulaire.EN_DOSSIERS,
        "moteur": vocabulaire.GODOT,
    },
    "fichiers-animations-phaser": {
        "lot": vocabulaire.ANIMATIONS,
        "rangement": vocabulaire.A_PLAT,
        "moteur": vocabulaire.PHASER,
    },
    "fichiers-un-sujet-unity": {
        "rangement": vocabulaire.EN_DOSSIERS,
        "moteur": vocabulaire.UNITY,
        "sujet": "@pelerin",  # remplacé par l'identifiant du socle
    },
}


def _exiger(reponse, quoi: str):
    if reponse.status_code >= 400:
        raise SystemExit(f"Refus pour {quoi} ({reponse.status_code}) : {reponse.text}")
    return reponse.json()


def _signal(taux: int = 16000) -> bytes:
    gauche = 0.25 * np.sin(2 * np.pi * 440 * np.arange(taux) / taux)
    return encoder(np.column_stack((gauche, -gauche)), taux)


def _atelier(racine: Path) -> tuple[Atelier, FournisseurDouble]:
    double = FournisseurDouble()
    return Atelier(
        racine=racine,
        fabrique_fournisseur=lambda: double,
        fabrique_animateur=lambda: AnimateurMuet(),
    ), double


# ── Le socle, monté une fois ────────────────────────────────────────────────


def monter_socle(socle: Path) -> dict:
    """Le jeu de B21, plus un son et un jeu de tuiles. **Écrit une seule fois.**"""
    atelier, double = _atelier(socle / "atelier")
    ids = peupler(atelier, double)
    with TestClient(creer_application(atelier)):
        projet = atelier.bibliotheque.courant
        # La bande de B21 n'est qu'à l'index : AU1 relit la sienne sur le disque
        # (« les fichiers font foi »), on l'y pose donc aussi.
        bande = atelier.base.lire_bande("bande-b21-la marche")
        atelier.fichiers.ecrire_bande(bande.clip, bande.identifiant, bande.en_json())
        # L'image fixe d'AU1 : la première du pèlerin, dans un ordre stable.
        images = sorted(
            (
                a
                for a in atelier.base.assets_du_personnage(ids["pelerin"], projet=projet)
                if a.supprime_le is None and not a.piece and a.type_media.startswith("image/")
            ),
            key=lambda a: (a.pose or "", a.identifiant),
        )
        son = atelier.sons.importer_octets(projet, _signal(), nom="Cloche.wav", cle="rv8:cloche")
        # Un sol, **avec sa carte d'essai peinte** : sans elle, la livraison
        # des tuiles refuse (« peignez une carte d'essai »). Le même que TU4.
        tuiles = fabriquer(atelier, projet, "Herbe", "sol", 16, {}, None,
                           carte=carte_de_l_ile("B47"))
    fiche = {
        **ids,
        "projet": projet,
        "bande": bande.identifiant,
        "image": images[0].identifiant,
        "son": son["identifiant"],
        "tuiles": tuiles["identifiant"],
    }
    (socle / "ids.json").write_text(json.dumps(fiche, ensure_ascii=False, indent=2), encoding="utf-8")
    return fiche


# ── Une livraison, sur une copie fraîche ────────────────────────────────────


def livrer(socle: Path, travail: Path, ids: dict) -> Path:
    """Recopie le socle, livre tout, et rend le dossier du jeu."""
    if travail.exists():
        shutil.rmtree(travail)
    shutil.copytree(socle / "atelier", travail / "atelier")
    jeu = travail / "jeu"
    jeu.mkdir(parents=True)
    (jeu / "project.godot").write_text(PROJECT_GODOT, encoding="utf-8")

    atelier, _ = _atelier(travail / "atelier")
    projet = ids["projet"]
    with TestClient(creer_application(atelier)) as client:
        # B21, par le dossier nommé dans l'appel — l'entrée qui existe avant RV8.
        for nom, reglage in SORTIES_B21.items():
            corps = dict(reglage)
            if corps.get("sujet") == "@pelerin":
                corps["sujet"] = ids["pelerin"]
            _exiger(
                client.post(
                    "/api/output",
                    json={"projet": projet, "dossier": str(jeu / nom), **corps},
                ),
                f"la sortie « {nom} »",
            )

        # AU1, par l'association du jeu : quatre paquets, préparés puis livrés.
        atelier.livraison.associer(projet, str(jeu))
        preparations = [
            atelier.livraison.prevoir(projet, ids["pelerin"], [ids["bande"]]),
            atelier.livraison_images.prevoir(projet, ids["pelerin"], ids["image"]),
            atelier.sons.prevoir_livraison(projet, ids["son"]),
            atelier.tuiles.prevoir_livraison(projet, ids["tuiles"]),
        ]
        for preparation in preparations:
            bilan = atelier.livraison.livrer(projet, preparation["jeton"])
            if bilan.get("etat") != "terminee":
                raise SystemExit(f"Livraison AU1 non terminée : {bilan}")
    return jeu


def empreintes(jeu: Path) -> dict[str, str]:
    """`{chemin relatif : sha256}` — `exporte_le` retiré du seul descriptif."""
    rendu = {}
    for fichier in sorted(p for p in jeu.rglob("*") if p.is_file()):
        octets = fichier.read_bytes()
        if fichier.name == DESCRIPTIF:
            contenu = json.loads(octets.decode("utf-8"))
            contenu.pop("exporte_le", None)
            octets = json.dumps(contenu, ensure_ascii=False, indent=2).encode("utf-8")
        rendu[fichier.relative_to(jeu).as_posix()] = hashlib.sha256(octets).hexdigest()
    return rendu


def principal() -> int:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    lecteur = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    lecteur.add_argument("--dossier", type=Path, default=DEFAUT,
                         help="où vivent le socle et la copie de travail")
    lecteur.add_argument("--sortie", type=Path, default=None,
                         help="le manifeste {chemin: sha256} à écrire")
    lecteur.add_argument("--refaire-le-socle", action="store_true",
                         help="remonter le socle (les empreintes ne se comparent plus)")
    arguments = lecteur.parse_args()

    socle = arguments.dossier / "socle"
    if arguments.refaire_le_socle and socle.exists():
        shutil.rmtree(socle)
    if not (socle / "ids.json").exists():
        if socle.exists():
            shutil.rmtree(socle)
        print(f"Montage du socle : {socle}")
        ids = monter_socle(socle)
    else:
        ids = json.loads((socle / "ids.json").read_text(encoding="utf-8"))
        print(f"Socle relu : {socle}")

    jeu = livrer(socle, arguments.dossier / "travail", ids)
    manifeste = {"socle": str(socle), "jeu": str(jeu), "fichiers": empreintes(jeu)}
    texte = json.dumps(manifeste, ensure_ascii=False, indent=2, sort_keys=True)
    if arguments.sortie:
        arguments.sortie.write_text(texte + "\n", encoding="utf-8")
        print(f"Manifeste écrit : {arguments.sortie}")
    comptes: dict[str, int] = {}
    for chemin in manifeste["fichiers"]:
        tete = chemin.split("/")[0]
        comptes[tete] = comptes.get(tete, 0) + 1
    print(f"{len(manifeste['fichiers'])} fichiers dans le jeu :")
    for tete, compte in sorted(comptes.items()):
        print(f"  {tete:32} {compte}")
    return 0


if __name__ == "__main__":
    raise SystemExit(principal())
