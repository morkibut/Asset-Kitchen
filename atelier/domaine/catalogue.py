# -*- coding: utf-8 -*-
"""Le catalogue des modèles, tel que le domaine le voit.

**Le catalogue décide, jamais une liste en dur** (`AGENTS.md` § Règles durables).
Ce qu'un modèle sait faire — plafond de références, proportions, résolutions,
réglages propres — vient du fournisseur, relu au démarrage. Rien n'est écrit ici.

Le vocabulaire du fournisseur ne franchit pas son adaptateur : ni `aspect_ratio`,
ni `input_references`, ni `n` n'apparaissent dans ce module. Restent deux choses
opaques, et elles le sont assumées :

- `Modele.identifiant`, une étiquette qu'on transporte et qu'on **ne compare
  jamais à une constante** ;
- `Modele.options`, les réglages qu'un modèle déclare en propre (`quality`,
  `seed`, …). Le domaine les valide contre ce que le catalogue déclare, il ne
  les interprète pas. C'est ce qui permet d'en accueillir un nouveau sans
  toucher au code.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Mapping


@dataclass(frozen=True, slots=True)
class Option:
    """Un réglage propre à un modèle, déclaré par le catalogue."""

    nom: str
    genre: str  # "choix" | "intervalle" | "booleen"
    valeurs: tuple[str, ...] = ()
    minimum: float | None = None
    maximum: float | None = None

    def accepte(self, valeur: Any) -> bool:
        if self.genre == "choix":
            return str(valeur) in self.valeurs
        if self.genre == "intervalle":
            if not isinstance(valeur, (int, float)) or isinstance(valeur, bool):
                return False
            if self.minimum is not None and valeur < self.minimum:
                return False
            if self.maximum is not None and valeur > self.maximum:
                return False
            return True
        if self.genre == "booleen":
            return True
        return False


@dataclass(frozen=True, slots=True)
class Modele:
    """Ce qu'un modèle du catalogue sait faire, en vocabulaire du produit."""

    identifiant: str
    nom: str
    references_max: int = 0
    proportions: tuple[str, ...] = ()
    resolutions: tuple[str, ...] = ()
    variations_max: int = 1
    options: Mapping[str, Option] = field(default_factory=dict)

    # ── Le grisé et sa raison ────────────────────────────────────────────────

    def refus(self, demande: "DemandeLike") -> str | None:
        """La raison, en clair, pour laquelle ce modèle ne peut pas honorer la
        demande — ou `None` s'il le peut.

        C'est cette phrase que l'interface écrit sous le modèle grisé. Le produit
        ne propose jamais pour rejeter ensuite en 400 : ce qui est impossible se
        voit avant d'être choisi (`docs/PLAN.md`, T1).
        """
        nombre = len(demande.references)
        if nombre > self.references_max:
            if self.references_max == 0:
                return "n'accepte aucune image de référence"
            return (
                f"n'accepte que {self.references_max} images de référence, "
                f"il en faudrait {nombre}"
            )

        if demande.proportions and self.proportions:
            if demande.proportions not in self.proportions:
                return f"ne rend pas la proportion {demande.proportions}"

        if demande.resolution and self.resolutions:
            if demande.resolution not in self.resolutions:
                return f"ne rend pas la résolution {demande.resolution}"

        for nom, valeur in demande.options.items():
            option = self.options.get(nom)
            if option is None:
                return f"ne connaît pas le réglage « {nom} »"
            if not option.accepte(valeur):
                return f"n'accepte pas « {nom} = {valeur} »"

        return None

    # ── Ce qui part réellement ───────────────────────────────────────────────

    def retenir(self, voulues: Mapping[str, Any]) -> tuple[dict[str, Any], list[str]]:
        """Ne garde que ce que le modèle déclare accepter, et dit ce qui est écarté.

        Un paramètre non déclaré est **silencieusement ignoré par le
        fournisseur** — mesuré : `output_format: "png"` accepté puis ignoré par
        les Seedream, qui ne rendent que du JPEG. Mieux vaut le savoir avant
        l'appel que le découvrir sur l'image.
        """
        gardees: dict[str, Any] = {}
        ecartees: list[str] = []
        for nom, valeur in voulues.items():
            option = self.options.get(nom)
            if option is None:
                ecartees.append(nom)
                continue
            if not option.accepte(valeur):
                ecartees.append(f"{nom}={valeur}")
                continue
            gardees[nom] = valeur
        return gardees, ecartees


class DemandeLike:
    """Le contrat minimal que `refus` attend. Voir `atelier.domaine.demande`."""

    references: tuple[bytes, ...]
    proportions: str
    resolution: str | None
    options: Mapping[str, Any]


# ── Sérialisation ────────────────────────────────────────────────────────────
# Le catalogue est réécrit sur disque à chaque rafraîchissement, pour servir de
# repli daté quand le fournisseur n'est pas joignable (US-93). C'est cette forme
# qui est écrite, pas la réponse brute du fournisseur : le repli d'un adaptateur
# ne doit pas obliger à en garder le vocabulaire.


def _option_en_json(option: Option) -> dict[str, Any]:
    return {
        "nom": option.nom,
        "genre": option.genre,
        "valeurs": list(option.valeurs),
        "minimum": option.minimum,
        "maximum": option.maximum,
    }


def _option_depuis_json(d: dict[str, Any]) -> Option:
    return Option(
        nom=d["nom"],
        genre=d["genre"],
        valeurs=tuple(d.get("valeurs", ())),
        minimum=d.get("minimum"),
        maximum=d.get("maximum"),
    )


def modele_en_json(modele: Modele) -> dict[str, Any]:
    return {
        "identifiant": modele.identifiant,
        "nom": modele.nom,
        "references_max": modele.references_max,
        "proportions": list(modele.proportions),
        "resolutions": list(modele.resolutions),
        "variations_max": modele.variations_max,
        "options": {n: _option_en_json(o) for n, o in modele.options.items()},
    }


def modele_depuis_json(d: dict[str, Any]) -> Modele:
    return Modele(
        identifiant=d["identifiant"],
        nom=d.get("nom", d["identifiant"]),
        references_max=d.get("references_max", 0),
        proportions=tuple(d.get("proportions", ())),
        resolutions=tuple(d.get("resolutions", ())),
        variations_max=d.get("variations_max", 1),
        options={n: _option_depuis_json(o) for n, o in (d.get("options") or {}).items()},
    )
