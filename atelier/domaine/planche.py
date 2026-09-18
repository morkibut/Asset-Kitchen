# -*- coding: utf-8 -*-
"""La planche revenue, vue comme une image de la bibliothèque (G16).

**Ce fichier existe pour une seule raison : il n'y a qu'un endroit qui décide
de ce qu'est la planche en tant qu'asset.** Trois chemins la font entrer — le
dépliage d'un lot de corps, celui d'une planche d'équipement, et le rattrapage
qui range les planches arrivées avant que ce code n'existe. Trois constructions
écrites à trois endroits auraient fini par donner trois images qui ne se
ressemblent plus : l'une avec son coût, l'autre sans, la troisième avec une
recette de projet qui la mettrait sur grille.

**Elle n'est pas un morceau de planche, et elle n'est pas un sprite.** Sa
recette est **vide**, et c'est une décision, pas un oubli : la mettre sur la
grille du jeu, réduire ses couleurs ou détourer son fond reviendrait à traiter
une feuille de contact comme une image du jeu. Une recette vide veut dire *ce
qui est montré est le fichier tel qu'il est arrivé* — exactement ce qu'on vient
chercher en l'ouvrant. C'est aussi ce qui la fait s'afficher par l'adresse de
son emplacement plutôt que par un rendu, sans une ligne de code de plus.

**Elle porte le coût de l'appel, et ses morceaux ne portent rien.** L'inverse
serait faux dans les deux sens : l'argent a été dépensé une fois, pour cette
image-là, et les N images qui en sortent n'ont rien coûté séparément. Le total
d'un projet se calcule sur les générations, jamais sur la somme des assets —
aucun double compte n'est donc possible.

**Elle n'a ni pose ni pièce, et c'est ce qui la tient hors de la matrice.** La
matrice d'un personnage se construit sur `pose`, et une image sans pose y est
sautée : la planche n'apparaît donc dans aucune case, ne compte dans aucune
jauge, et ne peut pas se faire prendre pour un corps. Elle garde en revanche
son **personnage**, qui est un fait sur ce qui a été demandé.

**Ce qu'elle renverse.** *Le pliage est une ruse d'appel, jamais un format de
livraison* (C2) tombe ici : une planche devient une image du produit, elle se
voit et elle s'exporte. Le renversement était prévu pour `P1` ; `G16` en prend
la première moitié — voir —, et laisse à `P1` la seconde — redécouper.
"""

from __future__ import annotations

from atelier.domaine.asset import Asset, identifiant_de
from atelier.domaine.generation import Emplacement, Generation
from atelier.domaine.recette import Recette


def label_de_planche(generation: Generation, cases: int) -> str:
    """« planche 4 cases · un pèlerin encapuchonné ».

    Le compte d'abord, parce que c'est ce qui distingue une planche de tout le
    reste de la grille au premier coup d'œil ; le sujet ensuite, parce que c'est
    le mot que l'auteur cherchera. Même convention que partout : soixante signes,
    et le sujet plutôt que le prompt — la bible du jeu se replie en tête du
    prompt, et toutes les planches d'un même jeu porteraient sinon le même nom.
    """
    demande = generation.demande
    sujet = str(demande.get("sujet") or demande.get("prompt") or "").strip()
    tete = f"planche {cases} case{'s' if cases > 1 else ''}"
    return f"{tete} · {sujet}"[:60] if sujet else tete


