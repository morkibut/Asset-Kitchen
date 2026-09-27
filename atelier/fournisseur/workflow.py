"""ComfyUI : transport Maison réutilisé, graphes fournis et versionnés.

Contrat relevé sur Comfy-Org/ComfyUI/server.py : object_info, queue,
prompt, history et view. Aucun appel d'installation ou de gestion des poids.
"""
from __future__ import annotations

import hashlib
import io
import mimetypes

from PIL import Image, UnidentifiedImageError

from atelier.domaine.workflow import IMAGE_DE_FIN, WorkflowRefuse, composer, graphes, octets_json
from atelier.fournisseur.maison import MoteurDeLaMaison, DELAI_MOYEN
from atelier.fournisseur.port import ClipProduit


def sur_fond_blanc(octets):
    """Le LoadImage de ComfyUI jette la transparence : ce qui était transparent
    deviendrait la couleur cachée sous l'alpha, souvent du noir. On pose l'image
    sur du blanc avant l'envoi ; l'atelier garde ses octets d'origine.

    **Un filet, depuis la relecture ML (défaut 8)** : l'image d'un style de
    sc-clone arrive déjà posée sur le fond du jeu (`_fond_des_references`) et
    repart telle quelle d'ici. Seul un workflow importé à la main l'envoie
    encore transparente, et c'est lui qui passe sur blanc."""
    try:
        with Image.open(io.BytesIO(octets)) as image:
            if image.mode not in ("RGBA", "LA", "PA") and "transparency" not in image.info:
                return octets
            rgba = image.convert("RGBA")
    except (UnidentifiedImageError, OSError):
        return octets
    if rgba.getchannel("A").getextrema()[0] == 255:
        return octets
    fond = Image.new("RGBA", rgba.size, (255, 255, 255, 255))
    sortie = io.BytesIO()
    Image.alpha_composite(fond, rgba).convert("RGB").save(sortie, format="PNG")
    return sortie.getvalue()


def verifier_masque(octets, reference=None):
    """La zone à repeindre (PX2) : un PNG en niveaux de gris — blanc = repeindre,
    noir = garder —, de la taille de la première référence. Refusé en clair
    avant la file, jamais corrigé en silence : un masque redimensionné ou
    converti ici ne serait plus celui que l'auteur a peint."""
    try:
        with Image.open(io.BytesIO(octets)) as image:
            forme, mode, taille = image.format, image.mode, image.size
    except (UnidentifiedImageError, OSError) as e:
        raise WorkflowRefuse("Le masque de la zone n'est pas une image lisible.") from e
    if forme != "PNG" or mode != "L":
        raise WorkflowRefuse("Le masque de la zone est un PNG en niveaux de gris : blanc pour repeindre, noir pour garder.")
    if reference is None:
        raise WorkflowRefuse("Une zone se peint sur une image : joindre l'image à retoucher.")
    try:
        with Image.open(io.BytesIO(reference)) as image:
            attendue = image.size
    except (UnidentifiedImageError, OSError):
        return
    if taille != attendue:
        raise WorkflowRefuse(f"Le masque mesure {taille[0]} × {taille[1]} ; l'image à retoucher, {attendue[0]} × {attendue[1]}.")


# **Les entrées « qui poussent »** (`io.Autogrow` de ComfyUI récent) : /object_info
# déclare un seul champ, `images: ["COMFY_AUTOGROW_V3", {"template": …}]`, rangé
# parmi les obligatoires même quand il en faut zéro (`min: 0`) ; le graphe, lui,
# relie `images.image_1`, `images.image_2`… Relevé le 22/09/2026 sur
# `TextEncodeQwenImage21` (ComfyUI 0.37) et `TextEncodeBooguEdit` (0.36).
_GROUPE = "COMFY_AUTOGROW_V3"


def _gabarit_de_groupe(declaration):
    if isinstance(declaration, list) and len(declaration) > 1 and declaration[0] == _GROUPE \
            and isinstance(declaration[1], dict):
        return declaration[1].get("template") or {}
    return None


