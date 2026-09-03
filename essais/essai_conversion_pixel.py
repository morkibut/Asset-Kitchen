# -*- coding: utf-8 -*-
"""Le banc visuel de D2 — cinq façons de faire un sprite, côte à côte.

Écrit le 3 septembre 2026 sur une idée de l'auteur : *« je peux te donner un
visuel de personnage et tu essaies plusieurs méthodes, et je te dis laquelle rend
le mieux »*. C'est la bonne méthode : aucune mesure automatique ne dit ce qui est
beau, et la tranche précédente a montré qu'une mesure non croisée raconte
l'histoire de la variable qu'on a regardée.

**Il ne coûte rien.** Il relit des images déjà sur le disque, tout se calcule sur
le processeur, aucune clé n'est lue, aucun appel ne sort de la machine.

## Ce que le banc a trouvé avant même de commencer

Les deux jeux du dépôt ne posent **pas le même problème**, et c'est ce qui rend
une méthode unique impossible :

- **une peinture détaillée** (le nain de *cœur de pierre*) : le modèle a reçu la
  consigne « pixel art » et a rendu une illustration peinte. Il n'y a **aucune
  grille à retrouver** — il faut *convertir*, c'est-à-dire décider soi-même où
  tombent les blocs ;
- **du faux pixel art** (le porteur de torche de *test v2*) : les blocs sont là,
  visibles, presque réguliers. Il faut les *retrouver* et s'y caler, pas en
  inventer d'autres.

La revue externe range ces deux cas dans deux chaînes distinctes — son *pipeline
A* et son *pipeline B* — et c'est la première chose que le produit doit savoir
faire : **dire dans lequel des deux il est**.

    Lancer :  py essais/essai_conversion_pixel.py
              py essais/essai_conversion_pixel.py --cible 64

Sortie : une page à ouvrir dans le navigateur, `essais/resultats/conversion-pixel.html`,
où chaque méthode est montrée en grand à côté des autres.
"""

from __future__ import annotations

import argparse
import base64
import io
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

RACINE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RACINE))

from atelier.image.traitement import boite_opaque, detourer  # noqa: E402
from atelier.domaine.recette import BORD, Passe, Recette  # noqa: E402


# ── Les images d'épreuve ─────────────────────────────────────────────────────

EPREUVES = (
    (
        "Le nain — un dessin fin, sans aucun carré",
        "Jeu « cœur de pierre ». Tu as demandé du pixel art ; le modèle a rendu une "
        "illustration peinte, avec des dégradés et des détails minuscules. Il n'y a "
        "aucun carré à récupérer : il faut en fabriquer.",
        "generations/058b04b0d8364461b8eb5d06c1f42565/0-brut.png",
    ),
    (
        "Le porteur de torche — des carrés déjà là",
        "Jeu « test v2 ». Ici le modèle a joué le jeu : les carrés sont visibles et "
        "réguliers. Il ne faut pas en fabriquer d'autres, il faut retrouver les "
        "siens et se caler dessus.",
        "generations/1b2da0b988c649d68d8a3dd3c9c3c58f/0-brut.png",
    ),
)


def _sujet(chemin: Path) -> np.ndarray:
    """L'image détourée et recadrée sur son sujet — le point de départ commun.

    Les cinq méthodes partent **exactement de là**, sans quoi on comparerait des
    cadrages autant que des réductions.
    """
    octets = chemin.read_bytes()
    rgba = detourer(Recette(passes=(Passe(moteur=BORD),)), octets)
    boite = boite_opaque(rgba[:, :, 3])
    if boite is None:
        return rgba
    x0, y0, x1, y1 = boite
    return rgba[y0 : y1 + 1, x0 : x1 + 1]


# ── Les cinq façons ──────────────────────────────────────────────────────────


def au_plus_proche(rgba: np.ndarray, cible: int) -> np.ndarray:
    """**Ce que l'atelier fait aujourd'hui.**

    Il prend un point sur N et jette les autres. Sur une image de 1024 ramenée à
    128, c'est un point gardé sur huit : sept pixels sur huit ne participent pas
    du tout à la couleur qui sort, et lequel des huit gagne dépend de l'endroit
    où le rectangle est tombé — donc ça change entre deux images du même
    personnage.
    """
    return _cadrer(rgba, cible, Image.Resampling.NEAREST)


