# -*- coding: utf-8 -*-
"""Le portrait d'un sujet — **une seule règle**, lue par la carte du Codex, la
fiche et l'agent (PX10).

Il y en avait deux, et c'est ce qui faisait revenir le défaut : la fiche
retombait sur *le corps retenu de la première case faite*, la carte du Codex sur
*la dernière image faite*. Dès que le choix de l'auteur cessait de valoir, toute
image nouvelle — un résultat repeint, une planche, un import — devenait le
portrait sur la carte, et rien ne le disait.

La règle, écrite une fois :

1. **le choix de l'auteur**, s'il désigne toujours une image vivante de ce
   sujet (`raison_perdue` rend `None`) ;
2. sinon **un repli qui ne bouge pas quand une image arrive** : une image
   marquée préférée d'abord, rangée dans une case avant une qui ne l'est pas,
   puis **la plus ancienne**. Une image neuve n'est jamais la plus ancienne ;
   seul un geste de l'auteur (marquer une préférée, ranger, supprimer) déplace
   le repli.

**Un choix perdu ne se remplace pas en silence** : le portrait rendu porte la
raison, et la fiche la dit (« le portrait choisi n'est plus disponible »). Le
repli sert à ce qui doit bien montrer quelque chose — la carte, l'image jointe
à un appel —, jamais à cacher la perte.

L'ordre du repli est la clause SQL `ORDRE_DU_REPLI` : la carte du Codex le lit
pour deux cents sujets en une requête, et la fiche passe par le même chemin.
"""

from __future__ import annotations

from dataclasses import dataclass

from atelier.domaine.asset import Asset

# **Préférée, rangée, ancienne** — dans cet ordre. `rang` et `identifiant`
# départagent les morceaux d'une même planche, qui partagent leur date.
ORDRE_DU_REPLI = "favori DESC, (pose IS NULL) ASC, cree_le ASC, rang ASC, identifiant ASC"

SUPPRIMEE = "supprimee"
CALQUE = "calque"
DETACHEE = "detachee"
AILLEURS = "ailleurs"
INTROUVABLE = "introuvable"

PHRASES = {
    SUPPRIMEE: "l'image choisie a été supprimée",
    CALQUE: "l'image choisie est devenue un calque",
    DETACHEE: "l'image choisie n'est plus rattachée à ce sujet",
    AILLEURS: "l'image choisie appartient maintenant à un autre sujet",
    INTROUVABLE: "l'image choisie n'existe plus",
}


def raison_perdue(choisie: Asset | None, personnage: str, projet: str) -> str | None:
    """Pourquoi l'image choisie ne peut plus être le portrait — ou `None`
    quand elle le peut. La même condition que `poser_image_de_reference`
    vérifie avant d'écrire, relue à chaque lecture."""
    if choisie is None:
        return INTROUVABLE
    if choisie.supprime_le is not None:
        return SUPPRIMEE
    if choisie.piece:
        return CALQUE
    if not choisie.personnage and (choisie.projet or "") == projet:
        return DETACHEE
    if choisie.personnage != personnage or (choisie.projet or "") != projet:
        return AILLEURS
    return None


@dataclass(frozen=True)
class Portrait:
    """Ce que le sujet montre, et ce que son choix est devenu."""

    asset: Asset | None
    choisi: str = ""
    perdu: str | None = None

    @property
    def identifiant(self) -> str:
        return self.asset.identifiant if self.asset is not None else ""

    @property
    def rattachable(self) -> bool:
        """Le choix a seulement été détaché : le rattacher le rend valide, et
        c'est la réparation que la fiche propose."""
        return self.perdu == DETACHEE

    def perte_en_json(self) -> dict[str, object] | None:
        if self.perdu is None:
            return None
        return {
            "asset": self.choisi,
            "raison": self.perdu,
            "phrase": PHRASES[self.perdu],
            "rattachable": self.rattachable,
        }
