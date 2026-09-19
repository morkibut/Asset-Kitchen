"""SN6 · Les sons d'un sujet — les règles pures.

**Un emplacement** est une place nommée dans les sons d'un sujet : *pas*,
*attaque*, *coup reçu*, *mort*, *réplique* pour un personnage ; *ramasser*,
*utiliser* pour un objet ; *ambiance* pour un décor ; *clic*, *survol*… pour
un élément d'interface. Il porte une famille de sons (celle qui décide du
moteur, du format livré et du préfixe du nom stable) et, rempli, **un
contenu** : un jeu de variantes, ou un son seul, désigné par son identifiant.

La forme dont héritent SN7 (le repère sonore désigne un emplacement par
`{sujet, cle}`), SN11 (la réplique d'un personnage est un emplacement de la
famille « voix ») et SN12 (l'agent demande une série sur un emplacement) :

    un fichier par sujet :
    {"projet", "sujet", "revision", "modifie_le",
     "emplacements": {"<cle>": {"cle", "nom", "famille", "libre": bool,
                                "contenu": {"nature": "jeu" | "son", "identifiant"} | None,
                                "series": [identifiants, du plus ancien au plus récent],
                                "pose_le": float | None}},
     "reperes": [{"bande", "image", "cle", "pose_le"}]}   (SN7, `reperes_sonores`)

- **Les emplacements proposés ne s'écrivent pas** tant qu'ils sont vides :
  ils viennent de la famille du sujet (lue dans son type, comme partout).
  Seuls s'écrivent un emplacement rempli, un emplacement qui a lancé une
  série, et un emplacement nommé à la main (`libre`).
- **Le son reste un objet du jeu.** Un emplacement désigne ; il ne copie rien,
  ne supprime rien. Un son sans sujet reste un son du jeu, dans la galerie ;
  vider un emplacement ne retire rien de la galerie.
- **Le nom stable** d'un emplacement (`sfx_pelerin_pas`) vient du sujet et de
  la clé de l'emplacement, sans article : c'est lui que la livraison du sujet
  donne à ses sons, et celui que prend le jeu de variantes formé depuis
  l'emplacement.
"""
from __future__ import annotations

import re
import unicodedata

from atelier.domaine.erreurs import ErreurAtelier
from atelier.domaine.son import FAMILLES_SON


class SonsDuSujetRefuses(ErreurAtelier):
    code = "sons_du_sujet_refuses"


# (clé, nom à l'écran, famille de sons, mot pour le moteur). Le mot pour le
# moteur est l'emplacement dit en anglais — les moteurs sonores comprennent
# l'anglais : il ouvre le texte proposé, qui se montre et se corrige avant
# l'envoi. Un emplacement nommé à la main n'en a pas : son nom part tel quel.
PROPOSES = {
    "personnages": (
        ("pas", "Pas", "bruitage", "footsteps"),
        ("attaque", "Attaque", "bruitage", "attack swing"),
        ("coup_recu", "Coup reçu", "bruitage", "taking a hit"),
        ("mort", "Mort", "bruitage", "death, body falls"),
        ("replique", "Réplique", "voix", None),
    ),
    "objets": (
        ("ramasser", "Ramasser", "bruitage", "picking up"),
        ("utiliser", "Utiliser", "bruitage", "using"),
    ),
    "decors": (
        ("ambiance", "Ambiance", "ambiance", "ambience"),
    ),
    "interface": (
        ("clic", "Clic", "interface", None),
        ("survol", "Survol", "interface", None),
        ("validation", "Validation", "interface", None),
        ("erreur", "Erreur", "interface", None),
    ),
}
NOM_MAX = 60
_ARTICLES = re.compile(r"^(le|la|les|l')\s*", re.IGNORECASE)


def ascii_bas(texte):
    ascii_ = unicodedata.normalize("NFKD", str(texte)).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", "_", ascii_).strip("_")


def proposes(famille_sujet):
    """Les emplacements que la famille du sujet propose, dans leur ordre."""
    return [{"cle": c, "nom": n, "famille": f, "indice": i} for c, n, f, i in PROPOSES.get(famille_sujet, ())]


def cle_de(nom):
    cle = ascii_bas(nom)[:NOM_MAX].strip("_")
    if not cle:
        raise SonsDuSujetRefuses("Donnez un nom à l'emplacement, avec au moins une lettre ou un chiffre.")
    return cle


def nom_valide(nom):
    if not isinstance(nom, str) or not nom.strip():
        raise SonsDuSujetRefuses("Donnez un nom à l'emplacement.")
    propre = " ".join(nom.split())[:NOM_MAX]
    return propre[:1].upper() + propre[1:]


def famille_valide(famille):
    if famille not in FAMILLES_SON:
        raise SonsDuSujetRefuses("Choisissez une famille de sons : " + ", ".join(FAMILLES_SON) + ".")
    return famille


def cle_valide(cle):
    if not isinstance(cle, str) or not re.fullmatch(r"[a-z0-9_]{1,60}", cle):
        raise SonsDuSujetRefuses("Cet emplacement n'existe pas pour ce sujet.")
    return cle


def sujet_court(nom):
    """Le nom du sujet sans son article : « Le pèlerin » → « pelerin »."""
    court = ascii_bas(_ARTICLES.sub("", str(nom).strip()))
    return court or ascii_bas(nom) or "sujet"


def base_stable(nom_sujet, cle):
    """Le corps du nom stable d'un emplacement, sans préfixe de famille :
    `pelerin_pas`. `atelier.services.sons.nom_stable` y pose le préfixe."""
    return f"{sujet_court(nom_sujet)}_{cle}"


def texte_propose(description, nom_sujet, emplacement):
    """Le texte qu'on propose pour une série depuis cet emplacement, et ses
    morceaux avec leur origine — rien n'est traduit ni réécrit : le mot pour
    le moteur de l'emplacement (ou son nom), puis la description du sujet
    telle qu'elle est écrite (ou son nom, s'il n'est pas décrit). L'écran le
    montre dans la case de la demande, où il se corrige avant l'envoi."""
    tete = emplacement.get("indice") or emplacement["nom"]
    corps = (description or "").strip() or str(nom_sujet).strip()
    morceaux = [{"texte": tete, "source": "emplacement"}]
    if corps:
        morceaux.append({"texte": corps, "source": "sujet"})
    return ", ".join(m["texte"] for m in morceaux), morceaux
