"""Sources et rendus 3D copiés, ouvrables même moteur éteint.

Le rendu transparent est une séquence native de PNG. Aucun passage par une
vidéo compressée ne change son alpha, ses frames ou son repère commun.
"""
from __future__ import annotations

import hashlib
import io
import json
import time
from pathlib import Path
from PIL import Image

from atelier.depot.verrou import verrou
from atelier.domaine.animation import Clip
from atelier.domaine.bande import Cadre
from atelier.domaine.generation import Generation, Emplacement, Statut
from atelier.domaine.recette import Recette
from atelier.fournisseur.asset3d import AdaptateurAsset3D, Source3DRefusee, adresse_locale, identifiant_externe, verifier_glb


def empreinte(octets: bytes) -> str:
    return hashlib.sha256(octets).hexdigest()


class ServiceSources3D:
    def __init__(self, atelier, *, transport=None):
        self.atelier, self.transport = atelier, transport
        self.racine = atelier.fichiers.racine / "sources-3d"

    def _sauver_json(self, chemin: Path, objet: dict):
        self.atelier.fichiers._poser(chemin, json.dumps(objet, ensure_ascii=False, sort_keys=True, allow_nan=False).encode())

    def connexion(self) -> dict:
        p = self.racine / "connexion.json"
        return json.loads(p.read_text(encoding="utf-8")) if p.exists() else {"adresse": "", "nom": "asset3d", "configure": False}

    def configurer(self, adresse: str) -> dict:
        c = {"adresse": adresse_locale(adresse), "nom": "asset3d", "configure": True}
        self._sauver_json(self.racine / "connexion.json", c)
        return c

    def moteur(self) -> AdaptateurAsset3D:
        c = self.connexion()
        if not c["adresse"]: raise Source3DRefusee("Associez d’abord l’adresse du serveur asset3d. Aucune installation ne sera lancée.")
        return AdaptateurAsset3D(c["adresse"], self.transport)

    def _dossier(self, projet: str, source: str | None = None) -> Path:
        if not any(p.identifiant == projet for p in self.atelier.bibliotheque.projets()):
            raise Source3DRefusee("Ce jeu n’existe pas dans l’atelier.")
        if source is not None and (len(source) != 32 or any(c not in "0123456789abcdef" for c in source)):
            raise Source3DRefusee("Cette source 3D n’existe pas.")
        return self.racine / projet / source if source else self.racine / projet

    def lister(self, projet: str, personnage: str | None = None) -> list[dict]:
        sources = [json.loads(p.read_text(encoding="utf-8")) for p in self._dossier(projet).glob("*/source.json")]
        return sorted([s for s in sources if not personnage or s["personnage"] == personnage], key=lambda s: s["cree_le"], reverse=True)

    def lire(self, projet: str, source: str) -> dict:
        p = self._dossier(projet, source) / "source.json"
        if not p.exists(): raise Source3DRefusee("Cette source 3D n’a pas été importée dans ce jeu.")
        return json.loads(p.read_text(encoding="utf-8"))

    def fichier(self, projet: str, source: str, nom: str) -> Path:
        s = self.lire(projet, source)
        if nom not in s["fichiers"]: raise Source3DRefusee("Ce fichier n’appartient pas à cette source 3D.")
        p = self._dossier(projet, source) / nom
        if not p.is_file() or empreinte(p.read_bytes()) != s["fichiers"][nom]:
            raise Source3DRefusee("Cette copie locale a été modifiée ou manque. La source n’est pas remplacée implicitement.")
        return p

    async def importer(self, projet: str, corps: dict, *, acteur="auteur", _moteur=None) -> dict:
        self._dossier(projet)
        personnage = corps.get("personnage") or None
        pose, direction = corps.get("pose") or None, corps.get("direction") or None
        self.atelier.montage._verifier_destination(projet, personnage, pose, direction)
        externe = identifiant_externe(str(corps.get("personnage_externe", "")))
        rendu_id = identifiant_externe(str(corps.get("rendu", "")))
        cadence = float(corps.get("cadence", 8))
        if not 0 < cadence <= 120: raise Source3DRefusee("La cadence doit être comprise entre 0 et 120 images par seconde.")
        moteur = _moteur or self.moteur()
        rendu = await moteur.rendu(externe, rendu_id)
        adresses = rendu["images"]
        if len(adresses) > 240: raise Source3DRefusee("Importez au plus 240 frames dans une même animation.")
        donnees, dimensions = {}, None
        for rang, chemin in enumerate(adresses):
            # Le contrat garde l’ordre exact. Même un lien d’une autre API du
            # moteur n’est pas suivi en tant qu’image de ce rendu.
            if chemin != f"/api/essais/{rendu_id}/images/{rang}.png":
                raise Source3DRefusee("La liste des frames ne correspond pas au rendu demandé.")
            reponse = await moteur.demander(chemin)
            try:
                with Image.open(io.BytesIO(reponse.content)) as image:
                    if image.format != "PNG" or image.width * image.height > 16_777_216: raise ValueError()
                    image.load()
                    taille = image.size
            except (OSError, ValueError) as e: raise Source3DRefusee("Une frame 3D n’est pas un PNG lisible.") from e
            if dimensions is not None and taille != dimensions:
                raise Source3DRefusee("Les frames n’ont pas le même cadre. Le rendu doit conserver une fenêtre commune.")
            dimensions = taille
            donnees[f"frame-{rang:04d}.png"] = reponse.content
        for nom in ("modele.glb", "rig.glb"):
            r = await moteur.demander(f"/api/essais/{rendu_id}/{nom}", facultatif=True)
            if r is not None:
                verifier_glb(r.content)
                donnees[nom] = r.content
        fichiers = {n: empreinte(o) for n, o in donnees.items()}
        provenance = {"adresse": moteur.adresse, "personnage": externe, "rendu": rendu_id, "reglages": rendu.get("reglages", {}), "fichiers": fichiers, "rig_origine": "etat_du_personnage_a_l_import" if "rig.glb" in fichiers else None}
        for cle in ("camera", "plage", "cadre", "corrections", "corrections_historiques"):
            if rendu.get(cle) is not None: provenance[cle] = rendu[cle]
        if rendu.get("corrections_historiques") and "rig.glb" in fichiers:
            provenance["rig_origine"] = "copie_du_travail"
        # Le cadre (dimensions du canevas) d'un mouvement doit rester le même
        # d'une direction à l'autre : c'est ce qui permet de les assembler
        # dans la même planche sans qu'une direction paraisse plus grande ou
        # décalée. asset3d ne renvoie pas l'échelle de caméra ni le pivot par
        # son contrat HTTP ; seules les dimensions mesurées peuvent donc être
        # comparées ici, sans GPU.
        animation = provenance["reglages"].get("animation")
        if direction:
            for autre in self.lister(projet):
                p = autre.get("provenance", {})
                if (p.get("personnage") == externe and p.get("reglages", {}).get("animation") == animation
                        and autre.get("direction") and autre["direction"] != direction
                        and (autre["largeur"], autre["hauteur"]) != dimensions):
                    raise Source3DRefusee(
                        f"La direction « {direction} » mesure {dimensions[0]}×{dimensions[1]} px, alors que "
                        f"« {autre['direction']} » du même modèle et du même mouvement mesure "
                        f"{autre['largeur']}×{autre['hauteur']} px. Les directions d’un même mouvement doivent "
                        "garder un cadre commun ; reprenez cette direction avec les mêmes réglages avant de l’importer.")
        source_id = empreinte(json.dumps({"projet": projet, "provenance": provenance, "personnage": personnage, "pose": pose, "direction": direction, "cadence": cadence}, sort_keys=True).encode())[:32]
        dossier = self._dossier(projet, source_id)
        with verrou(self.racine / ".import"):
            if (dossier / "source.json").exists(): return self.lire(projet, source_id)
            for nom, octets in donnees.items(): self.atelier.fichiers._poser(dossier / nom, octets)
            source = {"identifiant": source_id, "projet": projet, "personnage": personnage, "pose": pose, "direction": direction, "nom": str(corps.get("nom") or f"{rendu.get('reglages', {}).get('animation', 'Rendu 3D')} · {direction or 'vue libre'}"), "origine": "asset3d", "provenance": provenance, "rendu": rendu, "fichiers": fichiers, "images": len(adresses), "largeur": dimensions[0], "hauteur": dimensions[1], "cadence": cadence, "cree_le": time.time(), "bandes": []}
            # Une séquence réutilise le montage des frames, sans feindre un
            # fichier vidéo. Sa nature est persistée sur la source du montage.
            generation_id = "3d-" + source_id
            generation = Generation(identifiant=generation_id, modele="asset3d:" + str(rendu.get("reglages", {}).get("moteur_3d", "rendu")), demande={"prompt": source["nom"], "source3d": provenance}, parametres_resolus=rendu.get("reglages", {}), projet=projet, personnage=personnage, pose=pose, direction=direction, provenance=acteur, emplacements=[Emplacement(rang=0, statut=Statut.REUSSIE, unite="secondes")], clip=Clip(images=len(adresses), cadence=cadence, secondes=max(1, round(len(adresses)/cadence)), prix_annonce=0, prix_formule="Import d’un rendu existant · aucun calcul", nature="rendu3d"))
            d = self.atelier.fichiers.dossier_images_clip(generation_id, 0)
            for rang in range(len(adresses)): self.atelier.fichiers._poser(d / f"{rang:04d}.png", donnees[f"frame-{rang:04d}.png"])
            self.atelier.fichiers.ecrire_enregistrement(generation_id, generation.en_json())
            self.atelier.base.enregistrer(generation)
            bande = self.atelier.montage.garder(generation_id, source["nom"], list(range(len(adresses))), cadence=cadence, sens=str(corps.get("sens") or "boucle"), cadre=Cadre(choix="main", gauche=0, sommet=0, droite=dimensions[0]-1, bas=dimensions[1]-1), recette=Recette(), personnage=personnage or "", pose=pose, direction=direction, identifiant_bande=source_id[:12])
            source["bandes"] = [bande.identifiant]
            self._sauver_json(dossier / "source.json", source)
            self.atelier.diffusion.publier("source3d", {"identifiant": source_id, "projet": projet})
            return source