def par_moyenne(rgba: np.ndarray, cible: int) -> np.ndarray:
    """La moyenne de tous les points d'une case.

    Tous les pixels participent, donc rien n'est jeté. **Mais la moyenne fabrique
    des couleurs qui n'existent nulle part** : entre un brun et un noir, elle
    invente un brun sombre. C'est l'origine du flou qu'on voit sur les bords.
    """
    return _cadrer(rgba, cible, Image.Resampling.BOX)


def par_vote(rgba: np.ndarray, cible: int) -> np.ndarray:
    """**La couleur la plus fréquente de la case, prise telle quelle.**

    Aucune couleur n'est inventée : celle qui sort est celle qu'un pixel portait
    vraiment. Les aplats restent des aplats et les contours restent nets.

    Son défaut est l'inverse de la moyenne : sur un dégradé, chaque case a une
    couleur dominante différente et le résultat *saute*.
    """
    return _par_case(rgba, cible, deux_temps=False)


def par_vote_en_deux_temps(rgba: np.ndarray, cible: int) -> np.ndarray:
    """**Le vote, mais sur des couleurs d'abord regroupées** (revue externe, idée 1).

    En deux temps, et c'est toute la finesse :

    1. l'image est d'abord ramenée à une trentaine de couleurs, *seulement pour
       décider de la forme* — ainsi, sur un dégradé, tous les pixels voisins
       tombent dans le même groupe et le vote cesse de sauter ;
    2. la couleur qui sort est **la moyenne des pixels d'origine** qui portaient
       le groupe gagnant — donc on récupère la vraie nuance, pas la couleur
       approchée du regroupement.

    C'est ce que fait l'outil le plus abouti du domaine (*pixel-art-fixer*, MIT),
    et la revue le résume ainsi : *on obtient les lignes nettes d'un « snapper »
    sans sa perte de couleurs.*
    """
    return _par_case(rgba, cible, deux_temps=True)


def sur_le_pas_trouve(rgba: np.ndarray, cible: int) -> np.ndarray:
    """Se caler sur la grille du modèle, puis remplir la case demandée.

    Quand le modèle **a** dessiné sur une grille, s'y caler est ce qui donne des
    blocs parfaitement nets. Le sprite sort alors à la taille que cette grille
    donne, et il est reposé au plus proche dans la case demandée.

    **Sur une peinture, il n'y a pas de grille** : la méthode retombe alors sur le
    vote en deux temps, et c'est la bonne réponse — inventer une grille là où le
    modèle n'en a mis aucune ne rend service à personne.
    """
    pas = _pas_du_modele(rgba)
    if pas < 2:
        return par_vote_en_deux_temps(rgba, cible)
    hauteur, largeur = rgba.shape[:2]
    cases = max(1, round(max(hauteur, largeur) / pas))
    aligne = _par_case(rgba, cases, deux_temps=True, carre=False)
    return _cadrer(aligne, cible, Image.Resampling.NEAREST)


METHODES = {
    "aujourd'hui": au_plus_proche,
    "moyenne": par_moyenne,
    "vote": par_vote,
    "vote en deux temps": par_vote_en_deux_temps,
    "sur le pas trouvé": sur_le_pas_trouve,
}


# ── La mécanique ─────────────────────────────────────────────────────────────


