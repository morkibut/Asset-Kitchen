"""SN3 · Une série de tirages, et le jeu de variantes — les règles pures.

**Une série** est N travaux audio ordinaires d'une même demande, chacun sa
graine, liés par l'identifiant de la série. Elle ne porte aucun son : elle
nomme ses tirages, et chaque tirage garde son travail et, une fois rendu, son
son.

**Un jeu de variantes** est un objet du jeu (projet) qui liste des sons par
leur identifiant, dans l'ordre où on les a gardés. Il ne copie rien : un son
reste un objet de la galerie, peut appartenir à plusieurs jeux, et supprimer
un jeu ne supprime aucun son. La forme d'un jeu (champs ci-dessous) est
l'invariant dont héritent la livraison (SN4 : un `AudioStreamRandomizer`),
les sons d'un sujet (SN6) et l'agent (SN12) :

    {"identifiant", "projet", "nom", "famille" | None, "serie" | None,
     "membres": [{"son", "ajoute_le", "rang" | None}], "revision",
     "cree_le", "modifie_le"}

**Les mesures informent, elles ne refusent jamais.** Un son saturé entre dans
un jeu et en sort comme les autres. Seul ce qui ne s'entend pas (fichier
illisible, silence) ou ce que l'auteur a écarté, ou un son qui n'existe plus,
reste hors de `a_livrer` — et reste listé, signalé, jamais retiré en silence.
"""
from __future__ import annotations

from atelier.domaine.erreurs import ErreurAtelier
from atelier.domaine.projet import FAMILLES_SON


class VariantesRefusees(ErreurAtelier):
    code = "variantes_refusees"


# Le nombre de tirages d'une série, par famille (archi-son §4.3) : 8 pour ce
# qui se calcule en secondes, 4 pour ce qui prend une à trois minutes par
# morceau. Une demande sans famille (un workflow collé, AU14) est un bruitage.
TIRAGES_PAR_DEFAUT = {"bruitage": 8, "interface": 8, "ambiance": 8,
                      "musique": 4, "chanson": 4, "jingle": 4, "voix": 4}
assert set(TIRAGES_PAR_DEFAUT) == set(FAMILLES_SON)
TIRAGES_MIN, TIRAGES_MAX = 1, 16
NOM_MAX = 120


def tirages_par_defaut(famille):
    return TIRAGES_PAR_DEFAUT.get(famille, 8)


def nombre_de_tirages(nombre, famille):
    if nombre is None:
        return tirages_par_defaut(famille)
    if isinstance(nombre, bool) or not isinstance(nombre, int) or not TIRAGES_MIN <= nombre <= TIRAGES_MAX:
        raise VariantesRefusees(f"Choisissez entre {TIRAGES_MIN} et {TIRAGES_MAX} tirages.")
    return nombre


def nom_valide(nom):
    if not isinstance(nom, str) or not nom.strip():
        raise VariantesRefusees("Donnez un nom au jeu de variantes.")
    return nom.strip()[:NOM_MAX]


def famille_du_jeu(famille):
    if famille is not None and famille not in FAMILLES_SON:
        raise VariantesRefusees("Famille de sons inconnue : " + ", ".join(FAMILLES_SON) + ".")
    return famille


def identifiant_valide(identifiant, quoi="Ce son"):
    if not isinstance(identifiant, str) or len(identifiant) != 32 or any(c not in "0123456789abcdef" for c in identifiant):
        raise VariantesRefusees(f"{quoi} n'existe pas dans ce jeu.")
    return identifiant


def statut_membre(son, famille_du_jeu_):
    """Ce que le jeu dit d'un de ses sons. `son` est la lecture de
    `atelier.sons.lire`, ou None si le son n'existe plus. Rien ici ne
    retire un membre : le statut se montre, l'auteur décide.

    Le statut lit `pret` — recalculé à la lecture (`ServiceSons.lire`) depuis
    les mesures, jamais une saturation ancienne écrite sur le disque avant la
    correction du 18 septembre 2026 : un son gardé « à vérifier » pour la
    seule saturation redevient prêt ici comme partout ailleurs."""
    if son is None:
        return {"statut": "supprime", "a_livrer": False,
                "signal": "Ce son n'existe plus dans la galerie. Il reste listé tant que vous ne le retirez pas."}
    mesures = son.get("mesures") or {}
    sature = bool(mesures.get("ecretes"))
    if son.get("jugement") == "ecartee":
        statut, a_livrer, signal = "ecarte", False, "Cette version a été écartée : elle ne partira pas avec le jeu."
    elif not mesures:
        statut, a_livrer, signal = "illisible", False, son.get("raison") or "Ce son n'a pas pu être lu."
    elif not son.get("pret"):
        statut, a_livrer, signal = "silencieux", False, son.get("raison") or "Ce son n'a pas pu être lu."
    else:
        statut, a_livrer, signal = "present", True, "Ce son sature : il reste dans le jeu, à vous de décider." if sature else ""
    retour = {"statut": statut, "a_livrer": a_livrer, "signal": signal, "sature": sature}
    if famille_du_jeu_ is not None and son.get("famille") not in (None, famille_du_jeu_):
        retour["signal"] = (retour["signal"] + " " if retour["signal"] else "") + \
            f"Ce son est de la famille « {son['famille']} », le jeu de la famille « {famille_du_jeu_} »."
        retour["famille_differente"] = True
    return retour
