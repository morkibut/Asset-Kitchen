# -*- coding: utf-8 -*-
"""TU10 : le serveur rend un jeu de tuiles fabriqué, avec le code même de l'écran.

`docs/PLAN-tuiles.md`, décision 3 et § TU10. Jusqu'ici l'écran rendait l'atlas et
l'envoyait avec sa recette ; pour que l'agent fabrique **sans écran**, le serveur
lance `atelier/tuiles_node/rendre.mjs` sous Node. Ce script importe
`interface/src/tuiles/atelier.ts` et `interface/src/tuiles/png.ts` tels quels : la
transformation « recette → réglages du moteur → planche → PNG » et le contrôle des
bords (tile-check) n'existent qu'une fois, dans l'interface. Rien n'est porté en
Python ; `tests/test_tu10_agent.py` compare ce rendu, pixel pour pixel, à celui que
fait un vrai navigateur à partir des gestes de l'écran.

**Node est facultatif pour l'atelier, obligatoire pour ce seul chemin.** Sans lui,
les gestes qui en ont besoin (créer ou changer la recette d'un jeu depuis l'agent,
relire la vérification) répondent `NodeAbsent` avec une phrase qui dit quoi
installer ; tout le reste — l'écran, qui rend lui-même, et les jeux « à partir
d'une image » — fonctionne comme avant.
"""

from __future__ import annotations

import base64
import io
import json
import os
import re
import shutil
import subprocess
from pathlib import Path
from typing import Any

from PIL import Image

from atelier.domaine.tuiles import TuilesRefusees

SCRIPT = Path(__file__).resolve().parent.parent / "tuiles_node" / "rendre.mjs"
RACINE = SCRIPT.parent.parent.parent
# Le TypeScript de l'écran s'exécute en effaçant ses types : sans option depuis
# Node 22.18 (et 23.6), et `module.registerHooks` existe depuis 22.15 (et 23.5).
# La série 23 avant 23.6 n'a ni l'un ni l'autre sans option : elle est refusée.
VERSION_MIN = (22, 18)
VERSION_MIN_23 = (23, 6)


def _assez_recent(version: tuple[int, ...]) -> bool:
    return version >= VERSION_MIN and not (23, 0) <= version < VERSION_MIN_23
DELAI = 120  # secondes ; un mur de 64 px avec animation se rend en moins d'une seconde

PHRASE_NODE = ("Le rendu des jeux de tuiles côté serveur demande Node.js {min} ou plus, {etat}. "
               "Installez Node.js (nodejs.org) ou indiquez son chemin dans la variable ATELIER_NODE, "
               "puis réessayez. Le reste de l’atelier fonctionne sans lui, et l’écran des tuiles rend "
               "lui-même ses planches.")


class NodeAbsent(TuilesRefusees):
    code = "node_absent"


def _version(chemin: str) -> tuple[int, ...] | None:
    try:
        sortie = subprocess.run([chemin, "--version"], capture_output=True, text=True, timeout=15)
    except (OSError, subprocess.SubprocessError):
        return None
    lu = re.match(r"v(\d+)\.(\d+)", sortie.stdout.strip())
    return (int(lu[1]), int(lu[2])) if lu else None


