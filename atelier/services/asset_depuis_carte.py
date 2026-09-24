# -*- coding: utf-8 -*-
"""TS18 · L'asset d'une carte — celui qui existe déjà, ou une copie neuve.

« Retoucher dans l'atelier », depuis le détail d'une carte image (TS15),
demande un asset : la retouche ne connaît que ça
(`atelier/domaine/asset.py`), jamais une carte (`Carte.fichier`,
`atelier/domaine/carte.py`). Deux cas, et un seul se voit d'ici :

- **la carte porte déjà son asset** — elle a été posée depuis la bibliothèque
  ou fabriquée par la toile (`ServiceUnivers.poser_asset`), et sa `source`
  s'écrit alors `asset:<identifiant>` (`ServiceUnivers.phrase_de_carte` le dit
  déjà : « le seul fil qui remonte jusqu'à `generation.json` ») ; on ouvre
  celui-là, jamais une copie ;
- **sinon** — une image collée ou importée depuis une adresse — on reprend le
  geste de TS2 (`sujet_depuis_carte.py`) : l'image entre en bibliothèque par
  `ServiceGenerations.importer`, **sans** la rattacher à un sujet — ni
  `designer`, ni `regler_personnage`, ni portrait. Retoucher une inspiration
  ne la fait pas encore entrer dans le jeu.

**Jamais de doublon.** La copie ne force rien : la même carte rend les mêmes
octets, donc la même empreinte, et `_deja_importe` (`ServiceGenerations`) rend
l'asset déjà copié au lieu d'en écrire un second — rappelé sur la même carte,
ce module rend toujours le même asset.

Monté après `sujet_depuis_carte` (`atelier/services/__init__.py`), pour la
même raison : compose l'univers et les générations sans qu'aucun des deux
n'apprenne que ce geste-ci existe.
"""

from __future__ import annotations

from typing import Any

from atelier.domaine.carte import IMAGE, PRETE
from atelier.domaine.generation import AUTEUR
from atelier.services.univers import CarteRefusee


class ServiceAssetDepuisCarte:
    def __init__(self, atelier: Any) -> None:
        self.a = atelier

    def de_la_carte(self, projet: str, carte: str) -> dict[str, Any]:
        """L'asset de cette carte-là. `CarteInconnue` si la carte n'existe pas
        (levée par `ServiceUnivers.carte`), `CarteRefusee` si elle n'a pas
        d'image prête — une note, ou une carte encore en attente."""
        objet = self.a.univers.carte(projet, carte)
        if objet.genre != IMAGE or objet.statut != PRETE or not objet.fichier:
            raise CarteRefusee(
                "cette carte n'a pas d'image prête — la retouche demande une image"
            )

        source = (objet.source or "").strip()
        if source.startswith("asset:"):
            existant = self.a.assets.lire(source[len("asset:") :])
            if existant is not None and existant.projet == projet:
                return existant.en_json()

        # Une image collée ou importée depuis une adresse : la copie de TS2,
        # sans sujet. `forcer` n'est pas passé (faux par défaut) : c'est ce qui
        # tient « jamais de doublon » d'un appel à l'autre sur la même carte.
        from atelier.services.sujet_depuis_carte import nom_de_la_carte

        octets, _ = self.a.univers.octets(projet, carte)
        entre = self.a.generations.importer(
            octets,
            f"{nom_de_la_carte(objet)} · carte de la toile",
            projet=projet,
            provenance=AUTEUR,
            origine={"carte": carte, "projet": projet},
        )
        return (entre["asset"] or entre["doublon"])  # type: ignore[return-value]
