"""AU16 : images équipées durables, pliage CPU et budget commun aux animations.

Une case conserve la frame envoyée et son empreinte. Le dépliage crée une
nouvelle variante à extraire, jamais un calque élu à la place d'une correction.
"""
from __future__ import annotations

import asyncio
import io
import time
from dataclasses import replace

from PIL import Image

from atelier.domaine.asset import Asset, identifiant_de
from atelier.domaine.calques_cibles import CibleCalque
from atelier.domaine.consommation import USD
from atelier.domaine.demande import Demande
from atelier.domaine.envoi import Tri
from atelier.domaine.generation import AGENT, AUTEUR, CARTE, EDITION, STYLE, Reinjection, Statut
from atelier.domaine.pliage import CasePliee, Pliage
from atelier.domaine.recette import Recette
from atelier.domaine.travail import TravailRefuse
from atelier.domaine.travail_equipement import generation_d_appel, normaliser, travail_de_generation
from atelier.image.calque import cases_de, composer
from atelier.image.calques_cibles import png, rgba
from atelier.image.decoupe import decouper
from atelier.services.couverture_equipement import ServiceCouvertureEquipement, cle_cible
from atelier.services.pliage import consignes, plier
from atelier.services.travaux import ServiceTravaux, _hash, _json, _verrou


