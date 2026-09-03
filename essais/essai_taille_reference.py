# -*- coding: utf-8 -*-
"""E2 — la taille de la référence : le sprite promu en 64, 256 ou 512 px.

**La question.** Le sprite promu part en rendu PNG à la taille cible du projet
— 64×64 pour demander une image de 1024 px. Le modèle voit-il assez de son
sujet ? Un agrandissement au plus proche voisin, qui garde les pixels carrés,
ferait-il mieux, et à quel surcoût — le coût croît avec la surface ?

**Ce qu'on attend.** Que 256 px améliore « le personnage est le même » sans
changer le reste, et que 512 px n'apporte plus rien tout en coûtant davantage.

**Les groupes.** `A-temoin` : le sprite en 64 px, tel qu'il part aujourd'hui.
`B-256` : le même rendu agrandi ×4 au plus proche voisin. `C-512` : ×8. Le
texte est **strictement celui du témoin** — E2 mesure une seule chose. Seule
l'image de rôle `reference` change ; les artworks du jour et le gabarit restent
identiques. **Relecture du 2 septembre 2026** : le témoin du 1ᵉʳ septembre est
parti avec un artwork retiré depuis ; comparer B et C à lui aurait changé deux
choses à la fois. Le témoin est donc celui de E1 avec les artworks du jour. Le rapport montre, au-dessus de chaque colonne, la référence
envoyée à sa taille réelle, pour que l'auteur voie ce que le modèle a vu.

    Coût   : à deux tirages (choix de l'auteur, 2 septembre 2026) : quatre appels
             neufs, ~0,15 $ (B et C coûtent plus cher par appel, et c'est une des
             mesures) ; PLAFOND 1,00 $ sur ce lancement. `--tirages 2`.
    Témoin : les deux planches A2 de E1 (artworks du jour, sprite 64 px), sans repayer.
    A sec  : .venv\\Scripts\\python.exe essais/essai_taille_reference.py --a-sec
    Payer  : .venv\\Scripts\\python.exe essais/essai_taille_reference.py
    Rapport: essais/rapport-taille-reference.html · notes : essais/notes-taille-reference.json

Sortie : `essais/resultats_taille_reference/<cle>/jet<N>.png` et `mesures.json`.
`taille_retenue()` est ce que E4 et E5 relisent : la taille que la règle
retient d'après les notes, 256 px tant qu'aucune note n'existe.
"""

from __future__ import annotations

import asyncio
import html
import sys
from dataclasses import replace
from pathlib import Path

RACINE = Path(__file__).resolve().parent
sys.path.insert(0, str(RACINE))

from socle_essais import (  # noqa: E402
    MODELE_DEFAUT,
    REFERENCE_ROLE,
    ImageJointe,
    Seance,
    Variante,
    agrandir,
    arguments,
    notes_de,
    preparer_sortie,
    rapport,
    rejouer,
    temoin_du_jour,
    vignette,
)

ESSAI = "taille-reference"
PLAFOND_USD = 1.00

ECHEC_MEME = "le personnage n'est pas reconnaissable comme le même"
ECHECS = (
    ECHEC_MEME,
    "les proportions changent (tête, membres)",
    "les cases recopient la pose de la référence",
    "le style « escalier » de l'agrandissement se retrouve dans la planche (blocs de 4 ou 8 px)",
)

TAILLES = {"A-temoin": 64, "B-256": 256, "C-512": 512}

REGLE = (
    "<b>La taille retenue est la plus petite dont le nombre de « même personnage » — bonnes + moyennes sans la "
    "case « pas reconnaissable » — est ≥ celui de la taille au-dessus.</b> Le prix par bonne planche est affiché à "
    "côté pour que l'auteur voie ce qu'il achète. Si 64 px n'est jamais battu, la question est fermée et le bilan "
    "le dit. Tant qu'aucune note n'existe, E4 et E5 partent en 256 px."
)

REGLE_JS = """function(s, notes){
 var E=%s, out=[];
 function meme(cle){ var g=GROUPES[cle], n=0; g.jets.forEach(function(j){ var x=notes[cle+':'+j.jet]||{};
  if((x.note==='bon'||x.note==='moyen') && !((x.echecs||[]).indexOf(E)>=0)) n++; }); return n; }
 var a=meme('A-temoin'), b=meme('B-256'), c=meme('C-512');
 var pret = s['A-temoin'].notees && s['B-256'].notees && s['C-512'].notees;
 out.push('<span class=attente>« même personnage » : 64 px '+a+' · 256 px '+b+' · 512 px '+c+'</span>');
 if(!pret){ out.push('<span class=attente>en attente de notes sur les trois groupes</span>'); return out; }
 var retenue = (a>=b) ? 64 : (b>=c ? 256 : 512);
 out.push('<span class="'+(retenue===64?'non':'oui')+'">taille retenue : '+retenue+' px'+(retenue===64?' — 64 px n\\'est pas battu, la question est fermée':'')+'</span>');
 return out;
}"""