def _groupe_facultatif(declaration, champ, entrees):
    gabarit = _gabarit_de_groupe(declaration)
    if gabarit is None:
        return False
    presents = sum(1 for c in entrees if c.startswith(champ + "."))
    return presents >= (gabarit.get("min") or 0)


def _membre_de_groupe(champ, champs):
    groupe, _, membre = champ.partition(".")
    gabarit = _gabarit_de_groupe(champs.get(groupe)) if membre else None
    if gabarit is None:
        return False
    if gabarit.get("names"):
        return membre in gabarit["names"]
    prefixe = gabarit.get("prefix")
    return bool(prefixe) and membre.startswith(prefixe) and membre[len(prefixe):].isdigit()


class MoteurWorkflow(MoteurDeLaMaison):
    nom = "ComfyUI"

    async def diagnostiquer_profil(self, profil):
        problemes, noeuds = [], []
        try:
            info = await self._json("GET", "/object_info")
        except Exception as e:
            return {"disponible": False, "problemes": [str(e)], "noeuds": []}
        # Un profil à variantes n'est prêt que si chacun de ses graphes l'est ;
        # un nœud identique d'un graphe à l'autre n'est examiné qu'une fois.
        examines = {}
        for graphe, liaisons in graphes(profil):
            liees = {(l["noeud"], l["champ"]) for liens in liaisons.values() for l in liens}
            for i, n in graphe.items():
                examines.setdefault((i, octets_json(n)), (i, n, liees))
        for identifiant, noeud, liees in examines.values():
            classe = noeud["class_type"]
            definition = info.get(classe)
            if not definition:
                problemes.append(f"Nœud absent : {classe} ({identifiant}).")
                continue
            if definition.get("api_node"):
                problemes.append(f"{classe} appelle une API distante ; ce profil est réservé au calcul local.")
            entree = definition.get("input", {})
            champs = {**entree.get("required", {}), **entree.get("optional", {})}
            for champ in entree.get("required", {}):
                if champ not in noeud["inputs"] and not _groupe_facultatif(champs[champ], champ, noeud["inputs"]):
                    problemes.append(f"{classe} : le champ obligatoire {champ} manque.")
            for champ, valeur in noeud["inputs"].items():
                if champ not in champs and not _membre_de_groupe(champ, champs):
                    problemes.append(f"{classe} : le champ {champ} n'est pas déclaré par cette installation.")
                    continue
                if (identifiant, champ) in liees:
                    continue
                declaration = champs.get(champ)
                # Deux formes de liste de choix : `[[…], {…}]`, et `["COMBO",
                # {"options": […]}]` que ComfyUI récent emploie déjà.
                choix = None
                if isinstance(declaration, list) and declaration:
                    if isinstance(declaration[0], list):
                        choix = declaration[0]
                    elif declaration[0] == "COMBO" and len(declaration) > 1 and isinstance(declaration[1], dict):
                        choix = declaration[1].get("options")
                if isinstance(choix, list) and valeur not in choix:
                    problemes.append(f"{classe} / {champ} : {valeur} est absent des choix installés.")
            noeuds.append({"identifiant": identifiant, "classe": classe, "disponible": True})
        sortie = profil["sortie"]["noeud"]
        if any(not info.get(g[sortie]["class_type"], {}).get("output_node") for g, _ in graphes(profil)):
            problemes.append("Le nœud de sortie choisi n'est pas déclaré comme une sortie par ComfyUI.")
        return {"disponible": not problemes, "problemes": problemes, "noeuds": noeuds,
            "limite": "Le diagnostic vérifie les nœuds et choix installés. Il ne lance aucun modèle et ne prédit pas sa mémoire nécessaire."}

    async def deposer_reference(self, octets):
        octets = sur_fond_blanc(octets)
        return await self._deposer(octets, "atelier-" + hashlib.sha256(octets).hexdigest()[:24] + ".png")

    async def deposer_masque(self, octets):
        """La zone peinte (PX2) part **telle qu'elle est partie** : jamais par
        `sur_fond_blanc`, qui n'a rien à y faire, et sous un nom à elle — un
        masque et une image aux mêmes octets ne se confondent pas chez ComfyUI."""
        return await self._deposer(octets, "atelier-masque-" + hashlib.sha256(octets).hexdigest()[:24] + ".png")

    async def _deposer(self, octets, nom):
        async with self._ouvrir(DELAI_MOYEN) as client:
            reponse = await client.post(self.adresse + "/upload/image",
                files={"image": (nom, octets, "image/png")}, data={"type": "input", "overwrite": "false"})
            reponse.raise_for_status()
            rendu = reponse.json()
        if not rendu.get("name"):
            raise WorkflowRefuse("ComfyUI n'a pas nommé la référence déposée.")
        return (str(rendu.get("subfolder") or "").rstrip("/") + "/" + str(rendu["name"])).lstrip("/")

    async def soumettre_graphe(self, profil, valeurs, references, masque=None, fin=None):
        diagnostic = await self.diagnostiquer_profil(profil)
        if not diagnostic["disponible"]:
            raise WorkflowRefuse(" · ".join(diagnostic["problemes"]))
        noms = [await self.deposer_reference(o) for o in references]
        zone = {} if masque is None else {"masque": await self.deposer_masque(masque)}
        # MO3 : l'image de fin d'un clip part comme l'image de départ (même
        # passage sur blanc). Une boucle finit sur les octets mêmes du départ :
        # déjà déposés, on ne les redépose pas — la règle du moteur de la maison.
        if fin is not None:
            zone["image_de_fin"] = noms[0] if references and fin == references[0] else await self.deposer_reference(fin)
        graphe = composer(profil, references=noms, **zone, **valeurs)
        rendu = await self._json("POST", "/prompt", {"prompt": graphe, "client_id": self._client_id,
            "extra_data": {"asset_kitchen": {"profil": profil["identifiant"], "version": profil["version"]}}})
        numero = rendu.get("prompt_id")
        if not numero:
            raise WorkflowRefuse("ComfyUI n'a pas rendu l'identifiant de ce calcul.")
        return str(numero)

    async def sortie_de(self, travail, profil):
        histoire = await self._json("GET", "/history/" + travail)
        entree = histoire.get(travail)
        if not entree:
            raise WorkflowRefuse("ComfyUI ne conserve plus l'historique de ce calcul. Aucun nouvel envoi automatique.")
        sortie = profil["sortie"]
        sorties = entree.get("outputs", {}).get(sortie["noeud"], {}).get(sortie["champ"], [])
        if not isinstance(sorties, list) or len(sorties) != 1 or not isinstance(sorties[0], dict) or not sorties[0].get("filename"):
            raise WorkflowRefuse("Le workflow n'a pas rendu le fichier unique déclaré dans son profil.")
        reference = sorties[0]
        octets = await self._telecharger_sortie(reference)
        type_media = mimetypes.guess_type(str(reference["filename"]))[0]
        return octets, type_media, reference

    async def texte_de(self, travail, profil):
        """Le texte d'un nœud d'aperçu (`PreviewAny` : la partition ABC de
        YuE2, SN9), lu dans `/history` comme `sortie_de` lit un fichier, mais
        sans rien télécharger — ce nœud ne rend qu'une chaîne, jamais un
        fichier nommé."""
        histoire = await self._json("GET", "/history/" + travail)
        entree = histoire.get(travail)
        if not entree:
            raise WorkflowRefuse("ComfyUI ne conserve plus l'historique de ce calcul. Aucun nouvel envoi automatique.")
        sortie = profil["sortie"]
        valeurs = entree.get("outputs", {}).get(sortie["noeud"], {}).get(sortie["champ"], [])
        if not isinstance(valeurs, list) or len(valeurs) != 1 or not isinstance(valeurs[0], str) or not valeurs[0].strip():
            raise WorkflowRefuse("Le workflow n'a pas rendu le texte unique déclaré dans son profil.")
        return valeurs[0]


