"""ComfyUI : transport Maison réutilisé, graphes fournis et versionnés.

Contrat relevé sur Comfy-Org/ComfyUI/server.py : object_info, queue,
prompt, history et view. Aucun appel d'installation ou de gestion des poids.
"""
from __future__ import annotations

import hashlib
import io
import mimetypes
import time

from PIL import Image, UnidentifiedImageError

from atelier.domaine.workflow import IMAGE_DE_FIN, WorkflowRefuse, composer, graphes, octets_json, sans_image_de_fin
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


def _fin_libre(profil, info):
    """Le graphe tient-il **sans** son image de fin, selon ComfyUI ?

    `sans_image_de_fin` retire ce qui ne servait qu'à elle, et l'entrée qui la
    recevait parmi d'autres (`end_image` de `WanFirstLastFrameToVideo`). Si
    ComfyUI tient cette entrée pour obligatoire, le clip qui finit libre serait
    refusé à l'envoi : on le dit ici, avant tout choix (MO6, la limite de MO3)."""
    exigent = []
    for graphe, liaisons in graphes(profil):
        if IMAGE_DE_FIN not in liaisons:
            continue
        reste = sans_image_de_fin(graphe, liaisons, profil["sortie"]["noeud"])
        for cle, noeud in reste.items():
            requis = ((info.get(noeud["class_type"]) or {}).get("input") or {}).get("required") or {}
            for champ in requis:
                if champ in graphe[cle]["inputs"] and champ not in noeud["inputs"] \
                        and (noeud["class_type"], champ) not in exigent:
                    exigent.append((noeud["class_type"], champ))
    if not exigent:
        return {"fin_libre": True}
    quoi = " · ".join(f"« {classe} » exige « {champ} »" for classe, champ in exigent)
    return {"fin_libre": False, "remarques": [
        f"Sans image de fin, ComfyUI refuserait ce graphe : {quoi}. Ce workflow finit donc toujours sur une image choisie."]}


# `/object_info` retenu par adresse de ComfyUI (voir `MoteurWorkflow._object_info`).
# Deux minutes : assez pour une série, assez court pour qu'un nœud installé
# se voie vite — et un manque se revérifie toujours sur une copie fraîche.
DUREE_OBJECT_INFO_S = 600.0
_OBJECT_INFO: dict[str, tuple[float, dict]] = {}
# La table des types de fichiers se lit au premier `guess_type` — sous
# Windows, dans le registre : 1,4 s mesurées, sur la boucle, au premier son
# rendu (10 octobre 2026). Lue ici, au chargement de l'atelier.
mimetypes.init()