def _cadrer(rgba: np.ndarray, cible: int, filtre) -> np.ndarray:
    """Le sujet ramené à `cible`, proportions gardées, posé dans une case carrée."""
    image = Image.fromarray(rgba, mode="RGBA")
    facteur = cible / max(image.width, image.height)
    taille = (
        max(1, min(cible, round(image.width * facteur))),
        max(1, min(cible, round(image.height * facteur))),
    )
    reduit = image.resize(taille, filtre)
    toile = Image.new("RGBA", (cible, cible), (0, 0, 0, 0))
    toile.paste(reduit, ((cible - reduit.width) // 2, cible - reduit.height))
    return np.asarray(toile)


def _etiquettes(rgba: np.ndarray, couleurs: int = 32) -> np.ndarray:
    """L'image ramenée à quelques couleurs — **pour décider de la forme seulement**.

    On ne garde jamais ces couleurs-là : elles servent à dire *quels pixels vont
    ensemble*, et la nuance revient ensuite des pixels d'origine.
    """
    plat = Image.fromarray(rgba[:, :, :3], mode="RGB")
    reduit = plat.quantize(colors=couleurs, method=Image.Quantize.MEDIANCUT)
    return np.asarray(reduit, dtype=np.int32)


def _par_case(
    rgba: np.ndarray, cible: int, *, deux_temps: bool, carre: bool = True
) -> np.ndarray:
    """Une couleur par case, décidée par vote — en un temps ou en deux."""
    hauteur, largeur = rgba.shape[:2]
    facteur = cible / max(hauteur, largeur)
    cases_h = max(1, min(cible, round(hauteur * facteur)))
    cases_l = max(1, min(cible, round(largeur * facteur)))

    # Les frontières de cases dans l'image d'origine — réparties, jamais
    # arrondies à un pas entier : une image de 517 px en 64 cases donne des cases
    # de 8,08 px, et forcer 8 laisserait 5 px orphelins au bord.
    bornes_y = np.linspace(0, hauteur, cases_h + 1).round().astype(int)
    bornes_x = np.linspace(0, largeur, cases_l + 1).round().astype(int)

    etiquettes = _etiquettes(rgba) if deux_temps else None
    sortie = np.zeros((cases_h, cases_l, 4), dtype=np.uint8)
    for j in range(cases_h):
        for i in range(cases_l):
            bloc = rgba[bornes_y[j] : bornes_y[j + 1], bornes_x[i] : bornes_x[i + 1]]
            if bloc.size == 0:
                continue
            sortie[j, i] = _couleur_de_la_case(
                bloc,
                None
                if etiquettes is None
                else etiquettes[
                    bornes_y[j] : bornes_y[j + 1], bornes_x[i] : bornes_x[i + 1]
                ],
            )
    if not carre:
        return sortie
    toile = Image.new("RGBA", (cible, cible), (0, 0, 0, 0))
    morceau = Image.fromarray(sortie, mode="RGBA")
    toile.paste(morceau, ((cible - cases_l) // 2, cible - cases_h))
    return np.asarray(toile)


def _couleur_de_la_case(bloc: np.ndarray, etiquettes: np.ndarray | None) -> np.ndarray:
    """La couleur d'une case, et **son opacité décidée à la majorité**.

    L'alpha ne se moyenne pas : une case à moitié transparente n'existe pas en
    pixel art. Elle est dedans ou dehors, et c'est la majorité qui tranche. C'est
    l'idée 12 de la revue, et c'est aussi ce qui supprime le halo qu'une moyenne
    laisse tout autour du sujet.
    """
    opaque = bloc[:, :, 3] >= 128
    if opaque.mean() < 0.5:
        return np.zeros(4, dtype=np.uint8)

    dedans = bloc[opaque]
    if etiquettes is None:
        # Un temps : la couleur exacte la plus fréquente.
        couleurs, comptes = np.unique(
            dedans[:, :3].reshape(-1, 3), axis=0, return_counts=True
        )
        gagnante = couleurs[int(np.argmax(comptes))]
        return np.array([*gagnante, 255], dtype=np.uint8)

    # Deux temps : le groupe le plus fréquent décide, les pixels d'origine de ce
    # groupe donnent la nuance.
    groupes = etiquettes[opaque]
    valeurs, comptes = np.unique(groupes, return_counts=True)
    gagnant = valeurs[int(np.argmax(comptes))]
    nuance = dedans[groupes == gagnant][:, :3].mean(axis=0).round()
    return np.array([*nuance.astype(np.uint8), 255], dtype=np.uint8)


#: En dessous, il n'y a **pas de grille du tout** et il ne faut pas en inventer.
#:
#: Mesuré le 3 septembre 2026 sur les deux images d'épreuve, et la séparation est
#: franche : **0,12 pour la peinture du nain, 0,69 pour le porteur de torche**.
#: Rien entre les deux. Le seuil est posé au milieu du vide, comme celui de R6.
PEIGNE_MINIMAL = 0.35


def _peigne(profil: np.ndarray, pas: int) -> float:
    """**Les arêtes tombent-elles sur les multiples du pas, ou n'importe où ?**

    C'est la mesure qui distingue une vraie grille d'une image simplement lisse,
    et c'est celle qui manquait au produit. On compare la quantité de contraste
    posée sur les **dents** du peigne — les positions multiples du pas — à celle
    posée entre elles, un demi-pas plus loin. Sur une grille, presque tout le
    contraste est sur les dents. Sur une peinture, il est partout, et les deux se
    valent.

    ⚠️ **Sans elle, le détecteur répond « 2 » sur une peinture, et il y croit.**
    L'autocorrélation d'une image lisse décroît doucement depuis le pas de 2 sans
    jamais faire de bosse ; la règle du produit — *le plus petit pas qui approche
    la crête* — attrape alors ce 2, parce qu'il n'a pas de voisin de gauche à qui
    se comparer. Mesuré sur la peinture du nain : autocorrélation 0,83 au pas 2,
    et pas la moindre grille dans l'image.
    """
    meilleur = 0.0
    for phase in range(pas):
        dents = profil[phase::pas]
        creux = profil[(phase + pas // 2) % pas :: pas]
        largeur = min(dents.size, creux.size)
        if largeur < 3:
            continue
        sur, entre = float(dents[:largeur].mean()), float(creux[:largeur].mean())
        if sur + entre > 0:
            meilleur = max(meilleur, (sur - entre) / (sur + entre))
    return meilleur


def _pas_du_modele(rgba: np.ndarray, borne: int = 64) -> int:
    """Le pas de la grille sur laquelle le modèle a peint, ou **zéro s'il n'y en a pas**.

    Trois épreuves, et une seule suffit à recaler tout le reste :

    1. l'autocorrélation propose des candidats — c'est ce que le produit fait
       déjà, sur la somme des canaux plutôt que sur les niveaux de gris ;
    2. le **peigne** dit s'il y a une grille du tout. C'est la nouveauté, et
       c'est elle qui empêche de répondre « 2 » sur une peinture ;
    3. l'**aller-retour** tranche entre un pas et son double, en cherchant la
       phase — sans quoi une image dont la grille ne commence pas au pixel zéro
       fait répondre la moitié du bon pas.
    """
    canaux = rgba.astype(np.float64)
    profils = (
        np.abs(np.diff(canaux, axis=1)).sum(axis=(0, 2)),
        np.abs(np.diff(canaux, axis=0)).sum(axis=(1, 2)),
    )
    candidats: set[int] = set()
    for profil in profils:
        centre = profil - profil.mean()
        variance = float((centre * centre).mean())
        if variance == 0:
            continue
        limite = min(borne, centre.size // 4)
        scores = {
            pas: float((centre[:-pas] * centre[pas:]).mean() / variance)
            for pas in range(2, limite + 1)
        }
        if not scores:
            continue
        crete = max(scores.values())
        if crete < 0.35:
            continue
        for pas in sorted(scores):
            voisines = (scores.get(pas - 1, -1.0), scores.get(pas + 1, -1.0))
            if scores[pas] >= 0.9 * crete and scores[pas] >= max(voisines):
                # **Le peigne a le dernier mot** : un candidat qui ne pose pas son
                # contraste sur ses propres multiples n'est pas une grille.
                if max(_peigne(p, pas) for p in profils) >= PEIGNE_MINIMAL:
                    candidats.update(p for p in (pas, pas * 2) if p <= limite)
                break
    if not candidats:
        return 0
    erreurs = {pas: _erreur_aller_retour(rgba, pas) for pas in candidats}
    plancher = min(erreurs.values())
    return max(pas for pas, erreur in erreurs.items() if erreur <= plancher * 1.2)


def _erreur_aller_retour(rgba: np.ndarray, pas: int) -> float:
    meilleure = 1.0
    hauteur, largeur = rgba.shape[:2]
    for decalage in range(pas):
        h, l = (hauteur - decalage) // pas, (largeur - decalage) // pas
        if h < 2 or l < 2:
            continue
        coupe = rgba[
            decalage : decalage + h * pas, decalage : decalage + l * pas
        ].astype(np.float64)
        blocs = coupe.reshape(h, pas, l, pas, 4).mean(axis=(1, 3))
        reconstruit = np.repeat(np.repeat(blocs, pas, axis=0), pas, axis=1)
        meilleure = min(meilleure, float(np.abs(coupe - reconstruit).mean() / 255.0))
    return meilleure


# ── La page à regarder ───────────────────────────────────────────────────────


def _a_la_hauteur(rgba: np.ndarray, hauteur: int) -> np.ndarray:
    """L'image de départ, ramenée à la hauteur d'affichage des résultats.

    **Elle est réduite en douceur, et c'est exprès** : on la montre pour ce
    qu'elle est — un dessin détaillé —, pas pour la juger comme un sprite. La
    réduire au plus proche voisin ici y ferait apparaître des marches qui
    n'existent pas dans l'original, et l'on comparerait alors deux pixelisations
    au lieu d'une image et ses pixelisations.
    """
    image = Image.fromarray(rgba, mode="RGBA")
    facteur = hauteur / max(image.width, image.height)
    return np.asarray(
        image.resize(
            (max(1, round(image.width * facteur)), max(1, round(image.height * facteur))),
            Image.Resampling.LANCZOS,
        )
    )


def _en_donnees(rgba: np.ndarray, agrandi: int = 1) -> str:
    image = Image.fromarray(rgba, mode="RGBA")
    if agrandi > 1:
        image = image.resize(
            (image.width * agrandi, image.height * agrandi), Image.Resampling.NEAREST
        )
    tampon = io.BytesIO()
    image.save(tampon, format="PNG")
    return "data:image/png;base64," + base64.b64encode(tampon.getvalue()).decode()


def _page(sections: list[dict], cible: int) -> str:
    blocs = []
    for section in sections:
        vignettes = "".join(
            f'<figure class="{"depart" if v["depart"] else ""}">'
            f'<img src="{v["image"]}" alt="{v["nom"]}">'
            f'<figcaption><b>{v["nom"]}</b><span>{v["note"]}</span></figcaption>'
            "</figure>"
            for v in section["vignettes"]
        )
        blocs.append(
            f'<section><h2>{section["titre"]}</h2>'
            f'<p class="quoi">{section["quoi"]}</p>'
            f'<div class="rangee">{vignettes}</div></section>'
        )
    return f"""<!doctype html>
<html lang="fr"><meta charset="utf-8">
<title>Cinq façons de fabriquer un sprite</title>
<style>
  :root {{ color-scheme: dark; }}
  body {{ margin:0; padding:28px 32px; background:#141416; color:#e8e6e3;
         font:14px/1.6 ui-sans-serif,system-ui,sans-serif; }}
  h1 {{ font-size:23px; margin:0 0 10px; font-weight:600; }}
  .intro {{ max-width:74ch; color:#b4b1ad; margin:0 0 8px; }}
  .intro b {{ color:#e8e6e3; }}
  .gratuit {{ max-width:74ch; color:#8d8a86; font-size:12.5px; margin:0 0 30px; }}
  h2 {{ font-size:17px; margin:36px 0 3px; font-weight:600; }}
  .quoi {{ max-width:74ch; color:#b4b1ad; margin:0 0 16px; font-size:13.5px; }}
  .rangee {{ display:flex; gap:16px; flex-wrap:wrap; align-items:flex-start; }}
  figure {{ margin:0; }}
  /* L'image de départ est mise à part par un trait : ce n'est pas une méthode
     de plus, c'est ce que les cinq autres essaient de reproduire. */
  figure.depart {{ padding-right:16px; border-right:1px dashed #45454c; }}
  figure.depart figcaption b {{ color:#f0c987; }}
  img {{ display:block; image-rendering:pixelated; height:{cible * 3}px;
         background: repeating-conic-gradient(#2a2a2d 0 25%, #232326 0 50%) 0 0/16px 16px;
         border:1px solid #34343a; border-radius:2px; }}
  figcaption {{ margin-top:8px; max-width:{cible * 3}px; }}
  figcaption b {{ display:block; font-size:12.5px; }}
  figcaption span {{ display:block; color:#8d8a86; font-size:11.5px; margin-top:3px;
                     line-height:1.45; }}
</style>
<h1>Cinq façons de fabriquer un sprite de {cible} carrés</h1>
<p class="intro">Un sprite de <b>{cible}</b>, ça veut dire un personnage fait de {cible}
carrés de couleur en largeur. Les modèles d'image ne savent pas dessiner comme ça :
ils rendent un dessin très fin, et c'est l'atelier qui doit le ramener à {cible} carrés.
<b>Cette page compare cinq manières de le faire.</b></p>
<p class="intro">À gauche de chaque rangée, en orange, <b>l'image que le modèle a
rendue</b> — c'est le point de départ commun. À sa droite, les cinq résultats, tous
agrandis trois fois pour qu'on voie bien les carrés.</p>
<p class="gratuit">Rien ici n'a coûté d'argent : tout se calcule sur la machine, sans
rien redemander à personne.</p>
{"".join(blocs)}
</html>"""


NOTES = {
    "aujourd'hui": "Pour chaque carré, l'atelier pioche un point du dessin au "
    "hasard et jette tous les autres. Rapide, mais un détail sur deux disparaît.",
    "moyenne": "Il mélange tous les points du carré en une couleur moyenne. Rien "
    "n'est perdu, mais ça fabrique des couleurs floues qui n'existaient pas.",
    "vote": "Il regarde quelle couleur revient le plus dans le carré et garde "
    "celle-là, telle quelle. Les couleurs restent franches.",
    "vote en deux temps": "Comme au-dessus, mais il regroupe d'abord les nuances "
    "proches pour choisir, puis reprend la couleur exacte du dessin. Traits nets "
    "sans perdre les nuances.",
    "sur le pas trouvé": "S'il repère que le modèle a déjà dessiné des carrés, il "
    "se cale dessus. Sinon, il fait comme la méthode précédente.",
}


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")  # type: ignore[union-attr]
    parseur = argparse.ArgumentParser(description=__doc__)
    parseur.add_argument("--cible", type=int, default=64)
    arguments = parseur.parse_args()
    cible = arguments.cible

    print(f"\n  Cinq façons de faire un sprite de {cible} blocs.\n")
    sections = []
    releve: dict[str, dict] = {}
    for titre, quoi, relatif in EPREUVES:
        chemin = RACINE / "donnees" / relatif
        if not chemin.exists():
            print(f"  absente : {relatif}")
            continue
        sujet = _sujet(chemin)
        pas = _pas_du_modele(sujet)
        print(f"  {titre:24} sujet {sujet.shape[1]}×{sujet.shape[0]} · "
              f"grille du modèle : {f'{pas} px' if pas else 'aucune trouvée'}")
        # **L'image de départ ouvre la rangée, et ce n'est pas décoratif.**
        # Sans elle on compare cinq résultats entre eux sans savoir ce qu'ils
        # étaient censés reproduire — et c'est le point de tout le banc : la
        # peinture et le pixel art ne partent pas du même endroit.
        vignettes = [
            {
                "nom": "l'image reçue",
                "note": f"telle que le modèle l'a rendue · {sujet.shape[1]}×{sujet.shape[0]} points",
                "image": _en_donnees(_a_la_hauteur(sujet, cible * 3)),
                "depart": True,
            }
        ]
        for nom, methode in METHODES.items():
            vignettes.append(
                {
                    "nom": nom,
                    "note": NOTES[nom],
                    "image": _en_donnees(methode(sujet, cible), agrandi=3),
                    "depart": False,
                }
            )
        sections.append(
            {
                "titre": titre,
                "quoi": quoi
                + (
                    f" L'atelier a mesuré ses carrés : {pas} points de côté."
                    if pas
                    else " L'atelier a cherché des carrés et n'en a trouvé aucun — "
                    "ce qui est la bonne réponse."
                ),
                "vignettes": vignettes,
            }
        )
        releve[titre] = {"pas": pas, "sujet": list(sujet.shape[:2])}

    dossier = RACINE / "essais" / "resultats"
    dossier.mkdir(parents=True, exist_ok=True)
    page = dossier / "conversion-pixel.html"
    page.write_text(_page(sections, cible), encoding="utf-8")
    (RACINE / "essais" / "mesures_conversion_pixel.json").write_text(
        json.dumps(releve, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(f"\n  À ouvrir : {page.relative_to(RACINE)}\n")


if __name__ == "__main__":
    main()