def asset_de_planche(
    generation: Generation, emplacement: Emplacement
) -> Asset | None:
    """La planche d'un lot, en asset — ou `None` s'il n'y a rien à ranger.

    **Aucun fichier n'est écrit ici.** La planche est déjà sur le disque depuis
    son arrivée, à l'adresse que l'emplacement porte ; lui en écrire une copie
    doublerait chaque lot payé sur le disque pour montrer deux fois la même
    image.
    """
    resultat = emplacement.resultat
    pliage = generation.pliage
    if resultat is None or pliage is None:
        return None

    return Asset(
        identifiant=identifiant_de(generation.identifiant, emplacement.rang),
        generation=generation.identifiant,
        rang=emplacement.rang,
        brut=resultat.fichier,
        largeur=resultat.largeur,
        hauteur=resultat.hauteur,
        type_media=resultat.type_media,
        label=label_de_planche(generation, len(pliage.cases)),
        # **Vide, et c'est le cœur de la décision.** Voir plus haut.
        recette=Recette(),
        # **Le coût de l'appel est ici**, et nulle part ailleurs dans la
        # descendance de ce lot.
        consomme=emplacement.consomme,
        unite=emplacement.unite,
        provenance=generation.provenance,
        modele=generation.modele,
        projet=generation.projet,
        # De qui elle parle — sans dire de quelle pose, puisqu'elle les porte
        # toutes. C'est cette absence qui la garde hors de la matrice.
        personnage=generation.personnage,
        pose=None,
        piece=None,
        # **Datée du lot**, comme les images qui en sortent : elles sont
        # arrivées ensemble, et le rang les départage.
        cree_le=generation.cree_le,
    )


# ── La planche refaite (RS2), corrigée le 18 septembre 2026 ─────────────────
#
# **L'autre planche du produit, et elle n'arrive pas par un pliage.** Une image
# fixe qui « refait une planche » (`garder_mise_en_page`) rend UNE image où
# vivent plusieurs vues du sujet — quatre Champy en 2 × 2 sur 1024 px. Elle
# naissait comme une image seule, donc avec la recette complète du projet : la
# grille du jeu s'appliquait à **la feuille entière**, et l'auteur recevait
# quatre Champy de vingt pixels, sur-pixellisés, dans un sprite de 96. Signalé
# par l'auteur le 18 septembre 2026.


def est_une_planche_refaite(generation: Generation, rang: int) -> bool:
    """Cette image-là est-elle la feuille d'un appel « refaire une planche » ?

    **La feuille, pas ses morceaux** : les deux vivent dans la même génération
    — la découpe range ses morceaux au-dessus des emplacements, dans la
    génération de leur planche —, et seuls les rangs d'emplacement sont des
    images rendues par le modèle. Un morceau qu'on redécoupe n'est donc pas une
    planche refaite, et hérite comme n'importe quelle image.

    Le drapeau se lit sur la génération, où il n'est écrit que vrai : c'est
    elle qui survit à l'effacement de l'index, et qu'une relance relit.
    """
    if not generation.demande.get("garder_mise_en_page"):
        return False
    return any(e.rang == rang for e in generation.emplacements)


def recette_de_planche_refaite(du_projet: Recette) -> Recette:
    """Ce que le projet impose à une feuille entière : **son détourage, seul**.

    - **Pas de grille**, et c'est la panne réparée : la grille met *un* sujet à
      l'échelle de *sa* case ; posée sur une feuille, elle y met quatre sujets
      à la fois.
    - **Pas de recadrage** : rogné à la boîte opaque de l'ensemble, le rendu ne
      serait plus aux coordonnées du brut, où la découpe trace ses rectangles.
    - **Pas de quantification.** Dans `Univers.recette_de`, elle n'entre
      qu'avec la grille : un nombre fini de couleurs est ce qui fait un sprite
      *à sa taille de sprite*. Sur 1024 px non réduits, elle posterise un
      dessin — l'« affiche sérigraphiée » que le même texte refuse au style
      dessin. Les morceaux, eux, se quantifient après leur propre grille.
    - **Le détourage reste**, et c'est ce qui la sépare de la planche d'un lot
      (recette vide, plus haut) : celle-ci est une ruse d'appel qu'on regarde
      pour la découper, la planche refaite est l'image que l'auteur a
      *demandée* — sa feuille de personnage, qui se range comme référence et se
      montre sur fond transparent comme les autres images du sujet. La passe
      est celle d'une image seule, décidée par la silhouette de l'échelle : un
      décor n'en reçoit pas, ici comme ailleurs.
    """
    return Recette(passes=du_projet.passes)
