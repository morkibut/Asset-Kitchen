"""Sources de tuiles immuables, retouche réutilisée et carte d’essai durable."""
from __future__ import annotations
import copy
import hashlib
import io
import re
import time
import uuid
import zipfile
from pathlib import Path
from typing import Any

from PIL import Image

from atelier.domaine.tuiles import TuilesRefusees, choix, entier, grille
from atelier.services.livraison import _json, _lire, _poser, _verrou

def png(image: Image.Image) -> bytes:
    sortie = io.BytesIO(); image.save(sortie, format="PNG"); return sortie.getvalue()

class ServiceTuiles:
    def __init__(self, atelier):
        self.a = atelier

    def _racine(self, projet):
        if not self.a.base.lire_projet(projet):
            raise TuilesRefusees("Ce jeu n’existe pas.")
        racine = self.a.fichiers.projets.resolve()
        chemin = (racine / projet / "tuiles").resolve()
        if not chemin.is_relative_to(racine): raise TuilesRefusees("L’ensemble doit rester dans les données du jeu.")
        return chemin

    def _dossier(self, projet, identifiant):
        if not re.fullmatch(r"[a-f0-9]{32}", identifiant): raise TuilesRefusees("Cet ensemble de tuiles n’existe pas.")
        return self._racine(projet) / identifiant

    def _brut(self, projet, identifiant, revision=None):
        dossier = self._dossier(projet, identifiant)
        if revision is not None: entier(revision, "La révision", 1, 1_000_000)
        lu = _lire(dossier / "ensemble.json" if revision is None else dossier / "revisions" / f"{revision}.json")
        if not lu: raise TuilesRefusees("Cette révision de tuiles n’existe pas.")
        return lu

    def _blob(self, dossier: Path, octets: bytes):
        h = hashlib.sha256(octets).hexdigest()
        chemin = dossier / "octets" / h
        if not chemin.exists(): _poser(chemin, octets)
        return h

    def _octets(self, objet, empreinte):
        if not re.fullmatch(r"[a-f0-9]{64}", empreinte): raise TuilesRefusees("L’empreinte d’une source est invalide.")
        chemin = self._dossier(objet["projet"], objet["identifiant"]) / "octets" / empreinte
        if not chemin.is_file(): raise TuilesRefusees("Une source conservée manque. Elle ne sera pas remplacée par la version courante.")
        octets = chemin.read_bytes()
        if hashlib.sha256(octets).hexdigest() != empreinte: raise TuilesRefusees("Une source conservée a changé sur le disque.")
        return octets

    def _source(self, projet, image):
        if not isinstance(image, str): raise TuilesRefusees("Choisissez une image de la bibliothèque.")
        asset = self.a.assets.lire(image)
        if not asset or asset.projet != projet or asset.supprime_le is not None or not asset.type_media.startswith("image/"):
            raise TuilesRefusees("Choisissez une image disponible du jeu pour l’atlas.")
        octets = self.a.export.octets_du_rendu(asset)
        with Image.open(io.BytesIO(octets)) as lu:
            if lu.width * lu.height > 4096**2: raise TuilesRefusees("L’atlas doit rester sous 16 millions de pixels.")
            dimensions = {"largeur": lu.width, "hauteur": lu.height}
        return octets, {"asset": image, "dimensions": dimensions, "provenance": self.a.export.fiche_de_l_asset(asset, "atlas.png", octets)}

    def _garder(self, objet):
        dossier = self._dossier(objet["projet"], objet["identifiant"])
        objet["modifie_le"] = time.time()
        _poser(dossier / "revisions" / f"{objet['revision']}.json", _json(objet))
        _poser(dossier / "ensemble.json", _json(objet))
        self.a.diffusion.publier("tuiles", {"projet": objet["projet"], "identifiant": objet["identifiant"], "revision": objet["revision"]})

    def lister(self, projet):
        return [self.lire(projet, p.parent.name) for p in sorted(self._racine(projet).glob("*/ensemble.json"), key=lambda p: p.stat().st_mtime, reverse=True)]

    def creer(self, projet, brut):
        if not isinstance(brut, dict) or set(brut) - {"nom", "image", "grille", "personnage"}:
            raise TuilesRefusees("Déclarez un nom, une image d’atlas et sa grille.")
        octets, source = self._source(projet, brut.get("image"))
        g = grille(brut.get("grille", {}), **source["dimensions"])
        cellules = [{"x": x, "y": y} for y in range(g["lignes"]) for x in range(g["colonnes"])]
        regles = choix({"nom": brut.get("nom"), "cellules": cellules}, g)
        identifiant = uuid.uuid4().hex
        with _verrou(self._racine(projet) / ".verrou"):
            personnage = brut.get("personnage")
            if personnage:
                self.a.production.personnage(projet, personnage)
            dossier = self._dossier(projet, identifiant)
            source["empreinte"] = self._blob(dossier, octets)
            objet = {"identifiant": identifiant, "projet": projet, "personnage": personnage, "revision": 1,
                     "cree_le": time.time(), "source": source, "grille": g, "corrections": {}, **regles}
            self._garder(objet)
        return self.lire(projet, identifiant)

    def regler(self, projet, identifiant, revision, brut, *, actualiser_source=False):
        entier(revision, "La révision attendue", 1, 1_000_000)
        if not isinstance(actualiser_source, bool): raise TuilesRefusees("L’actualisation de source doit être explicite.")
        with _verrou(self._racine(projet) / ".verrou"):
            ancienne = self._brut(projet, identifiant)
            if ancienne["revision"] != revision: raise TuilesRefusees("Cet ensemble a changé dans une autre fenêtre. Relisez-le avant de garder.")
            regles = choix(brut, ancienne["grille"])
            objet = {**ancienne, **regles, "revision": revision+1}
            dossier = self._dossier(projet, identifiant)
            if actualiser_source:
                octets, source = self._source(projet, ancienne["source"]["asset"])
                if source["dimensions"] != ancienne["source"]["dimensions"]:
                    raise TuilesRefusees("L’atlas a changé de dimensions. Créez un nouvel ensemble pour définir sa grille sans déplacer vos tuiles.")
                objet["source"] = {**source, "empreinte": self._blob(dossier, octets)}
            corrections = {}
            for c in regles["cellules"]:
                if not c["correction"]: continue
                cle = f"{c['x']},{c['y']}"
                connue = ancienne["corrections"].get(cle)
                if connue and connue["asset"] == c["correction"] and not actualiser_source:
                    corrections[cle] = connue
                    continue
                octets, source = self._source(projet, c["correction"])
                t = ancienne["grille"]["taille"]
                if source["dimensions"] != {"largeur": t, "hauteur": t}:
                    raise TuilesRefusees(f"La correction de {c['nom']} doit mesurer {t} × {t} pixels. Vérifiez son cadrage dans la retouche.")
                corrections[cle] = {**source, "empreinte": self._blob(dossier, octets)}
            objet["corrections"] = corrections
            self._garder(objet)
        return self.lire(projet, identifiant)

    def restaurer(self, projet, identifiant, revision, source_revision):
        entier(revision, "La révision attendue", 1, 1_000_000)
        with _verrou(self._racine(projet) / ".verrou"):
            actuelle = self._brut(projet, identifiant)
            if actuelle["revision"] != revision: raise TuilesRefusees("Cet ensemble a changé ; relisez-le avant de restaurer.")
            ancienne = self._brut(projet, identifiant, source_revision)
            objet = copy.deepcopy(ancienne)
            objet.update(revision=revision+1, restauree_de=source_revision)
            self._garder(objet)
        return self.lire(projet, identifiant)

    def _atlas(self, objet):
        image = Image.open(io.BytesIO(self._octets(objet, objet["source"]["empreinte"]))).convert("RGBA")
        g = objet["grille"]
        for cle, c in objet["corrections"].items():
            x, y = (int(n) for n in cle.split(","))
            correction = Image.open(io.BytesIO(self._octets(objet, c["empreinte"]))).convert("RGBA")
            image.paste(correction, (g["marge"]+x*(g["taille"]+g["espacement"]), g["marge"]+y*(g["taille"]+g["espacement"])))
        return image

    @staticmethod
    def _tuile(objet, atlas, x, y):
        g = objet["grille"]; t = g["taille"]
        ox, oy = g["marge"] + x*(t+g["espacement"]), g["marge"] + y*(t+g["espacement"])
        return atlas.crop((ox, oy, ox+t, oy+t))

    def apercu(self, projet, identifiant, *, revision=None, carte=False):
        objet = self._brut(projet, identifiant, revision)
        atlas = self._atlas(objet)
        if not carte: return png(atlas)
        g, m = objet["grille"], objet["carte"]
        rendu = Image.new("RGBA", (m["largeur"]*g["taille"], m["hauteur"]*g["taille"]))
        for c in m["cases"]:
            rendu.paste(self._tuile(objet, atlas, c["tuile_x"], c["tuile_y"]), (c["x"]*g["taille"], c["y"]*g["taille"]))
        return png(rendu)

    def extraire(self, projet, identifiant, x, y, revision):
        objet = self._brut(projet, identifiant, revision)
        if not any(c["x"] == x and c["y"] == y for c in objet["cellules"]): raise TuilesRefusees("Cette cellule n’existe pas.")
        octets = png(self._tuile(objet, self._atlas(objet), x, y))
        r = self.a.generations.importer(octets, f"{objet['nom']} · tuile {x+1},{y+1}", projet=projet, forcer=True,
                                       filiation={"tuiles": identifiant, "revision": revision, "x": x, "y": y, "source": objet["source"]["asset"]})
        return {"asset": r["asset"] or r["doublon"], "ensemble": identifiant, "revision": revision, "x": x, "y": y}

    def lire(self, projet, identifiant, revision=None):
        objet = self._brut(projet, identifiant, revision)
        retenues = {(c["x"], c["y"]) for c in objet["cellules"] if c["retenue"]}
        problemes = []
        if not retenues: problemes.append("Retenez les tuiles à livrer.")
        if not objet["carte"]["cases"]: problemes.append("Peignez une carte d’essai pour vérifier l’ensemble avant livraison.")
        if any((c["tuile_x"], c["tuile_y"]) not in retenues for c in objet["carte"]["cases"]): problemes.append("La carte utilise des tuiles qui ne sont pas encore retenues.")
        cellules = {(c["x"], c["y"]): c for c in objet["cellules"]}
        carte = {(c["x"], c["y"]): cellules[(c["tuile_x"], c["tuile_y"])] for c in objet["carte"]["cases"]}
        raccords = []
        # Ce diagnostic compare les terrains déclarés, jamais la qualité
        # esthétique des pixels : celle-ci se juge sur la carte réelle.
        for (x, y), c in carte.items():
            for dx, dy, a, b in [(1, 0, "est", "ouest"), (0, 1, "sud", "nord"), (1, 1, "sud-est", "nord-ouest"), (-1, 1, "sud-ouest", "nord-est")]:
                voisine = carte.get((x+dx, y+dy))
                if voisine and c["raccords"][a] != voisine["raccords"][b]:
                    raccords.append({"x": x, "y": y, "vers": a, "raison": "Les terrains déclarés sur ce raccord diffèrent."})
        if raccords: problemes.append(f"{len(raccords)} raccord(s) de terrain sont incompatibles dans la carte d’essai.")
        historique = sorted(int(p.stem) for p in (self._dossier(projet, identifiant)/"revisions").glob("*.json"))
        return {**objet, "historique": historique, "retenues": len(retenues), "diagnostic": {"pret": not problemes, "problemes": problemes, "raccords": raccords,
            "limite": "La cohérence des terrains est vérifiée. Jugez les bords, coins et la transparence sur la carte ; leur qualité graphique n’est pas validée automatiquement."},
            "atlas_url": f"/api/projects/{projet}/tilesets/{identifiant}/preview.png?revision={objet['revision']}",
            "carte_url": f"/api/projects/{projet}/tilesets/{identifiant}/preview.png?carte=true&revision={objet['revision']}"}

    def paquet(self, projet, identifiant, revision=None):
        from atelier.services.export_tuiles import paquet
        objet = self.lire(projet, identifiant, revision)
        if not objet["diagnostic"]["pret"]: raise TuilesRefusees(" ".join(objet["diagnostic"]["problemes"]))
        return paquet(objet, png(self._atlas(objet)))

    def prevoir_livraison(self, projet, identifiant, revision=None):
        association = self.a.livraison.association(projet)
        version = re.match(r"4\.(\d+)", (association or {}).get("version_godot", ""))
        if version and int(version[1]) < 3:
            raise TuilesRefusees("La carte utilise TileMapLayer, disponible à partir de Godot 4.3. Mettez le projet à jour avant de livrer cet ensemble.")
        manifeste, fichiers = self.paquet(projet, identifiant, revision)
        return self.a.livraison.preparer_paquet(projet, manifeste["personnage"], f"tuiles/{identifiant}", manifeste, fichiers,
                                               scene="carte.tscn", ressource="tuiles.tres")

    def archive(self, projet, identifiant, revision=None):
        _, fichiers = self.paquet(projet, identifiant, revision)
        sortie = io.BytesIO()
        with zipfile.ZipFile(sortie, "w", zipfile.ZIP_DEFLATED) as archive:
            for nom, octets in fichiers.items(): archive.writestr(nom, octets)
        return sortie.getvalue()