class ServiceTravauxEquipement(ServiceTravaux):
    def __init__(self, atelier):
        super().__init__(atelier)
        self._taches = atelier.travaux._taches
        atelier.travaux.inscrire_executant("equipement", self._executer)
        self.couverture = ServiceCouvertureEquipement(atelier)

    async def preparer(self, projet, piece, emploi, brute, acteur=AUTEUR):
        d = normaliser(brute)
        if acteur not in (AUTEUR, AGENT):
            raise TravailRefuse("L'origine doit être auteur ou agent.")
        identifiant = _hash((projet + "\0" + d["cle"]).encode())[:32]
        dossier = self._dossier(projet, identifiant)
        empreinte = _hash(_json({"demande": d, "acteur": acteur, "piece": piece, "emploi": emploi}))
        with _verrou(dossier / ".travail"):
            avant = self._lire(dossier / "travail.json")
            if avant:
                if avant["empreinte"] != empreinte:
                    raise TravailRefuse("Cette clé désigne déjà une autre demande ; choisir une nouvelle clé pour modifier l'envoi.")
                return self.lire(projet, identifiant)
            personnage, objet, lien = self.a.calques_cibles._emploi(projet, piece, emploi)
            vue = self.couverture.lire(projet, piece, emploi, resultats=d["resultats"])
            disponibles = {cle_cible(c["cible"]): c for c in vue["cibles"]}
            if d["cibles"] is None:
                selection = [c["cible"] for case in vue["cases"] for version in case["versions"]
                             if version["choisie"] for c in version["images"] if c["fabricable"]]
            else:
                selection = d["cibles"]
            if not selection:
                raise TravailRefuse("Aucune image manquante sur les bases choisies. Choisir une version produite, ou des cibles explicites à refabriquer.")
            if len(selection) != len({cle_cible(c) for c in selection}):
                raise TravailRefuse("Une même cible ne peut figurer deux fois dans cet envoi.")
            if any(cle_cible(c) not in disponibles for c in selection):
                raise TravailRefuse("Une cible n'appartient plus à cet emploi.")
            modele = self.a.catalogue.modele(d["modele"])
            locale = self.a.generations.methode_locale(d["modele"])
            manque = self.a.catalogue.grise(modele)
            if manque:
                raise TravailRefuse(manque)
            if modele.references_max < 1:
                raise TravailRefuse("Cette méthode ne reçoit aucune image ; elle ne peut habiller les bases exactes.")
            travail = {"nature": "equipement", "identifiant": identifiant, "cle": d["cle"],
                "projet": projet, "piece": piece, "emploi": emploi, "personnage": personnage.identifiant,
                "acteur": acteur, "empreinte": empreinte, "demande": {**d, "livrer_provisoire": False},
                "etat": "prepare", "etape": "relecture", "cree_le": time.time(), "appels_engages": 0,
                "reserve": None, "demarrage_recu": False, "generations_images": [], "appels": [],
                "cibles": [], "references": [], "variantes": [], "bandes": [],
                "piece_fiche": objet.en_json(), "emploi_fiche": lien.en_json(),
                "catalogue": {"modele": modele.identifiant, "fournisseur": modele.fournisseur,
                    "references_max": modele.references_max, "resolutions": list(modele.resolutions),
                    "capacite_cases_max": None,
                    "capacite_explication": "Le catalogue ne déclare pas de limite de cases. Le découpage choisi est un réglage de l'envoi, pas une promesse de qualité."}}
            for rang, cible in enumerate(selection):
                octets, base = self.a.calques_cibles._base_cible(projet, piece, emploi,
                    CibleCalque.depuis_json(cible), identifier=True)
                nom = f"base-{rang}.png"
                self.a.fichiers._poser(dossier / nom, octets)
                travail["cibles"].append({"cible": cible, "base": base, "fichier": nom,
                    "empreinte": _hash(octets), "etat_avant": disponibles[cle_cible(cible)]["etat"],
                    "variante": None, "source": None, "url": self._url(projet, piece, emploi, identifiant, "bases", rang)})
            nombre = d["cases_par_planche"] if d["methode"] == "planches" else 1
            for numero, debut in enumerate(range(0, len(selection), nombre)):
                indexes = list(range(debut, min(debut + nombre, len(selection))))
                pliage = plier([CasePliee(texte=objet.description or objet.nom) for _ in indexes], geometrie_connue=True)
                pliage.occupation = d["occupation"]
                feuille = composer([(dossier / travail["cibles"][i]["fichier"]).read_bytes() for i in indexes],
                                  pliage.geometrie, pliage.occupation)
                # L'import CPU fait entrer la planche de travail en bibliothèque.
                # Le fournisseur ne reçoit jamais un fichier relu après sa retouche.
                feuille_asset = self.a.generations.importer(feuille, f"Bases · {objet.nom} · {numero + 1}",
                    projet=projet, provenance=acteur, forcer=True)["asset"]["identifiant"]
                refs = [Reinjection(asset=feuille_asset, role=EDITION),
                        *[Reinjection(asset=r) for r in d["references"]],
                        *[Reinjection(asset=r, role=STYLE) for r in objet.references if r not in d["references"] and r not in d["references_ecartees"]],
                        *[Reinjection(asset=r, origine=CARTE, role=STYLE) for r in objet.concept_arts
                          if r not in d["references_ecartees"]]]
                texte = d["prompt"] or " · ".join(p for p in (objet.description or objet.nom, lien.description) if p)
                if not d["repris"]:
                    texte += "\n\n" + consignes(pliage)
                texte_corrige = d["textes_appels"].get(str(numero))
                if texte_corrige is not None:
                    texte = texte_corrige
                generation, _, deja = self.a.generations.preparer(d["modele"], Demande(prompt=texte,
                    prompt_negatif=d["prompt_negatif"], proportions=d["proportions"], resolution=d["resolution"],
                    options=d["options"], echelle=personnage.type, repris=d["repris"] or texte_corrige is not None),
                    identifiant=generation_d_appel(identifiant, numero, empreinte), projet=projet,
                    provenance=acteur, references=refs, references_ecartees=d["references_ecartees"],
                    tri=Tri.depuis_json(d["tri"]))
                if deja and any(e.demarre_le is not None for e in generation.emplacements):
                    raise TravailRefuse("Cette préparation a déjà été soumise ; relire le travail existant.")
                snapshot = self.a.generations.demande_preparee(generation)
                fichiers = []
                for i, octets in enumerate(snapshot.references):
                    nom = f"appel-{numero}-reference-{i}.png"
                    self.a.fichiers._poser(dossier / nom, octets)
                    fichiers.append({"fichier": nom, "empreinte": _hash(octets),
                        "reference": generation.references[i].en_json() if i < len(generation.references) else None,
                        "url": self._url(projet, piece, emploi, identifiant, "references", numero, i)})
                unite = self.a.catalogue.unite_de(d["modele"])
                prix = 0.0 if locale else self.a.generations.cout_attendu(d["modele"], len(fichiers))
                reservation = 0.0 if locale else d["reservation_par_appel_usd"] if d["reservation_par_appel_usd"] is not None else prix
                if unite in (None, USD) and reservation is None:
                    raise TravailRefuse("Le coût d'un appel n'est pas encore mesuré : indiquer une réservation par appel avant la relecture.")
                reservation = float(reservation or 0) if unite in (None, USD) else 0.0
                travail["generations_images"].append(generation.identifiant)
                travail["appels"].append({"numero": numero, "generation": generation.identifiant,
                    "cibles": indexes, "pliage": pliage.en_json(), "planche_asset": feuille_asset,
                    "snapshot": snapshot.resume(), "references": fichiers, "hors_plafond": [r.en_json() for r in generation.hors_plafond],
                    "soumis": False, "etat": "prepare", "reservation_usd": reservation,
                    "consommation_annoncee": {"montant": prix, "unite": unite, "mesuree": prix is not None},
                    "temps_local": self.a.generations.annonce_locale(d["modele"], snapshot) if locale else None})
            travail["annonce"] = {"images_ciblees": len(selection), "planches": len(travail["appels"]),
                "appels": len(travail["appels"]), "reservation_usd": sum(a["reservation_usd"] for a in travail["appels"]),
                "methodes": [{"nature": "image", "modele": modele.identifiant, "locale": locale,
                              "payante": not locale and unite in (None, USD)}],
                "limite": "Une planche coûte un appel, indépendamment de ses cases. L'estimation ne plafonne pas la facturation réelle.",
                "origine": "Les images déjà rendues, y compris depuis une vidéo ou un modèle 3D, suivent le même pliage 2D. Une graine vidéo identique ne garantit pas le même mouvement."}
            self._garder(travail)
            return self.lire(projet, identifiant)

    @staticmethod
    def _url(projet, piece, emploi, travail, genre, rang, reference=None):
        suffixe = f"/{reference}" if reference is not None else ""
        return f"/api/projects/{projet}/equipment/{piece}/uses/{emploi}/jobs/{travail}/{genre}/{rang}{suffixe}"

    def fichier(self, projet, piece, emploi, identifiant, genre, rang, reference=None):
        t = self._brut_emploi(projet, piece, emploi, identifiant)
        if genre == "retours":
            if not 0 <= rang < len(t["appels"]):
                raise TravailRefuse("Cette planche n'appartient pas à l'envoi.")
            generation = self.a.base.lire(t["appels"][rang]["generation"])
            resultat = generation.emplacements[0].resultat if generation else None
            if resultat is None:
                raise TravailRefuse("La planche n'est pas encore arrivée.")
            return png(rgba(self.a.fichiers.lire(resultat.fichier)))
        try:
            fiche = t["cibles"][rang] if genre == "bases" else t["appels"][rang]["references"][reference]
        except (IndexError, TypeError):
            raise TravailRefuse("Cette image n'appartient pas à l'envoi.") from None
        if rang < 0 or (reference is not None and reference < 0):
            raise TravailRefuse("L'image demandée n'existe pas.")
        octets = (self._dossier(projet, identifiant) / fiche["fichier"]).read_bytes()
        if _hash(octets) != fiche["empreinte"]:
            raise TravailRefuse("Une image préparée a changé sur le disque.")
        return octets

    def _brut_emploi(self, projet, piece, emploi, identifiant):
        travail = self._brut(projet, identifiant)
        if travail.get("nature") != "equipement" or travail["piece"] != piece or travail["emploi"] != emploi:
            raise TravailRefuse("Ce travail n'appartient pas à cet emploi.")
        return travail

    def annuler(self, projet, piece, emploi, identifiant, acteur=AUTEUR):
        t = self._brut_emploi(projet, piece, emploi, identifiant)
        if acteur != AUTEUR and t["acteur"] != acteur:
            raise TravailRefuse("Cette fabrication appartient à l'auteur.")
        if t["etat"] == "termine":
            return self.lire(projet, identifiant)
        self._ecrire(self._dossier(projet, identifiant) / "arret.json", {"demande_le": time.time()})
        if identifiant not in self._taches or self._taches[identifiant].done():
            with _verrou(self._dossier(projet, identifiant) / ".travail"):
                t = self._brut(projet, identifiant)
                incertain = any(a["soumis"] and self._acceptation_incertaine(a) for a in t["appels"])
                if incertain:
                    t.update(etat="externe_inconnu", raison="L'arrêt ne peut effacer une soumission incertaine ; vérifier son acceptation avant de libérer le budget.")
                    self._garder(t)
                elif t["etat"] != "externe_inconnu":
                    t.update(etat="annule", reserve=None)
                    self._garder(t)
        return {**self.lire(projet, identifiant), "annulation_demandee": True}

    def _acceptation_incertaine(self, appel):
        generation = self.a.base.lire(appel["generation"])
        return generation is None or generation.statut not in (Statut.REUSSIE, Statut.ECHOUEE) or any(
            e.acceptation_inconnue for e in generation.emplacements)

    def confirmer_decoupe(self, projet, piece, emploi, identifiant, appel):
        with _verrou(self._dossier(projet, identifiant) / ".travail"):
            t = self._brut_emploi(projet, piece, emploi, identifiant)
            if not 0 <= appel < len(t["appels"]) or t["appels"][appel]["etat"] != "a-verifier":
                raise TravailRefuse("Cette planche n'attend pas de confirmation de découpe.")
            t["appels"][appel]["pliage"]["ecartees"] = []
            self._garder(t)
        return self.lire(projet, identifiant)

    async def _executer(self, projet, identifiant, reprise):
        dossier = self._dossier(projet, identifiant)
        verrou_pris = False
        try:
            with _verrou(dossier / ".travail"):
                verrou_pris = True
                t = self._brut(projet, identifiant)
                for appel in t["appels"]:
                    if appel["etat"] == "termine":
                        continue
                    generation = self.a.base.lire(appel["generation"])
                    if generation is None:
                        raise TravailRefuse("La préparation de cette planche manque sur le disque.")
                    if (generation.statut != Statut.REUSSIE and appel["soumis"] and reprise
                            and self.a.generations.methode_locale(generation.modele)
                            and self.a.generations.etape_locale(generation.identifiant)):
                        await self.a.generations.suivre_locale(generation.identifiant)
                        generation = self.a.base.lire(generation.identifiant)
                    if generation.statut != Statut.REUSSIE:
                        if appel["soumis"]:
                            # Aucune nouvelle dépense : même un retour d'erreur doit
                            # être relu, pas transformé en commande supplémentaire.
                            if any(e.acceptation_inconnue for e in generation.emplacements) or generation.statut != Statut.ECHOUEE:
                                t.update(etat="externe_inconnu", raison="L'acceptation de la planche est incertaine ; aucun nouvel appel automatique.")
                                self._garder(t)
                                return
                            appel["etat"] = "echoue"
                            continue
                        if (dossier / "arret.json").exists():
                            t.update(etat="annule", reserve=None)
                            self._garder(t)
                            return
                        refs = tuple(self.fichier(projet, t["piece"], t["emploi"], identifiant,
                            "references", appel["numero"], i) for i in range(len(appel["references"])))
                        with _verrou(self._projet(projet) / ".budget"):
                            self._autoriser(t)
                            appel.update(soumis=True, etat="soumis")
                            t["appels_engages"] += 1
                            t["etape"] = "fabrication"
                            self._garder(t)
                        s = appel["snapshot"]
                        await self.a.generations.executer_preparee(generation.identifiant, Demande(prompt=s["prompt"],
                            prompt_negatif=s["prompt_negatif"], proportions=s["proportions"], resolution=s["resolution"],
                            options=s["options"], references=refs, repris=True))
                        generation = self.a.base.lire(generation.identifiant)
                        if generation.statut != Statut.REUSSIE:
                            appel["etat"] = "echoue"
                            if any(e.acceptation_inconnue for e in generation.emplacements):
                                t.update(etat="externe_inconnu", raison="La réponse de la planche a été perdue ; vérifier son acceptation chez le fournisseur.")
                                self._garder(t)
                                return
                            self._garder(t)
                            continue
                    t["etape"] = "depliage"
                    appel["retour_url"] = self._url(projet, t["piece"], t["emploi"], identifiant, "retours", appel["numero"])
                    try:
                        self._deplier(t, appel, generation)
                        appel["etat"] = "termine"
                        appel.pop("raison", None)
                    except Exception as erreur:
                        appel.update(etat="a-verifier", raison=str(erreur))
                    self._garder(t)
                fini = all(a["etat"] == "termine" for a in t["appels"])
                t.update(etat="termine" if fini else "a_verifier", etape="termine" if fini else "resultats", reserve=None)
                if not fini:
                    t["raison"] = "Les retours disponibles sont conservés ; vérifier les planches signalées. Les appels échoués ne sont pas relancés."
                else:
                    t.pop("raison", None)
                self._garder(t)
        except asyncio.CancelledError:
            raise
        except Exception as erreur:
            if verrou_pris:
                t = self._brut(projet, identifiant)
                t.update(etat="a_verifier", raison=str(erreur))
                self._garder(t)

    def _deplier(self, t, appel, generation):
        pliage = Pliage.depuis_json(appel["pliage"])
        copie = replace(generation, pliage=pliage)
        try:
            morceaux, mesures = self.a.pliage.decouper_retour(copie, generation.emplacements[0])
        finally:
            appel["pliage"] = pliage.en_json()
        for numero, index in enumerate(appel["cibles"]):
            fiche = t["cibles"][index]
            if fiche["variante"]:
                continue
            base = self.fichier(t["projet"], t["piece"], t["emploi"], t["identifiant"], "bases", index)
            # **La case entière, fond compris, bornée à la case** — et non le
            # rectangle où le corps avait été posé (`place_de`) : ce qui sort du
            # corps, un bâton tenu à côté, en sortait aussi et y était coupé net
            # (cinq tirages de Champy sur cinq, le 18 septembre 2026). Sur une
            # grille connue, `decouper_retour` rend déjà chaque case entière, sans
            # marge : la voisine n'y entre pas. Le cadrage se fait ensuite comme
            # pour une image associée à la main (`accueillir_retour`).
            label = self._label(t, fiche, index)
            existante = self.a.assets.lire(fiche["source"] or "")
            if existante is not None and existante.label != label:
                fiche["source"] = None
                existante = None
            if existante is None:
                # Un rang s'écrit avant l'asset. La reprise reconnaît sa provenance
                # et ne remplace pas un dérivé créé entre-temps par la main.
                fiche["source"] = self._ranger_case(t, generation, morceaux[numero], label, mesures[numero])
            fiche["case"] = fiche["source"]
            v = self.a.calques_cibles.accueillir_retour(t["projet"], t["piece"], t["emploi"],
                fiche["cible"], fiche["source"], base, fiche["base"],
                identifiant=_hash(f"{t['identifiant']}:{index}:source-equipee".encode())[:32])
            fiche["variante"] = v["identifiant"]
            fiche["recalage"] = self._recalage(v)
            if v["identifiant"] not in t["variantes"]:
                t["variantes"].append(v["identifiant"])
            self._garder(t)
        self.a.diffusion.publier("bibliotheque", self.a.bibliotheque.arbre())

    @staticmethod
    def _label(t, fiche, index) -> str:
        return f"{t['piece_fiche']['nom']} · {fiche['base']['pose']} · {fiche['base']['direction'] or 'toutes'} · {index + 1}"

    @staticmethod
    def _recalage(variante) -> dict:
        p = variante.get("preparation") or {}
        return {"echelle": p.get("facteur"), "accord": p.get("accord"), "debord": p.get("debord"),
                "cadre": variante.get("calque_cadre")}

    def _ranger_case(self, t, generation, octets: bytes, label: str, lot) -> str:
        """La case revenue entre en bibliothèque, telle que le modèle l'a rendue."""
        rang = max([99, *self.a.base.rangs_de_generation(generation.identifiant)]) + 1
        identifiant = identifiant_de(generation.identifiant, rang)
        pixels = rgba(octets)
        chemin = self.a.fichiers.ecrire_brut(generation.identifiant, rang, png(pixels), ".png")
        self.a.assets.accueillir(Asset(identifiant=identifiant, generation=generation.identifiant,
            rang=rang, brut=chemin, largeur=pixels.shape[1], hauteur=pixels.shape[0], type_media="image/png",
            label=label, recette=Recette(), projet=t["projet"], parent=identifiant_de(generation.identifiant, 0),
            modele=generation.modele, provenance=t["acteur"], lot=lot))
        return identifiant

    def relire_depuis_la_planche(self, projet, piece, emploi, variante, revision: int):
        """Relire l'image équipée d'une variante **depuis la planche revenue**, gratuitement.

        Le rattrapage des retours dépliés avant le 18 septembre 2026, coupés au
        cadre du corps : la planche d'origine (`0-brut.png` de la génération de
        l'appel) est toujours sur le disque. On en reprend la case entière — la
        même que le dépliage d'aujourd'hui —, elle entre en bibliothèque à côté
        de l'ancienne (qui reste), et la variante la relit avec la recette de sa
        pose (`ServiceCalquesCibles.reprendre_source`) : l'écrin grandit si la
        pièce déborde. **Aucun fournisseur n'est appelé** ; relancé, le geste
        reprend la même case au lieu d'en ranger une seconde.
        """
        cc = self.a.calques_cibles
        v = cc._brut(projet, piece, emploi, variante)
        if v["role"] != "source-equipee":
            raise TravailRefuse("Seule une image équipée à extraire se relit depuis sa planche.")
        origine = self.a.assets.lire(v["source"])
        generation_source = (origine.generation if origine else None) or (v.get("source_fiche") or {}).get("generation", "")
        numero_travail = travail_de_generation(generation_source)
        if numero_travail is None:
            raise TravailRefuse("Cette image équipée ne vient pas d'une fabrication d'équipement : il n'y a pas de planche à relire.")
        dossier = self._dossier(projet, numero_travail)
        with _verrou(dossier / ".travail"):
            t = self._brut_emploi(projet, piece, emploi, numero_travail)
            index = next((i for i, f in enumerate(t["cibles"]) if f.get("variante") == variante), None)
            appel = next((a for a in t["appels"] if index in a["cibles"]), None)
            if index is None or appel is None:
                raise TravailRefuse("Cette variante n'est plus rattachée à une case de sa fabrication.")
            generation = self.a.base.lire(appel["generation"])
            resultat = generation.emplacements[0].resultat if generation and generation.emplacements else None
            if resultat is None:
                raise TravailRefuse("La planche revenue n'est plus sur le disque ; la lecture actuelle est conservée.")
            fiche = t["cibles"][index]
            case = fiche.get("case")
            if not case or self.a.assets.lire(case) is None:
                octets = self.a.fichiers.lire(resultat.fichier)
                with Image.open(io.BytesIO(octets)) as ouverte:
                    largeur, hauteur = ouverte.size
                pliage = Pliage.depuis_json(appel["pliage"])
                boites = cases_de(largeur, hauteur, pliage.geometrie)
                numero = appel["cibles"].index(index)
                if numero >= len(boites):
                    raise TravailRefuse("La grille de la planche ne porte pas cette case.")
                morceau = decouper(octets, [boites[numero]], marge=0)[0]
                case = self._ranger_case(t, generation, morceau, self._label(t, fiche, index) + " · case entière",
                                         origine.lot if origine else None)
                fiche["case"] = case
                self._garder(t)
        relue = cc.reprendre_source(projet, piece, emploi, variante, revision, recette="pose", echelle=True, source=case)
        with _verrou(dossier / ".travail"):
            t = self._brut_emploi(projet, piece, emploi, numero_travail)
            t["cibles"][index]["source"] = case
            t["cibles"][index]["recalage"] = self._recalage(relue)
            self._garder(t)
        self.a.diffusion.publier("bibliotheque", self.a.bibliotheque.arbre())
        return relue