class MoteurWorkflow(MoteurDeLaMaison):
    nom = "ComfyUI"

    async def diagnostiquer_profil(self, profil, retenu_permis: bool = False):
        """Ce qui manque à ce profil pour tourner sur cette installation.

        `problemes` garde ses phrases d'avant (le grisé du catalogue les joint).
        **MO6 : `a_completer` dit la même chose par élément**, pour la page
        « Moteurs » : un nœud à installer, un fichier à poser, un champ que
        cette version de ComfyUI ne connaît plus, une sortie qui n'enregistre
        rien — chacun avec ce qu'il faut faire, jamais le seul « pas prêt ».
        Et pour un clip qui relie une image de fin, `fin_libre` dit si ComfyUI
        accepte le graphe **sans** elle — la limite que MO3 avait laissée."""
        try:
            info, retenu = await self._object_info(frais=not retenu_permis)
        except Exception as e:
            return {"disponible": False, "problemes": [str(e)], "noeuds": [],
                    "a_completer": [{"genre": "comfyui", "texte": "ComfyUI ne répond pas : lance-le, puis vérifie de nouveau."}]}
        diagnostic = self._diagnostiquer_avec(profil, info)
        if retenu and not diagnostic["disponible"]:
            # Un manque lu sur une copie retenue se vérifie sur une copie
            # fraîche : un nœud ou un fichier posé entre-temps se voit.
            try:
                info, _ = await self._object_info(frais=True)
            except Exception:  # noqa: BLE001 — la copie retenue a déjà répondu
                return diagnostic
            diagnostic = self._diagnostiquer_avec(profil, info)
        return diagnostic

    async def _object_info(self, frais: bool = False) -> tuple[dict, bool]:
        """`/object_info`, retenu `DUREE_OBJECT_INFO_S` par adresse de ComfyUI.

        Relevé du 10 octobre 2026 (Cœur de pierre) : 2 Mo, 3 s à lire, et lu
        **deux fois par son** (le diagnostic avant l'envoi, puis celui de
        `soumettre_graphe`) — 6 s de trou entre deux prises de 2 s de calcul.
        Rend `(info, retenu)` : `retenu` dit que la copie vient de la mémoire.
        Seul l'envoi d'un calcul accepte une copie retenue (`retenu_permis`) —
        ComfyUI revalide de toute façon le graphe à `/prompt` ; la page
        « Moteurs » et tout diagnostic demandé lisent une copie fraîche."""
        if not frais:
            garde = _OBJECT_INFO.get(self.adresse)
            if garde and time.monotonic() - garde[0] < DUREE_OBJECT_INFO_S:
                return garde[1], True
        info = await self._json("GET", "/object_info")
        if isinstance(info, dict):
            _OBJECT_INFO[self.adresse] = (time.monotonic(), info)
        return info, False

    def _diagnostiquer_avec(self, profil, info):
        problemes, noeuds, a_completer = [], [], []
        # Une même phrase ne se dit qu'une fois : deux nœuds de la même classe
        # à qui il manque la même chose ne font qu'une ligne, qui les nomme.
        par_texte = {}

        def signaler(identifiant, **element):
            if element["texte"] not in par_texte:
                par_texte[element["texte"]] = {**element, "noeuds": []}
                a_completer.append(par_texte[element["texte"]])
            if identifiant not in par_texte[element["texte"]]["noeuds"]:
                par_texte[element["texte"]]["noeuds"].append(identifiant)
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
                signaler(identifiant, genre="noeud", classe=classe,
                    texte=f"Le nœud « {classe} » n'est pas installé dans ComfyUI : installe l'extension qui le fournit, puis redémarre ComfyUI.")
                continue
            if definition.get("api_node"):
                problemes.append(f"{classe} appelle une API distante ; ce profil est réservé au calcul local.")
                signaler(identifiant, genre="api", classe=classe,
                    texte=f"« {classe} » appelle un service en ligne : un workflow importé ne tourne que sur cette machine.")
            entree = definition.get("input", {})
            champs = {**entree.get("required", {}), **entree.get("optional", {})}
            for champ in entree.get("required", {}):
                if champ not in noeud["inputs"] and not _groupe_facultatif(champs[champ], champ, noeud["inputs"]):
                    problemes.append(f"{classe} : le champ obligatoire {champ} manque.")
                    signaler(identifiant, genre="champ", classe=classe, champ=champ,
                        texte=f"« {classe} » attend le champ « {champ} », absent du graphe : réexporte le graphe depuis cette version de ComfyUI.")
            for champ, valeur in noeud["inputs"].items():
                if champ not in champs and not _membre_de_groupe(champ, champs):
                    problemes.append(f"{classe} : le champ {champ} n'est pas déclaré par cette installation.")
                    signaler(identifiant, genre="champ", classe=classe, champ=champ,
                        texte=f"« {classe} » ne connaît pas de champ « {champ} » dans cette version de ComfyUI : réexporte le graphe depuis elle.")
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
                    signaler(identifiant, genre="fichier", classe=classe, champ=champ, fichier=valeur,
                        texte=f"Le fichier « {valeur} » n'est pas dans ComfyUI (champ « {champ} » de « {classe} ») : pose-le dans le dossier de modèles qui convient, puis vérifie de nouveau.")
            noeuds.append({"identifiant": identifiant, "classe": classe, "disponible": True})
        sortie = profil["sortie"]["noeud"]
        if any(not info.get(g[sortie]["class_type"], {}).get("output_node") for g, _ in graphes(profil)):
            problemes.append("Le nœud de sortie choisi n'est pas déclaré comme une sortie par ComfyUI.")
            signaler(sortie, genre="sortie",
                texte="Le nœud de sortie choisi n'enregistre rien selon ComfyUI : importe une nouvelle version avec le nœud qui enregistre le résultat.")
        diagnostic = {"disponible": not problemes, "problemes": problemes, "noeuds": noeuds, "a_completer": a_completer,
            "limite": "Le diagnostic vérifie les nœuds et choix installés. Il ne lance aucun modèle et ne prédit pas sa mémoire nécessaire."}
        if any(IMAGE_DE_FIN in liaisons for _, liaisons in graphes(profil)):
            diagnostic.update(_fin_libre(profil, info))
        return diagnostic

    async def deposer_reference(self, octets):
        octets = sur_fond_blanc(octets)
        return await self._deposer(octets, "atelier-" + hashlib.sha256(octets).hexdigest()[:24] + ".png")

    async def deposer_masque(self, octets):
        """La zone peinte (PX2) part **telle qu'elle est partie** : jamais par
        `sur_fond_blanc`, qui n'a rien à y faire, et sous un nom à elle — un
        masque et une image aux mêmes octets ne se confondent pas chez ComfyUI."""
        return await self._deposer(octets, "atelier-masque-" + hashlib.sha256(octets).hexdigest()[:24] + ".png")

    async def deposer_son(self, octets, nom="son.wav"):
        """Le son de départ d'une reprise : déposé tel quel dans le dossier
        d'entrée de ComfyUI, où `LoadAudio` le lit. La route s'appelle
        `/upload/image` mais range n'importe quel fichier — c'est elle que
        l'écran de ComfyUI emploie pour charger un son. Le nom suit les octets :
        deux reprises du même son ne le déposent qu'une fois."""
        extension = ("." + nom.rsplit(".", 1)[-1].lower()) if "." in nom else ".wav"
        if extension not in (".wav", ".flac", ".ogg", ".mp3"):
            extension = ".wav"
        media = {".wav": "audio/wav", ".flac": "audio/flac", ".ogg": "audio/ogg", ".mp3": "audio/mpeg"}[extension]
        return await self._deposer(octets, "atelier-son-" + hashlib.sha256(octets).hexdigest()[:24] + extension, media)

    async def _deposer(self, octets, nom, media="image/png"):
        async with self._ouvrir(DELAI_MOYEN) as client:
            reponse = await client.post(self.adresse + "/upload/image",
                files={"image": (nom, octets, media)}, data={"type": "input", "overwrite": "false"})
            reponse.raise_for_status()
            rendu = reponse.json()
        if not rendu.get("name"):
            raise WorkflowRefuse("ComfyUI n'a pas nommé la référence déposée.")
        return (str(rendu.get("subfolder") or "").rstrip("/") + "/" + str(rendu["name"])).lstrip("/")

    async def soumettre_graphe(self, profil, valeurs, references, masque=None, fin=None, son=None):
        """`son` : les octets du son de départ d'une reprise, déposés ici,
        au dernier moment, comme les références d'une image."""
        diagnostic = await self.diagnostiquer_profil(profil, retenu_permis=True)
        if not diagnostic["disponible"]:
            raise WorkflowRefuse(" · ".join(diagnostic["problemes"]))
        noms = [await self.deposer_reference(o) for o in references]
        zone = {} if masque is None else {"masque": await self.deposer_masque(masque)}
        if son is not None:
            zone["source"] = await self.deposer_son(son)
        # MO3 : l'image de fin d'un clip part comme l'image de départ (même
        # passage sur blanc). Une boucle finit sur les octets mêmes du départ :
        # déjà déposés, on ne les redépose pas — la règle du moteur de la maison.
        if fin is not None:
            zone["image_de_fin"] = noms[0] if references and fin == references[0] else await self.deposer_reference(fin)
        graphe = composer(profil, references=noms, **zone, **valeurs)
        try:
            rendu = await self._json("POST", "/prompt", {"prompt": graphe, "client_id": self._client_id,
                "extra_data": {"asset_kitchen": {"profil": profil["identifiant"], "version": profil["version"]}}})
        except Exception:
            # Refusé (un nœud qui manque) ou injoignable (ComfyUI redémarre) :
            # la copie retenue de `/object_info` ne vaut plus rien.
            _OBJECT_INFO.pop(self.adresse, None)
            raise
        numero = rendu.get("prompt_id")
        if not numero:
            _OBJECT_INFO.pop(self.adresse, None)
            raise WorkflowRefuse("ComfyUI n'a pas rendu l'identifiant de ce calcul.")
        return str(numero)

    async def etat(self, travail):
        etat = await super().etat(travail)
        if etat.perdu:
            # Un travail oublié : ComfyUI a redémarré, ses nœuds ont pu changer.
            _OBJECT_INFO.pop(self.adresse, None)
        return etat

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
                # MO6 : et s'il ne sait finir **que** là — ComfyUI tient l'entrée
                # pour obligatoire (`_fin_libre`) —, un clip sans fin se grise.
                exige_une_image_de_fin=diagnostic.get("fin_libre") is False,
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
