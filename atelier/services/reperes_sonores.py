"""SN7 · Le son calé sur l'animation : poser, retirer et relire les repères
sonores d'un sujet, et dire à la livraison lesquels partent.

Les repères vivent dans le fichier des sons du sujet (SN6), sous `reperes`
(la forme est écrite en tête de `atelier.domaine.reperes_sonores`). Ce
service passe par le rangement de `ServiceSonsDuSujet` — même fichier, même
verrou, même révision — et ne touche ni aux bandes, ni aux sons.

- **Relire** : les repères du sujet (ou d'une bande), chacun avec le nom de
  son emplacement et de sa bande, et les sons que la salle d'essai peut jouer
  pour chaque emplacement désigné.
- **Poser, retirer** : `{bande, image, cle}` ; poser deux fois ne double rien,
  retirer ce qui n'est pas posé ne refuse rien.
- **Livrer** : `pour_livraison` rend les repères dont la bande et
  l'emplacement existent encore ; la livraison ne garde que ceux dont
  l'emplacement part avec le sujet.
"""
from __future__ import annotations

import time

from atelier.domaine.reperes_sonores import RepereRefuse, repere_valide
from atelier.domaine.sons_du_sujet import SonsDuSujetRefuses


class ServiceReperesSonores:
    def __init__(self, atelier):
        self.a = atelier

    @property
    def _sons(self):
        return self.a.sons_du_sujet

    def _bande(self, projet, sujet, identifiant):
        bande = self.a.base.lire_bande(identifiant)
        if not bande or bande.supprime or bande.projet != projet or bande.personnage != sujet:
            raise RepereRefuse("Cette animation n'est pas une animation de ce sujet.")
        return bande

    @staticmethod
    def _ordre(reperes):
        return sorted(reperes, key=lambda r: (r["bande"], r["image"], r["cle"]))

    # ── Relire ───────────────────────────────────────────────────────────

    def lire(self, projet, sujet, bande=None):
        vue = self._sons.lire(projet, sujet)
        identifiant = vue["sujet"]["identifiant"]
        emplacements = {e["cle"]: e for e in vue["emplacements"]}
        bruts = self._sons._brut(projet, identifiant).get("reperes", [])
        reperes, bandes = [], {}
        for r in bruts:
            if bande is not None and r["bande"] != bande:
                continue
            if r["bande"] not in bandes:
                b = self.a.base.lire_bande(r["bande"])
                bandes[r["bande"]] = b if b and not b.supprime and b.personnage == identifiant else None
            b = bandes[r["bande"]]
            e = emplacements.get(r["cle"])
            reperes.append({
                "bande": r["bande"], "image": r["image"], "cle": r["cle"],
                "nom": e["nom"] if e else None,
                "nom_bande": (b.nom or b.identifiant) if b else None,
                "pose": b.pose if b else None, "direction": b.direction if b else None,
                "compte": b.compte if b else None, "cadence": b.cadence if b else None,
                # Ce qui empêche le repère de sonner, dit en clair ; rien n'est retiré.
                "signal": ("Cette animation n'existe plus." if not b
                           else "Cet emplacement n'existe plus." if not e
                           else f"L'animation n'a plus que {b.compte} images." if r["image"] > b.compte
                           else "Cet emplacement est vide." if not e["rempli"] else None),
            })
        # Ce que la salle d'essai joue pour chaque emplacement désigné : les
        # sons qui partiraient au jeu (un au hasard, jamais deux fois de suite).
        sons = {cle: list(emplacements[cle]["contenu"]["a_livrer"])
                for cle in {r["cle"] for r in reperes} if cle in emplacements and emplacements[cle]["contenu"]}
        return {"projet": projet, "sujet": identifiant, "reperes": reperes, "sons": sons,
                "revision": vue["revision"]}

    # ── Poser, retirer ───────────────────────────────────────────────────

    def poser(self, projet, sujet, brut):
        bande, image, cle = repere_valide(brut)
        identifiant = self._sons.lire(projet, sujet)["sujet"]["identifiant"]
        b = self._bande(projet, identifiant, bande)
        if image > b.compte:
            raise RepereRefuse(f"Cette animation a {b.compte} images : choisissez une image entre 1 et {b.compte}.")
        try:
            self._sons.emplacement(projet, identifiant, cle)
        except SonsDuSujetRefuses as e:
            raise RepereRefuse(e.raison) from e

        def changer(objet):
            reperes = objet.setdefault("reperes", [])
            if any((r["bande"], r["image"], r["cle"]) == (bande, image, cle) for r in reperes):
                return False
            reperes.append({"bande": bande, "image": image, "cle": cle, "pose_le": time.time()})
            objet["reperes"] = self._ordre(reperes)
        self._sons._changer(projet, identifiant, changer)
        return self.lire(projet, identifiant)

    def retirer(self, projet, sujet, brut):
        bande, image, cle = repere_valide(brut)
        identifiant = self._sons.lire(projet, sujet)["sujet"]["identifiant"]

        def changer(objet):
            avant = objet.get("reperes", [])
            apres = [r for r in avant if (r["bande"], r["image"], r["cle"]) != (bande, image, cle)]
            if len(apres) == len(avant):
                return False
            objet["reperes"] = apres
        self._sons._changer(projet, identifiant, changer)
        return self.lire(projet, identifiant)

    # ── Livrer ───────────────────────────────────────────────────────────

    def pour_livraison(self, projet, sujet):
        """Les repères `{bande, image, cle}` du sujet, tels qu'écrits. La
        livraison les rapporte à ses animations (par l'identifiant de la
        bande) et à ses lecteurs audio (par la clé de l'emplacement)."""
        try:
            bruts = self._sons._brut(projet, sujet).get("reperes", [])
        except SonsDuSujetRefuses:
            return []
        return [{"bande": r["bande"], "image": r["image"], "cle": r["cle"]} for r in bruts]
