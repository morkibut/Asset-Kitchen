"""Le port image synchrone attend une étape ComfyUI durable et récupérable."""
from __future__ import annotations

import asyncio
import hashlib
import io
import time
import zipfile

from atelier.domaine.catalogue import Modele, Option
from atelier.domaine.workflow import WorkflowRefuse, composer, normaliser, tirer_graine
from atelier.fournisseur.port import ImageProduite
from atelier.services.file_locale import AcceptationLocaleInconnue, SuiviLocalInterrompu


class FournisseurWorkflowImage:
    nom = "ComfyUI"
    locale = True

    def __init__(self, profils, file_locale, fabrique_moteur):
        self.profils, self.file_locale, self.fabrique_moteur = profils, file_locale, fabrique_moteur
        self.avant_soumission = None
        self.intervalle = 2.0
        self.delai = 1800.0
        file_locale.inscrire_executeur("image", self._executer)

    def indisponible(self):
        return None

    def compte(self):
        return None

    def secrets(self):
        return ()

    async def catalogue(self):
        moteur = self.fabrique_moteur()
        modeles = []
        for p in self.profils.lister():
            if p["nature"] != "image":
                continue
            diagnostic = await moteur.diagnostiquer_profil(p)
            modeles.append(Modele(p["modele"], p["nom"], fournisseur=self.nom,
                chez_lui=p["modele"].split(":", 1)[1], references_min=p["references_min"], references_max=p["references_max"],
                proportions=tuple(dict.fromkeys(f["proportions"] for f in p["formats"])),
                resolutions=tuple(dict.fromkeys(f["resolution"] for f in p["formats"])), locale=True,
                options={n: Option(n, o["genre"], tuple(o.get("valeurs", [])), o.get("minimum"), o.get("maximum")) for n, o in p["parametres"].items()},
                indisponible=" · ".join(diagnostic["problemes"]) or None,
                reference=(p.get("style") or {}).get("reference"),
                negatif_lu="prompt_negatif" in p["liaisons"],
                famille=(p.get("style") or {}).get("famille")))
        return modeles

    async def generer(self, modele, demande):
        raise WorkflowRefuse("Un workflow local doit être lancé par une génération suivie de l'atelier.")

    def etape(self, generation, rang=0):
        return self.file_locale.trouver(f"image:{generation}:{rang}")

    def _inscrire_moteur(self):
        moteur = self.fabrique_moteur()
        identifiant = moteur.nom + "@" + moteur.adresse
        self.file_locale.inscrire_moteur(identifiant, moteur.nom, moteur.observer_ressource)
        return identifiant

    async def generer_suivi(self, modele, demande, generation, rang):
        p = self.profils.de_modele(modele.identifiant)
        valeurs = {"prompt": demande.prompt, "prompt_negatif": demande.prompt_negatif,
            "resolution": demande.resolution, "proportions": demande.proportions, "options": dict(demande.options)}
        if "graine" in p["liaisons"]:
            # Une étape déjà préparée garde sa graine : la retirer changerait
            # le calcul que sa clé désigne.
            avant = self.etape(generation.identifiant, rang)
            graine = avant and avant["parametres"]["valeurs"].get("graine")
            valeurs["graine"] = tirer_graine() if graine is None else graine
        composer(p, references=[f"reference-{i}" for i in range(len(demande.references))], **valeurs)
        archive = io.BytesIO()
        with zipfile.ZipFile(archive, "w", compression=zipfile.ZIP_STORED) as z:
            for i, octets in enumerate(demande.references):
                # Horodatage fixe : relire la même demande garde son empreinte.
                info = zipfile.ZipInfo(str(i), (1980, 1, 1, 0, 0, 0))
                z.writestr(info, octets)
        etape = self.file_locale.preparer(f"image:{generation.identifiant}:{rang}", nature="image",
            moteur=self._inscrire_moteur(), modele=modele.identifiant, projet=generation.projet, acteur=generation.provenance,
            parametres={"generation": generation.identifiant, "rang": rang, "valeurs": valeurs,
                "profil": {**normaliser(p), "version": p["version"]}, "references": len(demande.references)}, entree=archive.getvalue())
        await self.file_locale.lancer(etape["identifiant"])
        await self.file_locale.attendre_fin(etape["identifiant"])
        return self._resultat(etape["identifiant"])

    async def recuperer_suivi(self, generation, rang=0):
        etape = self.etape(generation, rang)
        if not etape:
            raise WorkflowRefuse("Aucune étape locale conservée pour cette génération. Aucun nouvel envoi.")
        self._inscrire_moteur()
        await self.file_locale.lancer(etape["identifiant"], reprise=True)
        await self.file_locale.attendre_fin(etape["identifiant"])
        return self._resultat(etape["identifiant"])

    def _resultat(self, identifiant):
        etape = self.file_locale.lire(identifiant)
        if etape["etat"] == "externe_inconnu":
            raise AcceptationLocaleInconnue(etape["raison"])
        if etape["etat"] != "termine":
            raise SuiviLocalInterrompu(etape["raison"])
        resultat = etape["resultat"]
        octets = (self.file_locale._dossier(identifiant) / "resultat").read_bytes()
        if hashlib.sha256(octets).hexdigest() != resultat["empreinte"]:
            raise WorkflowRefuse("Le fichier image conservé a été modifié.")
        return ImageProduite(octets, 0.0, type_media=resultat["type_media"], graine=etape["parametres"]["valeurs"].get("graine"))

    async def _executer(self, etape):
        moteur = self.fabrique_moteur()
        if moteur.nom + "@" + moteur.adresse != etape["moteur"]:
            raise SuiviLocalInterrompu("Rétablir l'adresse du moteur de cette image avant de reprendre.")
        parametres, identifiant = etape["parametres"], etape["identifiant"]
        profil = parametres["profil"]
        if not etape["travail_externe"]:
            if self.avant_soumission is not None:
                self.avant_soumission(parametres["generation"])
            diagnostic = await moteur.diagnostiquer_profil(profil)
            if not diagnostic["disponible"]:
                raise WorkflowRefuse(" · ".join(diagnostic["problemes"]))
            with zipfile.ZipFile(io.BytesIO(self.file_locale.entree(identifiant))) as z:
                references = [z.read(str(i)) for i in range(parametres["references"])]
            self.file_locale.engager(identifiant)
            try:
                numero = await moteur.soumettre_graphe(profil, parametres["valeurs"], references)
            except Exception as e:
                raise AcceptationLocaleInconnue(f"Acceptation du workflow incertaine : {e}") from e
            self.file_locale.connaitre_externe(identifiant, numero)
        else:
            numero = etape["travail_externe"]
        limite = time.monotonic() + self.delai
        # L'état est celui du port vidéo déjà utilisé par Maison : on ne
        # réinterprète pas ici le vocabulaire propre à ComfyUI.
        while time.monotonic() < limite:
            etat = await moteur.etat(numero)
            if etat.echoue:
                return {"reussie": False, "raison": etat.raison}
            if etat.fini:
                octets, type_media, reference = await moteur.sortie_de(numero, profil)
                # Les octets restent acquis même si ce n'est pas une image.
                self.file_locale.fichiers._poser(self.file_locale._dossier(identifiant) / "resultat", octets)
                return {"empreinte": hashlib.sha256(octets).hexdigest(), "type_media": type_media,
                    "sortie": reference, "modele": etape["modele"], "version": profil["version"]}
            await asyncio.sleep(self.intervalle)
        raise SuiviLocalInterrompu("L'attente du workflow est interrompue. Son numéro est conservé pour reprendre sans nouvel appel.")
