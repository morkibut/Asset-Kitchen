# -*- coding: utf-8 -*-
"""Les critères d'acceptation de E0 — la dette du chantier des maquettes.

E0 ne porte aucune user story : elle solde trois choses fausses que le chantier
de `docs/maquettes-v2.1/` a trouvées en lisant le code pour mesurer. Deux
vivent dans l'interface et se vérifient là-bas ; la troisième est ici.

**Ce fichier existe parce qu'un commentaire corrigé ne se garde pas tout seul.**
La phrase fausse — « la quantification force l'alpha à 255 » — a vécu dans le
dépôt jusqu'au 31 août 2026 et elle aurait envoyé le prochain lecteur régler le
liseré clair au mauvais endroit. La réécrire ne suffit pas : rien n'empêcherait
de la réintroduire. Les deux tests ci-dessous tiennent les deux moitiés de la
phrase juste — la quantification ne touche pas la transparence, et c'est le
durcissement qui fabrique le liseré.

**Aucun test de ce fichier n'appelle le fournisseur**, et aucun ne lit un
fichier : ils travaillent sur des tableaux construits à la main, parce que ce
qu'ils vérifient est une propriété de la fonction, pas d'une image.
"""

from __future__ import annotations

import numpy as np

from atelier.domaine.recette import AUCUN, FLOYD, Quantification
from atelier.image.traitement import durcir, quantifier


def _image_a_toutes_les_transparences() -> np.ndarray:
    """Une image qui porte les 256 valeurs de transparence, sur 256 couleurs.

    Le dégradé de couleur et le dégradé d'alpha sont **croisés**, pas parallèles
    : chaque valeur de transparence se présente sur plusieurs couleurs, donc une
    quantification qui abîmerait la transparence en fonction de la couleur — le
    cas qui nous intéresse — ne peut pas passer entre les mailles.
    """
    hauteur, largeur = 16, 16
    rgba = np.zeros((hauteur, largeur, 4), dtype=np.uint8)
    for y in range(hauteur):
        for x in range(largeur):
            rgba[y, x] = (x * 17, y * 17, (x + y) * 8 % 256, (y * largeur + x))
    return rgba


# ── « Un essai gratuit vérifie que la quantification ne modifie aucune valeur
#     de transparence » ──────────────────────────────────────────────────────


def test_la_quantification_ne_touche_aucune_valeur_de_transparence():
    """Les 256 valeurs d'alpha ressortent identiques, tramage ou pas.

    C'est la moitié de la phrase que le commentaire de `SEUIL_ALPHA` niait. Les
    deux régimes de tramage sont essayés parce que le tramage de Floyd-Steinberg
    diffuse l'erreur d'un pixel sur ses voisins : s'il devait déborder sur un
    canal, ce serait sur celui-là.
    """
    entree = _image_a_toutes_les_transparences()

    for tramage in (AUCUN, FLOYD):
        for couleurs in (4, 16, 32):
            sortie = quantifier(
                entree, Quantification(couleurs=couleurs, tramage=tramage)
            )
            assert np.array_equal(sortie[:, :, 3], entree[:, :, 3]), (
                f"la quantification a modifié la transparence "
                f"(tramage {tramage}, {couleurs} couleurs)"
            )

    # Et elle fait bien son travail par ailleurs : sans ça le test passerait
    # aussi sur une fonction qui ne fait rien du tout.
    reduite = quantifier(entree, Quantification(couleurs=4, tramage=AUCUN))
    couleurs_avant = len({tuple(p) for p in entree[:, :, :3].reshape(-1, 3)})
    couleurs_apres = len({tuple(p) for p in reduite[:, :, :3].reshape(-1, 3)})
    assert couleurs_apres < couleurs_avant


def test_le_lisere_clair_nait_du_durcissement_et_pas_ailleurs():
    """Le mécanisme que le commentaire corrigé nomme est bien celui-là.

    Un pixel de contour à peine visible, dont la couleur est déjà celle du fond,
    ressort **opaque de la couleur du fond** dès qu'il passe le seuil — c'est le
    liseré. Sous le seuil il disparaît. Les deux réglages de la passe de
    détourage l'atteignent donc, et rien d'autre.
    """
    # Un pixel, couleur du fond, à demi transparent.
    contour = np.array([[[200, 200, 200, 140]]], dtype=np.uint8)
    alpha = contour[:, :, 3]

    assert durcir(alpha, seuil=128)[0, 0] == 255, (
        "au-dessus du seuil, le pixel devient opaque — c'est le liseré"
    )
    assert durcir(alpha, seuil=200)[0, 0] == 0, (
        "sous le seuil, le pixel part avec le fond — c'est la correction"
    )

    # Et la quantification, elle, laisse ce pixel exactement où il est — c'est
    # pour ça qu'aucun réglage de couleur ne fera jamais disparaître le liseré.
    quantifiee = quantifier(contour, Quantification(couleurs=4, tramage=AUCUN))
    assert quantifiee[0, 0, 3] == 140
