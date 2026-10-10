"""Le port image synchrone attend une étape ComfyUI durable et récupérable."""
from __future__ import annotations

import asyncio
import hashlib
import io
import time
import zipfile
from typing import Any

from atelier.domaine.catalogue import Modele, Option
from atelier.domaine.workflow import MASQUE, WorkflowRefuse, composer, normaliser, tirer_graine
from atelier.fournisseur.port import ImageProduite
from atelier.fournisseur.workflow import verifier_masque
from atelier.services.file_locale import (FINIS, AcceptationLocaleInconnue, SuiviLocalInterrompu, TravailExternePerdu,
    resoumission_permise)
from atelier.domaine.erreurs import FournisseurIndisponible


class _ObjectInfoPartage:
    """Fait tenir un seul `GET /object_info` le temps d'un rafraîchissement du
    catalogue (défaut 9b, relecture du 18/09/2026) : `diagnostiquer_profil`
    (`atelier/fournisseur/workflow.py`, à l'autre agent) le redemande à chaque
    profil sans le mettre en cache lui-même — vingt-trois styles locaux en
    faisaient donc vingt-trois appels identiques à chaque ouverture d'écran.
    On ne touche pas à ce fichier-là ; on partage l'appel depuis l'appelant,
    en substituant temporairement `_json` sur l'instance du moteur."""

    def __init__(self, moteur):
        self._moteur = moteur

    async def __aenter__(self):
        original = self._moteur._json
        cache: dict[str, Any] = {}

        async def _json_partage(methode, chemin, *args, **kwargs):
            if methode == "GET" and chemin == "/object_info" and not args and not kwargs:
                if "reponse" not in cache:
                    cache["reponse"] = await original(methode, chemin, *args, **kwargs)
                return cache["reponse"]
            return await original(methode, chemin, *args, **kwargs)

        self._original, self._moteur._json = original, _json_partage
        return self

    async def __aexit__(self, *exc):
        self._moteur._json = self._original


