# -*- coding: utf-8 -*-
"""Ce qu'un appel coûte — **mesuré sur ce que cette machine a payé**.

*Une mesure, jamais un tarif ; le coût réel facturé fait foi* — la règle du
produit depuis T1. Ce module est le seul endroit du dépôt qui réponde à la
question « combien va coûter cet appel-là ». Il n'y en a qu'un parce que E13 a
payé le contraire : deux médianes calculées à deux endroits ont annoncé
**$0,0128 et $0,0160 pour le même appel, sur le même écran**, à trois
centimètres l'une de l'autre (`docs/PIEGES.md`).

**Deux chiffres, et le second est ce que E14 ajoute.** La médiane de ce que ce
modèle a facturé, qui répond à *que coûte un appel* ; et la décomposition — un
prix de base, plus un pas par image jointe —, qui répond à *que coûte l'image que
je m'apprête à cocher*. La seconde n'est possible que si la machine a payé des
appels **à plusieurs comptes d'images** : sans ça il n'y a pas de pas à mesurer,
et l'écran dit la médiane seule plutôt que d'inventer un pas.

**Pourquoi la question vaut d'être posée.** Mesuré sur les vingt-quatre images
payées au modèle principal du dépôt le 30 août 2026 : le prix suit le nombre
d'images jointes et rien d'autre — la taille, la qualité et les proportions
étaient les mêmes partout. Aucune image jointe, `$0,0063` ; une, `$0,0139`, soit
**le double** ; deux, `$0,0232`. Sur tout ce qui a été dépensé chez ce modèle,
**48 % sont partis dans les images jointes** — presque la moitié de la facture,
pour une chose qui se coche et se décoche, et qui se cochait sans que rien n'en
dise le prix.

**Ce n'est pas une invitation à les retirer.** Une référence est souvent ce qui
fait revenir la bonne image, et une image ratée coûte cent pour cent. C'est une
invitation à le savoir.
"""

from __future__ import annotations

from typing import Any, Sequence

from atelier.depot import Base
from atelier.domaine.consommation import USD

# Sur combien d'appels la médiane se calcule. Court exprès, comme la fenêtre des
# durées : un modèle dont le prix bouge doit se voir en quelques images, pas en
# cinquante.
FENETRE = 12

# Sur combien d'appels la **décomposition** se calcule. Plus large, et il le
# faut : décomposer demande des appels à plusieurs comptes d'images, et douze
# appels récents peuvent très bien n'en porter qu'un seul.
FENETRE_DECOMPOSEE = 60


def _mediane(valeurs: Sequence[float]) -> float:
    triees = sorted(valeurs)
    milieu = len(triees) // 2
    if len(triees) % 2:
        return triees[milieu]
    return (triees[milieu - 1] + triees[milieu]) / 2


def mesures(base: Base, modele: str, unite: str | None = None) -> dict[str, Any]:
    """Ce que ce modèle a consommé ici — **la médiane, l'écart, le compte, le pas**.

    Rend toujours la même forme, y compris quand il n'y a rien à mesurer : le
    prix vaut alors `None`, et l'écran dit qu'il ne sait pas plutôt que
    d'annoncer un chiffre que personne n'a payé.

    `base` et `par_image` sont la décomposition, et **elles peuvent manquer
    ensemble** : il faut au moins un appel sans image jointe pour connaître le
    prix de départ, et au moins un avec pour connaître le pas. `sur_base` et
    `sur_jointes` disent sur combien d'appels chacune repose — un gain annoncé
    sur une mesure unique est un gain **encadré**, et l'écran l'écrit.
    """
    couts = base.couts_mesures(modele)[:FENETRE]
    entier: dict[str, Any] = {
        # **L'unité voyage avec le chiffre, depuis F2.** Un « 1 » annoncé avant
        # un appel ne veut rien dire s'il ne dit pas s'il est un dollar ou un
        # jeton, et les deux écrans qui lisent cette mesure — la barre qui paie
        # et celui qui confirme — l'écrivent tel quel.
        #
        # Trois sources, dans cet ordre : ce que le fournisseur déclare, ce que
        # les appels d'ici ont réellement porté, et l'argent — qui était la
        # seule unité du produit avant la V2.2.
        "unite": unite or base.unite_du_modele(modele) or USD,
        "prix": round(_mediane(couts), 4) if couts else None,
        "bas": round(min(couts), 4) if couts else 0.0,
        "haut": round(max(couts), 4) if couts else 0.0,
        "appels": len(couts),
        "base": None,
        "par_image": None,
        "sur_base": 0,
        "sur_jointes": 0,
    }

    par_compte: dict[int, list[float]] = {}
    for jointes, cout in base.couts_par_references(modele, FENETRE_DECOMPOSEE):
        par_compte.setdefault(max(0, jointes), []).append(cout)
    sans = par_compte.get(0, [])
    if not sans:
        return entier
    depart = _mediane(sans)
    # **Le pas est la moyenne des écarts mesurés**, un par compte d'images
    # connu — c'est pour ça qu'il ne tombe juste sur aucun appel donné : une
    # moyenne n'est le prix de personne. Les écarts négatifs sont gardés : les
    # effacer ferait dire au produit que joindre une image ne coûte jamais rien
    # de moins, ce qui n'est pas mesuré.
    pas = [
        (_mediane(couts_n) - depart) / compte
        for compte, couts_n in sorted(par_compte.items())
        if compte > 0 and couts_n
    ]
    entier["base"] = round(depart, 4)
    entier["sur_base"] = len(sans)
    entier["sur_jointes"] = sum(len(c) for n, c in par_compte.items() if n > 0)
    if pas:
        entier["par_image"] = round(sum(pas) / len(pas), 4)
    return entier


def prix_de(mesure: dict[str, Any], images: int, appels: int = 1) -> float | None:
    """Ce que cet appel-là consommerait, **images jointes comprises**.

    Dans l'unité de `mesure["unite"]`, et l'appelant la transporte avec le
    chiffre : ce module ne met jamais en forme, il compte.

    La décomposition quand elle existe, la médiane sinon. Rendre la médiane en
    repli plutôt que rien est ce qui évite d'avoir deux écrans dont l'un annonce
    un prix et l'autre se tait pour le même appel.

    **Un même chiffre pour la planche et pour la confirmation** : les deux
    écrans passent par ici, donc l'un ne peut plus annoncer ce que l'autre
    dément — c'est la correction du piège payé en écrivant E13.
    """
    if appels <= 0:
        return 0.0
    if mesure.get("base") is not None and mesure.get("par_image") is not None:
        unite = float(mesure["base"]) + float(mesure["par_image"]) * max(0, images)
        return round(max(0.0, unite) * appels, 4)
    if mesure.get("prix") is None:
        return None
    return round(float(mesure["prix"]) * appels, 4)
