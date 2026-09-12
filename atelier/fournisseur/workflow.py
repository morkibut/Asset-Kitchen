"""ComfyUI : transport Maison réutilisé, graphes fournis et versionnés.

Contrat relevé sur Comfy-Org/ComfyUI/server.py : object_info, queue,
prompt, history et view. Aucun appel d'installation ou de gestion des poids.
"""
from __future__ import annotations

import hashlib
import mimetypes

from atelier.domaine.workflow import WorkflowRefuse, composer
from atelier.fournisseur.maison import MoteurDeLaMaison, DELAI_MOYEN
from atelier.fournisseur.port import ClipProduit


class MoteurWorkflow(MoteurDeLaMaison):
    nom = "ComfyUI"

    async def diagnostiquer_profil(self, profil):
        problemes, noeuds = [], []
        try:
            info = await self._json("GET", "/object_info")
        except Exception as e:
            return {"disponible": False, "problemes": [str(e)], "noeuds": []}
        liees = {(l["noeud"], l["champ"]) for liens in profil["liaisons"].values() for l in liens}
        for identifiant, noeud in profil["graphe"].items():
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
                if champ not in noeud["inputs"]:
                    problemes.append(f"{classe} : le champ obligatoire {champ} manque.")
            for champ, valeur in noeud["inputs"].items():
                if champ not in champs:
                    problemes.append(f"{classe} : le champ {champ} n'est pas déclaré par cette installation.")
                    continue
                if (identifiant, champ) in liees:
                    continue
                declaration = champs[champ]
                if isinstance(declaration, list) and declaration and isinstance(declaration[0], list) and valeur not in declaration[0]:
                    problemes.append(f"{classe} / {champ} : {valeur} est absent des choix installés.")
            noeuds.append({"identifiant": identifiant, "classe": classe, "disponible": True})
        sortie = profil["sortie"]["noeud"]
        definition_sortie = info.get(profil["graphe"][sortie]["class_type"], {})
        if not definition_sortie.get("output_node"):
            problemes.append("Le nœud de sortie choisi n'est pas déclaré comme une sortie par ComfyUI.")
        return {"disponible": not problemes, "problemes": problemes, "noeuds": noeuds,
            "limite": "Le diagnostic vérifie les nœuds et choix installés. Il ne lance aucun modèle et ne prédit pas sa mémoire nécessaire."}

    async def deposer_reference(self, octets):
        nom = "atelier-" + hashlib.sha256(octets).hexdigest()[:24] + ".png"
        async with self._ouvrir(DELAI_MOYEN) as client:
            reponse = await client.post(self.adresse + "/upload/image",
                files={"image": (nom, octets, "image/png")}, data={"type": "input", "overwrite": "false"})
            reponse.raise_for_status()
            rendu = reponse.json()
        if not rendu.get("name"):
            raise WorkflowRefuse("ComfyUI n'a pas nommé la référence déposée.")
        return (str(rendu.get("subfolder") or "").rstrip("/") + "/" + str(rendu["name"])).lstrip("/")

    async def soumettre_graphe(self, profil, valeurs, references):
        diagnostic = await self.diagnostiquer_profil(profil)
        if not diagnostic["disponible"]:
            raise WorkflowRefuse(" · ".join(diagnostic["problemes"]))
        noms = [await self.deposer_reference(o) for o in references]
        graphe = composer(profil, references=noms, **valeurs)
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


class AnimateurWorkflow(MoteurWorkflow):
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
            proportions=demande.proportions, secondes=demande.secondes, options=demande.options)
        diagnostic = await self.diagnostiquer_profil(p)
        if not diagnostic["disponible"]:
            raise WorkflowRefuse(" · ".join(diagnostic["problemes"]))

    async def soumettre(self, modele, demande):
        p = self.profils.de_modele(modele.identifiant)
        numero = await self.soumettre_graphe(p, {"prompt": demande.texte, "resolution": demande.resolution,
            "proportions": demande.proportions, "secondes": demande.secondes, "options": dict(demande.options)}, [demande.image])
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
