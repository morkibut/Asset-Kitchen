"""SN7 · Le son calé sur l'animation — les règles pures.

**Un repère sonore** dit « cette bande joue ce son à cette image » : il est
posé sur **une image d'une bande** (une animation d'un sujet, dans une
direction) et désigne **un emplacement du sujet** (SN6), donc un son seul ou
un jeu de variantes.

La forme, dont SN12 hérite (l'agent pose un repère par MCP) :

    dans le fichier des sons du sujet (`atelier.domaine.sons_du_sujet`) :
    {"reperes": [{"bande": "<identifiant de la bande>", "image": 3,
                  "cle": "<clé de l'emplacement>", "pose_le": float}, ...]}

- **L'image est un numéro, compté depuis 1**, comme l'écran l'affiche
  (« image 3 : pas ») : la troisième image de la bande. Jamais un temps : la
  cadence ne sert qu'à la livraison et à la salle d'essai, lue au moment où
  elles jouent. Changer la cadence d'une bande garde donc le repère sur la
  même image.
- **Il est attaché à la bande par son identifiant.** Corriger la bande
  (cadence, sens, prises) garde son identifiant, donc ses repères ; une autre
  version de la même marche est une autre bande, sans repère.
- **Une image peut porter plusieurs emplacements** (des pas et un cliquetis) ;
  un même emplacement ne s'y pose qu'une fois.
- **En aller-retour, une image se joue deux fois par tour** (sauf les deux
  bouts) : le repère sonne à chaque passage, dans la salle d'essai comme
  dans Godot.
"""
from __future__ import annotations

from atelier.domaine.sons_du_sujet import SonsDuSujetRefuses, cle_valide


class RepereRefuse(SonsDuSujetRefuses):
    code = "repere_sonore_refuse"


def repere_valide(brut) -> tuple[str, int, str]:
    """`{bande, image, cle}` → le triplet, ou un refus lisible."""
    if not isinstance(brut, dict) or set(brut) - {"bande", "image", "cle"}:
        raise RepereRefuse("Un repère sonore se pose avec une bande, une image et un emplacement, rien d'autre.")
    bande, image, cle = brut.get("bande"), brut.get("image"), brut.get("cle")
    if not isinstance(bande, str) or not bande:
        raise RepereRefuse("Choisissez l'animation où poser le repère.")
    if isinstance(image, bool) or not isinstance(image, int) or image < 1:
        raise RepereRefuse("Le numéro d'image commence à 1.")
    try:
        cle_valide(cle)
    except SonsDuSujetRefuses as e:
        raise RepereRefuse(e.raison) from e
    return bande, image, cle


def temps_de_l_image(image: int, ordre: list[int], duree_image_ms: int) -> list[float]:
    """Les instants, en secondes depuis le début d'un tour, où l'image
    numéro `image` (comptée depuis 1) est montrée. `ordre` est celui que la
    livraison écrit dans les SpriteFrames (`aseprite.ordre_des_images`) et
    `duree_image_ms` le seul arrondi de la cadence (`aseprite.duree_en_ms`) :
    le temps d'une clé est celui où Godot montre cette image-là."""
    return [position * duree_image_ms / 1000 for position, case in enumerate(ordre) if case == image - 1]
