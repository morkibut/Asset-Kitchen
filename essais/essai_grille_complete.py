# -*- coding: utf-8 -*-
"""E3 — la grille complète : 4×2 au lieu de 3×3 à deux cases vides.

**La question.** `geometrie(8)` rend trois colonnes sur trois lignes : la
dernière rangée n'a que deux cases, et le modèle complète la troisième —
quatre planches sur treize ont été refusées « pour un sujet de trop ». Une
grille complète de quatre sur deux, dans un format d'image qui la rend lisible,
supprime-t-elle la case fantôme sans dégrader le reste ?

**Ce qu'on attend.** Zéro « neuf pour huit » en B et en C ; un personnage un peu
plus petit par case en 3:2, à voir si ça se paie en lisibilité.

**Les groupes.** `A-temoin` : le départ rejoué, déjà sur le disque.
`B-4x2-carre` : le gabarit du produit pour `Geometrie(8, 4, 2)` sur son canevas
carré — des cases hautes, ~226×468 px. `C-4x2-3sur2` : le même gabarit
redessiné sur 1024×683 avec les constantes du produit, et le format `3:2`
demandé au modèle. Le texte est celui du témoin ; seuls les chiffres de la
consigne de grille changent, et le rapport le montre mot à mot.

    Coût   : à deux tirages (choix de l'auteur, 2 septembre 2026) : quatre appels
             neufs, ~0,12 $ ; PLAFOND 0,40 $ sur ce lancement. `--tirages 2`.
    Témoin : les deux planches A2 de E1 (artworks du jour), sans repayer.
    A sec  : .venv\\Scripts\\python.exe essais/essai_grille_complete.py --a-sec
    Payer  : .venv\\Scripts\\python.exe essais/essai_grille_complete.py
    Rapport: essais/rapport-grille-complete.html · notes : essais/notes-grille-complete.json

Sortie : `essais/resultats_grille_complete/<cle>/jet<N>.png` et `mesures.json`.
Un tirage déjà sur le disque n'est jamais repayé.
"""

from __future__ import annotations

import asyncio
import io
import json
import sys
from pathlib import Path

from PIL import Image

RACINE = Path(__file__).resolve().parent
sys.path.insert(0, str(RACINE))

from atelier.domaine.pliage import Geometrie  # noqa: E402
from atelier.image.pliage import gabarit  # noqa: E402

from socle_essais import (  # noqa: E402
    CASES,
    GABARIT,
    JETS,
    MODELE_DEFAUT,
    ImageJointe,
    Seance,
    Variante,
    arguments,
    changer_grille,
    gabarit_rectangle,
    preparer_sortie,
    rapport,
    rejouer,
    temoin_du_jour,
)

ESSAI = "grille-complete"
PLAFOND_USD = 0.40

ECHECS = (
    "neuf sujets (ou plus) pour huit demandés",
    "moins de huit sujets",
    "le personnage est trop petit ou illisible dans sa case",
    "a redessiné les traits de la grille",
    "le format rendu n'est pas celui demandé",
)

REGLE = (
    "<b>B ou C remplace 3×3 si son nombre de « neuf pour huit » est nul sur ses tirages et si ses bonnes "
    "planches sont ≥ A − 1 — et, à deux tirages, au moins la moitié de bonnes</b> (la règle de l'auteur du "
    "2 septembre 2026 : sans ce plancher, un témoin à une bonne rendrait « ≥ A − 1 » vide). Entre B et C, le "
    "format où l'auteur juge le personnage le plus lisible. Si "
    "les deux échouent sur la lisibilité, R6 garde la tolérance du neuvième sujet telle qu'écrite — mais on "
    "saura pourquoi. Le compte « neuf pour huit » se lit dans les cases cochées, pas dans le chiffre de la machine."
)

REGLE_JS = """function(s){
 var A=s['A-temoin'], out=[];
 ['B-4x2-carre','C-4x2-3sur2'].forEach(function(cle){
  var g=s[cle]; if(!g) return;
  var neuf=g.echecs['neuf sujets (ou plus) pour huit demandés']||0;
  var pret = A.notees && g.notees;
  var plancher = Math.max(A.bon-1, Math.ceil(g.essais/2));
  var zero = neuf===0, assez = g.bon >= plancher;
  out.push('<span class="'+(pret?(zero&&assez?'oui':'non'):'attente')+'">'+cle+'</span> : neuf-pour-huit cochés '+neuf+' (il en faut 0) · bonnes '+g.bon+' contre A '+A.bon+' (il en faut ≥ '+plancher+') → '
   +(pret?(zero&&assez?'règle atteinte':'règle non atteinte'):'en attente de notes'));
 });
 return out;
}"""