class FournisseurWorkflowImage:
    nom = "ComfyUI"
    locale = True

    def __init__(self, profils, file_locale, fabrique_moteur):
        self.profils, self.file_locale, self.fabrique_moteur = profils, file_locale, fabrique_moteur
        self.avant_soumission = None
        self.intervalle = 1.0  # comme le son : une lecture de `/history` ne coûte presque rien
        self.delai = 1800.0
        file_locale.inscrire_executeur("image", self._executer)
        # Une image restée ouverte d'une séance précédente doit pouvoir être
        # reprise par la veille de la file dès le démarrage : son moteur est
        # raccordé ici, sans attendre qu'une nouvelle image le demande.
        try:
            if any(e["nature"] == "image" and e["etat"] not in FINIS for e in file_locale.lister()["etapes"]):
                self._inscrire_moteur()
        except Exception:  # noqa: BLE001 — un moteur mal réglé se dira à la reprise
            pass

    def indisponible(self):
        return None

    def compte(self):
        return None

    def secrets(self):
        return ()

    async def catalogue(self):
        moteur = self.fabrique_moteur()
        modeles = []
        # Défaut 4a (relecture du 18/09/2026) : **une seule version par style**
        # publiée dans le catalogue — celle « en service » (voir `_versions_a_publier`)
        # —, pas chacune de ses générations passées. Les anciennes restent lisibles
        # par `profils.de_modele` (les générations passées les nomment), elles
        # disparaissent seulement d'ici.
        #
        # **Décision pour un profil importé à la main** : comportement inchangé,
        # chaque version reste une entrée du catalogue. Seul un style passé par
        # `styles_locaux.installer` porte un marqueur « en service »
        # (`ServiceProfilsWorkflow.marquer_service`) ; un profil qu'on n'a jamais
        # installé par ce geste-là n'en a aucun, et ce n'est pas trivialement le
        # même cas : `tests/test_au7_au8.py` réimporte le même identifiant à la
        # main avec un contenu différent et s'attend à retrouver l'ancienne
        # version dans le catalogue, une version durable qu'une génération
        # passée continue de nommer — les replier aurait changé ce contrat-là
        # sans qu'on le lui ait demandé.
        profils_images = [p for p in self.profils.lister() if p["nature"] == "image"]
        par_identifiant: dict[str, list] = {}
        for p in profils_images:
            par_identifiant.setdefault(p["identifiant"], []).append(p)
        a_publier = []
        for identifiant, versions in par_identifiant.items():
            a_publier.extend(self._versions_a_publier(identifiant, versions))
        # Défaut 9b : un seul GET /object_info pour tout le rafraîchissement,
        # partagé entre les appels à `diagnostiquer_profil` — vingt-trois styles
        # locaux en refaisaient sinon vingt-trois, un par profil.
        async with _ObjectInfoPartage(moteur):
            for p in a_publier:
                diagnostic = await moteur.diagnostiquer_profil(p)
                modeles.append(Modele(p["modele"], p["nom"], fournisseur=self.nom,
                    chez_lui=p["modele"].split(":", 1)[1], references_min=p["references_min"], references_max=p["references_max"],
                    proportions=tuple(dict.fromkeys(f["proportions"] for f in p["formats"])),
                    resolutions=tuple(dict.fromkeys(f["resolution"] for f in p["formats"])), locale=True,
                    options={n: Option(n, o["genre"], tuple(o.get("valeurs", [])), o.get("minimum"), o.get("maximum")) for n, o in p["parametres"].items()},
                    indisponible=" · ".join(diagnostic["problemes"]) or None,
                    reference=(p.get("style") or {}).get("reference"),
                    negatif_lu="prompt_negatif" in p["liaisons"],
                    famille=(p.get("style") or {}).get("famille"),
                    transparence=bool((p.get("style") or {}).get("transparence")),
                    # PX2 : la capacité se lit sur le profil, jamais sur un nom.
                    masque=MASQUE in p["liaisons"]))
        return modeles

    def _versions_a_publier(self, identifiant, versions):
        """Les versions de ce style à montrer dans le catalogue.

        Avec un marqueur « en service » (un style installé par
        `styles_locaux`) : une seule, celle que la dernière installation a
        produite ou retrouvée — pas la plus récente par `cree_le`, sans quoi
        un cycle A→B→A réinstallant A montrerait encore B. Sans marqueur (un
        profil importé à la main) : toutes, comme avant cette règle."""
        service = self.profils.version_en_service(identifiant)
        if service is None:
            return versions
        trouvee = next((v for v in versions if v["version"] == service), None)
        return [trouvee if trouvee else max(versions, key=lambda v: v["cree_le"])]

    async def generer(self, modele, demande):
        raise WorkflowRefuse("Un workflow local doit être lancé par une génération suivie de l'atelier.")

    def etape(self, generation, rang=0):
        return self.file_locale.trouver(f"image:{generation}:{rang}")

    def _options_locales(self, profil, options, nombre_references):
        """Ce que l'écran envoie pour un réglage de style local, mis en forme
        avant `composer` (défaut 2, relecture du 18/09/2026).

        **Un curseur HTML envoie une chaîne** (`e.target.value`) : une valeur
        numérique reçue en texte (`"0.3"`) est convertie ici, pas rejetée —
        `Option.accepte` n'accepte qu'un `int`/`float` sur un réglage
        « intervalle ». Une chaîne qui ne se lit pas comme un nombre reste
        refusée, avec une phrase qui le dit.

        **Un réglage « propre aux références » (`reference_seule`, comme
        `force`) reçu sans qu'aucune référence ne soit jointe est ignoré, pas
        validé.** Le graphe à 0 référence ne le relie nulle part
        (`_variantes` dans `atelier.domaine.workflow` : cette option n'existe
        même pas dans ses liaisons) ; le garder dans les options aurait fait
        échouer une génération sans image à cause d'un réglage inerte qui
        traînait — par exemple un curseur `force` resté à sa valeur par défaut
        pendant qu'aucune image n'est jointe.
        """
        resultat = {}
        for nom, valeur in options.items():
            parametre = profil["parametres"].get(nom)
            if parametre is None:
                resultat[nom] = valeur
                continue
            if parametre.get("reference_seule") and nombre_references == 0:
                continue
            if parametre.get("genre") == "intervalle" and isinstance(valeur, str):
                try:
                    valeur = float(valeur)
                except ValueError as e:
                    raise WorkflowRefuse(f"La valeur de {nom} doit être un nombre.") from e
            resultat[nom] = valeur
        return resultat

    def _inscrire_moteur(self):
        moteur = self.fabrique_moteur()
        identifiant = moteur.nom + "@" + moteur.adresse
        self.file_locale.inscrire_moteur(identifiant, moteur.nom, moteur.observer_ressource)
        return identifiant

    async def generer_suivi(self, modele, demande, generation, rang):
        p = self.profils.de_modele(modele.identifiant)
        # `graine` est une clé réservée (refaire la même image), pas une option
        # du profil : elle ne passe pas par `composer` comme un réglage.
        explicite = demande.options.get("graine")
        options = self._options_locales(p, {k: v for k, v in demande.options.items() if k != "graine"}, len(demande.references))
        valeurs = {"prompt": demande.prompt, "prompt_negatif": demande.prompt_negatif,
            "resolution": demande.resolution, "proportions": demande.proportions, "options": options}
        if "graine" in p["liaisons"]:
            # Une étape déjà préparée garde sa graine : la retirer changerait
            # le calcul que sa clé désigne. Sinon, celle que l'auteur a demandée.
            avant = self.etape(generation.identifiant, rang)
            graine = avant and avant["parametres"]["valeurs"].get("graine")
            if graine is None:
                graine = explicite
            valeurs["graine"] = tirer_graine() if graine is None else graine
        # PX2 : la zone peinte. `composer` refuse un masque qu'un profil ne relie
        # pas, et un profil qui en relie un sans qu'on le lui donne — avant la file.
        masque = getattr(demande, "masque", None)
        if masque is not None:
            verifier_masque(masque, demande.references[0] if demande.references else None)
        composer(p, references=[f"reference-{i}" for i in range(len(demande.references))],
            **({"masque": "masque"} if masque is not None else {}), **valeurs)
        archive = io.BytesIO()
        with zipfile.ZipFile(archive, "w", compression=zipfile.ZIP_STORED) as z:
            for i, octets in enumerate(demande.references):
                # Horodatage fixe : relire la même demande garde son empreinte.
                info = zipfile.ZipInfo(str(i), (1980, 1, 1, 0, 0, 0))
                z.writestr(info, octets)
            if masque is not None:
                # Même archive, une entrée de plus — absente sans zone : une
                # demande sans masque garde son archive d'avant, octet pour octet.
                z.writestr(zipfile.ZipInfo(MASQUE, (1980, 1, 1, 0, 0, 0)), masque)
        etape = self.file_locale.preparer(f"image:{generation.identifiant}:{rang}", nature="image",
            moteur=self._inscrire_moteur(), modele=modele.identifiant, projet=generation.projet, acteur=generation.provenance,
            parametres={"generation": generation.identifiant, "rang": rang, "valeurs": valeurs,
                "profil": {**normaliser(p), "version": p["version"]}, "references": len(demande.references),
                **({MASQUE: True} if masque is not None else {})}, entree=archive.getvalue())
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
                masque = z.read(MASQUE) if parametres.get(MASQUE) else None
            self.file_locale.engager(identifiant)
            try:
                numero = await moteur.soumettre_graphe(profil, parametres["valeurs"], references,
                    **({"masque": masque} if masque is not None else {}))
            except Exception as e:
                raise AcceptationLocaleInconnue(f"Acceptation du workflow incertaine : {e}") from e
            self.file_locale.connaitre_externe(identifiant, numero)
        else:
            numero = etape["travail_externe"]
        limite = time.monotonic() + self.delai
        # L'état est celui du port vidéo déjà utilisé par Maison : on ne
        # réinterprète pas ici le vocabulaire propre à ComfyUI.
        while time.monotonic() < limite:
            try:
                etat = await moteur.etat(numero)
            except FournisseurIndisponible:
                # ComfyUI occupé à décoder ne répond pas toujours à temps : une
                # lecture d'état manquée n'interrompt plus le suivi (10 octobre
                # 2026, la file restait arrêtée jusqu'à une reprise à la main).
                await asyncio.sleep(self.intervalle)
                continue
            if etat.perdu and resoumission_permise(etape):
                # ComfyUI ne connaît plus ce travail, et c'est une reprise
                # automatique : la file le soumettra de nouveau, une fois.
                # Hors de ce cas, il échoue comme avant (juste en dessous).
                raise TravailExternePerdu(etat.raison)
            if etat.echoue:
                return {"reussie": False, "raison": etat.raison}
            if etat.fini:
                octets, type_media, reference = await moteur.sortie_de(numero, profil)
                # Les octets restent acquis même si ce n'est pas une image.
                self.file_locale.fichiers._poser(self.file_locale._dossier(identifiant) / "resultat", octets)
                # **PX3bis** : le nœud de sortie du profil, rendu par le cache
                # de ComfyUI plutôt que recalculé — ce tirage-là n'a rien coûté
                # en temps de carte graphique, et ne doit pas entrer dans la
                # médiane du bouton (`ServiceFileLocale._executer`, `duree_s`).
                cache = str(profil["sortie"]["noeud"]) in etat.noeuds_caches
                return {"empreinte": hashlib.sha256(octets).hexdigest(), "type_media": type_media,
                    "sortie": reference, "modele": etape["modele"], "version": profil["version"], "cache": cache}
            await asyncio.sleep(self.intervalle)
        raise SuiviLocalInterrompu("L'attente du workflow est interrompue. Son numéro est conservé pour reprendre sans nouvel appel.")