class ServiceRenduTuiles:
    """Le pont vers `rendre.mjs`. Aucun état : Node est cherché à chaque appel, pour
    qu'une installation faite pendant la séance serve sans redémarrer l'atelier."""

    def __init__(self, atelier) -> None:
        self.a = atelier
        self._versions: dict[str, tuple[int, ...] | None] = {}

    # ── Node ─────────────────────────────────────────────────────────────────

    def _node(self) -> str:
        """Le chemin de Node, ou `NodeAbsent` avec ce qui manque."""
        voulu = os.environ.get("ATELIER_NODE")
        chemin = (voulu if voulu and Path(voulu).is_file() else None) if voulu is not None else shutil.which("node")
        minimum = ".".join(map(str, VERSION_MIN))
        if not chemin:
            raise NodeAbsent(PHRASE_NODE.format(min=minimum, etat="introuvable sur cette machine"))
        if chemin not in self._versions:
            self._versions[chemin] = _version(chemin)
        version = self._versions[chemin]
        if version is None:
            raise NodeAbsent(PHRASE_NODE.format(min=minimum, etat=f"« {chemin} » ne répond pas"))
        if not _assez_recent(version):
            serie_23 = " (dans la série 23, il faut la 23.6 ou plus)" if version[0] == 23 else ""
            raise NodeAbsent(PHRASE_NODE.format(min=minimum, etat=f"la machine a la {'.'.join(map(str, version))}{serie_23}"))
        if not (RACINE / "interface" / "src" / "tuiles" / "atelier.ts").is_file():
            raise NodeAbsent("Le rendu serveur des jeux de tuiles lit le code de l’écran "
                             "(interface/src/tuiles/atelier.ts), absent de cette installation.")
        return chemin

    def disponibilite(self) -> dict[str, Any]:
        try:
            chemin = self._node()
        except NodeAbsent as refus:
            return {"disponible": False, "raison": refus.raison}
        return {"disponible": True, "raison": None, "node": ".".join(map(str, self._versions[chemin] or ()))}

    def _lancer(self, commande: dict[str, Any]) -> dict[str, Any]:
        node = self._node()
        try:
            sortie = subprocess.run([node, "--no-warnings", str(SCRIPT)], input=json.dumps(commande),
                                    capture_output=True, text=True, encoding="utf-8", timeout=DELAI, cwd=str(RACINE))
        except subprocess.TimeoutExpired:
            raise TuilesRefusees(f"Le rendu du jeu de tuiles a dépassé {DELAI} secondes ; rien n’a été gardé.") from None
        try:
            reponse = json.loads(sortie.stdout)
        except ValueError:
            reponse = {"erreur": (sortie.stderr or sortie.stdout).strip()[-600:] or f"code {sortie.returncode}"}
        if sortie.returncode != 0 or "erreur" in reponse:
            raise TuilesRefusees(f"Le rendu du jeu de tuiles a échoué : {reponse.get('erreur')}")
        return reponse

    # ── Ce que le script lit ─────────────────────────────────────────────────

    @staticmethod
    def rgba(octets: bytes) -> dict[str, Any]:
        """Une image décodée en RGBA 8 bits, comme `getImageData` la rend à l'écran."""
        with Image.open(io.BytesIO(octets)) as lu:
            image = lu.convert("RGBA")
        return {"largeur": image.width, "hauteur": image.height, "rgba": base64.b64encode(image.tobytes()).decode("ascii")}

    def _images(self, recette: dict[str, Any]) -> dict[str, Any]:
        """Les matières « asset » de la recette : les octets que l'écran lit
        (`api.fichier`, c'est-à-dire `assets.octets` sans `brut`)."""
        images = {}
        for e in recette["emplacements"].values():
            if e.get("source") == "asset" and e["asset"] not in images:
                asset = self.a.assets.lire(e["asset"])
                if asset is None:
                    raise TuilesRefusees("Une matière de la recette est introuvable dans la bibliothèque.")
                octets, _ = self.a.assets.octets(asset)
                images[e["asset"]] = self.rgba(octets)
        return images

    def _palette(self, projet: str) -> list[str]:
        """La palette de l'univers, pour « la palette du jeu » (TU6) : l'écran la tient
        sur le jeu édité (`paletteUnivers`), le serveur la lit sur le projet."""
        jeu = self.a.base.lire_projet(projet)
        return list(getattr(getattr(jeu, "univers", None), "palette", ()) or ())

    @staticmethod
    def _verification(brute: dict[str, Any]) -> dict[str, Any]:
        """Le contrôle de sc-clone, dit en clair. Un défaut avertit, il ne bloque rien (RP10)."""
        defauts = brute.get("defauts", [])
        if not brute.get("verifiable"):
            phrase = "Ces pièces se posent à la main : il n’y a pas de raccord à vérifier."
        elif not defauts:
            phrase = f"Aucun défaut : {brute['pieces']} pièces se raccordent."
        else:
            phrase = f"{len(defauts)} défaut{'s' if len(defauts) > 1 else ''} sur {brute['pieces']} pièces."
        return {**brute, "propre": brute.get("verifiable", False) and not defauts, "phrase": phrase}

    # ── Les gestes ───────────────────────────────────────────────────────────

    def rendre(self, projet: str, recette: dict[str, Any], carte: Any = None) -> dict[str, Any]:
        """L'atlas d'une recette **déjà vérifiée** (`recette_tuiles.recette`) : le PNG,
        sa vérification, et la carte d'essai en pièces posées.

        `carte` : `None` pour la carte par défaut de l'écran (`carteDefaut`), une liste
        de lignes peintes (`"..##.."`, un `#` par case pleine — par sommet pour les
        15 pièces), ou `False` pour ne pas en calculer."""
        commande: dict[str, Any] = {"recette": recette, "images": self._images(recette), "rendre": True,
                                    "palette_univers": self._palette(projet)}
        if carte is not False:
            commande["carte"] = self._carte(carte)
        r = self._lancer(commande)
        return {"png": base64.b64decode(r["png"]), "largeur": r["largeur"], "hauteur": r["hauteur"],
                "empreinte": r["empreinte"], "verification": self._verification(r["verification"]),
                "carte": r.get("carte"), "duree_ms": r["duree_ms"]}

    def carte(self, projet: str, recette: dict[str, Any], peinte: list[str]) -> dict[str, Any] | None:
        """Seulement la carte peinte, en pièces posées — sans rendre l'atlas."""
        return self._lancer({"recette": recette, "images": {}, "carte": self._carte(peinte)}).get("carte")

    @staticmethod
    def _carte(peinte: Any) -> dict[str, Any] | None:
        if peinte is None:
            return None
        if (not isinstance(peinte, list) or not peinte or len(peinte) > 128
                or not all(isinstance(l, str) and 0 < len(l) <= 128 and set(l) <= {"#", "."} for l in peinte)):
            raise TuilesRefusees("La carte se peint en lignes de « # » (case pleine) et de « . » (case vide), 128 au plus.")
        return {"peinte": peinte}

    def verifier(self, projet: str, identifiant: str, revision: int | None = None) -> dict[str, Any]:
        """Le contrôle des bords sur l'atlas **gardé** d'un jeu fabriqué — celui qui sera livré."""
        objet = self.a.tuiles._brut(projet, identifiant, revision)
        if objet.get("recette") is None:
            raise TuilesRefusees("Un jeu fait à partir d’une image n’a pas de recette : ses raccords se jugent sur la carte.")
        atlas = self.a.tuiles._atlas(objet)
        commande = {"recette": objet["recette"], "images": {}, "atlas": {"largeur": atlas.width, "hauteur": atlas.height,
                    "rgba": base64.b64encode(atlas.tobytes()).decode("ascii")}}
        # Le contrôle ne lit que la sorte, la taille et le second terrain : les
        # matières « asset » ne sont pas relues pour lui.
        commande["recette"] = {**objet["recette"], "emplacements": {
            k: (v if v.get("source") != "asset" else {"source": "vide", **({"lie": False} if "lie" in v else {})})
            for k, v in objet["recette"]["emplacements"].items()}}
        return self._verification(self._lancer(commande)["verification"])
