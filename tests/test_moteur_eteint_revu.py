"""Un moteur local vu éteint est revu à chaque demande de la liste vidéo.

L'auteur allume souvent ComfyUI **après** l'atelier : avant cette relecture, le
grisé « pas allumé » restait jusqu'au redémarrage (10-11 octobre 2026,
`ServiceAnimation._revoir_les_moteurs_eteints`). Ces essais tiennent :

- un moteur éteint est revisité ; un moteur déjà vu allumé ne l'est pas ;
- une visite qui lève ne fait jamais tomber la liste ;
- un animateur sans moteur local (en ligne) n'est jamais sondé.

Aucun centime, aucun réseau : les moteurs sont doublés.
"""
from __future__ import annotations

from atelier.fournisseur.maison import EtatDuMoteur
from atelier.services.animation import ServiceAnimation


class Moteur:
    def __init__(self, allume: bool, leve: bool = False) -> None:
        self.allume = allume
        self.leve = leve
        self.visites = 0

    def etat_du_moteur(self) -> EtatDuMoteur:
        return EtatDuMoteur(allume=self.allume)

    async def visiter(self) -> EtatDuMoteur:
        self.visites += 1
        if self.leve:
            raise RuntimeError("ComfyUI répond de travers")
        self.allume = True
        return EtatDuMoteur(allume=True)


class EnLigne:
    """Un animateur payant : pas de moteur local, donc rien à revoir."""


def service(*portes) -> ServiceAnimation:
    s = ServiceAnimation.__new__(ServiceAnimation)
    s._fabriques = tuple((lambda p=p: p) for p in portes)
    return s


async def test_un_moteur_eteint_est_revu_et_un_moteur_allume_ne_l_est_pas():
    eteint, allume = Moteur(allume=False), Moteur(allume=True)
    await service(eteint, allume)._revoir_les_moteurs_eteints()
    assert eteint.visites == 1 and eteint.allume
    assert allume.visites == 0


async def test_une_visite_qui_leve_ne_fait_pas_tomber_la_liste():
    capricieux, suivant = Moteur(allume=False, leve=True), Moteur(allume=False)
    await service(capricieux, EnLigne(), suivant)._revoir_les_moteurs_eteints()
    assert capricieux.visites == 1 and not capricieux.allume
    assert suivant.visites == 1, "le moteur d'après est revu quand même"