def variantes() -> list[Variante]:
    depart = rejouer()
    # **Les images du jour, pour tous les groupes** (2 septembre 2026) : le témoin
    # du 1ᵉʳ septembre est parti avec un artwork retiré depuis ; le point de
    # comparaison est le témoin neuf de E1, parti avec les deux artworks officiels
    # et le sprite en 64 px — deux planches relues sans repayer.
    temoin = temoin_du_jour(depart, echecs=ECHECS,
                            propos="le sprite promu en 64 px, tel qu'il part aujourd'hui, avec les artworks du jour "
                                   "— les deux planches A2 de E1, relues sans repayer")
    liste = [temoin]
    for cle, facteur in (("B-256", 4), ("C-512", 8)):
        images = tuple(
            replace(i, octets=agrandir(i.octets, facteur)) if i.role == REFERENCE_ROLE else i
            for i in temoin.images
        )
        liste.append(Variante(
            cle=cle,
            titre=f"La référence en {TAILLES[cle]} px",
            propos=f"le même rendu du sprite promu agrandi ×{facteur} au plus proche voisin ; texte, artwork et "
                   f"gabarit strictement ceux du témoin",
            texte=depart.texte,
            images=images,
            echecs_prevus=ECHECS,
            proportions=depart.proportions,
            negatif=depart.negatif,
        ))
    for v in liste:
        reference = next(i for i in v.images if i.role == REFERENCE_ROLE)
        largeur, hauteur = reference.taille
        v.entete_html = (
            f"<img alt='référence envoyée' width={largeur} height={hauteur} "
            f"src='data:image/png;base64,{vignette(reference.octets, max(largeur, hauteur))}'>"
            f"ce que le modèle a vu : la référence à {largeur}×{hauteur}, taille réelle"
        )
    return liste


def taille_retenue() -> int:
    """La taille que la règle retient d'après `notes-taille-reference.json` ; 256 sans notes."""
    notes = notes_de(ESSAI).get("notes", {})
    if not notes:
        return 256

    def meme(cle: str) -> int:
        return sum(
            1 for jet in range(1, 9)
            if (n := notes.get(f"{cle}:jet{jet}", {})).get("note") in ("bon", "moyen")
            and ECHEC_MEME not in n.get("echecs", [])
        )

    a, b, c = meme("A-temoin"), meme("B-256"), meme("C-512")
    if a >= b:
        return 64
    return 256 if b >= c else 512


async def principal() -> None:
    preparer_sortie()
    args = arguments(__doc__.split("\n")[0]).parse_args()
    seance = Seance(ESSAI, PLAFOND_USD)
    jets = tuple(range(1, args.tirages + 1))
    liste = variantes()

    if args.a_sec:
        seance.a_sec(liste, jets=jets)
        print("\n[i] le prix estime est celui d'un appel a reference de 64 px : B et C paieront la surface en plus,"
              " et c'est une des mesures")
    elif not args.rapport:
        passerelle, catalogue = await seance.passerelle_reelle()
        modele = catalogue.get(MODELE_DEFAUT)
        if modele is None:
            print(f"[x] {MODELE_DEFAUT} absent du catalogue")
            return
        print(f"plafond de ce lancement ${PLAFOND_USD:.2f}\n")
        await asyncio.gather(*(seance.tirer(v, passerelle, modele, jets=jets) for v in liste))
        seance.bilan()

    rapport(
        ESSAI,
        "E2 · La taille de la référence — 64, 256 ou 512 px",
        liste,
        seance,
        question="Le sprite promu part en 64×64 pour demander une image de 1024 px. Le modèle voit-il assez de "
                 "son sujet ? Un agrandissement au plus proche voisin, qui garde les pixels carrés, fait-il mieux, "
                 "et à quel surcoût ?",
        attendu="Que 256 px améliore « le personnage est le même » sans changer le reste, et que 512 px "
                "n'apporte plus rien de plus tout en coûtant davantage. Au-dessus de chaque colonne : la référence "
                "envoyée, à sa taille réelle.",
        regle=REGLE,
        jets=jets,
        regle_js=REGLE_JS % __import__("json").dumps(ECHEC_MEME, ensure_ascii=False),
    )


if __name__ == "__main__":
    asyncio.run(principal())