def variantes() -> list[Variante]:
    depart = rejouer()
    # Le témoin avec les artworks du jour (2 septembre 2026) : les deux planches
    # A2 de E1, relues sans repayer — B et C partent avec les mêmes images.
    temoin = temoin_du_jour(depart, echecs=ECHECS)
    sans_gabarit = tuple(i for i in temoin.images if i.role != GABARIT)
    rang = len(sans_gabarit) + 1
    texte = changer_grille(depart.texte, 4, 2, CASES)
    forme = Geometrie(CASES, 4, 2)
    b = Variante(
        cle="B-4x2-carre",
        titre="Quatre sur deux, canevas carré",
        propos="le gabarit du produit pour une grille 4×2 sur son canevas carré — des cases hautes ; la "
               "consigne de grille passe à « 4 columns and 2 rows », rien d'autre ne change",
        texte=texte,
        images=sans_gabarit + (ImageJointe(rang, GABARIT, gabarit(forme), "gabarit"),),
        echecs_prevus=ECHECS,
        proportions=depart.proportions,
        negatif=depart.negatif,
    )
    c = Variante(
        cle="C-4x2-3sur2",
        titre="Quatre sur deux, format 3:2",
        propos="le même gabarit redessiné sur 1024×683 avec les constantes du produit, et le format 3:2 "
               "demandé au modèle ; même texte que B",
        texte=texte,
        images=sans_gabarit + (ImageJointe(rang, GABARIT, gabarit_rectangle(forme, 1024, 683), "gabarit"),),
        echecs_prevus=ECHECS,
        proportions="3:2",
        negatif=depart.negatif,
    )
    return [temoin, b, c]


def verifier_format(seance: Seance, liste: list[Variante], jets=JETS) -> list[str]:
    """Le format rendu, vérifié sur les octets — un échec prévu que la machine sait voir."""
    avertissements: list[str] = []
    attendus = {"1:1": 1.0, "3:2": 1.5}
    for v in liste:
        if v.temoin:
            continue
        dossier = seance.dossier_de(v)
        for jet in jets:
            fichier = dossier / f"jet{jet}.png"
            if not fichier.exists():
                continue
            with Image.open(io.BytesIO(fichier.read_bytes())) as image:
                rapport_lh = image.width / image.height
            voulu = attendus.get(v.proportions, 1.0)
            if abs(rapport_lh - voulu) > 0.05:
                avertissements.append(
                    f"{v.cle} jet {jet} : {image.width}×{image.height} rendu pour un format {v.proportions} demandé"
                )
    return avertissements


async def principal() -> None:
    preparer_sortie()
    args = arguments(__doc__.split("\n")[0]).parse_args()
    seance = Seance(ESSAI, PLAFOND_USD)
    jets = tuple(range(1, args.tirages + 1))
    liste = variantes()

    if args.a_sec:
        seance.a_sec(liste, jets=jets)
    elif not args.rapport:
        passerelle, catalogue = await seance.passerelle_reelle()
        modele = catalogue.get(MODELE_DEFAUT)
        if modele is None:
            print(f"[x] {MODELE_DEFAUT} absent du catalogue")
            return
        if "3:2" not in modele.proportions:
            print("[x] le modele ne declare pas le format 3:2 : C partirait en 1:1 sans le dire — on s'arrete")
            return
        print(f"plafond de ce lancement ${PLAFOND_USD:.2f}\n")
        await asyncio.gather(*(seance.tirer(v, passerelle, modele, jets=jets) for v in liste))
        seance.bilan()

    avertissements = verifier_format(seance, liste, jets)
    for a in avertissements:
        print(f"[!] {a}")
    rapport(
        ESSAI,
        "E3 · La grille complète — 4×2 au lieu de 3×3",
        liste,
        seance,
        question="La grille 3×3 du produit laisse une case vide que le modèle remplit — quatre planches sur treize "
                 "refusées pour un sujet de trop. Une grille complète 4×2, dans un format qui la rend lisible, "
                 "supprime-t-elle la case fantôme sans dégrader le reste ?",
        attendu="Zéro « neuf pour huit » en B et en C ; un personnage un peu plus petit par case en 3:2, à voir si "
                "ça se paie en lisibilité. B ne change que la géométrie ; C change aussi le format d'image, et c'est "
                "pour ça qu'il vient après.",
        regle=REGLE,
        jets=jets,
        regle_js=REGLE_JS,
        avertissements=avertissements,
    )


if __name__ == "__main__":
    asyncio.run(principal())