class AnimateurWorkflow(MoteurWorkflow):
    # MO3 : d'où vient un modèle vidéo, pour le catalogue commun — un workflow
    # importé par l'auteur, à côté de la maison (Wan) et d'un fournisseur en ligne.
    source = "workflow"

    def __init__(self, profils, fichiers, base=None, transport=None):
        super().__init__(base, transport)
        self.profils, self.fichiers = profils, fichiers

    async def catalogue_video(self):
        from atelier.domaine.animation import ModeleVideo, Tarification
        from atelier.domaine.catalogue import Option
        modeles = []
        for p in self.profils.lister():
            if p["nature"] != "video":
                continue
            diagnostic = await self.diagnostiquer_profil(p)
            modeles.append(ModeleVideo(p["modele"], p["nom"], fournisseur=self.nom,
                chez_lui=p["modele"].split(":", 1)[1], durees=tuple(p["durees"]),
                resolutions=tuple(dict.fromkeys(f["resolution"] for f in p["formats"])),
                proportions=tuple(dict.fromkeys(f["proportions"] for f in p["formats"])),
                # MO3 : sait-il finir sur une image choisie ? Son graphe le dit,
                # par la liaison qui charge l'image de fin — jamais supposé.
                accepte_une_image_de_fin=IMAGE_DE_FIN in p["liaisons"],
                tarification=Tarification("maison", 0, "Gratuit — workflow local"),
                images_par_seconde=p["cadence"], pas_d_images=p["pas_images"],
                options={n: Option(n, o["genre"], tuple(o.get("valeurs", [])), o.get("minimum"), o.get("maximum")) for n, o in p["parametres"].items()},
                indisponible=" · ".join(diagnostic["problemes"]) or None))
        return modeles

    def indisponible(self):
        return None  # chaque profil porte son propre diagnostic

    async def verifier_preparation(self, modele, demande):
        p = self.profils.de_modele(modele.identifiant)
        composer(p, prompt=demande.texte, references=["reference"], resolution=demande.resolution,
            proportions=demande.proportions, secondes=demande.secondes, options=demande.options,
            image_de_fin="fin" if demande.image_de_fin else None)
        diagnostic = await self.diagnostiquer_profil(p)
        if not diagnostic["disponible"]:
            raise WorkflowRefuse(" · ".join(diagnostic["problemes"]))

    async def soumettre(self, modele, demande):
        p = self.profils.de_modele(modele.identifiant)
        numero = await self.soumettre_graphe(p, {"prompt": demande.texte, "resolution": demande.resolution,
            "proportions": demande.proportions, "secondes": demande.secondes, "options": dict(demande.options)}, [demande.image],
            fin=demande.image_de_fin or None)
        # Le port de récupération ne reçoit que le numéro externe. Ce lien
        # durable retrouve la version de sortie après un redémarrage.
        from atelier.domaine.workflow import octets_json
        self.fichiers._poser(self.fichiers.racine / "workflows-externes" / (hashlib.sha256(numero.encode()).hexdigest() + ".json"),
            octets_json({"travail": numero, "modele": modele.identifiant, "adresse": self.adresse}))
        return numero

    async def recuperer(self, travail):
        import json
        chemin = self.fichiers.racine / "workflows-externes" / (hashlib.sha256(travail.encode()).hexdigest() + ".json")
        try:
            lien = json.loads(chemin.read_text(encoding="utf-8"))
        except (OSError, ValueError) as e:
            raise WorkflowRefuse("Le profil de ce clip n'a pas pu être retrouvé ; aucun nouvel appel.") from e
        if lien["adresse"] != self.adresse:
            raise WorkflowRefuse("L'adresse du moteur de ce clip a changé.")
        p = self.profils.de_modele(lien["modele"])
        octets, type_media, _ = await self.sortie_de(travail, p)
        return ClipProduit(octets, 0, type_media=type_media, travail=travail)
